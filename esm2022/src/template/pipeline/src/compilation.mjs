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
    constructor(componentName, isSignal, pool, compatibility) {
        this.componentName = componentName;
        this.isSignal = isSignal;
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
    constructor(componentName, isSignal, pool, compatibility, relativeContextFilePath, i18nUseExternalIds) {
        super(componentName, isSignal, pool, compatibility);
        this.relativeContextFilePath = relativeContextFilePath;
        this.i18nUseExternalIds = i18nUseExternalIds;
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
    constructor(componentName, isSignal, pool, compatibility) {
        super(componentName, isSignal, pool, compatibility);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE1BQU0sQ0FBTixJQUFZLGtCQUlYO0FBSkQsV0FBWSxrQkFBa0I7SUFDNUIsMkRBQUksQ0FBQTtJQUNKLDJEQUFJLENBQUE7SUFDSiwyREFBSSxDQUFBO0FBQ04sQ0FBQyxFQUpXLGtCQUFrQixLQUFsQixrQkFBa0IsUUFJN0I7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLGNBQWM7SUFDbEMsWUFDYSxhQUFxQixFQUFXLFFBQWlCLEVBQVcsSUFBa0IsRUFDOUUsYUFBbUM7UUFEbkMsa0JBQWEsR0FBYixhQUFhLENBQVE7UUFBVyxhQUFRLEdBQVIsUUFBUSxDQUFTO1FBQVcsU0FBSSxHQUFKLElBQUksQ0FBYztRQUM5RSxrQkFBYSxHQUFiLGFBQWEsQ0FBc0I7UUFFaEQsU0FBSSxHQUF1QixrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUEwQm5EOztXQUVHO1FBQ0ssZUFBVSxHQUFjLENBQWMsQ0FBQztJQS9CSSxDQUFDO0lBcUJwRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQWUsQ0FBQztJQUN4QyxDQUFDO0NBTUY7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsY0FBYztJQUN6RCxZQUNJLGFBQXFCLEVBQUUsUUFBaUIsRUFBRSxJQUFrQixFQUM1RCxhQUFtQyxFQUFXLHVCQUErQixFQUNwRSxrQkFBMkI7UUFDdEMsS0FBSyxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRkosNEJB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NUIsTUFBTSxFQUFFLENBQUM7U0FDVjtJQUNILENBQUM7Q0FDRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLG1CQUFvQixTQUFRLGVBQWU7SUFDdEQsWUFDYSxHQUE0QixFQUFFLElBQWUsRUFBVyxNQUFzQjtRQUN6RixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFERCxRQUFHLEdBQUgsR0FBRyxDQUF5QjtRQUE0QixXQUFNLEdBQU4sTUFBTSxDQUFnQjtRQUkzRjs7O1dBR0c7UUFDTSxxQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUV0RDs7O1dBR0c7UUFDSCxVQUFLLEdBQWdCLElBQUksQ0FBQztJQVoxQixDQUFDO0NBYUY7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyx5QkFBMEIsU0FBUSxjQUFjO0lBQzNELFlBQ0ksYUFBcUIsRUFBRSxRQUFpQixFQUFFLElBQWtCLEVBQzVELGFBQW1DO1FBQ3JDLEtBQUssQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUk3QyxTQUFJLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDO1FBRXRCLGFBQVEsR0FBVyxjQUFjLENBQUM7UUFMbEQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFRRCxJQUFhLEtBQUs7UUFDaEIsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sMEJBQTJCLFNBQVEsZUFBZTtJQUM3RCxZQUFxQixHQUE4QjtRQUNqRCxLQUFLLENBQUMsQ0FBYyxDQUFDLENBQUM7UUFESCxRQUFHLEdBQUgsR0FBRyxDQUEyQjtRQUluRDs7V0FFRztRQUNILGVBQVUsR0FBNEIsSUFBSSxDQUFDO0lBTDNDLENBQUM7Q0FNRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL2lyJztcblxuZXhwb3J0IGVudW0gQ29tcGlsYXRpb25Kb2JLaW5kIHtcbiAgVG1wbCxcbiAgSG9zdCxcbiAgQm90aCwgIC8vIEEgc3BlY2lhbCB2YWx1ZSB1c2VkIHRvIGluZGljYXRlIHRoYXQgc29tZSBsb2dpYyBhcHBsaWVzIHRvIGJvdGggY29tcGlsYXRpb24gdHlwZXNcbn1cblxuLyoqXG4gKiBBbiBlbnRpcmUgb25nb2luZyBjb21waWxhdGlvbiwgd2hpY2ggd2lsbCByZXN1bHQgaW4gb25lIG9yIG1vcmUgdGVtcGxhdGUgZnVuY3Rpb25zIHdoZW4gY29tcGxldGUuXG4gKiBDb250YWlucyBvbmUgb3IgbW9yZSBjb3JyZXNwb25kaW5nIGNvbXBpbGF0aW9uIHVuaXRzLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ29tcGlsYXRpb25Kb2Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IGNvbXBvbmVudE5hbWU6IHN0cmluZywgcmVhZG9ubHkgaXNTaWduYWw6IGJvb2xlYW4sIHJlYWRvbmx5IHBvb2w6IENvbnN0YW50UG9vbCxcbiAgICAgIHJlYWRvbmx5IGNvbXBhdGliaWxpdHk6IGlyLkNvbXBhdGliaWxpdHlNb2RlKSB7fVxuXG4gIGtpbmQ6IENvbXBpbGF0aW9uSm9iS2luZCA9IENvbXBpbGF0aW9uSm9iS2luZC5Cb3RoO1xuXG4gIC8qKlxuICAgKiBBIGNvbXBpbGF0aW9uIGpvYiB3aWxsIGNvbnRhaW4gb25lIG9yIG1vcmUgY29tcGlsYXRpb24gdW5pdHMuXG4gICAqL1xuICBhYnN0cmFjdCBnZXQgdW5pdHMoKTogSXRlcmFibGU8Q29tcGlsYXRpb25Vbml0PjtcblxuICAvKipcbiAgICogVGhlIHJvb3QgY29tcGlsYXRpb24gdW5pdCwgc3VjaCBhcyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUsIG9yIHRoZSBob3N0IGJpbmRpbmcncyBjb21waWxhdGlvblxuICAgKiB1bml0LlxuICAgKi9cbiAgYWJzdHJhY3Qgcm9vdDogQ29tcGlsYXRpb25Vbml0O1xuXG4gIC8qKlxuICAgKiBBIHVuaXF1ZSBzdHJpbmcgdXNlZCB0byBpZGVudGlmeSB0aGlzIGtpbmQgb2Ygam9iLCBhbmQgZ2VuZXJhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIChhcyBhXG4gICAqIHN1ZmZpeCBvZiB0aGUgbmFtZSkuXG4gICAqL1xuICBhYnN0cmFjdCBmblN1ZmZpeDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIG5ldyB1bmlxdWUgYGlyLlhyZWZJZGAgaW4gdGhpcyBqb2IuXG4gICAqL1xuICBhbGxvY2F0ZVhyZWZJZCgpOiBpci5YcmVmSWQge1xuICAgIHJldHVybiB0aGlzLm5leHRYcmVmSWQrKyBhcyBpci5YcmVmSWQ7XG4gIH1cblxuICAvKipcbiAgICogVHJhY2tzIHRoZSBuZXh0IGBpci5YcmVmSWRgIHdoaWNoIGNhbiBiZSBhc3NpZ25lZCBhcyB0ZW1wbGF0ZSBzdHJ1Y3R1cmVzIGFyZSBpbmdlc3RlZC5cbiAgICovXG4gIHByaXZhdGUgbmV4dFhyZWZJZDogaXIuWHJlZklkID0gMCBhcyBpci5YcmVmSWQ7XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYSB3aG9sZSBjb21wb25lbnQncyB0ZW1wbGF0ZSwgaW5jbHVkaW5nIHRoZSBtYWluIHRlbXBsYXRlIGFuZCBhbnlcbiAqIGVtYmVkZGVkIHZpZXdzIG9yIGhvc3QgYmluZGluZ3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRDb21waWxhdGlvbkpvYiBleHRlbmRzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIGlzU2lnbmFsOiBib29sZWFuLCBwb29sOiBDb25zdGFudFBvb2wsXG4gICAgICBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSwgcmVhZG9ubHkgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZyxcbiAgICAgIHJlYWRvbmx5IGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbikge1xuICAgIHN1cGVyKGNvbXBvbmVudE5hbWUsIGlzU2lnbmFsLCBwb29sLCBjb21wYXRpYmlsaXR5KTtcbiAgICB0aGlzLnJvb3QgPSBuZXcgVmlld0NvbXBpbGF0aW9uVW5pdCh0aGlzLCB0aGlzLmFsbG9jYXRlWHJlZklkKCksIG51bGwpO1xuICAgIHRoaXMudmlld3Muc2V0KHRoaXMucm9vdC54cmVmLCB0aGlzLnJvb3QpO1xuICB9XG5cbiAgb3ZlcnJpZGUga2luZCA9IENvbXBpbGF0aW9uSm9iS2luZC5UbXBsO1xuXG4gIG92ZXJyaWRlIHJlYWRvbmx5IGZuU3VmZml4OiBzdHJpbmcgPSAnVGVtcGxhdGUnO1xuXG4gIC8qKlxuICAgKiBUaGUgcm9vdCB2aWV3LCByZXByZXNlbnRpbmcgdGhlIGNvbXBvbmVudCdzIHRlbXBsYXRlLlxuICAgKi9cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgcm9vdDogVmlld0NvbXBpbGF0aW9uVW5pdDtcblxuICByZWFkb25seSB2aWV3cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBWaWV3Q29tcGlsYXRpb25Vbml0PigpO1xuXG4gIC8qKlxuICAgKiBDYXVzZXMgbmdDb250ZW50U2VsZWN0b3JzIHRvIGJlIGVtaXR0ZWQsIGZvciBjb250ZW50IHByb2plY3Rpb24gc2xvdHMgaW4gdGhlIHZpZXcuIFBvc3NpYmx5IGFcbiAgICogcmVmZXJlbmNlIGludG8gdGhlIGNvbnN0YW50IHBvb2wuXG4gICAqL1xuICBwdWJsaWMgY29udGVudFNlbGVjdG9yczogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBBZGQgYSBgVmlld0NvbXBpbGF0aW9uYCBmb3IgYSBuZXcgZW1iZWRkZWQgdmlldyB0byB0aGlzIGNvbXBpbGF0aW9uLlxuICAgKi9cbiAgYWxsb2NhdGVWaWV3KHBhcmVudDogaXIuWHJlZklkKTogVmlld0NvbXBpbGF0aW9uVW5pdCB7XG4gICAgY29uc3QgdmlldyA9IG5ldyBWaWV3Q29tcGlsYXRpb25Vbml0KHRoaXMsIHRoaXMuYWxsb2NhdGVYcmVmSWQoKSwgcGFyZW50KTtcbiAgICB0aGlzLnZpZXdzLnNldCh2aWV3LnhyZWYsIHZpZXcpO1xuICAgIHJldHVybiB2aWV3O1xuICB9XG5cbiAgb3ZlcnJpZGUgZ2V0IHVuaXRzKCk6IEl0ZXJhYmxlPFZpZXdDb21waWxhdGlvblVuaXQ+IHtcbiAgICByZXR1cm4gdGhpcy52aWV3cy52YWx1ZXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBjb25zdGFudCBgby5FeHByZXNzaW9uYCB0byB0aGUgY29tcGlsYXRpb24gYW5kIHJldHVybiBpdHMgaW5kZXggaW4gdGhlIGBjb25zdHNgIGFycmF5LlxuICAgKi9cbiAgYWRkQ29uc3QobmV3Q29uc3Q6IG8uRXhwcmVzc2lvbiwgaW5pdGlhbGl6ZXJzPzogby5TdGF0ZW1lbnRbXSk6IGlyLkNvbnN0SW5kZXgge1xuICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHRoaXMuY29uc3RzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGlmICh0aGlzLmNvbnN0c1tpZHhdLmlzRXF1aXZhbGVudChuZXdDb25zdCkpIHtcbiAgICAgICAgcmV0dXJuIGlkeCBhcyBpci5Db25zdEluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpZHggPSB0aGlzLmNvbnN0cy5sZW5ndGg7XG4gICAgdGhpcy5jb25zdHMucHVzaChuZXdDb25zdCk7XG4gICAgaWYgKGluaXRpYWxpemVycykge1xuICAgICAgdGhpcy5jb25zdHNJbml0aWFsaXplcnMucHVzaCguLi5pbml0aWFsaXplcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaWR4IGFzIGlyLkNvbnN0SW5kZXg7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RhbnQgZXhwcmVzc2lvbnMgdXNlZCBieSBvcGVyYXRpb25zIHdpdGhpbiB0aGlzIGNvbXBvbmVudCdzIGNvbXBpbGF0aW9uLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgZXZlbnR1YWxseSBiZWNvbWUgdGhlIGBjb25zdHNgIGFycmF5IGluIHRoZSBjb21wb25lbnQgZGVmaW5pdGlvbi5cbiAgICovXG4gIHJlYWRvbmx5IGNvbnN0czogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6YXRpb24gc3RhdGVtZW50cyBuZWVkZWQgdG8gc2V0IHVwIHRoZSBjb25zdHMuXG4gICAqL1xuICByZWFkb25seSBjb25zdHNJbml0aWFsaXplcnM6IG8uU3RhdGVtZW50W10gPSBbXTtcbn1cblxuLyoqXG4gKiBBIGNvbXBpbGF0aW9uIHVuaXQgaXMgY29tcGlsZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uLiBTb21lIGV4YW1wbGUgdW5pdHMgYXJlIHZpZXdzIGFuZCBob3N0XG4gKiBiaW5kaW5ncy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHhyZWY6IGlyLlhyZWZJZCkge31cblxuICAvKipcbiAgICogTGlzdCBvZiBjcmVhdGlvbiBvcGVyYXRpb25zIGZvciB0aGlzIHZpZXcuXG4gICAqXG4gICAqIENyZWF0aW9uIG9wZXJhdGlvbnMgbWF5IGludGVybmFsbHkgY29udGFpbiBvdGhlciBvcGVyYXRpb25zLCBpbmNsdWRpbmcgdXBkYXRlIG9wZXJhdGlvbnMuXG4gICAqL1xuICByZWFkb25seSBjcmVhdGUgPSBuZXcgaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPigpO1xuXG4gIC8qKlxuICAgKiBMaXN0IG9mIHVwZGF0ZSBvcGVyYXRpb25zIGZvciB0aGlzIHZpZXcuXG4gICAqL1xuICByZWFkb25seSB1cGRhdGUgPSBuZXcgaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPigpO1xuXG4gIC8qKlxuICAgKiBUaGUgZW5jbG9zaW5nIGpvYiwgd2hpY2ggbWlnaHQgY29udGFpbiBzZXZlcmFsIGluZGl2aWR1YWwgY29tcGlsYXRpb24gdW5pdHMuXG4gICAqL1xuICBhYnN0cmFjdCByZWFkb25seSBqb2I6IENvbXBpbGF0aW9uSm9iO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBmdW5jdGlvbiB3aGljaCB3aWxsIGJlIGdlbmVyYXRlZCBmb3IgdGhpcyB1bml0LlxuICAgKlxuICAgKiBNYXkgYmUgYG51bGxgIGlmIG5vdCB5ZXQgZGV0ZXJtaW5lZC5cbiAgICovXG4gIGZuTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBOdW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gdGhpcyB2aWV3LCBvciBgbnVsbGAgaWYgdmFyaWFibGVzIGhhdmUgbm90IHlldCBiZWVuXG4gICAqIGNvdW50ZWQuXG4gICAqL1xuICB2YXJzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgb3ZlciBhbGwgYGlyLk9wYHMgd2l0aGluIHRoaXMgdmlldy5cbiAgICpcbiAgICogU29tZSBvcGVyYXRpb25zIG1heSBoYXZlIGNoaWxkIG9wZXJhdGlvbnMsIHdoaWNoIHRoaXMgaXRlcmF0b3Igd2lsbCB2aXNpdC5cbiAgICovXG4gICogb3BzKCk6IEdlbmVyYXRvcjxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4ge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdGhpcy5jcmVhdGUpIHtcbiAgICAgIHlpZWxkIG9wO1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICAgIHlpZWxkIGxpc3RlbmVyT3A7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLnVwZGF0ZSkge1xuICAgICAgeWllbGQgb3A7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYW4gaW5kaXZpZHVhbCB2aWV3IHdpdGhpbiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVmlld0NvbXBpbGF0aW9uVW5pdCBleHRlbmRzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgeHJlZjogaXIuWHJlZklkLCByZWFkb25seSBwYXJlbnQ6IGlyLlhyZWZJZHxudWxsKSB7XG4gICAgc3VwZXIoeHJlZik7XG4gIH1cblxuICAvKipcbiAgICogTWFwIG9mIGRlY2xhcmVkIHZhcmlhYmxlcyBhdmFpbGFibGUgd2l0aGluIHRoaXMgdmlldyB0byB0aGUgcHJvcGVydHkgb24gdGhlIGNvbnRleHQgb2JqZWN0XG4gICAqIHdoaWNoIHRoZXkgYWxpYXMuXG4gICAqL1xuICByZWFkb25seSBjb250ZXh0VmFyaWFibGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICAvKipcbiAgICogTnVtYmVyIG9mIGRlY2xhcmF0aW9uIHNsb3RzIHVzZWQgd2l0aGluIHRoaXMgdmlldywgb3IgYG51bGxgIGlmIHNsb3RzIGhhdmUgbm90IHlldCBiZWVuXG4gICAqIGFsbG9jYXRlZC5cbiAgICovXG4gIGRlY2xzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYSBob3N0IGJpbmRpbmcsIHdoaWNoIGNvbnRhaW5zIGEgc2luZ2xlIHVuaXQgZm9yIHRoYXQgaG9zdCBiaW5kaW5nLlxuICovXG5leHBvcnQgY2xhc3MgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiBleHRlbmRzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIGlzU2lnbmFsOiBib29sZWFuLCBwb29sOiBDb25zdGFudFBvb2wsXG4gICAgICBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge1xuICAgIHN1cGVyKGNvbXBvbmVudE5hbWUsIGlzU2lnbmFsLCBwb29sLCBjb21wYXRpYmlsaXR5KTtcbiAgICB0aGlzLnJvb3QgPSBuZXcgSG9zdEJpbmRpbmdDb21waWxhdGlvblVuaXQodGhpcyk7XG4gIH1cblxuICBvdmVycmlkZSBraW5kID0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3Q7XG5cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgZm5TdWZmaXg6IHN0cmluZyA9ICdIb3N0QmluZGluZ3MnO1xuXG4gIG92ZXJyaWRlIHJlYWRvbmx5IHJvb3Q6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0O1xuXG4gIG92ZXJyaWRlIGdldCB1bml0cygpOiBJdGVyYWJsZTxIb3N0QmluZGluZ0NvbXBpbGF0aW9uVW5pdD4ge1xuICAgIHJldHVybiBbdGhpcy5yb290XTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSG9zdEJpbmRpbmdDb21waWxhdGlvblVuaXQgZXh0ZW5kcyBDb21waWxhdGlvblVuaXQge1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IpIHtcbiAgICBzdXBlcigwIGFzIGlyLlhyZWZJZCk7XG4gIH1cblxuICAvKipcbiAgICogTXVjaCBsaWtlIGFuIGVsZW1lbnQgY2FuIGhhdmUgYXR0cmlidXRlcywgc28gY2FuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uLlxuICAgKi9cbiAgYXR0cmlidXRlczogby5MaXRlcmFsQXJyYXlFeHByfG51bGwgPSBudWxsO1xufVxuIl19