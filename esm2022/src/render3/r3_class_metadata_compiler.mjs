/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../output/output_ast';
import { Identifiers as R3 } from './r3_identifiers';
import { devOnlyGuardedExpression } from './util';
export function compileClassMetadata(metadata) {
    // Generate an ngDevMode guarded call to setClassMetadata with the class identifier and its
    // metadata.
    const fnCall = o.importExpr(R3.setClassMetadata).callFn([
        metadata.type,
        metadata.decorators,
        metadata.ctorParameters ?? o.literal(null),
        metadata.propDecorators ?? o.literal(null),
    ]);
    const iife = o.arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]);
    return iife.callFn([]);
}
/**
 * Wraps the `setClassMetadata` function with extra logic that dynamically
 * loads dependencies from `@defer` blocks.
 *
 * Generates a call like this:
 * ```
 * setClassMetadataAsync(type, () => [
 *   import('./cmp-a').then(m => m.CmpA);
 *   import('./cmp-b').then(m => m.CmpB);
 * ], (CmpA, CmpB) => {
 *   setClassMetadata(type, decorators, ctorParameters, propParameters);
 * });
 * ```
 *
 * Similar to the `setClassMetadata` call, it's wrapped into the `ngDevMode`
 * check to tree-shake away this code in production mode.
 */
export function compileComponentClassMetadata(metadata, deferrableTypes) {
    if (deferrableTypes === null || deferrableTypes.size === 0) {
        // If there are no deferrable symbols - just generate a regular `setClassMetadata` call.
        return compileClassMetadata(metadata);
    }
    const dynamicImports = [];
    const importedSymbols = [];
    for (const [symbolName, importPath] of deferrableTypes) {
        // e.g. `(m) => m.CmpA`
        const innerFn = o.arrowFn([new o.FnParam('m', o.DYNAMIC_TYPE)], o.variable('m').prop(symbolName));
        // e.g. `import('./cmp-a').then(...)`
        const importExpr = (new o.DynamicImportExpr(importPath)).prop('then').callFn([innerFn]);
        dynamicImports.push(importExpr);
        importedSymbols.push(new o.FnParam(symbolName, o.DYNAMIC_TYPE));
    }
    // e.g. `() => [ ... ];`
    const dependencyLoadingFn = o.arrowFn([], o.literalArr(dynamicImports));
    // e.g. `setClassMetadata(...)`
    const setClassMetadataCall = o.importExpr(R3.setClassMetadata).callFn([
        metadata.type,
        metadata.decorators,
        metadata.ctorParameters ?? o.literal(null),
        metadata.propDecorators ?? o.literal(null),
    ]);
    // e.g. `(CmpA) => setClassMetadata(...)`
    const setClassMetaWrapper = o.arrowFn(importedSymbols, [setClassMetadataCall.toStmt()]);
    // Final `setClassMetadataAsync()` call with all arguments
    const setClassMetaAsync = o.importExpr(R3.setClassMetadataAsync).callFn([
        metadata.type, dependencyLoadingFn, setClassMetaWrapper
    ]);
    // Generate an ngDevMode guarded call to `setClassMetadataAsync` with
    // the class identifier and its metadata, so that this call can be tree-shaken.
    const iife = o.arrowFn([], [devOnlyGuardedExpression(setClassMetaAsync).toStmt()]);
    return iife.callFn([]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY2xhc3NfbWV0YWRhdGFfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19jbGFzc19tZXRhZGF0YV9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHNCQUFzQixDQUFDO0FBRTFDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDbkQsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBaUNoRCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsUUFBeUI7SUFDNUQsMkZBQTJGO0lBQzNGLFlBQVk7SUFDWixNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUN0RCxRQUFRLENBQUMsSUFBSTtRQUNiLFFBQVEsQ0FBQyxVQUFVO1FBQ25CLFFBQVEsQ0FBQyxjQUFjLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDMUMsUUFBUSxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztLQUMzQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN4RSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7O0dBZ0JHO0FBQ0gsTUFBTSxVQUFVLDZCQUE2QixDQUN6QyxRQUF5QixFQUFFLGVBQXlDO0lBQ3RFLElBQUksZUFBZSxLQUFLLElBQUksSUFBSSxlQUFlLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzNELHdGQUF3RjtRQUN4RixPQUFPLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCxNQUFNLGNBQWMsR0FBbUIsRUFBRSxDQUFDO0lBQzFDLE1BQU0sZUFBZSxHQUFnQixFQUFFLENBQUM7SUFDeEMsS0FBSyxNQUFNLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3ZELHVCQUF1QjtRQUN2QixNQUFNLE9BQU8sR0FDVCxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRXRGLHFDQUFxQztRQUNyQyxNQUFNLFVBQVUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFFeEYsY0FBYyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVELHdCQUF3QjtJQUN4QixNQUFNLG1CQUFtQixHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUV4RSwrQkFBK0I7SUFDL0IsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUNwRSxRQUFRLENBQUMsSUFBSTtRQUNiLFFBQVEsQ0FBQyxVQUFVO1FBQ25CLFFBQVEsQ0FBQyxjQUFjLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDMUMsUUFBUSxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztLQUMzQyxDQUFDLENBQUM7SUFFSCx5Q0FBeUM7SUFDekMsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUV4RiwwREFBMEQ7SUFDMUQsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUN0RSxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLG1CQUFtQjtLQUN4RCxDQUFDLENBQUM7SUFFSCxxRUFBcUU7SUFDckUsK0VBQStFO0lBQy9FLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsd0JBQXdCLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbkYsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7ZGV2T25seUd1YXJkZWRFeHByZXNzaW9ufSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBDb21waWxlQ2xhc3NNZXRhZGF0YUZuID0gKG1ldGFkYXRhOiBSM0NsYXNzTWV0YWRhdGEpID0+IG8uRXhwcmVzc2lvbjtcblxuLyoqXG4gKiBNZXRhZGF0YSBvZiBhIGNsYXNzIHdoaWNoIGNhcHR1cmVzIHRoZSBvcmlnaW5hbCBBbmd1bGFyIGRlY29yYXRvcnMgb2YgYSBjbGFzcy4gVGhlIG9yaWdpbmFsXG4gKiBkZWNvcmF0b3JzIGFyZSBwcmVzZXJ2ZWQgaW4gdGhlIGdlbmVyYXRlZCBjb2RlIHRvIGFsbG93IFRlc3RCZWQgQVBJcyB0byByZWNvbXBpbGUgdGhlIGNsYXNzXG4gKiB1c2luZyB0aGUgb3JpZ2luYWwgZGVjb3JhdG9yIHdpdGggYSBzZXQgb2Ygb3ZlcnJpZGVzIGFwcGxpZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDbGFzc01ldGFkYXRhIHtcbiAgLyoqXG4gICAqIFRoZSBjbGFzcyB0eXBlIGZvciB3aGljaCB0aGUgbWV0YWRhdGEgaXMgY2FwdHVyZWQuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBBbmd1bGFyIGRlY29yYXRvcnMgdGhhdCB3ZXJlIGFwcGxpZWQgb24gdGhlIGNsYXNzLlxuICAgKi9cbiAgZGVjb3JhdG9yczogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgQW5ndWxhciBkZWNvcmF0b3JzIGFwcGxpZWQgdG8gY29uc3RydWN0b3IgcGFyYW1ldGVycywgb3IgYG51bGxgXG4gICAqIGlmIHRoZXJlIGlzIG5vIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgY3RvclBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgQW5ndWxhciBkZWNvcmF0b3JzIHRoYXQgd2VyZSBhcHBsaWVkIG9uIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZVxuICAgKiBjbGFzcywgb3IgYG51bGxgIGlmIG5vIHByb3BlcnRpZXMgaGF2ZSBkZWNvcmF0b3JzLlxuICAgKi9cbiAgcHJvcERlY29yYXRvcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNsYXNzTWV0YWRhdGEobWV0YWRhdGE6IFIzQ2xhc3NNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIC8vIEdlbmVyYXRlIGFuIG5nRGV2TW9kZSBndWFyZGVkIGNhbGwgdG8gc2V0Q2xhc3NNZXRhZGF0YSB3aXRoIHRoZSBjbGFzcyBpZGVudGlmaWVyIGFuZCBpdHNcbiAgLy8gbWV0YWRhdGEuXG4gIGNvbnN0IGZuQ2FsbCA9IG8uaW1wb3J0RXhwcihSMy5zZXRDbGFzc01ldGFkYXRhKS5jYWxsRm4oW1xuICAgIG1ldGFkYXRhLnR5cGUsXG4gICAgbWV0YWRhdGEuZGVjb3JhdG9ycyxcbiAgICBtZXRhZGF0YS5jdG9yUGFyYW1ldGVycyA/PyBvLmxpdGVyYWwobnVsbCksXG4gICAgbWV0YWRhdGEucHJvcERlY29yYXRvcnMgPz8gby5saXRlcmFsKG51bGwpLFxuICBdKTtcbiAgY29uc3QgaWlmZSA9IG8uYXJyb3dGbihbXSwgW2Rldk9ubHlHdWFyZGVkRXhwcmVzc2lvbihmbkNhbGwpLnRvU3RtdCgpXSk7XG4gIHJldHVybiBpaWZlLmNhbGxGbihbXSk7XG59XG5cbi8qKlxuICogV3JhcHMgdGhlIGBzZXRDbGFzc01ldGFkYXRhYCBmdW5jdGlvbiB3aXRoIGV4dHJhIGxvZ2ljIHRoYXQgZHluYW1pY2FsbHlcbiAqIGxvYWRzIGRlcGVuZGVuY2llcyBmcm9tIGBAZGVmZXJgIGJsb2Nrcy5cbiAqXG4gKiBHZW5lcmF0ZXMgYSBjYWxsIGxpa2UgdGhpczpcbiAqIGBgYFxuICogc2V0Q2xhc3NNZXRhZGF0YUFzeW5jKHR5cGUsICgpID0+IFtcbiAqICAgaW1wb3J0KCcuL2NtcC1hJykudGhlbihtID0+IG0uQ21wQSk7XG4gKiAgIGltcG9ydCgnLi9jbXAtYicpLnRoZW4obSA9PiBtLkNtcEIpO1xuICogXSwgKENtcEEsIENtcEIpID0+IHtcbiAqICAgc2V0Q2xhc3NNZXRhZGF0YSh0eXBlLCBkZWNvcmF0b3JzLCBjdG9yUGFyYW1ldGVycywgcHJvcFBhcmFtZXRlcnMpO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBTaW1pbGFyIHRvIHRoZSBgc2V0Q2xhc3NNZXRhZGF0YWAgY2FsbCwgaXQncyB3cmFwcGVkIGludG8gdGhlIGBuZ0Rldk1vZGVgXG4gKiBjaGVjayB0byB0cmVlLXNoYWtlIGF3YXkgdGhpcyBjb2RlIGluIHByb2R1Y3Rpb24gbW9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRDbGFzc01ldGFkYXRhKFxuICAgIG1ldGFkYXRhOiBSM0NsYXNzTWV0YWRhdGEsIGRlZmVycmFibGVUeXBlczogTWFwPHN0cmluZywgc3RyaW5nPnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGRlZmVycmFibGVUeXBlcyA9PT0gbnVsbCB8fCBkZWZlcnJhYmxlVHlwZXMuc2l6ZSA9PT0gMCkge1xuICAgIC8vIElmIHRoZXJlIGFyZSBubyBkZWZlcnJhYmxlIHN5bWJvbHMgLSBqdXN0IGdlbmVyYXRlIGEgcmVndWxhciBgc2V0Q2xhc3NNZXRhZGF0YWAgY2FsbC5cbiAgICByZXR1cm4gY29tcGlsZUNsYXNzTWV0YWRhdGEobWV0YWRhdGEpO1xuICB9XG5cbiAgY29uc3QgZHluYW1pY0ltcG9ydHM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGNvbnN0IGltcG9ydGVkU3ltYm9sczogby5GblBhcmFtW10gPSBbXTtcbiAgZm9yIChjb25zdCBbc3ltYm9sTmFtZSwgaW1wb3J0UGF0aF0gb2YgZGVmZXJyYWJsZVR5cGVzKSB7XG4gICAgLy8gZS5nLiBgKG0pID0+IG0uQ21wQWBcbiAgICBjb25zdCBpbm5lckZuID1cbiAgICAgICAgby5hcnJvd0ZuKFtuZXcgby5GblBhcmFtKCdtJywgby5EWU5BTUlDX1RZUEUpXSwgby52YXJpYWJsZSgnbScpLnByb3Aoc3ltYm9sTmFtZSkpO1xuXG4gICAgLy8gZS5nLiBgaW1wb3J0KCcuL2NtcC1hJykudGhlbiguLi4pYFxuICAgIGNvbnN0IGltcG9ydEV4cHIgPSAobmV3IG8uRHluYW1pY0ltcG9ydEV4cHIoaW1wb3J0UGF0aCkpLnByb3AoJ3RoZW4nKS5jYWxsRm4oW2lubmVyRm5dKTtcblxuICAgIGR5bmFtaWNJbXBvcnRzLnB1c2goaW1wb3J0RXhwcik7XG4gICAgaW1wb3J0ZWRTeW1ib2xzLnB1c2gobmV3IG8uRm5QYXJhbShzeW1ib2xOYW1lLCBvLkRZTkFNSUNfVFlQRSkpO1xuICB9XG5cbiAgLy8gZS5nLiBgKCkgPT4gWyAuLi4gXTtgXG4gIGNvbnN0IGRlcGVuZGVuY3lMb2FkaW5nRm4gPSBvLmFycm93Rm4oW10sIG8ubGl0ZXJhbEFycihkeW5hbWljSW1wb3J0cykpO1xuXG4gIC8vIGUuZy4gYHNldENsYXNzTWV0YWRhdGEoLi4uKWBcbiAgY29uc3Qgc2V0Q2xhc3NNZXRhZGF0YUNhbGwgPSBvLmltcG9ydEV4cHIoUjMuc2V0Q2xhc3NNZXRhZGF0YSkuY2FsbEZuKFtcbiAgICBtZXRhZGF0YS50eXBlLFxuICAgIG1ldGFkYXRhLmRlY29yYXRvcnMsXG4gICAgbWV0YWRhdGEuY3RvclBhcmFtZXRlcnMgPz8gby5saXRlcmFsKG51bGwpLFxuICAgIG1ldGFkYXRhLnByb3BEZWNvcmF0b3JzID8/IG8ubGl0ZXJhbChudWxsKSxcbiAgXSk7XG5cbiAgLy8gZS5nLiBgKENtcEEpID0+IHNldENsYXNzTWV0YWRhdGEoLi4uKWBcbiAgY29uc3Qgc2V0Q2xhc3NNZXRhV3JhcHBlciA9IG8uYXJyb3dGbihpbXBvcnRlZFN5bWJvbHMsIFtzZXRDbGFzc01ldGFkYXRhQ2FsbC50b1N0bXQoKV0pO1xuXG4gIC8vIEZpbmFsIGBzZXRDbGFzc01ldGFkYXRhQXN5bmMoKWAgY2FsbCB3aXRoIGFsbCBhcmd1bWVudHNcbiAgY29uc3Qgc2V0Q2xhc3NNZXRhQXN5bmMgPSBvLmltcG9ydEV4cHIoUjMuc2V0Q2xhc3NNZXRhZGF0YUFzeW5jKS5jYWxsRm4oW1xuICAgIG1ldGFkYXRhLnR5cGUsIGRlcGVuZGVuY3lMb2FkaW5nRm4sIHNldENsYXNzTWV0YVdyYXBwZXJcbiAgXSk7XG5cbiAgLy8gR2VuZXJhdGUgYW4gbmdEZXZNb2RlIGd1YXJkZWQgY2FsbCB0byBgc2V0Q2xhc3NNZXRhZGF0YUFzeW5jYCB3aXRoXG4gIC8vIHRoZSBjbGFzcyBpZGVudGlmaWVyIGFuZCBpdHMgbWV0YWRhdGEsIHNvIHRoYXQgdGhpcyBjYWxsIGNhbiBiZSB0cmVlLXNoYWtlbi5cbiAgY29uc3QgaWlmZSA9IG8uYXJyb3dGbihbXSwgW2Rldk9ubHlHdWFyZGVkRXhwcmVzc2lvbihzZXRDbGFzc01ldGFBc3luYykudG9TdG10KCldKTtcbiAgcmV0dXJuIGlpZmUuY2FsbEZuKFtdKTtcbn1cbiJdfQ==