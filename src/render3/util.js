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
        define("@angular/compiler/src/render3/util", ["require", "exports", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.refsToArray = exports.wrapReference = exports.guardedExpression = exports.devOnlyGuardedExpression = exports.jitOnlyGuardedExpression = exports.prepareSyntheticListenerFunctionName = exports.getSafePropertyAccessString = exports.prepareSyntheticListenerName = exports.prepareSyntheticPropertyName = exports.typeWithParameters = void 0;
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    var o = require("@angular/compiler/src/output/output_ast");
    function typeWithParameters(type, numParams) {
        if (numParams === 0) {
            return o.expressionType(type);
        }
        var params = [];
        for (var i = 0; i < numParams; i++) {
            params.push(o.DYNAMIC_TYPE);
        }
        return o.expressionType(type, undefined, params);
    }
    exports.typeWithParameters = typeWithParameters;
    var ANIMATE_SYMBOL_PREFIX = '@';
    function prepareSyntheticPropertyName(name) {
        return "" + ANIMATE_SYMBOL_PREFIX + name;
    }
    exports.prepareSyntheticPropertyName = prepareSyntheticPropertyName;
    function prepareSyntheticListenerName(name, phase) {
        return "" + ANIMATE_SYMBOL_PREFIX + name + "." + phase;
    }
    exports.prepareSyntheticListenerName = prepareSyntheticListenerName;
    function getSafePropertyAccessString(accessor, name) {
        var escapedName = (0, abstract_emitter_1.escapeIdentifier)(name, false, false);
        return escapedName !== name ? accessor + "[" + escapedName + "]" : accessor + "." + name;
    }
    exports.getSafePropertyAccessString = getSafePropertyAccessString;
    function prepareSyntheticListenerFunctionName(name, phase) {
        return "animation_" + name + "_" + phase;
    }
    exports.prepareSyntheticListenerFunctionName = prepareSyntheticListenerFunctionName;
    function jitOnlyGuardedExpression(expr) {
        return guardedExpression('ngJitMode', expr);
    }
    exports.jitOnlyGuardedExpression = jitOnlyGuardedExpression;
    function devOnlyGuardedExpression(expr) {
        return guardedExpression('ngDevMode', expr);
    }
    exports.devOnlyGuardedExpression = devOnlyGuardedExpression;
    function guardedExpression(guard, expr) {
        var guardExpr = new o.ExternalExpr({ name: guard, moduleName: null });
        var guardNotDefined = new o.BinaryOperatorExpr(o.BinaryOperator.Identical, new o.TypeofExpr(guardExpr), o.literal('undefined'));
        var guardUndefinedOrTrue = new o.BinaryOperatorExpr(o.BinaryOperator.Or, guardNotDefined, guardExpr, /* type */ undefined, 
        /* sourceSpan */ undefined, true);
        return new o.BinaryOperatorExpr(o.BinaryOperator.And, guardUndefinedOrTrue, expr);
    }
    exports.guardedExpression = guardedExpression;
    function wrapReference(value) {
        var wrapped = new o.WrappedNodeExpr(value);
        return { value: wrapped, type: wrapped };
    }
    exports.wrapReference = wrapReference;
    function refsToArray(refs, shouldForwardDeclare) {
        var values = o.literalArr(refs.map(function (ref) { return ref.value; }));
        return shouldForwardDeclare ? o.fn([], [new o.ReturnStatement(values)]) : values;
    }
    exports.refsToArray = refsToArray;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsa0ZBQTREO0lBQzVELDJEQUEwQztJQUUxQyxTQUFnQixrQkFBa0IsQ0FBQyxJQUFrQixFQUFFLFNBQWlCO1FBQ3RFLElBQUksU0FBUyxLQUFLLENBQUMsRUFBRTtZQUNuQixPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDL0I7UUFDRCxJQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7UUFDNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUM3QjtRQUNELE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFURCxnREFTQztJQWdCRCxJQUFNLHFCQUFxQixHQUFHLEdBQUcsQ0FBQztJQUNsQyxTQUFnQiw0QkFBNEIsQ0FBQyxJQUFZO1FBQ3ZELE9BQU8sS0FBRyxxQkFBcUIsR0FBRyxJQUFNLENBQUM7SUFDM0MsQ0FBQztJQUZELG9FQUVDO0lBRUQsU0FBZ0IsNEJBQTRCLENBQUMsSUFBWSxFQUFFLEtBQWE7UUFDdEUsT0FBTyxLQUFHLHFCQUFxQixHQUFHLElBQUksU0FBSSxLQUFPLENBQUM7SUFDcEQsQ0FBQztJQUZELG9FQUVDO0lBRUQsU0FBZ0IsMkJBQTJCLENBQUMsUUFBZ0IsRUFBRSxJQUFZO1FBQ3hFLElBQU0sV0FBVyxHQUFHLElBQUEsbUNBQWdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN6RCxPQUFPLFdBQVcsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFJLFFBQVEsU0FBSSxXQUFXLE1BQUcsQ0FBQyxDQUFDLENBQUksUUFBUSxTQUFJLElBQU0sQ0FBQztJQUN0RixDQUFDO0lBSEQsa0VBR0M7SUFFRCxTQUFnQixvQ0FBb0MsQ0FBQyxJQUFZLEVBQUUsS0FBYTtRQUM5RSxPQUFPLGVBQWEsSUFBSSxTQUFJLEtBQU8sQ0FBQztJQUN0QyxDQUFDO0lBRkQsb0ZBRUM7SUFFRCxTQUFnQix3QkFBd0IsQ0FBQyxJQUFrQjtRQUN6RCxPQUFPLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRkQsNERBRUM7SUFFRCxTQUFnQix3QkFBd0IsQ0FBQyxJQUFrQjtRQUN6RCxPQUFPLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRkQsNERBRUM7SUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxLQUFhLEVBQUUsSUFBa0I7UUFDakUsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztRQUN0RSxJQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsQ0FBQyxrQkFBa0IsQ0FDNUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNyRixJQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxDQUFDLGtCQUFrQixDQUNqRCxDQUFDLENBQUMsY0FBYyxDQUFDLEVBQUUsRUFBRSxlQUFlLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxTQUFTO1FBQ3JFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLG9CQUFvQixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFSRCw4Q0FRQztJQUVELFNBQWdCLGFBQWEsQ0FBQyxLQUFVO1FBQ3RDLElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxPQUFPLEVBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7SUFDekMsQ0FBQztJQUhELHNDQUdDO0lBRUQsU0FBZ0IsV0FBVyxDQUFDLElBQW1CLEVBQUUsb0JBQTZCO1FBQzVFLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLEdBQUcsQ0FBQyxLQUFLLEVBQVQsQ0FBUyxDQUFDLENBQUMsQ0FBQztRQUN4RCxPQUFPLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNuRixDQUFDO0lBSEQsa0NBR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtlc2NhcGVJZGVudGlmaWVyfSBmcm9tICcuLi9vdXRwdXQvYWJzdHJhY3RfZW1pdHRlcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuZXhwb3J0IGZ1bmN0aW9uIHR5cGVXaXRoUGFyYW1ldGVycyh0eXBlOiBvLkV4cHJlc3Npb24sIG51bVBhcmFtczogbnVtYmVyKTogby5FeHByZXNzaW9uVHlwZSB7XG4gIGlmIChudW1QYXJhbXMgPT09IDApIHtcbiAgICByZXR1cm4gby5leHByZXNzaW9uVHlwZSh0eXBlKTtcbiAgfVxuICBjb25zdCBwYXJhbXM6IG8uVHlwZVtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtUGFyYW1zOyBpKyspIHtcbiAgICBwYXJhbXMucHVzaChvLkRZTkFNSUNfVFlQRSk7XG4gIH1cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUodHlwZSwgdW5kZWZpbmVkLCBwYXJhbXMpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzUmVmZXJlbmNlIHtcbiAgdmFsdWU6IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5FeHByZXNzaW9uO1xufVxuXG4vKipcbiAqIFJlc3VsdCBvZiBjb21waWxhdGlvbiBvZiBhIHJlbmRlcjMgY29kZSB1bml0LCBlLmcuIGNvbXBvbmVudCwgZGlyZWN0aXZlLCBwaXBlLCBldGMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uVHlwZTtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbn1cblxuY29uc3QgQU5JTUFURV9TWU1CT0xfUFJFRklYID0gJ0AnO1xuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBgJHtBTklNQVRFX1NZTUJPTF9QUkVGSVh9JHtuYW1lfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWU6IHN0cmluZywgcGhhc2U6IHN0cmluZykge1xuICByZXR1cm4gYCR7QU5JTUFURV9TWU1CT0xfUFJFRklYfSR7bmFtZX0uJHtwaGFzZX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nKGFjY2Vzc29yOiBzdHJpbmcsIG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGVzY2FwZWROYW1lID0gZXNjYXBlSWRlbnRpZmllcihuYW1lLCBmYWxzZSwgZmFsc2UpO1xuICByZXR1cm4gZXNjYXBlZE5hbWUgIT09IG5hbWUgPyBgJHthY2Nlc3Nvcn1bJHtlc2NhcGVkTmFtZX1dYCA6IGAke2FjY2Vzc29yfS4ke25hbWV9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShuYW1lOiBzdHJpbmcsIHBoYXNlOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGBhbmltYXRpb25fJHtuYW1lfV8ke3BoYXNlfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBqaXRPbmx5R3VhcmRlZEV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGd1YXJkZWRFeHByZXNzaW9uKCduZ0ppdE1vZGUnLCBleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldk9ubHlHdWFyZGVkRXhwcmVzc2lvbihleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gZ3VhcmRlZEV4cHJlc3Npb24oJ25nRGV2TW9kZScsIGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ3VhcmRlZEV4cHJlc3Npb24oZ3VhcmQ6IHN0cmluZywgZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgZ3VhcmRFeHByID0gbmV3IG8uRXh0ZXJuYWxFeHByKHtuYW1lOiBndWFyZCwgbW9kdWxlTmFtZTogbnVsbH0pO1xuICBjb25zdCBndWFyZE5vdERlZmluZWQgPSBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCwgbmV3IG8uVHlwZW9mRXhwcihndWFyZEV4cHIpLCBvLmxpdGVyYWwoJ3VuZGVmaW5lZCcpKTtcbiAgY29uc3QgZ3VhcmRVbmRlZmluZWRPclRydWUgPSBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICBvLkJpbmFyeU9wZXJhdG9yLk9yLCBndWFyZE5vdERlZmluZWQsIGd1YXJkRXhwciwgLyogdHlwZSAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBzb3VyY2VTcGFuICovIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoby5CaW5hcnlPcGVyYXRvci5BbmQsIGd1YXJkVW5kZWZpbmVkT3JUcnVlLCBleHByKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBSZWZlcmVuY2UodmFsdWU6IGFueSk6IFIzUmVmZXJlbmNlIHtcbiAgY29uc3Qgd3JhcHBlZCA9IG5ldyBvLldyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmc1RvQXJyYXkocmVmczogUjNSZWZlcmVuY2VbXSwgc2hvdWxkRm9yd2FyZERlY2xhcmU6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB2YWx1ZXMgPSBvLmxpdGVyYWxBcnIocmVmcy5tYXAocmVmID0+IHJlZi52YWx1ZSkpO1xuICByZXR1cm4gc2hvdWxkRm9yd2FyZERlY2xhcmUgPyBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHZhbHVlcyldKSA6IHZhbHVlcztcbn1cbiJdfQ==