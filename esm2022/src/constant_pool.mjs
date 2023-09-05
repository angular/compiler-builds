/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from './output/output_ast';
const CONSTANT_PREFIX = '_c';
/**
 * `ConstantPool` tries to reuse literal factories when two or more literals are identical.
 * We determine whether literals are identical by creating a key out of their AST using the
 * `KeyVisitor`. This constant is used to replace dynamic expressions which can't be safely
 * converted into a key. E.g. given an expression `{foo: bar()}`, since we don't know what
 * the result of `bar` will be, we create a key that looks like `{foo: <unknown>}`. Note
 * that we use a variable, rather than something like `null` in order to avoid collisions.
 */
const UNKNOWN_VALUE_KEY = o.variable('<unknown>');
/**
 * Context to use when producing a key.
 *
 * This ensures we see the constant not the reference variable when producing
 * a key.
 */
const KEY_CONTEXT = {};
/**
 * Generally all primitive values are excluded from the `ConstantPool`, but there is an exclusion
 * for strings that reach a certain length threshold. This constant defines the length threshold for
 * strings.
 */
const POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS = 50;
/**
 * A node that is a place-holder that allows the node to be replaced when the actual
 * node is known.
 *
 * This allows the constant pool to change an expression from a direct reference to
 * a constant to a shared constant. It returns a fix-up node that is later allowed to
 * change the referenced expression.
 */
class FixupExpression extends o.Expression {
    constructor(resolved) {
        super(resolved.type);
        this.resolved = resolved;
        this.shared = false;
        this.original = resolved;
    }
    visitExpression(visitor, context) {
        if (context === KEY_CONTEXT) {
            // When producing a key we want to traverse the constant not the
            // variable used to refer to it.
            return this.original.visitExpression(visitor, context);
        }
        else {
            return this.resolved.visitExpression(visitor, context);
        }
    }
    isEquivalent(e) {
        return e instanceof FixupExpression && this.resolved.isEquivalent(e.resolved);
    }
    isConstant() {
        return true;
    }
    clone() {
        throw new Error(`Not supported.`);
    }
    fixup(expression) {
        this.resolved = expression;
        this.shared = true;
    }
}
/**
 * A constant pool allows a code emitter to share constant in an output context.
 *
 * The constant pool also supports sharing access to ivy definitions references.
 */
export class ConstantPool {
    constructor(isClosureCompilerEnabled = false) {
        this.isClosureCompilerEnabled = isClosureCompilerEnabled;
        this.statements = [];
        this.literals = new Map();
        this.literalFactories = new Map();
        this.sharedConstants = new Map();
        this.nextNameIndex = 0;
    }
    getConstLiteral(literal, forceShared) {
        if ((literal instanceof o.LiteralExpr && !isLongStringLiteral(literal)) ||
            literal instanceof FixupExpression) {
            // Do no put simple literals into the constant pool or try to produce a constant for a
            // reference to a constant.
            return literal;
        }
        const key = GenericKeyFn.INSTANCE.keyOf(literal);
        let fixup = this.literals.get(key);
        let newValue = false;
        if (!fixup) {
            fixup = new FixupExpression(literal);
            this.literals.set(key, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            // Replace the expression with a variable
            const name = this.freshName();
            let definition;
            let usage;
            if (this.isClosureCompilerEnabled && isLongStringLiteral(literal)) {
                // For string literals, Closure will **always** inline the string at
                // **all** usages, duplicating it each time. For large strings, this
                // unnecessarily bloats bundle size. To work around this restriction, we
                // wrap the string in a function, and call that function for each usage.
                // This tricks Closure into using inline logic for functions instead of
                // string literals. Function calls are only inlined if the body is small
                // enough to be worth it. By doing this, very large strings will be
                // shared across multiple usages, rather than duplicating the string at
                // each usage site.
                //
                // const myStr = function() { return "very very very long string"; };
                // const usage1 = myStr();
                // const usage2 = myStr();
                definition = o.variable(name).set(new o.FunctionExpr([], // Params.
                [
                    // Statements.
                    new o.ReturnStatement(literal),
                ]));
                usage = o.variable(name).callFn([]);
            }
            else {
                // Just declare and use the variable directly, without a function call
                // indirection. This saves a few bytes and avoids an unnecessary call.
                definition = o.variable(name).set(literal);
                usage = o.variable(name);
            }
            this.statements.push(definition.toDeclStmt(o.INFERRED_TYPE, o.StmtModifier.Final));
            fixup.fixup(usage);
        }
        return fixup;
    }
    getSharedConstant(def, expr) {
        const key = def.keyOf(expr);
        if (!this.sharedConstants.has(key)) {
            const id = this.freshName();
            this.sharedConstants.set(key, o.variable(id));
            this.statements.push(def.toSharedConstantDeclaration(id, expr));
        }
        return this.sharedConstants.get(key);
    }
    getLiteralFactory(literal) {
        // Create a pure function that builds an array of a mix of constant and variable expressions
        if (literal instanceof o.LiteralArrayExpr) {
            const argumentsForKey = literal.entries.map(e => e.isConstant() ? e : UNKNOWN_VALUE_KEY);
            const key = GenericKeyFn.INSTANCE.keyOf(o.literalArr(argumentsForKey));
            return this._getLiteralFactory(key, literal.entries, entries => o.literalArr(entries));
        }
        else {
            const expressionForKey = o.literalMap(literal.entries.map(e => ({
                key: e.key,
                value: e.value.isConstant() ? e.value : UNKNOWN_VALUE_KEY,
                quoted: e.quoted
            })));
            const key = GenericKeyFn.INSTANCE.keyOf(expressionForKey);
            return this._getLiteralFactory(key, literal.entries.map(e => e.value), entries => o.literalMap(entries.map((value, index) => ({
                key: literal.entries[index].key,
                value,
                quoted: literal.entries[index].quoted
            }))));
        }
    }
    getSharedFunctionReference(fn, prefix) {
        const isArrow = fn instanceof o.ArrowFunctionExpr;
        for (const current of this.statements) {
            // Arrow functions are saved as variables so we check if the
            // value of the variable is the same as the arrow function.
            if (isArrow && current instanceof o.DeclareVarStmt && current.value?.isEquivalent(fn)) {
                return o.variable(current.name);
            }
            // Function declarations are saved as function statements
            // so we compare them directly to the passed-in function.
            if (!isArrow && current instanceof o.DeclareFunctionStmt && fn.isEquivalent(current)) {
                return o.variable(current.name);
            }
        }
        // Otherwise declare the function.
        const name = this.uniqueName(prefix);
        this.statements.push(fn.toDeclStmt(name, o.StmtModifier.Final));
        return o.variable(name);
    }
    _getLiteralFactory(key, values, resultMap) {
        let literalFactory = this.literalFactories.get(key);
        const literalFactoryArguments = values.filter((e => !e.isConstant()));
        if (!literalFactory) {
            const resultExpressions = values.map((e, index) => e.isConstant() ? this.getConstLiteral(e, true) : o.variable(`a${index}`));
            const parameters = resultExpressions.filter(isVariable).map(e => new o.FnParam(e.name, o.DYNAMIC_TYPE));
            const pureFunctionDeclaration = o.fn(parameters, [new o.ReturnStatement(resultMap(resultExpressions))], o.INFERRED_TYPE);
            const name = this.freshName();
            this.statements.push(o.variable(name)
                .set(pureFunctionDeclaration)
                .toDeclStmt(o.INFERRED_TYPE, o.StmtModifier.Final));
            literalFactory = o.variable(name);
            this.literalFactories.set(key, literalFactory);
        }
        return { literalFactory, literalFactoryArguments };
    }
    /**
     * Produce a unique name.
     *
     * The name might be unique among different prefixes if any of the prefixes end in
     * a digit so the prefix should be a constant string (not based on user input) and
     * must not end in a digit.
     */
    uniqueName(prefix) {
        return `${prefix}${this.nextNameIndex++}`;
    }
    freshName() {
        return this.uniqueName(CONSTANT_PREFIX);
    }
}
export class GenericKeyFn {
    static { this.INSTANCE = new GenericKeyFn(); }
    keyOf(expr) {
        if (expr instanceof o.LiteralExpr && typeof expr.value === 'string') {
            return `"${expr.value}"`;
        }
        else if (expr instanceof o.LiteralExpr) {
            return String(expr.value);
        }
        else if (expr instanceof o.LiteralArrayExpr) {
            const entries = [];
            for (const entry of expr.entries) {
                entries.push(this.keyOf(entry));
            }
            return `[${entries.join(',')}]`;
        }
        else if (expr instanceof o.LiteralMapExpr) {
            const entries = [];
            for (const entry of expr.entries) {
                let key = entry.key;
                if (entry.quoted) {
                    key = `"${key}"`;
                }
                entries.push(key + ':' + this.keyOf(entry.value));
            }
            return `{${entries.join(',')}}`;
        }
        else if (expr instanceof o.ExternalExpr) {
            return `import("${expr.value.moduleName}", ${expr.value.name})`;
        }
        else if (expr instanceof o.ReadVarExpr) {
            return `read(${expr.name})`;
        }
        else if (expr instanceof o.TypeofExpr) {
            return `typeof(${this.keyOf(expr.expr)})`;
        }
        else {
            throw new Error(`${this.constructor.name} does not handle expressions of type ${expr.constructor.name}`);
        }
    }
}
function isVariable(e) {
    return e instanceof o.ReadVarExpr;
}
function isLongStringLiteral(expr) {
    return expr instanceof o.LiteralExpr && typeof expr.value === 'string' &&
        expr.value.length >= POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRfcG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb25zdGFudF9wb29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFekMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBRTdCOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFbEQ7Ozs7O0dBS0c7QUFDSCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFFdkI7Ozs7R0FJRztBQUNILE1BQU0sMkNBQTJDLEdBQUcsRUFBRSxDQUFDO0FBRXZEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGVBQWdCLFNBQVEsQ0FBQyxDQUFDLFVBQVU7SUFLeEMsWUFBbUIsUUFBc0I7UUFDdkMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQURKLGFBQVEsR0FBUixRQUFRLENBQWM7UUFGekMsV0FBTSxHQUFHLEtBQUssQ0FBQztRQUliLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQzNCLENBQUM7SUFFUSxlQUFlLENBQUMsT0FBNEIsRUFBRSxPQUFZO1FBQ2pFLElBQUksT0FBTyxLQUFLLFdBQVcsRUFBRTtZQUMzQixnRUFBZ0U7WUFDaEUsZ0NBQWdDO1lBQ2hDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3hEO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN4RDtJQUNILENBQUM7SUFFUSxZQUFZLENBQUMsQ0FBZTtRQUNuQyxPQUFPLENBQUMsWUFBWSxlQUFlLElB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LENBQUM7U0FDOUY7SUFDSCxDQUFDOztBQUdILFNBQVMsVUFBVSxDQUFDLENBQWU7SUFDakMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNwQyxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUFrQjtJQUM3QyxPQUFPLElBQUksWUFBWSxDQUFDLENBQUMsV0FBVyxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxRQUFRO1FBQ2xFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLDJDQUEyQyxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcblxuY29uc3QgQ09OU1RBTlRfUFJFRklYID0gJ19jJztcblxuLyoqXG4gKiBgQ29uc3RhbnRQb29sYCB0cmllcyB0byByZXVzZSBsaXRlcmFsIGZhY3RvcmllcyB3aGVuIHR3byBvciBtb3JlIGxpdGVyYWxzIGFyZSBpZGVudGljYWwuXG4gKiBXZSBkZXRlcm1pbmUgd2hldGhlciBsaXRlcmFscyBhcmUgaWRlbnRpY2FsIGJ5IGNyZWF0aW5nIGEga2V5IG91dCBvZiB0aGVpciBBU1QgdXNpbmcgdGhlXG4gKiBgS2V5VmlzaXRvcmAuIFRoaXMgY29uc3RhbnQgaXMgdXNlZCB0byByZXBsYWNlIGR5bmFtaWMgZXhwcmVzc2lvbnMgd2hpY2ggY2FuJ3QgYmUgc2FmZWx5XG4gKiBjb252ZXJ0ZWQgaW50byBhIGtleS4gRS5nLiBnaXZlbiBhbiBleHByZXNzaW9uIGB7Zm9vOiBiYXIoKX1gLCBzaW5jZSB3ZSBkb24ndCBrbm93IHdoYXRcbiAqIHRoZSByZXN1bHQgb2YgYGJhcmAgd2lsbCBiZSwgd2UgY3JlYXRlIGEga2V5IHRoYXQgbG9va3MgbGlrZSBge2ZvbzogPHVua25vd24+fWAuIE5vdGVcbiAqIHRoYXQgd2UgdXNlIGEgdmFyaWFibGUsIHJhdGhlciB0aGFuIHNvbWV0aGluZyBsaWtlIGBudWxsYCBpbiBvcmRlciB0byBhdm9pZCBjb2xsaXNpb25zLlxuICovXG5jb25zdCBVTktOT1dOX1ZBTFVFX0tFWSA9IG8udmFyaWFibGUoJzx1bmtub3duPicpO1xuXG4vKipcbiAqIENvbnRleHQgdG8gdXNlIHdoZW4gcHJvZHVjaW5nIGEga2V5LlxuICpcbiAqIFRoaXMgZW5zdXJlcyB3ZSBzZWUgdGhlIGNvbnN0YW50IG5vdCB0aGUgcmVmZXJlbmNlIHZhcmlhYmxlIHdoZW4gcHJvZHVjaW5nXG4gKiBhIGtleS5cbiAqL1xuY29uc3QgS0VZX0NPTlRFWFQgPSB7fTtcblxuLyoqXG4gKiBHZW5lcmFsbHkgYWxsIHByaW1pdGl2ZSB2YWx1ZXMgYXJlIGV4Y2x1ZGVkIGZyb20gdGhlIGBDb25zdGFudFBvb2xgLCBidXQgdGhlcmUgaXMgYW4gZXhjbHVzaW9uXG4gKiBmb3Igc3RyaW5ncyB0aGF0IHJlYWNoIGEgY2VydGFpbiBsZW5ndGggdGhyZXNob2xkLiBUaGlzIGNvbnN0YW50IGRlZmluZXMgdGhlIGxlbmd0aCB0aHJlc2hvbGQgZm9yXG4gKiBzdHJpbmdzLlxuICovXG5jb25zdCBQT09MX0lOQ0xVU0lPTl9MRU5HVEhfVEhSRVNIT0xEX0ZPUl9TVFJJTkdTID0gNTA7XG5cbi8qKlxuICogQSBub2RlIHRoYXQgaXMgYSBwbGFjZS1ob2xkZXIgdGhhdCBhbGxvd3MgdGhlIG5vZGUgdG8gYmUgcmVwbGFjZWQgd2hlbiB0aGUgYWN0dWFsXG4gKiBub2RlIGlzIGtub3duLlxuICpcbiAqIFRoaXMgYWxsb3dzIHRoZSBjb25zdGFudCBwb29sIHRvIGNoYW5nZSBhbiBleHByZXNzaW9uIGZyb20gYSBkaXJlY3QgcmVmZXJlbmNlIHRvXG4gKiBhIGNvbnN0YW50IHRvIGEgc2hhcmVkIGNvbnN0YW50LiBJdCByZXR1cm5zIGEgZml4LXVwIG5vZGUgdGhhdCBpcyBsYXRlciBhbGxvd2VkIHRvXG4gKiBjaGFuZ2UgdGhlIHJlZmVyZW5jZWQgZXhwcmVzc2lvbi5cbiAqL1xuY2xhc3MgRml4dXBFeHByZXNzaW9uIGV4dGVuZHMgby5FeHByZXNzaW9uIHtcbiAgcHJpdmF0ZSBvcmlnaW5hbDogby5FeHByZXNzaW9uO1xuXG4gIHNoYXJlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZXNvbHZlZDogby5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIocmVzb2x2ZWQudHlwZSk7XG4gICAgdGhpcy5vcmlnaW5hbCA9IHJlc29sdmVkO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGNvbnRleHQgPT09IEtFWV9DT05URVhUKSB7XG4gICAgICAvLyBXaGVuIHByb2R1Y2luZyBhIGtleSB3ZSB3YW50IHRvIHRyYXZlcnNlIHRoZSBjb25zdGFudCBub3QgdGhlXG4gICAgICAvLyB2YXJpYWJsZSB1c2VkIHRvIHJlZmVyIHRvIGl0LlxuICAgICAgcmV0dXJuIHRoaXMub3JpZ2luYWwudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlZC52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRml4dXBFeHByZXNzaW9uICYmIHRoaXMucmVzb2x2ZWQuaXNFcXVpdmFsZW50KGUucmVzb2x2ZWQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IEZpeHVwRXhwcmVzc2lvbiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOb3Qgc3VwcG9ydGVkLmApO1xuICB9XG5cbiAgZml4dXAoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gICAgdGhpcy5yZXNvbHZlZCA9IGV4cHJlc3Npb247XG4gICAgdGhpcy5zaGFyZWQgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQSBjb25zdGFudCBwb29sIGFsbG93cyBhIGNvZGUgZW1pdHRlciB0byBzaGFyZSBjb25zdGFudCBpbiBhbiBvdXRwdXQgY29udGV4dC5cbiAqXG4gKiBUaGUgY29uc3RhbnQgcG9vbCBhbHNvIHN1cHBvcnRzIHNoYXJpbmcgYWNjZXNzIHRvIGl2eSBkZWZpbml0aW9ucyByZWZlcmVuY2VzLlxuICovXG5leHBvcnQgY2xhc3MgQ29uc3RhbnRQb29sIHtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIGxpdGVyYWxzID0gbmV3IE1hcDxzdHJpbmcsIEZpeHVwRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBsaXRlcmFsRmFjdG9yaWVzID0gbmV3IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBzaGFyZWRDb25zdGFudHMgPSBuZXcgTWFwPHN0cmluZywgby5FeHByZXNzaW9uPigpO1xuXG4gIHByaXZhdGUgbmV4dE5hbWVJbmRleCA9IDA7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBpc0Nsb3N1cmVDb21waWxlckVuYWJsZWQ6IGJvb2xlYW4gPSBmYWxzZSkge31cblxuICBnZXRDb25zdExpdGVyYWwobGl0ZXJhbDogby5FeHByZXNzaW9uLCBmb3JjZVNoYXJlZD86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICgobGl0ZXJhbCBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIgJiYgIWlzTG9uZ1N0cmluZ0xpdGVyYWwobGl0ZXJhbCkpIHx8XG4gICAgICAgIGxpdGVyYWwgaW5zdGFuY2VvZiBGaXh1cEV4cHJlc3Npb24pIHtcbiAgICAgIC8vIERvIG5vIHB1dCBzaW1wbGUgbGl0ZXJhbHMgaW50byB0aGUgY29uc3RhbnQgcG9vbCBvciB0cnkgdG8gcHJvZHVjZSBhIGNvbnN0YW50IGZvciBhXG4gICAgICAvLyByZWZlcmVuY2UgdG8gYSBjb25zdGFudC5cbiAgICAgIHJldHVybiBsaXRlcmFsO1xuICAgIH1cbiAgICBjb25zdCBrZXkgPSBHZW5lcmljS2V5Rm4uSU5TVEFOQ0Uua2V5T2YobGl0ZXJhbCk7XG4gICAgbGV0IGZpeHVwID0gdGhpcy5saXRlcmFscy5nZXQoa2V5KTtcbiAgICBsZXQgbmV3VmFsdWUgPSBmYWxzZTtcbiAgICBpZiAoIWZpeHVwKSB7XG4gICAgICBmaXh1cCA9IG5ldyBGaXh1cEV4cHJlc3Npb24obGl0ZXJhbCk7XG4gICAgICB0aGlzLmxpdGVyYWxzLnNldChrZXksIGZpeHVwKTtcbiAgICAgIG5ld1ZhbHVlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoKCFuZXdWYWx1ZSAmJiAhZml4dXAuc2hhcmVkKSB8fCAobmV3VmFsdWUgJiYgZm9yY2VTaGFyZWQpKSB7XG4gICAgICAvLyBSZXBsYWNlIHRoZSBleHByZXNzaW9uIHdpdGggYSB2YXJpYWJsZVxuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuZnJlc2hOYW1lKCk7XG4gICAgICBsZXQgZGVmaW5pdGlvbjogby5Xcml0ZVZhckV4cHI7XG4gICAgICBsZXQgdXNhZ2U6IG8uRXhwcmVzc2lvbjtcbiAgICAgIGlmICh0aGlzLmlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZCAmJiBpc0xvbmdTdHJpbmdMaXRlcmFsKGxpdGVyYWwpKSB7XG4gICAgICAgIC8vIEZvciBzdHJpbmcgbGl0ZXJhbHMsIENsb3N1cmUgd2lsbCAqKmFsd2F5cyoqIGlubGluZSB0aGUgc3RyaW5nIGF0XG4gICAgICAgIC8vICoqYWxsKiogdXNhZ2VzLCBkdXBsaWNhdGluZyBpdCBlYWNoIHRpbWUuIEZvciBsYXJnZSBzdHJpbmdzLCB0aGlzXG4gICAgICAgIC8vIHVubmVjZXNzYXJpbHkgYmxvYXRzIGJ1bmRsZSBzaXplLiBUbyB3b3JrIGFyb3VuZCB0aGlzIHJlc3RyaWN0aW9uLCB3ZVxuICAgICAgICAvLyB3cmFwIHRoZSBzdHJpbmcgaW4gYSBmdW5jdGlvbiwgYW5kIGNhbGwgdGhhdCBmdW5jdGlvbiBmb3IgZWFjaCB1c2FnZS5cbiAgICAgICAgLy8gVGhpcyB0cmlja3MgQ2xvc3VyZSBpbnRvIHVzaW5nIGlubGluZSBsb2dpYyBmb3IgZnVuY3Rpb25zIGluc3RlYWQgb2ZcbiAgICAgICAgLy8gc3RyaW5nIGxpdGVyYWxzLiBGdW5jdGlvbiBjYWxscyBhcmUgb25seSBpbmxpbmVkIGlmIHRoZSBib2R5IGlzIHNtYWxsXG4gICAgICAgIC8vIGVub3VnaCB0byBiZSB3b3J0aCBpdC4gQnkgZG9pbmcgdGhpcywgdmVyeSBsYXJnZSBzdHJpbmdzIHdpbGwgYmVcbiAgICAgICAgLy8gc2hhcmVkIGFjcm9zcyBtdWx0aXBsZSB1c2FnZXMsIHJhdGhlciB0aGFuIGR1cGxpY2F0aW5nIHRoZSBzdHJpbmcgYXRcbiAgICAgICAgLy8gZWFjaCB1c2FnZSBzaXRlLlxuICAgICAgICAvL1xuICAgICAgICAvLyBjb25zdCBteVN0ciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJ2ZXJ5IHZlcnkgdmVyeSBsb25nIHN0cmluZ1wiOyB9O1xuICAgICAgICAvLyBjb25zdCB1c2FnZTEgPSBteVN0cigpO1xuICAgICAgICAvLyBjb25zdCB1c2FnZTIgPSBteVN0cigpO1xuICAgICAgICBkZWZpbml0aW9uID0gby52YXJpYWJsZShuYW1lKS5zZXQobmV3IG8uRnVuY3Rpb25FeHByKFxuICAgICAgICAgICAgW10sICAvLyBQYXJhbXMuXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIC8vIFN0YXRlbWVudHMuXG4gICAgICAgICAgICAgIG5ldyBvLlJldHVyblN0YXRlbWVudChsaXRlcmFsKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICApKTtcbiAgICAgICAgdXNhZ2UgPSBvLnZhcmlhYmxlKG5hbWUpLmNhbGxGbihbXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBKdXN0IGRlY2xhcmUgYW5kIHVzZSB0aGUgdmFyaWFibGUgZGlyZWN0bHksIHdpdGhvdXQgYSBmdW5jdGlvbiBjYWxsXG4gICAgICAgIC8vIGluZGlyZWN0aW9uLiBUaGlzIHNhdmVzIGEgZmV3IGJ5dGVzIGFuZCBhdm9pZHMgYW4gdW5uZWNlc3NhcnkgY2FsbC5cbiAgICAgICAgZGVmaW5pdGlvbiA9IG8udmFyaWFibGUobmFtZSkuc2V0KGxpdGVyYWwpO1xuICAgICAgICB1c2FnZSA9IG8udmFyaWFibGUobmFtZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc3RhdGVtZW50cy5wdXNoKGRlZmluaXRpb24udG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSk7XG4gICAgICBmaXh1cC5maXh1cCh1c2FnZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpeHVwO1xuICB9XG5cbiAgZ2V0U2hhcmVkQ29uc3RhbnQoZGVmOiBTaGFyZWRDb25zdGFudERlZmluaXRpb24sIGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3Qga2V5ID0gZGVmLmtleU9mKGV4cHIpO1xuICAgIGlmICghdGhpcy5zaGFyZWRDb25zdGFudHMuaGFzKGtleSkpIHtcbiAgICAgIGNvbnN0IGlkID0gdGhpcy5mcmVzaE5hbWUoKTtcbiAgICAgIHRoaXMuc2hhcmVkQ29uc3RhbnRzLnNldChrZXksIG8udmFyaWFibGUoaWQpKTtcbiAgICAgIHRoaXMuc3RhdGVtZW50cy5wdXNoKGRlZi50b1NoYXJlZENvbnN0YW50RGVjbGFyYXRpb24oaWQsIGV4cHIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2hhcmVkQ29uc3RhbnRzLmdldChrZXkpITtcbiAgfVxuXG4gIGdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkxpdGVyYWxNYXBFeHByKTpcbiAgICAgIHtsaXRlcmFsRmFjdG9yeTogby5FeHByZXNzaW9uLCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50czogby5FeHByZXNzaW9uW119IHtcbiAgICAvLyBDcmVhdGUgYSBwdXJlIGZ1bmN0aW9uIHRoYXQgYnVpbGRzIGFuIGFycmF5IG9mIGEgbWl4IG9mIGNvbnN0YW50IGFuZCB2YXJpYWJsZSBleHByZXNzaW9uc1xuICAgIGlmIChsaXRlcmFsIGluc3RhbmNlb2Ygby5MaXRlcmFsQXJyYXlFeHByKSB7XG4gICAgICBjb25zdCBhcmd1bWVudHNGb3JLZXkgPSBsaXRlcmFsLmVudHJpZXMubWFwKGUgPT4gZS5pc0NvbnN0YW50KCkgPyBlIDogVU5LTk9XTl9WQUxVRV9LRVkpO1xuICAgICAgY29uc3Qga2V5ID0gR2VuZXJpY0tleUZuLklOU1RBTkNFLmtleU9mKG8ubGl0ZXJhbEFycihhcmd1bWVudHNGb3JLZXkpKTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRMaXRlcmFsRmFjdG9yeShrZXksIGxpdGVyYWwuZW50cmllcywgZW50cmllcyA9PiBvLmxpdGVyYWxBcnIoZW50cmllcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBleHByZXNzaW9uRm9yS2V5ID0gby5saXRlcmFsTWFwKFxuICAgICAgICAgIGxpdGVyYWwuZW50cmllcy5tYXAoZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGUua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZS52YWx1ZS5pc0NvbnN0YW50KCkgPyBlLnZhbHVlIDogVU5LTk9XTl9WQUxVRV9LRVksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogZS5xdW90ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICBjb25zdCBrZXkgPSBHZW5lcmljS2V5Rm4uSU5TVEFOQ0Uua2V5T2YoZXhwcmVzc2lvbkZvcktleSk7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgICAgICAga2V5LCBsaXRlcmFsLmVudHJpZXMubWFwKGUgPT4gZS52YWx1ZSksXG4gICAgICAgICAgZW50cmllcyA9PiBvLmxpdGVyYWxNYXAoZW50cmllcy5tYXAoKHZhbHVlLCBpbmRleCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogbGl0ZXJhbC5lbnRyaWVzW2luZGV4XS5rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogbGl0ZXJhbC5lbnRyaWVzW2luZGV4XS5xdW90ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSkpKTtcbiAgICB9XG4gIH1cblxuICBnZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZShmbjogby5GdW5jdGlvbkV4cHJ8by5BcnJvd0Z1bmN0aW9uRXhwciwgcHJlZml4OiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGlzQXJyb3cgPSBmbiBpbnN0YW5jZW9mIG8uQXJyb3dGdW5jdGlvbkV4cHI7XG5cbiAgICBmb3IgKGNvbnN0IGN1cnJlbnQgb2YgdGhpcy5zdGF0ZW1lbnRzKSB7XG4gICAgICAvLyBBcnJvdyBmdW5jdGlvbnMgYXJlIHNhdmVkIGFzIHZhcmlhYmxlcyBzbyB3ZSBjaGVjayBpZiB0aGVcbiAgICAgIC8vIHZhbHVlIG9mIHRoZSB2YXJpYWJsZSBpcyB0aGUgc2FtZSBhcyB0aGUgYXJyb3cgZnVuY3Rpb24uXG4gICAgICBpZiAoaXNBcnJvdyAmJiBjdXJyZW50IGluc3RhbmNlb2Ygby5EZWNsYXJlVmFyU3RtdCAmJiBjdXJyZW50LnZhbHVlPy5pc0VxdWl2YWxlbnQoZm4pKSB7XG4gICAgICAgIHJldHVybiBvLnZhcmlhYmxlKGN1cnJlbnQubmFtZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEZ1bmN0aW9uIGRlY2xhcmF0aW9ucyBhcmUgc2F2ZWQgYXMgZnVuY3Rpb24gc3RhdGVtZW50c1xuICAgICAgLy8gc28gd2UgY29tcGFyZSB0aGVtIGRpcmVjdGx5IHRvIHRoZSBwYXNzZWQtaW4gZnVuY3Rpb24uXG4gICAgICBpZiAoIWlzQXJyb3cgJiYgY3VycmVudCBpbnN0YW5jZW9mIG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCAmJiBmbi5pc0VxdWl2YWxlbnQoY3VycmVudCkpIHtcbiAgICAgICAgcmV0dXJuIG8udmFyaWFibGUoY3VycmVudC5uYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPdGhlcndpc2UgZGVjbGFyZSB0aGUgZnVuY3Rpb24uXG4gICAgY29uc3QgbmFtZSA9IHRoaXMudW5pcXVlTmFtZShwcmVmaXgpO1xuICAgIHRoaXMuc3RhdGVtZW50cy5wdXNoKGZuLnRvRGVjbFN0bXQobmFtZSwgby5TdG10TW9kaWZpZXIuRmluYWwpKTtcbiAgICByZXR1cm4gby52YXJpYWJsZShuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldExpdGVyYWxGYWN0b3J5KFxuICAgICAga2V5OiBzdHJpbmcsIHZhbHVlczogby5FeHByZXNzaW9uW10sIHJlc3VsdE1hcDogKHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdKSA9PiBvLkV4cHJlc3Npb24pOlxuICAgICAge2xpdGVyYWxGYWN0b3J5OiBvLkV4cHJlc3Npb24sIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzOiBvLkV4cHJlc3Npb25bXX0ge1xuICAgIGxldCBsaXRlcmFsRmFjdG9yeSA9IHRoaXMubGl0ZXJhbEZhY3Rvcmllcy5nZXQoa2V5KTtcbiAgICBjb25zdCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyA9IHZhbHVlcy5maWx0ZXIoKGUgPT4gIWUuaXNDb25zdGFudCgpKSk7XG4gICAgaWYgKCFsaXRlcmFsRmFjdG9yeSkge1xuICAgICAgY29uc3QgcmVzdWx0RXhwcmVzc2lvbnMgPSB2YWx1ZXMubWFwKFxuICAgICAgICAgIChlLCBpbmRleCkgPT4gZS5pc0NvbnN0YW50KCkgPyB0aGlzLmdldENvbnN0TGl0ZXJhbChlLCB0cnVlKSA6IG8udmFyaWFibGUoYGEke2luZGV4fWApKTtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnMgPVxuICAgICAgICAgIHJlc3VsdEV4cHJlc3Npb25zLmZpbHRlcihpc1ZhcmlhYmxlKS5tYXAoZSA9PiBuZXcgby5GblBhcmFtKGUubmFtZSEsIG8uRFlOQU1JQ19UWVBFKSk7XG4gICAgICBjb25zdCBwdXJlRnVuY3Rpb25EZWNsYXJhdGlvbiA9XG4gICAgICAgICAgby5mbihwYXJhbWV0ZXJzLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHJlc3VsdE1hcChyZXN1bHRFeHByZXNzaW9ucykpXSwgby5JTkZFUlJFRF9UWVBFKTtcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmZyZXNoTmFtZSgpO1xuICAgICAgdGhpcy5zdGF0ZW1lbnRzLnB1c2goby52YXJpYWJsZShuYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocHVyZUZ1bmN0aW9uRGVjbGFyYXRpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpO1xuICAgICAgbGl0ZXJhbEZhY3RvcnkgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgICAgdGhpcy5saXRlcmFsRmFjdG9yaWVzLnNldChrZXksIGxpdGVyYWxGYWN0b3J5KTtcbiAgICB9XG4gICAgcmV0dXJuIHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2R1Y2UgYSB1bmlxdWUgbmFtZS5cbiAgICpcbiAgICogVGhlIG5hbWUgbWlnaHQgYmUgdW5pcXVlIGFtb25nIGRpZmZlcmVudCBwcmVmaXhlcyBpZiBhbnkgb2YgdGhlIHByZWZpeGVzIGVuZCBpblxuICAgKiBhIGRpZ2l0IHNvIHRoZSBwcmVmaXggc2hvdWxkIGJlIGEgY29uc3RhbnQgc3RyaW5nIChub3QgYmFzZWQgb24gdXNlciBpbnB1dCkgYW5kXG4gICAqIG11c3Qgbm90IGVuZCBpbiBhIGRpZ2l0LlxuICAgKi9cbiAgdW5pcXVlTmFtZShwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3ByZWZpeH0ke3RoaXMubmV4dE5hbWVJbmRleCsrfWA7XG4gIH1cblxuICBwcml2YXRlIGZyZXNoTmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnVuaXF1ZU5hbWUoQ09OU1RBTlRfUFJFRklYKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4cHJlc3Npb25LZXlGbiB7XG4gIGtleU9mKGV4cHI6IG8uRXhwcmVzc2lvbik6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTaGFyZWRDb25zdGFudERlZmluaXRpb24gZXh0ZW5kcyBFeHByZXNzaW9uS2V5Rm4ge1xuICB0b1NoYXJlZENvbnN0YW50RGVjbGFyYXRpb24oZGVjbE5hbWU6IHN0cmluZywga2V5RXhwcjogby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnQ7XG59XG5cbmV4cG9ydCBjbGFzcyBHZW5lcmljS2V5Rm4gaW1wbGVtZW50cyBFeHByZXNzaW9uS2V5Rm4ge1xuICBzdGF0aWMgcmVhZG9ubHkgSU5TVEFOQ0UgPSBuZXcgR2VuZXJpY0tleUZuKCk7XG5cbiAga2V5T2YoZXhwcjogby5FeHByZXNzaW9uKTogc3RyaW5nIHtcbiAgICBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIgJiYgdHlwZW9mIGV4cHIudmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gYFwiJHtleHByLnZhbHVlfVwiYDtcbiAgICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByKSB7XG4gICAgICByZXR1cm4gU3RyaW5nKGV4cHIudmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEFycmF5RXhwcikge1xuICAgICAgY29uc3QgZW50cmllczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZXhwci5lbnRyaWVzKSB7XG4gICAgICAgIGVudHJpZXMucHVzaCh0aGlzLmtleU9mKGVudHJ5KSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYFske2VudHJpZXMuam9pbignLCcpfV1gO1xuICAgIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbE1hcEV4cHIpIHtcbiAgICAgIGNvbnN0IGVudHJpZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGV4cHIuZW50cmllcykge1xuICAgICAgICBsZXQga2V5ID0gZW50cnkua2V5O1xuICAgICAgICBpZiAoZW50cnkucXVvdGVkKSB7XG4gICAgICAgICAga2V5ID0gYFwiJHtrZXl9XCJgO1xuICAgICAgICB9XG4gICAgICAgIGVudHJpZXMucHVzaChrZXkgKyAnOicgKyB0aGlzLmtleU9mKGVudHJ5LnZhbHVlKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYHske2VudHJpZXMuam9pbignLCcpfX1gO1xuICAgIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uRXh0ZXJuYWxFeHByKSB7XG4gICAgICByZXR1cm4gYGltcG9ydChcIiR7ZXhwci52YWx1ZS5tb2R1bGVOYW1lfVwiLCAke2V4cHIudmFsdWUubmFtZX0pYDtcbiAgICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByKSB7XG4gICAgICByZXR1cm4gYHJlYWQoJHtleHByLm5hbWV9KWA7XG4gICAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5UeXBlb2ZFeHByKSB7XG4gICAgICByZXR1cm4gYHR5cGVvZigke3RoaXMua2V5T2YoZXhwci5leHByKX0pYDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lcyBub3QgaGFuZGxlIGV4cHJlc3Npb25zIG9mIHR5cGUgJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzVmFyaWFibGUoZTogby5FeHByZXNzaW9uKTogZSBpcyBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIGUgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByO1xufVxuXG5mdW5jdGlvbiBpc0xvbmdTdHJpbmdMaXRlcmFsKGV4cHI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIgJiYgdHlwZW9mIGV4cHIudmFsdWUgPT09ICdzdHJpbmcnICYmXG4gICAgICBleHByLnZhbHVlLmxlbmd0aCA+PSBQT09MX0lOQ0xVU0lPTl9MRU5HVEhfVEhSRVNIT0xEX0ZPUl9TVFJJTkdTO1xufVxuIl19