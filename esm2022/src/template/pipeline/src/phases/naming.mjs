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
            case ir.OpKind.Listener:
                if (op.handlerFnName === null) {
                    // TODO(alxhub): convert this temporary name to match how the
                    // `TemplateDefinitionBuilder` names listener functions.
                    if (op.slot === null) {
                        throw new Error(`Expected a slot to be assigned`);
                    }
                    const safeTagName = op.tag.replace('-', '_');
                    op.handlerFnName =
                        sanitizeIdentifier(`${unit.fnName}_${safeTagName}_${op.name}_${op.slot}_listener`);
                }
                break;
            case ir.OpKind.Variable:
                varNames.set(op.xref, getVariableName(op.variable, state));
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                const childView = unit.job.views.get(op.xref);
                if (op.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                addNamesToView(childView, `${baseName}_${prefixWithNamespace(op.tag, op.namespace)}_${op.slot}`, state, compatibility);
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
                variable.name = `${variable.identifier}_${state.index++}`;
                break;
            default:
                variable.name = `_r${state.index++}`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQTRDLG1CQUFtQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxFQUFrQixtQkFBbUIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUVuRTs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxXQUFXLENBQUMsR0FBbUI7SUFDN0MsY0FBYyxDQUNWLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsRUFBRSxFQUFDLEtBQUssRUFBRSxDQUFDLEVBQUMsRUFDdkMsR0FBRyxDQUFDLGFBQWEsS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQ25CLElBQXFCLEVBQUUsUUFBZ0IsRUFBRSxLQUFzQixFQUFFLGFBQXNCO0lBQ3pGLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDeEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxrQkFBa0IsQ0FBQyxHQUFHLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7S0FDdEU7SUFFRCw0RkFBNEY7SUFDNUYsNENBQTRDO0lBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTlDLEtBQUssTUFBTSxFQUFFLElBQUks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Q0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aHlwaGVuYXRlfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvc3R5bGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7dHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXQsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7a2V5Rm9yTmFtZXNwYWNlLCBwcmVmaXhXaXRoTmFtZXNwYWNlfSBmcm9tICcuLi9jb252ZXJzaW9uJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBuYW1lcyBmb3IgZnVuY3Rpb25zIGFuZCB2YXJpYWJsZXMgYWNyb3NzIGFsbCB2aWV3cy5cbiAqXG4gKiBUaGlzIGluY2x1ZGVzIHByb3BhZ2F0aW5nIHRob3NlIG5hbWVzIGludG8gYW55IGBpci5SZWFkVmFyaWFibGVFeHByYHMgb2YgdGhvc2UgdmFyaWFibGVzLCBzbyB0aGF0XG4gKiB0aGUgcmVhZHMgY2FuIGJlIGVtaXR0ZWQgY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VOYW1pbmcoY3BsOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBhZGROYW1lc1RvVmlldyhcbiAgICAgIGNwbC5yb290LCBjcGwuY29tcG9uZW50TmFtZSwge2luZGV4OiAwfSxcbiAgICAgIGNwbC5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9LCBjb21wYXRpYmlsaXR5OiBib29sZWFuKTogdm9pZCB7XG4gIGlmICh1bml0LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIHVuaXQuZm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGAke2Jhc2VOYW1lfV8ke3VuaXQuam9iLmZuU3VmZml4fWApO1xuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgLy8gaW50byByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMgYWZ0ZXJ3YXJkcy5cbiAgY29uc3QgdmFyTmFtZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGlmIChvcC5oYW5kbGVyRm5OYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBjb252ZXJ0IHRoaXMgdGVtcG9yYXJ5IG5hbWUgdG8gbWF0Y2ggaG93IHRoZVxuICAgICAgICAgIC8vIGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYCBuYW1lcyBsaXN0ZW5lciBmdW5jdGlvbnMuXG4gICAgICAgICAgaWYgKG9wLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHNhZmVUYWdOYW1lID0gb3AudGFnLnJlcGxhY2UoJy0nLCAnXycpO1xuXG4gICAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9XG4gICAgICAgICAgICAgIHNhbml0aXplSWRlbnRpZmllcihgJHt1bml0LmZuTmFtZX1fJHtzYWZlVGFnTmFtZX1fJHtvcC5uYW1lfV8ke29wLnNsb3R9X2xpc3RlbmVyYCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgdmFyTmFtZXMuc2V0KG9wLnhyZWYsIGdldFZhcmlhYmxlTmFtZShvcC52YXJpYWJsZSwgc3RhdGUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAob3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgY2hpbGRWaWV3LCBgJHtiYXNlTmFtZX1fJHtwcmVmaXhXaXRoTmFtZXNwYWNlKG9wLnRhZywgb3AubmFtZXNwYWNlKX1fJHtvcC5zbG90fWAsIHN0YXRlLFxuICAgICAgICAgICAgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBvcC5uYW1lID0gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShvcC5uYW1lKTtcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhhdmluZyBuYW1lZCBhbGwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB2aWV3LCBub3cgd2UgY2FuIHB1c2ggdGhvc2UgbmFtZXMgaW50byB0aGVcbiAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZhcmlhYmxlICR7ZXhwci54cmVmfSBub3QgeWV0IG5hbWVkYCk7XG4gICAgICB9XG4gICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVOYW1lKHZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogc3RyaW5nIHtcbiAgaWYgKHZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICBzd2l0Y2ggKHZhcmlhYmxlLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dDpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBjdHhfciR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9XyR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgX3Ike3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YXJpYWJsZS5uYW1lO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBzdHlsZSBwcm9wIG5hbWUgYnkgaHlwaGVuYXRpbmcgaXQgKHVubGVzcyBpdHMgYSBDU1MgdmFyaWFibGUpLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVTdHlsZVByb3BOYW1lKG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKCctLScpID8gbmFtZSA6IGh5cGhlbmF0ZShuYW1lKTtcbn1cblxuLyoqXG4gKiBTdHJpcHMgYCFpbXBvcnRhbnRgIG91dCBvZiB0aGUgZ2l2ZW4gc3R5bGUgb3IgY2xhc3MgbmFtZS5cbiAqL1xuZnVuY3Rpb24gc3RyaXBJbXBvcnRhbnQobmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGltcG9ydGFudEluZGV4ID0gbmFtZS5pbmRleE9mKCchaW1wb3J0YW50Jyk7XG4gIGlmIChpbXBvcnRhbnRJbmRleCA+IC0xKSB7XG4gICAgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKDAsIGltcG9ydGFudEluZGV4KTtcbiAgfVxuICByZXR1cm4gbmFtZTtcbn1cbiJdfQ==