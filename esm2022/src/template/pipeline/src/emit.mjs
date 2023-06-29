/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../src/output/output_ast';
import * as ir from '../ir';
import { phaseAlignPipeVariadicVarOffset } from './phases/align_pipe_variadic_var_offset';
import { phaseAttributeExtraction } from './phases/attribute_extraction';
import { phaseChaining } from './phases/chaining';
import { phaseConstCollection } from './phases/const_collection';
import { phaseEmptyElements } from './phases/empty_elements';
import { phaseGenerateAdvance } from './phases/generate_advance';
import { phaseNullishCoalescing } from './phases/nullish_coalescing';
import { phaseGenerateVariables } from './phases/generate_variables';
import { phaseLocalRefs } from './phases/local_refs';
import { phaseNaming } from './phases/naming';
import { phaseMergeNextContext } from './phases/next_context_merging';
import { phaseNgContainer } from './phases/ng_container';
import { phasePipeCreation } from './phases/pipe_creation';
import { phasePipeVariadic } from './phases/pipe_variadic';
import { phasePureFunctionExtraction } from './phases/pure_function_extraction';
import { phasePureLiteralStructures } from './phases/pure_literal_structures';
import { phaseReify } from './phases/reify';
import { phaseResolveContexts } from './phases/resolve_contexts';
import { phaseResolveNames } from './phases/resolve_names';
import { phaseSaveRestoreView } from './phases/save_restore_view';
import { phaseSlotAllocation } from './phases/slot_allocation';
import { phaseVarCounting } from './phases/var_counting';
import { phaseVariableOptimization } from './phases/variable_optimization';
import { phaseExpandSafeReads } from './phases/expand_safe_reads';
import { phaseTemporaryVariables } from './phases/temporary_variables';
/**
 * Run all transformation phases in the correct order against a `ComponentCompilation`. After this
 * processing, the compilation should be in a state where it can be emitted via `emitTemplateFn`.s
 */
export function transformTemplate(cpl) {
    phaseAttributeExtraction(cpl, true);
    phasePipeCreation(cpl);
    phasePipeVariadic(cpl);
    phasePureLiteralStructures(cpl);
    phaseGenerateVariables(cpl);
    phaseSaveRestoreView(cpl);
    phaseResolveNames(cpl);
    phaseResolveContexts(cpl);
    phaseLocalRefs(cpl);
    phaseConstCollection(cpl);
    phaseNullishCoalescing(cpl);
    phaseExpandSafeReads(cpl, true);
    phaseTemporaryVariables(cpl);
    phaseSlotAllocation(cpl);
    phaseVarCounting(cpl);
    phaseGenerateAdvance(cpl);
    phaseNaming(cpl);
    phaseVariableOptimization(cpl, { conservative: true });
    phaseMergeNextContext(cpl);
    phaseNgContainer(cpl);
    phaseEmptyElements(cpl);
    phasePureFunctionExtraction(cpl);
    phaseAlignPipeVariadicVarOffset(cpl);
    phaseReify(cpl);
    phaseChaining(cpl);
}
/**
 * Compile all views in the given `ComponentCompilation` into the final template function, which may
 * reference constants defined in a `ConstantPool`.
 */
export function emitTemplateFn(tpl, pool) {
    const rootFn = emitView(tpl.root);
    emitChildViews(tpl.root, pool);
    return rootFn;
}
function emitChildViews(parent, pool) {
    for (const view of parent.tpl.views.values()) {
        if (view.parent !== parent.xref) {
            continue;
        }
        // Child views are emitted depth-first.
        emitChildViews(view, pool);
        const viewFn = emitView(view);
        pool.statements.push(viewFn.toDeclStmt(viewFn.name));
    }
}
/**
 * Emit a template function for an individual `ViewCompilation` (which may be either the root view
 * or an embedded view).
 */
function emitView(view) {
    if (view.fnName === null) {
        throw new Error(`AssertionError: view ${view.xref} is unnamed`);
    }
    const createStatements = [];
    for (const op of view.create) {
        if (op.kind !== ir.OpKind.Statement) {
            throw new Error(`AssertionError: expected all create ops to have been compiled, but got ${ir.OpKind[op.kind]}`);
        }
        createStatements.push(op.statement);
    }
    const updateStatements = [];
    for (const op of view.update) {
        if (op.kind !== ir.OpKind.Statement) {
            throw new Error(`AssertionError: expected all update ops to have been compiled, but got ${ir.OpKind[op.kind]}`);
        }
        updateStatements.push(op.statement);
    }
    const createCond = maybeGenerateRfBlock(1, createStatements);
    const updateCond = maybeGenerateRfBlock(2, updateStatements);
    return o.fn([
        new o.FnParam('rf'),
        new o.FnParam('ctx'),
    ], [
        ...createCond,
        ...updateCond,
    ], 
    /* type */ undefined, /* sourceSpan */ undefined, view.fnName);
}
function maybeGenerateRfBlock(flag, statements) {
    if (statements.length === 0) {
        return [];
    }
    return [
        o.ifStmt(new o.BinaryOperatorExpr(o.BinaryOperator.BitwiseAnd, o.variable('rf'), o.literal(flag)), statements),
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvZW1pdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLG1DQUFtQyxDQUFDO0FBRXZELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBSTVCLE9BQU8sRUFBQywrQkFBK0IsRUFBQyxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3ZFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRCxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUMzRCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRCxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNuRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNuRSxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDbkQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBQzVDLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3ZELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBQywyQkFBMkIsRUFB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VUFBVSxHQUFHLG9CQUFvQixDQUFDLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzdELE1BQU0sVUFBVSxHQUFHLG9CQUFvQixDQUFDLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzdELE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUDtRQUNFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDbkIsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztLQUNyQixFQUNEO1FBQ0UsR0FBRyxVQUFVO1FBQ2IsR0FBRyxVQUFVO0tBQ2Q7SUFDRCxVQUFVLENBQUMsU0FBUyxFQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsSUFBWSxFQUFFLFVBQXlCO0lBQ25FLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDM0IsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELE9BQU87UUFDTCxDQUFDLENBQUMsTUFBTSxDQUNKLElBQUksQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUN4RixVQUFVLENBQUM7S0FDaEIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9zcmMvb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQgdHlwZSB7Q29tcG9uZW50Q29tcGlsYXRpb24sIFZpZXdDb21waWxhdGlvbn0gZnJvbSAnLi9jb21waWxhdGlvbic7XG5cbmltcG9ydCB7cGhhc2VBbGlnblBpcGVWYXJpYWRpY1Zhck9mZnNldH0gZnJvbSAnLi9waGFzZXMvYWxpZ25fcGlwZV92YXJpYWRpY192YXJfb2Zmc2V0JztcbmltcG9ydCB7cGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9ufSBmcm9tICcuL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbic7XG5pbXBvcnQge3BoYXNlQ2hhaW5pbmd9IGZyb20gJy4vcGhhc2VzL2NoYWluaW5nJztcbmltcG9ydCB7cGhhc2VDb25zdENvbGxlY3Rpb259IGZyb20gJy4vcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtwaGFzZUVtcHR5RWxlbWVudHN9IGZyb20gJy4vcGhhc2VzL2VtcHR5X2VsZW1lbnRzJztcbmltcG9ydCB7cGhhc2VHZW5lcmF0ZUFkdmFuY2V9IGZyb20gJy4vcGhhc2VzL2dlbmVyYXRlX2FkdmFuY2UnO1xuaW1wb3J0IHtwaGFzZU51bGxpc2hDb2FsZXNjaW5nfSBmcm9tICcuL3BoYXNlcy9udWxsaXNoX2NvYWxlc2NpbmcnO1xuaW1wb3J0IHtwaGFzZUdlbmVyYXRlVmFyaWFibGVzfSBmcm9tICcuL3BoYXNlcy9nZW5lcmF0ZV92YXJpYWJsZXMnO1xuaW1wb3J0IHtwaGFzZUxvY2FsUmVmc30gZnJvbSAnLi9waGFzZXMvbG9jYWxfcmVmcyc7XG5pbXBvcnQge3BoYXNlTmFtaW5nfSBmcm9tICcuL3BoYXNlcy9uYW1pbmcnO1xuaW1wb3J0IHtwaGFzZU1lcmdlTmV4dENvbnRleHR9IGZyb20gJy4vcGhhc2VzL25leHRfY29udGV4dF9tZXJnaW5nJztcbmltcG9ydCB7cGhhc2VOZ0NvbnRhaW5lcn0gZnJvbSAnLi9waGFzZXMvbmdfY29udGFpbmVyJztcbmltcG9ydCB7cGhhc2VQaXBlQ3JlYXRpb259IGZyb20gJy4vcGhhc2VzL3BpcGVfY3JlYXRpb24nO1xuaW1wb3J0IHtwaGFzZVBpcGVWYXJpYWRpY30gZnJvbSAnLi9waGFzZXMvcGlwZV92YXJpYWRpYyc7XG5pbXBvcnQge3BoYXNlUHVyZUZ1bmN0aW9uRXh0cmFjdGlvbn0gZnJvbSAnLi9waGFzZXMvcHVyZV9mdW5jdGlvbl9leHRyYWN0aW9uJztcbmltcG9ydCB7cGhhc2VQdXJlTGl0ZXJhbFN0cnVjdHVyZXN9IGZyb20gJy4vcGhhc2VzL3B1cmVfbGl0ZXJhbF9zdHJ1Y3R1cmVzJztcbmltcG9ydCB7cGhhc2VSZWlmeX0gZnJvbSAnLi9waGFzZXMvcmVpZnknO1xuaW1wb3J0IHtwaGFzZVJlc29sdmVDb250ZXh0c30gZnJvbSAnLi9waGFzZXMvcmVzb2x2ZV9jb250ZXh0cyc7XG5pbXBvcnQge3BoYXNlUmVzb2x2ZU5hbWVzfSBmcm9tICcuL3BoYXNlcy9yZXNvbHZlX25hbWVzJztcbmltcG9ydCB7cGhhc2VTYXZlUmVzdG9yZVZpZXd9IGZyb20gJy4vcGhhc2VzL3NhdmVfcmVzdG9yZV92aWV3JztcbmltcG9ydCB7cGhhc2VTbG90QWxsb2NhdGlvbn0gZnJvbSAnLi9waGFzZXMvc2xvdF9hbGxvY2F0aW9uJztcbmltcG9ydCB7cGhhc2VWYXJDb3VudGluZ30gZnJvbSAnLi9waGFzZXMvdmFyX2NvdW50aW5nJztcbmltcG9ydCB7cGhhc2VWYXJpYWJsZU9wdGltaXphdGlvbn0gZnJvbSAnLi9waGFzZXMvdmFyaWFibGVfb3B0aW1pemF0aW9uJztcbmltcG9ydCB7cGhhc2VFeHBhbmRTYWZlUmVhZHN9IGZyb20gJy4vcGhhc2VzL2V4cGFuZF9zYWZlX3JlYWRzJztcbmltcG9ydCB7cGhhc2VUZW1wb3JhcnlWYXJpYWJsZXN9IGZyb20gJy4vcGhhc2VzL3RlbXBvcmFyeV92YXJpYWJsZXMnO1xuXG4vKipcbiAqIFJ1biBhbGwgdHJhbnNmb3JtYXRpb24gcGhhc2VzIGluIHRoZSBjb3JyZWN0IG9yZGVyIGFnYWluc3QgYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gLiBBZnRlciB0aGlzXG4gKiBwcm9jZXNzaW5nLCB0aGUgY29tcGlsYXRpb24gc2hvdWxkIGJlIGluIGEgc3RhdGUgd2hlcmUgaXQgY2FuIGJlIGVtaXR0ZWQgdmlhIGBlbWl0VGVtcGxhdGVGbmAuc1xuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtVGVtcGxhdGUoY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IHZvaWQge1xuICBwaGFzZUF0dHJpYnV0ZUV4dHJhY3Rpb24oY3BsLCB0cnVlKTtcbiAgcGhhc2VQaXBlQ3JlYXRpb24oY3BsKTtcbiAgcGhhc2VQaXBlVmFyaWFkaWMoY3BsKTtcbiAgcGhhc2VQdXJlTGl0ZXJhbFN0cnVjdHVyZXMoY3BsKTtcbiAgcGhhc2VHZW5lcmF0ZVZhcmlhYmxlcyhjcGwpO1xuICBwaGFzZVNhdmVSZXN0b3JlVmlldyhjcGwpO1xuICBwaGFzZVJlc29sdmVOYW1lcyhjcGwpO1xuICBwaGFzZVJlc29sdmVDb250ZXh0cyhjcGwpO1xuICBwaGFzZUxvY2FsUmVmcyhjcGwpO1xuICBwaGFzZUNvbnN0Q29sbGVjdGlvbihjcGwpO1xuICBwaGFzZU51bGxpc2hDb2FsZXNjaW5nKGNwbCk7XG4gIHBoYXNlRXhwYW5kU2FmZVJlYWRzKGNwbCwgdHJ1ZSk7XG4gIHBoYXNlVGVtcG9yYXJ5VmFyaWFibGVzKGNwbCk7XG4gIHBoYXNlU2xvdEFsbG9jYXRpb24oY3BsKTtcbiAgcGhhc2VWYXJDb3VudGluZyhjcGwpO1xuICBwaGFzZUdlbmVyYXRlQWR2YW5jZShjcGwpO1xuICBwaGFzZU5hbWluZyhjcGwpO1xuICBwaGFzZVZhcmlhYmxlT3B0aW1pemF0aW9uKGNwbCwge2NvbnNlcnZhdGl2ZTogdHJ1ZX0pO1xuICBwaGFzZU1lcmdlTmV4dENvbnRleHQoY3BsKTtcbiAgcGhhc2VOZ0NvbnRhaW5lcihjcGwpO1xuICBwaGFzZUVtcHR5RWxlbWVudHMoY3BsKTtcbiAgcGhhc2VQdXJlRnVuY3Rpb25FeHRyYWN0aW9uKGNwbCk7XG4gIHBoYXNlQWxpZ25QaXBlVmFyaWFkaWNWYXJPZmZzZXQoY3BsKTtcbiAgcGhhc2VSZWlmeShjcGwpO1xuICBwaGFzZUNoYWluaW5nKGNwbCk7XG59XG5cbi8qKlxuICogQ29tcGlsZSBhbGwgdmlld3MgaW4gdGhlIGdpdmVuIGBDb21wb25lbnRDb21waWxhdGlvbmAgaW50byB0aGUgZmluYWwgdGVtcGxhdGUgZnVuY3Rpb24sIHdoaWNoIG1heVxuICogcmVmZXJlbmNlIGNvbnN0YW50cyBkZWZpbmVkIGluIGEgYENvbnN0YW50UG9vbGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbWl0VGVtcGxhdGVGbih0cGw6IENvbXBvbmVudENvbXBpbGF0aW9uLCBwb29sOiBDb25zdGFudFBvb2wpOiBvLkZ1bmN0aW9uRXhwciB7XG4gIGNvbnN0IHJvb3RGbiA9IGVtaXRWaWV3KHRwbC5yb290KTtcbiAgZW1pdENoaWxkVmlld3ModHBsLnJvb3QsIHBvb2wpO1xuICByZXR1cm4gcm9vdEZuO1xufVxuXG5mdW5jdGlvbiBlbWl0Q2hpbGRWaWV3cyhwYXJlbnQ6IFZpZXdDb21waWxhdGlvbiwgcG9vbDogQ29uc3RhbnRQb29sKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdmlldyBvZiBwYXJlbnQudHBsLnZpZXdzLnZhbHVlcygpKSB7XG4gICAgaWYgKHZpZXcucGFyZW50ICE9PSBwYXJlbnQueHJlZikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gQ2hpbGQgdmlld3MgYXJlIGVtaXR0ZWQgZGVwdGgtZmlyc3QuXG4gICAgZW1pdENoaWxkVmlld3ModmlldywgcG9vbCk7XG5cbiAgICBjb25zdCB2aWV3Rm4gPSBlbWl0Vmlldyh2aWV3KTtcbiAgICBwb29sLnN0YXRlbWVudHMucHVzaCh2aWV3Rm4udG9EZWNsU3RtdCh2aWV3Rm4ubmFtZSEpKTtcbiAgfVxufVxuXG4vKipcbiAqIEVtaXQgYSB0ZW1wbGF0ZSBmdW5jdGlvbiBmb3IgYW4gaW5kaXZpZHVhbCBgVmlld0NvbXBpbGF0aW9uYCAod2hpY2ggbWF5IGJlIGVpdGhlciB0aGUgcm9vdCB2aWV3XG4gKiBvciBhbiBlbWJlZGRlZCB2aWV3KS5cbiAqL1xuZnVuY3Rpb24gZW1pdFZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uKTogby5GdW5jdGlvbkV4cHIge1xuICBpZiAodmlldy5mbk5hbWUgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB2aWV3ICR7dmlldy54cmVmfSBpcyB1bm5hbWVkYCk7XG4gIH1cblxuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYWxsIGNyZWF0ZSBvcHMgdG8gaGF2ZSBiZWVuIGNvbXBpbGVkLCBidXQgZ290ICR7XG4gICAgICAgICAgaXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy51cGRhdGUpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYWxsIHVwZGF0ZSBvcHMgdG8gaGF2ZSBiZWVuIGNvbXBpbGVkLCBidXQgZ290ICR7XG4gICAgICAgICAgaXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZUNvbmQgPSBtYXliZUdlbmVyYXRlUmZCbG9jaygxLCBjcmVhdGVTdGF0ZW1lbnRzKTtcbiAgY29uc3QgdXBkYXRlQ29uZCA9IG1heWJlR2VuZXJhdGVSZkJsb2NrKDIsIHVwZGF0ZVN0YXRlbWVudHMpO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtcbiAgICAgICAgbmV3IG8uRm5QYXJhbSgncmYnKSxcbiAgICAgICAgbmV3IG8uRm5QYXJhbSgnY3R4JyksXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICAuLi5jcmVhdGVDb25kLFxuICAgICAgICAuLi51cGRhdGVDb25kLFxuICAgICAgXSxcbiAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLCAvKiBzb3VyY2VTcGFuICovIHVuZGVmaW5lZCwgdmlldy5mbk5hbWUpO1xufVxuXG5mdW5jdGlvbiBtYXliZUdlbmVyYXRlUmZCbG9jayhmbGFnOiBudW1iZXIsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLlN0YXRlbWVudFtdIHtcbiAgaWYgKHN0YXRlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIFtcbiAgICBvLmlmU3RtdChcbiAgICAgICAgbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKG8uQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZCwgby52YXJpYWJsZSgncmYnKSwgby5saXRlcmFsKGZsYWcpKSxcbiAgICAgICAgc3RhdGVtZW50cyksXG4gIF07XG59XG4iXX0=