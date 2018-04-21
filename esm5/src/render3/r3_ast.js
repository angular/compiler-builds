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
/**
 * @record
 */
export function Node() { }
function Node_tsickle_Closure_declarations() {
    /** @type {?} */
    Node.prototype.sourceSpan;
    /** @type {?} */
    Node.prototype.visit;
}
var Text = /** @class */ (function () {
    function Text(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    Text.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitText(this); };
    return Text;
}());
export { Text };
function Text_tsickle_Closure_declarations() {
    /** @type {?} */
    Text.prototype.value;
    /** @type {?} */
    Text.prototype.sourceSpan;
}
var BoundText = /** @class */ (function () {
    function BoundText(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    BoundText.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitBoundText(this); };
    return BoundText;
}());
export { BoundText };
function BoundText_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundText.prototype.value;
    /** @type {?} */
    BoundText.prototype.sourceSpan;
}
var TextAttribute = /** @class */ (function () {
    function TextAttribute(name, value, sourceSpan, valueSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    TextAttribute.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitAttribute(this); };
    return TextAttribute;
}());
export { TextAttribute };
function TextAttribute_tsickle_Closure_declarations() {
    /** @type {?} */
    TextAttribute.prototype.name;
    /** @type {?} */
    TextAttribute.prototype.value;
    /** @type {?} */
    TextAttribute.prototype.sourceSpan;
    /** @type {?} */
    TextAttribute.prototype.valueSpan;
}
var BoundAttribute = /** @class */ (function () {
    function BoundAttribute(name, type, securityContext, value, unit, sourceSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} prop
     * @return {?}
     */
    BoundAttribute.fromBoundElementProperty = /**
     * @param {?} prop
     * @return {?}
     */
    function (prop) {
        return new BoundAttribute(prop.name, prop.type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan);
    };
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    BoundAttribute.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitBoundAttribute(this); };
    return BoundAttribute;
}());
export { BoundAttribute };
function BoundAttribute_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundAttribute.prototype.name;
    /** @type {?} */
    BoundAttribute.prototype.type;
    /** @type {?} */
    BoundAttribute.prototype.securityContext;
    /** @type {?} */
    BoundAttribute.prototype.value;
    /** @type {?} */
    BoundAttribute.prototype.unit;
    /** @type {?} */
    BoundAttribute.prototype.sourceSpan;
}
var BoundEvent = /** @class */ (function () {
    function BoundEvent(name, handler, target, phase, sourceSpan) {
        this.name = name;
        this.handler = handler;
        this.target = target;
        this.phase = phase;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} event
     * @return {?}
     */
    BoundEvent.fromParsedEvent = /**
     * @param {?} event
     * @return {?}
     */
    function (event) {
        var /** @type {?} */ target = event.type === 0 /* Regular */ ? event.targetOrPhase : null;
        var /** @type {?} */ phase = event.type === 1 /* Animation */ ? event.targetOrPhase : null;
        return new BoundEvent(event.name, event.handler, target, phase, event.sourceSpan);
    };
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    BoundEvent.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitBoundEvent(this); };
    return BoundEvent;
}());
export { BoundEvent };
function BoundEvent_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundEvent.prototype.name;
    /** @type {?} */
    BoundEvent.prototype.handler;
    /** @type {?} */
    BoundEvent.prototype.target;
    /** @type {?} */
    BoundEvent.prototype.phase;
    /** @type {?} */
    BoundEvent.prototype.sourceSpan;
}
var Element = /** @class */ (function () {
    function Element(name, attributes, inputs, outputs, children, references, sourceSpan, startSourceSpan, endSourceSpan) {
        this.name = name;
        this.attributes = attributes;
        this.inputs = inputs;
        this.outputs = outputs;
        this.children = children;
        this.references = references;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    Element.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitElement(this); };
    return Element;
}());
export { Element };
function Element_tsickle_Closure_declarations() {
    /** @type {?} */
    Element.prototype.name;
    /** @type {?} */
    Element.prototype.attributes;
    /** @type {?} */
    Element.prototype.inputs;
    /** @type {?} */
    Element.prototype.outputs;
    /** @type {?} */
    Element.prototype.children;
    /** @type {?} */
    Element.prototype.references;
    /** @type {?} */
    Element.prototype.sourceSpan;
    /** @type {?} */
    Element.prototype.startSourceSpan;
    /** @type {?} */
    Element.prototype.endSourceSpan;
}
var Template = /** @class */ (function () {
    function Template(attributes, inputs, children, references, variables, sourceSpan, startSourceSpan, endSourceSpan) {
        this.attributes = attributes;
        this.inputs = inputs;
        this.children = children;
        this.references = references;
        this.variables = variables;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    Template.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitTemplate(this); };
    return Template;
}());
export { Template };
function Template_tsickle_Closure_declarations() {
    /** @type {?} */
    Template.prototype.attributes;
    /** @type {?} */
    Template.prototype.inputs;
    /** @type {?} */
    Template.prototype.children;
    /** @type {?} */
    Template.prototype.references;
    /** @type {?} */
    Template.prototype.variables;
    /** @type {?} */
    Template.prototype.sourceSpan;
    /** @type {?} */
    Template.prototype.startSourceSpan;
    /** @type {?} */
    Template.prototype.endSourceSpan;
}
var Content = /** @class */ (function () {
    function Content(selectorIndex, attributes, sourceSpan) {
        this.selectorIndex = selectorIndex;
        this.attributes = attributes;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    Content.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitContent(this); };
    return Content;
}());
export { Content };
function Content_tsickle_Closure_declarations() {
    /** @type {?} */
    Content.prototype.selectorIndex;
    /** @type {?} */
    Content.prototype.attributes;
    /** @type {?} */
    Content.prototype.sourceSpan;
}
var Variable = /** @class */ (function () {
    function Variable(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    Variable.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitVariable(this); };
    return Variable;
}());
export { Variable };
function Variable_tsickle_Closure_declarations() {
    /** @type {?} */
    Variable.prototype.name;
    /** @type {?} */
    Variable.prototype.value;
    /** @type {?} */
    Variable.prototype.sourceSpan;
}
var Reference = /** @class */ (function () {
    function Reference(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    Reference.prototype.visit = /**
     * @template Result
     * @param {?} visitor
     * @return {?}
     */
    function (visitor) { return visitor.visitReference(this); };
    return Reference;
}());
export { Reference };
function Reference_tsickle_Closure_declarations() {
    /** @type {?} */
    Reference.prototype.name;
    /** @type {?} */
    Reference.prototype.value;
    /** @type {?} */
    Reference.prototype.sourceSpan;
}
/**
 * @record
 * @template Result
 */
export function Visitor() { }
function Visitor_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Visitor.prototype.visit;
    /** @type {?} */
    Visitor.prototype.visitElement;
    /** @type {?} */
    Visitor.prototype.visitTemplate;
    /** @type {?} */
    Visitor.prototype.visitContent;
    /** @type {?} */
    Visitor.prototype.visitVariable;
    /** @type {?} */
    Visitor.prototype.visitReference;
    /** @type {?} */
    Visitor.prototype.visitAttribute;
    /** @type {?} */
    Visitor.prototype.visitBoundAttribute;
    /** @type {?} */
    Visitor.prototype.visitBoundEvent;
    /** @type {?} */
    Visitor.prototype.visitText;
    /** @type {?} */
    Visitor.prototype.visitBoundText;
}
var NullVisitor = /** @class */ (function () {
    function NullVisitor() {
    }
    /**
     * @param {?} element
     * @return {?}
     */
    NullVisitor.prototype.visitElement = /**
     * @param {?} element
     * @return {?}
     */
    function (element) { };
    /**
     * @param {?} template
     * @return {?}
     */
    NullVisitor.prototype.visitTemplate = /**
     * @param {?} template
     * @return {?}
     */
    function (template) { };
    /**
     * @param {?} content
     * @return {?}
     */
    NullVisitor.prototype.visitContent = /**
     * @param {?} content
     * @return {?}
     */
    function (content) { };
    /**
     * @param {?} variable
     * @return {?}
     */
    NullVisitor.prototype.visitVariable = /**
     * @param {?} variable
     * @return {?}
     */
    function (variable) { };
    /**
     * @param {?} reference
     * @return {?}
     */
    NullVisitor.prototype.visitReference = /**
     * @param {?} reference
     * @return {?}
     */
    function (reference) { };
    /**
     * @param {?} attribute
     * @return {?}
     */
    NullVisitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { };
    /**
     * @param {?} attribute
     * @return {?}
     */
    NullVisitor.prototype.visitBoundAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { };
    /**
     * @param {?} attribute
     * @return {?}
     */
    NullVisitor.prototype.visitBoundEvent = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { };
    /**
     * @param {?} text
     * @return {?}
     */
    NullVisitor.prototype.visitText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { };
    /**
     * @param {?} text
     * @return {?}
     */
    NullVisitor.prototype.visitBoundText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { };
    return NullVisitor;
}());
export { NullVisitor };
var RecursiveVisitor = /** @class */ (function () {
    function RecursiveVisitor() {
    }
    /**
     * @param {?} element
     * @return {?}
     */
    RecursiveVisitor.prototype.visitElement = /**
     * @param {?} element
     * @return {?}
     */
    function (element) {
        visitAll(this, element.attributes);
        visitAll(this, element.children);
        visitAll(this, element.references);
    };
    /**
     * @param {?} template
     * @return {?}
     */
    RecursiveVisitor.prototype.visitTemplate = /**
     * @param {?} template
     * @return {?}
     */
    function (template) {
        visitAll(this, template.attributes);
        visitAll(this, template.children);
        visitAll(this, template.references);
        visitAll(this, template.variables);
    };
    /**
     * @param {?} content
     * @return {?}
     */
    RecursiveVisitor.prototype.visitContent = /**
     * @param {?} content
     * @return {?}
     */
    function (content) { };
    /**
     * @param {?} variable
     * @return {?}
     */
    RecursiveVisitor.prototype.visitVariable = /**
     * @param {?} variable
     * @return {?}
     */
    function (variable) { };
    /**
     * @param {?} reference
     * @return {?}
     */
    RecursiveVisitor.prototype.visitReference = /**
     * @param {?} reference
     * @return {?}
     */
    function (reference) { };
    /**
     * @param {?} attribute
     * @return {?}
     */
    RecursiveVisitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { };
    /**
     * @param {?} attribute
     * @return {?}
     */
    RecursiveVisitor.prototype.visitBoundAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { };
    /**
     * @param {?} attribute
     * @return {?}
     */
    RecursiveVisitor.prototype.visitBoundEvent = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { };
    /**
     * @param {?} text
     * @return {?}
     */
    RecursiveVisitor.prototype.visitText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { };
    /**
     * @param {?} text
     * @return {?}
     */
    RecursiveVisitor.prototype.visitBoundText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { };
    return RecursiveVisitor;
}());
export { RecursiveVisitor };
var TransformVisitor = /** @class */ (function () {
    function TransformVisitor() {
    }
    /**
     * @param {?} element
     * @return {?}
     */
    TransformVisitor.prototype.visitElement = /**
     * @param {?} element
     * @return {?}
     */
    function (element) {
        var /** @type {?} */ newAttributes = transformAll(this, element.attributes);
        var /** @type {?} */ newInputs = transformAll(this, element.inputs);
        var /** @type {?} */ newOutputs = transformAll(this, element.outputs);
        var /** @type {?} */ newChildren = transformAll(this, element.children);
        var /** @type {?} */ newReferences = transformAll(this, element.references);
        if (newAttributes != element.attributes || newInputs != element.inputs ||
            newOutputs != element.outputs || newChildren != element.children ||
            newReferences != element.references) {
            return new Element(element.name, newAttributes, newInputs, newOutputs, newChildren, newReferences, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        return element;
    };
    /**
     * @param {?} template
     * @return {?}
     */
    TransformVisitor.prototype.visitTemplate = /**
     * @param {?} template
     * @return {?}
     */
    function (template) {
        var /** @type {?} */ newAttributes = transformAll(this, template.attributes);
        var /** @type {?} */ newInputs = transformAll(this, template.inputs);
        var /** @type {?} */ newChildren = transformAll(this, template.children);
        var /** @type {?} */ newReferences = transformAll(this, template.references);
        var /** @type {?} */ newVariables = transformAll(this, template.variables);
        if (newAttributes != template.attributes || newInputs != template.inputs ||
            newChildren != template.children || newVariables != template.variables ||
            newReferences != template.references) {
            return new Template(newAttributes, newInputs, newChildren, newReferences, newVariables, template.sourceSpan, template.startSourceSpan, template.endSourceSpan);
        }
        return template;
    };
    /**
     * @param {?} content
     * @return {?}
     */
    TransformVisitor.prototype.visitContent = /**
     * @param {?} content
     * @return {?}
     */
    function (content) { return content; };
    /**
     * @param {?} variable
     * @return {?}
     */
    TransformVisitor.prototype.visitVariable = /**
     * @param {?} variable
     * @return {?}
     */
    function (variable) { return variable; };
    /**
     * @param {?} reference
     * @return {?}
     */
    TransformVisitor.prototype.visitReference = /**
     * @param {?} reference
     * @return {?}
     */
    function (reference) { return reference; };
    /**
     * @param {?} attribute
     * @return {?}
     */
    TransformVisitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { return attribute; };
    /**
     * @param {?} attribute
     * @return {?}
     */
    TransformVisitor.prototype.visitBoundAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { return attribute; };
    /**
     * @param {?} attribute
     * @return {?}
     */
    TransformVisitor.prototype.visitBoundEvent = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) { return attribute; };
    /**
     * @param {?} text
     * @return {?}
     */
    TransformVisitor.prototype.visitText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { return text; };
    /**
     * @param {?} text
     * @return {?}
     */
    TransformVisitor.prototype.visitBoundText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { return text; };
    return TransformVisitor;
}());
export { TransformVisitor };
/**
 * @template Result
 * @param {?} visitor
 * @param {?} nodes
 * @return {?}
 */
export function visitAll(visitor, nodes) {
    var /** @type {?} */ result = [];
    if (visitor.visit) {
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var node = nodes_1[_i];
            var /** @type {?} */ newNode = visitor.visit(node) || node.visit(visitor);
        }
    }
    else {
        for (var _a = 0, nodes_2 = nodes; _a < nodes_2.length; _a++) {
            var node = nodes_2[_a];
            var /** @type {?} */ newNode = node.visit(visitor);
            if (newNode) {
                result.push(newNode);
            }
        }
    }
    return result;
}
/**
 * @template Result
 * @param {?} visitor
 * @param {?} nodes
 * @return {?}
 */
export function transformAll(visitor, nodes) {
    var /** @type {?} */ result = [];
    var /** @type {?} */ changed = false;
    for (var _i = 0, nodes_3 = nodes; _i < nodes_3.length; _i++) {
        var node = nodes_3[_i];
        var /** @type {?} */ newNode = node.visit(visitor);
        if (newNode) {
            result.push(/** @type {?} */ (newNode));
        }
        changed = changed || newNode != node;
    }
    return changed ? result : nodes;
}
//# sourceMappingURL=r3_ast.js.map