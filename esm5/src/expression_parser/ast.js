/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
var ParserError = /** @class */ (function () {
    function ParserError(message, input, errLocation, ctxLocation) {
        this.input = input;
        this.errLocation = errLocation;
        this.ctxLocation = ctxLocation;
        this.message = "Parser Error: " + message + " " + errLocation + " [" + input + "] in " + ctxLocation;
    }
    return ParserError;
}());
export { ParserError };
var ParseSpan = /** @class */ (function () {
    function ParseSpan(start, end) {
        this.start = start;
        this.end = end;
    }
    return ParseSpan;
}());
export { ParseSpan };
var AST = /** @class */ (function () {
    function AST(span) {
        this.span = span;
    }
    AST.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return null;
    };
    AST.prototype.toString = function () { return 'AST'; };
    return AST;
}());
export { AST };
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
var Quote = /** @class */ (function (_super) {
    tslib_1.__extends(Quote, _super);
    function Quote(span, prefix, uninterpretedExpression, location) {
        var _this = _super.call(this, span) || this;
        _this.prefix = prefix;
        _this.uninterpretedExpression = uninterpretedExpression;
        _this.location = location;
        return _this;
    }
    Quote.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitQuote(this, context);
    };
    Quote.prototype.toString = function () { return 'Quote'; };
    return Quote;
}(AST));
export { Quote };
var EmptyExpr = /** @class */ (function (_super) {
    tslib_1.__extends(EmptyExpr, _super);
    function EmptyExpr() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyExpr.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        // do nothing
    };
    return EmptyExpr;
}(AST));
export { EmptyExpr };
var ImplicitReceiver = /** @class */ (function (_super) {
    tslib_1.__extends(ImplicitReceiver, _super);
    function ImplicitReceiver() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ImplicitReceiver.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitImplicitReceiver(this, context);
    };
    return ImplicitReceiver;
}(AST));
export { ImplicitReceiver };
/**
 * Multiple expressions separated by a semicolon.
 */
var Chain = /** @class */ (function (_super) {
    tslib_1.__extends(Chain, _super);
    function Chain(span, expressions) {
        var _this = _super.call(this, span) || this;
        _this.expressions = expressions;
        return _this;
    }
    Chain.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitChain(this, context);
    };
    return Chain;
}(AST));
export { Chain };
var Conditional = /** @class */ (function (_super) {
    tslib_1.__extends(Conditional, _super);
    function Conditional(span, condition, trueExp, falseExp) {
        var _this = _super.call(this, span) || this;
        _this.condition = condition;
        _this.trueExp = trueExp;
        _this.falseExp = falseExp;
        return _this;
    }
    Conditional.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitConditional(this, context);
    };
    return Conditional;
}(AST));
export { Conditional };
var PropertyRead = /** @class */ (function (_super) {
    tslib_1.__extends(PropertyRead, _super);
    function PropertyRead(span, receiver, name) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        return _this;
    }
    PropertyRead.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPropertyRead(this, context);
    };
    return PropertyRead;
}(AST));
export { PropertyRead };
var PropertyWrite = /** @class */ (function (_super) {
    tslib_1.__extends(PropertyWrite, _super);
    function PropertyWrite(span, receiver, name, value) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.value = value;
        return _this;
    }
    PropertyWrite.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPropertyWrite(this, context);
    };
    return PropertyWrite;
}(AST));
export { PropertyWrite };
var SafePropertyRead = /** @class */ (function (_super) {
    tslib_1.__extends(SafePropertyRead, _super);
    function SafePropertyRead(span, receiver, name) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        return _this;
    }
    SafePropertyRead.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitSafePropertyRead(this, context);
    };
    return SafePropertyRead;
}(AST));
export { SafePropertyRead };
var KeyedRead = /** @class */ (function (_super) {
    tslib_1.__extends(KeyedRead, _super);
    function KeyedRead(span, obj, key) {
        var _this = _super.call(this, span) || this;
        _this.obj = obj;
        _this.key = key;
        return _this;
    }
    KeyedRead.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitKeyedRead(this, context);
    };
    return KeyedRead;
}(AST));
export { KeyedRead };
var KeyedWrite = /** @class */ (function (_super) {
    tslib_1.__extends(KeyedWrite, _super);
    function KeyedWrite(span, obj, key, value) {
        var _this = _super.call(this, span) || this;
        _this.obj = obj;
        _this.key = key;
        _this.value = value;
        return _this;
    }
    KeyedWrite.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitKeyedWrite(this, context);
    };
    return KeyedWrite;
}(AST));
export { KeyedWrite };
var BindingPipe = /** @class */ (function (_super) {
    tslib_1.__extends(BindingPipe, _super);
    function BindingPipe(span, exp, name, args) {
        var _this = _super.call(this, span) || this;
        _this.exp = exp;
        _this.name = name;
        _this.args = args;
        return _this;
    }
    BindingPipe.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPipe(this, context);
    };
    return BindingPipe;
}(AST));
export { BindingPipe };
var LiteralPrimitive = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralPrimitive, _super);
    function LiteralPrimitive(span, value) {
        var _this = _super.call(this, span) || this;
        _this.value = value;
        return _this;
    }
    LiteralPrimitive.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitLiteralPrimitive(this, context);
    };
    return LiteralPrimitive;
}(AST));
export { LiteralPrimitive };
var LiteralArray = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralArray, _super);
    function LiteralArray(span, expressions) {
        var _this = _super.call(this, span) || this;
        _this.expressions = expressions;
        return _this;
    }
    LiteralArray.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitLiteralArray(this, context);
    };
    return LiteralArray;
}(AST));
export { LiteralArray };
var LiteralMap = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralMap, _super);
    function LiteralMap(span, keys, values) {
        var _this = _super.call(this, span) || this;
        _this.keys = keys;
        _this.values = values;
        return _this;
    }
    LiteralMap.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitLiteralMap(this, context);
    };
    return LiteralMap;
}(AST));
export { LiteralMap };
var Interpolation = /** @class */ (function (_super) {
    tslib_1.__extends(Interpolation, _super);
    function Interpolation(span, strings, expressions) {
        var _this = _super.call(this, span) || this;
        _this.strings = strings;
        _this.expressions = expressions;
        return _this;
    }
    Interpolation.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitInterpolation(this, context);
    };
    return Interpolation;
}(AST));
export { Interpolation };
var Binary = /** @class */ (function (_super) {
    tslib_1.__extends(Binary, _super);
    function Binary(span, operation, left, right) {
        var _this = _super.call(this, span) || this;
        _this.operation = operation;
        _this.left = left;
        _this.right = right;
        return _this;
    }
    Binary.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitBinary(this, context);
    };
    return Binary;
}(AST));
export { Binary };
var PrefixNot = /** @class */ (function (_super) {
    tslib_1.__extends(PrefixNot, _super);
    function PrefixNot(span, expression) {
        var _this = _super.call(this, span) || this;
        _this.expression = expression;
        return _this;
    }
    PrefixNot.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPrefixNot(this, context);
    };
    return PrefixNot;
}(AST));
export { PrefixNot };
var NonNullAssert = /** @class */ (function (_super) {
    tslib_1.__extends(NonNullAssert, _super);
    function NonNullAssert(span, expression) {
        var _this = _super.call(this, span) || this;
        _this.expression = expression;
        return _this;
    }
    NonNullAssert.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitNonNullAssert(this, context);
    };
    return NonNullAssert;
}(AST));
export { NonNullAssert };
var MethodCall = /** @class */ (function (_super) {
    tslib_1.__extends(MethodCall, _super);
    function MethodCall(span, receiver, name, args) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.args = args;
        return _this;
    }
    MethodCall.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitMethodCall(this, context);
    };
    return MethodCall;
}(AST));
export { MethodCall };
var SafeMethodCall = /** @class */ (function (_super) {
    tslib_1.__extends(SafeMethodCall, _super);
    function SafeMethodCall(span, receiver, name, args) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.args = args;
        return _this;
    }
    SafeMethodCall.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitSafeMethodCall(this, context);
    };
    return SafeMethodCall;
}(AST));
export { SafeMethodCall };
var FunctionCall = /** @class */ (function (_super) {
    tslib_1.__extends(FunctionCall, _super);
    function FunctionCall(span, target, args) {
        var _this = _super.call(this, span) || this;
        _this.target = target;
        _this.args = args;
        return _this;
    }
    FunctionCall.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitFunctionCall(this, context);
    };
    return FunctionCall;
}(AST));
export { FunctionCall };
/**
 * Records the absolute position of a text span in a source file, where `start` and `end` are the
 * starting and ending byte offsets, respectively, of the text span in a source file.
 */
var AbsoluteSourceSpan = /** @class */ (function () {
    function AbsoluteSourceSpan(start, end) {
        this.start = start;
        this.end = end;
    }
    return AbsoluteSourceSpan;
}());
export { AbsoluteSourceSpan };
var ASTWithSource = /** @class */ (function (_super) {
    tslib_1.__extends(ASTWithSource, _super);
    function ASTWithSource(ast, source, location, absoluteOffset, errors) {
        var _this = _super.call(this, new ParseSpan(0, source == null ? 0 : source.length)) || this;
        _this.ast = ast;
        _this.source = source;
        _this.location = location;
        _this.errors = errors;
        _this.sourceSpan = new AbsoluteSourceSpan(absoluteOffset, absoluteOffset + _this.span.end);
        return _this;
    }
    ASTWithSource.prototype.visit = function (visitor, context) {
        if (context === void 0) { context = null; }
        if (visitor.visitASTWithSource) {
            return visitor.visitASTWithSource(this, context);
        }
        return this.ast.visit(visitor, context);
    };
    ASTWithSource.prototype.toString = function () { return this.source + " in " + this.location; };
    return ASTWithSource;
}(AST));
export { ASTWithSource };
var TemplateBinding = /** @class */ (function () {
    function TemplateBinding(span, key, keyIsVar, name, expression) {
        this.span = span;
        this.key = key;
        this.keyIsVar = keyIsVar;
        this.name = name;
        this.expression = expression;
    }
    return TemplateBinding;
}());
export { TemplateBinding };
var NullAstVisitor = /** @class */ (function () {
    function NullAstVisitor() {
    }
    NullAstVisitor.prototype.visitBinary = function (ast, context) { };
    NullAstVisitor.prototype.visitChain = function (ast, context) { };
    NullAstVisitor.prototype.visitConditional = function (ast, context) { };
    NullAstVisitor.prototype.visitFunctionCall = function (ast, context) { };
    NullAstVisitor.prototype.visitImplicitReceiver = function (ast, context) { };
    NullAstVisitor.prototype.visitInterpolation = function (ast, context) { };
    NullAstVisitor.prototype.visitKeyedRead = function (ast, context) { };
    NullAstVisitor.prototype.visitKeyedWrite = function (ast, context) { };
    NullAstVisitor.prototype.visitLiteralArray = function (ast, context) { };
    NullAstVisitor.prototype.visitLiteralMap = function (ast, context) { };
    NullAstVisitor.prototype.visitLiteralPrimitive = function (ast, context) { };
    NullAstVisitor.prototype.visitMethodCall = function (ast, context) { };
    NullAstVisitor.prototype.visitPipe = function (ast, context) { };
    NullAstVisitor.prototype.visitPrefixNot = function (ast, context) { };
    NullAstVisitor.prototype.visitNonNullAssert = function (ast, context) { };
    NullAstVisitor.prototype.visitPropertyRead = function (ast, context) { };
    NullAstVisitor.prototype.visitPropertyWrite = function (ast, context) { };
    NullAstVisitor.prototype.visitQuote = function (ast, context) { };
    NullAstVisitor.prototype.visitSafeMethodCall = function (ast, context) { };
    NullAstVisitor.prototype.visitSafePropertyRead = function (ast, context) { };
    return NullAstVisitor;
}());
export { NullAstVisitor };
var RecursiveAstVisitor = /** @class */ (function () {
    function RecursiveAstVisitor() {
    }
    RecursiveAstVisitor.prototype.visitBinary = function (ast, context) {
        ast.left.visit(this, context);
        ast.right.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitChain = function (ast, context) { return this.visitAll(ast.expressions, context); };
    RecursiveAstVisitor.prototype.visitConditional = function (ast, context) {
        ast.condition.visit(this, context);
        ast.trueExp.visit(this, context);
        ast.falseExp.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitPipe = function (ast, context) {
        ast.exp.visit(this, context);
        this.visitAll(ast.args, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitFunctionCall = function (ast, context) {
        ast.target.visit(this, context);
        this.visitAll(ast.args, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitImplicitReceiver = function (ast, context) { return null; };
    RecursiveAstVisitor.prototype.visitInterpolation = function (ast, context) {
        return this.visitAll(ast.expressions, context);
    };
    RecursiveAstVisitor.prototype.visitKeyedRead = function (ast, context) {
        ast.obj.visit(this, context);
        ast.key.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitKeyedWrite = function (ast, context) {
        ast.obj.visit(this, context);
        ast.key.visit(this, context);
        ast.value.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitLiteralArray = function (ast, context) {
        return this.visitAll(ast.expressions, context);
    };
    RecursiveAstVisitor.prototype.visitLiteralMap = function (ast, context) { return this.visitAll(ast.values, context); };
    RecursiveAstVisitor.prototype.visitLiteralPrimitive = function (ast, context) { return null; };
    RecursiveAstVisitor.prototype.visitMethodCall = function (ast, context) {
        ast.receiver.visit(this, context);
        return this.visitAll(ast.args, context);
    };
    RecursiveAstVisitor.prototype.visitPrefixNot = function (ast, context) {
        ast.expression.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitNonNullAssert = function (ast, context) {
        ast.expression.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitPropertyRead = function (ast, context) {
        ast.receiver.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitPropertyWrite = function (ast, context) {
        ast.receiver.visit(this, context);
        ast.value.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitSafePropertyRead = function (ast, context) {
        ast.receiver.visit(this, context);
        return null;
    };
    RecursiveAstVisitor.prototype.visitSafeMethodCall = function (ast, context) {
        ast.receiver.visit(this, context);
        return this.visitAll(ast.args, context);
    };
    RecursiveAstVisitor.prototype.visitAll = function (asts, context) {
        var _this = this;
        asts.forEach(function (ast) { return ast.visit(_this, context); });
        return null;
    };
    RecursiveAstVisitor.prototype.visitQuote = function (ast, context) { return null; };
    return RecursiveAstVisitor;
}());
export { RecursiveAstVisitor };
var AstTransformer = /** @class */ (function () {
    function AstTransformer() {
    }
    AstTransformer.prototype.visitImplicitReceiver = function (ast, context) { return ast; };
    AstTransformer.prototype.visitInterpolation = function (ast, context) {
        return new Interpolation(ast.span, ast.strings, this.visitAll(ast.expressions));
    };
    AstTransformer.prototype.visitLiteralPrimitive = function (ast, context) {
        return new LiteralPrimitive(ast.span, ast.value);
    };
    AstTransformer.prototype.visitPropertyRead = function (ast, context) {
        return new PropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    };
    AstTransformer.prototype.visitPropertyWrite = function (ast, context) {
        return new PropertyWrite(ast.span, ast.receiver.visit(this), ast.name, ast.value.visit(this));
    };
    AstTransformer.prototype.visitSafePropertyRead = function (ast, context) {
        return new SafePropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    };
    AstTransformer.prototype.visitMethodCall = function (ast, context) {
        return new MethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitSafeMethodCall = function (ast, context) {
        return new SafeMethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitFunctionCall = function (ast, context) {
        return new FunctionCall(ast.span, ast.target.visit(this), this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitLiteralArray = function (ast, context) {
        return new LiteralArray(ast.span, this.visitAll(ast.expressions));
    };
    AstTransformer.prototype.visitLiteralMap = function (ast, context) {
        return new LiteralMap(ast.span, ast.keys, this.visitAll(ast.values));
    };
    AstTransformer.prototype.visitBinary = function (ast, context) {
        return new Binary(ast.span, ast.operation, ast.left.visit(this), ast.right.visit(this));
    };
    AstTransformer.prototype.visitPrefixNot = function (ast, context) {
        return new PrefixNot(ast.span, ast.expression.visit(this));
    };
    AstTransformer.prototype.visitNonNullAssert = function (ast, context) {
        return new NonNullAssert(ast.span, ast.expression.visit(this));
    };
    AstTransformer.prototype.visitConditional = function (ast, context) {
        return new Conditional(ast.span, ast.condition.visit(this), ast.trueExp.visit(this), ast.falseExp.visit(this));
    };
    AstTransformer.prototype.visitPipe = function (ast, context) {
        return new BindingPipe(ast.span, ast.exp.visit(this), ast.name, this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitKeyedRead = function (ast, context) {
        return new KeyedRead(ast.span, ast.obj.visit(this), ast.key.visit(this));
    };
    AstTransformer.prototype.visitKeyedWrite = function (ast, context) {
        return new KeyedWrite(ast.span, ast.obj.visit(this), ast.key.visit(this), ast.value.visit(this));
    };
    AstTransformer.prototype.visitAll = function (asts) {
        var res = [];
        for (var i = 0; i < asts.length; ++i) {
            res[i] = asts[i].visit(this);
        }
        return res;
    };
    AstTransformer.prototype.visitChain = function (ast, context) {
        return new Chain(ast.span, this.visitAll(ast.expressions));
    };
    AstTransformer.prototype.visitQuote = function (ast, context) {
        return new Quote(ast.span, ast.prefix, ast.uninterpretedExpression, ast.location);
    };
    return AstTransformer;
}());
export { AstTransformer };
// A transformer that only creates new nodes if the transformer makes a change or
// a change is made a child node.
var AstMemoryEfficientTransformer = /** @class */ (function () {
    function AstMemoryEfficientTransformer() {
    }
    AstMemoryEfficientTransformer.prototype.visitImplicitReceiver = function (ast, context) { return ast; };
    AstMemoryEfficientTransformer.prototype.visitInterpolation = function (ast, context) {
        var expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions)
            return new Interpolation(ast.span, ast.strings, expressions);
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitLiteralPrimitive = function (ast, context) { return ast; };
    AstMemoryEfficientTransformer.prototype.visitPropertyRead = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new PropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitPropertyWrite = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        var value = ast.value.visit(this);
        if (receiver !== ast.receiver || value !== ast.value) {
            return new PropertyWrite(ast.span, receiver, ast.name, value);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitSafePropertyRead = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new SafePropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitMethodCall = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        var args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new MethodCall(ast.span, receiver, ast.name, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitSafeMethodCall = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        var args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new SafeMethodCall(ast.span, receiver, ast.name, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitFunctionCall = function (ast, context) {
        var target = ast.target && ast.target.visit(this);
        var args = this.visitAll(ast.args);
        if (target !== ast.target || args !== ast.args) {
            return new FunctionCall(ast.span, target, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitLiteralArray = function (ast, context) {
        var expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new LiteralArray(ast.span, expressions);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitLiteralMap = function (ast, context) {
        var values = this.visitAll(ast.values);
        if (values !== ast.values) {
            return new LiteralMap(ast.span, ast.keys, values);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitBinary = function (ast, context) {
        var left = ast.left.visit(this);
        var right = ast.right.visit(this);
        if (left !== ast.left || right !== ast.right) {
            return new Binary(ast.span, ast.operation, left, right);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitPrefixNot = function (ast, context) {
        var expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new PrefixNot(ast.span, expression);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitNonNullAssert = function (ast, context) {
        var expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new NonNullAssert(ast.span, expression);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitConditional = function (ast, context) {
        var condition = ast.condition.visit(this);
        var trueExp = ast.trueExp.visit(this);
        var falseExp = ast.falseExp.visit(this);
        if (condition !== ast.condition || trueExp !== ast.trueExp || falseExp !== ast.falseExp) {
            return new Conditional(ast.span, condition, trueExp, falseExp);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitPipe = function (ast, context) {
        var exp = ast.exp.visit(this);
        var args = this.visitAll(ast.args);
        if (exp !== ast.exp || args !== ast.args) {
            return new BindingPipe(ast.span, exp, ast.name, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitKeyedRead = function (ast, context) {
        var obj = ast.obj.visit(this);
        var key = ast.key.visit(this);
        if (obj !== ast.obj || key !== ast.key) {
            return new KeyedRead(ast.span, obj, key);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitKeyedWrite = function (ast, context) {
        var obj = ast.obj.visit(this);
        var key = ast.key.visit(this);
        var value = ast.value.visit(this);
        if (obj !== ast.obj || key !== ast.key || value !== ast.value) {
            return new KeyedWrite(ast.span, obj, key, value);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitAll = function (asts) {
        var res = [];
        var modified = false;
        for (var i = 0; i < asts.length; ++i) {
            var original = asts[i];
            var value = original.visit(this);
            res[i] = value;
            modified = modified || value !== original;
        }
        return modified ? res : asts;
    };
    AstMemoryEfficientTransformer.prototype.visitChain = function (ast, context) {
        var expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new Chain(ast.span, expressions);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitQuote = function (ast, context) { return ast; };
    return AstMemoryEfficientTransformer;
}());
export { AstMemoryEfficientTransformer };
export function visitAstChildren(ast, visitor, context) {
    function visit(ast) {
        visitor.visit && visitor.visit(ast, context) || ast.visit(visitor, context);
    }
    function visitAll(asts) { asts.forEach(visit); }
    ast.visit({
        visitBinary: function (ast) {
            visit(ast.left);
            visit(ast.right);
        },
        visitChain: function (ast) { visitAll(ast.expressions); },
        visitConditional: function (ast) {
            visit(ast.condition);
            visit(ast.trueExp);
            visit(ast.falseExp);
        },
        visitFunctionCall: function (ast) {
            if (ast.target) {
                visit(ast.target);
            }
            visitAll(ast.args);
        },
        visitImplicitReceiver: function (ast) { },
        visitInterpolation: function (ast) { visitAll(ast.expressions); },
        visitKeyedRead: function (ast) {
            visit(ast.obj);
            visit(ast.key);
        },
        visitKeyedWrite: function (ast) {
            visit(ast.obj);
            visit(ast.key);
            visit(ast.obj);
        },
        visitLiteralArray: function (ast) { visitAll(ast.expressions); },
        visitLiteralMap: function (ast) { },
        visitLiteralPrimitive: function (ast) { },
        visitMethodCall: function (ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        visitPipe: function (ast) {
            visit(ast.exp);
            visitAll(ast.args);
        },
        visitPrefixNot: function (ast) { visit(ast.expression); },
        visitNonNullAssert: function (ast) { visit(ast.expression); },
        visitPropertyRead: function (ast) { visit(ast.receiver); },
        visitPropertyWrite: function (ast) {
            visit(ast.receiver);
            visit(ast.value);
        },
        visitQuote: function (ast) { },
        visitSafeMethodCall: function (ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        visitSafePropertyRead: function (ast) { visit(ast.receiver); },
    });
}
// Bindings
var ParsedProperty = /** @class */ (function () {
    function ParsedProperty(name, expression, type, sourceSpan, valueSpan) {
        this.name = name;
        this.expression = expression;
        this.type = type;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
        this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
        this.isAnimation = this.type === ParsedPropertyType.ANIMATION;
    }
    return ParsedProperty;
}());
export { ParsedProperty };
export var ParsedPropertyType;
(function (ParsedPropertyType) {
    ParsedPropertyType[ParsedPropertyType["DEFAULT"] = 0] = "DEFAULT";
    ParsedPropertyType[ParsedPropertyType["LITERAL_ATTR"] = 1] = "LITERAL_ATTR";
    ParsedPropertyType[ParsedPropertyType["ANIMATION"] = 2] = "ANIMATION";
})(ParsedPropertyType || (ParsedPropertyType = {}));
var ParsedEvent = /** @class */ (function () {
    // Regular events have a target
    // Animation events have a phase
    function ParsedEvent(name, targetOrPhase, type, handler, sourceSpan, handlerSpan) {
        this.name = name;
        this.targetOrPhase = targetOrPhase;
        this.type = type;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
        this.handlerSpan = handlerSpan;
    }
    return ParsedEvent;
}());
export { ParsedEvent };
var ParsedVariable = /** @class */ (function () {
    function ParsedVariable(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    return ParsedVariable;
}());
export { ParsedVariable };
var BoundElementProperty = /** @class */ (function () {
    function BoundElementProperty(name, type, securityContext, value, unit, sourceSpan, valueSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
    }
    return BoundElementProperty;
}());
export { BoundElementProperty };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBS0g7SUFFRSxxQkFDSSxPQUFlLEVBQVMsS0FBYSxFQUFTLFdBQW1CLEVBQVMsV0FBaUI7UUFBbkUsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQU07UUFDN0YsSUFBSSxDQUFDLE9BQU8sR0FBRyxtQkFBaUIsT0FBTyxTQUFJLFdBQVcsVUFBSyxLQUFLLGFBQVEsV0FBYSxDQUFDO0lBQ3hGLENBQUM7SUFDSCxrQkFBQztBQUFELENBQUMsQUFORCxJQU1DOztBQUVEO0lBQ0UsbUJBQW1CLEtBQWEsRUFBUyxHQUFXO1FBQWpDLFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxRQUFHLEdBQUgsR0FBRyxDQUFRO0lBQUcsQ0FBQztJQUMxRCxnQkFBQztBQUFELENBQUMsQUFGRCxJQUVDOztBQUVEO0lBQ0UsYUFBbUIsSUFBZTtRQUFmLFNBQUksR0FBSixJQUFJLENBQVc7SUFBRyxDQUFDO0lBQ3RDLG1CQUFLLEdBQUwsVUFBTSxPQUFtQixFQUFFLE9BQW1CO1FBQW5CLHdCQUFBLEVBQUEsY0FBbUI7UUFBUyxPQUFPLElBQUksQ0FBQztJQUFDLENBQUM7SUFDckUsc0JBQVEsR0FBUixjQUFxQixPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDdEMsVUFBQztBQUFELENBQUMsQUFKRCxJQUlDOztBQUVEOzs7Ozs7Ozs7Ozs7R0FZRztBQUNIO0lBQTJCLGlDQUFHO0lBQzVCLGVBQ0ksSUFBZSxFQUFTLE1BQWMsRUFBUyx1QkFBK0IsRUFDdkUsUUFBYTtRQUZ4QixZQUdFLGtCQUFNLElBQUksQ0FBQyxTQUNaO1FBSDJC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QixFQUN4RSxTQUEyQjtRQUYzQixTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBYTtRQUFTLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUMvRSxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBYTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ3hFLGNBQVMsR0FBVCxTQUFTLENBQWtCO0lBQUcsQ0FBQztJQUM1QywyQkFBQztBQUFELENBQUMsQUFMRCxJQUtDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXJFcnJvciB7XG4gIHB1YmxpYyBtZXNzYWdlOiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgbWVzc2FnZTogc3RyaW5nLCBwdWJsaWMgaW5wdXQ6IHN0cmluZywgcHVibGljIGVyckxvY2F0aW9uOiBzdHJpbmcsIHB1YmxpYyBjdHhMb2NhdGlvbj86IGFueSkge1xuICAgIHRoaXMubWVzc2FnZSA9IGBQYXJzZXIgRXJyb3I6ICR7bWVzc2FnZX0gJHtlcnJMb2NhdGlvbn0gWyR7aW5wdXR9XSBpbiAke2N0eExvY2F0aW9ufWA7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlU3BhbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzdGFydDogbnVtYmVyLCBwdWJsaWMgZW5kOiBudW1iZXIpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3BhbjogUGFyc2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHsgcmV0dXJuIG51bGw7IH1cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHsgcmV0dXJuICdBU1QnOyB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHF1b3RlZCBleHByZXNzaW9uIG9mIHRoZSBmb3JtOlxuICpcbiAqIHF1b3RlID0gcHJlZml4IGA6YCB1bmludGVycHJldGVkRXhwcmVzc2lvblxuICogcHJlZml4ID0gaWRlbnRpZmllclxuICogdW5pbnRlcnByZXRlZEV4cHJlc3Npb24gPSBhcmJpdHJhcnkgc3RyaW5nXG4gKlxuICogQSBxdW90ZWQgZXhwcmVzc2lvbiBpcyBtZWFudCB0byBiZSBwcmUtcHJvY2Vzc2VkIGJ5IGFuIEFTVCB0cmFuc2Zvcm1lciB0aGF0XG4gKiBjb252ZXJ0cyBpdCBpbnRvIGFub3RoZXIgQVNUIHRoYXQgbm8gbG9uZ2VyIGNvbnRhaW5zIHF1b3RlZCBleHByZXNzaW9ucy5cbiAqIEl0IGlzIG1lYW50IHRvIGFsbG93IHRoaXJkLXBhcnR5IGRldmVsb3BlcnMgdG8gZXh0ZW5kIEFuZ3VsYXIgdGVtcGxhdGVcbiAqIGV4cHJlc3Npb24gbGFuZ3VhZ2UuIFRoZSBgdW5pbnRlcnByZXRlZEV4cHJlc3Npb25gIHBhcnQgb2YgdGhlIHF1b3RlIGlzXG4gKiB0aGVyZWZvcmUgbm90IGludGVycHJldGVkIGJ5IHRoZSBBbmd1bGFyJ3Mgb3duIGV4cHJlc3Npb24gcGFyc2VyLlxuICovXG5leHBvcnQgY2xhc3MgUXVvdGUgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNwYW46IFBhcnNlU3BhbiwgcHVibGljIHByZWZpeDogc3RyaW5nLCBwdWJsaWMgdW5pbnRlcnByZXRlZEV4cHJlc3Npb246IHN0cmluZyxcbiAgICAgIHB1YmxpYyBsb2NhdGlvbjogYW55KSB7XG4gICAgc3VwZXIoc3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0UXVvdGUodGhpcywgY29udGV4dCk7IH1cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHsgcmV0dXJuICdRdW90ZSc7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEVtcHR5RXhwciBleHRlbmRzIEFTVCB7XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpIHtcbiAgICAvLyBkbyBub3RoaW5nXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEltcGxpY2l0UmVjZWl2ZXIgZXh0ZW5kcyBBU1Qge1xuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEltcGxpY2l0UmVjZWl2ZXIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBNdWx0aXBsZSBleHByZXNzaW9ucyBzZXBhcmF0ZWQgYnkgYSBzZW1pY29sb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBDaGFpbiBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIGV4cHJlc3Npb25zOiBhbnlbXSkgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRDaGFpbih0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29uZGl0aW9uYWwgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBjb25kaXRpb246IEFTVCwgcHVibGljIHRydWVFeHA6IEFTVCwgcHVibGljIGZhbHNlRXhwOiBBU1QpIHtcbiAgICBzdXBlcihzcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbmRpdGlvbmFsKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9wZXJ0eVJlYWQgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyByZWNlaXZlcjogQVNULCBwdWJsaWMgbmFtZTogc3RyaW5nKSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UHJvcGVydHlSZWFkKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9wZXJ0eVdyaXRlIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgcmVjZWl2ZXI6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBBU1QpIHtcbiAgICBzdXBlcihzcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFByb3BlcnR5V3JpdGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVQcm9wZXJ0eVJlYWQgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyByZWNlaXZlcjogQVNULCBwdWJsaWMgbmFtZTogc3RyaW5nKSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U2FmZVByb3BlcnR5UmVhZCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgS2V5ZWRSZWFkIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgb2JqOiBBU1QsIHB1YmxpYyBrZXk6IEFTVCkgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEtleWVkUmVhZCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgS2V5ZWRXcml0ZSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIG9iajogQVNULCBwdWJsaWMga2V5OiBBU1QsIHB1YmxpYyB2YWx1ZTogQVNUKSB7IHN1cGVyKHNwYW4pOyB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0S2V5ZWRXcml0ZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1BpcGUgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBleHA6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGFyZ3M6IGFueVtdKSB7XG4gICAgc3VwZXIoc3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0UGlwZSh0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbFByaW1pdGl2ZSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIHZhbHVlOiBhbnkpIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsUHJpbWl0aXZlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsQXJyYXkgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBleHByZXNzaW9uczogYW55W10pIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsQXJyYXkodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTGl0ZXJhbE1hcEtleSA9IHtcbiAga2V5OiBzdHJpbmc7IHF1b3RlZDogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMga2V5czogTGl0ZXJhbE1hcEtleVtdLCBwdWJsaWMgdmFsdWVzOiBhbnlbXSkgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExpdGVyYWxNYXAodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb24gZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBzdHJpbmdzOiBhbnlbXSwgcHVibGljIGV4cHJlc3Npb25zOiBhbnlbXSkgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEludGVycG9sYXRpb24odGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJpbmFyeSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIG9wZXJhdGlvbjogc3RyaW5nLCBwdWJsaWMgbGVmdDogQVNULCBwdWJsaWMgcmlnaHQ6IEFTVCkge1xuICAgIHN1cGVyKHNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QmluYXJ5KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcmVmaXhOb3QgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBleHByZXNzaW9uOiBBU1QpIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRQcmVmaXhOb3QodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vbk51bGxBc3NlcnQgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHB1YmxpYyBleHByZXNzaW9uOiBBU1QpIHsgc3VwZXIoc3Bhbik7IH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXROb25OdWxsQXNzZXJ0KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZXRob2RDYWxsIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMgcmVjZWl2ZXI6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGFyZ3M6IGFueVtdKSB7XG4gICAgc3VwZXIoc3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRNZXRob2RDYWxsKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlTWV0aG9kQ2FsbCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIHJlY2VpdmVyOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBhcmdzOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U2FmZU1ldGhvZENhbGwodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZ1bmN0aW9uQ2FsbCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3BhbiwgcHVibGljIHRhcmdldDogQVNUfG51bGwsIHB1YmxpYyBhcmdzOiBhbnlbXSkgeyBzdXBlcihzcGFuKTsgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEZ1bmN0aW9uQ2FsbCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIFJlY29yZHMgdGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIGEgdGV4dCBzcGFuIGluIGEgc291cmNlIGZpbGUsIHdoZXJlIGBzdGFydGAgYW5kIGBlbmRgIGFyZSB0aGVcbiAqIHN0YXJ0aW5nIGFuZCBlbmRpbmcgYnl0ZSBvZmZzZXRzLCByZXNwZWN0aXZlbHksIG9mIHRoZSB0ZXh0IHNwYW4gaW4gYSBzb3VyY2UgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEFic29sdXRlU291cmNlU3BhbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzdGFydDogbnVtYmVyLCBwdWJsaWMgZW5kOiBudW1iZXIpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBBU1RXaXRoU291cmNlIGV4dGVuZHMgQVNUIHtcbiAgcHVibGljIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYXN0OiBBU1QsIHB1YmxpYyBzb3VyY2U6IHN0cmluZ3xudWxsLCBwdWJsaWMgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlckVycm9yW10pIHtcbiAgICBzdXBlcihuZXcgUGFyc2VTcGFuKDAsIHNvdXJjZSA9PSBudWxsID8gMCA6IHNvdXJjZS5sZW5ndGgpKTtcbiAgICB0aGlzLnNvdXJjZVNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKGFic29sdXRlT2Zmc2V0LCBhYnNvbHV0ZU9mZnNldCArIHRoaXMuc3Bhbi5lbmQpO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIGlmICh2aXNpdG9yLnZpc2l0QVNUV2l0aFNvdXJjZSkge1xuICAgICAgcmV0dXJuIHZpc2l0b3IudmlzaXRBU1RXaXRoU291cmNlKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hc3QudmlzaXQodmlzaXRvciwgY29udGV4dCk7XG4gIH1cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHsgcmV0dXJuIGAke3RoaXMuc291cmNlfSBpbiAke3RoaXMubG9jYXRpb259YDsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3BhbjogUGFyc2VTcGFuLCBwdWJsaWMga2V5OiBzdHJpbmcsIHB1YmxpYyBrZXlJc1ZhcjogYm9vbGVhbiwgcHVibGljIG5hbWU6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1RXaXRoU291cmNlfG51bGwpIHt9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXN0VmlzaXRvciB7XG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEFTVFdpdGhTb3VyY2U/KGFzdDogQVNUV2l0aFNvdXJjZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdD8oYXN0OiBBU1QsIGNvbnRleHQ/OiBhbnkpOiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBOdWxsQXN0VmlzaXRvciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBOb25OdWxsQXNzZXJ0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHt9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgQXN0VmlzaXRvciB7XG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5sZWZ0LnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5yaWdodC52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7IH1cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5jb25kaXRpb24udmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LnRydWVFeHAudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LmZhbHNlRXhwLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5leHAudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbChhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnRhcmdldCAhLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3Qub2JqLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5rZXkudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3Qub2JqLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5rZXkudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LnZhbHVlcywgY29udGV4dCk7IH1cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5leHByZXNzaW9uLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFsbChhc3RzOiBBU1RbXSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3RzLmZvckVhY2goYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxufVxuXG5leHBvcnQgY2xhc3MgQXN0VHJhbnNmb3JtZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KTogQVNUIHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBJbnRlcnBvbGF0aW9uKGFzdC5zcGFuLCBhc3Quc3RyaW5ncywgdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKGFzdC5zcGFuLCBhc3QudmFsdWUpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVJlYWQoYXN0LnNwYW4sIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKSwgYXN0Lm5hbWUpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IFByb3BlcnR5V3JpdGUoYXN0LnNwYW4sIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKSwgYXN0Lm5hbWUsIGFzdC52YWx1ZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZChhc3Quc3BhbiwgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpLCBhc3QubmFtZSk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgTWV0aG9kQ2FsbChhc3Quc3BhbiwgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpLCBhc3QubmFtZSwgdGhpcy52aXNpdEFsbChhc3QuYXJncykpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgU2FmZU1ldGhvZENhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyksIGFzdC5uYW1lLCB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzKSk7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uQ2FsbChhc3Quc3BhbiwgYXN0LnRhcmdldCAhLnZpc2l0KHRoaXMpLCB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheShhc3Quc3BhbiwgdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwKGFzdC5zcGFuLCBhc3Qua2V5cywgdGhpcy52aXNpdEFsbChhc3QudmFsdWVzKSk7XG4gIH1cblxuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeShhc3Quc3BhbiwgYXN0Lm9wZXJhdGlvbiwgYXN0LmxlZnQudmlzaXQodGhpcyksIGFzdC5yaWdodC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IFByZWZpeE5vdChhc3Quc3BhbiwgYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IE5vbk51bGxBc3NlcnQoYXN0LnNwYW4sIGFzdC5leHByZXNzaW9uLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LmNvbmRpdGlvbi52aXNpdCh0aGlzKSwgYXN0LnRydWVFeHAudmlzaXQodGhpcyksIGFzdC5mYWxzZUV4cC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJpbmRpbmdQaXBlKGFzdC5zcGFuLCBhc3QuZXhwLnZpc2l0KHRoaXMpLCBhc3QubmFtZSwgdGhpcy52aXNpdEFsbChhc3QuYXJncykpO1xuICB9XG5cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBLZXllZFJlYWQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBLZXllZFJlYWQoYXN0LnNwYW4sIGFzdC5vYmoudmlzaXQodGhpcyksIGFzdC5rZXkudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEtleWVkV3JpdGUoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Qub2JqLnZpc2l0KHRoaXMpLCBhc3Qua2V5LnZpc2l0KHRoaXMpLCBhc3QudmFsdWUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRBbGwoYXN0czogYW55W10pOiBhbnlbXSB7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3RzLmxlbmd0aDsgKytpKSB7XG4gICAgICByZXNbaV0gPSBhc3RzW2ldLnZpc2l0KHRoaXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQ2hhaW4oYXN0LnNwYW4sIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKSk7XG4gIH1cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBRdW90ZShhc3Quc3BhbiwgYXN0LnByZWZpeCwgYXN0LnVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uLCBhc3QubG9jYXRpb24pO1xuICB9XG59XG5cbi8vIEEgdHJhbnNmb3JtZXIgdGhhdCBvbmx5IGNyZWF0ZXMgbmV3IG5vZGVzIGlmIHRoZSB0cmFuc2Zvcm1lciBtYWtlcyBhIGNoYW5nZSBvclxuLy8gYSBjaGFuZ2UgaXMgbWFkZSBhIGNoaWxkIG5vZGUuXG5leHBvcnQgY2xhc3MgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KTogQVNUIHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSk6IEludGVycG9sYXRpb24ge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpO1xuICAgIGlmIChleHByZXNzaW9ucyAhPT0gYXN0LmV4cHJlc3Npb25zKVxuICAgICAgcmV0dXJuIG5ldyBJbnRlcnBvbGF0aW9uKGFzdC5zcGFuLCBhc3Quc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpOiBBU1QgeyByZXR1cm4gYXN0OyB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyk7XG4gICAgaWYgKHJlY2VpdmVyICE9PSBhc3QucmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKGFzdC5zcGFuLCByZWNlaXZlciwgYXN0Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKTtcbiAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZS52aXNpdCh0aGlzKTtcbiAgICBpZiAocmVjZWl2ZXIgIT09IGFzdC5yZWNlaXZlciB8fCB2YWx1ZSAhPT0gYXN0LnZhbHVlKSB7XG4gICAgICByZXR1cm4gbmV3IFByb3BlcnR5V3JpdGUoYXN0LnNwYW4sIHJlY2VpdmVyLCBhc3QubmFtZSwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKTtcbiAgICBpZiAocmVjZWl2ZXIgIT09IGFzdC5yZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkKGFzdC5zcGFuLCByZWNlaXZlciwgYXN0Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncyk7XG4gICAgaWYgKHJlY2VpdmVyICE9PSBhc3QucmVjZWl2ZXIgfHwgYXJncyAhPT0gYXN0LmFyZ3MpIHtcbiAgICAgIHJldHVybiBuZXcgTWV0aG9kQ2FsbChhc3Quc3BhbiwgcmVjZWl2ZXIsIGFzdC5uYW1lLCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncyk7XG4gICAgaWYgKHJlY2VpdmVyICE9PSBhc3QucmVjZWl2ZXIgfHwgYXJncyAhPT0gYXN0LmFyZ3MpIHtcbiAgICAgIHJldHVybiBuZXcgU2FmZU1ldGhvZENhbGwoYXN0LnNwYW4sIHJlY2VpdmVyLCBhc3QubmFtZSwgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCB0YXJnZXQgPSBhc3QudGFyZ2V0ICYmIGFzdC50YXJnZXQudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmICh0YXJnZXQgIT09IGFzdC50YXJnZXQgfHwgYXJncyAhPT0gYXN0LmFyZ3MpIHtcbiAgICAgIHJldHVybiBuZXcgRnVuY3Rpb25DYWxsKGFzdC5zcGFuLCB0YXJnZXQsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucyk7XG4gICAgaWYgKGV4cHJlc3Npb25zICE9PSBhc3QuZXhwcmVzc2lvbnMpIHtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5KGFzdC5zcGFuLCBleHByZXNzaW9ucyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IHZhbHVlcyA9IHRoaXMudmlzaXRBbGwoYXN0LnZhbHVlcyk7XG4gICAgaWYgKHZhbHVlcyAhPT0gYXN0LnZhbHVlcykge1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwKGFzdC5zcGFuLCBhc3Qua2V5cywgdmFsdWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGxlZnQgPSBhc3QubGVmdC52aXNpdCh0aGlzKTtcbiAgICBjb25zdCByaWdodCA9IGFzdC5yaWdodC52aXNpdCh0aGlzKTtcbiAgICBpZiAobGVmdCAhPT0gYXN0LmxlZnQgfHwgcmlnaHQgIT09IGFzdC5yaWdodCkge1xuICAgICAgcmV0dXJuIG5ldyBCaW5hcnkoYXN0LnNwYW4sIGFzdC5vcGVyYXRpb24sIGxlZnQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgICBpZiAoZXhwcmVzc2lvbiAhPT0gYXN0LmV4cHJlc3Npb24pIHtcbiAgICAgIHJldHVybiBuZXcgUHJlZml4Tm90KGFzdC5zcGFuLCBleHByZXNzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IGFzdC5leHByZXNzaW9uLnZpc2l0KHRoaXMpO1xuICAgIGlmIChleHByZXNzaW9uICE9PSBhc3QuZXhwcmVzc2lvbikge1xuICAgICAgcmV0dXJuIG5ldyBOb25OdWxsQXNzZXJ0KGFzdC5zcGFuLCBleHByZXNzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBjb25kaXRpb24gPSBhc3QuY29uZGl0aW9uLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IHRydWVFeHAgPSBhc3QudHJ1ZUV4cC52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBmYWxzZUV4cCA9IGFzdC5mYWxzZUV4cC52aXNpdCh0aGlzKTtcbiAgICBpZiAoY29uZGl0aW9uICE9PSBhc3QuY29uZGl0aW9uIHx8IHRydWVFeHAgIT09IGFzdC50cnVlRXhwIHx8IGZhbHNlRXhwICE9PSBhc3QuZmFsc2VFeHApIHtcbiAgICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWwoYXN0LnNwYW4sIGNvbmRpdGlvbiwgdHJ1ZUV4cCwgZmFsc2VFeHApO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgZXhwID0gYXN0LmV4cC52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncyk7XG4gICAgaWYgKGV4cCAhPT0gYXN0LmV4cCB8fCBhcmdzICE9PSBhc3QuYXJncykge1xuICAgICAgcmV0dXJuIG5ldyBCaW5kaW5nUGlwZShhc3Quc3BhbiwgZXhwLCBhc3QubmFtZSwgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBvYmogPSBhc3Qub2JqLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IGtleSA9IGFzdC5rZXkudmlzaXQodGhpcyk7XG4gICAgaWYgKG9iaiAhPT0gYXN0Lm9iaiB8fCBrZXkgIT09IGFzdC5rZXkpIHtcbiAgICAgIHJldHVybiBuZXcgS2V5ZWRSZWFkKGFzdC5zcGFuLCBvYmosIGtleSk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IG9iaiA9IGFzdC5vYmoudmlzaXQodGhpcyk7XG4gICAgY29uc3Qga2V5ID0gYXN0LmtleS52aXNpdCh0aGlzKTtcbiAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZS52aXNpdCh0aGlzKTtcbiAgICBpZiAob2JqICE9PSBhc3Qub2JqIHx8IGtleSAhPT0gYXN0LmtleSB8fCB2YWx1ZSAhPT0gYXN0LnZhbHVlKSB7XG4gICAgICByZXR1cm4gbmV3IEtleWVkV3JpdGUoYXN0LnNwYW4sIG9iaiwga2V5LCB2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEFsbChhc3RzOiBhbnlbXSk6IGFueVtdIHtcbiAgICBjb25zdCByZXMgPSBbXTtcbiAgICBsZXQgbW9kaWZpZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzdHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsID0gYXN0c1tpXTtcbiAgICAgIGNvbnN0IHZhbHVlID0gb3JpZ2luYWwudmlzaXQodGhpcyk7XG4gICAgICByZXNbaV0gPSB2YWx1ZTtcbiAgICAgIG1vZGlmaWVkID0gbW9kaWZpZWQgfHwgdmFsdWUgIT09IG9yaWdpbmFsO1xuICAgIH1cbiAgICByZXR1cm4gbW9kaWZpZWQgPyByZXMgOiBhc3RzO1xuICB9XG5cbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpO1xuICAgIGlmIChleHByZXNzaW9ucyAhPT0gYXN0LmV4cHJlc3Npb25zKSB7XG4gICAgICByZXR1cm4gbmV3IENoYWluKGFzdC5zcGFuLCBleHByZXNzaW9ucyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7IHJldHVybiBhc3Q7IH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0QXN0Q2hpbGRyZW4oYXN0OiBBU1QsIHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ/OiBhbnkpIHtcbiAgZnVuY3Rpb24gdmlzaXQoYXN0OiBBU1QpIHtcbiAgICB2aXNpdG9yLnZpc2l0ICYmIHZpc2l0b3IudmlzaXQoYXN0LCBjb250ZXh0KSB8fCBhc3QudmlzaXQodmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBmdW5jdGlvbiB2aXNpdEFsbDxUIGV4dGVuZHMgQVNUPihhc3RzOiBUW10pIHsgYXN0cy5mb3JFYWNoKHZpc2l0KTsgfVxuXG4gIGFzdC52aXNpdCh7XG4gICAgdmlzaXRCaW5hcnkoYXN0KSB7XG4gICAgICB2aXNpdChhc3QubGVmdCk7XG4gICAgICB2aXNpdChhc3QucmlnaHQpO1xuICAgIH0sXG4gICAgdmlzaXRDaGFpbihhc3QpIHsgdmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTsgfSxcbiAgICB2aXNpdENvbmRpdGlvbmFsKGFzdCkge1xuICAgICAgdmlzaXQoYXN0LmNvbmRpdGlvbik7XG4gICAgICB2aXNpdChhc3QudHJ1ZUV4cCk7XG4gICAgICB2aXNpdChhc3QuZmFsc2VFeHApO1xuICAgIH0sXG4gICAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0KSB7XG4gICAgICBpZiAoYXN0LnRhcmdldCkge1xuICAgICAgICB2aXNpdChhc3QudGFyZ2V0KTtcbiAgICAgIH1cbiAgICAgIHZpc2l0QWxsKGFzdC5hcmdzKTtcbiAgICB9LFxuICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3QpIHt9LFxuICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3QpIHsgdmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTsgfSxcbiAgICB2aXNpdEtleWVkUmVhZChhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5vYmopO1xuICAgICAgdmlzaXQoYXN0LmtleSk7XG4gICAgfSxcbiAgICB2aXNpdEtleWVkV3JpdGUoYXN0KSB7XG4gICAgICB2aXNpdChhc3Qub2JqKTtcbiAgICAgIHZpc2l0KGFzdC5rZXkpO1xuICAgICAgdmlzaXQoYXN0Lm9iaik7XG4gICAgfSxcbiAgICB2aXNpdExpdGVyYWxBcnJheShhc3QpIHsgdmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTsgfSxcbiAgICB2aXNpdExpdGVyYWxNYXAoYXN0KSB7fSxcbiAgICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0KSB7fSxcbiAgICB2aXNpdE1ldGhvZENhbGwoYXN0KSB7XG4gICAgICB2aXNpdChhc3QucmVjZWl2ZXIpO1xuICAgICAgdmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIH0sXG4gICAgdmlzaXRQaXBlKGFzdCkge1xuICAgICAgdmlzaXQoYXN0LmV4cCk7XG4gICAgICB2aXNpdEFsbChhc3QuYXJncyk7XG4gICAgfSxcbiAgICB2aXNpdFByZWZpeE5vdChhc3QpIHsgdmlzaXQoYXN0LmV4cHJlc3Npb24pOyB9LFxuICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3QpIHsgdmlzaXQoYXN0LmV4cHJlc3Npb24pOyB9LFxuICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdCkgeyB2aXNpdChhc3QucmVjZWl2ZXIpOyB9LFxuICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5yZWNlaXZlcik7XG4gICAgICB2aXNpdChhc3QudmFsdWUpO1xuICAgIH0sXG4gICAgdmlzaXRRdW90ZShhc3QpIHt9LFxuICAgIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0KSB7XG4gICAgICB2aXNpdChhc3QucmVjZWl2ZXIpO1xuICAgICAgdmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIH0sXG4gICAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdCkgeyB2aXNpdChhc3QucmVjZWl2ZXIpOyB9LFxuICB9KTtcbn1cblxuXG4vLyBCaW5kaW5nc1xuXG5leHBvcnQgY2xhc3MgUGFyc2VkUHJvcGVydHkge1xuICBwdWJsaWMgcmVhZG9ubHkgaXNMaXRlcmFsOiBib29sZWFuO1xuICBwdWJsaWMgcmVhZG9ubHkgaXNBbmltYXRpb246IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZSwgcHVibGljIHR5cGU6IFBhcnNlZFByb3BlcnR5VHlwZSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICB0aGlzLmlzTGl0ZXJhbCA9IHRoaXMudHlwZSA9PT0gUGFyc2VkUHJvcGVydHlUeXBlLkxJVEVSQUxfQVRUUjtcbiAgICB0aGlzLmlzQW5pbWF0aW9uID0gdGhpcy50eXBlID09PSBQYXJzZWRQcm9wZXJ0eVR5cGUuQU5JTUFUSU9OO1xuICB9XG59XG5cbmV4cG9ydCBlbnVtIFBhcnNlZFByb3BlcnR5VHlwZSB7XG4gIERFRkFVTFQsXG4gIExJVEVSQUxfQVRUUixcbiAgQU5JTUFUSU9OXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFBhcnNlZEV2ZW50VHlwZSB7XG4gIC8vIERPTSBvciBEaXJlY3RpdmUgZXZlbnRcbiAgUmVndWxhcixcbiAgLy8gQW5pbWF0aW9uIHNwZWNpZmljIGV2ZW50XG4gIEFuaW1hdGlvbixcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlZEV2ZW50IHtcbiAgLy8gUmVndWxhciBldmVudHMgaGF2ZSBhIHRhcmdldFxuICAvLyBBbmltYXRpb24gZXZlbnRzIGhhdmUgYSBwaGFzZVxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0YXJnZXRPclBoYXNlOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBQYXJzZWRFdmVudFR5cGUsXG4gICAgICBwdWJsaWMgaGFuZGxlcjogQVNULCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZWRWYXJpYWJsZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBCaW5kaW5nVHlwZSB7XG4gIC8vIEEgcmVndWxhciBiaW5kaW5nIHRvIGEgcHJvcGVydHkgKGUuZy4gYFtwcm9wZXJ0eV09XCJleHByZXNzaW9uXCJgKS5cbiAgUHJvcGVydHksXG4gIC8vIEEgYmluZGluZyB0byBhbiBlbGVtZW50IGF0dHJpYnV0ZSAoZS5nLiBgW2F0dHIubmFtZV09XCJleHByZXNzaW9uXCJgKS5cbiAgQXR0cmlidXRlLFxuICAvLyBBIGJpbmRpbmcgdG8gYSBDU1MgY2xhc3MgKGUuZy4gYFtjbGFzcy5uYW1lXT1cImNvbmRpdGlvblwiYCkuXG4gIENsYXNzLFxuICAvLyBBIGJpbmRpbmcgdG8gYSBzdHlsZSBydWxlIChlLmcuIGBbc3R5bGUucnVsZV09XCJleHByZXNzaW9uXCJgKS5cbiAgU3R5bGUsXG4gIC8vIEEgYmluZGluZyB0byBhbiBhbmltYXRpb24gcmVmZXJlbmNlIChlLmcuIGBbYW5pbWF0ZS5rZXldPVwiZXhwcmVzc2lvblwiYCkuXG4gIEFuaW1hdGlvbixcbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kRWxlbWVudFByb3BlcnR5IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdHlwZTogQmluZGluZ1R5cGUsIHB1YmxpYyBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgdW5pdDogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuIl19