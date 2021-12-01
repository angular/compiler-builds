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
        define("@angular/compiler/src/injectable_compiler_2", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createInjectableType = exports.compileInjectable = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/util");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    function compileInjectable(meta, resolveForwardRefs) {
        var result = null;
        var factoryMeta = {
            name: meta.name,
            type: meta.type,
            internalType: meta.internalType,
            typeArgumentCount: meta.typeArgumentCount,
            deps: [],
            target: r3_factory_1.FactoryTarget.Injectable,
        };
        if (meta.useClass !== undefined) {
            // meta.useClass has two modes of operation. Either deps are specified, in which case `new` is
            // used to instantiate the class with dependencies injected, or deps are not specified and
            // the factory of the class is used to instantiate it.
            //
            // A special case exists for useClass: Type where Type is the injectable type itself and no
            // deps are specified, in which case 'useClass' is effectively ignored.
            var useClassOnSelf = meta.useClass.expression.isEquivalent(meta.internalType);
            var deps = undefined;
            if (meta.deps !== undefined) {
                deps = meta.deps;
            }
            if (deps !== undefined) {
                // factory: () => new meta.useClass(...deps)
                result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { delegate: meta.useClass.expression, delegateDeps: deps, delegateType: r3_factory_1.R3FactoryDelegateType.Class }));
            }
            else if (useClassOnSelf) {
                result = r3_factory_1.compileFactoryFunction(factoryMeta);
            }
            else {
                result = {
                    statements: [],
                    expression: delegateToFactory(meta.type.value, meta.useClass.expression, resolveForwardRefs)
                };
            }
        }
        else if (meta.useFactory !== undefined) {
            if (meta.deps !== undefined) {
                result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { delegate: meta.useFactory, delegateDeps: meta.deps || [], delegateType: r3_factory_1.R3FactoryDelegateType.Function }));
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
            result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { expression: meta.useValue.expression }));
        }
        else if (meta.useExisting !== undefined) {
            // useExisting is an `inject` call on the existing token.
            result = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, factoryMeta), { expression: o.importExpr(r3_identifiers_1.Identifiers.inject).callFn([meta.useExisting.expression]) }));
        }
        else {
            result = {
                statements: [],
                expression: delegateToFactory(meta.type.value, meta.internalType, resolveForwardRefs)
            };
        }
        var token = meta.internalType;
        var injectableProps = new util_2.DefinitionMap();
        injectableProps.set('token', token);
        injectableProps.set('factory', result.expression);
        // Only generate providedIn property if it has a non-null value
        if (meta.providedIn.expression.value !== null) {
            injectableProps.set('providedIn', util_1.convertFromMaybeForwardRefExpression(meta.providedIn));
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.ɵɵdefineInjectable)
            .callFn([injectableProps.toLiteralMap()], undefined, true);
        return {
            expression: expression,
            type: createInjectableType(meta),
            statements: result.statements,
        };
    }
    exports.compileInjectable = compileInjectable;
    function createInjectableType(meta) {
        return new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.InjectableDeclaration, [util_1.typeWithParameters(meta.type.type, meta.typeArgumentCount)]));
    }
    exports.createInjectableType = createInjectableType;
    function delegateToFactory(type, internalType, unwrapForwardRefs) {
        if (type.node === internalType.node) {
            // The types are the same, so we can simply delegate directly to the type's factory.
            // ```
            // factory: type.ɵfac
            // ```
            return internalType.prop('ɵfac');
        }
        if (!unwrapForwardRefs) {
            // The type is not wrapped in a `forwardRef()`, so we create a simple factory function that
            // accepts a sub-type as an argument.
            // ```
            // factory: function(t) { return internalType.ɵfac(t); }
            // ```
            return createFactoryFunction(internalType);
        }
        // The internalType is actually wrapped in a `forwardRef()` so we need to resolve that before
        // calling its factory.
        // ```
        // factory: function(t) { return core.resolveForwardRef(type).ɵfac(t); }
        // ```
        var unwrappedType = o.importExpr(r3_identifiers_1.Identifiers.resolveForwardRef).callFn([internalType]);
        return createFactoryFunction(unwrappedType);
    }
    function createFactoryFunction(type) {
        return o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(type.callMethod('ɵfac', [o.variable('t')]))]);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsMkRBQXlDO0lBQ3pDLHVFQUEySTtJQUMzSSwrRUFBcUQ7SUFDckQsMkRBQThMO0lBQzlMLGdFQUFrRDtJQWVsRCxTQUFnQixpQkFBaUIsQ0FDN0IsSUFBMEIsRUFBRSxrQkFBMkI7UUFDekQsSUFBSSxNQUFNLEdBQStELElBQUksQ0FBQztRQUU5RSxJQUFNLFdBQVcsR0FBc0I7WUFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO1lBQy9CLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7WUFDekMsSUFBSSxFQUFFLEVBQUU7WUFDUixNQUFNLEVBQUUsMEJBQWEsQ0FBQyxVQUFVO1NBQ2pDLENBQUM7UUFFRixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQy9CLDhGQUE4RjtZQUM5RiwwRkFBMEY7WUFDMUYsc0RBQXNEO1lBQ3RELEVBQUU7WUFDRiwyRkFBMkY7WUFDM0YsdUVBQXVFO1lBRXZFLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDaEYsSUFBSSxJQUFJLEdBQXFDLFNBQVMsQ0FBQztZQUN2RCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO2dCQUMzQixJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQzthQUNsQjtZQUVELElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtnQkFDdEIsNENB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RixPQUFPLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxTQUFTLHFCQUFxQixDQUFDLElBQWtCO1FBQy9DLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUCxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQ3BDLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0UsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBGYWN0b3J5VGFyZ2V0LCBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5RGVsZWdhdGVUeXBlLCBSM0ZhY3RvcnlNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLCBGb3J3YXJkUmVmSGFuZGxpbmcsIGdlbmVyYXRlRm9yd2FyZFJlZiwgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgUjNDb21waWxlZEV4cHJlc3Npb24sIFIzUmVmZXJlbmNlLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RhYmxlTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IFIzUmVmZXJlbmNlO1xuICBpbnRlcm5hbFR5cGU6IG8uRXhwcmVzc2lvbjtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgcHJvdmlkZWRJbjogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbjtcbiAgdXNlQ2xhc3M/OiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uO1xuICB1c2VGYWN0b3J5Pzogby5FeHByZXNzaW9uO1xuICB1c2VFeGlzdGluZz86IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb247XG4gIHVzZVZhbHVlPzogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbjtcbiAgZGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlSW5qZWN0YWJsZShcbiAgICBtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSwgcmVzb2x2ZUZvcndhcmRSZWZzOiBib29sZWFuKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBsZXQgcmVzdWx0OiB7ZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfXxudWxsID0gbnVsbDtcblxuICBjb25zdCBmYWN0b3J5TWV0YTogUjNGYWN0b3J5TWV0YWRhdGEgPSB7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICBpbnRlcm5hbFR5cGU6IG1ldGEuaW50ZXJuYWxUeXBlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgIGRlcHM6IFtdLFxuICAgIHRhcmdldDogRmFjdG9yeVRhcmdldC5JbmplY3RhYmxlLFxuICB9O1xuXG4gIGlmIChtZXRhLnVzZUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBtZXRhLnVzZUNsYXNzIGhhcyB0d28gbW9kZXMgb2Ygb3BlcmF0aW9uLiBFaXRoZXIgZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlIGBuZXdgIGlzXG4gICAgLy8gdXNlZCB0byBpbnN0YW50aWF0ZSB0aGUgY2xhc3Mgd2l0aCBkZXBlbmRlbmNpZXMgaW5qZWN0ZWQsIG9yIGRlcHMgYXJlIG5vdCBzcGVjaWZpZWQgYW5kXG4gICAgLy8gdGhlIGZhY3Rvcnkgb2YgdGhlIGNsYXNzIGlzIHVzZWQgdG8gaW5zdGFudGlhdGUgaXQuXG4gICAgLy9cbiAgICAvLyBBIHNwZWNpYWwgY2FzZSBleGlzdHMgZm9yIHVzZUNsYXNzOiBUeXBlIHdoZXJlIFR5cGUgaXMgdGhlIGluamVjdGFibGUgdHlwZSBpdHNlbGYgYW5kIG5vXG4gICAgLy8gZGVwcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlICd1c2VDbGFzcycgaXMgZWZmZWN0aXZlbHkgaWdub3JlZC5cblxuICAgIGNvbnN0IHVzZUNsYXNzT25TZWxmID0gbWV0YS51c2VDbGFzcy5leHByZXNzaW9uLmlzRXF1aXZhbGVudChtZXRhLmludGVybmFsVHlwZSk7XG4gICAgbGV0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChtZXRhLmRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGVwcyA9IG1ldGEuZGVwcztcbiAgICB9XG5cbiAgICBpZiAoZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWN0b3J5OiAoKSA9PiBuZXcgbWV0YS51c2VDbGFzcyguLi5kZXBzKVxuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VDbGFzcy5leHByZXNzaW9uLFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IGRlcHMsXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkNsYXNzLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh1c2VDbGFzc09uU2VsZikge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbihmYWN0b3J5TWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIGV4cHJlc3Npb246IGRlbGVnYXRlVG9GYWN0b3J5KFxuICAgICAgICAgICAgbWV0YS50eXBlLnZhbHVlIGFzIG8uV3JhcHBlZE5vZGVFeHByPGFueT4sXG4gICAgICAgICAgICBtZXRhLnVzZUNsYXNzLmV4cHJlc3Npb24gYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgcmVzb2x2ZUZvcndhcmRSZWZzKVxuICAgICAgfTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VGYWN0b3J5ICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAobWV0YS5kZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgICAgZGVsZWdhdGU6IG1ldGEudXNlRmFjdG9yeSxcbiAgICAgICAgZGVsZWdhdGVEZXBzOiBtZXRhLmRlcHMgfHwgW10sXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIGV4cHJlc3Npb246IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQobWV0YS51c2VGYWN0b3J5LmNhbGxGbihbXSkpXSlcbiAgICAgIH07XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE5vdGU6IGl0J3Mgc2FmZSB0byB1c2UgYG1ldGEudXNlVmFsdWVgIGluc3RlYWQgb2YgdGhlIGBVU0VfVkFMVUUgaW4gbWV0YWAgY2hlY2sgdXNlZCBmb3JcbiAgICAvLyBjbGllbnQgY29kZSBiZWNhdXNlIG1ldGEudXNlVmFsdWUgaXMgYW4gRXhwcmVzc2lvbiB3aGljaCB3aWxsIGJlIGRlZmluZWQgZXZlbiBpZiB0aGUgYWN0dWFsXG4gICAgLy8gdmFsdWUgaXMgdW5kZWZpbmVkLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBtZXRhLnVzZVZhbHVlLmV4cHJlc3Npb24sXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAobWV0YS51c2VFeGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gdXNlRXhpc3RpbmcgaXMgYW4gYGluamVjdGAgY2FsbCBvbiB0aGUgZXhpc3RpbmcgdG9rZW4uXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbmplY3QpLmNhbGxGbihbbWV0YS51c2VFeGlzdGluZy5leHByZXNzaW9uXSksXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0ge1xuICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICBleHByZXNzaW9uOiBkZWxlZ2F0ZVRvRmFjdG9yeShcbiAgICAgICAgICBtZXRhLnR5cGUudmFsdWUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgbWV0YS5pbnRlcm5hbFR5cGUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PixcbiAgICAgICAgICByZXNvbHZlRm9yd2FyZFJlZnMpXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gbWV0YS5pbnRlcm5hbFR5cGU7XG5cbiAgY29uc3QgaW5qZWN0YWJsZVByb3BzID1cbiAgICAgIG5ldyBEZWZpbml0aW9uTWFwPHt0b2tlbjogby5FeHByZXNzaW9uLCBmYWN0b3J5OiBvLkV4cHJlc3Npb24sIHByb3ZpZGVkSW46IG8uRXhwcmVzc2lvbn0+KCk7XG4gIGluamVjdGFibGVQcm9wcy5zZXQoJ3Rva2VuJywgdG9rZW4pO1xuICBpbmplY3RhYmxlUHJvcHMuc2V0KCdmYWN0b3J5JywgcmVzdWx0LmV4cHJlc3Npb24pO1xuXG4gIC8vIE9ubHkgZ2VuZXJhdGUgcHJvdmlkZWRJbiBwcm9wZXJ0eSBpZiBpdCBoYXMgYSBub24tbnVsbCB2YWx1ZVxuICBpZiAoKG1ldGEucHJvdmlkZWRJbi5leHByZXNzaW9uIGFzIG8uTGl0ZXJhbEV4cHIpLnZhbHVlICE9PSBudWxsKSB7XG4gICAgaW5qZWN0YWJsZVByb3BzLnNldCgncHJvdmlkZWRJbicsIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihtZXRhLnByb3ZpZGVkSW4pKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuybXJtWRlZmluZUluamVjdGFibGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihbaW5qZWN0YWJsZVByb3BzLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgcmV0dXJuIHtcbiAgICBleHByZXNzaW9uLFxuICAgIHR5cGU6IGNyZWF0ZUluamVjdGFibGVUeXBlKG1ldGEpLFxuICAgIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW5qZWN0YWJsZVR5cGUobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpIHtcbiAgcmV0dXJuIG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihcbiAgICAgIElkZW50aWZpZXJzLkluamVjdGFibGVEZWNsYXJhdGlvbixcbiAgICAgIFt0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpXSkpO1xufVxuXG5mdW5jdGlvbiBkZWxlZ2F0ZVRvRmFjdG9yeShcbiAgICB0eXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBpbnRlcm5hbFR5cGU6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sXG4gICAgdW53cmFwRm9yd2FyZFJlZnM6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAodHlwZS5ub2RlID09PSBpbnRlcm5hbFR5cGUubm9kZSkge1xuICAgIC8vIFRoZSB0eXBlcyBhcmUgdGhlIHNhbWUsIHNvIHdlIGNhbiBzaW1wbHkgZGVsZWdhdGUgZGlyZWN0bHkgdG8gdGhlIHR5cGUncyBmYWN0b3J5LlxuICAgIC8vIGBgYFxuICAgIC8vIGZhY3Rvcnk6IHR5cGUuybVmYWNcbiAgICAvLyBgYGBcbiAgICByZXR1cm4gaW50ZXJuYWxUeXBlLnByb3AoJ8m1ZmFjJyk7XG4gIH1cblxuICBpZiAoIXVud3JhcEZvcndhcmRSZWZzKSB7XG4gICAgLy8gVGhlIHR5cGUgaXMgbm90IHdyYXBwZWQgaW4gYSBgZm9yd2FyZFJlZigpYCwgc28gd2UgY3JlYXRlIGEgc2ltcGxlIGZhY3RvcnkgZnVuY3Rpb24gdGhhdFxuICAgIC8vIGFjY2VwdHMgYSBzdWItdHlwZSBhcyBhbiBhcmd1bWVudC5cbiAgICAvLyBgYGBcbiAgICAvLyBmYWN0b3J5OiBmdW5jdGlvbih0KSB7IHJldHVybiBpbnRlcm5hbFR5cGUuybVmYWModCk7IH1cbiAgICAvLyBgYGBcbiAgICByZXR1cm4gY3JlYXRlRmFjdG9yeUZ1bmN0aW9uKGludGVybmFsVHlwZSk7XG4gIH1cblxuICAvLyBUaGUgaW50ZXJuYWxUeXBlIGlzIGFjdHVhbGx5IHdyYXBwZWQgaW4gYSBgZm9yd2FyZFJlZigpYCBzbyB3ZSBuZWVkIHRvIHJlc29sdmUgdGhhdCBiZWZvcmVcbiAgLy8gY2FsbGluZyBpdHMgZmFjdG9yeS5cbiAgLy8gYGBgXG4gIC8vIGZhY3Rvcnk6IGZ1bmN0aW9uKHQpIHsgcmV0dXJuIGNvcmUucmVzb2x2ZUZvcndhcmRSZWYodHlwZSkuybVmYWModCk7IH1cbiAgLy8gYGBgXG4gIGNvbnN0IHVud3JhcHBlZFR5cGUgPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVzb2x2ZUZvcndhcmRSZWYpLmNhbGxGbihbaW50ZXJuYWxUeXBlXSk7XG4gIHJldHVybiBjcmVhdGVGYWN0b3J5RnVuY3Rpb24odW53cmFwcGVkVHlwZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUZhY3RvcnlGdW5jdGlvbih0eXBlOiBvLkV4cHJlc3Npb24pOiBvLkZ1bmN0aW9uRXhwciB7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oJ3QnLCBvLkRZTkFNSUNfVFlQRSldLFxuICAgICAgW25ldyBvLlJldHVyblN0YXRlbWVudCh0eXBlLmNhbGxNZXRob2QoJ8m1ZmFjJywgW28udmFyaWFibGUoJ3QnKV0pKV0pO1xufVxuIl19