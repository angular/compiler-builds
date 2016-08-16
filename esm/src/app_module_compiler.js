/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Injectable } from '@angular/core';
import { CompileDiDependencyMetadata, CompileIdentifierMetadata, CompileTokenMap } from './compile_metadata';
import { isBlank, isPresent } from './facade/lang';
import { Identifiers, identifierToken } from './identifiers';
import * as o from './output/output_ast';
import { convertValueToOutputAst } from './output/value_util';
import { ParseLocation, ParseSourceFile, ParseSourceSpan } from './parse_util';
import { AppModuleProviderParser } from './provider_parser';
import { createDiTokenExpression } from './util';
export class ComponentFactoryDependency {
    constructor(comp, placeholder) {
        this.comp = comp;
        this.placeholder = placeholder;
    }
}
export class AppModuleCompileResult {
    constructor(statements, appModuleFactoryVar, dependencies) {
        this.statements = statements;
        this.appModuleFactoryVar = appModuleFactoryVar;
        this.dependencies = dependencies;
    }
}
export class AppModuleCompiler {
    compile(appModuleMeta) {
        var sourceFileName = isPresent(appModuleMeta.type.moduleUrl) ?
            `in AppModule ${appModuleMeta.type.name} in ${appModuleMeta.type.moduleUrl}` :
            `in AppModule ${appModuleMeta.type.name}`;
        var sourceFile = new ParseSourceFile('', sourceFileName);
        var sourceSpan = new ParseSourceSpan(new ParseLocation(sourceFile, null, null, null), new ParseLocation(sourceFile, null, null, null));
        var deps = [];
        var precompileComponents = appModuleMeta.precompile.map((precompileComp) => {
            var id = new CompileIdentifierMetadata({ name: precompileComp.name });
            deps.push(new ComponentFactoryDependency(precompileComp, id));
            return id;
        });
        var builder = new _InjectorBuilder(appModuleMeta, precompileComponents, sourceSpan);
        var providerParser = new AppModuleProviderParser(appModuleMeta, sourceSpan);
        providerParser.parse().forEach((provider) => builder.addProvider(provider));
        var injectorClass = builder.build();
        var appModuleFactoryVar = `${appModuleMeta.type.name}NgFactory`;
        var appModuleFactoryStmt = o.variable(appModuleFactoryVar)
            .set(o.importExpr(Identifiers.AppModuleFactory)
            .instantiate([o.variable(injectorClass.name), o.importExpr(appModuleMeta.type)], o.importType(Identifiers.AppModuleFactory, [o.importType(appModuleMeta.type)], [o.TypeModifier.Const])))
            .toDeclStmt(null, [o.StmtModifier.Final]);
        return new AppModuleCompileResult([injectorClass, appModuleFactoryStmt], appModuleFactoryVar, deps);
    }
}
/** @nocollapse */
AppModuleCompiler.decorators = [
    { type: Injectable },
];
class _InjectorBuilder {
    constructor(_appModuleMeta, _precompileComponents, _sourceSpan) {
        this._appModuleMeta = _appModuleMeta;
        this._precompileComponents = _precompileComponents;
        this._sourceSpan = _sourceSpan;
        this._instances = new CompileTokenMap();
        this._fields = [];
        this._createStmts = [];
        this._getters = [];
    }
    addProvider(resolvedProvider) {
        var providerValueExpressions = resolvedProvider.providers.map((provider) => this._getProviderValue(provider));
        var propName = `_${resolvedProvider.token.name}_${this._instances.size}`;
        var instance = this._createProviderProperty(propName, resolvedProvider, providerValueExpressions, resolvedProvider.multiProvider, resolvedProvider.eager);
        this._instances.add(resolvedProvider.token, instance);
    }
    build() {
        let getMethodStmts = this._instances.keys().map((token) => {
            var providerExpr = this._instances.get(token);
            return new o.IfStmt(InjectMethodVars.token.identical(createDiTokenExpression(token)), [new o.ReturnStatement(providerExpr)]);
        });
        var methods = [
            new o.ClassMethod('createInternal', [], this._createStmts.concat(new o.ReturnStatement(this._instances.get(identifierToken(this._appModuleMeta.type)))), o.importType(this._appModuleMeta.type)),
            new o.ClassMethod('getInternal', [
                new o.FnParam(InjectMethodVars.token.name, o.DYNAMIC_TYPE),
                new o.FnParam(InjectMethodVars.notFoundResult.name, o.DYNAMIC_TYPE)
            ], getMethodStmts.concat([new o.ReturnStatement(InjectMethodVars.notFoundResult)]), o.DYNAMIC_TYPE)
        ];
        var ctor = new o.ClassMethod(null, [new o.FnParam(InjectorProps.parent.name, o.importType(Identifiers.Injector))], [o.SUPER_EXPR
                .callFn([
                o.variable(InjectorProps.parent.name),
                o.literalArr(this._precompileComponents.map((precompiledComponent) => o.importExpr(precompiledComponent)))
            ])
                .toStmt()]);
        var injClassName = `${this._appModuleMeta.type.name}Injector`;
        return new o.ClassStmt(injClassName, o.importExpr(Identifiers.AppModuleInjector, [o.importType(this._appModuleMeta.type)]), this._fields, this._getters, ctor, methods);
    }
    _getProviderValue(provider) {
        var result;
        if (isPresent(provider.useExisting)) {
            result = this._getDependency(new CompileDiDependencyMetadata({ token: provider.useExisting }));
        }
        else if (isPresent(provider.useFactory)) {
            var deps = isPresent(provider.deps) ? provider.deps : provider.useFactory.diDeps;
            var depsExpr = deps.map((dep) => this._getDependency(dep));
            result = o.importExpr(provider.useFactory).callFn(depsExpr);
        }
        else if (isPresent(provider.useClass)) {
            var deps = isPresent(provider.deps) ? provider.deps : provider.useClass.diDeps;
            var depsExpr = deps.map((dep) => this._getDependency(dep));
            result =
                o.importExpr(provider.useClass).instantiate(depsExpr, o.importType(provider.useClass));
        }
        else {
            result = convertValueToOutputAst(provider.useValue);
        }
        return result;
    }
    _createProviderProperty(propName, provider, providerValueExpressions, isMulti, isEager) {
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
        if (isBlank(type)) {
            type = o.DYNAMIC_TYPE;
        }
        if (isEager) {
            this._fields.push(new o.ClassField(propName, type));
            this._createStmts.push(o.THIS_EXPR.prop(propName).set(resolvedProviderValueExpr).toStmt());
        }
        else {
            var internalField = `_${propName}`;
            this._fields.push(new o.ClassField(internalField, type));
            // Note: Equals is important for JS so that it also checks the undefined case!
            var getterStmts = [
                new o.IfStmt(o.THIS_EXPR.prop(internalField).isBlank(), [o.THIS_EXPR.prop(internalField).set(resolvedProviderValueExpr).toStmt()]),
                new o.ReturnStatement(o.THIS_EXPR.prop(internalField))
            ];
            this._getters.push(new o.ClassGetter(propName, getterStmts, type));
        }
        return o.THIS_EXPR.prop(propName);
    }
    _getDependency(dep) {
        var result = null;
        if (dep.isValue) {
            result = o.literal(dep.value);
        }
        if (!dep.isSkipSelf) {
            if (dep.token &&
                (dep.token.equalsTo(identifierToken(Identifiers.Injector)) ||
                    dep.token.equalsTo(identifierToken(Identifiers.ComponentFactoryResolver)))) {
                result = o.THIS_EXPR;
            }
            if (isBlank(result)) {
                result = this._instances.get(dep.token);
            }
        }
        if (isBlank(result)) {
            var args = [createDiTokenExpression(dep.token)];
            if (dep.isOptional) {
                args.push(o.NULL_EXPR);
            }
            result = InjectorProps.parent.callMethod('get', args);
        }
        return result;
    }
}
class InjectorProps {
}
InjectorProps.parent = o.THIS_EXPR.prop('parent');
class InjectMethodVars {
}
InjectMethodVars.token = o.variable('token');
InjectMethodVars.notFoundResult = o.variable('notFoundResult');
//# sourceMappingURL=app_module_compiler.js.map