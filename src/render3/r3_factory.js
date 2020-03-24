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
                        attribute: null, resolved: resolved,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgseUVBQWtEO0lBQ2xELDJFQUF3RTtJQUd4RSxpRUFBMkM7SUFDM0MsMkRBQTBDO0lBQzFDLCtFQUE0RDtJQUc1RCwyREFBdUQ7SUFDdkQsZ0VBQXdDO0lBb0R4QyxJQUFZLHFCQUlYO0lBSkQsV0FBWSxxQkFBcUI7UUFDL0IsbUVBQUssQ0FBQTtRQUNMLHlFQUFRLENBQUE7UUFDUix1RUFBTyxDQUFBO0lBQ1QsQ0FBQyxFQUpXLHFCQUFxQixHQUFyQiw2QkFBcUIsS0FBckIsNkJBQXFCLFFBSWhDO0lBb0JELElBQVksZUFNWDtJQU5ELFdBQVksZUFBZTtRQUN6QiwrREFBYSxDQUFBO1FBQ2IsK0RBQWEsQ0FBQTtRQUNiLGlFQUFjLENBQUE7UUFDZCxxREFBUSxDQUFBO1FBQ1IsNkRBQVksQ0FBQTtJQUNkLENBQUMsRUFOVyxlQUFlLEdBQWYsdUJBQWUsS0FBZix1QkFBZSxRQU0xQjtJQUVEOzs7Ozs7O09BT0c7SUFDSCxJQUFZLHdCQXNCWDtJQXRCRCxXQUFZLHdCQUF3QjtRQUNsQzs7V0FFRztRQUNILHlFQUFTLENBQUE7UUFFVDs7OztXQUlHO1FBQ0gsaUZBQWEsQ0FBQTtRQUViOztXQUVHO1FBQ0gsaUdBQXFCLENBQUE7UUFFckI7O1dBRUc7UUFDSCw2RUFBVyxDQUFBO0lBQ2IsQ0FBQyxFQXRCVyx3QkFBd0IsR0FBeEIsZ0NBQXdCLEtBQXhCLGdDQUF3QixRQXNCbkM7SUFtREQ7O09BRUc7SUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxJQUF1QjtRQUM1RCxJQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLElBQU0sVUFB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KiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVUeXBlTWV0YWRhdGEsIHRva2VuUmVmZXJlbmNlfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtJbmplY3RGbGFnc30gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM1JlZmVyZW5jZSwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHt1bnN1cHBvcnRlZH0gZnJvbSAnLi92aWV3L3V0aWwnO1xuXG5cblxuLyoqXG4gKiBNZXRhZGF0YSByZXF1aXJlZCBieSB0aGUgZmFjdG9yeSBnZW5lcmF0b3IgdG8gZ2VuZXJhdGUgYSBgZmFjdG9yeWAgZnVuY3Rpb24gZm9yIGEgdHlwZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHtcbiAgLyoqXG4gICAqIFN0cmluZyBuYW1lIG9mIHRoZSB0eXBlIGJlaW5nIGdlbmVyYXRlZCAodXNlZCB0byBuYW1lIHRoZSBmYWN0b3J5IGZ1bmN0aW9uKS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIGludGVyZmFjZSB0eXBlIGJlaW5nIGNvbnN0cnVjdGVkLlxuICAgKi9cbiAgdHlwZTogUjNSZWZlcmVuY2U7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBjb25zdHJ1Y3RvciB0eXBlLCBpbnRlbmRlZCBmb3IgdXNlIHdpdGhpbiBhIGNsYXNzIGRlZmluaXRpb25cbiAgICogaXRzZWxmLlxuICAgKlxuICAgKiBUaGlzIGNhbiBkaWZmZXIgZnJvbSB0aGUgb3V0ZXIgYHR5cGVgIGlmIHRoZSBjbGFzcyBpcyBiZWluZyBjb21waWxlZCBieSBuZ2NjIGFuZCBpcyBpbnNpZGVcbiAgICogYW4gSUlGRSBzdHJ1Y3R1cmUgdGhhdCB1c2VzIGEgZGlmZmVyZW50IG5hbWUgaW50ZXJuYWxseS5cbiAgICovXG4gIGludGVybmFsVHlwZTogby5FeHByZXNzaW9uO1xuXG4gIC8qKiBOdW1iZXIgb2YgYXJndW1lbnRzIGZvciB0aGUgYHR5cGVgLiAqL1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBSZWdhcmRsZXNzIG9mIHdoZXRoZXIgYGZuT3JDbGFzc2AgaXMgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBvciBhIHVzZXItZGVmaW5lZCBmYWN0b3J5LCBpdFxuICAgKiBtYXkgaGF2ZSAwIG9yIG1vcmUgcGFyYW1ldGVycywgd2hpY2ggd2lsbCBiZSBpbmplY3RlZCBhY2NvcmRpbmcgdG8gdGhlIGBSM0RlcGVuZGVuY3lNZXRhZGF0YWBcbiAgICogZm9yIHRob3NlIHBhcmFtZXRlcnMuIElmIHRoaXMgaXMgYG51bGxgLCB0aGVuIHRoZSB0eXBlJ3MgY29uc3RydWN0b3IgaXMgbm9uZXhpc3RlbnQgYW5kIHdpbGxcbiAgICogYmUgaW5oZXJpdGVkIGZyb20gYGZuT3JDbGFzc2Agd2hpY2ggaXMgaW50ZXJwcmV0ZWQgYXMgdGhlIGN1cnJlbnQgdHlwZS4gSWYgdGhpcyBpcyBgJ2ludmFsaWQnYCxcbiAgICogdGhlbiBvbmUgb3IgbW9yZSBvZiB0aGUgcGFyYW1ldGVycyB3YXNuJ3QgcmVzb2x2YWJsZSBhbmQgYW55IGF0dGVtcHQgdG8gdXNlIHRoZXNlIGRlcHMgd2lsbFxuICAgKiByZXN1bHQgaW4gYSBydW50aW1lIGVycm9yLlxuICAgKi9cbiAgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXwnaW52YWxpZCd8bnVsbDtcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiBmb3IgdGhlIGZ1bmN0aW9uIHdoaWNoIHdpbGwgYmUgdXNlZCB0byBpbmplY3QgZGVwZW5kZW5jaWVzLiBUaGUgQVBJIG9mIHRoaXNcbiAgICogZnVuY3Rpb24gY291bGQgYmUgZGlmZmVyZW50LCBhbmQgb3RoZXIgb3B0aW9ucyBjb250cm9sIGhvdyBpdCB3aWxsIGJlIGludm9rZWQuXG4gICAqL1xuICBpbmplY3RGbjogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvKipcbiAgICogVHlwZSBvZiB0aGUgdGFyZ2V0IGJlaW5nIGNyZWF0ZWQgYnkgdGhlIGZhY3RvcnkuXG4gICAqL1xuICB0YXJnZXQ6IFIzRmFjdG9yeVRhcmdldDtcbn1cblxuZXhwb3J0IGVudW0gUjNGYWN0b3J5RGVsZWdhdGVUeXBlIHtcbiAgQ2xhc3MsXG4gIEZ1bmN0aW9uLFxuICBGYWN0b3J5LFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVsZWdhdGVkRmFjdG9yeU1ldGFkYXRhIGV4dGVuZHMgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIGRlbGVnYXRlOiBvLkV4cHJlc3Npb247XG4gIGRlbGVnYXRlVHlwZTogUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZhY3Rvcnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZWxlZ2F0ZWRGbk9yQ2xhc3NNZXRhZGF0YSBleHRlbmRzIFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEge1xuICBkZWxlZ2F0ZTogby5FeHByZXNzaW9uO1xuICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5DbGFzc3xSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuRnVuY3Rpb247XG4gIGRlbGVnYXRlRGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGEgZXh0ZW5kcyBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHtcbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xufVxuXG5leHBvcnQgdHlwZSBSM0ZhY3RvcnlNZXRhZGF0YSA9IFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEgfCBSM0RlbGVnYXRlZEZhY3RvcnlNZXRhZGF0YSB8XG4gICAgUjNEZWxlZ2F0ZWRGbk9yQ2xhc3NNZXRhZGF0YSB8IFIzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YTtcblxuZXhwb3J0IGVudW0gUjNGYWN0b3J5VGFyZ2V0IHtcbiAgRGlyZWN0aXZlID0gMCxcbiAgQ29tcG9uZW50ID0gMSxcbiAgSW5qZWN0YWJsZSA9IDIsXG4gIFBpcGUgPSAzLFxuICBOZ01vZHVsZSA9IDQsXG59XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiBhIGRlcGVuZGVuY3kuXG4gKlxuICogT2NjYXNpb25hbGx5LCBkZXBlbmRlbmNpZXMgd2lsbCBoYXZlIHNwZWNpYWwgc2lnbmlmaWNhbmNlIHdoaWNoIGlzIGtub3duIHN0YXRpY2FsbHkuIEluIHRoYXRcbiAqIGNhc2UgdGhlIGBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGVgIGluZm9ybXMgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRoYXQgYSBwYXJ0aWN1bGFyIGRlcGVuZGVuY3lcbiAqIHNob3VsZCBiZSBnZW5lcmF0ZWQgc3BlY2lhbGx5ICh1c3VhbGx5IGJ5IGNhbGxpbmcgYSBzcGVjaWFsIGluamVjdGlvbiBmdW5jdGlvbiBpbnN0ZWFkIG9mIHRoZVxuICogc3RhbmRhcmQgb25lKS5cbiAqL1xuZXhwb3J0IGVudW0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIHtcbiAgLyoqXG4gICAqIEEgbm9ybWFsIHRva2VuIGRlcGVuZGVuY3kuXG4gICAqL1xuICBUb2tlbiA9IDAsXG5cbiAgLyoqXG4gICAqIFRoZSBkZXBlbmRlbmN5IGlzIGZvciBhbiBhdHRyaWJ1dGUuXG4gICAqXG4gICAqIFRoZSB0b2tlbiBleHByZXNzaW9uIGlzIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgYXR0cmlidXRlIG5hbWUuXG4gICAqL1xuICBBdHRyaWJ1dGUgPSAxLFxuXG4gIC8qKlxuICAgKiBJbmplY3RpbmcgdGhlIGBDaGFuZ2VEZXRlY3RvclJlZmAgdG9rZW4uIE5lZWRzIHNwZWNpYWwgaGFuZGxpbmcgd2hlbiBpbmplY3RlZCBpbnRvIGEgcGlwZS5cbiAgICovXG4gIENoYW5nZURldGVjdG9yUmVmID0gMixcblxuICAvKipcbiAgICogQW4gaW52YWxpZCBkZXBlbmRlbmN5IChubyB0b2tlbiBjb3VsZCBiZSBkZXRlcm1pbmVkKS4gQW4gZXJyb3Igc2hvdWxkIGJlIHRocm93biBhdCBydW50aW1lLlxuICAgKi9cbiAgSW52YWxpZCA9IDMsXG59XG5cbi8qKlxuICogTWV0YWRhdGEgcmVwcmVzZW50aW5nIGEgc2luZ2xlIGRlcGVuZGVuY3kgdG8gYmUgaW5qZWN0ZWQgaW50byBhIGNvbnN0cnVjdG9yIG9yIGZ1bmN0aW9uIGNhbGwuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHRva2VuIG9yIHZhbHVlIHRvIGJlIGluamVjdGVkLlxuICAgKi9cbiAgdG9rZW46IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogSWYgYW4gQEF0dHJpYnV0ZSBkZWNvcmF0b3IgaXMgcHJlc2VudCwgdGhpcyBpcyB0aGUgbGl0ZXJhbCB0eXBlIG9mIHRoZSBhdHRyaWJ1dGUgbmFtZSwgb3JcbiAgICogdGhlIHVua25vd24gdHlwZSBpZiBubyBsaXRlcmFsIHR5cGUgaXMgYXZhaWxhYmxlIChlLmcuIHRoZSBhdHRyaWJ1dGUgbmFtZSBpcyBhbiBleHByZXNzaW9uKS5cbiAgICogV2lsbCBiZSBudWxsIG90aGVyd2lzZS5cbiAgICovXG4gIGF0dHJpYnV0ZTogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIEFuIGVudW0gaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgZGVwZW5kZW5jeSBoYXMgc3BlY2lhbCBtZWFuaW5nIHRvIEFuZ3VsYXIgYW5kIG5lZWRzIHRvIGJlXG4gICAqIGluamVjdGVkIHNwZWNpYWxseS5cbiAgICovXG4gIHJlc29sdmVkOiBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBIb3N0IHF1YWxpZmllci5cbiAgICovXG4gIGhvc3Q6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlcGVuZGVuY3kgaGFzIGFuIEBPcHRpb25hbCBxdWFsaWZpZXIuXG4gICAqL1xuICBvcHRpb25hbDogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQFNlbGYgcXVhbGlmaWVyLlxuICAgKi9cbiAgc2VsZjogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQFNraXBTZWxmIHF1YWxpZmllci5cbiAgICovXG4gIHNraXBTZWxmOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRmFjdG9yeUZuIHtcbiAgZmFjdG9yeTogby5FeHByZXNzaW9uO1xuICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xuICB0eXBlOiBvLkV4cHJlc3Npb25UeXBlO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhIGZhY3RvcnkgZnVuY3Rpb24gZXhwcmVzc2lvbiBmb3IgdGhlIGdpdmVuIGBSM0ZhY3RvcnlNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTogUjNGYWN0b3J5Rm4ge1xuICBjb25zdCB0ID0gby52YXJpYWJsZSgndCcpO1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGxldCBjdG9yRGVwc1R5cGU6IG8uVHlwZSA9IG8uTk9ORV9UWVBFO1xuXG4gIC8vIFRoZSB0eXBlIHRvIGluc3RhbnRpYXRlIHZpYSBjb25zdHJ1Y3RvciBpbnZvY2F0aW9uLiBJZiB0aGVyZSBpcyBubyBkZWxlZ2F0ZWQgZmFjdG9yeSwgbWVhbmluZ1xuICAvLyB0aGlzIHR5cGUgaXMgYWx3YXlzIGNyZWF0ZWQgYnkgY29uc3RydWN0b3IgaW52b2NhdGlvbiwgdGhlbiB0aGlzIGlzIHRoZSB0eXBlLXRvLWNyZWF0ZVxuICAvLyBwYXJhbWV0ZXIgcHJvdmlkZWQgYnkgdGhlIHVzZXIgKHQpIGlmIHNwZWNpZmllZCwgb3IgdGhlIGN1cnJlbnQgdHlwZSBpZiBub3QuIElmIHRoZXJlIGlzIGFcbiAgLy8gZGVsZWdhdGVkIGZhY3RvcnkgKHdoaWNoIGlzIHVzZWQgdG8gY3JlYXRlIHRoZSBjdXJyZW50IHR5cGUpIHRoZW4gdGhpcyBpcyBvbmx5IHRoZSB0eXBlLXRvLVxuICAvLyBjcmVhdGUgcGFyYW1ldGVyICh0KS5cbiAgY29uc3QgdHlwZUZvckN0b3IgPSAhaXNEZWxlZ2F0ZWRNZXRhZGF0YShtZXRhKSA/XG4gICAgICBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoby5CaW5hcnlPcGVyYXRvci5PciwgdCwgbWV0YS5pbnRlcm5hbFR5cGUpIDpcbiAgICAgIHQ7XG5cbiAgbGV0IGN0b3JFeHByOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gIGlmIChtZXRhLmRlcHMgIT09IG51bGwpIHtcbiAgICAvLyBUaGVyZSBpcyBhIGNvbnN0cnVjdG9yIChlaXRoZXIgZXhwbGljaXRseSBvciBpbXBsaWNpdGx5IGRlZmluZWQpLlxuICAgIGlmIChtZXRhLmRlcHMgIT09ICdpbnZhbGlkJykge1xuICAgICAgY3RvckV4cHIgPSBuZXcgby5JbnN0YW50aWF0ZUV4cHIoXG4gICAgICAgICAgdHlwZUZvckN0b3IsXG4gICAgICAgICAgaW5qZWN0RGVwZW5kZW5jaWVzKG1ldGEuZGVwcywgbWV0YS5pbmplY3RGbiwgbWV0YS50YXJnZXQgPT09IFIzRmFjdG9yeVRhcmdldC5QaXBlKSk7XG5cbiAgICAgIGN0b3JEZXBzVHlwZSA9IGNyZWF0ZUN0b3JEZXBzVHlwZShtZXRhLmRlcHMpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBiYXNlRmFjdG9yeSA9IG8udmFyaWFibGUoYMm1JHttZXRhLm5hbWV9X0Jhc2VGYWN0b3J5YCk7XG4gICAgY29uc3QgZ2V0SW5oZXJpdGVkRmFjdG9yeSA9IG8uaW1wb3J0RXhwcihSMy5nZXRJbmhlcml0ZWRGYWN0b3J5KTtcbiAgICBjb25zdCBiYXNlRmFjdG9yeVN0bXQgPVxuICAgICAgICBiYXNlRmFjdG9yeS5zZXQoZ2V0SW5oZXJpdGVkRmFjdG9yeS5jYWxsRm4oW21ldGEuaW50ZXJuYWxUeXBlXSkpXG4gICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5FeHBvcnRlZCwgby5TdG10TW9kaWZpZXIuRmluYWxdKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goYmFzZUZhY3RvcnlTdG10KTtcblxuICAgIC8vIFRoZXJlIGlzIG5vIGNvbnN0cnVjdG9yLCB1c2UgdGhlIGJhc2UgY2xhc3MnIGZhY3RvcnkgdG8gY29uc3RydWN0IHR5cGVGb3JDdG9yLlxuICAgIGN0b3JFeHByID0gYmFzZUZhY3RvcnkuY2FsbEZuKFt0eXBlRm9yQ3Rvcl0pO1xuICB9XG4gIGNvbnN0IGN0b3JFeHByRmluYWwgPSBjdG9yRXhwcjtcblxuICBjb25zdCBib2R5OiBvLlN0YXRlbWVudFtdID0gW107XG4gIGxldCByZXRFeHByOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgZnVuY3Rpb24gbWFrZUNvbmRpdGlvbmFsRmFjdG9yeShub25DdG9yRXhwcjogby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgciA9IG8udmFyaWFibGUoJ3InKTtcbiAgICBib2R5LnB1c2goci5zZXQoby5OVUxMX0VYUFIpLnRvRGVjbFN0bXQoKSk7XG4gICAgbGV0IGN0b3JTdG10OiBvLlN0YXRlbWVudHxudWxsID0gbnVsbDtcbiAgICBpZiAoY3RvckV4cHJGaW5hbCAhPT0gbnVsbCkge1xuICAgICAgY3RvclN0bXQgPSByLnNldChjdG9yRXhwckZpbmFsKS50b1N0bXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3RvclN0bXQgPSBvLmltcG9ydEV4cHIoUjMuaW52YWxpZEZhY3RvcnkpLmNhbGxGbihbXSkudG9TdG10KCk7XG4gICAgfVxuICAgIGJvZHkucHVzaChvLmlmU3RtdCh0LCBbY3RvclN0bXRdLCBbci5zZXQobm9uQ3RvckV4cHIpLnRvU3RtdCgpXSkpO1xuICAgIHJldHVybiByO1xuICB9XG5cbiAgaWYgKGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YSkgJiYgbWV0YS5kZWxlZ2F0ZVR5cGUgPT09IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GYWN0b3J5KSB7XG4gICAgY29uc3QgZGVsZWdhdGVGYWN0b3J5ID0gby52YXJpYWJsZShgybUke21ldGEubmFtZX1fQmFzZUZhY3RvcnlgKTtcbiAgICBjb25zdCBnZXRGYWN0b3J5T2YgPSBvLmltcG9ydEV4cHIoUjMuZ2V0RmFjdG9yeU9mKTtcbiAgICBpZiAobWV0YS5kZWxlZ2F0ZS5pc0VxdWl2YWxlbnQobWV0YS5pbnRlcm5hbFR5cGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgc3RhdGU6IGNvbXBpbGluZyBmYWN0b3J5IHRoYXQgZGVsZWdhdGVzIHRvIGl0c2VsZmApO1xuICAgIH1cbiAgICBjb25zdCBkZWxlZ2F0ZUZhY3RvcnlTdG10ID1cbiAgICAgICAgZGVsZWdhdGVGYWN0b3J5LnNldChnZXRGYWN0b3J5T2YuY2FsbEZuKFttZXRhLmRlbGVnYXRlXSkpLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbXG4gICAgICAgICAgby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQsIG8uU3RtdE1vZGlmaWVyLkZpbmFsXG4gICAgICAgIF0pO1xuXG4gICAgc3RhdGVtZW50cy5wdXNoKGRlbGVnYXRlRmFjdG9yeVN0bXQpO1xuICAgIHJldEV4cHIgPSBtYWtlQ29uZGl0aW9uYWxGYWN0b3J5KGRlbGVnYXRlRmFjdG9yeS5jYWxsRm4oW10pKTtcbiAgfSBlbHNlIGlmIChpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGEpKSB7XG4gICAgLy8gVGhpcyB0eXBlIGlzIGNyZWF0ZWQgd2l0aCBhIGRlbGVnYXRlZCBmYWN0b3J5LiBJZiBhIHR5cGUgcGFyYW1ldGVyIGlzIG5vdCBzcGVjaWZpZWQsIGNhbGxcbiAgICAvLyB0aGUgZmFjdG9yeSBpbnN0ZWFkLlxuICAgIGNvbnN0IGRlbGVnYXRlQXJncyA9XG4gICAgICAgIGluamVjdERlcGVuZGVuY2llcyhtZXRhLmRlbGVnYXRlRGVwcywgbWV0YS5pbmplY3RGbiwgbWV0YS50YXJnZXQgPT09IFIzRmFjdG9yeVRhcmdldC5QaXBlKTtcbiAgICAvLyBFaXRoZXIgY2FsbCBgbmV3IGRlbGVnYXRlKC4uLilgIG9yIGBkZWxlZ2F0ZSguLi4pYCBkZXBlbmRpbmcgb24gbWV0YS5kZWxlZ2F0ZVR5cGUuXG4gICAgY29uc3QgZmFjdG9yeUV4cHIgPSBuZXcgKFxuICAgICAgICBtZXRhLmRlbGVnYXRlVHlwZSA9PT0gUjNGYWN0b3J5RGVsZWdhdGVUeXBlLkNsYXNzID9cbiAgICAgICAgICAgIG8uSW5zdGFudGlhdGVFeHByIDpcbiAgICAgICAgICAgIG8uSW52b2tlRnVuY3Rpb25FeHByKShtZXRhLmRlbGVnYXRlLCBkZWxlZ2F0ZUFyZ3MpO1xuICAgIHJldEV4cHIgPSBtYWtlQ29uZGl0aW9uYWxGYWN0b3J5KGZhY3RvcnlFeHByKTtcbiAgfSBlbHNlIGlmIChpc0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGEobWV0YSkpIHtcbiAgICAvLyBUT0RPKGFseGh1Yik6IGRlY2lkZSB3aGV0aGVyIHRvIGxvd2VyIHRoZSB2YWx1ZSBoZXJlIG9yIGluIHRoZSBjYWxsZXJcbiAgICByZXRFeHByID0gbWFrZUNvbmRpdGlvbmFsRmFjdG9yeShtZXRhLmV4cHJlc3Npb24pO1xuICB9IGVsc2Uge1xuICAgIHJldEV4cHIgPSBjdG9yRXhwcjtcbiAgfVxuXG4gIGlmIChyZXRFeHByICE9PSBudWxsKSB7XG4gICAgYm9keS5wdXNoKG5ldyBvLlJldHVyblN0YXRlbWVudChyZXRFeHByKSk7XG4gIH0gZWxzZSB7XG4gICAgYm9keS5wdXNoKG8uaW1wb3J0RXhwcihSMy5pbnZhbGlkRmFjdG9yeSkuY2FsbEZuKFtdKS50b1N0bXQoKSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGZhY3Rvcnk6IG8uZm4oXG4gICAgICAgIFtuZXcgby5GblBhcmFtKCd0Jywgby5EWU5BTUlDX1RZUEUpXSwgYm9keSwgby5JTkZFUlJFRF9UWVBFLCB1bmRlZmluZWQsXG4gICAgICAgIGAke21ldGEubmFtZX1fRmFjdG9yeWApLFxuICAgIHN0YXRlbWVudHMsXG4gICAgdHlwZTogby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoXG4gICAgICAgIFIzLkZhY3RvcnlEZWYsXG4gICAgICAgIFt0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpLCBjdG9yRGVwc1R5cGVdKSlcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5qZWN0RGVwZW5kZW5jaWVzKFxuICAgIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10sIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc1BpcGU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHJldHVybiBkZXBzLm1hcCgoZGVwLCBpbmRleCkgPT4gY29tcGlsZUluamVjdERlcGVuZGVuY3koZGVwLCBpbmplY3RGbiwgaXNQaXBlLCBpbmRleCkpO1xufVxuXG5mdW5jdGlvbiBjb21waWxlSW5qZWN0RGVwZW5kZW5jeShcbiAgICBkZXA6IFIzRGVwZW5kZW5jeU1ldGFkYXRhLCBpbmplY3RGbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNQaXBlOiBib29sZWFuLFxuICAgIGluZGV4OiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJbnRlcnByZXQgdGhlIGRlcGVuZGVuY3kgYWNjb3JkaW5nIHRvIGl0cyByZXNvbHZlZCB0eXBlLlxuICBzd2l0Y2ggKGRlcC5yZXNvbHZlZCkge1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuOlxuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkNoYW5nZURldGVjdG9yUmVmOlxuICAgICAgLy8gQnVpbGQgdXAgdGhlIGluamVjdGlvbiBmbGFncyBhY2NvcmRpbmcgdG8gdGhlIG1ldGFkYXRhLlxuICAgICAgY29uc3QgZmxhZ3MgPSBJbmplY3RGbGFncy5EZWZhdWx0IHwgKGRlcC5zZWxmID8gSW5qZWN0RmxhZ3MuU2VsZiA6IDApIHxcbiAgICAgICAgICAoZGVwLnNraXBTZWxmID8gSW5qZWN0RmxhZ3MuU2tpcFNlbGYgOiAwKSB8IChkZXAuaG9zdCA/IEluamVjdEZsYWdzLkhvc3QgOiAwKSB8XG4gICAgICAgICAgKGRlcC5vcHRpb25hbCA/IEluamVjdEZsYWdzLk9wdGlvbmFsIDogMCk7XG5cbiAgICAgIC8vIElmIHRoaXMgZGVwZW5kZW5jeSBpcyBvcHRpb25hbCBvciBvdGhlcndpc2UgaGFzIG5vbi1kZWZhdWx0IGZsYWdzLCB0aGVuIGFkZGl0aW9uYWxcbiAgICAgIC8vIHBhcmFtZXRlcnMgZGVzY3JpYmluZyBob3cgdG8gaW5qZWN0IHRoZSBkZXBlbmRlbmN5IG11c3QgYmUgcGFzc2VkIHRvIHRoZSBpbmplY3QgZnVuY3Rpb25cbiAgICAgIC8vIHRoYXQncyBiZWluZyB1c2VkLlxuICAgICAgbGV0IGZsYWdzUGFyYW06IG8uTGl0ZXJhbEV4cHJ8bnVsbCA9XG4gICAgICAgICAgKGZsYWdzICE9PSBJbmplY3RGbGFncy5EZWZhdWx0IHx8IGRlcC5vcHRpb25hbCkgPyBvLmxpdGVyYWwoZmxhZ3MpIDogbnVsbDtcblxuICAgICAgLy8gV2UgaGF2ZSBhIHNlcGFyYXRlIGluc3RydWN0aW9uIGZvciBpbmplY3RpbmcgQ2hhbmdlRGV0ZWN0b3JSZWYgaW50byBhIHBpcGUuXG4gICAgICBpZiAoaXNQaXBlICYmIGRlcC5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkNoYW5nZURldGVjdG9yUmVmKSB7XG4gICAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0UGlwZUNoYW5nZURldGVjdG9yUmVmKS5jYWxsRm4oZmxhZ3NQYXJhbSA/IFtmbGFnc1BhcmFtXSA6IFtdKTtcbiAgICAgIH1cblxuICAgICAgLy8gQnVpbGQgdXAgdGhlIGFyZ3VtZW50cyB0byB0aGUgaW5qZWN0Rm4gY2FsbC5cbiAgICAgIGNvbnN0IGluamVjdEFyZ3MgPSBbZGVwLnRva2VuXTtcbiAgICAgIGlmIChmbGFnc1BhcmFtKSB7XG4gICAgICAgIGluamVjdEFyZ3MucHVzaChmbGFnc1BhcmFtKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoaW5qZWN0Rm4pLmNhbGxGbihpbmplY3RBcmdzKTtcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5BdHRyaWJ1dGU6XG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBhdHRyaWJ1dGVzLCB0aGUgYXR0cmlidXRlIG5hbWUgaW4gcXVlc3Rpb24gaXMgZ2l2ZW4gYXMgdGhlIHRva2VuLlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbmplY3RBdHRyaWJ1dGUpLmNhbGxGbihbZGVwLnRva2VuXSk7XG4gICAgY2FzZSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuSW52YWxpZDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW52YWxpZEZhY3RvcnlEZXApLmNhbGxGbihbby5saXRlcmFsKGluZGV4KV0pO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5zdXBwb3J0ZWQoXG4gICAgICAgICAgYFVua25vd24gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlOiAke1IzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZVtkZXAucmVzb2x2ZWRdfWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUN0b3JEZXBzVHlwZShkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdKTogby5UeXBlIHtcbiAgbGV0IGhhc1R5cGVzID0gZmFsc2U7XG4gIGNvbnN0IGF0dHJpYnV0ZVR5cGVzID0gZGVwcy5tYXAoZGVwID0+IHtcbiAgICBjb25zdCB0eXBlID0gY3JlYXRlQ3RvckRlcFR5cGUoZGVwKTtcbiAgICBpZiAodHlwZSAhPT0gbnVsbCkge1xuICAgICAgaGFzVHlwZXMgPSB0cnVlO1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvLmxpdGVyYWwobnVsbCk7XG4gICAgfVxuICB9KTtcblxuICBpZiAoaGFzVHlwZXMpIHtcbiAgICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXR0cmlidXRlVHlwZXMpKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gby5OT05FX1RZUEU7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQ3RvckRlcFR5cGUoZGVwOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGNvbnN0IGVudHJpZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgaWYgKGRlcC5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSkge1xuICAgIGlmIChkZXAuYXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICBlbnRyaWVzLnB1c2goe2tleTogJ2F0dHJpYnV0ZScsIHZhbHVlOiBkZXAuYXR0cmlidXRlLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuICB9XG4gIGlmIChkZXAub3B0aW9uYWwpIHtcbiAgICBlbnRyaWVzLnB1c2goe2tleTogJ29wdGlvbmFsJywgdmFsdWU6IG8ubGl0ZXJhbCh0cnVlKSwgcXVvdGVkOiBmYWxzZX0pO1xuICB9XG4gIGlmIChkZXAuaG9zdCkge1xuICAgIGVudHJpZXMucHVzaCh7a2V5OiAnaG9zdCcsIHZhbHVlOiBvLmxpdGVyYWwodHJ1ZSksIHF1b3RlZDogZmFsc2V9KTtcbiAgfVxuICBpZiAoZGVwLnNlbGYpIHtcbiAgICBlbnRyaWVzLnB1c2goe2tleTogJ3NlbGYnLCB2YWx1ZTogby5saXRlcmFsKHRydWUpLCBxdW90ZWQ6IGZhbHNlfSk7XG4gIH1cbiAgaWYgKGRlcC5za2lwU2VsZikge1xuICAgIGVudHJpZXMucHVzaCh7a2V5OiAnc2tpcFNlbGYnLCB2YWx1ZTogby5saXRlcmFsKHRydWUpLCBxdW90ZWQ6IGZhbHNlfSk7XG4gIH1cblxuICByZXR1cm4gZW50cmllcy5sZW5ndGggPiAwID8gby5saXRlcmFsTWFwKGVudHJpZXMpIDogbnVsbDtcbn1cblxuLyoqXG4gKiBBIGhlbHBlciBmdW5jdGlvbiB1c2VmdWwgZm9yIGV4dHJhY3RpbmcgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmcm9tIGEgUmVuZGVyMlxuICogYENvbXBpbGVUeXBlTWV0YWRhdGFgIGluc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdIHtcbiAgLy8gVXNlIHRoZSBgQ29tcGlsZVJlZmxlY3RvcmAgdG8gbG9vayB1cCByZWZlcmVuY2VzIHRvIHNvbWUgd2VsbC1rbm93biBBbmd1bGFyIHR5cGVzLiBUaGVzZSB3aWxsXG4gIC8vIGJlIGNvbXBhcmVkIHdpdGggdGhlIHRva2VuIHRvIHN0YXRpY2FsbHkgZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHRva2VuIGhhcyBzaWduaWZpY2FuY2UgdG9cbiAgLy8gQW5ndWxhciwgYW5kIHNldCB0aGUgY29ycmVjdCBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBhcyBhIHJlc3VsdC5cbiAgY29uc3QgaW5qZWN0b3JSZWYgPSByZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkluamVjdG9yKTtcblxuICAvLyBJdGVyYXRlIHRocm91Z2ggdGhlIHR5cGUncyBESSBkZXBlbmRlbmNpZXMgYW5kIHByb2R1Y2UgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmb3IgZWFjaCBvZiB0aGVtLlxuICBjb25zdCBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdID0gW107XG4gIGZvciAobGV0IGRlcGVuZGVuY3kgb2YgdHlwZS5kaURlcHMpIHtcbiAgICBpZiAoZGVwZW5kZW5jeS50b2tlbikge1xuICAgICAgY29uc3QgdG9rZW5SZWYgPSB0b2tlblJlZmVyZW5jZShkZXBlbmRlbmN5LnRva2VuKTtcbiAgICAgIGxldCByZXNvbHZlZDogUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlID0gZGVwZW5kZW5jeS5pc0F0dHJpYnV0ZSA/XG4gICAgICAgICAgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSA6XG4gICAgICAgICAgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuO1xuXG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBtb3N0IGRlcGVuZGVuY2llcywgdGhlIHRva2VuIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8gYSB0eXBlLiBTb21ldGltZXMsXG4gICAgICAvLyBob3dldmVyLCBpdCBjYW4gYmUgYSBzdHJpbmcsIGluIHRoZSBjYXNlIG9mIG9sZGVyIEFuZ3VsYXIgY29kZSBvciBAQXR0cmlidXRlIGluamVjdGlvbi5cbiAgICAgIGNvbnN0IHRva2VuID1cbiAgICAgICAgICB0b2tlblJlZiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCA/IG91dHB1dEN0eC5pbXBvcnRFeHByKHRva2VuUmVmKSA6IG8ubGl0ZXJhbCh0b2tlblJlZik7XG5cbiAgICAgIC8vIENvbnN0cnVjdCB0aGUgZGVwZW5kZW5jeS5cbiAgICAgIGRlcHMucHVzaCh7XG4gICAgICAgIHRva2VuLFxuICAgICAgICBhdHRyaWJ1dGU6IG51bGwsIHJlc29sdmVkLFxuICAgICAgICBob3N0OiAhIWRlcGVuZGVuY3kuaXNIb3N0LFxuICAgICAgICBvcHRpb25hbDogISFkZXBlbmRlbmN5LmlzT3B0aW9uYWwsXG4gICAgICAgIHNlbGY6ICEhZGVwZW5kZW5jeS5pc1NlbGYsXG4gICAgICAgIHNraXBTZWxmOiAhIWRlcGVuZGVuY3kuaXNTa2lwU2VsZixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB1bnN1cHBvcnRlZCgnZGVwZW5kZW5jeSB3aXRob3V0IGEgdG9rZW4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVwcztcbn1cblxuZnVuY3Rpb24gaXNEZWxlZ2F0ZWRNZXRhZGF0YShtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IG1ldGEgaXMgUjNEZWxlZ2F0ZWRGYWN0b3J5TWV0YWRhdGF8XG4gICAgUjNEZWxlZ2F0ZWRGbk9yQ2xhc3NNZXRhZGF0YSB7XG4gIHJldHVybiAobWV0YSBhcyBhbnkpLmRlbGVnYXRlVHlwZSAhPT0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGEobWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBtZXRhIGlzIFIzRXhwcmVzc2lvbkZhY3RvcnlNZXRhZGF0YSB7XG4gIHJldHVybiAobWV0YSBhcyBhbnkpLmV4cHJlc3Npb24gIT09IHVuZGVmaW5lZDtcbn1cbiJdfQ==