/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
import * as chars from './chars';
import { identifierModuleUrl, identifierName } from './compile_metadata';
var ParseLocation = /** @class */ (function () {
    function ParseLocation(file, offset, line, col) {
        this.file = file;
        this.offset = offset;
        this.line = line;
        this.col = col;
    }
    /**
     * @return {?}
     */
    ParseLocation.prototype.toString = /**
     * @return {?}
     */
    function () {
        return this.offset != null ? this.file.url + "@" + this.line + ":" + this.col : this.file.url;
    };
    /**
     * @param {?} delta
     * @return {?}
     */
    ParseLocation.prototype.moveBy = /**
     * @param {?} delta
     * @return {?}
     */
    function (delta) {
        var /** @type {?} */ source = this.file.content;
        var /** @type {?} */ len = source.length;
        var /** @type {?} */ offset = this.offset;
        var /** @type {?} */ line = this.line;
        var /** @type {?} */ col = this.col;
        while (offset > 0 && delta < 0) {
            offset--;
            delta++;
            var /** @type {?} */ ch = source.charCodeAt(offset);
            if (ch == chars.$LF) {
                line--;
                var /** @type {?} */ priorLine = source.substr(0, offset - 1).lastIndexOf(String.fromCharCode(chars.$LF));
                col = priorLine > 0 ? offset - priorLine : offset;
            }
            else {
                col--;
            }
        }
        while (offset < len && delta > 0) {
            var /** @type {?} */ ch = source.charCodeAt(offset);
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
    };
    // Return the source around the location
    // Up to `maxChars` or `maxLines` on each side of the location
    /**
     * @param {?} maxChars
     * @param {?} maxLines
     * @return {?}
     */
    ParseLocation.prototype.getContext = /**
     * @param {?} maxChars
     * @param {?} maxLines
     * @return {?}
     */
    function (maxChars, maxLines) {
        var /** @type {?} */ content = this.file.content;
        var /** @type {?} */ startOffset = this.offset;
        if (startOffset != null) {
            if (startOffset > content.length - 1) {
                startOffset = content.length - 1;
            }
            var /** @type {?} */ endOffset = startOffset;
            var /** @type {?} */ ctxChars = 0;
            var /** @type {?} */ ctxLines = 0;
            while (ctxChars < maxChars && startOffset > 0) {
                startOffset--;
                ctxChars++;
                if (content[startOffset] == '\n') {
                    if (++ctxLines == maxLines) {
                        break;
                    }
                }
            }
            ctxChars = 0;
            ctxLines = 0;
            while (ctxChars < maxChars && endOffset < content.length - 1) {
                endOffset++;
                ctxChars++;
                if (content[endOffset] == '\n') {
                    if (++ctxLines == maxLines) {
                        break;
                    }
                }
            }
            return {
                before: content.substring(startOffset, this.offset),
                after: content.substring(this.offset, endOffset + 1),
            };
        }
        return null;
    };
    return ParseLocation;
}());
export { ParseLocation };
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
var ParseSourceFile = /** @class */ (function () {
    function ParseSourceFile(content, url) {
        this.content = content;
        this.url = url;
    }
    return ParseSourceFile;
}());
export { ParseSourceFile };
function ParseSourceFile_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseSourceFile.prototype.content;
    /** @type {?} */
    ParseSourceFile.prototype.url;
}
var ParseSourceSpan = /** @class */ (function () {
    function ParseSourceSpan(start, end, details) {
        if (details === void 0) { details = null; }
        this.start = start;
        this.end = end;
        this.details = details;
    }
    /**
     * @return {?}
     */
    ParseSourceSpan.prototype.toString = /**
     * @return {?}
     */
    function () {
        return this.start.file.content.substring(this.start.offset, this.end.offset);
    };
    return ParseSourceSpan;
}());
export { ParseSourceSpan };
function ParseSourceSpan_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseSourceSpan.prototype.start;
    /** @type {?} */
    ParseSourceSpan.prototype.end;
    /** @type {?} */
    ParseSourceSpan.prototype.details;
}
/** @enum {number} */
var ParseErrorLevel = {
    WARNING: 0,
    ERROR: 1,
};
export { ParseErrorLevel };
ParseErrorLevel[ParseErrorLevel.WARNING] = "WARNING";
ParseErrorLevel[ParseErrorLevel.ERROR] = "ERROR";
var ParseError = /** @class */ (function () {
    function ParseError(span, msg, level) {
        if (level === void 0) { level = ParseErrorLevel.ERROR; }
        this.span = span;
        this.msg = msg;
        this.level = level;
    }
    /**
     * @return {?}
     */
    ParseError.prototype.contextualMessage = /**
     * @return {?}
     */
    function () {
        var /** @type {?} */ ctx = this.span.start.getContext(100, 3);
        return ctx ? this.msg + " (\"" + ctx.before + "[" + ParseErrorLevel[this.level] + " ->]" + ctx.after + "\")" :
            this.msg;
    };
    /**
     * @return {?}
     */
    ParseError.prototype.toString = /**
     * @return {?}
     */
    function () {
        var /** @type {?} */ details = this.span.details ? ", " + this.span.details : '';
        return this.contextualMessage() + ": " + this.span.start + details;
    };
    return ParseError;
}());
export { ParseError };
function ParseError_tsickle_Closure_declarations() {
    /** @type {?} */
    ParseError.prototype.span;
    /** @type {?} */
    ParseError.prototype.msg;
    /** @type {?} */
    ParseError.prototype.level;
}
/**
 * @param {?} kind
 * @param {?} type
 * @return {?}
 */
export function typeSourceSpan(kind, type) {
    var /** @type {?} */ moduleUrl = identifierModuleUrl(type);
    var /** @type {?} */ sourceFileName = moduleUrl != null ? "in " + kind + " " + identifierName(type) + " in " + moduleUrl :
        "in " + kind + " " + identifierName(type);
    var /** @type {?} */ sourceFile = new ParseSourceFile('', sourceFileName);
    return new ParseSourceSpan(new ParseLocation(sourceFile, -1, -1, -1), new ParseLocation(sourceFile, -1, -1, -1));
}
//# sourceMappingURL=parse_util.js.map