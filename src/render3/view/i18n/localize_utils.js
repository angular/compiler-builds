(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/i18n/localize_utils", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/view/i18n/icu_serializer", "@angular/compiler/src/render3/view/i18n/meta", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var icu_serializer_1 = require("@angular/compiler/src/render3/view/i18n/icu_serializer");
    var meta_1 = require("@angular/compiler/src/render3/view/i18n/meta");
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    function createLocalizeStatements(variable, message, params) {
        var statements = [];
        var jsdocComment = meta_1.i18nMetaToDocStmt(meta_1.metaFromI18nMessage(message));
        if (jsdocComment !== null) {
            statements.push(jsdocComment);
        }
        var _a = serializeI18nMessageForLocalize(message), messageParts = _a.messageParts, placeHolders = _a.placeHolders;
        statements.push(new o.ExpressionStatement(variable.set(o.localizedString(messageParts, placeHolders, placeHolders.map(function (ph) { return params[ph]; })))));
        return statements;
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
            return _super.call(this, util_1.formatI18nPlaceholderName(name)) || this;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxpemVfdXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2kxOG4vbG9jYWxpemVfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBUUEsMkRBQWdEO0lBRWhELHlGQUFrRDtJQUNsRCxxRUFBOEQ7SUFDOUQscUVBQWlEO0lBRWpELFNBQWdCLHdCQUF3QixDQUNwQyxRQUF1QixFQUFFLE9BQXFCLEVBQzlDLE1BQXNDO1FBQ3hDLElBQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUV0QixJQUFNLFlBQVksR0FBRyx3QkFBaUIsQ0FBQywwQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLElBQUksWUFBWSxLQUFLLElBQUksRUFBRTtZQUN6QixVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQy9CO1FBRUssSUFBQSw2Q0FBdUUsRUFBdEUsOEJBQVksRUFBRSw4QkFBd0QsQ0FBQztRQUM5RSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQ2xELENBQUMsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQUEsRUFBRSxJQUFJLE9BQUEsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFWLENBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFekYsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQWZELDREQWVDO0lBRUQ7UUFDRSxzQkFBbUIsSUFBWTtZQUFaLFNBQUksR0FBSixJQUFJLENBQVE7UUFBRyxDQUFDO1FBQ3JDLG1CQUFDO0lBQUQsQ0FBQyxBQUZELElBRUM7SUFDRDtRQUEyQix3Q0FBWTtRQUF2Qzs7UUFBeUMsQ0FBQztRQUFE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QjtRQUVsRCxJQUFNLFlBQVksR0FBYSxFQUFFLENBQUM7UUFDbEMsSUFBTSxZQUFZLEdBQWEsRUFBRSxDQUFDO1FBRWxDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxZQUFZLGdCQUFnQixFQUFFO1lBQ3pDLHFGQUFxRjtZQUNyRixZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ3ZCO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDdEMsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksSUFBSSxZQUFZLFlBQVksRUFBRTtnQkFDaEMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDOUI7aUJBQU07Z0JBQ0wsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdCLElBQUksTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsWUFBWSxnQkFBZ0IsRUFBRTtvQkFDN0MsaUZBQWlGO29CQUNqRixZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUN2QjthQUNGO1NBQ0Y7UUFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxZQUFZLGdCQUFnQixFQUFFO1lBQ3pELGlGQUFpRjtZQUNqRixZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ3ZCO1FBQ0QsT0FBTyxFQUFDLFlBQVksY0FBQSxFQUFFLFlBQVksY0FBQSxFQUFDLENBQUM7SUFDdEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtzZXJpYWxpemVJY3VOb2RlfSBmcm9tICcuL2ljdV9zZXJpYWxpemVyJztcbmltcG9ydCB7aTE4bk1ldGFUb0RvY1N0bXQsIG1ldGFGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vbWV0YSc7XG5pbXBvcnQge2Zvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWV9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHMoXG4gICAgdmFyaWFibGU6IG8uUmVhZFZhckV4cHIsIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSxcbiAgICBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSk6IG8uU3RhdGVtZW50W10ge1xuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG5cbiAgY29uc3QganNkb2NDb21tZW50ID0gaTE4bk1ldGFUb0RvY1N0bXQobWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlKSk7XG4gIGlmIChqc2RvY0NvbW1lbnQgIT09IG51bGwpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2goanNkb2NDb21tZW50KTtcbiAgfVxuXG4gIGNvbnN0IHttZXNzYWdlUGFydHMsIHBsYWNlSG9sZGVyc30gPSBzZXJpYWxpemVJMThuTWVzc2FnZUZvckxvY2FsaXplKG1lc3NhZ2UpO1xuICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQoXG4gICAgICBvLmxvY2FsaXplZFN0cmluZyhtZXNzYWdlUGFydHMsIHBsYWNlSG9sZGVycywgcGxhY2VIb2xkZXJzLm1hcChwaCA9PiBwYXJhbXNbcGhdKSkpKSk7XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbmNsYXNzIE1lc3NhZ2VQaWVjZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0ZXh0OiBzdHJpbmcpIHt9XG59XG5jbGFzcyBMaXRlcmFsUGllY2UgZXh0ZW5kcyBNZXNzYWdlUGllY2Uge31cbmNsYXNzIFBsYWNlaG9sZGVyUGllY2UgZXh0ZW5kcyBNZXNzYWdlUGllY2Uge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHsgc3VwZXIoZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZShuYW1lKSk7IH1cbn1cblxuLyoqXG4gKiBUaGlzIHZpc2l0b3Igd2Fsa3Mgb3ZlciBhbiBpMThuIHRyZWUsIGNhcHR1cmluZyBsaXRlcmFsIHN0cmluZ3MgYW5kIHBsYWNlaG9sZGVycy5cbiAqXG4gKiBUaGUgcmVzdWx0IGNhbiBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBgJGxvY2FsaXplYCB0YWdnZWQgdGVtcGxhdGUgbGl0ZXJhbHMuXG4gKi9cbmNsYXNzIExvY2FsaXplU2VyaWFsaXplclZpc2l0b3IgaW1wbGVtZW50cyBpMThuLlZpc2l0b3Ige1xuICB2aXNpdFRleHQodGV4dDogaTE4bi5UZXh0LCBjb250ZXh0OiBNZXNzYWdlUGllY2VbXSk6IGFueSB7XG4gICAgaWYgKGNvbnRleHRbY29udGV4dC5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIExpdGVyYWxQaWVjZSkge1xuICAgICAgLy8gVHdvIGxpdGVyYWwgcGllY2VzIGluIGEgcm93IG1lYW5zIHRoYXQgdGhlcmUgd2FzIHNvbWUgY29tbWVudCBub2RlIGluLWJldHdlZW4uXG4gICAgICBjb250ZXh0W2NvbnRleHQubGVuZ3RoIC0gMV0udGV4dCArPSB0ZXh0LnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LnB1c2gobmV3IExpdGVyYWxQaWVjZSh0ZXh0LnZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRDb250YWluZXIoY29udGFpbmVyOiBpMThuLkNvbnRhaW5lciwgY29udGV4dDogTWVzc2FnZVBpZWNlW10pOiBhbnkge1xuICAgIGNvbnRhaW5lci5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogaTE4bi5JY3UsIGNvbnRleHQ6IE1lc3NhZ2VQaWVjZVtdKTogYW55IHtcbiAgICBjb250ZXh0LnB1c2gobmV3IExpdGVyYWxQaWVjZShzZXJpYWxpemVJY3VOb2RlKGljdSkpKTtcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ6IE1lc3NhZ2VQaWVjZVtdKTogYW55IHtcbiAgICBjb250ZXh0LnB1c2gobmV3IFBsYWNlaG9sZGVyUGllY2UocGguc3RhcnROYW1lKSk7XG4gICAgaWYgKCFwaC5pc1ZvaWQpIHtcbiAgICAgIHBoLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgICAgY29udGV4dC5wdXNoKG5ldyBQbGFjZWhvbGRlclBpZWNlKHBoLmNsb3NlTmFtZSkpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIGNvbnRleHQ6IE1lc3NhZ2VQaWVjZVtdKTogYW55IHtcbiAgICBjb250ZXh0LnB1c2gobmV3IFBsYWNlaG9sZGVyUGllY2UocGgubmFtZSkpO1xuICB9XG5cbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogaTE4bi5JY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgY29udGV4dC5wdXNoKG5ldyBQbGFjZWhvbGRlclBpZWNlKHBoLm5hbWUpKTtcbiAgfVxufVxuXG5jb25zdCBzZXJpYWxpemVyVmlzaXRvciA9IG5ldyBMb2NhbGl6ZVNlcmlhbGl6ZXJWaXNpdG9yKCk7XG5cbi8qKlxuICogU2VyaWFsaXplIGFuIGkxOG4gbWVzc2FnZSBpbnRvIHR3byBhcnJheXM6IG1lc3NhZ2VQYXJ0cyBhbmQgcGxhY2Vob2xkZXJzLlxuICpcbiAqIFRoZXNlIGFycmF5cyB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYCRsb2NhbGl6ZWAgdGFnZ2VkIHRlbXBsYXRlIGxpdGVyYWxzLlxuICpcbiAqIEBwYXJhbSBtZXNzYWdlIFRoZSBtZXNzYWdlIHRvIGJlIHNlcmlhbGl6ZWQuXG4gKiBAcmV0dXJucyBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgbWVzc2FnZVBhcnRzIGFuZCBwbGFjZWhvbGRlcnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJMThuTWVzc2FnZUZvckxvY2FsaXplKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6XG4gICAge21lc3NhZ2VQYXJ0czogc3RyaW5nW10sIHBsYWNlSG9sZGVyczogc3RyaW5nW119IHtcbiAgY29uc3QgcGllY2VzOiBNZXNzYWdlUGllY2VbXSA9IFtdO1xuICBtZXNzYWdlLm5vZGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHNlcmlhbGl6ZXJWaXNpdG9yLCBwaWVjZXMpKTtcbiAgcmV0dXJuIHByb2Nlc3NNZXNzYWdlUGllY2VzKHBpZWNlcyk7XG59XG5cbi8qKlxuICogQ29udmVydCB0aGUgbGlzdCBvZiBzZXJpYWxpemVkIE1lc3NhZ2VQaWVjZXMgaW50byB0d28gYXJyYXlzLlxuICpcbiAqIE9uZSBjb250YWlucyB0aGUgbGl0ZXJhbCBzdHJpbmcgcGllY2VzIGFuZCB0aGUgb3RoZXIgdGhlIHBsYWNlaG9sZGVycyB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnlcbiAqIGV4cHJlc3Npb25zIHdoZW4gcmVuZGVyaW5nIGAkbG9jYWxpemVgIHRhZ2dlZCB0ZW1wbGF0ZSBsaXRlcmFscy5cbiAqXG4gKiBAcGFyYW0gcGllY2VzIFRoZSBwaWVjZXMgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBtZXNzYWdlUGFydHMgYW5kIHBsYWNlaG9sZGVycy5cbiAqL1xuZnVuY3Rpb24gcHJvY2Vzc01lc3NhZ2VQaWVjZXMocGllY2VzOiBNZXNzYWdlUGllY2VbXSk6XG4gICAge21lc3NhZ2VQYXJ0czogc3RyaW5nW10sIHBsYWNlSG9sZGVyczogc3RyaW5nW119IHtcbiAgY29uc3QgbWVzc2FnZVBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBwbGFjZUhvbGRlcnM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKHBpZWNlc1swXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyUGllY2UpIHtcbiAgICAvLyBUaGUgZmlyc3QgcGllY2Ugd2FzIGEgcGxhY2Vob2xkZXIgc28gd2UgbmVlZCB0byBhZGQgYW4gaW5pdGlhbCBlbXB0eSBtZXNzYWdlIHBhcnQuXG4gICAgbWVzc2FnZVBhcnRzLnB1c2goJycpO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwaWVjZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBwYXJ0ID0gcGllY2VzW2ldO1xuICAgIGlmIChwYXJ0IGluc3RhbmNlb2YgTGl0ZXJhbFBpZWNlKSB7XG4gICAgICBtZXNzYWdlUGFydHMucHVzaChwYXJ0LnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwbGFjZUhvbGRlcnMucHVzaChwYXJ0LnRleHQpO1xuICAgICAgaWYgKHBpZWNlc1tpIC0gMV0gaW5zdGFuY2VvZiBQbGFjZWhvbGRlclBpZWNlKSB7XG4gICAgICAgIC8vIFRoZXJlIHdlcmUgdHdvIHBsYWNlaG9sZGVycyBpbiBhIHJvdywgc28gd2UgbmVlZCB0byBhZGQgYW4gZW1wdHkgbWVzc2FnZSBwYXJ0LlxuICAgICAgICBtZXNzYWdlUGFydHMucHVzaCgnJyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChwaWVjZXNbcGllY2VzLmxlbmd0aCAtIDFdIGluc3RhbmNlb2YgUGxhY2Vob2xkZXJQaWVjZSkge1xuICAgIC8vIFRoZSBsYXN0IHBpZWNlIHdhcyBhIHBsYWNlaG9sZGVyIHNvIHdlIG5lZWQgdG8gYWRkIGEgZmluYWwgZW1wdHkgbWVzc2FnZSBwYXJ0LlxuICAgIG1lc3NhZ2VQYXJ0cy5wdXNoKCcnKTtcbiAgfVxuICByZXR1cm4ge21lc3NhZ2VQYXJ0cywgcGxhY2VIb2xkZXJzfTtcbn0iXX0=