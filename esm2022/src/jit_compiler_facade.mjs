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
                        required: ann.required || false
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
        result[key] = typeof value === 'string' ?
            { bindingPropertyName: value, classPropertyName: value, required: false } :
            { bindingPropertyName: value[0], classPropertyName: value[1], required: false };
        return result;
    }, {});
}
function parseInputsArray(values) {
    return values.reduce((results, value) => {
        if (typeof value === 'string') {
            const [bindingPropertyName, classPropertyName] = parseMappingString(value);
            results[classPropertyName] = { bindingPropertyName, classPropertyName, required: false };
        }
        else {
            results[value.name] = {
                bindingPropertyName: value.alias || value.name,
                classPropertyName: value.name,
                required: value.required || false
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsdUJBQXVCLEVBQTRDLGlCQUFpQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzVHLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ25HLE9BQU8sRUFBQyxjQUFjLEVBQWMsT0FBTyxFQUFFLFdBQVcsRUFBYSxZQUFZLEVBQUUsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDL0gsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBOEIsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDOUUsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGFBQWEsRUFBdUIsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRyxPQUFPLEVBQUMsZUFBZSxFQUFxQixNQUFNLGdDQUFnQyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsZUFBZSxFQUFFLG9DQUFvQyxFQUFzQixtQkFBbUIsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQzVJLE9BQU8sRUFBQyx1QkFBdUIsRUFBaUIsTUFBTSw0QkFBNEIsQ0FBQztBQUNuRixPQUFPLEVBQUMsK0JBQStCLEVBQXNCLDJCQUEyQixFQUE2QixhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxSixPQUFPLEVBQTZNLHdCQUF3QixFQUEr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QUMsQ0FBQyxDQUFDO1lBQ2hGLElBQUksZUFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzVDLElBQUk7UUFDUixPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQztZQUN4QyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxFQUFFO0tBQ1AsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLE1BQVc7SUFDdkMsTUFBTSxFQUFFLEdBQTJCLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLEVBQUUsQ0FBQyxlQUFlLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVyRmFjYWRlLCBDb3JlRW52aXJvbm1lbnQsIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUsIElucHV0TWFwLCBPcGFxdWVWYWx1ZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlLCBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGVjbGFyZURpcmVjdGl2ZURlcGVuZGVuY3lGYWNhZGUsIFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSwgUjNEZWNsYXJlRmFjdG9yeUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0YWJsZUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUsIFIzRGVjbGFyZU5nTW9kdWxlRmFjYWRlLCBSM0RlY2xhcmVQaXBlRGVwZW5kZW5jeUZhY2FkZSwgUjNEZWNsYXJlUGlwZUZhY2FkZSwgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YUZhY2FkZSwgUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlLCBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlLCBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUsIFIzUGlwZU1ldGFkYXRhRmFjYWRlLCBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUsIFIzVGVtcGxhdGVEZXBlbmRlbmN5RmFjYWRlfSBmcm9tICcuL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7Y29tcGlsZUluamVjdGFibGV9IGZyb20gJy4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtEZWNsYXJlVmFyU3RtdCwgRXhwcmVzc2lvbiwgbGl0ZXJhbCwgTGl0ZXJhbEV4cHIsIFN0YXRlbWVudCwgU3RtdE1vZGlmaWVyLCBXcmFwcGVkTm9kZUV4cHJ9IGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtKaXRFdmFsdWF0b3J9IGZyb20gJy4vb3V0cHV0L291dHB1dF9qaXQnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHIzSml0VHlwZVNvdXJjZVNwYW59IGZyb20gJy4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIEZhY3RvcnlUYXJnZXQsIFIzRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5pbXBvcnQge2NvbXBpbGVJbmplY3RvciwgUjNJbmplY3Rvck1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfaW5qZWN0b3JfY29tcGlsZXInO1xuaW1wb3J0IHtSM0ppdFJlZmxlY3Rvcn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ppdCc7XG5pbXBvcnQge2NvbXBpbGVOZ01vZHVsZSwgY29tcGlsZU5nTW9kdWxlRGVjbGFyYXRpb25FeHByZXNzaW9uLCBSM05nTW9kdWxlTWV0YWRhdGEsIFIzU2VsZWN0b3JTY29wZU1vZGV9IGZyb20gJy4vcmVuZGVyMy9yM19tb2R1bGVfY29tcGlsZXInO1xuaW1wb3J0IHtjb21waWxlUGlwZUZyb21NZXRhZGF0YSwgUjNQaXBlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19waXBlX2NvbXBpbGVyJztcbmltcG9ydCB7Y3JlYXRlTWF5QmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgRm9yd2FyZFJlZkhhbmRsaW5nLCBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmcsIE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24sIHdyYXBSZWZlcmVuY2V9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3REaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUGlwZURlcGVuZGVuY3lNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhLCBSM1RlbXBsYXRlRGVwZW5kZW5jeSwgUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLCBSM1RlbXBsYXRlRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBQYXJzZWRIb3N0QmluZGluZ3MsIHBhcnNlSG9zdEJpbmRpbmdzLCB2ZXJpZnlIb3N0QmluZGluZ3N9IGZyb20gJy4vcmVuZGVyMy92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7bWFrZUJpbmRpbmdQYXJzZXIsIHBhcnNlVGVtcGxhdGV9IGZyb20gJy4vcmVuZGVyMy92aWV3L3RlbXBsYXRlJztcbmltcG9ydCB7UmVzb3VyY2VMb2FkZXJ9IGZyb20gJy4vcmVzb3VyY2VfbG9hZGVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuXG5leHBvcnQgY2xhc3MgQ29tcGlsZXJGYWNhZGVJbXBsIGltcGxlbWVudHMgQ29tcGlsZXJGYWNhZGUge1xuICBGYWN0b3J5VGFyZ2V0ID0gRmFjdG9yeVRhcmdldCBhcyBhbnk7XG4gIFJlc291cmNlTG9hZGVyID0gUmVzb3VyY2VMb2FkZXI7XG4gIHByaXZhdGUgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaml0RXZhbHVhdG9yID0gbmV3IEppdEV2YWx1YXRvcigpKSB7fVxuXG4gIGNvbXBpbGVQaXBlKGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBmYWNhZGU6IFIzUGlwZU1ldGFkYXRhRmFjYWRlKTpcbiAgICAgIGFueSB7XG4gICAgY29uc3QgbWV0YWRhdGE6IFIzUGlwZU1ldGFkYXRhID0ge1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgICAgZGVwczogbnVsbCxcbiAgICAgIHBpcGVOYW1lOiBmYWNhZGUucGlwZU5hbWUsXG4gICAgICBwdXJlOiBmYWNhZGUucHVyZSxcbiAgICAgIGlzU3RhbmRhbG9uZTogZmFjYWRlLmlzU3RhbmRhbG9uZSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGFkYXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlUGlwZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlUGlwZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlUGlwZUZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24pO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB7ZXhwcmVzc2lvbiwgc3RhdGVtZW50c30gPSBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgICAgIHR5cGVBcmd1bWVudENvdW50OiBmYWNhZGUudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICAgICAgcHJvdmlkZWRJbjogY29tcHV0ZVByb3ZpZGVkSW4oZmFjYWRlLnByb3ZpZGVkSW4pLFxuICAgICAgICAgIHVzZUNsYXNzOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCAndXNlQ2xhc3MnKSxcbiAgICAgICAgICB1c2VGYWN0b3J5OiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsICd1c2VGYWN0b3J5JyksXG4gICAgICAgICAgdXNlVmFsdWU6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsICd1c2VWYWx1ZScpLFxuICAgICAgICAgIHVzZUV4aXN0aW5nOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCAndXNlRXhpc3RpbmcnKSxcbiAgICAgICAgICBkZXBzOiBmYWNhZGUuZGVwcz8ubWFwKGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YSksXG4gICAgICAgIH0sXG4gICAgICAgIC8qIHJlc29sdmVGb3J3YXJkUmVmcyAqLyB0cnVlKTtcblxuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0YWJsZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzRGVjbGFyZUluamVjdGFibGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHtleHByZXNzaW9uLCBzdGF0ZW1lbnRzfSA9IGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogZmFjYWRlLnR5cGUubmFtZSxcbiAgICAgICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICAgICAgdXNlQ2xhc3M6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsICd1c2VDbGFzcycpLFxuICAgICAgICAgIHVzZUZhY3Rvcnk6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZUZhY3RvcnknKSxcbiAgICAgICAgICB1c2VWYWx1ZTogY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZVZhbHVlJyksXG4gICAgICAgICAgdXNlRXhpc3Rpbmc6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsICd1c2VFeGlzdGluZycpLFxuICAgICAgICAgIGRlcHM6IGZhY2FkZS5kZXBzPy5tYXAoY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YSksXG4gICAgICAgIH0sXG4gICAgICAgIC8qIHJlc29sdmVGb3J3YXJkUmVmcyAqLyB0cnVlKTtcblxuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0b3IoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICYmIGZhY2FkZS5wcm92aWRlcnMubGVuZ3RoID4gMCA/XG4gICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSA6XG4gICAgICAgICAgbnVsbCxcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcChpID0+IG5ldyBXcmFwcGVkTm9kZUV4cHIoaSkpLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUluamVjdG9yKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvckRlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZUluamVjdG9yRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbik7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUluamVjdG9yKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSA9IHtcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgYm9vdHN0cmFwOiBmYWNhZGUuYm9vdHN0cmFwLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGRlY2xhcmF0aW9uczogZmFjYWRlLmRlY2xhcmF0aW9ucy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBwdWJsaWNEZWNsYXJhdGlvblR5cGVzOiBudWxsLCAgLy8gb25seSBuZWVkZWQgZm9yIHR5cGVzIGluIEFPVFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgaW5jbHVkZUltcG9ydFR5cGVzOiB0cnVlLFxuICAgICAgZXhwb3J0czogZmFjYWRlLmV4cG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgc2VsZWN0b3JTY29wZU1vZGU6IFIzU2VsZWN0b3JTY29wZU1vZGUuSW5saW5lLFxuICAgICAgY29udGFpbnNGb3J3YXJkRGVjbHM6IGZhbHNlLFxuICAgICAgc2NoZW1hczogZmFjYWRlLnNjaGVtYXMgPyBmYWNhZGUuc2NoZW1hcy5tYXAod3JhcFJlZmVyZW5jZSkgOiBudWxsLFxuICAgICAgaWQ6IGZhY2FkZS5pZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmlkKSA6IG51bGwsXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlTmdNb2R1bGUobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZU5nTW9kdWxlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVOZ01vZHVsZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IGNvbXBpbGVOZ01vZHVsZURlY2xhcmF0aW9uRXhwcmVzc2lvbihkZWNsYXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgPSBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBtZXRhKTtcbiAgfVxuXG4gIGNvbXBpbGVEaXJlY3RpdmVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgdHlwZVNvdXJjZVNwYW4gPVxuICAgICAgICB0aGlzLmNyZWF0ZVBhcnNlU291cmNlU3BhbignRGlyZWN0aXZlJywgZGVjbGFyYXRpb24udHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwpO1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZURpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24sIHR5cGVTb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBwcml2YXRlIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogYW55IHtcbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG4gICAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBjb25zdGFudFBvb2wuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIC8vIFBhcnNlIHRoZSB0ZW1wbGF0ZSBhbmQgY2hlY2sgZm9yIGVycm9ycy5cbiAgICBjb25zdCB7dGVtcGxhdGUsIGludGVycG9sYXRpb259ID0gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICAgICAgZmFjYWRlLnRlbXBsYXRlLCBmYWNhZGUubmFtZSwgc291cmNlTWFwVXJsLCBmYWNhZGUucHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgICAgZmFjYWRlLmludGVycG9sYXRpb24pO1xuXG4gICAgLy8gQ29tcGlsZSB0aGUgY29tcG9uZW50IG1ldGFkYXRhLCBpbmNsdWRpbmcgdGVtcGxhdGUsIGludG8gYW4gZXhwcmVzc2lvbi5cbiAgICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5PiA9IHtcbiAgICAgIC4uLmZhY2FkZSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICAgIC4uLmNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSksXG4gICAgICBzZWxlY3RvcjogZmFjYWRlLnNlbGVjdG9yIHx8IHRoaXMuZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LmdldERlZmF1bHRDb21wb25lbnRFbGVtZW50TmFtZSgpLFxuICAgICAgdGVtcGxhdGUsXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKGNvbnZlcnREZWNsYXJhdGlvbkZhY2FkZVRvTWV0YWRhdGEpLFxuICAgICAgZGVjbGFyYXRpb25MaXN0RW1pdE1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCxcbiAgICAgIHN0eWxlczogWy4uLmZhY2FkZS5zdHlsZXMsIC4uLnRlbXBsYXRlLnN0eWxlc10sXG4gICAgICBlbmNhcHN1bGF0aW9uOiBmYWNhZGUuZW5jYXBzdWxhdGlvbiBhcyBhbnksXG4gICAgICBpbnRlcnBvbGF0aW9uLFxuICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBmYWNhZGUuY2hhbmdlRGV0ZWN0aW9uLFxuICAgICAgYW5pbWF0aW9uczogZmFjYWRlLmFuaW1hdGlvbnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmFuaW1hdGlvbnMpIDogbnVsbCxcbiAgICAgIHZpZXdQcm92aWRlcnM6IGZhY2FkZS52aWV3UHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgICB9O1xuICAgIGNvbnN0IGppdEV4cHJlc3Npb25Tb3VyY2VNYXAgPSBgbmc6Ly8vJHtmYWNhZGUubmFtZX0uanNgO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgaml0RXhwcmVzc2lvblNvdXJjZU1hcCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50RGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0NvbXBvbmVudCcsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVDb21wb25lbnRGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbiwgc291cmNlTWFwVXJsKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlQ29tcG9uZW50RnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBwcml2YXRlIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4pOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIobWV0YS5pbnRlcnBvbGF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgcmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKSB7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgbmFtZTogbWV0YS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShtZXRhLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IG1ldGEudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBkZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShtZXRhLmRlcHMpLFxuICAgICAgdGFyZ2V0OiBtZXRhLnRhcmdldCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICBmYWN0b3J5UmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGZhY3RvcnlSZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlRmFjdG9yeURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRGVjbGFyZUZhY3RvcnlGYWNhZGUpIHtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICBuYW1lOiBtZXRhLnR5cGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgICAgZGVwczogQXJyYXkuaXNBcnJheShtZXRhLmRlcHMpID8gbWV0YS5kZXBzLm1hcChjb252ZXJ0UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhLmRlcHMsXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG5cbiAgY3JlYXRlUGFyc2VTb3VyY2VTcGFuKGtpbmQ6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHJldHVybiByM0ppdFR5cGVTb3VyY2VTcGFuKGtpbmQsIHR5cGVOYW1lLCBzb3VyY2VVcmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEpJVCBjb21waWxlcyBhbiBleHByZXNzaW9uIGFuZCByZXR1cm5zIHRoZSByZXN1bHQgb2YgZXhlY3V0aW5nIHRoYXQgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGRlZiB0aGUgZGVmaW5pdGlvbiB3aGljaCB3aWxsIGJlIGNvbXBpbGVkIGFuZCBleGVjdXRlZCB0byBnZXQgdGhlIHZhbHVlIHRvIHBhdGNoXG4gICAqIEBwYXJhbSBjb250ZXh0IGFuIG9iamVjdCBtYXAgb2YgQGFuZ3VsYXIvY29yZSBzeW1ib2wgbmFtZXMgdG8gc3ltYm9scyB3aGljaCB3aWxsIGJlIGF2YWlsYWJsZVxuICAgKiBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gc291cmNlVXJsIGEgVVJMIHRvIHVzZSBmb3IgdGhlIHNvdXJjZSBtYXAgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHByZVN0YXRlbWVudHMgYSBjb2xsZWN0aW9uIG9mIHN0YXRlbWVudHMgdGhhdCBzaG91bGQgYmUgZXZhbHVhdGVkIGJlZm9yZSB0aGUgZXhwcmVzc2lvbi5cbiAgICovXG4gIHByaXZhdGUgaml0RXhwcmVzc2lvbihcbiAgICAgIGRlZjogRXhwcmVzc2lvbiwgY29udGV4dDoge1trZXk6IHN0cmluZ106IGFueX0sIHNvdXJjZVVybDogc3RyaW5nLFxuICAgICAgcHJlU3RhdGVtZW50czogU3RhdGVtZW50W10pOiBhbnkge1xuICAgIC8vIFRoZSBDb25zdGFudFBvb2wgbWF5IGNvbnRhaW4gU3RhdGVtZW50cyB3aGljaCBkZWNsYXJlIHZhcmlhYmxlcyB1c2VkIGluIHRoZSBmaW5hbCBleHByZXNzaW9uLlxuICAgIC8vIFRoZXJlZm9yZSwgaXRzIHN0YXRlbWVudHMgbmVlZCB0byBwcmVjZWRlIHRoZSBhY3R1YWwgSklUIG9wZXJhdGlvbi4gVGhlIGZpbmFsIHN0YXRlbWVudCBpcyBhXG4gICAgLy8gZGVjbGFyYXRpb24gb2YgJGRlZiB3aGljaCBpcyBzZXQgdG8gdGhlIGV4cHJlc3Npb24gYmVpbmcgY29tcGlsZWQuXG4gICAgY29uc3Qgc3RhdGVtZW50czogU3RhdGVtZW50W10gPSBbXG4gICAgICAuLi5wcmVTdGF0ZW1lbnRzLFxuICAgICAgbmV3IERlY2xhcmVWYXJTdG10KCckZGVmJywgZGVmLCB1bmRlZmluZWQsIFN0bXRNb2RpZmllci5FeHBvcnRlZCksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuaml0RXZhbHVhdG9yLmV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIC8qIGVuYWJsZVNvdXJjZU1hcHMgKi8gdHJ1ZSk7XG4gICAgcmV0dXJuIHJlc1snJGRlZiddO1xuICB9XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID0gUGljazxcbiAgICBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLFxuICAgIEV4Y2x1ZGU8RXhjbHVkZTxrZXlvZiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCAncHJlc2VydmVXaGl0ZXNwYWNlcyc+LCAncHJvcE1ldGFkYXRhJz4+O1xuXG5mdW5jdGlvbiBjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEoZmFjYWRlOiBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUpOiBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICBwcmVkaWNhdGU6IGNvbnZlcnRRdWVyeVByZWRpY2F0ZShmYWNhZGUucHJlZGljYXRlKSxcbiAgICByZWFkOiBmYWNhZGUucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGZhY2FkZS5zdGF0aWMsXG4gICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6IGZhY2FkZS5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFF1ZXJ5RGVjbGFyYXRpb25Ub01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlKTpcbiAgICBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIHByb3BlcnR5TmFtZTogZGVjbGFyYXRpb24ucHJvcGVydHlOYW1lLFxuICAgIGZpcnN0OiBkZWNsYXJhdGlvbi5maXJzdCA/PyBmYWxzZSxcbiAgICBwcmVkaWNhdGU6IGNvbnZlcnRRdWVyeVByZWRpY2F0ZShkZWNsYXJhdGlvbi5wcmVkaWNhdGUpLFxuICAgIGRlc2NlbmRhbnRzOiBkZWNsYXJhdGlvbi5kZXNjZW5kYW50cyA/PyBmYWxzZSxcbiAgICByZWFkOiBkZWNsYXJhdGlvbi5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5yZWFkKSA6IG51bGwsXG4gICAgc3RhdGljOiBkZWNsYXJhdGlvbi5zdGF0aWMgPz8gZmFsc2UsXG4gICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6IGRlY2xhcmF0aW9uLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID8/IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRRdWVyeVByZWRpY2F0ZShwcmVkaWNhdGU6IE9wYXF1ZVZhbHVlfHN0cmluZ1tdKTogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbnxcbiAgICBzdHJpbmdbXSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHByZWRpY2F0ZSkgP1xuICAgICAgLy8gVGhlIHByZWRpY2F0ZSBpcyBhbiBhcnJheSBvZiBzdHJpbmdzIHNvIHBhc3MgaXQgdGhyb3VnaC5cbiAgICAgIHByZWRpY2F0ZSA6XG4gICAgICAvLyBUaGUgcHJlZGljYXRlIGlzIGEgdHlwZSAtIGFzc3VtZSB0aGF0IHdlIHdpbGwgbmVlZCB0byB1bndyYXAgYW55IGBmb3J3YXJkUmVmKClgIGNhbGxzLlxuICAgICAgY3JlYXRlTWF5QmVGb3J3YXJkUmVmRXhwcmVzc2lvbihuZXcgV3JhcHBlZE5vZGVFeHByKHByZWRpY2F0ZSksIEZvcndhcmRSZWZIYW5kbGluZy5XcmFwcGVkKTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRzQXJyYXkoZmFjYWRlLmlucHV0cyB8fCBbXSk7XG4gIGNvbnN0IG91dHB1dHNGcm9tTWV0YWRhdGEgPSBwYXJzZU1hcHBpbmdTdHJpbmdBcnJheShmYWNhZGUub3V0cHV0cyB8fCBbXSk7XG4gIGNvbnN0IHByb3BNZXRhZGF0YSA9IGZhY2FkZS5wcm9wTWV0YWRhdGE7XG4gIGNvbnN0IGlucHV0c0Zyb21UeXBlOiBJbnB1dE1hcCA9IHt9O1xuICBjb25zdCBvdXRwdXRzRnJvbVR5cGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBmaWVsZCBpbiBwcm9wTWV0YWRhdGEpIHtcbiAgICBpZiAocHJvcE1ldGFkYXRhLmhhc093blByb3BlcnR5KGZpZWxkKSkge1xuICAgICAgcHJvcE1ldGFkYXRhW2ZpZWxkXS5mb3JFYWNoKGFubiA9PiB7XG4gICAgICAgIGlmIChpc0lucHV0KGFubikpIHtcbiAgICAgICAgICBpbnB1dHNGcm9tVHlwZVtmaWVsZF0gPSB7XG4gICAgICAgICAgICBiaW5kaW5nUHJvcGVydHlOYW1lOiBhbm4uYWxpYXMgfHwgZmllbGQsXG4gICAgICAgICAgICBjbGFzc1Byb3BlcnR5TmFtZTogZmllbGQsXG4gICAgICAgICAgICByZXF1aXJlZDogYW5uLnJlcXVpcmVkIHx8IGZhbHNlXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChpc091dHB1dChhbm4pKSB7XG4gICAgICAgICAgb3V0cHV0c0Zyb21UeXBlW2ZpZWxkXSA9IGFubi5hbGlhcyB8fCBmaWVsZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5mYWNhZGUgYXMgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgdHlwZVNvdXJjZVNwYW46IGZhY2FkZS50eXBlU291cmNlU3BhbixcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICBkZXBzOiBudWxsLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLnByb3BNZXRhZGF0YSwgZmFjYWRlLnR5cGVTb3VyY2VTcGFuLCBmYWNhZGUuaG9zdCksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gICAgaG9zdERpcmVjdGl2ZXM6IGNvbnZlcnRIb3N0RGlyZWN0aXZlc1RvTWV0YWRhdGEoZmFjYWRlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKFxuICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICB0eXBlU291cmNlU3BhbixcbiAgICBzZWxlY3RvcjogZGVjbGFyYXRpb24uc2VsZWN0b3IgPz8gbnVsbCxcbiAgICBpbnB1dHM6IGRlY2xhcmF0aW9uLmlucHV0cyA/IGlucHV0c01hcHBpbmdUb0lucHV0TWV0YWRhdGEoZGVjbGFyYXRpb24uaW5wdXRzKSA6IHt9LFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8ge30sXG4gICAgaG9zdDogY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb24uaG9zdCksXG4gICAgcXVlcmllczogKGRlY2xhcmF0aW9uLnF1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHZpZXdRdWVyaWVzOiAoZGVjbGFyYXRpb24udmlld1F1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZGVjbGFyYXRpb24udXNlc0luaGVyaXRhbmNlID8/IGZhbHNlLFxuICAgIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGRlY2xhcmF0aW9uLnVzZXNPbkNoYW5nZXMgPz8gZmFsc2V9LFxuICAgIGRlcHM6IG51bGwsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgICBpc1N0YW5kYWxvbmU6IGRlY2xhcmF0aW9uLmlzU3RhbmRhbG9uZSA/PyBmYWxzZSxcbiAgICBob3N0RGlyZWN0aXZlczogY29udmVydEhvc3REaXJlY3RpdmVzVG9NZXRhZGF0YShkZWNsYXJhdGlvbiksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRIb3N0RGVjbGFyYXRpb25Ub01ldGFkYXRhKGhvc3Q6IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZVsnaG9zdCddID0ge30pOlxuICAgIFIzSG9zdE1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBhdHRyaWJ1dGVzOiBjb252ZXJ0T3BhcXVlVmFsdWVzVG9FeHByZXNzaW9ucyhob3N0LmF0dHJpYnV0ZXMgPz8ge30pLFxuICAgIGxpc3RlbmVyczogaG9zdC5saXN0ZW5lcnMgPz8ge30sXG4gICAgcHJvcGVydGllczogaG9zdC5wcm9wZXJ0aWVzID8/IHt9LFxuICAgIHNwZWNpYWxBdHRyaWJ1dGVzOiB7XG4gICAgICBjbGFzc0F0dHI6IGhvc3QuY2xhc3NBdHRyaWJ1dGUsXG4gICAgICBzdHlsZUF0dHI6IGhvc3Quc3R5bGVBdHRyaWJ1dGUsXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydEhvc3REaXJlY3RpdmVzVG9NZXRhZGF0YShcbiAgICBtZXRhZGF0YTogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlfFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0hvc3REaXJlY3RpdmVNZXRhZGF0YVtdfG51bGwge1xuICBpZiAobWV0YWRhdGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIHJldHVybiBtZXRhZGF0YS5ob3N0RGlyZWN0aXZlcy5tYXAoaG9zdERpcmVjdGl2ZSA9PiB7XG4gICAgICByZXR1cm4gdHlwZW9mIGhvc3REaXJlY3RpdmUgPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGRpcmVjdGl2ZTogd3JhcFJlZmVyZW5jZShob3N0RGlyZWN0aXZlKSxcbiAgICAgICAgICAgIGlucHV0czogbnVsbCxcbiAgICAgICAgICAgIG91dHB1dHM6IG51bGwsXG4gICAgICAgICAgICBpc0ZvcndhcmRSZWZlcmVuY2U6IGZhbHNlXG4gICAgICAgICAgfSA6XG4gICAgICAgICAge1xuICAgICAgICAgICAgZGlyZWN0aXZlOiB3cmFwUmVmZXJlbmNlKGhvc3REaXJlY3RpdmUuZGlyZWN0aXZlKSxcbiAgICAgICAgICAgIGlzRm9yd2FyZFJlZmVyZW5jZTogZmFsc2UsXG4gICAgICAgICAgICBpbnB1dHM6IGhvc3REaXJlY3RpdmUuaW5wdXRzID8gcGFyc2VNYXBwaW5nU3RyaW5nQXJyYXkoaG9zdERpcmVjdGl2ZS5pbnB1dHMpIDogbnVsbCxcbiAgICAgICAgICAgIG91dHB1dHM6IGhvc3REaXJlY3RpdmUub3V0cHV0cyA/IHBhcnNlTWFwcGluZ1N0cmluZ0FycmF5KGhvc3REaXJlY3RpdmUub3V0cHV0cykgOiBudWxsLFxuICAgICAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY29udmVydE9wYXF1ZVZhbHVlc1RvRXhwcmVzc2lvbnMob2JqOiB7W2tleTogc3RyaW5nXTogT3BhcXVlVmFsdWV9KTpcbiAgICB7W2tleTogc3RyaW5nXTogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fSB7XG4gIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IFdyYXBwZWROb2RlRXhwcjx1bmtub3duPn0gPSB7fTtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xuICAgIHJlc3VsdFtrZXldID0gbmV3IFdyYXBwZWROb2RlRXhwcihvYmpba2V5XSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVDb21wb25lbnRGYWNhZGVUb01ldGFkYXRhKFxuICAgIGRlY2w6IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBzb3VyY2VNYXBVcmw6IHN0cmluZyk6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3lNZXRhZGF0YT4ge1xuICBjb25zdCB7dGVtcGxhdGUsIGludGVycG9sYXRpb259ID0gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICAgIGRlY2wudGVtcGxhdGUsIGRlY2wudHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwsIGRlY2wucHJlc2VydmVXaGl0ZXNwYWNlcyA/PyBmYWxzZSxcbiAgICAgIGRlY2wuaW50ZXJwb2xhdGlvbik7XG5cbiAgY29uc3QgZGVjbGFyYXRpb25zOiBSM1RlbXBsYXRlRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBbXTtcbiAgaWYgKGRlY2wuZGVwZW5kZW5jaWVzKSB7XG4gICAgZm9yIChjb25zdCBpbm5lckRlcCBvZiBkZWNsLmRlcGVuZGVuY2llcykge1xuICAgICAgc3dpdGNoIChpbm5lckRlcC5raW5kKSB7XG4gICAgICAgIGNhc2UgJ2RpcmVjdGl2ZSc6XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgICAgZGVjbGFyYXRpb25zLnB1c2goY29udmVydERpcmVjdGl2ZURlY2xhcmF0aW9uVG9NZXRhZGF0YShpbm5lckRlcCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdwaXBlJzpcbiAgICAgICAgICBkZWNsYXJhdGlvbnMucHVzaChjb252ZXJ0UGlwZURlY2xhcmF0aW9uVG9NZXRhZGF0YShpbm5lckRlcCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChkZWNsLmNvbXBvbmVudHMgfHwgZGVjbC5kaXJlY3RpdmVzIHx8IGRlY2wucGlwZXMpIHtcbiAgICAvLyBFeGlzdGluZyBkZWNsYXJhdGlvbnMgb24gTlBNIG1heSBub3QgYmUgdXNpbmcgdGhlIG5ldyBgZGVwZW5kZW5jaWVzYCBtZXJnZWQgZmllbGQsIGFuZCBtYXlcbiAgICAvLyBoYXZlIHNlcGFyYXRlIGZpZWxkcyBmb3IgZGVwZW5kZW5jaWVzIGluc3RlYWQuIFVuaWZ5IHRoZW0gZm9yIEpJVCBjb21waWxhdGlvbi5cbiAgICBkZWNsLmNvbXBvbmVudHMgJiZcbiAgICAgICAgZGVjbGFyYXRpb25zLnB1c2goLi4uZGVjbC5jb21wb25lbnRzLm1hcChcbiAgICAgICAgICAgIGRpciA9PiBjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGRpciwgLyogaXNDb21wb25lbnQgKi8gdHJ1ZSkpKTtcbiAgICBkZWNsLmRpcmVjdGl2ZXMgJiZcbiAgICAgICAgZGVjbGFyYXRpb25zLnB1c2goXG4gICAgICAgICAgICAuLi5kZWNsLmRpcmVjdGl2ZXMubWFwKGRpciA9PiBjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGRpcikpKTtcbiAgICBkZWNsLnBpcGVzICYmIGRlY2xhcmF0aW9ucy5wdXNoKC4uLmNvbnZlcnRQaXBlTWFwVG9NZXRhZGF0YShkZWNsLnBpcGVzKSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShkZWNsLCB0eXBlU291cmNlU3BhbiksXG4gICAgdGVtcGxhdGUsXG4gICAgc3R5bGVzOiBkZWNsLnN0eWxlcyA/PyBbXSxcbiAgICBkZWNsYXJhdGlvbnMsXG4gICAgdmlld1Byb3ZpZGVyczogZGVjbC52aWV3UHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2wudmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICBhbmltYXRpb25zOiBkZWNsLmFuaW1hdGlvbnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbC5hbmltYXRpb25zKSA6IG51bGwsXG4gICAgY2hhbmdlRGV0ZWN0aW9uOiBkZWNsLmNoYW5nZURldGVjdGlvbiA/PyBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0LFxuICAgIGVuY2Fwc3VsYXRpb246IGRlY2wuZW5jYXBzdWxhdGlvbiA/PyBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uLFxuICAgIGRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmF0aW9uRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNUZW1wbGF0ZURlcGVuZGVuY3lGYWNhZGUpOlxuICAgIFIzVGVtcGxhdGVEZXBlbmRlbmN5IHtcbiAgcmV0dXJuIHtcbiAgICAuLi5kZWNsYXJhdGlvbixcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKFxuICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVEZXBlbmRlbmN5RmFjYWRlLFxuICAgIGlzQ29tcG9uZW50OiB0cnVlfG51bGwgPSBudWxsKTogUjNEaXJlY3RpdmVEZXBlbmRlbmN5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5EaXJlY3RpdmUsXG4gICAgaXNDb21wb25lbnQ6IGlzQ29tcG9uZW50IHx8IGRlY2xhcmF0aW9uLmtpbmQgPT09ICdjb21wb25lbnQnLFxuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvcixcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IFtdLFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8gW10sXG4gICAgZXhwb3J0QXM6IGRlY2xhcmF0aW9uLmV4cG9ydEFzID8/IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQaXBlTWFwVG9NZXRhZGF0YShwaXBlczogUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlWydwaXBlcyddKTpcbiAgICBSM1BpcGVEZXBlbmRlbmN5TWV0YWRhdGFbXSB7XG4gIGlmICghcGlwZXMpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICByZXR1cm4gT2JqZWN0LmtleXMocGlwZXMpLm1hcChuYW1lID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLlBpcGUsXG4gICAgICBuYW1lLFxuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihwaXBlc1tuYW1lXSksXG4gICAgfTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQaXBlRGVjbGFyYXRpb25Ub01ldGFkYXRhKHBpcGU6IFIzRGVjbGFyZVBpcGVEZXBlbmRlbmN5RmFjYWRlKTpcbiAgICBSM1BpcGVEZXBlbmRlbmN5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5QaXBlLFxuICAgIG5hbWU6IHBpcGUubmFtZSxcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKHBpcGUudHlwZSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlSml0VGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlTWFwVXJsOiBzdHJpbmcsIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4sXG4gICAgaW50ZXJwb2xhdGlvbjogW3N0cmluZywgc3RyaW5nXXx1bmRlZmluZWQpIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkNvbmZpZyA9XG4gICAgICBpbnRlcnBvbGF0aW9uID8gSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoaW50ZXJwb2xhdGlvbikgOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlVGVtcGxhdGUodGVtcGxhdGUsIHNvdXJjZU1hcFVybCwge3ByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgaWYgKHBhcnNlZC5lcnJvcnMgIT09IG51bGwpIHtcbiAgICBjb25zdCBlcnJvcnMgPSBwYXJzZWQuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcnMgZHVyaW5nIEpJVCBjb21waWxhdGlvbiBvZiB0ZW1wbGF0ZSBmb3IgJHt0eXBlTmFtZX06ICR7ZXJyb3JzfWApO1xuICB9XG4gIHJldHVybiB7dGVtcGxhdGU6IHBhcnNlZCwgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvbkNvbmZpZ307XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuLyoqXG4gKiBDb252ZXJ0IHRoZSBleHByZXNzaW9uLCBpZiBwcmVzZW50IHRvIGFuIGBSM1Byb3ZpZGVyRXhwcmVzc2lvbmAuXG4gKlxuICogSW4gSklUIG1vZGUgd2UgZG8gbm90IHdhbnQgdGhlIGNvbXBpbGVyIHRvIHdyYXAgdGhlIGV4cHJlc3Npb24gaW4gYSBgZm9yd2FyZFJlZigpYCBjYWxsIGJlY2F1c2UsXG4gKiBpZiBpdCBpcyByZWZlcmVuY2luZyBhIHR5cGUgdGhhdCBoYXMgbm90IHlldCBiZWVuIGRlZmluZWQsIGl0IHdpbGwgaGF2ZSBhbHJlYWR5IGJlZW4gd3JhcHBlZCBpblxuICogYSBgZm9yd2FyZFJlZigpYCAtIGVpdGhlciBieSB0aGUgYXBwbGljYXRpb24gZGV2ZWxvcGVyIG9yIGR1cmluZyBwYXJ0aWFsLWNvbXBpbGF0aW9uLiBUaHVzIHdlIGNhblxuICogdXNlIGBGb3J3YXJkUmVmSGFuZGxpbmcuTm9uZWAuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihvYmo6IGFueSwgcHJvcGVydHk6IHN0cmluZyk6IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb258XG4gICAgdW5kZWZpbmVkIHtcbiAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICByZXR1cm4gY3JlYXRlTWF5QmVGb3J3YXJkUmVmRXhwcmVzc2lvbihcbiAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihvYmpbcHJvcGVydHldKSwgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogRnVuY3Rpb258c3RyaW5nfG51bGx8dW5kZWZpbmVkKTogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ2Z1bmN0aW9uJyA/IG5ldyBXcmFwcGVkTm9kZUV4cHIocHJvdmlkZWRJbikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTGl0ZXJhbEV4cHIocHJvdmlkZWRJbiA/PyBudWxsKTtcbiAgLy8gU2VlIGBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oKWAgZm9yIHdoeSB0aGlzIHVzZXMgYEZvcndhcmRSZWZIYW5kbGluZy5Ob25lYC5cbiAgcmV0dXJuIGNyZWF0ZU1heUJlRm9yd2FyZFJlZkV4cHJlc3Npb24oZXhwcmVzc2lvbiwgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmUpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGVzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGwge1xuICByZXR1cm4gZmFjYWRlcyA9PSBudWxsID8gbnVsbCA6IGZhY2FkZXMubWFwKGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBjb25zdCBpc0F0dHJpYnV0ZURlcCA9IGZhY2FkZS5hdHRyaWJ1dGUgIT0gbnVsbDsgIC8vIGJvdGggYG51bGxgIGFuZCBgdW5kZWZpbmVkYFxuICBjb25zdCByYXdUb2tlbiA9IGZhY2FkZS50b2tlbiA9PT0gbnVsbCA/IG51bGwgOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50b2tlbik7XG4gIC8vIEluIEpJVCBtb2RlLCBpZiB0aGUgZGVwIGlzIGFuIGBAQXR0cmlidXRlKClgIHRoZW4gd2UgdXNlIHRoZSBhdHRyaWJ1dGUgbmFtZSBnaXZlbiBpblxuICAvLyBgYXR0cmlidXRlYCByYXRoZXIgdGhhbiB0aGUgYHRva2VuYC5cbiAgY29uc3QgdG9rZW4gPSBpc0F0dHJpYnV0ZURlcCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmF0dHJpYnV0ZSkgOiByYXdUb2tlbjtcbiAgcmV0dXJuIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgICAgdG9rZW4sIGlzQXR0cmlidXRlRGVwLCBmYWNhZGUuaG9zdCwgZmFjYWRlLm9wdGlvbmFsLCBmYWNhZGUuc2VsZiwgZmFjYWRlLnNraXBTZWxmKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSk6XG4gICAgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBjb25zdCBpc0F0dHJpYnV0ZURlcCA9IGZhY2FkZS5hdHRyaWJ1dGUgPz8gZmFsc2U7XG4gIGNvbnN0IHRva2VuID0gZmFjYWRlLnRva2VuID09PSBudWxsID8gbnVsbCA6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgcmV0dXJuIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgICAgdG9rZW4sIGlzQXR0cmlidXRlRGVwLCBmYWNhZGUuaG9zdCA/PyBmYWxzZSwgZmFjYWRlLm9wdGlvbmFsID8/IGZhbHNlLCBmYWNhZGUuc2VsZiA/PyBmYWxzZSxcbiAgICAgIGZhY2FkZS5za2lwU2VsZiA/PyBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgIHRva2VuOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj58bnVsbCwgaXNBdHRyaWJ1dGVEZXA6IGJvb2xlYW4sIGhvc3Q6IGJvb2xlYW4sIG9wdGlvbmFsOiBib29sZWFuLFxuICAgIHNlbGY6IGJvb2xlYW4sIHNraXBTZWxmOiBib29sZWFuKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvLyBJZiB0aGUgZGVwIGlzIGFuIGBAQXR0cmlidXRlKClgIHRoZSBgYXR0cmlidXRlTmFtZVR5cGVgIG91Z2h0IHRvIGJlIHRoZSBgdW5rbm93bmAgdHlwZS5cbiAgLy8gQnV0IHR5cGVzIGFyZSBub3QgYXZhaWxhYmxlIGF0IHJ1bnRpbWUgc28gd2UganVzdCB1c2UgYSBsaXRlcmFsIGBcIjx1bmtub3duPlwiYCBzdHJpbmcgYXMgYSBkdW1teVxuICAvLyBtYXJrZXIuXG4gIGNvbnN0IGF0dHJpYnV0ZU5hbWVUeXBlID0gaXNBdHRyaWJ1dGVEZXAgPyBsaXRlcmFsKCd1bmtub3duJykgOiBudWxsO1xuICByZXR1cm4ge3Rva2VuLCBhdHRyaWJ1dGVOYW1lVHlwZSwgaG9zdCwgb3B0aW9uYWwsIHNlbGYsIHNraXBTZWxmfTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEhvc3RCaW5kaW5ncyhcbiAgICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBob3N0Pzoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICAvLyBGaXJzdCBwYXJzZSB0aGUgZGVjbGFyYXRpb25zIGZyb20gdGhlIG1ldGFkYXRhLlxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3QgfHwge30pO1xuXG4gIC8vIEFmdGVyIHRoYXQgY2hlY2sgaG9zdCBiaW5kaW5ncyBmb3IgZXJyb3JzXG4gIGNvbnN0IGVycm9ycyA9IHZlcmlmeUhvc3RCaW5kaW5ncyhiaW5kaW5ncywgc291cmNlU3Bhbik7XG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoKGVycm9yOiBQYXJzZUVycm9yKSA9PiBlcnJvci5tc2cpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIC8vIE5leHQsIGxvb3Agb3ZlciB0aGUgcHJvcGVydGllcyBvZiB0aGUgb2JqZWN0LCBsb29raW5nIGZvciBASG9zdEJpbmRpbmcgYW5kIEBIb3N0TGlzdGVuZXIuXG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNIb3N0QmluZGluZyhhbm4pKSB7XG4gICAgICAgICAgLy8gU2luY2UgdGhpcyBpcyBhIGRlY29yYXRvciwgd2Uga25vdyB0aGF0IHRoZSB2YWx1ZSBpcyBhIGNsYXNzIG1lbWJlci4gQWx3YXlzIGFjY2VzcyBpdFxuICAgICAgICAgIC8vIHRocm91Z2ggYHRoaXNgIHNvIHRoYXQgZnVydGhlciBkb3duIHRoZSBsaW5lIGl0IGNhbid0IGJlIGNvbmZ1c2VkIGZvciBhIGxpdGVyYWwgdmFsdWVcbiAgICAgICAgICAvLyAoZS5nLiBpZiB0aGVyZSdzIGEgcHJvcGVydHkgY2FsbGVkIGB0cnVlYCkuXG4gICAgICAgICAgYmluZGluZ3MucHJvcGVydGllc1thbm4uaG9zdFByb3BlcnR5TmFtZSB8fCBmaWVsZF0gPVxuICAgICAgICAgICAgICBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmcoJ3RoaXMnLCBmaWVsZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb3N0TGlzdGVuZXIoYW5uKSkge1xuICAgICAgICAgIGJpbmRpbmdzLmxpc3RlbmVyc1thbm4uZXZlbnROYW1lIHx8IGZpZWxkXSA9IGAke2ZpZWxkfSgkeyhhbm4uYXJncyB8fCBbXSkuam9pbignLCcpfSlgO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdEJpbmRpbmcodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RCaW5kaW5nIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdEJpbmRpbmcnO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RMaXN0ZW5lcih2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdExpc3RlbmVyIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdExpc3RlbmVyJztcbn1cblxuXG5mdW5jdGlvbiBpc0lucHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJbnB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0lucHV0Jztcbn1cblxuZnVuY3Rpb24gaXNPdXRwdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIE91dHB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ091dHB1dCc7XG59XG5cbmZ1bmN0aW9uIGlucHV0c01hcHBpbmdUb0lucHV0TWV0YWRhdGEoaW5wdXRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmd8W3N0cmluZywgc3RyaW5nXT4pIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKGlucHV0cykucmVkdWNlKChyZXN1bHQsIGtleSkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gaW5wdXRzW2tleV07XG4gICAgcmVzdWx0W2tleV0gPSB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID9cbiAgICAgICAge2JpbmRpbmdQcm9wZXJ0eU5hbWU6IHZhbHVlLCBjbGFzc1Byb3BlcnR5TmFtZTogdmFsdWUsIHJlcXVpcmVkOiBmYWxzZX0gOlxuICAgICAgICB7YmluZGluZ1Byb3BlcnR5TmFtZTogdmFsdWVbMF0sIGNsYXNzUHJvcGVydHlOYW1lOiB2YWx1ZVsxXSwgcmVxdWlyZWQ6IGZhbHNlfTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LCB7fSBhcyBJbnB1dE1hcCk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW5wdXRzQXJyYXkodmFsdWVzOiAoc3RyaW5nfHtuYW1lOiBzdHJpbmcsIGFsaWFzPzogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW59KVtdKSB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKChyZXN1bHRzLCB2YWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBbYmluZGluZ1Byb3BlcnR5TmFtZSwgY2xhc3NQcm9wZXJ0eU5hbWVdID0gcGFyc2VNYXBwaW5nU3RyaW5nKHZhbHVlKTtcbiAgICAgIHJlc3VsdHNbY2xhc3NQcm9wZXJ0eU5hbWVdID0ge2JpbmRpbmdQcm9wZXJ0eU5hbWUsIGNsYXNzUHJvcGVydHlOYW1lLCByZXF1aXJlZDogZmFsc2V9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRzW3ZhbHVlLm5hbWVdID0ge1xuICAgICAgICBiaW5kaW5nUHJvcGVydHlOYW1lOiB2YWx1ZS5hbGlhcyB8fCB2YWx1ZS5uYW1lLFxuICAgICAgICBjbGFzc1Byb3BlcnR5TmFtZTogdmFsdWUubmFtZSxcbiAgICAgICAgcmVxdWlyZWQ6IHZhbHVlLnJlcXVpcmVkIHx8IGZhbHNlXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSwge30gYXMgSW5wdXRNYXApO1xufVxuXG5mdW5jdGlvbiBwYXJzZU1hcHBpbmdTdHJpbmdBcnJheSh2YWx1ZXM6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKChyZXN1bHRzLCB2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IFthbGlhcywgZmllbGROYW1lXSA9IHBhcnNlTWFwcGluZ1N0cmluZyh2YWx1ZSk7XG4gICAgcmVzdWx0c1tmaWVsZE5hbWVdID0gYWxpYXM7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0sIHt9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pO1xufVxuXG5mdW5jdGlvbiBwYXJzZU1hcHBpbmdTdHJpbmcodmFsdWU6IHN0cmluZyk6IFthbGlhczogc3RyaW5nLCBmaWVsZE5hbWU6IHN0cmluZ10ge1xuICAvLyBFaXRoZXIgdGhlIHZhbHVlIGlzICdmaWVsZCcgb3IgJ2ZpZWxkOiBwcm9wZXJ0eScuIEluIHRoZSBmaXJzdCBjYXNlLCBgcHJvcGVydHlgIHdpbGxcbiAgLy8gYmUgdW5kZWZpbmVkLCBpbiB3aGljaCBjYXNlIHRoZSBmaWVsZCBuYW1lIHNob3VsZCBhbHNvIGJlIHVzZWQgYXMgdGhlIHByb3BlcnR5IG5hbWUuXG4gIGNvbnN0IFtmaWVsZE5hbWUsIGJpbmRpbmdQcm9wZXJ0eU5hbWVdID0gdmFsdWUuc3BsaXQoJzonLCAyKS5tYXAoc3RyID0+IHN0ci50cmltKCkpO1xuICByZXR1cm4gW2JpbmRpbmdQcm9wZXJ0eU5hbWUgPz8gZmllbGROYW1lLCBmaWVsZE5hbWVdO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZVBpcGVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVQaXBlRmFjYWRlKTogUjNQaXBlTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgIHBpcGVOYW1lOiBkZWNsYXJhdGlvbi5uYW1lLFxuICAgIGRlcHM6IG51bGwsXG4gICAgcHVyZTogZGVjbGFyYXRpb24ucHVyZSA/PyB0cnVlLFxuICAgIGlzU3RhbmRhbG9uZTogZGVjbGFyYXRpb24uaXNTdGFuZGFsb25lID8/IGZhbHNlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZUluamVjdG9yRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUpOlxuICAgIFIzSW5qZWN0b3JNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogZGVjbGFyYXRpb24udHlwZS5uYW1lLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZGVjbGFyYXRpb24udHlwZSksXG4gICAgcHJvdmlkZXJzOiBkZWNsYXJhdGlvbi5wcm92aWRlcnMgIT09IHVuZGVmaW5lZCAmJiBkZWNsYXJhdGlvbi5wcm92aWRlcnMubGVuZ3RoID4gMCA/XG4gICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucHJvdmlkZXJzKSA6XG4gICAgICAgIG51bGwsXG4gICAgaW1wb3J0czogZGVjbGFyYXRpb24uaW1wb3J0cyAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgZGVjbGFyYXRpb24uaW1wb3J0cy5tYXAoaSA9PiBuZXcgV3JhcHBlZE5vZGVFeHByKGkpKSA6XG4gICAgICAgIFtdLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHVibGlzaEZhY2FkZShnbG9iYWw6IGFueSkge1xuICBjb25zdCBuZzogRXhwb3J0ZWRDb21waWxlckZhY2FkZSA9IGdsb2JhbC5uZyB8fCAoZ2xvYmFsLm5nID0ge30pO1xuICBuZy7JtWNvbXBpbGVyRmFjYWRlID0gbmV3IENvbXBpbGVyRmFjYWRlSW1wbCgpO1xufVxuIl19