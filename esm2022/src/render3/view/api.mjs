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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBcVVILE1BQU0sQ0FBTixJQUFZLHdCQUlYO0FBSkQsV0FBWSx3QkFBd0I7SUFDbEMsaUZBQWEsQ0FBQTtJQUNiLHVFQUFRLENBQUE7SUFDUiwrRUFBWSxDQUFBO0FBQ2QsQ0FBQyxFQUpXLHdCQUF3QixLQUF4Qix3QkFBd0IsUUFJbkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgVmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvZGVmYXVsdHMnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7TWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgUjNSZWZlcmVuY2V9IGZyb20gJy4uL3V0aWwnO1xuXG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIHRvIGNvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBkaXJlY3RpdmUgdHlwZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlOiBSM1JlZmVyZW5jZTtcblxuICAvKipcbiAgICogTnVtYmVyIG9mIGdlbmVyaWMgdHlwZSBwYXJhbWV0ZXJzIG9mIHRoZSB0eXBlIGl0c2VsZi5cbiAgICovXG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEEgc291cmNlIHNwYW4gZm9yIHRoZSBkaXJlY3RpdmUgdHlwZS5cbiAgICovXG4gIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG5cbiAgLyoqXG4gICAqIERlcGVuZGVuY2llcyBvZiB0aGUgZGlyZWN0aXZlJ3MgY29uc3RydWN0b3IuXG4gICAqL1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfCdpbnZhbGlkJ3xudWxsO1xuXG4gIC8qKlxuICAgKiBVbnBhcnNlZCBzZWxlY3RvciBvZiB0aGUgZGlyZWN0aXZlLCBvciBgbnVsbGAgaWYgdGhlcmUgd2FzIG5vIHNlbGVjdG9yLlxuICAgKi9cbiAgc2VsZWN0b3I6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29udGVudCBxdWVyaWVzIG1hZGUgYnkgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHF1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdO1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgdmlldyBxdWVyaWVzIG1hZGUgYnkgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHZpZXdRdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXTtcblxuICAvKipcbiAgICogTWFwcGluZ3MgaW5kaWNhdGluZyBob3cgdGhlIGRpcmVjdGl2ZSBpbnRlcmFjdHMgd2l0aCBpdHMgaG9zdCBlbGVtZW50IChob3N0IGJpbmRpbmdzLFxuICAgKiBsaXN0ZW5lcnMsIGV0YykuXG4gICAqL1xuICBob3N0OiBSM0hvc3RNZXRhZGF0YTtcblxuICAvKipcbiAgICogSW5mb3JtYXRpb24gYWJvdXQgdXNhZ2Ugb2Ygc3BlY2lmaWMgbGlmZWN5Y2xlIGV2ZW50cyB3aGljaCByZXF1aXJlIHNwZWNpYWwgdHJlYXRtZW50IGluIHRoZVxuICAgKiBjb2RlIGdlbmVyYXRvci5cbiAgICovXG4gIGxpZmVjeWNsZToge1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGRpcmVjdGl2ZSB1c2VzIE5nT25DaGFuZ2VzLlxuICAgICAqL1xuICAgIHVzZXNPbkNoYW5nZXM6IGJvb2xlYW47XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBpbnB1dHMgZnJvbSBjbGFzcyBwcm9wZXJ0eSBuYW1lcyB0byBiaW5kaW5nIHByb3BlcnR5IG5hbWVzLCBvciB0byBhIHR1cGxlIG9mXG4gICAqIGJpbmRpbmcgcHJvcGVydHkgbmFtZSBhbmQgY2xhc3MgcHJvcGVydHkgbmFtZSBpZiB0aGUgbmFtZXMgYXJlIGRpZmZlcmVudC5cbiAgICovXG4gIGlucHV0czoge1tmaWVsZDogc3RyaW5nXTogUjNJbnB1dE1ldGFkYXRhfTtcblxuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIG91dHB1dHMgZnJvbSBjbGFzcyBwcm9wZXJ0eSBuYW1lcyB0byBiaW5kaW5nIHByb3BlcnR5IG5hbWVzLCBvciB0byBhIHR1cGxlIG9mXG4gICAqIGJpbmRpbmcgcHJvcGVydHkgbmFtZSBhbmQgY2xhc3MgcHJvcGVydHkgbmFtZSBpZiB0aGUgbmFtZXMgYXJlIGRpZmZlcmVudC5cbiAgICovXG4gIG91dHB1dHM6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ307XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgb3Igbm90IHRoZSBjb21wb25lbnQgb3IgZGlyZWN0aXZlIGluaGVyaXRzIGZyb20gYW5vdGhlciBjbGFzc1xuICAgKi9cbiAgdXNlc0luaGVyaXRhbmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpbmhlcml0cyBpdHMgZW50aXJlIGRlY29yYXRvciBmcm9tIGl0cyBiYXNlIGNsYXNzLlxuICAgKi9cbiAgZnVsbEluaGVyaXRhbmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgbmFtZSB1bmRlciB3aGljaCB0byBleHBvcnQgdGhlIGRpcmVjdGl2ZSdzIHR5cGUgaW4gYSB0ZW1wbGF0ZSxcbiAgICogaWYgYW55LlxuICAgKi9cbiAgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHByb3ZpZGVycyBkZWZpbmVkIGluIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpcyBzdGFuZGFsb25lLlxuICAgKi9cbiAgaXNTdGFuZGFsb25lOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpcyBzaWduYWwtYmFzZWQuXG4gICAqL1xuICBpc1NpZ25hbDogYm9vbGVhbjtcblxuICAvKipcbiAgICogQWRkaXRpb25hbCBkaXJlY3RpdmVzIGFwcGxpZWQgdG8gdGhlIGRpcmVjdGl2ZSBob3N0LlxuICAgKi9cbiAgaG9zdERpcmVjdGl2ZXM6IFIzSG9zdERpcmVjdGl2ZU1ldGFkYXRhW118bnVsbDtcbn1cblxuLyoqXG4gKiBTcGVjaWZpZXMgaG93IGEgbGlzdCBvZiBkZWNsYXJhdGlvbiB0eXBlIHJlZmVyZW5jZXMgc2hvdWxkIGJlIGVtaXR0ZWQgaW50byB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmV4cG9ydCBjb25zdCBlbnVtIERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlIHtcbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIGRlY2xhcmF0aW9ucyBpcyBlbWl0dGVkIGludG8gdGhlIGdlbmVyYXRlZCBjb2RlIGFzIGlzLlxuICAgKlxuICAgKiBgYGBcbiAgICogZGlyZWN0aXZlczogW015RGlyXSxcbiAgICogYGBgXG4gICAqL1xuICBEaXJlY3QsXG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIGRlY2xhcmF0aW9ucyBpcyBlbWl0dGVkIGludG8gdGhlIGdlbmVyYXRlZCBjb2RlIHdyYXBwZWQgaW5zaWRlIGEgY2xvc3VyZSwgd2hpY2hcbiAgICogaXMgbmVlZGVkIHdoZW4gYXQgbGVhc3Qgb25lIGRlY2xhcmF0aW9uIGlzIGEgZm9yd2FyZCByZWZlcmVuY2UuXG4gICAqXG4gICAqIGBgYFxuICAgKiBkaXJlY3RpdmVzOiBmdW5jdGlvbiAoKSB7IHJldHVybiBbTXlEaXIsIEZvcndhcmREaXJdOyB9LFxuICAgKiBgYGBcbiAgICovXG4gIENsb3N1cmUsXG5cbiAgLyoqXG4gICAqIFNpbWlsYXIgdG8gYENsb3N1cmVgLCB3aXRoIHRoZSBhZGRpdGlvbiB0aGF0IHRoZSBsaXN0IG9mIGRlY2xhcmF0aW9ucyBjYW4gY29udGFpbiBpbmRpdmlkdWFsXG4gICAqIGl0ZW1zIHRoYXQgYXJlIHRoZW1zZWx2ZXMgZm9yd2FyZCByZWZlcmVuY2VzLiBUaGlzIGlzIHJlbGV2YW50IGZvciBKSVQgY29tcGlsYXRpb25zLCBhc1xuICAgKiB1bndyYXBwaW5nIHRoZSBmb3J3YXJkUmVmIGNhbm5vdCBiZSBkb25lIHN0YXRpY2FsbHkgc28gbXVzdCBiZSBkZWZlcnJlZC4gVGhpcyBtb2RlIGVtaXRzXG4gICAqIHRoZSBkZWNsYXJhdGlvbiBsaXN0IHVzaW5nIGEgbWFwcGluZyB0cmFuc2Zvcm0gdGhyb3VnaCBgcmVzb2x2ZUZvcndhcmRSZWZgIHRvIGVuc3VyZSB0aGF0XG4gICAqIGFueSBmb3J3YXJkIHJlZmVyZW5jZXMgd2l0aGluIHRoZSBsaXN0IGFyZSByZXNvbHZlZCB3aGVuIHRoZSBvdXRlciBjbG9zdXJlIGlzIGludm9rZWQuXG4gICAqXG4gICAqIENvbnNpZGVyIHRoZSBjYXNlIHdoZXJlIHRoZSBydW50aW1lIGhhcyBjYXB0dXJlZCB0d28gZGVjbGFyYXRpb25zIGluIHR3byBkaXN0aW5jdCB2YWx1ZXM6XG4gICAqIGBgYFxuICAgKiBjb25zdCBkaXJBID0gTXlEaXI7XG4gICAqIGNvbnN0IGRpckIgPSBmb3J3YXJkUmVmKGZ1bmN0aW9uKCkgeyByZXR1cm4gRm9yd2FyZFJlZjsgfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGlzIG1vZGUgd291bGQgZW1pdCB0aGUgZGVjbGFyYXRpb25zIGNhcHR1cmVkIGluIGBkaXJBYCBhbmQgYGRpckJgIGFzIGZvbGxvd3M6XG4gICAqIGBgYFxuICAgKiBkaXJlY3RpdmVzOiBmdW5jdGlvbiAoKSB7IHJldHVybiBbZGlyQSwgZGlyQl0ubWFwKG5nLnJlc29sdmVGb3J3YXJkUmVmKTsgfSxcbiAgICogYGBgXG4gICAqL1xuICBDbG9zdXJlUmVzb2x2ZWQsXG5cbiAgUnVudGltZVJlc29sdmVkLFxufVxuXG4vKipcbiAqIERlc2NyaWJlcyBhIGRlcGVuZGVuY3kgdXNlZCB3aXRoaW4gYSBgQGRlZmVyYCBibG9jay5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlZmVyQmxvY2tUZW1wbGF0ZURlcGVuZGVuY3kge1xuICAvKipcbiAgICogUmVmZXJlbmNlIHRvIGEgZGVwZW5kZW5jeS5cbiAgICovXG4gIHR5cGU6IG8uV3JhcHBlZE5vZGVFeHByPHVua25vd24+O1xuXG4gIC8qKlxuICAgKiBEZXBlbmRlbmN5IGNsYXNzIG5hbWUuXG4gICAqL1xuICBzeW1ib2xOYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhpcyBkZXBlbmRlbmN5IGNhbiBiZSBkZWZlci1sb2FkZWQuXG4gICAqL1xuICBpc0RlZmVycmFibGU6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEltcG9ydCBwYXRoIHdoZXJlIHRoaXMgZGVwZW5kZW5jeSBpcyBsb2NhdGVkLlxuICAgKi9cbiAgaW1wb3J0UGF0aDogc3RyaW5nfG51bGw7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVjZXNzYXJ5IHRvIGNvbXBpbGUgYSBgZGVmZXJgIGJsb2NrLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVmZXJCbG9ja01ldGFkYXRhIHtcbiAgLyoqIERlcGVuZGVuY2llcyB1c2VkIHdpdGhpbiB0aGUgYmxvY2suICovXG4gIGRlcHM6IFIzRGVmZXJCbG9ja1RlbXBsYXRlRGVwZW5kZW5jeVtdO1xuXG4gIC8qKiBNYXBwaW5nIGJldHdlZW4gdHJpZ2dlcnMgYW5kIHRoZSBET00gbm9kZXMgdGhleSByZWZlciB0by4gKi9cbiAgdHJpZ2dlckVsZW1lbnRzOiBNYXA8dC5EZWZlcnJlZFRyaWdnZXIsIHQuRWxlbWVudHxudWxsPjtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgdG8gY29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NvbXBvbmVudE1ldGFkYXRhPERlY2xhcmF0aW9uVCBleHRlbmRzIFIzVGVtcGxhdGVEZXBlbmRlbmN5PiBleHRlbmRzXG4gICAgUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICB0ZW1wbGF0ZToge1xuICAgIC8qKlxuICAgICAqIFBhcnNlZCBub2RlcyBvZiB0aGUgdGVtcGxhdGUuXG4gICAgICovXG4gICAgbm9kZXM6IHQuTm9kZVtdO1xuXG4gICAgLyoqXG4gICAgICogQW55IG5nLWNvbnRlbnQgc2VsZWN0b3JzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZS4gQ29udGFpbnMgYCpgIHdoZW4gYW4gbmctY29udGVudFxuICAgICAqIGVsZW1lbnQgd2l0aG91dCBzZWxlY3RvciBpcyBwcmVzZW50LlxuICAgICAqL1xuICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSB0ZW1wbGF0ZSBwcmVzZXJ2ZXMgd2hpdGVzcGFjZXMgZnJvbSB0aGUgdXNlcidzIGNvZGUuXG4gICAgICovXG4gICAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG4gIH07XG5cbiAgZGVjbGFyYXRpb25zOiBEZWNsYXJhdGlvblRbXTtcblxuICAvKipcbiAgICogTWFwIG9mIGFsbCB0eXBlcyB0aGF0IGNhbiBiZSBkZWZlciBsb2FkZWQgKHRzLkNsYXNzRGVjbGFyYXRpb24pIC0+XG4gICAqIGNvcnJlc3BvbmRpbmcgaW1wb3J0IGRlY2xhcmF0aW9uICh0cy5JbXBvcnREZWNsYXJhdGlvbikgd2l0aGluXG4gICAqIHRoZSBjdXJyZW50IHNvdXJjZSBmaWxlLlxuICAgKi9cbiAgZGVmZXJyYWJsZURlY2xUb0ltcG9ydERlY2w6IE1hcDxvLkV4cHJlc3Npb24sIG8uRXhwcmVzc2lvbj47XG5cbiAgLyoqXG4gICAqIE1hcCBvZiBgQGRlZmVyYCBibG9ja3MgLT4gdGhlaXIgY29ycmVzcG9uZGluZyBtZXRhZGF0YS5cbiAgICovXG4gIGRlZmVyQmxvY2tzOiBNYXA8dC5EZWZlcnJlZEJsb2NrLCBSM0RlZmVyQmxvY2tNZXRhZGF0YT47XG5cbiAgLyoqXG4gICAqIFNwZWNpZmllcyBob3cgdGhlICdkaXJlY3RpdmVzJyBhbmQvb3IgYHBpcGVzYCBhcnJheSwgaWYgZ2VuZXJhdGVkLCBuZWVkIHRvIGJlIGVtaXR0ZWQuXG4gICAqL1xuICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGU7XG5cbiAgLyoqXG4gICAqIEEgY29sbGVjdGlvbiBvZiBzdHlsaW5nIGRhdGEgdGhhdCB3aWxsIGJlIGFwcGxpZWQgYW5kIHNjb3BlZCB0byB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgc3R5bGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW4gZW5jYXBzdWxhdGlvbiBwb2xpY3kgZm9yIHRoZSBjb21wb25lbnQncyBzdHlsaW5nLlxuICAgKiBQb3NzaWJsZSB2YWx1ZXM6XG4gICAqIC0gYFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkYDogQXBwbHkgbW9kaWZpZWQgY29tcG9uZW50IHN0eWxlcyBpbiBvcmRlciB0byBlbXVsYXRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYSBuYXRpdmUgU2hhZG93IERPTSBDU1MgZW5jYXBzdWxhdGlvbiBiZWhhdmlvci5cbiAgICogLSBgVmlld0VuY2Fwc3VsYXRpb24uTm9uZWA6IEFwcGx5IGNvbXBvbmVudCBzdHlsZXMgZ2xvYmFsbHkgd2l0aG91dCBhbnkgc29ydCBvZiBlbmNhcHN1bGF0aW9uLlxuICAgKiAtIGBWaWV3RW5jYXBzdWxhdGlvbi5TaGFkb3dEb21gOiBVc2UgdGhlIGJyb3dzZXIncyBuYXRpdmUgU2hhZG93IERPTSBBUEkgdG8gZW5jYXBzdWxhdGUgc3R5bGVzLlxuICAgKi9cbiAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb247XG5cbiAgLyoqXG4gICAqIEEgY29sbGVjdGlvbiBvZiBhbmltYXRpb24gdHJpZ2dlcnMgdGhhdCB3aWxsIGJlIHVzZWQgaW4gdGhlIGNvbXBvbmVudCB0ZW1wbGF0ZS5cbiAgICovXG4gIGFuaW1hdGlvbnM6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbGlzdCBvZiB2aWV3IHByb3ZpZGVycyBkZWZpbmVkIGluIHRoZSBjb21wb25lbnQuXG4gICAqL1xuICB2aWV3UHJvdmlkZXJzOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogUGF0aCB0byB0aGUgLnRzIGZpbGUgaW4gd2hpY2ggdGhpcyB0ZW1wbGF0ZSdzIGdlbmVyYXRlZCBjb2RlIHdpbGwgYmUgaW5jbHVkZWQsIHJlbGF0aXZlIHRvXG4gICAqIHRoZSBjb21waWxhdGlvbiByb290LiBUaGlzIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBpZGVudGlmaWVycyB0aGF0IG5lZWQgdG8gYmUgZ2xvYmFsbHlcbiAgICogdW5pcXVlIGluIGNlcnRhaW4gY29udGV4dHMgKHN1Y2ggYXMgZzMpLlxuICAgKi9cbiAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZztcblxuICAvKipcbiAgICogV2hldGhlciB0cmFuc2xhdGlvbiB2YXJpYWJsZSBuYW1lIHNob3VsZCBjb250YWluIGV4dGVybmFsIG1lc3NhZ2UgaWRcbiAgICogKHVzZWQgYnkgQ2xvc3VyZSBDb21waWxlcidzIG91dHB1dCBvZiBgZ29vZy5nZXRNc2dgIGZvciB0cmFuc2l0aW9uIHBlcmlvZCkuXG4gICAqL1xuICBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIE92ZXJyaWRlcyB0aGUgZGVmYXVsdCBpbnRlcnBvbGF0aW9uIHN0YXJ0IGFuZCBlbmQgZGVsaW1pdGVycyAoe3sgYW5kIH19KS5cbiAgICovXG4gIGludGVycG9sYXRpb246IEludGVycG9sYXRpb25Db25maWc7XG5cbiAgLyoqXG4gICAqIFN0cmF0ZWd5IHVzZWQgZm9yIGRldGVjdGluZyBjaGFuZ2VzIGluIHRoZSBjb21wb25lbnQuXG4gICAqXG4gICAqIEluIGdsb2JhbCBjb21waWxhdGlvbiBtb2RlIHRoZSB2YWx1ZSBpcyBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSBpZiBhdmFpbGFibGUgYXMgaXQgaXNcbiAgICogc3RhdGljYWxseSByZXNvbHZlZCBkdXJpbmcgYW5hbHlzaXMgcGhhc2UuIFdoZXJlYXMgaW4gbG9jYWwgY29tcGlsYXRpb24gbW9kZSB0aGUgdmFsdWUgaXMgdGhlXG4gICAqIGV4cHJlc3Npb24gYXMgYXBwZWFycyBpbiB0aGUgZGVjb3JhdG9yLlxuICAgKi9cbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneXxvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogVGhlIGltcG9ydHMgZXhwcmVzc2lvbiBhcyBhcHBlYXJzIG9uIHRoZSBjb21wb25lbnQgZGVjb3JhdGUgZm9yIHN0YW5kYWxvbmUgY29tcG9uZW50LiBUaGlzXG4gICAqIGZpZWxkIGlzIGN1cnJlbnRseSBuZWVkZWQgb25seSBmb3IgbG9jYWwgY29tcGlsYXRpb24sIGFuZCBzbyBpbiBvdGhlciBjb21waWxhdGlvbiBtb2RlcyBpdCBtYXlcbiAgICogbm90IGJlIHNldC4gSWYgY29tcG9uZW50IGhhcyBlbXB0eSBhcnJheSBpbXBvcnRzIHRoZW4gdGhpcyBmaWVsZCBpcyBub3Qgc2V0LlxuICAgKi9cbiAgcmF3SW1wb3J0cz86IG8uRXhwcmVzc2lvbjtcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSBmb3IgYW4gaW5kaXZpZHVhbCBpbnB1dCBvbiBhIGRpcmVjdGl2ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0lucHV0TWV0YWRhdGEge1xuICBjbGFzc1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICBiaW5kaW5nUHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gIHJlcXVpcmVkOiBib29sZWFuO1xuICBpc1NpZ25hbDogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBmdW5jdGlvbiBmb3IgdGhlIGlucHV0LlxuICAgKlxuICAgKiBOdWxsIGlmIHRoZXJlIGlzIG5vIHRyYW5zZm9ybSwgb3IgaWYgdGhpcyBpcyBhIHNpZ25hbCBpbnB1dC5cbiAgICogU2lnbmFsIGlucHV0cyBjYXB0dXJlIHRoZWlyIHRyYW5zZm9ybSBhcyBwYXJ0IG9mIHRoZSBgSW5wdXRTaWduYWxgLlxuICAgKi9cbiAgdHJhbnNmb3JtRnVuY3Rpb246IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG5leHBvcnQgZW51bSBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQge1xuICBEaXJlY3RpdmUgPSAwLFxuICBQaXBlID0gMSxcbiAgTmdNb2R1bGUgPSAyLFxufVxuXG4vKipcbiAqIEEgZGVwZW5kZW5jeSB0aGF0J3MgdXNlZCB3aXRoaW4gYSBjb21wb25lbnQgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNUZW1wbGF0ZURlcGVuZGVuY3kge1xuICBraW5kOiBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQ7XG5cbiAgLyoqXG4gICAqIFRoZSB0eXBlIG9mIHRoZSBkZXBlbmRlbmN5IGFzIGFuIGV4cHJlc3Npb24uXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG59XG5cbi8qKlxuICogQSBkZXBlbmRlbmN5IHRoYXQncyB1c2VkIHdpdGhpbiBhIGNvbXBvbmVudCB0ZW1wbGF0ZVxuICovXG5leHBvcnQgdHlwZSBSM1RlbXBsYXRlRGVwZW5kZW5jeU1ldGFkYXRhID1cbiAgICBSM0RpcmVjdGl2ZURlcGVuZGVuY3lNZXRhZGF0YXxSM1BpcGVEZXBlbmRlbmN5TWV0YWRhdGF8UjNOZ01vZHVsZURlcGVuZGVuY3lNZXRhZGF0YTtcblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBhYm91dCBhIGRpcmVjdGl2ZSB0aGF0IGlzIHVzZWQgaW4gYSBjb21wb25lbnQgdGVtcGxhdGUuIE9ubHkgdGhlIHN0YWJsZSwgcHVibGljXG4gKiBmYWNpbmcgaW5mb3JtYXRpb24gb2YgdGhlIGRpcmVjdGl2ZSBpcyBzdG9yZWQgaGVyZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RpcmVjdGl2ZURlcGVuZGVuY3lNZXRhZGF0YSBleHRlbmRzIFIzVGVtcGxhdGVEZXBlbmRlbmN5IHtcbiAga2luZDogUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLkRpcmVjdGl2ZTtcblxuICAvKipcbiAgICogVGhlIHNlbGVjdG9yIG9mIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBzZWxlY3Rvcjogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBwcm9wZXJ0eSBuYW1lcyBvZiB0aGUgaW5wdXRzIG9mIHRoZSBkaXJlY3RpdmUuXG4gICAqL1xuICBpbnB1dHM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBwcm9wZXJ0eSBuYW1lcyBvZiB0aGUgb3V0cHV0cyBvZiB0aGUgZGlyZWN0aXZlLlxuICAgKi9cbiAgb3V0cHV0czogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE5hbWUgdW5kZXIgd2hpY2ggdGhlIGRpcmVjdGl2ZSBpcyBleHBvcnRlZCwgaWYgYW55IChleHBvcnRBcyBpbiBBbmd1bGFyKS4gTnVsbCBvdGhlcndpc2UuXG4gICAqL1xuICBleHBvcnRBczogc3RyaW5nW118bnVsbDtcblxuICAvKipcbiAgICogSWYgdHJ1ZSB0aGVuIHRoaXMgZGlyZWN0aXZlIGlzIGFjdHVhbGx5IGEgY29tcG9uZW50OyBvdGhlcndpc2UgaXQgaXMgbm90LlxuICAgKi9cbiAgaXNDb21wb25lbnQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNQaXBlRGVwZW5kZW5jeU1ldGFkYXRhIGV4dGVuZHMgUjNUZW1wbGF0ZURlcGVuZGVuY3kge1xuICBraW5kOiBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQuUGlwZTtcblxuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNOZ01vZHVsZURlcGVuZGVuY3lNZXRhZGF0YSBleHRlbmRzIFIzVGVtcGxhdGVEZXBlbmRlbmN5IHtcbiAga2luZDogUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLk5nTW9kdWxlO1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG5lZWRlZCB0byBjb21waWxlIGEgcXVlcnkgKHZpZXcgb3IgY29udGVudCkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNRdWVyeU1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIHByb3BlcnR5IG9uIHRoZSBjbGFzcyB0byB1cGRhdGUgd2l0aCBxdWVyeSByZXN1bHRzLlxuICAgKi9cbiAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gcmVhZCBvbmx5IHRoZSBmaXJzdCBtYXRjaGluZyByZXN1bHQsIG9yIGFuIGFycmF5IG9mIHJlc3VsdHMuXG4gICAqL1xuICBmaXJzdDogYm9vbGVhbjtcblxuICAvKipcbiAgICogRWl0aGVyIGFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgdHlwZSBvciBgSW5qZWN0aW9uVG9rZW5gIGZvciB0aGUgcXVlcnlcbiAgICogcHJlZGljYXRlLCBvciBhIHNldCBvZiBzdHJpbmcgc2VsZWN0b3JzLlxuICAgKi9cbiAgcHJlZGljYXRlOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9ufHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGluY2x1ZGUgb25seSBkaXJlY3QgY2hpbGRyZW4gb3IgYWxsIGRlc2NlbmRhbnRzLlxuICAgKi9cbiAgZGVzY2VuZGFudHM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIHRoZSBgUXVlcnlMaXN0YCBzaG91bGQgZmlyZSBjaGFuZ2UgZXZlbnQgb25seSBpZiBhY3R1YWwgY2hhbmdlIHRvIHF1ZXJ5IHdhcyBjb21wdXRlZCAodnMgb2xkXG4gICAqIGJlaGF2aW9yIHdoZXJlIHRoZSBjaGFuZ2Ugd2FzIGZpcmVkIHdoZW5ldmVyIHRoZSBxdWVyeSB3YXMgcmVjb21wdXRlZCwgZXZlbiBpZiB0aGUgcmVjb21wdXRlZFxuICAgKiBxdWVyeSByZXN1bHRlZCBpbiB0aGUgc2FtZSBsaXN0LilcbiAgICovXG4gIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHR5cGUgdG8gcmVhZCBmcm9tIGVhY2ggbWF0Y2hlZCBub2RlLCBvciBudWxsIGlmIHRoZSBkZWZhdWx0IHZhbHVlXG4gICAqIGZvciBhIGdpdmVuIG5vZGUgaXMgdG8gYmUgcmV0dXJuZWQuXG4gICAqL1xuICByZWFkOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogV2hldGhlciBvciBub3QgdGhpcyBxdWVyeSBzaG91bGQgY29sbGVjdCBvbmx5IHN0YXRpYyByZXN1bHRzLlxuICAgKlxuICAgKiBJZiBzdGF0aWMgaXMgdHJ1ZSwgdGhlIHF1ZXJ5J3MgcmVzdWx0cyB3aWxsIGJlIHNldCBvbiB0aGUgY29tcG9uZW50IGFmdGVyIG5vZGVzIGFyZSBjcmVhdGVkLFxuICAgKiBidXQgYmVmb3JlIGNoYW5nZSBkZXRlY3Rpb24gcnVucy4gVGhpcyBtZWFucyB0aGF0IGFueSByZXN1bHRzIHRoYXQgcmVsaWVkIHVwb24gY2hhbmdlIGRldGVjdGlvblxuICAgKiB0byBydW4gKGUuZy4gcmVzdWx0cyBpbnNpZGUgKm5nSWYgb3IgKm5nRm9yIHZpZXdzKSB3aWxsIG5vdCBiZSBjb2xsZWN0ZWQuIFF1ZXJ5IHJlc3VsdHMgYXJlXG4gICAqIGF2YWlsYWJsZSBpbiB0aGUgbmdPbkluaXQgaG9vay5cbiAgICpcbiAgICogSWYgc3RhdGljIGlzIGZhbHNlLCB0aGUgcXVlcnkncyByZXN1bHRzIHdpbGwgYmUgc2V0IG9uIHRoZSBjb21wb25lbnQgYWZ0ZXIgY2hhbmdlIGRldGVjdGlvblxuICAgKiBydW5zLiBUaGlzIG1lYW5zIHRoYXQgdGhlIHF1ZXJ5IHJlc3VsdHMgY2FuIGNvbnRhaW4gbm9kZXMgaW5zaWRlICpuZ0lmIG9yICpuZ0ZvciB2aWV3cywgYnV0XG4gICAqIHRoZSByZXN1bHRzIHdpbGwgbm90IGJlIGF2YWlsYWJsZSBpbiB0aGUgbmdPbkluaXQgaG9vayAob25seSBpbiB0aGUgbmdBZnRlckNvbnRlbnRJbml0IGZvclxuICAgKiBjb250ZW50IGhvb2tzIGFuZCBuZ0FmdGVyVmlld0luaXQgZm9yIHZpZXcgaG9va3MpLlxuICAgKi9cbiAgc3RhdGljOiBib29sZWFuO1xufVxuXG4vKipcbiAqIE1hcHBpbmdzIGluZGljYXRpbmcgaG93IHRoZSBjbGFzcyBpbnRlcmFjdHMgd2l0aCBpdHNcbiAqIGhvc3QgZWxlbWVudCAoaG9zdCBiaW5kaW5ncywgbGlzdGVuZXJzLCBldGMpLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzSG9zdE1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBhdHRyaWJ1dGUgYmluZGluZyBrZXlzIHRvIGBvLkV4cHJlc3Npb25gcy5cbiAgICovXG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgb2YgZXZlbnQgYmluZGluZyBrZXlzIHRvIHVucGFyc2VkIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcblxuICAvKipcbiAgICogQSBtYXBwaW5nIG9mIHByb3BlcnR5IGJpbmRpbmcga2V5cyB0byB1bnBhcnNlZCBleHByZXNzaW9ucy5cbiAgICovXG4gIHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuXG4gIHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fTtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgdG8gY29tcGlsZSBhIGhvc3QgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzSG9zdERpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgLyoqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBob3N0IGRpcmVjdGl2ZSBjbGFzcyBpdHNlbGYuICovXG4gIGRpcmVjdGl2ZTogUjNSZWZlcmVuY2U7XG5cbiAgLyoqIFdoZXRoZXIgdGhlIGV4cHJlc3Npb24gcmVmZXJyaW5nIHRvIHRoZSBob3N0IGRpcmVjdGl2ZSBpcyBhIGZvcndhcmQgcmVmZXJlbmNlLiAqL1xuICBpc0ZvcndhcmRSZWZlcmVuY2U6IGJvb2xlYW47XG5cbiAgLyoqIElucHV0cyBmcm9tIHRoZSBob3N0IGRpcmVjdGl2ZSB0aGF0IHdpbGwgYmUgZXhwb3NlZCBvbiB0aGUgaG9zdC4gKi9cbiAgaW5wdXRzOiB7W3B1YmxpY05hbWU6IHN0cmluZ106IHN0cmluZ318bnVsbDtcblxuICAvKiogT3V0cHV0cyBmcm9tIHRoZSBob3N0IGRpcmVjdGl2ZSB0aGF0IHdpbGwgYmUgZXhwb3NlZCBvbiB0aGUgaG9zdC4gKi9cbiAgb3V0cHV0czoge1twdWJsaWNOYW1lOiBzdHJpbmddOiBzdHJpbmd9fG51bGw7XG59XG4iXX0=