/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * Looks up an element in the given map by xref ID.
 */
function lookupElement(elements, xref) {
    const el = elements.get(xref);
    if (el === undefined) {
        throw new Error('All attributes should have an element-like target.');
    }
    return el;
}
/**
 * Find all attribute and binding ops, and collect them into the ElementAttribute structures.
 * In cases where no instruction needs to be generated for the attribute or binding, it is removed.
 */
export function phaseAttributeExtraction(cpl, compatibility) {
    for (const [_, view] of cpl.views) {
        populateElementAttributes(view, compatibility);
    }
}
/**
 * Populates the ElementAttributes map for the given view, and removes ops for any bindings that do
 * not need further processing.
 */
function populateElementAttributes(view, compatibility) {
    const elements = new Map();
    for (const op of view.create) {
        if (!ir.isElementOrContainerOp(op)) {
            continue;
        }
        elements.set(op.xref, op);
    }
    for (const op of view.ops()) {
        let ownerOp;
        switch (op.kind) {
            case ir.OpKind.Attribute:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                let extractable = compatibility ?
                    (op.value instanceof o.LiteralExpr && typeof op.value.value === 'string') :
                    (op.value.isConstant());
                // We don't need to generate instructions for attributes that can be extracted as consts.
                if (extractable) {
                    ownerOp.attributes.add(op.attributeKind, op.name, op.value);
                    ir.OpList.remove(op);
                }
                break;
            case ir.OpKind.Property:
            case ir.OpKind.InterpolateProperty:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(op.bindingKind, op.name, null);
                break;
            case ir.OpKind.Listener:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(ir.ElementAttributeKind.Binding, op.name, null);
                // We don't need to generate instructions for listeners on templates.
                if (ownerOp.kind === ir.OpKind.Template) {
                    ir.OpList.remove(op);
                }
                break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsU0FBUyxhQUFhLENBQ2xCLFFBQWtELEVBQUUsSUFBZTtJQUNyRSxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRTtRQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7S0FDdkU7SUFDRCxPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQUMsR0FBeUIsRUFBRSxhQUFzQjtJQUN4RixLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNqQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7S0FDaEQ7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyx5QkFBeUIsQ0FBQyxJQUFxQixFQUFFLGFBQXNCO0lBQzlFLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUF1QyxDQUFDO0lBQ2hFLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUM1QixJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ2xDLFNBQVM7U0FDVjtRQUNELFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztLQUMzQjtJQUVELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQzNCLElBQUksT0FBMkMsQ0FBQztRQUNoRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztnQkFDdEIsT0FBTyxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM3QyxFQUFFLENBQUMseUJBQXlCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUVqRCxJQUFJLFdBQVcsR0FBRyxhQUFhLENBQUMsQ0FBQztvQkFDN0IsQ0FBQyxFQUFFLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxXQUFXLElBQUksT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUMzRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFFNUIseUZBQXlGO2dCQUN6RixJQUFJLFdBQVcsRUFBRTtvQkFDZixPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUM1RCxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFpQixDQUFDLENBQUM7aUJBQ3JDO2dCQUNELE1BQU07WUFFUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO1lBQ3hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUI7Z0JBQ2hDLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFFakQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN0RCxNQUFNO1lBRVIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFFakQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUV2RSxxRUFBcUU7Z0JBQ3JFLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtvQkFDdkMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBaUIsQ0FBQyxDQUFDO2lCQUNyQztnQkFDRCxNQUFNO1NBQ1Q7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uLCBWaWV3Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBMb29rcyB1cCBhbiBlbGVtZW50IGluIHRoZSBnaXZlbiBtYXAgYnkgeHJlZiBJRC5cbiAqL1xuZnVuY3Rpb24gbG9va3VwRWxlbWVudChcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzPiwgeHJlZjogaXIuWHJlZklkKTogaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzIHtcbiAgY29uc3QgZWwgPSBlbGVtZW50cy5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2UgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBGaW5kIGFsbCBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY29sbGVjdCB0aGVtIGludG8gdGhlIEVsZW1lbnRBdHRyaWJ1dGUgc3RydWN0dXJlcy5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9uKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24sIGNvbXBhdGliaWxpdHk6IGJvb2xlYW4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgcG9wdWxhdGVFbGVtZW50QXR0cmlidXRlcyh2aWV3LCBjb21wYXRpYmlsaXR5KTtcbiAgfVxufVxuXG4vKipcbiAqIFBvcHVsYXRlcyB0aGUgRWxlbWVudEF0dHJpYnV0ZXMgbWFwIGZvciB0aGUgZ2l2ZW4gdmlldywgYW5kIHJlbW92ZXMgb3BzIGZvciBhbnkgYmluZGluZ3MgdGhhdCBkb1xuICogbm90IG5lZWQgZnVydGhlciBwcm9jZXNzaW5nLlxuICovXG5mdW5jdGlvbiBwb3B1bGF0ZUVsZW1lbnRBdHRyaWJ1dGVzKHZpZXc6IFZpZXdDb21waWxhdGlvbiwgY29tcGF0aWJpbGl0eTogYm9vbGVhbikge1xuICBjb25zdCBlbGVtZW50cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50T3JDb250YWluZXJPcHM+KCk7XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBpZiAoIWlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgIGxldCBvd25lck9wOiBpci5FbGVtZW50T3JDb250YWluZXJPcHN8dW5kZWZpbmVkO1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgaXIuYXNzZXJ0SXNFbGVtZW50QXR0cmlidXRlcyhvd25lck9wLmF0dHJpYnV0ZXMpO1xuXG4gICAgICAgIGxldCBleHRyYWN0YWJsZSA9IGNvbXBhdGliaWxpdHkgP1xuICAgICAgICAgICAgKG9wLnZhbHVlIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJiB0eXBlb2Ygb3AudmFsdWUudmFsdWUgPT09ICdzdHJpbmcnKSA6XG4gICAgICAgICAgICAob3AudmFsdWUuaXNDb25zdGFudCgpKTtcblxuICAgICAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGdlbmVyYXRlIGluc3RydWN0aW9ucyBmb3IgYXR0cmlidXRlcyB0aGF0IGNhbiBiZSBleHRyYWN0ZWQgYXMgY29uc3RzLlxuICAgICAgICBpZiAoZXh0cmFjdGFibGUpIHtcbiAgICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKG9wLmF0dHJpYnV0ZUtpbmQsIG9wLm5hbWUsIG9wLnZhbHVlKTtcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlKG9wIGFzIGlyLlVwZGF0ZU9wKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVByb3BlcnR5OlxuICAgICAgICBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgaXIuYXNzZXJ0SXNFbGVtZW50QXR0cmlidXRlcyhvd25lck9wLmF0dHJpYnV0ZXMpO1xuXG4gICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQob3AuYmluZGluZ0tpbmQsIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgICBpci5hc3NlcnRJc0VsZW1lbnRBdHRyaWJ1dGVzKG93bmVyT3AuYXR0cmlidXRlcyk7XG5cbiAgICAgICAgb3duZXJPcC5hdHRyaWJ1dGVzLmFkZChpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nLCBvcC5uYW1lLCBudWxsKTtcblxuICAgICAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGdlbmVyYXRlIGluc3RydWN0aW9ucyBmb3IgbGlzdGVuZXJzIG9uIHRlbXBsYXRlcy5cbiAgICAgICAgaWYgKG93bmVyT3Aua2luZCA9PT0gaXIuT3BLaW5kLlRlbXBsYXRlKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5DcmVhdGVPcCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG4iXX0=