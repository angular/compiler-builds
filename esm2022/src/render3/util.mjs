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
    const guardUndefinedOrTrue = new o.BinaryOperatorExpr(o.BinaryOperator.Or, guardNotDefined, guardExpr, 
    /* type */ undefined, 
    /* sourceSpan */ undefined, true);
    return new o.BinaryOperatorExpr(o.BinaryOperator.And, guardUndefinedOrTrue, expr);
}
export function wrapReference(value) {
    const wrapped = new o.WrappedNodeExpr(value);
    return { value: wrapped, type: wrapped };
}
export function refsToArray(refs, shouldForwardDeclare) {
    const values = o.literalArr(refs.map((ref) => ref.value));
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
export function convertFromMaybeForwardRefExpression({ expression, forwardRef, }) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDNUQsT0FBTyxLQUFLLENBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUUxQyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFN0MsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQWtCLEVBQUUsU0FBaUI7SUFDdEUsSUFBSSxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDcEIsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFDRCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBZ0JELE1BQU0scUJBQXFCLEdBQUcsR0FBRyxDQUFDO0FBQ2xDLE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxJQUFZO0lBQ3ZELE9BQU8sR0FBRyxxQkFBcUIsR0FBRyxJQUFJLEVBQUUsQ0FBQztBQUMzQyxDQUFDO0FBRUQsTUFBTSxVQUFVLDRCQUE0QixDQUFDLElBQVksRUFBRSxLQUFhO0lBQ3RFLE9BQU8sR0FBRyxxQkFBcUIsR0FBRyxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7QUFDcEQsQ0FBQztBQUVELE1BQU0s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QztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxJQUFrQjtJQUNuRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZXNjYXBlSWRlbnRpZmllcn0gZnJvbSAnLi4vb3V0cHV0L2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24gdHlwZVdpdGhQYXJhbWV0ZXJzKHR5cGU6IG8uRXhwcmVzc2lvbiwgbnVtUGFyYW1zOiBudW1iZXIpOiBvLkV4cHJlc3Npb25UeXBlIHtcbiAgaWYgKG51bVBhcmFtcyA9PT0gMCkge1xuICAgIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKHR5cGUpO1xuICB9XG4gIGNvbnN0IHBhcmFtczogby5UeXBlW10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1QYXJhbXM7IGkrKykge1xuICAgIHBhcmFtcy5wdXNoKG8uRFlOQU1JQ19UWVBFKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZSh0eXBlLCB1bmRlZmluZWQsIHBhcmFtcyk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNSZWZlcmVuY2Uge1xuICB2YWx1ZTogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG59XG5cbi8qKlxuICogUmVzdWx0IG9mIGNvbXBpbGF0aW9uIG9mIGEgcmVuZGVyMyBjb2RlIHVuaXQsIGUuZy4gY29tcG9uZW50LCBkaXJlY3RpdmUsIHBpcGUsIGV0Yy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5UeXBlO1xuICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xufVxuXG5jb25zdCBBTklNQVRFX1NZTUJPTF9QUkVGSVggPSAnQCc7XG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGAke0FOSU1BVEVfU1lNQk9MX1BSRUZJWH0ke25hbWV9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZTogc3RyaW5nLCBwaGFzZTogc3RyaW5nKSB7XG4gIHJldHVybiBgJHtBTklNQVRFX1NZTUJPTF9QUkVGSVh9JHtuYW1lfS4ke3BoYXNlfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmcoYWNjZXNzb3I6IHN0cmluZywgbmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgZXNjYXBlZE5hbWUgPSBlc2NhcGVJZGVudGlmaWVyKG5hbWUsIGZhbHNlLCBmYWxzZSk7XG4gIHJldHVybiBlc2NhcGVkTmFtZSAhPT0gbmFtZSA/IGAke2FjY2Vzc29yfVske2VzY2FwZWROYW1lfV1gIDogYCR7YWNjZXNzb3J9LiR7bmFtZX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKG5hbWU6IHN0cmluZywgcGhhc2U6IHN0cmluZykge1xuICByZXR1cm4gYGFuaW1hdGlvbl8ke25hbWV9XyR7cGhhc2V9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGppdE9ubHlHdWFyZGVkRXhwcmVzc2lvbihleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gZ3VhcmRlZEV4cHJlc3Npb24oJ25nSml0TW9kZScsIGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV2T25seUd1YXJkZWRFeHByZXNzaW9uKGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBndWFyZGVkRXhwcmVzc2lvbignbmdEZXZNb2RlJywgZXhwcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBndWFyZGVkRXhwcmVzc2lvbihndWFyZDogc3RyaW5nLCBleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBndWFyZEV4cHIgPSBuZXcgby5FeHRlcm5hbEV4cHIoe25hbWU6IGd1YXJkLCBtb2R1bGVOYW1lOiBudWxsfSk7XG4gIGNvbnN0IGd1YXJkTm90RGVmaW5lZCA9IG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCxcbiAgICBuZXcgby5UeXBlb2ZFeHByKGd1YXJkRXhwciksXG4gICAgby5saXRlcmFsKCd1bmRlZmluZWQnKSxcbiAgKTtcbiAgY29uc3QgZ3VhcmRVbmRlZmluZWRPclRydWUgPSBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgby5CaW5hcnlPcGVyYXRvci5PcixcbiAgICBndWFyZE5vdERlZmluZWQsXG4gICAgZ3VhcmRFeHByLFxuICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLFxuICAgIC8qIHNvdXJjZVNwYW4gKi8gdW5kZWZpbmVkLFxuICAgIHRydWUsXG4gICk7XG4gIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoby5CaW5hcnlPcGVyYXRvci5BbmQsIGd1YXJkVW5kZWZpbmVkT3JUcnVlLCBleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBSZWZlcmVuY2UodmFsdWU6IGFueSk6IFIzUmVmZXJlbmNlIHtcbiAgY29uc3Qgd3JhcHBlZCA9IG5ldyBvLldyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmc1RvQXJyYXkocmVmczogUjNSZWZlcmVuY2VbXSwgc2hvdWxkRm9yd2FyZERlY2xhcmU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB2YWx1ZXMgPSBvLmxpdGVyYWxBcnIocmVmcy5tYXAoKHJlZikgPT4gcmVmLnZhbHVlKSk7XG4gIHJldHVybiBzaG91bGRGb3J3YXJkRGVjbGFyZSA/IG8uYXJyb3dGbihbXSwgdmFsdWVzKSA6IHZhbHVlcztcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgYW4gZXhwcmVzc2lvbiB0aGF0IG1heSBoYXZlIGJlZW4gd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGd1YXJkLlxuICpcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIGRlc2NyaWJpbmcgZXhwcmVzc2lvbnMgdGhhdCBjYW4gcmVmZXIgdG8gdHlwZXMgdGhhdCBtYXkgZWFnZXJseSByZWZlcmVuY2UgdHlwZXNcbiAqIHRoYXQgaGF2ZSBub3QgeWV0IGJlZW4gZGVmaW5lZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uPFQgZXh0ZW5kcyBvLkV4cHJlc3Npb24gPSBvLkV4cHJlc3Npb24+IHtcbiAgLyoqXG4gICAqIFRoZSB1bndyYXBwZWQgZXhwcmVzc2lvbi5cbiAgICovXG4gIGV4cHJlc3Npb246IFQ7XG4gIC8qKlxuICAgKiBTcGVjaWZpZWQgd2hldGhlciB0aGUgYGV4cHJlc3Npb25gIGNvbnRhaW5zIGEgcmVmZXJlbmNlIHRvIHNvbWV0aGluZyB0aGF0IGhhcyBub3QgeWV0IGJlZW5cbiAgICogZGVmaW5lZCwgYW5kIHdoZXRoZXIgdGhlIGV4cHJlc3Npb24gaXMgc3RpbGwgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGNhbGwuXG4gICAqXG4gICAqIElmIHRoaXMgdmFsdWUgaXMgYEZvcndhcmRSZWZIYW5kbGluZy5Ob25lYCB0aGVuIHRoZSBgZXhwcmVzc2lvbmAgaXMgc2FmZSB0byB1c2UgYXMtaXMuXG4gICAqXG4gICAqIE90aGVyd2lzZSB0aGUgYGV4cHJlc3Npb25gIHdhcyB3cmFwcGVkIGluIGEgY2FsbCB0byBgZm9yd2FyZFJlZigpYCBhbmQgbXVzdCBub3QgYmUgZWFnZXJseVxuICAgKiBldmFsdWF0ZWQuIEluc3RlYWQgaXQgbXVzdCBiZSB3cmFwcGVkIGluIGEgZnVuY3Rpb24gY2xvc3VyZSB0aGF0IHdpbGwgYmUgZXZhbHVhdGVkIGxhemlseSB0b1xuICAgKiBhbGxvdyB0aGUgZGVmaW5pdGlvbiBvZiB0aGUgZXhwcmVzc2lvbiB0byBiZSBldmFsdWF0ZWQgZmlyc3QuXG4gICAqXG4gICAqIEluIGZ1bGwgQU9UIGNvbXBpbGF0aW9uIGl0IGNhbiBiZSBzYWZlIHRvIHVud3JhcCB0aGUgYGZvcndhcmRSZWYoKWAgY2FsbCB1cCBmcm9udCBpZiB0aGVcbiAgICogZXhwcmVzc2lvbiB3aWxsIGFjdHVhbGx5IGJlIGV2YWx1YXRlZCBsYXppbHkgaW5zaWRlIGEgZnVuY3Rpb24gY2FsbCBhZnRlciB0aGUgdmFsdWUgb2ZcbiAgICogYGV4cHJlc3Npb25gIGhhcyBiZWVuIGRlZmluZWQuXG4gICAqXG4gICAqIEJ1dCBpbiBvdGhlciBjYXNlcywgc3VjaCBhcyBwYXJ0aWFsIEFPVCBjb21waWxhdGlvbiBvciBKSVQgY29tcGlsYXRpb24gdGhlIGV4cHJlc3Npb24gd2lsbCBiZVxuICAgKiBldmFsdWF0ZWQgZWFnZXJseSBpbiB0b3AgbGV2ZWwgY29kZSBzbyB3aWxsIG5lZWQgdG8gY29udGludWUgdG8gYmUgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgXG4gICAqIGNhbGwuXG4gICAqXG4gICAqL1xuICBmb3J3YXJkUmVmOiBGb3J3YXJkUmVmSGFuZGxpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uPFQgZXh0ZW5kcyBvLkV4cHJlc3Npb24+KFxuICBleHByZXNzaW9uOiBULFxuICBmb3J3YXJkUmVmOiBGb3J3YXJkUmVmSGFuZGxpbmcsXG4pOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9uPFQ+IHtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCBmb3J3YXJkUmVmfTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgYE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb25gIHRvIGFuIGBFeHByZXNzaW9uYCwgcG9zc2libHkgd3JhcHBpbmcgaXRzIGV4cHJlc3Npb24gaW4gYVxuICogYGZvcndhcmRSZWYoKWAgY2FsbC5cbiAqXG4gKiBJZiBgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbi5mb3J3YXJkUmVmYCBpcyBgRm9yd2FyZFJlZkhhbmRsaW5nLlVud3JhcHBlZGAgdGhlbiB0aGUgZXhwcmVzc2lvblxuICogd2FzIG9yaWdpbmFsbHkgd3JhcHBlZCBpbiBhIGBmb3J3YXJkUmVmKClgIGNhbGwgdG8gcHJldmVudCB0aGUgdmFsdWUgZnJvbSBiZWluZyBlYWdlcmx5IGV2YWx1YXRlZFxuICogaW4gdGhlIGNvZGUuXG4gKlxuICogU2VlIGBwYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2Fubm90YXRpb25zL3NyYy9pbmplY3RhYmxlLnRzYCBhbmRcbiAqIGBwYWNrYWdlcy9jb21waWxlci9zcmMvaml0X2NvbXBpbGVyX2ZhY2FkZS50c2AgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24oe1xuICBleHByZXNzaW9uLFxuICBmb3J3YXJkUmVmLFxufTogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHN3aXRjaCAoZm9yd2FyZFJlZikge1xuICAgIGNhc2UgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmU6XG4gICAgY2FzZSBGb3J3YXJkUmVmSGFuZGxpbmcuV3JhcHBlZDpcbiAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgIGNhc2UgRm9yd2FyZFJlZkhhbmRsaW5nLlVud3JhcHBlZDpcbiAgICAgIHJldHVybiBnZW5lcmF0ZUZvcndhcmRSZWYoZXhwcmVzc2lvbik7XG4gIH1cbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBhbiBleHByZXNzaW9uIHRoYXQgaGFzIHRoZSBnaXZlbiBgZXhwcmAgd3JhcHBlZCBpbiB0aGUgZm9sbG93aW5nIGZvcm06XG4gKlxuICogYGBgXG4gKiBmb3J3YXJkUmVmKCgpID0+IGV4cHIpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRm9yd2FyZFJlZihleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmZvcndhcmRSZWYpLmNhbGxGbihbby5hcnJvd0ZuKFtdLCBleHByKV0pO1xufVxuXG4vKipcbiAqIFNwZWNpZmllcyBob3cgYSBmb3J3YXJkIHJlZiBoYXMgYmVlbiBoYW5kbGVkIGluIGEgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvblxuICovXG5leHBvcnQgY29uc3QgZW51bSBGb3J3YXJkUmVmSGFuZGxpbmcge1xuICAvKiogVGhlIGV4cHJlc3Npb24gd2FzIG5vdCB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbCBpbiB0aGUgZmlyc3QgcGxhY2UuICovXG4gIE5vbmUsXG4gIC8qKiBUaGUgZXhwcmVzc2lvbiBpcyBzdGlsbCB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbC4gKi9cbiAgV3JhcHBlZCxcbiAgLyoqIFRoZSBleHByZXNzaW9uIHdhcyB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbCBidXQgaGFzIHNpbmNlIGJlZW4gdW53cmFwcGVkLiAqL1xuICBVbndyYXBwZWQsXG59XG4iXX0=