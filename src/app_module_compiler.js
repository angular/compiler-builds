/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var compile_metadata_1 = require('./compile_metadata');
var lang_1 = require('./facade/lang');
var identifiers_1 = require('./identifiers');
var o = require('./output/output_ast');
var value_util_1 = require('./output/value_util');
var parse_util_1 = require('./parse_util');
var provider_parser_1 = require('./provider_parser');
var util_1 = require('./util');
var ComponentFactoryDependency = (function () {
    function ComponentFactoryDependency(comp, placeholder) {
        this.comp = comp;
        this.placeholder = placeholder;
    }
    return ComponentFactoryDependency;
}());
exports.ComponentFactoryDependency = ComponentFactoryDependency;
var AppModuleCompileResult = (function () {
    function AppModuleCompileResult(statements, appModuleFactoryVar, dependencies) {
        this.statements = statements;
        this.appModuleFactoryVar = appModuleFactoryVar;
        this.dependencies = dependencies;
    }
    return AppModuleCompileResult;
}());
exports.AppModuleCompileResult = AppModuleCompileResult;
var AppModuleCompiler = (function () {
    function AppModuleCompiler() {
    }
    AppModuleCompiler.prototype.compile = function (appModuleMeta) {
        var sourceFileName = lang_1.isPresent(appModuleMeta.type.moduleUrl) ?
            "in AppModule " + appModuleMeta.type.name + " in " + appModuleMeta.type.moduleUrl :
            "in AppModule " + appModuleMeta.type.name;
        var sourceFile = new parse_util_1.ParseSourceFile('', sourceFileName);
        var sourceSpan = new parse_util_1.ParseSourceSpan(new parse_util_1.ParseLocation(sourceFile, null, null, null), new parse_util_1.ParseLocation(sourceFile, null, null, null));
        var deps = [];
        var precompileComponents = appModuleMeta.precompile.map(function (precompileComp) {
            var id = new compile_metadata_1.CompileIdentifierMetadata({ name: precompileComp.name });
            deps.push(new ComponentFactoryDependency(precompileComp, id));
            return id;
        });
        var builder = new _InjectorBuilder(appModuleMeta, precompileComponents, sourceSpan);
        var providerParser = new provider_parser_1.AppModuleProviderParser(appModuleMeta, sourceSpan);
        providerParser.parse().forEach(function (provider) { return builder.addProvider(provider); });
        var injectorClass = builder.build();
        var appModuleFactoryVar = appModuleMeta.type.name + "NgFactory";
        var appModuleFactoryStmt = o.variable(appModuleFactoryVar)
            .set(o.importExpr(identifiers_1.Identifiers.AppModuleFactory)
            .instantiate([o.variable(injectorClass.name), o.importExpr(appModuleMeta.type)], o.importType(identifiers_1.Identifiers.AppModuleFactory, [o.importType(appModuleMeta.type)], [o.TypeModifier.Const])))
            .toDeclStmt(null, [o.StmtModifier.Final]);
        return new AppModuleCompileResult([injectorClass, appModuleFactoryStmt], appModuleFactoryVar, deps);
    };
    /** @nocollapse */
    AppModuleCompiler.decorators = [
        { type: core_1.Injectable },
    ];
    return AppModuleCompiler;
}());
exports.AppModuleCompiler = AppModuleCompiler;
var _InjectorBuilder = (function () {
    function _InjectorBuilder(_appModuleMeta, _precompileComponents, _sourceSpan) {
        this._appModuleMeta = _appModuleMeta;
        this._precompileComponents = _precompileComponents;
        this._sourceSpan = _sourceSpan;
        this._instances = new compile_metadata_1.CompileTokenMap();
        this._fields = [];
        this._createStmts = [];
        this._getters = [];
    }
    _InjectorBuilder.prototype.addProvider = function (resolvedProvider) {
        var _this = this;
        var providerValueExpressions = resolvedProvider.providers.map(function (provider) { return _this._getProviderValue(provider); });
        var propName = "_" + resolvedProvider.token.name + "_" + this._instances.size;
        var instance = this._createProviderProperty(propName, resolvedProvider, providerValueExpressions, resolvedProvider.multiProvider, resolvedProvider.eager);
        this._instances.add(resolvedProvider.token, instance);
    };
    _InjectorBuilder.prototype.build = function () {
        var _this = this;
        var getMethodStmts = this._instances.keys().map(function (token) {
            var providerExpr = _this._instances.get(token);
            return new o.IfStmt(InjectMethodVars.token.identical(util_1.createDiTokenExpression(token)), [new o.ReturnStatement(providerExpr)]);
        });
        var methods = [
            new o.ClassMethod('createInternal', [], this._createStmts.concat(new o.ReturnStatement(this._instances.get(identifiers_1.identifierToken(this._appModuleMeta.type)))), o.importType(this._appModuleMeta.type)),
            new o.ClassMethod('getInternal', [
                new o.FnParam(InjectMethodVars.token.name, o.DYNAMIC_TYPE),
                new o.FnParam(InjectMethodVars.notFoundResult.name, o.DYNAMIC_TYPE)
            ], getMethodStmts.concat([new o.ReturnStatement(InjectMethodVars.notFoundResult)]), o.DYNAMIC_TYPE)
        ];
        var ctor = new o.ClassMethod(null, [new o.FnParam(InjectorProps.parent.name, o.importType(identifiers_1.Identifiers.Injector))], [o.SUPER_EXPR
                .callFn([
                o.variable(InjectorProps.parent.name),
                o.literalArr(this._precompileComponents.map(function (precompiledComponent) { return o.importExpr(precompiledComponent); }))
            ])
                .toStmt()]);
        var injClassName = this._appModuleMeta.type.name + "Injector";
        return new o.ClassStmt(injClassName, o.importExpr(identifiers_1.Identifiers.AppModuleInjector, [o.importType(this._appModuleMeta.type)]), this._fields, this._getters, ctor, methods);
    };
    _InjectorBuilder.prototype._getProviderValue = function (provider) {
        var _this = this;
        var result;
        if (lang_1.isPresent(provider.useExisting)) {
            result = this._getDependency(new compile_metadata_1.CompileDiDependencyMetadata({ token: provider.useExisting }));
        }
        else if (lang_1.isPresent(provider.useFactory)) {
            var deps = lang_1.isPresent(provider.deps) ? provider.deps : provider.useFactory.diDeps;
            var depsExpr = deps.map(function (dep) { return _this._getDependency(dep); });
            result = o.importExpr(provider.useFactory).callFn(depsExpr);
        }
        else if (lang_1.isPresent(provider.useClass)) {
            var deps = lang_1.isPresent(provider.deps) ? provider.deps : provider.useClass.diDeps;
            var depsExpr = deps.map(function (dep) { return _this._getDependency(dep); });
            result =
                o.importExpr(provider.useClass).instantiate(depsExpr, o.importType(provider.useClass));
        }
        else {
            result = value_util_1.convertValueToOutputAst(provider.useValue);
        }
        return result;
    };
    _InjectorBuilder.prototype._createProviderProperty = function (propName, provider, providerValueExpressions, isMulti, isEager) {
        var resolvedProviderValueExpr;
        var type;
        if (isMulti) {
            resolvedProviderValueExpr = o.literalArr(providerValueExpressions);
            type = new o.ArrayType(o.DYNAMIC_TYPE);
        }
        else {
            resolvedProviderValueExpr = providerValueExpressions[0];
            type = providerValueExpressions[0].type;
        }
        if (lang_1.isBlank(type)) {
            type = o.DYNAMIC_TYPE;
        }
        if (isEager) {
            this._fields.push(new o.ClassField(propName, type));
            this._createStmts.push(o.THIS_EXPR.prop(propName).set(resolvedProviderValueExpr).toStmt());
        }
        else {
            var internalField = "_" + propName;
            this._fields.push(new o.ClassField(internalField, type));
            // Note: Equals is important for JS so that it also checks the undefined case!
            var getterStmts = [
                new o.IfStmt(o.THIS_EXPR.prop(internalField).isBlank(), [o.THIS_EXPR.prop(internalField).set(resolvedProviderValueExpr).toStmt()]),
                new o.ReturnStatement(o.THIS_EXPR.prop(internalField))
            ];
            this._getters.push(new o.ClassGetter(propName, getterStmts, type));
        }
        return o.THIS_EXPR.prop(propName);
    };
    _InjectorBuilder.prototype._getDependency = function (dep) {
        var result = null;
        if (dep.isValue) {
            result = o.literal(dep.value);
        }
        if (!dep.isSkipSelf) {
            if (dep.token &&
                (dep.token.equalsTo(identifiers_1.identifierToken(identifiers_1.Identifiers.Injector)) ||
                    dep.token.equalsTo(identifiers_1.identifierToken(identifiers_1.Identifiers.ComponentFactoryResolver)))) {
                result = o.THIS_EXPR;
            }
            if (lang_1.isBlank(result)) {
                result = this._instances.get(dep.token);
            }
        }
        if (lang_1.isBlank(result)) {
            var args = [util_1.createDiTokenExpression(dep.token)];
            if (dep.isOptional) {
                args.push(o.NULL_EXPR);
            }
            result = InjectorProps.parent.callMethod('get', args);
        }
        return result;
    };
    return _InjectorBuilder;
}());
var InjectorProps = (function () {
    function InjectorProps() {
    }
    InjectorProps.parent = o.THIS_EXPR.prop('parent');
    return InjectorProps;
}());
var InjectMethodVars = (function () {
    function InjectMethodVars() {
    }
    InjectMethodVars.token = o.variable('token');
    InjectMethodVars.notFoundResult = o.variable('notFoundResult');
    return InjectMethodVars;
}());
//# sourceMappingURL=app_module_compiler.js.map