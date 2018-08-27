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
        define("@angular/compiler/src/style_compiler", ["require", "exports", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/core", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/shadow_css"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var core_1 = require("@angular/compiler/src/core");
    var o = require("@angular/compiler/src/output/output_ast");
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
                moduleUrl: compile_metadata_1.identifierModuleUrl(comp.type)
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
            result += "_" + compile_metadata_1.identifierName(component.type);
        }
        return result;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvc3R5bGVfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCwyRUFBdUo7SUFDdkosbURBQXlDO0lBQ3pDLDJEQUF5QztJQUN6QywrREFBdUM7SUFJdkMsSUFBTSxrQkFBa0IsR0FBRyxRQUFRLENBQUM7SUFDdkIsUUFBQSxTQUFTLEdBQUcsYUFBVyxrQkFBb0IsQ0FBQztJQUM1QyxRQUFBLFlBQVksR0FBRyxnQkFBYyxrQkFBb0IsQ0FBQztJQUUvRDtRQUNFLGlDQUNXLElBQVksRUFBUyxTQUFpQixFQUFTLFFBQThCO1lBQTdFLFNBQUksR0FBSixJQUFJLENBQVE7WUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFRO1lBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBc0I7UUFBRyxDQUFDO1FBQzlGLDhCQUFDO0lBQUQsQ0FBQyxBQUhELElBR0M7SUFIWSwwREFBdUI7SUFLcEM7UUFDRSw0QkFDVyxTQUF3QixFQUFTLFNBQWlCLEVBQ2xELFlBQXVDLEVBQVMsU0FBa0IsRUFDbEUsSUFBK0I7WUFGL0IsY0FBUyxHQUFULFNBQVMsQ0FBZTtZQUFTLGNBQVMsR0FBVCxTQUFTLENBQVE7WUFDbEQsaUJBQVksR0FBWixZQUFZLENBQTJCO1lBQVMsY0FBUyxHQUFULFNBQVMsQ0FBUztZQUNsRSxTQUFJLEdBQUosSUFBSSxDQUEyQjtRQUFHLENBQUM7UUFDaEQseUJBQUM7SUFBRCxDQUFDLEFBTEQsSUFLQztJQUxZLGdEQUFrQjtJQU8vQjtRQUdFLHVCQUFvQixZQUF5QjtZQUF6QixpQkFBWSxHQUFaLFlBQVksQ0FBYTtZQUZyQyxlQUFVLEdBQWMsSUFBSSxzQkFBUyxFQUFFLENBQUM7UUFFQSxDQUFDO1FBRWpELHdDQUFnQixHQUFoQixVQUFpQixTQUF3QixFQUFF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T0FBTyxJQUFJLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBRU8scUNBQWEsR0FBckIsVUFBc0IsS0FBYSxFQUFFLElBQWE7WUFDaEQsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxvQkFBWSxFQUFFLGlCQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3BGLENBQUM7UUFDSCxvQkFBQztJQUFELENBQUMsQUExREQsSUEwREM7SUExRFksc0NBQWE7SUE0RDFCLDBCQUEwQixTQUEwQztRQUNsRSxJQUFJLE1BQU0sR0FBRyxRQUFRLENBQUM7UUFDdEIsSUFBSSxTQUFTLEVBQUU7WUFDYixNQUFNLElBQUksTUFBSSxpQ0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUcsQ0FBQztTQUNoRDtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhLCBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhLCBpZGVudGlmaWVyTW9kdWxlVXJsLCBpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4vY29yZSc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtTaGFkb3dDc3N9IGZyb20gJy4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge1VybFJlc29sdmVyfSBmcm9tICcuL3VybF9yZXNvbHZlcic7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IENPTVBPTkVOVF9WQVJJQUJMRSA9ICclQ09NUCUnO1xuZXhwb3J0IGNvbnN0IEhPU1RfQVRUUiA9IGBfbmdob3N0LSR7Q09NUE9ORU5UX1ZBUklBQkxFfWA7XG5leHBvcnQgY29uc3QgQ09OVEVOVF9BVFRSID0gYF9uZ2NvbnRlbnQtJHtDT01QT05FTlRfVkFSSUFCTEV9YDtcblxuZXhwb3J0IGNsYXNzIFN0eWxlc0NvbXBpbGVEZXBlbmRlbmN5IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgbW9kdWxlVXJsOiBzdHJpbmcsIHB1YmxpYyBzZXRWYWx1ZTogKHZhbHVlOiBhbnkpID0+IHZvaWQpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlZFN0eWxlc2hlZXQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIHB1YmxpYyBzdHlsZXNWYXI6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBkZXBlbmRlbmNpZXM6IFN0eWxlc0NvbXBpbGVEZXBlbmRlbmN5W10sIHB1YmxpYyBpc1NoaW1tZWQ6IGJvb2xlYW4sXG4gICAgICBwdWJsaWMgbWV0YTogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFN0eWxlQ29tcGlsZXIge1xuICBwcml2YXRlIF9zaGFkb3dDc3M6IFNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF91cmxSZXNvbHZlcjogVXJsUmVzb2x2ZXIpIHt9XG5cbiAgY29tcGlsZUNvbXBvbmVudChvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXA6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSk6IENvbXBpbGVkU3R5bGVzaGVldCB7XG4gICAgY29uc3QgdGVtcGxhdGUgPSBjb21wLnRlbXBsYXRlICE7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVTdHlsZXMoXG4gICAgICAgIG91dHB1dEN0eCwgY29tcCwgbmV3IENvbXBpbGVTdHlsZXNoZWV0TWV0YWRhdGEoe1xuICAgICAgICAgIHN0eWxlczogdGVtcGxhdGUuc3R5bGVzLFxuICAgICAgICAgIHN0eWxlVXJsczogdGVtcGxhdGUuc3R5bGVVcmxzLFxuICAgICAgICAgIG1vZHVsZVVybDogaWRlbnRpZmllck1vZHVsZVVybChjb21wLnR5cGUpXG4gICAgICAgIH0pLFxuICAgICAgICB0aGlzLm5lZWRzU3R5bGVTaGltKGNvbXApLCB0cnVlKTtcbiAgfVxuXG4gIGNvbXBpbGVTdHlsZXMoXG4gICAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXA6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIHN0eWxlc2hlZXQ6IENvbXBpbGVTdHlsZXNoZWV0TWV0YWRhdGEsXG4gICAgICBzaGltOiBib29sZWFuID0gdGhpcy5uZWVkc1N0eWxlU2hpbShjb21wKSk6IENvbXBpbGVkU3R5bGVzaGVldCB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVTdHlsZXMob3V0cHV0Q3R4LCBjb21wLCBzdHlsZXNoZWV0LCBzaGltLCBmYWxzZSk7XG4gIH1cblxuICBuZWVkc1N0eWxlU2hpbShjb21wOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEpOiBib29sZWFuIHtcbiAgICByZXR1cm4gY29tcC50ZW1wbGF0ZSAhLmVuY2Fwc3VsYXRpb24gPT09IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tcGlsZVN0eWxlcyhcbiAgICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgY29tcDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgc3R5bGVzaGVldDogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YSwgc2hpbTogYm9vbGVhbixcbiAgICAgIGlzQ29tcG9uZW50U3R5bGVzaGVldDogYm9vbGVhbik6IENvbXBpbGVkU3R5bGVzaGVldCB7XG4gICAgY29uc3Qgc3R5bGVFeHByZXNzaW9uczogby5FeHByZXNzaW9uW10gPVxuICAgICAgICBzdHlsZXNoZWV0LnN0eWxlcy5tYXAocGxhaW5TdHlsZSA9PiBvLmxpdGVyYWwodGhpcy5fc2hpbUlmTmVlZGVkKHBsYWluU3R5bGUsIHNoaW0pKSk7XG4gICAgY29uc3QgZGVwZW5kZW5jaWVzOiBTdHlsZXNDb21waWxlRGVwZW5kZW5jeVtdID0gW107XG4gICAgc3R5bGVzaGVldC5zdHlsZVVybHMuZm9yRWFjaCgoc3R5bGVVcmwpID0+IHtcbiAgICAgIGNvbnN0IGV4cHJJbmRleCA9IHN0eWxlRXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgICAgLy8gTm90ZTogVGhpcyBwbGFjZWhvbGRlciB3aWxsIGJlIGZpbGxlZCBsYXRlci5cbiAgICAgIHN0eWxlRXhwcmVzc2lvbnMucHVzaChudWxsICEpO1xuICAgICAgZGVwZW5kZW5jaWVzLnB1c2gobmV3IFN0eWxlc0NvbXBpbGVEZXBlbmRlbmN5KFxuICAgICAgICAgIGdldFN0eWxlc1Zhck5hbWUobnVsbCksIHN0eWxlVXJsLFxuICAgICAgICAgICh2YWx1ZSkgPT4gc3R5bGVFeHByZXNzaW9uc1tleHBySW5kZXhdID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIodmFsdWUpKSk7XG4gICAgfSk7XG4gICAgLy8gc3R5bGVzIHZhcmlhYmxlIGNvbnRhaW5zIHBsYWluIHN0cmluZ3MgYW5kIGFycmF5cyBvZiBvdGhlciBzdHlsZXMgYXJyYXlzIChyZWN1cnNpdmUpLFxuICAgIC8vIHNvIHdlIHNldCBpdHMgdHlwZSB0byBkeW5hbWljLlxuICAgIGNvbnN0IHN0eWxlc1ZhciA9IGdldFN0eWxlc1Zhck5hbWUoaXNDb21wb25lbnRTdHlsZXNoZWV0ID8gY29tcCA6IG51bGwpO1xuICAgIGNvbnN0IHN0bXQgPSBvLnZhcmlhYmxlKHN0eWxlc1ZhcilcbiAgICAgICAgICAgICAgICAgICAgIC5zZXQoby5saXRlcmFsQXJyKFxuICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlRXhwcmVzc2lvbnMsIG5ldyBvLkFycmF5VHlwZShvLkRZTkFNSUNfVFlQRSwgW28uVHlwZU1vZGlmaWVyLkNvbnN0XSkpKVxuICAgICAgICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQobnVsbCwgaXNDb21wb25lbnRTdHlsZXNoZWV0ID8gW28uU3RtdE1vZGlmaWVyLkZpbmFsXSA6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgby5TdG10TW9kaWZpZXIuRmluYWwsIG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkXG4gICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKHN0bXQpO1xuICAgIHJldHVybiBuZXcgQ29tcGlsZWRTdHlsZXNoZWV0KG91dHB1dEN0eCwgc3R5bGVzVmFyLCBkZXBlbmRlbmNpZXMsIHNoaW0sIHN0eWxlc2hlZXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2hpbUlmTmVlZGVkKHN0eWxlOiBzdHJpbmcsIHNoaW06IGJvb2xlYW4pOiBzdHJpbmcge1xuICAgIHJldHVybiBzaGltID8gdGhpcy5fc2hhZG93Q3NzLnNoaW1Dc3NUZXh0KHN0eWxlLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOiBzdHlsZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRTdHlsZXNWYXJOYW1lKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhIHwgbnVsbCk6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSBgc3R5bGVzYDtcbiAgaWYgKGNvbXBvbmVudCkge1xuICAgIHJlc3VsdCArPSBgXyR7aWRlbnRpZmllck5hbWUoY29tcG9uZW50LnR5cGUpfWA7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==