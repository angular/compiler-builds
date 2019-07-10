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
        define("@angular/compiler/src/render3/view/i18n/serializer", ["require", "exports", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    /**
     * This visitor walks over i18n tree and generates its string representation, including ICUs and
     * placeholders in `{$placeholder}` (for plain messages) or `{PLACEHOLDER}` (inside ICUs) format.
     */
    var SerializerVisitor = /** @class */ (function () {
        function SerializerVisitor() {
            /**
             * Flag that indicates that we are processing elements of an ICU.
             *
             * This flag is needed due to the fact that placeholders in ICUs and in other messages are
             * represented differently in Closure:
             * - {$placeholder} in non-ICU case
             * - {PLACEHOLDER} inside ICU
             */
            this.insideIcu = false;
        }
        SerializerVisitor.prototype.formatPh = function (value) {
            var formatted = util_1.formatI18nPlaceholderName(value, /* useCamelCase */ !this.insideIcu);
            return this.insideIcu ? "{" + formatted + "}" : "{$" + formatted + "}";
        };
        SerializerVisitor.prototype.visitText = function (text, context) { return text.value; };
        SerializerVisitor.prototype.visitContainer = function (container, context) {
            var _this = this;
            return container.children.map(function (child) { return child.visit(_this); }).join('');
        };
        SerializerVisitor.prototype.visitIcu = function (icu, context) {
            var _this = this;
            this.insideIcu = true;
            var strCases = Object.keys(icu.cases).map(function (k) { return k + " {" + icu.cases[k].visit(_this) + "}"; });
            var result = "{" + icu.expressionPlaceholder + ", " + icu.type + ", " + strCases.join(' ') + "}";
            this.insideIcu = false;
            return result;
        };
        SerializerVisitor.prototype.visitTagPlaceholder = function (ph, context) {
            var _this = this;
            return ph.isVoid ?
                this.formatPh(ph.startName) :
                "" + this.formatPh(ph.startName) + ph.children.map(function (child) { return child.visit(_this); }).join('') + this.formatPh(ph.closeName);
        };
        SerializerVisitor.prototype.visitPlaceholder = function (ph, context) { return this.formatPh(ph.name); };
        SerializerVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            return this.formatPh(ph.name);
        };
        return SerializerVisitor;
    }());
    var serializerVisitor = new SerializerVisitor();
    function getSerializedI18nContent(message) {
        return message.nodes.map(function (node) { return node.visit(serializerVisitor, null); }).join('');
    }
    exports.getSerializedI18nContent = getSerializedI18nContent;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9zZXJpYWxpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBSUgscUVBQWlEO0lBRWpEOzs7T0FHRztJQUNIO1FBQUE7WUFDRTs7Ozs7OztlQU9HO1lBQ0ssY0FBUyxHQUFHLEtBQUssQ0FBQztRQWlDNUIsQ0FBQztRQS9CUyxvQ0FBUSxHQUFoQixVQUFpQixLQUFhO1lBQzVCLElBQU0sU0FBUyxHQUFHLGdDQUF5QixDQUFDLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN2RixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQUksU0FBUyxNQUFHLENBQUMsQ0FBQyxDQUFDLE9BQUssU0FBUyxNQUFHLENBQUM7UUFDL0QsQ0FBQztRQUVELHFDQUFTLEdBQVQsVUFBVSxJQUFlLEVBQUUsT0FBWSxJQUFTLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFcEUsMENBQWMsR0FBZCxVQUFlLFNBQXlCLEVBQUUsT0FBWTtZQUF0RCxpQkFFQztZQURDLE9BQU8sU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFqQixDQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxvQ0FBUSxHQUFSLFVBQVMsR0FBYSxFQUFFLE9BQVk7WUFBcEMsaUJBT0M7WUFOQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUN0QixJQUFNLFFBQVEsR0FDVixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFTLElBQUssT0FBRyxDQUFDLFVBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLE1BQUcsRUFBcEMsQ0FBb0MsQ0FBQyxDQUFDO1lBQ3BGLElBQU0sTUFBTSxHQUFHLE1BQUksR0FBRyxDQUFDLHFCQUFxQixVQUFLLEdBQUcsQ0FBQyxJQUFJLFVBQUssUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBRyxDQUFDO1lBQ3BGLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCwrQ0FBbUIsR0FBbkIsVUFBb0IsRUFBdUIsRUFBRSxPQUFZO1lBQXpELGlCQUlDO1lBSEMsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsS0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWpCLENBQWlCLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFHLENBQUM7UUFDNUgsQ0FBQztRQUVELDRDQUFnQixHQUFoQixVQUFpQixFQUFvQixFQUFFLE9BQVksSUFBUyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1RiwrQ0FBbUIsR0FBbkIsVUFBb0IsRUFBdUIsRUFBRSxPQUFhO1lBQ3hELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUNILHdCQUFDO0lBQUQsQ0FBQyxBQTFDRCxJQTBDQztJQUVELElBQU0saUJBQWlCLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO0lBRWxELFNBQWdCLHdCQUF3QixDQUFDLE9BQXFCO1FBQzVELE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxFQUFuQyxDQUFtQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFGRCw0REFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcblxuaW1wb3J0IHtmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIGkxOG4gdHJlZSBhbmQgZ2VuZXJhdGVzIGl0cyBzdHJpbmcgcmVwcmVzZW50YXRpb24sIGluY2x1ZGluZyBJQ1VzIGFuZFxuICogcGxhY2Vob2xkZXJzIGluIGB7JHBsYWNlaG9sZGVyfWAgKGZvciBwbGFpbiBtZXNzYWdlcykgb3IgYHtQTEFDRUhPTERFUn1gIChpbnNpZGUgSUNVcykgZm9ybWF0LlxuICovXG5jbGFzcyBTZXJpYWxpemVyVmlzaXRvciBpbXBsZW1lbnRzIGkxOG4uVmlzaXRvciB7XG4gIC8qKlxuICAgKiBGbGFnIHRoYXQgaW5kaWNhdGVzIHRoYXQgd2UgYXJlIHByb2Nlc3NpbmcgZWxlbWVudHMgb2YgYW4gSUNVLlxuICAgKlxuICAgKiBUaGlzIGZsYWcgaXMgbmVlZGVkIGR1ZSB0byB0aGUgZmFjdCB0aGF0IHBsYWNlaG9sZGVycyBpbiBJQ1VzIGFuZCBpbiBvdGhlciBtZXNzYWdlcyBhcmVcbiAgICogcmVwcmVzZW50ZWQgZGlmZmVyZW50bHkgaW4gQ2xvc3VyZTpcbiAgICogLSB7JHBsYWNlaG9sZGVyfSBpbiBub24tSUNVIGNhc2VcbiAgICogLSB7UExBQ0VIT0xERVJ9IGluc2lkZSBJQ1VcbiAgICovXG4gIHByaXZhdGUgaW5zaWRlSWN1ID0gZmFsc2U7XG5cbiAgcHJpdmF0ZSBmb3JtYXRQaCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBmb3JtYXR0ZWQgPSBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lKHZhbHVlLCAvKiB1c2VDYW1lbENhc2UgKi8gIXRoaXMuaW5zaWRlSWN1KTtcbiAgICByZXR1cm4gdGhpcy5pbnNpZGVJY3UgPyBgeyR7Zm9ybWF0dGVkfX1gIDogYHskJHtmb3JtYXR0ZWR9fWA7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaTE4bi5UZXh0LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGV4dC52YWx1ZTsgfVxuXG4gIHZpc2l0Q29udGFpbmVyKGNvbnRhaW5lcjogaTE4bi5Db250YWluZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnRhaW5lci5jaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpLmpvaW4oJycpO1xuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiBpMThuLkljdSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLmluc2lkZUljdSA9IHRydWU7XG4gICAgY29uc3Qgc3RyQ2FzZXMgPVxuICAgICAgICBPYmplY3Qua2V5cyhpY3UuY2FzZXMpLm1hcCgoazogc3RyaW5nKSA9PiBgJHtrfSB7JHtpY3UuY2FzZXNba10udmlzaXQodGhpcyl9fWApO1xuICAgIGNvbnN0IHJlc3VsdCA9IGB7JHtpY3UuZXhwcmVzc2lvblBsYWNlaG9sZGVyfSwgJHtpY3UudHlwZX0sICR7c3RyQ2FzZXMuam9pbignICcpfX1gO1xuICAgIHRoaXMuaW5zaWRlSWN1ID0gZmFsc2U7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHBoLmlzVm9pZCA/XG4gICAgICAgIHRoaXMuZm9ybWF0UGgocGguc3RhcnROYW1lKSA6XG4gICAgICAgIGAke3RoaXMuZm9ybWF0UGgocGguc3RhcnROYW1lKX0ke3BoLmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSkuam9pbignJyl9JHt0aGlzLmZvcm1hdFBoKHBoLmNsb3NlTmFtZSl9YDtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0aGlzLmZvcm1hdFBoKHBoLm5hbWUpOyB9XG5cbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogaTE4bi5JY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuZm9ybWF0UGgocGgubmFtZSk7XG4gIH1cbn1cblxuY29uc3Qgc2VyaWFsaXplclZpc2l0b3IgPSBuZXcgU2VyaWFsaXplclZpc2l0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlcmlhbGl6ZWRJMThuQ29udGVudChtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBzdHJpbmcge1xuICByZXR1cm4gbWVzc2FnZS5ub2Rlcy5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHNlcmlhbGl6ZXJWaXNpdG9yLCBudWxsKSkuam9pbignJyk7XG59Il19