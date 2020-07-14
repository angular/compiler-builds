(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/i18n/localize_utils", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/view/i18n/icu_serializer", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serializeI18nMessageForLocalize = exports.createLocalizeStatements = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var icu_serializer_1 = require("@angular/compiler/src/render3/view/i18n/icu_serializer");
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    function createLocalizeStatements(variable, message, params) {
        var _a = serializeI18nMessageForLocalize(message), messageParts = _a.messageParts, placeHolders = _a.placeHolders;
        var sourceSpan = getSourceSpan(message);
        var expressions = placeHolders.map(function (ph) { return params[ph]; });
        var localizedString = o.localizedString(message, messageParts, placeHolders, expressions, sourceSpan);
        var variableInitialization = variable.set(localizedString);
        return [new o.ExpressionStatement(variableInitialization)];
    }
    exports.createLocalizeStatements = createLocalizeStatements;
    var MessagePiece = /** @class */ (function () {
        function MessagePiece(text) {
            this.text = text;
        }
        return MessagePiece;
    }());
    var LiteralPiece = /** @class */ (function (_super) {
        tslib_1.__extends(LiteralPiece, _super);
        function LiteralPiece() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return LiteralPiece;
    }(MessagePiece));
    var PlaceholderPiece = /** @class */ (function (_super) {
        tslib_1.__extends(PlaceholderPiece, _super);
        function PlaceholderPiece(name) {
            return _super.call(this, util_1.formatI18nPlaceholderName(name, /* useCamelCase */ false)) || this;
        }
        return PlaceholderPiece;
    }(MessagePiece));
    /**
     * This visitor walks over an i18n tree, capturing literal strings and placeholders.
     *
     * The result can be used for generating the `$localize` tagged template literals.
     */
    var LocalizeSerializerVisitor = /** @class */ (function () {
        function LocalizeSerializerVisitor() {
        }
        LocalizeSerializerVisitor.prototype.visitText = function (text, context) {
            if (context[context.length - 1] instanceof LiteralPiece) {
                // Two literal pieces in a row means that there was some comment node in-between.
                context[context.length - 1].text += text.value;
            }
            else {
                context.push(new LiteralPiece(text.value));
            }
        };
        LocalizeSerializerVisitor.prototype.visitContainer = function (container, context) {
            var _this = this;
            container.children.forEach(function (child) { return child.visit(_this, context); });
        };
        LocalizeSerializerVisitor.prototype.visitIcu = function (icu, context) {
            context.push(new LiteralPiece(icu_serializer_1.serializeIcuNode(icu)));
        };
        LocalizeSerializerVisitor.prototype.visitTagPlaceholder = function (ph, context) {
            var _this = this;
            context.push(new PlaceholderPiece(ph.startName));
            if (!ph.isVoid) {
                ph.children.forEach(function (child) { return child.visit(_this, context); });
                context.push(new PlaceholderPiece(ph.closeName));
            }
        };
        LocalizeSerializerVisitor.prototype.visitPlaceholder = function (ph, context) {
            context.push(new PlaceholderPiece(ph.name));
        };
        LocalizeSerializerVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            context.push(new PlaceholderPiece(ph.name));
        };
        return LocalizeSerializerVisitor;
    }());
    var serializerVisitor = new LocalizeSerializerVisitor();
    /**
     * Serialize an i18n message into two arrays: messageParts and placeholders.
     *
     * These arrays will be used to generate `$localize` tagged template literals.
     *
     * @param message The message to be serialized.
     * @returns an object containing the messageParts and placeholders.
     */
    function serializeI18nMessageForLocalize(message) {
        var pieces = [];
        message.nodes.forEach(function (node) { return node.visit(serializerVisitor, pieces); });
        return processMessagePieces(pieces);
    }
    exports.serializeI18nMessageForLocalize = serializeI18nMessageForLocalize;
    function getSourceSpan(message) {
        var startNode = message.nodes[0];
        var endNode = message.nodes[message.nodes.length - 1];
        return new parse_util_1.ParseSourceSpan(startNode.sourceSpan.start, endNode.sourceSpan.end, startNode.sourceSpan.details);
    }
    /**
     * Convert the list of serialized MessagePieces into two arrays.
     *
     * One contains the literal string pieces and the other the placeholders that will be replaced by
     * expressions when rendering `$localize` tagged template literals.
     *
     * @param pieces The pieces to process.
     * @returns an object containing the messageParts and placeholders.
     */
    function processMessagePieces(pieces) {
        var messageParts = [];
        var placeHolders = [];
        if (pieces[0] instanceof PlaceholderPiece) {
            // The first piece was a placeholder so we need to add an initial empty message part.
            messageParts.push('');
        }
        for (var i = 0; i < pieces.length; i++) {
            var part = pieces[i];
            if (part instanceof LiteralPiece) {
                messageParts.push(part.text);
            }
            else {
                placeHolders.push(part.text);
                if (pieces[i - 1] instanceof PlaceholderPiece) {
                    // There were two placeholders in a row, so we need to add an empty message part.
                    messageParts.push('');
                }
            }
        }
        if (pieces[pieces.length - 1] instanceof PlaceholderPiece) {
            // The last piece was a placeholder so we need to add a final empty message part.
            messageParts.push('');
        }
        return { messageParts: messageParts, placeHolders: placeHolders };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxpemVfdXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2kxOG4vbG9jYWxpemVfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQVFBLDJEQUFnRDtJQUNoRCwrREFBb0Q7SUFFcEQseUZBQWtEO0lBQ2xELHFFQUFpRDtJQUVqRCxTQUFnQix3QkFBd0IsQ0FDcEMsUUFBdUIsRUFBRSxPQUFxQixFQUM5QyxNQUFzQztRQUNsQyxJQUFBLEtBQStCLCtCQUErQixDQUFDLE9BQU8sQ0FBQyxFQUF0RSxZQUFZLGtCQUFBLEVBQUUsWUFBWSxrQkFBNEMsQ0FBQztRQUM5RSxJQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDMUMsSUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEVBQUUsSUFBSSxPQUFBLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBVixDQUFVLENBQUMsQ0FBQztRQUN2RCxJQUFNLGVBQWUsR0FDakIsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDcEYsSUFBTSxzQkFBc0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzdELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQVZELDREQVVDO0lBRUQ7UUFDRSxzQkFBbUIsSUFBWTtZQUFaLFNBQUksR0FBSixJQUFJLENBQVE7UUFBRyxDQUFDO1FBQ3JDLG1CQUFDO0lBQUQsQ0FBQyxBQUZELElBRUM7SUFDRDtRQUEyQix3Q0FBWTtRQUF2Qzs7UUFBeUMsQ0FBQztRQUFELG1CQUFDO0lB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SSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsWUFBWSxnQkFBZ0IsRUFBRTtZQUN6RCxpRkFBaUY7WUFDakYsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUN2QjtRQUNELE9BQU8sRUFBQyxZQUFZLGNBQUEsRUFBRSxZQUFZLGNBQUEsRUFBQyxDQUFDO0lBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcblxuaW1wb3J0IHtzZXJpYWxpemVJY3VOb2RlfSBmcm9tICcuL2ljdV9zZXJpYWxpemVyJztcbmltcG9ydCB7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2FsaXplU3RhdGVtZW50cyhcbiAgICB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgbWVzc2FnZTogaTE4bi5NZXNzYWdlLFxuICAgIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHttZXNzYWdlUGFydHMsIHBsYWNlSG9sZGVyc30gPSBzZXJpYWxpemVJMThuTWVzc2FnZUZvckxvY2FsaXplKG1lc3NhZ2UpO1xuICBjb25zdCBzb3VyY2VTcGFuID0gZ2V0U291cmNlU3BhbihtZXNzYWdlKTtcbiAgY29uc3QgZXhwcmVzc2lvbnMgPSBwbGFjZUhvbGRlcnMubWFwKHBoID0+IHBhcmFtc1twaF0pO1xuICBjb25zdCBsb2NhbGl6ZWRTdHJpbmcgPVxuICAgICAgby5sb2NhbGl6ZWRTdHJpbmcobWVzc2FnZSwgbWVzc2FnZVBhcnRzLCBwbGFjZUhvbGRlcnMsIGV4cHJlc3Npb25zLCBzb3VyY2VTcGFuKTtcbiAgY29uc3QgdmFyaWFibGVJbml0aWFsaXphdGlvbiA9IHZhcmlhYmxlLnNldChsb2NhbGl6ZWRTdHJpbmcpO1xuICByZXR1cm4gW25ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGVJbml0aWFsaXphdGlvbildO1xufVxuXG5jbGFzcyBNZXNzYWdlUGllY2Uge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nKSB7fVxufVxuY2xhc3MgTGl0ZXJhbFBpZWNlIGV4dGVuZHMgTWVzc2FnZVBpZWNlIHt9XG5jbGFzcyBQbGFjZWhvbGRlclBpZWNlIGV4dGVuZHMgTWVzc2FnZVBpZWNlIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZShuYW1lLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpKTtcbiAgfVxufVxuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIGFuIGkxOG4gdHJlZSwgY2FwdHVyaW5nIGxpdGVyYWwgc3RyaW5ncyBhbmQgcGxhY2Vob2xkZXJzLlxuICpcbiAqIFRoZSByZXN1bHQgY2FuIGJlIHVzZWQgZm9yIGdlbmVyYXRpbmcgdGhlIGAkbG9jYWxpemVgIHRhZ2dlZCB0ZW1wbGF0ZSBsaXRlcmFscy5cbiAqL1xuY2xhc3MgTG9jYWxpemVTZXJpYWxpemVyVmlzaXRvciBpbXBsZW1lbnRzIGkxOG4uVmlzaXRvciB7XG4gIHZpc2l0VGV4dCh0ZXh0OiBpMThuLlRleHQsIGNvbnRleHQ6IE1lc3NhZ2VQaWVjZVtdKTogYW55IHtcbiAgICBpZiAoY29udGV4dFtjb250ZXh0Lmxlbmd0aCAtIDFdIGluc3RhbmNlb2YgTGl0ZXJhbFBpZWNlKSB7XG4gICAgICAvLyBUd28gbGl0ZXJhbCBwaWVjZXMgaW4gYSByb3cgbWVhbnMgdGhhdCB0aGVyZSB3YXMgc29tZSBjb21tZW50IG5vZGUgaW4tYmV0d2Vlbi5cbiAgICAgIGNvbnRleHRbY29udGV4dC5sZW5ndGggLSAxXS50ZXh0ICs9IHRleHQudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQucHVzaChuZXcgTGl0ZXJhbFBpZWNlKHRleHQudmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyLCBjb250ZXh0OiBNZXNzYWdlUGllY2VbXSk6IGFueSB7XG4gICAgY29udGFpbmVyLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiBpMThuLkljdSwgY29udGV4dDogTWVzc2FnZVBpZWNlW10pOiBhbnkge1xuICAgIGNvbnRleHQucHVzaChuZXcgTGl0ZXJhbFBpZWNlKHNlcmlhbGl6ZUljdU5vZGUoaWN1KSkpO1xuICB9XG5cbiAgdmlzaXRUYWdQbGFjZWhvbGRlcihwaDogaTE4bi5UYWdQbGFjZWhvbGRlciwgY29udGV4dDogTWVzc2FnZVBpZWNlW10pOiBhbnkge1xuICAgIGNvbnRleHQucHVzaChuZXcgUGxhY2Vob2xkZXJQaWVjZShwaC5zdGFydE5hbWUpKTtcbiAgICBpZiAoIXBoLmlzVm9pZCkge1xuICAgICAgcGguY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgICBjb250ZXh0LnB1c2gobmV3IFBsYWNlaG9sZGVyUGllY2UocGguY2xvc2VOYW1lKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRQbGFjZWhvbGRlcihwaDogaTE4bi5QbGFjZWhvbGRlciwgY29udGV4dDogTWVzc2FnZVBpZWNlW10pOiBhbnkge1xuICAgIGNvbnRleHQucHVzaChuZXcgUGxhY2Vob2xkZXJQaWVjZShwaC5uYW1lKSk7XG4gIH1cblxuICB2aXNpdEljdVBsYWNlaG9sZGVyKHBoOiBpMThuLkljdVBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICBjb250ZXh0LnB1c2gobmV3IFBsYWNlaG9sZGVyUGllY2UocGgubmFtZSkpO1xuICB9XG59XG5cbmNvbnN0IHNlcmlhbGl6ZXJWaXNpdG9yID0gbmV3IExvY2FsaXplU2VyaWFsaXplclZpc2l0b3IoKTtcblxuLyoqXG4gKiBTZXJpYWxpemUgYW4gaTE4biBtZXNzYWdlIGludG8gdHdvIGFycmF5czogbWVzc2FnZVBhcnRzIGFuZCBwbGFjZWhvbGRlcnMuXG4gKlxuICogVGhlc2UgYXJyYXlzIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBgJGxvY2FsaXplYCB0YWdnZWQgdGVtcGxhdGUgbGl0ZXJhbHMuXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG1lc3NhZ2UgdG8gYmUgc2VyaWFsaXplZC5cbiAqIEByZXR1cm5zIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBtZXNzYWdlUGFydHMgYW5kIHBsYWNlaG9sZGVycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5NZXNzYWdlRm9yTG9jYWxpemUobWVzc2FnZTogaTE4bi5NZXNzYWdlKTpcbiAgICB7bWVzc2FnZVBhcnRzOiBzdHJpbmdbXSwgcGxhY2VIb2xkZXJzOiBzdHJpbmdbXX0ge1xuICBjb25zdCBwaWVjZXM6IE1lc3NhZ2VQaWVjZVtdID0gW107XG4gIG1lc3NhZ2Uubm9kZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQoc2VyaWFsaXplclZpc2l0b3IsIHBpZWNlcykpO1xuICByZXR1cm4gcHJvY2Vzc01lc3NhZ2VQaWVjZXMocGllY2VzKTtcbn1cblxuZnVuY3Rpb24gZ2V0U291cmNlU3BhbihtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICBjb25zdCBzdGFydE5vZGUgPSBtZXNzYWdlLm5vZGVzWzBdO1xuICBjb25zdCBlbmROb2RlID0gbWVzc2FnZS5ub2Rlc1ttZXNzYWdlLm5vZGVzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgIHN0YXJ0Tm9kZS5zb3VyY2VTcGFuLnN0YXJ0LCBlbmROb2RlLnNvdXJjZVNwYW4uZW5kLCBzdGFydE5vZGUuc291cmNlU3Bhbi5kZXRhaWxzKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IHRoZSBsaXN0IG9mIHNlcmlhbGl6ZWQgTWVzc2FnZVBpZWNlcyBpbnRvIHR3byBhcnJheXMuXG4gKlxuICogT25lIGNvbnRhaW5zIHRoZSBsaXRlcmFsIHN0cmluZyBwaWVjZXMgYW5kIHRoZSBvdGhlciB0aGUgcGxhY2Vob2xkZXJzIHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieVxuICogZXhwcmVzc2lvbnMgd2hlbiByZW5kZXJpbmcgYCRsb2NhbGl6ZWAgdGFnZ2VkIHRlbXBsYXRlIGxpdGVyYWxzLlxuICpcbiAqIEBwYXJhbSBwaWVjZXMgVGhlIHBpZWNlcyB0byBwcm9jZXNzLlxuICogQHJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG1lc3NhZ2VQYXJ0cyBhbmQgcGxhY2Vob2xkZXJzLlxuICovXG5mdW5jdGlvbiBwcm9jZXNzTWVzc2FnZVBpZWNlcyhwaWVjZXM6IE1lc3NhZ2VQaWVjZVtdKTpcbiAgICB7bWVzc2FnZVBhcnRzOiBzdHJpbmdbXSwgcGxhY2VIb2xkZXJzOiBzdHJpbmdbXX0ge1xuICBjb25zdCBtZXNzYWdlUGFydHM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHBsYWNlSG9sZGVyczogc3RyaW5nW10gPSBbXTtcblxuICBpZiAocGllY2VzWzBdIGluc3RhbmNlb2YgUGxhY2Vob2xkZXJQaWVjZSkge1xuICAgIC8vIFRoZSBmaXJzdCBwaWVjZSB3YXMgYSBwbGFjZWhvbGRlciBzbyB3ZSBuZWVkIHRvIGFkZCBhbiBpbml0aWFsIGVtcHR5IG1lc3NhZ2UgcGFydC5cbiAgICBtZXNzYWdlUGFydHMucHVzaCgnJyk7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBpZWNlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHBhcnQgPSBwaWVjZXNbaV07XG4gICAgaWYgKHBhcnQgaW5zdGFuY2VvZiBMaXRlcmFsUGllY2UpIHtcbiAgICAgIG1lc3NhZ2VQYXJ0cy5wdXNoKHBhcnQudGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBsYWNlSG9sZGVycy5wdXNoKHBhcnQudGV4dCk7XG4gICAgICBpZiAocGllY2VzW2kgLSAxXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyUGllY2UpIHtcbiAgICAgICAgLy8gVGhlcmUgd2VyZSB0d28gcGxhY2Vob2xkZXJzIGluIGEgcm93LCBzbyB3ZSBuZWVkIHRvIGFkZCBhbiBlbXB0eSBtZXNzYWdlIHBhcnQuXG4gICAgICAgIG1lc3NhZ2VQYXJ0cy5wdXNoKCcnKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHBpZWNlc1twaWVjZXMubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBQbGFjZWhvbGRlclBpZWNlKSB7XG4gICAgLy8gVGhlIGxhc3QgcGllY2Ugd2FzIGEgcGxhY2Vob2xkZXIgc28gd2UgbmVlZCB0byBhZGQgYSBmaW5hbCBlbXB0eSBtZXNzYWdlIHBhcnQuXG4gICAgbWVzc2FnZVBhcnRzLnB1c2goJycpO1xuICB9XG4gIHJldHVybiB7bWVzc2FnZVBhcnRzLCBwbGFjZUhvbGRlcnN9O1xufVxuIl19