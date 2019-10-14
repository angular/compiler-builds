/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { Identifiers } from './identifiers';
import * as o from './output/output_ast';
import { R3FactoryDelegateType, compileFactoryFunction } from './render3/r3_factory';
import { mapToMapExpression, typeWithParameters } from './render3/util';
export function compileInjectable(meta) {
    var result = null;
    var factoryMeta = {
        name: meta.name,
        type: meta.type,
        typeArgumentCount: meta.typeArgumentCount,
        deps: [],
        injectFn: Identifiers.inject,
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
            result = compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { delegate: meta.useClass, delegateDeps: deps, delegateType: R3FactoryDelegateType.Class }));
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
            result = compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { delegate: meta.useFactory, delegateDeps: meta.userDeps || [], delegateType: R3FactoryDelegateType.Function }));
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
        result = compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { expression: meta.useValue }));
    }
    else if (meta.useExisting !== undefined) {
        // useExisting is an `inject` call on the existing token.
        result = compileFactoryFunction(tslib_1.__assign({}, factoryMeta, { expression: o.importExpr(Identifiers.inject).callFn([meta.useExisting]) }));
    }
    else {
        result = delegateToFactory(meta.type);
    }
    var token = meta.type;
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
        // () => meta.type.ɵfac(t)
        factory: o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(type.callMethod('ɵfac', [o.variable('t')]))])
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEtBQUssQ0FBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3pDLE9BQU8sRUFBdUIscUJBQXFCLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUN6RyxPQUFPLEVBQUMsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQW9CdEUsTUFBTSxVQUFVLGlCQUFpQixDQUFDLElBQTBCO0lBQzFELElBQUksTUFBTSxHQUE0RCxJQUFJLENBQUM7SUFFM0UsSUFBTSxXQUFXLEdBQUc7UUFDbEIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtRQUN6QyxJQUFJLEVBQUUsRUFBRTtRQUNSLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTTtLQUM3QixDQUFDO0lBRUYsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtRQUMvQiw4RkFBOEY7UUFDOUYsMEZBQTBGO1FBQzFGLHNEQUFzRDtRQUN0RCxFQUFFO1FBQ0YsMkZBQTJGO1FBQzNGLHVFQUF1RTtRQUV2RSxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0QsSUFBSSxJQUFJLEdBQXFDLFNBQVMsQ0FBQztRQUN2RCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQy9CLElB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QixPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FDbEMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3RGLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUsIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb259IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7bWFwVG9NYXBFeHByZXNzaW9uLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBJbmplY3RhYmxlRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RhYmxlTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgcHJvdmlkZWRJbjogby5FeHByZXNzaW9uO1xuICB1c2VDbGFzcz86IG8uRXhwcmVzc2lvbjtcbiAgdXNlRmFjdG9yeT86IG8uRXhwcmVzc2lvbjtcbiAgdXNlRXhpc3Rpbmc/OiBvLkV4cHJlc3Npb247XG4gIHVzZVZhbHVlPzogby5FeHByZXNzaW9uO1xuICB1c2VyRGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlSW5qZWN0YWJsZShtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSk6IEluamVjdGFibGVEZWYge1xuICBsZXQgcmVzdWx0OiB7ZmFjdG9yeTogby5FeHByZXNzaW9uLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfXxudWxsID0gbnVsbDtcblxuICBjb25zdCBmYWN0b3J5TWV0YSA9IHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgIGRlcHM6IFtdLFxuICAgIGluamVjdEZuOiBJZGVudGlmaWVycy5pbmplY3QsXG4gIH07XG5cbiAgaWYgKG1ldGEudXNlQ2xhc3MgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIG1ldGEudXNlQ2xhc3MgaGFzIHR3byBtb2RlcyBvZiBvcGVyYXRpb24uIEVpdGhlciBkZXBzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgYG5ld2AgaXNcbiAgICAvLyB1c2VkIHRvIGluc3RhbnRpYXRlIHRoZSBjbGFzcyB3aXRoIGRlcGVuZGVuY2llcyBpbmplY3RlZCwgb3IgZGVwcyBhcmUgbm90IHNwZWNpZmllZCBhbmRcbiAgICAvLyB0aGUgZmFjdG9yeSBvZiB0aGUgY2xhc3MgaXMgdXNlZCB0byBpbnN0YW50aWF0ZSBpdC5cbiAgICAvL1xuICAgIC8vIEEgc3BlY2lhbCBjYXNlIGV4aXN0cyBmb3IgdXNlQ2xhc3M6IFR5cGUgd2hlcmUgVHlwZSBpcyB0aGUgaW5qZWN0YWJsZSB0eXBlIGl0c2VsZiBhbmQgbm9cbiAgICAvLyBkZXBzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgJ3VzZUNsYXNzJyBpcyBlZmZlY3RpdmVseSBpZ25vcmVkLlxuXG4gICAgY29uc3QgdXNlQ2xhc3NPblNlbGYgPSBtZXRhLnVzZUNsYXNzLmlzRXF1aXZhbGVudChtZXRhLnR5cGUpO1xuICAgIGxldCBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAobWV0YS51c2VyRGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkZXBzID0gbWV0YS51c2VyRGVwcztcbiAgICB9XG5cbiAgICBpZiAoZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWN0b3J5OiAoKSA9PiBuZXcgbWV0YS51c2VDbGFzcyguLi5kZXBzKVxuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VDbGFzcyxcbiAgICAgICAgZGVsZWdhdGVEZXBzOiBkZXBzLFxuICAgICAgICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5DbGFzcyxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodXNlQ2xhc3NPblNlbGYpIHtcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oZmFjdG9yeU1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBkZWxlZ2F0ZVRvRmFjdG9yeShtZXRhLnVzZUNsYXNzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VGYWN0b3J5ICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAobWV0YS51c2VyRGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICAgIGRlbGVnYXRlOiBtZXRhLnVzZUZhY3RvcnksXG4gICAgICAgIGRlbGVnYXRlRGVwczogbWV0YS51c2VyRGVwcyB8fCBbXSxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRnVuY3Rpb24sXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0ge1xuICAgICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgICAgZmFjdG9yeTogby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChtZXRhLnVzZUZhY3RvcnkuY2FsbEZuKFtdKSldKVxuICAgICAgfTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gTm90ZTogaXQncyBzYWZlIHRvIHVzZSBgbWV0YS51c2VWYWx1ZWAgaW5zdGVhZCBvZiB0aGUgYFVTRV9WQUxVRSBpbiBtZXRhYCBjaGVjayB1c2VkIGZvclxuICAgIC8vIGNsaWVudCBjb2RlIGJlY2F1c2UgbWV0YS51c2VWYWx1ZSBpcyBhbiBFeHByZXNzaW9uIHdoaWNoIHdpbGwgYmUgZGVmaW5lZCBldmVuIGlmIHRoZSBhY3R1YWxcbiAgICAvLyB2YWx1ZSBpcyB1bmRlZmluZWQuXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG1ldGEudXNlVmFsdWUsXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAobWV0YS51c2VFeGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gdXNlRXhpc3RpbmcgaXMgYW4gYGluamVjdGAgY2FsbCBvbiB0aGUgZXhpc3RpbmcgdG9rZW4uXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbmplY3QpLmNhbGxGbihbbWV0YS51c2VFeGlzdGluZ10pLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IGRlbGVnYXRlVG9GYWN0b3J5KG1ldGEudHlwZSk7XG4gIH1cblxuICBjb25zdCB0b2tlbiA9IG1ldGEudHlwZTtcbiAgY29uc3QgcHJvdmlkZWRJbiA9IG1ldGEucHJvdmlkZWRJbjtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLsm1ybVkZWZpbmVJbmplY3RhYmxlKS5jYWxsRm4oW21hcFRvTWFwRXhwcmVzc2lvbihcbiAgICAgIHt0b2tlbiwgZmFjdG9yeTogcmVzdWx0LmZhY3RvcnksIHByb3ZpZGVkSW59KV0pO1xuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFxuICAgICAgSWRlbnRpZmllcnMuSW5qZWN0YWJsZURlZiwgW3R5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpXSkpO1xuXG4gIHJldHVybiB7XG4gICAgZXhwcmVzc2lvbixcbiAgICB0eXBlLFxuICAgIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBkZWxlZ2F0ZVRvRmFjdG9yeSh0eXBlOiBvLkV4cHJlc3Npb24pIHtcbiAgcmV0dXJuIHtcbiAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAvLyAoKSA9PiBtZXRhLnR5cGUuybVmYWModClcbiAgICBmYWN0b3J5OiBvLmZuKFtuZXcgby5GblBhcmFtKCd0Jywgby5EWU5BTUlDX1RZUEUpXSwgW25ldyBvLlJldHVyblN0YXRlbWVudCh0eXBlLmNhbGxNZXRob2QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnybVmYWMnLCBbby52YXJpYWJsZSgndCcpXSkpXSlcbiAgfTtcbn1cbiJdfQ==