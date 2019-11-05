/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __assign } from "tslib";
import { Identifiers } from './identifiers';
import * as o from './output/output_ast';
import { R3FactoryDelegateType, R3FactoryTarget, compileFactoryFunction } from './render3/r3_factory';
import { mapToMapExpression, typeWithParameters } from './render3/util';
export function compileInjectable(meta) {
    var result = null;
    var factoryMeta = {
        name: meta.name,
        type: meta.type,
        internalType: meta.internalType,
        typeArgumentCount: meta.typeArgumentCount,
        deps: [],
        injectFn: Identifiers.inject,
        target: R3FactoryTarget.Injectable,
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
            result = compileFactoryFunction(__assign(__assign({}, factoryMeta), { delegate: meta.useClass, delegateDeps: deps, delegateType: R3FactoryDelegateType.Class }));
        }
        else if (useClassOnSelf) {
            result = compileFactoryFunction(factoryMeta);
        }
        else {
            result = delegateToFactory(meta.useClass);
        }
    }
    else if (meta.useFactory !== undefined) {
        if (meta.userDeps !== undefined) {
            result = compileFactoryFunction(__assign(__assign({}, factoryMeta), { delegate: meta.useFactory, delegateDeps: meta.userDeps || [], delegateType: R3FactoryDelegateType.Function }));
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
        result = compileFactoryFunction(__assign(__assign({}, factoryMeta), { expression: meta.useValue }));
    }
    else if (meta.useExisting !== undefined) {
        // useExisting is an `inject` call on the existing token.
        result = compileFactoryFunction(__assign(__assign({}, factoryMeta), { expression: o.importExpr(Identifiers.inject).callFn([meta.useExisting]) }));
    }
    else {
        result = delegateToFactory(meta.internalType);
    }
    var token = meta.internalType;
    var providedIn = meta.providedIn;
    var expression = o.importExpr(Identifiers.ɵɵdefineInjectable).callFn([mapToMapExpression({ token: token, factory: result.factory, providedIn: providedIn })]);
    var type = new o.ExpressionType(o.importExpr(Identifiers.InjectableDef, [typeWithParameters(meta.type, meta.typeArgumentCount)]));
    return {
        expression: expression,
        type: type,
        statements: result.statements,
    };
}
function delegateToFactory(type) {
    return {
        statements: [],
        // () => type.ɵfac(t)
        factory: o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(type.callMethod('ɵfac', [o.variable('t')]))])
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEtBQUssQ0FBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3pDLE9BQU8sRUFBdUIscUJBQXFCLEVBQXFCLGVBQWUsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzdJLE9BQU8sRUFBQyxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBcUJ0RSxNQUFNLFVBQVUsaUJBQWlCLENBQUMsSUFBMEI7SUFDMUQsSUFBSSxNQUFNLEdBQTRELElBQUksQ0FBQztJQUUzRSxJQUFNLFdBQVcsR0FBc0I7UUFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO1FBQy9CLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7UUFDekMsSUFBSSxFQUFFLEVBQUU7UUFDUixRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU07UUFDNUIsTUFBTSxFQUFFLGVBQWUsQ0FBQyxVQUFVO0tBQ25DLENBQUM7SUFFRixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1FBQy9CLDhGQUE4RjtRQUM5RiwwRkFBMEY7UUFDMUYsc0RBQXNEO1FBQ3RELEVBQUU7UUFDRiwyRkFBMkY7UUFDM0YsdUVBQXVFO1FBRXZFLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNyRSxJ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QUVELFNBQVMsaUJBQWlCLENBQUMsSUFBa0I7SUFDM0MsT0FBTztRQUNMLFVBQVUsRUFBRSxFQUFFO1FBQ2QscUJBQXFCO1FBQ3JCLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUNsQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDdEYsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4vaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeURlbGVnYXRlVHlwZSwgUjNGYWN0b3J5TWV0YWRhdGEsIFIzRmFjdG9yeVRhcmdldCwgY29tcGlsZUZhY3RvcnlGdW5jdGlvbn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHttYXBUb01hcEV4cHJlc3Npb24sIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluamVjdGFibGVEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdGFibGVNZXRhZGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogby5FeHByZXNzaW9uO1xuICBpbnRlcm5hbFR5cGU6IG8uRXhwcmVzc2lvbjtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgcHJvdmlkZWRJbjogby5FeHByZXNzaW9uO1xuICB1c2VDbGFzcz86IG8uRXhwcmVzc2lvbjtcbiAgdXNlRmFjdG9yeT86IG8uRXhwcmVzc2lvbjtcbiAgdXNlRXhpc3Rpbmc/OiBvLkV4cHJlc3Npb247XG4gIHVzZVZhbHVlPzogby5FeHByZXNzaW9uO1xuICB1c2VyRGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlSW5qZWN0YWJsZShtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSk6IEluamVjdGFibGVEZWYge1xuICBsZXQgcmVzdWx0OiB7ZmFjdG9yeTogby5FeHByZXNzaW9uLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfXxudWxsID0gbnVsbDtcblxuICBjb25zdCBmYWN0b3J5TWV0YTogUjNGYWN0b3J5TWV0YWRhdGEgPSB7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICBpbnRlcm5hbFR5cGU6IG1ldGEuaW50ZXJuYWxUeXBlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgIGRlcHM6IFtdLFxuICAgIGluamVjdEZuOiBJZGVudGlmaWVycy5pbmplY3QsXG4gICAgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQuSW5qZWN0YWJsZSxcbiAgfTtcblxuICBpZiAobWV0YS51c2VDbGFzcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gbWV0YS51c2VDbGFzcyBoYXMgdHdvIG1vZGVzIG9mIG9wZXJhdGlvbi4gRWl0aGVyIGRlcHMgYXJlIHNwZWNpZmllZCwgaW4gd2hpY2ggY2FzZSBgbmV3YCBpc1xuICAgIC8vIHVzZWQgdG8gaW5zdGFudGlhdGUgdGhlIGNsYXNzIHdpdGggZGVwZW5kZW5jaWVzIGluamVjdGVkLCBvciBkZXBzIGFyZSBub3Qgc3BlY2lmaWVkIGFuZFxuICAgIC8vIHRoZSBmYWN0b3J5IG9mIHRoZSBjbGFzcyBpcyB1c2VkIHRvIGluc3RhbnRpYXRlIGl0LlxuICAgIC8vXG4gICAgLy8gQSBzcGVjaWFsIGNhc2UgZXhpc3RzIGZvciB1c2VDbGFzczogVHlwZSB3aGVyZSBUeXBlIGlzIHRoZSBpbmplY3RhYmxlIHR5cGUgaXRzZWxmIGFuZCBub1xuICAgIC8vIGRlcHMgYXJlIHNwZWNpZmllZCwgaW4gd2hpY2ggY2FzZSAndXNlQ2xhc3MnIGlzIGVmZmVjdGl2ZWx5IGlnbm9yZWQuXG5cbiAgICBjb25zdCB1c2VDbGFzc09uU2VsZiA9IG1ldGEudXNlQ2xhc3MuaXNFcXVpdmFsZW50KG1ldGEuaW50ZXJuYWxUeXBlKTtcbiAgICBsZXQgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG1ldGEudXNlckRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGVwcyA9IG1ldGEudXNlckRlcHM7XG4gICAgfVxuXG4gICAgaWYgKGRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFjdG9yeTogKCkgPT4gbmV3IG1ldGEudXNlQ2xhc3MoLi4uZGVwcylcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgICAgZGVsZWdhdGU6IG1ldGEudXNlQ2xhc3MsXG4gICAgICAgIGRlbGVnYXRlRGVwczogZGVwcyxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3MsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHVzZUNsYXNzT25TZWxmKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKGZhY3RvcnlNZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gZGVsZWdhdGVUb0ZhY3RvcnkobWV0YS51c2VDbGFzcyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlRmFjdG9yeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKG1ldGEudXNlckRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VGYWN0b3J5LFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IG1ldGEudXNlckRlcHMgfHwgW10sXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIGZhY3Rvcnk6IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQobWV0YS51c2VGYWN0b3J5LmNhbGxGbihbXSkpXSlcbiAgICAgIH07XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE5vdGU6IGl0J3Mgc2FmZSB0byB1c2UgYG1ldGEudXNlVmFsdWVgIGluc3RlYWQgb2YgdGhlIGBVU0VfVkFMVUUgaW4gbWV0YWAgY2hlY2sgdXNlZCBmb3JcbiAgICAvLyBjbGllbnQgY29kZSBiZWNhdXNlIG1ldGEudXNlVmFsdWUgaXMgYW4gRXhwcmVzc2lvbiB3aGljaCB3aWxsIGJlIGRlZmluZWQgZXZlbiBpZiB0aGUgYWN0dWFsXG4gICAgLy8gdmFsdWUgaXMgdW5kZWZpbmVkLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBtZXRhLnVzZVZhbHVlLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKG1ldGEudXNlRXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIHVzZUV4aXN0aW5nIGlzIGFuIGBpbmplY3RgIGNhbGwgb24gdGhlIGV4aXN0aW5nIHRva2VuLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW5qZWN0KS5jYWxsRm4oW21ldGEudXNlRXhpc3RpbmddKSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSBkZWxlZ2F0ZVRvRmFjdG9yeShtZXRhLmludGVybmFsVHlwZSk7XG4gIH1cblxuICBjb25zdCB0b2tlbiA9IG1ldGEuaW50ZXJuYWxUeXBlO1xuICBjb25zdCBwcm92aWRlZEluID0gbWV0YS5wcm92aWRlZEluO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuybXJtWRlZmluZUluamVjdGFibGUpLmNhbGxGbihbbWFwVG9NYXBFeHByZXNzaW9uKFxuICAgICAge3Rva2VuLCBmYWN0b3J5OiByZXN1bHQuZmFjdG9yeSwgcHJvdmlkZWRJbn0pXSk7XG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoXG4gICAgICBJZGVudGlmaWVycy5JbmplY3RhYmxlRGVmLCBbdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCldKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBleHByZXNzaW9uLFxuICAgIHR5cGUsXG4gICAgc3RhdGVtZW50czogcmVzdWx0LnN0YXRlbWVudHMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGRlbGVnYXRlVG9GYWN0b3J5KHR5cGU6IG8uRXhwcmVzc2lvbikge1xuICByZXR1cm4ge1xuICAgIHN0YXRlbWVudHM6IFtdLFxuICAgIC8vICgpID0+IHR5cGUuybVmYWModClcbiAgICBmYWN0b3J5OiBvLmZuKFtuZXcgby5GblBhcmFtKCd0Jywgby5EWU5BTUlDX1RZUEUpXSwgW25ldyBvLlJldHVyblN0YXRlbWVudCh0eXBlLmNhbGxNZXRob2QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnybVmYWMnLCBbby52YXJpYWJsZSgndCcpXSkpXSlcbiAgfTtcbn1cbiJdfQ==