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
    constructor(componentName, pool, compatibility, relativeContextFilePath, i18nUseExternalIds) {
        super(componentName, pool, compatibility);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE1BQU0sQ0FBTixJQUFZLGtCQUlYO0FBSkQsV0FBWSxrQkFBa0I7SUFDNUIsMkRBQUksQ0FBQTtJQUNKLDJEQUFJLENBQUE7SUFDSiwyREFBSSxDQUFBO0FBQ04sQ0FBQyxFQUpXLGtCQUFrQixLQUFsQixrQkFBa0IsUUFJN0I7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLGNBQWM7SUFDbEMsWUFDYSxhQUFxQixFQUFXLElBQWtCLEVBQ2xELGFBQW1DO1FBRG5DLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBQVcsU0FBSSxHQUFKLElBQUksQ0FBYztRQUNsRCxrQkFBYSxHQUFiLGFBQWEsQ0FBc0I7UUFFaEQsU0FBSSxHQUF1QixrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUEwQm5EOztXQUVHO1FBQ0ssZUFBVSxHQUFjLENBQWMsQ0FBQztJQS9CSSxDQUFDO0lBcUJwRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQWUsQ0FBQztJQUN4QyxDQUFDO0NBTUY7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsY0FBYztJQUN6RCxZQUNJLGFBQXFCLEVBQUUsSUFBa0IsRUFBRSxhQUFtQyxFQUNyRSx1QkFBK0IsRUFBVyxrQkFBMkI7UUFDaEYsS0FBSyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFEL0IsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUFRO1FBQVcsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFTO1FBTXpFLFNBQUksR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUFFdEIsYUFBUSxHQUFXLFVBQVUsQ0FBQztRQU92QyxVQUFLLEdBQUcsSUFBSSxHQUFHLEVBQWtDLENBQUM7UUFFM0Q7OztXQUdHO1FBQ0kscUJBQWdCLEdBQXNCLElBQUksQ0FBQztRQWdDbEQ7Ozs7V0FJRztRQUNNLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBRXJDOztXQUVHO1FBQ00sdUJBQWtCLEdBQWtCLEVBQUUsQ0FBQztRQTdEOUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdkUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFtQkQ7O09BRUc7SUFDSCxZQUFZLENBQUMsTUFBaUI7UUFDNUIsTUFBTSxJQUFJLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDaEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsSUFBYSxLQUFLO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRLENBQUMsUUFBc0IsRUFBRSxZQUE0QjtRQUMzRCxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUU7WUFDakQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDM0MsT0FBTyxHQUFvQixDQUFDO2FBQzdCO1NBQ0Y7UUFDRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzQixJQUFJLFlBQVksRUFBRTtZQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7U0FDL0M7UUFDRCxPQUFPLEdBQW9CLENBQUM7SUFDOUIsQ0FBQztDQWFGO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxPQUFnQixlQUFlO0lBQ25DLFlBQXFCLElBQWU7UUFBZixTQUFJLEdBQUosSUFBSSxDQUFXO1FBRXBDOzs7O1dBSUc7UUFDTSxXQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFlLENBQUM7UUFFL0M7O1dBRUc7UUFDTSxXQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFlLENBQUM7UUFPL0M7Ozs7V0FJRztRQUNILFdBQU0sR0FBZ0IsSUFBSSxDQUFDO1FBRTNCOzs7V0FHRztRQUNILFNBQUksR0FBZ0IsSUFBSSxDQUFDO0lBOUJjLENBQUM7SUFnQ3hDOzs7O09BSUc7SUFDSCxDQUFFLEdBQUc7UUFDSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsTUFBTSxFQUFFLENBQUM7WUFDVCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xDLEtBQUssTUFBTSxVQUFVLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRTtvQkFDdEMsTUFBTSxVQUFVLENBQUM7aUJBQ2xCO2FBQ0Y7U0FDRjtRQUNELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixNQUFNLEVBQUUsQ0FBQztTQUNWO0lBQ0gsQ0FBQztDQUNGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sbUJBQW9CLFNBQVEsZUFBZTtJQUN0RCxZQUNhLEdBQTRCLEVBQUUsSUFBZSxFQUFXLE1BQXNCO1FBQ3pGLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQURELFFBQUcsR0FBSCxHQUFHLENBQXlCO1FBQTRCLFdBQU0sR0FBTixNQUFNLENBQWdCO1FBSTNGOzs7V0FHRztRQUNNLHFCQUFnQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBRXREOzs7V0FHRztRQUNNLFlBQU8sR0FBRyxJQUFJLEdBQUcsRUFBb0IsQ0FBQztRQUUvQzs7O1dBR0c7UUFDSCxVQUFLLEdBQWdCLElBQUksQ0FBQztJQWxCMUIsQ0FBQztDQW1CRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLHlCQUEwQixTQUFRLGNBQWM7SUFDM0QsWUFBWSxhQUFxQixFQUFFLElBQWtCLEVBQUUsYUFBbUM7UUFDeEYsS0FBSyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFJbkMsU0FBSSxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQztRQUV0QixhQUFRLEdBQVcsY0FBYyxDQUFDO1FBTGxELElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSwwQkFBMEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBUUQsSUFBYSxLQUFLO1FBQ2hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLDBCQUEyQixTQUFRLGVBQWU7SUFDN0QsWUFBcUIsR0FBOEI7UUFDakQsS0FBSyxDQUFDLENBQWMsQ0FBQyxDQUFDO1FBREgsUUFBRyxHQUFILEdBQUcsQ0FBMkI7UUFJbkQ7O1dBRUc7UUFDSCxlQUFVLEdBQTRCLElBQUksQ0FBQztJQUwzQyxDQUFDO0NBTUYiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmV4cG9ydCBlbnVtIENvbXBpbGF0aW9uSm9iS2luZCB7XG4gIFRtcGwsXG4gIEhvc3QsXG4gIEJvdGgsICAvLyBBIHNwZWNpYWwgdmFsdWUgdXNlZCB0byBpbmRpY2F0ZSB0aGF0IHNvbWUgbG9naWMgYXBwbGllcyB0byBib3RoIGNvbXBpbGF0aW9uIHR5cGVzXG59XG5cbi8qKlxuICogQW4gZW50aXJlIG9uZ29pbmcgY29tcGlsYXRpb24sIHdoaWNoIHdpbGwgcmVzdWx0IGluIG9uZSBvciBtb3JlIHRlbXBsYXRlIGZ1bmN0aW9ucyB3aGVuIGNvbXBsZXRlLlxuICogQ29udGFpbnMgb25lIG9yIG1vcmUgY29ycmVzcG9uZGluZyBjb21waWxhdGlvbiB1bml0cy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBjb21wb25lbnROYW1lOiBzdHJpbmcsIHJlYWRvbmx5IHBvb2w6IENvbnN0YW50UG9vbCxcbiAgICAgIHJlYWRvbmx5IGNvbXBhdGliaWxpdHk6IGlyLkNvbXBhdGliaWxpdHlNb2RlKSB7fVxuXG4gIGtpbmQ6IENvbXBpbGF0aW9uSm9iS2luZCA9IENvbXBpbGF0aW9uSm9iS2luZC5Cb3RoO1xuXG4gIC8qKlxuICAgKiBBIGNvbXBpbGF0aW9uIGpvYiB3aWxsIGNvbnRhaW4gb25lIG9yIG1vcmUgY29tcGlsYXRpb24gdW5pdHMuXG4gICAqL1xuICBhYnN0cmFjdCBnZXQgdW5pdHMoKTogSXRlcmFibGU8Q29tcGlsYXRpb25Vbml0PjtcblxuICAvKipcbiAgICogVGhlIHJvb3QgY29tcGlsYXRpb24gdW5pdCwgc3VjaCBhcyB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUsIG9yIHRoZSBob3N0IGJpbmRpbmcncyBjb21waWxhdGlvblxuICAgKiB1bml0LlxuICAgKi9cbiAgYWJzdHJhY3Qgcm9vdDogQ29tcGlsYXRpb25Vbml0O1xuXG4gIC8qKlxuICAgKiBBIHVuaXF1ZSBzdHJpbmcgdXNlZCB0byBpZGVudGlmeSB0aGlzIGtpbmQgb2Ygam9iLCBhbmQgZ2VuZXJhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIChhcyBhXG4gICAqIHN1ZmZpeCBvZiB0aGUgbmFtZSkuXG4gICAqL1xuICBhYnN0cmFjdCBmblN1ZmZpeDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIG5ldyB1bmlxdWUgYGlyLlhyZWZJZGAgaW4gdGhpcyBqb2IuXG4gICAqL1xuICBhbGxvY2F0ZVhyZWZJZCgpOiBpci5YcmVmSWQge1xuICAgIHJldHVybiB0aGlzLm5leHRYcmVmSWQrKyBhcyBpci5YcmVmSWQ7XG4gIH1cblxuICAvKipcbiAgICogVHJhY2tzIHRoZSBuZXh0IGBpci5YcmVmSWRgIHdoaWNoIGNhbiBiZSBhc3NpZ25lZCBhcyB0ZW1wbGF0ZSBzdHJ1Y3R1cmVzIGFyZSBpbmdlc3RlZC5cbiAgICovXG4gIHByaXZhdGUgbmV4dFhyZWZJZDogaXIuWHJlZklkID0gMCBhcyBpci5YcmVmSWQ7XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYSB3aG9sZSBjb21wb25lbnQncyB0ZW1wbGF0ZSwgaW5jbHVkaW5nIHRoZSBtYWluIHRlbXBsYXRlIGFuZCBhbnlcbiAqIGVtYmVkZGVkIHZpZXdzIG9yIGhvc3QgYmluZGluZ3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRDb21waWxhdGlvbkpvYiBleHRlbmRzIENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIHBvb2w6IENvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eTogaXIuQ29tcGF0aWJpbGl0eU1vZGUsXG4gICAgICByZWFkb25seSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLCByZWFkb25seSBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4pIHtcbiAgICBzdXBlcihjb21wb25lbnROYW1lLCBwb29sLCBjb21wYXRpYmlsaXR5KTtcbiAgICB0aGlzLnJvb3QgPSBuZXcgVmlld0NvbXBpbGF0aW9uVW5pdCh0aGlzLCB0aGlzLmFsbG9jYXRlWHJlZklkKCksIG51bGwpO1xuICAgIHRoaXMudmlld3Muc2V0KHRoaXMucm9vdC54cmVmLCB0aGlzLnJvb3QpO1xuICB9XG5cbiAgb3ZlcnJpZGUga2luZCA9IENvbXBpbGF0aW9uSm9iS2luZC5UbXBsO1xuXG4gIG92ZXJyaWRlIHJlYWRvbmx5IGZuU3VmZml4OiBzdHJpbmcgPSAnVGVtcGxhdGUnO1xuXG4gIC8qKlxuICAgKiBUaGUgcm9vdCB2aWV3LCByZXByZXNlbnRpbmcgdGhlIGNvbXBvbmVudCdzIHRlbXBsYXRlLlxuICAgKi9cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgcm9vdDogVmlld0NvbXBpbGF0aW9uVW5pdDtcblxuICByZWFkb25seSB2aWV3cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBWaWV3Q29tcGlsYXRpb25Vbml0PigpO1xuXG4gIC8qKlxuICAgKiBDYXVzZXMgbmdDb250ZW50U2VsZWN0b3JzIHRvIGJlIGVtaXR0ZWQsIGZvciBjb250ZW50IHByb2plY3Rpb24gc2xvdHMgaW4gdGhlIHZpZXcuIFBvc3NpYmx5IGFcbiAgICogcmVmZXJlbmNlIGludG8gdGhlIGNvbnN0YW50IHBvb2wuXG4gICAqL1xuICBwdWJsaWMgY29udGVudFNlbGVjdG9yczogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBBZGQgYSBgVmlld0NvbXBpbGF0aW9uYCBmb3IgYSBuZXcgZW1iZWRkZWQgdmlldyB0byB0aGlzIGNvbXBpbGF0aW9uLlxuICAgKi9cbiAgYWxsb2NhdGVWaWV3KHBhcmVudDogaXIuWHJlZklkKTogVmlld0NvbXBpbGF0aW9uVW5pdCB7XG4gICAgY29uc3QgdmlldyA9IG5ldyBWaWV3Q29tcGlsYXRpb25Vbml0KHRoaXMsIHRoaXMuYWxsb2NhdGVYcmVmSWQoKSwgcGFyZW50KTtcbiAgICB0aGlzLnZpZXdzLnNldCh2aWV3LnhyZWYsIHZpZXcpO1xuICAgIHJldHVybiB2aWV3O1xuICB9XG5cbiAgb3ZlcnJpZGUgZ2V0IHVuaXRzKCk6IEl0ZXJhYmxlPFZpZXdDb21waWxhdGlvblVuaXQ+IHtcbiAgICByZXR1cm4gdGhpcy52aWV3cy52YWx1ZXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBjb25zdGFudCBgby5FeHByZXNzaW9uYCB0byB0aGUgY29tcGlsYXRpb24gYW5kIHJldHVybiBpdHMgaW5kZXggaW4gdGhlIGBjb25zdHNgIGFycmF5LlxuICAgKi9cbiAgYWRkQ29uc3QobmV3Q29uc3Q6IG8uRXhwcmVzc2lvbiwgaW5pdGlhbGl6ZXJzPzogby5TdGF0ZW1lbnRbXSk6IGlyLkNvbnN0SW5kZXgge1xuICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHRoaXMuY29uc3RzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGlmICh0aGlzLmNvbnN0c1tpZHhdLmlzRXF1aXZhbGVudChuZXdDb25zdCkpIHtcbiAgICAgICAgcmV0dXJuIGlkeCBhcyBpci5Db25zdEluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpZHggPSB0aGlzLmNvbnN0cy5sZW5ndGg7XG4gICAgdGhpcy5jb25zdHMucHVzaChuZXdDb25zdCk7XG4gICAgaWYgKGluaXRpYWxpemVycykge1xuICAgICAgdGhpcy5jb25zdHNJbml0aWFsaXplcnMucHVzaCguLi5pbml0aWFsaXplcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaWR4IGFzIGlyLkNvbnN0SW5kZXg7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RhbnQgZXhwcmVzc2lvbnMgdXNlZCBieSBvcGVyYXRpb25zIHdpdGhpbiB0aGlzIGNvbXBvbmVudCdzIGNvbXBpbGF0aW9uLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgZXZlbnR1YWxseSBiZWNvbWUgdGhlIGBjb25zdHNgIGFycmF5IGluIHRoZSBjb21wb25lbnQgZGVmaW5pdGlvbi5cbiAgICovXG4gIHJlYWRvbmx5IGNvbnN0czogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6YXRpb24gc3RhdGVtZW50cyBuZWVkZWQgdG8gc2V0IHVwIHRoZSBjb25zdHMuXG4gICAqL1xuICByZWFkb25seSBjb25zdHNJbml0aWFsaXplcnM6IG8uU3RhdGVtZW50W10gPSBbXTtcbn1cblxuLyoqXG4gKiBBIGNvbXBpbGF0aW9uIHVuaXQgaXMgY29tcGlsZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uLiBTb21lIGV4YW1wbGUgdW5pdHMgYXJlIHZpZXdzIGFuZCBob3N0XG4gKiBiaW5kaW5ncy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHhyZWY6IGlyLlhyZWZJZCkge31cblxuICAvKipcbiAgICogTGlzdCBvZiBjcmVhdGlvbiBvcGVyYXRpb25zIGZvciB0aGlzIHZpZXcuXG4gICAqXG4gICAqIENyZWF0aW9uIG9wZXJhdGlvbnMgbWF5IGludGVybmFsbHkgY29udGFpbiBvdGhlciBvcGVyYXRpb25zLCBpbmNsdWRpbmcgdXBkYXRlIG9wZXJhdGlvbnMuXG4gICAqL1xuICByZWFkb25seSBjcmVhdGUgPSBuZXcgaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPigpO1xuXG4gIC8qKlxuICAgKiBMaXN0IG9mIHVwZGF0ZSBvcGVyYXRpb25zIGZvciB0aGlzIHZpZXcuXG4gICAqL1xuICByZWFkb25seSB1cGRhdGUgPSBuZXcgaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPigpO1xuXG4gIC8qKlxuICAgKiBUaGUgZW5jbG9zaW5nIGpvYiwgd2hpY2ggbWlnaHQgY29udGFpbiBzZXZlcmFsIGluZGl2aWR1YWwgY29tcGlsYXRpb24gdW5pdHMuXG4gICAqL1xuICBhYnN0cmFjdCByZWFkb25seSBqb2I6IENvbXBpbGF0aW9uSm9iO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBmdW5jdGlvbiB3aGljaCB3aWxsIGJlIGdlbmVyYXRlZCBmb3IgdGhpcyB1bml0LlxuICAgKlxuICAgKiBNYXkgYmUgYG51bGxgIGlmIG5vdCB5ZXQgZGV0ZXJtaW5lZC5cbiAgICovXG4gIGZuTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBOdW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gdGhpcyB2aWV3LCBvciBgbnVsbGAgaWYgdmFyaWFibGVzIGhhdmUgbm90IHlldCBiZWVuXG4gICAqIGNvdW50ZWQuXG4gICAqL1xuICB2YXJzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgb3ZlciBhbGwgYGlyLk9wYHMgd2l0aGluIHRoaXMgdmlldy5cbiAgICpcbiAgICogU29tZSBvcGVyYXRpb25zIG1heSBoYXZlIGNoaWxkIG9wZXJhdGlvbnMsIHdoaWNoIHRoaXMgaXRlcmF0b3Igd2lsbCB2aXNpdC5cbiAgICovXG4gICogb3BzKCk6IEdlbmVyYXRvcjxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4ge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdGhpcy5jcmVhdGUpIHtcbiAgICAgIHlpZWxkIG9wO1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICAgIHlpZWxkIGxpc3RlbmVyT3A7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLnVwZGF0ZSkge1xuICAgICAgeWllbGQgb3A7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29tcGlsYXRpb24taW4tcHJvZ3Jlc3Mgb2YgYW4gaW5kaXZpZHVhbCB2aWV3IHdpdGhpbiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVmlld0NvbXBpbGF0aW9uVW5pdCBleHRlbmRzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgeHJlZjogaXIuWHJlZklkLCByZWFkb25seSBwYXJlbnQ6IGlyLlhyZWZJZHxudWxsKSB7XG4gICAgc3VwZXIoeHJlZik7XG4gIH1cblxuICAvKipcbiAgICogTWFwIG9mIGRlY2xhcmVkIHZhcmlhYmxlcyBhdmFpbGFibGUgd2l0aGluIHRoaXMgdmlldyB0byB0aGUgcHJvcGVydHkgb24gdGhlIGNvbnRleHQgb2JqZWN0XG4gICAqIHdoaWNoIHRoZXkgYWxpYXMuXG4gICAqL1xuICByZWFkb25seSBjb250ZXh0VmFyaWFibGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICAvKipcbiAgICogU2V0IG9mIGFsaWFzZXMgYXZhaWxhYmxlIHdpdGhpbiB0aGlzIHZpZXcuIEFuIGFsaWFzIGlzIGEgdmFyaWFibGUgd2hvc2UgcHJvdmlkZWQgZXhwcmVzc2lvbiBpc1xuICAgKiBpbmxpbmVkIGF0IGV2ZXJ5IGxvY2F0aW9uIGl0IGlzIHVzZWQuIEl0IG1heSBhbHNvIGRlcGVuZCBvbiBjb250ZXh0IHZhcmlhYmxlcywgYnkgbmFtZS5cbiAgICovXG4gIHJlYWRvbmx5IGFsaWFzZXMgPSBuZXcgU2V0PGlyLkFsaWFzVmFyaWFibGU+KCk7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBkZWNsYXJhdGlvbiBzbG90cyB1c2VkIHdpdGhpbiB0aGlzIHZpZXcsIG9yIGBudWxsYCBpZiBzbG90cyBoYXZlIG5vdCB5ZXQgYmVlblxuICAgKiBhbGxvY2F0ZWQuXG4gICAqL1xuICBkZWNsczogbnVtYmVyfG51bGwgPSBudWxsO1xufVxuXG4vKipcbiAqIENvbXBpbGF0aW9uLWluLXByb2dyZXNzIG9mIGEgaG9zdCBiaW5kaW5nLCB3aGljaCBjb250YWlucyBhIHNpbmdsZSB1bml0IGZvciB0aGF0IGhvc3QgYmluZGluZy5cbiAqL1xuZXhwb3J0IGNsYXNzIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IgZXh0ZW5kcyBDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0cnVjdG9yKGNvbXBvbmVudE5hbWU6IHN0cmluZywgcG9vbDogQ29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge1xuICAgIHN1cGVyKGNvbXBvbmVudE5hbWUsIHBvb2wsIGNvbXBhdGliaWxpdHkpO1xuICAgIHRoaXMucm9vdCA9IG5ldyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uVW5pdCh0aGlzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGtpbmQgPSBDb21waWxhdGlvbkpvYktpbmQuSG9zdDtcblxuICBvdmVycmlkZSByZWFkb25seSBmblN1ZmZpeDogc3RyaW5nID0gJ0hvc3RCaW5kaW5ncyc7XG5cbiAgb3ZlcnJpZGUgcmVhZG9ubHkgcm9vdDogSG9zdEJpbmRpbmdDb21waWxhdGlvblVuaXQ7XG5cbiAgb3ZlcnJpZGUgZ2V0IHVuaXRzKCk6IEl0ZXJhYmxlPEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0PiB7XG4gICAgcmV0dXJuIFt0aGlzLnJvb3RdO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uVW5pdCBleHRlbmRzIENvbXBpbGF0aW9uVW5pdCB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYikge1xuICAgIHN1cGVyKDAgYXMgaXIuWHJlZklkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNdWNoIGxpa2UgYW4gZWxlbWVudCBjYW4gaGF2ZSBhdHRyaWJ1dGVzLCBzbyBjYW4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24uXG4gICAqL1xuICBhdHRyaWJ1dGVzOiBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCA9IG51bGw7XG59XG4iXX0=