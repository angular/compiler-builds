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
        define("@angular/compiler/src/injectable_compiler_2", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/partial/util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createInjectableType = exports.compileInjectable = exports.createR3ProviderExpression = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/render3/partial/util");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_2 = require("@angular/compiler/src/render3/util");
    var util_3 = require("@angular/compiler/src/render3/view/util");
    function createR3ProviderExpression(expression, isForwardRef) {
        return { expression: expression, isForwardRef: isForwardRef };
    }
    exports.createR3ProviderExpression = createR3ProviderExpression;
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
                result = (0, r3_factory_1.compileFactoryFunction)((0, tslib_1.__assign)((0, tslib_1.__assign)({}, factoryMeta), { delegate: meta.useClass.expression, delegateDeps: deps, delegateType: r3_factory_1.R3FactoryDelegateType.Class }));
            }
            else if (useClassOnSelf) {
                result = (0, r3_factory_1.compileFactoryFunction)(factoryMeta);
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
                result = (0, r3_factory_1.compileFactoryFunction)((0, tslib_1.__assign)((0, tslib_1.__assign)({}, factoryMeta), { delegate: meta.useFactory, delegateDeps: meta.deps || [], delegateType: r3_factory_1.R3FactoryDelegateType.Function }));
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
            result = (0, r3_factory_1.compileFactoryFunction)((0, tslib_1.__assign)((0, tslib_1.__assign)({}, factoryMeta), { expression: meta.useValue.expression }));
        }
        else if (meta.useExisting !== undefined) {
            // useExisting is an `inject` call on the existing token.
            result = (0, r3_factory_1.compileFactoryFunction)((0, tslib_1.__assign)((0, tslib_1.__assign)({}, factoryMeta), { expression: o.importExpr(r3_identifiers_1.Identifiers.inject).callFn([meta.useExisting.expression]) }));
        }
        else {
            result = {
                statements: [],
                expression: delegateToFactory(meta.type.value, meta.internalType, resolveForwardRefs)
            };
        }
        var token = meta.internalType;
        var injectableProps = new util_3.DefinitionMap();
        injectableProps.set('token', token);
        injectableProps.set('factory', result.expression);
        // Only generate providedIn property if it has a non-null value
        if (meta.providedIn.expression.value !== null) {
            injectableProps.set('providedIn', meta.providedIn.isForwardRef ? (0, util_1.generateForwardRef)(meta.providedIn.expression) :
                meta.providedIn.expression);
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
        return new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.InjectableDeclaration, [(0, util_2.typeWithParameters)(meta.type.type, meta.typeArgumentCount)]));
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
        return o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [new o.ReturnStatement(type.prop('ɵfac').callFn([o.variable('t')]))]);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsMkRBQXlDO0lBQ3pDLG1FQUEwRDtJQUMxRCx1RUFBMkk7SUFDM0ksK0VBQXFEO0lBQ3JELDJEQUFxRjtJQUNyRixnRUFBa0Q7SUE0Q2xELFNBQWdCLDBCQUEwQixDQUN0QyxVQUFhLEVBQUUsWUFBcUI7UUFDdEMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLFlBQVksY0FBQSxFQUFDLENBQUM7SUFDcEMsQ0FBQztJQUhELGdFQUdDO0lBRUQsU0FBZ0IsaUJBQWlCLENBQzdCLElBQTBCLEVBQUUsa0JBQTJCO1FBQ3pELElBQUksTUFBTSxHQUErRCxJQUFJLENBQUM7UUFFOUUsSUFBTSxXQUFXLEdBQXNCO1lBQ3JDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtZQUMvQixpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO1lBQ3pDLElBQUksRUFBRSxFQUFFO1lBQ1IsTUFBTSxFQUFFLDBCQUFhLENBQUMsVUFBVTtTQUNqQyxDQUFDO1FBRUYsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUMvQiw4RkFBOEY7WUFDOUYsMEZBQTBGO1lBQzFGLHNEQUFzRDtZQUN0RCxFQUFFO1lBQ0YsMkZBQTJGO1lBQzNGLHVFQUF1RTtZQUV2RSxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ2hGLElBQUksSUFBSSxHQUFxQyxTQUFTLENB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QzNGLHFDQUFxQztZQUNyQyxNQUFNO1lBQ04sd0RBQXdEO1lBQ3hELE1BQU07WUFDTixPQUFPLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQzVDO1FBRUQsNkZBQTZGO1FBQzdGLHVCQUF1QjtRQUN2QixNQUFNO1FBQ04sd0VBQXdFO1FBQ3hFLE1BQU07UUFDTixJQUFNLGFBQWEsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8scUJBQXFCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVELFNBQVMscUJBQXFCLENBQUMsSUFBa0I7UUFDL0MsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUNQLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFDcEMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2dlbmVyYXRlRm9yd2FyZFJlZn0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIEZhY3RvcnlUYXJnZXQsIFIzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUsIFIzRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbiwgUjNSZWZlcmVuY2UsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuL3JlbmRlcjMvdmlldy91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdGFibGVNZXRhZGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogUjNSZWZlcmVuY2U7XG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICBwcm92aWRlZEluOiBSM1Byb3ZpZGVyRXhwcmVzc2lvbjtcbiAgdXNlQ2xhc3M/OiBSM1Byb3ZpZGVyRXhwcmVzc2lvbjtcbiAgdXNlRmFjdG9yeT86IG8uRXhwcmVzc2lvbjtcbiAgdXNlRXhpc3Rpbmc/OiBSM1Byb3ZpZGVyRXhwcmVzc2lvbjtcbiAgdXNlVmFsdWU/OiBSM1Byb3ZpZGVyRXhwcmVzc2lvbjtcbiAgZGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbi8qKlxuICogQW4gZXhwcmVzc2lvbiB1c2VkIHdoZW4gaW5zdGFudGlhdGluZyBhbiBpbmplY3RhYmxlLlxuICpcbiAqIFRoaXMgaXMgdGhlIHR5cGUgb2YgdGhlIGB1c2VDbGFzc2AsIGB1c2VFeGlzdGluZ2AgYW5kIGB1c2VWYWx1ZWAgcHJvcGVydGllcyBvZlxuICogYFIzSW5qZWN0YWJsZU1ldGFkYXRhYCBzaW5jZSB0aG9zZSBjYW4gcmVmZXIgdG8gdHlwZXMgdGhhdCBtYXkgZWFnZXJseSByZWZlcmVuY2UgdHlwZXMgdGhhdCBoYXZlXG4gKiBub3QgeWV0IGJlZW4gZGVmaW5lZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM1Byb3ZpZGVyRXhwcmVzc2lvbjxUIGV4dGVuZHMgby5FeHByZXNzaW9uID0gby5FeHByZXNzaW9uPiB7XG4gIC8qKlxuICAgKiBUaGUgZXhwcmVzc2lvbiB0aGF0IGlzIHVzZWQgdG8gaW5zdGFudGlhdGUgdGhlIEluamVjdGFibGUuXG4gICAqL1xuICBleHByZXNzaW9uOiBUO1xuICAvKipcbiAgICogSWYgdHJ1ZSwgdGhlbiB0aGUgYGV4cHJlc3Npb25gIGNvbnRhaW5zIGEgcmVmZXJlbmNlIHRvIHNvbWV0aGluZyB0aGF0IGhhcyBub3QgeWV0IGJlZW5cbiAgICogZGVmaW5lZC5cbiAgICpcbiAgICogVGhpcyBtZWFucyB0aGF0IHRoZSBleHByZXNzaW9uIG11c3Qgbm90IGJlIGVhZ2VybHkgZXZhbHVhdGVkLiBJbnN0ZWFkIGl0IG11c3QgYmUgd3JhcHBlZCBpbiBhXG4gICAqIGZ1bmN0aW9uIGNsb3N1cmUgdGhhdCB3aWxsIGJlIGV2YWx1YXRlZCBsYXppbHkgdG8gYWxsb3cgdGhlIGRlZmluaXRpb24gb2YgdGhlIGV4cHJlc3Npb24gdG8gYmVcbiAgICogZXZhbHVhdGVkIGZpcnN0LlxuICAgKlxuICAgKiBJbiBzb21lIGNhc2VzIHRoZSBleHByZXNzaW9uIHdpbGwgbmF0dXJhbGx5IGJlIHBsYWNlZCBpbnNpZGUgc3VjaCBhIGZ1bmN0aW9uIGNsb3N1cmUsIHN1Y2ggYXNcbiAgICogaW4gYSBmdWxseSBjb21waWxlZCBmYWN0b3J5IGZ1bmN0aW9uLiBJbiB0aG9zZSBjYXNlIG5vdGhpbmcgbW9yZSBuZWVkcyB0byBiZSBkb25lLlxuICAgKlxuICAgKiBCdXQgaW4gb3RoZXIgY2FzZXMsIHN1Y2ggYXMgcGFydGlhbC1jb21waWxhdGlvbiB0aGUgZXhwcmVzc2lvbiB3aWxsIGJlIGxvY2F0ZWQgaW4gdG9wIGxldmVsXG4gICAqIGNvZGUgc28gd2lsbCBuZWVkIHRvIGJlIHdyYXBwZWQgaW4gYSBmdW5jdGlvbiB0aGF0IGlzIHBhc3NlZCB0byBhIGBmb3J3YXJkUmVmKClgIGNhbGwuXG4gICAqL1xuICBpc0ZvcndhcmRSZWY6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSM1Byb3ZpZGVyRXhwcmVzc2lvbjxUIGV4dGVuZHMgby5FeHByZXNzaW9uPihcbiAgICBleHByZXNzaW9uOiBULCBpc0ZvcndhcmRSZWY6IGJvb2xlYW4pOiBSM1Byb3ZpZGVyRXhwcmVzc2lvbjxUPiB7XG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgaXNGb3J3YXJkUmVmfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RhYmxlKFxuICAgIG1ldGE6IFIzSW5qZWN0YWJsZU1ldGFkYXRhLCByZXNvbHZlRm9yd2FyZFJlZnM6IGJvb2xlYW4pOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGxldCByZXN1bHQ6IHtleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W119fG51bGwgPSBudWxsO1xuXG4gIGNvbnN0IGZhY3RvcnlNZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSA9IHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGludGVybmFsVHlwZTogbWV0YS5pbnRlcm5hbFR5cGUsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IG1ldGEudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgZGVwczogW10sXG4gICAgdGFyZ2V0OiBGYWN0b3J5VGFyZ2V0LkluamVjdGFibGUsXG4gIH07XG5cbiAgaWYgKG1ldGEudXNlQ2xhc3MgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIG1ldGEudXNlQ2xhc3MgaGFzIHR3byBtb2RlcyBvZiBvcGVyYXRpb24uIEVpdGhlciBkZXBzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgYG5ld2AgaXNcbiAgICAvLyB1c2VkIHRvIGluc3RhbnRpYXRlIHRoZSBjbGFzcyB3aXRoIGRlcGVuZGVuY2llcyBpbmplY3RlZCwgb3IgZGVwcyBhcmUgbm90IHNwZWNpZmllZCBhbmRcbiAgICAvLyB0aGUgZmFjdG9yeSBvZiB0aGUgY2xhc3MgaXMgdXNlZCB0byBpbnN0YW50aWF0ZSBpdC5cbiAgICAvL1xuICAgIC8vIEEgc3BlY2lhbCBjYXNlIGV4aXN0cyBmb3IgdXNlQ2xhc3M6IFR5cGUgd2hlcmUgVHlwZSBpcyB0aGUgaW5qZWN0YWJsZSB0eXBlIGl0c2VsZiBhbmQgbm9cbiAgICAvLyBkZXBzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgJ3VzZUNsYXNzJyBpcyBlZmZlY3RpdmVseSBpZ25vcmVkLlxuXG4gICAgY29uc3QgdXNlQ2xhc3NPblNlbGYgPSBtZXRhLnVzZUNsYXNzLmV4cHJlc3Npb24uaXNFcXVpdmFsZW50KG1ldGEuaW50ZXJuYWxUeXBlKTtcbiAgICBsZXQgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG1ldGEuZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkZXBzID0gbWV0YS5kZXBzO1xuICAgIH1cblxuICAgIGlmIChkZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhY3Rvcnk6ICgpID0+IG5ldyBtZXRhLnVzZUNsYXNzKC4uLmRlcHMpXG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICAgIGRlbGVnYXRlOiBtZXRhLnVzZUNsYXNzLmV4cHJlc3Npb24sXG4gICAgICAgIGRlbGVnYXRlRGVwczogZGVwcyxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3MsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHVzZUNsYXNzT25TZWxmKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKGZhY3RvcnlNZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0ge1xuICAgICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgICAgZXhwcmVzc2lvbjogZGVsZWdhdGVUb0ZhY3RvcnkoXG4gICAgICAgICAgICBtZXRhLnR5cGUudmFsdWUgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55PixcbiAgICAgICAgICAgIG1ldGEudXNlQ2xhc3MuZXhwcmVzc2lvbiBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCByZXNvbHZlRm9yd2FyZFJlZnMpXG4gICAgICB9O1xuICAgIH1cbiAgfSBlbHNlIGlmIChtZXRhLnVzZUZhY3RvcnkgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChtZXRhLmRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VGYWN0b3J5LFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IG1ldGEuZGVwcyB8fCBbXSxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRnVuY3Rpb24sXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0ge1xuICAgICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgICAgZXhwcmVzc2lvbjogby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChtZXRhLnVzZUZhY3RvcnkuY2FsbEZuKFtdKSldKVxuICAgICAgfTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS51c2VWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gTm90ZTogaXQncyBzYWZlIHRvIHVzZSBgbWV0YS51c2VWYWx1ZWAgaW5zdGVhZCBvZiB0aGUgYFVTRV9WQUxVRSBpbiBtZXRhYCBjaGVjayB1c2VkIGZvclxuICAgIC8vIGNsaWVudCBjb2RlIGJlY2F1c2UgbWV0YS51c2VWYWx1ZSBpcyBhbiBFeHByZXNzaW9uIHdoaWNoIHdpbGwgYmUgZGVmaW5lZCBldmVuIGlmIHRoZSBhY3R1YWxcbiAgICAvLyB2YWx1ZSBpcyB1bmRlZmluZWQuXG4gICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgIGV4cHJlc3Npb246IG1ldGEudXNlVmFsdWUuZXhwcmVzc2lvbixcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChtZXRhLnVzZUV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyB1c2VFeGlzdGluZyBpcyBhbiBgaW5qZWN0YCBjYWxsIG9uIHRoZSBleGlzdGluZyB0b2tlbi5cbiAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgZXhwcmVzc2lvbjogby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmluamVjdCkuY2FsbEZuKFttZXRhLnVzZUV4aXN0aW5nLmV4cHJlc3Npb25dKSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSB7XG4gICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgIGV4cHJlc3Npb246IGRlbGVnYXRlVG9GYWN0b3J5KFxuICAgICAgICAgIG1ldGEudHlwZS52YWx1ZSBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBtZXRhLmludGVybmFsVHlwZSBhcyBvLldyYXBwZWROb2RlRXhwcjxhbnk+LFxuICAgICAgICAgIHJlc29sdmVGb3J3YXJkUmVmcylcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgdG9rZW4gPSBtZXRhLmludGVybmFsVHlwZTtcblxuICBjb25zdCBpbmplY3RhYmxlUHJvcHMgPVxuICAgICAgbmV3IERlZmluaXRpb25NYXA8e3Rva2VuOiBvLkV4cHJlc3Npb24sIGZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgcHJvdmlkZWRJbjogby5FeHByZXNzaW9ufT4oKTtcbiAgaW5qZWN0YWJsZVByb3BzLnNldCgndG9rZW4nLCB0b2tlbik7XG4gIGluamVjdGFibGVQcm9wcy5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZXhwcmVzc2lvbik7XG5cbiAgLy8gT25seSBnZW5lcmF0ZSBwcm92aWRlZEluIHByb3BlcnR5IGlmIGl0IGhhcyBhIG5vbi1udWxsIHZhbHVlXG4gIGlmICgobWV0YS5wcm92aWRlZEluLmV4cHJlc3Npb24gYXMgby5MaXRlcmFsRXhwcikudmFsdWUgIT09IG51bGwpIHtcbiAgICBpbmplY3RhYmxlUHJvcHMuc2V0KFxuICAgICAgICAncHJvdmlkZWRJbicsXG4gICAgICAgIG1ldGEucHJvdmlkZWRJbi5pc0ZvcndhcmRSZWYgPyBnZW5lcmF0ZUZvcndhcmRSZWYobWV0YS5wcm92aWRlZEluLmV4cHJlc3Npb24pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGEucHJvdmlkZWRJbi5leHByZXNzaW9uKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuybXJtWRlZmluZUluamVjdGFibGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihbaW5qZWN0YWJsZVByb3BzLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgcmV0dXJuIHtcbiAgICBleHByZXNzaW9uLFxuICAgIHR5cGU6IGNyZWF0ZUluamVjdGFibGVUeXBlKG1ldGEpLFxuICAgIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW5qZWN0YWJsZVR5cGUobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpIHtcbiAgcmV0dXJuIG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihcbiAgICAgIElkZW50aWZpZXJzLkluamVjdGFibGVEZWNsYXJhdGlvbixcbiAgICAgIFt0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpXSkpO1xufVxuXG5mdW5jdGlvbiBkZWxlZ2F0ZVRvRmFjdG9yeShcbiAgICB0eXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBpbnRlcm5hbFR5cGU6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sXG4gICAgdW53cmFwRm9yd2FyZFJlZnM6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAodHlwZS5ub2RlID09PSBpbnRlcm5hbFR5cGUubm9kZSkge1xuICAgIC8vIFRoZSB0eXBlcyBhcmUgdGhlIHNhbWUsIHNvIHdlIGNhbiBzaW1wbHkgZGVsZWdhdGUgZGlyZWN0bHkgdG8gdGhlIHR5cGUncyBmYWN0b3J5LlxuICAgIC8vIGBgYFxuICAgIC8vIGZhY3Rvcnk6IHR5cGUuybVmYWNcbiAgICAvLyBgYGBcbiAgICByZXR1cm4gaW50ZXJuYWxUeXBlLnByb3AoJ8m1ZmFjJyk7XG4gIH1cblxuICBpZiAoIXVud3JhcEZvcndhcmRSZWZzKSB7XG4gICAgLy8gVGhlIHR5cGUgaXMgbm90IHdyYXBwZWQgaW4gYSBgZm9yd2FyZFJlZigpYCwgc28gd2UgY3JlYXRlIGEgc2ltcGxlIGZhY3RvcnkgZnVuY3Rpb24gdGhhdFxuICAgIC8vIGFjY2VwdHMgYSBzdWItdHlwZSBhcyBhbiBhcmd1bWVudC5cbiAgICAvLyBgYGBcbiAgICAvLyBmYWN0b3J5OiBmdW5jdGlvbih0KSB7IHJldHVybiBpbnRlcm5hbFR5cGUuybVmYWModCk7IH1cbiAgICAvLyBgYGBcbiAgICByZXR1cm4gY3JlYXRlRmFjdG9yeUZ1bmN0aW9uKGludGVybmFsVHlwZSk7XG4gIH1cblxuICAvLyBUaGUgaW50ZXJuYWxUeXBlIGlzIGFjdHVhbGx5IHdyYXBwZWQgaW4gYSBgZm9yd2FyZFJlZigpYCBzbyB3ZSBuZWVkIHRvIHJlc29sdmUgdGhhdCBiZWZvcmVcbiAgLy8gY2FsbGluZyBpdHMgZmFjdG9yeS5cbiAgLy8gYGBgXG4gIC8vIGZhY3Rvcnk6IGZ1bmN0aW9uKHQpIHsgcmV0dXJuIGNvcmUucmVzb2x2ZUZvcndhcmRSZWYodHlwZSkuybVmYWModCk7IH1cbiAgLy8gYGBgXG4gIGNvbnN0IHVud3JhcHBlZFR5cGUgPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVzb2x2ZUZvcndhcmRSZWYpLmNhbGxGbihbaW50ZXJuYWxUeXBlXSk7XG4gIHJldHVybiBjcmVhdGVGYWN0b3J5RnVuY3Rpb24odW53cmFwcGVkVHlwZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUZhY3RvcnlGdW5jdGlvbih0eXBlOiBvLkV4cHJlc3Npb24pOiBvLkZ1bmN0aW9uRXhwciB7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oJ3QnLCBvLkRZTkFNSUNfVFlQRSldLFxuICAgICAgW25ldyBvLlJldHVyblN0YXRlbWVudCh0eXBlLnByb3AoJ8m1ZmFjJykuY2FsbEZuKFtvLnZhcmlhYmxlKCd0JyldKSldKTtcbn1cbiJdfQ==