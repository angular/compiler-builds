/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../../output/output_ast';
import { OpKind } from '../enums';
import { OpList } from '../operations';
import { TRAIT_CONSUMES_SLOT, TRAIT_HAS_CONST, TRAIT_USES_SLOT_INDEX } from '../traits';
import { NEW_OP } from './shared';
/**
 * The set of OpKinds that represent the creation of an element or container
 */
const elementContainerOpKinds = new Set([
    OpKind.Element, OpKind.ElementStart, OpKind.Container, OpKind.ContainerStart, OpKind.Template,
    OpKind.Projection
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
export function createElementStartOp(tag, xref, namespace, i18nPlaceholder, sourceSpan) {
    return {
        kind: OpKind.ElementStart,
        xref,
        tag,
        attributes: null,
        localRefs: [],
        nonBindable: false,
        namespace,
        i18nPlaceholder,
        sourceSpan,
        ...TRAIT_CONSUMES_SLOT,
        ...NEW_OP,
    };
}
/**
 * Create a `TemplateOp`.
 */
export function createTemplateOp(xref, tag, namespace, generatedInBlock, i18nPlaceholder, sourceSpan) {
    return {
        kind: OpKind.Template,
        xref,
        attributes: null,
        tag,
        block: generatedInBlock,
        decls: null,
        vars: null,
        localRefs: [],
        nonBindable: false,
        namespace,
        i18nPlaceholder,
        sourceSpan,
        ...TRAIT_CONSUMES_SLOT,
        ...NEW_OP,
    };
}
/**
 * Create an `ElementEndOp`.
 */
export function createElementEndOp(xref, sourceSpan) {
    return {
        kind: OpKind.ElementEnd,
        xref,
        sourceSpan,
        ...NEW_OP,
    };
}
export function createDisableBindingsOp(xref) {
    return {
        kind: OpKind.DisableBindings,
        xref,
        ...NEW_OP,
    };
}
export function createEnableBindingsOp(xref) {
    return {
        kind: OpKind.EnableBindings,
        xref,
        ...NEW_OP,
    };
}
/**
 * Create a `TextOp`.
 */
export function createTextOp(xref, initialValue, sourceSpan) {
    return {
        kind: OpKind.Text,
        xref,
        initialValue,
        sourceSpan,
        ...TRAIT_CONSUMES_SLOT,
        ...NEW_OP,
    };
}
/**
 * Create a `ListenerOp`. Host bindings reuse all the listener logic.
 */
export function createListenerOp(target, name, tag, animationPhase, hostListener, sourceSpan) {
    return {
        kind: OpKind.Listener,
        target,
        tag,
        hostListener,
        name,
        handlerOps: new OpList(),
        handlerFnName: null,
        consumesDollarEvent: false,
        isAnimationListener: animationPhase !== null,
        animationPhase: animationPhase,
        sourceSpan,
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
/**
 * Whether the active namespace is HTML, MathML, or SVG mode.
 */
export var Namespace;
(function (Namespace) {
    Namespace[Namespace["HTML"] = 0] = "HTML";
    Namespace[Namespace["SVG"] = 1] = "SVG";
    Namespace[Namespace["Math"] = 2] = "Math";
})(Namespace || (Namespace = {}));
export function createNamespaceOp(namespace) {
    return {
        kind: OpKind.Namespace,
        active: namespace,
        ...NEW_OP,
    };
}
export function createProjectionDefOp(def) {
    return {
        kind: OpKind.ProjectionDef,
        def,
        ...NEW_OP,
    };
}
export function createProjectionOp(xref, selector) {
    return {
        kind: OpKind.Projection,
        xref,
        selector,
        projectionSlotIndex: 0,
        attributes: null,
        localRefs: [],
        nonBindable: false,
        sourceSpan: null,
        ...NEW_OP,
        ...TRAIT_CONSUMES_SLOT,
    };
}
/**
 * Create an `ExtractedAttributeOp`.
 */
export function createExtractedAttributeOp(target, bindingKind, name, expression) {
    return {
        kind: OpKind.ExtractedAttribute,
        target,
        bindingKind,
        name,
        expression,
        ...NEW_OP,
    };
}
export function createDeferOp(xref, main, sourceSpan) {
    return {
        kind: OpKind.Defer,
        xref,
        target: main,
        loading: null,
        placeholder: null,
        error: null,
        sourceSpan,
        ...NEW_OP,
        ...TRAIT_CONSUMES_SLOT,
        ...TRAIT_USES_SLOT_INDEX,
    };
}
export function createDeferSecondaryOp(deferOp, secondaryView, secondaryBlockKind) {
    return {
        kind: OpKind.DeferSecondaryBlock,
        deferOp,
        target: secondaryView,
        secondaryBlockKind,
        constValue: null,
        makeExpression: literalOrArrayLiteral,
        ...NEW_OP,
        ...TRAIT_USES_SLOT_INDEX,
        ...TRAIT_HAS_CONST,
    };
}
export function createDeferOnOp(xref, sourceSpan) {
    return {
        kind: OpKind.DeferOn,
        xref,
        sourceSpan,
        ...NEW_OP,
        ...TRAIT_CONSUMES_SLOT,
    };
}
/**
 * Create an `ExtractedMessageOp`.
 */
export function createExtractedMessageOp(owner, expression, statements) {
    return {
        kind: OpKind.ExtractedMessage,
        owner,
        expression,
        statements,
        ...NEW_OP,
    };
}
/**
 * Create an `I18nStartOp`.
 */
export function createI18nStartOp(xref, message, root) {
    return {
        kind: OpKind.I18nStart,
        xref,
        root: root ?? xref,
        message,
        params: new Map(),
        messageIndex: null,
        subTemplateIndex: null,
        needsPostprocessing: false,
        ...NEW_OP,
        ...TRAIT_CONSUMES_SLOT,
    };
}
/**
 * Create an `I18nEndOp`.
 */
export function createI18nEndOp(xref) {
    return {
        kind: OpKind.I18nEnd,
        xref,
        ...NEW_OP,
    };
}
export function literalOrArrayLiteral(value) {
    if (Array.isArray(value)) {
        return o.literalArr(value.map(literalOrArrayLiteral));
    }
    return o.literal(value, o.INFERRED_TYPE);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL2lyL3NyYy9vcHMvY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxDQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFFdEQsT0FBTyxFQUFrQyxNQUFNLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDakUsT0FBTyxFQUFLLE1BQU0sRUFBUyxNQUFNLGVBQWUsQ0FBQztBQUNqRCxPQUFPLEVBQXFDLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxxQkFBcUIsRUFBcUIsTUFBTSxXQUFXLENBQUM7QUFFOUksT0FBTyxFQUFZLE1BQU0sRUFBMEIsTUFBTSxVQUFVLENBQUM7QUFtQnBFOztHQUVHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUN0QyxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxRQUFRO0lBQzdGLE1BQU0sQ0FBQyxVQUFVO0NBQ2xCLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLEVBQVk7SUFDakQsT0FBTyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFrRkQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQ2hDLEdBQVcsRUFBRSxJQUFZLEVBQUUsU0FBb0IsRUFBRSxlQUE4QyxFQUMvRixVQUEyQjtJQUM3QixPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxZQUFZO1FBQ3pCLElBQUk7UUFDSixHQUFHO1FBQ0gsVUFBVSxFQUFFLElBQUk7UUFDaEIs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LENBQUM7QUFDSixDQUFDO0FBY0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUFDLElBQVk7SUFDMUMsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTztRQUNwQixJQUFJO1FBQ0osR0FBRyxNQUFNO0tBQ1YsQ0FBQztBQUNKLENBQUM7QUFRRCxNQUFNLFVBQVUscUJBQXFCLENBQUMsS0FBVTtJQUM5QyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDeEIsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0tBQ3ZEO0lBQ0QsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDM0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdLaW5kLCBEZWZlclNlY29uZGFyeUtpbmQsIE9wS2luZH0gZnJvbSAnLi4vZW51bXMnO1xuaW1wb3J0IHtPcCwgT3BMaXN0LCBYcmVmSWR9IGZyb20gJy4uL29wZXJhdGlvbnMnO1xuaW1wb3J0IHtDb25zdW1lc1Nsb3RPcFRyYWl0LCBIYXNDb25zdFRyYWl0LCBUUkFJVF9DT05TVU1FU19TTE9ULCBUUkFJVF9IQVNfQ09OU1QsIFRSQUlUX1VTRVNfU0xPVF9JTkRFWCwgVXNlc1Nsb3RJbmRleFRyYWl0fSBmcm9tICcuLi90cmFpdHMnO1xuXG5pbXBvcnQge0xpc3RFbmRPcCwgTkVXX09QLCBTdGF0ZW1lbnRPcCwgVmFyaWFibGVPcH0gZnJvbSAnLi9zaGFyZWQnO1xuXG5pbXBvcnQgdHlwZSB7VXBkYXRlT3B9IGZyb20gJy4vdXBkYXRlJztcblxuLyoqXG4gKiBBbiBvcGVyYXRpb24gdXNhYmxlIG9uIHRoZSBjcmVhdGlvbiBzaWRlIG9mIHRoZSBJUi5cbiAqL1xuZXhwb3J0IHR5cGUgQ3JlYXRlT3AgPVxuICAgIExpc3RFbmRPcDxDcmVhdGVPcD58U3RhdGVtZW50T3A8Q3JlYXRlT3A+fEVsZW1lbnRPcHxFbGVtZW50U3RhcnRPcHxFbGVtZW50RW5kT3B8Q29udGFpbmVyT3B8XG4gICAgQ29udGFpbmVyU3RhcnRPcHxDb250YWluZXJFbmRPcHxUZW1wbGF0ZU9wfEVuYWJsZUJpbmRpbmdzT3B8RGlzYWJsZUJpbmRpbmdzT3B8VGV4dE9wfExpc3RlbmVyT3B8XG4gICAgUGlwZU9wfFZhcmlhYmxlT3A8Q3JlYXRlT3A+fE5hbWVzcGFjZU9wfFByb2plY3Rpb25EZWZPcHxQcm9qZWN0aW9uT3B8RXh0cmFjdGVkQXR0cmlidXRlT3B8XG4gICAgRGVmZXJPcHxEZWZlclNlY29uZGFyeUJsb2NrT3B8RGVmZXJPbk9wfEV4dHJhY3RlZE1lc3NhZ2VPcHxJMThuT3B8STE4blN0YXJ0T3B8STE4bkVuZE9wO1xuXG4vKipcbiAqIEFuIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgdGhlIGNyZWF0aW9uIG9mIGFuIGVsZW1lbnQgb3IgY29udGFpbmVyLlxuICovXG5leHBvcnQgdHlwZSBFbGVtZW50T3JDb250YWluZXJPcHMgPVxuICAgIEVsZW1lbnRPcHxFbGVtZW50U3RhcnRPcHxDb250YWluZXJPcHxDb250YWluZXJTdGFydE9wfFRlbXBsYXRlT3B8UHJvamVjdGlvbk9wO1xuXG4vKipcbiAqIFRoZSBzZXQgb2YgT3BLaW5kcyB0aGF0IHJlcHJlc2VudCB0aGUgY3JlYXRpb24gb2YgYW4gZWxlbWVudCBvciBjb250YWluZXJcbiAqL1xuY29uc3QgZWxlbWVudENvbnRhaW5lck9wS2luZHMgPSBuZXcgU2V0KFtcbiAgT3BLaW5kLkVsZW1lbnQsIE9wS2luZC5FbGVtZW50U3RhcnQsIE9wS2luZC5Db250YWluZXIsIE9wS2luZC5Db250YWluZXJTdGFydCwgT3BLaW5kLlRlbXBsYXRlLFxuICBPcEtpbmQuUHJvamVjdGlvblxuXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIG9wZXJhdGlvbiByZXByZXNlbnRzIHRoZSBjcmVhdGlvbiBvZiBhbiBlbGVtZW50IG9yIGNvbnRhaW5lci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3A6IENyZWF0ZU9wKTogb3AgaXMgRWxlbWVudE9yQ29udGFpbmVyT3BzIHtcbiAgcmV0dXJuIGVsZW1lbnRDb250YWluZXJPcEtpbmRzLmhhcyhvcC5raW5kKTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRhdGlvbiBvZiBhIGxvY2FsIHJlZmVyZW5jZSBvbiBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIExvY2FsUmVmIHtcbiAgLyoqXG4gICAqIFVzZXItZGVmaW5lZCBuYW1lIG9mIHRoZSBsb2NhbCByZWYgdmFyaWFibGUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRhcmdldCBvZiB0aGUgbG9jYWwgcmVmZXJlbmNlIHZhcmlhYmxlIChvZnRlbiBgJydgKS5cbiAgICovXG4gIHRhcmdldDogc3RyaW5nO1xufVxuXG4vKipcbiAqIEJhc2UgaW50ZXJmYWNlIGZvciBgRWxlbWVudGAsIGBFbGVtZW50U3RhcnRgLCBhbmQgYFRlbXBsYXRlYCBvcGVyYXRpb25zLCBjb250YWluaW5nIGNvbW1vbiBmaWVsZHNcbiAqIHVzZWQgdG8gcmVwcmVzZW50IHRoZWlyIGVsZW1lbnQtbGlrZSBuYXR1cmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIGV4dGVuZHMgT3A8Q3JlYXRlT3A+LCBDb25zdW1lc1Nsb3RPcFRyYWl0IHtcbiAga2luZDogRWxlbWVudE9yQ29udGFpbmVyT3BzWydraW5kJ107XG5cbiAgLyoqXG4gICAqIGBYcmVmSWRgIGFsbG9jYXRlZCBmb3IgdGhpcyBlbGVtZW50LlxuICAgKlxuICAgKiBUaGlzIElEIGlzIHVzZWQgdG8gcmVmZXJlbmNlIHRoaXMgZWxlbWVudCBmcm9tIG90aGVyIElSIHN0cnVjdHVyZXMuXG4gICAqL1xuICB4cmVmOiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEF0dHJpYnV0ZXMgb2YgdmFyaW91cyBraW5kcyBvbiB0aGlzIGVsZW1lbnQuIFJlcHJlc2VudGVkIGFzIGEgYENvbnN0SW5kZXhgIHBvaW50ZXIgaW50byB0aGVcbiAgICogc2hhcmVkIGBjb25zdHNgIGFycmF5IG9mIHRoZSBjb21wb25lbnQgY29tcGlsYXRpb24uXG4gICAqL1xuICBhdHRyaWJ1dGVzOiBDb25zdEluZGV4fG51bGw7XG5cbiAgLyoqXG4gICAqIExvY2FsIHJlZmVyZW5jZXMgdG8gdGhpcyBlbGVtZW50LlxuICAgKlxuICAgKiBCZWZvcmUgbG9jYWwgcmVmIHByb2Nlc3NpbmcsIHRoaXMgaXMgYW4gYXJyYXkgb2YgYExvY2FsUmVmYCBkZWNsYXJhdGlvbnMuXG4gICAqXG4gICAqIEFmdGVyIHByb2Nlc3NpbmcsIGl0J3MgYSBgQ29uc3RJbmRleGAgcG9pbnRlciBpbnRvIHRoZSBzaGFyZWQgYGNvbnN0c2AgYXJyYXkgb2YgdGhlIGNvbXBvbmVudFxuICAgKiBjb21waWxhdGlvbi5cbiAgICovXG4gIGxvY2FsUmVmczogTG9jYWxSZWZbXXxDb25zdEluZGV4fG51bGw7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhpcyBjb250YWluZXIgaXMgbWFya2VkIGBuZ05vbkJpbmRhYmxlYCwgd2hpY2ggZGlzYWJsZWQgQW5ndWxhciBiaW5kaW5nIGZvciBpdHNlbGYgYW5kXG4gICAqIGFsbCBkZXNjZW5kYW50cy5cbiAgICovXG4gIG5vbkJpbmRhYmxlOiBib29sZWFuO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50T3BCYXNlIGV4dGVuZHMgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIHtcbiAga2luZDogT3BLaW5kLkVsZW1lbnR8T3BLaW5kLkVsZW1lbnRTdGFydHxPcEtpbmQuVGVtcGxhdGU7XG5cbiAgLyoqXG4gICAqIFRoZSBIVE1MIHRhZyBuYW1lIGZvciB0aGlzIGVsZW1lbnQuXG4gICAqL1xuICB0YWc6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbmFtZXNwYWNlIG9mIHRoaXMgZWxlbWVudCwgd2hpY2ggY29udHJvbHMgdGhlIHByZWNlZGluZyBuYW1lc3BhY2UgaW5zdHJ1Y3Rpb24uXG4gICAqL1xuICBuYW1lc3BhY2U6IE5hbWVzcGFjZTtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgdGhlIHN0YXJ0IG9mIGFuIGVsZW1lbnQgaW4gdGhlIGNyZWF0aW9uIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVsZW1lbnRTdGFydE9wIGV4dGVuZHMgRWxlbWVudE9wQmFzZSB7XG4gIGtpbmQ6IE9wS2luZC5FbGVtZW50U3RhcnQ7XG5cbiAgLyoqXG4gICAqIFRoZSBpMThuIHBsYWNlaG9sZGVyIGRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZWxlbWVudC5cbiAgICovXG4gIGkxOG5QbGFjZWhvbGRlcj86IGkxOG4uVGFnUGxhY2Vob2xkZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGBFbGVtZW50U3RhcnRPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50U3RhcnRPcChcbiAgICB0YWc6IHN0cmluZywgeHJlZjogWHJlZklkLCBuYW1lc3BhY2U6IE5hbWVzcGFjZSwgaTE4blBsYWNlaG9sZGVyOiBpMThuLlRhZ1BsYWNlaG9sZGVyfHVuZGVmaW5lZCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBFbGVtZW50U3RhcnRPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkVsZW1lbnRTdGFydCxcbiAgICB4cmVmLFxuICAgIHRhZyxcbiAgICBhdHRyaWJ1dGVzOiBudWxsLFxuICAgIGxvY2FsUmVmczogW10sXG4gICAgbm9uQmluZGFibGU6IGZhbHNlLFxuICAgIG5hbWVzcGFjZSxcbiAgICBpMThuUGxhY2Vob2xkZXIsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5UUkFJVF9DT05TVU1FU19TTE9ULFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYW4gZWxlbWVudCB3aXRoIG5vIGNoaWxkcmVuIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50T3AgZXh0ZW5kcyBFbGVtZW50T3BCYXNlIHtcbiAga2luZDogT3BLaW5kLkVsZW1lbnQ7XG5cbiAgLyoqXG4gICAqIFRoZSBpMThuIHBsYWNlaG9sZGVyIGRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZWxlbWVudC5cbiAgICovXG4gIGkxOG5QbGFjZWhvbGRlcj86IGkxOG4uVGFnUGxhY2Vob2xkZXI7XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGFuIGVtYmVkZGVkIHZpZXcgZGVjbGFyYXRpb24gaW4gdGhlIGNyZWF0aW9uIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRlbXBsYXRlT3AgZXh0ZW5kcyBFbGVtZW50T3BCYXNlIHtcbiAga2luZDogT3BLaW5kLlRlbXBsYXRlO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIGRlY2xhcmF0aW9uIHNsb3RzIHVzZWQgYnkgdGhpcyB0ZW1wbGF0ZSwgb3IgYG51bGxgIGlmIHNsb3RzIGhhdmUgbm90IHlldCBiZWVuXG4gICAqIGFzc2lnbmVkLlxuICAgKi9cbiAgZGVjbHM6IG51bWJlcnxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIGJpbmRpbmcgdmFyaWFibGUgc2xvdHMgdXNlZCBieSB0aGlzIHRlbXBsYXRlLCBvciBgbnVsbGAgaWYgYmluZGluZyB2YXJpYWJsZXMgaGF2ZVxuICAgKiBub3QgeWV0IGJlZW4gY291bnRlZC5cbiAgICovXG4gIHZhcnM6IG51bWJlcnxudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGlzIHRlbXBsYXRlIHdhcyBhdXRvbWF0aWNhbGx5IGNyZWF0ZWQgZm9yIHVzZSB3aXRoIGJsb2NrIHN5bnRheCAoY29udHJvbCBmbG93XG4gICAqIG9yIGRlZmVyKS4gVGhpcyB3aWxsIGV2ZW50dWFsbHkgY2F1c2UgdGhlIGVtaXR0ZWQgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24gdG8gdXNlIGZld2VyIGFyZ3VtZW50cyxcbiAgICogc2luY2Ugc2V2ZXJhbCBvZiB0aGUgZGVmYXVsdCBhcmd1bWVudHMgYXJlIHVubmVjZXNzYXJ5IGZvciBibG9ja3MuXG4gICAqL1xuICBibG9jazogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIGkxOG4gcGxhY2Vob2xkZXIgZGF0YSBhc3NvY2lhdGVkIHdpdGggdGhpcyB0ZW1wbGF0ZS5cbiAgICovXG4gIGkxOG5QbGFjZWhvbGRlcj86IGkxOG4uVGFnUGxhY2Vob2xkZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYFRlbXBsYXRlT3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGVtcGxhdGVPcChcbiAgICB4cmVmOiBYcmVmSWQsIHRhZzogc3RyaW5nfG51bGwsIG5hbWVzcGFjZTogTmFtZXNwYWNlLCBnZW5lcmF0ZWRJbkJsb2NrOiBib29sZWFuLFxuICAgIGkxOG5QbGFjZWhvbGRlcjogaTE4bi5UYWdQbGFjZWhvbGRlcnx1bmRlZmluZWQsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFRlbXBsYXRlT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5UZW1wbGF0ZSxcbiAgICB4cmVmLFxuICAgIGF0dHJpYnV0ZXM6IG51bGwsXG4gICAgdGFnLFxuICAgIGJsb2NrOiBnZW5lcmF0ZWRJbkJsb2NrLFxuICAgIGRlY2xzOiBudWxsLFxuICAgIHZhcnM6IG51bGwsXG4gICAgbG9jYWxSZWZzOiBbXSxcbiAgICBub25CaW5kYWJsZTogZmFsc2UsXG4gICAgbmFtZXNwYWNlLFxuICAgIGkxOG5QbGFjZWhvbGRlcixcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1NMT1QsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyB0aGUgZW5kIG9mIGFuIGVsZW1lbnQgc3RydWN0dXJlIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqXG4gKiBQYWlycyB3aXRoIGFuIGBFbGVtZW50U3RhcnRgIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50RW5kT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuRWxlbWVudEVuZDtcblxuICAvKipcbiAgICogVGhlIGBYcmVmSWRgIG9mIHRoZSBlbGVtZW50IGRlY2xhcmVkIHZpYSBgRWxlbWVudFN0YXJ0YC5cbiAgICovXG4gIHhyZWY6IFhyZWZJZDtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYEVsZW1lbnRFbmRPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50RW5kT3AoeHJlZjogWHJlZklkLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEVsZW1lbnRFbmRPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkVsZW1lbnRFbmQsXG4gICAgeHJlZixcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgdGhlIHN0YXJ0IG9mIGEgY29udGFpbmVyIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb250YWluZXJTdGFydE9wIGV4dGVuZHMgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIHtcbiAga2luZDogT3BLaW5kLkNvbnRhaW5lclN0YXJ0O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBhbiBlbXB0eSBjb250YWluZXIgaW4gdGhlIGNyZWF0aW9uIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnRhaW5lck9wIGV4dGVuZHMgRWxlbWVudE9yQ29udGFpbmVyT3BCYXNlIHtcbiAga2luZDogT3BLaW5kLkNvbnRhaW5lcjtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgdGhlIGVuZCBvZiBhIGNvbnRhaW5lciBzdHJ1Y3R1cmUgaW4gdGhlIGNyZWF0aW9uIElSLlxuICpcbiAqIFBhaXJzIHdpdGggYW4gYENvbnRhaW5lclN0YXJ0YCBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGFpbmVyRW5kT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuQ29udGFpbmVyRW5kO1xuXG4gIC8qKlxuICAgKiBUaGUgYFhyZWZJZGAgb2YgdGhlIGVsZW1lbnQgZGVjbGFyZWQgdmlhIGBDb250YWluZXJTdGFydGAuXG4gICAqL1xuICB4cmVmOiBYcmVmSWQ7XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIGNhdXNpbmcgYmluZGluZyB0byBiZSBkaXNhYmxlZCBpbiBkZXNjZW5kZW50cyBvZiBhIG5vbi1iaW5kYWJsZSBjb250YWluZXIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlzYWJsZUJpbmRpbmdzT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuRGlzYWJsZUJpbmRpbmdzO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgZWxlbWVudCB0aGF0IHdhcyBtYXJrZWQgbm9uLWJpbmRhYmxlLlxuICAgKi9cbiAgeHJlZjogWHJlZklkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlzYWJsZUJpbmRpbmdzT3AoeHJlZjogWHJlZklkKTogRGlzYWJsZUJpbmRpbmdzT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5EaXNhYmxlQmluZGluZ3MsXG4gICAgeHJlZixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gY2F1c2luZyBiaW5kaW5nIHRvIGJlIHJlLWVuYWJsZWQgYWZ0ZXIgdmlzaXRpbmcgZGVzY2VuZGFudHMgb2YgYVxuICogbm9uLWJpbmRhYmxlIGNvbnRhaW5lci5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbmFibGVCaW5kaW5nc09wIGV4dGVuZHMgT3A8Q3JlYXRlT3A+IHtcbiAga2luZDogT3BLaW5kLkVuYWJsZUJpbmRpbmdzO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgZWxlbWVudCB0aGF0IHdhcyBtYXJrZWQgbm9uLWJpbmRhYmxlLlxuICAgKi9cbiAgeHJlZjogWHJlZklkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRW5hYmxlQmluZGluZ3NPcCh4cmVmOiBYcmVmSWQpOiBFbmFibGVCaW5kaW5nc09wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuRW5hYmxlQmluZGluZ3MsXG4gICAgeHJlZixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGEgdGV4dCBub2RlIGluIHRoZSBjcmVhdGlvbiBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZXh0T3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4sIENvbnN1bWVzU2xvdE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuVGV4dDtcblxuICAvKipcbiAgICogYFhyZWZJZGAgdXNlZCB0byByZWZlcmVuY2UgdGhpcyB0ZXh0IG5vZGUgaW4gb3RoZXIgSVIgc3RydWN0dXJlcy5cbiAgICovXG4gIHhyZWY6IFhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIHN0YXRpYyBpbml0aWFsIHZhbHVlIG9mIHRoZSB0ZXh0IG5vZGUuXG4gICAqL1xuICBpbml0aWFsVmFsdWU6IHN0cmluZztcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgVGV4dE9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRPcChcbiAgICB4cmVmOiBYcmVmSWQsIGluaXRpYWxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFRleHRPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLlRleHQsXG4gICAgeHJlZixcbiAgICBpbml0aWFsVmFsdWUsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5UUkFJVF9DT05TVU1FU19TTE9ULFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYW4gZXZlbnQgbGlzdGVuZXIgb24gYW4gZWxlbWVudCBpbiB0aGUgY3JlYXRpb24gSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdGVuZXJPcCBleHRlbmRzIE9wPENyZWF0ZU9wPiwgVXNlc1Nsb3RJbmRleFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkxpc3RlbmVyO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoaXMgbGlzdGVuZXIgaXMgZnJvbSBhIGhvc3QgYmluZGluZy5cbiAgICovXG4gIGhvc3RMaXN0ZW5lcjogYm9vbGVhbjtcblxuICAvKipcbiAgICogTmFtZSBvZiB0aGUgZXZlbnQgd2hpY2ggaXMgYmVpbmcgbGlzdGVuZWQgdG8uXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRhZyBuYW1lIG9mIHRoZSBlbGVtZW50IG9uIHdoaWNoIHRoaXMgbGlzdGVuZXIgaXMgcGxhY2VkLiBNaWdodCBiZSBudWxsLCBpZiB0aGlzIGxpc3RlbmVyXG4gICAqIGJlbG9uZ3MgdG8gYSBob3N0IGJpbmRpbmcuXG4gICAqL1xuICB0YWc6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBBIGxpc3Qgb2YgYFVwZGF0ZU9wYHMgcmVwcmVzZW50aW5nIHRoZSBib2R5IG9mIHRoZSBldmVudCBsaXN0ZW5lci5cbiAgICovXG4gIGhhbmRsZXJPcHM6IE9wTGlzdDxVcGRhdGVPcD47XG5cbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGZ1bmN0aW9uXG4gICAqL1xuICBoYW5kbGVyRm5OYW1lOiBzdHJpbmd8bnVsbDtcblxuICAvKipcbiAgICogV2hldGhlciB0aGlzIGxpc3RlbmVyIGlzIGtub3duIHRvIGNvbnN1bWUgYCRldmVudGAgaW4gaXRzIGJvZHkuXG4gICAqL1xuICBjb25zdW1lc0RvbGxhckV2ZW50OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBsaXN0ZW5lciBpcyBsaXN0ZW5pbmcgZm9yIGFuIGFuaW1hdGlvbiBldmVudC5cbiAgICovXG4gIGlzQW5pbWF0aW9uTGlzdGVuZXI6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBhbmltYXRpb24gcGhhc2Ugb2YgdGhlIGxpc3RlbmVyLlxuICAgKi9cbiAgYW5pbWF0aW9uUGhhc2U6IHN0cmluZ3xudWxsO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgTGlzdGVuZXJPcGAuIEhvc3QgYmluZGluZ3MgcmV1c2UgYWxsIHRoZSBsaXN0ZW5lciBsb2dpYy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgdGFyZ2V0OiBYcmVmSWQsIG5hbWU6IHN0cmluZywgdGFnOiBzdHJpbmd8bnVsbCwgYW5pbWF0aW9uUGhhc2U6IHN0cmluZ3xudWxsLFxuICAgIGhvc3RMaXN0ZW5lcjogYm9vbGVhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogTGlzdGVuZXJPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkxpc3RlbmVyLFxuICAgIHRhcmdldCxcbiAgICB0YWcsXG4gICAgaG9zdExpc3RlbmVyLFxuICAgIG5hbWUsXG4gICAgaGFuZGxlck9wczogbmV3IE9wTGlzdCgpLFxuICAgIGhhbmRsZXJGbk5hbWU6IG51bGwsXG4gICAgY29uc3VtZXNEb2xsYXJFdmVudDogZmFsc2UsXG4gICAgaXNBbmltYXRpb25MaXN0ZW5lcjogYW5pbWF0aW9uUGhhc2UgIT09IG51bGwsXG4gICAgYW5pbWF0aW9uUGhhc2U6IGFuaW1hdGlvblBoYXNlLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX1VTRVNfU0xPVF9JTkRFWCxcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQaXBlT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4sIENvbnN1bWVzU2xvdE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuUGlwZTtcbiAgeHJlZjogWHJlZklkO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQaXBlT3AoeHJlZjogWHJlZklkLCBuYW1lOiBzdHJpbmcpOiBQaXBlT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5QaXBlLFxuICAgIHhyZWYsXG4gICAgbmFtZSxcbiAgICAuLi5ORVdfT1AsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfU0xPVCxcbiAgfTtcbn1cblxuLyoqXG4gKiBXaGV0aGVyIHRoZSBhY3RpdmUgbmFtZXNwYWNlIGlzIEhUTUwsIE1hdGhNTCwgb3IgU1ZHIG1vZGUuXG4gKi9cbmV4cG9ydCBlbnVtIE5hbWVzcGFjZSB7XG4gIEhUTUwsXG4gIFNWRyxcbiAgTWF0aCxcbn1cblxuLyoqXG4gKiBBbiBvcCBjb3JyZXNwb25kaW5nIHRvIGEgbmFtZXNwYWNlIGluc3RydWN0aW9uLCBmb3Igc3dpdGNoaW5nIGJldHdlZW4gSFRNTCwgU1ZHLCBhbmQgTWF0aE1MLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE5hbWVzcGFjZU9wIGV4dGVuZHMgT3A8Q3JlYXRlT3A+IHtcbiAga2luZDogT3BLaW5kLk5hbWVzcGFjZTtcbiAgYWN0aXZlOiBOYW1lc3BhY2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVOYW1lc3BhY2VPcChuYW1lc3BhY2U6IE5hbWVzcGFjZSk6IE5hbWVzcGFjZU9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuTmFtZXNwYWNlLFxuICAgIGFjdGl2ZTogbmFtZXNwYWNlLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBbiBvcCB0aGF0IGNyZWF0ZXMgYSBjb250ZW50IHByb2plY3Rpb24gc2xvdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9qZWN0aW9uRGVmT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuUHJvamVjdGlvbkRlZjtcblxuICAvLyBUaGUgcGFyc2VkIHNlbGVjdG9yIGluZm9ybWF0aW9uIGZvciB0aGlzIHByb2plY3Rpb24gZGVmLlxuICBkZWY6IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUHJvamVjdGlvbkRlZk9wKGRlZjogby5FeHByZXNzaW9ufG51bGwpOiBQcm9qZWN0aW9uRGVmT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5Qcm9qZWN0aW9uRGVmLFxuICAgIGRlZixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogQW4gb3AgdGhhdCBjcmVhdGVzIGEgY29udGVudCBwcm9qZWN0aW9uIHNsb3QuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJvamVjdGlvbk9wIGV4dGVuZHMgT3A8Q3JlYXRlT3A+LCBDb25zdW1lc1Nsb3RPcFRyYWl0LCBFbGVtZW50T3JDb250YWluZXJPcEJhc2Uge1xuICBraW5kOiBPcEtpbmQuUHJvamVjdGlvbjtcblxuICB4cmVmOiBYcmVmSWQ7XG5cbiAgc2xvdDogbnVtYmVyfG51bGw7XG5cbiAgcHJvamVjdGlvblNsb3RJbmRleDogbnVtYmVyO1xuXG4gIHNlbGVjdG9yOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcm9qZWN0aW9uT3AoeHJlZjogWHJlZklkLCBzZWxlY3Rvcjogc3RyaW5nKTogUHJvamVjdGlvbk9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuUHJvamVjdGlvbixcbiAgICB4cmVmLFxuICAgIHNlbGVjdG9yLFxuICAgIHByb2plY3Rpb25TbG90SW5kZXg6IDAsXG4gICAgYXR0cmlidXRlczogbnVsbCxcbiAgICBsb2NhbFJlZnM6IFtdLFxuICAgIG5vbkJpbmRhYmxlOiBmYWxzZSxcbiAgICBzb3VyY2VTcGFuOiBudWxsISwgIC8vIFRPRE9cbiAgICAuLi5ORVdfT1AsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfU0xPVCxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGF0dHJpYnV0ZSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmb3IgaW5jbHVzaW9uIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0cmFjdGVkQXR0cmlidXRlT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlO1xuXG4gIC8qKlxuICAgKiBUaGUgYFhyZWZJZGAgb2YgdGhlIHRlbXBsYXRlLWxpa2UgZWxlbWVudCB0aGUgZXh0cmFjdGVkIGF0dHJpYnV0ZSB3aWxsIGJlbG9uZyB0by5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiAgVGhlIGtpbmQgb2YgYmluZGluZyByZXByZXNlbnRlZCBieSB0aGlzIGV4dHJhY3RlZCBhdHRyaWJ1dGUuXG4gICAqL1xuICBiaW5kaW5nS2luZDogQmluZGluZ0tpbmQ7XG5cbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBleHRyYWN0ZWQgYXR0cmlidXRlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgdmFsdWUgZXhwcmVzc2lvbiBvZiB0aGUgZXh0cmFjdGVkIGF0dHJpYnV0ZS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBgRXh0cmFjdGVkQXR0cmlidXRlT3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgdGFyZ2V0OiBYcmVmSWQsIGJpbmRpbmdLaW5kOiBCaW5kaW5nS2luZCwgbmFtZTogc3RyaW5nLFxuICAgIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsKTogRXh0cmFjdGVkQXR0cmlidXRlT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUsXG4gICAgdGFyZ2V0LFxuICAgIGJpbmRpbmdLaW5kLFxuICAgIG5hbWUsXG4gICAgZXhwcmVzc2lvbixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVmZXJPcCBleHRlbmRzIE9wPENyZWF0ZU9wPiwgQ29uc3VtZXNTbG90T3BUcmFpdCwgVXNlc1Nsb3RJbmRleFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkRlZmVyO1xuXG4gIC8qKlxuICAgKiBUaGUgeHJlZiBvZiB0aGlzIGRlZmVyIG9wLlxuICAgKi9cbiAgeHJlZjogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBUaGUgeHJlZiBvZiB0aGUgbWFpbiB2aWV3LiBUaGlzIHdpbGwgYmUgYXNzb2NpYXRlZCB3aXRoIGBzbG90YC5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBTZWNvbmRhcnkgbG9hZGluZyBibG9jayBhc3NvY2lhdGVkIHdpdGggdGhpcyBkZWZlciBvcC5cbiAgICovXG4gIGxvYWRpbmc6IERlZmVyU2Vjb25kYXJ5QmxvY2tPcHxudWxsO1xuXG4gIC8qKlxuICAgKiBTZWNvbmRhcnkgcGxhY2Vob2xkZXIgYmxvY2sgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZGVmZXIgb3AuXG4gICAqL1xuICBwbGFjZWhvbGRlcjogRGVmZXJTZWNvbmRhcnlCbG9ja09wfG51bGw7XG5cbiAgLyoqXG4gICAqIFNlY29uZGFyeSBlcnJvciBibG9jayBhc3NvY2lhdGVkIHdpdGggdGhpcyBkZWZlciBvcC5cbiAgICovXG4gIGVycm9yOiBEZWZlclNlY29uZGFyeUJsb2NrT3B8bnVsbDtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZWZlck9wKHhyZWY6IFhyZWZJZCwgbWFpbjogWHJlZklkLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBEZWZlck9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuRGVmZXIsXG4gICAgeHJlZixcbiAgICB0YXJnZXQ6IG1haW4sXG4gICAgbG9hZGluZzogbnVsbCxcbiAgICBwbGFjZWhvbGRlcjogbnVsbCxcbiAgICBlcnJvcjogbnVsbCxcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLk5FV19PUCxcbiAgICAuLi5UUkFJVF9DT05TVU1FU19TTE9ULFxuICAgIC4uLlRSQUlUX1VTRVNfU0xPVF9JTkRFWCxcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEZWZlclNlY29uZGFyeUJsb2NrT3AgZXh0ZW5kcyBPcDxDcmVhdGVPcD4sIFVzZXNTbG90SW5kZXhUcmFpdCwgSGFzQ29uc3RUcmFpdCB7XG4gIGtpbmQ6IE9wS2luZC5EZWZlclNlY29uZGFyeUJsb2NrO1xuXG4gIC8qKlxuICAgKiBUaGUgeHJlZiBvZiB0aGUgY29ycmVzcG9uZGluZyBkZWZlciBvcC5cbiAgICovXG4gIGRlZmVyT3A6IFhyZWZJZDtcblxuICAvKipcbiAgICogV2hpY2gga2luZCBvZiBzZWNvbmRhcnkgYmxvY2sgdGhpcyBvcCByZXByZXNlbnRzLlxuICAgKi9cbiAgc2Vjb25kYXJ5QmxvY2tLaW5kOiBEZWZlclNlY29uZGFyeUtpbmQ7XG5cbiAgLyoqXG4gICAqIFRoZSB4cmVmIG9mIHRoZSBzZWNvbmRhcnkgdmlldy4gVGhpcyB3aWxsIGJlIGFzc29jaWF0ZWQgd2l0aCBgc2xvdGAuXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmVyU2Vjb25kYXJ5T3AoXG4gICAgZGVmZXJPcDogWHJlZklkLCBzZWNvbmRhcnlWaWV3OiBYcmVmSWQsXG4gICAgc2Vjb25kYXJ5QmxvY2tLaW5kOiBEZWZlclNlY29uZGFyeUtpbmQpOiBEZWZlclNlY29uZGFyeUJsb2NrT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5EZWZlclNlY29uZGFyeUJsb2NrLFxuICAgIGRlZmVyT3AsXG4gICAgdGFyZ2V0OiBzZWNvbmRhcnlWaWV3LFxuICAgIHNlY29uZGFyeUJsb2NrS2luZCxcbiAgICBjb25zdFZhbHVlOiBudWxsLFxuICAgIG1ha2VFeHByZXNzaW9uOiBsaXRlcmFsT3JBcnJheUxpdGVyYWwsXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX1VTRVNfU0xPVF9JTkRFWCxcbiAgICAuLi5UUkFJVF9IQVNfQ09OU1QsXG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVmZXJPbk9wIGV4dGVuZHMgT3A8Q3JlYXRlT3A+LCBDb25zdW1lc1Nsb3RPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkRlZmVyT247XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJPbk9wKHhyZWY6IFhyZWZJZCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogRGVmZXJPbk9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuRGVmZXJPbixcbiAgICB4cmVmLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1NMT1QsXG4gIH07XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBpMThuIG1lc3NhZ2UgdGhhdCBoYXMgYmVlbiBleHRyYWN0ZWQgZm9yIGluY2x1c2lvbiBpbiB0aGUgY29uc3RzIGFycmF5LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dHJhY3RlZE1lc3NhZ2VPcCBleHRlbmRzIE9wPENyZWF0ZU9wPiB7XG4gIGtpbmQ6IE9wS2luZC5FeHRyYWN0ZWRNZXNzYWdlO1xuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgaTE4biBvcCB0aGlzIG1lc3NhZ2Ugd2FzIGV4dHJhY3RlZCBmcm9tLlxuICAgKi9cbiAgb3duZXI6IFhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIG1lc3NhZ2UgZXhwcmVzc2lvbi5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIHN0YXRlbWVudHMgdG8gY29uc3RydWN0IHRoZSBtZXNzYWdlLlxuICAgKi9cbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYEV4dHJhY3RlZE1lc3NhZ2VPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFeHRyYWN0ZWRNZXNzYWdlT3AoXG4gICAgb3duZXI6IFhyZWZJZCwgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogRXh0cmFjdGVkTWVzc2FnZU9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuRXh0cmFjdGVkTWVzc2FnZSxcbiAgICBvd25lcixcbiAgICBleHByZXNzaW9uLFxuICAgIHN0YXRlbWVudHMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEkxOG5PcEJhc2UgZXh0ZW5kcyBPcDxDcmVhdGVPcD4sIENvbnN1bWVzU2xvdE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuSTE4blN0YXJ0fE9wS2luZC5JMThuO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBhbGxvY2F0ZWQgZm9yIHRoaXMgaTE4biBibG9jay5cbiAgICovXG4gIHhyZWY6IFhyZWZJZDtcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gdGhlIHJvb3QgaTE4biBibG9jayB0aGF0IHRoaXMgb25lIGJlbG9uZ3MgdG8uIEZvciBhIGEgcm9vdCBpMThuIGJsb2NrLCB0aGlzIGlzXG4gICAqIHRoZSBzYW1lIGFzIHhyZWYuXG4gICAqL1xuICByb290OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBpMThuIG1ldGFkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG9wLlxuICAgKi9cbiAgbWVzc2FnZTogaTE4bi5NZXNzYWdlO1xuXG4gIC8qKlxuICAgKiBNYXAgb2YgdmFsdWVzIHRvIHVzZSBmb3IgbmFtZWQgcGxhY2Vob2xkZXJzIGluIHRoZSBpMThuIG1lc3NhZ2UuXG4gICAqL1xuICBwYXJhbXM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj47XG5cbiAgLyoqXG4gICAqIFRoZSBpbmRleCBpbiB0aGUgY29uc3RzIGFycmF5IHdoZXJlIHRoZSBtZXNzYWdlIGkxOG4gbWVzc2FnZSBpcyBzdG9yZWQuXG4gICAqL1xuICBtZXNzYWdlSW5kZXg6IENvbnN0SW5kZXh8bnVsbDtcblxuICAvKipcbiAgICogVGhlIGluZGV4IG9mIHRoaXMgc3ViLWJsb2NrIGluIHRoZSBpMThuIG1lc3NhZ2UuIEZvciBhIHJvb3QgaTE4biBibG9jaywgdGhpcyBpcyBudWxsLlxuICAgKi9cbiAgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGw7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGkxOG4gbWVzc2FnZSByZXF1aXJlcyBwb3N0cHJvY2Vzc2luZy5cbiAgICovXG4gIG5lZWRzUG9zdHByb2Nlc3Npbmc6IGJvb2xlYW47XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBlbXB0eSBpMThuIGJsb2NrLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEkxOG5PcCBleHRlbmRzIEkxOG5PcEJhc2Uge1xuICBraW5kOiBPcEtpbmQuSTE4bjtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBzdGFydCBvZiBhbiBpMThuIGJsb2NrLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEkxOG5TdGFydE9wIGV4dGVuZHMgSTE4bk9wQmFzZSB7XG4gIGtpbmQ6IE9wS2luZC5JMThuU3RhcnQ7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGBJMThuU3RhcnRPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuU3RhcnRPcCh4cmVmOiBYcmVmSWQsIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcm9vdD86IFhyZWZJZCk6IEkxOG5TdGFydE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuSTE4blN0YXJ0LFxuICAgIHhyZWYsXG4gICAgcm9vdDogcm9vdCA/PyB4cmVmLFxuICAgIG1lc3NhZ2UsXG4gICAgcGFyYW1zOiBuZXcgTWFwKCksXG4gICAgbWVzc2FnZUluZGV4OiBudWxsLFxuICAgIHN1YlRlbXBsYXRlSW5kZXg6IG51bGwsXG4gICAgbmVlZHNQb3N0cHJvY2Vzc2luZzogZmFsc2UsXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1NMT1QsXG4gIH07XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgZW5kIG9mIGFuIGkxOG4gYmxvY2suXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bkVuZE9wIGV4dGVuZHMgT3A8Q3JlYXRlT3A+IHtcbiAga2luZDogT3BLaW5kLkkxOG5FbmQ7XG5cbiAgLyoqXG4gICAqIFRoZSBgWHJlZklkYCBvZiB0aGUgYEkxOG5TdGFydE9wYCB0aGF0IGNyZWF0ZWQgdGhpcyBibG9jay5cbiAgICovXG4gIHhyZWY6IFhyZWZJZDtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYEkxOG5FbmRPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuRW5kT3AoeHJlZjogWHJlZklkKTogSTE4bkVuZE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuSTE4bkVuZCxcbiAgICB4cmVmLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBbiBpbmRleCBpbnRvIHRoZSBgY29uc3RzYCBhcnJheSB3aGljaCBpcyBzaGFyZWQgYWNyb3NzIHRoZSBjb21waWxhdGlvbiBvZiBhbGwgdmlld3MgaW4gYVxuICogY29tcG9uZW50LlxuICovXG5leHBvcnQgdHlwZSBDb25zdEluZGV4ID0gbnVtYmVyJntfX2JyYW5kOiAnQ29uc3RJbmRleCd9O1xuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbE9yQXJyYXlMaXRlcmFsKHZhbHVlOiBhbnkpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlLm1hcChsaXRlcmFsT3JBcnJheUxpdGVyYWwpKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsKHZhbHVlLCBvLklORkVSUkVEX1RZUEUpO1xufVxuIl19