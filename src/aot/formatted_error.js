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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0dGVkX2Vycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2FvdC9mb3JtYXR0ZWRfZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbURBQW9DO0lBbUJwQyxJQUFNLGlCQUFpQixHQUFHLG9CQUFvQixDQUFDO0lBRS9DLFNBQVMsU0FBUyxDQUFDLEtBQWE7UUFDOUIsSUFBSSxLQUFLLElBQUksQ0FBQztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBQzFCLElBQUksS0FBSyxHQUFHLENBQUM7WUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyRSxJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxPQUFPLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRUQsU0FBUyxXQUFXLENBQUMsS0FBd0MsRUFBRSxNQUFrQjs7UUFBbEIsdUJBQUEsRUFBQSxVQUFrQjtRQUMvRSxJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLElBQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMxQixLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsVUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxDQUFDLFdBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxPQUFHLENBQUMsQ0FBQztZQUN2RixFQUFFLENBQUM7UUFDUCxJQUFNLE1BQU0sR0FBRyxRQUFRLElBQUksTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUksUUFBUSxPQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUMvRCxJQUFNLE9BQU8sR0FBRyxRQUFRLElBQUksTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBTyxRQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNsRSxJQUFJLE9BQU8sR0FBRyxLQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQVMsQ0FBQztRQUVwRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7O2dCQUNkLEtBQWtCLElBQUEsS0FBQSxpQkFBQSxLQUFLLENBQUMsSUFBSSxDQUFBLGdCQUFBLDRCQUFFO29CQUF6QixJQUFNLEdBQUcsV0FBQTtvQkFDWixPQUFPLElBQUksSUFBSSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO2lCQUNoRDs7Ozs7Ozs7O1NBQ0Y7UUFFRCxPQUFPLEtBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE9BQVMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsU0FBZ0IsY0FBYyxDQUFDLEtBQTRCO1FBQ3pELElBQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDekMsSUFBTSxLQUFLLEdBQUcsa0JBQVcsQ0FBQyxPQUFPLENBQW1CLENBQUM7UUFDcEQsS0FBYSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3pDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ3BCLEtBQUssQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUNoQyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFQRCx3Q0FPQztJQUVELFNBQWdCLGdCQUFnQixDQUFDLEtBQVk7UUFDM0MsT0FBTyxDQUFDLENBQUUsS0FBYSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUZELDRDQUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3N5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBQb3NpdGlvbiB7XG4gIGZpbGVOYW1lOiBzdHJpbmc7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sdW1uOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRm9ybWF0dGVkTWVzc2FnZUNoYWluIHtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBwb3NpdGlvbj86IFBvc2l0aW9uO1xuICBuZXh0PzogRm9ybWF0dGVkTWVzc2FnZUNoYWluW107XG59XG5cbmV4cG9ydCB0eXBlIEZvcm1hdHRlZEVycm9yID0gRXJyb3IgJiB7XG4gIGNoYWluOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW47XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG59O1xuXG5jb25zdCBGT1JNQVRURURfTUVTU0FHRSA9ICduZ0Zvcm1hdHRlZE1lc3NhZ2UnO1xuXG5mdW5jdGlvbiBpbmRlbnRTdHIobGV2ZWw6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChsZXZlbCA8PSAwKSByZXR1cm4gJyc7XG4gIGlmIChsZXZlbCA8IDYpIHJldHVybiBbJycsICcgJywgJyAgJywgJyAgICcsICcgICAgJywgJyAgICAgJ11bbGV2ZWxdO1xuICBjb25zdCBoYWxmID0gaW5kZW50U3RyKE1hdGguZmxvb3IobGV2ZWwgLyAyKSk7XG4gIHJldHVybiBoYWxmICsgaGFsZiArIChsZXZlbCAlIDIgPT09IDEgPyAnICcgOiAnJyk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdENoYWluKGNoYWluOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4gfCB1bmRlZmluZWQsIGluZGVudDogbnVtYmVyID0gMCk6IHN0cmluZyB7XG4gIGlmICghY2hhaW4pIHJldHVybiAnJztcbiAgY29uc3QgcG9zaXRpb24gPSBjaGFpbi5wb3NpdGlvbiA/XG4gICAgICBgJHtjaGFpbi5wb3NpdGlvbi5maWxlTmFtZX0oJHtjaGFpbi5wb3NpdGlvbi5saW5lICsgMX0sJHtjaGFpbi5wb3NpdGlvbi5jb2x1bW4gKyAxfSlgIDpcbiAgICAgICcnO1xuICBjb25zdCBwcmVmaXggPSBwb3NpdGlvbiAmJiBpbmRlbnQgPT09IDAgPyBgJHtwb3NpdGlvbn06IGAgOiAnJztcbiAgY29uc3QgcG9zdGZpeCA9IHBvc2l0aW9uICYmIGluZGVudCAhPT0gMCA/IGAgYXQgJHtwb3NpdGlvbn1gIDogJyc7XG4gIGxldCBtZXNzYWdlID0gYCR7cHJlZml4fSR7Y2hhaW4ubWVzc2FnZX0ke3Bvc3RmaXh9YDtcblxuICBpZiAoY2hhaW4ubmV4dCkge1xuICAgIGZvciAoY29uc3Qga2lkIG9mIGNoYWluLm5leHQpIHtcbiAgICAgIG1lc3NhZ2UgKz0gJ1xcbicgKyBmb3JtYXRDaGFpbihraWQsIGluZGVudCArIDIpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBgJHtpbmRlbnRTdHIoaW5kZW50KX0ke21lc3NhZ2V9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdHRlZEVycm9yKGNoYWluOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4pOiBGb3JtYXR0ZWRFcnJvciB7XG4gIGNvbnN0IG1lc3NhZ2UgPSBmb3JtYXRDaGFpbihjaGFpbikgKyAnLic7XG4gIGNvbnN0IGVycm9yID0gc3ludGF4RXJyb3IobWVzc2FnZSkgYXMgRm9ybWF0dGVkRXJyb3I7XG4gIChlcnJvciBhcyBhbnkpW0ZPUk1BVFRFRF9NRVNTQUdFXSA9IHRydWU7XG4gIGVycm9yLmNoYWluID0gY2hhaW47XG4gIGVycm9yLnBvc2l0aW9uID0gY2hhaW4ucG9zaXRpb247XG4gIHJldHVybiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRm9ybWF0dGVkRXJyb3IoZXJyb3I6IEVycm9yKTogZXJyb3IgaXMgRm9ybWF0dGVkRXJyb3Ige1xuICByZXR1cm4gISEoZXJyb3IgYXMgYW55KVtGT1JNQVRURURfTUVTU0FHRV07XG59XG4iXX0=