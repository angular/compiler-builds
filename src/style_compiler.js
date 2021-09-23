/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/style_compiler", ["require", "exports", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/core", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/shadow_css"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StyleCompiler = exports.CompiledStylesheet = exports.StylesCompileDependency = exports.CONTENT_ATTR = exports.HOST_ATTR = void 0;
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var core_1 = require("@angular/compiler/src/core");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var shadow_css_1 = require("@angular/compiler/src/shadow_css");
    var COMPONENT_VARIABLE = '%COMP%';
    exports.HOST_ATTR = "_nghost-" + COMPONENT_VARIABLE;
    exports.CONTENT_ATTR = "_ngcontent-" + COMPONENT_VARIABLE;
    var StylesCompileDependency = /** @class */ (function () {
        function StylesCompileDependency(name, moduleUrl, setValue) {
            this.name = name;
            this.moduleUrl = moduleUrl;
            this.setValue = setValue;
        }
        return StylesCompileDependency;
    }());
    exports.StylesCompileDependency = StylesCompileDependency;
    var CompiledStylesheet = /** @class */ (function () {
        function CompiledStylesheet(outputCtx, stylesVar, dependencies, isShimmed, meta) {
            this.outputCtx = outputCtx;
            this.stylesVar = stylesVar;
            this.dependencies = dependencies;
            this.isShimmed = isShimmed;
            this.meta = meta;
        }
        return CompiledStylesheet;
    }());
    exports.CompiledStylesheet = CompiledStylesheet;
    var StyleCompiler = /** @class */ (function () {
        function StyleCompiler(_urlResolver) {
            this._urlResolver = _urlResolver;
            this._shadowCss = new shadow_css_1.ShadowCss();
        }
        StyleCompiler.prototype.compileComponent = function (outputCtx, comp) {
            var template = comp.template;
            return this._compileStyles(outputCtx, comp, new compile_metadata_1.CompileStylesheetMetadata({
                styles: template.styles,
                styleUrls: template.styleUrls,
                moduleUrl: (0, parse_util_1.identifierModuleUrl)(comp.type)
            }), this.needsStyleShim(comp), true);
        };
        StyleCompiler.prototype.compileStyles = function (outputCtx, comp, stylesheet, shim) {
            if (shim === void 0) { shim = this.needsStyleShim(comp); }
            return this._compileStyles(outputCtx, comp, stylesheet, shim, false);
        };
        StyleCompiler.prototype.needsStyleShim = function (comp) {
            return comp.template.encapsulation === core_1.ViewEncapsulation.Emulated;
        };
        StyleCompiler.prototype._compileStyles = function (outputCtx, comp, stylesheet, shim, isComponentStylesheet) {
            var _this = this;
            var styleExpressions = stylesheet.styles.map(function (plainStyle) { return o.literal(_this._shimIfNeeded(plainStyle, shim)); });
            var dependencies = [];
            stylesheet.styleUrls.forEach(function (styleUrl) {
                var exprIndex = styleExpressions.length;
                // Note: This placeholder will be filled later.
                styleExpressions.push(null);
                dependencies.push(new StylesCompileDependency(getStylesVarName(null), styleUrl, function (value) { return styleExpressions[exprIndex] = outputCtx.importExpr(value); }));
            });
            // styles variable contains plain strings and arrays of other styles arrays (recursive),
            // so we set its type to dynamic.
            var stylesVar = getStylesVarName(isComponentStylesheet ? comp : null);
            var stmt = o.variable(stylesVar)
                .set(o.literalArr(styleExpressions, new o.ArrayType(o.DYNAMIC_TYPE, [o.TypeModifier.Const])))
                .toDeclStmt(null, isComponentStylesheet ? [o.StmtModifier.Final] : [
                o.StmtModifier.Final, o.StmtModifier.Exported
            ]);
            outputCtx.statements.push(stmt);
            return new CompiledStylesheet(outputCtx, stylesVar, dependencies, shim, stylesheet);
        };
        StyleCompiler.prototype._shimIfNeeded = function (style, shim) {
            return shim ? this._shadowCss.shimCssText(style, exports.CONTENT_ATTR, exports.HOST_ATTR) : style;
        };
        return StyleCompiler;
    }());
    exports.StyleCompiler = StyleCompiler;
    function getStylesVarName(component) {
        var result = "styles";
        if (component) {
            result += "_" + (0, parse_util_1.identifierName)(component.type);
        }
        return result;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvc3R5bGVfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsMkVBQXVGO0lBRXZGLG1EQUF5QztJQUN6QywyREFBeUM7SUFDekMsK0RBQWlFO0lBQ2pFLCtEQUF1QztJQUd2QyxJQUFNLGtCQUFrQixHQUFHLFFBQVEsQ0FBQztJQUN2QixRQUFBLFNBQVMsR0FBRyxhQUFXLGtCQUFvQixDQUFDO0lBQzVDLFFBQUEsWUFBWSxHQUFHLGdCQUFjLGtCQUFvQixDQUFDO0lBRS9EO1FBQ0UsaUNBQ1csSUFBWSxFQUFTLFNBQWlCLEVBQVMsUUFBOEI7WUFBN0UsU0FBSSxHQUFKLElBQUksQ0FBUTtZQUFTLGNBQVMsR0FBVCxTQUFTLENBQVE7WUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFzQjtRQUFHLENBQUM7UUFDOUYsOEJBQUM7SUFBRCxDQUFDLEFBSEQsSUFHQztJQUhZLDBEQUF1QjtJQUtwQztRQUNFLDRCQUNXLFNBQXdCLEVBQVMsU0FBaUIsRUFDbEQsWUFBdUMsRUFBUyxTQUFrQixFQUNsRSxJQUErQjtZQUYvQixjQUFTLEdBQVQsU0FBUyxDQUFlO1lBQVMsY0FBUyxHQUFULFNBQVMsQ0FBUTtZQUNsRCxpQkFBWSxHQUFaLFlBQVksQ0FBMkI7WUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFTO1lBQ2xFLFNBQUksR0FBSixJQUFJLENBQTJCO1FBQUcsQ0FBQztRQUNoRCx5QkFBQztJQUFELENBQUMsQUFMRCxJQUtDO0lBTFksZ0RBQWtCO0lBTy9CO1FBR0UsdUJBQW9CLFlBQXlCO1lBQXpCLGlCQUFZLEdBQVosWUFBWSxDQUFhO1lBRnJDLGVBQVUsR0FBYyxJQUFJLHNCQUFTLEVBQUUsQ0FBQztRQUVBLENBQUM7UUFFakQsd0NBQWdCLEdBQWhCLFVB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QUksQ0FBQyxDQUFDO1lBQ2hDLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdEYsQ0FBQztRQUVPLHFDQUFhLEdBQXJCLFVBQXNCLEtBQWEsRUFBRSxJQUFhO1lBQ2hELE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsb0JBQVksRUFBRSxpQkFBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUNwRixDQUFDO1FBQ0gsb0JBQUM7SUFBRCxDQUFDLEFBMURELElBMERDO0lBMURZLHNDQUFhO0lBNEQxQixTQUFTLGdCQUFnQixDQUFDLFNBQXdDO1FBQ2hFLElBQUksTUFBTSxHQUFHLFFBQVEsQ0FBQztRQUN0QixJQUFJLFNBQVMsRUFBRTtZQUNiLE1BQU0sSUFBSSxNQUFJLElBQUEsMkJBQWMsRUFBQyxTQUFTLENBQUMsSUFBSSxDQUFHLENBQUM7U0FDaEQ7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhfSBmcm9tICcuL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2lkZW50aWZpZXJNb2R1bGVVcmwsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtTaGFkb3dDc3N9IGZyb20gJy4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge1VybFJlc29sdmVyfSBmcm9tICcuL3VybF9yZXNvbHZlcic7XG5cbmNvbnN0IENPTVBPTkVOVF9WQVJJQUJMRSA9ICclQ09NUCUnO1xuZXhwb3J0IGNvbnN0IEhPU1RfQVRUUiA9IGBfbmdob3N0LSR7Q09NUE9ORU5UX1ZBUklBQkxFfWA7XG5leHBvcnQgY29uc3QgQ09OVEVOVF9BVFRSID0gYF9uZ2NvbnRlbnQtJHtDT01QT05FTlRfVkFSSUFCTEV9YDtcblxuZXhwb3J0IGNsYXNzIFN0eWxlc0NvbXBpbGVEZXBlbmRlbmN5IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgbW9kdWxlVXJsOiBzdHJpbmcsIHB1YmxpYyBzZXRWYWx1ZTogKHZhbHVlOiBhbnkpID0+IHZvaWQpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlZFN0eWxlc2hlZXQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIHB1YmxpYyBzdHlsZXNWYXI6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBkZXBlbmRlbmNpZXM6IFN0eWxlc0NvbXBpbGVEZXBlbmRlbmN5W10sIHB1YmxpYyBpc1NoaW1tZWQ6IGJvb2xlYW4sXG4gICAgICBwdWJsaWMgbWV0YTogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFN0eWxlQ29tcGlsZXIge1xuICBwcml2YXRlIF9zaGFkb3dDc3M6IFNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF91cmxSZXNvbHZlcjogVXJsUmVzb2x2ZXIpIHt9XG5cbiAgY29tcGlsZUNvbXBvbmVudChvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXA6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSk6IENvbXBpbGVkU3R5bGVzaGVldCB7XG4gICAgY29uc3QgdGVtcGxhdGUgPSBjb21wLnRlbXBsYXRlICE7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVTdHlsZXMoXG4gICAgICAgIG91dHB1dEN0eCwgY29tcCwgbmV3IENvbXBpbGVTdHlsZXNoZWV0TWV0YWRhdGEoe1xuICAgICAgICAgIHN0eWxlczogdGVtcGxhdGUuc3R5bGVzLFxuICAgICAgICAgIHN0eWxlVXJsczogdGVtcGxhdGUuc3R5bGVVcmxzLFxuICAgICAgICAgIG1vZHVsZVVybDogaWRlbnRpZmllck1vZHVsZVVybChjb21wLnR5cGUpXG4gICAgICAgIH0pLFxuICAgICAgICB0aGlzLm5lZWRzU3R5bGVTaGltKGNvbXApLCB0cnVlKTtcbiAgfVxuXG4gIGNvbXBpbGVTdHlsZXMoXG4gICAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXA6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIHN0eWxlc2hlZXQ6IENvbXBpbGVTdHlsZXNoZWV0TWV0YWRhdGEsXG4gICAgICBzaGltOiBib29sZWFuID0gdGhpcy5uZWVkc1N0eWxlU2hpbShjb21wKSk6IENvbXBpbGVkU3R5bGVzaGVldCB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVTdHlsZXMob3V0cHV0Q3R4LCBjb21wLCBzdHlsZXNoZWV0LCBzaGltLCBmYWxzZSk7XG4gIH1cblxuICBuZWVkc1N0eWxlU2hpbShjb21wOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEpOiBib29sZWFuIHtcbiAgICByZXR1cm4gY29tcC50ZW1wbGF0ZSAhLmVuY2Fwc3VsYXRpb24gPT09IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tcGlsZVN0eWxlcyhcbiAgICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgY29tcDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgc3R5bGVzaGVldDogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YSwgc2hpbTogYm9vbGVhbixcbiAgICAgIGlzQ29tcG9uZW50U3R5bGVzaGVldDogYm9vbGVhbik6IENvbXBpbGVkU3R5bGVzaGVldCB7XG4gICAgY29uc3Qgc3R5bGVFeHByZXNzaW9uczogby5FeHByZXNzaW9uW10gPVxuICAgICAgICBzdHlsZXNoZWV0LnN0eWxlcy5tYXAocGxhaW5TdHlsZSA9PiBvLmxpdGVyYWwodGhpcy5fc2hpbUlmTmVlZGVkKHBsYWluU3R5bGUsIHNoaW0pKSk7XG4gICAgY29uc3QgZGVwZW5kZW5jaWVzOiBTdHlsZXNDb21waWxlRGVwZW5kZW5jeVtdID0gW107XG4gICAgc3R5bGVzaGVldC5zdHlsZVVybHMuZm9yRWFjaCgoc3R5bGVVcmwpID0+IHtcbiAgICAgIGNvbnN0IGV4cHJJbmRleCA9IHN0eWxlRXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgICAgLy8gTm90ZTogVGhpcyBwbGFjZWhvbGRlciB3aWxsIGJlIGZpbGxlZCBsYXRlci5cbiAgICAgIHN0eWxlRXhwcmVzc2lvbnMucHVzaChudWxsISk7XG4gICAgICBkZXBlbmRlbmNpZXMucHVzaChuZXcgU3R5bGVzQ29tcGlsZURlcGVuZGVuY3koXG4gICAgICAgICAgZ2V0U3R5bGVzVmFyTmFtZShudWxsKSwgc3R5bGVVcmwsXG4gICAgICAgICAgKHZhbHVlKSA9PiBzdHlsZUV4cHJlc3Npb25zW2V4cHJJbmRleF0gPSBvdXRwdXRDdHguaW1wb3J0RXhwcih2YWx1ZSkpKTtcbiAgICB9KTtcbiAgICAvLyBzdHlsZXMgdmFyaWFibGUgY29udGFpbnMgcGxhaW4gc3RyaW5ncyBhbmQgYXJyYXlzIG9mIG90aGVyIHN0eWxlcyBhcnJheXMgKHJlY3Vyc2l2ZSksXG4gICAgLy8gc28gd2Ugc2V0IGl0cyB0eXBlIHRvIGR5bmFtaWMuXG4gICAgY29uc3Qgc3R5bGVzVmFyID0gZ2V0U3R5bGVzVmFyTmFtZShpc0NvbXBvbmVudFN0eWxlc2hlZXQgPyBjb21wIDogbnVsbCk7XG4gICAgY29uc3Qgc3RtdCA9IG8udmFyaWFibGUoc3R5bGVzVmFyKVxuICAgICAgICAgICAgICAgICAgICAgLnNldChvLmxpdGVyYWxBcnIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGVFeHByZXNzaW9ucywgbmV3IG8uQXJyYXlUeXBlKG8uRFlOQU1JQ19UWVBFLCBbby5UeXBlTW9kaWZpZXIuQ29uc3RdKSkpXG4gICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChudWxsLCBpc0NvbXBvbmVudFN0eWxlc2hlZXQgPyBbby5TdG10TW9kaWZpZXIuRmluYWxdIDogW1xuICAgICAgICAgICAgICAgICAgICAgICBvLlN0bXRNb2RpZmllci5GaW5hbCwgby5TdG10TW9kaWZpZXIuRXhwb3J0ZWRcbiAgICAgICAgICAgICAgICAgICAgIF0pO1xuICAgIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2goc3RtdCk7XG4gICAgcmV0dXJuIG5ldyBDb21waWxlZFN0eWxlc2hlZXQob3V0cHV0Q3R4LCBzdHlsZXNWYXIsIGRlcGVuZGVuY2llcywgc2hpbSwgc3R5bGVzaGVldCk7XG4gIH1cblxuICBwcml2YXRlIF9zaGltSWZOZWVkZWQoc3R5bGU6IHN0cmluZywgc2hpbTogYm9vbGVhbik6IHN0cmluZyB7XG4gICAgcmV0dXJuIHNoaW0gPyB0aGlzLl9zaGFkb3dDc3Muc2hpbUNzc1RleHQoc3R5bGUsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKSA6IHN0eWxlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFN0eWxlc1Zhck5hbWUoY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGF8bnVsbCk6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSBgc3R5bGVzYDtcbiAgaWYgKGNvbXBvbmVudCkge1xuICAgIHJlc3VsdCArPSBgXyR7aWRlbnRpZmllck5hbWUoY29tcG9uZW50LnR5cGUpfWA7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==