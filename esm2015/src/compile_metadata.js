/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { StaticSymbol } from './aot/static_symbol';
import { splitAtColon, stringify } from './util';
// group 0: "[prop] or (event) or @trigger"
// group 1: "prop" from "[prop]"
// group 2: "event" from "(event)"
// group 3: "@trigger" from "@trigger"
const /** @type {?} */ HOST_REG_EXP = /^(?:(?:\[([^\]]+)\])|(?:\(([^\)]+)\)))|(\@[-\w]+)$/;
/**
 * @param {?} name
 * @return {?}
 */
export function sanitizeIdentifier(name) {
    return name.replace(/\W/g, '_');
}
let /** @type {?} */ _anonymousTypeIndex = 0;
/**
 * @param {?} compileIdentifier
 * @return {?}
 */
export function identifierName(compileIdentifier) {
    if (!compileIdentifier || !compileIdentifier.reference) {
        return null;
    }
    const /** @type {?} */ ref = compileIdentifier.reference;
    if (ref instanceof StaticSymbol) {
        return ref.name;
    }
    if (ref['__anonymousType']) {
        return ref['__anonymousType'];
    }
    let /** @type {?} */ identifier = stringify(ref);
    if (identifier.indexOf('(') >= 0) {
        // case: anonymous functions!
        identifier = `anonymous_${_anonymousTypeIndex++}`;
        ref['__anonymousType'] = identifier;
    }
    else {
        identifier = sanitizeIdentifier(identifier);
    }
    return identifier;
}
/**
 * @param {?} compileIdentifier
 * @return {?}
 */
export function identifierModuleUrl(compileIdentifier) {
    const /** @type {?} */ ref = compileIdentifier.reference;
    if (ref instanceof StaticSymbol) {
        return ref.filePath;
    }
    // Runtime type
    return `./${stringify(ref)}`;
}
/**
 * @param {?} compType
 * @param {?} embeddedTemplateIndex
 * @return {?}
 */
export function viewClassName(compType, embeddedTemplateIndex) {
    return `View_${identifierName({ reference: compType })}_${embeddedTemplateIndex}`;
}
/**
 * @param {?} compType
 * @return {?}
 */
export function rendererTypeName(compType) {
    return `RenderType_${identifierName({ reference: compType })}`;
}
/**
 * @param {?} compType
 * @return {?}
 */
export function hostViewClassName(compType) {
    return `HostView_${identifierName({ reference: compType })}`;
}
/**
 * @param {?} compType
 * @return {?}
 */
export function componentFactoryName(compType) {
    return `${identifierName({ reference: compType })}NgFactory`;
}
/**
 * @record
 */
export function ProxyClass() { }
function ProxyClass_tsickle_Closure_declarations() {
    /** @type {?} */
    ProxyClass.prototype.setDelegate;
}
/**
 * @record
 */
export function CompileIdentifierMetadata() { }
function CompileIdentifierMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileIdentifierMetadata.prototype.reference;
}
/** @enum {number} */
const CompileSummaryKind = {
    Pipe: 0,
    Directive: 1,
    NgModule: 2,
    Injectable: 3,
};
export { CompileSummaryKind };
CompileSummaryKind[CompileSummaryKind.Pipe] = "Pipe";
CompileSummaryKind[CompileSummaryKind.Directive] = "Directive";
CompileSummaryKind[CompileSummaryKind.NgModule] = "NgModule";
CompileSummaryKind[CompileSummaryKind.Injectable] = "Injectable";
/**
 * A CompileSummary is the data needed to use a directive / pipe / module
 * in other modules / components. However, this data is not enough to compile
 * the directive / module itself.
 * @record
 */
export function CompileTypeSummary() { }
function CompileTypeSummary_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileTypeSummary.prototype.summaryKind;
    /** @type {?} */
    CompileTypeSummary.prototype.type;
}
/**
 * @record
 */
export function CompileDiDependencyMetadata() { }
function CompileDiDependencyMetadata_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.isAttribute;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.isSelf;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.isHost;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.isSkipSelf;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.isOptional;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.isValue;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.token;
    /** @type {?|undefined} */
    CompileDiDependencyMetadata.prototype.value;
}
/**
 * @record
 */
export function CompileProviderMetadata() { }
function CompileProviderMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileProviderMetadata.prototype.token;
    /** @type {?|undefined} */
    CompileProviderMetadata.prototype.useClass;
    /** @type {?|undefined} */
    CompileProviderMetadata.prototype.useValue;
    /** @type {?|undefined} */
    CompileProviderMetadata.prototype.useExisting;
    /** @type {?|undefined} */
    CompileProviderMetadata.prototype.useFactory;
    /** @type {?|undefined} */
    CompileProviderMetadata.prototype.deps;
    /** @type {?|undefined} */
    CompileProviderMetadata.prototype.multi;
}
/**
 * @record
 */
export function CompileFactoryMetadata() { }
function CompileFactoryMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileFactoryMetadata.prototype.diDeps;
    /** @type {?} */
    CompileFactoryMetadata.prototype.reference;
}
/**
 * @param {?} token
 * @return {?}
 */
export function tokenName(token) {
    return token.value != null ? sanitizeIdentifier(token.value) : identifierName(token.identifier);
}
/**
 * @param {?} token
 * @return {?}
 */
export function tokenReference(token) {
    if (token.identifier != null) {
        return token.identifier.reference;
    }
    else {
        return token.value;
    }
}
/**
 * @record
 */
export function CompileTokenMetadata() { }
function CompileTokenMetadata_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    CompileTokenMetadata.prototype.value;
    /** @type {?|undefined} */
    CompileTokenMetadata.prototype.identifier;
}
/**
 * @record
 */
export function CompileInjectableMetadata() { }
function CompileInjectableMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileInjectableMetadata.prototype.symbol;
    /** @type {?} */
    CompileInjectableMetadata.prototype.type;
    /** @type {?|undefined} */
    CompileInjectableMetadata.prototype.providedIn;
    /** @type {?|undefined} */
    CompileInjectableMetadata.prototype.useValue;
    /** @type {?|undefined} */
    CompileInjectableMetadata.prototype.useClass;
    /** @type {?|undefined} */
    CompileInjectableMetadata.prototype.useExisting;
    /** @type {?|undefined} */
    CompileInjectableMetadata.prototype.useFactory;
    /** @type {?|undefined} */
    CompileInjectableMetadata.prototype.deps;
}
/**
 * Metadata regarding compilation of a type.
 * @record
 */
export function CompileTypeMetadata() { }
function CompileTypeMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileTypeMetadata.prototype.diDeps;
    /** @type {?} */
    CompileTypeMetadata.prototype.lifecycleHooks;
    /** @type {?} */
    CompileTypeMetadata.prototype.reference;
}
/**
 * @record
 */
export function CompileQueryMetadata() { }
function CompileQueryMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileQueryMetadata.prototype.selectors;
    /** @type {?} */
    CompileQueryMetadata.prototype.descendants;
    /** @type {?} */
    CompileQueryMetadata.prototype.first;
    /** @type {?} */
    CompileQueryMetadata.prototype.propertyName;
    /** @type {?} */
    CompileQueryMetadata.prototype.read;
}
/**
 * Metadata about a stylesheet
 */
export class CompileStylesheetMetadata {
    /**
     * @param {?=} __0
     */
    constructor({ moduleUrl, styles, styleUrls } = {}) {
        this.moduleUrl = moduleUrl || null;
        this.styles = _normalizeArray(styles);
        this.styleUrls = _normalizeArray(styleUrls);
    }
}
function CompileStylesheetMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileStylesheetMetadata.prototype.moduleUrl;
    /** @type {?} */
    CompileStylesheetMetadata.prototype.styles;
    /** @type {?} */
    CompileStylesheetMetadata.prototype.styleUrls;
}
/**
 * Summary Metadata regarding compilation of a template.
 * @record
 */
export function CompileTemplateSummary() { }
function CompileTemplateSummary_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileTemplateSummary.prototype.ngContentSelectors;
    /** @type {?} */
    CompileTemplateSummary.prototype.encapsulation;
}
/**
 * Metadata regarding compilation of a template.
 */
export class CompileTemplateMetadata {
    /**
     * @param {?} __0
     */
    constructor({ encapsulation, template, templateUrl, htmlAst, styles, styleUrls, externalStylesheets, animations, ngContentSelectors, interpolation, isInline, preserveWhitespaces }) {
        this.encapsulation = encapsulation;
        this.template = template;
        this.templateUrl = templateUrl;
        this.htmlAst = htmlAst;
        this.styles = _normalizeArray(styles);
        this.styleUrls = _normalizeArray(styleUrls);
        this.externalStylesheets = _normalizeArray(externalStylesheets);
        this.animations = animations ? flatten(animations) : [];
        this.ngContentSelectors = ngContentSelectors || [];
        if (interpolation && interpolation.length != 2) {
            throw new Error(`'interpolation' should have a start and an end symbol.`);
        }
        this.interpolation = interpolation;
        this.isInline = isInline;
        this.preserveWhitespaces = preserveWhitespaces;
    }
    /**
     * @return {?}
     */
    toSummary() {
        return {
            ngContentSelectors: this.ngContentSelectors,
            encapsulation: this.encapsulation,
        };
    }
}
function CompileTemplateMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileTemplateMetadata.prototype.encapsulation;
    /** @type {?} */
    CompileTemplateMetadata.prototype.template;
    /** @type {?} */
    CompileTemplateMetadata.prototype.templateUrl;
    /** @type {?} */
    CompileTemplateMetadata.prototype.htmlAst;
    /** @type {?} */
    CompileTemplateMetadata.prototype.isInline;
    /** @type {?} */
    CompileTemplateMetadata.prototype.styles;
    /** @type {?} */
    CompileTemplateMetadata.prototype.styleUrls;
    /** @type {?} */
    CompileTemplateMetadata.prototype.externalStylesheets;
    /** @type {?} */
    CompileTemplateMetadata.prototype.animations;
    /** @type {?} */
    CompileTemplateMetadata.prototype.ngContentSelectors;
    /** @type {?} */
    CompileTemplateMetadata.prototype.interpolation;
    /** @type {?} */
    CompileTemplateMetadata.prototype.preserveWhitespaces;
}
/**
 * @record
 */
export function CompileEntryComponentMetadata() { }
function CompileEntryComponentMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileEntryComponentMetadata.prototype.componentType;
    /** @type {?} */
    CompileEntryComponentMetadata.prototype.componentFactory;
}
/**
 * @record
 */
export function CompileDirectiveSummary() { }
function CompileDirectiveSummary_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileDirectiveSummary.prototype.type;
    /** @type {?} */
    CompileDirectiveSummary.prototype.isComponent;
    /** @type {?} */
    CompileDirectiveSummary.prototype.selector;
    /** @type {?} */
    CompileDirectiveSummary.prototype.exportAs;
    /** @type {?} */
    CompileDirectiveSummary.prototype.inputs;
    /** @type {?} */
    CompileDirectiveSummary.prototype.outputs;
    /** @type {?} */
    CompileDirectiveSummary.prototype.hostListeners;
    /** @type {?} */
    CompileDirectiveSummary.prototype.hostProperties;
    /** @type {?} */
    CompileDirectiveSummary.prototype.hostAttributes;
    /** @type {?} */
    CompileDirectiveSummary.prototype.providers;
    /** @type {?} */
    CompileDirectiveSummary.prototype.viewProviders;
    /** @type {?} */
    CompileDirectiveSummary.prototype.queries;
    /** @type {?} */
    CompileDirectiveSummary.prototype.guards;
    /** @type {?} */
    CompileDirectiveSummary.prototype.viewQueries;
    /** @type {?} */
    CompileDirectiveSummary.prototype.entryComponents;
    /** @type {?} */
    CompileDirectiveSummary.prototype.changeDetection;
    /** @type {?} */
    CompileDirectiveSummary.prototype.template;
    /** @type {?} */
    CompileDirectiveSummary.prototype.componentViewType;
    /** @type {?} */
    CompileDirectiveSummary.prototype.rendererType;
    /** @type {?} */
    CompileDirectiveSummary.prototype.componentFactory;
}
/**
 * Metadata regarding compilation of a directive.
 */
export class CompileDirectiveMetadata {
    /**
     * @param {?} __0
     * @return {?}
     */
    static create({ isHost, type, isComponent, selector, exportAs, changeDetection, inputs, outputs, host, providers, viewProviders, queries, guards, viewQueries, entryComponents, template, componentViewType, rendererType, componentFactory }) {
        const /** @type {?} */ hostListeners = {};
        const /** @type {?} */ hostProperties = {};
        const /** @type {?} */ hostAttributes = {};
        if (host != null) {
            Object.keys(host).forEach(key => {
                const /** @type {?} */ value = host[key];
                const /** @type {?} */ matches = key.match(HOST_REG_EXP);
                if (matches === null) {
                    hostAttributes[key] = value;
                }
                else if (matches[1] != null) {
                    hostProperties[matches[1]] = value;
                }
                else if (matches[2] != null) {
                    hostListeners[matches[2]] = value;
                }
            });
        }
        const /** @type {?} */ inputsMap = {};
        if (inputs != null) {
            inputs.forEach((bindConfig) => {
                // canonical syntax: `dirProp: elProp`
                // if there is no `:`, use dirProp = elProp
                const /** @type {?} */ parts = splitAtColon(bindConfig, [bindConfig, bindConfig]);
                inputsMap[parts[0]] = parts[1];
            });
        }
        const /** @type {?} */ outputsMap = {};
        if (outputs != null) {
            outputs.forEach((bindConfig) => {
                // canonical syntax: `dirProp: elProp`
                // if there is no `:`, use dirProp = elProp
                const /** @type {?} */ parts = splitAtColon(bindConfig, [bindConfig, bindConfig]);
                outputsMap[parts[0]] = parts[1];
            });
        }
        return new CompileDirectiveMetadata({
            isHost,
            type,
            isComponent: !!isComponent, selector, exportAs, changeDetection,
            inputs: inputsMap,
            outputs: outputsMap,
            hostListeners,
            hostProperties,
            hostAttributes,
            providers,
            viewProviders,
            queries,
            guards,
            viewQueries,
            entryComponents,
            template,
            componentViewType,
            rendererType,
            componentFactory,
        });
    }
    /**
     * @param {?} __0
     */
    constructor({ isHost, type, isComponent, selector, exportAs, changeDetection, inputs, outputs, hostListeners, hostProperties, hostAttributes, providers, viewProviders, queries, guards, viewQueries, entryComponents, template, componentViewType, rendererType, componentFactory }) {
        this.isHost = !!isHost;
        this.type = type;
        this.isComponent = isComponent;
        this.selector = selector;
        this.exportAs = exportAs;
        this.changeDetection = changeDetection;
        this.inputs = inputs;
        this.outputs = outputs;
        this.hostListeners = hostListeners;
        this.hostProperties = hostProperties;
        this.hostAttributes = hostAttributes;
        this.providers = _normalizeArray(providers);
        this.viewProviders = _normalizeArray(viewProviders);
        this.queries = _normalizeArray(queries);
        this.guards = guards;
        this.viewQueries = _normalizeArray(viewQueries);
        this.entryComponents = _normalizeArray(entryComponents);
        this.template = template;
        this.componentViewType = componentViewType;
        this.rendererType = rendererType;
        this.componentFactory = componentFactory;
    }
    /**
     * @return {?}
     */
    toSummary() {
        return {
            summaryKind: CompileSummaryKind.Directive,
            type: this.type,
            isComponent: this.isComponent,
            selector: this.selector,
            exportAs: this.exportAs,
            inputs: this.inputs,
            outputs: this.outputs,
            hostListeners: this.hostListeners,
            hostProperties: this.hostProperties,
            hostAttributes: this.hostAttributes,
            providers: this.providers,
            viewProviders: this.viewProviders,
            queries: this.queries,
            guards: this.guards,
            viewQueries: this.viewQueries,
            entryComponents: this.entryComponents,
            changeDetection: this.changeDetection,
            template: this.template && this.template.toSummary(),
            componentViewType: this.componentViewType,
            rendererType: this.rendererType,
            componentFactory: this.componentFactory
        };
    }
}
function CompileDirectiveMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileDirectiveMetadata.prototype.isHost;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.type;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.isComponent;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.selector;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.exportAs;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.changeDetection;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.inputs;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.outputs;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.hostListeners;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.hostProperties;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.hostAttributes;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.providers;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.viewProviders;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.queries;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.guards;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.viewQueries;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.entryComponents;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.template;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.componentViewType;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.rendererType;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.componentFactory;
}
/**
 * @record
 */
export function CompilePipeSummary() { }
function CompilePipeSummary_tsickle_Closure_declarations() {
    /** @type {?} */
    CompilePipeSummary.prototype.type;
    /** @type {?} */
    CompilePipeSummary.prototype.name;
    /** @type {?} */
    CompilePipeSummary.prototype.pure;
}
export class CompilePipeMetadata {
    /**
     * @param {?} __0
     */
    constructor({ type, name, pure }) {
        this.type = type;
        this.name = name;
        this.pure = !!pure;
    }
    /**
     * @return {?}
     */
    toSummary() {
        return {
            summaryKind: CompileSummaryKind.Pipe,
            type: this.type,
            name: this.name,
            pure: this.pure
        };
    }
}
function CompilePipeMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompilePipeMetadata.prototype.type;
    /** @type {?} */
    CompilePipeMetadata.prototype.name;
    /** @type {?} */
    CompilePipeMetadata.prototype.pure;
}
/**
 * @record
 */
export function CompileNgModuleSummary() { }
function CompileNgModuleSummary_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileNgModuleSummary.prototype.type;
    /** @type {?} */
    CompileNgModuleSummary.prototype.exportedDirectives;
    /** @type {?} */
    CompileNgModuleSummary.prototype.exportedPipes;
    /** @type {?} */
    CompileNgModuleSummary.prototype.entryComponents;
    /** @type {?} */
    CompileNgModuleSummary.prototype.providers;
    /** @type {?} */
    CompileNgModuleSummary.prototype.modules;
}
export class CompileShallowModuleMetadata {
}
function CompileShallowModuleMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileShallowModuleMetadata.prototype.type;
    /** @type {?} */
    CompileShallowModuleMetadata.prototype.rawExports;
    /** @type {?} */
    CompileShallowModuleMetadata.prototype.rawImports;
    /** @type {?} */
    CompileShallowModuleMetadata.prototype.rawProviders;
}
/**
 * Metadata regarding compilation of a module.
 */
export class CompileNgModuleMetadata {
    /**
     * @param {?} __0
     */
    constructor({ type, providers, declaredDirectives, exportedDirectives, declaredPipes, exportedPipes, entryComponents, bootstrapComponents, importedModules, exportedModules, schemas, transitiveModule, id }) {
        this.type = type || null;
        this.declaredDirectives = _normalizeArray(declaredDirectives);
        this.exportedDirectives = _normalizeArray(exportedDirectives);
        this.declaredPipes = _normalizeArray(declaredPipes);
        this.exportedPipes = _normalizeArray(exportedPipes);
        this.providers = _normalizeArray(providers);
        this.entryComponents = _normalizeArray(entryComponents);
        this.bootstrapComponents = _normalizeArray(bootstrapComponents);
        this.importedModules = _normalizeArray(importedModules);
        this.exportedModules = _normalizeArray(exportedModules);
        this.schemas = _normalizeArray(schemas);
        this.id = id || null;
        this.transitiveModule = transitiveModule || null;
    }
    /**
     * @return {?}
     */
    toSummary() {
        const /** @type {?} */ module = /** @type {?} */ ((this.transitiveModule));
        return {
            summaryKind: CompileSummaryKind.NgModule,
            type: this.type,
            entryComponents: module.entryComponents,
            providers: module.providers,
            modules: module.modules,
            exportedDirectives: module.exportedDirectives,
            exportedPipes: module.exportedPipes
        };
    }
}
function CompileNgModuleMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileNgModuleMetadata.prototype.type;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.declaredDirectives;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.exportedDirectives;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.declaredPipes;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.exportedPipes;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.entryComponents;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.bootstrapComponents;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.providers;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.importedModules;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.exportedModules;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.schemas;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.id;
    /** @type {?} */
    CompileNgModuleMetadata.prototype.transitiveModule;
}
export class TransitiveCompileNgModuleMetadata {
    constructor() {
        this.directivesSet = new Set();
        this.directives = [];
        this.exportedDirectivesSet = new Set();
        this.exportedDirectives = [];
        this.pipesSet = new Set();
        this.pipes = [];
        this.exportedPipesSet = new Set();
        this.exportedPipes = [];
        this.modulesSet = new Set();
        this.modules = [];
        this.entryComponentsSet = new Set();
        this.entryComponents = [];
        this.providers = [];
    }
    /**
     * @param {?} provider
     * @param {?} module
     * @return {?}
     */
    addProvider(provider, module) {
        this.providers.push({ provider: provider, module: module });
    }
    /**
     * @param {?} id
     * @return {?}
     */
    addDirective(id) {
        if (!this.directivesSet.has(id.reference)) {
            this.directivesSet.add(id.reference);
            this.directives.push(id);
        }
    }
    /**
     * @param {?} id
     * @return {?}
     */
    addExportedDirective(id) {
        if (!this.exportedDirectivesSet.has(id.reference)) {
            this.exportedDirectivesSet.add(id.reference);
            this.exportedDirectives.push(id);
        }
    }
    /**
     * @param {?} id
     * @return {?}
     */
    addPipe(id) {
        if (!this.pipesSet.has(id.reference)) {
            this.pipesSet.add(id.reference);
            this.pipes.push(id);
        }
    }
    /**
     * @param {?} id
     * @return {?}
     */
    addExportedPipe(id) {
        if (!this.exportedPipesSet.has(id.reference)) {
            this.exportedPipesSet.add(id.reference);
            this.exportedPipes.push(id);
        }
    }
    /**
     * @param {?} id
     * @return {?}
     */
    addModule(id) {
        if (!this.modulesSet.has(id.reference)) {
            this.modulesSet.add(id.reference);
            this.modules.push(id);
        }
    }
    /**
     * @param {?} ec
     * @return {?}
     */
    addEntryComponent(ec) {
        if (!this.entryComponentsSet.has(ec.componentType)) {
            this.entryComponentsSet.add(ec.componentType);
            this.entryComponents.push(ec);
        }
    }
}
function TransitiveCompileNgModuleMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.directivesSet;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.directives;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.exportedDirectivesSet;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.exportedDirectives;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.pipesSet;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.pipes;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.exportedPipesSet;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.exportedPipes;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.modulesSet;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.modules;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.entryComponentsSet;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.entryComponents;
    /** @type {?} */
    TransitiveCompileNgModuleMetadata.prototype.providers;
}
/**
 * @param {?} obj
 * @return {?}
 */
function _normalizeArray(obj) {
    return obj || [];
}
export class ProviderMeta {
    /**
     * @param {?} token
     * @param {?} __1
     */
    constructor(token, { useClass, useValue, useExisting, useFactory, deps, multi }) {
        this.token = token;
        this.useClass = useClass || null;
        this.useValue = useValue;
        this.useExisting = useExisting;
        this.useFactory = useFactory || null;
        this.dependencies = deps || null;
        this.multi = !!multi;
    }
}
function ProviderMeta_tsickle_Closure_declarations() {
    /** @type {?} */
    ProviderMeta.prototype.token;
    /** @type {?} */
    ProviderMeta.prototype.useClass;
    /** @type {?} */
    ProviderMeta.prototype.useValue;
    /** @type {?} */
    ProviderMeta.prototype.useExisting;
    /** @type {?} */
    ProviderMeta.prototype.useFactory;
    /** @type {?} */
    ProviderMeta.prototype.dependencies;
    /** @type {?} */
    ProviderMeta.prototype.multi;
}
/**
 * @template T
 * @param {?} list
 * @return {?}
 */
export function flatten(list) {
    return list.reduce((flat, item) => {
        const /** @type {?} */ flatItem = Array.isArray(item) ? flatten(item) : item;
        return (/** @type {?} */ (flat)).concat(flatItem);
    }, []);
}
/**
 * @param {?} url
 * @return {?}
 */
function jitSourceUrl(url) {
    // Note: We need 3 "/" so that ng shows up as a separate domain
    // in the chrome dev tools.
    return url.replace(/(\w+:\/\/[\w:-]+)?(\/+)?/, 'ng:///');
}
/**
 * @param {?} ngModuleType
 * @param {?} compMeta
 * @param {?} templateMeta
 * @return {?}
 */
export function templateSourceUrl(ngModuleType, compMeta, templateMeta) {
    let /** @type {?} */ url;
    if (templateMeta.isInline) {
        if (compMeta.type.reference instanceof StaticSymbol) {
            // Note: a .ts file might contain multiple components with inline templates,
            // so we need to give them unique urls, as these will be used for sourcemaps.
            url = `${compMeta.type.reference.filePath}.${compMeta.type.reference.name}.html`;
        }
        else {
            url = `${identifierName(ngModuleType)}/${identifierName(compMeta.type)}.html`;
        }
    }
    else {
        url = /** @type {?} */ ((templateMeta.templateUrl));
    }
    return compMeta.type.reference instanceof StaticSymbol ? url : jitSourceUrl(url);
}
/**
 * @param {?} meta
 * @param {?} id
 * @return {?}
 */
export function sharedStylesheetJitUrl(meta, id) {
    const /** @type {?} */ pathParts = /** @type {?} */ ((meta.moduleUrl)).split(/\/\\/g);
    const /** @type {?} */ baseName = pathParts[pathParts.length - 1];
    return jitSourceUrl(`css/${id}${baseName}.ngstyle.js`);
}
/**
 * @param {?} moduleMeta
 * @return {?}
 */
export function ngModuleJitUrl(moduleMeta) {
    return jitSourceUrl(`${identifierName(moduleMeta.type)}/module.ngfactory.js`);
}
/**
 * @param {?} ngModuleType
 * @param {?} compMeta
 * @return {?}
 */
export function templateJitUrl(ngModuleType, compMeta) {
    return jitSourceUrl(`${identifierName(ngModuleType)}/${identifierName(compMeta.type)}.ngfactory.js`);
}
//# sourceMappingURL=compile_metadata.js.map