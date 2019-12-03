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
            result = delegateToFactory(meta.type, meta.useClass);
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
        result = delegateToFactory(meta.type, meta.internalType);
    }
    var token = meta.internalType;
    var injectableProps = { token: token, factory: result.factory };
    // Only generate providedIn property if it has a non-null value
    if (meta.providedIn.value !== null) {
        injectableProps.providedIn = meta.providedIn;
    }
    var expression = o.importExpr(Identifiers.ɵɵdefineInjectable).callFn([mapToMapExpression(injectableProps)]);
    var type = new o.ExpressionType(o.importExpr(Identifiers.InjectableDef, [typeWithParameters(meta.type, meta.typeArgumentCount)]));
    return {
        expression: expression,
        type: type,
        statements: result.statements,
    };
}
function delegateToFactory(type, internalType) {
    return {
        statements: [],
        // If types are the same, we can generate `factory: type.ɵfac`
        // If types are different, we have to generate a wrapper function to ensure
        // the internal type has been resolved (`factory: function(t) { return type.ɵfac(t); }`)
        factory: type.node === internalType.node ?
            internalType.prop('ɵfac') :
            o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(internalType.callMethod('ɵfac', [o.variable('t')]))])
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEtBQUssQ0FBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3pDLE9BQU8sRUFBdUIscUJBQXFCLEVBQXFCLGVBQWUsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzdJLE9BQU8sRUFBQyxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBcUJ0RSxNQUFNLFVBQVUsaUJBQWlCLENBQUMsSUFBMEI7SUFDMUQsSUFBSSxNQUFNLEdBQTRELElBQUksQ0FBQztJQUUzRSxJQUFNLFdBQVcsR0FBc0I7UUFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO1FBQy9CLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7UUFDekMsSUFBSSxFQUFFLEVBQUU7UUFDUixRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU07UUFDNUIsTUFBTSxFQUFFLGVBQWUsQ0FBQyxVQUFVO0tBQ25DLENBQUM7SUFFRixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1FBQy9CLDhGQUE4RjtRQUM5RiwwRkFBMEY7UUFDMUYsc0RBQXNEO1FBQ3RELEVBQUU7UUFDRiwyRkFBMkY7UUFDM0YsdUVBQXVFO1FBRXZFLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNyRSxJ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RSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV6RixPQUFPO1FBQ0wsVUFBVSxZQUFBO1FBQ1YsSUFBSSxNQUFBO1FBQ0osVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO0tBQzlCLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUE0QixFQUFFLFlBQW9DO0lBQzNGLE9BQU87UUFDTCxVQUFVLEVBQUUsRUFBRTtRQUNkLDhEQUE4RDtRQUM5RCwyRUFBMkU7UUFDM0Usd0ZBQXdGO1FBQ3hGLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDM0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FDMUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2pGLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUsIFIzRmFjdG9yeU1ldGFkYXRhLCBSM0ZhY3RvcnlUYXJnZXQsIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb259IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7bWFwVG9NYXBFeHByZXNzaW9uLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBJbmplY3RhYmxlRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RhYmxlTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcbiAgaW50ZXJuYWxUeXBlOiBvLkV4cHJlc3Npb247XG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG4gIHByb3ZpZGVkSW46IG8uRXhwcmVzc2lvbjtcbiAgdXNlQ2xhc3M/OiBvLkV4cHJlc3Npb247XG4gIHVzZUZhY3Rvcnk/OiBvLkV4cHJlc3Npb247XG4gIHVzZUV4aXN0aW5nPzogby5FeHByZXNzaW9uO1xuICB1c2VWYWx1ZT86IG8uRXhwcmVzc2lvbjtcbiAgdXNlckRlcHM/OiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUluamVjdGFibGUobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpOiBJbmplY3RhYmxlRGVmIHtcbiAgbGV0IHJlc3VsdDoge2ZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXX18bnVsbCA9IG51bGw7XG5cbiAgY29uc3QgZmFjdG9yeU1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhID0ge1xuICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICB0eXBlOiBtZXRhLnR5cGUsXG4gICAgaW50ZXJuYWxUeXBlOiBtZXRhLmludGVybmFsVHlwZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogbWV0YS50eXBlQXJndW1lbnRDb3VudCxcbiAgICBkZXBzOiBbXSxcbiAgICBpbmplY3RGbjogSWRlbnRpZmllcnMuaW5qZWN0LFxuICAgIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0LkluamVjdGFibGUsXG4gIH07XG5cbiAgaWYgKG1ldGEudXNlQ2xhc3MgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIG1ldGEudXNlQ2xhc3MgaGFzIHR3byBtb2RlcyBvZiBvcGVyYXRpb24uIEVpdGhlciBkZXBzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgYG5ld2AgaXNcbiAgICAvLyB1c2VkIHRvIGluc3RhbnRpYXRlIHRoZSBjbGFzcyB3aXRoIGRlcGVuZGVuY2llcyBpbmplY3RlZCwgb3IgZGVwcyBhcmUgbm90IHNwZWNpZmllZCBhbmRcbiAgICAvLyB0aGUgZmFjdG9yeSBvZiB0aGUgY2xhc3MgaXMgdXNlZCB0byBpbnN0YW50aWF0ZSBpdC5cbiAgICAvL1xuICAgIC8vIEEgc3BlY2lhbCBjYXNlIGV4aXN0cyBmb3IgdXNlQ2xhc3M6IFR5cGUgd2hlcmUgVHlwZSBpcyB0aGUgaW5qZWN0YWJsZSB0eXBlIGl0c2VsZiBhbmQgbm9cbiAgICAvLyBkZXBzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgJ3VzZUNsYXNzJyBpcyBlZmZlY3RpdmVseSBpZ25vcmVkLlxuXG4gICAgY29uc3QgdXNlQ2xhc3NPblNlbGYgPSBtZXRhLnVzZUNsYXNzLmlzRXF1aXZhbGVudChtZXRhLmludGVybmFsVHlwZSk7XG4gICAgbGV0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChtZXRhLnVzZXJEZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGRlcHMgPSBtZXRhLnVzZXJEZXBzO1xuICAgIH1cblxuICAgIGlmIChkZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhY3Rvcnk6ICgpID0+IG5ldyBtZXRhLnVzZUNsYXNzKC4uLmRlcHMpXG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICAgIGRlbGVnYXRlOiBtZXRhLnVzZUNsYXNzLFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IGRlcHMsXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkNsYXNzLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh1c2VDbGFzc09uU2VsZikge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbihmYWN0b3J5TWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGRlbGVnYXRlVG9GYWN0b3J5KFxuICAgICAgICAgIG1ldGEudHlwZSBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBtZXRhLnVzZUNsYXNzIGFzIG8uV3JhcHBlZE5vZGVFeHByPGFueT4pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChtZXRhLnVzZUZhY3RvcnkgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChtZXRhLnVzZXJEZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgICAgZGVsZWdhdGU6IG1ldGEudXNlRmFjdG9yeSxcbiAgICAgICAgZGVsZWdhdGVEZXBzOiBtZXRhLnVzZXJEZXBzIHx8IFtdLFxuICAgICAgICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GdW5jdGlvbixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSB7XG4gICAgICAgIHN0YXRlbWVudHM6IFtdLFxuICAgICAgICBmYWN0b3J5OiBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KG1ldGEudXNlRmFjdG9yeS5jYWxsRm4oW10pKV0pXG4gICAgICB9O1xuICAgIH1cbiAgfSBlbHNlIGlmIChtZXRhLnVzZVZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBOb3RlOiBpdCdzIHNhZmUgdG8gdXNlIGBtZXRhLnVzZVZhbHVlYCBpbnN0ZWFkIG9mIHRoZSBgVVNFX1ZBTFVFIGluIG1ldGFgIGNoZWNrIHVzZWQgZm9yXG4gICAgLy8gY2xpZW50IGNvZGUgYmVjYXVzZSBtZXRhLnVzZVZhbHVlIGlzIGFuIEV4cHJlc3Npb24gd2hpY2ggd2lsbCBiZSBkZWZpbmVkIGV2ZW4gaWYgdGhlIGFjdHVhbFxuICAgIC8vIHZhbHVlIGlzIHVuZGVmaW5lZC5cbiAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgZXhwcmVzc2lvbjogbWV0YS51c2VWYWx1ZSxcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChtZXRhLnVzZUV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyB1c2VFeGlzdGluZyBpcyBhbiBgaW5qZWN0YCBjYWxsIG9uIHRoZSBleGlzdGluZyB0b2tlbi5cbiAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgZXhwcmVzc2lvbjogby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmluamVjdCkuY2FsbEZuKFttZXRhLnVzZUV4aXN0aW5nXSksXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0gZGVsZWdhdGVUb0ZhY3RvcnkoXG4gICAgICAgIG1ldGEudHlwZSBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBtZXRhLmludGVybmFsVHlwZSBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+KTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gbWV0YS5pbnRlcm5hbFR5cGU7XG5cbiAgY29uc3QgaW5qZWN0YWJsZVByb3BzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt0b2tlbiwgZmFjdG9yeTogcmVzdWx0LmZhY3Rvcnl9O1xuXG4gIC8vIE9ubHkgZ2VuZXJhdGUgcHJvdmlkZWRJbiBwcm9wZXJ0eSBpZiBpdCBoYXMgYSBub24tbnVsbCB2YWx1ZVxuICBpZiAoKG1ldGEucHJvdmlkZWRJbiBhcyBvLkxpdGVyYWxFeHByKS52YWx1ZSAhPT0gbnVsbCkge1xuICAgIGluamVjdGFibGVQcm9wcy5wcm92aWRlZEluID0gbWV0YS5wcm92aWRlZEluO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuybXJtWRlZmluZUluamVjdGFibGUpLmNhbGxGbihbbWFwVG9NYXBFeHByZXNzaW9uKGluamVjdGFibGVQcm9wcyldKTtcbiAgY29uc3QgdHlwZSA9IG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihcbiAgICAgIElkZW50aWZpZXJzLkluamVjdGFibGVEZWYsIFt0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KV0pKTtcblxuICByZXR1cm4ge1xuICAgIGV4cHJlc3Npb24sXG4gICAgdHlwZSxcbiAgICBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50cyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZGVsZWdhdGVUb0ZhY3RvcnkodHlwZTogby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgaW50ZXJuYWxUeXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+KSB7XG4gIHJldHVybiB7XG4gICAgc3RhdGVtZW50czogW10sXG4gICAgLy8gSWYgdHlwZXMgYXJlIHRoZSBzYW1lLCB3ZSBjYW4gZ2VuZXJhdGUgYGZhY3Rvcnk6IHR5cGUuybVmYWNgXG4gICAgLy8gSWYgdHlwZXMgYXJlIGRpZmZlcmVudCwgd2UgaGF2ZSB0byBnZW5lcmF0ZSBhIHdyYXBwZXIgZnVuY3Rpb24gdG8gZW5zdXJlXG4gICAgLy8gdGhlIGludGVybmFsIHR5cGUgaGFzIGJlZW4gcmVzb2x2ZWQgKGBmYWN0b3J5OiBmdW5jdGlvbih0KSB7IHJldHVybiB0eXBlLsm1ZmFjKHQpOyB9YClcbiAgICBmYWN0b3J5OiB0eXBlLm5vZGUgPT09IGludGVybmFsVHlwZS5ub2RlID9cbiAgICAgICAgaW50ZXJuYWxUeXBlLnByb3AoJ8m1ZmFjJykgOlxuICAgICAgICBvLmZuKFtuZXcgby5GblBhcmFtKCd0Jywgby5EWU5BTUlDX1RZUEUpXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChpbnRlcm5hbFR5cGUuY2FsbE1ldGhvZChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnybVmYWMnLCBbby52YXJpYWJsZSgndCcpXSkpXSlcbiAgfTtcbn1cbiJdfQ==