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
import { AstPath } from '../ast_path';
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
     * @param {?} context
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
export class Expansion {
    /**
     * @param {?} switchValue
     * @param {?} type
     * @param {?} cases
     * @param {?} sourceSpan
     * @param {?} switchValueSourceSpan
     */
    constructor(switchValue, type, cases, sourceSpan, switchValueSourceSpan) {
        this.switchValue = switchValue;
        this.type = type;
        this.cases = cases;
        this.sourceSpan = sourceSpan;
        this.switchValueSourceSpan = switchValueSourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitExpansion(this, context); }
}
function Expansion_tsickle_Closure_declarations() {
    /** @type {?} */
    Expansion.prototype.switchValue;
    /** @type {?} */
    Expansion.prototype.type;
    /** @type {?} */
    Expansion.prototype.cases;
    /** @type {?} */
    Expansion.prototype.sourceSpan;
    /** @type {?} */
    Expansion.prototype.switchValueSourceSpan;
}
export class ExpansionCase {
    /**
     * @param {?} value
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} valueSourceSpan
     * @param {?} expSourceSpan
     */
    constructor(value, expression, sourceSpan, valueSourceSpan, expSourceSpan) {
        this.value = value;
        this.expression = expression;
        this.sourceSpan = sourceSpan;
        this.valueSourceSpan = valueSourceSpan;
        this.expSourceSpan = expSourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitExpansionCase(this, context); }
}
function ExpansionCase_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpansionCase.prototype.value;
    /** @type {?} */
    ExpansionCase.prototype.expression;
    /** @type {?} */
    ExpansionCase.prototype.sourceSpan;
    /** @type {?} */
    ExpansionCase.prototype.valueSourceSpan;
    /** @type {?} */
    ExpansionCase.prototype.expSourceSpan;
}
export class Attribute {
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?=} valueSpan
     */
    constructor(name, value, sourceSpan, valueSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitAttribute(this, context); }
}
function Attribute_tsickle_Closure_declarations() {
    /** @type {?} */
    Attribute.prototype.name;
    /** @type {?} */
    Attribute.prototype.value;
    /** @type {?} */
    Attribute.prototype.sourceSpan;
    /** @type {?} */
    Attribute.prototype.valueSpan;
}
export class Element {
    /**
     * @param {?} name
     * @param {?} attrs
     * @param {?} children
     * @param {?} sourceSpan
     * @param {?=} startSourceSpan
     * @param {?=} endSourceSpan
     */
    constructor(name, attrs, children, sourceSpan, startSourceSpan = null, endSourceSpan = null) {
        this.name = name;
        this.attrs = attrs;
        this.children = children;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitElement(this, context); }
}
function Element_tsickle_Closure_declarations() {
    /** @type {?} */
    Element.prototype.name;
    /** @type {?} */
    Element.prototype.attrs;
    /** @type {?} */
    Element.prototype.children;
    /** @type {?} */
    Element.prototype.sourceSpan;
    /** @type {?} */
    Element.prototype.startSourceSpan;
    /** @type {?} */
    Element.prototype.endSourceSpan;
}
export class Comment {
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
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { return visitor.visitComment(this, context); }
}
function Comment_tsickle_Closure_declarations() {
    /** @type {?} */
    Comment.prototype.value;
    /** @type {?} */
    Comment.prototype.sourceSpan;
}
/**
 * @record
 */
export function Visitor() { }
function Visitor_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Visitor.prototype.visit;
    /** @type {?} */
    Visitor.prototype.visitElement;
    /** @type {?} */
    Visitor.prototype.visitAttribute;
    /** @type {?} */
    Visitor.prototype.visitText;
    /** @type {?} */
    Visitor.prototype.visitComment;
    /** @type {?} */
    Visitor.prototype.visitExpansion;
    /** @type {?} */
    Visitor.prototype.visitExpansionCase;
}
/**
 * @param {?} visitor
 * @param {?} nodes
 * @param {?=} context
 * @return {?}
 */
export function visitAll(visitor, nodes, context = null) {
    const /** @type {?} */ result = [];
    const /** @type {?} */ visit = visitor.visit ?
        (ast) => /** @type {?} */ ((visitor.visit))(ast, context) || ast.visit(visitor, context) :
        (ast) => ast.visit(visitor, context);
    nodes.forEach(ast => {
        const /** @type {?} */ astResult = visit(ast);
        if (astResult) {
            result.push(astResult);
        }
    });
    return result;
}
export class RecursiveVisitor {
    constructor() { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElement(ast, context) {
        this.visitChildren(context, visit => {
            visit(ast.attrs);
            visit(ast.children);
        });
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAttribute(ast, context) { }
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
    visitComment(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitExpansion(ast, context) {
        return this.visitChildren(context, visit => { visit(ast.cases); });
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitExpansionCase(ast, context) { }
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
            if (children)
                results.push(visitAll(t, children, context));
        }
        cb(visit);
        return [].concat.apply([], results);
    }
}
/**
 * @param {?} ast
 * @return {?}
 */
function spanOf(ast) {
    const /** @type {?} */ start = ast.sourceSpan.start.offset;
    let /** @type {?} */ end = ast.sourceSpan.end.offset;
    if (ast instanceof Element) {
        if (ast.endSourceSpan) {
            end = ast.endSourceSpan.end.offset;
        }
        else if (ast.children && ast.children.length) {
            end = spanOf(ast.children[ast.children.length - 1]).end;
        }
    }
    return { start, end };
}
/**
 * @param {?} nodes
 * @param {?} position
 * @return {?}
 */
export function findNode(nodes, position) {
    const /** @type {?} */ path = [];
    const /** @type {?} */ visitor = new class extends RecursiveVisitor {
        /**
         * @param {?} ast
         * @param {?} context
         * @return {?}
         */
        visit(ast, context) {
            const /** @type {?} */ span = spanOf(ast);
            if (span.start <= position && position < span.end) {
                path.push(ast);
            }
            else {
                // Returning a value here will result in the children being skipped.
                return true;
            }
        }
    };
    visitAll(visitor, nodes);
    return new AstPath(path, position);
}
//# sourceMappingURL=ast.js.map