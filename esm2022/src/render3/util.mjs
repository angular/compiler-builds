/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { escapeIdentifier } from '../output/abstract_emitter';
import * as o from '../output/output_ast';
import { Identifiers } from './r3_identifiers';
export function typeWithParameters(type, numParams) {
    if (numParams === 0) {
        return o.expressionType(type);
    }
    const params = [];
    for (let i = 0; i < numParams; i++) {
        params.push(o.DYNAMIC_TYPE);
    }
    return o.expressionType(type, undefined, params);
}
const ANIMATE_SYMBOL_PREFIX = '@';
export function prepareSyntheticPropertyName(name) {
    return `${ANIMATE_SYMBOL_PREFIX}${name}`;
}
export function prepareSyntheticListenerName(name, phase) {
    return `${ANIMATE_SYMBOL_PREFIX}${name}.${phase}`;
}
export function getSafePropertyAccessString(accessor, name) {
    const escapedName = escapeIdentifier(name, false, false);
    return escapedName !== name ? `${accessor}[${escapedName}]` : `${accessor}.${name}`;
}
export function prepareSyntheticListenerFunctionName(name, phase) {
    return `animation_${name}_${phase}`;
}
export function jitOnlyGuardedExpression(expr) {
    return guardedExpression('ngJitMode', expr);
}
export function devOnlyGuardedExpression(expr) {
    return guardedExpression('ngDevMode', expr);
}
export function guardedExpression(guard, expr) {
    const guardExpr = new o.ExternalExpr({ name: guard, moduleName: null });
    const guardNotDefined = new o.BinaryOperatorExpr(o.BinaryOperator.Identical, new o.TypeofExpr(guardExpr), o.literal('undefined'));
    const guardUndefinedOrTrue = new o.BinaryOperatorExpr(o.BinaryOperator.Or, guardNotDefined, guardExpr, /* type */ undefined, 
    /* sourceSpan */ undefined, true);
    return new o.BinaryOperatorExpr(o.BinaryOperator.And, guardUndefinedOrTrue, expr);
}
export function wrapReference(value) {
    const wrapped = new o.WrappedNodeExpr(value);
    return { value: wrapped, type: wrapped };
}
export function refsToArray(refs, shouldForwardDeclare) {
    const values = o.literalArr(refs.map(ref => ref.value));
    return shouldForwardDeclare ? o.arrowFn([], values) : values;
}
export function createMayBeForwardRefExpression(expression, forwardRef) {
    return { expression, forwardRef };
}
/**
 * Convert a `MaybeForwardRefExpression` to an `Expression`, possibly wrapping its expression in a
 * `forwardRef()` call.
 *
 * If `MaybeForwardRefExpression.forwardRef` is `ForwardRefHandling.Unwrapped` then the expression
 * was originally wrapped in a `forwardRef()` call to prevent the value from being eagerly evaluated
 * in the code.
 *
 * See `packages/compiler-cli/src/ngtsc/annotations/src/injectable.ts` and
 * `packages/compiler/src/jit_compiler_facade.ts` for more information.
 */
export function convertFromMaybeForwardRefExpression({ expression, forwardRef }) {
    switch (forwardRef) {
        case 0 /* ForwardRefHandling.None */:
        case 1 /* ForwardRefHandling.Wrapped */:
            return expression;
        case 2 /* ForwardRefHandling.Unwrapped */:
            return generateForwardRef(expression);
    }
}
/**
 * Generate an expression that has the given `expr` wrapped in the following form:
 *
 * ```
 * forwardRef(() => expr)
 * ```
 */
export function generateForwardRef(expr) {
    return o.importExpr(Identifiers.forwardRef).callFn([o.arrowFn([], expr)]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDNUQsT0FBTyxLQUFLLENBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUUxQyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFN0MsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQWtCLEVBQUUsU0FBaUI7SUFDdEUsSUFBSSxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDcEIsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFDRCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBZ0JELE1BQU0scUJBQXFCLEdBQUcsR0FBRyxDQUFDO0FBQ2xDLE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxJQUFZO0lBQ3ZELE9BQU8sR0FBRyxxQkFBcUIsR0FBRyxJQUFJLEVBQUUsQ0FBQztBQUMzQyxDQUFDO0FBRUQsTUFBTSxVQUFVLDRCQUE0QixDQUFDLElBQVksRUFBRSxLQUFhO0lBQ3RFLE9BQU8sR0FBRyxxQkFBcUIsR0FBRyxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7QUFDcEQsQ0FBQztBQUVELE1BQU0s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Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsSUFBa0I7SUFDbkQsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2VzY2FwZUlkZW50aWZpZXJ9IGZyb20gJy4uL291dHB1dC9hYnN0cmFjdF9lbWl0dGVyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL3IzX2lkZW50aWZpZXJzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHR5cGVXaXRoUGFyYW1ldGVycyh0eXBlOiBvLkV4cHJlc3Npb24sIG51bVBhcmFtczogbnVtYmVyKTogby5FeHByZXNzaW9uVHlwZSB7XG4gIGlmIChudW1QYXJhbXMgPT09IDApIHtcbiAgICByZXR1cm4gby5leHByZXNzaW9uVHlwZSh0eXBlKTtcbiAgfVxuICBjb25zdCBwYXJhbXM6IG8uVHlwZVtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtUGFyYW1zOyBpKyspIHtcbiAgICBwYXJhbXMucHVzaChvLkRZTkFNSUNfVFlQRSk7XG4gIH1cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUodHlwZSwgdW5kZWZpbmVkLCBwYXJhbXMpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzUmVmZXJlbmNlIHtcbiAgdmFsdWU6IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5FeHByZXNzaW9uO1xufVxuXG4vKipcbiAqIFJlc3VsdCBvZiBjb21waWxhdGlvbiBvZiBhIHJlbmRlcjMgY29kZSB1bml0LCBlLmcuIGNvbXBvbmVudCwgZGlyZWN0aXZlLCBwaXBlLCBldGMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuY29uc3QgQU5JTUFURV9TWU1CT0xfUFJFRklYID0gJ0AnO1xuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBgJHtBTklNQVRFX1NZTUJPTF9QUkVGSVh9JHtuYW1lfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWU6IHN0cmluZywgcGhhc2U6IHN0cmluZykge1xuICByZXR1cm4gYCR7QU5JTUFURV9TWU1CT0xfUFJFRklYfSR7bmFtZX0uJHtwaGFzZX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nKGFjY2Vzc29yOiBzdHJpbmcsIG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGVzY2FwZWROYW1lID0gZXNjYXBlSWRlbnRpZmllcihuYW1lLCBmYWxzZSwgZmFsc2UpO1xuICByZXR1cm4gZXNjYXBlZE5hbWUgIT09IG5hbWUgPyBgJHthY2Nlc3Nvcn1bJHtlc2NhcGVkTmFtZX1dYCA6IGAke2FjY2Vzc29yfS4ke25hbWV9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShuYW1lOiBzdHJpbmcsIHBoYXNlOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGBhbmltYXRpb25fJHtuYW1lfV8ke3BoYXNlfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBqaXRPbmx5R3VhcmRlZEV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGd1YXJkZWRFeHByZXNzaW9uKCduZ0ppdE1vZGUnLCBleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldk9ubHlHdWFyZGVkRXhwcmVzc2lvbihleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gZ3VhcmRlZEV4cHJlc3Npb24oJ25nRGV2TW9kZScsIGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ3VhcmRlZEV4cHJlc3Npb24oZ3VhcmQ6IHN0cmluZywgZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgZ3VhcmRFeHByID0gbmV3IG8uRXh0ZXJuYWxFeHByKHtuYW1lOiBndWFyZCwgbW9kdWxlTmFtZTogbnVsbH0pO1xuICBjb25zdCBndWFyZE5vdERlZmluZWQgPSBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCwgbmV3IG8uVHlwZW9mRXhwcihndWFyZEV4cHIpLCBvLmxpdGVyYWwoJ3VuZGVmaW5lZCcpKTtcbiAgY29uc3QgZ3VhcmRVbmRlZmluZWRPclRydWUgPSBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICBvLkJpbmFyeU9wZXJhdG9yLk9yLCBndWFyZE5vdERlZmluZWQsIGd1YXJkRXhwciwgLyogdHlwZSAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBzb3VyY2VTcGFuICovIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoby5CaW5hcnlPcGVyYXRvci5BbmQsIGd1YXJkVW5kZWZpbmVkT3JUcnVlLCBleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBSZWZlcmVuY2UodmFsdWU6IGFueSk6IFIzUmVmZXJlbmNlIHtcbiAgY29uc3Qgd3JhcHBlZCA9IG5ldyBvLldyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmc1RvQXJyYXkocmVmczogUjNSZWZlcmVuY2VbXSwgc2hvdWxkRm9yd2FyZERlY2xhcmU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB2YWx1ZXMgPSBvLmxpdGVyYWxBcnIocmVmcy5tYXAocmVmID0+IHJlZi52YWx1ZSkpO1xuICByZXR1cm4gc2hvdWxkRm9yd2FyZERlY2xhcmUgPyBvLmFycm93Rm4oW10sIHZhbHVlcykgOiB2YWx1ZXM7XG59XG5cblxuLyoqXG4gKiBEZXNjcmliZXMgYW4gZXhwcmVzc2lvbiB0aGF0IG1heSBoYXZlIGJlZW4gd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGd1YXJkLlxuICpcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIGRlc2NyaWJpbmcgZXhwcmVzc2lvbnMgdGhhdCBjYW4gcmVmZXIgdG8gdHlwZXMgdGhhdCBtYXkgZWFnZXJseSByZWZlcmVuY2UgdHlwZXNcbiAqIHRoYXQgaGF2ZSBub3QgeWV0IGJlZW4gZGVmaW5lZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uPFQgZXh0ZW5kcyBvLkV4cHJlc3Npb24gPSBvLkV4cHJlc3Npb24+IHtcbiAgLyoqXG4gICAqIFRoZSB1bndyYXBwZWQgZXhwcmVzc2lvbi5cbiAgICovXG4gIGV4cHJlc3Npb246IFQ7XG4gIC8qKlxuICAgKiBTcGVjaWZpZWQgd2hldGhlciB0aGUgYGV4cHJlc3Npb25gIGNvbnRhaW5zIGEgcmVmZXJlbmNlIHRvIHNvbWV0aGluZyB0aGF0IGhhcyBub3QgeWV0IGJlZW5cbiAgICogZGVmaW5lZCwgYW5kIHdoZXRoZXIgdGhlIGV4cHJlc3Npb24gaXMgc3RpbGwgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGNhbGwuXG4gICAqXG4gICAqIElmIHRoaXMgdmFsdWUgaXMgYEZvcndhcmRSZWZIYW5kbGluZy5Ob25lYCB0aGVuIHRoZSBgZXhwcmVzc2lvbmAgaXMgc2FmZSB0byB1c2UgYXMtaXMuXG4gICAqXG4gICAqIE90aGVyd2lzZSB0aGUgYGV4cHJlc3Npb25gIHdhcyB3cmFwcGVkIGluIGEgY2FsbCB0byBgZm9yd2FyZFJlZigpYCBhbmQgbXVzdCBub3QgYmUgZWFnZXJseVxuICAgKiBldmFsdWF0ZWQuIEluc3RlYWQgaXQgbXVzdCBiZSB3cmFwcGVkIGluIGEgZnVuY3Rpb24gY2xvc3VyZSB0aGF0IHdpbGwgYmUgZXZhbHVhdGVkIGxhemlseSB0b1xuICAgKiBhbGxvdyB0aGUgZGVmaW5pdGlvbiBvZiB0aGUgZXhwcmVzc2lvbiB0byBiZSBldmFsdWF0ZWQgZmlyc3QuXG4gICAqXG4gICAqIEluIGZ1bGwgQU9UIGNvbXBpbGF0aW9uIGl0IGNhbiBiZSBzYWZlIHRvIHVud3JhcCB0aGUgYGZvcndhcmRSZWYoKWAgY2FsbCB1cCBmcm9udCBpZiB0aGVcbiAgICogZXhwcmVzc2lvbiB3aWxsIGFjdHVhbGx5IGJlIGV2YWx1YXRlZCBsYXppbHkgaW5zaWRlIGEgZnVuY3Rpb24gY2FsbCBhZnRlciB0aGUgdmFsdWUgb2ZcbiAgICogYGV4cHJlc3Npb25gIGhhcyBiZWVuIGRlZmluZWQuXG4gICAqXG4gICAqIEJ1dCBpbiBvdGhlciBjYXNlcywgc3VjaCBhcyBwYXJ0aWFsIEFPVCBjb21waWxhdGlvbiBvciBKSVQgY29tcGlsYXRpb24gdGhlIGV4cHJlc3Npb24gd2lsbCBiZVxuICAgKiBldmFsdWF0ZWQgZWFnZXJseSBpbiB0b3AgbGV2ZWwgY29kZSBzbyB3aWxsIG5lZWQgdG8gY29udGludWUgdG8gYmUgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgXG4gICAqIGNhbGwuXG4gICAqXG4gICAqL1xuICBmb3J3YXJkUmVmOiBGb3J3YXJkUmVmSGFuZGxpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uPFQgZXh0ZW5kcyBvLkV4cHJlc3Npb24+KFxuICAgIGV4cHJlc3Npb246IFQsIGZvcndhcmRSZWY6IEZvcndhcmRSZWZIYW5kbGluZyk6IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb248VD4ge1xuICByZXR1cm4ge2V4cHJlc3Npb24sIGZvcndhcmRSZWZ9O1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSBgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbmAgdG8gYW4gYEV4cHJlc3Npb25gLCBwb3NzaWJseSB3cmFwcGluZyBpdHMgZXhwcmVzc2lvbiBpbiBhXG4gKiBgZm9yd2FyZFJlZigpYCBjYWxsLlxuICpcbiAqIElmIGBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLmZvcndhcmRSZWZgIGlzIGBGb3J3YXJkUmVmSGFuZGxpbmcuVW53cmFwcGVkYCB0aGVuIHRoZSBleHByZXNzaW9uXG4gKiB3YXMgb3JpZ2luYWxseSB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbCB0byBwcmV2ZW50IHRoZSB2YWx1ZSBmcm9tIGJlaW5nIGVhZ2VybHkgZXZhbHVhdGVkXG4gKiBpbiB0aGUgY29kZS5cbiAqXG4gKiBTZWUgYHBhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvYW5ub3RhdGlvbnMvc3JjL2luamVjdGFibGUudHNgIGFuZFxuICogYHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzYCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihcbiAgICB7ZXhwcmVzc2lvbiwgZm9yd2FyZFJlZn06IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICBzd2l0Y2ggKGZvcndhcmRSZWYpIHtcbiAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lOlxuICAgIGNhc2UgRm9yd2FyZFJlZkhhbmRsaW5nLldyYXBwZWQ6XG4gICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5VbndyYXBwZWQ6XG4gICAgICByZXR1cm4gZ2VuZXJhdGVGb3J3YXJkUmVmKGV4cHJlc3Npb24pO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGUgYW4gZXhwcmVzc2lvbiB0aGF0IGhhcyB0aGUgZ2l2ZW4gYGV4cHJgIHdyYXBwZWQgaW4gdGhlIGZvbGxvd2luZyBmb3JtOlxuICpcbiAqIGBgYFxuICogZm9yd2FyZFJlZigoKSA9PiBleHByKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUZvcndhcmRSZWYoZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5mb3J3YXJkUmVmKS5jYWxsRm4oW28uYXJyb3dGbihbXSwgZXhwcildKTtcbn1cblxuLyoqXG4gKiBTcGVjaWZpZXMgaG93IGEgZm9yd2FyZCByZWYgaGFzIGJlZW4gaGFuZGxlZCBpbiBhIE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb25cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gRm9yd2FyZFJlZkhhbmRsaW5nIHtcbiAgLyoqIFRoZSBleHByZXNzaW9uIHdhcyBub3Qgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGNhbGwgaW4gdGhlIGZpcnN0IHBsYWNlLiAqL1xuICBOb25lLFxuICAvKiogVGhlIGV4cHJlc3Npb24gaXMgc3RpbGwgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGNhbGwuICovXG4gIFdyYXBwZWQsXG4gIC8qKiBUaGUgZXhwcmVzc2lvbiB3YXMgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGNhbGwgYnV0IGhhcyBzaW5jZSBiZWVuIHVud3JhcHBlZC4gKi9cbiAgVW53cmFwcGVkLFxufVxuIl19