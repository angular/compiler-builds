import { __extends } from "tslib";
import * as o from '../../../output/output_ast';
import { serializeIcuNode } from './icu_serializer';
import { metaFromI18nMessage } from './meta';
import { formatI18nPlaceholderName } from './util';
export function createLocalizeStatements(variable, message, params) {
    var statements = [];
    var _a = serializeI18nMessageForLocalize(message), messageParts = _a.messageParts, placeHolders = _a.placeHolders;
    statements.push(new o.ExpressionStatement(variable.set(o.localizedString(metaFromI18nMessage(message), messageParts, placeHolders, placeHolders.map(function (ph) { return params[ph]; })))));
    return statements;
}
var MessagePiece = /** @class */ (function () {
    function MessagePiece(text) {
        this.text = text;
    }
    return MessagePiece;
}());
var LiteralPiece = /** @class */ (function (_super) {
    __extends(LiteralPiece, _super);
    function LiteralPiece() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return LiteralPiece;
}(MessagePiece));
var PlaceholderPiece = /** @class */ (function (_super) {
    __extends(PlaceholderPiece, _super);
    function PlaceholderPiece(name) {
        return _super.call(this, formatI18nPlaceholderName(name, /* useCamelCase */ false)) || this;
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
        context.push(new LiteralPiece(serializeIcuNode(icu)));
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
export function serializeI18nMessageForLocalize(message) {
    var pieces = [];
    message.nodes.forEach(function (node) { return node.visit(serializerVisitor, pieces); });
    return processMessagePieces(pieces);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxpemVfdXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2kxOG4vbG9jYWxpemVfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQVFBLE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDbEQsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzNDLE9BQU8sRUFBQyx5QkFBeUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUVqRCxNQUFNLFVBQVUsd0JBQXdCLENBQ3BDLFFBQXVCLEVBQUUsT0FBcUIsRUFDOUMsTUFBc0M7SUFDeEMsSUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO0lBRWhCLElBQUEsNkNBQXVFLEVBQXRFLDhCQUFZLEVBQUUsOEJBQXdELENBQUM7SUFDOUUsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQ3BFLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQ3hELFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBQSxFQUFFLElBQUksT0FBQSxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQVYsQ0FBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUzQyxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQ7SUFDRSxzQkFBbUIsSUFBWTtRQUFaLFNBQUksR0FBSixJQUFJLENBQVE7SUFBRyxDQUFDO0lBQ3JDLG1CQUFDO0FBQUQsQ0FBQyxBQUZELElBRUM7QUFDRDtJQUEyQixnQ0FBWTtJQUF2Qzs7SUFBeUMsQ0FBQztJQUFELG1CQUFD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QXNCO0lBRWxELElBQU0sWUFBWSxHQUFhLEVBQUUsQ0FBQztJQUNsQyxJQUFNLFlBQVksR0FBYSxFQUFFLENBQUM7SUFFbEMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLFlBQVksZ0JBQWdCLEVBQUU7UUFDekMscUZBQXFGO1FBQ3JGLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDdkI7SUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN0QyxJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkIsSUFBSSxJQUFJLFlBQVksWUFBWSxFQUFFO1lBQ2hDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzlCO2FBQU07WUFDTCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3QixJQUFJLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksZ0JBQWdCLEVBQUU7Z0JBQzdDLGlGQUFpRjtnQkFDakYsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUN2QjtTQUNGO0tBQ0Y7SUFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxZQUFZLGdCQUFnQixFQUFFO1FBQ3pELGlGQUFpRjtRQUNqRixZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ3ZCO0lBQ0QsT0FBTyxFQUFDLFlBQVksY0FBQSxFQUFFLFlBQVksY0FBQSxFQUFDLENBQUM7QUFDdEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtzZXJpYWxpemVJY3VOb2RlfSBmcm9tICcuL2ljdV9zZXJpYWxpemVyJztcbmltcG9ydCB7bWV0YUZyb21JMThuTWVzc2FnZX0gZnJvbSAnLi9tZXRhJztcbmltcG9ydCB7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2FsaXplU3RhdGVtZW50cyhcbiAgICB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgbWVzc2FnZTogaTE4bi5NZXNzYWdlLFxuICAgIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHMgPSBbXTtcblxuICBjb25zdCB7bWVzc2FnZVBhcnRzLCBwbGFjZUhvbGRlcnN9ID0gc2VyaWFsaXplSTE4bk1lc3NhZ2VGb3JMb2NhbGl6ZShtZXNzYWdlKTtcbiAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGUuc2V0KG8ubG9jYWxpemVkU3RyaW5nKFxuICAgICAgbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlKSwgbWVzc2FnZVBhcnRzLCBwbGFjZUhvbGRlcnMsXG4gICAgICBwbGFjZUhvbGRlcnMubWFwKHBoID0+IHBhcmFtc1twaF0pKSkpKTtcblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cblxuY2xhc3MgTWVzc2FnZVBpZWNlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHRleHQ6IHN0cmluZykge31cbn1cbmNsYXNzIExpdGVyYWxQaWVjZSBleHRlbmRzIE1lc3NhZ2VQaWVjZSB7fVxuY2xhc3MgUGxhY2Vob2xkZXJQaWVjZSBleHRlbmRzIE1lc3NhZ2VQaWVjZSB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykgeyBzdXBlcihmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lKG5hbWUsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpOyB9XG59XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIHdhbGtzIG92ZXIgYW4gaTE4biB0cmVlLCBjYXB0dXJpbmcgbGl0ZXJhbCBzdHJpbmdzIGFuZCBwbGFjZWhvbGRlcnMuXG4gKlxuICogVGhlIHJlc3VsdCBjYW4gYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgYCRsb2NhbGl6ZWAgdGFnZ2VkIHRlbXBsYXRlIGxpdGVyYWxzLlxuICovXG5jbGFzcyBMb2NhbGl6ZVNlcmlhbGl6ZXJWaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dDogTWVzc2FnZVBpZWNlW10pOiBhbnkge1xuICAgIGlmIChjb250ZXh0W2NvbnRleHQubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBMaXRlcmFsUGllY2UpIHtcbiAgICAgIC8vIFR3byBsaXRlcmFsIHBpZWNlcyBpbiBhIHJvdyBtZWFucyB0aGF0IHRoZXJlIHdhcyBzb21lIGNvbW1lbnQgbm9kZSBpbi1iZXR3ZWVuLlxuICAgICAgY29udGV4dFtjb250ZXh0Lmxlbmd0aCAtIDFdLnRleHQgKz0gdGV4dC52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5wdXNoKG5ldyBMaXRlcmFsUGllY2UodGV4dC52YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0Q29udGFpbmVyKGNvbnRhaW5lcjogaTE4bi5Db250YWluZXIsIGNvbnRleHQ6IE1lc3NhZ2VQaWVjZVtdKTogYW55IHtcbiAgICBjb250YWluZXIuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IGkxOG4uSWN1LCBjb250ZXh0OiBNZXNzYWdlUGllY2VbXSk6IGFueSB7XG4gICAgY29udGV4dC5wdXNoKG5ldyBMaXRlcmFsUGllY2Uoc2VyaWFsaXplSWN1Tm9kZShpY3UpKSk7XG4gIH1cblxuICB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBoOiBpMThuLlRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0OiBNZXNzYWdlUGllY2VbXSk6IGFueSB7XG4gICAgY29udGV4dC5wdXNoKG5ldyBQbGFjZWhvbGRlclBpZWNlKHBoLnN0YXJ0TmFtZSkpO1xuICAgIGlmICghcGguaXNWb2lkKSB7XG4gICAgICBwaC5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICAgIGNvbnRleHQucHVzaChuZXcgUGxhY2Vob2xkZXJQaWVjZShwaC5jbG9zZU5hbWUpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFBsYWNlaG9sZGVyKHBoOiBpMThuLlBsYWNlaG9sZGVyLCBjb250ZXh0OiBNZXNzYWdlUGllY2VbXSk6IGFueSB7XG4gICAgY29udGV4dC5wdXNoKG5ldyBQbGFjZWhvbGRlclBpZWNlKHBoLm5hbWUpKTtcbiAgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIGNvbnRleHQucHVzaChuZXcgUGxhY2Vob2xkZXJQaWVjZShwaC5uYW1lKSk7XG4gIH1cbn1cblxuY29uc3Qgc2VyaWFsaXplclZpc2l0b3IgPSBuZXcgTG9jYWxpemVTZXJpYWxpemVyVmlzaXRvcigpO1xuXG4vKipcbiAqIFNlcmlhbGl6ZSBhbiBpMThuIG1lc3NhZ2UgaW50byB0d28gYXJyYXlzOiBtZXNzYWdlUGFydHMgYW5kIHBsYWNlaG9sZGVycy5cbiAqXG4gKiBUaGVzZSBhcnJheXMgd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGAkbG9jYWxpemVgIHRhZ2dlZCB0ZW1wbGF0ZSBsaXRlcmFscy5cbiAqXG4gKiBAcGFyYW0gbWVzc2FnZSBUaGUgbWVzc2FnZSB0byBiZSBzZXJpYWxpemVkLlxuICogQHJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG1lc3NhZ2VQYXJ0cyBhbmQgcGxhY2Vob2xkZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4bk1lc3NhZ2VGb3JMb2NhbGl6ZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOlxuICAgIHttZXNzYWdlUGFydHM6IHN0cmluZ1tdLCBwbGFjZUhvbGRlcnM6IHN0cmluZ1tdfSB7XG4gIGNvbnN0IHBpZWNlczogTWVzc2FnZVBpZWNlW10gPSBbXTtcbiAgbWVzc2FnZS5ub2Rlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdChzZXJpYWxpemVyVmlzaXRvciwgcGllY2VzKSk7XG4gIHJldHVybiBwcm9jZXNzTWVzc2FnZVBpZWNlcyhwaWVjZXMpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgdGhlIGxpc3Qgb2Ygc2VyaWFsaXplZCBNZXNzYWdlUGllY2VzIGludG8gdHdvIGFycmF5cy5cbiAqXG4gKiBPbmUgY29udGFpbnMgdGhlIGxpdGVyYWwgc3RyaW5nIHBpZWNlcyBhbmQgdGhlIG90aGVyIHRoZSBwbGFjZWhvbGRlcnMgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIGJ5XG4gKiBleHByZXNzaW9ucyB3aGVuIHJlbmRlcmluZyBgJGxvY2FsaXplYCB0YWdnZWQgdGVtcGxhdGUgbGl0ZXJhbHMuXG4gKlxuICogQHBhcmFtIHBpZWNlcyBUaGUgcGllY2VzIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgbWVzc2FnZVBhcnRzIGFuZCBwbGFjZWhvbGRlcnMuXG4gKi9cbmZ1bmN0aW9uIHByb2Nlc3NNZXNzYWdlUGllY2VzKHBpZWNlczogTWVzc2FnZVBpZWNlW10pOlxuICAgIHttZXNzYWdlUGFydHM6IHN0cmluZ1tdLCBwbGFjZUhvbGRlcnM6IHN0cmluZ1tdfSB7XG4gIGNvbnN0IG1lc3NhZ2VQYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGxhY2VIb2xkZXJzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGlmIChwaWVjZXNbMF0gaW5zdGFuY2VvZiBQbGFjZWhvbGRlclBpZWNlKSB7XG4gICAgLy8gVGhlIGZpcnN0IHBpZWNlIHdhcyBhIHBsYWNlaG9sZGVyIHNvIHdlIG5lZWQgdG8gYWRkIGFuIGluaXRpYWwgZW1wdHkgbWVzc2FnZSBwYXJ0LlxuICAgIG1lc3NhZ2VQYXJ0cy5wdXNoKCcnKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGllY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcGFydCA9IHBpZWNlc1tpXTtcbiAgICBpZiAocGFydCBpbnN0YW5jZW9mIExpdGVyYWxQaWVjZSkge1xuICAgICAgbWVzc2FnZVBhcnRzLnB1c2gocGFydC50ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGxhY2VIb2xkZXJzLnB1c2gocGFydC50ZXh0KTtcbiAgICAgIGlmIChwaWVjZXNbaSAtIDFdIGluc3RhbmNlb2YgUGxhY2Vob2xkZXJQaWVjZSkge1xuICAgICAgICAvLyBUaGVyZSB3ZXJlIHR3byBwbGFjZWhvbGRlcnMgaW4gYSByb3csIHNvIHdlIG5lZWQgdG8gYWRkIGFuIGVtcHR5IG1lc3NhZ2UgcGFydC5cbiAgICAgICAgbWVzc2FnZVBhcnRzLnB1c2goJycpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAocGllY2VzW3BpZWNlcy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyUGllY2UpIHtcbiAgICAvLyBUaGUgbGFzdCBwaWVjZSB3YXMgYSBwbGFjZWhvbGRlciBzbyB3ZSBuZWVkIHRvIGFkZCBhIGZpbmFsIGVtcHR5IG1lc3NhZ2UgcGFydC5cbiAgICBtZXNzYWdlUGFydHMucHVzaCgnJyk7XG4gIH1cbiAgcmV0dXJuIHttZXNzYWdlUGFydHMsIHBsYWNlSG9sZGVyc307XG59XG4iXX0=