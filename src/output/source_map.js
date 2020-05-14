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
        define("@angular/compiler/src/output/source_map", ["require", "exports", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.toBase64String = exports.SourceMapGenerator = void 0;
    var util_1 = require("@angular/compiler/src/util");
    // https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit
    var VERSION = 3;
    var JS_B64_PREFIX = '# sourceMappingURL=data:application/json;base64,';
    var SourceMapGenerator = /** @class */ (function () {
        function SourceMapGenerator(file) {
            if (file === void 0) { file = null; }
            this.file = file;
            this.sourcesContent = new Map();
            this.lines = [];
            this.lastCol0 = 0;
            this.hasMappings = false;
        }
        // The content is `null` when the content is expected to be loaded using the URL
        SourceMapGenerator.prototype.addSource = function (url, content) {
            if (content === void 0) { content = null; }
            if (!this.sourcesContent.has(url)) {
                this.sourcesContent.set(url, content);
            }
            return this;
        };
        SourceMapGenerator.prototype.addLine = function () {
            this.lines.push([]);
            this.lastCol0 = 0;
            return this;
        };
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
             * @internal strip this from published d.ts files due to
             * https://github.com/microsoft/TypeScript/issues/36216
             */
            get: function () {
                return this.lines.slice(-1)[0];
            },
            enumerable: false,
            configurable: true
        });
        SourceMapGenerator.prototype.toJSON = function () {
            var _this = this;
            if (!this.hasMappings) {
                return null;
            }
            var sourcesIndex = new Map();
            var sources = [];
            var sourcesContent = [];
            Array.from(this.sourcesContent.keys()).forEach(function (url, i) {
                sourcesIndex.set(url, i);
                sources.push(url);
                sourcesContent.push(_this.sourcesContent.get(url) || null);
            });
            var mappings = '';
            var lastCol0 = 0;
            var lastSourceIndex = 0;
            var lastSourceLine0 = 0;
            var lastSourceCol0 = 0;
            this.lines.forEach(function (segments) {
                lastCol0 = 0;
                mappings += segments
                    .map(function (segment) {
                    // zero-based starting column of the line in the generated code
                    var segAsStr = toBase64VLQ(segment.col0 - lastCol0);
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
        SourceMapGenerator.prototype.toJsComment = function () {
            return this.hasMappings ? '//' + JS_B64_PREFIX + toBase64String(JSON.stringify(this, null, 0)) :
                '';
        };
        return SourceMapGenerator;
    }());
    exports.SourceMapGenerator = SourceMapGenerator;
    function toBase64String(value) {
        var b64 = '';
        value = util_1.utf8Encode(value);
        for (var i = 0; i < value.length;) {
            var i1 = value.charCodeAt(i++);
            var i2 = value.charCodeAt(i++);
            var i3 = value.charCodeAt(i++);
            b64 += toBase64Digit(i1 >> 2);
            b64 += toBase64Digit(((i1 & 3) << 4) | (isNaN(i2) ? 0 : i2 >> 4));
            b64 += isNaN(i2) ? '=' : toBase64Digit(((i2 & 15) << 2) | (i3 >> 6));
            b64 += isNaN(i2) || isNaN(i3) ? '=' : toBase64Digit(i3 & 63);
        }
        return b64;
    }
    exports.toBase64String = toBase64String;
    function toBase64VLQ(value) {
        value = value < 0 ? ((-value) << 1) + 1 : value << 1;
        var out = '';
        do {
            var digit = value & 31;
            value = value >> 5;
            if (value > 0) {
                digit = digit | 32;
            }
            out += toBase64Digit(digit);
        } while (value > 0);
        return out;
    }
    var B64_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    function toBase64Digit(value) {
        if (value < 0 || value >= 64) {
            throw new Error("Can only encode value in the range [0, 63]");
        }
        return B64_DIGITS[value];
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlX21hcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvc291cmNlX21hcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxtREFBbUM7SUFFbkMsdUZBQXVGO0lBQ3ZGLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQztJQUVsQixJQUFNLGFBQWEsR0FBRyxrREFBa0QsQ0FBQztJQWtCekU7UUFNRSw0QkFBb0IsSUFBd0I7WUFBeEIscUJBQUEsRUFBQSxXQUF3QjtZQUF4QixTQUFJLEdBQUosSUFBSSxDQUFvQjtZQUxwQyxtQkFBYyxHQUE2QixJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ3JELFVBQUssR0FBZ0IsRUFBRSxDQUFDO1lBQ3hCLGFBQVEsR0FBVyxDQUFDLENBQUM7WUFDckIsZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFFbUIsQ0FBQztRQUVoRCxnRkFBZ0Y7UUFDaEYsc0NBQVMsR0FBVCxVQUFVLEdBQVcsRUFBRSxPQUEyQjtZQUEzQix3QkFBQSxFQUFBLGNBQTJCO1lBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDakMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQ3ZDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsb0NBQU8sR0FBUDtZQUNFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1lBQ2xCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELHVDQUFVLEdBQVYsVUFBVyxJQUFZLEVBQUUsU0FBa0IsRUFBRSxXQUFvQixFQUFFLFVBQW1CO1lB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YUFBYSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztTQUM5RDtRQUVELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQWRELHdDQWNDO0lBRUQsU0FBUyxXQUFXLENBQUMsS0FBYTtRQUNoQyxLQUFLLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO1FBRXJELElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNiLEdBQUc7WUFDRCxJQUFJLEtBQUssR0FBRyxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ3ZCLEtBQUssR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDO1lBQ25CLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtnQkFDYixLQUFLLEdBQUcsS0FBSyxHQUFHLEVBQUUsQ0FBQzthQUNwQjtZQUNELEdBQUcsSUFBSSxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDN0IsUUFBUSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1FBRXBCLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELElBQU0sVUFBVSxHQUFHLGtFQUFrRSxDQUFDO0lBRXRGLFNBQVMsYUFBYSxDQUFDLEtBQWE7UUFDbEMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFLEVBQUU7WUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO1NBQy9EO1FBRUQsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHt1dGY4RW5jb2RlfSBmcm9tICcuLi91dGlsJztcblxuLy8gaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vZG9jdW1lbnQvZC8xVTFSR0FlaFF3UnlwVVRvdkYxS1JscGlPRnplMGItXzJnYzZmQUgwS1kway9lZGl0XG5jb25zdCBWRVJTSU9OID0gMztcblxuY29uc3QgSlNfQjY0X1BSRUZJWCA9ICcjIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCwnO1xuXG50eXBlIFNlZ21lbnQgPSB7XG4gIGNvbDA6IG51bWJlcixcbiAgc291cmNlVXJsPzogc3RyaW5nLFxuICBzb3VyY2VMaW5lMD86IG51bWJlcixcbiAgc291cmNlQ29sMD86IG51bWJlcixcbn07XG5cbmV4cG9ydCB0eXBlIFNvdXJjZU1hcCA9IHtcbiAgdmVyc2lvbjogbnVtYmVyLFxuICBmaWxlPzogc3RyaW5nLFxuICAgICAgc291cmNlUm9vdDogc3RyaW5nLFxuICAgICAgc291cmNlczogc3RyaW5nW10sXG4gICAgICBzb3VyY2VzQ29udGVudDogKHN0cmluZ3xudWxsKVtdLFxuICAgICAgbWFwcGluZ3M6IHN0cmluZyxcbn07XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VNYXBHZW5lcmF0b3Ige1xuICBwcml2YXRlIHNvdXJjZXNDb250ZW50OiBNYXA8c3RyaW5nLCBzdHJpbmd8bnVsbD4gPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgbGluZXM6IFNlZ21lbnRbXVtdID0gW107XG4gIHByaXZhdGUgbGFzdENvbDA6IG51bWJlciA9IDA7XG4gIHByaXZhdGUgaGFzTWFwcGluZ3MgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGZpbGU6IHN0cmluZ3xudWxsID0gbnVsbCkge31cblxuICAvLyBUaGUgY29udGVudCBpcyBgbnVsbGAgd2hlbiB0aGUgY29udGVudCBpcyBleHBlY3RlZCB0byBiZSBsb2FkZWQgdXNpbmcgdGhlIFVSTFxuICBhZGRTb3VyY2UodXJsOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ3xudWxsID0gbnVsbCk6IHRoaXMge1xuICAgIGlmICghdGhpcy5zb3VyY2VzQ29udGVudC5oYXModXJsKSkge1xuICAgICAgdGhpcy5zb3VyY2VzQ29udGVudC5zZXQodXJsLCBjb250ZW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBhZGRMaW5lKCk6IHRoaXMge1xuICAgIHRoaXMubGluZXMucHVzaChbXSk7XG4gICAgdGhpcy5sYXN0Q29sMCA9IDA7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBhZGRNYXBwaW5nKGNvbDA6IG51bWJlciwgc291cmNlVXJsPzogc3RyaW5nLCBzb3VyY2VMaW5lMD86IG51bWJlciwgc291cmNlQ29sMD86IG51bWJlcik6IHRoaXMge1xuICAgIGlmICghdGhpcy5jdXJyZW50TGluZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBIGxpbmUgbXVzdCBiZSBhZGRlZCBiZWZvcmUgbWFwcGluZ3MgY2FuIGJlIGFkZGVkYCk7XG4gICAgfVxuICAgIGlmIChzb3VyY2VVcmwgIT0gbnVsbCAmJiAhdGhpcy5zb3VyY2VzQ29udGVudC5oYXMoc291cmNlVXJsKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHNvdXJjZSBmaWxlIFwiJHtzb3VyY2VVcmx9XCJgKTtcbiAgICB9XG4gICAgaWYgKGNvbDAgPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgY29sdW1uIGluIHRoZSBnZW5lcmF0ZWQgY29kZSBtdXN0IGJlIHByb3ZpZGVkYCk7XG4gICAgfVxuICAgIGlmIChjb2wwIDwgdGhpcy5sYXN0Q29sMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBNYXBwaW5nIHNob3VsZCBiZSBhZGRlZCBpbiBvdXRwdXQgb3JkZXJgKTtcbiAgICB9XG4gICAgaWYgKHNvdXJjZVVybCAmJiAoc291cmNlTGluZTAgPT0gbnVsbCB8fCBzb3VyY2VDb2wwID09IG51bGwpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBzb3VyY2UgbG9jYXRpb24gbXVzdCBiZSBwcm92aWRlZCB3aGVuIGEgc291cmNlIHVybCBpcyBwcm92aWRlZGApO1xuICAgIH1cblxuICAgIHRoaXMuaGFzTWFwcGluZ3MgPSB0cnVlO1xuICAgIHRoaXMubGFzdENvbDAgPSBjb2wwO1xuICAgIHRoaXMuY3VycmVudExpbmUucHVzaCh7Y29sMCwgc291cmNlVXJsLCBzb3VyY2VMaW5lMCwgc291cmNlQ29sMH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbCBzdHJpcCB0aGlzIGZyb20gcHVibGlzaGVkIGQudHMgZmlsZXMgZHVlIHRvXG4gICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzYyMTZcbiAgICovXG4gIHByaXZhdGUgZ2V0IGN1cnJlbnRMaW5lKCk6IFNlZ21lbnRbXXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5saW5lcy5zbGljZSgtMSlbMF07XG4gIH1cblxuICB0b0pTT04oKTogU291cmNlTWFwfG51bGwge1xuICAgIGlmICghdGhpcy5oYXNNYXBwaW5ncykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc291cmNlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBjb25zdCBzb3VyY2VzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHNvdXJjZXNDb250ZW50OiAoc3RyaW5nfG51bGwpW10gPSBbXTtcblxuICAgIEFycmF5LmZyb20odGhpcy5zb3VyY2VzQ29udGVudC5rZXlzKCkpLmZvckVhY2goKHVybDogc3RyaW5nLCBpOiBudW1iZXIpID0+IHtcbiAgICAgIHNvdXJjZXNJbmRleC5zZXQodXJsLCBpKTtcbiAgICAgIHNvdXJjZXMucHVzaCh1cmwpO1xuICAgICAgc291cmNlc0NvbnRlbnQucHVzaCh0aGlzLnNvdXJjZXNDb250ZW50LmdldCh1cmwpIHx8IG51bGwpO1xuICAgIH0pO1xuXG4gICAgbGV0IG1hcHBpbmdzOiBzdHJpbmcgPSAnJztcbiAgICBsZXQgbGFzdENvbDA6IG51bWJlciA9IDA7XG4gICAgbGV0IGxhc3RTb3VyY2VJbmRleDogbnVtYmVyID0gMDtcbiAgICBsZXQgbGFzdFNvdXJjZUxpbmUwOiBudW1iZXIgPSAwO1xuICAgIGxldCBsYXN0U291cmNlQ29sMDogbnVtYmVyID0gMDtcblxuICAgIHRoaXMubGluZXMuZm9yRWFjaChzZWdtZW50cyA9PiB7XG4gICAgICBsYXN0Q29sMCA9IDA7XG5cbiAgICAgIG1hcHBpbmdzICs9IHNlZ21lbnRzXG4gICAgICAgICAgICAgICAgICAgICAgLm1hcChzZWdtZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHplcm8tYmFzZWQgc3RhcnRpbmcgY29sdW1uIG9mIHRoZSBsaW5lIGluIHRoZSBnZW5lcmF0ZWQgY29kZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNlZ0FzU3RyID0gdG9CYXNlNjRWTFEoc2VnbWVudC5jb2wwIC0gbGFzdENvbDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdENvbDAgPSBzZWdtZW50LmNvbDA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWdtZW50LnNvdXJjZVVybCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHplcm8tYmFzZWQgaW5kZXggaW50byB0aGUg4oCcc291cmNlc+KAnSBsaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNlZ0FzU3RyICs9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b0Jhc2U2NFZMUShzb3VyY2VzSW5kZXguZ2V0KHNlZ21lbnQuc291cmNlVXJsKSEgLSBsYXN0U291cmNlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0U291cmNlSW5kZXggPSBzb3VyY2VzSW5kZXguZ2V0KHNlZ21lbnQuc291cmNlVXJsKSE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSB6ZXJvLWJhc2VkIHN0YXJ0aW5nIGxpbmUgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZWdBc1N0ciArPSB0b0Jhc2U2NFZMUShzZWdtZW50LnNvdXJjZUxpbmUwISAtIGxhc3RTb3VyY2VMaW5lMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RTb3VyY2VMaW5lMCA9IHNlZ21lbnQuc291cmNlTGluZTAhO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgemVyby1iYXNlZCBzdGFydGluZyBjb2x1bW4gaW4gdGhlIG9yaWdpbmFsIHNvdXJjZVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZWdBc1N0ciArPSB0b0Jhc2U2NFZMUShzZWdtZW50LnNvdXJjZUNvbDAhIC0gbGFzdFNvdXJjZUNvbDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0U291cmNlQ29sMCA9IHNlZ21lbnQuc291cmNlQ29sMCE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWdBc1N0cjtcbiAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsJyk7XG4gICAgICBtYXBwaW5ncyArPSAnOyc7XG4gICAgfSk7XG5cbiAgICBtYXBwaW5ncyA9IG1hcHBpbmdzLnNsaWNlKDAsIC0xKTtcblxuICAgIHJldHVybiB7XG4gICAgICAnZmlsZSc6IHRoaXMuZmlsZSB8fCAnJyxcbiAgICAgICd2ZXJzaW9uJzogVkVSU0lPTixcbiAgICAgICdzb3VyY2VSb290JzogJycsXG4gICAgICAnc291cmNlcyc6IHNvdXJjZXMsXG4gICAgICAnc291cmNlc0NvbnRlbnQnOiBzb3VyY2VzQ29udGVudCxcbiAgICAgICdtYXBwaW5ncyc6IG1hcHBpbmdzLFxuICAgIH07XG4gIH1cblxuICB0b0pzQ29tbWVudCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmhhc01hcHBpbmdzID8gJy8vJyArIEpTX0I2NF9QUkVGSVggKyB0b0Jhc2U2NFN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAwKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyc7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvQmFzZTY0U3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgYjY0ID0gJyc7XG4gIHZhbHVlID0gdXRmOEVuY29kZSh2YWx1ZSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOykge1xuICAgIGNvbnN0IGkxID0gdmFsdWUuY2hhckNvZGVBdChpKyspO1xuICAgIGNvbnN0IGkyID0gdmFsdWUuY2hhckNvZGVBdChpKyspO1xuICAgIGNvbnN0IGkzID0gdmFsdWUuY2hhckNvZGVBdChpKyspO1xuICAgIGI2NCArPSB0b0Jhc2U2NERpZ2l0KGkxID4+IDIpO1xuICAgIGI2NCArPSB0b0Jhc2U2NERpZ2l0KCgoaTEgJiAzKSA8PCA0KSB8IChpc05hTihpMikgPyAwIDogaTIgPj4gNCkpO1xuICAgIGI2NCArPSBpc05hTihpMikgPyAnPScgOiB0b0Jhc2U2NERpZ2l0KCgoaTIgJiAxNSkgPDwgMikgfCAoaTMgPj4gNikpO1xuICAgIGI2NCArPSBpc05hTihpMikgfHwgaXNOYU4oaTMpID8gJz0nIDogdG9CYXNlNjREaWdpdChpMyAmIDYzKTtcbiAgfVxuXG4gIHJldHVybiBiNjQ7XG59XG5cbmZ1bmN0aW9uIHRvQmFzZTY0VkxRKHZhbHVlOiBudW1iZXIpOiBzdHJpbmcge1xuICB2YWx1ZSA9IHZhbHVlIDwgMCA/ICgoLXZhbHVlKSA8PCAxKSArIDEgOiB2YWx1ZSA8PCAxO1xuXG4gIGxldCBvdXQgPSAnJztcbiAgZG8ge1xuICAgIGxldCBkaWdpdCA9IHZhbHVlICYgMzE7XG4gICAgdmFsdWUgPSB2YWx1ZSA+PiA1O1xuICAgIGlmICh2YWx1ZSA+IDApIHtcbiAgICAgIGRpZ2l0ID0gZGlnaXQgfCAzMjtcbiAgICB9XG4gICAgb3V0ICs9IHRvQmFzZTY0RGlnaXQoZGlnaXQpO1xuICB9IHdoaWxlICh2YWx1ZSA+IDApO1xuXG4gIHJldHVybiBvdXQ7XG59XG5cbmNvbnN0IEI2NF9ESUdJVFMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbmZ1bmN0aW9uIHRvQmFzZTY0RGlnaXQodmFsdWU6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmICh2YWx1ZSA8IDAgfHwgdmFsdWUgPj0gNjQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENhbiBvbmx5IGVuY29kZSB2YWx1ZSBpbiB0aGUgcmFuZ2UgWzAsIDYzXWApO1xuICB9XG5cbiAgcmV0dXJuIEI2NF9ESUdJVFNbdmFsdWVdO1xufVxuIl19