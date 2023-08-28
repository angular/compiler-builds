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
import { phaseFindAnyCasts } from './phases/any_cast';
import { phaseAttributeExtraction } from './phases/attribute_extraction';
import { phaseBindingSpecialization } from './phases/binding_specialization';
import { phaseChaining } from './phases/chaining';
import { phaseConstCollection } from './phases/const_collection';
import { phaseEmptyElements } from './phases/empty_elements';
import { phaseExpandSafeReads } from './phases/expand_safe_reads';
import { phaseGenerateAdvance } from './phases/generate_advance';
import { phaseGenerateI18nBlocks } from './phases/generate_i18n_blocks';
import { phaseGenerateVariables } from './phases/generate_variables';
import { phaseHostStylePropertyParsing } from './phases/host_style_property_parsing';
import { phaseI18nMessageExtraction } from './phases/i18n_message_extraction';
import { phaseI18nTextExtraction } from './phases/i18n_text_extraction';
import { phaseLocalRefs } from './phases/local_refs';
import { phaseNamespace } from './phases/namespace';
import { phaseNaming } from './phases/naming';
import { phaseMergeNextContext } from './phases/next_context_merging';
import { phaseNgContainer } from './phases/ng_container';
import { phaseNoListenersOnTemplates } from './phases/no_listeners_on_templates';
import { phaseNonbindable } from './phases/nonbindable';
import { phaseNullishCoalescing } from './phases/nullish_coalescing';
import { phaseParseExtractedStyles } from './phases/parse_extracted_styles';
import { phasePipeCreation } from './phases/pipe_creation';
import { phasePipeVariadic } from './phases/pipe_variadic';
import { phasePropertyOrdering } from './phases/property_ordering';
import { phasePureFunctionExtraction } from './phases/pure_function_extraction';
import { phasePureLiteralStructures } from './phases/pure_literal_structures';
import { phaseReify } from './phases/reify';
import { phaseRemoveEmptyBindings } from './phases/remove_empty_bindings';
import { phaseResolveContexts } from './phases/resolve_contexts';
import { phaseResolveDollarEvent } from './phases/resolve_dollar_event';
import { phaseResolveI18nPlaceholders } from './phases/resolve_i18n_placeholders';
import { phaseResolveNames } from './phases/resolve_names';
import { phaseResolveSanitizers } from './phases/resolve_sanitizers';
import { phaseSaveRestoreView } from './phases/save_restore_view';
import { phaseSlotAllocation } from './phases/slot_allocation';
import { phaseStyleBindingSpecialization } from './phases/style_binding_specialization';
import { phaseTemporaryVariables } from './phases/temporary_variables';
import { phaseVarCounting } from './phases/var_counting';
import { phaseVariableOptimization } from './phases/variable_optimization';
/**
 * Run all transformation phases in the correct order against a `ComponentCompilation`. After this
 * processing, the compilation should be in a state where it can be emitted.
 */
export function transformTemplate(job) {
    phaseGenerateI18nBlocks(job);
    phaseI18nTextExtraction(job);
    phaseNamespace(job);
    phaseStyleBindingSpecialization(job);
    phaseBindingSpecialization(job);
    phaseAttributeExtraction(job);
    phaseParseExtractedStyles(job);
    phaseRemoveEmptyBindings(job);
    phaseNoListenersOnTemplates(job);
    phasePipeCreation(job);
    phasePipeVariadic(job);
    phasePureLiteralStructures(job);
    phaseGenerateVariables(job);
    phaseSaveRestoreView(job);
    phaseFindAnyCasts(job);
    phaseResolveDollarEvent(job);
    phaseResolveNames(job);
    phaseResolveContexts(job);
    phaseResolveSanitizers(job);
    phaseLocalRefs(job);
    phaseNullishCoalescing(job);
    phaseExpandSafeReads(job);
    phaseTemporaryVariables(job);
    phaseSlotAllocation(job);
    phaseResolveI18nPlaceholders(job);
    phaseI18nMessageExtraction(job);
    phaseConstCollection(job);
    phaseVarCounting(job);
    phaseGenerateAdvance(job);
    phaseVariableOptimization(job);
    phaseNaming(job);
    phaseMergeNextContext(job);
    phaseNgContainer(job);
    phaseEmptyElements(job);
    phaseNonbindable(job);
    phasePureFunctionExtraction(job);
    phaseAlignPipeVariadicVarOffset(job);
    phasePropertyOrdering(job);
    phaseReify(job);
    phaseChaining(job);
}
/**
 * Run all transformation phases in the correct order against a `HostBindingCompilationJob`. After
 * this processing, the compilation should be in a state where it can be emitted.
 */
export function transformHostBinding(job) {
    phaseHostStylePropertyParsing(job);
    phaseStyleBindingSpecialization(job);
    phaseBindingSpecialization(job);
    phasePureLiteralStructures(job);
    phaseNullishCoalescing(job);
    phaseExpandSafeReads(job);
    phaseTemporaryVariables(job);
    phaseVarCounting(job);
    phaseVariableOptimization(job);
    phaseResolveNames(job);
    phaseResolveContexts(job);
    // TODO: Figure out how to make this work for host bindings.
    // phaseResolveSanitizers(job);
    phaseNaming(job);
    phasePureFunctionExtraction(job);
    phasePropertyOrdering(job);
    phaseReify(job);
    phaseChaining(job);
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
    for (const view of parent.job.views.values()) {
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
export function emitHostBindingFunction(job) {
    if (job.fnName === null) {
        throw new Error(`AssertionError: host binding function is unnamed`);
    }
    const createStatements = [];
    for (const op of job.create) {
        if (op.kind !== ir.OpKind.Statement) {
            throw new Error(`AssertionError: expected all create ops to have been compiled, but got ${ir.OpKind[op.kind]}`);
        }
        createStatements.push(op.statement);
    }
    const updateStatements = [];
    for (const op of job.update) {
        if (op.kind !== ir.OpKind.Statement) {
            throw new Error(`AssertionError: expected all update ops to have been compiled, but got ${ir.OpKind[op.kind]}`);
        }
        updateStatements.push(op.statement);
    }
    if (createStatements.length === 0 && updateStatements.length === 0) {
        return null;
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
    /* type */ undefined, /* sourceSpan */ undefined, job.fnName);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvZW1pdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLG1DQUFtQyxDQUFDO0FBRXZELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBSTVCLE9BQU8sRUFBQywrQkFBK0IsRUFBQyxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3ZFLE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzNFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRCxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUMzRCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUNoRSxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNuRSxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RSxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUMsY0FBYyxF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IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi9jb21waWxhdGlvbic7XG5cbmltcG9ydCB7cGhhc2VBbGlnblBpcGVWYXJpYWRpY1Zhck9mZnNldH0gZnJvbSAnLi9waGFzZXMvYWxpZ25fcGlwZV92YXJpYWRpY192YXJfb2Zmc2V0JztcbmltcG9ydCB7cGhhc2VGaW5kQW55Q2FzdHN9IGZyb20gJy4vcGhhc2VzL2FueV9jYXN0JztcbmltcG9ydCB7cGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9ufSBmcm9tICcuL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbic7XG5pbXBvcnQge3BoYXNlQmluZGluZ1NwZWNpYWxpemF0aW9ufSBmcm9tICcuL3BoYXNlcy9iaW5kaW5nX3NwZWNpYWxpemF0aW9uJztcbmltcG9ydCB7cGhhc2VDaGFpbmluZ30gZnJvbSAnLi9waGFzZXMvY2hhaW5pbmcnO1xuaW1wb3J0IHtwaGFzZUNvbnN0Q29sbGVjdGlvbn0gZnJvbSAnLi9waGFzZXMvY29uc3RfY29sbGVjdGlvbic7XG5pbXBvcnQge3BoYXNlRW1wdHlFbGVtZW50c30gZnJvbSAnLi9waGFzZXMvZW1wdHlfZWxlbWVudHMnO1xuaW1wb3J0IHtwaGFzZUV4cGFuZFNhZmVSZWFkc30gZnJvbSAnLi9waGFzZXMvZXhwYW5kX3NhZmVfcmVhZHMnO1xuaW1wb3J0IHtwaGFzZUdlbmVyYXRlQWR2YW5jZX0gZnJvbSAnLi9waGFzZXMvZ2VuZXJhdGVfYWR2YW5jZSc7XG5pbXBvcnQge3BoYXNlR2VuZXJhdGVJMThuQmxvY2tzfSBmcm9tICcuL3BoYXNlcy9nZW5lcmF0ZV9pMThuX2Jsb2Nrcyc7XG5pbXBvcnQge3BoYXNlR2VuZXJhdGVWYXJpYWJsZXN9IGZyb20gJy4vcGhhc2VzL2dlbmVyYXRlX3ZhcmlhYmxlcyc7XG5pbXBvcnQge3BoYXNlSG9zdFN0eWxlUHJvcGVydHlQYXJzaW5nfSBmcm9tICcuL3BoYXNlcy9ob3N0X3N0eWxlX3Byb3BlcnR5X3BhcnNpbmcnO1xuaW1wb3J0IHtwaGFzZUkxOG5NZXNzYWdlRXh0cmFjdGlvbn0gZnJvbSAnLi9waGFzZXMvaTE4bl9tZXNzYWdlX2V4dHJhY3Rpb24nO1xuaW1wb3J0IHtwaGFzZUkxOG5UZXh0RXh0cmFjdGlvbn0gZnJvbSAnLi9waGFzZXMvaTE4bl90ZXh0X2V4dHJhY3Rpb24nO1xuaW1wb3J0IHtwaGFzZUxvY2FsUmVmc30gZnJvbSAnLi9waGFzZXMvbG9jYWxfcmVmcyc7XG5pbXBvcnQge3BoYXNlTmFtZXNwYWNlfSBmcm9tICcuL3BoYXNlcy9uYW1lc3BhY2UnO1xuaW1wb3J0IHtwaGFzZU5hbWluZ30gZnJvbSAnLi9waGFzZXMvbmFtaW5nJztcbmltcG9ydCB7cGhhc2VNZXJnZU5leHRDb250ZXh0fSBmcm9tICcuL3BoYXNlcy9uZXh0X2NvbnRleHRfbWVyZ2luZyc7XG5pbXBvcnQge3BoYXNlTmdDb250YWluZXJ9IGZyb20gJy4vcGhhc2VzL25nX2NvbnRhaW5lcic7XG5pbXBvcnQge3BoYXNlTm9MaXN0ZW5lcnNPblRlbXBsYXRlc30gZnJvbSAnLi9waGFzZXMvbm9fbGlzdGVuZXJzX29uX3RlbXBsYXRlcyc7XG5pbXBvcnQge3BoYXNlTm9uYmluZGFibGV9IGZyb20gJy4vcGhhc2VzL25vbmJpbmRhYmxlJztcbmltcG9ydCB7cGhhc2VOdWxsaXNoQ29hbGVzY2luZ30gZnJvbSAnLi9waGFzZXMvbnVsbGlzaF9jb2FsZXNjaW5nJztcbmltcG9ydCB7cGhhc2VQYXJzZUV4dHJhY3RlZFN0eWxlc30gZnJvbSAnLi9waGFzZXMvcGFyc2VfZXh0cmFjdGVkX3N0eWxlcyc7XG5pbXBvcnQge3BoYXNlUGlwZUNyZWF0aW9ufSBmcm9tICcuL3BoYXNlcy9waXBlX2NyZWF0aW9uJztcbmltcG9ydCB7cGhhc2VQaXBlVmFyaWFkaWN9IGZyb20gJy4vcGhhc2VzL3BpcGVfdmFyaWFkaWMnO1xuaW1wb3J0IHtwaGFzZVByb3BlcnR5T3JkZXJpbmd9IGZyb20gJy4vcGhhc2VzL3Byb3BlcnR5X29yZGVyaW5nJztcbmltcG9ydCB7cGhhc2VQdXJlRnVuY3Rpb25FeHRyYWN0aW9ufSBmcm9tICcuL3BoYXNlcy9wdXJlX2Z1bmN0aW9uX2V4dHJhY3Rpb24nO1xuaW1wb3J0IHtwaGFzZVB1cmVMaXRlcmFsU3RydWN0dXJlc30gZnJvbSAnLi9waGFzZXMvcHVyZV9saXRlcmFsX3N0cnVjdHVyZXMnO1xuaW1wb3J0IHtwaGFzZVJlaWZ5fSBmcm9tICcuL3BoYXNlcy9yZWlmeSc7XG5pbXBvcnQge3BoYXNlUmVtb3ZlRW1wdHlCaW5kaW5nc30gZnJvbSAnLi9waGFzZXMvcmVtb3ZlX2VtcHR5X2JpbmRpbmdzJztcbmltcG9ydCB7cGhhc2VSZXNvbHZlQ29udGV4dHN9IGZyb20gJy4vcGhhc2VzL3Jlc29sdmVfY29udGV4dHMnO1xuaW1wb3J0IHtwaGFzZVJlc29sdmVEb2xsYXJFdmVudH0gZnJvbSAnLi9waGFzZXMvcmVzb2x2ZV9kb2xsYXJfZXZlbnQnO1xuaW1wb3J0IHtwaGFzZVJlc29sdmVJMThuUGxhY2Vob2xkZXJzfSBmcm9tICcuL3BoYXNlcy9yZXNvbHZlX2kxOG5fcGxhY2Vob2xkZXJzJztcbmltcG9ydCB7cGhhc2VSZXNvbHZlTmFtZXN9IGZyb20gJy4vcGhhc2VzL3Jlc29sdmVfbmFtZXMnO1xuaW1wb3J0IHtwaGFzZVJlc29sdmVTYW5pdGl6ZXJzfSBmcm9tICcuL3BoYXNlcy9yZXNvbHZlX3Nhbml0aXplcnMnO1xuaW1wb3J0IHtwaGFzZVNhdmVSZXN0b3JlVmlld30gZnJvbSAnLi9waGFzZXMvc2F2ZV9yZXN0b3JlX3ZpZXcnO1xuaW1wb3J0IHtwaGFzZVNsb3RBbGxvY2F0aW9ufSBmcm9tICcuL3BoYXNlcy9zbG90X2FsbG9jYXRpb24nO1xuaW1wb3J0IHtwaGFzZVN0eWxlQmluZGluZ1NwZWNpYWxpemF0aW9ufSBmcm9tICcuL3BoYXNlcy9zdHlsZV9iaW5kaW5nX3NwZWNpYWxpemF0aW9uJztcbmltcG9ydCB7cGhhc2VUZW1wb3JhcnlWYXJpYWJsZXN9IGZyb20gJy4vcGhhc2VzL3RlbXBvcmFyeV92YXJpYWJsZXMnO1xuaW1wb3J0IHtwaGFzZVZhckNvdW50aW5nfSBmcm9tICcuL3BoYXNlcy92YXJfY291bnRpbmcnO1xuaW1wb3J0IHtwaGFzZVZhcmlhYmxlT3B0aW1pemF0aW9ufSBmcm9tICcuL3BoYXNlcy92YXJpYWJsZV9vcHRpbWl6YXRpb24nO1xuXG4vKipcbiAqIFJ1biBhbGwgdHJhbnNmb3JtYXRpb24gcGhhc2VzIGluIHRoZSBjb3JyZWN0IG9yZGVyIGFnYWluc3QgYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gLiBBZnRlciB0aGlzXG4gKiBwcm9jZXNzaW5nLCB0aGUgY29tcGlsYXRpb24gc2hvdWxkIGJlIGluIGEgc3RhdGUgd2hlcmUgaXQgY2FuIGJlIGVtaXR0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1UZW1wbGF0ZShqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIHBoYXNlR2VuZXJhdGVJMThuQmxvY2tzKGpvYik7XG4gIHBoYXNlSTE4blRleHRFeHRyYWN0aW9uKGpvYik7XG4gIHBoYXNlTmFtZXNwYWNlKGpvYik7XG4gIHBoYXNlU3R5bGVCaW5kaW5nU3BlY2lhbGl6YXRpb24oam9iKTtcbiAgcGhhc2VCaW5kaW5nU3BlY2lhbGl6YXRpb24oam9iKTtcbiAgcGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9uKGpvYik7XG4gIHBoYXNlUGFyc2VFeHRyYWN0ZWRTdHlsZXMoam9iKTtcbiAgcGhhc2VSZW1vdmVFbXB0eUJpbmRpbmdzKGpvYik7XG4gIHBoYXNlTm9MaXN0ZW5lcnNPblRlbXBsYXRlcyhqb2IpO1xuICBwaGFzZVBpcGVDcmVhdGlvbihqb2IpO1xuICBwaGFzZVBpcGVWYXJpYWRpYyhqb2IpO1xuICBwaGFzZVB1cmVMaXRlcmFsU3RydWN0dXJlcyhqb2IpO1xuICBwaGFzZUdlbmVyYXRlVmFyaWFibGVzKGpvYik7XG4gIHBoYXNlU2F2ZVJlc3RvcmVWaWV3KGpvYik7XG4gIHBoYXNlRmluZEFueUNhc3RzKGpvYik7XG4gIHBoYXNlUmVzb2x2ZURvbGxhckV2ZW50KGpvYik7XG4gIHBoYXNlUmVzb2x2ZU5hbWVzKGpvYik7XG4gIHBoYXNlUmVzb2x2ZUNvbnRleHRzKGpvYik7XG4gIHBoYXNlUmVzb2x2ZVNhbml0aXplcnMoam9iKTtcbiAgcGhhc2VMb2NhbFJlZnMoam9iKTtcbiAgcGhhc2VOdWxsaXNoQ29hbGVzY2luZyhqb2IpO1xuICBwaGFzZUV4cGFuZFNhZmVSZWFkcyhqb2IpO1xuICBwaGFzZVRlbXBvcmFyeVZhcmlhYmxlcyhqb2IpO1xuICBwaGFzZVNsb3RBbGxvY2F0aW9uKGpvYik7XG4gIHBoYXNlUmVzb2x2ZUkxOG5QbGFjZWhvbGRlcnMoam9iKTtcbiAgcGhhc2VJMThuTWVzc2FnZUV4dHJhY3Rpb24oam9iKTtcbiAgcGhhc2VDb25zdENvbGxlY3Rpb24oam9iKTtcbiAgcGhhc2VWYXJDb3VudGluZyhqb2IpO1xuICBwaGFzZUdlbmVyYXRlQWR2YW5jZShqb2IpO1xuICBwaGFzZVZhcmlhYmxlT3B0aW1pemF0aW9uKGpvYik7XG4gIHBoYXNlTmFtaW5nKGpvYik7XG4gIHBoYXNlTWVyZ2VOZXh0Q29udGV4dChqb2IpO1xuICBwaGFzZU5nQ29udGFpbmVyKGpvYik7XG4gIHBoYXNlRW1wdHlFbGVtZW50cyhqb2IpO1xuICBwaGFzZU5vbmJpbmRhYmxlKGpvYik7XG4gIHBoYXNlUHVyZUZ1bmN0aW9uRXh0cmFjdGlvbihqb2IpO1xuICBwaGFzZUFsaWduUGlwZVZhcmlhZGljVmFyT2Zmc2V0KGpvYik7XG4gIHBoYXNlUHJvcGVydHlPcmRlcmluZyhqb2IpO1xuICBwaGFzZVJlaWZ5KGpvYik7XG4gIHBoYXNlQ2hhaW5pbmcoam9iKTtcbn1cblxuLyoqXG4gKiBSdW4gYWxsIHRyYW5zZm9ybWF0aW9uIHBoYXNlcyBpbiB0aGUgY29ycmVjdCBvcmRlciBhZ2FpbnN0IGEgYEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2JgLiBBZnRlclxuICogdGhpcyBwcm9jZXNzaW5nLCB0aGUgY29tcGlsYXRpb24gc2hvdWxkIGJlIGluIGEgc3RhdGUgd2hlcmUgaXQgY2FuIGJlIGVtaXR0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1Ib3N0QmluZGluZyhqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgcGhhc2VIb3N0U3R5bGVQcm9wZXJ0eVBhcnNpbmcoam9iKTtcbiAgcGhhc2VTdHlsZUJpbmRpbmdTcGVjaWFsaXphdGlvbihqb2IpO1xuICBwaGFzZUJpbmRpbmdTcGVjaWFsaXphdGlvbihqb2IpO1xuICBwaGFzZVB1cmVMaXRlcmFsU3RydWN0dXJlcyhqb2IpO1xuICBwaGFzZU51bGxpc2hDb2FsZXNjaW5nKGpvYik7XG4gIHBoYXNlRXhwYW5kU2FmZVJlYWRzKGpvYik7XG4gIHBoYXNlVGVtcG9yYXJ5VmFyaWFibGVzKGpvYik7XG4gIHBoYXNlVmFyQ291bnRpbmcoam9iKTtcbiAgcGhhc2VWYXJpYWJsZU9wdGltaXphdGlvbihqb2IpO1xuICBwaGFzZVJlc29sdmVOYW1lcyhqb2IpO1xuICBwaGFzZVJlc29sdmVDb250ZXh0cyhqb2IpO1xuICAvLyBUT0RPOiBGaWd1cmUgb3V0IGhvdyB0byBtYWtlIHRoaXMgd29yayBmb3IgaG9zdCBiaW5kaW5ncy5cbiAgLy8gcGhhc2VSZXNvbHZlU2FuaXRpemVycyhqb2IpO1xuICBwaGFzZU5hbWluZyhqb2IpO1xuICBwaGFzZVB1cmVGdW5jdGlvbkV4dHJhY3Rpb24oam9iKTtcbiAgcGhhc2VQcm9wZXJ0eU9yZGVyaW5nKGpvYik7XG4gIHBoYXNlUmVpZnkoam9iKTtcbiAgcGhhc2VDaGFpbmluZyhqb2IpO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYWxsIHZpZXdzIGluIHRoZSBnaXZlbiBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGludG8gdGhlIGZpbmFsIHRlbXBsYXRlIGZ1bmN0aW9uLCB3aGljaCBtYXlcbiAqIHJlZmVyZW5jZSBjb25zdGFudHMgZGVmaW5lZCBpbiBhIGBDb25zdGFudFBvb2xgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW1pdFRlbXBsYXRlRm4odHBsOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgcG9vbDogQ29uc3RhbnRQb29sKTogby5GdW5jdGlvbkV4cHIge1xuICBjb25zdCByb290Rm4gPSBlbWl0Vmlldyh0cGwucm9vdCk7XG4gIGVtaXRDaGlsZFZpZXdzKHRwbC5yb290LCBwb29sKTtcbiAgcmV0dXJuIHJvb3RGbjtcbn1cblxuZnVuY3Rpb24gZW1pdENoaWxkVmlld3MocGFyZW50OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBwb29sOiBDb25zdGFudFBvb2wpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB2aWV3IG9mIHBhcmVudC5qb2Iudmlld3MudmFsdWVzKCkpIHtcbiAgICBpZiAodmlldy5wYXJlbnQgIT09IHBhcmVudC54cmVmKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBDaGlsZCB2aWV3cyBhcmUgZW1pdHRlZCBkZXB0aC1maXJzdC5cbiAgICBlbWl0Q2hpbGRWaWV3cyh2aWV3LCBwb29sKTtcblxuICAgIGNvbnN0IHZpZXdGbiA9IGVtaXRWaWV3KHZpZXcpO1xuICAgIHBvb2wuc3RhdGVtZW50cy5wdXNoKHZpZXdGbi50b0RlY2xTdG10KHZpZXdGbi5uYW1lISkpO1xuICB9XG59XG5cbi8qKlxuICogRW1pdCBhIHRlbXBsYXRlIGZ1bmN0aW9uIGZvciBhbiBpbmRpdmlkdWFsIGBWaWV3Q29tcGlsYXRpb25gICh3aGljaCBtYXkgYmUgZWl0aGVyIHRoZSByb290IHZpZXdcbiAqIG9yIGFuIGVtYmVkZGVkIHZpZXcpLlxuICovXG5mdW5jdGlvbiBlbWl0Vmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0KTogby5GdW5jdGlvbkV4cHIge1xuICBpZiAodmlldy5mbk5hbWUgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB2aWV3ICR7dmlldy54cmVmfSBpcyB1bm5hbWVkYCk7XG4gIH1cblxuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYWxsIGNyZWF0ZSBvcHMgdG8gaGF2ZSBiZWVuIGNvbXBpbGVkLCBidXQgZ290ICR7XG4gICAgICAgICAgaXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy51cGRhdGUpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYWxsIHVwZGF0ZSBvcHMgdG8gaGF2ZSBiZWVuIGNvbXBpbGVkLCBidXQgZ290ICR7XG4gICAgICAgICAgaXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZUNvbmQgPSBtYXliZUdlbmVyYXRlUmZCbG9jaygxLCBjcmVhdGVTdGF0ZW1lbnRzKTtcbiAgY29uc3QgdXBkYXRlQ29uZCA9IG1heWJlR2VuZXJhdGVSZkJsb2NrKDIsIHVwZGF0ZVN0YXRlbWVudHMpO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtcbiAgICAgICAgbmV3IG8uRm5QYXJhbSgncmYnKSxcbiAgICAgICAgbmV3IG8uRm5QYXJhbSgnY3R4JyksXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICAuLi5jcmVhdGVDb25kLFxuICAgICAgICAuLi51cGRhdGVDb25kLFxuICAgICAgXSxcbiAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLCAvKiBzb3VyY2VTcGFuICovIHVuZGVmaW5lZCwgdmlldy5mbk5hbWUpO1xufVxuXG5mdW5jdGlvbiBtYXliZUdlbmVyYXRlUmZCbG9jayhmbGFnOiBudW1iZXIsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLlN0YXRlbWVudFtdIHtcbiAgaWYgKHN0YXRlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIFtcbiAgICBvLmlmU3RtdChcbiAgICAgICAgbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKG8uQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZCwgby52YXJpYWJsZSgncmYnKSwgby5saXRlcmFsKGZsYWcpKSxcbiAgICAgICAgc3RhdGVtZW50cyksXG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbWl0SG9zdEJpbmRpbmdGdW5jdGlvbihqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IpOiBvLkZ1bmN0aW9uRXhwcnxudWxsIHtcbiAgaWYgKGpvYi5mbk5hbWUgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBob3N0IGJpbmRpbmcgZnVuY3Rpb24gaXMgdW5uYW1lZGApO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBmb3IgKGNvbnN0IG9wIG9mIGpvYi5jcmVhdGUpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYWxsIGNyZWF0ZSBvcHMgdG8gaGF2ZSBiZWVuIGNvbXBpbGVkLCBidXQgZ290ICR7XG4gICAgICAgICAgaXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2Ygam9iLnVwZGF0ZSkge1xuICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RhdGVtZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBhbGwgdXBkYXRlIG9wcyB0byBoYXZlIGJlZW4gY29tcGlsZWQsIGJ1dCBnb3QgJHtcbiAgICAgICAgICBpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChvcC5zdGF0ZW1lbnQpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID09PSAwICYmIHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBjcmVhdGVDb25kID0gbWF5YmVHZW5lcmF0ZVJmQmxvY2soMSwgY3JlYXRlU3RhdGVtZW50cyk7XG4gIGNvbnN0IHVwZGF0ZUNvbmQgPSBtYXliZUdlbmVyYXRlUmZCbG9jaygyLCB1cGRhdGVTdGF0ZW1lbnRzKTtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oJ3JmJyksXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oJ2N0eCcpLFxuICAgICAgXSxcbiAgICAgIFtcbiAgICAgICAgLi4uY3JlYXRlQ29uZCxcbiAgICAgICAgLi4udXBkYXRlQ29uZCxcbiAgICAgIF0sXG4gICAgICAvKiB0eXBlICovIHVuZGVmaW5lZCwgLyogc291cmNlU3BhbiAqLyB1bmRlZmluZWQsIGpvYi5mbk5hbWUpO1xufVxuIl19