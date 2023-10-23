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
import { prefixWithNamespace } from '../conversion';
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
                if (!op.hostListener && op.targetSlot === null) {
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
                    op.handlerFnName = `${unit.fnName}_${op.tag.replace('-', '_')}_${animation}${op.name}_${op.targetSlot}_listener`;
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
                if (op.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                if (op.emptyView !== null) {
                    const emptyView = unit.job.views.get(op.emptyView);
                    // Repeater empty view function is at slot +2 (metadata is in the first slot).
                    addNamesToView(emptyView, `${baseName}_${prefixWithNamespace(`${op.tag}Empty`, op.namespace)}_${op.slot + 2}`, state, compatibility);
                }
                const repeaterToken = op.tag === null ? '' : '_' + prefixWithNamespace(op.tag, op.namespace);
                // Repeater primary view function is at slot +1 (metadata is in the first slot).
                addNamesToView(unit.job.views.get(op.xref), `${baseName}${repeaterToken}_${op.slot + 1}`, state, compatibility);
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                const childView = unit.job.views.get(op.xref);
                if (op.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                const tagToken = op.tag === null ? '' : '_' + prefixWithNamespace(op.tag, op.namespace);
                addNamesToView(childView, `${baseName}${tagToken}_${op.slot}`, state, compatibility);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRWxEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUFtQjtJQUM3QyxjQUFjLENBQ1YsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxFQUFFLEVBQUMsS0FBSyxFQUFFLENBQUMsRUFBQyxFQUN2QyxHQUFHLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzVFLENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FDbkIsSUFBcUIsRUFBRSxRQUFnQixFQUFFLEtBQXNCLEVBQUUsYUFBc0I7SUFDekYsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLGtCQUFrQixDQUFDLEdBQUcsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztLQUN0RTtJQUVELDRGQUE0RjtJQUM1Riw0Q0FBNEM7SUFDNUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFFOUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJ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S0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQ3hDLE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVO2dCQUNyQyx5REFBeUQ7Z0JBQ3pELFFBQVEsQ0FBQyxJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsVUFBVSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMzRCxNQUFNO1lBQ1I7Z0JBQ0UsaURBQWlEO2dCQUNqRCxRQUFRLENBQUMsSUFBSSxHQUFHLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3JDLE1BQU07U0FDVDtLQUNGO0lBQ0QsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBWTtJQUMxQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQVk7SUFDbEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNsRCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRTtRQUN2QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aHlwaGVuYXRlfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvc3R5bGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Vmlld0NvbXBpbGF0aW9uVW5pdCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7cHJlZml4V2l0aE5hbWVzcGFjZX0gZnJvbSAnLi4vY29udmVyc2lvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgbmFtZXMgZm9yIGZ1bmN0aW9ucyBhbmQgdmFyaWFibGVzIGFjcm9zcyBhbGwgdmlld3MuXG4gKlxuICogVGhpcyBpbmNsdWRlcyBwcm9wYWdhdGluZyB0aG9zZSBuYW1lcyBpbnRvIGFueSBgaXIuUmVhZFZhcmlhYmxlRXhwcmBzIG9mIHRob3NlIHZhcmlhYmxlcywgc28gdGhhdFxuICogdGhlIHJlYWRzIGNhbiBiZSBlbWl0dGVkIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlTmFtaW5nKGNwbDogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgYWRkTmFtZXNUb1ZpZXcoXG4gICAgICBjcGwucm9vdCwgY3BsLmNvbXBvbmVudE5hbWUsIHtpbmRleDogMH0sXG4gICAgICBjcGwuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcik7XG59XG5cbmZ1bmN0aW9uIGFkZE5hbWVzVG9WaWV3KFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgYmFzZU5hbWU6IHN0cmluZywgc3RhdGU6IHtpbmRleDogbnVtYmVyfSwgY29tcGF0aWJpbGl0eTogYm9vbGVhbik6IHZvaWQge1xuICBpZiAodW5pdC5mbk5hbWUgPT09IG51bGwpIHtcbiAgICB1bml0LmZuTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihgJHtiYXNlTmFtZX1fJHt1bml0LmpvYi5mblN1ZmZpeH1gKTtcbiAgfVxuXG4gIC8vIEtlZXAgdHJhY2sgb2YgdGhlIG5hbWVzIHdlIGFzc2lnbiB0byB2YXJpYWJsZXMgaW4gdGhlIHZpZXcuIFdlJ2xsIG5lZWQgdG8gcHJvcGFnYXRlIHRoZXNlXG4gIC8vIGludG8gcmVhZHMgb2YgdGhvc2UgdmFyaWFibGVzIGFmdGVyd2FyZHMuXG4gIGNvbnN0IHZhck5hbWVzID0gbmV3IE1hcDxpci5YcmVmSWQsIHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgY2FzZSBpci5PcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25UcmlnZ2VyKSB7XG4gICAgICAgICAgb3AubmFtZSA9ICdAJyArIG9wLm5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgaWYgKG9wLmhhbmRsZXJGbk5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW9wLmhvc3RMaXN0ZW5lciAmJiBvcC50YXJnZXRTbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgYW5pbWF0aW9uID0gJyc7XG4gICAgICAgIGlmIChvcC5pc0FuaW1hdGlvbkxpc3RlbmVyKSB7XG4gICAgICAgICAgb3AubmFtZSA9IGBAJHtvcC5uYW1lfS4ke29wLmFuaW1hdGlvblBoYXNlfWA7XG4gICAgICAgICAgYW5pbWF0aW9uID0gJ2FuaW1hdGlvbic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLmhvc3RMaXN0ZW5lcikge1xuICAgICAgICAgIG9wLmhhbmRsZXJGbk5hbWUgPSBgJHtiYXNlTmFtZX1fJHthbmltYXRpb259JHtvcC5uYW1lfV9Ib3N0QmluZGluZ0hhbmRsZXJgO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9wLmhhbmRsZXJGbk5hbWUgPSBgJHt1bml0LmZuTmFtZX1fJHtvcC50YWchLnJlcGxhY2UoJy0nLCAnXycpfV8ke2FuaW1hdGlvbn0ke29wLm5hbWV9XyR7XG4gICAgICAgICAgICAgIG9wLnRhcmdldFNsb3R9X2xpc3RlbmVyYDtcbiAgICAgICAgfVxuICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG9wLmhhbmRsZXJGbk5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICB2YXJOYW1lcy5zZXQob3AueHJlZiwgZ2V0VmFyaWFibGVOYW1lKG9wLnZhcmlhYmxlLCBzdGF0ZSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLmVtcHR5VmlldyAhPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnN0IGVtcHR5VmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC5lbXB0eVZpZXcpITtcbiAgICAgICAgICAvLyBSZXBlYXRlciBlbXB0eSB2aWV3IGZ1bmN0aW9uIGlzIGF0IHNsb3QgKzIgKG1ldGFkYXRhIGlzIGluIHRoZSBmaXJzdCBzbG90KS5cbiAgICAgICAgICBhZGROYW1lc1RvVmlldyhcbiAgICAgICAgICAgICAgZW1wdHlWaWV3LFxuICAgICAgICAgICAgICBgJHtiYXNlTmFtZX1fJHtwcmVmaXhXaXRoTmFtZXNwYWNlKGAke29wLnRhZ31FbXB0eWAsIG9wLm5hbWVzcGFjZSl9XyR7b3Auc2xvdCArIDJ9YCxcbiAgICAgICAgICAgICAgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlcGVhdGVyVG9rZW4gPVxuICAgICAgICAgICAgb3AudGFnID09PSBudWxsID8gJycgOiAnXycgKyBwcmVmaXhXaXRoTmFtZXNwYWNlKG9wLnRhZywgb3AubmFtZXNwYWNlKTtcbiAgICAgICAgLy8gUmVwZWF0ZXIgcHJpbWFyeSB2aWV3IGZ1bmN0aW9uIGlzIGF0IHNsb3QgKzEgKG1ldGFkYXRhIGlzIGluIHRoZSBmaXJzdCBzbG90KS5cbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoXG4gICAgICAgICAgICB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhLCBgJHtiYXNlTmFtZX0ke3JlcGVhdGVyVG9rZW59XyR7b3Auc2xvdCArIDF9YCwgc3RhdGUsXG4gICAgICAgICAgICBjb21wYXRpYmlsaXR5KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAob3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRhZ1Rva2VuID0gb3AudGFnID09PSBudWxsID8gJycgOiAnXycgKyBwcmVmaXhXaXRoTmFtZXNwYWNlKG9wLnRhZywgb3AubmFtZXNwYWNlKTtcbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoY2hpbGRWaWV3LCBgJHtiYXNlTmFtZX0ke3RhZ1Rva2VufV8ke29wLnNsb3R9YCwgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgb3AubmFtZSA9IG5vcm1hbGl6ZVN0eWxlUHJvcE5hbWUob3AubmFtZSk7XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgICAgICBpZiAoY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAgIG9wLm5hbWUgPSBzdHJpcEltcG9ydGFudChvcC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBIYXZpbmcgbmFtZWQgYWxsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdmlldywgbm93IHdlIGNhbiBwdXNoIHRob3NlIG5hbWVzIGludG8gdGhlXG4gIC8vIGBpci5SZWFkVmFyaWFibGVFeHByYCBleHByZXNzaW9ucyB3aGljaCByZXByZXNlbnQgcmVhZHMgb2YgdGhvc2UgdmFyaWFibGVzLlxuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICBpZiAoIShleHByIGluc3RhbmNlb2YgaXIuUmVhZFZhcmlhYmxlRXhwcikgfHwgZXhwci5uYW1lICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdmFyTmFtZXMuaGFzKGV4cHIueHJlZikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWYXJpYWJsZSAke2V4cHIueHJlZn0gbm90IHlldCBuYW1lZGApO1xuICAgICAgfVxuICAgICAgZXhwci5uYW1lID0gdmFyTmFtZXMuZ2V0KGV4cHIueHJlZikhO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhcmlhYmxlTmFtZSh2YXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZSwgc3RhdGU6IHtpbmRleDogbnVtYmVyfSk6IHN0cmluZyB7XG4gIGlmICh2YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgc3dpdGNoICh2YXJpYWJsZS5raW5kKSB7XG4gICAgICBjYXNlIGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQ6XG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgY3R4X3Ike3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXI6XG4gICAgICAgIC8vIFRPRE86IFByZWZpeCBpbmNyZW1lbnQgYW5kIGBfcmAgZm9yIGNvbXBhdGlibGl0eSBvbmx5LlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYCR7dmFyaWFibGUuaWRlbnRpZmllcn1fciR7KytzdGF0ZS5pbmRleH1gO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIFRPRE86IFByZWZpeCBpbmNyZW1lbnQgZm9yIGNvbXBhdGliaWxpdHkgb25seS5cbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBfciR7KytzdGF0ZS5pbmRleH1gO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhcmlhYmxlLm5hbWU7XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIHN0eWxlIHByb3AgbmFtZSBieSBoeXBoZW5hdGluZyBpdCAodW5sZXNzIGl0cyBhIENTUyB2YXJpYWJsZSkuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0eWxlUHJvcE5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgoJy0tJykgPyBuYW1lIDogaHlwaGVuYXRlKG5hbWUpO1xufVxuXG4vKipcbiAqIFN0cmlwcyBgIWltcG9ydGFudGAgb3V0IG9mIHRoZSBnaXZlbiBzdHlsZSBvciBjbGFzcyBuYW1lLlxuICovXG5mdW5jdGlvbiBzdHJpcEltcG9ydGFudChuYW1lOiBzdHJpbmcpIHtcbiAgY29uc3QgaW1wb3J0YW50SW5kZXggPSBuYW1lLmluZGV4T2YoJyFpbXBvcnRhbnQnKTtcbiAgaWYgKGltcG9ydGFudEluZGV4ID4gLTEpIHtcbiAgICByZXR1cm4gbmFtZS5zdWJzdHJpbmcoMCwgaW1wb3J0YW50SW5kZXgpO1xuICB9XG4gIHJldHVybiBuYW1lO1xufVxuIl19