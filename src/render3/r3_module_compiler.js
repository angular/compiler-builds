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
        define("@angular/compiler/src/render3/r3_module_compiler", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createNgModuleType = exports.compileNgModuleDeclarationExpression = exports.compileNgModule = void 0;
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/util");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    /**
     * Construct an `R3NgModuleDef` for the given `R3NgModuleMetadata`.
     */
    function compileNgModule(meta) {
        var internalType = meta.internalType, bootstrap = meta.bootstrap, declarations = meta.declarations, imports = meta.imports, exports = meta.exports, schemas = meta.schemas, containsForwardDecls = meta.containsForwardDecls, emitInline = meta.emitInline, id = meta.id;
        var statements = [];
        var definitionMap = new util_2.DefinitionMap();
        definitionMap.set('type', internalType);
        if (bootstrap.length > 0) {
            definitionMap.set('bootstrap', (0, util_1.refsToArray)(bootstrap, containsForwardDecls));
        }
        // If requested to emit scope information inline, pass the `declarations`, `imports` and `exports`
        // to the `ɵɵdefineNgModule()` call. The JIT compilation uses this.
        if (emitInline) {
            if (declarations.length > 0) {
                definitionMap.set('declarations', (0, util_1.refsToArray)(declarations, containsForwardDecls));
            }
            if (imports.length > 0) {
                definitionMap.set('imports', (0, util_1.refsToArray)(imports, containsForwardDecls));
            }
            if (exports.length > 0) {
                definitionMap.set('exports', (0, util_1.refsToArray)(exports, containsForwardDecls));
            }
        }
        // If not emitting inline, the scope information is not passed into `ɵɵdefineNgModule` as it would
        // prevent tree-shaking of the declarations, imports and exports references.
        else {
            var setNgModuleScopeCall = generateSetNgModuleScopeCall(meta);
            if (setNgModuleScopeCall !== null) {
                statements.push(setNgModuleScopeCall);
            }
        }
        if (schemas !== null && schemas.length > 0) {
            definitionMap.set('schemas', o.literalArr(schemas.map(function (ref) { return ref.value; })));
        }
        if (id !== null) {
            definitionMap.set('id', id);
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineNgModule).callFn([definitionMap.toLiteralMap()], undefined, true);
        var type = createNgModuleType(meta);
        return { expression: expression, type: type, statements: statements };
    }
    exports.compileNgModule = compileNgModule;
    /**
     * This function is used in JIT mode to generate the call to `ɵɵdefineNgModule()` from a call to
     * `ɵɵngDeclareNgModule()`.
     */
    function compileNgModuleDeclarationExpression(meta) {
        var definitionMap = new util_2.DefinitionMap();
        definitionMap.set('type', new o.WrappedNodeExpr(meta.type));
        if (meta.bootstrap !== undefined) {
            definitionMap.set('bootstrap', new o.WrappedNodeExpr(meta.bootstrap));
        }
        if (meta.declarations !== undefined) {
            definitionMap.set('declarations', new o.WrappedNodeExpr(meta.declarations));
        }
        if (meta.imports !== undefined) {
            definitionMap.set('imports', new o.WrappedNodeExpr(meta.imports));
        }
        if (meta.exports !== undefined) {
            definitionMap.set('exports', new o.WrappedNodeExpr(meta.exports));
        }
        if (meta.schemas !== undefined) {
            definitionMap.set('schemas', new o.WrappedNodeExpr(meta.schemas));
        }
        if (meta.id !== undefined) {
            definitionMap.set('id', new o.WrappedNodeExpr(meta.id));
        }
        return o.importExpr(r3_identifiers_1.Identifiers.defineNgModule).callFn([definitionMap.toLiteralMap()]);
    }
    exports.compileNgModuleDeclarationExpression = compileNgModuleDeclarationExpression;
    function createNgModuleType(_a) {
        var moduleType = _a.type, declarations = _a.declarations, imports = _a.imports, exports = _a.exports;
        return new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.NgModuleDeclaration, [
            new o.ExpressionType(moduleType.type), tupleTypeOf(declarations), tupleTypeOf(imports),
            tupleTypeOf(exports)
        ]));
    }
    exports.createNgModuleType = createNgModuleType;
    /**
     * Generates a function call to `ɵɵsetNgModuleScope` with all necessary information so that the
     * transitive module scope can be computed during runtime in JIT mode. This call is marked pure
     * such that the references to declarations, imports and exports may be elided causing these
     * symbols to become tree-shakeable.
     */
    function generateSetNgModuleScopeCall(meta) {
        var moduleType = meta.adjacentType, declarations = meta.declarations, imports = meta.imports, exports = meta.exports, containsForwardDecls = meta.containsForwardDecls;
        var scopeMap = new util_2.DefinitionMap();
        if (declarations.length > 0) {
            scopeMap.set('declarations', (0, util_1.refsToArray)(declarations, containsForwardDecls));
        }
        if (imports.length > 0) {
            scopeMap.set('imports', (0, util_1.refsToArray)(imports, containsForwardDecls));
        }
        if (exports.length > 0) {
            scopeMap.set('exports', (0, util_1.refsToArray)(exports, containsForwardDecls));
        }
        if (Object.keys(scopeMap.values).length === 0) {
            return null;
        }
        // setNgModuleScope(...)
        var fnCall = new o.InvokeFunctionExpr(
        /* fn */ o.importExpr(r3_identifiers_1.Identifiers.setNgModuleScope), 
        /* args */ [moduleType, scopeMap.toLiteralMap()]);
        // (ngJitMode guard) && setNgModuleScope(...)
        var guardedCall = (0, util_1.jitOnlyGuardedExpression)(fnCall);
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
    function tupleTypeOf(exp) {
        var types = exp.map(function (ref) { return o.typeofExpr(ref.type); });
        return exp.length > 0 ? o.expressionType(o.literalArr(types)) : o.NONE_TYPE;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJEQUEwQztJQUUxQywrRUFBbUQ7SUFDbkQsMkRBQWdHO0lBQ2hHLGdFQUEwQztJQTJHMUM7O09BRUc7SUFDSCxTQUFnQixlQUFlLENBQUMsSUFBd0I7UUFFcEQsSUFBQSxZQUFZLEdBU1YsSUFBSSxhQVRNLEVBQ1osU0FBUyxHQVFQLElBQUksVUFSRyxFQUNULFlBQVksR0FPVixJQUFJLGFBUE0sRUFDWixPQUFPLEdBTUwsSUFBSSxRQU5DLEVBQ1AsT0FBTyxHQUtMLElBQUksUUFMQyxFQUNQLE9BQU8sR0FJTCxJQUFJLFFBSkMsRUFDUCxvQkFBb0IsR0FHbEIsSUFBSSxxQkFIYyxFQUNwQixVQUFVLEdBRVIsSUFBSSxXQUZJLEVBQ1YsRUFBRSxHQUNBLElBQUksR0FESixDQUNLO1FBRVQsSUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztRQUNyQyxJQUFNLGFBQWEsR0FBRyxJQUFJLG9CQUFhLEVBQW9CLENBQUM7UUFDNUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFFeEMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN4QixhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxJQUFBLGtCQUFXLEVBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUMsQ0FBQztTQUM5RTtRQUVELGtHQUFrRztRQUNsRyxtRUFBbUU7UUFDbkUsSUFBSSxVQUFVLEVBQUU7WUFDZCxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLGNB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QUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTVDLGlFQUFpRTtRQUNqRSxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxrQkFBa0I7UUFDckMsUUFBUSxDQUFDLElBQUk7UUFDYixVQUFVLENBQUEsRUFBRSxDQUFDLENBQUM7UUFFbEIsT0FBTyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVELFNBQVMsV0FBVyxDQUFDLEdBQWtCO1FBQ3JDLElBQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBdEIsQ0FBc0IsQ0FBQyxDQUFDO1FBQ3JELE9BQU8sR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzlFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtSM0RlY2xhcmVOZ01vZHVsZUZhY2FkZX0gZnJvbSAnLi4vY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZSc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2ppdE9ubHlHdWFyZGVkRXhwcmVzc2lvbiwgUjNDb21waWxlZEV4cHJlc3Npb24sIFIzUmVmZXJlbmNlLCByZWZzVG9BcnJheX0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi92aWV3L3V0aWwnO1xuXG4vKipcbiAqIE1ldGFkYXRhIHJlcXVpcmVkIGJ5IHRoZSBtb2R1bGUgY29tcGlsZXIgdG8gZ2VuZXJhdGUgYSBtb2R1bGUgZGVmIChgybVtb2RgKSBmb3IgYSB0eXBlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzTmdNb2R1bGVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgbW9kdWxlIHR5cGUgYmVpbmcgY29tcGlsZWQuXG4gICAqL1xuICB0eXBlOiBSM1JlZmVyZW5jZTtcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIG1vZHVsZSB0eXBlIGJlaW5nIGNvbXBpbGVkLCBpbnRlbmRlZCBmb3IgdXNlIHdpdGhpbiBhIGNsYXNzXG4gICAqIGRlZmluaXRpb24gaXRzZWxmLlxuICAgKlxuICAgKiBUaGlzIGNhbiBkaWZmZXIgZnJvbSB0aGUgb3V0ZXIgYHR5cGVgIGlmIHRoZSBjbGFzcyBpcyBiZWluZyBjb21waWxlZCBieSBuZ2NjIGFuZCBpcyBpbnNpZGVcbiAgICogYW4gSUlGRSBzdHJ1Y3R1cmUgdGhhdCB1c2VzIGEgZGlmZmVyZW50IG5hbWUgaW50ZXJuYWxseS5cbiAgICovXG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGludGVuZGVkIGZvciB1c2UgYnkgc3RhdGVtZW50cyB0aGF0IGFyZSBhZGphY2VudCAoaS5lLiB0aWdodGx5IGNvdXBsZWQpIHRvIGJ1dFxuICAgKiBub3QgaW50ZXJuYWwgdG8gYSBjbGFzcyBkZWZpbml0aW9uLlxuICAgKlxuICAgKiBUaGlzIGNhbiBkaWZmZXIgZnJvbSB0aGUgb3V0ZXIgYHR5cGVgIGlmIHRoZSBjbGFzcyBpcyBiZWluZyBjb21waWxlZCBieSBuZ2NjIGFuZCBpcyBpbnNpZGVcbiAgICogYW4gSUlGRSBzdHJ1Y3R1cmUgdGhhdCB1c2VzIGEgZGlmZmVyZW50IG5hbWUgaW50ZXJuYWxseS5cbiAgICovXG4gIGFkamFjZW50VHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGJvb3RzdHJhcCBjb21wb25lbnRzIHNwZWNpZmllZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgYm9vdHN0cmFwOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIGRlY2xhcmVkIGJ5IHRoZSBtb2R1bGUuXG4gICAqL1xuICBkZWNsYXJhdGlvbnM6IFIzUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgaW1wb3J0cyBvZiB0aGUgbW9kdWxlLlxuICAgKi9cbiAgaW1wb3J0czogUjNSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGUuXG4gICAqL1xuICBleHBvcnRzOiBSM1JlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGVtaXQgdGhlIHNlbGVjdG9yIHNjb3BlIHZhbHVlcyAoZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBleHBvcnRzKSBpbmxpbmUgaW50byB0aGVcbiAgICogbW9kdWxlIGRlZmluaXRpb24sIG9yIHRvIGdlbmVyYXRlIGFkZGl0aW9uYWwgc3RhdGVtZW50cyB3aGljaCBwYXRjaCB0aGVtIG9uLiBJbmxpbmUgZW1pc3Npb25cbiAgICogZG9lcyBub3QgYWxsb3cgY29tcG9uZW50cyB0byBiZSB0cmVlLXNoYWtlbiwgYnV0IGlzIHVzZWZ1bCBmb3IgSklUIG1vZGUuXG4gICAqL1xuICBlbWl0SW5saW5lOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGdlbmVyYXRlIGNsb3N1cmUgd3JhcHBlcnMgZm9yIGJvb3RzdHJhcCwgZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBhbmQgZXhwb3J0cy5cbiAgICovXG4gIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgc2V0IG9mIHNjaGVtYXMgdGhhdCBkZWNsYXJlIGVsZW1lbnRzIHRvIGJlIGFsbG93ZWQgaW4gdGhlIE5nTW9kdWxlLlxuICAgKi9cbiAgc2NoZW1hczogUjNSZWZlcmVuY2VbXXxudWxsO1xuXG4gIC8qKiBVbmlxdWUgSUQgb3IgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHVuaXF1ZSBJRCBvZiBhbiBOZ01vZHVsZS4gKi9cbiAgaWQ6IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIFRoZSBzaGFwZSBvZiB0aGUgb2JqZWN0IGxpdGVyYWwgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGDJtcm1ZGVmaW5lTmdNb2R1bGUoKWAgY2FsbC5cbiAqL1xuaW50ZXJmYWNlIFIzTmdNb2R1bGVEZWZNYXAge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIG1vZHVsZSB0eXBlIGJlaW5nIGNvbXBpbGVkLlxuICAgKi9cbiAgdHlwZTogby5FeHByZXNzaW9uO1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiBldmFsdWF0aW5nIHRvIGFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgYm9vdHN0cmFwIGNvbXBvbmVudHNcbiAgICogc3BlY2lmaWVkIGJ5IHRoZSBtb2R1bGUuXG4gICAqL1xuICBib290c3RyYXA/OiBvLkV4cHJlc3Npb247XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGV2YWx1YXRpbmcgdG8gYW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBkaXJlY3RpdmVzIGFuZCBwaXBlc1xuICAgKiBkZWNsYXJlZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgZGVjbGFyYXRpb25zPzogby5FeHByZXNzaW9uO1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiBldmFsdWF0aW5nIHRvIGFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgaW1wb3J0cyBvZiB0aGUgbW9kdWxlLlxuICAgKi9cbiAgaW1wb3J0cz86IG8uRXhwcmVzc2lvbjtcbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gZXZhbHVhdGluZyB0byBhbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZS5cbiAgICovXG4gIGV4cG9ydHM/OiBvLkV4cHJlc3Npb247XG4gIC8qKlxuICAgKiBBIGxpdGVyYWwgYXJyYXkgZXhwcmVzc2lvbiBjb250YWluaW5nIHRoZSBzY2hlbWFzIHRoYXQgZGVjbGFyZSBlbGVtZW50cyB0byBiZSBhbGxvd2VkIGluIHRoZVxuICAgKiBOZ01vZHVsZS5cbiAgICovXG4gIHNjaGVtYXM/OiBvLkxpdGVyYWxBcnJheUV4cHI7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGV2YWx1YXRpbmcgdG8gdGhlIHVuaXF1ZSBJRCBvZiBhbiBOZ01vZHVsZS5cbiAgICogKi9cbiAgaWQ/OiBvLkV4cHJlc3Npb247XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGFuIGBSM05nTW9kdWxlRGVmYCBmb3IgdGhlIGdpdmVuIGBSM05nTW9kdWxlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZU5nTW9kdWxlKG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3Qge1xuICAgIGludGVybmFsVHlwZSxcbiAgICBib290c3RyYXAsXG4gICAgZGVjbGFyYXRpb25zLFxuICAgIGltcG9ydHMsXG4gICAgZXhwb3J0cyxcbiAgICBzY2hlbWFzLFxuICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzLFxuICAgIGVtaXRJbmxpbmUsXG4gICAgaWRcbiAgfSA9IG1ldGE7XG5cbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNOZ01vZHVsZURlZk1hcD4oKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBpbnRlcm5hbFR5cGUpO1xuXG4gIGlmIChib290c3RyYXAubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdib290c3RyYXAnLCByZWZzVG9BcnJheShib290c3RyYXAsIGNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gIH1cblxuICAvLyBJZiByZXF1ZXN0ZWQgdG8gZW1pdCBzY29wZSBpbmZvcm1hdGlvbiBpbmxpbmUsIHBhc3MgdGhlIGBkZWNsYXJhdGlvbnNgLCBgaW1wb3J0c2AgYW5kIGBleHBvcnRzYFxuICAvLyB0byB0aGUgYMm1ybVkZWZpbmVOZ01vZHVsZSgpYCBjYWxsLiBUaGUgSklUIGNvbXBpbGF0aW9uIHVzZXMgdGhpcy5cbiAgaWYgKGVtaXRJbmxpbmUpIHtcbiAgICBpZiAoZGVjbGFyYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZWNsYXJhdGlvbnMnLCByZWZzVG9BcnJheShkZWNsYXJhdGlvbnMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gICAgfVxuXG4gICAgaWYgKGltcG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ltcG9ydHMnLCByZWZzVG9BcnJheShpbXBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscykpO1xuICAgIH1cblxuICAgIGlmIChleHBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRzJywgcmVmc1RvQXJyYXkoZXhwb3J0cywgY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBub3QgZW1pdHRpbmcgaW5saW5lLCB0aGUgc2NvcGUgaW5mb3JtYXRpb24gaXMgbm90IHBhc3NlZCBpbnRvIGDJtcm1ZGVmaW5lTmdNb2R1bGVgIGFzIGl0IHdvdWxkXG4gIC8vIHByZXZlbnQgdHJlZS1zaGFraW5nIG9mIHRoZSBkZWNsYXJhdGlvbnMsIGltcG9ydHMgYW5kIGV4cG9ydHMgcmVmZXJlbmNlcy5cbiAgZWxzZSB7XG4gICAgY29uc3Qgc2V0TmdNb2R1bGVTY29wZUNhbGwgPSBnZW5lcmF0ZVNldE5nTW9kdWxlU2NvcGVDYWxsKG1ldGEpO1xuICAgIGlmIChzZXROZ01vZHVsZVNjb3BlQ2FsbCAhPT0gbnVsbCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHNldE5nTW9kdWxlU2NvcGVDYWxsKTtcbiAgICB9XG4gIH1cblxuICBpZiAoc2NoZW1hcyAhPT0gbnVsbCAmJiBzY2hlbWFzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2NoZW1hcycsIG8ubGl0ZXJhbEFycihzY2hlbWFzLm1hcChyZWYgPT4gcmVmLnZhbHVlKSkpO1xuICB9XG5cbiAgaWYgKGlkICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lkJywgaWQpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICBvLmltcG9ydEV4cHIoUjMuZGVmaW5lTmdNb2R1bGUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVOZ01vZHVsZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgaW4gSklUIG1vZGUgdG8gZ2VuZXJhdGUgdGhlIGNhbGwgdG8gYMm1ybVkZWZpbmVOZ01vZHVsZSgpYCBmcm9tIGEgY2FsbCB0b1xuICogYMm1ybVuZ0RlY2xhcmVOZ01vZHVsZSgpYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVOZ01vZHVsZURlY2xhcmF0aW9uRXhwcmVzc2lvbihtZXRhOiBSM0RlY2xhcmVOZ01vZHVsZUZhY2FkZSk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM05nTW9kdWxlRGVmTWFwPigpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG5ldyBvLldyYXBwZWROb2RlRXhwcihtZXRhLnR5cGUpKTtcbiAgaWYgKG1ldGEuYm9vdHN0cmFwICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnYm9vdHN0cmFwJywgbmV3IG8uV3JhcHBlZE5vZGVFeHByKG1ldGEuYm9vdHN0cmFwKSk7XG4gIH1cbiAgaWYgKG1ldGEuZGVjbGFyYXRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbGFyYXRpb25zJywgbmV3IG8uV3JhcHBlZE5vZGVFeHByKG1ldGEuZGVjbGFyYXRpb25zKSk7XG4gIH1cbiAgaWYgKG1ldGEuaW1wb3J0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ltcG9ydHMnLCBuZXcgby5XcmFwcGVkTm9kZUV4cHIobWV0YS5pbXBvcnRzKSk7XG4gIH1cbiAgaWYgKG1ldGEuZXhwb3J0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydHMnLCBuZXcgby5XcmFwcGVkTm9kZUV4cHIobWV0YS5leHBvcnRzKSk7XG4gIH1cbiAgaWYgKG1ldGEuc2NoZW1hcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NjaGVtYXMnLCBuZXcgby5XcmFwcGVkTm9kZUV4cHIobWV0YS5zY2hlbWFzKSk7XG4gIH1cbiAgaWYgKG1ldGEuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpZCcsIG5ldyBvLldyYXBwZWROb2RlRXhwcihtZXRhLmlkKSk7XG4gIH1cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVOZ01vZHVsZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVOZ01vZHVsZVR5cGUoXG4gICAge3R5cGU6IG1vZHVsZVR5cGUsIGRlY2xhcmF0aW9ucywgaW1wb3J0cywgZXhwb3J0c306IFIzTmdNb2R1bGVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvblR5cGUge1xuICByZXR1cm4gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLk5nTW9kdWxlRGVjbGFyYXRpb24sIFtcbiAgICBuZXcgby5FeHByZXNzaW9uVHlwZShtb2R1bGVUeXBlLnR5cGUpLCB0dXBsZVR5cGVPZihkZWNsYXJhdGlvbnMpLCB0dXBsZVR5cGVPZihpbXBvcnRzKSxcbiAgICB0dXBsZVR5cGVPZihleHBvcnRzKVxuICBdKSk7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgZnVuY3Rpb24gY2FsbCB0byBgybXJtXNldE5nTW9kdWxlU2NvcGVgIHdpdGggYWxsIG5lY2Vzc2FyeSBpbmZvcm1hdGlvbiBzbyB0aGF0IHRoZVxuICogdHJhbnNpdGl2ZSBtb2R1bGUgc2NvcGUgY2FuIGJlIGNvbXB1dGVkIGR1cmluZyBydW50aW1lIGluIEpJVCBtb2RlLiBUaGlzIGNhbGwgaXMgbWFya2VkIHB1cmVcbiAqIHN1Y2ggdGhhdCB0aGUgcmVmZXJlbmNlcyB0byBkZWNsYXJhdGlvbnMsIGltcG9ydHMgYW5kIGV4cG9ydHMgbWF5IGJlIGVsaWRlZCBjYXVzaW5nIHRoZXNlXG4gKiBzeW1ib2xzIHRvIGJlY29tZSB0cmVlLXNoYWtlYWJsZS5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVTZXROZ01vZHVsZVNjb3BlQ2FsbChtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEpOiBvLlN0YXRlbWVudHxudWxsIHtcbiAgY29uc3Qge2FkamFjZW50VHlwZTogbW9kdWxlVHlwZSwgZGVjbGFyYXRpb25zLCBpbXBvcnRzLCBleHBvcnRzLCBjb250YWluc0ZvcndhcmREZWNsc30gPSBtZXRhO1xuXG4gIGNvbnN0IHNjb3BlTWFwID0gbmV3IERlZmluaXRpb25NYXA8XG4gICAgICB7ZGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb24sIGltcG9ydHM6IG8uRXhwcmVzc2lvbiwgZXhwb3J0czogby5FeHByZXNzaW9ufT4oKTtcblxuICBpZiAoZGVjbGFyYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICBzY29wZU1hcC5zZXQoJ2RlY2xhcmF0aW9ucycsIHJlZnNUb0FycmF5KGRlY2xhcmF0aW9ucywgY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgfVxuXG4gIGlmIChpbXBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICBzY29wZU1hcC5zZXQoJ2ltcG9ydHMnLCByZWZzVG9BcnJheShpbXBvcnRzLCBjb250YWluc0ZvcndhcmREZWNscykpO1xuICB9XG5cbiAgaWYgKGV4cG9ydHMubGVuZ3RoID4gMCkge1xuICAgIHNjb3BlTWFwLnNldCgnZXhwb3J0cycsIHJlZnNUb0FycmF5KGV4cG9ydHMsIGNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gIH1cblxuICBpZiAoT2JqZWN0LmtleXMoc2NvcGVNYXAudmFsdWVzKS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIHNldE5nTW9kdWxlU2NvcGUoLi4uKVxuICBjb25zdCBmbkNhbGwgPSBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAvKiBmbiAqLyBvLmltcG9ydEV4cHIoUjMuc2V0TmdNb2R1bGVTY29wZSksXG4gICAgICAvKiBhcmdzICovW21vZHVsZVR5cGUsIHNjb3BlTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgLy8gKG5nSml0TW9kZSBndWFyZCkgJiYgc2V0TmdNb2R1bGVTY29wZSguLi4pXG4gIGNvbnN0IGd1YXJkZWRDYWxsID0gaml0T25seUd1YXJkZWRFeHByZXNzaW9uKGZuQ2FsbCk7XG5cbiAgLy8gZnVuY3Rpb24oKSB7IChuZ0ppdE1vZGUgZ3VhcmQpICYmIHNldE5nTW9kdWxlU2NvcGUoLi4uKTsgfVxuICBjb25zdCBpaWZlID0gbmV3IG8uRnVuY3Rpb25FeHByKFxuICAgICAgLyogcGFyYW1zICovW10sXG4gICAgICAvKiBzdGF0ZW1lbnRzICovW2d1YXJkZWRDYWxsLnRvU3RtdCgpXSk7XG5cbiAgLy8gKGZ1bmN0aW9uKCkgeyAobmdKaXRNb2RlIGd1YXJkKSAmJiBzZXROZ01vZHVsZVNjb3BlKC4uLik7IH0pKClcbiAgY29uc3QgaWlmZUNhbGwgPSBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAvKiBmbiAqLyBpaWZlLFxuICAgICAgLyogYXJncyAqL1tdKTtcblxuICByZXR1cm4gaWlmZUNhbGwudG9TdG10KCk7XG59XG5cbmZ1bmN0aW9uIHR1cGxlVHlwZU9mKGV4cDogUjNSZWZlcmVuY2VbXSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVzID0gZXhwLm1hcChyZWYgPT4gby50eXBlb2ZFeHByKHJlZi50eXBlKSk7XG4gIHJldHVybiBleHAubGVuZ3RoID4gMCA/IG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKHR5cGVzKSkgOiBvLk5PTkVfVFlQRTtcbn1cbiJdfQ==