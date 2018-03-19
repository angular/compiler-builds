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
export class Message {
    /**
     * @param {?} nodes message AST
     * @param {?} placeholders maps placeholder names to static content
     * @param {?} placeholderToMessage maps placeholder names to messages (used for nested ICU messages)
     * @param {?} meaning
     * @param {?} description
     * @param {?} id
     */
    constructor(nodes, placeholders, placeholderToMessage, meaning, description, id) {
        this.nodes = nodes;
        this.placeholders = placeholders;
        this.placeholderToMessage = placeholderToMessage;
        this.meaning = meaning;
        this.description = description;
        this.id = id;
        if (nodes.length) {
            this.sources = [{
                    filePath: nodes[0].sourceSpan.start.file.url,
                    startLine: nodes[0].sourceSpan.start.line + 1,
                    startCol: nodes[0].sourceSpan.start.col + 1,
                    endLine: nodes[nodes.length - 1].sourceSpan.end.line + 1,
                    endCol: nodes[0].sourceSpan.start.col + 1
                }];
        }
        else {
            this.sources = [];
        }
    }
}
function Message_tsickle_Closure_declarations() {
    /** @type {?} */
    Message.prototype.sources;
    /** @type {?} */
    Message.prototype.nodes;
    /** @type {?} */
    Message.prototype.placeholders;
    /** @type {?} */
    Message.prototype.placeholderToMessage;
    /** @type {?} */
    Message.prototype.meaning;
    /** @type {?} */
    Message.prototype.description;
    /** @type {?} */
    Message.prototype.id;
}
/**
 * @record
 */
export function MessageSpan() { }
function MessageSpan_tsickle_Closure_declarations() {
    /** @type {?} */
    MessageSpan.prototype.filePath;
    /** @type {?} */
    MessageSpan.prototype.startLine;
    /** @type {?} */
    MessageSpan.prototype.startCol;
    /** @type {?} */
    MessageSpan.prototype.endLine;
    /** @type {?} */
    MessageSpan.prototype.endCol;
}
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
export class Text {
    /**
     * @param {?} value
     * @param {?} sourceSpan
     */
    constructor(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitText(this, context); }
}
function Text_tsickle_Closure_declarations() {
    /** @type {?} */
    Text.prototype.value;
    /** @type {?} */
    Text.prototype.sourceSpan;
}
export class Container {
    /**
     * @param {?} children
     * @param {?} sourceSpan
     */
    constructor(children, sourceSpan) {
        this.children = children;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitContainer(this, context); }
}
function Container_tsickle_Closure_declarations() {
    /** @type {?} */
    Container.prototype.children;
    /** @type {?} */
    Container.prototype.sourceSpan;
}
export class Icu {
    /**
     * @param {?} expression
     * @param {?} type
     * @param {?} cases
     * @param {?} sourceSpan
     */
    constructor(expression, type, cases, sourceSpan) {
        this.expression = expression;
        this.type = type;
        this.cases = cases;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitIcu(this, context); }
}
function Icu_tsickle_Closure_declarations() {
    /** @type {?} */
    Icu.prototype.expressionPlaceholder;
    /** @type {?} */
    Icu.prototype.expression;
    /** @type {?} */
    Icu.prototype.type;
    /** @type {?} */
    Icu.prototype.cases;
    /** @type {?} */
    Icu.prototype.sourceSpan;
}
export class TagPlaceholder {
    /**
     * @param {?} tag
     * @param {?} attrs
     * @param {?} startName
     * @param {?} closeName
     * @param {?} children
     * @param {?} isVoid
     * @param {?} sourceSpan
     */
    constructor(tag, attrs, startName, closeName, children, isVoid, sourceSpan) {
        this.tag = tag;
        this.attrs = attrs;
        this.startName = startName;
        this.closeName = closeName;
        this.children = children;
        this.isVoid = isVoid;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitTagPlaceholder(this, context); }
}
function TagPlaceholder_tsickle_Closure_declarations() {
    /** @type {?} */
    TagPlaceholder.prototype.tag;
    /** @type {?} */
    TagPlaceholder.prototype.attrs;
    /** @type {?} */
    TagPlaceholder.prototype.startName;
    /** @type {?} */
    TagPlaceholder.prototype.closeName;
    /** @type {?} */
    TagPlaceholder.prototype.children;
    /** @type {?} */
    TagPlaceholder.prototype.isVoid;
    /** @type {?} */
    TagPlaceholder.prototype.sourceSpan;
}
export class Placeholder {
    /**
     * @param {?} value
     * @param {?} name
     * @param {?} sourceSpan
     */
    constructor(value, name, sourceSpan) {
        this.value = value;
        this.name = name;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitPlaceholder(this, context); }
}
function Placeholder_tsickle_Closure_declarations() {
    /** @type {?} */
    Placeholder.prototype.value;
    /** @type {?} */
    Placeholder.prototype.name;
    /** @type {?} */
    Placeholder.prototype.sourceSpan;
}
export class IcuPlaceholder {
    /**
     * @param {?} value
     * @param {?} name
     * @param {?} sourceSpan
     */
    constructor(value, name, sourceSpan) {
        this.value = value;
        this.name = name;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?=} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitIcuPlaceholder(this, context); }
}
function IcuPlaceholder_tsickle_Closure_declarations() {
    /** @type {?} */
    IcuPlaceholder.prototype.value;
    /** @type {?} */
    IcuPlaceholder.prototype.name;
    /** @type {?} */
    IcuPlaceholder.prototype.sourceSpan;
}
/**
 * @record
 */
export function Visitor() { }
function Visitor_tsickle_Closure_declarations() {
    /** @type {?} */
    Visitor.prototype.visitText;
    /** @type {?} */
    Visitor.prototype.visitContainer;
    /** @type {?} */
    Visitor.prototype.visitIcu;
    /** @type {?} */
    Visitor.prototype.visitTagPlaceholder;
    /** @type {?} */
    Visitor.prototype.visitPlaceholder;
    /** @type {?} */
    Visitor.prototype.visitIcuPlaceholder;
}
export class CloneVisitor {
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    visitText(text, context) { return new Text(text.value, text.sourceSpan); }
    /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    visitContainer(container, context) {
        const /** @type {?} */ children = container.children.map(n => n.visit(this, context));
        return new Container(children, container.sourceSpan);
    }
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    visitIcu(icu, context) {
        const /** @type {?} */ cases = {};
        Object.keys(icu.cases).forEach(key => cases[key] = icu.cases[key].visit(this, context));
        const /** @type {?} */ msg = new Icu(icu.expression, icu.type, cases, icu.sourceSpan);
        msg.expressionPlaceholder = icu.expressionPlaceholder;
        return msg;
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitTagPlaceholder(ph, context) {
        const /** @type {?} */ children = ph.children.map(n => n.visit(this, context));
        return new TagPlaceholder(ph.tag, ph.attrs, ph.startName, ph.closeName, children, ph.isVoid, ph.sourceSpan);
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) {
        return new Placeholder(ph.value, ph.name, ph.sourceSpan);
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) {
        return new IcuPlaceholder(ph.value, ph.name, ph.sourceSpan);
    }
}
export class RecurseVisitor {
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    visitText(text, context) { }
    /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    visitContainer(container, context) {
        container.children.forEach(child => child.visit(this));
    }
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    visitIcu(icu, context) {
        Object.keys(icu.cases).forEach(k => { icu.cases[k].visit(this); });
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitTagPlaceholder(ph, context) {
        ph.children.forEach(child => child.visit(this));
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) { }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) { }
}
//# sourceMappingURL=i18n_ast.js.map