/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { StaticSymbol } from '../aot/static_symbol';
import { tokenReference } from '../compile_metadata';
import { Identifiers } from '../identifiers';
import * as o from '../output/output_ast';
import { Identifiers as R3 } from '../render3/r3_identifiers';
import { unsupported } from './view/util';
export var R3FactoryDelegateType;
(function (R3FactoryDelegateType) {
    R3FactoryDelegateType[R3FactoryDelegateType["Class"] = 0] = "Class";
    R3FactoryDelegateType[R3FactoryDelegateType["Function"] = 1] = "Function";
    R3FactoryDelegateType[R3FactoryDelegateType["Factory"] = 2] = "Factory";
})(R3FactoryDelegateType || (R3FactoryDelegateType = {}));
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
})(R3ResolvedDependencyType || (R3ResolvedDependencyType = {}));
/**
 * Construct a factory function expression for the given `R3FactoryMetadata`.
 */
export function compileFactoryFunction(meta) {
    const t = o.variable('t');
    const statements = [];
    // The type to instantiate via constructor invocation. If there is no delegated factory, meaning
    // this type is always created by constructor invocation, then this is the type-to-create
    // parameter provided by the user (t) if specified, or the current type if not. If there is a
    // delegated factory (which is used to create the current type) then this is only the type-to-
    // create parameter (t).
    const typeForCtor = !isDelegatedMetadata(meta) ? new o.BinaryOperatorExpr(o.BinaryOperator.Or, t, meta.type) : t;
    let ctorExpr = null;
    if (meta.deps !== null) {
        // There is a constructor (either explicitly or implicitly defined).
        ctorExpr = new o.InstantiateExpr(typeForCtor, injectDependencies(meta.deps, meta.injectFn));
    }
    else {
        const baseFactory = o.variable(`ɵ${meta.name}_BaseFactory`);
        const getInheritedFactory = o.importExpr(R3.getInheritedFactory);
        const baseFactoryStmt = baseFactory.set(getInheritedFactory.callFn([meta.type])).toDeclStmt(o.INFERRED_TYPE, [
            o.StmtModifier.Exported, o.StmtModifier.Final
        ]);
        statements.push(baseFactoryStmt);
        // There is no constructor, use the base class' factory to construct typeForCtor.
        ctorExpr = baseFactory.callFn([typeForCtor]);
    }
    const ctorExprFinal = ctorExpr;
    const body = [];
    let retExpr = null;
    function makeConditionalFactory(nonCtorExpr) {
        const r = o.variable('r');
        body.push(r.set(o.NULL_EXPR).toDeclStmt());
        body.push(o.ifStmt(t, [r.set(ctorExprFinal).toStmt()], [r.set(nonCtorExpr).toStmt()]));
        return r;
    }
    if (isDelegatedMetadata(meta) && meta.delegateType === R3FactoryDelegateType.Factory) {
        const delegateFactory = o.variable(`ɵ${meta.name}_BaseFactory`);
        const getFactoryOf = o.importExpr(R3.getFactoryOf);
        if (meta.delegate.isEquivalent(meta.type)) {
            throw new Error(`Illegal state: compiling factory that delegates to itself`);
        }
        const delegateFactoryStmt = delegateFactory.set(getFactoryOf.callFn([meta.delegate])).toDeclStmt(o.INFERRED_TYPE, [
            o.StmtModifier.Exported, o.StmtModifier.Final
        ]);
        statements.push(delegateFactoryStmt);
        retExpr = makeConditionalFactory(delegateFactory.callFn([]));
    }
    else if (isDelegatedMetadata(meta)) {
        // This type is created with a delegated factory. If a type parameter is not specified, call
        // the factory instead.
        const delegateArgs = injectDependencies(meta.delegateDeps, meta.injectFn);
        // Either call `new delegate(...)` or `delegate(...)` depending on meta.useNewForDelegate.
        const factoryExpr = new (meta.delegateType === R3FactoryDelegateType.Class ?
            o.InstantiateExpr :
            o.InvokeFunctionExpr)(meta.delegate, delegateArgs);
        retExpr = makeConditionalFactory(factoryExpr);
    }
    else if (isExpressionFactoryMetadata(meta)) {
        // TODO(alxhub): decide whether to lower the value here or in the caller
        retExpr = makeConditionalFactory(meta.expression);
    }
    else {
        retExpr = ctorExpr;
    }
    return {
        factory: o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], [...body, new o.ReturnStatement(retExpr)], o.INFERRED_TYPE, undefined, `${meta.name}_Factory`),
        statements,
    };
}
function injectDependencies(deps, injectFn) {
    return deps.map(dep => compileInjectDependency(dep, injectFn));
}
function compileInjectDependency(dep, injectFn) {
    // Interpret the dependency according to its resolved type.
    switch (dep.resolved) {
        case R3ResolvedDependencyType.Token: {
            // Build up the injection flags according to the metadata.
            const flags = 0 /* Default */ | (dep.self ? 2 /* Self */ : 0) |
                (dep.skipSelf ? 4 /* SkipSelf */ : 0) | (dep.host ? 1 /* Host */ : 0) |
                (dep.optional ? 8 /* Optional */ : 0);
            // Build up the arguments to the injectFn call.
            const injectArgs = [dep.token];
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
        default:
            return unsupported(`Unknown R3ResolvedDependencyType: ${R3ResolvedDependencyType[dep.resolved]}`);
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
    const injectorRef = reflector.resolveExternalReference(Identifiers.Injector);
    // Iterate through the type's DI dependencies and produce `R3DependencyMetadata` for each of them.
    const deps = [];
    for (let dependency of type.diDeps) {
        if (dependency.token) {
            const tokenRef = tokenReference(dependency.token);
            let resolved = dependency.isAttribute ?
                R3ResolvedDependencyType.Attribute :
                R3ResolvedDependencyType.Token;
            // In the case of most dependencies, the token will be a reference to a type. Sometimes,
            // however, it can be a string, in the case of older Angular code or @Attribute injection.
            const token = tokenRef instanceof StaticSymbol ? outputCtx.importExpr(tokenRef) : o.literal(tokenRef);
            // Construct the dependency.
            deps.push({
                token,
                resolved,
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
    return deps;
}
function isDelegatedMetadata(meta) {
    return meta.delegateType !== undefined;
}
function isExpressionFactoryMetadata(meta) {
    return meta.expression !== undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ2xELE9BQU8sRUFBc0IsY0FBYyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFHeEUsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzNDLE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDMUMsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUc1RCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBb0N4QyxNQUFNLENBQU4sSUFBWSxxQkFJWDtBQUpELFdBQVkscUJBQXFCO0lBQy9CLG1FQUFLLENBQUE7SUFDTCx5RUFBUSxDQUFBO0lBQ1IsdUVBQU8sQ0FBQTtBQUNULENBQUMsRUFKVyxxQkFBcUIsS0FBckIscUJBQXFCLFFBSWhDO0FBb0JEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLENBQU4sSUFBWSx3QkFZWDtBQVpELFdBQVksd0JBQXdCO0lBQ2xDOztPQUVHO0lBQ0gseUVBQVMsQ0FBQTtJQUVUOzs7O09BSUc7SUFDSCxpRkFBYSxDQUFBO0FBQ2YsQ0FBQyxFQVpXLHdCQUF3QixLQUF4Qix3QkFBd0IsUUFZbkM7QUFzQ0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsSUFBdUI7SUFFNUQsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQixNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO0lBRXJDLGdHQUFnRztJQUNoRyx5RkFBeUY7SUFDekYsNkZBQTZGO0lBQzdGLDhGQUE4RjtJQUM5Rix3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QUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUU1Riw0QkFBNEI7WUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDUixLQUFLO2dCQUNMLFFBQVE7Z0JBQ1IsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTTtnQkFDekIsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVTtnQkFDakMsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTTtnQkFDekIsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVTthQUNsQyxDQUFDLENBQUM7U0FDSjthQUFNO1lBQ0wsV0FBVyxDQUFDLDRCQUE0QixDQUFDLENBQUM7U0FDM0M7S0FDRjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsSUFBdUI7SUFFbEQsT0FBUSxJQUFZLENBQUMsWUFBWSxLQUFLLFNBQVMsQ0FBQztBQUNsRCxDQUFDO0FBRUQsU0FBUywyQkFBMkIsQ0FBQyxJQUF1QjtJQUMxRCxPQUFRLElBQVksQ0FBQyxVQUFVLEtBQUssU0FBUyxDQUFDO0FBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVUeXBlTWV0YWRhdGEsIHRva2VuUmVmZXJlbmNlfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtJbmplY3RGbGFnc30gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHt1bnN1cHBvcnRlZH0gZnJvbSAnLi92aWV3L3V0aWwnO1xuXG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRvIGdlbmVyYXRlIGEgYGZhY3RvcnlgIGZ1bmN0aW9uIGZvciBhIHR5cGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBTdHJpbmcgbmFtZSBvZiB0aGUgdHlwZSBiZWluZyBnZW5lcmF0ZWQgKHVzZWQgdG8gbmFtZSB0aGUgZmFjdG9yeSBmdW5jdGlvbikuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBmdW5jdGlvbiAob3IgY29uc3RydWN0b3IpIHdoaWNoIHdpbGwgaW5zdGFudGlhdGUgdGhlIHJlcXVlc3RlZFxuICAgKiB0eXBlLlxuICAgKlxuICAgKiBUaGlzIGNvdWxkIGJlIGEgcmVmZXJlbmNlIHRvIGEgY29uc3RydWN0b3IgdHlwZSwgb3IgdG8gYSB1c2VyLWRlZmluZWQgZmFjdG9yeSBmdW5jdGlvbi4gVGhlXG4gICAqIGB1c2VOZXdgIHByb3BlcnR5IGRldGVybWluZXMgd2hldGhlciBpdCB3aWxsIGJlIGNhbGxlZCBhcyBhIGNvbnN0cnVjdG9yIG9yIG5vdC5cbiAgICovXG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogUmVnYXJkbGVzcyBvZiB3aGV0aGVyIGBmbk9yQ2xhc3NgIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gb3IgYSB1c2VyLWRlZmluZWQgZmFjdG9yeSwgaXRcbiAgICogbWF5IGhhdmUgMCBvciBtb3JlIHBhcmFtZXRlcnMsIHdoaWNoIHdpbGwgYmUgaW5qZWN0ZWQgYWNjb3JkaW5nIHRvIHRoZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgXG4gICAqIGZvciB0aG9zZSBwYXJhbWV0ZXJzLiBJZiB0aGlzIGlzIGBudWxsYCwgdGhlbiB0aGUgdHlwZSdzIGNvbnN0cnVjdG9yIGlzIG5vbmV4aXN0ZW50IGFuZCB3aWxsXG4gICAqIGJlIGluaGVyaXRlZCBmcm9tIGBmbk9yQ2xhc3NgIHdoaWNoIGlzIGludGVycHJldGVkIGFzIHRoZSBjdXJyZW50IHR5cGUuXG4gICAqL1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGw7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gZm9yIHRoZSBmdW5jdGlvbiB3aGljaCB3aWxsIGJlIHVzZWQgdG8gaW5qZWN0IGRlcGVuZGVuY2llcy4gVGhlIEFQSSBvZiB0aGlzXG4gICAqIGZ1bmN0aW9uIGNvdWxkIGJlIGRpZmZlcmVudCwgYW5kIG90aGVyIG9wdGlvbnMgY29udHJvbCBob3cgaXQgd2lsbCBiZSBpbnZva2VkLlxuICAgKi9cbiAgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG59XG5cbmV4cG9ydCBlbnVtIFIzRmFjdG9yeURlbGVnYXRlVHlwZSB7XG4gIENsYXNzLFxuICBGdW5jdGlvbixcbiAgRmFjdG9yeSxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlbGVnYXRlZEZhY3RvcnlNZXRhZGF0YSBleHRlbmRzIFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEge1xuICBkZWxlZ2F0ZTogby5FeHByZXNzaW9uO1xuICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GYWN0b3J5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEgZXh0ZW5kcyBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHtcbiAgZGVsZWdhdGU6IG8uRXhwcmVzc2lvbjtcbiAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3N8UjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uO1xuICBkZWxlZ2F0ZURlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhIGV4dGVuZHMgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IHR5cGUgUjNGYWN0b3J5TWV0YWRhdGEgPSBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHwgUjNEZWxlZ2F0ZWRGYWN0b3J5TWV0YWRhdGEgfFxuICAgIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEgfCBSM0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGE7XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiBhIGRlcGVuZGVuY3kuXG4gKlxuICogT2NjYXNpb25hbGx5LCBkZXBlbmRlbmNpZXMgd2lsbCBoYXZlIHNwZWNpYWwgc2lnbmlmaWNhbmNlIHdoaWNoIGlzIGtub3duIHN0YXRpY2FsbHkuIEluIHRoYXRcbiAqIGNhc2UgdGhlIGBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGVgIGluZm9ybXMgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRoYXQgYSBwYXJ0aWN1bGFyIGRlcGVuZGVuY3lcbiAqIHNob3VsZCBiZSBnZW5lcmF0ZWQgc3BlY2lhbGx5ICh1c3VhbGx5IGJ5IGNhbGxpbmcgYSBzcGVjaWFsIGluamVjdGlvbiBmdW5jdGlvbiBpbnN0ZWFkIG9mIHRoZVxuICogc3RhbmRhcmQgb25lKS5cbiAqL1xuZXhwb3J0IGVudW0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIHtcbiAgLyoqXG4gICAqIEEgbm9ybWFsIHRva2VuIGRlcGVuZGVuY3kuXG4gICAqL1xuICBUb2tlbiA9IDAsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciBhbiBhdHRyaWJ1dGUuXG4gICAqXG4gICAqIFRoZSB0b2tlbiBleHByZXNzaW9uIGlzIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgYXR0cmlidXRlIG5hbWUuXG4gICAqL1xuICBBdHRyaWJ1dGUgPSAxLFxufVxuXG4vKipcbiAqIE1ldGFkYXRhIHJlcHJlc2VudGluZyBhIHNpbmdsZSBkZXBlbmRlbmN5IHRvIGJlIGluamVjdGVkIGludG8gYSBjb25zdHJ1Y3RvciBvciBmdW5jdGlvbiBjYWxsLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSB0b2tlbiBvciB2YWx1ZSB0byBiZSBpbmplY3RlZC5cbiAgICovXG4gIHRva2VuOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIEFuIGVudW0gaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgZGVwZW5kZW5jeSBoYXMgc3BlY2lhbCBtZWFuaW5nIHRvIEFuZ3VsYXIgYW5kIG5lZWRzIHRvIGJlXG4gICAqIGluamVjdGVkIHNwZWNpYWxseS5cbiAgICovXG4gIHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBIb3N0IHF1YWxpZmllci5cbiAgICovXG4gIGhvc3Q6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBPcHRpb25hbCBxdWFsaWZpZXIuXG4gICAqL1xuICBvcHRpb25hbDogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQFNlbGYgcXVhbGlmaWVyLlxuICAgKi9cbiAgc2VsZjogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQFNraXBTZWxmIHF1YWxpZmllci5cbiAgICovXG4gIHNraXBTZWxmOiBib29sZWFuO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhIGZhY3RvcnkgZnVuY3Rpb24gZXhwcmVzc2lvbiBmb3IgdGhlIGdpdmVuIGBSM0ZhY3RvcnlNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTpcbiAgICB7ZmFjdG9yeTogby5FeHByZXNzaW9uLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB7XG4gIGNvbnN0IHQgPSBvLnZhcmlhYmxlKCd0Jyk7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICAvLyBUaGUgdHlwZSB0byBpbnN0YW50aWF0ZSB2aWEgY29uc3RydWN0b3IgaW52b2NhdGlvbi4gSWYgdGhlcmUgaXMgbm8gZGVsZWdhdGVkIGZhY3RvcnksIG1lYW5pbmdcbiAgLy8gdGhpcyB0eXBlIGlzIGFsd2F5cyBjcmVhdGVkIGJ5IGNvbnN0cnVjdG9yIGludm9jYXRpb24sIHRoZW4gdGhpcyBpcyB0aGUgdHlwZS10by1jcmVhdGVcbiAgLy8gcGFyYW1ldGVyIHByb3ZpZGVkIGJ5IHRoZSB1c2VyICh0KSBpZiBzcGVjaWZpZWQsIG9yIHRoZSBjdXJyZW50IHR5cGUgaWYgbm90LiBJZiB0aGVyZSBpcyBhXG4gIC8vIGRlbGVnYXRlZCBmYWN0b3J5ICh3aGljaCBpcyB1c2VkIHRvIGNyZWF0ZSB0aGUgY3VycmVudCB0eXBlKSB0aGVuIHRoaXMgaXMgb25seSB0aGUgdHlwZS10by1cbiAgLy8gY3JlYXRlIHBhcmFtZXRlciAodCkuXG4gIGNvbnN0IHR5cGVGb3JDdG9yID1cbiAgICAgICFpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGEpID8gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKG8uQmluYXJ5T3BlcmF0b3IuT3IsIHQsIG1ldGEudHlwZSkgOiB0O1xuXG4gIGxldCBjdG9yRXhwcjogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICBpZiAobWV0YS5kZXBzICE9PSBudWxsKSB7XG4gICAgLy8gVGhlcmUgaXMgYSBjb25zdHJ1Y3RvciAoZWl0aGVyIGV4cGxpY2l0bHkgb3IgaW1wbGljaXRseSBkZWZpbmVkKS5cbiAgICBjdG9yRXhwciA9IG5ldyBvLkluc3RhbnRpYXRlRXhwcih0eXBlRm9yQ3RvciwgaW5qZWN0RGVwZW5kZW5jaWVzKG1ldGEuZGVwcywgbWV0YS5pbmplY3RGbikpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGJhc2VGYWN0b3J5ID0gby52YXJpYWJsZShgybUke21ldGEubmFtZX1fQmFzZUZhY3RvcnlgKTtcbiAgICBjb25zdCBnZXRJbmhlcml0ZWRGYWN0b3J5ID0gby5pbXBvcnRFeHByKFIzLmdldEluaGVyaXRlZEZhY3RvcnkpO1xuICAgIGNvbnN0IGJhc2VGYWN0b3J5U3RtdCA9XG4gICAgICAgIGJhc2VGYWN0b3J5LnNldChnZXRJbmhlcml0ZWRGYWN0b3J5LmNhbGxGbihbbWV0YS50eXBlXSkpLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbXG4gICAgICAgICAgby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQsIG8uU3RtdE1vZGlmaWVyLkZpbmFsXG4gICAgICAgIF0pO1xuICAgIHN0YXRlbWVudHMucHVzaChiYXNlRmFjdG9yeVN0bXQpO1xuXG4gICAgLy8gVGhlcmUgaXMgbm8gY29uc3RydWN0b3IsIHVzZSB0aGUgYmFzZSBjbGFzcycgZmFjdG9yeSB0byBjb25zdHJ1Y3QgdHlwZUZvckN0b3IuXG4gICAgY3RvckV4cHIgPSBiYXNlRmFjdG9yeS5jYWxsRm4oW3R5cGVGb3JDdG9yXSk7XG4gIH1cbiAgY29uc3QgY3RvckV4cHJGaW5hbCA9IGN0b3JFeHByO1xuXG4gIGNvbnN0IGJvZHk6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgbGV0IHJldEV4cHI6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICBmdW5jdGlvbiBtYWtlQ29uZGl0aW9uYWxGYWN0b3J5KG5vbkN0b3JFeHByOiBvLkV4cHJlc3Npb24pOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCByID0gby52YXJpYWJsZSgncicpO1xuICAgIGJvZHkucHVzaChyLnNldChvLk5VTExfRVhQUikudG9EZWNsU3RtdCgpKTtcbiAgICBib2R5LnB1c2goby5pZlN0bXQodCwgW3Iuc2V0KGN0b3JFeHByRmluYWwpLnRvU3RtdCgpXSwgW3Iuc2V0KG5vbkN0b3JFeHByKS50b1N0bXQoKV0pKTtcbiAgICByZXR1cm4gcjtcbiAgfVxuXG4gIGlmIChpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGEpICYmIG1ldGEuZGVsZWdhdGVUeXBlID09PSBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRmFjdG9yeSkge1xuICAgIGNvbnN0IGRlbGVnYXRlRmFjdG9yeSA9IG8udmFyaWFibGUoYMm1JHttZXRhLm5hbWV9X0Jhc2VGYWN0b3J5YCk7XG4gICAgY29uc3QgZ2V0RmFjdG9yeU9mID0gby5pbXBvcnRFeHByKFIzLmdldEZhY3RvcnlPZik7XG4gICAgaWYgKG1ldGEuZGVsZWdhdGUuaXNFcXVpdmFsZW50KG1ldGEudHlwZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBzdGF0ZTogY29tcGlsaW5nIGZhY3RvcnkgdGhhdCBkZWxlZ2F0ZXMgdG8gaXRzZWxmYCk7XG4gICAgfVxuICAgIGNvbnN0IGRlbGVnYXRlRmFjdG9yeVN0bXQgPVxuICAgICAgICBkZWxlZ2F0ZUZhY3Rvcnkuc2V0KGdldEZhY3RvcnlPZi5jYWxsRm4oW21ldGEuZGVsZWdhdGVdKSkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICBvLlN0bXRNb2RpZmllci5FeHBvcnRlZCwgby5TdG10TW9kaWZpZXIuRmluYWxcbiAgICAgICAgXSk7XG5cbiAgICBzdGF0ZW1lbnRzLnB1c2goZGVsZWdhdGVGYWN0b3J5U3RtdCk7XG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkoZGVsZWdhdGVGYWN0b3J5LmNhbGxGbihbXSkpO1xuICB9IGVsc2UgaWYgKGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YSkpIHtcbiAgICAvLyBUaGlzIHR5cGUgaXMgY3JlYXRlZCB3aXRoIGEgZGVsZWdhdGVkIGZhY3RvcnkuIElmIGEgdHlwZSBwYXJhbWV0ZXIgaXMgbm90IHNwZWNpZmllZCwgY2FsbFxuICAgIC8vIHRoZSBmYWN0b3J5IGluc3RlYWQuXG4gICAgY29uc3QgZGVsZWdhdGVBcmdzID0gaW5qZWN0RGVwZW5kZW5jaWVzKG1ldGEuZGVsZWdhdGVEZXBzLCBtZXRhLmluamVjdEZuKTtcbiAgICAvLyBFaXRoZXIgY2FsbCBgbmV3IGRlbGVnYXRlKC4uLilgIG9yIGBkZWxlZ2F0ZSguLi4pYCBkZXBlbmRpbmcgb24gbWV0YS51c2VOZXdGb3JEZWxlZ2F0ZS5cbiAgICBjb25zdCBmYWN0b3J5RXhwciA9IG5ldyAoXG4gICAgICAgIG1ldGEuZGVsZWdhdGVUeXBlID09PSBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3MgP1xuICAgICAgICAgICAgby5JbnN0YW50aWF0ZUV4cHIgOlxuICAgICAgICAgICAgby5JbnZva2VGdW5jdGlvbkV4cHIpKG1ldGEuZGVsZWdhdGUsIGRlbGVnYXRlQXJncyk7XG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkoZmFjdG9yeUV4cHIpO1xuICB9IGVsc2UgaWYgKGlzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YShtZXRhKSkge1xuICAgIC8vIFRPRE8oYWx4aHViKTogZGVjaWRlIHdoZXRoZXIgdG8gbG93ZXIgdGhlIHZhbHVlIGhlcmUgb3IgaW4gdGhlIGNhbGxlclxuICAgIHJldEV4cHIgPSBtYWtlQ29uZGl0aW9uYWxGYWN0b3J5KG1ldGEuZXhwcmVzc2lvbik7XG4gIH0gZWxzZSB7XG4gICAgcmV0RXhwciA9IGN0b3JFeHByO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBmYWN0b3J5OiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbSgndCcsIG8uRFlOQU1JQ19UWVBFKV0sIFsuLi5ib2R5LCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0RXhwcildLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIHVuZGVmaW5lZCwgYCR7bWV0YS5uYW1lfV9GYWN0b3J5YCksXG4gICAgc3RhdGVtZW50cyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5qZWN0RGVwZW5kZW5jaWVzKFxuICAgIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10sIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlKTogby5FeHByZXNzaW9uW10ge1xuICByZXR1cm4gZGVwcy5tYXAoZGVwID0+IGNvbXBpbGVJbmplY3REZXBlbmRlbmN5KGRlcCwgaW5qZWN0Rm4pKTtcbn1cblxuZnVuY3Rpb24gY29tcGlsZUluamVjdERlcGVuZGVuY3koXG4gICAgZGVwOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJbnRlcnByZXQgdGhlIGRlcGVuZGVuY3kgYWNjb3JkaW5nIHRvIGl0cyByZXNvbHZlZCB0eXBlLlxuICBzd2l0Y2ggKGRlcC5yZXNvbHZlZCkge1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuOiB7XG4gICAgICAvLyBCdWlsZCB1cCB0aGUgaW5qZWN0aW9uIGZsYWdzIGFjY29yZGluZyB0byB0aGUgbWV0YWRhdGEuXG4gICAgICBjb25zdCBmbGFncyA9IEluamVjdEZsYWdzLkRlZmF1bHQgfCAoZGVwLnNlbGYgPyBJbmplY3RGbGFncy5TZWxmIDogMCkgfFxuICAgICAgICAgIChkZXAuc2tpcFNlbGYgPyBJbmplY3RGbGFncy5Ta2lwU2VsZiA6IDApIHwgKGRlcC5ob3N0ID8gSW5qZWN0RmxhZ3MuSG9zdCA6IDApIHxcbiAgICAgICAgICAoZGVwLm9wdGlvbmFsID8gSW5qZWN0RmxhZ3MuT3B0aW9uYWwgOiAwKTtcblxuICAgICAgLy8gQnVpbGQgdXAgdGhlIGFyZ3VtZW50cyB0byB0aGUgaW5qZWN0Rm4gY2FsbC5cbiAgICAgIGNvbnN0IGluamVjdEFyZ3MgPSBbZGVwLnRva2VuXTtcbiAgICAgIC8vIElmIHRoaXMgZGVwZW5kZW5jeSBpcyBvcHRpb25hbCBvciBvdGhlcndpc2UgaGFzIG5vbi1kZWZhdWx0IGZsYWdzLCB0aGVuIGFkZGl0aW9uYWxcbiAgICAgIC8vIHBhcmFtZXRlcnMgZGVzY3JpYmluZyBob3cgdG8gaW5qZWN0IHRoZSBkZXBlbmRlbmN5IG11c3QgYmUgcGFzc2VkIHRvIHRoZSBpbmplY3QgZnVuY3Rpb25cbiAgICAgIC8vIHRoYXQncyBiZWluZyB1c2VkLlxuICAgICAgaWYgKGZsYWdzICE9PSBJbmplY3RGbGFncy5EZWZhdWx0IHx8IGRlcC5vcHRpb25hbCkge1xuICAgICAgICBpbmplY3RBcmdzLnB1c2goby5saXRlcmFsKGZsYWdzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKGluamVjdEZuKS5jYWxsRm4oaW5qZWN0QXJncyk7XG4gICAgfVxuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZTpcbiAgICAgIC8vIEluIHRoZSBjYXNlIG9mIGF0dHJpYnV0ZXMsIHRoZSBhdHRyaWJ1dGUgbmFtZSBpbiBxdWVzdGlvbiBpcyBnaXZlbiBhcyB0aGUgdG9rZW4uXG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdEF0dHJpYnV0ZSkuY2FsbEZuKFtkZXAudG9rZW5dKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuc3VwcG9ydGVkKFxuICAgICAgICAgIGBVbmtub3duIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTogJHtSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGVbZGVwLnJlc29sdmVkXX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgaGVscGVyIGZ1bmN0aW9uIHVzZWZ1bCBmb3IgZXh0cmFjdGluZyBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZyb20gYSBSZW5kZXIyXG4gKiBgQ29tcGlsZVR5cGVNZXRhZGF0YWAgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXBlbmRlbmNpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgdHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10ge1xuICAvLyBVc2UgdGhlIGBDb21waWxlUmVmbGVjdG9yYCB0byBsb29rIHVwIHJlZmVyZW5jZXMgdG8gc29tZSB3ZWxsLWtub3duIEFuZ3VsYXIgdHlwZXMuIFRoZXNlIHdpbGxcbiAgLy8gYmUgY29tcGFyZWQgd2l0aCB0aGUgdG9rZW4gdG8gc3RhdGljYWxseSBkZXRlcm1pbmUgd2hldGhlciB0aGUgdG9rZW4gaGFzIHNpZ25pZmljYW5jZSB0b1xuICAvLyBBbmd1bGFyLCBhbmQgc2V0IHRoZSBjb3JyZWN0IGBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGVgIGFzIGEgcmVzdWx0LlxuICBjb25zdCBpbmplY3RvclJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpO1xuXG4gIC8vIEl0ZXJhdGUgdGhyb3VnaCB0aGUgdHlwZSdzIERJIGRlcGVuZGVuY2llcyBhbmQgcHJvZHVjZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZvciBlYWNoIG9mIHRoZW0uXG4gIGNvbnN0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgZm9yIChsZXQgZGVwZW5kZW5jeSBvZiB0eXBlLmRpRGVwcykge1xuICAgIGlmIChkZXBlbmRlbmN5LnRva2VuKSB7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKGRlcGVuZGVuY3kudG9rZW4pO1xuICAgICAgbGV0IHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgPSBkZXBlbmRlbmN5LmlzQXR0cmlidXRlID9cbiAgICAgICAgICBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlIDpcbiAgICAgICAgICBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVG9rZW47XG5cbiAgICAgIC8vIEluIHRoZSBjYXNlIG9mIG1vc3QgZGVwZW5kZW5jaWVzLCB0aGUgdG9rZW4gd2lsbCBiZSBhIHJlZmVyZW5jZSB0byBhIHR5cGUuIFNvbWV0aW1lcyxcbiAgICAgIC8vIGhvd2V2ZXIsIGl0IGNhbiBiZSBhIHN0cmluZywgaW4gdGhlIGNhc2Ugb2Ygb2xkZXIgQW5ndWxhciBjb2RlIG9yIEBBdHRyaWJ1dGUgaW5qZWN0aW9uLlxuICAgICAgY29uc3QgdG9rZW4gPVxuICAgICAgICAgIHRva2VuUmVmIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sID8gb3V0cHV0Q3R4LmltcG9ydEV4cHIodG9rZW5SZWYpIDogby5saXRlcmFsKHRva2VuUmVmKTtcblxuICAgICAgLy8gQ29uc3RydWN0IHRoZSBkZXBlbmRlbmN5LlxuICAgICAgZGVwcy5wdXNoKHtcbiAgICAgICAgdG9rZW4sXG4gICAgICAgIHJlc29sdmVkLFxuICAgICAgICBob3N0OiAhIWRlcGVuZGVuY3kuaXNIb3N0LFxuICAgICAgICBvcHRpb25hbDogISFkZXBlbmRlbmN5LmlzT3B0aW9uYWwsXG4gICAgICAgIHNlbGY6ICEhZGVwZW5kZW5jeS5pc1NlbGYsXG4gICAgICAgIHNraXBTZWxmOiAhIWRlcGVuZGVuY3kuaXNTa2lwU2VsZixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB1bnN1cHBvcnRlZCgnZGVwZW5kZW5jeSB3aXRob3V0IGEgdG9rZW4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVwcztcbn1cblxuZnVuY3Rpb24gaXNEZWxlZ2F0ZWRNZXRhZGF0YShtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IG1ldGEgaXMgUjNEZWxlZ2F0ZWRGYWN0b3J5TWV0YWRhdGF8XG4gICAgUjNEZWxlZ2F0ZWRGbk9yQ2xhc3NNZXRhZGF0YSB7XG4gIHJldHVybiAobWV0YSBhcyBhbnkpLmRlbGVnYXRlVHlwZSAhPT0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGEobWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBtZXRhIGlzIFIzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YSB7XG4gIHJldHVybiAobWV0YSBhcyBhbnkpLmV4cHJlc3Npb24gIT09IHVuZGVmaW5lZDtcbn1cbiJdfQ==