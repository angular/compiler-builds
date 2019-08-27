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
        var moduleType = meta.type, bootstrap = meta.bootstrap, declarations = meta.declarations, imports = meta.imports, exports = meta.exports, schemas = meta.schemas, containsForwardDecls = meta.containsForwardDecls, emitInline = meta.emitInline, id = meta.id;
        var additionalStatements = [];
        var definitionMap = {
            type: moduleType
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
        var moduleType = meta.type, declarations = meta.declarations, imports = meta.imports, exports = meta.exports, containsForwardDecls = meta.containsForwardDecls;
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
        var fnCall = new o.InvokeFunctionExpr(
        /* fn */ o.importExpr(r3_identifiers_1.Identifiers.setNgModuleScope), 
        /* args */ [moduleType, util_1.mapToMapExpression(scopeMap)], 
        /* type */ undefined, 
        /* sourceSpan */ undefined, 
        /* pure */ true);
        return fnCall.toStmt();
    }
    function compileInjector(meta) {
        var result = r3_factory_1.compileFactoryFunction({
            name: meta.name,
            type: meta.type,
            typeArgumentCount: 0,
            deps: meta.deps,
            injectFn: r3_identifiers_1.Identifiers.inject,
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
    function refsToArray(refs, shouldForwardDeclare) {
        var values = o.literalArr(refs.map(function (ref) { return ref.value; }));
        return shouldForwardDeclare ? o.fn([], [new o.ReturnStatement(values)]) : values;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFpRjtJQUVqRixrRUFBOEM7SUFDOUMsMkRBQTBDO0lBRzFDLHVFQUEwRTtJQUMxRSwrRUFBbUQ7SUFDbkQsMkRBQTRFO0lBMEQ1RTs7T0FFRztJQUNILFNBQWdCLGVBQWUsQ0FBQyxJQUF3QjtRQUVwRCxJQUFBLHNCQUFnQixFQUNoQiwwQkFBUyxFQUNULGdDQUFZLEVBQ1osc0JBQU8sRUFDUCxzQkFBTyxFQUNQLHNCQUFPLEVBQ1AsZ0RBQW9CLEVBQ3BCLDRCQUFVLEVBQ1YsWUFBRSxDQUNLO1FBRVQsSUFBTSxvQkFBb0IsR0FBa0IsRUFBRSxDQUFDO1FBQy9DLElBQU0sYUFBYSxHQUFHO1lBQ3BCLElBQUksRUFBRSxVQUFVO1NBU2pCLENBQUM7UUFFRixvRUFBb0U7UUFDcEUsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFO1lBQ3BCLGFBQWEsQ0FBQyxTQUFTLEdBQUcsV0FBVyxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1NBQ3hFO1FBRUQsK0ZBQStGO1FBQy9GLDhEQUE4RDtRQUM5RCxJQUFJLFVBQVUsRUFBRTtZQUNkLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRTtnQkFDdkIsYUFBYSxDQUFDLFlBQVksR0FBRyxXQUFXLENBQUMsWUFBWSxFQUFFLG9CQUFvQixDQUFDLENBQUM7YUFDOUU7WUFFRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7Z0JBQ2xCLGFBQWEsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO2FBQ3BFO1lBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFF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QUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0lBQ25GLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZVNoYWxsb3dNb2R1bGVNZXRhZGF0YSwgaWRlbnRpZmllck5hbWV9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtJbmplY3RhYmxlQ29tcGlsZXJ9IGZyb20gJy4uL2luamVjdGFibGVfY29tcGlsZXInO1xuaW1wb3J0IHttYXBMaXRlcmFsfSBmcm9tICcuLi9vdXRwdXQvbWFwX3V0aWwnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhLCBjb21waWxlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzUmVmZXJlbmNlLCBjb252ZXJ0TWV0YVRvT3V0cHV0LCBtYXBUb01hcEV4cHJlc3Npb259IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNOZ01vZHVsZURlZiB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5UeXBlO1xuICBhZGRpdGlvbmFsU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSByZXF1aXJlZCBieSB0aGUgbW9kdWxlIGNvbXBpbGVyIHRvIGdlbmVyYXRlIGEgYG5nTW9kdWxlRGVmYCBmb3IgYSB0eXBlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzTmdNb2R1bGVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgbW9kdWxlIHR5cGUgYmVpbmcgY29tcGlsZWQuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgYm9vdHN0cmFwIGNvbXBvbmVudHMgc3BlY2lmaWVkIGJ5IHRoZSBtb2R1bGUuXG4gICAqL1xuICBib290c3RyYXA6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgZGlyZWN0aXZlcyBhbmQgcGlwZXMgZGVjbGFyZWQgYnkgdGhlIG1vZHVsZS5cbiAgICovXG4gIGRlY2xhcmF0aW9uczogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBpbXBvcnRzIG9mIHRoZSBtb2R1bGUuXG4gICAqL1xuICBpbXBvcnRzOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZS5cbiAgICovXG4gIGV4cG9ydHM6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZW1pdCB0aGUgc2VsZWN0b3Igc2NvcGUgdmFsdWVzIChkZWNsYXJhdGlvbnMsIGltcG9ydHMsIGV4cG9ydHMpIGlubGluZSBpbnRvIHRoZVxuICAgKiBtb2R1bGUgZGVmaW5pdGlvbiwgb3IgdG8gZ2VuZXJhdGUgYWRkaXRpb25hbCBzdGF0ZW1lbnRzIHdoaWNoIHBhdGNoIHRoZW0gb24uIElubGluZSBlbWlzc2lvblxuICAgKiBkb2VzIG5vdCBhbGxvdyBjb21wb25lbnRzIHRvIGJlIHRyZWUtc2hha2VuLCBidXQgaXMgdXNlZnVsIGZvciBKSVQgbW9kZS5cbiAgICovXG4gIGVtaXRJbmxpbmU6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZ2VuZXJhdGUgY2xvc3VyZSB3cmFwcGVycyBmb3IgYm9vdHN0cmFwLCBkZWNsYXJhdGlvbnMsIGltcG9ydHMsIGFuZCBleHBvcnRzLlxuICAgKi9cbiAgY29udGFpbnNGb3J3YXJkRGVjbHM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBzZXQgb2Ygc2NoZW1hcyB0aGF0IGRlY2xhcmUgZWxlbWVudHMgdG8gYmUgYWxsb3dlZCBpbiB0aGUgTmdNb2R1bGUuXG4gICAqL1xuICBzY2hlbWFzOiBSM1JlZmVyZW5jZVtdfG51bGw7XG5cbiAgLyoqIFVuaXF1ZSBJRCBvciBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgdW5pcXVlIElEIG9mIGFuIE5nTW9kdWxlLiAqL1xuICBpZDogby5FeHByZXNzaW9ufG51bGw7XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGFuIGBSM05nTW9kdWxlRGVmYCBmb3IgdGhlIGdpdmVuIGBSM05nTW9kdWxlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZU5nTW9kdWxlKG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSk6IFIzTmdNb2R1bGVEZWYge1xuICBjb25zdCB7XG4gICAgdHlwZTogbW9kdWxlVHlwZSxcbiAgICBib290c3RyYXAsXG4gICAgZGVjbGFyYXRpb25zLFxuICAgIGltcG9ydHMsXG4gICAgZXhwb3J0cyxcbiAgICBzY2hlbWFzLFxuICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzLFxuICAgIGVtaXRJbmxpbmUsXG4gICAgaWRcbiAgfSA9IG1ldGE7XG5cbiAgY29uc3QgYWRkaXRpb25hbFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IHtcbiAgICB0eXBlOiBtb2R1bGVUeXBlXG4gIH0gYXN7XG4gICAgdHlwZTogby5FeHByZXNzaW9uLFxuICAgIGJvb3RzdHJhcDogby5FeHByZXNzaW9uLFxuICAgIGRlY2xhcmF0aW9uczogby5FeHByZXNzaW9uLFxuICAgIGltcG9ydHM6IG8uRXhwcmVzc2lvbixcbiAgICBleHBvcnRzOiBvLkV4cHJlc3Npb24sXG4gICAgc2NoZW1hczogby5MaXRlcmFsQXJyYXlFeHByLFxuICAgIGlkOiBvLkV4cHJlc3Npb25cbiAgfTtcblxuICAvLyBPbmx5IGdlbmVyYXRlIHRoZSBrZXlzIGluIHRoZSBtZXRhZGF0YSBpZiB0aGUgYXJyYXlzIGhhdmUgdmFsdWVzLlxuICBpZiAoYm9vdHN0cmFwLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuYm9vdHN0cmFwID0gcmVmc1RvQXJyYXkoYm9vdHN0cmFwLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gIH1cblxuICAvLyBJZiByZXF1ZXN0ZWQgdG8gZW1pdCBzY29wZSBpbmZvcm1hdGlvbiBpbmxpbmUsIHBhc3MgdGhlIGRlY2xhcmF0aW9ucywgaW1wb3J0cyBhbmQgZXhwb3J0cyB0b1xuICAvLyB0aGUgYMm1ybVkZWZpbmVOZ01vZHVsZWAgY2FsbC4gVGhlIEpJVCBjb21waWxhdGlvbiB1c2VzIHRoaXMuXG4gIGlmIChlbWl0SW5saW5lKSB7XG4gICAgaWYgKGRlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuZGVjbGFyYXRpb25zID0gcmVmc1RvQXJyYXkoZGVjbGFyYXRpb25zLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gICAgfVxuXG4gICAgaWYgKGltcG9ydHMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLmltcG9ydHMgPSByZWZzVG9BcnJheShpbXBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gICAgfVxuXG4gICAgaWYgKGV4cG9ydHMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLmV4cG9ydHMgPSByZWZzVG9BcnJheShleHBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgbm90IGVtaXR0aW5nIGlubGluZSwgdGhlIHNjb3BlIGluZm9ybWF0aW9uIGlzIG5vdCBwYXNzZWQgaW50byBgybXJtWRlZmluZU5nTW9kdWxlYCBhcyBpdCB3b3VsZFxuICAvLyBwcmV2ZW50IHRyZWUtc2hha2luZyBvZiB0aGUgZGVjbGFyYXRpb25zLCBpbXBvcnRzIGFuZCBleHBvcnRzIHJlZmVyZW5jZXMuXG4gIGVsc2Uge1xuICAgIGNvbnN0IHNldE5nTW9kdWxlU2NvcGVDYWxsID0gZ2VuZXJhdGVTZXROZ01vZHVsZVNjb3BlQ2FsbChtZXRhKTtcbiAgICBpZiAoc2V0TmdNb2R1bGVTY29wZUNhbGwgIT09IG51bGwpIHtcbiAgICAgIGFkZGl0aW9uYWxTdGF0ZW1lbnRzLnB1c2goc2V0TmdNb2R1bGVTY29wZUNhbGwpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChzY2hlbWFzICYmIHNjaGVtYXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zY2hlbWFzID0gby5saXRlcmFsQXJyKHNjaGVtYXMubWFwKHJlZiA9PiByZWYudmFsdWUpKTtcbiAgfVxuXG4gIGlmIChpZCkge1xuICAgIGRlZmluaXRpb25NYXAuaWQgPSBpZDtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lTmdNb2R1bGUpLmNhbGxGbihbbWFwVG9NYXBFeHByZXNzaW9uKGRlZmluaXRpb25NYXApXSk7XG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuTmdNb2R1bGVEZWZXaXRoTWV0YSwgW1xuICAgIG5ldyBvLkV4cHJlc3Npb25UeXBlKG1vZHVsZVR5cGUpLCB0dXBsZVR5cGVPZihkZWNsYXJhdGlvbnMpLCB0dXBsZVR5cGVPZihpbXBvcnRzKSxcbiAgICB0dXBsZVR5cGVPZihleHBvcnRzKVxuICBdKSk7XG5cblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIGFkZGl0aW9uYWxTdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBmdW5jdGlvbiBjYWxsIHRvIGDJtcm1c2V0TmdNb2R1bGVTY29wZWAgd2l0aCBhbGwgbmVjZXNzYXJ5IGluZm9ybWF0aW9uIHNvIHRoYXQgdGhlXG4gKiB0cmFuc2l0aXZlIG1vZHVsZSBzY29wZSBjYW4gYmUgY29tcHV0ZWQgZHVyaW5nIHJ1bnRpbWUgaW4gSklUIG1vZGUuIFRoaXMgY2FsbCBpcyBtYXJrZWQgcHVyZVxuICogc3VjaCB0aGF0IHRoZSByZWZlcmVuY2VzIHRvIGRlY2xhcmF0aW9ucywgaW1wb3J0cyBhbmQgZXhwb3J0cyBtYXkgYmUgZWxpZGVkIGNhdXNpbmcgdGhlc2VcbiAqIHN5bWJvbHMgdG8gYmVjb21lIHRyZWUtc2hha2VhYmxlLlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZVNldE5nTW9kdWxlU2NvcGVDYWxsKG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSk6IG8uU3RhdGVtZW50fG51bGwge1xuICBjb25zdCB7dHlwZTogbW9kdWxlVHlwZSwgZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBleHBvcnRzLCBjb250YWluc0ZvcndhcmREZWNsc30gPSBtZXRhO1xuXG4gIGNvbnN0IHNjb3BlTWFwID0ge30gYXN7XG4gICAgZGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb24sXG4gICAgaW1wb3J0czogby5FeHByZXNzaW9uLFxuICAgIGV4cG9ydHM6IG8uRXhwcmVzc2lvbixcbiAgfTtcblxuICBpZiAoZGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgIHNjb3BlTWFwLmRlY2xhcmF0aW9ucyA9IHJlZnNUb0FycmF5KGRlY2xhcmF0aW9ucywgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICB9XG5cbiAgaWYgKGltcG9ydHMubGVuZ3RoKSB7XG4gICAgc2NvcGVNYXAuaW1wb3J0cyA9IHJlZnNUb0FycmF5KGltcG9ydHMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgfVxuXG4gIGlmIChleHBvcnRzLmxlbmd0aCkge1xuICAgIHNjb3BlTWFwLmV4cG9ydHMgPSByZWZzVG9BcnJheShleHBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gIH1cblxuICBpZiAoT2JqZWN0LmtleXMoc2NvcGVNYXApLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgZm5DYWxsID0gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgLyogZm4gKi8gby5pbXBvcnRFeHByKFIzLnNldE5nTW9kdWxlU2NvcGUpLFxuICAgICAgLyogYXJncyAqL1ttb2R1bGVUeXBlLCBtYXBUb01hcEV4cHJlc3Npb24oc2NvcGVNYXApXSxcbiAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogc291cmNlU3BhbiAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBwdXJlICovIHRydWUpO1xuICByZXR1cm4gZm5DYWxsLnRvU3RtdCgpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0b3JEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdG9yTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsO1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuICBpbXBvcnRzOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RvcihtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOiBSM0luamVjdG9yRGVmIHtcbiAgY29uc3QgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICBkZXBzOiBtZXRhLmRlcHMsXG4gICAgaW5qZWN0Rm46IFIzLmluamVjdCxcbiAgfSk7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSB7XG4gICAgZmFjdG9yeTogcmVzdWx0LmZhY3RvcnksXG4gIH0gYXN7ZmFjdG9yeTogby5FeHByZXNzaW9uLCBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbiwgaW1wb3J0czogby5FeHByZXNzaW9ufTtcblxuICBpZiAobWV0YS5wcm92aWRlcnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICB9XG5cbiAgaWYgKG1ldGEuaW1wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5pbXBvcnRzID0gby5saXRlcmFsQXJyKG1ldGEuaW1wb3J0cyk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUluamVjdG9yKS5jYWxsRm4oW21hcFRvTWFwRXhwcmVzc2lvbihkZWZpbml0aW9uTWFwKV0pO1xuICBjb25zdCB0eXBlID1cbiAgICAgIG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5JbmplY3RvckRlZiwgW25ldyBvLkV4cHJlc3Npb25UeXBlKG1ldGEudHlwZSldKSk7XG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogcmVzdWx0LnN0YXRlbWVudHN9O1xufVxuXG4vLyBUT0RPKGFseGh1Yik6IGludGVncmF0ZSB0aGlzIHdpdGggYGNvbXBpbGVOZ01vZHVsZWAuIEN1cnJlbnRseSB0aGUgdHdvIGFyZSBzZXBhcmF0ZSBvcGVyYXRpb25zLlxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVOZ01vZHVsZUZyb21SZW5kZXIyKFxuICAgIGN0eDogT3V0cHV0Q29udGV4dCwgbmdNb2R1bGU6IENvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGEsXG4gICAgaW5qZWN0YWJsZUNvbXBpbGVyOiBJbmplY3RhYmxlQ29tcGlsZXIpOiB2b2lkIHtcbiAgY29uc3QgY2xhc3NOYW1lID0gaWRlbnRpZmllck5hbWUobmdNb2R1bGUudHlwZSkgITtcblxuICBjb25zdCByYXdJbXBvcnRzID0gbmdNb2R1bGUucmF3SW1wb3J0cyA/IFtuZ01vZHVsZS5yYXdJbXBvcnRzXSA6IFtdO1xuICBjb25zdCByYXdFeHBvcnRzID0gbmdNb2R1bGUucmF3RXhwb3J0cyA/IFtuZ01vZHVsZS5yYXdFeHBvcnRzXSA6IFtdO1xuXG4gIGNvbnN0IGluamVjdG9yRGVmQXJnID0gbWFwTGl0ZXJhbCh7XG4gICAgJ2ZhY3RvcnknOlxuICAgICAgICBpbmplY3RhYmxlQ29tcGlsZXIuZmFjdG9yeUZvcih7dHlwZTogbmdNb2R1bGUudHlwZSwgc3ltYm9sOiBuZ01vZHVsZS50eXBlLnJlZmVyZW5jZX0sIGN0eCksXG4gICAgJ3Byb3ZpZGVycyc6IGNvbnZlcnRNZXRhVG9PdXRwdXQobmdNb2R1bGUucmF3UHJvdmlkZXJzLCBjdHgpLFxuICAgICdpbXBvcnRzJzogY29udmVydE1ldGFUb091dHB1dChbLi4ucmF3SW1wb3J0cywgLi4ucmF3RXhwb3J0c10sIGN0eCksXG4gIH0pO1xuXG4gIGNvbnN0IGluamVjdG9yRGVmID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUluamVjdG9yKS5jYWxsRm4oW2luamVjdG9yRGVmQXJnXSk7XG5cbiAgY3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICAvKiBuYW1lICovIGNsYXNzTmFtZSxcbiAgICAgIC8qIHBhcmVudCAqLyBudWxsLFxuICAgICAgLyogZmllbGRzICovW25ldyBvLkNsYXNzRmllbGQoXG4gICAgICAgICAgLyogbmFtZSAqLyAnbmdJbmplY3RvckRlZicsXG4gICAgICAgICAgLyogdHlwZSAqLyBvLklORkVSUkVEX1RZUEUsXG4gICAgICAgICAgLyogbW9kaWZpZXJzICovW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sXG4gICAgICAgICAgLyogaW5pdGlhbGl6ZXIgKi8gaW5qZWN0b3JEZWYsICldLFxuICAgICAgLyogZ2V0dGVycyAqL1tdLFxuICAgICAgLyogY29uc3RydWN0b3JNZXRob2QgKi8gbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSxcbiAgICAgIC8qIG1ldGhvZHMgKi9bXSkpO1xufVxuXG5mdW5jdGlvbiBhY2Nlc3NFeHBvcnRTY29wZShtb2R1bGU6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHNlbGVjdG9yU2NvcGUgPSBuZXcgby5SZWFkUHJvcEV4cHIobW9kdWxlLCAnbmdNb2R1bGVEZWYnKTtcbiAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihzZWxlY3RvclNjb3BlLCAnZXhwb3J0ZWQnKTtcbn1cblxuZnVuY3Rpb24gdHVwbGVUeXBlT2YoZXhwOiBSM1JlZmVyZW5jZVtdKTogby5UeXBlIHtcbiAgY29uc3QgdHlwZXMgPSBleHAubWFwKHJlZiA9PiBvLnR5cGVvZkV4cHIocmVmLnR5cGUpKTtcbiAgcmV0dXJuIGV4cC5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIodHlwZXMpKSA6IG8uTk9ORV9UWVBFO1xufVxuXG5mdW5jdGlvbiByZWZzVG9BcnJheShyZWZzOiBSM1JlZmVyZW5jZVtdLCBzaG91bGRGb3J3YXJkRGVjbGFyZTogYm9vbGVhbik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHZhbHVlcyA9IG8ubGl0ZXJhbEFycihyZWZzLm1hcChyZWYgPT4gcmVmLnZhbHVlKSk7XG4gIHJldHVybiBzaG91bGRGb3J3YXJkRGVjbGFyZSA/IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQodmFsdWVzKV0pIDogdmFsdWVzO1xufVxuIl19