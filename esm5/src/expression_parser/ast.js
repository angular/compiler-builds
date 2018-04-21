/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
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
function ParserError_tsickle_Closure_declarations() {
    /** @type {?} */
    ParserError.prototype.message;
    /** @type {?} */
    ParserError.prototype.input;
    /** @type {?} */
    ParserError.prototype.errLocation;
    /** @type {?} */
    ParserError.prototype.ctxLocation;
}
var ParseSpan = /** @class */ (function () {
    function ParseSpan(start, end) {
        this.start = start;
        this.end = end;
    }
    return ParseSpan;
}());
export { ParseSpan };
function ParseSpan_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseSpan.prototype.start;
    /** @type {?} */
    ParseSpan.prototype.end;
}
var AST = /** @class */ (function () {
    function AST(span) {
        this.span = span;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    AST.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return null;
    };
    /**
     * @return {?}
     */
    AST.prototype.toString = /**
     * @return {?}
     */
    function () { return 'AST'; };
    return AST;
}());
export { AST };
function AST_tsickle_Closure_declarations() {
    /** @type {?} */
    AST.prototype.span;
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
var /**
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
Quote = /** @class */ (function (_super) {
    tslib_1.__extends(Quote, _super);
    function Quote(span, prefix, uninterpretedExpression, location) {
        var _this = _super.call(this, span) || this;
        _this.prefix = prefix;
        _this.uninterpretedExpression = uninterpretedExpression;
        _this.location = location;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    Quote.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitQuote(this, context);
    };
    /**
     * @return {?}
     */
    Quote.prototype.toString = /**
     * @return {?}
     */
    function () { return 'Quote'; };
    return Quote;
}(AST));
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
export { Quote };
function Quote_tsickle_Closure_declarations() {
    /** @type {?} */
    Quote.prototype.prefix;
    /** @type {?} */
    Quote.prototype.uninterpretedExpression;
    /** @type {?} */
    Quote.prototype.location;
}
var EmptyExpr = /** @class */ (function (_super) {
    tslib_1.__extends(EmptyExpr, _super);
    function EmptyExpr() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    EmptyExpr.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
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
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    ImplicitReceiver.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitImplicitReceiver(this, context);
    };
    return ImplicitReceiver;
}(AST));
export { ImplicitReceiver };
/**
 * Multiple expressions separated by a semicolon.
 */
var /**
 * Multiple expressions separated by a semicolon.
 */
Chain = /** @class */ (function (_super) {
    tslib_1.__extends(Chain, _super);
    function Chain(span, expressions) {
        var _this = _super.call(this, span) || this;
        _this.expressions = expressions;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    Chain.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitChain(this, context);
    };
    return Chain;
}(AST));
/**
 * Multiple expressions separated by a semicolon.
 */
export { Chain };
function Chain_tsickle_Closure_declarations() {
    /** @type {?} */
    Chain.prototype.expressions;
}
var Conditional = /** @class */ (function (_super) {
    tslib_1.__extends(Conditional, _super);
    function Conditional(span, condition, trueExp, falseExp) {
        var _this = _super.call(this, span) || this;
        _this.condition = condition;
        _this.trueExp = trueExp;
        _this.falseExp = falseExp;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    Conditional.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitConditional(this, context);
    };
    return Conditional;
}(AST));
export { Conditional };
function Conditional_tsickle_Closure_declarations() {
    /** @type {?} */
    Conditional.prototype.condition;
    /** @type {?} */
    Conditional.prototype.trueExp;
    /** @type {?} */
    Conditional.prototype.falseExp;
}
var PropertyRead = /** @class */ (function (_super) {
    tslib_1.__extends(PropertyRead, _super);
    function PropertyRead(span, receiver, name) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    PropertyRead.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPropertyRead(this, context);
    };
    return PropertyRead;
}(AST));
export { PropertyRead };
function PropertyRead_tsickle_Closure_declarations() {
    /** @type {?} */
    PropertyRead.prototype.receiver;
    /** @type {?} */
    PropertyRead.prototype.name;
}
var PropertyWrite = /** @class */ (function (_super) {
    tslib_1.__extends(PropertyWrite, _super);
    function PropertyWrite(span, receiver, name, value) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    PropertyWrite.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPropertyWrite(this, context);
    };
    return PropertyWrite;
}(AST));
export { PropertyWrite };
function PropertyWrite_tsickle_Closure_declarations() {
    /** @type {?} */
    PropertyWrite.prototype.receiver;
    /** @type {?} */
    PropertyWrite.prototype.name;
    /** @type {?} */
    PropertyWrite.prototype.value;
}
var SafePropertyRead = /** @class */ (function (_super) {
    tslib_1.__extends(SafePropertyRead, _super);
    function SafePropertyRead(span, receiver, name) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    SafePropertyRead.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitSafePropertyRead(this, context);
    };
    return SafePropertyRead;
}(AST));
export { SafePropertyRead };
function SafePropertyRead_tsickle_Closure_declarations() {
    /** @type {?} */
    SafePropertyRead.prototype.receiver;
    /** @type {?} */
    SafePropertyRead.prototype.name;
}
var KeyedRead = /** @class */ (function (_super) {
    tslib_1.__extends(KeyedRead, _super);
    function KeyedRead(span, obj, key) {
        var _this = _super.call(this, span) || this;
        _this.obj = obj;
        _this.key = key;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    KeyedRead.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitKeyedRead(this, context);
    };
    return KeyedRead;
}(AST));
export { KeyedRead };
function KeyedRead_tsickle_Closure_declarations() {
    /** @type {?} */
    KeyedRead.prototype.obj;
    /** @type {?} */
    KeyedRead.prototype.key;
}
var KeyedWrite = /** @class */ (function (_super) {
    tslib_1.__extends(KeyedWrite, _super);
    function KeyedWrite(span, obj, key, value) {
        var _this = _super.call(this, span) || this;
        _this.obj = obj;
        _this.key = key;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    KeyedWrite.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitKeyedWrite(this, context);
    };
    return KeyedWrite;
}(AST));
export { KeyedWrite };
function KeyedWrite_tsickle_Closure_declarations() {
    /** @type {?} */
    KeyedWrite.prototype.obj;
    /** @type {?} */
    KeyedWrite.prototype.key;
    /** @type {?} */
    KeyedWrite.prototype.value;
}
var BindingPipe = /** @class */ (function (_super) {
    tslib_1.__extends(BindingPipe, _super);
    function BindingPipe(span, exp, name, args) {
        var _this = _super.call(this, span) || this;
        _this.exp = exp;
        _this.name = name;
        _this.args = args;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    BindingPipe.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPipe(this, context);
    };
    return BindingPipe;
}(AST));
export { BindingPipe };
function BindingPipe_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingPipe.prototype.exp;
    /** @type {?} */
    BindingPipe.prototype.name;
    /** @type {?} */
    BindingPipe.prototype.args;
}
var LiteralPrimitive = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralPrimitive, _super);
    function LiteralPrimitive(span, value) {
        var _this = _super.call(this, span) || this;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    LiteralPrimitive.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitLiteralPrimitive(this, context);
    };
    return LiteralPrimitive;
}(AST));
export { LiteralPrimitive };
function LiteralPrimitive_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralPrimitive.prototype.value;
}
var LiteralArray = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralArray, _super);
    function LiteralArray(span, expressions) {
        var _this = _super.call(this, span) || this;
        _this.expressions = expressions;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    LiteralArray.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitLiteralArray(this, context);
    };
    return LiteralArray;
}(AST));
export { LiteralArray };
function LiteralArray_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralArray.prototype.expressions;
}
var LiteralMap = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralMap, _super);
    function LiteralMap(span, keys, values) {
        var _this = _super.call(this, span) || this;
        _this.keys = keys;
        _this.values = values;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    LiteralMap.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitLiteralMap(this, context);
    };
    return LiteralMap;
}(AST));
export { LiteralMap };
function LiteralMap_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralMap.prototype.keys;
    /** @type {?} */
    LiteralMap.prototype.values;
}
var Interpolation = /** @class */ (function (_super) {
    tslib_1.__extends(Interpolation, _super);
    function Interpolation(span, strings, expressions) {
        var _this = _super.call(this, span) || this;
        _this.strings = strings;
        _this.expressions = expressions;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    Interpolation.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitInterpolation(this, context);
    };
    return Interpolation;
}(AST));
export { Interpolation };
function Interpolation_tsickle_Closure_declarations() {
    /** @type {?} */
    Interpolation.prototype.strings;
    /** @type {?} */
    Interpolation.prototype.expressions;
}
var Binary = /** @class */ (function (_super) {
    tslib_1.__extends(Binary, _super);
    function Binary(span, operation, left, right) {
        var _this = _super.call(this, span) || this;
        _this.operation = operation;
        _this.left = left;
        _this.right = right;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    Binary.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitBinary(this, context);
    };
    return Binary;
}(AST));
export { Binary };
function Binary_tsickle_Closure_declarations() {
    /** @type {?} */
    Binary.prototype.operation;
    /** @type {?} */
    Binary.prototype.left;
    /** @type {?} */
    Binary.prototype.right;
}
var PrefixNot = /** @class */ (function (_super) {
    tslib_1.__extends(PrefixNot, _super);
    function PrefixNot(span, expression) {
        var _this = _super.call(this, span) || this;
        _this.expression = expression;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    PrefixNot.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitPrefixNot(this, context);
    };
    return PrefixNot;
}(AST));
export { PrefixNot };
function PrefixNot_tsickle_Closure_declarations() {
    /** @type {?} */
    PrefixNot.prototype.expression;
}
var NonNullAssert = /** @class */ (function (_super) {
    tslib_1.__extends(NonNullAssert, _super);
    function NonNullAssert(span, expression) {
        var _this = _super.call(this, span) || this;
        _this.expression = expression;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    NonNullAssert.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitNonNullAssert(this, context);
    };
    return NonNullAssert;
}(AST));
export { NonNullAssert };
function NonNullAssert_tsickle_Closure_declarations() {
    /** @type {?} */
    NonNullAssert.prototype.expression;
}
var MethodCall = /** @class */ (function (_super) {
    tslib_1.__extends(MethodCall, _super);
    function MethodCall(span, receiver, name, args) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.args = args;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    MethodCall.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitMethodCall(this, context);
    };
    return MethodCall;
}(AST));
export { MethodCall };
function MethodCall_tsickle_Closure_declarations() {
    /** @type {?} */
    MethodCall.prototype.receiver;
    /** @type {?} */
    MethodCall.prototype.name;
    /** @type {?} */
    MethodCall.prototype.args;
}
var SafeMethodCall = /** @class */ (function (_super) {
    tslib_1.__extends(SafeMethodCall, _super);
    function SafeMethodCall(span, receiver, name, args) {
        var _this = _super.call(this, span) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.args = args;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    SafeMethodCall.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitSafeMethodCall(this, context);
    };
    return SafeMethodCall;
}(AST));
export { SafeMethodCall };
function SafeMethodCall_tsickle_Closure_declarations() {
    /** @type {?} */
    SafeMethodCall.prototype.receiver;
    /** @type {?} */
    SafeMethodCall.prototype.name;
    /** @type {?} */
    SafeMethodCall.prototype.args;
}
var FunctionCall = /** @class */ (function (_super) {
    tslib_1.__extends(FunctionCall, _super);
    function FunctionCall(span, target, args) {
        var _this = _super.call(this, span) || this;
        _this.target = target;
        _this.args = args;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    FunctionCall.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return visitor.visitFunctionCall(this, context);
    };
    return FunctionCall;
}(AST));
export { FunctionCall };
function FunctionCall_tsickle_Closure_declarations() {
    /** @type {?} */
    FunctionCall.prototype.target;
    /** @type {?} */
    FunctionCall.prototype.args;
}
var ASTWithSource = /** @class */ (function (_super) {
    tslib_1.__extends(ASTWithSource, _super);
    function ASTWithSource(ast, source, location, errors) {
        var _this = _super.call(this, new ParseSpan(0, source == null ? 0 : source.length)) || this;
        _this.ast = ast;
        _this.source = source;
        _this.location = location;
        _this.errors = errors;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    ASTWithSource.prototype.visit = /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === void 0) { context = null; }
        return this.ast.visit(visitor, context);
    };
    /**
     * @return {?}
     */
    ASTWithSource.prototype.toString = /**
     * @return {?}
     */
    function () { return this.source + " in " + this.location; };
    return ASTWithSource;
}(AST));
export { ASTWithSource };
function ASTWithSource_tsickle_Closure_declarations() {
    /** @type {?} */
    ASTWithSource.prototype.ast;
    /** @type {?} */
    ASTWithSource.prototype.source;
    /** @type {?} */
    ASTWithSource.prototype.location;
    /** @type {?} */
    ASTWithSource.prototype.errors;
}
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
function TemplateBinding_tsickle_Closure_declarations() {
    /** @type {?} */
    TemplateBinding.prototype.span;
    /** @type {?} */
    TemplateBinding.prototype.key;
    /** @type {?} */
    TemplateBinding.prototype.keyIsVar;
    /** @type {?} */
    TemplateBinding.prototype.name;
    /** @type {?} */
    TemplateBinding.prototype.expression;
}
/**
 * @record
 */
export function AstVisitor() { }
function AstVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    AstVisitor.prototype.visitBinary;
    /** @type {?} */
    AstVisitor.prototype.visitChain;
    /** @type {?} */
    AstVisitor.prototype.visitConditional;
    /** @type {?} */
    AstVisitor.prototype.visitFunctionCall;
    /** @type {?} */
    AstVisitor.prototype.visitImplicitReceiver;
    /** @type {?} */
    AstVisitor.prototype.visitInterpolation;
    /** @type {?} */
    AstVisitor.prototype.visitKeyedRead;
    /** @type {?} */
    AstVisitor.prototype.visitKeyedWrite;
    /** @type {?} */
    AstVisitor.prototype.visitLiteralArray;
    /** @type {?} */
    AstVisitor.prototype.visitLiteralMap;
    /** @type {?} */
    AstVisitor.prototype.visitLiteralPrimitive;
    /** @type {?} */
    AstVisitor.prototype.visitMethodCall;
    /** @type {?} */
    AstVisitor.prototype.visitPipe;
    /** @type {?} */
    AstVisitor.prototype.visitPrefixNot;
    /** @type {?} */
    AstVisitor.prototype.visitNonNullAssert;
    /** @type {?} */
    AstVisitor.prototype.visitPropertyRead;
    /** @type {?} */
    AstVisitor.prototype.visitPropertyWrite;
    /** @type {?} */
    AstVisitor.prototype.visitQuote;
    /** @type {?} */
    AstVisitor.prototype.visitSafeMethodCall;
    /** @type {?} */
    AstVisitor.prototype.visitSafePropertyRead;
    /** @type {?|undefined} */
    AstVisitor.prototype.visit;
}
var NullAstVisitor = /** @class */ (function () {
    function NullAstVisitor() {
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitBinary = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitChain = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitConditional = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitFunctionCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitImplicitReceiver = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitInterpolation = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitKeyedRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitKeyedWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitLiteralArray = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitLiteralMap = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitLiteralPrimitive = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitPipe = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitPrefixNot = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitNonNullAssert = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitPropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitPropertyWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitQuote = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitSafeMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    NullAstVisitor.prototype.visitSafePropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    return NullAstVisitor;
}());
export { NullAstVisitor };
var RecursiveAstVisitor = /** @class */ (function () {
    function RecursiveAstVisitor() {
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitBinary = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.left.visit(this);
        ast.right.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitChain = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return this.visitAll(ast.expressions, context); };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitConditional = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.condition.visit(this);
        ast.trueExp.visit(this);
        ast.falseExp.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitPipe = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.exp.visit(this);
        this.visitAll(ast.args, context);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitFunctionCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        /** @type {?} */ ((ast.target)).visit(this);
        this.visitAll(ast.args, context);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitImplicitReceiver = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return null; };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitInterpolation = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.visitAll(ast.expressions, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitKeyedRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.obj.visit(this);
        ast.key.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitKeyedWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.obj.visit(this);
        ast.key.visit(this);
        ast.value.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitLiteralArray = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.visitAll(ast.expressions, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitLiteralMap = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return this.visitAll(ast.values, context); };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitLiteralPrimitive = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return null; };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visit(this);
        return this.visitAll(ast.args, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitPrefixNot = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.expression.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitNonNullAssert = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.expression.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitPropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitPropertyWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visit(this);
        ast.value.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitSafePropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visit(this);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitSafeMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visit(this);
        return this.visitAll(ast.args, context);
    };
    /**
     * @param {?} asts
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitAll = /**
     * @param {?} asts
     * @param {?} context
     * @return {?}
     */
    function (asts, context) {
        var _this = this;
        asts.forEach(function (ast) { return ast.visit(_this, context); });
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitQuote = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return null; };
    return RecursiveAstVisitor;
}());
export { RecursiveAstVisitor };
var AstTransformer = /** @class */ (function () {
    function AstTransformer() {
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitImplicitReceiver = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return ast; };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitInterpolation = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new Interpolation(ast.span, ast.strings, this.visitAll(ast.expressions));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitLiteralPrimitive = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new LiteralPrimitive(ast.span, ast.value);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitPropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new PropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitPropertyWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new PropertyWrite(ast.span, ast.receiver.visit(this), ast.name, ast.value.visit(this));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitSafePropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new SafePropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new MethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitSafeMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new SafeMethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitFunctionCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new FunctionCall(ast.span, /** @type {?} */ ((ast.target)).visit(this), this.visitAll(ast.args));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitLiteralArray = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new LiteralArray(ast.span, this.visitAll(ast.expressions));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitLiteralMap = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new LiteralMap(ast.span, ast.keys, this.visitAll(ast.values));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitBinary = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new Binary(ast.span, ast.operation, ast.left.visit(this), ast.right.visit(this));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitPrefixNot = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new PrefixNot(ast.span, ast.expression.visit(this));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitNonNullAssert = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new NonNullAssert(ast.span, ast.expression.visit(this));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitConditional = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new Conditional(ast.span, ast.condition.visit(this), ast.trueExp.visit(this), ast.falseExp.visit(this));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitPipe = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new BindingPipe(ast.span, ast.exp.visit(this), ast.name, this.visitAll(ast.args));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitKeyedRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new KeyedRead(ast.span, ast.obj.visit(this), ast.key.visit(this));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitKeyedWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new KeyedWrite(ast.span, ast.obj.visit(this), ast.key.visit(this), ast.value.visit(this));
    };
    /**
     * @param {?} asts
     * @return {?}
     */
    AstTransformer.prototype.visitAll = /**
     * @param {?} asts
     * @return {?}
     */
    function (asts) {
        var /** @type {?} */ res = new Array(asts.length);
        for (var /** @type {?} */ i = 0; i < asts.length; ++i) {
            res[i] = asts[i].visit(this);
        }
        return res;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitChain = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new Chain(ast.span, this.visitAll(ast.expressions));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitQuote = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return new Quote(ast.span, ast.prefix, ast.uninterpretedExpression, ast.location);
    };
    return AstTransformer;
}());
export { AstTransformer };
var AstMemoryEfficientTransformer = /** @class */ (function () {
    function AstMemoryEfficientTransformer() {
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitImplicitReceiver = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return ast; };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitInterpolation = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions)
            return new Interpolation(ast.span, ast.strings, expressions);
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitLiteralPrimitive = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return ast; };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitPropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new PropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitPropertyWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ receiver = ast.receiver.visit(this);
        var /** @type {?} */ value = ast.value.visit(this);
        if (receiver !== ast.receiver || value !== ast.value) {
            return new PropertyWrite(ast.span, receiver, ast.name, value);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitSafePropertyRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new SafePropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new MethodCall(ast.span, receiver, ast.name, this.visitAll(ast.args));
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitSafeMethodCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ receiver = ast.receiver.visit(this);
        var /** @type {?} */ args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new SafeMethodCall(ast.span, receiver, ast.name, args);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitFunctionCall = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ target = ast.target && ast.target.visit(this);
        var /** @type {?} */ args = this.visitAll(ast.args);
        if (target !== ast.target || args !== ast.args) {
            return new FunctionCall(ast.span, target, args);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitLiteralArray = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new LiteralArray(ast.span, expressions);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitLiteralMap = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ values = this.visitAll(ast.values);
        if (values !== ast.values) {
            return new LiteralMap(ast.span, ast.keys, values);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitBinary = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ left = ast.left.visit(this);
        var /** @type {?} */ right = ast.right.visit(this);
        if (left !== ast.left || right !== ast.right) {
            return new Binary(ast.span, ast.operation, left, right);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitPrefixNot = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new PrefixNot(ast.span, expression);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitNonNullAssert = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new NonNullAssert(ast.span, expression);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitConditional = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ condition = ast.condition.visit(this);
        var /** @type {?} */ trueExp = ast.trueExp.visit(this);
        var /** @type {?} */ falseExp = ast.falseExp.visit(this);
        if (condition !== ast.condition || trueExp !== ast.trueExp || falseExp !== falseExp) {
            return new Conditional(ast.span, condition, trueExp, falseExp);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitPipe = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ exp = ast.exp.visit(this);
        var /** @type {?} */ args = this.visitAll(ast.args);
        if (exp !== ast.exp || args !== ast.args) {
            return new BindingPipe(ast.span, exp, ast.name, args);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitKeyedRead = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ obj = ast.obj.visit(this);
        var /** @type {?} */ key = ast.key.visit(this);
        if (obj !== ast.obj || key !== ast.key) {
            return new KeyedRead(ast.span, obj, key);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitKeyedWrite = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ obj = ast.obj.visit(this);
        var /** @type {?} */ key = ast.key.visit(this);
        var /** @type {?} */ value = ast.value.visit(this);
        if (obj !== ast.obj || key !== ast.key || value !== ast.value) {
            return new KeyedWrite(ast.span, obj, key, value);
        }
        return ast;
    };
    /**
     * @param {?} asts
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitAll = /**
     * @param {?} asts
     * @return {?}
     */
    function (asts) {
        var /** @type {?} */ res = new Array(asts.length);
        var /** @type {?} */ modified = false;
        for (var /** @type {?} */ i = 0; i < asts.length; ++i) {
            var /** @type {?} */ original = asts[i];
            var /** @type {?} */ value = original.visit(this);
            res[i] = value;
            modified = modified || value !== original;
        }
        return modified ? res : asts;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitChain = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new Chain(ast.span, expressions);
        }
        return ast;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstMemoryEfficientTransformer.prototype.visitQuote = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return ast; };
    return AstMemoryEfficientTransformer;
}());
export { AstMemoryEfficientTransformer };
/**
 * @param {?} ast
 * @param {?} visitor
 * @param {?=} context
 * @return {?}
 */
export function visitAstChildren(ast, visitor, context) {
    /**
     * @param {?} ast
     * @return {?}
     */
    function visit(ast) {
        visitor.visit && visitor.visit(ast, context) || ast.visit(visitor, context);
    }
    /**
     * @template T
     * @param {?} asts
     * @return {?}
     */
    function visitAll(asts) { asts.forEach(visit); }
    ast.visit({
        visitBinary: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.left);
            visit(ast.right);
        },
        visitChain: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visitAll(ast.expressions); },
        visitConditional: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.condition);
            visit(ast.trueExp);
            visit(ast.falseExp);
        },
        visitFunctionCall: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            if (ast.target) {
                visit(ast.target);
            }
            visitAll(ast.args);
        },
        visitImplicitReceiver: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { },
        visitInterpolation: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visitAll(ast.expressions); },
        visitKeyedRead: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.obj);
            visit(ast.key);
        },
        visitKeyedWrite: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.obj);
            visit(ast.key);
            visit(ast.obj);
        },
        visitLiteralArray: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visitAll(ast.expressions); },
        visitLiteralMap: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { },
        visitLiteralPrimitive: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { },
        visitMethodCall: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        visitPipe: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.exp);
            visitAll(ast.args);
        },
        visitPrefixNot: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visit(ast.expression); },
        visitNonNullAssert: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visit(ast.expression); },
        visitPropertyRead: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visit(ast.receiver); },
        visitPropertyWrite: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.receiver);
            visit(ast.value);
        },
        visitQuote: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { },
        visitSafeMethodCall: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        visitSafePropertyRead: /**
         * @param {?} ast
         * @return {?}
         */
        function (ast) { visit(ast.receiver); },
    });
}
var ParsedProperty = /** @class */ (function () {
    function ParsedProperty(name, expression, type, sourceSpan) {
        this.name = name;
        this.expression = expression;
        this.type = type;
        this.sourceSpan = sourceSpan;
        this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
        this.isAnimation = this.type === ParsedPropertyType.ANIMATION;
    }
    return ParsedProperty;
}());
export { ParsedProperty };
function ParsedProperty_tsickle_Closure_declarations() {
    /** @type {?} */
    ParsedProperty.prototype.isLiteral;
    /** @type {?} */
    ParsedProperty.prototype.isAnimation;
    /** @type {?} */
    ParsedProperty.prototype.name;
    /** @type {?} */
    ParsedProperty.prototype.expression;
    /** @type {?} */
    ParsedProperty.prototype.type;
    /** @type {?} */
    ParsedProperty.prototype.sourceSpan;
}
/** @enum {number} */
var ParsedPropertyType = {
    DEFAULT: 0,
    LITERAL_ATTR: 1,
    ANIMATION: 2,
};
export { ParsedPropertyType };
ParsedPropertyType[ParsedPropertyType.DEFAULT] = "DEFAULT";
ParsedPropertyType[ParsedPropertyType.LITERAL_ATTR] = "LITERAL_ATTR";
ParsedPropertyType[ParsedPropertyType.ANIMATION] = "ANIMATION";
/** @enum {number} */
var ParsedEventType = {
    // DOM or Directive event
    Regular: 0,
    // Animation specific event
    Animation: 1,
};
export { ParsedEventType };
var ParsedEvent = /** @class */ (function () {
    // Regular events have a target
    // Animation events have a phase
    function ParsedEvent(name, targetOrPhase, type, handler, sourceSpan) {
        this.name = name;
        this.targetOrPhase = targetOrPhase;
        this.type = type;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
    }
    return ParsedEvent;
}());
export { ParsedEvent };
function ParsedEvent_tsickle_Closure_declarations() {
    /** @type {?} */
    ParsedEvent.prototype.name;
    /** @type {?} */
    ParsedEvent.prototype.targetOrPhase;
    /** @type {?} */
    ParsedEvent.prototype.type;
    /** @type {?} */
    ParsedEvent.prototype.handler;
    /** @type {?} */
    ParsedEvent.prototype.sourceSpan;
}
var ParsedVariable = /** @class */ (function () {
    function ParsedVariable(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    return ParsedVariable;
}());
export { ParsedVariable };
function ParsedVariable_tsickle_Closure_declarations() {
    /** @type {?} */
    ParsedVariable.prototype.name;
    /** @type {?} */
    ParsedVariable.prototype.value;
    /** @type {?} */
    ParsedVariable.prototype.sourceSpan;
}
/** @enum {number} */
var BoundElementBindingType = {
    // A regular binding to a property (e.g. `[property]="expression"`).
    Property: 0,
    // A binding to an element attribute (e.g. `[attr.name]="expression"`).
    Attribute: 1,
    // A binding to a CSS class (e.g. `[class.name]="condition"`).
    Class: 2,
    // A binding to a style rule (e.g. `[style.rule]="expression"`).
    Style: 3,
    // A binding to an animation reference (e.g. `[animate.key]="expression"`).
    Animation: 4,
};
export { BoundElementBindingType };
var BoundElementProperty = /** @class */ (function () {
    function BoundElementProperty(name, type, securityContext, value, unit, sourceSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
    }
    return BoundElementProperty;
}());
export { BoundElementProperty };
function BoundElementProperty_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundElementProperty.prototype.name;
    /** @type {?} */
    BoundElementProperty.prototype.type;
    /** @type {?} */
    BoundElementProperty.prototype.securityContext;
    /** @type {?} */
    BoundElementProperty.prototype.value;
    /** @type {?} */
    BoundElementProperty.prototype.unit;
    /** @type {?} */
    BoundElementProperty.prototype.sourceSpan;
}
//# sourceMappingURL=ast.js.map