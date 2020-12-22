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
        var wrapType = meta.wrapDirectivesAndPipesInClosure ? generateForwardRef : function (expr) { return expr; };
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
        var wrapType = meta.wrapDirectivesAndPipesInClosure ? generateForwardRef : function (expr) { return expr; };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUVwRCx3RUFBcUQ7SUFFckQsZ0VBQTJDO0lBRzNDLDZFQUF5RDtJQUN6RCxtRUFBOEM7SUFHOUM7O09BRUc7SUFDSCxTQUFnQixtQ0FBbUMsQ0FDL0MsSUFBeUIsRUFBRSxRQUF3QjtRQUNyRCxJQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFbkUsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixJQUFNLElBQUksR0FBRyw4QkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV2QyxPQUFPLEVBQUMsVUFBVSxZQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUMsQ0FBQztJQUM1QixDQUFDO0lBUkQsa0ZBUUM7SUFFRDs7T0FFRztJQUNILFNBQWdCLDRCQUE0QixDQUFDLElBQXlCLEVBQUUsUUFBd0I7UUFFOUYsSUFBTSxhQUFhLEdBQ2Ysd0NBQTRCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsSUFBTSxXQUFXLEdBQUcseUJBQXlCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFeEQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFM0MsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsNkJBQXNCLENBQUMsSUFBSSxDQUFD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QUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLE1BQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO2FBQ2hFOzs7Ozs7Ozs7UUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELFNBQVMsa0JBQWtCLENBQUMsSUFBa0I7UUFDNUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzQ29tcG9uZW50RGVmLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21wb25lbnRUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7UGFyc2VkVGVtcGxhdGV9IGZyb20gJy4uL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuaW1wb3J0IHtSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuXG5pbXBvcnQge2NyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXB9IGZyb20gJy4vZGlyZWN0aXZlJztcbmltcG9ydCB7dG9PcHRpb25hbExpdGVyYWxBcnJheX0gZnJvbSAnLi91dGlsJztcblxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlKTogUjNDb21wb25lbnREZWYge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlQ29tcG9uZW50RGVmaW5pdGlvbk1hcChtZXRhLCB0ZW1wbGF0ZSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlQ29tcG9uZW50KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgY29tcG9uZW50IGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSk6XG4gICAgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhPiA9XG4gICAgICBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IHRlbXBsYXRlTWFwID0gY29tcGlsZVRlbXBsYXRlRGVmaW5pdGlvbih0ZW1wbGF0ZSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVNYXApO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KG1ldGEuc3R5bGVzLCBvLmxpdGVyYWwpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RpcmVjdGl2ZXMnLCBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGEpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3BpcGVzJywgY29tcGlsZVVzZWRQaXBlTWV0YWRhdGEobWV0YSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmlld1Byb3ZpZGVycycsIG1ldGEudmlld1Byb3ZpZGVycyk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdhbmltYXRpb25zJywgbWV0YS5hbmltYXRpb25zKTtcblxuICBpZiAobWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY2hhbmdlRGV0ZWN0aW9uJyxcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5KVxuICAgICAgICAgICAgLnByb3AoY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneVttZXRhLmNoYW5nZURldGVjdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdlbmNhcHN1bGF0aW9uJyxcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLlZpZXdFbmNhcHN1bGF0aW9uKS5wcm9wKGNvcmUuVmlld0VuY2Fwc3VsYXRpb25bbWV0YS5lbmNhcHN1bGF0aW9uXSkpO1xuICB9XG4gIGlmIChtZXRhLmludGVycG9sYXRpb24gIT09IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2ludGVycG9sYXRpb24nLFxuICAgICAgICBvLmxpdGVyYWxBcnIoW28ubGl0ZXJhbChtZXRhLmludGVycG9sYXRpb24uc3RhcnQpLCBvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLmVuZCldKSk7XG4gIH1cblxuICBpZiAodGVtcGxhdGUucHJlc2VydmVXaGl0ZXNwYWNlcyA9PT0gdHJ1ZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwcmVzZXJ2ZVdoaXRlc3BhY2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBwcm92aWRlZCB0ZW1wbGF0ZSBpbnRvIGl0cyBwYXJ0aWFsIGRlZmluaXRpb24uXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVUZW1wbGF0ZURlZmluaXRpb24odGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlKTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IHRlbXBsYXRlTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGFbJ3RlbXBsYXRlJ10+KCk7XG4gIGNvbnN0IHRlbXBsYXRlRXhwciA9XG4gICAgICB0eXBlb2YgdGVtcGxhdGUudGVtcGxhdGUgPT09ICdzdHJpbmcnID8gby5saXRlcmFsKHRlbXBsYXRlLnRlbXBsYXRlKSA6IHRlbXBsYXRlLnRlbXBsYXRlO1xuICB0ZW1wbGF0ZU1hcC5zZXQoJ3NvdXJjZScsIHRlbXBsYXRlRXhwcik7XG4gIHRlbXBsYXRlTWFwLnNldCgnaXNJbmxpbmUnLCBvLmxpdGVyYWwodGVtcGxhdGUuaXNJbmxpbmUpKTtcbiAgcmV0dXJuIHRlbXBsYXRlTWFwLnRvTGl0ZXJhbE1hcCgpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBkaXJlY3RpdmVzIGFzIHJlZ2lzdGVyZWQgaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YSBpbnRvIGFuIGFycmF5IGxpdGVyYWwgb2YgdGhlXG4gKiBpbmRpdmlkdWFsIGRpcmVjdGl2ZXMuIElmIHRoZSBjb21wb25lbnQgZG9lcyBub3QgdXNlIGFueSBkaXJlY3RpdmVzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVVc2VkRGlyZWN0aXZlTWV0YWRhdGEobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSk6IG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsIHtcbiAgY29uc3Qgd3JhcFR5cGUgPVxuICAgICAgbWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlID8gZ2VuZXJhdGVGb3J3YXJkUmVmIDogKGV4cHI6IG8uRXhwcmVzc2lvbikgPT4gZXhwcjtcblxuICByZXR1cm4gdG9PcHRpb25hbExpdGVyYWxBcnJheShtZXRhLmRpcmVjdGl2ZXMsIGRpcmVjdGl2ZSA9PiB7XG4gICAgY29uc3QgZGlyTWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhPigpO1xuICAgIGRpck1ldGEuc2V0KCd0eXBlJywgd3JhcFR5cGUoZGlyZWN0aXZlLnR5cGUpKTtcbiAgICBkaXJNZXRhLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwoZGlyZWN0aXZlLnNlbGVjdG9yKSk7XG4gICAgZGlyTWV0YS5zZXQoJ2lucHV0cycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLmlucHV0cywgby5saXRlcmFsKSk7XG4gICAgZGlyTWV0YS5zZXQoJ291dHB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5vdXRwdXRzLCBvLmxpdGVyYWwpKTtcbiAgICBkaXJNZXRhLnNldCgnZXhwb3J0QXMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5leHBvcnRBcywgby5saXRlcmFsKSk7XG4gICAgcmV0dXJuIGRpck1ldGEudG9MaXRlcmFsTWFwKCk7XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBwaXBlcyBhcyByZWdpc3RlcmVkIGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGEgaW50byBhbiBvYmplY3QgbGl0ZXJhbCwgd2hlcmUgdGhlXG4gKiBwaXBlJ3MgbmFtZSBpcyB1c2VkIGFzIGtleSBhbmQgYSByZWZlcmVuY2UgdG8gaXRzIHR5cGUgYXMgdmFsdWUuIElmIHRoZSBjb21wb25lbnQgZG9lcyBub3QgdXNlXG4gKiBhbnkgcGlwZXMsIHRoZW4gbnVsbCBpcyByZXR1cm5lZC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVVzZWRQaXBlTWV0YWRhdGEobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGlmIChtZXRhLnBpcGVzLnNpemUgPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IHdyYXBUeXBlID1cbiAgICAgIG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSA/IGdlbmVyYXRlRm9yd2FyZFJlZiA6IChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgY29uc3QgZW50cmllcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBwaXBlXSBvZiBtZXRhLnBpcGVzKSB7XG4gICAgZW50cmllcy5wdXNoKHtrZXk6IG5hbWUsIHZhbHVlOiB3cmFwVHlwZShwaXBlKSwgcXVvdGVkOiB0cnVlfSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVGb3J3YXJkUmVmKGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuZm9yd2FyZFJlZikuY2FsbEZuKFtvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGV4cHIpXSldKTtcbn1cbiJdfQ==