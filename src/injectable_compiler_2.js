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
            target: r3_factory_1.FactoryTarget.Injectable,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsaUVBQTBDO0lBQzFDLDJEQUF5QztJQUN6Qyx1RUFBMkk7SUFDM0ksMkRBQStEO0lBQy9ELGdFQUFrRDtJQXFCbEQsU0FBZ0IsaUJBQWlCLENBQUMsSUFBMEI7UUFDMUQsSUFBSSxNQUFNLEdBQStELElBQUksQ0FBQztRQUU5RSxJQUFNLFdBQVcsR0FBc0I7WUFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO1lBQy9CLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7WUFDekMsSUFBSSxFQUFFLEVBQUU7WUFDUixNQUFNLEVBQUUsMEJBQWEsQ0FBQyxVQUFVO1NBQ2pDLENBQUM7UUFFRixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQy9CLDhGQUE4RjtZQUM5RiwwRkFBMEY7WUFDMUYsc0RBQXNEO1lBQ3RELEVBQUU7WUFDRiwyRkFBMkY7WUFDM0YsdUVBQXVFO1lBRXZFLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNyRSxJQUFJLElBQUksR0FBcUMsU0FBUyxDQUFDO1lBQ3ZELElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7Z0JBQy9CLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO2FBQ3RCO1lBRUQsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO2dCQUN0Qiw0Q0FBNEM7Z0JBQzVDLE1BQU0sR0FBRyxt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QUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFOUYsT0FBTztZQUNMLFVBQVUsWUFBQTtZQUNWLElBQUksTUFBQTtZQUNKLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVTtTQUM5QixDQUFDO0lBQ0osQ0FBQztJQS9GRCw4Q0ErRkM7SUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQTRCLEVBQUUsWUFBb0M7UUFDM0YsT0FBTztZQUNMLFVBQVUsRUFBRSxFQUFFO1lBQ2QsOERBQThEO1lBQzlELDJFQUEyRTtZQUMzRSx3RkFBd0Y7WUFDeEYsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN6QyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQzFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNqRixDQUFDO0lBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIEZhY3RvcnlUYXJnZXQsIFIzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUsIFIzRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5pbXBvcnQge1IzUmVmZXJlbmNlLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5qZWN0YWJsZURlZiB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5UeXBlO1xuICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0YWJsZU1ldGFkYXRhIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBSM1JlZmVyZW5jZTtcbiAgaW50ZXJuYWxUeXBlOiBvLkV4cHJlc3Npb247XG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG4gIHByb3ZpZGVkSW46IG8uRXhwcmVzc2lvbjtcbiAgdXNlQ2xhc3M/OiBvLkV4cHJlc3Npb247XG4gIHVzZUZhY3Rvcnk/OiBvLkV4cHJlc3Npb247XG4gIHVzZUV4aXN0aW5nPzogby5FeHByZXNzaW9uO1xuICB1c2VWYWx1ZT86IG8uRXhwcmVzc2lvbjtcbiAgdXNlckRlcHM/OiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUluamVjdGFibGUobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpOiBJbmplY3RhYmxlRGVmIHtcbiAgbGV0IHJlc3VsdDoge2V4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXX18bnVsbCA9IG51bGw7XG5cbiAgY29uc3QgZmFjdG9yeU1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhID0ge1xuICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICB0eXBlOiBtZXRhLnR5cGUsXG4gICAgaW50ZXJuYWxUeXBlOiBtZXRhLmludGVybmFsVHlwZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogbWV0YS50eXBlQXJndW1lbnRDb3VudCxcbiAgICBkZXBzOiBbXSxcbiAgICB0YXJnZXQ6IEZhY3RvcnlUYXJnZXQuSW5qZWN0YWJsZSxcbiAgfTtcblxuICBpZiAobWV0YS51c2VDbGFzcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gbWV0YS51c2VDbGFzcyBoYXMgdHdvIG1vZGVzIG9mIG9wZXJhdGlvbi4gRWl0aGVyIGRlcHMgYXJlIHNwZWNpZmllZCwgaW4gd2hpY2ggY2FzZSBgbmV3YCBpc1xuICAgIC8vIHVzZWQgdG8gaW5zdGFudGlhdGUgdGhlIGNsYXNzIHdpdGggZGVwZW5kZW5jaWVzIGluamVjdGVkLCBvciBkZXBzIGFyZSBub3Qgc3BlY2lmaWVkIGFuZFxuICAgIC8vIHRoZSBmYWN0b3J5IG9mIHRoZSBjbGFzcyBpcyB1c2VkIHRvIGluc3RhbnRpYXRlIGl0LlxuICAgIC8vXG4gICAgLy8gQSBzcGVjaWFsIGNhc2UgZXhpc3RzIGZvciB1c2VDbGFzczogVHlwZSB3aGVyZSBUeXBlIGlzIHRoZSBpbmplY3RhYmxlIHR5cGUgaXRzZWxmIGFuZCBub1xuICAgIC8vIGRlcHMgYXJlIHNwZWNpZmllZCwgaW4gd2hpY2ggY2FzZSAndXNlQ2xhc3MnIGlzIGVmZmVjdGl2ZWx5IGlnbm9yZWQuXG5cbiAgICBjb25zdCB1c2VDbGFzc09uU2VsZiA9IG1ldGEudXNlQ2xhc3MuaXNFcXVpdmFsZW50KG1ldGEuaW50ZXJuYWxUeXBlKTtcbiAgICBsZXQgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG1ldGEudXNlckRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGVwcyA9IG1ldGEudXNlckRlcHM7XG4gICAgfVxuXG4gICAgaWYgKGRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFjdG9yeTogKCkgPT4gbmV3IG1ldGEudXNlQ2xhc3MoLi4uZGVwcylcbiAgICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgICAuLi5mYWN0b3J5TWV0YSxcbiAgICAgICAgZGVsZWdhdGU6IG1ldGEudXNlQ2xhc3MsXG4gICAgICAgIGRlbGVnYXRlRGVwczogZGVwcyxcbiAgICAgICAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3MsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHVzZUNsYXNzT25TZWxmKSB7XG4gICAgICByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKGZhY3RvcnlNZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gZGVsZWdhdGVUb0ZhY3RvcnkoXG4gICAgICAgICAgbWV0YS50eXBlLnZhbHVlIGFzIG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIG1ldGEudXNlQ2xhc3MgYXMgby5XcmFwcGVkTm9kZUV4cHI8YW55Pik7XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlRmFjdG9yeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKG1ldGEudXNlckRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIC4uLmZhY3RvcnlNZXRhLFxuICAgICAgICBkZWxlZ2F0ZTogbWV0YS51c2VGYWN0b3J5LFxuICAgICAgICBkZWxlZ2F0ZURlcHM6IG1ldGEudXNlckRlcHMgfHwgW10sXG4gICAgICAgIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIGV4cHJlc3Npb246IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQobWV0YS51c2VGYWN0b3J5LmNhbGxGbihbXSkpXSlcbiAgICAgIH07XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE5vdGU6IGl0J3Mgc2FmZSB0byB1c2UgYG1ldGEudXNlVmFsdWVgIGluc3RlYWQgb2YgdGhlIGBVU0VfVkFMVUUgaW4gbWV0YWAgY2hlY2sgdXNlZCBmb3JcbiAgICAvLyBjbGllbnQgY29kZSBiZWNhdXNlIG1ldGEudXNlVmFsdWUgaXMgYW4gRXhwcmVzc2lvbiB3aGljaCB3aWxsIGJlIGRlZmluZWQgZXZlbiBpZiB0aGUgYWN0dWFsXG4gICAgLy8gdmFsdWUgaXMgdW5kZWZpbmVkLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBtZXRhLnVzZVZhbHVlLFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKG1ldGEudXNlRXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIHVzZUV4aXN0aW5nIGlzIGFuIGBpbmplY3RgIGNhbGwgb24gdGhlIGV4aXN0aW5nIHRva2VuLlxuICAgIHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgLi4uZmFjdG9yeU1ldGEsXG4gICAgICBleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW5qZWN0KS5jYWxsRm4oW21ldGEudXNlRXhpc3RpbmddKSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSBkZWxlZ2F0ZVRvRmFjdG9yeShcbiAgICAgICAgbWV0YS50eXBlLnZhbHVlIGFzIG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIG1ldGEuaW50ZXJuYWxUeXBlIGFzIG8uV3JhcHBlZE5vZGVFeHByPGFueT4pO1xuICB9XG5cbiAgY29uc3QgdG9rZW4gPSBtZXRhLmludGVybmFsVHlwZTtcblxuICBjb25zdCBpbmplY3RhYmxlUHJvcHMgPVxuICAgICAgbmV3IERlZmluaXRpb25NYXA8e3Rva2VuOiBvLkV4cHJlc3Npb24sIGZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgcHJvdmlkZWRJbjogby5FeHByZXNzaW9ufT4oKTtcbiAgaW5qZWN0YWJsZVByb3BzLnNldCgndG9rZW4nLCB0b2tlbik7XG4gIGluamVjdGFibGVQcm9wcy5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZXhwcmVzc2lvbik7XG5cbiAgLy8gT25seSBnZW5lcmF0ZSBwcm92aWRlZEluIHByb3BlcnR5IGlmIGl0IGhhcyBhIG5vbi1udWxsIHZhbHVlXG4gIGlmICgobWV0YS5wcm92aWRlZEluIGFzIG8uTGl0ZXJhbEV4cHIpLnZhbHVlICE9PSBudWxsKSB7XG4gICAgaW5qZWN0YWJsZVByb3BzLnNldCgncHJvdmlkZWRJbicsIG1ldGEucHJvdmlkZWRJbik7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLsm1ybVkZWZpbmVJbmplY3RhYmxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oW2luamVjdGFibGVQcm9wcy50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoXG4gICAgICBJZGVudGlmaWVycy5JbmplY3RhYmxlRGVmLCBbdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KV0pKTtcblxuICByZXR1cm4ge1xuICAgIGV4cHJlc3Npb24sXG4gICAgdHlwZSxcbiAgICBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50cyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZGVsZWdhdGVUb0ZhY3RvcnkodHlwZTogby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgaW50ZXJuYWxUeXBlOiBvLldyYXBwZWROb2RlRXhwcjxhbnk+KSB7XG4gIHJldHVybiB7XG4gICAgc3RhdGVtZW50czogW10sXG4gICAgLy8gSWYgdHlwZXMgYXJlIHRoZSBzYW1lLCB3ZSBjYW4gZ2VuZXJhdGUgYGZhY3Rvcnk6IHR5cGUuybVmYWNgXG4gICAgLy8gSWYgdHlwZXMgYXJlIGRpZmZlcmVudCwgd2UgaGF2ZSB0byBnZW5lcmF0ZSBhIHdyYXBwZXIgZnVuY3Rpb24gdG8gZW5zdXJlXG4gICAgLy8gdGhlIGludGVybmFsIHR5cGUgaGFzIGJlZW4gcmVzb2x2ZWQgKGBmYWN0b3J5OiBmdW5jdGlvbih0KSB7IHJldHVybiB0eXBlLsm1ZmFjKHQpOyB9YClcbiAgICBleHByZXNzaW9uOiB0eXBlLm5vZGUgPT09IGludGVybmFsVHlwZS5ub2RlID9cbiAgICAgICAgaW50ZXJuYWxUeXBlLnByb3AoJ8m1ZmFjJykgOlxuICAgICAgICBvLmZuKFtuZXcgby5GblBhcmFtKCd0Jywgby5EWU5BTUlDX1RZUEUpXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChpbnRlcm5hbFR5cGUuY2FsbE1ldGhvZChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnybVmYWMnLCBbby52YXJpYWJsZSgndCcpXSkpXSlcbiAgfTtcbn1cbiJdfQ==