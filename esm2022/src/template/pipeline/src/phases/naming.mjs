/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { sanitizeIdentifier } from '../../../../parse_util';
import * as ir from '../../ir';
import { hyphenate } from './parse_extracted_styles';
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
                    addNamesToView(emptyView, `${baseName}_${op.functionNameSuffix}Empty_${op.handle.slot + 2}`, state, compatibility);
                }
                // Repeater primary view function is at slot +1 (metadata is in the first slot).
                addNamesToView(unit.job.views.get(op.xref), `${baseName}_${op.functionNameSuffix}_${op.handle.slot + 1}`, state, compatibility);
                break;
            case ir.OpKind.Projection:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                if (op.handle.slot === null) {
                    throw new Error(`Expected slot to be assigned`);
                }
                if (op.fallbackView !== null) {
                    const fallbackView = unit.job.views.get(op.fallbackView);
                    addNamesToView(fallbackView, `${baseName}_ProjectionFallback_${op.handle.slot}`, state, compatibility);
                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUVuRCxPQUFPLEVBQTRDLG1CQUFtQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFOUY7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBbUI7SUFDM0QsY0FBYyxDQUNWLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsRUFBRSxFQUFDLEtBQUssRUFBRSxDQUFDLEVBQUMsRUFDdkMsR0FBRyxDQUFDLGFBQWEsS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQ25CLElBQXFCLEVBQUUsUUFBZ0IsRUFBRSxLQUFzQixFQUFFLGFBQXNCO0lBQ3pGLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN6Qix3RkFBd0Y7UUFDeEYsa0ZBQWtGO1FBQ2xGLG9CQUFvQjtRQUNwQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FDbEMsa0JBQWtCLENBQUMsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFRCw0RkFBNEY7SUFDNUYs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Q0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQVk7SUFDbEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNsRCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3Nhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB7aHlwaGVuYXRlfSBmcm9tICcuL3BhcnNlX2V4dHJhY3RlZF9zdHlsZXMnO1xuXG5pbXBvcnQge3R5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Vbml0LCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgbmFtZXMgZm9yIGZ1bmN0aW9ucyBhbmQgdmFyaWFibGVzIGFjcm9zcyBhbGwgdmlld3MuXG4gKlxuICogVGhpcyBpbmNsdWRlcyBwcm9wYWdhdGluZyB0aG9zZSBuYW1lcyBpbnRvIGFueSBgaXIuUmVhZFZhcmlhYmxlRXhwcmBzIG9mIHRob3NlIHZhcmlhYmxlcywgc28gdGhhdFxuICogdGhlIHJlYWRzIGNhbiBiZSBlbWl0dGVkIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5hbWVGdW5jdGlvbnNBbmRWYXJpYWJsZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBhZGROYW1lc1RvVmlldyhcbiAgICAgIGpvYi5yb290LCBqb2IuY29tcG9uZW50TmFtZSwge2luZGV4OiAwfSxcbiAgICAgIGpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9LCBjb21wYXRpYmlsaXR5OiBib29sZWFuKTogdm9pZCB7XG4gIGlmICh1bml0LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIC8vIEVuc3VyZSB1bmlxdWUgbmFtZXMgZm9yIHZpZXcgdW5pdHMuIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2UgdGhlcmUgbWlnaHQgYmUgbXVsdGlwbGVcbiAgICAvLyBjb21wb25lbnRzIHdpdGggc2FtZSBuYW1lcyBpbiB0aGUgY29udGV4dCBvZiB0aGUgc2FtZSBwb29sLiBPbmx5IGFkZCB0aGUgc3VmZml4XG4gICAgLy8gaWYgcmVhbGx5IG5lZWRlZC5cbiAgICB1bml0LmZuTmFtZSA9IHVuaXQuam9iLnBvb2wudW5pcXVlTmFtZShcbiAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGAke2Jhc2VOYW1lfV8ke3VuaXQuam9iLmZuU3VmZml4fWApLCAvKiBhbHdheXNJbmNsdWRlU3VmZml4ICovIGZhbHNlKTtcbiAgfVxuXG4gIC8vIEtlZXAgdHJhY2sgb2YgdGhlIG5hbWVzIHdlIGFzc2lnbiB0byB2YXJpYWJsZXMgaW4gdGhlIHZpZXcuIFdlJ2xsIG5lZWQgdG8gcHJvcGFnYXRlIHRoZXNlXG4gIC8vIGludG8gcmVhZHMgb2YgdGhvc2UgdmFyaWFibGVzIGFmdGVyd2FyZHMuXG4gIGNvbnN0IHZhck5hbWVzID0gbmV3IE1hcDxpci5YcmVmSWQsIHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgY2FzZSBpci5PcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25UcmlnZ2VyKSB7XG4gICAgICAgICAgb3AubmFtZSA9ICdAJyArIG9wLm5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgaWYgKG9wLmhhbmRsZXJGbk5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW9wLmhvc3RMaXN0ZW5lciAmJiBvcC50YXJnZXRTbG90LnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBhbmltYXRpb24gPSAnJztcbiAgICAgICAgaWYgKG9wLmlzQW5pbWF0aW9uTGlzdGVuZXIpIHtcbiAgICAgICAgICBvcC5uYW1lID0gYEAke29wLm5hbWV9LiR7b3AuYW5pbWF0aW9uUGhhc2V9YDtcbiAgICAgICAgICBhbmltYXRpb24gPSAnYW5pbWF0aW9uJztcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuaG9zdExpc3RlbmVyKSB7XG4gICAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IGAke2Jhc2VOYW1lfV8ke2FuaW1hdGlvbn0ke29wLm5hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IGAke3VuaXQuZm5OYW1lfV8ke29wLnRhZyEucmVwbGFjZSgnLScsICdfJyl9XyR7YW5pbWF0aW9ufSR7b3AubmFtZX1fJHtcbiAgICAgICAgICAgICAgb3AudGFyZ2V0U2xvdC5zbG90fV9saXN0ZW5lcmA7XG4gICAgICAgIH1cbiAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihvcC5oYW5kbGVyRm5OYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ud29XYXlMaXN0ZW5lcjpcbiAgICAgICAgaWYgKG9wLmhhbmRsZXJGbk5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AudGFyZ2V0U2xvdC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBvcC5oYW5kbGVyRm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGAke3VuaXQuZm5OYW1lfV8ke29wLnRhZyEucmVwbGFjZSgnLScsICdfJyl9XyR7XG4gICAgICAgICAgICBvcC5uYW1lfV8ke29wLnRhcmdldFNsb3Quc2xvdH1fbGlzdGVuZXJgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgdmFyTmFtZXMuc2V0KG9wLnhyZWYsIGdldFZhcmlhYmxlTmFtZSh1bml0LCBvcC52YXJpYWJsZSwgc3RhdGUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuaGFuZGxlLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgZW1wdHlWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLmVtcHR5VmlldykhO1xuICAgICAgICAgIC8vIFJlcGVhdGVyIGVtcHR5IHZpZXcgZnVuY3Rpb24gaXMgYXQgc2xvdCArMiAobWV0YWRhdGEgaXMgaW4gdGhlIGZpcnN0IHNsb3QpLlxuICAgICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgICBlbXB0eVZpZXcsIGAke2Jhc2VOYW1lfV8ke29wLmZ1bmN0aW9uTmFtZVN1ZmZpeH1FbXB0eV8ke29wLmhhbmRsZS5zbG90ICsgMn1gLCBzdGF0ZSxcbiAgICAgICAgICAgICAgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVwZWF0ZXIgcHJpbWFyeSB2aWV3IGZ1bmN0aW9uIGlzIGF0IHNsb3QgKzEgKG1ldGFkYXRhIGlzIGluIHRoZSBmaXJzdCBzbG90KS5cbiAgICAgICAgYWRkTmFtZXNUb1ZpZXcoXG4gICAgICAgICAgICB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhLFxuICAgICAgICAgICAgYCR7YmFzZU5hbWV9XyR7b3AuZnVuY3Rpb25OYW1lU3VmZml4fV8ke29wLmhhbmRsZS5zbG90ICsgMX1gLCBzdGF0ZSwgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvamVjdGlvbjpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuaGFuZGxlLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuZmFsbGJhY2tWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgZmFsbGJhY2tWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLmZhbGxiYWNrVmlldykhO1xuICAgICAgICAgIGFkZE5hbWVzVG9WaWV3KFxuICAgICAgICAgICAgICBmYWxsYmFja1ZpZXcsIGAke2Jhc2VOYW1lfV9Qcm9qZWN0aW9uRmFsbGJhY2tfJHtvcC5oYW5kbGUuc2xvdH1gLCBzdGF0ZSxcbiAgICAgICAgICAgICAgY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAob3AuaGFuZGxlLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdWZmaXggPSBvcC5mdW5jdGlvbk5hbWVTdWZmaXgubGVuZ3RoID09PSAwID8gJycgOiBgXyR7b3AuZnVuY3Rpb25OYW1lU3VmZml4fWA7XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KGNoaWxkVmlldywgYCR7YmFzZU5hbWV9JHtzdWZmaXh9XyR7b3AuaGFuZGxlLnNsb3R9YCwgc3RhdGUsIGNvbXBhdGliaWxpdHkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgb3AubmFtZSA9IG5vcm1hbGl6ZVN0eWxlUHJvcE5hbWUob3AubmFtZSk7XG4gICAgICAgIGlmIChjb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgb3AubmFtZSA9IHN0cmlwSW1wb3J0YW50KG9wLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgICAgICBpZiAoY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAgIG9wLm5hbWUgPSBzdHJpcEltcG9ydGFudChvcC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBIYXZpbmcgbmFtZWQgYWxsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdmlldywgbm93IHdlIGNhbiBwdXNoIHRob3NlIG5hbWVzIGludG8gdGhlXG4gIC8vIGBpci5SZWFkVmFyaWFibGVFeHByYCBleHByZXNzaW9ucyB3aGljaCByZXByZXNlbnQgcmVhZHMgb2YgdGhvc2UgdmFyaWFibGVzLlxuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICBpZiAoIShleHByIGluc3RhbmNlb2YgaXIuUmVhZFZhcmlhYmxlRXhwcikgfHwgZXhwci5uYW1lICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdmFyTmFtZXMuaGFzKGV4cHIueHJlZikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWYXJpYWJsZSAke2V4cHIueHJlZn0gbm90IHlldCBuYW1lZGApO1xuICAgICAgfVxuICAgICAgZXhwci5uYW1lID0gdmFyTmFtZXMuZ2V0KGV4cHIueHJlZikhO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhcmlhYmxlTmFtZShcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIHZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9KTogc3RyaW5nIHtcbiAgaWYgKHZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICBzd2l0Y2ggKHZhcmlhYmxlLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dDpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBjdHhfciR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgaWYgKHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpIHtcbiAgICAgICAgICAvLyBUT0RPOiBQcmVmaXggaW5jcmVtZW50IGFuZCBgX3JgIGFyZSBmb3IgY29tcGF0aWJsaXR5IHdpdGggdGhlIG9sZCBuYW1pbmcgc2NoZW1lLlxuICAgICAgICAgIC8vIFRoaXMgaGFzIHRoZSBwb3RlbnRpYWwgdG8gY2F1c2UgY29sbGlzaW9ucyB3aGVuIGBjdHhgIGlzIHRoZSBpZGVudGlmaWVyLCBzbyB3ZSBuZWVkIGFcbiAgICAgICAgICAvLyBzcGVjaWFsIGNoZWNrIGZvciB0aGF0IGFzIHdlbGwuXG4gICAgICAgICAgY29uc3QgY29tcGF0UHJlZml4ID0gdmFyaWFibGUuaWRlbnRpZmllciA9PT0gJ2N0eCcgPyAnaScgOiAnJztcbiAgICAgICAgICB2YXJpYWJsZS5uYW1lID0gYCR7dmFyaWFibGUuaWRlbnRpZmllcn1fJHtjb21wYXRQcmVmaXh9ciR7KytzdGF0ZS5pbmRleH1gO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhcmlhYmxlLm5hbWUgPSBgJHt2YXJpYWJsZS5pZGVudGlmaWVyfV9pJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIFRPRE86IFByZWZpeCBpbmNyZW1lbnQgZm9yIGNvbXBhdGliaWxpdHkgb25seS5cbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBfciR7KytzdGF0ZS5pbmRleH1gO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhcmlhYmxlLm5hbWU7XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIHN0eWxlIHByb3AgbmFtZSBieSBoeXBoZW5hdGluZyBpdCAodW5sZXNzIGl0cyBhIENTUyB2YXJpYWJsZSkuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0eWxlUHJvcE5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgoJy0tJykgPyBuYW1lIDogaHlwaGVuYXRlKG5hbWUpO1xufVxuXG4vKipcbiAqIFN0cmlwcyBgIWltcG9ydGFudGAgb3V0IG9mIHRoZSBnaXZlbiBzdHlsZSBvciBjbGFzcyBuYW1lLlxuICovXG5mdW5jdGlvbiBzdHJpcEltcG9ydGFudChuYW1lOiBzdHJpbmcpIHtcbiAgY29uc3QgaW1wb3J0YW50SW5kZXggPSBuYW1lLmluZGV4T2YoJyFpbXBvcnRhbnQnKTtcbiAgaWYgKGltcG9ydGFudEluZGV4ID4gLTEpIHtcbiAgICByZXR1cm4gbmFtZS5zdWJzdHJpbmcoMCwgaW1wb3J0YW50SW5kZXgpO1xuICB9XG4gIHJldHVybiBuYW1lO1xufVxuIl19