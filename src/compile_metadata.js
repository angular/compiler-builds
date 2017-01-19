/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core/index';
import { StaticSymbol } from './aot/static_symbol';
import { ListWrapper } from './facade/collection';
import { isPresent, stringify } from './facade/lang';
import { reflector } from './private_import_core';
import { CssSelector } from './selector';
import { splitAtColon } from './util';
/**
 * @return {?}
 */
function unimplemented() {
    throw new Error('unimplemented');
}
// group 0: "[prop] or (event) or @trigger"
// group 1: "prop" from "[prop]"
// group 2: "event" from "(event)"
// group 3: "@trigger" from "@trigger"
const /** @type {?} */ HOST_REG_EXP = /^(?:(?:\[([^\]]+)\])|(?:\(([^\)]+)\)))|(\@[-\w]+)$/;
export class CompileAnimationEntryMetadata {
    /**
     * @param {?=} name
     * @param {?=} definitions
     */
    constructor(name = null, definitions = null) {
        this.name = name;
        this.definitions = definitions;
    }
}
function CompileAnimationEntryMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationEntryMetadata.prototype.name;
    /** @type {?} */
    CompileAnimationEntryMetadata.prototype.definitions;
}
/**
 * @abstract
 */
export class CompileAnimationStateMetadata {
}
export class CompileAnimationStateDeclarationMetadata extends CompileAnimationStateMetadata {
    /**
     * @param {?} stateNameExpr
     * @param {?} styles
     */
    constructor(stateNameExpr, styles) {
        super();
        this.stateNameExpr = stateNameExpr;
        this.styles = styles;
    }
}
function CompileAnimationStateDeclarationMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationStateDeclarationMetadata.prototype.stateNameExpr;
    /** @type {?} */
    CompileAnimationStateDeclarationMetadata.prototype.styles;
}
export class CompileAnimationStateTransitionMetadata extends CompileAnimationStateMetadata {
    /**
     * @param {?} stateChangeExpr
     * @param {?} steps
     */
    constructor(stateChangeExpr, steps) {
        super();
        this.stateChangeExpr = stateChangeExpr;
        this.steps = steps;
    }
}
function CompileAnimationStateTransitionMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationStateTransitionMetadata.prototype.stateChangeExpr;
    /** @type {?} */
    CompileAnimationStateTransitionMetadata.prototype.steps;
}
/**
 * @abstract
 */
export class CompileAnimationMetadata {
}
export class CompileAnimationKeyframesSequenceMetadata extends CompileAnimationMetadata {
    /**
     * @param {?=} steps
     */
    constructor(steps = []) {
        super();
        this.steps = steps;
    }
}
function CompileAnimationKeyframesSequenceMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationKeyframesSequenceMetadata.prototype.steps;
}
export class CompileAnimationStyleMetadata extends CompileAnimationMetadata {
    /**
     * @param {?} offset
     * @param {?=} styles
     */
    constructor(offset, styles = null) {
        super();
        this.offset = offset;
        this.styles = styles;
    }
}
function CompileAnimationStyleMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationStyleMetadata.prototype.offset;
    /** @type {?} */
    CompileAnimationStyleMetadata.prototype.styles;
}
export class CompileAnimationAnimateMetadata extends CompileAnimationMetadata {
    /**
     * @param {?=} timings
     * @param {?=} styles
     */
    constructor(timings = 0, styles = null) {
        super();
        this.timings = timings;
        this.styles = styles;
    }
}
function CompileAnimationAnimateMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationAnimateMetadata.prototype.timings;
    /** @type {?} */
    CompileAnimationAnimateMetadata.prototype.styles;
}
/**
 * @abstract
 */
export class CompileAnimationWithStepsMetadata extends CompileAnimationMetadata {
    /**
     * @param {?=} steps
     */
    constructor(steps = null) {
        super();
        this.steps = steps;
    }
}
function CompileAnimationWithStepsMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileAnimationWithStepsMetadata.prototype.steps;
}
export class CompileAnimationSequenceMetadata extends CompileAnimationWithStepsMetadata {
    /**
     * @param {?=} steps
     */
    constructor(steps = null) {
        super(steps);
    }
}
export class CompileAnimationGroupMetadata extends CompileAnimationWithStepsMetadata {
    /**
     * @param {?=} steps
     */
    constructor(steps = null) {
        super(steps);
    }
}
/**
 * @param {?} name
 * @return {?}
 */
function _sanitizeIdentifier(name) {
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
        identifier = _sanitizeIdentifier(identifier);
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
    return reflector.importUri(ref);
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
export function hostViewClassName(compType) {
    return `HostView_${identifierName({ reference: compType })}`;
}
/**
 * @param {?} dirType
 * @return {?}
 */
export function dirWrapperClassName(dirType) {
    return `Wrapper_${identifierName({ reference: dirType })}`;
}
/**
 * @param {?} compType
 * @return {?}
 */
export function componentFactoryName(compType) {
    return `${identifierName({ reference: compType })}NgFactory`;
}
export let CompileSummaryKind = {};
CompileSummaryKind.Pipe = 0;
CompileSummaryKind.Directive = 1;
CompileSummaryKind.NgModule = 2;
CompileSummaryKind.Injectable = 3;
CompileSummaryKind[CompileSummaryKind.Pipe] = "Pipe";
CompileSummaryKind[CompileSummaryKind.Directive] = "Directive";
CompileSummaryKind[CompileSummaryKind.NgModule] = "NgModule";
CompileSummaryKind[CompileSummaryKind.Injectable] = "Injectable";
/**
 * @param {?} token
 * @return {?}
 */
export function tokenName(token) {
    return isPresent(token.value) ? _sanitizeIdentifier(token.value) :
        identifierName(token.identifier);
}
/**
 * @param {?} token
 * @return {?}
 */
export function tokenReference(token) {
    if (isPresent(token.identifier)) {
        return token.identifier.reference;
    }
    else {
        return token.value;
    }
}
/**
 * Metadata about a stylesheet
 */
export class CompileStylesheetMetadata {
    /**
     * @param {?=} __0
     */
    constructor({ moduleUrl, styles, styleUrls } = {}) {
        this.moduleUrl = moduleUrl;
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
 * Metadata regarding compilation of a template.
 */
export class CompileTemplateMetadata {
    /**
     * @param {?=} __0
     */
    constructor({ encapsulation, template, templateUrl, styles, styleUrls, externalStylesheets, animations, ngContentSelectors, interpolation } = {}) {
        this.encapsulation = encapsulation;
        this.template = template;
        this.templateUrl = templateUrl;
        this.styles = _normalizeArray(styles);
        this.styleUrls = _normalizeArray(styleUrls);
        this.externalStylesheets = _normalizeArray(externalStylesheets);
        this.animations = animations ? ListWrapper.flatten(animations) : [];
        this.ngContentSelectors = ngContentSelectors || [];
        if (interpolation && interpolation.length != 2) {
            throw new Error(`'interpolation' should have a start and an end symbol.`);
        }
        this.interpolation = interpolation;
    }
    /**
     * @return {?}
     */
    toSummary() {
        return {
            animations: this.animations.map(anim => anim.name),
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
}
/**
 * Metadata regarding compilation of a directive.
 */
export class CompileDirectiveMetadata {
    /**
     * @param {?=} __0
     */
    constructor({ isHost, type, isComponent, selector, exportAs, changeDetection, inputs, outputs, hostListeners, hostProperties, hostAttributes, providers, viewProviders, queries, viewQueries, entryComponents, template, wrapperType, componentViewType, componentFactory } = {}) {
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
        this.viewQueries = _normalizeArray(viewQueries);
        this.entryComponents = _normalizeArray(entryComponents);
        this.template = template;
        this.wrapperType = wrapperType;
        this.componentViewType = componentViewType;
        this.componentFactory = componentFactory;
    }
    /**
     * @param {?=} __0
     * @return {?}
     */
    static create({ isHost, type, isComponent, selector, exportAs, changeDetection, inputs, outputs, host, providers, viewProviders, queries, viewQueries, entryComponents, template, wrapperType, componentViewType, componentFactory } = {}) {
        const /** @type {?} */ hostListeners = {};
        const /** @type {?} */ hostProperties = {};
        const /** @type {?} */ hostAttributes = {};
        if (isPresent(host)) {
            Object.keys(host).forEach(key => {
                const /** @type {?} */ value = host[key];
                const /** @type {?} */ matches = key.match(HOST_REG_EXP);
                if (matches === null) {
                    hostAttributes[key] = value;
                }
                else if (isPresent(matches[1])) {
                    hostProperties[matches[1]] = value;
                }
                else if (isPresent(matches[2])) {
                    hostListeners[matches[2]] = value;
                }
            });
        }
        const /** @type {?} */ inputsMap = {};
        if (isPresent(inputs)) {
            inputs.forEach((bindConfig) => {
                // canonical syntax: `dirProp: elProp`
                // if there is no `:`, use dirProp = elProp
                const /** @type {?} */ parts = splitAtColon(bindConfig, [bindConfig, bindConfig]);
                inputsMap[parts[0]] = parts[1];
            });
        }
        const /** @type {?} */ outputsMap = {};
        if (isPresent(outputs)) {
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
            viewQueries,
            entryComponents,
            template,
            wrapperType,
            componentViewType,
            componentFactory,
        });
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
            entryComponents: this.entryComponents,
            changeDetection: this.changeDetection,
            template: this.template && this.template.toSummary(),
            wrapperType: this.wrapperType,
            componentViewType: this.componentViewType,
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
    CompileDirectiveMetadata.prototype.viewQueries;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.entryComponents;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.template;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.wrapperType;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.componentViewType;
    /** @type {?} */
    CompileDirectiveMetadata.prototype.componentFactory;
}
/**
 * Construct {\@link CompileDirectiveMetadata} from {\@link ComponentTypeMetadata} and a selector.
 * @param {?} hostTypeReference
 * @param {?} compMeta
 * @param {?} hostViewType
 * @return {?}
 */
export function createHostComponentMeta(hostTypeReference, compMeta, hostViewType) {
    const /** @type {?} */ template = CssSelector.parse(compMeta.selector)[0].getMatchingElementTemplate();
    return CompileDirectiveMetadata.create({
        isHost: true,
        type: { reference: hostTypeReference, diDeps: [], lifecycleHooks: [] },
        template: new CompileTemplateMetadata({
            encapsulation: ViewEncapsulation.None,
            template: template,
            templateUrl: '',
            styles: [],
            styleUrls: [],
            ngContentSelectors: [],
            animations: []
        }),
        changeDetection: ChangeDetectionStrategy.Default,
        inputs: [],
        outputs: [],
        host: {},
        isComponent: true,
        selector: '*',
        providers: [],
        viewProviders: [],
        queries: [],
        viewQueries: [],
        componentViewType: hostViewType
    });
}
export class CompilePipeMetadata {
    /**
     * @param {?=} __0
     */
    constructor({ type, name, pure } = {}) {
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
 * Metadata regarding compilation of a module.
 */
export class CompileNgModuleMetadata {
    /**
     * @param {?=} __0
     */
    constructor({ type, providers, declaredDirectives, exportedDirectives, declaredPipes, exportedPipes, entryComponents, bootstrapComponents, importedModules, exportedModules, schemas, transitiveModule, id } = {}) {
        this.type = type;
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
        this.id = id;
        this.transitiveModule = transitiveModule;
    }
    /**
     * @return {?}
     */
    toSummary() {
        return {
            summaryKind: CompileSummaryKind.NgModule,
            type: this.type,
            entryComponents: this.transitiveModule.entryComponents,
            providers: this.transitiveModule.providers,
            modules: this.transitiveModule.modules,
            exportedDirectives: this.transitiveModule.exportedDirectives,
            exportedPipes: this.transitiveModule.exportedPipes
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
        this.useClass = useClass;
        this.useValue = useValue;
        this.useExisting = useExisting;
        this.useFactory = useFactory;
        this.dependencies = deps;
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
//# sourceMappingURL=compile_metadata.js.map