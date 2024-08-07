/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from './output/output_ast';
import { compileFactoryFunction, FactoryTarget, R3FactoryDelegateType, } from './render3/r3_factory';
import { Identifiers } from './render3/r3_identifiers';
import { convertFromMaybeForwardRefExpression, typeWithParameters, } from './render3/util';
import { DefinitionMap } from './render3/view/util';
export function compileInjectable(meta, resolveForwardRefs) {
    let result = null;
    const factoryMeta = {
        name: meta.name,
        type: meta.type,
        typeArgumentCount: meta.typeArgumentCount,
        deps: [],
        target: FactoryTarget.Injectable,
    };
    if (meta.useClass !== undefined) {
        // meta.useClass has two modes of operation. Either deps are specified, in which case `new` is
        // used to instantiate the class with dependencies injected, or deps are not specified and
        // the factory of the class is used to instantiate it.
        //
        // A special case exists for useClass: Type where Type is the injectable type itself and no
        // deps are specified, in which case 'useClass' is effectively ignored.
        const useClassOnSelf = meta.useClass.expression.isEquivalent(meta.type.value);
        let deps = undefined;
        if (meta.deps !== undefined) {
            deps = meta.deps;
        }
        if (deps !== undefined) {
            // factory: () => new meta.useClass(...deps)
            result = compileFactoryFunction({
                ...factoryMeta,
                delegate: meta.useClass.expression,
                delegateDeps: deps,
                delegateType: R3FactoryDelegateType.Class,
            });
        }
        else if (useClassOnSelf) {
            result = compileFactoryFunction(factoryMeta);
        }
        else {
            result = {
                statements: [],
                expression: delegateToFactory(meta.type.value, meta.useClass.expression, resolveForwardRefs),
            };
        }
    }
    else if (meta.useFactory !== undefined) {
        if (meta.deps !== undefined) {
            result = compileFactoryFunction({
                ...factoryMeta,
                delegate: meta.useFactory,
                delegateDeps: meta.deps || [],
                delegateType: R3FactoryDelegateType.Function,
            });
        }
        else {
            result = { statements: [], expression: o.arrowFn([], meta.useFactory.callFn([])) };
        }
    }
    else if (meta.useValue !== undefined) {
        // Note: it's safe to use `meta.useValue` instead of the `USE_VALUE in meta` check used for
        // client code because meta.useValue is an Expression which will be defined even if the actual
        // value is undefined.
        result = compileFactoryFunction({
            ...factoryMeta,
            expression: meta.useValue.expression,
        });
    }
    else if (meta.useExisting !== undefined) {
        // useExisting is an `inject` call on the existing token.
        result = compileFactoryFunction({
            ...factoryMeta,
            expression: o.importExpr(Identifiers.inject).callFn([meta.useExisting.expression]),
        });
    }
    else {
        result = {
            statements: [],
            expression: delegateToFactory(meta.type.value, meta.type.value, resolveForwardRefs),
        };
    }
    const token = meta.type.value;
    const injectableProps = new DefinitionMap();
    injectableProps.set('token', token);
    injectableProps.set('factory', result.expression);
    // Only generate providedIn property if it has a non-null value
    if (meta.providedIn.expression.value !== null) {
        injectableProps.set('providedIn', convertFromMaybeForwardRefExpression(meta.providedIn));
    }
    const expression = o
        .importExpr(Identifiers.ɵɵdefineInjectable)
        .callFn([injectableProps.toLiteralMap()], undefined, true);
    return {
        expression,
        type: createInjectableType(meta),
        statements: result.statements,
    };
}
export function createInjectableType(meta) {
    return new o.ExpressionType(o.importExpr(Identifiers.InjectableDeclaration, [
        typeWithParameters(meta.type.type, meta.typeArgumentCount),
    ]));
}
function delegateToFactory(type, useType, unwrapForwardRefs) {
    if (type.node === useType.node) {
        // The types are the same, so we can simply delegate directly to the type's factory.
        // ```
        // factory: type.ɵfac
        // ```
        return useType.prop('ɵfac');
    }
    if (!unwrapForwardRefs) {
        // The type is not wrapped in a `forwardRef()`, so we create a simple factory function that
        // accepts a sub-type as an argument.
        // ```
        // factory: function(t) { return useType.ɵfac(t); }
        // ```
        return createFactoryFunction(useType);
    }
    // The useType is actually wrapped in a `forwardRef()` so we need to resolve that before
    // calling its factory.
    // ```
    // factory: function(t) { return core.resolveForwardRef(type).ɵfac(t); }
    // ```
    const unwrappedType = o.importExpr(Identifiers.resolveForwardRef).callFn([useType]);
    return createFactoryFunction(unwrappedType);
}
function createFactoryFunction(type) {
    const t = new o.FnParam('__ngFactoryType__', o.DYNAMIC_TYPE);
    return o.arrowFn([t], type.prop('ɵfac').callFn([o.variable(t.name)]));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3pDLE9BQU8sRUFDTCxzQkFBc0IsRUFDdEIsYUFBYSxFQUViLHFCQUFxQixHQUV0QixNQUFNLHNCQUFzQixDQUFDO0FBQzlCLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUNyRCxPQUFPLEVBQ0wsb0NBQW9DLEVBSXBDLGtCQUFrQixHQUNuQixNQUFNLGdCQUFnQixDQUFDO0FBQ3hCLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQWNsRCxNQUFNLFVBQVUsaUJBQWlCLENBQy9CLElBQTBCLEVBQzFCLGtCQUEyQjtJQUUzQixJQUFJLE1BQU0sR0FBaUUsSUFBSSxDQUFDO0lBRWhGLE1BQU0sV0FBVyxHQUFzQjtRQUNyQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO1FBQ3pDLElBQUksRUFBRSxFQUFFO1FBQ1IsTUFBTSxFQUFFLGFBQWEsQ0FBQyxVQUFVO0tBQ2pDLENBQUM7SUFFRixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDaEMsOEZBQThGO1FBQzlGLDBGQUEwRjtRQUMxRixzREFBc0Q7UUFDdEQsRUFBRTtRQUNGLDJGQUEyRjtRQUMzRix1RUFBdUU7UUFFdkUsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFD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SSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDdkIsMkZBQTJGO1FBQzNGLHFDQUFxQztRQUNyQyxNQUFNO1FBQ04sbURBQW1EO1FBQ25ELE1BQU07UUFDTixPQUFPLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCx3RkFBd0Y7SUFDeEYsdUJBQXVCO0lBQ3ZCLE1BQU07SUFDTix3RUFBd0U7SUFDeEUsTUFBTTtJQUNOLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNwRixPQUFPLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLElBQWtCO0lBQy9DLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDN0QsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1xuICBjb21waWxlRmFjdG9yeUZ1bmN0aW9uLFxuICBGYWN0b3J5VGFyZ2V0LFxuICBSM0RlcGVuZGVuY3lNZXRhZGF0YSxcbiAgUjNGYWN0b3J5RGVsZWdhdGVUeXBlLFxuICBSM0ZhY3RvcnlNZXRhZGF0YSxcbn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7XG4gIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbixcbiAgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbixcbiAgUjNDb21waWxlZEV4cHJlc3Npb24sXG4gIFIzUmVmZXJlbmNlLFxuICB0eXBlV2l0aFBhcmFtZXRlcnMsXG59IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RhYmxlTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IFIzUmVmZXJlbmNlO1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICBwcm92aWRlZEluOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uO1xuICB1c2VDbGFzcz86IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb247XG4gIHVzZUZhY3Rvcnk/OiBvLkV4cHJlc3Npb247XG4gIHVzZUV4aXN0aW5nPzogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbjtcbiAgdXNlVmFsdWU/OiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uO1xuICBkZXBzPzogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RhYmxlKFxuICBtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSxcbiAgcmVzb2x2ZUZvcndhcmRSZWZzOiBib29sZWFuLFxuKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBsZXQgcmVzdWx0OiB7ZXhwcmVzc2lvbjogby5FeHByZXNzaW9uOyBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0IGZhY3RvcnlNZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSA9IHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgIGRlcHM6IFtdLFxuICAgIHRhcmdldDogRmFjdG9yeVRhcmdldC5JbmplY3RhYmxlLFxuICB9O1xuXG4gIGlmIChtZXRhLnVzZUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBtZXRhLnVzZUNsYXNzIGhhcyB0d28gbW9kZXMgb2Ygb3BlcmF0aW9uLiBFaXRoZXIgZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlIGBuZXdgIGlzXG4gICAgLy8gdXNlZCB0byBpbnN0YW50aWF0ZSB0aGUgY2xhc3Mgd2l0aCBkZXBlbmRlbmNpZXMgaW5qZWN0ZWQsIG9yIGRlcHMgYXJlIG5vdCBzcGVjaWZpZWQgYW5kXG4gICAgLy8gdGhlIGZhY3Rvcnkgb2YgdGhlIGNsYXNzIGlzIHVzZWQgdG8gaW5zdGFudGlhdGUgaXQuXG4gICAgLy9cbiAgICAvLyBBIHNwZWNpYWwgY2FzZSBleGlzdHMgZm9yIHVzZUNsYXNzOiBUeXBlIHdoZXJlIFR5cGUgaXMgdGhlIGluamVjdGFibGUgdHlwZSBpdHNlbGYgYW5kIG5vXG4gICAgLy8gZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlICd1c2VDbGFzcycgaXMgZWZmZWN0aXZlbHkgaWdub3JlZC5cblxuICAgIGNvbnN0IHVzZUNsYXNzT25TZWxmID0gbWV0YS51c2VDbGFzcy5leHByZXNzaW9uLmlzRXF1aXZhbGVudChtZXRhLnR5cGUudmFsdWUpO1xuICAgIGxldCBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChtZXRhLmRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGVwcyA9IG1ldGEuZGVwcztcbiAgICB9XG5cbiAgICBpZiAoZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWN0b3J5OiAoKSA9PiBuZXcgbWV0YS51c2VDbGFzcyguLi5kZXBzKVxuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VDbGFzcy5leHByZXNzaW9uLFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IGRlcHMsXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkNsYXNzLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh1c2VDbGFzc09uU2VsZikge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbihmYWN0b3J5TWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIGV4cHJlc3Npb246IGRlbGVnYXRlVG9GYWN0b3J5KFxuICAgICAgICAgIG1ldGEudHlwZS52YWx1ZSBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LFxuICAgICAgICAgIG1ldGEudXNlQ2xhc3MuZXhwcmVzc2lvbiBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LFxuICAgICAgICAgIHJlc29sdmVGb3J3YXJkUmVmcyxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlRmFjdG9yeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKG1ldGEuZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICAgIGRlbGVnYXRlOiBtZXRhLnVzZUZhY3RvcnksXG4gICAgICAgIGRlbGVnYXRlRGVwczogbWV0YS5kZXBzIHx8IFtdLFxuICAgICAgICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GdW5jdGlvbixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSB7c3RhdGVtZW50czogW10sIGV4cHJlc3Npb246IG8uYXJyb3dGbihbXSwgbWV0YS51c2VGYWN0b3J5LmNhbGxGbihbXSkpfTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gTm90ZTogaXQncyBzYWZlIHRvIHVzZSBgbWV0YS51c2VWYWx1ZWAgaW5zdGVhZCBvZiB0aGUgYFVTRV9WQUxVRSBpbiBtZXRhYCBjaGVjayB1c2VkIGZvclxuICAgIC8vIGNsaWVudCBjb2RlIGJlY2F1c2UgbWV0YS51c2VWYWx1ZSBpcyBhbiBFeHByZXNzaW9uIHdoaWNoIHdpbGwgYmUgZGVmaW5lZCBldmVuIGlmIHRoZSBhY3R1YWxcbiAgICAvLyB2YWx1ZSBpcyB1bmRlZmluZWQuXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG1ldGEudXNlVmFsdWUuZXhwcmVzc2lvbixcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChtZXRhLnVzZUV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyB1c2VFeGlzdGluZyBpcyBhbiBgaW5qZWN0YCBjYWxsIG9uIHRoZSBleGlzdGluZyB0b2tlbi5cbiAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgZXhwcmVzc2lvbjogby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmluamVjdCkuY2FsbEZuKFttZXRhLnVzZUV4aXN0aW5nLmV4cHJlc3Npb25dKSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSB7XG4gICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgIGV4cHJlc3Npb246IGRlbGVnYXRlVG9GYWN0b3J5KFxuICAgICAgICBtZXRhLnR5cGUudmFsdWUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PixcbiAgICAgICAgbWV0YS50eXBlLnZhbHVlIGFzIG8uV3JhcHBlZE5vZGVFeHByPGFueT4sXG4gICAgICAgIHJlc29sdmVGb3J3YXJkUmVmcyxcbiAgICAgICksXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gbWV0YS50eXBlLnZhbHVlO1xuXG4gIGNvbnN0IGluamVjdGFibGVQcm9wcyA9IG5ldyBEZWZpbml0aW9uTWFwPHtcbiAgICB0b2tlbjogby5FeHByZXNzaW9uO1xuICAgIGZhY3Rvcnk6IG8uRXhwcmVzc2lvbjtcbiAgICBwcm92aWRlZEluOiBvLkV4cHJlc3Npb247XG4gIH0+KCk7XG4gIGluamVjdGFibGVQcm9wcy5zZXQoJ3Rva2VuJywgdG9rZW4pO1xuICBpbmplY3RhYmxlUHJvcHMuc2V0KCdmYWN0b3J5JywgcmVzdWx0LmV4cHJlc3Npb24pO1xuXG4gIC8vIE9ubHkgZ2VuZXJhdGUgcHJvdmlkZWRJbiBwcm9wZXJ0eSBpZiBpdCBoYXMgYSBub24tbnVsbCB2YWx1ZVxuICBpZiAoKG1ldGEucHJvdmlkZWRJbi5leHByZXNzaW9uIGFzIG8uTGl0ZXJhbEV4cHIpLnZhbHVlICE9PSBudWxsKSB7XG4gICAgaW5qZWN0YWJsZVByb3BzLnNldCgncHJvdmlkZWRJbicsIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihtZXRhLnByb3ZpZGVkSW4pKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvXG4gICAgLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuybXJtWRlZmluZUluamVjdGFibGUpXG4gICAgLmNhbGxGbihbaW5qZWN0YWJsZVByb3BzLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgcmV0dXJuIHtcbiAgICBleHByZXNzaW9uLFxuICAgIHR5cGU6IGNyZWF0ZUluamVjdGFibGVUeXBlKG1ldGEpLFxuICAgIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW5qZWN0YWJsZVR5cGUobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpIHtcbiAgcmV0dXJuIG5ldyBvLkV4cHJlc3Npb25UeXBlKFxuICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5JbmplY3RhYmxlRGVjbGFyYXRpb24sIFtcbiAgICAgIHR5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgXSksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGRlbGVnYXRlVG9GYWN0b3J5KFxuICB0eXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LFxuICB1c2VUeXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LFxuICB1bndyYXBGb3J3YXJkUmVmczogYm9vbGVhbixcbik6IG8uRXhwcmVzc2lvbiB7XG4gIGlmICh0eXBlLm5vZGUgPT09IHVzZVR5cGUubm9kZSkge1xuICAgIC8vIFRoZSB0eXBlcyBhcmUgdGhlIHNhbWUsIHNvIHdlIGNhbiBzaW1wbHkgZGVsZWdhdGUgZGlyZWN0bHkgdG8gdGhlIHR5cGUncyBmYWN0b3J5LlxuICAgIC8vIGBgYFxuICAgIC8vIGZhY3Rvcnk6IHR5cGUuybVmYWNcbiAgICAvLyBgYGBcbiAgICByZXR1cm4gdXNlVHlwZS5wcm9wKCfJtWZhYycpO1xuICB9XG5cbiAgaWYgKCF1bndyYXBGb3J3YXJkUmVmcykge1xuICAgIC8vIFRoZSB0eXBlIGlzIG5vdCB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAsIHNvIHdlIGNyZWF0ZSBhIHNpbXBsZSBmYWN0b3J5IGZ1bmN0aW9uIHRoYXRcbiAgICAvLyBhY2NlcHRzIGEgc3ViLXR5cGUgYXMgYW4gYXJndW1lbnQuXG4gICAgLy8gYGBgXG4gICAgLy8gZmFjdG9yeTogZnVuY3Rpb24odCkgeyByZXR1cm4gdXNlVHlwZS7JtWZhYyh0KTsgfVxuICAgIC8vIGBgYFxuICAgIHJldHVybiBjcmVhdGVGYWN0b3J5RnVuY3Rpb24odXNlVHlwZSk7XG4gIH1cblxuICAvLyBUaGUgdXNlVHlwZSBpcyBhY3R1YWxseSB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgc28gd2UgbmVlZCB0byByZXNvbHZlIHRoYXQgYmVmb3JlXG4gIC8vIGNhbGxpbmcgaXRzIGZhY3RvcnkuXG4gIC8vIGBgYFxuICAvLyBmYWN0b3J5OiBmdW5jdGlvbih0KSB7IHJldHVybiBjb3JlLnJlc29sdmVGb3J3YXJkUmVmKHR5cGUpLsm1ZmFjKHQpOyB9XG4gIC8vIGBgYFxuICBjb25zdCB1bndyYXBwZWRUeXBlID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc29sdmVGb3J3YXJkUmVmKS5jYWxsRm4oW3VzZVR5cGVdKTtcbiAgcmV0dXJuIGNyZWF0ZUZhY3RvcnlGdW5jdGlvbih1bndyYXBwZWRUeXBlKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmFjdG9yeUZ1bmN0aW9uKHR5cGU6IG8uRXhwcmVzc2lvbik6IG8uQXJyb3dGdW5jdGlvbkV4cHIge1xuICBjb25zdCB0ID0gbmV3IG8uRm5QYXJhbSgnX19uZ0ZhY3RvcnlUeXBlX18nLCBvLkRZTkFNSUNfVFlQRSk7XG4gIHJldHVybiBvLmFycm93Rm4oW3RdLCB0eXBlLnByb3AoJ8m1ZmFjJykuY2FsbEZuKFtvLnZhcmlhYmxlKHQubmFtZSldKSk7XG59XG4iXX0=