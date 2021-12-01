(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/util", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileDependency = exports.compileDependencies = exports.toOptionalLiteralMap = exports.toOptionalLiteralArray = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    /**
     * Creates an array literal expression from the given array, mapping all values to an expression
     * using the provided mapping function. If the array is empty or null, then null is returned.
     *
     * @param values The array to transfer into literal array expression.
     * @param mapper The logic to use for creating an expression for the array's values.
     * @returns An array literal expression representing `values`, or null if `values` is empty or
     * is itself null.
     */
    function toOptionalLiteralArray(values, mapper) {
        if (values === null || values.length === 0) {
            return null;
        }
        return o.literalArr(values.map(function (value) { return mapper(value); }));
    }
    exports.toOptionalLiteralArray = toOptionalLiteralArray;
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
    exports.toOptionalLiteralMap = toOptionalLiteralMap;
    function compileDependencies(deps) {
        if (deps === 'invalid') {
            // The `deps` can be set to the string "invalid"  by the `unwrapConstructorDependencies()`
            // function, which tries to convert `ConstructorDeps` into `R3DependencyMetadata[]`.
            return o.literal('invalid');
        }
        else if (deps === null) {
            return o.literal(null);
        }
        else {
            return o.literalArr(deps.map(compileDependency));
        }
    }
    exports.compileDependencies = compileDependencies;
    function compileDependency(dep) {
        var depMeta = new util_1.DefinitionMap();
        depMeta.set('token', dep.token);
        if (dep.attributeNameType !== null) {
            depMeta.set('attribute', o.literal(true));
        }
        if (dep.host) {
            depMeta.set('host', o.literal(true));
        }
        if (dep.optional) {
            depMeta.set('optional', o.literal(true));
        }
        if (dep.self) {
            depMeta.set('self', o.literal(true));
        }
        if (dep.skipSelf) {
            depMeta.set('skipSelf', o.literal(true));
        }
        return depMeta.toLiteralMap();
    }
    exports.compileDependency = compileDependency;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBNkM7SUFFN0MsZ0VBQTJDO0lBRzNDOzs7Ozs7OztPQVFHO0lBQ0gsU0FBZ0Isc0JBQXNCLENBQ2xDLE1BQWdCLEVBQUUsTUFBa0M7UUFDdEQsSUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzFDLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBYixDQUFhLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFORCx3REFNQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0gsU0FBZ0Isb0JBQW9CLENBQ2hDLE1BQTBCLEVBQUUsTUFBa0M7UUFDaEUsSUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHO1lBQ3pDLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxQixPQUFPLEVBQUMsR0FBRyxLQUFBLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFDbkQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ3RCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUM5QjthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUM7SUFaRCxvREFZQztJQUVELFNBQWdCLG1CQUFtQixDQUFDLElBQTJDO1FBRTdFLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtZQUN0QiwwRkFBMEY7WUFDMUYsb0ZBQW9GO1lBQ3BGLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM3QjthQUFNLElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtZQUN4QixPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7YUFBTTtZQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztTQUNsRDtJQUNILENBQUM7SUFYRCxrREFXQztJQUVELFNBQWdCLGlCQUFpQixDQUFDLEdBQXlCO1FBQ3pELElBQU0sT0FBTyxHQUFHLElBQUksb0JBQWEsRUFBK0IsQ0FBQztRQUNqRSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEMsSUFBSSxHQUFHLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFO1lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMzQztRQUNELElBQUksR0FBRyxDQUFDLElBQUksRUFBRTtZQUNaLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUN0QztRQUNELElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDMUM7UUFDRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUU7WUFDWixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDdEM7UUFDRCxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzFDO1FBQ0QsT0FBTyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQW5CRCw4Q0FtQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5pbXBvcnQge1IzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgbGl0ZXJhbCBleHByZXNzaW9uIGZyb20gdGhlIGdpdmVuIGFycmF5LCBtYXBwaW5nIGFsbCB2YWx1ZXMgdG8gYW4gZXhwcmVzc2lvblxuICogdXNpbmcgdGhlIHByb3ZpZGVkIG1hcHBpbmcgZnVuY3Rpb24uIElmIHRoZSBhcnJheSBpcyBlbXB0eSBvciBudWxsLCB0aGVuIG51bGwgaXMgcmV0dXJuZWQuXG4gKlxuICogQHBhcmFtIHZhbHVlcyBUaGUgYXJyYXkgdG8gdHJhbnNmZXIgaW50byBsaXRlcmFsIGFycmF5IGV4cHJlc3Npb24uXG4gKiBAcGFyYW0gbWFwcGVyIFRoZSBsb2dpYyB0byB1c2UgZm9yIGNyZWF0aW5nIGFuIGV4cHJlc3Npb24gZm9yIHRoZSBhcnJheSdzIHZhbHVlcy5cbiAqIEByZXR1cm5zIEFuIGFycmF5IGxpdGVyYWwgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYHZhbHVlc2AsIG9yIG51bGwgaWYgYHZhbHVlc2AgaXMgZW1wdHkgb3JcbiAqIGlzIGl0c2VsZiBudWxsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9PcHRpb25hbExpdGVyYWxBcnJheTxUPihcbiAgICB2YWx1ZXM6IFRbXXxudWxsLCBtYXBwZXI6ICh2YWx1ZTogVCkgPT4gby5FeHByZXNzaW9uKTogby5MaXRlcmFsQXJyYXlFeHByfG51bGwge1xuICBpZiAodmFsdWVzID09PSBudWxsIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlcy5tYXAodmFsdWUgPT4gbWFwcGVyKHZhbHVlKSkpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gb2JqZWN0IGxpdGVyYWwgZXhwcmVzc2lvbiBmcm9tIHRoZSBnaXZlbiBvYmplY3QsIG1hcHBpbmcgYWxsIHZhbHVlcyB0byBhbiBleHByZXNzaW9uXG4gKiB1c2luZyB0aGUgcHJvdmlkZWQgbWFwcGluZyBmdW5jdGlvbi4gSWYgdGhlIG9iamVjdCBoYXMgbm8ga2V5cywgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdCB0byB0cmFuc2ZlciBpbnRvIGFuIG9iamVjdCBsaXRlcmFsIGV4cHJlc3Npb24uXG4gKiBAcGFyYW0gbWFwcGVyIFRoZSBsb2dpYyB0byB1c2UgZm9yIGNyZWF0aW5nIGFuIGV4cHJlc3Npb24gZm9yIHRoZSBvYmplY3QncyB2YWx1ZXMuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgbGl0ZXJhbCBleHByZXNzaW9uIHJlcHJlc2VudGluZyBgb2JqZWN0YCwgb3IgbnVsbCBpZiBgb2JqZWN0YCBkb2VzIG5vdCBoYXZlXG4gKiBhbnkga2V5cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvT3B0aW9uYWxMaXRlcmFsTWFwPFQ+KFxuICAgIG9iamVjdDoge1trZXk6IHN0cmluZ106IFR9LCBtYXBwZXI6ICh2YWx1ZTogVCkgPT4gby5FeHByZXNzaW9uKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgY29uc3QgZW50cmllcyA9IE9iamVjdC5rZXlzKG9iamVjdCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgICByZXR1cm4ge2tleSwgdmFsdWU6IG1hcHBlcih2YWx1ZSksIHF1b3RlZDogdHJ1ZX07XG4gIH0pO1xuXG4gIGlmIChlbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVwZW5kZW5jaWVzKGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118J2ludmFsaWQnfG51bGwpOiBvLkxpdGVyYWxFeHByfFxuICAgIG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGlmIChkZXBzID09PSAnaW52YWxpZCcpIHtcbiAgICAvLyBUaGUgYGRlcHNgIGNhbiBiZSBzZXQgdG8gdGhlIHN0cmluZyBcImludmFsaWRcIiAgYnkgdGhlIGB1bndyYXBDb25zdHJ1Y3RvckRlcGVuZGVuY2llcygpYFxuICAgIC8vIGZ1bmN0aW9uLCB3aGljaCB0cmllcyB0byBjb252ZXJ0IGBDb25zdHJ1Y3RvckRlcHNgIGludG8gYFIzRGVwZW5kZW5jeU1ldGFkYXRhW11gLlxuICAgIHJldHVybiBvLmxpdGVyYWwoJ2ludmFsaWQnKTtcbiAgfSBlbHNlIGlmIChkZXBzID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChudWxsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKGRlcHMubWFwKGNvbXBpbGVEZXBlbmRlbmN5KSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZXBlbmRlbmN5KGRlcDogUjNEZXBlbmRlbmN5TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgZGVwTWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YT4oKTtcbiAgZGVwTWV0YS5zZXQoJ3Rva2VuJywgZGVwLnRva2VuKTtcbiAgaWYgKGRlcC5hdHRyaWJ1dGVOYW1lVHlwZSAhPT0gbnVsbCkge1xuICAgIGRlcE1ldGEuc2V0KCdhdHRyaWJ1dGUnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChkZXAuaG9zdCkge1xuICAgIGRlcE1ldGEuc2V0KCdob3N0Jywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAoZGVwLm9wdGlvbmFsKSB7XG4gICAgZGVwTWV0YS5zZXQoJ29wdGlvbmFsJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAoZGVwLnNlbGYpIHtcbiAgICBkZXBNZXRhLnNldCgnc2VsZicsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKGRlcC5za2lwU2VsZikge1xuICAgIGRlcE1ldGEuc2V0KCdza2lwU2VsZicsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgcmV0dXJuIGRlcE1ldGEudG9MaXRlcmFsTWFwKCk7XG59XG4iXX0=