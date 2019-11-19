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
    constructor(fn, args, type, sourceSpan, pure = false) {
        super(type, sourceSpan);
        this.fn = fn;
        this.args = args;
        this.pure = pure;
    }
    isEquivalent(e) {
        return e instanceof InvokeFunctionExpr && this.fn.isEquivalent(e.fn) &&
            areAllEquivalent(this.args, e.args) && this.pure === e.pure;
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
export class LocalizedString extends Expression {
    constructor(metaBlock, messageParts, placeHolderNames, expressions, sourceSpan) {
        super(STRING_TYPE, sourceSpan);
        this.metaBlock = metaBlock;
        this.messageParts = messageParts;
        this.placeHolderNames = placeHolderNames;
        this.expressions = expressions;
    }
    isEquivalent(e) {
        // return e instanceof LocalizedString && this.message === e.message;
        return false;
    }
    isConstant() { return false; }
    visitExpression(visitor, context) {
        return visitor.visitLocalizedString(this, context);
    }
    /**
     * Serialize the given `meta` and `messagePart` into "cooked" and "raw" strings that can be used
     * in a `$localize` tagged string. The format of the metadata is the same as that parsed by
     * `parseI18nMeta()`.
     *
     * @param meta The metadata to serialize
     * @param messagePart The first part of the tagged string
     */
    serializeI18nHead() {
        let metaBlock = this.metaBlock.description || '';
        if (this.metaBlock.meaning) {
            metaBlock = `${this.metaBlock.meaning}|${metaBlock}`;
        }
        if (this.metaBlock.customId || this.metaBlock.legacyId) {
            metaBlock = `${metaBlock}@@${this.metaBlock.customId || this.metaBlock.legacyId}`;
        }
        return createCookedRawString(metaBlock, this.messageParts[0]);
    }
    /**
     * Serialize the given `placeholderName` and `messagePart` into "cooked" and "raw" strings that
     * can be used in a `$localize` tagged string.
     *
     * @param placeholderName The placeholder name to serialize
     * @param messagePart The following message string after this placeholder
     */
    serializeI18nTemplatePart(partIndex) {
        const placeholderName = this.placeHolderNames[partIndex - 1];
        const messagePart = this.messageParts[partIndex];
        return createCookedRawString(placeholderName, messagePart);
    }
}
const escapeSlashes = (str) => str.replace(/\\/g, '\\\\');
const escapeStartingColon = (str) => str.replace(/^:/, '\\:');
const escapeColons = (str) => str.replace(/:/g, '\\:');
const escapeForMessagePart = (str) => str.replace(/`/g, '\\`').replace(/\${/g, '$\\{');
/**
 * Creates a `{cooked, raw}` object from the `metaBlock` and `messagePart`.
 *
 * The `raw` text must have various character sequences escaped:
 * * "\" would otherwise indicate that the next character is a control character.
 * * "`" and "${" are template string control sequences that would otherwise prematurely indicate
 *   the end of a message part.
 * * ":" inside a metablock would prematurely indicate the end of the metablock.
 * * ":" at the start of a messagePart with no metablock would erroneously indicate the start of a
 *   metablock.
 *
 * @param metaBlock Any metadata that should be prepended to the string
 * @param messagePart The message part of the string
 */
function createCookedRawString(metaBlock, messagePart) {
    if (metaBlock === '') {
        return {
            cooked: messagePart,
            raw: escapeForMessagePart(escapeStartingColon(escapeSlashes(messagePart)))
        };
    }
    else {
        return {
            cooked: `:${metaBlock}:${messagePart}`,
            raw: escapeForMessagePart(`:${escapeColons(escapeSlashes(metaBlock))}:${escapeSlashes(messagePart)}`)
        };
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
    visitLocalizedString(ast, context) {
        return this.transformExpr(new LocalizedString(ast.metaBlock, ast.messageParts, ast.placeHolderNames, this.visitAllExpressions(ast.expressions, context), ast.sourceSpan), context);
    }
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
    visitLocalizedString(ast, context) {
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
        for (let prop of Object.keys(obj)) {
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
export function localizedString(metaBlock, messageParts, placeholderNames, expressions, sourceSpan) {
    return new LocalizedString(metaBlock, messageParts, placeholderNames, expressions, sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFPSCxVQUFVO0FBQ1YsTUFBTSxDQUFOLElBQVksWUFFWDtBQUZELFdBQVksWUFBWTtJQUN0QixpREFBSyxDQUFBO0FBQ1AsQ0FBQyxFQUZXLFlBQVksS0FBWixZQUFZLFFBRXZCO0FBRUQsTUFBTSxPQUFnQixJQUFJO0lBQ3hCLFlBQW1CLFlBQWlDLElBQUk7UUFBckMsY0FBUyxHQUFULFNBQVMsQ0FBNEI7UUFDdEQsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNkLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO1NBQ3JCO0lBQ0gsQ0FBQztJQUdELFdBQVcsQ0FBQyxRQUFzQixJQUFhLE9BQU8sSUFBSSxDQUFDLFNBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25HO0FBRUQsTUFBTSxDQUFOLElBQVksZUFTWDtBQVRELFdBQVksZUFBZTtJQUN6QiwyREFBTyxDQUFBO0lBQ1AscURBQUksQ0FBQTtJQUNKLHlEQUFNLENBQUE7SUFDTixtREFBRyxDQUFBO0lBQ0gseURBQU0sQ0FBQTtJQUNOLDZEQUFRLENBQUE7SUFDUiw2REFBUSxDQUFBO0lBQ1IscURBQUksQ0FBQTtBQUNOLENBQUMsRUFUVyxlQUFlLEtBQWYsZUFBZSxRQVMxQjtBQUVELE1BQU0sT0FBTyxXQUFZLFNBQVEsSUFBSTtJQUNuQyxZQUFtQixJQUFxQixFQUFFLFlBQWlDLElBQUk7UUFDN0UsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBREEsU0FBSSxHQUFKLElBQUksQ0FBaUI7SUFFeEMsQ0FBQztJQUNELFNBQVMsQ0FBQyxPQUFvQixFQUFFLE9BQVk7UUFDMUMs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Q0FBQztJQUN2RixDQUFDO0lBQ0QsWUFBWSxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUM3RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBQ0QsS0FBSyxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUN0RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBQ0QsSUFBSSxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUNyRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBQ0QsTUFBTSxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUN2RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBQ0QsUUFBUSxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUN6RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN0RixDQUFDO0lBQ0QsTUFBTSxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUN2RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBQ0QsR0FBRyxDQUFDLEdBQWUsRUFBRSxVQUFpQztRQUNwRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLEdBQUcs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O0lBQ2hCLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1FBQ3RCLEdBQUcsSUFBSSxJQUFJLENBQUM7UUFDWiwrRUFBK0U7UUFDL0UsR0FBRyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELEdBQUcsSUFBSSxJQUFJLENBQUM7S0FDYjtJQUNELEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDWCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJMThuTWV0YX0gZnJvbSAnLi4vcmVuZGVyMy92aWV3L2kxOG4vbWV0YSc7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi91dGlsJztcblxuLy8vLyBUeXBlc1xuZXhwb3J0IGVudW0gVHlwZU1vZGlmaWVyIHtcbiAgQ29uc3Rcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXXxudWxsID0gbnVsbCkge1xuICAgIGlmICghbW9kaWZpZXJzKSB7XG4gICAgICB0aGlzLm1vZGlmaWVycyA9IFtdO1xuICAgIH1cbiAgfVxuICBhYnN0cmFjdCB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICBoYXNNb2RpZmllcihtb2RpZmllcjogVHlwZU1vZGlmaWVyKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm1vZGlmaWVycyAhLmluZGV4T2YobW9kaWZpZXIpICE9PSAtMTsgfVxufVxuXG5leHBvcnQgZW51bSBCdWlsdGluVHlwZU5hbWUge1xuICBEeW5hbWljLFxuICBCb29sLFxuICBTdHJpbmcsXG4gIEludCxcbiAgTnVtYmVyLFxuICBGdW5jdGlvbixcbiAgSW5mZXJyZWQsXG4gIE5vbmUsXG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogQnVpbHRpblR5cGVOYW1lLCBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCdWlsdGluVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhwcmVzc2lvblR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIG1vZGlmaWVyczogVHlwZU1vZGlmaWVyW118bnVsbCA9IG51bGwsXG4gICAgICBwdWJsaWMgdHlwZVBhcmFtczogVHlwZVtdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHByZXNzaW9uVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBBcnJheVR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG9mIDogVHlwZSwgbW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXXxudWxsID0gbnVsbCkgeyBzdXBlcihtb2RpZmllcnMpOyB9XG4gIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFycmF5VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBNYXBUeXBlIGV4dGVuZHMgVHlwZSB7XG4gIHB1YmxpYyB2YWx1ZVR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IodmFsdWVUeXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgICB0aGlzLnZhbHVlVHlwZSA9IHZhbHVlVHlwZSB8fCBudWxsO1xuICB9XG4gIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRNYXBUeXBlKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjb25zdCBEWU5BTUlDX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkR5bmFtaWMpO1xuZXhwb3J0IGNvbnN0IElORkVSUkVEX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkluZmVycmVkKTtcbmV4cG9ydCBjb25zdCBCT09MX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkJvb2wpO1xuZXhwb3J0IGNvbnN0IElOVF9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5JbnQpO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5OdW1iZXIpO1xuZXhwb3J0IGNvbnN0IFNUUklOR19UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5TdHJpbmcpO1xuZXhwb3J0IGNvbnN0IEZVTkNUSU9OX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkZ1bmN0aW9uKTtcbmV4cG9ydCBjb25zdCBOT05FX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLk5vbmUpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVWaXNpdG9yIHtcbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cHJlc3Npb25UeXBlKHR5cGU6IEV4cHJlc3Npb25UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vLy8vLyBFeHByZXNzaW9uc1xuXG5leHBvcnQgZW51bSBCaW5hcnlPcGVyYXRvciB7XG4gIEVxdWFscyxcbiAgTm90RXF1YWxzLFxuICBJZGVudGljYWwsXG4gIE5vdElkZW50aWNhbCxcbiAgTWludXMsXG4gIFBsdXMsXG4gIERpdmlkZSxcbiAgTXVsdGlwbHksXG4gIE1vZHVsbyxcbiAgQW5kLFxuICBPcixcbiAgQml0d2lzZUFuZCxcbiAgTG93ZXIsXG4gIExvd2VyRXF1YWxzLFxuICBCaWdnZXIsXG4gIEJpZ2dlckVxdWFsc1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbnVsbFNhZmVJc0VxdWl2YWxlbnQ8VCBleHRlbmRze2lzRXF1aXZhbGVudChvdGhlcjogVCk6IGJvb2xlYW59PihcbiAgICBiYXNlOiBUIHwgbnVsbCwgb3RoZXI6IFQgfCBudWxsKSB7XG4gIGlmIChiYXNlID09IG51bGwgfHwgb3RoZXIgPT0gbnVsbCkge1xuICAgIHJldHVybiBiYXNlID09IG90aGVyO1xuICB9XG4gIHJldHVybiBiYXNlLmlzRXF1aXZhbGVudChvdGhlcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmVBbGxFcXVpdmFsZW50PFQgZXh0ZW5kc3tpc0VxdWl2YWxlbnQob3RoZXI6IFQpOiBib29sZWFufT4oXG4gICAgYmFzZTogVFtdLCBvdGhlcjogVFtdKSB7XG4gIGNvbnN0IGxlbiA9IGJhc2UubGVuZ3RoO1xuICBpZiAobGVuICE9PSBvdGhlci5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghYmFzZVtpXS5pc0VxdWl2YWxlbnQob3RoZXJbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcblxuICBjb25zdHJ1Y3Rvcih0eXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VTcGFuID0gc291cmNlU3BhbiB8fCBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIGV4cHJlc3Npb24gcHJvZHVjZXMgdGhlIHNhbWUgdmFsdWUgYXMgdGhlIGdpdmVuIGV4cHJlc3Npb24uXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIGNvbnN0YW50LlxuICAgKi9cbiAgYWJzdHJhY3QgaXNDb25zdGFudCgpOiBib29sZWFuO1xuXG4gIHByb3AobmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgUmVhZFByb3BFeHByKHRoaXMsIG5hbWUsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAga2V5KGluZGV4OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWFkS2V5RXhwcih0aGlzLCBpbmRleCwgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjYWxsTWV0aG9kKG5hbWU6IHN0cmluZ3xCdWlsdGluTWV0aG9kLCBwYXJhbXM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTpcbiAgICAgIEludm9rZU1ldGhvZEV4cHIge1xuICAgIHJldHVybiBuZXcgSW52b2tlTWV0aG9kRXhwcih0aGlzLCBuYW1lLCBwYXJhbXMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgY2FsbEZuKHBhcmFtczogRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBJbnZva2VGdW5jdGlvbkV4cHIge1xuICAgIHJldHVybiBuZXcgSW52b2tlRnVuY3Rpb25FeHByKHRoaXMsIHBhcmFtcywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpbnN0YW50aWF0ZShwYXJhbXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTpcbiAgICAgIEluc3RhbnRpYXRlRXhwciB7XG4gICAgcmV0dXJuIG5ldyBJbnN0YW50aWF0ZUV4cHIodGhpcywgcGFyYW1zLCB0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGNvbmRpdGlvbmFsKFxuICAgICAgdHJ1ZUNhc2U6IEV4cHJlc3Npb24sIGZhbHNlQ2FzZTogRXhwcmVzc2lvbnxudWxsID0gbnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IENvbmRpdGlvbmFsRXhwciB7XG4gICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbEV4cHIodGhpcywgdHJ1ZUNhc2UsIGZhbHNlQ2FzZSwgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBlcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBub3RFcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk5vdEVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpZGVudGljYWwocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBub3RJZGVudGljYWwocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBtaW51cyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTWludXMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgcGx1cyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuUGx1cywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBkaXZpZGUocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkRpdmlkZSwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBtdWx0aXBseShyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHksIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbW9kdWxvKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Nb2R1bG8sIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYW5kKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5BbmQsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYml0d2lzZUFuZChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcGFyZW5zOiBib29sZWFuID0gdHJ1ZSk6XG4gICAgICBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkJpdHdpc2VBbmQsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3BhbiwgcGFyZW5zKTtcbiAgfVxuICBvcihyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuT3IsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbG93ZXIocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkxvd2VyLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGxvd2VyRXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Mb3dlckVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBiaWdnZXIocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkJpZ2dlciwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBiaWdnZXJFcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0JsYW5rKHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEV4cHJlc3Npb24ge1xuICAgIC8vIE5vdGU6IFdlIHVzZSBlcXVhbHMgYnkgcHVycG9zZSBoZXJlIHRvIGNvbXBhcmUgdG8gbnVsbCBhbmQgdW5kZWZpbmVkIGluIEpTLlxuICAgIC8vIFdlIHVzZSB0aGUgdHlwZWQgbnVsbCB0byBhbGxvdyBzdHJpY3ROdWxsQ2hlY2tzIHRvIG5hcnJvdyB0eXBlcy5cbiAgICByZXR1cm4gdGhpcy5lcXVhbHMoVFlQRURfTlVMTF9FWFBSLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBjYXN0KHR5cGU6IFR5cGUsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEV4cHJlc3Npb24ge1xuICAgIHJldHVybiBuZXcgQ2FzdEV4cHIodGhpcywgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICB0b1N0bXQoKTogU3RhdGVtZW50IHsgcmV0dXJuIG5ldyBFeHByZXNzaW9uU3RhdGVtZW50KHRoaXMsIG51bGwpOyB9XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWx0aW5WYXIge1xuICBUaGlzLFxuICBTdXBlcixcbiAgQ2F0Y2hFcnJvcixcbiAgQ2F0Y2hTdGFja1xufVxuXG5leHBvcnQgY2xhc3MgUmVhZFZhckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsO1xuICBwdWJsaWMgYnVpbHRpbjogQnVpbHRpblZhcnxudWxsO1xuXG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZ3xCdWlsdGluVmFyLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgdGhpcy5idWlsdGluID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5uYW1lID0gbnVsbDtcbiAgICAgIHRoaXMuYnVpbHRpbiA9IG5hbWU7XG4gICAgfVxuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlYWRWYXJFeHByICYmIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMuYnVpbHRpbiA9PT0gZS5idWlsdGluO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVhZFZhckV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZVZhckV4cHIge1xuICAgIGlmICghdGhpcy5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJ1aWx0IGluIHZhcmlhYmxlICR7dGhpcy5idWlsdGlufSBjYW4gbm90IGJlIGFzc2lnbmVkIHRvLmApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFdyaXRlVmFyRXhwcih0aGlzLm5hbWUsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUeXBlb2ZFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBleHByOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUeXBlb2ZFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFR5cGVvZkV4cHIgJiYgZS5leHByLmlzRXF1aXZhbGVudCh0aGlzLmV4cHIpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuZXhwci5pc0NvbnN0YW50KCk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFdyYXBwZWROb2RlRXhwcjxUPiBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbm9kZTogVCwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgV3JhcHBlZE5vZGVFeHByICYmIHRoaXMubm9kZSA9PT0gZS5ub2RlO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JhcHBlZE5vZGVFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXcml0ZVZhckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZVZhckV4cHIgJiYgdGhpcy5uYW1lID09PSBlLm5hbWUgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcml0ZVZhckV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICB0b0RlY2xTdG10KHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVycz86IFN0bXRNb2RpZmllcltdfG51bGwpOiBEZWNsYXJlVmFyU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlVmFyU3RtdCh0aGlzLm5hbWUsIHRoaXMudmFsdWUsIHR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvQ29uc3REZWNsKCk6IERlY2xhcmVWYXJTdG10IHsgcmV0dXJuIHRoaXMudG9EZWNsU3RtdChJTkZFUlJFRF9UWVBFLCBbU3RtdE1vZGlmaWVyLkZpbmFsXSk7IH1cbn1cblxuXG5leHBvcnQgY2xhc3MgV3JpdGVLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBpbmRleDogRXhwcmVzc2lvbiwgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZUtleUV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5pbmRleC5pc0VxdWl2YWxlbnQoZS5pbmRleCkgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcml0ZUtleUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgV3JpdGVQcm9wRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb247XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBwdWJsaWMgbmFtZTogc3RyaW5nLCB2YWx1ZTogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlUHJvcEV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5uYW1lID09PSBlLm5hbWUgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcml0ZVByb3BFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWx0aW5NZXRob2Qge1xuICBDb25jYXRBcnJheSxcbiAgU3Vic2NyaWJlT2JzZXJ2YWJsZSxcbiAgQmluZFxufVxuXG5leHBvcnQgY2xhc3MgSW52b2tlTWV0aG9kRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGw7XG4gIHB1YmxpYyBidWlsdGluOiBCdWlsdGluTWV0aG9kfG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBtZXRob2Q6IHN0cmluZ3xCdWlsdGluTWV0aG9kLCBwdWJsaWMgYXJnczogRXhwcmVzc2lvbltdLFxuICAgICAgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGVvZiBtZXRob2QgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLm5hbWUgPSBtZXRob2Q7XG4gICAgICB0aGlzLmJ1aWx0aW4gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm5hbWUgPSBudWxsO1xuICAgICAgdGhpcy5idWlsdGluID0gPEJ1aWx0aW5NZXRob2Q+bWV0aG9kO1xuICAgIH1cbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBJbnZva2VNZXRob2RFeHByICYmIHRoaXMucmVjZWl2ZXIuaXNFcXVpdmFsZW50KGUucmVjZWl2ZXIpICYmXG4gICAgICAgIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMuYnVpbHRpbiA9PT0gZS5idWlsdGluICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SW52b2tlTWV0aG9kRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBJbnZva2VGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZm46IEV4cHJlc3Npb24sIHB1YmxpYyBhcmdzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBwdXJlID0gZmFsc2UpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBJbnZva2VGdW5jdGlvbkV4cHIgJiYgdGhpcy5mbi5pc0VxdWl2YWxlbnQoZS5mbikgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmFyZ3MsIGUuYXJncykgJiYgdGhpcy5wdXJlID09PSBlLnB1cmU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnZva2VGdW5jdGlvbkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgSW5zdGFudGlhdGVFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNsYXNzRXhwcjogRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEluc3RhbnRpYXRlRXhwciAmJiB0aGlzLmNsYXNzRXhwci5pc0VxdWl2YWxlbnQoZS5jbGFzc0V4cHIpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SW5zdGFudGlhdGVFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBudW1iZXJ8c3RyaW5nfGJvb2xlYW58bnVsbHx1bmRlZmluZWQsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBMaXRlcmFsRXhwciAmJiB0aGlzLnZhbHVlID09PSBlLnZhbHVlO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIHRydWU7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBMb2NhbGl6ZWRTdHJpbmcgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBtZXRhQmxvY2s6IEkxOG5NZXRhLCByZWFkb25seSBtZXNzYWdlUGFydHM6IHN0cmluZ1tdLFxuICAgICAgcmVhZG9ubHkgcGxhY2VIb2xkZXJOYW1lczogc3RyaW5nW10sIHJlYWRvbmx5IGV4cHJlc3Npb25zOiBFeHByZXNzaW9uW10sXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihTVFJJTkdfVFlQRSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIC8vIHJldHVybiBlIGluc3RhbmNlb2YgTG9jYWxpemVkU3RyaW5nICYmIHRoaXMubWVzc2FnZSA9PT0gZS5tZXNzYWdlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExvY2FsaXplZFN0cmluZyh0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBtZXRhYCBhbmQgYG1lc3NhZ2VQYXJ0YCBpbnRvIFwiY29va2VkXCIgYW5kIFwicmF3XCIgc3RyaW5ncyB0aGF0IGNhbiBiZSB1c2VkXG4gICAqIGluIGEgYCRsb2NhbGl6ZWAgdGFnZ2VkIHN0cmluZy4gVGhlIGZvcm1hdCBvZiB0aGUgbWV0YWRhdGEgaXMgdGhlIHNhbWUgYXMgdGhhdCBwYXJzZWQgYnlcbiAgICogYHBhcnNlSTE4bk1ldGEoKWAuXG4gICAqXG4gICAqIEBwYXJhbSBtZXRhIFRoZSBtZXRhZGF0YSB0byBzZXJpYWxpemVcbiAgICogQHBhcmFtIG1lc3NhZ2VQYXJ0IFRoZSBmaXJzdCBwYXJ0IG9mIHRoZSB0YWdnZWQgc3RyaW5nXG4gICAqL1xuICBzZXJpYWxpemVJMThuSGVhZCgpOiB7Y29va2VkOiBzdHJpbmcsIHJhdzogc3RyaW5nfSB7XG4gICAgbGV0IG1ldGFCbG9jayA9IHRoaXMubWV0YUJsb2NrLmRlc2NyaXB0aW9uIHx8ICcnO1xuICAgIGlmICh0aGlzLm1ldGFCbG9jay5tZWFuaW5nKSB7XG4gICAgICBtZXRhQmxvY2sgPSBgJHt0aGlzLm1ldGFCbG9jay5tZWFuaW5nfXwke21ldGFCbG9ja31gO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZXRhQmxvY2suY3VzdG9tSWQgfHwgdGhpcy5tZXRhQmxvY2subGVnYWN5SWQpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja31AQCR7dGhpcy5tZXRhQmxvY2suY3VzdG9tSWQgfHwgdGhpcy5tZXRhQmxvY2subGVnYWN5SWR9YDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhtZXRhQmxvY2ssIHRoaXMubWVzc2FnZVBhcnRzWzBdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBwbGFjZWhvbGRlck5hbWVgIGFuZCBgbWVzc2FnZVBhcnRgIGludG8gXCJjb29rZWRcIiBhbmQgXCJyYXdcIiBzdHJpbmdzIHRoYXRcbiAgICogY2FuIGJlIHVzZWQgaW4gYSBgJGxvY2FsaXplYCB0YWdnZWQgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXJOYW1lIFRoZSBwbGFjZWhvbGRlciBuYW1lIHRvIHNlcmlhbGl6ZVxuICAgKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZvbGxvd2luZyBtZXNzYWdlIHN0cmluZyBhZnRlciB0aGlzIHBsYWNlaG9sZGVyXG4gICAqL1xuICBzZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KHBhcnRJbmRleDogbnVtYmVyKToge2Nvb2tlZDogc3RyaW5nLCByYXc6IHN0cmluZ30ge1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyTmFtZSA9IHRoaXMucGxhY2VIb2xkZXJOYW1lc1twYXJ0SW5kZXggLSAxXTtcbiAgICBjb25zdCBtZXNzYWdlUGFydCA9IHRoaXMubWVzc2FnZVBhcnRzW3BhcnRJbmRleF07XG4gICAgcmV0dXJuIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhwbGFjZWhvbGRlck5hbWUsIG1lc3NhZ2VQYXJ0KTtcbiAgfVxufVxuXG5jb25zdCBlc2NhcGVTbGFzaGVzID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+IHN0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpO1xuY29uc3QgZXNjYXBlU3RhcnRpbmdDb2xvbiA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUNvbG9ucyA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUZvck1lc3NhZ2VQYXJ0ID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgc3RyLnJlcGxhY2UoL2AvZywgJ1xcXFxgJykucmVwbGFjZSgvXFwkey9nLCAnJFxcXFx7Jyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGB7Y29va2VkLCByYXd9YCBvYmplY3QgZnJvbSB0aGUgYG1ldGFCbG9ja2AgYW5kIGBtZXNzYWdlUGFydGAuXG4gKlxuICogVGhlIGByYXdgIHRleHQgbXVzdCBoYXZlIHZhcmlvdXMgY2hhcmFjdGVyIHNlcXVlbmNlcyBlc2NhcGVkOlxuICogKiBcIlxcXCIgd291bGQgb3RoZXJ3aXNlIGluZGljYXRlIHRoYXQgdGhlIG5leHQgY2hhcmFjdGVyIGlzIGEgY29udHJvbCBjaGFyYWN0ZXIuXG4gKiAqIFwiYFwiIGFuZCBcIiR7XCIgYXJlIHRlbXBsYXRlIHN0cmluZyBjb250cm9sIHNlcXVlbmNlcyB0aGF0IHdvdWxkIG90aGVyd2lzZSBwcmVtYXR1cmVseSBpbmRpY2F0ZVxuICogICB0aGUgZW5kIG9mIGEgbWVzc2FnZSBwYXJ0LlxuICogKiBcIjpcIiBpbnNpZGUgYSBtZXRhYmxvY2sgd291bGQgcHJlbWF0dXJlbHkgaW5kaWNhdGUgdGhlIGVuZCBvZiB0aGUgbWV0YWJsb2NrLlxuICogKiBcIjpcIiBhdCB0aGUgc3RhcnQgb2YgYSBtZXNzYWdlUGFydCB3aXRoIG5vIG1ldGFibG9jayB3b3VsZCBlcnJvbmVvdXNseSBpbmRpY2F0ZSB0aGUgc3RhcnQgb2YgYVxuICogICBtZXRhYmxvY2suXG4gKlxuICogQHBhcmFtIG1ldGFCbG9jayBBbnkgbWV0YWRhdGEgdGhhdCBzaG91bGQgYmUgcHJlcGVuZGVkIHRvIHRoZSBzdHJpbmdcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgbWVzc2FnZSBwYXJ0IG9mIHRoZSBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ29va2VkUmF3U3RyaW5nKG1ldGFCbG9jazogc3RyaW5nLCBtZXNzYWdlUGFydDogc3RyaW5nKSB7XG4gIGlmIChtZXRhQmxvY2sgPT09ICcnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogbWVzc2FnZVBhcnQsXG4gICAgICByYXc6IGVzY2FwZUZvck1lc3NhZ2VQYXJ0KGVzY2FwZVN0YXJ0aW5nQ29sb24oZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCkpKVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogYDoke21ldGFCbG9ja306JHttZXNzYWdlUGFydH1gLFxuICAgICAgcmF3OiBlc2NhcGVGb3JNZXNzYWdlUGFydChcbiAgICAgICAgICBgOiR7ZXNjYXBlQ29sb25zKGVzY2FwZVNsYXNoZXMobWV0YUJsb2NrKSl9OiR7ZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCl9YClcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlcm5hbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlPzogVHlwZXxudWxsLCBwdWJsaWMgdHlwZVBhcmFtczogVHlwZVtdfG51bGwgPSBudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRXh0ZXJuYWxFeHByICYmIHRoaXMudmFsdWUubmFtZSA9PT0gZS52YWx1ZS5uYW1lICYmXG4gICAgICAgIHRoaXMudmFsdWUubW9kdWxlTmFtZSA9PT0gZS52YWx1ZS5tb2R1bGVOYW1lICYmIHRoaXMudmFsdWUucnVudGltZSA9PT0gZS52YWx1ZS5ydW50aW1lO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXh0ZXJuYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlcm5hbFJlZmVyZW5jZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2R1bGVOYW1lOiBzdHJpbmd8bnVsbCwgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgcnVudGltZT86IGFueXxudWxsKSB7XG4gIH1cbiAgLy8gTm90ZTogbm8gaXNFcXVpdmFsZW50IG1ldGhvZCBoZXJlIGFzIHdlIHVzZSB0aGlzIGFzIGFuIGludGVyZmFjZSB0b28uXG59XG5cbmV4cG9ydCBjbGFzcyBDb25kaXRpb25hbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHRydWVDYXNlOiBFeHByZXNzaW9uO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgdHJ1ZUNhc2U6IEV4cHJlc3Npb24sIHB1YmxpYyBmYWxzZUNhc2U6IEV4cHJlc3Npb258bnVsbCA9IG51bGwsXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHRydWVDYXNlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHJ1ZUNhc2UgPSB0cnVlQ2FzZTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDb25kaXRpb25hbEV4cHIgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKSAmJlxuICAgICAgICB0aGlzLnRydWVDYXNlLmlzRXF1aXZhbGVudChlLnRydWVDYXNlKSAmJiBudWxsU2FmZUlzRXF1aXZhbGVudCh0aGlzLmZhbHNlQ2FzZSwgZS5mYWxzZUNhc2UpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q29uZGl0aW9uYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIE5vdEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIoQk9PTF9UWVBFLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBOb3RFeHByICYmIHRoaXMuY29uZGl0aW9uLmlzRXF1aXZhbGVudChlLmNvbmRpdGlvbik7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXROb3RFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnROb3ROdWxsIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKGNvbmRpdGlvbi50eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBBc3NlcnROb3ROdWxsICYmIHRoaXMuY29uZGl0aW9uLmlzRXF1aXZhbGVudChlLmNvbmRpdGlvbik7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRBc3NlcnROb3ROdWxsRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2FzdEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDYXN0RXhwciAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENhc3RFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEZuUGFyYW0ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdHlwZTogVHlwZXxudWxsID0gbnVsbCkge31cblxuICBpc0VxdWl2YWxlbnQocGFyYW06IEZuUGFyYW0pOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubmFtZSA9PT0gcGFyYW0ubmFtZTsgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcGFyYW1zOiBGblBhcmFtW10sIHB1YmxpYyBzdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIG5hbWU/OiBzdHJpbmd8bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEZ1bmN0aW9uRXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMucGFyYW1zLCBlLnBhcmFtcykgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnN0YXRlbWVudHMsIGUuc3RhdGVtZW50cyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGdW5jdGlvbkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICB0b0RlY2xTdG10KG5hbWU6IHN0cmluZywgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsID0gbnVsbCk6IERlY2xhcmVGdW5jdGlvblN0bXQge1xuICAgIHJldHVybiBuZXcgRGVjbGFyZUZ1bmN0aW9uU3RtdChcbiAgICAgICAgbmFtZSwgdGhpcy5wYXJhbXMsIHRoaXMuc3RhdGVtZW50cywgdGhpcy50eXBlLCBtb2RpZmllcnMsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQmluYXJ5T3BlcmF0b3JFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyBsaHM6IEV4cHJlc3Npb247XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG9wZXJhdG9yOiBCaW5hcnlPcGVyYXRvciwgbGhzOiBFeHByZXNzaW9uLCBwdWJsaWMgcmhzOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgcGFyZW5zOiBib29sZWFuID0gdHJ1ZSkge1xuICAgIHN1cGVyKHR5cGUgfHwgbGhzLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMubGhzID0gbGhzO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEJpbmFyeU9wZXJhdG9yRXhwciAmJiB0aGlzLm9wZXJhdG9yID09PSBlLm9wZXJhdG9yICYmXG4gICAgICAgIHRoaXMubGhzLmlzRXF1aXZhbGVudChlLmxocykgJiYgdGhpcy5yaHMuaXNFcXVpdmFsZW50KGUucmhzKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJpbmFyeU9wZXJhdG9yRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBSZWFkUHJvcEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkUHJvcEV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5uYW1lID09PSBlLm5hbWU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWFkUHJvcEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZVByb3BFeHByIHtcbiAgICByZXR1cm4gbmV3IFdyaXRlUHJvcEV4cHIodGhpcy5yZWNlaXZlciwgdGhpcy5uYW1lLCB2YWx1ZSwgbnVsbCwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBSZWFkS2V5RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIGluZGV4OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgUmVhZEtleUV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5pbmRleC5pc0VxdWl2YWxlbnQoZS5pbmRleCk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWFkS2V5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBXcml0ZUtleUV4cHIodGhpcy5yZWNlaXZlciwgdGhpcy5pbmRleCwgdmFsdWUsIG51bGwsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEFycmF5RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgZW50cmllczogRXhwcmVzc2lvbltdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gIH1cblxuICBpc0NvbnN0YW50KCkgeyByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS5pc0NvbnN0YW50KCkpOyB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxBcnJheUV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmVudHJpZXMsIGUuZW50cmllcyk7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEFycmF5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbE1hcEVudHJ5IHtcbiAgY29uc3RydWN0b3IocHVibGljIGtleTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIHB1YmxpYyBxdW90ZWQ6IGJvb2xlYW4pIHt9XG4gIGlzRXF1aXZhbGVudChlOiBMaXRlcmFsTWFwRW50cnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5rZXkgPT09IGUua2V5ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWVUeXBlOiBUeXBlfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBlbnRyaWVzOiBMaXRlcmFsTWFwRW50cnlbXSwgdHlwZT86IE1hcFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHRoaXMudmFsdWVUeXBlID0gdHlwZS52YWx1ZVR5cGU7XG4gICAgfVxuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxNYXBFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5lbnRyaWVzLCBlLmVudHJpZXMpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIHRoaXMuZW50cmllcy5ldmVyeShlID0+IGUudmFsdWUuaXNDb25zdGFudCgpKTsgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExpdGVyYWxNYXBFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21tYUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHBhcnRzOiBFeHByZXNzaW9uW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdLnR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbW1hRXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMucGFydHMsIGUucGFydHMpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q29tbWFFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IFdyaXRlS2V5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogV3JpdGVQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoYXN0OiBJbnZva2VNZXRob2RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGFzdDogSW52b2tlRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBMaXRlcmFsRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExvY2FsaXplZFN0cmluZyhhc3Q6IExvY2FsaXplZFN0cmluZywgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IEV4dGVybmFsRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IENvbmRpdGlvbmFsRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE5vdEV4cHIoYXN0OiBOb3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXNzZXJ0Tm90TnVsbEV4cHIoYXN0OiBBc3NlcnROb3ROdWxsLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Q2FzdEV4cHIoYXN0OiBDYXN0RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogUmVhZEtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogTGl0ZXJhbE1hcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBDb21tYUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFR5cGVvZkV4cHIoYXN0OiBUeXBlb2ZFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cbmV4cG9ydCBjb25zdCBUSElTX0VYUFIgPSBuZXcgUmVhZFZhckV4cHIoQnVpbHRpblZhci5UaGlzLCBudWxsLCBudWxsKTtcbmV4cG9ydCBjb25zdCBTVVBFUl9FWFBSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuU3VwZXIsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IENBVENIX0VSUk9SX1ZBUiA9IG5ldyBSZWFkVmFyRXhwcihCdWlsdGluVmFyLkNhdGNoRXJyb3IsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IENBVENIX1NUQUNLX1ZBUiA9IG5ldyBSZWFkVmFyRXhwcihCdWlsdGluVmFyLkNhdGNoU3RhY2ssIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IE5VTExfRVhQUiA9IG5ldyBMaXRlcmFsRXhwcihudWxsLCBudWxsLCBudWxsKTtcbmV4cG9ydCBjb25zdCBUWVBFRF9OVUxMX0VYUFIgPSBuZXcgTGl0ZXJhbEV4cHIobnVsbCwgSU5GRVJSRURfVFlQRSwgbnVsbCk7XG5cbi8vLy8gU3RhdGVtZW50c1xuZXhwb3J0IGVudW0gU3RtdE1vZGlmaWVyIHtcbiAgRmluYWwsXG4gIFByaXZhdGUsXG4gIEV4cG9ydGVkLFxuICBTdGF0aWMsXG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBTdGF0ZW1lbnQge1xuICBwdWJsaWMgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXTtcbiAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICBjb25zdHJ1Y3Rvcihtb2RpZmllcnM/OiBTdG10TW9kaWZpZXJbXXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLm1vZGlmaWVycyA9IG1vZGlmaWVycyB8fCBbXTtcbiAgICB0aGlzLnNvdXJjZVNwYW4gPSBzb3VyY2VTcGFuIHx8IG51bGw7XG4gIH1cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIHN0YXRlbWVudCBwcm9kdWNlcyB0aGUgc2FtZSB2YWx1ZSBhcyB0aGUgZ2l2ZW4gc3RhdGVtZW50LlxuICAgKiBOb3RlOiBXZSBkb24ndCBjaGVjayBUeXBlcyBub3IgUGFyc2VTb3VyY2VTcGFucyBub3IgZnVuY3Rpb24gYXJndW1lbnRzLlxuICAgKi9cbiAgYWJzdHJhY3QgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW47XG5cbiAgYWJzdHJhY3QgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xuXG4gIGhhc01vZGlmaWVyKG1vZGlmaWVyOiBTdG10TW9kaWZpZXIpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubW9kaWZpZXJzICEuaW5kZXhPZihtb2RpZmllcikgIT09IC0xOyB9XG59XG5cblxuZXhwb3J0IGNsYXNzIERlY2xhcmVWYXJTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU/OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsID0gbnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8ICh2YWx1ZSAmJiB2YWx1ZS50eXBlKSB8fCBudWxsO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIERlY2xhcmVWYXJTdG10ICYmIHRoaXMubmFtZSA9PT0gc3RtdC5uYW1lICYmXG4gICAgICAgICh0aGlzLnZhbHVlID8gISFzdG10LnZhbHVlICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpIDogIXN0bXQudmFsdWUpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlVmFyU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVjbGFyZUZ1bmN0aW9uU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHBhcmFtczogRm5QYXJhbVtdLCBwdWJsaWMgc3RhdGVtZW50czogU3RhdGVtZW50W10sXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHlwZSA9IHR5cGUgfHwgbnVsbDtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBEZWNsYXJlRnVuY3Rpb25TdG10ICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJhbXMsIHN0bXQucGFyYW1zKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuc3RhdGVtZW50cywgc3RtdC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uU3RhdGVtZW50IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIEV4cHJlc3Npb25TdGF0ZW1lbnQgJiYgdGhpcy5leHByLmlzRXF1aXZhbGVudChzdG10LmV4cHIpO1xuICB9XG5cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV4cHJlc3Npb25TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJldHVyblN0YXRlbWVudCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgUmV0dXJuU3RhdGVtZW50ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZXR1cm5TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBYnN0cmFjdENsYXNzUGFydCB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKHR5cGU6IFR5cGV8bnVsbHx1bmRlZmluZWQsIHB1YmxpYyBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwpIHtcbiAgICBpZiAoIW1vZGlmaWVycykge1xuICAgICAgdGhpcy5tb2RpZmllcnMgPSBbXTtcbiAgICB9XG4gICAgdGhpcy50eXBlID0gdHlwZSB8fCBudWxsO1xuICB9XG4gIGhhc01vZGlmaWVyKG1vZGlmaWVyOiBTdG10TW9kaWZpZXIpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubW9kaWZpZXJzICEuaW5kZXhPZihtb2RpZmllcikgIT09IC0xOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGFzc0ZpZWxkIGV4dGVuZHMgQWJzdHJhY3RDbGFzc1BhcnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwsXG4gICAgICBwdWJsaWMgaW5pdGlhbGl6ZXI/OiBFeHByZXNzaW9uKSB7XG4gICAgc3VwZXIodHlwZSwgbW9kaWZpZXJzKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoZjogQ2xhc3NGaWVsZCkgeyByZXR1cm4gdGhpcy5uYW1lID09PSBmLm5hbWU7IH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2xhc3NNZXRob2QgZXh0ZW5kcyBBYnN0cmFjdENsYXNzUGFydCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGFyYW1zOiBGblBhcmFtW10sIHB1YmxpYyBib2R5OiBTdGF0ZW1lbnRbXSxcbiAgICAgIHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBtb2RpZmllcnMpO1xuICB9XG4gIGlzRXF1aXZhbGVudChtOiBDbGFzc01ldGhvZCkge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IG0ubmFtZSAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYm9keSwgbS5ib2R5KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBDbGFzc0dldHRlciBleHRlbmRzIEFic3RyYWN0Q2xhc3NQYXJ0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYm9keTogU3RhdGVtZW50W10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgbW9kaWZpZXJzKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQobTogQ2xhc3NHZXR0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lID09PSBtLm5hbWUgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmJvZHksIG0uYm9keSk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2xhc3NTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgcGFyZW50OiBFeHByZXNzaW9ufG51bGwsIHB1YmxpYyBmaWVsZHM6IENsYXNzRmllbGRbXSxcbiAgICAgIHB1YmxpYyBnZXR0ZXJzOiBDbGFzc0dldHRlcltdLCBwdWJsaWMgY29uc3RydWN0b3JNZXRob2Q6IENsYXNzTWV0aG9kLFxuICAgICAgcHVibGljIG1ldGhvZHM6IENsYXNzTWV0aG9kW10sIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIENsYXNzU3RtdCAmJiB0aGlzLm5hbWUgPT09IHN0bXQubmFtZSAmJlxuICAgICAgICBudWxsU2FmZUlzRXF1aXZhbGVudCh0aGlzLnBhcmVudCwgc3RtdC5wYXJlbnQpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5maWVsZHMsIHN0bXQuZmllbGRzKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuZ2V0dGVycywgc3RtdC5nZXR0ZXJzKSAmJlxuICAgICAgICB0aGlzLmNvbnN0cnVjdG9yTWV0aG9kLmlzRXF1aXZhbGVudChzdG10LmNvbnN0cnVjdG9yTWV0aG9kKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMubWV0aG9kcywgc3RtdC5tZXRob2RzKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVjbGFyZUNsYXNzU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBJZlN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHB1YmxpYyB0cnVlQ2FzZTogU3RhdGVtZW50W10sXG4gICAgICBwdWJsaWMgZmFsc2VDYXNlOiBTdGF0ZW1lbnRbXSA9IFtdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBJZlN0bXQgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KHN0bXQuY29uZGl0aW9uKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMudHJ1ZUNhc2UsIHN0bXQudHJ1ZUNhc2UpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5mYWxzZUNhc2UsIHN0bXQuZmFsc2VDYXNlKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50U3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb21tZW50OiBzdHJpbmcsIHB1YmxpYyBtdWx0aWxpbmUgPSBmYWxzZSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4geyByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIENvbW1lbnRTdG10OyB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb21tZW50U3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSlNEb2NDb21tZW50U3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0YWdzOiBKU0RvY1RhZ1tdID0gW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIEpTRG9jQ29tbWVudFN0bXQgJiYgdGhpcy50b1N0cmluZygpID09PSBzdG10LnRvU3RyaW5nKCk7XG4gIH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEpTRG9jQ29tbWVudFN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHsgcmV0dXJuIHNlcmlhbGl6ZVRhZ3ModGhpcy50YWdzKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgVHJ5Q2F0Y2hTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYm9keVN0bXRzOiBTdGF0ZW1lbnRbXSwgcHVibGljIGNhdGNoU3RtdHM6IFN0YXRlbWVudFtdLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgVHJ5Q2F0Y2hTdG10ICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5ib2R5U3RtdHMsIHN0bXQuYm9keVN0bXRzKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuY2F0Y2hTdG10cywgc3RtdC5jYXRjaFN0bXRzKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VHJ5Q2F0Y2hTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFRocm93U3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlcnJvcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFRocm93U3RtdCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgVHJ5Q2F0Y2hTdG10ICYmIHRoaXMuZXJyb3IuaXNFcXVpdmFsZW50KHN0bXQuZXJyb3IpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUaHJvd1N0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdGF0ZW1lbnRWaXNpdG9yIHtcbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBEZWNsYXJlVmFyU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IFJldHVyblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogQ2xhc3NTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SWZTdG10KHN0bXQ6IElmU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBUcnlDYXRjaFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRUaHJvd1N0bXQoc3RtdDogVGhyb3dTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Q29tbWVudFN0bXQoc3RtdDogQ29tbWVudFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRKU0RvY0NvbW1lbnRTdG10KHN0bXQ6IEpTRG9jQ29tbWVudFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIEFzdFRyYW5zZm9ybWVyIGltcGxlbWVudHMgU3RhdGVtZW50VmlzaXRvciwgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB0cmFuc2Zvcm1FeHByKGV4cHI6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IEV4cHJlc3Npb24geyByZXR1cm4gZXhwcjsgfVxuXG4gIHRyYW5zZm9ybVN0bXQoc3RtdDogU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBTdGF0ZW1lbnQgeyByZXR1cm4gc3RtdDsgfVxuXG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpOyB9XG5cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFR5cGVvZkV4cHIoZXhwcjogVHlwZW9mRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgVHlwZW9mRXhwcihleHByLmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBXcml0ZVZhckV4cHIoXG4gICAgICAgICAgICBleHByLm5hbWUsIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogV3JpdGVLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBXcml0ZUtleUV4cHIoXG4gICAgICAgICAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci50eXBlLCBleHByLnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBXcml0ZVByb3BFeHByKFxuICAgICAgICAgICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIubmFtZSxcbiAgICAgICAgICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRJbnZva2VNZXRob2RFeHByKGFzdDogSW52b2tlTWV0aG9kRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBtZXRob2QgPSBhc3QuYnVpbHRpbiB8fCBhc3QubmFtZTtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgSW52b2tlTWV0aG9kRXhwcihcbiAgICAgICAgICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIG1ldGhvZCAhLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgICAgYXN0LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEluc3RhbnRpYXRlRXhwcihcbiAgICAgICAgICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoYXN0LCBjb250ZXh0KTsgfVxuXG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBMb2NhbGl6ZWRTdHJpbmcoXG4gICAgICAgICAgICBhc3QubWV0YUJsb2NrLCBhc3QubWVzc2FnZVBhcnRzLCBhc3QucGxhY2VIb2xkZXJOYW1lcyxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZXhwcmVzc2lvbnMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IENvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC5mYWxzZUNhc2UgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgTm90RXhwcihhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0QXNzZXJ0Tm90TnVsbEV4cHIoYXN0OiBBc3NlcnROb3ROdWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBBc3NlcnROb3ROdWxsKGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDYXN0RXhwcihhc3Q6IENhc3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBDYXN0RXhwcihhc3QudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgICBhc3QucGFyYW1zLCB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBCaW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIGFzdC5vcGVyYXRvciwgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgUmVhZFByb3BFeHByKFxuICAgICAgICAgICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0Lm5hbWUsIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IFJlYWRLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBSZWFkS2V5RXhwcihcbiAgICAgICAgICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IExpdGVyYWxBcnJheUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IExpdGVyYWxBcnJheUV4cHIoXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmVudHJpZXMubWFwKFxuICAgICAgICAoZW50cnkpOiBMaXRlcmFsTWFwRW50cnkgPT4gbmV3IExpdGVyYWxNYXBFbnRyeShcbiAgICAgICAgICAgIGVudHJ5LmtleSwgZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBlbnRyeS5xdW90ZWQpKTtcbiAgICBjb25zdCBtYXBUeXBlID0gbmV3IE1hcFR5cGUoYXN0LnZhbHVlVHlwZSwgbnVsbCk7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihuZXcgTGl0ZXJhbE1hcEV4cHIoZW50cmllcywgbWFwVHlwZSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQ29tbWFFeHByKHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QucGFydHMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwcnM6IEV4cHJlc3Npb25bXSwgY29udGV4dDogYW55KTogRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gZXhwcnMubWFwKGV4cHIgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBEZWNsYXJlVmFyU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0bXQudmFsdWUgJiYgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IERlY2xhcmVWYXJTdG10KHN0bXQubmFtZSwgdmFsdWUsIHN0bXQudHlwZSwgc3RtdC5tb2RpZmllcnMsIHN0bXQuc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBEZWNsYXJlRnVuY3Rpb25TdG10KFxuICAgICAgICAgICAgc3RtdC5uYW1lLCBzdG10LnBhcmFtcywgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzLCBjb250ZXh0KSwgc3RtdC50eXBlLFxuICAgICAgICAgICAgc3RtdC5tb2RpZmllcnMsIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBFeHByZXNzaW9uU3RhdGVtZW50KHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IFJldHVyblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgUmV0dXJuU3RhdGVtZW50KHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBzdG10LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgcGFyZW50ID0gc3RtdC5wYXJlbnQgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgY29uc3QgZ2V0dGVycyA9IHN0bXQuZ2V0dGVycy5tYXAoXG4gICAgICAgIGdldHRlciA9PiBuZXcgQ2xhc3NHZXR0ZXIoXG4gICAgICAgICAgICBnZXR0ZXIubmFtZSwgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoZ2V0dGVyLmJvZHksIGNvbnRleHQpLCBnZXR0ZXIudHlwZSxcbiAgICAgICAgICAgIGdldHRlci5tb2RpZmllcnMpKTtcbiAgICBjb25zdCBjdG9yTWV0aG9kID0gc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCAmJlxuICAgICAgICBuZXcgQ2xhc3NNZXRob2Qoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5uYW1lLCBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLnBhcmFtcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY29uc3RydWN0b3JNZXRob2QuYm9keSwgY29udGV4dCksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLnR5cGUsIHN0bXQuY29uc3RydWN0b3JNZXRob2QubW9kaWZpZXJzKTtcbiAgICBjb25zdCBtZXRob2RzID0gc3RtdC5tZXRob2RzLm1hcChcbiAgICAgICAgbWV0aG9kID0+IG5ldyBDbGFzc01ldGhvZChcbiAgICAgICAgICAgIG1ldGhvZC5uYW1lLCBtZXRob2QucGFyYW1zLCB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhtZXRob2QuYm9keSwgY29udGV4dCksIG1ldGhvZC50eXBlLFxuICAgICAgICAgICAgbWV0aG9kLm1vZGlmaWVycykpO1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBDbGFzc1N0bXQoXG4gICAgICAgICAgICBzdG10Lm5hbWUsIHBhcmVudCwgc3RtdC5maWVsZHMsIGdldHRlcnMsIGN0b3JNZXRob2QsIG1ldGhvZHMsIHN0bXQubW9kaWZpZXJzLFxuICAgICAgICAgICAgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdElmU3RtdChzdG10OiBJZlN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IElmU3RtdChcbiAgICAgICAgICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5mYWxzZUNhc2UsIGNvbnRleHQpLCBzdG10LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IFRyeUNhdGNoU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgVHJ5Q2F0Y2hTdG10KFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5ib2R5U3RtdHMsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jYXRjaFN0bXRzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFRocm93U3RtdChzdG10OiBUaHJvd1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IFRocm93U3RtdChzdG10LmVycm9yLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IENvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoc3RtdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEpTRG9jQ29tbWVudFN0bXQoc3RtdDogSlNEb2NDb21tZW50U3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KHN0bXQsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzOiBTdGF0ZW1lbnRbXSwgY29udGV4dDogYW55KTogU3RhdGVtZW50W10ge1xuICAgIHJldHVybiBzdG10cy5tYXAoc3RtdCA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQpKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgU3RhdGVtZW50VmlzaXRvciwgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdFR5cGUoYXN0OiBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXN0OyB9XG4gIHZpc2l0RXhwcmVzc2lvbihhc3Q6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlKSB7XG4gICAgICBhc3QudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpOyB9XG4gIHZpc2l0RXhwcmVzc2lvblR5cGUodHlwZTogRXhwcmVzc2lvblR5cGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdHlwZS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgaWYgKHR5cGUudHlwZVBhcmFtcyAhPT0gbnVsbCkge1xuICAgICAgdHlwZS50eXBlUGFyYW1zLmZvckVhY2gocGFyYW0gPT4gdGhpcy52aXNpdFR5cGUocGFyYW0sIGNvbnRleHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpOyB9XG4gIHZpc2l0TWFwVHlwZSh0eXBlOiBNYXBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7IH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGFzdDsgfVxuICB2aXNpdFR5cGVvZkV4cHIoYXN0OiBUeXBlb2ZFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTsgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZVZhckV4cHIoYXN0OiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFdyaXRlS2V5RXhwcihhc3Q6IFdyaXRlS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFdyaXRlUHJvcEV4cHIoYXN0OiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoYXN0OiBJbnZva2VNZXRob2RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNsYXNzRXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBMb2NhbGl6ZWRTdHJpbmcsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlUGFyYW1zKSB7XG4gICAgICBhc3QudHlwZVBhcmFtcy5mb3JFYWNoKHR5cGUgPT4gdHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IENvbmRpdGlvbmFsRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5mYWxzZUNhc2UgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBCaW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnJocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRSZWFkUHJvcEV4cHIoYXN0OiBSZWFkUHJvcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogUmVhZEtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IExpdGVyYWxBcnJheUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5lbnRyaWVzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogTGl0ZXJhbE1hcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmVudHJpZXMuZm9yRWFjaCgoZW50cnkpID0+IGVudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBDb21tYUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5wYXJ0cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBbGxFeHByZXNzaW9ucyhleHByczogRXhwcmVzc2lvbltdLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBleHBycy5mb3JFYWNoKGV4cHIgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBEZWNsYXJlVmFyU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoc3RtdC52YWx1ZSkge1xuICAgICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIGlmIChzdG10LnR5cGUpIHtcbiAgICAgIHN0bXQudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgaWYgKHN0bXQudHlwZSkge1xuICAgICAgc3RtdC50eXBlLnZpc2l0VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IFJldHVyblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogQ2xhc3NTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQucGFyZW50ICEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHN0bXQuZ2V0dGVycy5mb3JFYWNoKGdldHRlciA9PiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhnZXR0ZXIuYm9keSwgY29udGV4dCkpO1xuICAgIGlmIChzdG10LmNvbnN0cnVjdG9yTWV0aG9kKSB7XG4gICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGNvbnRleHQpO1xuICAgIH1cbiAgICBzdG10Lm1ldGhvZHMuZm9yRWFjaChtZXRob2QgPT4gdGhpcy52aXNpdEFsbFN0YXRlbWVudHMobWV0aG9kLmJvZHksIGNvbnRleHQpKTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdElmU3RtdChzdG10OiBJZlN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBUcnlDYXRjaFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5ib2R5U3RtdHMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY2F0Y2hTdG10cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRUaHJvd1N0bXQoc3RtdDogVGhyb3dTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0Q29tbWVudFN0bXQoc3RtdDogQ29tbWVudFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBzdG10OyB9XG4gIHZpc2l0SlNEb2NDb21tZW50U3RtdChzdG10OiBKU0RvY0NvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gc3RtdDsgfVxuICB2aXNpdEFsbFN0YXRlbWVudHMoc3RtdHM6IFN0YXRlbWVudFtdLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBzdG10cy5mb3JFYWNoKHN0bXQgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRSZWFkVmFyTmFtZXMoc3RtdHM6IFN0YXRlbWVudFtdKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9SZWFkVmFyVmlzaXRvcigpO1xuICB2aXNpdG9yLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10cywgbnVsbCk7XG4gIHJldHVybiB2aXNpdG9yLnZhck5hbWVzO1xufVxuXG5jbGFzcyBfUmVhZFZhclZpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgdmFyTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gRG9uJ3QgZGVzY2VuZCBpbnRvIG5lc3RlZCBmdW5jdGlvbnNcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogQ2xhc3NTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIC8vIERvbid0IGRlc2NlbmQgaW50byBuZXN0ZWQgY2xhc3Nlc1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoYXN0Lm5hbWUpIHtcbiAgICAgIHRoaXMudmFyTmFtZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxlY3RFeHRlcm5hbFJlZmVyZW5jZXMoc3RtdHM6IFN0YXRlbWVudFtdKTogRXh0ZXJuYWxSZWZlcmVuY2VbXSB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0ZpbmRFeHRlcm5hbFJlZmVyZW5jZXNWaXNpdG9yKCk7XG4gIHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzLCBudWxsKTtcbiAgcmV0dXJuIHZpc2l0b3IuZXh0ZXJuYWxSZWZlcmVuY2VzO1xufVxuXG5jbGFzcyBfRmluZEV4dGVybmFsUmVmZXJlbmNlc1Zpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgZXh0ZXJuYWxSZWZlcmVuY2VzOiBFeHRlcm5hbFJlZmVyZW5jZVtdID0gW107XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGU6IEV4dGVybmFsRXhwciwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5leHRlcm5hbFJlZmVyZW5jZXMucHVzaChlLnZhbHVlKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRFeHRlcm5hbEV4cHIoZSwgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgc3RtdDogU3RhdGVtZW50LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogU3RhdGVtZW50IHtcbiAgaWYgKCFzb3VyY2VTcGFuKSB7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgX0FwcGx5U291cmNlU3BhblRyYW5zZm9ybWVyKHNvdXJjZVNwYW4pO1xuICByZXR1cm4gc3RtdC52aXNpdFN0YXRlbWVudCh0cmFuc2Zvcm1lciwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVNvdXJjZVNwYW5Ub0V4cHJlc3Npb25JZk5lZWRlZChcbiAgICBleHByOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogRXhwcmVzc2lvbiB7XG4gIGlmICghc291cmNlU3Bhbikge1xuICAgIHJldHVybiBleHByO1xuICB9XG4gIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IF9BcHBseVNvdXJjZVNwYW5UcmFuc2Zvcm1lcihzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGV4cHIudmlzaXRFeHByZXNzaW9uKHRyYW5zZm9ybWVyLCBudWxsKTtcbn1cblxuY2xhc3MgX0FwcGx5U291cmNlU3BhblRyYW5zZm9ybWVyIGV4dGVuZHMgQXN0VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbikgeyBzdXBlcigpOyB9XG4gIHByaXZhdGUgX2Nsb25lKG9iajogYW55KTogYW55IHtcbiAgICBjb25zdCBjbG9uZSA9IE9iamVjdC5jcmVhdGUob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG4gICAgZm9yIChsZXQgcHJvcCBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgICBjbG9uZVtwcm9wXSA9IG9ialtwcm9wXTtcbiAgICB9XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG5cbiAgdHJhbnNmb3JtRXhwcihleHByOiBFeHByZXNzaW9uLCBjb250ZXh0OiBhbnkpOiBFeHByZXNzaW9uIHtcbiAgICBpZiAoIWV4cHIuc291cmNlU3Bhbikge1xuICAgICAgZXhwciA9IHRoaXMuX2Nsb25lKGV4cHIpO1xuICAgICAgZXhwci5zb3VyY2VTcGFuID0gdGhpcy5zb3VyY2VTcGFuO1xuICAgIH1cbiAgICByZXR1cm4gZXhwcjtcbiAgfVxuXG4gIHRyYW5zZm9ybVN0bXQoc3RtdDogU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBTdGF0ZW1lbnQge1xuICAgIGlmICghc3RtdC5zb3VyY2VTcGFuKSB7XG4gICAgICBzdG10ID0gdGhpcy5fY2xvbmUoc3RtdCk7XG4gICAgICBzdG10LnNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW47XG4gICAgfVxuICAgIHJldHVybiBzdG10O1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJpYWJsZShcbiAgICBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlIHwgbnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiB8IG51bGwpOiBSZWFkVmFyRXhwciB7XG4gIHJldHVybiBuZXcgUmVhZFZhckV4cHIobmFtZSwgdHlwZSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRFeHByKFxuICAgIGlkOiBFeHRlcm5hbFJlZmVyZW5jZSwgdHlwZVBhcmFtczogVHlwZVtdIHwgbnVsbCA9IG51bGwsXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiB8IG51bGwpOiBFeHRlcm5hbEV4cHIge1xuICByZXR1cm4gbmV3IEV4dGVybmFsRXhwcihpZCwgbnVsbCwgdHlwZVBhcmFtcywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRUeXBlKFxuICAgIGlkOiBFeHRlcm5hbFJlZmVyZW5jZSwgdHlwZVBhcmFtczogVHlwZVtdIHwgbnVsbCA9IG51bGwsXG4gICAgdHlwZU1vZGlmaWVyczogVHlwZU1vZGlmaWVyW10gfCBudWxsID0gbnVsbCk6IEV4cHJlc3Npb25UeXBlfG51bGwge1xuICByZXR1cm4gaWQgIT0gbnVsbCA/IGV4cHJlc3Npb25UeXBlKGltcG9ydEV4cHIoaWQsIHR5cGVQYXJhbXMsIG51bGwpLCB0eXBlTW9kaWZpZXJzKSA6IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHByZXNzaW9uVHlwZShcbiAgICBleHByOiBFeHByZXNzaW9uLCB0eXBlTW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXSB8IG51bGwgPSBudWxsLFxuICAgIHR5cGVQYXJhbXM6IFR5cGVbXSB8IG51bGwgPSBudWxsKTogRXhwcmVzc2lvblR5cGUge1xuICByZXR1cm4gbmV3IEV4cHJlc3Npb25UeXBlKGV4cHIsIHR5cGVNb2RpZmllcnMsIHR5cGVQYXJhbXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHlwZW9mRXhwcihleHByOiBFeHByZXNzaW9uKSB7XG4gIHJldHVybiBuZXcgVHlwZW9mRXhwcihleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWxBcnIoXG4gICAgdmFsdWVzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlIHwgbnVsbCxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCk6IExpdGVyYWxBcnJheUV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxBcnJheUV4cHIodmFsdWVzLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWxNYXAoXG4gICAgdmFsdWVzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbiwgdmFsdWU6IEV4cHJlc3Npb259W10sXG4gICAgdHlwZTogTWFwVHlwZSB8IG51bGwgPSBudWxsKTogTGl0ZXJhbE1hcEV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxNYXBFeHByKFxuICAgICAgdmFsdWVzLm1hcChlID0+IG5ldyBMaXRlcmFsTWFwRW50cnkoZS5rZXksIGUudmFsdWUsIGUucXVvdGVkKSksIHR5cGUsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm90KGV4cHI6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsKTogTm90RXhwciB7XG4gIHJldHVybiBuZXcgTm90RXhwcihleHByLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdE51bGwoXG4gICAgZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiB8IG51bGwpOiBBc3NlcnROb3ROdWxsIHtcbiAgcmV0dXJuIG5ldyBBc3NlcnROb3ROdWxsKGV4cHIsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm4oXG4gICAgcGFyYW1zOiBGblBhcmFtW10sIGJvZHk6IFN0YXRlbWVudFtdLCB0eXBlPzogVHlwZSB8IG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLFxuICAgIG5hbWU/OiBzdHJpbmcgfCBudWxsKTogRnVuY3Rpb25FeHByIHtcbiAgcmV0dXJuIG5ldyBGdW5jdGlvbkV4cHIocGFyYW1zLCBib2R5LCB0eXBlLCBzb3VyY2VTcGFuLCBuYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlmU3RtdChjb25kaXRpb246IEV4cHJlc3Npb24sIHRoZW5DbGF1c2U6IFN0YXRlbWVudFtdLCBlbHNlQ2xhdXNlPzogU3RhdGVtZW50W10pIHtcbiAgcmV0dXJuIG5ldyBJZlN0bXQoY29uZGl0aW9uLCB0aGVuQ2xhdXNlLCBlbHNlQ2xhdXNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWwoXG4gICAgdmFsdWU6IGFueSwgdHlwZT86IFR5cGUgfCBudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCk6IExpdGVyYWxFeHByIHtcbiAgcmV0dXJuIG5ldyBMaXRlcmFsRXhwcih2YWx1ZSwgdHlwZSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2NhbGl6ZWRTdHJpbmcoXG4gICAgbWV0YUJsb2NrOiBJMThuTWV0YSwgbWVzc2FnZVBhcnRzOiBzdHJpbmdbXSwgcGxhY2Vob2xkZXJOYW1lczogc3RyaW5nW10sXG4gICAgZXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiB8IG51bGwpOiBMb2NhbGl6ZWRTdHJpbmcge1xuICByZXR1cm4gbmV3IExvY2FsaXplZFN0cmluZyhtZXRhQmxvY2ssIG1lc3NhZ2VQYXJ0cywgcGxhY2Vob2xkZXJOYW1lcywgZXhwcmVzc2lvbnMsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdWxsKGV4cDogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gZXhwIGluc3RhbmNlb2YgTGl0ZXJhbEV4cHIgJiYgZXhwLnZhbHVlID09PSBudWxsO1xufVxuXG4vLyBUaGUgbGlzdCBvZiBKU0RvYyB0YWdzIHRoYXQgd2UgY3VycmVudGx5IHN1cHBvcnQuIEV4dGVuZCBpdCBpZiBuZWVkZWQuXG5leHBvcnQgY29uc3QgZW51bSBKU0RvY1RhZ05hbWUge1xuICBEZXNjID0gJ2Rlc2MnLFxuICBJZCA9ICdpZCcsXG4gIE1lYW5pbmcgPSAnbWVhbmluZycsXG59XG5cbi8qXG4gKiBUeXBlU2NyaXB0IGhhcyBhbiBBUEkgZm9yIEpTRG9jIGFscmVhZHksIGJ1dCBpdCdzIG5vdCBleHBvc2VkLlxuICogaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy83MzkzXG4gKiBGb3Igbm93IHdlIGNyZWF0ZSB0eXBlcyB0aGF0IGFyZSBzaW1pbGFyIHRvIHRoZWlycyBzbyB0aGF0IG1pZ3JhdGluZ1xuICogdG8gdGhlaXIgQVBJIHdpbGwgYmUgZWFzaWVyLiBTZWUgZS5nLiBgdHMuSlNEb2NUYWdgIGFuZCBgdHMuSlNEb2NDb21tZW50YC5cbiAqL1xuZXhwb3J0IHR5cGUgSlNEb2NUYWcgPSB7XG4gIC8vIGB0YWdOYW1lYCBpcyBlLmcuIFwicGFyYW1cIiBpbiBhbiBgQHBhcmFtYCBkZWNsYXJhdGlvblxuICB0YWdOYW1lOiBKU0RvY1RhZ05hbWUgfCBzdHJpbmcsXG4gIC8vIEFueSByZW1haW5pbmcgdGV4dCBvbiB0aGUgdGFnLCBlLmcuIHRoZSBkZXNjcmlwdGlvblxuICB0ZXh0Pzogc3RyaW5nLFxufSB8IHtcbiAgLy8gbm8gYHRhZ05hbWVgIGZvciBwbGFpbiB0ZXh0IGRvY3VtZW50YXRpb24gdGhhdCBvY2N1cnMgYmVmb3JlIGFueSBgQHBhcmFtYCBsaW5lc1xuICB0YWdOYW1lPzogdW5kZWZpbmVkLFxuICB0ZXh0OiBzdHJpbmcsXG59O1xuXG4vKlxuICogU2VyaWFsaXplcyBhIGBUYWdgIGludG8gYSBzdHJpbmcuXG4gKiBSZXR1cm5zIGEgc3RyaW5nIGxpa2UgXCIgQGZvbyB7YmFyfSBiYXpcIiAobm90ZSB0aGUgbGVhZGluZyB3aGl0ZXNwYWNlIGJlZm9yZSBgQGZvb2ApLlxuICovXG5mdW5jdGlvbiB0YWdUb1N0cmluZyh0YWc6IEpTRG9jVGFnKTogc3RyaW5nIHtcbiAgbGV0IG91dCA9ICcnO1xuICBpZiAodGFnLnRhZ05hbWUpIHtcbiAgICBvdXQgKz0gYCBAJHt0YWcudGFnTmFtZX1gO1xuICB9XG4gIGlmICh0YWcudGV4dCkge1xuICAgIGlmICh0YWcudGV4dC5tYXRjaCgvXFwvXFwqfFxcKlxcLy8pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0pTRG9jIHRleHQgY2Fubm90IGNvbnRhaW4gXCIvKlwiIGFuZCBcIiovXCInKTtcbiAgICB9XG4gICAgb3V0ICs9ICcgJyArIHRhZy50ZXh0LnJlcGxhY2UoL0AvZywgJ1xcXFxAJyk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplVGFncyh0YWdzOiBKU0RvY1RhZ1tdKTogc3RyaW5nIHtcbiAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSByZXR1cm4gJyc7XG5cbiAgbGV0IG91dCA9ICcqXFxuJztcbiAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgIG91dCArPSAnIConO1xuICAgIC8vIElmIHRoZSB0YWdUb1N0cmluZyBpcyBtdWx0aS1saW5lLCBpbnNlcnQgXCIgKiBcIiBwcmVmaXhlcyBvbiBzdWJzZXF1ZW50IGxpbmVzLlxuICAgIG91dCArPSB0YWdUb1N0cmluZyh0YWcpLnJlcGxhY2UoL1xcbi9nLCAnXFxuICogJyk7XG4gICAgb3V0ICs9ICdcXG4nO1xuICB9XG4gIG91dCArPSAnICc7XG4gIHJldHVybiBvdXQ7XG59XG4iXX0=