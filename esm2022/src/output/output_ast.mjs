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
    clone() {
        return new ReadVarExpr(this.name, this.type, this.sourceSpan);
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
    clone() {
        return new TypeofExpr(this.expr.clone());
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
    clone() {
        return new WrappedNodeExpr(this.node, this.type, this.sourceSpan);
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
    clone() {
        return new WriteVarExpr(this.name, this.value.clone(), this.type, this.sourceSpan);
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
    clone() {
        return new WriteKeyExpr(this.receiver.clone(), this.index.clone(), this.value.clone(), this.type, this.sourceSpan);
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
    clone() {
        return new WritePropExpr(this.receiver.clone(), this.name, this.value.clone(), this.type, this.sourceSpan);
    }
}
export class InvokeFunctionExpr extends Expression {
    constructor(fn, args, type, sourceSpan, pure = false) {
        super(type, sourceSpan);
        this.fn = fn;
        this.args = args;
        this.pure = pure;
    }
    // An alias for fn, which allows other logic to handle calls and property reads together.
    get receiver() {
        return this.fn;
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
    clone() {
        return new InvokeFunctionExpr(this.fn.clone(), this.args.map(arg => arg.clone()), this.type, this.sourceSpan, this.pure);
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
    clone() {
        return new TaggedTemplateExpr(this.tag.clone(), this.template.clone(), this.type, this.sourceSpan);
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
    clone() {
        return new InstantiateExpr(this.classExpr.clone(), this.args.map(arg => arg.clone()), this.type, this.sourceSpan);
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
    clone() {
        return new LiteralExpr(this.value, this.type, this.sourceSpan);
    }
}
export class TemplateLiteral {
    constructor(elements, expressions) {
        this.elements = elements;
        this.expressions = expressions;
    }
    clone() {
        return new TemplateLiteral(this.elements.map(el => el.clone()), this.expressions.map(expr => expr.clone()));
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
    clone() {
        return new TemplateLiteralElement(this.text, this.sourceSpan, this.rawText);
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
    clone() {
        return new LocalizedString(this.metaBlock, this.messageParts, this.placeHolderNames, this.expressions.map(expr => expr.clone()), this.sourceSpan);
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
    clone() {
        return new ExternalExpr(this.value, this.type, this.typeParams, this.sourceSpan);
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
    clone() {
        return new ConditionalExpr(this.condition.clone(), this.trueCase.clone(), this.falseCase?.clone(), this.type, this.sourceSpan);
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
    clone() {
        return new NotExpr(this.condition.clone(), this.sourceSpan);
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
    clone() {
        return new FnParam(this.name, this.type);
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
    clone() {
        // TODO: Should we deep clone statements?
        return new FunctionExpr(this.params.map(p => p.clone()), this.statements, this.type, this.sourceSpan, this.name);
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
    clone() {
        return new UnaryOperatorExpr(this.operator, this.expr.clone(), this.type, this.sourceSpan, this.parens);
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
    clone() {
        return new BinaryOperatorExpr(this.operator, this.lhs.clone(), this.rhs.clone(), this.type, this.sourceSpan, this.parens);
    }
}
export class ReadPropExpr extends Expression {
    constructor(receiver, name, type, sourceSpan) {
        super(type, sourceSpan);
        this.receiver = receiver;
        this.name = name;
    }
    // An alias for name, which allows other logic to handle property reads and keyed reads together.
    get index() {
        return this.name;
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
    clone() {
        return new ReadPropExpr(this.receiver.clone(), this.name, this.type, this.sourceSpan);
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
    clone() {
        return new ReadKeyExpr(this.receiver, this.index.clone(), this.type, this.sourceSpan);
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
    clone() {
        return new LiteralArrayExpr(this.entries.map(e => e.clone()), this.type, this.sourceSpan);
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
    clone() {
        return new LiteralMapEntry(this.key, this.value.clone(), this.quoted);
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
    clone() {
        const entriesClone = this.entries.map(entry => entry.clone());
        return new LiteralMapExpr(entriesClone, this.type, this.sourceSpan);
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
    clone() {
        return new CommaExpr(this.parts.map(p => p.clone()));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFLNUMsVUFBVTtBQUNWLE1BQU0sQ0FBTixJQUFZLFlBR1g7QUFIRCxXQUFZLFlBQVk7SUFDdEIsK0NBQVEsQ0FBQTtJQUNSLGlEQUFjLENBQUE7QUFDaEIsQ0FBQyxFQUhXLFlBQVksS0FBWixZQUFZLFFBR3ZCO0FBRUQsTUFBTSxPQUFnQixJQUFJO0lBQ3hCLFlBQW1CLFlBQTBCLFlBQVksQ0FBQyxJQUFJO1FBQTNDLGNBQVMsR0FBVCxTQUFTLENBQWtDO0lBQUcsQ0FBQztJQUdsRSxXQUFXLENBQUMsUUFBc0I7UUFDaEMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNDLENBQUM7Q0FDRjtBQUVELE1BQU0sQ0FBTixJQUFZLGVBU1g7QUFURCxXQUFZLGVBQWU7SUFDekIsMkRBQU8sQ0FBQTtJQUNQLHFEQUFJLENBQUE7SUFDSix5REFBTSxDQUFBO0lBQ04sbURBQUcsQ0FBQTtJQUNILHlEQUFNLENBQUE7SUFDTiw2REFBUSxDQUFBO0lBQ1IsNkRBQVEsQ0FBQTtJQUNSLHFEQUFJLENBQUE7QUFDTixDQUFDLEVBVFcsZUFBZSxLQUFmLGVBQWUsUUFTMUI7QUFFRCxNQUFNLE9BQU8sV0FBWSxTQUFRLElBQUk7SUFDbkMsWUFBbUIsSUFBcUIsRUFBRSxTQUF3QjtRQUNoRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFEQSxTQUFJLEdBQUosSUFBSSxDQUFpQjtJQUV4QyxDQUFDO0lBQ1EsU0FBUyxDQUFDLE9BQW9CLEVBQUUsT0FBWTtRQUNuRCxPQUFPLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLGNBQWUsU0FBUSxJQUFJO0lBQ3RDLFlBQ1csS0FBaUIsRUFBRSxTQUF3QixFQUFTLGFBQTBCLElBQUk7UUFDM0YsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRFIsVUFBSyxHQUFMLEtBQUssQ0FBWTtRQUFtQyxlQUFVLEdBQVYsVUFBVSxDQUFvQjtJQUU3RixDQUFDO0lBQ1EsU0FBUyxDQUFDLE9BQW9CLEVBQUUsT0FBWTtRQUNuRCxPQUFPLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDcEQsQ0FBQztDQUNGO0FBR0QsTUFBTSxPQUFPLFNBQVUsU0FBUSxJQUFJO0lBQ2pDLFlBQW1CLEVBQVEsRUFBRSxTQUF3QjtRQUNuRCxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFEQSxPQUFFLEdBQUYsRUFBRSxDQUFNO0lBRTNCLENBQUM7SUFDUSxTQUFTLENBQUMsT0FBb0IsRUFBRSxPQUFZO1FBQ25ELE9BQU8sT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBR0QsTUFBTSxPQUFPLE9BQVEsU0FBUSxJQUFJO0lBRS9CLFlBQVksU0FBOEIsRUFBRSxTQUF3QjtRQUNsRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLElBQUksSUFBSSxDQUFDO0lBQ3JDLENBQUM7SUFDUSxTQUFTLENBQUMsT0FBb0IsRUFBRSxPQUFZO1FBQ25ELE9BQU8sT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDN0MsQ0FBQztDQUNGO0FBR0QsTUFBTSxPQUFPLGdCQUFvQixTQUFRLElBQUk7SUFDM0MsWUFBcUIsSUFBTyxFQUFFLFNBQXdCO1FBQ3BELEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQURFLFNBQUksR0FBSixJQUFJLENBQUc7SUFFNUIsQ0FBQztJQUNRLFNBQVMsQ0FBQyxPQUFvQixFQUFFLE9BQVk7UUFDbkQsT0FBTyxPQUFPLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDRjtBQUdELE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxJQUFJLFdBQVcsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDckUsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLElBQUksV0FBVyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN2RSxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsSUFBSSxXQUFXLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9ELE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBRyxJQUFJLFdBQVcsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0QsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuRSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ25FLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxJQUFJLFdBQVcsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdkUsTUFBTSxDQUFDLE1BQU0sU0FBUyxHQUFHLElBQUksV0FBVyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQVUvRCxpQkFBaUI7QUFFakIsTUFBTSxDQUFOLElBQVksYUFHWDtBQUhELFdBQVksYUFBYTtJQUN2QixtREFBSyxDQUFBO0lBQ0wsaURBQUksQ0FBQTtBQUNOLENBQUMsRUFIVyxhQUFhLEtBQWIsYUFBYSxRQUd4QjtBQUVELE1BQU0sQ0FBTixJQUFZLGNBa0JYO0FBbEJELFdBQVksY0FBYztJQUN4Qix1REFBTSxDQUFBO0lBQ04sNkRBQVMsQ0FBQTtJQUNULDZEQUFTLENBQUE7SUFDVCxtRUFBWSxDQUFBO0lBQ1oscURBQUssQ0FBQTtJQUNMLG1EQUFJLENBQUE7SUFDSix1REFBTSxDQUFBO0lBQ04sMkRBQVEsQ0FBQTtJQUNSLHVEQUFNLENBQUE7SUFDTixpREFBRyxDQUFBO0lBQ0gsZ0RBQUUsQ0FBQTtJQUNGLGdFQUFVLENBQUE7SUFDVixzREFBSyxDQUFBO0lBQ0wsa0VBQVcsQ0FBQTtJQUNYLHdEQUFNLENBQUE7SUFDTixvRUFBWSxDQUFBO0lBQ1osMEVBQWUsQ0FBQTtBQUNqQixDQUFDLEVBbEJXLGNBQWMsS0FBZCxjQUFjLFFBa0J6QjtBQUVELE1BQU0sVUFBVSxvQkFBb0IsQ0FDaEMsSUFBWSxFQUFFLEtBQWE7SUFDN0IsSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUU7UUFDakMsT0FBTyxJQUFJLElBQUksS0FBSyxDQUFDO0tBQ3RCO0lBQ0QsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUM5QixJQUFTLEVBQUUsS0FBVSxFQUFFLG1CQUFpRTtJQUMxRixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3hCLElBQUksR0FBRyxLQUFLLEtBQUssQ0FBQyxNQUFNLEVBQUU7UUFDeEIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDNUIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMzQyxPQUFPLEtBQUssQ0FBQztTQUNkO0tBQ0Y7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUsZ0JBQWdCLENBQzVCLElBQVMsRUFBRSxLQUFVO0lBQ3ZCLE9BQU8seUJBQXlCLENBQzVCLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxXQUFjLEVBQUUsWUFBZSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDaEcsQ0FBQztBQUVELE1BQU0sT0FBZ0IsVUFBVTtJQUk5QixZQUFZLElBQXlCLEVBQUUsVUFBaUM7UUFDdEUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxJQUFJLElBQUksQ0FBQztJQUN2QyxDQUFDO0lBaUJELElBQUksQ0FBQyxJQUFZLEVBQUUsVUFBaUM7UUFDbEQsT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsR0FBRyxDQUFDLEtBQWlCLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztRQUN4RSxPQUFPLElBQUksV0FBVyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxNQUFNLENBQUMsTUFBb0IsRUFBRSxVQUFpQyxFQUFFLElBQWM7UUFFNUUsT0FBTyxJQUFJLGtCQUFrQixDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsV0FBVyxDQUFDLE1BQW9CLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztRQUVuRixPQUFPLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRCxXQUFXLENBQ1AsUUFBb0IsRUFBRSxZQUE2QixJQUFJLEVBQ3ZELFVBQWlDO1FBQ25DLE9BQU8sSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRCxNQUFNLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQ3ZELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFDRCxTQUFTLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQzFELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFDRCxTQUFTLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQzFELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFDRCxZQUFZLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQzdELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzFGLENBQUM7SUFDRCxLQUFLLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQ3RELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFDRCxJQUFJLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQ3JELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFDRCxNQUFNLENBQUMsR0FBZSxFQUFFLFVBQWlDO1FBQ3ZELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLElB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O0tBQ3BDO0lBRUQsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1FBQ3RCLEdBQUcsSUFBSSxJQUFJLENBQUM7UUFDWixvRUFBb0U7UUFDcEUsR0FBRyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELEdBQUcsSUFBSSxJQUFJLENBQUM7S0FDYjtJQUNELEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDWCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjb21wdXRlTXNnSWR9IGZyb20gJy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCB7TWVzc2FnZX0gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0kxOG5NZXRhfSBmcm9tICcuLi9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhJztcblxuLy8vLyBUeXBlc1xuZXhwb3J0IGVudW0gVHlwZU1vZGlmaWVyIHtcbiAgTm9uZSA9IDAsXG4gIENvbnN0ID0gMSA8PCAwLFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2RpZmllcnM6IFR5cGVNb2RpZmllciA9IFR5cGVNb2RpZmllci5Ob25lKSB7fVxuICBhYnN0cmFjdCB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICBoYXNNb2RpZmllcihtb2RpZmllcjogVHlwZU1vZGlmaWVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLm1vZGlmaWVycyAmIG1vZGlmaWVyKSAhPT0gMDtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBCdWlsdGluVHlwZU5hbWUge1xuICBEeW5hbWljLFxuICBCb29sLFxuICBTdHJpbmcsXG4gIEludCxcbiAgTnVtYmVyLFxuICBGdW5jdGlvbixcbiAgSW5mZXJyZWQsXG4gIE5vbmUsXG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogQnVpbHRpblR5cGVOYW1lLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJ1aWx0aW5UeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgbW9kaWZpZXJzPzogVHlwZU1vZGlmaWVyLCBwdWJsaWMgdHlwZVBhcmFtczogVHlwZVtdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHByZXNzaW9uVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBBcnJheVR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG9mOiBUeXBlLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFycmF5VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBNYXBUeXBlIGV4dGVuZHMgVHlwZSB7XG4gIHB1YmxpYyB2YWx1ZVR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IodmFsdWVUeXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICAgIHRoaXMudmFsdWVUeXBlID0gdmFsdWVUeXBlIHx8IG51bGw7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TWFwVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBUcmFuc3BsYW50ZWRUeXBlPFQ+IGV4dGVuZHMgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHR5cGU6IFQsIG1vZGlmaWVycz86IFR5cGVNb2RpZmllcikge1xuICAgIHN1cGVyKG1vZGlmaWVycyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VHJhbnNwbGFudGVkVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjb25zdCBEWU5BTUlDX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkR5bmFtaWMpO1xuZXhwb3J0IGNvbnN0IElORkVSUkVEX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkluZmVycmVkKTtcbmV4cG9ydCBjb25zdCBCT09MX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkJvb2wpO1xuZXhwb3J0IGNvbnN0IElOVF9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5JbnQpO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5OdW1iZXIpO1xuZXhwb3J0IGNvbnN0IFNUUklOR19UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5TdHJpbmcpO1xuZXhwb3J0IGNvbnN0IEZVTkNUSU9OX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkZ1bmN0aW9uKTtcbmV4cG9ydCBjb25zdCBOT05FX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLk5vbmUpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVWaXNpdG9yIHtcbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cHJlc3Npb25UeXBlKHR5cGU6IEV4cHJlc3Npb25UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRyYW5zcGxhbnRlZFR5cGUodHlwZTogVHJhbnNwbGFudGVkVHlwZTx1bmtub3duPiwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vLy8vLyBFeHByZXNzaW9uc1xuXG5leHBvcnQgZW51bSBVbmFyeU9wZXJhdG9yIHtcbiAgTWludXMsXG4gIFBsdXMsXG59XG5cbmV4cG9ydCBlbnVtIEJpbmFyeU9wZXJhdG9yIHtcbiAgRXF1YWxzLFxuICBOb3RFcXVhbHMsXG4gIElkZW50aWNhbCxcbiAgTm90SWRlbnRpY2FsLFxuICBNaW51cyxcbiAgUGx1cyxcbiAgRGl2aWRlLFxuICBNdWx0aXBseSxcbiAgTW9kdWxvLFxuICBBbmQsXG4gIE9yLFxuICBCaXR3aXNlQW5kLFxuICBMb3dlcixcbiAgTG93ZXJFcXVhbHMsXG4gIEJpZ2dlcixcbiAgQmlnZ2VyRXF1YWxzLFxuICBOdWxsaXNoQ29hbGVzY2UsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBudWxsU2FmZUlzRXF1aXZhbGVudDxUIGV4dGVuZHMge2lzRXF1aXZhbGVudChvdGhlcjogVCk6IGJvb2xlYW59PihcbiAgICBiYXNlOiBUfG51bGwsIG90aGVyOiBUfG51bGwpIHtcbiAgaWYgKGJhc2UgPT0gbnVsbCB8fCBvdGhlciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGJhc2UgPT0gb3RoZXI7XG4gIH1cbiAgcmV0dXJuIGJhc2UuaXNFcXVpdmFsZW50KG90aGVyKTtcbn1cblxuZnVuY3Rpb24gYXJlQWxsRXF1aXZhbGVudFByZWRpY2F0ZTxUPihcbiAgICBiYXNlOiBUW10sIG90aGVyOiBUW10sIGVxdWl2YWxlbnRQcmVkaWNhdGU6IChiYXNlRWxlbWVudDogVCwgb3RoZXJFbGVtZW50OiBUKSA9PiBib29sZWFuKSB7XG4gIGNvbnN0IGxlbiA9IGJhc2UubGVuZ3RoO1xuICBpZiAobGVuICE9PSBvdGhlci5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghZXF1aXZhbGVudFByZWRpY2F0ZShiYXNlW2ldLCBvdGhlcltpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmVBbGxFcXVpdmFsZW50PFQgZXh0ZW5kcyB7aXNFcXVpdmFsZW50KG90aGVyOiBUKTogYm9vbGVhbn0+KFxuICAgIGJhc2U6IFRbXSwgb3RoZXI6IFRbXSkge1xuICByZXR1cm4gYXJlQWxsRXF1aXZhbGVudFByZWRpY2F0ZShcbiAgICAgIGJhc2UsIG90aGVyLCAoYmFzZUVsZW1lbnQ6IFQsIG90aGVyRWxlbWVudDogVCkgPT4gYmFzZUVsZW1lbnQuaXNFcXVpdmFsZW50KG90aGVyRWxlbWVudCkpO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcblxuICBjb25zdHJ1Y3Rvcih0eXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VTcGFuID0gc291cmNlU3BhbiB8fCBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIGV4cHJlc3Npb24gcHJvZHVjZXMgdGhlIHNhbWUgdmFsdWUgYXMgdGhlIGdpdmVuIGV4cHJlc3Npb24uXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIGNvbnN0YW50LlxuICAgKi9cbiAgYWJzdHJhY3QgaXNDb25zdGFudCgpOiBib29sZWFuO1xuXG4gIGFic3RyYWN0IGNsb25lKCk6IEV4cHJlc3Npb247XG5cbiAgcHJvcChuYW1lOiBzdHJpbmcsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRQcm9wRXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWFkUHJvcEV4cHIodGhpcywgbmFtZSwgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBrZXkoaW5kZXg6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRLZXlFeHByIHtcbiAgICByZXR1cm4gbmV3IFJlYWRLZXlFeHByKHRoaXMsIGluZGV4LCB0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGNhbGxGbihwYXJhbXM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdXJlPzogYm9vbGVhbik6XG4gICAgICBJbnZva2VGdW5jdGlvbkV4cHIge1xuICAgIHJldHVybiBuZXcgSW52b2tlRnVuY3Rpb25FeHByKHRoaXMsIHBhcmFtcywgbnVsbCwgc291cmNlU3BhbiwgcHVyZSk7XG4gIH1cblxuICBpbnN0YW50aWF0ZShwYXJhbXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTpcbiAgICAgIEluc3RhbnRpYXRlRXhwciB7XG4gICAgcmV0dXJuIG5ldyBJbnN0YW50aWF0ZUV4cHIodGhpcywgcGFyYW1zLCB0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGNvbmRpdGlvbmFsKFxuICAgICAgdHJ1ZUNhc2U6IEV4cHJlc3Npb24sIGZhbHNlQ2FzZTogRXhwcmVzc2lvbnxudWxsID0gbnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IENvbmRpdGlvbmFsRXhwciB7XG4gICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbEV4cHIodGhpcywgdHJ1ZUNhc2UsIGZhbHNlQ2FzZSwgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBlcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBub3RFcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk5vdEVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpZGVudGljYWwocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBub3RJZGVudGljYWwocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBtaW51cyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTWludXMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgcGx1cyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuUGx1cywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBkaXZpZGUocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkRpdmlkZSwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBtdWx0aXBseShyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHksIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbW9kdWxvKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Nb2R1bG8sIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYW5kKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5BbmQsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYml0d2lzZUFuZChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcGFyZW5zOiBib29sZWFuID0gdHJ1ZSk6XG4gICAgICBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkJpdHdpc2VBbmQsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3BhbiwgcGFyZW5zKTtcbiAgfVxuICBvcihyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuT3IsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbG93ZXIocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkxvd2VyLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGxvd2VyRXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Mb3dlckVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBiaWdnZXIocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkJpZ2dlciwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBiaWdnZXJFcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFscywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0JsYW5rKHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEV4cHJlc3Npb24ge1xuICAgIC8vIE5vdGU6IFdlIHVzZSBlcXVhbHMgYnkgcHVycG9zZSBoZXJlIHRvIGNvbXBhcmUgdG8gbnVsbCBhbmQgdW5kZWZpbmVkIGluIEpTLlxuICAgIC8vIFdlIHVzZSB0aGUgdHlwZWQgbnVsbCB0byBhbGxvdyBzdHJpY3ROdWxsQ2hlY2tzIHRvIG5hcnJvdyB0eXBlcy5cbiAgICByZXR1cm4gdGhpcy5lcXVhbHMoVFlQRURfTlVMTF9FWFBSLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBudWxsaXNoQ29hbGVzY2UocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk51bGxpc2hDb2FsZXNjZSwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvU3RtdCgpOiBTdGF0ZW1lbnQge1xuICAgIHJldHVybiBuZXcgRXhwcmVzc2lvblN0YXRlbWVudCh0aGlzLCBudWxsKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVhZFZhckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgUmVhZFZhckV4cHIgJiYgdGhpcy5uYW1lID09PSBlLm5hbWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlYWRWYXJFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVhZFZhckV4cHIge1xuICAgIHJldHVybiBuZXcgUmVhZFZhckV4cHIodGhpcy5uYW1lLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZVZhckV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVWYXJFeHByKHRoaXMubmFtZSwgdmFsdWUsIG51bGwsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFR5cGVvZkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpIHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFR5cGVvZkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgVHlwZW9mRXhwciAmJiBlLmV4cHIuaXNFcXVpdmFsZW50KHRoaXMuZXhwcik7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmV4cHIuaXNDb25zdGFudCgpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogVHlwZW9mRXhwciB7XG4gICAgcmV0dXJuIG5ldyBUeXBlb2ZFeHByKHRoaXMuZXhwci5jbG9uZSgpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV3JhcHBlZE5vZGVFeHByPFQ+IGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBub2RlOiBULCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcmFwcGVkTm9kZUV4cHIgJiYgdGhpcy5ub2RlID09PSBlLm5vZGU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyYXBwZWROb2RlRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFdyYXBwZWROb2RlRXhwcjxUPiB7XG4gICAgcmV0dXJuIG5ldyBXcmFwcGVkTm9kZUV4cHIodGhpcy5ub2RlLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdyaXRlVmFyRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb247XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlVmFyRXhwciAmJiB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JpdGVWYXJFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogV3JpdGVWYXJFeHByIHtcbiAgICByZXR1cm4gbmV3IFdyaXRlVmFyRXhwcih0aGlzLm5hbWUsIHRoaXMudmFsdWUuY2xvbmUoKSwgdGhpcy50eXBlLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdG9EZWNsU3RtdCh0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXIpOiBEZWNsYXJlVmFyU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlVmFyU3RtdCh0aGlzLm5hbWUsIHRoaXMudmFsdWUsIHR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvQ29uc3REZWNsKCk6IERlY2xhcmVWYXJTdG10IHtcbiAgICByZXR1cm4gdGhpcy50b0RlY2xTdG10KElORkVSUkVEX1RZUEUsIFN0bXRNb2RpZmllci5GaW5hbCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgV3JpdGVLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBpbmRleDogRXhwcmVzc2lvbiwgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZUtleUV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5pbmRleC5pc0VxdWl2YWxlbnQoZS5pbmRleCkgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyaXRlS2V5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFdyaXRlS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBXcml0ZUtleUV4cHIoXG4gICAgICAgIHRoaXMucmVjZWl2ZXIuY2xvbmUoKSwgdGhpcy5pbmRleC5jbG9uZSgpLCB0aGlzLnZhbHVlLmNsb25lKCksIHRoaXMudHlwZSwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXcml0ZVByb3BFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSB8fCB2YWx1ZS50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgV3JpdGVQcm9wRXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JpdGVQcm9wRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFdyaXRlUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVQcm9wRXhwcihcbiAgICAgICAgdGhpcy5yZWNlaXZlci5jbG9uZSgpLCB0aGlzLm5hbWUsIHRoaXMudmFsdWUuY2xvbmUoKSwgdGhpcy50eXBlLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnZva2VGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZm46IEV4cHJlc3Npb24sIHB1YmxpYyBhcmdzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBwdXJlID0gZmFsc2UpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIC8vIEFuIGFsaWFzIGZvciBmbiwgd2hpY2ggYWxsb3dzIG90aGVyIGxvZ2ljIHRvIGhhbmRsZSBjYWxscyBhbmQgcHJvcGVydHkgcmVhZHMgdG9nZXRoZXIuXG4gIGdldCByZWNlaXZlcigpOiBFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5mbjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBJbnZva2VGdW5jdGlvbkV4cHIgJiYgdGhpcy5mbi5pc0VxdWl2YWxlbnQoZS5mbikgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmFyZ3MsIGUuYXJncykgJiYgdGhpcy5wdXJlID09PSBlLnB1cmU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEludm9rZUZ1bmN0aW9uRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IEludm9rZUZ1bmN0aW9uRXhwciB7XG4gICAgcmV0dXJuIG5ldyBJbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgIHRoaXMuZm4uY2xvbmUoKSwgdGhpcy5hcmdzLm1hcChhcmcgPT4gYXJnLmNsb25lKCkpLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3BhbiwgdGhpcy5wdXJlKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBUYWdnZWRUZW1wbGF0ZUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdGFnOiBFeHByZXNzaW9uLCBwdWJsaWMgdGVtcGxhdGU6IFRlbXBsYXRlTGl0ZXJhbCwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFRhZ2dlZFRlbXBsYXRlRXhwciAmJiB0aGlzLnRhZy5pc0VxdWl2YWxlbnQoZS50YWcpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnRQcmVkaWNhdGUoXG4gICAgICAgICAgICAgICB0aGlzLnRlbXBsYXRlLmVsZW1lbnRzLCBlLnRlbXBsYXRlLmVsZW1lbnRzLCAoYSwgYikgPT4gYS50ZXh0ID09PSBiLnRleHQpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy50ZW1wbGF0ZS5leHByZXNzaW9ucywgZS50ZW1wbGF0ZS5leHByZXNzaW9ucyk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRhZ2dlZFRlbXBsYXRlRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFRhZ2dlZFRlbXBsYXRlRXhwciB7XG4gICAgcmV0dXJuIG5ldyBUYWdnZWRUZW1wbGF0ZUV4cHIoXG4gICAgICAgIHRoaXMudGFnLmNsb25lKCksIHRoaXMudGVtcGxhdGUuY2xvbmUoKSwgdGhpcy50eXBlLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEluc3RhbnRpYXRlRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjbGFzc0V4cHI6IEV4cHJlc3Npb24sIHB1YmxpYyBhcmdzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBJbnN0YW50aWF0ZUV4cHIgJiYgdGhpcy5jbGFzc0V4cHIuaXNFcXVpdmFsZW50KGUuY2xhc3NFeHByKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYXJncywgZS5hcmdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SW5zdGFudGlhdGVFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogSW5zdGFudGlhdGVFeHByIHtcbiAgICByZXR1cm4gbmV3IEluc3RhbnRpYXRlRXhwcihcbiAgICAgICAgdGhpcy5jbGFzc0V4cHIuY2xvbmUoKSwgdGhpcy5hcmdzLm1hcChhcmcgPT4gYXJnLmNsb25lKCkpLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IG51bWJlcnxzdHJpbmd8Ym9vbGVhbnxudWxsfHVuZGVmaW5lZCwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxFeHByICYmIHRoaXMudmFsdWUgPT09IGUudmFsdWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBMaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsRXhwcih0aGlzLnZhbHVlLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlTGl0ZXJhbCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlbGVtZW50czogVGVtcGxhdGVMaXRlcmFsRWxlbWVudFtdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSkge31cblxuICBjbG9uZSgpOiBUZW1wbGF0ZUxpdGVyYWwge1xuICAgIHJldHVybiBuZXcgVGVtcGxhdGVMaXRlcmFsKFxuICAgICAgICB0aGlzLmVsZW1lbnRzLm1hcChlbCA9PiBlbC5jbG9uZSgpKSwgdGhpcy5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBleHByLmNsb25lKCkpKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQge1xuICByYXdUZXh0OiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0ZXh0OiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuLCByYXdUZXh0Pzogc3RyaW5nKSB7XG4gICAgLy8gSWYgYHJhd1RleHRgIGlzIG5vdCBwcm92aWRlZCwgdHJ5IHRvIGV4dHJhY3QgdGhlIHJhdyBzdHJpbmcgZnJvbSBpdHNcbiAgICAvLyBhc3NvY2lhdGVkIGBzb3VyY2VTcGFuYC4gSWYgdGhhdCBpcyBhbHNvIG5vdCBhdmFpbGFibGUsIFwiZmFrZVwiIHRoZSByYXdcbiAgICAvLyBzdHJpbmcgaW5zdGVhZCBieSBlc2NhcGluZyB0aGUgZm9sbG93aW5nIGNvbnRyb2wgc2VxdWVuY2VzOlxuICAgIC8vIC0gXCJcXFwiIHdvdWxkIG90aGVyd2lzZSBpbmRpY2F0ZSB0aGF0IHRoZSBuZXh0IGNoYXJhY3RlciBpcyBhIGNvbnRyb2wgY2hhcmFjdGVyLlxuICAgIC8vIC0gXCJgXCIgYW5kIFwiJHtcIiBhcmUgdGVtcGxhdGUgc3RyaW5nIGNvbnRyb2wgc2VxdWVuY2VzIHRoYXQgd291bGQgb3RoZXJ3aXNlIHByZW1hdHVyZWx5XG4gICAgLy8gaW5kaWNhdGUgdGhlIGVuZCBvZiB0aGUgdGVtcGxhdGUgbGl0ZXJhbCBlbGVtZW50LlxuICAgIHRoaXMucmF3VGV4dCA9XG4gICAgICAgIHJhd1RleHQgPz8gc291cmNlU3Bhbj8udG9TdHJpbmcoKSA/PyBlc2NhcGVGb3JUZW1wbGF0ZUxpdGVyYWwoZXNjYXBlU2xhc2hlcyh0ZXh0KSk7XG4gIH1cblxuICBjbG9uZSgpOiBUZW1wbGF0ZUxpdGVyYWxFbGVtZW50IHtcbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQodGhpcy50ZXh0LCB0aGlzLnNvdXJjZVNwYW4sIHRoaXMucmF3VGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxQaWVjZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0ZXh0OiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG59XG5leHBvcnQgY2xhc3MgUGxhY2Vob2xkZXJQaWVjZSB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYSBgUGxhY2Vob2xkZXJQaWVjZWAuXG4gICAqXG4gICAqIEBwYXJhbSB0ZXh0IHRoZSBuYW1lIG9mIHRoaXMgcGxhY2Vob2xkZXIgKGUuZy4gYFBIXzFgKS5cbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gdGhlIGxvY2F0aW9uIG9mIHRoaXMgcGxhY2Vob2xkZXIgaW4gaXRzIGxvY2FsaXplZCBtZXNzYWdlIHRoZSBzb3VyY2UgY29kZS5cbiAgICogQHBhcmFtIGFzc29jaWF0ZWRNZXNzYWdlIHJlZmVyZW5jZSB0byBhbm90aGVyIG1lc3NhZ2UgdGhhdCB0aGlzIHBsYWNlaG9sZGVyIGlzIGFzc29jaWF0ZWQgd2l0aC5cbiAgICogVGhlIGBhc3NvY2lhdGVkTWVzc2FnZWAgaXMgbWFpbmx5IHVzZWQgdG8gcHJvdmlkZSBhIHJlbGF0aW9uc2hpcCB0byBhbiBJQ1UgbWVzc2FnZSB0aGF0IGhhc1xuICAgKiBiZWVuIGV4dHJhY3RlZCBvdXQgZnJvbSB0aGUgbWVzc2FnZSBjb250YWluaW5nIHRoZSBwbGFjZWhvbGRlci5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRleHQ6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGFzc29jaWF0ZWRNZXNzYWdlPzogTWVzc2FnZSkge1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIE1lc3NhZ2VQaWVjZSA9IExpdGVyYWxQaWVjZXxQbGFjZWhvbGRlclBpZWNlO1xuXG5jb25zdCBNRUFOSU5HX1NFUEFSQVRPUiA9ICd8JztcbmNvbnN0IElEX1NFUEFSQVRPUiA9ICdAQCc7XG5jb25zdCBMRUdBQ1lfSURfSU5ESUNBVE9SID0gJ+KQnyc7XG5cbmV4cG9ydCBjbGFzcyBMb2NhbGl6ZWRTdHJpbmcgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBtZXRhQmxvY2s6IEkxOG5NZXRhLCByZWFkb25seSBtZXNzYWdlUGFydHM6IExpdGVyYWxQaWVjZVtdLFxuICAgICAgcmVhZG9ubHkgcGxhY2VIb2xkZXJOYW1lczogUGxhY2Vob2xkZXJQaWVjZVtdLCByZWFkb25seSBleHByZXNzaW9uczogRXhwcmVzc2lvbltdLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIoU1RSSU5HX1RZUEUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICAvLyByZXR1cm4gZSBpbnN0YW5jZW9mIExvY2FsaXplZFN0cmluZyAmJiB0aGlzLm1lc3NhZ2UgPT09IGUubWVzc2FnZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExvY2FsaXplZFN0cmluZyh0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IExvY2FsaXplZFN0cmluZyB7XG4gICAgcmV0dXJuIG5ldyBMb2NhbGl6ZWRTdHJpbmcoXG4gICAgICAgIHRoaXMubWV0YUJsb2NrLCB0aGlzLm1lc3NhZ2VQYXJ0cywgdGhpcy5wbGFjZUhvbGRlck5hbWVzLFxuICAgICAgICB0aGlzLmV4cHJlc3Npb25zLm1hcChleHByID0+IGV4cHIuY2xvbmUoKSksIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXplIHRoZSBnaXZlbiBgbWV0YWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBcImNvb2tlZFwiIGFuZCBcInJhd1wiIHN0cmluZ3MgdGhhdCBjYW4gYmUgdXNlZFxuICAgKiBpbiBhIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuIFRoZSBmb3JtYXQgb2YgdGhlIG1ldGFkYXRhIGlzIHRoZSBzYW1lIGFzIHRoYXQgcGFyc2VkIGJ5XG4gICAqIGBwYXJzZUkxOG5NZXRhKClgLlxuICAgKlxuICAgKiBAcGFyYW0gbWV0YSBUaGUgbWV0YWRhdGEgdG8gc2VyaWFsaXplXG4gICAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZmlyc3QgcGFydCBvZiB0aGUgdGFnZ2VkIHN0cmluZ1xuICAgKi9cbiAgc2VyaWFsaXplSTE4bkhlYWQoKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgICBsZXQgbWV0YUJsb2NrID0gdGhpcy5tZXRhQmxvY2suZGVzY3JpcHRpb24gfHwgJyc7XG4gICAgaWYgKHRoaXMubWV0YUJsb2NrLm1lYW5pbmcpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke3RoaXMubWV0YUJsb2NrLm1lYW5pbmd9JHtNRUFOSU5HX1NFUEFSQVRPUn0ke21ldGFCbG9ja31gO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZXRhQmxvY2suY3VzdG9tSWQpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja30ke0lEX1NFUEFSQVRPUn0ke3RoaXMubWV0YUJsb2NrLmN1c3RvbUlkfWA7XG4gICAgfVxuICAgIGlmICh0aGlzLm1ldGFCbG9jay5sZWdhY3lJZHMpIHtcbiAgICAgIHRoaXMubWV0YUJsb2NrLmxlZ2FjeUlkcy5mb3JFYWNoKGxlZ2FjeUlkID0+IHtcbiAgICAgICAgbWV0YUJsb2NrID0gYCR7bWV0YUJsb2NrfSR7TEVHQUNZX0lEX0lORElDQVRPUn0ke2xlZ2FjeUlkfWA7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhcbiAgICAgICAgbWV0YUJsb2NrLCB0aGlzLm1lc3NhZ2VQYXJ0c1swXS50ZXh0LCB0aGlzLmdldE1lc3NhZ2VQYXJ0U291cmNlU3BhbigwKSk7XG4gIH1cblxuICBnZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VQYXJ0c1tpXT8uc291cmNlU3BhbiA/PyB0aGlzLnNvdXJjZVNwYW47XG4gIH1cblxuICBnZXRQbGFjZWhvbGRlclNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gdGhpcy5wbGFjZUhvbGRlck5hbWVzW2ldPy5zb3VyY2VTcGFuID8/IHRoaXMuZXhwcmVzc2lvbnNbaV0/LnNvdXJjZVNwYW4gPz9cbiAgICAgICAgdGhpcy5zb3VyY2VTcGFuO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYHBsYWNlaG9sZGVyTmFtZWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBcImNvb2tlZFwiIGFuZCBcInJhd1wiIHN0cmluZ3MgdGhhdFxuICAgKiBjYW4gYmUgdXNlZCBpbiBhIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gICAqXG4gICAqIFRoZSBmb3JtYXQgaXMgYDo8cGxhY2Vob2xkZXItbmFtZT5bQEA8YXNzb2NpYXRlZC1pZD5dOmAuXG4gICAqXG4gICAqIFRoZSBgYXNzb2NpYXRlZC1pZGAgaXMgdGhlIG1lc3NhZ2UgaWQgb2YgdGhlICh1c3VhbGx5IGFuIElDVSkgbWVzc2FnZSB0byB3aGljaCB0aGlzIHBsYWNlaG9sZGVyXG4gICAqIHJlZmVycy5cbiAgICpcbiAgICogQHBhcmFtIHBhcnRJbmRleCBUaGUgaW5kZXggb2YgdGhlIG1lc3NhZ2UgcGFydCB0byBzZXJpYWxpemUuXG4gICAqL1xuICBzZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KHBhcnRJbmRleDogbnVtYmVyKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgICBjb25zdCBwbGFjZWhvbGRlciA9IHRoaXMucGxhY2VIb2xkZXJOYW1lc1twYXJ0SW5kZXggLSAxXTtcbiAgICBjb25zdCBtZXNzYWdlUGFydCA9IHRoaXMubWVzc2FnZVBhcnRzW3BhcnRJbmRleF07XG4gICAgbGV0IG1ldGFCbG9jayA9IHBsYWNlaG9sZGVyLnRleHQ7XG4gICAgaWYgKHBsYWNlaG9sZGVyLmFzc29jaWF0ZWRNZXNzYWdlPy5sZWdhY3lJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBtZXRhQmxvY2sgKz0gYCR7SURfU0VQQVJBVE9SfSR7XG4gICAgICAgICAgY29tcHV0ZU1zZ0lkKFxuICAgICAgICAgICAgICBwbGFjZWhvbGRlci5hc3NvY2lhdGVkTWVzc2FnZS5tZXNzYWdlU3RyaW5nLCBwbGFjZWhvbGRlci5hc3NvY2lhdGVkTWVzc2FnZS5tZWFuaW5nKX1gO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ29va2VkUmF3U3RyaW5nKFxuICAgICAgICBtZXRhQmxvY2ssIG1lc3NhZ2VQYXJ0LnRleHQsIHRoaXMuZ2V0TWVzc2FnZVBhcnRTb3VyY2VTcGFuKHBhcnRJbmRleCkpO1xuICB9XG59XG5cbi8qKlxuICogQSBzdHJ1Y3R1cmUgdG8gaG9sZCB0aGUgY29va2VkIGFuZCByYXcgc3RyaW5ncyBvZiBhIHRlbXBsYXRlIGxpdGVyYWwgZWxlbWVudCwgYWxvbmcgd2l0aCBpdHNcbiAqIHNvdXJjZS1zcGFuIHJhbmdlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvb2tlZFJhd1N0cmluZyB7XG4gIGNvb2tlZDogc3RyaW5nO1xuICByYXc6IHN0cmluZztcbiAgcmFuZ2U6IFBhcnNlU291cmNlU3BhbnxudWxsO1xufVxuXG5jb25zdCBlc2NhcGVTbGFzaGVzID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+IHN0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpO1xuY29uc3QgZXNjYXBlU3RhcnRpbmdDb2xvbiA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUNvbG9ucyA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUZvclRlbXBsYXRlTGl0ZXJhbCA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PlxuICAgIHN0ci5yZXBsYWNlKC9gL2csICdcXFxcYCcpLnJlcGxhY2UoL1xcJHsvZywgJyRcXFxceycpO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBge2Nvb2tlZCwgcmF3fWAgb2JqZWN0IGZyb20gdGhlIGBtZXRhQmxvY2tgIGFuZCBgbWVzc2FnZVBhcnRgLlxuICpcbiAqIFRoZSBgcmF3YCB0ZXh0IG11c3QgaGF2ZSB2YXJpb3VzIGNoYXJhY3RlciBzZXF1ZW5jZXMgZXNjYXBlZDpcbiAqICogXCJcXFwiIHdvdWxkIG90aGVyd2lzZSBpbmRpY2F0ZSB0aGF0IHRoZSBuZXh0IGNoYXJhY3RlciBpcyBhIGNvbnRyb2wgY2hhcmFjdGVyLlxuICogKiBcImBcIiBhbmQgXCIke1wiIGFyZSB0ZW1wbGF0ZSBzdHJpbmcgY29udHJvbCBzZXF1ZW5jZXMgdGhhdCB3b3VsZCBvdGhlcndpc2UgcHJlbWF0dXJlbHkgaW5kaWNhdGVcbiAqICAgdGhlIGVuZCBvZiBhIG1lc3NhZ2UgcGFydC5cbiAqICogXCI6XCIgaW5zaWRlIGEgbWV0YWJsb2NrIHdvdWxkIHByZW1hdHVyZWx5IGluZGljYXRlIHRoZSBlbmQgb2YgdGhlIG1ldGFibG9jay5cbiAqICogXCI6XCIgYXQgdGhlIHN0YXJ0IG9mIGEgbWVzc2FnZVBhcnQgd2l0aCBubyBtZXRhYmxvY2sgd291bGQgZXJyb25lb3VzbHkgaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGFcbiAqICAgbWV0YWJsb2NrLlxuICpcbiAqIEBwYXJhbSBtZXRhQmxvY2sgQW55IG1ldGFkYXRhIHRoYXQgc2hvdWxkIGJlIHByZXBlbmRlZCB0byB0aGUgc3RyaW5nXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIG1lc3NhZ2UgcGFydCBvZiB0aGUgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhcbiAgICBtZXRhQmxvY2s6IHN0cmluZywgbWVzc2FnZVBhcnQ6IHN0cmluZywgcmFuZ2U6IFBhcnNlU291cmNlU3BhbnxudWxsKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgaWYgKG1ldGFCbG9jayA9PT0gJycpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29va2VkOiBtZXNzYWdlUGFydCxcbiAgICAgIHJhdzogZXNjYXBlRm9yVGVtcGxhdGVMaXRlcmFsKGVzY2FwZVN0YXJ0aW5nQ29sb24oZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCkpKSxcbiAgICAgIHJhbmdlLFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogYDoke21ldGFCbG9ja306JHttZXNzYWdlUGFydH1gLFxuICAgICAgcmF3OiBlc2NhcGVGb3JUZW1wbGF0ZUxpdGVyYWwoXG4gICAgICAgICAgYDoke2VzY2FwZUNvbG9ucyhlc2NhcGVTbGFzaGVzKG1ldGFCbG9jaykpfToke2VzY2FwZVNsYXNoZXMobWVzc2FnZVBhcnQpfWApLFxuICAgICAgcmFuZ2UsXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZXJuYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBFeHRlcm5hbFJlZmVyZW5jZSwgdHlwZT86IFR5cGV8bnVsbCwgcHVibGljIHR5cGVQYXJhbXM6IFR5cGVbXXxudWxsID0gbnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEV4dGVybmFsRXhwciAmJiB0aGlzLnZhbHVlLm5hbWUgPT09IGUudmFsdWUubmFtZSAmJlxuICAgICAgICB0aGlzLnZhbHVlLm1vZHVsZU5hbWUgPT09IGUudmFsdWUubW9kdWxlTmFtZSAmJiB0aGlzLnZhbHVlLnJ1bnRpbWUgPT09IGUudmFsdWUucnVudGltZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXh0ZXJuYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogRXh0ZXJuYWxFeHByIHtcbiAgICByZXR1cm4gbmV3IEV4dGVybmFsRXhwcih0aGlzLnZhbHVlLCB0aGlzLnR5cGUsIHRoaXMudHlwZVBhcmFtcywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZXJuYWxSZWZlcmVuY2Uge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbW9kdWxlTmFtZTogc3RyaW5nfG51bGwsIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbCwgcHVibGljIHJ1bnRpbWU/OiBhbnl8bnVsbCkge1xuICB9XG4gIC8vIE5vdGU6IG5vIGlzRXF1aXZhbGVudCBtZXRob2QgaGVyZSBhcyB3ZSB1c2UgdGhpcyBhcyBhbiBpbnRlcmZhY2UgdG9vLlxufVxuXG5leHBvcnQgY2xhc3MgQ29uZGl0aW9uYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB0cnVlQ2FzZTogRXhwcmVzc2lvbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHRydWVDYXNlOiBFeHByZXNzaW9uLCBwdWJsaWMgZmFsc2VDYXNlOiBFeHByZXNzaW9ufG51bGwgPSBudWxsLFxuICAgICAgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSB8fCB0cnVlQ2FzZS50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnRydWVDYXNlID0gdHJ1ZUNhc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29uZGl0aW9uYWxFeHByICYmIHRoaXMuY29uZGl0aW9uLmlzRXF1aXZhbGVudChlLmNvbmRpdGlvbikgJiZcbiAgICAgICAgdGhpcy50cnVlQ2FzZS5pc0VxdWl2YWxlbnQoZS50cnVlQ2FzZSkgJiYgbnVsbFNhZmVJc0VxdWl2YWxlbnQodGhpcy5mYWxzZUNhc2UsIGUuZmFsc2VDYXNlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q29uZGl0aW9uYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogQ29uZGl0aW9uYWxFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgdGhpcy5jb25kaXRpb24uY2xvbmUoKSwgdGhpcy50cnVlQ2FzZS5jbG9uZSgpLCB0aGlzLmZhbHNlQ2FzZT8uY2xvbmUoKSwgdGhpcy50eXBlLFxuICAgICAgICB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIE5vdEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIoQk9PTF9UWVBFLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBOb3RFeHByICYmIHRoaXMuY29uZGl0aW9uLmlzRXF1aXZhbGVudChlLmNvbmRpdGlvbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdE5vdEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBOb3RFeHByIHtcbiAgICByZXR1cm4gbmV3IE5vdEV4cHIodGhpcy5jb25kaXRpb24uY2xvbmUoKSwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRm5QYXJhbSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBUeXBlfG51bGwgPSBudWxsKSB7fVxuXG4gIGlzRXF1aXZhbGVudChwYXJhbTogRm5QYXJhbSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IHBhcmFtLm5hbWU7XG4gIH1cblxuICBjbG9uZSgpOiBGblBhcmFtIHtcbiAgICByZXR1cm4gbmV3IEZuUGFyYW0odGhpcy5uYW1lLCB0aGlzLnR5cGUpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBwYXJhbXM6IEZuUGFyYW1bXSwgcHVibGljIHN0YXRlbWVudHM6IFN0YXRlbWVudFtdLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgbmFtZT86IHN0cmluZ3xudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRnVuY3Rpb25FeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJhbXMsIGUucGFyYW1zKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuc3RhdGVtZW50cywgZS5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RnVuY3Rpb25FeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdG9EZWNsU3RtdChuYW1lOiBzdHJpbmcsIG1vZGlmaWVycz86IFN0bXRNb2RpZmllcik6IERlY2xhcmVGdW5jdGlvblN0bXQge1xuICAgIHJldHVybiBuZXcgRGVjbGFyZUZ1bmN0aW9uU3RtdChcbiAgICAgICAgbmFtZSwgdGhpcy5wYXJhbXMsIHRoaXMuc3RhdGVtZW50cywgdGhpcy50eXBlLCBtb2RpZmllcnMsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBGdW5jdGlvbkV4cHIge1xuICAgIC8vIFRPRE86IFNob3VsZCB3ZSBkZWVwIGNsb25lIHN0YXRlbWVudHM/XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbkV4cHIoXG4gICAgICAgIHRoaXMucGFyYW1zLm1hcChwID0+IHAuY2xvbmUoKSksIHRoaXMuc3RhdGVtZW50cywgdGhpcy50eXBlLCB0aGlzLnNvdXJjZVNwYW4sIHRoaXMubmFtZSk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgVW5hcnlPcGVyYXRvckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgb3BlcmF0b3I6IFVuYXJ5T3BlcmF0b3IsIHB1YmxpYyBleHByOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgcGFyZW5zOiBib29sZWFuID0gdHJ1ZSkge1xuICAgIHN1cGVyKHR5cGUgfHwgTlVNQkVSX1RZUEUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFVuYXJ5T3BlcmF0b3JFeHByICYmIHRoaXMub3BlcmF0b3IgPT09IGUub3BlcmF0b3IgJiZcbiAgICAgICAgdGhpcy5leHByLmlzRXF1aXZhbGVudChlLmV4cHIpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRVbmFyeU9wZXJhdG9yRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFVuYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IFVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICB0aGlzLm9wZXJhdG9yLCB0aGlzLmV4cHIuY2xvbmUoKSwgdGhpcy50eXBlLCB0aGlzLnNvdXJjZVNwYW4sIHRoaXMucGFyZW5zKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBCaW5hcnlPcGVyYXRvckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIGxoczogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgb3BlcmF0b3I6IEJpbmFyeU9wZXJhdG9yLCBsaHM6IEV4cHJlc3Npb24sIHB1YmxpYyByaHM6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBwYXJlbnM6IGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgc3VwZXIodHlwZSB8fCBsaHMudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy5saHMgPSBsaHM7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQmluYXJ5T3BlcmF0b3JFeHByICYmIHRoaXMub3BlcmF0b3IgPT09IGUub3BlcmF0b3IgJiZcbiAgICAgICAgdGhpcy5saHMuaXNFcXVpdmFsZW50KGUubGhzKSAmJiB0aGlzLnJocy5pc0VxdWl2YWxlbnQoZS5yaHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCaW5hcnlPcGVyYXRvckV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICB0aGlzLm9wZXJhdG9yLCB0aGlzLmxocy5jbG9uZSgpLCB0aGlzLnJocy5jbG9uZSgpLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3BhbiwgdGhpcy5wYXJlbnMpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRQcm9wRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgLy8gQW4gYWxpYXMgZm9yIG5hbWUsIHdoaWNoIGFsbG93cyBvdGhlciBsb2dpYyB0byBoYW5kbGUgcHJvcGVydHkgcmVhZHMgYW5kIGtleWVkIHJlYWRzIHRvZ2V0aGVyLlxuICBnZXQgaW5kZXgoKSB7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkUHJvcEV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5uYW1lID09PSBlLm5hbWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlYWRQcm9wRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVQcm9wRXhwcih0aGlzLnJlY2VpdmVyLCB0aGlzLm5hbWUsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVhZFByb3BFeHByIHtcbiAgICByZXR1cm4gbmV3IFJlYWRQcm9wRXhwcih0aGlzLnJlY2VpdmVyLmNsb25lKCksIHRoaXMubmFtZSwgdGhpcy50eXBlLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBwdWJsaWMgaW5kZXg6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVhZEtleUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZUtleUV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVLZXlFeHByKHRoaXMucmVjZWl2ZXIsIHRoaXMuaW5kZXgsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVhZEtleUV4cHIge1xuICAgIHJldHVybiBuZXcgUmVhZEtleUV4cHIodGhpcy5yZWNlaXZlciwgdGhpcy5pbmRleC5jbG9uZSgpLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEFycmF5RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgZW50cmllczogRXhwcmVzc2lvbltdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXMuZXZlcnkoZSA9PiBlLmlzQ29uc3RhbnQoKSk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTGl0ZXJhbEFycmF5RXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuZW50cmllcywgZS5lbnRyaWVzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsQXJyYXlFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogTGl0ZXJhbEFycmF5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsQXJyYXlFeHByKHRoaXMuZW50cmllcy5tYXAoZSA9PiBlLmNsb25lKCkpLCB0aGlzLnR5cGUsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxNYXBFbnRyeSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBrZXk6IHN0cmluZywgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCBwdWJsaWMgcXVvdGVkOiBib29sZWFuKSB7fVxuICBpc0VxdWl2YWxlbnQoZTogTGl0ZXJhbE1hcEVudHJ5KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMua2V5ID09PSBlLmtleSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIGNsb25lKCk6IExpdGVyYWxNYXBFbnRyeSB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwRW50cnkodGhpcy5rZXksIHRoaXMudmFsdWUuY2xvbmUoKSwgdGhpcy5xdW90ZWQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWVUeXBlOiBUeXBlfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBlbnRyaWVzOiBMaXRlcmFsTWFwRW50cnlbXSwgdHlwZT86IE1hcFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHRoaXMudmFsdWVUeXBlID0gdHlwZS52YWx1ZVR5cGU7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxNYXBFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5lbnRyaWVzLCBlLmVudHJpZXMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS52YWx1ZS5pc0NvbnN0YW50KCkpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbE1hcEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBMaXRlcmFsTWFwRXhwciB7XG4gICAgY29uc3QgZW50cmllc0Nsb25lID0gdGhpcy5lbnRyaWVzLm1hcChlbnRyeSA9PiBlbnRyeS5jbG9uZSgpKTtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxNYXBFeHByKGVudHJpZXNDbG9uZSwgdGhpcy50eXBlIGFzIE1hcFR5cGUgfCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21tYUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHBhcnRzOiBFeHByZXNzaW9uW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdLnR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbW1hRXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMucGFydHMsIGUucGFydHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb21tYUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBDb21tYUV4cHIge1xuICAgIHJldHVybiBuZXcgQ29tbWFFeHByKHRoaXMucGFydHMubWFwKHAgPT4gcC5jbG9uZSgpKSk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHByZXNzaW9uVmlzaXRvciB7XG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogV3JpdGVLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGFzdDogSW52b2tlRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VGFnZ2VkVGVtcGxhdGVFeHByKGFzdDogVGFnZ2VkVGVtcGxhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBMaXRlcmFsRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExvY2FsaXplZFN0cmluZyhhc3Q6IExvY2FsaXplZFN0cmluZywgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IEV4dGVybmFsRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IENvbmRpdGlvbmFsRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE5vdEV4cHIoYXN0OiBOb3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogRnVuY3Rpb25FeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VW5hcnlPcGVyYXRvckV4cHIoYXN0OiBVbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogUmVhZEtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogTGl0ZXJhbE1hcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBDb21tYUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFR5cGVvZkV4cHIoYXN0OiBUeXBlb2ZFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cbmV4cG9ydCBjb25zdCBOVUxMX0VYUFIgPSBuZXcgTGl0ZXJhbEV4cHIobnVsbCwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgVFlQRURfTlVMTF9FWFBSID0gbmV3IExpdGVyYWxFeHByKG51bGwsIElORkVSUkVEX1RZUEUsIG51bGwpO1xuXG4vLy8vIFN0YXRlbWVudHNcbmV4cG9ydCBlbnVtIFN0bXRNb2RpZmllciB7XG4gIE5vbmUgPSAwLFxuICBGaW5hbCA9IDEgPDwgMCxcbiAgUHJpdmF0ZSA9IDEgPDwgMSxcbiAgRXhwb3J0ZWQgPSAxIDw8IDIsXG4gIFN0YXRpYyA9IDEgPDwgMyxcbn1cblxuZXhwb3J0IGNsYXNzIExlYWRpbmdDb21tZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHRleHQ6IHN0cmluZywgcHVibGljIG11bHRpbGluZTogYm9vbGVhbiwgcHVibGljIHRyYWlsaW5nTmV3bGluZTogYm9vbGVhbikge31cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVsdGlsaW5lID8gYCAke3RoaXMudGV4dH0gYCA6IHRoaXMudGV4dDtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEpTRG9jQ29tbWVudCBleHRlbmRzIExlYWRpbmdDb21tZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHRhZ3M6IEpTRG9jVGFnW10pIHtcbiAgICBzdXBlcignJywgLyogbXVsdGlsaW5lICovIHRydWUsIC8qIHRyYWlsaW5nTmV3bGluZSAqLyB0cnVlKTtcbiAgfVxuICBvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiBzZXJpYWxpemVUYWdzKHRoaXMudGFncyk7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyID0gU3RtdE1vZGlmaWVyLk5vbmUsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBwdWJsaWMgbGVhZGluZ0NvbW1lbnRzPzogTGVhZGluZ0NvbW1lbnRbXSkge31cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIHN0YXRlbWVudCBwcm9kdWNlcyB0aGUgc2FtZSB2YWx1ZSBhcyB0aGUgZ2l2ZW4gc3RhdGVtZW50LlxuICAgKiBOb3RlOiBXZSBkb24ndCBjaGVjayBUeXBlcyBub3IgUGFyc2VTb3VyY2VTcGFucyBub3IgZnVuY3Rpb24gYXJndW1lbnRzLlxuICAgKi9cbiAgYWJzdHJhY3QgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW47XG5cbiAgYWJzdHJhY3QgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xuXG4gIGhhc01vZGlmaWVyKG1vZGlmaWVyOiBTdG10TW9kaWZpZXIpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKHRoaXMubW9kaWZpZXJzICYgbW9kaWZpZXIpICE9PSAwO1xuICB9XG5cbiAgYWRkTGVhZGluZ0NvbW1lbnQobGVhZGluZ0NvbW1lbnQ6IExlYWRpbmdDb21tZW50KTogdm9pZCB7XG4gICAgdGhpcy5sZWFkaW5nQ29tbWVudHMgPSB0aGlzLmxlYWRpbmdDb21tZW50cyA/PyBbXTtcbiAgICB0aGlzLmxlYWRpbmdDb21tZW50cy5wdXNoKGxlYWRpbmdDb21tZW50KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBEZWNsYXJlVmFyU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlPzogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzLCBzb3VyY2VTcGFuLCBsZWFkaW5nQ29tbWVudHMpO1xuICAgIHRoaXMudHlwZSA9IHR5cGUgfHwgKHZhbHVlICYmIHZhbHVlLnR5cGUpIHx8IG51bGw7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRGVjbGFyZVZhclN0bXQgJiYgdGhpcy5uYW1lID09PSBzdG10Lm5hbWUgJiZcbiAgICAgICAgKHRoaXMudmFsdWUgPyAhIXN0bXQudmFsdWUgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoc3RtdC52YWx1ZSkgOiAhc3RtdC52YWx1ZSk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlY2xhcmVWYXJTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWNsYXJlRnVuY3Rpb25TdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgcGFyYW1zOiBGblBhcmFtW10sIHB1YmxpYyBzdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSxcbiAgICAgIHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVycz86IFN0bXRNb2RpZmllciwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgbGVhZGluZ0NvbW1lbnRzPzogTGVhZGluZ0NvbW1lbnRbXSkge1xuICAgIHN1cGVyKG1vZGlmaWVycywgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRGVjbGFyZUZ1bmN0aW9uU3RtdCAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMucGFyYW1zLCBzdG10LnBhcmFtcykgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnN0YXRlbWVudHMsIHN0bXQuc3RhdGVtZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlY2xhcmVGdW5jdGlvblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4cHJlc3Npb25TdGF0ZW1lbnQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIoU3RtdE1vZGlmaWVyLk5vbmUsIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRXhwcmVzc2lvblN0YXRlbWVudCAmJiB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KHN0bXQuZXhwcik7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV4cHJlc3Npb25TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJldHVyblN0YXRlbWVudCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsXG4gICAgICBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIoU3RtdE1vZGlmaWVyLk5vbmUsIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgUmV0dXJuU3RhdGVtZW50ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZXR1cm5TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJZlN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHB1YmxpYyB0cnVlQ2FzZTogU3RhdGVtZW50W10sXG4gICAgICBwdWJsaWMgZmFsc2VDYXNlOiBTdGF0ZW1lbnRbXSA9IFtdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIoU3RtdE1vZGlmaWVyLk5vbmUsIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgSWZTdG10ICYmIHRoaXMuY29uZGl0aW9uLmlzRXF1aXZhbGVudChzdG10LmNvbmRpdGlvbikgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnRydWVDYXNlLCBzdG10LnRydWVDYXNlKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuZmFsc2VDYXNlLCBzdG10LmZhbHNlQ2FzZSk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdElmU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRlbWVudFZpc2l0b3Ige1xuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXhwcmVzc2lvblN0bXQoc3RtdDogRXhwcmVzc2lvblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SWZTdG10KHN0bXQ6IElmU3RtdCwgY29udGV4dDogYW55KTogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFN0YXRlbWVudFZpc2l0b3IsIEV4cHJlc3Npb25WaXNpdG9yIHtcbiAgdmlzaXRUeXBlKGFzdDogVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXN0O1xuICB9XG4gIHZpc2l0RXhwcmVzc2lvbihhc3Q6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlKSB7XG4gICAgICBhc3QudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uVHlwZSh0eXBlOiBFeHByZXNzaW9uVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0eXBlLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBpZiAodHlwZS50eXBlUGFyYW1zICE9PSBudWxsKSB7XG4gICAgICB0eXBlLnR5cGVQYXJhbXMuZm9yRWFjaChwYXJhbSA9PiB0aGlzLnZpc2l0VHlwZShwYXJhbSwgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBcnJheVR5cGUodHlwZTogQXJyYXlUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRUcmFuc3BsYW50ZWRUeXBlKHR5cGU6IFRyYW5zcGxhbnRlZFR5cGU8dW5rbm93bj4sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHR5cGU7XG4gIH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXN0O1xuICB9XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0V3JpdGVWYXJFeHByKGFzdDogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZUtleUV4cHIoYXN0OiBXcml0ZUtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZVByb3BFeHByKGFzdDogV3JpdGVQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBJbnZva2VGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0VGFnZ2VkVGVtcGxhdGVFeHByKGFzdDogVGFnZ2VkVGVtcGxhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC50YWcudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QudGVtcGxhdGUuZXhwcmVzc2lvbnMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IExpdGVyYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChhc3QudHlwZVBhcmFtcykge1xuICAgICAgYXN0LnR5cGVQYXJhbXMuZm9yRWFjaCh0eXBlID0+IHR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuZmFsc2VDYXNlIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4gZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJzOiBFeHByZXNzaW9uW10sIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGV4cHJzLmZvckVhY2goZXhwciA9PiBleHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChzdG10LnZhbHVlKSB7XG4gICAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHN0bXQudHlwZSkge1xuICAgICAgc3RtdC50eXBlLnZpc2l0VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzLCBjb250ZXh0KTtcbiAgICBpZiAoc3RtdC50eXBlKSB7XG4gICAgICBzdG10LnR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0SWZTdG10KHN0bXQ6IElmU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBzdG10LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC50cnVlQ2FzZSwgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5mYWxzZUNhc2UsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0QWxsU3RhdGVtZW50cyhzdG10czogU3RhdGVtZW50W10sIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIHN0bXRzLmZvckVhY2goc3RtdCA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQpKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbGVhZGluZ0NvbW1lbnQoXG4gICAgdGV4dDogc3RyaW5nLCBtdWx0aWxpbmU6IGJvb2xlYW4gPSBmYWxzZSwgdHJhaWxpbmdOZXdsaW5lOiBib29sZWFuID0gdHJ1ZSk6IExlYWRpbmdDb21tZW50IHtcbiAgcmV0dXJuIG5ldyBMZWFkaW5nQ29tbWVudCh0ZXh0LCBtdWx0aWxpbmUsIHRyYWlsaW5nTmV3bGluZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBqc0RvY0NvbW1lbnQodGFnczogSlNEb2NUYWdbXSA9IFtdKTogSlNEb2NDb21tZW50IHtcbiAgcmV0dXJuIG5ldyBKU0RvY0NvbW1lbnQodGFncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJpYWJsZShcbiAgICBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG5ldyBSZWFkVmFyRXhwcihuYW1lLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydEV4cHIoXG4gICAgaWQ6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlUGFyYW1zOiBUeXBlW118bnVsbCA9IG51bGwsXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXh0ZXJuYWxFeHByIHtcbiAgcmV0dXJuIG5ldyBFeHRlcm5hbEV4cHIoaWQsIG51bGwsIHR5cGVQYXJhbXMsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0VHlwZShcbiAgICBpZDogRXh0ZXJuYWxSZWZlcmVuY2UsIHR5cGVQYXJhbXM/OiBUeXBlW118bnVsbCwgdHlwZU1vZGlmaWVycz86IFR5cGVNb2RpZmllcik6IEV4cHJlc3Npb25UeXBlfFxuICAgIG51bGwge1xuICByZXR1cm4gaWQgIT0gbnVsbCA/IGV4cHJlc3Npb25UeXBlKGltcG9ydEV4cHIoaWQsIHR5cGVQYXJhbXMsIG51bGwpLCB0eXBlTW9kaWZpZXJzKSA6IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHByZXNzaW9uVHlwZShcbiAgICBleHByOiBFeHByZXNzaW9uLCB0eXBlTW9kaWZpZXJzPzogVHlwZU1vZGlmaWVyLCB0eXBlUGFyYW1zPzogVHlwZVtdfG51bGwpOiBFeHByZXNzaW9uVHlwZSB7XG4gIHJldHVybiBuZXcgRXhwcmVzc2lvblR5cGUoZXhwciwgdHlwZU1vZGlmaWVycywgdHlwZVBhcmFtcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc3BsYW50ZWRUeXBlPFQ+KHR5cGU6IFQsIHR5cGVNb2RpZmllcnM/OiBUeXBlTW9kaWZpZXIpOiBUcmFuc3BsYW50ZWRUeXBlPFQ+IHtcbiAgcmV0dXJuIG5ldyBUcmFuc3BsYW50ZWRUeXBlKHR5cGUsIHR5cGVNb2RpZmllcnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHlwZW9mRXhwcihleHByOiBFeHByZXNzaW9uKSB7XG4gIHJldHVybiBuZXcgVHlwZW9mRXhwcihleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWxBcnIoXG4gICAgdmFsdWVzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IExpdGVyYWxBcnJheUV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxBcnJheUV4cHIodmFsdWVzLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWxNYXAoXG4gICAgdmFsdWVzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbiwgdmFsdWU6IEV4cHJlc3Npb259W10sXG4gICAgdHlwZTogTWFwVHlwZXxudWxsID0gbnVsbCk6IExpdGVyYWxNYXBFeHByIHtcbiAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwRXhwcihcbiAgICAgIHZhbHVlcy5tYXAoZSA9PiBuZXcgTGl0ZXJhbE1hcEVudHJ5KGUua2V5LCBlLnZhbHVlLCBlLnF1b3RlZCkpLCB0eXBlLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuYXJ5KFxuICAgIG9wZXJhdG9yOiBVbmFyeU9wZXJhdG9yLCBleHByOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZSxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBVbmFyeU9wZXJhdG9yRXhwciB7XG4gIHJldHVybiBuZXcgVW5hcnlPcGVyYXRvckV4cHIob3BlcmF0b3IsIGV4cHIsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm90KGV4cHI6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IE5vdEV4cHIge1xuICByZXR1cm4gbmV3IE5vdEV4cHIoZXhwciwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmbihcbiAgICBwYXJhbXM6IEZuUGFyYW1bXSwgYm9keTogU3RhdGVtZW50W10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICBuYW1lPzogc3RyaW5nfG51bGwpOiBGdW5jdGlvbkV4cHIge1xuICByZXR1cm4gbmV3IEZ1bmN0aW9uRXhwcihwYXJhbXMsIGJvZHksIHR5cGUsIHNvdXJjZVNwYW4sIG5hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaWZTdG10KFxuICAgIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgdGhlbkNsYXVzZTogU3RhdGVtZW50W10sIGVsc2VDbGF1c2U/OiBTdGF0ZW1lbnRbXSxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuLCBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gIHJldHVybiBuZXcgSWZTdG10KGNvbmRpdGlvbiwgdGhlbkNsYXVzZSwgZWxzZUNsYXVzZSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhZ2dlZFRlbXBsYXRlKFxuICAgIHRhZzogRXhwcmVzc2lvbiwgdGVtcGxhdGU6IFRlbXBsYXRlTGl0ZXJhbCwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBUYWdnZWRUZW1wbGF0ZUV4cHIge1xuICByZXR1cm4gbmV3IFRhZ2dlZFRlbXBsYXRlRXhwcih0YWcsIHRlbXBsYXRlLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWwoXG4gICAgdmFsdWU6IGFueSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTGl0ZXJhbEV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHZhbHVlLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvY2FsaXplZFN0cmluZyhcbiAgICBtZXRhQmxvY2s6IEkxOG5NZXRhLCBtZXNzYWdlUGFydHM6IExpdGVyYWxQaWVjZVtdLCBwbGFjZWhvbGRlck5hbWVzOiBQbGFjZWhvbGRlclBpZWNlW10sXG4gICAgZXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTG9jYWxpemVkU3RyaW5nIHtcbiAgcmV0dXJuIG5ldyBMb2NhbGl6ZWRTdHJpbmcobWV0YUJsb2NrLCBtZXNzYWdlUGFydHMsIHBsYWNlaG9sZGVyTmFtZXMsIGV4cHJlc3Npb25zLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTnVsbChleHA6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgcmV0dXJuIGV4cCBpbnN0YW5jZW9mIExpdGVyYWxFeHByICYmIGV4cC52YWx1ZSA9PT0gbnVsbDtcbn1cblxuLy8gVGhlIGxpc3Qgb2YgSlNEb2MgdGFncyB0aGF0IHdlIGN1cnJlbnRseSBzdXBwb3J0LiBFeHRlbmQgaXQgaWYgbmVlZGVkLlxuZXhwb3J0IGNvbnN0IGVudW0gSlNEb2NUYWdOYW1lIHtcbiAgRGVzYyA9ICdkZXNjJyxcbiAgSWQgPSAnaWQnLFxuICBNZWFuaW5nID0gJ21lYW5pbmcnLFxuICBTdXBwcmVzcyA9ICdzdXBwcmVzcycsXG59XG5cbi8qXG4gKiBUeXBlU2NyaXB0IGhhcyBhbiBBUEkgZm9yIEpTRG9jIGFscmVhZHksIGJ1dCBpdCdzIG5vdCBleHBvc2VkLlxuICogaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy83MzkzXG4gKiBGb3Igbm93IHdlIGNyZWF0ZSB0eXBlcyB0aGF0IGFyZSBzaW1pbGFyIHRvIHRoZWlycyBzbyB0aGF0IG1pZ3JhdGluZ1xuICogdG8gdGhlaXIgQVBJIHdpbGwgYmUgZWFzaWVyLiBTZWUgZS5nLiBgdHMuSlNEb2NUYWdgIGFuZCBgdHMuSlNEb2NDb21tZW50YC5cbiAqL1xuZXhwb3J0IHR5cGUgSlNEb2NUYWcgPSB7XG4gIC8vIGB0YWdOYW1lYCBpcyBlLmcuIFwicGFyYW1cIiBpbiBhbiBgQHBhcmFtYCBkZWNsYXJhdGlvblxuICB0YWdOYW1lOiBKU0RvY1RhZ05hbWV8c3RyaW5nLFxuICAvLyBBbnkgcmVtYWluaW5nIHRleHQgb24gdGhlIHRhZywgZS5nLiB0aGUgZGVzY3JpcHRpb25cbiAgdGV4dD86IHN0cmluZyxcbn18e1xuICAvLyBubyBgdGFnTmFtZWAgZm9yIHBsYWluIHRleHQgZG9jdW1lbnRhdGlvbiB0aGF0IG9jY3VycyBiZWZvcmUgYW55IGBAcGFyYW1gIGxpbmVzXG4gIHRhZ05hbWU/OiB1bmRlZmluZWQsIHRleHQ6IHN0cmluZyxcbn07XG5cbi8qXG4gKiBTZXJpYWxpemVzIGEgYFRhZ2AgaW50byBhIHN0cmluZy5cbiAqIFJldHVybnMgYSBzdHJpbmcgbGlrZSBcIiBAZm9vIHtiYXJ9IGJhelwiIChub3RlIHRoZSBsZWFkaW5nIHdoaXRlc3BhY2UgYmVmb3JlIGBAZm9vYCkuXG4gKi9cbmZ1bmN0aW9uIHRhZ1RvU3RyaW5nKHRhZzogSlNEb2NUYWcpOiBzdHJpbmcge1xuICBsZXQgb3V0ID0gJyc7XG4gIGlmICh0YWcudGFnTmFtZSkge1xuICAgIG91dCArPSBgIEAke3RhZy50YWdOYW1lfWA7XG4gIH1cbiAgaWYgKHRhZy50ZXh0KSB7XG4gICAgaWYgKHRhZy50ZXh0Lm1hdGNoKC9cXC9cXCp8XFwqXFwvLykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSlNEb2MgdGV4dCBjYW5ub3QgY29udGFpbiBcIi8qXCIgYW5kIFwiKi9cIicpO1xuICAgIH1cbiAgICBvdXQgKz0gJyAnICsgdGFnLnRleHQucmVwbGFjZSgvQC9nLCAnXFxcXEAnKTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVUYWdzKHRhZ3M6IEpTRG9jVGFnW10pOiBzdHJpbmcge1xuICBpZiAodGFncy5sZW5ndGggPT09IDApIHJldHVybiAnJztcblxuICBpZiAodGFncy5sZW5ndGggPT09IDEgJiYgdGFnc1swXS50YWdOYW1lICYmICF0YWdzWzBdLnRleHQpIHtcbiAgICAvLyBUaGUgSlNET0MgY29tbWVudCBpcyBhIHNpbmdsZSBzaW1wbGUgdGFnOiBlLmcgYC8qKiBAdGFnbmFtZSAqL2AuXG4gICAgcmV0dXJuIGAqJHt0YWdUb1N0cmluZyh0YWdzWzBdKX0gYDtcbiAgfVxuXG4gIGxldCBvdXQgPSAnKlxcbic7XG4gIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICBvdXQgKz0gJyAqJztcbiAgICAvLyBJZiB0aGUgdGFnVG9TdHJpbmcgaXMgbXVsdGktbGluZSwgaW5zZXJ0IFwiICogXCIgcHJlZml4ZXMgb24gbGluZXMuXG4gICAgb3V0ICs9IHRhZ1RvU3RyaW5nKHRhZykucmVwbGFjZSgvXFxuL2csICdcXG4gKiAnKTtcbiAgICBvdXQgKz0gJ1xcbic7XG4gIH1cbiAgb3V0ICs9ICcgJztcbiAgcmV0dXJuIG91dDtcbn1cbiJdfQ==