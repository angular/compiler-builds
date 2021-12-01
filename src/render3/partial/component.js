(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/component", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/directive", "@angular/compiler/src/render3/partial/util"], factory);
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
    var util_1 = require("@angular/compiler/src/render3/util");
    var compiler_1 = require("@angular/compiler/src/render3/view/compiler");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    var directive_1 = require("@angular/compiler/src/render3/partial/directive");
    var util_3 = require("@angular/compiler/src/render3/partial/util");
    /**
     * Compile a component declaration defined by the `R3ComponentMetadata`.
     */
    function compileDeclareComponentFromMetadata(meta, template, additionalTemplateInfo) {
        var definitionMap = createComponentDefinitionMap(meta, template, additionalTemplateInfo);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareComponent).callFn([definitionMap.toLiteralMap()]);
        var type = compiler_1.createComponentType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareComponentFromMetadata = compileDeclareComponentFromMetadata;
    /**
     * Gathers the declaration fields for a component into a `DefinitionMap`.
     */
    function createComponentDefinitionMap(meta, template, templateInfo) {
        var definitionMap = directive_1.createDirectiveDefinitionMap(meta);
        definitionMap.set('template', getTemplateExpression(template, templateInfo));
        if (templateInfo.isInline) {
            definitionMap.set('isInline', o.literal(true));
        }
        definitionMap.set('styles', util_3.toOptionalLiteralArray(meta.styles, o.literal));
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
    function getTemplateExpression(template, templateInfo) {
        // If the template has been defined using a direct literal, we use that expression directly
        // without any modifications. This is ensures proper source mapping from the partially
        // compiled code to the source file declaring the template. Note that this does not capture
        // template literals referenced indirectly through an identifier.
        if (templateInfo.inlineTemplateLiteralExpression !== null) {
            return templateInfo.inlineTemplateLiteralExpression;
        }
        // If the template is defined inline but not through a literal, the template has been resolved
        // through static interpretation. We create a literal but cannot provide any source span. Note
        // that we cannot use the expression defining the template because the linker expects the template
        // to be defined as a literal in the declaration.
        if (templateInfo.isInline) {
            return o.literal(templateInfo.content, null, null);
        }
        // The template is external so we must synthesize an expression node with
        // the appropriate source-span.
        var contents = templateInfo.content;
        var file = new parse_util_1.ParseSourceFile(contents, templateInfo.sourceUrl);
        var start = new parse_util_1.ParseLocation(file, 0, 0, 0);
        var end = computeEndLocation(file, contents);
        var span = new parse_util_1.ParseSourceSpan(start, end);
        return o.literal(contents, null, span);
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
            util_1.generateForwardRef :
            function (expr) { return expr; };
        var directives = meta.directives.filter(predicate);
        return util_3.toOptionalLiteralArray(directives, function (directive) {
            var dirMeta = new util_2.DefinitionMap();
            dirMeta.set('type', wrapType(directive.type));
            dirMeta.set('selector', o.literal(directive.selector));
            dirMeta.set('inputs', util_3.toOptionalLiteralArray(directive.inputs, o.literal));
            dirMeta.set('outputs', util_3.toOptionalLiteralArray(directive.outputs, o.literal));
            dirMeta.set('exportAs', util_3.toOptionalLiteralArray(directive.exportAs, o.literal));
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
            util_1.generateForwardRef :
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtEQUFpRjtJQUNqRiwrRUFBb0Q7SUFDcEQsMkRBQWlFO0lBRWpFLHdFQUFxRDtJQUVyRCxnRUFBMkM7SUFHM0MsNkVBQXlEO0lBQ3pELG1FQUE4QztJQStCOUM7O09BRUc7SUFDSCxTQUFnQixtQ0FBbUMsQ0FDL0MsSUFBeUIsRUFBRSxRQUF3QixFQUNuRCxzQkFBb0Q7UUFDdEQsSUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBRTNGLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztJQUM1QyxDQUFDO0lBVEQsa0ZBU0M7SUFFRDs7T0FFRztJQUNILFNBQWdCLDRCQUE0QixDQUN4QyxJQUF5QixFQUFFLFFBQXdCLEVBQ25ELFlBQTBDO1FBQzVDLElBQU0sYUFBYSxHQUNmLHdDQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FB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QixDQUFDLElBQXlCOztRQUN4RCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtZQUN6QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixtQkFBbUMsQ0FBQyxDQUFDO1lBQzlFLHlCQUFrQixDQUFDLENBQUM7WUFDcEIsVUFBQyxJQUFrQixJQUFLLE9BQUEsSUFBSSxFQUFKLENBQUksQ0FBQztRQUVqQyxJQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7O1lBQ25CLEtBQTJCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsS0FBSyxDQUFBLGdCQUFBLDRCQUFFO2dCQUE1QixJQUFBLEtBQUEsMkJBQVksRUFBWCxNQUFJLFFBQUEsRUFBRSxJQUFJLFFBQUE7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsTUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7YUFDaEU7Ozs7Ozs7OztRQUNELE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlTG9jYXRpb24sIFBhcnNlU291cmNlRmlsZSwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Z2VuZXJhdGVGb3J3YXJkUmVmLCBSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21wb25lbnRUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7UGFyc2VkVGVtcGxhdGV9IGZyb20gJy4uL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhLCBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9kaXJlY3RpdmUnO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbEFycmF5fSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8ge1xuICAvKipcbiAgICogVGhlIHN0cmluZyBjb250ZW50cyBvZiB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgaXMgdGhlIFwibG9naWNhbFwiIHRlbXBsYXRlIHN0cmluZywgYWZ0ZXIgZXhwYW5zaW9uIG9mIGFueSBlc2NhcGVkIGNoYXJhY3RlcnMgKGZvciBpbmxpbmVcbiAgICogdGVtcGxhdGVzKS4gVGhpcyBtYXkgZGlmZmVyIGZyb20gdGhlIGFjdHVhbCB0ZW1wbGF0ZSBieXRlcyBhcyB0aGV5IGFwcGVhciBpbiB0aGUgLnRzIGZpbGUuXG4gICAqL1xuICBjb250ZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEEgZnVsbCBwYXRoIHRvIHRoZSBmaWxlIHdoaWNoIGNvbnRhaW5zIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVGhpcyBjYW4gYmUgZWl0aGVyIHRoZSBvcmlnaW5hbCAudHMgZmlsZSBpZiB0aGUgdGVtcGxhdGUgaXMgaW5saW5lLCBvciB0aGUgLmh0bWwgZmlsZSBpZiBhblxuICAgKiBleHRlcm5hbCBmaWxlIHdhcyB1c2VkLlxuICAgKi9cbiAgc291cmNlVXJsOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIHRlbXBsYXRlIHdhcyBpbmxpbmUgKHVzaW5nIGB0ZW1wbGF0ZWApIG9yIGV4dGVybmFsICh1c2luZyBgdGVtcGxhdGVVcmxgKS5cbiAgICovXG4gIGlzSW5saW5lOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBJZiB0aGUgdGVtcGxhdGUgd2FzIGRlZmluZWQgaW5saW5lIGJ5IGEgZGlyZWN0IHN0cmluZyBsaXRlcmFsLCB0aGVuIHRoaXMgaXMgdGhhdCBsaXRlcmFsXG4gICAqIGV4cHJlc3Npb24uIE90aGVyd2lzZSBgbnVsbGAsIGlmIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IGRlZmluZWQgaW5saW5lIG9yIHdhcyBub3QgYSBsaXRlcmFsLlxuICAgKi9cbiAgaW5saW5lVGVtcGxhdGVMaXRlcmFsRXhwcmVzc2lvbjogby5FeHByZXNzaW9ufG51bGw7XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUsXG4gICAgYWRkaXRpb25hbFRlbXBsYXRlSW5mbzogRGVjbGFyZUNvbXBvbmVudFRlbXBsYXRlSW5mbyk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZUNvbXBvbmVudERlZmluaXRpb25NYXAobWV0YSwgdGVtcGxhdGUsIGFkZGl0aW9uYWxUZW1wbGF0ZUluZm8pO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVDb21wb25lbnRUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBjb21wb25lbnQgaW50byBhIGBEZWZpbml0aW9uTWFwYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudERlZmluaXRpb25NYXAoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlLFxuICAgIHRlbXBsYXRlSW5mbzogRGVjbGFyZUNvbXBvbmVudFRlbXBsYXRlSW5mbyk6IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YT4gPVxuICAgICAgY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCBnZXRUZW1wbGF0ZUV4cHJlc3Npb24odGVtcGxhdGUsIHRlbXBsYXRlSW5mbykpO1xuICBpZiAodGVtcGxhdGVJbmZvLmlzSW5saW5lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lzSW5saW5lJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KG1ldGEuc3R5bGVzLCBvLmxpdGVyYWwpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnY29tcG9uZW50cycsXG4gICAgICBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGEsIGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUuaXNDb21wb25lbnQgPT09IHRydWUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnZGlyZWN0aXZlcycsXG4gICAgICBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGEsIGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUuaXNDb21wb25lbnQgIT09IHRydWUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3BpcGVzJywgY29tcGlsZVVzZWRQaXBlTWV0YWRhdGEobWV0YSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmlld1Byb3ZpZGVycycsIG1ldGEudmlld1Byb3ZpZGVycyk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdhbmltYXRpb25zJywgbWV0YS5hbmltYXRpb25zKTtcblxuICBpZiAobWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY2hhbmdlRGV0ZWN0aW9uJyxcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5KVxuICAgICAgICAgICAgLnByb3AoY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneVttZXRhLmNoYW5nZURldGVjdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdlbmNhcHN1bGF0aW9uJyxcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLlZpZXdFbmNhcHN1bGF0aW9uKS5wcm9wKGNvcmUuVmlld0VuY2Fwc3VsYXRpb25bbWV0YS5lbmNhcHN1bGF0aW9uXSkpO1xuICB9XG4gIGlmIChtZXRhLmludGVycG9sYXRpb24gIT09IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2ludGVycG9sYXRpb24nLFxuICAgICAgICBvLmxpdGVyYWxBcnIoW28ubGl0ZXJhbChtZXRhLmludGVycG9sYXRpb24uc3RhcnQpLCBvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLmVuZCldKSk7XG4gIH1cblxuICBpZiAodGVtcGxhdGUucHJlc2VydmVXaGl0ZXNwYWNlcyA9PT0gdHJ1ZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwcmVzZXJ2ZVdoaXRlc3BhY2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG5mdW5jdGlvbiBnZXRUZW1wbGF0ZUV4cHJlc3Npb24oXG4gICAgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlLCB0ZW1wbGF0ZUluZm86IERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8pOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJZiB0aGUgdGVtcGxhdGUgaGFzIGJlZW4gZGVmaW5lZCB1c2luZyBhIGRpcmVjdCBsaXRlcmFsLCB3ZSB1c2UgdGhhdCBleHByZXNzaW9uIGRpcmVjdGx5XG4gIC8vIHdpdGhvdXQgYW55IG1vZGlmaWNhdGlvbnMuIFRoaXMgaXMgZW5zdXJlcyBwcm9wZXIgc291cmNlIG1hcHBpbmcgZnJvbSB0aGUgcGFydGlhbGx5XG4gIC8vIGNvbXBpbGVkIGNvZGUgdG8gdGhlIHNvdXJjZSBmaWxlIGRlY2xhcmluZyB0aGUgdGVtcGxhdGUuIE5vdGUgdGhhdCB0aGlzIGRvZXMgbm90IGNhcHR1cmVcbiAgLy8gdGVtcGxhdGUgbGl0ZXJhbHMgcmVmZXJlbmNlZCBpbmRpcmVjdGx5IHRocm91Z2ggYW4gaWRlbnRpZmllci5cbiAgaWYgKHRlbXBsYXRlSW5mby5pbmxpbmVUZW1wbGF0ZUxpdGVyYWxFeHByZXNzaW9uICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlSW5mby5pbmxpbmVUZW1wbGF0ZUxpdGVyYWxFeHByZXNzaW9uO1xuICB9XG5cbiAgLy8gSWYgdGhlIHRlbXBsYXRlIGlzIGRlZmluZWQgaW5saW5lIGJ1dCBub3QgdGhyb3VnaCBhIGxpdGVyYWwsIHRoZSB0ZW1wbGF0ZSBoYXMgYmVlbiByZXNvbHZlZFxuICAvLyB0aHJvdWdoIHN0YXRpYyBpbnRlcnByZXRhdGlvbi4gV2UgY3JlYXRlIGEgbGl0ZXJhbCBidXQgY2Fubm90IHByb3ZpZGUgYW55IHNvdXJjZSBzcGFuLiBOb3RlXG4gIC8vIHRoYXQgd2UgY2Fubm90IHVzZSB0aGUgZXhwcmVzc2lvbiBkZWZpbmluZyB0aGUgdGVtcGxhdGUgYmVjYXVzZSB0aGUgbGlua2VyIGV4cGVjdHMgdGhlIHRlbXBsYXRlXG4gIC8vIHRvIGJlIGRlZmluZWQgYXMgYSBsaXRlcmFsIGluIHRoZSBkZWNsYXJhdGlvbi5cbiAgaWYgKHRlbXBsYXRlSW5mby5pc0lubGluZSkge1xuICAgIHJldHVybiBvLmxpdGVyYWwodGVtcGxhdGVJbmZvLmNvbnRlbnQsIG51bGwsIG51bGwpO1xuICB9XG5cbiAgLy8gVGhlIHRlbXBsYXRlIGlzIGV4dGVybmFsIHNvIHdlIG11c3Qgc3ludGhlc2l6ZSBhbiBleHByZXNzaW9uIG5vZGUgd2l0aFxuICAvLyB0aGUgYXBwcm9wcmlhdGUgc291cmNlLXNwYW4uXG4gIGNvbnN0IGNvbnRlbnRzID0gdGVtcGxhdGVJbmZvLmNvbnRlbnQ7XG4gIGNvbnN0IGZpbGUgPSBuZXcgUGFyc2VTb3VyY2VGaWxlKGNvbnRlbnRzLCB0ZW1wbGF0ZUluZm8uc291cmNlVXJsKTtcbiAgY29uc3Qgc3RhcnQgPSBuZXcgUGFyc2VMb2NhdGlvbihmaWxlLCAwLCAwLCAwKTtcbiAgY29uc3QgZW5kID0gY29tcHV0ZUVuZExvY2F0aW9uKGZpbGUsIGNvbnRlbnRzKTtcbiAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCk7XG4gIHJldHVybiBvLmxpdGVyYWwoY29udGVudHMsIG51bGwsIHNwYW4pO1xufVxuXG5mdW5jdGlvbiBjb21wdXRlRW5kTG9jYXRpb24oZmlsZTogUGFyc2VTb3VyY2VGaWxlLCBjb250ZW50czogc3RyaW5nKTogUGFyc2VMb2NhdGlvbiB7XG4gIGNvbnN0IGxlbmd0aCA9IGNvbnRlbnRzLmxlbmd0aDtcbiAgbGV0IGxpbmVTdGFydCA9IDA7XG4gIGxldCBsYXN0TGluZVN0YXJ0ID0gMDtcbiAgbGV0IGxpbmUgPSAwO1xuICBkbyB7XG4gICAgbGluZVN0YXJ0ID0gY29udGVudHMuaW5kZXhPZignXFxuJywgbGFzdExpbmVTdGFydCk7XG4gICAgaWYgKGxpbmVTdGFydCAhPT0gLTEpIHtcbiAgICAgIGxhc3RMaW5lU3RhcnQgPSBsaW5lU3RhcnQgKyAxO1xuICAgICAgbGluZSsrO1xuICAgIH1cbiAgfSB3aGlsZSAobGluZVN0YXJ0ICE9PSAtMSk7XG5cbiAgcmV0dXJuIG5ldyBQYXJzZUxvY2F0aW9uKGZpbGUsIGxlbmd0aCwgbGluZSwgbGVuZ3RoIC0gbGFzdExpbmVTdGFydCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGRpcmVjdGl2ZXMgYXMgcmVnaXN0ZXJlZCBpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhIGludG8gYW4gYXJyYXkgbGl0ZXJhbCBvZiB0aGVcbiAqIGluZGl2aWR1YWwgZGlyZWN0aXZlcy4gSWYgdGhlIGNvbXBvbmVudCBkb2VzIG5vdCB1c2UgYW55IGRpcmVjdGl2ZXMsIHRoZW4gbnVsbCBpcyByZXR1cm5lZC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLFxuICAgIHByZWRpY2F0ZTogKGRpcmVjdGl2ZTogUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGEpID0+IGJvb2xlYW4pOiBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IHdyYXBUeXBlID0gbWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0ID9cbiAgICAgIGdlbmVyYXRlRm9yd2FyZFJlZiA6XG4gICAgICAoZXhwcjogby5FeHByZXNzaW9uKSA9PiBleHByO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXMgPSBtZXRhLmRpcmVjdGl2ZXMuZmlsdGVyKHByZWRpY2F0ZSk7XG4gIHJldHVybiB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZXMsIGRpcmVjdGl2ZSA9PiB7XG4gICAgY29uc3QgZGlyTWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVVzZWREaXJlY3RpdmVNZXRhZGF0YT4oKTtcbiAgICBkaXJNZXRhLnNldCgndHlwZScsIHdyYXBUeXBlKGRpcmVjdGl2ZS50eXBlKSk7XG4gICAgZGlyTWV0YS5zZXQoJ3NlbGVjdG9yJywgby5saXRlcmFsKGRpcmVjdGl2ZS5zZWxlY3RvcikpO1xuICAgIGRpck1ldGEuc2V0KCdpbnB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5pbnB1dHMsIG8ubGl0ZXJhbCkpO1xuICAgIGRpck1ldGEuc2V0KCdvdXRwdXRzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUub3V0cHV0cywgby5saXRlcmFsKSk7XG4gICAgZGlyTWV0YS5zZXQoJ2V4cG9ydEFzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUuZXhwb3J0QXMsIG8ubGl0ZXJhbCkpO1xuICAgIHJldHVybiBkaXJNZXRhLnRvTGl0ZXJhbE1hcCgpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcGlwZXMgYXMgcmVnaXN0ZXJlZCBpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhIGludG8gYW4gb2JqZWN0IGxpdGVyYWwsIHdoZXJlIHRoZVxuICogcGlwZSdzIG5hbWUgaXMgdXNlZCBhcyBrZXkgYW5kIGEgcmVmZXJlbmNlIHRvIGl0cyB0eXBlIGFzIHZhbHVlLiBJZiB0aGUgY29tcG9uZW50IGRvZXMgbm90IHVzZVxuICogYW55IHBpcGVzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVVc2VkUGlwZU1ldGFkYXRhKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBpZiAobWV0YS5waXBlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCB3cmFwVHlwZSA9IG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUgIT09IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCA/XG4gICAgICBnZW5lcmF0ZUZvcndhcmRSZWYgOlxuICAgICAgKGV4cHI6IG8uRXhwcmVzc2lvbikgPT4gZXhwcjtcblxuICBjb25zdCBlbnRyaWVzID0gW107XG4gIGZvciAoY29uc3QgW25hbWUsIHBpcGVdIG9mIG1ldGEucGlwZXMpIHtcbiAgICBlbnRyaWVzLnB1c2goe2tleTogbmFtZSwgdmFsdWU6IHdyYXBUeXBlKHBpcGUpLCBxdW90ZWQ6IHRydWV9KTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xufVxuIl19