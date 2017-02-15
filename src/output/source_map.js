/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit
var /** @type {?} */ VERSION = 3;
var /** @type {?} */ JS_B64_PREFIX = '# sourceMappingURL=data:application/json;base64,';
var SourceMapGenerator = (function () {
    /**
     * @param {?=} file
     */
    function SourceMapGenerator(file) {
        if (file === void 0) { file = null; }
        this.file = file;
        this.sourcesContent = new Map();
        this.lines = [];
        this.lastCol0 = 0;
        this.hasMappings = false;
    }
    /**
     * @param {?} url
     * @param {?=} content
     * @return {?}
     */
    SourceMapGenerator.prototype.addSource = function (url, content) {
        if (content === void 0) { content = null; }
        if (!this.sourcesContent.has(url)) {
            this.sourcesContent.set(url, content);
        }
        return this;
    };
    /**
     * @return {?}
     */
    SourceMapGenerator.prototype.addLine = function () {
        this.lines.push([]);
        this.lastCol0 = 0;
        return this;
    };
    /**
     * @param {?} col0
     * @param {?=} sourceUrl
     * @param {?=} sourceLine0
     * @param {?=} sourceCol0
     * @return {?}
     */
    SourceMapGenerator.prototype.addMapping = function (col0, sourceUrl, sourceLine0, sourceCol0) {
        if (!this.currentLine) {
            throw new Error("A line must be added before mappings can be added");
        }
        if (sourceUrl != null && !this.sourcesContent.has(sourceUrl)) {
            throw new Error("Unknown source file \"" + sourceUrl + "\"");
        }
        if (col0 == null) {
            throw new Error("The column in the generated code must be provided");
        }
        if (col0 < this.lastCol0) {
            throw new Error("Mapping should be added in output order");
        }
        if (sourceUrl && (sourceLine0 == null || sourceCol0 == null)) {
            throw new Error("The source location must be provided when a source url is provided");
        }
        this.hasMappings = true;
        this.lastCol0 = col0;
        this.currentLine.push({ col0: col0, sourceUrl: sourceUrl, sourceLine0: sourceLine0, sourceCol0: sourceCol0 });
        return this;
    };
    Object.defineProperty(SourceMapGenerator.prototype, "currentLine", {
        /**
         * @return {?}
         */
        get: function () { return this.lines.slice(-1)[0]; },
        enumerable: true,
        configurable: true
    });
    /**
     * @return {?}
     */
    SourceMapGenerator.prototype.toJSON = function () {
        var _this = this;
        if (!this.hasMappings) {
            return null;
        }
        var /** @type {?} */ sourcesIndex = new Map();
        var /** @type {?} */ sources = [];
        var /** @type {?} */ sourcesContent = [];
        Array.from(this.sourcesContent.keys()).forEach(function (url, i) {
            sourcesIndex.set(url, i);
            sources.push(url);
            sourcesContent.push(_this.sourcesContent.get(url) || null);
        });
        var /** @type {?} */ mappings = '';
        var /** @type {?} */ lastCol0 = 0;
        var /** @type {?} */ lastSourceIndex = 0;
        var /** @type {?} */ lastSourceLine0 = 0;
        var /** @type {?} */ lastSourceCol0 = 0;
        this.lines.forEach(function (segments) {
            lastCol0 = 0;
            mappings += segments
                .map(function (segment) {
                // zero-based starting column of the line in the generated code
                var /** @type {?} */ segAsStr = toBase64VLQ(segment.col0 - lastCol0);
                lastCol0 = segment.col0;
                if (segment.sourceUrl != null) {
                    // zero-based index into the “sources” list
                    segAsStr +=
                        toBase64VLQ(sourcesIndex.get(segment.sourceUrl) - lastSourceIndex);
                    lastSourceIndex = sourcesIndex.get(segment.sourceUrl);
                    // the zero-based starting line in the original source
                    segAsStr += toBase64VLQ(segment.sourceLine0 - lastSourceLine0);
                    lastSourceLine0 = segment.sourceLine0;
                    // the zero-based starting column in the original source
                    segAsStr += toBase64VLQ(segment.sourceCol0 - lastSourceCol0);
                    lastSourceCol0 = segment.sourceCol0;
                }
                return segAsStr;
            })
                .join(',');
            mappings += ';';
        });
        mappings = mappings.slice(0, -1);
        return {
            'file': this.file || '',
            'version': VERSION,
            'sourceRoot': '',
            'sources': sources,
            'sourcesContent': sourcesContent,
            'mappings': mappings,
        };
    };
    /**
     * @return {?}
     */
    SourceMapGenerator.prototype.toJsComment = function () {
        return this.hasMappings ? '//' + JS_B64_PREFIX + toBase64String(JSON.stringify(this, null, 0)) :
            '';
    };
    return SourceMapGenerator;
}());
export { SourceMapGenerator };
function SourceMapGenerator_tsickle_Closure_declarations() {
    /** @type {?} */
    SourceMapGenerator.prototype.sourcesContent;
    /** @type {?} */
    SourceMapGenerator.prototype.lines;
    /** @type {?} */
    SourceMapGenerator.prototype.lastCol0;
    /** @type {?} */
    SourceMapGenerator.prototype.hasMappings;
    /** @type {?} */
    SourceMapGenerator.prototype.file;
}
/**
 * @param {?} value
 * @return {?}
 */
export function toBase64String(value) {
    var /** @type {?} */ b64 = '';
    for (var /** @type {?} */ i = 0; i < value.length;) {
        var /** @type {?} */ i1 = value.charCodeAt(i++);
        var /** @type {?} */ i2 = value.charCodeAt(i++);
        var /** @type {?} */ i3 = value.charCodeAt(i++);
        b64 += toBase64Digit(i1 >> 2);
        b64 += toBase64Digit(((i1 & 3) << 4) | (isNaN(i2) ? 0 : i2 >> 4));
        b64 += isNaN(i2) ? '=' : toBase64Digit(((i2 & 15) << 2) | (i3 >> 6));
        b64 += isNaN(i2) || isNaN(i3) ? '=' : toBase64Digit(i3 & 63);
    }
    return b64;
}
/**
 * @param {?} value
 * @return {?}
 */
function toBase64VLQ(value) {
    value = value < 0 ? ((-value) << 1) + 1 : value << 1;
    var /** @type {?} */ out = '';
    do {
        var /** @type {?} */ digit = value & 31;
        value = value >> 5;
        if (value > 0) {
            digit = digit | 32;
        }
        out += toBase64Digit(digit);
    } while (value > 0);
    return out;
}
var /** @type {?} */ B64_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/**
 * @param {?} value
 * @return {?}
 */
function toBase64Digit(value) {
    if (value < 0 || value >= 64) {
        throw new Error("Can only encode value in the range [0, 63]");
    }
    return B64_DIGITS[value];
}
//# sourceMappingURL=source_map.js.map