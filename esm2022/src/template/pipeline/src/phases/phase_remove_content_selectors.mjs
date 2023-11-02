/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { createOpXrefMap } from '../util/elements';
/**
 * Attributes of `ng-content` named 'select' are specifically removed, because they control which
 * content matches as a property of the `projection`, and are not a plain attribute.
 */
export function removeContentSelectors(job) {
    for (const unit of job.units) {
        const elements = createOpXrefMap(unit);
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.Binding:
                    const target = lookupInXrefMap(elements, op.target);
                    if (op.name.toLowerCase() === 'select' && target.kind === ir.OpKind.Projection) {
                        ir.OpList.remove(op);
                    }
                    break;
            }
        }
    }
}
/**
 * Looks up an element in the given map by xref ID.
 */
function lookupInXrefMap(map, xref) {
    const el = map.get(xref);
    if (el === undefined) {
        throw new Error('All attributes should have an slottable target.');
    }
    return el;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGhhc2VfcmVtb3ZlX2NvbnRlbnRfc2VsZWN0b3JzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcGhhc2VfcmVtb3ZlX2NvbnRlbnRfc2VsZWN0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsR0FBbUI7SUFDeEQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixNQUFNLE1BQU0sR0FBRyxlQUFlLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDcEQsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFO3dCQUM5RSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztxQkFDbkM7b0JBQ0QsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsZUFBZSxDQUFDLEdBQXVELEVBQUUsSUFBZTtJQUUvRixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRTtRQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7S0FDcEU7SUFDRCxPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2NyZWF0ZU9wWHJlZk1hcH0gZnJvbSAnLi4vdXRpbC9lbGVtZW50cyc7XG5cbi8qKlxuICogQXR0cmlidXRlcyBvZiBgbmctY29udGVudGAgbmFtZWQgJ3NlbGVjdCcgYXJlIHNwZWNpZmljYWxseSByZW1vdmVkLCBiZWNhdXNlIHRoZXkgY29udHJvbCB3aGljaFxuICogY29udGVudCBtYXRjaGVzIGFzIGEgcHJvcGVydHkgb2YgdGhlIGBwcm9qZWN0aW9uYCwgYW5kIGFyZSBub3QgYSBwbGFpbiBhdHRyaWJ1dGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVDb250ZW50U2VsZWN0b3JzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gY3JlYXRlT3BYcmVmTWFwKHVuaXQpO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5CaW5kaW5nOlxuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGxvb2t1cEluWHJlZk1hcChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgICBpZiAob3AubmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc2VsZWN0JyAmJiB0YXJnZXQua2luZCA9PT0gaXIuT3BLaW5kLlByb2plY3Rpb24pIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuVXBkYXRlT3A+KG9wKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTG9va3MgdXAgYW4gZWxlbWVudCBpbiB0aGUgZ2l2ZW4gbWFwIGJ5IHhyZWYgSUQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cEluWHJlZk1hcChtYXA6IE1hcDxpci5YcmVmSWQsIGlyLkNvbnN1bWVzU2xvdE9wVHJhaXQmaXIuQ3JlYXRlT3A+LCB4cmVmOiBpci5YcmVmSWQpOlxuICAgIGlyLkNvbnN1bWVzU2xvdE9wVHJhaXQmaXIuQ3JlYXRlT3Age1xuICBjb25zdCBlbCA9IG1hcC5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBzbG90dGFibGUgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cbiJdfQ==