/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Phase that moves specialized `Property` operations to the creation
 * block if the compilation job targets is signal based. Also removes
 * all superfluous binding signal placeholders.
 *
 * This phase exists as we want to avoid having to the repeat binding specialization
 * logic for property bindings, but rather re-use the already-specialized information.
 */
export function phaseSignalBindings(cpl) {
    for (const unit of cpl.units) {
        processUnit(unit);
    }
}
function processUnit(unit) {
    const placeholders = new Map();
    for (const op of unit.create) {
        if (op.kind === ir.OpKind.BindingSignalPlaceholder) {
            placeholders.set(op.bindingXref, op);
        }
    }
    // For signal jobs, we move:
    //  - property operations into the create block.
    if (unit.job.isSignal) {
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.Property) {
                const placeholderOp = placeholders.get(op.bindingXref);
                if (placeholderOp === undefined) {
                    throw new Error('Expected binding placeholder operation to exist for property operation.');
                }
                // Signal property bindings, do not maintain a separate instruction for property
                // interpolations as the expression is wrapped is `computed` anyway. Instead, we
                // generate an interpolation template literal expression.
                const expression = op.expression instanceof ir.Interpolation ?
                    new ir.InterpolationTemplateExpr(op.expression.strings, op.expression.expressions) :
                    op.expression;
                const createOp = ir.createPropertyCreateOp(op.bindingXref, op.target, op.name, expression, op.isAnimationTrigger, op.securityContext, op.isTemplate, op.sourceSpan);
                // Replace the placeholder with the new instruction.
                ir.OpList.replace(placeholderOp, createOp);
                placeholders.delete(op.bindingXref);
                // Remove the property update operation, as we have the create operation now.
                ir.OpList.remove(op);
            }
        }
    }
    // Remove all remaining placeholders. Not all binding operations
    // end up in the create block, even for signal jobs. For non-signal
    // jobs we remove all placeholder operations.
    for (const op of placeholders.values()) {
        ir.OpList.remove(op);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lnbmFsX2JpbmRpbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvc2lnbmFsX2JpbmRpbmdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsR0FBbUI7SUFDckQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNuQjtBQUNILENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxJQUFxQjtJQUN4QyxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBMEMsQ0FBQztJQUN2RSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsd0JBQXdCLEVBQUU7WUFDbEQsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ3RDO0tBQ0Y7SUFFRCw0QkFBNEI7SUFDNUIsZ0RBQWdEO0lBQ2hELElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDckIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtnQkFDbEMsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3ZELElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtvQkFDL0IsTUFBTSxJQUFJLEtBQUssQ0FDWCx5RUFBeUUsQ0FBQyxDQUFDO2lCQUNoRjtnQkFFRCxnRkFBZ0Y7Z0JBQ2hGLGdGQUFnRjtnQkFDaEYseURBQXlEO2dCQUN6RCxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUMsVUFBVSxZQUFZLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDMUQsSUFBSSxFQUFFLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO29CQUNwRixFQUFFLENBQUMsVUFBVSxDQUFDO2dCQUNsQixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsc0JBQXNCLENBQ3RDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsa0JBQWtCLEVBQ3JFLEVBQUUsQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBRXRELG9EQUFvRDtnQkFDcEQsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQWMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RCxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFFcEMsNkVBQTZFO2dCQUM3RSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQzthQUNuQztTQUNGO0tBQ0Y7SUFFRCxnRUFBZ0U7SUFDaEUsbUVBQW1FO0lBQ25FLDZDQUE2QztJQUM3QyxLQUFLLE1BQU0sRUFBRSxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUUsRUFBRTtRQUN0QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztLQUNuQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYiwgQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUGhhc2UgdGhhdCBtb3ZlcyBzcGVjaWFsaXplZCBgUHJvcGVydHlgIG9wZXJhdGlvbnMgdG8gdGhlIGNyZWF0aW9uXG4gKiBibG9jayBpZiB0aGUgY29tcGlsYXRpb24gam9iIHRhcmdldHMgaXMgc2lnbmFsIGJhc2VkLiBBbHNvIHJlbW92ZXNcbiAqIGFsbCBzdXBlcmZsdW91cyBiaW5kaW5nIHNpZ25hbCBwbGFjZWhvbGRlcnMuXG4gKlxuICogVGhpcyBwaGFzZSBleGlzdHMgYXMgd2Ugd2FudCB0byBhdm9pZCBoYXZpbmcgdG8gdGhlIHJlcGVhdCBiaW5kaW5nIHNwZWNpYWxpemF0aW9uXG4gKiBsb2dpYyBmb3IgcHJvcGVydHkgYmluZGluZ3MsIGJ1dCByYXRoZXIgcmUtdXNlIHRoZSBhbHJlYWR5LXNwZWNpYWxpemVkIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VTaWduYWxCaW5kaW5ncyhjcGw6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBjcGwudW5pdHMpIHtcbiAgICBwcm9jZXNzVW5pdCh1bml0KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzVW5pdCh1bml0OiBDb21waWxhdGlvblVuaXQpIHtcbiAgY29uc3QgcGxhY2Vob2xkZXJzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkJpbmRpbmdTaWduYWxQbGFjZWhvbGRlcj4oKTtcbiAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuQmluZGluZ1NpZ25hbFBsYWNlaG9sZGVyKSB7XG4gICAgICBwbGFjZWhvbGRlcnMuc2V0KG9wLmJpbmRpbmdYcmVmLCBvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRm9yIHNpZ25hbCBqb2JzLCB3ZSBtb3ZlOlxuICAvLyAgLSBwcm9wZXJ0eSBvcGVyYXRpb25zIGludG8gdGhlIGNyZWF0ZSBibG9jay5cbiAgaWYgKHVuaXQuam9iLmlzU2lnbmFsKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5Qcm9wZXJ0eSkge1xuICAgICAgICBjb25zdCBwbGFjZWhvbGRlck9wID0gcGxhY2Vob2xkZXJzLmdldChvcC5iaW5kaW5nWHJlZik7XG4gICAgICAgIGlmIChwbGFjZWhvbGRlck9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBiaW5kaW5nIHBsYWNlaG9sZGVyIG9wZXJhdGlvbiB0byBleGlzdCBmb3IgcHJvcGVydHkgb3BlcmF0aW9uLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2lnbmFsIHByb3BlcnR5IGJpbmRpbmdzLCBkbyBub3QgbWFpbnRhaW4gYSBzZXBhcmF0ZSBpbnN0cnVjdGlvbiBmb3IgcHJvcGVydHlcbiAgICAgICAgLy8gaW50ZXJwb2xhdGlvbnMgYXMgdGhlIGV4cHJlc3Npb24gaXMgd3JhcHBlZCBpcyBgY29tcHV0ZWRgIGFueXdheS4gSW5zdGVhZCwgd2VcbiAgICAgICAgLy8gZ2VuZXJhdGUgYW4gaW50ZXJwb2xhdGlvbiB0ZW1wbGF0ZSBsaXRlcmFsIGV4cHJlc3Npb24uXG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbiA/XG4gICAgICAgICAgICBuZXcgaXIuSW50ZXJwb2xhdGlvblRlbXBsYXRlRXhwcihvcC5leHByZXNzaW9uLnN0cmluZ3MsIG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMpIDpcbiAgICAgICAgICAgIG9wLmV4cHJlc3Npb247XG4gICAgICAgIGNvbnN0IGNyZWF0ZU9wID0gaXIuY3JlYXRlUHJvcGVydHlDcmVhdGVPcChcbiAgICAgICAgICAgIG9wLmJpbmRpbmdYcmVmLCBvcC50YXJnZXQsIG9wLm5hbWUsIGV4cHJlc3Npb24sIG9wLmlzQW5pbWF0aW9uVHJpZ2dlcixcbiAgICAgICAgICAgIG9wLnNlY3VyaXR5Q29udGV4dCwgb3AuaXNUZW1wbGF0ZSwgb3Auc291cmNlU3Bhbik7XG5cbiAgICAgICAgLy8gUmVwbGFjZSB0aGUgcGxhY2Vob2xkZXIgd2l0aCB0aGUgbmV3IGluc3RydWN0aW9uLlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4ocGxhY2Vob2xkZXJPcCwgY3JlYXRlT3ApO1xuICAgICAgICBwbGFjZWhvbGRlcnMuZGVsZXRlKG9wLmJpbmRpbmdYcmVmKTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHByb3BlcnR5IHVwZGF0ZSBvcGVyYXRpb24sIGFzIHdlIGhhdmUgdGhlIGNyZWF0ZSBvcGVyYXRpb24gbm93LlxuICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFsbCByZW1haW5pbmcgcGxhY2Vob2xkZXJzLiBOb3QgYWxsIGJpbmRpbmcgb3BlcmF0aW9uc1xuICAvLyBlbmQgdXAgaW4gdGhlIGNyZWF0ZSBibG9jaywgZXZlbiBmb3Igc2lnbmFsIGpvYnMuIEZvciBub24tc2lnbmFsXG4gIC8vIGpvYnMgd2UgcmVtb3ZlIGFsbCBwbGFjZWhvbGRlciBvcGVyYXRpb25zLlxuICBmb3IgKGNvbnN0IG9wIG9mIHBsYWNlaG9sZGVycy52YWx1ZXMoKSkge1xuICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgfVxufVxuIl19