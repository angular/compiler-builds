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
        define("@angular/compiler/src/render3/r3_factory", ["require", "exports", "tslib", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    /**
     * Resolved type of a dependency.
     *
     * Occasionally, dependencies will have special significance which is known statically. In that
     * case the `R3ResolvedDependencyType` informs the factory generator that a particular dependency
     * should be generated specially (usually by calling a special injection function instead of the
     * standard one).
     */
    var R3ResolvedDependencyType;
    (function (R3ResolvedDependencyType) {
        /**
         * A normal token dependency.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["Token"] = 0] = "Token";
        /**
         * The dependency is for an attribute.
         *
         * The token expression is a string representing the attribute name.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["Attribute"] = 1] = "Attribute";
        /**
         * The dependency is for the `Injector` type itself.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["Injector"] = 2] = "Injector";
        /**
         * The dependency is for `ElementRef`.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["ElementRef"] = 3] = "ElementRef";
        /**
         * The dependency is for `TemplateRef`.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["TemplateRef"] = 4] = "TemplateRef";
        /**
         * The dependency is for `ViewContainerRef`.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["ViewContainerRef"] = 5] = "ViewContainerRef";
        /**
         * The dependency is for `ChangeDetectorRef`.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["ChangeDetectorRef"] = 6] = "ChangeDetectorRef";
    })(R3ResolvedDependencyType = exports.R3ResolvedDependencyType || (exports.R3ResolvedDependencyType = {}));
    /**
     * Construct a factory function expression for the given `R3FactoryMetadata`.
     */
    function compileFactoryFunction(meta) {
        // Each dependency becomes an invocation of an inject*() function.
        var args = meta.deps.map(function (dep) { return compileInjectDependency(dep, meta.injectFn); });
        // The overall result depends on whether this is construction or function invocation.
        var expr = meta.useNew ? new o.InstantiateExpr(meta.fnOrClass, args) :
            new o.InvokeFunctionExpr(meta.fnOrClass, args);
        // If `extraResults` is specified, then the result is an array consisting of the instantiated
        // value plus any extra results.
        var retExpr = meta.extraResults === undefined ? expr : o.literalArr(tslib_1.__spread([expr], meta.extraResults));
        return o.fn([], [new o.ReturnStatement(retExpr)], o.INFERRED_TYPE, undefined, meta.name + "_Factory");
    }
    exports.compileFactoryFunction = compileFactoryFunction;
    function compileInjectDependency(dep, injectFn) {
        // Interpret the dependency according to its resolved type.
        switch (dep.resolved) {
            case R3ResolvedDependencyType.Token:
            case R3ResolvedDependencyType.Injector: {
                // Build up the injection flags according to the metadata.
                var flags = 0 /* Default */ | (dep.self ? 2 /* Self */ : 0) |
                    (dep.skipSelf ? 4 /* SkipSelf */ : 0) | (dep.host ? 1 /* Host */ : 0) |
                    (dep.optional ? 8 /* Optional */ : 0);
                // Determine the token used for injection. In almost all cases this is the given token, but
                // if the dependency is resolved to the `Injector` then the special `INJECTOR` token is used
                // instead.
                var token = dep.token;
                if (dep.resolved === R3ResolvedDependencyType.Injector) {
                    token = o.importExpr(identifiers_1.Identifiers.INJECTOR);
                }
                // Build up the arguments to the injectFn call.
                var injectArgs = [token];
                // If this dependency is optional or otherwise has non-default flags, then additional
                // parameters describing how to inject the dependency must be passed to the inject function
                // that's being used.
                if (flags !== 0 /* Default */ || dep.optional) {
                    injectArgs.push(o.literal(flags));
                }
                return o.importExpr(injectFn).callFn(injectArgs);
            }
            case R3ResolvedDependencyType.Attribute:
                // In the case of attributes, the attribute name in question is given as the token.
                return o.importExpr(r3_identifiers_1.Identifiers.injectAttribute).callFn([dep.token]);
            case R3ResolvedDependencyType.ElementRef:
                return o.importExpr(r3_identifiers_1.Identifiers.injectElementRef).callFn([]);
            case R3ResolvedDependencyType.TemplateRef:
                return o.importExpr(r3_identifiers_1.Identifiers.injectTemplateRef).callFn([]);
            case R3ResolvedDependencyType.ViewContainerRef:
                return o.importExpr(r3_identifiers_1.Identifiers.injectViewContainerRef).callFn([]);
            case R3ResolvedDependencyType.ChangeDetectorRef:
                return o.importExpr(r3_identifiers_1.Identifiers.injectChangeDetectorRef).callFn([]);
            default:
                return util_1.unsupported("Unknown R3ResolvedDependencyType: " + R3ResolvedDependencyType[dep.resolved]);
        }
    }
    /**
     * A helper function useful for extracting `R3DependencyMetadata` from a Render2
     * `CompileTypeMetadata` instance.
     */
    function dependenciesFromGlobalMetadata(type, outputCtx, reflector) {
        var e_1, _a;
        // Use the `CompileReflector` to look up references to some well-known Angular types. These will
        // be compared with the token to statically determine whether the token has significance to
        // Angular, and set the correct `R3ResolvedDependencyType` as a result.
        var elementRef = reflector.resolveExternalReference(identifiers_1.Identifiers.ElementRef);
        var templateRef = reflector.resolveExternalReference(identifiers_1.Identifiers.TemplateRef);
        var viewContainerRef = reflector.resolveExternalReference(identifiers_1.Identifiers.ViewContainerRef);
        var injectorRef = reflector.resolveExternalReference(identifiers_1.Identifiers.Injector);
        // Iterate through the type's DI dependencies and produce `R3DependencyMetadata` for each of them.
        var deps = [];
        try {
            for (var _b = tslib_1.__values(type.diDeps), _c = _b.next(); !_c.done; _c = _b.next()) {
                var dependency = _c.value;
                if (dependency.token) {
                    var tokenRef = compile_metadata_1.tokenReference(dependency.token);
                    var resolved = R3ResolvedDependencyType.Token;
                    if (tokenRef === elementRef) {
                        resolved = R3ResolvedDependencyType.ElementRef;
                    }
                    else if (tokenRef === templateRef) {
                        resolved = R3ResolvedDependencyType.TemplateRef;
                    }
                    else if (tokenRef === viewContainerRef) {
                        resolved = R3ResolvedDependencyType.ViewContainerRef;
                    }
                    else if (tokenRef === injectorRef) {
                        resolved = R3ResolvedDependencyType.Injector;
                    }
                    else if (dependency.isAttribute) {
                        resolved = R3ResolvedDependencyType.Attribute;
                    }
                    // In the case of most dependencies, the token will be a reference to a type. Sometimes,
                    // however, it can be a string, in the case of older Angular code or @Attribute injection.
                    var token = tokenRef instanceof static_symbol_1.StaticSymbol ? outputCtx.importExpr(tokenRef) : o.literal(tokenRef);
                    // Construct the dependency.
                    deps.push({
                        token: token,
                        resolved: resolved,
                        host: !!dependency.isHost,
                        optional: !!dependency.isOptional,
                        self: !!dependency.isSelf,
                        skipSelf: !!dependency.isSkipSelf,
                    });
                }
                else {
                    util_1.unsupported('dependency without a token');
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return deps;
    }
    exports.dependenciesFromGlobalMetadata = dependenciesFromGlobalMetadata;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgseUVBQWtEO0lBQ2xELDJFQUF3RTtJQUd4RSxpRUFBMkM7SUFDM0MsMkRBQTBDO0lBQzFDLCtFQUE0RDtJQUc1RCxnRUFBd0M7SUFtRHhDOzs7Ozs7O09BT0c7SUFDSCxJQUFZLHdCQXFDWDtJQXJDRCxXQUFZLHdCQUF3QjtRQUNsQzs7V0FFRztRQUNILHlFQUFTLENBQUE7UUFFVDs7OztXQUlHO1FBQ0gsaUZBQWEsQ0FBQTtRQUViOztXQUVHO1FBQ0gsK0VBQVksQ0FBQTtRQUVaOztXQUVHO1FBQ0gsbUZBQWMsQ0FBQTtRQUVkOztXQUVHO1FBQ0gscUZBQWUsQ0FBQTtRQUVmOztXQUVHO1FBQ0gsK0ZBQW9CLENBQUE7UUFFcEI7O1dBRUc7UUFDSCxpR0FBcUIsQ0FBQTtJQUN2QixDQUFDLEVBckNXLHdCQUF3QixHQUF4QixnQ0FBd0IsS0FBeEIsZ0NBQXdCLFFBcUNuQztJQXNDRDs7T0FFRztJQUNILGdDQUF1QyxJQUF1QjtRQUM1RCxrRUFBa0U7UUFDbEUsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSx1QkFBdUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUEzQyxDQUEyQyxDQUFDLENBQUM7UUFFL0UscUZBQXFGO1FBQ3JGLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLENBQUMsa0JBQWtCLENB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cHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZVR5cGVNZXRhZGF0YSwgdG9rZW5SZWZlcmVuY2V9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0luamVjdEZsYWdzfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge3Vuc3VwcG9ydGVkfSBmcm9tICcuL3ZpZXcvdXRpbCc7XG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRvIGdlbmVyYXRlIGEgYGZhY3RvcnlgIGZ1bmN0aW9uIGZvciBhIHR5cGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5TWV0YWRhdGEge1xuICAvKipcbiAgICogU3RyaW5nIG5hbWUgb2YgdGhlIHR5cGUgYmVpbmcgZ2VuZXJhdGVkICh1c2VkIHRvIG5hbWUgdGhlIGZhY3RvcnkgZnVuY3Rpb24pLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgZnVuY3Rpb24gKG9yIGNvbnN0cnVjdG9yKSB3aGljaCB3aWxsIGluc3RhbnRpYXRlIHRoZSByZXF1ZXN0ZWRcbiAgICogdHlwZS5cbiAgICpcbiAgICogVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbnN0cnVjdG9yIHR5cGUsIG9yIHRvIGEgdXNlci1kZWZpbmVkIGZhY3RvcnkgZnVuY3Rpb24uIFRoZVxuICAgKiBgdXNlTmV3YCBwcm9wZXJ0eSBkZXRlcm1pbmVzIHdoZXRoZXIgaXQgd2lsbCBiZSBjYWxsZWQgYXMgYSBjb25zdHJ1Y3RvciBvciBub3QuXG4gICAqL1xuICBmbk9yQ2xhc3M6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogUmVnYXJkbGVzcyBvZiB3aGV0aGVyIGBmbk9yQ2xhc3NgIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gb3IgYSB1c2VyLWRlZmluZWQgZmFjdG9yeSwgaXRcbiAgICogbWF5IGhhdmUgMCBvciBtb3JlIHBhcmFtZXRlcnMsIHdoaWNoIHdpbGwgYmUgaW5qZWN0ZWQgYWNjb3JkaW5nIHRvIHRoZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgXG4gICAqIGZvciB0aG9zZSBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBpbnRlcnByZXQgYGZuT3JDbGFzc2AgYXMgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbiAoYHVzZU5ldzogdHJ1ZWApIG9yIGFzIGEgZmFjdG9yeVxuICAgKiAoYHVzZU5ldzogZmFsc2VgKS5cbiAgICovXG4gIHVzZU5ldzogYm9vbGVhbjtcblxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGZvciB0aGUgZnVuY3Rpb24gd2hpY2ggd2lsbCBiZSB1c2VkIHRvIGluamVjdCBkZXBlbmRlbmNpZXMuIFRoZSBBUEkgb2YgdGhpc1xuICAgKiBmdW5jdGlvbiBjb3VsZCBiZSBkaWZmZXJlbnQsIGFuZCBvdGhlciBvcHRpb25zIGNvbnRyb2wgaG93IGl0IHdpbGwgYmUgaW52b2tlZC5cbiAgICovXG4gIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuXG4gIC8qKlxuICAgKiBJZiBwcmVzZW50LCB0aGUgcmV0dXJuIG9mIHRoZSBmYWN0b3J5IGZ1bmN0aW9uIHdpbGwgYmUgYW4gYXJyYXkgd2l0aCB0aGUgaW5qZWN0ZWQgdmFsdWUgaW4gdGhlXG4gICAqIDB0aCBwb3NpdGlvbiBhbmQgdGhlIGV4dHJhIHJlc3VsdHMgaW5jbHVkZWQgaW4gc3Vic2VxdWVudCBwb3NpdGlvbnMuXG4gICAqXG4gICAqIE9jY2FzaW9uYWxseSBBUElzIHdhbnQgdG8gY29uc3RydWN0IGFkZGl0aW9uYWwgdmFsdWVzIHdoZW4gdGhlIGZhY3RvcnkgZnVuY3Rpb24gaXMgY2FsbGVkLiBUaGVcbiAgICogcGFyYWRpZ20gdGhlcmUgaXMgdG8gaGF2ZSB0aGUgZmFjdG9yeSBmdW5jdGlvbiByZXR1cm4gYW4gYXJyYXksIHdpdGggdGhlIERJLWNyZWF0ZWQgdmFsdWUgYXNcbiAgICogd2VsbCBhcyBvdGhlciB2YWx1ZXMuIFNwZWNpZnlpbmcgYGV4dHJhUmVzdWx0c2AgZW5hYmxlcyB0aGlzIGZ1bmN0aW9uYWxpdHkuXG4gICAqL1xuICBleHRyYVJlc3VsdHM/OiBvLkV4cHJlc3Npb25bXTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlZCB0eXBlIG9mIGEgZGVwZW5kZW5jeS5cbiAqXG4gKiBPY2Nhc2lvbmFsbHksIGRlcGVuZGVuY2llcyB3aWxsIGhhdmUgc3BlY2lhbCBzaWduaWZpY2FuY2Ugd2hpY2ggaXMga25vd24gc3RhdGljYWxseS4gSW4gdGhhdFxuICogY2FzZSB0aGUgYFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZWAgaW5mb3JtcyB0aGUgZmFjdG9yeSBnZW5lcmF0b3IgdGhhdCBhIHBhcnRpY3VsYXIgZGVwZW5kZW5jeVxuICogc2hvdWxkIGJlIGdlbmVyYXRlZCBzcGVjaWFsbHkgKHVzdWFsbHkgYnkgY2FsbGluZyBhIHNwZWNpYWwgaW5qZWN0aW9uIGZ1bmN0aW9uIGluc3RlYWQgb2YgdGhlXG4gKiBzdGFuZGFyZCBvbmUpLlxuICovXG5leHBvcnQgZW51bSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUge1xuICAvKipcbiAgICogQSBub3JtYWwgdG9rZW4gZGVwZW5kZW5jeS5cbiAgICovXG4gIFRva2VuID0gMCxcblxuICAvKipcbiAgICogVGhlIGRlcGVuZGVuY3kgaXMgZm9yIGFuIGF0dHJpYnV0ZS5cbiAgICpcbiAgICogVGhlIHRva2VuIGV4cHJlc3Npb24gaXMgYSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBhdHRyaWJ1dGUgbmFtZS5cbiAgICovXG4gIEF0dHJpYnV0ZSA9IDEsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciB0aGUgYEluamVjdG9yYCB0eXBlIGl0c2VsZi5cbiAgICovXG4gIEluamVjdG9yID0gMixcblxuICAvKipcbiAgICogVGhlIGRlcGVuZGVuY3kgaXMgZm9yIGBFbGVtZW50UmVmYC5cbiAgICovXG4gIEVsZW1lbnRSZWYgPSAzLFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYFRlbXBsYXRlUmVmYC5cbiAgICovXG4gIFRlbXBsYXRlUmVmID0gNCxcblxuICAvKipcbiAgICogVGhlIGRlcGVuZGVuY3kgaXMgZm9yIGBWaWV3Q29udGFpbmVyUmVmYC5cbiAgICovXG4gIFZpZXdDb250YWluZXJSZWYgPSA1LFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYENoYW5nZURldGVjdG9yUmVmYC5cbiAgICovXG4gIENoYW5nZURldGVjdG9yUmVmID0gNixcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSByZXByZXNlbnRpbmcgYSBzaW5nbGUgZGVwZW5kZW5jeSB0byBiZSBpbmplY3RlZCBpbnRvIGEgY29uc3RydWN0b3Igb3IgZnVuY3Rpb24gY2FsbC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgdG9rZW4gb3IgdmFsdWUgdG8gYmUgaW5qZWN0ZWQuXG4gICAqL1xuICB0b2tlbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBlbnVtIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGRlcGVuZGVuY3kgaGFzIHNwZWNpYWwgbWVhbmluZyB0byBBbmd1bGFyIGFuZCBuZWVkcyB0byBiZVxuICAgKiBpbmplY3RlZCBzcGVjaWFsbHkuXG4gICAqL1xuICByZXNvbHZlZDogUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBASG9zdCBxdWFsaWZpZXIuXG4gICAqL1xuICBob3N0OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAT3B0aW9uYWwgcXVhbGlmaWVyLlxuICAgKi9cbiAgb3B0aW9uYWw6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBTZWxmIHF1YWxpZmllci5cbiAgICovXG4gIHNlbGY6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBTa2lwU2VsZiBxdWFsaWZpZXIuXG4gICAqL1xuICBza2lwU2VsZjogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBmYWN0b3J5IGZ1bmN0aW9uIGV4cHJlc3Npb24gZm9yIHRoZSBnaXZlbiBgUjNGYWN0b3J5TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUZhY3RvcnlGdW5jdGlvbihtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIC8vIEVhY2ggZGVwZW5kZW5jeSBiZWNvbWVzIGFuIGludm9jYXRpb24gb2YgYW4gaW5qZWN0KigpIGZ1bmN0aW9uLlxuICBjb25zdCBhcmdzID0gbWV0YS5kZXBzLm1hcChkZXAgPT4gY29tcGlsZUluamVjdERlcGVuZGVuY3koZGVwLCBtZXRhLmluamVjdEZuKSk7XG5cbiAgLy8gVGhlIG92ZXJhbGwgcmVzdWx0IGRlcGVuZHMgb24gd2hldGhlciB0aGlzIGlzIGNvbnN0cnVjdGlvbiBvciBmdW5jdGlvbiBpbnZvY2F0aW9uLlxuICBjb25zdCBleHByID0gbWV0YS51c2VOZXcgPyBuZXcgby5JbnN0YW50aWF0ZUV4cHIobWV0YS5mbk9yQ2xhc3MsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKG1ldGEuZm5PckNsYXNzLCBhcmdzKTtcblxuICAvLyBJZiBgZXh0cmFSZXN1bHRzYCBpcyBzcGVjaWZpZWQsIHRoZW4gdGhlIHJlc3VsdCBpcyBhbiBhcnJheSBjb25zaXN0aW5nIG9mIHRoZSBpbnN0YW50aWF0ZWRcbiAgLy8gdmFsdWUgcGx1cyBhbnkgZXh0cmEgcmVzdWx0cy5cbiAgY29uc3QgcmV0RXhwciA9XG4gICAgICBtZXRhLmV4dHJhUmVzdWx0cyA9PT0gdW5kZWZpbmVkID8gZXhwciA6IG8ubGl0ZXJhbEFycihbZXhwciwgLi4ubWV0YS5leHRyYVJlc3VsdHNdKTtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChyZXRFeHByKV0sIG8uSU5GRVJSRURfVFlQRSwgdW5kZWZpbmVkLCBgJHttZXRhLm5hbWV9X0ZhY3RvcnlgKTtcbn1cblxuZnVuY3Rpb24gY29tcGlsZUluamVjdERlcGVuZGVuY3koXG4gICAgZGVwOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJbnRlcnByZXQgdGhlIGRlcGVuZGVuY3kgYWNjb3JkaW5nIHRvIGl0cyByZXNvbHZlZCB0eXBlLlxuICBzd2l0Y2ggKGRlcC5yZXNvbHZlZCkge1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuOlxuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkluamVjdG9yOiB7XG4gICAgICAvLyBCdWlsZCB1cCB0aGUgaW5qZWN0aW9uIGZsYWdzIGFjY29yZGluZyB0byB0aGUgbWV0YWRhdGEuXG4gICAgICBjb25zdCBmbGFncyA9IEluamVjdEZsYWdzLkRlZmF1bHQgfCAoZGVwLnNlbGYgPyBJbmplY3RGbGFncy5TZWxmIDogMCkgfFxuICAgICAgICAgIChkZXAuc2tpcFNlbGYgPyBJbmplY3RGbGFncy5Ta2lwU2VsZiA6IDApIHwgKGRlcC5ob3N0ID8gSW5qZWN0RmxhZ3MuSG9zdCA6IDApIHxcbiAgICAgICAgICAoZGVwLm9wdGlvbmFsID8gSW5qZWN0RmxhZ3MuT3B0aW9uYWwgOiAwKTtcbiAgICAgIC8vIERldGVybWluZSB0aGUgdG9rZW4gdXNlZCBmb3IgaW5qZWN0aW9uLiBJbiBhbG1vc3QgYWxsIGNhc2VzIHRoaXMgaXMgdGhlIGdpdmVuIHRva2VuLCBidXRcbiAgICAgIC8vIGlmIHRoZSBkZXBlbmRlbmN5IGlzIHJlc29sdmVkIHRvIHRoZSBgSW5qZWN0b3JgIHRoZW4gdGhlIHNwZWNpYWwgYElOSkVDVE9SYCB0b2tlbiBpcyB1c2VkXG4gICAgICAvLyBpbnN0ZWFkLlxuICAgICAgbGV0IHRva2VuOiBvLkV4cHJlc3Npb24gPSBkZXAudG9rZW47XG4gICAgICBpZiAoZGVwLnJlc29sdmVkID09PSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW5qZWN0b3IpIHtcbiAgICAgICAgdG9rZW4gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuSU5KRUNUT1IpO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB1cCB0aGUgYXJndW1lbnRzIHRvIHRoZSBpbmplY3RGbiBjYWxsLlxuICAgICAgY29uc3QgaW5qZWN0QXJncyA9IFt0b2tlbl07XG4gICAgICAvLyBJZiB0aGlzIGRlcGVuZGVuY3kgaXMgb3B0aW9uYWwgb3Igb3RoZXJ3aXNlIGhhcyBub24tZGVmYXVsdCBmbGFncywgdGhlbiBhZGRpdGlvbmFsXG4gICAgICAvLyBwYXJhbWV0ZXJzIGRlc2NyaWJpbmcgaG93IHRvIGluamVjdCB0aGUgZGVwZW5kZW5jeSBtdXN0IGJlIHBhc3NlZCB0byB0aGUgaW5qZWN0IGZ1bmN0aW9uXG4gICAgICAvLyB0aGF0J3MgYmVpbmcgdXNlZC5cbiAgICAgIGlmIChmbGFncyAhPT0gSW5qZWN0RmxhZ3MuRGVmYXVsdCB8fCBkZXAub3B0aW9uYWwpIHtcbiAgICAgICAgaW5qZWN0QXJncy5wdXNoKG8ubGl0ZXJhbChmbGFncykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbmplY3RGbikuY2FsbEZuKGluamVjdEFyZ3MpO1xuICAgIH1cbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5BdHRyaWJ1dGU6XG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBhdHRyaWJ1dGVzLCB0aGUgYXR0cmlidXRlIG5hbWUgaW4gcXVlc3Rpb24gaXMgZ2l2ZW4gYXMgdGhlIHRva2VuLlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbmplY3RBdHRyaWJ1dGUpLmNhbGxGbihbZGVwLnRva2VuXSk7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuRWxlbWVudFJlZjpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0RWxlbWVudFJlZikuY2FsbEZuKFtdKTtcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5UZW1wbGF0ZVJlZjpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0VGVtcGxhdGVSZWYpLmNhbGxGbihbXSk7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVmlld0NvbnRhaW5lclJlZjpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0Vmlld0NvbnRhaW5lclJlZikuY2FsbEZuKFtdKTtcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5DaGFuZ2VEZXRlY3RvclJlZjpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0Q2hhbmdlRGV0ZWN0b3JSZWYpLmNhbGxGbihbXSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bnN1cHBvcnRlZChcbiAgICAgICAgICBgVW5rbm93biBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU6ICR7UjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlW2RlcC5yZXNvbHZlZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGhlbHBlciBmdW5jdGlvbiB1c2VmdWwgZm9yIGV4dHJhY3RpbmcgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmcm9tIGEgUmVuZGVyMlxuICogYENvbXBpbGVUeXBlTWV0YWRhdGFgIGluc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdIHtcbiAgLy8gVXNlIHRoZSBgQ29tcGlsZVJlZmxlY3RvcmAgdG8gbG9vayB1cCByZWZlcmVuY2VzIHRvIHNvbWUgd2VsbC1rbm93biBBbmd1bGFyIHR5cGVzLiBUaGVzZSB3aWxsXG4gIC8vIGJlIGNvbXBhcmVkIHdpdGggdGhlIHRva2VuIHRvIHN0YXRpY2FsbHkgZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHRva2VuIGhhcyBzaWduaWZpY2FuY2UgdG9cbiAgLy8gQW5ndWxhciwgYW5kIHNldCB0aGUgY29ycmVjdCBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBhcyBhIHJlc3VsdC5cbiAgY29uc3QgZWxlbWVudFJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZik7XG4gIGNvbnN0IHRlbXBsYXRlUmVmID0gcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gIGNvbnN0IHZpZXdDb250YWluZXJSZWYgPSByZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlZpZXdDb250YWluZXJSZWYpO1xuICBjb25zdCBpbmplY3RvclJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpO1xuXG4gIC8vIEl0ZXJhdGUgdGhyb3VnaCB0aGUgdHlwZSdzIERJIGRlcGVuZGVuY2llcyBhbmQgcHJvZHVjZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZvciBlYWNoIG9mIHRoZW0uXG4gIGNvbnN0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgZm9yIChsZXQgZGVwZW5kZW5jeSBvZiB0eXBlLmRpRGVwcykge1xuICAgIGlmIChkZXBlbmRlbmN5LnRva2VuKSB7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKGRlcGVuZGVuY3kudG9rZW4pO1xuICAgICAgbGV0IHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVG9rZW47XG4gICAgICBpZiAodG9rZW5SZWYgPT09IGVsZW1lbnRSZWYpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuRWxlbWVudFJlZjtcbiAgICAgIH0gZWxzZSBpZiAodG9rZW5SZWYgPT09IHRlbXBsYXRlUmVmKSB7XG4gICAgICAgIHJlc29sdmVkID0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRlbXBsYXRlUmVmO1xuICAgICAgfSBlbHNlIGlmICh0b2tlblJlZiA9PT0gdmlld0NvbnRhaW5lclJlZikge1xuICAgICAgICByZXNvbHZlZCA9IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5WaWV3Q29udGFpbmVyUmVmO1xuICAgICAgfSBlbHNlIGlmICh0b2tlblJlZiA9PT0gaW5qZWN0b3JSZWYpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW5qZWN0b3I7XG4gICAgICB9IGVsc2UgaWYgKGRlcGVuZGVuY3kuaXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlO1xuICAgICAgfVxuXG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBtb3N0IGRlcGVuZGVuY2llcywgdGhlIHRva2VuIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8gYSB0eXBlLiBTb21ldGltZXMsXG4gICAgICAvLyBob3dldmVyLCBpdCBjYW4gYmUgYSBzdHJpbmcsIGluIHRoZSBjYXNlIG9mIG9sZGVyIEFuZ3VsYXIgY29kZSBvciBAQXR0cmlidXRlIGluamVjdGlvbi5cbiAgICAgIGNvbnN0IHRva2VuID1cbiAgICAgICAgICB0b2tlblJlZiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCA/IG91dHB1dEN0eC5pbXBvcnRFeHByKHRva2VuUmVmKSA6IG8ubGl0ZXJhbCh0b2tlblJlZik7XG5cbiAgICAgIC8vIENvbnN0cnVjdCB0aGUgZGVwZW5kZW5jeS5cbiAgICAgIGRlcHMucHVzaCh7XG4gICAgICAgIHRva2VuLFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgaG9zdDogISFkZXBlbmRlbmN5LmlzSG9zdCxcbiAgICAgICAgb3B0aW9uYWw6ICEhZGVwZW5kZW5jeS5pc09wdGlvbmFsLFxuICAgICAgICBzZWxmOiAhIWRlcGVuZGVuY3kuaXNTZWxmLFxuICAgICAgICBza2lwU2VsZjogISFkZXBlbmRlbmN5LmlzU2tpcFNlbGYsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdW5zdXBwb3J0ZWQoJ2RlcGVuZGVuY3kgd2l0aG91dCBhIHRva2VuJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlcHM7XG59XG4iXX0=