/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1ZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIHRvIGNvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBkaXJlY3RpdmUgdHlwZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBnZW5lcmljIHR5cGUgcGFyYW1ldGVycyBvZiB0aGUgdHlwZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBBIHNvdXJjZSBzcGFuIGZvciB0aGUgZGlyZWN0aXZlIHR5cGUuXG4gICAqL1xuICB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuXG4gIC8qKlxuICAgKiBEZXBlbmRlbmNpZXMgb2YgdGhlIGRpcmVjdGl2ZSdzIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsO1xuXG4gIC8qKlxuICAgKiBVbnBhcnNlZCBzZWxlY3RvciBvZiB0aGUgZGlyZWN0aXZlLCBvciBgbnVsbGAgaWYgdGhlcmUgd2FzIG5vIHNlbGVjdG9yLlxuICAgKi9cbiAgc2VsZWN0b3I6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29udGVudCBxdWVyaWVzIG1hZGUgYnkgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHF1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdO1xuXG4gIC8qKlxuICAgKiBNYXBwaW5ncyBpbmRpY2F0aW5nIGhvdyB0aGUgZGlyZWN0aXZlIGludGVyYWN0cyB3aXRoIGl0cyBob3N0IGVsZW1lbnQgKGhvc3QgYmluZGluZ3MsXG4gICAqIGxpc3RlbmVycywgZXRjKS5cbiAgICovXG4gIGhvc3Q6IHtcbiAgICAvKipcbiAgICAgKiBBIG1hcHBpbmcgb2YgYXR0cmlidXRlIGJpbmRpbmcga2V5cyB0byB1bnBhcnNlZCBleHByZXNzaW9ucy5cbiAgICAgKi9cbiAgICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcblxuICAgIC8qKlxuICAgICAqIEEgbWFwcGluZyBvZiBldmVudCBiaW5kaW5nIGtleXMgdG8gdW5wYXJzZWQgZXhwcmVzc2lvbnMuXG4gICAgICovXG4gICAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcblxuICAgIC8qKlxuICAgICAqIEEgbWFwcGluZyBvZiBwcm9wZXJ0eSBiaW5kaW5nIGtleXMgdG8gdW5wYXJzZWQgZXhwcmVzc2lvbnMuXG4gICAgICovXG4gICAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIH07XG5cbiAgLyoqXG4gICAqIEluZm9ybWF0aW9uIGFib3V0IHVzYWdlIG9mIHNwZWNpZmljIGxpZmVjeWNsZSBldmVudHMgd2hpY2ggcmVxdWlyZSBzcGVjaWFsIHRyZWF0bWVudCBpbiB0aGVcbiAgICogY29kZSBnZW5lcmF0b3IuXG4gICAqL1xuICBsaWZlY3ljbGU6IHtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBkaXJlY3RpdmUgdXNlcyBOZ09uQ2hhbmdlcy5cbiAgICAgKi9cbiAgICB1c2VzT25DaGFuZ2VzOiBib29sZWFuO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgb2YgaW5wdXQgZmllbGQgbmFtZXMgdG8gdGhlIHByb3BlcnR5IG5hbWVzLlxuICAgKi9cbiAgaW5wdXRzOiB7W2ZpZWxkOiBzdHJpbmddOiBzdHJpbmcgfCBbc3RyaW5nLCBzdHJpbmddfTtcblxuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIG91dHB1dCBmaWVsZCBuYW1lcyB0byB0aGUgcHJvcGVydHkgbmFtZXMuXG4gICAqL1xuICBvdXRwdXRzOiB7W2ZpZWxkOiBzdHJpbmddOiBzdHJpbmd9O1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpbmhlcml0cyBmcm9tIGFub3RoZXIgY2xhc3NcbiAgICovXG4gIHVzZXNJbmhlcml0YW5jZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogUmVmZXJlbmNlIG5hbWUgdW5kZXIgd2hpY2ggdG8gZXhwb3J0IHRoZSBkaXJlY3RpdmUncyB0eXBlIGluIGEgdGVtcGxhdGUsXG4gICAqIGlmIGFueS5cbiAgICovXG4gIGV4cG9ydEFzOiBzdHJpbmd8bnVsbDtcblxuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgcHJvdmlkZXJzIGRlZmluZWQgaW4gdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHByb3ZpZGVyczogby5FeHByZXNzaW9ufG51bGw7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIHRvIGNvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb21wb25lbnRNZXRhZGF0YSBleHRlbmRzIFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICAvKipcbiAgICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIGNvbXBvbmVudCdzIHRlbXBsYXRlLlxuICAgKi9cbiAgdGVtcGxhdGU6IHtcbiAgICAvKipcbiAgICAgKiBQYXJzZWQgbm9kZXMgb2YgdGhlIHRlbXBsYXRlLlxuICAgICAqL1xuICAgIG5vZGVzOiB0Lk5vZGVbXTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHRlbXBsYXRlIGluY2x1ZGVzIDxuZy1jb250ZW50PiB0YWdzLlxuICAgICAqL1xuICAgIGhhc05nQ29udGVudDogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIFNlbGVjdG9ycyBmb3VuZCBpbiB0aGUgPG5nLWNvbnRlbnQ+IHRhZ3MgaW4gdGhlIHRlbXBsYXRlLlxuICAgICAqL1xuICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG5cbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSAudHMgZmlsZSBpbiB3aGljaCB0aGlzIHRlbXBsYXRlJ3MgZ2VuZXJhdGVkIGNvZGUgd2lsbCBiZSBpbmNsdWRlZCwgcmVsYXRpdmUgdG9cbiAgICAgKiB0aGUgY29tcGlsYXRpb24gcm9vdC4gVGhpcyB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgaWRlbnRpZmllcnMgdGhhdCBuZWVkIHRvIGJlIGdsb2JhbGx5XG4gICAgICogdW5pcXVlIGluIGNlcnRhaW4gY29udGV4dHMgKHN1Y2ggYXMgZzMpLlxuICAgICAqL1xuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSB2aWV3IHF1ZXJpZXMgbWFkZSBieSB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdO1xuXG4gIC8qKlxuICAgKiBBIG1hcCBvZiBwaXBlIG5hbWVzIHRvIGFuIGV4cHJlc3Npb24gcmVmZXJlbmNpbmcgdGhlIHBpcGUgdHlwZSB3aGljaCBhcmUgaW4gdGhlIHNjb3BlIG9mIHRoZVxuICAgKiBjb21waWxhdGlvbi5cbiAgICovXG4gIHBpcGVzOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+O1xuXG4gIC8qKlxuICAgKiBBIGxpc3Qgb2YgZGlyZWN0aXZlIHNlbGVjdG9ycyBhbmQgYW4gZXhwcmVzc2lvbiByZWZlcmVuY2luZyB0aGUgZGlyZWN0aXZlIHR5cGUgd2hpY2ggYXJlIGluIHRoZVxuICAgKiBzY29wZSBvZiB0aGUgY29tcGlsYXRpb24uXG4gICAqL1xuICBkaXJlY3RpdmVzOiB7c2VsZWN0b3I6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufVtdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHdyYXAgdGhlICdkaXJlY3RpdmVzJyBhbmQvb3IgYHBpcGVzYCBhcnJheSwgaWYgb25lIGlzIGdlbmVyYXRlZCwgaW4gYSBjbG9zdXJlLlxuICAgKlxuICAgKiBUaGlzIGlzIGRvbmUgd2hlbiB0aGUgZGlyZWN0aXZlcyBvciBwaXBlcyBjb250YWluIGZvcndhcmQgcmVmZXJlbmNlcy5cbiAgICovXG4gIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEEgY29sbGVjdGlvbiBvZiBzdHlsaW5nIGRhdGEgdGhhdCB3aWxsIGJlIGFwcGxpZWQgYW5kIHNjb3BlZCB0byB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgc3R5bGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW4gZW5jYXBzdWxhdGlvbiBwb2xpY3kgZm9yIHRoZSB0ZW1wbGF0ZSBhbmQgQ1NTIHN0eWxlcy4gT25lIG9mOlxuICAgKiAtIGBWaWV3RW5jYXBzdWxhdGlvbi5OYXRpdmVgOiBVc2Ugc2hhZG93IHJvb3RzLiBUaGlzIHdvcmtzIG9ubHkgaWYgbmF0aXZlbHkgYXZhaWxhYmxlIG9uIHRoZVxuICAgKiAgIHBsYXRmb3JtIChub3RlIHRoYXQgdGhpcyBpcyBtYXJrZWQgdGhlIGFzIHRoZSBcImRlcHJlY2F0ZWQgc2hhZG93IERPTVwiIGFzIG9mIEFuZ3VsYXIgdjYuMS5cbiAgICogLSBgVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWRgOiBVc2Ugc2hpbW1lZCBDU1MgdGhhdCBlbXVsYXRlcyB0aGUgbmF0aXZlIGJlaGF2aW9yLlxuICAgKiAtIGBWaWV3RW5jYXBzdWxhdGlvbi5Ob25lYDogVXNlIGdsb2JhbCBDU1Mgd2l0aG91dCBhbnkgZW5jYXBzdWxhdGlvbi5cbiAgICogLSBgVmlld0VuY2Fwc3VsYXRpb24uU2hhZG93RG9tYDogVXNlIHRoZSBsYXRlc3QgU2hhZG93RE9NIEFQSSB0byBuYXRpdmVseSBlbmNhcHN1bGF0ZSBzdHlsZXNcbiAgICogaW50byBhIHNoYWRvdyByb290LlxuICAgKi9cbiAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb247XG5cbiAgLyoqXG4gICAqIEEgY29sbGVjdGlvbiBvZiBhbmltYXRpb24gdHJpZ2dlcnMgdGhhdCB3aWxsIGJlIHVzZWQgaW4gdGhlIGNvbXBvbmVudCB0ZW1wbGF0ZS5cbiAgICovXG4gIGFuaW1hdGlvbnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbGlzdCBvZiB2aWV3IHByb3ZpZGVycyBkZWZpbmVkIGluIHRoZSBjb21wb25lbnQuXG4gICAqL1xuICB2aWV3UHJvdmlkZXJzOiBvLkV4cHJlc3Npb258bnVsbDtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgdG8gY29tcGlsZSBhIHF1ZXJ5ICh2aWV3IG9yIGNvbnRlbnQpLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzUXVlcnlNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBwcm9wZXJ0eSBvbiB0aGUgY2xhc3MgdG8gdXBkYXRlIHdpdGggcXVlcnkgcmVzdWx0cy5cbiAgICovXG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHJlYWQgb25seSB0aGUgZmlyc3QgbWF0Y2hpbmcgcmVzdWx0LCBvciBhbiBhcnJheSBvZiByZXN1bHRzLlxuICAgKi9cbiAgZmlyc3Q6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEVpdGhlciBhbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHR5cGUgZm9yIHRoZSBxdWVyeSBwcmVkaWNhdGUsIG9yIGEgc2V0IG9mIHN0cmluZyBzZWxlY3RvcnMuXG4gICAqL1xuICBwcmVkaWNhdGU6IG8uRXhwcmVzc2lvbnxzdHJpbmdbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBpbmNsdWRlIG9ubHkgZGlyZWN0IGNoaWxkcmVuIG9yIGFsbCBkZXNjZW5kYW50cy5cbiAgICovXG4gIGRlc2NlbmRhbnRzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHR5cGUgdG8gcmVhZCBmcm9tIGVhY2ggbWF0Y2hlZCBub2RlLCBvciBudWxsIGlmIHRoZSBkZWZhdWx0IHZhbHVlXG4gICAqIGZvciBhIGdpdmVuIG5vZGUgaXMgdG8gYmUgcmV0dXJuZWQuXG4gICAqL1xuICByZWFkOiBvLkV4cHJlc3Npb258bnVsbDtcbn1cblxuLyoqXG4gKiBPdXRwdXQgb2YgcmVuZGVyMyBkaXJlY3RpdmUgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEaXJlY3RpdmVEZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuLyoqXG4gKiBPdXRwdXQgb2YgcmVuZGVyMyBjb21wb25lbnQgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb21wb25lbnREZWYge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cbiJdfQ==