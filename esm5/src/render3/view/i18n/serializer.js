/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { formatI18nPlaceholderName } from './util';
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
        var formatted = formatI18nPlaceholderName(value, /* useCamelCase */ !this.insideIcu);
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
export function getSerializedI18nContent(message) {
    return message.nodes.map(function (node) { return node.visit(serializerVisitor, null); }).join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9zZXJpYWxpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyx5QkFBeUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSDtJQUFBO1FBQ0U7Ozs7Ozs7V0FPRztRQUNLLGNBQVMsR0FBRyxLQUFLLENBQUM7SUFpQzVCLENBQUM7SUEvQlMsb0NBQVEsR0FBaEIsVUFBaUIsS0FBYTtRQUM1QixJQUFNLFNBQVMsR0FBRyx5QkFBeUIsQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdkYsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFJLFNBQVMsTUFBRyxDQUFDLENBQUMsQ0FBQyxPQUFLLFNBQVMsTUFBRyxDQUFDO0lBQy9ELENBQUM7SUFFRCxxQ0FBUyxHQUFULFVBQVUsSUFBZSxFQUFFLE9BQVksSUFBUyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRXBFLDBDQUFjLEdBQWQsVUFBZSxTQUF5QixFQUFFLE9BQVk7UUFBdEQsaUJBRUM7UUFEQyxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRUQsb0NBQVEsR0FBUixVQUFTLEdBQWEsRUFBRSxPQUFZO1FBQXBDLGlCQU9DO1FBTkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdEIsSUFBTSxRQUFRLEdBQ1YsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUMsQ0FBUyxJQUFLLE9BQUcsQ0FBQyxVQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxNQUFHLEVBQXBDLENBQW9DLENBQUMsQ0FBQztRQUNwRixJQUFNLE1BQU0sR0FBRyxNQUFJLEdBQUcsQ0FBQyxxQkFBcUIsVUFBSyxHQUFHLENBQUMsSUFBSSxVQUFLLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQUcsQ0FBQztRQUNwRixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN2QixPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQsK0NBQW1CLEdBQW5CLFVBQW9CLEVBQXVCLEVBQUUsT0FBWTtRQUF6RCxpQkFJQztRQUhDLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUM3QixLQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUcsQ0FBQztJQUM1SCxDQUFDO0lBRUQsNENBQWdCLEdBQWhCLFVBQWlCLEVBQW9CLEVBQUUsT0FBWSxJQUFTLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVGLCtDQUFtQixHQUFuQixVQUFvQixFQUF1QixFQUFFLE9BQWE7UUFDeEQsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQ0gsd0JBQUM7QUFBRCxDQUFDLEFBMUNELElBMENDO0FBRUQsSUFBTSxpQkFBaUIsR0FBRyxJQUFJLGlCQUFpQixFQUFFLENBQUM7QUFFbEQsTUFBTSxVQUFVLHdCQUF3QixDQUFDLE9BQXFCO0lBQzVELE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxFQUFuQyxDQUFtQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2pGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5cbmltcG9ydCB7Zm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBUaGlzIHZpc2l0b3Igd2Fsa3Mgb3ZlciBpMThuIHRyZWUgYW5kIGdlbmVyYXRlcyBpdHMgc3RyaW5nIHJlcHJlc2VudGF0aW9uLCBpbmNsdWRpbmcgSUNVcyBhbmRcbiAqIHBsYWNlaG9sZGVycyBpbiBgeyRwbGFjZWhvbGRlcn1gIChmb3IgcGxhaW4gbWVzc2FnZXMpIG9yIGB7UExBQ0VIT0xERVJ9YCAoaW5zaWRlIElDVXMpIGZvcm1hdC5cbiAqL1xuY2xhc3MgU2VyaWFsaXplclZpc2l0b3IgaW1wbGVtZW50cyBpMThuLlZpc2l0b3Ige1xuICAvKipcbiAgICogRmxhZyB0aGF0IGluZGljYXRlcyB0aGF0IHdlIGFyZSBwcm9jZXNzaW5nIGVsZW1lbnRzIG9mIGFuIElDVS5cbiAgICpcbiAgICogVGhpcyBmbGFnIGlzIG5lZWRlZCBkdWUgdG8gdGhlIGZhY3QgdGhhdCBwbGFjZWhvbGRlcnMgaW4gSUNVcyBhbmQgaW4gb3RoZXIgbWVzc2FnZXMgYXJlXG4gICAqIHJlcHJlc2VudGVkIGRpZmZlcmVudGx5IGluIENsb3N1cmU6XG4gICAqIC0geyRwbGFjZWhvbGRlcn0gaW4gbm9uLUlDVSBjYXNlXG4gICAqIC0ge1BMQUNFSE9MREVSfSBpbnNpZGUgSUNVXG4gICAqL1xuICBwcml2YXRlIGluc2lkZUljdSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgZm9ybWF0UGgodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZm9ybWF0dGVkID0gZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZSh2YWx1ZSwgLyogdXNlQ2FtZWxDYXNlICovICF0aGlzLmluc2lkZUljdSk7XG4gICAgcmV0dXJuIHRoaXMuaW5zaWRlSWN1ID8gYHske2Zvcm1hdHRlZH19YCA6IGB7JCR7Zm9ybWF0dGVkfX1gO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRleHQudmFsdWU7IH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBjb250YWluZXIuY2hpbGRyZW4ubWFwKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKS5qb2luKCcnKTtcbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogaTE4bi5JY3UsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5pbnNpZGVJY3UgPSB0cnVlO1xuICAgIGNvbnN0IHN0ckNhc2VzID1cbiAgICAgICAgT2JqZWN0LmtleXMoaWN1LmNhc2VzKS5tYXAoKGs6IHN0cmluZykgPT4gYCR7a30geyR7aWN1LmNhc2VzW2tdLnZpc2l0KHRoaXMpfX1gKTtcbiAgICBjb25zdCByZXN1bHQgPSBgeyR7aWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlcn0sICR7aWN1LnR5cGV9LCAke3N0ckNhc2VzLmpvaW4oJyAnKX19YDtcbiAgICB0aGlzLmluc2lkZUljdSA9IGZhbHNlO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBoOiBpMThuLlRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBwaC5pc1ZvaWQgP1xuICAgICAgICB0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSkgOlxuICAgICAgICBgJHt0aGlzLmZvcm1hdFBoKHBoLnN0YXJ0TmFtZSl9JHtwaC5jaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpLmpvaW4oJycpfSR7dGhpcy5mb3JtYXRQaChwaC5jbG9zZU5hbWUpfWA7XG4gIH1cblxuICB2aXNpdFBsYWNlaG9sZGVyKHBoOiBpMThuLlBsYWNlaG9sZGVyLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGhpcy5mb3JtYXRQaChwaC5uYW1lKTsgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmZvcm1hdFBoKHBoLm5hbWUpO1xuICB9XG59XG5cbmNvbnN0IHNlcmlhbGl6ZXJWaXNpdG9yID0gbmV3IFNlcmlhbGl6ZXJWaXNpdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXJpYWxpemVkSTE4bkNvbnRlbnQobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogc3RyaW5nIHtcbiAgcmV0dXJuIG1lc3NhZ2Uubm9kZXMubWFwKG5vZGUgPT4gbm9kZS52aXNpdChzZXJpYWxpemVyVmlzaXRvciwgbnVsbCkpLmpvaW4oJycpO1xufSJdfQ==