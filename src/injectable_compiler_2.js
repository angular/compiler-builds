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
        define("@angular/compiler/src/injectable_compiler_2", ["require", "exports", "tslib", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var util_1 = require("@angular/compiler/src/render3/util");
    function compileInjectable(meta) {
        var result = null;
        var factoryMeta = {
            name: meta.name,
            type: meta.type,
            typeArgumentCount: meta.typeArgumentCount,
            deps: [],
            injectFn: identifiers_1.Identifiers.inject,
        };
        if (meta.useClass !== undefined) {
            // meta.useClass has two modes of operation. Either deps are specified, in which case `new` is
            // used to instantiate the class with dependencies injected, or deps are not specified and
            // the factory of the class is used to instantiate it.
            //
            // A special case exists for useClass: Type where Type is the injectable type itself and no
            // deps are specified, in which case 'useClass' is effectively ignored.
            var useClassOnSelf = meta.useClass.isEquivalent(meta.type);
            var deps = undefined;
            if (meta.userDeps !== undefined) {
                deps = meta.userDeps;
            }
            if (deps !== undefined) {
                // factory: () => new meta.useClass(...deps)
                result = r3_factory_1.compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { delegate: meta.useClass, delegateDeps: deps, delegateType: r3_factory_1.R3FactoryDelegateType.Class }));
            }
            else if (useClassOnSelf) {
                result = r3_factory_1.compileFactoryFunction(factoryMeta);
            }
            else {
                result = delegateToFactory(meta.useClass);
            }
        }
        else if (meta.useFactory !== undefined) {
            if (meta.userDeps !== undefined) {
                result = r3_factory_1.compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { delegate: meta.useFactory, delegateDeps: meta.userDeps || [], delegateType: r3_factory_1.R3FactoryDelegateType.Function }));
            }
            else {
                result = {
                    statements: [],
                    factory: o.fn([], [new o.ReturnStatement(meta.useFactory.callFn([]))])
                };
            }
        }
        else if (meta.useValue !== undefined) {
            // Note: it's safe to use `meta.useValue` instead of the `USE_VALUE in meta` check used for
            // client code because meta.useValue is an Expression which will be defined even if the actual
            // value is undefined.
            result = r3_factory_1.compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { expression: meta.useValue }));
        }
        else if (meta.useExisting !== undefined) {
            // useExisting is an `inject` call on the existing token.
            result = r3_factory_1.compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { expression: o.importExpr(identifiers_1.Identifiers.inject).callFn([meta.useExisting]) }));
        }
        else {
            result = delegateToFactory(meta.type);
        }
        var token = meta.type;
        var providedIn = meta.providedIn;
        var expression = o.importExpr(identifiers_1.Identifiers.ɵɵdefineInjectable).callFn([util_1.mapToMapExpression({ token: token, factory: result.factory, providedIn: providedIn })]);
        var type = new o.ExpressionType(o.importExpr(identifiers_1.Identifiers.InjectableDef, [util_1.typeWithParameters(meta.type, meta.typeArgumentCount)]));
        return {
            expression: expression,
            type: type,
            statements: result.statements,
        };
    }
    exports.compileInjectable = compileInjectable;
    function delegateToFactory(type) {
        return {
            statements: [],
            // () => meta.type.ɵfac(t)
            factory: o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(type.callMethod('ɵfac', [o.variable('t')]))])
        };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxpRUFBMEM7SUFDMUMsMkRBQXlDO0lBQ3pDLHVFQUF5RztJQUN6RywyREFBc0U7SUFvQnRFLFNBQWdCLGlCQUFpQixDQUFDLElBQTBCO1FBQzFELElBQUksTUFBTSxHQUE0RCxJQUFJLENBQUM7UUFFM0UsSUFBTSxXQUFXLEdBQUc7WUFDbEIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtZQUN6QyxJQUFJLEVBQUUsRUFBRTtZQUNSLFFBQVEsRUFBRSx5QkFBVyxDQUFDLE1BQU07U0FDN0IsQ0FBQztRQUVGLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDL0IsOEZBQThGO1lBQzlGLDBGQUEwRjtZQUMxRixzREFBc0Q7WUFDdEQsRUFBRTtZQUNGLDJGQUEyRjtZQUMzRix1RUFBdUU7WUFFdkUsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzdELElBQUksSUFBSSxHQUFxQyxTQUFTLENBQUM7WUFDdkQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtnQkFDL0IsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7YUFDdEI7WUFFRCxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7Z0JBQ3RCLDRDQUE0QztnQkFDNUMsTUFBTSxHQUFHLG1DQUFzQixzQkFDMUIsV0FBVyxJQUNkLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFB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LENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQ2xDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN0RixDQUFDO0lBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5RGVsZWdhdGVUeXBlLCBjb21waWxlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5pbXBvcnQge21hcFRvTWFwRXhwcmVzc2lvbiwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5qZWN0YWJsZURlZiB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5UeXBlO1xuICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0YWJsZU1ldGFkYXRhIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG4gIHByb3ZpZGVkSW46IG8uRXhwcmVzc2lvbjtcbiAgdXNlQ2xhc3M/OiBvLkV4cHJlc3Npb247XG4gIHVzZUZhY3Rvcnk/OiBvLkV4cHJlc3Npb247XG4gIHVzZUV4aXN0aW5nPzogby5FeHByZXNzaW9uO1xuICB1c2VWYWx1ZT86IG8uRXhwcmVzc2lvbjtcbiAgdXNlckRlcHM/OiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUluamVjdGFibGUobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpOiBJbmplY3RhYmxlRGVmIHtcbiAgbGV0IHJlc3VsdDoge2ZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXX18bnVsbCA9IG51bGw7XG5cbiAgY29uc3QgZmFjdG9yeU1ldGEgPSB7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogbWV0YS50eXBlQXJndW1lbnRDb3VudCxcbiAgICBkZXBzOiBbXSxcbiAgICBpbmplY3RGbjogSWRlbnRpZmllcnMuaW5qZWN0LFxuICB9O1xuXG4gIGlmIChtZXRhLnVzZUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBtZXRhLnVzZUNsYXNzIGhhcyB0d28gbW9kZXMgb2Ygb3BlcmF0aW9uLiBFaXRoZXIgZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlIGBuZXdgIGlzXG4gICAgLy8gdXNlZCB0byBpbnN0YW50aWF0ZSB0aGUgY2xhc3Mgd2l0aCBkZXBlbmRlbmNpZXMgaW5qZWN0ZWQsIG9yIGRlcHMgYXJlIG5vdCBzcGVjaWZpZWQgYW5kXG4gICAgLy8gdGhlIGZhY3Rvcnkgb2YgdGhlIGNsYXNzIGlzIHVzZWQgdG8gaW5zdGFudGlhdGUgaXQuXG4gICAgLy9cbiAgICAvLyBBIHNwZWNpYWwgY2FzZSBleGlzdHMgZm9yIHVzZUNsYXNzOiBUeXBlIHdoZXJlIFR5cGUgaXMgdGhlIGluamVjdGFibGUgdHlwZSBpdHNlbGYgYW5kIG5vXG4gICAgLy8gZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlICd1c2VDbGFzcycgaXMgZWZmZWN0aXZlbHkgaWdub3JlZC5cblxuICAgIGNvbnN0IHVzZUNsYXNzT25TZWxmID0gbWV0YS51c2VDbGFzcy5pc0VxdWl2YWxlbnQobWV0YS50eXBlKTtcbiAgICBsZXQgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG1ldGEudXNlckRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGVwcyA9IG1ldGEudXNlckRlcHM7XG4gICAgfVxuXG4gICAgaWYgKGRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFjdG9yeTogKCkgPT4gbmV3IG1ldGEudXNlQ2xhc3MoLi4uZGVwcylcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgICAgZGVsZWdhdGU6IG1ldGEudXNlQ2xhc3MsXG4gICAgICAgIGRlbGVnYXRlRGVwczogZGVwcyxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3MsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHVzZUNsYXNzT25TZWxmKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKGZhY3RvcnlNZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gZGVsZWdhdGVUb0ZhY3RvcnkobWV0YS51c2VDbGFzcyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlRmFjdG9yeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKG1ldGEudXNlckRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VGYWN0b3J5LFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IG1ldGEudXNlckRlcHMgfHwgW10sXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIGZhY3Rvcnk6IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQobWV0YS51c2VGYWN0b3J5LmNhbGxGbihbXSkpXSlcbiAgICAgIH07XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE5vdGU6IGl0J3Mgc2FmZSB0byB1c2UgYG1ldGEudXNlVmFsdWVgIGluc3RlYWQgb2YgdGhlIGBVU0VfVkFMVUUgaW4gbWV0YWAgY2hlY2sgdXNlZCBmb3JcbiAgICAvLyBjbGllbnQgY29kZSBiZWNhdXNlIG1ldGEudXNlVmFsdWUgaXMgYW4gRXhwcmVzc2lvbiB3aGljaCB3aWxsIGJlIGRlZmluZWQgZXZlbiBpZiB0aGUgYWN0dWFsXG4gICAgLy8gdmFsdWUgaXMgdW5kZWZpbmVkLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBtZXRhLnVzZVZhbHVlLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKG1ldGEudXNlRXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIHVzZUV4aXN0aW5nIGlzIGFuIGBpbmplY3RgIGNhbGwgb24gdGhlIGV4aXN0aW5nIHRva2VuLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW5qZWN0KS5jYWxsRm4oW21ldGEudXNlRXhpc3RpbmddKSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSBkZWxlZ2F0ZVRvRmFjdG9yeShtZXRhLnR5cGUpO1xuICB9XG5cbiAgY29uc3QgdG9rZW4gPSBtZXRhLnR5cGU7XG4gIGNvbnN0IHByb3ZpZGVkSW4gPSBtZXRhLnByb3ZpZGVkSW47XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy7Jtcm1ZGVmaW5lSW5qZWN0YWJsZSkuY2FsbEZuKFttYXBUb01hcEV4cHJlc3Npb24oXG4gICAgICB7dG9rZW4sIGZhY3Rvcnk6IHJlc3VsdC5mYWN0b3J5LCBwcm92aWRlZElufSldKTtcbiAgY29uc3QgdHlwZSA9IG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihcbiAgICAgIElkZW50aWZpZXJzLkluamVjdGFibGVEZWYsIFt0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KV0pKTtcblxuICByZXR1cm4ge1xuICAgIGV4cHJlc3Npb24sXG4gICAgdHlwZSxcbiAgICBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50cyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZGVsZWdhdGVUb0ZhY3RvcnkodHlwZTogby5FeHByZXNzaW9uKSB7XG4gIHJldHVybiB7XG4gICAgc3RhdGVtZW50czogW10sXG4gICAgLy8gKCkgPT4gbWV0YS50eXBlLsm1ZmFjKHQpXG4gICAgZmFjdG9yeTogby5mbihbbmV3IG8uRm5QYXJhbSgndCcsIG8uRFlOQU1JQ19UWVBFKV0sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQodHlwZS5jYWxsTWV0aG9kKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ8m1ZmFjJywgW28udmFyaWFibGUoJ3QnKV0pKV0pXG4gIH07XG59XG4iXX0=