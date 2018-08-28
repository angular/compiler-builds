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
        var moduleType = meta.type, bootstrap = meta.bootstrap, declarations = meta.declarations, imports = meta.imports, exports = meta.exports;
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineNgModule).callFn([util_1.mapToMapExpression({
                type: moduleType,
                bootstrap: o.literalArr(bootstrap),
                declarations: o.literalArr(declarations.map(function (ref) { return ref.value; })),
                imports: o.literalArr(imports.map(function (ref) { return ref.value; })),
                exports: o.literalArr(exports.map(function (ref) { return ref.value; })),
            })]);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.NgModuleDef, [
            new o.ExpressionType(moduleType), tupleTypeOf(declarations), tupleTypeOf(imports),
            tupleTypeOf(exports)
        ]));
        var additionalStatements = [];
        return { expression: expression, type: type, additionalStatements: additionalStatements };
    }
    exports.compileNgModule = compileNgModule;
    function compileInjector(meta) {
        var result = r3_factory_1.compileFactoryFunction({
            name: meta.name,
            type: meta.type,
            deps: meta.deps,
            injectFn: r3_identifiers_1.Identifiers.inject,
        });
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineInjector).callFn([util_1.mapToMapExpression({
                factory: result.factory,
                providers: meta.providers,
                imports: meta.imports,
            })]);
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
            /* name */ 'ngInjectorDef', 
            /* type */ o.INFERRED_TYPE, 
            /* modifiers */ [o.StmtModifier.Static], 
            /* initializer */ injectorDef)], 
        /* getters */ [], 
        /* constructorMethod */ new o.ClassMethod(null, [], []), 
        /* methods */ []));
    }
    exports.compileNgModuleFromRender2 = compileNgModuleFromRender2;
    function accessExportScope(module) {
        var selectorScope = new o.ReadPropExpr(module, 'ngModuleDef');
        return new o.ReadPropExpr(selectorScope, 'exported');
    }
    function tupleTypeOf(exp) {
        var types = exp.map(function (ref) { return o.typeofExpr(ref.type); });
        return exp.length > 0 ? o.expressionType(o.literalArr(types)) : o.NONE_TYPE;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUFpRjtJQUVqRixrRUFBOEM7SUFDOUMsMkRBQTBDO0lBRzFDLHVFQUEwRTtJQUMxRSwrRUFBbUQ7SUFDbkQsMkRBQTRFO0lBNkM1RTs7T0FFRztJQUNILFNBQWdCLGVBQWUsQ0FBQyxJQUF3QjtRQUMvQyxJQUFBLHNCQUFnQixFQUFFLDBCQUFTLEVBQUUsZ0NBQVksRUFBRSxzQkFBTyxFQUFFLHNCQUFPLENBQVM7UUFDM0UsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLHlCQUFrQixDQUFDO2dCQUM1RSxJQUFJLEVBQUUsVUFBVTtnQkFDaEIsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO2dCQUNsQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLEtBQUssRUFBVCxDQUFTLENBQUMsQ0FBQztnQkFDOUQsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLEdBQUcsQ0FBQyxLQUFLLEVBQVQsQ0FBUyxDQUFDLENBQUM7Z0JBQ3BELE9BQU8sRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsS0FBSyxFQUFULENBQVMsQ0FBQyxDQUFDO2FBQ3JELENBQUMsQ0FBQyxDQUFD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R29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7SW5qZWN0YWJsZUNvbXBpbGVyfSBmcm9tICcuLi9pbmplY3RhYmxlX2NvbXBpbGVyJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YSwgY29tcGlsZUZhY3RvcnlGdW5jdGlvbn0gZnJvbSAnLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM1JlZmVyZW5jZSwgY29udmVydE1ldGFUb091dHB1dCwgbWFwVG9NYXBFeHByZXNzaW9ufSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFIzTmdNb2R1bGVEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgYWRkaXRpb25hbFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG59XG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIG1vZHVsZSBjb21waWxlciB0byBnZW5lcmF0ZSBhIGBuZ01vZHVsZURlZmAgZm9yIGEgdHlwZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM05nTW9kdWxlTWV0YWRhdGEge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIG1vZHVsZSB0eXBlIGJlaW5nIGNvbXBpbGVkLlxuICAgKi9cbiAgdHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGJvb3RzdHJhcCBjb21wb25lbnRzIHNwZWNpZmllZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgYm9vdHN0cmFwOiBvLkV4cHJlc3Npb25bXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBkaXJlY3RpdmVzIGFuZCBwaXBlcyBkZWNsYXJlZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgZGVjbGFyYXRpb25zOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGltcG9ydHMgb2YgdGhlIG1vZHVsZS5cbiAgICovXG4gIGltcG9ydHM6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlLlxuICAgKi9cbiAgZXhwb3J0czogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBlbWl0IHRoZSBzZWxlY3RvciBzY29wZSB2YWx1ZXMgKGRlY2xhcmF0aW9ucywgaW1wb3J0cywgZXhwb3J0cykgaW5saW5lIGludG8gdGhlXG4gICAqIG1vZHVsZSBkZWZpbml0aW9uLCBvciB0byBnZW5lcmF0ZSBhZGRpdGlvbmFsIHN0YXRlbWVudHMgd2hpY2ggcGF0Y2ggdGhlbSBvbi4gSW5saW5lIGVtaXNzaW9uXG4gICAqIGRvZXMgbm90IGFsbG93IGNvbXBvbmVudHMgdG8gYmUgdHJlZS1zaGFrZW4sIGJ1dCBpcyB1c2VmdWwgZm9yIEpJVCBtb2RlLlxuICAgKi9cbiAgZW1pdElubGluZTogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYW4gYFIzTmdNb2R1bGVEZWZgIGZvciB0aGUgZ2l2ZW4gYFIzTmdNb2R1bGVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlTmdNb2R1bGUobWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhKTogUjNOZ01vZHVsZURlZiB7XG4gIGNvbnN0IHt0eXBlOiBtb2R1bGVUeXBlLCBib290c3RyYXAsIGRlY2xhcmF0aW9ucywgaW1wb3J0cywgZXhwb3J0c30gPSBtZXRhO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZU5nTW9kdWxlKS5jYWxsRm4oW21hcFRvTWFwRXhwcmVzc2lvbih7XG4gICAgdHlwZTogbW9kdWxlVHlwZSxcbiAgICBib290c3RyYXA6IG8ubGl0ZXJhbEFycihib290c3RyYXApLFxuICAgIGRlY2xhcmF0aW9uczogby5saXRlcmFsQXJyKGRlY2xhcmF0aW9ucy5tYXAocmVmID0+IHJlZi52YWx1ZSkpLFxuICAgIGltcG9ydHM6IG8ubGl0ZXJhbEFycihpbXBvcnRzLm1hcChyZWYgPT4gcmVmLnZhbHVlKSksXG4gICAgZXhwb3J0czogby5saXRlcmFsQXJyKGV4cG9ydHMubWFwKHJlZiA9PiByZWYudmFsdWUpKSxcbiAgfSldKTtcblxuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLk5nTW9kdWxlRGVmLCBbXG4gICAgbmV3IG8uRXhwcmVzc2lvblR5cGUobW9kdWxlVHlwZSksIHR1cGxlVHlwZU9mKGRlY2xhcmF0aW9ucyksIHR1cGxlVHlwZU9mKGltcG9ydHMpLFxuICAgIHR1cGxlVHlwZU9mKGV4cG9ydHMpXG4gIF0pKTtcblxuICBjb25zdCBhZGRpdGlvbmFsU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIGFkZGl0aW9uYWxTdGF0ZW1lbnRzfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdG9yRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3Rvck1ldGFkYXRhIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118bnVsbDtcbiAgcHJvdmlkZXJzOiBvLkV4cHJlc3Npb247XG4gIGltcG9ydHM6IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RvcihtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOiBSM0luamVjdG9yRGVmIHtcbiAgY29uc3QgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICBkZXBzOiBtZXRhLmRlcHMsXG4gICAgaW5qZWN0Rm46IFIzLmluamVjdCxcbiAgfSk7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lSW5qZWN0b3IpLmNhbGxGbihbbWFwVG9NYXBFeHByZXNzaW9uKHtcbiAgICBmYWN0b3J5OiByZXN1bHQuZmFjdG9yeSxcbiAgICBwcm92aWRlcnM6IG1ldGEucHJvdmlkZXJzLFxuICAgIGltcG9ydHM6IG1ldGEuaW1wb3J0cyxcbiAgfSldKTtcbiAgY29uc3QgdHlwZSA9XG4gICAgICBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuSW5qZWN0b3JEZWYsIFtuZXcgby5FeHByZXNzaW9uVHlwZShtZXRhLnR5cGUpXSkpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzfTtcbn1cblxuLy8gVE9ETyhhbHhodWIpOiBpbnRlZ3JhdGUgdGhpcyB3aXRoIGBjb21waWxlTmdNb2R1bGVgLiBDdXJyZW50bHkgdGhlIHR3byBhcmUgc2VwYXJhdGUgb3BlcmF0aW9ucy5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlTmdNb2R1bGVGcm9tUmVuZGVyMihcbiAgICBjdHg6IE91dHB1dENvbnRleHQsIG5nTW9kdWxlOiBDb21waWxlU2hhbGxvd01vZHVsZU1ldGFkYXRhLFxuICAgIGluamVjdGFibGVDb21waWxlcjogSW5qZWN0YWJsZUNvbXBpbGVyKTogdm9pZCB7XG4gIGNvbnN0IGNsYXNzTmFtZSA9IGlkZW50aWZpZXJOYW1lKG5nTW9kdWxlLnR5cGUpICE7XG5cbiAgY29uc3QgcmF3SW1wb3J0cyA9IG5nTW9kdWxlLnJhd0ltcG9ydHMgPyBbbmdNb2R1bGUucmF3SW1wb3J0c10gOiBbXTtcbiAgY29uc3QgcmF3RXhwb3J0cyA9IG5nTW9kdWxlLnJhd0V4cG9ydHMgPyBbbmdNb2R1bGUucmF3RXhwb3J0c10gOiBbXTtcblxuICBjb25zdCBpbmplY3RvckRlZkFyZyA9IG1hcExpdGVyYWwoe1xuICAgICdmYWN0b3J5JzpcbiAgICAgICAgaW5qZWN0YWJsZUNvbXBpbGVyLmZhY3RvcnlGb3Ioe3R5cGU6IG5nTW9kdWxlLnR5cGUsIHN5bWJvbDogbmdNb2R1bGUudHlwZS5yZWZlcmVuY2V9LCBjdHgpLFxuICAgICdwcm92aWRlcnMnOiBjb252ZXJ0TWV0YVRvT3V0cHV0KG5nTW9kdWxlLnJhd1Byb3ZpZGVycywgY3R4KSxcbiAgICAnaW1wb3J0cyc6IGNvbnZlcnRNZXRhVG9PdXRwdXQoWy4uLnJhd0ltcG9ydHMsIC4uLnJhd0V4cG9ydHNdLCBjdHgpLFxuICB9KTtcblxuICBjb25zdCBpbmplY3RvckRlZiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVJbmplY3RvcikuY2FsbEZuKFtpbmplY3RvckRlZkFyZ10pO1xuXG4gIGN0eC5zdGF0ZW1lbnRzLnB1c2gobmV3IG8uQ2xhc3NTdG10KFxuICAgICAgLyogbmFtZSAqLyBjbGFzc05hbWUsXG4gICAgICAvKiBwYXJlbnQgKi8gbnVsbCxcbiAgICAgIC8qIGZpZWxkcyAqL1tuZXcgby5DbGFzc0ZpZWxkKFxuICAgICAgICAgIC8qIG5hbWUgKi8gJ25nSW5qZWN0b3JEZWYnLFxuICAgICAgICAgIC8qIHR5cGUgKi8gby5JTkZFUlJFRF9UWVBFLFxuICAgICAgICAgIC8qIG1vZGlmaWVycyAqL1tvLlN0bXRNb2RpZmllci5TdGF0aWNdLFxuICAgICAgICAgIC8qIGluaXRpYWxpemVyICovIGluamVjdG9yRGVmLCApXSxcbiAgICAgIC8qIGdldHRlcnMgKi9bXSxcbiAgICAgIC8qIGNvbnN0cnVjdG9yTWV0aG9kICovIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksXG4gICAgICAvKiBtZXRob2RzICovW10pKTtcbn1cblxuZnVuY3Rpb24gYWNjZXNzRXhwb3J0U2NvcGUobW9kdWxlOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBzZWxlY3RvclNjb3BlID0gbmV3IG8uUmVhZFByb3BFeHByKG1vZHVsZSwgJ25nTW9kdWxlRGVmJyk7XG4gIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIoc2VsZWN0b3JTY29wZSwgJ2V4cG9ydGVkJyk7XG59XG5cbmZ1bmN0aW9uIHR1cGxlVHlwZU9mKGV4cDogUjNSZWZlcmVuY2VbXSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVzID0gZXhwLm1hcChyZWYgPT4gby50eXBlb2ZFeHByKHJlZi50eXBlKSk7XG4gIHJldHVybiBleHAubGVuZ3RoID4gMCA/IG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKHR5cGVzKSkgOiBvLk5PTkVfVFlQRTtcbn0iXX0=