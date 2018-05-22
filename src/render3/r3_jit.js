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
        define("@angular/compiler/src/render3/r3_jit", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var output_jit_1 = require("@angular/compiler/src/output/output_jit");
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
        R3JitReflector.prototype.parameters = function (typeOrFunc) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.annotations = function (typeOrFunc) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.shallowAnnotations = function (typeOrFunc) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.tryAnnotations = function (typeOrFunc) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.propMetadata = function (typeOrFunc) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.hasLifecycleHook = function (type, lcProperty) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.guards = function (typeOrFunc) { throw new Error('Not implemented.'); };
        R3JitReflector.prototype.componentModuleUrl = function (type, cmpMetadata) { throw new Error('Not implemented.'); };
        return R3JitReflector;
    }());
    /**
     * JIT compiles an expression and monkey-patches the result of executing the expression onto a given
     * type.
     *
     * @param type the type which will receive the monkey-patched result
     * @param field name of the field on the type to monkey-patch
     * @param def the definition which will be compiled and executed to get the value to patch
     * @param context an object map of @angular/core symbol names to symbols which will be available in
     * the context of the compiled expression
     * @param constantPool an optional `ConstantPool` which contains constants used in the expression
     */
    function jitPatchDefinition(type, field, def, context, constantPool) {
        // The ConstantPool may contain Statements which declare variables used in the final expression.
        // Therefore, its statements need to precede the actual JIT operation. The final statement is a
        // declaration of $def which is set to the expression being compiled.
        var statements = tslib_1.__spread((constantPool !== undefined ? constantPool.statements : []), [
            new o.DeclareVarStmt('$def', def, undefined, [o.StmtModifier.Exported]),
        ]);
        // Monkey patch the field on the given type with the result of compilation.
        // TODO(alxhub): consider a better source url.
        type[field] = output_jit_1.jitStatements("ng://" + (type && type.name) + "/" + field, statements, new R3JitReflector(context), false)['$def'];
    }
    exports.jitPatchDefinition = jitPatchDefinition;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaml0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfaml0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUlILDJEQUEwQztJQUMxQyxzRUFBbUQ7SUFFbkQ7Ozs7O09BS0c7SUFDSDtRQUNFLHdCQUFvQixPQUE2QjtZQUE3QixZQUFPLEdBQVAsT0FBTyxDQUFzQjtRQUFHLENBQUM7UUFFckQsaURBQXdCLEdBQXhCLFVBQXlCLEdBQXdCO1lBQy9DLHFEQUFxRDtZQUNyRCxJQUFJLEdBQUcsQ0FBQyxVQUFVLEtBQUssZUFBZSxFQUFFO2dCQUN0QyxNQUFNLElBQUksS0FBSyxDQUNYLDBDQUF3QyxHQUFHLENBQUMsVUFBVSxzREFBbUQsQ0FBQyxDQUFDO2FBQ2hIO1lBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFNLENBQUMsRUFBRTtnQkFDNUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBK0MsR0FBRyxDQUFDLElBQUssT0FBSSxDQUFDLENBQUM7YUFDL0U7WUFDRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQU0sQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFFRCxtQ0FBVSxHQUFWLFVBQVcsVUFBZSxJQUFhLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFN0Usb0NBQVcsR0FBWCxVQUFZLFVBQWUsSUFBVyxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVFLDJDQUFrQixHQUFsQixVQUFtQixVQUFlLElBQVcsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVuRix1Q0FBYyxHQUFkLFVBQWUsVUFBZSxJQUFXLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFL0UscUNBQVksR0FBWixVQUFhLFVBQWUsSUFBNkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUvRix5Q0FBZ0IsR0FBaEIsVUFBaUIsSUFBUyxFQUFFLFVBQWtCLElBQWEsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVqRywrQkFBTSxHQUFOLFVBQU8sVUFBZSxJQUEyQixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXZGLDJDQUFrQixHQUFsQixVQUFtQixJQUFTLEVBQUUsV0FBZ0IsSUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xHLHFCQUFDO0lBQUQsQ0FBQyxBQTlCRCxJQThCQztJQUVEOzs7Ozs7Ozs7O09BVUc7SUFDSCw0QkFDSSxJQUFTLEVBQUUsS0FBYSxFQUFFLEdBQWlCLEVBQUUsT0FBNkIsRUFDMUUsWUFBMkI7UUFDN0IsZ0dBQWdHO1FBQ2hHLCtGQUErRjtRQUMvRixxRUFBcUU7UUFDckUsSUFBTSxVQUFVLG9CQUNYLENBQUMsWUFBWSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzlELElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7VUFDeEUsQ0FBQztRQUVGLDJFQUEyRTtRQUMzRSw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLDBCQUFhLENBQ3ZCLFdBQVEsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLFVBQUksS0FBTyxFQUFFLFVBQVUsRUFBRSxJQUFJLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwRyxDQUFDO0lBZkQsZ0RBZUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2ppdFN0YXRlbWVudHN9IGZyb20gJy4uL291dHB1dC9vdXRwdXRfaml0JztcblxuLyoqXG4gKiBJbXBsZW1lbnRhdGlvbiBvZiBgQ29tcGlsZVJlZmxlY3RvcmAgd2hpY2ggcmVzb2x2ZXMgcmVmZXJlbmNlcyB0byBAYW5ndWxhci9jb3JlXG4gKiBzeW1ib2xzIGF0IHJ1bnRpbWUsIGFjY29yZGluZyB0byBhIGNvbnN1bWVyLXByb3ZpZGVkIG1hcHBpbmcuXG4gKlxuICogT25seSBzdXBwb3J0cyBgcmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlYCwgYWxsIG90aGVyIG1ldGhvZHMgdGhyb3cuXG4gKi9cbmNsYXNzIFIzSml0UmVmbGVjdG9yIGltcGxlbWVudHMgQ29tcGlsZVJlZmxlY3RvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY29udGV4dDoge1trZXk6IHN0cmluZ106IGFueX0pIHt9XG5cbiAgcmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKHJlZjogby5FeHRlcm5hbFJlZmVyZW5jZSk6IGFueSB7XG4gICAgLy8gVGhpcyByZWZsZWN0b3Igb25seSBoYW5kbGVzIEBhbmd1bGFyL2NvcmUgaW1wb3J0cy5cbiAgICBpZiAocmVmLm1vZHVsZU5hbWUgIT09ICdAYW5ndWxhci9jb3JlJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDYW5ub3QgcmVzb2x2ZSBleHRlcm5hbCByZWZlcmVuY2UgdG8gJHtyZWYubW9kdWxlTmFtZX0sIG9ubHkgcmVmZXJlbmNlcyB0byBAYW5ndWxhci9jb3JlIGFyZSBzdXBwb3J0ZWQuYCk7XG4gICAgfVxuICAgIGlmICghdGhpcy5jb250ZXh0Lmhhc093blByb3BlcnR5KHJlZi5uYW1lICEpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIHZhbHVlIHByb3ZpZGVkIGZvciBAYW5ndWxhci9jb3JlIHN5bWJvbCAnJHtyZWYubmFtZSF9Jy5gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY29udGV4dFtyZWYubmFtZSAhXTtcbiAgfVxuXG4gIHBhcmFtZXRlcnModHlwZU9yRnVuYzogYW55KTogYW55W11bXSB7IHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkLicpOyB9XG5cbiAgYW5ub3RhdGlvbnModHlwZU9yRnVuYzogYW55KTogYW55W10geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXG4gIHNoYWxsb3dBbm5vdGF0aW9ucyh0eXBlT3JGdW5jOiBhbnkpOiBhbnlbXSB7IHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkLicpOyB9XG5cbiAgdHJ5QW5ub3RhdGlvbnModHlwZU9yRnVuYzogYW55KTogYW55W10geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXG4gIHByb3BNZXRhZGF0YSh0eXBlT3JGdW5jOiBhbnkpOiB7W2tleTogc3RyaW5nXTogYW55W107fSB7IHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkLicpOyB9XG5cbiAgaGFzTGlmZWN5Y2xlSG9vayh0eXBlOiBhbnksIGxjUHJvcGVydHk6IHN0cmluZyk6IGJvb2xlYW4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXG4gIGd1YXJkcyh0eXBlT3JGdW5jOiBhbnkpOiB7W2tleTogc3RyaW5nXTogYW55O30geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXG4gIGNvbXBvbmVudE1vZHVsZVVybCh0eXBlOiBhbnksIGNtcE1ldGFkYXRhOiBhbnkpOiBzdHJpbmcgeyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTsgfVxufVxuXG4vKipcbiAqIEpJVCBjb21waWxlcyBhbiBleHByZXNzaW9uIGFuZCBtb25rZXktcGF0Y2hlcyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGUgZXhwcmVzc2lvbiBvbnRvIGEgZ2l2ZW5cbiAqIHR5cGUuXG4gKlxuICogQHBhcmFtIHR5cGUgdGhlIHR5cGUgd2hpY2ggd2lsbCByZWNlaXZlIHRoZSBtb25rZXktcGF0Y2hlZCByZXN1bHRcbiAqIEBwYXJhbSBmaWVsZCBuYW1lIG9mIHRoZSBmaWVsZCBvbiB0aGUgdHlwZSB0byBtb25rZXktcGF0Y2hcbiAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICogQHBhcmFtIGNvbnRleHQgYW4gb2JqZWN0IG1hcCBvZiBAYW5ndWxhci9jb3JlIHN5bWJvbCBuYW1lcyB0byBzeW1ib2xzIHdoaWNoIHdpbGwgYmUgYXZhaWxhYmxlIGluXG4gKiB0aGUgY29udGV4dCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICogQHBhcmFtIGNvbnN0YW50UG9vbCBhbiBvcHRpb25hbCBgQ29uc3RhbnRQb29sYCB3aGljaCBjb250YWlucyBjb25zdGFudHMgdXNlZCBpbiB0aGUgZXhwcmVzc2lvblxuICovXG5leHBvcnQgZnVuY3Rpb24gaml0UGF0Y2hEZWZpbml0aW9uKFxuICAgIHR5cGU6IGFueSwgZmllbGQ6IHN0cmluZywgZGVmOiBvLkV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LFxuICAgIGNvbnN0YW50UG9vbD86IENvbnN0YW50UG9vbCk6IHZvaWQge1xuICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgLy8gVGhlcmVmb3JlLCBpdHMgc3RhdGVtZW50cyBuZWVkIHRvIHByZWNlZGUgdGhlIGFjdHVhbCBKSVQgb3BlcmF0aW9uLiBUaGUgZmluYWwgc3RhdGVtZW50IGlzIGFcbiAgLy8gZGVjbGFyYXRpb24gb2YgJGRlZiB3aGljaCBpcyBzZXQgdG8gdGhlIGV4cHJlc3Npb24gYmVpbmcgY29tcGlsZWQuXG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgLi4uKGNvbnN0YW50UG9vbCAhPT0gdW5kZWZpbmVkID8gY29uc3RhbnRQb29sLnN0YXRlbWVudHMgOiBbXSksXG4gICAgbmV3IG8uRGVjbGFyZVZhclN0bXQoJyRkZWYnLCBkZWYsIHVuZGVmaW5lZCwgW28uU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSksXG4gIF07XG5cbiAgLy8gTW9ua2V5IHBhdGNoIHRoZSBmaWVsZCBvbiB0aGUgZ2l2ZW4gdHlwZSB3aXRoIHRoZSByZXN1bHQgb2YgY29tcGlsYXRpb24uXG4gIC8vIFRPRE8oYWx4aHViKTogY29uc2lkZXIgYSBiZXR0ZXIgc291cmNlIHVybC5cbiAgdHlwZVtmaWVsZF0gPSBqaXRTdGF0ZW1lbnRzKFxuICAgICAgYG5nOi8vJHt0eXBlICYmIHR5cGUubmFtZX0vJHtmaWVsZH1gLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIGZhbHNlKVsnJGRlZiddO1xufVxuIl19