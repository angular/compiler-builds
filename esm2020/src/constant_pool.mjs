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
        this.nextNameIndex = 0;
    }
    getConstLiteral(literal, forceShared) {
        if ((literal instanceof o.LiteralExpr && !isLongStringLiteral(literal)) ||
            literal instanceof FixupExpression) {
            // Do no put simple literals into the constant pool or try to produce a constant for a
            // reference to a constant.
            return literal;
        }
        const key = this.keyOf(literal);
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
                // indirection. This saves a few bytes and avoids an unncessary call.
                definition = o.variable(name).set(literal);
                usage = o.variable(name);
            }
            this.statements.push(definition.toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            fixup.fixup(usage);
        }
        return fixup;
    }
    getLiteralFactory(literal) {
        // Create a pure function that builds an array of a mix of constant and variable expressions
        if (literal instanceof o.LiteralArrayExpr) {
            const argumentsForKey = literal.entries.map(e => e.isConstant() ? e : UNKNOWN_VALUE_KEY);
            const key = this.keyOf(o.literalArr(argumentsForKey));
            return this._getLiteralFactory(key, literal.entries, entries => o.literalArr(entries));
        }
        else {
            const expressionForKey = o.literalMap(literal.entries.map(e => ({
                key: e.key,
                value: e.value.isConstant() ? e.value : UNKNOWN_VALUE_KEY,
                quoted: e.quoted
            })));
            const key = this.keyOf(expressionForKey);
            return this._getLiteralFactory(key, literal.entries.map(e => e.value), entries => o.literalMap(entries.map((value, index) => ({
                key: literal.entries[index].key,
                value,
                quoted: literal.entries[index].quoted
            }))));
        }
    }
    _getLiteralFactory(key, values, resultMap) {
        let literalFactory = this.literalFactories.get(key);
        const literalFactoryArguments = values.filter((e => !e.isConstant()));
        if (!literalFactory) {
            const resultExpressions = values.map((e, index) => e.isConstant() ? this.getConstLiteral(e, true) : o.variable(`a${index}`));
            const parameters = resultExpressions.filter(isVariable).map(e => new o.FnParam(e.name, o.DYNAMIC_TYPE));
            const pureFunctionDeclaration = o.fn(parameters, [new o.ReturnStatement(resultMap(resultExpressions))], o.INFERRED_TYPE);
            const name = this.freshName();
            this.statements.push(o.variable(name).set(pureFunctionDeclaration).toDeclStmt(o.INFERRED_TYPE, [
                o.StmtModifier.Final
            ]));
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
    keyOf(expression) {
        return expression.visitExpression(new KeyVisitor(), KEY_CONTEXT);
    }
}
/**
 * Visitor used to determine if 2 expressions are equivalent and can be shared in the
 * `ConstantPool`.
 *
 * When the id (string) generated by the visitor is equal, expressions are considered equivalent.
 */
class KeyVisitor {
    constructor() {
        this.visitWrappedNodeExpr = invalid;
        this.visitWriteVarExpr = invalid;
        this.visitWriteKeyExpr = invalid;
        this.visitWritePropExpr = invalid;
        this.visitInvokeFunctionExpr = invalid;
        this.visitTaggedTemplateExpr = invalid;
        this.visitInstantiateExpr = invalid;
        this.visitConditionalExpr = invalid;
        this.visitNotExpr = invalid;
        this.visitAssertNotNullExpr = invalid;
        this.visitCastExpr = invalid;
        this.visitFunctionExpr = invalid;
        this.visitUnaryOperatorExpr = invalid;
        this.visitBinaryOperatorExpr = invalid;
        this.visitReadPropExpr = invalid;
        this.visitReadKeyExpr = invalid;
        this.visitCommaExpr = invalid;
        this.visitLocalizedString = invalid;
    }
    visitLiteralExpr(ast) {
        return `${typeof ast.value === 'string' ? '"' + ast.value + '"' : ast.value}`;
    }
    visitLiteralArrayExpr(ast, context) {
        return `[${ast.entries.map(entry => entry.visitExpression(this, context)).join(',')}]`;
    }
    visitLiteralMapExpr(ast, context) {
        const mapKey = (entry) => {
            const quote = entry.quoted ? '"' : '';
            return `${quote}${entry.key}${quote}`;
        };
        const mapEntry = (entry) => `${mapKey(entry)}:${entry.value.visitExpression(this, context)}`;
        return `{${ast.entries.map(mapEntry).join(',')}`;
    }
    visitExternalExpr(ast) {
        return ast.value.moduleName ? `EX:${ast.value.moduleName}:${ast.value.name}` :
            `EX:${ast.value.runtime.name}`;
    }
    visitReadVarExpr(node) {
        return `VAR:${node.name}`;
    }
    visitTypeofExpr(node, context) {
        return `TYPEOF:${node.expr.visitExpression(this, context)}`;
    }
}
function invalid(arg) {
    throw new Error(`Invalid state: Visitor ${this.constructor.name} doesn't handle ${arg.constructor.name}`);
}
function isVariable(e) {
    return e instanceof o.ReadVarExpr;
}
function isLongStringLiteral(expr) {
    return expr instanceof o.LiteralExpr && typeof expr.value === 'string' &&
        expr.value.length >= POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRfcG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb25zdGFudF9wb29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFekMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBRTdCOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFbEQ7Ozs7O0dBS0c7QUFDSCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFFdkI7Ozs7R0FJRztBQUNILE1BQU0sMkNBQTJDLEdBQUcsRUFBRSxDQUFDO0FBRXZEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGVBQWdCLFNBQVEsQ0FBQyxDQUFDLFVBQVU7SUFNeEMsWUFBbUIsUUFBc0I7UUFDdkMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQURKLGFBQVEsR0FBUixRQUFRLENBQWM7UUFFdkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDM0IsQ0FBQztJQUVRLGVBQWUsQ0FBQyxPQUE0QixFQUFFLE9BQVk7UUFDakUsSUFBSSxPQUFPLEtBQUssV0FBVyxFQUFFO1lBQzNCLGdFQUFnRTtZQUNoRSxnQ0FBZ0M7WUFDaEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDeEQ7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3hEO0lBQ0gsQ0FBQztJQUVRLFlBQVksQ0FBQyxDQUFlO1FBQ25DLE9BQU8sQ0FBQyxZQUFZLGVBQWUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlB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LElBQWtCLEVBQUUsT0FBWTtRQUM5QyxPQUFPLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUM7SUFDOUQsQ0FBQztDQW9CRjtBQUVELFNBQVMsT0FBTyxDQUErQixHQUE2QjtJQUMxRSxNQUFNLElBQUksS0FBSyxDQUNYLDBCQUEwQixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksbUJBQW1CLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNoRyxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsQ0FBZTtJQUNqQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ3BDLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLElBQWtCO0lBQzdDLE9BQU8sSUFBSSxZQUFZLENBQUMsQ0FBQyxXQUFXLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVE7UUFDbEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksMkNBQTJDLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5jb25zdCBDT05TVEFOVF9QUkVGSVggPSAnX2MnO1xuXG4vKipcbiAqIGBDb25zdGFudFBvb2xgIHRyaWVzIHRvIHJldXNlIGxpdGVyYWwgZmFjdG9yaWVzIHdoZW4gdHdvIG9yIG1vcmUgbGl0ZXJhbHMgYXJlIGlkZW50aWNhbC5cbiAqIFdlIGRldGVybWluZSB3aGV0aGVyIGxpdGVyYWxzIGFyZSBpZGVudGljYWwgYnkgY3JlYXRpbmcgYSBrZXkgb3V0IG9mIHRoZWlyIEFTVCB1c2luZyB0aGVcbiAqIGBLZXlWaXNpdG9yYC4gVGhpcyBjb25zdGFudCBpcyB1c2VkIHRvIHJlcGxhY2UgZHluYW1pYyBleHByZXNzaW9ucyB3aGljaCBjYW4ndCBiZSBzYWZlbHlcbiAqIGNvbnZlcnRlZCBpbnRvIGEga2V5LiBFLmcuIGdpdmVuIGFuIGV4cHJlc3Npb24gYHtmb286IGJhcigpfWAsIHNpbmNlIHdlIGRvbid0IGtub3cgd2hhdFxuICogdGhlIHJlc3VsdCBvZiBgYmFyYCB3aWxsIGJlLCB3ZSBjcmVhdGUgYSBrZXkgdGhhdCBsb29rcyBsaWtlIGB7Zm9vOiA8dW5rbm93bj59YC4gTm90ZVxuICogdGhhdCB3ZSB1c2UgYSB2YXJpYWJsZSwgcmF0aGVyIHRoYW4gc29tZXRoaW5nIGxpa2UgYG51bGxgIGluIG9yZGVyIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gKi9cbmNvbnN0IFVOS05PV05fVkFMVUVfS0VZID0gby52YXJpYWJsZSgnPHVua25vd24+Jyk7XG5cbi8qKlxuICogQ29udGV4dCB0byB1c2Ugd2hlbiBwcm9kdWNpbmcgYSBrZXkuXG4gKlxuICogVGhpcyBlbnN1cmVzIHdlIHNlZSB0aGUgY29uc3RhbnQgbm90IHRoZSByZWZlcmVuY2UgdmFyaWFibGUgd2hlbiBwcm9kdWNpbmdcbiAqIGEga2V5LlxuICovXG5jb25zdCBLRVlfQ09OVEVYVCA9IHt9O1xuXG4vKipcbiAqIEdlbmVyYWxseSBhbGwgcHJpbWl0aXZlIHZhbHVlcyBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgYENvbnN0YW50UG9vbGAsIGJ1dCB0aGVyZSBpcyBhbiBleGNsdXNpb25cbiAqIGZvciBzdHJpbmdzIHRoYXQgcmVhY2ggYSBjZXJ0YWluIGxlbmd0aCB0aHJlc2hvbGQuIFRoaXMgY29uc3RhbnQgZGVmaW5lcyB0aGUgbGVuZ3RoIHRocmVzaG9sZCBmb3JcbiAqIHN0cmluZ3MuXG4gKi9cbmNvbnN0IFBPT0xfSU5DTFVTSU9OX0xFTkdUSF9USFJFU0hPTERfRk9SX1NUUklOR1MgPSA1MDtcblxuLyoqXG4gKiBBIG5vZGUgdGhhdCBpcyBhIHBsYWNlLWhvbGRlciB0aGF0IGFsbG93cyB0aGUgbm9kZSB0byBiZSByZXBsYWNlZCB3aGVuIHRoZSBhY3R1YWxcbiAqIG5vZGUgaXMga25vd24uXG4gKlxuICogVGhpcyBhbGxvd3MgdGhlIGNvbnN0YW50IHBvb2wgdG8gY2hhbmdlIGFuIGV4cHJlc3Npb24gZnJvbSBhIGRpcmVjdCByZWZlcmVuY2UgdG9cbiAqIGEgY29uc3RhbnQgdG8gYSBzaGFyZWQgY29uc3RhbnQuIEl0IHJldHVybnMgYSBmaXgtdXAgbm9kZSB0aGF0IGlzIGxhdGVyIGFsbG93ZWQgdG9cbiAqIGNoYW5nZSB0aGUgcmVmZXJlbmNlZCBleHByZXNzaW9uLlxuICovXG5jbGFzcyBGaXh1cEV4cHJlc3Npb24gZXh0ZW5kcyBvLkV4cHJlc3Npb24ge1xuICBwcml2YXRlIG9yaWdpbmFsOiBvLkV4cHJlc3Npb247XG5cbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHNoYXJlZCE6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlc29sdmVkOiBvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcihyZXNvbHZlZC50eXBlKTtcbiAgICB0aGlzLm9yaWdpbmFsID0gcmVzb2x2ZWQ7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoY29udGV4dCA9PT0gS0VZX0NPTlRFWFQpIHtcbiAgICAgIC8vIFdoZW4gcHJvZHVjaW5nIGEga2V5IHdlIHdhbnQgdG8gdHJhdmVyc2UgdGhlIGNvbnN0YW50IG5vdCB0aGVcbiAgICAgIC8vIHZhcmlhYmxlIHVzZWQgdG8gcmVmZXIgdG8gaXQuXG4gICAgICByZXR1cm4gdGhpcy5vcmlnaW5hbC52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVkLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBGaXh1cEV4cHJlc3Npb24gJiYgdGhpcy5yZXNvbHZlZC5pc0VxdWl2YWxlbnQoZS5yZXNvbHZlZCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZml4dXAoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gICAgdGhpcy5yZXNvbHZlZCA9IGV4cHJlc3Npb247XG4gICAgdGhpcy5zaGFyZWQgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQSBjb25zdGFudCBwb29sIGFsbG93cyBhIGNvZGUgZW1pdHRlciB0byBzaGFyZSBjb25zdGFudCBpbiBhbiBvdXRwdXQgY29udGV4dC5cbiAqXG4gKiBUaGUgY29uc3RhbnQgcG9vbCBhbHNvIHN1cHBvcnRzIHNoYXJpbmcgYWNjZXNzIHRvIGl2eSBkZWZpbml0aW9ucyByZWZlcmVuY2VzLlxuICovXG5leHBvcnQgY2xhc3MgQ29uc3RhbnRQb29sIHtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIGxpdGVyYWxzID0gbmV3IE1hcDxzdHJpbmcsIEZpeHVwRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBsaXRlcmFsRmFjdG9yaWVzID0gbmV3IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4oKTtcblxuICBwcml2YXRlIG5leHROYW1lSW5kZXggPSAwO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkOiBib29sZWFuID0gZmFsc2UpIHt9XG5cbiAgZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWw6IG8uRXhwcmVzc2lvbiwgZm9yY2VTaGFyZWQ/OiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAoKGxpdGVyYWwgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByICYmICFpc0xvbmdTdHJpbmdMaXRlcmFsKGxpdGVyYWwpKSB8fFxuICAgICAgICBsaXRlcmFsIGluc3RhbmNlb2YgRml4dXBFeHByZXNzaW9uKSB7XG4gICAgICAvLyBEbyBubyBwdXQgc2ltcGxlIGxpdGVyYWxzIGludG8gdGhlIGNvbnN0YW50IHBvb2wgb3IgdHJ5IHRvIHByb2R1Y2UgYSBjb25zdGFudCBmb3IgYVxuICAgICAgLy8gcmVmZXJlbmNlIHRvIGEgY29uc3RhbnQuXG4gICAgICByZXR1cm4gbGl0ZXJhbDtcbiAgICB9XG4gICAgY29uc3Qga2V5ID0gdGhpcy5rZXlPZihsaXRlcmFsKTtcbiAgICBsZXQgZml4dXAgPSB0aGlzLmxpdGVyYWxzLmdldChrZXkpO1xuICAgIGxldCBuZXdWYWx1ZSA9IGZhbHNlO1xuICAgIGlmICghZml4dXApIHtcbiAgICAgIGZpeHVwID0gbmV3IEZpeHVwRXhwcmVzc2lvbihsaXRlcmFsKTtcbiAgICAgIHRoaXMubGl0ZXJhbHMuc2V0KGtleSwgZml4dXApO1xuICAgICAgbmV3VmFsdWUgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmICgoIW5ld1ZhbHVlICYmICFmaXh1cC5zaGFyZWQpIHx8IChuZXdWYWx1ZSAmJiBmb3JjZVNoYXJlZCkpIHtcbiAgICAgIC8vIFJlcGxhY2UgdGhlIGV4cHJlc3Npb24gd2l0aCBhIHZhcmlhYmxlXG4gICAgICBjb25zdCBuYW1lID0gdGhpcy5mcmVzaE5hbWUoKTtcbiAgICAgIGxldCBkZWZpbml0aW9uOiBvLldyaXRlVmFyRXhwcjtcbiAgICAgIGxldCB1c2FnZTogby5FeHByZXNzaW9uO1xuICAgICAgaWYgKHRoaXMuaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkICYmIGlzTG9uZ1N0cmluZ0xpdGVyYWwobGl0ZXJhbCkpIHtcbiAgICAgICAgLy8gRm9yIHN0cmluZyBsaXRlcmFscywgQ2xvc3VyZSB3aWxsICoqYWx3YXlzKiogaW5saW5lIHRoZSBzdHJpbmcgYXRcbiAgICAgICAgLy8gKiphbGwqKiB1c2FnZXMsIGR1cGxpY2F0aW5nIGl0IGVhY2ggdGltZS4gRm9yIGxhcmdlIHN0cmluZ3MsIHRoaXNcbiAgICAgICAgLy8gdW5uZWNlc3NhcmlseSBibG9hdHMgYnVuZGxlIHNpemUuIFRvIHdvcmsgYXJvdW5kIHRoaXMgcmVzdHJpY3Rpb24sIHdlXG4gICAgICAgIC8vIHdyYXAgdGhlIHN0cmluZyBpbiBhIGZ1bmN0aW9uLCBhbmQgY2FsbCB0aGF0IGZ1bmN0aW9uIGZvciBlYWNoIHVzYWdlLlxuICAgICAgICAvLyBUaGlzIHRyaWNrcyBDbG9zdXJlIGludG8gdXNpbmcgaW5saW5lIGxvZ2ljIGZvciBmdW5jdGlvbnMgaW5zdGVhZCBvZlxuICAgICAgICAvLyBzdHJpbmcgbGl0ZXJhbHMuIEZ1bmN0aW9uIGNhbGxzIGFyZSBvbmx5IGlubGluZWQgaWYgdGhlIGJvZHkgaXMgc21hbGxcbiAgICAgICAgLy8gZW5vdWdoIHRvIGJlIHdvcnRoIGl0LiBCeSBkb2luZyB0aGlzLCB2ZXJ5IGxhcmdlIHN0cmluZ3Mgd2lsbCBiZVxuICAgICAgICAvLyBzaGFyZWQgYWNyb3NzIG11bHRpcGxlIHVzYWdlcywgcmF0aGVyIHRoYW4gZHVwbGljYXRpbmcgdGhlIHN0cmluZyBhdFxuICAgICAgICAvLyBlYWNoIHVzYWdlIHNpdGUuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIGNvbnN0IG15U3RyID0gZnVuY3Rpb24oKSB7IHJldHVybiBcInZlcnkgdmVyeSB2ZXJ5IGxvbmcgc3RyaW5nXCI7IH07XG4gICAgICAgIC8vIGNvbnN0IHVzYWdlMSA9IG15U3RyKCk7XG4gICAgICAgIC8vIGNvbnN0IHVzYWdlMiA9IG15U3RyKCk7XG4gICAgICAgIGRlZmluaXRpb24gPSBvLnZhcmlhYmxlKG5hbWUpLnNldChuZXcgby5GdW5jdGlvbkV4cHIoXG4gICAgICAgICAgICBbXSwgIC8vIFBhcmFtcy5cbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgLy8gU3RhdGVtZW50cy5cbiAgICAgICAgICAgICAgbmV3IG8uUmV0dXJuU3RhdGVtZW50KGxpdGVyYWwpLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICkpO1xuICAgICAgICB1c2FnZSA9IG8udmFyaWFibGUobmFtZSkuY2FsbEZuKFtdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEp1c3QgZGVjbGFyZSBhbmQgdXNlIHRoZSB2YXJpYWJsZSBkaXJlY3RseSwgd2l0aG91dCBhIGZ1bmN0aW9uIGNhbGxcbiAgICAgICAgLy8gaW5kaXJlY3Rpb24uIFRoaXMgc2F2ZXMgYSBmZXcgYnl0ZXMgYW5kIGF2b2lkcyBhbiB1bm5jZXNzYXJ5IGNhbGwuXG4gICAgICAgIGRlZmluaXRpb24gPSBvLnZhcmlhYmxlKG5hbWUpLnNldChsaXRlcmFsKTtcbiAgICAgICAgdXNhZ2UgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnN0YXRlbWVudHMucHVzaChkZWZpbml0aW9uLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gICAgICBmaXh1cC5maXh1cCh1c2FnZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpeHVwO1xuICB9XG5cbiAgZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByfG8uTGl0ZXJhbE1hcEV4cHIpOlxuICAgICAge2xpdGVyYWxGYWN0b3J5OiBvLkV4cHJlc3Npb24sIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzOiBvLkV4cHJlc3Npb25bXX0ge1xuICAgIC8vIENyZWF0ZSBhIHB1cmUgZnVuY3Rpb24gdGhhdCBidWlsZHMgYW4gYXJyYXkgb2YgYSBtaXggb2YgY29uc3RhbnQgYW5kIHZhcmlhYmxlIGV4cHJlc3Npb25zXG4gICAgaWYgKGxpdGVyYWwgaW5zdGFuY2VvZiBvLkxpdGVyYWxBcnJheUV4cHIpIHtcbiAgICAgIGNvbnN0IGFyZ3VtZW50c0ZvcktleSA9IGxpdGVyYWwuZW50cmllcy5tYXAoZSA9PiBlLmlzQ29uc3RhbnQoKSA/IGUgOiBVTktOT1dOX1ZBTFVFX0tFWSk7XG4gICAgICBjb25zdCBrZXkgPSB0aGlzLmtleU9mKG8ubGl0ZXJhbEFycihhcmd1bWVudHNGb3JLZXkpKTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRMaXRlcmFsRmFjdG9yeShrZXksIGxpdGVyYWwuZW50cmllcywgZW50cmllcyA9PiBvLmxpdGVyYWxBcnIoZW50cmllcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBleHByZXNzaW9uRm9yS2V5ID0gby5saXRlcmFsTWFwKFxuICAgICAgICAgIGxpdGVyYWwuZW50cmllcy5tYXAoZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGUua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZS52YWx1ZS5pc0NvbnN0YW50KCkgPyBlLnZhbHVlIDogVU5LTk9XTl9WQUxVRV9LRVksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogZS5xdW90ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICBjb25zdCBrZXkgPSB0aGlzLmtleU9mKGV4cHJlc3Npb25Gb3JLZXkpO1xuICAgICAgcmV0dXJuIHRoaXMuX2dldExpdGVyYWxGYWN0b3J5KFxuICAgICAgICAgIGtleSwgbGl0ZXJhbC5lbnRyaWVzLm1hcChlID0+IGUudmFsdWUpLFxuICAgICAgICAgIGVudHJpZXMgPT4gby5saXRlcmFsTWFwKGVudHJpZXMubWFwKCh2YWx1ZSwgaW5kZXgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGxpdGVyYWwuZW50cmllc1tpbmRleF0ua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdW90ZWQ6IGxpdGVyYWwuZW50cmllc1tpbmRleF0ucXVvdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgICBrZXk6IHN0cmluZywgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSwgcmVzdWx0TWFwOiAocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pID0+IG8uRXhwcmVzc2lvbik6XG4gICAgICB7bGl0ZXJhbEZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHM6IG8uRXhwcmVzc2lvbltdfSB7XG4gICAgbGV0IGxpdGVyYWxGYWN0b3J5ID0gdGhpcy5saXRlcmFsRmFjdG9yaWVzLmdldChrZXkpO1xuICAgIGNvbnN0IGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzID0gdmFsdWVzLmZpbHRlcigoZSA9PiAhZS5pc0NvbnN0YW50KCkpKTtcbiAgICBpZiAoIWxpdGVyYWxGYWN0b3J5KSB7XG4gICAgICBjb25zdCByZXN1bHRFeHByZXNzaW9ucyA9IHZhbHVlcy5tYXAoXG4gICAgICAgICAgKGUsIGluZGV4KSA9PiBlLmlzQ29uc3RhbnQoKSA/IHRoaXMuZ2V0Q29uc3RMaXRlcmFsKGUsIHRydWUpIDogby52YXJpYWJsZShgYSR7aW5kZXh9YCkpO1xuICAgICAgY29uc3QgcGFyYW1ldGVycyA9XG4gICAgICAgICAgcmVzdWx0RXhwcmVzc2lvbnMuZmlsdGVyKGlzVmFyaWFibGUpLm1hcChlID0+IG5ldyBvLkZuUGFyYW0oZS5uYW1lISwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIGNvbnN0IHB1cmVGdW5jdGlvbkRlY2xhcmF0aW9uID1cbiAgICAgICAgICBvLmZuKHBhcmFtZXRlcnMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmVzdWx0TWFwKHJlc3VsdEV4cHJlc3Npb25zKSldLCBvLklORkVSUkVEX1RZUEUpO1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuZnJlc2hOYW1lKCk7XG4gICAgICB0aGlzLnN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICBvLnZhcmlhYmxlKG5hbWUpLnNldChwdXJlRnVuY3Rpb25EZWNsYXJhdGlvbikudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkZpbmFsXG4gICAgICAgICAgXSkpO1xuICAgICAgbGl0ZXJhbEZhY3RvcnkgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgICAgdGhpcy5saXRlcmFsRmFjdG9yaWVzLnNldChrZXksIGxpdGVyYWxGYWN0b3J5KTtcbiAgICB9XG4gICAgcmV0dXJuIHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2R1Y2UgYSB1bmlxdWUgbmFtZS5cbiAgICpcbiAgICogVGhlIG5hbWUgbWlnaHQgYmUgdW5pcXVlIGFtb25nIGRpZmZlcmVudCBwcmVmaXhlcyBpZiBhbnkgb2YgdGhlIHByZWZpeGVzIGVuZCBpblxuICAgKiBhIGRpZ2l0IHNvIHRoZSBwcmVmaXggc2hvdWxkIGJlIGEgY29uc3RhbnQgc3RyaW5nIChub3QgYmFzZWQgb24gdXNlciBpbnB1dCkgYW5kXG4gICAqIG11c3Qgbm90IGVuZCBpbiBhIGRpZ2l0LlxuICAgKi9cbiAgdW5pcXVlTmFtZShwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3ByZWZpeH0ke3RoaXMubmV4dE5hbWVJbmRleCsrfWA7XG4gIH1cblxuICBwcml2YXRlIGZyZXNoTmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnVuaXF1ZU5hbWUoQ09OU1RBTlRfUFJFRklYKTtcbiAgfVxuXG4gIHByaXZhdGUga2V5T2YoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb24udmlzaXRFeHByZXNzaW9uKG5ldyBLZXlWaXNpdG9yKCksIEtFWV9DT05URVhUKTtcbiAgfVxufVxuXG4vKipcbiAqIFZpc2l0b3IgdXNlZCB0byBkZXRlcm1pbmUgaWYgMiBleHByZXNzaW9ucyBhcmUgZXF1aXZhbGVudCBhbmQgY2FuIGJlIHNoYXJlZCBpbiB0aGVcbiAqIGBDb25zdGFudFBvb2xgLlxuICpcbiAqIFdoZW4gdGhlIGlkIChzdHJpbmcpIGdlbmVyYXRlZCBieSB0aGUgdmlzaXRvciBpcyBlcXVhbCwgZXhwcmVzc2lvbnMgYXJlIGNvbnNpZGVyZWQgZXF1aXZhbGVudC5cbiAqL1xuY2xhc3MgS2V5VmlzaXRvciBpbXBsZW1lbnRzIG8uRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdExpdGVyYWxFeHByKGFzdDogby5MaXRlcmFsRXhwcik6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3R5cGVvZiBhc3QudmFsdWUgPT09ICdzdHJpbmcnID8gJ1wiJyArIGFzdC52YWx1ZSArICdcIicgOiBhc3QudmFsdWV9YDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IG8uTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogb2JqZWN0KTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFske2FzdC5lbnRyaWVzLm1hcChlbnRyeSA9PiBlbnRyeS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpLmpvaW4oJywnKX1dYDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBvLkxpdGVyYWxNYXBFeHByLCBjb250ZXh0OiBvYmplY3QpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1hcEtleSA9IChlbnRyeTogby5MaXRlcmFsTWFwRW50cnkpID0+IHtcbiAgICAgIGNvbnN0IHF1b3RlID0gZW50cnkucXVvdGVkID8gJ1wiJyA6ICcnO1xuICAgICAgcmV0dXJuIGAke3F1b3RlfSR7ZW50cnkua2V5fSR7cXVvdGV9YDtcbiAgICB9O1xuICAgIGNvbnN0IG1hcEVudHJ5ID0gKGVudHJ5OiBvLkxpdGVyYWxNYXBFbnRyeSkgPT5cbiAgICAgICAgYCR7bWFwS2V5KGVudHJ5KX06JHtlbnRyeS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCl9YDtcbiAgICByZXR1cm4gYHske2FzdC5lbnRyaWVzLm1hcChtYXBFbnRyeSkuam9pbignLCcpfWA7XG4gIH1cblxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYXN0LnZhbHVlLm1vZHVsZU5hbWUgPyBgRVg6JHthc3QudmFsdWUubW9kdWxlTmFtZX06JHthc3QudmFsdWUubmFtZX1gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgRVg6JHthc3QudmFsdWUucnVudGltZS5uYW1lfWA7XG4gIH1cblxuICB2aXNpdFJlYWRWYXJFeHByKG5vZGU6IG8uUmVhZFZhckV4cHIpIHtcbiAgICByZXR1cm4gYFZBUjoke25vZGUubmFtZX1gO1xuICB9XG5cbiAgdmlzaXRUeXBlb2ZFeHByKG5vZGU6IG8uVHlwZW9mRXhwciwgY29udGV4dDogYW55KTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFRZUEVPRjoke25vZGUuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCl9YDtcbiAgfVxuXG4gIHZpc2l0V3JhcHBlZE5vZGVFeHByID0gaW52YWxpZDtcbiAgdmlzaXRXcml0ZVZhckV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdFdyaXRlS2V5RXhwciA9IGludmFsaWQ7XG4gIHZpc2l0V3JpdGVQcm9wRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByID0gaW52YWxpZDtcbiAgdmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEluc3RhbnRpYXRlRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByID0gaW52YWxpZDtcbiAgdmlzaXROb3RFeHByID0gaW52YWxpZDtcbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0Q2FzdEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEZ1bmN0aW9uRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0VW5hcnlPcGVyYXRvckV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0UmVhZFByb3BFeHByID0gaW52YWxpZDtcbiAgdmlzaXRSZWFkS2V5RXhwciA9IGludmFsaWQ7XG4gIHZpc2l0Q29tbWFFeHByID0gaW52YWxpZDtcbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcgPSBpbnZhbGlkO1xufVxuXG5mdW5jdGlvbiBpbnZhbGlkPFQ+KHRoaXM6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGFyZzogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50KTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBzdGF0ZTogVmlzaXRvciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBoYW5kbGUgJHthcmcuY29uc3RydWN0b3IubmFtZX1gKTtcbn1cblxuZnVuY3Rpb24gaXNWYXJpYWJsZShlOiBvLkV4cHJlc3Npb24pOiBlIGlzIG8uUmVhZFZhckV4cHIge1xuICByZXR1cm4gZSBpbnN0YW5jZW9mIG8uUmVhZFZhckV4cHI7XG59XG5cbmZ1bmN0aW9uIGlzTG9uZ1N0cmluZ0xpdGVyYWwoZXhwcjogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJiB0eXBlb2YgZXhwci52YWx1ZSA9PT0gJ3N0cmluZycgJiZcbiAgICAgIGV4cHIudmFsdWUubGVuZ3RoID49IFBPT0xfSU5DTFVTSU9OX0xFTkdUSF9USFJFU0hPTERfRk9SX1NUUklOR1M7XG59XG4iXX0=