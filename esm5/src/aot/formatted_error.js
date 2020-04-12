/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __values } from "tslib";
import { syntaxError } from '../util';
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
            for (var _b = __values(chain.next), _c = _b.next(); !_c.done; _c = _b.next()) {
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
export function formattedError(chain) {
    var message = formatChain(chain) + '.';
    var error = syntaxError(message);
    error[FORMATTED_MESSAGE] = true;
    error.chain = chain;
    error.position = chain.position;
    return error;
}
export function isFormattedError(error) {
    return !!error[FORMATTED_MESSAGE];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0dGVkX2Vycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2FvdC9mb3JtYXR0ZWRfZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFtQnBDLElBQU0saUJBQWlCLEdBQUcsb0JBQW9CLENBQUM7QUFFL0MsU0FBUyxTQUFTLENBQUMsS0FBYTtJQUM5QixJQUFJLEtBQUssSUFBSSxDQUFDO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFDMUIsSUFBSSxLQUFLLEdBQUcsQ0FBQztRQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JFLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3BELENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxLQUF3QyxFQUFFLE1BQWtCOztJQUFsQix1QkFBQSxFQUFBLFVBQWtCO0lBQy9FLElBQUksQ0FBQyxLQUFLO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFDdEIsSUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxVQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFHLENBQUMsV0FBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLE9BQUcsQ0FBQyxDQUFDO1FBQ3ZGLEVBQUUsQ0FBQztJQUNQLElBQU0sTUFBTSxHQUFHLFFBQVEsSUFBSSxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBSSxRQUFRLE9BQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQy9ELElBQU0sT0FBTyxHQUFHLFFBQVEsSUFBSSxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFPLFFBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ2xFLElBQUksT0FBTyxHQUFHLEtBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBUyxDQUFDO0lBRXBELElBQUksS0FBSyxDQUFDLElBQUksRUFBRTs7WUFDZCxLQUFrQixJQUFBLEtBQUEsU0FBQSxLQUFLLENBQUMsSUFBSSxDQUFBLGdCQUFBLDRCQUFFO2dCQUF6QixJQUFNLEdBQUcsV0FBQTtnQkFDWixPQUFPLElBQUksSUFBSSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO2FBQ2hEOzs7Ozs7Ozs7S0FDRjtJQUVELE9BQU8sS0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsT0FBUyxDQUFDO0FBQzFDLENBQUM7QUFFRCxNQUFNLFVBQVUsY0FBYyxDQUFDLEtBQTRCO0lBQ3pELElBQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDekMsSUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBbUIsQ0FBQztJQUNwRCxLQUFhLENBQUMsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDekMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDcEIsS0FBSyxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO0lBQ2hDLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxLQUFZO0lBQzNDLE9BQU8sQ0FBQyxDQUFFLEtBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBvc2l0aW9uIHtcbiAgZmlsZU5hbWU6IHN0cmluZztcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4ge1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG4gIG5leHQ/OiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW5bXTtcbn1cblxuZXhwb3J0IHR5cGUgRm9ybWF0dGVkRXJyb3IgPSBFcnJvciAmIHtcbiAgY2hhaW46IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbjtcbiAgcG9zaXRpb24/OiBQb3NpdGlvbjtcbn07XG5cbmNvbnN0IEZPUk1BVFRFRF9NRVNTQUdFID0gJ25nRm9ybWF0dGVkTWVzc2FnZSc7XG5cbmZ1bmN0aW9uIGluZGVudFN0cihsZXZlbDogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKGxldmVsIDw9IDApIHJldHVybiAnJztcbiAgaWYgKGxldmVsIDwgNikgcmV0dXJuIFsnJywgJyAnLCAnICAnLCAnICAgJywgJyAgICAnLCAnICAgICAnXVtsZXZlbF07XG4gIGNvbnN0IGhhbGYgPSBpbmRlbnRTdHIoTWF0aC5mbG9vcihsZXZlbCAvIDIpKTtcbiAgcmV0dXJuIGhhbGYgKyBoYWxmICsgKGxldmVsICUgMiA9PT0gMSA/ICcgJyA6ICcnKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0Q2hhaW4oY2hhaW46IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbiB8IHVuZGVmaW5lZCwgaW5kZW50OiBudW1iZXIgPSAwKTogc3RyaW5nIHtcbiAgaWYgKCFjaGFpbikgcmV0dXJuICcnO1xuICBjb25zdCBwb3NpdGlvbiA9IGNoYWluLnBvc2l0aW9uID9cbiAgICAgIGAke2NoYWluLnBvc2l0aW9uLmZpbGVOYW1lfSgke2NoYWluLnBvc2l0aW9uLmxpbmUgKyAxfSwke2NoYWluLnBvc2l0aW9uLmNvbHVtbiArIDF9KWAgOlxuICAgICAgJyc7XG4gIGNvbnN0IHByZWZpeCA9IHBvc2l0aW9uICYmIGluZGVudCA9PT0gMCA/IGAke3Bvc2l0aW9ufTogYCA6ICcnO1xuICBjb25zdCBwb3N0Zml4ID0gcG9zaXRpb24gJiYgaW5kZW50ICE9PSAwID8gYCBhdCAke3Bvc2l0aW9ufWAgOiAnJztcbiAgbGV0IG1lc3NhZ2UgPSBgJHtwcmVmaXh9JHtjaGFpbi5tZXNzYWdlfSR7cG9zdGZpeH1gO1xuXG4gIGlmIChjaGFpbi5uZXh0KSB7XG4gICAgZm9yIChjb25zdCBraWQgb2YgY2hhaW4ubmV4dCkge1xuICAgICAgbWVzc2FnZSArPSAnXFxuJyArIGZvcm1hdENoYWluKGtpZCwgaW5kZW50ICsgMik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGAke2luZGVudFN0cihpbmRlbnQpfSR7bWVzc2FnZX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0dGVkRXJyb3IoY2hhaW46IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbik6IEZvcm1hdHRlZEVycm9yIHtcbiAgY29uc3QgbWVzc2FnZSA9IGZvcm1hdENoYWluKGNoYWluKSArICcuJztcbiAgY29uc3QgZXJyb3IgPSBzeW50YXhFcnJvcihtZXNzYWdlKSBhcyBGb3JtYXR0ZWRFcnJvcjtcbiAgKGVycm9yIGFzIGFueSlbRk9STUFUVEVEX01FU1NBR0VdID0gdHJ1ZTtcbiAgZXJyb3IuY2hhaW4gPSBjaGFpbjtcbiAgZXJyb3IucG9zaXRpb24gPSBjaGFpbi5wb3NpdGlvbjtcbiAgcmV0dXJuIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNGb3JtYXR0ZWRFcnJvcihlcnJvcjogRXJyb3IpOiBlcnJvciBpcyBGb3JtYXR0ZWRFcnJvciB7XG4gIHJldHVybiAhIShlcnJvciBhcyBhbnkpW0ZPUk1BVFRFRF9NRVNTQUdFXTtcbn1cbiJdfQ==