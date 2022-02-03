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
import { compileNgModule, compileNgModuleDeclarationExpression } from './render3/r3_module_compiler';
import { compilePipeFromMetadata } from './render3/r3_pipe_compiler';
import { createMayBeForwardRefExpression, getSafePropertyAccessString, wrapReference } from './render3/util';
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
            internalType: new WrappedNodeExpr(facade.type),
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
            internalType: new WrappedNodeExpr(facade.type),
            typeArgumentCount: facade.typeArgumentCount,
            providedIn: computeProvidedIn(facade.providedIn),
            useClass: convertToProviderExpression(facade, USE_CLASS),
            useFactory: wrapExpression(facade, USE_FACTORY),
            useValue: convertToProviderExpression(facade, USE_VALUE),
            useExisting: convertToProviderExpression(facade, USE_EXISTING),
            deps: facade.deps?.map(convertR3DependencyMetadata),
        }, 
        /* resolveForwardRefs */ true);
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
    }
    compileInjectableDeclaration(angularCoreEnv, sourceMapUrl, facade) {
        const { expression, statements } = compileInjectable({
            name: facade.type.name,
            type: wrapReference(facade.type),
            internalType: new WrappedNodeExpr(facade.type),
            typeArgumentCount: 0,
            providedIn: computeProvidedIn(facade.providedIn),
            useClass: convertToProviderExpression(facade, USE_CLASS),
            useFactory: wrapExpression(facade, USE_FACTORY),
            useValue: convertToProviderExpression(facade, USE_VALUE),
            useExisting: convertToProviderExpression(facade, USE_EXISTING),
            deps: facade.deps?.map(convertR3DeclareDependencyMetadata),
        }, 
        /* resolveForwardRefs */ true);
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
    }
    compileInjector(angularCoreEnv, sourceMapUrl, facade) {
        const meta = {
            name: facade.name,
            type: wrapReference(facade.type),
            internalType: new WrappedNodeExpr(facade.type),
            providers: new WrappedNodeExpr(facade.providers),
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
            internalType: new WrappedNodeExpr(facade.type),
            adjacentType: new WrappedNodeExpr(facade.type),
            bootstrap: facade.bootstrap.map(wrapReference),
            declarations: facade.declarations.map(wrapReference),
            imports: facade.imports.map(wrapReference),
            exports: facade.exports.map(wrapReference),
            emitInline: true,
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
            declarationListEmitMode: 0 /* Direct */,
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
            internalType: new WrappedNodeExpr(meta.type),
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
            internalType: new WrappedNodeExpr(meta.type),
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
const USE_CLASS = Object.keys({ useClass: null })[0];
const USE_FACTORY = Object.keys({ useFactory: null })[0];
const USE_VALUE = Object.keys({ useValue: null })[0];
const USE_EXISTING = Object.keys({ useExisting: null })[0];
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
        createMayBeForwardRefExpression(new WrappedNodeExpr(predicate), 1 /* Wrapped */);
}
function convertDirectiveFacadeToMetadata(facade) {
    const inputsFromMetadata = parseInputOutputs(facade.inputs || []);
    const outputsFromMetadata = parseInputOutputs(facade.outputs || []);
    const propMetadata = facade.propMetadata;
    const inputsFromType = {};
    const outputsFromType = {};
    for (const field in propMetadata) {
        if (propMetadata.hasOwnProperty(field)) {
            propMetadata[field].forEach(ann => {
                if (isInput(ann)) {
                    inputsFromType[field] =
                        ann.bindingPropertyName ? [ann.bindingPropertyName, field] : field;
                }
                else if (isOutput(ann)) {
                    outputsFromType[field] = ann.bindingPropertyName || field;
                }
            });
        }
    }
    return {
        ...facade,
        typeArgumentCount: 0,
        typeSourceSpan: facade.typeSourceSpan,
        type: wrapReference(facade.type),
        internalType: new WrappedNodeExpr(facade.type),
        deps: null,
        host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host),
        inputs: { ...inputsFromMetadata, ...inputsFromType },
        outputs: { ...outputsFromMetadata, ...outputsFromType },
        queries: facade.queries.map(convertToR3QueryMetadata),
        providers: facade.providers != null ? new WrappedNodeExpr(facade.providers) : null,
        viewQueries: facade.viewQueries.map(convertToR3QueryMetadata),
        fullInheritance: false,
    };
}
function convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan) {
    return {
        name: declaration.type.name,
        type: wrapReference(declaration.type),
        typeSourceSpan,
        internalType: new WrappedNodeExpr(declaration.type),
        selector: declaration.selector ?? null,
        inputs: declaration.inputs ?? {},
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
function convertOpaqueValuesToExpressions(obj) {
    const result = {};
    for (const key of Object.keys(obj)) {
        result[key] = new WrappedNodeExpr(obj[key]);
    }
    return result;
}
function convertDeclareComponentFacadeToMetadata(declaration, typeSourceSpan, sourceMapUrl) {
    const { template, interpolation } = parseJitTemplate(declaration.template, declaration.type.name, sourceMapUrl, declaration.preserveWhitespaces ?? false, declaration.interpolation);
    return {
        ...convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan),
        template,
        styles: declaration.styles ?? [],
        directives: (declaration.components ?? [])
            .concat(declaration.directives ?? [])
            .map(convertUsedDirectiveDeclarationToMetadata),
        pipes: convertUsedPipesToMetadata(declaration.pipes),
        viewProviders: declaration.viewProviders !== undefined ?
            new WrappedNodeExpr(declaration.viewProviders) :
            null,
        animations: declaration.animations !== undefined ? new WrappedNodeExpr(declaration.animations) :
            null,
        changeDetection: declaration.changeDetection ?? ChangeDetectionStrategy.Default,
        encapsulation: declaration.encapsulation ?? ViewEncapsulation.Emulated,
        interpolation,
        declarationListEmitMode: 2 /* ClosureResolved */,
        relativeContextFilePath: '',
        i18nUseExternalIds: true,
    };
}
function convertUsedDirectiveDeclarationToMetadata(declaration) {
    return {
        selector: declaration.selector,
        type: new WrappedNodeExpr(declaration.type),
        inputs: declaration.inputs ?? [],
        outputs: declaration.outputs ?? [],
        exportAs: declaration.exportAs ?? null,
    };
}
function convertUsedPipesToMetadata(declaredPipes) {
    const pipes = new Map();
    if (declaredPipes === undefined) {
        return pipes;
    }
    for (const pipeName of Object.keys(declaredPipes)) {
        const pipeType = declaredPipes[pipeName];
        pipes.set(pipeName, new WrappedNodeExpr(pipeType));
    }
    return pipes;
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
        return createMayBeForwardRefExpression(new WrappedNodeExpr(obj[property]), 0 /* None */);
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
    return createMayBeForwardRefExpression(expression, 0 /* None */);
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
function parseInputOutputs(values) {
    return values.reduce((map, value) => {
        const [field, property] = value.split(',').map(piece => piece.trim());
        map[field] = property || field;
        return map;
    }, {});
}
function convertDeclarePipeFacadeToMetadata(declaration) {
    return {
        name: declaration.type.name,
        type: wrapReference(declaration.type),
        internalType: new WrappedNodeExpr(declaration.type),
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
        internalType: new WrappedNodeExpr(declaration.type),
        providers: declaration.providers !== undefined ? new WrappedNodeExpr(declaration.providers) :
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsdUJBQXVCLEVBQTRDLGlCQUFpQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzVHLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ25HLE9BQU8sRUFBQyxjQUFjLEVBQWMsT0FBTyxFQUFFLFdBQVcsRUFBYSxZQUFZLEVBQUUsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDL0gsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBOEIsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDOUUsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGFBQWEsRUFBdUIsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRyxPQUFPLEVBQUMsZUFBZSxFQUFxQixNQUFNLGdDQUFnQyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsZUFBZSxFQUFFLG9DQUFvQyxFQUFxQixNQUFNLDhCQUE4QixDQUFDO0FBQ3ZILE9BQU8sRUFBQyx1QkFBdUIsRUFBaUIsTUFBTSw0QkFBNEIsQ0FBQztBQUNuRixPQUFPLEVBQUMsK0JBQStCLEVBQXNCLDJCQUEyQixFQUE2QixhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUUxSixPQUFPLEVBQUMsNEJBQTRCLEVBQUUsNEJBQTRCLEVBQXNC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QUUsSUFBSTtRQUNWLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxJQUFJLElBQUk7UUFDOUIsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZLElBQUksS0FBSztLQUNoRCxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsc0NBQXNDLENBQUMsV0FBb0M7SUFFbEYsT0FBTztRQUNMLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUk7UUFDM0IsSUFBSSxFQUFFLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1FBQ3JDLFlBQVksRUFBRSxJQUFJLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1FBQ25ELFNBQVMsRUFBRSxXQUFXLENBQUMsU0FBUyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsSUFBSTtRQUNyRCxPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQztZQUN4QyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxFQUFFO0tBQ1AsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLE1BQVc7SUFDdkMsTUFBTSxFQUFFLEdBQTJCLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLEVBQUUsQ0FBQyxlQUFlLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVyRmFjYWRlLCBDb3JlRW52aXJvbm1lbnQsIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUsIE9wYXF1ZVZhbHVlLCBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUsIFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCBSM0RlY2xhcmVGYWN0b3J5RmFjYWRlLCBSM0RlY2xhcmVJbmplY3RhYmxlRmFjYWRlLCBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSwgUjNEZWNsYXJlTmdNb2R1bGVGYWNhZGUsIFIzRGVjbGFyZVBpcGVGYWNhZGUsIFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFGYWNhZGUsIFIzRGVjbGFyZVVzZWREaXJlY3RpdmVGYWNhZGUsIFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlLCBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBSM0ZhY3RvcnlEZWZNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSwgUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlLCBSM1BpcGVNZXRhZGF0YUZhY2FkZSwgUjNRdWVyeU1ldGFkYXRhRmFjYWRlLCBTdHJpbmdNYXAsIFN0cmluZ01hcFdpdGhSZW5hbWV9IGZyb20gJy4vY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZSc7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIEhvc3RCaW5kaW5nLCBIb3N0TGlzdGVuZXIsIElucHV0LCBPdXRwdXQsIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtjb21waWxlSW5qZWN0YWJsZX0gZnJvbSAnLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0RlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBsaXRlcmFsLCBMaXRlcmFsRXhwciwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXIsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2ppdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgcjNKaXRUeXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgRmFjdG9yeVRhcmdldCwgUjNEZXBlbmRlbmN5TWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7Y29tcGlsZUluamVjdG9yLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlcic7XG5pbXBvcnQge1IzSml0UmVmbGVjdG9yfSBmcm9tICcuL3JlbmRlcjMvcjNfaml0JztcbmltcG9ydCB7Y29tcGlsZU5nTW9kdWxlLCBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24sIFIzTmdNb2R1bGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uLCBGb3J3YXJkUmVmSGFuZGxpbmcsIGdldFNhZmVQcm9wZXJ0eUFjY2Vzc1N0cmluZywgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgd3JhcFJlZmVyZW5jZX0gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YSwgUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy92aWV3L2FwaSc7XG5pbXBvcnQge2NvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEsIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEsIFBhcnNlZEhvc3RCaW5kaW5ncywgcGFyc2VIb3N0QmluZGluZ3MsIHZlcmlmeUhvc3RCaW5kaW5nc30gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHttYWtlQmluZGluZ1BhcnNlciwgcGFyc2VUZW1wbGF0ZX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlckZhY2FkZUltcGwgaW1wbGVtZW50cyBDb21waWxlckZhY2FkZSB7XG4gIEZhY3RvcnlUYXJnZXQgPSBGYWN0b3J5VGFyZ2V0IGFzIGFueTtcbiAgUmVzb3VyY2VMb2FkZXIgPSBSZXNvdXJjZUxvYWRlcjtcbiAgcHJpdmF0ZSBlbGVtZW50U2NoZW1hUmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBqaXRFdmFsdWF0b3IgPSBuZXcgSml0RXZhbHVhdG9yKCkpIHt9XG5cbiAgY29tcGlsZVBpcGUoYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIGZhY2FkZTogUjNQaXBlTWV0YWRhdGFGYWNhZGUpOlxuICAgICAgYW55IHtcbiAgICBjb25zdCBtZXRhZGF0YTogUjNQaXBlTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgICAgZGVwczogbnVsbCxcbiAgICAgIHBpcGVOYW1lOiBmYWNhZGUucGlwZU5hbWUsXG4gICAgICBwdXJlOiBmYWNhZGUucHVyZSxcbiAgICAgIGlzU3RhbmRhbG9uZTogZmFjYWRlLmlzU3RhbmRhbG9uZSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGFkYXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlUGlwZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlUGlwZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlUGlwZUZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24pO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB7ZXhwcmVzc2lvbiwgc3RhdGVtZW50c30gPSBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICAgICAgdXNlQ2xhc3M6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9DTEFTUyksXG4gICAgICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRkFDVE9SWSksXG4gICAgICAgICAgdXNlVmFsdWU6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9WQUxVRSksXG4gICAgICAgICAgdXNlRXhpc3Rpbmc6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9FWElTVElORyksXG4gICAgICAgICAgZGVwczogZmFjYWRlLmRlcHM/Lm1hcChjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEpLFxuICAgICAgICB9LFxuICAgICAgICAvKiByZXNvbHZlRm9yd2FyZFJlZnMgKi8gdHJ1ZSk7XG5cbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUluamVjdGFibGVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RlY2xhcmVJbmplY3RhYmxlRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB7ZXhwcmVzc2lvbiwgc3RhdGVtZW50c30gPSBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IGZhY2FkZS50eXBlLm5hbWUsXG4gICAgICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICAgICAgdXNlQ2xhc3M6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9DTEFTUyksXG4gICAgICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRkFDVE9SWSksXG4gICAgICAgICAgdXNlVmFsdWU6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9WQUxVRSksXG4gICAgICAgICAgdXNlRXhpc3Rpbmc6IGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9FWElTVElORyksXG4gICAgICAgICAgZGVwczogZmFjYWRlLmRlcHM/Lm1hcChjb252ZXJ0UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhKSxcbiAgICAgICAgfSxcbiAgICAgICAgLyogcmVzb2x2ZUZvcndhcmRSZWZzICovIHRydWUpO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvcihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgcHJvdmlkZXJzOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSksXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZUluamVjdG9yRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlSW5qZWN0b3JGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhID0ge1xuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgYWRqYWNlbnRUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGJvb3RzdHJhcDogZmFjYWRlLmJvb3RzdHJhcC5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZXhwb3J0czogZmFjYWRlLmV4cG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZW1pdElubGluZTogdHJ1ZSxcbiAgICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBmYWxzZSxcbiAgICAgIHNjaGVtYXM6IGZhY2FkZS5zY2hlbWFzID8gZmFjYWRlLnNjaGVtYXMubWFwKHdyYXBSZWZlcmVuY2UpIDogbnVsbCxcbiAgICAgIGlkOiBmYWNhZGUuaWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5pZCkgOiBudWxsLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZU5nTW9kdWxlKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlTmdNb2R1bGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24oZGVjbGFyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZURpcmVjdGl2ZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhID0gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0RpcmVjdGl2ZScsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbik7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gICAgY29uc3Qge3RlbXBsYXRlLCBpbnRlcnBvbGF0aW9ufSA9IHBhcnNlSml0VGVtcGxhdGUoXG4gICAgICAgIGZhY2FkZS50ZW1wbGF0ZSwgZmFjYWRlLm5hbWUsIHNvdXJjZU1hcFVybCwgZmFjYWRlLnByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICAgIGZhY2FkZS5pbnRlcnBvbGF0aW9uKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIGNvbXBvbmVudCBtZXRhZGF0YSwgaW5jbHVkaW5nIHRlbXBsYXRlLCBpbnRvIGFuIGV4cHJlc3Npb24uXG4gICAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAgIC4uLmZhY2FkZSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICAgIC4uLmNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSksXG4gICAgICBzZWxlY3RvcjogZmFjYWRlLnNlbGVjdG9yIHx8IHRoaXMuZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LmdldERlZmF1bHRDb21wb25lbnRFbGVtZW50TmFtZSgpLFxuICAgICAgdGVtcGxhdGUsXG4gICAgICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0LFxuICAgICAgc3R5bGVzOiBbLi4uZmFjYWRlLnN0eWxlcywgLi4udGVtcGxhdGUuc3R5bGVzXSxcbiAgICAgIGVuY2Fwc3VsYXRpb246IGZhY2FkZS5lbmNhcHN1bGF0aW9uIGFzIGFueSxcbiAgICAgIGludGVycG9sYXRpb24sXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IGZhY2FkZS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICBhbmltYXRpb25zOiBmYWNhZGUuYW5pbWF0aW9ucyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuYW5pbWF0aW9ucykgOiBudWxsLFxuICAgICAgdmlld1Byb3ZpZGVyczogZmFjYWRlLnZpZXdQcm92aWRlcnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnZpZXdQcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICAgIH07XG4gICAgY29uc3Qgaml0RXhwcmVzc2lvblNvdXJjZU1hcCA9IGBuZzovLy8ke2ZhY2FkZS5uYW1lfS5qc2A7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZUNvbXBvbmVudEZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBqaXRFeHByZXNzaW9uU291cmNlTWFwLCBtZXRhKTtcbiAgfVxuXG4gIGNvbXBpbGVDb21wb25lbnREZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgdHlwZVNvdXJjZVNwYW4gPVxuICAgICAgICB0aGlzLmNyZWF0ZVBhcnNlU291cmNlU3BhbignQ29tcG9uZW50JywgZGVjbGFyYXRpb24udHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwpO1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZUNvbXBvbmVudEZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24sIHR5cGVTb3VyY2VTcGFuLCBzb3VyY2VNYXBVcmwpO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBtZXRhKTtcbiAgfVxuXG4gIHByaXZhdGUgY29tcGlsZUNvbXBvbmVudEZyb21NZXRhKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIobWV0YS5pbnRlcnBvbGF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgcmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKSB7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgbmFtZTogbWV0YS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShtZXRhLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKG1ldGEudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogbWV0YS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KG1ldGEuZGVwcyksXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5RGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEZWNsYXJlRmFjdG9yeUZhY2FkZSkge1xuICAgIGNvbnN0IGZhY3RvcnlSZXMgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIG5hbWU6IG1ldGEudHlwZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShtZXRhLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKG1ldGEudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgIGRlcHM6IEFycmF5LmlzQXJyYXkobWV0YS5kZXBzKSA/IG1ldGEuZGVwcy5tYXAoY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YS5kZXBzLFxuICAgICAgdGFyZ2V0OiBtZXRhLnRhcmdldCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICBmYWN0b3J5UmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGZhY3RvcnlSZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gcjNKaXRUeXBlU291cmNlU3BhbihraW5kLCB0eXBlTmFtZSwgc291cmNlVXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBKSVQgY29tcGlsZXMgYW4gZXhwcmVzc2lvbiBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGF0IGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICAgKiBAcGFyYW0gY29udGV4dCBhbiBvYmplY3QgbWFwIG9mIEBhbmd1bGFyL2NvcmUgc3ltYm9sIG5hbWVzIHRvIHN5bWJvbHMgd2hpY2ggd2lsbCBiZSBhdmFpbGFibGVcbiAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHNvdXJjZVVybCBhIFVSTCB0byB1c2UgZm9yIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBwcmVTdGF0ZW1lbnRzIGEgY29sbGVjdGlvbiBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGV2YWx1YXRlZCBiZWZvcmUgdGhlIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGppdEV4cHJlc3Npb24oXG4gICAgICBkZWY6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBzb3VyY2VVcmw6IHN0cmluZyxcbiAgICAgIHByZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgICAvLyBUaGVyZWZvcmUsIGl0cyBzdGF0ZW1lbnRzIG5lZWQgdG8gcHJlY2VkZSB0aGUgYWN0dWFsIEpJVCBvcGVyYXRpb24uIFRoZSBmaW5hbCBzdGF0ZW1lbnQgaXMgYVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mICRkZWYgd2hpY2ggaXMgc2V0IHRvIHRoZSBleHByZXNzaW9uIGJlaW5nIGNvbXBpbGVkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFN0YXRlbWVudFtdID0gW1xuICAgICAgLi4ucHJlU3RhdGVtZW50cyxcbiAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdCgnJGRlZicsIGRlZiwgdW5kZWZpbmVkLCBTdG10TW9kaWZpZXIuRXhwb3J0ZWQpLFxuICAgIF07XG5cbiAgICBjb25zdCByZXMgPSB0aGlzLmppdEV2YWx1YXRvci5ldmFsdWF0ZVN0YXRlbWVudHMoXG4gICAgICAgIHNvdXJjZVVybCwgc3RhdGVtZW50cywgbmV3IFIzSml0UmVmbGVjdG9yKGNvbnRleHQpLCAvKiBlbmFibGVTb3VyY2VNYXBzICovIHRydWUpO1xuICAgIHJldHVybiByZXNbJyRkZWYnXTtcbiAgfVxufVxuXG4vLyBUaGlzIHNlZW1zIHRvIGJlIG5lZWRlZCB0byBwbGFjYXRlIFRTIHYzLjAgb25seVxudHlwZSBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSA9IFBpY2s8XG4gICAgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSxcbiAgICBFeGNsdWRlPEV4Y2x1ZGU8a2V5b2YgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnPiwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuY29uc3QgVVNFX0NMQVNTID0gT2JqZWN0LmtleXMoe3VzZUNsYXNzOiBudWxsfSlbMF07XG5jb25zdCBVU0VfRkFDVE9SWSA9IE9iamVjdC5rZXlzKHt1c2VGYWN0b3J5OiBudWxsfSlbMF07XG5jb25zdCBVU0VfVkFMVUUgPSBPYmplY3Qua2V5cyh7dXNlVmFsdWU6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9FWElTVElORyA9IE9iamVjdC5rZXlzKHt1c2VFeGlzdGluZzogbnVsbH0pWzBdO1xuXG5mdW5jdGlvbiBjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEoZmFjYWRlOiBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUpOiBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICBwcmVkaWNhdGU6IGNvbnZlcnRRdWVyeVByZWRpY2F0ZShmYWNhZGUucHJlZGljYXRlKSxcbiAgICByZWFkOiBmYWNhZGUucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGZhY2FkZS5zdGF0aWMsXG4gICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6IGZhY2FkZS5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFF1ZXJ5RGVjbGFyYXRpb25Ub01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlKTpcbiAgICBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIHByb3BlcnR5TmFtZTogZGVjbGFyYXRpb24ucHJvcGVydHlOYW1lLFxuICAgIGZpcnN0OiBkZWNsYXJhdGlvbi5maXJzdCA/PyBmYWxzZSxcbiAgICBwcmVkaWNhdGU6IGNvbnZlcnRRdWVyeVByZWRpY2F0ZShkZWNsYXJhdGlvbi5wcmVkaWNhdGUpLFxuICAgIGRlc2NlbmRhbnRzOiBkZWNsYXJhdGlvbi5kZXNjZW5kYW50cyA/PyBmYWxzZSxcbiAgICByZWFkOiBkZWNsYXJhdGlvbi5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5yZWFkKSA6IG51bGwsXG4gICAgc3RhdGljOiBkZWNsYXJhdGlvbi5zdGF0aWMgPz8gZmFsc2UsXG4gICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6IGRlY2xhcmF0aW9uLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID8/IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRRdWVyeVByZWRpY2F0ZShwcmVkaWNhdGU6IE9wYXF1ZVZhbHVlfHN0cmluZ1tdKTogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbnxcbiAgICBzdHJpbmdbXSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHByZWRpY2F0ZSkgP1xuICAgICAgLy8gVGhlIHByZWRpY2F0ZSBpcyBhbiBhcnJheSBvZiBzdHJpbmdzIHNvIHBhc3MgaXQgdGhyb3VnaC5cbiAgICAgIHByZWRpY2F0ZSA6XG4gICAgICAvLyBUaGUgcHJlZGljYXRlIGlzIGEgdHlwZSAtIGFzc3VtZSB0aGF0IHdlIHdpbGwgbmVlZCB0byB1bndyYXAgYW55IGBmb3J3YXJkUmVmKClgIGNhbGxzLlxuICAgICAgY3JlYXRlTWF5QmVGb3J3YXJkUmVmRXhwcmVzc2lvbihuZXcgV3JhcHBlZE5vZGVFeHByKHByZWRpY2F0ZSksIEZvcndhcmRSZWZIYW5kbGluZy5XcmFwcGVkKTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRPdXRwdXRzKGZhY2FkZS5pbnB1dHMgfHwgW10pO1xuICBjb25zdCBvdXRwdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLm91dHB1dHMgfHwgW10pO1xuICBjb25zdCBwcm9wTWV0YWRhdGEgPSBmYWNhZGUucHJvcE1ldGFkYXRhO1xuICBjb25zdCBpbnB1dHNGcm9tVHlwZTogU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHt9O1xuICBjb25zdCBvdXRwdXRzRnJvbVR5cGU6IFN0cmluZ01hcCA9IHt9O1xuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSW5wdXQoYW5uKSkge1xuICAgICAgICAgIGlucHV0c0Zyb21UeXBlW2ZpZWxkXSA9XG4gICAgICAgICAgICAgIGFubi5iaW5kaW5nUHJvcGVydHlOYW1lID8gW2Fubi5iaW5kaW5nUHJvcGVydHlOYW1lLCBmaWVsZF0gOiBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc091dHB1dChhbm4pKSB7XG4gICAgICAgICAgb3V0cHV0c0Zyb21UeXBlW2ZpZWxkXSA9IGFubi5iaW5kaW5nUHJvcGVydHlOYW1lIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSBhcyBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgZGVwczogbnVsbCxcbiAgICBob3N0OiBleHRyYWN0SG9zdEJpbmRpbmdzKGZhY2FkZS5wcm9wTWV0YWRhdGEsIGZhY2FkZS50eXBlU291cmNlU3BhbiwgZmFjYWRlLmhvc3QpLFxuICAgIGlucHV0czogey4uLmlucHV0c0Zyb21NZXRhZGF0YSwgLi4uaW5wdXRzRnJvbVR5cGV9LFxuICAgIG91dHB1dHM6IHsuLi5vdXRwdXRzRnJvbU1ldGFkYXRhLCAuLi5vdXRwdXRzRnJvbVR5cGV9LFxuICAgIHF1ZXJpZXM6IGZhY2FkZS5xdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZmFjYWRlLnByb3ZpZGVycyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSA6IG51bGwsXG4gICAgdmlld1F1ZXJpZXM6IGZhY2FkZS52aWV3UXVlcmllcy5tYXAoY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKSxcbiAgICBmdWxsSW5oZXJpdGFuY2U6IGZhbHNlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZURpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoXG4gICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHR5cGVTb3VyY2VTcGFuLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBzZWxlY3RvcjogZGVjbGFyYXRpb24uc2VsZWN0b3IgPz8gbnVsbCxcbiAgICBpbnB1dHM6IGRlY2xhcmF0aW9uLmlucHV0cyA/PyB7fSxcbiAgICBvdXRwdXRzOiBkZWNsYXJhdGlvbi5vdXRwdXRzID8/IHt9LFxuICAgIGhvc3Q6IGNvbnZlcnRIb3N0RGVjbGFyYXRpb25Ub01ldGFkYXRhKGRlY2xhcmF0aW9uLmhvc3QpLFxuICAgIHF1ZXJpZXM6IChkZWNsYXJhdGlvbi5xdWVyaWVzID8/IFtdKS5tYXAoY29udmVydFF1ZXJ5RGVjbGFyYXRpb25Ub01ldGFkYXRhKSxcbiAgICB2aWV3UXVlcmllczogKGRlY2xhcmF0aW9uLnZpZXdRdWVyaWVzID8/IFtdKS5tYXAoY29udmVydFF1ZXJ5RGVjbGFyYXRpb25Ub01ldGFkYXRhKSxcbiAgICBwcm92aWRlcnM6IGRlY2xhcmF0aW9uLnByb3ZpZGVycyAhPT0gdW5kZWZpbmVkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5wcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICBleHBvcnRBczogZGVjbGFyYXRpb24uZXhwb3J0QXMgPz8gbnVsbCxcbiAgICB1c2VzSW5oZXJpdGFuY2U6IGRlY2xhcmF0aW9uLnVzZXNJbmhlcml0YW5jZSA/PyBmYWxzZSxcbiAgICBsaWZlY3ljbGU6IHt1c2VzT25DaGFuZ2VzOiBkZWNsYXJhdGlvbi51c2VzT25DaGFuZ2VzID8/IGZhbHNlfSxcbiAgICBkZXBzOiBudWxsLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gICAgaXNTdGFuZGFsb25lOiBkZWNsYXJhdGlvbi5pc1N0YW5kYWxvbmUgPz8gZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRIb3N0RGVjbGFyYXRpb25Ub01ldGFkYXRhKGhvc3Q6IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZVsnaG9zdCddID0ge30pOlxuICAgIFIzSG9zdE1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBhdHRyaWJ1dGVzOiBjb252ZXJ0T3BhcXVlVmFsdWVzVG9FeHByZXNzaW9ucyhob3N0LmF0dHJpYnV0ZXMgPz8ge30pLFxuICAgIGxpc3RlbmVyczogaG9zdC5saXN0ZW5lcnMgPz8ge30sXG4gICAgcHJvcGVydGllczogaG9zdC5wcm9wZXJ0aWVzID8/IHt9LFxuICAgIHNwZWNpYWxBdHRyaWJ1dGVzOiB7XG4gICAgICBjbGFzc0F0dHI6IGhvc3QuY2xhc3NBdHRyaWJ1dGUsXG4gICAgICBzdHlsZUF0dHI6IGhvc3Quc3R5bGVBdHRyaWJ1dGUsXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydE9wYXF1ZVZhbHVlc1RvRXhwcmVzc2lvbnMob2JqOiB7W2tleTogc3RyaW5nXTogT3BhcXVlVmFsdWV9KTpcbiAgICB7W2tleTogc3RyaW5nXTogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fSB7XG4gIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IFdyYXBwZWROb2RlRXhwcjx1bmtub3duPn0gPSB7fTtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xuICAgIHJlc3VsdFtrZXldID0gbmV3IFdyYXBwZWROb2RlRXhwcihvYmpba2V5XSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVDb21wb25lbnRGYWNhZGVUb01ldGFkYXRhKFxuICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgc291cmNlTWFwVXJsOiBzdHJpbmcpOiBSM0NvbXBvbmVudE1ldGFkYXRhIHtcbiAgY29uc3Qge3RlbXBsYXRlLCBpbnRlcnBvbGF0aW9ufSA9IHBhcnNlSml0VGVtcGxhdGUoXG4gICAgICBkZWNsYXJhdGlvbi50ZW1wbGF0ZSwgZGVjbGFyYXRpb24udHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwsXG4gICAgICBkZWNsYXJhdGlvbi5wcmVzZXJ2ZVdoaXRlc3BhY2VzID8/IGZhbHNlLCBkZWNsYXJhdGlvbi5pbnRlcnBvbGF0aW9uKTtcblxuICByZXR1cm4ge1xuICAgIC4uLmNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbiwgdHlwZVNvdXJjZVNwYW4pLFxuICAgIHRlbXBsYXRlLFxuICAgIHN0eWxlczogZGVjbGFyYXRpb24uc3R5bGVzID8/IFtdLFxuICAgIGRpcmVjdGl2ZXM6IChkZWNsYXJhdGlvbi5jb21wb25lbnRzID8/IFtdKVxuICAgICAgICAgICAgICAgICAgICAuY29uY2F0KGRlY2xhcmF0aW9uLmRpcmVjdGl2ZXMgPz8gW10pXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoY29udmVydFVzZWREaXJlY3RpdmVEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHBpcGVzOiBjb252ZXJ0VXNlZFBpcGVzVG9NZXRhZGF0YShkZWNsYXJhdGlvbi5waXBlcyksXG4gICAgdmlld1Byb3ZpZGVyczogZGVjbGFyYXRpb24udmlld1Byb3ZpZGVycyAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgIG51bGwsXG4gICAgYW5pbWF0aW9uczogZGVjbGFyYXRpb24uYW5pbWF0aW9ucyAhPT0gdW5kZWZpbmVkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5hbmltYXRpb25zKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICBjaGFuZ2VEZXRlY3Rpb246IGRlY2xhcmF0aW9uLmNoYW5nZURldGVjdGlvbiA/PyBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0LFxuICAgIGVuY2Fwc3VsYXRpb246IGRlY2xhcmF0aW9uLmVuY2Fwc3VsYXRpb24gPz8gVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgaW50ZXJwb2xhdGlvbixcbiAgICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZVJlc29sdmVkLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRVc2VkRGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlRmFjYWRlKTpcbiAgICBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0b3I6IGRlY2xhcmF0aW9uLnNlbGVjdG9yLFxuICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udHlwZSksXG4gICAgaW5wdXRzOiBkZWNsYXJhdGlvbi5pbnB1dHMgPz8gW10sXG4gICAgb3V0cHV0czogZGVjbGFyYXRpb24ub3V0cHV0cyA/PyBbXSxcbiAgICBleHBvcnRBczogZGVjbGFyYXRpb24uZXhwb3J0QXMgPz8gbnVsbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFVzZWRQaXBlc1RvTWV0YWRhdGEoZGVjbGFyZWRQaXBlczogUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlWydwaXBlcyddKTpcbiAgICBNYXA8c3RyaW5nLCBFeHByZXNzaW9uPiB7XG4gIGNvbnN0IHBpcGVzID0gbmV3IE1hcDxzdHJpbmcsIEV4cHJlc3Npb24+KCk7XG4gIGlmIChkZWNsYXJlZFBpcGVzID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gcGlwZXM7XG4gIH1cblxuICBmb3IgKGNvbnN0IHBpcGVOYW1lIG9mIE9iamVjdC5rZXlzKGRlY2xhcmVkUGlwZXMpKSB7XG4gICAgY29uc3QgcGlwZVR5cGUgPSBkZWNsYXJlZFBpcGVzW3BpcGVOYW1lXTtcbiAgICBwaXBlcy5zZXQocGlwZU5hbWUsIG5ldyBXcmFwcGVkTm9kZUV4cHIocGlwZVR5cGUpKTtcbiAgfVxuICByZXR1cm4gcGlwZXM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSml0VGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlTWFwVXJsOiBzdHJpbmcsIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4sXG4gICAgaW50ZXJwb2xhdGlvbjogW3N0cmluZywgc3RyaW5nXXx1bmRlZmluZWQpIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkNvbmZpZyA9XG4gICAgICBpbnRlcnBvbGF0aW9uID8gSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoaW50ZXJwb2xhdGlvbikgOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlVGVtcGxhdGUodGVtcGxhdGUsIHNvdXJjZU1hcFVybCwge3ByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgaWYgKHBhcnNlZC5lcnJvcnMgIT09IG51bGwpIHtcbiAgICBjb25zdCBlcnJvcnMgPSBwYXJzZWQuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcnMgZHVyaW5nIEpJVCBjb21waWxhdGlvbiBvZiB0ZW1wbGF0ZSBmb3IgJHt0eXBlTmFtZX06ICR7ZXJyb3JzfWApO1xuICB9XG4gIHJldHVybiB7dGVtcGxhdGU6IHBhcnNlZCwgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvbkNvbmZpZ307XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuLyoqXG4gKiBDb252ZXJ0IHRoZSBleHByZXNzaW9uLCBpZiBwcmVzZW50IHRvIGFuIGBSM1Byb3ZpZGVyRXhwcmVzc2lvbmAuXG4gKlxuICogSW4gSklUIG1vZGUgd2UgZG8gbm90IHdhbnQgdGhlIGNvbXBpbGVyIHRvIHdyYXAgdGhlIGV4cHJlc3Npb24gaW4gYSBgZm9yd2FyZFJlZigpYCBjYWxsIGJlY2F1c2UsXG4gKiBpZiBpdCBpcyByZWZlcmVuY2luZyBhIHR5cGUgdGhhdCBoYXMgbm90IHlldCBiZWVuIGRlZmluZWQsIGl0IHdpbGwgaGF2ZSBhbHJlYWR5IGJlZW4gd3JhcHBlZCBpblxuICogYSBgZm9yd2FyZFJlZigpYCAtIGVpdGhlciBieSB0aGUgYXBwbGljYXRpb24gZGV2ZWxvcGVyIG9yIGR1cmluZyBwYXJ0aWFsLWNvbXBpbGF0aW9uLiBUaHVzIHdlIGNhblxuICogdXNlIGBGb3J3YXJkUmVmSGFuZGxpbmcuTm9uZWAuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUb1Byb3ZpZGVyRXhwcmVzc2lvbihvYmo6IGFueSwgcHJvcGVydHk6IHN0cmluZyk6IE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb258XG4gICAgdW5kZWZpbmVkIHtcbiAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICByZXR1cm4gY3JlYXRlTWF5QmVGb3J3YXJkUmVmRXhwcmVzc2lvbihcbiAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihvYmpbcHJvcGVydHldKSwgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogRnVuY3Rpb258c3RyaW5nfG51bGx8dW5kZWZpbmVkKTogTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ2Z1bmN0aW9uJyA/IG5ldyBXcmFwcGVkTm9kZUV4cHIocHJvdmlkZWRJbikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTGl0ZXJhbEV4cHIocHJvdmlkZWRJbiA/PyBudWxsKTtcbiAgLy8gU2VlIGBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oKWAgZm9yIHdoeSB0aGlzIHVzZXMgYEZvcndhcmRSZWZIYW5kbGluZy5Ob25lYC5cbiAgcmV0dXJuIGNyZWF0ZU1heUJlRm9yd2FyZFJlZkV4cHJlc3Npb24oZXhwcmVzc2lvbiwgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmUpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGVzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGwge1xuICByZXR1cm4gZmFjYWRlcyA9PSBudWxsID8gbnVsbCA6IGZhY2FkZXMubWFwKGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBjb25zdCBpc0F0dHJpYnV0ZURlcCA9IGZhY2FkZS5hdHRyaWJ1dGUgIT0gbnVsbDsgIC8vIGJvdGggYG51bGxgIGFuZCBgdW5kZWZpbmVkYFxuICBjb25zdCByYXdUb2tlbiA9IGZhY2FkZS50b2tlbiA9PT0gbnVsbCA/IG51bGwgOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50b2tlbik7XG4gIC8vIEluIEpJVCBtb2RlLCBpZiB0aGUgZGVwIGlzIGFuIGBAQXR0cmlidXRlKClgIHRoZW4gd2UgdXNlIHRoZSBhdHRyaWJ1dGUgbmFtZSBnaXZlbiBpblxuICAvLyBgYXR0cmlidXRlYCByYXRoZXIgdGhhbiB0aGUgYHRva2VuYC5cbiAgY29uc3QgdG9rZW4gPSBpc0F0dHJpYnV0ZURlcCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmF0dHJpYnV0ZSkgOiByYXdUb2tlbjtcbiAgcmV0dXJuIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgICAgdG9rZW4sIGlzQXR0cmlidXRlRGVwLCBmYWNhZGUuaG9zdCwgZmFjYWRlLm9wdGlvbmFsLCBmYWNhZGUuc2VsZiwgZmFjYWRlLnNraXBTZWxmKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSk6XG4gICAgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBjb25zdCBpc0F0dHJpYnV0ZURlcCA9IGZhY2FkZS5hdHRyaWJ1dGUgPz8gZmFsc2U7XG4gIGNvbnN0IHRva2VuID0gZmFjYWRlLnRva2VuID09PSBudWxsID8gbnVsbCA6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgcmV0dXJuIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgICAgdG9rZW4sIGlzQXR0cmlidXRlRGVwLCBmYWNhZGUuaG9zdCA/PyBmYWxzZSwgZmFjYWRlLm9wdGlvbmFsID8/IGZhbHNlLCBmYWNhZGUuc2VsZiA/PyBmYWxzZSxcbiAgICAgIGZhY2FkZS5za2lwU2VsZiA/PyBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgIHRva2VuOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj58bnVsbCwgaXNBdHRyaWJ1dGVEZXA6IGJvb2xlYW4sIGhvc3Q6IGJvb2xlYW4sIG9wdGlvbmFsOiBib29sZWFuLFxuICAgIHNlbGY6IGJvb2xlYW4sIHNraXBTZWxmOiBib29sZWFuKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvLyBJZiB0aGUgZGVwIGlzIGFuIGBAQXR0cmlidXRlKClgIHRoZSBgYXR0cmlidXRlTmFtZVR5cGVgIG91Z2h0IHRvIGJlIHRoZSBgdW5rbm93bmAgdHlwZS5cbiAgLy8gQnV0IHR5cGVzIGFyZSBub3QgYXZhaWxhYmxlIGF0IHJ1bnRpbWUgc28gd2UganVzdCB1c2UgYSBsaXRlcmFsIGBcIjx1bmtub3duPlwiYCBzdHJpbmcgYXMgYSBkdW1teVxuICAvLyBtYXJrZXIuXG4gIGNvbnN0IGF0dHJpYnV0ZU5hbWVUeXBlID0gaXNBdHRyaWJ1dGVEZXAgPyBsaXRlcmFsKCd1bmtub3duJykgOiBudWxsO1xuICByZXR1cm4ge3Rva2VuLCBhdHRyaWJ1dGVOYW1lVHlwZSwgaG9zdCwgb3B0aW9uYWwsIHNlbGYsIHNraXBTZWxmfTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEhvc3RCaW5kaW5ncyhcbiAgICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBob3N0Pzoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICAvLyBGaXJzdCBwYXJzZSB0aGUgZGVjbGFyYXRpb25zIGZyb20gdGhlIG1ldGFkYXRhLlxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3QgfHwge30pO1xuXG4gIC8vIEFmdGVyIHRoYXQgY2hlY2sgaG9zdCBiaW5kaW5ncyBmb3IgZXJyb3JzXG4gIGNvbnN0IGVycm9ycyA9IHZlcmlmeUhvc3RCaW5kaW5ncyhiaW5kaW5ncywgc291cmNlU3Bhbik7XG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoKGVycm9yOiBQYXJzZUVycm9yKSA9PiBlcnJvci5tc2cpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIC8vIE5leHQsIGxvb3Agb3ZlciB0aGUgcHJvcGVydGllcyBvZiB0aGUgb2JqZWN0LCBsb29raW5nIGZvciBASG9zdEJpbmRpbmcgYW5kIEBIb3N0TGlzdGVuZXIuXG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNIb3N0QmluZGluZyhhbm4pKSB7XG4gICAgICAgICAgLy8gU2luY2UgdGhpcyBpcyBhIGRlY29yYXRvciwgd2Uga25vdyB0aGF0IHRoZSB2YWx1ZSBpcyBhIGNsYXNzIG1lbWJlci4gQWx3YXlzIGFjY2VzcyBpdFxuICAgICAgICAgIC8vIHRocm91Z2ggYHRoaXNgIHNvIHRoYXQgZnVydGhlciBkb3duIHRoZSBsaW5lIGl0IGNhbid0IGJlIGNvbmZ1c2VkIGZvciBhIGxpdGVyYWwgdmFsdWVcbiAgICAgICAgICAvLyAoZS5nLiBpZiB0aGVyZSdzIGEgcHJvcGVydHkgY2FsbGVkIGB0cnVlYCkuXG4gICAgICAgICAgYmluZGluZ3MucHJvcGVydGllc1thbm4uaG9zdFByb3BlcnR5TmFtZSB8fCBmaWVsZF0gPVxuICAgICAgICAgICAgICBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmcoJ3RoaXMnLCBmaWVsZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb3N0TGlzdGVuZXIoYW5uKSkge1xuICAgICAgICAgIGJpbmRpbmdzLmxpc3RlbmVyc1thbm4uZXZlbnROYW1lIHx8IGZpZWxkXSA9IGAke2ZpZWxkfSgkeyhhbm4uYXJncyB8fCBbXSkuam9pbignLCcpfSlgO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdEJpbmRpbmcodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RCaW5kaW5nIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdEJpbmRpbmcnO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RMaXN0ZW5lcih2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdExpc3RlbmVyIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdExpc3RlbmVyJztcbn1cblxuXG5mdW5jdGlvbiBpc0lucHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJbnB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0lucHV0Jztcbn1cblxuZnVuY3Rpb24gaXNPdXRwdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIE91dHB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ091dHB1dCc7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW5wdXRPdXRwdXRzKHZhbHVlczogc3RyaW5nW10pOiBTdHJpbmdNYXAge1xuICByZXR1cm4gdmFsdWVzLnJlZHVjZSgobWFwLCB2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IFtmaWVsZCwgcHJvcGVydHldID0gdmFsdWUuc3BsaXQoJywnKS5tYXAocGllY2UgPT4gcGllY2UudHJpbSgpKTtcbiAgICBtYXBbZmllbGRdID0gcHJvcGVydHkgfHwgZmllbGQ7XG4gICAgcmV0dXJuIG1hcDtcbiAgfSwge30gYXMgU3RyaW5nTWFwKTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVQaXBlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlUGlwZUZhY2FkZSk6IFIzUGlwZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udHlwZSksXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgcGlwZU5hbWU6IGRlY2xhcmF0aW9uLm5hbWUsXG4gICAgZGVwczogbnVsbCxcbiAgICBwdXJlOiBkZWNsYXJhdGlvbi5wdXJlID8/IHRydWUsXG4gICAgaXNTdGFuZGFsb25lOiBkZWNsYXJhdGlvbi5pc1N0YW5kYWxvbmUgPz8gZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlSW5qZWN0b3JGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSk6XG4gICAgUjNJbmplY3Rvck1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udHlwZSksXG4gICAgcHJvdmlkZXJzOiBkZWNsYXJhdGlvbi5wcm92aWRlcnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgaW1wb3J0czogZGVjbGFyYXRpb24uaW1wb3J0cyAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgZGVjbGFyYXRpb24uaW1wb3J0cy5tYXAoaSA9PiBuZXcgV3JhcHBlZE5vZGVFeHByKGkpKSA6XG4gICAgICAgIFtdLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHVibGlzaEZhY2FkZShnbG9iYWw6IGFueSkge1xuICBjb25zdCBuZzogRXhwb3J0ZWRDb21waWxlckZhY2FkZSA9IGdsb2JhbC5uZyB8fCAoZ2xvYmFsLm5nID0ge30pO1xuICBuZy7JtWNvbXBpbGVyRmFjYWRlID0gbmV3IENvbXBpbGVyRmFjYWRlSW1wbCgpO1xufVxuIl19