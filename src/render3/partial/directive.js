(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/directive", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createDirectiveDefinitionMap = exports.compileDeclareDirectiveFromMetadata = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/util");
    var compiler_1 = require("@angular/compiler/src/render3/view/compiler");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    var util_3 = require("@angular/compiler/src/render3/partial/util");
    /**
     * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
     * must update this constant to prevent old partial-linkers from incorrectly processing the
     * declaration.
     *
     * Do not include any prerelease in these versions as they are ignored.
     */
    var MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
    /**
     * Compile a directive declaration defined by the `R3DirectiveMetadata`.
     */
    function compileDeclareDirectiveFromMetadata(meta) {
        var definitionMap = createDirectiveDefinitionMap(meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareDirective).callFn([definitionMap.toLiteralMap()]);
        var type = compiler_1.createDirectiveType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareDirectiveFromMetadata = compileDeclareDirectiveFromMetadata;
    /**
     * Gathers the declaration fields for a directive into a `DefinitionMap`. This allows for reusing
     * this logic for components, as they extend the directive metadata.
     */
    function createDirectiveDefinitionMap(meta) {
        var definitionMap = new util_2.DefinitionMap();
        definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
        definitionMap.set('version', o.literal('12.2.14+3.sha-9616b08.with-local-changes'));
        // e.g. `type: MyDirective`
        definitionMap.set('type', meta.internalType);
        // e.g. `selector: 'some-dir'`
        if (meta.selector !== null) {
            definitionMap.set('selector', o.literal(meta.selector));
        }
        definitionMap.set('inputs', util_2.conditionallyCreateMapObjectLiteral(meta.inputs, true));
        definitionMap.set('outputs', util_2.conditionallyCreateMapObjectLiteral(meta.outputs));
        definitionMap.set('host', compileHostMetadata(meta.host));
        definitionMap.set('providers', meta.providers);
        if (meta.queries.length > 0) {
            definitionMap.set('queries', o.literalArr(meta.queries.map(compileQuery)));
        }
        if (meta.viewQueries.length > 0) {
            definitionMap.set('viewQueries', o.literalArr(meta.viewQueries.map(compileQuery)));
        }
        if (meta.exportAs !== null) {
            definitionMap.set('exportAs', util_2.asLiteral(meta.exportAs));
        }
        if (meta.usesInheritance) {
            definitionMap.set('usesInheritance', o.literal(true));
        }
        if (meta.lifecycle.usesOnChanges) {
            definitionMap.set('usesOnChanges', o.literal(true));
        }
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        return definitionMap;
    }
    exports.createDirectiveDefinitionMap = createDirectiveDefinitionMap;
    /**
     * Compiles the metadata of a single query into its partial declaration form as declared
     * by `R3DeclareQueryMetadata`.
     */
    function compileQuery(query) {
        var meta = new util_2.DefinitionMap();
        meta.set('propertyName', o.literal(query.propertyName));
        if (query.first) {
            meta.set('first', o.literal(true));
        }
        meta.set('predicate', Array.isArray(query.predicate) ? util_2.asLiteral(query.predicate) :
            util_1.convertFromMaybeForwardRefExpression(query.predicate));
        if (!query.emitDistinctChangesOnly) {
            // `emitDistinctChangesOnly` is special because we expect it to be `true`.
            // Therefore we explicitly emit the field, and explicitly place it only when it's `false`.
            meta.set('emitDistinctChangesOnly', o.literal(false));
        }
        else {
            // The linker will assume that an absent `emitDistinctChangesOnly` flag is by default `true`.
        }
        if (query.descendants) {
            meta.set('descendants', o.literal(true));
        }
        meta.set('read', query.read);
        if (query.static) {
            meta.set('static', o.literal(true));
        }
        return meta.toLiteralMap();
    }
    /**
     * Compiles the host metadata into its partial declaration form as declared
     * in `R3DeclareDirectiveMetadata['host']`
     */
    function compileHostMetadata(meta) {
        var hostMetadata = new util_2.DefinitionMap();
        hostMetadata.set('attributes', util_3.toOptionalLiteralMap(meta.attributes, function (expression) { return expression; }));
        hostMetadata.set('listeners', util_3.toOptionalLiteralMap(meta.listeners, o.literal));
        hostMetadata.set('properties', util_3.toOptionalLiteralMap(meta.properties, o.literal));
        if (meta.specialAttributes.styleAttr) {
            hostMetadata.set('styleAttribute', o.literal(meta.specialAttributes.styleAttr));
        }
        if (meta.specialAttributes.classAttr) {
            hostMetadata.set('classAttribute', o.literal(meta.specialAttributes.classAttr));
        }
        if (hostMetadata.values.length > 0) {
            return hostMetadata.toLiteralMap();
        }
        else {
            return null;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBQUE7Ozs7OztPQU1HO0lBQ0gsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUNwRCwyREFBbUY7SUFFbkYsd0VBQXFEO0lBQ3JELGdFQUEyRjtJQUUzRixtRUFBNEM7SUFFNUM7Ozs7OztPQU1HO0lBQ0gsSUFBTSw4QkFBOEIsR0FBRyxRQUFRLENBQUM7SUFFaEQ7O09BRUc7SUFDSCxTQUFnQixtQ0FBbUMsQ0FBQyxJQUF5QjtRQUUzRSxJQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV6RCxJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVGLElBQU0sSUFBSSxHQUFHLDhCQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7SUFDNUMsQ0FBQztJQVJELGtGQVFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsNEJBQTRCLENBQUMsSUFBeUI7UUFFcEUsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUE4QixDQUFDO1FBRXRFLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO1FBQzNFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxD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Q0FBQyxDQUFDO1FBRWpGLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRTtZQUNwQyxZQUFZLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDakY7UUFDRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUU7WUFDcEMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQ2pGO1FBRUQsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDcEM7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLCBSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlVHlwZX0gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIERlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5pbXBvcnQge1IzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge3RvT3B0aW9uYWxMaXRlcmFsTWFwfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzEyLjAuMCc7XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTpcbiAgICBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBkaXJlY3RpdmUgaW50byBhIGBEZWZpbml0aW9uTWFwYC4gVGhpcyBhbGxvd3MgZm9yIHJldXNpbmdcbiAqIHRoaXMgbG9naWMgZm9yIGNvbXBvbmVudHMsIGFzIHRoZXkgZXh0ZW5kIHRoZSBkaXJlY3RpdmUgbWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPigpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdtaW5WZXJzaW9uJywgby5saXRlcmFsKE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTikpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yOiAnc29tZS1kaXInYFxuICBpZiAobWV0YS5zZWxlY3RvciAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChtZXRhLnNlbGVjdG9yKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdCcsIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YS5ob3N0KSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3Byb3ZpZGVycycsIG1ldGEucHJvdmlkZXJzKTtcblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnF1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEudmlld1F1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgYXNMaXRlcmFsKG1ldGEuZXhwb3J0QXMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnVzZXNJbmhlcml0YW5jZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzSW5oZXJpdGFuY2UnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChtZXRhLmxpZmVjeWNsZS51c2VzT25DaGFuZ2VzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNPbkNoYW5nZXMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgbWV0YWRhdGEgb2YgYSBzaW5nbGUgcXVlcnkgaW50byBpdHMgcGFydGlhbCBkZWNsYXJhdGlvbiBmb3JtIGFzIGRlY2xhcmVkXG4gKiBieSBgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVRdWVyeShxdWVyeTogUjNRdWVyeU1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IG1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVRdWVyeU1ldGFkYXRhPigpO1xuICBtZXRhLnNldCgncHJvcGVydHlOYW1lJywgby5saXRlcmFsKHF1ZXJ5LnByb3BlcnR5TmFtZSkpO1xuICBpZiAocXVlcnkuZmlyc3QpIHtcbiAgICBtZXRhLnNldCgnZmlyc3QnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KFxuICAgICAgJ3ByZWRpY2F0ZScsXG4gICAgICBBcnJheS5pc0FycmF5KHF1ZXJ5LnByZWRpY2F0ZSkgPyBhc0xpdGVyYWwocXVlcnkucHJlZGljYXRlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24ocXVlcnkucHJlZGljYXRlKSk7XG4gIGlmICghcXVlcnkuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkpIHtcbiAgICAvLyBgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlgIGlzIHNwZWNpYWwgYmVjYXVzZSB3ZSBleHBlY3QgaXQgdG8gYmUgYHRydWVgLlxuICAgIC8vIFRoZXJlZm9yZSB3ZSBleHBsaWNpdGx5IGVtaXQgdGhlIGZpZWxkLCBhbmQgZXhwbGljaXRseSBwbGFjZSBpdCBvbmx5IHdoZW4gaXQncyBgZmFsc2VgLlxuICAgIG1ldGEuc2V0KCdlbWl0RGlzdGluY3RDaGFuZ2VzT25seScsIG8ubGl0ZXJhbChmYWxzZSkpO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoZSBsaW5rZXIgd2lsbCBhc3N1bWUgdGhhdCBhbiBhYnNlbnQgYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBmbGFnIGlzIGJ5IGRlZmF1bHQgYHRydWVgLlxuICB9XG4gIGlmIChxdWVyeS5kZXNjZW5kYW50cykge1xuICAgIG1ldGEuc2V0KCdkZXNjZW5kYW50cycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoJ3JlYWQnLCBxdWVyeS5yZWFkKTtcbiAgaWYgKHF1ZXJ5LnN0YXRpYykge1xuICAgIG1ldGEuc2V0KCdzdGF0aWMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBtZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBob3N0IG1ldGFkYXRhIGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogaW4gYFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J11gXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YTogUjNIb3N0TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBjb25zdCBob3N0TWV0YWRhdGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxOb25OdWxsYWJsZTxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddPj4oKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnYXR0cmlidXRlcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEuYXR0cmlidXRlcywgZXhwcmVzc2lvbiA9PiBleHByZXNzaW9uKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2xpc3RlbmVycycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEubGlzdGVuZXJzLCBvLmxpdGVyYWwpKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgncHJvcGVydGllcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEucHJvcGVydGllcywgby5saXRlcmFsKSk7XG5cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnc3R5bGVBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpKTtcbiAgfVxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdjbGFzc0F0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikpO1xuICB9XG5cbiAgaWYgKGhvc3RNZXRhZGF0YS52YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBob3N0TWV0YWRhdGEudG9MaXRlcmFsTWFwKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdfQ==