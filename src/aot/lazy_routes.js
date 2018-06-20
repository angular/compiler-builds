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
        define("@angular/compiler/src/aot/lazy_routes", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    function listLazyRoutes(moduleMeta, reflector) {
        var allLazyRoutes = [];
        try {
            for (var _a = tslib_1.__values(moduleMeta.transitiveModule.providers), _b = _a.next(); !_b.done; _b = _a.next()) {
                var _c = _b.value, provider = _c.provider, module = _c.module;
                if (compile_metadata_1.tokenReference(provider.token) === reflector.ROUTES) {
                    var loadChildren = _collectLoadChildren(provider.useValue);
                    try {
                        for (var loadChildren_1 = tslib_1.__values(loadChildren), loadChildren_1_1 = loadChildren_1.next(); !loadChildren_1_1.done; loadChildren_1_1 = loadChildren_1.next()) {
                            var route = loadChildren_1_1.value;
                            allLazyRoutes.push(parseLazyRoute(route, reflector, module.reference));
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (loadChildren_1_1 && !loadChildren_1_1.done && (_d = loadChildren_1.return)) _d.call(loadChildren_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return allLazyRoutes;
        var e_2, _e, e_1, _d;
    }
    exports.listLazyRoutes = listLazyRoutes;
    function _collectLoadChildren(routes, target) {
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
        var e_3, _a;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF6eV9yb3V0ZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvYW90L2xhenlfcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUE0RTtJQWM1RSx3QkFDSSxVQUFtQyxFQUFFLFNBQTBCO1FBQ2pFLElBQU0sYUFBYSxHQUFnQixFQUFFLENBQUM7O1lBQ3RDLEtBQWlDLElBQUEsS0FBQSxpQkFBQSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFBLGdCQUFBO2dCQUEzRCxJQUFBLGFBQWtCLEVBQWpCLHNCQUFRLEVBQUUsa0JBQU07Z0JBQzFCLElBQUksaUNBQWMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssU0FBUyxDQUFDLE1BQU0sRUFBRTtvQkFDdkQsSUFBTSxZQUFZLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDOzt3QkFDN0QsS0FBb0IsSUFBQSxpQkFBQSxpQkFBQSxZQUFZLENBQUEsMENBQUE7NEJBQTNCLElBQU0sS0FBSyx5QkFBQTs0QkFDZCxhQUFhLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO3lCQUN4RTs7Ozs7Ozs7O2lCQUNGO2FBQ0Y7Ozs7Ozs7OztRQUNELE9BQU8sYUFBYSxDQUFDOztJQUN2QixDQUFDO0lBWkQsd0NBWUM7SUFFRCw4QkFBOEIsTUFBZ0MsRUFBRSxNQUFxQjtRQUFyQix1QkFBQSxFQUFBLFdBQXFCO1FBQ25GLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1lBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDckI7YUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7O2dCQUNoQyxLQUFvQixJQUFBLFdBQUEsaUJBQUEsTUFBTSxDQUFBLDhCQUFBO29CQUFyQixJQUFNLEtBQUssbUJBQUE7b0JBQ2Qsb0JBQW9CLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUNyQzs7Ozs7Ozs7O1NBQ0Y7YUFBTSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUU7WUFDOUIsb0JBQW9CLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztTQUNuRDthQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUMxQixvQkFBb0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQy9DO1FBQ0QsT0FBTyxNQUFNLENBQUM7O0lBQ2hCLENBQUM7SUFFRCx3QkFDSSxLQUFhLEVBQUUsU0FBMEIsRUFBRSxNQUFxQjtRQUM1RCxJQUFBLHdDQUF5QyxFQUF4QyxpQkFBUyxFQUFFLGlCQUFTLENBQXFCO1FBQ2hELElBQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLHdCQUF3QixDQUN2RDtZQUNFLFVBQVUsRUFBRSxTQUFTO1lBQ3JCLElBQUksRUFBRSxTQUFTO1NBQ2hCLEVBQ0QsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPLEVBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxJQUFJLGdCQUFnQixFQUFFLGdCQUFnQixrQkFBQSxFQUFDLENBQUM7SUFDOUUsQ0FBQztJQVZELHdDQVVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCB0b2tlblJlZmVyZW5jZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge1JvdXRlfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7Q29tcGlsZU1ldGFkYXRhUmVzb2x2ZXJ9IGZyb20gJy4uL21ldGFkYXRhX3Jlc29sdmVyJztcblxuaW1wb3J0IHtBb3RDb21waWxlckhvc3R9IGZyb20gJy4vY29tcGlsZXJfaG9zdCc7XG5pbXBvcnQge1N0YXRpY1JlZmxlY3Rvcn0gZnJvbSAnLi9zdGF0aWNfcmVmbGVjdG9yJztcbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuL3N0YXRpY19zeW1ib2wnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExhenlSb3V0ZSB7XG4gIG1vZHVsZTogU3RhdGljU3ltYm9sO1xuICByb3V0ZTogc3RyaW5nO1xuICByZWZlcmVuY2VkTW9kdWxlOiBTdGF0aWNTeW1ib2w7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0TGF6eVJvdXRlcyhcbiAgICBtb2R1bGVNZXRhOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSwgcmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3IpOiBMYXp5Um91dGVbXSB7XG4gIGNvbnN0IGFsbExhenlSb3V0ZXM6IExhenlSb3V0ZVtdID0gW107XG4gIGZvciAoY29uc3Qge3Byb3ZpZGVyLCBtb2R1bGV9IG9mIG1vZHVsZU1ldGEudHJhbnNpdGl2ZU1vZHVsZS5wcm92aWRlcnMpIHtcbiAgICBpZiAodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pID09PSByZWZsZWN0b3IuUk9VVEVTKSB7XG4gICAgICBjb25zdCBsb2FkQ2hpbGRyZW4gPSBfY29sbGVjdExvYWRDaGlsZHJlbihwcm92aWRlci51c2VWYWx1ZSk7XG4gICAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGxvYWRDaGlsZHJlbikge1xuICAgICAgICBhbGxMYXp5Um91dGVzLnB1c2gocGFyc2VMYXp5Um91dGUocm91dGUsIHJlZmxlY3RvciwgbW9kdWxlLnJlZmVyZW5jZSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gYWxsTGF6eVJvdXRlcztcbn1cblxuZnVuY3Rpb24gX2NvbGxlY3RMb2FkQ2hpbGRyZW4ocm91dGVzOiBzdHJpbmcgfCBSb3V0ZSB8IFJvdXRlW10sIHRhcmdldDogc3RyaW5nW10gPSBbXSk6IHN0cmluZ1tdIHtcbiAgaWYgKHR5cGVvZiByb3V0ZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgdGFyZ2V0LnB1c2gocm91dGVzKTtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJvdXRlcykpIHtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHJvdXRlcykge1xuICAgICAgX2NvbGxlY3RMb2FkQ2hpbGRyZW4ocm91dGUsIHRhcmdldCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHJvdXRlcy5sb2FkQ2hpbGRyZW4pIHtcbiAgICBfY29sbGVjdExvYWRDaGlsZHJlbihyb3V0ZXMubG9hZENoaWxkcmVuLCB0YXJnZXQpO1xuICB9IGVsc2UgaWYgKHJvdXRlcy5jaGlsZHJlbikge1xuICAgIF9jb2xsZWN0TG9hZENoaWxkcmVuKHJvdXRlcy5jaGlsZHJlbiwgdGFyZ2V0KTtcbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VMYXp5Um91dGUoXG4gICAgcm91dGU6IHN0cmluZywgcmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3IsIG1vZHVsZT86IFN0YXRpY1N5bWJvbCk6IExhenlSb3V0ZSB7XG4gIGNvbnN0IFtyb3V0ZVBhdGgsIHJvdXRlTmFtZV0gPSByb3V0ZS5zcGxpdCgnIycpO1xuICBjb25zdCByZWZlcmVuY2VkTW9kdWxlID0gcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShcbiAgICAgIHtcbiAgICAgICAgbW9kdWxlTmFtZTogcm91dGVQYXRoLFxuICAgICAgICBuYW1lOiByb3V0ZU5hbWUsXG4gICAgICB9LFxuICAgICAgbW9kdWxlID8gbW9kdWxlLmZpbGVQYXRoIDogdW5kZWZpbmVkKTtcbiAgcmV0dXJuIHtyb3V0ZTogcm91dGUsIG1vZHVsZTogbW9kdWxlIHx8IHJlZmVyZW5jZWRNb2R1bGUsIHJlZmVyZW5jZWRNb2R1bGV9O1xufVxuIl19