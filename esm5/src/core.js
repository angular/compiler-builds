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
import * as tslib_1 from "tslib";
import { CssSelector } from './selector';
/**
 * @record
 */
export function Inject() { }
function Inject_tsickle_Closure_declarations() {
    /** @type {?} */
    Inject.prototype.token;
}
export var /** @type {?} */ createInject = makeMetadataFactory('Inject', function (token) { return ({ token: token }); });
export var /** @type {?} */ createInjectionToken = makeMetadataFactory('InjectionToken', function (desc) { return ({ _desc: desc, ngInjectableDef: undefined }); });
/**
 * @record
 */
export function Attribute() { }
function Attribute_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Attribute.prototype.attributeName;
}
export var /** @type {?} */ createAttribute = makeMetadataFactory('Attribute', function (attributeName) { return ({ attributeName: attributeName }); });
/**
 * @record
 */
export function Query() { }
function Query_tsickle_Closure_declarations() {
    /** @type {?} */
    Query.prototype.descendants;
    /** @type {?} */
    Query.prototype.first;
    /** @type {?} */
    Query.prototype.read;
    /** @type {?} */
    Query.prototype.isViewQuery;
    /** @type {?} */
    Query.prototype.selector;
}
export var /** @type {?} */ createContentChildren = makeMetadataFactory('ContentChildren', function (selector, data) {
    if (data === void 0) { data = {}; }
    return (tslib_1.__assign({ selector: selector, first: false, isViewQuery: false, descendants: false }, data));
});
export var /** @type {?} */ createContentChild = makeMetadataFactory('ContentChild', function (selector, data) {
    if (data === void 0) { data = {}; }
    return (tslib_1.__assign({ selector: selector, first: true, isViewQuery: false, descendants: true }, data));
});
export var /** @type {?} */ createViewChildren = makeMetadataFactory('ViewChildren', function (selector, data) {
    if (data === void 0) { data = {}; }
    return (tslib_1.__assign({ selector: selector, first: false, isViewQuery: true, descendants: true }, data));
});
export var /** @type {?} */ createViewChild = makeMetadataFactory('ViewChild', function (selector, data) {
    return (tslib_1.__assign({ selector: selector, first: true, isViewQuery: true, descendants: true }, data));
});
/**
 * @record
 */
export function Directive() { }
function Directive_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Directive.prototype.selector;
    /** @type {?|undefined} */
    Directive.prototype.inputs;
    /** @type {?|undefined} */
    Directive.prototype.outputs;
    /** @type {?|undefined} */
    Directive.prototype.host;
    /** @type {?|undefined} */
    Directive.prototype.providers;
    /** @type {?|undefined} */
    Directive.prototype.exportAs;
    /** @type {?|undefined} */
    Directive.prototype.queries;
    /** @type {?|undefined} */
    Directive.prototype.guards;
}
export var /** @type {?} */ createDirective = makeMetadataFactory('Directive', function (dir) {
    if (dir === void 0) { dir = {}; }
    return dir;
});
/**
 * @record
 */
export function Component() { }
function Component_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Component.prototype.changeDetection;
    /** @type {?|undefined} */
    Component.prototype.viewProviders;
    /** @type {?|undefined} */
    Component.prototype.moduleId;
    /** @type {?|undefined} */
    Component.prototype.templateUrl;
    /** @type {?|undefined} */
    Component.prototype.template;
    /** @type {?|undefined} */
    Component.prototype.styleUrls;
    /** @type {?|undefined} */
    Component.prototype.styles;
    /** @type {?|undefined} */
    Component.prototype.animations;
    /** @type {?|undefined} */
    Component.prototype.encapsulation;
    /** @type {?|undefined} */
    Component.prototype.interpolation;
    /** @type {?|undefined} */
    Component.prototype.entryComponents;
    /** @type {?|undefined} */
    Component.prototype.preserveWhitespaces;
}
/** @enum {number} */
var ViewEncapsulation = {
    Emulated: 0,
    Native: 1,
    None: 2,
};
export { ViewEncapsulation };
ViewEncapsulation[ViewEncapsulation.Emulated] = "Emulated";
ViewEncapsulation[ViewEncapsulation.Native] = "Native";
ViewEncapsulation[ViewEncapsulation.None] = "None";
/** @enum {number} */
var ChangeDetectionStrategy = {
    OnPush: 0,
    Default: 1,
};
export { ChangeDetectionStrategy };
ChangeDetectionStrategy[ChangeDetectionStrategy.OnPush] = "OnPush";
ChangeDetectionStrategy[ChangeDetectionStrategy.Default] = "Default";
export var /** @type {?} */ createComponent = makeMetadataFactory('Component', function (c) {
    if (c === void 0) { c = {}; }
    return (tslib_1.__assign({ changeDetection: ChangeDetectionStrategy.Default }, c));
});
/**
 * @record
 */
export function Pipe() { }
function Pipe_tsickle_Closure_declarations() {
    /** @type {?} */
    Pipe.prototype.name;
    /** @type {?|undefined} */
    Pipe.prototype.pure;
}
export var /** @type {?} */ createPipe = makeMetadataFactory('Pipe', function (p) { return (tslib_1.__assign({ pure: true }, p)); });
/**
 * @record
 */
export function Input() { }
function Input_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Input.prototype.bindingPropertyName;
}
export var /** @type {?} */ createInput = makeMetadataFactory('Input', function (bindingPropertyName) { return ({ bindingPropertyName: bindingPropertyName }); });
/**
 * @record
 */
export function Output() { }
function Output_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Output.prototype.bindingPropertyName;
}
export var /** @type {?} */ createOutput = makeMetadataFactory('Output', function (bindingPropertyName) { return ({ bindingPropertyName: bindingPropertyName }); });
/**
 * @record
 */
export function HostBinding() { }
function HostBinding_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    HostBinding.prototype.hostPropertyName;
}
export var /** @type {?} */ createHostBinding = makeMetadataFactory('HostBinding', function (hostPropertyName) { return ({ hostPropertyName: hostPropertyName }); });
/**
 * @record
 */
export function HostListener() { }
function HostListener_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    HostListener.prototype.eventName;
    /** @type {?|undefined} */
    HostListener.prototype.args;
}
export var /** @type {?} */ createHostListener = makeMetadataFactory('HostListener', function (eventName, args) { return ({ eventName: eventName, args: args }); });
/**
 * @record
 */
export function NgModule() { }
function NgModule_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    NgModule.prototype.providers;
    /** @type {?|undefined} */
    NgModule.prototype.declarations;
    /** @type {?|undefined} */
    NgModule.prototype.imports;
    /** @type {?|undefined} */
    NgModule.prototype.exports;
    /** @type {?|undefined} */
    NgModule.prototype.entryComponents;
    /** @type {?|undefined} */
    NgModule.prototype.bootstrap;
    /** @type {?|undefined} */
    NgModule.prototype.schemas;
    /** @type {?|undefined} */
    NgModule.prototype.id;
}
export var /** @type {?} */ createNgModule = makeMetadataFactory('NgModule', function (ngModule) { return ngModule; });
/**
 * @record
 */
export function ModuleWithProviders() { }
function ModuleWithProviders_tsickle_Closure_declarations() {
    /** @type {?} */
    ModuleWithProviders.prototype.ngModule;
    /** @type {?|undefined} */
    ModuleWithProviders.prototype.providers;
}
/**
 * @record
 */
export function Injectable() { }
function Injectable_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Injectable.prototype.providedIn;
    /** @type {?|undefined} */
    Injectable.prototype.useClass;
    /** @type {?|undefined} */
    Injectable.prototype.useExisting;
    /** @type {?|undefined} */
    Injectable.prototype.useValue;
    /** @type {?|undefined} */
    Injectable.prototype.useFactory;
    /** @type {?|undefined} */
    Injectable.prototype.deps;
}
export var /** @type {?} */ createInjectable = makeMetadataFactory('Injectable', function (injectable) {
    if (injectable === void 0) { injectable = {}; }
    return injectable;
});
/**
 * @record
 */
export function SchemaMetadata() { }
function SchemaMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    SchemaMetadata.prototype.name;
}
export var /** @type {?} */ CUSTOM_ELEMENTS_SCHEMA = {
    name: 'custom-elements'
};
export var /** @type {?} */ NO_ERRORS_SCHEMA = {
    name: 'no-errors-schema'
};
export var /** @type {?} */ createOptional = makeMetadataFactory('Optional');
export var /** @type {?} */ createSelf = makeMetadataFactory('Self');
export var /** @type {?} */ createSkipSelf = makeMetadataFactory('SkipSelf');
export var /** @type {?} */ createHost = makeMetadataFactory('Host');
export var /** @type {?} */ Type = Function;
/** @enum {number} */
var SecurityContext = {
    NONE: 0,
    HTML: 1,
    STYLE: 2,
    SCRIPT: 3,
    URL: 4,
    RESOURCE_URL: 5,
};
export { SecurityContext };
SecurityContext[SecurityContext.NONE] = "NONE";
SecurityContext[SecurityContext.HTML] = "HTML";
SecurityContext[SecurityContext.STYLE] = "STYLE";
SecurityContext[SecurityContext.SCRIPT] = "SCRIPT";
SecurityContext[SecurityContext.URL] = "URL";
SecurityContext[SecurityContext.RESOURCE_URL] = "RESOURCE_URL";
/** @enum {number} */
var NodeFlags = {
    None: 0,
    TypeElement: 1,
    TypeText: 2,
    ProjectedTemplate: 4,
    CatRenderNode: 3,
    TypeNgContent: 8,
    TypePipe: 16,
    TypePureArray: 32,
    TypePureObject: 64,
    TypePurePipe: 128,
    CatPureExpression: 224,
    TypeValueProvider: 256,
    TypeClassProvider: 512,
    TypeFactoryProvider: 1024,
    TypeUseExistingProvider: 2048,
    LazyProvider: 4096,
    PrivateProvider: 8192,
    TypeDirective: 16384,
    Component: 32768,
    CatProviderNoDirective: 3840,
    CatProvider: 20224,
    OnInit: 65536,
    OnDestroy: 131072,
    DoCheck: 262144,
    OnChanges: 524288,
    AfterContentInit: 1048576,
    AfterContentChecked: 2097152,
    AfterViewInit: 4194304,
    AfterViewChecked: 8388608,
    EmbeddedViews: 16777216,
    ComponentView: 33554432,
    TypeContentQuery: 67108864,
    TypeViewQuery: 134217728,
    StaticQuery: 268435456,
    DynamicQuery: 536870912,
    TypeModuleProvider: 1073741824,
    CatQuery: 201326592,
    // mutually exclusive values...
    Types: 201347067,
};
export { NodeFlags };
/** @enum {number} */
var DepFlags = {
    None: 0,
    SkipSelf: 1,
    Optional: 2,
    Self: 4,
    Value: 8,
};
export { DepFlags };
/** @enum {number} */
var InjectFlags = {
    Default: 0,
    /**
       * Specifies that an injector should retrieve a dependency from any injector until reaching the
       * host element of the current component. (Only used with Element Injector)
       */
    Host: 1,
    /** Don't descend into ancestors of the node requesting injection. */
    Self: 2,
    /** Skip the node that is requesting injection. */
    SkipSelf: 4,
    /** Inject `defaultValue` instead if token not found. */
    Optional: 8,
};
export { InjectFlags };
/** @enum {number} */
var ArgumentType = { Inline: 0, Dynamic: 1, };
export { ArgumentType };
/** @enum {number} */
var BindingFlags = {
    TypeElementAttribute: 1,
    TypeElementClass: 2,
    TypeElementStyle: 4,
    TypeProperty: 8,
    SyntheticProperty: 16,
    SyntheticHostProperty: 32,
    CatSyntheticProperty: 48,
    // mutually exclusive values...
    Types: 15,
};
export { BindingFlags };
/** @enum {number} */
var QueryBindingType = { First: 0, All: 1, };
export { QueryBindingType };
/** @enum {number} */
var QueryValueType = {
    ElementRef: 0,
    RenderElement: 1,
    TemplateRef: 2,
    ViewContainerRef: 3,
    Provider: 4,
};
export { QueryValueType };
/** @enum {number} */
var ViewFlags = {
    None: 0,
    OnPush: 2,
};
export { ViewFlags };
/** @enum {number} */
var MissingTranslationStrategy = {
    Error: 0,
    Warning: 1,
    Ignore: 2,
};
export { MissingTranslationStrategy };
MissingTranslationStrategy[MissingTranslationStrategy.Error] = "Error";
MissingTranslationStrategy[MissingTranslationStrategy.Warning] = "Warning";
MissingTranslationStrategy[MissingTranslationStrategy.Ignore] = "Ignore";
/**
 * @record
 * @template T
 */
export function MetadataFactory() { }
function MetadataFactory_tsickle_Closure_declarations() {
    /* TODO: handle strange member:
    (...args: any[]): T;
    */
    /** @type {?} */
    MetadataFactory.prototype.isTypeOf;
    /** @type {?} */
    MetadataFactory.prototype.ngMetadataName;
}
/**
 * @template T
 * @param {?} name
 * @param {?=} props
 * @return {?}
 */
function makeMetadataFactory(name, props) {
    var /** @type {?} */ factory = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var /** @type {?} */ values = props ? props.apply(void 0, args) : {};
        return tslib_1.__assign({ ngMetadataName: name }, values);
    };
    factory.isTypeOf = function (obj) { return obj && obj.ngMetadataName === name; };
    factory.ngMetadataName = name;
    return factory;
}
/**
 * @record
 */
export function Route() { }
function Route_tsickle_Closure_declarations() {
    /** @type {?|undefined} */
    Route.prototype.children;
    /** @type {?|undefined} */
    Route.prototype.loadChildren;
}
/** @enum {number} */
var SelectorFlags = {
    /** Indicates this is the beginning of a new negative selector */
    NOT: 1,
    /** Mode for matching attributes */
    ATTRIBUTE: 2,
    /** Mode for matching tag names */
    ELEMENT: 4,
    /** Mode for matching class names */
    CLASS: 8,
};
export { SelectorFlags };
/**
 * @param {?} selector
 * @return {?}
 */
function parserSelectorToSimpleSelector(selector) {
    var /** @type {?} */ classes = selector.classNames && selector.classNames.length ? [8 /* CLASS */].concat(selector.classNames) :
        [];
    var /** @type {?} */ elementName = selector.element && selector.element !== '*' ? selector.element : '';
    return [elementName].concat(selector.attrs, classes);
}
/**
 * @param {?} selector
 * @return {?}
 */
function parserSelectorToNegativeSelector(selector) {
    var /** @type {?} */ classes = selector.classNames && selector.classNames.length ? [8 /* CLASS */].concat(selector.classNames) :
        [];
    if (selector.element) {
        return [
            1 /* NOT */ | 4 /* ELEMENT */, selector.element
        ].concat(selector.attrs, classes);
    }
    else if (selector.attrs.length) {
        return [1 /* NOT */ | 2 /* ATTRIBUTE */].concat(selector.attrs, classes);
    }
    else {
        return selector.classNames && selector.classNames.length ? [1 /* NOT */ | 8 /* CLASS */].concat(selector.classNames) :
            [];
    }
}
/**
 * @param {?} selector
 * @return {?}
 */
function parserSelectorToR3Selector(selector) {
    var /** @type {?} */ positive = parserSelectorToSimpleSelector(selector);
    var /** @type {?} */ negative = selector.notSelectors && selector.notSelectors.length ?
        selector.notSelectors.map(function (notSelector) { return parserSelectorToNegativeSelector(notSelector); }) :
        [];
    return positive.concat.apply(positive, negative);
}
/**
 * @param {?} selector
 * @return {?}
 */
export function parseSelectorToR3Selector(selector) {
    var /** @type {?} */ selectors = CssSelector.parse(selector);
    return selectors.map(parserSelectorToR3Selector);
}
//# sourceMappingURL=core.js.map