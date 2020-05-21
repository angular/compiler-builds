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
        define("@angular/compiler/src/view_compiler/provider_compiler", ["require", "exports", "@angular/compiler/src/identifiers", "@angular/compiler/src/lifecycle_reflector", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/value_util", "@angular/compiler/src/template_parser/template_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.componentFactoryResolverProviderDef = exports.lifecycleHookToNodeFlag = exports.depDef = exports.providerDef = void 0;
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var lifecycle_reflector_1 = require("@angular/compiler/src/lifecycle_reflector");
    var o = require("@angular/compiler/src/output/output_ast");
    var value_util_1 = require("@angular/compiler/src/output/value_util");
    var template_ast_1 = require("@angular/compiler/src/template_parser/template_ast");
    function providerDef(ctx, providerAst) {
        var flags = 0 /* None */;
        if (!providerAst.eager) {
            flags |= 4096 /* LazyProvider */;
        }
        if (providerAst.providerType === template_ast_1.ProviderAstType.PrivateService) {
            flags |= 8192 /* PrivateProvider */;
        }
        if (providerAst.isModule) {
            flags |= 1073741824 /* TypeModuleProvider */;
        }
        providerAst.lifecycleHooks.forEach(function (lifecycleHook) {
            // for regular providers, we only support ngOnDestroy
            if (lifecycleHook === lifecycle_reflector_1.LifecycleHooks.OnDestroy ||
                providerAst.providerType === template_ast_1.ProviderAstType.Directive ||
                providerAst.providerType === template_ast_1.ProviderAstType.Component) {
                flags |= lifecycleHookToNodeFlag(lifecycleHook);
            }
        });
        var _a = providerAst.multiProvider ?
            multiProviderDef(ctx, flags, providerAst.providers) :
            singleProviderDef(ctx, flags, providerAst.providerType, providerAst.providers[0]), providerExpr = _a.providerExpr, providerFlags = _a.flags, depsExpr = _a.depsExpr;
        return {
            providerExpr: providerExpr,
            flags: providerFlags,
            depsExpr: depsExpr,
            tokenExpr: tokenExpr(ctx, providerAst.token),
        };
    }
    exports.providerDef = providerDef;
    function multiProviderDef(ctx, flags, providers) {
        var allDepDefs = [];
        var allParams = [];
        var exprs = providers.map(function (provider, providerIndex) {
            var expr;
            if (provider.useClass) {
                var depExprs = convertDeps(providerIndex, provider.deps || provider.useClass.diDeps);
                expr = ctx.importExpr(provider.useClass.reference).instantiate(depExprs);
            }
            else if (provider.useFactory) {
                var depExprs = convertDeps(providerIndex, provider.deps || provider.useFactory.diDeps);
                expr = ctx.importExpr(provider.useFactory.reference).callFn(depExprs);
            }
            else if (provider.useExisting) {
                var depExprs = convertDeps(providerIndex, [{ token: provider.useExisting }]);
                expr = depExprs[0];
            }
            else {
                expr = value_util_1.convertValueToOutputAst(ctx, provider.useValue);
            }
            return expr;
        });
        var providerExpr = o.fn(allParams, [new o.ReturnStatement(o.literalArr(exprs))], o.INFERRED_TYPE);
        return {
            providerExpr: providerExpr,
            flags: flags | 1024 /* TypeFactoryProvider */,
            depsExpr: o.literalArr(allDepDefs)
        };
        function convertDeps(providerIndex, deps) {
            return deps.map(function (dep, depIndex) {
                var paramName = "p" + providerIndex + "_" + depIndex;
                allParams.push(new o.FnParam(paramName, o.DYNAMIC_TYPE));
                allDepDefs.push(depDef(ctx, dep));
                return o.variable(paramName);
            });
        }
    }
    function singleProviderDef(ctx, flags, providerType, providerMeta) {
        var providerExpr;
        var deps;
        if (providerType === template_ast_1.ProviderAstType.Directive || providerType === template_ast_1.ProviderAstType.Component) {
            providerExpr = ctx.importExpr(providerMeta.useClass.reference);
            flags |= 16384 /* TypeDirective */;
            deps = providerMeta.deps || providerMeta.useClass.diDeps;
        }
        else {
            if (providerMeta.useClass) {
                providerExpr = ctx.importExpr(providerMeta.useClass.reference);
                flags |= 512 /* TypeClassProvider */;
                deps = providerMeta.deps || providerMeta.useClass.diDeps;
            }
            else if (providerMeta.useFactory) {
                providerExpr = ctx.importExpr(providerMeta.useFactory.reference);
                flags |= 1024 /* TypeFactoryProvider */;
                deps = providerMeta.deps || providerMeta.useFactory.diDeps;
            }
            else if (providerMeta.useExisting) {
                providerExpr = o.NULL_EXPR;
                flags |= 2048 /* TypeUseExistingProvider */;
                deps = [{ token: providerMeta.useExisting }];
            }
            else {
                providerExpr = value_util_1.convertValueToOutputAst(ctx, providerMeta.useValue);
                flags |= 256 /* TypeValueProvider */;
                deps = [];
            }
        }
        var depsExpr = o.literalArr(deps.map(function (dep) { return depDef(ctx, dep); }));
        return { providerExpr: providerExpr, flags: flags, depsExpr: depsExpr };
    }
    function tokenExpr(ctx, tokenMeta) {
        return tokenMeta.identifier ? ctx.importExpr(tokenMeta.identifier.reference) :
            o.literal(tokenMeta.value);
    }
    function depDef(ctx, dep) {
        // Note: the following fields have already been normalized out by provider_analyzer:
        // - isAttribute, isHost
        var expr = dep.isValue ? value_util_1.convertValueToOutputAst(ctx, dep.value) : tokenExpr(ctx, dep.token);
        var flags = 0 /* None */;
        if (dep.isSkipSelf) {
            flags |= 1 /* SkipSelf */;
        }
        if (dep.isOptional) {
            flags |= 2 /* Optional */;
        }
        if (dep.isSelf) {
            flags |= 4 /* Self */;
        }
        if (dep.isValue) {
            flags |= 8 /* Value */;
        }
        return flags === 0 /* None */ ? expr : o.literalArr([o.literal(flags), expr]);
    }
    exports.depDef = depDef;
    function lifecycleHookToNodeFlag(lifecycleHook) {
        var nodeFlag = 0 /* None */;
        switch (lifecycleHook) {
            case lifecycle_reflector_1.LifecycleHooks.AfterContentChecked:
                nodeFlag = 2097152 /* AfterContentChecked */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.AfterContentInit:
                nodeFlag = 1048576 /* AfterContentInit */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.AfterViewChecked:
                nodeFlag = 8388608 /* AfterViewChecked */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.AfterViewInit:
                nodeFlag = 4194304 /* AfterViewInit */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.DoCheck:
                nodeFlag = 262144 /* DoCheck */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.OnChanges:
                nodeFlag = 524288 /* OnChanges */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.OnDestroy:
                nodeFlag = 131072 /* OnDestroy */;
                break;
            case lifecycle_reflector_1.LifecycleHooks.OnInit:
                nodeFlag = 65536 /* OnInit */;
                break;
        }
        return nodeFlag;
    }
    exports.lifecycleHookToNodeFlag = lifecycleHookToNodeFlag;
    function componentFactoryResolverProviderDef(reflector, ctx, flags, entryComponents) {
        var entryComponentFactories = entryComponents.map(function (entryComponent) { return ctx.importExpr(entryComponent.componentFactory); });
        var token = identifiers_1.createTokenForExternalReference(reflector, identifiers_1.Identifiers.ComponentFactoryResolver);
        var classMeta = {
            diDeps: [
                { isValue: true, value: o.literalArr(entryComponentFactories) },
                { token: token, isSkipSelf: true, isOptional: true },
                { token: identifiers_1.createTokenForExternalReference(reflector, identifiers_1.Identifiers.NgModuleRef) },
            ],
            lifecycleHooks: [],
            reference: reflector.resolveExternalReference(identifiers_1.Identifiers.CodegenComponentFactoryResolver)
        };
        var _a = singleProviderDef(ctx, flags, template_ast_1.ProviderAstType.PrivateService, {
            token: token,
            multi: false,
            useClass: classMeta,
        }), providerExpr = _a.providerExpr, providerFlags = _a.flags, depsExpr = _a.depsExpr;
        return { providerExpr: providerExpr, flags: providerFlags, depsExpr: depsExpr, tokenExpr: tokenExpr(ctx, token) };
    }
    exports.componentFactoryResolverProviderDef = componentFactoryResolverProviderDef;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdmlld19jb21waWxlci9wcm92aWRlcl9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFLSCxpRUFBNEU7SUFDNUUsaUZBQXNEO0lBQ3RELDJEQUEwQztJQUMxQyxzRUFBNkQ7SUFDN0QsbUZBQTZFO0lBRzdFLFNBQWdCLFdBQVcsQ0FBQyxHQUFrQixFQUFFLFdBQXdCO1FBTXRFLElBQUksS0FBSyxlQUFpQixDQUFDO1FBQzNCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO1lBQ3RCLEtBQUssMkJBQTBCLENBQUM7U0FDakM7UUFDRCxJQUFJLFdBQVcsQ0FBQyxZQUFZLEtBQUssOEJBQWUsQ0FBQyxjQUFjLEVBQUU7WUFDL0QsS0FBSyw4QkFBNkIsQ0FBQztTQUNwQztRQUNELElBQUksV0FBVyxDQUFDLFFBQVEsRUFBRTtZQUN4QixLQUFLLHVDQUFnQyxDQUFDO1NBQ3ZDO1FBQ0QsV0FBVyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsVUFBQyxhQUFhO1lBQy9DLHFEQUFxRDtZQUNyRCxJQUFJLGFBQWEsS0FBSyxvQ0FBYyxDQUFDLFNBQVM7Z0JBQzFDLFdBQVcsQ0FBQyxZQUFZLEtBQUssOEJBQWUsQ0FBQyxTQUFTO2dCQUN0RCxXQUFXLENBQUMsWUFBWSxLQUFLLDhCQUFlLENBQUMsU0FBUyxFQUFFO2dCQUMxRCxLQUFLLElBQUksdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDakQ7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNHLElBQUEsS0FBaUQsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzlFLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7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QSxFQUFFLFFBQVEsY0FLN0MsQ0FBQztRQUNQLE9BQU8sRUFBQyxZQUFZLGNBQUEsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLFFBQVEsVUFBQSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFDLENBQUM7SUFDMUYsQ0FBQztJQTNCRCxrRkEyQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhLCBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YSwgQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEsIENvbXBpbGVUb2tlbk1ldGFkYXRhfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtEZXBGbGFncywgTm9kZUZsYWdzfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7Y3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSwgSWRlbnRpZmllcnN9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCB7TGlmZWN5Y2xlSG9va3N9IGZyb20gJy4uL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2NvbnZlcnRWYWx1ZVRvT3V0cHV0QXN0fSBmcm9tICcuLi9vdXRwdXQvdmFsdWVfdXRpbCc7XG5pbXBvcnQge1Byb3ZpZGVyQXN0LCBQcm92aWRlckFzdFR5cGV9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIHByb3ZpZGVyRGVmKGN0eDogT3V0cHV0Q29udGV4dCwgcHJvdmlkZXJBc3Q6IFByb3ZpZGVyQXN0KToge1xuICBwcm92aWRlckV4cHI6IG8uRXhwcmVzc2lvbixcbiAgZmxhZ3M6IE5vZGVGbGFncyxcbiAgZGVwc0V4cHI6IG8uRXhwcmVzc2lvbixcbiAgdG9rZW5FeHByOiBvLkV4cHJlc3Npb25cbn0ge1xuICBsZXQgZmxhZ3MgPSBOb2RlRmxhZ3MuTm9uZTtcbiAgaWYgKCFwcm92aWRlckFzdC5lYWdlcikge1xuICAgIGZsYWdzIHw9IE5vZGVGbGFncy5MYXp5UHJvdmlkZXI7XG4gIH1cbiAgaWYgKHByb3ZpZGVyQXN0LnByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlKSB7XG4gICAgZmxhZ3MgfD0gTm9kZUZsYWdzLlByaXZhdGVQcm92aWRlcjtcbiAgfVxuICBpZiAocHJvdmlkZXJBc3QuaXNNb2R1bGUpIHtcbiAgICBmbGFncyB8PSBOb2RlRmxhZ3MuVHlwZU1vZHVsZVByb3ZpZGVyO1xuICB9XG4gIHByb3ZpZGVyQXN0LmxpZmVjeWNsZUhvb2tzLmZvckVhY2goKGxpZmVjeWNsZUhvb2spID0+IHtcbiAgICAvLyBmb3IgcmVndWxhciBwcm92aWRlcnMsIHdlIG9ubHkgc3VwcG9ydCBuZ09uRGVzdHJveVxuICAgIGlmIChsaWZlY3ljbGVIb29rID09PSBMaWZlY3ljbGVIb29rcy5PbkRlc3Ryb3kgfHxcbiAgICAgICAgcHJvdmlkZXJBc3QucHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuRGlyZWN0aXZlIHx8XG4gICAgICAgIHByb3ZpZGVyQXN0LnByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkNvbXBvbmVudCkge1xuICAgICAgZmxhZ3MgfD0gbGlmZWN5Y2xlSG9va1RvTm9kZUZsYWcobGlmZWN5Y2xlSG9vayk7XG4gICAgfVxuICB9KTtcbiAgY29uc3Qge3Byb3ZpZGVyRXhwciwgZmxhZ3M6IHByb3ZpZGVyRmxhZ3MsIGRlcHNFeHByfSA9IHByb3ZpZGVyQXN0Lm11bHRpUHJvdmlkZXIgP1xuICAgICAgbXVsdGlQcm92aWRlckRlZihjdHgsIGZsYWdzLCBwcm92aWRlckFzdC5wcm92aWRlcnMpIDpcbiAgICAgIHNpbmdsZVByb3ZpZGVyRGVmKGN0eCwgZmxhZ3MsIHByb3ZpZGVyQXN0LnByb3ZpZGVyVHlwZSwgcHJvdmlkZXJBc3QucHJvdmlkZXJzWzBdKTtcbiAgcmV0dXJuIHtcbiAgICBwcm92aWRlckV4cHIsXG4gICAgZmxhZ3M6IHByb3ZpZGVyRmxhZ3MsXG4gICAgZGVwc0V4cHIsXG4gICAgdG9rZW5FeHByOiB0b2tlbkV4cHIoY3R4LCBwcm92aWRlckFzdC50b2tlbiksXG4gIH07XG59XG5cbmZ1bmN0aW9uIG11bHRpUHJvdmlkZXJEZWYoXG4gICAgY3R4OiBPdXRwdXRDb250ZXh0LCBmbGFnczogTm9kZUZsYWdzLCBwcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10pOlxuICAgIHtwcm92aWRlckV4cHI6IG8uRXhwcmVzc2lvbiwgZmxhZ3M6IE5vZGVGbGFncywgZGVwc0V4cHI6IG8uRXhwcmVzc2lvbn0ge1xuICBjb25zdCBhbGxEZXBEZWZzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBjb25zdCBhbGxQYXJhbXM6IG8uRm5QYXJhbVtdID0gW107XG4gIGNvbnN0IGV4cHJzID0gcHJvdmlkZXJzLm1hcCgocHJvdmlkZXIsIHByb3ZpZGVySW5kZXgpID0+IHtcbiAgICBsZXQgZXhwcjogby5FeHByZXNzaW9uO1xuICAgIGlmIChwcm92aWRlci51c2VDbGFzcykge1xuICAgICAgY29uc3QgZGVwRXhwcnMgPSBjb252ZXJ0RGVwcyhwcm92aWRlckluZGV4LCBwcm92aWRlci5kZXBzIHx8IHByb3ZpZGVyLnVzZUNsYXNzLmRpRGVwcyk7XG4gICAgICBleHByID0gY3R4LmltcG9ydEV4cHIocHJvdmlkZXIudXNlQ2xhc3MucmVmZXJlbmNlKS5pbnN0YW50aWF0ZShkZXBFeHBycyk7XG4gICAgfSBlbHNlIGlmIChwcm92aWRlci51c2VGYWN0b3J5KSB7XG4gICAgICBjb25zdCBkZXBFeHBycyA9IGNvbnZlcnREZXBzKHByb3ZpZGVySW5kZXgsIHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlRmFjdG9yeS5kaURlcHMpO1xuICAgICAgZXhwciA9IGN0eC5pbXBvcnRFeHByKHByb3ZpZGVyLnVzZUZhY3RvcnkucmVmZXJlbmNlKS5jYWxsRm4oZGVwRXhwcnMpO1xuICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlRXhpc3RpbmcpIHtcbiAgICAgIGNvbnN0IGRlcEV4cHJzID0gY29udmVydERlcHMocHJvdmlkZXJJbmRleCwgW3t0b2tlbjogcHJvdmlkZXIudXNlRXhpc3Rpbmd9XSk7XG4gICAgICBleHByID0gZGVwRXhwcnNbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cHIgPSBjb252ZXJ0VmFsdWVUb091dHB1dEFzdChjdHgsIHByb3ZpZGVyLnVzZVZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGV4cHI7XG4gIH0pO1xuICBjb25zdCBwcm92aWRlckV4cHIgPVxuICAgICAgby5mbihhbGxQYXJhbXMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKGV4cHJzKSldLCBvLklORkVSUkVEX1RZUEUpO1xuICByZXR1cm4ge1xuICAgIHByb3ZpZGVyRXhwcixcbiAgICBmbGFnczogZmxhZ3MgfCBOb2RlRmxhZ3MuVHlwZUZhY3RvcnlQcm92aWRlcixcbiAgICBkZXBzRXhwcjogby5saXRlcmFsQXJyKGFsbERlcERlZnMpXG4gIH07XG5cbiAgZnVuY3Rpb24gY29udmVydERlcHMocHJvdmlkZXJJbmRleDogbnVtYmVyLCBkZXBzOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXSkge1xuICAgIHJldHVybiBkZXBzLm1hcCgoZGVwLCBkZXBJbmRleCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1OYW1lID0gYHAke3Byb3ZpZGVySW5kZXh9XyR7ZGVwSW5kZXh9YDtcbiAgICAgIGFsbFBhcmFtcy5wdXNoKG5ldyBvLkZuUGFyYW0ocGFyYW1OYW1lLCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgYWxsRGVwRGVmcy5wdXNoKGRlcERlZihjdHgsIGRlcCkpO1xuICAgICAgcmV0dXJuIG8udmFyaWFibGUocGFyYW1OYW1lKTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzaW5nbGVQcm92aWRlckRlZihcbiAgICBjdHg6IE91dHB1dENvbnRleHQsIGZsYWdzOiBOb2RlRmxhZ3MsIHByb3ZpZGVyVHlwZTogUHJvdmlkZXJBc3RUeXBlLFxuICAgIHByb3ZpZGVyTWV0YTogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEpOlxuICAgIHtwcm92aWRlckV4cHI6IG8uRXhwcmVzc2lvbiwgZmxhZ3M6IE5vZGVGbGFncywgZGVwc0V4cHI6IG8uRXhwcmVzc2lvbn0ge1xuICBsZXQgcHJvdmlkZXJFeHByOiBvLkV4cHJlc3Npb247XG4gIGxldCBkZXBzOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXTtcbiAgaWYgKHByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkRpcmVjdGl2ZSB8fCBwcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5Db21wb25lbnQpIHtcbiAgICBwcm92aWRlckV4cHIgPSBjdHguaW1wb3J0RXhwcihwcm92aWRlck1ldGEudXNlQ2xhc3MhLnJlZmVyZW5jZSk7XG4gICAgZmxhZ3MgfD0gTm9kZUZsYWdzLlR5cGVEaXJlY3RpdmU7XG4gICAgZGVwcyA9IHByb3ZpZGVyTWV0YS5kZXBzIHx8IHByb3ZpZGVyTWV0YS51c2VDbGFzcyEuZGlEZXBzO1xuICB9IGVsc2Uge1xuICAgIGlmIChwcm92aWRlck1ldGEudXNlQ2xhc3MpIHtcbiAgICAgIHByb3ZpZGVyRXhwciA9IGN0eC5pbXBvcnRFeHByKHByb3ZpZGVyTWV0YS51c2VDbGFzcy5yZWZlcmVuY2UpO1xuICAgICAgZmxhZ3MgfD0gTm9kZUZsYWdzLlR5cGVDbGFzc1Byb3ZpZGVyO1xuICAgICAgZGVwcyA9IHByb3ZpZGVyTWV0YS5kZXBzIHx8IHByb3ZpZGVyTWV0YS51c2VDbGFzcy5kaURlcHM7XG4gICAgfSBlbHNlIGlmIChwcm92aWRlck1ldGEudXNlRmFjdG9yeSkge1xuICAgICAgcHJvdmlkZXJFeHByID0gY3R4LmltcG9ydEV4cHIocHJvdmlkZXJNZXRhLnVzZUZhY3RvcnkucmVmZXJlbmNlKTtcbiAgICAgIGZsYWdzIHw9IE5vZGVGbGFncy5UeXBlRmFjdG9yeVByb3ZpZGVyO1xuICAgICAgZGVwcyA9IHByb3ZpZGVyTWV0YS5kZXBzIHx8IHByb3ZpZGVyTWV0YS51c2VGYWN0b3J5LmRpRGVwcztcbiAgICB9IGVsc2UgaWYgKHByb3ZpZGVyTWV0YS51c2VFeGlzdGluZykge1xuICAgICAgcHJvdmlkZXJFeHByID0gby5OVUxMX0VYUFI7XG4gICAgICBmbGFncyB8PSBOb2RlRmxhZ3MuVHlwZVVzZUV4aXN0aW5nUHJvdmlkZXI7XG4gICAgICBkZXBzID0gW3t0b2tlbjogcHJvdmlkZXJNZXRhLnVzZUV4aXN0aW5nfV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHByb3ZpZGVyRXhwciA9IGNvbnZlcnRWYWx1ZVRvT3V0cHV0QXN0KGN0eCwgcHJvdmlkZXJNZXRhLnVzZVZhbHVlKTtcbiAgICAgIGZsYWdzIHw9IE5vZGVGbGFncy5UeXBlVmFsdWVQcm92aWRlcjtcbiAgICAgIGRlcHMgPSBbXTtcbiAgICB9XG4gIH1cbiAgY29uc3QgZGVwc0V4cHIgPSBvLmxpdGVyYWxBcnIoZGVwcy5tYXAoZGVwID0+IGRlcERlZihjdHgsIGRlcCkpKTtcbiAgcmV0dXJuIHtwcm92aWRlckV4cHIsIGZsYWdzLCBkZXBzRXhwcn07XG59XG5cbmZ1bmN0aW9uIHRva2VuRXhwcihjdHg6IE91dHB1dENvbnRleHQsIHRva2VuTWV0YTogQ29tcGlsZVRva2VuTWV0YWRhdGEpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gdG9rZW5NZXRhLmlkZW50aWZpZXIgPyBjdHguaW1wb3J0RXhwcih0b2tlbk1ldGEuaWRlbnRpZmllci5yZWZlcmVuY2UpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKHRva2VuTWV0YS52YWx1ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXBEZWYoY3R4OiBPdXRwdXRDb250ZXh0LCBkZXA6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIC8vIE5vdGU6IHRoZSBmb2xsb3dpbmcgZmllbGRzIGhhdmUgYWxyZWFkeSBiZWVuIG5vcm1hbGl6ZWQgb3V0IGJ5IHByb3ZpZGVyX2FuYWx5emVyOlxuICAvLyAtIGlzQXR0cmlidXRlLCBpc0hvc3RcbiAgY29uc3QgZXhwciA9IGRlcC5pc1ZhbHVlID8gY29udmVydFZhbHVlVG9PdXRwdXRBc3QoY3R4LCBkZXAudmFsdWUpIDogdG9rZW5FeHByKGN0eCwgZGVwLnRva2VuISk7XG4gIGxldCBmbGFncyA9IERlcEZsYWdzLk5vbmU7XG4gIGlmIChkZXAuaXNTa2lwU2VsZikge1xuICAgIGZsYWdzIHw9IERlcEZsYWdzLlNraXBTZWxmO1xuICB9XG4gIGlmIChkZXAuaXNPcHRpb25hbCkge1xuICAgIGZsYWdzIHw9IERlcEZsYWdzLk9wdGlvbmFsO1xuICB9XG4gIGlmIChkZXAuaXNTZWxmKSB7XG4gICAgZmxhZ3MgfD0gRGVwRmxhZ3MuU2VsZjtcbiAgfVxuICBpZiAoZGVwLmlzVmFsdWUpIHtcbiAgICBmbGFncyB8PSBEZXBGbGFncy5WYWx1ZTtcbiAgfVxuICByZXR1cm4gZmxhZ3MgPT09IERlcEZsYWdzLk5vbmUgPyBleHByIDogby5saXRlcmFsQXJyKFtvLmxpdGVyYWwoZmxhZ3MpLCBleHByXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaWZlY3ljbGVIb29rVG9Ob2RlRmxhZyhsaWZlY3ljbGVIb29rOiBMaWZlY3ljbGVIb29rcyk6IE5vZGVGbGFncyB7XG4gIGxldCBub2RlRmxhZyA9IE5vZGVGbGFncy5Ob25lO1xuICBzd2l0Y2ggKGxpZmVjeWNsZUhvb2spIHtcbiAgICBjYXNlIExpZmVjeWNsZUhvb2tzLkFmdGVyQ29udGVudENoZWNrZWQ6XG4gICAgICBub2RlRmxhZyA9IE5vZGVGbGFncy5BZnRlckNvbnRlbnRDaGVja2VkO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBMaWZlY3ljbGVIb29rcy5BZnRlckNvbnRlbnRJbml0OlxuICAgICAgbm9kZUZsYWcgPSBOb2RlRmxhZ3MuQWZ0ZXJDb250ZW50SW5pdDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgTGlmZWN5Y2xlSG9va3MuQWZ0ZXJWaWV3Q2hlY2tlZDpcbiAgICAgIG5vZGVGbGFnID0gTm9kZUZsYWdzLkFmdGVyVmlld0NoZWNrZWQ7XG4gICAgICBicmVhaztcbiAgICBjYXNlIExpZmVjeWNsZUhvb2tzLkFmdGVyVmlld0luaXQ6XG4gICAgICBub2RlRmxhZyA9IE5vZGVGbGFncy5BZnRlclZpZXdJbml0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBMaWZlY3ljbGVIb29rcy5Eb0NoZWNrOlxuICAgICAgbm9kZUZsYWcgPSBOb2RlRmxhZ3MuRG9DaGVjaztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgTGlmZWN5Y2xlSG9va3MuT25DaGFuZ2VzOlxuICAgICAgbm9kZUZsYWcgPSBOb2RlRmxhZ3MuT25DaGFuZ2VzO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBMaWZlY3ljbGVIb29rcy5PbkRlc3Ryb3k6XG4gICAgICBub2RlRmxhZyA9IE5vZGVGbGFncy5PbkRlc3Ryb3k7XG4gICAgICBicmVhaztcbiAgICBjYXNlIExpZmVjeWNsZUhvb2tzLk9uSW5pdDpcbiAgICAgIG5vZGVGbGFnID0gTm9kZUZsYWdzLk9uSW5pdDtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHJldHVybiBub2RlRmxhZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudEZhY3RvcnlSZXNvbHZlclByb3ZpZGVyRGVmKFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgY3R4OiBPdXRwdXRDb250ZXh0LCBmbGFnczogTm9kZUZsYWdzLFxuICAgIGVudHJ5Q29tcG9uZW50czogQ29tcGlsZUVudHJ5Q29tcG9uZW50TWV0YWRhdGFbXSk6IHtcbiAgcHJvdmlkZXJFeHByOiBvLkV4cHJlc3Npb24sXG4gIGZsYWdzOiBOb2RlRmxhZ3MsXG4gIGRlcHNFeHByOiBvLkV4cHJlc3Npb24sXG4gIHRva2VuRXhwcjogby5FeHByZXNzaW9uXG59IHtcbiAgY29uc3QgZW50cnlDb21wb25lbnRGYWN0b3JpZXMgPVxuICAgICAgZW50cnlDb21wb25lbnRzLm1hcCgoZW50cnlDb21wb25lbnQpID0+IGN0eC5pbXBvcnRFeHByKGVudHJ5Q29tcG9uZW50LmNvbXBvbmVudEZhY3RvcnkpKTtcbiAgY29uc3QgdG9rZW4gPSBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHJlZmxlY3RvciwgSWRlbnRpZmllcnMuQ29tcG9uZW50RmFjdG9yeVJlc29sdmVyKTtcbiAgY29uc3QgY2xhc3NNZXRhID0ge1xuICAgIGRpRGVwczogW1xuICAgICAge2lzVmFsdWU6IHRydWUsIHZhbHVlOiBvLmxpdGVyYWxBcnIoZW50cnlDb21wb25lbnRGYWN0b3JpZXMpfSxcbiAgICAgIHt0b2tlbjogdG9rZW4sIGlzU2tpcFNlbGY6IHRydWUsIGlzT3B0aW9uYWw6IHRydWV9LFxuICAgICAge3Rva2VuOiBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHJlZmxlY3RvciwgSWRlbnRpZmllcnMuTmdNb2R1bGVSZWYpfSxcbiAgICBdLFxuICAgIGxpZmVjeWNsZUhvb2tzOiBbXSxcbiAgICByZWZlcmVuY2U6IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuQ29kZWdlbkNvbXBvbmVudEZhY3RvcnlSZXNvbHZlcilcbiAgfTtcbiAgY29uc3Qge3Byb3ZpZGVyRXhwciwgZmxhZ3M6IHByb3ZpZGVyRmxhZ3MsIGRlcHNFeHByfSA9XG4gICAgICBzaW5nbGVQcm92aWRlckRlZihjdHgsIGZsYWdzLCBQcm92aWRlckFzdFR5cGUuUHJpdmF0ZVNlcnZpY2UsIHtcbiAgICAgICAgdG9rZW4sXG4gICAgICAgIG11bHRpOiBmYWxzZSxcbiAgICAgICAgdXNlQ2xhc3M6IGNsYXNzTWV0YSxcbiAgICAgIH0pO1xuICByZXR1cm4ge3Byb3ZpZGVyRXhwciwgZmxhZ3M6IHByb3ZpZGVyRmxhZ3MsIGRlcHNFeHByLCB0b2tlbkV4cHI6IHRva2VuRXhwcihjdHgsIHRva2VuKX07XG59XG4iXX0=