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
import { NgModuleResolver } from '@angular/compiler';
export class MockNgModuleResolver extends NgModuleResolver {
    /**
     * @param {?} reflector
     */
    constructor(reflector) {
        super(reflector);
        this._ngModules = new Map();
    }
    /**
     * Overrides the {\@link NgModule} for a module.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    setNgModule(type, metadata) {
        this._ngModules.set(type, metadata);
    }
    /**
     * Returns the {\@link NgModule} for a module:
     * - Set the {\@link NgModule} to the overridden view when it exists or fallback to the
     * default
     * `NgModuleResolver`, see `setNgModule`.
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    resolve(type, throwIfNotFound = true) {
        return this._ngModules.get(type) || /** @type {?} */ ((super.resolve(type, throwIfNotFound)));
    }
}
function MockNgModuleResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    MockNgModuleResolver.prototype._ngModules;
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlX3Jlc29sdmVyX21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9uZ19tb2R1bGVfcmVzb2x2ZXJfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVFBLE9BQU8sRUFBbUIsZ0JBQWdCLEVBQU8sTUFBTSxtQkFBbUIsQ0FBQztBQUUzRSxNQUFNLDJCQUE0QixTQUFRLGdCQUFnQjs7OztJQUd4RCxZQUFZLFNBQTJCO1FBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDOzBCQUZ2QyxJQUFJLEdBQUcsRUFBNEI7S0FFTTs7Ozs7OztJQUs5RCxXQUFXLENBQUMsSUFBZSxFQUFFLFFBQXVCO1FBQ2xELElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztLQUNyQzs7Ozs7Ozs7OztJQVFELE9BQU8sQ0FBQyxJQUFlLEVBQUUsZUFBZSxHQUFHLElBQUk7UUFDN0MsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsdUJBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLEVBQUUsQ0FBQztLQUM1RTtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3IsIE5nTW9kdWxlUmVzb2x2ZXIsIGNvcmV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcblxuZXhwb3J0IGNsYXNzIE1vY2tOZ01vZHVsZVJlc29sdmVyIGV4dGVuZHMgTmdNb2R1bGVSZXNvbHZlciB7XG4gIHByaXZhdGUgX25nTW9kdWxlcyA9IG5ldyBNYXA8Y29yZS5UeXBlLCBjb3JlLk5nTW9kdWxlPigpO1xuXG4gIGNvbnN0cnVjdG9yKHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcikgeyBzdXBlcihyZWZsZWN0b3IpOyB9XG5cbiAgLyoqXG4gICAqIE92ZXJyaWRlcyB0aGUge0BsaW5rIE5nTW9kdWxlfSBmb3IgYSBtb2R1bGUuXG4gICAqL1xuICBzZXROZ01vZHVsZSh0eXBlOiBjb3JlLlR5cGUsIG1ldGFkYXRhOiBjb3JlLk5nTW9kdWxlKTogdm9pZCB7XG4gICAgdGhpcy5fbmdNb2R1bGVzLnNldCh0eXBlLCBtZXRhZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUge0BsaW5rIE5nTW9kdWxlfSBmb3IgYSBtb2R1bGU6XG4gICAqIC0gU2V0IHRoZSB7QGxpbmsgTmdNb2R1bGV9IHRvIHRoZSBvdmVycmlkZGVuIHZpZXcgd2hlbiBpdCBleGlzdHMgb3IgZmFsbGJhY2sgdG8gdGhlXG4gICAqIGRlZmF1bHRcbiAgICogYE5nTW9kdWxlUmVzb2x2ZXJgLCBzZWUgYHNldE5nTW9kdWxlYC5cbiAgICovXG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlLCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTogY29yZS5OZ01vZHVsZSB7XG4gICAgcmV0dXJuIHRoaXMuX25nTW9kdWxlcy5nZXQodHlwZSkgfHwgc3VwZXIucmVzb2x2ZSh0eXBlLCB0aHJvd0lmTm90Rm91bmQpICE7XG4gIH1cbn1cbiJdfQ==