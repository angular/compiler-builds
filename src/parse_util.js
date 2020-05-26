(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/parse_util", ["require", "exports", "@angular/compiler/src/chars", "@angular/compiler/src/compile_metadata"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.r3JitTypeSourceSpan = exports.typeSourceSpan = exports.ParseError = exports.ParseErrorLevel = exports.ParseSourceSpan = exports.ParseSourceFile = exports.ParseLocation = void 0;
    /**
     * @license
     * Copyright Google Inc. All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var chars = require("@angular/compiler/src/chars");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var ParseLocation = /** @class */ (function () {
        function ParseLocation(file, offset, line, col) {
            this.file = file;
            this.offset = offset;
            this.line = line;
            this.col = col;
        }
        ParseLocation.prototype.toString = function () {
            return this.offset != null ? this.file.url + "@" + this.line + ":" + this.col : this.file.url;
        };
        ParseLocation.prototype.moveBy = function (delta) {
            var source = this.file.content;
            var len = source.length;
            var offset = this.offset;
            var line = this.line;
            var col = this.col;
            while (offset > 0 && delta < 0) {
                offset--;
                delta++;
                var ch = source.charCodeAt(offset);
                if (ch == chars.$LF) {
                    line--;
                    var priorLine = source.substr(0, offset - 1).lastIndexOf(String.fromCharCode(chars.$LF));
                    col = priorLine > 0 ? offset - priorLine : offset;
                }
                else {
                    col--;
                }
            }
            while (offset < len && delta > 0) {
                var ch = source.charCodeAt(offset);
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
        ParseLocation.prototype.getContext = function (maxChars, maxLines) {
            var content = this.file.content;
            var startOffset = this.offset;
            if (startOffset != null) {
                if (startOffset > content.length - 1) {
                    startOffset = content.length - 1;
                }
                var endOffset = startOffset;
                var ctxChars = 0;
                var ctxLines = 0;
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
    exports.ParseLocation = ParseLocation;
    var ParseSourceFile = /** @class */ (function () {
        function ParseSourceFile(content, url) {
            this.content = content;
            this.url = url;
        }
        return ParseSourceFile;
    }());
    exports.ParseSourceFile = ParseSourceFile;
    var ParseSourceSpan = /** @class */ (function () {
        function ParseSourceSpan(start, end, details) {
            if (details === void 0) { details = null; }
            this.start = start;
            this.end = end;
            this.details = details;
        }
        ParseSourceSpan.prototype.toString = function () {
            return this.start.file.content.substring(this.start.offset, this.end.offset);
        };
        return ParseSourceSpan;
    }());
    exports.ParseSourceSpan = ParseSourceSpan;
    var ParseErrorLevel;
    (function (ParseErrorLevel) {
        ParseErrorLevel[ParseErrorLevel["WARNING"] = 0] = "WARNING";
        ParseErrorLevel[ParseErrorLevel["ERROR"] = 1] = "ERROR";
    })(ParseErrorLevel = exports.ParseErrorLevel || (exports.ParseErrorLevel = {}));
    var ParseError = /** @class */ (function () {
        function ParseError(span, msg, level) {
            if (level === void 0) { level = ParseErrorLevel.ERROR; }
            this.span = span;
            this.msg = msg;
            this.level = level;
        }
        ParseError.prototype.contextualMessage = function () {
            var ctx = this.span.start.getContext(100, 3);
            return ctx ? this.msg + " (\"" + ctx.before + "[" + ParseErrorLevel[this.level] + " ->]" + ctx.after + "\")" :
                this.msg;
        };
        ParseError.prototype.toString = function () {
            var details = this.span.details ? ", " + this.span.details : '';
            return this.contextualMessage() + ": " + this.span.start + details;
        };
        return ParseError;
    }());
    exports.ParseError = ParseError;
    function typeSourceSpan(kind, type) {
        var moduleUrl = compile_metadata_1.identifierModuleUrl(type);
        var sourceFileName = moduleUrl != null ? "in " + kind + " " + compile_metadata_1.identifierName(type) + " in " + moduleUrl :
            "in " + kind + " " + compile_metadata_1.identifierName(type);
        var sourceFile = new ParseSourceFile('', sourceFileName);
        return new ParseSourceSpan(new ParseLocation(sourceFile, -1, -1, -1), new ParseLocation(sourceFile, -1, -1, -1));
    }
    exports.typeSourceSpan = typeSourceSpan;
    /**
     * Generates Source Span object for a given R3 Type for JIT mode.
     *
     * @param kind Component or Directive.
     * @param typeName name of the Component or Directive.
     * @param sourceUrl reference to Component or Directive source.
     * @returns instance of ParseSourceSpan that represent a given Component or Directive.
     */
    function r3JitTypeSourceSpan(kind, typeName, sourceUrl) {
        var sourceFileName = "in " + kind + " " + typeName + " in " + sourceUrl;
        var sourceFile = new ParseSourceFile('', sourceFileName);
        return new ParseSourceSpan(new ParseLocation(sourceFile, -1, -1, -1), new ParseLocation(sourceFile, -1, -1, -1));
    }
    exports.r3JitTypeSourceSpan = r3JitTypeSourceSpan;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VfdXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9wYXJzZV91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILG1EQUFpQztJQUNqQywyRUFBa0c7SUFFbEc7UUFDRSx1QkFDVyxJQUFxQixFQUFTLE1BQWMsRUFBUyxJQUFZLEVBQ2pFLEdBQVc7WUFEWCxTQUFJLEdBQUosSUFBSSxDQUFpQjtZQUFTLFdBQU0sR0FBTixNQUFNLENBQVE7WUFBUyxTQUFJLEdBQUosSUFBSSxDQUFRO1lBQ2pFLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFBRyxDQUFDO1FBRTFCLGdDQUFRLEdBQVI7WUFDRSxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBSSxJQUFJLENBQUMsSUFBSSxTQUFJLElBQUksQ0FBQyxHQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQzNGLENBQUM7UUFFRCw4QkFBTSxHQUFOLFVBQU8sS0FBYTtZQUNsQixJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNqQyxJQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1lBQzFCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDekIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztZQUNyQixJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ25CLE9BQU8sTUFBTSxHQUFHLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFO2dCQUM5QixNQUFNLEVBQUUsQ0FBQztnQkFDVCxLQUFLLEVBQUUsQ0FBQztnQkFDUixJQUFNLEVBQUUs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VSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBUEQsd0NBT0M7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsU0FBZ0IsbUJBQW1CLENBQy9CLElBQVksRUFBRSxRQUFnQixFQUFFLFNBQWlCO1FBQ25ELElBQU0sY0FBYyxHQUFHLFFBQU0sSUFBSSxTQUFJLFFBQVEsWUFBTyxTQUFXLENBQUM7UUFDaEUsSUFBTSxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQUMsRUFBRSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQzNELE9BQU8sSUFBSSxlQUFlLENBQ3RCLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQU5ELGtEQU1DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi9jaGFycyc7XG5pbXBvcnQge0NvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEsIGlkZW50aWZpZXJNb2R1bGVVcmwsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuL2NvbXBpbGVfbWV0YWRhdGEnO1xuXG5leHBvcnQgY2xhc3MgUGFyc2VMb2NhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGZpbGU6IFBhcnNlU291cmNlRmlsZSwgcHVibGljIG9mZnNldDogbnVtYmVyLCBwdWJsaWMgbGluZTogbnVtYmVyLFxuICAgICAgcHVibGljIGNvbDogbnVtYmVyKSB7fVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMub2Zmc2V0ICE9IG51bGwgPyBgJHt0aGlzLmZpbGUudXJsfUAke3RoaXMubGluZX06JHt0aGlzLmNvbH1gIDogdGhpcy5maWxlLnVybDtcbiAgfVxuXG4gIG1vdmVCeShkZWx0YTogbnVtYmVyKTogUGFyc2VMb2NhdGlvbiB7XG4gICAgY29uc3Qgc291cmNlID0gdGhpcy5maWxlLmNvbnRlbnQ7XG4gICAgY29uc3QgbGVuID0gc291cmNlLmxlbmd0aDtcbiAgICBsZXQgb2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XG4gICAgbGV0IGxpbmUgPSB0aGlzLmxpbmU7XG4gICAgbGV0IGNvbCA9IHRoaXMuY29sO1xuICAgIHdoaWxlIChvZmZzZXQgPiAwICYmIGRlbHRhIDwgMCkge1xuICAgICAgb2Zmc2V0LS07XG4gICAgICBkZWx0YSsrO1xuICAgICAgY29uc3QgY2ggPSBzb3VyY2UuY2hhckNvZGVBdChvZmZzZXQpO1xuICAgICAgaWYgKGNoID09IGNoYXJzLiRMRikge1xuICAgICAgICBsaW5lLS07XG4gICAgICAgIGNvbnN0IHByaW9yTGluZSA9IHNvdXJjZS5zdWJzdHIoMCwgb2Zmc2V0IC0gMSkubGFzdEluZGV4T2YoU3RyaW5nLmZyb21DaGFyQ29kZShjaGFycy4kTEYpKTtcbiAgICAgICAgY29sID0gcHJpb3JMaW5lID4gMCA/IG9mZnNldCAtIHByaW9yTGluZSA6IG9mZnNldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbC0tO1xuICAgICAgfVxuICAgIH1cbiAgICB3aGlsZSAob2Zmc2V0IDwgbGVuICYmIGRlbHRhID4gMCkge1xuICAgICAgY29uc3QgY2ggPSBzb3VyY2UuY2hhckNvZGVBdChvZmZzZXQpO1xuICAgICAgb2Zmc2V0Kys7XG4gICAgICBkZWx0YS0tO1xuICAgICAgaWYgKGNoID09IGNoYXJzLiRMRikge1xuICAgICAgICBsaW5lKys7XG4gICAgICAgIGNvbCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb2wrKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBQYXJzZUxvY2F0aW9uKHRoaXMuZmlsZSwgb2Zmc2V0LCBsaW5lLCBjb2wpO1xuICB9XG5cbiAgLy8gUmV0dXJuIHRoZSBzb3VyY2UgYXJvdW5kIHRoZSBsb2NhdGlvblxuICAvLyBVcCB0byBgbWF4Q2hhcnNgIG9yIGBtYXhMaW5lc2Agb24gZWFjaCBzaWRlIG9mIHRoZSBsb2NhdGlvblxuICBnZXRDb250ZXh0KG1heENoYXJzOiBudW1iZXIsIG1heExpbmVzOiBudW1iZXIpOiB7YmVmb3JlOiBzdHJpbmcsIGFmdGVyOiBzdHJpbmd9fG51bGwge1xuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmZpbGUuY29udGVudDtcbiAgICBsZXQgc3RhcnRPZmZzZXQgPSB0aGlzLm9mZnNldDtcblxuICAgIGlmIChzdGFydE9mZnNldCAhPSBudWxsKSB7XG4gICAgICBpZiAoc3RhcnRPZmZzZXQgPiBjb250ZW50Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgc3RhcnRPZmZzZXQgPSBjb250ZW50Lmxlbmd0aCAtIDE7XG4gICAgICB9XG4gICAgICBsZXQgZW5kT2Zmc2V0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICBsZXQgY3R4Q2hhcnMgPSAwO1xuICAgICAgbGV0IGN0eExpbmVzID0gMDtcblxuICAgICAgd2hpbGUgKGN0eENoYXJzIDwgbWF4Q2hhcnMgJiYgc3RhcnRPZmZzZXQgPiAwKSB7XG4gICAgICAgIHN0YXJ0T2Zmc2V0LS07XG4gICAgICAgIGN0eENoYXJzKys7XG4gICAgICAgIGlmIChjb250ZW50W3N0YXJ0T2Zmc2V0XSA9PSAnXFxuJykge1xuICAgICAgICAgIGlmICgrK2N0eExpbmVzID09IG1heExpbmVzKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY3R4Q2hhcnMgPSAwO1xuICAgICAgY3R4TGluZXMgPSAwO1xuICAgICAgd2hpbGUgKGN0eENoYXJzIDwgbWF4Q2hhcnMgJiYgZW5kT2Zmc2V0IDwgY29udGVudC5sZW5ndGggLSAxKSB7XG4gICAgICAgIGVuZE9mZnNldCsrO1xuICAgICAgICBjdHhDaGFycysrO1xuICAgICAgICBpZiAoY29udGVudFtlbmRPZmZzZXRdID09ICdcXG4nKSB7XG4gICAgICAgICAgaWYgKCsrY3R4TGluZXMgPT0gbWF4TGluZXMpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBiZWZvcmU6IGNvbnRlbnQuc3Vic3RyaW5nKHN0YXJ0T2Zmc2V0LCB0aGlzLm9mZnNldCksXG4gICAgICAgIGFmdGVyOiBjb250ZW50LnN1YnN0cmluZyh0aGlzLm9mZnNldCwgZW5kT2Zmc2V0ICsgMSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZVNvdXJjZUZpbGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGVudDogc3RyaW5nLCBwdWJsaWMgdXJsOiBzdHJpbmcpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZVNvdXJjZVNwYW4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBzdGFydDogUGFyc2VMb2NhdGlvbiwgcHVibGljIGVuZDogUGFyc2VMb2NhdGlvbiwgcHVibGljIGRldGFpbHM6IHN0cmluZ3xudWxsID0gbnVsbCkge31cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0LmZpbGUuY29udGVudC5zdWJzdHJpbmcodGhpcy5zdGFydC5vZmZzZXQsIHRoaXMuZW5kLm9mZnNldCk7XG4gIH1cbn1cblxuZXhwb3J0IGVudW0gUGFyc2VFcnJvckxldmVsIHtcbiAgV0FSTklORyxcbiAgRVJST1IsXG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgbXNnOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgbGV2ZWw6IFBhcnNlRXJyb3JMZXZlbCA9IFBhcnNlRXJyb3JMZXZlbC5FUlJPUikge31cblxuICBjb250ZXh0dWFsTWVzc2FnZSgpOiBzdHJpbmcge1xuICAgIGNvbnN0IGN0eCA9IHRoaXMuc3Bhbi5zdGFydC5nZXRDb250ZXh0KDEwMCwgMyk7XG4gICAgcmV0dXJuIGN0eCA/IGAke3RoaXMubXNnfSAoXCIke2N0eC5iZWZvcmV9WyR7UGFyc2VFcnJvckxldmVsW3RoaXMubGV2ZWxdfSAtPl0ke2N0eC5hZnRlcn1cIilgIDpcbiAgICAgICAgICAgICAgICAgdGhpcy5tc2c7XG4gIH1cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIGNvbnN0IGRldGFpbHMgPSB0aGlzLnNwYW4uZGV0YWlscyA/IGAsICR7dGhpcy5zcGFuLmRldGFpbHN9YCA6ICcnO1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnRleHR1YWxNZXNzYWdlKCl9OiAke3RoaXMuc3Bhbi5zdGFydH0ke2RldGFpbHN9YDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdHlwZVNvdXJjZVNwYW4oa2luZDogc3RyaW5nLCB0eXBlOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgY29uc3QgbW9kdWxlVXJsID0gaWRlbnRpZmllck1vZHVsZVVybCh0eXBlKTtcbiAgY29uc3Qgc291cmNlRmlsZU5hbWUgPSBtb2R1bGVVcmwgIT0gbnVsbCA/IGBpbiAke2tpbmR9ICR7aWRlbnRpZmllck5hbWUodHlwZSl9IGluICR7bW9kdWxlVXJsfWAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGluICR7a2luZH0gJHtpZGVudGlmaWVyTmFtZSh0eXBlKX1gO1xuICBjb25zdCBzb3VyY2VGaWxlID0gbmV3IFBhcnNlU291cmNlRmlsZSgnJywgc291cmNlRmlsZU5hbWUpO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgIG5ldyBQYXJzZUxvY2F0aW9uKHNvdXJjZUZpbGUsIC0xLCAtMSwgLTEpLCBuZXcgUGFyc2VMb2NhdGlvbihzb3VyY2VGaWxlLCAtMSwgLTEsIC0xKSk7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIFNvdXJjZSBTcGFuIG9iamVjdCBmb3IgYSBnaXZlbiBSMyBUeXBlIGZvciBKSVQgbW9kZS5cbiAqXG4gKiBAcGFyYW0ga2luZCBDb21wb25lbnQgb3IgRGlyZWN0aXZlLlxuICogQHBhcmFtIHR5cGVOYW1lIG5hbWUgb2YgdGhlIENvbXBvbmVudCBvciBEaXJlY3RpdmUuXG4gKiBAcGFyYW0gc291cmNlVXJsIHJlZmVyZW5jZSB0byBDb21wb25lbnQgb3IgRGlyZWN0aXZlIHNvdXJjZS5cbiAqIEByZXR1cm5zIGluc3RhbmNlIG9mIFBhcnNlU291cmNlU3BhbiB0aGF0IHJlcHJlc2VudCBhIGdpdmVuIENvbXBvbmVudCBvciBEaXJlY3RpdmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByM0ppdFR5cGVTb3VyY2VTcGFuKFxuICAgIGtpbmQ6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICBjb25zdCBzb3VyY2VGaWxlTmFtZSA9IGBpbiAke2tpbmR9ICR7dHlwZU5hbWV9IGluICR7c291cmNlVXJsfWA7XG4gIGNvbnN0IHNvdXJjZUZpbGUgPSBuZXcgUGFyc2VTb3VyY2VGaWxlKCcnLCBzb3VyY2VGaWxlTmFtZSk7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgbmV3IFBhcnNlTG9jYXRpb24oc291cmNlRmlsZSwgLTEsIC0xLCAtMSksIG5ldyBQYXJzZUxvY2F0aW9uKHNvdXJjZUZpbGUsIC0xLCAtMSwgLTEpKTtcbn1cbiJdfQ==