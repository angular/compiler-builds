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
        if (kind === ElementAttributeKind.Attribute || kind === ElementAttributeKind.Style) {
            if (value === null) {
                throw Error('Attribute & style element attributes must have a value');
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZWxlbWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUVuRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLG9CQThCWDtBQTlCRCxXQUFZLG9CQUFvQjtJQUM5Qjs7T0FFRztJQUNILHlFQUFTLENBQUE7SUFFVDs7T0FFRztJQUNILGlFQUFLLENBQUE7SUFFTDs7T0FFRztJQUNILGlFQUFLLENBQUE7SUFFTDs7T0FFRztJQUNILHFFQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILHVFQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILCtEQUFJLENBQUE7QUFDTixDQUFDLEVBOUJXLG9CQUFvQixLQUFwQixvQkFBb0IsUUE4Qi9CO0FBRUQsTUFBTSxlQUFlLEdBQWdDLE1BQU0sQ0FBQyxNQUFNLENBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBRXZGOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGlCQUFpQjtJQUE5QjtRQUNVLFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQzFCLFdBQU0sR0FBRyxJQUFJLEdBQXlDLENBQUM7UUFFL0QsY0FBUyxHQUFnQixJQUFJLENBQUM7SUErQ2hDLENBQUM7SUE3Q0MsSUFBSSxVQUFVO1FBQ1osT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxlQUFlLENBQUM7SUFDNUUsQ0FBQztJQUVELElBQUksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLElBQUksZUFBZSxDQUFDO0lBQ3hFLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDUixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxJQUFJLGVBQWUsQ0FBQztJQUN4RSxDQUFDO0lBRUQsSUFBSSxRQUFRO1FBQ1YsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxlQUFlLENBQUM7SUFDMUUsQ0FBQztJQUVELElBQUksUUFBUTtRQUNWLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksZUFBZSxDQUFDO0lBQzNFLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLGVBQWUsQ0FBQztJQUN2RSxDQUFDO0lBRUQsR0FBRyxDQUFDLElBQTBCLEVBQUUsSUFBWSxFQUFFLEtBQXdCO1FBQ3BFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEIsT0FBTztTQUNSO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM5QyxJQUFJLElBQUksS0FBSyxvQkFBb0IsQ0FBQyxTQUFTLElBQUksSUFBSSxLQUFLLG9CQUFvQixDQUFDLEtBQUssRUFBRTtZQUNsRixJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7Z0JBQ2xCLE1BQU0sS0FBSyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7YUFDdkU7WUFDRCxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ25CO0lBQ0gsQ0FBQztJQUVPLFFBQVEsQ0FBQyxJQUEwQjtRQUN6QyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDMUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQzNCO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUUsQ0FBQztJQUNoQyxDQUFDO0NBQ0Y7QUFFRCxTQUFTLHdCQUF3QixDQUFDLElBQVk7SUFDNUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFLGFBQWEsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5RCxNQUFNLFdBQVcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRTdDLElBQUksa0JBQWtCLEVBQUU7UUFDdEIsT0FBTztZQUNMLENBQUMsQ0FBQyxPQUFPLDJDQUFtQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsRUFBRSxXQUFXO1NBQ3pGLENBQUM7S0FDSDtJQUVELE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN2QixDQUFDO0FBRUQsTUFBTSxVQUFVLHlCQUF5QixDQUFDLEtBQVU7SUFDbEQsSUFBSSxDQUFDLENBQUMsS0FBSyxZQUFZLGlCQUFpQixDQUFDLEVBQUU7UUFDekMsTUFBTSxJQUFJLEtBQUssQ0FDWCxzRkFBc0YsQ0FBQyxDQUFDO0tBQzdGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIHR5cGVzIG9mIGF0dHJpYnV0ZXMgd2hpY2ggY2FuIGJlIGFwcGxpZWQgdG8gYW4gZWxlbWVudC5cbiAqL1xuZXhwb3J0IGVudW0gRWxlbWVudEF0dHJpYnV0ZUtpbmQge1xuICAvKipcbiAgICogU3RhdGljIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIENsYXNzIGJpbmRpbmdzLlxuICAgKi9cbiAgQ2xhc3MsXG5cbiAgLyoqXG4gICAqIFN0eWxlIGJpbmRpbmdzLlxuICAgKi9cbiAgU3R5bGUsXG5cbiAgLyoqXG4gICAqIER5bmFtaWMgcHJvcGVydHkgb3IgYXR0cmlidXRlIGJpbmRpbmdzLlxuICAgKi9cbiAgQmluZGluZyxcblxuICAvKipcbiAgICogQXR0cmlidXRlcyBvbiBhIHRlbXBsYXRlIG5vZGUuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogSW50ZXJuYXRpb25hbGl6ZWQgYXR0cmlidXRlcy5cbiAgICovXG4gIEkxOG4sXG59XG5cbmNvbnN0IEZMWVdFSUdIVF9BUlJBWTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+ID0gT2JqZWN0LmZyZWV6ZTxvLkV4cHJlc3Npb25bXT4oW10pO1xuXG4vKipcbiAqIENvbnRhaW5lciBmb3IgYWxsIG9mIHRoZSB2YXJpb3VzIGtpbmRzIG9mIGF0dHJpYnV0ZXMgd2hpY2ggYXJlIGFwcGxpZWQgb24gYW4gZWxlbWVudC5cbiAqL1xuZXhwb3J0IGNsYXNzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgcHJpdmF0ZSBrbm93biA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcml2YXRlIGJ5S2luZCA9IG5ldyBNYXA8RWxlbWVudEF0dHJpYnV0ZUtpbmQsIG8uRXhwcmVzc2lvbltdPjtcblxuICBwcm9qZWN0QXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBnZXQgYXR0cmlidXRlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoRWxlbWVudEF0dHJpYnV0ZUtpbmQuQXR0cmlidXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgY2xhc3NlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoRWxlbWVudEF0dHJpYnV0ZUtpbmQuQ2xhc3MpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCBzdHlsZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KEVsZW1lbnRBdHRyaWJ1dGVLaW5kLlN0eWxlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgYmluZGluZ3MoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KEVsZW1lbnRBdHRyaWJ1dGVLaW5kLkJpbmRpbmcpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCB0ZW1wbGF0ZSgpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoRWxlbWVudEF0dHJpYnV0ZUtpbmQuVGVtcGxhdGUpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCBpMThuKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChFbGVtZW50QXR0cmlidXRlS2luZC5JMThuKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBhZGQoa2luZDogRWxlbWVudEF0dHJpYnV0ZUtpbmQsIG5hbWU6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMua25vd24uaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMua25vd24uYWRkKG5hbWUpO1xuICAgIGNvbnN0IGFycmF5ID0gdGhpcy5hcnJheUZvcihraW5kKTtcbiAgICBhcnJheS5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lKSk7XG4gICAgaWYgKGtpbmQgPT09IEVsZW1lbnRBdHRyaWJ1dGVLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBFbGVtZW50QXR0cmlidXRlS2luZC5TdHlsZSkge1xuICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdBdHRyaWJ1dGUgJiBzdHlsZSBlbGVtZW50IGF0dHJpYnV0ZXMgbXVzdCBoYXZlIGEgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIGFycmF5LnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXJyYXlGb3Ioa2luZDogRWxlbWVudEF0dHJpYnV0ZUtpbmQpOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgaWYgKCF0aGlzLmJ5S2luZC5oYXMoa2luZCkpIHtcbiAgICAgIHRoaXMuYnlLaW5kLnNldChraW5kLCBbXSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoa2luZCkhO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lOiBzdHJpbmcpOiBvLkxpdGVyYWxFeHByW10ge1xuICBjb25zdCBbYXR0cmlidXRlTmFtZXNwYWNlLCBhdHRyaWJ1dGVOYW1lXSA9IHNwbGl0TnNOYW1lKG5hbWUpO1xuICBjb25zdCBuYW1lTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lKTtcblxuICBpZiAoYXR0cmlidXRlTmFtZXNwYWNlKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRJc0VsZW1lbnRBdHRyaWJ1dGVzKGF0dHJzOiBhbnkpOiBhc3NlcnRzIGF0dHJzIGlzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgaWYgKCEoYXR0cnMgaW5zdGFuY2VvZiBFbGVtZW50QXR0cmlidXRlcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBBc3NlcnRpb25FcnJvcjogRWxlbWVudEF0dHJpYnV0ZXMgaGFzIGFscmVhZHkgYmVlbiBjb2FsZXNjZWQgaW50byB0aGUgdmlldyBjb25zdGFudHNgKTtcbiAgfVxufVxuIl19