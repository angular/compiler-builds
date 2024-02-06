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
export function nameFunctionsAndVariables(job) {
    addNamesToView(job.root, job.componentName, { index: 0 }, job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder);
}
function addNamesToView(unit, baseName, state, compatibility) {
    if (unit.fnName === null) {
        // Ensure unique names for view units. This is necessary because there might be multiple
        // components with same names in the context of the same pool. Only add the suffix
        // if really needed.
        unit.fnName = unit.job.pool.uniqueName(sanitizeIdentifier(`${baseName}_${unit.job.fnSuffix}`), /* alwaysIncludeSuffix */ false);
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
            case ir.OpKind.TwoWayListener:
                if (op.handlerFnName !== null) {
                    break;
                }
                if (op.targetSlot.slot === null) {
                    throw new Error(`Expected a slot to be assigned`);
                }
                op.handlerFnName = sanitizeIdentifier(`${unit.fnName}_${op.tag.replace('-', '_')}_${op.name}_${op.targetSlot.slot}_listener`);
                break;
            case ir.OpKind.Variable:
                varNames.set(op.xref, getVariableName(unit, op.variable, state));
                break;
            case ir.OpKind.RepeaterCreate:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                if (op.handle.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                if (op.emptyView !== null) {
                    const emptyView = unit.job.views.get(op.emptyView);
                    // Repeater empty view function is at slot +2 (metadata is in the first slot).
                    addNamesToView(emptyView, `${baseName}_${`${op.functionNameSuffix}Empty`}_${op.handle.slot + 2}`, state, compatibility);
                }
                // Repeater primary view function is at slot +1 (metadata is in the first slot).
                addNamesToView(unit.job.views.get(op.xref), `${baseName}_${op.functionNameSuffix}_${op.handle.slot + 1}`, state, compatibility);
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                const childView = unit.job.views.get(op.xref);
                if (op.handle.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                const suffix = op.functionNameSuffix.length === 0 ? '' : `_${op.functionNameSuffix}`;
                addNamesToView(childView, `${baseName}${suffix}_${op.handle.slot}`, state, compatibility);
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
function getVariableName(unit, variable, state) {
    if (variable.name === null) {
        switch (variable.kind) {
            case ir.SemanticVariableKind.Context:
                variable.name = `ctx_r${state.index++}`;
                break;
            case ir.SemanticVariableKind.Identifier:
                if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder) {
                    // TODO: Prefix increment and `_r` are for compatiblity with the old naming scheme.
                    // This has the potential to cause collisions when `ctx` is the identifier, so we need a
                    // special check for that as well.
                    const compatPrefix = variable.identifier === 'ctx' ? 'i' : '';
                    variable.name = `${variable.identifier}_${compatPrefix}r${++state.index}`;
                }
                else {
                    variable.name = `${variable.identifier}_i${state.index++}`;
                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQTRDLG1CQUFtQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFOUY7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBbUI7SUFDM0QsY0FBYyxDQUNWLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsRUFBRSxFQUFDLEtBQUssRUFBRSxDQUFDLEVBQUMsRUFDdkMsR0FBRyxDQUFDLGFBQWEsS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQ25CLElBQXFCLEVBQUUsUUFBZ0IsRUFBRSxLQUFzQixFQUFFLGFBQXNCO0lBQ3pGLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN6Qix3RkFBd0Y7UUFDeEYsa0ZBQWtGO1FBQ2xGLG9CQUFvQjtRQUNwQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FDbEMsa0JBQWtCLENBQUMsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFRCw0RkFBNEY7SUFDNUYs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QVEsQ0FBQyxVQUFVLElBQUksWUFBWSxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUM1RSxDQUFDO3FCQUFNLENBQUM7b0JBQ04sUUFBUSxDQUFDLElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQzdELENBQUM7Z0JBRUQsTUFBTTtZQUNSO2dCQUNFLGlEQUFpRDtnQkFDakQsUUFBUSxDQUFDLElBQUksR0FBRyxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNyQyxNQUFNO1FBQ1YsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUM7QUFDdkIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxzQkFBc0IsQ0FBQyxJQUFZO0lBQzFDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxjQUFjLENBQUMsSUFBWTtJQUNsQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2xELElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aHlwaGVuYXRlfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvc3R5bGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7dHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXQsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBuYW1lcyBmb3IgZnVuY3Rpb25zIGFuZCB2YXJpYWJsZXMgYWNyb3NzIGFsbCB2aWV3cy5cbiAqXG4gKiBUaGlzIGluY2x1ZGVzIHByb3BhZ2F0aW5nIHRob3NlIG5hbWVzIGludG8gYW55IGBpci5SZWFkVmFyaWFibGVFeHByYHMgb2YgdGhvc2UgdmFyaWFibGVzLCBzbyB0aGF0XG4gKiB0aGUgcmVhZHMgY2FuIGJlIGVtaXR0ZWQgY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gbmFtZUZ1bmN0aW9uc0FuZFZhcmlhYmxlcyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgam9iLnJvb3QsIGpvYi5jb21wb25lbnROYW1lLCB7aW5kZXg6IDB9LFxuICAgICAgam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpO1xufVxuXG5mdW5jdGlvbiBhZGROYW1lc1RvVmlldyhcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIGJhc2VOYW1lOiBzdHJpbmcsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0sIGNvbXBhdGliaWxpdHk6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKHVuaXQuZm5OYW1lID09PSBudWxsKSB7XG4gICAgLy8gRW5zdXJlIHVuaXF1ZSBuYW1lcyBmb3IgdmlldyB1bml0cy4gVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSB0aGVyZSBtaWdodCBiZSBtdWx0aXBsZVxuICAgIC8vIGNvbXBvbmVudHMgd2l0aCBzYW1lIG5hbWVzIGluIHRoZSBjb250ZXh0IG9mIHRoZSBzYW1lIHBvb2wuIE9ubHkgYWRkIHRoZSBzdWZmaXhcbiAgICAvLyBpZiByZWFsbHkgbmVlZGVkLlxuICAgIHVuaXQuZm5OYW1lID0gdW5pdC5qb2IucG9vbC51bmlxdWVOYW1lKFxuICAgICAgICBzYW5pdGl6ZUlkZW50aWZpZXIoYCR7YmFzZU5hbWV9XyR7dW5pdC5qb2IuZm5TdWZmaXh9YCksIC8qIGFsd2F5c0luY2x1ZGVTdWZmaXggKi8gZmFsc2UpO1xuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgLy8gaW50byByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMgYWZ0ZXJ3YXJkcy5cbiAgY29uc3QgdmFyTmFtZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICBvcC5uYW1lID0gJ0AnICsgb3AubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICBpZiAob3AuaGFuZGxlckZuTmFtZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3AuaG9zdExpc3RlbmVyICYmIG9wLnRhcmdldFNsb3Quc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFuaW1hdGlvbiA9ICcnO1xuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25MaXN0ZW5lcikge1xuICAgICAgICAgIG9wLm5hbWUgPSBgQCR7b3AubmFtZX0uJHtvcC5hbmltYXRpb25QaGFzZX1gO1xuICAgICAgICAgIGFuaW1hdGlvbiA9ICdhbmltYXRpb24nO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5ob3N0TGlzdGVuZXIpIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7YmFzZU5hbWV9XyR7YW5pbWF0aW9ufSR7b3AubmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7dW5pdC5mbk5hbWV9XyR7b3AudGFnIS5yZXBsYWNlKCctJywgJ18nKX1fJHthbmltYXRpb259JHtvcC5uYW1lfV8ke1xuICAgICAgICAgICAgICBvcC50YXJnZXRTbG90LnNsb3R9X2xpc3RlbmVyYDtcbiAgICAgICAgfVxuICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG9wLmhhbmRsZXJGbk5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlR3b1dheUxpc3RlbmVyOlxuICAgICAgICBpZiAob3AuaGFuZGxlckZuTmFtZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC50YXJnZXRTbG90LnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIG9wLmhhbmRsZXJGbk5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoYCR7dW5pdC5mbk5hbWV9XyR7b3AudGFnIS5yZXBsYWNlKCctJywgJ18nKX1fJHtcbiAgICAgICAgICAgIG9wLm5hbWV9XyR7b3AudGFyZ2V0U2xvdC5zbG90fV9saXN0ZW5lcmApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICB2YXJOYW1lcy5zZXQob3AueHJlZiwgZ2V0VmFyaWFibGVOYW1lKHVuaXQsIG9wLnZhcmlhYmxlLCBzdGF0ZSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5lbXB0eVZpZXcgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBlbXB0eVZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AuZW1wdHlWaWV3KSE7XG4gICAgICAgICAgLy8gUmVwZWF0ZXIgZW1wdHkgdmlldyBmdW5jdGlvbiBpcyBhdCBzbG90ICsyIChtZXRhZGF0YSBpcyBpbiB0aGUgZmlyc3Qgc2xvdCkuXG4gICAgICAgICAgYWRkTmFtZXNUb1ZpZXcoXG4gICAgICAgICAgICAgIGVtcHR5VmlldywgYCR7YmFzZU5hbWV9XyR7YCR7b3AuZnVuY3Rpb25OYW1lU3VmZml4fUVtcHR5YH1fJHtvcC5oYW5kbGUuc2xvdCArIDJ9YCxcbiAgICAgICAgICAgICAgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJlcGVhdGVyIHByaW1hcnkgdmlldyBmdW5jdGlvbiBpcyBhdCBzbG90ICsxIChtZXRhZGF0YSBpcyBpbiB0aGUgZmlyc3Qgc2xvdCkuXG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISxcbiAgICAgICAgICAgIGAke2Jhc2VOYW1lfV8ke29wLmZ1bmN0aW9uTmFtZVN1ZmZpeH1fJHtvcC5oYW5kbGUuc2xvdCArIDF9YCwgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN1ZmZpeCA9IG9wLmZ1bmN0aW9uTmFtZVN1ZmZpeC5sZW5ndGggPT09IDAgPyAnJyA6IGBfJHtvcC5mdW5jdGlvbk5hbWVTdWZmaXh9YDtcbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoY2hpbGRWaWV3LCBgJHtiYXNlTmFtZX0ke3N1ZmZpeH1fJHtvcC5oYW5kbGUuc2xvdH1gLCBzdGF0ZSwgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBvcC5uYW1lID0gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShvcC5uYW1lKTtcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhhdmluZyBuYW1lZCBhbGwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB2aWV3LCBub3cgd2UgY2FuIHB1c2ggdGhvc2UgbmFtZXMgaW50byB0aGVcbiAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZhcmlhYmxlICR7ZXhwci54cmVmfSBub3QgeWV0IG5hbWVkYCk7XG4gICAgICB9XG4gICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVOYW1lKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgdmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGUsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0pOiBzdHJpbmcge1xuICBpZiAodmFyaWFibGUubmFtZSA9PT0gbnVsbCkge1xuICAgIHN3aXRjaCAodmFyaWFibGUua2luZCkge1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0OlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYGN0eF9yJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICBpZiAodW5pdC5qb2IuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcikge1xuICAgICAgICAgIC8vIFRPRE86IFByZWZpeCBpbmNyZW1lbnQgYW5kIGBfcmAgYXJlIGZvciBjb21wYXRpYmxpdHkgd2l0aCB0aGUgb2xkIG5hbWluZyBzY2hlbWUuXG4gICAgICAgICAgLy8gVGhpcyBoYXMgdGhlIHBvdGVudGlhbCB0byBjYXVzZSBjb2xsaXNpb25zIHdoZW4gYGN0eGAgaXMgdGhlIGlkZW50aWZpZXIsIHNvIHdlIG5lZWQgYVxuICAgICAgICAgIC8vIHNwZWNpYWwgY2hlY2sgZm9yIHRoYXQgYXMgd2VsbC5cbiAgICAgICAgICBjb25zdCBjb21wYXRQcmVmaXggPSB2YXJpYWJsZS5pZGVudGlmaWVyID09PSAnY3R4JyA/ICdpJyA6ICcnO1xuICAgICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgJHt2YXJpYWJsZS5pZGVudGlmaWVyfV8ke2NvbXBhdFByZWZpeH1yJHsrK3N0YXRlLmluZGV4fWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9X2kke3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gVE9ETzogUHJlZml4IGluY3JlbWVudCBmb3IgY29tcGF0aWJpbGl0eSBvbmx5LlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYF9yJHsrK3N0YXRlLmluZGV4fWA7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFyaWFibGUubmFtZTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIGEgc3R5bGUgcHJvcCBuYW1lIGJ5IGh5cGhlbmF0aW5nIGl0ICh1bmxlc3MgaXRzIGEgQ1NTIHZhcmlhYmxlKS5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIG5hbWUuc3RhcnRzV2l0aCgnLS0nKSA/IG5hbWUgOiBoeXBoZW5hdGUobmFtZSk7XG59XG5cbi8qKlxuICogU3RyaXBzIGAhaW1wb3J0YW50YCBvdXQgb2YgdGhlIGdpdmVuIHN0eWxlIG9yIGNsYXNzIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIHN0cmlwSW1wb3J0YW50KG5hbWU6IHN0cmluZykge1xuICBjb25zdCBpbXBvcnRhbnRJbmRleCA9IG5hbWUuaW5kZXhPZignIWltcG9ydGFudCcpO1xuICBpZiAoaW1wb3J0YW50SW5kZXggPiAtMSkge1xuICAgIHJldHVybiBuYW1lLnN1YnN0cmluZygwLCBpbXBvcnRhbnRJbmRleCk7XG4gIH1cbiAgcmV0dXJuIG5hbWU7XG59XG4iXX0=