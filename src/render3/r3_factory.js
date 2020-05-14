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
    exports.dependenciesFromGlobalMetadata = exports.compileFactoryFunction = exports.R3ResolvedDependencyType = exports.R3FactoryTarget = exports.R3FactoryDelegateType = void 0;
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
    var R3FactoryTarget;
    (function (R3FactoryTarget) {
        R3FactoryTarget[R3FactoryTarget["Directive"] = 0] = "Directive";
        R3FactoryTarget[R3FactoryTarget["Component"] = 1] = "Component";
        R3FactoryTarget[R3FactoryTarget["Injectable"] = 2] = "Injectable";
        R3FactoryTarget[R3FactoryTarget["Pipe"] = 3] = "Pipe";
        R3FactoryTarget[R3FactoryTarget["NgModule"] = 4] = "NgModule";
    })(R3FactoryTarget = exports.R3FactoryTarget || (exports.R3FactoryTarget = {}));
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
        /**
         * An invalid dependency (no token could be determined). An error should be thrown at runtime.
         */
        R3ResolvedDependencyType[R3ResolvedDependencyType["Invalid"] = 3] = "Invalid";
    })(R3ResolvedDependencyType = exports.R3ResolvedDependencyType || (exports.R3ResolvedDependencyType = {}));
    /**
     * Construct a factory function expression for the given `R3FactoryMetadata`.
     */
    function compileFactoryFunction(meta) {
        var t = o.variable('t');
        var statements = [];
        var ctorDepsType = o.NONE_TYPE;
        // The type to instantiate via constructor invocation. If there is no delegated factory, meaning
        // this type is always created by constructor invocation, then this is the type-to-create
        // parameter provided by the user (t) if specified, or the current type if not. If there is a
        // delegated factory (which is used to create the current type) then this is only the type-to-
        // create parameter (t).
        var typeForCtor = !isDelegatedMetadata(meta) ?
            new o.BinaryOperatorExpr(o.BinaryOperator.Or, t, meta.internalType) :
            t;
        var ctorExpr = null;
        if (meta.deps !== null) {
            // There is a constructor (either explicitly or implicitly defined).
            if (meta.deps !== 'invalid') {
                ctorExpr = new o.InstantiateExpr(typeForCtor, injectDependencies(meta.deps, meta.injectFn, meta.target === R3FactoryTarget.Pipe));
                ctorDepsType = createCtorDepsType(meta.deps);
            }
        }
        else {
            var baseFactory = o.variable("\u0275" + meta.name + "_BaseFactory");
            var getInheritedFactory = o.importExpr(r3_identifiers_1.Identifiers.getInheritedFactory);
            var baseFactoryStmt = baseFactory.set(getInheritedFactory.callFn([meta.internalType]))
                .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Exported, o.StmtModifier.Final]);
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
                ctorStmt = o.importExpr(r3_identifiers_1.Identifiers.invalidFactory).callFn([]).toStmt();
            }
            body.push(o.ifStmt(t, [ctorStmt], [r.set(nonCtorExpr).toStmt()]));
            return r;
        }
        if (isDelegatedMetadata(meta) && meta.delegateType === R3FactoryDelegateType.Factory) {
            var delegateFactory = o.variable("\u0275" + meta.name + "_BaseFactory");
            var getFactoryOf = o.importExpr(r3_identifiers_1.Identifiers.getFactoryOf);
            if (meta.delegate.isEquivalent(meta.internalType)) {
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
            var delegateArgs = injectDependencies(meta.delegateDeps, meta.injectFn, meta.target === R3FactoryTarget.Pipe);
            // Either call `new delegate(...)` or `delegate(...)` depending on meta.delegateType.
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
            body.push(o.importExpr(r3_identifiers_1.Identifiers.invalidFactory).callFn([]).toStmt());
        }
        return {
            factory: o.fn([new o.FnParam('t', o.DYNAMIC_TYPE)], body, o.INFERRED_TYPE, undefined, meta.name + "_Factory"),
            statements: statements,
            type: o.expressionType(o.importExpr(r3_identifiers_1.Identifiers.FactoryDef, [util_1.typeWithParameters(meta.type.type, meta.typeArgumentCount), ctorDepsType]))
        };
    }
    exports.compileFactoryFunction = compileFactoryFunction;
    function injectDependencies(deps, injectFn, isPipe) {
        return deps.map(function (dep, index) { return compileInjectDependency(dep, injectFn, isPipe, index); });
    }
    function compileInjectDependency(dep, injectFn, isPipe, index) {
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
            case R3ResolvedDependencyType.Invalid:
                return o.importExpr(r3_identifiers_1.Identifiers.invalidFactoryDep).callFn([o.literal(index)]);
            default:
                return util_2.unsupported("Unknown R3ResolvedDependencyType: " + R3ResolvedDependencyType[dep.resolved]);
        }
    }
    function createCtorDepsType(deps) {
        var hasTypes = false;
        var attributeTypes = deps.map(function (dep) {
            var type = createCtorDepType(dep);
            if (type !== null) {
                hasTypes = true;
                return type;
            }
            else {
                return o.literal(null);
            }
        });
        if (hasTypes) {
            return o.expressionType(o.literalArr(attributeTypes));
        }
        else {
            return o.NONE_TYPE;
        }
    }
    function createCtorDepType(dep) {
        var entries = [];
        if (dep.resolved === R3ResolvedDependencyType.Attribute) {
            if (dep.attribute !== null) {
                entries.push({ key: 'attribute', value: dep.attribute, quoted: false });
            }
        }
        if (dep.optional) {
            entries.push({ key: 'optional', value: o.literal(true), quoted: false });
        }
        if (dep.host) {
            entries.push({ key: 'host', value: o.literal(true), quoted: false });
        }
        if (dep.self) {
            entries.push({ key: 'self', value: o.literal(true), quoted: false });
        }
        if (dep.skipSelf) {
            entries.push({ key: 'skipSelf', value: o.literal(true), quoted: false });
        }
        return entries.length > 0 ? o.literalMap(entries) : null;
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
                        attribute: null,
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
    function isDelegatedMetadata(meta) {
        return meta.delegateType !== undefined;
    }
    function isExpressionFactoryMetadata(meta) {
        return meta.expression !== undefined;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILHlFQUFrRDtJQUNsRCwyRUFBd0U7SUFHeEUsaUVBQTJDO0lBQzNDLDJEQUEwQztJQUMxQywrRUFBNEQ7SUFHNUQsMkRBQXVEO0lBQ3ZELGdFQUF3QztJQW9EeEMsSUFBWSxxQkFJWDtJQUpELFdBQVkscUJBQXFCO1FBQy9CLG1FQUFLLENBQUE7UUFDTCx5RUFBUSxDQUFBO1FBQ1IsdUVBQU8sQ0FBQTtJQUNULENBQUMsRUFKVyxxQkFBcUIsR0FBckIsNkJBQXFCLEtBQXJCLDZCQUFxQixRQUloQztJQW9CRCxJQUFZLGVBTVg7SUFORCxXQUFZLGVBQWU7UUFDekIsK0RBQWEsQ0FBQTtRQUNiLCtEQUFhLENBQUE7UUFDYixpRUFBYyxDQUFBO1FBQ2QscURBQVEsQ0FBQTtRQUNSLDZEQUFZLENBQUE7SUFDZCxDQUFDLEVBTlcsZUFBZSxHQUFmLHVCQUFlLEtBQWYsdUJBQWUsUUFNMUI7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsSUFBWSx3QkFzQlg7SUF0QkQsV0FBWSx3QkFBd0I7UUFDbEM7O1dBRUc7UUFDSCx5RUFBUyxDQUFBO1FBRVQ7Ozs7V0FJRztRQUNILGlGQUFhLENBQUE7UUFFYjs7V0FFRztRQUNILGlHQUFxQixDQUFBO1FBRXJCOztXQUVHO1FBQ0gsNkVBQVcsQ0FBQTtJQUNiLENBQUMsRUF0Qlcsd0JBQXdCLEdBQXhCLGdDQUF3QixLQUF4QixnQ0FBd0IsUUFzQm5DO0lBbUREOztPQUVHO0lBQ0gsU0FBZ0Isc0JBQXNCLENBQUMsSUFBdUI7UUFDNUQsSUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxQixJQUFNLFVB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ICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlVHlwZU1ldGFkYXRhLCB0b2tlblJlZmVyZW5jZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7SW5qZWN0RmxhZ3N9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7T3V0cHV0Q29udGV4dH0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNSZWZlcmVuY2UsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7dW5zdXBwb3J0ZWR9IGZyb20gJy4vdmlldy91dGlsJztcblxuXG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRvIGdlbmVyYXRlIGEgYGZhY3RvcnlgIGZ1bmN0aW9uIGZvciBhIHR5cGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBTdHJpbmcgbmFtZSBvZiB0aGUgdHlwZSBiZWluZyBnZW5lcmF0ZWQgKHVzZWQgdG8gbmFtZSB0aGUgZmFjdG9yeSBmdW5jdGlvbikuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBpbnRlcmZhY2UgdHlwZSBiZWluZyBjb25zdHJ1Y3RlZC5cbiAgICovXG4gIHR5cGU6IFIzUmVmZXJlbmNlO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgY29uc3RydWN0b3IgdHlwZSwgaW50ZW5kZWQgZm9yIHVzZSB3aXRoaW4gYSBjbGFzcyBkZWZpbml0aW9uXG4gICAqIGl0c2VsZi5cbiAgICpcbiAgICogVGhpcyBjYW4gZGlmZmVyIGZyb20gdGhlIG91dGVyIGB0eXBlYCBpZiB0aGUgY2xhc3MgaXMgYmVpbmcgY29tcGlsZWQgYnkgbmdjYyBhbmQgaXMgaW5zaWRlXG4gICAqIGFuIElJRkUgc3RydWN0dXJlIHRoYXQgdXNlcyBhIGRpZmZlcmVudCBuYW1lIGludGVybmFsbHkuXG4gICAqL1xuICBpbnRlcm5hbFR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKiogTnVtYmVyIG9mIGFyZ3VtZW50cyBmb3IgdGhlIGB0eXBlYC4gKi9cbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcblxuICAvKipcbiAgICogUmVnYXJkbGVzcyBvZiB3aGV0aGVyIGBmbk9yQ2xhc3NgIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gb3IgYSB1c2VyLWRlZmluZWQgZmFjdG9yeSwgaXRcbiAgICogbWF5IGhhdmUgMCBvciBtb3JlIHBhcmFtZXRlcnMsIHdoaWNoIHdpbGwgYmUgaW5qZWN0ZWQgYWNjb3JkaW5nIHRvIHRoZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgXG4gICAqIGZvciB0aG9zZSBwYXJhbWV0ZXJzLiBJZiB0aGlzIGlzIGBudWxsYCwgdGhlbiB0aGUgdHlwZSdzIGNvbnN0cnVjdG9yIGlzIG5vbmV4aXN0ZW50IGFuZCB3aWxsXG4gICAqIGJlIGluaGVyaXRlZCBmcm9tIGBmbk9yQ2xhc3NgIHdoaWNoIGlzIGludGVycHJldGVkIGFzIHRoZSBjdXJyZW50IHR5cGUuIElmIHRoaXMgaXMgYCdpbnZhbGlkJ2AsXG4gICAqIHRoZW4gb25lIG9yIG1vcmUgb2YgdGhlIHBhcmFtZXRlcnMgd2Fzbid0IHJlc29sdmFibGUgYW5kIGFueSBhdHRlbXB0IHRvIHVzZSB0aGVzZSBkZXBzIHdpbGxcbiAgICogcmVzdWx0IGluIGEgcnVudGltZSBlcnJvci5cbiAgICovXG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118J2ludmFsaWQnfG51bGw7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gZm9yIHRoZSBmdW5jdGlvbiB3aGljaCB3aWxsIGJlIHVzZWQgdG8gaW5qZWN0IGRlcGVuZGVuY2llcy4gVGhlIEFQSSBvZiB0aGlzXG4gICAqIGZ1bmN0aW9uIGNvdWxkIGJlIGRpZmZlcmVudCwgYW5kIG90aGVyIG9wdGlvbnMgY29udHJvbCBob3cgaXQgd2lsbCBiZSBpbnZva2VkLlxuICAgKi9cbiAgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLyoqXG4gICAqIFR5cGUgb2YgdGhlIHRhcmdldCBiZWluZyBjcmVhdGVkIGJ5IHRoZSBmYWN0b3J5LlxuICAgKi9cbiAgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQ7XG59XG5cbmV4cG9ydCBlbnVtIFIzRmFjdG9yeURlbGVnYXRlVHlwZSB7XG4gIENsYXNzLFxuICBGdW5jdGlvbixcbiAgRmFjdG9yeSxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlbGVnYXRlZEZhY3RvcnlNZXRhZGF0YSBleHRlbmRzIFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEge1xuICBkZWxlZ2F0ZTogby5FeHByZXNzaW9uO1xuICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GYWN0b3J5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEgZXh0ZW5kcyBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHtcbiAgZGVsZWdhdGU6IG8uRXhwcmVzc2lvbjtcbiAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3N8UjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uO1xuICBkZWxlZ2F0ZURlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhIGV4dGVuZHMgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IHR5cGUgUjNGYWN0b3J5TWV0YWRhdGEgPSBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhfFIzRGVsZWdhdGVkRmFjdG9yeU1ldGFkYXRhfFxuICAgIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGF8UjNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhO1xuXG5leHBvcnQgZW51bSBSM0ZhY3RvcnlUYXJnZXQge1xuICBEaXJlY3RpdmUgPSAwLFxuICBDb21wb25lbnQgPSAxLFxuICBJbmplY3RhYmxlID0gMixcbiAgUGlwZSA9IDMsXG4gIE5nTW9kdWxlID0gNCxcbn1cblxuLyoqXG4gKiBSZXNvbHZlZCB0eXBlIG9mIGEgZGVwZW5kZW5jeS5cbiAqXG4gKiBPY2Nhc2lvbmFsbHksIGRlcGVuZGVuY2llcyB3aWxsIGhhdmUgc3BlY2lhbCBzaWduaWZpY2FuY2Ugd2hpY2ggaXMga25vd24gc3RhdGljYWxseS4gSW4gdGhhdFxuICogY2FzZSB0aGUgYFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZWAgaW5mb3JtcyB0aGUgZmFjdG9yeSBnZW5lcmF0b3IgdGhhdCBhIHBhcnRpY3VsYXIgZGVwZW5kZW5jeVxuICogc2hvdWxkIGJlIGdlbmVyYXRlZCBzcGVjaWFsbHkgKHVzdWFsbHkgYnkgY2FsbGluZyBhIHNwZWNpYWwgaW5qZWN0aW9uIGZ1bmN0aW9uIGluc3RlYWQgb2YgdGhlXG4gKiBzdGFuZGFyZCBvbmUpLlxuICovXG5leHBvcnQgZW51bSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUge1xuICAvKipcbiAgICogQSBub3JtYWwgdG9rZW4gZGVwZW5kZW5jeS5cbiAgICovXG4gIFRva2VuID0gMCxcblxuICAvKipcbiAgICogVGhlIGRlcGVuZGVuY3kgaXMgZm9yIGFuIGF0dHJpYnV0ZS5cbiAgICpcbiAgICogVGhlIHRva2VuIGV4cHJlc3Npb24gaXMgYSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBhdHRyaWJ1dGUgbmFtZS5cbiAgICovXG4gIEF0dHJpYnV0ZSA9IDEsXG5cbiAgLyoqXG4gICAqIEluamVjdGluZyB0aGUgYENoYW5nZURldGVjdG9yUmVmYCB0b2tlbi4gTmVlZHMgc3BlY2lhbCBoYW5kbGluZyB3aGVuIGluamVjdGVkIGludG8gYSBwaXBlLlxuICAgKi9cbiAgQ2hhbmdlRGV0ZWN0b3JSZWYgPSAyLFxuXG4gIC8qKlxuICAgKiBBbiBpbnZhbGlkIGRlcGVuZGVuY3kgKG5vIHRva2VuIGNvdWxkIGJlIGRldGVybWluZWQpLiBBbiBlcnJvciBzaG91bGQgYmUgdGhyb3duIGF0IHJ1bnRpbWUuXG4gICAqL1xuICBJbnZhbGlkID0gMyxcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSByZXByZXNlbnRpbmcgYSBzaW5nbGUgZGVwZW5kZW5jeSB0byBiZSBpbmplY3RlZCBpbnRvIGEgY29uc3RydWN0b3Igb3IgZnVuY3Rpb24gY2FsbC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgdG9rZW4gb3IgdmFsdWUgdG8gYmUgaW5qZWN0ZWQuXG4gICAqL1xuICB0b2tlbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBJZiBhbiBAQXR0cmlidXRlIGRlY29yYXRvciBpcyBwcmVzZW50LCB0aGlzIGlzIHRoZSBsaXRlcmFsIHR5cGUgb2YgdGhlIGF0dHJpYnV0ZSBuYW1lLCBvclxuICAgKiB0aGUgdW5rbm93biB0eXBlIGlmIG5vIGxpdGVyYWwgdHlwZSBpcyBhdmFpbGFibGUgKGUuZy4gdGhlIGF0dHJpYnV0ZSBuYW1lIGlzIGFuIGV4cHJlc3Npb24pLlxuICAgKiBXaWxsIGJlIG51bGwgb3RoZXJ3aXNlLlxuICAgKi9cbiAgYXR0cmlidXRlOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogQW4gZW51bSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBkZXBlbmRlbmN5IGhhcyBzcGVjaWFsIG1lYW5pbmcgdG8gQW5ndWxhciBhbmQgbmVlZHMgdG8gYmVcbiAgICogaW5qZWN0ZWQgc3BlY2lhbGx5LlxuICAgKi9cbiAgcmVzb2x2ZWQ6IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQEhvc3QgcXVhbGlmaWVyLlxuICAgKi9cbiAgaG9zdDogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQE9wdGlvbmFsIHF1YWxpZmllci5cbiAgICovXG4gIG9wdGlvbmFsOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2VsZiBxdWFsaWZpZXIuXG4gICAqL1xuICBzZWxmOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2tpcFNlbGYgcXVhbGlmaWVyLlxuICAgKi9cbiAgc2tpcFNlbGY6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5Rm4ge1xuICBmYWN0b3J5OiBvLkV4cHJlc3Npb247XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG4gIHR5cGU6IG8uRXhwcmVzc2lvblR5cGU7XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGEgZmFjdG9yeSBmdW5jdGlvbiBleHByZXNzaW9uIGZvciB0aGUgZ2l2ZW4gYFIzRmFjdG9yeU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24obWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBSM0ZhY3RvcnlGbiB7XG4gIGNvbnN0IHQgPSBvLnZhcmlhYmxlKCd0Jyk7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgbGV0IGN0b3JEZXBzVHlwZTogby5UeXBlID0gby5OT05FX1RZUEU7XG5cbiAgLy8gVGhlIHR5cGUgdG8gaW5zdGFudGlhdGUgdmlhIGNvbnN0cnVjdG9yIGludm9jYXRpb24uIElmIHRoZXJlIGlzIG5vIGRlbGVnYXRlZCBmYWN0b3J5LCBtZWFuaW5nXG4gIC8vIHRoaXMgdHlwZSBpcyBhbHdheXMgY3JlYXRlZCBieSBjb25zdHJ1Y3RvciBpbnZvY2F0aW9uLCB0aGVuIHRoaXMgaXMgdGhlIHR5cGUtdG8tY3JlYXRlXG4gIC8vIHBhcmFtZXRlciBwcm92aWRlZCBieSB0aGUgdXNlciAodCkgaWYgc3BlY2lmaWVkLCBvciB0aGUgY3VycmVudCB0eXBlIGlmIG5vdC4gSWYgdGhlcmUgaXMgYVxuICAvLyBkZWxlZ2F0ZWQgZmFjdG9yeSAod2hpY2ggaXMgdXNlZCB0byBjcmVhdGUgdGhlIGN1cnJlbnQgdHlwZSkgdGhlbiB0aGlzIGlzIG9ubHkgdGhlIHR5cGUtdG8tXG4gIC8vIGNyZWF0ZSBwYXJhbWV0ZXIgKHQpLlxuICBjb25zdCB0eXBlRm9yQ3RvciA9ICFpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGEpID9cbiAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihvLkJpbmFyeU9wZXJhdG9yLk9yLCB0LCBtZXRhLmludGVybmFsVHlwZSkgOlxuICAgICAgdDtcblxuICBsZXQgY3RvckV4cHI6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgaWYgKG1ldGEuZGVwcyAhPT0gbnVsbCkge1xuICAgIC8vIFRoZXJlIGlzIGEgY29uc3RydWN0b3IgKGVpdGhlciBleHBsaWNpdGx5IG9yIGltcGxpY2l0bHkgZGVmaW5lZCkuXG4gICAgaWYgKG1ldGEuZGVwcyAhPT0gJ2ludmFsaWQnKSB7XG4gICAgICBjdG9yRXhwciA9IG5ldyBvLkluc3RhbnRpYXRlRXhwcihcbiAgICAgICAgICB0eXBlRm9yQ3RvcixcbiAgICAgICAgICBpbmplY3REZXBlbmRlbmNpZXMobWV0YS5kZXBzLCBtZXRhLmluamVjdEZuLCBtZXRhLnRhcmdldCA9PT0gUjNGYWN0b3J5VGFyZ2V0LlBpcGUpKTtcblxuICAgICAgY3RvckRlcHNUeXBlID0gY3JlYXRlQ3RvckRlcHNUeXBlKG1ldGEuZGVwcyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnN0IGJhc2VGYWN0b3J5ID0gby52YXJpYWJsZShgybUke21ldGEubmFtZX1fQmFzZUZhY3RvcnlgKTtcbiAgICBjb25zdCBnZXRJbmhlcml0ZWRGYWN0b3J5ID0gby5pbXBvcnRFeHByKFIzLmdldEluaGVyaXRlZEZhY3RvcnkpO1xuICAgIGNvbnN0IGJhc2VGYWN0b3J5U3RtdCA9XG4gICAgICAgIGJhc2VGYWN0b3J5LnNldChnZXRJbmhlcml0ZWRGYWN0b3J5LmNhbGxGbihbbWV0YS5pbnRlcm5hbFR5cGVdKSlcbiAgICAgICAgICAgIC50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkV4cG9ydGVkLCBvLlN0bXRNb2RpZmllci5GaW5hbF0pO1xuICAgIHN0YXRlbWVudHMucHVzaChiYXNlRmFjdG9yeVN0bXQpO1xuXG4gICAgLy8gVGhlcmUgaXMgbm8gY29uc3RydWN0b3IsIHVzZSB0aGUgYmFzZSBjbGFzcycgZmFjdG9yeSB0byBjb25zdHJ1Y3QgdHlwZUZvckN0b3IuXG4gICAgY3RvckV4cHIgPSBiYXNlRmFjdG9yeS5jYWxsRm4oW3R5cGVGb3JDdG9yXSk7XG4gIH1cbiAgY29uc3QgY3RvckV4cHJGaW5hbCA9IGN0b3JFeHByO1xuXG4gIGNvbnN0IGJvZHk6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgbGV0IHJldEV4cHI6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICBmdW5jdGlvbiBtYWtlQ29uZGl0aW9uYWxGYWN0b3J5KG5vbkN0b3JFeHByOiBvLkV4cHJlc3Npb24pOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCByID0gby52YXJpYWJsZSgncicpO1xuICAgIGJvZHkucHVzaChyLnNldChvLk5VTExfRVhQUikudG9EZWNsU3RtdCgpKTtcbiAgICBsZXQgY3RvclN0bXQ6IG8uU3RhdGVtZW50fG51bGwgPSBudWxsO1xuICAgIGlmIChjdG9yRXhwckZpbmFsICE9PSBudWxsKSB7XG4gICAgICBjdG9yU3RtdCA9IHIuc2V0KGN0b3JFeHByRmluYWwpLnRvU3RtdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdG9yU3RtdCA9IG8uaW1wb3J0RXhwcihSMy5pbnZhbGlkRmFjdG9yeSkuY2FsbEZuKFtdKS50b1N0bXQoKTtcbiAgICB9XG4gICAgYm9keS5wdXNoKG8uaWZTdG10KHQsIFtjdG9yU3RtdF0sIFtyLnNldChub25DdG9yRXhwcikudG9TdG10KCldKSk7XG4gICAgcmV0dXJuIHI7XG4gIH1cblxuICBpZiAoaXNEZWxlZ2F0ZWRNZXRhZGF0YShtZXRhKSAmJiBtZXRhLmRlbGVnYXRlVHlwZSA9PT0gUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZhY3RvcnkpIHtcbiAgICBjb25zdCBkZWxlZ2F0ZUZhY3RvcnkgPSBvLnZhcmlhYmxlKGDJtSR7bWV0YS5uYW1lfV9CYXNlRmFjdG9yeWApO1xuICAgIGNvbnN0IGdldEZhY3RvcnlPZiA9IG8uaW1wb3J0RXhwcihSMy5nZXRGYWN0b3J5T2YpO1xuICAgIGlmIChtZXRhLmRlbGVnYXRlLmlzRXF1aXZhbGVudChtZXRhLmludGVybmFsVHlwZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBzdGF0ZTogY29tcGlsaW5nIGZhY3RvcnkgdGhhdCBkZWxlZ2F0ZXMgdG8gaXRzZWxmYCk7XG4gICAgfVxuICAgIGNvbnN0IGRlbGVnYXRlRmFjdG9yeVN0bXQgPVxuICAgICAgICBkZWxlZ2F0ZUZhY3Rvcnkuc2V0KGdldEZhY3RvcnlPZi5jYWxsRm4oW21ldGEuZGVsZWdhdGVdKSkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICBvLlN0bXRNb2RpZmllci5FeHBvcnRlZCwgby5TdG10TW9kaWZpZXIuRmluYWxcbiAgICAgICAgXSk7XG5cbiAgICBzdGF0ZW1lbnRzLnB1c2goZGVsZWdhdGVGYWN0b3J5U3RtdCk7XG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkoZGVsZWdhdGVGYWN0b3J5LmNhbGxGbihbXSkpO1xuICB9IGVsc2UgaWYgKGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YSkpIHtcbiAgICAvLyBUaGlzIHR5cGUgaXMgY3JlYXRlZCB3aXRoIGEgZGVsZWdhdGVkIGZhY3RvcnkuIElmIGEgdHlwZSBwYXJhbWV0ZXIgaXMgbm90IHNwZWNpZmllZCwgY2FsbFxuICAgIC8vIHRoZSBmYWN0b3J5IGluc3RlYWQuXG4gICAgY29uc3QgZGVsZWdhdGVBcmdzID1cbiAgICAgICAgaW5qZWN0RGVwZW5kZW5jaWVzKG1ldGEuZGVsZWdhdGVEZXBzLCBtZXRhLmluamVjdEZuLCBtZXRhLnRhcmdldCA9PT0gUjNGYWN0b3J5VGFyZ2V0LlBpcGUpO1xuICAgIC8vIEVpdGhlciBjYWxsIGBuZXcgZGVsZWdhdGUoLi4uKWAgb3IgYGRlbGVnYXRlKC4uLilgIGRlcGVuZGluZyBvbiBtZXRhLmRlbGVnYXRlVHlwZS5cbiAgICBjb25zdCBmYWN0b3J5RXhwciA9IG5ldyAoXG4gICAgICAgIG1ldGEuZGVsZWdhdGVUeXBlID09PSBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3MgP1xuICAgICAgICAgICAgby5JbnN0YW50aWF0ZUV4cHIgOlxuICAgICAgICAgICAgby5JbnZva2VGdW5jdGlvbkV4cHIpKG1ldGEuZGVsZWdhdGUsIGRlbGVnYXRlQXJncyk7XG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkoZmFjdG9yeUV4cHIpO1xuICB9IGVsc2UgaWYgKGlzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YShtZXRhKSkge1xuICAgIC8vIFRPRE8oYWx4aHViKTogZGVjaWRlIHdoZXRoZXIgdG8gbG93ZXIgdGhlIHZhbHVlIGhlcmUgb3IgaW4gdGhlIGNhbGxlclxuICAgIHJldEV4cHIgPSBtYWtlQ29uZGl0aW9uYWxGYWN0b3J5KG1ldGEuZXhwcmVzc2lvbik7XG4gIH0gZWxzZSB7XG4gICAgcmV0RXhwciA9IGN0b3JFeHByO1xuICB9XG5cbiAgaWYgKHJldEV4cHIgIT09IG51bGwpIHtcbiAgICBib2R5LnB1c2gobmV3IG8uUmV0dXJuU3RhdGVtZW50KHJldEV4cHIpKTtcbiAgfSBlbHNlIHtcbiAgICBib2R5LnB1c2goby5pbXBvcnRFeHByKFIzLmludmFsaWRGYWN0b3J5KS5jYWxsRm4oW10pLnRvU3RtdCgpKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZmFjdG9yeTogby5mbihcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oJ3QnLCBvLkRZTkFNSUNfVFlQRSldLCBib2R5LCBvLklORkVSUkVEX1RZUEUsIHVuZGVmaW5lZCxcbiAgICAgICAgYCR7bWV0YS5uYW1lfV9GYWN0b3J5YCksXG4gICAgc3RhdGVtZW50cyxcbiAgICB0eXBlOiBvLmV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihcbiAgICAgICAgUjMuRmFjdG9yeURlZiwgW3R5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksIGN0b3JEZXBzVHlwZV0pKVxuICB9O1xufVxuXG5mdW5jdGlvbiBpbmplY3REZXBlbmRlbmNpZXMoXG4gICAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXSwgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlzUGlwZTogYm9vbGVhbik6IG8uRXhwcmVzc2lvbltdIHtcbiAgcmV0dXJuIGRlcHMubWFwKChkZXAsIGluZGV4KSA9PiBjb21waWxlSW5qZWN0RGVwZW5kZW5jeShkZXAsIGluamVjdEZuLCBpc1BpcGUsIGluZGV4KSk7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVJbmplY3REZXBlbmRlbmN5KFxuICAgIGRlcDogUjNEZXBlbmRlbmN5TWV0YWRhdGEsIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc1BpcGU6IGJvb2xlYW4sXG4gICAgaW5kZXg6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIC8vIEludGVycHJldCB0aGUgZGVwZW5kZW5jeSBhY2NvcmRpbmcgdG8gaXRzIHJlc29sdmVkIHR5cGUuXG4gIHN3aXRjaCAoZGVwLnJlc29sdmVkKSB7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVG9rZW46XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQ2hhbmdlRGV0ZWN0b3JSZWY6XG4gICAgICAvLyBCdWlsZCB1cCB0aGUgaW5qZWN0aW9uIGZsYWdzIGFjY29yZGluZyB0byB0aGUgbWV0YWRhdGEuXG4gICAgICBjb25zdCBmbGFncyA9IEluamVjdEZsYWdzLkRlZmF1bHQgfCAoZGVwLnNlbGYgPyBJbmplY3RGbGFncy5TZWxmIDogMCkgfFxuICAgICAgICAgIChkZXAuc2tpcFNlbGYgPyBJbmplY3RGbGFncy5Ta2lwU2VsZiA6IDApIHwgKGRlcC5ob3N0ID8gSW5qZWN0RmxhZ3MuSG9zdCA6IDApIHxcbiAgICAgICAgICAoZGVwLm9wdGlvbmFsID8gSW5qZWN0RmxhZ3MuT3B0aW9uYWwgOiAwKTtcblxuICAgICAgLy8gSWYgdGhpcyBkZXBlbmRlbmN5IGlzIG9wdGlvbmFsIG9yIG90aGVyd2lzZSBoYXMgbm9uLWRlZmF1bHQgZmxhZ3MsIHRoZW4gYWRkaXRpb25hbFxuICAgICAgLy8gcGFyYW1ldGVycyBkZXNjcmliaW5nIGhvdyB0byBpbmplY3QgdGhlIGRlcGVuZGVuY3kgbXVzdCBiZSBwYXNzZWQgdG8gdGhlIGluamVjdCBmdW5jdGlvblxuICAgICAgLy8gdGhhdCdzIGJlaW5nIHVzZWQuXG4gICAgICBsZXQgZmxhZ3NQYXJhbTogby5MaXRlcmFsRXhwcnxudWxsID1cbiAgICAgICAgICAoZmxhZ3MgIT09IEluamVjdEZsYWdzLkRlZmF1bHQgfHwgZGVwLm9wdGlvbmFsKSA/IG8ubGl0ZXJhbChmbGFncykgOiBudWxsO1xuXG4gICAgICAvLyBXZSBoYXZlIGEgc2VwYXJhdGUgaW5zdHJ1Y3Rpb24gZm9yIGluamVjdGluZyBDaGFuZ2VEZXRlY3RvclJlZiBpbnRvIGEgcGlwZS5cbiAgICAgIGlmIChpc1BpcGUgJiYgZGVwLnJlc29sdmVkID09PSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQ2hhbmdlRGV0ZWN0b3JSZWYpIHtcbiAgICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbmplY3RQaXBlQ2hhbmdlRGV0ZWN0b3JSZWYpLmNhbGxGbihmbGFnc1BhcmFtID8gW2ZsYWdzUGFyYW1dIDogW10pO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB1cCB0aGUgYXJndW1lbnRzIHRvIHRoZSBpbmplY3RGbiBjYWxsLlxuICAgICAgY29uc3QgaW5qZWN0QXJncyA9IFtkZXAudG9rZW5dO1xuICAgICAgaWYgKGZsYWdzUGFyYW0pIHtcbiAgICAgICAgaW5qZWN0QXJncy5wdXNoKGZsYWdzUGFyYW0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbmplY3RGbikuY2FsbEZuKGluamVjdEFyZ3MpO1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZTpcbiAgICAgIC8vIEluIHRoZSBjYXNlIG9mIGF0dHJpYnV0ZXMsIHRoZSBhdHRyaWJ1dGUgbmFtZSBpbiBxdWVzdGlvbiBpcyBnaXZlbiBhcyB0aGUgdG9rZW4uXG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmluamVjdEF0dHJpYnV0ZSkuY2FsbEZuKFtkZXAudG9rZW5dKTtcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5JbnZhbGlkOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnZhbGlkRmFjdG9yeURlcCkuY2FsbEZuKFtvLmxpdGVyYWwoaW5kZXgpXSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bnN1cHBvcnRlZChcbiAgICAgICAgICBgVW5rbm93biBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU6ICR7UjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlW2RlcC5yZXNvbHZlZF19YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQ3RvckRlcHNUeXBlKGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10pOiBvLlR5cGUge1xuICBsZXQgaGFzVHlwZXMgPSBmYWxzZTtcbiAgY29uc3QgYXR0cmlidXRlVHlwZXMgPSBkZXBzLm1hcChkZXAgPT4ge1xuICAgIGNvbnN0IHR5cGUgPSBjcmVhdGVDdG9yRGVwVHlwZShkZXApO1xuICAgIGlmICh0eXBlICE9PSBudWxsKSB7XG4gICAgICBoYXNUeXBlcyA9IHRydWU7XG4gICAgICByZXR1cm4gdHlwZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG8ubGl0ZXJhbChudWxsKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChoYXNUeXBlcykge1xuICAgIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVUeXBlcykpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBvLk5PTkVfVFlQRTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDdG9yRGVwVHlwZShkZXA6IFIzRGVwZW5kZW5jeU1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgY29uc3QgZW50cmllczoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW4sIHZhbHVlOiBvLkV4cHJlc3Npb259W10gPSBbXTtcblxuICBpZiAoZGVwLnJlc29sdmVkID09PSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlKSB7XG4gICAgaWYgKGRlcC5hdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIGVudHJpZXMucHVzaCh7a2V5OiAnYXR0cmlidXRlJywgdmFsdWU6IGRlcC5hdHRyaWJ1dGUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG4gIH1cbiAgaWYgKGRlcC5vcHRpb25hbCkge1xuICAgIGVudHJpZXMucHVzaCh7a2V5OiAnb3B0aW9uYWwnLCB2YWx1ZTogby5saXRlcmFsKHRydWUpLCBxdW90ZWQ6IGZhbHNlfSk7XG4gIH1cbiAgaWYgKGRlcC5ob3N0KSB7XG4gICAgZW50cmllcy5wdXNoKHtrZXk6ICdob3N0JywgdmFsdWU6IG8ubGl0ZXJhbCh0cnVlKSwgcXVvdGVkOiBmYWxzZX0pO1xuICB9XG4gIGlmIChkZXAuc2VsZikge1xuICAgIGVudHJpZXMucHVzaCh7a2V5OiAnc2VsZicsIHZhbHVlOiBvLmxpdGVyYWwodHJ1ZSksIHF1b3RlZDogZmFsc2V9KTtcbiAgfVxuICBpZiAoZGVwLnNraXBTZWxmKSB7XG4gICAgZW50cmllcy5wdXNoKHtrZXk6ICdza2lwU2VsZicsIHZhbHVlOiBvLmxpdGVyYWwodHJ1ZSksIHF1b3RlZDogZmFsc2V9KTtcbiAgfVxuXG4gIHJldHVybiBlbnRyaWVzLmxlbmd0aCA+IDAgPyBvLmxpdGVyYWxNYXAoZW50cmllcykgOiBudWxsO1xufVxuXG4vKipcbiAqIEEgaGVscGVyIGZ1bmN0aW9uIHVzZWZ1bCBmb3IgZXh0cmFjdGluZyBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZyb20gYSBSZW5kZXIyXG4gKiBgQ29tcGlsZVR5cGVNZXRhZGF0YWAgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXBlbmRlbmNpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgdHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10ge1xuICAvLyBVc2UgdGhlIGBDb21waWxlUmVmbGVjdG9yYCB0byBsb29rIHVwIHJlZmVyZW5jZXMgdG8gc29tZSB3ZWxsLWtub3duIEFuZ3VsYXIgdHlwZXMuIFRoZXNlIHdpbGxcbiAgLy8gYmUgY29tcGFyZWQgd2l0aCB0aGUgdG9rZW4gdG8gc3RhdGljYWxseSBkZXRlcm1pbmUgd2hldGhlciB0aGUgdG9rZW4gaGFzIHNpZ25pZmljYW5jZSB0b1xuICAvLyBBbmd1bGFyLCBhbmQgc2V0IHRoZSBjb3JyZWN0IGBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGVgIGFzIGEgcmVzdWx0LlxuICBjb25zdCBpbmplY3RvclJlZiA9IHJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpO1xuXG4gIC8vIEl0ZXJhdGUgdGhyb3VnaCB0aGUgdHlwZSdzIERJIGRlcGVuZGVuY2llcyBhbmQgcHJvZHVjZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgIGZvciBlYWNoIG9mIHRoZW0uXG4gIGNvbnN0IGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgZm9yIChsZXQgZGVwZW5kZW5jeSBvZiB0eXBlLmRpRGVwcykge1xuICAgIGlmIChkZXBlbmRlbmN5LnRva2VuKSB7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKGRlcGVuZGVuY3kudG9rZW4pO1xuICAgICAgbGV0IHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgPSBkZXBlbmRlbmN5LmlzQXR0cmlidXRlID9cbiAgICAgICAgICBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlIDpcbiAgICAgICAgICBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuVG9rZW47XG5cbiAgICAgIC8vIEluIHRoZSBjYXNlIG9mIG1vc3QgZGVwZW5kZW5jaWVzLCB0aGUgdG9rZW4gd2lsbCBiZSBhIHJlZmVyZW5jZSB0byBhIHR5cGUuIFNvbWV0aW1lcyxcbiAgICAgIC8vIGhvd2V2ZXIsIGl0IGNhbiBiZSBhIHN0cmluZywgaW4gdGhlIGNhc2Ugb2Ygb2xkZXIgQW5ndWxhciBjb2RlIG9yIEBBdHRyaWJ1dGUgaW5qZWN0aW9uLlxuICAgICAgY29uc3QgdG9rZW4gPVxuICAgICAgICAgIHRva2VuUmVmIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sID8gb3V0cHV0Q3R4LmltcG9ydEV4cHIodG9rZW5SZWYpIDogby5saXRlcmFsKHRva2VuUmVmKTtcblxuICAgICAgLy8gQ29uc3RydWN0IHRoZSBkZXBlbmRlbmN5LlxuICAgICAgZGVwcy5wdXNoKHtcbiAgICAgICAgdG9rZW4sXG4gICAgICAgIGF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGhvc3Q6ICEhZGVwZW5kZW5jeS5pc0hvc3QsXG4gICAgICAgIG9wdGlvbmFsOiAhIWRlcGVuZGVuY3kuaXNPcHRpb25hbCxcbiAgICAgICAgc2VsZjogISFkZXBlbmRlbmN5LmlzU2VsZixcbiAgICAgICAgc2tpcFNlbGY6ICEhZGVwZW5kZW5jeS5pc1NraXBTZWxmLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVuc3VwcG9ydGVkKCdkZXBlbmRlbmN5IHdpdGhvdXQgYSB0b2tlbicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZXBzO1xufVxuXG5mdW5jdGlvbiBpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTogbWV0YSBpcyBSM0RlbGVnYXRlZEZhY3RvcnlNZXRhZGF0YXxcbiAgICBSM0RlbGVnYXRlZEZuT3JDbGFzc01ldGFkYXRhIHtcbiAgcmV0dXJuIChtZXRhIGFzIGFueSkuZGVsZWdhdGVUeXBlICE9PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YShtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IG1ldGEgaXMgUjNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhIHtcbiAgcmV0dXJuIChtZXRhIGFzIGFueSkuZXhwcmVzc2lvbiAhPT0gdW5kZWZpbmVkO1xufVxuIl19