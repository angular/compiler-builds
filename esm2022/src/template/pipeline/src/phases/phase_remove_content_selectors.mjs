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
export function phaseRemoveContentSelectors(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGhhc2VfcmVtb3ZlX2NvbnRlbnRfc2VsZWN0b3JzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcGhhc2VfcmVtb3ZlX2NvbnRlbnRfc2VsZWN0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsMkJBQTJCLENBQUMsR0FBbUI7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixNQUFNLE1BQU0sR0FBRyxlQUFlLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDcEQsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFO3dCQUM5RSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztxQkFDbkM7b0JBQ0QsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsZUFBZSxDQUFDLEdBQXVELEVBQUUsSUFBZTtJQUUvRixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRTtRQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7S0FDcEU7SUFDRCxPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7Y3JlYXRlT3BYcmVmTWFwfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBBdHRyaWJ1dGVzIG9mIGBuZy1jb250ZW50YCBuYW1lZCAnc2VsZWN0JyBhcmUgc3BlY2lmaWNhbGx5IHJlbW92ZWQsIGJlY2F1c2UgdGhleSBjb250cm9sIHdoaWNoXG4gKiBjb250ZW50IG1hdGNoZXMgYXMgYSBwcm9wZXJ0eSBvZiB0aGUgYHByb2plY3Rpb25gLCBhbmQgYXJlIG5vdCBhIHBsYWluIGF0dHJpYnV0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVtb3ZlQ29udGVudFNlbGVjdG9ycyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGNyZWF0ZU9wWHJlZk1hcCh1bml0KTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQmluZGluZzpcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSBsb29rdXBJblhyZWZNYXAoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgICAgaWYgKG9wLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3NlbGVjdCcgJiYgdGFyZ2V0LmtpbmQgPT09IGlyLk9wS2luZC5Qcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIExvb2tzIHVwIGFuIGVsZW1lbnQgaW4gdGhlIGdpdmVuIG1hcCBieSB4cmVmIElELlxuICovXG5mdW5jdGlvbiBsb29rdXBJblhyZWZNYXAobWFwOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPiwgeHJlZjogaXIuWHJlZklkKTpcbiAgICBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgZWwgPSBtYXAuZ2V0KHhyZWYpO1xuICBpZiAoZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQWxsIGF0dHJpYnV0ZXMgc2hvdWxkIGhhdmUgYW4gc2xvdHRhYmxlIHRhcmdldC4nKTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG4iXX0=