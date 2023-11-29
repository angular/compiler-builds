/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Resolve the element placeholders in i18n messages.
 */
export function resolveI18nElementPlaceholders(job) {
    // Record all of the element and i18n context ops for use later.
    const i18nContexts = new Map();
    const elements = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
                case ir.OpKind.ElementStart:
                    elements.set(op.xref, op);
                    break;
            }
        }
    }
    resolvePlaceholdersForView(job, job.root, i18nContexts, elements);
}
function resolvePlaceholdersForView(job, unit, i18nContexts, elements) {
    // Track the current i18n op and corresponding i18n context op as we step through the creation
    // IR.
    let currentOps = null;
    for (const op of unit.create) {
        switch (op.kind) {
            case ir.OpKind.I18nStart:
                if (!op.context) {
                    throw Error('Could not find i18n context for i18n op');
                }
                currentOps = { i18nBlock: op, i18nContext: i18nContexts.get(op.context) };
                break;
            case ir.OpKind.I18nEnd:
                currentOps = null;
                break;
            case ir.OpKind.ElementStart:
                // For elements with i18n placeholders, record its slot value in the params map under the
                // corresponding tag start placeholder.
                if (op.i18nPlaceholder !== undefined) {
                    if (currentOps === null) {
                        throw Error('i18n tag placeholder should only occur inside an i18n block');
                    }
                    const { startName, closeName } = op.i18nPlaceholder;
                    let flags = ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.OpenTag;
                    // For self-closing tags, there is no close tag placeholder. Instead, the start tag
                    // placeholder accounts for the start and close of the element.
                    if (closeName === '') {
                        flags |= ir.I18nParamValueFlags.CloseTag;
                    }
                    addParam(currentOps.i18nContext.params, startName, op.handle.slot, currentOps.i18nBlock.subTemplateIndex, flags);
                }
                break;
            case ir.OpKind.ElementEnd:
                // For elements with i18n placeholders, record its slot value in the params map under the
                // corresponding tag close placeholder.
                const startOp = elements.get(op.xref);
                if (startOp && startOp.i18nPlaceholder !== undefined) {
                    if (currentOps === null) {
                        throw Error('i18n tag placeholder should only occur inside an i18n block');
                    }
                    const { closeName } = startOp.i18nPlaceholder;
                    // Self-closing tags don't have a closing tag placeholder.
                    if (closeName !== '') {
                        addParam(currentOps.i18nContext.params, closeName, startOp.handle.slot, currentOps.i18nBlock.subTemplateIndex, ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.CloseTag);
                    }
                }
                break;
            case ir.OpKind.Template:
                // For templates with i18n placeholders, record its slot value in the params map under the
                // corresponding template start and close placeholders.
                if (op.i18nPlaceholder !== undefined) {
                    if (currentOps === null) {
                        throw Error('i18n tag placeholder should only occur inside an i18n block');
                    }
                    let startFlags = ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.OpenTag;
                    const subTemplateIndex = getSubTemplateIndexForTemplateTag(job, currentOps.i18nBlock, op);
                    const { startName, closeName } = op.i18nPlaceholder;
                    const isSelfClosing = closeName === '';
                    if (isSelfClosing) {
                        startFlags |= ir.I18nParamValueFlags.CloseTag;
                    }
                    addParam(currentOps.i18nContext.params, startName, op.handle.slot, subTemplateIndex, startFlags);
                    resolvePlaceholdersForView(job, job.views.get(op.xref), i18nContexts, elements);
                    if (!isSelfClosing) {
                        addParam(currentOps.i18nContext.params, closeName, op.handle.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag);
                    }
                }
                else {
                    resolvePlaceholdersForView(job, job.views.get(op.xref), i18nContexts, elements);
                }
                break;
        }
    }
}
/**
 * Get the subTemplateIndex for the given template op. For template ops, use the subTemplateIndex of
 * the child i18n block inside the template.
 */
function getSubTemplateIndexForTemplateTag(job, i18nOp, op) {
    for (const childOp of job.views.get(op.xref).create) {
        if (childOp.kind === ir.OpKind.I18nStart) {
            return childOp.subTemplateIndex;
        }
    }
    return i18nOp.subTemplateIndex;
}
/** Add a param value to the given params map. */
function addParam(params, placeholder, value, subTemplateIndex, flags) {
    const values = params.get(placeholder) ?? [];
    values.push({ value, subTemplateIndex, flags });
    params.set(placeholder, values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWTtvQkFDekIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUMxQixNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsMEJBQTBCLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUMvQixHQUE0QixFQUFFLElBQXlCLEVBQ3ZELFlBQThDLEVBQUUsUUFBMkM7SUFDN0YsOEZBQThGO0lBQzlGLE1BQU07SUFDTixJQUFJLFVBQVUsR0FBb0UsSUFBSSxDQUFDO0lBQ3ZGLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzdCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO2dCQUN0QixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNoQixNQUFNLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO2dCQUN6RCxDQUFDO2dCQUNELFVBQVUsR0FBRyxFQUFDLFNBQVMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBRSxFQUFDLENBQUM7Z0JBQ3pFLE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTztnQkFDcEIsVUFBVSxHQUFHLElBQUksQ0FBQztnQkFDbEIsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZO2dCQUN6Qix5RkFBeUY7Z0JBQ3pGLHVDQUF1QztnQkFDdkMsSUFBSSxFQUFFLENBQUMsZUFBZSxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUNyQyxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUUsQ0FBQzt3QkFDeEIsTUFBTSxLQUFLLENBQUMsNkRBQTZELENBQUMsQ0FBQztvQkFDN0UsQ0FBQztvQkFDRCxNQUFNLEVBQUMsU0FBUyxFQUFFLFNBQVMsRUFBQyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUM7b0JBQ2xELElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztvQkFDL0UsbUZBQW1GO29CQUNuRiwrREFBK0Q7b0JBQy9ELElBQUksU0FBUyxLQUFLLEVBQUUsRUFBRSxDQUFDO3dCQUNyQixLQUFLLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQztvQkFDM0MsQ0FBQztvQkFDRCxRQUFRLENBQ0osVUFBVSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSyxFQUN6RCxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNwRCxDQUFDO2dCQUNELE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVTtnQkFDdkIseUZBQXlGO2dCQUN6Rix1Q0FBdUM7Z0JBQ3ZDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsZUFBZSxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUNyRCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUUsQ0FBQzt3QkFDeEIsTUFBTSxLQUFLLENBQUMsNkRBQTZELENBQUMsQ0FBQztvQkFDN0UsQ0FBQztvQkFDRCxNQUFNLEVBQUMsU0FBUyxFQUFDLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztvQkFDNUMsMERBQTBEO29CQUMxRCxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUUsQ0FBQzt3QkFDckIsUUFBUSxDQUNKLFVBQVUsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUssRUFDOUQsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsRUFDckMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzNFLENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLDBGQUEwRjtnQkFDMUYsdURBQXVEO2dCQUN2RCxJQUFJLEVBQUUsQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3JDLElBQUksVUFBVSxLQUFLLElBQUksRUFBRSxDQUFDO3dCQUN4QixNQUFNLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO29CQUM3RSxDQUFDO29CQUNELElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztvQkFDckYsTUFBTSxnQkFBZ0IsR0FBRyxpQ0FBaUMsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDMUYsTUFBTSxFQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUMsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDO29CQUNsRCxNQUFNLGFBQWEsR0FBRyxTQUFTLEtBQUssRUFBRSxDQUFDO29CQUN2QyxJQUFJLGFBQWEsRUFBRSxDQUFDO3dCQUNsQixVQUFVLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQztvQkFDaEQsQ0FBQztvQkFFRCxRQUFRLENBQ0osVUFBVSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSyxFQUFFLGdCQUFnQixFQUMzRSxVQUFVLENBQUMsQ0FBQztvQkFDaEIsMEJBQTBCLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ2pGLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQzt3QkFDbkIsUUFBUSxDQUNKLFVBQVUsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUssRUFBRSxnQkFBZ0IsRUFDM0UsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzVFLENBQUM7Z0JBQ0gsQ0FBQztxQkFBTSxDQUFDO29CQUNOLDBCQUEwQixDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUNuRixDQUFDO2dCQUNELE1BQU07UUFDVixDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLGlDQUFpQyxDQUN0QyxHQUE0QixFQUFFLE1BQXNCLEVBQUUsRUFBaUI7SUFDekUsS0FBSyxNQUFNLE9BQU8sSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDckQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDekMsT0FBTyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7UUFDbEMsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztBQUNqQyxDQUFDO0FBRUQsaURBQWlEO0FBQ2pELFNBQVMsUUFBUSxDQUNiLE1BQXdDLEVBQUUsV0FBbUIsRUFBRSxLQUFvQixFQUNuRixnQkFBNkIsRUFBRSxLQUE2QjtJQUM5RCxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUM3QyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7SUFDOUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgZWxlbWVudCBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVJMThuRWxlbWVudFBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGVsZW1lbnQgYW5kIGkxOG4gY29udGV4dCBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgaTE4bkNvbnRleHRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGNvbnN0IGVsZW1lbnRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRTdGFydE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhqb2IsIGpvYi5yb290LCBpMThuQ29udGV4dHMsIGVsZW1lbnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVBsYWNlaG9sZGVyc0ZvclZpZXcoXG4gICAgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCxcbiAgICBpMThuQ29udGV4dHM6IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+LCBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudFN0YXJ0T3A+KSB7XG4gIC8vIFRyYWNrIHRoZSBjdXJyZW50IGkxOG4gb3AgYW5kIGNvcnJlc3BvbmRpbmcgaTE4biBjb250ZXh0IG9wIGFzIHdlIHN0ZXAgdGhyb3VnaCB0aGUgY3JlYXRpb25cbiAgLy8gSVIuXG4gIGxldCBjdXJyZW50T3BzOiB7aTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcCwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3B9fG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIGlmICghb3AuY29udGV4dCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBpMThuIGNvbnRleHQgZm9yIGkxOG4gb3AnKTtcbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50T3BzID0ge2kxOG5CbG9jazogb3AsIGkxOG5Db250ZXh0OiBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpIX07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgY3VycmVudE9wcyA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBzdGFydCBwbGFjZWhvbGRlci5cbiAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgIGxldCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZztcbiAgICAgICAgICAvLyBGb3Igc2VsZi1jbG9zaW5nIHRhZ3MsIHRoZXJlIGlzIG5vIGNsb3NlIHRhZyBwbGFjZWhvbGRlci4gSW5zdGVhZCwgdGhlIHN0YXJ0IHRhZ1xuICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIGFjY291bnRzIGZvciB0aGUgc3RhcnQgYW5kIGNsb3NlIG9mIHRoZSBlbGVtZW50LlxuICAgICAgICAgIGlmIChjbG9zZU5hbWUgPT09ICcnKSB7XG4gICAgICAgICAgICBmbGFncyB8PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQ29udGV4dC5wYXJhbXMsIHN0YXJ0TmFtZSwgb3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LCBmbGFncyk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50RW5kOlxuICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBjbG9zZSBwbGFjZWhvbGRlci5cbiAgICAgICAgY29uc3Qgc3RhcnRPcCA9IGVsZW1lbnRzLmdldChvcC54cmVmKTtcbiAgICAgICAgaWYgKHN0YXJ0T3AgJiYgc3RhcnRPcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qge2Nsb3NlTmFtZX0gPSBzdGFydE9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAvLyBTZWxmLWNsb3NpbmcgdGFncyBkb24ndCBoYXZlIGEgY2xvc2luZyB0YWcgcGxhY2Vob2xkZXIuXG4gICAgICAgICAgaWYgKGNsb3NlTmFtZSAhPT0gJycpIHtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQucGFyYW1zLCBjbG9zZU5hbWUsIHN0YXJ0T3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkJsb2NrLnN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIC8vIEZvciB0ZW1wbGF0ZXMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRlbXBsYXRlIHN0YXJ0IGFuZCBjbG9zZSBwbGFjZWhvbGRlcnMuXG4gICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IHN0YXJ0RmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnO1xuICAgICAgICAgIGNvbnN0IHN1YlRlbXBsYXRlSW5kZXggPSBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGVtcGxhdGVUYWcoam9iLCBjdXJyZW50T3BzLmkxOG5CbG9jaywgb3ApO1xuICAgICAgICAgIGNvbnN0IHtzdGFydE5hbWUsIGNsb3NlTmFtZX0gPSBvcC5pMThuUGxhY2Vob2xkZXI7XG4gICAgICAgICAgY29uc3QgaXNTZWxmQ2xvc2luZyA9IGNsb3NlTmFtZSA9PT0gJyc7XG4gICAgICAgICAgaWYgKGlzU2VsZkNsb3NpbmcpIHtcbiAgICAgICAgICAgIHN0YXJ0RmxhZ3MgfD0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQ29udGV4dC5wYXJhbXMsIHN0YXJ0TmFtZSwgb3AuaGFuZGxlLnNsb3QhLCBzdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICBzdGFydEZsYWdzKTtcbiAgICAgICAgICByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhqb2IsIGpvYi52aWV3cy5nZXQob3AueHJlZikhLCBpMThuQ29udGV4dHMsIGVsZW1lbnRzKTtcbiAgICAgICAgICBpZiAoIWlzU2VsZkNsb3NpbmcpIHtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQucGFyYW1zLCBjbG9zZU5hbWUsIG9wLmhhbmRsZS5zbG90ISwgc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgam9iLnZpZXdzLmdldChvcC54cmVmKSEsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdldCB0aGUgc3ViVGVtcGxhdGVJbmRleCBmb3IgdGhlIGdpdmVuIHRlbXBsYXRlIG9wLiBGb3IgdGVtcGxhdGUgb3BzLCB1c2UgdGhlIHN1YlRlbXBsYXRlSW5kZXggb2ZcbiAqIHRoZSBjaGlsZCBpMThuIGJsb2NrIGluc2lkZSB0aGUgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGdldFN1YlRlbXBsYXRlSW5kZXhGb3JUZW1wbGF0ZVRhZyhcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBpMThuT3A6IGlyLkkxOG5TdGFydE9wLCBvcDogaXIuVGVtcGxhdGVPcCk6IG51bWJlcnxudWxsIHtcbiAgZm9yIChjb25zdCBjaGlsZE9wIG9mIGpvYi52aWV3cy5nZXQob3AueHJlZikhLmNyZWF0ZSkge1xuICAgIGlmIChjaGlsZE9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICAgIHJldHVybiBjaGlsZE9wLnN1YlRlbXBsYXRlSW5kZXg7XG4gICAgfVxuICB9XG4gIHJldHVybiBpMThuT3Auc3ViVGVtcGxhdGVJbmRleDtcbn1cblxuLyoqIEFkZCBhIHBhcmFtIHZhbHVlIHRvIHRoZSBnaXZlbiBwYXJhbXMgbWFwLiAqL1xuZnVuY3Rpb24gYWRkUGFyYW0oXG4gICAgcGFyYW1zOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPiwgcGxhY2Vob2xkZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZ3xudW1iZXIsXG4gICAgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsIGZsYWdzOiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzKSB7XG4gIGNvbnN0IHZhbHVlcyA9IHBhcmFtcy5nZXQocGxhY2Vob2xkZXIpID8/IFtdO1xuICB2YWx1ZXMucHVzaCh7dmFsdWUsIHN1YlRlbXBsYXRlSW5kZXgsIGZsYWdzfSk7XG4gIHBhcmFtcy5zZXQocGxhY2Vob2xkZXIsIHZhbHVlcyk7XG59XG4iXX0=