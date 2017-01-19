import * as chars from './chars';
import { isPresent } from './facade/lang';
export class ParseLocation {
    /**
     * @param {?} file
     * @param {?} offset
     * @param {?} line
     * @param {?} col
     */
    constructor(file, offset, line, col) {
        this.file = file;
        this.offset = offset;
        this.line = line;
        this.col = col;
    }
    /**
     * @return {?}
     */
    toString() {
        return isPresent(this.offset) ? `${this.file.url}@${this.line}:${this.col}` : this.file.url;
    }
    /**
     * @param {?} delta
     * @return {?}
     */
    moveBy(delta) {
        const /** @type {?} */ source = this.file.content;
        const /** @type {?} */ len = source.length;
        let /** @type {?} */ offset = this.offset;
        let /** @type {?} */ line = this.line;
        let /** @type {?} */ col = this.col;
        while (offset > 0 && delta < 0) {
            offset--;
            delta++;
            const /** @type {?} */ ch = source.charCodeAt(offset);
            if (ch == chars.$LF) {
                line--;
                const /** @type {?} */ priorLine = source.substr(0, offset - 1).lastIndexOf(String.fromCharCode(chars.$LF));
                col = priorLine > 0 ? offset - priorLine : offset;
            }
            else {
                col--;
            }
        }
        while (offset < len && delta > 0) {
            const /** @type {?} */ ch = source.charCodeAt(offset);
            offset++;
            delta--;
            if (ch == chars.$LF) {
                line++;
                col = 0;
            }
            else {
                col++;
            }
        }
        return new ParseLocation(this.file, offset, line, col);
    }
}
function ParseLocation_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseLocation.prototype.file;
    /** @type {?} */
    ParseLocation.prototype.offset;
    /** @type {?} */
    ParseLocation.prototype.line;
    /** @type {?} */
    ParseLocation.prototype.col;
}
export class ParseSourceFile {
    /**
     * @param {?} content
     * @param {?} url
     */
    constructor(content, url) {
        this.content = content;
        this.url = url;
    }
}
function ParseSourceFile_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseSourceFile.prototype.content;
    /** @type {?} */
    ParseSourceFile.prototype.url;
}
export class ParseSourceSpan {
    /**
     * @param {?} start
     * @param {?} end
     * @param {?=} details
     */
    constructor(start, end, details = null) {
        this.start = start;
        this.end = end;
        this.details = details;
    }
    /**
     * @return {?}
     */
    toString() {
        return this.start.file.content.substring(this.start.offset, this.end.offset);
    }
}
function ParseSourceSpan_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseSourceSpan.prototype.start;
    /** @type {?} */
    ParseSourceSpan.prototype.end;
    /** @type {?} */
    ParseSourceSpan.prototype.details;
}
export let ParseErrorLevel = {};
ParseErrorLevel.WARNING = 0;
ParseErrorLevel.FATAL = 1;
ParseErrorLevel[ParseErrorLevel.WARNING] = "WARNING";
ParseErrorLevel[ParseErrorLevel.FATAL] = "FATAL";
export class ParseError {
    /**
     * @param {?} span
     * @param {?} msg
     * @param {?=} level
     */
    constructor(span, msg, level = ParseErrorLevel.FATAL) {
        this.span = span;
        this.msg = msg;
        this.level = level;
    }
    /**
     * @return {?}
     */
    toString() {
        const /** @type {?} */ source = this.span.start.file.content;
        let /** @type {?} */ ctxStart = this.span.start.offset;
        let /** @type {?} */ contextStr = '';
        let /** @type {?} */ details = '';
        if (isPresent(ctxStart)) {
            if (ctxStart > source.length - 1) {
                ctxStart = source.length - 1;
            }
            let /** @type {?} */ ctxEnd = ctxStart;
            let /** @type {?} */ ctxLen = 0;
            let /** @type {?} */ ctxLines = 0;
            while (ctxLen < 100 && ctxStart > 0) {
                ctxStart--;
                ctxLen++;
                if (source[ctxStart] == '\n') {
                    if (++ctxLines == 3) {
                        break;
                    }
                }
            }
            ctxLen = 0;
            ctxLines = 0;
            while (ctxLen < 100 && ctxEnd < source.length - 1) {
                ctxEnd++;
                ctxLen++;
                if (source[ctxEnd] == '\n') {
                    if (++ctxLines == 3) {
                        break;
                    }
                }
            }
            const /** @type {?} */ context = source.substring(ctxStart, this.span.start.offset) + '[ERROR ->]' +
                source.substring(this.span.start.offset, ctxEnd + 1);
            contextStr = ` ("${context}")`;
        }
        if (this.span.details) {
            details = `, ${this.span.details}`;
        }
        return `${this.msg}${contextStr}: ${this.span.start}${details}`;
    }
}
function ParseError_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseError.prototype.span;
    /** @type {?} */
    ParseError.prototype.msg;
    /** @type {?} */
    ParseError.prototype.level;
}
//# sourceMappingURL=parse_util.js.map