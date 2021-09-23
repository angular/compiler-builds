(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/output/output_interpreter", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/ts_emitter"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.interpretStatements = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var ts_emitter_1 = require("@angular/compiler/src/output/ts_emitter");
    function interpretStatements(statements, reflector) {
        var ctx = new _ExecutionContext(null, null, null, new Map());
        var visitor = new StatementInterpreter(reflector);
        visitor.visitAllStatements(statements, ctx);
        var result = {};
        ctx.exports.forEach(function (exportName) {
            result[exportName] = ctx.vars.get(exportName);
        });
        return result;
    }
    exports.interpretStatements = interpretStatements;
    function _executeFunctionStatements(varNames, varValues, statements, ctx, visitor) {
        var childCtx = ctx.createChildWihtLocalVars();
        for (var i = 0; i < varNames.length; i++) {
            childCtx.vars.set(varNames[i], varValues[i]);
        }
        var result = visitor.visitAllStatements(statements, childCtx);
        return result ? result.value : null;
    }
    var _ExecutionContext = /** @class */ (function () {
        function _ExecutionContext(parent, instance, className, vars) {
            this.parent = parent;
            this.instance = instance;
            this.className = className;
            this.vars = vars;
            this.exports = [];
        }
        _ExecutionContext.prototype.createChildWihtLocalVars = function () {
            return new _ExecutionContext(this, this.instance, this.className, new Map());
        };
        return _ExecutionContext;
    }());
    var ReturnValue = /** @class */ (function () {
        function ReturnValue(value) {
            this.value = value;
        }
        return ReturnValue;
    }());
    function createDynamicClass(_classStmt, _ctx, _visitor) {
        var propertyDescriptors = {};
        _classStmt.getters.forEach(function (getter) {
            // Note: use `function` instead of arrow function to capture `this`
            propertyDescriptors[getter.name] = {
                configurable: false,
                get: function () {
                    var instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                    return _executeFunctionStatements([], [], getter.body, instanceCtx, _visitor);
                }
            };
        });
        _classStmt.methods.forEach(function (method) {
            var paramNames = method.params.map(function (param) { return param.name; });
            // Note: use `function` instead of arrow function to capture `this`
            propertyDescriptors[method.name] = {
                writable: false,
                configurable: false,
                value: function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    var instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                    return _executeFunctionStatements(paramNames, args, method.body, instanceCtx, _visitor);
                }
            };
        });
        var ctorParamNames = _classStmt.constructorMethod.params.map(function (param) { return param.name; });
        // Note: use `function` instead of arrow function to capture `this`
        var ctor = function () {
            var _this = this;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
            _classStmt.fields.forEach(function (field) {
                _this[field.name] = undefined;
            });
            _executeFunctionStatements(ctorParamNames, args, _classStmt.constructorMethod.body, instanceCtx, _visitor);
        };
        var superClass = _classStmt.parent ? _classStmt.parent.visitExpression(_visitor, _ctx) : Object;
        ctor.prototype = Object.create(superClass.prototype, propertyDescriptors);
        return ctor;
    }
    var StatementInterpreter = /** @class */ (function () {
        function StatementInterpreter(reflector) {
            this.reflector = reflector;
        }
        StatementInterpreter.prototype.debugAst = function (ast) {
            return (0, ts_emitter_1.debugOutputAstAsTypeScript)(ast);
        };
        StatementInterpreter.prototype.visitDeclareVarStmt = function (stmt, ctx) {
            var initialValue = stmt.value ? stmt.value.visitExpression(this, ctx) : undefined;
            ctx.vars.set(stmt.name, initialValue);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.exports.push(stmt.name);
            }
            return null;
        };
        StatementInterpreter.prototype.visitWriteVarExpr = function (expr, ctx) {
            var value = expr.value.visitExpression(this, ctx);
            var currCtx = ctx;
            while (currCtx != null) {
                if (currCtx.vars.has(expr.name)) {
                    currCtx.vars.set(expr.name, value);
                    return value;
                }
                currCtx = currCtx.parent;
            }
            throw new Error("Not declared variable " + expr.name);
        };
        StatementInterpreter.prototype.visitWrappedNodeExpr = function (ast, ctx) {
            throw new Error('Cannot interpret a WrappedNodeExpr.');
        };
        StatementInterpreter.prototype.visitTypeofExpr = function (ast, ctx) {
            throw new Error('Cannot interpret a TypeofExpr');
        };
        StatementInterpreter.prototype.visitReadVarExpr = function (ast, ctx) {
            var varName = ast.name;
            if (ast.builtin != null) {
                switch (ast.builtin) {
                    case o.BuiltinVar.Super:
                        return Object.getPrototypeOf(ctx.instance);
                    case o.BuiltinVar.This:
                        return ctx.instance;
                    case o.BuiltinVar.CatchError:
                        varName = CATCH_ERROR_VAR;
                        break;
                    case o.BuiltinVar.CatchStack:
                        varName = CATCH_STACK_VAR;
                        break;
                    default:
                        throw new Error("Unknown builtin variable " + ast.builtin);
                }
            }
            var currCtx = ctx;
            while (currCtx != null) {
                if (currCtx.vars.has(varName)) {
                    return currCtx.vars.get(varName);
                }
                currCtx = currCtx.parent;
            }
            throw new Error("Not declared variable " + varName);
        };
        StatementInterpreter.prototype.visitWriteKeyExpr = function (expr, ctx) {
            var receiver = expr.receiver.visitExpression(this, ctx);
            var index = expr.index.visitExpression(this, ctx);
            var value = expr.value.visitExpression(this, ctx);
            receiver[index] = value;
            return value;
        };
        StatementInterpreter.prototype.visitWritePropExpr = function (expr, ctx) {
            var receiver = expr.receiver.visitExpression(this, ctx);
            var value = expr.value.visitExpression(this, ctx);
            receiver[expr.name] = value;
            return value;
        };
        StatementInterpreter.prototype.visitInvokeFunctionExpr = function (stmt, ctx) {
            var args = this.visitAllExpressions(stmt.args, ctx);
            var fnExpr = stmt.fn;
            if (fnExpr instanceof o.ReadVarExpr && fnExpr.builtin === o.BuiltinVar.Super) {
                ctx.instance.constructor.prototype.constructor.apply(ctx.instance, args);
                return null;
            }
            else {
                var fn = fnExpr.visitExpression(this, ctx);
                var context = null;
                if (fnExpr.receiver) {
                    context = fnExpr.receiver.visitExpression(this, ctx);
                }
                return fn.apply(context, args);
            }
        };
        StatementInterpreter.prototype.visitTaggedTemplateExpr = function (expr, ctx) {
            var templateElements = expr.template.elements.map(function (e) { return e.text; });
            Object.defineProperty(templateElements, 'raw', { value: expr.template.elements.map(function (e) { return e.rawText; }) });
            var args = this.visitAllExpressions(expr.template.expressions, ctx);
            args.unshift(templateElements);
            var tag = expr.tag.visitExpression(this, ctx);
            return tag.apply(null, args);
        };
        StatementInterpreter.prototype.visitReturnStmt = function (stmt, ctx) {
            return new ReturnValue(stmt.value.visitExpression(this, ctx));
        };
        StatementInterpreter.prototype.visitDeclareClassStmt = function (stmt, ctx) {
            var clazz = createDynamicClass(stmt, ctx, this);
            ctx.vars.set(stmt.name, clazz);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.exports.push(stmt.name);
            }
            return null;
        };
        StatementInterpreter.prototype.visitExpressionStmt = function (stmt, ctx) {
            return stmt.expr.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitIfStmt = function (stmt, ctx) {
            var condition = stmt.condition.visitExpression(this, ctx);
            if (condition) {
                return this.visitAllStatements(stmt.trueCase, ctx);
            }
            else if (stmt.falseCase != null) {
                return this.visitAllStatements(stmt.falseCase, ctx);
            }
            return null;
        };
        StatementInterpreter.prototype.visitTryCatchStmt = function (stmt, ctx) {
            try {
                return this.visitAllStatements(stmt.bodyStmts, ctx);
            }
            catch (e) {
                var childCtx = ctx.createChildWihtLocalVars();
                childCtx.vars.set(CATCH_ERROR_VAR, e);
                childCtx.vars.set(CATCH_STACK_VAR, e.stack);
                return this.visitAllStatements(stmt.catchStmts, childCtx);
            }
        };
        StatementInterpreter.prototype.visitThrowStmt = function (stmt, ctx) {
            throw stmt.error.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitInstantiateExpr = function (ast, ctx) {
            var args = this.visitAllExpressions(ast.args, ctx);
            var clazz = ast.classExpr.visitExpression(this, ctx);
            return new (clazz.bind.apply(clazz, (0, tslib_1.__spreadArray)([void 0], (0, tslib_1.__read)(args), false)))();
        };
        StatementInterpreter.prototype.visitLiteralExpr = function (ast, ctx) {
            return ast.value;
        };
        StatementInterpreter.prototype.visitLocalizedString = function (ast, context) {
            return null;
        };
        StatementInterpreter.prototype.visitExternalExpr = function (ast, ctx) {
            return this.reflector.resolveExternalReference(ast.value);
        };
        StatementInterpreter.prototype.visitConditionalExpr = function (ast, ctx) {
            if (ast.condition.visitExpression(this, ctx)) {
                return ast.trueCase.visitExpression(this, ctx);
            }
            else if (ast.falseCase != null) {
                return ast.falseCase.visitExpression(this, ctx);
            }
            return null;
        };
        StatementInterpreter.prototype.visitNotExpr = function (ast, ctx) {
            return !ast.condition.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitAssertNotNullExpr = function (ast, ctx) {
            return ast.condition.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitCastExpr = function (ast, ctx) {
            return ast.value.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitFunctionExpr = function (ast, ctx) {
            var paramNames = ast.params.map(function (param) { return param.name; });
            return _declareFn(paramNames, ast.statements, ctx, this);
        };
        StatementInterpreter.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
            var paramNames = stmt.params.map(function (param) { return param.name; });
            ctx.vars.set(stmt.name, _declareFn(paramNames, stmt.statements, ctx, this));
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.exports.push(stmt.name);
            }
            return null;
        };
        StatementInterpreter.prototype.visitUnaryOperatorExpr = function (ast, ctx) {
            var _this = this;
            var rhs = function () { return ast.expr.visitExpression(_this, ctx); };
            switch (ast.operator) {
                case o.UnaryOperator.Plus:
                    return +rhs();
                case o.UnaryOperator.Minus:
                    return -rhs();
                default:
                    throw new Error("Unknown operator " + ast.operator);
            }
        };
        StatementInterpreter.prototype.visitBinaryOperatorExpr = function (ast, ctx) {
            var _this = this;
            var _a;
            var lhs = function () { return ast.lhs.visitExpression(_this, ctx); };
            var rhs = function () { return ast.rhs.visitExpression(_this, ctx); };
            switch (ast.operator) {
                case o.BinaryOperator.Equals:
                    return lhs() == rhs();
                case o.BinaryOperator.Identical:
                    return lhs() === rhs();
                case o.BinaryOperator.NotEquals:
                    return lhs() != rhs();
                case o.BinaryOperator.NotIdentical:
                    return lhs() !== rhs();
                case o.BinaryOperator.And:
                    return lhs() && rhs();
                case o.BinaryOperator.Or:
                    return lhs() || rhs();
                case o.BinaryOperator.Plus:
                    return lhs() + rhs();
                case o.BinaryOperator.Minus:
                    return lhs() - rhs();
                case o.BinaryOperator.Divide:
                    return lhs() / rhs();
                case o.BinaryOperator.Multiply:
                    return lhs() * rhs();
                case o.BinaryOperator.Modulo:
                    return lhs() % rhs();
                case o.BinaryOperator.Lower:
                    return lhs() < rhs();
                case o.BinaryOperator.LowerEquals:
                    return lhs() <= rhs();
                case o.BinaryOperator.Bigger:
                    return lhs() > rhs();
                case o.BinaryOperator.BiggerEquals:
                    return lhs() >= rhs();
                case o.BinaryOperator.NullishCoalesce:
                    return (_a = lhs()) !== null && _a !== void 0 ? _a : rhs();
                default:
                    throw new Error("Unknown operator " + ast.operator);
            }
        };
        StatementInterpreter.prototype.visitReadPropExpr = function (ast, ctx) {
            var result;
            var receiver = ast.receiver.visitExpression(this, ctx);
            result = receiver[ast.name];
            return result;
        };
        StatementInterpreter.prototype.visitReadKeyExpr = function (ast, ctx) {
            var receiver = ast.receiver.visitExpression(this, ctx);
            var prop = ast.index.visitExpression(this, ctx);
            return receiver[prop];
        };
        StatementInterpreter.prototype.visitLiteralArrayExpr = function (ast, ctx) {
            return this.visitAllExpressions(ast.entries, ctx);
        };
        StatementInterpreter.prototype.visitLiteralMapExpr = function (ast, ctx) {
            var _this = this;
            var result = {};
            ast.entries.forEach(function (entry) { return result[entry.key] = entry.value.visitExpression(_this, ctx); });
            return result;
        };
        StatementInterpreter.prototype.visitCommaExpr = function (ast, context) {
            var values = this.visitAllExpressions(ast.parts, context);
            return values[values.length - 1];
        };
        StatementInterpreter.prototype.visitAllExpressions = function (expressions, ctx) {
            var _this = this;
            return expressions.map(function (expr) { return expr.visitExpression(_this, ctx); });
        };
        StatementInterpreter.prototype.visitAllStatements = function (statements, ctx) {
            for (var i = 0; i < statements.length; i++) {
                var stmt = statements[i];
                var val = stmt.visitStatement(this, ctx);
                if (val instanceof ReturnValue) {
                    return val;
                }
            }
            return null;
        };
        return StatementInterpreter;
    }());
    function _declareFn(varNames, statements, ctx, visitor) {
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return _executeFunctionStatements(varNames, args, statements, ctx, visitor);
        };
    }
    var CATCH_ERROR_VAR = 'error';
    var CATCH_STACK_VAR = 'stack';
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ludGVycHJldGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL291dHB1dC9vdXRwdXRfaW50ZXJwcmV0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQVFBLDJEQUFrQztJQUNsQyxzRUFBd0Q7SUFFeEQsU0FBZ0IsbUJBQW1CLENBQy9CLFVBQXlCLEVBQUUsU0FBMkI7UUFDeEQsSUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBZSxDQUFDLENBQUM7UUFDNUUsSUFBTSxPQUFPLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRCxPQUFPLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLElBQU0sTUFBTSxHQUF5QixFQUFFLENBQUM7UUFDeEMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxVQUFVO1lBQzdCLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFWRCxrREFVQztJQUVELFNBQVMsMEJBQTBCLENBQy9CLFFBQWtCLEVBQUUsU0FBZ0IsRUFBRSxVQUF5QixFQUFFLEdBQXNCLEVBQ3ZGLE9BQTZCO1FBQy9CLElBQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxD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RUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQztRQUFwRSxDQUFvRSxDQUFDO0lBQ2xHLENBQUM7SUFFRCxJQUFNLGVBQWUsR0FBRyxPQUFPLENBQUM7SUFDaEMsSUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXRfYXN0JztcbmltcG9ydCB7ZGVidWdPdXRwdXRBc3RBc1R5cGVTY3JpcHR9IGZyb20gJy4vdHNfZW1pdHRlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnByZXRTdGF0ZW1lbnRzKFxuICAgIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgY29uc3QgY3R4ID0gbmV3IF9FeGVjdXRpb25Db250ZXh0KG51bGwsIG51bGwsIG51bGwsIG5ldyBNYXA8c3RyaW5nLCBhbnk+KCkpO1xuICBjb25zdCB2aXNpdG9yID0gbmV3IFN0YXRlbWVudEludGVycHJldGVyKHJlZmxlY3Rvcik7XG4gIHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHMsIGN0eCk7XG4gIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgY3R4LmV4cG9ydHMuZm9yRWFjaCgoZXhwb3J0TmFtZSkgPT4ge1xuICAgIHJlc3VsdFtleHBvcnROYW1lXSA9IGN0eC52YXJzLmdldChleHBvcnROYW1lKTtcbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIF9leGVjdXRlRnVuY3Rpb25TdGF0ZW1lbnRzKFxuICAgIHZhck5hbWVzOiBzdHJpbmdbXSwgdmFyVmFsdWVzOiBhbnlbXSwgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCxcbiAgICB2aXNpdG9yOiBTdGF0ZW1lbnRJbnRlcnByZXRlcik6IGFueSB7XG4gIGNvbnN0IGNoaWxkQ3R4ID0gY3R4LmNyZWF0ZUNoaWxkV2lodExvY2FsVmFycygpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHZhck5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY2hpbGRDdHgudmFycy5zZXQodmFyTmFtZXNbaV0sIHZhclZhbHVlc1tpXSk7XG4gIH1cbiAgY29uc3QgcmVzdWx0ID0gdmlzaXRvci52aXNpdEFsbFN0YXRlbWVudHMoc3RhdGVtZW50cywgY2hpbGRDdHgpO1xuICByZXR1cm4gcmVzdWx0ID8gcmVzdWx0LnZhbHVlIDogbnVsbDtcbn1cblxuY2xhc3MgX0V4ZWN1dGlvbkNvbnRleHQge1xuICBleHBvcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHBhcmVudDogX0V4ZWN1dGlvbkNvbnRleHR8bnVsbCwgcHVibGljIGluc3RhbmNlOiBPYmplY3R8bnVsbCxcbiAgICAgIHB1YmxpYyBjbGFzc05hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgdmFyczogTWFwPHN0cmluZywgYW55Pikge31cblxuICBjcmVhdGVDaGlsZFdpaHRMb2NhbFZhcnMoKTogX0V4ZWN1dGlvbkNvbnRleHQge1xuICAgIHJldHVybiBuZXcgX0V4ZWN1dGlvbkNvbnRleHQodGhpcywgdGhpcy5pbnN0YW5jZSwgdGhpcy5jbGFzc05hbWUsIG5ldyBNYXA8c3RyaW5nLCBhbnk+KCkpO1xuICB9XG59XG5cbmNsYXNzIFJldHVyblZhbHVlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBhbnkpIHt9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUR5bmFtaWNDbGFzcyhcbiAgICBfY2xhc3NTdG10OiBvLkNsYXNzU3RtdCwgX2N0eDogX0V4ZWN1dGlvbkNvbnRleHQsIF92aXNpdG9yOiBTdGF0ZW1lbnRJbnRlcnByZXRlcik6IEZ1bmN0aW9uIHtcbiAgY29uc3QgcHJvcGVydHlEZXNjcmlwdG9yczoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcblxuICBfY2xhc3NTdG10LmdldHRlcnMuZm9yRWFjaCgoZ2V0dGVyOiBvLkNsYXNzR2V0dGVyKSA9PiB7XG4gICAgLy8gTm90ZTogdXNlIGBmdW5jdGlvbmAgaW5zdGVhZCBvZiBhcnJvdyBmdW5jdGlvbiB0byBjYXB0dXJlIGB0aGlzYFxuICAgIHByb3BlcnR5RGVzY3JpcHRvcnNbZ2V0dGVyLm5hbWVdID0ge1xuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlQ3R4ID0gbmV3IF9FeGVjdXRpb25Db250ZXh0KF9jdHgsIHRoaXMsIF9jbGFzc1N0bXQubmFtZSwgX2N0eC52YXJzKTtcbiAgICAgICAgcmV0dXJuIF9leGVjdXRlRnVuY3Rpb25TdGF0ZW1lbnRzKFtdLCBbXSwgZ2V0dGVyLmJvZHksIGluc3RhbmNlQ3R4LCBfdmlzaXRvcik7XG4gICAgICB9XG4gICAgfTtcbiAgfSk7XG4gIF9jbGFzc1N0bXQubWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZDogby5DbGFzc01ldGhvZCkge1xuICAgIGNvbnN0IHBhcmFtTmFtZXMgPSBtZXRob2QucGFyYW1zLm1hcChwYXJhbSA9PiBwYXJhbS5uYW1lKTtcbiAgICAvLyBOb3RlOiB1c2UgYGZ1bmN0aW9uYCBpbnN0ZWFkIG9mIGFycm93IGZ1bmN0aW9uIHRvIGNhcHR1cmUgYHRoaXNgXG4gICAgcHJvcGVydHlEZXNjcmlwdG9yc1ttZXRob2QubmFtZSFdID0ge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiBmdW5jdGlvbiguLi5hcmdzOiBhbnlbXSkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZUN0eCA9IG5ldyBfRXhlY3V0aW9uQ29udGV4dChfY3R4LCB0aGlzLCBfY2xhc3NTdG10Lm5hbWUsIF9jdHgudmFycyk7XG4gICAgICAgIHJldHVybiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyhwYXJhbU5hbWVzLCBhcmdzLCBtZXRob2QuYm9keSwgaW5zdGFuY2VDdHgsIF92aXNpdG9yKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KTtcblxuICBjb25zdCBjdG9yUGFyYW1OYW1lcyA9IF9jbGFzc1N0bXQuY29uc3RydWN0b3JNZXRob2QucGFyYW1zLm1hcChwYXJhbSA9PiBwYXJhbS5uYW1lKTtcbiAgLy8gTm90ZTogdXNlIGBmdW5jdGlvbmAgaW5zdGVhZCBvZiBhcnJvdyBmdW5jdGlvbiB0byBjYXB0dXJlIGB0aGlzYFxuICBjb25zdCBjdG9yID0gZnVuY3Rpb24odGhpczogT2JqZWN0LCAuLi5hcmdzOiBhbnlbXSkge1xuICAgIGNvbnN0IGluc3RhbmNlQ3R4ID0gbmV3IF9FeGVjdXRpb25Db250ZXh0KF9jdHgsIHRoaXMsIF9jbGFzc1N0bXQubmFtZSwgX2N0eC52YXJzKTtcbiAgICBfY2xhc3NTdG10LmZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xuICAgICAgKHRoaXMgYXMgYW55KVtmaWVsZC5uYW1lXSA9IHVuZGVmaW5lZDtcbiAgICB9KTtcbiAgICBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyhcbiAgICAgICAgY3RvclBhcmFtTmFtZXMsIGFyZ3MsIF9jbGFzc1N0bXQuY29uc3RydWN0b3JNZXRob2QuYm9keSwgaW5zdGFuY2VDdHgsIF92aXNpdG9yKTtcbiAgfTtcbiAgY29uc3Qgc3VwZXJDbGFzcyA9IF9jbGFzc1N0bXQucGFyZW50ID8gX2NsYXNzU3RtdC5wYXJlbnQudmlzaXRFeHByZXNzaW9uKF92aXNpdG9yLCBfY3R4KSA6IE9iamVjdDtcbiAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MucHJvdG90eXBlLCBwcm9wZXJ0eURlc2NyaXB0b3JzKTtcbiAgcmV0dXJuIGN0b3I7XG59XG5cbmNsYXNzIFN0YXRlbWVudEludGVycHJldGVyIGltcGxlbWVudHMgby5TdGF0ZW1lbnRWaXNpdG9yLCBvLkV4cHJlc3Npb25WaXNpdG9yIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHt9XG4gIGRlYnVnQXN0KGFzdDogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50fG8uVHlwZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGRlYnVnT3V0cHV0QXN0QXNUeXBlU2NyaXB0KGFzdCk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IG8uRGVjbGFyZVZhclN0bXQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGluaXRpYWxWYWx1ZSA9IHN0bXQudmFsdWUgPyBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpIDogdW5kZWZpbmVkO1xuICAgIGN0eC52YXJzLnNldChzdG10Lm5hbWUsIGluaXRpYWxWYWx1ZSk7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICBjdHguZXhwb3J0cy5wdXNoKHN0bXQubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IG8uV3JpdGVWYXJFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgbGV0IGN1cnJDdHggPSBjdHg7XG4gICAgd2hpbGUgKGN1cnJDdHggIT0gbnVsbCkge1xuICAgICAgaWYgKGN1cnJDdHgudmFycy5oYXMoZXhwci5uYW1lKSkge1xuICAgICAgICBjdXJyQ3R4LnZhcnMuc2V0KGV4cHIubmFtZSwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgICBjdXJyQ3R4ID0gY3VyckN0eC5wYXJlbnQhO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5vdCBkZWNsYXJlZCB2YXJpYWJsZSAke2V4cHIubmFtZX1gKTtcbiAgfVxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgaW50ZXJwcmV0IGEgV3JhcHBlZE5vZGVFeHByLicpO1xuICB9XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IG8uVHlwZW9mRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBpbnRlcnByZXQgYSBUeXBlb2ZFeHByJyk7XG4gIH1cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IG8uUmVhZFZhckV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGxldCB2YXJOYW1lID0gYXN0Lm5hbWUhO1xuICAgIGlmIChhc3QuYnVpbHRpbiAhPSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKGFzdC5idWlsdGluKSB7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluVmFyLlN1cGVyOlxuICAgICAgICAgIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YoY3R4Lmluc3RhbmNlKTtcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuVGhpczpcbiAgICAgICAgICByZXR1cm4gY3R4Lmluc3RhbmNlO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaEVycm9yOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9FUlJPUl9WQVI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluVmFyLkNhdGNoU3RhY2s6XG4gICAgICAgICAgdmFyTmFtZSA9IENBVENIX1NUQUNLX1ZBUjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbHRpbiB2YXJpYWJsZSAke2FzdC5idWlsdGlufWApO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgY3VyckN0eCA9IGN0eDtcbiAgICB3aGlsZSAoY3VyckN0eCAhPSBudWxsKSB7XG4gICAgICBpZiAoY3VyckN0eC52YXJzLmhhcyh2YXJOYW1lKSkge1xuICAgICAgICByZXR1cm4gY3VyckN0eC52YXJzLmdldCh2YXJOYW1lKTtcbiAgICAgIH1cbiAgICAgIGN1cnJDdHggPSBjdXJyQ3R4LnBhcmVudCE7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgTm90IGRlY2xhcmVkIHZhcmlhYmxlICR7dmFyTmFtZX1gKTtcbiAgfVxuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBvLldyaXRlS2V5RXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IGluZGV4ID0gZXhwci5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCB2YWx1ZSA9IGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmVjZWl2ZXJbaW5kZXhdID0gdmFsdWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBvLldyaXRlUHJvcEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCB2YWx1ZSA9IGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmVjZWl2ZXJbZXhwci5uYW1lXSA9IHZhbHVlO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKHN0bXQ6IG8uSW52b2tlRnVuY3Rpb25FeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKHN0bXQuYXJncywgY3R4KTtcbiAgICBjb25zdCBmbkV4cHIgPSBzdG10LmZuIGFzIChvLkV4cHJlc3Npb24gJiB7cmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiB8IHVuZGVmaW5lZH0pO1xuICAgIGlmIChmbkV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByICYmIGZuRXhwci5idWlsdGluID09PSBvLkJ1aWx0aW5WYXIuU3VwZXIpIHtcbiAgICAgIGN0eC5pbnN0YW5jZSEuY29uc3RydWN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KGN0eC5pbnN0YW5jZSwgYXJncyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZm4gPSBmbkV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgICBsZXQgY29udGV4dDogYW55ID0gbnVsbDtcbiAgICAgIGlmIChmbkV4cHIucmVjZWl2ZXIpIHtcbiAgICAgICAgY29udGV4dCA9IGZuRXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB9XG4gIH1cbiAgdmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIoZXhwcjogby5UYWdnZWRUZW1wbGF0ZUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudHMgPSBleHByLnRlbXBsYXRlLmVsZW1lbnRzLm1hcCgoZSkgPT4gZS50ZXh0KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoXG4gICAgICAgIHRlbXBsYXRlRWxlbWVudHMsICdyYXcnLCB7dmFsdWU6IGV4cHIudGVtcGxhdGUuZWxlbWVudHMubWFwKChlKSA9PiBlLnJhd1RleHQpfSk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhleHByLnRlbXBsYXRlLmV4cHJlc3Npb25zLCBjdHgpO1xuICAgIGFyZ3MudW5zaGlmdCh0ZW1wbGF0ZUVsZW1lbnRzKTtcbiAgICBjb25zdCB0YWcgPSBleHByLnRhZy52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gdGFnLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9XG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBvLlJldHVyblN0YXRlbWVudCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIG5ldyBSZXR1cm5WYWx1ZShzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpKTtcbiAgfVxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogby5DbGFzc1N0bXQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGNsYXp6ID0gY3JlYXRlRHluYW1pY0NsYXNzKHN0bXQsIGN0eCwgdGhpcyk7XG4gICAgY3R4LnZhcnMuc2V0KHN0bXQubmFtZSwgY2xhenopO1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgY3R4LmV4cG9ydHMucHVzaChzdG10Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IG8uRXhwcmVzc2lvblN0YXRlbWVudCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdElmU3RtdChzdG10OiBvLklmU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgY29uZGl0aW9uID0gc3RtdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKGNvbmRpdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGN0eCk7XG4gICAgfSBlbHNlIGlmIChzdG10LmZhbHNlQ2FzZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5mYWxzZUNhc2UsIGN0eCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IG8uVHJ5Q2F0Y2hTdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuYm9keVN0bXRzLCBjdHgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGNoaWxkQ3R4ID0gY3R4LmNyZWF0ZUNoaWxkV2lodExvY2FsVmFycygpO1xuICAgICAgY2hpbGRDdHgudmFycy5zZXQoQ0FUQ0hfRVJST1JfVkFSLCBlKTtcbiAgICAgIGNoaWxkQ3R4LnZhcnMuc2V0KENBVENIX1NUQUNLX1ZBUiwgZS5zdGFjayk7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jYXRjaFN0bXRzLCBjaGlsZEN0eCk7XG4gICAgfVxuICB9XG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IG8uVGhyb3dTdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICB0aHJvdyBzdG10LmVycm9yLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogby5JbnN0YW50aWF0ZUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGN0eCk7XG4gICAgY29uc3QgY2xhenogPSBhc3QuY2xhc3NFeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiBuZXcgY2xhenooLi4uYXJncyk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IG8uTGl0ZXJhbEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBhc3QudmFsdWU7XG4gIH1cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBvLkxvY2FsaXplZFN0cmluZywgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKGFzdC52YWx1ZSk7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBvLkNvbmRpdGlvbmFsRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkpIHtcbiAgICAgIHJldHVybiBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgfSBlbHNlIGlmIChhc3QuZmFsc2VDYXNlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBhc3QuZmFsc2VDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdE5vdEV4cHIoYXN0OiBvLk5vdEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiAhYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogby5Bc3NlcnROb3ROdWxsLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdENhc3RFeHByKGFzdDogby5DYXN0RXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IG8uRnVuY3Rpb25FeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBwYXJhbU5hbWVzID0gYXN0LnBhcmFtcy5tYXAoKHBhcmFtKSA9PiBwYXJhbS5uYW1lKTtcbiAgICByZXR1cm4gX2RlY2xhcmVGbihwYXJhbU5hbWVzLCBhc3Quc3RhdGVtZW50cywgY3R4LCB0aGlzKTtcbiAgfVxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBwYXJhbU5hbWVzID0gc3RtdC5wYXJhbXMubWFwKChwYXJhbSkgPT4gcGFyYW0ubmFtZSk7XG4gICAgY3R4LnZhcnMuc2V0KHN0bXQubmFtZSwgX2RlY2xhcmVGbihwYXJhbU5hbWVzLCBzdG10LnN0YXRlbWVudHMsIGN0eCwgdGhpcykpO1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgY3R4LmV4cG9ydHMucHVzaChzdG10Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFVuYXJ5T3BlcmF0b3JFeHByKGFzdDogby5VbmFyeU9wZXJhdG9yRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmhzID0gKCkgPT4gYXN0LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG5cbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSBvLlVuYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgcmV0dXJuICtyaHMoKTtcbiAgICAgIGNhc2Ugby5VbmFyeU9wZXJhdG9yLk1pbnVzOlxuICAgICAgICByZXR1cm4gLXJocygpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfVxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IG8uQmluYXJ5T3BlcmF0b3JFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBsaHMgPSAoKSA9PiBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHJocyA9ICgpID0+IGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG5cbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFsczpcbiAgICAgICAgcmV0dXJuIGxocygpID09IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbDpcbiAgICAgICAgcmV0dXJuIGxocygpID09PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSAhPSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw6XG4gICAgICAgIHJldHVybiBsaHMoKSAhPT0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQW5kOlxuICAgICAgICByZXR1cm4gbGhzKCkgJiYgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuT3I6XG4gICAgICAgIHJldHVybiBsaHMoKSB8fCByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5QbHVzOlxuICAgICAgICByZXR1cm4gbGhzKCkgKyByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5NaW51czpcbiAgICAgICAgcmV0dXJuIGxocygpIC0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlOlxuICAgICAgICByZXR1cm4gbGhzKCkgLyByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5NdWx0aXBseTpcbiAgICAgICAgcmV0dXJuIGxocygpICogcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTW9kdWxvOlxuICAgICAgICByZXR1cm4gbGhzKCkgJSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Mb3dlcjpcbiAgICAgICAgcmV0dXJuIGxocygpIDwgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSA8PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaWdnZXI6XG4gICAgICAgIHJldHVybiBsaHMoKSA+IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFsczpcbiAgICAgICAgcmV0dXJuIGxocygpID49IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk51bGxpc2hDb2FsZXNjZTpcbiAgICAgICAgcmV0dXJuIGxocygpID8/IHJocygpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfVxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IG8uUmVhZFByb3BFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBsZXQgcmVzdWx0OiBhbnk7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmVzdWx0ID0gcmVjZWl2ZXJbYXN0Lm5hbWVdO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IG8uUmVhZEtleUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHByb3AgPSBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmV0dXJuIHJlY2VpdmVyW3Byb3BdO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IG8uTGl0ZXJhbEFycmF5RXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZW50cmllcywgY3R4KTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogby5MaXRlcmFsTWFwRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0OiB7W2s6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICBhc3QuZW50cmllcy5mb3JFYWNoKGVudHJ5ID0+IHJlc3VsdFtlbnRyeS5rZXldID0gZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBvLkNvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZXMgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdmFsdWVzW3ZhbHVlcy5sZW5ndGggLSAxXTtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb25zLm1hcCgoZXhwcikgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSk7XG4gIH1cblxuICB2aXNpdEFsbFN0YXRlbWVudHMoc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IFJldHVyblZhbHVlfG51bGwge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc3RtdCA9IHN0YXRlbWVudHNbaV07XG4gICAgICBjb25zdCB2YWwgPSBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGN0eCk7XG4gICAgICBpZiAodmFsIGluc3RhbmNlb2YgUmV0dXJuVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2RlY2xhcmVGbihcbiAgICB2YXJOYW1lczogc3RyaW5nW10sIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQsXG4gICAgdmlzaXRvcjogU3RhdGVtZW50SW50ZXJwcmV0ZXIpOiBGdW5jdGlvbiB7XG4gIHJldHVybiAoLi4uYXJnczogYW55W10pID0+IF9leGVjdXRlRnVuY3Rpb25TdGF0ZW1lbnRzKHZhck5hbWVzLCBhcmdzLCBzdGF0ZW1lbnRzLCBjdHgsIHZpc2l0b3IpO1xufVxuXG5jb25zdCBDQVRDSF9FUlJPUl9WQVIgPSAnZXJyb3InO1xuY29uc3QgQ0FUQ0hfU1RBQ0tfVkFSID0gJ3N0YWNrJztcbiJdfQ==