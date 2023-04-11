/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../ir';
/**
 * Compilation-in-progress of a whole component's template, including the main template and any
 * embedded views or host bindings.
 */
export class ComponentCompilation {
    constructor(componentName) {
        this.componentName = componentName;
        /**
         * Tracks the next `ir.XrefId` which can be assigned as template structures are ingested.
         */
        this.nextXrefId = 0;
        /**
         * Map of view IDs to `ViewCompilation`s.
         */
        this.views = new Map();
        /**
         * Constant expressions used by operations within this component's compilation.
         *
         * This will eventually become the `consts` array in the component definition.
         */
        this.consts = [];
        // Allocate the root view.
        const root = new ViewCompilation(this, this.allocateXrefId(), null);
        this.views.set(root.xref, root);
        this.root = root;
    }
    /**
     * Add a `ViewCompilation` for a new embedded view to this compilation.
     */
    allocateView(parent) {
        const view = new ViewCompilation(this, this.allocateXrefId(), parent);
        this.views.set(view.xref, view);
        return view;
    }
    /**
     * Generate a new unique `ir.XrefId`.
     */
    allocateXrefId() {
        return this.nextXrefId++;
    }
    /**
     * Add a constant `o.Expression` to the compilation and return its index in the `consts` array.
     */
    addConst(newConst) {
        for (let idx = 0; idx < this.consts.length; idx++) {
            if (this.consts[idx].isEquivalent(newConst)) {
                return idx;
            }
        }
        const idx = this.consts.length;
        this.consts.push(newConst);
        return idx;
    }
}
/**
 * Compilation-in-progress of an individual view within a template.
 */
export class ViewCompilation {
    constructor(tpl, xref, parent) {
        this.tpl = tpl;
        this.xref = xref;
        this.parent = parent;
        /**
         * Name of the function which will be generated for this view.
         *
         * May be `null` if not yet determined.
         */
        this.fnName = null;
        /**
         * List of creation operations for this view.
         *
         * Creation operations may internally contain other operations, including update operations.
         */
        this.create = new ir.OpList();
        /**
         * List of update operations for this view.
         */
        this.update = new ir.OpList();
        /**
         * Map of declared variables available within this view to the property on the context object
         * which they alias.
         */
        this.contextVariables = new Map();
        /**
         * Number of declaration slots used within this view, or `null` if slots have not yet been
         * allocated.
         */
        this.decls = null;
        /**
         * Number of variable slots used within this view, or `null` if variables have not yet been
         * counted.
         */
        this.vars = null;
    }
    /**
     * Iterate over all `ir.Op`s within this view.
     *
     * Some operations may have child operations, which this iterator will visit.
     */
    *ops() {
        for (const op of this.create) {
            yield op;
            if (op.kind === ir.OpKind.Listener) {
                for (const listenerOp of op.handlerOps) {
                    yield listenerOp;
                }
            }
        }
        for (const op of this.update) {
            yield op;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCOzs7R0FHRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7SUF1Qi9CLFlBQXFCLGFBQXFCO1FBQXJCLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBdEIxQzs7V0FFRztRQUNLLGVBQVUsR0FBYyxDQUFjLENBQUM7UUFFL0M7O1dBRUc7UUFDTSxVQUFLLEdBQUcsSUFBSSxHQUFHLEVBQThCLENBQUM7UUFFdkQ7Ozs7V0FJRztRQUNNLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBUW5DLDBCQUEwQjtRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDaEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWSxDQUFDLE1BQWlCO1FBQzVCLE1BQU0sSUFBSSxHQUFHLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQWUsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRLENBQUMsUUFBc0I7UUFDN0IsS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQ2pELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzNDLE9BQU8sR0FBb0IsQ0FBQzthQUM3QjtTQUNGO1FBQ0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0IsT0FBTyxHQUFvQixDQUFDO0lBQzlCLENBQUM7Q0FDRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGVBQWU7SUFDMUIsWUFDYSxHQUF5QixFQUFXLElBQWUsRUFDbkQsTUFBc0I7UUFEdEIsUUFBRyxHQUFILEdBQUcsQ0FBc0I7UUFBVyxTQUFJLEdBQUosSUFBSSxDQUFXO1FBQ25ELFdBQU0sR0FBTixNQUFNLENBQWdCO1FBRW5DOzs7O1dBSUc7UUFDSCxXQUFNLEdBQWdCLElBQUksQ0FBQztRQUUzQjs7OztXQUlHO1FBQ00sV0FBTSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBZSxDQUFDO1FBRS9DOztXQUVHO1FBQ00sV0FBTSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBZSxDQUFDO1FBRS9DOzs7V0FHRztRQUNNLHFCQUFnQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBRXREOzs7V0FHRztRQUNILFVBQUssR0FBZ0IsSUFBSSxDQUFDO1FBRTFCOzs7V0FHRztRQUNILFNBQUksR0FBZ0IsSUFBSSxDQUFDO0lBckNhLENBQUM7SUF1Q3ZDOzs7O09BSUc7SUFDSCxDQUFFLEdBQUc7UUFDSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsTUFBTSxFQUFFLENBQUM7WUFDVCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xDLEtBQUssTUFBTSxVQUFVLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRTtvQkFDdEMsTUFBTSxVQUFVLENBQUM7aUJBQ2xCO2FBQ0Y7U0FDRjtRQUNELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixNQUFNLEVBQUUsQ0FBQztTQUNWO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG4vKipcbiAqIENvbXBpbGF0aW9uLWluLXByb2dyZXNzIG9mIGEgd2hvbGUgY29tcG9uZW50J3MgdGVtcGxhdGUsIGluY2x1ZGluZyB0aGUgbWFpbiB0ZW1wbGF0ZSBhbmQgYW55XG4gKiBlbWJlZGRlZCB2aWV3cyBvciBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50Q29tcGlsYXRpb24ge1xuICAvKipcbiAgICogVHJhY2tzIHRoZSBuZXh0IGBpci5YcmVmSWRgIHdoaWNoIGNhbiBiZSBhc3NpZ25lZCBhcyB0ZW1wbGF0ZSBzdHJ1Y3R1cmVzIGFyZSBpbmdlc3RlZC5cbiAgICovXG4gIHByaXZhdGUgbmV4dFhyZWZJZDogaXIuWHJlZklkID0gMCBhcyBpci5YcmVmSWQ7XG5cbiAgLyoqXG4gICAqIE1hcCBvZiB2aWV3IElEcyB0byBgVmlld0NvbXBpbGF0aW9uYHMuXG4gICAqL1xuICByZWFkb25seSB2aWV3cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBWaWV3Q29tcGlsYXRpb24+KCk7XG5cbiAgLyoqXG4gICAqIENvbnN0YW50IGV4cHJlc3Npb25zIHVzZWQgYnkgb3BlcmF0aW9ucyB3aXRoaW4gdGhpcyBjb21wb25lbnQncyBjb21waWxhdGlvbi5cbiAgICpcbiAgICogVGhpcyB3aWxsIGV2ZW50dWFsbHkgYmVjb21lIHRoZSBgY29uc3RzYCBhcnJheSBpbiB0aGUgY29tcG9uZW50IGRlZmluaXRpb24uXG4gICAqL1xuICByZWFkb25seSBjb25zdHM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgLyoqXG4gICAqIFRoZSByb290IHZpZXcsIHJlcHJlc2VudGluZyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICByZWFkb25seSByb290OiBWaWV3Q29tcGlsYXRpb247XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgY29tcG9uZW50TmFtZTogc3RyaW5nKSB7XG4gICAgLy8gQWxsb2NhdGUgdGhlIHJvb3Qgdmlldy5cbiAgICBjb25zdCByb290ID0gbmV3IFZpZXdDb21waWxhdGlvbih0aGlzLCB0aGlzLmFsbG9jYXRlWHJlZklkKCksIG51bGwpO1xuICAgIHRoaXMudmlld3Muc2V0KHJvb3QueHJlZiwgcm9vdCk7XG4gICAgdGhpcy5yb290ID0gcm9vdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBgVmlld0NvbXBpbGF0aW9uYCBmb3IgYSBuZXcgZW1iZWRkZWQgdmlldyB0byB0aGlzIGNvbXBpbGF0aW9uLlxuICAgKi9cbiAgYWxsb2NhdGVWaWV3KHBhcmVudDogaXIuWHJlZklkKTogVmlld0NvbXBpbGF0aW9uIHtcbiAgICBjb25zdCB2aWV3ID0gbmV3IFZpZXdDb21waWxhdGlvbih0aGlzLCB0aGlzLmFsbG9jYXRlWHJlZklkKCksIHBhcmVudCk7XG4gICAgdGhpcy52aWV3cy5zZXQodmlldy54cmVmLCB2aWV3KTtcbiAgICByZXR1cm4gdmlldztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIG5ldyB1bmlxdWUgYGlyLlhyZWZJZGAuXG4gICAqL1xuICBhbGxvY2F0ZVhyZWZJZCgpOiBpci5YcmVmSWQge1xuICAgIHJldHVybiB0aGlzLm5leHRYcmVmSWQrKyBhcyBpci5YcmVmSWQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgY29uc3RhbnQgYG8uRXhwcmVzc2lvbmAgdG8gdGhlIGNvbXBpbGF0aW9uIGFuZCByZXR1cm4gaXRzIGluZGV4IGluIHRoZSBgY29uc3RzYCBhcnJheS5cbiAgICovXG4gIGFkZENvbnN0KG5ld0NvbnN0OiBvLkV4cHJlc3Npb24pOiBpci5Db25zdEluZGV4IHtcbiAgICBmb3IgKGxldCBpZHggPSAwOyBpZHggPCB0aGlzLmNvbnN0cy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBpZiAodGhpcy5jb25zdHNbaWR4XS5pc0VxdWl2YWxlbnQobmV3Q29uc3QpKSB7XG4gICAgICAgIHJldHVybiBpZHggYXMgaXIuQ29uc3RJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaWR4ID0gdGhpcy5jb25zdHMubGVuZ3RoO1xuICAgIHRoaXMuY29uc3RzLnB1c2gobmV3Q29uc3QpO1xuICAgIHJldHVybiBpZHggYXMgaXIuQ29uc3RJbmRleDtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGF0aW9uLWluLXByb2dyZXNzIG9mIGFuIGluZGl2aWR1YWwgdmlldyB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZpZXdDb21waWxhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgdHBsOiBDb21wb25lbnRDb21waWxhdGlvbiwgcmVhZG9ubHkgeHJlZjogaXIuWHJlZklkLFxuICAgICAgcmVhZG9ubHkgcGFyZW50OiBpci5YcmVmSWR8bnVsbCkge31cblxuICAvKipcbiAgICogTmFtZSBvZiB0aGUgZnVuY3Rpb24gd2hpY2ggd2lsbCBiZSBnZW5lcmF0ZWQgZm9yIHRoaXMgdmlldy5cbiAgICpcbiAgICogTWF5IGJlIGBudWxsYCBpZiBub3QgeWV0IGRldGVybWluZWQuXG4gICAqL1xuICBmbk5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogTGlzdCBvZiBjcmVhdGlvbiBvcGVyYXRpb25zIGZvciB0aGlzIHZpZXcuXG4gICAqXG4gICAqIENyZWF0aW9uIG9wZXJhdGlvbnMgbWF5IGludGVybmFsbHkgY29udGFpbiBvdGhlciBvcGVyYXRpb25zLCBpbmNsdWRpbmcgdXBkYXRlIG9wZXJhdGlvbnMuXG4gICAqL1xuICByZWFkb25seSBjcmVhdGUgPSBuZXcgaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPigpO1xuXG4gIC8qKlxuICAgKiBMaXN0IG9mIHVwZGF0ZSBvcGVyYXRpb25zIGZvciB0aGlzIHZpZXcuXG4gICAqL1xuICByZWFkb25seSB1cGRhdGUgPSBuZXcgaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPigpO1xuXG4gIC8qKlxuICAgKiBNYXAgb2YgZGVjbGFyZWQgdmFyaWFibGVzIGF2YWlsYWJsZSB3aXRoaW4gdGhpcyB2aWV3IHRvIHRoZSBwcm9wZXJ0eSBvbiB0aGUgY29udGV4dCBvYmplY3RcbiAgICogd2hpY2ggdGhleSBhbGlhcy5cbiAgICovXG4gIHJlYWRvbmx5IGNvbnRleHRWYXJpYWJsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIC8qKlxuICAgKiBOdW1iZXIgb2YgZGVjbGFyYXRpb24gc2xvdHMgdXNlZCB3aXRoaW4gdGhpcyB2aWV3LCBvciBgbnVsbGAgaWYgc2xvdHMgaGF2ZSBub3QgeWV0IGJlZW5cbiAgICogYWxsb2NhdGVkLlxuICAgKi9cbiAgZGVjbHM6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogTnVtYmVyIG9mIHZhcmlhYmxlIHNsb3RzIHVzZWQgd2l0aGluIHRoaXMgdmlldywgb3IgYG51bGxgIGlmIHZhcmlhYmxlcyBoYXZlIG5vdCB5ZXQgYmVlblxuICAgKiBjb3VudGVkLlxuICAgKi9cbiAgdmFyczogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBJdGVyYXRlIG92ZXIgYWxsIGBpci5PcGBzIHdpdGhpbiB0aGlzIHZpZXcuXG4gICAqXG4gICAqIFNvbWUgb3BlcmF0aW9ucyBtYXkgaGF2ZSBjaGlsZCBvcGVyYXRpb25zLCB3aGljaCB0aGlzIGl0ZXJhdG9yIHdpbGwgdmlzaXQuXG4gICAqL1xuICAqIG9wcygpOiBHZW5lcmF0b3I8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+IHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHRoaXMuY3JlYXRlKSB7XG4gICAgICB5aWVsZCBvcDtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuTGlzdGVuZXIpIHtcbiAgICAgICAgZm9yIChjb25zdCBsaXN0ZW5lck9wIG9mIG9wLmhhbmRsZXJPcHMpIHtcbiAgICAgICAgICB5aWVsZCBsaXN0ZW5lck9wO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3Qgb3Agb2YgdGhpcy51cGRhdGUpIHtcbiAgICAgIHlpZWxkIG9wO1xuICAgIH1cbiAgfVxufVxuIl19