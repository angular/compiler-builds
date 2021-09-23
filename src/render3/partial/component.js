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
    function compileDeclareComponentFromMetadata(meta, template, additionalTemplateInfo) {
        var definitionMap = createComponentDefinitionMap(meta, template, additionalTemplateInfo);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareComponent).callFn([definitionMap.toLiteralMap()]);
        var type = (0, compiler_1.createComponentType)(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareComponentFromMetadata = compileDeclareComponentFromMetadata;
    /**
     * Gathers the declaration fields for a component into a `DefinitionMap`.
     */
    function createComponentDefinitionMap(meta, template, templateInfo) {
        var definitionMap = (0, directive_1.createDirectiveDefinitionMap)(meta);
        definitionMap.set('template', getTemplateExpression(template, templateInfo));
        if (templateInfo.isInline) {
            definitionMap.set('isInline', o.literal(true));
        }
        definitionMap.set('styles', (0, util_2.toOptionalLiteralArray)(meta.styles, o.literal));
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
            util_2.generateForwardRef :
            function (expr) { return expr; };
        var directives = meta.directives.filter(predicate);
        return (0, util_2.toOptionalLiteralArray)(directives, function (directive) {
            var dirMeta = new util_1.DefinitionMap();
            dirMeta.set('type', wrapType(directive.type));
            dirMeta.set('selector', o.literal(directive.selector));
            dirMeta.set('inputs', (0, util_2.toOptionalLiteralArray)(directive.inputs, o.literal));
            dirMeta.set('outputs', (0, util_2.toOptionalLiteralArray)(directive.outputs, o.literal));
            dirMeta.set('exportAs', (0, util_2.toOptionalLiteralArray)(directive.exportAs, o.literal));
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
            util_2.generateForwardRef :
            function (expr) { return expr; };
        var entries = [];
        try {
            for (var _b = (0, tslib_1.__values)(meta.pipes), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = (0, tslib_1.__read)(_c.value, 2), name_1 = _d[0], pipe = _d[1];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtEQUFpRjtJQUNqRiwrRUFBb0Q7SUFHcEQsd0VBQXFEO0lBRXJELGdFQUEyQztJQUczQyw2RUFBeUQ7SUFDekQsbUVBQWtFO0lBK0JsRTs7T0FFRztJQUNILFNBQWdCLG1DQUFtQyxDQUMvQyxJQUF5QixFQUFFLFFBQXdCLEVBQ25ELHNCQUFvRDtRQUN0RCxJQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLHNCQUFzQixDQUFDLENBQUM7UUFFM0YsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixJQUFNLElBQUksR0FBRyxJQUFBLDhCQUFtQixFQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7SUFDNUMsQ0FBQztJQVRELGtGQVNDO0lBRUQ7O09BRUc7SUFDSCxTQUFnQiw0QkFBNEIsQ0FDeEMsSUFBeUIsRUFBRSxRQUF3QixFQUNuRCxZQUEwQztRQUM1QyxJQUFNLGFBQWEsR0FDZixJQUFBLHdDQUE0QixFQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQyxD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OztPQUlHO0lBQ0gsU0FBUyx1QkFBdUIsQ0FBQyxJQUF5Qjs7UUFDeEQsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsbUJBQW1DLENBQUMsQ0FBQztZQUM5RSx5QkFBa0IsQ0FBQyxDQUFDO1lBQ3BCLFVBQUMsSUFBa0IsSUFBSyxPQUFBLElBQUksRUFBSixDQUFJLENBQUM7UUFFakMsSUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDOztZQUNuQixLQUEyQixJQUFBLEtBQUEsc0JBQUEsSUFBSSxDQUFDLEtBQUssQ0FBQSxnQkFBQSw0QkFBRTtnQkFBNUIsSUFBQSxLQUFBLGdDQUFZLEVBQVgsTUFBSSxRQUFBLEVBQUUsSUFBSSxRQUFBO2dCQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLE1BQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO2FBQ2hFOzs7Ozs7Ozs7UUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZUZpbGUsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhfSBmcm9tICcuLi92aWV3L2FwaSc7XG5pbXBvcnQge2NyZWF0ZUNvbXBvbmVudFR5cGV9IGZyb20gJy4uL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHtQYXJzZWRUZW1wbGF0ZX0gZnJvbSAnLi4vdmlldy90ZW1wbGF0ZSc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGEsIFIzRGVjbGFyZVVzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwfSBmcm9tICcuL2RpcmVjdGl2ZSc7XG5pbXBvcnQge2dlbmVyYXRlRm9yd2FyZFJlZiwgdG9PcHRpb25hbExpdGVyYWxBcnJheX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBEZWNsYXJlQ29tcG9uZW50VGVtcGxhdGVJbmZvIHtcbiAgLyoqXG4gICAqIFRoZSBzdHJpbmcgY29udGVudHMgb2YgdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUaGlzIGlzIHRoZSBcImxvZ2ljYWxcIiB0ZW1wbGF0ZSBzdHJpbmcsIGFmdGVyIGV4cGFuc2lvbiBvZiBhbnkgZXNjYXBlZCBjaGFyYWN0ZXJzIChmb3IgaW5saW5lXG4gICAqIHRlbXBsYXRlcykuIFRoaXMgbWF5IGRpZmZlciBmcm9tIHRoZSBhY3R1YWwgdGVtcGxhdGUgYnl0ZXMgYXMgdGhleSBhcHBlYXIgaW4gdGhlIC50cyBmaWxlLlxuICAgKi9cbiAgY29udGVudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBIGZ1bGwgcGF0aCB0byB0aGUgZmlsZSB3aGljaCBjb250YWlucyB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgY2FuIGJlIGVpdGhlciB0aGUgb3JpZ2luYWwgLnRzIGZpbGUgaWYgdGhlIHRlbXBsYXRlIGlzIGlubGluZSwgb3IgdGhlIC5odG1sIGZpbGUgaWYgYW5cbiAgICogZXh0ZXJuYWwgZmlsZSB3YXMgdXNlZC5cbiAgICovXG4gIHNvdXJjZVVybDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSB0ZW1wbGF0ZSB3YXMgaW5saW5lICh1c2luZyBgdGVtcGxhdGVgKSBvciBleHRlcm5hbCAodXNpbmcgYHRlbXBsYXRlVXJsYCkuXG4gICAqL1xuICBpc0lubGluZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogSWYgdGhlIHRlbXBsYXRlIHdhcyBkZWZpbmVkIGlubGluZSBieSBhIGRpcmVjdCBzdHJpbmcgbGl0ZXJhbCwgdGhlbiB0aGlzIGlzIHRoYXQgbGl0ZXJhbFxuICAgKiBleHByZXNzaW9uLiBPdGhlcndpc2UgYG51bGxgLCBpZiB0aGUgdGVtcGxhdGUgd2FzIG5vdCBkZWZpbmVkIGlubGluZSBvciB3YXMgbm90IGEgbGl0ZXJhbC5cbiAgICovXG4gIGlubGluZVRlbXBsYXRlTGl0ZXJhbEV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlLFxuICAgIGFkZGl0aW9uYWxUZW1wbGF0ZUluZm86IERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8pOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGEsIHRlbXBsYXRlLCBhZGRpdGlvbmFsVGVtcGxhdGVJbmZvKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgY29tcG9uZW50IGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSxcbiAgICB0ZW1wbGF0ZUluZm86IERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8pOiBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+ID1cbiAgICAgIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgZ2V0VGVtcGxhdGVFeHByZXNzaW9uKHRlbXBsYXRlLCB0ZW1wbGF0ZUluZm8pKTtcbiAgaWYgKHRlbXBsYXRlSW5mby5pc0lubGluZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc0lubGluZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShtZXRhLnN0eWxlcywgby5saXRlcmFsKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2NvbXBvbmVudHMnLFxuICAgICAgY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShtZXRhLCBkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLmlzQ29tcG9uZW50ID09PSB0cnVlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2RpcmVjdGl2ZXMnLFxuICAgICAgY29tcGlsZVVzZWREaXJlY3RpdmVNZXRhZGF0YShtZXRhLCBkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLmlzQ29tcG9uZW50ICE9PSB0cnVlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIGNvbXBpbGVVc2VkUGlwZU1ldGFkYXRhKG1ldGEpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdQcm92aWRlcnMnLCBtZXRhLnZpZXdQcm92aWRlcnMpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnYW5pbWF0aW9ucycsIG1ldGEuYW5pbWF0aW9ucyk7XG5cbiAgaWYgKG1ldGEuY2hhbmdlRGV0ZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NoYW5nZURldGVjdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSlcbiAgICAgICAgICAgIC5wcm9wKGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3lbbWV0YS5jaGFuZ2VEZXRlY3Rpb25dKSk7XG4gIH1cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZW5jYXBzdWxhdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5WaWV3RW5jYXBzdWxhdGlvbikucHJvcChjb3JlLlZpZXdFbmNhcHN1bGF0aW9uW21ldGEuZW5jYXBzdWxhdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5pbnRlcnBvbGF0aW9uICE9PSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdpbnRlcnBvbGF0aW9uJyxcbiAgICAgICAgby5saXRlcmFsQXJyKFtvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLnN0YXJ0KSwgby5saXRlcmFsKG1ldGEuaW50ZXJwb2xhdGlvbi5lbmQpXSkpO1xuICB9XG5cbiAgaWYgKHRlbXBsYXRlLnByZXNlcnZlV2hpdGVzcGFjZXMgPT09IHRydWUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHJlc2VydmVXaGl0ZXNwYWNlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVFeHByZXNzaW9uKFxuICAgIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSwgdGVtcGxhdGVJbmZvOiBEZWNsYXJlQ29tcG9uZW50VGVtcGxhdGVJbmZvKTogby5FeHByZXNzaW9uIHtcbiAgLy8gSWYgdGhlIHRlbXBsYXRlIGhhcyBiZWVuIGRlZmluZWQgdXNpbmcgYSBkaXJlY3QgbGl0ZXJhbCwgd2UgdXNlIHRoYXQgZXhwcmVzc2lvbiBkaXJlY3RseVxuICAvLyB3aXRob3V0IGFueSBtb2RpZmljYXRpb25zLiBUaGlzIGlzIGVuc3VyZXMgcHJvcGVyIHNvdXJjZSBtYXBwaW5nIGZyb20gdGhlIHBhcnRpYWxseVxuICAvLyBjb21waWxlZCBjb2RlIHRvIHRoZSBzb3VyY2UgZmlsZSBkZWNsYXJpbmcgdGhlIHRlbXBsYXRlLiBOb3RlIHRoYXQgdGhpcyBkb2VzIG5vdCBjYXB0dXJlXG4gIC8vIHRlbXBsYXRlIGxpdGVyYWxzIHJlZmVyZW5jZWQgaW5kaXJlY3RseSB0aHJvdWdoIGFuIGlkZW50aWZpZXIuXG4gIGlmICh0ZW1wbGF0ZUluZm8uaW5saW5lVGVtcGxhdGVMaXRlcmFsRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgIHJldHVybiB0ZW1wbGF0ZUluZm8uaW5saW5lVGVtcGxhdGVMaXRlcmFsRXhwcmVzc2lvbjtcbiAgfVxuXG4gIC8vIElmIHRoZSB0ZW1wbGF0ZSBpcyBkZWZpbmVkIGlubGluZSBidXQgbm90IHRocm91Z2ggYSBsaXRlcmFsLCB0aGUgdGVtcGxhdGUgaGFzIGJlZW4gcmVzb2x2ZWRcbiAgLy8gdGhyb3VnaCBzdGF0aWMgaW50ZXJwcmV0YXRpb24uIFdlIGNyZWF0ZSBhIGxpdGVyYWwgYnV0IGNhbm5vdCBwcm92aWRlIGFueSBzb3VyY2Ugc3Bhbi4gTm90ZVxuICAvLyB0aGF0IHdlIGNhbm5vdCB1c2UgdGhlIGV4cHJlc3Npb24gZGVmaW5pbmcgdGhlIHRlbXBsYXRlIGJlY2F1c2UgdGhlIGxpbmtlciBleHBlY3RzIHRoZSB0ZW1wbGF0ZVxuICAvLyB0byBiZSBkZWZpbmVkIGFzIGEgbGl0ZXJhbCBpbiB0aGUgZGVjbGFyYXRpb24uXG4gIGlmICh0ZW1wbGF0ZUluZm8uaXNJbmxpbmUpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKHRlbXBsYXRlSW5mby5jb250ZW50LCBudWxsLCBudWxsKTtcbiAgfVxuXG4gIC8vIFRoZSB0ZW1wbGF0ZSBpcyBleHRlcm5hbCBzbyB3ZSBtdXN0IHN5bnRoZXNpemUgYW4gZXhwcmVzc2lvbiBub2RlIHdpdGhcbiAgLy8gdGhlIGFwcHJvcHJpYXRlIHNvdXJjZS1zcGFuLlxuICBjb25zdCBjb250ZW50cyA9IHRlbXBsYXRlSW5mby5jb250ZW50O1xuICBjb25zdCBmaWxlID0gbmV3IFBhcnNlU291cmNlRmlsZShjb250ZW50cywgdGVtcGxhdGVJbmZvLnNvdXJjZVVybCk7XG4gIGNvbnN0IHN0YXJ0ID0gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgMCwgMCwgMCk7XG4gIGNvbnN0IGVuZCA9IGNvbXB1dGVFbmRMb2NhdGlvbihmaWxlLCBjb250ZW50cyk7XG4gIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQpO1xuICByZXR1cm4gby5saXRlcmFsKGNvbnRlbnRzLCBudWxsLCBzcGFuKTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUVuZExvY2F0aW9uKGZpbGU6IFBhcnNlU291cmNlRmlsZSwgY29udGVudHM6IHN0cmluZyk6IFBhcnNlTG9jYXRpb24ge1xuICBjb25zdCBsZW5ndGggPSBjb250ZW50cy5sZW5ndGg7XG4gIGxldCBsaW5lU3RhcnQgPSAwO1xuICBsZXQgbGFzdExpbmVTdGFydCA9IDA7XG4gIGxldCBsaW5lID0gMDtcbiAgZG8ge1xuICAgIGxpbmVTdGFydCA9IGNvbnRlbnRzLmluZGV4T2YoJ1xcbicsIGxhc3RMaW5lU3RhcnQpO1xuICAgIGlmIChsaW5lU3RhcnQgIT09IC0xKSB7XG4gICAgICBsYXN0TGluZVN0YXJ0ID0gbGluZVN0YXJ0ICsgMTtcbiAgICAgIGxpbmUrKztcbiAgICB9XG4gIH0gd2hpbGUgKGxpbmVTdGFydCAhPT0gLTEpO1xuXG4gIHJldHVybiBuZXcgUGFyc2VMb2NhdGlvbihmaWxlLCBsZW5ndGgsIGxpbmUsIGxlbmd0aCAtIGxhc3RMaW5lU3RhcnQpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBkaXJlY3RpdmVzIGFzIHJlZ2lzdGVyZWQgaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YSBpbnRvIGFuIGFycmF5IGxpdGVyYWwgb2YgdGhlXG4gKiBpbmRpdmlkdWFsIGRpcmVjdGl2ZXMuIElmIHRoZSBjb21wb25lbnQgZG9lcyBub3QgdXNlIGFueSBkaXJlY3RpdmVzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVVc2VkRGlyZWN0aXZlTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSxcbiAgICBwcmVkaWNhdGU6IChkaXJlY3RpdmU6IFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhKSA9PiBib29sZWFuKTogby5MaXRlcmFsQXJyYXlFeHByfG51bGwge1xuICBjb25zdCB3cmFwVHlwZSA9IG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUgIT09IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCA/XG4gICAgICBnZW5lcmF0ZUZvcndhcmRSZWYgOlxuICAgICAgKGV4cHI6IG8uRXhwcmVzc2lvbikgPT4gZXhwcjtcblxuICBjb25zdCBkaXJlY3RpdmVzID0gbWV0YS5kaXJlY3RpdmVzLmZpbHRlcihwcmVkaWNhdGUpO1xuICByZXR1cm4gdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmVzLCBkaXJlY3RpdmUgPT4ge1xuICAgIGNvbnN0IGRpck1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVVc2VkRGlyZWN0aXZlTWV0YWRhdGE+KCk7XG4gICAgZGlyTWV0YS5zZXQoJ3R5cGUnLCB3cmFwVHlwZShkaXJlY3RpdmUudHlwZSkpO1xuICAgIGRpck1ldGEuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChkaXJlY3RpdmUuc2VsZWN0b3IpKTtcbiAgICBkaXJNZXRhLnNldCgnaW5wdXRzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUuaW5wdXRzLCBvLmxpdGVyYWwpKTtcbiAgICBkaXJNZXRhLnNldCgnb3V0cHV0cycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLm91dHB1dHMsIG8ubGl0ZXJhbCkpO1xuICAgIGRpck1ldGEuc2V0KCdleHBvcnRBcycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLmV4cG9ydEFzLCBvLmxpdGVyYWwpKTtcbiAgICByZXR1cm4gZGlyTWV0YS50b0xpdGVyYWxNYXAoKTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHBpcGVzIGFzIHJlZ2lzdGVyZWQgaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YSBpbnRvIGFuIG9iamVjdCBsaXRlcmFsLCB3aGVyZSB0aGVcbiAqIHBpcGUncyBuYW1lIGlzIHVzZWQgYXMga2V5IGFuZCBhIHJlZmVyZW5jZSB0byBpdHMgdHlwZSBhcyB2YWx1ZS4gSWYgdGhlIGNvbXBvbmVudCBkb2VzIG5vdCB1c2VcbiAqIGFueSBwaXBlcywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICovXG5mdW5jdGlvbiBjb21waWxlVXNlZFBpcGVNZXRhZGF0YShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgaWYgKG1ldGEucGlwZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3Qgd3JhcFR5cGUgPSBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlICE9PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QgP1xuICAgICAgZ2VuZXJhdGVGb3J3YXJkUmVmIDpcbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgY29uc3QgZW50cmllcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBwaXBlXSBvZiBtZXRhLnBpcGVzKSB7XG4gICAgZW50cmllcy5wdXNoKHtrZXk6IG5hbWUsIHZhbHVlOiB3cmFwVHlwZShwaXBlKSwgcXVvdGVkOiB0cnVlfSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbn1cbiJdfQ==