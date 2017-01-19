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
    }
}
function Message_tsickle_Closure_declarations() {
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
//# sourceMappingURL=i18n_ast.js.map