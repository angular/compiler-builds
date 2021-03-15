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
        define("@angular/compiler/src/injectable_compiler_2", ["require", "exports", "tslib", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileInjectable = void 0;
    var tslib_1 = require("tslib");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var util_1 = require("@angular/compiler/src/render3/util");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    function compileInjectable(meta) {
        var result = null;
        var factoryMeta = {
            name: meta.name,
            type: meta.type,
            internalType: meta.internalType,
            typeArgumentCount: meta.typeArgumentCount,
            deps: [],
            injectFn: identifiers_1.Identifiers.inject,
            target: r3_factory_1.R3FactoryTarget.Injectable,
        };
        if (meta.useClass !== undefined) {
            // meta.useClass has two modes of operation. Either deps are specified, in which case `new` is
            // used to instantiate the class with dependencies injected, or deps are not specified and
            // the factory of the class is used to instantiate it.
            //
            // A special case exists for useClass: Type where Type is the injectable type itself and no
            // deps are specified, in which case 'useClass' is effectively ignored.
            var useClassOnSelf = meta.useClass.isEquivalent(meta.internalType);
            var deps = undefined;
            if (meta.userDeps !== undefined) {
                deps = meta.userDeps;
            }
            if (deps !== undefined) {
                // factory: () => new meta.useClass(...deps)
                result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { delegate: meta.useClass, delegateDeps: deps, delegateType: r3_factory_1.R3FactoryDelegateType.Class }));
            }
            else if (useClassOnSelf) {
                result = r3_factory_1.compileFactoryFunction(factoryMeta);
            }
            else {
                result = delegateToFactory(meta.type.value, meta.useClass);
            }
        }
        else if (meta.useFactory !== undefined) {
            if (meta.userDeps !== undefined) {
                result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { delegate: meta.useFactory, delegateDeps: meta.userDeps || [], delegateType: r3_factory_1.R3FactoryDelegateType.Function }));
            }
            else {
                result = {
                    statements: [],
                    expression: o.fn([], [new o.ReturnStatement(meta.useFactory.callFn([]))])
                };
            }
        }
        else if (meta.useValue !== undefined) {
            // Note: it's safe to use `meta.useValue` instead of the `USE_VALUE in meta` check used for
            // client code because meta.useValue is an Expression which will be defined even if the actual
            // value is undefined.
            result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { expression: meta.useValue }));
        }
        else if (meta.useExisting !== undefined) {
            // useExisting is an `inject` call on the existing token.
            result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { expression: o.importExpr(identifiers_1.Identifiers.inject).callFn([meta.useExisting]) }));
        }
        else {
            result = delegateToFactory(meta.type.value, meta.internalType);
        }
        var token = meta.internalType;
        var injectableProps = new util_2.DefinitionMap();
        injectableProps.set('token', token);
        injectableProps.set('factory', result.expression);
        // Only generate providedIn property if it has a non-null value
        if (meta.providedIn.value !== null) {
            injectableProps.set('providedIn', meta.providedIn);
        }
        var expression = o.importExpr(identifiers_1.Identifiers.ɵɵdefineInjectable)
            .callFn([injectableProps.toLiteralMap()], undefined, true);
        var type = new o.ExpressionType(o.importExpr(identifiers_1.Identifiers.InjectableDef, [util_1.typeWithParameters(meta.type.type, meta.typeArgumentCount)]));
        return {
            expression: expression,
            type: type,
            statements: result.statements,
        };
    }
    exports.compileInjectable = compileInjectable;
    function delegateToFactory(type, internalType) {
        return {
            statements: [],
            // If types are the same, we can generate `factory: type.ɵfac`
            // If types are different, we have to generate a wrapper function to ensure
            // the internal type has been resolved (`factory: function(t) { return type.ɵfac(t); }`)
            expression: type.node === internalType.node ?
                internalType.prop('ɵfac') :
                o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(internalType.callMethod('ɵfac', [o.variable('t')]))])
        };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsaUVBQTBDO0lBQzFDLDJEQUF5QztJQUN6Qyx1RUFBNkk7SUFDN0ksMkRBQStEO0lBQy9ELGdFQUFrRDtJQXFCbEQsU0FBZ0IsaUJBQWlCLENBQUMsSUFBMEI7UUFDMUQsSUFBSSxNQUFNLEdBQStELElBQUksQ0FBQztRQUU5RSxJQUFNLFdBQVcsR0FBc0I7WUFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO1lBQy9CLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7WUFDekMsSUFBSSxFQUFFLEVBQUU7WUFDUixRQUFRLEVBQUUseUJBQVcsQ0FBQyxNQUFNO1lBQzVCLE1BQU0sRUFBRSw0QkFBZSxDQUFDLFVBQVU7U0FDbkMsQ0FBQztRQUVGLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDL0IsOEZBQThGO1lBQzlGLDBGQUEwRjtZQUMxRixzREFBc0Q7WUFDdEQsRUFBRTtZQUNGLDJGQUEyRjtZQUMzRix1RUFBdUU7WUFFdkUsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3JFLElBQUksSUFBSSxHQUFxQyxTQUFTLENBQUM7WUFDdkQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtnQkFDL0IsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7YUFDdEI7WUFFRCxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7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SUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU5RixPQUFPO1lBQ0wsVUFBVSxZQUFBO1lBQ1YsSUFBSSxNQUFBO1lBQ0osVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO1NBQzlCLENBQUM7SUFDSixDQUFDO0lBaEdELDhDQWdHQztJQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBNEIsRUFBRSxZQUFvQztRQUMzRixPQUFPO1lBQ0wsVUFBVSxFQUFFLEVBQUU7WUFDZCw4REFBOEQ7WUFDOUQsMkVBQTJFO1lBQzNFLHdGQUF3RjtZQUN4RixVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3pDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDM0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FDMUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2pGLENBQUM7SUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4vaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgUjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeURlbGVnYXRlVHlwZSwgUjNGYWN0b3J5TWV0YWRhdGEsIFIzRmFjdG9yeVRhcmdldH0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtSM1JlZmVyZW5jZSwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4vcmVuZGVyMy92aWV3L3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluamVjdGFibGVEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdGFibGVNZXRhZGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogUjNSZWZlcmVuY2U7XG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICBwcm92aWRlZEluOiBvLkV4cHJlc3Npb247XG4gIHVzZUNsYXNzPzogby5FeHByZXNzaW9uO1xuICB1c2VGYWN0b3J5Pzogby5FeHByZXNzaW9uO1xuICB1c2VFeGlzdGluZz86IG8uRXhwcmVzc2lvbjtcbiAgdXNlVmFsdWU/OiBvLkV4cHJlc3Npb247XG4gIHVzZXJEZXBzPzogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RhYmxlKG1ldGE6IFIzSW5qZWN0YWJsZU1ldGFkYXRhKTogSW5qZWN0YWJsZURlZiB7XG4gIGxldCByZXN1bHQ6IHtleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W119fG51bGwgPSBudWxsO1xuXG4gIGNvbnN0IGZhY3RvcnlNZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSA9IHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGludGVybmFsVHlwZTogbWV0YS5pbnRlcm5hbFR5cGUsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IG1ldGEudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgZGVwczogW10sXG4gICAgaW5qZWN0Rm46IElkZW50aWZpZXJzLmluamVjdCxcbiAgICB0YXJnZXQ6IFIzRmFjdG9yeVRhcmdldC5JbmplY3RhYmxlLFxuICB9O1xuXG4gIGlmIChtZXRhLnVzZUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBtZXRhLnVzZUNsYXNzIGhhcyB0d28gbW9kZXMgb2Ygb3BlcmF0aW9uLiBFaXRoZXIgZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlIGBuZXdgIGlzXG4gICAgLy8gdXNlZCB0byBpbnN0YW50aWF0ZSB0aGUgY2xhc3Mgd2l0aCBkZXBlbmRlbmNpZXMgaW5qZWN0ZWQsIG9yIGRlcHMgYXJlIG5vdCBzcGVjaWZpZWQgYW5kXG4gICAgLy8gdGhlIGZhY3Rvcnkgb2YgdGhlIGNsYXNzIGlzIHVzZWQgdG8gaW5zdGFudGlhdGUgaXQuXG4gICAgLy9cbiAgICAvLyBBIHNwZWNpYWwgY2FzZSBleGlzdHMgZm9yIHVzZUNsYXNzOiBUeXBlIHdoZXJlIFR5cGUgaXMgdGhlIGluamVjdGFibGUgdHlwZSBpdHNlbGYgYW5kIG5vXG4gICAgLy8gZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlICd1c2VDbGFzcycgaXMgZWZmZWN0aXZlbHkgaWdub3JlZC5cblxuICAgIGNvbnN0IHVzZUNsYXNzT25TZWxmID0gbWV0YS51c2VDbGFzcy5pc0VxdWl2YWxlbnQobWV0YS5pbnRlcm5hbFR5cGUpO1xuICAgIGxldCBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAobWV0YS51c2VyRGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkZXBzID0gbWV0YS51c2VyRGVwcztcbiAgICB9XG5cbiAgICBpZiAoZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWN0b3J5OiAoKSA9PiBuZXcgbWV0YS51c2VDbGFzcyguLi5kZXBzKVxuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VDbGFzcyxcbiAgICAgICAgZGVsZWdhdGVEZXBzOiBkZXBzLFxuICAgICAgICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5DbGFzcyxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodXNlQ2xhc3NPblNlbGYpIHtcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oZmFjdG9yeU1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBkZWxlZ2F0ZVRvRmFjdG9yeShcbiAgICAgICAgICBtZXRhLnR5cGUudmFsdWUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgbWV0YS51c2VDbGFzcyBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+KTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VGYWN0b3J5ICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAobWV0YS51c2VyRGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICAgIGRlbGVnYXRlOiBtZXRhLnVzZUZhY3RvcnksXG4gICAgICAgIGRlbGVnYXRlRGVwczogbWV0YS51c2VyRGVwcyB8fCBbXSxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRnVuY3Rpb24sXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0ge1xuICAgICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgICAgZXhwcmVzc2lvbjogby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChtZXRhLnVzZUZhY3RvcnkuY2FsbEZuKFtdKSldKVxuICAgICAgfTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gTm90ZTogaXQncyBzYWZlIHRvIHVzZSBgbWV0YS51c2VWYWx1ZWAgaW5zdGVhZCBvZiB0aGUgYFVTRV9WQUxVRSBpbiBtZXRhYCBjaGVjayB1c2VkIGZvclxuICAgIC8vIGNsaWVudCBjb2RlIGJlY2F1c2UgbWV0YS51c2VWYWx1ZSBpcyBhbiBFeHByZXNzaW9uIHdoaWNoIHdpbGwgYmUgZGVmaW5lZCBldmVuIGlmIHRoZSBhY3R1YWxcbiAgICAvLyB2YWx1ZSBpcyB1bmRlZmluZWQuXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG1ldGEudXNlVmFsdWUsXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAobWV0YS51c2VFeGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gdXNlRXhpc3RpbmcgaXMgYW4gYGluamVjdGAgY2FsbCBvbiB0aGUgZXhpc3RpbmcgdG9rZW4uXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbmplY3QpLmNhbGxGbihbbWV0YS51c2VFeGlzdGluZ10pLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IGRlbGVnYXRlVG9GYWN0b3J5KFxuICAgICAgICBtZXRhLnR5cGUudmFsdWUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgbWV0YS5pbnRlcm5hbFR5cGUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55Pik7XG4gIH1cblxuICBjb25zdCB0b2tlbiA9IG1ldGEuaW50ZXJuYWxUeXBlO1xuXG4gIGNvbnN0IGluamVjdGFibGVQcm9wcyA9XG4gICAgICBuZXcgRGVmaW5pdGlvbk1hcDx7dG9rZW46IG8uRXhwcmVzc2lvbiwgZmFjdG9yeTogby5FeHByZXNzaW9uLCBwcm92aWRlZEluOiBvLkV4cHJlc3Npb259PigpO1xuICBpbmplY3RhYmxlUHJvcHMuc2V0KCd0b2tlbicsIHRva2VuKTtcbiAgaW5qZWN0YWJsZVByb3BzLnNldCgnZmFjdG9yeScsIHJlc3VsdC5leHByZXNzaW9uKTtcblxuICAvLyBPbmx5IGdlbmVyYXRlIHByb3ZpZGVkSW4gcHJvcGVydHkgaWYgaXQgaGFzIGEgbm9uLW51bGwgdmFsdWVcbiAgaWYgKChtZXRhLnByb3ZpZGVkSW4gYXMgby5MaXRlcmFsRXhwcikudmFsdWUgIT09IG51bGwpIHtcbiAgICBpbmplY3RhYmxlUHJvcHMuc2V0KCdwcm92aWRlZEluJywgbWV0YS5wcm92aWRlZEluKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuybXJtWRlZmluZUluamVjdGFibGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihbaW5qZWN0YWJsZVByb3BzLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihcbiAgICAgIElkZW50aWZpZXJzLkluamVjdGFibGVEZWYsIFt0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpXSkpO1xuXG4gIHJldHVybiB7XG4gICAgZXhwcmVzc2lvbixcbiAgICB0eXBlLFxuICAgIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBkZWxlZ2F0ZVRvRmFjdG9yeSh0eXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBpbnRlcm5hbFR5cGU6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4pIHtcbiAgcmV0dXJuIHtcbiAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAvLyBJZiB0eXBlcyBhcmUgdGhlIHNhbWUsIHdlIGNhbiBnZW5lcmF0ZSBgZmFjdG9yeTogdHlwZS7JtWZhY2BcbiAgICAvLyBJZiB0eXBlcyBhcmUgZGlmZmVyZW50LCB3ZSBoYXZlIHRvIGdlbmVyYXRlIGEgd3JhcHBlciBmdW5jdGlvbiB0byBlbnN1cmVcbiAgICAvLyB0aGUgaW50ZXJuYWwgdHlwZSBoYXMgYmVlbiByZXNvbHZlZCAoYGZhY3Rvcnk6IGZ1bmN0aW9uKHQpIHsgcmV0dXJuIHR5cGUuybVmYWModCk7IH1gKVxuICAgIGV4cHJlc3Npb246IHR5cGUubm9kZSA9PT0gaW50ZXJuYWxUeXBlLm5vZGUgP1xuICAgICAgICBpbnRlcm5hbFR5cGUucHJvcCgnybVmYWMnKSA6XG4gICAgICAgIG8uZm4oW25ldyBvLkZuUGFyYW0oJ3QnLCBvLkRZTkFNSUNfVFlQRSldLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGludGVybmFsVHlwZS5jYWxsTWV0aG9kKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICfJtWZhYycsIFtvLnZhcmlhYmxlKCd0JyldKSldKVxuICB9O1xufVxuIl19