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
    ParseSpan.prototype.toAbsolute = function (absoluteOffset) {
        return new AbsoluteSourceSpan(absoluteOffset + this.start, absoluteOffset + this.end);
    };
    return ParseSpan;
}());
export { ParseSpan };
var AST = /** @class */ (function () {
    function AST(span, 
    /**
     * Absolute location of the expression AST in a source code file.
     */
    sourceSpan) {
        this.span = span;
        this.sourceSpan = sourceSpan;
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
    function Quote(span, sourceSpan, prefix, uninterpretedExpression, location) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function Chain(span, sourceSpan, expressions) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function Conditional(span, sourceSpan, condition, trueExp, falseExp) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function PropertyRead(span, sourceSpan, receiver, name) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function PropertyWrite(span, sourceSpan, receiver, name, value) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function SafePropertyRead(span, sourceSpan, receiver, name) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function KeyedRead(span, sourceSpan, obj, key) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function KeyedWrite(span, sourceSpan, obj, key, value) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function BindingPipe(span, sourceSpan, exp, name, args) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function LiteralPrimitive(span, sourceSpan, value) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function LiteralArray(span, sourceSpan, expressions) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function LiteralMap(span, sourceSpan, keys, values) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function Interpolation(span, sourceSpan, strings, expressions) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function Binary(span, sourceSpan, operation, left, right) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function PrefixNot(span, sourceSpan, expression) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function NonNullAssert(span, sourceSpan, expression) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function MethodCall(span, sourceSpan, receiver, name, args) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function SafeMethodCall(span, sourceSpan, receiver, name, args) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
    function FunctionCall(span, sourceSpan, target, args) {
        var _this = _super.call(this, span, sourceSpan) || this;
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
        var _this = _super.call(this, new ParseSpan(0, source === null ? 0 : source.length), new AbsoluteSourceSpan(absoluteOffset, source === null ? absoluteOffset : absoluteOffset + source.length)) || this;
        _this.ast = ast;
        _this.source = source;
        _this.location = location;
        _this.errors = errors;
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
    function TemplateBinding(span, sourceSpan, key, keyIsVar, name, expression) {
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
        return new Interpolation(ast.span, ast.sourceSpan, ast.strings, this.visitAll(ast.expressions));
    };
    AstTransformer.prototype.visitLiteralPrimitive = function (ast, context) {
        return new LiteralPrimitive(ast.span, ast.sourceSpan, ast.value);
    };
    AstTransformer.prototype.visitPropertyRead = function (ast, context) {
        return new PropertyRead(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.name);
    };
    AstTransformer.prototype.visitPropertyWrite = function (ast, context) {
        return new PropertyWrite(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.name, ast.value.visit(this));
    };
    AstTransformer.prototype.visitSafePropertyRead = function (ast, context) {
        return new SafePropertyRead(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.name);
    };
    AstTransformer.prototype.visitMethodCall = function (ast, context) {
        return new MethodCall(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitSafeMethodCall = function (ast, context) {
        return new SafeMethodCall(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitFunctionCall = function (ast, context) {
        return new FunctionCall(ast.span, ast.sourceSpan, ast.target.visit(this), this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitLiteralArray = function (ast, context) {
        return new LiteralArray(ast.span, ast.sourceSpan, this.visitAll(ast.expressions));
    };
    AstTransformer.prototype.visitLiteralMap = function (ast, context) {
        return new LiteralMap(ast.span, ast.sourceSpan, ast.keys, this.visitAll(ast.values));
    };
    AstTransformer.prototype.visitBinary = function (ast, context) {
        return new Binary(ast.span, ast.sourceSpan, ast.operation, ast.left.visit(this), ast.right.visit(this));
    };
    AstTransformer.prototype.visitPrefixNot = function (ast, context) {
        return new PrefixNot(ast.span, ast.sourceSpan, ast.expression.visit(this));
    };
    AstTransformer.prototype.visitNonNullAssert = function (ast, context) {
        return new NonNullAssert(ast.span, ast.sourceSpan, ast.expression.visit(this));
    };
    AstTransformer.prototype.visitConditional = function (ast, context) {
        return new Conditional(ast.span, ast.sourceSpan, ast.condition.visit(this), ast.trueExp.visit(this), ast.falseExp.visit(this));
    };
    AstTransformer.prototype.visitPipe = function (ast, context) {
        return new BindingPipe(ast.span, ast.sourceSpan, ast.exp.visit(this), ast.name, this.visitAll(ast.args));
    };
    AstTransformer.prototype.visitKeyedRead = function (ast, context) {
        return new KeyedRead(ast.span, ast.sourceSpan, ast.obj.visit(this), ast.key.visit(this));
    };
    AstTransformer.prototype.visitKeyedWrite = function (ast, context) {
        return new KeyedWrite(ast.span, ast.sourceSpan, ast.obj.visit(this), ast.key.visit(this), ast.value.visit(this));
    };
    AstTransformer.prototype.visitAll = function (asts) {
        var res = [];
        for (var i = 0; i < asts.length; ++i) {
            res[i] = asts[i].visit(this);
        }
        return res;
    };
    AstTransformer.prototype.visitChain = function (ast, context) {
        return new Chain(ast.span, ast.sourceSpan, this.visitAll(ast.expressions));
    };
    AstTransformer.prototype.visitQuote = function (ast, context) {
        return new Quote(ast.span, ast.sourceSpan, ast.prefix, ast.uninterpretedExpression, ast.location);
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
            return new Interpolation(ast.span, ast.sourceSpan, ast.strings, expressions);
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitLiteralPrimitive = function (ast, context) { return ast; };
    AstMemoryEfficientTransformer.prototype.visitPropertyRead = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new PropertyRead(ast.span, ast.sourceSpan, receiver, ast.name);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitPropertyWrite = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        var value = ast.value.visit(this);
        if (receiver !== ast.receiver || value !== ast.value) {
            return new PropertyWrite(ast.span, ast.sourceSpan, receiver, ast.name, value);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitSafePropertyRead = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new SafePropertyRead(ast.span, ast.sourceSpan, receiver, ast.name);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitMethodCall = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        var args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new MethodCall(ast.span, ast.sourceSpan, receiver, ast.name, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitSafeMethodCall = function (ast, context) {
        var receiver = ast.receiver.visit(this);
        var args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new SafeMethodCall(ast.span, ast.sourceSpan, receiver, ast.name, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitFunctionCall = function (ast, context) {
        var target = ast.target && ast.target.visit(this);
        var args = this.visitAll(ast.args);
        if (target !== ast.target || args !== ast.args) {
            return new FunctionCall(ast.span, ast.sourceSpan, target, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitLiteralArray = function (ast, context) {
        var expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new LiteralArray(ast.span, ast.sourceSpan, expressions);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitLiteralMap = function (ast, context) {
        var values = this.visitAll(ast.values);
        if (values !== ast.values) {
            return new LiteralMap(ast.span, ast.sourceSpan, ast.keys, values);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitBinary = function (ast, context) {
        var left = ast.left.visit(this);
        var right = ast.right.visit(this);
        if (left !== ast.left || right !== ast.right) {
            return new Binary(ast.span, ast.sourceSpan, ast.operation, left, right);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitPrefixNot = function (ast, context) {
        var expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new PrefixNot(ast.span, ast.sourceSpan, expression);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitNonNullAssert = function (ast, context) {
        var expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new NonNullAssert(ast.span, ast.sourceSpan, expression);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitConditional = function (ast, context) {
        var condition = ast.condition.visit(this);
        var trueExp = ast.trueExp.visit(this);
        var falseExp = ast.falseExp.visit(this);
        if (condition !== ast.condition || trueExp !== ast.trueExp || falseExp !== ast.falseExp) {
            return new Conditional(ast.span, ast.sourceSpan, condition, trueExp, falseExp);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitPipe = function (ast, context) {
        var exp = ast.exp.visit(this);
        var args = this.visitAll(ast.args);
        if (exp !== ast.exp || args !== ast.args) {
            return new BindingPipe(ast.span, ast.sourceSpan, exp, ast.name, args);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitKeyedRead = function (ast, context) {
        var obj = ast.obj.visit(this);
        var key = ast.key.visit(this);
        if (obj !== ast.obj || key !== ast.key) {
            return new KeyedRead(ast.span, ast.sourceSpan, obj, key);
        }
        return ast;
    };
    AstMemoryEfficientTransformer.prototype.visitKeyedWrite = function (ast, context) {
        var obj = ast.obj.visit(this);
        var key = ast.key.visit(this);
        var value = ast.value.visit(this);
        if (obj !== ast.obj || key !== ast.key || value !== ast.value) {
            return new KeyedWrite(ast.span, ast.sourceSpan, obj, key, value);
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
            return new Chain(ast.span, ast.sourceSpan, expressions);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBS0g7SUFFRSxxQkFDSSxPQUFlLEVBQVMsS0FBYSxFQUFTLFdBQW1CLEVBQVMsV0FBaUI7UUFBbkUsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQU07UUFDN0YsSUFBSSxDQUFDLE9BQU8sR0FBRyxtQkFBaUIsT0FBTyxTQUFJLFdBQVcsVUFBSyxLQUFLLGFBQVEsV0FBYSxDQUFDO0lBQ3hGLENBQUM7SUFDSCxrQkFBQztBQUFELENBQUMsQUFORCxJQU1DOztBQUVEO0lBQ0UsbUJBQW1CLEtBQWEsRUFBUyxHQUFXO1FBQWpDLFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxRQUFHLEdBQUgsR0FBRyxDQUFRO0lBQUcsQ0FBQztJQUN4RCw4QkFBVSxHQUFWLFVBQVcsY0FBc0I7UUFDL0IsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUNILGdCQUFDO0FBQUQsQ0FBQyxBQUxELElBS0M7O0FBRUQ7SUFDRSxhQUNXLElBQWU7SUFDdEI7O09BRUc7SUFDSSxVQUF3QztRQUp4QyxTQUFJLEdBQUosSUFBSSxDQUFXO1FBSWYsZUFBVSxHQUFWLFVBQVUsQ0FBOEI7SUFBRyxDQUFDO0lBQ3ZELG1CQUFLLEdBQUwsVUFBTSxPQUFtQixFQUFFLE9BQW1CO1FBQW5CLHdCQUFBLEVBQUEsY0FBbUI7UUFBUyxPQUFPLElBQUksQ0FBQztJQUFDLENBQUM7SUFDckUsc0JBQVEsR0FBUixjQUFxQixP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LEVBQ2hELFdBQTRCO1FBRjVCLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUFTLFNBQUksR0FBSixJQUFJLENBQWlCO1FBQ3hFLFlBQU8sR0FBUCxPQUFPLENBQUs7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUNoRCxnQkFBVyxHQUFYLFdBQVcsQ0FBaUI7SUFBRyxDQUFDO0lBQzdDLGtCQUFDO0FBQUQsQ0FBQyxBQVBELElBT0M7O0FBRUQ7SUFDRSx3QkFBbUIsSUFBWSxFQUFTLEtBQWEsRUFBUyxVQUEyQjtRQUF0RSxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztJQUMvRixxQkFBQztBQUFELENBQUMsQUFGRCxJQUVDOztBQWVEO0lBQ0UsOEJBQ1csSUFBWSxFQUFTLElBQWlCLEVBQVMsZUFBZ0MsRUFDL0UsS0FBVSxFQUFTLElBQWlCLEVBQVMsVUFBMkIsRUFDeEUsU0FBMkI7UUFGM0IsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUFTLFNBQUksR0FBSixJQUFJLENBQWE7UUFBUyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDL0UsVUFBSyxHQUFMLEtBQUssQ0FBSztRQUFTLFNBQUksR0FBSixJQUFJLENBQWE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUN4RSxjQUFTLEdBQVQsU0FBUyxDQUFrQjtJQUFHLENBQUM7SUFDNUMsMkJBQUM7QUFBRCxDQUFDLEFBTEQsSUFLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgUGFyc2VyRXJyb3Ige1xuICBwdWJsaWMgbWVzc2FnZTogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIG1lc3NhZ2U6IHN0cmluZywgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBlcnJMb2NhdGlvbjogc3RyaW5nLCBwdWJsaWMgY3R4TG9jYXRpb24/OiBhbnkpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBgUGFyc2VyIEVycm9yOiAke21lc3NhZ2V9ICR7ZXJyTG9jYXRpb259IFske2lucHV0fV0gaW4gJHtjdHhMb2NhdGlvbn1gO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZVNwYW4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RhcnQ6IG51bWJlciwgcHVibGljIGVuZDogbnVtYmVyKSB7fVxuICB0b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBYnNvbHV0ZVNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKGFic29sdXRlT2Zmc2V0ICsgdGhpcy5zdGFydCwgYWJzb2x1dGVPZmZzZXQgKyB0aGlzLmVuZCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHNwYW46IFBhcnNlU3BhbixcbiAgICAgIC8qKlxuICAgICAgICogQWJzb2x1dGUgbG9jYXRpb24gb2YgdGhlIGV4cHJlc3Npb24gQVNUIGluIGEgc291cmNlIGNvZGUgZmlsZS5cbiAgICAgICAqL1xuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFJlYWRvbmx5PEFic29sdXRlU291cmNlU3Bhbj4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB0b1N0cmluZygpOiBzdHJpbmcgeyByZXR1cm4gJ0FTVCc7IH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgcXVvdGVkIGV4cHJlc3Npb24gb2YgdGhlIGZvcm06XG4gKlxuICogcXVvdGUgPSBwcmVmaXggYDpgIHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uXG4gKiBwcmVmaXggPSBpZGVudGlmaWVyXG4gKiB1bmludGVycHJldGVkRXhwcmVzc2lvbiA9IGFyYml0cmFyeSBzdHJpbmdcbiAqXG4gKiBBIHF1b3RlZCBleHByZXNzaW9uIGlzIG1lYW50IHRvIGJlIHByZS1wcm9jZXNzZWQgYnkgYW4gQVNUIHRyYW5zZm9ybWVyIHRoYXRcbiAqIGNvbnZlcnRzIGl0IGludG8gYW5vdGhlciBBU1QgdGhhdCBubyBsb25nZXIgY29udGFpbnMgcXVvdGVkIGV4cHJlc3Npb25zLlxuICogSXQgaXMgbWVhbnQgdG8gYWxsb3cgdGhpcmQtcGFydHkgZGV2ZWxvcGVycyB0byBleHRlbmQgQW5ndWxhciB0ZW1wbGF0ZVxuICogZXhwcmVzc2lvbiBsYW5ndWFnZS4gVGhlIGB1bmludGVycHJldGVkRXhwcmVzc2lvbmAgcGFydCBvZiB0aGUgcXVvdGUgaXNcbiAqIHRoZXJlZm9yZSBub3QgaW50ZXJwcmV0ZWQgYnkgdGhlIEFuZ3VsYXIncyBvd24gZXhwcmVzc2lvbiBwYXJzZXIuXG4gKi9cbmV4cG9ydCBjbGFzcyBRdW90ZSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBwcmVmaXg6IHN0cmluZyxcbiAgICAgIHB1YmxpYyB1bmludGVycHJldGVkRXhwcmVzc2lvbjogc3RyaW5nLCBwdWJsaWMgbG9jYXRpb246IGFueSkge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdFF1b3RlKHRoaXMsIGNvbnRleHQpOyB9XG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7IHJldHVybiAnUXVvdGUnOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbXB0eUV4cHIgZXh0ZW5kcyBBU1Qge1xuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKSB7XG4gICAgLy8gZG8gbm90aGluZ1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbXBsaWNpdFJlY2VpdmVyIGV4dGVuZHMgQVNUIHtcbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbXBsaWNpdFJlY2VpdmVyKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogTXVsdGlwbGUgZXhwcmVzc2lvbnMgc2VwYXJhdGVkIGJ5IGEgc2VtaWNvbG9uLlxuICovXG5leHBvcnQgY2xhc3MgQ2hhaW4gZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIGV4cHJlc3Npb25zOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdENoYWluKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb25kaXRpb25hbCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBjb25kaXRpb246IEFTVCwgcHVibGljIHRydWVFeHA6IEFTVCxcbiAgICAgIHB1YmxpYyBmYWxzZUV4cDogQVNUKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb25kaXRpb25hbCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvcGVydHlSZWFkIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIHJlY2VpdmVyOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFByb3BlcnR5UmVhZCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvcGVydHlXcml0ZSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyByZWNlaXZlcjogQVNULCBwdWJsaWMgbmFtZTogc3RyaW5nLFxuICAgICAgcHVibGljIHZhbHVlOiBBU1QpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFByb3BlcnR5V3JpdGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVQcm9wZXJ0eVJlYWQgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNwYW46IFBhcnNlU3Bhbiwgc291cmNlU3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuLCBwdWJsaWMgcmVjZWl2ZXI6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U2FmZVByb3BlcnR5UmVhZCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgS2V5ZWRSZWFkIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBvYmo6IEFTVCwgcHVibGljIGtleTogQVNUKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRLZXllZFJlYWQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEtleWVkV3JpdGUgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNwYW46IFBhcnNlU3Bhbiwgc291cmNlU3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuLCBwdWJsaWMgb2JqOiBBU1QsIHB1YmxpYyBrZXk6IEFTVCxcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNUKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRLZXllZFdyaXRlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nUGlwZSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBleHA6IEFTVCwgcHVibGljIG5hbWU6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBhcmdzOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdFBpcGUodGhpcywgY29udGV4dCk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxQcmltaXRpdmUgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIHZhbHVlOiBhbnkpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExpdGVyYWxQcmltaXRpdmUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxBcnJheSBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3Bhbiwgc291cmNlU3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuLCBwdWJsaWMgZXhwcmVzc2lvbnM6IGFueVtdKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsQXJyYXkodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTGl0ZXJhbE1hcEtleSA9IHtcbiAga2V5OiBzdHJpbmc7IHF1b3RlZDogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIGtleXM6IExpdGVyYWxNYXBLZXlbXSxcbiAgICAgIHB1YmxpYyB2YWx1ZXM6IGFueVtdKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsTWFwKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnRlcnBvbGF0aW9uIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIHN0cmluZ3M6IGFueVtdLFxuICAgICAgcHVibGljIGV4cHJlc3Npb25zOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SW50ZXJwb2xhdGlvbih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQmluYXJ5IGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIG9wZXJhdGlvbjogc3RyaW5nLCBwdWJsaWMgbGVmdDogQVNULFxuICAgICAgcHVibGljIHJpZ2h0OiBBU1QpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJpbmFyeSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJlZml4Tm90IGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBleHByZXNzaW9uOiBBU1QpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFByZWZpeE5vdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTm9uTnVsbEFzc2VydCBleHRlbmRzIEFTVCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IFBhcnNlU3Bhbiwgc291cmNlU3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuLCBwdWJsaWMgZXhwcmVzc2lvbjogQVNUKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXROb25OdWxsQXNzZXJ0KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZXRob2RDYWxsIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIHJlY2VpdmVyOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgYXJnczogYW55W10pIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdE1ldGhvZENhbGwodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVNZXRob2RDYWxsIGV4dGVuZHMgQVNUIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBQYXJzZVNwYW4sIHNvdXJjZVNwYW46IEFic29sdXRlU291cmNlU3BhbiwgcHVibGljIHJlY2VpdmVyOiBBU1QsIHB1YmxpYyBuYW1lOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgYXJnczogYW55W10pIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkgPSBudWxsKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFNhZmVNZXRob2RDYWxsKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGdW5jdGlvbkNhbGwgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNwYW46IFBhcnNlU3Bhbiwgc291cmNlU3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuLCBwdWJsaWMgdGFyZ2V0OiBBU1R8bnVsbCxcbiAgICAgIHB1YmxpYyBhcmdzOiBhbnlbXSkge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4pO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RnVuY3Rpb25DYWxsKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogUmVjb3JkcyB0aGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgYSB0ZXh0IHNwYW4gaW4gYSBzb3VyY2UgZmlsZSwgd2hlcmUgYHN0YXJ0YCBhbmQgYGVuZGAgYXJlIHRoZVxuICogc3RhcnRpbmcgYW5kIGVuZGluZyBieXRlIG9mZnNldHMsIHJlc3BlY3RpdmVseSwgb2YgdGhlIHRleHQgc3BhbiBpbiBhIHNvdXJjZSBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgQWJzb2x1dGVTb3VyY2VTcGFuIHtcbiAgY29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHN0YXJ0OiBudW1iZXIsIHB1YmxpYyByZWFkb25seSBlbmQ6IG51bWJlcikge31cbn1cblxuZXhwb3J0IGNsYXNzIEFTVFdpdGhTb3VyY2UgZXh0ZW5kcyBBU1Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBhc3Q6IEFTVCwgcHVibGljIHNvdXJjZTogc3RyaW5nfG51bGwsIHB1YmxpYyBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VyRXJyb3JbXSkge1xuICAgIHN1cGVyKFxuICAgICAgICBuZXcgUGFyc2VTcGFuKDAsIHNvdXJjZSA9PT0gbnVsbCA/IDAgOiBzb3VyY2UubGVuZ3RoKSxcbiAgICAgICAgbmV3IEFic29sdXRlU291cmNlU3BhbihcbiAgICAgICAgICAgIGFic29sdXRlT2Zmc2V0LCBzb3VyY2UgPT09IG51bGwgPyBhYnNvbHV0ZU9mZnNldCA6IGFic29sdXRlT2Zmc2V0ICsgc291cmNlLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0KHZpc2l0b3I6IEFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnkge1xuICAgIGlmICh2aXNpdG9yLnZpc2l0QVNUV2l0aFNvdXJjZSkge1xuICAgICAgcmV0dXJuIHZpc2l0b3IudmlzaXRBU1RXaXRoU291cmNlKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hc3QudmlzaXQodmlzaXRvciwgY29udGV4dCk7XG4gIH1cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHsgcmV0dXJuIGAke3RoaXMuc291cmNlfSBpbiAke3RoaXMubG9jYXRpb259YDsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3BhbjogUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBrZXk6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBrZXlJc1ZhcjogYm9vbGVhbiwgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGV4cHJlc3Npb246IEFTVFdpdGhTb3VyY2V8bnVsbCkge31cbn1cblxuZXhwb3J0IGludGVyZmFjZSBBc3RWaXNpdG9yIHtcbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBJbXBsaWNpdFJlY2VpdmVyLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBLZXllZFJlYWQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBOb25OdWxsQXNzZXJ0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QVNUV2l0aFNvdXJjZT8oYXN0OiBBU1RXaXRoU291cmNlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Pyhhc3Q6IEFTVCwgY29udGV4dD86IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIE51bGxBc3RWaXNpdG9yIGltcGxlbWVudHMgQXN0VmlzaXRvciB7XG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBJbXBsaWNpdFJlY2VpdmVyLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbiwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge31cbn1cblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmxlZnQudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LnJpZ2h0LnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBjb250ZXh0KTsgfVxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QudHJ1ZUV4cC52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuZmFsc2VFeHAudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmV4cC52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QudGFyZ2V0ICEudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbChhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5vYmoudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LmtleS52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5vYmoudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LmtleS52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QudmFsdWUudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QudmFsdWVzLCBjb250ZXh0KTsgfVxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuYXJncywgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QWxsKGFzdHM6IEFTVFtdLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdHMuZm9yRWFjaChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBBc3RUcmFuc2Zvcm1lciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBJbXBsaWNpdFJlY2VpdmVyLCBjb250ZXh0OiBhbnkpOiBBU1QgeyByZXR1cm4gYXN0OyB9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbiwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEludGVycG9sYXRpb24oYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RyaW5ncywgdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LnZhbHVlKTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpLCBhc3QubmFtZSk7XG4gIH1cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgUHJvcGVydHlXcml0ZShcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyksIGFzdC5uYW1lLCBhc3QudmFsdWUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IFNhZmVQcm9wZXJ0eVJlYWQoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyksIGFzdC5uYW1lKTtcbiAgfVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBNZXRob2RDYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKSwgYXN0Lm5hbWUsIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpKTtcbiAgfVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IFNhZmVNZXRob2RDYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKSwgYXN0Lm5hbWUsIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpKTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFzdC50YXJnZXQgIS52aXNpdCh0aGlzKSwgdGhpcy52aXNpdEFsbChhc3QuYXJncykpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsQXJyYXkoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucykpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxNYXAoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Qua2V5cywgdGhpcy52aXNpdEFsbChhc3QudmFsdWVzKSk7XG4gIH1cblxuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeShcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Qub3BlcmF0aW9uLCBhc3QubGVmdC52aXNpdCh0aGlzKSwgYXN0LnJpZ2h0LnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgUHJlZml4Tm90KGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IE5vbk51bGxBc3NlcnQoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3QuY29uZGl0aW9uLnZpc2l0KHRoaXMpLCBhc3QudHJ1ZUV4cC52aXNpdCh0aGlzKSxcbiAgICAgICAgYXN0LmZhbHNlRXhwLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQmluZGluZ1BpcGUoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LmV4cC52aXNpdCh0aGlzKSwgYXN0Lm5hbWUsIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgS2V5ZWRSZWFkKGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0Lm9iai52aXNpdCh0aGlzKSwgYXN0LmtleS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgS2V5ZWRXcml0ZShcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Qub2JqLnZpc2l0KHRoaXMpLCBhc3Qua2V5LnZpc2l0KHRoaXMpLCBhc3QudmFsdWUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRBbGwoYXN0czogYW55W10pOiBhbnlbXSB7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3RzLmxlbmd0aDsgKytpKSB7XG4gICAgICByZXNbaV0gPSBhc3RzW2ldLnZpc2l0KHRoaXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQ2hhaW4oYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucykpO1xuICB9XG5cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgUXVvdGUoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LnByZWZpeCwgYXN0LnVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uLCBhc3QubG9jYXRpb24pO1xuICB9XG59XG5cbi8vIEEgdHJhbnNmb3JtZXIgdGhhdCBvbmx5IGNyZWF0ZXMgbmV3IG5vZGVzIGlmIHRoZSB0cmFuc2Zvcm1lciBtYWtlcyBhIGNoYW5nZSBvclxuLy8gYSBjaGFuZ2UgaXMgbWFkZSBhIGNoaWxkIG5vZGUuXG5leHBvcnQgY2xhc3MgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KTogQVNUIHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSk6IEludGVycG9sYXRpb24ge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpO1xuICAgIGlmIChleHByZXNzaW9ucyAhPT0gYXN0LmV4cHJlc3Npb25zKVxuICAgICAgcmV0dXJuIG5ldyBJbnRlcnBvbGF0aW9uKGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KTogQVNUIHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpO1xuICAgIGlmIChyZWNlaXZlciAhPT0gYXN0LnJlY2VpdmVyKSB7XG4gICAgICByZXR1cm4gbmV3IFByb3BlcnR5UmVhZChhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIHJlY2VpdmVyLCBhc3QubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlLnZpc2l0KHRoaXMpO1xuICAgIGlmIChyZWNlaXZlciAhPT0gYXN0LnJlY2VpdmVyIHx8IHZhbHVlICE9PSBhc3QudmFsdWUpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvcGVydHlXcml0ZShhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIHJlY2VpdmVyLCBhc3QubmFtZSwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdCh0aGlzKTtcbiAgICBpZiAocmVjZWl2ZXIgIT09IGFzdC5yZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkKGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgcmVjZWl2ZXIsIGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmIChyZWNlaXZlciAhPT0gYXN0LnJlY2VpdmVyIHx8IGFyZ3MgIT09IGFzdC5hcmdzKSB7XG4gICAgICByZXR1cm4gbmV3IE1ldGhvZENhbGwoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCByZWNlaXZlciwgYXN0Lm5hbWUsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzKTtcbiAgICBpZiAocmVjZWl2ZXIgIT09IGFzdC5yZWNlaXZlciB8fCBhcmdzICE9PSBhc3QuYXJncykge1xuICAgICAgcmV0dXJuIG5ldyBTYWZlTWV0aG9kQ2FsbChhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIHJlY2VpdmVyLCBhc3QubmFtZSwgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCB0YXJnZXQgPSBhc3QudGFyZ2V0ICYmIGFzdC50YXJnZXQudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmICh0YXJnZXQgIT09IGFzdC50YXJnZXQgfHwgYXJncyAhPT0gYXN0LmFyZ3MpIHtcbiAgICAgIHJldHVybiBuZXcgRnVuY3Rpb25DYWxsKGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgdGFyZ2V0LCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpO1xuICAgIGlmIChleHByZXNzaW9ucyAhPT0gYXN0LmV4cHJlc3Npb25zKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheShhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGV4cHJlc3Npb25zKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy52aXNpdEFsbChhc3QudmFsdWVzKTtcbiAgICBpZiAodmFsdWVzICE9PSBhc3QudmFsdWVzKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxNYXAoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Qua2V5cywgdmFsdWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGxlZnQgPSBhc3QubGVmdC52aXNpdCh0aGlzKTtcbiAgICBjb25zdCByaWdodCA9IGFzdC5yaWdodC52aXNpdCh0aGlzKTtcbiAgICBpZiAobGVmdCAhPT0gYXN0LmxlZnQgfHwgcmlnaHQgIT09IGFzdC5yaWdodCkge1xuICAgICAgcmV0dXJuIG5ldyBCaW5hcnkoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Qub3BlcmF0aW9uLCBsZWZ0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gICAgaWYgKGV4cHJlc3Npb24gIT09IGFzdC5leHByZXNzaW9uKSB7XG4gICAgICByZXR1cm4gbmV3IFByZWZpeE5vdChhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGV4cHJlc3Npb24pO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gICAgaWYgKGV4cHJlc3Npb24gIT09IGFzdC5leHByZXNzaW9uKSB7XG4gICAgICByZXR1cm4gbmV3IE5vbk51bGxBc3NlcnQoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBleHByZXNzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBjb25kaXRpb24gPSBhc3QuY29uZGl0aW9uLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IHRydWVFeHAgPSBhc3QudHJ1ZUV4cC52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBmYWxzZUV4cCA9IGFzdC5mYWxzZUV4cC52aXNpdCh0aGlzKTtcbiAgICBpZiAoY29uZGl0aW9uICE9PSBhc3QuY29uZGl0aW9uIHx8IHRydWVFeHAgIT09IGFzdC50cnVlRXhwIHx8IGZhbHNlRXhwICE9PSBhc3QuZmFsc2VFeHApIHtcbiAgICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWwoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBjb25kaXRpb24sIHRydWVFeHAsIGZhbHNlRXhwKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IGV4cCA9IGFzdC5leHAudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIGlmIChleHAgIT09IGFzdC5leHAgfHwgYXJncyAhPT0gYXN0LmFyZ3MpIHtcbiAgICAgIHJldHVybiBuZXcgQmluZGluZ1BpcGUoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBleHAsIGFzdC5uYW1lLCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IG9iaiA9IGFzdC5vYmoudmlzaXQodGhpcyk7XG4gICAgY29uc3Qga2V5ID0gYXN0LmtleS52aXNpdCh0aGlzKTtcbiAgICBpZiAob2JqICE9PSBhc3Qub2JqIHx8IGtleSAhPT0gYXN0LmtleSkge1xuICAgICAgcmV0dXJuIG5ldyBLZXllZFJlYWQoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBvYmosIGtleSk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGNvbnN0IG9iaiA9IGFzdC5vYmoudmlzaXQodGhpcyk7XG4gICAgY29uc3Qga2V5ID0gYXN0LmtleS52aXNpdCh0aGlzKTtcbiAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZS52aXNpdCh0aGlzKTtcbiAgICBpZiAob2JqICE9PSBhc3Qub2JqIHx8IGtleSAhPT0gYXN0LmtleSB8fCB2YWx1ZSAhPT0gYXN0LnZhbHVlKSB7XG4gICAgICByZXR1cm4gbmV3IEtleWVkV3JpdGUoYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBvYmosIGtleSwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgdmlzaXRBbGwoYXN0czogYW55W10pOiBhbnlbXSB7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgbGV0IG1vZGlmaWVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3RzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBvcmlnaW5hbCA9IGFzdHNbaV07XG4gICAgICBjb25zdCB2YWx1ZSA9IG9yaWdpbmFsLnZpc2l0KHRoaXMpO1xuICAgICAgcmVzW2ldID0gdmFsdWU7XG4gICAgICBtb2RpZmllZCA9IG1vZGlmaWVkIHx8IHZhbHVlICE9PSBvcmlnaW5hbDtcbiAgICB9XG4gICAgcmV0dXJuIG1vZGlmaWVkID8gcmVzIDogYXN0cztcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTtcbiAgICBpZiAoZXhwcmVzc2lvbnMgIT09IGFzdC5leHByZXNzaW9ucykge1xuICAgICAgcmV0dXJuIG5ldyBDaGFpbihhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGV4cHJlc3Npb25zKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KTogQVNUIHsgcmV0dXJuIGFzdDsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRBc3RDaGlsZHJlbihhc3Q6IEFTVCwgdmlzaXRvcjogQXN0VmlzaXRvciwgY29udGV4dD86IGFueSkge1xuICBmdW5jdGlvbiB2aXNpdChhc3Q6IEFTVCkge1xuICAgIHZpc2l0b3IudmlzaXQgJiYgdmlzaXRvci52aXNpdChhc3QsIGNvbnRleHQpIHx8IGFzdC52aXNpdCh2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHZpc2l0QWxsPFQgZXh0ZW5kcyBBU1Q+KGFzdHM6IFRbXSkgeyBhc3RzLmZvckVhY2godmlzaXQpOyB9XG5cbiAgYXN0LnZpc2l0KHtcbiAgICB2aXNpdEJpbmFyeShhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5sZWZ0KTtcbiAgICAgIHZpc2l0KGFzdC5yaWdodCk7XG4gICAgfSxcbiAgICB2aXNpdENoYWluKGFzdCkgeyB2aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpOyB9LFxuICAgIHZpc2l0Q29uZGl0aW9uYWwoYXN0KSB7XG4gICAgICB2aXNpdChhc3QuY29uZGl0aW9uKTtcbiAgICAgIHZpc2l0KGFzdC50cnVlRXhwKTtcbiAgICAgIHZpc2l0KGFzdC5mYWxzZUV4cCk7XG4gICAgfSxcbiAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3QpIHtcbiAgICAgIGlmIChhc3QudGFyZ2V0KSB7XG4gICAgICAgIHZpc2l0KGFzdC50YXJnZXQpO1xuICAgICAgfVxuICAgICAgdmlzaXRBbGwoYXN0LmFyZ3MpO1xuICAgIH0sXG4gICAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdCkge30sXG4gICAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdCkgeyB2aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpOyB9LFxuICAgIHZpc2l0S2V5ZWRSZWFkKGFzdCkge1xuICAgICAgdmlzaXQoYXN0Lm9iaik7XG4gICAgICB2aXNpdChhc3Qua2V5KTtcbiAgICB9LFxuICAgIHZpc2l0S2V5ZWRXcml0ZShhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5vYmopO1xuICAgICAgdmlzaXQoYXN0LmtleSk7XG4gICAgICB2aXNpdChhc3Qub2JqKTtcbiAgICB9LFxuICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdCkgeyB2aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpOyB9LFxuICAgIHZpc2l0TGl0ZXJhbE1hcChhc3QpIHt9LFxuICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3QpIHt9LFxuICAgIHZpc2l0TWV0aG9kQ2FsbChhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5yZWNlaXZlcik7XG4gICAgICB2aXNpdEFsbChhc3QuYXJncyk7XG4gICAgfSxcbiAgICB2aXNpdFBpcGUoYXN0KSB7XG4gICAgICB2aXNpdChhc3QuZXhwKTtcbiAgICAgIHZpc2l0QWxsKGFzdC5hcmdzKTtcbiAgICB9LFxuICAgIHZpc2l0UHJlZml4Tm90KGFzdCkgeyB2aXNpdChhc3QuZXhwcmVzc2lvbik7IH0sXG4gICAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdCkgeyB2aXNpdChhc3QuZXhwcmVzc2lvbik7IH0sXG4gICAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0KSB7IHZpc2l0KGFzdC5yZWNlaXZlcik7IH0sXG4gICAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCkge1xuICAgICAgdmlzaXQoYXN0LnJlY2VpdmVyKTtcbiAgICAgIHZpc2l0KGFzdC52YWx1ZSk7XG4gICAgfSxcbiAgICB2aXNpdFF1b3RlKGFzdCkge30sXG4gICAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3QpIHtcbiAgICAgIHZpc2l0KGFzdC5yZWNlaXZlcik7XG4gICAgICB2aXNpdEFsbChhc3QuYXJncyk7XG4gICAgfSxcbiAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0KSB7IHZpc2l0KGFzdC5yZWNlaXZlcik7IH0sXG4gIH0pO1xufVxuXG5cbi8vIEJpbmRpbmdzXG5cbmV4cG9ydCBjbGFzcyBQYXJzZWRQcm9wZXJ0eSB7XG4gIHB1YmxpYyByZWFkb25seSBpc0xpdGVyYWw6IGJvb2xlYW47XG4gIHB1YmxpYyByZWFkb25seSBpc0FuaW1hdGlvbjogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBleHByZXNzaW9uOiBBU1RXaXRoU291cmNlLCBwdWJsaWMgdHlwZTogUGFyc2VkUHJvcGVydHlUeXBlLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuaXNMaXRlcmFsID0gdGhpcy50eXBlID09PSBQYXJzZWRQcm9wZXJ0eVR5cGUuTElURVJBTF9BVFRSO1xuICAgIHRoaXMuaXNBbmltYXRpb24gPSB0aGlzLnR5cGUgPT09IFBhcnNlZFByb3BlcnR5VHlwZS5BTklNQVRJT047XG4gIH1cbn1cblxuZXhwb3J0IGVudW0gUGFyc2VkUHJvcGVydHlUeXBlIHtcbiAgREVGQVVMVCxcbiAgTElURVJBTF9BVFRSLFxuICBBTklNQVRJT05cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gUGFyc2VkRXZlbnRUeXBlIHtcbiAgLy8gRE9NIG9yIERpcmVjdGl2ZSBldmVudFxuICBSZWd1bGFyLFxuICAvLyBBbmltYXRpb24gc3BlY2lmaWMgZXZlbnRcbiAgQW5pbWF0aW9uLFxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VkRXZlbnQge1xuICAvLyBSZWd1bGFyIGV2ZW50cyBoYXZlIGEgdGFyZ2V0XG4gIC8vIEFuaW1hdGlvbiBldmVudHMgaGF2ZSBhIHBoYXNlXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHRhcmdldE9yUGhhc2U6IHN0cmluZywgcHVibGljIHR5cGU6IFBhcnNlZEV2ZW50VHlwZSxcbiAgICAgIHB1YmxpYyBoYW5kbGVyOiBBU1QsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlZFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEJpbmRpbmdUeXBlIHtcbiAgLy8gQSByZWd1bGFyIGJpbmRpbmcgdG8gYSBwcm9wZXJ0eSAoZS5nLiBgW3Byb3BlcnR5XT1cImV4cHJlc3Npb25cImApLlxuICBQcm9wZXJ0eSxcbiAgLy8gQSBiaW5kaW5nIHRvIGFuIGVsZW1lbnQgYXR0cmlidXRlIChlLmcuIGBbYXR0ci5uYW1lXT1cImV4cHJlc3Npb25cImApLlxuICBBdHRyaWJ1dGUsXG4gIC8vIEEgYmluZGluZyB0byBhIENTUyBjbGFzcyAoZS5nLiBgW2NsYXNzLm5hbWVdPVwiY29uZGl0aW9uXCJgKS5cbiAgQ2xhc3MsXG4gIC8vIEEgYmluZGluZyB0byBhIHN0eWxlIHJ1bGUgKGUuZy4gYFtzdHlsZS5ydWxlXT1cImV4cHJlc3Npb25cImApLlxuICBTdHlsZSxcbiAgLy8gQSBiaW5kaW5nIHRvIGFuIGFuaW1hdGlvbiByZWZlcmVuY2UgKGUuZy4gYFthbmltYXRlLmtleV09XCJleHByZXNzaW9uXCJgKS5cbiAgQW5pbWF0aW9uLFxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRFbGVtZW50UHJvcGVydHkge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBCaW5kaW5nVHlwZSwgcHVibGljIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICAgICAgcHVibGljIHZhbHVlOiBBU1QsIHB1YmxpYyB1bml0OiBzdHJpbmd8bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHt9XG59XG4iXX0=