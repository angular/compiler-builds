/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
        define("@angular/compiler/src/render3/view/util", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/view/i18n"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var i18n_1 = require("@angular/compiler/src/render3/view/i18n");
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
        throw new Error("Invalid state: Visitor " + this.constructor.name + " doesn't handle " + o.constructor.name);
    }
    exports.invalid = invalid;
    function asLiteral(value) {
        if (Array.isArray(value)) {
            return o.literalArr(value.map(asLiteral));
        }
        return o.literal(value, o.INFERRED_TYPE);
    }
    exports.asLiteral = asLiteral;
    function conditionallyCreateMapObjectLiteral(keys) {
        if (Object.getOwnPropertyNames(keys).length > 0) {
            return mapToExpression(keys);
        }
        return null;
    }
    exports.conditionallyCreateMapObjectLiteral = conditionallyCreateMapObjectLiteral;
    function mapToExpression(map, quoted) {
        if (quoted === void 0) { quoted = false; }
        return o.literalMap(Object.getOwnPropertyNames(map).map(function (key) { return ({ key: key, quoted: quoted, value: asLiteral(map[key]) }); }));
    }
    exports.mapToExpression = mapToExpression;
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
    function noop() { }
    exports.noop = noop;
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
        elOrTpl.attributes.forEach(function (a) {
            if (!i18n_1.isI18NAttribute(a.name)) {
                attributesMap[a.name] = a.value;
            }
        });
        elOrTpl.inputs.forEach(function (i) { attributesMap[i.name] = ''; });
        elOrTpl.outputs.forEach(function (o) { attributesMap[o.name] = ''; });
        return attributesMap;
    }
    exports.getAttrsForDirectiveMatching = getAttrsForDirectiveMatching;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFHSCwyREFBNkM7SUFJN0MsZ0VBQXVDO0lBRXZDLHVEQUF1RDtJQUMxQyxRQUFBLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFFbkMsb0VBQW9FO0lBQ3ZELFFBQUEsWUFBWSxHQUFHLEtBQUssQ0FBQztJQUVsQyw2REFBNkQ7SUFDaEQsUUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFDO0lBRWpDLHFDQUFxQztJQUN4QixRQUFBLGdCQUFnQixHQUFHLElBQUksQ0FBQztJQUVyQyxpREFBaUQ7SUFDcEMsUUFBQSxrQkFBa0IsR0FBRyxXQUFXLENBQUM7SUFFOUMsbUNBQW1DO0lBQ3RCLFFBQUEsaUJBQWlCLEdBQUcsZUFBZSxDQUFDO0lBRWpEOzs7O09BSUc7SUFDSCxTQUFnQixrQkFBa0IsQ0FBQyxVQUF5QixFQUFFLElBQVk7UUFDeEUsSUFBSSxJQUFJLEdBQXVCLElBQUksQ0FBQztRQUNwQyxPQUFPO1lBQ0wsSUFBSSxDQUFDLElBQUksRUFBRTtnQkFDVCxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxzQkFBYyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDakYsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDekI7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFURCxnREFTQztJQUdELFNBQWdCLFdBQVcsQ0FBQyxPQUFlO1FBQ3pDLElBQUksSUFBSSxFQUFFO1lBQ1IsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFXLElBQUksQ0FBQyxXQUFX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c291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcblxuaW1wb3J0IHtSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7aXNJMThOQXR0cmlidXRlfSBmcm9tICcuL2kxOG4nO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqIFRoZSBwcmVmaXggcmVmZXJlbmNlIHZhcmlhYmxlcyAqL1xuZXhwb3J0IGNvbnN0IFJFRkVSRU5DRV9QUkVGSVggPSAnX3InO1xuXG4vKiogVGhlIG5hbWUgb2YgdGhlIGltcGxpY2l0IGNvbnRleHQgcmVmZXJlbmNlICovXG5leHBvcnQgY29uc3QgSU1QTElDSVRfUkVGRVJFTkNFID0gJyRpbXBsaWNpdCc7XG5cbi8qKiBOb24gYmluZGFibGUgYXR0cmlidXRlIG5hbWUgKiovXG5leHBvcnQgY29uc3QgTk9OX0JJTkRBQkxFX0FUVFIgPSAnbmdOb25CaW5kYWJsZSc7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhbGxvY2F0b3IgZm9yIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICpcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gaXMgYWRkZWQgdG8gdGhlIHN0YXRlbWVudHMgdGhlIGZpcnN0IHRpbWUgdGhlIGFsbG9jYXRvciBpcyBpbnZva2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIG5hbWU6IHN0cmluZyk6ICgpID0+IG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5EZWNsYXJlVmFyU3RtdChURU1QT1JBUllfTkFNRSwgdW5kZWZpbmVkLCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgdGVtcCA9IG8udmFyaWFibGUobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wO1xuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiB1bnN1cHBvcnRlZChmZWF0dXJlOiBzdHJpbmcpOiBuZXZlciB7XG4gIGlmICh0aGlzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBCdWlsZGVyICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IHN1cHBvcnQgJHtmZWF0dXJlfSB5ZXRgKTtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYEZlYXR1cmUgJHtmZWF0dXJlfSBpcyBub3Qgc3VwcG9ydGVkIHlldGApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW52YWxpZDxUPihhcmc6IG8uRXhwcmVzc2lvbiB8IG8uU3RhdGVtZW50IHwgdC5Ob2RlKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBzdGF0ZTogVmlzaXRvciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBoYW5kbGUgJHtvLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0xpdGVyYWwodmFsdWU6IGFueSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIodmFsdWUubWFwKGFzTGl0ZXJhbCkpO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWwodmFsdWUsIG8uSU5GRVJSRURfVFlQRSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChrZXlzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW119KTpcbiAgICBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhrZXlzKS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG1hcFRvRXhwcmVzc2lvbihrZXlzKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcFRvRXhwcmVzc2lvbihtYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBxdW90ZWQgPSBmYWxzZSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmxpdGVyYWxNYXAoXG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtYXApLm1hcChrZXkgPT4gKHtrZXksIHF1b3RlZCwgdmFsdWU6IGFzTGl0ZXJhbChtYXBba2V5XSl9KSkpO1xufVxuXG4vKipcbiAqICBSZW1vdmUgdHJhaWxpbmcgbnVsbCBub2RlcyBhcyB0aGV5IGFyZSBpbXBsaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHdoaWxlIChvLmlzTnVsbChwYXJhbWV0ZXJzW3BhcmFtZXRlcnMubGVuZ3RoIC0gMV0pKSB7XG4gICAgcGFyYW1ldGVycy5wb3AoKTtcbiAgfVxuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFF1ZXJ5UHJlZGljYXRlKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKSkge1xuICAgIGxldCBwcmVkaWNhdGU6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgcXVlcnkucHJlZGljYXRlLmZvckVhY2goKHNlbGVjdG9yOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIC8vIEVhY2ggaXRlbSBpbiBwcmVkaWNhdGVzIGFycmF5IG1heSBjb250YWluIHN0cmluZ3Mgd2l0aCBjb21tYS1zZXBhcmF0ZWQgcmVmc1xuICAgICAgLy8gKGZvciBleC4gJ3JlZiwgcmVmMSwgLi4uLCByZWZOJyksIHRodXMgd2UgZXh0cmFjdCBpbmRpdmlkdWFsIHJlZnMgYW5kIHN0b3JlIHRoZW1cbiAgICAgIC8vIGFzIHNlcGFyYXRlIGFycmF5IGVudGl0aWVzXG4gICAgICBjb25zdCBzZWxlY3RvcnMgPSBzZWxlY3Rvci5zcGxpdCgnLCcpLm1hcCh0b2tlbiA9PiBvLmxpdGVyYWwodG9rZW4udHJpbSgpKSk7XG4gICAgICBwcmVkaWNhdGUucHVzaCguLi5zZWxlY3RvcnMpO1xuICAgIH0pO1xuICAgIHJldHVybiBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihwcmVkaWNhdGUpLCB0cnVlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcXVlcnkucHJlZGljYXRlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub29wKCkge31cblxuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXAge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIHRoaXMudmFsdWVzLnB1c2goe2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG4gIH1cblxuICB0b0xpdGVyYWxNYXAoKTogby5MaXRlcmFsTWFwRXhwciB7IHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpOyB9XG59XG5cbi8qKlxuICogRXh0cmFjdCBhIG1hcCBvZiBwcm9wZXJ0aWVzIHRvIHZhbHVlcyBmb3IgYSBnaXZlbiBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUsIHdoaWNoIGNhbiBiZSB1c2VkXG4gKiBieSB0aGUgZGlyZWN0aXZlIG1hdGNoaW5nIG1hY2hpbmVyeS5cbiAqXG4gKiBAcGFyYW0gZWxPclRwbCB0aGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBpbiBxdWVzdGlvblxuICogQHJldHVybiBhbiBvYmplY3Qgc2V0IHVwIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuIEZvciBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50L3RlbXBsYXRlLCB0aGlzXG4gKiBvYmplY3QgbWFwcyBhIHByb3BlcnR5IG5hbWUgdG8gaXRzIChzdGF0aWMpIHZhbHVlLiBGb3IgYW55IGJpbmRpbmdzLCB0aGlzIG1hcCBzaW1wbHkgbWFwcyB0aGVcbiAqIHByb3BlcnR5IG5hbWUgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnQgfCB0LlRlbXBsYXRlKTpcbiAgICB7W25hbWU6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBhdHRyaWJ1dGVzTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICBpZiAoIWlzSTE4TkF0dHJpYnV0ZShhLm5hbWUpKSB7XG4gICAgICBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgIH1cbiAgfSk7XG4gIGVsT3JUcGwuaW5wdXRzLmZvckVhY2goaSA9PiB7IGF0dHJpYnV0ZXNNYXBbaS5uYW1lXSA9ICcnOyB9KTtcbiAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7IGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnOyB9KTtcblxuICByZXR1cm4gYXR0cmlidXRlc01hcDtcbn1cbiJdfQ==