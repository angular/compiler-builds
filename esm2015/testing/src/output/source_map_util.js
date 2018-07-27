/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const b64 = require('base64-js');
const SourceMapConsumer = require('source-map').SourceMapConsumer;
export function originalPositionFor(sourceMap, genPosition) {
    const smc = new SourceMapConsumer(sourceMap);
    // Note: We don't return the original object as it also contains a `name` property
    // which is always null and we don't want to include that in our assertions...
    const { line, column, source } = smc.originalPositionFor(genPosition);
    return { line, column, source };
}
export function extractSourceMap(source) {
    let idx = source.lastIndexOf('\n//#');
    if (idx == -1)
        return null;
    const smComment = source.slice(idx).trim();
    const smB64 = smComment.split('sourceMappingURL=data:application/json;base64,')[1];
    return smB64 ? JSON.parse(decodeB64String(smB64)) : null;
}
function decodeB64String(s) {
    return b64.toByteArray(s).reduce((s, c) => s + String.fromCharCode(c), '');
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlX21hcF91dGlsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvdGVzdGluZy9zcmMvb3V0cHV0L3NvdXJjZV9tYXBfdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDakMsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsaUJBQWlCLENBQUM7QUFRbEUsTUFBTSw4QkFDRixTQUFvQixFQUNwQixXQUF5RDtJQUMzRCxNQUFNLEdBQUcsR0FBRyxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLGtGQUFrRjtJQUNsRiw4RUFBOEU7SUFDOUUsTUFBTSxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFDLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3BFLE9BQU8sRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRCxNQUFNLDJCQUEyQixNQUFjO0lBQzdDLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdEMsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDM0IsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMzQyxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkYsT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUMzRCxDQUFDO0FBRUQseUJBQXlCLENBQVM7SUFDaEMsT0FBTyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQVMsRUFBRSxDQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzdGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U291cmNlTWFwfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5jb25zdCBiNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKTtcbmNvbnN0IFNvdXJjZU1hcENvbnN1bWVyID0gcmVxdWlyZSgnc291cmNlLW1hcCcpLlNvdXJjZU1hcENvbnN1bWVyO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNvdXJjZUxvY2F0aW9uIHtcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbiAgc291cmNlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcmlnaW5hbFBvc2l0aW9uRm9yKFxuICAgIHNvdXJjZU1hcDogU291cmNlTWFwLFxuICAgIGdlblBvc2l0aW9uOiB7bGluZTogbnVtYmVyIHwgbnVsbCwgY29sdW1uOiBudW1iZXIgfCBudWxsfSk6IFNvdXJjZUxvY2F0aW9uIHtcbiAgY29uc3Qgc21jID0gbmV3IFNvdXJjZU1hcENvbnN1bWVyKHNvdXJjZU1hcCk7XG4gIC8vIE5vdGU6IFdlIGRvbid0IHJldHVybiB0aGUgb3JpZ2luYWwgb2JqZWN0IGFzIGl0IGFsc28gY29udGFpbnMgYSBgbmFtZWAgcHJvcGVydHlcbiAgLy8gd2hpY2ggaXMgYWx3YXlzIG51bGwgYW5kIHdlIGRvbid0IHdhbnQgdG8gaW5jbHVkZSB0aGF0IGluIG91ciBhc3NlcnRpb25zLi4uXG4gIGNvbnN0IHtsaW5lLCBjb2x1bW4sIHNvdXJjZX0gPSBzbWMub3JpZ2luYWxQb3NpdGlvbkZvcihnZW5Qb3NpdGlvbik7XG4gIHJldHVybiB7bGluZSwgY29sdW1uLCBzb3VyY2V9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFNvdXJjZU1hcChzb3VyY2U6IHN0cmluZyk6IFNvdXJjZU1hcHxudWxsIHtcbiAgbGV0IGlkeCA9IHNvdXJjZS5sYXN0SW5kZXhPZignXFxuLy8jJyk7XG4gIGlmIChpZHggPT0gLTEpIHJldHVybiBudWxsO1xuICBjb25zdCBzbUNvbW1lbnQgPSBzb3VyY2Uuc2xpY2UoaWR4KS50cmltKCk7XG4gIGNvbnN0IHNtQjY0ID0gc21Db21tZW50LnNwbGl0KCdzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsJylbMV07XG4gIHJldHVybiBzbUI2NCA/IEpTT04ucGFyc2UoZGVjb2RlQjY0U3RyaW5nKHNtQjY0KSkgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBkZWNvZGVCNjRTdHJpbmcoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGI2NC50b0J5dGVBcnJheShzKS5yZWR1Y2UoKHM6IHN0cmluZywgYzogbnVtYmVyKSA9PiBzICsgU3RyaW5nLmZyb21DaGFyQ29kZShjKSwgJycpO1xufVxuIl19