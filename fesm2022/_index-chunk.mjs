/**
 * @license Angular v22.3.0-next.2+sha-330a9ac
 * (c) 2010-2026 Google LLC. https://angular.dev/
 * License: MIT
 */

class ParseSpan {
  start;
  end;
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
  toAbsolute(absoluteOffset) {
    return new AbsoluteSourceSpan(absoluteOffset + this.start, absoluteOffset + this.end);
  }
}
class AST {
  span;
  sourceSpan;
  constructor(span, sourceSpan) {
    this.span = span;
    this.sourceSpan = sourceSpan;
  }
  toString() {
    return 'AST';
  }
}
class ASTWithName extends AST {
  nameSpan;
  constructor(span, sourceSpan, nameSpan) {
    super(span, sourceSpan);
    this.nameSpan = nameSpan;
  }
}
class EmptyExpr extends AST {
  visit(visitor, context = null) {
    return visitor.visitEmptyExpr?.(this, context);
  }
}
class ImplicitReceiver extends AST {
  visit(visitor, context = null) {
    return visitor.visitImplicitReceiver(this, context);
  }
}
class ThisReceiver extends AST {
  visit(visitor, context = null) {
    return visitor.visitThisReceiver?.(this, context);
  }
}
class Chain extends AST {
  expressions;
  constructor(span, sourceSpan, expressions) {
    super(span, sourceSpan);
    this.expressions = expressions;
  }
  visit(visitor, context = null) {
    return visitor.visitChain(this, context);
  }
}
class Conditional extends AST {
  condition;
  trueExp;
  falseExp;
  constructor(span, sourceSpan, condition, trueExp, falseExp) {
    super(span, sourceSpan);
    this.condition = condition;
    this.trueExp = trueExp;
    this.falseExp = falseExp;
  }
  visit(visitor, context = null) {
    return visitor.visitConditional(this, context);
  }
}
class PropertyRead extends ASTWithName {
  receiver;
  name;
  constructor(span, sourceSpan, nameSpan, receiver, name) {
    super(span, sourceSpan, nameSpan);
    this.receiver = receiver;
    this.name = name;
  }
  visit(visitor, context = null) {
    return visitor.visitPropertyRead(this, context);
  }
}
class SafePropertyRead extends ASTWithName {
  receiver;
  name;
  constructor(span, sourceSpan, nameSpan, receiver, name) {
    super(span, sourceSpan, nameSpan);
    this.receiver = receiver;
    this.name = name;
  }
  visit(visitor, context = null) {
    return visitor.visitSafePropertyRead(this, context);
  }
}
class KeyedRead extends AST {
  receiver;
  key;
  constructor(span, sourceSpan, receiver, key) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.key = key;
  }
  visit(visitor, context = null) {
    return visitor.visitKeyedRead(this, context);
  }
}
class SafeKeyedRead extends AST {
  receiver;
  key;
  constructor(span, sourceSpan, receiver, key) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.key = key;
  }
  visit(visitor, context = null) {
    return visitor.visitSafeKeyedRead(this, context);
  }
}
var BindingPipeType;
(function (BindingPipeType) {
  BindingPipeType[BindingPipeType["ReferencedByName"] = 0] = "ReferencedByName";
  BindingPipeType[BindingPipeType["ReferencedDirectly"] = 1] = "ReferencedDirectly";
})(BindingPipeType || (BindingPipeType = {}));
class BindingPipe extends ASTWithName {
  exp;
  name;
  args;
  type;
  constructor(span, sourceSpan, exp, name, args, type, nameSpan) {
    super(span, sourceSpan, nameSpan);
    this.exp = exp;
    this.name = name;
    this.args = args;
    this.type = type;
  }
  visit(visitor, context = null) {
    return visitor.visitPipe(this, context);
  }
}
class LiteralPrimitive extends AST {
  value;
  constructor(span, sourceSpan, value) {
    super(span, sourceSpan);
    this.value = value;
  }
  visit(visitor, context = null) {
    return visitor.visitLiteralPrimitive(this, context);
  }
}
class LiteralArray extends AST {
  expressions;
  constructor(span, sourceSpan, expressions) {
    super(span, sourceSpan);
    this.expressions = expressions;
  }
  visit(visitor, context = null) {
    return visitor.visitLiteralArray(this, context);
  }
}
class SpreadElement extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitSpreadElement(this, context);
  }
}
class LiteralMap extends AST {
  keys;
  values;
  constructor(span, sourceSpan, keys, values) {
    super(span, sourceSpan);
    this.keys = keys;
    this.values = values;
  }
  visit(visitor, context = null) {
    return visitor.visitLiteralMap(this, context);
  }
}
class Interpolation extends AST {
  strings;
  expressions;
  constructor(span, sourceSpan, strings, expressions) {
    super(span, sourceSpan);
    this.strings = strings;
    this.expressions = expressions;
  }
  visit(visitor, context = null) {
    return visitor.visitInterpolation(this, context);
  }
}
class Binary extends AST {
  operation;
  left;
  right;
  constructor(span, sourceSpan, operation, left, right) {
    super(span, sourceSpan);
    this.operation = operation;
    this.left = left;
    this.right = right;
  }
  visit(visitor, context = null) {
    return visitor.visitBinary(this, context);
  }
  static isAssignmentOperation(op) {
    return op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=' || op === '%=' || op === '**=' || op === '&&=' || op === '||=' || op === '??=';
  }
}
class Unary extends Binary {
  operator;
  expr;
  isPrefix;
  left = null;
  right = null;
  operation = null;
  static isUpdateOperation(op) {
    return op === '++' || op === '--';
  }
  static createMinus(span, sourceSpan, expr) {
    return new Unary(span, sourceSpan, '-', expr);
  }
  static createPlus(span, sourceSpan, expr) {
    return new Unary(span, sourceSpan, '+', expr);
  }
  static createPrefixUpdate(span, sourceSpan, operator, expr) {
    return new Unary(span, sourceSpan, operator, expr, true);
  }
  static createPostfixUpdate(span, sourceSpan, operator, expr) {
    return new Unary(span, sourceSpan, operator, expr, false);
  }
  constructor(span, sourceSpan, operator, expr, isPrefix = true) {
    super(span, sourceSpan, null, null, null);
    this.operator = operator;
    this.expr = expr;
    this.isPrefix = isPrefix;
  }
  visit(visitor, context = null) {
    if (visitor.visitUnary !== undefined) {
      return visitor.visitUnary(this, context);
    }
    return visitor.visitBinary(this, context);
  }
}
class PrefixNot extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitPrefixNot(this, context);
  }
}
class TypeofExpression extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitTypeofExpression(this, context);
  }
}
class VoidExpression extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitVoidExpression(this, context);
  }
}
class NonNullAssert extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitNonNullAssert(this, context);
  }
}
class Call extends AST {
  receiver;
  args;
  argumentSpan;
  constructor(span, sourceSpan, receiver, args, argumentSpan) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.args = args;
    this.argumentSpan = argumentSpan;
  }
  visit(visitor, context = null) {
    return visitor.visitCall(this, context);
  }
}
class SafeCall extends AST {
  receiver;
  args;
  argumentSpan;
  constructor(span, sourceSpan, receiver, args, argumentSpan) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.args = args;
    this.argumentSpan = argumentSpan;
  }
  visit(visitor, context = null) {
    return visitor.visitSafeCall(this, context);
  }
}
class TaggedTemplateLiteral extends AST {
  tag;
  template;
  constructor(span, sourceSpan, tag, template) {
    super(span, sourceSpan);
    this.tag = tag;
    this.template = template;
  }
  visit(visitor, context) {
    return visitor.visitTaggedTemplateLiteral(this, context);
  }
}
class TemplateLiteral extends AST {
  elements;
  expressions;
  constructor(span, sourceSpan, elements, expressions) {
    super(span, sourceSpan);
    this.elements = elements;
    this.expressions = expressions;
  }
  visit(visitor, context) {
    return visitor.visitTemplateLiteral(this, context);
  }
}
class TemplateLiteralElement extends AST {
  text;
  constructor(span, sourceSpan, text) {
    super(span, sourceSpan);
    this.text = text;
  }
  visit(visitor, context) {
    return visitor.visitTemplateLiteralElement(this, context);
  }
}
class ParenthesizedExpression extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context) {
    return visitor.visitParenthesizedExpression(this, context);
  }
}
function unwrapWriteTarget(ast) {
  let current = ast;
  while (current instanceof ParenthesizedExpression || current instanceof NonNullAssert) {
    current = current.expression;
  }
  return current;
}
class ArrowFunctionIdentifierParameter {
  name;
  span;
  sourceSpan;
  constructor(name, span, sourceSpan) {
    this.name = name;
    this.span = span;
    this.sourceSpan = sourceSpan;
  }
}
class ArrowFunction extends AST {
  parameters;
  body;
  constructor(span, sourceSpan, parameters, body) {
    super(span, sourceSpan);
    this.parameters = parameters;
    this.body = body;
  }
  visit(visitor, context) {
    return visitor.visitArrowFunction(this, context);
  }
}
class RegularExpressionLiteral extends AST {
  body;
  flags;
  constructor(span, sourceSpan, body, flags) {
    super(span, sourceSpan);
    this.body = body;
    this.flags = flags;
  }
  visit(visitor, context) {
    return visitor.visitRegularExpressionLiteral(this, context);
  }
}
class AbsoluteSourceSpan {
  start;
  end;
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}
class ASTWithSource extends AST {
  ast;
  source;
  location;
  errors;
  constructor(ast, source, location, absoluteOffset, errors) {
    super(new ParseSpan(0, source === null ? 0 : source.length), new AbsoluteSourceSpan(absoluteOffset, source === null ? absoluteOffset : absoluteOffset + source.length));
    this.ast = ast;
    this.source = source;
    this.location = location;
    this.errors = errors;
  }
  visit(visitor, context = null) {
    if (visitor.visitASTWithSource) {
      return visitor.visitASTWithSource(this, context);
    }
    return this.ast.visit(visitor, context);
  }
  toString() {
    return `${this.source} in ${this.location}`;
  }
}
class VariableBinding {
  sourceSpan;
  key;
  value;
  constructor(sourceSpan, key, value) {
    this.sourceSpan = sourceSpan;
    this.key = key;
    this.value = value;
  }
}
class ExpressionBinding {
  sourceSpan;
  key;
  value;
  constructor(sourceSpan, key, value) {
    this.sourceSpan = sourceSpan;
    this.key = key;
    this.value = value;
  }
}
class RecursiveAstVisitor {
  visit(ast, context) {
    ast.visit(this, context);
  }
  visitUnary(ast, context) {
    this.visit(ast.expr, context);
  }
  visitBinary(ast, context) {
    this.visit(ast.left, context);
    this.visit(ast.right, context);
  }
  visitChain(ast, context) {
    this.visitAll(ast.expressions, context);
  }
  visitConditional(ast, context) {
    this.visit(ast.condition, context);
    this.visit(ast.trueExp, context);
    this.visit(ast.falseExp, context);
  }
  visitPipe(ast, context) {
    this.visit(ast.exp, context);
    this.visitAll(ast.args, context);
  }
  visitImplicitReceiver(ast, context) {}
  visitThisReceiver(ast, context) {}
  visitInterpolation(ast, context) {
    this.visitAll(ast.expressions, context);
  }
  visitKeyedRead(ast, context) {
    this.visit(ast.receiver, context);
    this.visit(ast.key, context);
  }
  visitLiteralArray(ast, context) {
    this.visitAll(ast.expressions, context);
  }
  visitLiteralMap(ast, context) {
    this.visitAll(ast.values, context);
  }
  visitLiteralPrimitive(ast, context) {}
  visitPrefixNot(ast, context) {
    this.visit(ast.expression, context);
  }
  visitTypeofExpression(ast, context) {
    this.visit(ast.expression, context);
  }
  visitVoidExpression(ast, context) {
    this.visit(ast.expression, context);
  }
  visitNonNullAssert(ast, context) {
    this.visit(ast.expression, context);
  }
  visitPropertyRead(ast, context) {
    this.visit(ast.receiver, context);
  }
  visitSafePropertyRead(ast, context) {
    this.visit(ast.receiver, context);
  }
  visitSafeKeyedRead(ast, context) {
    this.visit(ast.receiver, context);
    this.visit(ast.key, context);
  }
  visitCall(ast, context) {
    this.visit(ast.receiver, context);
    this.visitAll(ast.args, context);
  }
  visitSafeCall(ast, context) {
    this.visit(ast.receiver, context);
    this.visitAll(ast.args, context);
  }
  visitTemplateLiteral(ast, context) {
    for (let i = 0; i < ast.elements.length; i++) {
      this.visit(ast.elements[i], context);
      const expression = i < ast.expressions.length ? ast.expressions[i] : null;
      if (expression !== null) {
        this.visit(expression, context);
      }
    }
  }
  visitTemplateLiteralElement(ast, context) {}
  visitTaggedTemplateLiteral(ast, context) {
    this.visit(ast.tag, context);
    this.visit(ast.template, context);
  }
  visitParenthesizedExpression(ast, context) {
    this.visit(ast.expression, context);
  }
  visitArrowFunction(ast, context) {
    this.visit(ast.body, context);
  }
  visitRegularExpressionLiteral(ast, context) {}
  visitSpreadElement(ast, context) {
    this.visit(ast.expression, context);
  }
  visitEmptyExpr(ast, context) {}
  visitAll(asts, context) {
    for (const ast of asts) {
      this.visit(ast, context);
    }
  }
}
class ParsedProperty {
  name;
  expression;
  type;
  sourceSpan;
  keySpan;
  valueSpan;
  isLiteral;
  isLegacyAnimation;
  isAnimation;
  constructor(name, expression, type, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.expression = expression;
    this.type = type;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
    this.isLegacyAnimation = this.type === ParsedPropertyType.LEGACY_ANIMATION;
    this.isAnimation = this.type === ParsedPropertyType.ANIMATION;
  }
}
var ParsedPropertyType;
(function (ParsedPropertyType) {
  ParsedPropertyType[ParsedPropertyType["DEFAULT"] = 0] = "DEFAULT";
  ParsedPropertyType[ParsedPropertyType["LITERAL_ATTR"] = 1] = "LITERAL_ATTR";
  ParsedPropertyType[ParsedPropertyType["LEGACY_ANIMATION"] = 2] = "LEGACY_ANIMATION";
  ParsedPropertyType[ParsedPropertyType["TWO_WAY"] = 3] = "TWO_WAY";
  ParsedPropertyType[ParsedPropertyType["ANIMATION"] = 4] = "ANIMATION";
})(ParsedPropertyType || (ParsedPropertyType = {}));
var ParsedEventType;
(function (ParsedEventType) {
  ParsedEventType[ParsedEventType["Regular"] = 0] = "Regular";
  ParsedEventType[ParsedEventType["LegacyAnimation"] = 1] = "LegacyAnimation";
  ParsedEventType[ParsedEventType["TwoWay"] = 2] = "TwoWay";
  ParsedEventType[ParsedEventType["Animation"] = 3] = "Animation";
})(ParsedEventType || (ParsedEventType = {}));
class ParsedEvent {
  name;
  targetOrPhase;
  type;
  handler;
  sourceSpan;
  handlerSpan;
  keySpan;
  constructor(name, targetOrPhase, type, handler, sourceSpan, handlerSpan, keySpan) {
    this.name = name;
    this.targetOrPhase = targetOrPhase;
    this.type = type;
    this.handler = handler;
    this.sourceSpan = sourceSpan;
    this.handlerSpan = handlerSpan;
    this.keySpan = keySpan;
  }
}
class ParsedVariable {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, value, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
}
var BindingType;
(function (BindingType) {
  BindingType[BindingType["Property"] = 0] = "Property";
  BindingType[BindingType["Attribute"] = 1] = "Attribute";
  BindingType[BindingType["Class"] = 2] = "Class";
  BindingType[BindingType["Style"] = 3] = "Style";
  BindingType[BindingType["LegacyAnimation"] = 4] = "LegacyAnimation";
  BindingType[BindingType["TwoWay"] = 5] = "TwoWay";
  BindingType[BindingType["Animation"] = 6] = "Animation";
})(BindingType || (BindingType = {}));
class BoundElementProperty {
  name;
  type;
  securityContext;
  value;
  unit;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, type, securityContext, value, unit, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.type = type;
    this.securityContext = securityContext;
    this.value = value;
    this.unit = unit;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
}

class Comment {
  value;
  sourceSpan;
  constructor(value, sourceSpan) {
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visit(_visitor) {
    throw new Error('visit() not implemented for Comment');
  }
}
class Text {
  value;
  sourceSpan;
  constructor(value, sourceSpan) {
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor) {
    return visitor.visitText(this);
  }
}
class BoundText {
  value;
  sourceSpan;
  i18n;
  constructor(value, sourceSpan, i18n) {
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitBoundText(this);
  }
}
class TextAttribute {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  i18n;
  constructor(name, value, sourceSpan, keySpan, valueSpan, i18n) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitTextAttribute(this);
  }
}
class BoundAttribute {
  name;
  type;
  securityContext;
  value;
  unit;
  sourceSpan;
  keySpan;
  valueSpan;
  i18n;
  constructor(name, type, securityContext, value, unit, sourceSpan, keySpan, valueSpan, i18n) {
    this.name = name;
    this.type = type;
    this.securityContext = securityContext;
    this.value = value;
    this.unit = unit;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.i18n = i18n;
  }
  static fromBoundElementProperty(prop, i18n) {
    if (prop.keySpan === undefined) {
      throw new Error(`Unexpected state: keySpan must be defined for bound attributes but was not for ${prop.name}: ${prop.sourceSpan}`);
    }
    return new BoundAttribute(prop.name, prop.type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan, prop.keySpan, prop.valueSpan, i18n);
  }
  visit(visitor) {
    return visitor.visitBoundAttribute(this);
  }
}
class BoundEvent {
  name;
  type;
  handler;
  target;
  phase;
  sourceSpan;
  handlerSpan;
  keySpan;
  constructor(name, type, handler, target, phase, sourceSpan, handlerSpan, keySpan) {
    this.name = name;
    this.type = type;
    this.handler = handler;
    this.target = target;
    this.phase = phase;
    this.sourceSpan = sourceSpan;
    this.handlerSpan = handlerSpan;
    this.keySpan = keySpan;
  }
  static fromParsedEvent(event) {
    const target = event.type === ParsedEventType.Regular ? event.targetOrPhase : null;
    const phase = event.type === ParsedEventType.LegacyAnimation ? event.targetOrPhase : null;
    if (event.keySpan === undefined) {
      throw new Error(`Unexpected state: keySpan must be defined for bound event but was not for ${event.name}: ${event.sourceSpan}`);
    }
    return new BoundEvent(event.name, event.type, event.handler, target, phase, event.sourceSpan, event.handlerSpan, event.keySpan);
  }
  visit(visitor) {
    return visitor.visitBoundEvent(this);
  }
}
class Element {
  name;
  attributes;
  inputs;
  outputs;
  directives;
  children;
  references;
  isSelfClosing;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  isVoid;
  i18n;
  constructor(name, attributes, inputs, outputs, directives, children, references, isSelfClosing, sourceSpan, startSourceSpan, endSourceSpan, isVoid, i18n) {
    this.name = name;
    this.attributes = attributes;
    this.inputs = inputs;
    this.outputs = outputs;
    this.directives = directives;
    this.children = children;
    this.references = references;
    this.isSelfClosing = isSelfClosing;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.isVoid = isVoid;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitElement(this);
  }
}
class DeferredTrigger {
  nameSpan;
  sourceSpan;
  prefetchSpan;
  whenOrOnSourceSpan;
  hydrateSpan;
  constructor(nameSpan, sourceSpan, prefetchSpan, whenOrOnSourceSpan, hydrateSpan) {
    this.nameSpan = nameSpan;
    this.sourceSpan = sourceSpan;
    this.prefetchSpan = prefetchSpan;
    this.whenOrOnSourceSpan = whenOrOnSourceSpan;
    this.hydrateSpan = hydrateSpan;
  }
  visit(visitor) {
    return visitor.visitDeferredTrigger(this);
  }
}
class BoundDeferredTrigger extends DeferredTrigger {
  value;
  constructor(value, sourceSpan, prefetchSpan, whenSourceSpan, hydrateSpan) {
    super(null, sourceSpan, prefetchSpan, whenSourceSpan, hydrateSpan);
    this.value = value;
  }
}
class NeverDeferredTrigger extends DeferredTrigger {}
class IdleDeferredTrigger extends DeferredTrigger {
  timeout;
  constructor(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan, timeout) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.timeout = timeout;
  }
}
class ImmediateDeferredTrigger extends DeferredTrigger {}
class HoverDeferredTrigger extends DeferredTrigger {
  reference;
  constructor(reference, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.reference = reference;
  }
}
class TimerDeferredTrigger extends DeferredTrigger {
  delay;
  constructor(delay, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.delay = delay;
  }
}
class InteractionDeferredTrigger extends DeferredTrigger {
  reference;
  constructor(reference, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.reference = reference;
  }
}
class ViewportDeferredTrigger extends DeferredTrigger {
  reference;
  options;
  constructor(reference, options, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.reference = reference;
    this.options = options;
  }
}
class BlockNode {
  nameSpan;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  constructor(nameSpan, sourceSpan, startSourceSpan, endSourceSpan) {
    this.nameSpan = nameSpan;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
  }
}
class DeferredBlockPlaceholder extends BlockNode {
  children;
  minimumTime;
  i18n;
  constructor(children, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.minimumTime = minimumTime;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitDeferredBlockPlaceholder(this);
  }
}
class DeferredBlockLoading extends BlockNode {
  children;
  afterTime;
  minimumTime;
  i18n;
  constructor(children, afterTime, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.afterTime = afterTime;
    this.minimumTime = minimumTime;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitDeferredBlockLoading(this);
  }
}
class DeferredBlockError extends BlockNode {
  children;
  i18n;
  constructor(children, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitDeferredBlockError(this);
  }
}
class ContentBlock extends BlockNode {
  name;
  variables;
  children;
  i18n;
  constructor(name, variables, children, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.name = name;
    this.variables = variables;
    this.children = children;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitContentBlock(this);
  }
}
class BoundaryBlock extends BlockNode {
  children;
  errorBlocks;
  mainBlockSpan;
  i18n;
  constructor(children, errorBlocks, nameSpan, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.errorBlocks = errorBlocks;
    this.mainBlockSpan = mainBlockSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitBoundaryBlock(this);
  }
}
class BoundaryErrorBlock extends BlockNode {
  children;
  contextVariables;
  expression;
  i18n;
  constructor(children, contextVariables, expression, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.contextVariables = contextVariables;
    this.expression = expression;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitBoundaryErrorBlock(this);
  }
}
class DeferredBlock extends BlockNode {
  children;
  placeholder;
  loading;
  error;
  mainBlockSpan;
  definedName;
  i18n;
  triggers;
  prefetchTriggers;
  hydrateTriggers;
  definedTriggers;
  definedPrefetchTriggers;
  definedHydrateTriggers;
  constructor(children, triggers, prefetchTriggers, hydrateTriggers, placeholder, loading, error, nameSpan, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, definedName, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.placeholder = placeholder;
    this.loading = loading;
    this.error = error;
    this.mainBlockSpan = mainBlockSpan;
    this.definedName = definedName;
    this.i18n = i18n;
    this.triggers = triggers;
    this.prefetchTriggers = prefetchTriggers;
    this.hydrateTriggers = hydrateTriggers;
    this.definedTriggers = Object.keys(triggers);
    this.definedPrefetchTriggers = Object.keys(prefetchTriggers);
    this.definedHydrateTriggers = Object.keys(hydrateTriggers);
  }
  visit(visitor) {
    return visitor.visitDeferredBlock(this);
  }
  visitAll(visitor) {
    this.visitTriggers(this.definedHydrateTriggers, this.hydrateTriggers, visitor);
    this.visitTriggers(this.definedTriggers, this.triggers, visitor);
    this.visitTriggers(this.definedPrefetchTriggers, this.prefetchTriggers, visitor);
    visitAll(visitor, this.children);
    const remainingBlocks = [this.placeholder, this.loading, this.error].filter(x => x !== null);
    visitAll(visitor, remainingBlocks);
  }
  visitTriggers(keys, triggers, visitor) {
    visitAll(visitor, keys.map(k => triggers[k]));
  }
}
class SwitchBlock extends BlockNode {
  expression;
  groups;
  unknownBlocks;
  exhaustiveCheck;
  constructor(expression, groups, unknownBlocks, exhaustiveCheck, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
    this.groups = groups;
    this.unknownBlocks = unknownBlocks;
    this.exhaustiveCheck = exhaustiveCheck;
  }
  visit(visitor) {
    return visitor.visitSwitchBlock(this);
  }
}
class SwitchBlockCase extends BlockNode {
  expression;
  constructor(expression, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
  }
  visit(visitor) {
    return visitor.visitSwitchBlockCase(this);
  }
}
class SwitchBlockCaseGroup extends BlockNode {
  cases;
  children;
  i18n;
  constructor(cases, children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.cases = cases;
    this.children = children;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitSwitchBlockCaseGroup(this);
  }
}
class SwitchExhaustiveCheck extends BlockNode {
  expression;
  constructor(expression, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
  }
  visit(visitor) {
    return visitor.visitSwitchExhaustiveCheck(this);
  }
}
class ForLoopBlock extends BlockNode {
  item;
  expression;
  trackBy;
  trackKeywordSpan;
  contextVariables;
  children;
  empty;
  mainBlockSpan;
  i18n;
  constructor(item, expression, trackBy, trackKeywordSpan, contextVariables, children, empty, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.item = item;
    this.expression = expression;
    this.trackBy = trackBy;
    this.trackKeywordSpan = trackKeywordSpan;
    this.contextVariables = contextVariables;
    this.children = children;
    this.empty = empty;
    this.mainBlockSpan = mainBlockSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitForLoopBlock(this);
  }
}
class ForLoopBlockEmpty extends BlockNode {
  children;
  i18n;
  constructor(children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitForLoopBlockEmpty(this);
  }
}
class IfBlock extends BlockNode {
  branches;
  constructor(branches, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.branches = branches;
  }
  visit(visitor) {
    return visitor.visitIfBlock(this);
  }
}
class IfBlockBranch extends BlockNode {
  expression;
  children;
  expressionAlias;
  i18n;
  constructor(expression, children, expressionAlias, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
    this.children = children;
    this.expressionAlias = expressionAlias;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitIfBlockBranch(this);
  }
}
class UnknownBlock {
  name;
  sourceSpan;
  nameSpan;
  constructor(name, sourceSpan, nameSpan) {
    this.name = name;
    this.sourceSpan = sourceSpan;
    this.nameSpan = nameSpan;
  }
  visit(visitor) {
    return visitor.visitUnknownBlock(this);
  }
}
class LetDeclaration {
  name;
  value;
  sourceSpan;
  nameSpan;
  valueSpan;
  constructor(name, value, sourceSpan, nameSpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.nameSpan = nameSpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor) {
    return visitor.visitLetDeclaration(this);
  }
}
class Component {
  componentName;
  tagName;
  fullName;
  attributes;
  inputs;
  outputs;
  directives;
  children;
  references;
  isSelfClosing;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  i18n;
  constructor(componentName, tagName, fullName, attributes, inputs, outputs, directives, children, references, isSelfClosing, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    this.componentName = componentName;
    this.tagName = tagName;
    this.fullName = fullName;
    this.attributes = attributes;
    this.inputs = inputs;
    this.outputs = outputs;
    this.directives = directives;
    this.children = children;
    this.references = references;
    this.isSelfClosing = isSelfClosing;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitComponent(this);
  }
}
class Directive {
  name;
  attributes;
  inputs;
  outputs;
  references;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  i18n;
  constructor(name, attributes, inputs, outputs, references, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    this.name = name;
    this.attributes = attributes;
    this.inputs = inputs;
    this.outputs = outputs;
    this.references = references;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitDirective(this);
  }
}
class Template {
  tagName;
  attributes;
  inputs;
  outputs;
  directives;
  templateAttrs;
  children;
  references;
  variables;
  isSelfClosing;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  i18n;
  constructor(tagName, attributes, inputs, outputs, directives, templateAttrs, children, references, variables, isSelfClosing, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    this.tagName = tagName;
    this.attributes = attributes;
    this.inputs = inputs;
    this.outputs = outputs;
    this.directives = directives;
    this.templateAttrs = templateAttrs;
    this.children = children;
    this.references = references;
    this.variables = variables;
    this.isSelfClosing = isSelfClosing;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitTemplate(this);
  }
}
class Content {
  selector;
  attributes;
  children;
  isSelfClosing;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  i18n;
  name = 'ng-content';
  constructor(selector, attributes, children, isSelfClosing, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
    this.selector = selector;
    this.attributes = attributes;
    this.children = children;
    this.isSelfClosing = isSelfClosing;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitContent(this);
  }
}
class Variable {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, value, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor) {
    return visitor.visitVariable(this);
  }
}
class Reference {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, value, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor) {
    return visitor.visitReference(this);
  }
}
class Icu {
  vars;
  placeholders;
  sourceSpan;
  i18n;
  constructor(vars, placeholders, sourceSpan, i18n) {
    this.vars = vars;
    this.placeholders = placeholders;
    this.sourceSpan = sourceSpan;
    this.i18n = i18n;
  }
  visit(visitor) {
    return visitor.visitIcu(this);
  }
}
class HostElement {
  tagNames;
  bindings;
  listeners;
  sourceSpan;
  constructor(tagNames, bindings, listeners, sourceSpan) {
    this.tagNames = tagNames;
    this.bindings = bindings;
    this.listeners = listeners;
    this.sourceSpan = sourceSpan;
    if (tagNames.length === 0) {
      throw new Error('HostElement must have at least one tag name.');
    }
  }
  visit() {
    throw new Error(`HostElement cannot be visited`);
  }
}
class RecursiveVisitor {
  visitElement(element) {
    visitAll(this, element.attributes);
    visitAll(this, element.inputs);
    visitAll(this, element.outputs);
    visitAll(this, element.directives);
    visitAll(this, element.children);
    visitAll(this, element.references);
  }
  visitTemplate(template) {
    visitAll(this, template.attributes);
    visitAll(this, template.inputs);
    visitAll(this, template.outputs);
    visitAll(this, template.directives);
    visitAll(this, template.children);
    visitAll(this, template.references);
    visitAll(this, template.variables);
  }
  visitDeferredBlock(deferred) {
    deferred.visitAll(this);
  }
  visitDeferredBlockPlaceholder(block) {
    visitAll(this, block.children);
  }
  visitDeferredBlockError(block) {
    visitAll(this, block.children);
  }
  visitDeferredBlockLoading(block) {
    visitAll(this, block.children);
  }
  visitSwitchBlock(block) {
    visitAll(this, block.groups);
  }
  visitSwitchBlockCase(block) {}
  visitSwitchBlockCaseGroup(block) {
    visitAll(this, block.cases);
    visitAll(this, block.children);
  }
  visitSwitchExhaustiveCheck(block) {}
  visitForLoopBlock(block) {
    const blockItems = [block.item, ...block.contextVariables, ...block.children];
    block.empty && blockItems.push(block.empty);
    visitAll(this, blockItems);
  }
  visitForLoopBlockEmpty(block) {
    visitAll(this, block.children);
  }
  visitIfBlock(block) {
    visitAll(this, block.branches);
  }
  visitIfBlockBranch(block) {
    visitAll(this, block.children);
    block.expressionAlias?.visit(this);
  }
  visitBoundaryBlock(block) {
    visitAll(this, block.children);
    visitAll(this, block.errorBlocks);
  }
  visitBoundaryErrorBlock(block) {
    const blockItems = [...block.contextVariables, ...block.children];
    visitAll(this, blockItems);
  }
  visitContent(content) {
    visitAll(this, content.children);
  }
  visitComponent(component) {
    visitAll(this, component.attributes);
    visitAll(this, component.inputs);
    visitAll(this, component.outputs);
    visitAll(this, component.directives);
    visitAll(this, component.children);
    visitAll(this, component.references);
  }
  visitDirective(directive) {
    visitAll(this, directive.attributes);
    visitAll(this, directive.inputs);
    visitAll(this, directive.outputs);
    visitAll(this, directive.references);
  }
  visitVariable(variable) {}
  visitReference(reference) {}
  visitTextAttribute(attribute) {}
  visitBoundAttribute(attribute) {}
  visitBoundEvent(attribute) {}
  visitText(text) {}
  visitBoundText(text) {}
  visitIcu(icu) {}
  visitDeferredTrigger(trigger) {}
  visitUnknownBlock(block) {}
  visitLetDeclaration(decl) {}
  visitContentBlock(block) {
    visitAll(this, block.children);
  }
}
function visitAll(visitor, nodes) {
  const result = [];
  if (visitor.visit) {
    for (const node of nodes) {
      visitor.visit(node);
    }
  } else {
    for (const node of nodes) {
      const newNode = node.visit(visitor);
      if (newNode) {
        result.push(newNode);
      }
    }
  }
  return result;
}

class CombinedRecursiveAstVisitor extends RecursiveAstVisitor {
  visit(node) {
    if (node instanceof ASTWithSource) {
      this.visit(node.ast);
    } else {
      node.visit(this);
    }
  }
  visitElement(element) {
    this.visitAllTemplateNodes(element.attributes);
    this.visitAllTemplateNodes(element.inputs);
    this.visitAllTemplateNodes(element.outputs);
    this.visitAllTemplateNodes(element.directives);
    this.visitAllTemplateNodes(element.references);
    this.visitAllTemplateNodes(element.children);
  }
  visitTemplate(template) {
    this.visitAllTemplateNodes(template.attributes);
    this.visitAllTemplateNodes(template.inputs);
    this.visitAllTemplateNodes(template.outputs);
    this.visitAllTemplateNodes(template.directives);
    this.visitAllTemplateNodes(template.templateAttrs);
    this.visitAllTemplateNodes(template.variables);
    this.visitAllTemplateNodes(template.references);
    this.visitAllTemplateNodes(template.children);
  }
  visitContent(content) {
    this.visitAllTemplateNodes(content.children);
  }
  visitContentBlock(block) {
    this.visitAllTemplateNodes(block.children);
  }
  visitBoundAttribute(attribute) {
    this.visit(attribute.value);
  }
  visitBoundEvent(attribute) {
    this.visit(attribute.handler);
  }
  visitBoundText(text) {
    this.visit(text.value);
  }
  visitIcu(icu) {
    Object.keys(icu.vars).forEach(key => this.visit(icu.vars[key]));
    Object.keys(icu.placeholders).forEach(key => this.visit(icu.placeholders[key]));
  }
  visitDeferredBlock(deferred) {
    deferred.visitAll(this);
  }
  visitDeferredTrigger(trigger) {
    if (trigger instanceof BoundDeferredTrigger) {
      this.visit(trigger.value);
    } else if (trigger instanceof ViewportDeferredTrigger && trigger.options !== null) {
      this.visit(trigger.options);
    }
  }
  visitDeferredBlockPlaceholder(block) {
    this.visitAllTemplateNodes(block.children);
  }
  visitDeferredBlockError(block) {
    this.visitAllTemplateNodes(block.children);
  }
  visitDeferredBlockLoading(block) {
    this.visitAllTemplateNodes(block.children);
  }
  visitSwitchBlock(block) {
    this.visit(block.expression);
    this.visitAllTemplateNodes(block.groups);
    block.exhaustiveCheck?.visit(this);
  }
  visitSwitchBlockCase(block) {
    block.expression && this.visit(block.expression);
  }
  visitSwitchBlockCaseGroup(block) {
    this.visitAllTemplateNodes(block.cases);
    this.visitAllTemplateNodes(block.children);
  }
  visitSwitchExhaustiveCheck(block) {}
  visitForLoopBlock(block) {
    block.item.visit(this);
    this.visitAllTemplateNodes(block.contextVariables);
    this.visit(block.expression);
    this.visitAllTemplateNodes(block.children);
    block.empty?.visit(this);
  }
  visitForLoopBlockEmpty(block) {
    this.visitAllTemplateNodes(block.children);
  }
  visitIfBlock(block) {
    this.visitAllTemplateNodes(block.branches);
  }
  visitIfBlockBranch(block) {
    block.expression && this.visit(block.expression);
    block.expressionAlias?.visit(this);
    this.visitAllTemplateNodes(block.children);
  }
  visitBoundaryBlock(block) {
    this.visitAllTemplateNodes(block.children);
    this.visitAllTemplateNodes(block.errorBlocks);
  }
  visitBoundaryErrorBlock(block) {
    this.visitAllTemplateNodes(block.contextVariables);
    block.expression && this.visit(block.expression);
    this.visitAllTemplateNodes(block.children);
  }
  visitLetDeclaration(decl) {
    this.visit(decl.value);
  }
  visitComponent(component) {
    this.visitAllTemplateNodes(component.attributes);
    this.visitAllTemplateNodes(component.inputs);
    this.visitAllTemplateNodes(component.outputs);
    this.visitAllTemplateNodes(component.directives);
    this.visitAllTemplateNodes(component.references);
    this.visitAllTemplateNodes(component.children);
  }
  visitDirective(directive) {
    this.visitAllTemplateNodes(directive.attributes);
    this.visitAllTemplateNodes(directive.inputs);
    this.visitAllTemplateNodes(directive.outputs);
    this.visitAllTemplateNodes(directive.references);
  }
  visitVariable(variable) {}
  visitReference(reference) {}
  visitTextAttribute(attribute) {}
  visitText(text) {}
  visitUnknownBlock(block) {}
  visitAllTemplateNodes(nodes) {
    for (const node of nodes) {
      this.visit(node);
    }
  }
}

var IdentifierKind;
(function (IdentifierKind) {
  IdentifierKind[IdentifierKind["Property"] = 0] = "Property";
  IdentifierKind[IdentifierKind["Method"] = 1] = "Method";
  IdentifierKind[IdentifierKind["Element"] = 2] = "Element";
  IdentifierKind[IdentifierKind["Template"] = 3] = "Template";
  IdentifierKind[IdentifierKind["Attribute"] = 4] = "Attribute";
  IdentifierKind[IdentifierKind["Reference"] = 5] = "Reference";
  IdentifierKind[IdentifierKind["Variable"] = 6] = "Variable";
  IdentifierKind[IdentifierKind["LetDeclaration"] = 7] = "LetDeclaration";
  IdentifierKind[IdentifierKind["Component"] = 8] = "Component";
  IdentifierKind[IdentifierKind["Directive"] = 9] = "Directive";
  IdentifierKind[IdentifierKind["Input"] = 10] = "Input";
  IdentifierKind[IdentifierKind["Output"] = 11] = "Output";
  IdentifierKind[IdentifierKind["Pipe"] = 12] = "Pipe";
})(IdentifierKind || (IdentifierKind = {}));

class IndexingContext {
  components = new Set();
  addComponent(info) {
    this.components.add(info);
  }
}

class IndexerVisitor extends CombinedRecursiveAstVisitor {
  boundTemplate;
  identifiers = new Set();
  errors = [];
  currentAstWithSource = null;
  targetIdentifierCache = new Map();
  directiveHostIdentifierCache = new Map();
  constructor(boundTemplate) {
    super();
    this.boundTemplate = boundTemplate;
  }
  visitElement(element) {
    const elementIdentifier = this.directiveHostToIdentifier(element);
    if (elementIdentifier !== null) {
      this.identifiers.add(elementIdentifier);
    }
    super.visitElement(element);
  }
  visitTemplate(template) {
    const templateIdentifier = this.directiveHostToIdentifier(template);
    if (templateIdentifier !== null) {
      this.identifiers.add(templateIdentifier);
    }
    super.visitTemplate(template);
  }
  visitReference(reference) {
    const referenceIdentifier = this.targetToIdentifier(reference);
    if (referenceIdentifier !== null) {
      this.identifiers.add(referenceIdentifier);
    }
    super.visitReference(reference);
  }
  visitVariable(variable) {
    const variableIdentifier = this.targetToIdentifier(variable);
    if (variableIdentifier !== null) {
      this.identifiers.add(variableIdentifier);
    }
    super.visitVariable(variable);
  }
  visitLetDeclaration(decl) {
    const identifier = this.targetToIdentifier(decl);
    if (identifier !== null) {
      this.identifiers.add(identifier);
    }
    super.visitLetDeclaration(decl);
  }
  visitComponent(component) {
    const identifier = this.directiveHostToIdentifier(component);
    if (identifier !== null) {
      this.identifiers.add(identifier);
    }
    super.visitComponent(component);
  }
  visitDirective(directive) {
    const identifier = this.directiveHostToIdentifier(directive);
    if (identifier !== null) {
      this.identifiers.add(identifier);
    }
    super.visitDirective(directive);
  }
  visitPropertyRead(ast) {
    this.visitIdentifier(ast, IdentifierKind.Property);
    super.visitPropertyRead(ast, null);
  }
  visitPipe(ast) {
    this.visitPipeIdentifier(ast);
    super.visitPipe(ast, null);
  }
  visitPipeIdentifier(ast) {
    if (this.currentAstWithSource === null || this.currentAstWithSource.source === null) {
      return;
    }
    const {
      absoluteOffset,
      source: expressionStr
    } = this.currentAstWithSource;
    const identifierStart = ast.nameSpan.start - absoluteOffset;
    if (!expressionStr.startsWith(ast.name, identifierStart)) {
      this.errors.push(new Error(`Impossible state: "${ast.name}" not found in "${expressionStr}" at location ${identifierStart}`));
      return;
    }
    const absoluteStart = absoluteOffset + identifierStart;
    const span = new AbsoluteSourceSpan(absoluteStart, absoluteStart + ast.name.length);
    const target = this.boundTemplate.getPipe(ast.name);
    const identifier = {
      name: ast.name,
      span,
      kind: IdentifierKind.Pipe,
      target: target ? {
        node: target.ref.node
      } : null
    };
    this.identifiers.add(identifier);
  }
  visitBoundAttribute(attribute) {
    const identifier = this.bindingToIdentifier(attribute, IdentifierKind.Input);
    if (identifier !== null) {
      this.identifiers.add(identifier);
    }
    const previous = this.currentAstWithSource;
    this.currentAstWithSource = {
      source: attribute.valueSpan?.toString() || null,
      absoluteOffset: attribute.valueSpan ? attribute.valueSpan.start.offset : -1
    };
    this.visit(attribute.value instanceof ASTWithSource ? attribute.value.ast : attribute.value);
    this.currentAstWithSource = previous;
  }
  visitBoundEvent(event) {
    const identifier = this.bindingToIdentifier(event, IdentifierKind.Output);
    if (identifier !== null) {
      this.identifiers.add(identifier);
    }
    super.visitBoundEvent(event);
  }
  visitTextAttribute(attribute) {
    const identifier = this.bindingToIdentifier(attribute, IdentifierKind.Input);
    if (identifier !== null) {
      this.identifiers.add(identifier);
    }
    super.visitTextAttribute(attribute);
  }
  bindingToIdentifier(node, kind) {
    if (!this.boundTemplate.getConsumerOfBinding) {
      return null;
    }
    const consumer = this.boundTemplate.getConsumerOfBinding(node);
    if (!consumer || consumer instanceof Element || consumer instanceof Template) {
      return null;
    }
    const keySpan = node.keySpan ?? (node instanceof TextAttribute ? node.sourceSpan : null);
    if (!keySpan) {
      return null;
    }
    const span = new AbsoluteSourceSpan(keySpan.start.offset, keySpan.start.offset + node.name.length);
    return {
      name: node.name,
      span,
      kind,
      target: {
        node: consumer.ref.node
      }
    };
  }
  directiveHostToIdentifier(node) {
    if (this.directiveHostIdentifierCache.has(node)) {
      return this.directiveHostIdentifierCache.get(node);
    }
    let name;
    let kind;
    if (node instanceof Template) {
      name = node.tagName ?? 'ng-template';
      kind = IdentifierKind.Template;
    } else if (node instanceof Element) {
      name = node.name;
      kind = IdentifierKind.Element;
    } else if (node instanceof Component) {
      name = node.fullName;
      kind = IdentifierKind.Component;
    } else {
      name = node.name;
      kind = IdentifierKind.Directive;
    }
    if ((node instanceof Template || node instanceof Element) && name.startsWith(':')) {
      name = name.split(':').pop();
    }
    const sourceSpan = node.startSourceSpan;
    const start = this.getStartLocation(name, sourceSpan);
    if (start === null) {
      return null;
    }
    const absoluteSpan = new AbsoluteSourceSpan(start, start + name.length);
    const attributes = node.attributes.map(({
      name,
      sourceSpan
    }) => {
      return {
        name,
        span: new AbsoluteSourceSpan(sourceSpan.start.offset, sourceSpan.end.offset),
        kind: IdentifierKind.Attribute
      };
    });
    const usedDirectives = this.boundTemplate.getDirectivesOfNode(node) || [];
    const identifier = {
      name,
      span: absoluteSpan,
      kind,
      attributes: new Set(attributes),
      usedDirectives: new Set(usedDirectives.map(dir => {
        return {
          node: dir.ref.node,
          selector: dir.selector
        };
      }))
    };
    this.directiveHostIdentifierCache.set(node, identifier);
    return identifier;
  }
  targetToIdentifier(node) {
    if (this.targetIdentifierCache.has(node)) {
      return this.targetIdentifierCache.get(node);
    }
    const {
      name,
      sourceSpan
    } = node;
    const start = this.getStartLocation(name, sourceSpan);
    if (start === null) {
      return null;
    }
    const span = new AbsoluteSourceSpan(start, start + name.length);
    let identifier;
    if (node instanceof Reference) {
      const refTarget = this.boundTemplate.getReferenceTarget(node);
      let target = null;
      if (refTarget) {
        let node = null;
        let directive = null;
        if (refTarget instanceof Element || refTarget instanceof Template || refTarget instanceof Component || refTarget instanceof Directive) {
          node = this.directiveHostToIdentifier(refTarget);
        } else {
          node = this.directiveHostToIdentifier(refTarget.node);
          directive = refTarget.directive.ref.node;
        }
        if (node === null) {
          return null;
        }
        target = {
          node,
          directive
        };
      }
      identifier = {
        name,
        span,
        kind: IdentifierKind.Reference,
        target
      };
    } else if (node instanceof Variable) {
      identifier = {
        name,
        span,
        kind: IdentifierKind.Variable
      };
    } else {
      identifier = {
        name,
        span,
        kind: IdentifierKind.LetDeclaration
      };
    }
    this.targetIdentifierCache.set(node, identifier);
    return identifier;
  }
  getStartLocation(name, context) {
    const localStr = context.toString();
    if (!localStr.includes(name)) {
      this.errors.push(new Error(`Impossible state: "${name}" not found in "${localStr}"`));
      return null;
    }
    return context.start.offset + localStr.indexOf(name);
  }
  visit(node) {
    if (node instanceof ASTWithSource) {
      const previous = this.currentAstWithSource;
      this.currentAstWithSource = {
        source: node.source,
        absoluteOffset: node.sourceSpan.start
      };
      super.visit(node.ast);
      this.currentAstWithSource = previous;
    } else {
      super.visit(node);
    }
  }
  visitIdentifier(ast, kind) {
    if (this.currentAstWithSource === null || this.currentAstWithSource.source === null) {
      return;
    }
    if (!(ast.receiver instanceof ImplicitReceiver) && !(ast.receiver instanceof ThisReceiver)) {
      return;
    }
    const {
      absoluteOffset,
      source: expressionStr
    } = this.currentAstWithSource;
    let identifierStart = ast.sourceSpan.start - absoluteOffset;
    if (ast instanceof PropertyRead) {
      identifierStart = ast.nameSpan.start - absoluteOffset;
    }
    if (!expressionStr.substring(identifierStart).startsWith(ast.name)) {
      this.errors.push(new Error(`Impossible state: "${ast.name}" not found in "${expressionStr}" at location ${identifierStart}`));
      return;
    }
    const absoluteStart = absoluteOffset + identifierStart;
    const span = new AbsoluteSourceSpan(absoluteStart, absoluteStart + ast.name.length);
    const targetAst = this.boundTemplate.getExpressionTarget(ast);
    const target = targetAst ? this.targetToIdentifier(targetAst) : null;
    const identifier = {
      name: ast.name,
      span,
      kind,
      target
    };
    this.identifiers.add(identifier);
  }
}
function getIndexerTemplateIdentifiers(boundTemplate) {
  const visitor = new IndexerVisitor(boundTemplate);
  const template = boundTemplate.getTemplateAst();
  if (template !== undefined) {
    visitAll(visitor, template);
  }
  return {
    identifiers: visitor.identifiers,
    errors: visitor.errors
  };
}

function generateIndexerAnalysis(context, adapter) {
  const analysis = new Map();
  context.components.forEach(({
    declaration,
    selector,
    boundTemplate,
    templateMeta
  }) => {
    const name = adapter.getName(declaration);
    const fileName = adapter.getFileName(declaration);
    let templateFileUrl;
    if (templateMeta.isInline) {
      templateFileUrl = fileName;
    } else {
      templateFileUrl = templateMeta.file.url;
    }
    const {
      identifiers,
      errors
    } = getIndexerTemplateIdentifiers(boundTemplate);
    analysis.set(declaration, {
      name,
      selector,
      fileUrl: fileName,
      template: {
        identifiers,
        fileUrl: templateFileUrl
      },
      errors
    });
  });
  return analysis;
}

export { AST, ASTWithName, ASTWithSource, AbsoluteSourceSpan, ArrowFunction, ArrowFunctionIdentifierParameter, Binary, BindingPipe, BindingPipeType, BindingType, BlockNode, BoundAttribute, BoundDeferredTrigger, BoundElementProperty, BoundEvent, BoundText, BoundaryBlock, BoundaryErrorBlock, Call, Chain, CombinedRecursiveAstVisitor, Comment, Component, Conditional, Content, ContentBlock, DeferredBlock, DeferredBlockError, DeferredBlockLoading, DeferredBlockPlaceholder, DeferredTrigger, Directive, Element, EmptyExpr, ExpressionBinding, ForLoopBlock, ForLoopBlockEmpty, HostElement, HoverDeferredTrigger, Icu, IdentifierKind, IdleDeferredTrigger, IfBlock, IfBlockBranch, ImmediateDeferredTrigger, ImplicitReceiver, IndexerVisitor, IndexingContext, InteractionDeferredTrigger, Interpolation, KeyedRead, LetDeclaration, LiteralArray, LiteralMap, LiteralPrimitive, NeverDeferredTrigger, NonNullAssert, ParenthesizedExpression, ParseSpan, ParsedEvent, ParsedEventType, ParsedProperty, ParsedPropertyType, ParsedVariable, PrefixNot, PropertyRead, RecursiveAstVisitor, RecursiveVisitor, Reference, RegularExpressionLiteral, SafeCall, SafeKeyedRead, SafePropertyRead, SpreadElement, SwitchBlock, SwitchBlockCase, SwitchBlockCaseGroup, SwitchExhaustiveCheck, TaggedTemplateLiteral, Template, TemplateLiteral, TemplateLiteralElement, Text, TextAttribute, ThisReceiver, TimerDeferredTrigger, TypeofExpression, Unary, UnknownBlock, Variable, VariableBinding, ViewportDeferredTrigger, VoidExpression, generateIndexerAnalysis, getIndexerTemplateIdentifiers, unwrapWriteTarget, visitAll };
//# sourceMappingURL=_index-chunk.mjs.map
