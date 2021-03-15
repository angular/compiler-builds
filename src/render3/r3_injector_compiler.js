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
        define("@angular/compiler/src/render3/r3_injector_compiler", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createInjectorType = exports.compileInjector = void 0;
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    function compileInjector(meta) {
        var definitionMap = new util_1.DefinitionMap();
        if (meta.providers !== null) {
            definitionMap.set('providers', meta.providers);
        }
        if (meta.imports.length > 0) {
            definitionMap.set('imports', o.literalArr(meta.imports));
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineInjector).callFn([definitionMap.toLiteralMap()], undefined, true);
        var type = createInjectorType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileInjector = compileInjector;
    function createInjectorType(meta) {
        return new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.InjectorDef, [new o.ExpressionType(meta.type.type)]));
    }
    exports.createInjectorType = createInjectorType;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaW5qZWN0b3JfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwyREFBMEM7SUFDMUMsK0VBQW1EO0lBRW5ELGdFQUEwQztJQVUxQyxTQUFnQixlQUFlLENBQUMsSUFBd0I7UUFDdEQsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUFxRCxDQUFDO1FBRTdGLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7WUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ2hEO1FBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUMxRDtRQUVELElBQU0sVUFBVSxHQUNaLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUYsSUFBTSxJQUFJLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztJQUM1QyxDQUFDO0lBZkQsMENBZUM7SUFFRCxTQUFnQixrQkFBa0IsQ0FBQyxJQUF3QjtRQUN6RCxPQUFPLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEcsQ0FBQztJQUZELGdEQUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9uLCBSM1JlZmVyZW5jZX0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi92aWV3L3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0b3JNZXRhZGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogUjNSZWZlcmVuY2U7XG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuICBpbXBvcnRzOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVJbmplY3RvcihtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDx7cHJvdmlkZXJzOiBvLkV4cHJlc3Npb247IGltcG9ydHM6IG8uRXhwcmVzc2lvbjt9PigpO1xuXG4gIGlmIChtZXRhLnByb3ZpZGVycyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwcm92aWRlcnMnLCBtZXRhLnByb3ZpZGVycyk7XG4gIH1cblxuICBpZiAobWV0YS5pbXBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaW1wb3J0cycsIG8ubGl0ZXJhbEFycihtZXRhLmltcG9ydHMpKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZUluamVjdG9yKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldLCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCB0eXBlID0gY3JlYXRlSW5qZWN0b3JUeXBlKG1ldGEpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUluamVjdG9yVHlwZShtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOiBvLlR5cGUge1xuICByZXR1cm4gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkluamVjdG9yRGVmLCBbbmV3IG8uRXhwcmVzc2lvblR5cGUobWV0YS50eXBlLnR5cGUpXSkpO1xufVxuIl19