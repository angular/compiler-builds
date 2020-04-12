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
        define("@angular/compiler/src/render3/view/i18n/icu_serializer", ["require", "exports", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    var IcuSerializerVisitor = /** @class */ (function () {
        function IcuSerializerVisitor() {
        }
        IcuSerializerVisitor.prototype.visitText = function (text) { return text.value; };
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
        IcuSerializerVisitor.prototype.visitPlaceholder = function (ph) { return this.formatPh(ph.name); };
        IcuSerializerVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            return this.formatPh(ph.name);
        };
        IcuSerializerVisitor.prototype.formatPh = function (value) {
            return "{" + util_1.formatI18nPlaceholderName(value, /* useCamelCase */ false) + "}";
        };
        return IcuSerializerVisitor;
    }());
    var serializer = new IcuSerializerVisitor();
    function serializeIcuNode(icu) {
        return icu.visit(serializer);
    }
    exports.serializeIcuNode = serializeIcuNode;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWN1X3NlcmlhbGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2kxOG4vaWN1X3NlcmlhbGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFJSCxxRUFBaUQ7SUFFakQ7UUFBQTtRQThCQSxDQUFDO1FBN0JDLHdDQUFTLEdBQVQsVUFBVSxJQUFlLElBQVMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUV0RCw2Q0FBYyxHQUFkLFVBQWUsU0FBeUI7WUFBeEMsaUJBRUM7WUFEQyxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBRUQsdUNBQVEsR0FBUixVQUFTLEdBQWE7WUFBdEIsaUJBS0M7WUFKQyxJQUFNLFFBQVEsR0FDVixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFTLElBQUssT0FBRyxDQUFDLFVBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLE1BQUcsRUFBcEMsQ0FBb0MsQ0FBQyxDQUFDO1lBQ3BGLElBQU0sTUFBTSxHQUFHLE1BQUksR0FBRyxDQUFDLHFCQUFxQixVQUFLLEdBQUcsQ0FBQyxJQUFJLFVBQUssUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBRyxDQUFDO1lBQ3BGLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxrREFBbUIsR0FBbkIsVUFBb0IsRUFBdUI7WUFBM0MsaUJBS0M7WUFKQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDZCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixLQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FDakYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFHLENBQUM7UUFDeEMsQ0FBQztRQUVELCtDQUFnQixHQUFoQixVQUFpQixFQUFvQixJQUFTLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlFLGtEQUFtQixHQUFuQixVQUFvQixFQUF1QixFQUFFLE9BQWE7WUFDeEQsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBRU8sdUNBQVEsR0FBaEIsVUFBaUIsS0FBYTtZQUM1QixPQUFPLE1BQUksZ0NBQXlCLENBQUMsS0FBSyxFQUFFLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxNQUFHLENBQUM7UUFDM0UsQ0FBQztRQUNILDJCQUFDO0lBQUQsQ0FBQyxBQTlCRCxJQThCQztJQUVELElBQU0sVUFBVSxHQUFHLElBQUksb0JBQW9CLEVBQUUsQ0FBQztJQUM5QyxTQUFnQixnQkFBZ0IsQ0FBQyxHQUFhO1FBQzVDLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRkQsNENBRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5cbmltcG9ydCB7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZX0gZnJvbSAnLi91dGlsJztcblxuY2xhc3MgSWN1U2VyaWFsaXplclZpc2l0b3IgaW1wbGVtZW50cyBpMThuLlZpc2l0b3Ige1xuICB2aXNpdFRleHQodGV4dDogaTE4bi5UZXh0KTogYW55IHsgcmV0dXJuIHRleHQudmFsdWU7IH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyKTogYW55IHtcbiAgICByZXR1cm4gY29udGFpbmVyLmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSkuam9pbignJyk7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IGkxOG4uSWN1KTogYW55IHtcbiAgICBjb25zdCBzdHJDYXNlcyA9XG4gICAgICAgIE9iamVjdC5rZXlzKGljdS5jYXNlcykubWFwKChrOiBzdHJpbmcpID0+IGAke2t9IHske2ljdS5jYXNlc1trXS52aXNpdCh0aGlzKX19YCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYHske2ljdS5leHByZXNzaW9uUGxhY2Vob2xkZXJ9LCAke2ljdS50eXBlfSwgJHtzdHJDYXNlcy5qb2luKCcgJyl9fWA7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIpOiBhbnkge1xuICAgIHJldHVybiBwaC5pc1ZvaWQgP1xuICAgICAgICB0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSkgOlxuICAgICAgICBgJHt0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSl9JHtwaC5jaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpLmpvaW4oJycpfSR7XG4gICAgICAgICAgICB0aGlzLmZvcm1hdFBoKHBoLmNsb3NlTmFtZSl9YDtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIpOiBhbnkgeyByZXR1cm4gdGhpcy5mb3JtYXRQaChwaC5uYW1lKTsgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmZvcm1hdFBoKHBoLm5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBmb3JtYXRQaCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYHske2Zvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWUodmFsdWUsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSl9fWA7XG4gIH1cbn1cblxuY29uc3Qgc2VyaWFsaXplciA9IG5ldyBJY3VTZXJpYWxpemVyVmlzaXRvcigpO1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUljdU5vZGUoaWN1OiBpMThuLkljdSk6IHN0cmluZyB7XG4gIHJldHVybiBpY3UudmlzaXQoc2VyaWFsaXplcik7XG59XG4iXX0=