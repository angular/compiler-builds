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
        define("@angular/compiler/src/render3/util", ["require", "exports", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.wrapReference = exports.jitOnlyGuardedExpression = exports.prepareSyntheticListenerFunctionName = exports.getSyntheticPropertyName = exports.isSyntheticPropertyOrListener = exports.prepareSyntheticListenerName = exports.prepareSyntheticPropertyName = exports.typeWithParameters = exports.convertMetaToOutput = exports.mapToMapExpression = void 0;
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var o = require("@angular/compiler/src/output/output_ast");
    /**
     * Convert an object map with `Expression` values into a `LiteralMapExpr`.
     */
    function mapToMapExpression(map) {
        var result = Object.keys(map).map(function (key) { return ({
            key: key,
            // The assertion here is because really TypeScript doesn't allow us to express that if the
            // key is present, it will have a value, but this is true in reality.
            value: map[key],
            quoted: false,
        }); });
        return o.literalMap(result);
    }
    exports.mapToMapExpression = mapToMapExpression;
    /**
     * Convert metadata into an `Expression` in the given `OutputContext`.
     *
     * This operation will handle arrays, references to symbols, or literal `null` or `undefined`.
     */
    function convertMetaToOutput(meta, ctx) {
        if (Array.isArray(meta)) {
            return o.literalArr(meta.map(function (entry) { return convertMetaToOutput(entry, ctx); }));
        }
        if (meta instanceof static_symbol_1.StaticSymbol) {
            return ctx.importExpr(meta);
        }
        if (meta == null) {
            return o.literal(meta);
        }
        throw new Error("Internal error: Unsupported or unknown metadata: " + meta);
    }
    exports.convertMetaToOutput = convertMetaToOutput;
    function typeWithParameters(type, numParams) {
        var params = null;
        if (numParams > 0) {
            params = [];
            for (var i = 0; i < numParams; i++) {
                params.push(o.DYNAMIC_TYPE);
            }
        }
        return o.expressionType(type, null, params);
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
    function isSyntheticPropertyOrListener(name) {
        return name.charAt(0) == ANIMATE_SYMBOL_PREFIX;
    }
    exports.isSyntheticPropertyOrListener = isSyntheticPropertyOrListener;
    function getSyntheticPropertyName(name) {
        // this will strip out listener phase values...
        // @foo.start => @foo
        var i = name.indexOf('.');
        name = i > 0 ? name.substring(0, i) : name;
        if (name.charAt(0) !== ANIMATE_SYMBOL_PREFIX) {
            name = ANIMATE_SYMBOL_PREFIX + name;
        }
        return name;
    }
    exports.getSyntheticPropertyName = getSyntheticPropertyName;
    function prepareSyntheticListenerFunctionName(name, phase) {
        return "animation_" + name + "_" + phase;
    }
    exports.prepareSyntheticListenerFunctionName = prepareSyntheticListenerFunctionName;
    function jitOnlyGuardedExpression(expr) {
        var ngJitMode = new o.ExternalExpr({ name: 'ngJitMode', moduleName: null });
        var jitFlagNotDefined = new o.BinaryOperatorExpr(o.BinaryOperator.Identical, new o.TypeofExpr(ngJitMode), o.literal('undefined'));
        var jitFlagUndefinedOrTrue = new o.BinaryOperatorExpr(o.BinaryOperator.Or, jitFlagNotDefined, ngJitMode, /* type */ undefined, 
        /* sourceSpan */ undefined, true);
        return new o.BinaryOperatorExpr(o.BinaryOperator.And, jitFlagUndefinedOrTrue, expr);
    }
    exports.jitOnlyGuardedExpression = jitOnlyGuardedExpression;
    function wrapReference(value) {
        var wrapped = new o.WrappedNodeExpr(value);
        return { value: wrapped, type: wrapped };
    }
    exports.wrapReference = wrapReference;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgseUVBQWtEO0lBQ2xELDJEQUEwQztJQUcxQzs7T0FFRztJQUNILFNBQWdCLGtCQUFrQixDQUFDLEdBQTRDO1FBQzdFLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUMvQixVQUFBLEdBQUcsSUFBSSxPQUFBLENBQUM7WUFDTixHQUFHLEtBQUE7WUFDSCwwRkFBMEY7WUFDMUYscUVBQXFFO1lBQ3JFLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFFO1lBQ2hCLE1BQU0sRUFBRSxLQUFLO1NBQ2QsQ0FBQyxFQU5LLENBTUwsQ0FBQyxDQUFDO1FBQ1IsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFWRCxnREFVQztJQUVEOzs7O09BSUc7SUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxJQUFTLEVBQUUsR0FBa0I7UUFDL0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsbUJBQW1CLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUEvQixDQUErQixDQUFDLENBQUMsQ0FBQztTQUN6RTtRQUNELElBQUksSUFBSSxZQUFZLDRCQUFZLEVBQUU7WUFDaEMsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzdCO1FBQ0QsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQ2hCLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN4QjtRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQW9ELElBQU0sQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFaRCxrREFZQztJQUVELFNBQWdCLGtCQUFrQixDQUFDLElBQWtCLEVBQUUsU0FBaUI7UUFDdEUsSUFBSSxNQUFNLEdBQWtCLElBQUksQ0FBQztRQUNqQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUU7WUFDakIsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNaLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzdCO1NBQ0Y7UUFDRCxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBVEQsZ0RBU0M7SUFPRCxJQUFNLHFCQUFxQixHQUFHLEdBQUcsQ0FBQztJQUNsQyxTQUFnQiw0QkFBNEIsQ0FBQyxJQUFZO1FBQ3ZELE9BQU8sS0FBRyxxQkFBcUIsR0FBRyxJQUFNLENBQUM7SUFDM0MsQ0FBQztJQUZELG9FQUVDO0lBRUQsU0FBZ0IsNEJBQTRCLENBQUMsSUFBWSxFQUFFLEtBQWE7UUFDdEUsT0FBTyxLQUFHLHFCQUFxQixHQUFHLElBQUksU0FBSSxLQUFPLENBQUM7SUFDcEQsQ0FBQztJQUZELG9FQUVDO0lBRUQsU0FBZ0IsNkJBQTZCLENBQUMsSUFBWTtRQUN4RCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUkscUJBQXFCLENBQUM7SUFDakQsQ0FBQztJQUZELHNFQUVDO0lBRUQsU0FBZ0Isd0JBQXdCLENBQUMsSUFBWTtRQUNuRCwrQ0FBK0M7UUFDL0MscUJBQXFCO1FBQ3JCLElBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUIsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDM0MsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLHFCQUFxQixFQUFFO1lBQzVDLElBQUksR0FBRyxxQkFBcUIsR0FBRyxJQUFJLENBQUM7U0FDckM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFURCw0REFTQztJQUVELFNBQWdCLG9DQUFvQyxDQUFDLElBQVksRUFBRSxLQUFhO1FBQzlFLE9BQU8sZUFBYSxJQUFJLFNBQUksS0FBTyxDQUFDO0lBQ3RDLENBQUM7SUFGRCxvRkFFQztJQUVELFNBQWdCLHdCQUF3QixDQUFDLElBQWtCO1FBQ3pELElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7UUFDNUUsSUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsQ0FBQyxrQkFBa0IsQ0FDOUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNyRixJQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxDQUFDLGtCQUFrQixDQUNuRCxDQUFDLENBQUMsY0FBYyxDQUFDLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLFNBQVM7UUFDdkUsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sSUFBSSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQVJELDREQVFDO0lBRUQsU0FBZ0IsYUFBYSxDQUFDLEtBQVU7UUFDdEMsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdDLE9BQU8sRUFBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUMsQ0FBQztJQUN6QyxDQUFDO0lBSEQsc0NBR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7T3V0cHV0Q29udGV4dH0gZnJvbSAnLi4vdXRpbCc7XG5cbi8qKlxuICogQ29udmVydCBhbiBvYmplY3QgbWFwIHdpdGggYEV4cHJlc3Npb25gIHZhbHVlcyBpbnRvIGEgYExpdGVyYWxNYXBFeHByYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hcFRvTWFwRXhwcmVzc2lvbihtYXA6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb258dW5kZWZpbmVkfSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCByZXN1bHQgPSBPYmplY3Qua2V5cyhtYXApLm1hcChcbiAgICAgIGtleSA9PiAoe1xuICAgICAgICBrZXksXG4gICAgICAgIC8vIFRoZSBhc3NlcnRpb24gaGVyZSBpcyBiZWNhdXNlIHJlYWxseSBUeXBlU2NyaXB0IGRvZXNuJ3QgYWxsb3cgdXMgdG8gZXhwcmVzcyB0aGF0IGlmIHRoZVxuICAgICAgICAvLyBrZXkgaXMgcHJlc2VudCwgaXQgd2lsbCBoYXZlIGEgdmFsdWUsIGJ1dCB0aGlzIGlzIHRydWUgaW4gcmVhbGl0eS5cbiAgICAgICAgdmFsdWU6IG1hcFtrZXldISxcbiAgICAgICAgcXVvdGVkOiBmYWxzZSxcbiAgICAgIH0pKTtcbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChyZXN1bHQpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgbWV0YWRhdGEgaW50byBhbiBgRXhwcmVzc2lvbmAgaW4gdGhlIGdpdmVuIGBPdXRwdXRDb250ZXh0YC5cbiAqXG4gKiBUaGlzIG9wZXJhdGlvbiB3aWxsIGhhbmRsZSBhcnJheXMsIHJlZmVyZW5jZXMgdG8gc3ltYm9scywgb3IgbGl0ZXJhbCBgbnVsbGAgb3IgYHVuZGVmaW5lZGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0TWV0YVRvT3V0cHV0KG1ldGE6IGFueSwgY3R4OiBPdXRwdXRDb250ZXh0KTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkobWV0YSkpIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKG1ldGEubWFwKGVudHJ5ID0+IGNvbnZlcnRNZXRhVG9PdXRwdXQoZW50cnksIGN0eCkpKTtcbiAgfVxuICBpZiAobWV0YSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgIHJldHVybiBjdHguaW1wb3J0RXhwcihtZXRhKTtcbiAgfVxuICBpZiAobWV0YSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChtZXRhKTtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgZXJyb3I6IFVuc3VwcG9ydGVkIG9yIHVua25vd24gbWV0YWRhdGE6ICR7bWV0YX1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHR5cGVXaXRoUGFyYW1ldGVycyh0eXBlOiBvLkV4cHJlc3Npb24sIG51bVBhcmFtczogbnVtYmVyKTogby5FeHByZXNzaW9uVHlwZSB7XG4gIGxldCBwYXJhbXM6IG8uVHlwZVtdfG51bGwgPSBudWxsO1xuICBpZiAobnVtUGFyYW1zID4gMCkge1xuICAgIHBhcmFtcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtUGFyYW1zOyBpKyspIHtcbiAgICAgIHBhcmFtcy5wdXNoKG8uRFlOQU1JQ19UWVBFKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUodHlwZSwgbnVsbCwgcGFyYW1zKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM1JlZmVyZW5jZSB7XG4gIHZhbHVlOiBvLkV4cHJlc3Npb247XG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcbn1cblxuY29uc3QgQU5JTUFURV9TWU1CT0xfUFJFRklYID0gJ0AnO1xuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBgJHtBTklNQVRFX1NZTUJPTF9QUkVGSVh9JHtuYW1lfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWU6IHN0cmluZywgcGhhc2U6IHN0cmluZykge1xuICByZXR1cm4gYCR7QU5JTUFURV9TWU1CT0xfUFJFRklYfSR7bmFtZX0uJHtwaGFzZX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTeW50aGV0aWNQcm9wZXJ0eU9yTGlzdGVuZXIobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKSA9PSBBTklNQVRFX1NZTUJPTF9QUkVGSVg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTeW50aGV0aWNQcm9wZXJ0eU5hbWUobmFtZTogc3RyaW5nKSB7XG4gIC8vIHRoaXMgd2lsbCBzdHJpcCBvdXQgbGlzdGVuZXIgcGhhc2UgdmFsdWVzLi4uXG4gIC8vIEBmb28uc3RhcnQgPT4gQGZvb1xuICBjb25zdCBpID0gbmFtZS5pbmRleE9mKCcuJyk7XG4gIG5hbWUgPSBpID4gMCA/IG5hbWUuc3Vic3RyaW5nKDAsIGkpIDogbmFtZTtcbiAgaWYgKG5hbWUuY2hhckF0KDApICE9PSBBTklNQVRFX1NZTUJPTF9QUkVGSVgpIHtcbiAgICBuYW1lID0gQU5JTUFURV9TWU1CT0xfUFJFRklYICsgbmFtZTtcbiAgfVxuICByZXR1cm4gbmFtZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShuYW1lOiBzdHJpbmcsIHBoYXNlOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGBhbmltYXRpb25fJHtuYW1lfV8ke3BoYXNlfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBqaXRPbmx5R3VhcmRlZEV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgbmdKaXRNb2RlID0gbmV3IG8uRXh0ZXJuYWxFeHByKHtuYW1lOiAnbmdKaXRNb2RlJywgbW9kdWxlTmFtZTogbnVsbH0pO1xuICBjb25zdCBqaXRGbGFnTm90RGVmaW5lZCA9IG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgIG8uQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsLCBuZXcgby5UeXBlb2ZFeHByKG5nSml0TW9kZSksIG8ubGl0ZXJhbCgndW5kZWZpbmVkJykpO1xuICBjb25zdCBqaXRGbGFnVW5kZWZpbmVkT3JUcnVlID0gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgby5CaW5hcnlPcGVyYXRvci5Pciwgaml0RmxhZ05vdERlZmluZWQsIG5nSml0TW9kZSwgLyogdHlwZSAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBzb3VyY2VTcGFuICovIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoby5CaW5hcnlPcGVyYXRvci5BbmQsIGppdEZsYWdVbmRlZmluZWRPclRydWUsIGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcFJlZmVyZW5jZSh2YWx1ZTogYW55KTogUjNSZWZlcmVuY2Uge1xuICBjb25zdCB3cmFwcGVkID0gbmV3IG8uV3JhcHBlZE5vZGVFeHByKHZhbHVlKTtcbiAgcmV0dXJuIHt2YWx1ZTogd3JhcHBlZCwgdHlwZTogd3JhcHBlZH07XG59Il19