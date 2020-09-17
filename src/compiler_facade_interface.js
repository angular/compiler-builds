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
        define("@angular/compiler/src/compiler_facade_interface", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ViewEncapsulation = exports.R3FactoryTarget = exports.R3ResolvedDependencyType = void 0;
    var R3ResolvedDependencyType;
    (function (R3ResolvedDependencyType) {
        R3ResolvedDependencyType[R3ResolvedDependencyType["Token"] = 0] = "Token";
        R3ResolvedDependencyType[R3ResolvedDependencyType["Attribute"] = 1] = "Attribute";
        R3ResolvedDependencyType[R3ResolvedDependencyType["ChangeDetectorRef"] = 2] = "ChangeDetectorRef";
        R3ResolvedDependencyType[R3ResolvedDependencyType["Invalid"] = 3] = "Invalid";
    })(R3ResolvedDependencyType = exports.R3ResolvedDependencyType || (exports.R3ResolvedDependencyType = {}));
    var R3FactoryTarget;
    (function (R3FactoryTarget) {
        R3FactoryTarget[R3FactoryTarget["Directive"] = 0] = "Directive";
        R3FactoryTarget[R3FactoryTarget["Component"] = 1] = "Component";
        R3FactoryTarget[R3FactoryTarget["Injectable"] = 2] = "Injectable";
        R3FactoryTarget[R3FactoryTarget["Pipe"] = 3] = "Pipe";
        R3FactoryTarget[R3FactoryTarget["NgModule"] = 4] = "NgModule";
    })(R3FactoryTarget = exports.R3FactoryTarget || (exports.R3FactoryTarget = {}));
    var ViewEncapsulation;
    (function (ViewEncapsulation) {
        ViewEncapsulation[ViewEncapsulation["Emulated"] = 0] = "Emulated";
        ViewEncapsulation[ViewEncapsulation["Native"] = 1] = "Native";
        ViewEncapsulation[ViewEncapsulation["None"] = 2] = "None";
        ViewEncapsulation[ViewEncapsulation["ShadowDom"] = 3] = "ShadowDom";
    })(ViewEncapsulation = exports.ViewEncapsulation || (exports.ViewEncapsulation = {}));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQStESCxJQUFZLHdCQUtYO0lBTEQsV0FBWSx3QkFBd0I7UUFDbEMseUVBQVMsQ0FBQTtRQUNULGlGQUFhLENBQUE7UUFDYixpR0FBcUIsQ0FBQTtRQUNyQiw2RUFBVyxDQUFBO0lBQ2IsQ0FBQyxFQUxXLHdCQUF3QixHQUF4QixnQ0FBd0IsS0FBeEIsZ0NBQXdCLFFBS25DO0lBRUQsSUFBWSxlQU1YO0lBTkQsV0FBWSxlQUFlO1FBQ3pCLCtEQUFhLENBQUE7UUFDYiwrREFBYSxDQUFBO1FBQ2IsaUVBQWMsQ0FBQTtRQUNkLHFEQUFRLENBQUE7UUFDUiw2REFBWSxDQUFBO0lBQ2QsQ0FBQyxFQU5XLGVBQWUsR0FBZix1QkFBZSxLQUFmLHVCQUFlLFFBTTFCO0lBMkZELElBQVksaUJBS1g7SUFMRCxXQUFZLGlCQUFpQjtRQUMzQixpRUFBWSxDQUFBO1FBQ1osNkRBQVUsQ0FBQTtRQUNWLHlEQUFRLENBQUE7UUFDUixtRUFBYSxDQUFBO0lBQ2YsQ0FBQyxFQUxXLGlCQUFpQixHQUFqQix5QkFBaUIsS0FBakIseUJBQWlCLFFBSzVCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuLyoqXG4gKiBBIHNldCBvZiBpbnRlcmZhY2VzIHdoaWNoIGFyZSBzaGFyZWQgYmV0d2VlbiBgQGFuZ3VsYXIvY29yZWAgYW5kIGBAYW5ndWxhci9jb21waWxlcmAgdG8gYWxsb3dcbiAqIGZvciBsYXRlIGJpbmRpbmcgb2YgYEBhbmd1bGFyL2NvbXBpbGVyYCBmb3IgSklUIHB1cnBvc2VzLlxuICpcbiAqIFRoaXMgZmlsZSBoYXMgdHdvIGNvcGllcy4gUGxlYXNlIGVuc3VyZSB0aGF0IHRoZXkgYXJlIGluIHN5bmM6XG4gKiAgLSBwYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS50cyAgICAgICAgICAgICAobWFzdGVyKVxuICogIC0gcGFja2FnZXMvY29yZS9zcmMvY29tcGlsZXIvY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS50cyAgICAgKGNvcHkpXG4gKlxuICogUGxlYXNlIGVuc3VyZSB0aGF0IHRoZSB0d28gZmlsZXMgYXJlIGluIHN5bmMgdXNpbmcgdGhpcyBjb21tYW5kOlxuICogYGBgXG4gKiBjcCBwYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS50cyBcXFxuICogICAgcGFja2FnZXMvY29yZS9zcmMvY29tcGlsZXIvY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS50c1xuICogYGBgXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBFeHBvcnRlZENvbXBpbGVyRmFjYWRlIHtcbiAgybVjb21waWxlckZhY2FkZTogQ29tcGlsZXJGYWNhZGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJGYWNhZGUge1xuICBjb21waWxlUGlwZShhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNQaXBlTWV0YWRhdGFGYWNhZGUpOlxuICAgICAgYW55O1xuICBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSk6IGFueTtcbiAgY29tcGlsZUluamVjdG9yKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSk6IGFueTtcbiAgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSk6IGFueTtcbiAgY29tcGlsZURpcmVjdGl2ZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogYW55O1xuICBjb21waWxlQ29tcG9uZW50KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUpOiBhbnk7XG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKTogYW55O1xuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuO1xuXG4gIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTogdHlwZW9mIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTtcbiAgUjNGYWN0b3J5VGFyZ2V0OiB0eXBlb2YgUjNGYWN0b3J5VGFyZ2V0O1xuICBSZXNvdXJjZUxvYWRlcjoge25ldygpOiBSZXNvdXJjZUxvYWRlcn07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29yZUVudmlyb25tZW50IHtcbiAgW25hbWU6IHN0cmluZ106IEZ1bmN0aW9uO1xufVxuXG5leHBvcnQgdHlwZSBSZXNvdXJjZUxvYWRlciA9IHtcbiAgZ2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+fHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFN0cmluZ01hcCA9IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xufTtcblxuZXhwb3J0IHR5cGUgU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nfFtzdHJpbmcsIHN0cmluZ107XG59O1xuXG5leHBvcnQgdHlwZSBQcm92aWRlciA9IGFueTtcblxuZXhwb3J0IGVudW0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIHtcbiAgVG9rZW4gPSAwLFxuICBBdHRyaWJ1dGUgPSAxLFxuICBDaGFuZ2VEZXRlY3RvclJlZiA9IDIsXG4gIEludmFsaWQgPSAzLFxufVxuXG5leHBvcnQgZW51bSBSM0ZhY3RvcnlUYXJnZXQge1xuICBEaXJlY3RpdmUgPSAwLFxuICBDb21wb25lbnQgPSAxLFxuICBJbmplY3RhYmxlID0gMixcbiAgUGlwZSA9IDMsXG4gIE5nTW9kdWxlID0gNCxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSB7XG4gIHRva2VuOiBhbnk7XG4gIHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU7XG4gIGhvc3Q6IGJvb2xlYW47XG4gIG9wdGlvbmFsOiBib29sZWFuO1xuICBzZWxmOiBib29sZWFuO1xuICBza2lwU2VsZjogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM1BpcGVNZXRhZGF0YUZhY2FkZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogYW55O1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICBwaXBlTmFtZTogc3RyaW5nO1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGw7XG4gIHB1cmU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IGFueTtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgcHJvdmlkZWRJbjogYW55O1xuICB1c2VDbGFzcz86IGFueTtcbiAgdXNlRmFjdG9yeT86IGFueTtcbiAgdXNlRXhpc3Rpbmc/OiBhbnk7XG4gIHVzZVZhbHVlPzogYW55O1xuICB1c2VyRGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlIHtcbiAgdHlwZTogYW55O1xuICBib290c3RyYXA6IEZ1bmN0aW9uW107XG4gIGRlY2xhcmF0aW9uczogRnVuY3Rpb25bXTtcbiAgaW1wb3J0czogRnVuY3Rpb25bXTtcbiAgZXhwb3J0czogRnVuY3Rpb25bXTtcbiAgc2NoZW1hczoge25hbWU6IHN0cmluZ31bXXxudWxsO1xuICBpZDogc3RyaW5nfG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBhbnk7XG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlW118bnVsbDtcbiAgcHJvdmlkZXJzOiBhbnlbXTtcbiAgaW1wb3J0czogYW55W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogYW55O1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuICB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGw7XG4gIHNlbGVjdG9yOiBzdHJpbmd8bnVsbDtcbiAgcXVlcmllczogUjNRdWVyeU1ldGFkYXRhRmFjYWRlW107XG4gIGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX07XG4gIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGJvb2xlYW47fTtcbiAgaW5wdXRzOiBzdHJpbmdbXTtcbiAgb3V0cHV0czogc3RyaW5nW107XG4gIHVzZXNJbmhlcml0YW5jZTogYm9vbGVhbjtcbiAgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGw7XG4gIHByb3ZpZGVyczogUHJvdmlkZXJbXXxudWxsO1xuICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhRmFjYWRlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSBleHRlbmRzIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUge1xuICB0ZW1wbGF0ZTogc3RyaW5nO1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuO1xuICBhbmltYXRpb25zOiBhbnlbXXx1bmRlZmluZWQ7XG4gIHBpcGVzOiBNYXA8c3RyaW5nLCBhbnk+O1xuICBkaXJlY3RpdmVzOiB7c2VsZWN0b3I6IHN0cmluZywgZXhwcmVzc2lvbjogYW55fVtdO1xuICBzdHlsZXM6IHN0cmluZ1tdO1xuICBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbjtcbiAgdmlld1Byb3ZpZGVyczogUHJvdmlkZXJbXXxudWxsO1xuICBpbnRlcnBvbGF0aW9uPzogW3N0cmluZywgc3RyaW5nXTtcbiAgY2hhbmdlRGV0ZWN0aW9uPzogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IGFueTtcbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXXxudWxsO1xuICBpbmplY3RGbjogJ2RpcmVjdGl2ZUluamVjdCd8J2luamVjdCc7XG4gIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0O1xufVxuXG5leHBvcnQgZW51bSBWaWV3RW5jYXBzdWxhdGlvbiB7XG4gIEVtdWxhdGVkID0gMCxcbiAgTmF0aXZlID0gMSxcbiAgTm9uZSA9IDIsXG4gIFNoYWRvd0RvbSA9IDNcbn1cblxuZXhwb3J0IHR5cGUgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kgPSBudW1iZXI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNRdWVyeU1ldGFkYXRhRmFjYWRlIHtcbiAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gIGZpcnN0OiBib29sZWFuO1xuICBwcmVkaWNhdGU6IGFueXxzdHJpbmdbXTtcbiAgZGVzY2VuZGFudHM6IGJvb2xlYW47XG4gIHJlYWQ6IGFueXxudWxsO1xuICBzdGF0aWM6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VTb3VyY2VTcGFuIHtcbiAgc3RhcnQ6IGFueTtcbiAgZW5kOiBhbnk7XG4gIGRldGFpbHM6IGFueTtcbn1cbiJdfQ==