(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/pipe", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createPipeDefinitionMap = exports.compileDeclarePipeFromMetadata = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var r3_pipe_compiler_1 = require("@angular/compiler/src/render3/r3_pipe_compiler");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    /**
     * Compile a Pipe declaration defined by the `R3PipeMetadata`.
     */
    function compileDeclarePipeFromMetadata(meta) {
        var definitionMap = createPipeDefinitionMap(meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declarePipe).callFn([definitionMap.toLiteralMap()]);
        var type = r3_pipe_compiler_1.createPipeType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclarePipeFromMetadata = compileDeclarePipeFromMetadata;
    /**
     * Gathers the declaration fields for a Pipe into a `DefinitionMap`. This allows for reusing
     * this logic for components, as they extend the Pipe metadata.
     */
    function createPipeDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal('12.0.0-next.8+9.sha-c385e74'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        // e.g. `type: MyPipe`
        definitionMap.set('type', meta.internalType);
        // e.g. `name: "myPipe"`
        definitionMap.set('name', o.literal(meta.pipeName));
        if (meta.pure === false) {
            // e.g. `pure: false`
            definitionMap.set('pure', o.literal(meta.pure));
        }
        return definitionMap;
    }
    exports.createPipeDefinitionMap = createPipeDefinitionMap;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvcGlwZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBNkM7SUFDN0MsK0VBQW9EO0lBQ3BELG1GQUFtRTtJQUVuRSxnRUFBMkM7SUFJM0M7O09BRUc7SUFDSCxTQUFnQiw4QkFBOEIsQ0FBQyxJQUFvQjtRQUNqRSxJQUFNLGFBQWEsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwRCxJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFNLElBQUksR0FBRyxpQ0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWxDLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7SUFDNUMsQ0FBQztJQVBELHdFQU9DO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsdUJBQXVCLENBQUMsSUFBb0I7UUFFMUQsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUF5QixDQUFDO1FBRWpFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXJELHNCQUFzQjtRQUN0QixhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0Msd0JBQXdCO1FBQ3hCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFFcEQsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRTtZQUN2QixxQkFBcUI7WUFDckIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUNqRDtRQUVELE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFsQkQsMERBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y3JlYXRlUGlwZVR5cGUsIFIzUGlwZU1ldGFkYXRhfSBmcm9tICcuLi9yM19waXBlX2NvbXBpbGVyJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb259IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuaW1wb3J0IHtSM0RlY2xhcmVQaXBlTWV0YWRhdGF9IGZyb20gJy4vYXBpJztcblxuXG4vKipcbiAqIENvbXBpbGUgYSBQaXBlIGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM1BpcGVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZVBpcGVGcm9tTWV0YWRhdGEobWV0YTogUjNQaXBlTWV0YWRhdGEpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVQaXBlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVQaXBlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVBpcGVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBQaXBlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuIFRoaXMgYWxsb3dzIGZvciByZXVzaW5nXG4gKiB0aGlzIGxvZ2ljIGZvciBjb21wb25lbnRzLCBhcyB0aGV5IGV4dGVuZCB0aGUgUGlwZSBtZXRhZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBpcGVEZWZpbml0aW9uTWFwKG1ldGE6IFIzUGlwZU1ldGFkYXRhKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVBpcGVNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlUGlwZU1ldGFkYXRhPigpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeVBpcGVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuICAvLyBlLmcuIGBuYW1lOiBcIm15UGlwZVwiYFxuICBkZWZpbml0aW9uTWFwLnNldCgnbmFtZScsIG8ubGl0ZXJhbChtZXRhLnBpcGVOYW1lKSk7XG5cbiAgaWYgKG1ldGEucHVyZSA9PT0gZmFsc2UpIHtcbiAgICAvLyBlLmcuIGBwdXJlOiBmYWxzZWBcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHVyZScsIG8ubGl0ZXJhbChtZXRhLnB1cmUpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuIl19