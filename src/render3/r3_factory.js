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
        define("@angular/compiler/src/render3/r3_factory", ["require", "exports", "tslib", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/util"], factory);
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
    var util_1 = require("@angular/compiler/src/render3/util");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    var R3FactoryDelegateType;
    (function (R3FactoryDelegateType) {
        R3FactoryDelegateType[R3FactoryDelegateType["Class"] = 0] = "Class";
        R3FactoryDelegateType[R3FactoryDelegateType["Function"] = 1] = "Function";
        R3FactoryDelegateType[R3FactoryDelegateType["Factory"] = 2] = "Factory";
    })(R3FactoryDelegateType = exports.R3FactoryDelegateType || (exports.R3FactoryDelegateType = {}));
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
         * Injecting the `ChangeDetectorRef` token. Needs special handling when injected into a pipe.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["ChangeDetectorRef"] = 2] = "ChangeDetectorRef";
    })(R3ResolvedDependencyType = exports.R3ResolvedDependencyType || (exports.R3ResolvedDependencyType = {}));
    /**
     * Construct a factory function expression for the given `R3FactoryMetadata`.
     */
    function compileFactoryFunction(meta, isPipe) {
        if (isPipe === void 0) { isPipe = false; }
        var t = o.variable('t');
        var statements = [];
        // The type to instantiate via constructor invocation. If there is no delegated factory, meaning
        // this type is always created by constructor invocation, then this is the type-to-create
        // parameter provided by the user (t) if specified, or the current type if not. If there is a
        // delegated factory (which is used to create the current type) then this is only the type-to-
        // create parameter (t).
        var typeForCtor = !isDelegatedMetadata(meta) ? new o.BinaryOperatorExpr(o.BinaryOperator.Or, t, meta.type) : t;
        var ctorExpr = null;
        if (meta.deps !== null) {
            // There is a constructor (either explicitly or implicitly defined).
            if (meta.deps !== 'invalid') {
                ctorExpr =
                    new o.InstantiateExpr(typeForCtor, injectDependencies(meta.deps, meta.injectFn, isPipe));
            }
        }
        else {
            var baseFactory = o.variable("\u0275" + meta.name + "_BaseFactory");
            var getInheritedFactory = o.importExpr(r3_identifiers_1.Identifiers.getInheritedFactory);
            var baseFactoryStmt = baseFactory.set(getInheritedFactory.callFn([meta.type])).toDeclStmt(o.INFERRED_TYPE, [
                o.StmtModifier.Exported, o.StmtModifier.Final
            ]);
            statements.push(baseFactoryStmt);
            // There is no constructor, use the base class' factory to construct typeForCtor.
            ctorExpr = baseFactory.callFn([typeForCtor]);
        }
        var ctorExprFinal = ctorExpr;
        var body = [];
        var retExpr = null;
        function makeConditionalFactory(nonCtorExpr) {
            var r = o.variable('r');
            body.push(r.set(o.NULL_EXPR).toDeclStmt());
            var ctorStmt = null;
            if (ctorExprFinal !== null) {
                ctorStmt = r.set(ctorExprFinal).toStmt();
            }
            else {
                ctorStmt = makeErrorStmt(meta.name);
            }
            body.push(o.ifStmt(t, [ctorStmt], [r.set(nonCtorExpr).toStmt()]));
            return r;
        }
        if (isDelegatedMetadata(meta) && meta.delegateType === R3FactoryDelegateType.Factory) {
            var delegateFactory = o.variable("\u0275" + meta.name + "_BaseFactory");
            var getFactoryOf = o.importExpr(r3_identifiers_1.Identifiers.getFactoryOf);
            if (meta.delegate.isEquivalent(meta.type)) {
                throw new Error("Illegal state: compiling factory that delegates to itself");
            }
            var delegateFactoryStmt = delegateFactory.set(getFactoryOf.callFn([meta.delegate])).toDeclStmt(o.INFERRED_TYPE, [
                o.StmtModifier.Exported, o.StmtModifier.Final
            ]);
            statements.push(delegateFactoryStmt);
            retExpr = makeConditionalFactory(delegateFactory.callFn([]));
        }
        else if (isDelegatedMetadata(meta)) {
            // This type is created with a delegated factory. If a type parameter is not specified, call
            // the factory instead.
            var delegateArgs = injectDependencies(meta.delegateDeps, meta.injectFn, isPipe);
            // Either call `new delegate(...)` or `delegate(...)` depending on meta.useNewForDelegate.
            var factoryExpr = new (meta.delegateType === R3FactoryDelegateType.Class ?
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
        if (retExpr !== null) {
            body.push(new o.ReturnStatement(retExpr));
        }
        else {
            body.push(makeErrorStmt(meta.name));
        }
        return {
            factory: o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], body, o.INFERRED_TYPE, undefined, meta.name + "_Factory"),
            statements: statements,
            type: o.expressionType(o.importExpr(r3_identifiers_1.Identifiers.FactoryDef, [util_1.typeWithParameters(meta.type, meta.typeArgumentCount)]))
        };
    }
    exports.compileFactoryFunction = compileFactoryFunction;
    /**
     * Constructs the factory def (`ɵfac`) from directive/component/pipe metadata.
     */
    function compileFactoryFromMetadata(meta) {
        return compileFactoryFunction({
            name: meta.name,
            type: meta.type,
            deps: meta.deps,
            typeArgumentCount: meta.typeArgumentCount,
            injectFn: meta.injectFn,
        }, meta.isPipe);
    }
    exports.compileFactoryFromMetadata = compileFactoryFromMetadata;
    function injectDependencies(deps, injectFn, isPipe) {
        return deps.map(function (dep) { return compileInjectDependency(dep, injectFn, isPipe); });
    }
    function compileInjectDependency(dep, injectFn, isPipe) {
        // Interpret the dependency according to its resolved type.
        switch (dep.resolved) {
            case R3ResolvedDependencyType.Token:
            case R3ResolvedDependencyType.ChangeDetectorRef:
                // Build up the injection flags according to the metadata.
                var flags = 0 /* Default */ | (dep.self ? 2 /* Self */ : 0) |
                    (dep.skipSelf ? 4 /* SkipSelf */ : 0) | (dep.host ? 1 /* Host */ : 0) |
                    (dep.optional ? 8 /* Optional */ : 0);
                // If this dependency is optional or otherwise has non-default flags, then additional
                // parameters describing how to inject the dependency must be passed to the inject function
                // that's being used.
                var flagsParam = (flags !== 0 /* Default */ || dep.optional) ? o.literal(flags) : null;
                // We have a separate instruction for injecting ChangeDetectorRef into a pipe.
                if (isPipe && dep.resolved === R3ResolvedDependencyType.ChangeDetectorRef) {
                    return o.importExpr(r3_identifiers_1.Identifiers.injectPipeChangeDetectorRef).callFn(flagsParam ? [flagsParam] : []);
                }
                // Build up the arguments to the injectFn call.
                var injectArgs = [dep.token];
                if (flagsParam) {
                    injectArgs.push(flagsParam);
                }
                return o.importExpr(injectFn).callFn(injectArgs);
            case R3ResolvedDependencyType.Attribute:
                // In the case of attributes, the attribute name in question is given as the token.
                return o.importExpr(r3_identifiers_1.Identifiers.injectAttribute).callFn([dep.token]);
            default:
                return util_2.unsupported("Unknown R3ResolvedDependencyType: " + R3ResolvedDependencyType[dep.resolved]);
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
        var injectorRef = reflector.resolveExternalReference(identifiers_1.Identifiers.Injector);
        // Iterate through the type's DI dependencies and produce `R3DependencyMetadata` for each of them.
        var deps = [];
        try {
            for (var _b = tslib_1.__values(type.diDeps), _c = _b.next(); !_c.done; _c = _b.next()) {
                var dependency = _c.value;
                if (dependency.token) {
                    var tokenRef = compile_metadata_1.tokenReference(dependency.token);
                    var resolved = dependency.isAttribute ?
                        R3ResolvedDependencyType.Attribute :
                        R3ResolvedDependencyType.Token;
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
                    util_2.unsupported('dependency without a token');
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
    function makeErrorStmt(name) {
        return new o.ThrowStmt(new o.InstantiateExpr(new o.ReadVarExpr('Error'), [
            o.literal(name + " has a constructor which is not compatible with Dependency Injection. It should probably not be @Injectable().")
        ]));
    }
    function isDelegatedMetadata(meta) {
        return meta.delegateType !== undefined;
    }
    function isExpressionFactoryMetadata(meta) {
        return meta.expression !== undefined;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgseUVBQWtEO0lBQ2xELDJFQUF3RTtJQUd4RSxpRUFBMkM7SUFDM0MsMkRBQTBDO0lBQzFDLCtFQUE0RDtJQUc1RCwyREFBMEM7SUFDMUMsZ0VBQXdDO0lBMEN4QyxJQUFZLHFCQUlYO0lBSkQsV0FBWSxxQkFBcUI7UUFDL0IsbUVBQUssQ0FBQTtRQUNMLHlFQUFRLENBQUE7UUFDUix1RUFBTyxDQUFBO0lBQ1QsQ0FBQyxFQUpXLHFCQUFxQixHQUFyQiw2QkFBcUIsS0FBckIsNkJBQXFCLFFBSWhDO0lBNkJEOzs7Ozs7O09BT0c7SUFDSCxJQUFZLHdCQWlCWDtJQWpCRCxXQUFZLHdCQUF3QjtRQUNsQzs7V0FFRztRQUNILHlFQUFTLENBQUE7UUFFVDs7OztXQUlHO1FBQ0gsaUZBQWEsQ0FBQTtRQUViOztXQUVHO1FBQ0gsaUdBQXFCLENBQUE7SUFDdkIsQ0FBQyxFQWpCVyx3QkFBd0IsR0FBeEIsZ0NBQXdCLEtBQXhCLGdDQUF3QixRQWlCbkM7SUE0Q0Q7O09BRUc7SUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxJQUF1QixFQUFFLE1BQWM7UUFBZCx1QkFBQSxFQUFBLGNBQWM7UUFDNUUsSUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxQixJQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO1FBRXJDLGdHQUFnRztRQUNoRyx5RkFBeUY7UUFDekYsNkZBQTZGO1FBQzdGLDhGQUE4RjtRQUM5Rix3QkFBd0I7UUFDeEIsSUFBTSxXQUFXLEdBQ2IsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFD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QVMsQ0FBQztJQUNsRCxDQUFDO0lBRUQsU0FBUywyQkFBMkIsQ0FBQyxJQUF1QjtRQUMxRCxPQUFRLElBQVksQ0FBQyxVQUFVLEtBQUssU0FBUyxDQUFDO0lBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVUeXBlTWV0YWRhdGEsIHRva2VuUmVmZXJlbmNlfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtJbmplY3RGbGFnc30gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHt0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge3Vuc3VwcG9ydGVkfSBmcm9tICcuL3ZpZXcvdXRpbCc7XG5cblxuXG4vKipcbiAqIE1ldGFkYXRhIHJlcXVpcmVkIGJ5IHRoZSBmYWN0b3J5IGdlbmVyYXRvciB0byBnZW5lcmF0ZSBhIGBmYWN0b3J5YCBmdW5jdGlvbiBmb3IgYSB0eXBlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEge1xuICAvKipcbiAgICogU3RyaW5nIG5hbWUgb2YgdGhlIHR5cGUgYmVpbmcgZ2VuZXJhdGVkICh1c2VkIHRvIG5hbWUgdGhlIGZhY3RvcnkgZnVuY3Rpb24pLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgZnVuY3Rpb24gKG9yIGNvbnN0cnVjdG9yKSB3aGljaCB3aWxsIGluc3RhbnRpYXRlIHRoZSByZXF1ZXN0ZWRcbiAgICogdHlwZS5cbiAgICpcbiAgICogVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbnN0cnVjdG9yIHR5cGUsIG9yIHRvIGEgdXNlci1kZWZpbmVkIGZhY3RvcnkgZnVuY3Rpb24uIFRoZVxuICAgKiBgdXNlTmV3YCBwcm9wZXJ0eSBkZXRlcm1pbmVzIHdoZXRoZXIgaXQgd2lsbCBiZSBjYWxsZWQgYXMgYSBjb25zdHJ1Y3RvciBvciBub3QuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqIE51bWJlciBvZiBhcmd1bWVudHMgZm9yIHRoZSBgdHlwZWAuICovXG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFJlZ2FyZGxlc3Mgb2Ygd2hldGhlciBgZm5PckNsYXNzYCBpcyBhIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIG9yIGEgdXNlci1kZWZpbmVkIGZhY3RvcnksIGl0XG4gICAqIG1heSBoYXZlIDAgb3IgbW9yZSBwYXJhbWV0ZXJzLCB3aGljaCB3aWxsIGJlIGluamVjdGVkIGFjY29yZGluZyB0byB0aGUgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYFxuICAgKiBmb3IgdGhvc2UgcGFyYW1ldGVycy4gSWYgdGhpcyBpcyBgbnVsbGAsIHRoZW4gdGhlIHR5cGUncyBjb25zdHJ1Y3RvciBpcyBub25leGlzdGVudCBhbmQgd2lsbFxuICAgKiBiZSBpbmhlcml0ZWQgZnJvbSBgZm5PckNsYXNzYCB3aGljaCBpcyBpbnRlcnByZXRlZCBhcyB0aGUgY3VycmVudCB0eXBlLiBJZiB0aGlzIGlzIGAnaW52YWxpZCdgLFxuICAgKiB0aGVuIG9uZSBvciBtb3JlIG9mIHRoZSBwYXJhbWV0ZXJzIHdhc24ndCByZXNvbHZhYmxlIGFuZCBhbnkgYXR0ZW1wdCB0byB1c2UgdGhlc2UgZGVwcyB3aWxsXG4gICAqIHJlc3VsdCBpbiBhIHJ1bnRpbWUgZXJyb3IuXG4gICAqL1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfCdpbnZhbGlkJ3xudWxsO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIGZvciB0aGUgZnVuY3Rpb24gd2hpY2ggd2lsbCBiZSB1c2VkIHRvIGluamVjdCBkZXBlbmRlbmNpZXMuIFRoZSBBUEkgb2YgdGhpc1xuICAgKiBmdW5jdGlvbiBjb3VsZCBiZSBkaWZmZXJlbnQsIGFuZCBvdGhlciBvcHRpb25zIGNvbnRyb2wgaG93IGl0IHdpbGwgYmUgaW52b2tlZC5cbiAgICovXG4gIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xufVxuXG5leHBvcnQgZW51bSBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUge1xuICBDbGFzcyxcbiAgRnVuY3Rpb24sXG4gIEZhY3RvcnksXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZWxlZ2F0ZWRGYWN0b3J5TWV0YWRhdGEgZXh0ZW5kcyBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHtcbiAgZGVsZWdhdGU6IG8uRXhwcmVzc2lvbjtcbiAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRmFjdG9yeTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlbGVnYXRlZEZuT3JDbGFzc01ldGFkYXRhIGV4dGVuZHMgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIGRlbGVnYXRlOiBvLkV4cHJlc3Npb247XG4gIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkNsYXNzfFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GdW5jdGlvbjtcbiAgZGVsZWdhdGVEZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YSBleHRlbmRzIFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG59XG5cbmV4cG9ydCB0eXBlIFIzRmFjdG9yeU1ldGFkYXRhID0gUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB8IFIzRGVsZWdhdGVkRmFjdG9yeU1ldGFkYXRhIHxcbiAgICBSM0RlbGVnYXRlZEZuT3JDbGFzc01ldGFkYXRhIHwgUjNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhO1xuXG5leHBvcnQgaW50ZXJmYWNlIFIzRmFjdG9yeURlZk1ldGFkYXRhIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG4gIHR5cGVBcmd1bWVudENvdW50OiBudW1iZXI7XG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118J2ludmFsaWQnfG51bGw7XG4gIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBpc1BpcGU/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFJlc29sdmVkIHR5cGUgb2YgYSBkZXBlbmRlbmN5LlxuICpcbiAqIE9jY2FzaW9uYWxseSwgZGVwZW5kZW5jaWVzIHdpbGwgaGF2ZSBzcGVjaWFsIHNpZ25pZmljYW5jZSB3aGljaCBpcyBrbm93biBzdGF0aWNhbGx5LiBJbiB0aGF0XG4gKiBjYXNlIHRoZSBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBpbmZvcm1zIHRoZSBmYWN0b3J5IGdlbmVyYXRvciB0aGF0IGEgcGFydGljdWxhciBkZXBlbmRlbmN5XG4gKiBzaG91bGQgYmUgZ2VuZXJhdGVkIHNwZWNpYWxseSAodXN1YWxseSBieSBjYWxsaW5nIGEgc3BlY2lhbCBpbmplY3Rpb24gZnVuY3Rpb24gaW5zdGVhZCBvZiB0aGVcbiAqIHN0YW5kYXJkIG9uZSkuXG4gKi9cbmV4cG9ydCBlbnVtIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSB7XG4gIC8qKlxuICAgKiBBIG5vcm1hbCB0b2tlbiBkZXBlbmRlbmN5LlxuICAgKi9cbiAgVG9rZW4gPSAwLFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYW4gYXR0cmlidXRlLlxuICAgKlxuICAgKiBUaGUgdG9rZW4gZXhwcmVzc2lvbiBpcyBhIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSBuYW1lLlxuICAgKi9cbiAgQXR0cmlidXRlID0gMSxcblxuICAvKipcbiAgICogSW5qZWN0aW5nIHRoZSBgQ2hhbmdlRGV0ZWN0b3JSZWZgIHRva2VuLiBOZWVkcyBzcGVjaWFsIGhhbmRsaW5nIHdoZW4gaW5qZWN0ZWQgaW50byBhIHBpcGUuXG4gICAqL1xuICBDaGFuZ2VEZXRlY3RvclJlZiA9IDIsXG59XG5cbi8qKlxuICogTWV0YWRhdGEgcmVwcmVzZW50aW5nIGEgc2luZ2xlIGRlcGVuZGVuY3kgdG8gYmUgaW5qZWN0ZWQgaW50byBhIGNvbnN0cnVjdG9yIG9yIGZ1bmN0aW9uIGNhbGwuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHRva2VuIG9yIHZhbHVlIHRvIGJlIGluamVjdGVkLlxuICAgKi9cbiAgdG9rZW46IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQW4gZW51bSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBkZXBlbmRlbmN5IGhhcyBzcGVjaWFsIG1lYW5pbmcgdG8gQW5ndWxhciBhbmQgbmVlZHMgdG8gYmVcbiAgICogaW5qZWN0ZWQgc3BlY2lhbGx5LlxuICAgKi9cbiAgcmVzb2x2ZWQ6IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQEhvc3QgcXVhbGlmaWVyLlxuICAgKi9cbiAgaG9zdDogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQE9wdGlvbmFsIHF1YWxpZmllci5cbiAgICovXG4gIG9wdGlvbmFsOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2VsZiBxdWFsaWZpZXIuXG4gICAqL1xuICBzZWxmOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2tpcFNlbGYgcXVhbGlmaWVyLlxuICAgKi9cbiAgc2tpcFNlbGY6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5Rm4ge1xuICBmYWN0b3J5OiBvLkV4cHJlc3Npb247XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG4gIHR5cGU6IG8uRXhwcmVzc2lvblR5cGU7XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGEgZmFjdG9yeSBmdW5jdGlvbiBleHByZXNzaW9uIGZvciB0aGUgZ2l2ZW4gYFIzRmFjdG9yeU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24obWV0YTogUjNGYWN0b3J5TWV0YWRhdGEsIGlzUGlwZSA9IGZhbHNlKTogUjNGYWN0b3J5Rm4ge1xuICBjb25zdCB0ID0gby52YXJpYWJsZSgndCcpO1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgLy8gVGhlIHR5cGUgdG8gaW5zdGFudGlhdGUgdmlhIGNvbnN0cnVjdG9yIGludm9jYXRpb24uIElmIHRoZXJlIGlzIG5vIGRlbGVnYXRlZCBmYWN0b3J5LCBtZWFuaW5nXG4gIC8vIHRoaXMgdHlwZSBpcyBhbHdheXMgY3JlYXRlZCBieSBjb25zdHJ1Y3RvciBpbnZvY2F0aW9uLCB0aGVuIHRoaXMgaXMgdGhlIHR5cGUtdG8tY3JlYXRlXG4gIC8vIHBhcmFtZXRlciBwcm92aWRlZCBieSB0aGUgdXNlciAodCkgaWYgc3BlY2lmaWVkLCBvciB0aGUgY3VycmVudCB0eXBlIGlmIG5vdC4gSWYgdGhlcmUgaXMgYVxuICAvLyBkZWxlZ2F0ZWQgZmFjdG9yeSAod2hpY2ggaXMgdXNlZCB0byBjcmVhdGUgdGhlIGN1cnJlbnQgdHlwZSkgdGhlbiB0aGlzIGlzIG9ubHkgdGhlIHR5cGUtdG8tXG4gIC8vIGNyZWF0ZSBwYXJhbWV0ZXIgKHQpLlxuICBjb25zdCB0eXBlRm9yQ3RvciA9XG4gICAgICAhaXNEZWxlZ2F0ZWRNZXRhZGF0YShtZXRhKSA/IG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihvLkJpbmFyeU9wZXJhdG9yLk9yLCB0LCBtZXRhLnR5cGUpIDogdDtcblxuICBsZXQgY3RvckV4cHI6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgaWYgKG1ldGEuZGVwcyAhPT0gbnVsbCkge1xuICAgIC8vIFRoZXJlIGlzIGEgY29uc3RydWN0b3IgKGVpdGhlciBleHBsaWNpdGx5IG9yIGltcGxpY2l0bHkgZGVmaW5lZCkuXG4gICAgaWYgKG1ldGEuZGVwcyAhPT0gJ2ludmFsaWQnKSB7XG4gICAgICBjdG9yRXhwciA9XG4gICAgICAgICAgbmV3IG8uSW5zdGFudGlhdGVFeHByKHR5cGVGb3JDdG9yLCBpbmplY3REZXBlbmRlbmNpZXMobWV0YS5kZXBzLCBtZXRhLmluamVjdEZuLCBpc1BpcGUpKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYmFzZUZhY3RvcnkgPSBvLnZhcmlhYmxlKGDJtSR7bWV0YS5uYW1lfV9CYXNlRmFjdG9yeWApO1xuICAgIGNvbnN0IGdldEluaGVyaXRlZEZhY3RvcnkgPSBvLmltcG9ydEV4cHIoUjMuZ2V0SW5oZXJpdGVkRmFjdG9yeSk7XG4gICAgY29uc3QgYmFzZUZhY3RvcnlTdG10ID1cbiAgICAgICAgYmFzZUZhY3Rvcnkuc2V0KGdldEluaGVyaXRlZEZhY3RvcnkuY2FsbEZuKFttZXRhLnR5cGVdKSkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICBvLlN0bXRNb2RpZmllci5FeHBvcnRlZCwgby5TdG10TW9kaWZpZXIuRmluYWxcbiAgICAgICAgXSk7XG4gICAgc3RhdGVtZW50cy5wdXNoKGJhc2VGYWN0b3J5U3RtdCk7XG5cbiAgICAvLyBUaGVyZSBpcyBubyBjb25zdHJ1Y3RvciwgdXNlIHRoZSBiYXNlIGNsYXNzJyBmYWN0b3J5IHRvIGNvbnN0cnVjdCB0eXBlRm9yQ3Rvci5cbiAgICBjdG9yRXhwciA9IGJhc2VGYWN0b3J5LmNhbGxGbihbdHlwZUZvckN0b3JdKTtcbiAgfVxuICBjb25zdCBjdG9yRXhwckZpbmFsID0gY3RvckV4cHI7XG5cbiAgY29uc3QgYm9keTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBsZXQgcmV0RXhwcjogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gIGZ1bmN0aW9uIG1ha2VDb25kaXRpb25hbEZhY3Rvcnkobm9uQ3RvckV4cHI6IG8uRXhwcmVzc2lvbik6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IHIgPSBvLnZhcmlhYmxlKCdyJyk7XG4gICAgYm9keS5wdXNoKHIuc2V0KG8uTlVMTF9FWFBSKS50b0RlY2xTdG10KCkpO1xuICAgIGxldCBjdG9yU3RtdDogby5TdGF0ZW1lbnR8bnVsbCA9IG51bGw7XG4gICAgaWYgKGN0b3JFeHByRmluYWwgIT09IG51bGwpIHtcbiAgICAgIGN0b3JTdG10ID0gci5zZXQoY3RvckV4cHJGaW5hbCkudG9TdG10KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0b3JTdG10ID0gbWFrZUVycm9yU3RtdChtZXRhLm5hbWUpO1xuICAgIH1cbiAgICBib2R5LnB1c2goby5pZlN0bXQodCwgW2N0b3JTdG10XSwgW3Iuc2V0KG5vbkN0b3JFeHByKS50b1N0bXQoKV0pKTtcbiAgICByZXR1cm4gcjtcbiAgfVxuXG4gIGlmIChpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGEpICYmIG1ldGEuZGVsZWdhdGVUeXBlID09PSBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRmFjdG9yeSkge1xuICAgIGNvbnN0IGRlbGVnYXRlRmFjdG9yeSA9IG8udmFyaWFibGUoYMm1JHttZXRhLm5hbWV9X0Jhc2VGYWN0b3J5YCk7XG4gICAgY29uc3QgZ2V0RmFjdG9yeU9mID0gby5pbXBvcnRFeHByKFIzLmdldEZhY3RvcnlPZik7XG4gICAgaWYgKG1ldGEuZGVsZWdhdGUuaXNFcXVpdmFsZW50KG1ldGEudHlwZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBzdGF0ZTogY29tcGlsaW5nIGZhY3RvcnkgdGhhdCBkZWxlZ2F0ZXMgdG8gaXRzZWxmYCk7XG4gICAgfVxuICAgIGNvbnN0IGRlbGVnYXRlRmFjdG9yeVN0bXQgPVxuICAgICAgICBkZWxlZ2F0ZUZhY3Rvcnkuc2V0KGdldEZhY3RvcnlPZi5jYWxsRm4oW21ldGEuZGVsZWdhdGVdKSkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICBvLlN0bXRNb2RpZmllci5FeHBvcnRlZCwgby5TdG10TW9kaWZpZXIuRmluYWxcbiAgICAgICAgXSk7XG5cbiAgICBzdGF0ZW1lbnRzLnB1c2goZGVsZWdhdGVGYWN0b3J5U3RtdCk7XG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkoZGVsZWdhdGVGYWN0b3J5LmNhbGxGbihbXSkpO1xuICB9IGVsc2UgaWYgKGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YSkpIHtcbiAgICAvLyBUaGlzIHR5cGUgaXMgY3JlYXRlZCB3aXRoIGEgZGVsZWdhdGVkIGZhY3RvcnkuIElmIGEgdHlwZSBwYXJhbWV0ZXIgaXMgbm90IHNwZWNpZmllZCwgY2FsbFxuICAgIC8vIHRoZSBmYWN0b3J5IGluc3RlYWQuXG4gICAgY29uc3QgZGVsZWdhdGVBcmdzID0gaW5qZWN0RGVwZW5kZW5jaWVzKG1ldGEuZGVsZWdhdGVEZXBzLCBtZXRhLmluamVjdEZuLCBpc1BpcGUpO1xuICAgIC8vIEVpdGhlciBjYWxsIGBuZXcgZGVsZWdhdGUoLi4uKWAgb3IgYGRlbGVnYXRlKC4uLilgIGRlcGVuZGluZyBvbiBtZXRhLnVzZU5ld0ZvckRlbGVnYXRlLlxuICAgIGNvbnN0IGZhY3RvcnlFeHByID0gbmV3IChcbiAgICAgICAgbWV0YS5kZWxlZ2F0ZVR5cGUgPT09IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5DbGFzcyA/XG4gICAgICAgICAgICBvLkluc3RhbnRpYXRlRXhwciA6XG4gICAgICAgICAgICBvLkludm9rZUZ1bmN0aW9uRXhwcikobWV0YS5kZWxlZ2F0ZSwgZGVsZWdhdGVBcmdzKTtcbiAgICByZXRFeHByID0gbWFrZUNvbmRpdGlvbmFsRmFjdG9yeShmYWN0b3J5RXhwcik7XG4gIH0gZWxzZSBpZiAoaXNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhKG1ldGEpKSB7XG4gICAgLy8gVE9ETyhhbHhodWIpOiBkZWNpZGUgd2hldGhlciB0byBsb3dlciB0aGUgdmFsdWUgaGVyZSBvciBpbiB0aGUgY2FsbGVyXG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkobWV0YS5leHByZXNzaW9uKTtcbiAgfSBlbHNlIHtcbiAgICByZXRFeHByID0gY3RvckV4cHI7XG4gIH1cblxuICBpZiAocmV0RXhwciAhPT0gbnVsbCkge1xuICAgIGJvZHkucHVzaChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0RXhwcikpO1xuICB9IGVsc2Uge1xuICAgIGJvZHkucHVzaChtYWtlRXJyb3JTdG10KG1ldGEubmFtZSkpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBmYWN0b3J5OiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbSgndCcsIG8uRFlOQU1JQ19UWVBFKV0sIGJvZHksIG8uSU5GRVJSRURfVFlQRSwgdW5kZWZpbmVkLFxuICAgICAgICBgJHttZXRhLm5hbWV9X0ZhY3RvcnlgKSxcbiAgICBzdGF0ZW1lbnRzLFxuICAgIHR5cGU6IG8uZXhwcmVzc2lvblR5cGUoXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5GYWN0b3J5RGVmLCBbdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCldKSlcbiAgfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIHRoZSBmYWN0b3J5IGRlZiAoYMm1ZmFjYCkgZnJvbSBkaXJlY3RpdmUvY29tcG9uZW50L3BpcGUgbWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRmFjdG9yeUZyb21NZXRhZGF0YShtZXRhOiBSM0ZhY3RvcnlEZWZNZXRhZGF0YSk6IFIzRmFjdG9yeUZuIHtcbiAgcmV0dXJuIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oXG4gICAgICB7XG4gICAgICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICAgICAgdHlwZTogbWV0YS50eXBlLFxuICAgICAgICBkZXBzOiBtZXRhLmRlcHMsXG4gICAgICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgICBpbmplY3RGbjogbWV0YS5pbmplY3RGbixcbiAgICAgIH0sXG4gICAgICBtZXRhLmlzUGlwZSk7XG59XG5cbmZ1bmN0aW9uIGluamVjdERlcGVuZGVuY2llcyhcbiAgICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdLCBpbmplY3RGbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNQaXBlOiBib29sZWFuKTogby5FeHByZXNzaW9uW10ge1xuICByZXR1cm4gZGVwcy5tYXAoZGVwID0+IGNvbXBpbGVJbmplY3REZXBlbmRlbmN5KGRlcCwgaW5qZWN0Rm4sIGlzUGlwZSkpO1xufVxuXG5mdW5jdGlvbiBjb21waWxlSW5qZWN0RGVwZW5kZW5jeShcbiAgICBkZXA6IFIzRGVwZW5kZW5jeU1ldGFkYXRhLCBpbmplY3RGbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNQaXBlOiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgLy8gSW50ZXJwcmV0IHRoZSBkZXBlbmRlbmN5IGFjY29yZGluZyB0byBpdHMgcmVzb2x2ZWQgdHlwZS5cbiAgc3dpdGNoIChkZXAucmVzb2x2ZWQpIHtcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5Ub2tlbjpcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5DaGFuZ2VEZXRlY3RvclJlZjpcbiAgICAgIC8vIEJ1aWxkIHVwIHRoZSBpbmplY3Rpb24gZmxhZ3MgYWNjb3JkaW5nIHRvIHRoZSBtZXRhZGF0YS5cbiAgICAgIGNvbnN0IGZsYWdzID0gSW5qZWN0RmxhZ3MuRGVmYXVsdCB8IChkZXAuc2VsZiA/IEluamVjdEZsYWdzLlNlbGYgOiAwKSB8XG4gICAgICAgICAgKGRlcC5za2lwU2VsZiA/IEluamVjdEZsYWdzLlNraXBTZWxmIDogMCkgfCAoZGVwLmhvc3QgPyBJbmplY3RGbGFncy5Ib3N0IDogMCkgfFxuICAgICAgICAgIChkZXAub3B0aW9uYWwgPyBJbmplY3RGbGFncy5PcHRpb25hbCA6IDApO1xuXG4gICAgICAvLyBJZiB0aGlzIGRlcGVuZGVuY3kgaXMgb3B0aW9uYWwgb3Igb3RoZXJ3aXNlIGhhcyBub24tZGVmYXVsdCBmbGFncywgdGhlbiBhZGRpdGlvbmFsXG4gICAgICAvLyBwYXJhbWV0ZXJzIGRlc2NyaWJpbmcgaG93IHRvIGluamVjdCB0aGUgZGVwZW5kZW5jeSBtdXN0IGJlIHBhc3NlZCB0byB0aGUgaW5qZWN0IGZ1bmN0aW9uXG4gICAgICAvLyB0aGF0J3MgYmVpbmcgdXNlZC5cbiAgICAgIGxldCBmbGFnc1BhcmFtOiBvLkxpdGVyYWxFeHByfG51bGwgPVxuICAgICAgICAgIChmbGFncyAhPT0gSW5qZWN0RmxhZ3MuRGVmYXVsdCB8fCBkZXAub3B0aW9uYWwpID8gby5saXRlcmFsKGZsYWdzKSA6IG51bGw7XG5cbiAgICAgIC8vIFdlIGhhdmUgYSBzZXBhcmF0ZSBpbnN0cnVjdGlvbiBmb3IgaW5qZWN0aW5nIENoYW5nZURldGVjdG9yUmVmIGludG8gYSBwaXBlLlxuICAgICAgaWYgKGlzUGlwZSAmJiBkZXAucmVzb2x2ZWQgPT09IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5DaGFuZ2VEZXRlY3RvclJlZikge1xuICAgICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdFBpcGVDaGFuZ2VEZXRlY3RvclJlZikuY2FsbEZuKGZsYWdzUGFyYW0gPyBbZmxhZ3NQYXJhbV0gOiBbXSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEJ1aWxkIHVwIHRoZSBhcmd1bWVudHMgdG8gdGhlIGluamVjdEZuIGNhbGwuXG4gICAgICBjb25zdCBpbmplY3RBcmdzID0gW2RlcC50b2tlbl07XG4gICAgICBpZiAoZmxhZ3NQYXJhbSkge1xuICAgICAgICBpbmplY3RBcmdzLnB1c2goZmxhZ3NQYXJhbSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKGluamVjdEZuKS5jYWxsRm4oaW5qZWN0QXJncyk7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlOlxuICAgICAgLy8gSW4gdGhlIGNhc2Ugb2YgYXR0cmlidXRlcywgdGhlIGF0dHJpYnV0ZSBuYW1lIGluIHF1ZXN0aW9uIGlzIGdpdmVuIGFzIHRoZSB0b2tlbi5cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0QXR0cmlidXRlKS5jYWxsRm4oW2RlcC50b2tlbl0pO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5zdXBwb3J0ZWQoXG4gICAgICAgICAgYFVua25vd24gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlOiAke1IzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZVtkZXAucmVzb2x2ZWRdfWApO1xuICB9XG59XG5cbi8qKlxuICogQSBoZWxwZXIgZnVuY3Rpb24gdXNlZnVsIGZvciBleHRyYWN0aW5nIGBSM0RlcGVuZGVuY3lNZXRhZGF0YWAgZnJvbSBhIFJlbmRlcjJcbiAqIGBDb21waWxlVHlwZU1ldGFkYXRhYCBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXSB7XG4gIC8vIFVzZSB0aGUgYENvbXBpbGVSZWZsZWN0b3JgIHRvIGxvb2sgdXAgcmVmZXJlbmNlcyB0byBzb21lIHdlbGwta25vd24gQW5ndWxhciB0eXBlcy4gVGhlc2Ugd2lsbFxuICAvLyBiZSBjb21wYXJlZCB3aXRoIHRoZSB0b2tlbiB0byBzdGF0aWNhbGx5IGRldGVybWluZSB3aGV0aGVyIHRoZSB0b2tlbiBoYXMgc2lnbmlmaWNhbmNlIHRvXG4gIC8vIEFuZ3VsYXIsIGFuZCBzZXQgdGhlIGNvcnJlY3QgYFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZWAgYXMgYSByZXN1bHQuXG4gIGNvbnN0IGluamVjdG9yUmVmID0gcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5JbmplY3Rvcik7XG5cbiAgLy8gSXRlcmF0ZSB0aHJvdWdoIHRoZSB0eXBlJ3MgREkgZGVwZW5kZW5jaWVzIGFuZCBwcm9kdWNlIGBSM0RlcGVuZGVuY3lNZXRhZGF0YWAgZm9yIGVhY2ggb2YgdGhlbS5cbiAgY29uc3QgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IFtdO1xuICBmb3IgKGxldCBkZXBlbmRlbmN5IG9mIHR5cGUuZGlEZXBzKSB7XG4gICAgaWYgKGRlcGVuZGVuY3kudG9rZW4pIHtcbiAgICAgIGNvbnN0IHRva2VuUmVmID0gdG9rZW5SZWZlcmVuY2UoZGVwZW5kZW5jeS50b2tlbik7XG4gICAgICBsZXQgcmVzb2x2ZWQ6IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSA9IGRlcGVuZGVuY3kuaXNBdHRyaWJ1dGUgP1xuICAgICAgICAgIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5BdHRyaWJ1dGUgOlxuICAgICAgICAgIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5Ub2tlbjtcblxuICAgICAgLy8gSW4gdGhlIGNhc2Ugb2YgbW9zdCBkZXBlbmRlbmNpZXMsIHRoZSB0b2tlbiB3aWxsIGJlIGEgcmVmZXJlbmNlIHRvIGEgdHlwZS4gU29tZXRpbWVzLFxuICAgICAgLy8gaG93ZXZlciwgaXQgY2FuIGJlIGEgc3RyaW5nLCBpbiB0aGUgY2FzZSBvZiBvbGRlciBBbmd1bGFyIGNvZGUgb3IgQEF0dHJpYnV0ZSBpbmplY3Rpb24uXG4gICAgICBjb25zdCB0b2tlbiA9XG4gICAgICAgICAgdG9rZW5SZWYgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wgPyBvdXRwdXRDdHguaW1wb3J0RXhwcih0b2tlblJlZikgOiBvLmxpdGVyYWwodG9rZW5SZWYpO1xuXG4gICAgICAvLyBDb25zdHJ1Y3QgdGhlIGRlcGVuZGVuY3kuXG4gICAgICBkZXBzLnB1c2goe1xuICAgICAgICB0b2tlbixcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGhvc3Q6ICEhZGVwZW5kZW5jeS5pc0hvc3QsXG4gICAgICAgIG9wdGlvbmFsOiAhIWRlcGVuZGVuY3kuaXNPcHRpb25hbCxcbiAgICAgICAgc2VsZjogISFkZXBlbmRlbmN5LmlzU2VsZixcbiAgICAgICAgc2tpcFNlbGY6ICEhZGVwZW5kZW5jeS5pc1NraXBTZWxmLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVuc3VwcG9ydGVkKCdkZXBlbmRlbmN5IHdpdGhvdXQgYSB0b2tlbicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZXBzO1xufVxuXG5mdW5jdGlvbiBtYWtlRXJyb3JTdG10KG5hbWU6IHN0cmluZyk6IG8uU3RhdGVtZW50IHtcbiAgcmV0dXJuIG5ldyBvLlRocm93U3RtdChuZXcgby5JbnN0YW50aWF0ZUV4cHIobmV3IG8uUmVhZFZhckV4cHIoJ0Vycm9yJyksIFtcbiAgICBvLmxpdGVyYWwoXG4gICAgICAgIGAke25hbWV9IGhhcyBhIGNvbnN0cnVjdG9yIHdoaWNoIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggRGVwZW5kZW5jeSBJbmplY3Rpb24uIEl0IHNob3VsZCBwcm9iYWJseSBub3QgYmUgQEluamVjdGFibGUoKS5gKVxuICBdKSk7XG59XG5cbmZ1bmN0aW9uIGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBtZXRhIGlzIFIzRGVsZWdhdGVkRmFjdG9yeU1ldGFkYXRhfFxuICAgIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEge1xuICByZXR1cm4gKG1ldGEgYXMgYW55KS5kZWxlZ2F0ZVR5cGUgIT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTogbWV0YSBpcyBSM0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGEge1xuICByZXR1cm4gKG1ldGEgYXMgYW55KS5leHByZXNzaW9uICE9PSB1bmRlZmluZWQ7XG59XG4iXX0=