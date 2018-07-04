/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { StaticSymbol } from '../aot/static_symbol';
import { tokenReference } from '../compile_metadata';
import { Identifiers } from '../identifiers';
import * as o from '../output/output_ast';
import { Identifiers as R3 } from '../render3/r3_identifiers';
import { unsupported } from './view/util';
/**
 * Resolved type of a dependency.
 *
 * Occasionally, dependencies will have special significance which is known statically. In that
 * case the `R3ResolvedDependencyType` informs the factory generator that a particular dependency
 * should be generated specially (usually by calling a special injection function instead of the
 * standard one).
 */
export var R3ResolvedDependencyType;
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
})(R3ResolvedDependencyType || (R3ResolvedDependencyType = {}));
/**
 * Construct a factory function expression for the given `R3FactoryMetadata`.
 */
export function compileFactoryFunction(meta) {
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
                token = o.importExpr(Identifiers.INJECTOR);
            }
            // Build up the arguments to the injectFn call.
            var injectArgs = [dep.token];
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
            return o.importExpr(R3.injectAttribute).callFn([dep.token]);
        case R3ResolvedDependencyType.ElementRef:
            return o.importExpr(R3.injectElementRef).callFn([]);
        case R3ResolvedDependencyType.TemplateRef:
            return o.importExpr(R3.injectTemplateRef).callFn([]);
        case R3ResolvedDependencyType.ViewContainerRef:
            return o.importExpr(R3.injectViewContainerRef).callFn([]);
        default:
            return unsupported("Unknown R3ResolvedDependencyType: " + R3ResolvedDependencyType[dep.resolved]);
    }
}
/**
 * A helper function useful for extracting `R3DependencyMetadata` from a Render2
 * `CompileTypeMetadata` instance.
 */
export function dependenciesFromGlobalMetadata(type, outputCtx, reflector) {
    var e_1, _a;
    // Use the `CompileReflector` to look up references to some well-known Angular types. These will
    // be compared with the token to statically determine whether the token has significance to
    // Angular, and set the correct `R3ResolvedDependencyType` as a result.
    var elementRef = reflector.resolveExternalReference(Identifiers.ElementRef);
    var templateRef = reflector.resolveExternalReference(Identifiers.TemplateRef);
    var viewContainerRef = reflector.resolveExternalReference(Identifiers.ViewContainerRef);
    var injectorRef = reflector.resolveExternalReference(Identifiers.Injector);
    // Iterate through the type's DI dependencies and produce `R3DependencyMetadata` for each of them.
    var deps = [];
    try {
        for (var _b = tslib_1.__values(type.diDeps), _c = _b.next(); !_c.done; _c = _b.next()) {
            var dependency = _c.value;
            if (dependency.token) {
                var tokenRef = tokenReference(dependency.token);
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
                var token = tokenRef instanceof StaticSymbol ? outputCtx.importExpr(tokenRef) : o.literal(tokenRef);
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
                unsupported('dependency without a token');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNsRCxPQUFPLEVBQXNCLGNBQWMsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBR3hFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzFDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFHNUQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQW1EeEM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sQ0FBTixJQUFZLHdCQWdDWDtBQWhDRCxXQUFZLHdCQUF3QjtJQUNsQzs7T0FFRztJQUNILHlFQUFTLENBQUE7SUFFVDs7OztPQUlHO0lBQ0gsaUZBQWEsQ0FBQTtJQUViOztPQUVHO0lBQ0gsK0VBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gsbUZBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gscUZBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsK0ZBQW9CLENBQUE7QUFDdEIsQ0FBQyxFQWhDVyx3QkFBd0IsS0FBeEIsd0JBQXdCLFFBZ0NuQztBQXNDRDs7R0FFRztBQUNILE1BQU0saUNBQWlDLElBQXVCO0lBQzVELGtFQUFrRTtJQUNsRSxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLHVCQUF1QixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQTNDLENBQTJDLENBQUMsQ0FBQztJQUUv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R29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVUeXBlTWV0YWRhdGEsIHRva2VuUmVmZXJlbmNlfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtJbmplY3RGbGFnc30gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHt1bnN1cHBvcnRlZH0gZnJvbSAnLi92aWV3L3V0aWwnO1xuXG4vKipcbiAqIE1ldGFkYXRhIHJlcXVpcmVkIGJ5IHRoZSBmYWN0b3J5IGdlbmVyYXRvciB0byBnZW5lcmF0ZSBhIGBmYWN0b3J5YCBmdW5jdGlvbiBmb3IgYSB0eXBlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRmFjdG9yeU1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIFN0cmluZyBuYW1lIG9mIHRoZSB0eXBlIGJlaW5nIGdlbmVyYXRlZCAodXNlZCB0byBuYW1lIHRoZSBmYWN0b3J5IGZ1bmN0aW9uKS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIGZ1bmN0aW9uIChvciBjb25zdHJ1Y3Rvcikgd2hpY2ggd2lsbCBpbnN0YW50aWF0ZSB0aGUgcmVxdWVzdGVkXG4gICAqIHR5cGUuXG4gICAqXG4gICAqIFRoaXMgY291bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBjb25zdHJ1Y3RvciB0eXBlLCBvciB0byBhIHVzZXItZGVmaW5lZCBmYWN0b3J5IGZ1bmN0aW9uLiBUaGVcbiAgICogYHVzZU5ld2AgcHJvcGVydHkgZGV0ZXJtaW5lcyB3aGV0aGVyIGl0IHdpbGwgYmUgY2FsbGVkIGFzIGEgY29uc3RydWN0b3Igb3Igbm90LlxuICAgKi9cbiAgZm5PckNsYXNzOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIFJlZ2FyZGxlc3Mgb2Ygd2hldGhlciBgZm5PckNsYXNzYCBpcyBhIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIG9yIGEgdXNlci1kZWZpbmVkIGZhY3RvcnksIGl0XG4gICAqIG1heSBoYXZlIDAgb3IgbW9yZSBwYXJhbWV0ZXJzLCB3aGljaCB3aWxsIGJlIGluamVjdGVkIGFjY29yZGluZyB0byB0aGUgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYFxuICAgKiBmb3IgdGhvc2UgcGFyYW1ldGVycy5cbiAgICovXG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gaW50ZXJwcmV0IGBmbk9yQ2xhc3NgIGFzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gKGB1c2VOZXc6IHRydWVgKSBvciBhcyBhIGZhY3RvcnlcbiAgICogKGB1c2VOZXc6IGZhbHNlYCkuXG4gICAqL1xuICB1c2VOZXc6IGJvb2xlYW47XG5cblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiBmb3IgdGhlIGZ1bmN0aW9uIHdoaWNoIHdpbGwgYmUgdXNlZCB0byBpbmplY3QgZGVwZW5kZW5jaWVzLiBUaGUgQVBJIG9mIHRoaXNcbiAgICogZnVuY3Rpb24gY291bGQgYmUgZGlmZmVyZW50LCBhbmQgb3RoZXIgb3B0aW9ucyBjb250cm9sIGhvdyBpdCB3aWxsIGJlIGludm9rZWQuXG4gICAqL1xuICBpbmplY3RGbjogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvKipcbiAgICogSWYgcHJlc2VudCwgdGhlIHJldHVybiBvZiB0aGUgZmFjdG9yeSBmdW5jdGlvbiB3aWxsIGJlIGFuIGFycmF5IHdpdGggdGhlIGluamVjdGVkIHZhbHVlIGluIHRoZVxuICAgKiAwdGggcG9zaXRpb24gYW5kIHRoZSBleHRyYSByZXN1bHRzIGluY2x1ZGVkIGluIHN1YnNlcXVlbnQgcG9zaXRpb25zLlxuICAgKlxuICAgKiBPY2Nhc2lvbmFsbHkgQVBJcyB3YW50IHRvIGNvbnN0cnVjdCBhZGRpdGlvbmFsIHZhbHVlcyB3aGVuIHRoZSBmYWN0b3J5IGZ1bmN0aW9uIGlzIGNhbGxlZC4gVGhlXG4gICAqIHBhcmFkaWdtIHRoZXJlIGlzIHRvIGhhdmUgdGhlIGZhY3RvcnkgZnVuY3Rpb24gcmV0dXJuIGFuIGFycmF5LCB3aXRoIHRoZSBESS1jcmVhdGVkIHZhbHVlIGFzXG4gICAqIHdlbGwgYXMgb3RoZXIgdmFsdWVzLiBTcGVjaWZ5aW5nIGBleHRyYVJlc3VsdHNgIGVuYWJsZXMgdGhpcyBmdW5jdGlvbmFsaXR5LlxuICAgKi9cbiAgZXh0cmFSZXN1bHRzPzogby5FeHByZXNzaW9uW107XG59XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiBhIGRlcGVuZGVuY3kuXG4gKlxuICogT2NjYXNpb25hbGx5LCBkZXBlbmRlbmNpZXMgd2lsbCBoYXZlIHNwZWNpYWwgc2lnbmlmaWNhbmNlIHdoaWNoIGlzIGtub3duIHN0YXRpY2FsbHkuIEluIHRoYXRcbiAqIGNhc2UgdGhlIGBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGVgIGluZm9ybXMgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRoYXQgYSBwYXJ0aWN1bGFyIGRlcGVuZGVuY3lcbiAqIHNob3VsZCBiZSBnZW5lcmF0ZWQgc3BlY2lhbGx5ICh1c3VhbGx5IGJ5IGNhbGxpbmcgYSBzcGVjaWFsIGluamVjdGlvbiBmdW5jdGlvbiBpbnN0ZWFkIG9mIHRoZVxuICogc3RhbmRhcmQgb25lKS5cbiAqL1xuZXhwb3J0IGVudW0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIHtcbiAgLyoqXG4gICAqIEEgbm9ybWFsIHRva2VuIGRlcGVuZGVuY3kuXG4gICAqL1xuICBUb2tlbiA9IDAsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciBhbiBhdHRyaWJ1dGUuXG4gICAqXG4gICAqIFRoZSB0b2tlbiBleHByZXNzaW9uIGlzIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgYXR0cmlidXRlIG5hbWUuXG4gICAqL1xuICBBdHRyaWJ1dGUgPSAxLFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgdGhlIGBJbmplY3RvcmAgdHlwZSBpdHNlbGYuXG4gICAqL1xuICBJbmplY3RvciA9IDIsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciBgRWxlbWVudFJlZmAuXG4gICAqL1xuICBFbGVtZW50UmVmID0gMyxcblxuICAvKipcbiAgICogVGhlIGRlcGVuZGVuY3kgaXMgZm9yIGBUZW1wbGF0ZVJlZmAuXG4gICAqL1xuICBUZW1wbGF0ZVJlZiA9IDQsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciBgVmlld0NvbnRhaW5lclJlZmAuXG4gICAqL1xuICBWaWV3Q29udGFpbmVyUmVmID0gNSxcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSByZXByZXNlbnRpbmcgYSBzaW5nbGUgZGVwZW5kZW5jeSB0byBiZSBpbmplY3RlZCBpbnRvIGEgY29uc3RydWN0b3Igb3IgZnVuY3Rpb24gY2FsbC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgdG9rZW4gb3IgdmFsdWUgdG8gYmUgaW5qZWN0ZWQuXG4gICAqL1xuICB0b2tlbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBBbiBlbnVtIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGRlcGVuZGVuY3kgaGFzIHNwZWNpYWwgbWVhbmluZyB0byBBbmd1bGFyIGFuZCBuZWVkcyB0byBiZVxuICAgKiBpbmplY3RlZCBzcGVjaWFsbHkuXG4gICAqL1xuICByZXNvbHZlZDogUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBASG9zdCBxdWFsaWZpZXIuXG4gICAqL1xuICBob3N0OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAT3B0aW9uYWwgcXVhbGlmaWVyLlxuICAgKi9cbiAgb3B0aW9uYWw6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBTZWxmIHF1YWxpZmllci5cbiAgICovXG4gIHNlbGY6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBTa2lwU2VsZiBxdWFsaWZpZXIuXG4gICAqL1xuICBza2lwU2VsZjogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBmYWN0b3J5IGZ1bmN0aW9uIGV4cHJlc3Npb24gZm9yIHRoZSBnaXZlbiBgUjNGYWN0b3J5TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUZhY3RvcnlGdW5jdGlvbihtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIC8vIEVhY2ggZGVwZW5kZW5jeSBiZWNvbWVzIGFuIGludm9jYXRpb24gb2YgYW4gaW5qZWN0KigpIGZ1bmN0aW9uLlxuICBjb25zdCBhcmdzID0gbWV0YS5kZXBzLm1hcChkZXAgPT4gY29tcGlsZUluamVjdERlcGVuZGVuY3koZGVwLCBtZXRhLmluamVjdEZuKSk7XG5cbiAgLy8gVGhlIG92ZXJhbGwgcmVzdWx0IGRlcGVuZHMgb24gd2hldGhlciB0aGlzIGlzIGNvbnN0cnVjdGlvbiBvciBmdW5jdGlvbiBpbnZvY2F0aW9uLlxuICBjb25zdCBleHByID0gbWV0YS51c2VOZXcgPyBuZXcgby5JbnN0YW50aWF0ZUV4cHIobWV0YS5mbk9yQ2xhc3MsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKG1ldGEuZm5PckNsYXNzLCBhcmdzKTtcblxuICAvLyBJZiBgZXh0cmFSZXN1bHRzYCBpcyBzcGVjaWZpZWQsIHRoZW4gdGhlIHJlc3VsdCBpcyBhbiBhcnJheSBjb25zaXN0aW5nIG9mIHRoZSBpbnN0YW50aWF0ZWRcbiAgLy8gdmFsdWUgcGx1cyBhbnkgZXh0cmEgcmVzdWx0cy5cbiAgY29uc3QgcmV0RXhwciA9XG4gICAgICBtZXRhLmV4dHJhUmVzdWx0cyA9PT0gdW5kZWZpbmVkID8gZXhwciA6IG8ubGl0ZXJhbEFycihbZXhwciwgLi4ubWV0YS5leHRyYVJlc3VsdHNdKTtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChyZXRFeHByKV0sIG8uSU5GRVJSRURfVFlQRSwgdW5kZWZpbmVkLCBgJHttZXRhLm5hbWV9X0ZhY3RvcnlgKTtcbn1cblxuZnVuY3Rpb24gY29tcGlsZUluamVjdERlcGVuZGVuY3koXG4gICAgZGVwOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJbnRlcnByZXQgdGhlIGRlcGVuZGVuY3kgYWNjb3JkaW5nIHRvIGl0cyByZXNvbHZlZCB0eXBlLlxuICBzd2l0Y2ggKGRlcC5yZXNvbHZlZCkge1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuOlxuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkluamVjdG9yOiB7XG4gICAgICAvLyBCdWlsZCB1cCB0aGUgaW5qZWN0aW9uIGZsYWdzIGFjY29yZGluZyB0byB0aGUgbWV0YWRhdGEuXG4gICAgICBjb25zdCBmbGFncyA9IEluamVjdEZsYWdzLkRlZmF1bHQgfCAoZGVwLnNlbGYgPyBJbmplY3RGbGFncy5TZWxmIDogMCkgfFxuICAgICAgICAgIChkZXAuc2tpcFNlbGYgPyBJbmplY3RGbGFncy5Ta2lwU2VsZiA6IDApIHwgKGRlcC5ob3N0ID8gSW5qZWN0RmxhZ3MuSG9zdCA6IDApIHxcbiAgICAgICAgICAoZGVwLm9wdGlvbmFsID8gSW5qZWN0RmxhZ3MuT3B0aW9uYWwgOiAwKTtcbiAgICAgIC8vIERldGVybWluZSB0aGUgdG9rZW4gdXNlZCBmb3IgaW5qZWN0aW9uLiBJbiBhbG1vc3QgYWxsIGNhc2VzIHRoaXMgaXMgdGhlIGdpdmVuIHRva2VuLCBidXRcbiAgICAgIC8vIGlmIHRoZSBkZXBlbmRlbmN5IGlzIHJlc29sdmVkIHRvIHRoZSBgSW5qZWN0b3JgIHRoZW4gdGhlIHNwZWNpYWwgYElOSkVDVE9SYCB0b2tlbiBpcyB1c2VkXG4gICAgICAvLyBpbnN0ZWFkLlxuICAgICAgbGV0IHRva2VuOiBvLkV4cHJlc3Npb24gPSBkZXAudG9rZW47XG4gICAgICBpZiAoZGVwLnJlc29sdmVkID09PSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW5qZWN0b3IpIHtcbiAgICAgICAgdG9rZW4gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuSU5KRUNUT1IpO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB1cCB0aGUgYXJndW1lbnRzIHRvIHRoZSBpbmplY3RGbiBjYWxsLlxuICAgICAgY29uc3QgaW5qZWN0QXJncyA9IFtkZXAudG9rZW5dO1xuICAgICAgLy8gSWYgdGhpcyBkZXBlbmRlbmN5IGlzIG9wdGlvbmFsIG9yIG90aGVyd2lzZSBoYXMgbm9uLWRlZmF1bHQgZmxhZ3MsIHRoZW4gYWRkaXRpb25hbFxuICAgICAgLy8gcGFyYW1ldGVycyBkZXNjcmliaW5nIGhvdyB0byBpbmplY3QgdGhlIGRlcGVuZGVuY3kgbXVzdCBiZSBwYXNzZWQgdG8gdGhlIGluamVjdCBmdW5jdGlvblxuICAgICAgLy8gdGhhdCdzIGJlaW5nIHVzZWQuXG4gICAgICBpZiAoZmxhZ3MgIT09IEluamVjdEZsYWdzLkRlZmF1bHQgfHwgZGVwLm9wdGlvbmFsKSB7XG4gICAgICAgIGluamVjdEFyZ3MucHVzaChvLmxpdGVyYWwoZmxhZ3MpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoaW5qZWN0Rm4pLmNhbGxGbihpbmplY3RBcmdzKTtcbiAgICB9XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlOlxuICAgICAgLy8gSW4gdGhlIGNhc2Ugb2YgYXR0cmlidXRlcywgdGhlIGF0dHJpYnV0ZSBuYW1lIGluIHF1ZXN0aW9uIGlzIGdpdmVuIGFzIHRoZSB0b2tlbi5cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0QXR0cmlidXRlKS5jYWxsRm4oW2RlcC50b2tlbl0pO1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkVsZW1lbnRSZWY6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdEVsZW1lbnRSZWYpLmNhbGxGbihbXSk7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVGVtcGxhdGVSZWY6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdFRlbXBsYXRlUmVmKS5jYWxsRm4oW10pO1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlZpZXdDb250YWluZXJSZWY6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdFZpZXdDb250YWluZXJSZWYpLmNhbGxGbihbXSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bnN1cHBvcnRlZChcbiAgICAgICAgICBgVW5rbm93biBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU6ICR7UjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlW2RlcC5yZXNvbHZlZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGhlbHBlciBmdW5jdGlvbiB1c2VmdWwgZm9yIGV4dHJhY3RpbmcgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmcm9tIGEgUmVuZGVyMlxuICogYENvbXBpbGVUeXBlTWV0YWRhdGFgIGluc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdIHtcbiAgLy8gVXNlIHRoZSBgQ29tcGlsZVJlZmxlY3RvcmAgdG8gbG9vayB1cCByZWZlcmVuY2VzIHRvIHNvbWUgd2VsbC1rbm93biBBbmd1bGFyIHR5cGVzLiBUaGVzZSB3aWxsXG4gIC8vIGJlIGNvbXBhcmVkIHdpdGggdGhlIHRva2VuIHRvIHN0YXRpY2FsbHkgZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHRva2VuIGhhcyBzaWduaWZpY2FuY2UgdG9cbiAgLy8gQW5ndWxhciwgYW5kIHNldCB0aGUgY29ycmVjdCBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBhcyBhIHJlc3VsdC5cbiAgY29uc3QgZWxlbWVudFJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZik7XG4gIGNvbnN0IHRlbXBsYXRlUmVmID0gcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gIGNvbnN0IHZpZXdDb250YWluZXJSZWYgPSByZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlZpZXdDb250YWluZXJSZWYpO1xuICBjb25zdCBpbmplY3RvclJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpO1xuXG4gIC8vIEl0ZXJhdGUgdGhyb3VnaCB0aGUgdHlwZSdzIERJIGRlcGVuZGVuY2llcyBhbmQgcHJvZHVjZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZvciBlYWNoIG9mIHRoZW0uXG4gIGNvbnN0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgZm9yIChsZXQgZGVwZW5kZW5jeSBvZiB0eXBlLmRpRGVwcykge1xuICAgIGlmIChkZXBlbmRlbmN5LnRva2VuKSB7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKGRlcGVuZGVuY3kudG9rZW4pO1xuICAgICAgbGV0IHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVG9rZW47XG4gICAgICBpZiAodG9rZW5SZWYgPT09IGVsZW1lbnRSZWYpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuRWxlbWVudFJlZjtcbiAgICAgIH0gZWxzZSBpZiAodG9rZW5SZWYgPT09IHRlbXBsYXRlUmVmKSB7XG4gICAgICAgIHJlc29sdmVkID0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRlbXBsYXRlUmVmO1xuICAgICAgfSBlbHNlIGlmICh0b2tlblJlZiA9PT0gdmlld0NvbnRhaW5lclJlZikge1xuICAgICAgICByZXNvbHZlZCA9IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5WaWV3Q29udGFpbmVyUmVmO1xuICAgICAgfSBlbHNlIGlmICh0b2tlblJlZiA9PT0gaW5qZWN0b3JSZWYpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW5qZWN0b3I7XG4gICAgICB9IGVsc2UgaWYgKGRlcGVuZGVuY3kuaXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlO1xuICAgICAgfVxuXG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBtb3N0IGRlcGVuZGVuY2llcywgdGhlIHRva2VuIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8gYSB0eXBlLiBTb21ldGltZXMsXG4gICAgICAvLyBob3dldmVyLCBpdCBjYW4gYmUgYSBzdHJpbmcsIGluIHRoZSBjYXNlIG9mIG9sZGVyIEFuZ3VsYXIgY29kZSBvciBAQXR0cmlidXRlIGluamVjdGlvbi5cbiAgICAgIGNvbnN0IHRva2VuID1cbiAgICAgICAgICB0b2tlblJlZiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCA/IG91dHB1dEN0eC5pbXBvcnRFeHByKHRva2VuUmVmKSA6IG8ubGl0ZXJhbCh0b2tlblJlZik7XG5cbiAgICAgIC8vIENvbnN0cnVjdCB0aGUgZGVwZW5kZW5jeS5cbiAgICAgIGRlcHMucHVzaCh7XG4gICAgICAgIHRva2VuLFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgaG9zdDogISFkZXBlbmRlbmN5LmlzSG9zdCxcbiAgICAgICAgb3B0aW9uYWw6ICEhZGVwZW5kZW5jeS5pc09wdGlvbmFsLFxuICAgICAgICBzZWxmOiAhIWRlcGVuZGVuY3kuaXNTZWxmLFxuICAgICAgICBza2lwU2VsZjogISFkZXBlbmRlbmN5LmlzU2tpcFNlbGYsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdW5zdXBwb3J0ZWQoJ2RlcGVuZGVuY3kgd2l0aG91dCBhIHRva2VuJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlcHM7XG59XG4iXX0=