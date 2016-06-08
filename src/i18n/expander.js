"use strict";
var html_ast_1 = require('../html_ast');
var exceptions_1 = require('../facade/exceptions');
/**
 * Expands special forms into elements.
 *
 * For example,
 *
 * ```
 * { messages.length, plural,
 *   =0 {zero}
 *   =1 {one}
 *   =other {more than one}
 * }
 * ```
 *
 * will be expanded into
 *
 * ```
 * <ul [ngPlural]="messages.length">
 *   <template [ngPluralCase]="0"><li i18n="plural_0">zero</li></template>
 *   <template [ngPluralCase]="1"><li i18n="plural_1">one</li></template>
 *   <template [ngPluralCase]="other"><li i18n="plural_other">more than one</li></template>
 * </ul>
 * ```
 */
function expandNodes(nodes) {
    var e = new _Expander();
    var n = html_ast_1.htmlVisitAll(e, nodes);
    return new ExpansionResult(n, e.expanded);
}
exports.expandNodes = expandNodes;
var ExpansionResult = (function () {
    function ExpansionResult(nodes, expanded) {
        this.nodes = nodes;
        this.expanded = expanded;
    }
    return ExpansionResult;
}());
exports.ExpansionResult = ExpansionResult;
var _Expander = (function () {
    function _Expander() {
        this.expanded = false;
    }
    _Expander.prototype.visitElement = function (ast, context) {
        return new html_ast_1.HtmlElementAst(ast.name, ast.attrs, html_ast_1.htmlVisitAll(this, ast.children), ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
    };
    _Expander.prototype.visitAttr = function (ast, context) { return ast; };
    _Expander.prototype.visitText = function (ast, context) { return ast; };
    _Expander.prototype.visitComment = function (ast, context) { return ast; };
    _Expander.prototype.visitExpansion = function (ast, context) {
        this.expanded = true;
        return ast.type == "plural" ? _expandPluralForm(ast) : _expandDefaultForm(ast);
    };
    _Expander.prototype.visitExpansionCase = function (ast, context) {
        throw new exceptions_1.BaseException("Should not be reached");
    };
    return _Expander;
}());
function _expandPluralForm(ast) {
    var children = ast.cases.map(function (c) {
        var expansionResult = expandNodes(c.expression);
        var i18nAttrs = expansionResult.expanded ?
            [] :
            [new html_ast_1.HtmlAttrAst("i18n", ast.type + "_" + c.value, c.valueSourceSpan)];
        return new html_ast_1.HtmlElementAst("template", [
            new html_ast_1.HtmlAttrAst("ngPluralCase", c.value, c.valueSourceSpan),
        ], [
            new html_ast_1.HtmlElementAst("li", i18nAttrs, expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan)
        ], c.sourceSpan, c.sourceSpan, c.sourceSpan);
    });
    var switchAttr = new html_ast_1.HtmlAttrAst("[ngPlural]", ast.switchValue, ast.switchValueSourceSpan);
    return new html_ast_1.HtmlElementAst("ul", [switchAttr], children, ast.sourceSpan, ast.sourceSpan, ast.sourceSpan);
}
function _expandDefaultForm(ast) {
    var children = ast.cases.map(function (c) {
        var expansionResult = expandNodes(c.expression);
        var i18nAttrs = expansionResult.expanded ?
            [] :
            [new html_ast_1.HtmlAttrAst("i18n", ast.type + "_" + c.value, c.valueSourceSpan)];
        return new html_ast_1.HtmlElementAst("template", [
            new html_ast_1.HtmlAttrAst("ngSwitchWhen", c.value, c.valueSourceSpan),
        ], [
            new html_ast_1.HtmlElementAst("li", i18nAttrs, expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan)
        ], c.sourceSpan, c.sourceSpan, c.sourceSpan);
    });
    var switchAttr = new html_ast_1.HtmlAttrAst("[ngSwitch]", ast.switchValue, ast.switchValueSourceSpan);
    return new html_ast_1.HtmlElementAst("ul", [switchAttr], children, ast.sourceSpan, ast.sourceSpan, ast.sourceSpan);
}
//# sourceMappingURL=expander.js.map