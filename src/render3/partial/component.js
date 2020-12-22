(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/component", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/directive", "@angular/compiler/src/render3/partial/util"], factory);
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
        var templateMap = compileTemplateDefinition(template);
        definitionMap.set('template', templateMap);
        definitionMap.set('styles', util_2.toOptionalLiteralArray(meta.styles, o.literal));
        definitionMap.set('directives', compileUsedDirectiveMetadata(meta));
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
    /**
     * Compiles the provided template into its partial definition.
     */
    function compileTemplateDefinition(template) {
        var templateMap = new util_1.DefinitionMap();
        var templateExpr = typeof template.template === 'string' ? o.literal(template.template) : template.template;
        templateMap.set('source', templateExpr);
        templateMap.set('isInline', o.literal(template.isInline));
        return templateMap.toLiteralMap();
    }
    /**
     * Compiles the directives as registered in the component metadata into an array literal of the
     * individual directives. If the component does not use any directives, then null is returned.
     */
    function compileUsedDirectiveMetadata(meta) {
        var wrapType = meta.wrapDirectivesAndPipesInClosure ?
            function (expr) { return o.fn([], [new o.ReturnStatement(expr)]); } :
            function (expr) { return expr; };
        return util_2.toOptionalLiteralArray(meta.directives, function (directive) {
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
        var wrapType = meta.wrapDirectivesAndPipesInClosure ?
            function (expr) { return o.fn([], [new o.ReturnStatement(expr)]); } :
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUVwRCx3RUFBcUQ7SUFFckQsZ0VBQTJDO0lBRzNDLDZFQUF5RDtJQUN6RCxtRUFBOEM7SUFHOUM7O09BRUc7SUFDSCxTQUFnQixtQ0FBbUMsQ0FDL0MsSUFBeUIsRUFBRSxRQUF3QjtRQUNyRCxJQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFbkUsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixJQUFNLElBQUksR0FBRyw4QkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV2QyxPQUFPLEVBQUMsVUFBVSxZQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUMsQ0FBQztJQUM1QixDQUFDO0lBUkQsa0ZBUUM7SUFFRDs7T0FFRztJQUNILFNBQWdCLDRCQUE0QixDQUFDLElBQXlCLEVBQUUsUUFBd0I7UUFFOUYsSUFBTSxhQUFhLEdBQ2Ysd0NBQTRCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsSUFBTSxXQUFXLEdBQUcseUJBQXlCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFeEQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFM0MsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsNkJBQXNCLENBQUMsSUFBSSxDQUFD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Q0FBQyxDQUFDO1lBQ2pFLFVBQUMsSUFBa0IsSUFBSyxPQUFBLElBQUksRUFBSixDQUFJLENBQUM7UUFFakMsSUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDOztZQUNuQixLQUEyQixJQUFBLEtBQUEsaUJBQUEsSUFBSSxDQUFDLEtBQUssQ0FBQSxnQkFBQSw0QkFBRTtnQkFBNUIsSUFBQSxLQUFBLDJCQUFZLEVBQVgsTUFBSSxRQUFBLEVBQUUsSUFBSSxRQUFBO2dCQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLE1BQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO2FBQ2hFOzs7Ozs7Ozs7UUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7Y3JlYXRlQ29tcG9uZW50VHlwZX0gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge1BhcnNlZFRlbXBsYXRlfSBmcm9tICcuLi92aWV3L3RlbXBsYXRlJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcbmltcG9ydCB7UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcblxuaW1wb3J0IHtjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwfSBmcm9tICcuL2RpcmVjdGl2ZSc7XG5pbXBvcnQge3RvT3B0aW9uYWxMaXRlcmFsQXJyYXl9IGZyb20gJy4vdXRpbCc7XG5cblxuLyoqXG4gKiBDb21waWxlIGEgY29tcG9uZW50IGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM0NvbXBvbmVudE1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSk6IFIzQ29tcG9uZW50RGVmIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZUNvbXBvbmVudERlZmluaXRpb25NYXAobWV0YSwgdGVtcGxhdGUpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVDb21wb25lbnRUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIGNvbXBvbmVudCBpbnRvIGEgYERlZmluaXRpb25NYXBgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50RGVmaW5pdGlvbk1hcChtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YT4gPVxuICAgICAgY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCB0ZW1wbGF0ZU1hcCA9IGNvbXBpbGVUZW1wbGF0ZURlZmluaXRpb24odGVtcGxhdGUpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlTWFwKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShtZXRhLnN0eWxlcywgby5saXRlcmFsKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdkaXJlY3RpdmVzJywgY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShtZXRhKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIGNvbXBpbGVVc2VkUGlwZU1ldGFkYXRhKG1ldGEpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdQcm92aWRlcnMnLCBtZXRhLnZpZXdQcm92aWRlcnMpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnYW5pbWF0aW9ucycsIG1ldGEuYW5pbWF0aW9ucyk7XG5cbiAgaWYgKG1ldGEuY2hhbmdlRGV0ZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NoYW5nZURldGVjdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSlcbiAgICAgICAgICAgIC5wcm9wKGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3lbbWV0YS5jaGFuZ2VEZXRlY3Rpb25dKSk7XG4gIH1cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZW5jYXBzdWxhdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5WaWV3RW5jYXBzdWxhdGlvbikucHJvcChjb3JlLlZpZXdFbmNhcHN1bGF0aW9uW21ldGEuZW5jYXBzdWxhdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5pbnRlcnBvbGF0aW9uICE9PSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdpbnRlcnBvbGF0aW9uJyxcbiAgICAgICAgby5saXRlcmFsQXJyKFtvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLnN0YXJ0KSwgby5saXRlcmFsKG1ldGEuaW50ZXJwb2xhdGlvbi5lbmQpXSkpO1xuICB9XG5cbiAgaWYgKHRlbXBsYXRlLnByZXNlcnZlV2hpdGVzcGFjZXMgPT09IHRydWUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHJlc2VydmVXaGl0ZXNwYWNlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcHJvdmlkZWQgdGVtcGxhdGUgaW50byBpdHMgcGFydGlhbCBkZWZpbml0aW9uLlxuICovXG5mdW5jdGlvbiBjb21waWxlVGVtcGxhdGVEZWZpbml0aW9uKHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCB0ZW1wbGF0ZU1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhWyd0ZW1wbGF0ZSddPigpO1xuICBjb25zdCB0ZW1wbGF0ZUV4cHIgPVxuICAgICAgdHlwZW9mIHRlbXBsYXRlLnRlbXBsYXRlID09PSAnc3RyaW5nJyA/IG8ubGl0ZXJhbCh0ZW1wbGF0ZS50ZW1wbGF0ZSkgOiB0ZW1wbGF0ZS50ZW1wbGF0ZTtcbiAgdGVtcGxhdGVNYXAuc2V0KCdzb3VyY2UnLCB0ZW1wbGF0ZUV4cHIpO1xuICB0ZW1wbGF0ZU1hcC5zZXQoJ2lzSW5saW5lJywgby5saXRlcmFsKHRlbXBsYXRlLmlzSW5saW5lKSk7XG4gIHJldHVybiB0ZW1wbGF0ZU1hcC50b0xpdGVyYWxNYXAoKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgZGlyZWN0aXZlcyBhcyByZWdpc3RlcmVkIGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGEgaW50byBhbiBhcnJheSBsaXRlcmFsIG9mIHRoZVxuICogaW5kaXZpZHVhbCBkaXJlY3RpdmVzLiBJZiB0aGUgY29tcG9uZW50IGRvZXMgbm90IHVzZSBhbnkgZGlyZWN0aXZlcywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICovXG5mdW5jdGlvbiBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IHdyYXBUeXBlID0gbWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlID9cbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZXhwcildKSA6XG4gICAgICAoZXhwcjogby5FeHByZXNzaW9uKSA9PiBleHByO1xuXG4gIHJldHVybiB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KG1ldGEuZGlyZWN0aXZlcywgZGlyZWN0aXZlID0+IHtcbiAgICBjb25zdCBkaXJNZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNVc2VkRGlyZWN0aXZlTWV0YWRhdGE+KCk7XG4gICAgZGlyTWV0YS5zZXQoJ3R5cGUnLCB3cmFwVHlwZShkaXJlY3RpdmUudHlwZSkpO1xuICAgIGRpck1ldGEuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChkaXJlY3RpdmUuc2VsZWN0b3IpKTtcbiAgICBkaXJNZXRhLnNldCgnaW5wdXRzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUuaW5wdXRzLCBvLmxpdGVyYWwpKTtcbiAgICBkaXJNZXRhLnNldCgnb3V0cHV0cycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLm91dHB1dHMsIG8ubGl0ZXJhbCkpO1xuICAgIGRpck1ldGEuc2V0KCdleHBvcnRBcycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLmV4cG9ydEFzLCBvLmxpdGVyYWwpKTtcbiAgICByZXR1cm4gZGlyTWV0YS50b0xpdGVyYWxNYXAoKTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHBpcGVzIGFzIHJlZ2lzdGVyZWQgaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YSBpbnRvIGFuIG9iamVjdCBsaXRlcmFsLCB3aGVyZSB0aGVcbiAqIHBpcGUncyBuYW1lIGlzIHVzZWQgYXMga2V5IGFuZCBhIHJlZmVyZW5jZSB0byBpdHMgdHlwZSBhcyB2YWx1ZS4gSWYgdGhlIGNvbXBvbmVudCBkb2VzIG5vdCB1c2VcbiAqIGFueSBwaXBlcywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICovXG5mdW5jdGlvbiBjb21waWxlVXNlZFBpcGVNZXRhZGF0YShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgaWYgKG1ldGEucGlwZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3Qgd3JhcFR5cGUgPSBtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUgP1xuICAgICAgKGV4cHI6IG8uRXhwcmVzc2lvbikgPT4gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChleHByKV0pIDpcbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgY29uc3QgZW50cmllcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBwaXBlXSBvZiBtZXRhLnBpcGVzKSB7XG4gICAgZW50cmllcy5wdXNoKHtrZXk6IG5hbWUsIHZhbHVlOiB3cmFwVHlwZShwaXBlKSwgcXVvdGVkOiB0cnVlfSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbn1cbiJdfQ==