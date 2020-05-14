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
        define("@angular/compiler/src/output/abstract_js_emitter", ["require", "exports", "tslib", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbstractJsEmitterVisitor = void 0;
    var tslib_1 = require("tslib");
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    var o = require("@angular/compiler/src/output/output_ast");
    var AbstractJsEmitterVisitor = /** @class */ (function (_super) {
        tslib_1.__extends(AbstractJsEmitterVisitor, _super);
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
            //
            // The `$localize` function expects a "template object", which is an array of "cooked" strings
            // plus a `raw` property that contains an array of "raw" strings.
            //
            // In some environments a helper function called `__makeTemplateObject(cooked, raw)` might be
            // available, in which case we use that. Otherwise we must create our own helper function
            // inline.
            //
            // In the inline function, if `Object.defineProperty` is available we use that to attach the
            // `raw` array.
            ctx.print(ast, '$localize((this&&this.__makeTemplateObject||function(e,t){return Object.defineProperty?Object.defineProperty(e,"raw",{value:t}):e.raw=t,e})(');
            var parts = [ast.serializeI18nHead()];
            for (var i = 1; i < ast.messageParts.length; i++) {
                parts.push(ast.serializeI18nTemplatePart(i));
            }
            ctx.print(ast, "[" + parts.map(function (part) { return abstract_emitter_1.escapeIdentifier(part.cooked, false); }).join(', ') + "], ");
            ctx.print(ast, "[" + parts.map(function (part) { return abstract_emitter_1.escapeIdentifier(part.raw, false); }).join(', ') + "])");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfanNfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvYWJzdHJhY3RfanNfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBR0gsa0ZBQXFJO0lBQ3JJLDJEQUFrQztJQUVsQztRQUF1RCxvREFBc0I7UUFDM0U7bUJBQ0Usa0JBQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELHdEQUFxQixHQUFyQixVQUFzQixJQUFpQixFQUFFLEdBQTBCO1lBQW5FLGlCQWFDO1lBWkMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRXZDLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLEVBQUU7Z0JBQ3ZCLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFLLElBQUksQ0FBQyxJQUFJLGdDQUE2QixDQUFDLENBQUM7Z0JBQzNELElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDdkMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7YUFDbkM7WUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQU0sSUFBSyxPQUFBLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUF6QyxDQUF5QyxDQUFDLENBQUM7WUFDNUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxNQUFNLElBQUssT0FBQSxLQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBekMs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TUFBTSxFQUFFO2dCQUNkLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxXQUFXO29CQUM5QixJQUFJLEdBQUcsUUFBUSxDQUFDO29CQUNoQixNQUFNO2dCQUNSLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxtQkFBbUI7b0JBQ3RDLElBQUksR0FBRyxXQUFXLENBQUM7b0JBQ25CLE1BQU07Z0JBQ1IsS0FBSyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUk7b0JBQ3ZCLElBQUksR0FBRyxNQUFNLENBQUM7b0JBQ2QsTUFBTTtnQkFDUjtvQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLDZCQUEyQixNQUFRLENBQUMsQ0FBQzthQUN4RDtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNILCtCQUFDO0lBQUQsQ0FBQyxBQXZNRCxDQUF1RCx5Q0FBc0IsR0F1TTVFO0lBdk1xQiw0REFBd0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtBYnN0cmFjdEVtaXR0ZXJWaXNpdG9yLCBDQVRDSF9FUlJPUl9WQVIsIENBVENIX1NUQUNLX1ZBUiwgRW1pdHRlclZpc2l0b3JDb250ZXh0LCBlc2NhcGVJZGVudGlmaWVyfSBmcm9tICcuL2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RKc0VtaXR0ZXJWaXNpdG9yIGV4dGVuZHMgQWJzdHJhY3RFbWl0dGVyVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKGZhbHNlKTtcbiAgfVxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogby5DbGFzc1N0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHVzaENsYXNzKHN0bXQpO1xuICAgIHRoaXMuX3Zpc2l0Q2xhc3NDb25zdHJ1Y3RvcihzdG10LCBjdHgpO1xuXG4gICAgaWYgKHN0bXQucGFyZW50ICE9IG51bGwpIHtcbiAgICAgIGN0eC5wcmludChzdG10LCBgJHtzdG10Lm5hbWV9LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoYCk7XG4gICAgICBzdG10LnBhcmVudC52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICAgIGN0eC5wcmludGxuKHN0bXQsIGAucHJvdG90eXBlKTtgKTtcbiAgICB9XG4gICAgc3RtdC5nZXR0ZXJzLmZvckVhY2goKGdldHRlcikgPT4gdGhpcy5fdmlzaXRDbGFzc0dldHRlcihzdG10LCBnZXR0ZXIsIGN0eCkpO1xuICAgIHN0bXQubWV0aG9kcy5mb3JFYWNoKChtZXRob2QpID0+IHRoaXMuX3Zpc2l0Q2xhc3NNZXRob2Qoc3RtdCwgbWV0aG9kLCBjdHgpKTtcbiAgICBjdHgucG9wQ2xhc3MoKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0Q2xhc3NDb25zdHJ1Y3RvcihzdG10OiBvLkNsYXNzU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpIHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYGZ1bmN0aW9uICR7c3RtdC5uYW1lfShgKTtcbiAgICBpZiAoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCAhPSBudWxsKSB7XG4gICAgICB0aGlzLl92aXNpdFBhcmFtcyhzdG10LmNvbnN0cnVjdG9yTWV0aG9kLnBhcmFtcywgY3R4KTtcbiAgICB9XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYCkge2ApO1xuICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICBpZiAoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCAhPSBudWxsKSB7XG4gICAgICBpZiAoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5ib2R5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgY3R4LnByaW50bG4oc3RtdCwgYHZhciBzZWxmID0gdGhpcztgKTtcbiAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5ib2R5LCBjdHgpO1xuICAgICAgfVxuICAgIH1cbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH1gKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0Q2xhc3NHZXR0ZXIoc3RtdDogby5DbGFzc1N0bXQsIGdldHRlcjogby5DbGFzc0dldHRlciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpIHtcbiAgICBjdHgucHJpbnRsbihcbiAgICAgICAgc3RtdCxcbiAgICAgICAgYE9iamVjdC5kZWZpbmVQcm9wZXJ0eSgke3N0bXQubmFtZX0ucHJvdG90eXBlLCAnJHtnZXR0ZXIubmFtZX0nLCB7IGdldDogZnVuY3Rpb24oKSB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIGlmIChnZXR0ZXIuYm9keS5sZW5ndGggPiAwKSB7XG4gICAgICBjdHgucHJpbnRsbihzdG10LCBgdmFyIHNlbGYgPSB0aGlzO2ApO1xuICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoZ2V0dGVyLmJvZHksIGN0eCk7XG4gICAgfVxuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgfX0pO2ApO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRDbGFzc01ldGhvZChzdG10OiBvLkNsYXNzU3RtdCwgbWV0aG9kOiBvLkNsYXNzTWV0aG9kLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCkge1xuICAgIGN0eC5wcmludChzdG10LCBgJHtzdG10Lm5hbWV9LnByb3RvdHlwZS4ke21ldGhvZC5uYW1lfSA9IGZ1bmN0aW9uKGApO1xuICAgIHRoaXMuX3Zpc2l0UGFyYW1zKG1ldGhvZC5wYXJhbXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYCkge2ApO1xuICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICBpZiAobWV0aG9kLmJvZHkubGVuZ3RoID4gMCkge1xuICAgICAgY3R4LnByaW50bG4oc3RtdCwgYHZhciBzZWxmID0gdGhpcztgKTtcbiAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKG1ldGhvZC5ib2R5LCBjdHgpO1xuICAgIH1cbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH07YCk7XG4gIH1cblxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBlbWl0IGEgV3JhcHBlZE5vZGVFeHByIGluIEphdmFzY3JpcHQuJyk7XG4gIH1cblxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogby5SZWFkVmFyRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBzdHJpbmd8bnVsbCB7XG4gICAgaWYgKGFzdC5idWlsdGluID09PSBvLkJ1aWx0aW5WYXIuVGhpcykge1xuICAgICAgY3R4LnByaW50KGFzdCwgJ3NlbGYnKTtcbiAgICB9IGVsc2UgaWYgKGFzdC5idWlsdGluID09PSBvLkJ1aWx0aW5WYXIuU3VwZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgJ3N1cGVyJyBuZWVkcyB0byBiZSBoYW5kbGVkIGF0IGEgcGFyZW50IGFzdCBub2RlLCBub3QgYXQgdGhlIHZhcmlhYmxlIGxldmVsIWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci52aXNpdFJlYWRWYXJFeHByKGFzdCwgY3R4KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KHN0bXQsIGB2YXIgJHtzdG10Lm5hbWV9YCk7XG4gICAgaWYgKHN0bXQudmFsdWUpIHtcbiAgICAgIGN0eC5wcmludChzdG10LCAnID0gJyk7XG4gICAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH1cbiAgICBjdHgucHJpbnRsbihzdG10LCBgO2ApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Q2FzdEV4cHIoYXN0OiBvLkNhc3RFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGV4cHI6IG8uSW52b2tlRnVuY3Rpb25FeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IHN0cmluZ3xudWxsIHtcbiAgICBjb25zdCBmbkV4cHIgPSBleHByLmZuO1xuICAgIGlmIChmbkV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByICYmIGZuRXhwci5idWlsdGluID09PSBvLkJ1aWx0aW5WYXIuU3VwZXIpIHtcbiAgICAgIGN0eC5jdXJyZW50Q2xhc3MhLnBhcmVudCEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgICBjdHgucHJpbnQoZXhwciwgYC5jYWxsKHRoaXNgKTtcbiAgICAgIGlmIChleHByLmFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICBjdHgucHJpbnQoZXhwciwgYCwgYCk7XG4gICAgICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhleHByLmFyZ3MsIGN0eCwgJywnKTtcbiAgICAgIH1cbiAgICAgIGN0eC5wcmludChleHByLCBgKWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci52aXNpdEludm9rZUZ1bmN0aW9uRXhwcihleHByLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IG8uRnVuY3Rpb25FeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYGZ1bmN0aW9uJHthc3QubmFtZSA/ICcgJyArIGFzdC5uYW1lIDogJyd9KGApO1xuICAgIHRoaXMuX3Zpc2l0UGFyYW1zKGFzdC5wYXJhbXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oYXN0LCBgKSB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGFzdC5zdGF0ZW1lbnRzLCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgfWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBvLkRlY2xhcmVGdW5jdGlvblN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYGZ1bmN0aW9uICR7c3RtdC5uYW1lfShgKTtcbiAgICB0aGlzLl92aXNpdFBhcmFtcyhzdG10LnBhcmFtcywgY3R4KTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgKSB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuc3RhdGVtZW50cywgY3R4KTtcbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBvLlRyeUNhdGNoU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB0cnkge2ApO1xuICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmJvZHlTdG10cywgY3R4KTtcbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH0gY2F0Y2ggKCR7Q0FUQ0hfRVJST1JfVkFSLm5hbWV9KSB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIGNvbnN0IGNhdGNoU3RtdHMgPVxuICAgICAgICBbPG8uU3RhdGVtZW50PkNBVENIX1NUQUNLX1ZBUi5zZXQoQ0FUQ0hfRVJST1JfVkFSLnByb3AoJ3N0YWNrJykpLnRvRGVjbFN0bXQobnVsbCwgW1xuICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkZpbmFsXG4gICAgICAgIF0pXS5jb25jYXQoc3RtdC5jYXRjaFN0bXRzKTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhjYXRjaFN0bXRzLCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgfWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBvLkxvY2FsaXplZFN0cmluZywgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIC8vIFRoZSBmb2xsb3dpbmcgY29udm9sdXRlZCBwaWVjZSBvZiBjb2RlIGlzIGVmZmVjdGl2ZWx5IHRoZSBkb3dubGV2ZWxsZWQgZXF1aXZhbGVudCBvZlxuICAgIC8vIGBgYFxuICAgIC8vICRsb2NhbGl6ZSBgLi4uYFxuICAgIC8vIGBgYFxuICAgIC8vIHdoaWNoIGlzIGVmZmVjdGl2ZWx5IGxpa2U6XG4gICAgLy8gYGBgXG4gICAgLy8gJGxvY2FsaXplKF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSwgZXhwcmVzc2lvbjEsIGV4cHJlc3Npb24yLCAuLi4pO1xuICAgIC8vIGBgYFxuICAgIC8vXG4gICAgLy8gVGhlIGAkbG9jYWxpemVgIGZ1bmN0aW9uIGV4cGVjdHMgYSBcInRlbXBsYXRlIG9iamVjdFwiLCB3aGljaCBpcyBhbiBhcnJheSBvZiBcImNvb2tlZFwiIHN0cmluZ3NcbiAgICAvLyBwbHVzIGEgYHJhd2AgcHJvcGVydHkgdGhhdCBjb250YWlucyBhbiBhcnJheSBvZiBcInJhd1wiIHN0cmluZ3MuXG4gICAgLy9cbiAgICAvLyBJbiBzb21lIGVudmlyb25tZW50cyBhIGhlbHBlciBmdW5jdGlvbiBjYWxsZWQgYF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KWAgbWlnaHQgYmVcbiAgICAvLyBhdmFpbGFibGUsIGluIHdoaWNoIGNhc2Ugd2UgdXNlIHRoYXQuIE90aGVyd2lzZSB3ZSBtdXN0IGNyZWF0ZSBvdXIgb3duIGhlbHBlciBmdW5jdGlvblxuICAgIC8vIGlubGluZS5cbiAgICAvL1xuICAgIC8vIEluIHRoZSBpbmxpbmUgZnVuY3Rpb24sIGlmIGBPYmplY3QuZGVmaW5lUHJvcGVydHlgIGlzIGF2YWlsYWJsZSB3ZSB1c2UgdGhhdCB0byBhdHRhY2ggdGhlXG4gICAgLy8gYHJhd2AgYXJyYXkuXG4gICAgY3R4LnByaW50KFxuICAgICAgICBhc3QsXG4gICAgICAgICckbG9jYWxpemUoKHRoaXMmJnRoaXMuX19tYWtlVGVtcGxhdGVPYmplY3R8fGZ1bmN0aW9uKGUsdCl7cmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eT9PYmplY3QuZGVmaW5lUHJvcGVydHkoZSxcInJhd1wiLHt2YWx1ZTp0fSk6ZS5yYXc9dCxlfSkoJyk7XG4gICAgY29uc3QgcGFydHMgPSBbYXN0LnNlcmlhbGl6ZUkxOG5IZWFkKCldO1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgYXN0Lm1lc3NhZ2VQYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgcGFydHMucHVzaChhc3Quc2VyaWFsaXplSTE4blRlbXBsYXRlUGFydChpKSk7XG4gICAgfVxuICAgIGN0eC5wcmludChhc3QsIGBbJHtwYXJ0cy5tYXAocGFydCA9PiBlc2NhcGVJZGVudGlmaWVyKHBhcnQuY29va2VkLCBmYWxzZSkpLmpvaW4oJywgJyl9XSwgYCk7XG4gICAgY3R4LnByaW50KGFzdCwgYFske3BhcnRzLm1hcChwYXJ0ID0+IGVzY2FwZUlkZW50aWZpZXIocGFydC5yYXcsIGZhbHNlKSkuam9pbignLCAnKX1dKWApO1xuICAgIGFzdC5leHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4ge1xuICAgICAgY3R4LnByaW50KGFzdCwgJywgJyk7XG4gICAgICBleHByZXNzaW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH0pO1xuICAgIGN0eC5wcmludChhc3QsICcpJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdFBhcmFtcyhwYXJhbXM6IG8uRm5QYXJhbVtdLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IHZvaWQge1xuICAgIHRoaXMudmlzaXRBbGxPYmplY3RzKHBhcmFtID0+IGN0eC5wcmludChudWxsLCBwYXJhbS5uYW1lKSwgcGFyYW1zLCBjdHgsICcsJyk7XG4gIH1cblxuICBnZXRCdWlsdGluTWV0aG9kTmFtZShtZXRob2Q6IG8uQnVpbHRpbk1ldGhvZCk6IHN0cmluZyB7XG4gICAgbGV0IG5hbWU6IHN0cmluZztcbiAgICBzd2l0Y2ggKG1ldGhvZCkge1xuICAgICAgY2FzZSBvLkJ1aWx0aW5NZXRob2QuQ29uY2F0QXJyYXk6XG4gICAgICAgIG5hbWUgPSAnY29uY2F0JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQnVpbHRpbk1ldGhvZC5TdWJzY3JpYmVPYnNlcnZhYmxlOlxuICAgICAgICBuYW1lID0gJ3N1YnNjcmliZSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJ1aWx0aW5NZXRob2QuQmluZDpcbiAgICAgICAgbmFtZSA9ICdiaW5kJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbHRpbiBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZTtcbiAgfVxufVxuIl19