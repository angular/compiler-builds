/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import * as o from '../../output/output_ast';
import { splitAtColon } from '../../util';
import { isI18nAttribute } from './i18n/util';
/**
 * Checks whether an object key contains potentially unsafe chars, thus the key should be wrapped in
 * quotes. Note: we do not wrap all keys into quotes, as it may have impact on minification and may
 * bot work in some cases when object keys are mangled by minifier.
 *
 * TODO(FW-1136): this is a temporary solution, we need to come up with a better way of working with
 * inputs that contain potentially unsafe chars.
 */
var UNSAFE_OBJECT_KEY_NAME_REGEXP = /-/;
/** Name of the temporary to use during data binding */
export var TEMPORARY_NAME = '_t';
/** Name of the context parameter passed into a template function */
export var CONTEXT_NAME = 'ctx';
/** Name of the RenderFlag passed into a template function */
export var RENDER_FLAGS = 'rf';
/** The prefix reference variables */
export var REFERENCE_PREFIX = '_r';
/** The name of the implicit context reference */
export var IMPLICIT_REFERENCE = '$implicit';
/** Non bindable attribute name **/
export var NON_BINDABLE_ATTR = 'ngNonBindable';
/**
 * Creates an allocator for a temporary variable.
 *
 * A variable declaration is added to the statements the first time the allocator is invoked.
 */
export function temporaryAllocator(statements, name) {
    var temp = null;
    return function () {
        if (!temp) {
            statements.push(new o.DeclareVarStmt(TEMPORARY_NAME, undefined, o.DYNAMIC_TYPE));
            temp = o.variable(name);
        }
        return temp;
    };
}
export function unsupported(feature) {
    if (this) {
        throw new Error("Builder " + this.constructor.name + " doesn't support " + feature + " yet");
    }
    throw new Error("Feature " + feature + " is not supported yet");
}
export function invalid(arg) {
    throw new Error("Invalid state: Visitor " + this.constructor.name + " doesn't handle " + arg.constructor.name);
}
export function asLiteral(value) {
    if (Array.isArray(value)) {
        return o.literalArr(value.map(asLiteral));
    }
    return o.literal(value, o.INFERRED_TYPE);
}
export function conditionallyCreateMapObjectLiteral(keys, keepDeclared) {
    if (Object.getOwnPropertyNames(keys).length > 0) {
        return mapToExpression(keys, keepDeclared);
    }
    return null;
}
function mapToExpression(map, keepDeclared) {
    return o.literalMap(Object.getOwnPropertyNames(map).map(function (key) {
        var _a, _b;
        // canonical syntax: `dirProp: publicProp`
        // if there is no `:`, use dirProp = elProp
        var value = map[key];
        var declaredName;
        var publicName;
        var minifiedName;
        if (Array.isArray(value)) {
            _a = tslib_1.__read(value, 2), publicName = _a[0], declaredName = _a[1];
        }
        else {
            _b = tslib_1.__read(splitAtColon(key, [key, value]), 2), declaredName = _b[0], publicName = _b[1];
        }
        minifiedName = declaredName;
        return {
            key: minifiedName,
            // put quotes around keys that contain potentially unsafe characters
            quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(minifiedName),
            value: (keepDeclared && publicName !== declaredName) ?
                o.literalArr([asLiteral(publicName), asLiteral(declaredName)]) :
                asLiteral(publicName)
        };
    }));
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
export function getQueryPredicate(query, constantPool) {
    if (Array.isArray(query.predicate)) {
        var predicate_1 = [];
        query.predicate.forEach(function (selector) {
            // Each item in predicates array may contain strings with comma-separated refs
            // (for ex. 'ref, ref1, ..., refN'), thus we extract individual refs and store them
            // as separate array entities
            var selectors = selector.split(',').map(function (token) { return o.literal(token.trim()); });
            predicate_1.push.apply(predicate_1, tslib_1.__spread(selectors));
        });
        return constantPool.getConstLiteral(o.literalArr(predicate_1), true);
    }
    else {
        return query.predicate;
    }
}
export function noop() { }
var DefinitionMap = /** @class */ (function () {
    function DefinitionMap() {
        this.values = [];
    }
    DefinitionMap.prototype.set = function (key, value) {
        if (value) {
            this.values.push({ key: key, value: value, quoted: false });
        }
    };
    DefinitionMap.prototype.toLiteralMap = function () { return o.literalMap(this.values); };
    return DefinitionMap;
}());
export { DefinitionMap };
/**
 * Extract a map of properties to values for a given element or template node, which can be used
 * by the directive matching machinery.
 *
 * @param elOrTpl the element or template in question
 * @return an object set up for directive matching. For attributes on the element/template, this
 * object maps a property name to its (static) value. For any bindings, this map simply maps the
 * property name to an empty string.
 */
export function getAttrsForDirectiveMatching(elOrTpl) {
    var attributesMap = {};
    elOrTpl.attributes.forEach(function (a) {
        if (!isI18nAttribute(a.name)) {
            attributesMap[a.name] = a.value;
        }
    });
    elOrTpl.inputs.forEach(function (i) { attributesMap[i.name] = ''; });
    elOrTpl.outputs.forEach(function (o) { attributesMap[o.name] = ''; });
    return attributesMap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBR0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBR3hDLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFFNUM7Ozs7Ozs7R0FPRztBQUNILElBQU0sNkJBQTZCLEdBQUcsR0FBRyxDQUFDO0FBRTFDLHVEQUF1RDtBQUN2RCxNQUFNLENBQUMsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDO0FBRW5DLG9FQUFvRTtBQUNwRSxNQUFNLENBQUMsSUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBRWxDLDZEQUE2RDtBQUM3RCxNQUFNLENBQUMsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0FBRWpDLHFDQUFxQztBQUNyQyxNQUFNLENBQUMsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7QUFFckMsaURBQWlEO0FBQ2pELE1BQU0sQ0FBQyxJQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQztBQUU5QyxtQ0FBbUM7QUFDbkMsTUFBTSxDQUFDLElBQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFDO0FBRWpEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsVUFBeUIsRUFBRSxJQUFZO0lBQ3hFLElBQUksSUFBSSxHQUF1QixJQUFJLENBQUM7SUFDcEMsT0FBTztRQUNMLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDVCxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lB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Q0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsb0JBQUM7QUFBRCxDQUFDLEFBVkQsSUFVQzs7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxPQUErQjtJQUUxRSxJQUFNLGFBQWEsR0FBNkIsRUFBRSxDQUFDO0lBRW5ELE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztRQUMxQixJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM1QixhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7U0FDakM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFNLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQU0sYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU5RCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7c3BsaXRBdENvbG9ufSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2lzSTE4bkF0dHJpYnV0ZX0gZnJvbSAnLi9pMThuL3V0aWwnO1xuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIGFuIG9iamVjdCBrZXkgY29udGFpbnMgcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLCB0aHVzIHRoZSBrZXkgc2hvdWxkIGJlIHdyYXBwZWQgaW5cbiAqIHF1b3Rlcy4gTm90ZTogd2UgZG8gbm90IHdyYXAgYWxsIGtleXMgaW50byBxdW90ZXMsIGFzIGl0IG1heSBoYXZlIGltcGFjdCBvbiBtaW5pZmljYXRpb24gYW5kIG1heVxuICogYm90IHdvcmsgaW4gc29tZSBjYXNlcyB3aGVuIG9iamVjdCBrZXlzIGFyZSBtYW5nbGVkIGJ5IG1pbmlmaWVyLlxuICpcbiAqIFRPRE8oRlctMTEzNik6IHRoaXMgaXMgYSB0ZW1wb3Jhcnkgc29sdXRpb24sIHdlIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIHdheSBvZiB3b3JraW5nIHdpdGhcbiAqIGlucHV0cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLlxuICovXG5jb25zdCBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUCA9IC8tLztcblxuLyoqIE5hbWUgb2YgdGhlIHRlbXBvcmFyeSB0byB1c2UgZHVyaW5nIGRhdGEgYmluZGluZyAqL1xuZXhwb3J0IGNvbnN0IFRFTVBPUkFSWV9OQU1FID0gJ190JztcblxuLyoqIE5hbWUgb2YgdGhlIGNvbnRleHQgcGFyYW1ldGVyIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBDT05URVhUX05BTUUgPSAnY3R4JztcblxuLyoqIE5hbWUgb2YgdGhlIFJlbmRlckZsYWcgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IFJFTkRFUl9GTEFHUyA9ICdyZic7XG5cbi8qKiBUaGUgcHJlZml4IHJlZmVyZW5jZSB2YXJpYWJsZXMgKi9cbmV4cG9ydCBjb25zdCBSRUZFUkVOQ0VfUFJFRklYID0gJ19yJztcblxuLyoqIFRoZSBuYW1lIG9mIHRoZSBpbXBsaWNpdCBjb250ZXh0IHJlZmVyZW5jZSAqL1xuZXhwb3J0IGNvbnN0IElNUExJQ0lUX1JFRkVSRU5DRSA9ICckaW1wbGljaXQnO1xuXG4vKiogTm9uIGJpbmRhYmxlIGF0dHJpYnV0ZSBuYW1lICoqL1xuZXhwb3J0IGNvbnN0IE5PTl9CSU5EQUJMRV9BVFRSID0gJ25nTm9uQmluZGFibGUnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWxsb2NhdG9yIGZvciBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAqXG4gKiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGlzIGFkZGVkIHRvIHRoZSBzdGF0ZW1lbnRzIHRoZSBmaXJzdCB0aW1lIHRoZSBhbGxvY2F0b3IgaXMgaW52b2tlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeUFsbG9jYXRvcihzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBuYW1lOiBzdHJpbmcpOiAoKSA9PiBvLlJlYWRWYXJFeHByIHtcbiAgbGV0IHRlbXA6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRGVjbGFyZVZhclN0bXQoVEVNUE9SQVJZX05BTUUsIHVuZGVmaW5lZCwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIHRlbXAgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcDtcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gdW5zdXBwb3J0ZWQoZmVhdHVyZTogc3RyaW5nKTogbmV2ZXIge1xuICBpZiAodGhpcykge1xuICAgIHRocm93IG5ldyBFcnJvcihgQnVpbGRlciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBzdXBwb3J0ICR7ZmVhdHVyZX0geWV0YCk7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBGZWF0dXJlICR7ZmVhdHVyZX0gaXMgbm90IHN1cHBvcnRlZCB5ZXRgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludmFsaWQ8VD4oYXJnOiBvLkV4cHJlc3Npb24gfCBvLlN0YXRlbWVudCB8IHQuTm9kZSk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgc3RhdGU6IFZpc2l0b3IgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGRvZXNuJ3QgaGFuZGxlICR7YXJnLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0xpdGVyYWwodmFsdWU6IGFueSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIodmFsdWUubWFwKGFzTGl0ZXJhbCkpO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWwodmFsdWUsIG8uSU5GRVJSRURfVFlQRSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChcbiAgICBrZXlzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW119LCBrZWVwRGVjbGFyZWQ/OiBib29sZWFuKTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoa2V5cykubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBtYXBUb0V4cHJlc3Npb24oa2V5cywga2VlcERlY2xhcmVkKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbWFwVG9FeHByZXNzaW9uKFxuICAgIG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdfSwga2VlcERlY2xhcmVkPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmxpdGVyYWxNYXAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWFwKS5tYXAoa2V5ID0+IHtcbiAgICAvLyBjYW5vbmljYWwgc3ludGF4OiBgZGlyUHJvcDogcHVibGljUHJvcGBcbiAgICAvLyBpZiB0aGVyZSBpcyBubyBgOmAsIHVzZSBkaXJQcm9wID0gZWxQcm9wXG4gICAgY29uc3QgdmFsdWUgPSBtYXBba2V5XTtcbiAgICBsZXQgZGVjbGFyZWROYW1lOiBzdHJpbmc7XG4gICAgbGV0IHB1YmxpY05hbWU6IHN0cmluZztcbiAgICBsZXQgbWluaWZpZWROYW1lOiBzdHJpbmc7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBbcHVibGljTmFtZSwgZGVjbGFyZWROYW1lXSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBbZGVjbGFyZWROYW1lLCBwdWJsaWNOYW1lXSA9IHNwbGl0QXRDb2xvbihrZXksIFtrZXksIHZhbHVlXSk7XG4gICAgfVxuICAgIG1pbmlmaWVkTmFtZSA9IGRlY2xhcmVkTmFtZTtcbiAgICByZXR1cm4ge1xuICAgICAga2V5OiBtaW5pZmllZE5hbWUsXG4gICAgICAvLyBwdXQgcXVvdGVzIGFyb3VuZCBrZXlzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcmFjdGVyc1xuICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KG1pbmlmaWVkTmFtZSksXG4gICAgICB2YWx1ZTogKGtlZXBEZWNsYXJlZCAmJiBwdWJsaWNOYW1lICE9PSBkZWNsYXJlZE5hbWUpID9cbiAgICAgICAgICBvLmxpdGVyYWxBcnIoW2FzTGl0ZXJhbChwdWJsaWNOYW1lKSwgYXNMaXRlcmFsKGRlY2xhcmVkTmFtZSldKSA6XG4gICAgICAgICAgYXNMaXRlcmFsKHB1YmxpY05hbWUpXG4gICAgfTtcbiAgfSkpO1xufVxuXG4vKipcbiAqICBSZW1vdmUgdHJhaWxpbmcgbnVsbCBub2RlcyBhcyB0aGV5IGFyZSBpbXBsaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHdoaWxlIChvLmlzTnVsbChwYXJhbWV0ZXJzW3BhcmFtZXRlcnMubGVuZ3RoIC0gMV0pKSB7XG4gICAgcGFyYW1ldGVycy5wb3AoKTtcbiAgfVxuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFF1ZXJ5UHJlZGljYXRlKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKSkge1xuICAgIGxldCBwcmVkaWNhdGU6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgcXVlcnkucHJlZGljYXRlLmZvckVhY2goKHNlbGVjdG9yOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIC8vIEVhY2ggaXRlbSBpbiBwcmVkaWNhdGVzIGFycmF5IG1heSBjb250YWluIHN0cmluZ3Mgd2l0aCBjb21tYS1zZXBhcmF0ZWQgcmVmc1xuICAgICAgLy8gKGZvciBleC4gJ3JlZiwgcmVmMSwgLi4uLCByZWZOJyksIHRodXMgd2UgZXh0cmFjdCBpbmRpdmlkdWFsIHJlZnMgYW5kIHN0b3JlIHRoZW1cbiAgICAgIC8vIGFzIHNlcGFyYXRlIGFycmF5IGVudGl0aWVzXG4gICAgICBjb25zdCBzZWxlY3RvcnMgPSBzZWxlY3Rvci5zcGxpdCgnLCcpLm1hcCh0b2tlbiA9PiBvLmxpdGVyYWwodG9rZW4udHJpbSgpKSk7XG4gICAgICBwcmVkaWNhdGUucHVzaCguLi5zZWxlY3RvcnMpO1xuICAgIH0pO1xuICAgIHJldHVybiBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihwcmVkaWNhdGUpLCB0cnVlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcXVlcnkucHJlZGljYXRlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub29wKCkge31cblxuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXAge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIHRoaXMudmFsdWVzLnB1c2goe2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG4gIH1cblxuICB0b0xpdGVyYWxNYXAoKTogby5MaXRlcmFsTWFwRXhwciB7IHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpOyB9XG59XG5cbi8qKlxuICogRXh0cmFjdCBhIG1hcCBvZiBwcm9wZXJ0aWVzIHRvIHZhbHVlcyBmb3IgYSBnaXZlbiBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUsIHdoaWNoIGNhbiBiZSB1c2VkXG4gKiBieSB0aGUgZGlyZWN0aXZlIG1hdGNoaW5nIG1hY2hpbmVyeS5cbiAqXG4gKiBAcGFyYW0gZWxPclRwbCB0aGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBpbiBxdWVzdGlvblxuICogQHJldHVybiBhbiBvYmplY3Qgc2V0IHVwIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuIEZvciBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50L3RlbXBsYXRlLCB0aGlzXG4gKiBvYmplY3QgbWFwcyBhIHByb3BlcnR5IG5hbWUgdG8gaXRzIChzdGF0aWMpIHZhbHVlLiBGb3IgYW55IGJpbmRpbmdzLCB0aGlzIG1hcCBzaW1wbHkgbWFwcyB0aGVcbiAqIHByb3BlcnR5IG5hbWUgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnQgfCB0LlRlbXBsYXRlKTpcbiAgICB7W25hbWU6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBhdHRyaWJ1dGVzTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICBpZiAoIWlzSTE4bkF0dHJpYnV0ZShhLm5hbWUpKSB7XG4gICAgICBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgIH1cbiAgfSk7XG4gIGVsT3JUcGwuaW5wdXRzLmZvckVhY2goaSA9PiB7IGF0dHJpYnV0ZXNNYXBbaS5uYW1lXSA9ICcnOyB9KTtcbiAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7IGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnOyB9KTtcblxuICByZXR1cm4gYXR0cmlidXRlc01hcDtcbn1cbiJdfQ==