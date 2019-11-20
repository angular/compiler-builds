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
        define("@angular/compiler/src/render3/r3_module_compiler", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/output/map_util", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var map_util_1 = require("@angular/compiler/src/output/map_util");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/util");
    /**
     * Construct an `R3NgModuleDef` for the given `R3NgModuleMetadata`.
     */
    function compileNgModule(meta) {
        var internalType = meta.internalType, moduleType = meta.type, bootstrap = meta.bootstrap, declarations = meta.declarations, imports = meta.imports, exports = meta.exports, schemas = meta.schemas, containsForwardDecls = meta.containsForwardDecls, emitInline = meta.emitInline, id = meta.id;
        var additionalStatements = [];
        var definitionMap = {
            type: internalType
        };
        // Only generate the keys in the metadata if the arrays have values.
        if (bootstrap.length) {
            definitionMap.bootstrap = refsToArray(bootstrap, containsForwardDecls);
        }
        // If requested to emit scope information inline, pass the declarations, imports and exports to
        // the `ɵɵdefineNgModule` call. The JIT compilation uses this.
        if (emitInline) {
            if (declarations.length) {
                definitionMap.declarations = refsToArray(declarations, containsForwardDecls);
            }
            if (imports.length) {
                definitionMap.imports = refsToArray(imports, containsForwardDecls);
            }
            if (exports.length) {
                definitionMap.exports = refsToArray(exports, containsForwardDecls);
            }
        }
        // If not emitting inline, the scope information is not passed into `ɵɵdefineNgModule` as it would
        // prevent tree-shaking of the declarations, imports and exports references.
        else {
            var setNgModuleScopeCall = generateSetNgModuleScopeCall(meta);
            if (setNgModuleScopeCall !== null) {
                additionalStatements.push(setNgModuleScopeCall);
            }
        }
        if (schemas && schemas.length) {
            definitionMap.schemas = o.literalArr(schemas.map(function (ref) { return ref.value; }));
        }
        if (id) {
            definitionMap.id = id;
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineNgModule).callFn([util_1.mapToMapExpression(definitionMap)]);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.NgModuleDefWithMeta, [
            new o.ExpressionType(moduleType), tupleTypeOf(declarations), tupleTypeOf(imports),
            tupleTypeOf(exports)
        ]));
        return { expression: expression, type: type, additionalStatements: additionalStatements };
    }
    exports.compileNgModule = compileNgModule;
    /**
     * Generates a function call to `ɵɵsetNgModuleScope` with all necessary information so that the
     * transitive module scope can be computed during runtime in JIT mode. This call is marked pure
     * such that the references to declarations, imports and exports may be elided causing these
     * symbols to become tree-shakeable.
     */
    function generateSetNgModuleScopeCall(meta) {
        var moduleType = meta.adjacentType, declarations = meta.declarations, imports = meta.imports, exports = meta.exports, containsForwardDecls = meta.containsForwardDecls;
        var scopeMap = {};
        if (declarations.length) {
            scopeMap.declarations = refsToArray(declarations, containsForwardDecls);
        }
        if (imports.length) {
            scopeMap.imports = refsToArray(imports, containsForwardDecls);
        }
        if (exports.length) {
            scopeMap.exports = refsToArray(exports, containsForwardDecls);
        }
        if (Object.keys(scopeMap).length === 0) {
            return null;
        }
        // setNgModuleScope(...)
        var fnCall = new o.InvokeFunctionExpr(
        /* fn */ o.importExpr(r3_identifiers_1.Identifiers.setNgModuleScope), 
        /* args */ [moduleType, util_1.mapToMapExpression(scopeMap)]);
        // (ngJitMode guard) && setNgModuleScope(...)
        var guardedCall = util_1.jitOnlyGuardedExpression(fnCall);
        // function() { (ngJitMode guard) && setNgModuleScope(...); }
        var iife = new o.FunctionExpr(
        /* params */ [], 
        /* statements */ [guardedCall.toStmt()]);
        // (function() { (ngJitMode guard) && setNgModuleScope(...); })()
        var iifeCall = new o.InvokeFunctionExpr(
        /* fn */ iife, 
        /* args */ []);
        return iifeCall.toStmt();
    }
    function compileInjector(meta) {
        var result = r3_factory_1.compileFactoryFunction({
            name: meta.name,
            type: meta.type,
            internalType: meta.internalType,
            typeArgumentCount: 0,
            deps: meta.deps,
            injectFn: r3_identifiers_1.Identifiers.inject,
            target: r3_factory_1.R3FactoryTarget.NgModule,
        });
        var definitionMap = {
            factory: result.factory,
        };
        if (meta.providers !== null) {
            definitionMap.providers = meta.providers;
        }
        if (meta.imports.length > 0) {
            definitionMap.imports = o.literalArr(meta.imports);
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineInjector).callFn([util_1.mapToMapExpression(definitionMap)]);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.InjectorDef, [new o.ExpressionType(meta.type)]));
        return { expression: expression, type: type, statements: result.statements };
    }
    exports.compileInjector = compileInjector;
    // TODO(alxhub): integrate this with `compileNgModule`. Currently the two are separate operations.
    function compileNgModuleFromRender2(ctx, ngModule, injectableCompiler) {
        var className = compile_metadata_1.identifierName(ngModule.type);
        var rawImports = ngModule.rawImports ? [ngModule.rawImports] : [];
        var rawExports = ngModule.rawExports ? [ngModule.rawExports] : [];
        var injectorDefArg = map_util_1.mapLiteral({
            'factory': injectableCompiler.factoryFor({ type: ngModule.type, symbol: ngModule.type.reference }, ctx),
            'providers': util_1.convertMetaToOutput(ngModule.rawProviders, ctx),
            'imports': util_1.convertMetaToOutput(tslib_1.__spread(rawImports, rawExports), ctx),
        });
        var injectorDef = o.importExpr(r3_identifiers_1.Identifiers.defineInjector).callFn([injectorDefArg]);
        ctx.statements.push(new o.ClassStmt(
        /* name */ className, 
        /* parent */ null, 
        /* fields */ [new o.ClassField(
            /* name */ 'ɵinj', 
            /* type */ o.INFERRED_TYPE, 
            /* modifiers */ [o.StmtModifier.Static], 
            /* initializer */ injectorDef)], 
        /* getters */ [], 
        /* constructorMethod */ new o.ClassMethod(null, [], []), 
        /* methods */ []));
    }
    exports.compileNgModuleFromRender2 = compileNgModuleFromRender2;
    function accessExportScope(module) {
        var selectorScope = new o.ReadPropExpr(module, 'ɵmod');
        return new o.ReadPropExpr(selectorScope, 'exported');
    }
    function tupleTypeOf(exp) {
        var types = exp.map(function (ref) { return o.typeofExpr(ref.type); });
        return exp.length > 0 ? o.expressionType(o.literalArr(types)) : o.NONE_TYPE;
    }
    function refsToArray(refs, shouldForwardDeclare) {
        var values = o.literalArr(refs.map(function (ref) { return ref.value; }));
        return shouldForwardDeclare ? o.fn([], [new o.ReturnStatement(values)]) : values;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFpRjtJQUVqRixrRUFBOEM7SUFDOUMsMkRBQTBDO0lBRzFDLHVFQUEyRjtJQUMzRiwrRUFBbUQ7SUFDbkQsMkRBQXNHO0lBNEV0Rzs7T0FFRztJQUNILFNBQWdCLGVBQWUsQ0FBQyxJQUF3QjtRQUVwRCxJQUFBLGdDQUFZLEVBQ1osc0JBQWdCLEVBQ2hCLDBCQUFTLEVBQ1QsZ0NBQVksRUFDWixzQkFBTyxFQUNQLHNCQUFPLEVBQ1Asc0JBQU8sRUFDUCxnREFBb0IsRUFDcEIsNEJBQVUsRUFDVixZQUFFLENBQ0s7UUFFVCxJQUFNLG9CQUFvQixHQUFrQixFQUFFLENBQUM7UUFDL0MsSUFBTSxhQUFhLEdBQUc7WUFDcEIsSUFBSSxFQUFFLFlBQVk7U0FTbkIsQ0FBQztRQUVGLG9FQUFvRTtRQUNwRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUU7WUFDcEIsYUFBYSxDQUFDLFNBQVMsR0FBRyxXQUFXLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7U0FDeEU7UUFFRCwrRkFBK0Y7UUFDL0YsOERBQThEO1FBQzlELElBQUksVUFBVSxFQUFFO1lBQ2QsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFO2dCQUN2QixhQUFhLENBQUMsWUFBWSxHQUFHLFdBQVcsQ0FBQyxZQUFZLEVBQUUsb0JBQW9CLENBQUMsQ0FBQzthQUM5RTtZQUVELElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDbEIsYUFBYSxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxFQUFFLG9CQUFvQixDQUFDLENBQUM7YUFDcEU7WUFFRCxJQUFJLE9BQU8sQ0FB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QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDOUUsQ0FBQztJQUVELFNBQVMsV0FBVyxDQUFDLElBQW1CLEVBQUUsb0JBQTZCO1FBQ3JFLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLEdBQUcsQ0FBQyxLQUFLLEVBQVQsQ0FBUyxDQUFDLENBQUMsQ0FBQztRQUN4RCxPQUFPLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNuRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7SW5qZWN0YWJsZUNvbXBpbGVyfSBmcm9tICcuLi9pbmplY3RhYmxlX2NvbXBpbGVyJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5VGFyZ2V0LCBjb21waWxlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzUmVmZXJlbmNlLCBjb252ZXJ0TWV0YVRvT3V0cHV0LCBqaXRPbmx5R3VhcmRlZEV4cHJlc3Npb24sIG1hcFRvTWFwRXhwcmVzc2lvbn0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBSM05nTW9kdWxlRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG4gIGFkZGl0aW9uYWxTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIHJlcXVpcmVkIGJ5IHRoZSBtb2R1bGUgY29tcGlsZXIgdG8gZ2VuZXJhdGUgYSBtb2R1bGUgZGVmIChgybVtb2RgKSBmb3IgYSB0eXBlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzTmdNb2R1bGVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgbW9kdWxlIHR5cGUgYmVpbmcgY29tcGlsZWQuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBtb2R1bGUgdHlwZSBiZWluZyBjb21waWxlZCwgaW50ZW5kZWQgZm9yIHVzZSB3aXRoaW4gYSBjbGFzc1xuICAgKiBkZWZpbml0aW9uIGl0c2VsZi5cbiAgICpcbiAgICogVGhpcyBjYW4gZGlmZmVyIGZyb20gdGhlIG91dGVyIGB0eXBlYCBpZiB0aGUgY2xhc3MgaXMgYmVpbmcgY29tcGlsZWQgYnkgbmdjYyBhbmQgaXMgaW5zaWRlXG4gICAqIGFuIElJRkUgc3RydWN0dXJlIHRoYXQgdXNlcyBhIGRpZmZlcmVudCBuYW1lIGludGVybmFsbHkuXG4gICAqL1xuICBpbnRlcm5hbFR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiBpbnRlbmRlZCBmb3IgdXNlIGJ5IHN0YXRlbWVudHMgdGhhdCBhcmUgYWRqYWNlbnQgKGkuZS4gdGlnaHRseSBjb3VwbGVkKSB0byBidXRcbiAgICogbm90IGludGVybmFsIHRvIGEgY2xhc3MgZGVmaW5pdGlvbi5cbiAgICpcbiAgICogVGhpcyBjYW4gZGlmZmVyIGZyb20gdGhlIG91dGVyIGB0eXBlYCBpZiB0aGUgY2xhc3MgaXMgYmVpbmcgY29tcGlsZWQgYnkgbmdjYyBhbmQgaXMgaW5zaWRlXG4gICAqIGFuIElJRkUgc3RydWN0dXJlIHRoYXQgdXNlcyBhIGRpZmZlcmVudCBuYW1lIGludGVybmFsbHkuXG4gICAqL1xuICBhZGphY2VudFR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBib290c3RyYXAgY29tcG9uZW50cyBzcGVjaWZpZWQgYnkgdGhlIG1vZHVsZS5cbiAgICovXG4gIGJvb3RzdHJhcDogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBkaXJlY3RpdmVzIGFuZCBwaXBlcyBkZWNsYXJlZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgZGVjbGFyYXRpb25zOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGltcG9ydHMgb2YgdGhlIG1vZHVsZS5cbiAgICovXG4gIGltcG9ydHM6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlLlxuICAgKi9cbiAgZXhwb3J0czogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBlbWl0IHRoZSBzZWxlY3RvciBzY29wZSB2YWx1ZXMgKGRlY2xhcmF0aW9ucywgaW1wb3J0cywgZXhwb3J0cykgaW5saW5lIGludG8gdGhlXG4gICAqIG1vZHVsZSBkZWZpbml0aW9uLCBvciB0byBnZW5lcmF0ZSBhZGRpdGlvbmFsIHN0YXRlbWVudHMgd2hpY2ggcGF0Y2ggdGhlbSBvbi4gSW5saW5lIGVtaXNzaW9uXG4gICAqIGRvZXMgbm90IGFsbG93IGNvbXBvbmVudHMgdG8gYmUgdHJlZS1zaGFrZW4sIGJ1dCBpcyB1c2VmdWwgZm9yIEpJVCBtb2RlLlxuICAgKi9cbiAgZW1pdElubGluZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0byBnZW5lcmF0ZSBjbG9zdXJlIHdyYXBwZXJzIGZvciBib290c3RyYXAsIGRlY2xhcmF0aW9ucywgaW1wb3J0cywgYW5kIGV4cG9ydHMuXG4gICAqL1xuICBjb250YWluc0ZvcndhcmREZWNsczogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIHNldCBvZiBzY2hlbWFzIHRoYXQgZGVjbGFyZSBlbGVtZW50cyB0byBiZSBhbGxvd2VkIGluIHRoZSBOZ01vZHVsZS5cbiAgICovXG4gIHNjaGVtYXM6IFIzUmVmZXJlbmNlW118bnVsbDtcblxuICAvKiogVW5pcXVlIElEIG9yIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSB1bmlxdWUgSUQgb2YgYW4gTmdNb2R1bGUuICovXG4gIGlkOiBvLkV4cHJlc3Npb258bnVsbDtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYW4gYFIzTmdNb2R1bGVEZWZgIGZvciB0aGUgZ2l2ZW4gYFIzTmdNb2R1bGVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlTmdNb2R1bGUobWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhKTogUjNOZ01vZHVsZURlZiB7XG4gIGNvbnN0IHtcbiAgICBpbnRlcm5hbFR5cGUsXG4gICAgdHlwZTogbW9kdWxlVHlwZSxcbiAgICBib290c3RyYXAsXG4gICAgZGVjbGFyYXRpb25zLFxuICAgIGltcG9ydHMsXG4gICAgZXhwb3J0cyxcbiAgICBzY2hlbWFzLFxuICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzLFxuICAgIGVtaXRJbmxpbmUsXG4gICAgaWRcbiAgfSA9IG1ldGE7XG5cbiAgY29uc3QgYWRkaXRpb25hbFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IHtcbiAgICB0eXBlOiBpbnRlcm5hbFR5cGVcbiAgfSBhc3tcbiAgICB0eXBlOiBvLkV4cHJlc3Npb24sXG4gICAgYm9vdHN0cmFwOiBvLkV4cHJlc3Npb24sXG4gICAgZGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb24sXG4gICAgaW1wb3J0czogby5FeHByZXNzaW9uLFxuICAgIGV4cG9ydHM6IG8uRXhwcmVzc2lvbixcbiAgICBzY2hlbWFzOiBvLkxpdGVyYWxBcnJheUV4cHIsXG4gICAgaWQ6IG8uRXhwcmVzc2lvblxuICB9O1xuXG4gIC8vIE9ubHkgZ2VuZXJhdGUgdGhlIGtleXMgaW4gdGhlIG1ldGFkYXRhIGlmIHRoZSBhcnJheXMgaGF2ZSB2YWx1ZXMuXG4gIGlmIChib290c3RyYXAubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5ib290c3RyYXAgPSByZWZzVG9BcnJheShib290c3RyYXAsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgfVxuXG4gIC8vIElmIHJlcXVlc3RlZCB0byBlbWl0IHNjb3BlIGluZm9ybWF0aW9uIGlubGluZSwgcGFzcyB0aGUgZGVjbGFyYXRpb25zLCBpbXBvcnRzIGFuZCBleHBvcnRzIHRvXG4gIC8vIHRoZSBgybXJtWRlZmluZU5nTW9kdWxlYCBjYWxsLiBUaGUgSklUIGNvbXBpbGF0aW9uIHVzZXMgdGhpcy5cbiAgaWYgKGVtaXRJbmxpbmUpIHtcbiAgICBpZiAoZGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5kZWNsYXJhdGlvbnMgPSByZWZzVG9BcnJheShkZWNsYXJhdGlvbnMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgICB9XG5cbiAgICBpZiAoaW1wb3J0cy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuaW1wb3J0cyA9IHJlZnNUb0FycmF5KGltcG9ydHMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgICB9XG5cbiAgICBpZiAoZXhwb3J0cy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuZXhwb3J0cyA9IHJlZnNUb0FycmF5KGV4cG9ydHMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBub3QgZW1pdHRpbmcgaW5saW5lLCB0aGUgc2NvcGUgaW5mb3JtYXRpb24gaXMgbm90IHBhc3NlZCBpbnRvIGDJtcm1ZGVmaW5lTmdNb2R1bGVgIGFzIGl0IHdvdWxkXG4gIC8vIHByZXZlbnQgdHJlZS1zaGFraW5nIG9mIHRoZSBkZWNsYXJhdGlvbnMsIGltcG9ydHMgYW5kIGV4cG9ydHMgcmVmZXJlbmNlcy5cbiAgZWxzZSB7XG4gICAgY29uc3Qgc2V0TmdNb2R1bGVTY29wZUNhbGwgPSBnZW5lcmF0ZVNldE5nTW9kdWxlU2NvcGVDYWxsKG1ldGEpO1xuICAgIGlmIChzZXROZ01vZHVsZVNjb3BlQ2FsbCAhPT0gbnVsbCkge1xuICAgICAgYWRkaXRpb25hbFN0YXRlbWVudHMucHVzaChzZXROZ01vZHVsZVNjb3BlQ2FsbCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHNjaGVtYXMgJiYgc2NoZW1hcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNjaGVtYXMgPSBvLmxpdGVyYWxBcnIoc2NoZW1hcy5tYXAocmVmID0+IHJlZi52YWx1ZSkpO1xuICB9XG5cbiAgaWYgKGlkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5pZCA9IGlkO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVOZ01vZHVsZSkuY2FsbEZuKFttYXBUb01hcEV4cHJlc3Npb24oZGVmaW5pdGlvbk1hcCldKTtcbiAgY29uc3QgdHlwZSA9IG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5OZ01vZHVsZURlZldpdGhNZXRhLCBbXG4gICAgbmV3IG8uRXhwcmVzc2lvblR5cGUobW9kdWxlVHlwZSksIHR1cGxlVHlwZU9mKGRlY2xhcmF0aW9ucyksIHR1cGxlVHlwZU9mKGltcG9ydHMpLFxuICAgIHR1cGxlVHlwZU9mKGV4cG9ydHMpXG4gIF0pKTtcblxuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgYWRkaXRpb25hbFN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIGZ1bmN0aW9uIGNhbGwgdG8gYMm1ybVzZXROZ01vZHVsZVNjb3BlYCB3aXRoIGFsbCBuZWNlc3NhcnkgaW5mb3JtYXRpb24gc28gdGhhdCB0aGVcbiAqIHRyYW5zaXRpdmUgbW9kdWxlIHNjb3BlIGNhbiBiZSBjb21wdXRlZCBkdXJpbmcgcnVudGltZSBpbiBKSVQgbW9kZS4gVGhpcyBjYWxsIGlzIG1hcmtlZCBwdXJlXG4gKiBzdWNoIHRoYXQgdGhlIHJlZmVyZW5jZXMgdG8gZGVjbGFyYXRpb25zLCBpbXBvcnRzIGFuZCBleHBvcnRzIG1heSBiZSBlbGlkZWQgY2F1c2luZyB0aGVzZVxuICogc3ltYm9scyB0byBiZWNvbWUgdHJlZS1zaGFrZWFibGUuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlU2V0TmdNb2R1bGVTY29wZUNhbGwobWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhKTogby5TdGF0ZW1lbnR8bnVsbCB7XG4gIGNvbnN0IHthZGphY2VudFR5cGU6IG1vZHVsZVR5cGUsIGRlY2xhcmF0aW9ucywgaW1wb3J0cywgZXhwb3J0cywgY29udGFpbnNGb3J3YXJkRGVjbHN9ID0gbWV0YTtcblxuICBjb25zdCBzY29wZU1hcCA9IHt9IGFze1xuICAgIGRlY2xhcmF0aW9uczogby5FeHByZXNzaW9uLFxuICAgIGltcG9ydHM6IG8uRXhwcmVzc2lvbixcbiAgICBleHBvcnRzOiBvLkV4cHJlc3Npb24sXG4gIH07XG5cbiAgaWYgKGRlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICBzY29wZU1hcC5kZWNsYXJhdGlvbnMgPSByZWZzVG9BcnJheShkZWNsYXJhdGlvbnMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgfVxuXG4gIGlmIChpbXBvcnRzLmxlbmd0aCkge1xuICAgIHNjb3BlTWFwLmltcG9ydHMgPSByZWZzVG9BcnJheShpbXBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gIH1cblxuICBpZiAoZXhwb3J0cy5sZW5ndGgpIHtcbiAgICBzY29wZU1hcC5leHBvcnRzID0gcmVmc1RvQXJyYXkoZXhwb3J0cywgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICB9XG5cbiAgaWYgKE9iamVjdC5rZXlzKHNjb3BlTWFwKS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIHNldE5nTW9kdWxlU2NvcGUoLi4uKVxuICBjb25zdCBmbkNhbGwgPSBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAvKiBmbiAqLyBvLmltcG9ydEV4cHIoUjMuc2V0TmdNb2R1bGVTY29wZSksXG4gICAgICAvKiBhcmdzICovW21vZHVsZVR5cGUsIG1hcFRvTWFwRXhwcmVzc2lvbihzY29wZU1hcCldKTtcblxuICAvLyAobmdKaXRNb2RlIGd1YXJkKSAmJiBzZXROZ01vZHVsZVNjb3BlKC4uLilcbiAgY29uc3QgZ3VhcmRlZENhbGwgPSBqaXRPbmx5R3VhcmRlZEV4cHJlc3Npb24oZm5DYWxsKTtcblxuICAvLyBmdW5jdGlvbigpIHsgKG5nSml0TW9kZSBndWFyZCkgJiYgc2V0TmdNb2R1bGVTY29wZSguLi4pOyB9XG4gIGNvbnN0IGlpZmUgPSBuZXcgby5GdW5jdGlvbkV4cHIoXG4gICAgICAvKiBwYXJhbXMgKi9bXSxcbiAgICAgIC8qIHN0YXRlbWVudHMgKi9bZ3VhcmRlZENhbGwudG9TdG10KCldKTtcblxuICAvLyAoZnVuY3Rpb24oKSB7IChuZ0ppdE1vZGUgZ3VhcmQpICYmIHNldE5nTW9kdWxlU2NvcGUoLi4uKTsgfSkoKVxuICBjb25zdCBpaWZlQ2FsbCA9IG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgIC8qIGZuICovIGlpZmUsXG4gICAgICAvKiBhcmdzICovW10pO1xuXG4gIHJldHVybiBpaWZlQ2FsbC50b1N0bXQoKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdG9yRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3Rvck1ldGFkYXRhIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGw7XG4gIHByb3ZpZGVyczogby5FeHByZXNzaW9ufG51bGw7XG4gIGltcG9ydHM6IG8uRXhwcmVzc2lvbltdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUluamVjdG9yKG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSk6IFIzSW5qZWN0b3JEZWYge1xuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGludGVybmFsVHlwZTogbWV0YS5pbnRlcm5hbFR5cGUsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgZGVwczogbWV0YS5kZXBzLFxuICAgIGluamVjdEZuOiBSMy5pbmplY3QsXG4gICAgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQuTmdNb2R1bGUsXG4gIH0pO1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0ge1xuICAgIGZhY3Rvcnk6IHJlc3VsdC5mYWN0b3J5LFxuICB9IGFze2ZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgcHJvdmlkZXJzOiBvLkV4cHJlc3Npb24sIGltcG9ydHM6IG8uRXhwcmVzc2lvbn07XG5cbiAgaWYgKG1ldGEucHJvdmlkZXJzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5wcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgfVxuXG4gIGlmIChtZXRhLmltcG9ydHMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuaW1wb3J0cyA9IG8ubGl0ZXJhbEFycihtZXRhLmltcG9ydHMpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVJbmplY3RvcikuY2FsbEZuKFttYXBUb01hcEV4cHJlc3Npb24oZGVmaW5pdGlvbk1hcCldKTtcbiAgY29uc3QgdHlwZSA9XG4gICAgICBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuSW5qZWN0b3JEZWYsIFtuZXcgby5FeHByZXNzaW9uVHlwZShtZXRhLnR5cGUpXSkpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzfTtcbn1cblxuLy8gVE9ETyhhbHhodWIpOiBpbnRlZ3JhdGUgdGhpcyB3aXRoIGBjb21waWxlTmdNb2R1bGVgLiBDdXJyZW50bHkgdGhlIHR3byBhcmUgc2VwYXJhdGUgb3BlcmF0aW9ucy5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlTmdNb2R1bGVGcm9tUmVuZGVyMihcbiAgICBjdHg6IE91dHB1dENvbnRleHQsIG5nTW9kdWxlOiBDb21waWxlU2hhbGxvd01vZHVsZU1ldGFkYXRhLFxuICAgIGluamVjdGFibGVDb21waWxlcjogSW5qZWN0YWJsZUNvbXBpbGVyKTogdm9pZCB7XG4gIGNvbnN0IGNsYXNzTmFtZSA9IGlkZW50aWZpZXJOYW1lKG5nTW9kdWxlLnR5cGUpICE7XG5cbiAgY29uc3QgcmF3SW1wb3J0cyA9IG5nTW9kdWxlLnJhd0ltcG9ydHMgPyBbbmdNb2R1bGUucmF3SW1wb3J0c10gOiBbXTtcbiAgY29uc3QgcmF3RXhwb3J0cyA9IG5nTW9kdWxlLnJhd0V4cG9ydHMgPyBbbmdNb2R1bGUucmF3RXhwb3J0c10gOiBbXTtcblxuICBjb25zdCBpbmplY3RvckRlZkFyZyA9IG1hcExpdGVyYWwoe1xuICAgICdmYWN0b3J5JzpcbiAgICAgICAgaW5qZWN0YWJsZUNvbXBpbGVyLmZhY3RvcnlGb3Ioe3R5cGU6IG5nTW9kdWxlLnR5cGUsIHN5bWJvbDogbmdNb2R1bGUudHlwZS5yZWZlcmVuY2V9LCBjdHgpLFxuICAgICdwcm92aWRlcnMnOiBjb252ZXJ0TWV0YVRvT3V0cHV0KG5nTW9kdWxlLnJhd1Byb3ZpZGVycywgY3R4KSxcbiAgICAnaW1wb3J0cyc6IGNvbnZlcnRNZXRhVG9PdXRwdXQoWy4uLnJhd0ltcG9ydHMsIC4uLnJhd0V4cG9ydHNdLCBjdHgpLFxuICB9KTtcblxuICBjb25zdCBpbmplY3RvckRlZiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVJbmplY3RvcikuY2FsbEZuKFtpbmplY3RvckRlZkFyZ10pO1xuXG4gIGN0eC5zdGF0ZW1lbnRzLnB1c2gobmV3IG8uQ2xhc3NTdG10KFxuICAgICAgLyogbmFtZSAqLyBjbGFzc05hbWUsXG4gICAgICAvKiBwYXJlbnQgKi8gbnVsbCxcbiAgICAgIC8qIGZpZWxkcyAqL1tuZXcgby5DbGFzc0ZpZWxkKFxuICAgICAgICAgIC8qIG5hbWUgKi8gJ8m1aW5qJyxcbiAgICAgICAgICAvKiB0eXBlICovIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi9bby5TdG10TW9kaWZpZXIuU3RhdGljXSxcbiAgICAgICAgICAvKiBpbml0aWFsaXplciAqLyBpbmplY3RvckRlZiwgKV0sXG4gICAgICAvKiBnZXR0ZXJzICovW10sXG4gICAgICAvKiBjb25zdHJ1Y3Rvck1ldGhvZCAqLyBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLFxuICAgICAgLyogbWV0aG9kcyAqL1tdKSk7XG59XG5cbmZ1bmN0aW9uIGFjY2Vzc0V4cG9ydFNjb3BlKG1vZHVsZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qgc2VsZWN0b3JTY29wZSA9IG5ldyBvLlJlYWRQcm9wRXhwcihtb2R1bGUsICfJtW1vZCcpO1xuICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKHNlbGVjdG9yU2NvcGUsICdleHBvcnRlZCcpO1xufVxuXG5mdW5jdGlvbiB0dXBsZVR5cGVPZihleHA6IFIzUmVmZXJlbmNlW10pOiBvLlR5cGUge1xuICBjb25zdCB0eXBlcyA9IGV4cC5tYXAocmVmID0+IG8udHlwZW9mRXhwcihyZWYudHlwZSkpO1xuICByZXR1cm4gZXhwLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycih0eXBlcykpIDogby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIHJlZnNUb0FycmF5KHJlZnM6IFIzUmVmZXJlbmNlW10sIHNob3VsZEZvcndhcmREZWNsYXJlOiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgdmFsdWVzID0gby5saXRlcmFsQXJyKHJlZnMubWFwKHJlZiA9PiByZWYudmFsdWUpKTtcbiAgcmV0dXJuIHNob3VsZEZvcndhcmREZWNsYXJlID8gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudCh2YWx1ZXMpXSkgOiB2YWx1ZXM7XG59XG4iXX0=