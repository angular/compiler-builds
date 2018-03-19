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
import * as tslib_1 from "tslib";
import * as i18n from '../i18n_ast';
/**
 * @abstract
 */
var /**
 * @abstract
 */
Serializer = /** @class */ (function () {
    function Serializer() {
    }
    // Creates a name mapper, see `PlaceholderMapper`
    // Returning `null` means that no name mapping is used.
    /**
     * @param {?} message
     * @return {?}
     */
    Serializer.prototype.createNameMapper = /**
     * @param {?} message
     * @return {?}
     */
    function (message) { return null; };
    return Serializer;
}());
/**
 * @abstract
 */
export { Serializer };
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
var /**
 * A simple mapper that take a function to transform an internal name to a public name
 */
SimplePlaceholderMapper = /** @class */ (function (_super) {
    tslib_1.__extends(SimplePlaceholderMapper, _super);
    // create a mapping from the message
    function SimplePlaceholderMapper(message, mapName) {
        var _this = _super.call(this) || this;
        _this.mapName = mapName;
        _this.internalToPublic = {};
        _this.publicToNextId = {};
        _this.publicToInternal = {};
        message.nodes.forEach(function (node) { return node.visit(_this); });
        return _this;
    }
    /**
     * @param {?} internalName
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.toPublicName = /**
     * @param {?} internalName
     * @return {?}
     */
    function (internalName) {
        return this.internalToPublic.hasOwnProperty(internalName) ?
            this.internalToPublic[internalName] :
            null;
    };
    /**
     * @param {?} publicName
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.toInternalName = /**
     * @param {?} publicName
     * @return {?}
     */
    function (publicName) {
        return this.publicToInternal.hasOwnProperty(publicName) ? this.publicToInternal[publicName] :
            null;
    };
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.visitText = /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    function (text, context) { return null; };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.visitTagPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        this.visitPlaceholderName(ph.startName);
        _super.prototype.visitTagPlaceholder.call(this, ph, context);
        this.visitPlaceholderName(ph.closeName);
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.visitPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) { this.visitPlaceholderName(ph.name); };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.visitIcuPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        this.visitPlaceholderName(ph.name);
    };
    /**
     * @param {?} internalName
     * @return {?}
     */
    SimplePlaceholderMapper.prototype.visitPlaceholderName = /**
     * @param {?} internalName
     * @return {?}
     */
    function (internalName) {
        if (!internalName || this.internalToPublic.hasOwnProperty(internalName)) {
            return;
        }
        var /** @type {?} */ publicName = this.mapName(internalName);
        if (this.publicToInternal.hasOwnProperty(publicName)) {
            // Create a new XMB when it has already been used
            var /** @type {?} */ nextId = this.publicToNextId[publicName];
            this.publicToNextId[publicName] = nextId + 1;
            publicName = publicName + "_" + nextId;
        }
        else {
            this.publicToNextId[publicName] = 1;
        }
        this.internalToPublic[internalName] = publicName;
        this.publicToInternal[publicName] = internalName;
    };
    return SimplePlaceholderMapper;
}(i18n.RecurseVisitor));
/**
 * A simple mapper that take a function to transform an internal name to a public name
 */
export { SimplePlaceholderMapper };
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