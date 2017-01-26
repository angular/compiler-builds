/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isPresent } from '../facade/lang';
export class StylesCollectionEntry {
    /**
     * @param {?} time
     * @param {?} value
     */
    constructor(time, value) {
        this.time = time;
        this.value = value;
    }
    /**
     * @param {?} time
     * @param {?} value
     * @return {?}
     */
    matches(time, value) {
        return time == this.time && value == this.value;
    }
}
function StylesCollectionEntry_tsickle_Closure_declarations() {
    /** @type {?} */
    StylesCollectionEntry.prototype.time;
    /** @type {?} */
    StylesCollectionEntry.prototype.value;
}
export class StylesCollection {
    constructor() {
        this.styles = {};
    }
    /**
     * @param {?} property
     * @param {?} time
     * @param {?} value
     * @return {?}
     */
    insertAtTime(property, time, value) {
        const /** @type {?} */ tuple = new StylesCollectionEntry(time, value);
        let /** @type {?} */ entries = this.styles[property];
        if (!isPresent(entries)) {
            entries = this.styles[property] = [];
        }
        // insert this at the right stop in the array
        // this way we can keep it sorted
        let /** @type {?} */ insertionIndex = 0;
        for (let /** @type {?} */ i = entries.length - 1; i >= 0; i--) {
            if (entries[i].time <= time) {
                insertionIndex = i + 1;
                break;
            }
        }
        entries.splice(insertionIndex, 0, tuple);
    }
    /**
     * @param {?} property
     * @param {?} index
     * @return {?}
     */
    getByIndex(property, index) {
        const /** @type {?} */ items = this.styles[property];
        if (isPresent(items)) {
            return index >= items.length ? null : items[index];
        }
        return null;
    }
    /**
     * @param {?} property
     * @param {?} time
     * @return {?}
     */
    indexOfAtOrBeforeTime(property, time) {
        const /** @type {?} */ entries = this.styles[property];
        if (isPresent(entries)) {
            for (let /** @type {?} */ i = entries.length - 1; i >= 0; i--) {
                if (entries[i].time <= time)
                    return i;
            }
        }
        return null;
    }
}
function StylesCollection_tsickle_Closure_declarations() {
    /** @type {?} */
    StylesCollection.prototype.styles;
}
//# sourceMappingURL=styles_collection.js.map