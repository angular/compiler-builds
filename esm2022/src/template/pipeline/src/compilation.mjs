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
    constructor(componentName, pool) {
        this.componentName = componentName;
        this.pool = pool;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCOzs7R0FHRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7SUF1Qi9CLFlBQXFCLGFBQXFCLEVBQVcsSUFBa0I7UUFBbEQsa0JBQWEsR0FBYixhQUFhLENBQVE7UUFBVyxTQUFJLEdBQUosSUFBSSxDQUFjO1FBdEJ2RTs7V0FFRztRQUNLLGVBQVUsR0FBYyxDQUFjLENBQUM7UUFFL0M7O1dBRUc7UUFDTSxVQUFLLEdBQUcsSUFBSSxHQUFHLEVBQThCLENBQUM7UUFFdkQ7Ozs7V0FJRztRQUNNLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBUW5DLDBCQUEwQjtRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDaEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWSxDQUFDLE1BQWlCO1FBQzVCLE1BQU0sSUFBSSxHQUFHLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQWUsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRLENBQUMsUUFBc0I7UUFDN0IsS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQ2pELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzNDLE9BQU8sR0FBb0IsQ0FBQzthQUM3QjtTQUNGO1FBQ0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0IsT0FBTyxHQUFvQixDQUFDO0lBQzlCLENBQUM7Q0FDRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGVBQWU7SUFDMUIsWUFDYSxHQUF5QixFQUFXLElBQWUsRUFDbkQsTUFBc0I7UUFEdEIsUUFBRyxHQUFILEdBQUcsQ0FBc0I7UUFBVyxTQUFJLEdBQUosSUFBSSxDQUFXO1FBQ25ELFdBQU0sR0FBTixNQUFNLENBQWdCO1FBRW5DOzs7O1dBSUc7UUFDSCxXQUFNLEdBQWdCLElBQUksQ0FBQztRQUUzQjs7OztXQUlHO1FBQ00sV0FBTSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBZSxDQUFDO1FBRS9DOztXQUVHO1FBQ00sV0FBTSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBZSxDQUFDO1FBRS9DOzs7V0FHRztRQUNNLHFCQUFnQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBRXREOzs7V0FHRztRQUNILFVBQUssR0FBZ0IsSUFBSSxDQUFDO1FBRTFCOzs7V0FHRztRQUNILFNBQUksR0FBZ0IsSUFBSSxDQUFDO0lBckNhLENBQUM7SUF1Q3ZDOzs7O09BSUc7SUFDSCxDQUFFLEdBQUc7UUFDSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsTUFBTSxFQUFFLENBQUM7WUFDVCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xDLEtBQUssTUFBTSxVQUFVLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRTtvQkFDdEMsTUFBTSxVQUFVLENBQUM7aUJBQ2xCO2FBQ0Y7U0FDRjtRQUNELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixNQUFNLEVBQUUsQ0FBQztTQUNWO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG4vKipcbiAqIENvbXBpbGF0aW9uLWluLXByb2dyZXNzIG9mIGEgd2hvbGUgY29tcG9uZW50J3MgdGVtcGxhdGUsIGluY2x1ZGluZyB0aGUgbWFpbiB0ZW1wbGF0ZSBhbmQgYW55XG4gKiBlbWJlZGRlZCB2aWV3cyBvciBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50Q29tcGlsYXRpb24ge1xuICAvKipcbiAgICogVHJhY2tzIHRoZSBuZXh0IGBpci5YcmVmSWRgIHdoaWNoIGNhbiBiZSBhc3NpZ25lZCBhcyB0ZW1wbGF0ZSBzdHJ1Y3R1cmVzIGFyZSBpbmdlc3RlZC5cbiAgICovXG4gIHByaXZhdGUgbmV4dFhyZWZJZDogaXIuWHJlZklkID0gMCBhcyBpci5YcmVmSWQ7XG5cbiAgLyoqXG4gICAqIE1hcCBvZiB2aWV3IElEcyB0byBgVmlld0NvbXBpbGF0aW9uYHMuXG4gICAqL1xuICByZWFkb25seSB2aWV3cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBWaWV3Q29tcGlsYXRpb24+KCk7XG5cbiAgLyoqXG4gICAqIENvbnN0YW50IGV4cHJlc3Npb25zIHVzZWQgYnkgb3BlcmF0aW9ucyB3aXRoaW4gdGhpcyBjb21wb25lbnQncyBjb21waWxhdGlvbi5cbiAgICpcbiAgICogVGhpcyB3aWxsIGV2ZW50dWFsbHkgYmVjb21lIHRoZSBgY29uc3RzYCBhcnJheSBpbiB0aGUgY29tcG9uZW50IGRlZmluaXRpb24uXG4gICAqL1xuICByZWFkb25seSBjb25zdHM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgLyoqXG4gICAqIFRoZSByb290IHZpZXcsIHJlcHJlc2VudGluZyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICByZWFkb25seSByb290OiBWaWV3Q29tcGlsYXRpb247XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgY29tcG9uZW50TmFtZTogc3RyaW5nLCByZWFkb25seSBwb29sOiBDb25zdGFudFBvb2wpIHtcbiAgICAvLyBBbGxvY2F0ZSB0aGUgcm9vdCB2aWV3LlxuICAgIGNvbnN0IHJvb3QgPSBuZXcgVmlld0NvbXBpbGF0aW9uKHRoaXMsIHRoaXMuYWxsb2NhdGVYcmVmSWQoKSwgbnVsbCk7XG4gICAgdGhpcy52aWV3cy5zZXQocm9vdC54cmVmLCByb290KTtcbiAgICB0aGlzLnJvb3QgPSByb290O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGBWaWV3Q29tcGlsYXRpb25gIGZvciBhIG5ldyBlbWJlZGRlZCB2aWV3IHRvIHRoaXMgY29tcGlsYXRpb24uXG4gICAqL1xuICBhbGxvY2F0ZVZpZXcocGFyZW50OiBpci5YcmVmSWQpOiBWaWV3Q29tcGlsYXRpb24ge1xuICAgIGNvbnN0IHZpZXcgPSBuZXcgVmlld0NvbXBpbGF0aW9uKHRoaXMsIHRoaXMuYWxsb2NhdGVYcmVmSWQoKSwgcGFyZW50KTtcbiAgICB0aGlzLnZpZXdzLnNldCh2aWV3LnhyZWYsIHZpZXcpO1xuICAgIHJldHVybiB2aWV3O1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgbmV3IHVuaXF1ZSBgaXIuWHJlZklkYC5cbiAgICovXG4gIGFsbG9jYXRlWHJlZklkKCk6IGlyLlhyZWZJZCB7XG4gICAgcmV0dXJuIHRoaXMubmV4dFhyZWZJZCsrIGFzIGlyLlhyZWZJZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBjb25zdGFudCBgby5FeHByZXNzaW9uYCB0byB0aGUgY29tcGlsYXRpb24gYW5kIHJldHVybiBpdHMgaW5kZXggaW4gdGhlIGBjb25zdHNgIGFycmF5LlxuICAgKi9cbiAgYWRkQ29uc3QobmV3Q29uc3Q6IG8uRXhwcmVzc2lvbik6IGlyLkNvbnN0SW5kZXgge1xuICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHRoaXMuY29uc3RzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGlmICh0aGlzLmNvbnN0c1tpZHhdLmlzRXF1aXZhbGVudChuZXdDb25zdCkpIHtcbiAgICAgICAgcmV0dXJuIGlkeCBhcyBpci5Db25zdEluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpZHggPSB0aGlzLmNvbnN0cy5sZW5ndGg7XG4gICAgdGhpcy5jb25zdHMucHVzaChuZXdDb25zdCk7XG4gICAgcmV0dXJuIGlkeCBhcyBpci5Db25zdEluZGV4O1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYW4gaW5kaXZpZHVhbCB2aWV3IHdpdGhpbiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVmlld0NvbXBpbGF0aW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0cGw6IENvbXBvbmVudENvbXBpbGF0aW9uLCByZWFkb25seSB4cmVmOiBpci5YcmVmSWQsXG4gICAgICByZWFkb25seSBwYXJlbnQ6IGlyLlhyZWZJZHxudWxsKSB7fVxuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBmdW5jdGlvbiB3aGljaCB3aWxsIGJlIGdlbmVyYXRlZCBmb3IgdGhpcyB2aWV3LlxuICAgKlxuICAgKiBNYXkgYmUgYG51bGxgIGlmIG5vdCB5ZXQgZGV0ZXJtaW5lZC5cbiAgICovXG4gIGZuTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGNyZWF0aW9uIG9wZXJhdGlvbnMgZm9yIHRoaXMgdmlldy5cbiAgICpcbiAgICogQ3JlYXRpb24gb3BlcmF0aW9ucyBtYXkgaW50ZXJuYWxseSBjb250YWluIG90aGVyIG9wZXJhdGlvbnMsIGluY2x1ZGluZyB1cGRhdGUgb3BlcmF0aW9ucy5cbiAgICovXG4gIHJlYWRvbmx5IGNyZWF0ZSA9IG5ldyBpci5PcExpc3Q8aXIuQ3JlYXRlT3A+KCk7XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgdXBkYXRlIG9wZXJhdGlvbnMgZm9yIHRoaXMgdmlldy5cbiAgICovXG4gIHJlYWRvbmx5IHVwZGF0ZSA9IG5ldyBpci5PcExpc3Q8aXIuVXBkYXRlT3A+KCk7XG5cbiAgLyoqXG4gICAqIE1hcCBvZiBkZWNsYXJlZCB2YXJpYWJsZXMgYXZhaWxhYmxlIHdpdGhpbiB0aGlzIHZpZXcgdG8gdGhlIHByb3BlcnR5IG9uIHRoZSBjb250ZXh0IG9iamVjdFxuICAgKiB3aGljaCB0aGV5IGFsaWFzLlxuICAgKi9cbiAgcmVhZG9ubHkgY29udGV4dFZhcmlhYmxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBkZWNsYXJhdGlvbiBzbG90cyB1c2VkIHdpdGhpbiB0aGlzIHZpZXcsIG9yIGBudWxsYCBpZiBzbG90cyBoYXZlIG5vdCB5ZXQgYmVlblxuICAgKiBhbGxvY2F0ZWQuXG4gICAqL1xuICBkZWNsczogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBOdW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gdGhpcyB2aWV3LCBvciBgbnVsbGAgaWYgdmFyaWFibGVzIGhhdmUgbm90IHlldCBiZWVuXG4gICAqIGNvdW50ZWQuXG4gICAqL1xuICB2YXJzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgb3ZlciBhbGwgYGlyLk9wYHMgd2l0aGluIHRoaXMgdmlldy5cbiAgICpcbiAgICogU29tZSBvcGVyYXRpb25zIG1heSBoYXZlIGNoaWxkIG9wZXJhdGlvbnMsIHdoaWNoIHRoaXMgaXRlcmF0b3Igd2lsbCB2aXNpdC5cbiAgICovXG4gICogb3BzKCk6IEdlbmVyYXRvcjxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4ge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdGhpcy5jcmVhdGUpIHtcbiAgICAgIHlpZWxkIG9wO1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICAgIHlpZWxkIGxpc3RlbmVyT3A7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLnVwZGF0ZSkge1xuICAgICAgeWllbGQgb3A7XG4gICAgfVxuICB9XG59XG4iXX0=