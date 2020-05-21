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
        define("@angular/compiler/src/aot/formatted_error", ["require", "exports", "tslib", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isFormattedError = exports.formattedError = void 0;
    var tslib_1 = require("tslib");
    var util_1 = require("@angular/compiler/src/util");
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
                for (var _b = tslib_1.__values(chain.next), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        var error = util_1.syntaxError(message);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0dGVkX2Vycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2FvdC9mb3JtYXR0ZWRfZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILG1EQUFvQztJQW1CcEMsSUFBTSxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQztJQUUvQyxTQUFTLFNBQVMsQ0FBQyxLQUFhO1FBQzlCLElBQUksS0FBSyxJQUFJLENBQUM7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUMxQixJQUFJLEtBQUssR0FBRyxDQUFDO1lBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckUsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsT0FBTyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELFNBQVMsV0FBVyxDQUFDLEtBQXNDLEVBQUUsTUFBa0I7O1FBQWxCLHVCQUFBLEVBQUEsVUFBa0I7UUFDN0UsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUN0QixJQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDMUIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLFVBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxXQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsT0FBRyxDQUFDLENBQUM7WUFDdkYsRUFBRSxDQUFDO1FBQ1AsSUFBTSxNQUFNLEdBQUcsUUFBUSxJQUFJLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFJLFFBQVEsT0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDL0QsSUFBTSxPQUFPLEdBQUcsUUFBUSxJQUFJLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQU8sUUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDbEUsSUFBSSxPQUFPLEdBQUcsS0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFTLENBQUM7UUFFcEQsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFOztnQkFDZCxLQUFrQixJQUFBLEtBQUEsaUJBQUEsS0FBSyxDQUFDLElBQUksQ0FBQSxnQkFBQSw0QkFBRTtvQkFBekIsSUFBTSxHQUFHLFdBQUE7b0JBQ1osT0FBTyxJQUFJLElBQUksR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztpQkFDaEQ7Ozs7Ozs7OztTQUNGO1FBRUQsT0FBTyxLQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxPQUFTLENBQUM7SUFDMUMsQ0FBQztJQUVELFNBQWdCLGNBQWMsQ0FBQyxLQUE0QjtRQUN6RCxJQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ3pDLElBQU0sS0FBSyxHQUFHLGtCQUFXLENBQUMsT0FBTyxDQUFtQixDQUFDO1FBQ3BELEtBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN6QyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNwQixLQUFLLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7UUFDaEMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBUEQsd0NBT0M7SUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxLQUFZO1FBQzNDLE9BQU8sQ0FBQyxDQUFFLEtBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFGRCw0Q0FFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9zaXRpb24ge1xuICBmaWxlTmFtZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZvcm1hdHRlZE1lc3NhZ2VDaGFpbiB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgcG9zaXRpb24/OiBQb3NpdGlvbjtcbiAgbmV4dD86IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbltdO1xufVxuXG5leHBvcnQgdHlwZSBGb3JtYXR0ZWRFcnJvciA9IEVycm9yJntcbiAgY2hhaW46IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbjtcbiAgcG9zaXRpb24/OiBQb3NpdGlvbjtcbn07XG5cbmNvbnN0IEZPUk1BVFRFRF9NRVNTQUdFID0gJ25nRm9ybWF0dGVkTWVzc2FnZSc7XG5cbmZ1bmN0aW9uIGluZGVudFN0cihsZXZlbDogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKGxldmVsIDw9IDApIHJldHVybiAnJztcbiAgaWYgKGxldmVsIDwgNikgcmV0dXJuIFsnJywgJyAnLCAnICAnLCAnICAgJywgJyAgICAnLCAnICAgICAnXVtsZXZlbF07XG4gIGNvbnN0IGhhbGYgPSBpbmRlbnRTdHIoTWF0aC5mbG9vcihsZXZlbCAvIDIpKTtcbiAgcmV0dXJuIGhhbGYgKyBoYWxmICsgKGxldmVsICUgMiA9PT0gMSA/ICcgJyA6ICcnKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0Q2hhaW4oY2hhaW46IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbnx1bmRlZmluZWQsIGluZGVudDogbnVtYmVyID0gMCk6IHN0cmluZyB7XG4gIGlmICghY2hhaW4pIHJldHVybiAnJztcbiAgY29uc3QgcG9zaXRpb24gPSBjaGFpbi5wb3NpdGlvbiA/XG4gICAgICBgJHtjaGFpbi5wb3NpdGlvbi5maWxlTmFtZX0oJHtjaGFpbi5wb3NpdGlvbi5saW5lICsgMX0sJHtjaGFpbi5wb3NpdGlvbi5jb2x1bW4gKyAxfSlgIDpcbiAgICAgICcnO1xuICBjb25zdCBwcmVmaXggPSBwb3NpdGlvbiAmJiBpbmRlbnQgPT09IDAgPyBgJHtwb3NpdGlvbn06IGAgOiAnJztcbiAgY29uc3QgcG9zdGZpeCA9IHBvc2l0aW9uICYmIGluZGVudCAhPT0gMCA/IGAgYXQgJHtwb3NpdGlvbn1gIDogJyc7XG4gIGxldCBtZXNzYWdlID0gYCR7cHJlZml4fSR7Y2hhaW4ubWVzc2FnZX0ke3Bvc3RmaXh9YDtcblxuICBpZiAoY2hhaW4ubmV4dCkge1xuICAgIGZvciAoY29uc3Qga2lkIG9mIGNoYWluLm5leHQpIHtcbiAgICAgIG1lc3NhZ2UgKz0gJ1xcbicgKyBmb3JtYXRDaGFpbihraWQsIGluZGVudCArIDIpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBgJHtpbmRlbnRTdHIoaW5kZW50KX0ke21lc3NhZ2V9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdHRlZEVycm9yKGNoYWluOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4pOiBGb3JtYXR0ZWRFcnJvciB7XG4gIGNvbnN0IG1lc3NhZ2UgPSBmb3JtYXRDaGFpbihjaGFpbikgKyAnLic7XG4gIGNvbnN0IGVycm9yID0gc3ludGF4RXJyb3IobWVzc2FnZSkgYXMgRm9ybWF0dGVkRXJyb3I7XG4gIChlcnJvciBhcyBhbnkpW0ZPUk1BVFRFRF9NRVNTQUdFXSA9IHRydWU7XG4gIGVycm9yLmNoYWluID0gY2hhaW47XG4gIGVycm9yLnBvc2l0aW9uID0gY2hhaW4ucG9zaXRpb247XG4gIHJldHVybiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRm9ybWF0dGVkRXJyb3IoZXJyb3I6IEVycm9yKTogZXJyb3IgaXMgRm9ybWF0dGVkRXJyb3Ige1xuICByZXR1cm4gISEoZXJyb3IgYXMgYW55KVtGT1JNQVRURURfTUVTU0FHRV07XG59XG4iXX0=