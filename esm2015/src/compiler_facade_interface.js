/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export var R3ResolvedDependencyType;
(function (R3ResolvedDependencyType) {
    R3ResolvedDependencyType[R3ResolvedDependencyType["Token"] = 0] = "Token";
    R3ResolvedDependencyType[R3ResolvedDependencyType["Attribute"] = 1] = "Attribute";
    R3ResolvedDependencyType[R3ResolvedDependencyType["ChangeDetectorRef"] = 2] = "ChangeDetectorRef";
    R3ResolvedDependencyType[R3ResolvedDependencyType["Invalid"] = 3] = "Invalid";
})(R3ResolvedDependencyType || (R3ResolvedDependencyType = {}));
export var R3FactoryTarget;
(function (R3FactoryTarget) {
    R3FactoryTarget[R3FactoryTarget["Directive"] = 0] = "Directive";
    R3FactoryTarget[R3FactoryTarget["Component"] = 1] = "Component";
    R3FactoryTarget[R3FactoryTarget["Injectable"] = 2] = "Injectable";
    R3FactoryTarget[R3FactoryTarget["Pipe"] = 3] = "Pipe";
    R3FactoryTarget[R3FactoryTarget["NgModule"] = 4] = "NgModule";
})(R3FactoryTarget || (R3FactoryTarget = {}));
export var ViewEncapsulation;
(function (ViewEncapsulation) {
    ViewEncapsulation[ViewEncapsulation["Emulated"] = 0] = "Emulated";
    // Historically the 1 value was for `Native` encapsulation which has been removed as of v11.
    ViewEncapsulation[ViewEncapsulation["None"] = 2] = "None";
    ViewEncapsulation[ViewEncapsulation["ShadowDom"] = 3] = "ShadowDom";
})(ViewEncapsulation || (ViewEncapsulation = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQXFFSCxNQUFNLENBQU4sSUFBWSx3QkFLWDtBQUxELFdBQVksd0JBQXdCO0lBQ2xDLHlFQUFTLENBQUE7SUFDVCxpRkFBYSxDQUFBO0lBQ2IsaUdBQXFCLENBQUE7SUFDckIsNkVBQVcsQ0FBQTtBQUNiLENBQUMsRUFMVyx3QkFBd0IsS0FBeEIsd0JBQXdCLFFBS25DO0FBRUQsTUFBTSxDQUFOLElBQVksZUFNWDtBQU5ELFdBQVksZUFBZTtJQUN6QiwrREFBYSxDQUFBO0lBQ2IsK0RBQWEsQ0FBQTtJQUNiLGlFQUFjLENBQUE7SUFDZCxxREFBUSxDQUFBO0lBQ1IsNkRBQVksQ0FBQTtBQUNkLENBQUMsRUFOVyxlQUFlLEtBQWYsZUFBZSxRQU0xQjtBQTJJRCxNQUFNLENBQU4sSUFBWSxpQkFLWDtBQUxELFdBQVksaUJBQWlCO0lBQzNCLGlFQUFZLENBQUE7SUFDWiw0RkFBNEY7SUFDNUYseURBQVEsQ0FBQTtJQUNSLG1FQUFhLENBQUE7QUFDZixDQUFDLEVBTFcsaUJBQWlCLEtBQWpCLGlCQUFpQixRQUs1QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbi8qKlxuICogQSBzZXQgb2YgaW50ZXJmYWNlcyB3aGljaCBhcmUgc2hhcmVkIGJldHdlZW4gYEBhbmd1bGFyL2NvcmVgIGFuZCBgQGFuZ3VsYXIvY29tcGlsZXJgIHRvIGFsbG93XG4gKiBmb3IgbGF0ZSBiaW5kaW5nIG9mIGBAYW5ndWxhci9jb21waWxlcmAgZm9yIEpJVCBwdXJwb3Nlcy5cbiAqXG4gKiBUaGlzIGZpbGUgaGFzIHR3byBjb3BpZXMuIFBsZWFzZSBlbnN1cmUgdGhhdCB0aGV5IGFyZSBpbiBzeW5jOlxuICogIC0gcGFja2FnZXMvY29tcGlsZXIvc3JjL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UudHMgICAgICAgICAgKG1haW4pXG4gKiAgLSBwYWNrYWdlcy9jb3JlL3NyYy9jb21waWxlci9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlLnRzICAgICAocmVwbGljYSlcbiAqXG4gKiBQbGVhc2UgZW5zdXJlIHRoYXQgdGhlIHR3byBmaWxlcyBhcmUgaW4gc3luYyB1c2luZyB0aGlzIGNvbW1hbmQ6XG4gKiBgYGBcbiAqIGNwIHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlLnRzIFxcXG4gKiAgICBwYWNrYWdlcy9jb3JlL3NyYy9jb21waWxlci9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlLnRzXG4gKiBgYGBcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUge1xuICDJtWNvbXBpbGVyRmFjYWRlOiBDb21waWxlckZhY2FkZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlckZhY2FkZSB7XG4gIGNvbXBpbGVQaXBlKGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM1BpcGVNZXRhZGF0YUZhY2FkZSk6XG4gICAgICBhbnk7XG4gIGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlKTogYW55O1xuICBjb21waWxlSW5qZWN0b3IoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlKTogYW55O1xuICBjb21waWxlTmdNb2R1bGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlKTogYW55O1xuICBjb21waWxlRGlyZWN0aXZlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBhbnk7XG4gIGNvbXBpbGVEaXJlY3RpdmVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSk6IGFueTtcbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55O1xuICBjb21waWxlQ29tcG9uZW50RGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUpOiBhbnk7XG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKTogYW55O1xuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuO1xuXG4gIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTogdHlwZW9mIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTtcbiAgUjNGYWN0b3J5VGFyZ2V0OiB0eXBlb2YgUjNGYWN0b3J5VGFyZ2V0O1xuICBSZXNvdXJjZUxvYWRlcjoge25ldygpOiBSZXNvdXJjZUxvYWRlcn07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29yZUVudmlyb25tZW50IHtcbiAgW25hbWU6IHN0cmluZ106IEZ1bmN0aW9uO1xufVxuXG5leHBvcnQgdHlwZSBSZXNvdXJjZUxvYWRlciA9IHtcbiAgZ2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+fHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFN0cmluZ01hcCA9IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xufTtcblxuZXhwb3J0IHR5cGUgU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nfFtzdHJpbmcsIHN0cmluZ107XG59O1xuXG5leHBvcnQgdHlwZSBQcm92aWRlciA9IGFueTtcblxuZXhwb3J0IGVudW0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIHtcbiAgVG9rZW4gPSAwLFxuICBBdHRyaWJ1dGUgPSAxLFxuICBDaGFuZ2VEZXRlY3RvclJlZiA9IDIsXG4gIEludmFsaWQgPSAzLFxufVxuXG5leHBvcnQgZW51bSBSM0ZhY3RvcnlUYXJnZXQge1xuICBEaXJlY3RpdmUgPSAwLFxuICBDb21wb25lbnQgPSAxLFxuICBJbmplY3RhYmxlID0gMixcbiAgUGlwZSA9IDMsXG4gIE5nTW9kdWxlID0gNCxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSB7XG4gIHRva2VuOiBhbnk7XG4gIHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU7XG4gIGhvc3Q6IGJvb2xlYW47XG4gIG9wdGlvbmFsOiBib29sZWFuO1xuICBzZWxmOiBib29sZWFuO1xuICBza2lwU2VsZjogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM1BpcGVNZXRhZGF0YUZhY2FkZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogYW55O1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICBwaXBlTmFtZTogc3RyaW5nO1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGw7XG4gIHB1cmU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IGFueTtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgcHJvdmlkZWRJbjogYW55O1xuICB1c2VDbGFzcz86IGFueTtcbiAgdXNlRmFjdG9yeT86IGFueTtcbiAgdXNlRXhpc3Rpbmc/OiBhbnk7XG4gIHVzZVZhbHVlPzogYW55O1xuICB1c2VyRGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlIHtcbiAgdHlwZTogYW55O1xuICBib290c3RyYXA6IEZ1bmN0aW9uW107XG4gIGRlY2xhcmF0aW9uczogRnVuY3Rpb25bXTtcbiAgaW1wb3J0czogRnVuY3Rpb25bXTtcbiAgZXhwb3J0czogRnVuY3Rpb25bXTtcbiAgc2NoZW1hczoge25hbWU6IHN0cmluZ31bXXxudWxsO1xuICBpZDogc3RyaW5nfG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBhbnk7XG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlW118bnVsbDtcbiAgcHJvdmlkZXJzOiBhbnlbXTtcbiAgaW1wb3J0czogYW55W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogYW55O1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGw7XG4gIHNlbGVjdG9yOiBzdHJpbmd8bnVsbDtcbiAgcXVlcmllczogUjNRdWVyeU1ldGFkYXRhRmFjYWRlW107XG4gIGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX07XG4gIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGJvb2xlYW47fTtcbiAgaW5wdXRzOiBzdHJpbmdbXTtcbiAgb3V0cHV0czogc3RyaW5nW107XG4gIHVzZXNJbmhlcml0YW5jZTogYm9vbGVhbjtcbiAgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGw7XG4gIHByb3ZpZGVyczogUHJvdmlkZXJbXXxudWxsO1xuICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhRmFjYWRlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSBleHRlbmRzIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUge1xuICB0ZW1wbGF0ZTogc3RyaW5nO1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuO1xuICBhbmltYXRpb25zOiBhbnlbXXx1bmRlZmluZWQ7XG4gIHBpcGVzOiBNYXA8c3RyaW5nLCBhbnk+O1xuICBkaXJlY3RpdmVzOiBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YVtdO1xuICBzdHlsZXM6IHN0cmluZ1tdO1xuICBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbjtcbiAgdmlld1Byb3ZpZGVyczogUHJvdmlkZXJbXXxudWxsO1xuICBpbnRlcnBvbGF0aW9uPzogW3N0cmluZywgc3RyaW5nXTtcbiAgY2hhbmdlRGV0ZWN0aW9uPzogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k7XG59XG5cbmV4cG9ydCB0eXBlIE9wYXF1ZVZhbHVlID0gdW5rbm93bjtcblxuZXhwb3J0IGludGVyZmFjZSBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUge1xuICBzZWxlY3Rvcj86IHN0cmluZztcbiAgdHlwZTogRnVuY3Rpb247XG4gIGlucHV0cz86IHtbY2xhc3NQcm9wZXJ0eU5hbWU6IHN0cmluZ106IHN0cmluZ3xbc3RyaW5nLCBzdHJpbmddfTtcbiAgb3V0cHV0cz86IHtbY2xhc3NQcm9wZXJ0eU5hbWU6IHN0cmluZ106IHN0cmluZ307XG4gIGhvc3Q/OiB7XG4gICAgYXR0cmlidXRlcz86IHtba2V5OiBzdHJpbmddOiBPcGFxdWVWYWx1ZX07XG4gICAgbGlzdGVuZXJzPzoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gICAgcHJvcGVydGllcz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICAgIGNsYXNzQXR0cmlidXRlPzogc3RyaW5nO1xuICAgIHN0eWxlQXR0cmlidXRlPzogc3RyaW5nO1xuICB9O1xuICBxdWVyaWVzPzogUjNEZWNsYXJlUXVlcnlNZXRhZGF0YUZhY2FkZVtdO1xuICB2aWV3UXVlcmllcz86IFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFGYWNhZGVbXTtcbiAgcHJvdmlkZXJzPzogT3BhcXVlVmFsdWU7XG4gIGV4cG9ydEFzPzogc3RyaW5nW107XG4gIHVzZXNJbmhlcml0YW5jZT86IGJvb2xlYW47XG4gIHVzZXNPbkNoYW5nZXM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSBleHRlbmRzIFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSB7XG4gIHRlbXBsYXRlOiB7c291cmNlOiBzdHJpbmc7IGlzSW5saW5lOiBib29sZWFuO307XG4gIHN0eWxlcz86IHN0cmluZ1tdO1xuICBkaXJlY3RpdmVzPzoge1xuICAgIHNlbGVjdG9yOiBzdHJpbmc7IHR5cGU6IE9wYXF1ZVZhbHVlIHwgKCgpID0+IE9wYXF1ZVZhbHVlKTtcbiAgICBpbnB1dHM/OiBzdHJpbmdbXTtcbiAgICBvdXRwdXRzPzogc3RyaW5nW107XG4gICAgZXhwb3J0QXM/OiBzdHJpbmdbXTtcbiAgfVtdO1xuICBwaXBlcz86IHtbcGlwZU5hbWU6IHN0cmluZ106IE9wYXF1ZVZhbHVlfCgoKSA9PiBPcGFxdWVWYWx1ZSl9O1xuICB2aWV3UHJvdmlkZXJzPzogT3BhcXVlVmFsdWU7XG4gIGFuaW1hdGlvbnM/OiBPcGFxdWVWYWx1ZTtcbiAgY2hhbmdlRGV0ZWN0aW9uPzogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k7XG4gIGVuY2Fwc3VsYXRpb24/OiBWaWV3RW5jYXBzdWxhdGlvbjtcbiAgaW50ZXJwb2xhdGlvbj86IFtzdHJpbmcsIHN0cmluZ107XG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgc2VsZWN0b3I6IHN0cmluZztcbiAgaW5wdXRzOiBzdHJpbmdbXTtcbiAgb3V0cHV0czogc3RyaW5nW107XG4gIGV4cG9ydEFzOiBzdHJpbmdbXXxudWxsO1xuICB0eXBlOiBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IGFueTtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXXxudWxsO1xuICBpbmplY3RGbjogJ2RpcmVjdGl2ZUluamVjdCd8J2luamVjdCc7XG4gIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0O1xufVxuXG5leHBvcnQgZW51bSBWaWV3RW5jYXBzdWxhdGlvbiB7XG4gIEVtdWxhdGVkID0gMCxcbiAgLy8gSGlzdG9yaWNhbGx5IHRoZSAxIHZhbHVlIHdhcyBmb3IgYE5hdGl2ZWAgZW5jYXBzdWxhdGlvbiB3aGljaCBoYXMgYmVlbiByZW1vdmVkIGFzIG9mIHYxMS5cbiAgTm9uZSA9IDIsXG4gIFNoYWRvd0RvbSA9IDNcbn1cblxuZXhwb3J0IHR5cGUgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kgPSBudW1iZXI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNRdWVyeU1ldGFkYXRhRmFjYWRlIHtcbiAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gIGZpcnN0OiBib29sZWFuO1xuICBwcmVkaWNhdGU6IGFueXxzdHJpbmdbXTtcbiAgZGVzY2VuZGFudHM6IGJvb2xlYW47XG4gIHJlYWQ6IGFueXxudWxsO1xuICBzdGF0aWM6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YUZhY2FkZSB7XG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICBmaXJzdD86IGJvb2xlYW47XG4gIHByZWRpY2F0ZTogT3BhcXVlVmFsdWV8c3RyaW5nW107XG4gIGRlc2NlbmRhbnRzPzogYm9vbGVhbjtcbiAgcmVhZD86IE9wYXF1ZVZhbHVlO1xuICBzdGF0aWM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlU291cmNlU3BhbiB7XG4gIHN0YXJ0OiBhbnk7XG4gIGVuZDogYW55O1xuICBkZXRhaWxzOiBhbnk7XG4gIGZ1bGxTdGFydDogYW55O1xufVxuIl19