/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/ml_parser/icu_ast_expander", ["require", "exports", "tslib", "@angular/compiler/src/parse_util", "@angular/compiler/src/ml_parser/ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ExpansionError = exports.ExpansionResult = exports.expandNodes = void 0;
    var tslib_1 = require("tslib");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var html = require("@angular/compiler/src/ml_parser/ast");
    // http://cldr.unicode.org/index/cldr-spec/plural-rules
    var PLURAL_CASES = ['zero', 'one', 'two', 'few', 'many', 'other'];
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
     */
    function expandNodes(nodes) {
        var expander = new _Expander();
        return new ExpansionResult(html.visitAll(expander, nodes), expander.isExpanded, expander.errors);
    }
    exports.expandNodes = expandNodes;
    var ExpansionResult = /** @class */ (function () {
        function ExpansionResult(nodes, expanded, errors) {
            this.nodes = nodes;
            this.expanded = expanded;
            this.errors = errors;
        }
        return ExpansionResult;
    }());
    exports.ExpansionResult = ExpansionResult;
    var ExpansionError = /** @class */ (function (_super) {
        tslib_1.__extends(ExpansionError, _super);
        function ExpansionError(span, errorMsg) {
            return _super.call(this, span, errorMsg) || this;
        }
        return ExpansionError;
    }(parse_util_1.ParseError));
    exports.ExpansionError = ExpansionError;
    /**
     * Expand expansion forms (plural, select) to directives
     *
     * @internal
     */
    var _Expander = /** @class */ (function () {
        function _Expander() {
            this.isExpanded = false;
            this.errors = [];
        }
        _Expander.prototype.visitElement = function (element, context) {
            return new html.Element(element.name, element.attrs, html.visitAll(this, element.children), element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        };
        _Expander.prototype.visitAttribute = function (attribute, context) {
            return attribute;
        };
        _Expander.prototype.visitText = function (text, context) {
            return text;
        };
        _Expander.prototype.visitComment = function (comment, context) {
            return comment;
        };
        _Expander.prototype.visitExpansion = function (icu, context) {
            this.isExpanded = true;
            return icu.type == 'plural' ? _expandPluralForm(icu, this.errors) :
                _expandDefaultForm(icu, this.errors);
        };
        _Expander.prototype.visitExpansionCase = function (icuCase, context) {
            throw new Error('Should not be reached');
        };
        return _Expander;
    }());
    // Plural forms are expanded to `NgPlural` and `NgPluralCase`s
    function _expandPluralForm(ast, errors) {
        var children = ast.cases.map(function (c) {
            if (PLURAL_CASES.indexOf(c.value) == -1 && !c.value.match(/^=\d+$/)) {
                errors.push(new ExpansionError(c.valueSourceSpan, "Plural cases should be \"=<number>\" or one of " + PLURAL_CASES.join(', ')));
            }
            var expansionResult = expandNodes(c.expression);
            errors.push.apply(errors, tslib_1.__spread(expansionResult.errors));
            return new html.Element("ng-template", [new html.Attribute('ngPluralCase', "" + c.value, c.valueSourceSpan)], expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan);
        });
        var switchAttr = new html.Attribute('[ngPlural]', ast.switchValue, ast.switchValueSourceSpan);
        return new html.Element('ng-container', [switchAttr], children, ast.sourceSpan, ast.sourceSpan, ast.sourceSpan);
    }
    // ICU messages (excluding plural form) are expanded to `NgSwitch`  and `NgSwitchCase`s
    function _expandDefaultForm(ast, errors) {
        var children = ast.cases.map(function (c) {
            var expansionResult = expandNodes(c.expression);
            errors.push.apply(errors, tslib_1.__spread(expansionResult.errors));
            if (c.value === 'other') {
                // other is the default case when no values match
                return new html.Element("ng-template", [new html.Attribute('ngSwitchDefault', '', c.valueSourceSpan)], expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan);
            }
            return new html.Element("ng-template", [new html.Attribute('ngSwitchCase', "" + c.value, c.valueSourceSpan)], expansionResult.nodes, c.sourceSpan, c.sourceSpan, c.sourceSpan);
        });
        var switchAttr = new html.Attribute('[ngSwitch]', ast.switchValue, ast.switchValueSourceSpan);
        return new html.Element('ng-container', [switchAttr], children, ast.sourceSpan, ast.sourceSpan, ast.sourceSpan);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWN1X2FzdF9leHBhbmRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9tbF9wYXJzZXIvaWN1X2FzdF9leHBhbmRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsK0RBQTBEO0lBRTFELDBEQUE4QjtJQUU5Qix1REFBdUQ7SUFDdkQsSUFBTSxZQUFZLEdBQWEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRTlFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09Bc0JHO0lBQ0gsU0FBZ0IsV0FBVyxDQUFDLEtBQWtCO1FBQzVDLElBQU0sUUFBUSxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFDakMsT0FBTyxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBSEQsa0NBR0M7SUFFRDtRQUNFLHlCQUFtQixLQUFrQixFQUFTLFFBQWlCLEVBQVMsTUFBb0I7WUFBekUsVUFBSyxHQUFMLEtBQUssQ0FBYTtZQUFTLGFBQVEsR0FBUixRQUFRLENBQVM7WUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFjO1FBQUcsQ0FBQztRQUNsRyxzQkFBQztJQUFELENBQUMsQUFGRCxJQUVDO0lBRlksMENBQWU7SUFJNUI7UUFBb0MsMENBQVU7UUFDNUMsd0JBQVksSUFBcUIsRUFBRSxRQUFnQjttQkFDakQsa0JBQU0sSUFBSSxFQUFFLFFBQVEsQ0FBQztRQUN2QixDQUFDO1FBQ0gscUJBQUM7SUFBRCxDQUFDLEFBSkQsQ0FBb0MsdUJBQVUsR0FJN0M7SUFKWSx3Q0FBYztJQU0zQjs7OztPQUlHO0lB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cUJBQXFCLENBQUMsQ0FBQztRQUNoRyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FDbkIsY0FBYyxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4vYXN0JztcblxuLy8gaHR0cDovL2NsZHIudW5pY29kZS5vcmcvaW5kZXgvY2xkci1zcGVjL3BsdXJhbC1ydWxlc1xuY29uc3QgUExVUkFMX0NBU0VTOiBzdHJpbmdbXSA9IFsnemVybycsICdvbmUnLCAndHdvJywgJ2ZldycsICdtYW55JywgJ290aGVyJ107XG5cbi8qKlxuICogRXhwYW5kcyBzcGVjaWFsIGZvcm1zIGludG8gZWxlbWVudHMuXG4gKlxuICogRm9yIGV4YW1wbGUsXG4gKlxuICogYGBgXG4gKiB7IG1lc3NhZ2VzLmxlbmd0aCwgcGx1cmFsLFxuICogICA9MCB7emVyb31cbiAqICAgPTEge29uZX1cbiAqICAgb3RoZXIge21vcmUgdGhhbiBvbmV9XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiB3aWxsIGJlIGV4cGFuZGVkIGludG9cbiAqXG4gKiBgYGBcbiAqIDxuZy1jb250YWluZXIgW25nUGx1cmFsXT1cIm1lc3NhZ2VzLmxlbmd0aFwiPlxuICogICA8bmctdGVtcGxhdGUgbmdQbHVyYWxDYXNlPVwiPTBcIj56ZXJvPC9uZy10ZW1wbGF0ZT5cbiAqICAgPG5nLXRlbXBsYXRlIG5nUGx1cmFsQ2FzZT1cIj0xXCI+b25lPC9uZy10ZW1wbGF0ZT5cbiAqICAgPG5nLXRlbXBsYXRlIG5nUGx1cmFsQ2FzZT1cIm90aGVyXCI+bW9yZSB0aGFuIG9uZTwvbmctdGVtcGxhdGU+XG4gKiA8L25nLWNvbnRhaW5lcj5cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhwYW5kTm9kZXMobm9kZXM6IGh0bWwuTm9kZVtdKTogRXhwYW5zaW9uUmVzdWx0IHtcbiAgY29uc3QgZXhwYW5kZXIgPSBuZXcgX0V4cGFuZGVyKCk7XG4gIHJldHVybiBuZXcgRXhwYW5zaW9uUmVzdWx0KGh0bWwudmlzaXRBbGwoZXhwYW5kZXIsIG5vZGVzKSwgZXhwYW5kZXIuaXNFeHBhbmRlZCwgZXhwYW5kZXIuZXJyb3JzKTtcbn1cblxuZXhwb3J0IGNsYXNzIEV4cGFuc2lvblJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBub2RlczogaHRtbC5Ob2RlW10sIHB1YmxpYyBleHBhbmRlZDogYm9vbGVhbiwgcHVibGljIGVycm9yczogUGFyc2VFcnJvcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgRXhwYW5zaW9uRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBlcnJvck1zZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoc3BhbiwgZXJyb3JNc2cpO1xuICB9XG59XG5cbi8qKlxuICogRXhwYW5kIGV4cGFuc2lvbiBmb3JtcyAocGx1cmFsLCBzZWxlY3QpIHRvIGRpcmVjdGl2ZXNcbiAqXG4gKiBAaW50ZXJuYWxcbiAqL1xuY2xhc3MgX0V4cGFuZGVyIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgaXNFeHBhbmRlZDogYm9vbGVhbiA9IGZhbHNlO1xuICBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIG5ldyBodG1sLkVsZW1lbnQoXG4gICAgICAgIGVsZW1lbnQubmFtZSwgZWxlbWVudC5hdHRycywgaHRtbC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKSwgZWxlbWVudC5zb3VyY2VTcGFuLFxuICAgICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBjb21tZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oaWN1OiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLmlzRXhwYW5kZWQgPSB0cnVlO1xuICAgIHJldHVybiBpY3UudHlwZSA9PSAncGx1cmFsJyA/IF9leHBhbmRQbHVyYWxGb3JtKGljdSwgdGhpcy5lcnJvcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfZXhwYW5kRGVmYXVsdEZvcm0oaWN1LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoaWN1Q2FzZTogaHRtbC5FeHBhbnNpb25DYXNlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcignU2hvdWxkIG5vdCBiZSByZWFjaGVkJyk7XG4gIH1cbn1cblxuLy8gUGx1cmFsIGZvcm1zIGFyZSBleHBhbmRlZCB0byBgTmdQbHVyYWxgIGFuZCBgTmdQbHVyYWxDYXNlYHNcbmZ1bmN0aW9uIF9leHBhbmRQbHVyYWxGb3JtKGFzdDogaHRtbC5FeHBhbnNpb24sIGVycm9yczogUGFyc2VFcnJvcltdKTogaHRtbC5FbGVtZW50IHtcbiAgY29uc3QgY2hpbGRyZW4gPSBhc3QuY2FzZXMubWFwKGMgPT4ge1xuICAgIGlmIChQTFVSQUxfQ0FTRVMuaW5kZXhPZihjLnZhbHVlKSA9PSAtMSAmJiAhYy52YWx1ZS5tYXRjaCgvXj1cXGQrJC8pKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgRXhwYW5zaW9uRXJyb3IoXG4gICAgICAgICAgYy52YWx1ZVNvdXJjZVNwYW4sXG4gICAgICAgICAgYFBsdXJhbCBjYXNlcyBzaG91bGQgYmUgXCI9PG51bWJlcj5cIiBvciBvbmUgb2YgJHtQTFVSQUxfQ0FTRVMuam9pbignLCAnKX1gKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwYW5zaW9uUmVzdWx0ID0gZXhwYW5kTm9kZXMoYy5leHByZXNzaW9uKTtcbiAgICBlcnJvcnMucHVzaCguLi5leHBhbnNpb25SZXN1bHQuZXJyb3JzKTtcblxuICAgIHJldHVybiBuZXcgaHRtbC5FbGVtZW50KFxuICAgICAgICBgbmctdGVtcGxhdGVgLCBbbmV3IGh0bWwuQXR0cmlidXRlKCduZ1BsdXJhbENhc2UnLCBgJHtjLnZhbHVlfWAsIGMudmFsdWVTb3VyY2VTcGFuKV0sXG4gICAgICAgIGV4cGFuc2lvblJlc3VsdC5ub2RlcywgYy5zb3VyY2VTcGFuLCBjLnNvdXJjZVNwYW4sIGMuc291cmNlU3Bhbik7XG4gIH0pO1xuICBjb25zdCBzd2l0Y2hBdHRyID0gbmV3IGh0bWwuQXR0cmlidXRlKCdbbmdQbHVyYWxdJywgYXN0LnN3aXRjaFZhbHVlLCBhc3Quc3dpdGNoVmFsdWVTb3VyY2VTcGFuKTtcbiAgcmV0dXJuIG5ldyBodG1sLkVsZW1lbnQoXG4gICAgICAnbmctY29udGFpbmVyJywgW3N3aXRjaEF0dHJdLCBjaGlsZHJlbiwgYXN0LnNvdXJjZVNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Quc291cmNlU3Bhbik7XG59XG5cbi8vIElDVSBtZXNzYWdlcyAoZXhjbHVkaW5nIHBsdXJhbCBmb3JtKSBhcmUgZXhwYW5kZWQgdG8gYE5nU3dpdGNoYCAgYW5kIGBOZ1N3aXRjaENhc2Vgc1xuZnVuY3Rpb24gX2V4cGFuZERlZmF1bHRGb3JtKGFzdDogaHRtbC5FeHBhbnNpb24sIGVycm9yczogUGFyc2VFcnJvcltdKTogaHRtbC5FbGVtZW50IHtcbiAgY29uc3QgY2hpbGRyZW4gPSBhc3QuY2FzZXMubWFwKGMgPT4ge1xuICAgIGNvbnN0IGV4cGFuc2lvblJlc3VsdCA9IGV4cGFuZE5vZGVzKGMuZXhwcmVzc2lvbik7XG4gICAgZXJyb3JzLnB1c2goLi4uZXhwYW5zaW9uUmVzdWx0LmVycm9ycyk7XG5cbiAgICBpZiAoYy52YWx1ZSA9PT0gJ290aGVyJykge1xuICAgICAgLy8gb3RoZXIgaXMgdGhlIGRlZmF1bHQgY2FzZSB3aGVuIG5vIHZhbHVlcyBtYXRjaFxuICAgICAgcmV0dXJuIG5ldyBodG1sLkVsZW1lbnQoXG4gICAgICAgICAgYG5nLXRlbXBsYXRlYCwgW25ldyBodG1sLkF0dHJpYnV0ZSgnbmdTd2l0Y2hEZWZhdWx0JywgJycsIGMudmFsdWVTb3VyY2VTcGFuKV0sXG4gICAgICAgICAgZXhwYW5zaW9uUmVzdWx0Lm5vZGVzLCBjLnNvdXJjZVNwYW4sIGMuc291cmNlU3BhbiwgYy5zb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IGh0bWwuRWxlbWVudChcbiAgICAgICAgYG5nLXRlbXBsYXRlYCwgW25ldyBodG1sLkF0dHJpYnV0ZSgnbmdTd2l0Y2hDYXNlJywgYCR7Yy52YWx1ZX1gLCBjLnZhbHVlU291cmNlU3BhbildLFxuICAgICAgICBleHBhbnNpb25SZXN1bHQubm9kZXMsIGMuc291cmNlU3BhbiwgYy5zb3VyY2VTcGFuLCBjLnNvdXJjZVNwYW4pO1xuICB9KTtcbiAgY29uc3Qgc3dpdGNoQXR0ciA9IG5ldyBodG1sLkF0dHJpYnV0ZSgnW25nU3dpdGNoXScsIGFzdC5zd2l0Y2hWYWx1ZSwgYXN0LnN3aXRjaFZhbHVlU291cmNlU3Bhbik7XG4gIHJldHVybiBuZXcgaHRtbC5FbGVtZW50KFxuICAgICAgJ25nLWNvbnRhaW5lcicsIFtzd2l0Y2hBdHRyXSwgY2hpbGRyZW4sIGFzdC5zb3VyY2VTcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LnNvdXJjZVNwYW4pO1xufVxuIl19