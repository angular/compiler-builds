/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Some `defer` conditions can reference other elements in the template, using their local reference
 * names. However, the semantics are quite different from the normal local reference system: in
 * particular, we need to look at local reference names in enclosing views. This phase resolves
 * all such references to actual xrefs.
 */
export function resolveDeferTargetNames(job) {
    const scopes = new Map();
    function getScopeForView(view) {
        if (scopes.has(view.xref)) {
            return scopes.get(view.xref);
        }
        const scope = new Scope();
        for (const op of view.create) {
            // add everything that can be referenced.
            if (!ir.isElementOrContainerOp(op) || op.localRefs === null) {
                continue;
            }
            if (!Array.isArray(op.localRefs)) {
                throw new Error('LocalRefs were already processed, but were needed to resolve defer targets.');
            }
            for (const ref of op.localRefs) {
                if (ref.target !== '') {
                    continue;
                }
                scope.targets.set(ref.name, { xref: op.xref, slot: op.handle });
            }
        }
        scopes.set(view.xref, scope);
        return scope;
    }
    function resolveTrigger(deferOwnerView, op, placeholderView) {
        switch (op.trigger.kind) {
            case ir.DeferTriggerKind.Idle:
            case ir.DeferTriggerKind.Immediate:
            case ir.DeferTriggerKind.Timer:
                return;
            case ir.DeferTriggerKind.Hover:
            case ir.DeferTriggerKind.Interaction:
            case ir.DeferTriggerKind.Viewport:
                if (op.trigger.targetName === null) {
                    return;
                }
                let view = placeholderView !== null ? job.views.get(placeholderView) : deferOwnerView;
                let step = placeholderView !== null ? -1 : 0;
                while (view !== null) {
                    const scope = getScopeForView(view);
                    if (scope.targets.has(op.trigger.targetName)) {
                        const { xref, slot } = scope.targets.get(op.trigger.targetName);
                        op.trigger.targetXref = xref;
                        op.trigger.targetView = view.xref;
                        op.trigger.targetSlotViewSteps = step;
                        op.trigger.targetSlot = slot;
                        return;
                    }
                    view = view.parent !== null ? job.views.get(view.parent) : null;
                    step++;
                }
                break;
            default:
                throw new Error(`Trigger kind ${op.trigger.kind} not handled`);
        }
    }
    // Find the defer ops, and assign the data about their targets.
    for (const unit of job.units) {
        const defers = new Map();
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.Defer:
                    defers.set(op.xref, op);
                    break;
                case ir.OpKind.DeferOn:
                    const deferOp = defers.get(op.defer);
                    resolveTrigger(unit, op, deferOp.placeholderView);
                    break;
            }
        }
    }
}
class Scope {
    constructor() {
        this.targets = new Map();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJfcmVzb2x2ZV90YXJnZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZGVmZXJfcmVzb2x2ZV90YXJnZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUFDLEdBQTRCO0lBQ2xFLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxFQUFvQixDQUFDO0lBRTNDLFNBQVMsZUFBZSxDQUFDLElBQXlCO1FBQ2hELElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDekIsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUUsQ0FBQztTQUMvQjtRQUVELE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7UUFDMUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLHlDQUF5QztZQUN6QyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO2dCQUMzRCxTQUFTO2FBQ1Y7WUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQ1gsNkVBQTZFLENBQUMsQ0FBQzthQUNwRjtZQUVELEtBQUssTUFBTSxHQUFHLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRTtnQkFDOUIsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEVBQUUsRUFBRTtvQkFDckIsU0FBUztp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QUFDLE1BQU0sQ0FBQyxLQUFLO29CQUNsQixNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3hCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87b0JBQ3BCLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBRSxDQUFDO29CQUN0QyxjQUFjLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQ2xELE1BQU07YUFDVDtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsTUFBTSxLQUFLO0lBQVg7UUFDRSxZQUFPLEdBQUcsSUFBSSxHQUFHLEVBQWtELENBQUM7SUFDdEUsQ0FBQztDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtWaWV3Q29tcGlsYXRpb25Vbml0LCBDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFNvbWUgYGRlZmVyYCBjb25kaXRpb25zIGNhbiByZWZlcmVuY2Ugb3RoZXIgZWxlbWVudHMgaW4gdGhlIHRlbXBsYXRlLCB1c2luZyB0aGVpciBsb2NhbCByZWZlcmVuY2VcbiAqIG5hbWVzLiBIb3dldmVyLCB0aGUgc2VtYW50aWNzIGFyZSBxdWl0ZSBkaWZmZXJlbnQgZnJvbSB0aGUgbm9ybWFsIGxvY2FsIHJlZmVyZW5jZSBzeXN0ZW06IGluXG4gKiBwYXJ0aWN1bGFyLCB3ZSBuZWVkIHRvIGxvb2sgYXQgbG9jYWwgcmVmZXJlbmNlIG5hbWVzIGluIGVuY2xvc2luZyB2aWV3cy4gVGhpcyBwaGFzZSByZXNvbHZlc1xuICogYWxsIHN1Y2ggcmVmZXJlbmNlcyB0byBhY3R1YWwgeHJlZnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRGVmZXJUYXJnZXROYW1lcyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGNvbnN0IHNjb3BlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBTY29wZT4oKTtcblxuICBmdW5jdGlvbiBnZXRTY29wZUZvclZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCk6IFNjb3BlIHtcbiAgICBpZiAoc2NvcGVzLmhhcyh2aWV3LnhyZWYpKSB7XG4gICAgICByZXR1cm4gc2NvcGVzLmdldCh2aWV3LnhyZWYpITtcbiAgICB9XG5cbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSgpO1xuICAgIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICAgIC8vIGFkZCBldmVyeXRoaW5nIHRoYXQgY2FuIGJlIHJlZmVyZW5jZWQuXG4gICAgICBpZiAoIWlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApIHx8IG9wLmxvY2FsUmVmcyA9PT0gbnVsbCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShvcC5sb2NhbFJlZnMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdMb2NhbFJlZnMgd2VyZSBhbHJlYWR5IHByb2Nlc3NlZCwgYnV0IHdlcmUgbmVlZGVkIHRvIHJlc29sdmUgZGVmZXIgdGFyZ2V0cy4nKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCByZWYgb2Ygb3AubG9jYWxSZWZzKSB7XG4gICAgICAgIGlmIChyZWYudGFyZ2V0ICE9PSAnJykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHNjb3BlLnRhcmdldHMuc2V0KHJlZi5uYW1lLCB7eHJlZjogb3AueHJlZiwgc2xvdDogb3AuaGFuZGxlfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2NvcGVzLnNldCh2aWV3LnhyZWYsIHNjb3BlKTtcbiAgICByZXR1cm4gc2NvcGU7XG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlVHJpZ2dlcihcbiAgICAgIGRlZmVyT3duZXJWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuRGVmZXJPbk9wLFxuICAgICAgcGxhY2Vob2xkZXJWaWV3OiBpci5YcmVmSWR8bnVsbCk6IHZvaWQge1xuICAgIHN3aXRjaCAob3AudHJpZ2dlci5raW5kKSB7XG4gICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZTpcbiAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGU6XG4gICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuVGltZXI6XG4gICAgICAgIHJldHVybjtcbiAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcjpcbiAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbjpcbiAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5WaWV3cG9ydDpcbiAgICAgICAgaWYgKG9wLnRyaWdnZXIudGFyZ2V0TmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdHxudWxsID1cbiAgICAgICAgICAgIHBsYWNlaG9sZGVyVmlldyAhPT0gbnVsbCA/IGpvYi52aWV3cy5nZXQocGxhY2Vob2xkZXJWaWV3KSEgOiBkZWZlck93bmVyVmlldztcbiAgICAgICAgbGV0IHN0ZXAgPSBwbGFjZWhvbGRlclZpZXcgIT09IG51bGwgPyAtMSA6IDA7XG5cbiAgICAgICAgd2hpbGUgKHZpZXcgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBzY29wZSA9IGdldFNjb3BlRm9yVmlldyh2aWV3KTtcbiAgICAgICAgICBpZiAoc2NvcGUudGFyZ2V0cy5oYXMob3AudHJpZ2dlci50YXJnZXROYW1lKSkge1xuICAgICAgICAgICAgY29uc3Qge3hyZWYsIHNsb3R9ID0gc2NvcGUudGFyZ2V0cy5nZXQob3AudHJpZ2dlci50YXJnZXROYW1lKSE7XG5cbiAgICAgICAgICAgIG9wLnRyaWdnZXIudGFyZ2V0WHJlZiA9IHhyZWY7XG4gICAgICAgICAgICBvcC50cmlnZ2VyLnRhcmdldFZpZXcgPSB2aWV3LnhyZWY7XG4gICAgICAgICAgICBvcC50cmlnZ2VyLnRhcmdldFNsb3RWaWV3U3RlcHMgPSBzdGVwO1xuICAgICAgICAgICAgb3AudHJpZ2dlci50YXJnZXRTbG90ID0gc2xvdDtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2aWV3ID0gdmlldy5wYXJlbnQgIT09IG51bGwgPyBqb2Iudmlld3MuZ2V0KHZpZXcucGFyZW50KSEgOiBudWxsO1xuICAgICAgICAgIHN0ZXArKztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVHJpZ2dlciBraW5kICR7KG9wLnRyaWdnZXIgYXMgYW55KS5raW5kfSBub3QgaGFuZGxlZGApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpbmQgdGhlIGRlZmVyIG9wcywgYW5kIGFzc2lnbiB0aGUgZGF0YSBhYm91dCB0aGVpciB0YXJnZXRzLlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZGVmZXJzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkRlZmVyT3A+KCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkRlZmVyOlxuICAgICAgICAgIGRlZmVycy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5EZWZlck9uOlxuICAgICAgICAgIGNvbnN0IGRlZmVyT3AgPSBkZWZlcnMuZ2V0KG9wLmRlZmVyKSE7XG4gICAgICAgICAgcmVzb2x2ZVRyaWdnZXIodW5pdCwgb3AsIGRlZmVyT3AucGxhY2Vob2xkZXJWaWV3KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2NvcGUge1xuICB0YXJnZXRzID0gbmV3IE1hcDxzdHJpbmcsIHt4cmVmOiBpci5YcmVmSWQsIHNsb3Q6IGlyLlNsb3RIYW5kbGV9PigpO1xufVxuIl19