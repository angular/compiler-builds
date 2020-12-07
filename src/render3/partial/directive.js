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
        return { expression: expression, type: type };
    }
    exports.compileDeclareDirectiveFromMetadata = compileDeclareDirectiveFromMetadata;
    /**
     * Gathers the declaration fields for a directive into a `DefinitionMap`. This allows for reusing
     * this logic for components, as they extend the directive metadata.
     */
    function createDirectiveDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal('11.1.0-next.1+52.sha-6d19c16'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBQUE7Ozs7OztPQU1HO0lBQ0gsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUVwRCx3RUFBcUQ7SUFDckQsZ0VBQTJGO0lBQzNGLG1FQUE0QztJQUc1Qzs7T0FFRztJQUNILFNBQWdCLG1DQUFtQyxDQUFDLElBQXlCO1FBQzNFLElBQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXpELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsOEJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFDLENBQUM7SUFDNUIsQ0FBQztJQVBELGtGQU9DO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsNEJBQTRCLENBQUMsSUFBeUI7UUFDcEUsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUFFLENBQUM7UUFFMUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFFN0QsMkJBQTJCO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU3Qyw4QkFBOEI7UUFDOUIsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUMxQixhQUFhLENBQUMsR0FBRyxDQUFDLFVB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QyxFQUFFO1lBQ2xDLE9BQU8sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3BDO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQztTQUNiO0lBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzRGlyZWN0aXZlRGVmLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuLi92aWV3L2FwaSc7XG5pbXBvcnQge2NyZWF0ZURpcmVjdGl2ZVR5cGV9IGZyb20gJy4uL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbE1hcH0gZnJvbSAnLi91dGlsJztcblxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IFIzRGlyZWN0aXZlRGVmIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgZGlyZWN0aXZlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuIFRoaXMgYWxsb3dzIGZvciByZXVzaW5nXG4gKiB0aGlzIGxvZ2ljIGZvciBjb21wb25lbnRzLCBhcyB0aGV5IGV4dGVuZCB0aGUgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogRGVmaW5pdGlvbk1hcCB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3I6ICdzb21lLWRpcidgXG4gIGlmIChtZXRhLnNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9yJywgby5saXRlcmFsKG1ldGEuc2VsZWN0b3IpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdob3N0JywgY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhLmhvc3QpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZXJzJywgbWV0YS5wcm92aWRlcnMpO1xuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdxdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEucXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS52aWV3UXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBhc0xpdGVyYWwobWV0YS5leHBvcnRBcykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNJbmhlcml0YW5jZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc09uQ2hhbmdlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBtZXRhZGF0YSBvZiBhIHNpbmdsZSBxdWVyeSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGJ5IGBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVF1ZXJ5KHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgbWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIG1ldGEuc2V0KCdwcm9wZXJ0eU5hbWUnLCBvLmxpdGVyYWwocXVlcnkucHJvcGVydHlOYW1lKSk7XG4gIGlmIChxdWVyeS5maXJzdCkge1xuICAgIG1ldGEuc2V0KCdmaXJzdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoXG4gICAgICAncHJlZGljYXRlJywgQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpID8gYXNMaXRlcmFsKHF1ZXJ5LnByZWRpY2F0ZSkgOiBxdWVyeS5wcmVkaWNhdGUpO1xuICBpZiAocXVlcnkuZGVzY2VuZGFudHMpIHtcbiAgICBtZXRhLnNldCgnZGVzY2VuZGFudHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KCdyZWFkJywgcXVlcnkucmVhZCk7XG4gIGlmIChxdWVyeS5zdGF0aWMpIHtcbiAgICBtZXRhLnNldCgnc3RhdGljJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICByZXR1cm4gbWV0YS50b0xpdGVyYWxNYXAoKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgaG9zdCBtZXRhZGF0YSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGluIGBSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddYFxuICovXG5mdW5jdGlvbiBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGE6IFIzSG9zdE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgY29uc3QgaG9zdE1ldGFkYXRhID0gbmV3IERlZmluaXRpb25NYXAoKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnYXR0cmlidXRlcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEuYXR0cmlidXRlcywgZXhwcmVzc2lvbiA9PiBleHByZXNzaW9uKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2xpc3RlbmVycycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEubGlzdGVuZXJzLCBvLmxpdGVyYWwpKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgncHJvcGVydGllcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEucHJvcGVydGllcywgby5saXRlcmFsKSk7XG5cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnc3R5bGVBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpKTtcbiAgfVxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdjbGFzc0F0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikpO1xuICB9XG5cbiAgaWYgKGhvc3RNZXRhZGF0YS52YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBob3N0TWV0YWRhdGEudG9MaXRlcmFsTWFwKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdfQ==