/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { sanitizeIdentifier } from '../../../../parse_util';
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
        view.fnName = sanitizeIdentifier(`${baseName}_Template`);
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
                    op.handlerFnName =
                        sanitizeIdentifier(`${view.fnName}_${op.tag}_${op.name}_${op.slot}_listener`);
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
                addNamesToView(childView, `${baseName}_${op.tag}_${op.slot}`, state);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUF5QjtJQUNuRCxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxFQUFFLEVBQUMsS0FBSyxFQUFFLENBQUMsRUFBQyxDQUFDLENBQUM7QUFDMUQsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLElBQXFCLEVBQUUsUUFBZ0IsRUFBRSxLQUFzQjtJQUNyRixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxRQUFRLFdBQVcsQ0FBQyxDQUFDO0tBQzFEO0lBRUQsNEZBQTRGO0lBQzVGLDRDQUE0QztJQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUU5QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUMzQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsSUFBSSxFQUFFLENBQUMsYUFBYSxLQUFLLElBQUksRUFBRTtvQkFDN0IsNkRBQTZEO29CQUM3RCx3REFBd0Q7b0JBQ3hELElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7d0JBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztxQkFDbkQ7b0JBQ0QsRUFBRSxDQUFDLGFBQWE7d0JBQ1osa0JBQWtCLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxXQUFXLENBQUMsQ0FBQztpQkFDbkY7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDM0QsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxDQUFDO2dCQUMvQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO29CQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7aUJBQ2pEO2dCQUNELGNBQWMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxRQUFRLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ3JFLE1BQU07U0FDVDtLQUNGO0lBRUQsd0ZBQXdGO0lBQ3hGLDhFQUE4RTtJQUM5RSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUMzQixFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ2pDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtnQkFDaEUsT0FBTzthQUNSO1lBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQzthQUN4RDtZQUNELElBQUksQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUM7S0FDSjtBQUNILENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxRQUE2QixFQUFFLEtBQXNCO0lBQzVFLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7UUFDMUIsUUFBUSxRQUFRLENBQUMsSUFBSSxFQUFFO1lBQ3JCLEtBQUssRUFBRSxDQUFDLG9CQUFvQixDQUFDLFVBQVU7Z0JBQ3JDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDO2dCQUMxRCxNQUFNO1lBQ1I7Z0JBQ0UsUUFBUSxDQUFDLElBQUksR0FBRyxLQUFLLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDO2dCQUNyQyxNQUFNO1NBQ1Q7S0FDRjtJQUNELE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgbmFtZXMgZm9yIGZ1bmN0aW9ucyBhbmQgdmFyaWFibGVzIGFjcm9zcyBhbGwgdmlld3MuXG4gKlxuICogVGhpcyBpbmNsdWRlcyBwcm9wYWdhdGluZyB0aG9zZSBuYW1lcyBpbnRvIGFueSBgaXIuUmVhZFZhcmlhYmxlRXhwcmBzIG9mIHRob3NlIHZhcmlhYmxlcywgc28gdGhhdFxuICogdGhlIHJlYWRzIGNhbiBiZSBlbWl0dGVkIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlTmFtaW5nKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgYWRkTmFtZXNUb1ZpZXcoY3BsLnJvb3QsIGNwbC5jb21wb25lbnROYW1lLCB7aW5kZXg6IDB9KTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uLCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogdm9pZCB7XG4gIGlmICh2aWV3LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIHZpZXcuZm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGAke2Jhc2VOYW1lfV9UZW1wbGF0ZWApO1xuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgLy8gaW50byByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMgYWZ0ZXJ3YXJkcy5cbiAgY29uc3QgdmFyTmFtZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGlmIChvcC5oYW5kbGVyRm5OYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBjb252ZXJ0IHRoaXMgdGVtcG9yYXJ5IG5hbWUgdG8gbWF0Y2ggaG93IHRoZVxuICAgICAgICAgIC8vIGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYCBuYW1lcyBsaXN0ZW5lciBmdW5jdGlvbnMuXG4gICAgICAgICAgaWYgKG9wLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9wLmhhbmRsZXJGbk5hbWUgPVxuICAgICAgICAgICAgICBzYW5pdGl6ZUlkZW50aWZpZXIoYCR7dmlldy5mbk5hbWV9XyR7b3AudGFnfV8ke29wLm5hbWV9XyR7b3Auc2xvdH1fbGlzdGVuZXJgKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICB2YXJOYW1lcy5zZXQob3AueHJlZiwgZ2V0VmFyaWFibGVOYW1lKG9wLnZhcmlhYmxlLCBzdGF0ZSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB2aWV3LnRwbC52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAob3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KGNoaWxkVmlldywgYCR7YmFzZU5hbWV9XyR7b3AudGFnfV8ke29wLnNsb3R9YCwgc3RhdGUpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBIYXZpbmcgbmFtZWQgYWxsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdmlldywgbm93IHdlIGNhbiBwdXNoIHRob3NlIG5hbWVzIGludG8gdGhlXG4gIC8vIGBpci5SZWFkVmFyaWFibGVFeHByYCBleHByZXNzaW9ucyB3aGljaCByZXByZXNlbnQgcmVhZHMgb2YgdGhvc2UgdmFyaWFibGVzLlxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcub3BzKCkpIHtcbiAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICBpZiAoIShleHByIGluc3RhbmNlb2YgaXIuUmVhZFZhcmlhYmxlRXhwcikgfHwgZXhwci5uYW1lICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdmFyTmFtZXMuaGFzKGV4cHIueHJlZikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWYXJpYWJsZSAke2V4cHIueHJlZn0gbm90IHlldCBuYW1lZGApO1xuICAgICAgfVxuICAgICAgZXhwci5uYW1lID0gdmFyTmFtZXMuZ2V0KGV4cHIueHJlZikhO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhcmlhYmxlTmFtZSh2YXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZSwgc3RhdGU6IHtpbmRleDogbnVtYmVyfSk6IHN0cmluZyB7XG4gIGlmICh2YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgc3dpdGNoICh2YXJpYWJsZS5raW5kKSB7XG4gICAgICBjYXNlIGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXI6XG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgJHt2YXJpYWJsZS5pZGVudGlmaWVyfV8ke3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYF9yJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFyaWFibGUubmFtZTtcbn1cbiJdfQ==