/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var core_private_1 = require('../core_private');
var compile_metadata_1 = require('./compile_metadata');
var util_1 = require('./util');
var APP_VIEW_MODULE_URL = util_1.assetUrl('core', 'linker/view');
var VIEW_UTILS_MODULE_URL = util_1.assetUrl('core', 'linker/view_utils');
var CD_MODULE_URL = util_1.assetUrl('core', 'change_detection/change_detection');
var ANIMATION_STYLE_UTIL_ASSET_URL = util_1.assetUrl('core', 'animation/animation_style_util');
var Identifiers = (function () {
    function Identifiers() {
    }
    Identifiers.ANALYZE_FOR_ENTRY_COMPONENTS = {
        name: 'ANALYZE_FOR_ENTRY_COMPONENTS',
        moduleUrl: util_1.assetUrl('core', 'metadata/di'),
        runtime: core_1.ANALYZE_FOR_ENTRY_COMPONENTS
    };
    Identifiers.ViewUtils = {
        name: 'ViewUtils',
        moduleUrl: util_1.assetUrl('core', 'linker/view_utils'),
        runtime: core_private_1.ViewUtils
    };
    Identifiers.AppView = { name: 'AppView', moduleUrl: APP_VIEW_MODULE_URL, runtime: core_private_1.AppView };
    Identifiers.DebugAppView = {
        name: 'DebugAppView',
        moduleUrl: APP_VIEW_MODULE_URL,
        runtime: core_private_1.DebugAppView
    };
    Identifiers.AppElement = {
        name: 'AppElement',
        moduleUrl: util_1.assetUrl('core', 'linker/element'),
        runtime: core_private_1.AppElement
    };
    Identifiers.ElementRef = {
        name: 'ElementRef',
        moduleUrl: util_1.assetUrl('core', 'linker/element_ref'),
        runtime: core_1.ElementRef
    };
    Identifiers.ViewContainerRef = {
        name: 'ViewContainerRef',
        moduleUrl: util_1.assetUrl('core', 'linker/view_container_ref'),
        runtime: core_1.ViewContainerRef
    };
    Identifiers.ChangeDetectorRef = {
        name: 'ChangeDetectorRef',
        moduleUrl: util_1.assetUrl('core', 'change_detection/change_detector_ref'),
        runtime: core_1.ChangeDetectorRef
    };
    Identifiers.RenderComponentType = {
        name: 'RenderComponentType',
        moduleUrl: util_1.assetUrl('core', 'render/api'),
        runtime: core_1.RenderComponentType
    };
    Identifiers.QueryList = {
        name: 'QueryList',
        moduleUrl: util_1.assetUrl('core', 'linker/query_list'),
        runtime: core_1.QueryList
    };
    Identifiers.TemplateRef = {
        name: 'TemplateRef',
        moduleUrl: util_1.assetUrl('core', 'linker/template_ref'),
        runtime: core_1.TemplateRef
    };
    Identifiers.TemplateRef_ = {
        name: 'TemplateRef_',
        moduleUrl: util_1.assetUrl('core', 'linker/template_ref'),
        runtime: core_private_1.TemplateRef_
    };
    Identifiers.CodegenComponentFactoryResolver = {
        name: 'CodegenComponentFactoryResolver',
        moduleUrl: util_1.assetUrl('core', 'linker/component_factory_resolver'),
        runtime: core_private_1.CodegenComponentFactoryResolver
    };
    Identifiers.ComponentFactoryResolver = {
        name: 'ComponentFactoryResolver',
        moduleUrl: util_1.assetUrl('core', 'linker/component_factory_resolver'),
        runtime: core_1.ComponentFactoryResolver
    };
    Identifiers.ComponentFactory = {
        name: 'ComponentFactory',
        runtime: core_1.ComponentFactory,
        moduleUrl: util_1.assetUrl('core', 'linker/component_factory')
    };
    Identifiers.NgModuleFactory = {
        name: 'NgModuleFactory',
        runtime: core_1.NgModuleFactory,
        moduleUrl: util_1.assetUrl('core', 'linker/ng_module_factory')
    };
    Identifiers.NgModuleInjector = {
        name: 'NgModuleInjector',
        runtime: core_private_1.NgModuleInjector,
        moduleUrl: util_1.assetUrl('core', 'linker/ng_module_factory')
    };
    Identifiers.ValueUnwrapper = { name: 'ValueUnwrapper', moduleUrl: CD_MODULE_URL, runtime: core_private_1.ValueUnwrapper };
    Identifiers.Injector = {
        name: 'Injector',
        moduleUrl: util_1.assetUrl('core', 'di/injector'),
        runtime: core_1.Injector
    };
    Identifiers.ViewEncapsulation = {
        name: 'ViewEncapsulation',
        moduleUrl: util_1.assetUrl('core', 'metadata/view'),
        runtime: core_1.ViewEncapsulation
    };
    Identifiers.ViewType = {
        name: 'ViewType',
        moduleUrl: util_1.assetUrl('core', 'linker/view_type'),
        runtime: core_private_1.ViewType
    };
    Identifiers.ChangeDetectionStrategy = {
        name: 'ChangeDetectionStrategy',
        moduleUrl: CD_MODULE_URL,
        runtime: core_1.ChangeDetectionStrategy
    };
    Identifiers.StaticNodeDebugInfo = {
        name: 'StaticNodeDebugInfo',
        moduleUrl: util_1.assetUrl('core', 'linker/debug_context'),
        runtime: core_private_1.StaticNodeDebugInfo
    };
    Identifiers.DebugContext = {
        name: 'DebugContext',
        moduleUrl: util_1.assetUrl('core', 'linker/debug_context'),
        runtime: core_private_1.DebugContext
    };
    Identifiers.Renderer = {
        name: 'Renderer',
        moduleUrl: util_1.assetUrl('core', 'render/api'),
        runtime: core_1.Renderer
    };
    Identifiers.SimpleChange = { name: 'SimpleChange', moduleUrl: CD_MODULE_URL, runtime: core_1.SimpleChange };
    Identifiers.UNINITIALIZED = { name: 'UNINITIALIZED', moduleUrl: CD_MODULE_URL, runtime: core_private_1.UNINITIALIZED };
    Identifiers.ChangeDetectorStatus = {
        name: 'ChangeDetectorStatus',
        moduleUrl: CD_MODULE_URL,
        runtime: core_private_1.ChangeDetectorStatus
    };
    Identifiers.checkBinding = {
        name: 'checkBinding',
        moduleUrl: VIEW_UTILS_MODULE_URL,
        runtime: core_private_1.checkBinding
    };
    Identifiers.flattenNestedViewRenderNodes = {
        name: 'flattenNestedViewRenderNodes',
        moduleUrl: VIEW_UTILS_MODULE_URL,
        runtime: core_private_1.flattenNestedViewRenderNodes
    };
    Identifiers.devModeEqual = { name: 'devModeEqual', moduleUrl: CD_MODULE_URL, runtime: core_private_1.devModeEqual };
    Identifiers.interpolate = {
        name: 'interpolate',
        moduleUrl: VIEW_UTILS_MODULE_URL,
        runtime: core_private_1.interpolate
    };
    Identifiers.castByValue = {
        name: 'castByValue',
        moduleUrl: VIEW_UTILS_MODULE_URL,
        runtime: core_private_1.castByValue
    };
    Identifiers.EMPTY_ARRAY = {
        name: 'EMPTY_ARRAY',
        moduleUrl: VIEW_UTILS_MODULE_URL,
        runtime: core_private_1.EMPTY_ARRAY
    };
    Identifiers.EMPTY_MAP = { name: 'EMPTY_MAP', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.EMPTY_MAP };
    Identifiers.pureProxies = [
        null,
        { name: 'pureProxy1', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy1 },
        { name: 'pureProxy2', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy2 },
        { name: 'pureProxy3', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy3 },
        { name: 'pureProxy4', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy4 },
        { name: 'pureProxy5', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy5 },
        { name: 'pureProxy6', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy6 },
        { name: 'pureProxy7', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy7 },
        { name: 'pureProxy8', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy8 },
        { name: 'pureProxy9', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy9 },
        { name: 'pureProxy10', moduleUrl: VIEW_UTILS_MODULE_URL, runtime: core_private_1.pureProxy10 },
    ];
    Identifiers.SecurityContext = {
        name: 'SecurityContext',
        moduleUrl: util_1.assetUrl('core', 'security'),
        runtime: core_1.SecurityContext,
    };
    Identifiers.AnimationKeyframe = {
        name: 'AnimationKeyframe',
        moduleUrl: util_1.assetUrl('core', 'animation/animation_keyframe'),
        runtime: core_private_1.AnimationKeyframe
    };
    Identifiers.AnimationStyles = {
        name: 'AnimationStyles',
        moduleUrl: util_1.assetUrl('core', 'animation/animation_styles'),
        runtime: core_private_1.AnimationStyles
    };
    Identifiers.NoOpAnimationPlayer = {
        name: 'NoOpAnimationPlayer',
        moduleUrl: util_1.assetUrl('core', 'animation/animation_player'),
        runtime: core_private_1.NoOpAnimationPlayer
    };
    Identifiers.AnimationGroupPlayer = {
        name: 'AnimationGroupPlayer',
        moduleUrl: util_1.assetUrl('core', 'animation/animation_group_player'),
        runtime: core_private_1.AnimationGroupPlayer
    };
    Identifiers.AnimationSequencePlayer = {
        name: 'AnimationSequencePlayer',
        moduleUrl: util_1.assetUrl('core', 'animation/animation_sequence_player'),
        runtime: core_private_1.AnimationSequencePlayer
    };
    Identifiers.prepareFinalAnimationStyles = {
        name: 'prepareFinalAnimationStyles',
        moduleUrl: ANIMATION_STYLE_UTIL_ASSET_URL,
        runtime: core_private_1.prepareFinalAnimationStyles
    };
    Identifiers.balanceAnimationKeyframes = {
        name: 'balanceAnimationKeyframes',
        moduleUrl: ANIMATION_STYLE_UTIL_ASSET_URL,
        runtime: core_private_1.balanceAnimationKeyframes
    };
    Identifiers.clearStyles = {
        name: 'clearStyles',
        moduleUrl: ANIMATION_STYLE_UTIL_ASSET_URL,
        runtime: core_private_1.clearStyles
    };
    Identifiers.renderStyles = {
        name: 'renderStyles',
        moduleUrl: ANIMATION_STYLE_UTIL_ASSET_URL,
        runtime: core_private_1.renderStyles
    };
    Identifiers.collectAndResolveStyles = {
        name: 'collectAndResolveStyles',
        moduleUrl: ANIMATION_STYLE_UTIL_ASSET_URL,
        runtime: core_private_1.collectAndResolveStyles
    };
    Identifiers.LOCALE_ID = {
        name: 'LOCALE_ID',
        moduleUrl: util_1.assetUrl('core', 'i18n/tokens'),
        runtime: core_1.LOCALE_ID
    };
    Identifiers.TRANSLATIONS_FORMAT = {
        name: 'TRANSLATIONS_FORMAT',
        moduleUrl: util_1.assetUrl('core', 'i18n/tokens'),
        runtime: core_1.TRANSLATIONS_FORMAT
    };
    Identifiers.AnimationOutput = {
        name: 'AnimationOutput',
        moduleUrl: util_1.assetUrl('core', 'animation/animation_output'),
        runtime: core_private_1.AnimationOutput
    };
    return Identifiers;
}());
exports.Identifiers = Identifiers;
function resolveIdentifier(identifier) {
    return new compile_metadata_1.CompileIdentifierMetadata({
        name: identifier.name,
        moduleUrl: identifier.moduleUrl,
        reference: core_private_1.reflector.resolveIdentifier(identifier.name, identifier.moduleUrl, identifier.runtime)
    });
}
exports.resolveIdentifier = resolveIdentifier;
function identifierToken(identifier) {
    return new compile_metadata_1.CompileTokenMetadata({ identifier: identifier });
}
exports.identifierToken = identifierToken;
function resolveIdentifierToken(identifier) {
    return identifierToken(resolveIdentifier(identifier));
}
exports.resolveIdentifierToken = resolveIdentifierToken;
function resolveEnumIdentifier(enumType, name) {
    var resolvedEnum = core_private_1.reflector.resolveEnum(enumType.reference, name);
    return new compile_metadata_1.CompileIdentifierMetadata({ name: enumType.name + "." + name, moduleUrl: enumType.moduleUrl, reference: resolvedEnum });
}
exports.resolveEnumIdentifier = resolveEnumIdentifier;
//# sourceMappingURL=identifiers.js.map