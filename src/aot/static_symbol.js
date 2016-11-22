/**
 * @license undefined
  * Copyright Google Inc. All Rights Reserved.
  * *
  * Use of this source code is governed by an MIT-style license that can be
  * found in the LICENSE file at https://angular.io/license
 * @param {?} value
 * @return {?}
 */
export function isStaticSymbol(value) {
    return typeof value === 'object' && value !== null && value['name'] && value['filePath'];
}
/**
 *  A token representing the a reference to a static type.
  * *
  * This token is unique for a filePath and name and can be used as a hash table key.
 */
export var StaticSymbol = (function () {
    /**
     * @param {?} filePath
     * @param {?} name
     * @param {?=} members
     */
    function StaticSymbol(filePath, name, members) {
        this.filePath = filePath;
        this.name = name;
        this.members = members;
    }
    return StaticSymbol;
}());
function StaticSymbol_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticSymbol.prototype.filePath;
    /** @type {?} */
    StaticSymbol.prototype.name;
    /** @type {?} */
    StaticSymbol.prototype.members;
}
//# sourceMappingURL=static_symbol.js.map