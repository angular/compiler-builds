/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/util", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getInterpolationArgsLength = exports.chainedInstruction = exports.getAttrsForDirectiveMatching = exports.DefinitionMap = exports.getQueryPredicate = exports.trimTrailingNulls = exports.conditionallyCreateMapObjectLiteral = exports.asLiteral = exports.invalid = exports.unsupported = exports.temporaryAllocator = exports.NON_BINDABLE_ATTR = exports.IMPLICIT_REFERENCE = exports.REFERENCE_PREFIX = exports.RENDER_FLAGS = exports.CONTEXT_NAME = exports.TEMPORARY_NAME = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/util");
    var t = require("@angular/compiler/src/render3/r3_ast");
    var util_2 = require("@angular/compiler/src/render3/view/i18n/util");
    /**
     * Checks whether an object key contains potentially unsafe chars, thus the key should be wrapped in
     * quotes. Note: we do not wrap all keys into quotes, as it may have impact on minification and may
     * bot work in some cases when object keys are mangled by minifier.
     *
     * TODO(FW-1136): this is a temporary solution, we need to come up with a better way of working with
     * inputs that contain potentially unsafe chars.
     */
    var UNSAFE_OBJECT_KEY_NAME_REGEXP = /[-.]/;
    /** Name of the temporary to use during data binding */
    exports.TEMPORARY_NAME = '_t';
    /** Name of the context parameter passed into a template function */
    exports.CONTEXT_NAME = 'ctx';
    /** Name of the RenderFlag passed into a template function */
    exports.RENDER_FLAGS = 'rf';
    /** The prefix reference variables */
    exports.REFERENCE_PREFIX = '_r';
    /** The name of the implicit context reference */
    exports.IMPLICIT_REFERENCE = '$implicit';
    /** Non bindable attribute name **/
    exports.NON_BINDABLE_ATTR = 'ngNonBindable';
    /**
     * Creates an allocator for a temporary variable.
     *
     * A variable declaration is added to the statements the first time the allocator is invoked.
     */
    function temporaryAllocator(statements, name) {
        var temp = null;
        return function () {
            if (!temp) {
                statements.push(new o.DeclareVarStmt(exports.TEMPORARY_NAME, undefined, o.DYNAMIC_TYPE));
                temp = o.variable(name);
            }
            return temp;
        };
    }
    exports.temporaryAllocator = temporaryAllocator;
    function unsupported(feature) {
        if (this) {
            throw new Error("Builder " + this.constructor.name + " doesn't support " + feature + " yet");
        }
        throw new Error("Feature " + feature + " is not supported yet");
    }
    exports.unsupported = unsupported;
    function invalid(arg) {
        throw new Error("Invalid state: Visitor " + this.constructor.name + " doesn't handle " + arg.constructor.name);
    }
    exports.invalid = invalid;
    function asLiteral(value) {
        if (Array.isArray(value)) {
            return o.literalArr(value.map(asLiteral));
        }
        return o.literal(value, o.INFERRED_TYPE);
    }
    exports.asLiteral = asLiteral;
    function conditionallyCreateMapObjectLiteral(keys, keepDeclared) {
        if (Object.getOwnPropertyNames(keys).length > 0) {
            return mapToExpression(keys, keepDeclared);
        }
        return null;
    }
    exports.conditionallyCreateMapObjectLiteral = conditionallyCreateMapObjectLiteral;
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
                minifiedName = key;
            }
            else {
                _b = tslib_1.__read(util_1.splitAtColon(key, [key, value]), 2), declaredName = _b[0], publicName = _b[1];
                minifiedName = declaredName;
            }
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
    function trimTrailingNulls(parameters) {
        while (o.isNull(parameters[parameters.length - 1])) {
            parameters.pop();
        }
        return parameters;
    }
    exports.trimTrailingNulls = trimTrailingNulls;
    function getQueryPredicate(query, constantPool) {
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
    exports.getQueryPredicate = getQueryPredicate;
    /**
     * A representation for an object literal used during codegen of definition objects. The generic
     * type `T` allows to reference a documented type of the generated structure, such that the
     * property names that are set can be resolved to their documented declaration.
     */
    var DefinitionMap = /** @class */ (function () {
        function DefinitionMap() {
            this.values = [];
        }
        DefinitionMap.prototype.set = function (key, value) {
            if (value) {
                this.values.push({ key: key, value: value, quoted: false });
            }
        };
        DefinitionMap.prototype.toLiteralMap = function () {
            return o.literalMap(this.values);
        };
        return DefinitionMap;
    }());
    exports.DefinitionMap = DefinitionMap;
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
        var attributesMap = {};
        if (elOrTpl instanceof t.Template && elOrTpl.tagName !== 'ng-template') {
            elOrTpl.templateAttrs.forEach(function (a) { return attributesMap[a.name] = ''; });
        }
        else {
            elOrTpl.attributes.forEach(function (a) {
                if (!util_2.isI18nAttribute(a.name)) {
                    attributesMap[a.name] = a.value;
                }
            });
            elOrTpl.inputs.forEach(function (i) {
                attributesMap[i.name] = '';
            });
            elOrTpl.outputs.forEach(function (o) {
                attributesMap[o.name] = '';
            });
        }
        return attributesMap;
    }
    exports.getAttrsForDirectiveMatching = getAttrsForDirectiveMatching;
    /** Returns a call expression to a chained instruction, e.g. `property(params[0])(params[1])`. */
    function chainedInstruction(reference, calls, span) {
        var expression = o.importExpr(reference, null, span);
        if (calls.length > 0) {
            for (var i = 0; i < calls.length; i++) {
                expression = expression.callFn(calls[i], span);
            }
        }
        else {
            // Add a blank invocation, in case the `calls` array is empty.
            expression = expression.callFn([], span);
        }
        return expression;
    }
    exports.chainedInstruction = chainedInstruction;
    /**
     * Gets the number of arguments expected to be passed to a generated instruction in the case of
     * interpolation instructions.
     * @param interpolation An interpolation ast
     */
    function getInterpolationArgsLength(interpolation) {
        var expressions = interpolation.expressions, strings = interpolation.strings;
        if (expressions.length === 1 && strings.length === 2 && strings[0] === '' && strings[1] === '') {
            // If the interpolation has one interpolated value, but the prefix and suffix are both empty
            // strings, we only pass one argument, to a special instruction like `propertyInterpolate` or
            // `textInterpolate`.
            return 1;
        }
        else {
            return expressions.length + strings.length;
        }
    }
    exports.getInterpolationArgsLength = getInterpolationArgsLength;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBSUgsMkRBQTZDO0lBRTdDLG1EQUF3QztJQUN4Qyx3REFBK0I7SUFHL0IscUVBQTRDO0lBRzVDOzs7Ozs7O09BT0c7SUFDSCxJQUFNLDZCQUE2QixHQUFHLE1BQU0sQ0FBQztJQUU3Qyx1REFBdUQ7SUFDMUMsUUFBQSxjQUFjLEdBQUcsSUFBSSxDQUFDO0lBRW5DLG9FQUFvRTtJQUN2RCxRQUFBLFlBQVksR0FBRyxLQUFLLENBQUM7SUFFbEMsNkRBQTZEO0lBQ2hELFFBQUEsWUFBWSxHQUFHLElBQUksQ0FBQztJQUVqQyxxQ0FBcUM7SUFDeEIsUUFBQSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7SUFFckMsaURBQWlEO0lBQ3BDLFFBQUEsa0JBQWtCLEdBQUcsV0FBVyxDQUFDO0lBRTlDLG1DQUFtQztJQUN0QixRQUFBLGlCQUFpQixHQUFHLGVBQWUsQ0FBQztJQUVqRDs7OztPQUlHO0lBQ0gsU0FBZ0Isa0JBQWtCLENBQUMsVUFBeUIsRUFBRSxJQUFZO1FBQ3hFLElBQUksSUFBSSxHQUF1QixJQUFJLENBQUM7UUFDcEMsT0FBTztZQUNMLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ1QsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsc0JBQWMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2pGLElBQUksR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3pCO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDLENBQUM7SUFDSixDQUFDO0lBVEQsZ0RBU0M7SUFHRCxTQUFnQixXQUFX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TEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtzcGxpdEF0Q29sb259IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuXG5pbXBvcnQge1IzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtpc0kxOG5BdHRyaWJ1dGV9IGZyb20gJy4vaTE4bi91dGlsJztcblxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIGFuIG9iamVjdCBrZXkgY29udGFpbnMgcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLCB0aHVzIHRoZSBrZXkgc2hvdWxkIGJlIHdyYXBwZWQgaW5cbiAqIHF1b3Rlcy4gTm90ZTogd2UgZG8gbm90IHdyYXAgYWxsIGtleXMgaW50byBxdW90ZXMsIGFzIGl0IG1heSBoYXZlIGltcGFjdCBvbiBtaW5pZmljYXRpb24gYW5kIG1heVxuICogYm90IHdvcmsgaW4gc29tZSBjYXNlcyB3aGVuIG9iamVjdCBrZXlzIGFyZSBtYW5nbGVkIGJ5IG1pbmlmaWVyLlxuICpcbiAqIFRPRE8oRlctMTEzNik6IHRoaXMgaXMgYSB0ZW1wb3Jhcnkgc29sdXRpb24sIHdlIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIHdheSBvZiB3b3JraW5nIHdpdGhcbiAqIGlucHV0cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLlxuICovXG5jb25zdCBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUCA9IC9bLS5dLztcblxuLyoqIE5hbWUgb2YgdGhlIHRlbXBvcmFyeSB0byB1c2UgZHVyaW5nIGRhdGEgYmluZGluZyAqL1xuZXhwb3J0IGNvbnN0IFRFTVBPUkFSWV9OQU1FID0gJ190JztcblxuLyoqIE5hbWUgb2YgdGhlIGNvbnRleHQgcGFyYW1ldGVyIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBDT05URVhUX05BTUUgPSAnY3R4JztcblxuLyoqIE5hbWUgb2YgdGhlIFJlbmRlckZsYWcgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IFJFTkRFUl9GTEFHUyA9ICdyZic7XG5cbi8qKiBUaGUgcHJlZml4IHJlZmVyZW5jZSB2YXJpYWJsZXMgKi9cbmV4cG9ydCBjb25zdCBSRUZFUkVOQ0VfUFJFRklYID0gJ19yJztcblxuLyoqIFRoZSBuYW1lIG9mIHRoZSBpbXBsaWNpdCBjb250ZXh0IHJlZmVyZW5jZSAqL1xuZXhwb3J0IGNvbnN0IElNUExJQ0lUX1JFRkVSRU5DRSA9ICckaW1wbGljaXQnO1xuXG4vKiogTm9uIGJpbmRhYmxlIGF0dHJpYnV0ZSBuYW1lICoqL1xuZXhwb3J0IGNvbnN0IE5PTl9CSU5EQUJMRV9BVFRSID0gJ25nTm9uQmluZGFibGUnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWxsb2NhdG9yIGZvciBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAqXG4gKiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGlzIGFkZGVkIHRvIHRoZSBzdGF0ZW1lbnRzIHRoZSBmaXJzdCB0aW1lIHRoZSBhbGxvY2F0b3IgaXMgaW52b2tlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeUFsbG9jYXRvcihzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBuYW1lOiBzdHJpbmcpOiAoKSA9PiBvLlJlYWRWYXJFeHByIHtcbiAgbGV0IHRlbXA6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRGVjbGFyZVZhclN0bXQoVEVNUE9SQVJZX05BTUUsIHVuZGVmaW5lZCwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIHRlbXAgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcDtcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gdW5zdXBwb3J0ZWQodGhpczogdm9pZHxGdW5jdGlvbiwgZmVhdHVyZTogc3RyaW5nKTogbmV2ZXIge1xuICBpZiAodGhpcykge1xuICAgIHRocm93IG5ldyBFcnJvcihgQnVpbGRlciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBzdXBwb3J0ICR7ZmVhdHVyZX0geWV0YCk7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBGZWF0dXJlICR7ZmVhdHVyZX0gaXMgbm90IHN1cHBvcnRlZCB5ZXRgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludmFsaWQ8VD4odGhpczogdC5WaXNpdG9yLCBhcmc6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudHx0Lk5vZGUpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIHN0YXRlOiBWaXNpdG9yICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IGhhbmRsZSAke2FyZy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNMaXRlcmFsKHZhbHVlOiBhbnkpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlLm1hcChhc0xpdGVyYWwpKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsKHZhbHVlLCBvLklORkVSUkVEX1RZUEUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwoXG4gICAga2V5czoge1trZXk6IHN0cmluZ106IHN0cmluZ3xzdHJpbmdbXX0sIGtlZXBEZWNsYXJlZD86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhrZXlzKS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG1hcFRvRXhwcmVzc2lvbihrZXlzLCBrZWVwRGVjbGFyZWQpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtYXBUb0V4cHJlc3Npb24oXG4gICAgbWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfHN0cmluZ1tdfSwga2VlcERlY2xhcmVkPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmxpdGVyYWxNYXAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWFwKS5tYXAoa2V5ID0+IHtcbiAgICAvLyBjYW5vbmljYWwgc3ludGF4OiBgZGlyUHJvcDogcHVibGljUHJvcGBcbiAgICAvLyBpZiB0aGVyZSBpcyBubyBgOmAsIHVzZSBkaXJQcm9wID0gZWxQcm9wXG4gICAgY29uc3QgdmFsdWUgPSBtYXBba2V5XTtcbiAgICBsZXQgZGVjbGFyZWROYW1lOiBzdHJpbmc7XG4gICAgbGV0IHB1YmxpY05hbWU6IHN0cmluZztcbiAgICBsZXQgbWluaWZpZWROYW1lOiBzdHJpbmc7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBbcHVibGljTmFtZSwgZGVjbGFyZWROYW1lXSA9IHZhbHVlO1xuICAgICAgbWluaWZpZWROYW1lID0ga2V5O1xuICAgIH0gZWxzZSB7XG4gICAgICBbZGVjbGFyZWROYW1lLCBwdWJsaWNOYW1lXSA9IHNwbGl0QXRDb2xvbihrZXksIFtrZXksIHZhbHVlXSk7XG4gICAgICBtaW5pZmllZE5hbWUgPSBkZWNsYXJlZE5hbWU7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBrZXk6IG1pbmlmaWVkTmFtZSxcbiAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICBxdW90ZWQ6IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQLnRlc3QobWluaWZpZWROYW1lKSxcbiAgICAgIHZhbHVlOiAoa2VlcERlY2xhcmVkICYmIHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZSkgP1xuICAgICAgICAgIG8ubGl0ZXJhbEFycihbYXNMaXRlcmFsKHB1YmxpY05hbWUpLCBhc0xpdGVyYWwoZGVjbGFyZWROYW1lKV0pIDpcbiAgICAgICAgICBhc0xpdGVyYWwocHVibGljTmFtZSlcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKlxuICogIFJlbW92ZSB0cmFpbGluZyBudWxsIG5vZGVzIGFzIHRoZXkgYXJlIGltcGxpZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgd2hpbGUgKG8uaXNOdWxsKHBhcmFtZXRlcnNbcGFyYW1ldGVycy5sZW5ndGggLSAxXSkpIHtcbiAgICBwYXJhbWV0ZXJzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnlQcmVkaWNhdGUoXG4gICAgcXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpKSB7XG4gICAgbGV0IHByZWRpY2F0ZTogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBxdWVyeS5wcmVkaWNhdGUuZm9yRWFjaCgoc2VsZWN0b3I6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgLy8gRWFjaCBpdGVtIGluIHByZWRpY2F0ZXMgYXJyYXkgbWF5IGNvbnRhaW4gc3RyaW5ncyB3aXRoIGNvbW1hLXNlcGFyYXRlZCByZWZzXG4gICAgICAvLyAoZm9yIGV4LiAncmVmLCByZWYxLCAuLi4sIHJlZk4nKSwgdGh1cyB3ZSBleHRyYWN0IGluZGl2aWR1YWwgcmVmcyBhbmQgc3RvcmUgdGhlbVxuICAgICAgLy8gYXMgc2VwYXJhdGUgYXJyYXkgZW50aXRpZXNcbiAgICAgIGNvbnN0IHNlbGVjdG9ycyA9IHNlbGVjdG9yLnNwbGl0KCcsJykubWFwKHRva2VuID0+IG8ubGl0ZXJhbCh0b2tlbi50cmltKCkpKTtcbiAgICAgIHByZWRpY2F0ZS5wdXNoKC4uLnNlbGVjdG9ycyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHByZWRpY2F0ZSksIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBxdWVyeS5wcmVkaWNhdGU7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHJlcHJlc2VudGF0aW9uIGZvciBhbiBvYmplY3QgbGl0ZXJhbCB1c2VkIGR1cmluZyBjb2RlZ2VuIG9mIGRlZmluaXRpb24gb2JqZWN0cy4gVGhlIGdlbmVyaWNcbiAqIHR5cGUgYFRgIGFsbG93cyB0byByZWZlcmVuY2UgYSBkb2N1bWVudGVkIHR5cGUgb2YgdGhlIGdlbmVyYXRlZCBzdHJ1Y3R1cmUsIHN1Y2ggdGhhdCB0aGVcbiAqIHByb3BlcnR5IG5hbWVzIHRoYXQgYXJlIHNldCBjYW4gYmUgcmVzb2x2ZWQgdG8gdGhlaXIgZG9jdW1lbnRlZCBkZWNsYXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXA8VCA9IGFueT4ge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleToga2V5b2YgVCwgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICB0aGlzLnZhbHVlcy5wdXNoKHtrZXk6IGtleSBhcyBzdHJpbmcsIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuICB9XG5cbiAgdG9MaXRlcmFsTWFwKCk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICAgIHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpO1xuICB9XG59XG5cbi8qKlxuICogRXh0cmFjdCBhIG1hcCBvZiBwcm9wZXJ0aWVzIHRvIHZhbHVlcyBmb3IgYSBnaXZlbiBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUsIHdoaWNoIGNhbiBiZSB1c2VkXG4gKiBieSB0aGUgZGlyZWN0aXZlIG1hdGNoaW5nIG1hY2hpbmVyeS5cbiAqXG4gKiBAcGFyYW0gZWxPclRwbCB0aGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBpbiBxdWVzdGlvblxuICogQHJldHVybiBhbiBvYmplY3Qgc2V0IHVwIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuIEZvciBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50L3RlbXBsYXRlLCB0aGlzXG4gKiBvYmplY3QgbWFwcyBhIHByb3BlcnR5IG5hbWUgdG8gaXRzIChzdGF0aWMpIHZhbHVlLiBGb3IgYW55IGJpbmRpbmdzLCB0aGlzIG1hcCBzaW1wbHkgbWFwcyB0aGVcbiAqIHByb3BlcnR5IG5hbWUgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnR8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0LlRlbXBsYXRlKToge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9IHtcbiAgY29uc3QgYXR0cmlidXRlc01hcDoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cblxuICBpZiAoZWxPclRwbCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgZWxPclRwbC50YWdOYW1lICE9PSAnbmctdGVtcGxhdGUnKSB7XG4gICAgZWxPclRwbC50ZW1wbGF0ZUF0dHJzLmZvckVhY2goYSA9PiBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSAnJyk7XG4gIH0gZWxzZSB7XG4gICAgZWxPclRwbC5hdHRyaWJ1dGVzLmZvckVhY2goYSA9PiB7XG4gICAgICBpZiAoIWlzSTE4bkF0dHJpYnV0ZShhLm5hbWUpKSB7XG4gICAgICAgIGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBlbE9yVHBsLmlucHV0cy5mb3JFYWNoKGkgPT4ge1xuICAgICAgYXR0cmlidXRlc01hcFtpLm5hbWVdID0gJyc7XG4gICAgfSk7XG4gICAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7XG4gICAgICBhdHRyaWJ1dGVzTWFwW28ubmFtZV0gPSAnJztcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBhdHRyaWJ1dGVzTWFwO1xufVxuXG4vKiogUmV0dXJucyBhIGNhbGwgZXhwcmVzc2lvbiB0byBhIGNoYWluZWQgaW5zdHJ1Y3Rpb24sIGUuZy4gYHByb3BlcnR5KHBhcmFtc1swXSkocGFyYW1zWzFdKWAuICovXG5leHBvcnQgZnVuY3Rpb24gY2hhaW5lZEluc3RydWN0aW9uKFxuICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgY2FsbHM6IG8uRXhwcmVzc2lvbltdW10sIHNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICBsZXQgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pIGFzIG8uRXhwcmVzc2lvbjtcblxuICBpZiAoY2FsbHMubGVuZ3RoID4gMCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHJlc3Npb24gPSBleHByZXNzaW9uLmNhbGxGbihjYWxsc1tpXSwgc3Bhbik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEFkZCBhIGJsYW5rIGludm9jYXRpb24sIGluIGNhc2UgdGhlIGBjYWxsc2AgYXJyYXkgaXMgZW1wdHkuXG4gICAgZXhwcmVzc2lvbiA9IGV4cHJlc3Npb24uY2FsbEZuKFtdLCBzcGFuKTtcbiAgfVxuXG4gIHJldHVybiBleHByZXNzaW9uO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIG51bWJlciBvZiBhcmd1bWVudHMgZXhwZWN0ZWQgdG8gYmUgcGFzc2VkIHRvIGEgZ2VuZXJhdGVkIGluc3RydWN0aW9uIGluIHRoZSBjYXNlIG9mXG4gKiBpbnRlcnBvbGF0aW9uIGluc3RydWN0aW9ucy5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIGludGVycG9sYXRpb24gYXN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIGNvbnN0IHtleHByZXNzaW9ucywgc3RyaW5nc30gPSBpbnRlcnBvbGF0aW9uO1xuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3MubGVuZ3RoID09PSAyICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgLy8gSWYgdGhlIGludGVycG9sYXRpb24gaGFzIG9uZSBpbnRlcnBvbGF0ZWQgdmFsdWUsIGJ1dCB0aGUgcHJlZml4IGFuZCBzdWZmaXggYXJlIGJvdGggZW1wdHlcbiAgICAvLyBzdHJpbmdzLCB3ZSBvbmx5IHBhc3Mgb25lIGFyZ3VtZW50LCB0byBhIHNwZWNpYWwgaW5zdHJ1Y3Rpb24gbGlrZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgb3JcbiAgICAvLyBgdGV4dEludGVycG9sYXRlYC5cbiAgICByZXR1cm4gMTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbnMubGVuZ3RoICsgc3RyaW5ncy5sZW5ndGg7XG4gIH1cbn1cbiJdfQ==