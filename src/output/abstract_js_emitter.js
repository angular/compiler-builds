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
        define("@angular/compiler/src/output/abstract_js_emitter", ["require", "exports", "tslib", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbstractJsEmitterVisitor = void 0;
    var tslib_1 = require("tslib");
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    var o = require("@angular/compiler/src/output/output_ast");
    /**
     * In TypeScript, tagged template functions expect a "template object", which is an array of
     * "cooked" strings plus a `raw` property that contains an array of "raw" strings. This is
     * typically constructed with a function called `__makeTemplateObject(cooked, raw)`, but it may not
     * be available in all environments.
     *
     * This is a JavaScript polyfill that uses __makeTemplateObject when it's available, but otherwise
     * creates an inline helper with the same functionality.
     *
     * In the inline function, if `Object.defineProperty` is available we use that to attach the `raw`
     * array.
     */
    var makeTemplateObjectPolyfill = '(this&&this.__makeTemplateObject||function(e,t){return Object.defineProperty?Object.defineProperty(e,"raw",{value:t}):e.raw=t,e})';
    var AbstractJsEmitterVisitor = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(AbstractJsEmitterVisitor, _super);
        function AbstractJsEmitterVisitor() {
            return _super.call(this, false) || this;
        }
        AbstractJsEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) {
            var _this = this;
            ctx.pushClass(stmt);
            this._visitClassConstructor(stmt, ctx);
            if (stmt.parent != null) {
                ctx.print(stmt, stmt.name + ".prototype = Object.create(");
                stmt.parent.visitExpression(this, ctx);
                ctx.println(stmt, ".prototype);");
            }
            stmt.getters.forEach(function (getter) { return _this._visitClassGetter(stmt, getter, ctx); });
            stmt.methods.forEach(function (method) { return _this._visitClassMethod(stmt, method, ctx); });
            ctx.popClass();
            return null;
        };
        AbstractJsEmitterVisitor.prototype._visitClassConstructor = function (stmt, ctx) {
            ctx.print(stmt, "function " + stmt.name + "(");
            if (stmt.constructorMethod != null) {
                this._visitParams(stmt.constructorMethod.params, ctx);
            }
            ctx.println(stmt, ") {");
            ctx.incIndent();
            if (stmt.constructorMethod != null) {
                if (stmt.constructorMethod.body.length > 0) {
                    ctx.println(stmt, "var self = this;");
                    this.visitAllStatements(stmt.constructorMethod.body, ctx);
                }
            }
            ctx.decIndent();
            ctx.println(stmt, "}");
        };
        AbstractJsEmitterVisitor.prototype._visitClassGetter = function (stmt, getter, ctx) {
            ctx.println(stmt, "Object.defineProperty(" + stmt.name + ".prototype, '" + getter.name + "', { get: function() {");
            ctx.incIndent();
            if (getter.body.length > 0) {
                ctx.println(stmt, "var self = this;");
                this.visitAllStatements(getter.body, ctx);
            }
            ctx.decIndent();
            ctx.println(stmt, "}});");
        };
        AbstractJsEmitterVisitor.prototype._visitClassMethod = function (stmt, method, ctx) {
            ctx.print(stmt, stmt.name + ".prototype." + method.name + " = function(");
            this._visitParams(method.params, ctx);
            ctx.println(stmt, ") {");
            ctx.incIndent();
            if (method.body.length > 0) {
                ctx.println(stmt, "var self = this;");
                this.visitAllStatements(method.body, ctx);
            }
            ctx.decIndent();
            ctx.println(stmt, "};");
        };
        AbstractJsEmitterVisitor.prototype.visitWrappedNodeExpr = function (ast, ctx) {
            throw new Error('Cannot emit a WrappedNodeExpr in Javascript.');
        };
        AbstractJsEmitterVisitor.prototype.visitReadVarExpr = function (ast, ctx) {
            if (ast.builtin === o.BuiltinVar.This) {
                ctx.print(ast, 'self');
            }
            else if (ast.builtin === o.BuiltinVar.Super) {
                throw new Error("'super' needs to be handled at a parent ast node, not at the variable level!");
            }
            else {
                _super.prototype.visitReadVarExpr.call(this, ast, ctx);
            }
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) {
            ctx.print(stmt, "var " + stmt.name);
            if (stmt.value) {
                ctx.print(stmt, ' = ');
                stmt.value.visitExpression(this, ctx);
            }
            ctx.println(stmt, ";");
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitCastExpr = function (ast, ctx) {
            ast.value.visitExpression(this, ctx);
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitInvokeFunctionExpr = function (expr, ctx) {
            var fnExpr = expr.fn;
            if (fnExpr instanceof o.ReadVarExpr && fnExpr.builtin === o.BuiltinVar.Super) {
                ctx.currentClass.parent.visitExpression(this, ctx);
                ctx.print(expr, ".call(this");
                if (expr.args.length > 0) {
                    ctx.print(expr, ", ");
                    this.visitAllExpressions(expr.args, ctx, ',');
                }
                ctx.print(expr, ")");
            }
            else {
                _super.prototype.visitInvokeFunctionExpr.call(this, expr, ctx);
            }
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitTaggedTemplateExpr = function (ast, ctx) {
            var _this = this;
            // The following convoluted piece of code is effectively the downlevelled equivalent of
            // ```
            // tag`...`
            // ```
            // which is effectively like:
            // ```
            // tag(__makeTemplateObject(cooked, raw), expression1, expression2, ...);
            // ```
            var elements = ast.template.elements;
            ast.tag.visitExpression(this, ctx);
            ctx.print(ast, "(" + makeTemplateObjectPolyfill + "(");
            ctx.print(ast, "[" + elements.map(function (part) { return (0, abstract_emitter_1.escapeIdentifier)(part.text, false); }).join(', ') + "], ");
            ctx.print(ast, "[" + elements.map(function (part) { return (0, abstract_emitter_1.escapeIdentifier)(part.rawText, false); }).join(', ') + "])");
            ast.template.expressions.forEach(function (expression) {
                ctx.print(ast, ', ');
                expression.visitExpression(_this, ctx);
            });
            ctx.print(ast, ')');
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitFunctionExpr = function (ast, ctx) {
            ctx.print(ast, "function" + (ast.name ? ' ' + ast.name : '') + "(");
            this._visitParams(ast.params, ctx);
            ctx.println(ast, ") {");
            ctx.incIndent();
            this.visitAllStatements(ast.statements, ctx);
            ctx.decIndent();
            ctx.print(ast, "}");
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
            ctx.print(stmt, "function " + stmt.name + "(");
            this._visitParams(stmt.params, ctx);
            ctx.println(stmt, ") {");
            ctx.incIndent();
            this.visitAllStatements(stmt.statements, ctx);
            ctx.decIndent();
            ctx.println(stmt, "}");
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitTryCatchStmt = function (stmt, ctx) {
            ctx.println(stmt, "try {");
            ctx.incIndent();
            this.visitAllStatements(stmt.bodyStmts, ctx);
            ctx.decIndent();
            ctx.println(stmt, "} catch (" + abstract_emitter_1.CATCH_ERROR_VAR.name + ") {");
            ctx.incIndent();
            var catchStmts = [abstract_emitter_1.CATCH_STACK_VAR.set(abstract_emitter_1.CATCH_ERROR_VAR.prop('stack')).toDeclStmt(null, [
                    o.StmtModifier.Final
                ])].concat(stmt.catchStmts);
            this.visitAllStatements(catchStmts, ctx);
            ctx.decIndent();
            ctx.println(stmt, "}");
            return null;
        };
        AbstractJsEmitterVisitor.prototype.visitLocalizedString = function (ast, ctx) {
            var _this = this;
            // The following convoluted piece of code is effectively the downlevelled equivalent of
            // ```
            // $localize `...`
            // ```
            // which is effectively like:
            // ```
            // $localize(__makeTemplateObject(cooked, raw), expression1, expression2, ...);
            // ```
            ctx.print(ast, "$localize(" + makeTemplateObjectPolyfill + "(");
            var parts = [ast.serializeI18nHead()];
            for (var i = 1; i < ast.messageParts.length; i++) {
                parts.push(ast.serializeI18nTemplatePart(i));
            }
            ctx.print(ast, "[" + parts.map(function (part) { return (0, abstract_emitter_1.escapeIdentifier)(part.cooked, false); }).join(', ') + "], ");
            ctx.print(ast, "[" + parts.map(function (part) { return (0, abstract_emitter_1.escapeIdentifier)(part.raw, false); }).join(', ') + "])");
            ast.expressions.forEach(function (expression) {
                ctx.print(ast, ', ');
                expression.visitExpression(_this, ctx);
            });
            ctx.print(ast, ')');
            return null;
        };
        AbstractJsEmitterVisitor.prototype._visitParams = function (params, ctx) {
            this.visitAllObjects(function (param) { return ctx.print(null, param.name); }, params, ctx, ',');
        };
        AbstractJsEmitterVisitor.prototype.getBuiltinMethodName = function (method) {
            var name;
            switch (method) {
                case o.BuiltinMethod.ConcatArray:
                    name = 'concat';
                    break;
                case o.BuiltinMethod.SubscribeObservable:
                    name = 'subscribe';
                    break;
                case o.BuiltinMethod.Bind:
                    name = 'bind';
                    break;
                default:
                    throw new Error("Unknown builtin method: " + method);
            }
            return name;
        };
        return AbstractJsEmitterVisitor;
    }(abstract_emitter_1.AbstractEmitterVisitor));
    exports.AbstractJsEmitterVisitor = AbstractJsEmitterVisitor;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfanNfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvYWJzdHJhY3RfanNfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBR0gsa0ZBQXFJO0lBQ3JJLDJEQUFrQztJQUVsQzs7Ozs7Ozs7Ozs7T0FXRztJQUNILElBQU0sMEJBQTBCLEdBQzVCLG1JQUFtSSxDQUFDO0lBRXhJO1FBQXVELHlEQUFzQjtRQUMzRTttQkFDRSxrQkFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ1Esd0RBQXFCLEdBQTlCLFVBQStCLElBQWlCLEVBQUUsR0FBMEI7WUFBNUUsaUJBYUM7WUFaQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFFdkMsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksRUFBRTtnQkFDdkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUssSUFBSSxDQUFDLElBQUksZ0NBQTZCLENBQUMsQ0FBQztnQkFDM0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUN2QyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQzthQUNuQztZQUNELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUMsTUFBTSxJQUFLLE9BQUEsS0FBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLEVBQXpDLENBQXlDLENBQUMsQ0FBQztZQUM1RSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQU0sSUFBSyxPQUFBLEtB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QztZQUNqQixRQUFRLE1BQU0sRUFBRTtnQkFDZCxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsV0FBVztvQkFDOUIsSUFBSSxHQUFHLFFBQVEsQ0FBQztvQkFDaEIsTUFBTTtnQkFDUixLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsbUJBQW1CO29CQUN0QyxJQUFJLEdBQUcsV0FBVyxDQUFDO29CQUNuQixNQUFNO2dCQUNSLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJO29CQUN2QixJQUFJLEdBQUcsTUFBTSxDQUFDO29CQUNkLE1BQU07Z0JBQ1I7b0JBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBMkIsTUFBUSxDQUFDLENBQUM7YUFDeEQ7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDSCwrQkFBQztJQUFELENBQUMsQUFqTkQsQ0FBdUQseUNBQXNCLEdBaU41RTtJQWpOcUIsNERBQXdCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtBYnN0cmFjdEVtaXR0ZXJWaXNpdG9yLCBDQVRDSF9FUlJPUl9WQVIsIENBVENIX1NUQUNLX1ZBUiwgRW1pdHRlclZpc2l0b3JDb250ZXh0LCBlc2NhcGVJZGVudGlmaWVyfSBmcm9tICcuL2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuXG4vKipcbiAqIEluIFR5cGVTY3JpcHQsIHRhZ2dlZCB0ZW1wbGF0ZSBmdW5jdGlvbnMgZXhwZWN0IGEgXCJ0ZW1wbGF0ZSBvYmplY3RcIiwgd2hpY2ggaXMgYW4gYXJyYXkgb2ZcbiAqIFwiY29va2VkXCIgc3RyaW5ncyBwbHVzIGEgYHJhd2AgcHJvcGVydHkgdGhhdCBjb250YWlucyBhbiBhcnJheSBvZiBcInJhd1wiIHN0cmluZ3MuIFRoaXMgaXNcbiAqIHR5cGljYWxseSBjb25zdHJ1Y3RlZCB3aXRoIGEgZnVuY3Rpb24gY2FsbGVkIGBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdylgLCBidXQgaXQgbWF5IG5vdFxuICogYmUgYXZhaWxhYmxlIGluIGFsbCBlbnZpcm9ubWVudHMuXG4gKlxuICogVGhpcyBpcyBhIEphdmFTY3JpcHQgcG9seWZpbGwgdGhhdCB1c2VzIF9fbWFrZVRlbXBsYXRlT2JqZWN0IHdoZW4gaXQncyBhdmFpbGFibGUsIGJ1dCBvdGhlcndpc2VcbiAqIGNyZWF0ZXMgYW4gaW5saW5lIGhlbHBlciB3aXRoIHRoZSBzYW1lIGZ1bmN0aW9uYWxpdHkuXG4gKlxuICogSW4gdGhlIGlubGluZSBmdW5jdGlvbiwgaWYgYE9iamVjdC5kZWZpbmVQcm9wZXJ0eWAgaXMgYXZhaWxhYmxlIHdlIHVzZSB0aGF0IHRvIGF0dGFjaCB0aGUgYHJhd2BcbiAqIGFycmF5LlxuICovXG5jb25zdCBtYWtlVGVtcGxhdGVPYmplY3RQb2x5ZmlsbCA9XG4gICAgJyh0aGlzJiZ0aGlzLl9fbWFrZVRlbXBsYXRlT2JqZWN0fHxmdW5jdGlvbihlLHQpe3JldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHk/T2JqZWN0LmRlZmluZVByb3BlcnR5KGUsXCJyYXdcIix7dmFsdWU6dH0pOmUucmF3PXQsZX0pJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0SnNFbWl0dGVyVmlzaXRvciBleHRlbmRzIEFic3RyYWN0RW1pdHRlclZpc2l0b3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihmYWxzZSk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnB1c2hDbGFzcyhzdG10KTtcbiAgICB0aGlzLl92aXNpdENsYXNzQ29uc3RydWN0b3Ioc3RtdCwgY3R4KTtcblxuICAgIGlmIChzdG10LnBhcmVudCAhPSBudWxsKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYCR7c3RtdC5uYW1lfS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGApO1xuICAgICAgc3RtdC5wYXJlbnQudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgICBjdHgucHJpbnRsbihzdG10LCBgLnByb3RvdHlwZSk7YCk7XG4gICAgfVxuICAgIHN0bXQuZ2V0dGVycy5mb3JFYWNoKChnZXR0ZXIpID0+IHRoaXMuX3Zpc2l0Q2xhc3NHZXR0ZXIoc3RtdCwgZ2V0dGVyLCBjdHgpKTtcbiAgICBzdG10Lm1ldGhvZHMuZm9yRWFjaCgobWV0aG9kKSA9PiB0aGlzLl92aXNpdENsYXNzTWV0aG9kKHN0bXQsIG1ldGhvZCwgY3R4KSk7XG4gICAgY3R4LnBvcENsYXNzKCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdENsYXNzQ29uc3RydWN0b3Ioc3RtdDogby5DbGFzc1N0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KSB7XG4gICAgY3R4LnByaW50KHN0bXQsIGBmdW5jdGlvbiAke3N0bXQubmFtZX0oYCk7XG4gICAgaWYgKHN0bXQuY29uc3RydWN0b3JNZXRob2QgIT0gbnVsbCkge1xuICAgICAgdGhpcy5fdmlzaXRQYXJhbXMoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5wYXJhbXMsIGN0eCk7XG4gICAgfVxuICAgIGN0eC5wcmludGxuKHN0bXQsIGApIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgaWYgKHN0bXQuY29uc3RydWN0b3JNZXRob2QgIT0gbnVsbCkge1xuICAgICAgaWYgKHN0bXQuY29uc3RydWN0b3JNZXRob2QuYm9keS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGN0eC5wcmludGxuKHN0bXQsIGB2YXIgc2VsZiA9IHRoaXM7YCk7XG4gICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY29uc3RydWN0b3JNZXRob2QuYm9keSwgY3R4KTtcbiAgICAgIH1cbiAgICB9XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdENsYXNzR2V0dGVyKHN0bXQ6IG8uQ2xhc3NTdG10LCBnZXR0ZXI6IG8uQ2xhc3NHZXR0ZXIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KSB7XG4gICAgY3R4LnByaW50bG4oXG4gICAgICAgIHN0bXQsXG4gICAgICAgIGBPYmplY3QuZGVmaW5lUHJvcGVydHkoJHtzdG10Lm5hbWV9LnByb3RvdHlwZSwgJyR7Z2V0dGVyLm5hbWV9JywgeyBnZXQ6IGZ1bmN0aW9uKCkge2ApO1xuICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICBpZiAoZ2V0dGVyLmJvZHkubGVuZ3RoID4gMCkge1xuICAgICAgY3R4LnByaW50bG4oc3RtdCwgYHZhciBzZWxmID0gdGhpcztgKTtcbiAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGdldHRlci5ib2R5LCBjdHgpO1xuICAgIH1cbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH19KTtgKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0Q2xhc3NNZXRob2Qoc3RtdDogby5DbGFzc1N0bXQsIG1ldGhvZDogby5DbGFzc01ldGhvZCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpIHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYCR7c3RtdC5uYW1lfS5wcm90b3R5cGUuJHttZXRob2QubmFtZX0gPSBmdW5jdGlvbihgKTtcbiAgICB0aGlzLl92aXNpdFBhcmFtcyhtZXRob2QucGFyYW1zLCBjdHgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGApIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgaWYgKG1ldGhvZC5ib2R5Lmxlbmd0aCA+IDApIHtcbiAgICAgIGN0eC5wcmludGxuKHN0bXQsIGB2YXIgc2VsZiA9IHRoaXM7YCk7XG4gICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhtZXRob2QuYm9keSwgY3R4KTtcbiAgICB9XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9O2ApO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZW1pdCBhIFdyYXBwZWROb2RlRXhwciBpbiBKYXZhc2NyaXB0LicpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IG8uUmVhZFZhckV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogc3RyaW5nfG51bGwge1xuICAgIGlmIChhc3QuYnVpbHRpbiA9PT0gby5CdWlsdGluVmFyLlRoaXMpIHtcbiAgICAgIGN0eC5wcmludChhc3QsICdzZWxmJyk7XG4gICAgfSBlbHNlIGlmIChhc3QuYnVpbHRpbiA9PT0gby5CdWlsdGluVmFyLlN1cGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYCdzdXBlcicgbmVlZHMgdG8gYmUgaGFuZGxlZCBhdCBhIHBhcmVudCBhc3Qgbm9kZSwgbm90IGF0IHRoZSB2YXJpYWJsZSBsZXZlbCFgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VwZXIudmlzaXRSZWFkVmFyRXhwcihhc3QsIGN0eCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogby5EZWNsYXJlVmFyU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgdmFyICR7c3RtdC5uYW1lfWApO1xuICAgIGlmIChzdG10LnZhbHVlKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgJyA9ICcpO1xuICAgICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICB9XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYDtgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBvdmVycmlkZSB2aXNpdENhc3RFeHByKGFzdDogby5DYXN0RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBvdmVycmlkZSB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihleHByOiBvLkludm9rZUZ1bmN0aW9uRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBzdHJpbmdcbiAgICAgIHxudWxsIHtcbiAgICBjb25zdCBmbkV4cHIgPSBleHByLmZuO1xuICAgIGlmIChmbkV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByICYmIGZuRXhwci5idWlsdGluID09PSBvLkJ1aWx0aW5WYXIuU3VwZXIpIHtcbiAgICAgIGN0eC5jdXJyZW50Q2xhc3MhLnBhcmVudCEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgICBjdHgucHJpbnQoZXhwciwgYC5jYWxsKHRoaXNgKTtcbiAgICAgIGlmIChleHByLmFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICBjdHgucHJpbnQoZXhwciwgYCwgYCk7XG4gICAgICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhleHByLmFyZ3MsIGN0eCwgJywnKTtcbiAgICAgIH1cbiAgICAgIGN0eC5wcmludChleHByLCBgKWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci52aXNpdEludm9rZUZ1bmN0aW9uRXhwcihleHByLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFRhZ2dlZFRlbXBsYXRlRXhwcihhc3Q6IG8uVGFnZ2VkVGVtcGxhdGVFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgLy8gVGhlIGZvbGxvd2luZyBjb252b2x1dGVkIHBpZWNlIG9mIGNvZGUgaXMgZWZmZWN0aXZlbHkgdGhlIGRvd25sZXZlbGxlZCBlcXVpdmFsZW50IG9mXG4gICAgLy8gYGBgXG4gICAgLy8gdGFnYC4uLmBcbiAgICAvLyBgYGBcbiAgICAvLyB3aGljaCBpcyBlZmZlY3RpdmVseSBsaWtlOlxuICAgIC8vIGBgYFxuICAgIC8vIHRhZyhfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdyksIGV4cHJlc3Npb24xLCBleHByZXNzaW9uMiwgLi4uKTtcbiAgICAvLyBgYGBcbiAgICBjb25zdCBlbGVtZW50cyA9IGFzdC50ZW1wbGF0ZS5lbGVtZW50cztcbiAgICBhc3QudGFnLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGAoJHttYWtlVGVtcGxhdGVPYmplY3RQb2x5ZmlsbH0oYCk7XG4gICAgY3R4LnByaW50KGFzdCwgYFske2VsZW1lbnRzLm1hcChwYXJ0ID0+IGVzY2FwZUlkZW50aWZpZXIocGFydC50ZXh0LCBmYWxzZSkpLmpvaW4oJywgJyl9XSwgYCk7XG4gICAgY3R4LnByaW50KGFzdCwgYFske2VsZW1lbnRzLm1hcChwYXJ0ID0+IGVzY2FwZUlkZW50aWZpZXIocGFydC5yYXdUZXh0LCBmYWxzZSkpLmpvaW4oJywgJyl9XSlgKTtcbiAgICBhc3QudGVtcGxhdGUuZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHtcbiAgICAgIGN0eC5wcmludChhc3QsICcsICcpO1xuICAgICAgZXhwcmVzc2lvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICB9KTtcbiAgICBjdHgucHJpbnQoYXN0LCAnKScpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogby5GdW5jdGlvbkV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgZnVuY3Rpb24ke2FzdC5uYW1lID8gJyAnICsgYXN0Lm5hbWUgOiAnJ30oYCk7XG4gICAgdGhpcy5fdmlzaXRQYXJhbXMoYXN0LnBhcmFtcywgY3R4KTtcbiAgICBjdHgucHJpbnRsbihhc3QsIGApIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoYXN0LnN0YXRlbWVudHMsIGN0eCk7XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludChhc3QsIGB9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgZnVuY3Rpb24gJHtzdG10Lm5hbWV9KGApO1xuICAgIHRoaXMuX3Zpc2l0UGFyYW1zKHN0bXQucGFyYW1zLCBjdHgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGApIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzLCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgfWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IG8uVHJ5Q2F0Y2hTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYHRyeSB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuYm9keVN0bXRzLCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgfSBjYXRjaCAoJHtDQVRDSF9FUlJPUl9WQVIubmFtZX0pIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgY29uc3QgY2F0Y2hTdG10cyA9XG4gICAgICAgIFs8by5TdGF0ZW1lbnQ+Q0FUQ0hfU1RBQ0tfVkFSLnNldChDQVRDSF9FUlJPUl9WQVIucHJvcCgnc3RhY2snKSkudG9EZWNsU3RtdChudWxsLCBbXG4gICAgICAgICAgby5TdG10TW9kaWZpZXIuRmluYWxcbiAgICAgICAgXSldLmNvbmNhdChzdG10LmNhdGNoU3RtdHMpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGNhdGNoU3RtdHMsIGN0eCk7XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdExvY2FsaXplZFN0cmluZyhhc3Q6IG8uTG9jYWxpemVkU3RyaW5nLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgLy8gVGhlIGZvbGxvd2luZyBjb252b2x1dGVkIHBpZWNlIG9mIGNvZGUgaXMgZWZmZWN0aXZlbHkgdGhlIGRvd25sZXZlbGxlZCBlcXVpdmFsZW50IG9mXG4gICAgLy8gYGBgXG4gICAgLy8gJGxvY2FsaXplIGAuLi5gXG4gICAgLy8gYGBgXG4gICAgLy8gd2hpY2ggaXMgZWZmZWN0aXZlbHkgbGlrZTpcbiAgICAvLyBgYGBcbiAgICAvLyAkbG9jYWxpemUoX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpLCBleHByZXNzaW9uMSwgZXhwcmVzc2lvbjIsIC4uLik7XG4gICAgLy8gYGBgXG4gICAgY3R4LnByaW50KGFzdCwgYCRsb2NhbGl6ZSgke21ha2VUZW1wbGF0ZU9iamVjdFBvbHlmaWxsfShgKTtcbiAgICBjb25zdCBwYXJ0cyA9IFthc3Quc2VyaWFsaXplSTE4bkhlYWQoKV07XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBhc3QubWVzc2FnZVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwYXJ0cy5wdXNoKGFzdC5zZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KGkpKTtcbiAgICB9XG4gICAgY3R4LnByaW50KGFzdCwgYFske3BhcnRzLm1hcChwYXJ0ID0+IGVzY2FwZUlkZW50aWZpZXIocGFydC5jb29rZWQsIGZhbHNlKSkuam9pbignLCAnKX1dLCBgKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgWyR7cGFydHMubWFwKHBhcnQgPT4gZXNjYXBlSWRlbnRpZmllcihwYXJ0LnJhdywgZmFsc2UpKS5qb2luKCcsICcpfV0pYCk7XG4gICAgYXN0LmV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB7XG4gICAgICBjdHgucHJpbnQoYXN0LCAnLCAnKTtcbiAgICAgIGV4cHJlc3Npb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgfSk7XG4gICAgY3R4LnByaW50KGFzdCwgJyknKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0UGFyYW1zKHBhcmFtczogby5GblBhcmFtW10sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogdm9pZCB7XG4gICAgdGhpcy52aXNpdEFsbE9iamVjdHMocGFyYW0gPT4gY3R4LnByaW50KG51bGwsIHBhcmFtLm5hbWUpLCBwYXJhbXMsIGN0eCwgJywnKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGdldEJ1aWx0aW5NZXRob2ROYW1lKG1ldGhvZDogby5CdWlsdGluTWV0aG9kKTogc3RyaW5nIHtcbiAgICBsZXQgbmFtZTogc3RyaW5nO1xuICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICBjYXNlIG8uQnVpbHRpbk1ldGhvZC5Db25jYXRBcnJheTpcbiAgICAgICAgbmFtZSA9ICdjb25jYXQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CdWlsdGluTWV0aG9kLlN1YnNjcmliZU9ic2VydmFibGU6XG4gICAgICAgIG5hbWUgPSAnc3Vic2NyaWJlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQnVpbHRpbk1ldGhvZC5CaW5kOlxuICAgICAgICBuYW1lID0gJ2JpbmQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lO1xuICB9XG59XG4iXX0=