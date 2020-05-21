/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/aot/util", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createLoweredSymbol = exports.isLoweredSymbol = exports.stripSummaryForJitNameSuffix = exports.summaryForJitName = exports.stripSummaryForJitFileSuffix = exports.summaryForJitFileName = exports.summaryFileName = exports.normalizeGenFileSuffix = exports.splitTypescriptSuffix = exports.isGeneratedFile = exports.stripGeneratedFileSuffix = exports.ngfactoryFilePath = void 0;
    var STRIP_SRC_FILE_SUFFIXES = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
    var GENERATED_FILE = /\.ngfactory\.|\.ngsummary\./;
    var JIT_SUMMARY_FILE = /\.ngsummary\./;
    var JIT_SUMMARY_NAME = /NgSummary$/;
    function ngfactoryFilePath(filePath, forceSourceFile) {
        if (forceSourceFile === void 0) { forceSourceFile = false; }
        var urlWithSuffix = splitTypescriptSuffix(filePath, forceSourceFile);
        return urlWithSuffix[0] + ".ngfactory" + normalizeGenFileSuffix(urlWithSuffix[1]);
    }
    exports.ngfactoryFilePath = ngfactoryFilePath;
    function stripGeneratedFileSuffix(filePath) {
        return filePath.replace(GENERATED_FILE, '.');
    }
    exports.stripGeneratedFileSuffix = stripGeneratedFileSuffix;
    function isGeneratedFile(filePath) {
        return GENERATED_FILE.test(filePath);
    }
    exports.isGeneratedFile = isGeneratedFile;
    function splitTypescriptSuffix(path, forceSourceFile) {
        if (forceSourceFile === void 0) { forceSourceFile = false; }
        if (path.endsWith('.d.ts')) {
            return [path.slice(0, -5), forceSourceFile ? '.ts' : '.d.ts'];
        }
        var lastDot = path.lastIndexOf('.');
        if (lastDot !== -1) {
            return [path.substring(0, lastDot), path.substring(lastDot)];
        }
        return [path, ''];
    }
    exports.splitTypescriptSuffix = splitTypescriptSuffix;
    function normalizeGenFileSuffix(srcFileSuffix) {
        return srcFileSuffix === '.tsx' ? '.ts' : srcFileSuffix;
    }
    exports.normalizeGenFileSuffix = normalizeGenFileSuffix;
    function summaryFileName(fileName) {
        var fileNameWithoutSuffix = fileName.replace(STRIP_SRC_FILE_SUFFIXES, '');
        return fileNameWithoutSuffix + ".ngsummary.json";
    }
    exports.summaryFileName = summaryFileName;
    function summaryForJitFileName(fileName, forceSourceFile) {
        if (forceSourceFile === void 0) { forceSourceFile = false; }
        var urlWithSuffix = splitTypescriptSuffix(stripGeneratedFileSuffix(fileName), forceSourceFile);
        return urlWithSuffix[0] + ".ngsummary" + urlWithSuffix[1];
    }
    exports.summaryForJitFileName = summaryForJitFileName;
    function stripSummaryForJitFileSuffix(filePath) {
        return filePath.replace(JIT_SUMMARY_FILE, '.');
    }
    exports.stripSummaryForJitFileSuffix = stripSummaryForJitFileSuffix;
    function summaryForJitName(symbolName) {
        return symbolName + "NgSummary";
    }
    exports.summaryForJitName = summaryForJitName;
    function stripSummaryForJitNameSuffix(symbolName) {
        return symbolName.replace(JIT_SUMMARY_NAME, '');
    }
    exports.stripSummaryForJitNameSuffix = stripSummaryForJitNameSuffix;
    var LOWERED_SYMBOL = /\u0275\d+/;
    function isLoweredSymbol(name) {
        return LOWERED_SYMBOL.test(name);
    }
    exports.isLoweredSymbol = isLoweredSymbol;
    function createLoweredSymbol(id) {
        return "\u0275" + id;
    }
    exports.createLoweredSymbol = createLoweredSymbol;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3QvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxJQUFNLHVCQUF1QixHQUFHLGtDQUFrQyxDQUFDO0lBQ25FLElBQU0sY0FBYyxHQUFHLDZCQUE2QixDQUFDO0lBQ3JELElBQU0sZ0JBQWdCLEdBQUcsZUFBZSxDQUFDO0lBQ3pDLElBQU0sZ0JBQWdCLEdBQUcsWUFBWSxDQUFDO0lBRXRDLFNBQWdCLGlCQUFpQixDQUFDLFFBQWdCLEVBQUUsZUFBdUI7UUFBdkIsZ0NBQUEsRUFBQSx1QkFBdUI7UUFDekUsSUFBTSxhQUFhLEdBQUcscUJBQXFCLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ3ZFLE9BQVUsYUFBYSxDQUFDLENBQUMsQ0FBQyxrQkFBYSxzQkFBc0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUcsQ0FBQztJQUNwRixDQUFDO0lBSEQsOENBR0M7SUFFRCxTQUFnQix3QkFBd0IsQ0FBQyxRQUFnQjtRQUN2RCxPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFGRCw0REFFQztJQUVELFNBQWdCLGVBQWUsQ0FBQyxRQUFnQjtRQUM5QyxPQUFPLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUZELDBDQUVDO0lBRUQsU0FBZ0IscUJBQXFCLENBQUMsSUFBWSxFQUFFLGVBQXVCO1FBQXZCLGdDQUFBLEVBQUEsdUJBQXVCO1FBQ3pFLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUMxQixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDL0Q7UUFFRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXRDLElBQUksT0FBTyxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQ2xCLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7U0FDOUQ7UUFFRCxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3BCLENBQUM7SUFaRCxzREFZQztJQUVELFNBQWdCLHNCQUFzQixDQUFDLGFBQXFCO1FBQzFELE9BQU8sYUFBYSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7SUFDMUQsQ0FBQztJQUZELHdEQUVDO0lBRUQsU0FBZ0IsZUFBZSxDQUFDLFFBQWdCO1FBQzlDLElBQU0scUJBQXFCLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM1RSxPQUFVLHFCQUFxQixvQkFBaUIsQ0FBQztJQUNuRCxDQUFDO0lBSEQsMENBR0M7SUFFRCxTQUFnQixxQkFBcUIsQ0FBQyxRQUFnQixFQUFFLGVBQXVCO1FBQXZCLGdDQUFBLEVBQUEsdUJBQXVCO1FBQzdFLElBQU0sYUFBYSxHQUFHLHFCQUFxQixDQUFDLHdCQUF3QixDQUFDLFFBQVEsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2pHLE9BQVUsYUFBYSxDQUFDLENBQUMsQ0FBQyxrQkFBYSxhQUFhLENBQUMsQ0FBQyxDQUFHLENBQUM7SUFDNUQsQ0FBQztJQUhELHNEQUdDO0lBRUQsU0FBZ0IsNEJBQTRCLENBQUMsUUFBZ0I7UUFDM0QsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFGRCxvRUFFQztJQUVELFNBQWdCLGlCQUFpQixDQUFDLFVBQWtCO1FBQ2xELE9BQVUsVUFBVSxjQUFXLENBQUM7SUFDbEMsQ0FBQztJQUZELDhDQUVDO0lBRUQsU0FBZ0IsNEJBQTRCLENBQUMsVUFBa0I7UUFDN0QsT0FBTyxVQUFVLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFGRCxvRUFFQztJQUVELElBQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQztJQUVuQyxTQUFnQixlQUFlLENBQUMsSUFBWTtRQUMxQyxPQUFPLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUZELDBDQUVDO0lBRUQsU0FBZ0IsbUJBQW1CLENBQUMsRUFBVTtRQUM1QyxPQUFPLFdBQVMsRUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFGRCxrREFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuY29uc3QgU1RSSVBfU1JDX0ZJTEVfU1VGRklYRVMgPSAvKFxcLnRzfFxcLmRcXC50c3xcXC5qc3xcXC5qc3h8XFwudHN4KSQvO1xuY29uc3QgR0VORVJBVEVEX0ZJTEUgPSAvXFwubmdmYWN0b3J5XFwufFxcLm5nc3VtbWFyeVxcLi87XG5jb25zdCBKSVRfU1VNTUFSWV9GSUxFID0gL1xcLm5nc3VtbWFyeVxcLi87XG5jb25zdCBKSVRfU1VNTUFSWV9OQU1FID0gL05nU3VtbWFyeSQvO1xuXG5leHBvcnQgZnVuY3Rpb24gbmdmYWN0b3J5RmlsZVBhdGgoZmlsZVBhdGg6IHN0cmluZywgZm9yY2VTb3VyY2VGaWxlID0gZmFsc2UpOiBzdHJpbmcge1xuICBjb25zdCB1cmxXaXRoU3VmZml4ID0gc3BsaXRUeXBlc2NyaXB0U3VmZml4KGZpbGVQYXRoLCBmb3JjZVNvdXJjZUZpbGUpO1xuICByZXR1cm4gYCR7dXJsV2l0aFN1ZmZpeFswXX0ubmdmYWN0b3J5JHtub3JtYWxpemVHZW5GaWxlU3VmZml4KHVybFdpdGhTdWZmaXhbMV0pfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcEdlbmVyYXRlZEZpbGVTdWZmaXgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKEdFTkVSQVRFRF9GSUxFLCAnLicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNHZW5lcmF0ZWRGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIEdFTkVSQVRFRF9GSUxFLnRlc3QoZmlsZVBhdGgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRUeXBlc2NyaXB0U3VmZml4KHBhdGg6IHN0cmluZywgZm9yY2VTb3VyY2VGaWxlID0gZmFsc2UpOiBzdHJpbmdbXSB7XG4gIGlmIChwYXRoLmVuZHNXaXRoKCcuZC50cycpKSB7XG4gICAgcmV0dXJuIFtwYXRoLnNsaWNlKDAsIC01KSwgZm9yY2VTb3VyY2VGaWxlID8gJy50cycgOiAnLmQudHMnXTtcbiAgfVxuXG4gIGNvbnN0IGxhc3REb3QgPSBwYXRoLmxhc3RJbmRleE9mKCcuJyk7XG5cbiAgaWYgKGxhc3REb3QgIT09IC0xKSB7XG4gICAgcmV0dXJuIFtwYXRoLnN1YnN0cmluZygwLCBsYXN0RG90KSwgcGF0aC5zdWJzdHJpbmcobGFzdERvdCldO1xuICB9XG5cbiAgcmV0dXJuIFtwYXRoLCAnJ107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVHZW5GaWxlU3VmZml4KHNyY0ZpbGVTdWZmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzcmNGaWxlU3VmZml4ID09PSAnLnRzeCcgPyAnLnRzJyA6IHNyY0ZpbGVTdWZmaXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdW1tYXJ5RmlsZU5hbWUoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGZpbGVOYW1lV2l0aG91dFN1ZmZpeCA9IGZpbGVOYW1lLnJlcGxhY2UoU1RSSVBfU1JDX0ZJTEVfU1VGRklYRVMsICcnKTtcbiAgcmV0dXJuIGAke2ZpbGVOYW1lV2l0aG91dFN1ZmZpeH0ubmdzdW1tYXJ5Lmpzb25gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyeUZvckppdEZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcsIGZvcmNlU291cmNlRmlsZSA9IGZhbHNlKTogc3RyaW5nIHtcbiAgY29uc3QgdXJsV2l0aFN1ZmZpeCA9IHNwbGl0VHlwZXNjcmlwdFN1ZmZpeChzdHJpcEdlbmVyYXRlZEZpbGVTdWZmaXgoZmlsZU5hbWUpLCBmb3JjZVNvdXJjZUZpbGUpO1xuICByZXR1cm4gYCR7dXJsV2l0aFN1ZmZpeFswXX0ubmdzdW1tYXJ5JHt1cmxXaXRoU3VmZml4WzFdfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFN1bW1hcnlGb3JKaXRGaWxlU3VmZml4KGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZmlsZVBhdGgucmVwbGFjZShKSVRfU1VNTUFSWV9GSUxFLCAnLicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyeUZvckppdE5hbWUoc3ltYm9sTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke3N5bWJvbE5hbWV9TmdTdW1tYXJ5YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmlwU3VtbWFyeUZvckppdE5hbWVTdWZmaXgoc3ltYm9sTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN5bWJvbE5hbWUucmVwbGFjZShKSVRfU1VNTUFSWV9OQU1FLCAnJyk7XG59XG5cbmNvbnN0IExPV0VSRURfU1lNQk9MID0gL1xcdTAyNzVcXGQrLztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzTG93ZXJlZFN5bWJvbChuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIExPV0VSRURfU1lNQk9MLnRlc3QobmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb3dlcmVkU3ltYm9sKGlkOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYFxcdTAyNzUke2lkfWA7XG59XG4iXX0=