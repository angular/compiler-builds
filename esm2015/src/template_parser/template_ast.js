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
 * An Abstract Syntax Tree node representing part of a parsed Angular template.
 * @record
 */
export function TemplateAst() { }
function TemplateAst_tsickle_Closure_declarations() {
    /**
     * The source span from which this node was parsed.
     * @type {?}
     */
    TemplateAst.prototype.sourceSpan;
    /**
     * Visit this node and possibly transform it.
     * @type {?}
     */
    TemplateAst.prototype.visit;
}
/**
 * A segment of text within the template.
 */
export class TextAst {
    /**
     * @param {?} value
     * @param {?} ngContentIndex
     * @param {?} sourceSpan
     */
    constructor(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitText(this, context); }
}
function TextAst_tsickle_Closure_declarations() {
    /** @type {?} */
    TextAst.prototype.value;
    /** @type {?} */
    TextAst.prototype.ngContentIndex;
    /** @type {?} */
    TextAst.prototype.sourceSpan;
}
/**
 * A bound expression within the text of a template.
 */
export class BoundTextAst {
    /**
     * @param {?} value
     * @param {?} ngContentIndex
     * @param {?} sourceSpan
     */
    constructor(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitBoundText(this, context);
    }
}
function BoundTextAst_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundTextAst.prototype.value;
    /** @type {?} */
    BoundTextAst.prototype.ngContentIndex;
    /** @type {?} */
    BoundTextAst.prototype.sourceSpan;
}
/**
 * A plain attribute on an element.
 */
export class AttrAst {
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
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitAttr(this, context); }
}
function AttrAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AttrAst.prototype.name;
    /** @type {?} */
    AttrAst.prototype.value;
    /** @type {?} */
    AttrAst.prototype.sourceSpan;
}
/** @enum {number} */
const PropertyBindingType = {
    // A normal binding to a property (e.g. `[property]="expression"`).
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
export { PropertyBindingType };
PropertyBindingType[PropertyBindingType.Property] = "Property";
PropertyBindingType[PropertyBindingType.Attribute] = "Attribute";
PropertyBindingType[PropertyBindingType.Class] = "Class";
PropertyBindingType[PropertyBindingType.Style] = "Style";
PropertyBindingType[PropertyBindingType.Animation] = "Animation";
const /** @type {?} */ BoundPropertyMapping = {
    [4 /* Animation */]: PropertyBindingType.Animation,
    [1 /* Attribute */]: PropertyBindingType.Attribute,
    [2 /* Class */]: PropertyBindingType.Class,
    [0 /* Property */]: PropertyBindingType.Property,
    [3 /* Style */]: PropertyBindingType.Style,
};
/**
 * A binding for an element property (e.g. `[property]="expression"`) or an animation trigger (e.g.
 * `[\@trigger]="stateExp"`)
 */
export class BoundElementPropertyAst {
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
        this.isAnimation = this.type === PropertyBindingType.Animation;
    }
    /**
     * @param {?} prop
     * @return {?}
     */
    static fromBoundProperty(prop) {
        const /** @type {?} */ type = BoundPropertyMapping[prop.type];
        return new BoundElementPropertyAst(prop.name, type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan);
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitElementProperty(this, context);
    }
}
function BoundElementPropertyAst_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundElementPropertyAst.prototype.isAnimation;
    /** @type {?} */
    BoundElementPropertyAst.prototype.name;
    /** @type {?} */
    BoundElementPropertyAst.prototype.type;
    /** @type {?} */
    BoundElementPropertyAst.prototype.securityContext;
    /** @type {?} */
    BoundElementPropertyAst.prototype.value;
    /** @type {?} */
    BoundElementPropertyAst.prototype.unit;
    /** @type {?} */
    BoundElementPropertyAst.prototype.sourceSpan;
}
/**
 * A binding for an element event (e.g. `(event)="handler()"`) or an animation trigger event (e.g.
 * `(\@trigger.phase)="callback($event)"`).
 */
export class BoundEventAst {
    /**
     * @param {?} name
     * @param {?} target
     * @param {?} phase
     * @param {?} handler
     * @param {?} sourceSpan
     */
    constructor(name, target, phase, handler, sourceSpan) {
        this.name = name;
        this.target = target;
        this.phase = phase;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
        this.fullName = BoundEventAst.calcFullName(this.name, this.target, this.phase);
        this.isAnimation = !!this.phase;
    }
    /**
     * @param {?} name
     * @param {?} target
     * @param {?} phase
     * @return {?}
     */
    static calcFullName(name, target, phase) {
        if (target) {
            return `${target}:${name}`;
        }
        if (phase) {
            return `@${name}.${phase}`;
        }
        return name;
    }
    /**
     * @param {?} event
     * @return {?}
     */
    static fromParsedEvent(event) {
        const /** @type {?} */ target = event.type === 0 /* Regular */ ? event.targetOrPhase : null;
        const /** @type {?} */ phase = event.type === 1 /* Animation */ ? event.targetOrPhase : null;
        return new BoundEventAst(event.name, target, phase, event.handler, event.sourceSpan);
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitEvent(this, context);
    }
}
function BoundEventAst_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundEventAst.prototype.fullName;
    /** @type {?} */
    BoundEventAst.prototype.isAnimation;
    /** @type {?} */
    BoundEventAst.prototype.name;
    /** @type {?} */
    BoundEventAst.prototype.target;
    /** @type {?} */
    BoundEventAst.prototype.phase;
    /** @type {?} */
    BoundEventAst.prototype.handler;
    /** @type {?} */
    BoundEventAst.prototype.sourceSpan;
}
/**
 * A reference declaration on an element (e.g. `let someName="expression"`).
 */
export class ReferenceAst {
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} originalValue
     * @param {?} sourceSpan
     */
    constructor(name, value, originalValue, sourceSpan) {
        this.name = name;
        this.value = value;
        this.originalValue = originalValue;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitReference(this, context);
    }
}
function ReferenceAst_tsickle_Closure_declarations() {
    /** @type {?} */
    ReferenceAst.prototype.name;
    /** @type {?} */
    ReferenceAst.prototype.value;
    /** @type {?} */
    ReferenceAst.prototype.originalValue;
    /** @type {?} */
    ReferenceAst.prototype.sourceSpan;
}
/**
 * A variable declaration on a <ng-template> (e.g. `var-someName="someLocalName"`).
 */
export class VariableAst {
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
    /**
     * @param {?} v
     * @return {?}
     */
    static fromParsedVariable(v) {
        return new VariableAst(v.name, v.value, v.sourceSpan);
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitVariable(this, context);
    }
}
function VariableAst_tsickle_Closure_declarations() {
    /** @type {?} */
    VariableAst.prototype.name;
    /** @type {?} */
    VariableAst.prototype.value;
    /** @type {?} */
    VariableAst.prototype.sourceSpan;
}
/**
 * An element declaration in a template.
 */
export class ElementAst {
    /**
     * @param {?} name
     * @param {?} attrs
     * @param {?} inputs
     * @param {?} outputs
     * @param {?} references
     * @param {?} directives
     * @param {?} providers
     * @param {?} hasViewContainer
     * @param {?} queryMatches
     * @param {?} children
     * @param {?} ngContentIndex
     * @param {?} sourceSpan
     * @param {?} endSourceSpan
     */
    constructor(name, attrs, inputs, outputs, references, directives, providers, hasViewContainer, queryMatches, children, ngContentIndex, sourceSpan, endSourceSpan) {
        this.name = name;
        this.attrs = attrs;
        this.inputs = inputs;
        this.outputs = outputs;
        this.references = references;
        this.directives = directives;
        this.providers = providers;
        this.hasViewContainer = hasViewContainer;
        this.queryMatches = queryMatches;
        this.children = children;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitElement(this, context);
    }
}
function ElementAst_tsickle_Closure_declarations() {
    /** @type {?} */
    ElementAst.prototype.name;
    /** @type {?} */
    ElementAst.prototype.attrs;
    /** @type {?} */
    ElementAst.prototype.inputs;
    /** @type {?} */
    ElementAst.prototype.outputs;
    /** @type {?} */
    ElementAst.prototype.references;
    /** @type {?} */
    ElementAst.prototype.directives;
    /** @type {?} */
    ElementAst.prototype.providers;
    /** @type {?} */
    ElementAst.prototype.hasViewContainer;
    /** @type {?} */
    ElementAst.prototype.queryMatches;
    /** @type {?} */
    ElementAst.prototype.children;
    /** @type {?} */
    ElementAst.prototype.ngContentIndex;
    /** @type {?} */
    ElementAst.prototype.sourceSpan;
    /** @type {?} */
    ElementAst.prototype.endSourceSpan;
}
/**
 * A `<ng-template>` element included in an Angular template.
 */
export class EmbeddedTemplateAst {
    /**
     * @param {?} attrs
     * @param {?} outputs
     * @param {?} references
     * @param {?} variables
     * @param {?} directives
     * @param {?} providers
     * @param {?} hasViewContainer
     * @param {?} queryMatches
     * @param {?} children
     * @param {?} ngContentIndex
     * @param {?} sourceSpan
     */
    constructor(attrs, outputs, references, variables, directives, providers, hasViewContainer, queryMatches, children, ngContentIndex, sourceSpan) {
        this.attrs = attrs;
        this.outputs = outputs;
        this.references = references;
        this.variables = variables;
        this.directives = directives;
        this.providers = providers;
        this.hasViewContainer = hasViewContainer;
        this.queryMatches = queryMatches;
        this.children = children;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitEmbeddedTemplate(this, context);
    }
}
function EmbeddedTemplateAst_tsickle_Closure_declarations() {
    /** @type {?} */
    EmbeddedTemplateAst.prototype.attrs;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.outputs;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.references;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.variables;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.directives;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.providers;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.hasViewContainer;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.queryMatches;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.children;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.ngContentIndex;
    /** @type {?} */
    EmbeddedTemplateAst.prototype.sourceSpan;
}
/**
 * A directive property with a bound value (e.g. `*ngIf="condition").
 */
export class BoundDirectivePropertyAst {
    /**
     * @param {?} directiveName
     * @param {?} templateName
     * @param {?} value
     * @param {?} sourceSpan
     */
    constructor(directiveName, templateName, value, sourceSpan) {
        this.directiveName = directiveName;
        this.templateName = templateName;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitDirectiveProperty(this, context);
    }
}
function BoundDirectivePropertyAst_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundDirectivePropertyAst.prototype.directiveName;
    /** @type {?} */
    BoundDirectivePropertyAst.prototype.templateName;
    /** @type {?} */
    BoundDirectivePropertyAst.prototype.value;
    /** @type {?} */
    BoundDirectivePropertyAst.prototype.sourceSpan;
}
/**
 * A directive declared on an element.
 */
export class DirectiveAst {
    /**
     * @param {?} directive
     * @param {?} inputs
     * @param {?} hostProperties
     * @param {?} hostEvents
     * @param {?} contentQueryStartId
     * @param {?} sourceSpan
     */
    constructor(directive, inputs, hostProperties, hostEvents, contentQueryStartId, sourceSpan) {
        this.directive = directive;
        this.inputs = inputs;
        this.hostProperties = hostProperties;
        this.hostEvents = hostEvents;
        this.contentQueryStartId = contentQueryStartId;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitDirective(this, context);
    }
}
function DirectiveAst_tsickle_Closure_declarations() {
    /** @type {?} */
    DirectiveAst.prototype.directive;
    /** @type {?} */
    DirectiveAst.prototype.inputs;
    /** @type {?} */
    DirectiveAst.prototype.hostProperties;
    /** @type {?} */
    DirectiveAst.prototype.hostEvents;
    /** @type {?} */
    DirectiveAst.prototype.contentQueryStartId;
    /** @type {?} */
    DirectiveAst.prototype.sourceSpan;
}
/**
 * A provider declared on an element
 */
export class ProviderAst {
    /**
     * @param {?} token
     * @param {?} multiProvider
     * @param {?} eager
     * @param {?} providers
     * @param {?} providerType
     * @param {?} lifecycleHooks
     * @param {?} sourceSpan
     * @param {?} isModule
     */
    constructor(token, multiProvider, eager, providers, providerType, lifecycleHooks, sourceSpan, isModule) {
        this.token = token;
        this.multiProvider = multiProvider;
        this.eager = eager;
        this.providers = providers;
        this.providerType = providerType;
        this.lifecycleHooks = lifecycleHooks;
        this.sourceSpan = sourceSpan;
        this.isModule = isModule;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        // No visit method in the visitor for now...
        return null;
    }
}
function ProviderAst_tsickle_Closure_declarations() {
    /** @type {?} */
    ProviderAst.prototype.token;
    /** @type {?} */
    ProviderAst.prototype.multiProvider;
    /** @type {?} */
    ProviderAst.prototype.eager;
    /** @type {?} */
    ProviderAst.prototype.providers;
    /** @type {?} */
    ProviderAst.prototype.providerType;
    /** @type {?} */
    ProviderAst.prototype.lifecycleHooks;
    /** @type {?} */
    ProviderAst.prototype.sourceSpan;
    /** @type {?} */
    ProviderAst.prototype.isModule;
}
/** @enum {number} */
const ProviderAstType = {
    PublicService: 0,
    PrivateService: 1,
    Component: 2,
    Directive: 3,
    Builtin: 4,
};
export { ProviderAstType };
ProviderAstType[ProviderAstType.PublicService] = "PublicService";
ProviderAstType[ProviderAstType.PrivateService] = "PrivateService";
ProviderAstType[ProviderAstType.Component] = "Component";
ProviderAstType[ProviderAstType.Directive] = "Directive";
ProviderAstType[ProviderAstType.Builtin] = "Builtin";
/**
 * Position where content is to be projected (instance of `<ng-content>` in a template).
 */
export class NgContentAst {
    /**
     * @param {?} index
     * @param {?} ngContentIndex
     * @param {?} sourceSpan
     */
    constructor(index, ngContentIndex, sourceSpan) {
        this.index = index;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitNgContent(this, context);
    }
}
function NgContentAst_tsickle_Closure_declarations() {
    /** @type {?} */
    NgContentAst.prototype.index;
    /** @type {?} */
    NgContentAst.prototype.ngContentIndex;
    /** @type {?} */
    NgContentAst.prototype.sourceSpan;
}
/**
 * @record
 */
export function QueryMatch() { }
function QueryMatch_tsickle_Closure_declarations() {
    /** @type {?} */
    QueryMatch.prototype.queryId;
    /** @type {?} */
    QueryMatch.prototype.value;
}
/**
 * A visitor for {\@link TemplateAst} trees that will process each node.
 * @record
 */
export function TemplateAstVisitor() { }
function TemplateAstVisitor_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    TemplateAstVisitor.prototype.visit;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitNgContent;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitEmbeddedTemplate;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitElement;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitReference;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitVariable;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitEvent;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitElementProperty;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitAttr;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitBoundText;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitText;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitDirective;
    /** @type {?} */
    TemplateAstVisitor.prototype.visitDirectiveProperty;
}
/**
 * A visitor that accepts each node but doesn't do anything. It is intended to be used
 * as the base class for a visitor that is only interested in a subset of the node types.
 */
export class NullTemplateVisitor {
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNgContent(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitEmbeddedTemplate(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElement(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReference(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitVariable(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitEvent(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElementProperty(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAttr(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBoundText(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitText(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitDirective(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitDirectiveProperty(ast, context) { }
}
/**
 * Base class that can be used to build a visitor that visits each node
 * in an template ast recursively.
 */
export class RecursiveTemplateAstVisitor extends NullTemplateVisitor {
    constructor() { super(); }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitEmbeddedTemplate(ast, context) {
        return this.visitChildren(context, visit => {
            visit(ast.attrs);
            visit(ast.references);
            visit(ast.variables);
            visit(ast.directives);
            visit(ast.providers);
            visit(ast.children);
        });
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElement(ast, context) {
        return this.visitChildren(context, visit => {
            visit(ast.attrs);
            visit(ast.inputs);
            visit(ast.outputs);
            visit(ast.references);
            visit(ast.directives);
            visit(ast.providers);
            visit(ast.children);
        });
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitDirective(ast, context) {
        return this.visitChildren(context, visit => {
            visit(ast.inputs);
            visit(ast.hostProperties);
            visit(ast.hostEvents);
        });
    }
    /**
     * @template T
     * @param {?} context
     * @param {?} cb
     * @return {?}
     */
    visitChildren(context, cb) {
        let /** @type {?} */ results = [];
        let /** @type {?} */ t = this;
        /**
         * @template T
         * @param {?} children
         * @return {?}
         */
        function visit(children) {
            if (children && children.length)
                results.push(templateVisitAll(t, children, context));
        }
        cb(visit);
        return [].concat.apply([], results);
    }
}
/**
 * Visit every node in a list of {\@link TemplateAst}s with the given {\@link TemplateAstVisitor}.
 * @param {?} visitor
 * @param {?} asts
 * @param {?=} context
 * @return {?}
 */
export function templateVisitAll(visitor, asts, context = null) {
    const /** @type {?} */ result = [];
    const /** @type {?} */ visit = visitor.visit ?
        (ast) => /** @type {?} */ ((visitor.visit))(ast, context) || ast.visit(visitor, context) :
        (ast) => ast.visit(visitor, context);
    asts.forEach(ast => {
        const /** @type {?} */ astResult = visit(ast);
        if (astResult) {
            result.push(astResult);
        }
    });
    return result;
}
//# sourceMappingURL=template_ast.js.map