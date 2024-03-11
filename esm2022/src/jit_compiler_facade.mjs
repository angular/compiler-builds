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
import { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from './ml_parser/defaults';
import { DeclareVarStmt, literal, LiteralExpr, StmtModifier, WrappedNodeExpr } from './output/output_ast';
import { JitEvaluator } from './output/output_jit';
import { r3JitTypeSourceSpan } from './parse_util';
import { compileFactoryFunction, FactoryTarget } from './render3/r3_factory';
import { compileInjector } from './render3/r3_injector_compiler';
import { R3JitReflector } from './render3/r3_jit';
import { compileNgModule, compileNgModuleDeclarationExpression, R3NgModuleMetadataKind, R3SelectorScopeMode } from './render3/r3_module_compiler';
import { compilePipeFromMetadata } from './render3/r3_pipe_compiler';
import { createMayBeForwardRefExpression, getSafePropertyAccessString, wrapReference } from './render3/util';
import { R3TemplateDependencyKind } from './render3/view/api';
import { compileComponentFromMetadata, compileDirectiveFromMetadata, parseHostBindings, verifyHostBindings } from './render3/view/compiler';
import { R3TargetBinder } from './render3/view/t2_binder';
import { makeBindingParser, parseTemplate } from './render3/view/template';
import { ResourceLoader } from './resource_loader';
import { DomElementSchemaRegistry } from './schema/dom_element_schema_registry';
import { SelectorMatcher } from './selector';
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
            kind: R3NgModuleMetadataKind.Global,
            type: wrapReference(facade.type),
            bootstrap: facade.bootstrap.map(wrapReference),
            declarations: facade.declarations.map(wrapReference),
            publicDeclarationTypes: null, // only needed for types in AOT
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
        const { template, interpolation, defer } = parseJitTemplate(facade.template, facade.name, sourceMapUrl, facade.preserveWhitespaces, facade.interpolation);
        // Compile the component metadata, including template, into an expression.
        const meta = {
            ...facade,
            ...convertDirectiveFacadeToMetadata(facade),
            selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(),
            template,
            declarations: facade.declarations.map(convertDeclarationFacadeToMetadata),
            declarationListEmitMode: 0 /* DeclarationListEmitMode.Direct */,
            defer,
            styles: [...facade.styles, ...template.styles],
            encapsulation: facade.encapsulation,
            interpolation,
            changeDetection: facade.changeDetection ?? null,
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
        isSignal: facade.isSignal,
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
        isSignal: !!declaration.isSignal,
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
                        // For JIT, decorators are used to declare signal inputs. That is because of
                        // a technical limitation where it's not possible to statically reflect class
                        // members of a directive/component at runtime before instantiating the class.
                        isSignal: !!ann.isSignal,
                        transformFunction: ann.transform != null ? new WrappedNodeExpr(ann.transform) : null,
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
        host: {
            ...extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host),
        },
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
        inputs: declaration.inputs ? inputsPartialMetadataToInputMetadata(declaration.inputs) : {},
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
    const { template, interpolation, defer } = parseJitTemplate(decl.template, decl.type.name, sourceMapUrl, decl.preserveWhitespaces ?? false, decl.interpolation);
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
        defer,
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
    const binder = new R3TargetBinder(new SelectorMatcher());
    const boundTarget = binder.bind({ template: parsed.nodes });
    return {
        template: parsed,
        interpolation: interpolationConfig,
        defer: createR3ComponentDeferMetadata(boundTarget)
    };
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
function createR3ComponentDeferMetadata(boundTarget) {
    const deferredBlocks = boundTarget.getDeferBlocks();
    const blocks = new Map();
    for (const block of deferredBlocks) {
        // TODO: leaving dependency function empty in JIT mode for now,
        // to be implemented as one of the next steps.
        blocks.set(block, null);
    }
    return { mode: 0 /* DeferBlockDepsEmitMode.PerBlock */, blocks };
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
function inputsPartialMetadataToInputMetadata(inputs) {
    return Object.keys(inputs).reduce((result, minifiedClassName) => {
        const value = inputs[minifiedClassName];
        // Handle legacy partial input output.
        if (typeof value === 'string' || Array.isArray(value)) {
            result[minifiedClassName] = parseLegacyInputPartialOutput(value);
        }
        else {
            result[minifiedClassName] = {
                bindingPropertyName: value.publicName,
                classPropertyName: minifiedClassName,
                transformFunction: value.transformFunction !== null ?
                    new WrappedNodeExpr(value.transformFunction) :
                    null,
                required: value.isRequired,
                isSignal: value.isSignal,
            };
        }
        return result;
    }, {});
}
/**
 * Parses the legacy input partial output. For more details see `partial/directive.ts`.
 * TODO(legacy-partial-output-inputs): Remove in v18.
 */
function parseLegacyInputPartialOutput(value) {
    if (typeof value === 'string') {
        return {
            bindingPropertyName: value,
            classPropertyName: value,
            transformFunction: null,
            required: false,
            // legacy partial output does not capture signal inputs.
            isSignal: false,
        };
    }
    return {
        bindingPropertyName: value[0],
        classPropertyName: value[1],
        transformFunction: value[2] ? new WrappedNodeExpr(value[2]) : null,
        required: false,
        // legacy partial output does not capture signal inputs.
        isSignal: false,
    };
}
function parseInputsArray(values) {
    return values.reduce((results, value) => {
        if (typeof value === 'string') {
            const [bindingPropertyName, classPropertyName] = parseMappingString(value);
            results[classPropertyName] = {
                bindingPropertyName,
                classPropertyName,
                required: false,
                // Signal inputs not supported for the inputs array.
                isSignal: false,
                transformFunction: null,
            };
        }
        else {
            results[value.name] = {
                bindingPropertyName: value.alias || value.name,
                classPropertyName: value.name,
                required: value.required || false,
                // Signal inputs not supported for the inputs array.
                isSignal: false,
                transformFunction: value.transform != null ? new WrappedNodeExpr(value.transform) : null,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsdUJBQXVCLEVBQTRDLGlCQUFpQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzVHLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3ZGLE9BQU8sRUFBb0IsY0FBYyxFQUFjLE9BQU8sRUFBRSxXQUFXLEVBQWEsWUFBWSxFQUFFLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ2xKLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNqRCxPQUFPLEVBQThCLG1CQUFtQixFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRTlFLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSxhQUFhLEVBQXVCLE1BQU0sc0JBQXNCLENBQUM7QUFDakcsT0FBTyxFQUFDLGVBQWUsRUFBcUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuRixPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBRSxvQ0FBb0MsRUFBc0Isc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUNwSyxPQUFPLEVBQUMsdUJBQXVCLEVBQWlCLE1BQU0sNEJBQTRCLENBQUM7QUFDbkYsT0FBTyxFQUFDLCtCQUErQixFQUFzQiwyQkFBMkIsRUFBNkIsYUFBYSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDMUosT0FBTyxFQUFn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QixFQUFFLENBQUM7UUFDcEIsUUFBUSxFQUFFLFdBQVcsQ0FBQyxJQUFJO1FBQzFCLElBQUksRUFBRSxJQUFJO1FBQ1YsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLElBQUksSUFBSTtRQUM5QixZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVksSUFBSSxLQUFLO0tBQ2hELENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxzQ0FBc0MsQ0FBQyxXQUFvQztJQUVsRixPQUFPO1FBQ0wsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSTtRQUMzQixJQUFJLEVBQUUsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDckMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxTQUFTLEtBQUssU0FBUyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLElBQUksZUFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzVDLElBQUk7UUFDUixPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQztZQUN4QyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxFQUFFO0tBQ1AsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLE1BQVc7SUFDdkMsTUFBTSxFQUFFLEdBQTJCLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLEVBQUUsQ0FBQyxlQUFlLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlckZhY2FkZSwgQ29yZUVudmlyb25tZW50LCBFeHBvcnRlZENvbXBpbGVyRmFjYWRlLCBMZWdhY3lJbnB1dFBhcnRpYWxNYXBwaW5nLCBPcGFxdWVWYWx1ZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlLCBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGVjbGFyZURpcmVjdGl2ZURlcGVuZGVuY3lGYWNhZGUsIFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSwgUjNEZWNsYXJlRmFjdG9yeUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0YWJsZUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUsIFIzRGVjbGFyZU5nTW9kdWxlRmFjYWRlLCBSM0RlY2xhcmVQaXBlRGVwZW5kZW5jeUZhY2FkZSwgUjNEZWNsYXJlUGlwZUZhY2FkZSwgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YUZhY2FkZSwgUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlLCBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlLCBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUsIFIzUGlwZU1ldGFkYXRhRmFjYWRlLCBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUsIFIzVGVtcGxhdGVEZXBlbmRlbmN5RmFjYWRlfSBmcm9tICcuL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7Y29tcGlsZUluamVjdGFibGV9IGZyb20gJy4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9tbF9wYXJzZXIvZGVmYXVsdHMnO1xuaW1wb3J0IHtBcnJvd0Z1bmN0aW9uRXhwciwgRGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb24sIGxpdGVyYWwsIExpdGVyYWxFeHByLCBTdGF0ZW1lbnQsIFN0bXRNb2RpZmllciwgV3JhcHBlZE5vZGVFeHByfSBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Sml0RXZhbHVhdG9yfSBmcm9tICcuL291dHB1dC9vdXRwdXRfaml0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFuLCByM0ppdFR5cGVTb3VyY2VTcGFufSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEZWZlcnJlZEJsb2NrfSBmcm9tICcuL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgRmFjdG9yeVRhcmdldCwgUjNEZXBlbmRlbmN5TWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7Y29tcGlsZUluamVjdG9yLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlcic7XG5pbXBvcnQge1IzSml0UmVmbGVjdG9yfSBmcm9tICcuL3JlbmRlcjMvcjNfaml0JztcbmltcG9ydCB7Y29tcGlsZU5nTW9kdWxlLCBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24sIFIzTmdNb2R1bGVNZXRhZGF0YSwgUjNOZ01vZHVsZU1ldGFkYXRhS2luZCwgUjNTZWxlY3RvclNjb3BlTW9kZX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uLCBGb3J3YXJkUmVmSGFuZGxpbmcsIGdldFNhZmVQcm9wZXJ0eUFjY2Vzc1N0cmluZywgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgd3JhcFJlZmVyZW5jZX0gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSwgRGVmZXJCbG9ja0RlcHNFbWl0TW9kZSwgUjNDb21wb25lbnREZWZlck1ldGFkYXRhLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZURlcGVuZGVuY3lNZXRhZGF0YSwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0RGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM0lucHV0TWV0YWRhdGEsIFIzUGlwZURlcGVuZGVuY3lNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhLCBSM1RlbXBsYXRlRGVwZW5kZW5jeSwgUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLCBSM1RlbXBsYXRlRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBQYXJzZWRIb3N0QmluZGluZ3MsIHBhcnNlSG9zdEJpbmRpbmdzLCB2ZXJpZnlIb3N0QmluZGluZ3N9IGZyb20gJy4vcmVuZGVyMy92aWV3L2NvbXBpbGVyJztcblxuaW1wb3J0IHR5cGUge0JvdW5kVGFyZ2V0fSBmcm9tICcuL3JlbmRlcjMvdmlldy90Ml9hcGknO1xuaW1wb3J0IHtSM1RhcmdldEJpbmRlcn0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdDJfYmluZGVyJztcbmltcG9ydCB7bWFrZUJpbmRpbmdQYXJzZXIsIHBhcnNlVGVtcGxhdGV9IGZyb20gJy4vcmVuZGVyMy92aWV3L3RlbXBsYXRlJztcbmltcG9ydCB7UmVzb3VyY2VMb2FkZXJ9IGZyb20gJy4vcmVzb3VyY2VfbG9hZGVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4vc2VsZWN0b3InO1xuXG5leHBvcnQgY2xhc3MgQ29tcGlsZXJGYWNhZGVJbXBsIGltcGxlbWVudHMgQ29tcGlsZXJGYWNhZGUge1xuICBGYWN0b3J5VGFyZ2V0ID0gRmFjdG9yeVRhcmdldDtcbiAgUmVzb3VyY2VMb2FkZXIgPSBSZXNvdXJjZUxvYWRlcjtcbiAgcHJpdmF0ZSBlbGVtZW50U2NoZW1hUmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBqaXRFdmFsdWF0b3IgPSBuZXcgSml0RXZhbHVhdG9yKCkpIHt9XG5cbiAgY29tcGlsZVBpcGUoYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIGZhY2FkZTogUjNQaXBlTWV0YWRhdGFGYWNhZGUpOlxuICAgICAgYW55IHtcbiAgICBjb25zdCBtZXRhZGF0YTogUjNQaXBlTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgICBkZXBzOiBudWxsLFxuICAgICAgcGlwZU5hbWU6IGZhY2FkZS5waXBlTmFtZSxcbiAgICAgIHB1cmU6IGZhY2FkZS5wdXJlLFxuICAgICAgaXNTdGFuZGFsb25lOiBmYWNhZGUuaXNTdGFuZGFsb25lLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEobWV0YWRhdGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVQaXBlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVQaXBlRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVQaXBlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbik7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZUluamVjdGFibGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHtleHByZXNzaW9uLCBzdGF0ZW1lbnRzfSA9IGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICAgICAgdXNlQ2xhc3M6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsICd1c2VDbGFzcycpLFxuICAgICAgICAgIHVzZUZhY3Rvcnk6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZUZhY3RvcnknKSxcbiAgICAgICAgICB1c2VWYWx1ZTogY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZVZhbHVlJyksXG4gICAgICAgICAgdXNlRXhpc3Rpbmc6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsICd1c2VFeGlzdGluZycpLFxuICAgICAgICAgIGRlcHM6IGZhY2FkZS5kZXBzPy5tYXAoY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKSxcbiAgICAgICAgfSxcbiAgICAgICAgLyogcmVzb2x2ZUZvcndhcmRSZWZzICovIHRydWUpO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RhYmxlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNEZWNsYXJlSW5qZWN0YWJsZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBmYWNhZGUudHlwZS5uYW1lLFxuICAgICAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgICAgICAgIHByb3ZpZGVkSW46IGNvbXB1dGVQcm92aWRlZEluKGZhY2FkZS5wcm92aWRlZEluKSxcbiAgICAgICAgICB1c2VDbGFzczogY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZUNsYXNzJyksXG4gICAgICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCAndXNlRmFjdG9yeScpLFxuICAgICAgICAgIHVzZVZhbHVlOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCAndXNlVmFsdWUnKSxcbiAgICAgICAgICB1c2VFeGlzdGluZzogY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKGZhY2FkZSwgJ3VzZUV4aXN0aW5nJyksXG4gICAgICAgICAgZGVwczogZmFjYWRlLmRlcHM/Lm1hcChjb252ZXJ0UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhKSxcbiAgICAgICAgfSxcbiAgICAgICAgLyogcmVzb2x2ZUZvcndhcmRSZWZzICovIHRydWUpO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvcihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBwcm92aWRlcnM6IGZhY2FkZS5wcm92aWRlcnMgJiYgZmFjYWRlLnByb3ZpZGVycy5sZW5ndGggPiAwID9cbiAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDpcbiAgICAgICAgICBudWxsLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSksXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZUluamVjdG9yRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlSW5qZWN0b3JGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhID0ge1xuICAgICAga2luZDogUjNOZ01vZHVsZU1ldGFkYXRhS2luZC5HbG9iYWwsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGJvb3RzdHJhcDogZmFjYWRlLmJvb3RzdHJhcC5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgcHVibGljRGVjbGFyYXRpb25UeXBlczogbnVsbCwgIC8vIG9ubHkgbmVlZGVkIGZvciB0eXBlcyBpbiBBT1RcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGluY2x1ZGVJbXBvcnRUeXBlczogdHJ1ZSxcbiAgICAgIGV4cG9ydHM6IGZhY2FkZS5leHBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIHNlbGVjdG9yU2NvcGVNb2RlOiBSM1NlbGVjdG9yU2NvcGVNb2RlLklubGluZSxcbiAgICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBmYWxzZSxcbiAgICAgIHNjaGVtYXM6IGZhY2FkZS5zY2hlbWFzID8gZmFjYWRlLnNjaGVtYXMubWFwKHdyYXBSZWZlcmVuY2UpIDogbnVsbCxcbiAgICAgIGlkOiBmYWNhZGUuaWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5pZCkgOiBudWxsLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZU5nTW9kdWxlKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlTmdNb2R1bGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24oZGVjbGFyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZURpcmVjdGl2ZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhID0gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0RpcmVjdGl2ZScsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbik7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gICAgY29uc3Qge3RlbXBsYXRlLCBpbnRlcnBvbGF0aW9uLCBkZWZlcn0gPSBwYXJzZUppdFRlbXBsYXRlKFxuICAgICAgICBmYWNhZGUudGVtcGxhdGUsIGZhY2FkZS5uYW1lLCBzb3VyY2VNYXBVcmwsIGZhY2FkZS5wcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgICBmYWNhZGUuaW50ZXJwb2xhdGlvbik7XG5cbiAgICAvLyBDb21waWxlIHRoZSBjb21wb25lbnQgbWV0YWRhdGEsIGluY2x1ZGluZyB0ZW1wbGF0ZSwgaW50byBhbiBleHByZXNzaW9uLlxuICAgIGNvbnN0IG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+ID0ge1xuICAgICAgLi4uZmFjYWRlLFxuICAgICAgLi4uY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKSxcbiAgICAgIHNlbGVjdG9yOiBmYWNhZGUuc2VsZWN0b3IgfHwgdGhpcy5lbGVtZW50U2NoZW1hUmVnaXN0cnkuZ2V0RGVmYXVsdENvbXBvbmVudEVsZW1lbnROYW1lKCksXG4gICAgICB0ZW1wbGF0ZSxcbiAgICAgIGRlY2xhcmF0aW9uczogZmFjYWRlLmRlY2xhcmF0aW9ucy5tYXAoY29udmVydERlY2xhcmF0aW9uRmFjYWRlVG9NZXRhZGF0YSksXG4gICAgICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0LFxuICAgICAgZGVmZXIsXG5cbiAgICAgIHN0eWxlczogWy4uLmZhY2FkZS5zdHlsZXMsIC4uLnRlbXBsYXRlLnN0eWxlc10sXG4gICAgICBlbmNhcHN1bGF0aW9uOiBmYWNhZGUuZW5jYXBzdWxhdGlvbixcbiAgICAgIGludGVycG9sYXRpb24sXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IGZhY2FkZS5jaGFuZ2VEZXRlY3Rpb24gPz8gbnVsbCxcbiAgICAgIGFuaW1hdGlvbnM6IGZhY2FkZS5hbmltYXRpb25zICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5hbmltYXRpb25zKSA6IG51bGwsXG4gICAgICB2aWV3UHJvdmlkZXJzOiBmYWNhZGUudmlld1Byb3ZpZGVycyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gICAgfTtcbiAgICBjb25zdCBqaXRFeHByZXNzaW9uU291cmNlTWFwID0gYG5nOi8vLyR7ZmFjYWRlLm5hbWV9LmpzYDtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlQ29tcG9uZW50RnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIGppdEV4cHJlc3Npb25Tb3VyY2VNYXAsIG1ldGEpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudERlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB0eXBlU291cmNlU3BhbiA9XG4gICAgICAgIHRoaXMuY3JlYXRlUGFyc2VTb3VyY2VTcGFuKCdDb21wb25lbnQnLCBkZWNsYXJhdGlvbi50eXBlLm5hbWUsIHNvdXJjZU1hcFVybCk7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlQ29tcG9uZW50RmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbiwgdHlwZVNvdXJjZVNwYW4sIHNvdXJjZU1hcFVybCk7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZUNvbXBvbmVudEZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+KTogYW55IHtcbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG4gICAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKG1ldGEuaW50ZXJwb2xhdGlvbik7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBjb25zdGFudFBvb2wuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlRmFjdG9yeShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0ZhY3RvcnlEZWZNZXRhZGF0YUZhY2FkZSkge1xuICAgIGNvbnN0IGZhY3RvcnlSZXMgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkobWV0YS5kZXBzKSxcbiAgICAgIHRhcmdldDogbWV0YS50YXJnZXQsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgZmFjdG9yeVJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBmYWN0b3J5UmVzLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUZhY3RvcnlEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0RlY2xhcmVGYWN0b3J5RmFjYWRlKSB7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgbmFtZTogbWV0YS50eXBlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKG1ldGEudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgIGRlcHM6IEFycmF5LmlzQXJyYXkobWV0YS5kZXBzKSA/IG1ldGEuZGVwcy5tYXAoY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YS5kZXBzLFxuICAgICAgdGFyZ2V0OiBtZXRhLnRhcmdldCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICBmYWN0b3J5UmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGZhY3RvcnlSZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gcjNKaXRUeXBlU291cmNlU3BhbihraW5kLCB0eXBlTmFtZSwgc291cmNlVXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBKSVQgY29tcGlsZXMgYW4gZXhwcmVzc2lvbiBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGF0IGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICAgKiBAcGFyYW0gY29udGV4dCBhbiBvYmplY3QgbWFwIG9mIEBhbmd1bGFyL2NvcmUgc3ltYm9sIG5hbWVzIHRvIHN5bWJvbHMgd2hpY2ggd2lsbCBiZSBhdmFpbGFibGVcbiAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHNvdXJjZVVybCBhIFVSTCB0byB1c2UgZm9yIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBwcmVTdGF0ZW1lbnRzIGEgY29sbGVjdGlvbiBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGV2YWx1YXRlZCBiZWZvcmUgdGhlIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGppdEV4cHJlc3Npb24oXG4gICAgICBkZWY6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBzb3VyY2VVcmw6IHN0cmluZyxcbiAgICAgIHByZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgICAvLyBUaGVyZWZvcmUsIGl0cyBzdGF0ZW1lbnRzIG5lZWQgdG8gcHJlY2VkZSB0aGUgYWN0dWFsIEpJVCBvcGVyYXRpb24uIFRoZSBmaW5hbCBzdGF0ZW1lbnQgaXMgYVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mICRkZWYgd2hpY2ggaXMgc2V0IHRvIHRoZSBleHByZXNzaW9uIGJlaW5nIGNvbXBpbGVkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFN0YXRlbWVudFtdID0gW1xuICAgICAgLi4ucHJlU3RhdGVtZW50cyxcbiAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdCgnJGRlZicsIGRlZiwgdW5kZWZpbmVkLCBTdG10TW9kaWZpZXIuRXhwb3J0ZWQpLFxuICAgIF07XG5cbiAgICBjb25zdCByZXMgPSB0aGlzLmppdEV2YWx1YXRvci5ldmFsdWF0ZVN0YXRlbWVudHMoXG4gICAgICAgIHNvdXJjZVVybCwgc3RhdGVtZW50cywgbmV3IFIzSml0UmVmbGVjdG9yKGNvbnRleHQpLCAvKiBlbmFibGVTb3VyY2VNYXBzICovIHRydWUpO1xuICAgIHJldHVybiByZXNbJyRkZWYnXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEoZmFjYWRlOiBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUpOiBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICBpc1NpZ25hbDogZmFjYWRlLmlzU2lnbmFsLFxuICAgIHByZWRpY2F0ZTogY29udmVydFF1ZXJ5UHJlZGljYXRlKGZhY2FkZS5wcmVkaWNhdGUpLFxuICAgIHJlYWQ6IGZhY2FkZS5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucmVhZCkgOiBudWxsLFxuICAgIHN0YXRpYzogZmFjYWRlLnN0YXRpYyxcbiAgICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seTogZmFjYWRlLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFGYWNhZGUpOlxuICAgIFIzUXVlcnlNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgcHJvcGVydHlOYW1lOiBkZWNsYXJhdGlvbi5wcm9wZXJ0eU5hbWUsXG4gICAgZmlyc3Q6IGRlY2xhcmF0aW9uLmZpcnN0ID8/IGZhbHNlLFxuICAgIHByZWRpY2F0ZTogY29udmVydFF1ZXJ5UHJlZGljYXRlKGRlY2xhcmF0aW9uLnByZWRpY2F0ZSksXG4gICAgZGVzY2VuZGFudHM6IGRlY2xhcmF0aW9uLmRlc2NlbmRhbnRzID8/IGZhbHNlLFxuICAgIHJlYWQ6IGRlY2xhcmF0aW9uLnJlYWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGRlY2xhcmF0aW9uLnN0YXRpYyA/PyBmYWxzZSxcbiAgICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seTogZGVjbGFyYXRpb24uZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgPz8gdHJ1ZSxcbiAgICBpc1NpZ25hbDogISFkZWNsYXJhdGlvbi5pc1NpZ25hbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFF1ZXJ5UHJlZGljYXRlKHByZWRpY2F0ZTogT3BhcXVlVmFsdWV8c3RyaW5nW10pOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9ufFxuICAgIHN0cmluZ1tdIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkocHJlZGljYXRlKSA/XG4gICAgICAvLyBUaGUgcHJlZGljYXRlIGlzIGFuIGFycmF5IG9mIHN0cmluZ3Mgc28gcGFzcyBpdCB0aHJvdWdoLlxuICAgICAgcHJlZGljYXRlIDpcbiAgICAgIC8vIFRoZSBwcmVkaWNhdGUgaXMgYSB0eXBlIC0gYXNzdW1lIHRoYXQgd2Ugd2lsbCBuZWVkIHRvIHVud3JhcCBhbnkgYGZvcndhcmRSZWYoKWAgY2FsbHMuXG4gICAgICBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uKG5ldyBXcmFwcGVkTm9kZUV4cHIocHJlZGljYXRlKSwgRm9yd2FyZFJlZkhhbmRsaW5nLldyYXBwZWQpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3QgaW5wdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dHNBcnJheShmYWNhZGUuaW5wdXRzIHx8IFtdKTtcbiAgY29uc3Qgb3V0cHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlTWFwcGluZ1N0cmluZ0FycmF5KGZhY2FkZS5vdXRwdXRzIHx8IFtdKTtcbiAgY29uc3QgcHJvcE1ldGFkYXRhID0gZmFjYWRlLnByb3BNZXRhZGF0YTtcbiAgY29uc3QgaW5wdXRzRnJvbVR5cGU6IFJlY29yZDxzdHJpbmcsIFIzSW5wdXRNZXRhZGF0YT4gPSB7fTtcbiAgY29uc3Qgb3V0cHV0c0Zyb21UeXBlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNJbnB1dChhbm4pKSB7XG4gICAgICAgICAgaW5wdXRzRnJvbVR5cGVbZmllbGRdID0ge1xuICAgICAgICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogYW5uLmFsaWFzIHx8IGZpZWxkLFxuICAgICAgICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IGZpZWxkLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IGFubi5yZXF1aXJlZCB8fCBmYWxzZSxcbiAgICAgICAgICAgIC8vIEZvciBKSVQsIGRlY29yYXRvcnMgYXJlIHVzZWQgdG8gZGVjbGFyZSBzaWduYWwgaW5wdXRzLiBUaGF0IGlzIGJlY2F1c2Ugb2ZcbiAgICAgICAgICAgIC8vIGEgdGVjaG5pY2FsIGxpbWl0YXRpb24gd2hlcmUgaXQncyBub3QgcG9zc2libGUgdG8gc3RhdGljYWxseSByZWZsZWN0IGNsYXNzXG4gICAgICAgICAgICAvLyBtZW1iZXJzIG9mIGEgZGlyZWN0aXZlL2NvbXBvbmVudCBhdCBydW50aW1lIGJlZm9yZSBpbnN0YW50aWF0aW5nIHRoZSBjbGFzcy5cbiAgICAgICAgICAgIGlzU2lnbmFsOiAhIWFubi5pc1NpZ25hbCxcbiAgICAgICAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBhbm4udHJhbnNmb3JtICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGFubi50cmFuc2Zvcm0pIDogbnVsbCxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKGlzT3V0cHV0KGFubikpIHtcbiAgICAgICAgICBvdXRwdXRzRnJvbVR5cGVbZmllbGRdID0gYW5uLmFsaWFzIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgIGRlcHM6IG51bGwsXG4gICAgaG9zdDoge1xuICAgICAgLi4uZXh0cmFjdEhvc3RCaW5kaW5ncyhmYWNhZGUucHJvcE1ldGFkYXRhLCBmYWNhZGUudHlwZVNvdXJjZVNwYW4sIGZhY2FkZS5ob3N0KSxcbiAgICB9LFxuICAgIGlucHV0czogey4uLmlucHV0c0Zyb21NZXRhZGF0YSwgLi4uaW5wdXRzRnJvbVR5cGV9LFxuICAgIG91dHB1dHM6IHsuLi5vdXRwdXRzRnJvbU1ldGFkYXRhLCAuLi5vdXRwdXRzRnJvbVR5cGV9LFxuICAgIHF1ZXJpZXM6IGZhY2FkZS5xdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZmFjYWRlLnByb3ZpZGVycyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSA6IG51bGwsXG4gICAgdmlld1F1ZXJpZXM6IGZhY2FkZS52aWV3UXVlcmllcy5tYXAoY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKSxcbiAgICBmdWxsSW5oZXJpdGFuY2U6IGZhbHNlLFxuICAgIGhvc3REaXJlY3RpdmVzOiBjb252ZXJ0SG9zdERpcmVjdGl2ZXNUb01ldGFkYXRhKGZhY2FkZSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShcbiAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogZGVjbGFyYXRpb24udHlwZS5uYW1lLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZGVjbGFyYXRpb24udHlwZSksXG4gICAgdHlwZVNvdXJjZVNwYW4sXG4gICAgc2VsZWN0b3I6IGRlY2xhcmF0aW9uLnNlbGVjdG9yID8/IG51bGwsXG4gICAgaW5wdXRzOiBkZWNsYXJhdGlvbi5pbnB1dHMgPyBpbnB1dHNQYXJ0aWFsTWV0YWRhdGFUb0lucHV0TWV0YWRhdGEoZGVjbGFyYXRpb24uaW5wdXRzKSA6IHt9LFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8ge30sXG4gICAgaG9zdDogY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb24uaG9zdCksXG4gICAgcXVlcmllczogKGRlY2xhcmF0aW9uLnF1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHZpZXdRdWVyaWVzOiAoZGVjbGFyYXRpb24udmlld1F1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZGVjbGFyYXRpb24udXNlc0luaGVyaXRhbmNlID8/IGZhbHNlLFxuICAgIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGRlY2xhcmF0aW9uLnVzZXNPbkNoYW5nZXMgPz8gZmFsc2V9LFxuICAgIGRlcHM6IG51bGwsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgICBpc1N0YW5kYWxvbmU6IGRlY2xhcmF0aW9uLmlzU3RhbmRhbG9uZSA/PyBmYWxzZSxcbiAgICBpc1NpZ25hbDogZGVjbGFyYXRpb24uaXNTaWduYWwgPz8gZmFsc2UsXG4gICAgaG9zdERpcmVjdGl2ZXM6IGNvbnZlcnRIb3N0RGlyZWN0aXZlc1RvTWV0YWRhdGEoZGVjbGFyYXRpb24pLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0SG9zdERlY2xhcmF0aW9uVG9NZXRhZGF0YShob3N0OiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGVbJ2hvc3QnXSA9IHt9KTpcbiAgICBSM0hvc3RNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgYXR0cmlidXRlczogY29udmVydE9wYXF1ZVZhbHVlc1RvRXhwcmVzc2lvbnMoaG9zdC5hdHRyaWJ1dGVzID8/IHt9KSxcbiAgICBsaXN0ZW5lcnM6IGhvc3QubGlzdGVuZXJzID8/IHt9LFxuICAgIHByb3BlcnRpZXM6IGhvc3QucHJvcGVydGllcyA/PyB7fSxcbiAgICBzcGVjaWFsQXR0cmlidXRlczoge1xuICAgICAgY2xhc3NBdHRyOiBob3N0LmNsYXNzQXR0cmlidXRlLFxuICAgICAgc3R5bGVBdHRyOiBob3N0LnN0eWxlQXR0cmlidXRlLFxuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRIb3N0RGlyZWN0aXZlc1RvTWV0YWRhdGEoXG4gICAgbWV0YWRhdGE6IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZXxSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNIb3N0RGlyZWN0aXZlTWV0YWRhdGFbXXxudWxsIHtcbiAgaWYgKG1ldGFkYXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gbWV0YWRhdGEuaG9zdERpcmVjdGl2ZXMubWFwKGhvc3REaXJlY3RpdmUgPT4ge1xuICAgICAgcmV0dXJuIHR5cGVvZiBob3N0RGlyZWN0aXZlID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICB7XG4gICAgICAgICAgICBkaXJlY3RpdmU6IHdyYXBSZWZlcmVuY2UoaG9zdERpcmVjdGl2ZSksXG4gICAgICAgICAgICBpbnB1dHM6IG51bGwsXG4gICAgICAgICAgICBvdXRwdXRzOiBudWxsLFxuICAgICAgICAgICAgaXNGb3J3YXJkUmVmZXJlbmNlOiBmYWxzZVxuICAgICAgICAgIH0gOlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGRpcmVjdGl2ZTogd3JhcFJlZmVyZW5jZShob3N0RGlyZWN0aXZlLmRpcmVjdGl2ZSksXG4gICAgICAgICAgICBpc0ZvcndhcmRSZWZlcmVuY2U6IGZhbHNlLFxuICAgICAgICAgICAgaW5wdXRzOiBob3N0RGlyZWN0aXZlLmlucHV0cyA/IHBhcnNlTWFwcGluZ1N0cmluZ0FycmF5KGhvc3REaXJlY3RpdmUuaW5wdXRzKSA6IG51bGwsXG4gICAgICAgICAgICBvdXRwdXRzOiBob3N0RGlyZWN0aXZlLm91dHB1dHMgPyBwYXJzZU1hcHBpbmdTdHJpbmdBcnJheShob3N0RGlyZWN0aXZlLm91dHB1dHMpIDogbnVsbCxcbiAgICAgICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRPcGFxdWVWYWx1ZXNUb0V4cHJlc3Npb25zKG9iajoge1trZXk6IHN0cmluZ106IE9wYXF1ZVZhbHVlfSk6XG4gICAge1trZXk6IHN0cmluZ106IFdyYXBwZWROb2RlRXhwcjx1bmtub3duPn0ge1xuICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj59ID0ge307XG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIHtcbiAgICByZXN1bHRba2V5XSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIob2JqW2tleV0pO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlQ29tcG9uZW50RmFjYWRlVG9NZXRhZGF0YShcbiAgICBkZWNsOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgc291cmNlTWFwVXJsOiBzdHJpbmcpOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5TWV0YWRhdGE+IHtcbiAgY29uc3Qge3RlbXBsYXRlLCBpbnRlcnBvbGF0aW9uLCBkZWZlcn0gPSBwYXJzZUppdFRlbXBsYXRlKFxuICAgICAgZGVjbC50ZW1wbGF0ZSwgZGVjbC50eXBlLm5hbWUsIHNvdXJjZU1hcFVybCwgZGVjbC5wcmVzZXJ2ZVdoaXRlc3BhY2VzID8/IGZhbHNlLFxuICAgICAgZGVjbC5pbnRlcnBvbGF0aW9uKTtcblxuICBjb25zdCBkZWNsYXJhdGlvbnM6IFIzVGVtcGxhdGVEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IFtdO1xuICBpZiAoZGVjbC5kZXBlbmRlbmNpZXMpIHtcbiAgICBmb3IgKGNvbnN0IGlubmVyRGVwIG9mIGRlY2wuZGVwZW5kZW5jaWVzKSB7XG4gICAgICBzd2l0Y2ggKGlubmVyRGVwLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnZGlyZWN0aXZlJzpcbiAgICAgICAgY2FzZSAnY29tcG9uZW50JzpcbiAgICAgICAgICBkZWNsYXJhdGlvbnMucHVzaChjb252ZXJ0RGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGlubmVyRGVwKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3BpcGUnOlxuICAgICAgICAgIGRlY2xhcmF0aW9ucy5wdXNoKGNvbnZlcnRQaXBlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGlubmVyRGVwKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGRlY2wuY29tcG9uZW50cyB8fCBkZWNsLmRpcmVjdGl2ZXMgfHwgZGVjbC5waXBlcykge1xuICAgIC8vIEV4aXN0aW5nIGRlY2xhcmF0aW9ucyBvbiBOUE0gbWF5IG5vdCBiZSB1c2luZyB0aGUgbmV3IGBkZXBlbmRlbmNpZXNgIG1lcmdlZCBmaWVsZCwgYW5kIG1heVxuICAgIC8vIGhhdmUgc2VwYXJhdGUgZmllbGRzIGZvciBkZXBlbmRlbmNpZXMgaW5zdGVhZC4gVW5pZnkgdGhlbSBmb3IgSklUIGNvbXBpbGF0aW9uLlxuICAgIGRlY2wuY29tcG9uZW50cyAmJlxuICAgICAgICBkZWNsYXJhdGlvbnMucHVzaCguLi5kZWNsLmNvbXBvbmVudHMubWFwKFxuICAgICAgICAgICAgZGlyID0+IGNvbnZlcnREaXJlY3RpdmVEZWNsYXJhdGlvblRvTWV0YWRhdGEoZGlyLCAvKiBpc0NvbXBvbmVudCAqLyB0cnVlKSkpO1xuICAgIGRlY2wuZGlyZWN0aXZlcyAmJlxuICAgICAgICBkZWNsYXJhdGlvbnMucHVzaChcbiAgICAgICAgICAgIC4uLmRlY2wuZGlyZWN0aXZlcy5tYXAoZGlyID0+IGNvbnZlcnREaXJlY3RpdmVEZWNsYXJhdGlvblRvTWV0YWRhdGEoZGlyKSkpO1xuICAgIGRlY2wucGlwZXMgJiYgZGVjbGFyYXRpb25zLnB1c2goLi4uY29udmVydFBpcGVNYXBUb01ldGFkYXRhKGRlY2wucGlwZXMpKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLi4uY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2wsIHR5cGVTb3VyY2VTcGFuKSxcbiAgICB0ZW1wbGF0ZSxcbiAgICBzdHlsZXM6IGRlY2wuc3R5bGVzID8/IFtdLFxuICAgIGRlY2xhcmF0aW9ucyxcbiAgICB2aWV3UHJvdmlkZXJzOiBkZWNsLnZpZXdQcm92aWRlcnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbC52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGFuaW1hdGlvbnM6IGRlY2wuYW5pbWF0aW9ucyAhPT0gdW5kZWZpbmVkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsLmFuaW1hdGlvbnMpIDogbnVsbCxcbiAgICBkZWZlcixcblxuICAgIGNoYW5nZURldGVjdGlvbjogZGVjbC5jaGFuZ2VEZXRlY3Rpb24gPz8gQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGVmYXVsdCxcbiAgICBlbmNhcHN1bGF0aW9uOiBkZWNsLmVuY2Fwc3VsYXRpb24gPz8gVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgaW50ZXJwb2xhdGlvbixcbiAgICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZVJlc29sdmVkLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJhdGlvbkZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzVGVtcGxhdGVEZXBlbmRlbmN5RmFjYWRlKTpcbiAgICBSM1RlbXBsYXRlRGVwZW5kZW5jeSB7XG4gIHJldHVybiB7XG4gICAgLi4uZGVjbGFyYXRpb24sXG4gICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi50eXBlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZURlY2xhcmF0aW9uVG9NZXRhZGF0YShcbiAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlRGlyZWN0aXZlRGVwZW5kZW5jeUZhY2FkZSxcbiAgICBpc0NvbXBvbmVudDogdHJ1ZXxudWxsID0gbnVsbCk6IFIzRGlyZWN0aXZlRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQuRGlyZWN0aXZlLFxuICAgIGlzQ29tcG9uZW50OiBpc0NvbXBvbmVudCB8fCBkZWNsYXJhdGlvbi5raW5kID09PSAnY29tcG9uZW50JyxcbiAgICBzZWxlY3RvcjogZGVjbGFyYXRpb24uc2VsZWN0b3IsXG4gICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBpbnB1dHM6IGRlY2xhcmF0aW9uLmlucHV0cyA/PyBbXSxcbiAgICBvdXRwdXRzOiBkZWNsYXJhdGlvbi5vdXRwdXRzID8/IFtdLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UGlwZU1hcFRvTWV0YWRhdGEocGlwZXM6IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZVsncGlwZXMnXSk6XG4gICAgUjNQaXBlRGVwZW5kZW5jeU1ldGFkYXRhW10ge1xuICBpZiAoIXBpcGVzKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIE9iamVjdC5rZXlzKHBpcGVzKS5tYXAobmFtZSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6IFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5QaXBlLFxuICAgICAgbmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIocGlwZXNbbmFtZV0pLFxuICAgIH07XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UGlwZURlY2xhcmF0aW9uVG9NZXRhZGF0YShwaXBlOiBSM0RlY2xhcmVQaXBlRGVwZW5kZW5jeUZhY2FkZSk6XG4gICAgUjNQaXBlRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQuUGlwZSxcbiAgICBuYW1lOiBwaXBlLm5hbWUsXG4gICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihwaXBlLnR5cGUpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUppdFRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuLFxuICAgIGludGVycG9sYXRpb246IFtzdHJpbmcsIHN0cmluZ118dW5kZWZpbmVkKSB7XG4gIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPVxuICAgICAgaW50ZXJwb2xhdGlvbiA/IEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGludGVycG9sYXRpb24pIDogREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRztcbiAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlxuICBjb25zdCBwYXJzZWQgPSBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCBzb3VyY2VNYXBVcmwsIHtwcmVzZXJ2ZVdoaXRlc3BhY2VzLCBpbnRlcnBvbGF0aW9uQ29uZmlnfSk7XG4gIGlmIChwYXJzZWQuZXJyb3JzICE9PSBudWxsKSB7XG4gICAgY29uc3QgZXJyb3JzID0gcGFyc2VkLmVycm9ycy5tYXAoZXJyID0+IGVyci50b1N0cmluZygpKS5qb2luKCcsICcpO1xuICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3JzIGR1cmluZyBKSVQgY29tcGlsYXRpb24gb2YgdGVtcGxhdGUgZm9yICR7dHlwZU5hbWV9OiAke2Vycm9yc31gKTtcbiAgfVxuICBjb25zdCBiaW5kZXIgPSBuZXcgUjNUYXJnZXRCaW5kZXIobmV3IFNlbGVjdG9yTWF0Y2hlcigpKTtcbiAgY29uc3QgYm91bmRUYXJnZXQgPSBiaW5kZXIuYmluZCh7dGVtcGxhdGU6IHBhcnNlZC5ub2Rlc30pO1xuXG4gIHJldHVybiB7XG4gICAgdGVtcGxhdGU6IHBhcnNlZCxcbiAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgIGRlZmVyOiBjcmVhdGVSM0NvbXBvbmVudERlZmVyTWV0YWRhdGEoYm91bmRUYXJnZXQpXG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCB0aGUgZXhwcmVzc2lvbiwgaWYgcHJlc2VudCB0byBhbiBgUjNQcm92aWRlckV4cHJlc3Npb25gLlxuICpcbiAqIEluIEpJVCBtb2RlIHdlIGRvIG5vdCB3YW50IHRoZSBjb21waWxlciB0byB3cmFwIHRoZSBleHByZXNzaW9uIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbCBiZWNhdXNlLFxuICogaWYgaXQgaXMgcmVmZXJlbmNpbmcgYSB0eXBlIHRoYXQgaGFzIG5vdCB5ZXQgYmVlbiBkZWZpbmVkLCBpdCB3aWxsIGhhdmUgYWxyZWFkeSBiZWVuIHdyYXBwZWQgaW5cbiAqIGEgYGZvcndhcmRSZWYoKWAgLSBlaXRoZXIgYnkgdGhlIGFwcGxpY2F0aW9uIGRldmVsb3BlciBvciBkdXJpbmcgcGFydGlhbC1jb21waWxhdGlvbi4gVGh1cyB3ZSBjYW5cbiAqIHVzZSBgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmVgLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBNYXliZUZvcndhcmRSZWZFeHByZXNzaW9ufFxuICAgIHVuZGVmaW5lZCB7XG4gIGlmIChvYmouaGFzT3duUHJvcGVydHkocHJvcGVydHkpKSB7XG4gICAgcmV0dXJuIGNyZWF0ZU1heUJlRm9yd2FyZFJlZkV4cHJlc3Npb24oXG4gICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIob2JqW3Byb3BlcnR5XSksIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBFeHByZXNzaW9uKG9iajogYW55LCBwcm9wZXJ0eTogc3RyaW5nKTogV3JhcHBlZE5vZGVFeHByPGFueT58dW5kZWZpbmVkIHtcbiAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICByZXR1cm4gbmV3IFdyYXBwZWROb2RlRXhwcihvYmpbcHJvcGVydHldKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVQcm92aWRlZEluKHByb3ZpZGVkSW46IEZ1bmN0aW9ufHN0cmluZ3xudWxsfHVuZGVmaW5lZCk6IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24ge1xuICBjb25zdCBleHByZXNzaW9uID0gdHlwZW9mIHByb3ZpZGVkSW4gPT09ICdmdW5jdGlvbicgPyBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4gPz8gbnVsbCk7XG4gIC8vIFNlZSBgY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKClgIGZvciB3aHkgdGhpcyB1c2VzIGBGb3J3YXJkUmVmSGFuZGxpbmcuTm9uZWAuXG4gIHJldHVybiBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uKGV4cHJlc3Npb24sIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXXxudWxsfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkKTogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsIHtcbiAgcmV0dXJuIGZhY2FkZXMgPT0gbnVsbCA/IG51bGwgOiBmYWNhZGVzLm1hcChjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEoZmFjYWRlOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSk6IFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgY29uc3QgaXNBdHRyaWJ1dGVEZXAgPSBmYWNhZGUuYXR0cmlidXRlICE9IG51bGw7ICAvLyBib3RoIGBudWxsYCBhbmQgYHVuZGVmaW5lZGBcbiAgY29uc3QgcmF3VG9rZW4gPSBmYWNhZGUudG9rZW4gPT09IG51bGwgPyBudWxsIDogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudG9rZW4pO1xuICAvLyBJbiBKSVQgbW9kZSwgaWYgdGhlIGRlcCBpcyBhbiBgQEF0dHJpYnV0ZSgpYCB0aGVuIHdlIHVzZSB0aGUgYXR0cmlidXRlIG5hbWUgZ2l2ZW4gaW5cbiAgLy8gYGF0dHJpYnV0ZWAgcmF0aGVyIHRoYW4gdGhlIGB0b2tlbmAuXG4gIGNvbnN0IHRva2VuID0gaXNBdHRyaWJ1dGVEZXAgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5hdHRyaWJ1dGUpIDogcmF3VG9rZW47XG4gIHJldHVybiBjcmVhdGVSM0RlcGVuZGVuY3lNZXRhZGF0YShcbiAgICAgIHRva2VuLCBpc0F0dHJpYnV0ZURlcCwgZmFjYWRlLmhvc3QsIGZhY2FkZS5vcHRpb25hbCwgZmFjYWRlLnNlbGYsIGZhY2FkZS5za2lwU2VsZik7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGEoZmFjYWRlOiBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUpOlxuICAgIFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgY29uc3QgaXNBdHRyaWJ1dGVEZXAgPSBmYWNhZGUuYXR0cmlidXRlID8/IGZhbHNlO1xuICBjb25zdCB0b2tlbiA9IGZhY2FkZS50b2tlbiA9PT0gbnVsbCA/IG51bGwgOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50b2tlbik7XG4gIHJldHVybiBjcmVhdGVSM0RlcGVuZGVuY3lNZXRhZGF0YShcbiAgICAgIHRva2VuLCBpc0F0dHJpYnV0ZURlcCwgZmFjYWRlLmhvc3QgPz8gZmFsc2UsIGZhY2FkZS5vcHRpb25hbCA/PyBmYWxzZSwgZmFjYWRlLnNlbGYgPz8gZmFsc2UsXG4gICAgICBmYWNhZGUuc2tpcFNlbGYgPz8gZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVSM0RlcGVuZGVuY3lNZXRhZGF0YShcbiAgICB0b2tlbjogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fG51bGwsIGlzQXR0cmlidXRlRGVwOiBib29sZWFuLCBob3N0OiBib29sZWFuLCBvcHRpb25hbDogYm9vbGVhbixcbiAgICBzZWxmOiBib29sZWFuLCBza2lwU2VsZjogYm9vbGVhbik6IFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgLy8gSWYgdGhlIGRlcCBpcyBhbiBgQEF0dHJpYnV0ZSgpYCB0aGUgYGF0dHJpYnV0ZU5hbWVUeXBlYCBvdWdodCB0byBiZSB0aGUgYHVua25vd25gIHR5cGUuXG4gIC8vIEJ1dCB0eXBlcyBhcmUgbm90IGF2YWlsYWJsZSBhdCBydW50aW1lIHNvIHdlIGp1c3QgdXNlIGEgbGl0ZXJhbCBgXCI8dW5rbm93bj5cImAgc3RyaW5nIGFzIGEgZHVtbXlcbiAgLy8gbWFya2VyLlxuICBjb25zdCBhdHRyaWJ1dGVOYW1lVHlwZSA9IGlzQXR0cmlidXRlRGVwID8gbGl0ZXJhbCgndW5rbm93bicpIDogbnVsbDtcbiAgcmV0dXJuIHt0b2tlbiwgYXR0cmlidXRlTmFtZVR5cGUsIGhvc3QsIG9wdGlvbmFsLCBzZWxmLCBza2lwU2VsZn07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVIzQ29tcG9uZW50RGVmZXJNZXRhZGF0YShib3VuZFRhcmdldDogQm91bmRUYXJnZXQ8YW55Pik6IFIzQ29tcG9uZW50RGVmZXJNZXRhZGF0YSB7XG4gIGNvbnN0IGRlZmVycmVkQmxvY2tzID0gYm91bmRUYXJnZXQuZ2V0RGVmZXJCbG9ja3MoKTtcbiAgY29uc3QgYmxvY2tzID0gbmV3IE1hcDxEZWZlcnJlZEJsb2NrLCBBcnJvd0Z1bmN0aW9uRXhwcnxudWxsPigpO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgZGVmZXJyZWRCbG9ja3MpIHtcbiAgICAvLyBUT0RPOiBsZWF2aW5nIGRlcGVuZGVuY3kgZnVuY3Rpb24gZW1wdHkgaW4gSklUIG1vZGUgZm9yIG5vdyxcbiAgICAvLyB0byBiZSBpbXBsZW1lbnRlZCBhcyBvbmUgb2YgdGhlIG5leHQgc3RlcHMuXG4gICAgYmxvY2tzLnNldChibG9jaywgbnVsbCk7XG4gIH1cblxuICByZXR1cm4ge21vZGU6IERlZmVyQmxvY2tEZXBzRW1pdE1vZGUuUGVyQmxvY2ssIGJsb2Nrc307XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RIb3N0QmluZGluZ3MoXG4gICAgcHJvcE1ldGFkYXRhOiB7W2tleTogc3RyaW5nXTogYW55W119LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgaG9zdD86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgLy8gRmlyc3QgcGFyc2UgdGhlIGRlY2xhcmF0aW9ucyBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgY29uc3QgYmluZGluZ3MgPSBwYXJzZUhvc3RCaW5kaW5ncyhob3N0IHx8IHt9KTtcblxuICAvLyBBZnRlciB0aGF0IGNoZWNrIGhvc3QgYmluZGluZ3MgZm9yIGVycm9yc1xuICBjb25zdCBlcnJvcnMgPSB2ZXJpZnlIb3N0QmluZGluZ3MoYmluZGluZ3MsIHNvdXJjZVNwYW4pO1xuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubWFwKChlcnJvcjogUGFyc2VFcnJvcikgPT4gZXJyb3IubXNnKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICAvLyBOZXh0LCBsb29wIG92ZXIgdGhlIHByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCwgbG9va2luZyBmb3IgQEhvc3RCaW5kaW5nIGFuZCBASG9zdExpc3RlbmVyLlxuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSG9zdEJpbmRpbmcoYW5uKSkge1xuICAgICAgICAgIC8vIFNpbmNlIHRoaXMgaXMgYSBkZWNvcmF0b3IsIHdlIGtub3cgdGhhdCB0aGUgdmFsdWUgaXMgYSBjbGFzcyBtZW1iZXIuIEFsd2F5cyBhY2Nlc3MgaXRcbiAgICAgICAgICAvLyB0aHJvdWdoIGB0aGlzYCBzbyB0aGF0IGZ1cnRoZXIgZG93biB0aGUgbGluZSBpdCBjYW4ndCBiZSBjb25mdXNlZCBmb3IgYSBsaXRlcmFsIHZhbHVlXG4gICAgICAgICAgLy8gKGUuZy4gaWYgdGhlcmUncyBhIHByb3BlcnR5IGNhbGxlZCBgdHJ1ZWApLlxuICAgICAgICAgIGJpbmRpbmdzLnByb3BlcnRpZXNbYW5uLmhvc3RQcm9wZXJ0eU5hbWUgfHwgZmllbGRdID1cbiAgICAgICAgICAgICAgZ2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nKCd0aGlzJywgZmllbGQpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9zdExpc3RlbmVyKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5saXN0ZW5lcnNbYW5uLmV2ZW50TmFtZSB8fCBmaWVsZF0gPSBgJHtmaWVsZH0oJHsoYW5uLmFyZ3MgfHwgW10pLmpvaW4oJywnKX0pYDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJpbmRpbmdzO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RCaW5kaW5nKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0QmluZGluZyB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RCaW5kaW5nJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0TGlzdGVuZXIodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RMaXN0ZW5lciB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RMaXN0ZW5lcic7XG59XG5cblxuZnVuY3Rpb24gaXNJbnB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgSW5wdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdJbnB1dCc7XG59XG5cbmZ1bmN0aW9uIGlzT3V0cHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBPdXRwdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdPdXRwdXQnO1xufVxuXG5mdW5jdGlvbiBpbnB1dHNQYXJ0aWFsTWV0YWRhdGFUb0lucHV0TWV0YWRhdGEoXG4gICAgaW5wdXRzOiBOb25OdWxsYWJsZTxSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGVbJ2lucHV0cyddPikge1xuICByZXR1cm4gT2JqZWN0LmtleXMoaW5wdXRzKS5yZWR1Y2U8UmVjb3JkPHN0cmluZywgUjNJbnB1dE1ldGFkYXRhPj4oXG4gICAgICAocmVzdWx0LCBtaW5pZmllZENsYXNzTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0c1ttaW5pZmllZENsYXNzTmFtZV07XG5cbiAgICAgICAgLy8gSGFuZGxlIGxlZ2FjeSBwYXJ0aWFsIGlucHV0IG91dHB1dC5cbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICByZXN1bHRbbWluaWZpZWRDbGFzc05hbWVdID0gcGFyc2VMZWdhY3lJbnB1dFBhcnRpYWxPdXRwdXQodmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdFttaW5pZmllZENsYXNzTmFtZV0gPSB7XG4gICAgICAgICAgICBiaW5kaW5nUHJvcGVydHlOYW1lOiB2YWx1ZS5wdWJsaWNOYW1lLFxuICAgICAgICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IG1pbmlmaWVkQ2xhc3NOYW1lLFxuICAgICAgICAgICAgdHJhbnNmb3JtRnVuY3Rpb246IHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsID9cbiAgICAgICAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uKSA6XG4gICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIHJlcXVpcmVkOiB2YWx1ZS5pc1JlcXVpcmVkLFxuICAgICAgICAgICAgaXNTaWduYWw6IHZhbHVlLmlzU2lnbmFsLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSxcbiAgICAgIHt9KTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgdGhlIGxlZ2FjeSBpbnB1dCBwYXJ0aWFsIG91dHB1dC4gRm9yIG1vcmUgZGV0YWlscyBzZWUgYHBhcnRpYWwvZGlyZWN0aXZlLnRzYC5cbiAqIFRPRE8obGVnYWN5LXBhcnRpYWwtb3V0cHV0LWlucHV0cyk6IFJlbW92ZSBpbiB2MTguXG4gKi9cbmZ1bmN0aW9uIHBhcnNlTGVnYWN5SW5wdXRQYXJ0aWFsT3V0cHV0KHZhbHVlOiBMZWdhY3lJbnB1dFBhcnRpYWxNYXBwaW5nKTogUjNJbnB1dE1ldGFkYXRhIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4ge1xuICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogdmFsdWUsXG4gICAgICBjbGFzc1Byb3BlcnR5TmFtZTogdmFsdWUsXG4gICAgICB0cmFuc2Zvcm1GdW5jdGlvbjogbnVsbCxcbiAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgIC8vIGxlZ2FjeSBwYXJ0aWFsIG91dHB1dCBkb2VzIG5vdCBjYXB0dXJlIHNpZ25hbCBpbnB1dHMuXG4gICAgICBpc1NpZ25hbDogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYmluZGluZ1Byb3BlcnR5TmFtZTogdmFsdWVbMF0sXG4gICAgY2xhc3NQcm9wZXJ0eU5hbWU6IHZhbHVlWzFdLFxuICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiB2YWx1ZVsyXSA/IG5ldyBXcmFwcGVkTm9kZUV4cHIodmFsdWVbMl0pIDogbnVsbCxcbiAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgLy8gbGVnYWN5IHBhcnRpYWwgb3V0cHV0IGRvZXMgbm90IGNhcHR1cmUgc2lnbmFsIGlucHV0cy5cbiAgICBpc1NpZ25hbDogZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW5wdXRzQXJyYXkoXG4gICAgdmFsdWVzOiAoc3RyaW5nfHtuYW1lOiBzdHJpbmcsIGFsaWFzPzogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4sIHRyYW5zZm9ybT86IEZ1bmN0aW9ufSlbXSkge1xuICByZXR1cm4gdmFsdWVzLnJlZHVjZTxSZWNvcmQ8c3RyaW5nLCBSM0lucHV0TWV0YWRhdGE+PigocmVzdWx0cywgdmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgW2JpbmRpbmdQcm9wZXJ0eU5hbWUsIGNsYXNzUHJvcGVydHlOYW1lXSA9IHBhcnNlTWFwcGluZ1N0cmluZyh2YWx1ZSk7XG4gICAgICByZXN1bHRzW2NsYXNzUHJvcGVydHlOYW1lXSA9IHtcbiAgICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZSxcbiAgICAgICAgY2xhc3NQcm9wZXJ0eU5hbWUsXG4gICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgLy8gU2lnbmFsIGlucHV0cyBub3Qgc3VwcG9ydGVkIGZvciB0aGUgaW5wdXRzIGFycmF5LlxuICAgICAgICBpc1NpZ25hbDogZmFsc2UsXG4gICAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBudWxsLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0c1t2YWx1ZS5uYW1lXSA9IHtcbiAgICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogdmFsdWUuYWxpYXMgfHwgdmFsdWUubmFtZSxcbiAgICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IHZhbHVlLm5hbWUsXG4gICAgICAgIHJlcXVpcmVkOiB2YWx1ZS5yZXF1aXJlZCB8fCBmYWxzZSxcbiAgICAgICAgLy8gU2lnbmFsIGlucHV0cyBub3Qgc3VwcG9ydGVkIGZvciB0aGUgaW5wdXRzIGFycmF5LlxuICAgICAgICBpc1NpZ25hbDogZmFsc2UsXG4gICAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiB2YWx1ZS50cmFuc2Zvcm0gIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIodmFsdWUudHJhbnNmb3JtKSA6IG51bGwsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSwge30pO1xufVxuXG5mdW5jdGlvbiBwYXJzZU1hcHBpbmdTdHJpbmdBcnJheSh2YWx1ZXM6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlPFJlY29yZDxzdHJpbmcsIHN0cmluZz4+KChyZXN1bHRzLCB2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IFthbGlhcywgZmllbGROYW1lXSA9IHBhcnNlTWFwcGluZ1N0cmluZyh2YWx1ZSk7XG4gICAgcmVzdWx0c1tmaWVsZE5hbWVdID0gYWxpYXM7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0sIHt9KTtcbn1cblxuZnVuY3Rpb24gcGFyc2VNYXBwaW5nU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBbYWxpYXM6IHN0cmluZywgZmllbGROYW1lOiBzdHJpbmddIHtcbiAgLy8gRWl0aGVyIHRoZSB2YWx1ZSBpcyAnZmllbGQnIG9yICdmaWVsZDogcHJvcGVydHknLiBJbiB0aGUgZmlyc3QgY2FzZSwgYHByb3BlcnR5YCB3aWxsXG4gIC8vIGJlIHVuZGVmaW5lZCwgaW4gd2hpY2ggY2FzZSB0aGUgZmllbGQgbmFtZSBzaG91bGQgYWxzbyBiZSB1c2VkIGFzIHRoZSBwcm9wZXJ0eSBuYW1lLlxuICBjb25zdCBbZmllbGROYW1lLCBiaW5kaW5nUHJvcGVydHlOYW1lXSA9IHZhbHVlLnNwbGl0KCc6JywgMikubWFwKHN0ciA9PiBzdHIudHJpbSgpKTtcbiAgcmV0dXJuIFtiaW5kaW5nUHJvcGVydHlOYW1lID8/IGZpZWxkTmFtZSwgZmllbGROYW1lXTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVQaXBlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlUGlwZUZhY2FkZSk6IFIzUGlwZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICBwaXBlTmFtZTogZGVjbGFyYXRpb24ubmFtZSxcbiAgICBkZXBzOiBudWxsLFxuICAgIHB1cmU6IGRlY2xhcmF0aW9uLnB1cmUgPz8gdHJ1ZSxcbiAgICBpc1N0YW5kYWxvbmU6IGRlY2xhcmF0aW9uLmlzU3RhbmRhbG9uZSA/PyBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVJbmplY3RvckZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZUluamVjdG9yRmFjYWRlKTpcbiAgICBSM0luamVjdG9yTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgJiYgZGVjbGFyYXRpb24ucHJvdmlkZXJzLmxlbmd0aCA+IDAgP1xuICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICBudWxsLFxuICAgIGltcG9ydHM6IGRlY2xhcmF0aW9uLmltcG9ydHMgIT09IHVuZGVmaW5lZCA/XG4gICAgICAgIGRlY2xhcmF0aW9uLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSkgOlxuICAgICAgICBbXSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1Ymxpc2hGYWNhZGUoZ2xvYmFsOiBhbnkpIHtcbiAgY29uc3Qgbmc6IEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUgPSBnbG9iYWwubmcgfHwgKGdsb2JhbC5uZyA9IHt9KTtcbiAgbmcuybVjb21waWxlckZhY2FkZSA9IG5ldyBDb21waWxlckZhY2FkZUltcGwoKTtcbn1cbiJdfQ==