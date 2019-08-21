/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export class ParserError {
    constructor(message, input, errLocation, ctxLocation) {
        this.input = input;
        this.errLocation = errLocation;
        this.ctxLocation = ctxLocation;
        this.message = `Parser Error: ${message} ${errLocation} [${input}] in ${ctxLocation}`;
    }
}
export class ParseSpan {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
export class AST {
    constructor(span) {
        this.span = span;
    }
    visit(visitor, context = null) { return null; }
    toString() { return 'AST'; }
}
/**
 * Represents a quoted expression of the form:
 *
 * quote = prefix `:` uninterpretedExpression
 * prefix = identifier
 * uninterpretedExpression = arbitrary string
 *
 * A quoted expression is meant to be pre-processed by an AST transformer that
 * converts it into another AST that no longer contains quoted expressions.
 * It is meant to allow third-party developers to extend Angular template
 * expression language. The `uninterpretedExpression` part of the quote is
 * therefore not interpreted by the Angular's own expression parser.
 */
export class Quote extends AST {
    constructor(span, prefix, uninterpretedExpression, location) {
        super(span);
        this.prefix = prefix;
        this.uninterpretedExpression = uninterpretedExpression;
        this.location = location;
    }
    visit(visitor, context = null) { return visitor.visitQuote(this, context); }
    toString() { return 'Quote'; }
}
export class EmptyExpr extends AST {
    visit(visitor, context = null) {
        // do nothing
    }
}
export class ImplicitReceiver extends AST {
    visit(visitor, context = null) {
        return visitor.visitImplicitReceiver(this, context);
    }
}
/**
 * Multiple expressions separated by a semicolon.
 */
export class Chain extends AST {
    constructor(span, expressions) {
        super(span);
        this.expressions = expressions;
    }
    visit(visitor, context = null) { return visitor.visitChain(this, context); }
}
export class Conditional extends AST {
    constructor(span, condition, trueExp, falseExp) {
        super(span);
        this.condition = condition;
        this.trueExp = trueExp;
        this.falseExp = falseExp;
    }
    visit(visitor, context = null) {
        return visitor.visitConditional(this, context);
    }
}
export class PropertyRead extends AST {
    constructor(span, receiver, name) {
        super(span);
        this.receiver = receiver;
        this.name = name;
    }
    visit(visitor, context = null) {
        return visitor.visitPropertyRead(this, context);
    }
}
export class PropertyWrite extends AST {
    constructor(span, receiver, name, value) {
        super(span);
        this.receiver = receiver;
        this.name = name;
        this.value = value;
    }
    visit(visitor, context = null) {
        return visitor.visitPropertyWrite(this, context);
    }
}
export class SafePropertyRead extends AST {
    constructor(span, receiver, name) {
        super(span);
        this.receiver = receiver;
        this.name = name;
    }
    visit(visitor, context = null) {
        return visitor.visitSafePropertyRead(this, context);
    }
}
export class KeyedRead extends AST {
    constructor(span, obj, key) {
        super(span);
        this.obj = obj;
        this.key = key;
    }
    visit(visitor, context = null) {
        return visitor.visitKeyedRead(this, context);
    }
}
export class KeyedWrite extends AST {
    constructor(span, obj, key, value) {
        super(span);
        this.obj = obj;
        this.key = key;
        this.value = value;
    }
    visit(visitor, context = null) {
        return visitor.visitKeyedWrite(this, context);
    }
}
export class BindingPipe extends AST {
    constructor(span, exp, name, args) {
        super(span);
        this.exp = exp;
        this.name = name;
        this.args = args;
    }
    visit(visitor, context = null) { return visitor.visitPipe(this, context); }
}
export class LiteralPrimitive extends AST {
    constructor(span, value) {
        super(span);
        this.value = value;
    }
    visit(visitor, context = null) {
        return visitor.visitLiteralPrimitive(this, context);
    }
}
export class LiteralArray extends AST {
    constructor(span, expressions) {
        super(span);
        this.expressions = expressions;
    }
    visit(visitor, context = null) {
        return visitor.visitLiteralArray(this, context);
    }
}
export class LiteralMap extends AST {
    constructor(span, keys, values) {
        super(span);
        this.keys = keys;
        this.values = values;
    }
    visit(visitor, context = null) {
        return visitor.visitLiteralMap(this, context);
    }
}
export class Interpolation extends AST {
    constructor(span, strings, expressions) {
        super(span);
        this.strings = strings;
        this.expressions = expressions;
    }
    visit(visitor, context = null) {
        return visitor.visitInterpolation(this, context);
    }
}
export class Binary extends AST {
    constructor(span, operation, left, right) {
        super(span);
        this.operation = operation;
        this.left = left;
        this.right = right;
    }
    visit(visitor, context = null) {
        return visitor.visitBinary(this, context);
    }
}
export class PrefixNot extends AST {
    constructor(span, expression) {
        super(span);
        this.expression = expression;
    }
    visit(visitor, context = null) {
        return visitor.visitPrefixNot(this, context);
    }
}
export class NonNullAssert extends AST {
    constructor(span, expression) {
        super(span);
        this.expression = expression;
    }
    visit(visitor, context = null) {
        return visitor.visitNonNullAssert(this, context);
    }
}
export class MethodCall extends AST {
    constructor(span, receiver, name, args) {
        super(span);
        this.receiver = receiver;
        this.name = name;
        this.args = args;
    }
    visit(visitor, context = null) {
        return visitor.visitMethodCall(this, context);
    }
}
export class SafeMethodCall extends AST {
    constructor(span, receiver, name, args) {
        super(span);
        this.receiver = receiver;
        this.name = name;
        this.args = args;
    }
    visit(visitor, context = null) {
        return visitor.visitSafeMethodCall(this, context);
    }
}
export class FunctionCall extends AST {
    constructor(span, target, args) {
        super(span);
        this.target = target;
        this.args = args;
    }
    visit(visitor, context = null) {
        return visitor.visitFunctionCall(this, context);
    }
}
/**
 * Records the absolute position of a text span in a source file, where `start` and `end` are the
 * starting and ending byte offsets, respectively, of the text span in a source file.
 */
export class AbsoluteSourceSpan {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
export class ASTWithSource extends AST {
    constructor(ast, source, location, absoluteOffset, errors) {
        super(new ParseSpan(0, source == null ? 0 : source.length));
        this.ast = ast;
        this.source = source;
        this.location = location;
        this.errors = errors;
        this.sourceSpan = new AbsoluteSourceSpan(absoluteOffset, absoluteOffset + this.span.end);
    }
    visit(visitor, context = null) {
        if (visitor.visitASTWithSource) {
            return visitor.visitASTWithSource(this, context);
        }
        return this.ast.visit(visitor, context);
    }
    toString() { return `${this.source} in ${this.location}`; }
}
export class TemplateBinding {
    constructor(span, key, keyIsVar, name, expression) {
        this.span = span;
        this.key = key;
        this.keyIsVar = keyIsVar;
        this.name = name;
        this.expression = expression;
    }
}
export class NullAstVisitor {
    visitBinary(ast, context) { }
    visitChain(ast, context) { }
    visitConditional(ast, context) { }
    visitFunctionCall(ast, context) { }
    visitImplicitReceiver(ast, context) { }
    visitInterpolation(ast, context) { }
    visitKeyedRead(ast, context) { }
    visitKeyedWrite(ast, context) { }
    visitLiteralArray(ast, context) { }
    visitLiteralMap(ast, context) { }
    visitLiteralPrimitive(ast, context) { }
    visitMethodCall(ast, context) { }
    visitPipe(ast, context) { }
    visitPrefixNot(ast, context) { }
    visitNonNullAssert(ast, context) { }
    visitPropertyRead(ast, context) { }
    visitPropertyWrite(ast, context) { }
    visitQuote(ast, context) { }
    visitSafeMethodCall(ast, context) { }
    visitSafePropertyRead(ast, context) { }
}
export class RecursiveAstVisitor {
    visitBinary(ast, context) {
        ast.left.visit(this, context);
        ast.right.visit(this, context);
        return null;
    }
    visitChain(ast, context) { return this.visitAll(ast.expressions, context); }
    visitConditional(ast, context) {
        ast.condition.visit(this, context);
        ast.trueExp.visit(this, context);
        ast.falseExp.visit(this, context);
        return null;
    }
    visitPipe(ast, context) {
        ast.exp.visit(this, context);
        this.visitAll(ast.args, context);
        return null;
    }
    visitFunctionCall(ast, context) {
        ast.target.visit(this, context);
        this.visitAll(ast.args, context);
        return null;
    }
    visitImplicitReceiver(ast, context) { return null; }
    visitInterpolation(ast, context) {
        return this.visitAll(ast.expressions, context);
    }
    visitKeyedRead(ast, context) {
        ast.obj.visit(this, context);
        ast.key.visit(this, context);
        return null;
    }
    visitKeyedWrite(ast, context) {
        ast.obj.visit(this, context);
        ast.key.visit(this, context);
        ast.value.visit(this, context);
        return null;
    }
    visitLiteralArray(ast, context) {
        return this.visitAll(ast.expressions, context);
    }
    visitLiteralMap(ast, context) { return this.visitAll(ast.values, context); }
    visitLiteralPrimitive(ast, context) { return null; }
    visitMethodCall(ast, context) {
        ast.receiver.visit(this, context);
        return this.visitAll(ast.args, context);
    }
    visitPrefixNot(ast, context) {
        ast.expression.visit(this, context);
        return null;
    }
    visitNonNullAssert(ast, context) {
        ast.expression.visit(this, context);
        return null;
    }
    visitPropertyRead(ast, context) {
        ast.receiver.visit(this, context);
        return null;
    }
    visitPropertyWrite(ast, context) {
        ast.receiver.visit(this, context);
        ast.value.visit(this, context);
        return null;
    }
    visitSafePropertyRead(ast, context) {
        ast.receiver.visit(this, context);
        return null;
    }
    visitSafeMethodCall(ast, context) {
        ast.receiver.visit(this, context);
        return this.visitAll(ast.args, context);
    }
    visitAll(asts, context) {
        asts.forEach(ast => ast.visit(this, context));
        return null;
    }
    visitQuote(ast, context) { return null; }
}
export class AstTransformer {
    visitImplicitReceiver(ast, context) { return ast; }
    visitInterpolation(ast, context) {
        return new Interpolation(ast.span, ast.strings, this.visitAll(ast.expressions));
    }
    visitLiteralPrimitive(ast, context) {
        return new LiteralPrimitive(ast.span, ast.value);
    }
    visitPropertyRead(ast, context) {
        return new PropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    }
    visitPropertyWrite(ast, context) {
        return new PropertyWrite(ast.span, ast.receiver.visit(this), ast.name, ast.value.visit(this));
    }
    visitSafePropertyRead(ast, context) {
        return new SafePropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    }
    visitMethodCall(ast, context) {
        return new MethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    }
    visitSafeMethodCall(ast, context) {
        return new SafeMethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    }
    visitFunctionCall(ast, context) {
        return new FunctionCall(ast.span, ast.target.visit(this), this.visitAll(ast.args));
    }
    visitLiteralArray(ast, context) {
        return new LiteralArray(ast.span, this.visitAll(ast.expressions));
    }
    visitLiteralMap(ast, context) {
        return new LiteralMap(ast.span, ast.keys, this.visitAll(ast.values));
    }
    visitBinary(ast, context) {
        return new Binary(ast.span, ast.operation, ast.left.visit(this), ast.right.visit(this));
    }
    visitPrefixNot(ast, context) {
        return new PrefixNot(ast.span, ast.expression.visit(this));
    }
    visitNonNullAssert(ast, context) {
        return new NonNullAssert(ast.span, ast.expression.visit(this));
    }
    visitConditional(ast, context) {
        return new Conditional(ast.span, ast.condition.visit(this), ast.trueExp.visit(this), ast.falseExp.visit(this));
    }
    visitPipe(ast, context) {
        return new BindingPipe(ast.span, ast.exp.visit(this), ast.name, this.visitAll(ast.args));
    }
    visitKeyedRead(ast, context) {
        return new KeyedRead(ast.span, ast.obj.visit(this), ast.key.visit(this));
    }
    visitKeyedWrite(ast, context) {
        return new KeyedWrite(ast.span, ast.obj.visit(this), ast.key.visit(this), ast.value.visit(this));
    }
    visitAll(asts) {
        const res = [];
        for (let i = 0; i < asts.length; ++i) {
            res[i] = asts[i].visit(this);
        }
        return res;
    }
    visitChain(ast, context) {
        return new Chain(ast.span, this.visitAll(ast.expressions));
    }
    visitQuote(ast, context) {
        return new Quote(ast.span, ast.prefix, ast.uninterpretedExpression, ast.location);
    }
}
// A transformer that only creates new nodes if the transformer makes a change or
// a change is made a child node.
export class AstMemoryEfficientTransformer {
    visitImplicitReceiver(ast, context) { return ast; }
    visitInterpolation(ast, context) {
        const expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions)
            return new Interpolation(ast.span, ast.strings, expressions);
        return ast;
    }
    visitLiteralPrimitive(ast, context) { return ast; }
    visitPropertyRead(ast, context) {
        const receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new PropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    }
    visitPropertyWrite(ast, context) {
        const receiver = ast.receiver.visit(this);
        const value = ast.value.visit(this);
        if (receiver !== ast.receiver || value !== ast.value) {
            return new PropertyWrite(ast.span, receiver, ast.name, value);
        }
        return ast;
    }
    visitSafePropertyRead(ast, context) {
        const receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new SafePropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    }
    visitMethodCall(ast, context) {
        const receiver = ast.receiver.visit(this);
        const args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new MethodCall(ast.span, receiver, ast.name, args);
        }
        return ast;
    }
    visitSafeMethodCall(ast, context) {
        const receiver = ast.receiver.visit(this);
        const args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new SafeMethodCall(ast.span, receiver, ast.name, args);
        }
        return ast;
    }
    visitFunctionCall(ast, context) {
        const target = ast.target && ast.target.visit(this);
        const args = this.visitAll(ast.args);
        if (target !== ast.target || args !== ast.args) {
            return new FunctionCall(ast.span, target, args);
        }
        return ast;
    }
    visitLiteralArray(ast, context) {
        const expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new LiteralArray(ast.span, expressions);
        }
        return ast;
    }
    visitLiteralMap(ast, context) {
        const values = this.visitAll(ast.values);
        if (values !== ast.values) {
            return new LiteralMap(ast.span, ast.keys, values);
        }
        return ast;
    }
    visitBinary(ast, context) {
        const left = ast.left.visit(this);
        const right = ast.right.visit(this);
        if (left !== ast.left || right !== ast.right) {
            return new Binary(ast.span, ast.operation, left, right);
        }
        return ast;
    }
    visitPrefixNot(ast, context) {
        const expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new PrefixNot(ast.span, expression);
        }
        return ast;
    }
    visitNonNullAssert(ast, context) {
        const expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new NonNullAssert(ast.span, expression);
        }
        return ast;
    }
    visitConditional(ast, context) {
        const condition = ast.condition.visit(this);
        const trueExp = ast.trueExp.visit(this);
        const falseExp = ast.falseExp.visit(this);
        if (condition !== ast.condition || trueExp !== ast.trueExp || falseExp !== ast.falseExp) {
            return new Conditional(ast.span, condition, trueExp, falseExp);
        }
        return ast;
    }
    visitPipe(ast, context) {
        const exp = ast.exp.visit(this);
        const args = this.visitAll(ast.args);
        if (exp !== ast.exp || args !== ast.args) {
            return new BindingPipe(ast.span, exp, ast.name, args);
        }
        return ast;
    }
    visitKeyedRead(ast, context) {
        const obj = ast.obj.visit(this);
        const key = ast.key.visit(this);
        if (obj !== ast.obj || key !== ast.key) {
            return new KeyedRead(ast.span, obj, key);
        }
        return ast;
    }
    visitKeyedWrite(ast, context) {
        const obj = ast.obj.visit(this);
        const key = ast.key.visit(this);
        const value = ast.value.visit(this);
        if (obj !== ast.obj || key !== ast.key || value !== ast.value) {
            return new KeyedWrite(ast.span, obj, key, value);
        }
        return ast;
    }
    visitAll(asts) {
        const res = [];
        let modified = false;
        for (let i = 0; i < asts.length; ++i) {
            const original = asts[i];
            const value = original.visit(this);
            res[i] = value;
            modified = modified || value !== original;
        }
        return modified ? res : asts;
    }
    visitChain(ast, context) {
        const expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new Chain(ast.span, expressions);
        }
        return ast;
    }
    visitQuote(ast, context) { return ast; }
}
export function visitAstChildren(ast, visitor, context) {
    function visit(ast) {
        visitor.visit && visitor.visit(ast, context) || ast.visit(visitor, context);
    }
    function visitAll(asts) { asts.forEach(visit); }
    ast.visit({
        visitBinary(ast) {
            visit(ast.left);
            visit(ast.right);
        },
        visitChain(ast) { visitAll(ast.expressions); },
        visitConditional(ast) {
            visit(ast.condition);
            visit(ast.trueExp);
            visit(ast.falseExp);
        },
        visitFunctionCall(ast) {
            if (ast.target) {
                visit(ast.target);
            }
            visitAll(ast.args);
        },
        visitImplicitReceiver(ast) { },
        visitInterpolation(ast) { visitAll(ast.expressions); },
        visitKeyedRead(ast) {
            visit(ast.obj);
            visit(ast.key);
        },
        visitKeyedWrite(ast) {
            visit(ast.obj);
            visit(ast.key);
            visit(ast.obj);
        },
        visitLiteralArray(ast) { visitAll(ast.expressions); },
        visitLiteralMap(ast) { },
        visitLiteralPrimitive(ast) { },
        visitMethodCall(ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        visitPipe(ast) {
            visit(ast.exp);
            visitAll(ast.args);
        },
        visitPrefixNot(ast) { visit(ast.expression); },
        visitNonNullAssert(ast) { visit(ast.expression); },
        visitPropertyRead(ast) { visit(ast.receiver); },
        visitPropertyWrite(ast) {
            visit(ast.receiver);
            visit(ast.value);
        },
        visitQuote(ast) { },
        visitSafeMethodCall(ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        visitSafePropertyRead(ast) { visit(ast.receiver); },
    });
}
// Bindings
export class ParsedProperty {
    constructor(name, expression, type, sourceSpan, valueSpan) {
        this.name = name;
        this.expression = expression;
        this.type = type;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
        this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
        this.isAnimation = this.type === ParsedPropertyType.ANIMATION;
    }
}
export var ParsedPropertyType;
(function (ParsedPropertyType) {
    ParsedPropertyType[ParsedPropertyType["DEFAULT"] = 0] = "DEFAULT";
    ParsedPropertyType[ParsedPropertyType["LITERAL_ATTR"] = 1] = "LITERAL_ATTR";
    ParsedPropertyType[ParsedPropertyType["ANIMATION"] = 2] = "ANIMATION";
})(ParsedPropertyType || (ParsedPropertyType = {}));
export class ParsedEvent {
    // Regular events have a target
    // Animation events have a phase
    constructor(name, targetOrPhase, type, handler, sourceSpan, handlerSpan) {
        this.name = name;
        this.targetOrPhase = targetOrPhase;
        this.type = type;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
        this.handlerSpan = handlerSpan;
    }
}
export class ParsedVariable {
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
}
export class BoundElementProperty {
    constructor(name, type, securityContext, value, unit, sourceSpan, valueSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFLSCxNQUFNLE9BQU8sV0FBVztJQUV0QixZQUNJLE9BQWUsRUFBUyxLQUFhLEVBQVMsV0FBbUIsRUFBUyxXQUFpQjtRQUFuRSxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBTTtRQUM3RixJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFpQixPQUFPLElBQUksV0FBVyxLQUFLLEtBQUssUUFBUSxXQUFXLEVBQUUsQ0FBQztJQUN4RixDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sU0FBUztJQUNwQixZQUFtQixLQUFhLEVBQVMsR0FBVztRQUFqQyxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsUUFBRyxHQUFILEdBQUcsQ0FBUTtJQUFHLENBQUM7Q0FDekQ7QUFFRCxNQUFNLE9BQU8sR0FBRztJQUNkLFlBQW1CLElBQWU7UUFBZixTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUN0QyxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUksSUFBUyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckUsUUFBUSxLQUFhLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQztDQUNyQztBQUVEOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILE1BQU0sT0FBTyxLQUFNLFNBQVEsR0FBRztJQUM1QixZQUNJLElBQWUsRUFBUyxNQUFjLEVBQVMsdUJBQStCLEVBQ3ZFLFFBQWE7UUFDdEIsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRmMsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUFTLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBUTtRQUN2RSxhQUFRLEdBQVIsUUFBUSxDQUFLO0lBRXhCLENBQUM7SUFDRCxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUksSUFBUyxPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRyxRQUFRLEtBQWEsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDO0NBQ3ZDO0FBRUQsTUFBTSxPQUFPLFNBQVUsU0FBUSxHQUFHO0lBQ2hDLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSTtRQUM1QyxhQUFhO0lBQ2YsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLGdCQUFpQixTQUFRLEdBQUc7SUFDdkMsS0FBSyxDQUFDLE9BQW1CLEVBQUUsVUFBZSxJQUFJO1FBQzVDLE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN0RCxDQUFDO0NBQ0Y7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxLQUFNLFNBQVEsR0FBRztJQUM1QixZQUFZLElBQWUsRUFBUyxXQUFrQjtRQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUFsQyxnQkFBVyxHQUFYLFdBQVcsQ0FBTztJQUFpQixDQUFDO0lBQ3hFLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSSxJQUFTLE9BQU8sT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25HO0FBRUQsTUFBTSxPQUFPLFdBQVksU0FBUSxHQUFHO0lBQ2xDLFlBQVksSUFBZSxFQUFTLFNBQWMsRUFBUyxPQUFZLEVBQVMsUUFBYTtRQUMzRixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFEc0IsY0FBUyxHQUFULFNBQVMsQ0FBSztRQUFTLFlBQU8sR0FBUCxPQUFPLENBQUs7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFLO0lBRTdGLENBQUM7SUFDRCxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2pELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxZQUFhLFNBQVEsR0FBRztJQUNuQyxZQUFZLElBQWUsRUFBUyxRQUFhLEVBQVMsSUFBWTtRQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUFsRCxhQUFRLEdBQVIsUUFBUSxDQUFLO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBUTtJQUFpQixDQUFDO0lBQ3hGLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSTtRQUM1QyxPQUFPLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLGFBQWMsU0FBUSxHQUFHO0lBQ3BDLFlBQVksSUFBZSxFQUFTLFFBQWEsRUFBUyxJQUFZLEVBQVMsS0FBVTtRQUN2RixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFEc0IsYUFBUSxHQUFSLFFBQVEsQ0FBSztRQUFTLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxVQUFLLEdBQUwsS0FBSyxDQUFLO0lBRXpGLENBQUM7SUFDRCxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxHQUFHO0lBQ3ZDLFlBQVksSUFBZSxFQUFTLFFBQWEsRUFBUyxJQUFZO1FBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQWxELGFBQVEsR0FBUixRQUFRLENBQUs7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFRO0lBQWlCLENBQUM7SUFDeEYsS0FBSyxDQUFDLE9BQW1CLEVBQUUsVUFBZSxJQUFJO1FBQzVDLE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN0RCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sU0FBVSxTQUFRLEdBQUc7SUFDaEMsWUFBWSxJQUFlLEVBQVMsR0FBUSxFQUFTLEdBQVE7UUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFBekMsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUFTLFFBQUcsR0FBSCxHQUFHLENBQUs7SUFBaUIsQ0FBQztJQUMvRSxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sVUFBVyxTQUFRLEdBQUc7SUFDakMsWUFBWSxJQUFlLEVBQVMsR0FBUSxFQUFTLEdBQVEsRUFBUyxLQUFVO1FBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQTVELFFBQUcsR0FBSCxHQUFHLENBQUs7UUFBUyxRQUFHLEdBQUgsR0FBRyxDQUFLO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBSztJQUFpQixDQUFDO0lBQ2xHLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSTtRQUM1QyxPQUFPLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxXQUFZLFNBQVEsR0FBRztJQUNsQyxZQUFZLElBQWUsRUFBUyxHQUFRLEVBQVMsSUFBWSxFQUFTLElBQVc7UUFDbkYsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRHNCLFFBQUcsR0FBSCxHQUFHLENBQUs7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBTztJQUVyRixDQUFDO0lBQ0QsS0FBSyxDQUFDLE9BQW1CLEVBQUUsVUFBZSxJQUFJLElBQVMsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbEc7QUFFRCxNQUFNLE9BQU8sZ0JBQWlCLFNBQVEsR0FBRztJQUN2QyxZQUFZLElBQWUsRUFBUyxLQUFVO1FBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQTFCLFVBQUssR0FBTCxLQUFLLENBQUs7SUFBaUIsQ0FBQztJQUNoRSxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxZQUFhLFNBQVEsR0FBRztJQUNuQyxZQUFZLElBQWUsRUFBUyxXQUFrQjtRQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUFsQyxnQkFBVyxHQUFYLFdBQVcsQ0FBTztJQUFpQixDQUFDO0lBQ3hFLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSTtRQUM1QyxPQUFPLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBTUQsTUFBTSxPQUFPLFVBQVcsU0FBUSxHQUFHO0lBQ2pDLFlBQVksSUFBZSxFQUFTLElBQXFCLEVBQVMsTUFBYTtRQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUEzRCxTQUFJLEdBQUosSUFBSSxDQUFpQjtRQUFTLFdBQU0sR0FBTixNQUFNLENBQU87SUFBaUIsQ0FBQztJQUNqRyxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNoRCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sYUFBYyxTQUFRLEdBQUc7SUFDcEMsWUFBWSxJQUFlLEVBQVMsT0FBYyxFQUFTLFdBQWtCO1FBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQXpELFlBQU8sR0FBUCxPQUFPLENBQU87UUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBTztJQUFpQixDQUFDO0lBQy9GLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSTtRQUM1QyxPQUFPLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbkQsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLE1BQU8sU0FBUSxHQUFHO0lBQzdCLFlBQVksSUFBZSxFQUFTLFNBQWlCLEVBQVMsSUFBUyxFQUFTLEtBQVU7UUFDeEYsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRHNCLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFLO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBSztJQUUxRixDQUFDO0lBQ0QsS0FBSyxDQUFDLE9BQW1CLEVBQUUsVUFBZSxJQUFJO1FBQzVDLE9BQU8sT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVUsU0FBUSxHQUFHO0lBQ2hDLFlBQVksSUFBZSxFQUFTLFVBQWU7UUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFBL0IsZUFBVSxHQUFWLFVBQVUsQ0FBSztJQUFpQixDQUFDO0lBQ3JFLEtBQUssQ0FBQyxPQUFtQixFQUFFLFVBQWUsSUFBSTtRQUM1QyxPQUFPLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxhQUFjLFNBQVEsR0FBRztJQUNwQyxZQUFZLElBQWUsRUFBUyxVQUFlO1FBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQS9CLGVBQVUsR0FBVixVQUFVLENBQUs7SUFBaUIsQ0FBQztJQUNyRSxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxVQUFXLFNBQVEsR0FBRztJQUNqQyxZQUFZLElBQWUsRUFBUyxRQUFhLEVBQVMsSUFBWSxFQUFTLElBQVc7UUFDeEYsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRHNCLGFBQVEsR0FBUixRQUFRLENBQUs7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBTztJQUUxRixDQUFDO0lBQ0QsS0FBSyxDQUFDLE9BQW1CLEVBQUUsVUFBZSxJQUFJO1FBQzVDLE9BQU8sT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLGNBQWUsU0FBUSxHQUFHO0lBQ3JDLFlBQVksSUFBZSxFQUFTLFFBQWEsRUFBUyxJQUFZLEVBQVMsSUFBVztRQUN4RixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFEc0IsYUFBUSxHQUFSLFFBQVEsQ0FBSztRQUFTLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFPO0lBRTFGLENBQUM7SUFDRCxLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3BELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxZQUFhLFNBQVEsR0FBRztJQUNuQyxZQUFZLElBQWUsRUFBUyxNQUFnQixFQUFTLElBQVc7UUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFBcEQsV0FBTSxHQUFOLE1BQU0sQ0FBVTtRQUFTLFNBQUksR0FBSixJQUFJLENBQU87SUFBaUIsQ0FBQztJQUMxRixLQUFLLENBQUMsT0FBbUIsRUFBRSxVQUFlLElBQUk7UUFDNUMsT0FBTyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2xELENBQUM7Q0FDRjtBQUVEOzs7R0FHRztBQUNILE1BQU0sT0FBTyxrQkFBa0I7SUFDN0IsWUFBbUIsS0FBYSxFQUFTLEdBQVc7UUFBakMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLFFBQUcsR0FBSCxHQUFHLENBQVE7SUFBRyxDQUFDO0NBQ3pEO0FBRUQsTUFBTSxPQUFPLGFBQWMsU0FBUSxHQUFHO0lBRXBDLFlBQ1csR0FBUSxFQUFTLE1BQW1CLEVBQVMsUUFBZ0IsRUFBRSxjQUFzQixFQUNyRixNQUFxQjtRQUM5QixLQUFLLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLE1BQU0sSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFGbkQsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUFTLFdBQU0sR0FBTixNQUFNLENBQWE7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQzdELFdBQU0sR0FBTixNQUFNLENBQWU7UUFFOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsRUFBRSxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBQ0QsS0FBSyxDQUFDLE9BQW1CLEVBQUUsVUFBZSxJQUFJO1FBQzVDLElBQUksT0FBTyxDQUFDLGtCQUFrQixFQUFFO1lBQzlCLE9BQU8sT0FBTyxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNsRDtRQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFDRCxRQUFRLEtBQWEsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLE9BQU8sSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztDQUNwRTtBQUVELE1BQU0sT0FBTyxlQUFlO0lBQzFCLFlBQ1csSUFBZSxFQUFTLEdBQVcsRUFBUyxRQUFpQixFQUFTLElBQVksRUFDbEYsVUFBOEI7UUFEOUIsU0FBSSxHQUFKLElBQUksQ0FBVztRQUFTLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFTO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNsRixlQUFVLEdBQVYsVUFBVSxDQUFvQjtJQUFHLENBQUM7Q0FDOUM7QUEyQkQsTUFBTSxPQUFPLGNBQWM7SUFDekIsV0FBVyxDQUFDLEdBQVcsRUFBRSxPQUFZLElBQVEsQ0FBQztJQUM5QyxVQUFVLENBQUMsR0FBVSxFQUFFLE9BQVksSUFBUSxDQUFDO0lBQzVDLGdCQUFnQixDQUFDLEdBQWdCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDeEQsaUJBQWlCLENBQUMsR0FBaUIsRUFBRSxPQUFZLElBQVEsQ0FBQztJQUMxRCxxQkFBcUIsQ0FBQyxHQUFxQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ2xFLGtCQUFrQixDQUFDLEdBQWtCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDNUQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZLElBQVEsQ0FBQztJQUNwRCxlQUFlLENBQUMsR0FBZSxFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ3RELGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDMUQsZUFBZSxDQUFDLEdBQWUsRUFBRSxPQUFZLElBQVEsQ0FBQztJQUN0RCxxQkFBcUIsQ0FBQyxHQUFxQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ2xFLGVBQWUsQ0FBQyxHQUFlLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDdEQsU0FBUyxDQUFDLEdBQWdCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDakQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZLElBQVEsQ0FBQztJQUNwRCxrQkFBa0IsQ0FBQyxHQUFrQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQzVELGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDMUQsa0JBQWtCLENBQUMsR0FBa0IsRUFBRSxPQUFZLElBQVEsQ0FBQztJQUM1RCxVQUFVLENBQUMsR0FBVSxFQUFFLE9BQVksSUFBUSxDQUFDO0lBQzVDLG1CQUFtQixDQUFDLEdBQW1CLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDOUQscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZLElBQVEsQ0FBQztDQUNuRTtBQUVELE1BQU0sT0FBTyxtQkFBbUI7SUFDOUIsV0FBVyxDQUFDLEdBQVcsRUFBRSxPQUFZO1FBQ25DLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5QixHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsVUFBVSxDQUFDLEdBQVUsRUFBRSxPQUFZLElBQVMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdGLGdCQUFnQixDQUFDLEdBQWdCLEVBQUUsT0FBWTtRQUM3QyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxTQUFTLENBQUMsR0FBZ0IsRUFBRSxPQUFZO1FBQ3RDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsaUJBQWlCLENBQUMsR0FBaUIsRUFBRSxPQUFZO1FBQy9DLEdBQUcsQ0FBQyxNQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZLElBQVMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2hGLGtCQUFrQixDQUFDLEdBQWtCLEVBQUUsT0FBWTtRQUNqRCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQ0QsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZO1FBQ3pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsZUFBZSxDQUFDLEdBQWUsRUFBRSxPQUFZO1FBQzNDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQy9CLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWTtRQUMvQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQ0QsZUFBZSxDQUFDLEdBQWUsRUFBRSxPQUFZLElBQVMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xHLHFCQUFxQixDQUFDLEdBQXFCLEVBQUUsT0FBWSxJQUFTLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRixlQUFlLENBQUMsR0FBZSxFQUFFLE9BQVk7UUFDM0MsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFDRCxjQUFjLENBQUMsR0FBYyxFQUFFLE9BQVk7UUFDekMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELGtCQUFrQixDQUFDLEdBQWtCLEVBQUUsT0FBWTtRQUNqRCxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsaUJBQWlCLENBQUMsR0FBaUIsRUFBRSxPQUFZO1FBQy9DLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxrQkFBa0IsQ0FBQyxHQUFrQixFQUFFLE9BQVk7UUFDakQsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxxQkFBcUIsQ0FBQyxHQUFxQixFQUFFLE9BQVk7UUFDdkQsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELG1CQUFtQixDQUFDLEdBQW1CLEVBQUUsT0FBWTtRQUNuRCxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUNELFFBQVEsQ0FBQyxJQUFXLEVBQUUsT0FBWTtRQUNoQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM5QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxVQUFVLENBQUMsR0FBVSxFQUFFLE9BQVksSUFBUyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDM0Q7QUFFRCxNQUFNLE9BQU8sY0FBYztJQUN6QixxQkFBcUIsQ0FBQyxHQUFxQixFQUFFLE9BQVksSUFBUyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFL0Usa0JBQWtCLENBQUMsR0FBa0IsRUFBRSxPQUFZO1FBQ2pELE9BQU8sSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVELHFCQUFxQixDQUFDLEdBQXFCLEVBQUUsT0FBWTtRQUN2RCxPQUFPLElBQUksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWTtRQUMvQyxPQUFPLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxHQUFrQixFQUFFLE9BQVk7UUFDakQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRUQscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZO1FBQ3ZELE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQsZUFBZSxDQUFDLEdBQWUsRUFBRSxPQUFZO1FBQzNDLE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUVELG1CQUFtQixDQUFDLEdBQW1CLEVBQUUsT0FBWTtRQUNuRCxPQUFPLElBQUksY0FBYyxDQUNyQixHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQsaUJBQWlCLENBQUMsR0FBaUIsRUFBRSxPQUFZO1FBQy9DLE9BQU8sSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsTUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxHQUFpQixFQUFFLE9BQVk7UUFDL0MsT0FBTyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVELGVBQWUsQ0FBQyxHQUFlLEVBQUUsT0FBWTtRQUMzQyxPQUFPLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRCxXQUFXLENBQUMsR0FBVyxFQUFFLE9BQVk7UUFDbkMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZO1FBQ3pDLE9BQU8sSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxHQUFrQixFQUFFLE9BQVk7UUFDakQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVELGdCQUFnQixDQUFDLEdBQWdCLEVBQUUsT0FBWTtRQUM3QyxPQUFPLElBQUksV0FBVyxDQUNsQixHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDOUYsQ0FBQztJQUVELFNBQVMsQ0FBQyxHQUFnQixFQUFFLE9BQVk7UUFDdEMsT0FBTyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZO1FBQ3pDLE9BQU8sSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxlQUFlLENBQUMsR0FBZSxFQUFFLE9BQVk7UUFDM0MsT0FBTyxJQUFJLFVBQVUsQ0FDakIsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFFRCxRQUFRLENBQUMsSUFBVztRQUNsQixNQUFNLEdBQUcsR0FBRyxFQUFFLENBQUM7UUFDZixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUNwQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM5QjtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELFVBQVUsQ0FBQyxHQUFVLEVBQUUsT0FBWTtRQUNqQyxPQUFPLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQsVUFBVSxDQUFDLEdBQVUsRUFBRSxPQUFZO1FBQ2pDLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDcEYsQ0FBQztDQUNGO0FBRUQsaUZBQWlGO0FBQ2pGLGlDQUFpQztBQUNqQyxNQUFNLE9BQU8sNkJBQTZCO0lBQ3hDLHFCQUFxQixDQUFDLEdBQXFCLEVBQUUsT0FBWSxJQUFTLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUUvRSxrQkFBa0IsQ0FBQyxHQUFrQixFQUFFLE9BQVk7UUFDakQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDbkQsSUFBSSxXQUFXLEtBQUssR0FBRyxDQUFDLFdBQVc7WUFDakMsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDL0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZLElBQVMsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRS9FLGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWTtRQUMvQyxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxJQUFJLFFBQVEsS0FBSyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQzdCLE9BQU8sSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3ZEO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsa0JBQWtCLENBQUMsR0FBa0IsRUFBRSxPQUFZO1FBQ2pELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLElBQUksUUFBUSxLQUFLLEdBQUcsQ0FBQyxRQUFRLElBQUksS0FBSyxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUU7WUFDcEQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQy9EO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZO1FBQ3ZELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFDLElBQUksUUFBUSxLQUFLLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDN0IsT0FBTyxJQUFJLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMzRDtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELGVBQWUsQ0FBQyxHQUFlLEVBQUUsT0FBWTtRQUMzQyxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxJQUFJLFFBQVEsS0FBSyxHQUFHLENBQUMsUUFBUSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsSUFBSSxFQUFFO1lBQ2xELE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUMzRDtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELG1CQUFtQixDQUFDLEdBQW1CLEVBQUUsT0FBWTtRQUNuRCxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxJQUFJLFFBQVEsS0FBSyxHQUFHLENBQUMsUUFBUSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsSUFBSSxFQUFFO1lBQ2xELE9BQU8sSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUMvRDtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWTtRQUMvQyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLElBQUksTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUFNLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEVBQUU7WUFDOUMsT0FBTyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNqRDtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWTtRQUMvQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNuRCxJQUFJLFdBQVcsS0FBSyxHQUFHLENBQUMsV0FBVyxFQUFFO1lBQ25DLE9BQU8sSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztTQUNoRDtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELGVBQWUsQ0FBQyxHQUFlLEVBQUUsT0FBWTtRQUMzQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6QyxJQUFJLE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBTSxFQUFFO1lBQ3pCLE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ25EO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsV0FBVyxDQUFDLEdBQVcsRUFBRSxPQUFZO1FBQ25DLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLElBQUksS0FBSyxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUU7WUFDNUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3pEO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZO1FBQ3pDLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlDLElBQUksVUFBVSxLQUFLLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDakMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQzVDO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsa0JBQWtCLENBQUMsR0FBa0IsRUFBRSxPQUFZO1FBQ2pELE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlDLElBQUksVUFBVSxLQUFLLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDakMsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQ2hEO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsZ0JBQWdCLENBQUMsR0FBZ0IsRUFBRSxPQUFZO1FBQzdDLE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVDLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFDLElBQUksU0FBUyxLQUFLLEdBQUcsQ0FBQyxTQUFTLElBQUksT0FBTyxLQUFLLEdBQUcsQ0FBQyxPQUFPLElBQUksUUFBUSxLQUFLLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDdkYsT0FBTyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7U0FDaEU7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFRCxTQUFTLENBQUMsR0FBZ0IsRUFBRSxPQUFZO1FBQ3RDLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLElBQUksR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEVBQUU7WUFDeEMsT0FBTyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3ZEO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZO1FBQ3pDLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLElBQUksR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEVBQUU7WUFDdEMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUMxQztRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELGVBQWUsQ0FBQyxHQUFlLEVBQUUsT0FBWTtRQUMzQyxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQyxJQUFJLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxJQUFJLEtBQUssS0FBSyxHQUFHLENBQUMsS0FBSyxFQUFFO1lBQzdELE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ2xEO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsUUFBUSxDQUFDLElBQVc7UUFDbEIsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDO1FBQ2YsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25DLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDZixRQUFRLEdBQUcsUUFBUSxJQUFJLEtBQUssS0FBSyxRQUFRLENBQUM7U0FDM0M7UUFDRCxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDL0IsQ0FBQztJQUVELFVBQVUsQ0FBQyxHQUFVLEVBQUUsT0FBWTtRQUNqQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNuRCxJQUFJLFdBQVcsS0FBSyxHQUFHLENBQUMsV0FBVyxFQUFFO1lBQ25DLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztTQUN6QztRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELFVBQVUsQ0FBQyxHQUFVLEVBQUUsT0FBWSxJQUFTLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztDQUMxRDtBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxHQUFRLEVBQUUsT0FBbUIsRUFBRSxPQUFhO0lBQzNFLFNBQVMsS0FBSyxDQUFDLEdBQVE7UUFDckIsT0FBTyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsU0FBUyxRQUFRLENBQWdCLElBQVMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVwRSxHQUFHLENBQUMsS0FBSyxDQUFDO1FBQ1IsV0FBVyxDQUFDLEdBQUc7WUFDYixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hCLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkIsQ0FBQztRQUNELFVBQVUsQ0FBQyxHQUFHLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsZ0JBQWdCLENBQUMsR0FBRztZQUNsQixLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3JCLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDbkIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0QixDQUFDO1FBQ0QsaUJBQWlCLENBQUMsR0FBRztZQUNuQixJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUU7Z0JBQ2QsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNuQjtZQUNELFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsQ0FBQztRQUNELHFCQUFxQixDQUFDLEdBQUcsSUFBRyxDQUFDO1FBQzdCLGtCQUFrQixDQUFDLEdBQUcsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RCxjQUFjLENBQUMsR0FBRztZQUNoQixLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2YsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQixDQUFDO1FBQ0QsZUFBZSxDQUFDLEdBQUc7WUFDakIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNmLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZixLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLENBQUM7UUFDRCxpQkFBaUIsQ0FBQyxHQUFHLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckQsZUFBZSxDQUFDLEdBQUcsSUFBRyxDQUFDO1FBQ3ZCLHFCQUFxQixDQUFDLEdBQUcsSUFBRyxDQUFDO1FBQzdCLGVBQWUsQ0FBQyxHQUFHO1lBQ2pCLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDcEIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixDQUFDO1FBQ0QsU0FBUyxDQUFDLEdBQUc7WUFDWCxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2YsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixDQUFDO1FBQ0QsY0FBYyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxrQkFBa0IsQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEQsaUJBQWlCLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9DLGtCQUFrQixDQUFDLEdBQUc7WUFDcEIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNwQixLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25CLENBQUM7UUFDRCxVQUFVLENBQUMsR0FBRyxJQUFHLENBQUM7UUFDbEIsbUJBQW1CLENBQUMsR0FBRztZQUNyQixLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3BCLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsQ0FBQztRQUNELHFCQUFxQixDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNwRCxDQUFDLENBQUM7QUFDTCxDQUFDO0FBR0QsV0FBVztBQUVYLE1BQU0sT0FBTyxjQUFjO0lBSXpCLFlBQ1csSUFBWSxFQUFTLFVBQXlCLEVBQVMsSUFBd0IsRUFDL0UsVUFBMkIsRUFBUyxTQUEyQjtRQUQvRCxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBZTtRQUFTLFNBQUksR0FBSixJQUFJLENBQW9CO1FBQy9FLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQVMsY0FBUyxHQUFULFNBQVMsQ0FBa0I7UUFDeEUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLGtCQUFrQixDQUFDLFlBQVksQ0FBQztRQUMvRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssa0JBQWtCLENBQUMsU0FBUyxDQUFDO0lBQ2hFLENBQUM7Q0FDRjtBQUVELE1BQU0sQ0FBTixJQUFZLGtCQUlYO0FBSkQsV0FBWSxrQkFBa0I7SUFDNUIsaUVBQU8sQ0FBQTtJQUNQLDJFQUFZLENBQUE7SUFDWixxRUFBUyxDQUFBO0FBQ1gsQ0FBQyxFQUpXLGtCQUFrQixLQUFsQixrQkFBa0IsUUFJN0I7QUFTRCxNQUFNLE9BQU8sV0FBVztJQUN0QiwrQkFBK0I7SUFDL0IsZ0NBQWdDO0lBQ2hDLFlBQ1csSUFBWSxFQUFTLGFBQXFCLEVBQVMsSUFBcUIsRUFDeEUsT0FBWSxFQUFTLFVBQTJCLEVBQ2hELFdBQTRCO1FBRjVCLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUFTLFNBQUksR0FBSixJQUFJLENBQWlCO1FBQ3hFLFlBQU8sR0FBUCxPQUFPLENBQUs7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUNoRCxnQkFBVyxHQUFYLFdBQVcsQ0FBaUI7SUFBRyxDQUFDO0NBQzVDO0FBRUQsTUFBTSxPQUFPLGNBQWM7SUFDekIsWUFBbUIsSUFBWSxFQUFTLEtBQWEsRUFBUyxVQUEyQjtRQUF0RSxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztDQUM5RjtBQWVELE1BQU0sT0FBTyxvQkFBb0I7SUFDL0IsWUFDVyxJQUFZLEVBQVMsSUFBaUIsRUFBUyxlQUFnQyxFQUMvRSxLQUFVLEVBQVMsSUFBaUIsRUFBUyxVQUEyQixFQUN4RSxTQUEyQjtRQUYzQixTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBYTtRQUFTLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUMvRSxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBYTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ3hFLGNBQVMsR0FBVCxTQUFTLENBQWtCO0lBQUcsQ0FBQztDQUMzQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgUGFyc2VyRXJyb3Ige1xuICBwdWJsaWMgbWVzc2FnZTogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIG1lc3NhZ2U6IHN0cmluZywgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBlcnJMb2NhdGlvbjogc3RyaW5nLCBwdWJsaWMgY3R4TG9jYXRpb24/OiBhbnkpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBgUGFyc2VyIEVycm9yOiAke21lc3NhZ2V9ICR7ZXJyTG9jYXRpb259IFske2lucHV0fV0gaW4gJHtjdHhMb2NhdGlvbn1gO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZVNwYW4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RhcnQ6IG51bWJlciwgcHVibGljIGVuZDogbnVtYmVyKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgQVNUIHtcbiAgY29uc3RydWN0b3IocHVibGljIHNwYW46IFBhcnNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7IHJldHVybiBudWxsOyB9XG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7IHJldHVybiAnQVNUJzsgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBxdW90ZWQgZXhwcmVzc2lvbiBvZiB0aGUgZm9ybTpcbiAqXG4gKiBxdW90ZSA9IHByZWZpeCBgOmAgdW5pbnRlcnByZXRlZEV4cHJlc3Npb25cbiAqIHByZWZpeCA9IGlkZW50aWZpZXJcbiAqIHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uID0gYXJiaXRyYXJ5IHN0cmluZ1xuICpcbiAqIEEgcXVvdGVkIGV4cHJlc3Npb24gaXMgbWVhbnQgdG8gYmUgcHJlLXByb2Nlc3NlZCBieSBhbiBBU1QgdHJhbnNmb3JtZXIgdGhhdFxuICogY29udmVydHMgaXQgaW50byBhbm90aGVyIEFTVCB0aGF0IG5vIGxvbmdlciBjb250YWlucyBxdW90ZWQgZXhwcmVzc2lvbnMuXG4gKiBJdCBpcyBtZWFudCB0byBhbGxvdyB0aGlyZC1wYXJ0eSBkZXZlbG9wZXJzIHRvIGV4dGVuZCBBbmd1bGFyIHRlbXBsYXRlXG4gKiBleHByZXNzaW9uIGxhbmd1YWdlLiBUaGUgYHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uYCBwYXJ0IG9mIHRoZSBxdW90ZSBpc1xuICogdGhlcmVmb3JlIG5vdCBpbnRlcnByZXRlZCBieSB0aGUgQW5ndWxhcidzIG93biBleHByZXNzaW9uIHBhcnNlci5cbiAqL1xuZXhwb3J0IGNsYXNzIFF1b3RlIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBwcmVmaXg6IHN0cmluZywgcHVibGljIHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgbG9jYXRpb246IGFueSkge1xuICAgIHN1cGVyKHNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdFF1b3RlKHRoaXMsIGNvbnRleHQpOyB9XG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7IHJldHVybiAnUXVvdGUnOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbXB0eUV4cHIgZXh0ZW5kcyBBU1Qge1xuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKSB7XG4gICAgLy8gZG8gbm90aGluZ1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbXBsaWNpdFJlY2VpdmVyIGV4dGVuZHMgQVNUIHtcbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbXBsaWNpdFJlY2VpdmVyKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogTXVsdGlwbGUgZXhwcmVzc2lvbnMgc2VwYXJhdGVkIGJ5IGEgc2VtaWNvbG9uLlxuICovXG5leHBvcnQgY2xhc3MgQ2hhaW4gZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBleHByZXNzaW9uczogYW55W10pIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0Q2hhaW4odGhpcywgY29udGV4dCk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbmRpdGlvbmFsIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgY29uZGl0aW9uOiBBU1QsIHB1YmxpYyB0cnVlRXhwOiBBU1QsIHB1YmxpYyBmYWxzZUV4cDogQVNUKSB7XG4gICAgc3VwZXIoc3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb25kaXRpb25hbCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvcGVydHlSZWFkIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgcmVjZWl2ZXI6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZykgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFByb3BlcnR5UmVhZCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvcGVydHlXcml0ZSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIHJlY2VpdmVyOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogQVNUKSB7XG4gICAgc3VwZXIoc3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRQcm9wZXJ0eVdyaXRlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlUHJvcGVydHlSZWFkIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgcmVjZWl2ZXI6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZykgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFNhZmVQcm9wZXJ0eVJlYWQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEtleWVkUmVhZCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIG9iajogQVNULCBwdWJsaWMga2V5OiBBU1QpIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRLZXllZFJlYWQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEtleWVkV3JpdGUgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBvYmo6IEFTVCwgcHVibGljIGtleTogQVNULCBwdWJsaWMgdmFsdWU6IEFTVCkgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEtleWVkV3JpdGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJpbmRpbmdQaXBlIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgZXhwOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBhcmdzOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdFBpcGUodGhpcywgY29udGV4dCk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxQcmltaXRpdmUgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyB2YWx1ZTogYW55KSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbFByaW1pdGl2ZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEFycmF5IGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgZXhwcmVzc2lvbnM6IGFueVtdKSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEFycmF5KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIExpdGVyYWxNYXBLZXkgPSB7XG4gIGtleTogc3RyaW5nOyBxdW90ZWQ6IGJvb2xlYW47XG59O1xuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbE1hcCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIGtleXM6IExpdGVyYWxNYXBLZXlbXSwgcHVibGljIHZhbHVlczogYW55W10pIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsTWFwKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnRlcnBvbGF0aW9uIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgc3RyaW5nczogYW55W10sIHB1YmxpYyBleHByZXNzaW9uczogYW55W10pIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnRlcnBvbGF0aW9uKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCaW5hcnkgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBvcGVyYXRpb246IHN0cmluZywgcHVibGljIGxlZnQ6IEFTVCwgcHVibGljIHJpZ2h0OiBBU1QpIHtcbiAgICBzdXBlcihzcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJpbmFyeSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJlZml4Tm90IGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgZXhwcmVzc2lvbjogQVNUKSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UHJlZml4Tm90KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb25OdWxsQXNzZXJ0IGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgZXhwcmVzc2lvbjogQVNUKSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Tm9uTnVsbEFzc2VydCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWV0aG9kQ2FsbCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIHJlY2VpdmVyOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBhcmdzOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TWV0aG9kQ2FsbCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZU1ldGhvZENhbGwgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyByZWNlaXZlcjogQVNULCBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXJnczogYW55W10pIHtcbiAgICBzdXBlcihzcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFNhZmVNZXRob2RDYWxsKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGdW5jdGlvbkNhbGwgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyB0YXJnZXQ6IEFTVHxudWxsLCBwdWJsaWMgYXJnczogYW55W10pIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGdW5jdGlvbkNhbGwodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWNvcmRzIHRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiBhIHRleHQgc3BhbiBpbiBhIHNvdXJjZSBmaWxlLCB3aGVyZSBgc3RhcnRgIGFuZCBgZW5kYCBhcmUgdGhlXG4gKiBzdGFydGluZyBhbmQgZW5kaW5nIGJ5dGUgb2Zmc2V0cywgcmVzcGVjdGl2ZWx5LCBvZiB0aGUgdGV4dCBzcGFuIGluIGEgc291cmNlIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBBYnNvbHV0ZVNvdXJjZVNwYW4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RhcnQ6IG51bWJlciwgcHVibGljIGVuZDogbnVtYmVyKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgQVNUV2l0aFNvdXJjZSBleHRlbmRzIEFTVCB7XG4gIHB1YmxpYyBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW47XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGFzdDogQVNULCBwdWJsaWMgc291cmNlOiBzdHJpbmd8bnVsbCwgcHVibGljIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBwdWJsaWMgZXJyb3JzOiBQYXJzZXJFcnJvcltdKSB7XG4gICAgc3VwZXIobmV3IFBhcnNlU3BhbigwLCBzb3VyY2UgPT0gbnVsbCA/IDAgOiBzb3VyY2UubGVuZ3RoKSk7XG4gICAgdGhpcy5zb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3BhbihhYnNvbHV0ZU9mZnNldCwgYWJzb2x1dGVPZmZzZXQgKyB0aGlzLnNwYW4uZW5kKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICBpZiAodmlzaXRvci52aXNpdEFTVFdpdGhTb3VyY2UpIHtcbiAgICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QVNUV2l0aFNvdXJjZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYXN0LnZpc2l0KHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7IHJldHVybiBgJHt0aGlzLnNvdXJjZX0gaW4gJHt0aGlzLmxvY2F0aW9ufWA7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlQmluZGluZyB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHNwYW46IFBhcnNlU3BhbiwgcHVibGljIGtleTogc3RyaW5nLCBwdWJsaWMga2V5SXNWYXI6IGJvb2xlYW4sIHB1YmxpYyBuYW1lOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZXxudWxsKSB7fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFzdFZpc2l0b3Ige1xuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbiwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRBU1RXaXRoU291cmNlPyhhc3Q6IEFTVFdpdGhTb3VyY2UsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXQ/KGFzdDogQVNULCBjb250ZXh0PzogYW55KTogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgTnVsbEFzdFZpc2l0b3IgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBLZXllZFJlYWQsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxufVxuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QubGVmdC52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QucmlnaHQudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIGNvbnRleHQpOyB9XG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC50cnVlRXhwLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5mYWxzZUV4cC52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZXhwLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC50YXJnZXQgIS52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBJbXBsaWNpdFJlY2VpdmVyLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBLZXllZFJlYWQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0Lm9iai52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3Qua2V5LnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0Lm9iai52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3Qua2V5LnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMsIGNvbnRleHQpOyB9XG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBOb25OdWxsQXNzZXJ0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5leHByZXNzaW9uLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QudmFsdWUudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuYXJncywgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBbGwoYXN0czogQVNUW10sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0cy5mb3JFYWNoKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEFzdFRyYW5zZm9ybWVyIGltcGxlbWVudHMgQXN0VmlzaXRvciB7XG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSk6IEFTVCB7IHJldHVybiBhc3Q7IH1cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgSW50ZXJwb2xhdGlvbihhc3Quc3BhbiwgYXN0LnN0cmluZ3MsIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZShhc3Quc3BhbiwgYXN0LnZhbHVlKTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKGFzdC5zcGFuLCBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyksIGFzdC5uYW1lKTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVdyaXRlKGFzdC5zcGFuLCBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyksIGFzdC5uYW1lLCBhc3QudmFsdWUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IFNhZmVQcm9wZXJ0eVJlYWQoYXN0LnNwYW4sIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKSwgYXN0Lm5hbWUpO1xuICB9XG5cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IE1ldGhvZENhbGwoYXN0LnNwYW4sIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKSwgYXN0Lm5hbWUsIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpKTtcbiAgfVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IFNhZmVNZXRob2RDYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpLCBhc3QubmFtZSwgdGhpcy52aXNpdEFsbChhc3QuYXJncykpO1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbkNhbGwoYXN0LnNwYW4sIGFzdC50YXJnZXQgIS52aXNpdCh0aGlzKSwgdGhpcy52aXNpdEFsbChhc3QuYXJncykpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsQXJyYXkoYXN0LnNwYW4sIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcChhc3Quc3BhbiwgYXN0LmtleXMsIHRoaXMudmlzaXRBbGwoYXN0LnZhbHVlcykpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnkoYXN0LnNwYW4sIGFzdC5vcGVyYXRpb24sIGFzdC5sZWZ0LnZpc2l0KHRoaXMpLCBhc3QucmlnaHQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBQcmVmaXhOb3QoYXN0LnNwYW4sIGFzdC5leHByZXNzaW9uLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBOb25OdWxsQXNzZXJ0KGFzdC5zcGFuLCBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5jb25kaXRpb24udmlzaXQodGhpcyksIGFzdC50cnVlRXhwLnZpc2l0KHRoaXMpLCBhc3QuZmFsc2VFeHAudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCaW5kaW5nUGlwZShhc3Quc3BhbiwgYXN0LmV4cC52aXNpdCh0aGlzKSwgYXN0Lm5hbWUsIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgS2V5ZWRSZWFkKGFzdC5zcGFuLCBhc3Qub2JqLnZpc2l0KHRoaXMpLCBhc3Qua2V5LnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBLZXllZFdyaXRlKFxuICAgICAgICBhc3Quc3BhbiwgYXN0Lm9iai52aXNpdCh0aGlzKSwgYXN0LmtleS52aXNpdCh0aGlzKSwgYXN0LnZhbHVlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdKTogYW55W10ge1xuICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXN0cy5sZW5ndGg7ICsraSkge1xuICAgICAgcmVzW2ldID0gYXN0c1tpXS52aXNpdCh0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IENoYWluKGFzdC5zcGFuLCB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucykpO1xuICB9XG5cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgUXVvdGUoYXN0LnNwYW4sIGFzdC5wcmVmaXgsIGFzdC51bmludGVycHJldGVkRXhwcmVzc2lvbiwgYXN0LmxvY2F0aW9uKTtcbiAgfVxufVxuXG4vLyBBIHRyYW5zZm9ybWVyIHRoYXQgb25seSBjcmVhdGVzIG5ldyBub2RlcyBpZiB0aGUgdHJhbnNmb3JtZXIgbWFrZXMgYSBjaGFuZ2Ugb3Jcbi8vIGEgY2hhbmdlIGlzIG1hZGUgYSBjaGlsZCBub2RlLlxuZXhwb3J0IGNsYXNzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIGltcGxlbWVudHMgQXN0VmlzaXRvciB7XG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSk6IEFTVCB7IHJldHVybiBhc3Q7IH1cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpOiBJbnRlcnBvbGF0aW9uIHtcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTtcbiAgICBpZiAoZXhwcmVzc2lvbnMgIT09IGFzdC5leHByZXNzaW9ucylcbiAgICAgIHJldHVybiBuZXcgSW50ZXJwb2xhdGlvbihhc3Quc3BhbiwgYXN0LnN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KTogQVNUIHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpO1xuICAgIGlmIChyZWNlaXZlciAhPT0gYXN0LnJlY2VpdmVyKSB7XG4gICAgICByZXR1cm4gbmV3IFByb3BlcnR5UmVhZChhc3Quc3BhbiwgcmVjZWl2ZXIsIGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyk7XG4gICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWUudmlzaXQodGhpcyk7XG4gICAgaWYgKHJlY2VpdmVyICE9PSBhc3QucmVjZWl2ZXIgfHwgdmFsdWUgIT09IGFzdC52YWx1ZSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVdyaXRlKGFzdC5zcGFuLCByZWNlaXZlciwgYXN0Lm5hbWUsIHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyk7XG4gICAgaWYgKHJlY2VpdmVyICE9PSBhc3QucmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZChhc3Quc3BhbiwgcmVjZWl2ZXIsIGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmIChyZWNlaXZlciAhPT0gYXN0LnJlY2VpdmVyIHx8IGFyZ3MgIT09IGFzdC5hcmdzKSB7XG4gICAgICByZXR1cm4gbmV3IE1ldGhvZENhbGwoYXN0LnNwYW4sIHJlY2VpdmVyLCBhc3QubmFtZSwgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmIChyZWNlaXZlciAhPT0gYXN0LnJlY2VpdmVyIHx8IGFyZ3MgIT09IGFzdC5hcmdzKSB7XG4gICAgICByZXR1cm4gbmV3IFNhZmVNZXRob2RDYWxsKGFzdC5zcGFuLCByZWNlaXZlciwgYXN0Lm5hbWUsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgdGFyZ2V0ID0gYXN0LnRhcmdldCAmJiBhc3QudGFyZ2V0LnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzKTtcbiAgICBpZiAodGFyZ2V0ICE9PSBhc3QudGFyZ2V0IHx8IGFyZ3MgIT09IGFzdC5hcmdzKSB7XG4gICAgICByZXR1cm4gbmV3IEZ1bmN0aW9uQ2FsbChhc3Quc3BhbiwgdGFyZ2V0LCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpO1xuICAgIGlmIChleHByZXNzaW9ucyAhPT0gYXN0LmV4cHJlc3Npb25zKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheShhc3Quc3BhbiwgZXhwcmVzc2lvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMpO1xuICAgIGlmICh2YWx1ZXMgIT09IGFzdC52YWx1ZXMpIHtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcChhc3Quc3BhbiwgYXN0LmtleXMsIHZhbHVlcyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBsZWZ0ID0gYXN0LmxlZnQudmlzaXQodGhpcyk7XG4gICAgY29uc3QgcmlnaHQgPSBhc3QucmlnaHQudmlzaXQodGhpcyk7XG4gICAgaWYgKGxlZnQgIT09IGFzdC5sZWZ0IHx8IHJpZ2h0ICE9PSBhc3QucmlnaHQpIHtcbiAgICAgIHJldHVybiBuZXcgQmluYXJ5KGFzdC5zcGFuLCBhc3Qub3BlcmF0aW9uLCBsZWZ0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gICAgaWYgKGV4cHJlc3Npb24gIT09IGFzdC5leHByZXNzaW9uKSB7XG4gICAgICByZXR1cm4gbmV3IFByZWZpeE5vdChhc3Quc3BhbiwgZXhwcmVzc2lvbik7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBOb25OdWxsQXNzZXJ0LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgICBpZiAoZXhwcmVzc2lvbiAhPT0gYXN0LmV4cHJlc3Npb24pIHtcbiAgICAgIHJldHVybiBuZXcgTm9uTnVsbEFzc2VydChhc3Quc3BhbiwgZXhwcmVzc2lvbik7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgY29uZGl0aW9uID0gYXN0LmNvbmRpdGlvbi52aXNpdCh0aGlzKTtcbiAgICBjb25zdCB0cnVlRXhwID0gYXN0LnRydWVFeHAudmlzaXQodGhpcyk7XG4gICAgY29uc3QgZmFsc2VFeHAgPSBhc3QuZmFsc2VFeHAudmlzaXQodGhpcyk7XG4gICAgaWYgKGNvbmRpdGlvbiAhPT0gYXN0LmNvbmRpdGlvbiB8fCB0cnVlRXhwICE9PSBhc3QudHJ1ZUV4cCB8fCBmYWxzZUV4cCAhPT0gYXN0LmZhbHNlRXhwKSB7XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKGFzdC5zcGFuLCBjb25kaXRpb24sIHRydWVFeHAsIGZhbHNlRXhwKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cCA9IGFzdC5leHAudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmIChleHAgIT09IGFzdC5leHAgfHwgYXJncyAhPT0gYXN0LmFyZ3MpIHtcbiAgICAgIHJldHVybiBuZXcgQmluZGluZ1BpcGUoYXN0LnNwYW4sIGV4cCwgYXN0Lm5hbWUsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBLZXllZFJlYWQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3Qgb2JqID0gYXN0Lm9iai52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBrZXkgPSBhc3Qua2V5LnZpc2l0KHRoaXMpO1xuICAgIGlmIChvYmogIT09IGFzdC5vYmogfHwga2V5ICE9PSBhc3Qua2V5KSB7XG4gICAgICByZXR1cm4gbmV3IEtleWVkUmVhZChhc3Quc3Bhbiwgb2JqLCBrZXkpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBvYmogPSBhc3Qub2JqLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IGtleSA9IGFzdC5rZXkudmlzaXQodGhpcyk7XG4gICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWUudmlzaXQodGhpcyk7XG4gICAgaWYgKG9iaiAhPT0gYXN0Lm9iaiB8fCBrZXkgIT09IGFzdC5rZXkgfHwgdmFsdWUgIT09IGFzdC52YWx1ZSkge1xuICAgICAgcmV0dXJuIG5ldyBLZXllZFdyaXRlKGFzdC5zcGFuLCBvYmosIGtleSwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRBbGwoYXN0czogYW55W10pOiBhbnlbXSB7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgbGV0IG1vZGlmaWVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3RzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBvcmlnaW5hbCA9IGFzdHNbaV07XG4gICAgICBjb25zdCB2YWx1ZSA9IG9yaWdpbmFsLnZpc2l0KHRoaXMpO1xuICAgICAgcmVzW2ldID0gdmFsdWU7XG4gICAgICBtb2RpZmllZCA9IG1vZGlmaWVkIHx8IHZhbHVlICE9PSBvcmlnaW5hbDtcbiAgICB9XG4gICAgcmV0dXJuIG1vZGlmaWVkID8gcmVzIDogYXN0cztcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTtcbiAgICBpZiAoZXhwcmVzc2lvbnMgIT09IGFzdC5leHByZXNzaW9ucykge1xuICAgICAgcmV0dXJuIG5ldyBDaGFpbihhc3Quc3BhbiwgZXhwcmVzc2lvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBBU1QgeyByZXR1cm4gYXN0OyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2aXNpdEFzdENoaWxkcmVuKGFzdDogQVNULCB2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0PzogYW55KSB7XG4gIGZ1bmN0aW9uIHZpc2l0KGFzdDogQVNUKSB7XG4gICAgdmlzaXRvci52aXNpdCAmJiB2aXNpdG9yLnZpc2l0KGFzdCwgY29udGV4dCkgfHwgYXN0LnZpc2l0KHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gdmlzaXRBbGw8VCBleHRlbmRzIEFTVD4oYXN0czogVFtdKSB7IGFzdHMuZm9yRWFjaCh2aXNpdCk7IH1cblxuICBhc3QudmlzaXQoe1xuICAgIHZpc2l0QmluYXJ5KGFzdCkge1xuICAgICAgdmlzaXQoYXN0LmxlZnQpO1xuICAgICAgdmlzaXQoYXN0LnJpZ2h0KTtcbiAgICB9LFxuICAgIHZpc2l0Q2hhaW4oYXN0KSB7IHZpc2l0QWxsKGFzdC5leHByZXNzaW9ucyk7IH0sXG4gICAgdmlzaXRDb25kaXRpb25hbChhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5jb25kaXRpb24pO1xuICAgICAgdmlzaXQoYXN0LnRydWVFeHApO1xuICAgICAgdmlzaXQoYXN0LmZhbHNlRXhwKTtcbiAgICB9LFxuICAgIHZpc2l0RnVuY3Rpb25DYWxsKGFzdCkge1xuICAgICAgaWYgKGFzdC50YXJnZXQpIHtcbiAgICAgICAgdmlzaXQoYXN0LnRhcmdldCk7XG4gICAgICB9XG4gICAgICB2aXNpdEFsbChhc3QuYXJncyk7XG4gICAgfSxcbiAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0KSB7fSxcbiAgICB2aXNpdEludGVycG9sYXRpb24oYXN0KSB7IHZpc2l0QWxsKGFzdC5leHByZXNzaW9ucyk7IH0sXG4gICAgdmlzaXRLZXllZFJlYWQoYXN0KSB7XG4gICAgICB2aXNpdChhc3Qub2JqKTtcbiAgICAgIHZpc2l0KGFzdC5rZXkpO1xuICAgIH0sXG4gICAgdmlzaXRLZXllZFdyaXRlKGFzdCkge1xuICAgICAgdmlzaXQoYXN0Lm9iaik7XG4gICAgICB2aXNpdChhc3Qua2V5KTtcbiAgICAgIHZpc2l0KGFzdC5vYmopO1xuICAgIH0sXG4gICAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0KSB7IHZpc2l0QWxsKGFzdC5leHByZXNzaW9ucyk7IH0sXG4gICAgdmlzaXRMaXRlcmFsTWFwKGFzdCkge30sXG4gICAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdCkge30sXG4gICAgdmlzaXRNZXRob2RDYWxsKGFzdCkge1xuICAgICAgdmlzaXQoYXN0LnJlY2VpdmVyKTtcbiAgICAgIHZpc2l0QWxsKGFzdC5hcmdzKTtcbiAgICB9LFxuICAgIHZpc2l0UGlwZShhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5leHApO1xuICAgICAgdmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIH0sXG4gICAgdmlzaXRQcmVmaXhOb3QoYXN0KSB7IHZpc2l0KGFzdC5leHByZXNzaW9uKTsgfSxcbiAgICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0KSB7IHZpc2l0KGFzdC5leHByZXNzaW9uKTsgfSxcbiAgICB2aXNpdFByb3BlcnR5UmVhZChhc3QpIHsgdmlzaXQoYXN0LnJlY2VpdmVyKTsgfSxcbiAgICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0KSB7XG4gICAgICB2aXNpdChhc3QucmVjZWl2ZXIpO1xuICAgICAgdmlzaXQoYXN0LnZhbHVlKTtcbiAgICB9LFxuICAgIHZpc2l0UXVvdGUoYXN0KSB7fSxcbiAgICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdCkge1xuICAgICAgdmlzaXQoYXN0LnJlY2VpdmVyKTtcbiAgICAgIHZpc2l0QWxsKGFzdC5hcmdzKTtcbiAgICB9LFxuICAgIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3QpIHsgdmlzaXQoYXN0LnJlY2VpdmVyKTsgfSxcbiAgfSk7XG59XG5cblxuLy8gQmluZGluZ3NcblxuZXhwb3J0IGNsYXNzIFBhcnNlZFByb3BlcnR5IHtcbiAgcHVibGljIHJlYWRvbmx5IGlzTGl0ZXJhbDogYm9vbGVhbjtcbiAgcHVibGljIHJlYWRvbmx5IGlzQW5pbWF0aW9uOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGV4cHJlc3Npb246IEFTVFdpdGhTb3VyY2UsIHB1YmxpYyB0eXBlOiBQYXJzZWRQcm9wZXJ0eVR5cGUsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgdGhpcy5pc0xpdGVyYWwgPSB0aGlzLnR5cGUgPT09IFBhcnNlZFByb3BlcnR5VHlwZS5MSVRFUkFMX0FUVFI7XG4gICAgdGhpcy5pc0FuaW1hdGlvbiA9IHRoaXMudHlwZSA9PT0gUGFyc2VkUHJvcGVydHlUeXBlLkFOSU1BVElPTjtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBQYXJzZWRQcm9wZXJ0eVR5cGUge1xuICBERUZBVUxULFxuICBMSVRFUkFMX0FUVFIsXG4gIEFOSU1BVElPTlxufVxuXG5leHBvcnQgY29uc3QgZW51bSBQYXJzZWRFdmVudFR5cGUge1xuICAvLyBET00gb3IgRGlyZWN0aXZlIGV2ZW50XG4gIFJlZ3VsYXIsXG4gIC8vIEFuaW1hdGlvbiBzcGVjaWZpYyBldmVudFxuICBBbmltYXRpb24sXG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZWRFdmVudCB7XG4gIC8vIFJlZ3VsYXIgZXZlbnRzIGhhdmUgYSB0YXJnZXRcbiAgLy8gQW5pbWF0aW9uIGV2ZW50cyBoYXZlIGEgcGhhc2VcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdGFyZ2V0T3JQaGFzZTogc3RyaW5nLCBwdWJsaWMgdHlwZTogUGFyc2VkRXZlbnRUeXBlLFxuICAgICAgcHVibGljIGhhbmRsZXI6IEFTVCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VkVmFyaWFibGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQmluZGluZ1R5cGUge1xuICAvLyBBIHJlZ3VsYXIgYmluZGluZyB0byBhIHByb3BlcnR5IChlLmcuIGBbcHJvcGVydHldPVwiZXhwcmVzc2lvblwiYCkuXG4gIFByb3BlcnR5LFxuICAvLyBBIGJpbmRpbmcgdG8gYW4gZWxlbWVudCBhdHRyaWJ1dGUgKGUuZy4gYFthdHRyLm5hbWVdPVwiZXhwcmVzc2lvblwiYCkuXG4gIEF0dHJpYnV0ZSxcbiAgLy8gQSBiaW5kaW5nIHRvIGEgQ1NTIGNsYXNzIChlLmcuIGBbY2xhc3MubmFtZV09XCJjb25kaXRpb25cImApLlxuICBDbGFzcyxcbiAgLy8gQSBiaW5kaW5nIHRvIGEgc3R5bGUgcnVsZSAoZS5nLiBgW3N0eWxlLnJ1bGVdPVwiZXhwcmVzc2lvblwiYCkuXG4gIFN0eWxlLFxuICAvLyBBIGJpbmRpbmcgdG8gYW4gYW5pbWF0aW9uIHJlZmVyZW5jZSAoZS5nLiBgW2FuaW1hdGUua2V5XT1cImV4cHJlc3Npb25cImApLlxuICBBbmltYXRpb24sXG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZEVsZW1lbnRQcm9wZXJ0eSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IEJpbmRpbmdUeXBlLCBwdWJsaWMgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgICBwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIHVuaXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3Bhbikge31cbn1cbiJdfQ==