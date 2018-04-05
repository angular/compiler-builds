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
/**
 * A token representing the a reference to a static type.
 *
 * This token is unique for a filePath and name and can be used as a hash table key.
 */
var /**
 * A token representing the a reference to a static type.
 *
 * This token is unique for a filePath and name and can be used as a hash table key.
 */
StaticSymbol = /** @class */ (function () {
    function StaticSymbol(filePath, name, members) {
        this.filePath = filePath;
        this.name = name;
        this.members = members;
    }
    /**
     * @return {?}
     */
    StaticSymbol.prototype.assertNoMembers = /**
     * @return {?}
     */
    function () {
        if (this.members.length) {
            throw new Error("Illegal state: symbol without members expected, but got " + JSON.stringify(this) + ".");
        }
    };
    return StaticSymbol;
}());
/**
 * A token representing the a reference to a static type.
 *
 * This token is unique for a filePath and name and can be used as a hash table key.
 */
export { StaticSymbol };
function StaticSymbol_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticSymbol.prototype.filePath;
    /** @type {?} */
    StaticSymbol.prototype.name;
    /** @type {?} */
    StaticSymbol.prototype.members;
}
/**
 * A cache of static symbol used by the StaticReflector to return the same symbol for the
 * same symbol values.
 */
var /**
 * A cache of static symbol used by the StaticReflector to return the same symbol for the
 * same symbol values.
 */
StaticSymbolCache = /** @class */ (function () {
    function StaticSymbolCache() {
        this.cache = new Map();
    }
    /**
     * @param {?} declarationFile
     * @param {?} name
     * @param {?=} members
     * @return {?}
     */
    StaticSymbolCache.prototype.get = /**
     * @param {?} declarationFile
     * @param {?} name
     * @param {?=} members
     * @return {?}
     */
    function (declarationFile, name, members) {
        members = members || [];
        var /** @type {?} */ memberSuffix = members.length ? "." + members.join('.') : '';
        var /** @type {?} */ key = "\"" + declarationFile + "\"." + name + memberSuffix;
        var /** @type {?} */ result = this.cache.get(key);
        if (!result) {
            result = new StaticSymbol(declarationFile, name, members);
            this.cache.set(key, result);
        }
        return result;
    };
    return StaticSymbolCache;
}());
/**
 * A cache of static symbol used by the StaticReflector to return the same symbol for the
 * same symbol values.
 */
export { StaticSymbolCache };
function StaticSymbolCache_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticSymbolCache.prototype.cache;
}
//# sourceMappingURL=static_symbol.js.map