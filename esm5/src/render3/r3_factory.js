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
    var args = meta.deps.map(function (dep) { return compileInjectDependency(dep, meta.injectFn, meta.useOptionalParam); });
    // The overall result depends on whether this is construction or function invocation.
    var expr = meta.useNew ? new o.InstantiateExpr(meta.fnOrClass, args) :
        new o.InvokeFunctionExpr(meta.fnOrClass, args);
    // If `extraResults` is specified, then the result is an array consisting of the instantiated
    // value plus any extra results.
    var retExpr = meta.extraResults === undefined ? expr : o.literalArr(tslib_1.__spread([expr], meta.extraResults));
    return o.fn([], [new o.ReturnStatement(retExpr)], o.INFERRED_TYPE, undefined, meta.name + "_Factory");
}
function compileInjectDependency(dep, injectFn, useOptionalParam) {
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
                // Either the dependency is optional, or non-default flags are in use. Either of these cases
                // necessitates adding an argument for the default value if such an argument is required
                // by the inject function (useOptionalParam === true).
                if (useOptionalParam) {
                    // The inject function requires a default value parameter.
                    injectArgs.push(dep.optional ? o.NULL_EXPR : o.literal(undefined));
                }
                // The last parameter is always the InjectFlags, which only need to be specified if they're
                // non-default.
                if (flags !== 0 /* Default */) {
                    injectArgs.push(o.literal(flags));
                }
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
        for (var _a = tslib_1.__values(type.diDeps), _b = _a.next(); !_b.done; _b = _a.next()) {
            var dependency = _b.value;
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
            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return deps;
    var e_1, _c;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNsRCxPQUFPLEVBQXNCLGNBQWMsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBR3hFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzFDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFHNUQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQWdFeEM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sQ0FBTixJQUFZLHdCQWdDWDtBQWhDRCxXQUFZLHdCQUF3QjtJQUNsQzs7T0FFRztJQUNILHlFQUFTLENBQUE7SUFFVDs7OztPQUlHO0lBQ0gsaUZBQWEsQ0FBQTtJQUViOztPQUVHO0lBQ0gsK0VBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gsbUZBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gscUZBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsK0ZBQW9CLENBQUE7QUFDdEIsQ0FBQyxFQWhDVyx3QkFBd0IsS0FBeEIsd0JBQXdCLFFBZ0NuQztBQXNDRDs7R0FFRztBQUNILE1BQU0saUNBQWlDLElBQXVCO0lBQzVELGtFQUFrRTtJQUNsRSxJQUFNLElBQUksR0FDTixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLHVCQUF1QixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFs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QUFVLENBQUMsTUFBTTtvQkFDekIsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVTtvQkFDakMsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTTtvQkFDekIsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVTtpQkFDbEMsQ0FBQyxDQUFDO2FBQ0o7aUJBQU07Z0JBQ0wsV0FBVyxDQUFDLDRCQUE0QixDQUFDLENBQUM7YUFDM0M7U0FDRjs7Ozs7Ozs7O0lBRUQsT0FBTyxJQUFJLENBQUM7O0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZVR5cGVNZXRhZGF0YSwgdG9rZW5SZWZlcmVuY2V9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0luamVjdEZsYWdzfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge3Vuc3VwcG9ydGVkfSBmcm9tICcuL3ZpZXcvdXRpbCc7XG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRvIGdlbmVyYXRlIGEgYGZhY3RvcnlgIGZ1bmN0aW9uIGZvciBhIHR5cGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5TWV0YWRhdGEge1xuICAvKipcbiAgICogU3RyaW5nIG5hbWUgb2YgdGhlIHR5cGUgYmVpbmcgZ2VuZXJhdGVkICh1c2VkIHRvIG5hbWUgdGhlIGZhY3RvcnkgZnVuY3Rpb24pLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgZnVuY3Rpb24gKG9yIGNvbnN0cnVjdG9yKSB3aGljaCB3aWxsIGluc3RhbnRpYXRlIHRoZSByZXF1ZXN0ZWRcbiAgICogdHlwZS5cbiAgICpcbiAgICogVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbnN0cnVjdG9yIHR5cGUsIG9yIHRvIGEgdXNlci1kZWZpbmVkIGZhY3RvcnkgZnVuY3Rpb24uIFRoZVxuICAgKiBgdXNlTmV3YCBwcm9wZXJ0eSBkZXRlcm1pbmVzIHdoZXRoZXIgaXQgd2lsbCBiZSBjYWxsZWQgYXMgYSBjb25zdHJ1Y3RvciBvciBub3QuXG4gICAqL1xuICBmbk9yQ2xhc3M6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogUmVnYXJkbGVzcyBvZiB3aGV0aGVyIGBmbk9yQ2xhc3NgIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gb3IgYSB1c2VyLWRlZmluZWQgZmFjdG9yeSwgaXRcbiAgICogbWF5IGhhdmUgMCBvciBtb3JlIHBhcmFtZXRlcnMsIHdoaWNoIHdpbGwgYmUgaW5qZWN0ZWQgYWNjb3JkaW5nIHRvIHRoZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgXG4gICAqIGZvciB0aG9zZSBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBpbnRlcnByZXQgYGZuT3JDbGFzc2AgYXMgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbiAoYHVzZU5ldzogdHJ1ZWApIG9yIGFzIGEgZmFjdG9yeVxuICAgKiAoYHVzZU5ldzogZmFsc2VgKS5cbiAgICovXG4gIHVzZU5ldzogYm9vbGVhbjtcblxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGZvciB0aGUgZnVuY3Rpb24gd2hpY2ggd2lsbCBiZSB1c2VkIHRvIGluamVjdCBkZXBlbmRlbmNpZXMuIFRoZSBBUEkgb2YgdGhpc1xuICAgKiBmdW5jdGlvbiBjb3VsZCBiZSBkaWZmZXJlbnQsIGFuZCBvdGhlciBvcHRpb25zIGNvbnRyb2wgaG93IGl0IHdpbGwgYmUgaW52b2tlZC5cbiAgICovXG4gIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBgaW5qZWN0Rm5gIGdpdmVuIGFib3ZlIGFjY2VwdHMgYSAybmQgcGFyYW1ldGVyIGluZGljYXRpbmcgdGhlIGRlZmF1bHQgdmFsdWUgdG9cbiAgICogYmUgdXNlZCB0byByZXNvbHZlIG1pc3NpbmcgQE9wdGlvbmFsIGRlcGVuZGVuY2llcy5cbiAgICpcbiAgICogSWYgdGhlIG9wdGlvbmFsIHBhcmFtZXRlciBpcyB1c2VkLCBpbmplY3RGbiBmb3IgYW4gb3B0aW9uYWwgZGVwZW5kZW5jeSB3aWxsIGJlIGludm9rZWQgYXM6XG4gICAqIGBpbmplY3RGbih0b2tlbiwgbnVsbCwgZmxhZ3MpYC5cbiAgICpcbiAgICogSWYgaXQncyBub3QgdXNlZCwgaW5qZWN0Rm4gZm9yIGFuIG9wdGlvbmFsIGRlcGVuZGVuY3kgd2lsbCBiZSBpbnZva2VkIGFzOlxuICAgKiBgaW5qZWN0Rm4odG9rZW4sIGZsYWdzKWAuIFRoZSBPcHRpb25hbCBmbGFnIHdpbGwgaW5kaWNhdGUgdGhhdCBpbmplY3RGbiBzaG91bGQgc2VsZWN0IGEgZGVmYXVsdFxuICAgKiB2YWx1ZSBpZiBpdCBjYW5ub3Qgc2F0aXNmeSB0aGUgaW5qZWN0aW9uIHJlcXVlc3QgZm9yIHRoZSB0b2tlbi5cbiAgICovXG4gIHVzZU9wdGlvbmFsUGFyYW06IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIHByZXNlbnQsIHRoZSByZXR1cm4gb2YgdGhlIGZhY3RvcnkgZnVuY3Rpb24gd2lsbCBiZSBhbiBhcnJheSB3aXRoIHRoZSBpbmplY3RlZCB2YWx1ZSBpbiB0aGVcbiAgICogMHRoIHBvc2l0aW9uIGFuZCB0aGUgZXh0cmEgcmVzdWx0cyBpbmNsdWRlZCBpbiBzdWJzZXF1ZW50IHBvc2l0aW9ucy5cbiAgICpcbiAgICogT2NjYXNpb25hbGx5IEFQSXMgd2FudCB0byBjb25zdHJ1Y3QgYWRkaXRpb25hbCB2YWx1ZXMgd2hlbiB0aGUgZmFjdG9yeSBmdW5jdGlvbiBpcyBjYWxsZWQuIFRoZVxuICAgKiBwYXJhZGlnbSB0aGVyZSBpcyB0byBoYXZlIHRoZSBmYWN0b3J5IGZ1bmN0aW9uIHJldHVybiBhbiBhcnJheSwgd2l0aCB0aGUgREktY3JlYXRlZCB2YWx1ZSBhc1xuICAgKiB3ZWxsIGFzIG90aGVyIHZhbHVlcy4gU3BlY2lmeWluZyBgZXh0cmFSZXN1bHRzYCBlbmFibGVzIHRoaXMgZnVuY3Rpb25hbGl0eS5cbiAgICovXG4gIGV4dHJhUmVzdWx0cz86IG8uRXhwcmVzc2lvbltdO1xufVxuXG4vKipcbiAqIFJlc29sdmVkIHR5cGUgb2YgYSBkZXBlbmRlbmN5LlxuICpcbiAqIE9jY2FzaW9uYWxseSwgZGVwZW5kZW5jaWVzIHdpbGwgaGF2ZSBzcGVjaWFsIHNpZ25pZmljYW5jZSB3aGljaCBpcyBrbm93biBzdGF0aWNhbGx5LiBJbiB0aGF0XG4gKiBjYXNlIHRoZSBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBpbmZvcm1zIHRoZSBmYWN0b3J5IGdlbmVyYXRvciB0aGF0IGEgcGFydGljdWxhciBkZXBlbmRlbmN5XG4gKiBzaG91bGQgYmUgZ2VuZXJhdGVkIHNwZWNpYWxseSAodXN1YWxseSBieSBjYWxsaW5nIGEgc3BlY2lhbCBpbmplY3Rpb24gZnVuY3Rpb24gaW5zdGVhZCBvZiB0aGVcbiAqIHN0YW5kYXJkIG9uZSkuXG4gKi9cbmV4cG9ydCBlbnVtIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSB7XG4gIC8qKlxuICAgKiBBIG5vcm1hbCB0b2tlbiBkZXBlbmRlbmN5LlxuICAgKi9cbiAgVG9rZW4gPSAwLFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYW4gYXR0cmlidXRlLlxuICAgKlxuICAgKiBUaGUgdG9rZW4gZXhwcmVzc2lvbiBpcyBhIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSBuYW1lLlxuICAgKi9cbiAgQXR0cmlidXRlID0gMSxcblxuICAvKipcbiAgICogVGhlIGRlcGVuZGVuY3kgaXMgZm9yIHRoZSBgSW5qZWN0b3JgIHR5cGUgaXRzZWxmLlxuICAgKi9cbiAgSW5qZWN0b3IgPSAyLFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYEVsZW1lbnRSZWZgLlxuICAgKi9cbiAgRWxlbWVudFJlZiA9IDMsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciBgVGVtcGxhdGVSZWZgLlxuICAgKi9cbiAgVGVtcGxhdGVSZWYgPSA0LFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYFZpZXdDb250YWluZXJSZWZgLlxuICAgKi9cbiAgVmlld0NvbnRhaW5lclJlZiA9IDUsXG59XG5cbi8qKlxuICogTWV0YWRhdGEgcmVwcmVzZW50aW5nIGEgc2luZ2xlIGRlcGVuZGVuY3kgdG8gYmUgaW5qZWN0ZWQgaW50byBhIGNvbnN0cnVjdG9yIG9yIGZ1bmN0aW9uIGNhbGwuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHRva2VuIG9yIHZhbHVlIHRvIGJlIGluamVjdGVkLlxuICAgKi9cbiAgdG9rZW46IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQW4gZW51bSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBkZXBlbmRlbmN5IGhhcyBzcGVjaWFsIG1lYW5pbmcgdG8gQW5ndWxhciBhbmQgbmVlZHMgdG8gYmVcbiAgICogaW5qZWN0ZWQgc3BlY2lhbGx5LlxuICAgKi9cbiAgcmVzb2x2ZWQ6IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQEhvc3QgcXVhbGlmaWVyLlxuICAgKi9cbiAgaG9zdDogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQE9wdGlvbmFsIHF1YWxpZmllci5cbiAgICovXG4gIG9wdGlvbmFsOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2VsZiBxdWFsaWZpZXIuXG4gICAqL1xuICBzZWxmOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2tpcFNlbGYgcXVhbGlmaWVyLlxuICAgKi9cbiAgc2tpcFNlbGY6IGJvb2xlYW47XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGEgZmFjdG9yeSBmdW5jdGlvbiBleHByZXNzaW9uIGZvciB0aGUgZ2l2ZW4gYFIzRmFjdG9yeU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24obWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBvLkV4cHJlc3Npb24ge1xuICAvLyBFYWNoIGRlcGVuZGVuY3kgYmVjb21lcyBhbiBpbnZvY2F0aW9uIG9mIGFuIGluamVjdCooKSBmdW5jdGlvbi5cbiAgY29uc3QgYXJncyA9XG4gICAgICBtZXRhLmRlcHMubWFwKGRlcCA9PiBjb21waWxlSW5qZWN0RGVwZW5kZW5jeShkZXAsIG1ldGEuaW5qZWN0Rm4sIG1ldGEudXNlT3B0aW9uYWxQYXJhbSkpO1xuXG4gIC8vIFRoZSBvdmVyYWxsIHJlc3VsdCBkZXBlbmRzIG9uIHdoZXRoZXIgdGhpcyBpcyBjb25zdHJ1Y3Rpb24gb3IgZnVuY3Rpb24gaW52b2NhdGlvbi5cbiAgY29uc3QgZXhwciA9IG1ldGEudXNlTmV3ID8gbmV3IG8uSW5zdGFudGlhdGVFeHByKG1ldGEuZm5PckNsYXNzLCBhcmdzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihtZXRhLmZuT3JDbGFzcywgYXJncyk7XG5cbiAgLy8gSWYgYGV4dHJhUmVzdWx0c2AgaXMgc3BlY2lmaWVkLCB0aGVuIHRoZSByZXN1bHQgaXMgYW4gYXJyYXkgY29uc2lzdGluZyBvZiB0aGUgaW5zdGFudGlhdGVkXG4gIC8vIHZhbHVlIHBsdXMgYW55IGV4dHJhIHJlc3VsdHMuXG4gIGNvbnN0IHJldEV4cHIgPVxuICAgICAgbWV0YS5leHRyYVJlc3VsdHMgPT09IHVuZGVmaW5lZCA/IGV4cHIgOiBvLmxpdGVyYWxBcnIoW2V4cHIsIC4uLm1ldGEuZXh0cmFSZXN1bHRzXSk7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0RXhwcildLCBvLklORkVSUkVEX1RZUEUsIHVuZGVmaW5lZCwgYCR7bWV0YS5uYW1lfV9GYWN0b3J5YCk7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVJbmplY3REZXBlbmRlbmN5KFxuICAgIGRlcDogUjNEZXBlbmRlbmN5TWV0YWRhdGEsIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHVzZU9wdGlvbmFsUGFyYW06IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJbnRlcnByZXQgdGhlIGRlcGVuZGVuY3kgYWNjb3JkaW5nIHRvIGl0cyByZXNvbHZlZCB0eXBlLlxuICBzd2l0Y2ggKGRlcC5yZXNvbHZlZCkge1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuOlxuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkluamVjdG9yOiB7XG4gICAgICAvLyBCdWlsZCB1cCB0aGUgaW5qZWN0aW9uIGZsYWdzIGFjY29yZGluZyB0byB0aGUgbWV0YWRhdGEuXG4gICAgICBjb25zdCBmbGFncyA9IEluamVjdEZsYWdzLkRlZmF1bHQgfCAoZGVwLnNlbGYgPyBJbmplY3RGbGFncy5TZWxmIDogMCkgfFxuICAgICAgICAgIChkZXAuc2tpcFNlbGYgPyBJbmplY3RGbGFncy5Ta2lwU2VsZiA6IDApIHwgKGRlcC5ob3N0ID8gSW5qZWN0RmxhZ3MuSG9zdCA6IDApIHxcbiAgICAgICAgICAoZGVwLm9wdGlvbmFsID8gSW5qZWN0RmxhZ3MuT3B0aW9uYWwgOiAwKTtcbiAgICAgIC8vIERldGVybWluZSB0aGUgdG9rZW4gdXNlZCBmb3IgaW5qZWN0aW9uLiBJbiBhbG1vc3QgYWxsIGNhc2VzIHRoaXMgaXMgdGhlIGdpdmVuIHRva2VuLCBidXRcbiAgICAgIC8vIGlmIHRoZSBkZXBlbmRlbmN5IGlzIHJlc29sdmVkIHRvIHRoZSBgSW5qZWN0b3JgIHRoZW4gdGhlIHNwZWNpYWwgYElOSkVDVE9SYCB0b2tlbiBpcyB1c2VkXG4gICAgICAvLyBpbnN0ZWFkLlxuICAgICAgbGV0IHRva2VuOiBvLkV4cHJlc3Npb24gPSBkZXAudG9rZW47XG4gICAgICBpZiAoZGVwLnJlc29sdmVkID09PSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW5qZWN0b3IpIHtcbiAgICAgICAgdG9rZW4gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuSU5KRUNUT1IpO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB1cCB0aGUgYXJndW1lbnRzIHRvIHRoZSBpbmplY3RGbiBjYWxsLlxuICAgICAgY29uc3QgaW5qZWN0QXJncyA9IFtkZXAudG9rZW5dO1xuICAgICAgLy8gSWYgdGhpcyBkZXBlbmRlbmN5IGlzIG9wdGlvbmFsIG9yIG90aGVyd2lzZSBoYXMgbm9uLWRlZmF1bHQgZmxhZ3MsIHRoZW4gYWRkaXRpb25hbFxuICAgICAgLy8gcGFyYW1ldGVycyBkZXNjcmliaW5nIGhvdyB0byBpbmplY3QgdGhlIGRlcGVuZGVuY3kgbXVzdCBiZSBwYXNzZWQgdG8gdGhlIGluamVjdCBmdW5jdGlvblxuICAgICAgLy8gdGhhdCdzIGJlaW5nIHVzZWQuXG4gICAgICBpZiAoZmxhZ3MgIT09IEluamVjdEZsYWdzLkRlZmF1bHQgfHwgZGVwLm9wdGlvbmFsKSB7XG4gICAgICAgIC8vIEVpdGhlciB0aGUgZGVwZW5kZW5jeSBpcyBvcHRpb25hbCwgb3Igbm9uLWRlZmF1bHQgZmxhZ3MgYXJlIGluIHVzZS4gRWl0aGVyIG9mIHRoZXNlIGNhc2VzXG4gICAgICAgIC8vIG5lY2Vzc2l0YXRlcyBhZGRpbmcgYW4gYXJndW1lbnQgZm9yIHRoZSBkZWZhdWx0IHZhbHVlIGlmIHN1Y2ggYW4gYXJndW1lbnQgaXMgcmVxdWlyZWRcbiAgICAgICAgLy8gYnkgdGhlIGluamVjdCBmdW5jdGlvbiAodXNlT3B0aW9uYWxQYXJhbSA9PT0gdHJ1ZSkuXG4gICAgICAgIGlmICh1c2VPcHRpb25hbFBhcmFtKSB7XG4gICAgICAgICAgLy8gVGhlIGluamVjdCBmdW5jdGlvbiByZXF1aXJlcyBhIGRlZmF1bHQgdmFsdWUgcGFyYW1ldGVyLlxuICAgICAgICAgIGluamVjdEFyZ3MucHVzaChkZXAub3B0aW9uYWwgPyBvLk5VTExfRVhQUiA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGUgbGFzdCBwYXJhbWV0ZXIgaXMgYWx3YXlzIHRoZSBJbmplY3RGbGFncywgd2hpY2ggb25seSBuZWVkIHRvIGJlIHNwZWNpZmllZCBpZiB0aGV5J3JlXG4gICAgICAgIC8vIG5vbi1kZWZhdWx0LlxuICAgICAgICBpZiAoZmxhZ3MgIT09IEluamVjdEZsYWdzLkRlZmF1bHQpIHtcbiAgICAgICAgICBpbmplY3RBcmdzLnB1c2goby5saXRlcmFsKGZsYWdzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoaW5qZWN0Rm4pLmNhbGxGbihpbmplY3RBcmdzKTtcbiAgICB9XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlOlxuICAgICAgLy8gSW4gdGhlIGNhc2Ugb2YgYXR0cmlidXRlcywgdGhlIGF0dHJpYnV0ZSBuYW1lIGluIHF1ZXN0aW9uIGlzIGdpdmVuIGFzIHRoZSB0b2tlbi5cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0QXR0cmlidXRlKS5jYWxsRm4oW2RlcC50b2tlbl0pO1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkVsZW1lbnRSZWY6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdEVsZW1lbnRSZWYpLmNhbGxGbihbXSk7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVGVtcGxhdGVSZWY6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdFRlbXBsYXRlUmVmKS5jYWxsRm4oW10pO1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlZpZXdDb250YWluZXJSZWY6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdFZpZXdDb250YWluZXJSZWYpLmNhbGxGbihbXSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bnN1cHBvcnRlZChcbiAgICAgICAgICBgVW5rbm93biBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU6ICR7UjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlW2RlcC5yZXNvbHZlZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGhlbHBlciBmdW5jdGlvbiB1c2VmdWwgZm9yIGV4dHJhY3RpbmcgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmcm9tIGEgUmVuZGVyMlxuICogYENvbXBpbGVUeXBlTWV0YWRhdGFgIGluc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdIHtcbiAgLy8gVXNlIHRoZSBgQ29tcGlsZVJlZmxlY3RvcmAgdG8gbG9vayB1cCByZWZlcmVuY2VzIHRvIHNvbWUgd2VsbC1rbm93biBBbmd1bGFyIHR5cGVzLiBUaGVzZSB3aWxsXG4gIC8vIGJlIGNvbXBhcmVkIHdpdGggdGhlIHRva2VuIHRvIHN0YXRpY2FsbHkgZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHRva2VuIGhhcyBzaWduaWZpY2FuY2UgdG9cbiAgLy8gQW5ndWxhciwgYW5kIHNldCB0aGUgY29ycmVjdCBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBhcyBhIHJlc3VsdC5cbiAgY29uc3QgZWxlbWVudFJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZik7XG4gIGNvbnN0IHRlbXBsYXRlUmVmID0gcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gIGNvbnN0IHZpZXdDb250YWluZXJSZWYgPSByZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlZpZXdDb250YWluZXJSZWYpO1xuICBjb25zdCBpbmplY3RvclJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpO1xuXG4gIC8vIEl0ZXJhdGUgdGhyb3VnaCB0aGUgdHlwZSdzIERJIGRlcGVuZGVuY2llcyBhbmQgcHJvZHVjZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZvciBlYWNoIG9mIHRoZW0uXG4gIGNvbnN0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgZm9yIChsZXQgZGVwZW5kZW5jeSBvZiB0eXBlLmRpRGVwcykge1xuICAgIGlmIChkZXBlbmRlbmN5LnRva2VuKSB7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKGRlcGVuZGVuY3kudG9rZW4pO1xuICAgICAgbGV0IHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVG9rZW47XG4gICAgICBpZiAodG9rZW5SZWYgPT09IGVsZW1lbnRSZWYpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuRWxlbWVudFJlZjtcbiAgICAgIH0gZWxzZSBpZiAodG9rZW5SZWYgPT09IHRlbXBsYXRlUmVmKSB7XG4gICAgICAgIHJlc29sdmVkID0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRlbXBsYXRlUmVmO1xuICAgICAgfSBlbHNlIGlmICh0b2tlblJlZiA9PT0gdmlld0NvbnRhaW5lclJlZikge1xuICAgICAgICByZXNvbHZlZCA9IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5WaWV3Q29udGFpbmVyUmVmO1xuICAgICAgfSBlbHNlIGlmICh0b2tlblJlZiA9PT0gaW5qZWN0b3JSZWYpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW5qZWN0b3I7XG4gICAgICB9IGVsc2UgaWYgKGRlcGVuZGVuY3kuaXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlO1xuICAgICAgfVxuXG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBtb3N0IGRlcGVuZGVuY2llcywgdGhlIHRva2VuIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8gYSB0eXBlLiBTb21ldGltZXMsXG4gICAgICAvLyBob3dldmVyLCBpdCBjYW4gYmUgYSBzdHJpbmcsIGluIHRoZSBjYXNlIG9mIG9sZGVyIEFuZ3VsYXIgY29kZSBvciBAQXR0cmlidXRlIGluamVjdGlvbi5cbiAgICAgIGNvbnN0IHRva2VuID1cbiAgICAgICAgICB0b2tlblJlZiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCA/IG91dHB1dEN0eC5pbXBvcnRFeHByKHRva2VuUmVmKSA6IG8ubGl0ZXJhbCh0b2tlblJlZik7XG5cbiAgICAgIC8vIENvbnN0cnVjdCB0aGUgZGVwZW5kZW5jeS5cbiAgICAgIGRlcHMucHVzaCh7XG4gICAgICAgIHRva2VuLFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgaG9zdDogISFkZXBlbmRlbmN5LmlzSG9zdCxcbiAgICAgICAgb3B0aW9uYWw6ICEhZGVwZW5kZW5jeS5pc09wdGlvbmFsLFxuICAgICAgICBzZWxmOiAhIWRlcGVuZGVuY3kuaXNTZWxmLFxuICAgICAgICBza2lwU2VsZjogISFkZXBlbmRlbmN5LmlzU2tpcFNlbGYsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdW5zdXBwb3J0ZWQoJ2RlcGVuZGVuY3kgd2l0aG91dCBhIHRva2VuJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlcHM7XG59XG4iXX0=