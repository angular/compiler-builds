/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
//// Types
export var TypeModifier;
(function (TypeModifier) {
    TypeModifier[TypeModifier["Const"] = 0] = "Const";
})(TypeModifier || (TypeModifier = {}));
export class Type {
    constructor(modifiers = null) {
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
    }
    hasModifier(modifier) { return this.modifiers.indexOf(modifier) !== -1; }
}
export var BuiltinTypeName;
(function (BuiltinTypeName) {
    BuiltinTypeName[BuiltinTypeName["Dynamic"] = 0] = "Dynamic";
    BuiltinTypeName[BuiltinTypeName["Bool"] = 1] = "Bool";
    BuiltinTypeName[BuiltinTypeName["String"] = 2] = "String";
    BuiltinTypeName[BuiltinTypeName["Int"] = 3] = "Int";
    BuiltinTypeName[BuiltinTypeName["Number"] = 4] = "Number";
    BuiltinTypeName[BuiltinTypeName["Function"] = 5] = "Function";
    BuiltinTypeName[BuiltinTypeName["Inferred"] = 6] = "Inferred";
    BuiltinTypeName[BuiltinTypeName["None"] = 7] = "None";
})(BuiltinTypeName || (BuiltinTypeName = {}));
export class BuiltinType extends Type {
    constructor(name, modifiers = null) {
        super(modifiers);
        this.name = name;
    }
    visitType(visitor, context) {
        return visitor.visitBuiltinType(this, context);
    }
}
export class ExpressionType extends Type {
    constructor(value, modifiers = null, typeParams = null) {
        super(modifiers);
        this.value = value;
        this.typeParams = typeParams;
    }
    visitType(visitor, context) {
        return visitor.visitExpressionType(this, context);
    }
}
export class ArrayType extends Type {
    constructor(of, modifiers = null) {
        super(modifiers);
        this.of = of;
    }
    visitType(visitor, context) {
        return visitor.visitArrayType(this, context);
    }
}
export class MapType extends Type {
    constructor(valueType, modifiers = null) {
        super(modifiers);
        this.valueType = valueType || null;
    }
    visitType(visitor, context) { return visitor.visitMapType(this, context); }
}
export const DYNAMIC_TYPE = new BuiltinType(BuiltinTypeName.Dynamic);
export const INFERRED_TYPE = new BuiltinType(BuiltinTypeName.Inferred);
export const BOOL_TYPE = new BuiltinType(BuiltinTypeName.Bool);
export const INT_TYPE = new BuiltinType(BuiltinTypeName.Int);
export const NUMBER_TYPE = new BuiltinType(BuiltinTypeName.Number);
export const STRING_TYPE = new BuiltinType(BuiltinTypeName.String);
export const FUNCTION_TYPE = new BuiltinType(BuiltinTypeName.Function);
export const NONE_TYPE = new BuiltinType(BuiltinTypeName.None);
///// Expressions
export var BinaryOperator;
(function (BinaryOperator) {
    BinaryOperator[BinaryOperator["Equals"] = 0] = "Equals";
    BinaryOperator[BinaryOperator["NotEquals"] = 1] = "NotEquals";
    BinaryOperator[BinaryOperator["Identical"] = 2] = "Identical";
    BinaryOperator[BinaryOperator["NotIdentical"] = 3] = "NotIdentical";
    BinaryOperator[BinaryOperator["Minus"] = 4] = "Minus";
    BinaryOperator[BinaryOperator["Plus"] = 5] = "Plus";
    BinaryOperator[BinaryOperator["Divide"] = 6] = "Divide";
    BinaryOperator[BinaryOperator["Multiply"] = 7] = "Multiply";
    BinaryOperator[BinaryOperator["Modulo"] = 8] = "Modulo";
    BinaryOperator[BinaryOperator["And"] = 9] = "And";
    BinaryOperator[BinaryOperator["Or"] = 10] = "Or";
    BinaryOperator[BinaryOperator["BitwiseAnd"] = 11] = "BitwiseAnd";
    BinaryOperator[BinaryOperator["Lower"] = 12] = "Lower";
    BinaryOperator[BinaryOperator["LowerEquals"] = 13] = "LowerEquals";
    BinaryOperator[BinaryOperator["Bigger"] = 14] = "Bigger";
    BinaryOperator[BinaryOperator["BiggerEquals"] = 15] = "BiggerEquals";
})(BinaryOperator || (BinaryOperator = {}));
export function nullSafeIsEquivalent(base, other) {
    if (base == null || other == null) {
        return base == other;
    }
    return base.isEquivalent(other);
}
export function areAllEquivalent(base, other) {
    const len = base.length;
    if (len !== other.length) {
        return false;
    }
    for (let i = 0; i < len; i++) {
        if (!base[i].isEquivalent(other[i])) {
            return false;
        }
    }
    return true;
}
export class Expression {
    constructor(type, sourceSpan) {
        this.type = type || null;
        this.sourceSpan = sourceSpan || null;
    }
    prop(name, sourceSpan) {
        return new ReadPropExpr(this, name, null, sourceSpan);
    }
    key(index, type, sourceSpan) {
        return new ReadKeyExpr(this, index, type, sourceSpan);
    }
    callMethod(name, params, sourceSpan) {
        return new InvokeMethodExpr(this, name, params, null, sourceSpan);
    }
    callFn(params, sourceSpan) {
        return new InvokeFunctionExpr(this, params, null, sourceSpan);
    }
    instantiate(params, type, sourceSpan) {
        return new InstantiateExpr(this, params, type, sourceSpan);
    }
    conditional(trueCase, falseCase = null, sourceSpan) {
        return new ConditionalExpr(this, trueCase, falseCase, null, sourceSpan);
    }
    equals(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Equals, this, rhs, null, sourceSpan);
    }
    notEquals(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.NotEquals, this, rhs, null, sourceSpan);
    }
    identical(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Identical, this, rhs, null, sourceSpan);
    }
    notIdentical(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.NotIdentical, this, rhs, null, sourceSpan);
    }
    minus(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Minus, this, rhs, null, sourceSpan);
    }
    plus(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Plus, this, rhs, null, sourceSpan);
    }
    divide(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Divide, this, rhs, null, sourceSpan);
    }
    multiply(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Multiply, this, rhs, null, sourceSpan);
    }
    modulo(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Modulo, this, rhs, null, sourceSpan);
    }
    and(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.And, this, rhs, null, sourceSpan);
    }
    bitwiseAnd(rhs, sourceSpan, parens = true) {
        return new BinaryOperatorExpr(BinaryOperator.BitwiseAnd, this, rhs, null, sourceSpan, parens);
    }
    or(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Or, this, rhs, null, sourceSpan);
    }
    lower(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Lower, this, rhs, null, sourceSpan);
    }
    lowerEquals(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.LowerEquals, this, rhs, null, sourceSpan);
    }
    bigger(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.Bigger, this, rhs, null, sourceSpan);
    }
    biggerEquals(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.BiggerEquals, this, rhs, null, sourceSpan);
    }
    isBlank(sourceSpan) {
        // Note: We use equals by purpose here to compare to null and undefined in JS.
        // We use the typed null to allow strictNullChecks to narrow types.
        return this.equals(TYPED_NULL_EXPR, sourceSpan);
    }
    cast(type, sourceSpan) {
        return new CastExpr(this, type, sourceSpan);
    }
    toStmt() { return new ExpressionStatement(this, null); }
}
export var BuiltinVar;
(function (BuiltinVar) {
    BuiltinVar[BuiltinVar["This"] = 0] = "This";
    BuiltinVar[BuiltinVar["Super"] = 1] = "Super";
    BuiltinVar[BuiltinVar["CatchError"] = 2] = "CatchError";
    BuiltinVar[BuiltinVar["CatchStack"] = 3] = "CatchStack";
})(BuiltinVar || (BuiltinVar = {}));
export class ReadVarExpr extends Expression {
    constructor(name, type, sourceSpan) {
        super(type, sourceSpan);
        if (typeof name === 'string') {
            this.name = name;
            this.builtin = null;
        }
        else {
            this.name = null;
            this.builtin = name;
        }
    }
    isEquivalent(e) {
        return e instanceof ReadVarExpr && this.name === e.name && this.builtin === e.builtin;
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitReadVarExpr(this, context);
    }
    set(value) {
        if (!this.name) {
            throw new Error(`Built in variable ${this.builtin} can not be assigned to.`);
        }
        return new WriteVarExpr(this.name, value, null, this.sourceSpan);
    }
}
export class TypeofExpr extends Expression {
    constructor(expr, type, sourceSpan) {
        super(type, sourceSpan);
        this.expr = expr;
    }
    visitExpression(visitor, context) {
        return visitor.visitTypeofExpr(this, context);
    }
    isEquivalent(e) {
        return e instanceof TypeofExpr && e.expr.isEquivalent(this.expr);
    }
    isConstant() { return this.expr.isConstant(); }
}
export class WrappedNodeExpr extends Expression {
    constructor(node, type, sourceSpan) {
        super(type, sourceSpan);
        this.node = node;
    }
    isEquivalent(e) {
        return e instanceof WrappedNodeExpr && this.node === e.node;
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitWrappedNodeExpr(this, context);
    }
}
export class WriteVarExpr extends Expression {
    constructor(name, value, type, sourceSpan) {
        super(type || value.type, sourceSpan);
        this.name = name;
        this.value = value;
    }
    isEquivalent(e) {
        return e instanceof WriteVarExpr && this.name === e.name && this.value.isEquivalent(e.value);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitWriteVarExpr(this, context);
    }
    toDeclStmt(type, modifiers) {
        return new DeclareVarStmt(this.name, this.value, type, modifiers, this.sourceSpan);
    }
    toConstDecl() { return this.toDeclStmt(INFERRED_TYPE, [StmtModifier.Final]); }
}
export class WriteKeyExpr extends Expression {
    constructor(receiver, index, value, type, sourceSpan) {
        super(type || value.type, sourceSpan);
        this.receiver = receiver;
        this.index = index;
        this.value = value;
    }
    isEquivalent(e) {
        return e instanceof WriteKeyExpr && this.receiver.isEquivalent(e.receiver) &&
            this.index.isEquivalent(e.index) && this.value.isEquivalent(e.value);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitWriteKeyExpr(this, context);
    }
}
export class WritePropExpr extends Expression {
    constructor(receiver, name, value, type, sourceSpan) {
        super(type || value.type, sourceSpan);
        this.receiver = receiver;
        this.name = name;
        this.value = value;
    }
    isEquivalent(e) {
        return e instanceof WritePropExpr && this.receiver.isEquivalent(e.receiver) &&
            this.name === e.name && this.value.isEquivalent(e.value);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitWritePropExpr(this, context);
    }
}
export var BuiltinMethod;
(function (BuiltinMethod) {
    BuiltinMethod[BuiltinMethod["ConcatArray"] = 0] = "ConcatArray";
    BuiltinMethod[BuiltinMethod["SubscribeObservable"] = 1] = "SubscribeObservable";
    BuiltinMethod[BuiltinMethod["Bind"] = 2] = "Bind";
})(BuiltinMethod || (BuiltinMethod = {}));
export class InvokeMethodExpr extends Expression {
    constructor(receiver, method, args, type, sourceSpan) {
        super(type, sourceSpan);
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
    isEquivalent(e) {
        return e instanceof InvokeMethodExpr && this.receiver.isEquivalent(e.receiver) &&
            this.name === e.name && this.builtin === e.builtin && areAllEquivalent(this.args, e.args);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitInvokeMethodExpr(this, context);
    }
}
export class InvokeFunctionExpr extends Expression {
    constructor(fn, args, type, sourceSpan) {
        super(type, sourceSpan);
        this.fn = fn;
        this.args = args;
    }
    isEquivalent(e) {
        return e instanceof InvokeFunctionExpr && this.fn.isEquivalent(e.fn) &&
            areAllEquivalent(this.args, e.args);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitInvokeFunctionExpr(this, context);
    }
}
export class InstantiateExpr extends Expression {
    constructor(classExpr, args, type, sourceSpan) {
        super(type, sourceSpan);
        this.classExpr = classExpr;
        this.args = args;
    }
    isEquivalent(e) {
        return e instanceof InstantiateExpr && this.classExpr.isEquivalent(e.classExpr) &&
            areAllEquivalent(this.args, e.args);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitInstantiateExpr(this, context);
    }
}
export class LiteralExpr extends Expression {
    constructor(value, type, sourceSpan) {
        super(type, sourceSpan);
        this.value = value;
    }
    isEquivalent(e) {
        return e instanceof LiteralExpr && this.value === e.value;
    }
    isConstant() { return true; }
    visitExpression(visitor, context) {
        return visitor.visitLiteralExpr(this, context);
    }
}
export class ExternalExpr extends Expression {
    constructor(value, type, typeParams = null, sourceSpan) {
        super(type, sourceSpan);
        this.value = value;
        this.typeParams = typeParams;
    }
    isEquivalent(e) {
        return e instanceof ExternalExpr && this.value.name === e.value.name &&
            this.value.moduleName === e.value.moduleName && this.value.runtime === e.value.runtime;
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitExternalExpr(this, context);
    }
}
export class ExternalReference {
    constructor(moduleName, name, runtime) {
        this.moduleName = moduleName;
        this.name = name;
        this.runtime = runtime;
    }
}
export class ConditionalExpr extends Expression {
    constructor(condition, trueCase, falseCase = null, type, sourceSpan) {
        super(type || trueCase.type, sourceSpan);
        this.condition = condition;
        this.falseCase = falseCase;
        this.trueCase = trueCase;
    }
    isEquivalent(e) {
        return e instanceof ConditionalExpr && this.condition.isEquivalent(e.condition) &&
            this.trueCase.isEquivalent(e.trueCase) && nullSafeIsEquivalent(this.falseCase, e.falseCase);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitConditionalExpr(this, context);
    }
}
export class NotExpr extends Expression {
    constructor(condition, sourceSpan) {
        super(BOOL_TYPE, sourceSpan);
        this.condition = condition;
    }
    isEquivalent(e) {
        return e instanceof NotExpr && this.condition.isEquivalent(e.condition);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitNotExpr(this, context);
    }
}
export class AssertNotNull extends Expression {
    constructor(condition, sourceSpan) {
        super(condition.type, sourceSpan);
        this.condition = condition;
    }
    isEquivalent(e) {
        return e instanceof AssertNotNull && this.condition.isEquivalent(e.condition);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitAssertNotNullExpr(this, context);
    }
}
export class CastExpr extends Expression {
    constructor(value, type, sourceSpan) {
        super(type, sourceSpan);
        this.value = value;
    }
    isEquivalent(e) {
        return e instanceof CastExpr && this.value.isEquivalent(e.value);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitCastExpr(this, context);
    }
}
export class FnParam {
    constructor(name, type = null) {
        this.name = name;
        this.type = type;
    }
    isEquivalent(param) { return this.name === param.name; }
}
export class FunctionExpr extends Expression {
    constructor(params, statements, type, sourceSpan, name) {
        super(type, sourceSpan);
        this.params = params;
        this.statements = statements;
        this.name = name;
    }
    isEquivalent(e) {
        return e instanceof FunctionExpr && areAllEquivalent(this.params, e.params) &&
            areAllEquivalent(this.statements, e.statements);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitFunctionExpr(this, context);
    }
    toDeclStmt(name, modifiers = null) {
        return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers, this.sourceSpan);
    }
}
export class BinaryOperatorExpr extends Expression {
    constructor(operator, lhs, rhs, type, sourceSpan, parens = true) {
        super(type || lhs.type, sourceSpan);
        this.operator = operator;
        this.rhs = rhs;
        this.parens = parens;
        this.lhs = lhs;
    }
    isEquivalent(e) {
        return e instanceof BinaryOperatorExpr && this.operator === e.operator &&
            this.lhs.isEquivalent(e.lhs) && this.rhs.isEquivalent(e.rhs);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitBinaryOperatorExpr(this, context);
    }
}
export class ReadPropExpr extends Expression {
    constructor(receiver, name, type, sourceSpan) {
        super(type, sourceSpan);
        this.receiver = receiver;
        this.name = name;
    }
    isEquivalent(e) {
        return e instanceof ReadPropExpr && this.receiver.isEquivalent(e.receiver) &&
            this.name === e.name;
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitReadPropExpr(this, context);
    }
    set(value) {
        return new WritePropExpr(this.receiver, this.name, value, null, this.sourceSpan);
    }
}
export class ReadKeyExpr extends Expression {
    constructor(receiver, index, type, sourceSpan) {
        super(type, sourceSpan);
        this.receiver = receiver;
        this.index = index;
    }
    isEquivalent(e) {
        return e instanceof ReadKeyExpr && this.receiver.isEquivalent(e.receiver) &&
            this.index.isEquivalent(e.index);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitReadKeyExpr(this, context);
    }
    set(value) {
        return new WriteKeyExpr(this.receiver, this.index, value, null, this.sourceSpan);
    }
}
export class LiteralArrayExpr extends Expression {
    constructor(entries, type, sourceSpan) {
        super(type, sourceSpan);
        this.entries = entries;
    }
    isConstant() { return this.entries.every(e => e.isConstant()); }
    isEquivalent(e) {
        return e instanceof LiteralArrayExpr && areAllEquivalent(this.entries, e.entries);
    }
    visitExpression(visitor, context) {
        return visitor.visitLiteralArrayExpr(this, context);
    }
}
export class LiteralMapEntry {
    constructor(key, value, quoted) {
        this.key = key;
        this.value = value;
        this.quoted = quoted;
    }
    isEquivalent(e) {
        return this.key === e.key && this.value.isEquivalent(e.value);
    }
}
export class LiteralMapExpr extends Expression {
    constructor(entries, type, sourceSpan) {
        super(type, sourceSpan);
        this.entries = entries;
        this.valueType = null;
        if (type) {
            this.valueType = type.valueType;
        }
    }
    isEquivalent(e) {
        return e instanceof LiteralMapExpr && areAllEquivalent(this.entries, e.entries);
    }
    isConstant() { return this.entries.every(e => e.value.isConstant()); }
    visitExpression(visitor, context) {
        return visitor.visitLiteralMapExpr(this, context);
    }
}
export class CommaExpr extends Expression {
    constructor(parts, sourceSpan) {
        super(parts[parts.length - 1].type, sourceSpan);
        this.parts = parts;
    }
    isEquivalent(e) {
        return e instanceof CommaExpr && areAllEquivalent(this.parts, e.parts);
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitCommaExpr(this, context);
    }
}
export const THIS_EXPR = new ReadVarExpr(BuiltinVar.This, null, null);
export const SUPER_EXPR = new ReadVarExpr(BuiltinVar.Super, null, null);
export const CATCH_ERROR_VAR = new ReadVarExpr(BuiltinVar.CatchError, null, null);
export const CATCH_STACK_VAR = new ReadVarExpr(BuiltinVar.CatchStack, null, null);
export const NULL_EXPR = new LiteralExpr(null, null, null);
export const TYPED_NULL_EXPR = new LiteralExpr(null, INFERRED_TYPE, null);
//// Statements
export var StmtModifier;
(function (StmtModifier) {
    StmtModifier[StmtModifier["Final"] = 0] = "Final";
    StmtModifier[StmtModifier["Private"] = 1] = "Private";
    StmtModifier[StmtModifier["Exported"] = 2] = "Exported";
    StmtModifier[StmtModifier["Static"] = 3] = "Static";
})(StmtModifier || (StmtModifier = {}));
export class Statement {
    constructor(modifiers, sourceSpan) {
        this.modifiers = modifiers || [];
        this.sourceSpan = sourceSpan || null;
    }
    hasModifier(modifier) { return this.modifiers.indexOf(modifier) !== -1; }
}
export class DeclareVarStmt extends Statement {
    constructor(name, value, type, modifiers = null, sourceSpan) {
        super(modifiers, sourceSpan);
        this.name = name;
        this.value = value;
        this.type = type || (value && value.type) || null;
    }
    isEquivalent(stmt) {
        return stmt instanceof DeclareVarStmt && this.name === stmt.name &&
            (this.value ? !!stmt.value && this.value.isEquivalent(stmt.value) : !stmt.value);
    }
    visitStatement(visitor, context) {
        return visitor.visitDeclareVarStmt(this, context);
    }
}
export class DeclareFunctionStmt extends Statement {
    constructor(name, params, statements, type, modifiers = null, sourceSpan) {
        super(modifiers, sourceSpan);
        this.name = name;
        this.params = params;
        this.statements = statements;
        this.type = type || null;
    }
    isEquivalent(stmt) {
        return stmt instanceof DeclareFunctionStmt && areAllEquivalent(this.params, stmt.params) &&
            areAllEquivalent(this.statements, stmt.statements);
    }
    visitStatement(visitor, context) {
        return visitor.visitDeclareFunctionStmt(this, context);
    }
}
export class ExpressionStatement extends Statement {
    constructor(expr, sourceSpan) {
        super(null, sourceSpan);
        this.expr = expr;
    }
    isEquivalent(stmt) {
        return stmt instanceof ExpressionStatement && this.expr.isEquivalent(stmt.expr);
    }
    visitStatement(visitor, context) {
        return visitor.visitExpressionStmt(this, context);
    }
}
export class ReturnStatement extends Statement {
    constructor(value, sourceSpan) {
        super(null, sourceSpan);
        this.value = value;
    }
    isEquivalent(stmt) {
        return stmt instanceof ReturnStatement && this.value.isEquivalent(stmt.value);
    }
    visitStatement(visitor, context) {
        return visitor.visitReturnStmt(this, context);
    }
}
export class AbstractClassPart {
    constructor(type, modifiers) {
        this.modifiers = modifiers;
        if (!modifiers) {
            this.modifiers = [];
        }
        this.type = type || null;
    }
    hasModifier(modifier) { return this.modifiers.indexOf(modifier) !== -1; }
}
export class ClassField extends AbstractClassPart {
    constructor(name, type, modifiers = null, initializer) {
        super(type, modifiers);
        this.name = name;
        this.initializer = initializer;
    }
    isEquivalent(f) { return this.name === f.name; }
}
export class ClassMethod extends AbstractClassPart {
    constructor(name, params, body, type, modifiers = null) {
        super(type, modifiers);
        this.name = name;
        this.params = params;
        this.body = body;
    }
    isEquivalent(m) {
        return this.name === m.name && areAllEquivalent(this.body, m.body);
    }
}
export class ClassGetter extends AbstractClassPart {
    constructor(name, body, type, modifiers = null) {
        super(type, modifiers);
        this.name = name;
        this.body = body;
    }
    isEquivalent(m) {
        return this.name === m.name && areAllEquivalent(this.body, m.body);
    }
}
export class ClassStmt extends Statement {
    constructor(name, parent, fields, getters, constructorMethod, methods, modifiers = null, sourceSpan) {
        super(modifiers, sourceSpan);
        this.name = name;
        this.parent = parent;
        this.fields = fields;
        this.getters = getters;
        this.constructorMethod = constructorMethod;
        this.methods = methods;
    }
    isEquivalent(stmt) {
        return stmt instanceof ClassStmt && this.name === stmt.name &&
            nullSafeIsEquivalent(this.parent, stmt.parent) &&
            areAllEquivalent(this.fields, stmt.fields) &&
            areAllEquivalent(this.getters, stmt.getters) &&
            this.constructorMethod.isEquivalent(stmt.constructorMethod) &&
            areAllEquivalent(this.methods, stmt.methods);
    }
    visitStatement(visitor, context) {
        return visitor.visitDeclareClassStmt(this, context);
    }
}
export class IfStmt extends Statement {
    constructor(condition, trueCase, falseCase = [], sourceSpan) {
        super(null, sourceSpan);
        this.condition = condition;
        this.trueCase = trueCase;
        this.falseCase = falseCase;
    }
    isEquivalent(stmt) {
        return stmt instanceof IfStmt && this.condition.isEquivalent(stmt.condition) &&
            areAllEquivalent(this.trueCase, stmt.trueCase) &&
            areAllEquivalent(this.falseCase, stmt.falseCase);
    }
    visitStatement(visitor, context) {
        return visitor.visitIfStmt(this, context);
    }
}
export class CommentStmt extends Statement {
    constructor(comment, multiline = false, sourceSpan) {
        super(null, sourceSpan);
        this.comment = comment;
        this.multiline = multiline;
    }
    isEquivalent(stmt) { return stmt instanceof CommentStmt; }
    visitStatement(visitor, context) {
        return visitor.visitCommentStmt(this, context);
    }
}
export class JSDocCommentStmt extends Statement {
    constructor(tags = [], sourceSpan) {
        super(null, sourceSpan);
        this.tags = tags;
    }
    isEquivalent(stmt) {
        return stmt instanceof JSDocCommentStmt && this.toString() === stmt.toString();
    }
    visitStatement(visitor, context) {
        return visitor.visitJSDocCommentStmt(this, context);
    }
    toString() { return serializeTags(this.tags); }
}
export class TryCatchStmt extends Statement {
    constructor(bodyStmts, catchStmts, sourceSpan) {
        super(null, sourceSpan);
        this.bodyStmts = bodyStmts;
        this.catchStmts = catchStmts;
    }
    isEquivalent(stmt) {
        return stmt instanceof TryCatchStmt && areAllEquivalent(this.bodyStmts, stmt.bodyStmts) &&
            areAllEquivalent(this.catchStmts, stmt.catchStmts);
    }
    visitStatement(visitor, context) {
        return visitor.visitTryCatchStmt(this, context);
    }
}
export class ThrowStmt extends Statement {
    constructor(error, sourceSpan) {
        super(null, sourceSpan);
        this.error = error;
    }
    isEquivalent(stmt) {
        return stmt instanceof TryCatchStmt && this.error.isEquivalent(stmt.error);
    }
    visitStatement(visitor, context) {
        return visitor.visitThrowStmt(this, context);
    }
}
export class AstTransformer {
    transformExpr(expr, context) { return expr; }
    transformStmt(stmt, context) { return stmt; }
    visitReadVarExpr(ast, context) { return this.transformExpr(ast, context); }
    visitWrappedNodeExpr(ast, context) {
        return this.transformExpr(ast, context);
    }
    visitTypeofExpr(expr, context) {
        return this.transformExpr(new TypeofExpr(expr.expr.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    }
    visitWriteVarExpr(expr, context) {
        return this.transformExpr(new WriteVarExpr(expr.name, expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    }
    visitWriteKeyExpr(expr, context) {
        return this.transformExpr(new WriteKeyExpr(expr.receiver.visitExpression(this, context), expr.index.visitExpression(this, context), expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    }
    visitWritePropExpr(expr, context) {
        return this.transformExpr(new WritePropExpr(expr.receiver.visitExpression(this, context), expr.name, expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
    }
    visitInvokeMethodExpr(ast, context) {
        const method = ast.builtin || ast.name;
        return this.transformExpr(new InvokeMethodExpr(ast.receiver.visitExpression(this, context), method, this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
    }
    visitInvokeFunctionExpr(ast, context) {
        return this.transformExpr(new InvokeFunctionExpr(ast.fn.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
    }
    visitInstantiateExpr(ast, context) {
        return this.transformExpr(new InstantiateExpr(ast.classExpr.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
    }
    visitLiteralExpr(ast, context) { return this.transformExpr(ast, context); }
    visitExternalExpr(ast, context) {
        return this.transformExpr(ast, context);
    }
    visitConditionalExpr(ast, context) {
        return this.transformExpr(new ConditionalExpr(ast.condition.visitExpression(this, context), ast.trueCase.visitExpression(this, context), ast.falseCase.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    }
    visitNotExpr(ast, context) {
        return this.transformExpr(new NotExpr(ast.condition.visitExpression(this, context), ast.sourceSpan), context);
    }
    visitAssertNotNullExpr(ast, context) {
        return this.transformExpr(new AssertNotNull(ast.condition.visitExpression(this, context), ast.sourceSpan), context);
    }
    visitCastExpr(ast, context) {
        return this.transformExpr(new CastExpr(ast.value.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    }
    visitFunctionExpr(ast, context) {
        return this.transformExpr(new FunctionExpr(ast.params, this.visitAllStatements(ast.statements, context), ast.type, ast.sourceSpan), context);
    }
    visitBinaryOperatorExpr(ast, context) {
        return this.transformExpr(new BinaryOperatorExpr(ast.operator, ast.lhs.visitExpression(this, context), ast.rhs.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    }
    visitReadPropExpr(ast, context) {
        return this.transformExpr(new ReadPropExpr(ast.receiver.visitExpression(this, context), ast.name, ast.type, ast.sourceSpan), context);
    }
    visitReadKeyExpr(ast, context) {
        return this.transformExpr(new ReadKeyExpr(ast.receiver.visitExpression(this, context), ast.index.visitExpression(this, context), ast.type, ast.sourceSpan), context);
    }
    visitLiteralArrayExpr(ast, context) {
        return this.transformExpr(new LiteralArrayExpr(this.visitAllExpressions(ast.entries, context), ast.type, ast.sourceSpan), context);
    }
    visitLiteralMapExpr(ast, context) {
        const entries = ast.entries.map((entry) => new LiteralMapEntry(entry.key, entry.value.visitExpression(this, context), entry.quoted));
        const mapType = new MapType(ast.valueType, null);
        return this.transformExpr(new LiteralMapExpr(entries, mapType, ast.sourceSpan), context);
    }
    visitCommaExpr(ast, context) {
        return this.transformExpr(new CommaExpr(this.visitAllExpressions(ast.parts, context), ast.sourceSpan), context);
    }
    visitAllExpressions(exprs, context) {
        return exprs.map(expr => expr.visitExpression(this, context));
    }
    visitDeclareVarStmt(stmt, context) {
        const value = stmt.value && stmt.value.visitExpression(this, context);
        return this.transformStmt(new DeclareVarStmt(stmt.name, value, stmt.type, stmt.modifiers, stmt.sourceSpan), context);
    }
    visitDeclareFunctionStmt(stmt, context) {
        return this.transformStmt(new DeclareFunctionStmt(stmt.name, stmt.params, this.visitAllStatements(stmt.statements, context), stmt.type, stmt.modifiers, stmt.sourceSpan), context);
    }
    visitExpressionStmt(stmt, context) {
        return this.transformStmt(new ExpressionStatement(stmt.expr.visitExpression(this, context), stmt.sourceSpan), context);
    }
    visitReturnStmt(stmt, context) {
        return this.transformStmt(new ReturnStatement(stmt.value.visitExpression(this, context), stmt.sourceSpan), context);
    }
    visitDeclareClassStmt(stmt, context) {
        const parent = stmt.parent.visitExpression(this, context);
        const getters = stmt.getters.map(getter => new ClassGetter(getter.name, this.visitAllStatements(getter.body, context), getter.type, getter.modifiers));
        const ctorMethod = stmt.constructorMethod &&
            new ClassMethod(stmt.constructorMethod.name, stmt.constructorMethod.params, this.visitAllStatements(stmt.constructorMethod.body, context), stmt.constructorMethod.type, stmt.constructorMethod.modifiers);
        const methods = stmt.methods.map(method => new ClassMethod(method.name, method.params, this.visitAllStatements(method.body, context), method.type, method.modifiers));
        return this.transformStmt(new ClassStmt(stmt.name, parent, stmt.fields, getters, ctorMethod, methods, stmt.modifiers, stmt.sourceSpan), context);
    }
    visitIfStmt(stmt, context) {
        return this.transformStmt(new IfStmt(stmt.condition.visitExpression(this, context), this.visitAllStatements(stmt.trueCase, context), this.visitAllStatements(stmt.falseCase, context), stmt.sourceSpan), context);
    }
    visitTryCatchStmt(stmt, context) {
        return this.transformStmt(new TryCatchStmt(this.visitAllStatements(stmt.bodyStmts, context), this.visitAllStatements(stmt.catchStmts, context), stmt.sourceSpan), context);
    }
    visitThrowStmt(stmt, context) {
        return this.transformStmt(new ThrowStmt(stmt.error.visitExpression(this, context), stmt.sourceSpan), context);
    }
    visitCommentStmt(stmt, context) {
        return this.transformStmt(stmt, context);
    }
    visitJSDocCommentStmt(stmt, context) {
        return this.transformStmt(stmt, context);
    }
    visitAllStatements(stmts, context) {
        return stmts.map(stmt => stmt.visitStatement(this, context));
    }
}
export class RecursiveAstVisitor {
    visitType(ast, context) { return ast; }
    visitExpression(ast, context) {
        if (ast.type) {
            ast.type.visitType(this, context);
        }
        return ast;
    }
    visitBuiltinType(type, context) { return this.visitType(type, context); }
    visitExpressionType(type, context) {
        type.value.visitExpression(this, context);
        if (type.typeParams !== null) {
            type.typeParams.forEach(param => this.visitType(param, context));
        }
        return this.visitType(type, context);
    }
    visitArrayType(type, context) { return this.visitType(type, context); }
    visitMapType(type, context) { return this.visitType(type, context); }
    visitWrappedNodeExpr(ast, context) { return ast; }
    visitTypeofExpr(ast, context) { return this.visitExpression(ast, context); }
    visitReadVarExpr(ast, context) {
        return this.visitExpression(ast, context);
    }
    visitWriteVarExpr(ast, context) {
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitWriteKeyExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.index.visitExpression(this, context);
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitWritePropExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitInvokeMethodExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    }
    visitInvokeFunctionExpr(ast, context) {
        ast.fn.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    }
    visitInstantiateExpr(ast, context) {
        ast.classExpr.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    }
    visitLiteralExpr(ast, context) {
        return this.visitExpression(ast, context);
    }
    visitExternalExpr(ast, context) {
        if (ast.typeParams) {
            ast.typeParams.forEach(type => type.visitType(this, context));
        }
        return this.visitExpression(ast, context);
    }
    visitConditionalExpr(ast, context) {
        ast.condition.visitExpression(this, context);
        ast.trueCase.visitExpression(this, context);
        ast.falseCase.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitNotExpr(ast, context) {
        ast.condition.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitAssertNotNullExpr(ast, context) {
        ast.condition.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitCastExpr(ast, context) {
        ast.value.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitFunctionExpr(ast, context) {
        this.visitAllStatements(ast.statements, context);
        return this.visitExpression(ast, context);
    }
    visitBinaryOperatorExpr(ast, context) {
        ast.lhs.visitExpression(this, context);
        ast.rhs.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitReadPropExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitReadKeyExpr(ast, context) {
        ast.receiver.visitExpression(this, context);
        ast.index.visitExpression(this, context);
        return this.visitExpression(ast, context);
    }
    visitLiteralArrayExpr(ast, context) {
        this.visitAllExpressions(ast.entries, context);
        return this.visitExpression(ast, context);
    }
    visitLiteralMapExpr(ast, context) {
        ast.entries.forEach((entry) => entry.value.visitExpression(this, context));
        return this.visitExpression(ast, context);
    }
    visitCommaExpr(ast, context) {
        this.visitAllExpressions(ast.parts, context);
        return this.visitExpression(ast, context);
    }
    visitAllExpressions(exprs, context) {
        exprs.forEach(expr => expr.visitExpression(this, context));
    }
    visitDeclareVarStmt(stmt, context) {
        if (stmt.value) {
            stmt.value.visitExpression(this, context);
        }
        if (stmt.type) {
            stmt.type.visitType(this, context);
        }
        return stmt;
    }
    visitDeclareFunctionStmt(stmt, context) {
        this.visitAllStatements(stmt.statements, context);
        if (stmt.type) {
            stmt.type.visitType(this, context);
        }
        return stmt;
    }
    visitExpressionStmt(stmt, context) {
        stmt.expr.visitExpression(this, context);
        return stmt;
    }
    visitReturnStmt(stmt, context) {
        stmt.value.visitExpression(this, context);
        return stmt;
    }
    visitDeclareClassStmt(stmt, context) {
        stmt.parent.visitExpression(this, context);
        stmt.getters.forEach(getter => this.visitAllStatements(getter.body, context));
        if (stmt.constructorMethod) {
            this.visitAllStatements(stmt.constructorMethod.body, context);
        }
        stmt.methods.forEach(method => this.visitAllStatements(method.body, context));
        return stmt;
    }
    visitIfStmt(stmt, context) {
        stmt.condition.visitExpression(this, context);
        this.visitAllStatements(stmt.trueCase, context);
        this.visitAllStatements(stmt.falseCase, context);
        return stmt;
    }
    visitTryCatchStmt(stmt, context) {
        this.visitAllStatements(stmt.bodyStmts, context);
        this.visitAllStatements(stmt.catchStmts, context);
        return stmt;
    }
    visitThrowStmt(stmt, context) {
        stmt.error.visitExpression(this, context);
        return stmt;
    }
    visitCommentStmt(stmt, context) { return stmt; }
    visitJSDocCommentStmt(stmt, context) { return stmt; }
    visitAllStatements(stmts, context) {
        stmts.forEach(stmt => stmt.visitStatement(this, context));
    }
}
export function findReadVarNames(stmts) {
    const visitor = new _ReadVarVisitor();
    visitor.visitAllStatements(stmts, null);
    return visitor.varNames;
}
class _ReadVarVisitor extends RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.varNames = new Set();
    }
    visitDeclareFunctionStmt(stmt, context) {
        // Don't descend into nested functions
        return stmt;
    }
    visitDeclareClassStmt(stmt, context) {
        // Don't descend into nested classes
        return stmt;
    }
    visitReadVarExpr(ast, context) {
        if (ast.name) {
            this.varNames.add(ast.name);
        }
        return null;
    }
}
export function collectExternalReferences(stmts) {
    const visitor = new _FindExternalReferencesVisitor();
    visitor.visitAllStatements(stmts, null);
    return visitor.externalReferences;
}
class _FindExternalReferencesVisitor extends RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.externalReferences = [];
    }
    visitExternalExpr(e, context) {
        this.externalReferences.push(e.value);
        return super.visitExternalExpr(e, context);
    }
}
export function applySourceSpanToStatementIfNeeded(stmt, sourceSpan) {
    if (!sourceSpan) {
        return stmt;
    }
    const transformer = new _ApplySourceSpanTransformer(sourceSpan);
    return stmt.visitStatement(transformer, null);
}
export function applySourceSpanToExpressionIfNeeded(expr, sourceSpan) {
    if (!sourceSpan) {
        return expr;
    }
    const transformer = new _ApplySourceSpanTransformer(sourceSpan);
    return expr.visitExpression(transformer, null);
}
class _ApplySourceSpanTransformer extends AstTransformer {
    constructor(sourceSpan) {
        super();
        this.sourceSpan = sourceSpan;
    }
    _clone(obj) {
        const clone = Object.create(obj.constructor.prototype);
        for (let prop in obj) {
            clone[prop] = obj[prop];
        }
        return clone;
    }
    transformExpr(expr, context) {
        if (!expr.sourceSpan) {
            expr = this._clone(expr);
            expr.sourceSpan = this.sourceSpan;
        }
        return expr;
    }
    transformStmt(stmt, context) {
        if (!stmt.sourceSpan) {
            stmt = this._clone(stmt);
            stmt.sourceSpan = this.sourceSpan;
        }
        return stmt;
    }
}
export function variable(name, type, sourceSpan) {
    return new ReadVarExpr(name, type, sourceSpan);
}
export function importExpr(id, typeParams = null, sourceSpan) {
    return new ExternalExpr(id, null, typeParams, sourceSpan);
}
export function importType(id, typeParams = null, typeModifiers = null) {
    return id != null ? expressionType(importExpr(id, typeParams, null), typeModifiers) : null;
}
export function expressionType(expr, typeModifiers = null, typeParams = null) {
    return new ExpressionType(expr, typeModifiers, typeParams);
}
export function typeofExpr(expr) {
    return new TypeofExpr(expr);
}
export function literalArr(values, type, sourceSpan) {
    return new LiteralArrayExpr(values, type, sourceSpan);
}
export function literalMap(values, type = null) {
    return new LiteralMapExpr(values.map(e => new LiteralMapEntry(e.key, e.value, e.quoted)), type, null);
}
export function not(expr, sourceSpan) {
    return new NotExpr(expr, sourceSpan);
}
export function assertNotNull(expr, sourceSpan) {
    return new AssertNotNull(expr, sourceSpan);
}
export function fn(params, body, type, sourceSpan, name) {
    return new FunctionExpr(params, body, type, sourceSpan, name);
}
export function ifStmt(condition, thenClause, elseClause) {
    return new IfStmt(condition, thenClause, elseClause);
}
export function literal(value, type, sourceSpan) {
    return new LiteralExpr(value, type, sourceSpan);
}
export function isNull(exp) {
    return exp instanceof LiteralExpr && exp.value === null;
}
/*
 * Serializes a `Tag` into a string.
 * Returns a string like " @foo {bar} baz" (note the leading whitespace before `@foo`).
 */
function tagToString(tag) {
    let out = '';
    if (tag.tagName) {
        out += ` @${tag.tagName}`;
    }
    if (tag.text) {
        if (tag.text.match(/\/\*|\*\//)) {
            throw new Error('JSDoc text cannot contain "/*" and "*/"');
        }
        out += ' ' + tag.text.replace(/@/g, '\\@');
    }
    return out;
}
function serializeTags(tags) {
    if (tags.length === 0)
        return '';
    let out = '*\n';
    for (const tag of tags) {
        out += ' *';
        // If the tagToString is multi-line, insert " * " prefixes on subsequent lines.
        out += tagToString(tag).replace(/\n/g, '\n * ');
        out += '\n';
    }
    out += ' ';
    return out;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFNSCxVQUFVO0FBQ1YsTUFBTSxDQUFOLElBQVksWUFFWDtBQUZELFdBQVksWUFBWTtJQUN0QixpREFBSyxDQUFBO0FBQ1AsQ0FBQyxFQUZXLFlBQVksS0FBWixZQUFZLFFBRXZCO0FBRUQsTUFBTTtJQUNKLFlBQW1CLFlBQWlDLElBQUk7UUFBckMsY0FBUyxHQUFULFNBQVMsQ0FBNEI7UUFDdEQsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNkLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO1NBQ3JCO0lBQ0gsQ0FBQztJQUdELFdBQVcsQ0FBQyxRQUFzQixJQUFhLE9BQU8sSUFBSSxDQUFDLFNBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25HO0FBRUQsTUFBTSxDQUFOLElBQVksZUFTWDtBQVRELFdBQVksZUFBZTtJQUN6QiwyREFBTyxDQUFBO0lBQ1AscURBQUksQ0FBQTtJQUNKLHlEQUFNLENBQUE7SUFDTixtREFBRyxDQUFBO0lBQ0gseURBQU0sQ0FBQTtJQUNOLDZEQUFRLENBQUE7SUFDUiw2REFBUSxDQUFBO0lBQ1IscURBQUksQ0FBQTtBQUNOLENBQUMsRUFUVyxlQUFlLEtBQWYsZUFBZSxRQVMxQjtBQUVELE1BQU0sa0JBQW1CLFNBQVEsSUFBSTtJQUNuQyxZQUFtQixJQUFxQixFQUFFLFlBQWlDLElBQUk7UUFDN0UsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBREEsU0FBSSxHQUFKLElBQUksQ0FBaUI7SUFFeEMsQ0FBQztJQUNELFNBQVMsQ0FBQyxPQUFvQixFQUFFLE9BQVk7UUFDMUMsT0FBTyxPQUFPLENBQUMs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LGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUNELEtBQUssQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDdEQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUNELElBQUksQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDckQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUNELE1BQU0sQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDdkQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUNELFFBQVEsQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDekQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQUNELE1BQU0sQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDdkQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUNELEdBQUcsQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDcEQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDakYsQ0FBQztJ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TyxHQUFHLFlBQVksV0FBVyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDO0FBQzFELENBQUM7QUEwQkQ7OztHQUdHO0FBQ0gscUJBQXFCLEdBQWE7SUFDaEMsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ2IsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFO1FBQ2YsR0FBRyxJQUFJLEtBQUssR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzNCO0lBQ0QsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO1FBQ1osSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7U0FDNUQ7UUFDRCxHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztLQUM1QztJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELHVCQUF1QixJQUFnQjtJQUNyQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQztRQUFFLE9BQU8sRUFBRSxDQUFDO0lBRWpDLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQztJQUNoQixLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtRQUN0QixHQUFHLElBQUksSUFBSSxDQUFDO1FBQ1osK0VBQStFO1FBQy9FLEdBQUcsSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNoRCxHQUFHLElBQUksSUFBSSxDQUFDO0tBQ2I7SUFDRCxHQUFHLElBQUksR0FBRyxDQUFDO0lBQ1gsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG4vLy8vIFR5cGVzXG5leHBvcnQgZW51bSBUeXBlTW9kaWZpZXIge1xuICBDb25zdFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgaWYgKCFtb2RpZmllcnMpIHtcbiAgICAgIHRoaXMubW9kaWZpZXJzID0gW107XG4gICAgfVxuICB9XG4gIGFic3RyYWN0IHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xuXG4gIGhhc01vZGlmaWVyKG1vZGlmaWVyOiBUeXBlTW9kaWZpZXIpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubW9kaWZpZXJzICEuaW5kZXhPZihtb2RpZmllcikgIT09IC0xOyB9XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWx0aW5UeXBlTmFtZSB7XG4gIER5bmFtaWMsXG4gIEJvb2wsXG4gIFN0cmluZyxcbiAgSW50LFxuICBOdW1iZXIsXG4gIEZ1bmN0aW9uLFxuICBJbmZlcnJlZCxcbiAgTm9uZSxcbn1cblxuZXhwb3J0IGNsYXNzIEJ1aWx0aW5UeXBlIGV4dGVuZHMgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBCdWlsdGluVHlwZU5hbWUsIG1vZGlmaWVyczogVHlwZU1vZGlmaWVyW118bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJ1aWx0aW5UeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgbW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXXxudWxsID0gbnVsbCxcbiAgICAgIHB1YmxpYyB0eXBlUGFyYW1zOiBUeXBlW118bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV4cHJlc3Npb25UeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEFycmF5VHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgb2YgOiBUeXBlLCBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7IHN1cGVyKG1vZGlmaWVycyk7IH1cbiAgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QXJyYXlUeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIE1hcFR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgcHVibGljIHZhbHVlVHlwZTogVHlwZXxudWxsO1xuICBjb25zdHJ1Y3Rvcih2YWx1ZVR5cGU6IFR5cGV8bnVsbHx1bmRlZmluZWQsIG1vZGlmaWVyczogVHlwZU1vZGlmaWVyW118bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICAgIHRoaXMudmFsdWVUeXBlID0gdmFsdWVUeXBlIHx8IG51bGw7XG4gIH1cbiAgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdE1hcFR5cGUodGhpcywgY29udGV4dCk7IH1cbn1cblxuZXhwb3J0IGNvbnN0IERZTkFNSUNfVFlQRSA9IG5ldyBCdWlsdGluVHlwZShCdWlsdGluVHlwZU5hbWUuRHluYW1pYyk7XG5leHBvcnQgY29uc3QgSU5GRVJSRURfVFlQRSA9IG5ldyBCdWlsdGluVHlwZShCdWlsdGluVHlwZU5hbWUuSW5mZXJyZWQpO1xuZXhwb3J0IGNvbnN0IEJPT0xfVFlQRSA9IG5ldyBCdWlsdGluVHlwZShCdWlsdGluVHlwZU5hbWUuQm9vbCk7XG5leHBvcnQgY29uc3QgSU5UX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkludCk7XG5leHBvcnQgY29uc3QgTlVNQkVSX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLk51bWJlcik7XG5leHBvcnQgY29uc3QgU1RSSU5HX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLlN0cmluZyk7XG5leHBvcnQgY29uc3QgRlVOQ1RJT05fVFlQRSA9IG5ldyBCdWlsdGluVHlwZShCdWlsdGluVHlwZU5hbWUuRnVuY3Rpb24pO1xuZXhwb3J0IGNvbnN0IE5PTkVfVFlQRSA9IG5ldyBCdWlsdGluVHlwZShCdWlsdGluVHlwZU5hbWUuTm9uZSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZVZpc2l0b3Ige1xuICB2aXNpdEJ1aWx0aW5UeXBlKHR5cGU6IEJ1aWx0aW5UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXhwcmVzc2lvblR5cGUodHlwZTogRXhwcmVzc2lvblR5cGUsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRBcnJheVR5cGUodHlwZTogQXJyYXlUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TWFwVHlwZSh0eXBlOiBNYXBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cbi8vLy8vIEV4cHJlc3Npb25zXG5cbmV4cG9ydCBlbnVtIEJpbmFyeU9wZXJhdG9yIHtcbiAgRXF1YWxzLFxuICBOb3RFcXVhbHMsXG4gIElkZW50aWNhbCxcbiAgTm90SWRlbnRpY2FsLFxuICBNaW51cyxcbiAgUGx1cyxcbiAgRGl2aWRlLFxuICBNdWx0aXBseSxcbiAgTW9kdWxvLFxuICBBbmQsXG4gIE9yLFxuICBCaXR3aXNlQW5kLFxuICBMb3dlcixcbiAgTG93ZXJFcXVhbHMsXG4gIEJpZ2dlcixcbiAgQmlnZ2VyRXF1YWxzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBudWxsU2FmZUlzRXF1aXZhbGVudDxUIGV4dGVuZHN7aXNFcXVpdmFsZW50KG90aGVyOiBUKTogYm9vbGVhbn0+KFxuICAgIGJhc2U6IFQgfCBudWxsLCBvdGhlcjogVCB8IG51bGwpIHtcbiAgaWYgKGJhc2UgPT0gbnVsbCB8fCBvdGhlciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGJhc2UgPT0gb3RoZXI7XG4gIH1cbiAgcmV0dXJuIGJhc2UuaXNFcXVpdmFsZW50KG90aGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFyZUFsbEVxdWl2YWxlbnQ8VCBleHRlbmRze2lzRXF1aXZhbGVudChvdGhlcjogVCk6IGJvb2xlYW59PihcbiAgICBiYXNlOiBUW10sIG90aGVyOiBUW10pIHtcbiAgY29uc3QgbGVuID0gYmFzZS5sZW5ndGg7XG4gIGlmIChsZW4gIT09IG90aGVyLmxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFiYXNlW2ldLmlzRXF1aXZhbGVudChvdGhlcltpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHR5cGU6IFR5cGV8bnVsbHx1bmRlZmluZWQsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHRoaXMudHlwZSA9IHR5cGUgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVNwYW4gPSBzb3VyY2VTcGFuIHx8IG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICAvKipcbiAgICogQ2FsY3VsYXRlcyB3aGV0aGVyIHRoaXMgZXhwcmVzc2lvbiBwcm9kdWNlcyB0aGUgc2FtZSB2YWx1ZSBhcyB0aGUgZ2l2ZW4gZXhwcmVzc2lvbi5cbiAgICogTm90ZTogV2UgZG9uJ3QgY2hlY2sgVHlwZXMgbm9yIFBhcnNlU291cmNlU3BhbnMgbm9yIGZ1bmN0aW9uIGFyZ3VtZW50cy5cbiAgICovXG4gIGFic3RyYWN0IGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbjtcblxuICAvKipcbiAgICogUmV0dXJuIHRydWUgaWYgdGhlIGV4cHJlc3Npb24gaXMgY29uc3RhbnQuXG4gICAqL1xuICBhYnN0cmFjdCBpc0NvbnN0YW50KCk6IGJvb2xlYW47XG5cbiAgcHJvcChuYW1lOiBzdHJpbmcsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRQcm9wRXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWFkUHJvcEV4cHIodGhpcywgbmFtZSwgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBrZXkoaW5kZXg6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRLZXlFeHByIHtcbiAgICByZXR1cm4gbmV3IFJlYWRLZXlFeHByKHRoaXMsIGluZGV4LCB0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGNhbGxNZXRob2QobmFtZTogc3RyaW5nfEJ1aWx0aW5NZXRob2QsIHBhcmFtczogRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOlxuICAgICAgSW52b2tlTWV0aG9kRXhwciB7XG4gICAgcmV0dXJuIG5ldyBJbnZva2VNZXRob2RFeHByKHRoaXMsIG5hbWUsIHBhcmFtcywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjYWxsRm4ocGFyYW1zOiBFeHByZXNzaW9uW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEludm9rZUZ1bmN0aW9uRXhwciB7XG4gICAgcmV0dXJuIG5ldyBJbnZva2VGdW5jdGlvbkV4cHIodGhpcywgcGFyYW1zLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGluc3RhbnRpYXRlKHBhcmFtczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOlxuICAgICAgSW5zdGFudGlhdGVFeHByIHtcbiAgICByZXR1cm4gbmV3IEluc3RhbnRpYXRlRXhwcih0aGlzLCBwYXJhbXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgY29uZGl0aW9uYWwoXG4gICAgICB0cnVlQ2FzZTogRXhwcmVzc2lvbiwgZmFsc2VDYXNlOiBFeHByZXNzaW9ufG51bGwgPSBudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQ29uZGl0aW9uYWxFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsRXhwcih0aGlzLCB0cnVlQ2FzZSwgZmFsc2VDYXNlLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuRXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG5vdEVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlkZW50aWNhbChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG5vdElkZW50aWNhbChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG1pbnVzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5NaW51cywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBwbHVzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5QbHVzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGRpdmlkZShyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuRGl2aWRlLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG11bHRpcGx5KHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5NdWx0aXBseSwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBtb2R1bG8ocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk1vZHVsbywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBhbmQocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkFuZCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBiaXR3aXNlQW5kKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwYXJlbnM6IGJvb2xlYW4gPSB0cnVlKTpcbiAgICAgIEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuLCBwYXJlbnMpO1xuICB9XG4gIG9yKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5PciwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBsb3dlcihyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTG93ZXIsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbG93ZXJFcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGJpZ2dlcihyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQmlnZ2VyLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGJpZ2dlckVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzQmxhbmsoc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXhwcmVzc2lvbiB7XG4gICAgLy8gTm90ZTogV2UgdXNlIGVxdWFscyBieSBwdXJwb3NlIGhlcmUgdG8gY29tcGFyZSB0byBudWxsIGFuZCB1bmRlZmluZWQgaW4gSlMuXG4gICAgLy8gV2UgdXNlIHRoZSB0eXBlZCBudWxsIHRvIGFsbG93IHN0cmljdE51bGxDaGVja3MgdG8gbmFycm93IHR5cGVzLlxuICAgIHJldHVybiB0aGlzLmVxdWFscyhUWVBFRF9OVUxMX0VYUFIsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGNhc3QodHlwZTogVHlwZSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIG5ldyBDYXN0RXhwcih0aGlzLCB0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvU3RtdCgpOiBTdGF0ZW1lbnQgeyByZXR1cm4gbmV3IEV4cHJlc3Npb25TdGF0ZW1lbnQodGhpcywgbnVsbCk7IH1cbn1cblxuZXhwb3J0IGVudW0gQnVpbHRpblZhciB7XG4gIFRoaXMsXG4gIFN1cGVyLFxuICBDYXRjaEVycm9yLFxuICBDYXRjaFN0YWNrXG59XG5cbmV4cG9ydCBjbGFzcyBSZWFkVmFyRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGw7XG4gIHB1YmxpYyBidWlsdGluOiBCdWlsdGluVmFyfG51bGw7XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nfEJ1aWx0aW5WYXIsIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICB0aGlzLmJ1aWx0aW4gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm5hbWUgPSBudWxsO1xuICAgICAgdGhpcy5idWlsdGluID0gbmFtZTtcbiAgICB9XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgUmVhZFZhckV4cHIgJiYgdGhpcy5uYW1lID09PSBlLm5hbWUgJiYgdGhpcy5idWlsdGluID09PSBlLmJ1aWx0aW47XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWFkVmFyRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlVmFyRXhwciB7XG4gICAgaWYgKCF0aGlzLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQnVpbHQgaW4gdmFyaWFibGUgJHt0aGlzLmJ1aWx0aW59IGNhbiBub3QgYmUgYXNzaWduZWQgdG8uYCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgV3JpdGVWYXJFeHByKHRoaXMubmFtZSwgdmFsdWUsIG51bGwsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFR5cGVvZkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpIHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFR5cGVvZkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgVHlwZW9mRXhwciAmJiBlLmV4cHIuaXNFcXVpdmFsZW50KHRoaXMuZXhwcik7XG4gIH1cblxuICBpc0NvbnN0YW50KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5leHByLmlzQ29uc3RhbnQoKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgV3JhcHBlZE5vZGVFeHByPFQ+IGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBub2RlOiBULCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcmFwcGVkTm9kZUV4cHIgJiYgdGhpcy5ub2RlID09PSBlLm5vZGU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcmFwcGVkTm9kZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdyaXRlVmFyRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb247XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlVmFyRXhwciAmJiB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyaXRlVmFyRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHRvRGVjbFN0bXQodHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyW118bnVsbCk6IERlY2xhcmVWYXJTdG10IHtcbiAgICByZXR1cm4gbmV3IERlY2xhcmVWYXJTdG10KHRoaXMubmFtZSwgdGhpcy52YWx1ZSwgdHlwZSwgbW9kaWZpZXJzLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdG9Db25zdERlY2woKTogRGVjbGFyZVZhclN0bXQgeyByZXR1cm4gdGhpcy50b0RlY2xTdG10KElORkVSUkVEX1RZUEUsIFtTdG10TW9kaWZpZXIuRmluYWxdKTsgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXcml0ZUtleUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIGluZGV4OiBFeHByZXNzaW9uLCB2YWx1ZTogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyaXRlS2V5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXcml0ZVByb3BFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSB8fCB2YWx1ZS50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgV3JpdGVQcm9wRXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyaXRlUHJvcEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGVudW0gQnVpbHRpbk1ldGhvZCB7XG4gIENvbmNhdEFycmF5LFxuICBTdWJzY3JpYmVPYnNlcnZhYmxlLFxuICBCaW5kXG59XG5cbmV4cG9ydCBjbGFzcyBJbnZva2VNZXRob2RFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbDtcbiAgcHVibGljIGJ1aWx0aW46IEJ1aWx0aW5NZXRob2R8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIG1ldGhvZDogc3RyaW5nfEJ1aWx0aW5NZXRob2QsIHB1YmxpYyBhcmdzOiBFeHByZXNzaW9uW10sXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICBpZiAodHlwZW9mIG1ldGhvZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMubmFtZSA9IG1ldGhvZDtcbiAgICAgIHRoaXMuYnVpbHRpbiA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubmFtZSA9IG51bGw7XG4gICAgICB0aGlzLmJ1aWx0aW4gPSA8QnVpbHRpbk1ldGhvZD5tZXRob2Q7XG4gICAgfVxuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEludm9rZU1ldGhvZEV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5uYW1lID09PSBlLm5hbWUgJiYgdGhpcy5idWlsdGluID09PSBlLmJ1aWx0aW4gJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmFyZ3MsIGUuYXJncyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnZva2VNZXRob2RFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEludm9rZUZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBmbjogRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEludm9rZUZ1bmN0aW9uRXhwciAmJiB0aGlzLmZuLmlzRXF1aXZhbGVudChlLmZuKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYXJncywgZS5hcmdzKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEludm9rZUZ1bmN0aW9uRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBJbnN0YW50aWF0ZUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY2xhc3NFeHByOiBFeHByZXNzaW9uLCBwdWJsaWMgYXJnczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgSW5zdGFudGlhdGVFeHByICYmIHRoaXMuY2xhc3NFeHByLmlzRXF1aXZhbGVudChlLmNsYXNzRXhwcikgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmFyZ3MsIGUuYXJncyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnN0YW50aWF0ZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IG51bWJlcnxzdHJpbmd8Ym9vbGVhbnxudWxsfHVuZGVmaW5lZCwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxFeHByICYmIHRoaXMudmFsdWUgPT09IGUudmFsdWU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExpdGVyYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEV4dGVybmFsRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogRXh0ZXJuYWxSZWZlcmVuY2UsIHR5cGU/OiBUeXBlfG51bGwsIHB1YmxpYyB0eXBlUGFyYW1zOiBUeXBlW118bnVsbCA9IG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBFeHRlcm5hbEV4cHIgJiYgdGhpcy52YWx1ZS5uYW1lID09PSBlLnZhbHVlLm5hbWUgJiZcbiAgICAgICAgdGhpcy52YWx1ZS5tb2R1bGVOYW1lID09PSBlLnZhbHVlLm1vZHVsZU5hbWUgJiYgdGhpcy52YWx1ZS5ydW50aW1lID09PSBlLnZhbHVlLnJ1bnRpbWU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHRlcm5hbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVybmFsUmVmZXJlbmNlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG1vZHVsZU5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGwsIHB1YmxpYyBydW50aW1lPzogYW55fG51bGwpIHtcbiAgfVxuICAvLyBOb3RlOiBubyBpc0VxdWl2YWxlbnQgbWV0aG9kIGhlcmUgYXMgd2UgdXNlIHRoaXMgYXMgYW4gaW50ZXJmYWNlIHRvby5cbn1cblxuZXhwb3J0IGNsYXNzIENvbmRpdGlvbmFsRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdHJ1ZUNhc2U6IEV4cHJlc3Npb247XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY29uZGl0aW9uOiBFeHByZXNzaW9uLCB0cnVlQ2FzZTogRXhwcmVzc2lvbiwgcHVibGljIGZhbHNlQ2FzZTogRXhwcmVzc2lvbnxudWxsID0gbnVsbCxcbiAgICAgIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdHJ1ZUNhc2UudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy50cnVlQ2FzZSA9IHRydWVDYXNlO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbmRpdGlvbmFsRXhwciAmJiB0aGlzLmNvbmRpdGlvbi5pc0VxdWl2YWxlbnQoZS5jb25kaXRpb24pICYmXG4gICAgICAgIHRoaXMudHJ1ZUNhc2UuaXNFcXVpdmFsZW50KGUudHJ1ZUNhc2UpICYmIG51bGxTYWZlSXNFcXVpdmFsZW50KHRoaXMuZmFsc2VDYXNlLCBlLmZhbHNlQ2FzZSk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb25kaXRpb25hbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTm90RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29uZGl0aW9uOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihCT09MX1RZUEUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIE5vdEV4cHIgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdE5vdEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFzc2VydE5vdE51bGwgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIoY29uZGl0aW9uLnR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEFzc2VydE5vdE51bGwgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFzc2VydE5vdE51bGxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDYXN0RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENhc3RFeHByICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q2FzdEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgRm5QYXJhbSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBUeXBlfG51bGwgPSBudWxsKSB7fVxuXG4gIGlzRXF1aXZhbGVudChwYXJhbTogRm5QYXJhbSk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5uYW1lID09PSBwYXJhbS5uYW1lOyB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBwYXJhbXM6IEZuUGFyYW1bXSwgcHVibGljIHN0YXRlbWVudHM6IFN0YXRlbWVudFtdLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgbmFtZT86IHN0cmluZ3xudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRnVuY3Rpb25FeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJhbXMsIGUucGFyYW1zKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuc3RhdGVtZW50cywgZS5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEZ1bmN0aW9uRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHRvRGVjbFN0bXQobmFtZTogc3RyaW5nLCBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsKTogRGVjbGFyZUZ1bmN0aW9uU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlRnVuY3Rpb25TdG10KFxuICAgICAgICBuYW1lLCB0aGlzLnBhcmFtcywgdGhpcy5zdGF0ZW1lbnRzLCB0aGlzLnR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBCaW5hcnlPcGVyYXRvckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIGxoczogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgb3BlcmF0b3I6IEJpbmFyeU9wZXJhdG9yLCBsaHM6IEV4cHJlc3Npb24sIHB1YmxpYyByaHM6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBwYXJlbnM6IGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgc3VwZXIodHlwZSB8fCBsaHMudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy5saHMgPSBsaHM7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQmluYXJ5T3BlcmF0b3JFeHByICYmIHRoaXMub3BlcmF0b3IgPT09IGUub3BlcmF0b3IgJiZcbiAgICAgICAgdGhpcy5saHMuaXNFcXVpdmFsZW50KGUubGhzKSAmJiB0aGlzLnJocy5pc0VxdWl2YWxlbnQoZS5yaHMpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRQcm9wRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlYWRQcm9wRXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLm5hbWUgPT09IGUubmFtZTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlYWRQcm9wRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVQcm9wRXhwcih0aGlzLnJlY2VpdmVyLCB0aGlzLm5hbWUsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBwdWJsaWMgaW5kZXg6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlYWRLZXlFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgc2V0KHZhbHVlOiBFeHByZXNzaW9uKTogV3JpdGVLZXlFeHByIHtcbiAgICByZXR1cm4gbmV3IFdyaXRlS2V5RXhwcih0aGlzLnJlY2VpdmVyLCB0aGlzLmluZGV4LCB2YWx1ZSwgbnVsbCwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsQXJyYXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyBlbnRyaWVzOiBFeHByZXNzaW9uW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiB0aGlzLmVudHJpZXMuZXZlcnkoZSA9PiBlLmlzQ29uc3RhbnQoKSk7IH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTGl0ZXJhbEFycmF5RXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuZW50cmllcywgZS5lbnRyaWVzKTtcbiAgfVxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsQXJyYXlFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwRW50cnkge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMga2V5OiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgcHVibGljIHF1b3RlZDogYm9vbGVhbikge31cbiAgaXNFcXVpdmFsZW50KGU6IExpdGVyYWxNYXBFbnRyeSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmtleSA9PT0gZS5rZXkgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxNYXBFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZVR5cGU6IFR5cGV8bnVsbCA9IG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGVudHJpZXM6IExpdGVyYWxNYXBFbnRyeVtdLCB0eXBlPzogTWFwVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdGhpcy52YWx1ZVR5cGUgPSB0eXBlLnZhbHVlVHlwZTtcbiAgICB9XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTGl0ZXJhbE1hcEV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmVudHJpZXMsIGUuZW50cmllcyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS52YWx1ZS5pc0NvbnN0YW50KCkpOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbE1hcEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbW1hRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcGFydHM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIocGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29tbWFFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJ0cywgZS5wYXJ0cyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb21tYUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHByZXNzaW9uVmlzaXRvciB7XG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogV3JpdGVLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW52b2tlTWV0aG9kRXhwcihhc3Q6IEludm9rZU1ldGhvZEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBJbnZva2VGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IExpdGVyYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogQ29uZGl0aW9uYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Tm90RXhwcihhc3Q6IE5vdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwcihhc3Q6IEFzc2VydE5vdE51bGwsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDYXN0RXhwcihhc3Q6IENhc3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogQmluYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBMaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNvbnN0IFRISVNfRVhQUiA9IG5ldyBSZWFkVmFyRXhwcihCdWlsdGluVmFyLlRoaXMsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IFNVUEVSX0VYUFIgPSBuZXcgUmVhZFZhckV4cHIoQnVpbHRpblZhci5TdXBlciwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuQ2F0Y2hFcnJvciwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfU1RBQ0tfVkFSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuQ2F0Y2hTdGFjaywgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgTlVMTF9FWFBSID0gbmV3IExpdGVyYWxFeHByKG51bGwsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IFRZUEVEX05VTExfRVhQUiA9IG5ldyBMaXRlcmFsRXhwcihudWxsLCBJTkZFUlJFRF9UWVBFLCBudWxsKTtcblxuLy8vLyBTdGF0ZW1lbnRzXG5leHBvcnQgZW51bSBTdG10TW9kaWZpZXIge1xuICBGaW5hbCxcbiAgUHJpdmF0ZSxcbiAgRXhwb3J0ZWQsXG4gIFN0YXRpYyxcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN0YXRlbWVudCB7XG4gIHB1YmxpYyBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdO1xuICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIGNvbnN0cnVjdG9yKG1vZGlmaWVycz86IFN0bXRNb2RpZmllcltdfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHRoaXMubW9kaWZpZXJzID0gbW9kaWZpZXJzIHx8IFtdO1xuICAgIHRoaXMuc291cmNlU3BhbiA9IHNvdXJjZVNwYW4gfHwgbnVsbDtcbiAgfVxuICAvKipcbiAgICogQ2FsY3VsYXRlcyB3aGV0aGVyIHRoaXMgc3RhdGVtZW50IHByb2R1Y2VzIHRoZSBzYW1lIHZhbHVlIGFzIHRoZSBnaXZlbiBzdGF0ZW1lbnQuXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbjtcblxuICBhYnN0cmFjdCB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgaGFzTW9kaWZpZXIobW9kaWZpZXI6IFN0bXRNb2RpZmllcik6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5tb2RpZmllcnMgIS5pbmRleE9mKG1vZGlmaWVyKSAhPT0gLTE7IH1cbn1cblxuXG5leHBvcnQgY2xhc3MgRGVjbGFyZVZhclN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBwdWJsaWMgdHlwZTogVHlwZXxudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZT86IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHlwZSA9IHR5cGUgfHwgKHZhbHVlICYmIHZhbHVlLnR5cGUpIHx8IG51bGw7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRGVjbGFyZVZhclN0bXQgJiYgdGhpcy5uYW1lID09PSBzdG10Lm5hbWUgJiZcbiAgICAgICAgKHRoaXMudmFsdWUgPyAhIXN0bXQudmFsdWUgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoc3RtdC52YWx1ZSkgOiAhc3RtdC52YWx1ZSk7XG4gIH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlY2xhcmVWYXJTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWNsYXJlRnVuY3Rpb25TdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgcGFyYW1zOiBGblBhcmFtW10sIHB1YmxpYyBzdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSxcbiAgICAgIHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG1vZGlmaWVycywgc291cmNlU3Bhbik7XG4gICAgdGhpcy50eXBlID0gdHlwZSB8fCBudWxsO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIERlY2xhcmVGdW5jdGlvblN0bXQgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnBhcmFtcywgc3RtdC5wYXJhbXMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5zdGF0ZW1lbnRzLCBzdG10LnN0YXRlbWVudHMpO1xuICB9XG5cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlY2xhcmVGdW5jdGlvblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4cHJlc3Npb25TdGF0ZW1lbnQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRXhwcmVzc2lvblN0YXRlbWVudCAmJiB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KHN0bXQuZXhwcik7XG4gIH1cblxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXhwcmVzc2lvblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUmV0dXJuU3RhdGVtZW50IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBSZXR1cm5TdGF0ZW1lbnQgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoc3RtdC52YWx1ZSk7XG4gIH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJldHVyblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFic3RyYWN0Q2xhc3NQYXJ0IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IodHlwZTogVHlwZXxudWxsfHVuZGVmaW5lZCwgcHVibGljIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCkge1xuICAgIGlmICghbW9kaWZpZXJzKSB7XG4gICAgICB0aGlzLm1vZGlmaWVycyA9IFtdO1xuICAgIH1cbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gIH1cbiAgaGFzTW9kaWZpZXIobW9kaWZpZXI6IFN0bXRNb2RpZmllcik6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5tb2RpZmllcnMgIS5pbmRleE9mKG1vZGlmaWVyKSAhPT0gLTE7IH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXNzRmllbGQgZXh0ZW5kcyBBYnN0cmFjdENsYXNzUGFydCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsID0gbnVsbCxcbiAgICAgIHB1YmxpYyBpbml0aWFsaXplcj86IEV4cHJlc3Npb24pIHtcbiAgICBzdXBlcih0eXBlLCBtb2RpZmllcnMpO1xuICB9XG4gIGlzRXF1aXZhbGVudChmOiBDbGFzc0ZpZWxkKSB7IHJldHVybiB0aGlzLm5hbWUgPT09IGYubmFtZTsgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBDbGFzc01ldGhvZCBleHRlbmRzIEFic3RyYWN0Q2xhc3NQYXJ0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGwsIHB1YmxpYyBwYXJhbXM6IEZuUGFyYW1bXSwgcHVibGljIGJvZHk6IFN0YXRlbWVudFtdLFxuICAgICAgdHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsID0gbnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIG1vZGlmaWVycyk7XG4gIH1cbiAgaXNFcXVpdmFsZW50KG06IENsYXNzTWV0aG9kKSB7XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gbS5uYW1lICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5ib2R5LCBtLmJvZHkpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIENsYXNzR2V0dGVyIGV4dGVuZHMgQWJzdHJhY3RDbGFzc1BhcnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBib2R5OiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBtb2RpZmllcnMpO1xuICB9XG4gIGlzRXF1aXZhbGVudChtOiBDbGFzc0dldHRlcikge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IG0ubmFtZSAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYm9keSwgbS5ib2R5KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBDbGFzc1N0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBwYXJlbnQ6IEV4cHJlc3Npb258bnVsbCwgcHVibGljIGZpZWxkczogQ2xhc3NGaWVsZFtdLFxuICAgICAgcHVibGljIGdldHRlcnM6IENsYXNzR2V0dGVyW10sIHB1YmxpYyBjb25zdHJ1Y3Rvck1ldGhvZDogQ2xhc3NNZXRob2QsXG4gICAgICBwdWJsaWMgbWV0aG9kczogQ2xhc3NNZXRob2RbXSwgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsID0gbnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG1vZGlmaWVycywgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgQ2xhc3NTdG10ICYmIHRoaXMubmFtZSA9PT0gc3RtdC5uYW1lICYmXG4gICAgICAgIG51bGxTYWZlSXNFcXVpdmFsZW50KHRoaXMucGFyZW50LCBzdG10LnBhcmVudCkgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmZpZWxkcywgc3RtdC5maWVsZHMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5nZXR0ZXJzLCBzdG10LmdldHRlcnMpICYmXG4gICAgICAgIHRoaXMuY29uc3RydWN0b3JNZXRob2QuaXNFcXVpdmFsZW50KHN0bXQuY29uc3RydWN0b3JNZXRob2QpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5tZXRob2RzLCBzdG10Lm1ldGhvZHMpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlQ2xhc3NTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIElmU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgcHVibGljIHRydWVDYXNlOiBTdGF0ZW1lbnRbXSxcbiAgICAgIHB1YmxpYyBmYWxzZUNhc2U6IFN0YXRlbWVudFtdID0gW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIElmU3RtdCAmJiB0aGlzLmNvbmRpdGlvbi5pc0VxdWl2YWxlbnQoc3RtdC5jb25kaXRpb24pICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy50cnVlQ2FzZSwgc3RtdC50cnVlQ2FzZSkgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmZhbHNlQ2FzZSwgc3RtdC5mYWxzZUNhc2UpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJZlN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbW1lbnRTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbW1lbnQ6IHN0cmluZywgcHVibGljIG11bHRpbGluZSA9IGZhbHNlLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7IHJldHVybiBzdG10IGluc3RhbmNlb2YgQ29tbWVudFN0bXQ7IH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbW1lbnRTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBKU0RvY0NvbW1lbnRTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHRhZ3M6IEpTRG9jVGFnW10gPSBbXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgSlNEb2NDb21tZW50U3RtdCAmJiB0aGlzLnRvU3RyaW5nKCkgPT09IHN0bXQudG9TdHJpbmcoKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SlNEb2NDb21tZW50U3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxuICB0b1N0cmluZygpOiBzdHJpbmcgeyByZXR1cm4gc2VyaWFsaXplVGFncyh0aGlzLnRhZ3MpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcnlDYXRjaFN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBib2R5U3RtdHM6IFN0YXRlbWVudFtdLCBwdWJsaWMgY2F0Y2hTdG10czogU3RhdGVtZW50W10sXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBUcnlDYXRjaFN0bXQgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmJvZHlTdG10cywgc3RtdC5ib2R5U3RtdHMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5jYXRjaFN0bXRzLCBzdG10LmNhdGNoU3RtdHMpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUcnlDYXRjaFN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgVGhyb3dTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIGVycm9yOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogVGhyb3dTdG10KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBUcnlDYXRjaFN0bXQgJiYgdGhpcy5lcnJvci5pc0VxdWl2YWxlbnQoc3RtdC5lcnJvcik7XG4gIH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRocm93U3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRlbWVudFZpc2l0b3Ige1xuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXhwcmVzc2lvblN0bXQoc3RtdDogRXhwcmVzc2lvblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IFRyeUNhdGNoU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRocm93U3RtdChzdG10OiBUaHJvd1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDb21tZW50U3RtdChzdG10OiBDb21tZW50U3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEpTRG9jQ29tbWVudFN0bXQoc3RtdDogSlNEb2NDb21tZW50U3RtdCwgY29udGV4dDogYW55KTogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgQXN0VHJhbnNmb3JtZXIgaW1wbGVtZW50cyBTdGF0ZW1lbnRWaXNpdG9yLCBFeHByZXNzaW9uVmlzaXRvciB7XG4gIHRyYW5zZm9ybUV4cHIoZXhwcjogRXhwcmVzc2lvbiwgY29udGV4dDogYW55KTogRXhwcmVzc2lvbiB7IHJldHVybiBleHByOyB9XG5cbiAgdHJhbnNmb3JtU3RtdChzdG10OiBTdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IFN0YXRlbWVudCB7IHJldHVybiBzdG10OyB9XG5cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKGFzdCwgY29udGV4dCk7IH1cblxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VHlwZW9mRXhwcihleHByOiBUeXBlb2ZFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBUeXBlb2ZFeHByKGV4cHIuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIudHlwZSwgZXhwci5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IFdyaXRlVmFyRXhwcihcbiAgICAgICAgICAgIGV4cHIubmFtZSwgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIudHlwZSwgZXhwci5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBXcml0ZUtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IFdyaXRlS2V5RXhwcihcbiAgICAgICAgICAgIGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRXcml0ZVByb3BFeHByKGV4cHI6IFdyaXRlUHJvcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IFdyaXRlUHJvcEV4cHIoXG4gICAgICAgICAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci5uYW1lLFxuICAgICAgICAgICAgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIudHlwZSwgZXhwci5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoYXN0OiBJbnZva2VNZXRob2RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IG1ldGhvZCA9IGFzdC5idWlsdGluIHx8IGFzdC5uYW1lO1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBJbnZva2VNZXRob2RFeHByKFxuICAgICAgICAgICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgbWV0aG9kICEsXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGFzdDogSW52b2tlRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBJbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgICBhc3QuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGNvbnRleHQpLFxuICAgICAgICAgICAgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEluc3RhbnRpYXRlRXhwcihhc3Q6IEluc3RhbnRpYXRlRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgSW5zdGFudGlhdGVFeHByKFxuICAgICAgICAgICAgYXN0LmNsYXNzRXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBMaXRlcmFsRXhwciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpOyB9XG5cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IENvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC5mYWxzZUNhc2UgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgTm90RXhwcihhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0QXNzZXJ0Tm90TnVsbEV4cHIoYXN0OiBBc3NlcnROb3ROdWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBBc3NlcnROb3ROdWxsKGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDYXN0RXhwcihhc3Q6IENhc3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBDYXN0RXhwcihhc3QudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgICBhc3QucGFyYW1zLCB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBCaW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIGFzdC5vcGVyYXRvciwgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgUmVhZFByb3BFeHByKFxuICAgICAgICAgICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0Lm5hbWUsIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IFJlYWRLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBSZWFkS2V5RXhwcihcbiAgICAgICAgICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IExpdGVyYWxBcnJheUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IExpdGVyYWxBcnJheUV4cHIoXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmVudHJpZXMubWFwKFxuICAgICAgICAoZW50cnkpOiBMaXRlcmFsTWFwRW50cnkgPT4gbmV3IExpdGVyYWxNYXBFbnRyeShcbiAgICAgICAgICAgIGVudHJ5LmtleSwgZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBlbnRyeS5xdW90ZWQpKTtcbiAgICBjb25zdCBtYXBUeXBlID0gbmV3IE1hcFR5cGUoYXN0LnZhbHVlVHlwZSwgbnVsbCk7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihuZXcgTGl0ZXJhbE1hcEV4cHIoZW50cmllcywgbWFwVHlwZSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQ29tbWFFeHByKHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QucGFydHMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwcnM6IEV4cHJlc3Npb25bXSwgY29udGV4dDogYW55KTogRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gZXhwcnMubWFwKGV4cHIgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBEZWNsYXJlVmFyU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0bXQudmFsdWUgJiYgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IERlY2xhcmVWYXJTdG10KHN0bXQubmFtZSwgdmFsdWUsIHN0bXQudHlwZSwgc3RtdC5tb2RpZmllcnMsIHN0bXQuc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBEZWNsYXJlRnVuY3Rpb25TdG10KFxuICAgICAgICAgICAgc3RtdC5uYW1lLCBzdG10LnBhcmFtcywgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzLCBjb250ZXh0KSwgc3RtdC50eXBlLFxuICAgICAgICAgICAgc3RtdC5tb2RpZmllcnMsIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBFeHByZXNzaW9uU3RhdGVtZW50KHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IFJldHVyblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgUmV0dXJuU3RhdGVtZW50KHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBzdG10LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgcGFyZW50ID0gc3RtdC5wYXJlbnQgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgY29uc3QgZ2V0dGVycyA9IHN0bXQuZ2V0dGVycy5tYXAoXG4gICAgICAgIGdldHRlciA9PiBuZXcgQ2xhc3NHZXR0ZXIoXG4gICAgICAgICAgICBnZXR0ZXIubmFtZSwgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoZ2V0dGVyLmJvZHksIGNvbnRleHQpLCBnZXR0ZXIudHlwZSxcbiAgICAgICAgICAgIGdldHRlci5tb2RpZmllcnMpKTtcbiAgICBjb25zdCBjdG9yTWV0aG9kID0gc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCAmJlxuICAgICAgICBuZXcgQ2xhc3NNZXRob2Qoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5uYW1lLCBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLnBhcmFtcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY29uc3RydWN0b3JNZXRob2QuYm9keSwgY29udGV4dCksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLnR5cGUsIHN0bXQuY29uc3RydWN0b3JNZXRob2QubW9kaWZpZXJzKTtcbiAgICBjb25zdCBtZXRob2RzID0gc3RtdC5tZXRob2RzLm1hcChcbiAgICAgICAgbWV0aG9kID0+IG5ldyBDbGFzc01ldGhvZChcbiAgICAgICAgICAgIG1ldGhvZC5uYW1lLCBtZXRob2QucGFyYW1zLCB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhtZXRob2QuYm9keSwgY29udGV4dCksIG1ldGhvZC50eXBlLFxuICAgICAgICAgICAgbWV0aG9kLm1vZGlmaWVycykpO1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBDbGFzc1N0bXQoXG4gICAgICAgICAgICBzdG10Lm5hbWUsIHBhcmVudCwgc3RtdC5maWVsZHMsIGdldHRlcnMsIGN0b3JNZXRob2QsIG1ldGhvZHMsIHN0bXQubW9kaWZpZXJzLFxuICAgICAgICAgICAgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdElmU3RtdChzdG10OiBJZlN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IElmU3RtdChcbiAgICAgICAgICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5mYWxzZUNhc2UsIGNvbnRleHQpLCBzdG10LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IFRyeUNhdGNoU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgVHJ5Q2F0Y2hTdG10KFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5ib2R5U3RtdHMsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jYXRjaFN0bXRzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFRocm93U3RtdChzdG10OiBUaHJvd1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IFRocm93U3RtdChzdG10LmVycm9yLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IENvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoc3RtdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEpTRG9jQ29tbWVudFN0bXQoc3RtdDogSlNEb2NDb21tZW50U3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KHN0bXQsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzOiBTdGF0ZW1lbnRbXSwgY29udGV4dDogYW55KTogU3RhdGVtZW50W10ge1xuICAgIHJldHVybiBzdG10cy5tYXAoc3RtdCA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQpKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgU3RhdGVtZW50VmlzaXRvciwgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdFR5cGUoYXN0OiBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXN0OyB9XG4gIHZpc2l0RXhwcmVzc2lvbihhc3Q6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlKSB7XG4gICAgICBhc3QudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpOyB9XG4gIHZpc2l0RXhwcmVzc2lvblR5cGUodHlwZTogRXhwcmVzc2lvblR5cGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdHlwZS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgaWYgKHR5cGUudHlwZVBhcmFtcyAhPT0gbnVsbCkge1xuICAgICAgdHlwZS50eXBlUGFyYW1zLmZvckVhY2gocGFyYW0gPT4gdGhpcy52aXNpdFR5cGUocGFyYW0sIGNvbnRleHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpOyB9XG4gIHZpc2l0TWFwVHlwZSh0eXBlOiBNYXBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7IH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGFzdDsgfVxuICB2aXNpdFR5cGVvZkV4cHIoYXN0OiBUeXBlb2ZFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTsgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZVZhckV4cHIoYXN0OiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFdyaXRlS2V5RXhwcihhc3Q6IFdyaXRlS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFdyaXRlUHJvcEV4cHIoYXN0OiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoYXN0OiBJbnZva2VNZXRob2RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNsYXNzRXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlUGFyYW1zKSB7XG4gICAgICBhc3QudHlwZVBhcmFtcy5mb3JFYWNoKHR5cGUgPT4gdHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IENvbmRpdGlvbmFsRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5mYWxzZUNhc2UgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBCaW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnJocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRSZWFkUHJvcEV4cHIoYXN0OiBSZWFkUHJvcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogUmVhZEtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IExpdGVyYWxBcnJheUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5lbnRyaWVzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogTGl0ZXJhbE1hcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmVudHJpZXMuZm9yRWFjaCgoZW50cnkpID0+IGVudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBDb21tYUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5wYXJ0cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBbGxFeHByZXNzaW9ucyhleHByczogRXhwcmVzc2lvbltdLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBleHBycy5mb3JFYWNoKGV4cHIgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBEZWNsYXJlVmFyU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoc3RtdC52YWx1ZSkge1xuICAgICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIGlmIChzdG10LnR5cGUpIHtcbiAgICAgIHN0bXQudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgaWYgKHN0bXQudHlwZSkge1xuICAgICAgc3RtdC50eXBlLnZpc2l0VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IFJldHVyblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogQ2xhc3NTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQucGFyZW50ICEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHN0bXQuZ2V0dGVycy5mb3JFYWNoKGdldHRlciA9PiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhnZXR0ZXIuYm9keSwgY29udGV4dCkpO1xuICAgIGlmIChzdG10LmNvbnN0cnVjdG9yTWV0aG9kKSB7XG4gICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGNvbnRleHQpO1xuICAgIH1cbiAgICBzdG10Lm1ldGhvZHMuZm9yRWFjaChtZXRob2QgPT4gdGhpcy52aXNpdEFsbFN0YXRlbWVudHMobWV0aG9kLmJvZHksIGNvbnRleHQpKTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdElmU3RtdChzdG10OiBJZlN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBUcnlDYXRjaFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5ib2R5U3RtdHMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY2F0Y2hTdG10cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRUaHJvd1N0bXQoc3RtdDogVGhyb3dTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0Q29tbWVudFN0bXQoc3RtdDogQ29tbWVudFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBzdG10OyB9XG4gIHZpc2l0SlNEb2NDb21tZW50U3RtdChzdG10OiBKU0RvY0NvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gc3RtdDsgfVxuICB2aXNpdEFsbFN0YXRlbWVudHMoc3RtdHM6IFN0YXRlbWVudFtdLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBzdG10cy5mb3JFYWNoKHN0bXQgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRSZWFkVmFyTmFtZXMoc3RtdHM6IFN0YXRlbWVudFtdKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9SZWFkVmFyVmlzaXRvcigpO1xuICB2aXNpdG9yLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10cywgbnVsbCk7XG4gIHJldHVybiB2aXNpdG9yLnZhck5hbWVzO1xufVxuXG5jbGFzcyBfUmVhZFZhclZpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgdmFyTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gRG9uJ3QgZGVzY2VuZCBpbnRvIG5lc3RlZCBmdW5jdGlvbnNcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogQ2xhc3NTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIC8vIERvbid0IGRlc2NlbmQgaW50byBuZXN0ZWQgY2xhc3Nlc1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoYXN0Lm5hbWUpIHtcbiAgICAgIHRoaXMudmFyTmFtZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxlY3RFeHRlcm5hbFJlZmVyZW5jZXMoc3RtdHM6IFN0YXRlbWVudFtdKTogRXh0ZXJuYWxSZWZlcmVuY2VbXSB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0ZpbmRFeHRlcm5hbFJlZmVyZW5jZXNWaXNpdG9yKCk7XG4gIHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzLCBudWxsKTtcbiAgcmV0dXJuIHZpc2l0b3IuZXh0ZXJuYWxSZWZlcmVuY2VzO1xufVxuXG5jbGFzcyBfRmluZEV4dGVybmFsUmVmZXJlbmNlc1Zpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgZXh0ZXJuYWxSZWZlcmVuY2VzOiBFeHRlcm5hbFJlZmVyZW5jZVtdID0gW107XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGU6IEV4dGVybmFsRXhwciwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5leHRlcm5hbFJlZmVyZW5jZXMucHVzaChlLnZhbHVlKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRFeHRlcm5hbEV4cHIoZSwgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgc3RtdDogU3RhdGVtZW50LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogU3RhdGVtZW50IHtcbiAgaWYgKCFzb3VyY2VTcGFuKSB7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgX0FwcGx5U291cmNlU3BhblRyYW5zZm9ybWVyKHNvdXJjZVNwYW4pO1xuICByZXR1cm4gc3RtdC52aXNpdFN0YXRlbWVudCh0cmFuc2Zvcm1lciwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVNvdXJjZVNwYW5Ub0V4cHJlc3Npb25JZk5lZWRlZChcbiAgICBleHByOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogRXhwcmVzc2lvbiB7XG4gIGlmICghc291cmNlU3Bhbikge1xuICAgIHJldHVybiBleHByO1xuICB9XG4gIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IF9BcHBseVNvdXJjZVNwYW5UcmFuc2Zvcm1lcihzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGV4cHIudmlzaXRFeHByZXNzaW9uKHRyYW5zZm9ybWVyLCBudWxsKTtcbn1cblxuY2xhc3MgX0FwcGx5U291cmNlU3BhblRyYW5zZm9ybWVyIGV4dGVuZHMgQXN0VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbikgeyBzdXBlcigpOyB9XG4gIHByaXZhdGUgX2Nsb25lKG9iajogYW55KTogYW55IHtcbiAgICBjb25zdCBjbG9uZSA9IE9iamVjdC5jcmVhdGUob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG4gICAgZm9yIChsZXQgcHJvcCBpbiBvYmopIHtcbiAgICAgIGNsb25lW3Byb3BdID0gb2JqW3Byb3BdO1xuICAgIH1cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICB0cmFuc2Zvcm1FeHByKGV4cHI6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IEV4cHJlc3Npb24ge1xuICAgIGlmICghZXhwci5zb3VyY2VTcGFuKSB7XG4gICAgICBleHByID0gdGhpcy5fY2xvbmUoZXhwcik7XG4gICAgICBleHByLnNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW47XG4gICAgfVxuICAgIHJldHVybiBleHByO1xuICB9XG5cbiAgdHJhbnNmb3JtU3RtdChzdG10OiBTdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IFN0YXRlbWVudCB7XG4gICAgaWYgKCFzdG10LnNvdXJjZVNwYW4pIHtcbiAgICAgIHN0bXQgPSB0aGlzLl9jbG9uZShzdG10KTtcbiAgICAgIHN0bXQuc291cmNlU3BhbiA9IHRoaXMuc291cmNlU3BhbjtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhcmlhYmxlKFxuICAgIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGUgfCBudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCk6IFJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG5ldyBSZWFkVmFyRXhwcihuYW1lLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydEV4cHIoXG4gICAgaWQ6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlUGFyYW1zOiBUeXBlW10gfCBudWxsID0gbnVsbCxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCk6IEV4dGVybmFsRXhwciB7XG4gIHJldHVybiBuZXcgRXh0ZXJuYWxFeHByKGlkLCBudWxsLCB0eXBlUGFyYW1zLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydFR5cGUoXG4gICAgaWQ6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlUGFyYW1zOiBUeXBlW10gfCBudWxsID0gbnVsbCxcbiAgICB0eXBlTW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXSB8IG51bGwgPSBudWxsKTogRXhwcmVzc2lvblR5cGV8bnVsbCB7XG4gIHJldHVybiBpZCAhPSBudWxsID8gZXhwcmVzc2lvblR5cGUoaW1wb3J0RXhwcihpZCwgdHlwZVBhcmFtcywgbnVsbCksIHR5cGVNb2RpZmllcnMpIDogbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4cHJlc3Npb25UeXBlKFxuICAgIGV4cHI6IEV4cHJlc3Npb24sIHR5cGVNb2RpZmllcnM6IFR5cGVNb2RpZmllcltdIHwgbnVsbCA9IG51bGwsXG4gICAgdHlwZVBhcmFtczogVHlwZVtdIHwgbnVsbCA9IG51bGwpOiBFeHByZXNzaW9uVHlwZSB7XG4gIHJldHVybiBuZXcgRXhwcmVzc2lvblR5cGUoZXhwciwgdHlwZU1vZGlmaWVycywgdHlwZVBhcmFtcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0eXBlb2ZFeHByKGV4cHI6IEV4cHJlc3Npb24pIHtcbiAgcmV0dXJuIG5ldyBUeXBlb2ZFeHByKGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbEFycihcbiAgICB2YWx1ZXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGUgfCBudWxsLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogTGl0ZXJhbEFycmF5RXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5RXhwcih2YWx1ZXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbE1hcChcbiAgICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogRXhwcmVzc2lvbn1bXSxcbiAgICB0eXBlOiBNYXBUeXBlIHwgbnVsbCA9IG51bGwpOiBMaXRlcmFsTWFwRXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbE1hcEV4cHIoXG4gICAgICB2YWx1ZXMubWFwKGUgPT4gbmV3IExpdGVyYWxNYXBFbnRyeShlLmtleSwgZS52YWx1ZSwgZS5xdW90ZWQpKSwgdHlwZSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3QoZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiB8IG51bGwpOiBOb3RFeHByIHtcbiAgcmV0dXJuIG5ldyBOb3RFeHByKGV4cHIsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90TnVsbChcbiAgICBleHByOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCk6IEFzc2VydE5vdE51bGwge1xuICByZXR1cm4gbmV3IEFzc2VydE5vdE51bGwoZXhwciwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmbihcbiAgICBwYXJhbXM6IEZuUGFyYW1bXSwgYm9keTogU3RhdGVtZW50W10sIHR5cGU/OiBUeXBlIHwgbnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiB8IG51bGwsXG4gICAgbmFtZT86IHN0cmluZyB8IG51bGwpOiBGdW5jdGlvbkV4cHIge1xuICByZXR1cm4gbmV3IEZ1bmN0aW9uRXhwcihwYXJhbXMsIGJvZHksIHR5cGUsIHNvdXJjZVNwYW4sIG5hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaWZTdG10KGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgdGhlbkNsYXVzZTogU3RhdGVtZW50W10sIGVsc2VDbGF1c2U/OiBTdGF0ZW1lbnRbXSkge1xuICByZXR1cm4gbmV3IElmU3RtdChjb25kaXRpb24sIHRoZW5DbGF1c2UsIGVsc2VDbGF1c2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbChcbiAgICB2YWx1ZTogYW55LCB0eXBlPzogVHlwZSB8IG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogTGl0ZXJhbEV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHZhbHVlLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTnVsbChleHA6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgcmV0dXJuIGV4cCBpbnN0YW5jZW9mIExpdGVyYWxFeHByICYmIGV4cC52YWx1ZSA9PT0gbnVsbDtcbn1cblxuLy8gVGhlIGxpc3Qgb2YgSlNEb2MgdGFncyB0aGF0IHdlIGN1cnJlbnRseSBzdXBwb3J0LiBFeHRlbmQgaXQgaWYgbmVlZGVkLlxuZXhwb3J0IGNvbnN0IGVudW0gSlNEb2NUYWdOYW1lIHtcbiAgRGVzYyA9ICdkZXNjJyxcbiAgSWQgPSAnaWQnLFxuICBNZWFuaW5nID0gJ21lYW5pbmcnLFxufVxuXG4vKlxuICogVHlwZVNjcmlwdCBoYXMgYW4gQVBJIGZvciBKU0RvYyBhbHJlYWR5LCBidXQgaXQncyBub3QgZXhwb3NlZC5cbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNzM5M1xuICogRm9yIG5vdyB3ZSBjcmVhdGUgdHlwZXMgdGhhdCBhcmUgc2ltaWxhciB0byB0aGVpcnMgc28gdGhhdCBtaWdyYXRpbmdcbiAqIHRvIHRoZWlyIEFQSSB3aWxsIGJlIGVhc2llci4gU2VlIGUuZy4gYHRzLkpTRG9jVGFnYCBhbmQgYHRzLkpTRG9jQ29tbWVudGAuXG4gKi9cbmV4cG9ydCB0eXBlIEpTRG9jVGFnID0ge1xuICAvLyBgdGFnTmFtZWAgaXMgZS5nLiBcInBhcmFtXCIgaW4gYW4gYEBwYXJhbWAgZGVjbGFyYXRpb25cbiAgdGFnTmFtZTogSlNEb2NUYWdOYW1lIHwgc3RyaW5nLFxuICAvLyBBbnkgcmVtYWluaW5nIHRleHQgb24gdGhlIHRhZywgZS5nLiB0aGUgZGVzY3JpcHRpb25cbiAgdGV4dD86IHN0cmluZyxcbn0gfCB7XG4gIC8vIG5vIGB0YWdOYW1lYCBmb3IgcGxhaW4gdGV4dCBkb2N1bWVudGF0aW9uIHRoYXQgb2NjdXJzIGJlZm9yZSBhbnkgYEBwYXJhbWAgbGluZXNcbiAgdGFnTmFtZT86IHVuZGVmaW5lZCxcbiAgdGV4dDogc3RyaW5nLFxufTtcblxuLypcbiAqIFNlcmlhbGl6ZXMgYSBgVGFnYCBpbnRvIGEgc3RyaW5nLlxuICogUmV0dXJucyBhIHN0cmluZyBsaWtlIFwiIEBmb28ge2Jhcn0gYmF6XCIgKG5vdGUgdGhlIGxlYWRpbmcgd2hpdGVzcGFjZSBiZWZvcmUgYEBmb29gKS5cbiAqL1xuZnVuY3Rpb24gdGFnVG9TdHJpbmcodGFnOiBKU0RvY1RhZyk6IHN0cmluZyB7XG4gIGxldCBvdXQgPSAnJztcbiAgaWYgKHRhZy50YWdOYW1lKSB7XG4gICAgb3V0ICs9IGAgQCR7dGFnLnRhZ05hbWV9YDtcbiAgfVxuICBpZiAodGFnLnRleHQpIHtcbiAgICBpZiAodGFnLnRleHQubWF0Y2goL1xcL1xcKnxcXCpcXC8vKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdKU0RvYyB0ZXh0IGNhbm5vdCBjb250YWluIFwiLypcIiBhbmQgXCIqL1wiJyk7XG4gICAgfVxuICAgIG91dCArPSAnICcgKyB0YWcudGV4dC5yZXBsYWNlKC9AL2csICdcXFxcQCcpO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVRhZ3ModGFnczogSlNEb2NUYWdbXSk6IHN0cmluZyB7XG4gIGlmICh0YWdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xuXG4gIGxldCBvdXQgPSAnKlxcbic7XG4gIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICBvdXQgKz0gJyAqJztcbiAgICAvLyBJZiB0aGUgdGFnVG9TdHJpbmcgaXMgbXVsdGktbGluZSwgaW5zZXJ0IFwiICogXCIgcHJlZml4ZXMgb24gc3Vic2VxdWVudCBsaW5lcy5cbiAgICBvdXQgKz0gdGFnVG9TdHJpbmcodGFnKS5yZXBsYWNlKC9cXG4vZywgJ1xcbiAqICcpO1xuICAgIG91dCArPSAnXFxuJztcbiAgfVxuICBvdXQgKz0gJyAnO1xuICByZXR1cm4gb3V0O1xufVxuIl19