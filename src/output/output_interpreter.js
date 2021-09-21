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
            return ts_emitter_1.debugOutputAstAsTypeScript(ast);
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
            return new (clazz.bind.apply(clazz, tslib_1.__spreadArray([void 0], tslib_1.__read(args))))();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ludGVycHJldGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL291dHB1dC9vdXRwdXRfaW50ZXJwcmV0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQVFBLDJEQUFrQztJQUNsQyxzRUFBd0Q7SUFFeEQsU0FBZ0IsbUJBQW1CLENBQy9CLFVBQXlCLEVBQUUsU0FBMkI7UUFDeEQsSUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBZSxDQUFDLENBQUM7UUFDNUUsSUFBTSxPQUFPLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRCxPQUFPLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLElBQU0sTUFBTSxHQUF5QixFQUFFLENBQUM7UUFDeEMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxVQUFVO1lBQzdCLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFWRCxrREFVQztJQUVELFNBQVMsMEJBQTBCLENBQy9CLFFBQWtCLEVBQUUsU0FBZ0IsRUFBRSxVQUF5QixFQUFFLEdBQXNCLEVBQ3ZGLE9BQTZCO1FBQy9CLElBQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxD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VUFBVSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUM7UUFBcEUsQ0FBb0UsQ0FBQztJQUNsRyxDQUFDO0lBRUQsSUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDO0lBQ2hDLElBQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0X2FzdCc7XG5pbXBvcnQge2RlYnVnT3V0cHV0QXN0QXNUeXBlU2NyaXB0fSBmcm9tICcuL3RzX2VtaXR0ZXInO1xuXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJwcmV0U3RhdGVtZW50cyhcbiAgICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gIGNvbnN0IGN0eCA9IG5ldyBfRXhlY3V0aW9uQ29udGV4dChudWxsLCBudWxsLCBudWxsLCBuZXcgTWFwPHN0cmluZywgYW55PigpKTtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBTdGF0ZW1lbnRJbnRlcnByZXRlcihyZWZsZWN0b3IpO1xuICB2aXNpdG9yLnZpc2l0QWxsU3RhdGVtZW50cyhzdGF0ZW1lbnRzLCBjdHgpO1xuICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG4gIGN0eC5leHBvcnRzLmZvckVhY2goKGV4cG9ydE5hbWUpID0+IHtcbiAgICByZXN1bHRbZXhwb3J0TmFtZV0gPSBjdHgudmFycy5nZXQoZXhwb3J0TmFtZSk7XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyhcbiAgICB2YXJOYW1lczogc3RyaW5nW10sIHZhclZhbHVlczogYW55W10sIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQsXG4gICAgdmlzaXRvcjogU3RhdGVtZW50SW50ZXJwcmV0ZXIpOiBhbnkge1xuICBjb25zdCBjaGlsZEN0eCA9IGN0eC5jcmVhdGVDaGlsZFdpaHRMb2NhbFZhcnMoKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YXJOYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNoaWxkQ3R4LnZhcnMuc2V0KHZhck5hbWVzW2ldLCB2YXJWYWx1ZXNbaV0pO1xuICB9XG4gIGNvbnN0IHJlc3VsdCA9IHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHMsIGNoaWxkQ3R4KTtcbiAgcmV0dXJuIHJlc3VsdCA/IHJlc3VsdC52YWx1ZSA6IG51bGw7XG59XG5cbmNsYXNzIF9FeGVjdXRpb25Db250ZXh0IHtcbiAgZXhwb3J0czogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBwYXJlbnQ6IF9FeGVjdXRpb25Db250ZXh0fG51bGwsIHB1YmxpYyBpbnN0YW5jZTogT2JqZWN0fG51bGwsXG4gICAgICBwdWJsaWMgY2xhc3NOYW1lOiBzdHJpbmd8bnVsbCwgcHVibGljIHZhcnM6IE1hcDxzdHJpbmcsIGFueT4pIHt9XG5cbiAgY3JlYXRlQ2hpbGRXaWh0TG9jYWxWYXJzKCk6IF9FeGVjdXRpb25Db250ZXh0IHtcbiAgICByZXR1cm4gbmV3IF9FeGVjdXRpb25Db250ZXh0KHRoaXMsIHRoaXMuaW5zdGFuY2UsIHRoaXMuY2xhc3NOYW1lLCBuZXcgTWFwPHN0cmluZywgYW55PigpKTtcbiAgfVxufVxuXG5jbGFzcyBSZXR1cm5WYWx1ZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogYW55KSB7fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVEeW5hbWljQ2xhc3MoXG4gICAgX2NsYXNzU3RtdDogby5DbGFzc1N0bXQsIF9jdHg6IF9FeGVjdXRpb25Db250ZXh0LCBfdmlzaXRvcjogU3RhdGVtZW50SW50ZXJwcmV0ZXIpOiBGdW5jdGlvbiB7XG4gIGNvbnN0IHByb3BlcnR5RGVzY3JpcHRvcnM6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG5cbiAgX2NsYXNzU3RtdC5nZXR0ZXJzLmZvckVhY2goKGdldHRlcjogby5DbGFzc0dldHRlcikgPT4ge1xuICAgIC8vIE5vdGU6IHVzZSBgZnVuY3Rpb25gIGluc3RlYWQgb2YgYXJyb3cgZnVuY3Rpb24gdG8gY2FwdHVyZSBgdGhpc2BcbiAgICBwcm9wZXJ0eURlc2NyaXB0b3JzW2dldHRlci5uYW1lXSA9IHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZUN0eCA9IG5ldyBfRXhlY3V0aW9uQ29udGV4dChfY3R4LCB0aGlzLCBfY2xhc3NTdG10Lm5hbWUsIF9jdHgudmFycyk7XG4gICAgICAgIHJldHVybiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyhbXSwgW10sIGdldHRlci5ib2R5LCBpbnN0YW5jZUN0eCwgX3Zpc2l0b3IpO1xuICAgICAgfVxuICAgIH07XG4gIH0pO1xuICBfY2xhc3NTdG10Lm1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbihtZXRob2Q6IG8uQ2xhc3NNZXRob2QpIHtcbiAgICBjb25zdCBwYXJhbU5hbWVzID0gbWV0aG9kLnBhcmFtcy5tYXAocGFyYW0gPT4gcGFyYW0ubmFtZSk7XG4gICAgLy8gTm90ZTogdXNlIGBmdW5jdGlvbmAgaW5zdGVhZCBvZiBhcnJvdyBmdW5jdGlvbiB0byBjYXB0dXJlIGB0aGlzYFxuICAgIHByb3BlcnR5RGVzY3JpcHRvcnNbbWV0aG9kLm5hbWUhXSA9IHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogZnVuY3Rpb24oLi4uYXJnczogYW55W10pIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VDdHggPSBuZXcgX0V4ZWN1dGlvbkNvbnRleHQoX2N0eCwgdGhpcywgX2NsYXNzU3RtdC5uYW1lLCBfY3R4LnZhcnMpO1xuICAgICAgICByZXR1cm4gX2V4ZWN1dGVGdW5jdGlvblN0YXRlbWVudHMocGFyYW1OYW1lcywgYXJncywgbWV0aG9kLmJvZHksIGluc3RhbmNlQ3R4LCBfdmlzaXRvcik7XG4gICAgICB9XG4gICAgfTtcbiAgfSk7XG5cbiAgY29uc3QgY3RvclBhcmFtTmFtZXMgPSBfY2xhc3NTdG10LmNvbnN0cnVjdG9yTWV0aG9kLnBhcmFtcy5tYXAocGFyYW0gPT4gcGFyYW0ubmFtZSk7XG4gIC8vIE5vdGU6IHVzZSBgZnVuY3Rpb25gIGluc3RlYWQgb2YgYXJyb3cgZnVuY3Rpb24gdG8gY2FwdHVyZSBgdGhpc2BcbiAgY29uc3QgY3RvciA9IGZ1bmN0aW9uKHRoaXM6IE9iamVjdCwgLi4uYXJnczogYW55W10pIHtcbiAgICBjb25zdCBpbnN0YW5jZUN0eCA9IG5ldyBfRXhlY3V0aW9uQ29udGV4dChfY3R4LCB0aGlzLCBfY2xhc3NTdG10Lm5hbWUsIF9jdHgudmFycyk7XG4gICAgX2NsYXNzU3RtdC5maWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcbiAgICAgICh0aGlzIGFzIGFueSlbZmllbGQubmFtZV0gPSB1bmRlZmluZWQ7XG4gICAgfSk7XG4gICAgX2V4ZWN1dGVGdW5jdGlvblN0YXRlbWVudHMoXG4gICAgICAgIGN0b3JQYXJhbU5hbWVzLCBhcmdzLCBfY2xhc3NTdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGluc3RhbmNlQ3R4LCBfdmlzaXRvcik7XG4gIH07XG4gIGNvbnN0IHN1cGVyQ2xhc3MgPSBfY2xhc3NTdG10LnBhcmVudCA/IF9jbGFzc1N0bXQucGFyZW50LnZpc2l0RXhwcmVzc2lvbihfdmlzaXRvciwgX2N0eCkgOiBPYmplY3Q7XG4gIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzLnByb3RvdHlwZSwgcHJvcGVydHlEZXNjcmlwdG9ycyk7XG4gIHJldHVybiBjdG9yO1xufVxuXG5jbGFzcyBTdGF0ZW1lbnRJbnRlcnByZXRlciBpbXBsZW1lbnRzIG8uU3RhdGVtZW50VmlzaXRvciwgby5FeHByZXNzaW9uVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7fVxuICBkZWJ1Z0FzdChhc3Q6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudHxvLlR5cGUpOiBzdHJpbmcge1xuICAgIHJldHVybiBkZWJ1Z091dHB1dEFzdEFzVHlwZVNjcmlwdChhc3QpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBpbml0aWFsVmFsdWUgPSBzdG10LnZhbHVlID8gc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSA6IHVuZGVmaW5lZDtcbiAgICBjdHgudmFycy5zZXQoc3RtdC5uYW1lLCBpbml0aWFsVmFsdWUpO1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgY3R4LmV4cG9ydHMucHVzaChzdG10Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBvLldyaXRlVmFyRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgdmFsdWUgPSBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGxldCBjdXJyQ3R4ID0gY3R4O1xuICAgIHdoaWxlIChjdXJyQ3R4ICE9IG51bGwpIHtcbiAgICAgIGlmIChjdXJyQ3R4LnZhcnMuaGFzKGV4cHIubmFtZSkpIHtcbiAgICAgICAgY3VyckN0eC52YXJzLnNldChleHByLm5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgICAgY3VyckN0eCA9IGN1cnJDdHgucGFyZW50ITtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOb3QgZGVjbGFyZWQgdmFyaWFibGUgJHtleHByLm5hbWV9YCk7XG4gIH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGludGVycHJldCBhIFdyYXBwZWROb2RlRXhwci4nKTtcbiAgfVxuICB2aXNpdFR5cGVvZkV4cHIoYXN0OiBvLlR5cGVvZkV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgaW50ZXJwcmV0IGEgVHlwZW9mRXhwcicpO1xuICB9XG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBvLlJlYWRWYXJFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBsZXQgdmFyTmFtZSA9IGFzdC5uYW1lITtcbiAgICBpZiAoYXN0LmJ1aWx0aW4gIT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChhc3QuYnVpbHRpbikge1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5TdXBlcjpcbiAgICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKGN0eC5pbnN0YW5jZSk7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluVmFyLlRoaXM6XG4gICAgICAgICAgcmV0dXJuIGN0eC5pbnN0YW5jZTtcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuQ2F0Y2hFcnJvcjpcbiAgICAgICAgICB2YXJOYW1lID0gQ0FUQ0hfRVJST1JfVkFSO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaFN0YWNrOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9TVEFDS19WQVI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJ1aWx0aW4gdmFyaWFibGUgJHthc3QuYnVpbHRpbn1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGN1cnJDdHggPSBjdHg7XG4gICAgd2hpbGUgKGN1cnJDdHggIT0gbnVsbCkge1xuICAgICAgaWYgKGN1cnJDdHgudmFycy5oYXModmFyTmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJDdHgudmFycy5nZXQodmFyTmFtZSk7XG4gICAgICB9XG4gICAgICBjdXJyQ3R4ID0gY3VyckN0eC5wYXJlbnQhO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5vdCBkZWNsYXJlZCB2YXJpYWJsZSAke3Zhck5hbWV9YCk7XG4gIH1cbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogby5Xcml0ZUtleUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCBpbmRleCA9IGV4cHIuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY29uc3QgdmFsdWUgPSBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJlY2VpdmVyW2luZGV4XSA9IHZhbHVlO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogby5Xcml0ZVByb3BFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlciA9IGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY29uc3QgdmFsdWUgPSBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJlY2VpdmVyW2V4cHIubmFtZV0gPSB2YWx1ZTtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihzdG10OiBvLkludm9rZUZ1bmN0aW9uRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhzdG10LmFyZ3MsIGN0eCk7XG4gICAgY29uc3QgZm5FeHByID0gc3RtdC5mbiBhcyAoby5FeHByZXNzaW9uICYge3JlY2VpdmVyOiBvLkV4cHJlc3Npb24gfCB1bmRlZmluZWR9KTtcbiAgICBpZiAoZm5FeHByIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciAmJiBmbkV4cHIuYnVpbHRpbiA9PT0gby5CdWlsdGluVmFyLlN1cGVyKSB7XG4gICAgICBjdHguaW5zdGFuY2UhLmNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5hcHBseShjdHguaW5zdGFuY2UsIGFyZ3MpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZuID0gZm5FeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgICAgbGV0IGNvbnRleHQ6IGFueSA9IG51bGw7XG4gICAgICBpZiAoZm5FeHByLnJlY2VpdmVyKSB7XG4gICAgICAgIGNvbnRleHQgPSBmbkV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgfVxuICB9XG4gIHZpc2l0VGFnZ2VkVGVtcGxhdGVFeHByKGV4cHI6IG8uVGFnZ2VkVGVtcGxhdGVFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCB0ZW1wbGF0ZUVsZW1lbnRzID0gZXhwci50ZW1wbGF0ZS5lbGVtZW50cy5tYXAoKGUpID0+IGUudGV4dCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFxuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRzLCAncmF3Jywge3ZhbHVlOiBleHByLnRlbXBsYXRlLmVsZW1lbnRzLm1hcCgoZSkgPT4gZS5yYXdUZXh0KX0pO1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwci50ZW1wbGF0ZS5leHByZXNzaW9ucywgY3R4KTtcbiAgICBhcmdzLnVuc2hpZnQodGVtcGxhdGVFbGVtZW50cyk7XG4gICAgY29uc3QgdGFnID0gZXhwci50YWcudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmV0dXJuIHRhZy5hcHBseShudWxsLCBhcmdzKTtcbiAgfVxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogby5SZXR1cm5TdGF0ZW1lbnQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBuZXcgUmV0dXJuVmFsdWUoc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSk7XG4gIH1cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBjbGF6eiA9IGNyZWF0ZUR5bmFtaWNDbGFzcyhzdG10LCBjdHgsIHRoaXMpO1xuICAgIGN0eC52YXJzLnNldChzdG10Lm5hbWUsIGNsYXp6KTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRJZlN0bXQoc3RtdDogby5JZlN0bXQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGNvbmRpdGlvbiA9IHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmIChjb25kaXRpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjdHgpO1xuICAgIH0gZWxzZSBpZiAoc3RtdC5mYWxzZUNhc2UgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBvLlRyeUNhdGNoU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmJvZHlTdG10cywgY3R4KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCBjaGlsZEN0eCA9IGN0eC5jcmVhdGVDaGlsZFdpaHRMb2NhbFZhcnMoKTtcbiAgICAgIGNoaWxkQ3R4LnZhcnMuc2V0KENBVENIX0VSUk9SX1ZBUiwgZSk7XG4gICAgICBjaGlsZEN0eC52YXJzLnNldChDQVRDSF9TVEFDS19WQVIsIGUuc3RhY2spO1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY2F0Y2hTdG10cywgY2hpbGRDdHgpO1xuICAgIH1cbiAgfVxuICB2aXNpdFRocm93U3RtdChzdG10OiBvLlRocm93U3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgdGhyb3cgc3RtdC5lcnJvci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdEluc3RhbnRpYXRlRXhwcihhc3Q6IG8uSW5zdGFudGlhdGVFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjdHgpO1xuICAgIGNvbnN0IGNsYXp6ID0gYXN0LmNsYXNzRXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gbmV3IGNsYXp6KC4uLmFyZ3MpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBvLkxpdGVyYWxFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gYXN0LnZhbHVlO1xuICB9XG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogby5Mb2NhbGl6ZWRTdHJpbmcsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBvLkV4dGVybmFsRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShhc3QudmFsdWUpO1xuICB9XG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogby5Db25kaXRpb25hbEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGlmIChhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpKSB7XG4gICAgICByZXR1cm4gYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH0gZWxzZSBpZiAoYXN0LmZhbHNlQ2FzZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gYXN0LmZhbHNlQ2FzZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogby5Ob3RFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gIWFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwcihhc3Q6IG8uQXNzZXJ0Tm90TnVsbCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRDYXN0RXhwcihhc3Q6IG8uQ2FzdEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBhc3QudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBvLkZ1bmN0aW9uRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IGFzdC5wYXJhbXMubWFwKChwYXJhbSkgPT4gcGFyYW0ubmFtZSk7XG4gICAgcmV0dXJuIF9kZWNsYXJlRm4ocGFyYW1OYW1lcywgYXN0LnN0YXRlbWVudHMsIGN0eCwgdGhpcyk7XG4gIH1cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IHN0bXQucGFyYW1zLm1hcCgocGFyYW0pID0+IHBhcmFtLm5hbWUpO1xuICAgIGN0eC52YXJzLnNldChzdG10Lm5hbWUsIF9kZWNsYXJlRm4ocGFyYW1OYW1lcywgc3RtdC5zdGF0ZW1lbnRzLCBjdHgsIHRoaXMpKTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IG8uVW5hcnlPcGVyYXRvckV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJocyA9ICgpID0+IGFzdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuXG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2Ugby5VbmFyeU9wZXJhdG9yLlBsdXM6XG4gICAgICAgIHJldHVybiArcmhzKCk7XG4gICAgICBjYXNlIG8uVW5hcnlPcGVyYXRvci5NaW51czpcbiAgICAgICAgcmV0dXJuIC1yaHMoKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gIH1cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBvLkJpbmFyeU9wZXJhdG9yRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGhzID0gKCkgPT4gYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCByaHMgPSAoKSA9PiBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuXG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5FcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSA9PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw6XG4gICAgICAgIHJldHVybiBsaHMoKSA9PT0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzOlxuICAgICAgICByZXR1cm4gbGhzKCkgIT0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsOlxuICAgICAgICByZXR1cm4gbGhzKCkgIT09IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkFuZDpcbiAgICAgICAgcmV0dXJuIGxocygpICYmIHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk9yOlxuICAgICAgICByZXR1cm4gbGhzKCkgfHwgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgcmV0dXJuIGxocygpICsgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTWludXM6XG4gICAgICAgIHJldHVybiBsaHMoKSAtIHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkRpdmlkZTpcbiAgICAgICAgcmV0dXJuIGxocygpIC8gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk6XG4gICAgICAgIHJldHVybiBsaHMoKSAqIHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk1vZHVsbzpcbiAgICAgICAgcmV0dXJuIGxocygpICUgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXI6XG4gICAgICAgIHJldHVybiBsaHMoKSA8IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzOlxuICAgICAgICByZXR1cm4gbGhzKCkgPD0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyOlxuICAgICAgICByZXR1cm4gbGhzKCkgPiByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSA+PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5OdWxsaXNoQ29hbGVzY2U6XG4gICAgICAgIHJldHVybiBsaHMoKSA/PyByaHMoKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gIH1cbiAgdmlzaXRSZWFkUHJvcEV4cHIoYXN0OiBvLlJlYWRQcm9wRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgbGV0IHJlc3VsdDogYW55O1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJlc3VsdCA9IHJlY2VpdmVyW2FzdC5uYW1lXTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBvLlJlYWRLZXlFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCBwcm9wID0gYXN0LmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiByZWNlaXZlcltwcm9wXTtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihhc3Q6IG8uTGl0ZXJhbE1hcEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJlc3VsdDoge1trOiBzdHJpbmddOiBhbnl9ID0ge307XG4gICAgYXN0LmVudHJpZXMuZm9yRWFjaChlbnRyeSA9PiByZXN1bHRbZW50cnkua2V5XSA9IGVudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHZpc2l0Q29tbWFFeHByKGFzdDogby5Db21tYUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5wYXJ0cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHZhbHVlc1t2YWx1ZXMubGVuZ3RoIC0gMV07XG4gIH1cbiAgdmlzaXRBbGxFeHByZXNzaW9ucyhleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBleHByZXNzaW9ucy5tYXAoKGV4cHIpID0+IGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkpO1xuICB9XG5cbiAgdmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBSZXR1cm5WYWx1ZXxudWxsIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHN0bXQgPSBzdGF0ZW1lbnRzW2ldO1xuICAgICAgY29uc3QgdmFsID0gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjdHgpO1xuICAgICAgaWYgKHZhbCBpbnN0YW5jZW9mIFJldHVyblZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9kZWNsYXJlRm4oXG4gICAgdmFyTmFtZXM6IHN0cmluZ1tdLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0LFxuICAgIHZpc2l0b3I6IFN0YXRlbWVudEludGVycHJldGVyKTogRnVuY3Rpb24ge1xuICByZXR1cm4gKC4uLmFyZ3M6IGFueVtdKSA9PiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyh2YXJOYW1lcywgYXJncywgc3RhdGVtZW50cywgY3R4LCB2aXNpdG9yKTtcbn1cblxuY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gJ2Vycm9yJztcbmNvbnN0IENBVENIX1NUQUNLX1ZBUiA9ICdzdGFjayc7XG4iXX0=