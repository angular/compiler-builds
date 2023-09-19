/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { getElementsByXrefId } from '../util/elements';
/**
 * Attributes of `ng-content` named 'select' are specifically removed, because they control which
 * content matches as a property of the `projection`, and are not a plain attribute.
 */
export function phaseRemoveContentSelectors(job) {
    for (const unit of job.units) {
        const elements = getElementsByXrefId(unit);
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.Binding:
                    const target = lookupElement(elements, op.target);
                    if (op.name.toLowerCase() === 'select' && target.kind === ir.OpKind.Projection) {
                        ir.OpList.remove(op);
                    }
                    continue;
            }
        }
    }
}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGhhc2VfcmVtb3ZlX2NvbnRlbnRfc2VsZWN0b3JzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcGhhc2VfcmVtb3ZlX2NvbnRlbnRfc2VsZWN0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRXJEOzs7R0FHRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxHQUFtQjtJQUM3RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0MsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTztvQkFDcEIsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ2xELElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTt3QkFDOUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7cUJBQ25DO29CQUNELFNBQVM7YUFDWjtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGFBQWEsQ0FDbEIsUUFBa0QsRUFBRSxJQUFlO0lBQ3JFLE1BQU0sRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsSUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFO1FBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztLQUN2RTtJQUNELE9BQU8sRUFBRSxDQUFDO0FBQ1osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtnZXRFbGVtZW50c0J5WHJlZklkfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBBdHRyaWJ1dGVzIG9mIGBuZy1jb250ZW50YCBuYW1lZCAnc2VsZWN0JyBhcmUgc3BlY2lmaWNhbGx5IHJlbW92ZWQsIGJlY2F1c2UgdGhleSBjb250cm9sIHdoaWNoXG4gKiBjb250ZW50IG1hdGNoZXMgYXMgYSBwcm9wZXJ0eSBvZiB0aGUgYHByb2plY3Rpb25gLCBhbmQgYXJlIG5vdCBhIHBsYWluIGF0dHJpYnV0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVtb3ZlQ29udGVudFNlbGVjdG9ycyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGdldEVsZW1lbnRzQnlYcmVmSWQodW5pdCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkJpbmRpbmc6XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgICBpZiAob3AubmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc2VsZWN0JyAmJiB0YXJnZXQua2luZCA9PT0gaXIuT3BLaW5kLlByb2plY3Rpb24pIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuVXBkYXRlT3A+KG9wKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTG9va3MgdXAgYW4gZWxlbWVudCBpbiB0aGUgZ2l2ZW4gbWFwIGJ5IHhyZWYgSUQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cEVsZW1lbnQoXG4gICAgZWxlbWVudHM6IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcz4sIHhyZWY6IGlyLlhyZWZJZCk6IGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcyB7XG4gIGNvbnN0IGVsID0gZWxlbWVudHMuZ2V0KHhyZWYpO1xuICBpZiAoZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQWxsIGF0dHJpYnV0ZXMgc2hvdWxkIGhhdmUgYW4gZWxlbWVudC1saWtlIHRhcmdldC4nKTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG4iXX0=