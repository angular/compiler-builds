/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createNgModule } from './core';
import { findLast } from './directive_resolver';
import { stringify } from './util';
/**
 * Resolves types to {@link NgModule}.
 */
export class NgModuleResolver {
    constructor(_reflector) {
        this._reflector = _reflector;
    }
    isNgModule(type) { return this._reflector.annotations(type).some(createNgModule.isTypeOf); }
    resolve(type, throwIfNotFound = true) {
        const ngModuleMeta = findLast(this._reflector.annotations(type), createNgModule.isTypeOf);
        if (ngModuleMeta) {
            return ngModuleMeta;
        }
        else {
            if (throwIfNotFound) {
                throw new Error(`No NgModule metadata found for '${stringify(type)}'.`);
            }
            return null;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlX3Jlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL25nX21vZHVsZV9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQWlCLGNBQWMsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUN0RCxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDOUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUlqQzs7R0FFRztBQUNILE1BQU0sT0FBTyxnQkFBZ0I7SUFDM0IsWUFBb0IsVUFBNEI7UUFBNUIsZUFBVSxHQUFWLFVBQVUsQ0FBa0I7SUFBRyxDQUFDO0lBRXBELFVBQVUsQ0FBQyxJQUFTLElBQUksT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVqRyxPQUFPLENBQUMsSUFBVSxFQUFFLGVBQWUsR0FBRyxJQUFJO1FBQ3hDLE1BQU0sWUFBWSxHQUNkLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFekUsSUFBSSxZQUFZLEVBQUU7WUFDaEIsT0FBTyxZQUFZLENBQUM7U0FDckI7YUFBTTtZQUNMLElBQUksZUFBZSxFQUFFO2dCQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3pFO1lBQ0QsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7TmdNb2R1bGUsIFR5cGUsIGNyZWF0ZU5nTW9kdWxlfSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtmaW5kTGFzdH0gZnJvbSAnLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuaW1wb3J0IHtzdHJpbmdpZnl9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vKipcbiAqIFJlc29sdmVzIHR5cGVzIHRvIHtAbGluayBOZ01vZHVsZX0uXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ01vZHVsZVJlc29sdmVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7fVxuXG4gIGlzTmdNb2R1bGUodHlwZTogYW55KSB7IHJldHVybiB0aGlzLl9yZWZsZWN0b3IuYW5ub3RhdGlvbnModHlwZSkuc29tZShjcmVhdGVOZ01vZHVsZS5pc1R5cGVPZik7IH1cblxuICByZXNvbHZlKHR5cGU6IFR5cGUsIHRocm93SWZOb3RGb3VuZCA9IHRydWUpOiBOZ01vZHVsZXxudWxsIHtcbiAgICBjb25zdCBuZ01vZHVsZU1ldGE6IE5nTW9kdWxlID1cbiAgICAgICAgZmluZExhc3QodGhpcy5fcmVmbGVjdG9yLmFubm90YXRpb25zKHR5cGUpLCBjcmVhdGVOZ01vZHVsZS5pc1R5cGVPZik7XG5cbiAgICBpZiAobmdNb2R1bGVNZXRhKSB7XG4gICAgICByZXR1cm4gbmdNb2R1bGVNZXRhO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhyb3dJZk5vdEZvdW5kKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gTmdNb2R1bGUgbWV0YWRhdGEgZm91bmQgZm9yICcke3N0cmluZ2lmeSh0eXBlKX0nLmApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG59XG4iXX0=