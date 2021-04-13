(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/factory", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileDeclareFactoryFunction = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    var util_2 = require("@angular/compiler/src/render3/partial/util");
    function compileDeclareFactoryFunction(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal('12.0.0-next.8+48.sha-1381301'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        definitionMap.set('type', meta.internalType);
        definitionMap.set('deps', util_2.compileDependencies(meta.deps));
        definitionMap.set('target', o.importExpr(r3_identifiers_1.Identifiers.FactoryTarget).prop(r3_factory_1.FactoryTarget[meta.target]));
        return {
            expression: o.importExpr(r3_identifiers_1.Identifiers.declareFactory).callFn([definitionMap.toLiteralMap()]),
            statements: [],
            type: r3_factory_1.createFactoryType(meta),
        };
    }
    exports.compileDeclareFactoryFunction = compileDeclareFactoryFunction;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBNkM7SUFDN0MsdUVBQWtGO0lBQ2xGLCtFQUFvRDtJQUVwRCxnRUFBMkM7SUFHM0MsbUVBQTJDO0lBRTNDLFNBQWdCLDZCQUE2QixDQUFDLElBQXVCO1FBQ25FLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBNEIsQ0FBQztRQUNwRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUM3RCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0MsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsMEJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDMUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQywwQkFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFN0YsT0FBTztZQUNMLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDbEYsVUFBVSxFQUFFLEVBQUU7WUFDZCxJQUFJLEVBQUUsOEJBQWlCLENBQUMsSUFBSSxDQUFDO1NBQzlCLENBQUM7SUFDSixDQUFDO0lBYkQsc0VBYUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtjcmVhdGVGYWN0b3J5VHlwZSwgRmFjdG9yeVRhcmdldCwgUjNGYWN0b3J5TWV0YWRhdGF9IGZyb20gJy4uL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NvbXBpbGVEZXBlbmRlbmNpZXN9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUZhY3RvcnlGdW5jdGlvbihtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUZhY3RvcnlNZXRhZGF0YT4oKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEuaW50ZXJuYWxUeXBlKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlcHMnLCBjb21waWxlRGVwZW5kZW5jaWVzKG1ldGEuZGVwcykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndGFyZ2V0Jywgby5pbXBvcnRFeHByKFIzLkZhY3RvcnlUYXJnZXQpLnByb3AoRmFjdG9yeVRhcmdldFttZXRhLnRhcmdldF0pKTtcblxuICByZXR1cm4ge1xuICAgIGV4cHJlc3Npb246IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlRmFjdG9yeSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSksXG4gICAgc3RhdGVtZW50czogW10sXG4gICAgdHlwZTogY3JlYXRlRmFjdG9yeVR5cGUobWV0YSksXG4gIH07XG59XG4iXX0=