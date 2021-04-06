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
        return { expression: expression, type: type, statements: [] };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtEQUFpRjtJQUNqRiwrRUFBb0Q7SUFHcEQsd0VBQXFEO0lBRXJELGdFQUEyQztJQUczQyw2RUFBeUQ7SUFDekQsbUVBQThDO0lBRzlDOztPQUVHO0lBQ0gsU0FBZ0IsbUNBQW1DLENBQy9DLElBQXlCLEVBQUUsUUFBd0I7UUFDckQsSUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRW5FLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztJQUM1QyxDQUFDO0lBUkQsa0ZBUUM7SUFFRDs7T0FFRztJQUNILFNBQWdCLDRCQUE0QixDQUFDLElBQXlCLEVBQUUsUUFBd0I7UUFFOUYsSUFBTSxhQUFhLEdBQ2Ysd0NBQTRCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUscUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUMvRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLEVBQUU7WUFDckIsYUFBYSxDQUFDLEdBQUcsQ0FB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QkFBbUMsQ0FBQyxDQUFDO1lBQzlFLGtCQUFrQixDQUFDLENBQUM7WUFDcEIsVUFBQyxJQUFrQixJQUFLLE9BQUEsSUFBSSxFQUFKLENBQUksQ0FBQztRQUVqQyxJQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7O1lBQ25CLEtBQTJCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsS0FBSyxDQUFBLGdCQUFBLDRCQUFFO2dCQUE1QixJQUFBLEtBQUEsMkJBQVksRUFBWCxNQUFJLFFBQUEsRUFBRSxJQUFJLFFBQUE7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsTUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7YUFDaEU7Ozs7Ozs7OztRQUNELE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFrQjtRQUM1QyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VGaWxlLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21wb25lbnRUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7UGFyc2VkVGVtcGxhdGV9IGZyb20gJy4uL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhLCBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9kaXJlY3RpdmUnO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbEFycmF5fSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGEsIHRlbXBsYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgY29tcG9uZW50IGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSk6XG4gICAgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhPiA9XG4gICAgICBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIGdldFRlbXBsYXRlRXhwcmVzc2lvbih0ZW1wbGF0ZSkpO1xuICBpZiAodGVtcGxhdGUuaXNJbmxpbmUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaXNJbmxpbmUnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkobWV0YS5zdHlsZXMsIG8ubGl0ZXJhbCkpO1xuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdjb21wb25lbnRzJyxcbiAgICAgIGNvbXBpbGVVc2VkRGlyZWN0aXZlTWV0YWRhdGEobWV0YSwgZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5pc0NvbXBvbmVudCA9PT0gdHJ1ZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdkaXJlY3RpdmVzJyxcbiAgICAgIGNvbXBpbGVVc2VkRGlyZWN0aXZlTWV0YWRhdGEobWV0YSwgZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5pc0NvbXBvbmVudCAhPT0gdHJ1ZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBjb21waWxlVXNlZFBpcGVNZXRhZGF0YShtZXRhKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UHJvdmlkZXJzJywgbWV0YS52aWV3UHJvdmlkZXJzKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2FuaW1hdGlvbnMnLCBtZXRhLmFuaW1hdGlvbnMpO1xuXG4gIGlmIChtZXRhLmNoYW5nZURldGVjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdjaGFuZ2VEZXRlY3Rpb24nLFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kpXG4gICAgICAgICAgICAucHJvcChjb3JlLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5W21ldGEuY2hhbmdlRGV0ZWN0aW9uXSkpO1xuICB9XG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gIT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2VuY2Fwc3VsYXRpb24nLFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuVmlld0VuY2Fwc3VsYXRpb24pLnByb3AoY29yZS5WaWV3RW5jYXBzdWxhdGlvblttZXRhLmVuY2Fwc3VsYXRpb25dKSk7XG4gIH1cbiAgaWYgKG1ldGEuaW50ZXJwb2xhdGlvbiAhPT0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnaW50ZXJwb2xhdGlvbicsXG4gICAgICAgIG8ubGl0ZXJhbEFycihbby5saXRlcmFsKG1ldGEuaW50ZXJwb2xhdGlvbi5zdGFydCksIG8ubGl0ZXJhbChtZXRhLmludGVycG9sYXRpb24uZW5kKV0pKTtcbiAgfVxuXG4gIGlmICh0ZW1wbGF0ZS5wcmVzZXJ2ZVdoaXRlc3BhY2VzID09PSB0cnVlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbmZ1bmN0aW9uIGdldFRlbXBsYXRlRXhwcmVzc2lvbih0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAodHlwZW9mIHRlbXBsYXRlLnRlbXBsYXRlID09PSAnc3RyaW5nJykge1xuICAgIGlmICh0ZW1wbGF0ZS5pc0lubGluZSkge1xuICAgICAgLy8gVGhlIHRlbXBsYXRlIGlzIGlubGluZSBidXQgbm90IGEgc2ltcGxlIGxpdGVyYWwgc3RyaW5nLCBzbyBnaXZlIHVwIHdpdGggdHJ5aW5nIHRvXG4gICAgICAvLyBzb3VyY2UtbWFwIGl0IGFuZCBqdXN0IHJldHVybiBhIHNpbXBsZSBsaXRlcmFsIGhlcmUuXG4gICAgICByZXR1cm4gby5saXRlcmFsKHRlbXBsYXRlLnRlbXBsYXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIHRlbXBsYXRlIGlzIGV4dGVybmFsIHNvIHdlIG11c3Qgc3ludGhlc2l6ZSBhbiBleHByZXNzaW9uIG5vZGUgd2l0aCB0aGUgYXBwcm9wcmlhdGVcbiAgICAgIC8vIHNvdXJjZS1zcGFuLlxuICAgICAgY29uc3QgY29udGVudHMgPSB0ZW1wbGF0ZS50ZW1wbGF0ZTtcbiAgICAgIGNvbnN0IGZpbGUgPSBuZXcgUGFyc2VTb3VyY2VGaWxlKGNvbnRlbnRzLCB0ZW1wbGF0ZS50ZW1wbGF0ZVVybCk7XG4gICAgICBjb25zdCBzdGFydCA9IG5ldyBQYXJzZUxvY2F0aW9uKGZpbGUsIDAsIDAsIDApO1xuICAgICAgY29uc3QgZW5kID0gY29tcHV0ZUVuZExvY2F0aW9uKGZpbGUsIGNvbnRlbnRzKTtcbiAgICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQpO1xuICAgICAgcmV0dXJuIG8ubGl0ZXJhbChjb250ZW50cywgbnVsbCwgc3Bhbik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIFRoZSB0ZW1wbGF0ZSBpcyBpbmxpbmUgc28gd2UgY2FuIGp1c3QgcmV1c2UgdGhlIGN1cnJlbnQgZXhwcmVzc2lvbiBub2RlLlxuICAgIHJldHVybiB0ZW1wbGF0ZS50ZW1wbGF0ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21wdXRlRW5kTG9jYXRpb24oZmlsZTogUGFyc2VTb3VyY2VGaWxlLCBjb250ZW50czogc3RyaW5nKTogUGFyc2VMb2NhdGlvbiB7XG4gIGNvbnN0IGxlbmd0aCA9IGNvbnRlbnRzLmxlbmd0aDtcbiAgbGV0IGxpbmVTdGFydCA9IDA7XG4gIGxldCBsYXN0TGluZVN0YXJ0ID0gMDtcbiAgbGV0IGxpbmUgPSAwO1xuICBkbyB7XG4gICAgbGluZVN0YXJ0ID0gY29udGVudHMuaW5kZXhPZignXFxuJywgbGFzdExpbmVTdGFydCk7XG4gICAgaWYgKGxpbmVTdGFydCAhPT0gLTEpIHtcbiAgICAgIGxhc3RMaW5lU3RhcnQgPSBsaW5lU3RhcnQgKyAxO1xuICAgICAgbGluZSsrO1xuICAgIH1cbiAgfSB3aGlsZSAobGluZVN0YXJ0ICE9PSAtMSk7XG5cbiAgcmV0dXJuIG5ldyBQYXJzZUxvY2F0aW9uKGZpbGUsIGxlbmd0aCwgbGluZSwgbGVuZ3RoIC0gbGFzdExpbmVTdGFydCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGRpcmVjdGl2ZXMgYXMgcmVnaXN0ZXJlZCBpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhIGludG8gYW4gYXJyYXkgbGl0ZXJhbCBvZiB0aGVcbiAqIGluZGl2aWR1YWwgZGlyZWN0aXZlcy4gSWYgdGhlIGNvbXBvbmVudCBkb2VzIG5vdCB1c2UgYW55IGRpcmVjdGl2ZXMsIHRoZW4gbnVsbCBpcyByZXR1cm5lZC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLFxuICAgIHByZWRpY2F0ZTogKGRpcmVjdGl2ZTogUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGEpID0+IGJvb2xlYW4pOiBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IHdyYXBUeXBlID0gbWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0ID9cbiAgICAgIGdlbmVyYXRlRm9yd2FyZFJlZiA6XG4gICAgICAoZXhwcjogby5FeHByZXNzaW9uKSA9PiBleHByO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXMgPSBtZXRhLmRpcmVjdGl2ZXMuZmlsdGVyKHByZWRpY2F0ZSk7XG4gIHJldHVybiB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZXMsIGRpcmVjdGl2ZSA9PiB7XG4gICAgY29uc3QgZGlyTWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVVzZWREaXJlY3RpdmVNZXRhZGF0YT4oKTtcbiAgICBkaXJNZXRhLnNldCgndHlwZScsIHdyYXBUeXBlKGRpcmVjdGl2ZS50eXBlKSk7XG4gICAgZGlyTWV0YS5zZXQoJ3NlbGVjdG9yJywgby5saXRlcmFsKGRpcmVjdGl2ZS5zZWxlY3RvcikpO1xuICAgIGRpck1ldGEuc2V0KCdpbnB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5pbnB1dHMsIG8ubGl0ZXJhbCkpO1xuICAgIGRpck1ldGEuc2V0KCdvdXRwdXRzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUub3V0cHV0cywgby5saXRlcmFsKSk7XG4gICAgZGlyTWV0YS5zZXQoJ2V4cG9ydEFzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUuZXhwb3J0QXMsIG8ubGl0ZXJhbCkpO1xuICAgIHJldHVybiBkaXJNZXRhLnRvTGl0ZXJhbE1hcCgpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcGlwZXMgYXMgcmVnaXN0ZXJlZCBpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhIGludG8gYW4gb2JqZWN0IGxpdGVyYWwsIHdoZXJlIHRoZVxuICogcGlwZSdzIG5hbWUgaXMgdXNlZCBhcyBrZXkgYW5kIGEgcmVmZXJlbmNlIHRvIGl0cyB0eXBlIGFzIHZhbHVlLiBJZiB0aGUgY29tcG9uZW50IGRvZXMgbm90IHVzZVxuICogYW55IHBpcGVzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVVc2VkUGlwZU1ldGFkYXRhKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBpZiAobWV0YS5waXBlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCB3cmFwVHlwZSA9IG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUgIT09IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCA/XG4gICAgICBnZW5lcmF0ZUZvcndhcmRSZWYgOlxuICAgICAgKGV4cHI6IG8uRXhwcmVzc2lvbikgPT4gZXhwcjtcblxuICBjb25zdCBlbnRyaWVzID0gW107XG4gIGZvciAoY29uc3QgW25hbWUsIHBpcGVdIG9mIG1ldGEucGlwZXMpIHtcbiAgICBlbnRyaWVzLnB1c2goe2tleTogbmFtZSwgdmFsdWU6IHdyYXBUeXBlKHBpcGUpLCBxdW90ZWQ6IHRydWV9KTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUZvcndhcmRSZWYoZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5mb3J3YXJkUmVmKS5jYWxsRm4oW28uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZXhwcildKV0pO1xufVxuIl19