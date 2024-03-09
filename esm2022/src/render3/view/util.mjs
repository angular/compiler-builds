/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InputFlags } from '../../core';
import { BindingType } from '../../expression_parser/ast';
import { splitNsName } from '../../ml_parser/tags';
import * as o from '../../output/output_ast';
import { CssSelector } from '../../selector';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { isI18nAttribute } from './i18n/util';
/**
 * Checks whether an object key contains potentially unsafe chars, thus the key should be wrapped in
 * quotes. Note: we do not wrap all keys into quotes, as it may have impact on minification and may
 * not work in some cases when object keys are mangled by a minifier.
 *
 * TODO(FW-1136): this is a temporary solution, we need to come up with a better way of working with
 * inputs that contain potentially unsafe chars.
 */
export const UNSAFE_OBJECT_KEY_NAME_REGEXP = /[-.]/;
/** Name of the temporary to use during data binding */
export const TEMPORARY_NAME = '_t';
/** Name of the context parameter passed into a template function */
export const CONTEXT_NAME = 'ctx';
/** Name of the RenderFlag passed into a template function */
export const RENDER_FLAGS = 'rf';
/**
 * Creates an allocator for a temporary variable.
 *
 * A variable declaration is added to the statements the first time the allocator is invoked.
 */
export function temporaryAllocator(pushStatement, name) {
    let temp = null;
    return () => {
        if (!temp) {
            pushStatement(new o.DeclareVarStmt(TEMPORARY_NAME, undefined, o.DYNAMIC_TYPE));
            temp = o.variable(name);
        }
        return temp;
    };
}
export function invalid(arg) {
    throw new Error(`Invalid state: Visitor ${this.constructor.name} doesn't handle ${arg.constructor.name}`);
}
export function asLiteral(value) {
    if (Array.isArray(value)) {
        return o.literalArr(value.map(asLiteral));
    }
    return o.literal(value, o.INFERRED_TYPE);
}
/**
 * Serializes inputs and outputs for `defineDirective` and `defineComponent`.
 *
 * This will attempt to generate optimized data structures to minimize memory or
 * file size of fully compiled applications.
 */
export function conditionallyCreateDirectiveBindingLiteral(map, forInputs) {
    const keys = Object.getOwnPropertyNames(map);
    if (keys.length === 0) {
        return null;
    }
    return o.literalMap(keys.map(key => {
        const value = map[key];
        let declaredName;
        let publicName;
        let minifiedName;
        let expressionValue;
        if (typeof value === 'string') {
            // canonical syntax: `dirProp: publicProp`
            declaredName = key;
            minifiedName = key;
            publicName = value;
            expressionValue = asLiteral(publicName);
        }
        else {
            minifiedName = key;
            declaredName = value.classPropertyName;
            publicName = value.bindingPropertyName;
            const differentDeclaringName = publicName !== declaredName;
            const hasDecoratorInputTransform = value.transformFunction !== null;
            // Build up input flags
            let flags = null;
            if (value.isSignal) {
                flags = bitwiseOrInputFlagsExpr(InputFlags.SignalBased, flags);
            }
            if (hasDecoratorInputTransform) {
                flags = bitwiseOrInputFlagsExpr(InputFlags.HasDecoratorInputTransform, flags);
            }
            // Inputs, compared to outputs, will track their declared name (for `ngOnChanges`), support
            // decorator input transform functions, or store flag information if there is any.
            if (forInputs && (differentDeclaringName || hasDecoratorInputTransform || flags !== null)) {
                const flagsExpr = flags ?? o.importExpr(R3.InputFlags).prop(InputFlags[InputFlags.None]);
                const result = [flagsExpr, asLiteral(publicName)];
                if (differentDeclaringName || hasDecoratorInputTransform) {
                    result.push(asLiteral(declaredName));
                    if (hasDecoratorInputTransform) {
                        result.push(value.transformFunction);
                    }
                }
                expressionValue = o.literalArr(result);
            }
            else {
                expressionValue = asLiteral(publicName);
            }
        }
        return {
            key: minifiedName,
            // put quotes around keys that contain potentially unsafe characters
            quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(minifiedName),
            value: expressionValue,
        };
    }));
}
/** Gets an output AST expression referencing the given flag. */
function getInputFlagExpr(flag) {
    return o.importExpr(R3.InputFlags).prop(InputFlags[flag]);
}
/** Combines a given input flag with an existing flag expression, if present. */
function bitwiseOrInputFlagsExpr(flag, expr) {
    if (expr === null) {
        return getInputFlagExpr(flag);
    }
    return getInputFlagExpr(flag).bitwiseOr(expr);
}
/**
 *  Remove trailing null nodes as they are implied.
 */
export function trimTrailingNulls(parameters) {
    while (o.isNull(parameters[parameters.length - 1])) {
        parameters.pop();
    }
    return parameters;
}
/**
 * A representation for an object literal used during codegen of definition objects. The generic
 * type `T` allows to reference a documented type of the generated structure, such that the
 * property names that are set can be resolved to their documented declaration.
 */
export class DefinitionMap {
    constructor() {
        this.values = [];
    }
    set(key, value) {
        if (value) {
            const existing = this.values.find(value => value.key === key);
            if (existing) {
                existing.value = value;
            }
            else {
                this.values.push({ key: key, value, quoted: false });
            }
        }
    }
    toLiteralMap() {
        return o.literalMap(this.values);
    }
}
/**
 * Creates a `CssSelector` from an AST node.
 */
export function createCssSelectorFromNode(node) {
    const elementName = node instanceof t.Element ? node.name : 'ng-template';
    const attributes = getAttrsForDirectiveMatching(node);
    const cssSelector = new CssSelector();
    const elementNameNoNs = splitNsName(elementName)[1];
    cssSelector.setElement(elementNameNoNs);
    Object.getOwnPropertyNames(attributes).forEach((name) => {
        const nameNoNs = splitNsName(name)[1];
        const value = attributes[name];
        cssSelector.addAttribute(nameNoNs, value);
        if (name.toLowerCase() === 'class') {
            const classes = value.trim().split(/\s+/);
            classes.forEach(className => cssSelector.addClassName(className));
        }
    });
    return cssSelector;
}
/**
 * Extract a map of properties to values for a given element or template node, which can be used
 * by the directive matching machinery.
 *
 * @param elOrTpl the element or template in question
 * @return an object set up for directive matching. For attributes on the element/template, this
 * object maps a property name to its (static) value. For any bindings, this map simply maps the
 * property name to an empty string.
 */
function getAttrsForDirectiveMatching(elOrTpl) {
    const attributesMap = {};
    if (elOrTpl instanceof t.Template && elOrTpl.tagName !== 'ng-template') {
        elOrTpl.templateAttrs.forEach(a => attributesMap[a.name] = '');
    }
    else {
        elOrTpl.attributes.forEach(a => {
            if (!isI18nAttribute(a.name)) {
                attributesMap[a.name] = a.value;
            }
        });
        elOrTpl.inputs.forEach(i => {
            if (i.type === BindingType.Property || i.type === BindingType.TwoWay) {
                attributesMap[i.name] = '';
            }
        });
        elOrTpl.outputs.forEach(o => {
            attributesMap[o.name] = '';
        });
    }
    return attributesMap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3RDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDakQsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDM0MsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBRTVDOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FBRyxNQUFNLENBQUM7QUFFcEQsdURBQXVEO0FBQ3ZELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7QUFFbkMsb0VBQW9FO0FBQ3BFLE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7QUFFbEMsNkRBQTZEO0FBQzdELE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFFakM7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxhQUF3QyxFQUFFLElBQVk7SUFFdkYsSUFBSSxJQUFJLEdBQXVCLElBQUksQ0FBQztJQUNwQyxPQUFPLEdBQUcsRUFBRTtRQUNWLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNWLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxjQUFjLENB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QyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7U0FBTSxDQUFDO1FBQ04sT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDN0IsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ2xDLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3pCLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNyRSxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUM3QixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMxQixhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SW5wdXRGbGFnc30gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0JpbmRpbmdUeXBlfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7aXNJMThuQXR0cmlidXRlfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgYW4gb2JqZWN0IGtleSBjb250YWlucyBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcnMsIHRodXMgdGhlIGtleSBzaG91bGQgYmUgd3JhcHBlZCBpblxuICogcXVvdGVzLiBOb3RlOiB3ZSBkbyBub3Qgd3JhcCBhbGwga2V5cyBpbnRvIHF1b3RlcywgYXMgaXQgbWF5IGhhdmUgaW1wYWN0IG9uIG1pbmlmaWNhdGlvbiBhbmQgbWF5XG4gKiBub3Qgd29yayBpbiBzb21lIGNhc2VzIHdoZW4gb2JqZWN0IGtleXMgYXJlIG1hbmdsZWQgYnkgYSBtaW5pZmllci5cbiAqXG4gKiBUT0RPKEZXLTExMzYpOiB0aGlzIGlzIGEgdGVtcG9yYXJ5IHNvbHV0aW9uLCB3ZSBuZWVkIHRvIGNvbWUgdXAgd2l0aCBhIGJldHRlciB3YXkgb2Ygd29ya2luZyB3aXRoXG4gKiBpbnB1dHMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFycy5cbiAqL1xuZXhwb3J0IGNvbnN0IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQID0gL1stLl0vO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFsbG9jYXRvciBmb3IgYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gKlxuICogQSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBpcyBhZGRlZCB0byB0aGUgc3RhdGVtZW50cyB0aGUgZmlyc3QgdGltZSB0aGUgYWxsb2NhdG9yIGlzIGludm9rZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wb3JhcnlBbGxvY2F0b3IocHVzaFN0YXRlbWVudDogKHN0OiBvLlN0YXRlbWVudCkgPT4gdm9pZCwgbmFtZTogc3RyaW5nKTogKCkgPT5cbiAgICBvLlJlYWRWYXJFeHByIHtcbiAgbGV0IHRlbXA6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICBwdXNoU3RhdGVtZW50KG5ldyBvLkRlY2xhcmVWYXJTdG10KFRFTVBPUkFSWV9OQU1FLCB1bmRlZmluZWQsIG8uRFlOQU1JQ19UWVBFKSk7XG4gICAgICB0ZW1wID0gby52YXJpYWJsZShuYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXA7XG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGludmFsaWQ8VD4odGhpczogdC5WaXNpdG9yLCBhcmc6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudHx0Lk5vZGUpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIHN0YXRlOiBWaXNpdG9yICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IGhhbmRsZSAke2FyZy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNMaXRlcmFsKHZhbHVlOiBhbnkpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlLm1hcChhc0xpdGVyYWwpKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsKHZhbHVlLCBvLklORkVSUkVEX1RZUEUpO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgaW5wdXRzIGFuZCBvdXRwdXRzIGZvciBgZGVmaW5lRGlyZWN0aXZlYCBhbmQgYGRlZmluZUNvbXBvbmVudGAuXG4gKlxuICogVGhpcyB3aWxsIGF0dGVtcHQgdG8gZ2VuZXJhdGUgb3B0aW1pemVkIGRhdGEgc3RydWN0dXJlcyB0byBtaW5pbWl6ZSBtZW1vcnkgb3JcbiAqIGZpbGUgc2l6ZSBvZiBmdWxseSBjb21waWxlZCBhcHBsaWNhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwoXG4gICAgbWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmd8e1xuICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgICAgIGJpbmRpbmdQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBvLkV4cHJlc3Npb258bnVsbDtcbiAgICAgIGlzU2lnbmFsOiBib29sZWFuLFxuICAgIH0+LCBmb3JJbnB1dHM/OiBib29sZWFuKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWFwKTtcblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBvLmxpdGVyYWxNYXAoa2V5cy5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG1hcFtrZXldO1xuICAgIGxldCBkZWNsYXJlZE5hbWU6IHN0cmluZztcbiAgICBsZXQgcHVibGljTmFtZTogc3RyaW5nO1xuICAgIGxldCBtaW5pZmllZE5hbWU6IHN0cmluZztcbiAgICBsZXQgZXhwcmVzc2lvblZhbHVlOiBvLkV4cHJlc3Npb247XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gY2Fub25pY2FsIHN5bnRheDogYGRpclByb3A6IHB1YmxpY1Byb3BgXG4gICAgICBkZWNsYXJlZE5hbWUgPSBrZXk7XG4gICAgICBtaW5pZmllZE5hbWUgPSBrZXk7XG4gICAgICBwdWJsaWNOYW1lID0gdmFsdWU7XG4gICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbmlmaWVkTmFtZSA9IGtleTtcbiAgICAgIGRlY2xhcmVkTmFtZSA9IHZhbHVlLmNsYXNzUHJvcGVydHlOYW1lO1xuICAgICAgcHVibGljTmFtZSA9IHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWU7XG5cbiAgICAgIGNvbnN0IGRpZmZlcmVudERlY2xhcmluZ05hbWUgPSBwdWJsaWNOYW1lICE9PSBkZWNsYXJlZE5hbWU7XG4gICAgICBjb25zdCBoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSA9IHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsO1xuXG4gICAgICAvLyBCdWlsZCB1cCBpbnB1dCBmbGFnc1xuICAgICAgbGV0IGZsYWdzOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgICBpZiAodmFsdWUuaXNTaWduYWwpIHtcbiAgICAgICAgZmxhZ3MgPSBiaXR3aXNlT3JJbnB1dEZsYWdzRXhwcihJbnB1dEZsYWdzLlNpZ25hbEJhc2VkLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBpZiAoaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgZmxhZ3MgPSBiaXR3aXNlT3JJbnB1dEZsYWdzRXhwcihJbnB1dEZsYWdzLkhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIElucHV0cywgY29tcGFyZWQgdG8gb3V0cHV0cywgd2lsbCB0cmFjayB0aGVpciBkZWNsYXJlZCBuYW1lIChmb3IgYG5nT25DaGFuZ2VzYCksIHN1cHBvcnRcbiAgICAgIC8vIGRlY29yYXRvciBpbnB1dCB0cmFuc2Zvcm0gZnVuY3Rpb25zLCBvciBzdG9yZSBmbGFnIGluZm9ybWF0aW9uIGlmIHRoZXJlIGlzIGFueS5cbiAgICAgIGlmIChmb3JJbnB1dHMgJiYgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0gfHwgZmxhZ3MgIT09IG51bGwpKSB7XG4gICAgICAgIGNvbnN0IGZsYWdzRXhwciA9IGZsYWdzID8/IG8uaW1wb3J0RXhwcihSMy5JbnB1dEZsYWdzKS5wcm9wKElucHV0RmxhZ3NbSW5wdXRGbGFncy5Ob25lXSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogby5FeHByZXNzaW9uW10gPSBbZmxhZ3NFeHByLCBhc0xpdGVyYWwocHVibGljTmFtZSldO1xuXG4gICAgICAgIGlmIChkaWZmZXJlbnREZWNsYXJpbmdOYW1lIHx8IGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goYXNMaXRlcmFsKGRlY2xhcmVkTmFtZSkpO1xuXG4gICAgICAgICAgaWYgKGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IG8ubGl0ZXJhbEFycihyZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhwcmVzc2lvblZhbHVlID0gYXNMaXRlcmFsKHB1YmxpY05hbWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBrZXk6IG1pbmlmaWVkTmFtZSxcbiAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICBxdW90ZWQ6IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQLnRlc3QobWluaWZpZWROYW1lKSxcbiAgICAgIHZhbHVlOiBleHByZXNzaW9uVmFsdWUsXG4gICAgfTtcbiAgfSkpO1xufVxuXG4vKiogR2V0cyBhbiBvdXRwdXQgQVNUIGV4cHJlc3Npb24gcmVmZXJlbmNpbmcgdGhlIGdpdmVuIGZsYWcuICovXG5mdW5jdGlvbiBnZXRJbnB1dEZsYWdFeHByKGZsYWc6IElucHV0RmxhZ3MpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLklucHV0RmxhZ3MpLnByb3AoSW5wdXRGbGFnc1tmbGFnXSk7XG59XG5cbi8qKiBDb21iaW5lcyBhIGdpdmVuIGlucHV0IGZsYWcgd2l0aCBhbiBleGlzdGluZyBmbGFnIGV4cHJlc3Npb24sIGlmIHByZXNlbnQuICovXG5mdW5jdGlvbiBiaXR3aXNlT3JJbnB1dEZsYWdzRXhwcihmbGFnOiBJbnB1dEZsYWdzLCBleHByOiBvLkV4cHJlc3Npb258bnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChleHByID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGdldElucHV0RmxhZ0V4cHIoZmxhZyk7XG4gIH1cbiAgcmV0dXJuIGdldElucHV0RmxhZ0V4cHIoZmxhZykuYml0d2lzZU9yKGV4cHIpO1xufVxuXG4vKipcbiAqICBSZW1vdmUgdHJhaWxpbmcgbnVsbCBub2RlcyBhcyB0aGV5IGFyZSBpbXBsaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHdoaWxlIChvLmlzTnVsbChwYXJhbWV0ZXJzW3BhcmFtZXRlcnMubGVuZ3RoIC0gMV0pKSB7XG4gICAgcGFyYW1ldGVycy5wb3AoKTtcbiAgfVxuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuLyoqXG4gKiBBIHJlcHJlc2VudGF0aW9uIGZvciBhbiBvYmplY3QgbGl0ZXJhbCB1c2VkIGR1cmluZyBjb2RlZ2VuIG9mIGRlZmluaXRpb24gb2JqZWN0cy4gVGhlIGdlbmVyaWNcbiAqIHR5cGUgYFRgIGFsbG93cyB0byByZWZlcmVuY2UgYSBkb2N1bWVudGVkIHR5cGUgb2YgdGhlIGdlbmVyYXRlZCBzdHJ1Y3R1cmUsIHN1Y2ggdGhhdCB0aGVcbiAqIHByb3BlcnR5IG5hbWVzIHRoYXQgYXJlIHNldCBjYW4gYmUgcmVzb2x2ZWQgdG8gdGhlaXIgZG9jdW1lbnRlZCBkZWNsYXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXA8VCA9IGFueT4ge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleToga2V5b2YgVCwgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudmFsdWVzLmZpbmQodmFsdWUgPT4gdmFsdWUua2V5ID09PSBrZXkpO1xuXG4gICAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgICAgZXhpc3RpbmcudmFsdWUgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudmFsdWVzLnB1c2goe2tleToga2V5IGFzIHN0cmluZywgdmFsdWUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0b0xpdGVyYWxNYXAoKTogby5MaXRlcmFsTWFwRXhwciB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcCh0aGlzLnZhbHVlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBmcm9tIGFuIEFTVCBub2RlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3JGcm9tTm9kZShub2RlOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IENzc1NlbGVjdG9yIHtcbiAgY29uc3QgZWxlbWVudE5hbWUgPSBub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50ID8gbm9kZS5uYW1lIDogJ25nLXRlbXBsYXRlJztcbiAgY29uc3QgYXR0cmlidXRlcyA9IGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcobm9kZSk7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsZW1lbnROYW1lTm9OcyA9IHNwbGl0TnNOYW1lKGVsZW1lbnROYW1lKVsxXTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KGVsZW1lbnROYW1lTm9Ocyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IG5hbWVOb05zID0gc3BsaXROc05hbWUobmFtZSlbMV07XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWVOb05zLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8qKlxuICogRXh0cmFjdCBhIG1hcCBvZiBwcm9wZXJ0aWVzIHRvIHZhbHVlcyBmb3IgYSBnaXZlbiBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUsIHdoaWNoIGNhbiBiZSB1c2VkXG4gKiBieSB0aGUgZGlyZWN0aXZlIG1hdGNoaW5nIG1hY2hpbmVyeS5cbiAqXG4gKiBAcGFyYW0gZWxPclRwbCB0aGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBpbiBxdWVzdGlvblxuICogQHJldHVybiBhbiBvYmplY3Qgc2V0IHVwIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuIEZvciBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50L3RlbXBsYXRlLCB0aGlzXG4gKiBvYmplY3QgbWFwcyBhIHByb3BlcnR5IG5hbWUgdG8gaXRzIChzdGF0aWMpIHZhbHVlLiBGb3IgYW55IGJpbmRpbmdzLCB0aGlzIG1hcCBzaW1wbHkgbWFwcyB0aGVcbiAqIHByb3BlcnR5IG5hbWUgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGw6IHQuRWxlbWVudHx0LlRlbXBsYXRlKToge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9IHtcbiAgY29uc3QgYXR0cmlidXRlc01hcDoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cblxuICBpZiAoZWxPclRwbCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgZWxPclRwbC50YWdOYW1lICE9PSAnbmctdGVtcGxhdGUnKSB7XG4gICAgZWxPclRwbC50ZW1wbGF0ZUF0dHJzLmZvckVhY2goYSA9PiBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSAnJyk7XG4gIH0gZWxzZSB7XG4gICAgZWxPclRwbC5hdHRyaWJ1dGVzLmZvckVhY2goYSA9PiB7XG4gICAgICBpZiAoIWlzSTE4bkF0dHJpYnV0ZShhLm5hbWUpKSB7XG4gICAgICAgIGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBlbE9yVHBsLmlucHV0cy5mb3JFYWNoKGkgPT4ge1xuICAgICAgaWYgKGkudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgfHwgaS50eXBlID09PSBCaW5kaW5nVHlwZS5Ud29XYXkpIHtcbiAgICAgICAgYXR0cmlidXRlc01hcFtpLm5hbWVdID0gJyc7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7XG4gICAgICBhdHRyaWJ1dGVzTWFwW28ubmFtZV0gPSAnJztcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBhdHRyaWJ1dGVzTWFwO1xufVxuIl19