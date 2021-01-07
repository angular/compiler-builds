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
        var templateExpr = getTemplateExpression(template);
        templateMap.set('source', templateExpr);
        templateMap.set('isInline', o.literal(template.isInline));
        return templateMap.toLiteralMap();
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILGlEQUFtQztJQUNuQyw2RkFBa0Y7SUFDbEYsMkRBQTZDO0lBQzdDLCtEQUFpRjtJQUNqRiwrRUFBb0Q7SUFFcEQsd0VBQXFEO0lBRXJELGdFQUEyQztJQUczQyw2RUFBeUQ7SUFDekQsbUVBQThDO0lBRzlDOztPQUVHO0lBQ0gsU0FBZ0IsbUNBQW1DLENBQy9DLElBQXlCLEVBQUUsUUFBd0I7UUFDckQsSUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRW5FLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFDLENBQUM7SUFDNUIsQ0FBQztJQVJELGtGQVFDO0lBRUQ7O09BRUc7SUFDSCxTQUFnQiw0QkFBNEIsQ0FBQyxJQUF5QixFQUFFLFFBQXdCO1FBRTlGLElBQU0sYUFBYSxHQUNmLHdDQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLElBQU0sV0FBVyxHQUFHLHlCQUF5QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXhELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRTNDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLDZCQUFzQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDNUUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwRSxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzFELGFBQWEsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN2RCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFakQsSUFBSSxJQUFJLENBQUMsZUFBZSxLQUFLLFNBQVMsRUFBRTtZQUN0QyxhQUFhLENBQUMsR0FBRyxDQUNiLGlCQUFpQixFQUNqQixDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsdUJBQXVCLENBQUM7aUJBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNwRTtRQUNELElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFO1lBQzFELGFBQWEsQ0FBQyxHQUFHLENBQ2IsZUFBZSxFQUNmLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUMxRjtRQUNELElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxtREFBNEIsRUFBRTtZQUN2RCxhQUFhLENBQUMsR0FBRyxDQUNiLGVBQWUsRUFDZixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM3RjtRQUVELElBQUksUUFBUSxDQUFDLG1CQUFtQixLQUFLLElBQUksRUFBRTtZQUN6QyxhQUFhLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMzRDtRQUVELE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFyQ0Qsb0VBcUNDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLHlCQUF5QixDQUFDLFFBQXdCO1FBQ3pELElBQU0sV0FBVyxHQUFHLElBQUksb0JBQWEsRUFBMEMsQ0FBQztRQUNoRixJQUFNLFlBQVksR0FBRyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyRCxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN4QyxXQUFXLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQzFELE9BQU8sV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFFRCxTQUFTLHFCQUFxQixDQUFDLFFBQXdCO1FBQ3JELElBQUksT0FBTyxRQUFRLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtZQUN6QyxJQUFJLFFBQVEsQ0FBQyxRQUFRLEVBQUU7Z0JBQ3JCLG9GQUFvRjtnQkFDcEYsdURBQXVEO2dCQUN2RCxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ3JDO2lCQUFNO2dCQUNMLHlGQUF5RjtnQkFDekYsZUFBZTtnQkFDZixJQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDO2dCQUNuQyxJQUFNLElBQUksR0FBRyxJQUFJLDRCQUFlLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDakUsSUFBTSxLQUFLLEdBQUcsSUFBSSwwQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxJQUFNLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQy9DLElBQU0sSUFBSSxHQUFHLElBQUksNEJBQWUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQzdDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ3hDO1NBQ0Y7YUFBTTtZQUNMLDJFQUEyRTtZQUMzRSxPQUFPLFFBQVEsQ0FBQyxRQUFRLENBQUM7U0FDMUI7SUFDSCxDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFxQixFQUFFLFFBQWdCO1FBQ2pFLElBQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFDL0IsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLElBQUksYUFBYSxHQUFHLENBQUMsQ0FBQztRQUN0QixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7UUFDYixHQUFHO1lBQ0QsU0FBUyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQ2xELElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFO2dCQUNwQixhQUFhLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQztnQkFDOUIsSUFBSSxFQUFFLENBQUM7YUFDUjtTQUNGLFFBQVEsU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFO1FBRTNCLE9BQU8sSUFBSSwwQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sR0FBRyxhQUFhLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyw0QkFBNEIsQ0FBQyxJQUF5QjtRQUM3RCxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLG1CQUFtQyxDQUFDLENBQUM7WUFDOUUsa0JBQWtCLENBQUMsQ0FBQztZQUNwQixVQUFDLElBQWtCLElBQUssT0FBQSxJQUFJLEVBQUosQ0FBSSxDQUFDO1FBRWpDLE9BQU8sNkJBQXNCLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxVQUFBLFNBQVM7WUFDdEQsSUFBTSxPQUFPLEdBQUcsSUFBSSxvQkFBYSxFQUEyQixDQUFDO1lBQzdELE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM5QyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLDZCQUFzQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDM0UsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsNkJBQXNCLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUM3RSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSw2QkFBc0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQy9FLE9BQU8sT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2hDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxTQUFTLHVCQUF1QixDQUFDLElBQXlCOztRQUN4RCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtZQUN6QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixtQkFBbUMsQ0FBQyxDQUFDO1lBQzlFLGtCQUFrQixDQUFDLENBQUM7WUFDcEIsVUFBQyxJQUFrQixJQUFLLE9BQUEsSUFBSSxFQUFKLENBQUksQ0FBQztRQUVqQyxJQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7O1lBQ25CLEtBQTJCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsS0FBSyxDQUFBLGdCQUFBLDRCQUFFO2dCQUE1QixJQUFBLEtBQUEsMkJBQVksRUFBWCxNQUFJLFFBQUEsRUFBRSxJQUFJLFFBQUE7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsTUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7YUFDaEU7Ozs7Ozs7OztRQUNELE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFrQjtRQUM1QyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VGaWxlLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSwgUjNDb21wb25lbnREZWYsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhfSBmcm9tICcuLi92aWV3L2FwaSc7XG5pbXBvcnQge2NyZWF0ZUNvbXBvbmVudFR5cGV9IGZyb20gJy4uL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHtQYXJzZWRUZW1wbGF0ZX0gZnJvbSAnLi4vdmlldy90ZW1wbGF0ZSc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9kaXJlY3RpdmUnO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbEFycmF5fSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGEsIHRlbXBsYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBjb21wb25lbnQgaW50byBhIGBEZWZpbml0aW9uTWFwYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudERlZmluaXRpb25NYXAobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+ID1cbiAgICAgIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgdGVtcGxhdGVNYXAgPSBjb21waWxlVGVtcGxhdGVEZWZpbml0aW9uKHRlbXBsYXRlKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZU1hcCk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkobWV0YS5zdHlsZXMsIG8ubGl0ZXJhbCkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZGlyZWN0aXZlcycsIGNvbXBpbGVVc2VkRGlyZWN0aXZlTWV0YWRhdGEobWV0YSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBjb21waWxlVXNlZFBpcGVNZXRhZGF0YShtZXRhKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UHJvdmlkZXJzJywgbWV0YS52aWV3UHJvdmlkZXJzKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2FuaW1hdGlvbnMnLCBtZXRhLmFuaW1hdGlvbnMpO1xuXG4gIGlmIChtZXRhLmNoYW5nZURldGVjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdjaGFuZ2VEZXRlY3Rpb24nLFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kpXG4gICAgICAgICAgICAucHJvcChjb3JlLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5W21ldGEuY2hhbmdlRGV0ZWN0aW9uXSkpO1xuICB9XG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gIT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2VuY2Fwc3VsYXRpb24nLFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuVmlld0VuY2Fwc3VsYXRpb24pLnByb3AoY29yZS5WaWV3RW5jYXBzdWxhdGlvblttZXRhLmVuY2Fwc3VsYXRpb25dKSk7XG4gIH1cbiAgaWYgKG1ldGEuaW50ZXJwb2xhdGlvbiAhPT0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnaW50ZXJwb2xhdGlvbicsXG4gICAgICAgIG8ubGl0ZXJhbEFycihbby5saXRlcmFsKG1ldGEuaW50ZXJwb2xhdGlvbi5zdGFydCksIG8ubGl0ZXJhbChtZXRhLmludGVycG9sYXRpb24uZW5kKV0pKTtcbiAgfVxuXG4gIGlmICh0ZW1wbGF0ZS5wcmVzZXJ2ZVdoaXRlc3BhY2VzID09PSB0cnVlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHByb3ZpZGVkIHRlbXBsYXRlIGludG8gaXRzIHBhcnRpYWwgZGVmaW5pdGlvbi5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVRlbXBsYXRlRGVmaW5pdGlvbih0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgdGVtcGxhdGVNYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDb21wb25lbnRNZXRhZGF0YVsndGVtcGxhdGUnXT4oKTtcbiAgY29uc3QgdGVtcGxhdGVFeHByID0gZ2V0VGVtcGxhdGVFeHByZXNzaW9uKHRlbXBsYXRlKTtcbiAgdGVtcGxhdGVNYXAuc2V0KCdzb3VyY2UnLCB0ZW1wbGF0ZUV4cHIpO1xuICB0ZW1wbGF0ZU1hcC5zZXQoJ2lzSW5saW5lJywgby5saXRlcmFsKHRlbXBsYXRlLmlzSW5saW5lKSk7XG4gIHJldHVybiB0ZW1wbGF0ZU1hcC50b0xpdGVyYWxNYXAoKTtcbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVFeHByZXNzaW9uKHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmICh0eXBlb2YgdGVtcGxhdGUudGVtcGxhdGUgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHRlbXBsYXRlLmlzSW5saW5lKSB7XG4gICAgICAvLyBUaGUgdGVtcGxhdGUgaXMgaW5saW5lIGJ1dCBub3QgYSBzaW1wbGUgbGl0ZXJhbCBzdHJpbmcsIHNvIGdpdmUgdXAgd2l0aCB0cnlpbmcgdG9cbiAgICAgIC8vIHNvdXJjZS1tYXAgaXQgYW5kIGp1c3QgcmV0dXJuIGEgc2ltcGxlIGxpdGVyYWwgaGVyZS5cbiAgICAgIHJldHVybiBvLmxpdGVyYWwodGVtcGxhdGUudGVtcGxhdGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgdGVtcGxhdGUgaXMgZXh0ZXJuYWwgc28gd2UgbXVzdCBzeW50aGVzaXplIGFuIGV4cHJlc3Npb24gbm9kZSB3aXRoIHRoZSBhcHByb3ByaWF0ZVxuICAgICAgLy8gc291cmNlLXNwYW4uXG4gICAgICBjb25zdCBjb250ZW50cyA9IHRlbXBsYXRlLnRlbXBsYXRlO1xuICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYXJzZVNvdXJjZUZpbGUoY29udGVudHMsIHRlbXBsYXRlLnRlbXBsYXRlVXJsKTtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgMCwgMCwgMCk7XG4gICAgICBjb25zdCBlbmQgPSBjb21wdXRlRW5kTG9jYXRpb24oZmlsZSwgY29udGVudHMpO1xuICAgICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCk7XG4gICAgICByZXR1cm4gby5saXRlcmFsKGNvbnRlbnRzLCBudWxsLCBzcGFuKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIHRlbXBsYXRlIGlzIGlubGluZSBzbyB3ZSBjYW4ganVzdCByZXVzZSB0aGUgY3VycmVudCBleHByZXNzaW9uIG5vZGUuXG4gICAgcmV0dXJuIHRlbXBsYXRlLnRlbXBsYXRlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVFbmRMb2NhdGlvbihmaWxlOiBQYXJzZVNvdXJjZUZpbGUsIGNvbnRlbnRzOiBzdHJpbmcpOiBQYXJzZUxvY2F0aW9uIHtcbiAgY29uc3QgbGVuZ3RoID0gY29udGVudHMubGVuZ3RoO1xuICBsZXQgbGluZVN0YXJ0ID0gMDtcbiAgbGV0IGxhc3RMaW5lU3RhcnQgPSAwO1xuICBsZXQgbGluZSA9IDA7XG4gIGRvIHtcbiAgICBsaW5lU3RhcnQgPSBjb250ZW50cy5pbmRleE9mKCdcXG4nLCBsYXN0TGluZVN0YXJ0KTtcbiAgICBpZiAobGluZVN0YXJ0ICE9PSAtMSkge1xuICAgICAgbGFzdExpbmVTdGFydCA9IGxpbmVTdGFydCArIDE7XG4gICAgICBsaW5lKys7XG4gICAgfVxuICB9IHdoaWxlIChsaW5lU3RhcnQgIT09IC0xKTtcblxuICByZXR1cm4gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgbGVuZ3RoLCBsaW5lLCBsZW5ndGggLSBsYXN0TGluZVN0YXJ0KTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgZGlyZWN0aXZlcyBhcyByZWdpc3RlcmVkIGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGEgaW50byBhbiBhcnJheSBsaXRlcmFsIG9mIHRoZVxuICogaW5kaXZpZHVhbCBkaXJlY3RpdmVzLiBJZiB0aGUgY29tcG9uZW50IGRvZXMgbm90IHVzZSBhbnkgZGlyZWN0aXZlcywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICovXG5mdW5jdGlvbiBjb21waWxlVXNlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IHdyYXBUeXBlID0gbWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0ID9cbiAgICAgIGdlbmVyYXRlRm9yd2FyZFJlZiA6XG4gICAgICAoZXhwcjogby5FeHByZXNzaW9uKSA9PiBleHByO1xuXG4gIHJldHVybiB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KG1ldGEuZGlyZWN0aXZlcywgZGlyZWN0aXZlID0+IHtcbiAgICBjb25zdCBkaXJNZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNVc2VkRGlyZWN0aXZlTWV0YWRhdGE+KCk7XG4gICAgZGlyTWV0YS5zZXQoJ3R5cGUnLCB3cmFwVHlwZShkaXJlY3RpdmUudHlwZSkpO1xuICAgIGRpck1ldGEuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChkaXJlY3RpdmUuc2VsZWN0b3IpKTtcbiAgICBkaXJNZXRhLnNldCgnaW5wdXRzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShkaXJlY3RpdmUuaW5wdXRzLCBvLmxpdGVyYWwpKTtcbiAgICBkaXJNZXRhLnNldCgnb3V0cHV0cycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLm91dHB1dHMsIG8ubGl0ZXJhbCkpO1xuICAgIGRpck1ldGEuc2V0KCdleHBvcnRBcycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGlyZWN0aXZlLmV4cG9ydEFzLCBvLmxpdGVyYWwpKTtcbiAgICByZXR1cm4gZGlyTWV0YS50b0xpdGVyYWxNYXAoKTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHBpcGVzIGFzIHJlZ2lzdGVyZWQgaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YSBpbnRvIGFuIG9iamVjdCBsaXRlcmFsLCB3aGVyZSB0aGVcbiAqIHBpcGUncyBuYW1lIGlzIHVzZWQgYXMga2V5IGFuZCBhIHJlZmVyZW5jZSB0byBpdHMgdHlwZSBhcyB2YWx1ZS4gSWYgdGhlIGNvbXBvbmVudCBkb2VzIG5vdCB1c2VcbiAqIGFueSBwaXBlcywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICovXG5mdW5jdGlvbiBjb21waWxlVXNlZFBpcGVNZXRhZGF0YShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgaWYgKG1ldGEucGlwZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3Qgd3JhcFR5cGUgPSBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlICE9PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QgP1xuICAgICAgZ2VuZXJhdGVGb3J3YXJkUmVmIDpcbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgY29uc3QgZW50cmllcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBwaXBlXSBvZiBtZXRhLnBpcGVzKSB7XG4gICAgZW50cmllcy5wdXNoKHtrZXk6IG5hbWUsIHZhbHVlOiB3cmFwVHlwZShwaXBlKSwgcXVvdGVkOiB0cnVlfSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVGb3J3YXJkUmVmKGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuZm9yd2FyZFJlZikuY2FsbEZuKFtvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGV4cHIpXSldKTtcbn1cbiJdfQ==