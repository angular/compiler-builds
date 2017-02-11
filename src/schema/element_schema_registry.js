/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * @abstract
 */
export class ElementSchemaRegistry {
    /**
     * @abstract
     * @param {?} tagName
     * @param {?} propName
     * @param {?} schemaMetas
     * @return {?}
     */
    hasProperty(tagName, propName, schemaMetas) { }
    /**
     * @abstract
     * @param {?} tagName
     * @param {?} schemaMetas
     * @return {?}
     */
    hasElement(tagName, schemaMetas) { }
    /**
     * @abstract
     * @param {?} elementName
     * @param {?} propName
     * @param {?} isAttribute
     * @return {?}
     */
    securityContext(elementName, propName, isAttribute) { }
    /**
     * @abstract
     * @return {?}
     */
    allKnownElementNames() { }
    /**
     * @abstract
     * @param {?} propName
     * @return {?}
     */
    getMappedPropName(propName) { }
    /**
     * @abstract
     * @return {?}
     */
    getDefaultComponentElementName() { }
    /**
     * @abstract
     * @param {?} name
     * @return {?}
     */
    validateProperty(name) { }
    /**
     * @abstract
     * @param {?} name
     * @return {?}
     */
    validateAttribute(name) { }
    /**
     * @abstract
     * @param {?} propName
     * @return {?}
     */
    normalizeAnimationStyleProperty(propName) { }
    /**
     * @abstract
     * @param {?} camelCaseProp
     * @param {?} userProvidedProp
     * @param {?} val
     * @return {?}
     */
    normalizeAnimationStyleValue(camelCaseProp, userProvidedProp, val) { }
}
//# sourceMappingURL=element_schema_registry.js.map