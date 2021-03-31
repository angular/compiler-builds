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
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal('12.0.0-next.6+9.sha-da22d49'));
        // e.g. `type: MyDirective`
        definitionMap.set('type', meta.internalType);
        // e.g. `selector: 'some-dir'`
        if (meta.selector !== null) {
            definitionMap.set('selector', o.literal(meta.selector));
        }
        definitionMap.set('inputs', util_1.conditionallyCreateMapObjectLiteral(meta.inputs, true));
        definitionMap.set('outputs', util_1.conditionallyCreateMapObjectLiteral(meta.outputs));
        definitionMap.set('host', compileHostMetadata(meta.host));
        definitionMap.set('providers', meta.providers);
        if (meta.queries.length > 0) {
            definitionMap.set('queries', o.literalArr(meta.queries.map(compileQuery)));
        }
        if (meta.viewQueries.length > 0) {
            definitionMap.set('viewQueries', o.literalArr(meta.viewQueries.map(compileQuery)));
        }
        if (meta.exportAs !== null) {
            definitionMap.set('exportAs', util_1.asLiteral(meta.exportAs));
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
        meta.set('predicate', Array.isArray(query.predicate) ? util_1.asLiteral(query.predicate) : query.predicate);
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
        hostMetadata.set('attributes', util_2.toOptionalLiteralMap(meta.attributes, function (expression) { return expression; }));
        hostMetadata.set('listeners', util_2.toOptionalLiteralMap(meta.listeners, o.literal));
        hostMetadata.set('properties', util_2.toOptionalLiteralMap(meta.properties, o.literal));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBQUE7Ozs7OztPQU1HO0lBQ0gsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUdwRCx3RUFBcUQ7SUFDckQsZ0VBQTJGO0lBRTNGLG1FQUE0QztJQUc1Qzs7T0FFRztJQUNILFNBQWdCLG1DQUFtQyxDQUFDLElBQXlCO1FBRTNFLElBQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXpELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztJQUM1QyxDQUFDO0lBUkQsa0ZBUUM7SUFFRDs7O09BR0c7SUFDSCxTQUFnQiw0QkFBNEIsQ0FBQyxJQUF5QjtRQUVwRSxJQUFNLGFBQWEsR0FBRyxJQUFJLG9CQUFhLEVBQThCLENBQUM7UUFFdEUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFFN0QsMkJBQTJCO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU3Qyw4QkFBOEI7UUFDOUIsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUMxQixh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RjtRQUNELElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRTtZQUNwQyxZQUFZLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDakY7UUFFRCxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNsQyxPQUFPLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUNwQzthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlVHlwZX0gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIERlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5pbXBvcnQge1IzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge3RvT3B0aW9uYWxMaXRlcmFsTWFwfSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTpcbiAgICBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBkaXJlY3RpdmUgaW50byBhIGBEZWZpbml0aW9uTWFwYC4gVGhpcyBhbGxvd3MgZm9yIHJldXNpbmdcbiAqIHRoaXMgbG9naWMgZm9yIGNvbXBvbmVudHMsIGFzIHRoZXkgZXh0ZW5kIHRoZSBkaXJlY3RpdmUgbWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPigpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3I6ICdzb21lLWRpcidgXG4gIGlmIChtZXRhLnNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9yJywgby5saXRlcmFsKG1ldGEuc2VsZWN0b3IpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdob3N0JywgY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhLmhvc3QpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZXJzJywgbWV0YS5wcm92aWRlcnMpO1xuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdxdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEucXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS52aWV3UXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBhc0xpdGVyYWwobWV0YS5leHBvcnRBcykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNJbmhlcml0YW5jZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc09uQ2hhbmdlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBtZXRhZGF0YSBvZiBhIHNpbmdsZSBxdWVyeSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGJ5IGBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVF1ZXJ5KHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgbWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGE+KCk7XG4gIG1ldGEuc2V0KCdwcm9wZXJ0eU5hbWUnLCBvLmxpdGVyYWwocXVlcnkucHJvcGVydHlOYW1lKSk7XG4gIGlmIChxdWVyeS5maXJzdCkge1xuICAgIG1ldGEuc2V0KCdmaXJzdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoXG4gICAgICAncHJlZGljYXRlJywgQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpID8gYXNMaXRlcmFsKHF1ZXJ5LnByZWRpY2F0ZSkgOiBxdWVyeS5wcmVkaWNhdGUpO1xuICBpZiAoIXF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5KSB7XG4gICAgLy8gYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBpcyBzcGVjaWFsIGJlY2F1c2Ugd2UgZXhwZWN0IGl0IHRvIGJlIGB0cnVlYC5cbiAgICAvLyBUaGVyZWZvcmUgd2UgZXhwbGljaXRseSBlbWl0IHRoZSBmaWVsZCwgYW5kIGV4cGxpY2l0bHkgcGxhY2UgaXQgb25seSB3aGVuIGl0J3MgYGZhbHNlYC5cbiAgICBtZXRhLnNldCgnZW1pdERpc3RpbmN0Q2hhbmdlc09ubHknLCBvLmxpdGVyYWwoZmFsc2UpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGUgbGlua2VyIHdpbGwgYXNzdW1lIHRoYXQgYW4gYWJzZW50IGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgZmxhZyBpcyBieSBkZWZhdWx0IGB0cnVlYC5cbiAgfVxuICBpZiAocXVlcnkuZGVzY2VuZGFudHMpIHtcbiAgICBtZXRhLnNldCgnZGVzY2VuZGFudHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KCdyZWFkJywgcXVlcnkucmVhZCk7XG4gIGlmIChxdWVyeS5zdGF0aWMpIHtcbiAgICBtZXRhLnNldCgnc3RhdGljJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICByZXR1cm4gbWV0YS50b0xpdGVyYWxNYXAoKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgaG9zdCBtZXRhZGF0YSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGluIGBSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddYFxuICovXG5mdW5jdGlvbiBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGE6IFIzSG9zdE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgY29uc3QgaG9zdE1ldGFkYXRhID0gbmV3IERlZmluaXRpb25NYXA8Tm9uTnVsbGFibGU8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3QnXT4+KCk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2F0dHJpYnV0ZXMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmF0dHJpYnV0ZXMsIGV4cHJlc3Npb24gPT4gZXhwcmVzc2lvbikpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdsaXN0ZW5lcnMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmxpc3RlbmVycywgby5saXRlcmFsKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ3Byb3BlcnRpZXMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLnByb3BlcnRpZXMsIG8ubGl0ZXJhbCkpO1xuXG4gIGlmIChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikge1xuICAgIGhvc3RNZXRhZGF0YS5zZXQoJ3N0eWxlQXR0cmlidXRlJywgby5saXRlcmFsKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSk7XG4gIH1cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnY2xhc3NBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpKTtcbiAgfVxuXG4gIGlmIChob3N0TWV0YWRhdGEudmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gaG9zdE1ldGFkYXRhLnRvTGl0ZXJhbE1hcCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iXX0=