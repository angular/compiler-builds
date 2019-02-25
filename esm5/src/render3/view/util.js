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
            quoted: false,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBR0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBR3hDLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFFNUMsdURBQXVEO0FBQ3ZELE1BQU0sQ0FBQyxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7QUFFbkMsb0VBQW9FO0FBQ3BFLE1BQU0sQ0FBQyxJQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7QUFFbEMsNkRBQTZEO0FBQzdELE1BQU0sQ0FBQyxJQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFFakMscUNBQXFDO0FBQ3JDLE1BQU0sQ0FBQyxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUVyQyxpREFBaUQ7QUFDakQsTUFBTSxDQUFDLElBQU0sa0JBQWtCLEdBQUcsV0FBVyxDQUFDO0FBRTlDLG1DQUFtQztBQUNuQyxNQUFNLENBQUMsSUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQUM7QUFFakQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxVQUF5QixFQUFFLElBQVk7SUFDeEUsSUFBSSxJQUFJLEdBQXVCLElBQUksQ0FBQztJQUNwQyxPQUFPO1FBQ0wsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNULFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDakYsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7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VUFBVSw0QkFBNEIsQ0FBQyxPQUErQjtJQUUxRSxJQUFNLGFBQWEsR0FBNkIsRUFBRSxDQUFDO0lBRW5ELE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztRQUMxQixJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM1QixhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7U0FDakM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFNLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQU0sYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU5RCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7c3BsaXRBdENvbG9ufSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2lzSTE4bkF0dHJpYnV0ZX0gZnJvbSAnLi9pMThuL3V0aWwnO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqIFRoZSBwcmVmaXggcmVmZXJlbmNlIHZhcmlhYmxlcyAqL1xuZXhwb3J0IGNvbnN0IFJFRkVSRU5DRV9QUkVGSVggPSAnX3InO1xuXG4vKiogVGhlIG5hbWUgb2YgdGhlIGltcGxpY2l0IGNvbnRleHQgcmVmZXJlbmNlICovXG5leHBvcnQgY29uc3QgSU1QTElDSVRfUkVGRVJFTkNFID0gJyRpbXBsaWNpdCc7XG5cbi8qKiBOb24gYmluZGFibGUgYXR0cmlidXRlIG5hbWUgKiovXG5leHBvcnQgY29uc3QgTk9OX0JJTkRBQkxFX0FUVFIgPSAnbmdOb25CaW5kYWJsZSc7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhbGxvY2F0b3IgZm9yIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICpcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gaXMgYWRkZWQgdG8gdGhlIHN0YXRlbWVudHMgdGhlIGZpcnN0IHRpbWUgdGhlIGFsbG9jYXRvciBpcyBpbnZva2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIG5hbWU6IHN0cmluZyk6ICgpID0+IG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5EZWNsYXJlVmFyU3RtdChURU1QT1JBUllfTkFNRSwgdW5kZWZpbmVkLCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgdGVtcCA9IG8udmFyaWFibGUobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wO1xuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiB1bnN1cHBvcnRlZChmZWF0dXJlOiBzdHJpbmcpOiBuZXZlciB7XG4gIGlmICh0aGlzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBCdWlsZGVyICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IHN1cHBvcnQgJHtmZWF0dXJlfSB5ZXRgKTtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYEZlYXR1cmUgJHtmZWF0dXJlfSBpcyBub3Qgc3VwcG9ydGVkIHlldGApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW52YWxpZDxUPihhcmc6IG8uRXhwcmVzc2lvbiB8IG8uU3RhdGVtZW50IHwgdC5Ob2RlKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBzdGF0ZTogVmlzaXRvciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBoYW5kbGUgJHthcmcuY29uc3RydWN0b3IubmFtZX1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzTGl0ZXJhbCh2YWx1ZTogYW55KTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZS5tYXAoYXNMaXRlcmFsKSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbCh2YWx1ZSwgby5JTkZFUlJFRF9UWVBFKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKFxuICAgIGtleXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0sIGtlZXBEZWNsYXJlZD86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhrZXlzKS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG1hcFRvRXhwcmVzc2lvbihrZXlzLCBrZWVwRGVjbGFyZWQpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtYXBUb0V4cHJlc3Npb24oXG4gICAgbWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW119LCBrZWVwRGVjbGFyZWQ/OiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtYXApLm1hcChrZXkgPT4ge1xuICAgIC8vIGNhbm9uaWNhbCBzeW50YXg6IGBkaXJQcm9wOiBwdWJsaWNQcm9wYFxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIGA6YCwgdXNlIGRpclByb3AgPSBlbFByb3BcbiAgICBjb25zdCB2YWx1ZSA9IG1hcFtrZXldO1xuICAgIGxldCBkZWNsYXJlZE5hbWU6IHN0cmluZztcbiAgICBsZXQgcHVibGljTmFtZTogc3RyaW5nO1xuICAgIGxldCBtaW5pZmllZE5hbWU6IHN0cmluZztcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIFtwdWJsaWNOYW1lLCBkZWNsYXJlZE5hbWVdID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIFtkZWNsYXJlZE5hbWUsIHB1YmxpY05hbWVdID0gc3BsaXRBdENvbG9uKGtleSwgW2tleSwgdmFsdWVdKTtcbiAgICB9XG4gICAgbWluaWZpZWROYW1lID0gZGVjbGFyZWROYW1lO1xuICAgIHJldHVybiB7XG4gICAgICBrZXk6IG1pbmlmaWVkTmFtZSxcbiAgICAgIHF1b3RlZDogZmFsc2UsXG4gICAgICB2YWx1ZTogKGtlZXBEZWNsYXJlZCAmJiBwdWJsaWNOYW1lICE9PSBkZWNsYXJlZE5hbWUpID9cbiAgICAgICAgICBvLmxpdGVyYWxBcnIoW2FzTGl0ZXJhbChwdWJsaWNOYW1lKSwgYXNMaXRlcmFsKGRlY2xhcmVkTmFtZSldKSA6XG4gICAgICAgICAgYXNMaXRlcmFsKHB1YmxpY05hbWUpXG4gICAgfTtcbiAgfSkpO1xufVxuXG4vKipcbiAqICBSZW1vdmUgdHJhaWxpbmcgbnVsbCBub2RlcyBhcyB0aGV5IGFyZSBpbXBsaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHdoaWxlIChvLmlzTnVsbChwYXJhbWV0ZXJzW3BhcmFtZXRlcnMubGVuZ3RoIC0gMV0pKSB7XG4gICAgcGFyYW1ldGVycy5wb3AoKTtcbiAgfVxuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFF1ZXJ5UHJlZGljYXRlKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKSkge1xuICAgIGxldCBwcmVkaWNhdGU6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgcXVlcnkucHJlZGljYXRlLmZvckVhY2goKHNlbGVjdG9yOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIC8vIEVhY2ggaXRlbSBpbiBwcmVkaWNhdGVzIGFycmF5IG1heSBjb250YWluIHN0cmluZ3Mgd2l0aCBjb21tYS1zZXBhcmF0ZWQgcmVmc1xuICAgICAgLy8gKGZvciBleC4gJ3JlZiwgcmVmMSwgLi4uLCByZWZOJyksIHRodXMgd2UgZXh0cmFjdCBpbmRpdmlkdWFsIHJlZnMgYW5kIHN0b3JlIHRoZW1cbiAgICAgIC8vIGFzIHNlcGFyYXRlIGFycmF5IGVudGl0aWVzXG4gICAgICBjb25zdCBzZWxlY3RvcnMgPSBzZWxlY3Rvci5zcGxpdCgnLCcpLm1hcCh0b2tlbiA9PiBvLmxpdGVyYWwodG9rZW4udHJpbSgpKSk7XG4gICAgICBwcmVkaWNhdGUucHVzaCguLi5zZWxlY3RvcnMpO1xuICAgIH0pO1xuICAgIHJldHVybiBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihwcmVkaWNhdGUpLCB0cnVlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcXVlcnkucHJlZGljYXRlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub29wKCkge31cblxuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXAge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIHRoaXMudmFsdWVzLnB1c2goe2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG4gIH1cblxuICB0b0xpdGVyYWxNYXAoKTogby5MaXRlcmFsTWFwRXhwciB7IHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpOyB9XG59XG5cbi8qKlxuICogRXh0cmFjdCBhIG1hcCBvZiBwcm9wZXJ0aWVzIHRvIHZhbHVlcyBmb3IgYSBnaXZlbiBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUsIHdoaWNoIGNhbiBiZSB1c2VkXG4gKiBieSB0aGUgZGlyZWN0aXZlIG1hdGNoaW5nIG1hY2hpbmVyeS5cbiAqXG4gKiBAcGFyYW0gZWxPclRwbCB0aGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBpbiBxdWVzdGlvblxuICogQHJldHVybiBhbiBvYmplY3Qgc2V0IHVwIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuIEZvciBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50L3RlbXBsYXRlLCB0aGlzXG4gKiBvYmplY3QgbWFwcyBhIHByb3BlcnR5IG5hbWUgdG8gaXRzIChzdGF0aWMpIHZhbHVlLiBGb3IgYW55IGJpbmRpbmdzLCB0aGlzIG1hcCBzaW1wbHkgbWFwcyB0aGVcbiAqIHByb3BlcnR5IG5hbWUgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnQgfCB0LlRlbXBsYXRlKTpcbiAgICB7W25hbWU6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBhdHRyaWJ1dGVzTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICBpZiAoIWlzSTE4bkF0dHJpYnV0ZShhLm5hbWUpKSB7XG4gICAgICBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgIH1cbiAgfSk7XG4gIGVsT3JUcGwuaW5wdXRzLmZvckVhY2goaSA9PiB7IGF0dHJpYnV0ZXNNYXBbaS5uYW1lXSA9ICcnOyB9KTtcbiAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7IGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnOyB9KTtcblxuICByZXR1cm4gYXR0cmlidXRlc01hcDtcbn1cbiJdfQ==