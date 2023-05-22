/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ConstantPool } from './constant_pool';
import { ChangeDetectionStrategy, ViewEncapsulation } from './core';
import { compileInjectable } from './injectable_compiler_2';
import { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from './ml_parser/interpolation_config';
import { DeclareVarStmt, literal, LiteralExpr, StmtModifier, WrappedNodeExpr } from './output/output_ast';
import { JitEvaluator } from './output/output_jit';
import { r3JitTypeSourceSpan } from './parse_util';
import { compileFactoryFunction, FactoryTarget } from './render3/r3_factory';
import { compileInjector } from './render3/r3_injector_compiler';
import { R3JitReflector } from './render3/r3_jit';
import { compileNgModule, compileNgModuleDeclarationExpression, R3SelectorScopeMode } from './render3/r3_module_compiler';
import { compilePipeFromMetadata } from './render3/r3_pipe_compiler';
import { createMayBeForwardRefExpression, getSafePropertyAccessString, wrapReference } from './render3/util';
import { R3TemplateDependencyKind } from './render3/view/api';
import { compileComponentFromMetadata, compileDirectiveFromMetadata, parseHostBindings, verifyHostBindings } from './render3/view/compiler';
import { makeBindingParser, parseTemplate } from './render3/view/template';
import { ResourceLoader } from './resource_loader';
import { DomElementSchemaRegistry } from './schema/dom_element_schema_registry';
export class CompilerFacadeImpl {
    constructor(jitEvaluator = new JitEvaluator()) {
        this.jitEvaluator = jitEvaluator;
        this.FactoryTarget = FactoryTarget;
        this.ResourceLoader = ResourceLoader;
        this.elementSchemaRegistry = new DomElementSchemaRegistry();
    }
    compilePipe(angularCoreEnv, sourceMapUrl, facade) {
        const metadata = {
            name: facade.name,
            type: wrapReference(facade.type),
            typeArgumentCount: 0,
            deps: null,
            pipeName: facade.pipeName,
            pure: facade.pure,
            isStandalone: facade.isStandalone,
        };
        const res = compilePipeFromMetadata(metadata);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    }
    compilePipeDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
        const meta = convertDeclarePipeFacadeToMetadata(declaration);
        const res = compilePipeFromMetadata(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    }
    compileInjectable(angularCoreEnv, sourceMapUrl, facade) {
        const { expression, statements } = compileInjectable({
            name: facade.name,
            type: wrapReference(facade.type),
            typeArgumentCount: facade.typeArgumentCount,
            providedIn: computeProvidedIn(facade.providedIn),
            useClass: convertToProviderExpression(facade, 'useClass'),
            useFactory: wrapExpression(facade, 'useFactory'),
            useValue: convertToProviderExpression(facade, 'useValue'),
            useExisting: convertToProviderExpression(facade, 'useExisting'),
            deps: facade.deps?.map(convertR3DependencyMetadata),
        }, 
        /* resolveForwardRefs */ true);
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
    }
    compileInjectableDeclaration(angularCoreEnv, sourceMapUrl, facade) {
        const { expression, statements } = compileInjectable({
            name: facade.type.name,
            type: wrapReference(facade.type),
            typeArgumentCount: 0,
            providedIn: computeProvidedIn(facade.providedIn),
            useClass: convertToProviderExpression(facade, 'useClass'),
            useFactory: wrapExpression(facade, 'useFactory'),
            useValue: convertToProviderExpression(facade, 'useValue'),
            useExisting: convertToProviderExpression(facade, 'useExisting'),
            deps: facade.deps?.map(convertR3DeclareDependencyMetadata),
        }, 
        /* resolveForwardRefs */ true);
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
    }
    compileInjector(angularCoreEnv, sourceMapUrl, facade) {
        const meta = {
            name: facade.name,
            type: wrapReference(facade.type),
            providers: facade.providers && facade.providers.length > 0 ?
                new WrappedNodeExpr(facade.providers) :
                null,
            imports: facade.imports.map(i => new WrappedNodeExpr(i)),
        };
        const res = compileInjector(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    }
    compileInjectorDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
        const meta = convertDeclareInjectorFacadeToMetadata(declaration);
        const res = compileInjector(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    }
    compileNgModule(angularCoreEnv, sourceMapUrl, facade) {
        const meta = {
            type: wrapReference(facade.type),
            bootstrap: facade.bootstrap.map(wrapReference),
            declarations: facade.declarations.map(wrapReference),
            publicDeclarationTypes: null,
            imports: facade.imports.map(wrapReference),
            includeImportTypes: true,
            exports: facade.exports.map(wrapReference),
            selectorScopeMode: R3SelectorScopeMode.Inline,
            containsForwardDecls: false,
            schemas: facade.schemas ? facade.schemas.map(wrapReference) : null,
            id: facade.id ? new WrappedNodeExpr(facade.id) : null,
        };
        const res = compileNgModule(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    }
    compileNgModuleDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
        const expression = compileNgModuleDeclarationExpression(declaration);
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, []);
    }
    compileDirective(angularCoreEnv, sourceMapUrl, facade) {
        const meta = convertDirectiveFacadeToMetadata(facade);
        return this.compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta);
    }
    compileDirectiveDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
        const typeSourceSpan = this.createParseSourceSpan('Directive', declaration.type.name, sourceMapUrl);
        const meta = convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan);
        return this.compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta);
    }
    compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta) {
        const constantPool = new ConstantPool();
        const bindingParser = makeBindingParser();
        const res = compileDirectiveFromMetadata(meta, constantPool, bindingParser);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
    }
    compileComponent(angularCoreEnv, sourceMapUrl, facade) {
        // Parse the template and check for errors.
        const { template, interpolation } = parseJitTemplate(facade.template, facade.name, sourceMapUrl, facade.preserveWhitespaces, facade.interpolation);
        // Compile the component metadata, including template, into an expression.
        const meta = {
            ...facade,
            ...convertDirectiveFacadeToMetadata(facade),
            selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(),
            template,
            declarations: facade.declarations.map(convertDeclarationFacadeToMetadata),
            declarationListEmitMode: 0 /* DeclarationListEmitMode.Direct */,
            styles: [...facade.styles, ...template.styles],
            encapsulation: facade.encapsulation,
            interpolation,
            changeDetection: facade.changeDetection,
            animations: facade.animations != null ? new WrappedNodeExpr(facade.animations) : null,
            viewProviders: facade.viewProviders != null ? new WrappedNodeExpr(facade.viewProviders) :
                null,
            relativeContextFilePath: '',
            i18nUseExternalIds: true,
        };
        const jitExpressionSourceMap = `ng:///${facade.name}.js`;
        return this.compileComponentFromMeta(angularCoreEnv, jitExpressionSourceMap, meta);
    }
    compileComponentDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
        const typeSourceSpan = this.createParseSourceSpan('Component', declaration.type.name, sourceMapUrl);
        const meta = convertDeclareComponentFacadeToMetadata(declaration, typeSourceSpan, sourceMapUrl);
        return this.compileComponentFromMeta(angularCoreEnv, sourceMapUrl, meta);
    }
    compileComponentFromMeta(angularCoreEnv, sourceMapUrl, meta) {
        const constantPool = new ConstantPool();
        const bindingParser = makeBindingParser(meta.interpolation);
        const res = compileComponentFromMetadata(meta, constantPool, bindingParser);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
    }
    compileFactory(angularCoreEnv, sourceMapUrl, meta) {
        const factoryRes = compileFactoryFunction({
            name: meta.name,
            type: wrapReference(meta.type),
            typeArgumentCount: meta.typeArgumentCount,
            deps: convertR3DependencyMetadataArray(meta.deps),
            target: meta.target,
        });
        return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
    }
    compileFactoryDeclaration(angularCoreEnv, sourceMapUrl, meta) {
        const factoryRes = compileFactoryFunction({
            name: meta.type.name,
            type: wrapReference(meta.type),
            typeArgumentCount: 0,
            deps: Array.isArray(meta.deps) ? meta.deps.map(convertR3DeclareDependencyMetadata) :
                meta.deps,
            target: meta.target,
        });
        return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
    }
    createParseSourceSpan(kind, typeName, sourceUrl) {
        return r3JitTypeSourceSpan(kind, typeName, sourceUrl);
    }
    /**
     * JIT compiles an expression and returns the result of executing that expression.
     *
     * @param def the definition which will be compiled and executed to get the value to patch
     * @param context an object map of @angular/core symbol names to symbols which will be available
     * in the context of the compiled expression
     * @param sourceUrl a URL to use for the source map of the compiled expression
     * @param preStatements a collection of statements that should be evaluated before the expression.
     */
    jitExpression(def, context, sourceUrl, preStatements) {
        // The ConstantPool may contain Statements which declare variables used in the final expression.
        // Therefore, its statements need to precede the actual JIT operation. The final statement is a
        // declaration of $def which is set to the expression being compiled.
        const statements = [
            ...preStatements,
            new DeclareVarStmt('$def', def, undefined, StmtModifier.Exported),
        ];
        const res = this.jitEvaluator.evaluateStatements(sourceUrl, statements, new R3JitReflector(context), /* enableSourceMaps */ true);
        return res['$def'];
    }
}
function convertToR3QueryMetadata(facade) {
    return {
        ...facade,
        predicate: convertQueryPredicate(facade.predicate),
        read: facade.read ? new WrappedNodeExpr(facade.read) : null,
        static: facade.static,
        emitDistinctChangesOnly: facade.emitDistinctChangesOnly,
    };
}
function convertQueryDeclarationToMetadata(declaration) {
    return {
        propertyName: declaration.propertyName,
        first: declaration.first ?? false,
        predicate: convertQueryPredicate(declaration.predicate),
        descendants: declaration.descendants ?? false,
        read: declaration.read ? new WrappedNodeExpr(declaration.read) : null,
        static: declaration.static ?? false,
        emitDistinctChangesOnly: declaration.emitDistinctChangesOnly ?? true,
    };
}
function convertQueryPredicate(predicate) {
    return Array.isArray(predicate) ?
        // The predicate is an array of strings so pass it through.
        predicate :
        // The predicate is a type - assume that we will need to unwrap any `forwardRef()` calls.
        createMayBeForwardRefExpression(new WrappedNodeExpr(predicate), 1 /* ForwardRefHandling.Wrapped */);
}
function convertDirectiveFacadeToMetadata(facade) {
    const inputsFromMetadata = parseInputsArray(facade.inputs || []);
    const outputsFromMetadata = parseMappingStringArray(facade.outputs || []);
    const propMetadata = facade.propMetadata;
    const inputsFromType = {};
    const outputsFromType = {};
    for (const field in propMetadata) {
        if (propMetadata.hasOwnProperty(field)) {
            propMetadata[field].forEach(ann => {
                if (isInput(ann)) {
                    inputsFromType[field] = {
                        bindingPropertyName: ann.alias || field,
                        classPropertyName: field,
                        required: ann.required || false,
                        // TODO(crisbeto): resolve transform function reference here.
                        transformFunction: null,
                    };
                }
                else if (isOutput(ann)) {
                    outputsFromType[field] = ann.alias || field;
                }
            });
        }
    }
    return {
        ...facade,
        typeArgumentCount: 0,
        typeSourceSpan: facade.typeSourceSpan,
        type: wrapReference(facade.type),
        deps: null,
        host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host),
        inputs: { ...inputsFromMetadata, ...inputsFromType },
        outputs: { ...outputsFromMetadata, ...outputsFromType },
        queries: facade.queries.map(convertToR3QueryMetadata),
        providers: facade.providers != null ? new WrappedNodeExpr(facade.providers) : null,
        viewQueries: facade.viewQueries.map(convertToR3QueryMetadata),
        fullInheritance: false,
        hostDirectives: convertHostDirectivesToMetadata(facade),
    };
}
function convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan) {
    return {
        name: declaration.type.name,
        type: wrapReference(declaration.type),
        typeSourceSpan,
        selector: declaration.selector ?? null,
        inputs: declaration.inputs ? inputsMappingToInputMetadata(declaration.inputs) : {},
        outputs: declaration.outputs ?? {},
        host: convertHostDeclarationToMetadata(declaration.host),
        queries: (declaration.queries ?? []).map(convertQueryDeclarationToMetadata),
        viewQueries: (declaration.viewQueries ?? []).map(convertQueryDeclarationToMetadata),
        providers: declaration.providers !== undefined ? new WrappedNodeExpr(declaration.providers) :
            null,
        exportAs: declaration.exportAs ?? null,
        usesInheritance: declaration.usesInheritance ?? false,
        lifecycle: { usesOnChanges: declaration.usesOnChanges ?? false },
        deps: null,
        typeArgumentCount: 0,
        fullInheritance: false,
        isStandalone: declaration.isStandalone ?? false,
        isSignal: declaration.isSignal ?? false,
        hostDirectives: convertHostDirectivesToMetadata(declaration),
    };
}
function convertHostDeclarationToMetadata(host = {}) {
    return {
        attributes: convertOpaqueValuesToExpressions(host.attributes ?? {}),
        listeners: host.listeners ?? {},
        properties: host.properties ?? {},
        specialAttributes: {
            classAttr: host.classAttribute,
            styleAttr: host.styleAttribute,
        },
    };
}
function convertHostDirectivesToMetadata(metadata) {
    if (metadata.hostDirectives?.length) {
        return metadata.hostDirectives.map(hostDirective => {
            return typeof hostDirective === 'function' ?
                {
                    directive: wrapReference(hostDirective),
                    inputs: null,
                    outputs: null,
                    isForwardReference: false
                } :
                {
                    directive: wrapReference(hostDirective.directive),
                    isForwardReference: false,
                    inputs: hostDirective.inputs ? parseMappingStringArray(hostDirective.inputs) : null,
                    outputs: hostDirective.outputs ? parseMappingStringArray(hostDirective.outputs) : null,
                };
        });
    }
    return null;
}
function convertOpaqueValuesToExpressions(obj) {
    const result = {};
    for (const key of Object.keys(obj)) {
        result[key] = new WrappedNodeExpr(obj[key]);
    }
    return result;
}
function convertDeclareComponentFacadeToMetadata(decl, typeSourceSpan, sourceMapUrl) {
    const { template, interpolation } = parseJitTemplate(decl.template, decl.type.name, sourceMapUrl, decl.preserveWhitespaces ?? false, decl.interpolation);
    const declarations = [];
    if (decl.dependencies) {
        for (const innerDep of decl.dependencies) {
            switch (innerDep.kind) {
                case 'directive':
                case 'component':
                    declarations.push(convertDirectiveDeclarationToMetadata(innerDep));
                    break;
                case 'pipe':
                    declarations.push(convertPipeDeclarationToMetadata(innerDep));
                    break;
            }
        }
    }
    else if (decl.components || decl.directives || decl.pipes) {
        // Existing declarations on NPM may not be using the new `dependencies` merged field, and may
        // have separate fields for dependencies instead. Unify them for JIT compilation.
        decl.components &&
            declarations.push(...decl.components.map(dir => convertDirectiveDeclarationToMetadata(dir, /* isComponent */ true)));
        decl.directives &&
            declarations.push(...decl.directives.map(dir => convertDirectiveDeclarationToMetadata(dir)));
        decl.pipes && declarations.push(...convertPipeMapToMetadata(decl.pipes));
    }
    return {
        ...convertDeclareDirectiveFacadeToMetadata(decl, typeSourceSpan),
        template,
        styles: decl.styles ?? [],
        declarations,
        viewProviders: decl.viewProviders !== undefined ? new WrappedNodeExpr(decl.viewProviders) :
            null,
        animations: decl.animations !== undefined ? new WrappedNodeExpr(decl.animations) : null,
        changeDetection: decl.changeDetection ?? ChangeDetectionStrategy.Default,
        encapsulation: decl.encapsulation ?? ViewEncapsulation.Emulated,
        interpolation,
        declarationListEmitMode: 2 /* DeclarationListEmitMode.ClosureResolved */,
        relativeContextFilePath: '',
        i18nUseExternalIds: true,
    };
}
function convertDeclarationFacadeToMetadata(declaration) {
    return {
        ...declaration,
        type: new WrappedNodeExpr(declaration.type),
    };
}
function convertDirectiveDeclarationToMetadata(declaration, isComponent = null) {
    return {
        kind: R3TemplateDependencyKind.Directive,
        isComponent: isComponent || declaration.kind === 'component',
        selector: declaration.selector,
        type: new WrappedNodeExpr(declaration.type),
        inputs: declaration.inputs ?? [],
        outputs: declaration.outputs ?? [],
        exportAs: declaration.exportAs ?? null,
    };
}
function convertPipeMapToMetadata(pipes) {
    if (!pipes) {
        return [];
    }
    return Object.keys(pipes).map(name => {
        return {
            kind: R3TemplateDependencyKind.Pipe,
            name,
            type: new WrappedNodeExpr(pipes[name]),
        };
    });
}
function convertPipeDeclarationToMetadata(pipe) {
    return {
        kind: R3TemplateDependencyKind.Pipe,
        name: pipe.name,
        type: new WrappedNodeExpr(pipe.type),
    };
}
function parseJitTemplate(template, typeName, sourceMapUrl, preserveWhitespaces, interpolation) {
    const interpolationConfig = interpolation ? InterpolationConfig.fromArray(interpolation) : DEFAULT_INTERPOLATION_CONFIG;
    // Parse the template and check for errors.
    const parsed = parseTemplate(template, sourceMapUrl, { preserveWhitespaces, interpolationConfig });
    if (parsed.errors !== null) {
        const errors = parsed.errors.map(err => err.toString()).join(', ');
        throw new Error(`Errors during JIT compilation of template for ${typeName}: ${errors}`);
    }
    return { template: parsed, interpolation: interpolationConfig };
}
/**
 * Convert the expression, if present to an `R3ProviderExpression`.
 *
 * In JIT mode we do not want the compiler to wrap the expression in a `forwardRef()` call because,
 * if it is referencing a type that has not yet been defined, it will have already been wrapped in
 * a `forwardRef()` - either by the application developer or during partial-compilation. Thus we can
 * use `ForwardRefHandling.None`.
 */
function convertToProviderExpression(obj, property) {
    if (obj.hasOwnProperty(property)) {
        return createMayBeForwardRefExpression(new WrappedNodeExpr(obj[property]), 0 /* ForwardRefHandling.None */);
    }
    else {
        return undefined;
    }
}
function wrapExpression(obj, property) {
    if (obj.hasOwnProperty(property)) {
        return new WrappedNodeExpr(obj[property]);
    }
    else {
        return undefined;
    }
}
function computeProvidedIn(providedIn) {
    const expression = typeof providedIn === 'function' ? new WrappedNodeExpr(providedIn) :
        new LiteralExpr(providedIn ?? null);
    // See `convertToProviderExpression()` for why this uses `ForwardRefHandling.None`.
    return createMayBeForwardRefExpression(expression, 0 /* ForwardRefHandling.None */);
}
function convertR3DependencyMetadataArray(facades) {
    return facades == null ? null : facades.map(convertR3DependencyMetadata);
}
function convertR3DependencyMetadata(facade) {
    const isAttributeDep = facade.attribute != null; // both `null` and `undefined`
    const rawToken = facade.token === null ? null : new WrappedNodeExpr(facade.token);
    // In JIT mode, if the dep is an `@Attribute()` then we use the attribute name given in
    // `attribute` rather than the `token`.
    const token = isAttributeDep ? new WrappedNodeExpr(facade.attribute) : rawToken;
    return createR3DependencyMetadata(token, isAttributeDep, facade.host, facade.optional, facade.self, facade.skipSelf);
}
function convertR3DeclareDependencyMetadata(facade) {
    const isAttributeDep = facade.attribute ?? false;
    const token = facade.token === null ? null : new WrappedNodeExpr(facade.token);
    return createR3DependencyMetadata(token, isAttributeDep, facade.host ?? false, facade.optional ?? false, facade.self ?? false, facade.skipSelf ?? false);
}
function createR3DependencyMetadata(token, isAttributeDep, host, optional, self, skipSelf) {
    // If the dep is an `@Attribute()` the `attributeNameType` ought to be the `unknown` type.
    // But types are not available at runtime so we just use a literal `"<unknown>"` string as a dummy
    // marker.
    const attributeNameType = isAttributeDep ? literal('unknown') : null;
    return { token, attributeNameType, host, optional, self, skipSelf };
}
function extractHostBindings(propMetadata, sourceSpan, host) {
    // First parse the declarations from the metadata.
    const bindings = parseHostBindings(host || {});
    // After that check host bindings for errors
    const errors = verifyHostBindings(bindings, sourceSpan);
    if (errors.length) {
        throw new Error(errors.map((error) => error.msg).join('\n'));
    }
    // Next, loop over the properties of the object, looking for @HostBinding and @HostListener.
    for (const field in propMetadata) {
        if (propMetadata.hasOwnProperty(field)) {
            propMetadata[field].forEach(ann => {
                if (isHostBinding(ann)) {
                    // Since this is a decorator, we know that the value is a class member. Always access it
                    // through `this` so that further down the line it can't be confused for a literal value
                    // (e.g. if there's a property called `true`).
                    bindings.properties[ann.hostPropertyName || field] =
                        getSafePropertyAccessString('this', field);
                }
                else if (isHostListener(ann)) {
                    bindings.listeners[ann.eventName || field] = `${field}(${(ann.args || []).join(',')})`;
                }
            });
        }
    }
    return bindings;
}
function isHostBinding(value) {
    return value.ngMetadataName === 'HostBinding';
}
function isHostListener(value) {
    return value.ngMetadataName === 'HostListener';
}
function isInput(value) {
    return value.ngMetadataName === 'Input';
}
function isOutput(value) {
    return value.ngMetadataName === 'Output';
}
function inputsMappingToInputMetadata(inputs) {
    return Object.keys(inputs).reduce((result, key) => {
        const value = inputs[key];
        // TODO(crisbeto): resolve transform function reference here.
        if (typeof value === 'string') {
            result[key] = {
                bindingPropertyName: value,
                classPropertyName: value,
                required: false,
                transformFunction: null
            };
        }
        else {
            result[key] = {
                bindingPropertyName: value[0],
                classPropertyName: value[1],
                required: false,
                transformFunction: null
            };
        }
        return result;
    }, {});
}
function parseInputsArray(values) {
    return values.reduce((results, value) => {
        // TODO(crisbeto): resolve transform function reference here.
        if (typeof value === 'string') {
            const [bindingPropertyName, classPropertyName] = parseMappingString(value);
            results[classPropertyName] =
                { bindingPropertyName, classPropertyName, required: false, transformFunction: null };
        }
        else {
            results[value.name] = {
                bindingPropertyName: value.alias || value.name,
                classPropertyName: value.name,
                required: value.required || false,
                transformFunction: null
            };
        }
        return results;
    }, {});
}
function parseMappingStringArray(values) {
    return values.reduce((results, value) => {
        const [alias, fieldName] = parseMappingString(value);
        results[fieldName] = alias;
        return results;
    }, {});
}
function parseMappingString(value) {
    // Either the value is 'field' or 'field: property'. In the first case, `property` will
    // be undefined, in which case the field name should also be used as the property name.
    const [fieldName, bindingPropertyName] = value.split(':', 2).map(str => str.trim());
    return [bindingPropertyName ?? fieldName, fieldName];
}
function convertDeclarePipeFacadeToMetadata(declaration) {
    return {
        name: declaration.type.name,
        type: wrapReference(declaration.type),
        typeArgumentCount: 0,
        pipeName: declaration.name,
        deps: null,
        pure: declaration.pure ?? true,
        isStandalone: declaration.isStandalone ?? false,
    };
}
function convertDeclareInjectorFacadeToMetadata(declaration) {
    return {
        name: declaration.type.name,
        type: wrapReference(declaration.type),
        providers: declaration.providers !== undefined && declaration.providers.length > 0 ?
            new WrappedNodeExpr(declaration.providers) :
            null,
        imports: declaration.imports !== undefined ?
            declaration.imports.map(i => new WrappedNodeExpr(i)) :
            [],
    };
}
export function publishFacade(global) {
    const ng = global.ng || (global.ng = {});
    ng.ɵcompilerFacade = new CompilerFacadeImpl();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsdUJBQXVCLEVBQTRDLGlCQUFpQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzVHLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ25HLE9BQU8sRUFBQyxjQUFjLEVBQWMsT0FBTyxFQUFFLFdBQVcsRUFBYSxZQUFZLEVBQUUsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDL0gsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBOEIsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDOUUsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGFBQWEsRUFBdUIsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRyxPQUFPLEVBQUMsZUFBZSxFQUFxQixNQUFNLGdDQUFnQyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsZUFBZSxFQUFFLG9DQUFvQyxFQUFzQixtQkFBbUIsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQzVJLE9BQU8sRUFBQyx1QkFBdUIsRUFBaUIsTUFBTSw0QkFBNEIsQ0FBQztBQUNuRixPQUFPLEVBQUMsK0JBQStCLEVBQXNCLDJCQUEyQixFQUE2QixhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxSixPQUFPLEVBQTZNLHdCQUF3QixFQUErQixNQUFNLG9CQUFvQixDQUFDO0FBQ3RTLE9BQU8sRUFBQyw0QkFBNEIsRUFBRSw0QkFBNEIsRUFBc0IsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM5SixPQUFPLEVBQUMsaUJBQWlCLEVBQUUsYUFBYSxFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDekUsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ2pELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBRTlFLE1BQU0sT0FBTyxrQkFBa0I7SUFLN0IsWUFBb0IsZUFBZSxJQUFJLFlBQVksRUFBRTtRQUFqQyxpQkFBWSxHQUFaLFlBQVksQ0FBcUI7UUFKckQsa0JBQWEsR0FBRyxhQUFhLENBQUM7UUFDOUIsbUJBQWMsR0FBRyxjQUFjLENBQUM7UUFDeEIsMEJBQXFCLEdBQUcsSUFBSSx3QkFBd0IsRUFBRSxDQUFDO0lBRVAsQ0FBQztJQUV6RCxXQUFXLENBQUMsY0FBK0IsRUFBRSxZQUFvQixFQUFFLE1BQTRCO1FBRTdGLE1BQU0sUUFBUSxHQUFtQjtZQUMvQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7WUFDakIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQ2hDLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsSUFBSSxFQUFFLElBQUk7WUFDVixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7WUFDekIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ2pCLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWTtTQUNsQyxDQUFDO1FBQ0YsTUFBTSxHQUFHLEdBQUcsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDOUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsc0JBQXNCLENBQ2xCLGNBQStCLEVBQUUsWUFBb0IsRUFDckQsV0FBZ0M7UUFDbEMsTUFBTSxJQUFJLEdBQUcsa0NBQWtDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDN0QsTUFBTSxHQUFHLEdBQUcsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsaUJBQWlCLENBQ2IsY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFrQztRQUNwQyxNQUFNLEVBQUMsVUFBVSxFQUFFLFVBQVUsRUFBQyxHQUFHLGlCQUFpQixDQUM5QztZQUNFLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtZQUNqQixJQUFJLEVBQUUsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDaEMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLGlCQUFpQjtZQUMzQyxVQUFVLEVBQUUsaUJBQWlCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUNoRCxRQUFRLEVBQUUsMkJBQTJCLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQztZQUN6RCxVQUFVLEVBQUUsY0FBYyxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUM7WUFDaEQsUUFBUSxFQUFFLDJCQUEyQixDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUM7WUFDekQsV0FBVyxFQUFFLDJCQUEyQixDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUM7WUFDL0QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLDJCQUEyQixDQUFDO1NBQ3BEO1FBQ0Qsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFbkMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFRCw0QkFBNEIsQ0FDeEIsY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFpQztRQUNuQyxNQUFNLEVBQUMsVUFBVSxFQUFFLFVBQVUsRUFBQyxHQUFHLGlCQUFpQixDQUM5QztZQUNFLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUk7WUFDdEIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQ2hDLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsVUFBVSxFQUFFLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDaEQsUUFBUSxFQUFFLDJCQUEyQixDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUM7WUFDekQsVUFBVSxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDO1lBQ2hELFFBQVEsRUFBRSwyQkFBMkIsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDO1lBQ3pELFdBQVcsRUFBRSwyQkFBMkIsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO1lBQy9ELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQztTQUMzRDtRQUNELHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRW5DLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRUQsZUFBZSxDQUNYLGNBQStCLEVBQUUsWUFBb0IsRUFDckQsTUFBZ0M7UUFDbEMsTUFBTSxJQUFJLEdBQXVCO1lBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtZQUNqQixJQUFJLEVBQUUsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDaEMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hELElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJO1lBQ1IsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDekQsQ0FBQztRQUNGLE1BQU0sR0FBRyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFRCwwQkFBMEIsQ0FDdEIsY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxXQUFvQztRQUN0QyxNQUFNLElBQUksR0FBRyxzQ0FBc0MsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNqRSxNQUFNLEdBQUcsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsZUFBZSxDQUNYLGNBQStCLEVBQUUsWUFBb0IsRUFDckQsTUFBZ0M7UUFDbEMsTUFBTSxJQUFJLEdBQXVCO1lBQy9CLElBQUksRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNoQyxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQzlDLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUM7WUFDcEQsc0JBQXNCLEVBQUUsSUFBSTtZQUM1QixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQzFDLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQztZQUMxQyxpQkFBaUIsRUFBRSxtQkFBbUIsQ0FBQyxNQUFNO1lBQzdDLG9CQUFvQixFQUFFLEtBQUs7WUFDM0IsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO1lBQ2xFLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7U0FDdEQsQ0FBQztRQUNGLE1BQU0sR0FBRyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFRCwwQkFBMEIsQ0FDdEIsY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxXQUFvQztRQUN0QyxNQUFNLFVBQVUsR0FBRyxvQ0FBb0MsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNyRSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVELGdCQUFnQixDQUNaLGNBQStCLEVBQUUsWUFBb0IsRUFDckQsTUFBaUM7UUFDbkMsTUFBTSxJQUFJLEdBQXdCLGdDQUFnQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNFLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELDJCQUEyQixDQUN2QixjQUErQixFQUFFLFlBQW9CLEVBQ3JELFdBQXFDO1FBQ3ZDLE1BQU0sY0FBYyxHQUNoQixJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sSUFBSSxHQUFHLHVDQUF1QyxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNsRixPQUFPLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFTyx3QkFBd0IsQ0FDNUIsY0FBK0IsRUFBRSxZQUFvQixFQUFFLElBQXlCO1FBQ2xGLE1BQU0sWUFBWSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7UUFDeEMsTUFBTSxhQUFhLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztRQUMxQyxNQUFNLEdBQUcsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzVFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQsZ0JBQWdCLENBQ1osY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFpQztRQUNuQywyQ0FBMkM7UUFDM0MsTUFBTSxFQUFDLFFBQVEsRUFBRSxhQUFhLEVBQUMsR0FBRyxnQkFBZ0IsQ0FDOUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsbUJBQW1CLEVBQ3RFLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUxQiwwRUFBMEU7UUFDMUUsTUFBTSxJQUFJLEdBQThDO1lBQ3RELEdBQUcsTUFBTTtZQUNULEdBQUcsZ0NBQWdDLENBQUMsTUFBTSxDQUFDO1lBQzNDLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyw4QkFBOEIsRUFBRTtZQUN4RixRQUFRO1lBQ1IsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDO1lBQ3pFLHVCQUF1Qix3Q0FBZ0M7WUFDdkQsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQztZQUM5QyxhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWE7WUFDbkMsYUFBYTtZQUNiLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZTtZQUN2QyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtZQUNyRixhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxJQUFJO1lBQ2xELHVCQUF1QixFQUFFLEVBQUU7WUFDM0Isa0JBQWtCLEVBQUUsSUFBSTtTQUN6QixDQUFDO1FBQ0YsTUFBTSxzQkFBc0IsR0FBRyxTQUFTLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQztRQUN6RCxPQUFPLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUVELDJCQUEyQixDQUN2QixjQUErQixFQUFFLFlBQW9CLEVBQ3JELFdBQXFDO1FBQ3ZDLE1BQU0sY0FBYyxHQUNoQixJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sSUFBSSxHQUFHLHVDQUF1QyxDQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDaEcsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsY0FBYyxFQUFFLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBRU8sd0JBQXdCLENBQzVCLGNBQStCLEVBQUUsWUFBb0IsRUFDckQsSUFBK0M7UUFDakQsTUFBTSxZQUFZLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUN4QyxNQUFNLGFBQWEsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDNUQsTUFBTSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUM1RSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUVELGNBQWMsQ0FDVixjQUErQixFQUFFLFlBQW9CLEVBQUUsSUFBZ0M7UUFDekYsTUFBTSxVQUFVLEdBQUcsc0JBQXNCLENBQUM7WUFDeEMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQzlCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7WUFDekMsSUFBSSxFQUFFLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDakQsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ3BCLENBQUMsQ0FBQztRQUNILE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsVUFBVSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRUQseUJBQXlCLENBQ3JCLGNBQStCLEVBQUUsWUFBb0IsRUFBRSxJQUE0QjtRQUNyRixNQUFNLFVBQVUsR0FBRyxzQkFBc0IsQ0FBQztZQUN4QyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQ3BCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUM5QixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxDQUFDO2dCQUNuRCxJQUFJLENBQUMsSUFBSTtZQUMxQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDcEIsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixVQUFVLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFHRCxxQkFBcUIsQ0FBQyxJQUFZLEVBQUUsUUFBZ0IsRUFBRSxTQUFpQjtRQUNyRSxPQUFPLG1CQUFtQixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0ssYUFBYSxDQUNqQixHQUFlLEVBQUUsT0FBNkIsRUFBRSxTQUFpQixFQUNqRSxhQUEwQjtRQUM1QixnR0FBZ0c7UUFDaEcsK0ZBQStGO1FBQy9GLHFFQUFxRTtRQUNyRSxNQUFNLFVBQVUsR0FBZ0I7WUFDOUIsR0FBRyxhQUFhO1lBQ2hCLElBQUksY0FBYyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUM7U0FDbEUsQ0FBQztRQUVGLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQzVDLFNBQVMsRUFBRSxVQUFVLEVBQUUsSUFBSSxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckYsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckIsQ0FBQztDQUNGO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxNQUE2QjtJQUM3RCxPQUFPO1FBQ0wsR0FBRyxNQUFNO1FBQ1QsU0FBUyxFQUFFLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDbEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtRQUMzRCxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07UUFDckIsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLHVCQUF1QjtLQUN4RCxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsaUNBQWlDLENBQUMsV0FBeUM7SUFFbEYsT0FBTztRQUNMLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtRQUN0QyxLQUFLLEVBQUUsV0FBVyxDQUFDLEtBQUssSUFBSSxLQUFLO1FBQ2pDLFNBQVMsRUFBRSxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDO1FBQ3ZELFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVyxJQUFJLEtBQUs7UUFDN0MsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtRQUNyRSxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU0sSUFBSSxLQUFLO1FBQ25DLHVCQUF1QixFQUFFLFdBQVcsQ0FBQyx1QkFBdUIsSUFBSSxJQUFJO0tBQ3JFLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxTQUErQjtJQUU1RCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUM3QiwyREFBMkQ7UUFDM0QsU0FBUyxDQUFDLENBQUM7UUFDWCx5RkFBeUY7UUFDekYsK0JBQStCLENBQUMsSUFBSSxlQUFlLENBQUMsU0FBUyxDQUFDLHFDQUE2QixDQUFDO0FBQ2xHLENBQUM7QUFFRCxTQUFTLGdDQUFnQyxDQUFDLE1BQWlDO0lBQ3pFLE1BQU0sa0JBQWtCLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNqRSxNQUFNLG1CQUFtQixHQUFHLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7SUFDMUUsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUN6QyxNQUFNLGNBQWMsR0FBYSxFQUFFLENBQUM7SUFDcEMsTUFBTSxlQUFlLEdBQTJCLEVBQUUsQ0FBQztJQUNuRCxLQUFLLE1BQU0sS0FBSyxJQUFJLFlBQVksRUFBRTtRQUNoQyxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDdEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDaEMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ2hCLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRzt3QkFDdEIsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLEtBQUssSUFBSSxLQUFLO3dCQUN2QyxpQkFBaUIsRUFBRSxLQUFLO3dCQUN4QixRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsSUFBSSxLQUFLO3dCQUMvQiw2REFBNkQ7d0JBQzdELGlCQUFpQixFQUFFLElBQUk7cUJBQ3hCLENBQUM7aUJBQ0g7cUJBQU0sSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ3hCLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQztpQkFDN0M7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7SUFFRCxPQUFPO1FBQ0wsR0FBRyxNQUFNO1FBQ1QsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWM7UUFDckMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ2hDLElBQUksRUFBRSxJQUFJO1FBQ1YsSUFBSSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ2xGLE1BQU0sRUFBRSxFQUFDLEdBQUcsa0JBQWtCLEVBQUUsR0FBRyxjQUFjLEVBQUM7UUFDbEQsT0FBTyxFQUFFLEVBQUMsR0FBRyxtQkFBbUIsRUFBRSxHQUFHLGVBQWUsRUFBQztRQUNyRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUM7UUFDckQsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7UUFDbEYsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDO1FBQzdELGVBQWUsRUFBRSxLQUFLO1FBQ3RCLGNBQWMsRUFBRSwrQkFBK0IsQ0FBQyxNQUFNLENBQUM7S0FDeEQsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLHVDQUF1QyxDQUM1QyxXQUFxQyxFQUFFLGNBQStCO0lBQ3hFLE9BQU87UUFDTCxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJO1FBQzNCLElBQUksRUFBRSxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUNyQyxjQUFjO1FBQ2QsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRLElBQUksSUFBSTtRQUN0QyxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsNEJBQTRCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2xGLE9BQU8sRUFBRSxXQUFXLENBQUMsT0FBTyxJQUFJLEVBQUU7UUFDbEMsSUFBSSxFQUFFLGdDQUFnQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDeEQsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsaUNBQWlDLENBQUM7UUFDM0UsV0FBVyxFQUFFLENBQUMsV0FBVyxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsaUNBQWlDLENBQUM7UUFDbkYsU0FBUyxFQUFFLFdBQVcsQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUM1QyxJQUFJO1FBQ3JELFFBQVEsRUFBRSxXQUFXLENBQUMsUUFBUSxJQUFJLElBQUk7UUFDdEMsZUFBZSxFQUFFLFdBQVcsQ0FBQyxlQUFlLElBQUksS0FBSztRQUNyRCxTQUFTLEVBQUUsRUFBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLGFBQWEsSUFBSSxLQUFLLEVBQUM7UUFDOUQsSUFBSSxFQUFFLElBQUk7UUFDVixpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWSxJQUFJLEtBQUs7UUFDL0MsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRLElBQUksS0FBSztRQUN2QyxjQUFjLEVBQUUsK0JBQStCLENBQUMsV0FBVyxDQUFDO0tBQzdELENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxnQ0FBZ0MsQ0FBQyxPQUF5QyxFQUFFO0lBRW5GLE9BQU87UUFDTCxVQUFVLEVBQUUsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUM7UUFDbkUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRTtRQUMvQixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFO1FBQ2pDLGlCQUFpQixFQUFFO1lBQ2pCLFNBQVMsRUFBRSxJQUFJLENBQUMsY0FBYztZQUM5QixTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWM7U0FDL0I7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsK0JBQStCLENBQ3BDLFFBQTREO0lBQzlELElBQUksUUFBUSxDQUFDLGNBQWMsRUFBRSxNQUFNLEVBQUU7UUFDbkMsT0FBTyxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRTtZQUNqRCxPQUFPLE9BQU8sYUFBYSxLQUFLLFVBQVUsQ0FBQyxDQUFDO2dCQUN4QztvQkFDRSxTQUFTLEVBQUUsYUFBYSxDQUFDLGFBQWEsQ0FBQztvQkFDdkMsTUFBTSxFQUFFLElBQUk7b0JBQ1osT0FBTyxFQUFFLElBQUk7b0JBQ2Isa0JBQWtCLEVBQUUsS0FBSztpQkFDMUIsQ0FBQyxDQUFDO2dCQUNIO29CQUNFLFNBQVMsRUFBRSxhQUFhLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztvQkFDakQsa0JBQWtCLEVBQUUsS0FBSztvQkFDekIsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtvQkFDbkYsT0FBTyxFQUFFLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtpQkFDdkYsQ0FBQztRQUNSLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLGdDQUFnQyxDQUFDLEdBQWlDO0lBRXpFLE1BQU0sTUFBTSxHQUE4QyxFQUFFLENBQUM7SUFDN0QsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ2xDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztLQUM3QztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLHVDQUF1QyxDQUM1QyxJQUE4QixFQUFFLGNBQStCLEVBQy9ELFlBQW9CO0lBQ3RCLE1BQU0sRUFBQyxRQUFRLEVBQUUsYUFBYSxFQUFDLEdBQUcsZ0JBQWdCLENBQzlDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxLQUFLLEVBQzlFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUV4QixNQUFNLFlBQVksR0FBbUMsRUFBRSxDQUFDO0lBQ3hELElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtRQUNyQixLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDeEMsUUFBUSxRQUFRLENBQUMsSUFBSSxFQUFFO2dCQUNyQixLQUFLLFdBQVcsQ0FBQztnQkFDakIsS0FBSyxXQUFXO29CQUNkLFlBQVksQ0FBQyxJQUFJLENBQUMscUNBQXFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDbkUsTUFBTTtnQkFDUixLQUFLLE1BQU07b0JBQ1QsWUFBWSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUM5RCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO1NBQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtRQUMzRCw2RkFBNkY7UUFDN0YsaUZBQWlGO1FBQ2pGLElBQUksQ0FBQyxVQUFVO1lBQ1gsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUNwQyxHQUFHLENBQUMsRUFBRSxDQUFDLHFDQUFxQyxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEYsSUFBSSxDQUFDLFVBQVU7WUFDWCxZQUFZLENBQUMsSUFBSSxDQUNiLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxxQ0FBcUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkYsSUFBSSxDQUFDLEtBQUssSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsd0JBQXdCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDMUU7SUFFRCxPQUFPO1FBQ0wsR0FBRyx1Q0FBdUMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDO1FBQ2hFLFFBQVE7UUFDUixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFO1FBQ3pCLFlBQVk7UUFDWixhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLElBQUk7UUFDdEQsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7UUFDdkYsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLElBQUksdUJBQXVCLENBQUMsT0FBTztRQUN4RSxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsSUFBSSxpQkFBaUIsQ0FBQyxRQUFRO1FBQy9ELGFBQWE7UUFDYix1QkFBdUIsaURBQXlDO1FBQ2hFLHVCQUF1QixFQUFFLEVBQUU7UUFDM0Isa0JBQWtCLEVBQUUsSUFBSTtLQUN6QixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsa0NBQWtDLENBQUMsV0FBdUM7SUFFakYsT0FBTztRQUNMLEdBQUcsV0FBVztRQUNkLElBQUksRUFBRSxJQUFJLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0tBQzVDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxxQ0FBcUMsQ0FDMUMsV0FBK0MsRUFDL0MsY0FBeUIsSUFBSTtJQUMvQixPQUFPO1FBQ0wsSUFBSSxFQUFFLHdCQUF3QixDQUFDLFNBQVM7UUFDeEMsV0FBVyxFQUFFLFdBQVcsSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLFdBQVc7UUFDNUQsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRO1FBQzlCLElBQUksRUFBRSxJQUFJLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1FBQzNDLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxJQUFJLEVBQUU7UUFDaEMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPLElBQUksRUFBRTtRQUNsQyxRQUFRLEVBQUUsV0FBVyxDQUFDLFFBQVEsSUFBSSxJQUFJO0tBQ3ZDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxLQUF3QztJQUV4RSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDbkMsT0FBTztZQUNMLElBQUksRUFBRSx3QkFBd0IsQ0FBQyxJQUFJO1lBQ25DLElBQUk7WUFDSixJQUFJLEVBQUUsSUFBSSxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3ZDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLGdDQUFnQyxDQUFDLElBQW1DO0lBRTNFLE9BQU87UUFDTCxJQUFJLEVBQUUsd0JBQXdCLENBQUMsSUFBSTtRQUNuQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixJQUFJLEVBQUUsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztLQUNyQyxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQ3JCLFFBQWdCLEVBQUUsUUFBZ0IsRUFBRSxZQUFvQixFQUFFLG1CQUE0QixFQUN0RixhQUF5QztJQUMzQyxNQUFNLG1CQUFtQixHQUNyQixhQUFhLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsNEJBQTRCLENBQUM7SUFDaEcsMkNBQTJDO0lBQzNDLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLEVBQUMsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQUMsQ0FBQyxDQUFDO0lBQ2pHLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDMUIsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkUsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsUUFBUSxLQUFLLE1BQU0sRUFBRSxDQUFDLENBQUM7S0FDekY7SUFDRCxPQUFPLEVBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsbUJBQW1CLEVBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILFNBQVMsMkJBQTJCLENBQUMsR0FBUSxFQUFFLFFBQWdCO0lBRTdELElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNoQyxPQUFPLCtCQUErQixDQUNsQyxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsa0NBQTBCLENBQUM7S0FDbEU7U0FBTTtRQUNMLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0FBQ0gsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEdBQVEsRUFBRSxRQUFnQjtJQUNoRCxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDaEMsT0FBTyxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUMzQztTQUFNO1FBQ0wsT0FBTyxTQUFTLENBQUM7S0FDbEI7QUFDSCxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxVQUEwQztJQUNuRSxNQUFNLFVBQVUsR0FBRyxPQUFPLFVBQVUsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakMsSUFBSSxXQUFXLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxDQUFDO0lBQzFGLG1GQUFtRjtJQUNuRixPQUFPLCtCQUErQixDQUFDLFVBQVUsa0NBQTBCLENBQUM7QUFDOUUsQ0FBQztBQUVELFNBQVMsZ0NBQWdDLENBQUMsT0FDUztJQUNqRCxPQUFPLE9BQU8sSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0FBQzNFLENBQUM7QUFFRCxTQUFTLDJCQUEyQixDQUFDLE1BQWtDO0lBQ3JFLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLENBQUUsOEJBQThCO0lBQ2hGLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNsRix1RkFBdUY7SUFDdkYsdUNBQXVDO0lBQ3ZDLE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFDaEYsT0FBTywwQkFBMEIsQ0FDN0IsS0FBSyxFQUFFLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDekYsQ0FBQztBQUVELFNBQVMsa0NBQWtDLENBQUMsTUFBeUM7SUFFbkYsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUM7SUFDakQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9FLE9BQU8sMEJBQTBCLENBQzdCLEtBQUssRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDLElBQUksSUFBSSxLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsSUFBSSxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksSUFBSSxLQUFLLEVBQzNGLE1BQU0sQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUVELFNBQVMsMEJBQTBCLENBQy9CLEtBQW9DLEVBQUUsY0FBdUIsRUFBRSxJQUFhLEVBQUUsUUFBaUIsRUFDL0YsSUFBYSxFQUFFLFFBQWlCO0lBQ2xDLDBGQUEwRjtJQUMxRixrR0FBa0c7SUFDbEcsVUFBVTtJQUNWLE1BQU0saUJBQWlCLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNyRSxPQUFPLEVBQUMsS0FBSyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBQyxDQUFDO0FBQ3BFLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUN4QixZQUFvQyxFQUFFLFVBQTJCLEVBQ2pFLElBQThCO0lBQ2hDLGtEQUFrRDtJQUNsRCxNQUFNLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7SUFFL0MsNENBQTRDO0lBQzVDLE1BQU0sTUFBTSxHQUFHLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN4RCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBaUIsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQzFFO0lBRUQsNEZBQTRGO0lBQzVGLEtBQUssTUFBTSxLQUFLLElBQUksWUFBWSxFQUFFO1FBQ2hDLElBQUksWUFBWSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN0QyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNoQyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDdEIsd0ZBQXdGO29CQUN4Rix3RkFBd0Y7b0JBQ3hGLDhDQUE4QztvQkFDOUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLElBQUksS0FBSyxDQUFDO3dCQUM5QywyQkFBMkIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7aUJBQ2hEO3FCQUFNLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFO29CQUM5QixRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxTQUFTLElBQUksS0FBSyxDQUFDLEdBQUcsR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO2lCQUN4RjtZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7S0FDRjtJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxLQUFVO0lBQy9CLE9BQU8sS0FBSyxDQUFDLGNBQWMsS0FBSyxhQUFhLENBQUM7QUFDaEQsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEtBQVU7SUFDaEMsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLGNBQWMsQ0FBQztBQUNqRCxDQUFDO0FBR0QsU0FBUyxPQUFPLENBQUMsS0FBVTtJQUN6QixPQUFPLEtBQUssQ0FBQyxjQUFjLEtBQUssT0FBTyxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxLQUFVO0lBQzFCLE9BQU8sS0FBSyxDQUFDLGNBQWMsS0FBSyxRQUFRLENBQUM7QUFDM0MsQ0FBQztBQUVELFNBQVMsNEJBQTRCLENBQ2pDLE1BQXdFO0lBQzFFLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQVcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUU7UUFDMUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTFCLDZEQUE2RDtRQUM3RCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtZQUM3QixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUc7Z0JBQ1osbUJBQW1CLEVBQUUsS0FBSztnQkFDMUIsaUJBQWlCLEVBQUUsS0FBSztnQkFDeEIsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsaUJBQWlCLEVBQUUsSUFBSTthQUN4QixDQUFDO1NBQ0g7YUFBTTtZQUNMLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRztnQkFDWixtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixpQkFBaUIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUMzQixRQUFRLEVBQUUsS0FBSztnQkFDZixpQkFBaUIsRUFBRSxJQUFJO2FBQ3hCLENBQUM7U0FDSDtRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNULENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLE1BQXFFO0lBQzdGLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBVyxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRTtRQUNoRCw2REFBNkQ7UUFDN0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7WUFDN0IsTUFBTSxDQUFDLG1CQUFtQixFQUFFLGlCQUFpQixDQUFDLEdBQUcsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDM0UsT0FBTyxDQUFDLGlCQUFpQixDQUFDO2dCQUN0QixFQUFDLG1CQUFtQixFQUFFLGlCQUFpQixFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFDLENBQUM7U0FDeEY7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ3BCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLElBQUk7Z0JBQzlDLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxJQUFJO2dCQUM3QixRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFLO2dCQUNqQyxpQkFBaUIsRUFBRSxJQUFJO2FBQ3hCLENBQUM7U0FDSDtRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNULENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLE1BQWdCO0lBQy9DLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBeUIsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUU7UUFDOUQsTUFBTSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyRCxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQzNCLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNULENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLEtBQWE7SUFDdkMsdUZBQXVGO0lBQ3ZGLHVGQUF1RjtJQUN2RixNQUFNLENBQUMsU0FBUyxFQUFFLG1CQUFtQixDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDcEYsT0FBTyxDQUFDLG1CQUFtQixJQUFJLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBUyxrQ0FBa0MsQ0FBQyxXQUFnQztJQUMxRSxPQUFPO1FBQ0wsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSTtRQUMzQixJQUFJLEVBQUUsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDckMsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixRQUFRLEVBQUUsV0FBVyxDQUFDLElBQUk7UUFDMUIsSUFBSSxFQUFFLElBQUk7UUFDVixJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksSUFBSSxJQUFJO1FBQzlCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWSxJQUFJLEtBQUs7S0FDaEQsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLHNDQUFzQyxDQUFDLFdBQW9DO0lBRWxGLE9BQU87UUFDTCxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJO1FBQzNCLElBQUksRUFBRSxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUNyQyxTQUFTLEVBQUUsV0FBVyxDQUFDLFNBQVMsS0FBSyxTQUFTLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDaEYsSUFBSSxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsSUFBSTtRQUNSLE9BQU8sRUFBRSxXQUFXLENBQUMsT0FBTyxLQUFLLFNBQVMsQ0FBQyxDQUFDO1lBQ3hDLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RELEVBQUU7S0FDUCxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsTUFBVztJQUN2QyxNQUFNLEVBQUUsR0FBMkIsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7QUFDaEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCB7Q29tcGlsZXJGYWNhZGUsIENvcmVFbnZpcm9ubWVudCwgRXhwb3J0ZWRDb21waWxlckZhY2FkZSwgSW5wdXRNYXAsIElucHV0VHJhbnNmb3JtRnVuY3Rpb24sIE9wYXF1ZVZhbHVlLCBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUsIFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlRGlyZWN0aXZlRGVwZW5kZW5jeUZhY2FkZSwgUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCBSM0RlY2xhcmVGYWN0b3J5RmFjYWRlLCBSM0RlY2xhcmVJbmplY3RhYmxlRmFjYWRlLCBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSwgUjNEZWNsYXJlTmdNb2R1bGVGYWNhZGUsIFIzRGVjbGFyZVBpcGVEZXBlbmRlbmN5RmFjYWRlLCBSM0RlY2xhcmVQaXBlRmFjYWRlLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlLCBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSwgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlLCBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUsIFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSwgUjNQaXBlTWV0YWRhdGFGYWNhZGUsIFIzUXVlcnlNZXRhZGF0YUZhY2FkZSwgUjNUZW1wbGF0ZURlcGVuZGVuY3lGYWNhZGV9IGZyb20gJy4vY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZSc7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIEhvc3RCaW5kaW5nLCBIb3N0TGlzdGVuZXIsIElucHV0LCBPdXRwdXQsIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtjb21waWxlSW5qZWN0YWJsZX0gZnJvbSAnLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0RlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBsaXRlcmFsLCBMaXRlcmFsRXhwciwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXIsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2ppdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgcjNKaXRUeXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgRmFjdG9yeVRhcmdldCwgUjNEZXBlbmRlbmN5TWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7Y29tcGlsZUluamVjdG9yLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlcic7XG5pbXBvcnQge1IzSml0UmVmbGVjdG9yfSBmcm9tICcuL3JlbmRlcjMvcjNfaml0JztcbmltcG9ydCB7Y29tcGlsZU5nTW9kdWxlLCBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24sIFIzTmdNb2R1bGVNZXRhZGF0YSwgUjNTZWxlY3RvclNjb3BlTW9kZX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uLCBGb3J3YXJkUmVmSGFuZGxpbmcsIGdldFNhZmVQcm9wZXJ0eUFjY2Vzc1N0cmluZywgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgd3JhcFJlZmVyZW5jZX0gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdERpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNQaXBlRGVwZW5kZW5jeU1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGEsIFIzVGVtcGxhdGVEZXBlbmRlbmN5LCBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQsIFIzVGVtcGxhdGVEZXBlbmRlbmN5TWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy92aWV3L2FwaSc7XG5pbXBvcnQge2NvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEsIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEsIFBhcnNlZEhvc3RCaW5kaW5ncywgcGFyc2VIb3N0QmluZGluZ3MsIHZlcmlmeUhvc3RCaW5kaW5nc30gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHttYWtlQmluZGluZ1BhcnNlciwgcGFyc2VUZW1wbGF0ZX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlckZhY2FkZUltcGwgaW1wbGVtZW50cyBDb21waWxlckZhY2FkZSB7XG4gIEZhY3RvcnlUYXJnZXQgPSBGYWN0b3J5VGFyZ2V0O1xuICBSZXNvdXJjZUxvYWRlciA9IFJlc291cmNlTG9hZGVyO1xuICBwcml2YXRlIGVsZW1lbnRTY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGppdEV2YWx1YXRvciA9IG5ldyBKaXRFdmFsdWF0b3IoKSkge31cblxuICBjb21waWxlUGlwZShhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgZmFjYWRlOiBSM1BpcGVNZXRhZGF0YUZhY2FkZSk6XG4gICAgICBhbnkge1xuICAgIGNvbnN0IG1ldGFkYXRhOiBSM1BpcGVNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgIGRlcHM6IG51bGwsXG4gICAgICBwaXBlTmFtZTogZmFjYWRlLnBpcGVOYW1lLFxuICAgICAgcHVyZTogZmFjYWRlLnB1cmUsXG4gICAgICBpc1N0YW5kYWxvbmU6IGZhY2FkZS5pc1N0YW5kYWxvbmUsXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlUGlwZUZyb21NZXRhZGF0YShtZXRhZGF0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZVBpcGVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZVBpcGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZVBpcGVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlUGlwZUZyb21NZXRhZGF0YShtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgICAgICB0eXBlQXJndW1lbnRDb3VudDogZmFjYWRlLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgICAgIHByb3ZpZGVkSW46IGNvbXB1dGVQcm92aWRlZEluKGZhY2FkZS5wcm92aWRlZEluKSxcbiAgICAgICAgICB1c2VDbGFzczogY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZUNsYXNzJyksXG4gICAgICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCAndXNlRmFjdG9yeScpLFxuICAgICAgICAgIHVzZVZhbHVlOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCAndXNlVmFsdWUnKSxcbiAgICAgICAgICB1c2VFeGlzdGluZzogY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZUV4aXN0aW5nJyksXG4gICAgICAgICAgZGVwczogZmFjYWRlLmRlcHM/Lm1hcChjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEpLFxuICAgICAgICB9LFxuICAgICAgICAvKiByZXNvbHZlRm9yd2FyZFJlZnMgKi8gdHJ1ZSk7XG5cbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUluamVjdGFibGVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RlY2xhcmVJbmplY3RhYmxlRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB7ZXhwcmVzc2lvbiwgc3RhdGVtZW50c30gPSBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IGZhY2FkZS50eXBlLm5hbWUsXG4gICAgICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgICAgICAgcHJvdmlkZWRJbjogY29tcHV0ZVByb3ZpZGVkSW4oZmFjYWRlLnByb3ZpZGVkSW4pLFxuICAgICAgICAgIHVzZUNsYXNzOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCAndXNlQ2xhc3MnKSxcbiAgICAgICAgICB1c2VGYWN0b3J5OiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsICd1c2VGYWN0b3J5JyksXG4gICAgICAgICAgdXNlVmFsdWU6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsICd1c2VWYWx1ZScpLFxuICAgICAgICAgIHVzZUV4aXN0aW5nOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCAndXNlRXhpc3RpbmcnKSxcbiAgICAgICAgICBkZXBzOiBmYWNhZGUuZGVwcz8ubWFwKGNvbnZlcnRSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGEpLFxuICAgICAgICB9LFxuICAgICAgICAvKiByZXNvbHZlRm9yd2FyZFJlZnMgKi8gdHJ1ZSk7XG5cbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUluamVjdG9yKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNJbmplY3Rvck1ldGFkYXRhID0ge1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIHByb3ZpZGVyczogZmFjYWRlLnByb3ZpZGVycyAmJiBmYWNhZGUucHJvdmlkZXJzLmxlbmd0aCA+IDAgP1xuICAgICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnByb3ZpZGVycykgOlxuICAgICAgICAgIG51bGwsXG4gICAgICBpbXBvcnRzOiBmYWNhZGUuaW1wb3J0cy5tYXAoaSA9PiBuZXcgV3JhcHBlZE5vZGVFeHByKGkpKSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVJbmplY3RvcihtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0b3JEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZUluamVjdG9yRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVJbmplY3RvckZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24pO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVJbmplY3RvcihtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlTmdNb2R1bGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEgPSB7XG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGJvb3RzdHJhcDogZmFjYWRlLmJvb3RzdHJhcC5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgcHVibGljRGVjbGFyYXRpb25UeXBlczogbnVsbCwgIC8vIG9ubHkgbmVlZGVkIGZvciB0eXBlcyBpbiBBT1RcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGluY2x1ZGVJbXBvcnRUeXBlczogdHJ1ZSxcbiAgICAgIGV4cG9ydHM6IGZhY2FkZS5leHBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIHNlbGVjdG9yU2NvcGVNb2RlOiBSM1NlbGVjdG9yU2NvcGVNb2RlLklubGluZSxcbiAgICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBmYWxzZSxcbiAgICAgIHNjaGVtYXM6IGZhY2FkZS5zY2hlbWFzID8gZmFjYWRlLnNjaGVtYXMubWFwKHdyYXBSZWZlcmVuY2UpIDogbnVsbCxcbiAgICAgIGlkOiBmYWNhZGUuaWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5pZCkgOiBudWxsLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZU5nTW9kdWxlKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlTmdNb2R1bGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24oZGVjbGFyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZURpcmVjdGl2ZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhID0gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0RpcmVjdGl2ZScsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbik7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gICAgY29uc3Qge3RlbXBsYXRlLCBpbnRlcnBvbGF0aW9ufSA9IHBhcnNlSml0VGVtcGxhdGUoXG4gICAgICAgIGZhY2FkZS50ZW1wbGF0ZSwgZmFjYWRlLm5hbWUsIHNvdXJjZU1hcFVybCwgZmFjYWRlLnByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICAgIGZhY2FkZS5pbnRlcnBvbGF0aW9uKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIGNvbXBvbmVudCBtZXRhZGF0YSwgaW5jbHVkaW5nIHRlbXBsYXRlLCBpbnRvIGFuIGV4cHJlc3Npb24uXG4gICAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4gPSB7XG4gICAgICAuLi5mYWNhZGUsXG4gICAgICAuLi5jb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpLFxuICAgICAgc2VsZWN0b3I6IGZhY2FkZS5zZWxlY3RvciB8fCB0aGlzLmVsZW1lbnRTY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKSxcbiAgICAgIHRlbXBsYXRlLFxuICAgICAgZGVjbGFyYXRpb25zOiBmYWNhZGUuZGVjbGFyYXRpb25zLm1hcChjb252ZXJ0RGVjbGFyYXRpb25GYWNhZGVUb01ldGFkYXRhKSxcbiAgICAgIGRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QsXG4gICAgICBzdHlsZXM6IFsuLi5mYWNhZGUuc3R5bGVzLCAuLi50ZW1wbGF0ZS5zdHlsZXNdLFxuICAgICAgZW5jYXBzdWxhdGlvbjogZmFjYWRlLmVuY2Fwc3VsYXRpb24sXG4gICAgICBpbnRlcnBvbGF0aW9uLFxuICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBmYWNhZGUuY2hhbmdlRGV0ZWN0aW9uLFxuICAgICAgYW5pbWF0aW9uczogZmFjYWRlLmFuaW1hdGlvbnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmFuaW1hdGlvbnMpIDogbnVsbCxcbiAgICAgIHZpZXdQcm92aWRlcnM6IGZhY2FkZS52aWV3UHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgICB9O1xuICAgIGNvbnN0IGppdEV4cHJlc3Npb25Tb3VyY2VNYXAgPSBgbmc6Ly8vJHtmYWNhZGUubmFtZX0uanNgO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgaml0RXhwcmVzc2lvblNvdXJjZU1hcCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50RGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0NvbXBvbmVudCcsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVDb21wb25lbnRGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbiwgc291cmNlTWFwVXJsKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlQ29tcG9uZW50RnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBwcml2YXRlIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4pOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIobWV0YS5pbnRlcnBvbGF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgcmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKSB7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgbmFtZTogbWV0YS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShtZXRhLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IG1ldGEudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBkZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShtZXRhLmRlcHMpLFxuICAgICAgdGFyZ2V0OiBtZXRhLnRhcmdldCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICBmYWN0b3J5UmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGZhY3RvcnlSZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlRmFjdG9yeURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRGVjbGFyZUZhY3RvcnlGYWNhZGUpIHtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICBuYW1lOiBtZXRhLnR5cGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgICAgZGVwczogQXJyYXkuaXNBcnJheShtZXRhLmRlcHMpID8gbWV0YS5kZXBzLm1hcChjb252ZXJ0UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhLmRlcHMsXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG5cbiAgY3JlYXRlUGFyc2VTb3VyY2VTcGFuKGtpbmQ6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHJldHVybiByM0ppdFR5cGVTb3VyY2VTcGFuKGtpbmQsIHR5cGVOYW1lLCBzb3VyY2VVcmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEpJVCBjb21waWxlcyBhbiBleHByZXNzaW9uIGFuZCByZXR1cm5zIHRoZSByZXN1bHQgb2YgZXhlY3V0aW5nIHRoYXQgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGRlZiB0aGUgZGVmaW5pdGlvbiB3aGljaCB3aWxsIGJlIGNvbXBpbGVkIGFuZCBleGVjdXRlZCB0byBnZXQgdGhlIHZhbHVlIHRvIHBhdGNoXG4gICAqIEBwYXJhbSBjb250ZXh0IGFuIG9iamVjdCBtYXAgb2YgQGFuZ3VsYXIvY29yZSBzeW1ib2wgbmFtZXMgdG8gc3ltYm9scyB3aGljaCB3aWxsIGJlIGF2YWlsYWJsZVxuICAgKiBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gc291cmNlVXJsIGEgVVJMIHRvIHVzZSBmb3IgdGhlIHNvdXJjZSBtYXAgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHByZVN0YXRlbWVudHMgYSBjb2xsZWN0aW9uIG9mIHN0YXRlbWVudHMgdGhhdCBzaG91bGQgYmUgZXZhbHVhdGVkIGJlZm9yZSB0aGUgZXhwcmVzc2lvbi5cbiAgICovXG4gIHByaXZhdGUgaml0RXhwcmVzc2lvbihcbiAgICAgIGRlZjogRXhwcmVzc2lvbiwgY29udGV4dDoge1trZXk6IHN0cmluZ106IGFueX0sIHNvdXJjZVVybDogc3RyaW5nLFxuICAgICAgcHJlU3RhdGVtZW50czogU3RhdGVtZW50W10pOiBhbnkge1xuICAgIC8vIFRoZSBDb25zdGFudFBvb2wgbWF5IGNvbnRhaW4gU3RhdGVtZW50cyB3aGljaCBkZWNsYXJlIHZhcmlhYmxlcyB1c2VkIGluIHRoZSBmaW5hbCBleHByZXNzaW9uLlxuICAgIC8vIFRoZXJlZm9yZSwgaXRzIHN0YXRlbWVudHMgbmVlZCB0byBwcmVjZWRlIHRoZSBhY3R1YWwgSklUIG9wZXJhdGlvbi4gVGhlIGZpbmFsIHN0YXRlbWVudCBpcyBhXG4gICAgLy8gZGVjbGFyYXRpb24gb2YgJGRlZiB3aGljaCBpcyBzZXQgdG8gdGhlIGV4cHJlc3Npb24gYmVpbmcgY29tcGlsZWQuXG4gICAgY29uc3Qgc3RhdGVtZW50czogU3RhdGVtZW50W10gPSBbXG4gICAgICAuLi5wcmVTdGF0ZW1lbnRzLFxuICAgICAgbmV3IERlY2xhcmVWYXJTdG10KCckZGVmJywgZGVmLCB1bmRlZmluZWQsIFN0bXRNb2RpZmllci5FeHBvcnRlZCksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuaml0RXZhbHVhdG9yLmV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIC8qIGVuYWJsZVNvdXJjZU1hcHMgKi8gdHJ1ZSk7XG4gICAgcmV0dXJuIHJlc1snJGRlZiddO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YShmYWNhZGU6IFIzUXVlcnlNZXRhZGF0YUZhY2FkZSk6IFIzUXVlcnlNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgLi4uZmFjYWRlLFxuICAgIHByZWRpY2F0ZTogY29udmVydFF1ZXJ5UHJlZGljYXRlKGZhY2FkZS5wcmVkaWNhdGUpLFxuICAgIHJlYWQ6IGZhY2FkZS5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucmVhZCkgOiBudWxsLFxuICAgIHN0YXRpYzogZmFjYWRlLnN0YXRpYyxcbiAgICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seTogZmFjYWRlLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFGYWNhZGUpOlxuICAgIFIzUXVlcnlNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgcHJvcGVydHlOYW1lOiBkZWNsYXJhdGlvbi5wcm9wZXJ0eU5hbWUsXG4gICAgZmlyc3Q6IGRlY2xhcmF0aW9uLmZpcnN0ID8/IGZhbHNlLFxuICAgIHByZWRpY2F0ZTogY29udmVydFF1ZXJ5UHJlZGljYXRlKGRlY2xhcmF0aW9uLnByZWRpY2F0ZSksXG4gICAgZGVzY2VuZGFudHM6IGRlY2xhcmF0aW9uLmRlc2NlbmRhbnRzID8/IGZhbHNlLFxuICAgIHJlYWQ6IGRlY2xhcmF0aW9uLnJlYWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGRlY2xhcmF0aW9uLnN0YXRpYyA/PyBmYWxzZSxcbiAgICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seTogZGVjbGFyYXRpb24uZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgPz8gdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFF1ZXJ5UHJlZGljYXRlKHByZWRpY2F0ZTogT3BhcXVlVmFsdWV8c3RyaW5nW10pOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9ufFxuICAgIHN0cmluZ1tdIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkocHJlZGljYXRlKSA/XG4gICAgICAvLyBUaGUgcHJlZGljYXRlIGlzIGFuIGFycmF5IG9mIHN0cmluZ3Mgc28gcGFzcyBpdCB0aHJvdWdoLlxuICAgICAgcHJlZGljYXRlIDpcbiAgICAgIC8vIFRoZSBwcmVkaWNhdGUgaXMgYSB0eXBlIC0gYXNzdW1lIHRoYXQgd2Ugd2lsbCBuZWVkIHRvIHVud3JhcCBhbnkgYGZvcndhcmRSZWYoKWAgY2FsbHMuXG4gICAgICBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uKG5ldyBXcmFwcGVkTm9kZUV4cHIocHJlZGljYXRlKSwgRm9yd2FyZFJlZkhhbmRsaW5nLldyYXBwZWQpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3QgaW5wdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dHNBcnJheShmYWNhZGUuaW5wdXRzIHx8IFtdKTtcbiAgY29uc3Qgb3V0cHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlTWFwcGluZ1N0cmluZ0FycmF5KGZhY2FkZS5vdXRwdXRzIHx8IFtdKTtcbiAgY29uc3QgcHJvcE1ldGFkYXRhID0gZmFjYWRlLnByb3BNZXRhZGF0YTtcbiAgY29uc3QgaW5wdXRzRnJvbVR5cGU6IElucHV0TWFwID0ge307XG4gIGNvbnN0IG91dHB1dHNGcm9tVHlwZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSW5wdXQoYW5uKSkge1xuICAgICAgICAgIGlucHV0c0Zyb21UeXBlW2ZpZWxkXSA9IHtcbiAgICAgICAgICAgIGJpbmRpbmdQcm9wZXJ0eU5hbWU6IGFubi5hbGlhcyB8fCBmaWVsZCxcbiAgICAgICAgICAgIGNsYXNzUHJvcGVydHlOYW1lOiBmaWVsZCxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBhbm4ucmVxdWlyZWQgfHwgZmFsc2UsXG4gICAgICAgICAgICAvLyBUT0RPKGNyaXNiZXRvKTogcmVzb2x2ZSB0cmFuc2Zvcm0gZnVuY3Rpb24gcmVmZXJlbmNlIGhlcmUuXG4gICAgICAgICAgICB0cmFuc2Zvcm1GdW5jdGlvbjogbnVsbCxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKGlzT3V0cHV0KGFubikpIHtcbiAgICAgICAgICBvdXRwdXRzRnJvbVR5cGVbZmllbGRdID0gYW5uLmFsaWFzIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgIGRlcHM6IG51bGwsXG4gICAgaG9zdDogZXh0cmFjdEhvc3RCaW5kaW5ncyhmYWNhZGUucHJvcE1ldGFkYXRhLCBmYWNhZGUudHlwZVNvdXJjZVNwYW4sIGZhY2FkZS5ob3N0KSxcbiAgICBpbnB1dHM6IHsuLi5pbnB1dHNGcm9tTWV0YWRhdGEsIC4uLmlucHV0c0Zyb21UeXBlfSxcbiAgICBvdXRwdXRzOiB7Li4ub3V0cHV0c0Zyb21NZXRhZGF0YSwgLi4ub3V0cHV0c0Zyb21UeXBlfSxcbiAgICBxdWVyaWVzOiBmYWNhZGUucXVlcmllcy5tYXAoY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKSxcbiAgICBwcm92aWRlcnM6IGZhY2FkZS5wcm92aWRlcnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnByb3ZpZGVycykgOiBudWxsLFxuICAgIHZpZXdRdWVyaWVzOiBmYWNhZGUudmlld1F1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgICBob3N0RGlyZWN0aXZlczogY29udmVydEhvc3REaXJlY3RpdmVzVG9NZXRhZGF0YShmYWNhZGUpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZURpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoXG4gICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHR5cGVTb3VyY2VTcGFuLFxuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvciA/PyBudWxsLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8gaW5wdXRzTWFwcGluZ1RvSW5wdXRNZXRhZGF0YShkZWNsYXJhdGlvbi5pbnB1dHMpIDoge30sXG4gICAgb3V0cHV0czogZGVjbGFyYXRpb24ub3V0cHV0cyA/PyB7fSxcbiAgICBob3N0OiBjb252ZXJ0SG9zdERlY2xhcmF0aW9uVG9NZXRhZGF0YShkZWNsYXJhdGlvbi5ob3N0KSxcbiAgICBxdWVyaWVzOiAoZGVjbGFyYXRpb24ucXVlcmllcyA/PyBbXSkubWFwKGNvbnZlcnRRdWVyeURlY2xhcmF0aW9uVG9NZXRhZGF0YSksXG4gICAgdmlld1F1ZXJpZXM6IChkZWNsYXJhdGlvbi52aWV3UXVlcmllcyA/PyBbXSkubWFwKGNvbnZlcnRRdWVyeURlY2xhcmF0aW9uVG9NZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBkZWNsYXJhdGlvbi5wcm92aWRlcnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgZXhwb3J0QXM6IGRlY2xhcmF0aW9uLmV4cG9ydEFzID8/IG51bGwsXG4gICAgdXNlc0luaGVyaXRhbmNlOiBkZWNsYXJhdGlvbi51c2VzSW5oZXJpdGFuY2UgPz8gZmFsc2UsXG4gICAgbGlmZWN5Y2xlOiB7dXNlc09uQ2hhbmdlczogZGVjbGFyYXRpb24udXNlc09uQ2hhbmdlcyA/PyBmYWxzZX0sXG4gICAgZGVwczogbnVsbCxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICBmdWxsSW5oZXJpdGFuY2U6IGZhbHNlLFxuICAgIGlzU3RhbmRhbG9uZTogZGVjbGFyYXRpb24uaXNTdGFuZGFsb25lID8/IGZhbHNlLFxuICAgIGlzU2lnbmFsOiBkZWNsYXJhdGlvbi5pc1NpZ25hbCA/PyBmYWxzZSxcbiAgICBob3N0RGlyZWN0aXZlczogY29udmVydEhvc3REaXJlY3RpdmVzVG9NZXRhZGF0YShkZWNsYXJhdGlvbiksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRIb3N0RGVjbGFyYXRpb25Ub01ldGFkYXRhKGhvc3Q6IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZVsnaG9zdCddID0ge30pOlxuICAgIFIzSG9zdE1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBhdHRyaWJ1dGVzOiBjb252ZXJ0T3BhcXVlVmFsdWVzVG9FeHByZXNzaW9ucyhob3N0LmF0dHJpYnV0ZXMgPz8ge30pLFxuICAgIGxpc3RlbmVyczogaG9zdC5saXN0ZW5lcnMgPz8ge30sXG4gICAgcHJvcGVydGllczogaG9zdC5wcm9wZXJ0aWVzID8/IHt9LFxuICAgIHNwZWNpYWxBdHRyaWJ1dGVzOiB7XG4gICAgICBjbGFzc0F0dHI6IGhvc3QuY2xhc3NBdHRyaWJ1dGUsXG4gICAgICBzdHlsZUF0dHI6IGhvc3Quc3R5bGVBdHRyaWJ1dGUsXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydEhvc3REaXJlY3RpdmVzVG9NZXRhZGF0YShcbiAgICBtZXRhZGF0YTogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlfFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0hvc3REaXJlY3RpdmVNZXRhZGF0YVtdfG51bGwge1xuICBpZiAobWV0YWRhdGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIHJldHVybiBtZXRhZGF0YS5ob3N0RGlyZWN0aXZlcy5tYXAoaG9zdERpcmVjdGl2ZSA9PiB7XG4gICAgICByZXR1cm4gdHlwZW9mIGhvc3REaXJlY3RpdmUgPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGRpcmVjdGl2ZTogd3JhcFJlZmVyZW5jZShob3N0RGlyZWN0aXZlKSxcbiAgICAgICAgICAgIGlucHV0czogbnVsbCxcbiAgICAgICAgICAgIG91dHB1dHM6IG51bGwsXG4gICAgICAgICAgICBpc0ZvcndhcmRSZWZlcmVuY2U6IGZhbHNlXG4gICAgICAgICAgfSA6XG4gICAgICAgICAge1xuICAgICAgICAgICAgZGlyZWN0aXZlOiB3cmFwUmVmZXJlbmNlKGhvc3REaXJlY3RpdmUuZGlyZWN0aXZlKSxcbiAgICAgICAgICAgIGlzRm9yd2FyZFJlZmVyZW5jZTogZmFsc2UsXG4gICAgICAgICAgICBpbnB1dHM6IGhvc3REaXJlY3RpdmUuaW5wdXRzID8gcGFyc2VNYXBwaW5nU3RyaW5nQXJyYXkoaG9zdERpcmVjdGl2ZS5pbnB1dHMpIDogbnVsbCxcbiAgICAgICAgICAgIG91dHB1dHM6IGhvc3REaXJlY3RpdmUub3V0cHV0cyA/IHBhcnNlTWFwcGluZ1N0cmluZ0FycmF5KGhvc3REaXJlY3RpdmUub3V0cHV0cykgOiBudWxsLFxuICAgICAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY29udmVydE9wYXF1ZVZhbHVlc1RvRXhwcmVzc2lvbnMob2JqOiB7W2tleTogc3RyaW5nXTogT3BhcXVlVmFsdWV9KTpcbiAgICB7W2tleTogc3RyaW5nXTogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fSB7XG4gIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IFdyYXBwZWROb2RlRXhwcjx1bmtub3duPn0gPSB7fTtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xuICAgIHJlc3VsdFtrZXldID0gbmV3IFdyYXBwZWROb2RlRXhwcihvYmpba2V5XSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVDb21wb25lbnRGYWNhZGVUb01ldGFkYXRhKFxuICAgIGRlY2w6IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBzb3VyY2VNYXBVcmw6IHN0cmluZyk6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3lNZXRhZGF0YT4ge1xuICBjb25zdCB7dGVtcGxhdGUsIGludGVycG9sYXRpb259ID0gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICAgIGRlY2wudGVtcGxhdGUsIGRlY2wudHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwsIGRlY2wucHJlc2VydmVXaGl0ZXNwYWNlcyA/PyBmYWxzZSxcbiAgICAgIGRlY2wuaW50ZXJwb2xhdGlvbik7XG5cbiAgY29uc3QgZGVjbGFyYXRpb25zOiBSM1RlbXBsYXRlRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgaWYgKGRlY2wuZGVwZW5kZW5jaWVzKSB7XG4gICAgZm9yIChjb25zdCBpbm5lckRlcCBvZiBkZWNsLmRlcGVuZGVuY2llcykge1xuICAgICAgc3dpdGNoIChpbm5lckRlcC5raW5kKSB7XG4gICAgICAgIGNhc2UgJ2RpcmVjdGl2ZSc6XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgICAgZGVjbGFyYXRpb25zLnB1c2goY29udmVydERpcmVjdGl2ZURlY2xhcmF0aW9uVG9NZXRhZGF0YShpbm5lckRlcCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdwaXBlJzpcbiAgICAgICAgICBkZWNsYXJhdGlvbnMucHVzaChjb252ZXJ0UGlwZURlY2xhcmF0aW9uVG9NZXRhZGF0YShpbm5lckRlcCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChkZWNsLmNvbXBvbmVudHMgfHwgZGVjbC5kaXJlY3RpdmVzIHx8IGRlY2wucGlwZXMpIHtcbiAgICAvLyBFeGlzdGluZyBkZWNsYXJhdGlvbnMgb24gTlBNIG1heSBub3QgYmUgdXNpbmcgdGhlIG5ldyBgZGVwZW5kZW5jaWVzYCBtZXJnZWQgZmllbGQsIGFuZCBtYXlcbiAgICAvLyBoYXZlIHNlcGFyYXRlIGZpZWxkcyBmb3IgZGVwZW5kZW5jaWVzIGluc3RlYWQuIFVuaWZ5IHRoZW0gZm9yIEpJVCBjb21waWxhdGlvbi5cbiAgICBkZWNsLmNvbXBvbmVudHMgJiZcbiAgICAgICAgZGVjbGFyYXRpb25zLnB1c2goLi4uZGVjbC5jb21wb25lbnRzLm1hcChcbiAgICAgICAgICAgIGRpciA9PiBjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGRpciwgLyogaXNDb21wb25lbnQgKi8gdHJ1ZSkpKTtcbiAgICBkZWNsLmRpcmVjdGl2ZXMgJiZcbiAgICAgICAgZGVjbGFyYXRpb25zLnB1c2goXG4gICAgICAgICAgICAuLi5kZWNsLmRpcmVjdGl2ZXMubWFwKGRpciA9PiBjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGRpcikpKTtcbiAgICBkZWNsLnBpcGVzICYmIGRlY2xhcmF0aW9ucy5wdXNoKC4uLmNvbnZlcnRQaXBlTWFwVG9NZXRhZGF0YShkZWNsLnBpcGVzKSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShkZWNsLCB0eXBlU291cmNlU3BhbiksXG4gICAgdGVtcGxhdGUsXG4gICAgc3R5bGVzOiBkZWNsLnN0eWxlcyA/PyBbXSxcbiAgICBkZWNsYXJhdGlvbnMsXG4gICAgdmlld1Byb3ZpZGVyczogZGVjbC52aWV3UHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2wudmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICBhbmltYXRpb25zOiBkZWNsLmFuaW1hdGlvbnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbC5hbmltYXRpb25zKSA6IG51bGwsXG4gICAgY2hhbmdlRGV0ZWN0aW9uOiBkZWNsLmNoYW5nZURldGVjdGlvbiA/PyBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0LFxuICAgIGVuY2Fwc3VsYXRpb246IGRlY2wuZW5jYXBzdWxhdGlvbiA/PyBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uLFxuICAgIGRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmF0aW9uRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNUZW1wbGF0ZURlcGVuZGVuY3lGYWNhZGUpOlxuICAgIFIzVGVtcGxhdGVEZXBlbmRlbmN5IHtcbiAgcmV0dXJuIHtcbiAgICAuLi5kZWNsYXJhdGlvbixcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKFxuICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVEZXBlbmRlbmN5RmFjYWRlLFxuICAgIGlzQ29tcG9uZW50OiB0cnVlfG51bGwgPSBudWxsKTogUjNEaXJlY3RpdmVEZXBlbmRlbmN5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5EaXJlY3RpdmUsXG4gICAgaXNDb21wb25lbnQ6IGlzQ29tcG9uZW50IHx8IGRlY2xhcmF0aW9uLmtpbmQgPT09ICdjb21wb25lbnQnLFxuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvcixcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IFtdLFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8gW10sXG4gICAgZXhwb3J0QXM6IGRlY2xhcmF0aW9uLmV4cG9ydEFzID8/IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQaXBlTWFwVG9NZXRhZGF0YShwaXBlczogUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlWydwaXBlcyddKTpcbiAgICBSM1BpcGVEZXBlbmRlbmN5TWV0YWRhdGFbXSB7XG4gIGlmICghcGlwZXMpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICByZXR1cm4gT2JqZWN0LmtleXMocGlwZXMpLm1hcChuYW1lID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLlBpcGUsXG4gICAgICBuYW1lLFxuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihwaXBlc1tuYW1lXSksXG4gICAgfTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQaXBlRGVjbGFyYXRpb25Ub01ldGFkYXRhKHBpcGU6IFIzRGVjbGFyZVBpcGVEZXBlbmRlbmN5RmFjYWRlKTpcbiAgICBSM1BpcGVEZXBlbmRlbmN5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5QaXBlLFxuICAgIG5hbWU6IHBpcGUubmFtZSxcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKHBpcGUudHlwZSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlSml0VGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlTWFwVXJsOiBzdHJpbmcsIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4sXG4gICAgaW50ZXJwb2xhdGlvbjogW3N0cmluZywgc3RyaW5nXXx1bmRlZmluZWQpIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkNvbmZpZyA9XG4gICAgICBpbnRlcnBvbGF0aW9uID8gSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoaW50ZXJwb2xhdGlvbikgOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlVGVtcGxhdGUodGVtcGxhdGUsIHNvdXJjZU1hcFVybCwge3ByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgaWYgKHBhcnNlZC5lcnJvcnMgIT09IG51bGwpIHtcbiAgICBjb25zdCBlcnJvcnMgPSBwYXJzZWQuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcnMgZHVyaW5nIEpJVCBjb21waWxhdGlvbiBvZiB0ZW1wbGF0ZSBmb3IgJHt0eXBlTmFtZX06ICR7ZXJyb3JzfWApO1xuICB9XG4gIHJldHVybiB7dGVtcGxhdGU6IHBhcnNlZCwgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvbkNvbmZpZ307XG59XG5cbi8qKlxuICogQ29udmVydCB0aGUgZXhwcmVzc2lvbiwgaWYgcHJlc2VudCB0byBhbiBgUjNQcm92aWRlckV4cHJlc3Npb25gLlxuICpcbiAqIEluIEpJVCBtb2RlIHdlIGRvIG5vdCB3YW50IHRoZSBjb21waWxlciB0byB3cmFwIHRoZSBleHByZXNzaW9uIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbCBiZWNhdXNlLFxuICogaWYgaXQgaXMgcmVmZXJlbmNpbmcgYSB0eXBlIHRoYXQgaGFzIG5vdCB5ZXQgYmVlbiBkZWZpbmVkLCBpdCB3aWxsIGhhdmUgYWxyZWFkeSBiZWVuIHdyYXBwZWQgaW5cbiAqIGEgYGZvcndhcmRSZWYoKWAgLSBlaXRoZXIgYnkgdGhlIGFwcGxpY2F0aW9uIGRldmVsb3BlciBvciBkdXJpbmcgcGFydGlhbC1jb21waWxhdGlvbi4gVGh1cyB3ZSBjYW5cbiAqIHVzZSBgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmVgLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9ufFxuICAgIHVuZGVmaW5lZCB7XG4gIGlmIChvYmouaGFzT3duUHJvcGVydHkocHJvcGVydHkpKSB7XG4gICAgcmV0dXJuIGNyZWF0ZU1heUJlRm9yd2FyZFJlZkV4cHJlc3Npb24oXG4gICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIob2JqW3Byb3BlcnR5XSksIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBFeHByZXNzaW9uKG9iajogYW55LCBwcm9wZXJ0eTogc3RyaW5nKTogV3JhcHBlZE5vZGVFeHByPGFueT58dW5kZWZpbmVkIHtcbiAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICByZXR1cm4gbmV3IFdyYXBwZWROb2RlRXhwcihvYmpbcHJvcGVydHldKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVQcm92aWRlZEluKHByb3ZpZGVkSW46IEZ1bmN0aW9ufHN0cmluZ3xudWxsfHVuZGVmaW5lZCk6IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24ge1xuICBjb25zdCBleHByZXNzaW9uID0gdHlwZW9mIHByb3ZpZGVkSW4gPT09ICdmdW5jdGlvbicgPyBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4gPz8gbnVsbCk7XG4gIC8vIFNlZSBgY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKClgIGZvciB3aHkgdGhpcyB1c2VzIGBGb3J3YXJkUmVmSGFuZGxpbmcuTm9uZWAuXG4gIHJldHVybiBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uKGV4cHJlc3Npb24sIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXXxudWxsfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkKTogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsIHtcbiAgcmV0dXJuIGZhY2FkZXMgPT0gbnVsbCA/IG51bGwgOiBmYWNhZGVzLm1hcChjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEoZmFjYWRlOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSk6IFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgY29uc3QgaXNBdHRyaWJ1dGVEZXAgPSBmYWNhZGUuYXR0cmlidXRlICE9IG51bGw7ICAvLyBib3RoIGBudWxsYCBhbmQgYHVuZGVmaW5lZGBcbiAgY29uc3QgcmF3VG9rZW4gPSBmYWNhZGUudG9rZW4gPT09IG51bGwgPyBudWxsIDogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudG9rZW4pO1xuICAvLyBJbiBKSVQgbW9kZSwgaWYgdGhlIGRlcCBpcyBhbiBgQEF0dHJpYnV0ZSgpYCB0aGVuIHdlIHVzZSB0aGUgYXR0cmlidXRlIG5hbWUgZ2l2ZW4gaW5cbiAgLy8gYGF0dHJpYnV0ZWAgcmF0aGVyIHRoYW4gdGhlIGB0b2tlbmAuXG4gIGNvbnN0IHRva2VuID0gaXNBdHRyaWJ1dGVEZXAgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5hdHRyaWJ1dGUpIDogcmF3VG9rZW47XG4gIHJldHVybiBjcmVhdGVSM0RlcGVuZGVuY3lNZXRhZGF0YShcbiAgICAgIHRva2VuLCBpc0F0dHJpYnV0ZURlcCwgZmFjYWRlLmhvc3QsIGZhY2FkZS5vcHRpb25hbCwgZmFjYWRlLnNlbGYsIGZhY2FkZS5za2lwU2VsZik7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGEoZmFjYWRlOiBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUpOlxuICAgIFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgY29uc3QgaXNBdHRyaWJ1dGVEZXAgPSBmYWNhZGUuYXR0cmlidXRlID8/IGZhbHNlO1xuICBjb25zdCB0b2tlbiA9IGZhY2FkZS50b2tlbiA9PT0gbnVsbCA/IG51bGwgOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50b2tlbik7XG4gIHJldHVybiBjcmVhdGVSM0RlcGVuZGVuY3lNZXRhZGF0YShcbiAgICAgIHRva2VuLCBpc0F0dHJpYnV0ZURlcCwgZmFjYWRlLmhvc3QgPz8gZmFsc2UsIGZhY2FkZS5vcHRpb25hbCA/PyBmYWxzZSwgZmFjYWRlLnNlbGYgPz8gZmFsc2UsXG4gICAgICBmYWNhZGUuc2tpcFNlbGYgPz8gZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVSM0RlcGVuZGVuY3lNZXRhZGF0YShcbiAgICB0b2tlbjogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fG51bGwsIGlzQXR0cmlidXRlRGVwOiBib29sZWFuLCBob3N0OiBib29sZWFuLCBvcHRpb25hbDogYm9vbGVhbixcbiAgICBzZWxmOiBib29sZWFuLCBza2lwU2VsZjogYm9vbGVhbik6IFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgLy8gSWYgdGhlIGRlcCBpcyBhbiBgQEF0dHJpYnV0ZSgpYCB0aGUgYGF0dHJpYnV0ZU5hbWVUeXBlYCBvdWdodCB0byBiZSB0aGUgYHVua25vd25gIHR5cGUuXG4gIC8vIEJ1dCB0eXBlcyBhcmUgbm90IGF2YWlsYWJsZSBhdCBydW50aW1lIHNvIHdlIGp1c3QgdXNlIGEgbGl0ZXJhbCBgXCI8dW5rbm93bj5cImAgc3RyaW5nIGFzIGEgZHVtbXlcbiAgLy8gbWFya2VyLlxuICBjb25zdCBhdHRyaWJ1dGVOYW1lVHlwZSA9IGlzQXR0cmlidXRlRGVwID8gbGl0ZXJhbCgndW5rbm93bicpIDogbnVsbDtcbiAgcmV0dXJuIHt0b2tlbiwgYXR0cmlidXRlTmFtZVR5cGUsIGhvc3QsIG9wdGlvbmFsLCBzZWxmLCBza2lwU2VsZn07XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RIb3N0QmluZGluZ3MoXG4gICAgcHJvcE1ldGFkYXRhOiB7W2tleTogc3RyaW5nXTogYW55W119LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgaG9zdD86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgLy8gRmlyc3QgcGFyc2UgdGhlIGRlY2xhcmF0aW9ucyBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgY29uc3QgYmluZGluZ3MgPSBwYXJzZUhvc3RCaW5kaW5ncyhob3N0IHx8IHt9KTtcblxuICAvLyBBZnRlciB0aGF0IGNoZWNrIGhvc3QgYmluZGluZ3MgZm9yIGVycm9yc1xuICBjb25zdCBlcnJvcnMgPSB2ZXJpZnlIb3N0QmluZGluZ3MoYmluZGluZ3MsIHNvdXJjZVNwYW4pO1xuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubWFwKChlcnJvcjogUGFyc2VFcnJvcikgPT4gZXJyb3IubXNnKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICAvLyBOZXh0LCBsb29wIG92ZXIgdGhlIHByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCwgbG9va2luZyBmb3IgQEhvc3RCaW5kaW5nIGFuZCBASG9zdExpc3RlbmVyLlxuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSG9zdEJpbmRpbmcoYW5uKSkge1xuICAgICAgICAgIC8vIFNpbmNlIHRoaXMgaXMgYSBkZWNvcmF0b3IsIHdlIGtub3cgdGhhdCB0aGUgdmFsdWUgaXMgYSBjbGFzcyBtZW1iZXIuIEFsd2F5cyBhY2Nlc3MgaXRcbiAgICAgICAgICAvLyB0aHJvdWdoIGB0aGlzYCBzbyB0aGF0IGZ1cnRoZXIgZG93biB0aGUgbGluZSBpdCBjYW4ndCBiZSBjb25mdXNlZCBmb3IgYSBsaXRlcmFsIHZhbHVlXG4gICAgICAgICAgLy8gKGUuZy4gaWYgdGhlcmUncyBhIHByb3BlcnR5IGNhbGxlZCBgdHJ1ZWApLlxuICAgICAgICAgIGJpbmRpbmdzLnByb3BlcnRpZXNbYW5uLmhvc3RQcm9wZXJ0eU5hbWUgfHwgZmllbGRdID1cbiAgICAgICAgICAgICAgZ2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nKCd0aGlzJywgZmllbGQpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9zdExpc3RlbmVyKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5saXN0ZW5lcnNbYW5uLmV2ZW50TmFtZSB8fCBmaWVsZF0gPSBgJHtmaWVsZH0oJHsoYW5uLmFyZ3MgfHwgW10pLmpvaW4oJywnKX0pYDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJpbmRpbmdzO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RCaW5kaW5nKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0QmluZGluZyB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RCaW5kaW5nJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0TGlzdGVuZXIodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RMaXN0ZW5lciB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RMaXN0ZW5lcic7XG59XG5cblxuZnVuY3Rpb24gaXNJbnB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgSW5wdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdJbnB1dCc7XG59XG5cbmZ1bmN0aW9uIGlzT3V0cHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBPdXRwdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdPdXRwdXQnO1xufVxuXG5mdW5jdGlvbiBpbnB1dHNNYXBwaW5nVG9JbnB1dE1ldGFkYXRhKFxuICAgIGlucHV0czogUmVjb3JkPHN0cmluZywgc3RyaW5nfFtzdHJpbmcsIHN0cmluZywgSW5wdXRUcmFuc2Zvcm1GdW5jdGlvbj9dPikge1xuICByZXR1cm4gT2JqZWN0LmtleXMoaW5wdXRzKS5yZWR1Y2U8SW5wdXRNYXA+KChyZXN1bHQsIGtleSkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gaW5wdXRzW2tleV07XG5cbiAgICAvLyBUT0RPKGNyaXNiZXRvKTogcmVzb2x2ZSB0cmFuc2Zvcm0gZnVuY3Rpb24gcmVmZXJlbmNlIGhlcmUuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJlc3VsdFtrZXldID0ge1xuICAgICAgICBiaW5kaW5nUHJvcGVydHlOYW1lOiB2YWx1ZSxcbiAgICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IHZhbHVlLFxuICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBudWxsXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRba2V5XSA9IHtcbiAgICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogdmFsdWVbMF0sXG4gICAgICAgIGNsYXNzUHJvcGVydHlOYW1lOiB2YWx1ZVsxXSxcbiAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICB0cmFuc2Zvcm1GdW5jdGlvbjogbnVsbFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LCB7fSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW5wdXRzQXJyYXkodmFsdWVzOiAoc3RyaW5nfHtuYW1lOiBzdHJpbmcsIGFsaWFzPzogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW59KVtdKSB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlPElucHV0TWFwPigocmVzdWx0cywgdmFsdWUpID0+IHtcbiAgICAvLyBUT0RPKGNyaXNiZXRvKTogcmVzb2x2ZSB0cmFuc2Zvcm0gZnVuY3Rpb24gcmVmZXJlbmNlIGhlcmUuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IFtiaW5kaW5nUHJvcGVydHlOYW1lLCBjbGFzc1Byb3BlcnR5TmFtZV0gPSBwYXJzZU1hcHBpbmdTdHJpbmcodmFsdWUpO1xuICAgICAgcmVzdWx0c1tjbGFzc1Byb3BlcnR5TmFtZV0gPVxuICAgICAgICAgIHtiaW5kaW5nUHJvcGVydHlOYW1lLCBjbGFzc1Byb3BlcnR5TmFtZSwgcmVxdWlyZWQ6IGZhbHNlLCB0cmFuc2Zvcm1GdW5jdGlvbjogbnVsbH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdHNbdmFsdWUubmFtZV0gPSB7XG4gICAgICAgIGJpbmRpbmdQcm9wZXJ0eU5hbWU6IHZhbHVlLmFsaWFzIHx8IHZhbHVlLm5hbWUsXG4gICAgICAgIGNsYXNzUHJvcGVydHlOYW1lOiB2YWx1ZS5uYW1lLFxuICAgICAgICByZXF1aXJlZDogdmFsdWUucmVxdWlyZWQgfHwgZmFsc2UsXG4gICAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBudWxsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSwge30pO1xufVxuXG5mdW5jdGlvbiBwYXJzZU1hcHBpbmdTdHJpbmdBcnJheSh2YWx1ZXM6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlPFJlY29yZDxzdHJpbmcsIHN0cmluZz4+KChyZXN1bHRzLCB2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IFthbGlhcywgZmllbGROYW1lXSA9IHBhcnNlTWFwcGluZ1N0cmluZyh2YWx1ZSk7XG4gICAgcmVzdWx0c1tmaWVsZE5hbWVdID0gYWxpYXM7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0sIHt9KTtcbn1cblxuZnVuY3Rpb24gcGFyc2VNYXBwaW5nU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBbYWxpYXM6IHN0cmluZywgZmllbGROYW1lOiBzdHJpbmddIHtcbiAgLy8gRWl0aGVyIHRoZSB2YWx1ZSBpcyAnZmllbGQnIG9yICdmaWVsZDogcHJvcGVydHknLiBJbiB0aGUgZmlyc3QgY2FzZSwgYHByb3BlcnR5YCB3aWxsXG4gIC8vIGJlIHVuZGVmaW5lZCwgaW4gd2hpY2ggY2FzZSB0aGUgZmllbGQgbmFtZSBzaG91bGQgYWxzbyBiZSB1c2VkIGFzIHRoZSBwcm9wZXJ0eSBuYW1lLlxuICBjb25zdCBbZmllbGROYW1lLCBiaW5kaW5nUHJvcGVydHlOYW1lXSA9IHZhbHVlLnNwbGl0KCc6JywgMikubWFwKHN0ciA9PiBzdHIudHJpbSgpKTtcbiAgcmV0dXJuIFtiaW5kaW5nUHJvcGVydHlOYW1lID8/IGZpZWxkTmFtZSwgZmllbGROYW1lXTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVQaXBlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlUGlwZUZhY2FkZSk6IFIzUGlwZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICBwaXBlTmFtZTogZGVjbGFyYXRpb24ubmFtZSxcbiAgICBkZXBzOiBudWxsLFxuICAgIHB1cmU6IGRlY2xhcmF0aW9uLnB1cmUgPz8gdHJ1ZSxcbiAgICBpc1N0YW5kYWxvbmU6IGRlY2xhcmF0aW9uLmlzU3RhbmRhbG9uZSA/PyBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVJbmplY3RvckZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZUluamVjdG9yRmFjYWRlKTpcbiAgICBSM0luamVjdG9yTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgJiYgZGVjbGFyYXRpb24ucHJvdmlkZXJzLmxlbmd0aCA+IDAgP1xuICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICBudWxsLFxuICAgIGltcG9ydHM6IGRlY2xhcmF0aW9uLmltcG9ydHMgIT09IHVuZGVmaW5lZCA/XG4gICAgICAgIGRlY2xhcmF0aW9uLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSkgOlxuICAgICAgICBbXSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1Ymxpc2hGYWNhZGUoZ2xvYmFsOiBhbnkpIHtcbiAgY29uc3Qgbmc6IEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUgPSBnbG9iYWwubmcgfHwgKGdsb2JhbC5uZyA9IHt9KTtcbiAgbmcuybVjb21waWxlckZhY2FkZSA9IG5ldyBDb21waWxlckZhY2FkZUltcGwoKTtcbn1cbiJdfQ==