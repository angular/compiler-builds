/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ANALYZE_FOR_ENTRY_COMPONENTS, ChangeDetectionStrategy, ChangeDetectorRef, ComponentFactory, ComponentFactoryResolver, ComponentRef, ElementRef, Injector, LOCALE_ID, NgModuleFactory, QueryList, RenderComponentType, Renderer, SecurityContext, SimpleChange, TRANSLATIONS_FORMAT, TemplateRef, ViewContainerRef, ViewEncapsulation, ɵAnimationGroupPlayer, ɵAnimationKeyframe, ɵAnimationSequencePlayer, ɵAnimationStyles, ɵAnimationTransition, ɵAppView, ɵChangeDetectorStatus, ɵCodegenComponentFactoryResolver, ɵComponentRef_, ɵDebugAppView, ɵDebugContext, ɵNgModuleInjector, ɵNoOpAnimationPlayer, ɵStaticNodeDebugInfo, ɵTemplateRef_, ɵValueUnwrapper, ɵViewContainer, ɵViewType, ɵbalanceAnimationKeyframes, ɵclearStyles, ɵcollectAndResolveStyles, ɵdevModeEqual, ɵprepareFinalAnimationStyles, ɵreflector, ɵregisterModuleFactory, ɵrenderStyles, ɵviewEngine, ɵview_utils } from '@angular/core';
var /** @type {?} */ CORE = assetUrl('core');
var /** @type {?} */ VIEW_UTILS_MODULE_URL = assetUrl('core', 'linker/view_utils');
var Identifiers = (function () {
    function Identifiers() {
    }
    return Identifiers;
}());
export { Identifiers };
Identifiers.ANALYZE_FOR_ENTRY_COMPONENTS = {
    name: 'ANALYZE_FOR_ENTRY_COMPONENTS',
    moduleUrl: CORE,
    runtime: ANALYZE_FOR_ENTRY_COMPONENTS
};
Identifiers.ViewUtils = { name: 'ɵview_utils', moduleUrl: CORE, member: 'ViewUtils', runtime: ɵview_utils.ViewUtils };
Identifiers.AppView = { name: 'ɵAppView', moduleUrl: CORE, runtime: ɵAppView };
Identifiers.DebugAppView = { name: 'ɵDebugAppView', moduleUrl: CORE, runtime: ɵDebugAppView };
Identifiers.ViewContainer = { name: 'ɵViewContainer', moduleUrl: CORE, runtime: ɵViewContainer };
Identifiers.ElementRef = { name: 'ElementRef', moduleUrl: CORE, runtime: ElementRef };
Identifiers.ViewContainerRef = { name: 'ViewContainerRef', moduleUrl: CORE, runtime: ViewContainerRef };
Identifiers.ChangeDetectorRef = { name: 'ChangeDetectorRef', moduleUrl: CORE, runtime: ChangeDetectorRef };
Identifiers.RenderComponentType = { name: 'RenderComponentType', moduleUrl: CORE, runtime: RenderComponentType };
Identifiers.QueryList = { name: 'QueryList', moduleUrl: CORE, runtime: QueryList };
Identifiers.TemplateRef = { name: 'TemplateRef', moduleUrl: CORE, runtime: TemplateRef };
Identifiers.TemplateRef_ = { name: 'ɵTemplateRef_', moduleUrl: CORE, runtime: ɵTemplateRef_ };
Identifiers.CodegenComponentFactoryResolver = {
    name: 'ɵCodegenComponentFactoryResolver',
    moduleUrl: CORE,
    runtime: ɵCodegenComponentFactoryResolver
};
Identifiers.ComponentFactoryResolver = {
    name: 'ComponentFactoryResolver',
    moduleUrl: CORE,
    runtime: ComponentFactoryResolver
};
Identifiers.ComponentFactory = { name: 'ComponentFactory', moduleUrl: CORE, runtime: ComponentFactory };
Identifiers.ComponentRef_ = {
    name: 'ɵComponentRef_',
    moduleUrl: CORE,
    runtime: ɵComponentRef_,
};
Identifiers.ComponentRef = { name: 'ComponentRef', moduleUrl: CORE, runtime: ComponentRef };
Identifiers.NgModuleFactory = { name: 'NgModuleFactory', moduleUrl: CORE, runtime: NgModuleFactory };
Identifiers.NgModuleInjector = {
    name: 'ɵNgModuleInjector',
    moduleUrl: CORE,
    runtime: ɵNgModuleInjector,
};
Identifiers.RegisterModuleFactoryFn = {
    name: 'ɵregisterModuleFactory',
    moduleUrl: CORE,
    runtime: ɵregisterModuleFactory,
};
Identifiers.ValueUnwrapper = { name: 'ɵValueUnwrapper', moduleUrl: CORE, runtime: ɵValueUnwrapper };
Identifiers.Injector = { name: 'Injector', moduleUrl: CORE, runtime: Injector };
Identifiers.ViewEncapsulation = { name: 'ViewEncapsulation', moduleUrl: CORE, runtime: ViewEncapsulation };
Identifiers.ViewType = { name: 'ɵViewType', moduleUrl: CORE, runtime: ɵViewType };
Identifiers.ChangeDetectionStrategy = {
    name: 'ChangeDetectionStrategy',
    moduleUrl: CORE,
    runtime: ChangeDetectionStrategy
};
Identifiers.StaticNodeDebugInfo = {
    name: 'ɵStaticNodeDebugInfo',
    moduleUrl: CORE,
    runtime: ɵStaticNodeDebugInfo
};
Identifiers.DebugContext = { name: 'ɵDebugContext', moduleUrl: CORE, runtime: ɵDebugContext };
Identifiers.Renderer = { name: 'Renderer', moduleUrl: CORE, runtime: Renderer };
Identifiers.SimpleChange = { name: 'SimpleChange', moduleUrl: CORE, runtime: SimpleChange };
Identifiers.ChangeDetectorStatus = {
    name: 'ɵChangeDetectorStatus',
    moduleUrl: CORE,
    runtime: ɵChangeDetectorStatus
};
Identifiers.checkBinding = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkBinding',
    runtime: ɵview_utils.checkBinding
};
Identifiers.checkBindingChange = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkBindingChange',
    runtime: ɵview_utils.checkBindingChange
};
Identifiers.checkRenderText = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkRenderText',
    runtime: ɵview_utils.checkRenderText
};
Identifiers.checkRenderProperty = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkRenderProperty',
    runtime: ɵview_utils.checkRenderProperty
};
Identifiers.checkRenderAttribute = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkRenderAttribute',
    runtime: ɵview_utils.checkRenderAttribute
};
Identifiers.checkRenderClass = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkRenderClass',
    runtime: ɵview_utils.checkRenderClass
};
Identifiers.checkRenderStyle = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'checkRenderStyle',
    runtime: ɵview_utils.checkRenderStyle
};
Identifiers.devModeEqual = { name: 'ɵdevModeEqual', moduleUrl: CORE, runtime: ɵdevModeEqual };
Identifiers.inlineInterpolate = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'inlineInterpolate',
    runtime: ɵview_utils.inlineInterpolate
};
Identifiers.interpolate = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'interpolate',
    runtime: ɵview_utils.interpolate
};
Identifiers.castByValue = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'castByValue',
    runtime: ɵview_utils.castByValue
};
Identifiers.EMPTY_ARRAY = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'EMPTY_ARRAY',
    runtime: ɵview_utils.EMPTY_ARRAY
};
Identifiers.EMPTY_MAP = { name: 'ɵview_utils', moduleUrl: CORE, member: 'EMPTY_MAP', runtime: ɵview_utils.EMPTY_MAP };
Identifiers.createRenderElement = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'createRenderElement',
    runtime: ɵview_utils.createRenderElement
};
Identifiers.selectOrCreateRenderHostElement = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'selectOrCreateRenderHostElement',
    runtime: ɵview_utils.selectOrCreateRenderHostElement
};
Identifiers.pureProxies = [
    null,
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy1', runtime: ɵview_utils.pureProxy1 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy2', runtime: ɵview_utils.pureProxy2 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy3', runtime: ɵview_utils.pureProxy3 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy4', runtime: ɵview_utils.pureProxy4 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy5', runtime: ɵview_utils.pureProxy5 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy6', runtime: ɵview_utils.pureProxy6 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy7', runtime: ɵview_utils.pureProxy7 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy8', runtime: ɵview_utils.pureProxy8 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy9', runtime: ɵview_utils.pureProxy9 },
    { name: 'ɵview_utils', moduleUrl: CORE, member: 'pureProxy10', runtime: ɵview_utils.pureProxy10 },
];
Identifiers.SecurityContext = {
    name: 'SecurityContext',
    moduleUrl: CORE,
    runtime: SecurityContext,
};
Identifiers.AnimationKeyframe = { name: 'ɵAnimationKeyframe', moduleUrl: CORE, runtime: ɵAnimationKeyframe };
Identifiers.AnimationStyles = { name: 'ɵAnimationStyles', moduleUrl: CORE, runtime: ɵAnimationStyles };
Identifiers.NoOpAnimationPlayer = {
    name: 'ɵNoOpAnimationPlayer',
    moduleUrl: CORE,
    runtime: ɵNoOpAnimationPlayer
};
Identifiers.AnimationGroupPlayer = {
    name: 'ɵAnimationGroupPlayer',
    moduleUrl: CORE,
    runtime: ɵAnimationGroupPlayer
};
Identifiers.AnimationSequencePlayer = {
    name: 'ɵAnimationSequencePlayer',
    moduleUrl: CORE,
    runtime: ɵAnimationSequencePlayer
};
Identifiers.prepareFinalAnimationStyles = {
    name: 'ɵprepareFinalAnimationStyles',
    moduleUrl: CORE,
    runtime: ɵprepareFinalAnimationStyles
};
Identifiers.balanceAnimationKeyframes = {
    name: 'ɵbalanceAnimationKeyframes',
    moduleUrl: CORE,
    runtime: ɵbalanceAnimationKeyframes
};
Identifiers.clearStyles = { name: 'ɵclearStyles', moduleUrl: CORE, runtime: ɵclearStyles };
Identifiers.renderStyles = { name: 'ɵrenderStyles', moduleUrl: CORE, runtime: ɵrenderStyles };
Identifiers.collectAndResolveStyles = {
    name: 'ɵcollectAndResolveStyles',
    moduleUrl: CORE,
    runtime: ɵcollectAndResolveStyles
};
Identifiers.LOCALE_ID = { name: 'LOCALE_ID', moduleUrl: CORE, runtime: LOCALE_ID };
Identifiers.TRANSLATIONS_FORMAT = { name: 'TRANSLATIONS_FORMAT', moduleUrl: CORE, runtime: TRANSLATIONS_FORMAT };
Identifiers.setBindingDebugInfo = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'setBindingDebugInfo',
    runtime: ɵview_utils.setBindingDebugInfo
};
Identifiers.setBindingDebugInfoForChanges = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'setBindingDebugInfoForChanges',
    runtime: ɵview_utils.setBindingDebugInfoForChanges
};
Identifiers.AnimationTransition = {
    name: 'ɵAnimationTransition',
    moduleUrl: CORE,
    runtime: ɵAnimationTransition
};
// This is just the interface!
Identifiers.InlineArray = { name: 'InlineArray', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: null };
Identifiers.inlineArrays = [
    {
        name: 'ɵview_utils',
        moduleUrl: CORE,
        member: 'InlineArray2',
        runtime: ɵview_utils.InlineArray2
    },
    {
        name: 'ɵview_utils',
        moduleUrl: CORE,
        member: 'InlineArray2',
        runtime: ɵview_utils.InlineArray2
    },
    {
        name: 'ɵview_utils',
        moduleUrl: CORE,
        member: 'InlineArray4',
        runtime: ɵview_utils.InlineArray4
    },
    {
        name: 'ɵview_utils',
        moduleUrl: CORE,
        member: 'InlineArray8',
        runtime: ɵview_utils.InlineArray8
    },
    {
        name: 'ɵview_utils',
        moduleUrl: CORE,
        member: 'InlineArray16',
        runtime: ɵview_utils.InlineArray16
    },
];
Identifiers.EMPTY_INLINE_ARRAY = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'EMPTY_INLINE_ARRAY',
    runtime: ɵview_utils.EMPTY_INLINE_ARRAY
};
Identifiers.InlineArrayDynamic = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'InlineArrayDynamic',
    runtime: ɵview_utils.InlineArrayDynamic
};
Identifiers.subscribeToRenderElement = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'subscribeToRenderElement',
    runtime: ɵview_utils.subscribeToRenderElement
};
Identifiers.createRenderComponentType = {
    name: 'ɵview_utils',
    moduleUrl: CORE,
    member: 'createRenderComponentType',
    runtime: ɵview_utils.createRenderComponentType
};
Identifiers.noop = { name: 'ɵview_utils', moduleUrl: CORE, member: 'noop', runtime: ɵview_utils.noop };
Identifiers.viewDef = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'viewDef', runtime: ɵviewEngine.viewDef };
Identifiers.elementDef = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'elementDef', runtime: ɵviewEngine.elementDef };
Identifiers.anchorDef = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'anchorDef', runtime: ɵviewEngine.anchorDef };
Identifiers.textDef = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'textDef', runtime: ɵviewEngine.textDef };
Identifiers.directiveDef = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'directiveDef',
    runtime: ɵviewEngine.directiveDef
};
Identifiers.providerDef = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'providerDef',
    runtime: ɵviewEngine.providerDef
};
Identifiers.queryDef = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'queryDef', runtime: ɵviewEngine.queryDef };
Identifiers.pureArrayDef = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'pureArrayDef',
    runtime: ɵviewEngine.pureArrayDef
};
Identifiers.pureObjectDef = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'pureObjectDef',
    runtime: ɵviewEngine.pureObjectDef
};
Identifiers.purePipeDef = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'purePipeDef',
    runtime: ɵviewEngine.purePipeDef
};
Identifiers.pipeDef = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'pipeDef', runtime: ɵviewEngine.pipeDef };
Identifiers.nodeValue = { name: 'ɵviewEngine', moduleUrl: CORE, member: 'nodeValue', runtime: ɵviewEngine.nodeValue };
Identifiers.ngContentDef = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'ngContentDef',
    runtime: ɵviewEngine.ngContentDef
};
Identifiers.unwrapValue = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'unwrapValue',
    runtime: ɵviewEngine.unwrapValue
};
Identifiers.createRendererTypeV2 = {
    name: 'ɵviewEngine',
    moduleUrl: CORE,
    member: 'createRendererTypeV2',
    runtime: ɵviewEngine.createRendererTypeV2
};
function Identifiers_tsickle_Closure_declarations() {
    /** @type {?} */
    Identifiers.ANALYZE_FOR_ENTRY_COMPONENTS;
    /** @type {?} */
    Identifiers.ViewUtils;
    /** @type {?} */
    Identifiers.AppView;
    /** @type {?} */
    Identifiers.DebugAppView;
    /** @type {?} */
    Identifiers.ViewContainer;
    /** @type {?} */
    Identifiers.ElementRef;
    /** @type {?} */
    Identifiers.ViewContainerRef;
    /** @type {?} */
    Identifiers.ChangeDetectorRef;
    /** @type {?} */
    Identifiers.RenderComponentType;
    /** @type {?} */
    Identifiers.QueryList;
    /** @type {?} */
    Identifiers.TemplateRef;
    /** @type {?} */
    Identifiers.TemplateRef_;
    /** @type {?} */
    Identifiers.CodegenComponentFactoryResolver;
    /** @type {?} */
    Identifiers.ComponentFactoryResolver;
    /** @type {?} */
    Identifiers.ComponentFactory;
    /** @type {?} */
    Identifiers.ComponentRef_;
    /** @type {?} */
    Identifiers.ComponentRef;
    /** @type {?} */
    Identifiers.NgModuleFactory;
    /** @type {?} */
    Identifiers.NgModuleInjector;
    /** @type {?} */
    Identifiers.RegisterModuleFactoryFn;
    /** @type {?} */
    Identifiers.ValueUnwrapper;
    /** @type {?} */
    Identifiers.Injector;
    /** @type {?} */
    Identifiers.ViewEncapsulation;
    /** @type {?} */
    Identifiers.ViewType;
    /** @type {?} */
    Identifiers.ChangeDetectionStrategy;
    /** @type {?} */
    Identifiers.StaticNodeDebugInfo;
    /** @type {?} */
    Identifiers.DebugContext;
    /** @type {?} */
    Identifiers.Renderer;
    /** @type {?} */
    Identifiers.SimpleChange;
    /** @type {?} */
    Identifiers.ChangeDetectorStatus;
    /** @type {?} */
    Identifiers.checkBinding;
    /** @type {?} */
    Identifiers.checkBindingChange;
    /** @type {?} */
    Identifiers.checkRenderText;
    /** @type {?} */
    Identifiers.checkRenderProperty;
    /** @type {?} */
    Identifiers.checkRenderAttribute;
    /** @type {?} */
    Identifiers.checkRenderClass;
    /** @type {?} */
    Identifiers.checkRenderStyle;
    /** @type {?} */
    Identifiers.devModeEqual;
    /** @type {?} */
    Identifiers.inlineInterpolate;
    /** @type {?} */
    Identifiers.interpolate;
    /** @type {?} */
    Identifiers.castByValue;
    /** @type {?} */
    Identifiers.EMPTY_ARRAY;
    /** @type {?} */
    Identifiers.EMPTY_MAP;
    /** @type {?} */
    Identifiers.createRenderElement;
    /** @type {?} */
    Identifiers.selectOrCreateRenderHostElement;
    /** @type {?} */
    Identifiers.pureProxies;
    /** @type {?} */
    Identifiers.SecurityContext;
    /** @type {?} */
    Identifiers.AnimationKeyframe;
    /** @type {?} */
    Identifiers.AnimationStyles;
    /** @type {?} */
    Identifiers.NoOpAnimationPlayer;
    /** @type {?} */
    Identifiers.AnimationGroupPlayer;
    /** @type {?} */
    Identifiers.AnimationSequencePlayer;
    /** @type {?} */
    Identifiers.prepareFinalAnimationStyles;
    /** @type {?} */
    Identifiers.balanceAnimationKeyframes;
    /** @type {?} */
    Identifiers.clearStyles;
    /** @type {?} */
    Identifiers.renderStyles;
    /** @type {?} */
    Identifiers.collectAndResolveStyles;
    /** @type {?} */
    Identifiers.LOCALE_ID;
    /** @type {?} */
    Identifiers.TRANSLATIONS_FORMAT;
    /** @type {?} */
    Identifiers.setBindingDebugInfo;
    /** @type {?} */
    Identifiers.setBindingDebugInfoForChanges;
    /** @type {?} */
    Identifiers.AnimationTransition;
    /** @type {?} */
    Identifiers.InlineArray;
    /** @type {?} */
    Identifiers.inlineArrays;
    /** @type {?} */
    Identifiers.EMPTY_INLINE_ARRAY;
    /** @type {?} */
    Identifiers.InlineArrayDynamic;
    /** @type {?} */
    Identifiers.subscribeToRenderElement;
    /** @type {?} */
    Identifiers.createRenderComponentType;
    /** @type {?} */
    Identifiers.noop;
    /** @type {?} */
    Identifiers.viewDef;
    /** @type {?} */
    Identifiers.elementDef;
    /** @type {?} */
    Identifiers.anchorDef;
    /** @type {?} */
    Identifiers.textDef;
    /** @type {?} */
    Identifiers.directiveDef;
    /** @type {?} */
    Identifiers.providerDef;
    /** @type {?} */
    Identifiers.queryDef;
    /** @type {?} */
    Identifiers.pureArrayDef;
    /** @type {?} */
    Identifiers.pureObjectDef;
    /** @type {?} */
    Identifiers.purePipeDef;
    /** @type {?} */
    Identifiers.pipeDef;
    /** @type {?} */
    Identifiers.nodeValue;
    /** @type {?} */
    Identifiers.ngContentDef;
    /** @type {?} */
    Identifiers.unwrapValue;
    /** @type {?} */
    Identifiers.createRendererTypeV2;
}
/**
 * @param {?} pkg
 * @param {?=} path
 * @param {?=} type
 * @return {?}
 */
export function assetUrl(pkg, path, type) {
    if (path === void 0) { path = null; }
    if (type === void 0) { type = 'src'; }
    if (path == null) {
        return "@angular/" + pkg;
    }
    else {
        return "@angular/" + pkg + "/" + type + "/" + path;
    }
}
/**
 * @param {?} identifier
 * @return {?}
 */
export function resolveIdentifier(identifier) {
    var /** @type {?} */ name = identifier.name;
    var /** @type {?} */ members = identifier.member && [identifier.member];
    return ɵreflector.resolveIdentifier(name, identifier.moduleUrl, members, identifier.runtime);
}
/**
 * @param {?} identifier
 * @return {?}
 */
export function createIdentifier(identifier) {
    return { reference: resolveIdentifier(identifier) };
}
/**
 * @param {?} identifier
 * @return {?}
 */
export function identifierToken(identifier) {
    return { identifier: identifier };
}
/**
 * @param {?} identifier
 * @return {?}
 */
export function createIdentifierToken(identifier) {
    return identifierToken(createIdentifier(identifier));
}
/**
 * @param {?} enumType
 * @param {?} name
 * @return {?}
 */
export function createEnumIdentifier(enumType, name) {
    var /** @type {?} */ resolvedEnum = ɵreflector.resolveEnum(resolveIdentifier(enumType), name);
    return { reference: resolvedEnum };
}
//# sourceMappingURL=identifiers.js.map