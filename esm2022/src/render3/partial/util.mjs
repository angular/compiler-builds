/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { DefinitionMap } from '../view/util';
/**
 * Creates an array literal expression from the given array, mapping all values to an expression
 * using the provided mapping function. If the array is empty or null, then null is returned.
 *
 * @param values The array to transfer into literal array expression.
 * @param mapper The logic to use for creating an expression for the array's values.
 * @returns An array literal expression representing `values`, or null if `values` is empty or
 * is itself null.
 */
export function toOptionalLiteralArray(values, mapper) {
    if (values === null || values.length === 0) {
        return null;
    }
    return o.literalArr(values.map(value => mapper(value)));
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
export function toOptionalLiteralMap(object, mapper) {
    const entries = Object.keys(object).map(key => {
        const value = object[key];
        return { key, value: mapper(value), quoted: true };
    });
    if (entries.length > 0) {
        return o.literalMap(entries);
    }
    else {
        return null;
    }
}
export function compileDependencies(deps) {
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
export function compileDependency(dep) {
    const depMeta = new DefinitionMap();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFJM0M7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ2xDLE1BQWdCLEVBQUUsTUFBa0M7SUFDdEQsSUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDM0MsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFELENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FDaEMsTUFBMEIsRUFBRSxNQUFrQztJQUNoRSxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUM1QyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDMUIsT0FBTyxFQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQztJQUNuRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUN2QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLG1CQUFtQixDQUFDLElBQTJDO0lBRTdFLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ3ZCLDBGQUEwRjtRQUMxRixvRkFBb0Y7UUFDcEYsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzlCLENBQUM7U0FBTSxJQUFJLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN6QixPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBeUI7SUFDekQsTUFBTSxPQUFPLEdBQUcsSUFBSSxhQUFhLEVBQStCLENBQUM7SUFDakUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hDLElBQUksR0FBRyxDQUFDLGlCQUFpQixLQUFLLElBQUksRUFBRSxDQUFDO1FBQ25DLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDYixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUNELElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBQ0QsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDYixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUNELElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBQ0QsT0FBTyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7QUFDaEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IGxpdGVyYWwgZXhwcmVzc2lvbiBmcm9tIHRoZSBnaXZlbiBhcnJheSwgbWFwcGluZyBhbGwgdmFsdWVzIHRvIGFuIGV4cHJlc3Npb25cbiAqIHVzaW5nIHRoZSBwcm92aWRlZCBtYXBwaW5nIGZ1bmN0aW9uLiBJZiB0aGUgYXJyYXkgaXMgZW1wdHkgb3IgbnVsbCwgdGhlbiBudWxsIGlzIHJldHVybmVkLlxuICpcbiAqIEBwYXJhbSB2YWx1ZXMgVGhlIGFycmF5IHRvIHRyYW5zZmVyIGludG8gbGl0ZXJhbCBhcnJheSBleHByZXNzaW9uLlxuICogQHBhcmFtIG1hcHBlciBUaGUgbG9naWMgdG8gdXNlIGZvciBjcmVhdGluZyBhbiBleHByZXNzaW9uIGZvciB0aGUgYXJyYXkncyB2YWx1ZXMuXG4gKiBAcmV0dXJucyBBbiBhcnJheSBsaXRlcmFsIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGB2YWx1ZXNgLCBvciBudWxsIGlmIGB2YWx1ZXNgIGlzIGVtcHR5IG9yXG4gKiBpcyBpdHNlbGYgbnVsbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXk8VD4oXG4gICAgdmFsdWVzOiBUW118bnVsbCwgbWFwcGVyOiAodmFsdWU6IFQpID0+IG8uRXhwcmVzc2lvbik6IG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsIHtcbiAgaWYgKHZhbHVlcyA9PT0gbnVsbCB8fCB2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZXMubWFwKHZhbHVlID0+IG1hcHBlcih2YWx1ZSkpKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIG9iamVjdCBsaXRlcmFsIGV4cHJlc3Npb24gZnJvbSB0aGUgZ2l2ZW4gb2JqZWN0LCBtYXBwaW5nIGFsbCB2YWx1ZXMgdG8gYW4gZXhwcmVzc2lvblxuICogdXNpbmcgdGhlIHByb3ZpZGVkIG1hcHBpbmcgZnVuY3Rpb24uIElmIHRoZSBvYmplY3QgaGFzIG5vIGtleXMsIHRoZW4gbnVsbCBpcyByZXR1cm5lZC5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3QgdG8gdHJhbnNmZXIgaW50byBhbiBvYmplY3QgbGl0ZXJhbCBleHByZXNzaW9uLlxuICogQHBhcmFtIG1hcHBlciBUaGUgbG9naWMgdG8gdXNlIGZvciBjcmVhdGluZyBhbiBleHByZXNzaW9uIGZvciB0aGUgb2JqZWN0J3MgdmFsdWVzLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGxpdGVyYWwgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYG9iamVjdGAsIG9yIG51bGwgaWYgYG9iamVjdGAgZG9lcyBub3QgaGF2ZVxuICogYW55IGtleXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b09wdGlvbmFsTGl0ZXJhbE1hcDxUPihcbiAgICBvYmplY3Q6IHtba2V5OiBzdHJpbmddOiBUfSwgbWFwcGVyOiAodmFsdWU6IFQpID0+IG8uRXhwcmVzc2lvbik6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGNvbnN0IGVudHJpZXMgPSBPYmplY3Qua2V5cyhvYmplY3QpLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gb2JqZWN0W2tleV07XG4gICAgcmV0dXJuIHtrZXksIHZhbHVlOiBtYXBwZXIodmFsdWUpLCBxdW90ZWQ6IHRydWV9O1xuICB9KTtcblxuICBpZiAoZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlcGVuZGVuY2llcyhkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfCdpbnZhbGlkJ3xudWxsKTogby5MaXRlcmFsRXhwcnxcbiAgICBvLkxpdGVyYWxBcnJheUV4cHIge1xuICBpZiAoZGVwcyA9PT0gJ2ludmFsaWQnKSB7XG4gICAgLy8gVGhlIGBkZXBzYCBjYW4gYmUgc2V0IHRvIHRoZSBzdHJpbmcgXCJpbnZhbGlkXCIgIGJ5IHRoZSBgdW53cmFwQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMoKWBcbiAgICAvLyBmdW5jdGlvbiwgd2hpY2ggdHJpZXMgdG8gY29udmVydCBgQ29uc3RydWN0b3JEZXBzYCBpbnRvIGBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdYC5cbiAgICByZXR1cm4gby5saXRlcmFsKCdpbnZhbGlkJyk7XG4gIH0gZWxzZSBpZiAoZGVwcyA9PT0gbnVsbCkge1xuICAgIHJldHVybiBvLmxpdGVyYWwobnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycihkZXBzLm1hcChjb21waWxlRGVwZW5kZW5jeSkpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVwZW5kZW5jeShkZXA6IFIzRGVwZW5kZW5jeU1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IGRlcE1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGE+KCk7XG4gIGRlcE1ldGEuc2V0KCd0b2tlbicsIGRlcC50b2tlbik7XG4gIGlmIChkZXAuYXR0cmlidXRlTmFtZVR5cGUgIT09IG51bGwpIHtcbiAgICBkZXBNZXRhLnNldCgnYXR0cmlidXRlJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAoZGVwLmhvc3QpIHtcbiAgICBkZXBNZXRhLnNldCgnaG9zdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKGRlcC5vcHRpb25hbCkge1xuICAgIGRlcE1ldGEuc2V0KCdvcHRpb25hbCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKGRlcC5zZWxmKSB7XG4gICAgZGVwTWV0YS5zZXQoJ3NlbGYnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChkZXAuc2tpcFNlbGYpIHtcbiAgICBkZXBNZXRhLnNldCgnc2tpcFNlbGYnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBkZXBNZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuIl19