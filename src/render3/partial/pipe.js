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
     * Gathers the declaration fields for a Pipe into a `DefinitionMap`.
     */
    function createPipeDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal('12.0.0-next.8+26.sha-61bfa3d'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvcGlwZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBNkM7SUFDN0MsK0VBQW9EO0lBQ3BELG1GQUFtRTtJQUVuRSxnRUFBMkM7SUFJM0M7O09BRUc7SUFDSCxTQUFnQiw4QkFBOEIsQ0FBQyxJQUFvQjtRQUNqRSxJQUFNLGFBQWEsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwRCxJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFNLElBQUksR0FBRyxpQ0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWxDLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7SUFDNUMsQ0FBQztJQVBELHdFQU9DO0lBRUQ7O09BRUc7SUFDSCxTQUFnQix1QkFBdUIsQ0FBQyxJQUFvQjtRQUUxRCxJQUFNLGFBQWEsR0FBRyxJQUFJLG9CQUFhLEVBQXlCLENBQUM7UUFFakUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFckQsc0JBQXNCO1FBQ3RCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM3Qyx3QkFBd0I7UUFDeEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUVwRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUFFO1lBQ3ZCLHFCQUFxQjtZQUNyQixhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ2pEO1FBRUQsT0FBTyxhQUFhLENBQUM7SUFDdkIsQ0FBQztJQWxCRCwwREFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtjcmVhdGVQaXBlVHlwZSwgUjNQaXBlTWV0YWRhdGF9IGZyb20gJy4uL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5pbXBvcnQge1IzRGVjbGFyZVBpcGVNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuXG5cbi8qKlxuICogQ29tcGlsZSBhIFBpcGUgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzUGlwZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlUGlwZUZyb21NZXRhZGF0YShtZXRhOiBSM1BpcGVNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZVBpcGVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZVBpcGUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlUGlwZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIFBpcGUgaW50byBhIGBEZWZpbml0aW9uTWFwYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBpcGVEZWZpbml0aW9uTWFwKG1ldGE6IFIzUGlwZU1ldGFkYXRhKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVBpcGVNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlUGlwZU1ldGFkYXRhPigpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeVBpcGVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuICAvLyBlLmcuIGBuYW1lOiBcIm15UGlwZVwiYFxuICBkZWZpbml0aW9uTWFwLnNldCgnbmFtZScsIG8ubGl0ZXJhbChtZXRhLnBpcGVOYW1lKSk7XG5cbiAgaWYgKG1ldGEucHVyZSA9PT0gZmFsc2UpIHtcbiAgICAvLyBlLmcuIGBwdXJlOiBmYWxzZWBcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHVyZScsIG8ubGl0ZXJhbChtZXRhLnB1cmUpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuIl19