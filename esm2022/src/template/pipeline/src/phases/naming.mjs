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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFFOUY7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBbUI7SUFDM0QsY0FBYyxDQUNWLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsRUFBRSxFQUFDLEtBQUssRUFBRSxDQUFDLEVBQUMsRUFDdkMsR0FBRyxDQUFDLGFBQWEsS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQ25CLElBQXFCLEVBQUUsUUFBZ0IsRUFBRSxLQUFzQixFQUFFLGFBQXNCO0lBQ3pGLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLGtCQUFrQixDQUFDLEdBQUcsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQsNEZBQTRGO0lBQzVGLDRDQUE0QztJQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUU5QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO1FB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QUFDLElBQVk7SUFDbEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNsRCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3Nhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2h5cGhlbmF0ZX0gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L3N0eWxlX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge1ZpZXdDb21waWxhdGlvblVuaXQsIHR5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgbmFtZXMgZm9yIGZ1bmN0aW9ucyBhbmQgdmFyaWFibGVzIGFjcm9zcyBhbGwgdmlld3MuXG4gKlxuICogVGhpcyBpbmNsdWRlcyBwcm9wYWdhdGluZyB0aG9zZSBuYW1lcyBpbnRvIGFueSBgaXIuUmVhZFZhcmlhYmxlRXhwcmBzIG9mIHRob3NlIHZhcmlhYmxlcywgc28gdGhhdFxuICogdGhlIHJlYWRzIGNhbiBiZSBlbWl0dGVkIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5hbWVGdW5jdGlvbnNBbmRWYXJpYWJsZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBhZGROYW1lc1RvVmlldyhcbiAgICAgIGpvYi5yb290LCBqb2IuY29tcG9uZW50TmFtZSwge2luZGV4OiAwfSxcbiAgICAgIGpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9LCBjb21wYXRpYmlsaXR5OiBib29sZWFuKTogdm9pZCB7XG4gIGlmICh1bml0LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIHVuaXQuZm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGAke2Jhc2VOYW1lfV8ke3VuaXQuam9iLmZuU3VmZml4fWApO1xuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgLy8gaW50byByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMgYWZ0ZXJ3YXJkcy5cbiAgY29uc3QgdmFyTmFtZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICBvcC5uYW1lID0gJ0AnICsgb3AubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICBpZiAob3AuaGFuZGxlckZuTmFtZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3AuaG9zdExpc3RlbmVyICYmIG9wLnRhcmdldFNsb3Quc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzbG90IHRvIGJlIGFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFuaW1hdGlvbiA9ICcnO1xuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25MaXN0ZW5lcikge1xuICAgICAgICAgIG9wLm5hbWUgPSBgQCR7b3AubmFtZX0uJHtvcC5hbmltYXRpb25QaGFzZX1gO1xuICAgICAgICAgIGFuaW1hdGlvbiA9ICdhbmltYXRpb24nO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5ob3N0TGlzdGVuZXIpIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7YmFzZU5hbWV9XyR7YW5pbWF0aW9ufSR7b3AubmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gYCR7dW5pdC5mbk5hbWV9XyR7b3AudGFnIS5yZXBsYWNlKCctJywgJ18nKX1fJHthbmltYXRpb259JHtvcC5uYW1lfV8ke1xuICAgICAgICAgICAgICBvcC50YXJnZXRTbG90LnNsb3R9X2xpc3RlbmVyYDtcbiAgICAgICAgfVxuICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG9wLmhhbmRsZXJGbk5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICB2YXJOYW1lcy5zZXQob3AueHJlZiwgZ2V0VmFyaWFibGVOYW1lKHVuaXQsIG9wLnZhcmlhYmxlLCBzdGF0ZSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5lbXB0eVZpZXcgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBlbXB0eVZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AuZW1wdHlWaWV3KSE7XG4gICAgICAgICAgLy8gUmVwZWF0ZXIgZW1wdHkgdmlldyBmdW5jdGlvbiBpcyBhdCBzbG90ICsyIChtZXRhZGF0YSBpcyBpbiB0aGUgZmlyc3Qgc2xvdCkuXG4gICAgICAgICAgYWRkTmFtZXNUb1ZpZXcoXG4gICAgICAgICAgICAgIGVtcHR5VmlldywgYCR7YmFzZU5hbWV9XyR7YCR7b3AuZnVuY3Rpb25OYW1lU3VmZml4fUVtcHR5YH1fJHtvcC5oYW5kbGUuc2xvdCArIDJ9YCxcbiAgICAgICAgICAgICAgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJlcGVhdGVyIHByaW1hcnkgdmlldyBmdW5jdGlvbiBpcyBhdCBzbG90ICsxIChtZXRhZGF0YSBpcyBpbiB0aGUgZmlyc3Qgc2xvdCkuXG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISxcbiAgICAgICAgICAgIGAke2Jhc2VOYW1lfV8ke29wLmZ1bmN0aW9uTmFtZVN1ZmZpeH1fJHtvcC5oYW5kbGUuc2xvdCArIDF9YCwgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN1ZmZpeCA9IG9wLmZ1bmN0aW9uTmFtZVN1ZmZpeC5sZW5ndGggPT09IDAgPyAnJyA6IGBfJHtvcC5mdW5jdGlvbk5hbWVTdWZmaXh9YDtcbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoY2hpbGRWaWV3LCBgJHtiYXNlTmFtZX0ke3N1ZmZpeH1fJHtvcC5oYW5kbGUuc2xvdH1gLCBzdGF0ZSwgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBvcC5uYW1lID0gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShvcC5uYW1lKTtcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhhdmluZyBuYW1lZCBhbGwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB2aWV3LCBub3cgd2UgY2FuIHB1c2ggdGhvc2UgbmFtZXMgaW50byB0aGVcbiAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZhcmlhYmxlICR7ZXhwci54cmVmfSBub3QgeWV0IG5hbWVkYCk7XG4gICAgICB9XG4gICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVOYW1lKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgdmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGUsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0pOiBzdHJpbmcge1xuICBpZiAodmFyaWFibGUubmFtZSA9PT0gbnVsbCkge1xuICAgIHN3aXRjaCAodmFyaWFibGUua2luZCkge1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0OlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYGN0eF9yJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICBpZiAodW5pdC5qb2IuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcikge1xuICAgICAgICAgIC8vIFRPRE86IFByZWZpeCBpbmNyZW1lbnQgYW5kIGBfcmAgYXJlIGZvciBjb21wYXRpYmxpdHkgd2l0aCB0aGUgb2xkIG5hbWluZyBzY2hlbWUuXG4gICAgICAgICAgLy8gVGhpcyBoYXMgdGhlIHBvdGVudGlhbCB0byBjYXVzZSBjb2xsaXNpb25zIHdoZW4gYGN0eGAgaXMgdGhlIGlkZW50aWZpZXIsIHNvIHdlIG5lZWQgYVxuICAgICAgICAgIC8vIHNwZWNpYWwgY2hlY2sgZm9yIHRoYXQgYXMgd2VsbC5cbiAgICAgICAgICBjb25zdCBjb21wYXRQcmVmaXggPSB2YXJpYWJsZS5pZGVudGlmaWVyID09PSAnY3R4JyA/ICdpJyA6ICcnO1xuICAgICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgJHt2YXJpYWJsZS5pZGVudGlmaWVyfV8ke2NvbXBhdFByZWZpeH1yJHsrK3N0YXRlLmluZGV4fWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyaWFibGUubmFtZSA9IGAke3ZhcmlhYmxlLmlkZW50aWZpZXJ9X2kke3N0YXRlLmluZGV4Kyt9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gVE9ETzogUHJlZml4IGluY3JlbWVudCBmb3IgY29tcGF0aWJpbGl0eSBvbmx5LlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYF9yJHsrK3N0YXRlLmluZGV4fWA7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFyaWFibGUubmFtZTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIGEgc3R5bGUgcHJvcCBuYW1lIGJ5IGh5cGhlbmF0aW5nIGl0ICh1bmxlc3MgaXRzIGEgQ1NTIHZhcmlhYmxlKS5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplU3R5bGVQcm9wTmFtZShuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIG5hbWUuc3RhcnRzV2l0aCgnLS0nKSA/IG5hbWUgOiBoeXBoZW5hdGUobmFtZSk7XG59XG5cbi8qKlxuICogU3RyaXBzIGAhaW1wb3J0YW50YCBvdXQgb2YgdGhlIGdpdmVuIHN0eWxlIG9yIGNsYXNzIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIHN0cmlwSW1wb3J0YW50KG5hbWU6IHN0cmluZykge1xuICBjb25zdCBpbXBvcnRhbnRJbmRleCA9IG5hbWUuaW5kZXhPZignIWltcG9ydGFudCcpO1xuICBpZiAoaW1wb3J0YW50SW5kZXggPiAtMSkge1xuICAgIHJldHVybiBuYW1lLnN1YnN0cmluZygwLCBpbXBvcnRhbnRJbmRleCk7XG4gIH1cbiAgcmV0dXJuIG5hbWU7XG59XG4iXX0=