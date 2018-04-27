/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../i18n_ast';
/**
 * @abstract
 */
export class Serializer {
    /**
     * @param {?} message
     * @return {?}
     */
    createNameMapper(message) { return null; }
}
function Serializer_tsickle_Closure_declarations() {
    /**
     * @abstract
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    Serializer.prototype.write = function (messages, locale) { };
    /**
     * @abstract
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    Serializer.prototype.load = function (content, url) { };
    /**
     * @abstract
     * @param {?} message
     * @return {?}
     */
    Serializer.prototype.digest = function (message) { };
}
/**
 * A `PlaceholderMapper` converts placeholder names from internal to serialized representation and
 * back.
 *
 * It should be used for serialization format that put constraints on the placeholder names.
 * @record
 */
export function PlaceholderMapper() { }
function PlaceholderMapper_tsickle_Closure_declarations() {
    /** @type {?} */
    PlaceholderMapper.prototype.toPublicName;
    /** @type {?} */
    PlaceholderMapper.prototype.toInternalName;
}
/**
 * A simple mapper that take a function to transform an internal name to a public name
 */
export class SimplePlaceholderMapper extends i18n.RecurseVisitor {
    /**
     * @param {?} message
     * @param {?} mapName
     */
    constructor(message, mapName) {
        super();
        this.mapName = mapName;
        this.internalToPublic = {};
        this.publicToNextId = {};
        this.publicToInternal = {};
        message.nodes.forEach(node => node.visit(this));
    }
    /**
     * @param {?} internalName
     * @return {?}
     */
    toPublicName(internalName) {
        return this.internalToPublic.hasOwnProperty(internalName) ?
            this.internalToPublic[internalName] :
            null;
    }
    /**
     * @param {?} publicName
     * @return {?}
     */
    toInternalName(publicName) {
        return this.publicToInternal.hasOwnProperty(publicName) ? this.publicToInternal[publicName] :
            null;
    }
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    visitText(text, context) { return null; }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitTagPlaceholder(ph, context) {
        this.visitPlaceholderName(ph.startName);
        super.visitTagPlaceholder(ph, context);
        this.visitPlaceholderName(ph.closeName);
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) { this.visitPlaceholderName(ph.name); }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) {
        this.visitPlaceholderName(ph.name);
    }
    /**
     * @param {?} internalName
     * @return {?}
     */
    visitPlaceholderName(internalName) {
        if (!internalName || this.internalToPublic.hasOwnProperty(internalName)) {
            return;
        }
        let /** @type {?} */ publicName = this.mapName(internalName);
        if (this.publicToInternal.hasOwnProperty(publicName)) {
            // Create a new XMB when it has already been used
            const /** @type {?} */ nextId = this.publicToNextId[publicName];
            this.publicToNextId[publicName] = nextId + 1;
            publicName = `${publicName}_${nextId}`;
        }
        else {
            this.publicToNextId[publicName] = 1;
        }
        this.internalToPublic[internalName] = publicName;
        this.publicToInternal[publicName] = internalName;
    }
}
function SimplePlaceholderMapper_tsickle_Closure_declarations() {
    /** @type {?} */
    SimplePlaceholderMapper.prototype.internalToPublic;
    /** @type {?} */
    SimplePlaceholderMapper.prototype.publicToNextId;
    /** @type {?} */
    SimplePlaceholderMapper.prototype.publicToInternal;
    /** @type {?} */
    SimplePlaceholderMapper.prototype.mapName;
}
//# sourceMappingURL=serializer.js.map