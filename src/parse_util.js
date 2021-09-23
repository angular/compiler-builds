(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/parse_util", ["require", "exports", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/chars", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sanitizeIdentifier = exports.identifierModuleUrl = exports.identifierName = exports.getParseErrors = exports.isSyntaxError = exports.syntaxError = exports.r3JitTypeSourceSpan = exports.typeSourceSpan = exports.ParseError = exports.ParseErrorLevel = exports.ParseSourceSpan = exports.ParseSourceFile = exports.ParseLocation = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var chars = require("@angular/compiler/src/chars");
    var util_1 = require("@angular/compiler/src/util");
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
        /**
         * Create an object that holds information about spans of tokens/nodes captured during
         * lexing/parsing of text.
         *
         * @param start
         * The location of the start of the span (having skipped leading trivia).
         * Skipping leading trivia makes source-spans more "user friendly", since things like HTML
         * elements will appear to begin at the start of the opening tag, rather than at the start of any
         * leading trivia, which could include newlines.
         *
         * @param end
         * The location of the end of the span.
         *
         * @param fullStart
         * The start of the token without skipping the leading trivia.
         * This is used by tooling that splits tokens further, such as extracting Angular interpolations
         * from text tokens. Such tooling creates new source-spans relative to the original token's
         * source-span. If leading trivia characters have been skipped then the new source-spans may be
         * incorrectly offset.
         *
         * @param details
         * Additional information (such as identifier names) that should be associated with the span.
         */
        function ParseSourceSpan(start, end, fullStart, details) {
            if (fullStart === void 0) { fullStart = start; }
            if (details === void 0) { details = null; }
            this.start = start;
            this.end = end;
            this.fullStart = fullStart;
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
        var moduleUrl = identifierModuleUrl(type);
        var sourceFileName = moduleUrl != null ? "in " + kind + " " + identifierName(type) + " in " + moduleUrl :
            "in " + kind + " " + identifierName(type);
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
    function syntaxError(msg, parseErrors) {
        var error = Error(msg);
        error[ERROR_SYNTAX_ERROR] = true;
        if (parseErrors)
            error[ERROR_PARSE_ERRORS] = parseErrors;
        return error;
    }
    exports.syntaxError = syntaxError;
    var ERROR_SYNTAX_ERROR = 'ngSyntaxError';
    var ERROR_PARSE_ERRORS = 'ngParseErrors';
    function isSyntaxError(error) {
        return error[ERROR_SYNTAX_ERROR];
    }
    exports.isSyntaxError = isSyntaxError;
    function getParseErrors(error) {
        return error[ERROR_PARSE_ERRORS] || [];
    }
    exports.getParseErrors = getParseErrors;
    var _anonymousTypeIndex = 0;
    function identifierName(compileIdentifier) {
        if (!compileIdentifier || !compileIdentifier.reference) {
            return null;
        }
        var ref = compileIdentifier.reference;
        if (ref instanceof static_symbol_1.StaticSymbol) {
            return ref.name;
        }
        if (ref['__anonymousType']) {
            return ref['__anonymousType'];
        }
        if (ref['__forward_ref__']) {
            // We do not want to try to stringify a `forwardRef()` function because that would cause the
            // inner function to be evaluated too early, defeating the whole point of the `forwardRef`.
            return '__forward_ref__';
        }
        var identifier = (0, util_1.stringify)(ref);
        if (identifier.indexOf('(') >= 0) {
            // case: anonymous functions!
            identifier = "anonymous_" + _anonymousTypeIndex++;
            ref['__anonymousType'] = identifier;
        }
        else {
            identifier = sanitizeIdentifier(identifier);
        }
        return identifier;
    }
    exports.identifierName = identifierName;
    function identifierModuleUrl(compileIdentifier) {
        var ref = compileIdentifier.reference;
        if (ref instanceof static_symbol_1.StaticSymbol) {
            return ref.filePath;
        }
        // Runtime type
        return "./" + (0, util_1.stringify)(ref);
    }
    exports.identifierModuleUrl = identifierModuleUrl;
    function sanitizeIdentifier(name) {
        return name.replace(/\W/g, '_');
    }
    exports.sanitizeIdentifier = sanitizeIdentifier;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VfdXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9wYXJzZV91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILHlFQUFpRDtJQUNqRCxtREFBaUM7SUFDakMsbURBQWlDO0lBRWpDO1FBQ0UsdUJBQ1csSUFBcUIsRUFBUyxNQUFjLEVBQVMsSUFBWSxFQUNqRSxHQUFXO1lBRFgsU0FBSSxHQUFKLElBQUksQ0FBaUI7WUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFRO1lBQVMsU0FBSSxHQUFKLElBQUksQ0FBUTtZQUNqRSxRQUFHLEdBQUgsR0FBRyxDQUFRO1FBQUcsQ0FBQztRQUUxQixnQ0FBUSxHQUFSO1lBQ0UsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQUksSUFBSSxDQUFDLElBQUksU0FBSSxJQUFJLENBQUMsR0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUMzRixDQUFDO1FBRUQsOEJBQU0sR0FBTixVQUFPLEtBQWE7WUFDbEIsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDakMsSUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztZQUMxQixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3pCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDckIsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUNuQixPQUFPLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtnQkFDOUIsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsS0FBSyxFQUFFLENBQUM7Z0JB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bUIsQ0FBQyxpQkFBNEM7UUFDOUUsSUFBTSxHQUFHLEdBQUcsaUJBQWlCLENBQUMsU0FBUyxDQUFDO1FBQ3hDLElBQUksR0FBRyxZQUFZLDRCQUFZLEVBQUU7WUFDL0IsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDO1NBQ3JCO1FBQ0QsZUFBZTtRQUNmLE9BQU8sT0FBSyxJQUFBLGdCQUFTLEVBQUMsR0FBRyxDQUFHLENBQUM7SUFDL0IsQ0FBQztJQVBELGtEQU9DO0lBTUQsU0FBZ0Isa0JBQWtCLENBQUMsSUFBWTtRQUM3QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFGRCxnREFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi9jaGFycyc7XG5pbXBvcnQge3N0cmluZ2lmeX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGNsYXNzIFBhcnNlTG9jYXRpb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBmaWxlOiBQYXJzZVNvdXJjZUZpbGUsIHB1YmxpYyBvZmZzZXQ6IG51bWJlciwgcHVibGljIGxpbmU6IG51bWJlcixcbiAgICAgIHB1YmxpYyBjb2w6IG51bWJlcikge31cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLm9mZnNldCAhPSBudWxsID8gYCR7dGhpcy5maWxlLnVybH1AJHt0aGlzLmxpbmV9OiR7dGhpcy5jb2x9YCA6IHRoaXMuZmlsZS51cmw7XG4gIH1cblxuICBtb3ZlQnkoZGVsdGE6IG51bWJlcik6IFBhcnNlTG9jYXRpb24ge1xuICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuZmlsZS5jb250ZW50O1xuICAgIGNvbnN0IGxlbiA9IHNvdXJjZS5sZW5ndGg7XG4gICAgbGV0IG9mZnNldCA9IHRoaXMub2Zmc2V0O1xuICAgIGxldCBsaW5lID0gdGhpcy5saW5lO1xuICAgIGxldCBjb2wgPSB0aGlzLmNvbDtcbiAgICB3aGlsZSAob2Zmc2V0ID4gMCAmJiBkZWx0YSA8IDApIHtcbiAgICAgIG9mZnNldC0tO1xuICAgICAgZGVsdGErKztcbiAgICAgIGNvbnN0IGNoID0gc291cmNlLmNoYXJDb2RlQXQob2Zmc2V0KTtcbiAgICAgIGlmIChjaCA9PSBjaGFycy4kTEYpIHtcbiAgICAgICAgbGluZS0tO1xuICAgICAgICBjb25zdCBwcmlvckxpbmUgPSBzb3VyY2Uuc3Vic3RyKDAsIG9mZnNldCAtIDEpLmxhc3RJbmRleE9mKFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhcnMuJExGKSk7XG4gICAgICAgIGNvbCA9IHByaW9yTGluZSA+IDAgPyBvZmZzZXQgLSBwcmlvckxpbmUgOiBvZmZzZXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb2wtLTtcbiAgICAgIH1cbiAgICB9XG4gICAgd2hpbGUgKG9mZnNldCA8IGxlbiAmJiBkZWx0YSA+IDApIHtcbiAgICAgIGNvbnN0IGNoID0gc291cmNlLmNoYXJDb2RlQXQob2Zmc2V0KTtcbiAgICAgIG9mZnNldCsrO1xuICAgICAgZGVsdGEtLTtcbiAgICAgIGlmIChjaCA9PSBjaGFycy4kTEYpIHtcbiAgICAgICAgbGluZSsrO1xuICAgICAgICBjb2wgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29sKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgUGFyc2VMb2NhdGlvbih0aGlzLmZpbGUsIG9mZnNldCwgbGluZSwgY29sKTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgc291cmNlIGFyb3VuZCB0aGUgbG9jYXRpb25cbiAgLy8gVXAgdG8gYG1heENoYXJzYCBvciBgbWF4TGluZXNgIG9uIGVhY2ggc2lkZSBvZiB0aGUgbG9jYXRpb25cbiAgZ2V0Q29udGV4dChtYXhDaGFyczogbnVtYmVyLCBtYXhMaW5lczogbnVtYmVyKToge2JlZm9yZTogc3RyaW5nLCBhZnRlcjogc3RyaW5nfXxudWxsIHtcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5maWxlLmNvbnRlbnQ7XG4gICAgbGV0IHN0YXJ0T2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XG5cbiAgICBpZiAoc3RhcnRPZmZzZXQgIT0gbnVsbCkge1xuICAgICAgaWYgKHN0YXJ0T2Zmc2V0ID4gY29udGVudC5sZW5ndGggLSAxKSB7XG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gY29udGVudC5sZW5ndGggLSAxO1xuICAgICAgfVxuICAgICAgbGV0IGVuZE9mZnNldCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgbGV0IGN0eENoYXJzID0gMDtcbiAgICAgIGxldCBjdHhMaW5lcyA9IDA7XG5cbiAgICAgIHdoaWxlIChjdHhDaGFycyA8IG1heENoYXJzICYmIHN0YXJ0T2Zmc2V0ID4gMCkge1xuICAgICAgICBzdGFydE9mZnNldC0tO1xuICAgICAgICBjdHhDaGFycysrO1xuICAgICAgICBpZiAoY29udGVudFtzdGFydE9mZnNldF0gPT0gJ1xcbicpIHtcbiAgICAgICAgICBpZiAoKytjdHhMaW5lcyA9PSBtYXhMaW5lcykge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGN0eENoYXJzID0gMDtcbiAgICAgIGN0eExpbmVzID0gMDtcbiAgICAgIHdoaWxlIChjdHhDaGFycyA8IG1heENoYXJzICYmIGVuZE9mZnNldCA8IGNvbnRlbnQubGVuZ3RoIC0gMSkge1xuICAgICAgICBlbmRPZmZzZXQrKztcbiAgICAgICAgY3R4Q2hhcnMrKztcbiAgICAgICAgaWYgKGNvbnRlbnRbZW5kT2Zmc2V0XSA9PSAnXFxuJykge1xuICAgICAgICAgIGlmICgrK2N0eExpbmVzID09IG1heExpbmVzKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmVmb3JlOiBjb250ZW50LnN1YnN0cmluZyhzdGFydE9mZnNldCwgdGhpcy5vZmZzZXQpLFxuICAgICAgICBhZnRlcjogY29udGVudC5zdWJzdHJpbmcodGhpcy5vZmZzZXQsIGVuZE9mZnNldCArIDEpLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VTb3VyY2VGaWxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRlbnQ6IHN0cmluZywgcHVibGljIHVybDogc3RyaW5nKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VTb3VyY2VTcGFuIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhbiBvYmplY3QgdGhhdCBob2xkcyBpbmZvcm1hdGlvbiBhYm91dCBzcGFucyBvZiB0b2tlbnMvbm9kZXMgY2FwdHVyZWQgZHVyaW5nXG4gICAqIGxleGluZy9wYXJzaW5nIG9mIHRleHQuXG4gICAqXG4gICAqIEBwYXJhbSBzdGFydFxuICAgKiBUaGUgbG9jYXRpb24gb2YgdGhlIHN0YXJ0IG9mIHRoZSBzcGFuIChoYXZpbmcgc2tpcHBlZCBsZWFkaW5nIHRyaXZpYSkuXG4gICAqIFNraXBwaW5nIGxlYWRpbmcgdHJpdmlhIG1ha2VzIHNvdXJjZS1zcGFucyBtb3JlIFwidXNlciBmcmllbmRseVwiLCBzaW5jZSB0aGluZ3MgbGlrZSBIVE1MXG4gICAqIGVsZW1lbnRzIHdpbGwgYXBwZWFyIHRvIGJlZ2luIGF0IHRoZSBzdGFydCBvZiB0aGUgb3BlbmluZyB0YWcsIHJhdGhlciB0aGFuIGF0IHRoZSBzdGFydCBvZiBhbnlcbiAgICogbGVhZGluZyB0cml2aWEsIHdoaWNoIGNvdWxkIGluY2x1ZGUgbmV3bGluZXMuXG4gICAqXG4gICAqIEBwYXJhbSBlbmRcbiAgICogVGhlIGxvY2F0aW9uIG9mIHRoZSBlbmQgb2YgdGhlIHNwYW4uXG4gICAqXG4gICAqIEBwYXJhbSBmdWxsU3RhcnRcbiAgICogVGhlIHN0YXJ0IG9mIHRoZSB0b2tlbiB3aXRob3V0IHNraXBwaW5nIHRoZSBsZWFkaW5nIHRyaXZpYS5cbiAgICogVGhpcyBpcyB1c2VkIGJ5IHRvb2xpbmcgdGhhdCBzcGxpdHMgdG9rZW5zIGZ1cnRoZXIsIHN1Y2ggYXMgZXh0cmFjdGluZyBBbmd1bGFyIGludGVycG9sYXRpb25zXG4gICAqIGZyb20gdGV4dCB0b2tlbnMuIFN1Y2ggdG9vbGluZyBjcmVhdGVzIG5ldyBzb3VyY2Utc3BhbnMgcmVsYXRpdmUgdG8gdGhlIG9yaWdpbmFsIHRva2VuJ3NcbiAgICogc291cmNlLXNwYW4uIElmIGxlYWRpbmcgdHJpdmlhIGNoYXJhY3RlcnMgaGF2ZSBiZWVuIHNraXBwZWQgdGhlbiB0aGUgbmV3IHNvdXJjZS1zcGFucyBtYXkgYmVcbiAgICogaW5jb3JyZWN0bHkgb2Zmc2V0LlxuICAgKlxuICAgKiBAcGFyYW0gZGV0YWlsc1xuICAgKiBBZGRpdGlvbmFsIGluZm9ybWF0aW9uIChzdWNoIGFzIGlkZW50aWZpZXIgbmFtZXMpIHRoYXQgc2hvdWxkIGJlIGFzc29jaWF0ZWQgd2l0aCB0aGUgc3Bhbi5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHN0YXJ0OiBQYXJzZUxvY2F0aW9uLCBwdWJsaWMgZW5kOiBQYXJzZUxvY2F0aW9uLFxuICAgICAgcHVibGljIGZ1bGxTdGFydDogUGFyc2VMb2NhdGlvbiA9IHN0YXJ0LCBwdWJsaWMgZGV0YWlsczogc3RyaW5nfG51bGwgPSBudWxsKSB7fVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnQuZmlsZS5jb250ZW50LnN1YnN0cmluZyh0aGlzLnN0YXJ0Lm9mZnNldCwgdGhpcy5lbmQub2Zmc2V0KTtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBQYXJzZUVycm9yTGV2ZWwge1xuICBXQVJOSU5HLFxuICBFUlJPUixcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBtc2c6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBsZXZlbDogUGFyc2VFcnJvckxldmVsID0gUGFyc2VFcnJvckxldmVsLkVSUk9SKSB7fVxuXG4gIGNvbnRleHR1YWxNZXNzYWdlKCk6IHN0cmluZyB7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5zcGFuLnN0YXJ0LmdldENvbnRleHQoMTAwLCAzKTtcbiAgICByZXR1cm4gY3R4ID8gYCR7dGhpcy5tc2d9IChcIiR7Y3R4LmJlZm9yZX1bJHtQYXJzZUVycm9yTGV2ZWxbdGhpcy5sZXZlbF19IC0+XSR7Y3R4LmFmdGVyfVwiKWAgOlxuICAgICAgICAgICAgICAgICB0aGlzLm1zZztcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgY29uc3QgZGV0YWlscyA9IHRoaXMuc3Bhbi5kZXRhaWxzID8gYCwgJHt0aGlzLnNwYW4uZGV0YWlsc31gIDogJyc7XG4gICAgcmV0dXJuIGAke3RoaXMuY29udGV4dHVhbE1lc3NhZ2UoKX06ICR7dGhpcy5zcGFuLnN0YXJ0fSR7ZGV0YWlsc31gO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0eXBlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGU6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICBjb25zdCBtb2R1bGVVcmwgPSBpZGVudGlmaWVyTW9kdWxlVXJsKHR5cGUpO1xuICBjb25zdCBzb3VyY2VGaWxlTmFtZSA9IG1vZHVsZVVybCAhPSBudWxsID8gYGluICR7a2luZH0gJHtpZGVudGlmaWVyTmFtZSh0eXBlKX0gaW4gJHttb2R1bGVVcmx9YCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgaW4gJHtraW5kfSAke2lkZW50aWZpZXJOYW1lKHR5cGUpfWA7XG4gIGNvbnN0IHNvdXJjZUZpbGUgPSBuZXcgUGFyc2VTb3VyY2VGaWxlKCcnLCBzb3VyY2VGaWxlTmFtZSk7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgbmV3IFBhcnNlTG9jYXRpb24oc291cmNlRmlsZSwgLTEsIC0xLCAtMSksIG5ldyBQYXJzZUxvY2F0aW9uKHNvdXJjZUZpbGUsIC0xLCAtMSwgLTEpKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgU291cmNlIFNwYW4gb2JqZWN0IGZvciBhIGdpdmVuIFIzIFR5cGUgZm9yIEpJVCBtb2RlLlxuICpcbiAqIEBwYXJhbSBraW5kIENvbXBvbmVudCBvciBEaXJlY3RpdmUuXG4gKiBAcGFyYW0gdHlwZU5hbWUgbmFtZSBvZiB0aGUgQ29tcG9uZW50IG9yIERpcmVjdGl2ZS5cbiAqIEBwYXJhbSBzb3VyY2VVcmwgcmVmZXJlbmNlIHRvIENvbXBvbmVudCBvciBEaXJlY3RpdmUgc291cmNlLlxuICogQHJldHVybnMgaW5zdGFuY2Ugb2YgUGFyc2VTb3VyY2VTcGFuIHRoYXQgcmVwcmVzZW50IGEgZ2l2ZW4gQ29tcG9uZW50IG9yIERpcmVjdGl2ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHIzSml0VHlwZVNvdXJjZVNwYW4oXG4gICAga2luZDogc3RyaW5nLCB0eXBlTmFtZTogc3RyaW5nLCBzb3VyY2VVcmw6IHN0cmluZyk6IFBhcnNlU291cmNlU3BhbiB7XG4gIGNvbnN0IHNvdXJjZUZpbGVOYW1lID0gYGluICR7a2luZH0gJHt0eXBlTmFtZX0gaW4gJHtzb3VyY2VVcmx9YDtcbiAgY29uc3Qgc291cmNlRmlsZSA9IG5ldyBQYXJzZVNvdXJjZUZpbGUoJycsIHNvdXJjZUZpbGVOYW1lKTtcbiAgcmV0dXJuIG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICBuZXcgUGFyc2VMb2NhdGlvbihzb3VyY2VGaWxlLCAtMSwgLTEsIC0xKSwgbmV3IFBhcnNlTG9jYXRpb24oc291cmNlRmlsZSwgLTEsIC0xLCAtMSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3ludGF4RXJyb3IobXNnOiBzdHJpbmcsIHBhcnNlRXJyb3JzPzogUGFyc2VFcnJvcltdKTogRXJyb3Ige1xuICBjb25zdCBlcnJvciA9IEVycm9yKG1zZyk7XG4gIChlcnJvciBhcyBhbnkpW0VSUk9SX1NZTlRBWF9FUlJPUl0gPSB0cnVlO1xuICBpZiAocGFyc2VFcnJvcnMpIChlcnJvciBhcyBhbnkpW0VSUk9SX1BBUlNFX0VSUk9SU10gPSBwYXJzZUVycm9ycztcbiAgcmV0dXJuIGVycm9yO1xufVxuXG5jb25zdCBFUlJPUl9TWU5UQVhfRVJST1IgPSAnbmdTeW50YXhFcnJvcic7XG5jb25zdCBFUlJPUl9QQVJTRV9FUlJPUlMgPSAnbmdQYXJzZUVycm9ycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1N5bnRheEVycm9yKGVycm9yOiBFcnJvcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGVycm9yIGFzIGFueSlbRVJST1JfU1lOVEFYX0VSUk9SXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFBhcnNlRXJyb3JzKGVycm9yOiBFcnJvcik6IFBhcnNlRXJyb3JbXSB7XG4gIHJldHVybiAoZXJyb3IgYXMgYW55KVtFUlJPUl9QQVJTRV9FUlJPUlNdIHx8IFtdO1xufVxuXG5sZXQgX2Fub255bW91c1R5cGVJbmRleCA9IDA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpZGVudGlmaWVyTmFtZShjb21waWxlSWRlbnRpZmllcjogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YXxudWxsfHVuZGVmaW5lZCk6IHN0cmluZ3xcbiAgICBudWxsIHtcbiAgaWYgKCFjb21waWxlSWRlbnRpZmllciB8fCAhY29tcGlsZUlkZW50aWZpZXIucmVmZXJlbmNlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3QgcmVmID0gY29tcGlsZUlkZW50aWZpZXIucmVmZXJlbmNlO1xuICBpZiAocmVmIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgcmV0dXJuIHJlZi5uYW1lO1xuICB9XG4gIGlmIChyZWZbJ19fYW5vbnltb3VzVHlwZSddKSB7XG4gICAgcmV0dXJuIHJlZlsnX19hbm9ueW1vdXNUeXBlJ107XG4gIH1cbiAgaWYgKHJlZlsnX19mb3J3YXJkX3JlZl9fJ10pIHtcbiAgICAvLyBXZSBkbyBub3Qgd2FudCB0byB0cnkgdG8gc3RyaW5naWZ5IGEgYGZvcndhcmRSZWYoKWAgZnVuY3Rpb24gYmVjYXVzZSB0aGF0IHdvdWxkIGNhdXNlIHRoZVxuICAgIC8vIGlubmVyIGZ1bmN0aW9uIHRvIGJlIGV2YWx1YXRlZCB0b28gZWFybHksIGRlZmVhdGluZyB0aGUgd2hvbGUgcG9pbnQgb2YgdGhlIGBmb3J3YXJkUmVmYC5cbiAgICByZXR1cm4gJ19fZm9yd2FyZF9yZWZfXyc7XG4gIH1cbiAgbGV0IGlkZW50aWZpZXIgPSBzdHJpbmdpZnkocmVmKTtcbiAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignKCcpID49IDApIHtcbiAgICAvLyBjYXNlOiBhbm9ueW1vdXMgZnVuY3Rpb25zIVxuICAgIGlkZW50aWZpZXIgPSBgYW5vbnltb3VzXyR7X2Fub255bW91c1R5cGVJbmRleCsrfWA7XG4gICAgcmVmWydfX2Fub255bW91c1R5cGUnXSA9IGlkZW50aWZpZXI7XG4gIH0gZWxzZSB7XG4gICAgaWRlbnRpZmllciA9IHNhbml0aXplSWRlbnRpZmllcihpZGVudGlmaWVyKTtcbiAgfVxuICByZXR1cm4gaWRlbnRpZmllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlkZW50aWZpZXJNb2R1bGVVcmwoY29tcGlsZUlkZW50aWZpZXI6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEpOiBzdHJpbmcge1xuICBjb25zdCByZWYgPSBjb21waWxlSWRlbnRpZmllci5yZWZlcmVuY2U7XG4gIGlmIChyZWYgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICByZXR1cm4gcmVmLmZpbGVQYXRoO1xuICB9XG4gIC8vIFJ1bnRpbWUgdHlwZVxuICByZXR1cm4gYC4vJHtzdHJpbmdpZnkocmVmKX1gO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEge1xuICByZWZlcmVuY2U6IGFueTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplSWRlbnRpZmllcihuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gbmFtZS5yZXBsYWNlKC9cXFcvZywgJ18nKTtcbn1cbiJdfQ==