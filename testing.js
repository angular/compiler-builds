/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
__export(require('./testing/schema_registry_mock'));
__export(require('./testing/view_resolver_mock'));
__export(require('./testing/test_component_builder'));
__export(require('./testing/directive_resolver_mock'));
__export(require('./testing/ng_module_resolver_mock'));
var core_1 = require('@angular/core');
var index_1 = require('./index');
var view_resolver_mock_2 = require('./testing/view_resolver_mock');
var directive_resolver_mock_2 = require('./testing/directive_resolver_mock');
var ng_module_resolver_mock_2 = require('./testing/ng_module_resolver_mock');
/**
 * Platform for dynamic tests
 *
 * @experimental
 */
exports.coreDynamicTestingPlatform = core_1.createPlatformFactory(index_1.coreDynamicPlatform, 'coreDynamicTesting', [{
        provide: core_1.CompilerOptions,
        useValue: {
            providers: [
                { provide: index_1.DirectiveResolver, useClass: directive_resolver_mock_2.MockDirectiveResolver },
                { provide: index_1.ViewResolver, useClass: view_resolver_mock_2.MockViewResolver },
                { provide: index_1.NgModuleResolver, useClass: ng_module_resolver_mock_2.MockNgModuleResolver }
            ]
        },
        multi: true
    }]);
//# sourceMappingURL=testing.js.map