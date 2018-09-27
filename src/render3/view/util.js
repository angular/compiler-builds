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
        define("@angular/compiler/src/render3/view/util", ["require", "exports", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var o = require("@angular/compiler/src/output/output_ast");
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
    /** Name of the i18n attributes **/
    exports.I18N_ATTR = 'i18n';
    exports.I18N_ATTR_PREFIX = 'i18n-';
    /** I18n separators for metadata **/
    exports.MEANING_SEPARATOR = '|';
    exports.ID_SEPARATOR = '@@';
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
    function isI18NAttribute(name) {
        return name === exports.I18N_ATTR || name.startsWith(exports.I18N_ATTR_PREFIX);
    }
    exports.isI18NAttribute = isI18NAttribute;
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
            return constantPool.getConstLiteral(o.literalArr(query.predicate.map(function (selector) { return o.literal(selector); })));
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUdILDJEQUE2QztJQUs3Qyx1REFBdUQ7SUFDMUMsUUFBQSxjQUFjLEdBQUcsSUFBSSxDQUFDO0lBRW5DLG9FQUFvRTtJQUN2RCxRQUFBLFlBQVksR0FBRyxLQUFLLENBQUM7SUFFbEMsNkRBQTZEO0lBQ2hELFFBQUEsWUFBWSxHQUFHLElBQUksQ0FBQztJQUVqQyxxQ0FBcUM7SUFDeEIsUUFBQSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7SUFFckMsaURBQWlEO0lBQ3BDLFFBQUEsa0JBQWtCLEdBQUcsV0FBVyxDQUFDO0lBRTlDLG1DQUFtQztJQUN0QixRQUFBLFNBQVMsR0FBRyxNQUFNLENBQUM7SUFDbkIsUUFBQSxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7SUFFeEMsb0NBQW9DO0lBQ3ZCLFFBQUEsaUJBQWlCLEdBQUcsR0FBRyxDQUFDO0lBQ3hCLFFBQUEsWUFBWSxHQUFHLElBQUksQ0FBQztJQUVqQyxtQ0FBbUM7SUFDdEIsUUFBQSxpQkFBaUIsR0FBRyxlQUFlLENBQUM7SUFFakQ7Ozs7T0FJRztJQUNILFNBQWdCLGtCQUFrQixDQUFDLFVBQXlCLEVBQUUsSUFBWTtRQUN4RSxJQUFJLElBQUksR0FBdUIsSUFBSSxDQUFDO1FBQ3BDLE9BQU87WUFDTCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLHNCQUFjLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNqRixJQUFJLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUN6QjtZQUNELE9B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QixvQkFBeUI7SUFFekI7UUFBQTtZQUNFLFdBQU0sR0FBMEQsRUFBRSxDQUFDO1FBU3JFLENBQUM7UUFQQywyQkFBRyxHQUFILFVBQUksR0FBVyxFQUFFLEtBQXdCO1lBQ3ZDLElBQUksS0FBSyxFQUFFO2dCQUNULElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxLQUFBLEVBQUUsS0FBSyxPQUFBLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7YUFDL0M7UUFDSCxDQUFDO1FBRUQsb0NBQVksR0FBWixjQUFtQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4RSxvQkFBQztJQUFELENBQUMsQUFWRCxJQVVDO0lBVlksc0NBQWEiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuXG5pbXBvcnQge1IzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqIFRoZSBwcmVmaXggcmVmZXJlbmNlIHZhcmlhYmxlcyAqL1xuZXhwb3J0IGNvbnN0IFJFRkVSRU5DRV9QUkVGSVggPSAnX3InO1xuXG4vKiogVGhlIG5hbWUgb2YgdGhlIGltcGxpY2l0IGNvbnRleHQgcmVmZXJlbmNlICovXG5leHBvcnQgY29uc3QgSU1QTElDSVRfUkVGRVJFTkNFID0gJyRpbXBsaWNpdCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBpMThuIGF0dHJpYnV0ZXMgKiovXG5leHBvcnQgY29uc3QgSTE4Tl9BVFRSID0gJ2kxOG4nO1xuZXhwb3J0IGNvbnN0IEkxOE5fQVRUUl9QUkVGSVggPSAnaTE4bi0nO1xuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmV4cG9ydCBjb25zdCBNRUFOSU5HX1NFUEFSQVRPUiA9ICd8JztcbmV4cG9ydCBjb25zdCBJRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKiogTm9uIGJpbmRhYmxlIGF0dHJpYnV0ZSBuYW1lICoqL1xuZXhwb3J0IGNvbnN0IE5PTl9CSU5EQUJMRV9BVFRSID0gJ25nTm9uQmluZGFibGUnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWxsb2NhdG9yIGZvciBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAqXG4gKiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGlzIGFkZGVkIHRvIHRoZSBzdGF0ZW1lbnRzIHRoZSBmaXJzdCB0aW1lIHRoZSBhbGxvY2F0b3IgaXMgaW52b2tlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeUFsbG9jYXRvcihzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBuYW1lOiBzdHJpbmcpOiAoKSA9PiBvLlJlYWRWYXJFeHByIHtcbiAgbGV0IHRlbXA6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRGVjbGFyZVZhclN0bXQoVEVNUE9SQVJZX05BTUUsIHVuZGVmaW5lZCwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIHRlbXAgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcDtcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gdW5zdXBwb3J0ZWQoZmVhdHVyZTogc3RyaW5nKTogbmV2ZXIge1xuICBpZiAodGhpcykge1xuICAgIHRocm93IG5ldyBFcnJvcihgQnVpbGRlciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBzdXBwb3J0ICR7ZmVhdHVyZX0geWV0YCk7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBGZWF0dXJlICR7ZmVhdHVyZX0gaXMgbm90IHN1cHBvcnRlZCB5ZXRgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludmFsaWQ8VD4oYXJnOiBvLkV4cHJlc3Npb24gfCBvLlN0YXRlbWVudCB8IHQuTm9kZSk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgc3RhdGU6IFZpc2l0b3IgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGRvZXNuJ3QgaGFuZGxlICR7by5jb25zdHJ1Y3Rvci5uYW1lfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNJMThOQXR0cmlidXRlKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PT0gSTE4Tl9BVFRSIHx8IG5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzTGl0ZXJhbCh2YWx1ZTogYW55KTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZS5tYXAoYXNMaXRlcmFsKSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbCh2YWx1ZSwgby5JTkZFUlJFRF9UWVBFKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKGtleXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KTogby5FeHByZXNzaW9ufFxuICAgIG51bGwge1xuICBpZiAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoa2V5cykubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBtYXBUb0V4cHJlc3Npb24oa2V5cyk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXBUb0V4cHJlc3Npb24obWFwOiB7W2tleTogc3RyaW5nXTogYW55fSwgcXVvdGVkID0gZmFsc2UpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5saXRlcmFsTWFwKFxuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWFwKS5tYXAoa2V5ID0+ICh7a2V5LCBxdW90ZWQsIHZhbHVlOiBhc0xpdGVyYWwobWFwW2tleV0pfSkpKTtcbn1cblxuLyoqXG4gKiAgUmVtb3ZlIHRyYWlsaW5nIG51bGwgbm9kZXMgYXMgdGhleSBhcmUgaW1wbGllZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uW10ge1xuICB3aGlsZSAoby5pc051bGwocGFyYW1ldGVyc1twYXJhbWV0ZXJzLmxlbmd0aCAtIDFdKSkge1xuICAgIHBhcmFtZXRlcnMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRRdWVyeVByZWRpY2F0ZShcbiAgICBxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHF1ZXJ5LnByZWRpY2F0ZSkpIHtcbiAgICByZXR1cm4gY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHF1ZXJ5LnByZWRpY2F0ZS5tYXAoc2VsZWN0b3IgPT4gby5saXRlcmFsKHNlbGVjdG9yKSBhcyBvLkV4cHJlc3Npb24pKSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHF1ZXJ5LnByZWRpY2F0ZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmV4cG9ydCBjbGFzcyBEZWZpbml0aW9uTWFwIHtcbiAgdmFsdWVzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbiwgdmFsdWU6IG8uRXhwcmVzc2lvbn1bXSA9IFtdO1xuXG4gIHNldChrZXk6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICB0aGlzLnZhbHVlcy5wdXNoKHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuICB9XG5cbiAgdG9MaXRlcmFsTWFwKCk6IG8uTGl0ZXJhbE1hcEV4cHIgeyByZXR1cm4gby5saXRlcmFsTWFwKHRoaXMudmFsdWVzKTsgfVxufVxuIl19