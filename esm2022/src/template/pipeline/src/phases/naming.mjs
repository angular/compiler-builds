/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { sanitizeIdentifier } from '../../../../parse_util';
import { hyphenate } from '../../../../render3/view/style_parser';
import * as ir from '../../ir';
import { ViewCompilationUnit } from '../compilation';
/**
 * Generate names for functions and variables across all views.
 *
 * This includes propagating those names into any `ir.ReadVariableExpr`s of those variables, so that
 * the reads can be emitted correctly.
 */
export function phaseNaming(cpl) {
    addNamesToView(cpl.root, cpl.componentName, { index: 0 }, cpl.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder);
}
function addNamesToView(unit, baseName, state, compatibility) {
    if (unit.fnName === null) {
        unit.fnName = sanitizeIdentifier(`${baseName}_${unit.job.fnSuffix}`);
    }
    // Keep track of the names we assign to variables in the view. We'll need to propagate these
    // into reads of those variables afterwards.
    const varNames = new Map();
    for (const op of unit.ops()) {
        switch (op.kind) {
            case ir.OpKind.Property:
            case ir.OpKind.HostProperty:
                if (op.isAnimationTrigger) {
                    op.name = '@' + op.name;
                }
                break;
            case ir.OpKind.Listener:
                if (op.handlerFnName !== null) {
                    break;
                }
                if (!op.hostListener && op.targetSlot.slot === null) {
                    throw new Error(`Expected a slot to be assigned`);
                }
                let animation = '';
                if (op.isAnimationListener) {
                    op.name = `@${op.name}.${op.animationPhase}`;
                    animation = 'animation';
                }
                if (op.hostListener) {
                    op.handlerFnName = `${baseName}_${animation}${op.name}_HostBindingHandler`;
                }
                else {
                    op.handlerFnName = `${unit.fnName}_${op.tag.replace('-', '_')}_${animation}${op.name}_${op.targetSlot.slot}_listener`;
                }
                op.handlerFnName = sanitizeIdentifier(op.handlerFnName);
                break;
            case ir.OpKind.Variable:
                varNames.set(op.xref, getVariableName(op.variable, state));
                break;
            case ir.OpKind.RepeaterCreate:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                if (op.slot.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                if (op.emptyView !== null) {
                    const emptyView = unit.job.views.get(op.emptyView);
                    // Repeater empty view function is at slot +2 (metadata is in the first slot).
                    addNamesToView(emptyView, `${baseName}_${`${op.functionNameSuffix}Empty`}_${op.slot.slot + 2}`, state, compatibility);
                }
                // Repeater primary view function is at slot +1 (metadata is in the first slot).
                addNamesToView(unit.job.views.get(op.xref), `${baseName}_${op.functionNameSuffix}_${op.slot.slot + 1}`, state, compatibility);
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                const childView = unit.job.views.get(op.xref);
                if (op.slot.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                const suffix = op.functionNameSuffix.length === 0 ? '' : `_${op.functionNameSuffix}`;
                addNamesToView(childView, `${baseName}${suffix}_${op.slot.slot}`, state, compatibility);
                break;
            case ir.OpKind.StyleProp:
                op.name = normalizeStylePropName(op.name);
                if (compatibility) {
                    op.name = stripImportant(op.name);
                }
                break;
            case ir.OpKind.ClassProp:
                if (compatibility) {
                    op.name = stripImportant(op.name);
                }
                break;
        }
    }
    // Having named all variables declared in the view, now we can push those names into the
    // `ir.ReadVariableExpr` expressions which represent reads of those variables.
    for (const op of unit.ops()) {
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
            case ir.SemanticVariableKind.Context:
                variable.name = `ctx_r${state.index++}`;
                break;
            case ir.SemanticVariableKind.Identifier:
                // TODO: Prefix increment and `_r` for compatiblity only.
                variable.name = `${variable.identifier}_r${++state.index}`;
                break;
            default:
                // TODO: Prefix increment for compatibility only.
                variable.name = `_r${++state.index}`;
                break;
        }
    }
    return variable.name;
}
/**
 * Normalizes a style prop name by hyphenating it (unless its a CSS variable).
 */
function normalizeStylePropName(name) {
    return name.startsWith('--') ? name : hyphenate(name);
}
/**
 * Strips `!important` out of the given style or class name.
 */
function stripImportant(name) {
    const importantIndex = name.indexOf('!important');
    if (importantIndex > -1) {
        return name.substring(0, importantIndex);
    }
    return name;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFFOUY7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUFDLEdBQW1CO0lBQzdDLGNBQWMsQ0FDVixHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLEVBQUUsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLEVBQ3ZDLEdBQUcsQ0FBQyxhQUFhLEtBQUssRUFBRSxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDNUUsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUNuQixJQUFxQixFQUFFLFFBQWdCLEVBQUUsS0FBc0IsRUFBRSxhQUFzQjtJQUN6RixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0tBQ3RFO0lBRUQsNEZBQTRGO0lBQzVGLDRDQUE0QztJQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUU5QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUMzQixRQUFRLEVBQUUsQ0FB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RSxDQUFDO2dCQUMzRCxNQUFNO1lBQ1I7Z0JBQ0UsaURBQWlEO2dCQUNqRCxRQUFRLENBQUMsSUFBSSxHQUFHLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3JDLE1BQU07U0FDVDtLQUNGO0lBQ0QsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBWTtJQUMxQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQVk7SUFDbEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNsRCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRTtRQUN2QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aHlwaGVuYXRlfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvc3R5bGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Vmlld0NvbXBpbGF0aW9uVW5pdCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBuYW1lcyBmb3IgZnVuY3Rpb25zIGFuZCB2YXJpYWJsZXMgYWNyb3NzIGFsbCB2aWV3cy5cbiAqXG4gKiBUaGlzIGluY2x1ZGVzIHByb3BhZ2F0aW5nIHRob3NlIG5hbWVzIGludG8gYW55IGBpci5SZWFkVmFyaWFibGVFeHByYHMgb2YgdGhvc2UgdmFyaWFibGVzLCBzbyB0aGF0XG4gKiB0aGUgcmVhZHMgY2FuIGJlIGVtaXR0ZWQgY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VOYW1pbmcoY3BsOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBhZGROYW1lc1RvVmlldyhcbiAgICAgIGNwbC5yb290LCBjcGwuY29tcG9uZW50TmFtZSwge2luZGV4OiAwfSxcbiAgICAgIGNwbC5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9LCBjb21wYXRpYmlsaXR5OiBib29sZWFuKTogdm9pZCB7XG4gIGlmICh1bml0LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIHVuaXQuZm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGAke2Jhc2VOYW1lfV8ke3VuaXQuam9iLmZuU3VmZml4fWApO1xuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgLy8gaW50byByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMgYWZ0ZXJ3YXJkcy5cbiAgY29uc3QgdmFyTmFtZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICBvcC5uYW1lID0gJ0AnICsgb3AubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICBpZiAob3AuaGFuZGxlckZuTmFtZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3AuaG9zdExpc3RlbmVyICYmIG9wLnRhcmdldFNsb3Quc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFuaW1hdGlvbiA9ICcnO1xuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25MaXN0ZW5lcikge1xuICAgICAgICAgIG9wLm5hbWUgPSBgQCR7b3AubmFtZX0uJHtvcC5hbmltYXRpb25QaGFzZX1gO1xuICAgICAgICAgIGFuaW1hdGlvbiA9ICdhbmltYXRpb24nO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5ob3N0TGlzdGVuZXIpIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7YmFzZU5hbWV9XyR7YW5pbWF0aW9ufSR7b3AubmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7dW5pdC5mbk5hbWV9XyR7b3AudGFnIS5yZXBsYWNlKCctJywgJ18nKX1fJHthbmltYXRpb259JHtvcC5uYW1lfV8ke1xuICAgICAgICAgICAgICBvcC50YXJnZXRTbG90LnNsb3R9X2xpc3RlbmVyYDtcbiAgICAgICAgfVxuICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG9wLmhhbmRsZXJGbk5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICB2YXJOYW1lcy5zZXQob3AueHJlZiwgZ2V0VmFyaWFibGVOYW1lKG9wLnZhcmlhYmxlLCBzdGF0ZSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5zbG90LnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgZW1wdHlWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLmVtcHR5VmlldykhO1xuICAgICAgICAgIC8vIFJlcGVhdGVyIGVtcHR5IHZpZXcgZnVuY3Rpb24gaXMgYXQgc2xvdCArMiAobWV0YWRhdGEgaXMgaW4gdGhlIGZpcnN0IHNsb3QpLlxuICAgICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgICBlbXB0eVZpZXcsIGAke2Jhc2VOYW1lfV8ke2Ake29wLmZ1bmN0aW9uTmFtZVN1ZmZpeH1FbXB0eWB9XyR7b3Auc2xvdC5zbG90ICsgMn1gLFxuICAgICAgICAgICAgICBzdGF0ZSwgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVwZWF0ZXIgcHJpbWFyeSB2aWV3IGZ1bmN0aW9uIGlzIGF0IHNsb3QgKzEgKG1ldGFkYXRhIGlzIGluIHRoZSBmaXJzdCBzbG90KS5cbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoXG4gICAgICAgICAgICB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhLFxuICAgICAgICAgICAgYCR7YmFzZU5hbWV9XyR7b3AuZnVuY3Rpb25OYW1lU3VmZml4fV8ke29wLnNsb3Quc2xvdCArIDF9YCwgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChvcC5zbG90LnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdWZmaXggPSBvcC5mdW5jdGlvbk5hbWVTdWZmaXgubGVuZ3RoID09PSAwID8gJycgOiBgXyR7b3AuZnVuY3Rpb25OYW1lU3VmZml4fWA7XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KGNoaWxkVmlldywgYCR7YmFzZU5hbWV9JHtzdWZmaXh9XyR7b3Auc2xvdC5zbG90fWAsIHN0YXRlLCBjb21wYXRpYmlsaXR5KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgICAgIG9wLm5hbWUgPSBub3JtYWxpemVTdHlsZVByb3BOYW1lKG9wLm5hbWUpO1xuICAgICAgICBpZiAoY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAgIG9wLm5hbWUgPSBzdHJpcEltcG9ydGFudChvcC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gSGF2aW5nIG5hbWVkIGFsbCB2YXJpYWJsZXMgZGVjbGFyZWQgaW4gdGhlIHZpZXcsIG5vdyB3ZSBjYW4gcHVzaCB0aG9zZSBuYW1lcyBpbnRvIHRoZVxuICAvLyBgaXIuUmVhZFZhcmlhYmxlRXhwcmAgZXhwcmVzc2lvbnMgd2hpY2ggcmVwcmVzZW50IHJlYWRzIG9mIHRob3NlIHZhcmlhYmxlcy5cbiAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIGlyLlJlYWRWYXJpYWJsZUV4cHIpIHx8IGV4cHIubmFtZSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXZhck5hbWVzLmhhcyhleHByLnhyZWYpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVmFyaWFibGUgJHtleHByLnhyZWZ9IG5vdCB5ZXQgbmFtZWRgKTtcbiAgICAgIH1cbiAgICAgIGV4cHIubmFtZSA9IHZhck5hbWVzLmdldChleHByLnhyZWYpITtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRWYXJpYWJsZU5hbWUodmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGUsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0pOiBzdHJpbmcge1xuICBpZiAodmFyaWFibGUubmFtZSA9PT0gbnVsbCkge1xuICAgIHN3aXRjaCAodmFyaWFibGUua2luZCkge1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0OlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYGN0eF9yJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICAvLyBUT0RPOiBQcmVmaXggaW5jcmVtZW50IGFuZCBgX3JgIGZvciBjb21wYXRpYmxpdHkgb25seS5cbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9X3Ikeysrc3RhdGUuaW5kZXh9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyBUT0RPOiBQcmVmaXggaW5jcmVtZW50IGZvciBjb21wYXRpYmlsaXR5IG9ubHkuXG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgX3Ikeysrc3RhdGUuaW5kZXh9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YXJpYWJsZS5uYW1lO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBzdHlsZSBwcm9wIG5hbWUgYnkgaHlwaGVuYXRpbmcgaXQgKHVubGVzcyBpdHMgYSBDU1MgdmFyaWFibGUpLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVTdHlsZVByb3BOYW1lKG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKCctLScpID8gbmFtZSA6IGh5cGhlbmF0ZShuYW1lKTtcbn1cblxuLyoqXG4gKiBTdHJpcHMgYCFpbXBvcnRhbnRgIG91dCBvZiB0aGUgZ2l2ZW4gc3R5bGUgb3IgY2xhc3MgbmFtZS5cbiAqL1xuZnVuY3Rpb24gc3RyaXBJbXBvcnRhbnQobmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGltcG9ydGFudEluZGV4ID0gbmFtZS5pbmRleE9mKCchaW1wb3J0YW50Jyk7XG4gIGlmIChpbXBvcnRhbnRJbmRleCA+IC0xKSB7XG4gICAgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKDAsIGltcG9ydGFudEluZGV4KTtcbiAgfVxuICByZXR1cm4gbmFtZTtcbn1cbiJdfQ==