/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AnimationEntryMetadata, ComponentFactory, Injector, OpaqueToken, ViewMetadata } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { Type } from '../src/facade/lang';
/**
 *  @deprecated
 *  Import ComponentFixture from @angular/core/testing instead.
 */
export { ComponentFixture } from '@angular/core/testing';
/**
 * An abstract class for inserting the root test component element in a platform independent way.
 */
export declare class TestComponentRenderer {
    insertRootElement(rootElementId: string): void;
}
export declare var ComponentFixtureAutoDetect: OpaqueToken;
export declare var ComponentFixtureNoNgZone: OpaqueToken;
/**
 * Builds a ComponentFixture for use in component level tests.
 */
export declare class TestComponentBuilder {
    private _injector;
    constructor(_injector: Injector);
    /**
     * Overrides only the html of a {@link ComponentMetadata}.
     * All the other properties of the component's {@link ViewMetadata} are preserved.
     */
    overrideTemplate(componentType: Type, template: string): TestComponentBuilder;
    overrideAnimations(componentType: Type, animations: AnimationEntryMetadata[]): TestComponentBuilder;
    /**
     * Overrides a component's {@link ViewMetadata}.
     */
    overrideView(componentType: Type, view: ViewMetadata): TestComponentBuilder;
    /**
     * Overrides the directives from the component {@link ViewMetadata}.
     */
    overrideDirective(componentType: Type, from: Type, to: Type): TestComponentBuilder;
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
    overrideProviders(type: Type, providers: any[]): TestComponentBuilder;
    /**
     * @deprecated
     */
    overrideBindings(type: Type, providers: any[]): TestComponentBuilder;
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
    overrideViewProviders(type: Type, providers: any[]): TestComponentBuilder;
    /**
     * @deprecated
     */
    overrideViewBindings(type: Type, providers: any[]): TestComponentBuilder;
    private _create<C>(ngZone, componentFactory);
    /**
     * Builds and returns a ComponentFixture.
     */
    createAsync(rootComponentType: Type): Promise<ComponentFixture<any>>;
    createFakeAsync(rootComponentType: Type): ComponentFixture<any>;
    createSync<C>(componentFactory: ComponentFactory<C>): ComponentFixture<C>;
}
