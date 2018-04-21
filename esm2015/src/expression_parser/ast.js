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
export class ParserError {
    /**
     * @param {?} message
     * @param {?} input
     * @param {?} errLocation
     * @param {?=} ctxLocation
     */
    constructor(message, input, errLocation, ctxLocation) {
        this.input = input;
        this.errLocation = errLocation;
        this.ctxLocation = ctxLocation;
        this.message = `Parser Error: ${message} ${errLocation} [${input}] in ${ctxLocation}`;
    }
}
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
export class ParseSpan {
    /**
     * @param {?} start
     * @param {?} end
     */
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
function ParseSpan_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseSpan.prototype.start;
    /** @type {?} */
    ParseSpan.prototype.end;
}
export class AST {
    /**
     * @param {?} span
     */
    constructor(span) {
        this.span = span;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) { return null; }
    /**
     * @return {?}
     */
    toString() { return 'AST'; }
}
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
export class Quote extends AST {
    /**
     * @param {?} span
     * @param {?} prefix
     * @param {?} uninterpretedExpression
     * @param {?} location
     */
    constructor(span, prefix, uninterpretedExpression, location) {
        super(span);
        this.prefix = prefix;
        this.uninterpretedExpression = uninterpretedExpression;
        this.location = location;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) { return visitor.visitQuote(this, context); }
    /**
     * @return {?}
     */
    toString() { return 'Quote'; }
}
function Quote_tsickle_Closure_declarations() {
    /** @type {?} */
    Quote.prototype.prefix;
    /** @type {?} */
    Quote.prototype.uninterpretedExpression;
    /** @type {?} */
    Quote.prototype.location;
}
export class EmptyExpr extends AST {
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        // do nothing
    }
}
export class ImplicitReceiver extends AST {
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitImplicitReceiver(this, context);
    }
}
/**
 * Multiple expressions separated by a semicolon.
 */
export class Chain extends AST {
    /**
     * @param {?} span
     * @param {?} expressions
     */
    constructor(span, expressions) {
        super(span);
        this.expressions = expressions;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) { return visitor.visitChain(this, context); }
}
function Chain_tsickle_Closure_declarations() {
    /** @type {?} */
    Chain.prototype.expressions;
}
export class Conditional extends AST {
    /**
     * @param {?} span
     * @param {?} condition
     * @param {?} trueExp
     * @param {?} falseExp
     */
    constructor(span, condition, trueExp, falseExp) {
        super(span);
        this.condition = condition;
        this.trueExp = trueExp;
        this.falseExp = falseExp;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitConditional(this, context);
    }
}
function Conditional_tsickle_Closure_declarations() {
    /** @type {?} */
    Conditional.prototype.condition;
    /** @type {?} */
    Conditional.prototype.trueExp;
    /** @type {?} */
    Conditional.prototype.falseExp;
}
export class PropertyRead extends AST {
    /**
     * @param {?} span
     * @param {?} receiver
     * @param {?} name
     */
    constructor(span, receiver, name) {
        super(span);
        this.receiver = receiver;
        this.name = name;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitPropertyRead(this, context);
    }
}
function PropertyRead_tsickle_Closure_declarations() {
    /** @type {?} */
    PropertyRead.prototype.receiver;
    /** @type {?} */
    PropertyRead.prototype.name;
}
export class PropertyWrite extends AST {
    /**
     * @param {?} span
     * @param {?} receiver
     * @param {?} name
     * @param {?} value
     */
    constructor(span, receiver, name, value) {
        super(span);
        this.receiver = receiver;
        this.name = name;
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitPropertyWrite(this, context);
    }
}
function PropertyWrite_tsickle_Closure_declarations() {
    /** @type {?} */
    PropertyWrite.prototype.receiver;
    /** @type {?} */
    PropertyWrite.prototype.name;
    /** @type {?} */
    PropertyWrite.prototype.value;
}
export class SafePropertyRead extends AST {
    /**
     * @param {?} span
     * @param {?} receiver
     * @param {?} name
     */
    constructor(span, receiver, name) {
        super(span);
        this.receiver = receiver;
        this.name = name;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitSafePropertyRead(this, context);
    }
}
function SafePropertyRead_tsickle_Closure_declarations() {
    /** @type {?} */
    SafePropertyRead.prototype.receiver;
    /** @type {?} */
    SafePropertyRead.prototype.name;
}
export class KeyedRead extends AST {
    /**
     * @param {?} span
     * @param {?} obj
     * @param {?} key
     */
    constructor(span, obj, key) {
        super(span);
        this.obj = obj;
        this.key = key;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitKeyedRead(this, context);
    }
}
function KeyedRead_tsickle_Closure_declarations() {
    /** @type {?} */
    KeyedRead.prototype.obj;
    /** @type {?} */
    KeyedRead.prototype.key;
}
export class KeyedWrite extends AST {
    /**
     * @param {?} span
     * @param {?} obj
     * @param {?} key
     * @param {?} value
     */
    constructor(span, obj, key, value) {
        super(span);
        this.obj = obj;
        this.key = key;
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitKeyedWrite(this, context);
    }
}
function KeyedWrite_tsickle_Closure_declarations() {
    /** @type {?} */
    KeyedWrite.prototype.obj;
    /** @type {?} */
    KeyedWrite.prototype.key;
    /** @type {?} */
    KeyedWrite.prototype.value;
}
export class BindingPipe extends AST {
    /**
     * @param {?} span
     * @param {?} exp
     * @param {?} name
     * @param {?} args
     */
    constructor(span, exp, name, args) {
        super(span);
        this.exp = exp;
        this.name = name;
        this.args = args;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) { return visitor.visitPipe(this, context); }
}
function BindingPipe_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingPipe.prototype.exp;
    /** @type {?} */
    BindingPipe.prototype.name;
    /** @type {?} */
    BindingPipe.prototype.args;
}
export class LiteralPrimitive extends AST {
    /**
     * @param {?} span
     * @param {?} value
     */
    constructor(span, value) {
        super(span);
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitLiteralPrimitive(this, context);
    }
}
function LiteralPrimitive_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralPrimitive.prototype.value;
}
export class LiteralArray extends AST {
    /**
     * @param {?} span
     * @param {?} expressions
     */
    constructor(span, expressions) {
        super(span);
        this.expressions = expressions;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitLiteralArray(this, context);
    }
}
function LiteralArray_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralArray.prototype.expressions;
}
export class LiteralMap extends AST {
    /**
     * @param {?} span
     * @param {?} keys
     * @param {?} values
     */
    constructor(span, keys, values) {
        super(span);
        this.keys = keys;
        this.values = values;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitLiteralMap(this, context);
    }
}
function LiteralMap_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralMap.prototype.keys;
    /** @type {?} */
    LiteralMap.prototype.values;
}
export class Interpolation extends AST {
    /**
     * @param {?} span
     * @param {?} strings
     * @param {?} expressions
     */
    constructor(span, strings, expressions) {
        super(span);
        this.strings = strings;
        this.expressions = expressions;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitInterpolation(this, context);
    }
}
function Interpolation_tsickle_Closure_declarations() {
    /** @type {?} */
    Interpolation.prototype.strings;
    /** @type {?} */
    Interpolation.prototype.expressions;
}
export class Binary extends AST {
    /**
     * @param {?} span
     * @param {?} operation
     * @param {?} left
     * @param {?} right
     */
    constructor(span, operation, left, right) {
        super(span);
        this.operation = operation;
        this.left = left;
        this.right = right;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitBinary(this, context);
    }
}
function Binary_tsickle_Closure_declarations() {
    /** @type {?} */
    Binary.prototype.operation;
    /** @type {?} */
    Binary.prototype.left;
    /** @type {?} */
    Binary.prototype.right;
}
export class PrefixNot extends AST {
    /**
     * @param {?} span
     * @param {?} expression
     */
    constructor(span, expression) {
        super(span);
        this.expression = expression;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitPrefixNot(this, context);
    }
}
function PrefixNot_tsickle_Closure_declarations() {
    /** @type {?} */
    PrefixNot.prototype.expression;
}
export class NonNullAssert extends AST {
    /**
     * @param {?} span
     * @param {?} expression
     */
    constructor(span, expression) {
        super(span);
        this.expression = expression;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitNonNullAssert(this, context);
    }
}
function NonNullAssert_tsickle_Closure_declarations() {
    /** @type {?} */
    NonNullAssert.prototype.expression;
}
export class MethodCall extends AST {
    /**
     * @param {?} span
     * @param {?} receiver
     * @param {?} name
     * @param {?} args
     */
    constructor(span, receiver, name, args) {
        super(span);
        this.receiver = receiver;
        this.name = name;
        this.args = args;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitMethodCall(this, context);
    }
}
function MethodCall_tsickle_Closure_declarations() {
    /** @type {?} */
    MethodCall.prototype.receiver;
    /** @type {?} */
    MethodCall.prototype.name;
    /** @type {?} */
    MethodCall.prototype.args;
}
export class SafeMethodCall extends AST {
    /**
     * @param {?} span
     * @param {?} receiver
     * @param {?} name
     * @param {?} args
     */
    constructor(span, receiver, name, args) {
        super(span);
        this.receiver = receiver;
        this.name = name;
        this.args = args;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitSafeMethodCall(this, context);
    }
}
function SafeMethodCall_tsickle_Closure_declarations() {
    /** @type {?} */
    SafeMethodCall.prototype.receiver;
    /** @type {?} */
    SafeMethodCall.prototype.name;
    /** @type {?} */
    SafeMethodCall.prototype.args;
}
export class FunctionCall extends AST {
    /**
     * @param {?} span
     * @param {?} target
     * @param {?} args
     */
    constructor(span, target, args) {
        super(span);
        this.target = target;
        this.args = args;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) {
        return visitor.visitFunctionCall(this, context);
    }
}
function FunctionCall_tsickle_Closure_declarations() {
    /** @type {?} */
    FunctionCall.prototype.target;
    /** @type {?} */
    FunctionCall.prototype.args;
}
export class ASTWithSource extends AST {
    /**
     * @param {?} ast
     * @param {?} source
     * @param {?} location
     * @param {?} errors
     */
    constructor(ast, source, location, errors) {
        super(new ParseSpan(0, source == null ? 0 : source.length));
        this.ast = ast;
        this.source = source;
        this.location = location;
        this.errors = errors;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context = null) { return this.ast.visit(visitor, context); }
    /**
     * @return {?}
     */
    toString() { return `${this.source} in ${this.location}`; }
}
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
export class TemplateBinding {
    /**
     * @param {?} span
     * @param {?} key
     * @param {?} keyIsVar
     * @param {?} name
     * @param {?} expression
     */
    constructor(span, key, keyIsVar, name, expression) {
        this.span = span;
        this.key = key;
        this.keyIsVar = keyIsVar;
        this.name = name;
        this.expression = expression;
    }
}
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
export class NullAstVisitor {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBinary(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitChain(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitConditional(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitFunctionCall(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitImplicitReceiver(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInterpolation(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedRead(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedWrite(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArray(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMap(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralPrimitive(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitMethodCall(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPipe(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPrefixNot(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNonNullAssert(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyRead(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyWrite(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitQuote(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafeMethodCall(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafePropertyRead(ast, context) { }
}
export class RecursiveAstVisitor {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBinary(ast, context) {
        ast.left.visit(this);
        ast.right.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitChain(ast, context) { return this.visitAll(ast.expressions, context); }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitConditional(ast, context) {
        ast.condition.visit(this);
        ast.trueExp.visit(this);
        ast.falseExp.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPipe(ast, context) {
        ast.exp.visit(this);
        this.visitAll(ast.args, context);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitFunctionCall(ast, context) {
        /** @type {?} */ ((ast.target)).visit(this);
        this.visitAll(ast.args, context);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitImplicitReceiver(ast, context) { return null; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInterpolation(ast, context) {
        return this.visitAll(ast.expressions, context);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedRead(ast, context) {
        ast.obj.visit(this);
        ast.key.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedWrite(ast, context) {
        ast.obj.visit(this);
        ast.key.visit(this);
        ast.value.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArray(ast, context) {
        return this.visitAll(ast.expressions, context);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMap(ast, context) { return this.visitAll(ast.values, context); }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralPrimitive(ast, context) { return null; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitMethodCall(ast, context) {
        ast.receiver.visit(this);
        return this.visitAll(ast.args, context);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPrefixNot(ast, context) {
        ast.expression.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNonNullAssert(ast, context) {
        ast.expression.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyRead(ast, context) {
        ast.receiver.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyWrite(ast, context) {
        ast.receiver.visit(this);
        ast.value.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafePropertyRead(ast, context) {
        ast.receiver.visit(this);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafeMethodCall(ast, context) {
        ast.receiver.visit(this);
        return this.visitAll(ast.args, context);
    }
    /**
     * @param {?} asts
     * @param {?} context
     * @return {?}
     */
    visitAll(asts, context) {
        asts.forEach(ast => ast.visit(this, context));
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitQuote(ast, context) { return null; }
}
export class AstTransformer {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitImplicitReceiver(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInterpolation(ast, context) {
        return new Interpolation(ast.span, ast.strings, this.visitAll(ast.expressions));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralPrimitive(ast, context) {
        return new LiteralPrimitive(ast.span, ast.value);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyRead(ast, context) {
        return new PropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyWrite(ast, context) {
        return new PropertyWrite(ast.span, ast.receiver.visit(this), ast.name, ast.value.visit(this));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafePropertyRead(ast, context) {
        return new SafePropertyRead(ast.span, ast.receiver.visit(this), ast.name);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitMethodCall(ast, context) {
        return new MethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafeMethodCall(ast, context) {
        return new SafeMethodCall(ast.span, ast.receiver.visit(this), ast.name, this.visitAll(ast.args));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitFunctionCall(ast, context) {
        return new FunctionCall(ast.span, /** @type {?} */ ((ast.target)).visit(this), this.visitAll(ast.args));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArray(ast, context) {
        return new LiteralArray(ast.span, this.visitAll(ast.expressions));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMap(ast, context) {
        return new LiteralMap(ast.span, ast.keys, this.visitAll(ast.values));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBinary(ast, context) {
        return new Binary(ast.span, ast.operation, ast.left.visit(this), ast.right.visit(this));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPrefixNot(ast, context) {
        return new PrefixNot(ast.span, ast.expression.visit(this));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNonNullAssert(ast, context) {
        return new NonNullAssert(ast.span, ast.expression.visit(this));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitConditional(ast, context) {
        return new Conditional(ast.span, ast.condition.visit(this), ast.trueExp.visit(this), ast.falseExp.visit(this));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPipe(ast, context) {
        return new BindingPipe(ast.span, ast.exp.visit(this), ast.name, this.visitAll(ast.args));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedRead(ast, context) {
        return new KeyedRead(ast.span, ast.obj.visit(this), ast.key.visit(this));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedWrite(ast, context) {
        return new KeyedWrite(ast.span, ast.obj.visit(this), ast.key.visit(this), ast.value.visit(this));
    }
    /**
     * @param {?} asts
     * @return {?}
     */
    visitAll(asts) {
        const /** @type {?} */ res = new Array(asts.length);
        for (let /** @type {?} */ i = 0; i < asts.length; ++i) {
            res[i] = asts[i].visit(this);
        }
        return res;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitChain(ast, context) {
        return new Chain(ast.span, this.visitAll(ast.expressions));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitQuote(ast, context) {
        return new Quote(ast.span, ast.prefix, ast.uninterpretedExpression, ast.location);
    }
}
export class AstMemoryEfficientTransformer {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitImplicitReceiver(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInterpolation(ast, context) {
        const /** @type {?} */ expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions)
            return new Interpolation(ast.span, ast.strings, expressions);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralPrimitive(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyRead(ast, context) {
        const /** @type {?} */ receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new PropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPropertyWrite(ast, context) {
        const /** @type {?} */ receiver = ast.receiver.visit(this);
        const /** @type {?} */ value = ast.value.visit(this);
        if (receiver !== ast.receiver || value !== ast.value) {
            return new PropertyWrite(ast.span, receiver, ast.name, value);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafePropertyRead(ast, context) {
        const /** @type {?} */ receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new SafePropertyRead(ast.span, receiver, ast.name);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitMethodCall(ast, context) {
        const /** @type {?} */ receiver = ast.receiver.visit(this);
        if (receiver !== ast.receiver) {
            return new MethodCall(ast.span, receiver, ast.name, this.visitAll(ast.args));
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitSafeMethodCall(ast, context) {
        const /** @type {?} */ receiver = ast.receiver.visit(this);
        const /** @type {?} */ args = this.visitAll(ast.args);
        if (receiver !== ast.receiver || args !== ast.args) {
            return new SafeMethodCall(ast.span, receiver, ast.name, args);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitFunctionCall(ast, context) {
        const /** @type {?} */ target = ast.target && ast.target.visit(this);
        const /** @type {?} */ args = this.visitAll(ast.args);
        if (target !== ast.target || args !== ast.args) {
            return new FunctionCall(ast.span, target, args);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArray(ast, context) {
        const /** @type {?} */ expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new LiteralArray(ast.span, expressions);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMap(ast, context) {
        const /** @type {?} */ values = this.visitAll(ast.values);
        if (values !== ast.values) {
            return new LiteralMap(ast.span, ast.keys, values);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBinary(ast, context) {
        const /** @type {?} */ left = ast.left.visit(this);
        const /** @type {?} */ right = ast.right.visit(this);
        if (left !== ast.left || right !== ast.right) {
            return new Binary(ast.span, ast.operation, left, right);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPrefixNot(ast, context) {
        const /** @type {?} */ expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new PrefixNot(ast.span, expression);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNonNullAssert(ast, context) {
        const /** @type {?} */ expression = ast.expression.visit(this);
        if (expression !== ast.expression) {
            return new NonNullAssert(ast.span, expression);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitConditional(ast, context) {
        const /** @type {?} */ condition = ast.condition.visit(this);
        const /** @type {?} */ trueExp = ast.trueExp.visit(this);
        const /** @type {?} */ falseExp = ast.falseExp.visit(this);
        if (condition !== ast.condition || trueExp !== ast.trueExp || falseExp !== falseExp) {
            return new Conditional(ast.span, condition, trueExp, falseExp);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPipe(ast, context) {
        const /** @type {?} */ exp = ast.exp.visit(this);
        const /** @type {?} */ args = this.visitAll(ast.args);
        if (exp !== ast.exp || args !== ast.args) {
            return new BindingPipe(ast.span, exp, ast.name, args);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedRead(ast, context) {
        const /** @type {?} */ obj = ast.obj.visit(this);
        const /** @type {?} */ key = ast.key.visit(this);
        if (obj !== ast.obj || key !== ast.key) {
            return new KeyedRead(ast.span, obj, key);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitKeyedWrite(ast, context) {
        const /** @type {?} */ obj = ast.obj.visit(this);
        const /** @type {?} */ key = ast.key.visit(this);
        const /** @type {?} */ value = ast.value.visit(this);
        if (obj !== ast.obj || key !== ast.key || value !== ast.value) {
            return new KeyedWrite(ast.span, obj, key, value);
        }
        return ast;
    }
    /**
     * @param {?} asts
     * @return {?}
     */
    visitAll(asts) {
        const /** @type {?} */ res = new Array(asts.length);
        let /** @type {?} */ modified = false;
        for (let /** @type {?} */ i = 0; i < asts.length; ++i) {
            const /** @type {?} */ original = asts[i];
            const /** @type {?} */ value = original.visit(this);
            res[i] = value;
            modified = modified || value !== original;
        }
        return modified ? res : asts;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitChain(ast, context) {
        const /** @type {?} */ expressions = this.visitAll(ast.expressions);
        if (expressions !== ast.expressions) {
            return new Chain(ast.span, expressions);
        }
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitQuote(ast, context) { return ast; }
}
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
        /**
         * @param {?} ast
         * @return {?}
         */
        visitBinary(ast) {
            visit(ast.left);
            visit(ast.right);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitChain(ast) { visitAll(ast.expressions); },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitConditional(ast) {
            visit(ast.condition);
            visit(ast.trueExp);
            visit(ast.falseExp);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitFunctionCall(ast) {
            if (ast.target) {
                visit(ast.target);
            }
            visitAll(ast.args);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitImplicitReceiver(ast) { },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitInterpolation(ast) { visitAll(ast.expressions); },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitKeyedRead(ast) {
            visit(ast.obj);
            visit(ast.key);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitKeyedWrite(ast) {
            visit(ast.obj);
            visit(ast.key);
            visit(ast.obj);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitLiteralArray(ast) { visitAll(ast.expressions); },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitLiteralMap(ast) { },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitLiteralPrimitive(ast) { },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitMethodCall(ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitPipe(ast) {
            visit(ast.exp);
            visitAll(ast.args);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitPrefixNot(ast) { visit(ast.expression); },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitNonNullAssert(ast) { visit(ast.expression); },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitPropertyRead(ast) { visit(ast.receiver); },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitPropertyWrite(ast) {
            visit(ast.receiver);
            visit(ast.value);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitQuote(ast) { },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitSafeMethodCall(ast) {
            visit(ast.receiver);
            visitAll(ast.args);
        },
        /**
         * @param {?} ast
         * @return {?}
         */
        visitSafePropertyRead(ast) { visit(ast.receiver); },
    });
}
export class ParsedProperty {
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} type
     * @param {?} sourceSpan
     */
    constructor(name, expression, type, sourceSpan) {
        this.name = name;
        this.expression = expression;
        this.type = type;
        this.sourceSpan = sourceSpan;
        this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
        this.isAnimation = this.type === ParsedPropertyType.ANIMATION;
    }
}
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
const ParsedPropertyType = {
    DEFAULT: 0,
    LITERAL_ATTR: 1,
    ANIMATION: 2,
};
export { ParsedPropertyType };
ParsedPropertyType[ParsedPropertyType.DEFAULT] = "DEFAULT";
ParsedPropertyType[ParsedPropertyType.LITERAL_ATTR] = "LITERAL_ATTR";
ParsedPropertyType[ParsedPropertyType.ANIMATION] = "ANIMATION";
/** @enum {number} */
const ParsedEventType = {
    // DOM or Directive event
    Regular: 0,
    // Animation specific event
    Animation: 1,
};
export { ParsedEventType };
export class ParsedEvent {
    /**
     * @param {?} name
     * @param {?} targetOrPhase
     * @param {?} type
     * @param {?} handler
     * @param {?} sourceSpan
     */
    constructor(name, targetOrPhase, type, handler, sourceSpan) {
        this.name = name;
        this.targetOrPhase = targetOrPhase;
        this.type = type;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
    }
}
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
export class ParsedVariable {
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     */
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
}
function ParsedVariable_tsickle_Closure_declarations() {
    /** @type {?} */
    ParsedVariable.prototype.name;
    /** @type {?} */
    ParsedVariable.prototype.value;
    /** @type {?} */
    ParsedVariable.prototype.sourceSpan;
}
/** @enum {number} */
const BoundElementBindingType = {
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
export class BoundElementProperty {
    /**
     * @param {?} name
     * @param {?} type
     * @param {?} securityContext
     * @param {?} value
     * @param {?} unit
     * @param {?} sourceSpan
     */
    constructor(name, type, securityContext, value, unit, sourceSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
    }
}
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