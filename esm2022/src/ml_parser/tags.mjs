/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export var TagContentType;
(function (TagContentType) {
    TagContentType[TagContentType["RAW_TEXT"] = 0] = "RAW_TEXT";
    TagContentType[TagContentType["ESCAPABLE_RAW_TEXT"] = 1] = "ESCAPABLE_RAW_TEXT";
    TagContentType[TagContentType["PARSABLE_DATA"] = 2] = "PARSABLE_DATA";
})(TagContentType || (TagContentType = {}));
export function splitNsName(elementName) {
    if (elementName[0] != ':') {
        return [null, elementName];
    }
    const colonIndex = elementName.indexOf(':', 1);
    if (colonIndex === -1) {
        throw new Error(`Unsupported format "${elementName}" expecting ":namespace:name"`);
    }
    return [elementName.slice(1, colonIndex), elementName.slice(colonIndex + 1)];
}
// `<ng-container>` tags work the same regardless the namespace
export function isNgContainer(tagName) {
    return splitNsName(tagName)[1] === 'ng-container';
}
// `<ng-content>` tags work the same regardless the namespace
export function isNgContent(tagName) {
    return splitNsName(tagName)[1] === 'ng-content';
}
// `<ng-template>` tags work the same regardless the namespace
export function isNgTemplate(tagName) {
    return splitNsName(tagName)[1] === 'ng-template';
}
export function getNsPrefix(fullName) {
    return fullName === null ? null : splitNsName(fullName)[0];
}
export function mergeNsAndName(prefix, localName) {
    return prefix ? `:${prefix}:${localName}` : localName;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9tbF9wYXJzZXIvdGFncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxNQUFNLENBQU4sSUFBWSxjQUlYO0FBSkQsV0FBWSxjQUFjO0lBQ3hCLDJEQUFRLENBQUE7SUFDUiwrRUFBa0IsQ0FBQTtJQUNsQixxRUFBYSxDQUFBO0FBQ2YsQ0FBQyxFQUpXLGNBQWMsS0FBZCxjQUFjLFFBSXpCO0FBY0QsTUFBTSxVQUFVLFdBQVcsQ0FBQyxXQUFtQjtJQUM3QyxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMxQixPQUFPLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUUvQyxJQUFJLFVBQVUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLFdBQVcsK0JBQStCLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBRUQsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0UsQ0FBQztBQUVELCtEQUErRDtBQUMvRCxNQUFNLFVBQVUsYUFBYSxDQUFDLE9BQWU7SUFDM0MsT0FBTyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssY0FBYyxDQUFDO0FBQ3BELENBQUM7QUFFRCw2REFBNkQ7QUFDN0QsTUFBTSxVQUFVLFdBQVcsQ0FBQyxPQUFlO0lBQ3pDLE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLFlBQVksQ0FBQztBQUNsRCxDQUFDO0FBRUQsOERBQThEO0FBQzlELE1BQU0sVUFBVSxZQUFZLENBQUMsT0FBZTtJQUMxQyxPQUFPLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxhQUFhLENBQUM7QUFDbkQsQ0FBQztBQUlELE1BQU0sVUFBVSxXQUFXLENBQUMsUUFBcUI7SUFDL0MsT0FBTyxRQUFRLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3RCxDQUFDO0FBRUQsTUFBTSxVQUFVLGNBQWMsQ0FBQyxNQUFjLEVBQUUsU0FBaUI7SUFDOUQsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxJQUFJLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDeEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgZW51bSBUYWdDb250ZW50VHlwZSB7XG4gIFJBV19URVhULFxuICBFU0NBUEFCTEVfUkFXX1RFWFQsXG4gIFBBUlNBQkxFX0RBVEFcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWdEZWZpbml0aW9uIHtcbiAgY2xvc2VkQnlQYXJlbnQ6IGJvb2xlYW47XG4gIGltcGxpY2l0TmFtZXNwYWNlUHJlZml4OiBzdHJpbmd8bnVsbDtcbiAgaXNWb2lkOiBib29sZWFuO1xuICBpZ25vcmVGaXJzdExmOiBib29sZWFuO1xuICBjYW5TZWxmQ2xvc2U6IGJvb2xlYW47XG4gIHByZXZlbnROYW1lc3BhY2VJbmhlcml0YW5jZTogYm9vbGVhbjtcblxuICBpc0Nsb3NlZEJ5Q2hpbGQobmFtZTogc3RyaW5nKTogYm9vbGVhbjtcbiAgZ2V0Q29udGVudFR5cGUocHJlZml4Pzogc3RyaW5nKTogVGFnQ29udGVudFR5cGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdE5zTmFtZShlbGVtZW50TmFtZTogc3RyaW5nKTogW3N0cmluZ3xudWxsLCBzdHJpbmddIHtcbiAgaWYgKGVsZW1lbnROYW1lWzBdICE9ICc6Jykge1xuICAgIHJldHVybiBbbnVsbCwgZWxlbWVudE5hbWVdO1xuICB9XG5cbiAgY29uc3QgY29sb25JbmRleCA9IGVsZW1lbnROYW1lLmluZGV4T2YoJzonLCAxKTtcblxuICBpZiAoY29sb25JbmRleCA9PT0gLTEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZvcm1hdCBcIiR7ZWxlbWVudE5hbWV9XCIgZXhwZWN0aW5nIFwiOm5hbWVzcGFjZTpuYW1lXCJgKTtcbiAgfVxuXG4gIHJldHVybiBbZWxlbWVudE5hbWUuc2xpY2UoMSwgY29sb25JbmRleCksIGVsZW1lbnROYW1lLnNsaWNlKGNvbG9uSW5kZXggKyAxKV07XG59XG5cbi8vIGA8bmctY29udGFpbmVyPmAgdGFncyB3b3JrIHRoZSBzYW1lIHJlZ2FyZGxlc3MgdGhlIG5hbWVzcGFjZVxuZXhwb3J0IGZ1bmN0aW9uIGlzTmdDb250YWluZXIodGFnTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBzcGxpdE5zTmFtZSh0YWdOYW1lKVsxXSA9PT0gJ25nLWNvbnRhaW5lcic7XG59XG5cbi8vIGA8bmctY29udGVudD5gIHRhZ3Mgd29yayB0aGUgc2FtZSByZWdhcmRsZXNzIHRoZSBuYW1lc3BhY2VcbmV4cG9ydCBmdW5jdGlvbiBpc05nQ29udGVudCh0YWdOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHNwbGl0TnNOYW1lKHRhZ05hbWUpWzFdID09PSAnbmctY29udGVudCc7XG59XG5cbi8vIGA8bmctdGVtcGxhdGU+YCB0YWdzIHdvcmsgdGhlIHNhbWUgcmVnYXJkbGVzcyB0aGUgbmFtZXNwYWNlXG5leHBvcnQgZnVuY3Rpb24gaXNOZ1RlbXBsYXRlKHRhZ05hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gc3BsaXROc05hbWUodGFnTmFtZSlbMV0gPT09ICduZy10ZW1wbGF0ZSc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROc1ByZWZpeChmdWxsTmFtZTogc3RyaW5nKTogc3RyaW5nO1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5zUHJlZml4KGZ1bGxOYW1lOiBudWxsKTogbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBnZXROc1ByZWZpeChmdWxsTmFtZTogc3RyaW5nfG51bGwpOiBzdHJpbmd8bnVsbCB7XG4gIHJldHVybiBmdWxsTmFtZSA9PT0gbnVsbCA/IG51bGwgOiBzcGxpdE5zTmFtZShmdWxsTmFtZSlbMF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZU5zQW5kTmFtZShwcmVmaXg6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcHJlZml4ID8gYDoke3ByZWZpeH06JHtsb2NhbE5hbWV9YCA6IGxvY2FsTmFtZTtcbn1cbiJdfQ==