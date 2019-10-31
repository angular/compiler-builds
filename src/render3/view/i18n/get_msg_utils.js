(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/i18n/get_msg_utils", ["require", "exports", "@angular/compiler/src/output/map_util", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/view/i18n/icu_serializer", "@angular/compiler/src/render3/view/i18n/meta", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var map_util_1 = require("@angular/compiler/src/output/map_util");
    var o = require("@angular/compiler/src/output/output_ast");
    var icu_serializer_1 = require("@angular/compiler/src/render3/view/i18n/icu_serializer");
    var meta_1 = require("@angular/compiler/src/render3/view/i18n/meta");
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    /** Closure uses `goog.getMsg(message)` to lookup translations */
    var GOOG_GET_MSG = 'goog.getMsg';
    function createGoogleGetMsgStatements(variable, message, closureVar, params) {
        var messageString = serializeI18nMessageForGetMsg(message);
        var args = [o.literal(messageString)];
        if (Object.keys(params).length) {
            args.push(map_util_1.mapLiteral(params, true));
        }
        // /**
        //  * @desc description of message
        //  * @meaning meaning of message
        //  */
        // const MSG_... = goog.getMsg(..);
        // I18N_X = MSG_...;
        var statements = [];
        var jsdocComment = meta_1.i18nMetaToDocStmt(meta_1.metaFromI18nMessage(message));
        if (jsdocComment !== null) {
            statements.push(jsdocComment);
        }
        statements.push(closureVar.set(o.variable(GOOG_GET_MSG).callFn(args)).toConstDecl());
        statements.push(new o.ExpressionStatement(variable.set(closureVar)));
        return statements;
    }
    exports.createGoogleGetMsgStatements = createGoogleGetMsgStatements;
    /**
     * This visitor walks over i18n tree and generates its string representation, including ICUs and
     * placeholders in `{$placeholder}` (for plain messages) or `{PLACEHOLDER}` (inside ICUs) format.
     */
    var GetMsgSerializerVisitor = /** @class */ (function () {
        function GetMsgSerializerVisitor() {
        }
        GetMsgSerializerVisitor.prototype.formatPh = function (value) { return "{$" + util_1.formatI18nPlaceholderName(value) + "}"; };
        GetMsgSerializerVisitor.prototype.visitText = function (text) { return text.value; };
        GetMsgSerializerVisitor.prototype.visitContainer = function (container) {
            var _this = this;
            return container.children.map(function (child) { return child.visit(_this); }).join('');
        };
        GetMsgSerializerVisitor.prototype.visitIcu = function (icu) { return icu_serializer_1.serializeIcuNode(icu); };
        GetMsgSerializerVisitor.prototype.visitTagPlaceholder = function (ph) {
            var _this = this;
            return ph.isVoid ?
                this.formatPh(ph.startName) :
                "" + this.formatPh(ph.startName) + ph.children.map(function (child) { return child.visit(_this); }).join('') + this.formatPh(ph.closeName);
        };
        GetMsgSerializerVisitor.prototype.visitPlaceholder = function (ph) { return this.formatPh(ph.name); };
        GetMsgSerializerVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            return this.formatPh(ph.name);
        };
        return GetMsgSerializerVisitor;
    }());
    var serializerVisitor = new GetMsgSerializerVisitor();
    function serializeI18nMessageForGetMsg(message) {
        return message.nodes.map(function (node) { return node.visit(serializerVisitor, null); }).join('');
    }
    exports.serializeI18nMessageForGetMsg = serializeI18nMessageForGetMsg;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0X21zZ191dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9nZXRfbXNnX3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0lBUUEsa0VBQW9EO0lBQ3BELDJEQUFnRDtJQUVoRCx5RkFBa0Q7SUFDbEQscUVBQThEO0lBQzlELHFFQUFpRDtJQUVqRCxpRUFBaUU7SUFDakUsSUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDO0lBRW5DLFNBQWdCLDRCQUE0QixDQUN4QyxRQUF1QixFQUFFLE9BQXFCLEVBQUUsVUFBeUIsRUFDekUsTUFBc0M7UUFDeEMsSUFBTSxhQUFhLEdBQUcsNkJBQTZCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0QsSUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBaUIsQ0FBQyxDQUFDO1FBQ3hELElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUU7WUFDOUIsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ3JDO1FBRUQsTUFBTTtRQUNOLGtDQUFrQztRQUNsQyxpQ0FBaUM7UUFDakMsTUFBTTtRQUNOLG1DQUFtQztRQUNuQyxvQkFBb0I7UUFDcEIsSUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQU0sWUFBWSxHQUFHLHdCQUFpQixDQUFDLDBCQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDckUsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFO1lBQ3pCLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDL0I7UUFDRCxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFckUsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQXhCRCxvRUF3QkM7SUFFRDs7O09BR0c7SUFDSDtRQUFBO1FBc0JBLENBQUM7UUFyQlMsMENBQVEsR0FBaEIsVUFBaUIsS0FBYSxJQUFZLE9BQU8sT0FBSyxnQ0FBeUIsQ0FBQyxLQUFLLENBQUMsTUFBRyxDQUFDLENBQUMsQ0FBQztRQUU1RiwyQ0FBUyxHQUFULFVBQVUsSUFBZSxJQUFTLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFdEQsZ0RBQWMsR0FBZCxVQUFlLFNBQXlCO1lBQXhDLGlCQUVDO1lBREMsT0FBTyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWpCLENBQWlCLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUVELDBDQUFRLEdBQVIsVUFBUyxHQUFhLElBQVMsT0FBTyxpQ0FBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFOUQscURBQW1CLEdBQW5CLFVBQW9CLEVBQXVCO1lBQTNDLGlCQUlDO1lBSEMsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsS0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWpCLENBQWlCLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFHLENBQUM7UUFDNUgsQ0FBQztRQUVELGtEQUFnQixHQUFoQixVQUFpQixFQUFvQixJQUFTLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlFLHFEQUFtQixHQUFuQixVQUFvQixFQUF1QixFQUFFLE9BQWE7WUFDeEQsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBQ0gsOEJBQUM7SUFBRCxDQUFDLEFBdEJELElBc0JDO0lBRUQsSUFBTSxpQkFBaUIsR0FBRyxJQUFJLHVCQUF1QixFQUFFLENBQUM7SUFFeEQsU0FBZ0IsNkJBQTZCLENBQUMsT0FBcUI7UUFDakUsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEVBQW5DLENBQW1DLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUZELHNFQUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge3NlcmlhbGl6ZUljdU5vZGV9IGZyb20gJy4vaWN1X3NlcmlhbGl6ZXInO1xuaW1wb3J0IHtpMThuTWV0YVRvRG9jU3RtdCwgbWV0YUZyb21JMThuTWVzc2FnZX0gZnJvbSAnLi9tZXRhJztcbmltcG9ydCB7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZX0gZnJvbSAnLi91dGlsJztcblxuLyoqIENsb3N1cmUgdXNlcyBgZ29vZy5nZXRNc2cobWVzc2FnZSlgIHRvIGxvb2t1cCB0cmFuc2xhdGlvbnMgKi9cbmNvbnN0IEdPT0dfR0VUX01TRyA9ICdnb29nLmdldE1zZyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzKFxuICAgIHZhcmlhYmxlOiBvLlJlYWRWYXJFeHByLCBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIGNsb3N1cmVWYXI6IG8uUmVhZFZhckV4cHIsXG4gICAgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3QgbWVzc2FnZVN0cmluZyA9IHNlcmlhbGl6ZUkxOG5NZXNzYWdlRm9yR2V0TXNnKG1lc3NhZ2UpO1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChtZXNzYWdlU3RyaW5nKSBhcyBvLkV4cHJlc3Npb25dO1xuICBpZiAoT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGgpIHtcbiAgICBhcmdzLnB1c2gobWFwTGl0ZXJhbChwYXJhbXMsIHRydWUpKTtcbiAgfVxuXG4gIC8vIC8qKlxuICAvLyAgKiBAZGVzYyBkZXNjcmlwdGlvbiBvZiBtZXNzYWdlXG4gIC8vICAqIEBtZWFuaW5nIG1lYW5pbmcgb2YgbWVzc2FnZVxuICAvLyAgKi9cbiAgLy8gY29uc3QgTVNHXy4uLiA9IGdvb2cuZ2V0TXNnKC4uKTtcbiAgLy8gSTE4Tl9YID0gTVNHXy4uLjtcbiAgY29uc3Qgc3RhdGVtZW50cyA9IFtdO1xuICBjb25zdCBqc2RvY0NvbW1lbnQgPSBpMThuTWV0YVRvRG9jU3RtdChtZXRhRnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpKTtcbiAgaWYgKGpzZG9jQ29tbWVudCAhPT0gbnVsbCkge1xuICAgIHN0YXRlbWVudHMucHVzaChqc2RvY0NvbW1lbnQpO1xuICB9XG4gIHN0YXRlbWVudHMucHVzaChjbG9zdXJlVmFyLnNldChvLnZhcmlhYmxlKEdPT0dfR0VUX01TRykuY2FsbEZuKGFyZ3MpKS50b0NvbnN0RGVjbCgpKTtcbiAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGUuc2V0KGNsb3N1cmVWYXIpKSk7XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIHdhbGtzIG92ZXIgaTE4biB0cmVlIGFuZCBnZW5lcmF0ZXMgaXRzIHN0cmluZyByZXByZXNlbnRhdGlvbiwgaW5jbHVkaW5nIElDVXMgYW5kXG4gKiBwbGFjZWhvbGRlcnMgaW4gYHskcGxhY2Vob2xkZXJ9YCAoZm9yIHBsYWluIG1lc3NhZ2VzKSBvciBge1BMQUNFSE9MREVSfWAgKGluc2lkZSBJQ1VzKSBmb3JtYXQuXG4gKi9cbmNsYXNzIEdldE1zZ1NlcmlhbGl6ZXJWaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgcHJpdmF0ZSBmb3JtYXRQaCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHsgcmV0dXJuIGB7JCR7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZSh2YWx1ZSl9fWA7IH1cblxuICB2aXNpdFRleHQodGV4dDogaTE4bi5UZXh0KTogYW55IHsgcmV0dXJuIHRleHQudmFsdWU7IH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyKTogYW55IHtcbiAgICByZXR1cm4gY29udGFpbmVyLmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSkuam9pbignJyk7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IGkxOG4uSWN1KTogYW55IHsgcmV0dXJuIHNlcmlhbGl6ZUljdU5vZGUoaWN1KTsgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIpOiBhbnkge1xuICAgIHJldHVybiBwaC5pc1ZvaWQgP1xuICAgICAgICB0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSkgOlxuICAgICAgICBgJHt0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSl9JHtwaC5jaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpLmpvaW4oJycpfSR7dGhpcy5mb3JtYXRQaChwaC5jbG9zZU5hbWUpfWA7XG4gIH1cblxuICB2aXNpdFBsYWNlaG9sZGVyKHBoOiBpMThuLlBsYWNlaG9sZGVyKTogYW55IHsgcmV0dXJuIHRoaXMuZm9ybWF0UGgocGgubmFtZSk7IH1cblxuICB2aXNpdEljdVBsYWNlaG9sZGVyKHBoOiBpMThuLkljdVBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5mb3JtYXRQaChwaC5uYW1lKTtcbiAgfVxufVxuXG5jb25zdCBzZXJpYWxpemVyVmlzaXRvciA9IG5ldyBHZXRNc2dTZXJpYWxpemVyVmlzaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4bk1lc3NhZ2VGb3JHZXRNc2cobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogc3RyaW5nIHtcbiAgcmV0dXJuIG1lc3NhZ2Uubm9kZXMubWFwKG5vZGUgPT4gbm9kZS52aXNpdChzZXJpYWxpemVyVmlzaXRvciwgbnVsbCkpLmpvaW4oJycpO1xufVxuIl19