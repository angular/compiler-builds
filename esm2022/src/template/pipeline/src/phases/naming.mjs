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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRWxEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUFtQjtJQUM3QyxjQUFjLENBQ1YsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxFQUFFLEVBQUMsS0FBSyxFQUFFLENBQUMsRUFBQyxFQUN2QyxHQUFHLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzVFLENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FDbkIsSUFBcUIsRUFBRSxRQUFnQixFQUFFLEtBQXNCLEVBQUUsYUFBc0I7SUFDekYsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLGtCQUFrQixDQUFDLEdBQUcsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztLQUN0RTtJQUVELDRGQUE0RjtJQUM1Riw0Q0FBNEM7SUFDNUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFFOUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJ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SSxHQUFHLFFBQVEsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQ3hDLE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVO2dCQUNyQyxRQUFRLENBQUMsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDMUQsTUFBTTtZQUNSO2dCQUNFLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDckMsTUFBTTtTQUNUO0tBQ0Y7SUFDRCxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUM7QUFDdkIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxzQkFBc0IsQ0FBQyxJQUFZO0lBQzFDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxjQUFjLENBQUMsSUFBWTtJQUNsQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2xELElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQyxFQUFFO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7S0FDMUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtoeXBoZW5hdGV9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9zdHlsZV9wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtWaWV3Q29tcGlsYXRpb25Vbml0LCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtwcmVmaXhXaXRoTmFtZXNwYWNlfSBmcm9tICcuLi9jb252ZXJzaW9uJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBuYW1lcyBmb3IgZnVuY3Rpb25zIGFuZCB2YXJpYWJsZXMgYWNyb3NzIGFsbCB2aWV3cy5cbiAqXG4gKiBUaGlzIGluY2x1ZGVzIHByb3BhZ2F0aW5nIHRob3NlIG5hbWVzIGludG8gYW55IGBpci5SZWFkVmFyaWFibGVFeHByYHMgb2YgdGhvc2UgdmFyaWFibGVzLCBzbyB0aGF0XG4gKiB0aGUgcmVhZHMgY2FuIGJlIGVtaXR0ZWQgY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VOYW1pbmcoY3BsOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBhZGROYW1lc1RvVmlldyhcbiAgICAgIGNwbC5yb290LCBjcGwuY29tcG9uZW50TmFtZSwge2luZGV4OiAwfSxcbiAgICAgIGNwbC5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKTtcbn1cblxuZnVuY3Rpb24gYWRkTmFtZXNUb1ZpZXcoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBiYXNlTmFtZTogc3RyaW5nLCBzdGF0ZToge2luZGV4OiBudW1iZXJ9LCBjb21wYXRpYmlsaXR5OiBib29sZWFuKTogdm9pZCB7XG4gIGlmICh1bml0LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgIHVuaXQuZm5OYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGAke2Jhc2VOYW1lfV8ke3VuaXQuam9iLmZuU3VmZml4fWApO1xuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgLy8gaW50byByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMgYWZ0ZXJ3YXJkcy5cbiAgY29uc3QgdmFyTmFtZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICBvcC5uYW1lID0gJ0AnICsgb3AubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICBpZiAob3AuaGFuZGxlckZuTmFtZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3AuaG9zdExpc3RlbmVyICYmIG9wLnRhcmdldFNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc2xvdCB0byBiZSBhc3NpZ25lZGApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBhbmltYXRpb24gPSAnJztcbiAgICAgICAgaWYgKG9wLmlzQW5pbWF0aW9uTGlzdGVuZXIpIHtcbiAgICAgICAgICBvcC5uYW1lID0gYEAke29wLm5hbWV9LiR7b3AuYW5pbWF0aW9uUGhhc2V9YDtcbiAgICAgICAgICBhbmltYXRpb24gPSAnYW5pbWF0aW9uJztcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuaG9zdExpc3RlbmVyKSB7XG4gICAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IGAke2Jhc2VOYW1lfV8ke2FuaW1hdGlvbn0ke29wLm5hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IGAke3VuaXQuZm5OYW1lfV8ke29wLnRhZyEucmVwbGFjZSgnLScsICdfJyl9XyR7YW5pbWF0aW9ufSR7b3AubmFtZX1fJHtcbiAgICAgICAgICAgICAgb3AudGFyZ2V0U2xvdH1fbGlzdGVuZXJgO1xuICAgICAgICB9XG4gICAgICAgIG9wLmhhbmRsZXJGbk5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIob3AuaGFuZGxlckZuTmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIHZhck5hbWVzLnNldChvcC54cmVmLCBnZXRWYXJpYWJsZU5hbWUob3AudmFyaWFibGUsIHN0YXRlKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIGlmICghKHVuaXQgaW5zdGFuY2VvZiBWaWV3Q29tcGlsYXRpb25Vbml0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IG11c3QgYmUgY29tcGlsaW5nIGEgY29tcG9uZW50YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgaWYgKG9wLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHNsb3QgdG8gYmUgYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YWdUb2tlbiA9IG9wLnRhZyA9PT0gbnVsbCA/ICcnIDogJ18nICsgcHJlZml4V2l0aE5hbWVzcGFjZShvcC50YWcsIG9wLm5hbWVzcGFjZSk7XG4gICAgICAgIGFkZE5hbWVzVG9WaWV3KGNoaWxkVmlldywgYCR7YmFzZU5hbWV9JHt0YWdUb2tlbn1fJHtvcC5zbG90fWAsIHN0YXRlLCBjb21wYXRpYmlsaXR5KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgICAgIG9wLm5hbWUgPSBub3JtYWxpemVTdHlsZVByb3BOYW1lKG9wLm5hbWUpO1xuICAgICAgICBpZiAoY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAgIG9wLm5hbWUgPSBzdHJpcEltcG9ydGFudChvcC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgaWYgKGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvcC5uYW1lID0gc3RyaXBJbXBvcnRhbnQob3AubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gSGF2aW5nIG5hbWVkIGFsbCB2YXJpYWJsZXMgZGVjbGFyZWQgaW4gdGhlIHZpZXcsIG5vdyB3ZSBjYW4gcHVzaCB0aG9zZSBuYW1lcyBpbnRvIHRoZVxuICAvLyBgaXIuUmVhZFZhcmlhYmxlRXhwcmAgZXhwcmVzc2lvbnMgd2hpY2ggcmVwcmVzZW50IHJlYWRzIG9mIHRob3NlIHZhcmlhYmxlcy5cbiAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIGlyLlJlYWRWYXJpYWJsZUV4cHIpIHx8IGV4cHIubmFtZSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXZhck5hbWVzLmhhcyhleHByLnhyZWYpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVmFyaWFibGUgJHtleHByLnhyZWZ9IG5vdCB5ZXQgbmFtZWRgKTtcbiAgICAgIH1cbiAgICAgIGV4cHIubmFtZSA9IHZhck5hbWVzLmdldChleHByLnhyZWYpITtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRWYXJpYWJsZU5hbWUodmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGUsIHN0YXRlOiB7aW5kZXg6IG51bWJlcn0pOiBzdHJpbmcge1xuICBpZiAodmFyaWFibGUubmFtZSA9PT0gbnVsbCkge1xuICAgIHN3aXRjaCAodmFyaWFibGUua2luZCkge1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0OlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYGN0eF9yJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICB2YXJpYWJsZS5uYW1lID0gYCR7dmFyaWFibGUuaWRlbnRpZmllcn1fJHtzdGF0ZS5pbmRleCsrfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdmFyaWFibGUubmFtZSA9IGBfciR7c3RhdGUuaW5kZXgrK31gO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhcmlhYmxlLm5hbWU7XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIHN0eWxlIHByb3AgbmFtZSBieSBoeXBoZW5hdGluZyBpdCAodW5sZXNzIGl0cyBhIENTUyB2YXJpYWJsZSkuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0eWxlUHJvcE5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgoJy0tJykgPyBuYW1lIDogaHlwaGVuYXRlKG5hbWUpO1xufVxuXG4vKipcbiAqIFN0cmlwcyBgIWltcG9ydGFudGAgb3V0IG9mIHRoZSBnaXZlbiBzdHlsZSBvciBjbGFzcyBuYW1lLlxuICovXG5mdW5jdGlvbiBzdHJpcEltcG9ydGFudChuYW1lOiBzdHJpbmcpIHtcbiAgY29uc3QgaW1wb3J0YW50SW5kZXggPSBuYW1lLmluZGV4T2YoJyFpbXBvcnRhbnQnKTtcbiAgaWYgKGltcG9ydGFudEluZGV4ID4gLTEpIHtcbiAgICByZXR1cm4gbmFtZS5zdWJzdHJpbmcoMCwgaW1wb3J0YW50SW5kZXgpO1xuICB9XG4gIHJldHVybiBuYW1lO1xufVxuIl19