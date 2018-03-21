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
import * as tslib_1 from "tslib";
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
var Text = /** @class */ (function () {
    function Text(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    Text.prototype.visit = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitText(this, context); };
    return Text;
}());
export { Text };
function Text_tsickle_Closure_declarations() {
    /** @type {?} */
    Text.prototype.value;
    /** @type {?} */
    Text.prototype.sourceSpan;
}
var Expansion = /** @class */ (function () {
    function Expansion(switchValue, type, cases, sourceSpan, switchValueSourceSpan) {
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
    Expansion.prototype.visit = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitExpansion(this, context); };
    return Expansion;
}());
export { Expansion };
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
var ExpansionCase = /** @class */ (function () {
    function ExpansionCase(value, expression, sourceSpan, valueSourceSpan, expSourceSpan) {
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
    ExpansionCase.prototype.visit = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitExpansionCase(this, context); };
    return ExpansionCase;
}());
export { ExpansionCase };
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
var Attribute = /** @class */ (function () {
    function Attribute(name, value, sourceSpan, valueSpan) {
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
    Attribute.prototype.visit = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitAttribute(this, context); };
    return Attribute;
}());
export { Attribute };
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
var Element = /** @class */ (function () {
    function Element(name, attrs, children, sourceSpan, startSourceSpan, endSourceSpan) {
        if (startSourceSpan === void 0) { startSourceSpan = null; }
        if (endSourceSpan === void 0) { endSourceSpan = null; }
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
    Element.prototype.visit = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitElement(this, context); };
    return Element;
}());
export { Element };
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
var Comment = /** @class */ (function () {
    function Comment(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    Comment.prototype.visit = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) { return visitor.visitComment(this, context); };
    return Comment;
}());
export { Comment };
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
export function visitAll(visitor, nodes, context) {
    if (context === void 0) { context = null; }
    var /** @type {?} */ result = [];
    var /** @type {?} */ visit = visitor.visit ?
        function (ast) { return ((visitor.visit))(ast, context) || ast.visit(visitor, context); } :
        function (ast) { return ast.visit(visitor, context); };
    nodes.forEach(function (ast) {
        var /** @type {?} */ astResult = visit(ast);
        if (astResult) {
            result.push(astResult);
        }
    });
    return result;
}
var RecursiveVisitor = /** @class */ (function () {
    function RecursiveVisitor() {
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveVisitor.prototype.visitElement = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        this.visitChildren(context, function (visit) {
            visit(ast.attrs);
            visit(ast.children);
        });
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveVisitor.prototype.visitAttribute = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveVisitor.prototype.visitText = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveVisitor.prototype.visitComment = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveVisitor.prototype.visitExpansion = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        return this.visitChildren(context, function (visit) { visit(ast.cases); });
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    RecursiveVisitor.prototype.visitExpansionCase = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @template T
     * @param {?} context
     * @param {?} cb
     * @return {?}
     */
    RecursiveVisitor.prototype.visitChildren = /**
     * @template T
     * @param {?} context
     * @param {?} cb
     * @return {?}
     */
    function (context, cb) {
        var /** @type {?} */ results = [];
        var /** @type {?} */ t = this;
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
    };
    return RecursiveVisitor;
}());
export { RecursiveVisitor };
/**
 * @param {?} ast
 * @return {?}
 */
function spanOf(ast) {
    var /** @type {?} */ start = ast.sourceSpan.start.offset;
    var /** @type {?} */ end = ast.sourceSpan.end.offset;
    if (ast instanceof Element) {
        if (ast.endSourceSpan) {
            end = ast.endSourceSpan.end.offset;
        }
        else if (ast.children && ast.children.length) {
            end = spanOf(ast.children[ast.children.length - 1]).end;
        }
    }
    return { start: start, end: end };
}
/**
 * @param {?} nodes
 * @param {?} position
 * @return {?}
 */
export function findNode(nodes, position) {
    var /** @type {?} */ path = [];
    var /** @type {?} */ visitor = new /** @class */ (function (_super) {
        tslib_1.__extends(class_1, _super);
        function class_1() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        /**
         * @param {?} ast
         * @param {?} context
         * @return {?}
         */
        class_1.prototype.visit = /**
         * @param {?} ast
         * @param {?} context
         * @return {?}
         */
        function (ast, context) {
            var /** @type {?} */ span = spanOf(ast);
            if (span.start <= position && position < span.end) {
                path.push(ast);
            }
            else {
                // Returning a value here will result in the children being skipped.
                return true;
            }
        };
        return class_1;
    }(RecursiveVisitor));
    visitAll(visitor, nodes);
    return new AstPath(path, position);
}
//# sourceMappingURL=ast.js.map