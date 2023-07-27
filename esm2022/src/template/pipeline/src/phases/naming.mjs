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
                addNamesToView(childView, `${baseName}_${op.tag}_${op.slot}`, state, compatibility);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQTRDLG1CQUFtQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFOUY7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUFDLEdBQW1CO0lBQzdDLGNBQWMsQ0FDVixHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLEVBQUUsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLEVBQ3ZDLEdBQUcsQ0FBQyxhQUFhLEtBQUssRUFBRSxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDNUUsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUNuQixJQUFxQixFQUFFLFFBQWdCLEVBQUUsS0FBc0IsRUFBRSxhQUFzQjtJQUN6RixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0tBQ3RFO0lBRUQsNEZBQTRGO0lBQzVGLDRDQUE0QztJQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUU5QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUMzQixRQUFRLEVBQUUsQ0FB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KipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtoeXBoZW5hdGV9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9zdHlsZV9wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHt0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uVW5pdCwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEdlbmVyYXRlIG5hbWVzIGZvciBmdW5jdGlvbnMgYW5kIHZhcmlhYmxlcyBhY3Jvc3MgYWxsIHZpZXdzLlxuICpcbiAqIFRoaXMgaW5jbHVkZXMgcHJvcGFnYXRpbmcgdGhvc2UgbmFtZXMgaW50byBhbnkgYGlyLlJlYWRWYXJpYWJsZUV4cHJgcyBvZiB0aG9zZSB2YXJpYWJsZXMsIHNvIHRoYXRcbiAqIHRoZSByZWFkcyBjYW4gYmUgZW1pdHRlZCBjb3JyZWN0bHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZU5hbWluZyhjcGw6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgY3BsLnJvb3QsIGNwbC5jb21wb25lbnROYW1lLCB7aW5kZXg6IDB9LFxuICAgICAgY3BsLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpO1xufVxuXG5mdW5jdGlvbiBhZGROYW1lc1RvVmlldyhcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIGJhc2VOYW1lOiBzdHJpbmcsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0sIGNvbXBhdGliaWxpdHk6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKHVuaXQuZm5OYW1lID09PSBudWxsKSB7XG4gICAgdW5pdC5mbk5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoYCR7YmFzZU5hbWV9XyR7dW5pdC5qb2IuZm5TdWZmaXh9YCk7XG4gIH1cblxuICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBuYW1lcyB3ZSBhc3NpZ24gdG8gdmFyaWFibGVzIGluIHRoZSB2aWV3LiBXZSdsbCBuZWVkIHRvIHByb3BhZ2F0ZSB0aGVzZVxuICAvLyBpbnRvIHJlYWRzIG9mIHRob3NlIHZhcmlhYmxlcyBhZnRlcndhcmRzLlxuICBjb25zdCB2YXJOYW1lcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgaWYgKG9wLmhhbmRsZXJGbk5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IGNvbnZlcnQgdGhpcyB0ZW1wb3JhcnkgbmFtZSB0byBtYXRjaCBob3cgdGhlXG4gICAgICAgICAgLy8gYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgIG5hbWVzIGxpc3RlbmVyIGZ1bmN0aW9ucy5cbiAgICAgICAgICBpZiAob3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgc2FmZVRhZ05hbWUgPSBvcC50YWcucmVwbGFjZSgnLScsICdfJyk7XG5cbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID1cbiAgICAgICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGAke3VuaXQuZm5OYW1lfV8ke3NhZmVUYWdOYW1lfV8ke29wLm5hbWV9XyR7b3Auc2xvdH1fbGlzdGVuZXJgKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICB2YXJOYW1lcy5zZXQob3AueHJlZiwgZ2V0VmFyaWFibGVOYW1lKG9wLnZhcmlhYmxlLCBzdGF0ZSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChvcC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoY2hpbGRWaWV3LCBgJHtiYXNlTmFtZX1fJHtvcC50YWd9XyR7b3Auc2xvdH1gLCBzdGF0ZSwgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBvcC5uYW1lID0gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShvcC5uYW1lKTtcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhhdmluZyBuYW1lZCBhbGwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB2aWV3LCBub3cgd2UgY2FuIHB1c2ggdGhvc2UgbmFtZXMgaW50byB0aGVcbiAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZhcmlhYmxlICR7ZXhwci54cmVmfSBub3QgeWV0IG5hbWVkYCk7XG4gICAgICB9XG4gICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVOYW1lKHZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogc3RyaW5nIHtcbiAgaWYgKHZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICBzd2l0Y2ggKHZhcmlhYmxlLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dDpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBjdHhfciR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9XyR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgX3Ike3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YXJpYWJsZS5uYW1lO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBzdHlsZSBwcm9wIG5hbWUgYnkgaHlwaGVuYXRpbmcgaXQgKHVubGVzcyBpdHMgYSBDU1MgdmFyaWFibGUpLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVTdHlsZVByb3BOYW1lKG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKCctLScpID8gbmFtZSA6IGh5cGhlbmF0ZShuYW1lKTtcbn1cblxuLyoqXG4gKiBTdHJpcHMgYCFpbXBvcnRhbnRgIG91dCBvZiB0aGUgZ2l2ZW4gc3R5bGUgb3IgY2xhc3MgbmFtZS5cbiAqL1xuZnVuY3Rpb24gc3RyaXBJbXBvcnRhbnQobmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGltcG9ydGFudEluZGV4ID0gbmFtZS5pbmRleE9mKCchaW1wb3J0YW50Jyk7XG4gIGlmIChpbXBvcnRhbnRJbmRleCA+IC0xKSB7XG4gICAgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKDAsIGltcG9ydGFudEluZGV4KTtcbiAgfVxuICByZXR1cm4gbmFtZTtcbn1cbiJdfQ==