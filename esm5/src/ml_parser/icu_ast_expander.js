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
import { ParseError } from '../parse_util';
import * as html from './ast';
// http://cldr.unicode.org/index/cldr-spec/plural-rules
var /** @type {?} */ PLURAL_CASES = ['zero', 'one', 'two', 'few', 'many', 'other'];
/**
 * Expands special forms into elements.
 *
 * For example,
 *
 * ```
 * { messages.length, plural,
 *   =0 {zero}
 *   =1 {one}
 *   other {more than one}
 * }
 * ```
 *
 * will be expanded into
 *
 * ```
 * <ng-container [ngPlural]="messages.length">
 *   <ng-template ngPluralCase="=0">zero</ng-template>
 *   <ng-template ngPluralCase="=1">one</ng-template>
 *   <ng-template ngPluralCase="other">more than one</ng-template>
 * </ng-container>
 * ```
 * @param {?} nodes
 * @return {?}
 */
export function expandNodes(nodes) {
    var /** @type {?} */ expander = new _Expander();
    return new ExpansionResult(html.visitAll(expander, nodes), expander.isExpanded, expander.errors);
}
var ExpansionResult = /** @class */ (function () {
    function ExpansionResult(nodes, expanded, errors) {
        this.nodes = nodes;
        this.expanded = expanded;
        this.errors = errors;
    }
    return ExpansionResult;
}());
export { ExpansionResult };
function ExpansionResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ExpansionResult.prototype.nodes;
    /** @type {?} */
    ExpansionResult.prototype.expanded;
    /** @type {?} */
    ExpansionResult.prototype.errors;
}
var ExpansionError = /** @class */ (function (_super) {
    tslib_1.__extends(ExpansionError, _super);
    function ExpansionError(span, errorMsg) {
        return _super.call(this, span, errorMsg) || this;
    }
    return ExpansionError;
}(ParseError));
export { ExpansionError };
/**
 * Expand expansion forms (plural, select) to directives
 *
 * \@internal
 */
var /**
 * Expand expansion forms (plural, select) to directives
 *
 * \@internal
 */
_Expander = /** @class */ (function () {
    function _Expander() {
        this.isExpanded = false;
        this.errors = [];
    }
    /**
     * @param {?} element
     * @param {?} context
     * @return {?}
     */
    _Expander.prototype.visitElement = /**
     * @param {?} element
     * @param {?} context
     * @return {?}
     */
    function (element, context) {
        return new html.Element(element.name, element.attrs, html.visitAll(this, element.children), element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
    };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    _Expander.prototype.visitAttribute = /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    function (attribute, context) { return attribute; };
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    _Expander.prototype.visitText = /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    function (text, context) { return text; };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    _Expander.prototype.visitComment = /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    function (comment, context) { return comment; };
    /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    _Expander.prototype.visitExpansion = /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    function (icu, context) {
        this.isExpanded = true;
        return icu.type == 'plural' ? _expandPluralForm(icu, this.errors) :
            _expandDefaultForm(icu, this.errors);
    };
    /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    _Expander.prototype.visitExpansionCase = /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    function (icuCase, context) {
        throw new Error('Should not be reached');
    };
    return _Expander;
}());
function _Expander_tsickle_Closure_declarations() {
    /** @type {?} */
    _Expander.prototype.isExpanded;
    /** @type {?} */
    _Expander.prototype.errors;
}
/**
 * @param {?} ast
 * @param {?} errors
 * @return {?}
 */
function _expandPluralForm(ast, errors) {
    var /** @type {?} */ children = ast.cases.map(function (c) {
        if (PLURAL_CASES.indexOf(c.value) == -1 && !c.value.match(/^=\d+$/)) {
            errors.push(new ExpansionError(c.valueSourceSpan, "Plural cases should be \"=<number>\" or one of " + PLURAL_CASES.join(", ")));
        }
        var /** @type {?} */ expansionResult = expandNodes(c.expression);
        errors.push.apply(errors, expansionResult.errors);
        return new html.Element("ng-template", [new html.Attribute('ngPluralCase', "" + c.value, c.valueSourceSpan)], expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan);
    });
    var /** @type {?} */ switchAttr = new html.Attribute('[ngPlural]', ast.switchValue, ast.switchValueSourceSpan);
    return new html.Element('ng-container', [switchAttr], children, ast.sourceSpan, ast.sourceSpan, ast.sourceSpan);
}
/**
 * @param {?} ast
 * @param {?} errors
 * @return {?}
 */
function _expandDefaultForm(ast, errors) {
    var /** @type {?} */ children = ast.cases.map(function (c) {
        var /** @type {?} */ expansionResult = expandNodes(c.expression);
        errors.push.apply(errors, expansionResult.errors);
        if (c.value === 'other') {
            // other is the default case when no values match
            return new html.Element("ng-template", [new html.Attribute('ngSwitchDefault', '', c.valueSourceSpan)], expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan);
        }
        return new html.Element("ng-template", [new html.Attribute('ngSwitchCase', "" + c.value, c.valueSourceSpan)], expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan);
    });
    var /** @type {?} */ switchAttr = new html.Attribute('[ngSwitch]', ast.switchValue, ast.switchValueSourceSpan);
    return new html.Element('ng-container', [switchAttr], children, ast.sourceSpan, ast.sourceSpan, ast.sourceSpan);
}
//# sourceMappingURL=icu_ast_expander.js.map