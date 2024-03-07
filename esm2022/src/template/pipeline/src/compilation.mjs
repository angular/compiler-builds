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
    constructor(componentName, pool, compatibility, relativeContextFilePath, i18nUseExternalIds, deferMeta, allDeferrableDepsFn) {
        super(componentName, pool, compatibility);
        this.relativeContextFilePath = relativeContextFilePath;
        this.i18nUseExternalIds = i18nUseExternalIds;
        this.deferMeta = deferMeta;
        this.allDeferrableDepsFn = allDeferrableDepsFn;
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
            if (op.kind === ir.OpKind.Listener || op.kind === ir.OpKind.TwoWayListener) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUtILE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE1BQU0sQ0FBTixJQUFZLGtCQUlYO0FBSkQsV0FBWSxrQkFBa0I7SUFDNUIsMkRBQUksQ0FBQTtJQUNKLDJEQUFJLENBQUE7SUFDSiwyREFBSSxDQUFBO0FBQ04sQ0FBQyxFQUpXLGtCQUFrQixLQUFsQixrQkFBa0IsUUFJN0I7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLGNBQWM7SUFDbEMsWUFDYSxhQUFxQixFQUFXLElBQWtCLEVBQ2xELGFBQW1DO1FBRG5DLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBQVcsU0FBSSxHQUFKLElBQUksQ0FBYztRQUNsRCxrQkFBYSxHQUFiLGFBQWEsQ0FBc0I7UUFFaEQsU0FBSSxHQUF1QixrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUEwQm5EOztXQUVHO1FBQ0ssZUFBVSxHQUFjLENBQWMsQ0FBQztJQS9CSSxDQUFDO0lBcUJwRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQWUsQ0FBQztJQUN4QyxDQUFDO0NBTUY7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsY0FBYztJQUN6RCxZQUNJLGFBQXFCLEVBQUUsSUFBa0IsRUFBRSxhQUFtQyxFQUNyRSx1QkFBK0IsRUFBVyxrQkFBMkIsRUFDckUsU0FBMEIsRUFBVyxtQkFBdUM7UUFDdkYsS0FBSyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFGL0IsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUFRO1FBQVcsdUJBQWtC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QUssQ0FBQyxDQUFjLENBQUMsQ0FBQztRQURILFFBQUcsR0FBSCxHQUFHLENBQTJCO1FBSW5EOztXQUVHO1FBQ0gsZUFBVSxHQUE0QixJQUFJLENBQUM7SUFMM0MsQ0FBQztDQU1GIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtSM0RlZmVyTWV0YWRhdGF9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5leHBvcnQgZW51bSBDb21waWxhdGlvbkpvYktpbmQge1xuICBUbXBsLFxuICBIb3N0LFxuICBCb3RoLCAgLy8gQSBzcGVjaWFsIHZhbHVlIHVzZWQgdG8gaW5kaWNhdGUgdGhhdCBzb21lIGxvZ2ljIGFwcGxpZXMgdG8gYm90aCBjb21waWxhdGlvbiB0eXBlc1xufVxuXG4vKipcbiAqIEFuIGVudGlyZSBvbmdvaW5nIGNvbXBpbGF0aW9uLCB3aGljaCB3aWxsIHJlc3VsdCBpbiBvbmUgb3IgbW9yZSB0ZW1wbGF0ZSBmdW5jdGlvbnMgd2hlbiBjb21wbGV0ZS5cbiAqIENvbnRhaW5zIG9uZSBvciBtb3JlIGNvcnJlc3BvbmRpbmcgY29tcGlsYXRpb24gdW5pdHMuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgY29tcG9uZW50TmFtZTogc3RyaW5nLCByZWFkb25seSBwb29sOiBDb25zdGFudFBvb2wsXG4gICAgICByZWFkb25seSBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge31cblxuICBraW5kOiBDb21waWxhdGlvbkpvYktpbmQgPSBDb21waWxhdGlvbkpvYktpbmQuQm90aDtcblxuICAvKipcbiAgICogQSBjb21waWxhdGlvbiBqb2Igd2lsbCBjb250YWluIG9uZSBvciBtb3JlIGNvbXBpbGF0aW9uIHVuaXRzLlxuICAgKi9cbiAgYWJzdHJhY3QgZ2V0IHVuaXRzKCk6IEl0ZXJhYmxlPENvbXBpbGF0aW9uVW5pdD47XG5cbiAgLyoqXG4gICAqIFRoZSByb290IGNvbXBpbGF0aW9uIHVuaXQsIHN1Y2ggYXMgdGhlIGNvbXBvbmVudCdzIHRlbXBsYXRlLCBvciB0aGUgaG9zdCBiaW5kaW5nJ3MgY29tcGlsYXRpb25cbiAgICogdW5pdC5cbiAgICovXG4gIGFic3RyYWN0IHJvb3Q6IENvbXBpbGF0aW9uVW5pdDtcblxuICAvKipcbiAgICogQSB1bmlxdWUgc3RyaW5nIHVzZWQgdG8gaWRlbnRpZnkgdGhpcyBraW5kIG9mIGpvYiwgYW5kIGdlbmVyYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiAoYXMgYVxuICAgKiBzdWZmaXggb2YgdGhlIG5hbWUpLlxuICAgKi9cbiAgYWJzdHJhY3QgZm5TdWZmaXg6IHN0cmluZztcblxuICAvKipcbiAgICogR2VuZXJhdGUgYSBuZXcgdW5pcXVlIGBpci5YcmVmSWRgIGluIHRoaXMgam9iLlxuICAgKi9cbiAgYWxsb2NhdGVYcmVmSWQoKTogaXIuWHJlZklkIHtcbiAgICByZXR1cm4gdGhpcy5uZXh0WHJlZklkKysgYXMgaXIuWHJlZklkO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYWNrcyB0aGUgbmV4dCBgaXIuWHJlZklkYCB3aGljaCBjYW4gYmUgYXNzaWduZWQgYXMgdGVtcGxhdGUgc3RydWN0dXJlcyBhcmUgaW5nZXN0ZWQuXG4gICAqL1xuICBwcml2YXRlIG5leHRYcmVmSWQ6IGlyLlhyZWZJZCA9IDAgYXMgaXIuWHJlZklkO1xufVxuXG4vKipcbiAqIENvbXBpbGF0aW9uLWluLXByb2dyZXNzIG9mIGEgd2hvbGUgY29tcG9uZW50J3MgdGVtcGxhdGUsIGluY2x1ZGluZyB0aGUgbWFpbiB0ZW1wbGF0ZSBhbmQgYW55XG4gKiBlbWJlZGRlZCB2aWV3cyBvciBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IgZXh0ZW5kcyBDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgY29tcG9uZW50TmFtZTogc3RyaW5nLCBwb29sOiBDb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHk6IGlyLkNvbXBhdGliaWxpdHlNb2RlLFxuICAgICAgcmVhZG9ubHkgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZywgcmVhZG9ubHkgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuLFxuICAgICAgcmVhZG9ubHkgZGVmZXJNZXRhOiBSM0RlZmVyTWV0YWRhdGEsIHJlYWRvbmx5IGFsbERlZmVycmFibGVEZXBzRm46IG8uUmVhZFZhckV4cHJ8bnVsbCkge1xuICAgIHN1cGVyKGNvbXBvbmVudE5hbWUsIHBvb2wsIGNvbXBhdGliaWxpdHkpO1xuICAgIHRoaXMucm9vdCA9IG5ldyBWaWV3Q29tcGlsYXRpb25Vbml0KHRoaXMsIHRoaXMuYWxsb2NhdGVYcmVmSWQoKSwgbnVsbCk7XG4gICAgdGhpcy52aWV3cy5zZXQodGhpcy5yb290LnhyZWYsIHRoaXMucm9vdCk7XG4gIH1cblxuICBvdmVycmlkZSBraW5kID0gQ29tcGlsYXRpb25Kb2JLaW5kLlRtcGw7XG5cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgZm5TdWZmaXg6IHN0cmluZyA9ICdUZW1wbGF0ZSc7XG5cbiAgLyoqXG4gICAqIFRoZSByb290IHZpZXcsIHJlcHJlc2VudGluZyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUuXG4gICAqL1xuICBvdmVycmlkZSByZWFkb25seSByb290OiBWaWV3Q29tcGlsYXRpb25Vbml0O1xuXG4gIHJlYWRvbmx5IHZpZXdzID0gbmV3IE1hcDxpci5YcmVmSWQsIFZpZXdDb21waWxhdGlvblVuaXQ+KCk7XG5cbiAgLyoqXG4gICAqIENhdXNlcyBuZ0NvbnRlbnRTZWxlY3RvcnMgdG8gYmUgZW1pdHRlZCwgZm9yIGNvbnRlbnQgcHJvamVjdGlvbiBzbG90cyBpbiB0aGUgdmlldy4gUG9zc2libHkgYVxuICAgKiByZWZlcmVuY2UgaW50byB0aGUgY29uc3RhbnQgcG9vbC5cbiAgICovXG4gIHB1YmxpYyBjb250ZW50U2VsZWN0b3JzOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEFkZCBhIGBWaWV3Q29tcGlsYXRpb25gIGZvciBhIG5ldyBlbWJlZGRlZCB2aWV3IHRvIHRoaXMgY29tcGlsYXRpb24uXG4gICAqL1xuICBhbGxvY2F0ZVZpZXcocGFyZW50OiBpci5YcmVmSWQpOiBWaWV3Q29tcGlsYXRpb25Vbml0IHtcbiAgICBjb25zdCB2aWV3ID0gbmV3IFZpZXdDb21waWxhdGlvblVuaXQodGhpcywgdGhpcy5hbGxvY2F0ZVhyZWZJZCgpLCBwYXJlbnQpO1xuICAgIHRoaXMudmlld3Muc2V0KHZpZXcueHJlZiwgdmlldyk7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cblxuICBvdmVycmlkZSBnZXQgdW5pdHMoKTogSXRlcmFibGU8Vmlld0NvbXBpbGF0aW9uVW5pdD4ge1xuICAgIHJldHVybiB0aGlzLnZpZXdzLnZhbHVlcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbnN0YW50IGBvLkV4cHJlc3Npb25gIHRvIHRoZSBjb21waWxhdGlvbiBhbmQgcmV0dXJuIGl0cyBpbmRleCBpbiB0aGUgYGNvbnN0c2AgYXJyYXkuXG4gICAqL1xuICBhZGRDb25zdChuZXdDb25zdDogby5FeHByZXNzaW9uLCBpbml0aWFsaXplcnM/OiBvLlN0YXRlbWVudFtdKTogaXIuQ29uc3RJbmRleCB7XG4gICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgdGhpcy5jb25zdHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgaWYgKHRoaXMuY29uc3RzW2lkeF0uaXNFcXVpdmFsZW50KG5ld0NvbnN0KSkge1xuICAgICAgICByZXR1cm4gaWR4IGFzIGlyLkNvbnN0SW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGlkeCA9IHRoaXMuY29uc3RzLmxlbmd0aDtcbiAgICB0aGlzLmNvbnN0cy5wdXNoKG5ld0NvbnN0KTtcbiAgICBpZiAoaW5pdGlhbGl6ZXJzKSB7XG4gICAgICB0aGlzLmNvbnN0c0luaXRpYWxpemVycy5wdXNoKC4uLmluaXRpYWxpemVycyk7XG4gICAgfVxuICAgIHJldHVybiBpZHggYXMgaXIuQ29uc3RJbmRleDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdGFudCBleHByZXNzaW9ucyB1c2VkIGJ5IG9wZXJhdGlvbnMgd2l0aGluIHRoaXMgY29tcG9uZW50J3MgY29tcGlsYXRpb24uXG4gICAqXG4gICAqIFRoaXMgd2lsbCBldmVudHVhbGx5IGJlY29tZSB0aGUgYGNvbnN0c2AgYXJyYXkgaW4gdGhlIGNvbXBvbmVudCBkZWZpbml0aW9uLlxuICAgKi9cbiAgcmVhZG9ubHkgY29uc3RzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXphdGlvbiBzdGF0ZW1lbnRzIG5lZWRlZCB0byBzZXQgdXAgdGhlIGNvbnN0cy5cbiAgICovXG4gIHJlYWRvbmx5IGNvbnN0c0luaXRpYWxpemVyczogby5TdGF0ZW1lbnRbXSA9IFtdO1xufVxuXG4vKipcbiAqIEEgY29tcGlsYXRpb24gdW5pdCBpcyBjb21waWxlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24uIFNvbWUgZXhhbXBsZSB1bml0cyBhcmUgdmlld3MgYW5kIGhvc3RcbiAqIGJpbmRpbmdzLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ29tcGlsYXRpb25Vbml0IHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgeHJlZjogaXIuWHJlZklkKSB7fVxuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGNyZWF0aW9uIG9wZXJhdGlvbnMgZm9yIHRoaXMgdmlldy5cbiAgICpcbiAgICogQ3JlYXRpb24gb3BlcmF0aW9ucyBtYXkgaW50ZXJuYWxseSBjb250YWluIG90aGVyIG9wZXJhdGlvbnMsIGluY2x1ZGluZyB1cGRhdGUgb3BlcmF0aW9ucy5cbiAgICovXG4gIHJlYWRvbmx5IGNyZWF0ZSA9IG5ldyBpci5PcExpc3Q8aXIuQ3JlYXRlT3A+KCk7XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgdXBkYXRlIG9wZXJhdGlvbnMgZm9yIHRoaXMgdmlldy5cbiAgICovXG4gIHJlYWRvbmx5IHVwZGF0ZSA9IG5ldyBpci5PcExpc3Q8aXIuVXBkYXRlT3A+KCk7XG5cbiAgLyoqXG4gICAqIFRoZSBlbmNsb3Npbmcgam9iLCB3aGljaCBtaWdodCBjb250YWluIHNldmVyYWwgaW5kaXZpZHVhbCBjb21waWxhdGlvbiB1bml0cy5cbiAgICovXG4gIGFic3RyYWN0IHJlYWRvbmx5IGpvYjogQ29tcGlsYXRpb25Kb2I7XG5cbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGZ1bmN0aW9uIHdoaWNoIHdpbGwgYmUgZ2VuZXJhdGVkIGZvciB0aGlzIHVuaXQuXG4gICAqXG4gICAqIE1heSBiZSBgbnVsbGAgaWYgbm90IHlldCBkZXRlcm1pbmVkLlxuICAgKi9cbiAgZm5OYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiB2YXJpYWJsZSBzbG90cyB1c2VkIHdpdGhpbiB0aGlzIHZpZXcsIG9yIGBudWxsYCBpZiB2YXJpYWJsZXMgaGF2ZSBub3QgeWV0IGJlZW5cbiAgICogY291bnRlZC5cbiAgICovXG4gIHZhcnM6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogSXRlcmF0ZSBvdmVyIGFsbCBgaXIuT3BgcyB3aXRoaW4gdGhpcyB2aWV3LlxuICAgKlxuICAgKiBTb21lIG9wZXJhdGlvbnMgbWF5IGhhdmUgY2hpbGQgb3BlcmF0aW9ucywgd2hpY2ggdGhpcyBpdGVyYXRvciB3aWxsIHZpc2l0LlxuICAgKi9cbiAgKiBvcHMoKTogR2VuZXJhdG9yPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPiB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLmNyZWF0ZSkge1xuICAgICAgeWllbGQgb3A7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkxpc3RlbmVyIHx8IG9wLmtpbmQgPT09IGlyLk9wS2luZC5Ud29XYXlMaXN0ZW5lcikge1xuICAgICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICAgIHlpZWxkIGxpc3RlbmVyT3A7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLnVwZGF0ZSkge1xuICAgICAgeWllbGQgb3A7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYW4gaW5kaXZpZHVhbCB2aWV3IHdpdGhpbiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVmlld0NvbXBpbGF0aW9uVW5pdCBleHRlbmRzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgeHJlZjogaXIuWHJlZklkLCByZWFkb25seSBwYXJlbnQ6IGlyLlhyZWZJZHxudWxsKSB7XG4gICAgc3VwZXIoeHJlZik7XG4gIH1cblxuICAvKipcbiAgICogTWFwIG9mIGRlY2xhcmVkIHZhcmlhYmxlcyBhdmFpbGFibGUgd2l0aGluIHRoaXMgdmlldyB0byB0aGUgcHJvcGVydHkgb24gdGhlIGNvbnRleHQgb2JqZWN0XG4gICAqIHdoaWNoIHRoZXkgYWxpYXMuXG4gICAqL1xuICByZWFkb25seSBjb250ZXh0VmFyaWFibGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICAvKipcbiAgICogU2V0IG9mIGFsaWFzZXMgYXZhaWxhYmxlIHdpdGhpbiB0aGlzIHZpZXcuIEFuIGFsaWFzIGlzIGEgdmFyaWFibGUgd2hvc2UgcHJvdmlkZWQgZXhwcmVzc2lvbiBpc1xuICAgKiBpbmxpbmVkIGF0IGV2ZXJ5IGxvY2F0aW9uIGl0IGlzIHVzZWQuIEl0IG1heSBhbHNvIGRlcGVuZCBvbiBjb250ZXh0IHZhcmlhYmxlcywgYnkgbmFtZS5cbiAgICovXG4gIHJlYWRvbmx5IGFsaWFzZXMgPSBuZXcgU2V0PGlyLkFsaWFzVmFyaWFibGU+KCk7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBkZWNsYXJhdGlvbiBzbG90cyB1c2VkIHdpdGhpbiB0aGlzIHZpZXcsIG9yIGBudWxsYCBpZiBzbG90cyBoYXZlIG5vdCB5ZXQgYmVlblxuICAgKiBhbGxvY2F0ZWQuXG4gICAqL1xuICBkZWNsczogbnVtYmVyfG51bGwgPSBudWxsO1xufVxuXG4vKipcbiAqIENvbXBpbGF0aW9uLWluLXByb2dyZXNzIG9mIGEgaG9zdCBiaW5kaW5nLCB3aGljaCBjb250YWlucyBhIHNpbmdsZSB1bml0IGZvciB0aGF0IGhvc3QgYmluZGluZy5cbiAqL1xuZXhwb3J0IGNsYXNzIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IgZXh0ZW5kcyBDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0cnVjdG9yKGNvbXBvbmVudE5hbWU6IHN0cmluZywgcG9vbDogQ29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge1xuICAgIHN1cGVyKGNvbXBvbmVudE5hbWUsIHBvb2wsIGNvbXBhdGliaWxpdHkpO1xuICAgIHRoaXMucm9vdCA9IG5ldyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uVW5pdCh0aGlzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGtpbmQgPSBDb21waWxhdGlvbkpvYktpbmQuSG9zdDtcblxuICBvdmVycmlkZSByZWFkb25seSBmblN1ZmZpeDogc3RyaW5nID0gJ0hvc3RCaW5kaW5ncyc7XG5cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgcm9vdDogSG9zdEJpbmRpbmdDb21waWxhdGlvblVuaXQ7XG5cbiAgb3ZlcnJpZGUgZ2V0IHVuaXRzKCk6IEl0ZXJhYmxlPEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0PiB7XG4gICAgcmV0dXJuIFt0aGlzLnJvb3RdO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uVW5pdCBleHRlbmRzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYikge1xuICAgIHN1cGVyKDAgYXMgaXIuWHJlZklkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNdWNoIGxpa2UgYW4gZWxlbWVudCBjYW4gaGF2ZSBhdHRyaWJ1dGVzLCBzbyBjYW4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24uXG4gICAqL1xuICBhdHRyaWJ1dGVzOiBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCA9IG51bGw7XG59XG4iXX0=