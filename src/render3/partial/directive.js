(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/directive", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/util"], factory);
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
    var compiler_1 = require("@angular/compiler/src/render3/view/compiler");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    var util_2 = require("@angular/compiler/src/render3/partial/util");
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
        var type = (0, compiler_1.createDirectiveType)(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareDirectiveFromMetadata = compileDeclareDirectiveFromMetadata;
    /**
     * Gathers the declaration fields for a directive into a `DefinitionMap`. This allows for reusing
     * this logic for components, as they extend the directive metadata.
     */
    function createDirectiveDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
        definitionMap.set('version', o.literal('13.0.0-next.8+30.sha-ab3de40.with-local-changes'));
        // e.g. `type: MyDirective`
        definitionMap.set('type', meta.internalType);
        // e.g. `selector: 'some-dir'`
        if (meta.selector !== null) {
            definitionMap.set('selector', o.literal(meta.selector));
        }
        definitionMap.set('inputs', (0, util_1.conditionallyCreateMapObjectLiteral)(meta.inputs, true));
        definitionMap.set('outputs', (0, util_1.conditionallyCreateMapObjectLiteral)(meta.outputs));
        definitionMap.set('host', compileHostMetadata(meta.host));
        definitionMap.set('providers', meta.providers);
        if (meta.queries.length > 0) {
            definitionMap.set('queries', o.literalArr(meta.queries.map(compileQuery)));
        }
        if (meta.viewQueries.length > 0) {
            definitionMap.set('viewQueries', o.literalArr(meta.viewQueries.map(compileQuery)));
        }
        if (meta.exportAs !== null) {
            definitionMap.set('exportAs', (0, util_1.asLiteral)(meta.exportAs));
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
        var meta = new util_1.DefinitionMap();
        meta.set('propertyName', o.literal(query.propertyName));
        if (query.first) {
            meta.set('first', o.literal(true));
        }
        meta.set('predicate', Array.isArray(query.predicate) ? (0, util_1.asLiteral)(query.predicate) : query.predicate);
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
        var hostMetadata = new util_1.DefinitionMap();
        hostMetadata.set('attributes', (0, util_2.toOptionalLiteralMap)(meta.attributes, function (expression) { return expression; }));
        hostMetadata.set('listeners', (0, util_2.toOptionalLiteralMap)(meta.listeners, o.literal));
        hostMetadata.set('properties', (0, util_2.toOptionalLiteralMap)(meta.properties, o.literal));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBQUE7Ozs7OztPQU1HO0lBQ0gsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUdwRCx3RUFBcUQ7SUFDckQsZ0VBQTJGO0lBRTNGLG1FQUE0QztJQUU1Qzs7Ozs7O09BTUc7SUFDSCxJQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztJQUVoRDs7T0FFRztJQUNILFNBQWdCLG1DQUFtQyxDQUFDLElBQXlCO1FBRTNFLElBQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXpELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsSUFBQSw4QkFBbUIsRUFBQyxJQUFJLENBQUMsQ0FBQztRQUV2QyxPQUFPLEVBQUMsVUFBVSxZQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBQyxDQUFDO0lBQzVDLENBQUM7SUFSRCxrRkFRQztJQUVEOzs7T0FHRztJQUNILFNBQWdCLDRCQUE0QixDQUFDLElBQXlCO1FBRXBFLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBOEIsQ0FBQztRQUV0RSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUMzRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUU3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QUFPLENBQUMsQ0FBQyxDQUFDO1FBRWpGLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRTtZQUNwQyxZQUFZLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDakY7UUFDRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUU7WUFDcEMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQ2pGO1FBRUQsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDcEM7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb259IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuLi92aWV3L2FwaSc7XG5pbXBvcnQge2NyZWF0ZURpcmVjdGl2ZVR5cGV9IGZyb20gJy4uL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuaW1wb3J0IHtSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YSwgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbE1hcH0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBFdmVyeSB0aW1lIHdlIG1ha2UgYSBicmVha2luZyBjaGFuZ2UgdG8gdGhlIGRlY2xhcmF0aW9uIGludGVyZmFjZSBvciBwYXJ0aWFsLWxpbmtlciBiZWhhdmlvciwgd2VcbiAqIG11c3QgdXBkYXRlIHRoaXMgY29uc3RhbnQgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb20gaW5jb3JyZWN0bHkgcHJvY2Vzc2luZyB0aGVcbiAqIGRlY2xhcmF0aW9uLlxuICpcbiAqIERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmNvbnN0IE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTiA9ICcxMi4wLjAnO1xuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6XG4gICAgUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlRGlyZWN0aXZlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgZGlyZWN0aXZlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuIFRoaXMgYWxsb3dzIGZvciByZXVzaW5nXG4gKiB0aGlzIGxvZ2ljIGZvciBjb21wb25lbnRzLCBhcyB0aGV5IGV4dGVuZCB0aGUgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YT4oKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEuaW50ZXJuYWxUeXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcjogJ3NvbWUtZGlyJ2BcbiAgaWYgKG1ldGEuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwobWV0YS5zZWxlY3RvcikpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3QnLCBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGEuaG9zdCkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdwcm92aWRlcnMnLCBtZXRhLnByb3ZpZGVycyk7XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS5xdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnZpZXdRdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIGFzTGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc0luaGVyaXRhbmNlJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzT25DaGFuZ2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIG1ldGFkYXRhIG9mIGEgc2luZ2xlIHF1ZXJ5IGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogYnkgYFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBjb21waWxlUXVlcnkocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBtZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlUXVlcnlNZXRhZGF0YT4oKTtcbiAgbWV0YS5zZXQoJ3Byb3BlcnR5TmFtZScsIG8ubGl0ZXJhbChxdWVyeS5wcm9wZXJ0eU5hbWUpKTtcbiAgaWYgKHF1ZXJ5LmZpcnN0KSB7XG4gICAgbWV0YS5zZXQoJ2ZpcnN0Jywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldChcbiAgICAgICdwcmVkaWNhdGUnLCBBcnJheS5pc0FycmF5KHF1ZXJ5LnByZWRpY2F0ZSkgPyBhc0xpdGVyYWwocXVlcnkucHJlZGljYXRlKSA6IHF1ZXJ5LnByZWRpY2F0ZSk7XG4gIGlmICghcXVlcnkuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkpIHtcbiAgICAvLyBgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlgIGlzIHNwZWNpYWwgYmVjYXVzZSB3ZSBleHBlY3QgaXQgdG8gYmUgYHRydWVgLlxuICAgIC8vIFRoZXJlZm9yZSB3ZSBleHBsaWNpdGx5IGVtaXQgdGhlIGZpZWxkLCBhbmQgZXhwbGljaXRseSBwbGFjZSBpdCBvbmx5IHdoZW4gaXQncyBgZmFsc2VgLlxuICAgIG1ldGEuc2V0KCdlbWl0RGlzdGluY3RDaGFuZ2VzT25seScsIG8ubGl0ZXJhbChmYWxzZSkpO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoZSBsaW5rZXIgd2lsbCBhc3N1bWUgdGhhdCBhbiBhYnNlbnQgYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBmbGFnIGlzIGJ5IGRlZmF1bHQgYHRydWVgLlxuICB9XG4gIGlmIChxdWVyeS5kZXNjZW5kYW50cykge1xuICAgIG1ldGEuc2V0KCdkZXNjZW5kYW50cycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoJ3JlYWQnLCBxdWVyeS5yZWFkKTtcbiAgaWYgKHF1ZXJ5LnN0YXRpYykge1xuICAgIG1ldGEuc2V0KCdzdGF0aWMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBtZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBob3N0IG1ldGFkYXRhIGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogaW4gYFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J11gXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YTogUjNIb3N0TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBjb25zdCBob3N0TWV0YWRhdGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxOb25OdWxsYWJsZTxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddPj4oKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnYXR0cmlidXRlcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEuYXR0cmlidXRlcywgZXhwcmVzc2lvbiA9PiBleHByZXNzaW9uKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2xpc3RlbmVycycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEubGlzdGVuZXJzLCBvLmxpdGVyYWwpKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgncHJvcGVydGllcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEucHJvcGVydGllcywgby5saXRlcmFsKSk7XG5cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnc3R5bGVBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpKTtcbiAgfVxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdjbGFzc0F0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikpO1xuICB9XG5cbiAgaWYgKGhvc3RNZXRhZGF0YS52YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBob3N0TWV0YWRhdGEudG9MaXRlcmFsTWFwKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdfQ==