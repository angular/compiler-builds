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
        define("@angular/compiler/src/render3/r3_module_compiler", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileInjector = exports.compileNgModule = void 0;
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
        var definitionMap = { type: internalType };
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
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineNgModule).callFn([util_1.mapToMapExpression(definitionMap)], undefined, true);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.NgModuleDefWithMeta, [
            new o.ExpressionType(moduleType.type), tupleTypeOf(declarations), tupleTypeOf(imports),
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
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineInjector).callFn([util_1.mapToMapExpression(definitionMap)], undefined, true);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.InjectorDef, [new o.ExpressionType(meta.type.type)]));
        return { expression: expression, type: type, statements: result.statements };
    }
    exports.compileInjector = compileInjector;
    function tupleTypeOf(exp) {
        var types = exp.map(function (ref) { return o.typeofExpr(ref.type); });
        return exp.length > 0 ? o.expressionType(o.literalArr(types)) : o.NONE_TYPE;
    }
    function refsToArray(refs, shouldForwardDeclare) {
        var values = o.literalArr(refs.map(function (ref) { return ref.value; }));
        return shouldForwardDeclare ? o.fn([], [new o.ReturnStatement(values)]) : values;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJEQUEwQztJQUUxQyx1RUFBMkY7SUFDM0YsK0VBQW1EO0lBQ25ELDJEQUFpRjtJQTRFakY7O09BRUc7SUFDSCxTQUFnQixlQUFlLENBQUMsSUFBd0I7UUFFcEQsSUFBQSxZQUFZLEdBVVYsSUFBSSxhQVZNLEVBQ04sVUFBVSxHQVNkLElBQUksS0FUVSxFQUNoQixTQUFTLEdBUVAsSUFBSSxVQVJHLEVBQ1QsWUFBWSxHQU9WLElBQUksYUFQTSxFQUNaLE9BQU8sR0FNTCxJQUFJLFFBTkMsRUFDUCxPQUFPLEdBS0wsSUFBSSxRQUxDLEVBQ1AsT0FBTyxHQUlMLElBQUksUUFKQyxFQUNQLG9CQUFvQixHQUdsQixJQUFJLHFCQUhjLEVBQ3BCLFVBQVUsR0FFUixJQUFJLFdBRkksRUFDVixFQUFFLEdBQ0EsSUFBSSxHQURKLENBQ0s7UUFFVCxJQUFNLG9CQUFvQixHQUFrQixFQUFFLENBQUM7UUFDL0MsSUFBTSxhQUFhLEdBQUcsRUFBQyxJQUFJLEVBQUUsWUFBWSxFQVF4QyxDQUFDO1FBRUYsb0VBQW9FO1FBQ3BFLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRTtZQUNwQixhQUFhLENBQUMsU0FBUyxHQUFHLFdBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztTQUN4RTtRQUVELCtGQUErRjtRQUMvRiw4REFBOEQ7UUFDOUQsSUFBSSxVQUFVLEVBQUU7WUFDZCxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7Z0JBQ3ZCLGFBQWEsQ0FBQyxZQUFZLEdBQUcsV0FBVyxDQUFDLFlBQVksRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO2FBQzlFO1lB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QUksT0FBQSxHQUFHLENBQUMsS0FBSyxFQUFULENBQVMsQ0FBQyxDQUFDLENBQUM7UUFDeEQsT0FBTyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDbkYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5VGFyZ2V0fSBmcm9tICcuL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2ppdE9ubHlHdWFyZGVkRXhwcmVzc2lvbiwgbWFwVG9NYXBFeHByZXNzaW9uLCBSM1JlZmVyZW5jZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBSM05nTW9kdWxlRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG4gIGFkZGl0aW9uYWxTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIHJlcXVpcmVkIGJ5IHRoZSBtb2R1bGUgY29tcGlsZXIgdG8gZ2VuZXJhdGUgYSBtb2R1bGUgZGVmIChgybVtb2RgKSBmb3IgYSB0eXBlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzTmdNb2R1bGVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgbW9kdWxlIHR5cGUgYmVpbmcgY29tcGlsZWQuXG4gICAqL1xuICB0eXBlOiBSM1JlZmVyZW5jZTtcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIG1vZHVsZSB0eXBlIGJlaW5nIGNvbXBpbGVkLCBpbnRlbmRlZCBmb3IgdXNlIHdpdGhpbiBhIGNsYXNzXG4gICAqIGRlZmluaXRpb24gaXRzZWxmLlxuICAgKlxuICAgKiBUaGlzIGNhbiBkaWZmZXIgZnJvbSB0aGUgb3V0ZXIgYHR5cGVgIGlmIHRoZSBjbGFzcyBpcyBiZWluZyBjb21waWxlZCBieSBuZ2NjIGFuZCBpcyBpbnNpZGVcbiAgICogYW4gSUlGRSBzdHJ1Y3R1cmUgdGhhdCB1c2VzIGEgZGlmZmVyZW50IG5hbWUgaW50ZXJuYWxseS5cbiAgICovXG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGludGVuZGVkIGZvciB1c2UgYnkgc3RhdGVtZW50cyB0aGF0IGFyZSBhZGphY2VudCAoaS5lLiB0aWdodGx5IGNvdXBsZWQpIHRvIGJ1dFxuICAgKiBub3QgaW50ZXJuYWwgdG8gYSBjbGFzcyBkZWZpbml0aW9uLlxuICAgKlxuICAgKiBUaGlzIGNhbiBkaWZmZXIgZnJvbSB0aGUgb3V0ZXIgYHR5cGVgIGlmIHRoZSBjbGFzcyBpcyBiZWluZyBjb21waWxlZCBieSBuZ2NjIGFuZCBpcyBpbnNpZGVcbiAgICogYW4gSUlGRSBzdHJ1Y3R1cmUgdGhhdCB1c2VzIGEgZGlmZmVyZW50IG5hbWUgaW50ZXJuYWxseS5cbiAgICovXG4gIGFkamFjZW50VHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGJvb3RzdHJhcCBjb21wb25lbnRzIHNwZWNpZmllZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgYm9vdHN0cmFwOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIGRlY2xhcmVkIGJ5IHRoZSBtb2R1bGUuXG4gICAqL1xuICBkZWNsYXJhdGlvbnM6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgaW1wb3J0cyBvZiB0aGUgbW9kdWxlLlxuICAgKi9cbiAgaW1wb3J0czogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGUuXG4gICAqL1xuICBleHBvcnRzOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGVtaXQgdGhlIHNlbGVjdG9yIHNjb3BlIHZhbHVlcyAoZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBleHBvcnRzKSBpbmxpbmUgaW50byB0aGVcbiAgICogbW9kdWxlIGRlZmluaXRpb24sIG9yIHRvIGdlbmVyYXRlIGFkZGl0aW9uYWwgc3RhdGVtZW50cyB3aGljaCBwYXRjaCB0aGVtIG9uLiBJbmxpbmUgZW1pc3Npb25cbiAgICogZG9lcyBub3QgYWxsb3cgY29tcG9uZW50cyB0byBiZSB0cmVlLXNoYWtlbiwgYnV0IGlzIHVzZWZ1bCBmb3IgSklUIG1vZGUuXG4gICAqL1xuICBlbWl0SW5saW5lOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGdlbmVyYXRlIGNsb3N1cmUgd3JhcHBlcnMgZm9yIGJvb3RzdHJhcCwgZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBhbmQgZXhwb3J0cy5cbiAgICovXG4gIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgc2V0IG9mIHNjaGVtYXMgdGhhdCBkZWNsYXJlIGVsZW1lbnRzIHRvIGJlIGFsbG93ZWQgaW4gdGhlIE5nTW9kdWxlLlxuICAgKi9cbiAgc2NoZW1hczogUjNSZWZlcmVuY2VbXXxudWxsO1xuXG4gIC8qKiBVbmlxdWUgSUQgb3IgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHVuaXF1ZSBJRCBvZiBhbiBOZ01vZHVsZS4gKi9cbiAgaWQ6IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhbiBgUjNOZ01vZHVsZURlZmAgZm9yIHRoZSBnaXZlbiBgUjNOZ01vZHVsZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVOZ01vZHVsZShtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEpOiBSM05nTW9kdWxlRGVmIHtcbiAgY29uc3Qge1xuICAgIGludGVybmFsVHlwZSxcbiAgICB0eXBlOiBtb2R1bGVUeXBlLFxuICAgIGJvb3RzdHJhcCxcbiAgICBkZWNsYXJhdGlvbnMsXG4gICAgaW1wb3J0cyxcbiAgICBleHBvcnRzLFxuICAgIHNjaGVtYXMsXG4gICAgY29udGFpbnNGb3J3YXJkRGVjbHMsXG4gICAgZW1pdElubGluZSxcbiAgICBpZFxuICB9ID0gbWV0YTtcblxuICBjb25zdCBhZGRpdGlvbmFsU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0ge3R5cGU6IGludGVybmFsVHlwZX0gYXMge1xuICAgIHR5cGU6IG8uRXhwcmVzc2lvbixcbiAgICBib290c3RyYXA6IG8uRXhwcmVzc2lvbixcbiAgICBkZWNsYXJhdGlvbnM6IG8uRXhwcmVzc2lvbixcbiAgICBpbXBvcnRzOiBvLkV4cHJlc3Npb24sXG4gICAgZXhwb3J0czogby5FeHByZXNzaW9uLFxuICAgIHNjaGVtYXM6IG8uTGl0ZXJhbEFycmF5RXhwcixcbiAgICBpZDogby5FeHByZXNzaW9uXG4gIH07XG5cbiAgLy8gT25seSBnZW5lcmF0ZSB0aGUga2V5cyBpbiB0aGUgbWV0YWRhdGEgaWYgdGhlIGFycmF5cyBoYXZlIHZhbHVlcy5cbiAgaWYgKGJvb3RzdHJhcC5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLmJvb3RzdHJhcCA9IHJlZnNUb0FycmF5KGJvb3RzdHJhcCwgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICB9XG5cbiAgLy8gSWYgcmVxdWVzdGVkIHRvIGVtaXQgc2NvcGUgaW5mb3JtYXRpb24gaW5saW5lLCBwYXNzIHRoZSBkZWNsYXJhdGlvbnMsIGltcG9ydHMgYW5kIGV4cG9ydHMgdG9cbiAgLy8gdGhlIGDJtcm1ZGVmaW5lTmdNb2R1bGVgIGNhbGwuIFRoZSBKSVQgY29tcGlsYXRpb24gdXNlcyB0aGlzLlxuICBpZiAoZW1pdElubGluZSkge1xuICAgIGlmIChkZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLmRlY2xhcmF0aW9ucyA9IHJlZnNUb0FycmF5KGRlY2xhcmF0aW9ucywgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICAgIH1cblxuICAgIGlmIChpbXBvcnRzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5pbXBvcnRzID0gcmVmc1RvQXJyYXkoaW1wb3J0cywgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICAgIH1cblxuICAgIGlmIChleHBvcnRzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5leHBvcnRzID0gcmVmc1RvQXJyYXkoZXhwb3J0cywgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIG5vdCBlbWl0dGluZyBpbmxpbmUsIHRoZSBzY29wZSBpbmZvcm1hdGlvbiBpcyBub3QgcGFzc2VkIGludG8gYMm1ybVkZWZpbmVOZ01vZHVsZWAgYXMgaXQgd291bGRcbiAgLy8gcHJldmVudCB0cmVlLXNoYWtpbmcgb2YgdGhlIGRlY2xhcmF0aW9ucywgaW1wb3J0cyBhbmQgZXhwb3J0cyByZWZlcmVuY2VzLlxuICBlbHNlIHtcbiAgICBjb25zdCBzZXROZ01vZHVsZVNjb3BlQ2FsbCA9IGdlbmVyYXRlU2V0TmdNb2R1bGVTY29wZUNhbGwobWV0YSk7XG4gICAgaWYgKHNldE5nTW9kdWxlU2NvcGVDYWxsICE9PSBudWxsKSB7XG4gICAgICBhZGRpdGlvbmFsU3RhdGVtZW50cy5wdXNoKHNldE5nTW9kdWxlU2NvcGVDYWxsKTtcbiAgICB9XG4gIH1cblxuICBpZiAoc2NoZW1hcyAmJiBzY2hlbWFzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2NoZW1hcyA9IG8ubGl0ZXJhbEFycihzY2hlbWFzLm1hcChyZWYgPT4gcmVmLnZhbHVlKSk7XG4gIH1cblxuICBpZiAoaWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLmlkID0gaWQ7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVOZ01vZHVsZSkuY2FsbEZuKFttYXBUb01hcEV4cHJlc3Npb24oZGVmaW5pdGlvbk1hcCldLCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLk5nTW9kdWxlRGVmV2l0aE1ldGEsIFtcbiAgICBuZXcgby5FeHByZXNzaW9uVHlwZShtb2R1bGVUeXBlLnR5cGUpLCB0dXBsZVR5cGVPZihkZWNsYXJhdGlvbnMpLCB0dXBsZVR5cGVPZihpbXBvcnRzKSxcbiAgICB0dXBsZVR5cGVPZihleHBvcnRzKVxuICBdKSk7XG5cblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIGFkZGl0aW9uYWxTdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBmdW5jdGlvbiBjYWxsIHRvIGDJtcm1c2V0TmdNb2R1bGVTY29wZWAgd2l0aCBhbGwgbmVjZXNzYXJ5IGluZm9ybWF0aW9uIHNvIHRoYXQgdGhlXG4gKiB0cmFuc2l0aXZlIG1vZHVsZSBzY29wZSBjYW4gYmUgY29tcHV0ZWQgZHVyaW5nIHJ1bnRpbWUgaW4gSklUIG1vZGUuIFRoaXMgY2FsbCBpcyBtYXJrZWQgcHVyZVxuICogc3VjaCB0aGF0IHRoZSByZWZlcmVuY2VzIHRvIGRlY2xhcmF0aW9ucywgaW1wb3J0cyBhbmQgZXhwb3J0cyBtYXkgYmUgZWxpZGVkIGNhdXNpbmcgdGhlc2VcbiAqIHN5bWJvbHMgdG8gYmVjb21lIHRyZWUtc2hha2VhYmxlLlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZVNldE5nTW9kdWxlU2NvcGVDYWxsKG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSk6IG8uU3RhdGVtZW50fG51bGwge1xuICBjb25zdCB7YWRqYWNlbnRUeXBlOiBtb2R1bGVUeXBlLCBkZWNsYXJhdGlvbnMsIGltcG9ydHMsIGV4cG9ydHMsIGNvbnRhaW5zRm9yd2FyZERlY2xzfSA9IG1ldGE7XG5cbiAgY29uc3Qgc2NvcGVNYXAgPSB7fSBhcyB7XG4gICAgZGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb24sXG4gICAgaW1wb3J0czogby5FeHByZXNzaW9uLFxuICAgIGV4cG9ydHM6IG8uRXhwcmVzc2lvbixcbiAgfTtcblxuICBpZiAoZGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgIHNjb3BlTWFwLmRlY2xhcmF0aW9ucyA9IHJlZnNUb0FycmF5KGRlY2xhcmF0aW9ucywgY29udGFpbnNGb3J3YXJkRGVjbHMpO1xuICB9XG5cbiAgaWYgKGltcG9ydHMubGVuZ3RoKSB7XG4gICAgc2NvcGVNYXAuaW1wb3J0cyA9IHJlZnNUb0FycmF5KGltcG9ydHMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKTtcbiAgfVxuXG4gIGlmIChleHBvcnRzLmxlbmd0aCkge1xuICAgIHNjb3BlTWFwLmV4cG9ydHMgPSByZWZzVG9BcnJheShleHBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscyk7XG4gIH1cblxuICBpZiAoT2JqZWN0LmtleXMoc2NvcGVNYXApLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gc2V0TmdNb2R1bGVTY29wZSguLi4pXG4gIGNvbnN0IGZuQ2FsbCA9IG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgIC8qIGZuICovIG8uaW1wb3J0RXhwcihSMy5zZXROZ01vZHVsZVNjb3BlKSxcbiAgICAgIC8qIGFyZ3MgKi9bbW9kdWxlVHlwZSwgbWFwVG9NYXBFeHByZXNzaW9uKHNjb3BlTWFwKV0pO1xuXG4gIC8vIChuZ0ppdE1vZGUgZ3VhcmQpICYmIHNldE5nTW9kdWxlU2NvcGUoLi4uKVxuICBjb25zdCBndWFyZGVkQ2FsbCA9IGppdE9ubHlHdWFyZGVkRXhwcmVzc2lvbihmbkNhbGwpO1xuXG4gIC8vIGZ1bmN0aW9uKCkgeyAobmdKaXRNb2RlIGd1YXJkKSAmJiBzZXROZ01vZHVsZVNjb3BlKC4uLik7IH1cbiAgY29uc3QgaWlmZSA9IG5ldyBvLkZ1bmN0aW9uRXhwcihcbiAgICAgIC8qIHBhcmFtcyAqL1tdLFxuICAgICAgLyogc3RhdGVtZW50cyAqL1tndWFyZGVkQ2FsbC50b1N0bXQoKV0pO1xuXG4gIC8vIChmdW5jdGlvbigpIHsgKG5nSml0TW9kZSBndWFyZCkgJiYgc2V0TmdNb2R1bGVTY29wZSguLi4pOyB9KSgpXG4gIGNvbnN0IGlpZmVDYWxsID0gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgLyogZm4gKi8gaWlmZSxcbiAgICAgIC8qIGFyZ3MgKi9bXSk7XG5cbiAgcmV0dXJuIGlpZmVDYWxsLnRvU3RtdCgpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0b3JEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdG9yTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IFIzUmVmZXJlbmNlO1xuICBpbnRlcm5hbFR5cGU6IG8uRXhwcmVzc2lvbjtcbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsO1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuICBpbXBvcnRzOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RvcihtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOiBSM0luamVjdG9yRGVmIHtcbiAgY29uc3QgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICBpbnRlcm5hbFR5cGU6IG1ldGEuaW50ZXJuYWxUeXBlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuaW5qZWN0LFxuICAgIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0Lk5nTW9kdWxlLFxuICB9KTtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IHtcbiAgICBmYWN0b3J5OiByZXN1bHQuZmFjdG9yeSxcbiAgfSBhcyB7ZmFjdG9yeTogby5FeHByZXNzaW9uLCBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbiwgaW1wb3J0czogby5FeHByZXNzaW9ufTtcblxuICBpZiAobWV0YS5wcm92aWRlcnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICB9XG5cbiAgaWYgKG1ldGEuaW1wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5pbXBvcnRzID0gby5saXRlcmFsQXJyKG1ldGEuaW1wb3J0cyk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVJbmplY3RvcikuY2FsbEZuKFttYXBUb01hcEV4cHJlc3Npb24oZGVmaW5pdGlvbk1hcCldLCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCB0eXBlID1cbiAgICAgIG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5JbmplY3RvckRlZiwgW25ldyBvLkV4cHJlc3Npb25UeXBlKG1ldGEudHlwZS50eXBlKV0pKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50c307XG59XG5cbmZ1bmN0aW9uIHR1cGxlVHlwZU9mKGV4cDogUjNSZWZlcmVuY2VbXSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVzID0gZXhwLm1hcChyZWYgPT4gby50eXBlb2ZFeHByKHJlZi50eXBlKSk7XG4gIHJldHVybiBleHAubGVuZ3RoID4gMCA/IG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKHR5cGVzKSkgOiBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gcmVmc1RvQXJyYXkocmVmczogUjNSZWZlcmVuY2VbXSwgc2hvdWxkRm9yd2FyZERlY2xhcmU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB2YWx1ZXMgPSBvLmxpdGVyYWxBcnIocmVmcy5tYXAocmVmID0+IHJlZi52YWx1ZSkpO1xuICByZXR1cm4gc2hvdWxkRm9yd2FyZERlY2xhcmUgPyBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHZhbHVlcyldKSA6IHZhbHVlcztcbn1cbiJdfQ==