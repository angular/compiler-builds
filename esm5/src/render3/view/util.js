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
import * as t from '../r3_ast';
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
    if (elOrTpl instanceof t.Template) {
        elOrTpl.templateAttrs.forEach(function (a) { return attributesMap[a.name] = ''; });
    }
    return attributesMap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBR0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3hDLE9BQU8sS0FBSyxDQUFDLE1BQU0sV0FBVyxDQUFDO0FBRS9CLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFFNUM7Ozs7Ozs7R0FPRztBQUNILElBQU0sNkJBQTZCLEdBQUcsR0FBRyxDQUFDO0FBRTFDLHVEQUF1RDtBQUN2RCxNQUFNLENBQUMsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDO0FBRW5DLG9FQUFvRTtBQUNwRSxNQUFNLENBQUMsSUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBRWxDLDZEQUE2RDtBQUM3RCxNQUFNLENBQUMsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0FBRWpDLHFDQUFxQztBQUNyQyxNQUFNLENBQUMsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7QUFFckMsaURBQWlEO0FBQ2pELE1BQU0sQ0FBQyxJQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQztBQUU5QyxtQ0FBbUM7QUFDbkMsTUFBTSxDQUFDLElBQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFDO0FBRWpEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsVUFBeUIsRUFBRSxJQUFZO0lBQ3hFLElBQUksSUFBSSxHQUF1QixJQUFJLENBQUM7SUFDcEMsT0FBTztRQUNMLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDVCxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ2pGLElBQUksR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3pCO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDLENBQUM7QUFDSixDQUFDO0FBR0QsTUFBTSxVQUFVLFdBQVcsQ0FBQyxPQUFlO0lBQ3pDLElBQUksSUFBSSxFQUFFO1FBQ1IsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFXLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSx5QkFBb0IsT0FBTyxTQUFNLENBQUMsQ0FBQztLQUNwRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBVyxPQUFPLDBCQUF1QixDQUFDLENBQUM7QUFDN0QsQ0FBQztBQUVELE1BQU0sVUFBVSxPQUFPLENBQUksR0FBd0M7SUFDakUsTUFBTSxJQUFJLEtBQUssQ0FDWCw0QkFBMEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLHdCQUFtQixHQUFHLENBQUMsV0FBVyxDQUFDLElBQU0sQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFFRCxNQUFNLFVBQVUsU0FBUyxDQUFDLEtBQVU7SUFDbEMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3hCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7S0FDM0M7SUFDRCxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBRUQsTUFBTSxVQUFVLG1DQUFtQyxDQUMvQyxJQUF3QyxFQUFFLFlBQXNCO0lBQ2xFLElBQUksTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDL0MsT0FBTyxlQUFlLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO0tBQzVDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQ3BCLEdBQXVDLEVBQUUsWUFBc0I7SUFDakUsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHOztRQUN6RCwwQ0FBMEM7UUFDMUMsMkNBQTJDO1FBQzNDLElBQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN2QixJQUFJLFlBQW9CLENBQUM7UUFDekIsSUFBSSxVQUFrQixDQUFDO1FBQ3ZCLElBQUksWUFBb0IsQ0FBQztRQUN6QixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDeEIsNkJBQWtDLEVBQWpDLGtCQUFVLEVBQUUsb0JBQVksQ0FBVTtTQUNwQzthQUFNO1lBQ0wsdURBQTRELEVBQTNELG9CQUFZLEVBQUUsa0JBQVUsQ0FBb0M7U0FDOUQ7UUFDRCxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQzVCLE9BQU87WUFDTCxHQUFHLEVBQUUsWUFBWTtZQUNqQixvRUFBb0U7WUFDcEUsTUFBTSxFQUFFLDZCQUE2QixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDeEQsS0FBSyxFQUFFLENBQUMsWUFBWSxJQUFJLFVBQVUsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNsRCxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDaEUsU0FBUyxDQUFDLFVBQVUsQ0FBQztTQUMxQixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNOLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxVQUEwQjtJQUMxRCxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNsRCxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7S0FDbEI7SUFDRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQixDQUM3QixLQUFzQixFQUFFLFlBQTBCO0lBQ3BELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDbEMsSUFBSSxXQUFTLEdBQW1CLEVBQUUsQ0FBQztRQUNuQyxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFDLFFBQWdCO1lBQ3ZDLDhFQUE4RTtZQUM5RSxtRkFBbUY7WUFDbkYsNkJBQTZCO1lBQzdCLElBQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBdkIsQ0FBdUIsQ0FBQyxDQUFDO1lBQzVFLFdBQVMsQ0FBQyxJQUFJLE9BQWQsV0FBUyxtQkFBUyxTQUFTLEdBQUU7UUFDL0IsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFTLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUNwRTtTQUFNO1FBQ0wsT0FBTyxLQUFLLENBQUMsU0FBUyxDQUFDO0tBQ3hCO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxJQUFJLEtBQUksQ0FBQztBQUV6QjtJQUFBO1FBQ0UsV0FBTSxHQUEwRCxFQUFFLENBQUM7SUFTckUsQ0FBQztJQVBDLDJCQUFHLEdBQUgsVUFBSSxHQUFXLEVBQUUsS0FBd0I7UUFDdkMsSUFBSSxLQUFLLEVBQUU7WUFDVCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUcsS0FBQSxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO1NBQy9DO0lBQ0gsQ0FBQztJQUVELG9DQUFZLEdBQVosY0FBbUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsb0JBQUM7QUFBRCxDQUFDLEFBVkQsSUFVQzs7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxPQUErQjtJQUUxRSxJQUFNLGFBQWEsR0FBNkIsRUFBRSxDQUFDO0lBRW5ELE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztRQUMxQixJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM1QixhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7U0FDakM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFNLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQU0sYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU5RCxJQUFJLE9BQU8sWUFBWSxDQUFDLENBQUMsUUFBUSxFQUFFO1FBQ2pDLE9BQU8sQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQTFCLENBQTBCLENBQUMsQ0FBQztLQUNoRTtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtzcGxpdEF0Q29sb259IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7aXNJMThuQXR0cmlidXRlfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgYW4gb2JqZWN0IGtleSBjb250YWlucyBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcnMsIHRodXMgdGhlIGtleSBzaG91bGQgYmUgd3JhcHBlZCBpblxuICogcXVvdGVzLiBOb3RlOiB3ZSBkbyBub3Qgd3JhcCBhbGwga2V5cyBpbnRvIHF1b3RlcywgYXMgaXQgbWF5IGhhdmUgaW1wYWN0IG9uIG1pbmlmaWNhdGlvbiBhbmQgbWF5XG4gKiBib3Qgd29yayBpbiBzb21lIGNhc2VzIHdoZW4gb2JqZWN0IGtleXMgYXJlIG1hbmdsZWQgYnkgbWluaWZpZXIuXG4gKlxuICogVE9ETyhGVy0xMTM2KTogdGhpcyBpcyBhIHRlbXBvcmFyeSBzb2x1dGlvbiwgd2UgbmVlZCB0byBjb21lIHVwIHdpdGggYSBiZXR0ZXIgd2F5IG9mIHdvcmtpbmcgd2l0aFxuICogaW5wdXRzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcnMuXG4gKi9cbmNvbnN0IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQID0gLy0vO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqIFRoZSBwcmVmaXggcmVmZXJlbmNlIHZhcmlhYmxlcyAqL1xuZXhwb3J0IGNvbnN0IFJFRkVSRU5DRV9QUkVGSVggPSAnX3InO1xuXG4vKiogVGhlIG5hbWUgb2YgdGhlIGltcGxpY2l0IGNvbnRleHQgcmVmZXJlbmNlICovXG5leHBvcnQgY29uc3QgSU1QTElDSVRfUkVGRVJFTkNFID0gJyRpbXBsaWNpdCc7XG5cbi8qKiBOb24gYmluZGFibGUgYXR0cmlidXRlIG5hbWUgKiovXG5leHBvcnQgY29uc3QgTk9OX0JJTkRBQkxFX0FUVFIgPSAnbmdOb25CaW5kYWJsZSc7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhbGxvY2F0b3IgZm9yIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICpcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gaXMgYWRkZWQgdG8gdGhlIHN0YXRlbWVudHMgdGhlIGZpcnN0IHRpbWUgdGhlIGFsbG9jYXRvciBpcyBpbnZva2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIG5hbWU6IHN0cmluZyk6ICgpID0+IG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5EZWNsYXJlVmFyU3RtdChURU1QT1JBUllfTkFNRSwgdW5kZWZpbmVkLCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgdGVtcCA9IG8udmFyaWFibGUobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wO1xuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiB1bnN1cHBvcnRlZChmZWF0dXJlOiBzdHJpbmcpOiBuZXZlciB7XG4gIGlmICh0aGlzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBCdWlsZGVyICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IHN1cHBvcnQgJHtmZWF0dXJlfSB5ZXRgKTtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYEZlYXR1cmUgJHtmZWF0dXJlfSBpcyBub3Qgc3VwcG9ydGVkIHlldGApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW52YWxpZDxUPihhcmc6IG8uRXhwcmVzc2lvbiB8IG8uU3RhdGVtZW50IHwgdC5Ob2RlKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBzdGF0ZTogVmlzaXRvciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBoYW5kbGUgJHthcmcuY29uc3RydWN0b3IubmFtZX1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzTGl0ZXJhbCh2YWx1ZTogYW55KTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZS5tYXAoYXNMaXRlcmFsKSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbCh2YWx1ZSwgby5JTkZFUlJFRF9UWVBFKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKFxuICAgIGtleXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0sIGtlZXBEZWNsYXJlZD86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhrZXlzKS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG1hcFRvRXhwcmVzc2lvbihrZXlzLCBrZWVwRGVjbGFyZWQpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtYXBUb0V4cHJlc3Npb24oXG4gICAgbWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW119LCBrZWVwRGVjbGFyZWQ/OiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtYXApLm1hcChrZXkgPT4ge1xuICAgIC8vIGNhbm9uaWNhbCBzeW50YXg6IGBkaXJQcm9wOiBwdWJsaWNQcm9wYFxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIGA6YCwgdXNlIGRpclByb3AgPSBlbFByb3BcbiAgICBjb25zdCB2YWx1ZSA9IG1hcFtrZXldO1xuICAgIGxldCBkZWNsYXJlZE5hbWU6IHN0cmluZztcbiAgICBsZXQgcHVibGljTmFtZTogc3RyaW5nO1xuICAgIGxldCBtaW5pZmllZE5hbWU6IHN0cmluZztcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIFtwdWJsaWNOYW1lLCBkZWNsYXJlZE5hbWVdID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIFtkZWNsYXJlZE5hbWUsIHB1YmxpY05hbWVdID0gc3BsaXRBdENvbG9uKGtleSwgW2tleSwgdmFsdWVdKTtcbiAgICB9XG4gICAgbWluaWZpZWROYW1lID0gZGVjbGFyZWROYW1lO1xuICAgIHJldHVybiB7XG4gICAgICBrZXk6IG1pbmlmaWVkTmFtZSxcbiAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICBxdW90ZWQ6IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQLnRlc3QobWluaWZpZWROYW1lKSxcbiAgICAgIHZhbHVlOiAoa2VlcERlY2xhcmVkICYmIHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZSkgP1xuICAgICAgICAgIG8ubGl0ZXJhbEFycihbYXNMaXRlcmFsKHB1YmxpY05hbWUpLCBhc0xpdGVyYWwoZGVjbGFyZWROYW1lKV0pIDpcbiAgICAgICAgICBhc0xpdGVyYWwocHVibGljTmFtZSlcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKlxuICogIFJlbW92ZSB0cmFpbGluZyBudWxsIG5vZGVzIGFzIHRoZXkgYXJlIGltcGxpZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgd2hpbGUgKG8uaXNOdWxsKHBhcmFtZXRlcnNbcGFyYW1ldGVycy5sZW5ndGggLSAxXSkpIHtcbiAgICBwYXJhbWV0ZXJzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnlQcmVkaWNhdGUoXG4gICAgcXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpKSB7XG4gICAgbGV0IHByZWRpY2F0ZTogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBxdWVyeS5wcmVkaWNhdGUuZm9yRWFjaCgoc2VsZWN0b3I6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgLy8gRWFjaCBpdGVtIGluIHByZWRpY2F0ZXMgYXJyYXkgbWF5IGNvbnRhaW4gc3RyaW5ncyB3aXRoIGNvbW1hLXNlcGFyYXRlZCByZWZzXG4gICAgICAvLyAoZm9yIGV4LiAncmVmLCByZWYxLCAuLi4sIHJlZk4nKSwgdGh1cyB3ZSBleHRyYWN0IGluZGl2aWR1YWwgcmVmcyBhbmQgc3RvcmUgdGhlbVxuICAgICAgLy8gYXMgc2VwYXJhdGUgYXJyYXkgZW50aXRpZXNcbiAgICAgIGNvbnN0IHNlbGVjdG9ycyA9IHNlbGVjdG9yLnNwbGl0KCcsJykubWFwKHRva2VuID0+IG8ubGl0ZXJhbCh0b2tlbi50cmltKCkpKTtcbiAgICAgIHByZWRpY2F0ZS5wdXNoKC4uLnNlbGVjdG9ycyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHByZWRpY2F0ZSksIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBxdWVyeS5wcmVkaWNhdGU7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5leHBvcnQgY2xhc3MgRGVmaW5pdGlvbk1hcCB7XG4gIHZhbHVlczoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW4sIHZhbHVlOiBvLkV4cHJlc3Npb259W10gPSBbXTtcblxuICBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgdGhpcy52YWx1ZXMucHVzaCh7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX0pO1xuICAgIH1cbiAgfVxuXG4gIHRvTGl0ZXJhbE1hcCgpOiBvLkxpdGVyYWxNYXBFeHByIHsgcmV0dXJuIG8ubGl0ZXJhbE1hcCh0aGlzLnZhbHVlcyk7IH1cbn1cblxuLyoqXG4gKiBFeHRyYWN0IGEgbWFwIG9mIHByb3BlcnRpZXMgdG8gdmFsdWVzIGZvciBhIGdpdmVuIGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZSwgd2hpY2ggY2FuIGJlIHVzZWRcbiAqIGJ5IHRoZSBkaXJlY3RpdmUgbWF0Y2hpbmcgbWFjaGluZXJ5LlxuICpcbiAqIEBwYXJhbSBlbE9yVHBsIHRoZSBlbGVtZW50IG9yIHRlbXBsYXRlIGluIHF1ZXN0aW9uXG4gKiBAcmV0dXJuIGFuIG9iamVjdCBzZXQgdXAgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy4gRm9yIGF0dHJpYnV0ZXMgb24gdGhlIGVsZW1lbnQvdGVtcGxhdGUsIHRoaXNcbiAqIG9iamVjdCBtYXBzIGEgcHJvcGVydHkgbmFtZSB0byBpdHMgKHN0YXRpYykgdmFsdWUuIEZvciBhbnkgYmluZGluZ3MsIHRoaXMgbWFwIHNpbXBseSBtYXBzIHRoZVxuICogcHJvcGVydHkgbmFtZSB0byBhbiBlbXB0eSBzdHJpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGw6IHQuRWxlbWVudCB8IHQuVGVtcGxhdGUpOlxuICAgIHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSB7XG4gIGNvbnN0IGF0dHJpYnV0ZXNNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIGVsT3JUcGwuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgIGlmICghaXNJMThuQXR0cmlidXRlKGEubmFtZSkpIHtcbiAgICAgIGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgfVxuICB9KTtcbiAgZWxPclRwbC5pbnB1dHMuZm9yRWFjaChpID0+IHsgYXR0cmlidXRlc01hcFtpLm5hbWVdID0gJyc7IH0pO1xuICBlbE9yVHBsLm91dHB1dHMuZm9yRWFjaChvID0+IHsgYXR0cmlidXRlc01hcFtvLm5hbWVdID0gJyc7IH0pO1xuXG4gIGlmIChlbE9yVHBsIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgIGVsT3JUcGwudGVtcGxhdGVBdHRycy5mb3JFYWNoKGEgPT4gYXR0cmlidXRlc01hcFthLm5hbWVdID0gJycpO1xuICB9XG5cbiAgcmV0dXJuIGF0dHJpYnV0ZXNNYXA7XG59XG4iXX0=