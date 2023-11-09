/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../ir';
export var CompilationJobKind;
(function (CompilationJobKind) {
    CompilationJobKind[CompilationJobKind["Tmpl"] = 0] = "Tmpl";
    CompilationJobKind[CompilationJobKind["Host"] = 1] = "Host";
    CompilationJobKind[CompilationJobKind["Both"] = 2] = "Both";
})(CompilationJobKind || (CompilationJobKind = {}));
/**
 * An entire ongoing compilation, which will result in one or more template functions when complete.
 * Contains one or more corresponding compilation units.
 */
export class CompilationJob {
    constructor(componentName, pool, compatibility) {
        this.componentName = componentName;
        this.pool = pool;
        this.compatibility = compatibility;
        this.kind = CompilationJobKind.Both;
        /**
         * Tracks the next `ir.XrefId` which can be assigned as template structures are ingested.
         */
        this.nextXrefId = 0;
    }
    /**
     * Generate a new unique `ir.XrefId` in this job.
     */
    allocateXrefId() {
        return this.nextXrefId++;
    }
}
/**
 * Compilation-in-progress of a whole component's template, including the main template and any
 * embedded views or host bindings.
 */
export class ComponentCompilationJob extends CompilationJob {
    constructor(componentName, pool, compatibility, relativeContextFilePath, i18nUseExternalIds, deferBlocksMeta) {
        super(componentName, pool, compatibility);
        this.relativeContextFilePath = relativeContextFilePath;
        this.i18nUseExternalIds = i18nUseExternalIds;
        this.deferBlocksMeta = deferBlocksMeta;
        this.kind = CompilationJobKind.Tmpl;
        this.fnSuffix = 'Template';
        this.views = new Map();
        /**
         * Causes ngContentSelectors to be emitted, for content projection slots in the view. Possibly a
         * reference into the constant pool.
         */
        this.contentSelectors = null;
        /**
         * Constant expressions used by operations within this component's compilation.
         *
         * This will eventually become the `consts` array in the component definition.
         */
        this.consts = [];
        /**
         * Initialization statements needed to set up the consts.
         */
        this.constsInitializers = [];
        this.root = new ViewCompilationUnit(this, this.allocateXrefId(), null);
        this.views.set(this.root.xref, this.root);
    }
    /**
     * Add a `ViewCompilation` for a new embedded view to this compilation.
     */
    allocateView(parent) {
        const view = new ViewCompilationUnit(this, this.allocateXrefId(), parent);
        this.views.set(view.xref, view);
        return view;
    }
    get units() {
        return this.views.values();
    }
    /**
     * Add a constant `o.Expression` to the compilation and return its index in the `consts` array.
     */
    addConst(newConst, initializers) {
        for (let idx = 0; idx < this.consts.length; idx++) {
            if (this.consts[idx].isEquivalent(newConst)) {
                return idx;
            }
        }
        const idx = this.consts.length;
        this.consts.push(newConst);
        if (initializers) {
            this.constsInitializers.push(...initializers);
        }
        return idx;
    }
}
/**
 * A compilation unit is compiled into a template function. Some example units are views and host
 * bindings.
 */
export class CompilationUnit {
    constructor(xref) {
        this.xref = xref;
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
         * Name of the function which will be generated for this unit.
         *
         * May be `null` if not yet determined.
         */
        this.fnName = null;
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
/**
 * Compilation-in-progress of an individual view within a template.
 */
export class ViewCompilationUnit extends CompilationUnit {
    constructor(job, xref, parent) {
        super(xref);
        this.job = job;
        this.parent = parent;
        /**
         * Map of declared variables available within this view to the property on the context object
         * which they alias.
         */
        this.contextVariables = new Map();
        /**
         * Set of aliases available within this view. An alias is a variable whose provided expression is
         * inlined at every location it is used. It may also depend on context variables, by name.
         */
        this.aliases = new Set();
        /**
         * Number of declaration slots used within this view, or `null` if slots have not yet been
         * allocated.
         */
        this.decls = null;
    }
}
/**
 * Compilation-in-progress of a host binding, which contains a single unit for that host binding.
 */
export class HostBindingCompilationJob extends CompilationJob {
    constructor(componentName, pool, compatibility) {
        super(componentName, pool, compatibility);
        this.kind = CompilationJobKind.Host;
        this.fnSuffix = 'HostBindings';
        this.root = new HostBindingCompilationUnit(this);
    }
    get units() {
        return [this.root];
    }
}
export class HostBindingCompilationUnit extends CompilationUnit {
    constructor(job) {
        super(0);
        this.job = job;
        /**
         * Much like an element can have attributes, so can a host binding function.
         */
        this.attributes = null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQU1ILE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE1BQU0sQ0FBTixJQUFZLGtCQUlYO0FBSkQsV0FBWSxrQkFBa0I7SUFDNUIsMkRBQUksQ0FBQTtJQUNKLDJEQUFJLENBQUE7SUFDSiwyREFBSSxDQUFBO0FBQ04sQ0FBQyxFQUpXLGtCQUFrQixLQUFsQixrQkFBa0IsUUFJN0I7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLGNBQWM7SUFDbEMsWUFDYSxhQUFxQixFQUFXLElBQWtCLEVBQ2xELGFBQW1DO1FBRG5DLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBQVcsU0FBSSxHQUFKLElBQUksQ0FBYztRQUNsRCxrQkFBYSxHQUFiLGFBQWEsQ0FBc0I7UUFFaEQsU0FBSSxHQUF1QixrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUEwQm5EOztXQUVHO1FBQ0ssZUFBVSxHQUFjLENBQWMsQ0FBQztJQS9CSSxDQUFDO0lBcUJwRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQWUsQ0FBQztJQUN4QyxDQUFDO0NBTUY7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsY0FBYztJQUN6RCxZQUNJLGFBQXFCLEVBQUUsSUFBa0IsRUFBRSxhQUFtQyxFQUNyRSx1QkFBK0IsRUFBVyxrQkFBMkIsRUFDckUsZUFBMkQ7UUFDdEUsS0FBSyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFGL0IsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUFRO1FBQVcsdUJBQWtCLEdBQWxCLGtCQUFr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LENBQUM7Q0FNRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy9yM19hc3QnO1xuaW1wb3J0IHtSM0RlZmVyQmxvY2tNZXRhZGF0YX0gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy92aWV3L2FwaSc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmV4cG9ydCBlbnVtIENvbXBpbGF0aW9uSm9iS2luZCB7XG4gIFRtcGwsXG4gIEhvc3QsXG4gIEJvdGgsICAvLyBBIHNwZWNpYWwgdmFsdWUgdXNlZCB0byBpbmRpY2F0ZSB0aGF0IHNvbWUgbG9naWMgYXBwbGllcyB0byBib3RoIGNvbXBpbGF0aW9uIHR5cGVzXG59XG5cbi8qKlxuICogQW4gZW50aXJlIG9uZ29pbmcgY29tcGlsYXRpb24sIHdoaWNoIHdpbGwgcmVzdWx0IGluIG9uZSBvciBtb3JlIHRlbXBsYXRlIGZ1bmN0aW9ucyB3aGVuIGNvbXBsZXRlLlxuICogQ29udGFpbnMgb25lIG9yIG1vcmUgY29ycmVzcG9uZGluZyBjb21waWxhdGlvbiB1bml0cy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBjb21wb25lbnROYW1lOiBzdHJpbmcsIHJlYWRvbmx5IHBvb2w6IENvbnN0YW50UG9vbCxcbiAgICAgIHJlYWRvbmx5IGNvbXBhdGliaWxpdHk6IGlyLkNvbXBhdGliaWxpdHlNb2RlKSB7fVxuXG4gIGtpbmQ6IENvbXBpbGF0aW9uSm9iS2luZCA9IENvbXBpbGF0aW9uSm9iS2luZC5Cb3RoO1xuXG4gIC8qKlxuICAgKiBBIGNvbXBpbGF0aW9uIGpvYiB3aWxsIGNvbnRhaW4gb25lIG9yIG1vcmUgY29tcGlsYXRpb24gdW5pdHMuXG4gICAqL1xuICBhYnN0cmFjdCBnZXQgdW5pdHMoKTogSXRlcmFibGU8Q29tcGlsYXRpb25Vbml0PjtcblxuICAvKipcbiAgICogVGhlIHJvb3QgY29tcGlsYXRpb24gdW5pdCwgc3VjaCBhcyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUsIG9yIHRoZSBob3N0IGJpbmRpbmcncyBjb21waWxhdGlvblxuICAgKiB1bml0LlxuICAgKi9cbiAgYWJzdHJhY3Qgcm9vdDogQ29tcGlsYXRpb25Vbml0O1xuXG4gIC8qKlxuICAgKiBBIHVuaXF1ZSBzdHJpbmcgdXNlZCB0byBpZGVudGlmeSB0aGlzIGtpbmQgb2Ygam9iLCBhbmQgZ2VuZXJhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIChhcyBhXG4gICAqIHN1ZmZpeCBvZiB0aGUgbmFtZSkuXG4gICAqL1xuICBhYnN0cmFjdCBmblN1ZmZpeDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIG5ldyB1bmlxdWUgYGlyLlhyZWZJZGAgaW4gdGhpcyBqb2IuXG4gICAqL1xuICBhbGxvY2F0ZVhyZWZJZCgpOiBpci5YcmVmSWQge1xuICAgIHJldHVybiB0aGlzLm5leHRYcmVmSWQrKyBhcyBpci5YcmVmSWQ7XG4gIH1cblxuICAvKipcbiAgICogVHJhY2tzIHRoZSBuZXh0IGBpci5YcmVmSWRgIHdoaWNoIGNhbiBiZSBhc3NpZ25lZCBhcyB0ZW1wbGF0ZSBzdHJ1Y3R1cmVzIGFyZSBpbmdlc3RlZC5cbiAgICovXG4gIHByaXZhdGUgbmV4dFhyZWZJZDogaXIuWHJlZklkID0gMCBhcyBpci5YcmVmSWQ7XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYSB3aG9sZSBjb21wb25lbnQncyB0ZW1wbGF0ZSwgaW5jbHVkaW5nIHRoZSBtYWluIHRlbXBsYXRlIGFuZCBhbnlcbiAqIGVtYmVkZGVkIHZpZXdzIG9yIGhvc3QgYmluZGluZ3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRDb21waWxhdGlvbkpvYiBleHRlbmRzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIHBvb2w6IENvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eTogaXIuQ29tcGF0aWJpbGl0eU1vZGUsXG4gICAgICByZWFkb25seSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLCByZWFkb25seSBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4sXG4gICAgICByZWFkb25seSBkZWZlckJsb2Nrc01ldGE6IE1hcDx0LkRlZmVycmVkQmxvY2ssIFIzRGVmZXJCbG9ja01ldGFkYXRhPikge1xuICAgIHN1cGVyKGNvbXBvbmVudE5hbWUsIHBvb2wsIGNvbXBhdGliaWxpdHkpO1xuICAgIHRoaXMucm9vdCA9IG5ldyBWaWV3Q29tcGlsYXRpb25Vbml0KHRoaXMsIHRoaXMuYWxsb2NhdGVYcmVmSWQoKSwgbnVsbCk7XG4gICAgdGhpcy52aWV3cy5zZXQodGhpcy5yb290LnhyZWYsIHRoaXMucm9vdCk7XG4gIH1cblxuICBvdmVycmlkZSBraW5kID0gQ29tcGlsYXRpb25Kb2JLaW5kLlRtcGw7XG5cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgZm5TdWZmaXg6IHN0cmluZyA9ICdUZW1wbGF0ZSc7XG5cbiAgLyoqXG4gICAqIFRoZSByb290IHZpZXcsIHJlcHJlc2VudGluZyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICBvdmVycmlkZSByZWFkb25seSByb290OiBWaWV3Q29tcGlsYXRpb25Vbml0O1xuXG4gIHJlYWRvbmx5IHZpZXdzID0gbmV3IE1hcDxpci5YcmVmSWQsIFZpZXdDb21waWxhdGlvblVuaXQ+KCk7XG5cbiAgLyoqXG4gICAqIENhdXNlcyBuZ0NvbnRlbnRTZWxlY3RvcnMgdG8gYmUgZW1pdHRlZCwgZm9yIGNvbnRlbnQgcHJvamVjdGlvbiBzbG90cyBpbiB0aGUgdmlldy4gUG9zc2libHkgYVxuICAgKiByZWZlcmVuY2UgaW50byB0aGUgY29uc3RhbnQgcG9vbC5cbiAgICovXG4gIHB1YmxpYyBjb250ZW50U2VsZWN0b3JzOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEFkZCBhIGBWaWV3Q29tcGlsYXRpb25gIGZvciBhIG5ldyBlbWJlZGRlZCB2aWV3IHRvIHRoaXMgY29tcGlsYXRpb24uXG4gICAqL1xuICBhbGxvY2F0ZVZpZXcocGFyZW50OiBpci5YcmVmSWQpOiBWaWV3Q29tcGlsYXRpb25Vbml0IHtcbiAgICBjb25zdCB2aWV3ID0gbmV3IFZpZXdDb21waWxhdGlvblVuaXQodGhpcywgdGhpcy5hbGxvY2F0ZVhyZWZJZCgpLCBwYXJlbnQpO1xuICAgIHRoaXMudmlld3Muc2V0KHZpZXcueHJlZiwgdmlldyk7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cblxuICBvdmVycmlkZSBnZXQgdW5pdHMoKTogSXRlcmFibGU8Vmlld0NvbXBpbGF0aW9uVW5pdD4ge1xuICAgIHJldHVybiB0aGlzLnZpZXdzLnZhbHVlcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbnN0YW50IGBvLkV4cHJlc3Npb25gIHRvIHRoZSBjb21waWxhdGlvbiBhbmQgcmV0dXJuIGl0cyBpbmRleCBpbiB0aGUgYGNvbnN0c2AgYXJyYXkuXG4gICAqL1xuICBhZGRDb25zdChuZXdDb25zdDogby5FeHByZXNzaW9uLCBpbml0aWFsaXplcnM/OiBvLlN0YXRlbWVudFtdKTogaXIuQ29uc3RJbmRleCB7XG4gICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgdGhpcy5jb25zdHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgaWYgKHRoaXMuY29uc3RzW2lkeF0uaXNFcXVpdmFsZW50KG5ld0NvbnN0KSkge1xuICAgICAgICByZXR1cm4gaWR4IGFzIGlyLkNvbnN0SW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGlkeCA9IHRoaXMuY29uc3RzLmxlbmd0aDtcbiAgICB0aGlzLmNvbnN0cy5wdXNoKG5ld0NvbnN0KTtcbiAgICBpZiAoaW5pdGlhbGl6ZXJzKSB7XG4gICAgICB0aGlzLmNvbnN0c0luaXRpYWxpemVycy5wdXNoKC4uLmluaXRpYWxpemVycyk7XG4gICAgfVxuICAgIHJldHVybiBpZHggYXMgaXIuQ29uc3RJbmRleDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdGFudCBleHByZXNzaW9ucyB1c2VkIGJ5IG9wZXJhdGlvbnMgd2l0aGluIHRoaXMgY29tcG9uZW50J3MgY29tcGlsYXRpb24uXG4gICAqXG4gICAqIFRoaXMgd2lsbCBldmVudHVhbGx5IGJlY29tZSB0aGUgYGNvbnN0c2AgYXJyYXkgaW4gdGhlIGNvbXBvbmVudCBkZWZpbml0aW9uLlxuICAgKi9cbiAgcmVhZG9ubHkgY29uc3RzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXphdGlvbiBzdGF0ZW1lbnRzIG5lZWRlZCB0byBzZXQgdXAgdGhlIGNvbnN0cy5cbiAgICovXG4gIHJlYWRvbmx5IGNvbnN0c0luaXRpYWxpemVyczogby5TdGF0ZW1lbnRbXSA9IFtdO1xufVxuXG4vKipcbiAqIEEgY29tcGlsYXRpb24gdW5pdCBpcyBjb21waWxlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24uIFNvbWUgZXhhbXBsZSB1bml0cyBhcmUgdmlld3MgYW5kIGhvc3RcbiAqIGJpbmRpbmdzLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ29tcGlsYXRpb25Vbml0IHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgeHJlZjogaXIuWHJlZklkKSB7fVxuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGNyZWF0aW9uIG9wZXJhdGlvbnMgZm9yIHRoaXMgdmlldy5cbiAgICpcbiAgICogQ3JlYXRpb24gb3BlcmF0aW9ucyBtYXkgaW50ZXJuYWxseSBjb250YWluIG90aGVyIG9wZXJhdGlvbnMsIGluY2x1ZGluZyB1cGRhdGUgb3BlcmF0aW9ucy5cbiAgICovXG4gIHJlYWRvbmx5IGNyZWF0ZSA9IG5ldyBpci5PcExpc3Q8aXIuQ3JlYXRlT3A+KCk7XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgdXBkYXRlIG9wZXJhdGlvbnMgZm9yIHRoaXMgdmlldy5cbiAgICovXG4gIHJlYWRvbmx5IHVwZGF0ZSA9IG5ldyBpci5PcExpc3Q8aXIuVXBkYXRlT3A+KCk7XG5cbiAgLyoqXG4gICAqIFRoZSBlbmNsb3Npbmcgam9iLCB3aGljaCBtaWdodCBjb250YWluIHNldmVyYWwgaW5kaXZpZHVhbCBjb21waWxhdGlvbiB1bml0cy5cbiAgICovXG4gIGFic3RyYWN0IHJlYWRvbmx5IGpvYjogQ29tcGlsYXRpb25Kb2I7XG5cbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGZ1bmN0aW9uIHdoaWNoIHdpbGwgYmUgZ2VuZXJhdGVkIGZvciB0aGlzIHVuaXQuXG4gICAqXG4gICAqIE1heSBiZSBgbnVsbGAgaWYgbm90IHlldCBkZXRlcm1pbmVkLlxuICAgKi9cbiAgZm5OYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiB2YXJpYWJsZSBzbG90cyB1c2VkIHdpdGhpbiB0aGlzIHZpZXcsIG9yIGBudWxsYCBpZiB2YXJpYWJsZXMgaGF2ZSBub3QgeWV0IGJlZW5cbiAgICogY291bnRlZC5cbiAgICovXG4gIHZhcnM6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogSXRlcmF0ZSBvdmVyIGFsbCBgaXIuT3BgcyB3aXRoaW4gdGhpcyB2aWV3LlxuICAgKlxuICAgKiBTb21lIG9wZXJhdGlvbnMgbWF5IGhhdmUgY2hpbGQgb3BlcmF0aW9ucywgd2hpY2ggdGhpcyBpdGVyYXRvciB3aWxsIHZpc2l0LlxuICAgKi9cbiAgKiBvcHMoKTogR2VuZXJhdG9yPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPiB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLmNyZWF0ZSkge1xuICAgICAgeWllbGQgb3A7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkxpc3RlbmVyKSB7XG4gICAgICAgIGZvciAoY29uc3QgbGlzdGVuZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgICAgICAgeWllbGQgbGlzdGVuZXJPcDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHRoaXMudXBkYXRlKSB7XG4gICAgICB5aWVsZCBvcDtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxhdGlvbi1pbi1wcm9ncmVzcyBvZiBhbiBpbmRpdmlkdWFsIHZpZXcgd2l0aGluIGEgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBWaWV3Q29tcGlsYXRpb25Vbml0IGV4dGVuZHMgQ29tcGlsYXRpb25Vbml0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCB4cmVmOiBpci5YcmVmSWQsIHJlYWRvbmx5IHBhcmVudDogaXIuWHJlZklkfG51bGwpIHtcbiAgICBzdXBlcih4cmVmKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYXAgb2YgZGVjbGFyZWQgdmFyaWFibGVzIGF2YWlsYWJsZSB3aXRoaW4gdGhpcyB2aWV3IHRvIHRoZSBwcm9wZXJ0eSBvbiB0aGUgY29udGV4dCBvYmplY3RcbiAgICogd2hpY2ggdGhleSBhbGlhcy5cbiAgICovXG4gIHJlYWRvbmx5IGNvbnRleHRWYXJpYWJsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIC8qKlxuICAgKiBTZXQgb2YgYWxpYXNlcyBhdmFpbGFibGUgd2l0aGluIHRoaXMgdmlldy4gQW4gYWxpYXMgaXMgYSB2YXJpYWJsZSB3aG9zZSBwcm92aWRlZCBleHByZXNzaW9uIGlzXG4gICAqIGlubGluZWQgYXQgZXZlcnkgbG9jYXRpb24gaXQgaXMgdXNlZC4gSXQgbWF5IGFsc28gZGVwZW5kIG9uIGNvbnRleHQgdmFyaWFibGVzLCBieSBuYW1lLlxuICAgKi9cbiAgcmVhZG9ubHkgYWxpYXNlcyA9IG5ldyBTZXQ8aXIuQWxpYXNWYXJpYWJsZT4oKTtcblxuICAvKipcbiAgICogTnVtYmVyIG9mIGRlY2xhcmF0aW9uIHNsb3RzIHVzZWQgd2l0aGluIHRoaXMgdmlldywgb3IgYG51bGxgIGlmIHNsb3RzIGhhdmUgbm90IHlldCBiZWVuXG4gICAqIGFsbG9jYXRlZC5cbiAgICovXG4gIGRlY2xzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYSBob3N0IGJpbmRpbmcsIHdoaWNoIGNvbnRhaW5zIGEgc2luZ2xlIHVuaXQgZm9yIHRoYXQgaG9zdCBiaW5kaW5nLlxuICovXG5leHBvcnQgY2xhc3MgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiBleHRlbmRzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoY29tcG9uZW50TmFtZTogc3RyaW5nLCBwb29sOiBDb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHk6IGlyLkNvbXBhdGliaWxpdHlNb2RlKSB7XG4gICAgc3VwZXIoY29tcG9uZW50TmFtZSwgcG9vbCwgY29tcGF0aWJpbGl0eSk7XG4gICAgdGhpcy5yb290ID0gbmV3IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0KHRoaXMpO1xuICB9XG5cbiAgb3ZlcnJpZGUga2luZCA9IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0O1xuXG4gIG92ZXJyaWRlIHJlYWRvbmx5IGZuU3VmZml4OiBzdHJpbmcgPSAnSG9zdEJpbmRpbmdzJztcblxuICBvdmVycmlkZSByZWFkb25seSByb290OiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uVW5pdDtcblxuICBvdmVycmlkZSBnZXQgdW5pdHMoKTogSXRlcmFibGU8SG9zdEJpbmRpbmdDb21waWxhdGlvblVuaXQ+IHtcbiAgICByZXR1cm4gW3RoaXMucm9vdF07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0IGV4dGVuZHMgQ29tcGlsYXRpb25Vbml0IHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKSB7XG4gICAgc3VwZXIoMCBhcyBpci5YcmVmSWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIE11Y2ggbGlrZSBhbiBlbGVtZW50IGNhbiBoYXZlIGF0dHJpYnV0ZXMsIHNvIGNhbiBhIGhvc3QgYmluZGluZyBmdW5jdGlvbi5cbiAgICovXG4gIGF0dHJpYnV0ZXM6IG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsID0gbnVsbDtcbn1cbiJdfQ==