/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '@angular/core';
export class MockSchemaRegistry {
    constructor(existingProperties, attrPropMapping, existingElements, invalidProperties, invalidAttributes) {
        this.existingProperties = existingProperties;
        this.attrPropMapping = attrPropMapping;
        this.existingElements = existingElements;
        this.invalidProperties = invalidProperties;
        this.invalidAttributes = invalidAttributes;
    }
    hasProperty(tagName, property, schemas) {
        const value = this.existingProperties[property];
        return value === void 0 ? true : value;
    }
    hasElement(tagName, schemaMetas) {
        const value = this.existingElements[tagName.toLowerCase()];
        return value === void 0 ? true : value;
    }
    allKnownElementNames() { return Object.keys(this.existingElements); }
    securityContext(selector, property, isAttribute) {
        return SecurityContext.NONE;
    }
    getMappedPropName(attrName) { return this.attrPropMapping[attrName] || attrName; }
    getDefaultComponentElementName() { return 'ng-component'; }
    validateProperty(name) {
        if (this.invalidProperties.indexOf(name) > -1) {
            return { error: true, msg: `Binding to property '${name}' is disallowed for security reasons` };
        }
        else {
            return { error: false };
        }
    }
    validateAttribute(name) {
        if (this.invalidAttributes.indexOf(name) > -1) {
            return {
                error: true,
                msg: `Binding to attribute '${name}' is disallowed for security reasons`
            };
        }
        else {
            return { error: false };
        }
    }
    normalizeAnimationStyleProperty(propName) { return propName; }
    normalizeAnimationStyleValue(camelCaseProp, userProvidedProp, val) {
        return { error: null, value: val.toString() };
    }
}
//# sourceMappingURL=schema_registry_mock.js.map