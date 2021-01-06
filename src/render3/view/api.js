/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/api", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge1IzUmVmZXJlbmNlfSBmcm9tICcuLi91dGlsJztcblxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG5lZWRlZCB0byBjb21waWxlIGEgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICAvKipcbiAgICogTmFtZSBvZiB0aGUgZGlyZWN0aXZlIHR5cGUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBkaXJlY3RpdmUgaXRzZWxmLlxuICAgKi9cbiAgdHlwZTogUjNSZWZlcmVuY2U7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBkaXJlY3RpdmUgYmVpbmcgY29tcGlsZWQsIGludGVuZGVkIGZvciB1c2Ugd2l0aGluXG4gICAqIGEgY2xhc3MgZGVmaW5pdGlvbiBpdHNlbGYuXG4gICAqXG4gICAqIFRoaXMgY2FuIGRpZmZlciBmcm9tIHRoZSBvdXRlciBgdHlwZWAgaWYgdGhlIGNsYXNzIGlzIGJlaW5nIGNvbXBpbGVkIGJ5IG5nY2MgYW5kIGlzIGluc2lkZVxuICAgKiBhbiBJSUZFIHN0cnVjdHVyZSB0aGF0IHVzZXMgYSBkaWZmZXJlbnQgbmFtZSBpbnRlcm5hbGx5LlxuICAgKi9cbiAgaW50ZXJuYWxUeXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBnZW5lcmljIHR5cGUgcGFyYW1ldGVycyBvZiB0aGUgdHlwZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBBIHNvdXJjZSBzcGFuIGZvciB0aGUgZGlyZWN0aXZlIHR5cGUuXG4gICAqL1xuICB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuXG4gIC8qKlxuICAgKiBEZXBlbmRlbmNpZXMgb2YgdGhlIGRpcmVjdGl2ZSdzIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXwnaW52YWxpZCd8bnVsbDtcblxuICAvKipcbiAgICogVW5wYXJzZWQgc2VsZWN0b3Igb2YgdGhlIGRpcmVjdGl2ZSwgb3IgYG51bGxgIGlmIHRoZXJlIHdhcyBubyBzZWxlY3Rvci5cbiAgICovXG4gIHNlbGVjdG9yOiBzdHJpbmd8bnVsbDtcblxuICAvKipcbiAgICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIGNvbnRlbnQgcXVlcmllcyBtYWRlIGJ5IHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBxdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXTtcblxuICAvKipcbiAgICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIHZpZXcgcXVlcmllcyBtYWRlIGJ5IHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW107XG5cbiAgLyoqXG4gICAqIE1hcHBpbmdzIGluZGljYXRpbmcgaG93IHRoZSBkaXJlY3RpdmUgaW50ZXJhY3RzIHdpdGggaXRzIGhvc3QgZWxlbWVudCAoaG9zdCBiaW5kaW5ncyxcbiAgICogbGlzdGVuZXJzLCBldGMpLlxuICAgKi9cbiAgaG9zdDogUjNIb3N0TWV0YWRhdGE7XG5cbiAgLyoqXG4gICAqIEluZm9ybWF0aW9uIGFib3V0IHVzYWdlIG9mIHNwZWNpZmljIGxpZmVjeWNsZSBldmVudHMgd2hpY2ggcmVxdWlyZSBzcGVjaWFsIHRyZWF0bWVudCBpbiB0aGVcbiAgICogY29kZSBnZW5lcmF0b3IuXG4gICAqL1xuICBsaWZlY3ljbGU6IHtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBkaXJlY3RpdmUgdXNlcyBOZ09uQ2hhbmdlcy5cbiAgICAgKi9cbiAgICB1c2VzT25DaGFuZ2VzOiBib29sZWFuO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgb2YgaW5wdXRzIGZyb20gY2xhc3MgcHJvcGVydHkgbmFtZXMgdG8gYmluZGluZyBwcm9wZXJ0eSBuYW1lcywgb3IgdG8gYSB0dXBsZSBvZlxuICAgKiBiaW5kaW5nIHByb3BlcnR5IG5hbWUgYW5kIGNsYXNzIHByb3BlcnR5IG5hbWUgaWYgdGhlIG5hbWVzIGFyZSBkaWZmZXJlbnQuXG4gICAqL1xuICBpbnB1dHM6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ3xbc3RyaW5nLCBzdHJpbmddfTtcblxuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIG91dHB1dHMgZnJvbSBjbGFzcyBwcm9wZXJ0eSBuYW1lcyB0byBiaW5kaW5nIHByb3BlcnR5IG5hbWVzLCBvciB0byBhIHR1cGxlIG9mXG4gICAqIGJpbmRpbmcgcHJvcGVydHkgbmFtZSBhbmQgY2xhc3MgcHJvcGVydHkgbmFtZSBpZiB0aGUgbmFtZXMgYXJlIGRpZmZlcmVudC5cbiAgICovXG4gIG91dHB1dHM6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ307XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgb3Igbm90IHRoZSBjb21wb25lbnQgb3IgZGlyZWN0aXZlIGluaGVyaXRzIGZyb20gYW5vdGhlciBjbGFzc1xuICAgKi9cbiAgdXNlc0luaGVyaXRhbmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpbmhlcml0cyBpdHMgZW50aXJlIGRlY29yYXRvciBmcm9tIGl0cyBiYXNlIGNsYXNzLlxuICAgKi9cbiAgZnVsbEluaGVyaXRhbmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgbmFtZSB1bmRlciB3aGljaCB0byBleHBvcnQgdGhlIGRpcmVjdGl2ZSdzIHR5cGUgaW4gYSB0ZW1wbGF0ZSxcbiAgICogaWYgYW55LlxuICAgKi9cbiAgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHByb3ZpZGVycyBkZWZpbmVkIGluIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIFNwZWNpZmllcyBob3cgYSBsaXN0IG9mIGRlY2xhcmF0aW9uIHR5cGUgcmVmZXJlbmNlcyBzaG91bGQgYmUgZW1pdHRlZCBpbnRvIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUge1xuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgZGVjbGFyYXRpb25zIGlzIGVtaXR0ZWQgaW50byB0aGUgZ2VuZXJhdGVkIGNvZGUgYXMgaXMuXG4gICAqXG4gICAqIGBgYFxuICAgKiBkaXJlY3RpdmVzOiBbTXlEaXJdLFxuICAgKiBgYGBcbiAgICovXG4gIERpcmVjdCxcblxuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgZGVjbGFyYXRpb25zIGlzIGVtaXR0ZWQgaW50byB0aGUgZ2VuZXJhdGVkIGNvZGUgd3JhcHBlZCBpbnNpZGUgYSBjbG9zdXJlLCB3aGljaFxuICAgKiBpcyBuZWVkZWQgd2hlbiBhdCBsZWFzdCBvbmUgZGVjbGFyYXRpb24gaXMgYSBmb3J3YXJkIHJlZmVyZW5jZS5cbiAgICpcbiAgICogYGBgXG4gICAqIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtNeURpciwgRm9yd2FyZERpcl07IH0sXG4gICAqIGBgYFxuICAgKi9cbiAgQ2xvc3VyZSxcblxuICAvKipcbiAgICogU2ltaWxhciB0byBgQ2xvc3VyZWAsIHdpdGggdGhlIGFkZGl0aW9uIHRoYXQgdGhlIGxpc3Qgb2YgZGVjbGFyYXRpb25zIGNhbiBjb250YWluIGluZGl2aWR1YWxcbiAgICogaXRlbXMgdGhhdCBhcmUgdGhlbXNlbHZlcyBmb3J3YXJkIHJlZmVyZW5jZXMuIFRoaXMgaXMgcmVsZXZhbnQgZm9yIEpJVCBjb21waWxhdGlvbnMsIGFzXG4gICAqIHVud3JhcHBpbmcgdGhlIGZvcndhcmRSZWYgY2Fubm90IGJlIGRvbmUgc3RhdGljYWxseSBzbyBtdXN0IGJlIGRlZmVycmVkLiBUaGlzIG1vZGUgZW1pdHNcbiAgICogdGhlIGRlY2xhcmF0aW9uIGxpc3QgdXNpbmcgYSBtYXBwaW5nIHRyYW5zZm9ybSB0aHJvdWdoIGByZXNvbHZlRm9yd2FyZFJlZmAgdG8gZW5zdXJlIHRoYXRcbiAgICogYW55IGZvcndhcmQgcmVmZXJlbmNlcyB3aXRoaW4gdGhlIGxpc3QgYXJlIHJlc29sdmVkIHdoZW4gdGhlIG91dGVyIGNsb3N1cmUgaXMgaW52b2tlZC5cbiAgICpcbiAgICogQ29uc2lkZXIgdGhlIGNhc2Ugd2hlcmUgdGhlIHJ1bnRpbWUgaGFzIGNhcHR1cmVkIHR3byBkZWNsYXJhdGlvbnMgaW4gdHdvIGRpc3RpbmN0IHZhbHVlczpcbiAgICogYGBgXG4gICAqIGNvbnN0IGRpckEgPSBNeURpcjtcbiAgICogY29uc3QgZGlyQiA9IGZvcndhcmRSZWYoZnVuY3Rpb24oKSB7IHJldHVybiBGb3J3YXJkUmVmOyB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIFRoaXMgbW9kZSB3b3VsZCBlbWl0IHRoZSBkZWNsYXJhdGlvbnMgY2FwdHVyZWQgaW4gYGRpckFgIGFuZCBgZGlyQmAgYXMgZm9sbG93czpcbiAgICogYGBgXG4gICAqIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtkaXJBLCBkaXJCXS5tYXAobmcucmVzb2x2ZUZvcndhcmRSZWYpOyB9LFxuICAgKiBgYGBcbiAgICovXG4gIENsb3N1cmVSZXNvbHZlZCxcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgdG8gY29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NvbXBvbmVudE1ldGFkYXRhIGV4dGVuZHMgUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICB0ZW1wbGF0ZToge1xuICAgIC8qKlxuICAgICAqIFBhcnNlZCBub2RlcyBvZiB0aGUgdGVtcGxhdGUuXG4gICAgICovXG4gICAgbm9kZXM6IHQuTm9kZVtdO1xuXG4gICAgLyoqXG4gICAgICogQW55IG5nLWNvbnRlbnQgc2VsZWN0b3JzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZS4gQ29udGFpbnMgYG51bGxgIHdoZW4gYW4gbmctY29udGVudFxuICAgICAqIGVsZW1lbnQgd2l0aG91dCBzZWxlY3RvciBpcyBwcmVzZW50LlxuICAgICAqL1xuICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgbWFwIG9mIHBpcGUgbmFtZXMgdG8gYW4gZXhwcmVzc2lvbiByZWZlcmVuY2luZyB0aGUgcGlwZSB0eXBlIHdoaWNoIGFyZSBpbiB0aGUgc2NvcGUgb2YgdGhlXG4gICAqIGNvbXBpbGF0aW9uLlxuICAgKi9cbiAgcGlwZXM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj47XG5cbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBkaXJlY3RpdmUgc2VsZWN0b3JzIGFuZCBhbiBleHByZXNzaW9uIHJlZmVyZW5jaW5nIHRoZSBkaXJlY3RpdmUgdHlwZSB3aGljaCBhcmUgaW4gdGhlXG4gICAqIHNjb3BlIG9mIHRoZSBjb21waWxhdGlvbi5cbiAgICovXG4gIGRpcmVjdGl2ZXM6IFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhW107XG5cbiAgLyoqXG4gICAqIFNwZWNpZmllcyBob3cgdGhlICdkaXJlY3RpdmVzJyBhbmQvb3IgYHBpcGVzYCBhcnJheSwgaWYgZ2VuZXJhdGVkLCBuZWVkIHRvIGJlIGVtaXR0ZWQuXG4gICAqL1xuICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGU7XG5cbiAgLyoqXG4gICAqIEEgY29sbGVjdGlvbiBvZiBzdHlsaW5nIGRhdGEgdGhhdCB3aWxsIGJlIGFwcGxpZWQgYW5kIHNjb3BlZCB0byB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgc3R5bGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW4gZW5jYXBzdWxhdGlvbiBwb2xpY3kgZm9yIHRoZSB0ZW1wbGF0ZSBhbmQgQ1NTIHN0eWxlcy4gT25lIG9mOlxuICAgKiAtIGBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZGA6IFVzZSBzaGltbWVkIENTUyB0aGF0IGVtdWxhdGVzIHRoZSBuYXRpdmUgYmVoYXZpb3IuXG4gICAqIC0gYFZpZXdFbmNhcHN1bGF0aW9uLk5vbmVgOiBVc2UgZ2xvYmFsIENTUyB3aXRob3V0IGFueSBlbmNhcHN1bGF0aW9uLlxuICAgKiAtIGBWaWV3RW5jYXBzdWxhdGlvbi5TaGFkb3dEb21gOiBVc2UgdGhlIGxhdGVzdCBTaGFkb3dET00gQVBJIHRvIG5hdGl2ZWx5IGVuY2Fwc3VsYXRlIHN0eWxlc1xuICAgKiBpbnRvIGEgc2hhZG93IHJvb3QuXG4gICAqL1xuICBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbjtcblxuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIG9mIGFuaW1hdGlvbiB0cmlnZ2VycyB0aGF0IHdpbGwgYmUgdXNlZCBpbiB0aGUgY29tcG9uZW50IHRlbXBsYXRlLlxuICAgKi9cbiAgYW5pbWF0aW9uczogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHZpZXcgcHJvdmlkZXJzIGRlZmluZWQgaW4gdGhlIGNvbXBvbmVudC5cbiAgICovXG4gIHZpZXdQcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSAudHMgZmlsZSBpbiB3aGljaCB0aGlzIHRlbXBsYXRlJ3MgZ2VuZXJhdGVkIGNvZGUgd2lsbCBiZSBpbmNsdWRlZCwgcmVsYXRpdmUgdG9cbiAgICogdGhlIGNvbXBpbGF0aW9uIHJvb3QuIFRoaXMgd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGlkZW50aWZpZXJzIHRoYXQgbmVlZCB0byBiZSBnbG9iYWxseVxuICAgKiB1bmlxdWUgaW4gY2VydGFpbiBjb250ZXh0cyAoc3VjaCBhcyBnMykuXG4gICAqL1xuICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRyYW5zbGF0aW9uIHZhcmlhYmxlIG5hbWUgc2hvdWxkIGNvbnRhaW4gZXh0ZXJuYWwgbWVzc2FnZSBpZFxuICAgKiAodXNlZCBieSBDbG9zdXJlIENvbXBpbGVyJ3Mgb3V0cHV0IG9mIGBnb29nLmdldE1zZ2AgZm9yIHRyYW5zaXRpb24gcGVyaW9kKS5cbiAgICovXG4gIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbjtcblxuICAvKipcbiAgICogT3ZlcnJpZGVzIHRoZSBkZWZhdWx0IGludGVycG9sYXRpb24gc3RhcnQgYW5kIGVuZCBkZWxpbWl0ZXJzICh7eyBhbmQgfX0pLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICogU3RyYXRlZ3kgdXNlZCBmb3IgZGV0ZWN0aW5nIGNoYW5nZXMgaW4gdGhlIGNvbXBvbmVudC5cbiAgICovXG4gIGNoYW5nZURldGVjdGlvbj86IENoYW5nZURldGVjdGlvblN0cmF0ZWd5O1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IGEgZGlyZWN0aXZlIHRoYXQgaXMgdXNlZCBpbiBhIGNvbXBvbmVudCB0ZW1wbGF0ZS4gT25seSB0aGUgc3RhYmxlLCBwdWJsaWNcbiAqIGZhY2luZyBpbmZvcm1hdGlvbiBvZiB0aGUgZGlyZWN0aXZlIGlzIHN0b3JlZCBoZXJlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIFRoZSB0eXBlIG9mIHRoZSBkaXJlY3RpdmUgYXMgYW4gZXhwcmVzc2lvbi5cbiAgICovXG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIHNlbGVjdG9yIG9mIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBzZWxlY3Rvcjogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBwcm9wZXJ0eSBuYW1lcyBvZiB0aGUgaW5wdXRzIG9mIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBpbnB1dHM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBwcm9wZXJ0eSBuYW1lcyBvZiB0aGUgb3V0cHV0cyBvZiB0aGUgZGlyZWN0aXZlLlxuICAgKi9cbiAgb3V0cHV0czogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE5hbWUgdW5kZXIgd2hpY2ggdGhlIGRpcmVjdGl2ZSBpcyBleHBvcnRlZCwgaWYgYW55IChleHBvcnRBcyBpbiBBbmd1bGFyKS4gTnVsbCBvdGhlcndpc2UuXG4gICAqL1xuICBleHBvcnRBczogc3RyaW5nW118bnVsbDtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgdG8gY29tcGlsZSBhIHF1ZXJ5ICh2aWV3IG9yIGNvbnRlbnQpLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzUXVlcnlNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBwcm9wZXJ0eSBvbiB0aGUgY2xhc3MgdG8gdXBkYXRlIHdpdGggcXVlcnkgcmVzdWx0cy5cbiAgICovXG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHJlYWQgb25seSB0aGUgZmlyc3QgbWF0Y2hpbmcgcmVzdWx0LCBvciBhbiBhcnJheSBvZiByZXN1bHRzLlxuICAgKi9cbiAgZmlyc3Q6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEVpdGhlciBhbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHR5cGUgb3IgYEluamVjdGlvblRva2VuYCBmb3IgdGhlIHF1ZXJ5XG4gICAqIHByZWRpY2F0ZSwgb3IgYSBzZXQgb2Ygc3RyaW5nIHNlbGVjdG9ycy5cbiAgICovXG4gIHByZWRpY2F0ZTogby5FeHByZXNzaW9ufHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGluY2x1ZGUgb25seSBkaXJlY3QgY2hpbGRyZW4gb3IgYWxsIGRlc2NlbmRhbnRzLlxuICAgKi9cbiAgZGVzY2VuZGFudHM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgdHlwZSB0byByZWFkIGZyb20gZWFjaCBtYXRjaGVkIG5vZGUsIG9yIG51bGwgaWYgdGhlIGRlZmF1bHQgdmFsdWVcbiAgICogZm9yIGEgZ2l2ZW4gbm9kZSBpcyB0byBiZSByZXR1cm5lZC5cbiAgICovXG4gIHJlYWQ6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGlzIHF1ZXJ5IHNob3VsZCBjb2xsZWN0IG9ubHkgc3RhdGljIHJlc3VsdHMuXG4gICAqXG4gICAqIElmIHN0YXRpYyBpcyB0cnVlLCB0aGUgcXVlcnkncyByZXN1bHRzIHdpbGwgYmUgc2V0IG9uIHRoZSBjb21wb25lbnQgYWZ0ZXIgbm9kZXMgYXJlIGNyZWF0ZWQsXG4gICAqIGJ1dCBiZWZvcmUgY2hhbmdlIGRldGVjdGlvbiBydW5zLiBUaGlzIG1lYW5zIHRoYXQgYW55IHJlc3VsdHMgdGhhdCByZWxpZWQgdXBvbiBjaGFuZ2UgZGV0ZWN0aW9uXG4gICAqIHRvIHJ1biAoZS5nLiByZXN1bHRzIGluc2lkZSAqbmdJZiBvciAqbmdGb3Igdmlld3MpIHdpbGwgbm90IGJlIGNvbGxlY3RlZC4gUXVlcnkgcmVzdWx0cyBhcmVcbiAgICogYXZhaWxhYmxlIGluIHRoZSBuZ09uSW5pdCBob29rLlxuICAgKlxuICAgKiBJZiBzdGF0aWMgaXMgZmFsc2UsIHRoZSBxdWVyeSdzIHJlc3VsdHMgd2lsbCBiZSBzZXQgb24gdGhlIGNvbXBvbmVudCBhZnRlciBjaGFuZ2UgZGV0ZWN0aW9uXG4gICAqIHJ1bnMuIFRoaXMgbWVhbnMgdGhhdCB0aGUgcXVlcnkgcmVzdWx0cyBjYW4gY29udGFpbiBub2RlcyBpbnNpZGUgKm5nSWYgb3IgKm5nRm9yIHZpZXdzLCBidXRcbiAgICogdGhlIHJlc3VsdHMgd2lsbCBub3QgYmUgYXZhaWxhYmxlIGluIHRoZSBuZ09uSW5pdCBob29rIChvbmx5IGluIHRoZSBuZ0FmdGVyQ29udGVudEluaXQgZm9yXG4gICAqIGNvbnRlbnQgaG9va3MgYW5kIG5nQWZ0ZXJWaWV3SW5pdCBmb3IgdmlldyBob29rcykuXG4gICAqL1xuICBzdGF0aWM6IGJvb2xlYW47XG59XG5cbi8qKlxuICogT3V0cHV0IG9mIHJlbmRlcjMgZGlyZWN0aXZlIGNvbXBpbGF0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGlyZWN0aXZlRGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG59XG5cbi8qKlxuICogT3V0cHV0IG9mIHJlbmRlcjMgY29tcG9uZW50IGNvbXBpbGF0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzQ29tcG9uZW50RGVmIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuICB0eXBlOiBvLlR5cGU7XG59XG5cbi8qKlxuICogTWFwcGluZ3MgaW5kaWNhdGluZyBob3cgdGhlIGNsYXNzIGludGVyYWN0cyB3aXRoIGl0c1xuICogaG9zdCBlbGVtZW50IChob3N0IGJpbmRpbmdzLCBsaXN0ZW5lcnMsIGV0YykuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNIb3N0TWV0YWRhdGEge1xuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIGF0dHJpYnV0ZSBiaW5kaW5nIGtleXMgdG8gYG8uRXhwcmVzc2lvbmBzLlxuICAgKi9cbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG5cbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBldmVudCBiaW5kaW5nIGtleXMgdG8gdW5wYXJzZWQgZXhwcmVzc2lvbnMuXG4gICAqL1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgb2YgcHJvcGVydHkgYmluZGluZyBrZXlzIHRvIHVucGFyc2VkIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG5cbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuIl19