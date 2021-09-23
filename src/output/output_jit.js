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
        define("@angular/compiler/src/output/output_jit", ["require", "exports", "tslib", "@angular/compiler/src/parse_util", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/abstract_js_emitter", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit_trusted_types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.JitEmitterVisitor = exports.JitEvaluator = void 0;
    var tslib_1 = require("tslib");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    var abstract_js_emitter_1 = require("@angular/compiler/src/output/abstract_js_emitter");
    var o = require("@angular/compiler/src/output/output_ast");
    var output_jit_trusted_types_1 = require("@angular/compiler/src/output/output_jit_trusted_types");
    /**
     * A helper class to manage the evaluation of JIT generated code.
     */
    var JitEvaluator = /** @class */ (function () {
        function JitEvaluator() {
        }
        /**
         *
         * @param sourceUrl The URL of the generated code.
         * @param statements An array of Angular statement AST nodes to be evaluated.
         * @param reflector A helper used when converting the statements to executable code.
         * @param createSourceMaps If true then create a source-map for the generated code and include it
         * inline as a source-map comment.
         * @returns A map of all the variables in the generated code.
         */
        JitEvaluator.prototype.evaluateStatements = function (sourceUrl, statements, reflector, createSourceMaps) {
            var converter = new JitEmitterVisitor(reflector);
            var ctx = abstract_emitter_1.EmitterVisitorContext.createRoot();
            // Ensure generated code is in strict mode
            if (statements.length > 0 && !isUseStrictStatement(statements[0])) {
                statements = (0, tslib_1.__spreadArray)([
                    o.literal('use strict').toStmt()
                ], (0, tslib_1.__read)(statements), false);
            }
            converter.visitAllStatements(statements, ctx);
            converter.createReturnStmt(ctx);
            return this.evaluateCode(sourceUrl, ctx, converter.getArgs(), createSourceMaps);
        };
        /**
         * Evaluate a piece of JIT generated code.
         * @param sourceUrl The URL of this generated code.
         * @param ctx A context object that contains an AST of the code to be evaluated.
         * @param vars A map containing the names and values of variables that the evaluated code might
         * reference.
         * @param createSourceMap If true then create a source-map for the generated code and include it
         * inline as a source-map comment.
         * @returns The result of evaluating the code.
         */
        JitEvaluator.prototype.evaluateCode = function (sourceUrl, ctx, vars, createSourceMap) {
            var fnBody = "\"use strict\";" + ctx.toSource() + "\n//# sourceURL=" + sourceUrl;
            var fnArgNames = [];
            var fnArgValues = [];
            for (var argName in vars) {
                fnArgValues.push(vars[argName]);
                fnArgNames.push(argName);
            }
            if (createSourceMap) {
                // using `new Function(...)` generates a header, 1 line of no arguments, 2 lines otherwise
                // E.g. ```
                // function anonymous(a,b,c
                // /**/) { ... }```
                // We don't want to hard code this fact, so we auto detect it via an empty function first.
                var emptyFn = output_jit_trusted_types_1.newTrustedFunctionForJIT.apply(void 0, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(fnArgNames.concat('return null;')), false)).toString();
                var headerLines = emptyFn.slice(0, emptyFn.indexOf('return null;')).split('\n').length - 1;
                fnBody += "\n" + ctx.toSourceMapGenerator(sourceUrl, headerLines).toJsComment();
            }
            var fn = output_jit_trusted_types_1.newTrustedFunctionForJIT.apply(void 0, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(fnArgNames.concat(fnBody)), false));
            return this.executeFunction(fn, fnArgValues);
        };
        /**
         * Execute a JIT generated function by calling it.
         *
         * This method can be overridden in tests to capture the functions that are generated
         * by this `JitEvaluator` class.
         *
         * @param fn A function to execute.
         * @param args The arguments to pass to the function being executed.
         * @returns The return value of the executed function.
         */
        JitEvaluator.prototype.executeFunction = function (fn, args) {
            return fn.apply(void 0, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(args), false));
        };
        return JitEvaluator;
    }());
    exports.JitEvaluator = JitEvaluator;
    /**
     * An Angular AST visitor that converts AST nodes into executable JavaScript code.
     */
    var JitEmitterVisitor = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(JitEmitterVisitor, _super);
        function JitEmitterVisitor(reflector) {
            var _this = _super.call(this) || this;
            _this.reflector = reflector;
            _this._evalArgNames = [];
            _this._evalArgValues = [];
            _this._evalExportedVars = [];
            return _this;
        }
        JitEmitterVisitor.prototype.createReturnStmt = function (ctx) {
            var stmt = new o.ReturnStatement(new o.LiteralMapExpr(this._evalExportedVars.map(function (resultVar) { return new o.LiteralMapEntry(resultVar, o.variable(resultVar), false); })));
            stmt.visitStatement(this, ctx);
        };
        JitEmitterVisitor.prototype.getArgs = function () {
            var result = {};
            for (var i = 0; i < this._evalArgNames.length; i++) {
                result[this._evalArgNames[i]] = this._evalArgValues[i];
            }
            return result;
        };
        JitEmitterVisitor.prototype.visitExternalExpr = function (ast, ctx) {
            this._emitReferenceToExternal(ast, this.reflector.resolveExternalReference(ast.value), ctx);
            return null;
        };
        JitEmitterVisitor.prototype.visitWrappedNodeExpr = function (ast, ctx) {
            this._emitReferenceToExternal(ast, ast.node, ctx);
            return null;
        };
        JitEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) {
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                this._evalExportedVars.push(stmt.name);
            }
            return _super.prototype.visitDeclareVarStmt.call(this, stmt, ctx);
        };
        JitEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                this._evalExportedVars.push(stmt.name);
            }
            return _super.prototype.visitDeclareFunctionStmt.call(this, stmt, ctx);
        };
        JitEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) {
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                this._evalExportedVars.push(stmt.name);
            }
            return _super.prototype.visitDeclareClassStmt.call(this, stmt, ctx);
        };
        JitEmitterVisitor.prototype._emitReferenceToExternal = function (ast, value, ctx) {
            var id = this._evalArgValues.indexOf(value);
            if (id === -1) {
                id = this._evalArgValues.length;
                this._evalArgValues.push(value);
                var name_1 = (0, parse_util_1.identifierName)({ reference: value }) || 'val';
                this._evalArgNames.push("jit_" + name_1 + "_" + id);
            }
            ctx.print(ast, this._evalArgNames[id]);
        };
        return JitEmitterVisitor;
    }(abstract_js_emitter_1.AbstractJsEmitterVisitor));
    exports.JitEmitterVisitor = JitEmitterVisitor;
    function isUseStrictStatement(statement) {
        return statement.isEquivalent(o.literal('use strict').toStmt());
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ppdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2ppdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBR0gsK0RBQTZDO0lBRTdDLGtGQUF5RDtJQUN6RCx3RkFBK0Q7SUFDL0QsMkRBQWtDO0lBQ2xDLGtHQUFvRTtJQUVwRTs7T0FFRztJQUNIO1FBQUE7UUEwRUEsQ0FBQztRQXpFQzs7Ozs7Ozs7V0FRRztRQUNILHlDQUFrQixHQUFsQixVQUNJLFNBQWlCLEVBQUUsVUFBeUIsRUFBRSxTQUEyQixFQUN6RSxnQkFBeUI7WUFDM0IsSUFBTSxTQUFTLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNuRCxJQUFNLEdBQUcsR0FBRyx3Q0FBcUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMvQywwQ0FBMEM7WUFDMUMsSUFBSSxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNqRSxVQUFVO29CQUNSLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxFQUFFO3VDQUM3QixVQUFVLFNBQ2QsQ0FBQzthQUNIO1lBQ0QsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUM5QyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDaEMsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVEOzs7Ozs7Ozs7V0FTRztRQUNILG1DQUFZLEdBQVosVUFDSSxTQUFpQixFQUFF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LGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDeEM7WUFDRCxPQUFPLGlCQUFNLHFCQUFxQixZQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBRU8sb0RBQXdCLEdBQWhDLFVBQWlDLEdBQWlCLEVBQUUsS0FBVSxFQUFFLEdBQTBCO1lBRXhGLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzVDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFO2dCQUNiLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQztnQkFDaEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ2hDLElBQU0sTUFBSSxHQUFHLElBQUEsMkJBQWMsRUFBQyxFQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQztnQkFDekQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBTyxNQUFJLFNBQUksRUFBSSxDQUFDLENBQUM7YUFDOUM7WUFDRCxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUNILHdCQUFDO0lBQUQsQ0FBQyxBQWpFRCxDQUF1Qyw4Q0FBd0IsR0FpRTlEO0lBakVZLDhDQUFpQjtJQW9FOUIsU0FBUyxvQkFBb0IsQ0FBQyxTQUFzQjtRQUNsRCxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge2lkZW50aWZpZXJOYW1lfSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0IHtFbWl0dGVyVmlzaXRvckNvbnRleHR9IGZyb20gJy4vYWJzdHJhY3RfZW1pdHRlcic7XG5pbXBvcnQge0Fic3RyYWN0SnNFbWl0dGVyVmlzaXRvcn0gZnJvbSAnLi9hYnN0cmFjdF9qc19lbWl0dGVyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXRfYXN0JztcbmltcG9ydCB7bmV3VHJ1c3RlZEZ1bmN0aW9uRm9ySklUfSBmcm9tICcuL291dHB1dF9qaXRfdHJ1c3RlZF90eXBlcyc7XG5cbi8qKlxuICogQSBoZWxwZXIgY2xhc3MgdG8gbWFuYWdlIHRoZSBldmFsdWF0aW9uIG9mIEpJVCBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEppdEV2YWx1YXRvciB7XG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlVXJsIFRoZSBVUkwgb2YgdGhlIGdlbmVyYXRlZCBjb2RlLlxuICAgKiBAcGFyYW0gc3RhdGVtZW50cyBBbiBhcnJheSBvZiBBbmd1bGFyIHN0YXRlbWVudCBBU1Qgbm9kZXMgdG8gYmUgZXZhbHVhdGVkLlxuICAgKiBAcGFyYW0gcmVmbGVjdG9yIEEgaGVscGVyIHVzZWQgd2hlbiBjb252ZXJ0aW5nIHRoZSBzdGF0ZW1lbnRzIHRvIGV4ZWN1dGFibGUgY29kZS5cbiAgICogQHBhcmFtIGNyZWF0ZVNvdXJjZU1hcHMgSWYgdHJ1ZSB0aGVuIGNyZWF0ZSBhIHNvdXJjZS1tYXAgZm9yIHRoZSBnZW5lcmF0ZWQgY29kZSBhbmQgaW5jbHVkZSBpdFxuICAgKiBpbmxpbmUgYXMgYSBzb3VyY2UtbWFwIGNvbW1lbnQuXG4gICAqIEByZXR1cm5zIEEgbWFwIG9mIGFsbCB0aGUgdmFyaWFibGVzIGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAgICovXG4gIGV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgIHNvdXJjZVVybDogc3RyaW5nLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBjcmVhdGVTb3VyY2VNYXBzOiBib29sZWFuKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGNvbnN0IGNvbnZlcnRlciA9IG5ldyBKaXRFbWl0dGVyVmlzaXRvcihyZWZsZWN0b3IpO1xuICAgIGNvbnN0IGN0eCA9IEVtaXR0ZXJWaXNpdG9yQ29udGV4dC5jcmVhdGVSb290KCk7XG4gICAgLy8gRW5zdXJlIGdlbmVyYXRlZCBjb2RlIGlzIGluIHN0cmljdCBtb2RlXG4gICAgaWYgKHN0YXRlbWVudHMubGVuZ3RoID4gMCAmJiAhaXNVc2VTdHJpY3RTdGF0ZW1lbnQoc3RhdGVtZW50c1swXSkpIHtcbiAgICAgIHN0YXRlbWVudHMgPSBbXG4gICAgICAgIG8ubGl0ZXJhbCgndXNlIHN0cmljdCcpLnRvU3RtdCgpLFxuICAgICAgICAuLi5zdGF0ZW1lbnRzLFxuICAgICAgXTtcbiAgICB9XG4gICAgY29udmVydGVyLnZpc2l0QWxsU3RhdGVtZW50cyhzdGF0ZW1lbnRzLCBjdHgpO1xuICAgIGNvbnZlcnRlci5jcmVhdGVSZXR1cm5TdG10KGN0eCk7XG4gICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVDb2RlKHNvdXJjZVVybCwgY3R4LCBjb252ZXJ0ZXIuZ2V0QXJncygpLCBjcmVhdGVTb3VyY2VNYXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmFsdWF0ZSBhIHBpZWNlIG9mIEpJVCBnZW5lcmF0ZWQgY29kZS5cbiAgICogQHBhcmFtIHNvdXJjZVVybCBUaGUgVVJMIG9mIHRoaXMgZ2VuZXJhdGVkIGNvZGUuXG4gICAqIEBwYXJhbSBjdHggQSBjb250ZXh0IG9iamVjdCB0aGF0IGNvbnRhaW5zIGFuIEFTVCBvZiB0aGUgY29kZSB0byBiZSBldmFsdWF0ZWQuXG4gICAqIEBwYXJhbSB2YXJzIEEgbWFwIGNvbnRhaW5pbmcgdGhlIG5hbWVzIGFuZCB2YWx1ZXMgb2YgdmFyaWFibGVzIHRoYXQgdGhlIGV2YWx1YXRlZCBjb2RlIG1pZ2h0XG4gICAqIHJlZmVyZW5jZS5cbiAgICogQHBhcmFtIGNyZWF0ZVNvdXJjZU1hcCBJZiB0cnVlIHRoZW4gY3JlYXRlIGEgc291cmNlLW1hcCBmb3IgdGhlIGdlbmVyYXRlZCBjb2RlIGFuZCBpbmNsdWRlIGl0XG4gICAqIGlubGluZSBhcyBhIHNvdXJjZS1tYXAgY29tbWVudC5cbiAgICogQHJldHVybnMgVGhlIHJlc3VsdCBvZiBldmFsdWF0aW5nIHRoZSBjb2RlLlxuICAgKi9cbiAgZXZhbHVhdGVDb2RlKFxuICAgICAgc291cmNlVXJsOiBzdHJpbmcsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0LCB2YXJzOiB7W2tleTogc3RyaW5nXTogYW55fSxcbiAgICAgIGNyZWF0ZVNvdXJjZU1hcDogYm9vbGVhbik6IGFueSB7XG4gICAgbGV0IGZuQm9keSA9IGBcInVzZSBzdHJpY3RcIjske2N0eC50b1NvdXJjZSgpfVxcbi8vIyBzb3VyY2VVUkw9JHtzb3VyY2VVcmx9YDtcbiAgICBjb25zdCBmbkFyZ05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGZuQXJnVmFsdWVzOiBhbnlbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYXJnTmFtZSBpbiB2YXJzKSB7XG4gICAgICBmbkFyZ1ZhbHVlcy5wdXNoKHZhcnNbYXJnTmFtZV0pO1xuICAgICAgZm5BcmdOYW1lcy5wdXNoKGFyZ05hbWUpO1xuICAgIH1cbiAgICBpZiAoY3JlYXRlU291cmNlTWFwKSB7XG4gICAgICAvLyB1c2luZyBgbmV3IEZ1bmN0aW9uKC4uLilgIGdlbmVyYXRlcyBhIGhlYWRlciwgMSBsaW5lIG9mIG5vIGFyZ3VtZW50cywgMiBsaW5lcyBvdGhlcndpc2VcbiAgICAgIC8vIEUuZy4gYGBgXG4gICAgICAvLyBmdW5jdGlvbiBhbm9ueW1vdXMoYSxiLGNcbiAgICAgIC8vIC8qKi8pIHsgLi4uIH1gYGBcbiAgICAgIC8vIFdlIGRvbid0IHdhbnQgdG8gaGFyZCBjb2RlIHRoaXMgZmFjdCwgc28gd2UgYXV0byBkZXRlY3QgaXQgdmlhIGFuIGVtcHR5IGZ1bmN0aW9uIGZpcnN0LlxuICAgICAgY29uc3QgZW1wdHlGbiA9IG5ld1RydXN0ZWRGdW5jdGlvbkZvckpJVCguLi5mbkFyZ05hbWVzLmNvbmNhdCgncmV0dXJuIG51bGw7JykpLnRvU3RyaW5nKCk7XG4gICAgICBjb25zdCBoZWFkZXJMaW5lcyA9IGVtcHR5Rm4uc2xpY2UoMCwgZW1wdHlGbi5pbmRleE9mKCdyZXR1cm4gbnVsbDsnKSkuc3BsaXQoJ1xcbicpLmxlbmd0aCAtIDE7XG4gICAgICBmbkJvZHkgKz0gYFxcbiR7Y3R4LnRvU291cmNlTWFwR2VuZXJhdG9yKHNvdXJjZVVybCwgaGVhZGVyTGluZXMpLnRvSnNDb21tZW50KCl9YDtcbiAgICB9XG4gICAgY29uc3QgZm4gPSBuZXdUcnVzdGVkRnVuY3Rpb25Gb3JKSVQoLi4uZm5BcmdOYW1lcy5jb25jYXQoZm5Cb2R5KSk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZUZ1bmN0aW9uKGZuLCBmbkFyZ1ZhbHVlcyk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSBhIEpJVCBnZW5lcmF0ZWQgZnVuY3Rpb24gYnkgY2FsbGluZyBpdC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgY2FuIGJlIG92ZXJyaWRkZW4gaW4gdGVzdHMgdG8gY2FwdHVyZSB0aGUgZnVuY3Rpb25zIHRoYXQgYXJlIGdlbmVyYXRlZFxuICAgKiBieSB0aGlzIGBKaXRFdmFsdWF0b3JgIGNsYXNzLlxuICAgKlxuICAgKiBAcGFyYW0gZm4gQSBmdW5jdGlvbiB0byBleGVjdXRlLlxuICAgKiBAcGFyYW0gYXJncyBUaGUgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIGZ1bmN0aW9uIGJlaW5nIGV4ZWN1dGVkLlxuICAgKiBAcmV0dXJucyBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBleGVjdXRlZCBmdW5jdGlvbi5cbiAgICovXG4gIGV4ZWN1dGVGdW5jdGlvbihmbjogRnVuY3Rpb24sIGFyZ3M6IGFueVtdKSB7XG4gICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICB9XG59XG5cbi8qKlxuICogQW4gQW5ndWxhciBBU1QgdmlzaXRvciB0aGF0IGNvbnZlcnRzIEFTVCBub2RlcyBpbnRvIGV4ZWN1dGFibGUgSmF2YVNjcmlwdCBjb2RlLlxuICovXG5leHBvcnQgY2xhc3MgSml0RW1pdHRlclZpc2l0b3IgZXh0ZW5kcyBBYnN0cmFjdEpzRW1pdHRlclZpc2l0b3Ige1xuICBwcml2YXRlIF9ldmFsQXJnTmFtZXM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgX2V2YWxBcmdWYWx1ZXM6IGFueVtdID0gW107XG4gIHByaXZhdGUgX2V2YWxFeHBvcnRlZFZhcnM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgY3JlYXRlUmV0dXJuU3RtdChjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCkge1xuICAgIGNvbnN0IHN0bXQgPSBuZXcgby5SZXR1cm5TdGF0ZW1lbnQobmV3IG8uTGl0ZXJhbE1hcEV4cHIodGhpcy5fZXZhbEV4cG9ydGVkVmFycy5tYXAoXG4gICAgICAgIHJlc3VsdFZhciA9PiBuZXcgby5MaXRlcmFsTWFwRW50cnkocmVzdWx0VmFyLCBvLnZhcmlhYmxlKHJlc3VsdFZhciksIGZhbHNlKSkpKTtcbiAgICBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGN0eCk7XG4gIH1cblxuICBnZXRBcmdzKCk6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmFsQXJnTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdFt0aGlzLl9ldmFsQXJnTmFtZXNbaV1dID0gdGhpcy5fZXZhbEFyZ1ZhbHVlc1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogby5FeHRlcm5hbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICB0aGlzLl9lbWl0UmVmZXJlbmNlVG9FeHRlcm5hbChhc3QsIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShhc3QudmFsdWUpLCBjdHgpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgdGhpcy5fZW1pdFJlZmVyZW5jZVRvRXh0ZXJuYWwoYXN0LCBhc3Qubm9kZSwgY3R4KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogby5EZWNsYXJlVmFyU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgdGhpcy5fZXZhbEV4cG9ydGVkVmFycy5wdXNoKHN0bXQubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBzdXBlci52aXNpdERlY2xhcmVWYXJTdG10KHN0bXQsIGN0eCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICB0aGlzLl9ldmFsRXhwb3J0ZWRWYXJzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10LCBjdHgpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICB0aGlzLl9ldmFsRXhwb3J0ZWRWYXJzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10LCBjdHgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW1pdFJlZmVyZW5jZVRvRXh0ZXJuYWwoYXN0OiBvLkV4cHJlc3Npb24sIHZhbHVlOiBhbnksIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTpcbiAgICAgIHZvaWQge1xuICAgIGxldCBpZCA9IHRoaXMuX2V2YWxBcmdWYWx1ZXMuaW5kZXhPZih2YWx1ZSk7XG4gICAgaWYgKGlkID09PSAtMSkge1xuICAgICAgaWQgPSB0aGlzLl9ldmFsQXJnVmFsdWVzLmxlbmd0aDtcbiAgICAgIHRoaXMuX2V2YWxBcmdWYWx1ZXMucHVzaCh2YWx1ZSk7XG4gICAgICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoe3JlZmVyZW5jZTogdmFsdWV9KSB8fCAndmFsJztcbiAgICAgIHRoaXMuX2V2YWxBcmdOYW1lcy5wdXNoKGBqaXRfJHtuYW1lfV8ke2lkfWApO1xuICAgIH1cbiAgICBjdHgucHJpbnQoYXN0LCB0aGlzLl9ldmFsQXJnTmFtZXNbaWRdKTtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIGlzVXNlU3RyaWN0U3RhdGVtZW50KHN0YXRlbWVudDogby5TdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgcmV0dXJuIHN0YXRlbWVudC5pc0VxdWl2YWxlbnQoby5saXRlcmFsKCd1c2Ugc3RyaWN0JykudG9TdG10KCkpO1xufVxuIl19