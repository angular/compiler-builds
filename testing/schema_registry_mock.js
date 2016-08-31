/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '@angular/core';
import { isPresent } from './facade/lang';
export var MockSchemaRegistry = (function () {
    function MockSchemaRegistry(existingProperties, attrPropMapping) {
        this.existingProperties = existingProperties;
        this.attrPropMapping = attrPropMapping;
    }
    MockSchemaRegistry.prototype.hasProperty = function (tagName, property, schemas) {
        var result = this.existingProperties[property];
        return isPresent(result) ? result : true;
    };
    MockSchemaRegistry.prototype.securityContext = function (tagName, property) {
        return SecurityContext.NONE;
    };
    MockSchemaRegistry.prototype.getMappedPropName = function (attrName) {
        var result = this.attrPropMapping[attrName];
        return isPresent(result) ? result : attrName;
    };
    MockSchemaRegistry.prototype.getDefaultComponentElementName = function () { return 'ng-component'; };
    return MockSchemaRegistry;
}());
//# sourceMappingURL=schema_registry_mock.js.map