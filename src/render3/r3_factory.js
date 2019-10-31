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
    })(R3ResolvedDependencyType = exports.R3ResolvedDependencyType || (exports.R3ResolvedDependencyType = {}));
    /**
     * Construct a factory function expression for the given `R3FactoryMetadata`.
     */
    function compileFactoryFunction(meta) {
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
                ctorExpr = new o.InstantiateExpr(typeForCtor, injectDependencies(meta.deps, meta.injectFn, meta.target === R3FactoryTarget.Pipe));
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
                ctorStmt = o.importExpr(r3_identifiers_1.Identifiers.invalidFactory).callFn([]).toStmt();
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
            type: o.expressionType(o.importExpr(r3_identifiers_1.Identifiers.FactoryDef, [util_1.typeWithParameters(meta.type, meta.typeArgumentCount)]))
        };
    }
    exports.compileFactoryFunction = compileFactoryFunction;
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
    function isDelegatedMetadata(meta) {
        return meta.delegateType !== undefined;
    }
    function isExpressionFactoryMetadata(meta) {
        return meta.expression !== undefined;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgseUVBQWtEO0lBQ2xELDJFQUF3RTtJQUd4RSxpRUFBMkM7SUFDM0MsMkRBQTBDO0lBQzFDLCtFQUE0RDtJQUc1RCwyREFBMEM7SUFDMUMsZ0VBQXdDO0lBK0N4QyxJQUFZLHFCQUlYO0lBSkQsV0FBWSxxQkFBcUI7UUFDL0IsbUVBQUssQ0FBQTtRQUNMLHlFQUFRLENBQUE7UUFDUix1RUFBTyxDQUFBO0lBQ1QsQ0FBQyxFQUpXLHFCQUFxQixHQUFyQiw2QkFBcUIsS0FBckIsNkJBQXFCLFFBSWhDO0lBb0JELElBQVksZUFNWDtJQU5ELFdBQVksZUFBZTtRQUN6QiwrREFBYSxDQUFBO1FBQ2IsK0RBQWEsQ0FBQTtRQUNiLGlFQUFjLENBQUE7UUFDZCxxREFBUSxDQUFBO1FBQ1IsNkRBQVksQ0FBQTtJQUNkLENBQUMsRUFOVyxlQUFlLEdBQWYsdUJBQWUsS0FBZix1QkFBZSxRQU0xQjtJQUVEOzs7Ozs7O09BT0c7SUFDSCxJQUFZLHdCQWlCWDtJQWpCRCxXQUFZLHdCQUF3QjtRQUNsQzs7V0FFRztRQUNILHlFQUFTLENBQUE7UUFFVDs7OztXQUlHO1FBQ0gsaUZBQWEsQ0FBQTtRQUViOztXQUVHO1FBQ0gsaUdBQXFCLENBQUE7SUFDdkIsQ0FBQyxFQWpCVyx3QkFBd0IsR0FBeEIsZ0NBQXdCLEtBQXhCLGdDQUF3QixRQWlCbkM7SUE0Q0Q7O09BRUc7SUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxJQUF1QjtRQUM1RCxJQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLElBQU0sVUFBVSxHQUFrQixFQUFFLENBQUM7UUFFckMsZ0dB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QUFLLENBQUMsQ0FBQztvQkFDbEQsSUFBSSxRQUFRLEdBQTZCLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQzt3QkFDN0Qsd0JBQXdCLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQ3BDLHdCQUF3QixDQUFDLEtBQUssQ0FBQztvQkFFbkMsd0ZBQXdGO29CQUN4RiwwRkFBMEY7b0JBQzFGLElBQU0sS0FBSyxHQUNQLFFBQVEsWUFBWSw0QkFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUU1Riw0QkFBNEI7b0JBQzVCLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ1IsS0FBSyxPQUFBO3dCQUNMLFFBQVEsVUFBQTt3QkFDUixJQUFJLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNO3dCQUN6QixRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxVQUFVO3dCQUNqQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNO3dCQUN6QixRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxVQUFVO3FCQUNsQyxDQUFDLENBQUM7aUJBQ0o7cUJBQU07b0JBQ0wsa0JBQVcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO2lCQUMzQzthQUNGOzs7Ozs7Ozs7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFyQ0Qsd0VBcUNDO0lBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUF1QjtRQUVsRCxPQUFRLElBQVksQ0FBQyxZQUFZLEtBQUssU0FBUyxDQUFDO0lBQ2xELENBQUM7SUFFRCxTQUFTLDJCQUEyQixDQUFDLElBQXVCO1FBQzFELE9BQVEsSUFBWSxDQUFDLFVBQVUsS0FBSyxTQUFTLENBQUM7SUFDaEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZVR5cGVNZXRhZGF0YSwgdG9rZW5SZWZlcmVuY2V9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0luamVjdEZsYWdzfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge3R5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7dW5zdXBwb3J0ZWR9IGZyb20gJy4vdmlldy91dGlsJztcblxuXG5cbi8qKlxuICogTWV0YWRhdGEgcmVxdWlyZWQgYnkgdGhlIGZhY3RvcnkgZ2VuZXJhdG9yIHRvIGdlbmVyYXRlIGEgYGZhY3RvcnlgIGZ1bmN0aW9uIGZvciBhIHR5cGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIC8qKlxuICAgKiBTdHJpbmcgbmFtZSBvZiB0aGUgdHlwZSBiZWluZyBnZW5lcmF0ZWQgKHVzZWQgdG8gbmFtZSB0aGUgZmFjdG9yeSBmdW5jdGlvbikuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBmdW5jdGlvbiAob3IgY29uc3RydWN0b3IpIHdoaWNoIHdpbGwgaW5zdGFudGlhdGUgdGhlIHJlcXVlc3RlZFxuICAgKiB0eXBlLlxuICAgKlxuICAgKiBUaGlzIGNvdWxkIGJlIGEgcmVmZXJlbmNlIHRvIGEgY29uc3RydWN0b3IgdHlwZSwgb3IgdG8gYSB1c2VyLWRlZmluZWQgZmFjdG9yeSBmdW5jdGlvbi4gVGhlXG4gICAqIGB1c2VOZXdgIHByb3BlcnR5IGRldGVybWluZXMgd2hldGhlciBpdCB3aWxsIGJlIGNhbGxlZCBhcyBhIGNvbnN0cnVjdG9yIG9yIG5vdC5cbiAgICovXG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKiogTnVtYmVyIG9mIGFyZ3VtZW50cyBmb3IgdGhlIGB0eXBlYC4gKi9cbiAgdHlwZUFyZ3VtZW50Q291bnQ6IG51bWJlcjtcblxuICAvKipcbiAgICogUmVnYXJkbGVzcyBvZiB3aGV0aGVyIGBmbk9yQ2xhc3NgIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gb3IgYSB1c2VyLWRlZmluZWQgZmFjdG9yeSwgaXRcbiAgICogbWF5IGhhdmUgMCBvciBtb3JlIHBhcmFtZXRlcnMsIHdoaWNoIHdpbGwgYmUgaW5qZWN0ZWQgYWNjb3JkaW5nIHRvIHRoZSBgUjNEZXBlbmRlbmN5TWV0YWRhdGFgXG4gICAqIGZvciB0aG9zZSBwYXJhbWV0ZXJzLiBJZiB0aGlzIGlzIGBudWxsYCwgdGhlbiB0aGUgdHlwZSdzIGNvbnN0cnVjdG9yIGlzIG5vbmV4aXN0ZW50IGFuZCB3aWxsXG4gICAqIGJlIGluaGVyaXRlZCBmcm9tIGBmbk9yQ2xhc3NgIHdoaWNoIGlzIGludGVycHJldGVkIGFzIHRoZSBjdXJyZW50IHR5cGUuIElmIHRoaXMgaXMgYCdpbnZhbGlkJ2AsXG4gICAqIHRoZW4gb25lIG9yIG1vcmUgb2YgdGhlIHBhcmFtZXRlcnMgd2Fzbid0IHJlc29sdmFibGUgYW5kIGFueSBhdHRlbXB0IHRvIHVzZSB0aGVzZSBkZXBzIHdpbGxcbiAgICogcmVzdWx0IGluIGEgcnVudGltZSBlcnJvci5cbiAgICovXG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118J2ludmFsaWQnfG51bGw7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gZm9yIHRoZSBmdW5jdGlvbiB3aGljaCB3aWxsIGJlIHVzZWQgdG8gaW5qZWN0IGRlcGVuZGVuY2llcy4gVGhlIEFQSSBvZiB0aGlzXG4gICAqIGZ1bmN0aW9uIGNvdWxkIGJlIGRpZmZlcmVudCwgYW5kIG90aGVyIG9wdGlvbnMgY29udHJvbCBob3cgaXQgd2lsbCBiZSBpbnZva2VkLlxuICAgKi9cbiAgaW5qZWN0Rm46IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLyoqXG4gICAqIFR5cGUgb2YgdGhlIHRhcmdldCBiZWluZyBjcmVhdGVkIGJ5IHRoZSBmYWN0b3J5LlxuICAgKi9cbiAgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQ7XG59XG5cbmV4cG9ydCBlbnVtIFIzRmFjdG9yeURlbGVnYXRlVHlwZSB7XG4gIENsYXNzLFxuICBGdW5jdGlvbixcbiAgRmFjdG9yeSxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0RlbGVnYXRlZEZhY3RvcnlNZXRhZGF0YSBleHRlbmRzIFIzQ29uc3RydWN0b3JGYWN0b3J5TWV0YWRhdGEge1xuICBkZWxlZ2F0ZTogby5FeHByZXNzaW9uO1xuICBkZWxlZ2F0ZVR5cGU6IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GYWN0b3J5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEgZXh0ZW5kcyBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHtcbiAgZGVsZWdhdGU6IG8uRXhwcmVzc2lvbjtcbiAgZGVsZWdhdGVUeXBlOiBSM0ZhY3RvcnlEZWxlZ2F0ZVR5cGUuQ2xhc3N8UjNGYWN0b3J5RGVsZWdhdGVUeXBlLkZ1bmN0aW9uO1xuICBkZWxlZ2F0ZURlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhIGV4dGVuZHMgUjNDb25zdHJ1Y3RvckZhY3RvcnlNZXRhZGF0YSB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IHR5cGUgUjNGYWN0b3J5TWV0YWRhdGEgPSBSM0NvbnN0cnVjdG9yRmFjdG9yeU1ldGFkYXRhIHwgUjNEZWxlZ2F0ZWRGYWN0b3J5TWV0YWRhdGEgfFxuICAgIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEgfCBSM0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGE7XG5cbmV4cG9ydCBlbnVtIFIzRmFjdG9yeVRhcmdldCB7XG4gIERpcmVjdGl2ZSA9IDAsXG4gIENvbXBvbmVudCA9IDEsXG4gIEluamVjdGFibGUgPSAyLFxuICBQaXBlID0gMyxcbiAgTmdNb2R1bGUgPSA0LFxufVxuXG4vKipcbiAqIFJlc29sdmVkIHR5cGUgb2YgYSBkZXBlbmRlbmN5LlxuICpcbiAqIE9jY2FzaW9uYWxseSwgZGVwZW5kZW5jaWVzIHdpbGwgaGF2ZSBzcGVjaWFsIHNpZ25pZmljYW5jZSB3aGljaCBpcyBrbm93biBzdGF0aWNhbGx5LiBJbiB0aGF0XG4gKiBjYXNlIHRoZSBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBpbmZvcm1zIHRoZSBmYWN0b3J5IGdlbmVyYXRvciB0aGF0IGEgcGFydGljdWxhciBkZXBlbmRlbmN5XG4gKiBzaG91bGQgYmUgZ2VuZXJhdGVkIHNwZWNpYWxseSAodXN1YWxseSBieSBjYWxsaW5nIGEgc3BlY2lhbCBpbmplY3Rpb24gZnVuY3Rpb24gaW5zdGVhZCBvZiB0aGVcbiAqIHN0YW5kYXJkIG9uZSkuXG4gKi9cbmV4cG9ydCBlbnVtIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSB7XG4gIC8qKlxuICAgKiBBIG5vcm1hbCB0b2tlbiBkZXBlbmRlbmN5LlxuICAgKi9cbiAgVG9rZW4gPSAwLFxuXG4gIC8qKlxuICAgKiBUaGUgZGVwZW5kZW5jeSBpcyBmb3IgYW4gYXR0cmlidXRlLlxuICAgKlxuICAgKiBUaGUgdG9rZW4gZXhwcmVzc2lvbiBpcyBhIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSBuYW1lLlxuICAgKi9cbiAgQXR0cmlidXRlID0gMSxcblxuICAvKipcbiAgICogSW5qZWN0aW5nIHRoZSBgQ2hhbmdlRGV0ZWN0b3JSZWZgIHRva2VuLiBOZWVkcyBzcGVjaWFsIGhhbmRsaW5nIHdoZW4gaW5qZWN0ZWQgaW50byBhIHBpcGUuXG4gICAqL1xuICBDaGFuZ2VEZXRlY3RvclJlZiA9IDIsXG59XG5cbi8qKlxuICogTWV0YWRhdGEgcmVwcmVzZW50aW5nIGEgc2luZ2xlIGRlcGVuZGVuY3kgdG8gYmUgaW5qZWN0ZWQgaW50byBhIGNvbnN0cnVjdG9yIG9yIGZ1bmN0aW9uIGNhbGwuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHRva2VuIG9yIHZhbHVlIHRvIGJlIGluamVjdGVkLlxuICAgKi9cbiAgdG9rZW46IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQW4gZW51bSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBkZXBlbmRlbmN5IGhhcyBzcGVjaWFsIG1lYW5pbmcgdG8gQW5ndWxhciBhbmQgbmVlZHMgdG8gYmVcbiAgICogaW5qZWN0ZWQgc3BlY2lhbGx5LlxuICAgKi9cbiAgcmVzb2x2ZWQ6IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQEhvc3QgcXVhbGlmaWVyLlxuICAgKi9cbiAgaG9zdDogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgZGVwZW5kZW5jeSBoYXMgYW4gQE9wdGlvbmFsIHF1YWxpZmllci5cbiAgICovXG4gIG9wdGlvbmFsOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2VsZiBxdWFsaWZpZXIuXG4gICAqL1xuICBzZWxmOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBkZXBlbmRlbmN5IGhhcyBhbiBAU2tpcFNlbGYgcXVhbGlmaWVyLlxuICAgKi9cbiAgc2tpcFNlbGY6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNGYWN0b3J5Rm4ge1xuICBmYWN0b3J5OiBvLkV4cHJlc3Npb247XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG4gIHR5cGU6IG8uRXhwcmVzc2lvblR5cGU7XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGEgZmFjdG9yeSBmdW5jdGlvbiBleHByZXNzaW9uIGZvciB0aGUgZ2l2ZW4gYFIzRmFjdG9yeU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24obWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBSM0ZhY3RvcnlGbiB7XG4gIGNvbnN0IHQgPSBvLnZhcmlhYmxlKCd0Jyk7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICAvLyBUaGUgdHlwZSB0byBpbnN0YW50aWF0ZSB2aWEgY29uc3RydWN0b3IgaW52b2NhdGlvbi4gSWYgdGhlcmUgaXMgbm8gZGVsZWdhdGVkIGZhY3RvcnksIG1lYW5pbmdcbiAgLy8gdGhpcyB0eXBlIGlzIGFsd2F5cyBjcmVhdGVkIGJ5IGNvbnN0cnVjdG9yIGludm9jYXRpb24sIHRoZW4gdGhpcyBpcyB0aGUgdHlwZS10by1jcmVhdGVcbiAgLy8gcGFyYW1ldGVyIHByb3ZpZGVkIGJ5IHRoZSB1c2VyICh0KSBpZiBzcGVjaWZpZWQsIG9yIHRoZSBjdXJyZW50IHR5cGUgaWYgbm90LiBJZiB0aGVyZSBpcyBhXG4gIC8vIGRlbGVnYXRlZCBmYWN0b3J5ICh3aGljaCBpcyB1c2VkIHRvIGNyZWF0ZSB0aGUgY3VycmVudCB0eXBlKSB0aGVuIHRoaXMgaXMgb25seSB0aGUgdHlwZS10by1cbiAgLy8gY3JlYXRlIHBhcmFtZXRlciAodCkuXG4gIGNvbnN0IHR5cGVGb3JDdG9yID1cbiAgICAgICFpc0RlbGVnYXRlZE1ldGFkYXRhKG1ldGEpID8gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKG8uQmluYXJ5T3BlcmF0b3IuT3IsIHQsIG1ldGEudHlwZSkgOiB0O1xuXG4gIGxldCBjdG9yRXhwcjogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICBpZiAobWV0YS5kZXBzICE9PSBudWxsKSB7XG4gICAgLy8gVGhlcmUgaXMgYSBjb25zdHJ1Y3RvciAoZWl0aGVyIGV4cGxpY2l0bHkgb3IgaW1wbGljaXRseSBkZWZpbmVkKS5cbiAgICBpZiAobWV0YS5kZXBzICE9PSAnaW52YWxpZCcpIHtcbiAgICAgIGN0b3JFeHByID0gbmV3IG8uSW5zdGFudGlhdGVFeHByKFxuICAgICAgICAgIHR5cGVGb3JDdG9yLFxuICAgICAgICAgIGluamVjdERlcGVuZGVuY2llcyhtZXRhLmRlcHMsIG1ldGEuaW5qZWN0Rm4sIG1ldGEudGFyZ2V0ID09PSBSM0ZhY3RvcnlUYXJnZXQuUGlwZSkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBiYXNlRmFjdG9yeSA9IG8udmFyaWFibGUoYMm1JHttZXRhLm5hbWV9X0Jhc2VGYWN0b3J5YCk7XG4gICAgY29uc3QgZ2V0SW5oZXJpdGVkRmFjdG9yeSA9IG8uaW1wb3J0RXhwcihSMy5nZXRJbmhlcml0ZWRGYWN0b3J5KTtcbiAgICBjb25zdCBiYXNlRmFjdG9yeVN0bXQgPVxuICAgICAgICBiYXNlRmFjdG9yeS5zZXQoZ2V0SW5oZXJpdGVkRmFjdG9yeS5jYWxsRm4oW21ldGEudHlwZV0pKS50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW1xuICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkLCBvLlN0bXRNb2RpZmllci5GaW5hbFxuICAgICAgICBdKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goYmFzZUZhY3RvcnlTdG10KTtcblxuICAgIC8vIFRoZXJlIGlzIG5vIGNvbnN0cnVjdG9yLCB1c2UgdGhlIGJhc2UgY2xhc3MnIGZhY3RvcnkgdG8gY29uc3RydWN0IHR5cGVGb3JDdG9yLlxuICAgIGN0b3JFeHByID0gYmFzZUZhY3RvcnkuY2FsbEZuKFt0eXBlRm9yQ3Rvcl0pO1xuICB9XG4gIGNvbnN0IGN0b3JFeHByRmluYWwgPSBjdG9yRXhwcjtcblxuICBjb25zdCBib2R5OiBvLlN0YXRlbWVudFtdID0gW107XG4gIGxldCByZXRFeHByOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgZnVuY3Rpb24gbWFrZUNvbmRpdGlvbmFsRmFjdG9yeShub25DdG9yRXhwcjogby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgciA9IG8udmFyaWFibGUoJ3InKTtcbiAgICBib2R5LnB1c2goci5zZXQoby5OVUxMX0VYUFIpLnRvRGVjbFN0bXQoKSk7XG4gICAgbGV0IGN0b3JTdG10OiBvLlN0YXRlbWVudHxudWxsID0gbnVsbDtcbiAgICBpZiAoY3RvckV4cHJGaW5hbCAhPT0gbnVsbCkge1xuICAgICAgY3RvclN0bXQgPSByLnNldChjdG9yRXhwckZpbmFsKS50b1N0bXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3RvclN0bXQgPSBvLmltcG9ydEV4cHIoUjMuaW52YWxpZEZhY3RvcnkpLmNhbGxGbihbXSkudG9TdG10KCk7XG4gICAgfVxuICAgIGJvZHkucHVzaChvLmlmU3RtdCh0LCBbY3RvclN0bXRdLCBbci5zZXQobm9uQ3RvckV4cHIpLnRvU3RtdCgpXSkpO1xuICAgIHJldHVybiByO1xuICB9XG5cbiAgaWYgKGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YSkgJiYgbWV0YS5kZWxlZ2F0ZVR5cGUgPT09IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5GYWN0b3J5KSB7XG4gICAgY29uc3QgZGVsZWdhdGVGYWN0b3J5ID0gby52YXJpYWJsZShgybUke21ldGEubmFtZX1fQmFzZUZhY3RvcnlgKTtcbiAgICBjb25zdCBnZXRGYWN0b3J5T2YgPSBvLmltcG9ydEV4cHIoUjMuZ2V0RmFjdG9yeU9mKTtcbiAgICBpZiAobWV0YS5kZWxlZ2F0ZS5pc0VxdWl2YWxlbnQobWV0YS50eXBlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIHN0YXRlOiBjb21waWxpbmcgZmFjdG9yeSB0aGF0IGRlbGVnYXRlcyB0byBpdHNlbGZgKTtcbiAgICB9XG4gICAgY29uc3QgZGVsZWdhdGVGYWN0b3J5U3RtdCA9XG4gICAgICAgIGRlbGVnYXRlRmFjdG9yeS5zZXQoZ2V0RmFjdG9yeU9mLmNhbGxGbihbbWV0YS5kZWxlZ2F0ZV0pKS50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW1xuICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkLCBvLlN0bXRNb2RpZmllci5GaW5hbFxuICAgICAgICBdKTtcblxuICAgIHN0YXRlbWVudHMucHVzaChkZWxlZ2F0ZUZhY3RvcnlTdG10KTtcbiAgICByZXRFeHByID0gbWFrZUNvbmRpdGlvbmFsRmFjdG9yeShkZWxlZ2F0ZUZhY3RvcnkuY2FsbEZuKFtdKSk7XG4gIH0gZWxzZSBpZiAoaXNEZWxlZ2F0ZWRNZXRhZGF0YShtZXRhKSkge1xuICAgIC8vIFRoaXMgdHlwZSBpcyBjcmVhdGVkIHdpdGggYSBkZWxlZ2F0ZWQgZmFjdG9yeS4gSWYgYSB0eXBlIHBhcmFtZXRlciBpcyBub3Qgc3BlY2lmaWVkLCBjYWxsXG4gICAgLy8gdGhlIGZhY3RvcnkgaW5zdGVhZC5cbiAgICBjb25zdCBkZWxlZ2F0ZUFyZ3MgPVxuICAgICAgICBpbmplY3REZXBlbmRlbmNpZXMobWV0YS5kZWxlZ2F0ZURlcHMsIG1ldGEuaW5qZWN0Rm4sIG1ldGEudGFyZ2V0ID09PSBSM0ZhY3RvcnlUYXJnZXQuUGlwZSk7XG4gICAgLy8gRWl0aGVyIGNhbGwgYG5ldyBkZWxlZ2F0ZSguLi4pYCBvciBgZGVsZWdhdGUoLi4uKWAgZGVwZW5kaW5nIG9uIG1ldGEuZGVsZWdhdGVUeXBlLlxuICAgIGNvbnN0IGZhY3RvcnlFeHByID0gbmV3IChcbiAgICAgICAgbWV0YS5kZWxlZ2F0ZVR5cGUgPT09IFIzRmFjdG9yeURlbGVnYXRlVHlwZS5DbGFzcyA/XG4gICAgICAgICAgICBvLkluc3RhbnRpYXRlRXhwciA6XG4gICAgICAgICAgICBvLkludm9rZUZ1bmN0aW9uRXhwcikobWV0YS5kZWxlZ2F0ZSwgZGVsZWdhdGVBcmdzKTtcbiAgICByZXRFeHByID0gbWFrZUNvbmRpdGlvbmFsRmFjdG9yeShmYWN0b3J5RXhwcik7XG4gIH0gZWxzZSBpZiAoaXNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhKG1ldGEpKSB7XG4gICAgLy8gVE9ETyhhbHhodWIpOiBkZWNpZGUgd2hldGhlciB0byBsb3dlciB0aGUgdmFsdWUgaGVyZSBvciBpbiB0aGUgY2FsbGVyXG4gICAgcmV0RXhwciA9IG1ha2VDb25kaXRpb25hbEZhY3RvcnkobWV0YS5leHByZXNzaW9uKTtcbiAgfSBlbHNlIHtcbiAgICByZXRFeHByID0gY3RvckV4cHI7XG4gIH1cblxuICBpZiAocmV0RXhwciAhPT0gbnVsbCkge1xuICAgIGJvZHkucHVzaChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0RXhwcikpO1xuICB9IGVsc2Uge1xuICAgIGJvZHkucHVzaChvLmltcG9ydEV4cHIoUjMuaW52YWxpZEZhY3RvcnkpLmNhbGxGbihbXSkudG9TdG10KCkpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBmYWN0b3J5OiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbSgndCcsIG8uRFlOQU1JQ19UWVBFKV0sIGJvZHksIG8uSU5GRVJSRURfVFlQRSwgdW5kZWZpbmVkLFxuICAgICAgICBgJHttZXRhLm5hbWV9X0ZhY3RvcnlgKSxcbiAgICBzdGF0ZW1lbnRzLFxuICAgIHR5cGU6IG8uZXhwcmVzc2lvblR5cGUoXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5GYWN0b3J5RGVmLCBbdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCldKSlcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5qZWN0RGVwZW5kZW5jaWVzKFxuICAgIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW10sIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc1BpcGU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHJldHVybiBkZXBzLm1hcChkZXAgPT4gY29tcGlsZUluamVjdERlcGVuZGVuY3koZGVwLCBpbmplY3RGbiwgaXNQaXBlKSk7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVJbmplY3REZXBlbmRlbmN5KFxuICAgIGRlcDogUjNEZXBlbmRlbmN5TWV0YWRhdGEsIGluamVjdEZuOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc1BpcGU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICAvLyBJbnRlcnByZXQgdGhlIGRlcGVuZGVuY3kgYWNjb3JkaW5nIHRvIGl0cyByZXNvbHZlZCB0eXBlLlxuICBzd2l0Y2ggKGRlcC5yZXNvbHZlZCkge1xuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuOlxuICAgIGNhc2UgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkNoYW5nZURldGVjdG9yUmVmOlxuICAgICAgLy8gQnVpbGQgdXAgdGhlIGluamVjdGlvbiBmbGFncyBhY2NvcmRpbmcgdG8gdGhlIG1ldGFkYXRhLlxuICAgICAgY29uc3QgZmxhZ3MgPSBJbmplY3RGbGFncy5EZWZhdWx0IHwgKGRlcC5zZWxmID8gSW5qZWN0RmxhZ3MuU2VsZiA6IDApIHxcbiAgICAgICAgICAoZGVwLnNraXBTZWxmID8gSW5qZWN0RmxhZ3MuU2tpcFNlbGYgOiAwKSB8IChkZXAuaG9zdCA/IEluamVjdEZsYWdzLkhvc3QgOiAwKSB8XG4gICAgICAgICAgKGRlcC5vcHRpb25hbCA/IEluamVjdEZsYWdzLk9wdGlvbmFsIDogMCk7XG5cbiAgICAgIC8vIElmIHRoaXMgZGVwZW5kZW5jeSBpcyBvcHRpb25hbCBvciBvdGhlcndpc2UgaGFzIG5vbi1kZWZhdWx0IGZsYWdzLCB0aGVuIGFkZGl0aW9uYWxcbiAgICAgIC8vIHBhcmFtZXRlcnMgZGVzY3JpYmluZyBob3cgdG8gaW5qZWN0IHRoZSBkZXBlbmRlbmN5IG11c3QgYmUgcGFzc2VkIHRvIHRoZSBpbmplY3QgZnVuY3Rpb25cbiAgICAgIC8vIHRoYXQncyBiZWluZyB1c2VkLlxuICAgICAgbGV0IGZsYWdzUGFyYW06IG8uTGl0ZXJhbEV4cHJ8bnVsbCA9XG4gICAgICAgICAgKGZsYWdzICE9PSBJbmplY3RGbGFncy5EZWZhdWx0IHx8IGRlcC5vcHRpb25hbCkgPyBvLmxpdGVyYWwoZmxhZ3MpIDogbnVsbDtcblxuICAgICAgLy8gV2UgaGF2ZSBhIHNlcGFyYXRlIGluc3RydWN0aW9uIGZvciBpbmplY3RpbmcgQ2hhbmdlRGV0ZWN0b3JSZWYgaW50byBhIHBpcGUuXG4gICAgICBpZiAoaXNQaXBlICYmIGRlcC5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkNoYW5nZURldGVjdG9yUmVmKSB7XG4gICAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW5qZWN0UGlwZUNoYW5nZURldGVjdG9yUmVmKS5jYWxsRm4oZmxhZ3NQYXJhbSA/IFtmbGFnc1BhcmFtXSA6IFtdKTtcbiAgICAgIH1cblxuICAgICAgLy8gQnVpbGQgdXAgdGhlIGFyZ3VtZW50cyB0byB0aGUgaW5qZWN0Rm4gY2FsbC5cbiAgICAgIGNvbnN0IGluamVjdEFyZ3MgPSBbZGVwLnRva2VuXTtcbiAgICAgIGlmIChmbGFnc1BhcmFtKSB7XG4gICAgICAgIGluamVjdEFyZ3MucHVzaChmbGFnc1BhcmFtKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoaW5qZWN0Rm4pLmNhbGxGbihpbmplY3RBcmdzKTtcbiAgICBjYXNlIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5BdHRyaWJ1dGU6XG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBhdHRyaWJ1dGVzLCB0aGUgYXR0cmlidXRlIG5hbWUgaW4gcXVlc3Rpb24gaXMgZ2l2ZW4gYXMgdGhlIHRva2VuLlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbmplY3RBdHRyaWJ1dGUpLmNhbGxGbihbZGVwLnRva2VuXSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bnN1cHBvcnRlZChcbiAgICAgICAgICBgVW5rbm93biBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGU6ICR7UjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlW2RlcC5yZXNvbHZlZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGhlbHBlciBmdW5jdGlvbiB1c2VmdWwgZm9yIGV4dHJhY3RpbmcgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmcm9tIGEgUmVuZGVyMlxuICogYENvbXBpbGVUeXBlTWV0YWRhdGFgIGluc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdIHtcbiAgLy8gVXNlIHRoZSBgQ29tcGlsZVJlZmxlY3RvcmAgdG8gbG9vayB1cCByZWZlcmVuY2VzIHRvIHNvbWUgd2VsbC1rbm93biBBbmd1bGFyIHR5cGVzLiBUaGVzZSB3aWxsXG4gIC8vIGJlIGNvbXBhcmVkIHdpdGggdGhlIHRva2VuIHRvIHN0YXRpY2FsbHkgZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHRva2VuIGhhcyBzaWduaWZpY2FuY2UgdG9cbiAgLy8gQW5ndWxhciwgYW5kIHNldCB0aGUgY29ycmVjdCBgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlYCBhcyBhIHJlc3VsdC5cbiAgY29uc3QgaW5qZWN0b3JSZWYgPSByZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkluamVjdG9yKTtcblxuICAvLyBJdGVyYXRlIHRocm91Z2ggdGhlIHR5cGUncyBESSBkZXBlbmRlbmNpZXMgYW5kIHByb2R1Y2UgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBmb3IgZWFjaCBvZiB0aGVtLlxuICBjb25zdCBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdID0gW107XG4gIGZvciAobGV0IGRlcGVuZGVuY3kgb2YgdHlwZS5kaURlcHMpIHtcbiAgICBpZiAoZGVwZW5kZW5jeS50b2tlbikge1xuICAgICAgY29uc3QgdG9rZW5SZWYgPSB0b2tlblJlZmVyZW5jZShkZXBlbmRlbmN5LnRva2VuKTtcbiAgICAgIGxldCByZXNvbHZlZDogUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlID0gZGVwZW5kZW5jeS5pc0F0dHJpYnV0ZSA/XG4gICAgICAgICAgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSA6XG4gICAgICAgICAgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLlRva2VuO1xuXG4gICAgICAvLyBJbiB0aGUgY2FzZSBvZiBtb3N0IGRlcGVuZGVuY2llcywgdGhlIHRva2VuIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8gYSB0eXBlLiBTb21ldGltZXMsXG4gICAgICAvLyBob3dldmVyLCBpdCBjYW4gYmUgYSBzdHJpbmcsIGluIHRoZSBjYXNlIG9mIG9sZGVyIEFuZ3VsYXIgY29kZSBvciBAQXR0cmlidXRlIGluamVjdGlvbi5cbiAgICAgIGNvbnN0IHRva2VuID1cbiAgICAgICAgICB0b2tlblJlZiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCA/IG91dHB1dEN0eC5pbXBvcnRFeHByKHRva2VuUmVmKSA6IG8ubGl0ZXJhbCh0b2tlblJlZik7XG5cbiAgICAgIC8vIENvbnN0cnVjdCB0aGUgZGVwZW5kZW5jeS5cbiAgICAgIGRlcHMucHVzaCh7XG4gICAgICAgIHRva2VuLFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgaG9zdDogISFkZXBlbmRlbmN5LmlzSG9zdCxcbiAgICAgICAgb3B0aW9uYWw6ICEhZGVwZW5kZW5jeS5pc09wdGlvbmFsLFxuICAgICAgICBzZWxmOiAhIWRlcGVuZGVuY3kuaXNTZWxmLFxuICAgICAgICBza2lwU2VsZjogISFkZXBlbmRlbmN5LmlzU2tpcFNlbGYsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdW5zdXBwb3J0ZWQoJ2RlcGVuZGVuY3kgd2l0aG91dCBhIHRva2VuJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlcHM7XG59XG5cbmZ1bmN0aW9uIGlzRGVsZWdhdGVkTWV0YWRhdGEobWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBtZXRhIGlzIFIzRGVsZWdhdGVkRmFjdG9yeU1ldGFkYXRhfFxuICAgIFIzRGVsZWdhdGVkRm5PckNsYXNzTWV0YWRhdGEge1xuICByZXR1cm4gKG1ldGEgYXMgYW55KS5kZWxlZ2F0ZVR5cGUgIT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNFeHByZXNzaW9uRmFjdG9yeU1ldGFkYXRhKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTogbWV0YSBpcyBSM0V4cHJlc3Npb25GYWN0b3J5TWV0YWRhdGEge1xuICByZXR1cm4gKG1ldGEgYXMgYW55KS5leHByZXNzaW9uICE9PSB1bmRlZmluZWQ7XG59XG4iXX0=