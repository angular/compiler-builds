/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var testing_1 = require('@angular/core/testing');
var index_1 = require('../index');
var async_1 = require('../src/facade/async');
var collection_1 = require('../src/facade/collection');
var lang_1 = require('../src/facade/lang');
/**
 *  @deprecated
 *  Import ComponentFixture from @angular/core/testing instead.
 */
var testing_2 = require('@angular/core/testing');
exports.ComponentFixture = testing_2.ComponentFixture;
/**
 * An abstract class for inserting the root test component element in a platform independent way.
 */
var TestComponentRenderer = (function () {
    function TestComponentRenderer() {
    }
    TestComponentRenderer.prototype.insertRootElement = function (rootElementId) { };
    return TestComponentRenderer;
}());
exports.TestComponentRenderer = TestComponentRenderer;
exports.ComponentFixtureAutoDetect = new core_1.OpaqueToken('ComponentFixtureAutoDetect');
exports.ComponentFixtureNoNgZone = new core_1.OpaqueToken('ComponentFixtureNoNgZone');
var _nextRootElementId = 0;
var TestComponentBuilder = (function () {
    function TestComponentBuilder(_injector) {
        this._injector = _injector;
        /** @internal */
        this._bindingsOverrides = new Map();
        /** @internal */
        this._directiveOverrides = new Map();
        /** @internal */
        this._templateOverrides = new Map();
        /** @internal */
        this._animationOverrides = new Map();
        /** @internal */
        this._viewBindingsOverrides = new Map();
        /** @internal */
        this._viewOverrides = new Map();
    }
    /** @internal */
    TestComponentBuilder.prototype._clone = function () {
        var clone = new TestComponentBuilder(this._injector);
        clone._viewOverrides = collection_1.MapWrapper.clone(this._viewOverrides);
        clone._directiveOverrides = collection_1.MapWrapper.clone(this._directiveOverrides);
        clone._templateOverrides = collection_1.MapWrapper.clone(this._templateOverrides);
        clone._bindingsOverrides = collection_1.MapWrapper.clone(this._bindingsOverrides);
        clone._viewBindingsOverrides = collection_1.MapWrapper.clone(this._viewBindingsOverrides);
        return clone;
    };
    /**
     * Overrides only the html of a {@link ComponentMetadata}.
     * All the other properties of the component's {@link ViewMetadata} are preserved.
     */
    TestComponentBuilder.prototype.overrideTemplate = function (componentType, template) {
        var clone = this._clone();
        clone._templateOverrides.set(componentType, template);
        return clone;
    };
    TestComponentBuilder.prototype.overrideAnimations = function (componentType, animations) {
        var clone = this._clone();
        clone._animationOverrides.set(componentType, animations);
        return clone;
    };
    /**
     * Overrides a component's {@link ViewMetadata}.
     */
    TestComponentBuilder.prototype.overrideView = function (componentType, view) {
        var clone = this._clone();
        clone._viewOverrides.set(componentType, view);
        return clone;
    };
    /**
     * Overrides the directives from the component {@link ViewMetadata}.
     */
    TestComponentBuilder.prototype.overrideDirective = function (componentType, from, to) {
        var clone = this._clone();
        var overridesForComponent = clone._directiveOverrides.get(componentType);
        if (!lang_1.isPresent(overridesForComponent)) {
            clone._directiveOverrides.set(componentType, new Map());
            overridesForComponent = clone._directiveOverrides.get(componentType);
        }
        overridesForComponent.set(from, to);
        return clone;
    };
    /**
     * Overrides one or more injectables configured via `providers` metadata property of a directive
     * or
     * component.
     * Very useful when certain providers need to be mocked out.
     *
     * The providers specified via this method are appended to the existing `providers` causing the
     * duplicated providers to
     * be overridden.
     */
    TestComponentBuilder.prototype.overrideProviders = function (type, providers) {
        var clone = this._clone();
        clone._bindingsOverrides.set(type, providers);
        return clone;
    };
    /**
     * @deprecated
     */
    TestComponentBuilder.prototype.overrideBindings = function (type, providers) {
        return this.overrideProviders(type, providers);
    };
    /**
     * Overrides one or more injectables configured via `providers` metadata property of a directive
     * or
     * component.
     * Very useful when certain providers need to be mocked out.
     *
     * The providers specified via this method are appended to the existing `providers` causing the
     * duplicated providers to
     * be overridden.
     */
    TestComponentBuilder.prototype.overrideViewProviders = function (type, providers) {
        var clone = this._clone();
        clone._viewBindingsOverrides.set(type, providers);
        return clone;
    };
    /**
     * @deprecated
     */
    TestComponentBuilder.prototype.overrideViewBindings = function (type, providers) {
        return this.overrideViewProviders(type, providers);
    };
    TestComponentBuilder.prototype._create = function (ngZone, componentFactory) {
        var rootElId = "root" + _nextRootElementId++;
        var testComponentRenderer = this._injector.get(TestComponentRenderer);
        testComponentRenderer.insertRootElement(rootElId);
        var componentRef = componentFactory.create(this._injector, [], "#" + rootElId);
        var autoDetect = this._injector.get(exports.ComponentFixtureAutoDetect, false);
        return new testing_1.ComponentFixture(componentRef, ngZone, autoDetect);
    };
    /**
     * Builds and returns a ComponentFixture.
     */
    TestComponentBuilder.prototype.createAsync = function (rootComponentType) {
        var _this = this;
        var noNgZone = lang_1.IS_DART || this._injector.get(exports.ComponentFixtureNoNgZone, false);
        var ngZone = noNgZone ? null : this._injector.get(core_1.NgZone, null);
        var initComponent = function () {
            var mockDirectiveResolver = _this._injector.get(index_1.DirectiveResolver);
            var mockViewResolver = _this._injector.get(index_1.ViewResolver);
            _this._viewOverrides.forEach(function (view, type) { return mockViewResolver.setView(type, view); });
            _this._templateOverrides.forEach(function (template, type) { return mockViewResolver.setInlineTemplate(type, template); });
            _this._animationOverrides.forEach(function (animationsEntry, type) { return mockViewResolver.setAnimations(type, animationsEntry); });
            _this._directiveOverrides.forEach(function (overrides, component) {
                overrides.forEach(function (to, from) { mockViewResolver.overrideViewDirective(component, from, to); });
            });
            _this._bindingsOverrides.forEach(function (bindings, type) { return mockDirectiveResolver.setProvidersOverride(type, bindings); });
            _this._viewBindingsOverrides.forEach(function (bindings, type) { return mockDirectiveResolver.setViewProvidersOverride(type, bindings); });
            var promise = _this._injector.get(core_1.ComponentResolver).resolveComponent(rootComponentType);
            return promise.then(function (componentFactory) { return _this._create(ngZone, componentFactory); });
        };
        return ngZone == null ? initComponent() : ngZone.run(initComponent);
    };
    TestComponentBuilder.prototype.createFakeAsync = function (rootComponentType) {
        var result;
        var error;
        async_1.PromiseWrapper.then(this.createAsync(rootComponentType), function (_result) { result = _result; }, function (_error) { error = _error; });
        testing_1.tick();
        if (lang_1.isPresent(error)) {
            throw error;
        }
        return result;
    };
    TestComponentBuilder.prototype.createSync = function (componentFactory) {
        var _this = this;
        var noNgZone = lang_1.IS_DART || this._injector.get(exports.ComponentFixtureNoNgZone, false);
        var ngZone = noNgZone ? null : this._injector.get(core_1.NgZone, null);
        var initComponent = function () { return _this._create(ngZone, componentFactory); };
        return ngZone == null ? initComponent() : ngZone.run(initComponent);
    };
    /** @nocollapse */
    TestComponentBuilder.decorators = [
        { type: core_1.Injectable },
    ];
    /** @nocollapse */
    TestComponentBuilder.ctorParameters = [
        { type: core_1.Injector, },
    ];
    return TestComponentBuilder;
}());
exports.TestComponentBuilder = TestComponentBuilder;
//# sourceMappingURL=test_component_builder.js.map