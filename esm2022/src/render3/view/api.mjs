/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export var R3TemplateDependencyKind;
(function (R3TemplateDependencyKind) {
    R3TemplateDependencyKind[R3TemplateDependencyKind["Directive"] = 0] = "Directive";
    R3TemplateDependencyKind[R3TemplateDependencyKind["Pipe"] = 1] = "Pipe";
    R3TemplateDependencyKind[R3TemplateDependencyKind["NgModule"] = 2] = "NgModule";
})(R3TemplateDependencyKind || (R3TemplateDependencyKind = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBc1BILE1BQU0sQ0FBTixJQUFZLHdCQUlYO0FBSkQsV0FBWSx3QkFBd0I7SUFDbEMsaUZBQWEsQ0FBQTtJQUNiLHVFQUFRLENBQUE7SUFDUiwrRUFBWSxDQUFBO0FBQ2QsQ0FBQyxFQUpXLHdCQUF3QixLQUF4Qix3QkFBd0IsUUFJbkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgVmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7TWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgUjNSZWZlcmVuY2V9IGZyb20gJy4uL3V0aWwnO1xuXG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIHRvIGNvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBkaXJlY3RpdmUgdHlwZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlOiBSM1JlZmVyZW5jZTtcblxuICAvKipcbiAgICogTnVtYmVyIG9mIGdlbmVyaWMgdHlwZSBwYXJhbWV0ZXJzIG9mIHRoZSB0eXBlIGl0c2VsZi5cbiAgICovXG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEEgc291cmNlIHNwYW4gZm9yIHRoZSBkaXJlY3RpdmUgdHlwZS5cbiAgICovXG4gIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG5cbiAgLyoqXG4gICAqIERlcGVuZGVuY2llcyBvZiB0aGUgZGlyZWN0aXZlJ3MgY29uc3RydWN0b3IuXG4gICAqL1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfCdpbnZhbGlkJ3xudWxsO1xuXG4gIC8qKlxuICAgKiBVbnBhcnNlZCBzZWxlY3RvciBvZiB0aGUgZGlyZWN0aXZlLCBvciBgbnVsbGAgaWYgdGhlcmUgd2FzIG5vIHNlbGVjdG9yLlxuICAgKi9cbiAgc2VsZWN0b3I6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29udGVudCBxdWVyaWVzIG1hZGUgYnkgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHF1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdO1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgdmlldyBxdWVyaWVzIG1hZGUgYnkgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHZpZXdRdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXTtcblxuICAvKipcbiAgICogTWFwcGluZ3MgaW5kaWNhdGluZyBob3cgdGhlIGRpcmVjdGl2ZSBpbnRlcmFjdHMgd2l0aCBpdHMgaG9zdCBlbGVtZW50IChob3N0IGJpbmRpbmdzLFxuICAgKiBsaXN0ZW5lcnMsIGV0YykuXG4gICAqL1xuICBob3N0OiBSM0hvc3RNZXRhZGF0YTtcblxuICAvKipcbiAgICogSW5mb3JtYXRpb24gYWJvdXQgdXNhZ2Ugb2Ygc3BlY2lmaWMgbGlmZWN5Y2xlIGV2ZW50cyB3aGljaCByZXF1aXJlIHNwZWNpYWwgdHJlYXRtZW50IGluIHRoZVxuICAgKiBjb2RlIGdlbmVyYXRvci5cbiAgICovXG4gIGxpZmVjeWNsZToge1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGRpcmVjdGl2ZSB1c2VzIE5nT25DaGFuZ2VzLlxuICAgICAqL1xuICAgIHVzZXNPbkNoYW5nZXM6IGJvb2xlYW47XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBpbnB1dHMgZnJvbSBjbGFzcyBwcm9wZXJ0eSBuYW1lcyB0byBiaW5kaW5nIHByb3BlcnR5IG5hbWVzLCBvciB0byBhIHR1cGxlIG9mXG4gICAqIGJpbmRpbmcgcHJvcGVydHkgbmFtZSBhbmQgY2xhc3MgcHJvcGVydHkgbmFtZSBpZiB0aGUgbmFtZXMgYXJlIGRpZmZlcmVudC5cbiAgICovXG4gIGlucHV0czoge1tmaWVsZDogc3RyaW5nXTogUjNJbnB1dE1ldGFkYXRhfTtcblxuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIG91dHB1dHMgZnJvbSBjbGFzcyBwcm9wZXJ0eSBuYW1lcyB0byBiaW5kaW5nIHByb3BlcnR5IG5hbWVzLCBvciB0byBhIHR1cGxlIG9mXG4gICAqIGJpbmRpbmcgcHJvcGVydHkgbmFtZSBhbmQgY2xhc3MgcHJvcGVydHkgbmFtZSBpZiB0aGUgbmFtZXMgYXJlIGRpZmZlcmVudC5cbiAgICovXG4gIG91dHB1dHM6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ307XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgb3Igbm90IHRoZSBjb21wb25lbnQgb3IgZGlyZWN0aXZlIGluaGVyaXRzIGZyb20gYW5vdGhlciBjbGFzc1xuICAgKi9cbiAgdXNlc0luaGVyaXRhbmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpbmhlcml0cyBpdHMgZW50aXJlIGRlY29yYXRvciBmcm9tIGl0cyBiYXNlIGNsYXNzLlxuICAgKi9cbiAgZnVsbEluaGVyaXRhbmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgbmFtZSB1bmRlciB3aGljaCB0byBleHBvcnQgdGhlIGRpcmVjdGl2ZSdzIHR5cGUgaW4gYSB0ZW1wbGF0ZSxcbiAgICogaWYgYW55LlxuICAgKi9cbiAgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHByb3ZpZGVycyBkZWZpbmVkIGluIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpcyBzdGFuZGFsb25lLlxuICAgKi9cbiAgaXNTdGFuZGFsb25lOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBZGRpdGlvbmFsIGRpcmVjdGl2ZXMgYXBwbGllZCB0byB0aGUgZGlyZWN0aXZlIGhvc3QuXG4gICAqL1xuICBob3N0RGlyZWN0aXZlczogUjNIb3N0RGlyZWN0aXZlTWV0YWRhdGFbXXxudWxsO1xufVxuXG4vKipcbiAqIFNwZWNpZmllcyBob3cgYSBsaXN0IG9mIGRlY2xhcmF0aW9uIHR5cGUgcmVmZXJlbmNlcyBzaG91bGQgYmUgZW1pdHRlZCBpbnRvIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUge1xuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgZGVjbGFyYXRpb25zIGlzIGVtaXR0ZWQgaW50byB0aGUgZ2VuZXJhdGVkIGNvZGUgYXMgaXMuXG4gICAqXG4gICAqIGBgYFxuICAgKiBkaXJlY3RpdmVzOiBbTXlEaXJdLFxuICAgKiBgYGBcbiAgICovXG4gIERpcmVjdCxcblxuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgZGVjbGFyYXRpb25zIGlzIGVtaXR0ZWQgaW50byB0aGUgZ2VuZXJhdGVkIGNvZGUgd3JhcHBlZCBpbnNpZGUgYSBjbG9zdXJlLCB3aGljaFxuICAgKiBpcyBuZWVkZWQgd2hlbiBhdCBsZWFzdCBvbmUgZGVjbGFyYXRpb24gaXMgYSBmb3J3YXJkIHJlZmVyZW5jZS5cbiAgICpcbiAgICogYGBgXG4gICAqIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtNeURpciwgRm9yd2FyZERpcl07IH0sXG4gICAqIGBgYFxuICAgKi9cbiAgQ2xvc3VyZSxcblxuICAvKipcbiAgICogU2ltaWxhciB0byBgQ2xvc3VyZWAsIHdpdGggdGhlIGFkZGl0aW9uIHRoYXQgdGhlIGxpc3Qgb2YgZGVjbGFyYXRpb25zIGNhbiBjb250YWluIGluZGl2aWR1YWxcbiAgICogaXRlbXMgdGhhdCBhcmUgdGhlbXNlbHZlcyBmb3J3YXJkIHJlZmVyZW5jZXMuIFRoaXMgaXMgcmVsZXZhbnQgZm9yIEpJVCBjb21waWxhdGlvbnMsIGFzXG4gICAqIHVud3JhcHBpbmcgdGhlIGZvcndhcmRSZWYgY2Fubm90IGJlIGRvbmUgc3RhdGljYWxseSBzbyBtdXN0IGJlIGRlZmVycmVkLiBUaGlzIG1vZGUgZW1pdHNcbiAgICogdGhlIGRlY2xhcmF0aW9uIGxpc3QgdXNpbmcgYSBtYXBwaW5nIHRyYW5zZm9ybSB0aHJvdWdoIGByZXNvbHZlRm9yd2FyZFJlZmAgdG8gZW5zdXJlIHRoYXRcbiAgICogYW55IGZvcndhcmQgcmVmZXJlbmNlcyB3aXRoaW4gdGhlIGxpc3QgYXJlIHJlc29sdmVkIHdoZW4gdGhlIG91dGVyIGNsb3N1cmUgaXMgaW52b2tlZC5cbiAgICpcbiAgICogQ29uc2lkZXIgdGhlIGNhc2Ugd2hlcmUgdGhlIHJ1bnRpbWUgaGFzIGNhcHR1cmVkIHR3byBkZWNsYXJhdGlvbnMgaW4gdHdvIGRpc3RpbmN0IHZhbHVlczpcbiAgICogYGBgXG4gICAqIGNvbnN0IGRpckEgPSBNeURpcjtcbiAgICogY29uc3QgZGlyQiA9IGZvcndhcmRSZWYoZnVuY3Rpb24oKSB7IHJldHVybiBGb3J3YXJkUmVmOyB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIFRoaXMgbW9kZSB3b3VsZCBlbWl0IHRoZSBkZWNsYXJhdGlvbnMgY2FwdHVyZWQgaW4gYGRpckFgIGFuZCBgZGlyQmAgYXMgZm9sbG93czpcbiAgICogYGBgXG4gICAqIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtkaXJBLCBkaXJCXS5tYXAobmcucmVzb2x2ZUZvcndhcmRSZWYpOyB9LFxuICAgKiBgYGBcbiAgICovXG4gIENsb3N1cmVSZXNvbHZlZCxcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgdG8gY29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NvbXBvbmVudE1ldGFkYXRhPERlY2xhcmF0aW9uVCBleHRlbmRzIFIzVGVtcGxhdGVEZXBlbmRlbmN5PiBleHRlbmRzXG4gICAgUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICB0ZW1wbGF0ZToge1xuICAgIC8qKlxuICAgICAqIFBhcnNlZCBub2RlcyBvZiB0aGUgdGVtcGxhdGUuXG4gICAgICovXG4gICAgbm9kZXM6IHQuTm9kZVtdO1xuXG4gICAgLyoqXG4gICAgICogQW55IG5nLWNvbnRlbnQgc2VsZWN0b3JzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZS4gQ29udGFpbnMgYCpgIHdoZW4gYW4gbmctY29udGVudFxuICAgICAqIGVsZW1lbnQgd2l0aG91dCBzZWxlY3RvciBpcyBwcmVzZW50LlxuICAgICAqL1xuICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG4gIH07XG5cbiAgZGVjbGFyYXRpb25zOiBEZWNsYXJhdGlvblRbXTtcblxuICAvKipcbiAgICogU3BlY2lmaWVzIGhvdyB0aGUgJ2RpcmVjdGl2ZXMnIGFuZC9vciBgcGlwZXNgIGFycmF5LCBpZiBnZW5lcmF0ZWQsIG5lZWQgdG8gYmUgZW1pdHRlZC5cbiAgICovXG4gIGRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTtcblxuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIG9mIHN0eWxpbmcgZGF0YSB0aGF0IHdpbGwgYmUgYXBwbGllZCBhbmQgc2NvcGVkIHRvIHRoZSBjb21wb25lbnQuXG4gICAqL1xuICBzdHlsZXM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBBbiBlbmNhcHN1bGF0aW9uIHBvbGljeSBmb3IgdGhlIGNvbXBvbmVudCdzIHN0eWxpbmcuXG4gICAqIFBvc3NpYmxlIHZhbHVlczpcbiAgICogLSBgVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWRgOiBBcHBseSBtb2RpZmllZCBjb21wb25lbnQgc3R5bGVzIGluIG9yZGVyIHRvIGVtdWxhdGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhIG5hdGl2ZSBTaGFkb3cgRE9NIENTUyBlbmNhcHN1bGF0aW9uIGJlaGF2aW9yLlxuICAgKiAtIGBWaWV3RW5jYXBzdWxhdGlvbi5Ob25lYDogQXBwbHkgY29tcG9uZW50IHN0eWxlcyBnbG9iYWxseSB3aXRob3V0IGFueSBzb3J0IG9mIGVuY2Fwc3VsYXRpb24uXG4gICAqIC0gYFZpZXdFbmNhcHN1bGF0aW9uLlNoYWRvd0RvbWA6IFVzZSB0aGUgYnJvd3NlcidzIG5hdGl2ZSBTaGFkb3cgRE9NIEFQSSB0byBlbmNhcHN1bGF0ZSBzdHlsZXMuXG4gICAqL1xuICBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbjtcblxuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIG9mIGFuaW1hdGlvbiB0cmlnZ2VycyB0aGF0IHdpbGwgYmUgdXNlZCBpbiB0aGUgY29tcG9uZW50IHRlbXBsYXRlLlxuICAgKi9cbiAgYW5pbWF0aW9uczogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHZpZXcgcHJvdmlkZXJzIGRlZmluZWQgaW4gdGhlIGNvbXBvbmVudC5cbiAgICovXG4gIHZpZXdQcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSAudHMgZmlsZSBpbiB3aGljaCB0aGlzIHRlbXBsYXRlJ3MgZ2VuZXJhdGVkIGNvZGUgd2lsbCBiZSBpbmNsdWRlZCwgcmVsYXRpdmUgdG9cbiAgICogdGhlIGNvbXBpbGF0aW9uIHJvb3QuIFRoaXMgd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGlkZW50aWZpZXJzIHRoYXQgbmVlZCB0byBiZSBnbG9iYWxseVxuICAgKiB1bmlxdWUgaW4gY2VydGFpbiBjb250ZXh0cyAoc3VjaCBhcyBnMykuXG4gICAqL1xuICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRyYW5zbGF0aW9uIHZhcmlhYmxlIG5hbWUgc2hvdWxkIGNvbnRhaW4gZXh0ZXJuYWwgbWVzc2FnZSBpZFxuICAgKiAodXNlZCBieSBDbG9zdXJlIENvbXBpbGVyJ3Mgb3V0cHV0IG9mIGBnb29nLmdldE1zZ2AgZm9yIHRyYW5zaXRpb24gcGVyaW9kKS5cbiAgICovXG4gIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbjtcblxuICAvKipcbiAgICogT3ZlcnJpZGVzIHRoZSBkZWZhdWx0IGludGVycG9sYXRpb24gc3RhcnQgYW5kIGVuZCBkZWxpbWl0ZXJzICh7eyBhbmQgfX0pLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICogU3RyYXRlZ3kgdXNlZCBmb3IgZGV0ZWN0aW5nIGNoYW5nZXMgaW4gdGhlIGNvbXBvbmVudC5cbiAgICovXG4gIGNoYW5nZURldGVjdGlvbj86IENoYW5nZURldGVjdGlvblN0cmF0ZWd5O1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIGZvciBhbiBpbmRpdmlkdWFsIGlucHV0IG9uIGEgZGlyZWN0aXZlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5wdXRNZXRhZGF0YSB7XG4gIGNsYXNzUHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gIGJpbmRpbmdQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgcmVxdWlyZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBlbnVtIFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZCB7XG4gIERpcmVjdGl2ZSA9IDAsXG4gIFBpcGUgPSAxLFxuICBOZ01vZHVsZSA9IDIsXG59XG5cbi8qKlxuICogQSBkZXBlbmRlbmN5IHRoYXQncyB1c2VkIHdpdGhpbiBhIGNvbXBvbmVudCB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM1RlbXBsYXRlRGVwZW5kZW5jeSB7XG4gIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZDtcblxuICAvKipcbiAgICogVGhlIHR5cGUgb2YgdGhlIGRlcGVuZGVuY3kgYXMgYW4gZXhwcmVzc2lvbi5cbiAgICovXG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcbn1cblxuLyoqXG4gKiBBIGRlcGVuZGVuY3kgdGhhdCdzIHVzZWQgd2l0aGluIGEgY29tcG9uZW50IHRlbXBsYXRlXG4gKi9cbmV4cG9ydCB0eXBlIFIzVGVtcGxhdGVEZXBlbmRlbmN5TWV0YWRhdGEgPVxuICAgIFIzRGlyZWN0aXZlRGVwZW5kZW5jeU1ldGFkYXRhfFIzUGlwZURlcGVuZGVuY3lNZXRhZGF0YXxSM05nTW9kdWxlRGVwZW5kZW5jeU1ldGFkYXRhO1xuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IGEgZGlyZWN0aXZlIHRoYXQgaXMgdXNlZCBpbiBhIGNvbXBvbmVudCB0ZW1wbGF0ZS4gT25seSB0aGUgc3RhYmxlLCBwdWJsaWNcbiAqIGZhY2luZyBpbmZvcm1hdGlvbiBvZiB0aGUgZGlyZWN0aXZlIGlzIHN0b3JlZCBoZXJlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGlyZWN0aXZlRGVwZW5kZW5jeU1ldGFkYXRhIGV4dGVuZHMgUjNUZW1wbGF0ZURlcGVuZGVuY3kge1xuICBraW5kOiBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQuRGlyZWN0aXZlO1xuXG4gIC8qKlxuICAgKiBUaGUgc2VsZWN0b3Igb2YgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHNlbGVjdG9yOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIHByb3BlcnR5IG5hbWVzIG9mIHRoZSBpbnB1dHMgb2YgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIGlucHV0czogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIHByb3BlcnR5IG5hbWVzIG9mIHRoZSBvdXRwdXRzIG9mIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBvdXRwdXRzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogTmFtZSB1bmRlciB3aGljaCB0aGUgZGlyZWN0aXZlIGlzIGV4cG9ydGVkLCBpZiBhbnkgKGV4cG9ydEFzIGluIEFuZ3VsYXIpLiBOdWxsIG90aGVyd2lzZS5cbiAgICovXG4gIGV4cG9ydEFzOiBzdHJpbmdbXXxudWxsO1xuXG4gIC8qKlxuICAgKiBJZiB0cnVlIHRoZW4gdGhpcyBkaXJlY3RpdmUgaXMgYWN0dWFsbHkgYSBjb21wb25lbnQ7IG90aGVyd2lzZSBpdCBpcyBub3QuXG4gICAqL1xuICBpc0NvbXBvbmVudDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM1BpcGVEZXBlbmRlbmN5TWV0YWRhdGEgZXh0ZW5kcyBSM1RlbXBsYXRlRGVwZW5kZW5jeSB7XG4gIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5QaXBlO1xuXG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM05nTW9kdWxlRGVwZW5kZW5jeU1ldGFkYXRhIGV4dGVuZHMgUjNUZW1wbGF0ZURlcGVuZGVuY3kge1xuICBraW5kOiBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQuTmdNb2R1bGU7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIHRvIGNvbXBpbGUgYSBxdWVyeSAodmlldyBvciBjb250ZW50KS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM1F1ZXJ5TWV0YWRhdGEge1xuICAvKipcbiAgICogTmFtZSBvZiB0aGUgcHJvcGVydHkgb24gdGhlIGNsYXNzIHRvIHVwZGF0ZSB3aXRoIHF1ZXJ5IHJlc3VsdHMuXG4gICAqL1xuICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogV2hldGhlciB0byByZWFkIG9ubHkgdGhlIGZpcnN0IG1hdGNoaW5nIHJlc3VsdCwgb3IgYW4gYXJyYXkgb2YgcmVzdWx0cy5cbiAgICovXG4gIGZpcnN0OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBFaXRoZXIgYW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSB0eXBlIG9yIGBJbmplY3Rpb25Ub2tlbmAgZm9yIHRoZSBxdWVyeVxuICAgKiBwcmVkaWNhdGUsIG9yIGEgc2V0IG9mIHN0cmluZyBzZWxlY3RvcnMuXG4gICAqL1xuICBwcmVkaWNhdGU6IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb258c3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gaW5jbHVkZSBvbmx5IGRpcmVjdCBjaGlsZHJlbiBvciBhbGwgZGVzY2VuZGFudHMuXG4gICAqL1xuICBkZXNjZW5kYW50czogYm9vbGVhbjtcblxuICAvKipcbiAgICogSWYgdGhlIGBRdWVyeUxpc3RgIHNob3VsZCBmaXJlIGNoYW5nZSBldmVudCBvbmx5IGlmIGFjdHVhbCBjaGFuZ2UgdG8gcXVlcnkgd2FzIGNvbXB1dGVkICh2cyBvbGRcbiAgICogYmVoYXZpb3Igd2hlcmUgdGhlIGNoYW5nZSB3YXMgZmlyZWQgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHdhcyByZWNvbXB1dGVkLCBldmVuIGlmIHRoZSByZWNvbXB1dGVkXG4gICAqIHF1ZXJ5IHJlc3VsdGVkIGluIHRoZSBzYW1lIGxpc3QuKVxuICAgKi9cbiAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgdHlwZSB0byByZWFkIGZyb20gZWFjaCBtYXRjaGVkIG5vZGUsIG9yIG51bGwgaWYgdGhlIGRlZmF1bHQgdmFsdWVcbiAgICogZm9yIGEgZ2l2ZW4gbm9kZSBpcyB0byBiZSByZXR1cm5lZC5cbiAgICovXG4gIHJlYWQ6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGlzIHF1ZXJ5IHNob3VsZCBjb2xsZWN0IG9ubHkgc3RhdGljIHJlc3VsdHMuXG4gICAqXG4gICAqIElmIHN0YXRpYyBpcyB0cnVlLCB0aGUgcXVlcnkncyByZXN1bHRzIHdpbGwgYmUgc2V0IG9uIHRoZSBjb21wb25lbnQgYWZ0ZXIgbm9kZXMgYXJlIGNyZWF0ZWQsXG4gICAqIGJ1dCBiZWZvcmUgY2hhbmdlIGRldGVjdGlvbiBydW5zLiBUaGlzIG1lYW5zIHRoYXQgYW55IHJlc3VsdHMgdGhhdCByZWxpZWQgdXBvbiBjaGFuZ2UgZGV0ZWN0aW9uXG4gICAqIHRvIHJ1biAoZS5nLiByZXN1bHRzIGluc2lkZSAqbmdJZiBvciAqbmdGb3Igdmlld3MpIHdpbGwgbm90IGJlIGNvbGxlY3RlZC4gUXVlcnkgcmVzdWx0cyBhcmVcbiAgICogYXZhaWxhYmxlIGluIHRoZSBuZ09uSW5pdCBob29rLlxuICAgKlxuICAgKiBJZiBzdGF0aWMgaXMgZmFsc2UsIHRoZSBxdWVyeSdzIHJlc3VsdHMgd2lsbCBiZSBzZXQgb24gdGhlIGNvbXBvbmVudCBhZnRlciBjaGFuZ2UgZGV0ZWN0aW9uXG4gICAqIHJ1bnMuIFRoaXMgbWVhbnMgdGhhdCB0aGUgcXVlcnkgcmVzdWx0cyBjYW4gY29udGFpbiBub2RlcyBpbnNpZGUgKm5nSWYgb3IgKm5nRm9yIHZpZXdzLCBidXRcbiAgICogdGhlIHJlc3VsdHMgd2lsbCBub3QgYmUgYXZhaWxhYmxlIGluIHRoZSBuZ09uSW5pdCBob29rIChvbmx5IGluIHRoZSBuZ0FmdGVyQ29udGVudEluaXQgZm9yXG4gICAqIGNvbnRlbnQgaG9va3MgYW5kIG5nQWZ0ZXJWaWV3SW5pdCBmb3IgdmlldyBob29rcykuXG4gICAqL1xuICBzdGF0aWM6IGJvb2xlYW47XG59XG5cbi8qKlxuICogTWFwcGluZ3MgaW5kaWNhdGluZyBob3cgdGhlIGNsYXNzIGludGVyYWN0cyB3aXRoIGl0c1xuICogaG9zdCBlbGVtZW50IChob3N0IGJpbmRpbmdzLCBsaXN0ZW5lcnMsIGV0YykuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNIb3N0TWV0YWRhdGEge1xuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIGF0dHJpYnV0ZSBiaW5kaW5nIGtleXMgdG8gYG8uRXhwcmVzc2lvbmBzLlxuICAgKi9cbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG5cbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBldmVudCBiaW5kaW5nIGtleXMgdG8gdW5wYXJzZWQgZXhwcmVzc2lvbnMuXG4gICAqL1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgb2YgcHJvcGVydHkgYmluZGluZyBrZXlzIHRvIHVucGFyc2VkIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG5cbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG5lZWRlZCB0byBjb21waWxlIGEgaG9zdCBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNIb3N0RGlyZWN0aXZlTWV0YWRhdGEge1xuICAvKiogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIGhvc3QgZGlyZWN0aXZlIGNsYXNzIGl0c2VsZi4gKi9cbiAgZGlyZWN0aXZlOiBSM1JlZmVyZW5jZTtcblxuICAvKiogV2hldGhlciB0aGUgZXhwcmVzc2lvbiByZWZlcnJpbmcgdG8gdGhlIGhvc3QgZGlyZWN0aXZlIGlzIGEgZm9yd2FyZCByZWZlcmVuY2UuICovXG4gIGlzRm9yd2FyZFJlZmVyZW5jZTogYm9vbGVhbjtcblxuICAvKiogSW5wdXRzIGZyb20gdGhlIGhvc3QgZGlyZWN0aXZlIHRoYXQgd2lsbCBiZSBleHBvc2VkIG9uIHRoZSBob3N0LiAqL1xuICBpbnB1dHM6IHtbcHVibGljTmFtZTogc3RyaW5nXTogc3RyaW5nfXxudWxsO1xuXG4gIC8qKiBPdXRwdXRzIGZyb20gdGhlIGhvc3QgZGlyZWN0aXZlIHRoYXQgd2lsbCBiZSBleHBvc2VkIG9uIHRoZSBob3N0LiAqL1xuICBvdXRwdXRzOiB7W3B1YmxpY05hbWU6IHN0cmluZ106IHN0cmluZ318bnVsbDtcbn1cbiJdfQ==