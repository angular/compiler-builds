/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Generate names for functions and variables across all views.
 *
 * This includes propagating those names into any `ir.ReadVariableExpr`s of those variables, so that
 * the reads can be emitted correctly.
 */
export function phaseNaming(cpl) {
    addNamesToView(cpl.root, cpl.componentName, { index: 0 });
}
function addNamesToView(view, baseName, state) {
    if (view.fnName === null) {
        view.fnName = `${baseName}_Template`;
    }
    // Keep track of the names we assign to variables in the view. We'll need to propagate these
    // into reads of those variables afterwards.
    const varNames = new Map();
    for (const op of view.ops()) {
        switch (op.kind) {
            case ir.OpKind.Listener:
                if (op.handlerFnName === null) {
                    // TODO(alxhub): convert this temporary name to match how the
                    // `TemplateDefinitionBuilder` names listener functions.
                    if (op.slot === null) {
                        throw new Error(`Expected a slot to be assigned`);
                    }
                    op.handlerFnName = `${view.fnName}_${op.tag}_${op.name}_${op.slot}_listener`;
                }
                break;
            case ir.OpKind.Variable:
                varNames.set(op.xref, getVariableName(op.variable, state));
                break;
            case ir.OpKind.Template:
                const childView = view.tpl.views.get(op.xref);
                if (op.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                // TODO: properly escape the tag name.
                const safeTagName = op.tag.replace('-', '_');
                addNamesToView(childView, `${baseName}_${safeTagName}_${op.slot}`, state);
                break;
        }
    }
    // Having named all variables declared in the view, now we can push those names into the
    // `ir.ReadVariableExpr` expressions which represent reads of those variables.
    for (const op of view.ops()) {
        ir.visitExpressionsInOp(op, expr => {
            if (!(expr instanceof ir.ReadVariableExpr) || expr.name !== null) {
                return;
            }
            if (!varNames.has(expr.xref)) {
                throw new Error(`Variable ${expr.xref} not yet named`);
            }
            expr.name = varNames.get(expr.xref);
        });
    }
}
function getVariableName(variable, state) {
    if (variable.name === null) {
        switch (variable.kind) {
            case ir.SemanticVariableKind.Identifier:
                variable.name = `${variable.identifier}_${state.index++}`;
                break;
            default:
                variable.name = `_r${state.index++}`;
                break;
        }
    }
    return variable.name;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBSS9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUF5QjtJQUNuRCxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxFQUFFLEVBQUMsS0FBSyxFQUFFLENBQUMsRUFBQyxDQUFDLENBQUM7QUFDMUQsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLElBQXFCLEVBQUUsUUFBZ0IsRUFBRSxLQUFzQjtJQUNyRixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxRQUFRLFdBQVcsQ0FBQztLQUN0QztJQUVELDRGQUE0RjtJQUM1Riw0Q0FBNEM7SUFDNUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFFOUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDM0IsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLElBQUksRUFBRSxDQUFDLGFBQWEsS0FBSyxJQUFJLEVBQUU7b0JBQzdCLDZEQUE2RDtvQkFDN0Qsd0RBQXdEO29CQUN4RCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO3dCQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7cUJBQ25EO29CQUNELEVBQUUsQ0FBQyxhQUFhLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxXQUFXLENBQUM7aUJBQzlFO2dCQUNELE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzNELE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsQ0FBQztnQkFDL0MsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtvQkFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO2lCQUNqRDtnQkFDRCxzQ0FBc0M7Z0JBQ3RDLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDN0MsY0FBYyxDQUFDLFNBQVMsRUFBRSxHQUFHLFFBQVEsSUFBSSxXQUFXLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUMxRSxNQUFNO1NBQ1Q7S0FDRjtJQUVELHdGQUF3RjtJQUN4Riw4RUFBOEU7SUFDOUUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDM0IsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNqQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7Z0JBQ2hFLE9BQU87YUFDUjtZQUNELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxJQUFJLGdCQUFnQixDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFJLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBRSxDQUFDO1FBQ3ZDLENBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFDSCxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsUUFBNkIsRUFBRSxLQUFzQjtJQUM1RSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQzFCLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRTtZQUNyQixLQUFLLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVO2dCQUNyQyxRQUFRLENBQUMsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDMUQsTUFBTTtZQUNSO2dCQUNFLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDckMsTUFBTTtTQUNUO0tBQ0Y7SUFDRCxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgbmFtZXMgZm9yIGZ1bmN0aW9ucyBhbmQgdmFyaWFibGVzIGFjcm9zcyBhbGwgdmlld3MuXG4gKlxuICogVGhpcyBpbmNsdWRlcyBwcm9wYWdhdGluZyB0aG9zZSBuYW1lcyBpbnRvIGFueSBgaXIuUmVhZFZhcmlhYmxlRXhwcmBzIG9mIHRob3NlIHZhcmlhYmxlcywgc28gdGhhdFxuICogdGhlIHJlYWRzIGNhbiBiZSBlbWl0dGVkIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlTmFtaW5nKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgYWRkTmFtZXNUb1ZpZXcoY3BsLnJvb3QsIGNwbC5jb21wb25lbnROYW1lLCB7aW5kZXg6IDB9KTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uLCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogdm9pZCB7XG4gIGlmICh2aWV3LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIHZpZXcuZm5OYW1lID0gYCR7YmFzZU5hbWV9X1RlbXBsYXRlYDtcbiAgfVxuXG4gIC8vIEtlZXAgdHJhY2sgb2YgdGhlIG5hbWVzIHdlIGFzc2lnbiB0byB2YXJpYWJsZXMgaW4gdGhlIHZpZXcuIFdlJ2xsIG5lZWQgdG8gcHJvcGFnYXRlIHRoZXNlXG4gIC8vIGludG8gcmVhZHMgb2YgdGhvc2UgdmFyaWFibGVzIGFmdGVyd2FyZHMuXG4gIGNvbnN0IHZhck5hbWVzID0gbmV3IE1hcDxpci5YcmVmSWQsIHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcub3BzKCkpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICBpZiAob3AuaGFuZGxlckZuTmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogY29udmVydCB0aGlzIHRlbXBvcmFyeSBuYW1lIHRvIG1hdGNoIGhvdyB0aGVcbiAgICAgICAgICAvLyBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgbmFtZXMgbGlzdGVuZXIgZnVuY3Rpb25zLlxuICAgICAgICAgIGlmIChvcC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7dmlldy5mbk5hbWV9XyR7b3AudGFnfV8ke29wLm5hbWV9XyR7b3Auc2xvdH1fbGlzdGVuZXJgO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIHZhck5hbWVzLnNldChvcC54cmVmLCBnZXRWYXJpYWJsZU5hbWUob3AudmFyaWFibGUsIHN0YXRlKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IHZpZXcudHBsLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChvcC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVE9ETzogcHJvcGVybHkgZXNjYXBlIHRoZSB0YWcgbmFtZS5cbiAgICAgICAgY29uc3Qgc2FmZVRhZ05hbWUgPSBvcC50YWcucmVwbGFjZSgnLScsICdfJyk7XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KGNoaWxkVmlldywgYCR7YmFzZU5hbWV9XyR7c2FmZVRhZ05hbWV9XyR7b3Auc2xvdH1gLCBzdGF0ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhhdmluZyBuYW1lZCBhbGwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB2aWV3LCBub3cgd2UgY2FuIHB1c2ggdGhvc2UgbmFtZXMgaW50byB0aGVcbiAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZhcmlhYmxlICR7ZXhwci54cmVmfSBub3QgeWV0IG5hbWVkYCk7XG4gICAgICB9XG4gICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVOYW1lKHZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogc3RyaW5nIHtcbiAgaWYgKHZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICBzd2l0Y2ggKHZhcmlhYmxlLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9XyR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgX3Ike3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YXJpYWJsZS5uYW1lO1xufVxuIl19