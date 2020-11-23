(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/directive", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/util"], factory);
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
    /**
     * Compile a directive declaration defined by the `R3DirectiveMetadata`.
     */
    function compileDeclareDirectiveFromMetadata(meta) {
        var definitionMap = createDirectiveDefinitionMap(meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareDirective).callFn([definitionMap.toLiteralMap()]);
        var typeParams = compiler_1.createDirectiveTypeParams(meta);
        var type = o.expressionType(o.importExpr(r3_identifiers_1.Identifiers.DirectiveDefWithMeta, typeParams));
        return { expression: expression, type: type };
    }
    exports.compileDeclareDirectiveFromMetadata = compileDeclareDirectiveFromMetadata;
    /**
     * Gathers the declaration fields for a directive into a `DefinitionMap`. This allows for reusing
     * this logic for components, as they extend the directive metadata.
     */
    function createDirectiveDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal(1));
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
        hostMetadata.set('attributes', toOptionalLiteralMap(meta.attributes, function (expression) { return expression; }));
        hostMetadata.set('listeners', toOptionalLiteralMap(meta.listeners, o.literal));
        hostMetadata.set('properties', toOptionalLiteralMap(meta.properties, o.literal));
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
    /**
     * Creates an object literal expression from the given object, mapping all values to an expression
     * using the provided mapping function. If the object has no keys, then null is returned.
     *
     * @param object The object to transfer into an object literal expression.
     * @param mapper The logic to use for creating an expression for the object's values.
     * @returns An object literal expression representing `object`, or null if `object` does not have
     * any keys.
     */
    function toOptionalLiteralMap(object, mapper) {
        var entries = Object.keys(object).map(function (key) {
            var value = object[key];
            return { key: key, value: mapper(value), quoted: true };
        });
        if (entries.length > 0) {
            return o.literalMap(entries);
        }
        else {
            return null;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBQUE7Ozs7OztPQU1HO0lBQ0gsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUVwRCx3RUFBMkQ7SUFDM0QsZ0VBQTJGO0lBRzNGOztPQUVHO0lBQ0gsU0FBZ0IsbUNBQW1DLENBQUMsSUFBeUI7UUFDM0UsSUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFekQsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU1RixJQUFNLFVBQVUsR0FBRyxvQ0FBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxJQUFNLElBQUksR0FBRyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxvQkFBb0IsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRWpGLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBQyxDQUFDO0lBQzVCLENBQUM7SUFURCxrRkFTQztJQUVEOzs7T0FHRztJQUNILFNBQWdCLDRCQUE0QixDQUFDLElBQXlCO1FBQ3BFLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBRSxDQUFDO1FBRTFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzQywyQkFBMkI7UUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FB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QUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQ2pGO1FBRUQsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDcEM7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFDSCxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCxTQUFTLG9CQUFvQixDQUN6QixNQUEwQixFQUFFLE1BQWtDO1FBQ2hFLElBQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRztZQUN6QyxJQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUIsT0FBTyxFQUFDLEdBQUcsS0FBQSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ25ELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN0QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDOUI7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlVHlwZVBhcmFtc30gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIERlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBSM0RpcmVjdGl2ZURlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgY29uc3QgdHlwZVBhcmFtcyA9IGNyZWF0ZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YSk7XG4gIGNvbnN0IHR5cGUgPSBvLmV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5EaXJlY3RpdmVEZWZXaXRoTWV0YSwgdHlwZVBhcmFtcykpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIGRpcmVjdGl2ZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLiBUaGlzIGFsbG93cyBmb3IgcmV1c2luZ1xuICogdGhpcyBsb2dpYyBmb3IgY29tcG9uZW50cywgYXMgdGhleSBleHRlbmQgdGhlIGRpcmVjdGl2ZSBtZXRhZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IERlZmluaXRpb25NYXAge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgxKSk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yOiAnc29tZS1kaXInYFxuICBpZiAobWV0YS5zZWxlY3RvciAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChtZXRhLnNlbGVjdG9yKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdCcsIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YS5ob3N0KSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3Byb3ZpZGVycycsIG1ldGEucHJvdmlkZXJzKTtcblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnF1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEudmlld1F1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgYXNMaXRlcmFsKG1ldGEuZXhwb3J0QXMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnVzZXNJbmhlcml0YW5jZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzSW5oZXJpdGFuY2UnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChtZXRhLmxpZmVjeWNsZS51c2VzT25DaGFuZ2VzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNPbkNoYW5nZXMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgbWV0YWRhdGEgb2YgYSBzaW5nbGUgcXVlcnkgaW50byBpdHMgcGFydGlhbCBkZWNsYXJhdGlvbiBmb3JtIGFzIGRlY2xhcmVkXG4gKiBieSBgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVRdWVyeShxdWVyeTogUjNRdWVyeU1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IG1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBtZXRhLnNldCgncHJvcGVydHlOYW1lJywgby5saXRlcmFsKHF1ZXJ5LnByb3BlcnR5TmFtZSkpO1xuICBpZiAocXVlcnkuZmlyc3QpIHtcbiAgICBtZXRhLnNldCgnZmlyc3QnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KFxuICAgICAgJ3ByZWRpY2F0ZScsIEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKSA/IGFzTGl0ZXJhbChxdWVyeS5wcmVkaWNhdGUpIDogcXVlcnkucHJlZGljYXRlKTtcbiAgaWYgKHF1ZXJ5LmRlc2NlbmRhbnRzKSB7XG4gICAgbWV0YS5zZXQoJ2Rlc2NlbmRhbnRzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldCgncmVhZCcsIHF1ZXJ5LnJlYWQpO1xuICBpZiAocXVlcnkuc3RhdGljKSB7XG4gICAgbWV0YS5zZXQoJ3N0YXRpYycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgcmV0dXJuIG1ldGEudG9MaXRlcmFsTWFwKCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGhvc3QgbWV0YWRhdGEgaW50byBpdHMgcGFydGlhbCBkZWNsYXJhdGlvbiBmb3JtIGFzIGRlY2xhcmVkXG4gKiBpbiBgUjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3QnXWBcbiAqL1xuZnVuY3Rpb24gY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhOiBSM0hvc3RNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGNvbnN0IGhvc3RNZXRhZGF0YSA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2F0dHJpYnV0ZXMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmF0dHJpYnV0ZXMsIGV4cHJlc3Npb24gPT4gZXhwcmVzc2lvbikpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdsaXN0ZW5lcnMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmxpc3RlbmVycywgby5saXRlcmFsKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ3Byb3BlcnRpZXMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLnByb3BlcnRpZXMsIG8ubGl0ZXJhbCkpO1xuXG4gIGlmIChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikge1xuICAgIGhvc3RNZXRhZGF0YS5zZXQoJ3N0eWxlQXR0cmlidXRlJywgby5saXRlcmFsKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSk7XG4gIH1cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnY2xhc3NBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpKTtcbiAgfVxuXG4gIGlmIChob3N0TWV0YWRhdGEudmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gaG9zdE1ldGFkYXRhLnRvTGl0ZXJhbE1hcCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBvYmplY3QgbGl0ZXJhbCBleHByZXNzaW9uIGZyb20gdGhlIGdpdmVuIG9iamVjdCwgbWFwcGluZyBhbGwgdmFsdWVzIHRvIGFuIGV4cHJlc3Npb25cbiAqIHVzaW5nIHRoZSBwcm92aWRlZCBtYXBwaW5nIGZ1bmN0aW9uLiBJZiB0aGUgb2JqZWN0IGhhcyBubyBrZXlzLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKlxuICogQHBhcmFtIG9iamVjdCBUaGUgb2JqZWN0IHRvIHRyYW5zZmVyIGludG8gYW4gb2JqZWN0IGxpdGVyYWwgZXhwcmVzc2lvbi5cbiAqIEBwYXJhbSBtYXBwZXIgVGhlIGxvZ2ljIHRvIHVzZSBmb3IgY3JlYXRpbmcgYW4gZXhwcmVzc2lvbiBmb3IgdGhlIG9iamVjdCdzIHZhbHVlcy5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBsaXRlcmFsIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGBvYmplY3RgLCBvciBudWxsIGlmIGBvYmplY3RgIGRvZXMgbm90IGhhdmVcbiAqIGFueSBrZXlzLlxuICovXG5mdW5jdGlvbiB0b09wdGlvbmFsTGl0ZXJhbE1hcDxUPihcbiAgICBvYmplY3Q6IHtba2V5OiBzdHJpbmddOiBUfSwgbWFwcGVyOiAodmFsdWU6IFQpID0+IG8uRXhwcmVzc2lvbik6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGNvbnN0IGVudHJpZXMgPSBPYmplY3Qua2V5cyhvYmplY3QpLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gb2JqZWN0W2tleV07XG4gICAgcmV0dXJuIHtrZXksIHZhbHVlOiBtYXBwZXIodmFsdWUpLCBxdW90ZWQ6IHRydWV9O1xuICB9KTtcblxuICBpZiAoZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl19