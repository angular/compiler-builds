/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { splitNsName } from '../../../../ml_parser/tags';
import * as o from '../../../../output/output_ast';
/**
 * Enumeration of the types of attributes which can be applied to an element.
 */
export var ElementAttributeKind;
(function (ElementAttributeKind) {
    /**
     * Static attributes.
     */
    ElementAttributeKind[ElementAttributeKind["Attribute"] = 0] = "Attribute";
    /**
     * Class bindings.
     */
    ElementAttributeKind[ElementAttributeKind["Class"] = 1] = "Class";
    /**
     * Style bindings.
     */
    ElementAttributeKind[ElementAttributeKind["Style"] = 2] = "Style";
    /**
     * Dynamic property or attribute bindings.
     */
    ElementAttributeKind[ElementAttributeKind["Binding"] = 3] = "Binding";
    /**
     * Attributes on a template node.
     */
    ElementAttributeKind[ElementAttributeKind["Template"] = 4] = "Template";
    /**
     * Internationalized attributes.
     */
    ElementAttributeKind[ElementAttributeKind["I18n"] = 5] = "I18n";
})(ElementAttributeKind || (ElementAttributeKind = {}));
const FLYWEIGHT_ARRAY = Object.freeze([]);
/**
 * Container for all of the various kinds of attributes which are applied on an element.
 */
export class ElementAttributes {
    constructor() {
        this.known = new Set();
        this.byKind = new Map;
        this.projectAs = null;
    }
    get attributes() {
        return this.byKind.get(ElementAttributeKind.Attribute) ?? FLYWEIGHT_ARRAY;
    }
    get classes() {
        return this.byKind.get(ElementAttributeKind.Class) ?? FLYWEIGHT_ARRAY;
    }
    get styles() {
        return this.byKind.get(ElementAttributeKind.Style) ?? FLYWEIGHT_ARRAY;
    }
    get bindings() {
        return this.byKind.get(ElementAttributeKind.Binding) ?? FLYWEIGHT_ARRAY;
    }
    get template() {
        return this.byKind.get(ElementAttributeKind.Template) ?? FLYWEIGHT_ARRAY;
    }
    get i18n() {
        return this.byKind.get(ElementAttributeKind.I18n) ?? FLYWEIGHT_ARRAY;
    }
    add(kind, name, value) {
        if (this.known.has(name)) {
            return;
        }
        this.known.add(name);
        const array = this.arrayFor(kind);
        array.push(...getAttributeNameLiterals(name));
        if (value !== null) {
            array.push(value);
        }
    }
    arrayFor(kind) {
        if (!this.byKind.has(kind)) {
            this.byKind.set(kind, []);
        }
        return this.byKind.get(kind);
    }
}
function getAttributeNameLiterals(name) {
    const [attributeNamespace, attributeName] = splitNsName(name);
    const nameLiteral = o.literal(attributeName);
    if (attributeNamespace) {
        return [
            o.literal(0 /* core.AttributeMarker.NamespaceURI */), o.literal(attributeNamespace), nameLiteral
        ];
    }
    return [nameLiteral];
}
export function assertIsElementAttributes(attrs) {
    if (!(attrs instanceof ElementAttributes)) {
        throw new Error(`AssertionError: ElementAttributes has already been coalesced into the view constants`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZWxlbWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUVuRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLG9CQThCWDtBQTlCRCxXQUFZLG9CQUFvQjtJQUM5Qjs7T0FFRztJQUNILHlFQUFTLENBQUE7SUFFVDs7T0FFRztJQUNILGlFQUFLLENBQUE7SUFFTDs7T0FFRztJQUNILGlFQUFLLENBQUE7SUFFTDs7T0FFRztJQUNILHFFQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILHVFQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILCtEQUFJLENBQUE7QUFDTixDQUFDLEVBOUJXLG9CQUFvQixLQUFwQixvQkFBb0IsUUE4Qi9CO0FBRUQsTUFBTSxlQUFlLEdBQWdDLE1BQU0sQ0FBQyxNQUFNLENBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBRXZGOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGlCQUFpQjtJQUE5QjtRQUNVLFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQzFCLFdBQU0sR0FBRyxJQUFJLEdBQXlDLENBQUM7UUFFL0QsY0FBUyxHQUFnQixJQUFJLENBQUM7SUE0Q2hDLENBQUM7SUExQ0MsSUFBSSxVQUFVO1FBQ1osT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxlQUFlLENBQUM7SUFDNUUsQ0FBQztJQUVELElBQUksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLElBQUksZUFBZSxDQUFDO0lBQ3hFLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDUixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxJQUFJLGVBQWUsQ0FBQztJQUN4RSxDQUFDO0lBRUQsSUFBSSxRQUFRO1FBQ1YsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxlQUFlLENBQUM7SUFDMUUsQ0FBQztJQUVELElBQUksUUFBUTtRQUNWLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksZUFBZSxDQUFDO0lBQzNFLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLGVBQWUsQ0FBQztJQUN2RSxDQUFDO0lBRUQsR0FBRyxDQUFDLElBQTBCLEVBQUUsSUFBWSxFQUFFLEtBQXdCO1FBQ3BFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEIsT0FBTztTQUNSO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM5QyxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFDbEIsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNuQjtJQUNILENBQUM7SUFFTyxRQUFRLENBQUMsSUFBMEI7UUFDekMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMzQjtRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDaEMsQ0FBQztDQUNGO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxJQUFZO0lBQzVDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxhQUFhLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUU3QyxJQUFJLGtCQUFrQixFQUFFO1FBQ3RCLE9BQU87WUFDTCxDQUFDLENBQUMsT0FBTywyQ0FBbUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsV0FBVztTQUN6RixDQUFDO0tBQ0g7SUFFRCxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVELE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxLQUFVO0lBQ2xELElBQUksQ0FBQyxDQUFDLEtBQUssWUFBWSxpQkFBaUIsQ0FBQyxFQUFFO1FBQ3pDLE1BQU0sSUFBSSxLQUFLLENBQ1gsc0ZBQXNGLENBQUMsQ0FBQztLQUM3RjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi8uLi8uLi9jb3JlJztcbmltcG9ydCB7c3BsaXROc05hbWV9IGZyb20gJy4uLy4uLy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG4vKipcbiAqIEVudW1lcmF0aW9uIG9mIHRoZSB0eXBlcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGNhbiBiZSBhcHBsaWVkIHRvIGFuIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBlbnVtIEVsZW1lbnRBdHRyaWJ1dGVLaW5kIHtcbiAgLyoqXG4gICAqIFN0YXRpYyBhdHRyaWJ1dGVzLlxuICAgKi9cbiAgQXR0cmlidXRlLFxuXG4gIC8qKlxuICAgKiBDbGFzcyBiaW5kaW5ncy5cbiAgICovXG4gIENsYXNzLFxuXG4gIC8qKlxuICAgKiBTdHlsZSBiaW5kaW5ncy5cbiAgICovXG4gIFN0eWxlLFxuXG4gIC8qKlxuICAgKiBEeW5hbWljIHByb3BlcnR5IG9yIGF0dHJpYnV0ZSBiaW5kaW5ncy5cbiAgICovXG4gIEJpbmRpbmcsXG5cbiAgLyoqXG4gICAqIEF0dHJpYnV0ZXMgb24gYSB0ZW1wbGF0ZSBub2RlLlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEludGVybmF0aW9uYWxpemVkIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBJMThuLFxufVxuXG5jb25zdCBGTFlXRUlHSFRfQVJSQVk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiA9IE9iamVjdC5mcmVlemU8by5FeHByZXNzaW9uW10+KFtdKTtcblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBvZiB0aGUgdmFyaW91cyBraW5kcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGFyZSBhcHBsaWVkIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBFbGVtZW50QXR0cmlidXRlcyB7XG4gIHByaXZhdGUga25vd24gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcHJpdmF0ZSBieUtpbmQgPSBuZXcgTWFwPEVsZW1lbnRBdHRyaWJ1dGVLaW5kLCBvLkV4cHJlc3Npb25bXT47XG5cbiAgcHJvamVjdEFzOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgZ2V0IGF0dHJpYnV0ZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KEVsZW1lbnRBdHRyaWJ1dGVLaW5kLkF0dHJpYnV0ZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGNsYXNzZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KEVsZW1lbnRBdHRyaWJ1dGVLaW5kLkNsYXNzKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgc3R5bGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChFbGVtZW50QXR0cmlidXRlS2luZC5TdHlsZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGJpbmRpbmdzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChFbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KEVsZW1lbnRBdHRyaWJ1dGVLaW5kLlRlbXBsYXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgaTE4bigpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoRWxlbWVudEF0dHJpYnV0ZUtpbmQuSTE4bikgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgYWRkKGtpbmQ6IEVsZW1lbnRBdHRyaWJ1dGVLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmtub3duLmhhcyhuYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmtub3duLmFkZChuYW1lKTtcbiAgICBjb25zdCBhcnJheSA9IHRoaXMuYXJyYXlGb3Ioa2luZCk7XG4gICAgYXJyYXkucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZSkpO1xuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgYXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcnJheUZvcihraW5kOiBFbGVtZW50QXR0cmlidXRlS2luZCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBpZiAoIXRoaXMuYnlLaW5kLmhhcyhraW5kKSkge1xuICAgICAgdGhpcy5ieUtpbmQuc2V0KGtpbmQsIFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChraW5kKSE7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMoYXR0cnM6IGFueSk6IGFzc2VydHMgYXR0cnMgaXMgRWxlbWVudEF0dHJpYnV0ZXMge1xuICBpZiAoIShhdHRycyBpbnN0YW5jZW9mIEVsZW1lbnRBdHRyaWJ1dGVzKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBFbGVtZW50QXR0cmlidXRlcyBoYXMgYWxyZWFkeSBiZWVuIGNvYWxlc2NlZCBpbnRvIHRoZSB2aWV3IGNvbnN0YW50c2ApO1xuICB9XG59XG4iXX0=