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
    /**
     * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
     * must update this constant to prevent old partial-linkers from incorrectly processing the
     * declaration.
     *
     * Do not include any prerelease in these versions as they are ignored.
     */
    var MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
    function compileDeclareFactoryFunction(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
        definitionMap.set('version', o.literal('13.0.0-next.8+18.sha-4555d8a.with-local-changes'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        definitionMap.set('type', meta.internalType);
        definitionMap.set('deps', (0, util_2.compileDependencies)(meta.deps));
        definitionMap.set('target', o.importExpr(r3_identifiers_1.Identifiers.FactoryTarget).prop(r3_factory_1.FactoryTarget[meta.target]));
        return {
            expression: o.importExpr(r3_identifiers_1.Identifiers.declareFactory).callFn([definitionMap.toLiteralMap()]),
            statements: [],
            type: (0, r3_factory_1.createFactoryType)(meta),
        };
    }
    exports.compileDeclareFactoryFunction = compileDeclareFactoryFunction;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBNkM7SUFDN0MsdUVBQWtGO0lBQ2xGLCtFQUFvRDtJQUVwRCxnRUFBMkM7SUFHM0MsbUVBQTJDO0lBRTNDOzs7Ozs7T0FNRztJQUNILElBQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0lBRWhELFNBQWdCLDZCQUE2QixDQUFDLElBQXVCO1FBQ25FLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBNEIsQ0FBQztRQUNwRSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUMzRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUM3RCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0MsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBQSwwQkFBbUIsRUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU3RixPQUFPO1lBQ0wsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztZQUNsRixVQUFVLEVBQUUsRUFBRTtZQUNkLElBQUksRUFBRSxJQUFBLDhCQUFpQixFQUFDLElBQUksQ0FBQztTQUM5QixDQUFDO0lBQ0osQ0FBQztJQWRELHNFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Y3JlYXRlRmFjdG9yeVR5cGUsIEZhY3RvcnlUYXJnZXQsIFIzRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb259IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUZhY3RvcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtjb21waWxlRGVwZW5kZW5jaWVzfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzEyLjAuMCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUZhY3RvcnlGdW5jdGlvbihtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUZhY3RvcnlNZXRhZGF0YT4oKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdkZXBzJywgY29tcGlsZURlcGVuZGVuY2llcyhtZXRhLmRlcHMpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RhcmdldCcsIG8uaW1wb3J0RXhwcihSMy5GYWN0b3J5VGFyZ2V0KS5wcm9wKEZhY3RvcnlUYXJnZXRbbWV0YS50YXJnZXRdKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZUZhY3RvcnkpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pLFxuICAgIHN0YXRlbWVudHM6IFtdLFxuICAgIHR5cGU6IGNyZWF0ZUZhY3RvcnlUeXBlKG1ldGEpLFxuICB9O1xufVxuIl19