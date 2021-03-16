(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/component", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/directive", "@angular/compiler/src/render3/partial/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createComponentDefinitionMap = exports.compileDeclareComponentFromMetadata = void 0;
    var tslib_1 = require("tslib");
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var core = require("@angular/compiler/src/core");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var compiler_1 = require("@angular/compiler/src/render3/view/compiler");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    var directive_1 = require("@angular/compiler/src/render3/partial/directive");
    var util_2 = require("@angular/compiler/src/render3/partial/util");
    /**
     * Compile a component declaration defined by the `R3ComponentMetadata`.
     */
    function compileDeclareComponentFromMetadata(meta, template) {
        var definitionMap = createComponentDefinitionMap(meta, template);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareComponent).callFn([definitionMap.toLiteralMap()]);
        var type = compiler_1.createComponentType(meta);
        return { expression: expression, type: type };
    }
    exports.compileDeclareComponentFromMetadata = compileDeclareComponentFromMetadata;
    /**
     * Gathers the declaration fields for a component into a `DefinitionMap`.
     */
    function createComponentDefinitionMap(meta, template) {
        var definitionMap = directive_1.createDirectiveDefinitionMap(meta);
        definitionMap.set('template', getTemplateExpression(template));
        if (template.isInline) {
            definitionMap.set('isInline', o.literal(true));
        }
        definitionMap.set('styles', util_2.toOptionalLiteralArray(meta.styles, o.literal));
        definitionMap.set('components', compileUsedDirectiveMetadata(meta, function (directive) { return directive.isComponent === true; }));
        definitionMap.set('directives', compileUsedDirectiveMetadata(meta, function (directive) { return directive.isComponent !== true; }));
        definitionMap.set('pipes', compileUsedPipeMetadata(meta));
        definitionMap.set('viewProviders', meta.viewProviders);
        definitionMap.set('animations', meta.animations);
        if (meta.changeDetection !== undefined) {
            definitionMap.set('changeDetection', o.importExpr(r3_identifiers_1.Identifiers.ChangeDetectionStrategy)
                .prop(core.ChangeDetectionStrategy[meta.changeDetection]));
        }
        if (meta.encapsulation !== core.ViewEncapsulation.Emulated) {
            definitionMap.set('encapsulation', o.importExpr(r3_identifiers_1.Identifiers.ViewEncapsulation).prop(core.ViewEncapsulation[meta.encapsulation]));
        }
        if (meta.interpolation !== interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG) {
            definitionMap.set('interpolation', o.literalArr([o.literal(meta.interpolation.start), o.literal(meta.interpolation.end)]));
        }
        if (template.preserveWhitespaces === true) {
            definitionMap.set('preserveWhitespaces', o.literal(true));
        }
        return definitionMap;
    }
    exports.createComponentDefinitionMap = createComponentDefinitionMap;
    function getTemplateExpression(template) {
        if (typeof template.template === 'string') {
            if (template.isInline) {
                // The template is inline but not a simple literal string, so give up with trying to
                // source-map it and just return a simple literal here.
                return o.literal(template.template);
            }
            else {
                // The template is external so we must synthesize an expression node with the appropriate
                // source-span.
                var contents = template.template;
                var file = new parse_util_1.ParseSourceFile(contents, template.templateUrl);
                var start = new parse_util_1.ParseLocation(file, 0, 0, 0);
                var end = computeEndLocation(file, contents);
                var span = new parse_util_1.ParseSourceSpan(start, end);
                return o.literal(contents, null, span);
            }
        }
        else {
            // The template is inline so we can just reuse the current expression node.
            return template.template;
        }
    }
    function computeEndLocation(file, contents) {
        var length = contents.length;
        var lineStart = 0;
        var lastLineStart = 0;
        var line = 0;
        do {
            lineStart = contents.indexOf('\n', lastLineStart);
            if (lineStart !== -1) {
                lastLineStart = lineStart + 1;
                line++;
            }
        } while (lineStart !== -1);
        return new parse_util_1.ParseLocation(file, length, line, length - lastLineStart);
    }
    /**
     * Compiles the directives as registered in the component metadata into an array literal of the
     * individual directives. If the component does not use any directives, then null is returned.
     */
    function compileUsedDirectiveMetadata(meta, predicate) {
        var wrapType = meta.declarationListEmitMode !== 0 /* Direct */ ?
            generateForwardRef :
            function (expr) { return expr; };
        var directives = meta.directives.filter(predicate);
        return util_2.toOptionalLiteralArray(directives, function (directive) {
            var dirMeta = new util_1.DefinitionMap();
            dirMeta.set('type', wrapType(directive.type));
            dirMeta.set('selector', o.literal(directive.selector));
            dirMeta.set('inputs', util_2.toOptionalLiteralArray(directive.inputs, o.literal));
            dirMeta.set('outputs', util_2.toOptionalLiteralArray(directive.outputs, o.literal));
            dirMeta.set('exportAs', util_2.toOptionalLiteralArray(directive.exportAs, o.literal));
            return dirMeta.toLiteralMap();
        });
    }
    /**
     * Compiles the pipes as registered in the component metadata into an object literal, where the
     * pipe's name is used as key and a reference to its type as value. If the component does not use
     * any pipes, then null is returned.
     */
    function compileUsedPipeMetadata(meta) {
        var e_1, _a;
        if (meta.pipes.size === 0) {
            return null;
        }
        var wrapType = meta.declarationListEmitMode !== 0 /* Direct */ ?
            generateForwardRef :
            function (expr) { return expr; };
        var entries = [];
        try {
            for (var _b = tslib_1.__values(meta.pipes), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), name_1 = _d[0], pipe = _d[1];
                entries.push({ key: name_1, value: wrapType(pipe), quoted: true });
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return o.literalMap(entries);
    }
    function generateForwardRef(expr) {
        return o.importExpr(r3_identifiers_1.Identifiers.forwardRef).callFn([o.fn([], [new o.ReturnStatement(expr)])]);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtEQUFpRjtJQUNqRiwrRUFBb0Q7SUFFcEQsd0VBQXFEO0lBRXJELGdFQUEyQztJQUczQyw2RUFBeUQ7SUFDekQsbUVBQThDO0lBRzlDOztPQUVHO0lBQ0gsU0FBZ0IsbUNBQW1DLENBQy9DLElBQXlCLEVBQUUsUUFBd0I7UUFDckQsSUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRW5FLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFDLENBQUM7SUFDNUIsQ0FBQztJQVJELGtGQVFDO0lBRUQ7O09BRUc7SUFDSCxTQUFnQiw0QkFBNEIsQ0FBQyxJQUF5QixFQUFFLFFBQXdCO1FBRTlGLElBQU0sYUFBYSxHQUNmLHdDQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDL0QsSUFBSSxRQUFRLENBQUMsUUFBUSxFQUFFO1lBQ3JCLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FB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RSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3BCLFVBQUMsSUFBa0IsSUFBSyxPQUFBLElBQUksRUFBSixDQUFJLENBQUM7UUFFakMsSUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDOztZQUNuQixLQUEyQixJQUFBLEtBQUEsaUJBQUEsSUFBSSxDQUFDLEtBQUssQ0FBQSxnQkFBQSw0QkFBRTtnQkFBNUIsSUFBQSxLQUFBLDJCQUFZLEVBQVgsTUFBSSxRQUFBLEVBQUUsSUFBSSxRQUFBO2dCQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLE1BQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO2FBQ2hFOzs7Ozs7Ozs7UUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELFNBQVMsa0JBQWtCLENBQUMsSUFBa0I7UUFDNUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlTG9jYXRpb24sIFBhcnNlU291cmNlRmlsZSwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50RGVmLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21wb25lbnRUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7UGFyc2VkVGVtcGxhdGV9IGZyb20gJy4uL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhLCBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9kaXJlY3RpdmUnO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbEFycmF5fSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGEsIHRlbXBsYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBjb21wb25lbnQgaW50byBhIGBEZWZpbml0aW9uTWFwYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudERlZmluaXRpb25NYXAobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+ID1cbiAgICAgIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgZ2V0VGVtcGxhdGVFeHByZXNzaW9uKHRlbXBsYXRlKSk7XG4gIGlmICh0ZW1wbGF0ZS5pc0lubGluZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc0lubGluZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShtZXRhLnN0eWxlcywgby5saXRlcmFsKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2NvbXBvbmVudHMnLFxuICAgICAgY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShtZXRhLCBkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLmlzQ29tcG9uZW50ID09PSB0cnVlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2RpcmVjdGl2ZXMnLFxuICAgICAgY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShtZXRhLCBkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLmlzQ29tcG9uZW50ICE9PSB0cnVlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIGNvbXBpbGVVc2VkUGlwZU1ldGFkYXRhKG1ldGEpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdQcm92aWRlcnMnLCBtZXRhLnZpZXdQcm92aWRlcnMpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnYW5pbWF0aW9ucycsIG1ldGEuYW5pbWF0aW9ucyk7XG5cbiAgaWYgKG1ldGEuY2hhbmdlRGV0ZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NoYW5nZURldGVjdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSlcbiAgICAgICAgICAgIC5wcm9wKGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3lbbWV0YS5jaGFuZ2VEZXRlY3Rpb25dKSk7XG4gIH1cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZW5jYXBzdWxhdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5WaWV3RW5jYXBzdWxhdGlvbikucHJvcChjb3JlLlZpZXdFbmNhcHN1bGF0aW9uW21ldGEuZW5jYXBzdWxhdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5pbnRlcnBvbGF0aW9uICE9PSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdpbnRlcnBvbGF0aW9uJyxcbiAgICAgICAgby5saXRlcmFsQXJyKFtvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLnN0YXJ0KSwgby5saXRlcmFsKG1ldGEuaW50ZXJwb2xhdGlvbi5lbmQpXSkpO1xuICB9XG5cbiAgaWYgKHRlbXBsYXRlLnByZXNlcnZlV2hpdGVzcGFjZXMgPT09IHRydWUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHJlc2VydmVXaGl0ZXNwYWNlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVFeHByZXNzaW9uKHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmICh0eXBlb2YgdGVtcGxhdGUudGVtcGxhdGUgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHRlbXBsYXRlLmlzSW5saW5lKSB7XG4gICAgICAvLyBUaGUgdGVtcGxhdGUgaXMgaW5saW5lIGJ1dCBub3QgYSBzaW1wbGUgbGl0ZXJhbCBzdHJpbmcsIHNvIGdpdmUgdXAgd2l0aCB0cnlpbmcgdG9cbiAgICAgIC8vIHNvdXJjZS1tYXAgaXQgYW5kIGp1c3QgcmV0dXJuIGEgc2ltcGxlIGxpdGVyYWwgaGVyZS5cbiAgICAgIHJldHVybiBvLmxpdGVyYWwodGVtcGxhdGUudGVtcGxhdGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgdGVtcGxhdGUgaXMgZXh0ZXJuYWwgc28gd2UgbXVzdCBzeW50aGVzaXplIGFuIGV4cHJlc3Npb24gbm9kZSB3aXRoIHRoZSBhcHByb3ByaWF0ZVxuICAgICAgLy8gc291cmNlLXNwYW4uXG4gICAgICBjb25zdCBjb250ZW50cyA9IHRlbXBsYXRlLnRlbXBsYXRlO1xuICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYXJzZVNvdXJjZUZpbGUoY29udGVudHMsIHRlbXBsYXRlLnRlbXBsYXRlVXJsKTtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgMCwgMCwgMCk7XG4gICAgICBjb25zdCBlbmQgPSBjb21wdXRlRW5kTG9jYXRpb24oZmlsZSwgY29udGVudHMpO1xuICAgICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCk7XG4gICAgICByZXR1cm4gby5saXRlcmFsKGNvbnRlbnRzLCBudWxsLCBzcGFuKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIHRlbXBsYXRlIGlzIGlubGluZSBzbyB3ZSBjYW4ganVzdCByZXVzZSB0aGUgY3VycmVudCBleHByZXNzaW9uIG5vZGUuXG4gICAgcmV0dXJuIHRlbXBsYXRlLnRlbXBsYXRlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVFbmRMb2NhdGlvbihmaWxlOiBQYXJzZVNvdXJjZUZpbGUsIGNvbnRlbnRzOiBzdHJpbmcpOiBQYXJzZUxvY2F0aW9uIHtcbiAgY29uc3QgbGVuZ3RoID0gY29udGVudHMubGVuZ3RoO1xuICBsZXQgbGluZVN0YXJ0ID0gMDtcbiAgbGV0IGxhc3RMaW5lU3RhcnQgPSAwO1xuICBsZXQgbGluZSA9IDA7XG4gIGRvIHtcbiAgICBsaW5lU3RhcnQgPSBjb250ZW50cy5pbmRleE9mKCdcXG4nLCBsYXN0TGluZVN0YXJ0KTtcbiAgICBpZiAobGluZVN0YXJ0ICE9PSAtMSkge1xuICAgICAgbGFzdExpbmVTdGFydCA9IGxpbmVTdGFydCArIDE7XG4gICAgICBsaW5lKys7XG4gICAgfVxuICB9IHdoaWxlIChsaW5lU3RhcnQgIT09IC0xKTtcblxuICByZXR1cm4gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgbGVuZ3RoLCBsaW5lLCBsZW5ndGggLSBsYXN0TGluZVN0YXJ0KTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgZGlyZWN0aXZlcyBhcyByZWdpc3RlcmVkIGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGEgaW50byBhbiBhcnJheSBsaXRlcmFsIG9mIHRoZVxuICogaW5kaXZpZHVhbCBkaXJlY3RpdmVzLiBJZiB0aGUgY29tcG9uZW50IGRvZXMgbm90IHVzZSBhbnkgZGlyZWN0aXZlcywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICovXG5mdW5jdGlvbiBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsXG4gICAgcHJlZGljYXRlOiAoZGlyZWN0aXZlOiBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YSkgPT4gYm9vbGVhbik6IG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsIHtcbiAgY29uc3Qgd3JhcFR5cGUgPSBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlICE9PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QgP1xuICAgICAgZ2VuZXJhdGVGb3J3YXJkUmVmIDpcbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgY29uc3QgZGlyZWN0aXZlcyA9IG1ldGEuZGlyZWN0aXZlcy5maWx0ZXIocHJlZGljYXRlKTtcbiAgcmV0dXJuIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlcywgZGlyZWN0aXZlID0+IHtcbiAgICBjb25zdCBkaXJNZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlVXNlZERpcmVjdGl2ZU1ldGFkYXRhPigpO1xuICAgIGRpck1ldGEuc2V0KCd0eXBlJywgd3JhcFR5cGUoZGlyZWN0aXZlLnR5cGUpKTtcbiAgICBkaXJNZXRhLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwoZGlyZWN0aXZlLnNlbGVjdG9yKSk7XG4gICAgZGlyTWV0YS5zZXQoJ2lucHV0cycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLmlucHV0cywgby5saXRlcmFsKSk7XG4gICAgZGlyTWV0YS5zZXQoJ291dHB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5vdXRwdXRzLCBvLmxpdGVyYWwpKTtcbiAgICBkaXJNZXRhLnNldCgnZXhwb3J0QXMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5leHBvcnRBcywgby5saXRlcmFsKSk7XG4gICAgcmV0dXJuIGRpck1ldGEudG9MaXRlcmFsTWFwKCk7XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBwaXBlcyBhcyByZWdpc3RlcmVkIGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGEgaW50byBhbiBvYmplY3QgbGl0ZXJhbCwgd2hlcmUgdGhlXG4gKiBwaXBlJ3MgbmFtZSBpcyB1c2VkIGFzIGtleSBhbmQgYSByZWZlcmVuY2UgdG8gaXRzIHR5cGUgYXMgdmFsdWUuIElmIHRoZSBjb21wb25lbnQgZG9lcyBub3QgdXNlXG4gKiBhbnkgcGlwZXMsIHRoZW4gbnVsbCBpcyByZXR1cm5lZC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVVzZWRQaXBlTWV0YWRhdGEobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGlmIChtZXRhLnBpcGVzLnNpemUgPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IHdyYXBUeXBlID0gbWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0ID9cbiAgICAgIGdlbmVyYXRlRm9yd2FyZFJlZiA6XG4gICAgICAoZXhwcjogby5FeHByZXNzaW9uKSA9PiBleHByO1xuXG4gIGNvbnN0IGVudHJpZXMgPSBbXTtcbiAgZm9yIChjb25zdCBbbmFtZSwgcGlwZV0gb2YgbWV0YS5waXBlcykge1xuICAgIGVudHJpZXMucHVzaCh7a2V5OiBuYW1lLCB2YWx1ZTogd3JhcFR5cGUocGlwZSksIHF1b3RlZDogdHJ1ZX0pO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWxNYXAoZW50cmllcyk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRm9yd2FyZFJlZihleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmZvcndhcmRSZWYpLmNhbGxGbihbby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChleHByKV0pXSk7XG59XG4iXX0=