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
        define("@angular/compiler/src/aot/lazy_routes", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseLazyRoute = exports.listLazyRoutes = void 0;
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    function listLazyRoutes(moduleMeta, reflector) {
        var e_1, _a, e_2, _b;
        var allLazyRoutes = [];
        try {
            for (var _c = tslib_1.__values(moduleMeta.transitiveModule.providers), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = _d.value, provider = _e.provider, module = _e.module;
                if (compile_metadata_1.tokenReference(provider.token) === reflector.ROUTES) {
                    var loadChildren = _collectLoadChildren(provider.useValue);
                    try {
                        for (var loadChildren_1 = (e_2 = void 0, tslib_1.__values(loadChildren)), loadChildren_1_1 = loadChildren_1.next(); !loadChildren_1_1.done; loadChildren_1_1 = loadChildren_1.next()) {
                            var route = loadChildren_1_1.value;
                            allLazyRoutes.push(parseLazyRoute(route, reflector, module.reference));
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (loadChildren_1_1 && !loadChildren_1_1.done && (_b = loadChildren_1.return)) _b.call(loadChildren_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return allLazyRoutes;
    }
    exports.listLazyRoutes = listLazyRoutes;
    function _collectLoadChildren(routes, target) {
        var e_3, _a;
        if (target === void 0) { target = []; }
        if (typeof routes === 'string') {
            target.push(routes);
        }
        else if (Array.isArray(routes)) {
            try {
                for (var routes_1 = tslib_1.__values(routes), routes_1_1 = routes_1.next(); !routes_1_1.done; routes_1_1 = routes_1.next()) {
                    var route = routes_1_1.value;
                    _collectLoadChildren(route, target);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (routes_1_1 && !routes_1_1.done && (_a = routes_1.return)) _a.call(routes_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
        else if (routes.loadChildren) {
            _collectLoadChildren(routes.loadChildren, target);
        }
        else if (routes.children) {
            _collectLoadChildren(routes.children, target);
        }
        return target;
    }
    function parseLazyRoute(route, reflector, module) {
        var _a = tslib_1.__read(route.split('#'), 2), routePath = _a[0], routeName = _a[1];
        var referencedModule = reflector.resolveExternalReference({
            moduleName: routePath,
            name: routeName,
        }, module ? module.filePath : undefined);
        return { route: route, module: module || referencedModule, referencedModule: referencedModule };
    }
    exports.parseLazyRoute = parseLazyRoute;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF6eV9yb3V0ZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvYW90L2xhenlfcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCwyRUFBNEU7SUFjNUUsU0FBZ0IsY0FBYyxDQUMxQixVQUFtQyxFQUFFLFNBQTBCOztRQUNqRSxJQUFNLGFBQWEsR0FBZ0IsRUFBRSxDQUFDOztZQUN0QyxLQUFpQyxJQUFBLEtBQUEsaUJBQUEsVUFBVSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQSxnQkFBQSw0QkFBRTtnQkFBN0QsSUFBQSxhQUFrQixFQUFqQixRQUFRLGNBQUEsRUFBRSxNQUFNLFlBQUE7Z0JBQzFCLElBQUksaUNBQWMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssU0FBUyxDQUFDLE1BQU0sRUFBRTtvQkFDdkQsSUFBTSxZQUFZLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDOzt3QkFDN0QsS0FBb0IsSUFBQSxnQ0FBQSxpQkFBQSxZQUFZLENBQUEsQ0FBQSwwQ0FBQSxvRUFBRTs0QkFBN0IsSUFBTSxLQUFLLHlCQUFBOzRCQUNkLGFBQWEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7eUJBQ3hFOzs7Ozs7Ozs7aUJBQ0Y7YUFDRjs7Ozs7Ozs7O1FBQ0QsT0FBTyxhQUFhLENBQUM7SUFDdkIsQ0FBQztJQVpELHdDQVlDO0lBRUQsU0FBUyxvQkFBb0IsQ0FBQyxNQUE0QixFQUFFLE1BQXFCOztRQUFyQix1QkFBQSxFQUFBLFdBQXFCO1FBQy9FLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1lBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDckI7YUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7O2dCQUNoQyxLQUFvQixJQUFBLFdBQUEsaUJBQUEsTUFBTSxDQUFBLDhCQUFBLGtEQUFFO29CQUF2QixJQUFNLEtBQUssbUJBQUE7b0JBQ2Qsb0JBQW9CLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUNyQzs7Ozs7Ozs7O1NBQ0Y7YUFBTSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUU7WUFDOUIsb0JBQW9CLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztTQUNuRDthQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUMxQixvQkFBb0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQy9DO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELFNBQWdCLGNBQWMsQ0FDMUIsS0FBYSxFQUFFLFNBQTBCLEVBQUUsTUFBcUI7UUFDNUQsSUFBQSxLQUFBLGVBQXlCLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUEsRUFBeEMsU0FBUyxRQUFBLEVBQUUsU0FBUyxRQUFvQixDQUFDO1FBQ2hELElBQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLHdCQUF3QixDQUN2RDtZQUNFLFVBQVUsRUFBRSxTQUFTO1lBQ3JCLElBQUksRUFBRSxTQUFTO1NBQ2hCLEVBQ0QsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPLEVBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxJQUFJLGdCQUFnQixFQUFFLGdCQUFnQixrQkFBQSxFQUFDLENBQUM7SUFDOUUsQ0FBQztJQVZELHdDQVVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsIHRva2VuUmVmZXJlbmNlfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Um91dGV9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtDb21waWxlTWV0YWRhdGFSZXNvbHZlcn0gZnJvbSAnLi4vbWV0YWRhdGFfcmVzb2x2ZXInO1xuXG5pbXBvcnQge0FvdENvbXBpbGVySG9zdH0gZnJvbSAnLi9jb21waWxlcl9ob3N0JztcbmltcG9ydCB7U3RhdGljUmVmbGVjdG9yfSBmcm9tICcuL3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4vc3RhdGljX3N5bWJvbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGF6eVJvdXRlIHtcbiAgbW9kdWxlOiBTdGF0aWNTeW1ib2w7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIHJlZmVyZW5jZWRNb2R1bGU6IFN0YXRpY1N5bWJvbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RMYXp5Um91dGVzKFxuICAgIG1vZHVsZU1ldGE6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCByZWZsZWN0b3I6IFN0YXRpY1JlZmxlY3Rvcik6IExhenlSb3V0ZVtdIHtcbiAgY29uc3QgYWxsTGF6eVJvdXRlczogTGF6eVJvdXRlW10gPSBbXTtcbiAgZm9yIChjb25zdCB7cHJvdmlkZXIsIG1vZHVsZX0gb2YgbW9kdWxlTWV0YS50cmFuc2l0aXZlTW9kdWxlLnByb3ZpZGVycykge1xuICAgIGlmICh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbikgPT09IHJlZmxlY3Rvci5ST1VURVMpIHtcbiAgICAgIGNvbnN0IGxvYWRDaGlsZHJlbiA9IF9jb2xsZWN0TG9hZENoaWxkcmVuKHByb3ZpZGVyLnVzZVZhbHVlKTtcbiAgICAgIGZvciAoY29uc3Qgcm91dGUgb2YgbG9hZENoaWxkcmVuKSB7XG4gICAgICAgIGFsbExhenlSb3V0ZXMucHVzaChwYXJzZUxhenlSb3V0ZShyb3V0ZSwgcmVmbGVjdG9yLCBtb2R1bGUucmVmZXJlbmNlKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBhbGxMYXp5Um91dGVzO1xufVxuXG5mdW5jdGlvbiBfY29sbGVjdExvYWRDaGlsZHJlbihyb3V0ZXM6IHN0cmluZ3xSb3V0ZXxSb3V0ZVtdLCB0YXJnZXQ6IHN0cmluZ1tdID0gW10pOiBzdHJpbmdbXSB7XG4gIGlmICh0eXBlb2Ygcm91dGVzID09PSAnc3RyaW5nJykge1xuICAgIHRhcmdldC5wdXNoKHJvdXRlcyk7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShyb3V0ZXMpKSB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiByb3V0ZXMpIHtcbiAgICAgIF9jb2xsZWN0TG9hZENoaWxkcmVuKHJvdXRlLCB0YXJnZXQpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChyb3V0ZXMubG9hZENoaWxkcmVuKSB7XG4gICAgX2NvbGxlY3RMb2FkQ2hpbGRyZW4ocm91dGVzLmxvYWRDaGlsZHJlbiwgdGFyZ2V0KTtcbiAgfSBlbHNlIGlmIChyb3V0ZXMuY2hpbGRyZW4pIHtcbiAgICBfY29sbGVjdExvYWRDaGlsZHJlbihyb3V0ZXMuY2hpbGRyZW4sIHRhcmdldCk7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGF6eVJvdXRlKFxuICAgIHJvdXRlOiBzdHJpbmcsIHJlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yLCBtb2R1bGU/OiBTdGF0aWNTeW1ib2wpOiBMYXp5Um91dGUge1xuICBjb25zdCBbcm91dGVQYXRoLCByb3V0ZU5hbWVdID0gcm91dGUuc3BsaXQoJyMnKTtcbiAgY29uc3QgcmVmZXJlbmNlZE1vZHVsZSA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoXG4gICAgICB7XG4gICAgICAgIG1vZHVsZU5hbWU6IHJvdXRlUGF0aCxcbiAgICAgICAgbmFtZTogcm91dGVOYW1lLFxuICAgICAgfSxcbiAgICAgIG1vZHVsZSA/IG1vZHVsZS5maWxlUGF0aCA6IHVuZGVmaW5lZCk7XG4gIHJldHVybiB7cm91dGU6IHJvdXRlLCBtb2R1bGU6IG1vZHVsZSB8fCByZWZlcmVuY2VkTW9kdWxlLCByZWZlcmVuY2VkTW9kdWxlfTtcbn1cbiJdfQ==