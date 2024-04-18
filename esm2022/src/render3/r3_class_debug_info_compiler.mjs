/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { mapLiteral } from '../output/map_util';
import * as o from '../output/output_ast';
import { Identifiers as R3 } from './r3_identifiers';
import { devOnlyGuardedExpression } from './util';
/**
 * Generate an ngDevMode guarded call to setClassDebugInfo with the debug info about the class
 * (e.g., the file name in which the class is defined)
 */
export function compileClassDebugInfo(debugInfo) {
    const debugInfoObject = {
        className: debugInfo.className,
    };
    // Include file path and line number only if the file relative path is calculated successfully.
    if (debugInfo.filePath) {
        debugInfoObject.filePath = debugInfo.filePath;
        debugInfoObject.lineNumber = debugInfo.lineNumber;
    }
    // Include forbidOrphanRendering only if it's set to true (to reduce generated code)
    if (debugInfo.forbidOrphanRendering) {
        debugInfoObject.forbidOrphanRendering = o.literal(true);
    }
    const fnCall = o
        .importExpr(R3.setClassDebugInfo)
        .callFn([debugInfo.type, mapLiteral(debugInfoObject)]);
    const iife = o.arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]);
    return iife.callFn([]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY2xhc3NfZGVidWdfaW5mb19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2NsYXNzX2RlYnVnX2luZm9fY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFMUMsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUF1Q2hEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxxQkFBcUIsQ0FBQyxTQUEyQjtJQUMvRCxNQUFNLGVBQWUsR0FLakI7UUFDRixTQUFTLEVBQUUsU0FBUyxDQUFDLFNBQVM7S0FDL0IsQ0FBQztJQUVGLCtGQUErRjtJQUMvRixJQUFJLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN2QixlQUFlLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7UUFDOUMsZUFBZSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDO0lBQ3BELENBQUM7SUFFRCxvRkFBb0Y7SUFDcEYsSUFBSSxTQUFTLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNwQyxlQUFlLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQsTUFBTSxNQUFNLEdBQUcsQ0FBQztTQUNiLFVBQVUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUM7U0FDaEMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pELE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsd0JBQXdCLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7ZGV2T25seUd1YXJkZWRFeHByZXNzaW9ufSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEluZm8gbmVlZGVkIGZvciBydW50aW1lIGVycm9ycyByZWxhdGVkIHRvIGEgY2xhc3MsIHN1Y2ggYXMgdGhlIGxvY2F0aW9uIGluIHdoaWNoIHRoZSBjbGFzcyBpc1xuICogZGVmaW5lZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NsYXNzRGVidWdJbmZvIHtcbiAgLyoqIFRoZSBjbGFzcyBpZGVudGlmaWVyICovXG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQSBzdHJpbmcgbGl0ZXJhbCBjb250YWluaW5nIHRoZSBvcmlnaW5hbCBjbGFzcyBuYW1lIGFzIGFwcGVhcnMgaW4gaXRzIGRlZmluaXRpb24uXG4gICAqL1xuICBjbGFzc05hbWU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQSBzdHJpbmcgbGl0ZXJhbCBjb250YWluaW5nIHRoZSByZWxhdGl2ZSBwYXRoIG9mIHRoZSBmaWxlIGluIHdoaWNoIHRoZSBjbGFzcyBpcyBkZWZpbmVkLlxuICAgKlxuICAgKiBUaGUgcGF0aCBpcyByZWxhdGl2ZSB0byB0aGUgcHJvamVjdCByb290LiBUaGUgY29tcGlsZXIgZG9lcyB0aGUgYmVzdCBlZmZvcnQgdG8gZmluZCB0aGUgcHJvamVjdFxuICAgKiByb290IChlLmcuLCB1c2luZyB0aGUgcm9vdERpciBvZiB0c2NvbmZpZyksIGJ1dCBpZiBpdCBmYWlscyB0aGlzIGZpZWxkIGlzIHNldCB0byBudWxsLFxuICAgKiBpbmRpY2F0aW5nIHRoYXQgdGhlIGZpbGUgcGF0aCB3YXMgZmFpbGVkIHRvIGJlIGNvbXB1dGVkLiBJbiB0aGlzIGNhc2UsIHRoZSBkb3duc3RyZWFtIGNvbnN1bWVyc1xuICAgKiBvZiB0aGUgZGVidWcgaW5mbyB3aWxsIHVzdWFsbHkgaWdub3JlIHRoZSBgbGluZU51bWJlcmAgZmllbGQgYXMgd2VsbCBhbmQganVzdCBzaG93IHRoZVxuICAgKiBgY2xhc3NOYW1lYC4gRm9yIHNlY3VyaXR5IHJlYXNvbnMgd2UgbmV2ZXIgc2hvdyB0aGUgYWJzb2x1dGUgZmlsZSBwYXRoIGFuZCBwcmVmZXIgdG8ganVzdFxuICAgKiByZXR1cm4gbnVsbCBoZXJlLlxuICAgKi9cbiAgZmlsZVBhdGg6IG8uRXhwcmVzc2lvbiB8IG51bGw7XG5cbiAgLyoqXG4gICAqIEEgbnVtYmVyIGxpdGVyYWwgbnVtYmVyIGNvbnRhaW5pbmcgdGhlIGxpbmUgbnVtYmVyIGluIHdoaWNoIHRoaXMgY2xhc3MgaXMgZGVmaW5lZC5cbiAgICovXG4gIGxpbmVOdW1iZXI6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogV2hldGhlciB0byBjaGVjayBpZiB0aGlzIGNvbXBvbmVudCBpcyBiZWluZyByZW5kZXJlZCB3aXRob3V0IGl0cyBOZ01vZHVsZSBiZWluZyBsb2FkZWQgaW50byB0aGVcbiAgICogYnJvd3Nlci4gU3VjaCBjaGVja3MgaXMgY2FycmllZCBvdXQgb25seSBpbiBkZXYgbW9kZS5cbiAgICovXG4gIGZvcmJpZE9ycGhhblJlbmRlcmluZzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBhbiBuZ0Rldk1vZGUgZ3VhcmRlZCBjYWxsIHRvIHNldENsYXNzRGVidWdJbmZvIHdpdGggdGhlIGRlYnVnIGluZm8gYWJvdXQgdGhlIGNsYXNzXG4gKiAoZS5nLiwgdGhlIGZpbGUgbmFtZSBpbiB3aGljaCB0aGUgY2xhc3MgaXMgZGVmaW5lZClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDbGFzc0RlYnVnSW5mbyhkZWJ1Z0luZm86IFIzQ2xhc3NEZWJ1Z0luZm8pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBkZWJ1Z0luZm9PYmplY3Q6IHtcbiAgICBjbGFzc05hbWU6IG8uRXhwcmVzc2lvbjtcbiAgICBmaWxlUGF0aD86IG8uRXhwcmVzc2lvbjtcbiAgICBsaW5lTnVtYmVyPzogby5FeHByZXNzaW9uO1xuICAgIGZvcmJpZE9ycGhhblJlbmRlcmluZz86IG8uRXhwcmVzc2lvbjtcbiAgfSA9IHtcbiAgICBjbGFzc05hbWU6IGRlYnVnSW5mby5jbGFzc05hbWUsXG4gIH07XG5cbiAgLy8gSW5jbHVkZSBmaWxlIHBhdGggYW5kIGxpbmUgbnVtYmVyIG9ubHkgaWYgdGhlIGZpbGUgcmVsYXRpdmUgcGF0aCBpcyBjYWxjdWxhdGVkIHN1Y2Nlc3NmdWxseS5cbiAgaWYgKGRlYnVnSW5mby5maWxlUGF0aCkge1xuICAgIGRlYnVnSW5mb09iamVjdC5maWxlUGF0aCA9IGRlYnVnSW5mby5maWxlUGF0aDtcbiAgICBkZWJ1Z0luZm9PYmplY3QubGluZU51bWJlciA9IGRlYnVnSW5mby5saW5lTnVtYmVyO1xuICB9XG5cbiAgLy8gSW5jbHVkZSBmb3JiaWRPcnBoYW5SZW5kZXJpbmcgb25seSBpZiBpdCdzIHNldCB0byB0cnVlICh0byByZWR1Y2UgZ2VuZXJhdGVkIGNvZGUpXG4gIGlmIChkZWJ1Z0luZm8uZm9yYmlkT3JwaGFuUmVuZGVyaW5nKSB7XG4gICAgZGVidWdJbmZvT2JqZWN0LmZvcmJpZE9ycGhhblJlbmRlcmluZyA9IG8ubGl0ZXJhbCh0cnVlKTtcbiAgfVxuXG4gIGNvbnN0IGZuQ2FsbCA9IG9cbiAgICAuaW1wb3J0RXhwcihSMy5zZXRDbGFzc0RlYnVnSW5mbylcbiAgICAuY2FsbEZuKFtkZWJ1Z0luZm8udHlwZSwgbWFwTGl0ZXJhbChkZWJ1Z0luZm9PYmplY3QpXSk7XG4gIGNvbnN0IGlpZmUgPSBvLmFycm93Rm4oW10sIFtkZXZPbmx5R3VhcmRlZEV4cHJlc3Npb24oZm5DYWxsKS50b1N0bXQoKV0pO1xuICByZXR1cm4gaWlmZS5jYWxsRm4oW10pO1xufVxuIl19