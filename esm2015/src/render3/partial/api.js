export var FactoryTarget;
(function (FactoryTarget) {
    FactoryTarget[FactoryTarget["Directive"] = 0] = "Directive";
    FactoryTarget[FactoryTarget["Component"] = 1] = "Component";
    FactoryTarget[FactoryTarget["Injectable"] = 2] = "Injectable";
    FactoryTarget[FactoryTarget["Pipe"] = 3] = "Pipe";
    FactoryTarget[FactoryTarget["NgModule"] = 4] = "NgModule";
})(FactoryTarget || (FactoryTarget = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBeVdBLE1BQU0sQ0FBTixJQUFZLGFBTVg7QUFORCxXQUFZLGFBQWE7SUFDdkIsMkRBQWEsQ0FBQTtJQUNiLDJEQUFhLENBQUE7SUFDYiw2REFBYyxDQUFBO0lBQ2QsaURBQVEsQ0FBQTtJQUNSLHlEQUFZLENBQUE7QUFDZCxDQUFDLEVBTlcsYUFBYSxLQUFiLGFBQWEsUUFNeEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFIzUGFydGlhbERlY2xhcmF0aW9uIHtcbiAgLyoqXG4gICAqIFZlcnNpb24gbnVtYmVyIG9mIHRoZSBBbmd1bGFyIGNvbXBpbGVyIHRoYXQgd2FzIHVzZWQgdG8gY29tcGlsZSB0aGlzIGRlY2xhcmF0aW9uLiBUaGUgbGlua2VyXG4gICAqIHdpbGwgYmUgYWJsZSB0byBkZXRlY3Qgd2hpY2ggdmVyc2lvbiBhIGxpYnJhcnkgaXMgdXNpbmcgYW5kIGludGVycHJldCBpdHMgbWV0YWRhdGEgYWNjb3JkaW5nbHkuXG4gICAqL1xuICB2ZXJzaW9uOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIHRoZSBgQGFuZ3VsYXIvY29yZWAgRVMgbW9kdWxlLCB3aGljaCBhbGxvd3MgYWNjZXNzXG4gICAqIHRvIGFsbCBBbmd1bGFyIGV4cG9ydHMsIGluY2x1ZGluZyBJdnkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgbmdJbXBvcnQ6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogUmVmZXJlbmNlIHRvIHRoZSBkZWNvcmF0ZWQgY2xhc3MsIHdoaWNoIGlzIHN1YmplY3QgdG8gdGhpcyBwYXJ0aWFsIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgdHlwZTogby5FeHByZXNzaW9uO1xufVxuXG4vKipcbiAqIERlc2NyaWJlcyB0aGUgc2hhcGUgb2YgdGhlIG9iamVjdCB0aGF0IHRoZSBgybXJtW5nRGVjbGFyZURpcmVjdGl2ZSgpYCBmdW5jdGlvbiBhY2NlcHRzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhIGV4dGVuZHMgUjNQYXJ0aWFsRGVjbGFyYXRpb24ge1xuICAvKipcbiAgICogVW5wYXJzZWQgc2VsZWN0b3Igb2YgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHNlbGVjdG9yPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgb2YgaW5wdXRzIGZyb20gY2xhc3MgcHJvcGVydHkgbmFtZXMgdG8gYmluZGluZyBwcm9wZXJ0eSBuYW1lcywgb3IgdG8gYSB0dXBsZSBvZlxuICAgKiBiaW5kaW5nIHByb3BlcnR5IG5hbWUgYW5kIGNsYXNzIHByb3BlcnR5IG5hbWUgaWYgdGhlIG5hbWVzIGFyZSBkaWZmZXJlbnQuXG4gICAqL1xuICBpbnB1dHM/OiB7W2NsYXNzUHJvcGVydHlOYW1lOiBzdHJpbmddOiBzdHJpbmd8W3N0cmluZywgc3RyaW5nXX07XG5cbiAgLyoqXG4gICAqIEEgbWFwcGluZyBvZiBvdXRwdXRzIGZyb20gY2xhc3MgcHJvcGVydHkgbmFtZXMgdG8gYmluZGluZyBwcm9wZXJ0eSBuYW1lcy5cbiAgICovXG4gIG91dHB1dHM/OiB7W2NsYXNzUHJvcGVydHlOYW1lOiBzdHJpbmddOiBzdHJpbmd9O1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCBob3N0IGJpbmRpbmdzIHByZXNlbnQgb24gdGhlIGNvbXBvbmVudC5cbiAgICovXG4gIGhvc3Q/OiB7XG4gICAgLyoqXG4gICAgICogQSBtYXBwaW5nIG9mIGF0dHJpYnV0ZSBuYW1lcyB0byB0aGVpciB2YWx1ZSBleHByZXNzaW9uLlxuICAgICAqL1xuICAgIGF0dHJpYnV0ZXM/OiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufTtcblxuICAgIC8qKlxuICAgICAqIEEgbWFwcGluZyBvZiBldmVudCBuYW1lcyB0byB0aGVpciB1bnBhcnNlZCBldmVudCBoYW5kbGVyIGV4cHJlc3Npb24uXG4gICAgICovXG4gICAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcblxuICAgIC8qKlxuICAgICAqIEEgbWFwcGluZyBvZiBib3VuZCBwcm9wZXJ0aWVzIHRvIHRoZWlyIHVucGFyc2VkIGJpbmRpbmcgZXhwcmVzc2lvbi5cbiAgICAgKi9cbiAgICBwcm9wZXJ0aWVzPzoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2YgdGhlIGNsYXNzIGF0dHJpYnV0ZSwgaWYgcHJlc2VudC4gVGhpcyBpcyBzdG9yZWQgb3V0c2lkZSBvZiBgYXR0cmlidXRlc2AgYXMgaXRzXG4gICAgICogc3RyaW5nIHZhbHVlIG11c3QgYmUga25vd24gc3RhdGljYWxseS5cbiAgICAgKi9cbiAgICBjbGFzc0F0dHJpYnV0ZT86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSB2YWx1ZSBvZiB0aGUgc3R5bGUgYXR0cmlidXRlLCBpZiBwcmVzZW50LiBUaGlzIGlzIHN0b3JlZCBvdXRzaWRlIG9mIGBhdHRyaWJ1dGVzYCBhcyBpdHNcbiAgICAgKiBzdHJpbmcgdmFsdWUgbXVzdCBiZSBrbm93biBzdGF0aWNhbGx5LlxuICAgICAqL1xuICAgIHN0eWxlQXR0cmlidXRlPzogc3RyaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29udGVudCBxdWVyaWVzIG1hZGUgYnkgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHF1ZXJpZXM/OiBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhW107XG5cbiAgLyoqXG4gICAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSB2aWV3IHF1ZXJpZXMgbWFkZSBieSB0aGUgZGlyZWN0aXZlLlxuICAgKi9cbiAgdmlld1F1ZXJpZXM/OiBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhW107XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHByb3ZpZGVycyBwcm92aWRlZCBieSB0aGUgZGlyZWN0aXZlLlxuICAgKi9cbiAgcHJvdmlkZXJzPzogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgbmFtZXMgYnkgd2hpY2ggdGhlIGRpcmVjdGl2ZSBpcyBleHBvcnRlZC5cbiAgICovXG4gIGV4cG9ydEFzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRpcmVjdGl2ZSBoYXMgYW4gaW5oZXJpdGFuY2UgY2xhdXNlLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICovXG4gIHVzZXNJbmhlcml0YW5jZT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRpcmVjdGl2ZSBpbXBsZW1lbnRzIHRoZSBgbmdPbkNoYW5nZXNgIGhvb2suIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKi9cbiAgdXNlc09uQ2hhbmdlcz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIHRoZSBzaGFwZSBvZiB0aGUgb2JqZWN0IHRoYXQgdGhlIGDJtcm1bmdEZWNsYXJlQ29tcG9uZW50KClgIGZ1bmN0aW9uIGFjY2VwdHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGEgZXh0ZW5kcyBSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBUaGUgY29tcG9uZW50J3MgdW5wYXJzZWQgdGVtcGxhdGUgc3RyaW5nIGFzIG9wYXF1ZSBleHByZXNzaW9uLiBUaGUgdGVtcGxhdGUgaXMgcmVwcmVzZW50ZWRcbiAgICogdXNpbmcgZWl0aGVyIGEgc3RyaW5nIGxpdGVyYWwgb3IgdGVtcGxhdGUgbGl0ZXJhbCB3aXRob3V0IHN1YnN0aXR1dGlvbnMsIGJ1dCBpdHMgdmFsdWUgaXNcbiAgICogbm90IHJlYWQgZGlyZWN0bHkuIEluc3RlYWQsIHRoZSB0ZW1wbGF0ZSBwYXJzZXIgaXMgZ2l2ZW4gdGhlIGZ1bGwgc291cmNlIGZpbGUncyB0ZXh0IGFuZFxuICAgKiB0aGUgcmFuZ2Ugb2YgdGhpcyBleHByZXNzaW9uIHRvIHBhcnNlIGRpcmVjdGx5IGZyb20gc291cmNlLlxuICAgKi9cbiAgdGVtcGxhdGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgdGVtcGxhdGUgd2FzIGlubGluZSAodXNpbmcgYHRlbXBsYXRlYCkgb3IgZXh0ZXJuYWwgKHVzaW5nIGB0ZW1wbGF0ZVVybGApLlxuICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICovXG4gIGlzSW5saW5lPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQ1NTIGZyb20gaW5saW5lIHN0eWxlcyBhbmQgaW5jbHVkZWQgc3R5bGVVcmxzLlxuICAgKi9cbiAgc3R5bGVzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgY29tcG9uZW50cyB3aGljaCBtYXRjaGVkIGluIHRoZSB0ZW1wbGF0ZSwgaW5jbHVkaW5nIHN1ZmZpY2llbnRcbiAgICogbWV0YWRhdGEgZm9yIGVhY2ggZGlyZWN0aXZlIHRvIGF0dHJpYnV0ZSBiaW5kaW5ncyBhbmQgcmVmZXJlbmNlcyB3aXRoaW5cbiAgICogdGhlIHRlbXBsYXRlIHRvIGVhY2ggZGlyZWN0aXZlIHNwZWNpZmljYWxseSwgaWYgdGhlIHJ1bnRpbWUgaW5zdHJ1Y3Rpb25zXG4gICAqIHN1cHBvcnQgdGhpcy5cbiAgICovXG4gIGNvbXBvbmVudHM/OiBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlTWV0YWRhdGFbXTtcblxuICAvKipcbiAgICogTGlzdCBvZiBkaXJlY3RpdmVzIHdoaWNoIG1hdGNoZWQgaW4gdGhlIHRlbXBsYXRlLCBpbmNsdWRpbmcgc3VmZmljaWVudFxuICAgKiBtZXRhZGF0YSBmb3IgZWFjaCBkaXJlY3RpdmUgdG8gYXR0cmlidXRlIGJpbmRpbmdzIGFuZCByZWZlcmVuY2VzIHdpdGhpblxuICAgKiB0aGUgdGVtcGxhdGUgdG8gZWFjaCBkaXJlY3RpdmUgc3BlY2lmaWNhbGx5LCBpZiB0aGUgcnVudGltZSBpbnN0cnVjdGlvbnNcbiAgICogc3VwcG9ydCB0aGlzLlxuICAgKi9cbiAgZGlyZWN0aXZlcz86IFIzRGVjbGFyZVVzZWREaXJlY3RpdmVNZXRhZGF0YVtdO1xuXG4gIC8qKlxuICAgKiBBIG1hcCBvZiBwaXBlIG5hbWVzIHRvIGFuIGV4cHJlc3Npb24gcmVmZXJlbmNpbmcgdGhlIHBpcGUgdHlwZSAocG9zc2libHkgYSBmb3J3YXJkIHJlZmVyZW5jZVxuICAgKiB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWZgIGludm9jYXRpb24pIHdoaWNoIGFyZSB1c2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIHBpcGVzPzoge1twaXBlTmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufCgoKSA9PiBvLkV4cHJlc3Npb24pfTtcblxuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgdmlldyBwcm92aWRlcnMgZGVmaW5lZCBpbiB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgdmlld1Byb3ZpZGVycz86IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIG9mIGFuaW1hdGlvbiB0cmlnZ2VycyB0aGF0IHdpbGwgYmUgdXNlZCBpbiB0aGUgY29tcG9uZW50IHRlbXBsYXRlLlxuICAgKi9cbiAgYW5pbWF0aW9ucz86IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogU3RyYXRlZ3kgdXNlZCBmb3IgZGV0ZWN0aW5nIGNoYW5nZXMgaW4gdGhlIGNvbXBvbmVudC5cbiAgICogRGVmYXVsdHMgdG8gYENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHRgLlxuICAgKi9cbiAgY2hhbmdlRGV0ZWN0aW9uPzogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k7XG5cbiAgLyoqXG4gICAqIEFuIGVuY2Fwc3VsYXRpb24gcG9saWN5IGZvciB0aGUgdGVtcGxhdGUgYW5kIENTUyBzdHlsZXMuXG4gICAqIERlZmF1bHRzIHRvIGBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZGAuXG4gICAqL1xuICBlbmNhcHN1bGF0aW9uPzogVmlld0VuY2Fwc3VsYXRpb247XG5cbiAgLyoqXG4gICAqIE92ZXJyaWRlcyB0aGUgZGVmYXVsdCBpbnRlcnBvbGF0aW9uIHN0YXJ0IGFuZCBlbmQgZGVsaW1pdGVycy4gRGVmYXVsdHMgdG8ge3sgYW5kIH19LlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbj86IFtzdHJpbmcsIHN0cmluZ107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgd2hpdGVzcGFjZSBpbiB0aGUgdGVtcGxhdGUgc2hvdWxkIGJlIHByZXNlcnZlZC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqL1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlTWV0YWRhdGEge1xuICAvKipcbiAgICogU2VsZWN0b3Igb2YgdGhlIGRpcmVjdGl2ZS5cbiAgICovXG4gIHNlbGVjdG9yOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFJlZmVyZW5jZSB0byB0aGUgZGlyZWN0aXZlIGNsYXNzIChwb3NzaWJseSBhIGZvcndhcmQgcmVmZXJlbmNlIHdyYXBwZWQgaW4gYSBgZm9yd2FyZFJlZmBcbiAgICogaW52b2NhdGlvbikuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb258KCgpID0+IG8uRXhwcmVzc2lvbik7XG5cbiAgLyoqXG4gICAqIFByb3BlcnR5IG5hbWVzIG9mIHRoZSBkaXJlY3RpdmUncyBpbnB1dHMuXG4gICAqL1xuICBpbnB1dHM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogRXZlbnQgbmFtZXMgb2YgdGhlIGRpcmVjdGl2ZSdzIG91dHB1dHMuXG4gICAqL1xuICBvdXRwdXRzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE5hbWVzIGJ5IHdoaWNoIHRoaXMgZGlyZWN0aXZlIGV4cG9ydHMgaXRzZWxmIGZvciByZWZlcmVuY2VzLlxuICAgKi9cbiAgZXhwb3J0QXM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIHByb3BlcnR5IG9uIHRoZSBjbGFzcyB0byB1cGRhdGUgd2l0aCBxdWVyeSByZXN1bHRzLlxuICAgKi9cbiAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gcmVhZCBvbmx5IHRoZSBmaXJzdCBtYXRjaGluZyByZXN1bHQsIG9yIGFuIGFycmF5IG9mIHJlc3VsdHMuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKi9cbiAgZmlyc3Q/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBFaXRoZXIgYW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSB0eXBlIG9yIGBJbmplY3Rpb25Ub2tlbmAgZm9yIHRoZSBxdWVyeVxuICAgKiBwcmVkaWNhdGUsIG9yIGEgc2V0IG9mIHN0cmluZyBzZWxlY3RvcnMuXG4gICAqL1xuICBwcmVkaWNhdGU6IG8uRXhwcmVzc2lvbnxzdHJpbmdbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBpbmNsdWRlIG9ubHkgZGlyZWN0IGNoaWxkcmVuIG9yIGFsbCBkZXNjZW5kYW50cy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqL1xuICBkZXNjZW5kYW50cz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRydWUgdG8gb25seSBmaXJlIGNoYW5nZXMgaWYgdGhlcmUgYXJlIHVuZGVybHlpbmcgY2hhbmdlcyB0byB0aGUgcXVlcnkuXG4gICAqL1xuICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgdHlwZSB0byByZWFkIGZyb20gZWFjaCBtYXRjaGVkIG5vZGUsIG9yIG51bGwgaWYgdGhlIGRlZmF1bHQgdmFsdWVcbiAgICogZm9yIGEgZ2l2ZW4gbm9kZSBpcyB0byBiZSByZXR1cm5lZC5cbiAgICovXG4gIHJlYWQ/OiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgb3Igbm90IHRoaXMgcXVlcnkgc2hvdWxkIGNvbGxlY3Qgb25seSBzdGF0aWMgcmVzdWx0cy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqXG4gICAqIElmIHN0YXRpYyBpcyB0cnVlLCB0aGUgcXVlcnkncyByZXN1bHRzIHdpbGwgYmUgc2V0IG9uIHRoZSBjb21wb25lbnQgYWZ0ZXIgbm9kZXMgYXJlIGNyZWF0ZWQsXG4gICAqIGJ1dCBiZWZvcmUgY2hhbmdlIGRldGVjdGlvbiBydW5zLiBUaGlzIG1lYW5zIHRoYXQgYW55IHJlc3VsdHMgdGhhdCByZWxpZWQgdXBvbiBjaGFuZ2UgZGV0ZWN0aW9uXG4gICAqIHRvIHJ1biAoZS5nLiByZXN1bHRzIGluc2lkZSAqbmdJZiBvciAqbmdGb3Igdmlld3MpIHdpbGwgbm90IGJlIGNvbGxlY3RlZC4gUXVlcnkgcmVzdWx0cyBhcmVcbiAgICogYXZhaWxhYmxlIGluIHRoZSBuZ09uSW5pdCBob29rLlxuICAgKlxuICAgKiBJZiBzdGF0aWMgaXMgZmFsc2UsIHRoZSBxdWVyeSdzIHJlc3VsdHMgd2lsbCBiZSBzZXQgb24gdGhlIGNvbXBvbmVudCBhZnRlciBjaGFuZ2UgZGV0ZWN0aW9uXG4gICAqIHJ1bnMuIFRoaXMgbWVhbnMgdGhhdCB0aGUgcXVlcnkgcmVzdWx0cyBjYW4gY29udGFpbiBub2RlcyBpbnNpZGUgKm5nSWYgb3IgKm5nRm9yIHZpZXdzLCBidXRcbiAgICogdGhlIHJlc3VsdHMgd2lsbCBub3QgYmUgYXZhaWxhYmxlIGluIHRoZSBuZ09uSW5pdCBob29rIChvbmx5IGluIHRoZSBuZ0FmdGVyQ29udGVudEluaXQgZm9yXG4gICAqIGNvbnRlbnQgaG9va3MgYW5kIG5nQWZ0ZXJWaWV3SW5pdCBmb3IgdmlldyBob29rcykuXG4gICAqL1xuICBzdGF0aWM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIERlc2NyaWJlcyB0aGUgc2hhcGUgb2YgdGhlIG9iamVjdHMgdGhhdCB0aGUgYMm1ybVuZ0RlY2xhcmVOZ01vZHVsZSgpYCBhY2NlcHRzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVjbGFyZU5nTW9kdWxlTWV0YWRhdGEgZXh0ZW5kcyBSM1BhcnRpYWxEZWNsYXJhdGlvbiB7XG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGJvb3RzdHJhcCBjb21wb25lbnRzIHNwZWNpZmllZCBieSB0aGUgbW9kdWxlLlxuICAgKi9cbiAgYm9vdHN0cmFwPzogby5FeHByZXNzaW9uW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgZGlyZWN0aXZlcyBhbmQgcGlwZXMgZGVjbGFyZWQgYnkgdGhlIG1vZHVsZS5cbiAgICovXG4gIGRlY2xhcmF0aW9ucz86IG8uRXhwcmVzc2lvbltdO1xuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGltcG9ydHMgb2YgdGhlIG1vZHVsZS5cbiAgICovXG4gIGltcG9ydHM/OiBvLkV4cHJlc3Npb25bXTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGUuXG4gICAqL1xuICBleHBvcnRzPzogby5FeHByZXNzaW9uW107XG5cbiAgLyoqXG4gICAqIFRoZSBzZXQgb2Ygc2NoZW1hcyB0aGF0IGRlY2xhcmUgZWxlbWVudHMgdG8gYmUgYWxsb3dlZCBpbiB0aGUgTmdNb2R1bGUuXG4gICAqL1xuICBzY2hlbWFzPzogby5FeHByZXNzaW9uW107XG5cbiAgLyoqIFVuaXF1ZSBJRCBvciBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgdW5pcXVlIElEIG9mIGFuIE5nTW9kdWxlLiAqL1xuICBpZD86IG8uRXhwcmVzc2lvbjtcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgdGhlIHNoYXBlIG9mIHRoZSBvYmplY3RzIHRoYXQgdGhlIGDJtcm1bmdEZWNsYXJlSW5qZWN0b3IoKWAgYWNjZXB0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlY2xhcmVJbmplY3Rvck1ldGFkYXRhIGV4dGVuZHMgUjNQYXJ0aWFsRGVjbGFyYXRpb24ge1xuICAvKipcbiAgICogVGhlIGxpc3Qgb2YgcHJvdmlkZXJzIHByb3ZpZGVkIGJ5IHRoZSBpbmplY3Rvci5cbiAgICovXG4gIHByb3ZpZGVycz86IG8uRXhwcmVzc2lvbjtcbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIGltcG9ydHMgaW50byB0aGUgaW5qZWN0b3IuXG4gICAqL1xuICBpbXBvcnRzPzogby5FeHByZXNzaW9uW107XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIHRoZSBzaGFwZSBvZiB0aGUgb2JqZWN0IHRoYXQgdGhlIGDJtcm1bmdEZWNsYXJlUGlwZSgpYCBmdW5jdGlvbiBhY2NlcHRzLlxuICpcbiAqIFRoaXMgaW50ZXJmYWNlIHNlcnZlcyBwcmltYXJpbHkgYXMgZG9jdW1lbnRhdGlvbiwgYXMgY29uZm9ybWFuY2UgdG8gdGhpcyBpbnRlcmZhY2UgaXMgbm90XG4gKiBlbmZvcmNlZCBkdXJpbmcgbGlua2luZy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlY2xhcmVQaXBlTWV0YWRhdGEgZXh0ZW5kcyBSM1BhcnRpYWxEZWNsYXJhdGlvbiB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSB0byB1c2UgaW4gdGVtcGxhdGVzIHRvIHJlZmVyIHRvIHRoaXMgcGlwZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogV2hldGhlciB0aGlzIHBpcGUgaXMgXCJwdXJlXCIuXG4gICAqXG4gICAqIEEgcHVyZSBwaXBlJ3MgYHRyYW5zZm9ybSgpYCBtZXRob2QgaXMgb25seSBpbnZva2VkIHdoZW4gaXRzIGlucHV0IGFyZ3VtZW50cyBjaGFuZ2UuXG4gICAqXG4gICAqIERlZmF1bHQ6IHRydWUuXG4gICAqL1xuICBwdXJlPzogYm9vbGVhbjtcbn1cblxuXG4vKipcbiAqIERlc2NyaWJlcyB0aGUgc2hhcGUgb2YgdGhlIG9iamVjdCB0aGF0IHRoZSBgybXJtW5nRGVjbGFyZUZhY3RvcnkoKWAgZnVuY3Rpb24gYWNjZXB0cy5cbiAqXG4gKiBUaGlzIGludGVyZmFjZSBzZXJ2ZXMgcHJpbWFyaWx5IGFzIGRvY3VtZW50YXRpb24sIGFzIGNvbmZvcm1hbmNlIHRvIHRoaXMgaW50ZXJmYWNlIGlzIG5vdFxuICogZW5mb3JjZWQgZHVyaW5nIGxpbmtpbmcuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZWNsYXJlRmFjdG9yeU1ldGFkYXRhIGV4dGVuZHMgUjNQYXJ0aWFsRGVjbGFyYXRpb24ge1xuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIG9mIGRlcGVuZGVuY2llcyB0aGF0IHRoaXMgZmFjdG9yeSByZWxpZXMgdXBvbi5cbiAgICpcbiAgICogSWYgdGhpcyBpcyBgbnVsbGAsIHRoZW4gdGhlIHR5cGUncyBjb25zdHJ1Y3RvciBpcyBub25leGlzdGVudCBhbmQgd2lsbCBiZSBpbmhlcml0ZWQgZnJvbSBhblxuICAgKiBhbmNlc3RvciBvZiB0aGUgdHlwZS5cbiAgICpcbiAgICogSWYgdGhpcyBpcyBgJ2ludmFsaWQnYCwgdGhlbiBvbmUgb3IgbW9yZSBvZiB0aGUgcGFyYW1ldGVycyB3YXNuJ3QgcmVzb2x2YWJsZSBhbmQgYW55IGF0dGVtcHQgdG9cbiAgICogdXNlIHRoZXNlIGRlcHMgd2lsbCByZXN1bHQgaW4gYSBydW50aW1lIGVycm9yLlxuICAgKi9cbiAgZGVwczogUjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhW118J2ludmFsaWQnfG51bGw7XG5cbiAgLyoqXG4gICAqIFR5cGUgb2YgdGhlIHRhcmdldCBiZWluZyBjcmVhdGVkIGJ5IHRoZSBmYWN0b3J5LlxuICAgKi9cbiAgdGFyZ2V0OiBGYWN0b3J5VGFyZ2V0O1xufVxuXG5leHBvcnQgZW51bSBGYWN0b3J5VGFyZ2V0IHtcbiAgRGlyZWN0aXZlID0gMCxcbiAgQ29tcG9uZW50ID0gMSxcbiAgSW5qZWN0YWJsZSA9IDIsXG4gIFBpcGUgPSAzLFxuICBOZ01vZHVsZSA9IDQsXG59XG5cbi8qKlxuICogRGVzY3JpYmVzIHRoZSBzaGFwZSBvZiB0aGUgb2JqZWN0IHRoYXQgdGhlIGDJtcm1bmdEZWNsYXJlSW5qZWN0YWJsZSgpYCBmdW5jdGlvbiBhY2NlcHRzLlxuICpcbiAqIFRoaXMgaW50ZXJmYWNlIHNlcnZlcyBwcmltYXJpbHkgYXMgZG9jdW1lbnRhdGlvbiwgYXMgY29uZm9ybWFuY2UgdG8gdGhpcyBpbnRlcmZhY2UgaXMgbm90XG4gKiBlbmZvcmNlZCBkdXJpbmcgbGlua2luZy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlY2xhcmVJbmplY3RhYmxlTWV0YWRhdGEgZXh0ZW5kcyBSM1BhcnRpYWxEZWNsYXJhdGlvbiB7XG4gIC8qKlxuICAgKiBJZiBwcm92aWRlZCwgc3BlY2lmaWVzIHRoYXQgdGhlIGRlY2xhcmVkIGluamVjdGFibGUgYmVsb25ncyB0byBhIHBhcnRpY3VsYXIgaW5qZWN0b3I6XG4gICAqIC0gYEluamVjdG9yVHlwZWAgc3VjaCBhcyBgTmdNb2R1bGVgLFxuICAgKiAtIGAncm9vdCdgIHRoZSByb290IGluamVjdG9yXG4gICAqIC0gYCdhbnknYCBhbGwgaW5qZWN0b3JzLlxuICAgKiBJZiBub3QgcHJvdmlkZWQsIHRoZW4gaXQgZG9lcyBub3QgYmVsb25nIHRvIGFueSBpbmplY3Rvci4gTXVzdCBiZSBleHBsaWNpdGx5IGxpc3RlZCBpbiB0aGVcbiAgICogcHJvdmlkZXJzIG9mIGFuIGluamVjdG9yLlxuICAgKi9cbiAgcHJvdmlkZWRJbj86IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogSWYgcHJvdmlkZWQsIGFuIGV4cHJlc3Npb24gdGhhdCBldmFsdWF0ZXMgdG8gYSBjbGFzcyB0byB1c2Ugd2hlbiBjcmVhdGluZyBhbiBpbnN0YW5jZSBvZiB0aGlzXG4gICAqIGluamVjdGFibGUuXG4gICAqL1xuICB1c2VDbGFzcz86IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogSWYgcHJvdmlkZWQsIGFuIGV4cHJlc3Npb24gdGhhdCBldmFsdWF0ZXMgdG8gYSBmdW5jdGlvbiB0byB1c2Ugd2hlbiBjcmVhdGluZyBhbiBpbnN0YW5jZSBvZlxuICAgKiB0aGlzIGluamVjdGFibGUuXG4gICAqL1xuICB1c2VGYWN0b3J5Pzogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBJZiBwcm92aWRlZCwgYW4gZXhwcmVzc2lvbiB0aGF0IGV2YWx1YXRlcyB0byBhIHRva2VuIG9mIGFub3RoZXIgaW5qZWN0YWJsZSB0aGF0IHRoaXMgaW5qZWN0YWJsZVxuICAgKiBhbGlhc2VzLlxuICAgKi9cbiAgdXNlRXhpc3Rpbmc/OiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIElmIHByb3ZpZGVkLCBhbiBleHByZXNzaW9uIHRoYXQgZXZhbHVhdGVzIHRvIHRoZSB2YWx1ZSBvZiB0aGUgaW5zdGFuY2Ugb2YgdGhpcyBpbmplY3RhYmxlLlxuICAgKi9cbiAgdXNlVmFsdWU/OiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGRlcGVuZGVuY2llcyB0byBzdXBwb3J0IGluc3RhbnRpYXRpbmcgdGhpcyBpbmplY3RhYmxlIHZpYSBgdXNlQ2xhc3NgIG9yXG4gICAqIGB1c2VGYWN0b3J5YC5cbiAgICovXG4gIGRlcHM/OiBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFbXTtcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSBpbmRpY2F0aW5nIGhvdyBhIGRlcGVuZGVuY3kgc2hvdWxkIGJlIGluamVjdGVkIGludG8gYSBmYWN0b3J5LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgdG9rZW4gb3IgdmFsdWUgdG8gYmUgaW5qZWN0ZWQsIG9yIGBudWxsYCBpZiB0aGUgZGVwZW5kZW5jeSBpc1xuICAgKiBub3QgdmFsaWQuXG4gICAqXG4gICAqIElmIHRoaXMgZGVwZW5kZW5jeSBpcyBkdWUgdG8gdGhlIGBAQXR0cmlidXRlKClgIGRlY29yYXRvciwgdGhlbiB0aGlzIGlzIGFuIGV4cHJlc3Npb25cbiAgICogZXZhbHVhdGluZyB0byB0aGUgbmFtZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgKi9cbiAgdG9rZW46IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGlzIGluamVjdGluZyBhbiBhdHRyaWJ1dGUgdmFsdWUuXG4gICAqIERlZmF1bHQ6IGZhbHNlLlxuICAgKi9cbiAgYXR0cmlidXRlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQEhvc3QgcXVhbGlmaWVyLlxuICAgKiBEZWZhdWx0OiBmYWxzZSxcbiAgICovXG4gIGhvc3Q/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAT3B0aW9uYWwgcXVhbGlmaWVyLlxuICAgKiBEZWZhdWx0OiBmYWxzZSxcbiAgICovXG4gIG9wdGlvbmFsPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQFNlbGYgcXVhbGlmaWVyLlxuICAgKiBEZWZhdWx0OiBmYWxzZSxcbiAgICovXG4gIHNlbGY/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2tpcFNlbGYgcXVhbGlmaWVyLlxuICAgKiBEZWZhdWx0OiBmYWxzZSxcbiAgICovXG4gIHNraXBTZWxmPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgdGhlIHNoYXBlIG9mIHRoZSBvYmplY3QgdGhhdCB0aGUgYMm1ybVuZ0RlY2xhcmVDbGFzc01ldGFkYXRhKClgIGZ1bmN0aW9uIGFjY2VwdHMuXG4gKlxuICogVGhpcyBpbnRlcmZhY2Ugc2VydmVzIHByaW1hcmlseSBhcyBkb2N1bWVudGF0aW9uLCBhcyBjb25mb3JtYW5jZSB0byB0aGlzIGludGVyZmFjZSBpcyBub3RcbiAqIGVuZm9yY2VkIGR1cmluZyBsaW5raW5nLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVjbGFyZUNsYXNzTWV0YWRhdGEgZXh0ZW5kcyBSM1BhcnRpYWxEZWNsYXJhdGlvbiB7XG4gIC8qKlxuICAgKiBUaGUgQW5ndWxhciBkZWNvcmF0b3JzIG9mIHRoZSBjbGFzcy5cbiAgICovXG4gIGRlY29yYXRvcnM6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogT3B0aW9uYWxseSBzcGVjaWZpZXMgdGhlIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMsIHRoZWlyIHR5cGVzIGFuZCB0aGUgQW5ndWxhciBkZWNvcmF0b3JzIG9mIGVhY2hcbiAgICogcGFyYW1ldGVyLiBUaGlzIHByb3BlcnR5IGlzIG9taXR0ZWQgaWYgdGhlIGNsYXNzIGRvZXMgbm90IGhhdmUgYSBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIGN0b3JQYXJhbWV0ZXJzPzogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBPcHRpb25hbGx5IHNwZWNpZmllcyB0aGUgQW5ndWxhciBkZWNvcmF0b3JzIGFwcGxpZWQgdG8gdGhlIGNsYXNzIHByb3BlcnRpZXMuIFRoaXMgcHJvcGVydHkgaXNcbiAgICogb21pdHRlZCBpZiBubyBwcm9wZXJ0aWVzIGhhdmUgYW55IGRlY29yYXRvcnMuXG4gICAqL1xuICBwcm9wRGVjb3JhdG9ycz86IG8uRXhwcmVzc2lvbjtcbn1cbiJdfQ==