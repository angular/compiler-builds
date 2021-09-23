/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/render3/view/i18n/icu_serializer", ["require", "exports", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serializeIcuNode = void 0;
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    var IcuSerializerVisitor = /** @class */ (function () {
        function IcuSerializerVisitor() {
        }
        IcuSerializerVisitor.prototype.visitText = function (text) {
            return text.value;
        };
        IcuSerializerVisitor.prototype.visitContainer = function (container) {
            var _this = this;
            return container.children.map(function (child) { return child.visit(_this); }).join('');
        };
        IcuSerializerVisitor.prototype.visitIcu = function (icu) {
            var _this = this;
            var strCases = Object.keys(icu.cases).map(function (k) { return k + " {" + icu.cases[k].visit(_this) + "}"; });
            var result = "{" + icu.expressionPlaceholder + ", " + icu.type + ", " + strCases.join(' ') + "}";
            return result;
        };
        IcuSerializerVisitor.prototype.visitTagPlaceholder = function (ph) {
            var _this = this;
            return ph.isVoid ?
                this.formatPh(ph.startName) :
                "" + this.formatPh(ph.startName) + ph.children.map(function (child) { return child.visit(_this); }).join('') + this.formatPh(ph.closeName);
        };
        IcuSerializerVisitor.prototype.visitPlaceholder = function (ph) {
            return this.formatPh(ph.name);
        };
        IcuSerializerVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            return this.formatPh(ph.name);
        };
        IcuSerializerVisitor.prototype.formatPh = function (value) {
            return "{" + (0, util_1.formatI18nPlaceholderName)(value, /* useCamelCase */ false) + "}";
        };
        return IcuSerializerVisitor;
    }());
    var serializer = new IcuSerializerVisitor();
    function serializeIcuNode(icu) {
        return icu.visit(serializer);
    }
    exports.serializeIcuNode = serializeIcuNode;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWN1X3NlcmlhbGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2kxOG4vaWN1X3NlcmlhbGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBSUgscUVBQWlEO0lBRWpEO1FBQUE7UUFrQ0EsQ0FBQztRQWpDQyx3Q0FBUyxHQUFULFVBQVUsSUFBZTtZQUN2QixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDcEIsQ0FBQztRQUVELDZDQUFjLEdBQWQsVUFBZSxTQUF5QjtZQUF4QyxpQkFFQztZQURDLE9BQU8sU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFqQixDQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCx1Q0FBUSxHQUFSLFVBQVMsR0FBYTtZQUF0QixpQkFLQztZQUpDLElBQU0sUUFBUSxHQUNWLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQVMsSUFBSyxPQUFHLENBQUMsVUFBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsTUFBRyxFQUFwQyxDQUFvQyxDQUFDLENBQUM7WUFDcEYsSUFBTSxNQUFNLEdBQUcsTUFBSSxHQUFHLENBQUMscUJBQXFCLFVBQUssR0FBRyxDQUFDLElBQUksVUFBSyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFHLENBQUM7WUFDcEYsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELGtEQUFtQixHQUFuQixVQUFvQixFQUF1QjtZQUEzQyxpQkFLQztZQUpDLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNkLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLEtBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFqQixDQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUNqRixJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUcsQ0FBQztRQUN4QyxDQUFDO1FBRUQsK0NBQWdCLEdBQWhCLFVBQWlCLEVBQW9CO1lBQ25DLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUVELGtEQUFtQixHQUFuQixVQUFvQixFQUF1QixFQUFFLE9BQWE7WUFDeEQsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBRU8sdUNBQVEsR0FBaEIsVUFBaUIsS0FBYTtZQUM1QixPQUFPLE1BQUksSUFBQSxnQ0FBeUIsRUFBQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE1BQUcsQ0FBQztRQUMzRSxDQUFDO1FBQ0gsMkJBQUM7SUFBRCxDQUFDLEFBbENELElBa0NDO0lBRUQsSUFBTSxVQUFVLEdBQUcsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO0lBQzlDLFNBQWdCLGdCQUFnQixDQUFDLEdBQWE7UUFDNUMsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFGRCw0Q0FFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuXG5pbXBvcnQge2Zvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWV9IGZyb20gJy4vdXRpbCc7XG5cbmNsYXNzIEljdVNlcmlhbGl6ZXJWaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRleHQudmFsdWU7XG4gIH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyKTogYW55IHtcbiAgICByZXR1cm4gY29udGFpbmVyLmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSkuam9pbignJyk7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IGkxOG4uSWN1KTogYW55IHtcbiAgICBjb25zdCBzdHJDYXNlcyA9XG4gICAgICAgIE9iamVjdC5rZXlzKGljdS5jYXNlcykubWFwKChrOiBzdHJpbmcpID0+IGAke2t9IHske2ljdS5jYXNlc1trXS52aXNpdCh0aGlzKX19YCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYHske2ljdS5leHByZXNzaW9uUGxhY2Vob2xkZXJ9LCAke2ljdS50eXBlfSwgJHtzdHJDYXNlcy5qb2luKCcgJyl9fWA7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIpOiBhbnkge1xuICAgIHJldHVybiBwaC5pc1ZvaWQgP1xuICAgICAgICB0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSkgOlxuICAgICAgICBgJHt0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSl9JHtwaC5jaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpLmpvaW4oJycpfSR7XG4gICAgICAgICAgICB0aGlzLmZvcm1hdFBoKHBoLmNsb3NlTmFtZSl9YDtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmZvcm1hdFBoKHBoLm5hbWUpO1xuICB9XG5cbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogaTE4bi5JY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuZm9ybWF0UGgocGgubmFtZSk7XG4gIH1cblxuICBwcml2YXRlIGZvcm1hdFBoKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgeyR7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZSh2YWx1ZSwgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKX19YDtcbiAgfVxufVxuXG5jb25zdCBzZXJpYWxpemVyID0gbmV3IEljdVNlcmlhbGl6ZXJWaXNpdG9yKCk7XG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSWN1Tm9kZShpY3U6IGkxOG4uSWN1KTogc3RyaW5nIHtcbiAgcmV0dXJuIGljdS52aXNpdChzZXJpYWxpemVyKTtcbn1cbiJdfQ==