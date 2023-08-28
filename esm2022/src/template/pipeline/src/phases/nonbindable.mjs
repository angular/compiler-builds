/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
 * When a container is marked with `ngNonBindable`, the non-bindable characteristic also applies to
 * all descendants of that container. Therefore, we must emit `disableBindings` and `enableBindings`
 * instructions for every such container.
 */
export function phaseNonbindable(job) {
    const elements = new Map();
    for (const view of job.units) {
        for (const op of view.create) {
            if (!ir.isElementOrContainerOp(op)) {
                continue;
            }
            elements.set(op.xref, op);
        }
    }
    for (const unit of job.units) {
        for (const op of unit.create) {
            if ((op.kind === ir.OpKind.ElementStart || op.kind === ir.OpKind.ContainerStart) &&
                op.nonBindable) {
                ir.OpList.insertAfter(ir.createDisableBindingsOp(op.xref), op);
            }
            if ((op.kind === ir.OpKind.ElementEnd || op.kind === ir.OpKind.ContainerEnd) &&
                lookupElement(elements, op.xref).nonBindable) {
                ir.OpList.insertBefore(ir.createEnableBindingsOp(op.xref), op);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9uYmluZGFibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9ub25iaW5kYWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUNsQixRQUFrRCxFQUFFLElBQWU7SUFDckUsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsT0FBTyxFQUFFLENBQUM7QUFDWixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxHQUFtQjtJQUNsRCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUNoRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2xDLFNBQVM7YUFDVjtZQUNELFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMzQjtLQUNGO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO2dCQUM1RSxFQUFFLENBQUMsV0FBVyxFQUFFO2dCQUNsQixFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBYyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQzdFO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztnQkFDeEUsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFO2dCQUNoRCxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBYyxFQUFFLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQzdFO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBMb29rcyB1cCBhbiBlbGVtZW50IGluIHRoZSBnaXZlbiBtYXAgYnkgeHJlZiBJRC5cbiAqL1xuZnVuY3Rpb24gbG9va3VwRWxlbWVudChcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzPiwgeHJlZjogaXIuWHJlZklkKTogaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzIHtcbiAgY29uc3QgZWwgPSBlbGVtZW50cy5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2UgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBXaGVuIGEgY29udGFpbmVyIGlzIG1hcmtlZCB3aXRoIGBuZ05vbkJpbmRhYmxlYCwgdGhlIG5vbi1iaW5kYWJsZSBjaGFyYWN0ZXJpc3RpYyBhbHNvIGFwcGxpZXMgdG9cbiAqIGFsbCBkZXNjZW5kYW50cyBvZiB0aGF0IGNvbnRhaW5lci4gVGhlcmVmb3JlLCB3ZSBtdXN0IGVtaXQgYGRpc2FibGVCaW5kaW5nc2AgYW5kIGBlbmFibGVCaW5kaW5nc2BcbiAqIGluc3RydWN0aW9ucyBmb3IgZXZlcnkgc3VjaCBjb250YWluZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZU5vbmJpbmRhYmxlKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzPigpO1xuICBmb3IgKGNvbnN0IHZpZXcgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgICAgaWYgKCFpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGVsZW1lbnRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmICgob3Aua2luZCA9PT0gaXIuT3BLaW5kLkVsZW1lbnRTdGFydCB8fCBvcC5raW5kID09PSBpci5PcEtpbmQuQ29udGFpbmVyU3RhcnQpICYmXG4gICAgICAgICAgb3Aubm9uQmluZGFibGUpIHtcbiAgICAgICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVEaXNhYmxlQmluZGluZ3NPcChvcC54cmVmKSwgb3ApO1xuICAgICAgfVxuICAgICAgaWYgKChvcC5raW5kID09PSBpci5PcEtpbmQuRWxlbWVudEVuZCB8fCBvcC5raW5kID09PSBpci5PcEtpbmQuQ29udGFpbmVyRW5kKSAmJlxuICAgICAgICAgIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnhyZWYpLm5vbkJpbmRhYmxlKSB7XG4gICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KGlyLmNyZWF0ZUVuYWJsZUJpbmRpbmdzT3Aob3AueHJlZiksIG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==