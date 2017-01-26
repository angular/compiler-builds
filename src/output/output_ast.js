/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isPresent } from '../facade/lang';
export let TypeModifier = {};
TypeModifier.Const = 0;
TypeModifier[TypeModifier.Const] = "Const";
/**
 * @abstract
 */
export class Type {
    /**
     * @param {?=} modifiers
     */
    constructor(modifiers = null) {
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
    }
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitType(visitor, context) { }
    /**
     * @param {?} modifier
     * @return {?}
     */
    hasModifier(modifier) { return this.modifiers.indexOf(modifier) !== -1; }
}
function Type_tsickle_Closure_declarations() {
    /** @type {?} */
    Type.prototype.modifiers;
}
export let BuiltinTypeName = {};
BuiltinTypeName.Dynamic = 0;
BuiltinTypeName.Bool = 1;
BuiltinTypeName.String = 2;
BuiltinTypeName.Int = 3;
BuiltinTypeName.Number = 4;
BuiltinTypeName.Function = 5;
BuiltinTypeName.Null = 6;
BuiltinTypeName[BuiltinTypeName.Dynamic] = "Dynamic";
BuiltinTypeName[BuiltinTypeName.Bool] = "Bool";
BuiltinTypeName[BuiltinTypeName.String] = "String";
BuiltinTypeName[BuiltinTypeName.Int] = "Int";
BuiltinTypeName[BuiltinTypeName.Number] = "Number";
BuiltinTypeName[BuiltinTypeName.Function] = "Function";
BuiltinTypeName[BuiltinTypeName.Null] = "Null";
export class BuiltinType extends Type {
    /**
     * @param {?} name
     * @param {?=} modifiers
     */
    constructor(name, modifiers = null) {
        super(modifiers);
        this.name = name;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitType(visitor, context) {
        return visitor.visitBuiltintType(this, context);
    }
}
function BuiltinType_tsickle_Closure_declarations() {
    /** @type {?} */
    BuiltinType.prototype.name;
}
export class ExpressionType extends Type {
    /**
     * @param {?} value
     * @param {?=} typeParams
     * @param {?=} modifiers
     */
    constructor(value, typeParams = null, modifiers = null) {
        super(modifiers);
        this.value = value;
        this.typeParams = typeParams;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitType(visitor, context) {
        return visitor.visitExpressionType(this, context);
    }
}
function ExpressionType_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpressionType.prototype.value;
    /** @type {?} */
    ExpressionType.prototype.typeParams;
}
export class ArrayType extends Type {
    /**
     * @param {?} of
     * @param {?=} modifiers
     */
    constructor(of, modifiers = null) {
        super(modifiers);
        this.of = of;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitType(visitor, context) {
        return visitor.visitArrayType(this, context);
    }
}
function ArrayType_tsickle_Closure_declarations() {
    /** @type {?} */
    ArrayType.prototype.of;
}
export class MapType extends Type {
    /**
     * @param {?} valueType
     * @param {?=} modifiers
     */
    constructor(valueType, modifiers = null) {
        super(modifiers);
        this.valueType = valueType;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitType(visitor, context) { return visitor.visitMapType(this, context); }
}
function MapType_tsickle_Closure_declarations() {
    /** @type {?} */
    MapType.prototype.valueType;
}
export const /** @type {?} */ DYNAMIC_TYPE = new BuiltinType(BuiltinTypeName.Dynamic);
export const /** @type {?} */ BOOL_TYPE = new BuiltinType(BuiltinTypeName.Bool);
export const /** @type {?} */ INT_TYPE = new BuiltinType(BuiltinTypeName.Int);
export const /** @type {?} */ NUMBER_TYPE = new BuiltinType(BuiltinTypeName.Number);
export const /** @type {?} */ STRING_TYPE = new BuiltinType(BuiltinTypeName.String);
export const /** @type {?} */ FUNCTION_TYPE = new BuiltinType(BuiltinTypeName.Function);
export const /** @type {?} */ NULL_TYPE = new BuiltinType(BuiltinTypeName.Null);
export let BinaryOperator = {};
BinaryOperator.Equals = 0;
BinaryOperator.NotEquals = 1;
BinaryOperator.Identical = 2;
BinaryOperator.NotIdentical = 3;
BinaryOperator.Minus = 4;
BinaryOperator.Plus = 5;
BinaryOperator.Divide = 6;
BinaryOperator.Multiply = 7;
BinaryOperator.Modulo = 8;
BinaryOperator.And = 9;
BinaryOperator.Or = 10;
BinaryOperator.Lower = 11;
BinaryOperator.LowerEquals = 12;
BinaryOperator.Bigger = 13;
BinaryOperator.BiggerEquals = 14;
BinaryOperator[BinaryOperator.Equals] = "Equals";
BinaryOperator[BinaryOperator.NotEquals] = "NotEquals";
BinaryOperator[BinaryOperator.Identical] = "Identical";
BinaryOperator[BinaryOperator.NotIdentical] = "NotIdentical";
BinaryOperator[BinaryOperator.Minus] = "Minus";
BinaryOperator[BinaryOperator.Plus] = "Plus";
BinaryOperator[BinaryOperator.Divide] = "Divide";
BinaryOperator[BinaryOperator.Multiply] = "Multiply";
BinaryOperator[BinaryOperator.Modulo] = "Modulo";
BinaryOperator[BinaryOperator.And] = "And";
BinaryOperator[BinaryOperator.Or] = "Or";
BinaryOperator[BinaryOperator.Lower] = "Lower";
BinaryOperator[BinaryOperator.LowerEquals] = "LowerEquals";
BinaryOperator[BinaryOperator.Bigger] = "Bigger";
BinaryOperator[BinaryOperator.BiggerEquals] = "BiggerEquals";
/**
 * @abstract
 */
export class Expression {
    /**
     * @param {?} type
     */
    constructor(type) {
        this.type = type;
    }
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) { }
    /**
     * @param {?} name
     * @return {?}
     */
    prop(name) { return new ReadPropExpr(this, name); }
    /**
     * @param {?} index
     * @param {?=} type
     * @return {?}
     */
    key(index, type = null) {
        return new ReadKeyExpr(this, index, type);
    }
    /**
     * @param {?} name
     * @param {?} params
     * @return {?}
     */
    callMethod(name, params) {
        return new InvokeMethodExpr(this, name, params);
    }
    /**
     * @param {?} params
     * @return {?}
     */
    callFn(params) { return new InvokeFunctionExpr(this, params); }
    /**
     * @param {?} params
     * @param {?=} type
     * @return {?}
     */
    instantiate(params, type = null) {
        return new InstantiateExpr(this, params, type);
    }
    /**
     * @param {?} trueCase
     * @param {?=} falseCase
     * @return {?}
     */
    conditional(trueCase, falseCase = null) {
        return new ConditionalExpr(this, trueCase, falseCase);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    equals(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Equals, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    notEquals(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.NotEquals, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    identical(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Identical, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    notIdentical(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.NotIdentical, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    minus(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Minus, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    plus(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Plus, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    divide(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Divide, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    multiply(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Multiply, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    modulo(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Modulo, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    and(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.And, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    or(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Or, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    lower(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Lower, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    lowerEquals(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.LowerEquals, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    bigger(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.Bigger, this, rhs);
    }
    /**
     * @param {?} rhs
     * @return {?}
     */
    biggerEquals(rhs) {
        return new BinaryOperatorExpr(BinaryOperator.BiggerEquals, this, rhs);
    }
    /**
     * @return {?}
     */
    isBlank() {
        // Note: We use equals by purpose here to compare to null and undefined in JS.
        // We use the typed null to allow strictNullChecks to narrow types.
        return this.equals(TYPED_NULL_EXPR);
    }
    /**
     * @param {?} type
     * @return {?}
     */
    cast(type) { return new CastExpr(this, type); }
    /**
     * @return {?}
     */
    toStmt() { return new ExpressionStatement(this); }
}
function Expression_tsickle_Closure_declarations() {
    /** @type {?} */
    Expression.prototype.type;
}
export let BuiltinVar = {};
BuiltinVar.This = 0;
BuiltinVar.Super = 1;
BuiltinVar.CatchError = 2;
BuiltinVar.CatchStack = 3;
BuiltinVar[BuiltinVar.This] = "This";
BuiltinVar[BuiltinVar.Super] = "Super";
BuiltinVar[BuiltinVar.CatchError] = "CatchError";
BuiltinVar[BuiltinVar.CatchStack] = "CatchStack";
export class ReadVarExpr extends Expression {
    /**
     * @param {?} name
     * @param {?=} type
     */
    constructor(name, type = null) {
        super(type);
        if (typeof name === 'string') {
            this.name = name;
            this.builtin = null;
        }
        else {
            this.name = null;
            this.builtin = name;
        }
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitReadVarExpr(this, context);
    }
    /**
     * @param {?} value
     * @return {?}
     */
    set(value) { return new WriteVarExpr(this.name, value); }
}
function ReadVarExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ReadVarExpr.prototype.name;
    /** @type {?} */
    ReadVarExpr.prototype.builtin;
}
export class WriteVarExpr extends Expression {
    /**
     * @param {?} name
     * @param {?} value
     * @param {?=} type
     */
    constructor(name, value, type = null) {
        super(type || value.type);
        this.name = name;
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitWriteVarExpr(this, context);
    }
    /**
     * @param {?=} type
     * @param {?=} modifiers
     * @return {?}
     */
    toDeclStmt(type = null, modifiers = null) {
        return new DeclareVarStmt(this.name, this.value, type, modifiers);
    }
}
function WriteVarExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    WriteVarExpr.prototype.value;
    /** @type {?} */
    WriteVarExpr.prototype.name;
}
export class WriteKeyExpr extends Expression {
    /**
     * @param {?} receiver
     * @param {?} index
     * @param {?} value
     * @param {?=} type
     */
    constructor(receiver, index, value, type = null) {
        super(type || value.type);
        this.receiver = receiver;
        this.index = index;
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitWriteKeyExpr(this, context);
    }
}
function WriteKeyExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    WriteKeyExpr.prototype.value;
    /** @type {?} */
    WriteKeyExpr.prototype.receiver;
    /** @type {?} */
    WriteKeyExpr.prototype.index;
}
export class WritePropExpr extends Expression {
    /**
     * @param {?} receiver
     * @param {?} name
     * @param {?} value
     * @param {?=} type
     */
    constructor(receiver, name, value, type = null) {
        super(type || value.type);
        this.receiver = receiver;
        this.name = name;
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitWritePropExpr(this, context);
    }
}
function WritePropExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    WritePropExpr.prototype.value;
    /** @type {?} */
    WritePropExpr.prototype.receiver;
    /** @type {?} */
    WritePropExpr.prototype.name;
}
export let BuiltinMethod = {};
BuiltinMethod.ConcatArray = 0;
BuiltinMethod.SubscribeObservable = 1;
BuiltinMethod.Bind = 2;
BuiltinMethod[BuiltinMethod.ConcatArray] = "ConcatArray";
BuiltinMethod[BuiltinMethod.SubscribeObservable] = "SubscribeObservable";
BuiltinMethod[BuiltinMethod.Bind] = "Bind";
export class InvokeMethodExpr extends Expression {
    /**
     * @param {?} receiver
     * @param {?} method
     * @param {?} args
     * @param {?=} type
     */
    constructor(receiver, method, args, type = null) {
        super(type);
        this.receiver = receiver;
        this.args = args;
        if (typeof method === 'string') {
            this.name = method;
            this.builtin = null;
        }
        else {
            this.name = null;
            this.builtin = method;
        }
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitInvokeMethodExpr(this, context);
    }
}
function InvokeMethodExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    InvokeMethodExpr.prototype.name;
    /** @type {?} */
    InvokeMethodExpr.prototype.builtin;
    /** @type {?} */
    InvokeMethodExpr.prototype.receiver;
    /** @type {?} */
    InvokeMethodExpr.prototype.args;
}
export class InvokeFunctionExpr extends Expression {
    /**
     * @param {?} fn
     * @param {?} args
     * @param {?=} type
     */
    constructor(fn, args, type = null) {
        super(type);
        this.fn = fn;
        this.args = args;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitInvokeFunctionExpr(this, context);
    }
}
function InvokeFunctionExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    InvokeFunctionExpr.prototype.fn;
    /** @type {?} */
    InvokeFunctionExpr.prototype.args;
}
export class InstantiateExpr extends Expression {
    /**
     * @param {?} classExpr
     * @param {?} args
     * @param {?=} type
     */
    constructor(classExpr, args, type) {
        super(type);
        this.classExpr = classExpr;
        this.args = args;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitInstantiateExpr(this, context);
    }
}
function InstantiateExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    InstantiateExpr.prototype.classExpr;
    /** @type {?} */
    InstantiateExpr.prototype.args;
}
export class LiteralExpr extends Expression {
    /**
     * @param {?} value
     * @param {?=} type
     */
    constructor(value, type = null) {
        super(type);
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitLiteralExpr(this, context);
    }
}
function LiteralExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralExpr.prototype.value;
}
export class ExternalExpr extends Expression {
    /**
     * @param {?} value
     * @param {?=} type
     * @param {?=} typeParams
     */
    constructor(value, type = null, typeParams = null) {
        super(type);
        this.value = value;
        this.typeParams = typeParams;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitExternalExpr(this, context);
    }
}
function ExternalExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ExternalExpr.prototype.value;
    /** @type {?} */
    ExternalExpr.prototype.typeParams;
}
export class ConditionalExpr extends Expression {
    /**
     * @param {?} condition
     * @param {?} trueCase
     * @param {?=} falseCase
     * @param {?=} type
     */
    constructor(condition, trueCase, falseCase = null, type = null) {
        super(type || trueCase.type);
        this.condition = condition;
        this.falseCase = falseCase;
        this.trueCase = trueCase;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitConditionalExpr(this, context);
    }
}
function ConditionalExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ConditionalExpr.prototype.trueCase;
    /** @type {?} */
    ConditionalExpr.prototype.condition;
    /** @type {?} */
    ConditionalExpr.prototype.falseCase;
}
export class NotExpr extends Expression {
    /**
     * @param {?} condition
     */
    constructor(condition) {
        super(BOOL_TYPE);
        this.condition = condition;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitNotExpr(this, context);
    }
}
function NotExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    NotExpr.prototype.condition;
}
export class CastExpr extends Expression {
    /**
     * @param {?} value
     * @param {?} type
     */
    constructor(value, type) {
        super(type);
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitCastExpr(this, context);
    }
}
function CastExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    CastExpr.prototype.value;
}
export class FnParam {
    /**
     * @param {?} name
     * @param {?=} type
     */
    constructor(name, type = null) {
        this.name = name;
        this.type = type;
    }
}
function FnParam_tsickle_Closure_declarations() {
    /** @type {?} */
    FnParam.prototype.name;
    /** @type {?} */
    FnParam.prototype.type;
}
export class FunctionExpr extends Expression {
    /**
     * @param {?} params
     * @param {?} statements
     * @param {?=} type
     */
    constructor(params, statements, type = null) {
        super(type);
        this.params = params;
        this.statements = statements;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitFunctionExpr(this, context);
    }
    /**
     * @param {?} name
     * @param {?=} modifiers
     * @return {?}
     */
    toDeclStmt(name, modifiers = null) {
        return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers);
    }
}
function FunctionExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    FunctionExpr.prototype.params;
    /** @type {?} */
    FunctionExpr.prototype.statements;
}
export class BinaryOperatorExpr extends Expression {
    /**
     * @param {?} operator
     * @param {?} lhs
     * @param {?} rhs
     * @param {?=} type
     */
    constructor(operator, lhs, rhs, type = null) {
        super(type || lhs.type);
        this.operator = operator;
        this.rhs = rhs;
        this.lhs = lhs;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitBinaryOperatorExpr(this, context);
    }
}
function BinaryOperatorExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    BinaryOperatorExpr.prototype.lhs;
    /** @type {?} */
    BinaryOperatorExpr.prototype.operator;
    /** @type {?} */
    BinaryOperatorExpr.prototype.rhs;
}
export class ReadPropExpr extends Expression {
    /**
     * @param {?} receiver
     * @param {?} name
     * @param {?=} type
     */
    constructor(receiver, name, type = null) {
        super(type);
        this.receiver = receiver;
        this.name = name;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitReadPropExpr(this, context);
    }
    /**
     * @param {?} value
     * @return {?}
     */
    set(value) {
        return new WritePropExpr(this.receiver, this.name, value);
    }
}
function ReadPropExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ReadPropExpr.prototype.receiver;
    /** @type {?} */
    ReadPropExpr.prototype.name;
}
export class ReadKeyExpr extends Expression {
    /**
     * @param {?} receiver
     * @param {?} index
     * @param {?=} type
     */
    constructor(receiver, index, type = null) {
        super(type);
        this.receiver = receiver;
        this.index = index;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitReadKeyExpr(this, context);
    }
    /**
     * @param {?} value
     * @return {?}
     */
    set(value) {
        return new WriteKeyExpr(this.receiver, this.index, value);
    }
}
function ReadKeyExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ReadKeyExpr.prototype.receiver;
    /** @type {?} */
    ReadKeyExpr.prototype.index;
}
export class LiteralArrayExpr extends Expression {
    /**
     * @param {?} entries
     * @param {?=} type
     */
    constructor(entries, type = null) {
        super(type);
        this.entries = entries;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitLiteralArrayExpr(this, context);
    }
}
function LiteralArrayExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralArrayExpr.prototype.entries;
}
export class LiteralMapEntry {
    /**
     * @param {?} key
     * @param {?} value
     * @param {?=} quoted
     */
    constructor(key, value, quoted = false) {
        this.key = key;
        this.value = value;
        this.quoted = quoted;
    }
}
function LiteralMapEntry_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralMapEntry.prototype.key;
    /** @type {?} */
    LiteralMapEntry.prototype.value;
    /** @type {?} */
    LiteralMapEntry.prototype.quoted;
}
export class LiteralMapExpr extends Expression {
    /**
     * @param {?} entries
     * @param {?=} type
     */
    constructor(entries, type = null) {
        super(type);
        this.entries = entries;
        this.valueType = null;
        if (isPresent(type)) {
            this.valueType = type.valueType;
        }
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        return visitor.visitLiteralMapExpr(this, context);
    }
}
function LiteralMapExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralMapExpr.prototype.valueType;
    /** @type {?} */
    LiteralMapExpr.prototype.entries;
}
export const /** @type {?} */ THIS_EXPR = new ReadVarExpr(BuiltinVar.This);
export const /** @type {?} */ SUPER_EXPR = new ReadVarExpr(BuiltinVar.Super);
export const /** @type {?} */ CATCH_ERROR_VAR = new ReadVarExpr(BuiltinVar.CatchError);
export const /** @type {?} */ CATCH_STACK_VAR = new ReadVarExpr(BuiltinVar.CatchStack);
export const /** @type {?} */ NULL_EXPR = new LiteralExpr(null, null);
export const /** @type {?} */ TYPED_NULL_EXPR = new LiteralExpr(null, NULL_TYPE);
export let StmtModifier = {};
StmtModifier.Final = 0;
StmtModifier.Private = 1;
StmtModifier[StmtModifier.Final] = "Final";
StmtModifier[StmtModifier.Private] = "Private";
/**
 * @abstract
 */
export class Statement {
    /**
     * @param {?=} modifiers
     */
    constructor(modifiers = null) {
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
    }
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) { }
    /**
     * @param {?} modifier
     * @return {?}
     */
    hasModifier(modifier) { return this.modifiers.indexOf(modifier) !== -1; }
}
function Statement_tsickle_Closure_declarations() {
    /** @type {?} */
    Statement.prototype.modifiers;
}
export class DeclareVarStmt extends Statement {
    /**
     * @param {?} name
     * @param {?} value
     * @param {?=} type
     * @param {?=} modifiers
     */
    constructor(name, value, type = null, modifiers = null) {
        super(modifiers);
        this.name = name;
        this.value = value;
        this.type = type || value.type;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitDeclareVarStmt(this, context);
    }
}
function DeclareVarStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    DeclareVarStmt.prototype.type;
    /** @type {?} */
    DeclareVarStmt.prototype.name;
    /** @type {?} */
    DeclareVarStmt.prototype.value;
}
export class DeclareFunctionStmt extends Statement {
    /**
     * @param {?} name
     * @param {?} params
     * @param {?} statements
     * @param {?=} type
     * @param {?=} modifiers
     */
    constructor(name, params, statements, type = null, modifiers = null) {
        super(modifiers);
        this.name = name;
        this.params = params;
        this.statements = statements;
        this.type = type;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitDeclareFunctionStmt(this, context);
    }
}
function DeclareFunctionStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    DeclareFunctionStmt.prototype.name;
    /** @type {?} */
    DeclareFunctionStmt.prototype.params;
    /** @type {?} */
    DeclareFunctionStmt.prototype.statements;
    /** @type {?} */
    DeclareFunctionStmt.prototype.type;
}
export class ExpressionStatement extends Statement {
    /**
     * @param {?} expr
     */
    constructor(expr) {
        super();
        this.expr = expr;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitExpressionStmt(this, context);
    }
}
function ExpressionStatement_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpressionStatement.prototype.expr;
}
export class ReturnStatement extends Statement {
    /**
     * @param {?} value
     */
    constructor(value) {
        super();
        this.value = value;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitReturnStmt(this, context);
    }
}
function ReturnStatement_tsickle_Closure_declarations() {
    /** @type {?} */
    ReturnStatement.prototype.value;
}
export class AbstractClassPart {
    /**
     * @param {?=} type
     * @param {?} modifiers
     */
    constructor(type = null, modifiers) {
        this.type = type;
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
    }
    /**
     * @param {?} modifier
     * @return {?}
     */
    hasModifier(modifier) { return this.modifiers.indexOf(modifier) !== -1; }
}
function AbstractClassPart_tsickle_Closure_declarations() {
    /** @type {?} */
    AbstractClassPart.prototype.type;
    /** @type {?} */
    AbstractClassPart.prototype.modifiers;
}
export class ClassField extends AbstractClassPart {
    /**
     * @param {?} name
     * @param {?=} type
     * @param {?=} modifiers
     */
    constructor(name, type = null, modifiers = null) {
        super(type, modifiers);
        this.name = name;
    }
}
function ClassField_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassField.prototype.name;
}
export class ClassMethod extends AbstractClassPart {
    /**
     * @param {?} name
     * @param {?} params
     * @param {?} body
     * @param {?=} type
     * @param {?=} modifiers
     */
    constructor(name, params, body, type = null, modifiers = null) {
        super(type, modifiers);
        this.name = name;
        this.params = params;
        this.body = body;
    }
}
function ClassMethod_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassMethod.prototype.name;
    /** @type {?} */
    ClassMethod.prototype.params;
    /** @type {?} */
    ClassMethod.prototype.body;
}
export class ClassGetter extends AbstractClassPart {
    /**
     * @param {?} name
     * @param {?} body
     * @param {?=} type
     * @param {?=} modifiers
     */
    constructor(name, body, type = null, modifiers = null) {
        super(type, modifiers);
        this.name = name;
        this.body = body;
    }
}
function ClassGetter_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassGetter.prototype.name;
    /** @type {?} */
    ClassGetter.prototype.body;
}
export class ClassStmt extends Statement {
    /**
     * @param {?} name
     * @param {?} parent
     * @param {?} fields
     * @param {?} getters
     * @param {?} constructorMethod
     * @param {?} methods
     * @param {?=} modifiers
     */
    constructor(name, parent, fields, getters, constructorMethod, methods, modifiers = null) {
        super(modifiers);
        this.name = name;
        this.parent = parent;
        this.fields = fields;
        this.getters = getters;
        this.constructorMethod = constructorMethod;
        this.methods = methods;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitDeclareClassStmt(this, context);
    }
}
function ClassStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassStmt.prototype.name;
    /** @type {?} */
    ClassStmt.prototype.parent;
    /** @type {?} */
    ClassStmt.prototype.fields;
    /** @type {?} */
    ClassStmt.prototype.getters;
    /** @type {?} */
    ClassStmt.prototype.constructorMethod;
    /** @type {?} */
    ClassStmt.prototype.methods;
}
export class IfStmt extends Statement {
    /**
     * @param {?} condition
     * @param {?} trueCase
     * @param {?=} falseCase
     */
    constructor(condition, trueCase, falseCase = []) {
        super();
        this.condition = condition;
        this.trueCase = trueCase;
        this.falseCase = falseCase;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitIfStmt(this, context);
    }
}
function IfStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    IfStmt.prototype.condition;
    /** @type {?} */
    IfStmt.prototype.trueCase;
    /** @type {?} */
    IfStmt.prototype.falseCase;
}
export class CommentStmt extends Statement {
    /**
     * @param {?} comment
     */
    constructor(comment) {
        super();
        this.comment = comment;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitCommentStmt(this, context);
    }
}
function CommentStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    CommentStmt.prototype.comment;
}
export class TryCatchStmt extends Statement {
    /**
     * @param {?} bodyStmts
     * @param {?} catchStmts
     */
    constructor(bodyStmts, catchStmts) {
        super();
        this.bodyStmts = bodyStmts;
        this.catchStmts = catchStmts;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitTryCatchStmt(this, context);
    }
}
function TryCatchStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    TryCatchStmt.prototype.bodyStmts;
    /** @type {?} */
    TryCatchStmt.prototype.catchStmts;
}
export class ThrowStmt extends Statement {
    /**
     * @param {?} error
     */
    constructor(error) {
        super();
        this.error = error;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitStatement(visitor, context) {
        return visitor.visitThrowStmt(this, context);
    }
}
function ThrowStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    ThrowStmt.prototype.error;
}
export class ExpressionTransformer {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadVarExpr(ast, context) { return ast; }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    visitWriteVarExpr(expr, context) {
        return new WriteVarExpr(expr.name, expr.value.visitExpression(this, context));
    }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    visitWriteKeyExpr(expr, context) {
        return new WriteKeyExpr(expr.receiver.visitExpression(this, context), expr.index.visitExpression(this, context), expr.value.visitExpression(this, context));
    }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    visitWritePropExpr(expr, context) {
        return new WritePropExpr(expr.receiver.visitExpression(this, context), expr.name, expr.value.visitExpression(this, context));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInvokeMethodExpr(ast, context) {
        const /** @type {?} */ method = ast.builtin || ast.name;
        return new InvokeMethodExpr(ast.receiver.visitExpression(this, context), method, this.visitAllExpressions(ast.args, context), ast.type);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInvokeFunctionExpr(ast, context) {
        return new InvokeFunctionExpr(ast.fn.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInstantiateExpr(ast, context) {
        return new InstantiateExpr(ast.classExpr.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralExpr(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitExternalExpr(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitConditionalExpr(ast, context) {
        return new ConditionalExpr(ast.condition.visitExpression(this, context), ast.trueCase.visitExpression(this, context), ast.falseCase.visitExpression(this, context));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNotExpr(ast, context) {
        return new NotExpr(ast.condition.visitExpression(this, context));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitCastExpr(ast, context) {
        return new CastExpr(ast.value.visitExpression(this, context), context);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitFunctionExpr(ast, context) {
        // Don't descend into nested functions
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBinaryOperatorExpr(ast, context) {
        return new BinaryOperatorExpr(ast.operator, ast.lhs.visitExpression(this, context), ast.rhs.visitExpression(this, context), ast.type);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadPropExpr(ast, context) {
        return new ReadPropExpr(ast.receiver.visitExpression(this, context), ast.name, ast.type);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadKeyExpr(ast, context) {
        return new ReadKeyExpr(ast.receiver.visitExpression(this, context), ast.index.visitExpression(this, context), ast.type);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArrayExpr(ast, context) {
        return new LiteralArrayExpr(this.visitAllExpressions(ast.entries, context));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMapExpr(ast, context) {
        const /** @type {?} */ entries = ast.entries.map((entry) => new LiteralMapEntry(entry.key, entry.value.visitExpression(this, context), entry.quoted));
        return new LiteralMapExpr(entries);
    }
    /**
     * @param {?} exprs
     * @param {?} context
     * @return {?}
     */
    visitAllExpressions(exprs, context) {
        return exprs.map(expr => expr.visitExpression(this, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareVarStmt(stmt, context) {
        return new DeclareVarStmt(stmt.name, stmt.value.visitExpression(this, context), stmt.type, stmt.modifiers);
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareFunctionStmt(stmt, context) {
        // Don't descend into nested functions
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitExpressionStmt(stmt, context) {
        return new ExpressionStatement(stmt.expr.visitExpression(this, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitReturnStmt(stmt, context) {
        return new ReturnStatement(stmt.value.visitExpression(this, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareClassStmt(stmt, context) {
        // Don't descend into nested functions
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitIfStmt(stmt, context) {
        return new IfStmt(stmt.condition.visitExpression(this, context), this.visitAllStatements(stmt.trueCase, context), this.visitAllStatements(stmt.falseCase, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitTryCatchStmt(stmt, context) {
        return new TryCatchStmt(this.visitAllStatements(stmt.bodyStmts, context), this.visitAllStatements(stmt.catchStmts, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitThrowStmt(stmt, context) {
        return new ThrowStmt(stmt.error.visitExpression(this, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitCommentStmt(stmt, context) { return stmt; }
    /**
     * @param {?} stmts
     * @param {?} context
     * @return {?}
     */
    visitAllStatements(stmts, context) {
        return stmts.map(stmt => stmt.visitStatement(this, context));
    }
}
export class RecursiveExpressionVisitor {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadVarExpr(ast, context) { return ast; }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    visitWriteVarExpr(expr, context) {
        expr.value.visitExpression(this, context);
        return expr;
    }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    visitWriteKeyExpr(expr, context) {
        expr.receiver.visitExpression(this, context);
        expr.index.visitExpression(this, context);
        expr.value.visitExpression(this, context);
        return expr;
    }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    visitWritePropExpr(expr, context) {
        expr.receiver.visitExpression(this, context);
        expr.value.visitExpression(this, context);
        return expr;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInvokeMethodExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInvokeFunctionExpr(ast, context) {
        ast.fn.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitInstantiateExpr(ast, context) {
        ast.classExpr.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralExpr(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitExternalExpr(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitConditionalExpr(ast, context) {
        ast.condition.visitExpression(this, context);
        ast.trueCase.visitExpression(this, context);
        ast.falseCase.visitExpression(this, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNotExpr(ast, context) {
        ast.condition.visitExpression(this, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitCastExpr(ast, context) {
        ast.value.visitExpression(this, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitFunctionExpr(ast, context) { return ast; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBinaryOperatorExpr(ast, context) {
        ast.lhs.visitExpression(this, context);
        ast.rhs.visitExpression(this, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadPropExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadKeyExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.index.visitExpression(this, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArrayExpr(ast, context) {
        this.visitAllExpressions(ast.entries, context);
        return ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMapExpr(ast, context) {
        ast.entries.forEach((entry) => entry.value.visitExpression(this, context));
        return ast;
    }
    /**
     * @param {?} exprs
     * @param {?} context
     * @return {?}
     */
    visitAllExpressions(exprs, context) {
        exprs.forEach(expr => expr.visitExpression(this, context));
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareVarStmt(stmt, context) {
        stmt.value.visitExpression(this, context);
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareFunctionStmt(stmt, context) {
        // Don't descend into nested functions
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitExpressionStmt(stmt, context) {
        stmt.expr.visitExpression(this, context);
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitReturnStmt(stmt, context) {
        stmt.value.visitExpression(this, context);
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareClassStmt(stmt, context) {
        // Don't descend into nested functions
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitIfStmt(stmt, context) {
        stmt.condition.visitExpression(this, context);
        this.visitAllStatements(stmt.trueCase, context);
        this.visitAllStatements(stmt.falseCase, context);
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitTryCatchStmt(stmt, context) {
        this.visitAllStatements(stmt.bodyStmts, context);
        this.visitAllStatements(stmt.catchStmts, context);
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitThrowStmt(stmt, context) {
        stmt.error.visitExpression(this, context);
        return stmt;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitCommentStmt(stmt, context) { return stmt; }
    /**
     * @param {?} stmts
     * @param {?} context
     * @return {?}
     */
    visitAllStatements(stmts, context) {
        stmts.forEach(stmt => stmt.visitStatement(this, context));
    }
}
/**
 * @param {?} varName
 * @param {?} newValue
 * @param {?} expression
 * @return {?}
 */
export function replaceVarInExpression(varName, newValue, expression) {
    const /** @type {?} */ transformer = new _ReplaceVariableTransformer(varName, newValue);
    return expression.visitExpression(transformer, null);
}
class _ReplaceVariableTransformer extends ExpressionTransformer {
    /**
     * @param {?} _varName
     * @param {?} _newValue
     */
    constructor(_varName, _newValue) {
        super();
        this._varName = _varName;
        this._newValue = _newValue;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadVarExpr(ast, context) {
        return ast.name == this._varName ? this._newValue : ast;
    }
}
function _ReplaceVariableTransformer_tsickle_Closure_declarations() {
    /** @type {?} */
    _ReplaceVariableTransformer.prototype._varName;
    /** @type {?} */
    _ReplaceVariableTransformer.prototype._newValue;
}
/**
 * @param {?} stmts
 * @return {?}
 */
export function findReadVarNames(stmts) {
    const /** @type {?} */ finder = new _VariableFinder();
    finder.visitAllStatements(stmts, null);
    return finder.varNames;
}
class _VariableFinder extends RecursiveExpressionVisitor {
    constructor() {
        super(...arguments);
        this.varNames = new Set();
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadVarExpr(ast, context) {
        this.varNames.add(ast.name);
        return null;
    }
}
function _VariableFinder_tsickle_Closure_declarations() {
    /** @type {?} */
    _VariableFinder.prototype.varNames;
}
/**
 * @param {?} name
 * @param {?=} type
 * @return {?}
 */
export function variable(name, type = null) {
    return new ReadVarExpr(name, type);
}
/**
 * @param {?} id
 * @param {?=} typeParams
 * @return {?}
 */
export function importExpr(id, typeParams = null) {
    return new ExternalExpr(id, null, typeParams);
}
/**
 * @param {?} id
 * @param {?=} typeParams
 * @param {?=} typeModifiers
 * @return {?}
 */
export function importType(id, typeParams = null, typeModifiers = null) {
    return isPresent(id) ? expressionType(importExpr(id), typeParams, typeModifiers) : null;
}
/**
 * @param {?} expr
 * @param {?=} typeParams
 * @param {?=} typeModifiers
 * @return {?}
 */
export function expressionType(expr, typeParams = null, typeModifiers = null) {
    return isPresent(expr) ? new ExpressionType(expr, typeParams, typeModifiers) : null;
}
/**
 * @param {?} values
 * @param {?=} type
 * @return {?}
 */
export function literalArr(values, type = null) {
    return new LiteralArrayExpr(values, type);
}
/**
 * @param {?} values
 * @param {?=} type
 * @param {?=} quoted
 * @return {?}
 */
export function literalMap(values, type = null, quoted = false) {
    return new LiteralMapExpr(values.map(entry => new LiteralMapEntry(entry[0], entry[1], quoted)), type);
}
/**
 * @param {?} expr
 * @return {?}
 */
export function not(expr) {
    return new NotExpr(expr);
}
/**
 * @param {?} params
 * @param {?} body
 * @param {?=} type
 * @return {?}
 */
export function fn(params, body, type = null) {
    return new FunctionExpr(params, body, type);
}
/**
 * @param {?} value
 * @param {?=} type
 * @return {?}
 */
export function literal(value, type = null) {
    return new LiteralExpr(value, type);
}
//# sourceMappingURL=output_ast.js.map