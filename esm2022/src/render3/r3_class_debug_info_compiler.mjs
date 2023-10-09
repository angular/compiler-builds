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
    const fnCall = o.importExpr(R3.setClassDebugInfo).callFn([
        debugInfo.type,
        mapLiteral(debugInfoObject),
    ]);
    const iife = o.arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]);
    return iife.callFn([]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY2xhc3NfZGVidWdfaW5mb19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2NsYXNzX2RlYnVnX2luZm9fY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFMUMsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFpQ2hEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxxQkFBcUIsQ0FBQyxTQUEyQjtJQUMvRCxNQUFNLGVBQWUsR0FDZ0U7UUFDL0UsU0FBUyxFQUFFLFNBQVMsQ0FBQyxTQUFTO0tBQy9CLENBQUM7SUFFTiwrRkFBK0Y7SUFDL0YsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFO1FBQ3RCLGVBQWUsQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQztRQUM5QyxlQUFlLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUM7S0FDbkQ7SUFFRCxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUN2RCxTQUFTLENBQUMsSUFBSTtRQUNkLFVBQVUsQ0FBQyxlQUFlLENBQUM7S0FDNUIsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDeEUsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHttYXBMaXRlcmFsfSBmcm9tICcuLi9vdXRwdXQvbWFwX3V0aWwnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtkZXZPbmx5R3VhcmRlZEV4cHJlc3Npb259IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogSW5mbyBuZWVkZWQgZm9yIHJ1bnRpbWUgZXJyb3JzIHJlbGF0ZWQgdG8gYSBjbGFzcywgc3VjaCBhcyB0aGUgbG9jYXRpb24gaW4gd2hpY2ggdGhlIGNsYXNzIGlzXG4gKiBkZWZpbmVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzQ2xhc3NEZWJ1Z0luZm8ge1xuICAvKiogVGhlIGNsYXNzIGlkZW50aWZpZXIgKi9cbiAgdHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBIHN0cmluZyBsaXRlcmFsIGNvbnRhaW5pbmcgdGhlIG9yaWdpbmFsIGNsYXNzIG5hbWUgYXMgYXBwZWFycyBpbiBpdHMgZGVmaW5pdGlvbi5cbiAgICovXG4gIGNsYXNzTmFtZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBIHN0cmluZyBsaXRlcmFsIGNvbnRhaW5pbmcgdGhlIHJlbGF0aXZlIHBhdGggb2YgdGhlIGZpbGUgaW4gd2hpY2ggdGhlIGNsYXNzIGlzIGRlZmluZWQuXG4gICAqXG4gICAqIFRoZSBwYXRoIGlzIHJlbGF0aXZlIHRvIHRoZSBwcm9qZWN0IHJvb3QuIFRoZSBjb21waWxlciBkb2VzIHRoZSBiZXN0IGVmZm9ydCB0byBmaW5kIHRoZSBwcm9qZWN0XG4gICAqIHJvb3QgKGUuZy4sIHVzaW5nIHRoZSByb290RGlyIG9mIHRzY29uZmlnKSwgYnV0IGlmIGl0IGZhaWxzIHRoaXMgZmllbGQgaXMgc2V0IHRvIG51bGwsXG4gICAqIGluZGljYXRpbmcgdGhhdCB0aGUgZmlsZSBwYXRoIHdhcyBmYWlsZWQgdG8gYmUgY29tcHV0ZWQuIEluIHRoaXMgY2FzZSwgdGhlIGRvd25zdHJlYW0gY29uc3VtZXJzXG4gICAqIG9mIHRoZSBkZWJ1ZyBpbmZvIHdpbGwgdXN1YWxseSBpZ25vcmUgdGhlIGBsaW5lTnVtYmVyYCBmaWVsZCBhcyB3ZWxsIGFuZCBqdXN0IHNob3cgdGhlXG4gICAqIGBjbGFzc05hbWVgLiBGb3Igc2VjdXJpdHkgcmVhc29ucyB3ZSBuZXZlciBzaG93IHRoZSBhYnNvbHV0ZSBmaWxlIHBhdGggYW5kIHByZWZlciB0byBqdXN0XG4gICAqIHJldHVybiBudWxsIGhlcmUuXG4gICAqL1xuICBmaWxlUGF0aDogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIEEgbnVtYmVyIGxpdGVyYWwgbnVtYmVyIGNvbnRhaW5pbmcgdGhlIGxpbmUgbnVtYmVyIGluIHdoaWNoIHRoaXMgY2xhc3MgaXMgZGVmaW5lZC5cbiAgICovXG4gIGxpbmVOdW1iZXI6IG8uRXhwcmVzc2lvbjtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBhbiBuZ0Rldk1vZGUgZ3VhcmRlZCBjYWxsIHRvIHNldENsYXNzRGVidWdJbmZvIHdpdGggdGhlIGRlYnVnIGluZm8gYWJvdXQgdGhlIGNsYXNzXG4gKiAoZS5nLiwgdGhlIGZpbGUgbmFtZSBpbiB3aGljaCB0aGUgY2xhc3MgaXMgZGVmaW5lZClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDbGFzc0RlYnVnSW5mbyhkZWJ1Z0luZm86IFIzQ2xhc3NEZWJ1Z0luZm8pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBkZWJ1Z0luZm9PYmplY3Q6XG4gICAgICB7Y2xhc3NOYW1lOiBvLkV4cHJlc3Npb247IGZpbGVQYXRoPzogby5FeHByZXNzaW9uOyBsaW5lTnVtYmVyPzogby5FeHByZXNzaW9uO30gPSB7XG4gICAgICAgIGNsYXNzTmFtZTogZGVidWdJbmZvLmNsYXNzTmFtZSxcbiAgICAgIH07XG5cbiAgLy8gSW5jbHVkZSBmaWxlIHBhdGggYW5kIGxpbmUgbnVtYmVyIG9ubHkgaWYgdGhlIGZpbGUgcmVsYXRpdmUgcGF0aCBpcyBjYWxjdWxhdGVkIHN1Y2Nlc3NmdWxseS5cbiAgaWYgKGRlYnVnSW5mby5maWxlUGF0aCkge1xuICAgIGRlYnVnSW5mb09iamVjdC5maWxlUGF0aCA9IGRlYnVnSW5mby5maWxlUGF0aDtcbiAgICBkZWJ1Z0luZm9PYmplY3QubGluZU51bWJlciA9IGRlYnVnSW5mby5saW5lTnVtYmVyO1xuICB9XG5cbiAgY29uc3QgZm5DYWxsID0gby5pbXBvcnRFeHByKFIzLnNldENsYXNzRGVidWdJbmZvKS5jYWxsRm4oW1xuICAgIGRlYnVnSW5mby50eXBlLFxuICAgIG1hcExpdGVyYWwoZGVidWdJbmZvT2JqZWN0KSxcbiAgXSk7XG4gIGNvbnN0IGlpZmUgPSBvLmFycm93Rm4oW10sIFtkZXZPbmx5R3VhcmRlZEV4cHJlc3Npb24oZm5DYWxsKS50b1N0bXQoKV0pO1xuICByZXR1cm4gaWlmZS5jYWxsRm4oW10pO1xufVxuIl19