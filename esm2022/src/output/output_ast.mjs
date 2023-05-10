/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { computeMsgId } from '../i18n/digest';
//// Types
export var TypeModifier;
(function (TypeModifier) {
    TypeModifier[TypeModifier["None"] = 0] = "None";
    TypeModifier[TypeModifier["Const"] = 1] = "Const";
})(TypeModifier || (TypeModifier = {}));
export class Type {
    constructor(modifiers = TypeModifier.None) {
        this.modifiers = modifiers;
    }
    hasModifier(modifier) {
        return (this.modifiers & modifier) !== 0;
    }
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
    constructor(name, modifiers) {
        super(modifiers);
        this.name = name;
    }
    visitType(visitor, context) {
        return visitor.visitBuiltinType(this, context);
    }
}
export class ExpressionType extends Type {
    constructor(value, modifiers, typeParams = null) {
        super(modifiers);
        this.value = value;
        this.typeParams = typeParams;
    }
    visitType(visitor, context) {
        return visitor.visitExpressionType(this, context);
    }
}
export class ArrayType extends Type {
    constructor(of, modifiers) {
        super(modifiers);
        this.of = of;
    }
    visitType(visitor, context) {
        return visitor.visitArrayType(this, context);
    }
}
export class MapType extends Type {
    constructor(valueType, modifiers) {
        super(modifiers);
        this.valueType = valueType || null;
    }
    visitType(visitor, context) {
        return visitor.visitMapType(this, context);
    }
}
export class TransplantedType extends Type {
    constructor(type, modifiers) {
        super(modifiers);
        this.type = type;
    }
    visitType(visitor, context) {
        return visitor.visitTransplantedType(this, context);
    }
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
export var UnaryOperator;
(function (UnaryOperator) {
    UnaryOperator[UnaryOperator["Minus"] = 0] = "Minus";
    UnaryOperator[UnaryOperator["Plus"] = 1] = "Plus";
})(UnaryOperator || (UnaryOperator = {}));
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
    BinaryOperator[BinaryOperator["NullishCoalesce"] = 16] = "NullishCoalesce";
})(BinaryOperator || (BinaryOperator = {}));
export function nullSafeIsEquivalent(base, other) {
    if (base == null || other == null) {
        return base == other;
    }
    return base.isEquivalent(other);
}
function areAllEquivalentPredicate(base, other, equivalentPredicate) {
    const len = base.length;
    if (len !== other.length) {
        return false;
    }
    for (let i = 0; i < len; i++) {
        if (!equivalentPredicate(base[i], other[i])) {
            return false;
        }
    }
    return true;
}
export function areAllEquivalent(base, other) {
    return areAllEquivalentPredicate(base, other, (baseElement, otherElement) => baseElement.isEquivalent(otherElement));
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
    callFn(params, sourceSpan, pure) {
        return new InvokeFunctionExpr(this, params, null, sourceSpan, pure);
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
    nullishCoalesce(rhs, sourceSpan) {
        return new BinaryOperatorExpr(BinaryOperator.NullishCoalesce, this, rhs, null, sourceSpan);
    }
    toStmt() {
        return new ExpressionStatement(this, null);
    }
}
export class ReadVarExpr extends Expression {
    constructor(name, type, sourceSpan) {
        super(type, sourceSpan);
        this.name = name;
    }
    isEquivalent(e) {
        return e instanceof ReadVarExpr && this.name === e.name;
    }
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitReadVarExpr(this, context);
    }
    set(value) {
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
    isConstant() {
        return this.expr.isConstant();
    }
}
export class WrappedNodeExpr extends Expression {
    constructor(node, type, sourceSpan) {
        super(type, sourceSpan);
        this.node = node;
    }
    isEquivalent(e) {
        return e instanceof WrappedNodeExpr && this.node === e.node;
    }
    isConstant() {
        return false;
    }
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
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitWriteVarExpr(this, context);
    }
    toDeclStmt(type, modifiers) {
        return new DeclareVarStmt(this.name, this.value, type, modifiers, this.sourceSpan);
    }
    toConstDecl() {
        return this.toDeclStmt(INFERRED_TYPE, StmtModifier.Final);
    }
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitWritePropExpr(this, context);
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
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitInvokeFunctionExpr(this, context);
    }
}
export class TaggedTemplateExpr extends Expression {
    constructor(tag, template, type, sourceSpan) {
        super(type, sourceSpan);
        this.tag = tag;
        this.template = template;
    }
    isEquivalent(e) {
        return e instanceof TaggedTemplateExpr && this.tag.isEquivalent(e.tag) &&
            areAllEquivalentPredicate(this.template.elements, e.template.elements, (a, b) => a.text === b.text) &&
            areAllEquivalent(this.template.expressions, e.template.expressions);
    }
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitTaggedTemplateExpr(this, context);
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return true;
    }
    visitExpression(visitor, context) {
        return visitor.visitLiteralExpr(this, context);
    }
}
export class TemplateLiteral {
    constructor(elements, expressions) {
        this.elements = elements;
        this.expressions = expressions;
    }
}
export class TemplateLiteralElement {
    constructor(text, sourceSpan, rawText) {
        this.text = text;
        this.sourceSpan = sourceSpan;
        // If `rawText` is not provided, try to extract the raw string from its
        // associated `sourceSpan`. If that is also not available, "fake" the raw
        // string instead by escaping the following control sequences:
        // - "\" would otherwise indicate that the next character is a control character.
        // - "`" and "${" are template string control sequences that would otherwise prematurely
        // indicate the end of the template literal element.
        this.rawText =
            rawText ?? sourceSpan?.toString() ?? escapeForTemplateLiteral(escapeSlashes(text));
    }
}
export class LiteralPiece {
    constructor(text, sourceSpan) {
        this.text = text;
        this.sourceSpan = sourceSpan;
    }
}
export class PlaceholderPiece {
    /**
     * Create a new instance of a `PlaceholderPiece`.
     *
     * @param text the name of this placeholder (e.g. `PH_1`).
     * @param sourceSpan the location of this placeholder in its localized message the source code.
     * @param associatedMessage reference to another message that this placeholder is associated with.
     * The `associatedMessage` is mainly used to provide a relationship to an ICU message that has
     * been extracted out from the message containing the placeholder.
     */
    constructor(text, sourceSpan, associatedMessage) {
        this.text = text;
        this.sourceSpan = sourceSpan;
        this.associatedMessage = associatedMessage;
    }
}
const MEANING_SEPARATOR = '|';
const ID_SEPARATOR = '@@';
const LEGACY_ID_INDICATOR = '␟';
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
    isConstant() {
        return false;
    }
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
            metaBlock = `${this.metaBlock.meaning}${MEANING_SEPARATOR}${metaBlock}`;
        }
        if (this.metaBlock.customId) {
            metaBlock = `${metaBlock}${ID_SEPARATOR}${this.metaBlock.customId}`;
        }
        if (this.metaBlock.legacyIds) {
            this.metaBlock.legacyIds.forEach(legacyId => {
                metaBlock = `${metaBlock}${LEGACY_ID_INDICATOR}${legacyId}`;
            });
        }
        return createCookedRawString(metaBlock, this.messageParts[0].text, this.getMessagePartSourceSpan(0));
    }
    getMessagePartSourceSpan(i) {
        return this.messageParts[i]?.sourceSpan ?? this.sourceSpan;
    }
    getPlaceholderSourceSpan(i) {
        return this.placeHolderNames[i]?.sourceSpan ?? this.expressions[i]?.sourceSpan ??
            this.sourceSpan;
    }
    /**
     * Serialize the given `placeholderName` and `messagePart` into "cooked" and "raw" strings that
     * can be used in a `$localize` tagged string.
     *
     * The format is `:<placeholder-name>[@@<associated-id>]:`.
     *
     * The `associated-id` is the message id of the (usually an ICU) message to which this placeholder
     * refers.
     *
     * @param partIndex The index of the message part to serialize.
     */
    serializeI18nTemplatePart(partIndex) {
        const placeholder = this.placeHolderNames[partIndex - 1];
        const messagePart = this.messageParts[partIndex];
        let metaBlock = placeholder.text;
        if (placeholder.associatedMessage?.legacyIds.length === 0) {
            metaBlock += `${ID_SEPARATOR}${computeMsgId(placeholder.associatedMessage.messageString, placeholder.associatedMessage.meaning)}`;
        }
        return createCookedRawString(metaBlock, messagePart.text, this.getMessagePartSourceSpan(partIndex));
    }
}
const escapeSlashes = (str) => str.replace(/\\/g, '\\\\');
const escapeStartingColon = (str) => str.replace(/^:/, '\\:');
const escapeColons = (str) => str.replace(/:/g, '\\:');
const escapeForTemplateLiteral = (str) => str.replace(/`/g, '\\`').replace(/\${/g, '$\\{');
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
function createCookedRawString(metaBlock, messagePart, range) {
    if (metaBlock === '') {
        return {
            cooked: messagePart,
            raw: escapeForTemplateLiteral(escapeStartingColon(escapeSlashes(messagePart))),
            range,
        };
    }
    else {
        return {
            cooked: `:${metaBlock}:${messagePart}`,
            raw: escapeForTemplateLiteral(`:${escapeColons(escapeSlashes(metaBlock))}:${escapeSlashes(messagePart)}`),
            range,
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitNotExpr(this, context);
    }
}
export class FnParam {
    constructor(name, type = null) {
        this.name = name;
        this.type = type;
    }
    isEquivalent(param) {
        return this.name === param.name;
    }
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
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitFunctionExpr(this, context);
    }
    toDeclStmt(name, modifiers) {
        return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers, this.sourceSpan);
    }
}
export class UnaryOperatorExpr extends Expression {
    constructor(operator, expr, type, sourceSpan, parens = true) {
        super(type || NUMBER_TYPE, sourceSpan);
        this.operator = operator;
        this.expr = expr;
        this.parens = parens;
    }
    isEquivalent(e) {
        return e instanceof UnaryOperatorExpr && this.operator === e.operator &&
            this.expr.isEquivalent(e.expr);
    }
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitUnaryOperatorExpr(this, context);
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return false;
    }
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
    isConstant() {
        return this.entries.every(e => e.isConstant());
    }
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
    isConstant() {
        return this.entries.every(e => e.value.isConstant());
    }
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
    isConstant() {
        return false;
    }
    visitExpression(visitor, context) {
        return visitor.visitCommaExpr(this, context);
    }
}
export const NULL_EXPR = new LiteralExpr(null, null, null);
export const TYPED_NULL_EXPR = new LiteralExpr(null, INFERRED_TYPE, null);
//// Statements
export var StmtModifier;
(function (StmtModifier) {
    StmtModifier[StmtModifier["None"] = 0] = "None";
    StmtModifier[StmtModifier["Final"] = 1] = "Final";
    StmtModifier[StmtModifier["Private"] = 2] = "Private";
    StmtModifier[StmtModifier["Exported"] = 4] = "Exported";
    StmtModifier[StmtModifier["Static"] = 8] = "Static";
})(StmtModifier || (StmtModifier = {}));
export class LeadingComment {
    constructor(text, multiline, trailingNewline) {
        this.text = text;
        this.multiline = multiline;
        this.trailingNewline = trailingNewline;
    }
    toString() {
        return this.multiline ? ` ${this.text} ` : this.text;
    }
}
export class JSDocComment extends LeadingComment {
    constructor(tags) {
        super('', /* multiline */ true, /* trailingNewline */ true);
        this.tags = tags;
    }
    toString() {
        return serializeTags(this.tags);
    }
}
export class Statement {
    constructor(modifiers = StmtModifier.None, sourceSpan = null, leadingComments) {
        this.modifiers = modifiers;
        this.sourceSpan = sourceSpan;
        this.leadingComments = leadingComments;
    }
    hasModifier(modifier) {
        return (this.modifiers & modifier) !== 0;
    }
    addLeadingComment(leadingComment) {
        this.leadingComments = this.leadingComments ?? [];
        this.leadingComments.push(leadingComment);
    }
}
export class DeclareVarStmt extends Statement {
    constructor(name, value, type, modifiers, sourceSpan, leadingComments) {
        super(modifiers, sourceSpan, leadingComments);
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
    constructor(name, params, statements, type, modifiers, sourceSpan, leadingComments) {
        super(modifiers, sourceSpan, leadingComments);
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
    constructor(expr, sourceSpan, leadingComments) {
        super(StmtModifier.None, sourceSpan, leadingComments);
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
    constructor(value, sourceSpan = null, leadingComments) {
        super(StmtModifier.None, sourceSpan, leadingComments);
        this.value = value;
    }
    isEquivalent(stmt) {
        return stmt instanceof ReturnStatement && this.value.isEquivalent(stmt.value);
    }
    visitStatement(visitor, context) {
        return visitor.visitReturnStmt(this, context);
    }
}
export class IfStmt extends Statement {
    constructor(condition, trueCase, falseCase = [], sourceSpan, leadingComments) {
        super(StmtModifier.None, sourceSpan, leadingComments);
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
export class RecursiveAstVisitor {
    visitType(ast, context) {
        return ast;
    }
    visitExpression(ast, context) {
        if (ast.type) {
            ast.type.visitType(this, context);
        }
        return ast;
    }
    visitBuiltinType(type, context) {
        return this.visitType(type, context);
    }
    visitExpressionType(type, context) {
        type.value.visitExpression(this, context);
        if (type.typeParams !== null) {
            type.typeParams.forEach(param => this.visitType(param, context));
        }
        return this.visitType(type, context);
    }
    visitArrayType(type, context) {
        return this.visitType(type, context);
    }
    visitMapType(type, context) {
        return this.visitType(type, context);
    }
    visitTransplantedType(type, context) {
        return type;
    }
    visitWrappedNodeExpr(ast, context) {
        return ast;
    }
    visitTypeofExpr(ast, context) {
        return this.visitExpression(ast, context);
    }
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
    visitInvokeFunctionExpr(ast, context) {
        ast.fn.visitExpression(this, context);
        this.visitAllExpressions(ast.args, context);
        return this.visitExpression(ast, context);
    }
    visitTaggedTemplateExpr(ast, context) {
        ast.tag.visitExpression(this, context);
        this.visitAllExpressions(ast.template.expressions, context);
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
    visitFunctionExpr(ast, context) {
        this.visitAllStatements(ast.statements, context);
        return this.visitExpression(ast, context);
    }
    visitUnaryOperatorExpr(ast, context) {
        ast.expr.visitExpression(this, context);
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
    visitIfStmt(stmt, context) {
        stmt.condition.visitExpression(this, context);
        this.visitAllStatements(stmt.trueCase, context);
        this.visitAllStatements(stmt.falseCase, context);
        return stmt;
    }
    visitAllStatements(stmts, context) {
        stmts.forEach(stmt => stmt.visitStatement(this, context));
    }
}
export function leadingComment(text, multiline = false, trailingNewline = true) {
    return new LeadingComment(text, multiline, trailingNewline);
}
export function jsDocComment(tags = []) {
    return new JSDocComment(tags);
}
export function variable(name, type, sourceSpan) {
    return new ReadVarExpr(name, type, sourceSpan);
}
export function importExpr(id, typeParams = null, sourceSpan) {
    return new ExternalExpr(id, null, typeParams, sourceSpan);
}
export function importType(id, typeParams, typeModifiers) {
    return id != null ? expressionType(importExpr(id, typeParams, null), typeModifiers) : null;
}
export function expressionType(expr, typeModifiers, typeParams) {
    return new ExpressionType(expr, typeModifiers, typeParams);
}
export function transplantedType(type, typeModifiers) {
    return new TransplantedType(type, typeModifiers);
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
export function unary(operator, expr, type, sourceSpan) {
    return new UnaryOperatorExpr(operator, expr, type, sourceSpan);
}
export function not(expr, sourceSpan) {
    return new NotExpr(expr, sourceSpan);
}
export function fn(params, body, type, sourceSpan, name) {
    return new FunctionExpr(params, body, type, sourceSpan, name);
}
export function ifStmt(condition, thenClause, elseClause, sourceSpan, leadingComments) {
    return new IfStmt(condition, thenClause, elseClause, sourceSpan, leadingComments);
}
export function taggedTemplate(tag, template, type, sourceSpan) {
    return new TaggedTemplateExpr(tag, template, type, sourceSpan);
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
    if (tags.length === 1 && tags[0].tagName && !tags[0].text) {
        // The JSDOC comment is a single simple tag: e.g `/** @tagname */`.
        return `*${tagToString(tags[0])} `;
    }
    let out = '*\n';
    for (const tag of tags) {
        out += ' *';
        // If the tagToString is multi-line, insert " * " prefixes on lines.
        out += tagToString(tag).replace(/\n/g, '\n * ');
        out += '\n';
    }
    out += ' ';
    return out;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFLNUMsVUFBVTtBQUNWLE1BQU0sQ0FBTixJQUFZLFlBR1g7QUFIRCxXQUFZLFlBQVk7SUFDdEIsK0NBQVEsQ0FBQTtJQUNSLGlEQUFjLENBQUE7QUFDaEIsQ0FBQyxFQUhXLFlBQVksS0FBWixZQUFZLFFBR3ZCO0FBRUQsTUFBTSxPQUFnQixJQUFJO0lBQ3hCLFlBQW1CLFlBQTBCLFlBQVksQ0FBQyxJQUFJO1FBQTNDLGNBQVMsR0FBVCxTQUFTLENBQWtDO0lBQUcsQ0FBQztJQUdsRSxXQUFXLENBQUMsUUFBc0I7UUFDaEMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNDLENBQUM7Q0FDRjtBQUVELE1BQU0sQ0FBTixJQUFZLGVBU1g7QUFURCxXQUFZLGVBQWU7SUFDekIsMkRBQU8sQ0FBQTtJQUNQLHFEQUFJLENBQUE7SUFDSix5REFBTSxDQUFBO0lBQ04sbURBQUcsQ0FBQTtJQUNILHlEQUFNLENBQUE7SUFDTiw2REFBUSxDQUFBO0lBQ1IsNkRBQVEsQ0FBQTtJQUNSLHFEQUFJLENBQUE7QUFDTixDQUFDLEVBVFcsZUFBZSxLQUFmLGVBQWUsUUFTMUI7QUFFRCxNQUFNLE9BQU8sV0FBWSxTQUFRLElBQUk7SUFDbkMsWUFBbUIsSUFBcUIsRUFBRSxTQUF3QjtRQUNoRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFEQSxTQUFJLEdBQUosSUFBSSxDQUFpQjtJQUV4QyxDQUFDO0lBQ1EsU0FBUyxDQUFDLE9BQW9CLEVBQUUsT0FBWTtRQUNuRCxPQUFPLE9BQU8s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MUUsQ0FBQztJQUVELE1BQU0sQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDdkQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUNELFNBQVMsQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDMUQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUNELFNBQVMsQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDMUQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUNELFlBQVksQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDN0QsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUNELEtBQUssQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDdEQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUNELElBQUksQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDckQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUNELE1BQU0sQ0FBQyxHQUFlLEVBQUUsVUFBaUM7UUFDdkQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsSUFB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QUFDLE1BQU0sS0FBSyxDQUFDO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFFakMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRTtRQUN6RCxtRUFBbUU7UUFDbkUsT0FBTyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0tBQ3BDO0lBRUQsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1FBQ3RCLEdBQUcsSUFBSSxJQUFJLENBQUM7UUFDWixvRUFBb0U7UUFDcEUsR0FBRyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELEdBQUcsSUFBSSxJQUFJLENBQUM7S0FDYjtJQUNELEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDWCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjb21wdXRlTXNnSWR9IGZyb20gJy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCB7TWVzc2FnZX0gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0kxOG5NZXRhfSBmcm9tICcuLi9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhJztcblxuLy8vLyBUeXBlc1xuZXhwb3J0IGVudW0gVHlwZU1vZGlmaWVyIHtcbiAgTm9uZSA9IDAsXG4gIENvbnN0ID0gMSA8PCAwLFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2RpZmllcnM6IFR5cGVNb2RpZmllciA9IFR5cGVNb2RpZmllci5Ob25lKSB7fVxuICBhYnN0cmFjdCB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICBoYXNNb2RpZmllcihtb2RpZmllcjogVHlwZU1vZGlmaWVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLm1vZGlmaWVycyAmIG1vZGlmaWVyKSAhPT0gMDtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBCdWlsdGluVHlwZU5hbWUge1xuICBEeW5hbWljLFxuICBCb29sLFxuICBTdHJpbmcsXG4gIEludCxcbiAgTnVtYmVyLFxuICBGdW5jdGlvbixcbiAgSW5mZXJyZWQsXG4gIE5vbmUsXG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogQnVpbHRpblR5cGVOYW1lLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJ1aWx0aW5UeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgbW9kaWZpZXJzPzogVHlwZU1vZGlmaWVyLCBwdWJsaWMgdHlwZVBhcmFtczogVHlwZVtdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHByZXNzaW9uVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBBcnJheVR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG9mOiBUeXBlLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFycmF5VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBNYXBUeXBlIGV4dGVuZHMgVHlwZSB7XG4gIHB1YmxpYyB2YWx1ZVR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IodmFsdWVUeXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICAgIHRoaXMudmFsdWVUeXBlID0gdmFsdWVUeXBlIHx8IG51bGw7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TWFwVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBUcmFuc3BsYW50ZWRUeXBlPFQ+IGV4dGVuZHMgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHR5cGU6IFQsIG1vZGlmaWVycz86IFR5cGVNb2RpZmllcikge1xuICAgIHN1cGVyKG1vZGlmaWVycyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VHJhbnNwbGFudGVkVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjb25zdCBEWU5BTUlDX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkR5bmFtaWMpO1xuZXhwb3J0IGNvbnN0IElORkVSUkVEX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkluZmVycmVkKTtcbmV4cG9ydCBjb25zdCBCT09MX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkJvb2wpO1xuZXhwb3J0IGNvbnN0IElOVF9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5JbnQpO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5OdW1iZXIpO1xuZXhwb3J0IGNvbnN0IFNUUklOR19UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5TdHJpbmcpO1xuZXhwb3J0IGNvbnN0IEZVTkNUSU9OX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkZ1bmN0aW9uKTtcbmV4cG9ydCBjb25zdCBOT05FX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLk5vbmUpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVWaXNpdG9yIHtcbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cHJlc3Npb25UeXBlKHR5cGU6IEV4cHJlc3Npb25UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRyYW5zcGxhbnRlZFR5cGUodHlwZTogVHJhbnNwbGFudGVkVHlwZTx1bmtub3duPiwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vLy8vLyBFeHByZXNzaW9uc1xuXG5leHBvcnQgZW51bSBVbmFyeU9wZXJhdG9yIHtcbiAgTWludXMsXG4gIFBsdXMsXG59XG5cbmV4cG9ydCBlbnVtIEJpbmFyeU9wZXJhdG9yIHtcbiAgRXF1YWxzLFxuICBOb3RFcXVhbHMsXG4gIElkZW50aWNhbCxcbiAgTm90SWRlbnRpY2FsLFxuICBNaW51cyxcbiAgUGx1cyxcbiAgRGl2aWRlLFxuICBNdWx0aXBseSxcbiAgTW9kdWxvLFxuICBBbmQsXG4gIE9yLFxuICBCaXR3aXNlQW5kLFxuICBMb3dlcixcbiAgTG93ZXJFcXVhbHMsXG4gIEJpZ2dlcixcbiAgQmlnZ2VyRXF1YWxzLFxuICBOdWxsaXNoQ29hbGVzY2UsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBudWxsU2FmZUlzRXF1aXZhbGVudDxUIGV4dGVuZHMge2lzRXF1aXZhbGVudChvdGhlcjogVCk6IGJvb2xlYW59PihcbiAgICBiYXNlOiBUfG51bGwsIG90aGVyOiBUfG51bGwpIHtcbiAgaWYgKGJhc2UgPT0gbnVsbCB8fCBvdGhlciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGJhc2UgPT0gb3RoZXI7XG4gIH1cbiAgcmV0dXJuIGJhc2UuaXNFcXVpdmFsZW50KG90aGVyKTtcbn1cblxuZnVuY3Rpb24gYXJlQWxsRXF1aXZhbGVudFByZWRpY2F0ZTxUPihcbiAgICBiYXNlOiBUW10sIG90aGVyOiBUW10sIGVxdWl2YWxlbnRQcmVkaWNhdGU6IChiYXNlRWxlbWVudDogVCwgb3RoZXJFbGVtZW50OiBUKSA9PiBib29sZWFuKSB7XG4gIGNvbnN0IGxlbiA9IGJhc2UubGVuZ3RoO1xuICBpZiAobGVuICE9PSBvdGhlci5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghZXF1aXZhbGVudFByZWRpY2F0ZShiYXNlW2ldLCBvdGhlcltpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmVBbGxFcXVpdmFsZW50PFQgZXh0ZW5kcyB7aXNFcXVpdmFsZW50KG90aGVyOiBUKTogYm9vbGVhbn0+KFxuICAgIGJhc2U6IFRbXSwgb3RoZXI6IFRbXSkge1xuICByZXR1cm4gYXJlQWxsRXF1aXZhbGVudFByZWRpY2F0ZShcbiAgICAgIGJhc2UsIG90aGVyLCAoYmFzZUVsZW1lbnQ6IFQsIG90aGVyRWxlbWVudDogVCkgPT4gYmFzZUVsZW1lbnQuaXNFcXVpdmFsZW50KG90aGVyRWxlbWVudCkpO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcblxuICBjb25zdHJ1Y3Rvcih0eXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VTcGFuID0gc291cmNlU3BhbiB8fCBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIGV4cHJlc3Npb24gcHJvZHVjZXMgdGhlIHNhbWUgdmFsdWUgYXMgdGhlIGdpdmVuIGV4cHJlc3Npb24uXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIGNvbnN0YW50LlxuICAgKi9cbiAgYWJzdHJhY3QgaXNDb25zdGFudCgpOiBib29sZWFuO1xuXG4gIHByb3AobmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgUmVhZFByb3BFeHByKHRoaXMsIG5hbWUsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAga2V5KGluZGV4OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWFkS2V5RXhwcih0aGlzLCBpbmRleCwgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjYWxsRm4ocGFyYW1zOiBFeHByZXNzaW9uW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVyZT86IGJvb2xlYW4pOlxuICAgICAgSW52b2tlRnVuY3Rpb25FeHByIHtcbiAgICByZXR1cm4gbmV3IEludm9rZUZ1bmN0aW9uRXhwcih0aGlzLCBwYXJhbXMsIG51bGwsIHNvdXJjZVNwYW4sIHB1cmUpO1xuICB9XG5cbiAgaW5zdGFudGlhdGUocGFyYW1zOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6XG4gICAgICBJbnN0YW50aWF0ZUV4cHIge1xuICAgIHJldHVybiBuZXcgSW5zdGFudGlhdGVFeHByKHRoaXMsIHBhcmFtcywgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjb25kaXRpb25hbChcbiAgICAgIHRydWVDYXNlOiBFeHByZXNzaW9uLCBmYWxzZUNhc2U6IEV4cHJlc3Npb258bnVsbCA9IG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBDb25kaXRpb25hbEV4cHIge1xuICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWxFeHByKHRoaXMsIHRydWVDYXNlLCBmYWxzZUNhc2UsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgZXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5FcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbm90RXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaWRlbnRpY2FsKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5JZGVudGljYWwsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbm90SWRlbnRpY2FsKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWwsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbWludXMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk1pbnVzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIHBsdXMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLlBsdXMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgZGl2aWRlKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5EaXZpZGUsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbXVsdGlwbHkocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk11bHRpcGx5LCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG1vZHVsbyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTW9kdWxvLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGFuZChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQW5kLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGJpdHdpc2VBbmQocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHBhcmVuczogYm9vbGVhbiA9IHRydWUpOlxuICAgICAgQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5CaXR3aXNlQW5kLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4sIHBhcmVucyk7XG4gIH1cbiAgb3IocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk9yLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGxvd2VyKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Mb3dlciwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBsb3dlckVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYmlnZ2VyKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5CaWdnZXIsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYmlnZ2VyRXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNCbGFuayhzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBFeHByZXNzaW9uIHtcbiAgICAvLyBOb3RlOiBXZSB1c2UgZXF1YWxzIGJ5IHB1cnBvc2UgaGVyZSB0byBjb21wYXJlIHRvIG51bGwgYW5kIHVuZGVmaW5lZCBpbiBKUy5cbiAgICAvLyBXZSB1c2UgdGhlIHR5cGVkIG51bGwgdG8gYWxsb3cgc3RyaWN0TnVsbENoZWNrcyB0byBuYXJyb3cgdHlwZXMuXG4gICAgcmV0dXJuIHRoaXMuZXF1YWxzKFRZUEVEX05VTExfRVhQUiwgc291cmNlU3Bhbik7XG4gIH1cbiAgbnVsbGlzaENvYWxlc2NlKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5OdWxsaXNoQ29hbGVzY2UsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICB0b1N0bXQoKTogU3RhdGVtZW50IHtcbiAgICByZXR1cm4gbmV3IEV4cHJlc3Npb25TdGF0ZW1lbnQodGhpcywgbnVsbCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlYWRWYXJFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlYWRWYXJFeHByICYmIHRoaXMubmFtZSA9PT0gZS5uYW1lO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWFkVmFyRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlVmFyRXhwciB7XG4gICAgcmV0dXJuIG5ldyBXcml0ZVZhckV4cHIodGhpcy5uYW1lLCB2YWx1ZSwgbnVsbCwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVHlwZW9mRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VHlwZW9mRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBUeXBlb2ZFeHByICYmIGUuZXhwci5pc0VxdWl2YWxlbnQodGhpcy5leHByKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZXhwci5pc0NvbnN0YW50KCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdyYXBwZWROb2RlRXhwcjxUPiBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbm9kZTogVCwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgV3JhcHBlZE5vZGVFeHByICYmIHRoaXMubm9kZSA9PT0gZS5ub2RlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcmFwcGVkTm9kZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdyaXRlVmFyRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb247XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlVmFyRXhwciAmJiB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JpdGVWYXJFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdG9EZWNsU3RtdCh0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXIpOiBEZWNsYXJlVmFyU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlVmFyU3RtdCh0aGlzLm5hbWUsIHRoaXMudmFsdWUsIHR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvQ29uc3REZWNsKCk6IERlY2xhcmVWYXJTdG10IHtcbiAgICByZXR1cm4gdGhpcy50b0RlY2xTdG10KElORkVSUkVEX1RZUEUsIFN0bXRNb2RpZmllci5GaW5hbCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgV3JpdGVLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBpbmRleDogRXhwcmVzc2lvbiwgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZUtleUV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5pbmRleC5pc0VxdWl2YWxlbnQoZS5pbmRleCkgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyaXRlS2V5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXcml0ZVByb3BFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSB8fCB2YWx1ZS50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgV3JpdGVQcm9wRXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JpdGVQcm9wRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSW52b2tlRnVuY3Rpb25FeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGZuOiBFeHByZXNzaW9uLCBwdWJsaWMgYXJnczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgcHVyZSA9IGZhbHNlKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgSW52b2tlRnVuY3Rpb25FeHByICYmIHRoaXMuZm4uaXNFcXVpdmFsZW50KGUuZm4pICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpICYmIHRoaXMucHVyZSA9PT0gZS5wdXJlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnZva2VGdW5jdGlvbkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgVGFnZ2VkVGVtcGxhdGVFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRhZzogRXhwcmVzc2lvbiwgcHVibGljIHRlbXBsYXRlOiBUZW1wbGF0ZUxpdGVyYWwsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBUYWdnZWRUZW1wbGF0ZUV4cHIgJiYgdGhpcy50YWcuaXNFcXVpdmFsZW50KGUudGFnKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50UHJlZGljYXRlKFxuICAgICAgICAgICAgICAgdGhpcy50ZW1wbGF0ZS5lbGVtZW50cywgZS50ZW1wbGF0ZS5lbGVtZW50cywgKGEsIGIpID0+IGEudGV4dCA9PT0gYi50ZXh0KSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMudGVtcGxhdGUuZXhwcmVzc2lvbnMsIGUudGVtcGxhdGUuZXhwcmVzc2lvbnMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgSW5zdGFudGlhdGVFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNsYXNzRXhwcjogRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEluc3RhbnRpYXRlRXhwciAmJiB0aGlzLmNsYXNzRXhwci5pc0VxdWl2YWxlbnQoZS5jbGFzc0V4cHIpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnN0YW50aWF0ZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IG51bWJlcnxzdHJpbmd8Ym9vbGVhbnxudWxsfHVuZGVmaW5lZCwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxFeHByICYmIHRoaXMudmFsdWUgPT09IGUudmFsdWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlTGl0ZXJhbCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlbGVtZW50czogVGVtcGxhdGVMaXRlcmFsRWxlbWVudFtdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSkge31cbn1cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZUxpdGVyYWxFbGVtZW50IHtcbiAgcmF3VGV4dDogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nLCBwdWJsaWMgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiwgcmF3VGV4dD86IHN0cmluZykge1xuICAgIC8vIElmIGByYXdUZXh0YCBpcyBub3QgcHJvdmlkZWQsIHRyeSB0byBleHRyYWN0IHRoZSByYXcgc3RyaW5nIGZyb20gaXRzXG4gICAgLy8gYXNzb2NpYXRlZCBgc291cmNlU3BhbmAuIElmIHRoYXQgaXMgYWxzbyBub3QgYXZhaWxhYmxlLCBcImZha2VcIiB0aGUgcmF3XG4gICAgLy8gc3RyaW5nIGluc3RlYWQgYnkgZXNjYXBpbmcgdGhlIGZvbGxvd2luZyBjb250cm9sIHNlcXVlbmNlczpcbiAgICAvLyAtIFwiXFxcIiB3b3VsZCBvdGhlcndpc2UgaW5kaWNhdGUgdGhhdCB0aGUgbmV4dCBjaGFyYWN0ZXIgaXMgYSBjb250cm9sIGNoYXJhY3Rlci5cbiAgICAvLyAtIFwiYFwiIGFuZCBcIiR7XCIgYXJlIHRlbXBsYXRlIHN0cmluZyBjb250cm9sIHNlcXVlbmNlcyB0aGF0IHdvdWxkIG90aGVyd2lzZSBwcmVtYXR1cmVseVxuICAgIC8vIGluZGljYXRlIHRoZSBlbmQgb2YgdGhlIHRlbXBsYXRlIGxpdGVyYWwgZWxlbWVudC5cbiAgICB0aGlzLnJhd1RleHQgPVxuICAgICAgICByYXdUZXh0ID8/IHNvdXJjZVNwYW4/LnRvU3RyaW5nKCkgPz8gZXNjYXBlRm9yVGVtcGxhdGVMaXRlcmFsKGVzY2FwZVNsYXNoZXModGV4dCkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsUGllY2Uge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuZXhwb3J0IGNsYXNzIFBsYWNlaG9sZGVyUGllY2Uge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGEgYFBsYWNlaG9sZGVyUGllY2VgLlxuICAgKlxuICAgKiBAcGFyYW0gdGV4dCB0aGUgbmFtZSBvZiB0aGlzIHBsYWNlaG9sZGVyIChlLmcuIGBQSF8xYCkuXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIHRoZSBsb2NhdGlvbiBvZiB0aGlzIHBsYWNlaG9sZGVyIGluIGl0cyBsb2NhbGl6ZWQgbWVzc2FnZSB0aGUgc291cmNlIGNvZGUuXG4gICAqIEBwYXJhbSBhc3NvY2lhdGVkTWVzc2FnZSByZWZlcmVuY2UgdG8gYW5vdGhlciBtZXNzYWdlIHRoYXQgdGhpcyBwbGFjZWhvbGRlciBpcyBhc3NvY2lhdGVkIHdpdGguXG4gICAqIFRoZSBgYXNzb2NpYXRlZE1lc3NhZ2VgIGlzIG1haW5seSB1c2VkIHRvIHByb3ZpZGUgYSByZWxhdGlvbnNoaXAgdG8gYW4gSUNVIG1lc3NhZ2UgdGhhdCBoYXNcbiAgICogYmVlbiBleHRyYWN0ZWQgb3V0IGZyb20gdGhlIG1lc3NhZ2UgY29udGFpbmluZyB0aGUgcGxhY2Vob2xkZXIuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZXh0OiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBhc3NvY2lhdGVkTWVzc2FnZT86IE1lc3NhZ2UpIHtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBNZXNzYWdlUGllY2UgPSBMaXRlcmFsUGllY2V8UGxhY2Vob2xkZXJQaWVjZTtcblxuY29uc3QgTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJRF9TRVBBUkFUT1IgPSAnQEAnO1xuY29uc3QgTEVHQUNZX0lEX0lORElDQVRPUiA9ICfikJ8nO1xuXG5leHBvcnQgY2xhc3MgTG9jYWxpemVkU3RyaW5nIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgbWV0YUJsb2NrOiBJMThuTWV0YSwgcmVhZG9ubHkgbWVzc2FnZVBhcnRzOiBMaXRlcmFsUGllY2VbXSxcbiAgICAgIHJlYWRvbmx5IHBsYWNlSG9sZGVyTmFtZXM6IFBsYWNlaG9sZGVyUGllY2VbXSwgcmVhZG9ubHkgZXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKFNUUklOR19UWVBFLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgLy8gcmV0dXJuIGUgaW5zdGFuY2VvZiBMb2NhbGl6ZWRTdHJpbmcgJiYgdGhpcy5tZXNzYWdlID09PSBlLm1lc3NhZ2U7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMb2NhbGl6ZWRTdHJpbmcodGhpcywgY29udGV4dCk7XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXplIHRoZSBnaXZlbiBgbWV0YWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBcImNvb2tlZFwiIGFuZCBcInJhd1wiIHN0cmluZ3MgdGhhdCBjYW4gYmUgdXNlZFxuICAgKiBpbiBhIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuIFRoZSBmb3JtYXQgb2YgdGhlIG1ldGFkYXRhIGlzIHRoZSBzYW1lIGFzIHRoYXQgcGFyc2VkIGJ5XG4gICAqIGBwYXJzZUkxOG5NZXRhKClgLlxuICAgKlxuICAgKiBAcGFyYW0gbWV0YSBUaGUgbWV0YWRhdGEgdG8gc2VyaWFsaXplXG4gICAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZmlyc3QgcGFydCBvZiB0aGUgdGFnZ2VkIHN0cmluZ1xuICAgKi9cbiAgc2VyaWFsaXplSTE4bkhlYWQoKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgICBsZXQgbWV0YUJsb2NrID0gdGhpcy5tZXRhQmxvY2suZGVzY3JpcHRpb24gfHwgJyc7XG4gICAgaWYgKHRoaXMubWV0YUJsb2NrLm1lYW5pbmcpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke3RoaXMubWV0YUJsb2NrLm1lYW5pbmd9JHtNRUFOSU5HX1NFUEFSQVRPUn0ke21ldGFCbG9ja31gO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZXRhQmxvY2suY3VzdG9tSWQpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja30ke0lEX1NFUEFSQVRPUn0ke3RoaXMubWV0YUJsb2NrLmN1c3RvbUlkfWA7XG4gICAgfVxuICAgIGlmICh0aGlzLm1ldGFCbG9jay5sZWdhY3lJZHMpIHtcbiAgICAgIHRoaXMubWV0YUJsb2NrLmxlZ2FjeUlkcy5mb3JFYWNoKGxlZ2FjeUlkID0+IHtcbiAgICAgICAgbWV0YUJsb2NrID0gYCR7bWV0YUJsb2NrfSR7TEVHQUNZX0lEX0lORElDQVRPUn0ke2xlZ2FjeUlkfWA7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhcbiAgICAgICAgbWV0YUJsb2NrLCB0aGlzLm1lc3NhZ2VQYXJ0c1swXS50ZXh0LCB0aGlzLmdldE1lc3NhZ2VQYXJ0U291cmNlU3BhbigwKSk7XG4gIH1cblxuICBnZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VQYXJ0c1tpXT8uc291cmNlU3BhbiA/PyB0aGlzLnNvdXJjZVNwYW47XG4gIH1cblxuICBnZXRQbGFjZWhvbGRlclNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gdGhpcy5wbGFjZUhvbGRlck5hbWVzW2ldPy5zb3VyY2VTcGFuID8/IHRoaXMuZXhwcmVzc2lvbnNbaV0/LnNvdXJjZVNwYW4gPz9cbiAgICAgICAgdGhpcy5zb3VyY2VTcGFuO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYHBsYWNlaG9sZGVyTmFtZWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBcImNvb2tlZFwiIGFuZCBcInJhd1wiIHN0cmluZ3MgdGhhdFxuICAgKiBjYW4gYmUgdXNlZCBpbiBhIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gICAqXG4gICAqIFRoZSBmb3JtYXQgaXMgYDo8cGxhY2Vob2xkZXItbmFtZT5bQEA8YXNzb2NpYXRlZC1pZD5dOmAuXG4gICAqXG4gICAqIFRoZSBgYXNzb2NpYXRlZC1pZGAgaXMgdGhlIG1lc3NhZ2UgaWQgb2YgdGhlICh1c3VhbGx5IGFuIElDVSkgbWVzc2FnZSB0byB3aGljaCB0aGlzIHBsYWNlaG9sZGVyXG4gICAqIHJlZmVycy5cbiAgICpcbiAgICogQHBhcmFtIHBhcnRJbmRleCBUaGUgaW5kZXggb2YgdGhlIG1lc3NhZ2UgcGFydCB0byBzZXJpYWxpemUuXG4gICAqL1xuICBzZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KHBhcnRJbmRleDogbnVtYmVyKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgICBjb25zdCBwbGFjZWhvbGRlciA9IHRoaXMucGxhY2VIb2xkZXJOYW1lc1twYXJ0SW5kZXggLSAxXTtcbiAgICBjb25zdCBtZXNzYWdlUGFydCA9IHRoaXMubWVzc2FnZVBhcnRzW3BhcnRJbmRleF07XG4gICAgbGV0IG1ldGFCbG9jayA9IHBsYWNlaG9sZGVyLnRleHQ7XG4gICAgaWYgKHBsYWNlaG9sZGVyLmFzc29jaWF0ZWRNZXNzYWdlPy5sZWdhY3lJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBtZXRhQmxvY2sgKz0gYCR7SURfU0VQQVJBVE9SfSR7XG4gICAgICAgICAgY29tcHV0ZU1zZ0lkKFxuICAgICAgICAgICAgICBwbGFjZWhvbGRlci5hc3NvY2lhdGVkTWVzc2FnZS5tZXNzYWdlU3RyaW5nLCBwbGFjZWhvbGRlci5hc3NvY2lhdGVkTWVzc2FnZS5tZWFuaW5nKX1gO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ29va2VkUmF3U3RyaW5nKFxuICAgICAgICBtZXRhQmxvY2ssIG1lc3NhZ2VQYXJ0LnRleHQsIHRoaXMuZ2V0TWVzc2FnZVBhcnRTb3VyY2VTcGFuKHBhcnRJbmRleCkpO1xuICB9XG59XG5cbi8qKlxuICogQSBzdHJ1Y3R1cmUgdG8gaG9sZCB0aGUgY29va2VkIGFuZCByYXcgc3RyaW5ncyBvZiBhIHRlbXBsYXRlIGxpdGVyYWwgZWxlbWVudCwgYWxvbmcgd2l0aCBpdHNcbiAqIHNvdXJjZS1zcGFuIHJhbmdlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvb2tlZFJhd1N0cmluZyB7XG4gIGNvb2tlZDogc3RyaW5nO1xuICByYXc6IHN0cmluZztcbiAgcmFuZ2U6IFBhcnNlU291cmNlU3BhbnxudWxsO1xufVxuXG5jb25zdCBlc2NhcGVTbGFzaGVzID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+IHN0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpO1xuY29uc3QgZXNjYXBlU3RhcnRpbmdDb2xvbiA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUNvbG9ucyA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUZvclRlbXBsYXRlTGl0ZXJhbCA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PlxuICAgIHN0ci5yZXBsYWNlKC9gL2csICdcXFxcYCcpLnJlcGxhY2UoL1xcJHsvZywgJyRcXFxceycpO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBge2Nvb2tlZCwgcmF3fWAgb2JqZWN0IGZyb20gdGhlIGBtZXRhQmxvY2tgIGFuZCBgbWVzc2FnZVBhcnRgLlxuICpcbiAqIFRoZSBgcmF3YCB0ZXh0IG11c3QgaGF2ZSB2YXJpb3VzIGNoYXJhY3RlciBzZXF1ZW5jZXMgZXNjYXBlZDpcbiAqICogXCJcXFwiIHdvdWxkIG90aGVyd2lzZSBpbmRpY2F0ZSB0aGF0IHRoZSBuZXh0IGNoYXJhY3RlciBpcyBhIGNvbnRyb2wgY2hhcmFjdGVyLlxuICogKiBcImBcIiBhbmQgXCIke1wiIGFyZSB0ZW1wbGF0ZSBzdHJpbmcgY29udHJvbCBzZXF1ZW5jZXMgdGhhdCB3b3VsZCBvdGhlcndpc2UgcHJlbWF0dXJlbHkgaW5kaWNhdGVcbiAqICAgdGhlIGVuZCBvZiBhIG1lc3NhZ2UgcGFydC5cbiAqICogXCI6XCIgaW5zaWRlIGEgbWV0YWJsb2NrIHdvdWxkIHByZW1hdHVyZWx5IGluZGljYXRlIHRoZSBlbmQgb2YgdGhlIG1ldGFibG9jay5cbiAqICogXCI6XCIgYXQgdGhlIHN0YXJ0IG9mIGEgbWVzc2FnZVBhcnQgd2l0aCBubyBtZXRhYmxvY2sgd291bGQgZXJyb25lb3VzbHkgaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGFcbiAqICAgbWV0YWJsb2NrLlxuICpcbiAqIEBwYXJhbSBtZXRhQmxvY2sgQW55IG1ldGFkYXRhIHRoYXQgc2hvdWxkIGJlIHByZXBlbmRlZCB0byB0aGUgc3RyaW5nXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIG1lc3NhZ2UgcGFydCBvZiB0aGUgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhcbiAgICBtZXRhQmxvY2s6IHN0cmluZywgbWVzc2FnZVBhcnQ6IHN0cmluZywgcmFuZ2U6IFBhcnNlU291cmNlU3BhbnxudWxsKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgaWYgKG1ldGFCbG9jayA9PT0gJycpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29va2VkOiBtZXNzYWdlUGFydCxcbiAgICAgIHJhdzogZXNjYXBlRm9yVGVtcGxhdGVMaXRlcmFsKGVzY2FwZVN0YXJ0aW5nQ29sb24oZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCkpKSxcbiAgICAgIHJhbmdlLFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogYDoke21ldGFCbG9ja306JHttZXNzYWdlUGFydH1gLFxuICAgICAgcmF3OiBlc2NhcGVGb3JUZW1wbGF0ZUxpdGVyYWwoXG4gICAgICAgICAgYDoke2VzY2FwZUNvbG9ucyhlc2NhcGVTbGFzaGVzKG1ldGFCbG9jaykpfToke2VzY2FwZVNsYXNoZXMobWVzc2FnZVBhcnQpfWApLFxuICAgICAgcmFuZ2UsXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZXJuYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBFeHRlcm5hbFJlZmVyZW5jZSwgdHlwZT86IFR5cGV8bnVsbCwgcHVibGljIHR5cGVQYXJhbXM6IFR5cGVbXXxudWxsID0gbnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEV4dGVybmFsRXhwciAmJiB0aGlzLnZhbHVlLm5hbWUgPT09IGUudmFsdWUubmFtZSAmJlxuICAgICAgICB0aGlzLnZhbHVlLm1vZHVsZU5hbWUgPT09IGUudmFsdWUubW9kdWxlTmFtZSAmJiB0aGlzLnZhbHVlLnJ1bnRpbWUgPT09IGUudmFsdWUucnVudGltZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXh0ZXJuYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlcm5hbFJlZmVyZW5jZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2R1bGVOYW1lOiBzdHJpbmd8bnVsbCwgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgcnVudGltZT86IGFueXxudWxsKSB7XG4gIH1cbiAgLy8gTm90ZTogbm8gaXNFcXVpdmFsZW50IG1ldGhvZCBoZXJlIGFzIHdlIHVzZSB0aGlzIGFzIGFuIGludGVyZmFjZSB0b28uXG59XG5cbmV4cG9ydCBjbGFzcyBDb25kaXRpb25hbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHRydWVDYXNlOiBFeHByZXNzaW9uO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgdHJ1ZUNhc2U6IEV4cHJlc3Npb24sIHB1YmxpYyBmYWxzZUNhc2U6IEV4cHJlc3Npb258bnVsbCA9IG51bGwsXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHRydWVDYXNlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHJ1ZUNhc2UgPSB0cnVlQ2FzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDb25kaXRpb25hbEV4cHIgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKSAmJlxuICAgICAgICB0aGlzLnRydWVDYXNlLmlzRXF1aXZhbGVudChlLnRydWVDYXNlKSAmJiBudWxsU2FmZUlzRXF1aXZhbGVudCh0aGlzLmZhbHNlQ2FzZSwgZS5mYWxzZUNhc2UpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb25kaXRpb25hbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTm90RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29uZGl0aW9uOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihCT09MX1RZUEUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIE5vdEV4cHIgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Tm90RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRm5QYXJhbSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBUeXBlfG51bGwgPSBudWxsKSB7fVxuXG4gIGlzRXF1aXZhbGVudChwYXJhbTogRm5QYXJhbSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IHBhcmFtLm5hbWU7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgRnVuY3Rpb25FeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHBhcmFtczogRm5QYXJhbVtdLCBwdWJsaWMgc3RhdGVtZW50czogU3RhdGVtZW50W10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBuYW1lPzogc3RyaW5nfG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBGdW5jdGlvbkV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnBhcmFtcywgZS5wYXJhbXMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5zdGF0ZW1lbnRzLCBlLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGdW5jdGlvbkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICB0b0RlY2xTdG10KG5hbWU6IHN0cmluZywgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyKTogRGVjbGFyZUZ1bmN0aW9uU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlRnVuY3Rpb25TdG10KFxuICAgICAgICBuYW1lLCB0aGlzLnBhcmFtcywgdGhpcy5zdGF0ZW1lbnRzLCB0aGlzLnR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBVbmFyeU9wZXJhdG9yRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBvcGVyYXRvcjogVW5hcnlPcGVyYXRvciwgcHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBwYXJlbnM6IGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgc3VwZXIodHlwZSB8fCBOVU1CRVJfVFlQRSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgVW5hcnlPcGVyYXRvckV4cHIgJiYgdGhpcy5vcGVyYXRvciA9PT0gZS5vcGVyYXRvciAmJlxuICAgICAgICB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KGUuZXhwcik7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFVuYXJ5T3BlcmF0b3JFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEJpbmFyeU9wZXJhdG9yRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgbGhzOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBvcGVyYXRvcjogQmluYXJ5T3BlcmF0b3IsIGxoczogRXhwcmVzc2lvbiwgcHVibGljIHJoczogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIHBhcmVuczogYm9vbGVhbiA9IHRydWUpIHtcbiAgICBzdXBlcih0eXBlIHx8IGxocy50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLmxocyA9IGxocztcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBCaW5hcnlPcGVyYXRvckV4cHIgJiYgdGhpcy5vcGVyYXRvciA9PT0gZS5vcGVyYXRvciAmJlxuICAgICAgICB0aGlzLmxocy5pc0VxdWl2YWxlbnQoZS5saHMpICYmIHRoaXMucmhzLmlzRXF1aXZhbGVudChlLnJocyk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJpbmFyeU9wZXJhdG9yRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBSZWFkUHJvcEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkUHJvcEV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5uYW1lID09PSBlLm5hbWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlYWRQcm9wRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVQcm9wRXhwcih0aGlzLnJlY2VpdmVyLCB0aGlzLm5hbWUsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBwdWJsaWMgaW5kZXg6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVhZEtleUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZUtleUV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVLZXlFeHByKHRoaXMucmVjZWl2ZXIsIHRoaXMuaW5kZXgsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxBcnJheUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIGVudHJpZXM6IEV4cHJlc3Npb25bXTtcbiAgY29uc3RydWN0b3IoZW50cmllczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS5pc0NvbnN0YW50KCkpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxBcnJheUV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmVudHJpZXMsIGUuZW50cmllcyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEFycmF5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbE1hcEVudHJ5IHtcbiAgY29uc3RydWN0b3IocHVibGljIGtleTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIHB1YmxpYyBxdW90ZWQ6IGJvb2xlYW4pIHt9XG4gIGlzRXF1aXZhbGVudChlOiBMaXRlcmFsTWFwRW50cnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5rZXkgPT09IGUua2V5ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWVUeXBlOiBUeXBlfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBlbnRyaWVzOiBMaXRlcmFsTWFwRW50cnlbXSwgdHlwZT86IE1hcFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHRoaXMudmFsdWVUeXBlID0gdHlwZS52YWx1ZVR5cGU7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxNYXBFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5lbnRyaWVzLCBlLmVudHJpZXMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS52YWx1ZS5pc0NvbnN0YW50KCkpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbE1hcEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbW1hRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcGFydHM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIocGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29tbWFFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJ0cywgZS5wYXJ0cyk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbW1hRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4cHJlc3Npb25WaXNpdG9yIHtcbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IFdyaXRlVmFyRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBXcml0ZUtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcml0ZVByb3BFeHByKGV4cHI6IFdyaXRlUHJvcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBJbnZva2VGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIoYXN0OiBUYWdnZWRUZW1wbGF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IExpdGVyYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogQ29uZGl0aW9uYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Tm90RXhwcihhc3Q6IE5vdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogQmluYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBMaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNvbnN0IE5VTExfRVhQUiA9IG5ldyBMaXRlcmFsRXhwcihudWxsLCBudWxsLCBudWxsKTtcbmV4cG9ydCBjb25zdCBUWVBFRF9OVUxMX0VYUFIgPSBuZXcgTGl0ZXJhbEV4cHIobnVsbCwgSU5GRVJSRURfVFlQRSwgbnVsbCk7XG5cbi8vLy8gU3RhdGVtZW50c1xuZXhwb3J0IGVudW0gU3RtdE1vZGlmaWVyIHtcbiAgTm9uZSA9IDAsXG4gIEZpbmFsID0gMSA8PCAwLFxuICBQcml2YXRlID0gMSA8PCAxLFxuICBFeHBvcnRlZCA9IDEgPDwgMixcbiAgU3RhdGljID0gMSA8PCAzLFxufVxuXG5leHBvcnQgY2xhc3MgTGVhZGluZ0NvbW1lbnQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nLCBwdWJsaWMgbXVsdGlsaW5lOiBib29sZWFuLCBwdWJsaWMgdHJhaWxpbmdOZXdsaW5lOiBib29sZWFuKSB7fVxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy5tdWx0aWxpbmUgPyBgICR7dGhpcy50ZXh0fSBgIDogdGhpcy50ZXh0O1xuICB9XG59XG5leHBvcnQgY2xhc3MgSlNEb2NDb21tZW50IGV4dGVuZHMgTGVhZGluZ0NvbW1lbnQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGFnczogSlNEb2NUYWdbXSkge1xuICAgIHN1cGVyKCcnLCAvKiBtdWx0aWxpbmUgKi8gdHJ1ZSwgLyogdHJhaWxpbmdOZXdsaW5lICovIHRydWUpO1xuICB9XG4gIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHNlcmlhbGl6ZVRhZ3ModGhpcy50YWdzKTtcbiAgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXIgPSBTdG10TW9kaWZpZXIuTm9uZSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIHB1YmxpYyBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7fVxuICAvKipcbiAgICogQ2FsY3VsYXRlcyB3aGV0aGVyIHRoaXMgc3RhdGVtZW50IHByb2R1Y2VzIHRoZSBzYW1lIHZhbHVlIGFzIHRoZSBnaXZlbiBzdGF0ZW1lbnQuXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbjtcblxuICBhYnN0cmFjdCB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgaGFzTW9kaWZpZXIobW9kaWZpZXI6IFN0bXRNb2RpZmllcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiAodGhpcy5tb2RpZmllcnMgJiBtb2RpZmllcikgIT09IDA7XG4gIH1cblxuICBhZGRMZWFkaW5nQ29tbWVudChsZWFkaW5nQ29tbWVudDogTGVhZGluZ0NvbW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmxlYWRpbmdDb21tZW50cyA9IHRoaXMubGVhZGluZ0NvbW1lbnRzID8/IFtdO1xuICAgIHRoaXMubGVhZGluZ0NvbW1lbnRzLnB1c2gobGVhZGluZ0NvbW1lbnQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIERlY2xhcmVWYXJTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU/OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXIsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gICAgdGhpcy50eXBlID0gdHlwZSB8fCAodmFsdWUgJiYgdmFsdWUudHlwZSkgfHwgbnVsbDtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBEZWNsYXJlVmFyU3RtdCAmJiB0aGlzLm5hbWUgPT09IHN0bXQubmFtZSAmJlxuICAgICAgICAodGhpcy52YWx1ZSA/ICEhc3RtdC52YWx1ZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChzdG10LnZhbHVlKSA6ICFzdG10LnZhbHVlKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVjbGFyZVZhclN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlY2xhcmVGdW5jdGlvblN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBwdWJsaWMgdHlwZTogVHlwZXxudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBwYXJhbXM6IEZuUGFyYW1bXSwgcHVibGljIHN0YXRlbWVudHM6IFN0YXRlbWVudFtdLFxuICAgICAgdHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzLCBzb3VyY2VTcGFuLCBsZWFkaW5nQ29tbWVudHMpO1xuICAgIHRoaXMudHlwZSA9IHR5cGUgfHwgbnVsbDtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBEZWNsYXJlRnVuY3Rpb25TdG10ICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJhbXMsIHN0bXQucGFyYW1zKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuc3RhdGVtZW50cywgc3RtdC5zdGF0ZW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhwcmVzc2lvblN0YXRlbWVudCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihTdG10TW9kaWZpZXIuTm9uZSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBFeHByZXNzaW9uU3RhdGVtZW50ICYmIHRoaXMuZXhwci5pc0VxdWl2YWxlbnQoc3RtdC5leHByKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXhwcmVzc2lvblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUmV0dXJuU3RhdGVtZW50IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCxcbiAgICAgIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihTdG10TW9kaWZpZXIuTm9uZSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBSZXR1cm5TdGF0ZW1lbnQgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoc3RtdC52YWx1ZSk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJldHVyblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIElmU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgcHVibGljIHRydWVDYXNlOiBTdGF0ZW1lbnRbXSxcbiAgICAgIHB1YmxpYyBmYWxzZUNhc2U6IFN0YXRlbWVudFtdID0gW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihTdG10TW9kaWZpZXIuTm9uZSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBJZlN0bXQgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KHN0bXQuY29uZGl0aW9uKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMudHJ1ZUNhc2UsIHN0bXQudHJ1ZUNhc2UpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5mYWxzZUNhc2UsIHN0bXQuZmFsc2VDYXNlKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdGVtZW50VmlzaXRvciB7XG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogRGVjbGFyZVZhclN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBSZXR1cm5TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgU3RhdGVtZW50VmlzaXRvciwgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdFR5cGUoYXN0OiBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uKGFzdDogRXhwcmVzc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoYXN0LnR5cGUpIHtcbiAgICAgIGFzdC50eXBlLnZpc2l0VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuICB2aXNpdEJ1aWx0aW5UeXBlKHR5cGU6IEJ1aWx0aW5UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEV4cHJlc3Npb25UeXBlKHR5cGU6IEV4cHJlc3Npb25UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHR5cGUudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGlmICh0eXBlLnR5cGVQYXJhbXMgIT09IG51bGwpIHtcbiAgICAgIHR5cGUudHlwZVBhcmFtcy5mb3JFYWNoKHBhcmFtID0+IHRoaXMudmlzaXRUeXBlKHBhcmFtLCBjb250ZXh0KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFycmF5VHlwZSh0eXBlOiBBcnJheVR5cGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRUeXBlKHR5cGUsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TWFwVHlwZSh0eXBlOiBNYXBUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFRyYW5zcGxhbnRlZFR5cGUodHlwZTogVHJhbnNwbGFudGVkVHlwZTx1bmtub3duPiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdHlwZTtcbiAgfVxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRUeXBlb2ZFeHByKGFzdDogVHlwZW9mRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZVZhckV4cHIoYXN0OiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFdyaXRlS2V5RXhwcihhc3Q6IFdyaXRlS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFdyaXRlUHJvcEV4cHIoYXN0OiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIoYXN0OiBUYWdnZWRUZW1wbGF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnRhZy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC50ZW1wbGF0ZS5leHByZXNzaW9ucywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNsYXNzRXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBMb2NhbGl6ZWRTdHJpbmcsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlUGFyYW1zKSB7XG4gICAgICBhc3QudHlwZVBhcmFtcy5mb3JFYWNoKHR5cGUgPT4gdHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IENvbmRpdGlvbmFsRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5mYWxzZUNhc2UhLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdE5vdEV4cHIoYXN0OiBOb3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGFzdC5zdGF0ZW1lbnRzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFVuYXJ5T3BlcmF0b3JFeHByKGFzdDogVW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogQmluYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5saHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IFJlYWRLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBMaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZW50cmllcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihhc3Q6IExpdGVyYWxNYXBFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5lbnRyaWVzLmZvckVhY2goKGVudHJ5KSA9PiBlbnRyeS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0Q29tbWFFeHByKGFzdDogQ29tbWFFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QucGFydHMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwcnM6IEV4cHJlc3Npb25bXSwgY29udGV4dDogYW55KTogdm9pZCB7XG4gICAgZXhwcnMuZm9yRWFjaChleHByID0+IGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogRGVjbGFyZVZhclN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKHN0bXQudmFsdWUpIHtcbiAgICAgIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICBpZiAoc3RtdC50eXBlKSB7XG4gICAgICBzdG10LnR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnN0YXRlbWVudHMsIGNvbnRleHQpO1xuICAgIGlmIChzdG10LnR5cGUpIHtcbiAgICAgIHN0bXQudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0RXhwcmVzc2lvblN0bXQoc3RtdDogRXhwcmVzc2lvblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBSZXR1cm5TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmZhbHNlQ2FzZSwgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzOiBTdGF0ZW1lbnRbXSwgY29udGV4dDogYW55KTogdm9pZCB7XG4gICAgc3RtdHMuZm9yRWFjaChzdG10ID0+IHN0bXQudmlzaXRTdGF0ZW1lbnQodGhpcywgY29udGV4dCkpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsZWFkaW5nQ29tbWVudChcbiAgICB0ZXh0OiBzdHJpbmcsIG11bHRpbGluZTogYm9vbGVhbiA9IGZhbHNlLCB0cmFpbGluZ05ld2xpbmU6IGJvb2xlYW4gPSB0cnVlKTogTGVhZGluZ0NvbW1lbnQge1xuICByZXR1cm4gbmV3IExlYWRpbmdDb21tZW50KHRleHQsIG11bHRpbGluZSwgdHJhaWxpbmdOZXdsaW5lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGpzRG9jQ29tbWVudCh0YWdzOiBKU0RvY1RhZ1tdID0gW10pOiBKU0RvY0NvbW1lbnQge1xuICByZXR1cm4gbmV3IEpTRG9jQ29tbWVudCh0YWdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhcmlhYmxlKFxuICAgIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogUmVhZFZhckV4cHIge1xuICByZXR1cm4gbmV3IFJlYWRWYXJFeHByKG5hbWUsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0RXhwcihcbiAgICBpZDogRXh0ZXJuYWxSZWZlcmVuY2UsIHR5cGVQYXJhbXM6IFR5cGVbXXxudWxsID0gbnVsbCxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBFeHRlcm5hbEV4cHIge1xuICByZXR1cm4gbmV3IEV4dGVybmFsRXhwcihpZCwgbnVsbCwgdHlwZVBhcmFtcywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRUeXBlKFxuICAgIGlkOiBFeHRlcm5hbFJlZmVyZW5jZSwgdHlwZVBhcmFtcz86IFR5cGVbXXxudWxsLCB0eXBlTW9kaWZpZXJzPzogVHlwZU1vZGlmaWVyKTogRXhwcmVzc2lvblR5cGV8XG4gICAgbnVsbCB7XG4gIHJldHVybiBpZCAhPSBudWxsID8gZXhwcmVzc2lvblR5cGUoaW1wb3J0RXhwcihpZCwgdHlwZVBhcmFtcywgbnVsbCksIHR5cGVNb2RpZmllcnMpIDogbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4cHJlc3Npb25UeXBlKFxuICAgIGV4cHI6IEV4cHJlc3Npb24sIHR5cGVNb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIsIHR5cGVQYXJhbXM/OiBUeXBlW118bnVsbCk6IEV4cHJlc3Npb25UeXBlIHtcbiAgcmV0dXJuIG5ldyBFeHByZXNzaW9uVHlwZShleHByLCB0eXBlTW9kaWZpZXJzLCB0eXBlUGFyYW1zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zcGxhbnRlZFR5cGU8VD4odHlwZTogVCwgdHlwZU1vZGlmaWVycz86IFR5cGVNb2RpZmllcik6IFRyYW5zcGxhbnRlZFR5cGU8VD4ge1xuICByZXR1cm4gbmV3IFRyYW5zcGxhbnRlZFR5cGUodHlwZSwgdHlwZU1vZGlmaWVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0eXBlb2ZFeHByKGV4cHI6IEV4cHJlc3Npb24pIHtcbiAgcmV0dXJuIG5ldyBUeXBlb2ZFeHByKGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbEFycihcbiAgICB2YWx1ZXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTGl0ZXJhbEFycmF5RXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5RXhwcih2YWx1ZXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbE1hcChcbiAgICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogRXhwcmVzc2lvbn1bXSxcbiAgICB0eXBlOiBNYXBUeXBlfG51bGwgPSBudWxsKTogTGl0ZXJhbE1hcEV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxNYXBFeHByKFxuICAgICAgdmFsdWVzLm1hcChlID0+IG5ldyBMaXRlcmFsTWFwRW50cnkoZS5rZXksIGUudmFsdWUsIGUucXVvdGVkKSksIHR5cGUsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5hcnkoXG4gICAgb3BlcmF0b3I6IFVuYXJ5T3BlcmF0b3IsIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFVuYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG5ldyBVbmFyeU9wZXJhdG9yRXhwcihvcGVyYXRvciwgZXhwciwgdHlwZSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3QoZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTm90RXhwciB7XG4gIHJldHVybiBuZXcgTm90RXhwcihleHByLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZuKFxuICAgIHBhcmFtczogRm5QYXJhbVtdLCBib2R5OiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIG5hbWU/OiBzdHJpbmd8bnVsbCk6IEZ1bmN0aW9uRXhwciB7XG4gIHJldHVybiBuZXcgRnVuY3Rpb25FeHByKHBhcmFtcywgYm9keSwgdHlwZSwgc291cmNlU3BhbiwgbmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpZlN0bXQoXG4gICAgY29uZGl0aW9uOiBFeHByZXNzaW9uLCB0aGVuQ2xhdXNlOiBTdGF0ZW1lbnRbXSwgZWxzZUNsYXVzZT86IFN0YXRlbWVudFtdLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgcmV0dXJuIG5ldyBJZlN0bXQoY29uZGl0aW9uLCB0aGVuQ2xhdXNlLCBlbHNlQ2xhdXNlLCBzb3VyY2VTcGFuLCBsZWFkaW5nQ29tbWVudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFnZ2VkVGVtcGxhdGUoXG4gICAgdGFnOiBFeHByZXNzaW9uLCB0ZW1wbGF0ZTogVGVtcGxhdGVMaXRlcmFsLCB0eXBlPzogVHlwZXxudWxsLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFRhZ2dlZFRlbXBsYXRlRXhwciB7XG4gIHJldHVybiBuZXcgVGFnZ2VkVGVtcGxhdGVFeHByKHRhZywgdGVtcGxhdGUsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbChcbiAgICB2YWx1ZTogYW55LCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBMaXRlcmFsRXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbEV4cHIodmFsdWUsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9jYWxpemVkU3RyaW5nKFxuICAgIG1ldGFCbG9jazogSTE4bk1ldGEsIG1lc3NhZ2VQYXJ0czogTGl0ZXJhbFBpZWNlW10sIHBsYWNlaG9sZGVyTmFtZXM6IFBsYWNlaG9sZGVyUGllY2VbXSxcbiAgICBleHByZXNzaW9uczogRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBMb2NhbGl6ZWRTdHJpbmcge1xuICByZXR1cm4gbmV3IExvY2FsaXplZFN0cmluZyhtZXRhQmxvY2ssIG1lc3NhZ2VQYXJ0cywgcGxhY2Vob2xkZXJOYW1lcywgZXhwcmVzc2lvbnMsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdWxsKGV4cDogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gZXhwIGluc3RhbmNlb2YgTGl0ZXJhbEV4cHIgJiYgZXhwLnZhbHVlID09PSBudWxsO1xufVxuXG4vLyBUaGUgbGlzdCBvZiBKU0RvYyB0YWdzIHRoYXQgd2UgY3VycmVudGx5IHN1cHBvcnQuIEV4dGVuZCBpdCBpZiBuZWVkZWQuXG5leHBvcnQgY29uc3QgZW51bSBKU0RvY1RhZ05hbWUge1xuICBEZXNjID0gJ2Rlc2MnLFxuICBJZCA9ICdpZCcsXG4gIE1lYW5pbmcgPSAnbWVhbmluZycsXG4gIFN1cHByZXNzID0gJ3N1cHByZXNzJyxcbn1cblxuLypcbiAqIFR5cGVTY3JpcHQgaGFzIGFuIEFQSSBmb3IgSlNEb2MgYWxyZWFkeSwgYnV0IGl0J3Mgbm90IGV4cG9zZWQuXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzczOTNcbiAqIEZvciBub3cgd2UgY3JlYXRlIHR5cGVzIHRoYXQgYXJlIHNpbWlsYXIgdG8gdGhlaXJzIHNvIHRoYXQgbWlncmF0aW5nXG4gKiB0byB0aGVpciBBUEkgd2lsbCBiZSBlYXNpZXIuIFNlZSBlLmcuIGB0cy5KU0RvY1RhZ2AgYW5kIGB0cy5KU0RvY0NvbW1lbnRgLlxuICovXG5leHBvcnQgdHlwZSBKU0RvY1RhZyA9IHtcbiAgLy8gYHRhZ05hbWVgIGlzIGUuZy4gXCJwYXJhbVwiIGluIGFuIGBAcGFyYW1gIGRlY2xhcmF0aW9uXG4gIHRhZ05hbWU6IEpTRG9jVGFnTmFtZXxzdHJpbmcsXG4gIC8vIEFueSByZW1haW5pbmcgdGV4dCBvbiB0aGUgdGFnLCBlLmcuIHRoZSBkZXNjcmlwdGlvblxuICB0ZXh0Pzogc3RyaW5nLFxufXx7XG4gIC8vIG5vIGB0YWdOYW1lYCBmb3IgcGxhaW4gdGV4dCBkb2N1bWVudGF0aW9uIHRoYXQgb2NjdXJzIGJlZm9yZSBhbnkgYEBwYXJhbWAgbGluZXNcbiAgdGFnTmFtZT86IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nLFxufTtcblxuLypcbiAqIFNlcmlhbGl6ZXMgYSBgVGFnYCBpbnRvIGEgc3RyaW5nLlxuICogUmV0dXJucyBhIHN0cmluZyBsaWtlIFwiIEBmb28ge2Jhcn0gYmF6XCIgKG5vdGUgdGhlIGxlYWRpbmcgd2hpdGVzcGFjZSBiZWZvcmUgYEBmb29gKS5cbiAqL1xuZnVuY3Rpb24gdGFnVG9TdHJpbmcodGFnOiBKU0RvY1RhZyk6IHN0cmluZyB7XG4gIGxldCBvdXQgPSAnJztcbiAgaWYgKHRhZy50YWdOYW1lKSB7XG4gICAgb3V0ICs9IGAgQCR7dGFnLnRhZ05hbWV9YDtcbiAgfVxuICBpZiAodGFnLnRleHQpIHtcbiAgICBpZiAodGFnLnRleHQubWF0Y2goL1xcL1xcKnxcXCpcXC8vKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdKU0RvYyB0ZXh0IGNhbm5vdCBjb250YWluIFwiLypcIiBhbmQgXCIqL1wiJyk7XG4gICAgfVxuICAgIG91dCArPSAnICcgKyB0YWcudGV4dC5yZXBsYWNlKC9AL2csICdcXFxcQCcpO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVRhZ3ModGFnczogSlNEb2NUYWdbXSk6IHN0cmluZyB7XG4gIGlmICh0YWdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xuXG4gIGlmICh0YWdzLmxlbmd0aCA9PT0gMSAmJiB0YWdzWzBdLnRhZ05hbWUgJiYgIXRhZ3NbMF0udGV4dCkge1xuICAgIC8vIFRoZSBKU0RPQyBjb21tZW50IGlzIGEgc2luZ2xlIHNpbXBsZSB0YWc6IGUuZyBgLyoqIEB0YWduYW1lICovYC5cbiAgICByZXR1cm4gYCoke3RhZ1RvU3RyaW5nKHRhZ3NbMF0pfSBgO1xuICB9XG5cbiAgbGV0IG91dCA9ICcqXFxuJztcbiAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgIG91dCArPSAnIConO1xuICAgIC8vIElmIHRoZSB0YWdUb1N0cmluZyBpcyBtdWx0aS1saW5lLCBpbnNlcnQgXCIgKiBcIiBwcmVmaXhlcyBvbiBsaW5lcy5cbiAgICBvdXQgKz0gdGFnVG9TdHJpbmcodGFnKS5yZXBsYWNlKC9cXG4vZywgJ1xcbiAqICcpO1xuICAgIG91dCArPSAnXFxuJztcbiAgfVxuICBvdXQgKz0gJyAnO1xuICByZXR1cm4gb3V0O1xufVxuIl19