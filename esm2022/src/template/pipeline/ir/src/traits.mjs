/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
/**
 * Marker symbol for `ConsumesSlotOpTrait`.
 */
export const ConsumesSlot = Symbol('ConsumesSlot');
/**
 * Marker symbol for `DependsOnSlotContextOpTrait`.
 */
export const DependsOnSlotContext = Symbol('DependsOnSlotContext');
/**
 * Marker symbol for `ConsumesVars` trait.
 */
export const ConsumesVarsTrait = Symbol('ConsumesVars');
/**
 * Marker symbol for `UsesVarOffset` trait.
 */
export const UsesVarOffset = Symbol('UsesVarOffset');
/**
 * Default values for most `ConsumesSlotOpTrait` fields (used with the spread operator to initialize
 * implementors of the trait).
 */
export const TRAIT_CONSUMES_SLOT = {
    [ConsumesSlot]: true,
    numSlotsUsed: 1,
};
/**
 * Default values for most `DependsOnSlotContextOpTrait` fields (used with the spread operator to
 * initialize implementors of the trait).
 */
export const TRAIT_DEPENDS_ON_SLOT_CONTEXT = {
    [DependsOnSlotContext]: true,
};
/**
 * Default values for `UsesVars` fields (used with the spread operator to initialize
 * implementors of the trait).
 */
export const TRAIT_CONSUMES_VARS = {
    [ConsumesVarsTrait]: true,
};
/**
 * Test whether an operation implements `ConsumesSlotOpTrait`.
 */
export function hasConsumesSlotTrait(op) {
    return op[ConsumesSlot] === true;
}
export function hasDependsOnSlotContextTrait(value) {
    return value[DependsOnSlotContext] === true;
}
export function hasConsumesVarsTrait(value) {
    return value[ConsumesVarsTrait] === true;
}
/**
 * Test whether an expression implements `UsesVarOffsetTrait`.
 */
export function hasUsesVarOffsetTrait(expr) {
    return expr[UsesVarOffset] === true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhaXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL2lyL3NyYy90cmFpdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBUUg7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBRW5EOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUcsTUFBTSxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFFbkU7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7QUFFeEQ7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBa0VyRDs7O0dBR0c7QUFDSCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBaUQ7SUFDL0UsQ0FBQyxZQUFZLENBQUMsRUFBRSxJQUFJO0lBQ3BCLFlBQVksRUFBRSxDQUFDO0NBQ1AsQ0FBQztBQUVYOzs7R0FHRztBQUNILE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUd0QztJQUNGLENBQUMsb0JBQW9CLENBQUMsRUFBRSxJQUFJO0NBQ3BCLENBQUM7QUFFWDs7O0dBR0c7QUFDSCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBc0I7SUFDcEQsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLElBQUk7Q0FDakIsQ0FBQztBQUVYOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUNsQyxFQUFPO0lBRVAsT0FBUSxFQUFtQyxDQUFDLFlBQVksQ0FBQyxLQUFLLElBQUksQ0FBQztBQUNyRSxDQUFDO0FBV0QsTUFBTSxVQUFVLDRCQUE0QixDQUFDLEtBQVU7SUFDckQsT0FBUSxLQUE4QyxDQUFDLG9CQUFvQixDQUFDLEtBQUssSUFBSSxDQUFDO0FBQ3hGLENBQUM7QUFTRCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsS0FBVTtJQUM3QyxPQUFRLEtBQW9DLENBQUMsaUJBQWlCLENBQUMsS0FBSyxJQUFJLENBQUM7QUFDM0UsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHFCQUFxQixDQUNuQyxJQUFXO0lBRVgsT0FBUSxJQUFvQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLElBQUksQ0FBQztBQUN2RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuZGV2L2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB0eXBlIHtFeHByZXNzaW9ufSBmcm9tICcuL2V4cHJlc3Npb24nO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgdHlwZSB7T3AsIFhyZWZJZH0gZnJvbSAnLi9vcGVyYXRpb25zJztcbmltcG9ydCB7U2xvdEhhbmRsZX0gZnJvbSAnLi9oYW5kbGUnO1xuXG4vKipcbiAqIE1hcmtlciBzeW1ib2wgZm9yIGBDb25zdW1lc1Nsb3RPcFRyYWl0YC5cbiAqL1xuZXhwb3J0IGNvbnN0IENvbnN1bWVzU2xvdCA9IFN5bWJvbCgnQ29uc3VtZXNTbG90Jyk7XG5cbi8qKlxuICogTWFya2VyIHN5bWJvbCBmb3IgYERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdGAuXG4gKi9cbmV4cG9ydCBjb25zdCBEZXBlbmRzT25TbG90Q29udGV4dCA9IFN5bWJvbCgnRGVwZW5kc09uU2xvdENvbnRleHQnKTtcblxuLyoqXG4gKiBNYXJrZXIgc3ltYm9sIGZvciBgQ29uc3VtZXNWYXJzYCB0cmFpdC5cbiAqL1xuZXhwb3J0IGNvbnN0IENvbnN1bWVzVmFyc1RyYWl0ID0gU3ltYm9sKCdDb25zdW1lc1ZhcnMnKTtcblxuLyoqXG4gKiBNYXJrZXIgc3ltYm9sIGZvciBgVXNlc1Zhck9mZnNldGAgdHJhaXQuXG4gKi9cbmV4cG9ydCBjb25zdCBVc2VzVmFyT2Zmc2V0ID0gU3ltYm9sKCdVc2VzVmFyT2Zmc2V0Jyk7XG5cbi8qKlxuICogTWFya3MgYW4gb3BlcmF0aW9uIGFzIHJlcXVpcmluZyBhbGxvY2F0aW9uIG9mIG9uZSBvciBtb3JlIGRhdGEgc2xvdHMgZm9yIHN0b3JhZ2UuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29uc3VtZXNTbG90T3BUcmFpdCB7XG4gIHJlYWRvbmx5IFtDb25zdW1lc1Nsb3RdOiB0cnVlO1xuXG4gIC8qKlxuICAgKiBBc3NpZ25lZCBkYXRhIHNsb3QgKHRoZSBzdGFydGluZyBpbmRleCwgaWYgbW9yZSB0aGFuIG9uZSBzbG90IGlzIG5lZWRlZCkgZm9yIHRoaXMgb3BlcmF0aW9uLCBvclxuICAgKiBgbnVsbGAgaWYgc2xvdHMgaGF2ZSBub3QgeWV0IGJlZW4gYXNzaWduZWQuXG4gICAqL1xuICBoYW5kbGU6IFNsb3RIYW5kbGU7XG5cbiAgLyoqXG4gICAqIFRoZSBudW1iZXIgb2Ygc2xvdHMgd2hpY2ggd2lsbCBiZSB1c2VkIGJ5IHRoaXMgb3BlcmF0aW9uLiBCeSBkZWZhdWx0IDEsIGJ1dCBjYW4gYmUgaW5jcmVhc2VkIGlmXG4gICAqIG5lY2Vzc2FyeS5cbiAgICovXG4gIG51bVNsb3RzVXNlZDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGlzIG9wZXJhdGlvbiAoZS5nLiB0aGUgZWxlbWVudCBzdG9yZWQgaW4gdGhlIGFzc2lnbmVkIHNsb3QpLiBUaGlzIGBYcmVmSWRgIGlzXG4gICAqIHVzZWQgdG8gbGluayB0aGlzIGBDb25zdW1lc1Nsb3RPcFRyYWl0YCBvcGVyYXRpb24gd2l0aCBgRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdGAgb3JcbiAgICogYFVzZXNTbG90SW5kZXhFeHByVHJhaXRgIGltcGxlbWVudG9ycyBhbmQgZW5zdXJlIHRoYXQgdGhlIGFzc2lnbmVkIHNsb3QgaXMgcHJvcGFnYXRlZCB0aHJvdWdoXG4gICAqIHRoZSBJUiB0byBhbGwgY29uc3VtZXJzLlxuICAgKi9cbiAgeHJlZjogWHJlZklkO1xufVxuXG4vKipcbiAqIE1hcmtzIGFuIG9wZXJhdGlvbiBhcyBkZXBlbmRpbmcgb24gdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvbnRleHQgYmVpbmcgc2V0IHRvIGEgcGFydGljdWxhclxuICogc2xvdC5cbiAqXG4gKiBUaGUgcnVudGltZSBoYXMgYW4gaW1wbGljaXQgc2xvdCBjb250ZXh0IHdoaWNoIGlzIGFkanVzdGVkIHVzaW5nIHRoZSBgYWR2YW5jZSgpYCBpbnN0cnVjdGlvblxuICogZHVyaW5nIHRoZSBleGVjdXRpb24gb2YgdGVtcGxhdGUgdXBkYXRlIGZ1bmN0aW9ucy4gVGhpcyB0cmFpdCBtYXJrcyBhbiBvcGVyYXRpb24gYXMgcmVxdWlyaW5nXG4gKiB0aGlzIGltcGxpY2l0IGNvbnRleHQgdG8gYmUgYGFkdmFuY2UoKWAnZCB0byBwb2ludCBhdCBhIHBhcnRpY3VsYXIgc2xvdCBwcmlvciB0byBleGVjdXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAgcmVhZG9ubHkgW0RlcGVuZHNPblNsb3RDb250ZXh0XTogdHJ1ZTtcblxuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIGBDb25zdW1lc1Nsb3RPcFRyYWl0YCB3aGljaCB0aGUgaW1wbGljaXQgc2xvdCBjb250ZXh0IG11c3QgcmVmZXJlbmNlIGJlZm9yZVxuICAgKiB0aGlzIG9wZXJhdGlvbiBjYW4gYmUgZXhlY3V0ZWQuXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogTWFya2VyIHRyYWl0IGluZGljYXRpbmcgdGhhdCBhbiBvcGVyYXRpb24gb3IgZXhwcmVzc2lvbiBjb25zdW1lcyB2YXJpYWJsZSBzdG9yYWdlIHNwYWNlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnN1bWVzVmFyc1RyYWl0IHtcbiAgW0NvbnN1bWVzVmFyc1RyYWl0XTogdHJ1ZTtcbn1cblxuLyoqXG4gKiBNYXJrZXIgdHJhaXQgaW5kaWNhdGluZyB0aGF0IGFuIGV4cHJlc3Npb24gcmVxdWlyZXMga25vd2xlZGdlIG9mIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc3RvcmFnZVxuICogc2xvdHMgdXNlZCBwcmlvciB0byBpdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBVc2VzVmFyT2Zmc2V0VHJhaXQge1xuICBbVXNlc1Zhck9mZnNldF06IHRydWU7XG5cbiAgdmFyT2Zmc2V0OiBudW1iZXIgfCBudWxsO1xufVxuXG4vKipcbiAqIERlZmF1bHQgdmFsdWVzIGZvciBtb3N0IGBDb25zdW1lc1Nsb3RPcFRyYWl0YCBmaWVsZHMgKHVzZWQgd2l0aCB0aGUgc3ByZWFkIG9wZXJhdG9yIHRvIGluaXRpYWxpemVcbiAqIGltcGxlbWVudG9ycyBvZiB0aGUgdHJhaXQpLlxuICovXG5leHBvcnQgY29uc3QgVFJBSVRfQ09OU1VNRVNfU0xPVDogT21pdDxDb25zdW1lc1Nsb3RPcFRyYWl0LCAneHJlZicgfCAnaGFuZGxlJz4gPSB7XG4gIFtDb25zdW1lc1Nsb3RdOiB0cnVlLFxuICBudW1TbG90c1VzZWQ6IDEsXG59IGFzIGNvbnN0O1xuXG4vKipcbiAqIERlZmF1bHQgdmFsdWVzIGZvciBtb3N0IGBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXRgIGZpZWxkcyAodXNlZCB3aXRoIHRoZSBzcHJlYWQgb3BlcmF0b3IgdG9cbiAqIGluaXRpYWxpemUgaW1wbGVtZW50b3JzIG9mIHRoZSB0cmFpdCkuXG4gKi9cbmV4cG9ydCBjb25zdCBUUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVDogT21pdDxcbiAgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0LFxuICAndGFyZ2V0JyB8ICdzb3VyY2VTcGFuJ1xuPiA9IHtcbiAgW0RlcGVuZHNPblNsb3RDb250ZXh0XTogdHJ1ZSxcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICogRGVmYXVsdCB2YWx1ZXMgZm9yIGBVc2VzVmFyc2AgZmllbGRzICh1c2VkIHdpdGggdGhlIHNwcmVhZCBvcGVyYXRvciB0byBpbml0aWFsaXplXG4gKiBpbXBsZW1lbnRvcnMgb2YgdGhlIHRyYWl0KS5cbiAqL1xuZXhwb3J0IGNvbnN0IFRSQUlUX0NPTlNVTUVTX1ZBUlM6IENvbnN1bWVzVmFyc1RyYWl0ID0ge1xuICBbQ29uc3VtZXNWYXJzVHJhaXRdOiB0cnVlLFxufSBhcyBjb25zdDtcblxuLyoqXG4gKiBUZXN0IHdoZXRoZXIgYW4gb3BlcmF0aW9uIGltcGxlbWVudHMgYENvbnN1bWVzU2xvdE9wVHJhaXRgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFzQ29uc3VtZXNTbG90VHJhaXQ8T3BUIGV4dGVuZHMgT3A8T3BUPj4oXG4gIG9wOiBPcFQsXG4pOiBvcCBpcyBPcFQgJiBDb25zdW1lc1Nsb3RPcFRyYWl0IHtcbiAgcmV0dXJuIChvcCBhcyBQYXJ0aWFsPENvbnN1bWVzU2xvdE9wVHJhaXQ+KVtDb25zdW1lc1Nsb3RdID09PSB0cnVlO1xufVxuXG4vKipcbiAqIFRlc3Qgd2hldGhlciBhbiBvcGVyYXRpb24gaW1wbGVtZW50cyBgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0YC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0RlcGVuZHNPblNsb3RDb250ZXh0VHJhaXQ8RXhwclQgZXh0ZW5kcyBvLkV4cHJlc3Npb24+KFxuICBleHByOiBFeHByVCxcbik6IGV4cHIgaXMgRXhwclQgJiBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXQ7XG5leHBvcnQgZnVuY3Rpb24gaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihcbiAgb3A6IE9wVCxcbik6IG9wIGlzIE9wVCAmIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdDtcbmV4cG9ydCBmdW5jdGlvbiBoYXNEZXBlbmRzT25TbG90Q29udGV4dFRyYWl0KHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuICh2YWx1ZSBhcyBQYXJ0aWFsPERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdD4pW0RlcGVuZHNPblNsb3RDb250ZXh0XSA9PT0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBUZXN0IHdoZXRoZXIgYW4gb3BlcmF0aW9uIGltcGxlbWVudHMgYENvbnN1bWVzVmFyc1RyYWl0YC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0NvbnN1bWVzVmFyc1RyYWl0PEV4cHJUIGV4dGVuZHMgRXhwcmVzc2lvbj4oXG4gIGV4cHI6IEV4cHJULFxuKTogZXhwciBpcyBFeHByVCAmIENvbnN1bWVzVmFyc1RyYWl0O1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0NvbnN1bWVzVmFyc1RyYWl0PE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQpOiBvcCBpcyBPcFQgJiBDb25zdW1lc1ZhcnNUcmFpdDtcbmV4cG9ydCBmdW5jdGlvbiBoYXNDb25zdW1lc1ZhcnNUcmFpdCh2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiAodmFsdWUgYXMgUGFydGlhbDxDb25zdW1lc1ZhcnNUcmFpdD4pW0NvbnN1bWVzVmFyc1RyYWl0XSA9PT0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBUZXN0IHdoZXRoZXIgYW4gZXhwcmVzc2lvbiBpbXBsZW1lbnRzIGBVc2VzVmFyT2Zmc2V0VHJhaXRgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFzVXNlc1Zhck9mZnNldFRyYWl0PEV4cHJUIGV4dGVuZHMgRXhwcmVzc2lvbj4oXG4gIGV4cHI6IEV4cHJULFxuKTogZXhwciBpcyBFeHByVCAmIFVzZXNWYXJPZmZzZXRUcmFpdCB7XG4gIHJldHVybiAoZXhwciBhcyBQYXJ0aWFsPFVzZXNWYXJPZmZzZXRUcmFpdD4pW1VzZXNWYXJPZmZzZXRdID09PSB0cnVlO1xufVxuIl19