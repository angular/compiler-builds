/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AnimationEntryMetadata, Injector, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ViewMetadata } from '../core_private';
import { TestComponentBuilder } from '../core_private_testing';
/**
 * A TestComponentBuilder that allows overriding based on the compiler.
 *
 * @deprecated Use `TestBed.configureTestModule` / `TestBed.override...` / `TestBed.createComponent`
 * instead.
*/
export declare class OverridingTestComponentBuilder extends TestComponentBuilder {
    constructor(injector: Injector);
    overrideTemplate(componentType: Type<any>, template: string): OverridingTestComponentBuilder;
    overrideAnimations(componentType: Type<any>, animations: AnimationEntryMetadata[]): TestComponentBuilder;
    overrideView(componentType: Type<any>, view: ViewMetadata): OverridingTestComponentBuilder;
    overrideDirective(componentType: Type<any>, from: Type<any>, to: Type<any>): OverridingTestComponentBuilder;
    overrideProviders(type: Type<any>, providers: any[]): OverridingTestComponentBuilder;
    overrideViewProviders(type: Type<any>, providers: any[]): OverridingTestComponentBuilder;
    createAsync<T>(rootComponentType: Type<T>): Promise<ComponentFixture<T>>;
    createSync<T>(rootComponentType: Type<T>): ComponentFixture<T>;
    private _applyMetadataOverrides();
}
