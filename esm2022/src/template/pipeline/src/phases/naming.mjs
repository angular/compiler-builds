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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQXdFLE1BQU0sZ0JBQWdCLENBQUM7QUFDMUgsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRWxEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUFtQjtJQUM3QyxjQUFjLENBQ1YsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxFQUFFLEVBQUMsS0FBSyxFQUFFLENBQUMsRUFBQyxFQUN2QyxHQUFHLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzVFLENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FDbkIsSUFBcUIsRUFBRSxRQUFnQixFQUFFLEtBQXNCLEVBQUUsYUFBc0I7SUFDekYsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLGtCQUFrQixDQUFDLEdBQUcsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztLQUN0RTtJQUVELDRGQUE0RjtJQUM1Riw0Q0FBNEM7SUFDNUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFFOUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJ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USxDQUFDLElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQzFELE1BQU07WUFDUjtnQkFDRSxRQUFRLENBQUMsSUFBSSxHQUFHLEtBQUssS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQ3JDLE1BQU07U0FDVDtLQUNGO0lBQ0QsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBWTtJQUMxQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQVk7SUFDbEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNsRCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRTtRQUN2QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aHlwaGVuYXRlfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvc3R5bGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Vmlld0NvbXBpbGF0aW9uVW5pdCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXQsIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge3ByZWZpeFdpdGhOYW1lc3BhY2V9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG4vKipcbiAqIEdlbmVyYXRlIG5hbWVzIGZvciBmdW5jdGlvbnMgYW5kIHZhcmlhYmxlcyBhY3Jvc3MgYWxsIHZpZXdzLlxuICpcbiAqIFRoaXMgaW5jbHVkZXMgcHJvcGFnYXRpbmcgdGhvc2UgbmFtZXMgaW50byBhbnkgYGlyLlJlYWRWYXJpYWJsZUV4cHJgcyBvZiB0aG9zZSB2YXJpYWJsZXMsIHNvIHRoYXRcbiAqIHRoZSByZWFkcyBjYW4gYmUgZW1pdHRlZCBjb3JyZWN0bHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZU5hbWluZyhjcGw6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgY3BsLnJvb3QsIGNwbC5jb21wb25lbnROYW1lLCB7aW5kZXg6IDB9LFxuICAgICAgY3BsLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpO1xufVxuXG5mdW5jdGlvbiBhZGROYW1lc1RvVmlldyhcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIGJhc2VOYW1lOiBzdHJpbmcsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0sIGNvbXBhdGliaWxpdHk6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKHVuaXQuZm5OYW1lID09PSBudWxsKSB7XG4gICAgdW5pdC5mbk5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoYCR7YmFzZU5hbWV9XyR7dW5pdC5qb2IuZm5TdWZmaXh9YCk7XG4gIH1cblxuICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBuYW1lcyB3ZSBhc3NpZ24gdG8gdmFyaWFibGVzIGluIHRoZSB2aWV3LiBXZSdsbCBuZWVkIHRvIHByb3BhZ2F0ZSB0aGVzZVxuICAvLyBpbnRvIHJlYWRzIG9mIHRob3NlIHZhcmlhYmxlcyBhZnRlcndhcmRzLlxuICBjb25zdCB2YXJOYW1lcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICAgICAgaWYgKG9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgIG9wLm5hbWUgPSAnQCcgKyBvcC5uYW1lO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGlmIChvcC5oYW5kbGVyRm5OYW1lICE9PSBudWxsKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFvcC5ob3N0TGlzdGVuZXIgJiYgb3AudGFyZ2V0U2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFuaW1hdGlvbiA9ICcnO1xuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25MaXN0ZW5lcikge1xuICAgICAgICAgIG9wLm5hbWUgPSBgQCR7b3AubmFtZX0uJHtvcC5hbmltYXRpb25QaGFzZX1gO1xuICAgICAgICAgIGFuaW1hdGlvbiA9ICdhbmltYXRpb24nO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5ob3N0TGlzdGVuZXIpIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7YmFzZU5hbWV9XyR7YW5pbWF0aW9ufSR7b3AubmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7dW5pdC5mbk5hbWV9XyR7b3AudGFnIS5yZXBsYWNlKCctJywgJ18nKX1fJHthbmltYXRpb259JHtvcC5uYW1lfV8ke1xuICAgICAgICAgICAgICBvcC50YXJnZXRTbG90fV9saXN0ZW5lcmA7XG4gICAgICAgIH1cbiAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihvcC5oYW5kbGVyRm5OYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgdmFyTmFtZXMuc2V0KG9wLnhyZWYsIGdldFZhcmlhYmxlTmFtZShvcC52YXJpYWJsZSwgc3RhdGUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAob3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgY2hpbGRWaWV3LCBgJHtiYXNlTmFtZX1fJHtwcmVmaXhXaXRoTmFtZXNwYWNlKG9wLnRhZywgb3AubmFtZXNwYWNlKX1fJHtvcC5zbG90fWAsIHN0YXRlLFxuICAgICAgICAgICAgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBvcC5uYW1lID0gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShvcC5uYW1lKTtcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhhdmluZyBuYW1lZCBhbGwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB2aWV3LCBub3cgd2UgY2FuIHB1c2ggdGhvc2UgbmFtZXMgaW50byB0aGVcbiAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZhcmlhYmxlICR7ZXhwci54cmVmfSBub3QgeWV0IG5hbWVkYCk7XG4gICAgICB9XG4gICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVOYW1lKHZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogc3RyaW5nIHtcbiAgaWYgKHZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICBzd2l0Y2ggKHZhcmlhYmxlLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dDpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBjdHhfciR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9XyR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgX3Ike3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YXJpYWJsZS5uYW1lO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBzdHlsZSBwcm9wIG5hbWUgYnkgaHlwaGVuYXRpbmcgaXQgKHVubGVzcyBpdHMgYSBDU1MgdmFyaWFibGUpLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVTdHlsZVByb3BOYW1lKG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKCctLScpID8gbmFtZSA6IGh5cGhlbmF0ZShuYW1lKTtcbn1cblxuLyoqXG4gKiBTdHJpcHMgYCFpbXBvcnRhbnRgIG91dCBvZiB0aGUgZ2l2ZW4gc3R5bGUgb3IgY2xhc3MgbmFtZS5cbiAqL1xuZnVuY3Rpb24gc3RyaXBJbXBvcnRhbnQobmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGltcG9ydGFudEluZGV4ID0gbmFtZS5pbmRleE9mKCchaW1wb3J0YW50Jyk7XG4gIGlmIChpbXBvcnRhbnRJbmRleCA+IC0xKSB7XG4gICAgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKDAsIGltcG9ydGFudEluZGV4KTtcbiAgfVxuICByZXR1cm4gbmFtZTtcbn1cbiJdfQ==