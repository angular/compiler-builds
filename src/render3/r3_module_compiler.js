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
        var definitionMap = {
            type: moduleType
        };
        // Only generate the keys in the metadata if the arrays have values.
        if (bootstrap.length) {
            definitionMap.bootstrap = o.literalArr(bootstrap.map(function (ref) { return ref.value; }));
        }
        if (declarations.length) {
            definitionMap.declarations = o.literalArr(declarations.map(function (ref) { return ref.value; }));
        }
        if (imports.length) {
            definitionMap.imports = o.literalArr(imports.map(function (ref) { return ref.value; }));
        }
        if (exports.length) {
            definitionMap.exports = o.literalArr(exports.map(function (ref) { return ref.value; }));
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineNgModule).callFn([util_1.mapToMapExpression(definitionMap)]);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.NgModuleDefWithMeta, [
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFpRjtJQUVqRixrRUFBOEM7SUFDOUMsMkRBQTBDO0lBRzFDLHVFQUEwRTtJQUMxRSwrRUFBbUQ7SUFDbkQsMkRBQTRFO0lBNkM1RTs7T0FFRztJQUNILFNBQWdCLGVBQWUsQ0FBQyxJQUF3QjtRQUMvQyxJQUFBLHNCQUFnQixFQUFFLDBCQUFTLEVBQUUsZ0NBQVksRUFBRSxzQkFBTyxFQUFFLHNCQUFPLENBQVM7UUFDM0UsSUFBTSxhQUFhLEdBQUc7WUFDcEIsSUFBSSxFQUFFLFVBQVU7U0FPakIsQ0FBQztRQUVGLG9FQUFvRTtRQUNwRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUU7WUFDcEIsYUFBYSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsS0FBSyxFQUFULENBQVMsQ0FBQyxDQUFDLENBQUM7U0FDekU7UUFFRCxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7WUFDdkIsYUFBYSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsS0FBSyxFQUFULENBQVMsQ0FBQyxDQUFDLENBQUM7U0FDL0U7UUFFRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7WUFDbEIsYUFBYSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsS0FB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R0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQXRCLENBQXNCLENBQUMsQ0FBQztRQUNyRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUM5RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7SW5qZWN0YWJsZUNvbXBpbGVyfSBmcm9tICcuLi9pbmplY3RhYmxlX2NvbXBpbGVyJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YSwgY29tcGlsZUZhY3RvcnlGdW5jdGlvbn0gZnJvbSAnLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM1JlZmVyZW5jZSwgY29udmVydE1ldGFUb091dHB1dCwgbWFwVG9NYXBFeHByZXNzaW9ufSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFIzTmdNb2R1bGVEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgYWRkaXRpb25hbFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG59XG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIG1vZHVsZSBjb21waWxlciB0byBnZW5lcmF0ZSBhIGBuZ01vZHVsZURlZmAgZm9yIGEgdHlwZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM05nTW9kdWxlTWV0YWRhdGEge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIG1vZHVsZSB0eXBlIGJlaW5nIGNvbXBpbGVkLlxuICAgKi9cbiAgdHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGJvb3RzdHJhcCBjb21wb25lbnRzIHNwZWNpZmllZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgYm9vdHN0cmFwOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIGRlY2xhcmVkIGJ5IHRoZSBtb2R1bGUuXG4gICAqL1xuICBkZWNsYXJhdGlvbnM6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgaW1wb3J0cyBvZiB0aGUgbW9kdWxlLlxuICAgKi9cbiAgaW1wb3J0czogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGUuXG4gICAqL1xuICBleHBvcnRzOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGVtaXQgdGhlIHNlbGVjdG9yIHNjb3BlIHZhbHVlcyAoZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBleHBvcnRzKSBpbmxpbmUgaW50byB0aGVcbiAgICogbW9kdWxlIGRlZmluaXRpb24sIG9yIHRvIGdlbmVyYXRlIGFkZGl0aW9uYWwgc3RhdGVtZW50cyB3aGljaCBwYXRjaCB0aGVtIG9uLiBJbmxpbmUgZW1pc3Npb25cbiAgICogZG9lcyBub3QgYWxsb3cgY29tcG9uZW50cyB0byBiZSB0cmVlLXNoYWtlbiwgYnV0IGlzIHVzZWZ1bCBmb3IgSklUIG1vZGUuXG4gICAqL1xuICBlbWl0SW5saW5lOiBib29sZWFuO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhbiBgUjNOZ01vZHVsZURlZmAgZm9yIHRoZSBnaXZlbiBgUjNOZ01vZHVsZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVOZ01vZHVsZShtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEpOiBSM05nTW9kdWxlRGVmIHtcbiAgY29uc3Qge3R5cGU6IG1vZHVsZVR5cGUsIGJvb3RzdHJhcCwgZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBleHBvcnRzfSA9IG1ldGE7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSB7XG4gICAgdHlwZTogbW9kdWxlVHlwZVxuICB9IGFze1xuICAgIHR5cGU6IG8uRXhwcmVzc2lvbixcbiAgICBib290c3RyYXA6IG8uTGl0ZXJhbEFycmF5RXhwcixcbiAgICBkZWNsYXJhdGlvbnM6IG8uTGl0ZXJhbEFycmF5RXhwcixcbiAgICBpbXBvcnRzOiBvLkxpdGVyYWxBcnJheUV4cHIsXG4gICAgZXhwb3J0czogby5MaXRlcmFsQXJyYXlFeHByXG4gIH07XG5cbiAgLy8gT25seSBnZW5lcmF0ZSB0aGUga2V5cyBpbiB0aGUgbWV0YWRhdGEgaWYgdGhlIGFycmF5cyBoYXZlIHZhbHVlcy5cbiAgaWYgKGJvb3RzdHJhcC5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLmJvb3RzdHJhcCA9IG8ubGl0ZXJhbEFycihib290c3RyYXAubWFwKHJlZiA9PiByZWYudmFsdWUpKTtcbiAgfVxuXG4gIGlmIChkZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5kZWNsYXJhdGlvbnMgPSBvLmxpdGVyYWxBcnIoZGVjbGFyYXRpb25zLm1hcChyZWYgPT4gcmVmLnZhbHVlKSk7XG4gIH1cblxuICBpZiAoaW1wb3J0cy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLmltcG9ydHMgPSBvLmxpdGVyYWxBcnIoaW1wb3J0cy5tYXAocmVmID0+IHJlZi52YWx1ZSkpO1xuICB9XG5cbiAgaWYgKGV4cG9ydHMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5leHBvcnRzID0gby5saXRlcmFsQXJyKGV4cG9ydHMubWFwKHJlZiA9PiByZWYudmFsdWUpKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lTmdNb2R1bGUpLmNhbGxGbihbbWFwVG9NYXBFeHByZXNzaW9uKGRlZmluaXRpb25NYXApXSk7XG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuTmdNb2R1bGVEZWZXaXRoTWV0YSwgW1xuICAgIG5ldyBvLkV4cHJlc3Npb25UeXBlKG1vZHVsZVR5cGUpLCB0dXBsZVR5cGVPZihkZWNsYXJhdGlvbnMpLCB0dXBsZVR5cGVPZihpbXBvcnRzKSxcbiAgICB0dXBsZVR5cGVPZihleHBvcnRzKVxuICBdKSk7XG5cbiAgY29uc3QgYWRkaXRpb25hbFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBhZGRpdGlvbmFsU3RhdGVtZW50c307XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RvckRlZiB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5UeXBlO1xuICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0b3JNZXRhZGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogby5FeHByZXNzaW9uO1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGw7XG4gIHByb3ZpZGVyczogby5FeHByZXNzaW9uO1xuICBpbXBvcnRzOiBvLkV4cHJlc3Npb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlSW5qZWN0b3IobWV0YTogUjNJbmplY3Rvck1ldGFkYXRhKTogUjNJbmplY3RvckRlZiB7XG4gIGNvbnN0IHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICB0eXBlOiBtZXRhLnR5cGUsXG4gICAgZGVwczogbWV0YS5kZXBzLFxuICAgIGluamVjdEZuOiBSMy5pbmplY3QsXG4gIH0pO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUluamVjdG9yKS5jYWxsRm4oW21hcFRvTWFwRXhwcmVzc2lvbih7XG4gICAgZmFjdG9yeTogcmVzdWx0LmZhY3RvcnksXG4gICAgcHJvdmlkZXJzOiBtZXRhLnByb3ZpZGVycyxcbiAgICBpbXBvcnRzOiBtZXRhLmltcG9ydHMsXG4gIH0pXSk7XG4gIGNvbnN0IHR5cGUgPVxuICAgICAgbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkluamVjdG9yRGVmLCBbbmV3IG8uRXhwcmVzc2lvblR5cGUobWV0YS50eXBlKV0pKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50c307XG59XG5cbi8vIFRPRE8oYWx4aHViKTogaW50ZWdyYXRlIHRoaXMgd2l0aCBgY29tcGlsZU5nTW9kdWxlYC4gQ3VycmVudGx5IHRoZSB0d28gYXJlIHNlcGFyYXRlIG9wZXJhdGlvbnMuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZU5nTW9kdWxlRnJvbVJlbmRlcjIoXG4gICAgY3R4OiBPdXRwdXRDb250ZXh0LCBuZ01vZHVsZTogQ29tcGlsZVNoYWxsb3dNb2R1bGVNZXRhZGF0YSxcbiAgICBpbmplY3RhYmxlQ29tcGlsZXI6IEluamVjdGFibGVDb21waWxlcik6IHZvaWQge1xuICBjb25zdCBjbGFzc05hbWUgPSBpZGVudGlmaWVyTmFtZShuZ01vZHVsZS50eXBlKSAhO1xuXG4gIGNvbnN0IHJhd0ltcG9ydHMgPSBuZ01vZHVsZS5yYXdJbXBvcnRzID8gW25nTW9kdWxlLnJhd0ltcG9ydHNdIDogW107XG4gIGNvbnN0IHJhd0V4cG9ydHMgPSBuZ01vZHVsZS5yYXdFeHBvcnRzID8gW25nTW9kdWxlLnJhd0V4cG9ydHNdIDogW107XG5cbiAgY29uc3QgaW5qZWN0b3JEZWZBcmcgPSBtYXBMaXRlcmFsKHtcbiAgICAnZmFjdG9yeSc6XG4gICAgICAgIGluamVjdGFibGVDb21waWxlci5mYWN0b3J5Rm9yKHt0eXBlOiBuZ01vZHVsZS50eXBlLCBzeW1ib2w6IG5nTW9kdWxlLnR5cGUucmVmZXJlbmNlfSwgY3R4KSxcbiAgICAncHJvdmlkZXJzJzogY29udmVydE1ldGFUb091dHB1dChuZ01vZHVsZS5yYXdQcm92aWRlcnMsIGN0eCksXG4gICAgJ2ltcG9ydHMnOiBjb252ZXJ0TWV0YVRvT3V0cHV0KFsuLi5yYXdJbXBvcnRzLCAuLi5yYXdFeHBvcnRzXSwgY3R4KSxcbiAgfSk7XG5cbiAgY29uc3QgaW5qZWN0b3JEZWYgPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lSW5qZWN0b3IpLmNhbGxGbihbaW5qZWN0b3JEZWZBcmddKTtcblxuICBjdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIC8qIG5hbWUgKi8gY2xhc3NOYW1lLFxuICAgICAgLyogcGFyZW50ICovIG51bGwsXG4gICAgICAvKiBmaWVsZHMgKi9bbmV3IG8uQ2xhc3NGaWVsZChcbiAgICAgICAgICAvKiBuYW1lICovICduZ0luamVjdG9yRGVmJyxcbiAgICAgICAgICAvKiB0eXBlICovIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi9bby5TdG10TW9kaWZpZXIuU3RhdGljXSxcbiAgICAgICAgICAvKiBpbml0aWFsaXplciAqLyBpbmplY3RvckRlZiwgKV0sXG4gICAgICAvKiBnZXR0ZXJzICovW10sXG4gICAgICAvKiBjb25zdHJ1Y3Rvck1ldGhvZCAqLyBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLFxuICAgICAgLyogbWV0aG9kcyAqL1tdKSk7XG59XG5cbmZ1bmN0aW9uIGFjY2Vzc0V4cG9ydFNjb3BlKG1vZHVsZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qgc2VsZWN0b3JTY29wZSA9IG5ldyBvLlJlYWRQcm9wRXhwcihtb2R1bGUsICduZ01vZHVsZURlZicpO1xuICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKHNlbGVjdG9yU2NvcGUsICdleHBvcnRlZCcpO1xufVxuXG5mdW5jdGlvbiB0dXBsZVR5cGVPZihleHA6IFIzUmVmZXJlbmNlW10pOiBvLlR5cGUge1xuICBjb25zdCB0eXBlcyA9IGV4cC5tYXAocmVmID0+IG8udHlwZW9mRXhwcihyZWYudHlwZSkpO1xuICByZXR1cm4gZXhwLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycih0eXBlcykpIDogby5OT05FX1RZUEU7XG59XG4iXX0=