/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export * from './testing/schema_registry_mock';
export * from './testing/view_resolver_mock';
export * from './testing/test_component_builder';
export * from './testing/directive_resolver_mock';
export * from './testing/ng_module_resolver_mock';
import { PlatformRef } from '@angular/core';
/**
 * Platform for dynamic tests
 *
 * @experimental
 */
export declare const coreDynamicTestingPlatform: (extraProviders?: any[]) => PlatformRef;
