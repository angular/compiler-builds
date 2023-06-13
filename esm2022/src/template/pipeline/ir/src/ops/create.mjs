/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ElementAttributes } from '../element';
import { OpKind } from '../enums';
import { OpList } from '../operations';
import { TRAIT_CONSUMES_SLOT, TRAIT_USES_SLOT_INDEX } from '../traits';
import { NEW_OP } from './shared';
/**
 * The set of OpKinds that represent the creation of an element or container
 */
const elementContainerOpKinds = new Set([
    OpKind.Element, OpKind.ElementStart, OpKind.Container, OpKind.ContainerStart, OpKind.Template
]);
/**
 * Checks whether the given operation represents the creation of an element or container.
 */
export function isElementOrContainerOp(op) {
    return elementContainerOpKinds.has(op.kind);
}
/**
 * Create an `ElementStartOp`.
 */
export function createElementStartOp(tag, xref) {
    return {
        kind: OpKind.ElementStart,
        xref,
        tag,
        attributes: new ElementAttributes(),
        localRefs: [],
        ...TRAIT_CONSUMES_SLOT,
        ...NEW_OP,
    };
}
/**
 * Create a `TemplateOp`.
 */
export function createTemplateOp(xref, tag) {
    return {
        kind: OpKind.Template,
        xref,
        attributes: new ElementAttributes(),
        tag,
        decls: null,
        vars: null,
        localRefs: [],
        ...TRAIT_CONSUMES_SLOT,
        ...NEW_OP,
    };
}
/**
 * Create an `ElementEndOp`.
 */
export function createElementEndOp(xref) {
    return {
        kind: OpKind.ElementEnd,
        xref,
        ...NEW_OP,
    };
}
/**
 * Create a `TextOp`.
 */
export function createTextOp(xref, initialValue) {
    return {
        kind: OpKind.Text,
        xref,
        initialValue,
        ...TRAIT_CONSUMES_SLOT,
        ...NEW_OP,
    };
}
/**
 * Create a `ListenerOp`.
 */
export function createListenerOp(target, name, tag) {
    return {
        kind: OpKind.Listener,
        target,
        tag,
        name,
        handlerOps: new OpList(),
        handlerFnName: null,
        ...NEW_OP,
        ...TRAIT_USES_SLOT_INDEX,
    };
}
export function createPipeOp(xref, name) {
    return {
        kind: OpKind.Pipe,
        xref,
        name,
        ...NEW_OP,
        ...TRAIT_CONSUMES_SLOT,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL2lyL3NyYy9vcHMvY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUM3QyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ2hDLE9BQU8sRUFBSyxNQUFNLEVBQVMsTUFBTSxlQUFlLENBQUM7QUFDakQsT0FBTyxFQUFzQixtQkFBbUIsRUFBRSxxQkFBcUIsRUFBcUIsTUFBTSxXQUFXLENBQUM7QUFFOUcsT0FBTyxFQUFZLE1BQU0sRUFBMEIsTUFBTSxVQUFVLENBQUM7QUFpQnBFOztHQUVHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUN0QyxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxRQUFRO0NBQzlGLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLEVBQVk7SUFDakQsT0FBTyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFxRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBVyxFQUFFLElBQVk7SUFDNUQsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsWUFBWTtRQUN6QixJQUFJO1FBQ0osR0FBRztRQUNILFVBQVUsRUFBRSxJQUFJLGlCQUFpQixFQUFFO1FBQ25DLFNBQVMsRUFBRSxFQUFFO1FBQ2IsR0FBRyxtQkFBbUI7UUFDdEIsR0FBRyxNQUFNO0tBQ1YsQ0FBQztBQUNKLENBQUM7QUE0QkQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsSUFBWSxFQUFFLEdBQVc7SUFDeEQsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsUUFBUTtRQUNyQixJQUFJO1FBQ0osVUFBVSxFQUFFLElBQUksaUJBQWlCLEVBQUU7UUFDbkMsR0FBRztRQUNILEtBQUssRUFBRSxJQUFJO1FBQ1gsSUFBSSxFQUFFLElBQUk7UUFDVixTQUFTLEVBQUUsRUFBRTtRQUNiLEdBQUcsbUJBQW1CO1FBQ3RCLEdBQUcsTUFBTTtLQUNWLENBQUM7QUFDSixDQUFDO0FBZ0JEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQVk7SUFDN0MsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsVUFBVTtRQUN2QixJQUFJO1FBQ0osR0FBRyxNQUFNO0tBQ1YsQ0FBQztBQUNKLENBQUM7QUErQ0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsWUFBWSxDQUFDLElBQVksRUFBRSxZQUFvQjtJQUM3RCxPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1FBQ2pCLElBQUk7UUFDSixZQUFZO1FBQ1osR0FBRyxtQkFBbUI7UUFDdEIsR0FBRyxNQUFNO0tBQ1YsQ0FBQztBQUNKLENBQUM7QUE2QkQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsTUFBYyxFQUFFLElBQVksRUFBRSxHQUFXO0lBQ3hFLE9BQU87UUFDTCxJQUFJLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDckIsTUFBTTtRQUNOLEdBQUc7UUFDSCxJQUFJO1FBQ0osVUFBVSxFQUFFLElBQUksTUFBTSxFQUFFO1FBQ3hCLGFBQWEsRUFBRSxJQUFJO1FBQ25CLEdBQUcsTUFBTTtRQUNULEdBQUcscUJBQXFCO0tBQ3pCLENBQUM7QUFDSixDQUFDO0FBUUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxJQUFZLEVBQUUsSUFBWTtJQUNyRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1FBQ2pCLElBQUk7UUFDSixJQUFJO1FBQ0osR0FBRyxNQUFNO1FBQ1QsR0FBRyxtQkFBbUI7S0FDdkIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtFbGVtZW50QXR0cmlidXRlc30gZnJvbSAnLi4vZWxlbWVudCc7XG5pbXBvcnQge09wS2luZH0gZnJvbSAnLi4vZW51bXMnO1xuaW1wb3J0IHtPcCwgT3BMaXN0LCBYcmVmSWR9IGZyb20gJy4uL29wZXJhdGlvbnMnO1xuaW1wb3J0IHtDb25zdW1lc1Nsb3RPcFRyYWl0LCBUUkFJVF9DT05TVU1FU19TTE9ULCBUUkFJVF9VU0VTX1NMT1RfSU5ERVgsIFVzZXNTbG90SW5kZXhUcmFpdH0gZnJvbSAnLi4vdHJhaXRzJztcblxuaW1wb3J0IHtMaXN0RW5kT3AsIE5FV19PUCwgU3RhdGVtZW50T3AsIFZhcmlhYmxlT3B9IGZyb20gJy4vc2hhcmVkJztcblxuaW1wb3J0IHR5cGUge1VwZGF0ZU9wfSBmcm9tICcuL3VwZGF0ZSc7XG5cbi8qKlxuICogQW4gb3BlcmF0aW9uIHVzYWJsZSBvbiB0aGUgY3JlYXRpb24gc2lkZSBvZiB0aGUgSVIuXG4gKi9cbmV4cG9ydCB0eXBlIENyZWF0ZU9wID1cbiAgICBMaXN0RW5kT3A8Q3JlYXRlT3A+fFN0YXRlbWVudE9wPENyZWF0ZU9wPnxFbGVtZW50T3B8RWxlbWVudFN0YXJ0T3B8RWxlbWVudEVuZE9wfENvbnRhaW5lck9wfFxuICAgIENvbnRhaW5lclN0YXJ0T3B8Q29udGFpbmVyRW5kT3B8VGVtcGxhdGVPcHxUZXh0T3B8TGlzdGVuZXJPcHxQaXBlT3B8VmFyaWFibGVPcDxDcmVhdGVPcD47XG5cbi8qKlxuICogQW4gb3BlcmF0aW9uIHJlcHJlc2VudGluZyB0aGUgY3JlYXRpb24gb2YgYW4gZWxlbWVudCBvciBjb250YWluZXIuXG4gKi9cbmV4cG9ydCB0eXBlIEVsZW1lbnRPckNvbnRhaW5lck9wcyA9XG4gICAgRWxlbWVudE9wfEVsZW1lbnRTdGFydE9wfENvbnRhaW5lck9wfENvbnRhaW5lclN0YXJ0T3B8VGVtcGxhdGVPcDtcblxuLyoqXG4gKiBUaGUgc2V0IG9mIE9wS2luZHMgdGhhdCByZXByZXNlbnQgdGhlIGNyZWF0aW9uIG9mIGFuIGVsZW1lbnQgb3IgY29udGFpbmVyXG4gKi9cbmNvbnN0IGVsZW1lbnRDb250YWluZXJPcEtpbmRzID0gbmV3IFNldChbXG4gIE9wS2luZC5FbGVtZW50LCBPcEtpbmQuRWxlbWVudFN0YXJ0LCBPcEtpbmQuQ29udGFpbmVyLCBPcEtpbmQuQ29udGFpbmVyU3RhcnQsIE9wS2luZC5UZW1wbGF0ZVxuXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIG9wZXJhdGlvbiByZXByZXNlbnRzIHRoZSBjcmVhdGlvbiBvZiBhbiBlbGVtZW50IG9yIGNvbnRhaW5lci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3A6IENyZWF0ZU9wKTogb3AgaXMgRWxlbWVudE9yQ29udGFpbmVyT3BzIHtcbiAgcmV0dXJuIGVsZW1lbnRDb250YWluZXJPcEtpbmRzLmhhcyhvcC5raW5kKTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRhdGlvbiBvZiBhIGxvY2FsIHJlZmVyZW5jZSBvbiBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIExvY2FsUmVmIHtcbiAgLyoqXG4gICAqIFVzZXItZGVmaW5lZCBuYW1lIG9mIHRoZSBsb2NhbCByZWYgdmFyaWFibGUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRhcmdldCBvZiB0aGUgbG9jYWwgcmVmZXJlbmNlIHZhcmlhYmxlIChvZnRlbiBgJydgKS5cbiAgICovXG4gIHRhcmdldDogc3RyaW5nO1xufVxuXG4vKipcbiAqIEJhc2UgaW50ZXJmYWNlIGZvciBgRWxlbWVudGAsIGBFbGVtZW50U3RhcnRgLCBhbmQgYFRlbXBsYXRlYCBvcGVyYXRpb25zLCBjb250YWluaW5nIGNvbW1vbiBmaWVsZHNcbiAqIHVzZWQgdG8gcmVwcmVzZW50IHRoZWlyIGVsZW1lbnQtbGlrZSBuYXR1cmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIGV4dGVuZHMgT3A8Q3JlYXRlT3A+LCBDb25zdW1lc1Nsb3RPcFRyYWl0IHtcbiAga2luZDogRWxlbWVudE9yQ29udGFpbmVyT3BzWydraW5kJ107XG5cbiAgLyoqXG4gICAqIGBYcmVmSWRgIGFsbG9jYXRlZCBmb3IgdGhpcyBlbGVtZW50LlxuICAgKlxuICAgKiBUaGlzIElEIGlzIHVzZWQgdG8gcmVmZXJlbmNlIHRoaXMgZWxlbWVudCBmcm9tIG90aGVyIElSIHN0cnVjdHVyZXMuXG4gICAqL1xuICB4cmVmOiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEF0dHJpYnV0ZXMgb2YgdmFyaW91cyBraW5kcyBvbiB0aGlzIGVsZW1lbnQuXG4gICAqXG4gICAqIEJlZm9yZSBhdHRyaWJ1dGUgcHJvY2Vzc2luZywgdGhpcyBpcyBhbiBgRWxlbWVudEF0dHJpYnV0ZXNgIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgdGhlXG4gICAqIGF0dHJpYnV0ZXMgb24gdGhpcyBlbGVtZW50LlxuICAgKlxuICAgKiBBZnRlciBwcm9jZXNzaW5nLCBpdCdzIGEgYENvbnN0SW5kZXhgIHBvaW50ZXIgaW50byB0aGUgc2hhcmVkIGBjb25zdHNgIGFycmF5IG9mIHRoZSBjb21wb25lbnRcbiAgICogY29tcGlsYXRpb24uXG4gICAqL1xuICBhdHRyaWJ1dGVzOiBFbGVtZW50QXR0cmlidXRlc3xDb25zdEluZGV4fG51bGw7XG5cbiAgLyoqXG4gICAqIExvY2FsIHJlZmVyZW5jZXMgdG8gdGhpcyBlbGVtZW50LlxuICAgKlxuICAgKiBCZWZvcmUgbG9jYWwgcmVmIHByb2Nlc3NpbmcsIHRoaXMgaXMgYW4gYXJyYXkgb2YgYExvY2FsUmVmYCBkZWNsYXJhdGlvbnMuXG4gICAqXG4gICAqIEFmdGVyIHByb2Nlc3NpbmcsIGl0J3MgYSBgQ29uc3RJbmRleGAgcG9pbnRlciBpbnRvIHRoZSBzaGFyZWQgYGNvbnN0c2AgYXJyYXkgb2YgdGhlIGNvbXBvbmVudFxuICAgKiBjb21waWxhdGlvbi5cbiAgICovXG4gIGxvY2FsUmVmczogTG9jYWxSZWZbXXxDb25zdEluZGV4fG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWxlbWVudE9wQmFzZSBleHRlbmRzIEVsZW1lbnRPckNvbnRhaW5lck9wQmFzZSB7XG4gIGtpbmQ6IE9wS2luZC5FbGVtZW50fE9wS2luZC5FbGVtZW50U3RhcnR8T3BLaW5kLlRlbXBsYXRlO1xuXG4gIC8qKlxuICAgKiBUaGUgSFRNTCB0YWcgbmFtZSBmb3IgdGhpcyBlbGVtZW50LlxuICAgKi9cbiAgdGFnOiBzdHJpbmc7XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIHRoZSBzdGFydCBvZiBhbiBlbGVtZW50IGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50U3RhcnRPcCBleHRlbmRzIEVsZW1lbnRPcEJhc2Uge1xuICBraW5kOiBPcEtpbmQuRWxlbWVudFN0YXJ0O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBgRWxlbWVudFN0YXJ0T3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRWxlbWVudFN0YXJ0T3AodGFnOiBzdHJpbmcsIHhyZWY6IFhyZWZJZCk6IEVsZW1lbnRTdGFydE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuRWxlbWVudFN0YXJ0LFxuICAgIHhyZWYsXG4gICAgdGFnLFxuICAgIGF0dHJpYnV0ZXM6IG5ldyBFbGVtZW50QXR0cmlidXRlcygpLFxuICAgIGxvY2FsUmVmczogW10sXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfU0xPVCxcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGFuIGVsZW1lbnQgd2l0aCBubyBjaGlsZHJlbiBpbiB0aGUgY3JlYXRpb24gSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRWxlbWVudE9wIGV4dGVuZHMgRWxlbWVudE9wQmFzZSB7XG4gIGtpbmQ6IE9wS2luZC5FbGVtZW50O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBhbiBlbWJlZGRlZCB2aWV3IGRlY2xhcmF0aW9uIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZU9wIGV4dGVuZHMgRWxlbWVudE9wQmFzZSB7XG4gIGtpbmQ6IE9wS2luZC5UZW1wbGF0ZTtcblxuICAvKipcbiAgICogVGhlIG51bWJlciBvZiBkZWNsYXJhdGlvbiBzbG90cyB1c2VkIGJ5IHRoaXMgdGVtcGxhdGUsIG9yIGBudWxsYCBpZiBzbG90cyBoYXZlIG5vdCB5ZXQgYmVlblxuICAgKiBhc3NpZ25lZC5cbiAgICovXG4gIGRlY2xzOiBudW1iZXJ8bnVsbDtcblxuICAvKipcbiAgICogVGhlIG51bWJlciBvZiBiaW5kaW5nIHZhcmlhYmxlIHNsb3RzIHVzZWQgYnkgdGhpcyB0ZW1wbGF0ZSwgb3IgYG51bGxgIGlmIGJpbmRpbmcgdmFyaWFibGVzIGhhdmVcbiAgICogbm90IHlldCBiZWVuIGNvdW50ZWQuXG4gICAqL1xuICB2YXJzOiBudW1iZXJ8bnVsbDtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgVGVtcGxhdGVPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUZW1wbGF0ZU9wKHhyZWY6IFhyZWZJZCwgdGFnOiBzdHJpbmcpOiBUZW1wbGF0ZU9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuVGVtcGxhdGUsXG4gICAgeHJlZixcbiAgICBhdHRyaWJ1dGVzOiBuZXcgRWxlbWVudEF0dHJpYnV0ZXMoKSxcbiAgICB0YWcsXG4gICAgZGVjbHM6IG51bGwsXG4gICAgdmFyczogbnVsbCxcbiAgICBsb2NhbFJlZnM6IFtdLFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1NMT1QsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyB0aGUgZW5kIG9mIGFuIGVsZW1lbnQgc3RydWN0dXJlIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqXG4gKiBQYWlycyB3aXRoIGFuIGBFbGVtZW50U3RhcnRgIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50RW5kT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuRWxlbWVudEVuZDtcblxuICAvKipcbiAgICogVGhlIGBYcmVmSWRgIG9mIHRoZSBlbGVtZW50IGRlY2xhcmVkIHZpYSBgRWxlbWVudFN0YXJ0YC5cbiAgICovXG4gIHhyZWY6IFhyZWZJZDtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYEVsZW1lbnRFbmRPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50RW5kT3AoeHJlZjogWHJlZklkKTogRWxlbWVudEVuZE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuRWxlbWVudEVuZCxcbiAgICB4cmVmLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgdGhlIHN0YXJ0IG9mIGEgY29udGFpbmVyIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb250YWluZXJTdGFydE9wIGV4dGVuZHMgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIHtcbiAga2luZDogT3BLaW5kLkNvbnRhaW5lclN0YXJ0O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBhbiBlbXB0eSBjb250YWluZXIgaW4gdGhlIGNyZWF0aW9uIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnRhaW5lck9wIGV4dGVuZHMgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIHtcbiAga2luZDogT3BLaW5kLkNvbnRhaW5lcjtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgdGhlIGVuZCBvZiBhIGNvbnRhaW5lciBzdHJ1Y3R1cmUgaW4gdGhlIGNyZWF0aW9uIElSLlxuICpcbiAqIFBhaXJzIHdpdGggYW4gYENvbnRhaW5lclN0YXJ0YCBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGFpbmVyRW5kT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuQ29udGFpbmVyRW5kO1xuXG4gIC8qKlxuICAgKiBUaGUgYFhyZWZJZGAgb2YgdGhlIGVsZW1lbnQgZGVjbGFyZWQgdmlhIGBDb250YWluZXJTdGFydGAuXG4gICAqL1xuICB4cmVmOiBYcmVmSWQ7XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGEgdGV4dCBub2RlIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZXh0T3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4sIENvbnN1bWVzU2xvdE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuVGV4dDtcblxuICAvKipcbiAgICogYFhyZWZJZGAgdXNlZCB0byByZWZlcmVuY2UgdGhpcyB0ZXh0IG5vZGUgaW4gb3RoZXIgSVIgc3RydWN0dXJlcy5cbiAgICovXG4gIHhyZWY6IFhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIHN0YXRpYyBpbml0aWFsIHZhbHVlIG9mIHRoZSB0ZXh0IG5vZGUuXG4gICAqL1xuICBpbml0aWFsVmFsdWU6IHN0cmluZztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgVGV4dE9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRPcCh4cmVmOiBYcmVmSWQsIGluaXRpYWxWYWx1ZTogc3RyaW5nKTogVGV4dE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuVGV4dCxcbiAgICB4cmVmLFxuICAgIGluaXRpYWxWYWx1ZSxcbiAgICAuLi5UUkFJVF9DT05TVU1FU19TTE9ULFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYW4gZXZlbnQgbGlzdGVuZXIgb24gYW4gZWxlbWVudCBpbiB0aGUgY3JlYXRpb24gSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdGVuZXJPcCBleHRlbmRzIE9wPENyZWF0ZU9wPiwgVXNlc1Nsb3RJbmRleFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkxpc3RlbmVyO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBldmVudCB3aGljaCBpcyBiZWluZyBsaXN0ZW5lZCB0by5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogVGFnIG5hbWUgb2YgdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhpcyBsaXN0ZW5lciBpcyBwbGFjZWQuXG4gICAqL1xuICB0YWc6IHN0cmluZztcblxuICAvKipcbiAgICogQSBsaXN0IG9mIGBVcGRhdGVPcGBzIHJlcHJlc2VudGluZyB0aGUgYm9keSBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuXG4gICAqL1xuICBoYW5kbGVyT3BzOiBPcExpc3Q8VXBkYXRlT3A+O1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBmdW5jdGlvblxuICAgKi9cbiAgaGFuZGxlckZuTmFtZTogc3RyaW5nfG51bGw7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYExpc3RlbmVyT3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGlzdGVuZXJPcCh0YXJnZXQ6IFhyZWZJZCwgbmFtZTogc3RyaW5nLCB0YWc6IHN0cmluZyk6IExpc3RlbmVyT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5MaXN0ZW5lcixcbiAgICB0YXJnZXQsXG4gICAgdGFnLFxuICAgIG5hbWUsXG4gICAgaGFuZGxlck9wczogbmV3IE9wTGlzdCgpLFxuICAgIGhhbmRsZXJGbk5hbWU6IG51bGwsXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX1VTRVNfU0xPVF9JTkRFWCxcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQaXBlT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4sIENvbnN1bWVzU2xvdE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuUGlwZTtcbiAgeHJlZjogWHJlZklkO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQaXBlT3AoeHJlZjogWHJlZklkLCBuYW1lOiBzdHJpbmcpOiBQaXBlT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5QaXBlLFxuICAgIHhyZWYsXG4gICAgbmFtZSxcbiAgICAuLi5ORVdfT1AsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfU0xPVCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBbiBpbmRleCBpbnRvIHRoZSBgY29uc3RzYCBhcnJheSB3aGljaCBpcyBzaGFyZWQgYWNyb3NzIHRoZSBjb21waWxhdGlvbiBvZiBhbGwgdmlld3MgaW4gYVxuICogY29tcG9uZW50LlxuICovXG5leHBvcnQgdHlwZSBDb25zdEluZGV4ID0gbnVtYmVyJntfX2JyYW5kOiAnQ29uc3RJbmRleCd9O1xuIl19