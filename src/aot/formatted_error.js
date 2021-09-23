/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/aot/formatted_error", ["require", "exports", "tslib", "@angular/compiler/src/parse_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isFormattedError = exports.formattedError = void 0;
    var tslib_1 = require("tslib");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var FORMATTED_MESSAGE = 'ngFormattedMessage';
    function indentStr(level) {
        if (level <= 0)
            return '';
        if (level < 6)
            return ['', ' ', '  ', '   ', '    ', '     '][level];
        var half = indentStr(Math.floor(level / 2));
        return half + half + (level % 2 === 1 ? ' ' : '');
    }
    function formatChain(chain, indent) {
        var e_1, _a;
        if (indent === void 0) { indent = 0; }
        if (!chain)
            return '';
        var position = chain.position ?
            chain.position.fileName + "(" + (chain.position.line + 1) + "," + (chain.position.column + 1) + ")" :
            '';
        var prefix = position && indent === 0 ? position + ": " : '';
        var postfix = position && indent !== 0 ? " at " + position : '';
        var message = "" + prefix + chain.message + postfix;
        if (chain.next) {
            try {
                for (var _b = (0, tslib_1.__values)(chain.next), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var kid = _c.value;
                    message += '\n' + formatChain(kid, indent + 2);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return "" + indentStr(indent) + message;
    }
    function formattedError(chain) {
        var message = formatChain(chain) + '.';
        var error = (0, parse_util_1.syntaxError)(message);
        error[FORMATTED_MESSAGE] = true;
        error.chain = chain;
        error.position = chain.position;
        return error;
    }
    exports.formattedError = formattedError;
    function isFormattedError(error) {
        return !!error[FORMATTED_MESSAGE];
    }
    exports.isFormattedError = isFormattedError;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0dGVkX2Vycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2FvdC9mb3JtYXR0ZWRfZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILCtEQUEwQztJQW1CMUMsSUFBTSxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQztJQUUvQyxTQUFTLFNBQVMsQ0FBQyxLQUFhO1FBQzlCLElBQUksS0FBSyxJQUFJLENBQUM7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUMxQixJQUFJLEtBQUssR0FBRyxDQUFDO1lBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckUsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsT0FBTyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELFNBQVMsV0FBVyxDQUFDLEtBQXNDLEVBQUUsTUFBa0I7O1FBQWxCLHVCQUFBLEVBQUEsVUFBa0I7UUFDN0UsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUN0QixJQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDMUIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLFVBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxXQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsT0FBRyxDQUFDLENBQUM7WUFDdkYsRUFBRSxDQUFDO1FBQ1AsSUFBTSxNQUFNLEdBQUcsUUFBUSxJQUFJLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFJLFFBQVEsT0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDL0QsSUFBTSxPQUFPLEdBQUcsUUFBUSxJQUFJLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQU8sUUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDbEUsSUFBSSxPQUFPLEdBQUcsS0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFTLENBQUM7UUFFcEQsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFOztnQkFDZCxLQUFrQixJQUFBLEtBQUEsc0JBQUEsS0FBSyxDQUFDLElBQUksQ0FBQSxnQkFBQSw0QkFBRTtvQkFBekIsSUFBTSxHQUFHLFdBQUE7b0JBQ1osT0FBTyxJQUFJLElBQUksR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztpQkFDaEQ7Ozs7Ozs7OztTQUNGO1FBRUQsT0FBTyxLQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxPQUFTLENBQUM7SUFDMUMsQ0FBQztJQUVELFNBQWdCLGNBQWMsQ0FBQyxLQUE0QjtRQUN6RCxJQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ3pDLElBQU0sS0FBSyxHQUFHLElBQUEsd0JBQVcsRUFBQyxPQUFPLENBQW1CLENBQUM7UUFDcEQsS0FBYSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3pDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ3BCLEtBQUssQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUNoQyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFQRCx3Q0FPQztJQUVELFNBQWdCLGdCQUFnQixDQUFDLEtBQVk7UUFDM0MsT0FBTyxDQUFDLENBQUUsS0FBYSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUZELDRDQUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBvc2l0aW9uIHtcbiAgZmlsZU5hbWU6IHN0cmluZztcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4ge1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG4gIG5leHQ/OiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW5bXTtcbn1cblxuZXhwb3J0IHR5cGUgRm9ybWF0dGVkRXJyb3IgPSBFcnJvciZ7XG4gIGNoYWluOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW47XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG59O1xuXG5jb25zdCBGT1JNQVRURURfTUVTU0FHRSA9ICduZ0Zvcm1hdHRlZE1lc3NhZ2UnO1xuXG5mdW5jdGlvbiBpbmRlbnRTdHIobGV2ZWw6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChsZXZlbCA8PSAwKSByZXR1cm4gJyc7XG4gIGlmIChsZXZlbCA8IDYpIHJldHVybiBbJycsICcgJywgJyAgJywgJyAgICcsICcgICAgJywgJyAgICAgJ11bbGV2ZWxdO1xuICBjb25zdCBoYWxmID0gaW5kZW50U3RyKE1hdGguZmxvb3IobGV2ZWwgLyAyKSk7XG4gIHJldHVybiBoYWxmICsgaGFsZiArIChsZXZlbCAlIDIgPT09IDEgPyAnICcgOiAnJyk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdENoYWluKGNoYWluOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW58dW5kZWZpbmVkLCBpbmRlbnQ6IG51bWJlciA9IDApOiBzdHJpbmcge1xuICBpZiAoIWNoYWluKSByZXR1cm4gJyc7XG4gIGNvbnN0IHBvc2l0aW9uID0gY2hhaW4ucG9zaXRpb24gP1xuICAgICAgYCR7Y2hhaW4ucG9zaXRpb24uZmlsZU5hbWV9KCR7Y2hhaW4ucG9zaXRpb24ubGluZSArIDF9LCR7Y2hhaW4ucG9zaXRpb24uY29sdW1uICsgMX0pYCA6XG4gICAgICAnJztcbiAgY29uc3QgcHJlZml4ID0gcG9zaXRpb24gJiYgaW5kZW50ID09PSAwID8gYCR7cG9zaXRpb259OiBgIDogJyc7XG4gIGNvbnN0IHBvc3RmaXggPSBwb3NpdGlvbiAmJiBpbmRlbnQgIT09IDAgPyBgIGF0ICR7cG9zaXRpb259YCA6ICcnO1xuICBsZXQgbWVzc2FnZSA9IGAke3ByZWZpeH0ke2NoYWluLm1lc3NhZ2V9JHtwb3N0Zml4fWA7XG5cbiAgaWYgKGNoYWluLm5leHQpIHtcbiAgICBmb3IgKGNvbnN0IGtpZCBvZiBjaGFpbi5uZXh0KSB7XG4gICAgICBtZXNzYWdlICs9ICdcXG4nICsgZm9ybWF0Q2hhaW4oa2lkLCBpbmRlbnQgKyAyKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYCR7aW5kZW50U3RyKGluZGVudCl9JHttZXNzYWdlfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXR0ZWRFcnJvcihjaGFpbjogRm9ybWF0dGVkTWVzc2FnZUNoYWluKTogRm9ybWF0dGVkRXJyb3Ige1xuICBjb25zdCBtZXNzYWdlID0gZm9ybWF0Q2hhaW4oY2hhaW4pICsgJy4nO1xuICBjb25zdCBlcnJvciA9IHN5bnRheEVycm9yKG1lc3NhZ2UpIGFzIEZvcm1hdHRlZEVycm9yO1xuICAoZXJyb3IgYXMgYW55KVtGT1JNQVRURURfTUVTU0FHRV0gPSB0cnVlO1xuICBlcnJvci5jaGFpbiA9IGNoYWluO1xuICBlcnJvci5wb3NpdGlvbiA9IGNoYWluLnBvc2l0aW9uO1xuICByZXR1cm4gZXJyb3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Zvcm1hdHRlZEVycm9yKGVycm9yOiBFcnJvcik6IGVycm9yIGlzIEZvcm1hdHRlZEVycm9yIHtcbiAgcmV0dXJuICEhKGVycm9yIGFzIGFueSlbRk9STUFUVEVEX01FU1NBR0VdO1xufVxuIl19