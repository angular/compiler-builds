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
        define("@angular/compiler/src/render3/r3_jit", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.R3JitReflector = void 0;
    /**
     * Implementation of `CompileReflector` which resolves references to @angular/core
     * symbols at runtime, according to a consumer-provided mapping.
     *
     * Only supports `resolveExternalReference`, all other methods throw.
     */
    var R3JitReflector = /** @class */ (function () {
        function R3JitReflector(context) {
            this.context = context;
        }
        R3JitReflector.prototype.resolveExternalReference = function (ref) {
            // This reflector only handles @angular/core imports.
            if (ref.moduleName !== '@angular/core') {
                throw new Error("Cannot resolve external reference to " + ref.moduleName + ", only references to @angular/core are supported.");
            }
            if (!this.context.hasOwnProperty(ref.name)) {
                throw new Error("No value provided for @angular/core symbol '" + ref.name + "'.");
            }
            return this.context[ref.name];
        };
        R3JitReflector.prototype.parameters = function (typeOrFunc) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.annotations = function (typeOrFunc) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.shallowAnnotations = function (typeOrFunc) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.tryAnnotations = function (typeOrFunc) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.propMetadata = function (typeOrFunc) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.hasLifecycleHook = function (type, lcProperty) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.guards = function (typeOrFunc) {
            throw new Error('Not implemented.');
        };
        R3JitReflector.prototype.componentModuleUrl = function (type, cmpMetadata) {
            throw new Error('Not implemented.');
        };
        return R3JitReflector;
    }());
    exports.R3JitReflector = R3JitReflector;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaml0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfaml0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUtIOzs7OztPQUtHO0lBQ0g7UUFDRSx3QkFBb0IsT0FBNkI7WUFBN0IsWUFBTyxHQUFQLE9BQU8sQ0FBc0I7UUFBRyxDQUFDO1FBRXJELGlEQUF3QixHQUF4QixVQUF5QixHQUF3QjtZQUMvQyxxREFBcUQ7WUFDckQsSUFBSSxHQUFHLENBQUMsVUFBVSxLQUFLLGVBQWUsRUFBRTtnQkFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FDWixHQUFHLENBQUMsVUFBVSxzREFBbUQsQ0FBQyxDQUFDO2FBQ3hFO1lBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFLLENBQUMsRUFBRTtnQkFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBK0MsR0FBRyxDQUFDLElBQUssT0FBSSxDQUFDLENBQUM7YUFDL0U7WUFDRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFFRCxtQ0FBVSxHQUFWLFVBQVcsVUFBZTtZQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELG9DQUFXLEdBQVgsVUFBWSxVQUFlO1lBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBRUQsMkNBQWtCLEdBQWxCLFVBQW1CLFVBQWU7WUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFFRCx1Q0FBYyxHQUFkLFVBQWUsVUFBZTtZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELHFDQUFZLEdBQVosVUFBYSxVQUFlO1lBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBRUQseUNBQWdCLEdBQWhCLFVBQWlCLElBQVMsRUFBRSxVQUFrQjtZQUM1QyxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELCtCQUFNLEdBQU4sVUFBTyxVQUFlO1lBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBRUQsMkNBQWtCLEdBQWxCLFVBQW1CLElBQVMsRUFBRSxXQUFnQjtZQUM1QyxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUNILHFCQUFDO0lBQUQsQ0FBQyxBQTlDRCxJQThDQztJQTlDWSx3Q0FBYyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuLyoqXG4gKiBJbXBsZW1lbnRhdGlvbiBvZiBgQ29tcGlsZVJlZmxlY3RvcmAgd2hpY2ggcmVzb2x2ZXMgcmVmZXJlbmNlcyB0byBAYW5ndWxhci9jb3JlXG4gKiBzeW1ib2xzIGF0IHJ1bnRpbWUsIGFjY29yZGluZyB0byBhIGNvbnN1bWVyLXByb3ZpZGVkIG1hcHBpbmcuXG4gKlxuICogT25seSBzdXBwb3J0cyBgcmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlYCwgYWxsIG90aGVyIG1ldGhvZHMgdGhyb3cuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM0ppdFJlZmxlY3RvciBpbXBsZW1lbnRzIENvbXBpbGVSZWZsZWN0b3Ige1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9KSB7fVxuXG4gIHJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShyZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBhbnkge1xuICAgIC8vIFRoaXMgcmVmbGVjdG9yIG9ubHkgaGFuZGxlcyBAYW5ndWxhci9jb3JlIGltcG9ydHMuXG4gICAgaWYgKHJlZi5tb2R1bGVOYW1lICE9PSAnQGFuZ3VsYXIvY29yZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlc29sdmUgZXh0ZXJuYWwgcmVmZXJlbmNlIHRvICR7XG4gICAgICAgICAgcmVmLm1vZHVsZU5hbWV9LCBvbmx5IHJlZmVyZW5jZXMgdG8gQGFuZ3VsYXIvY29yZSBhcmUgc3VwcG9ydGVkLmApO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuY29udGV4dC5oYXNPd25Qcm9wZXJ0eShyZWYubmFtZSEpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIHZhbHVlIHByb3ZpZGVkIGZvciBAYW5ndWxhci9jb3JlIHN5bWJvbCAnJHtyZWYubmFtZSF9Jy5gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY29udGV4dFtyZWYubmFtZSFdO1xuICB9XG5cbiAgcGFyYW1ldGVycyh0eXBlT3JGdW5jOiBhbnkpOiBhbnlbXVtdIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIGFubm90YXRpb25zKHR5cGVPckZ1bmM6IGFueSk6IGFueVtdIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHNoYWxsb3dBbm5vdGF0aW9ucyh0eXBlT3JGdW5jOiBhbnkpOiBhbnlbXSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB0cnlBbm5vdGF0aW9ucyh0eXBlT3JGdW5jOiBhbnkpOiBhbnlbXSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICBwcm9wTWV0YWRhdGEodHlwZU9yRnVuYzogYW55KToge1trZXk6IHN0cmluZ106IGFueVtdO30ge1xuICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgaGFzTGlmZWN5Y2xlSG9vayh0eXBlOiBhbnksIGxjUHJvcGVydHk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgZ3VhcmRzKHR5cGVPckZ1bmM6IGFueSk6IHtba2V5OiBzdHJpbmddOiBhbnk7fSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICBjb21wb25lbnRNb2R1bGVVcmwodHlwZTogYW55LCBjbXBNZXRhZGF0YTogYW55KTogc3RyaW5nIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxufVxuIl19