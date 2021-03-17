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
    function compileUsedDirectiveMetadata(meta) {
        var wrapType = meta.declarationListEmitMode !== 0 /* Direct */ ?
            generateForwardRef :
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtEQUFpRjtJQUNqRiwrRUFBb0Q7SUFHcEQsd0VBQXFEO0lBRXJELGdFQUEyQztJQUczQyw2RUFBeUQ7SUFDekQsbUVBQThDO0lBRzlDOztPQUVHO0lBQ0gsU0FBZ0IsbUNBQW1DLENBQy9DLElBQXlCLEVBQUUsUUFBd0I7UUFDckQsSUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRW5FLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztJQUM1QyxDQUFDO0lBUkQsa0ZBUUM7SUFFRDs7T0FFRztJQUNILFNBQWdCLDRCQUE0QixDQUFDLElBQXlCLEVBQUUsUUFBd0I7UUFFOUYsSUFBTSxhQUFhLEdBQ2Ysd0NBQTRCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUscUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUMvRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLEVBQUU7WUFDckIsYUFBYSxDQUFDLEdBQUcsQ0FB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QyxHQUFHLEVBQUUsTUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7YUFDaEU7Ozs7Ozs7OztRQUNELE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFrQjtRQUM1QyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VGaWxlLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21wb25lbnRUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7UGFyc2VkVGVtcGxhdGV9IGZyb20gJy4uL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXB9IGZyb20gJy4vZGlyZWN0aXZlJztcbmltcG9ydCB7dG9PcHRpb25hbExpdGVyYWxBcnJheX0gZnJvbSAnLi91dGlsJztcblxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlQ29tcG9uZW50RGVmaW5pdGlvbk1hcChtZXRhLCB0ZW1wbGF0ZSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlQ29tcG9uZW50KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIGNvbXBvbmVudCBpbnRvIGEgYERlZmluaXRpb25NYXBgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50RGVmaW5pdGlvbk1hcChtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YT4gPVxuICAgICAgY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCBnZXRUZW1wbGF0ZUV4cHJlc3Npb24odGVtcGxhdGUpKTtcbiAgaWYgKHRlbXBsYXRlLmlzSW5saW5lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lzSW5saW5lJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KG1ldGEuc3R5bGVzLCBvLmxpdGVyYWwpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RpcmVjdGl2ZXMnLCBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGEpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3BpcGVzJywgY29tcGlsZVVzZWRQaXBlTWV0YWRhdGEobWV0YSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmlld1Byb3ZpZGVycycsIG1ldGEudmlld1Byb3ZpZGVycyk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdhbmltYXRpb25zJywgbWV0YS5hbmltYXRpb25zKTtcblxuICBpZiAobWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY2hhbmdlRGV0ZWN0aW9uJyxcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5KVxuICAgICAgICAgICAgLnByb3AoY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneVttZXRhLmNoYW5nZURldGVjdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdlbmNhcHN1bGF0aW9uJyxcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLlZpZXdFbmNhcHN1bGF0aW9uKS5wcm9wKGNvcmUuVmlld0VuY2Fwc3VsYXRpb25bbWV0YS5lbmNhcHN1bGF0aW9uXSkpO1xuICB9XG4gIGlmIChtZXRhLmludGVycG9sYXRpb24gIT09IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2ludGVycG9sYXRpb24nLFxuICAgICAgICBvLmxpdGVyYWxBcnIoW28ubGl0ZXJhbChtZXRhLmludGVycG9sYXRpb24uc3RhcnQpLCBvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLmVuZCldKSk7XG4gIH1cblxuICBpZiAodGVtcGxhdGUucHJlc2VydmVXaGl0ZXNwYWNlcyA9PT0gdHJ1ZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwcmVzZXJ2ZVdoaXRlc3BhY2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG5mdW5jdGlvbiBnZXRUZW1wbGF0ZUV4cHJlc3Npb24odGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKHR5cGVvZiB0ZW1wbGF0ZS50ZW1wbGF0ZSA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodGVtcGxhdGUuaXNJbmxpbmUpIHtcbiAgICAgIC8vIFRoZSB0ZW1wbGF0ZSBpcyBpbmxpbmUgYnV0IG5vdCBhIHNpbXBsZSBsaXRlcmFsIHN0cmluZywgc28gZ2l2ZSB1cCB3aXRoIHRyeWluZyB0b1xuICAgICAgLy8gc291cmNlLW1hcCBpdCBhbmQganVzdCByZXR1cm4gYSBzaW1wbGUgbGl0ZXJhbCBoZXJlLlxuICAgICAgcmV0dXJuIG8ubGl0ZXJhbCh0ZW1wbGF0ZS50ZW1wbGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSB0ZW1wbGF0ZSBpcyBleHRlcm5hbCBzbyB3ZSBtdXN0IHN5bnRoZXNpemUgYW4gZXhwcmVzc2lvbiBub2RlIHdpdGggdGhlIGFwcHJvcHJpYXRlXG4gICAgICAvLyBzb3VyY2Utc3Bhbi5cbiAgICAgIGNvbnN0IGNvbnRlbnRzID0gdGVtcGxhdGUudGVtcGxhdGU7XG4gICAgICBjb25zdCBmaWxlID0gbmV3IFBhcnNlU291cmNlRmlsZShjb250ZW50cywgdGVtcGxhdGUudGVtcGxhdGVVcmwpO1xuICAgICAgY29uc3Qgc3RhcnQgPSBuZXcgUGFyc2VMb2NhdGlvbihmaWxlLCAwLCAwLCAwKTtcbiAgICAgIGNvbnN0IGVuZCA9IGNvbXB1dGVFbmRMb2NhdGlvbihmaWxlLCBjb250ZW50cyk7XG4gICAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kKTtcbiAgICAgIHJldHVybiBvLmxpdGVyYWwoY29udGVudHMsIG51bGwsIHNwYW4pO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBUaGUgdGVtcGxhdGUgaXMgaW5saW5lIHNvIHdlIGNhbiBqdXN0IHJldXNlIHRoZSBjdXJyZW50IGV4cHJlc3Npb24gbm9kZS5cbiAgICByZXR1cm4gdGVtcGxhdGUudGVtcGxhdGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZUVuZExvY2F0aW9uKGZpbGU6IFBhcnNlU291cmNlRmlsZSwgY29udGVudHM6IHN0cmluZyk6IFBhcnNlTG9jYXRpb24ge1xuICBjb25zdCBsZW5ndGggPSBjb250ZW50cy5sZW5ndGg7XG4gIGxldCBsaW5lU3RhcnQgPSAwO1xuICBsZXQgbGFzdExpbmVTdGFydCA9IDA7XG4gIGxldCBsaW5lID0gMDtcbiAgZG8ge1xuICAgIGxpbmVTdGFydCA9IGNvbnRlbnRzLmluZGV4T2YoJ1xcbicsIGxhc3RMaW5lU3RhcnQpO1xuICAgIGlmIChsaW5lU3RhcnQgIT09IC0xKSB7XG4gICAgICBsYXN0TGluZVN0YXJ0ID0gbGluZVN0YXJ0ICsgMTtcbiAgICAgIGxpbmUrKztcbiAgICB9XG4gIH0gd2hpbGUgKGxpbmVTdGFydCAhPT0gLTEpO1xuXG4gIHJldHVybiBuZXcgUGFyc2VMb2NhdGlvbihmaWxlLCBsZW5ndGgsIGxpbmUsIGxlbmd0aCAtIGxhc3RMaW5lU3RhcnQpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBkaXJlY3RpdmVzIGFzIHJlZ2lzdGVyZWQgaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YSBpbnRvIGFuIGFycmF5IGxpdGVyYWwgb2YgdGhlXG4gKiBpbmRpdmlkdWFsIGRpcmVjdGl2ZXMuIElmIHRoZSBjb21wb25lbnQgZG9lcyBub3QgdXNlIGFueSBkaXJlY3RpdmVzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVVc2VkRGlyZWN0aXZlTWV0YWRhdGEobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSk6IG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsIHtcbiAgY29uc3Qgd3JhcFR5cGUgPSBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlICE9PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QgP1xuICAgICAgZ2VuZXJhdGVGb3J3YXJkUmVmIDpcbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgcmV0dXJuIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkobWV0YS5kaXJlY3RpdmVzLCBkaXJlY3RpdmUgPT4ge1xuICAgIGNvbnN0IGRpck1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM1VzZWREaXJlY3RpdmVNZXRhZGF0YT4oKTtcbiAgICBkaXJNZXRhLnNldCgndHlwZScsIHdyYXBUeXBlKGRpcmVjdGl2ZS50eXBlKSk7XG4gICAgZGlyTWV0YS5zZXQoJ3NlbGVjdG9yJywgby5saXRlcmFsKGRpcmVjdGl2ZS5zZWxlY3RvcikpO1xuICAgIGRpck1ldGEuc2V0KCdpbnB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRpcmVjdGl2ZS5pbnB1dHMsIG8ubGl0ZXJhbCkpO1xuICAgIGRpck1ldGEuc2V0KCdvdXRwdXRzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUub3V0cHV0cywgby5saXRlcmFsKSk7XG4gICAgZGlyTWV0YS5zZXQoJ2V4cG9ydEFzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUuZXhwb3J0QXMsIG8ubGl0ZXJhbCkpO1xuICAgIHJldHVybiBkaXJNZXRhLnRvTGl0ZXJhbE1hcCgpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcGlwZXMgYXMgcmVnaXN0ZXJlZCBpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhIGludG8gYW4gb2JqZWN0IGxpdGVyYWwsIHdoZXJlIHRoZVxuICogcGlwZSdzIG5hbWUgaXMgdXNlZCBhcyBrZXkgYW5kIGEgcmVmZXJlbmNlIHRvIGl0cyB0eXBlIGFzIHZhbHVlLiBJZiB0aGUgY29tcG9uZW50IGRvZXMgbm90IHVzZVxuICogYW55IHBpcGVzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVVc2VkUGlwZU1ldGFkYXRhKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBpZiAobWV0YS5waXBlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCB3cmFwVHlwZSA9IG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUgIT09IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCA/XG4gICAgICBnZW5lcmF0ZUZvcndhcmRSZWYgOlxuICAgICAgKGV4cHI6IG8uRXhwcmVzc2lvbikgPT4gZXhwcjtcblxuICBjb25zdCBlbnRyaWVzID0gW107XG4gIGZvciAoY29uc3QgW25hbWUsIHBpcGVdIG9mIG1ldGEucGlwZXMpIHtcbiAgICBlbnRyaWVzLnB1c2goe2tleTogbmFtZSwgdmFsdWU6IHdyYXBUeXBlKHBpcGUpLCBxdW90ZWQ6IHRydWV9KTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUZvcndhcmRSZWYoZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5mb3J3YXJkUmVmKS5jYWxsRm4oW28uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZXhwcildKV0pO1xufVxuIl19