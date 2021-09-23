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
        define("@angular/compiler/src/ng_module_compiler", ["require", "exports", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/provider_analyzer", "@angular/compiler/src/view_compiler/provider_compiler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NgModuleCompiler = exports.NgModuleCompileResult = void 0;
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var provider_analyzer_1 = require("@angular/compiler/src/provider_analyzer");
    var provider_compiler_1 = require("@angular/compiler/src/view_compiler/provider_compiler");
    var NgModuleCompileResult = /** @class */ (function () {
        function NgModuleCompileResult(ngModuleFactoryVar) {
            this.ngModuleFactoryVar = ngModuleFactoryVar;
        }
        return NgModuleCompileResult;
    }());
    exports.NgModuleCompileResult = NgModuleCompileResult;
    var LOG_VAR = o.variable('_l');
    var NgModuleCompiler = /** @class */ (function () {
        function NgModuleCompiler(reflector) {
            this.reflector = reflector;
        }
        NgModuleCompiler.prototype.compile = function (ctx, ngModuleMeta, extraProviders) {
            var sourceSpan = (0, parse_util_1.typeSourceSpan)('NgModule', ngModuleMeta.type);
            var entryComponentFactories = ngModuleMeta.transitiveModule.entryComponents;
            var bootstrapComponents = ngModuleMeta.bootstrapComponents;
            var providerParser = new provider_analyzer_1.NgModuleProviderAnalyzer(this.reflector, ngModuleMeta, extraProviders, sourceSpan);
            var providerDefs = [(0, provider_compiler_1.componentFactoryResolverProviderDef)(this.reflector, ctx, 0 /* None */, entryComponentFactories)]
                .concat(providerParser.parse().map(function (provider) { return (0, provider_compiler_1.providerDef)(ctx, provider); }))
                .map(function (_a) {
                var providerExpr = _a.providerExpr, depsExpr = _a.depsExpr, flags = _a.flags, tokenExpr = _a.tokenExpr;
                return o.importExpr(identifiers_1.Identifiers.moduleProviderDef).callFn([
                    o.literal(flags), tokenExpr, providerExpr, depsExpr
                ]);
            });
            var ngModuleDef = o.importExpr(identifiers_1.Identifiers.moduleDef).callFn([o.literalArr(providerDefs)]);
            var ngModuleDefFactory = o.fn([new o.FnParam(LOG_VAR.name)], [new o.ReturnStatement(ngModuleDef)], o.INFERRED_TYPE);
            var ngModuleFactoryVar = (0, parse_util_1.identifierName)(ngModuleMeta.type) + "NgFactory";
            this._createNgModuleFactory(ctx, ngModuleMeta.type.reference, o.importExpr(identifiers_1.Identifiers.createModuleFactory).callFn([
                ctx.importExpr(ngModuleMeta.type.reference),
                o.literalArr(bootstrapComponents.map(function (id) { return ctx.importExpr(id.reference); })),
                ngModuleDefFactory
            ]));
            if (ngModuleMeta.id) {
                var id = typeof ngModuleMeta.id === 'string' ? o.literal(ngModuleMeta.id) :
                    ctx.importExpr(ngModuleMeta.id);
                var registerFactoryStmt = o.importExpr(identifiers_1.Identifiers.RegisterModuleFactoryFn)
                    .callFn([id, o.variable(ngModuleFactoryVar)])
                    .toStmt();
                ctx.statements.push(registerFactoryStmt);
            }
            return new NgModuleCompileResult(ngModuleFactoryVar);
        };
        NgModuleCompiler.prototype.createStub = function (ctx, ngModuleReference) {
            this._createNgModuleFactory(ctx, ngModuleReference, o.NULL_EXPR);
        };
        NgModuleCompiler.prototype._createNgModuleFactory = function (ctx, reference, value) {
            var ngModuleFactoryVar = (0, parse_util_1.identifierName)({ reference: reference }) + "NgFactory";
            var ngModuleFactoryStmt = o.variable(ngModuleFactoryVar)
                .set(value)
                .toDeclStmt(o.importType(identifiers_1.Identifiers.NgModuleFactory, [o.expressionType(ctx.importExpr(reference))], [o.TypeModifier.Const]), [o.StmtModifier.Final, o.StmtModifier.Exported]);
            ctx.statements.push(ngModuleFactoryStmt);
        };
        return NgModuleCompiler;
    }());
    exports.NgModuleCompiler = NgModuleCompiler;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL25nX21vZHVsZV9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFNSCxpRUFBMEM7SUFDMUMsMkRBQXlDO0lBQ3pDLCtEQUE0RDtJQUM1RCw2RUFBNkQ7SUFDN0QsMkZBQTJHO0lBRTNHO1FBQ0UsK0JBQW1CLGtCQUEwQjtZQUExQix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQVE7UUFBRyxDQUFDO1FBQ25ELDRCQUFDO0lBQUQsQ0FBQyxBQUZELElBRUM7SUFGWSxzREFBcUI7SUFJbEMsSUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVqQztRQUNFLDBCQUFvQixTQUEyQjtZQUEzQixjQUFTLEdBQVQsU0FBUyxDQUFrQjtRQUFHLENBQUM7UUFDbkQsa0NBQU8sR0FBUCxVQUNJLEdBQWtCLEVBQUUsWUFBcUMsRUFDekQsY0FBeUM7WUFDM0MsSUFBTSxVQUFVLEdBQUcsSUFBQSwyQkFBYyxFQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakUsSUFBTSx1QkFBdUIsR0FBRyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxDQUFDO1lBQzlFLElBQU0sbUJBQW1CLEdBQUcsWUFBWSxDQUFDLG1CQUFtQixDQUFDO1lBQzdELElBQU0sY0FBYyxHQUNoQixJQUFJLDRDQUF3QixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUMzRixJQUFNLFlBQVksR0FDZCxDQUFDLElBQUEsdURBQW1DLEVBQy9CLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxnQkFBa0IsdUJBQXVCLENBQUMsQ0FBQztpQkFDOUQsTUFBTSxD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QUMsU0FBUyxFQUFFLFNBQVMsRUFBQyxDQUFDLGNBQVcsQ0FBQztZQUNoRixJQUFNLG1CQUFtQixHQUNyQixDQUFDLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDO2lCQUN6QixHQUFHLENBQUMsS0FBSyxDQUFDO2lCQUNWLFVBQVUsQ0FDUCxDQUFDLENBQUMsVUFBVSxDQUNSLHlCQUFXLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFFLENBQUMsRUFDM0UsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQzNCLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBRTdELEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUNILHVCQUFDO0lBQUQsQ0FBQyxBQTdERCxJQTZEQztJQTdEWSw0Q0FBZ0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlTmdNb2R1bGVNZXRhZGF0YSwgQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGF9IGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtOb2RlRmxhZ3N9IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2lkZW50aWZpZXJOYW1lLCB0eXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7TmdNb2R1bGVQcm92aWRlckFuYWx5emVyfSBmcm9tICcuL3Byb3ZpZGVyX2FuYWx5emVyJztcbmltcG9ydCB7Y29tcG9uZW50RmFjdG9yeVJlc29sdmVyUHJvdmlkZXJEZWYsIGRlcERlZiwgcHJvdmlkZXJEZWZ9IGZyb20gJy4vdmlld19jb21waWxlci9wcm92aWRlcl9jb21waWxlcic7XG5cbmV4cG9ydCBjbGFzcyBOZ01vZHVsZUNvbXBpbGVSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmdNb2R1bGVGYWN0b3J5VmFyOiBzdHJpbmcpIHt9XG59XG5cbmNvbnN0IExPR19WQVIgPSBvLnZhcmlhYmxlKCdfbCcpO1xuXG5leHBvcnQgY2xhc3MgTmdNb2R1bGVDb21waWxlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7fVxuICBjb21waWxlKFxuICAgICAgY3R4OiBPdXRwdXRDb250ZXh0LCBuZ01vZHVsZU1ldGE6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLFxuICAgICAgZXh0cmFQcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10pOiBOZ01vZHVsZUNvbXBpbGVSZXN1bHQge1xuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0eXBlU291cmNlU3BhbignTmdNb2R1bGUnLCBuZ01vZHVsZU1ldGEudHlwZSk7XG4gICAgY29uc3QgZW50cnlDb21wb25lbnRGYWN0b3JpZXMgPSBuZ01vZHVsZU1ldGEudHJhbnNpdGl2ZU1vZHVsZS5lbnRyeUNvbXBvbmVudHM7XG4gICAgY29uc3QgYm9vdHN0cmFwQ29tcG9uZW50cyA9IG5nTW9kdWxlTWV0YS5ib290c3RyYXBDb21wb25lbnRzO1xuICAgIGNvbnN0IHByb3ZpZGVyUGFyc2VyID1cbiAgICAgICAgbmV3IE5nTW9kdWxlUHJvdmlkZXJBbmFseXplcih0aGlzLnJlZmxlY3RvciwgbmdNb2R1bGVNZXRhLCBleHRyYVByb3ZpZGVycywgc291cmNlU3Bhbik7XG4gICAgY29uc3QgcHJvdmlkZXJEZWZzID1cbiAgICAgICAgW2NvbXBvbmVudEZhY3RvcnlSZXNvbHZlclByb3ZpZGVyRGVmKFxuICAgICAgICAgICAgIHRoaXMucmVmbGVjdG9yLCBjdHgsIE5vZGVGbGFncy5Ob25lLCBlbnRyeUNvbXBvbmVudEZhY3RvcmllcyldXG4gICAgICAgICAgICAuY29uY2F0KHByb3ZpZGVyUGFyc2VyLnBhcnNlKCkubWFwKChwcm92aWRlcikgPT4gcHJvdmlkZXJEZWYoY3R4LCBwcm92aWRlcikpKVxuICAgICAgICAgICAgLm1hcCgoe3Byb3ZpZGVyRXhwciwgZGVwc0V4cHIsIGZsYWdzLCB0b2tlbkV4cHJ9KSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubW9kdWxlUHJvdmlkZXJEZWYpLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGZsYWdzKSwgdG9rZW5FeHByLCBwcm92aWRlckV4cHIsIGRlcHNFeHByXG4gICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICBjb25zdCBuZ01vZHVsZURlZiA9IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5tb2R1bGVEZWYpLmNhbGxGbihbby5saXRlcmFsQXJyKHByb3ZpZGVyRGVmcyldKTtcbiAgICBjb25zdCBuZ01vZHVsZURlZkZhY3RvcnkgPVxuICAgICAgICBvLmZuKFtuZXcgby5GblBhcmFtKExPR19WQVIubmFtZSEpXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChuZ01vZHVsZURlZildLCBvLklORkVSUkVEX1RZUEUpO1xuXG4gICAgY29uc3QgbmdNb2R1bGVGYWN0b3J5VmFyID0gYCR7aWRlbnRpZmllck5hbWUobmdNb2R1bGVNZXRhLnR5cGUpfU5nRmFjdG9yeWA7XG4gICAgdGhpcy5fY3JlYXRlTmdNb2R1bGVGYWN0b3J5KFxuICAgICAgICBjdHgsIG5nTW9kdWxlTWV0YS50eXBlLnJlZmVyZW5jZSwgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmNyZWF0ZU1vZHVsZUZhY3RvcnkpLmNhbGxGbihbXG4gICAgICAgICAgY3R4LmltcG9ydEV4cHIobmdNb2R1bGVNZXRhLnR5cGUucmVmZXJlbmNlKSxcbiAgICAgICAgICBvLmxpdGVyYWxBcnIoYm9vdHN0cmFwQ29tcG9uZW50cy5tYXAoaWQgPT4gY3R4LmltcG9ydEV4cHIoaWQucmVmZXJlbmNlKSkpLFxuICAgICAgICAgIG5nTW9kdWxlRGVmRmFjdG9yeVxuICAgICAgICBdKSk7XG5cbiAgICBpZiAobmdNb2R1bGVNZXRhLmlkKSB7XG4gICAgICBjb25zdCBpZCA9IHR5cGVvZiBuZ01vZHVsZU1ldGEuaWQgPT09ICdzdHJpbmcnID8gby5saXRlcmFsKG5nTW9kdWxlTWV0YS5pZCkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5pbXBvcnRFeHByKG5nTW9kdWxlTWV0YS5pZCk7XG4gICAgICBjb25zdCByZWdpc3RlckZhY3RvcnlTdG10ID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLlJlZ2lzdGVyTW9kdWxlRmFjdG9yeUZuKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbEZuKFtpZCwgby52YXJpYWJsZShuZ01vZHVsZUZhY3RvcnlWYXIpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RtdCgpO1xuICAgICAgY3R4LnN0YXRlbWVudHMucHVzaChyZWdpc3RlckZhY3RvcnlTdG10KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IE5nTW9kdWxlQ29tcGlsZVJlc3VsdChuZ01vZHVsZUZhY3RvcnlWYXIpO1xuICB9XG5cbiAgY3JlYXRlU3R1YihjdHg6IE91dHB1dENvbnRleHQsIG5nTW9kdWxlUmVmZXJlbmNlOiBhbnkpIHtcbiAgICB0aGlzLl9jcmVhdGVOZ01vZHVsZUZhY3RvcnkoY3R4LCBuZ01vZHVsZVJlZmVyZW5jZSwgby5OVUxMX0VYUFIpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlTmdNb2R1bGVGYWN0b3J5KGN0eDogT3V0cHV0Q29udGV4dCwgcmVmZXJlbmNlOiBhbnksIHZhbHVlOiBvLkV4cHJlc3Npb24pIHtcbiAgICBjb25zdCBuZ01vZHVsZUZhY3RvcnlWYXIgPSBgJHtpZGVudGlmaWVyTmFtZSh7cmVmZXJlbmNlOiByZWZlcmVuY2V9KX1OZ0ZhY3RvcnlgO1xuICAgIGNvbnN0IG5nTW9kdWxlRmFjdG9yeVN0bXQgPVxuICAgICAgICBvLnZhcmlhYmxlKG5nTW9kdWxlRmFjdG9yeVZhcilcbiAgICAgICAgICAgIC5zZXQodmFsdWUpXG4gICAgICAgICAgICAudG9EZWNsU3RtdChcbiAgICAgICAgICAgICAgICBvLmltcG9ydFR5cGUoXG4gICAgICAgICAgICAgICAgICAgIElkZW50aWZpZXJzLk5nTW9kdWxlRmFjdG9yeSwgW28uZXhwcmVzc2lvblR5cGUoY3R4LmltcG9ydEV4cHIocmVmZXJlbmNlKSkhXSxcbiAgICAgICAgICAgICAgICAgICAgW28uVHlwZU1vZGlmaWVyLkNvbnN0XSksXG4gICAgICAgICAgICAgICAgW28uU3RtdE1vZGlmaWVyLkZpbmFsLCBvLlN0bXRNb2RpZmllci5FeHBvcnRlZF0pO1xuXG4gICAgY3R4LnN0YXRlbWVudHMucHVzaChuZ01vZHVsZUZhY3RvcnlTdG10KTtcbiAgfVxufVxuIl19