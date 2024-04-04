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
            let flags = InputFlags.None;
            // Build up input flags
            if (value.isSignal) {
                flags |= InputFlags.SignalBased;
            }
            if (hasDecoratorInputTransform) {
                flags |= InputFlags.HasDecoratorInputTransform;
            }
            // Inputs, compared to outputs, will track their declared name (for `ngOnChanges`), support
            // decorator input transform functions, or store flag information if there is any.
            if (forInputs &&
                (differentDeclaringName || hasDecoratorInputTransform || flags !== InputFlags.None)) {
                const result = [o.literal(flags), asLiteral(publicName)];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3RDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDakQsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDM0MsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFFL0IsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUU1Qzs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQUcsTUFBTSxDQUFDO0FBRXBELHVEQUF1RDtBQUN2RCxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDO0FBRW5DLG9FQUFvRTtBQUNwRSxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBRWxDLDZEQUE2RDtBQUM3RCxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0FBRWpDOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsYUFBd0MsRUFBRSxJQUFZO0lBRXZGLElBQUksSUFBSSxHQUF1QixJQUFJLENBQUM7SUFDcEMsT0FBTyxHQUFHLEVBQUU7UUFDVixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDVixhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7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IExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJbnB1dEZsYWdzfSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QmluZGluZ1R5cGV9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcblxuaW1wb3J0IHtpc0kxOG5BdHRyaWJ1dGV9IGZyb20gJy4vaTE4bi91dGlsJztcblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhbiBvYmplY3Qga2V5IGNvbnRhaW5zIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFycywgdGh1cyB0aGUga2V5IHNob3VsZCBiZSB3cmFwcGVkIGluXG4gKiBxdW90ZXMuIE5vdGU6IHdlIGRvIG5vdCB3cmFwIGFsbCBrZXlzIGludG8gcXVvdGVzLCBhcyBpdCBtYXkgaGF2ZSBpbXBhY3Qgb24gbWluaWZpY2F0aW9uIGFuZCBtYXlcbiAqIG5vdCB3b3JrIGluIHNvbWUgY2FzZXMgd2hlbiBvYmplY3Qga2V5cyBhcmUgbWFuZ2xlZCBieSBhIG1pbmlmaWVyLlxuICpcbiAqIFRPRE8oRlctMTEzNik6IHRoaXMgaXMgYSB0ZW1wb3Jhcnkgc29sdXRpb24sIHdlIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIHdheSBvZiB3b3JraW5nIHdpdGhcbiAqIGlucHV0cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLlxuICovXG5leHBvcnQgY29uc3QgVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAgPSAvWy0uXS87XG5cbi8qKiBOYW1lIG9mIHRoZSB0ZW1wb3JhcnkgdG8gdXNlIGR1cmluZyBkYXRhIGJpbmRpbmcgKi9cbmV4cG9ydCBjb25zdCBURU1QT1JBUllfTkFNRSA9ICdfdCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBjb250ZXh0IHBhcmFtZXRlciBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgQ09OVEVYVF9OQU1FID0gJ2N0eCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBSZW5kZXJGbGFnIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJfRkxBR1MgPSAncmYnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWxsb2NhdG9yIGZvciBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAqXG4gKiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGlzIGFkZGVkIHRvIHRoZSBzdGF0ZW1lbnRzIHRoZSBmaXJzdCB0aW1lIHRoZSBhbGxvY2F0b3IgaXMgaW52b2tlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeUFsbG9jYXRvcihwdXNoU3RhdGVtZW50OiAoc3Q6IG8uU3RhdGVtZW50KSA9PiB2b2lkLCBuYW1lOiBzdHJpbmcpOiAoKSA9PlxuICAgIG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHB1c2hTdGF0ZW1lbnQobmV3IG8uRGVjbGFyZVZhclN0bXQoVEVNUE9SQVJZX05BTUUsIHVuZGVmaW5lZCwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIHRlbXAgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcDtcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gaW52YWxpZDxUPih0aGlzOiB0LlZpc2l0b3IsIGFyZzogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50fHQuTm9kZSk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgc3RhdGU6IFZpc2l0b3IgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGRvZXNuJ3QgaGFuZGxlICR7YXJnLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0xpdGVyYWwodmFsdWU6IGFueSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIodmFsdWUubWFwKGFzTGl0ZXJhbCkpO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWwodmFsdWUsIG8uSU5GRVJSRURfVFlQRSk7XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBpbnB1dHMgYW5kIG91dHB1dHMgZm9yIGBkZWZpbmVEaXJlY3RpdmVgIGFuZCBgZGVmaW5lQ29tcG9uZW50YC5cbiAqXG4gKiBUaGlzIHdpbGwgYXR0ZW1wdCB0byBnZW5lcmF0ZSBvcHRpbWl6ZWQgZGF0YSBzdHJ1Y3R1cmVzIHRvIG1pbmltaXplIG1lbW9yeSBvclxuICogZmlsZSBzaXplIG9mIGZ1bGx5IGNvbXBpbGVkIGFwcGxpY2F0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChcbiAgICBtYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ3x7XG4gICAgICBjbGFzc1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgdHJhbnNmb3JtRnVuY3Rpb246IG8uRXhwcmVzc2lvbnxudWxsO1xuICAgICAgaXNTaWduYWw6IGJvb2xlYW4sXG4gICAgfT4sIGZvcklucHV0cz86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtYXApO1xuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gbWFwW2tleV07XG4gICAgbGV0IGRlY2xhcmVkTmFtZTogc3RyaW5nO1xuICAgIGxldCBwdWJsaWNOYW1lOiBzdHJpbmc7XG4gICAgbGV0IG1pbmlmaWVkTmFtZTogc3RyaW5nO1xuICAgIGxldCBleHByZXNzaW9uVmFsdWU6IG8uRXhwcmVzc2lvbjtcblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBjYW5vbmljYWwgc3ludGF4OiBgZGlyUHJvcDogcHVibGljUHJvcGBcbiAgICAgIGRlY2xhcmVkTmFtZSA9IGtleTtcbiAgICAgIG1pbmlmaWVkTmFtZSA9IGtleTtcbiAgICAgIHB1YmxpY05hbWUgPSB2YWx1ZTtcbiAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWluaWZpZWROYW1lID0ga2V5O1xuICAgICAgZGVjbGFyZWROYW1lID0gdmFsdWUuY2xhc3NQcm9wZXJ0eU5hbWU7XG4gICAgICBwdWJsaWNOYW1lID0gdmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZTtcblxuICAgICAgY29uc3QgZGlmZmVyZW50RGVjbGFyaW5nTmFtZSA9IHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZTtcbiAgICAgIGNvbnN0IGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtID0gdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGw7XG4gICAgICBsZXQgZmxhZ3MgPSBJbnB1dEZsYWdzLk5vbmU7XG5cbiAgICAgIC8vIEJ1aWxkIHVwIGlucHV0IGZsYWdzXG4gICAgICBpZiAodmFsdWUuaXNTaWduYWwpIHtcbiAgICAgICAgZmxhZ3MgfD0gSW5wdXRGbGFncy5TaWduYWxCYXNlZDtcbiAgICAgIH1cbiAgICAgIGlmIChoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSkge1xuICAgICAgICBmbGFncyB8PSBJbnB1dEZsYWdzLkhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtO1xuICAgICAgfVxuXG4gICAgICAvLyBJbnB1dHMsIGNvbXBhcmVkIHRvIG91dHB1dHMsIHdpbGwgdHJhY2sgdGhlaXIgZGVjbGFyZWQgbmFtZSAoZm9yIGBuZ09uQ2hhbmdlc2ApLCBzdXBwb3J0XG4gICAgICAvLyBkZWNvcmF0b3IgaW5wdXQgdHJhbnNmb3JtIGZ1bmN0aW9ucywgb3Igc3RvcmUgZmxhZyBpbmZvcm1hdGlvbiBpZiB0aGVyZSBpcyBhbnkuXG4gICAgICBpZiAoZm9ySW5wdXRzICYmXG4gICAgICAgICAgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0gfHwgZmxhZ3MgIT09IElucHV0RmxhZ3MuTm9uZSkpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gW28ubGl0ZXJhbChmbGFncyksIGFzTGl0ZXJhbChwdWJsaWNOYW1lKV07XG5cbiAgICAgICAgaWYgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgICByZXN1bHQucHVzaChhc0xpdGVyYWwoZGVjbGFyZWROYW1lKSk7XG5cbiAgICAgICAgICBpZiAoaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uISk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZXhwcmVzc2lvblZhbHVlID0gby5saXRlcmFsQXJyKHJlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogbWluaWZpZWROYW1lLFxuICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChtaW5pZmllZE5hbWUpLFxuICAgICAgdmFsdWU6IGV4cHJlc3Npb25WYWx1ZSxcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKlxuICogQSByZXByZXNlbnRhdGlvbiBmb3IgYW4gb2JqZWN0IGxpdGVyYWwgdXNlZCBkdXJpbmcgY29kZWdlbiBvZiBkZWZpbml0aW9uIG9iamVjdHMuIFRoZSBnZW5lcmljXG4gKiB0eXBlIGBUYCBhbGxvd3MgdG8gcmVmZXJlbmNlIGEgZG9jdW1lbnRlZCB0eXBlIG9mIHRoZSBnZW5lcmF0ZWQgc3RydWN0dXJlLCBzdWNoIHRoYXQgdGhlXG4gKiBwcm9wZXJ0eSBuYW1lcyB0aGF0IGFyZSBzZXQgY2FuIGJlIHJlc29sdmVkIHRvIHRoZWlyIGRvY3VtZW50ZWQgZGVjbGFyYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWZpbml0aW9uTWFwPFQgPSBhbnk+IHtcbiAgdmFsdWVzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbiwgdmFsdWU6IG8uRXhwcmVzc2lvbn1bXSA9IFtdO1xuXG4gIHNldChrZXk6IGtleW9mIFQsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnZhbHVlcy5maW5kKHZhbHVlID0+IHZhbHVlLmtleSA9PT0ga2V5KTtcblxuICAgICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICAgIGV4aXN0aW5nLnZhbHVlID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnZhbHVlcy5wdXNoKHtrZXk6IGtleSBhcyBzdHJpbmcsIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdG9MaXRlcmFsTWFwKCk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICAgIHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZnJvbSBhbiBBU1Qgbm9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yRnJvbU5vZGUobm9kZTogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGVsZW1lbnROYW1lID0gbm9kZSBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IG5vZGUubmFtZSA6ICduZy10ZW1wbGF0ZSc7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKG5vZGUpO1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICBjb25zdCBlbGVtZW50TmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbGVtZW50TmFtZU5vTnMpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCBuYW1lTm9OcyA9IHNwbGl0TnNOYW1lKG5hbWUpWzFdO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lTm9OcywgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgYSBtYXAgb2YgcHJvcGVydGllcyB0byB2YWx1ZXMgZm9yIGEgZ2l2ZW4gZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLCB3aGljaCBjYW4gYmUgdXNlZFxuICogYnkgdGhlIGRpcmVjdGl2ZSBtYXRjaGluZyBtYWNoaW5lcnkuXG4gKlxuICogQHBhcmFtIGVsT3JUcGwgdGhlIGVsZW1lbnQgb3IgdGVtcGxhdGUgaW4gcXVlc3Rpb25cbiAqIEByZXR1cm4gYW4gb2JqZWN0IHNldCB1cCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nLiBGb3IgYXR0cmlidXRlcyBvbiB0aGUgZWxlbWVudC90ZW1wbGF0ZSwgdGhpc1xuICogb2JqZWN0IG1hcHMgYSBwcm9wZXJ0eSBuYW1lIHRvIGl0cyAoc3RhdGljKSB2YWx1ZS4gRm9yIGFueSBiaW5kaW5ncywgdGhpcyBtYXAgc2ltcGx5IG1hcHMgdGhlXG4gKiBwcm9wZXJ0eSBuYW1lIHRvIGFuIGVtcHR5IHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSB7XG4gIGNvbnN0IGF0dHJpYnV0ZXNNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG5cbiAgaWYgKGVsT3JUcGwgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGVsT3JUcGwudGFnTmFtZSAhPT0gJ25nLXRlbXBsYXRlJykge1xuICAgIGVsT3JUcGwudGVtcGxhdGVBdHRycy5mb3JFYWNoKGEgPT4gYXR0cmlidXRlc01hcFthLm5hbWVdID0gJycpO1xuICB9IGVsc2Uge1xuICAgIGVsT3JUcGwuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgaWYgKCFpc0kxOG5BdHRyaWJ1dGUoYS5uYW1lKSkge1xuICAgICAgICBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZWxPclRwbC5pbnB1dHMuZm9yRWFjaChpID0+IHtcbiAgICAgIGlmIChpLnR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5IHx8IGkudHlwZSA9PT0gQmluZGluZ1R5cGUuVHdvV2F5KSB7XG4gICAgICAgIGF0dHJpYnV0ZXNNYXBbaS5uYW1lXSA9ICcnO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGVsT3JUcGwub3V0cHV0cy5mb3JFYWNoKG8gPT4ge1xuICAgICAgYXR0cmlidXRlc01hcFtvLm5hbWVdID0gJyc7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gYXR0cmlidXRlc01hcDtcbn1cbiJdfQ==