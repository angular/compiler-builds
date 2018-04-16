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
/** @enum {number} */
var TypeModifier = {
    Const: 0,
};
export { TypeModifier };
TypeModifier[TypeModifier.Const] = "Const";
/**
 * @abstract
 */
var /**
 * @abstract
 */
Type = /** @class */ (function () {
    function Type(modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
    }
    /**
     * @param {?} modifier
     * @return {?}
     */
    Type.prototype.hasModifier = /**
     * @param {?} modifier
     * @return {?}
     */
    function (modifier) { return /** @type {?} */ ((this.modifiers)).indexOf(modifier) !== -1; };
    return Type;
}());
/**
 * @abstract
 */
export { Type };
function Type_tsickle_Closure_declarations() {
    /** @type {?} */
    Type.prototype.modifiers;
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    Type.prototype.visitType = function (visitor, context) { };
}
/** @enum {number} */
var BuiltinTypeName = {
    Dynamic: 0,
    Bool: 1,
    String: 2,
    Int: 3,
    Number: 4,
    Function: 5,
    Inferred: 6,
};
export { BuiltinTypeName };
BuiltinTypeName[BuiltinTypeName.Dynamic] = "Dynamic";
BuiltinTypeName[BuiltinTypeName.Bool] = "Bool";
BuiltinTypeName[BuiltinTypeName.String] = "String";
BuiltinTypeName[BuiltinTypeName.Int] = "Int";
BuiltinTypeName[BuiltinTypeName.Number] = "Number";
BuiltinTypeName[BuiltinTypeName.Function] = "Function";
BuiltinTypeName[BuiltinTypeName.Inferred] = "Inferred";
var BuiltinType = /** @class */ (function (_super) {
    tslib_1.__extends(BuiltinType, _super);
    function BuiltinType(name, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers) || this;
        _this.name = name;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    BuiltinType.prototype.visitType = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitBuiltinType(this, context);
    };
    return BuiltinType;
}(Type));
export { BuiltinType };
function BuiltinType_tsickle_Closure_declarations() {
    /** @type {?} */
    BuiltinType.prototype.name;
}
var ExpressionType = /** @class */ (function (_super) {
    tslib_1.__extends(ExpressionType, _super);
    function ExpressionType(value, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers) || this;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ExpressionType.prototype.visitType = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitExpressionType(this, context);
    };
    return ExpressionType;
}(Type));
export { ExpressionType };
function ExpressionType_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpressionType.prototype.value;
}
var ArrayType = /** @class */ (function (_super) {
    tslib_1.__extends(ArrayType, _super);
    function ArrayType(of, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers) || this;
        _this.of = of;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ArrayType.prototype.visitType = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitArrayType(this, context);
    };
    return ArrayType;
}(Type));
export { ArrayType };
function ArrayType_tsickle_Closure_declarations() {
    /** @type {?} */
    ArrayType.prototype.of;
}
var MapType = /** @class */ (function (_super) {
    tslib_1.__extends(MapType, _super);
    function MapType(valueType, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers) || this;
        _this.valueType = valueType || null;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    MapType.prototype.visitType = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitMapType(this, context); };
    return MapType;
}(Type));
export { MapType };
function MapType_tsickle_Closure_declarations() {
    /** @type {?} */
    MapType.prototype.valueType;
}
export var /** @type {?} */ DYNAMIC_TYPE = new BuiltinType(BuiltinTypeName.Dynamic);
export var /** @type {?} */ INFERRED_TYPE = new BuiltinType(BuiltinTypeName.Inferred);
export var /** @type {?} */ BOOL_TYPE = new BuiltinType(BuiltinTypeName.Bool);
export var /** @type {?} */ INT_TYPE = new BuiltinType(BuiltinTypeName.Int);
export var /** @type {?} */ NUMBER_TYPE = new BuiltinType(BuiltinTypeName.Number);
export var /** @type {?} */ STRING_TYPE = new BuiltinType(BuiltinTypeName.String);
export var /** @type {?} */ FUNCTION_TYPE = new BuiltinType(BuiltinTypeName.Function);
/**
 * @record
 */
export function TypeVisitor() { }
function TypeVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    TypeVisitor.prototype.visitBuiltinType;
    /** @type {?} */
    TypeVisitor.prototype.visitExpressionType;
    /** @type {?} */
    TypeVisitor.prototype.visitArrayType;
    /** @type {?} */
    TypeVisitor.prototype.visitMapType;
}
/** @enum {number} */
var BinaryOperator = {
    Equals: 0,
    NotEquals: 1,
    Identical: 2,
    NotIdentical: 3,
    Minus: 4,
    Plus: 5,
    Divide: 6,
    Multiply: 7,
    Modulo: 8,
    And: 9,
    Or: 10,
    BitwiseAnd: 11,
    Lower: 12,
    LowerEquals: 13,
    Bigger: 14,
    BiggerEquals: 15,
};
export { BinaryOperator };
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
BinaryOperator[BinaryOperator.BitwiseAnd] = "BitwiseAnd";
BinaryOperator[BinaryOperator.Lower] = "Lower";
BinaryOperator[BinaryOperator.LowerEquals] = "LowerEquals";
BinaryOperator[BinaryOperator.Bigger] = "Bigger";
BinaryOperator[BinaryOperator.BiggerEquals] = "BiggerEquals";
/**
 * @template T
 * @param {?} base
 * @param {?} other
 * @return {?}
 */
export function nullSafeIsEquivalent(base, other) {
    if (base == null || other == null) {
        return base == other;
    }
    return base.isEquivalent(other);
}
/**
 * @template T
 * @param {?} base
 * @param {?} other
 * @return {?}
 */
export function areAllEquivalent(base, other) {
    var /** @type {?} */ len = base.length;
    if (len !== other.length) {
        return false;
    }
    for (var /** @type {?} */ i = 0; i < len; i++) {
        if (!base[i].isEquivalent(other[i])) {
            return false;
        }
    }
    return true;
}
/**
 * @abstract
 */
var /**
 * @abstract
 */
Expression = /** @class */ (function () {
    function Expression(type, sourceSpan) {
        this.type = type || null;
        this.sourceSpan = sourceSpan || null;
    }
    /**
     * @param {?} name
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.prop = /**
     * @param {?} name
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (name, sourceSpan) {
        return new ReadPropExpr(this, name, null, sourceSpan);
    };
    /**
     * @param {?} index
     * @param {?=} type
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.key = /**
     * @param {?} index
     * @param {?=} type
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (index, type, sourceSpan) {
        return new ReadKeyExpr(this, index, type, sourceSpan);
    };
    /**
     * @param {?} name
     * @param {?} params
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.callMethod = /**
     * @param {?} name
     * @param {?} params
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (name, params, sourceSpan) {
        return new InvokeMethodExpr(this, name, params, null, sourceSpan);
    };
    /**
     * @param {?} params
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.callFn = /**
     * @param {?} params
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (params, sourceSpan) {
        return new InvokeFunctionExpr(this, params, null, sourceSpan);
    };
    /**
     * @param {?} params
     * @param {?=} type
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.instantiate = /**
     * @param {?} params
     * @param {?=} type
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (params, type, sourceSpan) {
        return new InstantiateExpr(this, params, type, sourceSpan);
    };
    /**
     * @param {?} trueCase
     * @param {?=} falseCase
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.conditional = /**
     * @param {?} trueCase
     * @param {?=} falseCase
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (trueCase, falseCase, sourceSpan) {
        if (falseCase === void 0) { falseCase = null; }
        return new ConditionalExpr(this, trueCase, falseCase, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.equals = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Equals, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.notEquals = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.NotEquals, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.identical = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Identical, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.notIdentical = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.NotIdentical, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.minus = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Minus, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.plus = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Plus, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.divide = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Divide, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.multiply = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Multiply, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.modulo = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Modulo, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.and = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.And, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @param {?=} parens
     * @return {?}
     */
    Expression.prototype.bitwiseAnd = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @param {?=} parens
     * @return {?}
     */
    function (rhs, sourceSpan, parens) {
        if (parens === void 0) { parens = true; }
        return new BinaryOperatorExpr(BinaryOperator.BitwiseAnd, this, rhs, null, sourceSpan, parens);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.or = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Or, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.lower = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Lower, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.lowerEquals = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.LowerEquals, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.bigger = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Bigger, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.biggerEquals = /**
     * @param {?} rhs
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.BiggerEquals, this, rhs, null, sourceSpan);
    };
    /**
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.isBlank = /**
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (sourceSpan) {
        // Note: We use equals by purpose here to compare to null and undefined in JS.
        // We use the typed null to allow strictNullChecks to narrow types.
        return this.equals(TYPED_NULL_EXPR, sourceSpan);
    };
    /**
     * @param {?} type
     * @param {?=} sourceSpan
     * @return {?}
     */
    Expression.prototype.cast = /**
     * @param {?} type
     * @param {?=} sourceSpan
     * @return {?}
     */
    function (type, sourceSpan) {
        return new CastExpr(this, type, sourceSpan);
    };
    /**
     * @return {?}
     */
    Expression.prototype.toStmt = /**
     * @return {?}
     */
    function () { return new ExpressionStatement(this, null); };
    return Expression;
}());
/**
 * @abstract
 */
export { Expression };
function Expression_tsickle_Closure_declarations() {
    /** @type {?} */
    Expression.prototype.type;
    /** @type {?} */
    Expression.prototype.sourceSpan;
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    Expression.prototype.visitExpression = function (visitor, context) { };
    /**
     * Calculates whether this expression produces the same value as the given expression.
     * Note: We don't check Types nor ParseSourceSpans nor function arguments.
     * @abstract
     * @param {?} e
     * @return {?}
     */
    Expression.prototype.isEquivalent = function (e) { };
    /**
     * Return true if the expression is constant.
     * @abstract
     * @return {?}
     */
    Expression.prototype.isConstant = function () { };
}
/** @enum {number} */
var BuiltinVar = {
    This: 0,
    Super: 1,
    CatchError: 2,
    CatchStack: 3,
};
export { BuiltinVar };
BuiltinVar[BuiltinVar.This] = "This";
BuiltinVar[BuiltinVar.Super] = "Super";
BuiltinVar[BuiltinVar.CatchError] = "CatchError";
BuiltinVar[BuiltinVar.CatchStack] = "CatchStack";
var ReadVarExpr = /** @class */ (function (_super) {
    tslib_1.__extends(ReadVarExpr, _super);
    function ReadVarExpr(name, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        if (typeof name === 'string') {
            _this.name = name;
            _this.builtin = null;
        }
        else {
            _this.name = null;
            _this.builtin = name;
        }
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    ReadVarExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof ReadVarExpr && this.name === e.name && this.builtin === e.builtin;
    };
    /**
     * @return {?}
     */
    ReadVarExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ReadVarExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitReadVarExpr(this, context);
    };
    /**
     * @param {?} value
     * @return {?}
     */
    ReadVarExpr.prototype.set = /**
     * @param {?} value
     * @return {?}
     */
    function (value) {
        if (!this.name) {
            throw new Error("Built in variable " + this.builtin + " can not be assigned to.");
        }
        return new WriteVarExpr(this.name, value, null, this.sourceSpan);
    };
    return ReadVarExpr;
}(Expression));
export { ReadVarExpr };
function ReadVarExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ReadVarExpr.prototype.name;
    /** @type {?} */
    ReadVarExpr.prototype.builtin;
}
var WriteVarExpr = /** @class */ (function (_super) {
    tslib_1.__extends(WriteVarExpr, _super);
    function WriteVarExpr(name, value, type, sourceSpan) {
        var _this = _super.call(this, type || value.type, sourceSpan) || this;
        _this.name = name;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    WriteVarExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof WriteVarExpr && this.name === e.name && this.value.isEquivalent(e.value);
    };
    /**
     * @return {?}
     */
    WriteVarExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    WriteVarExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitWriteVarExpr(this, context);
    };
    /**
     * @param {?=} type
     * @param {?=} modifiers
     * @return {?}
     */
    WriteVarExpr.prototype.toDeclStmt = /**
     * @param {?=} type
     * @param {?=} modifiers
     * @return {?}
     */
    function (type, modifiers) {
        return new DeclareVarStmt(this.name, this.value, type, modifiers, this.sourceSpan);
    };
    return WriteVarExpr;
}(Expression));
export { WriteVarExpr };
function WriteVarExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    WriteVarExpr.prototype.value;
    /** @type {?} */
    WriteVarExpr.prototype.name;
}
var WriteKeyExpr = /** @class */ (function (_super) {
    tslib_1.__extends(WriteKeyExpr, _super);
    function WriteKeyExpr(receiver, index, value, type, sourceSpan) {
        var _this = _super.call(this, type || value.type, sourceSpan) || this;
        _this.receiver = receiver;
        _this.index = index;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    WriteKeyExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof WriteKeyExpr && this.receiver.isEquivalent(e.receiver) &&
            this.index.isEquivalent(e.index) && this.value.isEquivalent(e.value);
    };
    /**
     * @return {?}
     */
    WriteKeyExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    WriteKeyExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitWriteKeyExpr(this, context);
    };
    return WriteKeyExpr;
}(Expression));
export { WriteKeyExpr };
function WriteKeyExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    WriteKeyExpr.prototype.value;
    /** @type {?} */
    WriteKeyExpr.prototype.receiver;
    /** @type {?} */
    WriteKeyExpr.prototype.index;
}
var WritePropExpr = /** @class */ (function (_super) {
    tslib_1.__extends(WritePropExpr, _super);
    function WritePropExpr(receiver, name, value, type, sourceSpan) {
        var _this = _super.call(this, type || value.type, sourceSpan) || this;
        _this.receiver = receiver;
        _this.name = name;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    WritePropExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof WritePropExpr && this.receiver.isEquivalent(e.receiver) &&
            this.name === e.name && this.value.isEquivalent(e.value);
    };
    /**
     * @return {?}
     */
    WritePropExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    WritePropExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitWritePropExpr(this, context);
    };
    return WritePropExpr;
}(Expression));
export { WritePropExpr };
function WritePropExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    WritePropExpr.prototype.value;
    /** @type {?} */
    WritePropExpr.prototype.receiver;
    /** @type {?} */
    WritePropExpr.prototype.name;
}
/** @enum {number} */
var BuiltinMethod = {
    ConcatArray: 0,
    SubscribeObservable: 1,
    Bind: 2,
};
export { BuiltinMethod };
BuiltinMethod[BuiltinMethod.ConcatArray] = "ConcatArray";
BuiltinMethod[BuiltinMethod.SubscribeObservable] = "SubscribeObservable";
BuiltinMethod[BuiltinMethod.Bind] = "Bind";
var InvokeMethodExpr = /** @class */ (function (_super) {
    tslib_1.__extends(InvokeMethodExpr, _super);
    function InvokeMethodExpr(receiver, method, args, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.receiver = receiver;
        _this.args = args;
        if (typeof method === 'string') {
            _this.name = method;
            _this.builtin = null;
        }
        else {
            _this.name = null;
            _this.builtin = /** @type {?} */ (method);
        }
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    InvokeMethodExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof InvokeMethodExpr && this.receiver.isEquivalent(e.receiver) &&
            this.name === e.name && this.builtin === e.builtin && areAllEquivalent(this.args, e.args);
    };
    /**
     * @return {?}
     */
    InvokeMethodExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    InvokeMethodExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitInvokeMethodExpr(this, context);
    };
    return InvokeMethodExpr;
}(Expression));
export { InvokeMethodExpr };
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
var InvokeFunctionExpr = /** @class */ (function (_super) {
    tslib_1.__extends(InvokeFunctionExpr, _super);
    function InvokeFunctionExpr(fn, args, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.fn = fn;
        _this.args = args;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    InvokeFunctionExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof InvokeFunctionExpr && this.fn.isEquivalent(e.fn) &&
            areAllEquivalent(this.args, e.args);
    };
    /**
     * @return {?}
     */
    InvokeFunctionExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    InvokeFunctionExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitInvokeFunctionExpr(this, context);
    };
    return InvokeFunctionExpr;
}(Expression));
export { InvokeFunctionExpr };
function InvokeFunctionExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    InvokeFunctionExpr.prototype.fn;
    /** @type {?} */
    InvokeFunctionExpr.prototype.args;
}
var InstantiateExpr = /** @class */ (function (_super) {
    tslib_1.__extends(InstantiateExpr, _super);
    function InstantiateExpr(classExpr, args, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.classExpr = classExpr;
        _this.args = args;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    InstantiateExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof InstantiateExpr && this.classExpr.isEquivalent(e.classExpr) &&
            areAllEquivalent(this.args, e.args);
    };
    /**
     * @return {?}
     */
    InstantiateExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    InstantiateExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitInstantiateExpr(this, context);
    };
    return InstantiateExpr;
}(Expression));
export { InstantiateExpr };
function InstantiateExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    InstantiateExpr.prototype.classExpr;
    /** @type {?} */
    InstantiateExpr.prototype.args;
}
var LiteralExpr = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralExpr, _super);
    function LiteralExpr(value, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    LiteralExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof LiteralExpr && this.value === e.value;
    };
    /**
     * @return {?}
     */
    LiteralExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return true; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    LiteralExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitLiteralExpr(this, context);
    };
    return LiteralExpr;
}(Expression));
export { LiteralExpr };
function LiteralExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralExpr.prototype.value;
}
var ExternalExpr = /** @class */ (function (_super) {
    tslib_1.__extends(ExternalExpr, _super);
    function ExternalExpr(value, type, typeParams, sourceSpan) {
        if (typeParams === void 0) { typeParams = null; }
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.value = value;
        _this.typeParams = typeParams;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    ExternalExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof ExternalExpr && this.value.name === e.value.name &&
            this.value.moduleName === e.value.moduleName && this.value.runtime === e.value.runtime;
    };
    /**
     * @return {?}
     */
    ExternalExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ExternalExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitExternalExpr(this, context);
    };
    return ExternalExpr;
}(Expression));
export { ExternalExpr };
function ExternalExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ExternalExpr.prototype.value;
    /** @type {?} */
    ExternalExpr.prototype.typeParams;
}
var ExternalReference = /** @class */ (function () {
    function ExternalReference(moduleName, name, runtime) {
        this.moduleName = moduleName;
        this.name = name;
        this.runtime = runtime;
    }
    return ExternalReference;
}());
export { ExternalReference };
function ExternalReference_tsickle_Closure_declarations() {
    /** @type {?} */
    ExternalReference.prototype.moduleName;
    /** @type {?} */
    ExternalReference.prototype.name;
    /** @type {?} */
    ExternalReference.prototype.runtime;
}
var ConditionalExpr = /** @class */ (function (_super) {
    tslib_1.__extends(ConditionalExpr, _super);
    function ConditionalExpr(condition, trueCase, falseCase, type, sourceSpan) {
        if (falseCase === void 0) { falseCase = null; }
        var _this = _super.call(this, type || trueCase.type, sourceSpan) || this;
        _this.condition = condition;
        _this.falseCase = falseCase;
        _this.trueCase = trueCase;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    ConditionalExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof ConditionalExpr && this.condition.isEquivalent(e.condition) &&
            this.trueCase.isEquivalent(e.trueCase) && nullSafeIsEquivalent(this.falseCase, e.falseCase);
    };
    /**
     * @return {?}
     */
    ConditionalExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ConditionalExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitConditionalExpr(this, context);
    };
    return ConditionalExpr;
}(Expression));
export { ConditionalExpr };
function ConditionalExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ConditionalExpr.prototype.trueCase;
    /** @type {?} */
    ConditionalExpr.prototype.condition;
    /** @type {?} */
    ConditionalExpr.prototype.falseCase;
}
var NotExpr = /** @class */ (function (_super) {
    tslib_1.__extends(NotExpr, _super);
    function NotExpr(condition, sourceSpan) {
        var _this = _super.call(this, BOOL_TYPE, sourceSpan) || this;
        _this.condition = condition;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    NotExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof NotExpr && this.condition.isEquivalent(e.condition);
    };
    /**
     * @return {?}
     */
    NotExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    NotExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitNotExpr(this, context);
    };
    return NotExpr;
}(Expression));
export { NotExpr };
function NotExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    NotExpr.prototype.condition;
}
var AssertNotNull = /** @class */ (function (_super) {
    tslib_1.__extends(AssertNotNull, _super);
    function AssertNotNull(condition, sourceSpan) {
        var _this = _super.call(this, condition.type, sourceSpan) || this;
        _this.condition = condition;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    AssertNotNull.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof AssertNotNull && this.condition.isEquivalent(e.condition);
    };
    /**
     * @return {?}
     */
    AssertNotNull.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AssertNotNull.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitAssertNotNullExpr(this, context);
    };
    return AssertNotNull;
}(Expression));
export { AssertNotNull };
function AssertNotNull_tsickle_Closure_declarations() {
    /** @type {?} */
    AssertNotNull.prototype.condition;
}
var CastExpr = /** @class */ (function (_super) {
    tslib_1.__extends(CastExpr, _super);
    function CastExpr(value, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    CastExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof CastExpr && this.value.isEquivalent(e.value);
    };
    /**
     * @return {?}
     */
    CastExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    CastExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitCastExpr(this, context);
    };
    return CastExpr;
}(Expression));
export { CastExpr };
function CastExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    CastExpr.prototype.value;
}
var FnParam = /** @class */ (function () {
    function FnParam(name, type) {
        if (type === void 0) { type = null; }
        this.name = name;
        this.type = type;
    }
    /**
     * @param {?} param
     * @return {?}
     */
    FnParam.prototype.isEquivalent = /**
     * @param {?} param
     * @return {?}
     */
    function (param) { return this.name === param.name; };
    return FnParam;
}());
export { FnParam };
function FnParam_tsickle_Closure_declarations() {
    /** @type {?} */
    FnParam.prototype.name;
    /** @type {?} */
    FnParam.prototype.type;
}
var FunctionExpr = /** @class */ (function (_super) {
    tslib_1.__extends(FunctionExpr, _super);
    function FunctionExpr(params, statements, type, sourceSpan, name) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.params = params;
        _this.statements = statements;
        _this.name = name;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    FunctionExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof FunctionExpr && areAllEquivalent(this.params, e.params) &&
            areAllEquivalent(this.statements, e.statements);
    };
    /**
     * @return {?}
     */
    FunctionExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    FunctionExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitFunctionExpr(this, context);
    };
    /**
     * @param {?} name
     * @param {?=} modifiers
     * @return {?}
     */
    FunctionExpr.prototype.toDeclStmt = /**
     * @param {?} name
     * @param {?=} modifiers
     * @return {?}
     */
    function (name, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers, this.sourceSpan);
    };
    return FunctionExpr;
}(Expression));
export { FunctionExpr };
function FunctionExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    FunctionExpr.prototype.params;
    /** @type {?} */
    FunctionExpr.prototype.statements;
    /** @type {?} */
    FunctionExpr.prototype.name;
}
var BinaryOperatorExpr = /** @class */ (function (_super) {
    tslib_1.__extends(BinaryOperatorExpr, _super);
    function BinaryOperatorExpr(operator, lhs, rhs, type, sourceSpan, parens) {
        if (parens === void 0) { parens = true; }
        var _this = _super.call(this, type || lhs.type, sourceSpan) || this;
        _this.operator = operator;
        _this.rhs = rhs;
        _this.parens = parens;
        _this.lhs = lhs;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    BinaryOperatorExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof BinaryOperatorExpr && this.operator === e.operator &&
            this.lhs.isEquivalent(e.lhs) && this.rhs.isEquivalent(e.rhs);
    };
    /**
     * @return {?}
     */
    BinaryOperatorExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    BinaryOperatorExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitBinaryOperatorExpr(this, context);
    };
    return BinaryOperatorExpr;
}(Expression));
export { BinaryOperatorExpr };
function BinaryOperatorExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    BinaryOperatorExpr.prototype.lhs;
    /** @type {?} */
    BinaryOperatorExpr.prototype.operator;
    /** @type {?} */
    BinaryOperatorExpr.prototype.rhs;
    /** @type {?} */
    BinaryOperatorExpr.prototype.parens;
}
var ReadPropExpr = /** @class */ (function (_super) {
    tslib_1.__extends(ReadPropExpr, _super);
    function ReadPropExpr(receiver, name, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.receiver = receiver;
        _this.name = name;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    ReadPropExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof ReadPropExpr && this.receiver.isEquivalent(e.receiver) &&
            this.name === e.name;
    };
    /**
     * @return {?}
     */
    ReadPropExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ReadPropExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitReadPropExpr(this, context);
    };
    /**
     * @param {?} value
     * @return {?}
     */
    ReadPropExpr.prototype.set = /**
     * @param {?} value
     * @return {?}
     */
    function (value) {
        return new WritePropExpr(this.receiver, this.name, value, null, this.sourceSpan);
    };
    return ReadPropExpr;
}(Expression));
export { ReadPropExpr };
function ReadPropExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ReadPropExpr.prototype.receiver;
    /** @type {?} */
    ReadPropExpr.prototype.name;
}
var ReadKeyExpr = /** @class */ (function (_super) {
    tslib_1.__extends(ReadKeyExpr, _super);
    function ReadKeyExpr(receiver, index, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.receiver = receiver;
        _this.index = index;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    ReadKeyExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof ReadKeyExpr && this.receiver.isEquivalent(e.receiver) &&
            this.index.isEquivalent(e.index);
    };
    /**
     * @return {?}
     */
    ReadKeyExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ReadKeyExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitReadKeyExpr(this, context);
    };
    /**
     * @param {?} value
     * @return {?}
     */
    ReadKeyExpr.prototype.set = /**
     * @param {?} value
     * @return {?}
     */
    function (value) {
        return new WriteKeyExpr(this.receiver, this.index, value, null, this.sourceSpan);
    };
    return ReadKeyExpr;
}(Expression));
export { ReadKeyExpr };
function ReadKeyExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    ReadKeyExpr.prototype.receiver;
    /** @type {?} */
    ReadKeyExpr.prototype.index;
}
var LiteralArrayExpr = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralArrayExpr, _super);
    function LiteralArrayExpr(entries, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.entries = entries;
        return _this;
    }
    /**
     * @return {?}
     */
    LiteralArrayExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return this.entries.every(function (e) { return e.isConstant(); }); };
    /**
     * @param {?} e
     * @return {?}
     */
    LiteralArrayExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof LiteralArrayExpr && areAllEquivalent(this.entries, e.entries);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    LiteralArrayExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitLiteralArrayExpr(this, context);
    };
    return LiteralArrayExpr;
}(Expression));
export { LiteralArrayExpr };
function LiteralArrayExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralArrayExpr.prototype.entries;
}
var LiteralMapEntry = /** @class */ (function () {
    function LiteralMapEntry(key, value, quoted) {
        this.key = key;
        this.value = value;
        this.quoted = quoted;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    LiteralMapEntry.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return this.key === e.key && this.value.isEquivalent(e.value);
    };
    return LiteralMapEntry;
}());
export { LiteralMapEntry };
function LiteralMapEntry_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralMapEntry.prototype.key;
    /** @type {?} */
    LiteralMapEntry.prototype.value;
    /** @type {?} */
    LiteralMapEntry.prototype.quoted;
}
var LiteralMapExpr = /** @class */ (function (_super) {
    tslib_1.__extends(LiteralMapExpr, _super);
    function LiteralMapExpr(entries, type, sourceSpan) {
        var _this = _super.call(this, type, sourceSpan) || this;
        _this.entries = entries;
        _this.valueType = null;
        if (type) {
            _this.valueType = type.valueType;
        }
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    LiteralMapExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof LiteralMapExpr && areAllEquivalent(this.entries, e.entries);
    };
    /**
     * @return {?}
     */
    LiteralMapExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return this.entries.every(function (e) { return e.value.isConstant(); }); };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    LiteralMapExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitLiteralMapExpr(this, context);
    };
    return LiteralMapExpr;
}(Expression));
export { LiteralMapExpr };
function LiteralMapExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    LiteralMapExpr.prototype.valueType;
    /** @type {?} */
    LiteralMapExpr.prototype.entries;
}
var CommaExpr = /** @class */ (function (_super) {
    tslib_1.__extends(CommaExpr, _super);
    function CommaExpr(parts, sourceSpan) {
        var _this = _super.call(this, parts[parts.length - 1].type, sourceSpan) || this;
        _this.parts = parts;
        return _this;
    }
    /**
     * @param {?} e
     * @return {?}
     */
    CommaExpr.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof CommaExpr && areAllEquivalent(this.parts, e.parts);
    };
    /**
     * @return {?}
     */
    CommaExpr.prototype.isConstant = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    CommaExpr.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitCommaExpr(this, context);
    };
    return CommaExpr;
}(Expression));
export { CommaExpr };
function CommaExpr_tsickle_Closure_declarations() {
    /** @type {?} */
    CommaExpr.prototype.parts;
}
/**
 * @record
 */
export function ExpressionVisitor() { }
function ExpressionVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpressionVisitor.prototype.visitReadVarExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitWriteVarExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitWriteKeyExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitWritePropExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitInvokeMethodExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitInvokeFunctionExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitInstantiateExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitLiteralExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitExternalExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitConditionalExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitNotExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitAssertNotNullExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitCastExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitFunctionExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitBinaryOperatorExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitReadPropExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitReadKeyExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitLiteralArrayExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitLiteralMapExpr;
    /** @type {?} */
    ExpressionVisitor.prototype.visitCommaExpr;
}
export var /** @type {?} */ THIS_EXPR = new ReadVarExpr(BuiltinVar.This, null, null);
export var /** @type {?} */ SUPER_EXPR = new ReadVarExpr(BuiltinVar.Super, null, null);
export var /** @type {?} */ CATCH_ERROR_VAR = new ReadVarExpr(BuiltinVar.CatchError, null, null);
export var /** @type {?} */ CATCH_STACK_VAR = new ReadVarExpr(BuiltinVar.CatchStack, null, null);
export var /** @type {?} */ NULL_EXPR = new LiteralExpr(null, null, null);
export var /** @type {?} */ TYPED_NULL_EXPR = new LiteralExpr(null, INFERRED_TYPE, null);
/** @enum {number} */
var StmtModifier = {
    Final: 0,
    Private: 1,
    Exported: 2,
    Static: 3,
};
export { StmtModifier };
StmtModifier[StmtModifier.Final] = "Final";
StmtModifier[StmtModifier.Private] = "Private";
StmtModifier[StmtModifier.Exported] = "Exported";
StmtModifier[StmtModifier.Static] = "Static";
/**
 * @abstract
 */
var /**
 * @abstract
 */
Statement = /** @class */ (function () {
    function Statement(modifiers, sourceSpan) {
        this.modifiers = modifiers || [];
        this.sourceSpan = sourceSpan || null;
    }
    /**
     * @param {?} modifier
     * @return {?}
     */
    Statement.prototype.hasModifier = /**
     * @param {?} modifier
     * @return {?}
     */
    function (modifier) { return /** @type {?} */ ((this.modifiers)).indexOf(modifier) !== -1; };
    return Statement;
}());
/**
 * @abstract
 */
export { Statement };
function Statement_tsickle_Closure_declarations() {
    /** @type {?} */
    Statement.prototype.modifiers;
    /** @type {?} */
    Statement.prototype.sourceSpan;
    /**
     * Calculates whether this statement produces the same value as the given statement.
     * Note: We don't check Types nor ParseSourceSpans nor function arguments.
     * @abstract
     * @param {?} stmt
     * @return {?}
     */
    Statement.prototype.isEquivalent = function (stmt) { };
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    Statement.prototype.visitStatement = function (visitor, context) { };
}
var DeclareVarStmt = /** @class */ (function (_super) {
    tslib_1.__extends(DeclareVarStmt, _super);
    function DeclareVarStmt(name, value, type, modifiers, sourceSpan) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers, sourceSpan) || this;
        _this.name = name;
        _this.value = value;
        _this.type = type || (value && value.type) || null;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    DeclareVarStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof DeclareVarStmt && this.name === stmt.name &&
            (this.value ? !!stmt.value && this.value.isEquivalent(stmt.value) : !stmt.value);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    DeclareVarStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitDeclareVarStmt(this, context);
    };
    return DeclareVarStmt;
}(Statement));
export { DeclareVarStmt };
function DeclareVarStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    DeclareVarStmt.prototype.type;
    /** @type {?} */
    DeclareVarStmt.prototype.name;
    /** @type {?} */
    DeclareVarStmt.prototype.value;
}
var DeclareFunctionStmt = /** @class */ (function (_super) {
    tslib_1.__extends(DeclareFunctionStmt, _super);
    function DeclareFunctionStmt(name, params, statements, type, modifiers, sourceSpan) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers, sourceSpan) || this;
        _this.name = name;
        _this.params = params;
        _this.statements = statements;
        _this.type = type || null;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    DeclareFunctionStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof DeclareFunctionStmt && areAllEquivalent(this.params, stmt.params) &&
            areAllEquivalent(this.statements, stmt.statements);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    DeclareFunctionStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitDeclareFunctionStmt(this, context);
    };
    return DeclareFunctionStmt;
}(Statement));
export { DeclareFunctionStmt };
function DeclareFunctionStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    DeclareFunctionStmt.prototype.type;
    /** @type {?} */
    DeclareFunctionStmt.prototype.name;
    /** @type {?} */
    DeclareFunctionStmt.prototype.params;
    /** @type {?} */
    DeclareFunctionStmt.prototype.statements;
}
var ExpressionStatement = /** @class */ (function (_super) {
    tslib_1.__extends(ExpressionStatement, _super);
    function ExpressionStatement(expr, sourceSpan) {
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.expr = expr;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    ExpressionStatement.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof ExpressionStatement && this.expr.isEquivalent(stmt.expr);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ExpressionStatement.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitExpressionStmt(this, context);
    };
    return ExpressionStatement;
}(Statement));
export { ExpressionStatement };
function ExpressionStatement_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpressionStatement.prototype.expr;
}
var ReturnStatement = /** @class */ (function (_super) {
    tslib_1.__extends(ReturnStatement, _super);
    function ReturnStatement(value, sourceSpan) {
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.value = value;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    ReturnStatement.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof ReturnStatement && this.value.isEquivalent(stmt.value);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ReturnStatement.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitReturnStmt(this, context);
    };
    return ReturnStatement;
}(Statement));
export { ReturnStatement };
function ReturnStatement_tsickle_Closure_declarations() {
    /** @type {?} */
    ReturnStatement.prototype.value;
}
var AbstractClassPart = /** @class */ (function () {
    function AbstractClassPart(type, modifiers) {
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
        this.type = type || null;
    }
    /**
     * @param {?} modifier
     * @return {?}
     */
    AbstractClassPart.prototype.hasModifier = /**
     * @param {?} modifier
     * @return {?}
     */
    function (modifier) { return /** @type {?} */ ((this.modifiers)).indexOf(modifier) !== -1; };
    return AbstractClassPart;
}());
export { AbstractClassPart };
function AbstractClassPart_tsickle_Closure_declarations() {
    /** @type {?} */
    AbstractClassPart.prototype.type;
    /** @type {?} */
    AbstractClassPart.prototype.modifiers;
}
var ClassField = /** @class */ (function (_super) {
    tslib_1.__extends(ClassField, _super);
    function ClassField(name, type, modifiers, initializer) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, type, modifiers) || this;
        _this.name = name;
        _this.initializer = initializer;
        return _this;
    }
    /**
     * @param {?} f
     * @return {?}
     */
    ClassField.prototype.isEquivalent = /**
     * @param {?} f
     * @return {?}
     */
    function (f) { return this.name === f.name; };
    return ClassField;
}(AbstractClassPart));
export { ClassField };
function ClassField_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassField.prototype.name;
    /** @type {?} */
    ClassField.prototype.initializer;
}
var ClassMethod = /** @class */ (function (_super) {
    tslib_1.__extends(ClassMethod, _super);
    function ClassMethod(name, params, body, type, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, type, modifiers) || this;
        _this.name = name;
        _this.params = params;
        _this.body = body;
        return _this;
    }
    /**
     * @param {?} m
     * @return {?}
     */
    ClassMethod.prototype.isEquivalent = /**
     * @param {?} m
     * @return {?}
     */
    function (m) {
        return this.name === m.name && areAllEquivalent(this.body, m.body);
    };
    return ClassMethod;
}(AbstractClassPart));
export { ClassMethod };
function ClassMethod_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassMethod.prototype.name;
    /** @type {?} */
    ClassMethod.prototype.params;
    /** @type {?} */
    ClassMethod.prototype.body;
}
var ClassGetter = /** @class */ (function (_super) {
    tslib_1.__extends(ClassGetter, _super);
    function ClassGetter(name, body, type, modifiers) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, type, modifiers) || this;
        _this.name = name;
        _this.body = body;
        return _this;
    }
    /**
     * @param {?} m
     * @return {?}
     */
    ClassGetter.prototype.isEquivalent = /**
     * @param {?} m
     * @return {?}
     */
    function (m) {
        return this.name === m.name && areAllEquivalent(this.body, m.body);
    };
    return ClassGetter;
}(AbstractClassPart));
export { ClassGetter };
function ClassGetter_tsickle_Closure_declarations() {
    /** @type {?} */
    ClassGetter.prototype.name;
    /** @type {?} */
    ClassGetter.prototype.body;
}
var ClassStmt = /** @class */ (function (_super) {
    tslib_1.__extends(ClassStmt, _super);
    function ClassStmt(name, parent, fields, getters, constructorMethod, methods, modifiers, sourceSpan) {
        if (modifiers === void 0) { modifiers = null; }
        var _this = _super.call(this, modifiers, sourceSpan) || this;
        _this.name = name;
        _this.parent = parent;
        _this.fields = fields;
        _this.getters = getters;
        _this.constructorMethod = constructorMethod;
        _this.methods = methods;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    ClassStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof ClassStmt && this.name === stmt.name &&
            nullSafeIsEquivalent(this.parent, stmt.parent) &&
            areAllEquivalent(this.fields, stmt.fields) &&
            areAllEquivalent(this.getters, stmt.getters) &&
            this.constructorMethod.isEquivalent(stmt.constructorMethod) &&
            areAllEquivalent(this.methods, stmt.methods);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ClassStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitDeclareClassStmt(this, context);
    };
    return ClassStmt;
}(Statement));
export { ClassStmt };
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
var IfStmt = /** @class */ (function (_super) {
    tslib_1.__extends(IfStmt, _super);
    function IfStmt(condition, trueCase, falseCase, sourceSpan) {
        if (falseCase === void 0) { falseCase = []; }
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.condition = condition;
        _this.trueCase = trueCase;
        _this.falseCase = falseCase;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    IfStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof IfStmt && this.condition.isEquivalent(stmt.condition) &&
            areAllEquivalent(this.trueCase, stmt.trueCase) &&
            areAllEquivalent(this.falseCase, stmt.falseCase);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    IfStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitIfStmt(this, context);
    };
    return IfStmt;
}(Statement));
export { IfStmt };
function IfStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    IfStmt.prototype.condition;
    /** @type {?} */
    IfStmt.prototype.trueCase;
    /** @type {?} */
    IfStmt.prototype.falseCase;
}
var CommentStmt = /** @class */ (function (_super) {
    tslib_1.__extends(CommentStmt, _super);
    function CommentStmt(comment, multiline, sourceSpan) {
        if (multiline === void 0) { multiline = false; }
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.comment = comment;
        _this.multiline = multiline;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    CommentStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) { return stmt instanceof CommentStmt; };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    CommentStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitCommentStmt(this, context);
    };
    return CommentStmt;
}(Statement));
export { CommentStmt };
function CommentStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    CommentStmt.prototype.comment;
    /** @type {?} */
    CommentStmt.prototype.multiline;
}
var JSDocCommentStmt = /** @class */ (function (_super) {
    tslib_1.__extends(JSDocCommentStmt, _super);
    function JSDocCommentStmt(tags, sourceSpan) {
        if (tags === void 0) { tags = []; }
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.tags = tags;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    JSDocCommentStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof JSDocCommentStmt && this.toString() === stmt.toString();
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    JSDocCommentStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitJSDocCommentStmt(this, context);
    };
    /**
     * @return {?}
     */
    JSDocCommentStmt.prototype.toString = /**
     * @return {?}
     */
    function () { return serializeTags(this.tags); };
    return JSDocCommentStmt;
}(Statement));
export { JSDocCommentStmt };
function JSDocCommentStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    JSDocCommentStmt.prototype.tags;
}
var TryCatchStmt = /** @class */ (function (_super) {
    tslib_1.__extends(TryCatchStmt, _super);
    function TryCatchStmt(bodyStmts, catchStmts, sourceSpan) {
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.bodyStmts = bodyStmts;
        _this.catchStmts = catchStmts;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    TryCatchStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof TryCatchStmt && areAllEquivalent(this.bodyStmts, stmt.bodyStmts) &&
            areAllEquivalent(this.catchStmts, stmt.catchStmts);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    TryCatchStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitTryCatchStmt(this, context);
    };
    return TryCatchStmt;
}(Statement));
export { TryCatchStmt };
function TryCatchStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    TryCatchStmt.prototype.bodyStmts;
    /** @type {?} */
    TryCatchStmt.prototype.catchStmts;
}
var ThrowStmt = /** @class */ (function (_super) {
    tslib_1.__extends(ThrowStmt, _super);
    function ThrowStmt(error, sourceSpan) {
        var _this = _super.call(this, null, sourceSpan) || this;
        _this.error = error;
        return _this;
    }
    /**
     * @param {?} stmt
     * @return {?}
     */
    ThrowStmt.prototype.isEquivalent = /**
     * @param {?} stmt
     * @return {?}
     */
    function (stmt) {
        return stmt instanceof TryCatchStmt && this.error.isEquivalent(stmt.error);
    };
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    ThrowStmt.prototype.visitStatement = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        return visitor.visitThrowStmt(this, context);
    };
    return ThrowStmt;
}(Statement));
export { ThrowStmt };
function ThrowStmt_tsickle_Closure_declarations() {
    /** @type {?} */
    ThrowStmt.prototype.error;
}
/**
 * @record
 */
export function StatementVisitor() { }
function StatementVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    StatementVisitor.prototype.visitDeclareVarStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitDeclareFunctionStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitExpressionStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitReturnStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitDeclareClassStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitIfStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitTryCatchStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitThrowStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitCommentStmt;
    /** @type {?} */
    StatementVisitor.prototype.visitJSDocCommentStmt;
}
var AstTransformer = /** @class */ (function () {
    function AstTransformer() {
    }
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.transformExpr = /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    function (expr, context) { return expr; };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.transformStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) { return stmt; };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitReadVarExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return this.transformExpr(ast, context); };
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitWriteVarExpr = /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    function (expr, context) {
        return this.transformExpr(new WriteVarExpr(expr.name, expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    };
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitWriteKeyExpr = /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    function (expr, context) {
        return this.transformExpr(new WriteKeyExpr(expr.receiver.visitExpression(this, context), expr.index.visitExpression(this, context), expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    };
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitWritePropExpr = /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    function (expr, context) {
        return this.transformExpr(new WritePropExpr(expr.receiver.visitExpression(this, context), expr.name, expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitInvokeMethodExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ method = ast.builtin || ast.name;
        return this.transformExpr(new InvokeMethodExpr(ast.receiver.visitExpression(this, context), /** @type {?} */ ((method)), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitInvokeFunctionExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new InvokeFunctionExpr(ast.fn.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitInstantiateExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new InstantiateExpr(ast.classExpr.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitLiteralExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { return this.transformExpr(ast, context); };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitExternalExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitConditionalExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new ConditionalExpr(ast.condition.visitExpression(this, context), ast.trueCase.visitExpression(this, context), /** @type {?} */ ((ast.falseCase)).visitExpression(this, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitNotExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new NotExpr(ast.condition.visitExpression(this, context), ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitAssertNotNullExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new AssertNotNull(ast.condition.visitExpression(this, context), ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitCastExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new CastExpr(ast.value.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitFunctionExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new FunctionExpr(ast.params, this.visitAllStatements(ast.statements, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitBinaryOperatorExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new BinaryOperatorExpr(ast.operator, ast.lhs.visitExpression(this, context), ast.rhs.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitReadPropExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new ReadPropExpr(ast.receiver.visitExpression(this, context), ast.name, ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitReadKeyExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new ReadKeyExpr(ast.receiver.visitExpression(this, context), ast.index.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitLiteralArrayExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new LiteralArrayExpr(this.visitAllExpressions(ast.entries, context), ast.type, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitLiteralMapExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        var /** @type {?} */ entries = ast.entries.map(function (entry) {
            return new LiteralMapEntry(entry.key, entry.value.visitExpression(_this, context), entry.quoted);
        });
        var /** @type {?} */ mapType = new MapType(ast.valueType, null);
        return this.transformExpr(new LiteralMapExpr(entries, mapType, ast.sourceSpan), context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitCommaExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.transformExpr(new CommaExpr(this.visitAllExpressions(ast.parts, context), ast.sourceSpan), context);
    };
    /**
     * @param {?} exprs
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitAllExpressions = /**
     * @param {?} exprs
     * @param {?} context
     * @return {?}
     */
    function (exprs, context) {
        var _this = this;
        return exprs.map(function (expr) { return expr.visitExpression(_this, context); });
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitDeclareVarStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        var /** @type {?} */ value = stmt.value && stmt.value.visitExpression(this, context);
        return this.transformStmt(new DeclareVarStmt(stmt.name, value, stmt.type, stmt.modifiers, stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitDeclareFunctionStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(new DeclareFunctionStmt(stmt.name, stmt.params, this.visitAllStatements(stmt.statements, context), stmt.type, stmt.modifiers, stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitExpressionStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(new ExpressionStatement(stmt.expr.visitExpression(this, context), stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitReturnStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(new ReturnStatement(stmt.value.visitExpression(this, context), stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitDeclareClassStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        var _this = this;
        var /** @type {?} */ parent = /** @type {?} */ ((stmt.parent)).visitExpression(this, context);
        var /** @type {?} */ getters = stmt.getters.map(function (getter) {
            return new ClassGetter(getter.name, _this.visitAllStatements(getter.body, context), getter.type, getter.modifiers);
        });
        var /** @type {?} */ ctorMethod = stmt.constructorMethod &&
            new ClassMethod(stmt.constructorMethod.name, stmt.constructorMethod.params, this.visitAllStatements(stmt.constructorMethod.body, context), stmt.constructorMethod.type, stmt.constructorMethod.modifiers);
        var /** @type {?} */ methods = stmt.methods.map(function (method) {
            return new ClassMethod(method.name, method.params, _this.visitAllStatements(method.body, context), method.type, method.modifiers);
        });
        return this.transformStmt(new ClassStmt(stmt.name, parent, stmt.fields, getters, ctorMethod, methods, stmt.modifiers, stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitIfStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(new IfStmt(stmt.condition.visitExpression(this, context), this.visitAllStatements(stmt.trueCase, context), this.visitAllStatements(stmt.falseCase, context), stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitTryCatchStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(new TryCatchStmt(this.visitAllStatements(stmt.bodyStmts, context), this.visitAllStatements(stmt.catchStmts, context), stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitThrowStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(new ThrowStmt(stmt.error.visitExpression(this, context), stmt.sourceSpan), context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitCommentStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(stmt, context);
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitJSDocCommentStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        return this.transformStmt(stmt, context);
    };
    /**
     * @param {?} stmts
     * @param {?} context
     * @return {?}
     */
    AstTransformer.prototype.visitAllStatements = /**
     * @param {?} stmts
     * @param {?} context
     * @return {?}
     */
    function (stmts, context) {
        var _this = this;
        return stmts.map(function (stmt) { return stmt.visitStatement(_this, context); });
    };
    return AstTransformer;
}());
export { AstTransformer };
var RecursiveAstVisitor = /** @class */ (function () {
    function RecursiveAstVisitor() {
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitType = /**
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
    RecursiveAstVisitor.prototype.visitExpression = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        if (ast.type) {
            ast.type.visitType(this, context);
        }
        return ast;
    };
    /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitBuiltinType = /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    function (type, context) { return this.visitType(type, context); };
    /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitExpressionType = /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    function (type, context) {
        type.value.visitExpression(this, context);
        return this.visitType(type, context);
    };
    /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitArrayType = /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    function (type, context) { return this.visitType(type, context); };
    /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitMapType = /**
     * @param {?} type
     * @param {?} context
     * @return {?}
     */
    function (type, context) { return this.visitType(type, context); };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitReadVarExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitWriteVarExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitWriteKeyExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.index.visitExpression(this, context);
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitWritePropExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitInvokeMethodExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitInvokeFunctionExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.fn.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitInstantiateExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.classExpr.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitLiteralExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitExternalExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        if (ast.typeParams) {
            ast.typeParams.forEach(function (type) { return type.visitType(_this, context); });
        }
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitConditionalExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.condition.visitExpression(this, context);
        ast.trueCase.visitExpression(this, context); /** @type {?} */
        ((ast.falseCase)).visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitNotExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.condition.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitAssertNotNullExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.condition.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitCastExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitFunctionExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        this.visitAllStatements(ast.statements, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitBinaryOperatorExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.lhs.visitExpression(this, context);
        ast.rhs.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitReadPropExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitReadKeyExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.index.visitExpression(this, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitLiteralArrayExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        this.visitAllExpressions(ast.entries, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitLiteralMapExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        ast.entries.forEach(function (entry) { return entry.value.visitExpression(_this, context); });
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitCommaExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        this.visitAllExpressions(ast.parts, context);
        return this.visitExpression(ast, context);
    };
    /**
     * @param {?} exprs
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitAllExpressions = /**
     * @param {?} exprs
     * @param {?} context
     * @return {?}
     */
    function (exprs, context) {
        var _this = this;
        exprs.forEach(function (expr) { return expr.visitExpression(_this, context); });
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitDeclareVarStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        if (stmt.value) {
            stmt.value.visitExpression(this, context);
        }
        if (stmt.type) {
            stmt.type.visitType(this, context);
        }
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitDeclareFunctionStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        this.visitAllStatements(stmt.statements, context);
        if (stmt.type) {
            stmt.type.visitType(this, context);
        }
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitExpressionStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        stmt.expr.visitExpression(this, context);
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitReturnStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        stmt.value.visitExpression(this, context);
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitDeclareClassStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        var _this = this;
        /** @type {?} */ ((stmt.parent)).visitExpression(this, context);
        stmt.getters.forEach(function (getter) { return _this.visitAllStatements(getter.body, context); });
        if (stmt.constructorMethod) {
            this.visitAllStatements(stmt.constructorMethod.body, context);
        }
        stmt.methods.forEach(function (method) { return _this.visitAllStatements(method.body, context); });
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitIfStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        stmt.condition.visitExpression(this, context);
        this.visitAllStatements(stmt.trueCase, context);
        this.visitAllStatements(stmt.falseCase, context);
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitTryCatchStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        this.visitAllStatements(stmt.bodyStmts, context);
        this.visitAllStatements(stmt.catchStmts, context);
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitThrowStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        stmt.error.visitExpression(this, context);
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitCommentStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) { return stmt; };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitJSDocCommentStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) { return stmt; };
    /**
     * @param {?} stmts
     * @param {?} context
     * @return {?}
     */
    RecursiveAstVisitor.prototype.visitAllStatements = /**
     * @param {?} stmts
     * @param {?} context
     * @return {?}
     */
    function (stmts, context) {
        var _this = this;
        stmts.forEach(function (stmt) { return stmt.visitStatement(_this, context); });
    };
    return RecursiveAstVisitor;
}());
export { RecursiveAstVisitor };
/**
 * @param {?} stmts
 * @return {?}
 */
export function findReadVarNames(stmts) {
    var /** @type {?} */ visitor = new _ReadVarVisitor();
    visitor.visitAllStatements(stmts, null);
    return visitor.varNames;
}
var _ReadVarVisitor = /** @class */ (function (_super) {
    tslib_1.__extends(_ReadVarVisitor, _super);
    function _ReadVarVisitor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.varNames = new Set();
        return _this;
    }
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    _ReadVarVisitor.prototype.visitDeclareFunctionStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        // Don't descend into nested functions
        return stmt;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    _ReadVarVisitor.prototype.visitDeclareClassStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        // Don't descend into nested classes
        return stmt;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    _ReadVarVisitor.prototype.visitReadVarExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        if (ast.name) {
            this.varNames.add(ast.name);
        }
        return null;
    };
    return _ReadVarVisitor;
}(RecursiveAstVisitor));
function _ReadVarVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _ReadVarVisitor.prototype.varNames;
}
/**
 * @param {?} stmts
 * @return {?}
 */
export function collectExternalReferences(stmts) {
    var /** @type {?} */ visitor = new _FindExternalReferencesVisitor();
    visitor.visitAllStatements(stmts, null);
    return visitor.externalReferences;
}
var _FindExternalReferencesVisitor = /** @class */ (function (_super) {
    tslib_1.__extends(_FindExternalReferencesVisitor, _super);
    function _FindExternalReferencesVisitor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.externalReferences = [];
        return _this;
    }
    /**
     * @param {?} e
     * @param {?} context
     * @return {?}
     */
    _FindExternalReferencesVisitor.prototype.visitExternalExpr = /**
     * @param {?} e
     * @param {?} context
     * @return {?}
     */
    function (e, context) {
        this.externalReferences.push(e.value);
        return _super.prototype.visitExternalExpr.call(this, e, context);
    };
    return _FindExternalReferencesVisitor;
}(RecursiveAstVisitor));
function _FindExternalReferencesVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _FindExternalReferencesVisitor.prototype.externalReferences;
}
/**
 * @param {?} stmt
 * @param {?} sourceSpan
 * @return {?}
 */
export function applySourceSpanToStatementIfNeeded(stmt, sourceSpan) {
    if (!sourceSpan) {
        return stmt;
    }
    var /** @type {?} */ transformer = new _ApplySourceSpanTransformer(sourceSpan);
    return stmt.visitStatement(transformer, null);
}
/**
 * @param {?} expr
 * @param {?} sourceSpan
 * @return {?}
 */
export function applySourceSpanToExpressionIfNeeded(expr, sourceSpan) {
    if (!sourceSpan) {
        return expr;
    }
    var /** @type {?} */ transformer = new _ApplySourceSpanTransformer(sourceSpan);
    return expr.visitExpression(transformer, null);
}
var _ApplySourceSpanTransformer = /** @class */ (function (_super) {
    tslib_1.__extends(_ApplySourceSpanTransformer, _super);
    function _ApplySourceSpanTransformer(sourceSpan) {
        var _this = _super.call(this) || this;
        _this.sourceSpan = sourceSpan;
        return _this;
    }
    /**
     * @param {?} obj
     * @return {?}
     */
    _ApplySourceSpanTransformer.prototype._clone = /**
     * @param {?} obj
     * @return {?}
     */
    function (obj) {
        var /** @type {?} */ clone = Object.create(obj.constructor.prototype);
        for (var /** @type {?} */ prop in obj) {
            clone[prop] = obj[prop];
        }
        return clone;
    };
    /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    _ApplySourceSpanTransformer.prototype.transformExpr = /**
     * @param {?} expr
     * @param {?} context
     * @return {?}
     */
    function (expr, context) {
        if (!expr.sourceSpan) {
            expr = this._clone(expr);
            expr.sourceSpan = this.sourceSpan;
        }
        return expr;
    };
    /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    _ApplySourceSpanTransformer.prototype.transformStmt = /**
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    function (stmt, context) {
        if (!stmt.sourceSpan) {
            stmt = this._clone(stmt);
            stmt.sourceSpan = this.sourceSpan;
        }
        return stmt;
    };
    return _ApplySourceSpanTransformer;
}(AstTransformer));
function _ApplySourceSpanTransformer_tsickle_Closure_declarations() {
    /** @type {?} */
    _ApplySourceSpanTransformer.prototype.sourceSpan;
}
/**
 * @param {?} name
 * @param {?=} type
 * @param {?=} sourceSpan
 * @return {?}
 */
export function variable(name, type, sourceSpan) {
    return new ReadVarExpr(name, type, sourceSpan);
}
/**
 * @param {?} id
 * @param {?=} typeParams
 * @param {?=} sourceSpan
 * @return {?}
 */
export function importExpr(id, typeParams, sourceSpan) {
    if (typeParams === void 0) { typeParams = null; }
    return new ExternalExpr(id, null, typeParams, sourceSpan);
}
/**
 * @param {?} id
 * @param {?=} typeParams
 * @param {?=} typeModifiers
 * @return {?}
 */
export function importType(id, typeParams, typeModifiers) {
    if (typeParams === void 0) { typeParams = null; }
    if (typeModifiers === void 0) { typeModifiers = null; }
    return id != null ? expressionType(importExpr(id, typeParams, null), typeModifiers) : null;
}
/**
 * @param {?} expr
 * @param {?=} typeModifiers
 * @return {?}
 */
export function expressionType(expr, typeModifiers) {
    if (typeModifiers === void 0) { typeModifiers = null; }
    return new ExpressionType(expr, typeModifiers);
}
/**
 * @param {?} values
 * @param {?=} type
 * @param {?=} sourceSpan
 * @return {?}
 */
export function literalArr(values, type, sourceSpan) {
    return new LiteralArrayExpr(values, type, sourceSpan);
}
/**
 * @param {?} values
 * @param {?=} type
 * @return {?}
 */
export function literalMap(values, type) {
    if (type === void 0) { type = null; }
    return new LiteralMapExpr(values.map(function (e) { return new LiteralMapEntry(e.key, e.value, e.quoted); }), type, null);
}
/**
 * @param {?} expr
 * @param {?=} sourceSpan
 * @return {?}
 */
export function not(expr, sourceSpan) {
    return new NotExpr(expr, sourceSpan);
}
/**
 * @param {?} expr
 * @param {?=} sourceSpan
 * @return {?}
 */
export function assertNotNull(expr, sourceSpan) {
    return new AssertNotNull(expr, sourceSpan);
}
/**
 * @param {?} params
 * @param {?} body
 * @param {?=} type
 * @param {?=} sourceSpan
 * @param {?=} name
 * @return {?}
 */
export function fn(params, body, type, sourceSpan, name) {
    return new FunctionExpr(params, body, type, sourceSpan, name);
}
/**
 * @param {?} condition
 * @param {?} thenClause
 * @param {?=} elseClause
 * @return {?}
 */
export function ifStmt(condition, thenClause, elseClause) {
    return new IfStmt(condition, thenClause, elseClause);
}
/**
 * @param {?} value
 * @param {?=} type
 * @param {?=} sourceSpan
 * @return {?}
 */
export function literal(value, type, sourceSpan) {
    return new LiteralExpr(value, type, sourceSpan);
}
/**
 * @param {?} exp
 * @return {?}
 */
export function isNull(exp) {
    return exp instanceof LiteralExpr && exp.value === null;
}
/** @enum {string} */
var JSDocTagName = {
    Desc: 'desc',
    Id: 'id',
    Meaning: 'meaning',
};
export { JSDocTagName };
/**
 * @param {?} tag
 * @return {?}
 */
function tagToString(tag) {
    var /** @type {?} */ out = '';
    if (tag.tagName) {
        out += " @" + tag.tagName;
    }
    if (tag.text) {
        if (tag.text.match(/\/\*|\*\//)) {
            throw new Error('JSDoc text cannot contain "/*" and "*/"');
        }
        out += ' ' + tag.text.replace(/@/g, '\\@');
    }
    return out;
}
/**
 * @param {?} tags
 * @return {?}
 */
function serializeTags(tags) {
    if (tags.length === 0)
        return '';
    var /** @type {?} */ out = '*\n';
    for (var _i = 0, tags_1 = tags; _i < tags_1.length; _i++) {
        var tag = tags_1[_i];
        out += ' *';
        // If the tagToString is multi-line, insert " * " prefixes on subsequent lines.
        out += tagToString(tag).replace(/\n/g, '\n * ');
        out += '\n';
    }
    out += ' ';
    return out;
}
//# sourceMappingURL=output_ast.js.map