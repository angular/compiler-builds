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
        define("@angular/compiler/src/output/ts_emitter", ["require", "exports", "tslib", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeScriptEmitter = exports.debugOutputAstAsTypeScript = void 0;
    var tslib_1 = require("tslib");
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    var o = require("@angular/compiler/src/output/output_ast");
    var _debugFilePath = '/debug/lib';
    function debugOutputAstAsTypeScript(ast) {
        var converter = new _TsEmitterVisitor();
        var ctx = abstract_emitter_1.EmitterVisitorContext.createRoot();
        var asts = Array.isArray(ast) ? ast : [ast];
        asts.forEach(function (ast) {
            if (ast instanceof o.Statement) {
                ast.visitStatement(converter, ctx);
            }
            else if (ast instanceof o.Expression) {
                ast.visitExpression(converter, ctx);
            }
            else if (ast instanceof o.Type) {
                ast.visitType(converter, ctx);
            }
            else {
                throw new Error("Don't know how to print debug info for " + ast);
            }
        });
        return ctx.toSource();
    }
    exports.debugOutputAstAsTypeScript = debugOutputAstAsTypeScript;
    var TypeScriptEmitter = /** @class */ (function () {
        function TypeScriptEmitter() {
        }
        TypeScriptEmitter.prototype.emitStatementsAndContext = function (genFilePath, stmts, preamble, emitSourceMaps, referenceFilter, importFilter) {
            if (preamble === void 0) { preamble = ''; }
            if (emitSourceMaps === void 0) { emitSourceMaps = true; }
            var converter = new _TsEmitterVisitor(referenceFilter, importFilter);
            var ctx = abstract_emitter_1.EmitterVisitorContext.createRoot();
            converter.visitAllStatements(stmts, ctx);
            var preambleLines = preamble ? preamble.split('\n') : [];
            converter.reexports.forEach(function (reexports, exportedModuleName) {
                var reexportsCode = reexports.map(function (reexport) { return reexport.name + " as " + reexport.as; }).join(',');
                preambleLines.push("export {" + reexportsCode + "} from '" + exportedModuleName + "';");
            });
            converter.importsWithPrefixes.forEach(function (prefix, importedModuleName) {
                // Note: can't write the real word for import as it screws up system.js auto detection...
                preambleLines.push("imp" +
                    ("ort * as " + prefix + " from '" + importedModuleName + "';"));
            });
            var sm = emitSourceMaps ?
                ctx.toSourceMapGenerator(genFilePath, preambleLines.length).toJsComment() :
                '';
            var lines = tslib_1.__spread(preambleLines, [ctx.toSource(), sm]);
            if (sm) {
                // always add a newline at the end, as some tools have bugs without it.
                lines.push('');
            }
            ctx.setPreambleLineCount(preambleLines.length);
            return { sourceText: lines.join('\n'), context: ctx };
        };
        TypeScriptEmitter.prototype.emitStatements = function (genFilePath, stmts, preamble) {
            if (preamble === void 0) { preamble = ''; }
            return this.emitStatementsAndContext(genFilePath, stmts, preamble).sourceText;
        };
        return TypeScriptEmitter;
    }());
    exports.TypeScriptEmitter = TypeScriptEmitter;
    var _TsEmitterVisitor = /** @class */ (function (_super) {
        tslib_1.__extends(_TsEmitterVisitor, _super);
        function _TsEmitterVisitor(referenceFilter, importFilter) {
            var _this = _super.call(this, false) || this;
            _this.referenceFilter = referenceFilter;
            _this.importFilter = importFilter;
            _this.typeExpression = 0;
            _this.importsWithPrefixes = new Map();
            _this.reexports = new Map();
            return _this;
        }
        _TsEmitterVisitor.prototype.visitType = function (t, ctx, defaultType) {
            if (defaultType === void 0) { defaultType = 'any'; }
            if (t) {
                this.typeExpression++;
                t.visitType(this, ctx);
                this.typeExpression--;
            }
            else {
                ctx.print(null, defaultType);
            }
        };
        _TsEmitterVisitor.prototype.visitLiteralExpr = function (ast, ctx) {
            var value = ast.value;
            if (value == null && ast.type != o.INFERRED_TYPE) {
                ctx.print(ast, "(" + value + " as any)");
                return null;
            }
            return _super.prototype.visitLiteralExpr.call(this, ast, ctx);
        };
        // Temporary workaround to support strictNullCheck enabled consumers of ngc emit.
        // In SNC mode, [] have the type never[], so we cast here to any[].
        // TODO: narrow the cast to a more explicit type, or use a pattern that does not
        // start with [].concat. see https://github.com/angular/angular/pull/11846
        _TsEmitterVisitor.prototype.visitLiteralArrayExpr = function (ast, ctx) {
            if (ast.entries.length === 0) {
                ctx.print(ast, '(');
            }
            var result = _super.prototype.visitLiteralArrayExpr.call(this, ast, ctx);
            if (ast.entries.length === 0) {
                ctx.print(ast, ' as any[])');
            }
            return result;
        };
        _TsEmitterVisitor.prototype.visitExternalExpr = function (ast, ctx) {
            this._visitIdentifier(ast.value, ast.typeParams, ctx);
            return null;
        };
        _TsEmitterVisitor.prototype.visitAssertNotNullExpr = function (ast, ctx) {
            var result = _super.prototype.visitAssertNotNullExpr.call(this, ast, ctx);
            ctx.print(ast, '!');
            return result;
        };
        _TsEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) {
            if (stmt.hasModifier(o.StmtModifier.Exported) && stmt.value instanceof o.ExternalExpr &&
                !stmt.type) {
                // check for a reexport
                var _a = stmt.value.value, name_1 = _a.name, moduleName = _a.moduleName;
                if (moduleName) {
                    var reexports = this.reexports.get(moduleName);
                    if (!reexports) {
                        reexports = [];
                        this.reexports.set(moduleName, reexports);
                    }
                    reexports.push({ name: name_1, as: stmt.name });
                    return null;
                }
            }
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.print(stmt, "export ");
            }
            if (stmt.hasModifier(o.StmtModifier.Final)) {
                ctx.print(stmt, "const");
            }
            else {
                ctx.print(stmt, "var");
            }
            ctx.print(stmt, " " + stmt.name);
            this._printColonType(stmt.type, ctx);
            if (stmt.value) {
                ctx.print(stmt, " = ");
                stmt.value.visitExpression(this, ctx);
            }
            ctx.println(stmt, ";");
            return null;
        };
        _TsEmitterVisitor.prototype.visitWrappedNodeExpr = function (ast, ctx) {
            throw new Error('Cannot visit a WrappedNodeExpr when outputting Typescript.');
        };
        _TsEmitterVisitor.prototype.visitCastExpr = function (ast, ctx) {
            ctx.print(ast, "(<");
            ast.type.visitType(this, ctx);
            ctx.print(ast, ">");
            ast.value.visitExpression(this, ctx);
            ctx.print(ast, ")");
            return null;
        };
        _TsEmitterVisitor.prototype.visitInstantiateExpr = function (ast, ctx) {
            ctx.print(ast, "new ");
            this.typeExpression++;
            ast.classExpr.visitExpression(this, ctx);
            this.typeExpression--;
            ctx.print(ast, "(");
            this.visitAllExpressions(ast.args, ctx, ',');
            ctx.print(ast, ")");
            return null;
        };
        _TsEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) {
            var _this = this;
            ctx.pushClass(stmt);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.print(stmt, "export ");
            }
            ctx.print(stmt, "class " + stmt.name);
            if (stmt.parent != null) {
                ctx.print(stmt, " extends ");
                this.typeExpression++;
                stmt.parent.visitExpression(this, ctx);
                this.typeExpression--;
            }
            ctx.println(stmt, " {");
            ctx.incIndent();
            stmt.fields.forEach(function (field) { return _this._visitClassField(field, ctx); });
            if (stmt.constructorMethod != null) {
                this._visitClassConstructor(stmt, ctx);
            }
            stmt.getters.forEach(function (getter) { return _this._visitClassGetter(getter, ctx); });
            stmt.methods.forEach(function (method) { return _this._visitClassMethod(method, ctx); });
            ctx.decIndent();
            ctx.println(stmt, "}");
            ctx.popClass();
            return null;
        };
        _TsEmitterVisitor.prototype._visitClassField = function (field, ctx) {
            if (field.hasModifier(o.StmtModifier.Private)) {
                // comment out as a workaround for #10967
                ctx.print(null, "/*private*/ ");
            }
            if (field.hasModifier(o.StmtModifier.Static)) {
                ctx.print(null, 'static ');
            }
            ctx.print(null, field.name);
            this._printColonType(field.type, ctx);
            if (field.initializer) {
                ctx.print(null, ' = ');
                field.initializer.visitExpression(this, ctx);
            }
            ctx.println(null, ";");
        };
        _TsEmitterVisitor.prototype._visitClassGetter = function (getter, ctx) {
            if (getter.hasModifier(o.StmtModifier.Private)) {
                ctx.print(null, "private ");
            }
            ctx.print(null, "get " + getter.name + "()");
            this._printColonType(getter.type, ctx);
            ctx.println(null, " {");
            ctx.incIndent();
            this.visitAllStatements(getter.body, ctx);
            ctx.decIndent();
            ctx.println(null, "}");
        };
        _TsEmitterVisitor.prototype._visitClassConstructor = function (stmt, ctx) {
            ctx.print(stmt, "constructor(");
            this._visitParams(stmt.constructorMethod.params, ctx);
            ctx.println(stmt, ") {");
            ctx.incIndent();
            this.visitAllStatements(stmt.constructorMethod.body, ctx);
            ctx.decIndent();
            ctx.println(stmt, "}");
        };
        _TsEmitterVisitor.prototype._visitClassMethod = function (method, ctx) {
            if (method.hasModifier(o.StmtModifier.Private)) {
                ctx.print(null, "private ");
            }
            ctx.print(null, method.name + "(");
            this._visitParams(method.params, ctx);
            ctx.print(null, ")");
            this._printColonType(method.type, ctx, 'void');
            ctx.println(null, " {");
            ctx.incIndent();
            this.visitAllStatements(method.body, ctx);
            ctx.decIndent();
            ctx.println(null, "}");
        };
        _TsEmitterVisitor.prototype.visitFunctionExpr = function (ast, ctx) {
            if (ast.name) {
                ctx.print(ast, 'function ');
                ctx.print(ast, ast.name);
            }
            ctx.print(ast, "(");
            this._visitParams(ast.params, ctx);
            ctx.print(ast, ")");
            this._printColonType(ast.type, ctx, 'void');
            if (!ast.name) {
                ctx.print(ast, " => ");
            }
            ctx.println(ast, '{');
            ctx.incIndent();
            this.visitAllStatements(ast.statements, ctx);
            ctx.decIndent();
            ctx.print(ast, "}");
            return null;
        };
        _TsEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.print(stmt, "export ");
            }
            ctx.print(stmt, "function " + stmt.name + "(");
            this._visitParams(stmt.params, ctx);
            ctx.print(stmt, ")");
            this._printColonType(stmt.type, ctx, 'void');
            ctx.println(stmt, " {");
            ctx.incIndent();
            this.visitAllStatements(stmt.statements, ctx);
            ctx.decIndent();
            ctx.println(stmt, "}");
            return null;
        };
        _TsEmitterVisitor.prototype.visitTryCatchStmt = function (stmt, ctx) {
            ctx.println(stmt, "try {");
            ctx.incIndent();
            this.visitAllStatements(stmt.bodyStmts, ctx);
            ctx.decIndent();
            ctx.println(stmt, "} catch (" + abstract_emitter_1.CATCH_ERROR_VAR.name + ") {");
            ctx.incIndent();
            var catchStmts = [abstract_emitter_1.CATCH_STACK_VAR.set(abstract_emitter_1.CATCH_ERROR_VAR.prop('stack', null)).toDeclStmt(null, [
                    o.StmtModifier.Final
                ])].concat(stmt.catchStmts);
            this.visitAllStatements(catchStmts, ctx);
            ctx.decIndent();
            ctx.println(stmt, "}");
            return null;
        };
        _TsEmitterVisitor.prototype.visitBuiltinType = function (type, ctx) {
            var typeStr;
            switch (type.name) {
                case o.BuiltinTypeName.Bool:
                    typeStr = 'boolean';
                    break;
                case o.BuiltinTypeName.Dynamic:
                    typeStr = 'any';
                    break;
                case o.BuiltinTypeName.Function:
                    typeStr = 'Function';
                    break;
                case o.BuiltinTypeName.Number:
                    typeStr = 'number';
                    break;
                case o.BuiltinTypeName.Int:
                    typeStr = 'number';
                    break;
                case o.BuiltinTypeName.String:
                    typeStr = 'string';
                    break;
                case o.BuiltinTypeName.None:
                    typeStr = 'never';
                    break;
                default:
                    throw new Error("Unsupported builtin type " + type.name);
            }
            ctx.print(null, typeStr);
            return null;
        };
        _TsEmitterVisitor.prototype.visitExpressionType = function (ast, ctx) {
            var _this = this;
            ast.value.visitExpression(this, ctx);
            if (ast.typeParams !== null) {
                ctx.print(null, '<');
                this.visitAllObjects(function (type) { return _this.visitType(type, ctx); }, ast.typeParams, ctx, ',');
                ctx.print(null, '>');
            }
            return null;
        };
        _TsEmitterVisitor.prototype.visitArrayType = function (type, ctx) {
            this.visitType(type.of, ctx);
            ctx.print(null, "[]");
            return null;
        };
        _TsEmitterVisitor.prototype.visitMapType = function (type, ctx) {
            ctx.print(null, "{[key: string]:");
            this.visitType(type.valueType, ctx);
            ctx.print(null, "}");
            return null;
        };
        _TsEmitterVisitor.prototype.getBuiltinMethodName = function (method) {
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
        _TsEmitterVisitor.prototype._visitParams = function (params, ctx) {
            var _this = this;
            this.visitAllObjects(function (param) {
                ctx.print(null, param.name);
                _this._printColonType(param.type, ctx);
            }, params, ctx, ',');
        };
        _TsEmitterVisitor.prototype._visitIdentifier = function (value, typeParams, ctx) {
            var _this = this;
            var name = value.name, moduleName = value.moduleName;
            if (this.referenceFilter && this.referenceFilter(value)) {
                ctx.print(null, '(null as any)');
                return;
            }
            if (moduleName && (!this.importFilter || !this.importFilter(value))) {
                var prefix = this.importsWithPrefixes.get(moduleName);
                if (prefix == null) {
                    prefix = "i" + this.importsWithPrefixes.size;
                    this.importsWithPrefixes.set(moduleName, prefix);
                }
                ctx.print(null, prefix + ".");
            }
            ctx.print(null, name);
            if (this.typeExpression > 0) {
                // If we are in a type expression that refers to a generic type then supply
                // the required type parameters. If there were not enough type parameters
                // supplied, supply any as the type. Outside a type expression the reference
                // should not supply type parameters and be treated as a simple value reference
                // to the constructor function itself.
                var suppliedParameters = typeParams || [];
                if (suppliedParameters.length > 0) {
                    ctx.print(null, "<");
                    this.visitAllObjects(function (type) { return type.visitType(_this, ctx); }, typeParams, ctx, ',');
                    ctx.print(null, ">");
                }
            }
        };
        _TsEmitterVisitor.prototype._printColonType = function (type, ctx, defaultType) {
            if (type !== o.INFERRED_TYPE) {
                ctx.print(null, ':');
                this.visitType(type, ctx, defaultType);
            }
        };
        return _TsEmitterVisitor;
    }(abstract_emitter_1.AbstractEmitterVisitor));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHNfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvdHNfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBTUgsa0ZBQWtJO0lBQ2xJLDJEQUFrQztJQUVsQyxJQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7SUFFcEMsU0FBZ0IsMEJBQTBCLENBQUMsR0FBMEM7UUFDbkYsSUFBTSxTQUFTLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1FBQzFDLElBQU0sR0FBRyxHQUFHLHdDQUFxQixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQy9DLElBQU0sSUFBSSxHQUFVLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVyRCxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQUMsR0FBRztZQUNmLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxTQUFTLEVBQUU7Z0JBQzlCLEdBQUcsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQ3BDO2lCQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxVQUFVLEVBQUU7Z0JBQ3RDLEdBQUcsQ0FBQyxlQUFlLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQ3JDO2lCQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2hDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQy9CO2lCQUFNO2dCQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTBDLEdBQUssQ0FBQyxDQUFDO2FBQ2xFO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLEdBQUcsQ0FBQyxRQUFR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QUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQzthQUN4QztRQUNILENBQUM7UUFDSCx3QkFBQztJQUFELENBQUMsQUE3V0QsQ0FBZ0MseUNBQXNCLEdBNldyRCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlSWRlbnRpZmllck1ldGFkYXRhfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcblxuaW1wb3J0IHtBYnN0cmFjdEVtaXR0ZXJWaXNpdG9yLCBDQVRDSF9FUlJPUl9WQVIsIENBVENIX1NUQUNLX1ZBUiwgRW1pdHRlclZpc2l0b3JDb250ZXh0LCBPdXRwdXRFbWl0dGVyfSBmcm9tICcuL2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuXG5jb25zdCBfZGVidWdGaWxlUGF0aCA9ICcvZGVidWcvbGliJztcblxuZXhwb3J0IGZ1bmN0aW9uIGRlYnVnT3V0cHV0QXN0QXNUeXBlU2NyaXB0KGFzdDogby5TdGF0ZW1lbnR8by5FeHByZXNzaW9ufG8uVHlwZXxhbnlbXSk6IHN0cmluZyB7XG4gIGNvbnN0IGNvbnZlcnRlciA9IG5ldyBfVHNFbWl0dGVyVmlzaXRvcigpO1xuICBjb25zdCBjdHggPSBFbWl0dGVyVmlzaXRvckNvbnRleHQuY3JlYXRlUm9vdCgpO1xuICBjb25zdCBhc3RzOiBhbnlbXSA9IEFycmF5LmlzQXJyYXkoYXN0KSA/IGFzdCA6IFthc3RdO1xuXG4gIGFzdHMuZm9yRWFjaCgoYXN0KSA9PiB7XG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIG8uU3RhdGVtZW50KSB7XG4gICAgICBhc3QudmlzaXRTdGF0ZW1lbnQoY29udmVydGVyLCBjdHgpO1xuICAgIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uKSB7XG4gICAgICBhc3QudmlzaXRFeHByZXNzaW9uKGNvbnZlcnRlciwgY3R4KTtcbiAgICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIG8uVHlwZSkge1xuICAgICAgYXN0LnZpc2l0VHlwZShjb252ZXJ0ZXIsIGN0eCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRG9uJ3Qga25vdyBob3cgdG8gcHJpbnQgZGVidWcgaW5mbyBmb3IgJHthc3R9YCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGN0eC50b1NvdXJjZSgpO1xufVxuXG5leHBvcnQgdHlwZSBSZWZlcmVuY2VGaWx0ZXIgPSAocmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlKSA9PiBib29sZWFuO1xuXG5leHBvcnQgY2xhc3MgVHlwZVNjcmlwdEVtaXR0ZXIgaW1wbGVtZW50cyBPdXRwdXRFbWl0dGVyIHtcbiAgZW1pdFN0YXRlbWVudHNBbmRDb250ZXh0KFxuICAgICAgZ2VuRmlsZVBhdGg6IHN0cmluZywgc3RtdHM6IG8uU3RhdGVtZW50W10sIHByZWFtYmxlOiBzdHJpbmcgPSAnJyxcbiAgICAgIGVtaXRTb3VyY2VNYXBzOiBib29sZWFuID0gdHJ1ZSwgcmVmZXJlbmNlRmlsdGVyPzogUmVmZXJlbmNlRmlsdGVyLFxuICAgICAgaW1wb3J0RmlsdGVyPzogUmVmZXJlbmNlRmlsdGVyKToge3NvdXJjZVRleHQ6IHN0cmluZywgY29udGV4dDogRW1pdHRlclZpc2l0b3JDb250ZXh0fSB7XG4gICAgY29uc3QgY29udmVydGVyID0gbmV3IF9Uc0VtaXR0ZXJWaXNpdG9yKHJlZmVyZW5jZUZpbHRlciwgaW1wb3J0RmlsdGVyKTtcblxuICAgIGNvbnN0IGN0eCA9IEVtaXR0ZXJWaXNpdG9yQ29udGV4dC5jcmVhdGVSb290KCk7XG5cbiAgICBjb252ZXJ0ZXIudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzLCBjdHgpO1xuXG4gICAgY29uc3QgcHJlYW1ibGVMaW5lcyA9IHByZWFtYmxlID8gcHJlYW1ibGUuc3BsaXQoJ1xcbicpIDogW107XG4gICAgY29udmVydGVyLnJlZXhwb3J0cy5mb3JFYWNoKChyZWV4cG9ydHMsIGV4cG9ydGVkTW9kdWxlTmFtZSkgPT4ge1xuICAgICAgY29uc3QgcmVleHBvcnRzQ29kZSA9XG4gICAgICAgICAgcmVleHBvcnRzLm1hcChyZWV4cG9ydCA9PiBgJHtyZWV4cG9ydC5uYW1lfSBhcyAke3JlZXhwb3J0LmFzfWApLmpvaW4oJywnKTtcbiAgICAgIHByZWFtYmxlTGluZXMucHVzaChgZXhwb3J0IHske3JlZXhwb3J0c0NvZGV9fSBmcm9tICcke2V4cG9ydGVkTW9kdWxlTmFtZX0nO2ApO1xuICAgIH0pO1xuXG4gICAgY29udmVydGVyLmltcG9ydHNXaXRoUHJlZml4ZXMuZm9yRWFjaCgocHJlZml4LCBpbXBvcnRlZE1vZHVsZU5hbWUpID0+IHtcbiAgICAgIC8vIE5vdGU6IGNhbid0IHdyaXRlIHRoZSByZWFsIHdvcmQgZm9yIGltcG9ydCBhcyBpdCBzY3Jld3MgdXAgc3lzdGVtLmpzIGF1dG8gZGV0ZWN0aW9uLi4uXG4gICAgICBwcmVhbWJsZUxpbmVzLnB1c2goXG4gICAgICAgICAgYGltcGAgK1xuICAgICAgICAgIGBvcnQgKiBhcyAke3ByZWZpeH0gZnJvbSAnJHtpbXBvcnRlZE1vZHVsZU5hbWV9JztgKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHNtID0gZW1pdFNvdXJjZU1hcHMgP1xuICAgICAgICBjdHgudG9Tb3VyY2VNYXBHZW5lcmF0b3IoZ2VuRmlsZVBhdGgsIHByZWFtYmxlTGluZXMubGVuZ3RoKS50b0pzQ29tbWVudCgpIDpcbiAgICAgICAgJyc7XG4gICAgY29uc3QgbGluZXMgPSBbLi4ucHJlYW1ibGVMaW5lcywgY3R4LnRvU291cmNlKCksIHNtXTtcbiAgICBpZiAoc20pIHtcbiAgICAgIC8vIGFsd2F5cyBhZGQgYSBuZXdsaW5lIGF0IHRoZSBlbmQsIGFzIHNvbWUgdG9vbHMgaGF2ZSBidWdzIHdpdGhvdXQgaXQuXG4gICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICB9XG4gICAgY3R4LnNldFByZWFtYmxlTGluZUNvdW50KHByZWFtYmxlTGluZXMubGVuZ3RoKTtcbiAgICByZXR1cm4ge3NvdXJjZVRleHQ6IGxpbmVzLmpvaW4oJ1xcbicpLCBjb250ZXh0OiBjdHh9O1xuICB9XG5cbiAgZW1pdFN0YXRlbWVudHMoZ2VuRmlsZVBhdGg6IHN0cmluZywgc3RtdHM6IG8uU3RhdGVtZW50W10sIHByZWFtYmxlOiBzdHJpbmcgPSAnJykge1xuICAgIHJldHVybiB0aGlzLmVtaXRTdGF0ZW1lbnRzQW5kQ29udGV4dChnZW5GaWxlUGF0aCwgc3RtdHMsIHByZWFtYmxlKS5zb3VyY2VUZXh0O1xuICB9XG59XG5cblxuY2xhc3MgX1RzRW1pdHRlclZpc2l0b3IgZXh0ZW5kcyBBYnN0cmFjdEVtaXR0ZXJWaXNpdG9yIGltcGxlbWVudHMgby5UeXBlVmlzaXRvciB7XG4gIHByaXZhdGUgdHlwZUV4cHJlc3Npb24gPSAwO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVmZXJlbmNlRmlsdGVyPzogUmVmZXJlbmNlRmlsdGVyLCBwcml2YXRlIGltcG9ydEZpbHRlcj86IFJlZmVyZW5jZUZpbHRlcikge1xuICAgIHN1cGVyKGZhbHNlKTtcbiAgfVxuXG4gIGltcG9ydHNXaXRoUHJlZml4ZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICByZWV4cG9ydHMgPSBuZXcgTWFwPHN0cmluZywge25hbWU6IHN0cmluZywgYXM6IHN0cmluZ31bXT4oKTtcblxuICB2aXNpdFR5cGUodDogby5UeXBlfG51bGwsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0LCBkZWZhdWx0VHlwZTogc3RyaW5nID0gJ2FueScpIHtcbiAgICBpZiAodCkge1xuICAgICAgdGhpcy50eXBlRXhwcmVzc2lvbisrO1xuICAgICAgdC52aXNpdFR5cGUodGhpcywgY3R4KTtcbiAgICAgIHRoaXMudHlwZUV4cHJlc3Npb24tLTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3R4LnByaW50KG51bGwsIGRlZmF1bHRUeXBlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogby5MaXRlcmFsRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsICYmIGFzdC50eXBlICE9IG8uSU5GRVJSRURfVFlQRSkge1xuICAgICAgY3R4LnByaW50KGFzdCwgYCgke3ZhbHVlfSBhcyBhbnkpYCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0TGl0ZXJhbEV4cHIoYXN0LCBjdHgpO1xuICB9XG5cblxuICAvLyBUZW1wb3Jhcnkgd29ya2Fyb3VuZCB0byBzdXBwb3J0IHN0cmljdE51bGxDaGVjayBlbmFibGVkIGNvbnN1bWVycyBvZiBuZ2MgZW1pdC5cbiAgLy8gSW4gU05DIG1vZGUsIFtdIGhhdmUgdGhlIHR5cGUgbmV2ZXJbXSwgc28gd2UgY2FzdCBoZXJlIHRvIGFueVtdLlxuICAvLyBUT0RPOiBuYXJyb3cgdGhlIGNhc3QgdG8gYSBtb3JlIGV4cGxpY2l0IHR5cGUsIG9yIHVzZSBhIHBhdHRlcm4gdGhhdCBkb2VzIG5vdFxuICAvLyBzdGFydCB3aXRoIFtdLmNvbmNhdC4gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvcHVsbC8xMTg0NlxuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBpZiAoYXN0LmVudHJpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjdHgucHJpbnQoYXN0LCAnKCcpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci52aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0LCBjdHgpO1xuICAgIGlmIChhc3QuZW50cmllcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGN0eC5wcmludChhc3QsICcgYXMgYW55W10pJyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgdGhpcy5fdmlzaXRJZGVudGlmaWVyKGFzdC52YWx1ZSwgYXN0LnR5cGVQYXJhbXMsIGN0eCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogby5Bc3NlcnROb3ROdWxsLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIudmlzaXRBc3NlcnROb3ROdWxsRXhwcihhc3QsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgJyEnKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpICYmIHN0bXQudmFsdWUgaW5zdGFuY2VvZiBvLkV4dGVybmFsRXhwciAmJlxuICAgICAgICAhc3RtdC50eXBlKSB7XG4gICAgICAvLyBjaGVjayBmb3IgYSByZWV4cG9ydFxuICAgICAgY29uc3Qge25hbWUsIG1vZHVsZU5hbWV9ID0gc3RtdC52YWx1ZS52YWx1ZTtcbiAgICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAgIGxldCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobW9kdWxlTmFtZSk7XG4gICAgICAgIGlmICghcmVleHBvcnRzKSB7XG4gICAgICAgICAgcmVleHBvcnRzID0gW107XG4gICAgICAgICAgdGhpcy5yZWV4cG9ydHMuc2V0KG1vZHVsZU5hbWUsIHJlZXhwb3J0cyk7XG4gICAgICAgIH1cbiAgICAgICAgcmVleHBvcnRzLnB1c2goe25hbWU6IG5hbWUhLCBhczogc3RtdC5uYW1lfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5wcmludChzdG10LCBgZXhwb3J0IGApO1xuICAgIH1cbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5GaW5hbCkpIHtcbiAgICAgIGN0eC5wcmludChzdG10LCBgY29uc3RgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3R4LnByaW50KHN0bXQsIGB2YXJgKTtcbiAgICB9XG4gICAgY3R4LnByaW50KHN0bXQsIGAgJHtzdG10Lm5hbWV9YCk7XG4gICAgdGhpcy5fcHJpbnRDb2xvblR5cGUoc3RtdC50eXBlLCBjdHgpO1xuICAgIGlmIChzdG10LnZhbHVlKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYCA9IGApO1xuICAgICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICB9XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYDtgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0V3JhcHBlZE5vZGVFeHByKGFzdDogby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdmlzaXQgYSBXcmFwcGVkTm9kZUV4cHIgd2hlbiBvdXRwdXR0aW5nIFR5cGVzY3JpcHQuJyk7XG4gIH1cblxuICB2aXNpdENhc3RFeHByKGFzdDogby5DYXN0RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsIGAoPGApO1xuICAgIGFzdC50eXBlIS52aXNpdFR5cGUodGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgPmApO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBvLkluc3RhbnRpYXRlRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsIGBuZXcgYCk7XG4gICAgdGhpcy50eXBlRXhwcmVzc2lvbisrO1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgdGhpcy50eXBlRXhwcmVzc2lvbi0tO1xuICAgIGN0eC5wcmludChhc3QsIGAoYCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBvLkNsYXNzU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wdXNoQ2xhc3Moc3RtdCk7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYGV4cG9ydCBgKTtcbiAgICB9XG4gICAgY3R4LnByaW50KHN0bXQsIGBjbGFzcyAke3N0bXQubmFtZX1gKTtcbiAgICBpZiAoc3RtdC5wYXJlbnQgIT0gbnVsbCkge1xuICAgICAgY3R4LnByaW50KHN0bXQsIGAgZXh0ZW5kcyBgKTtcbiAgICAgIHRoaXMudHlwZUV4cHJlc3Npb24rKztcbiAgICAgIHN0bXQucGFyZW50LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgICAgdGhpcy50eXBlRXhwcmVzc2lvbi0tO1xuICAgIH1cbiAgICBjdHgucHJpbnRsbihzdG10LCBgIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgc3RtdC5maWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHRoaXMuX3Zpc2l0Q2xhc3NGaWVsZChmaWVsZCwgY3R4KSk7XG4gICAgaWYgKHN0bXQuY29uc3RydWN0b3JNZXRob2QgIT0gbnVsbCkge1xuICAgICAgdGhpcy5fdmlzaXRDbGFzc0NvbnN0cnVjdG9yKHN0bXQsIGN0eCk7XG4gICAgfVxuICAgIHN0bXQuZ2V0dGVycy5mb3JFYWNoKChnZXR0ZXIpID0+IHRoaXMuX3Zpc2l0Q2xhc3NHZXR0ZXIoZ2V0dGVyLCBjdHgpKTtcbiAgICBzdG10Lm1ldGhvZHMuZm9yRWFjaCgobWV0aG9kKSA9PiB0aGlzLl92aXNpdENsYXNzTWV0aG9kKG1ldGhvZCwgY3R4KSk7XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gICAgY3R4LnBvcENsYXNzKCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdENsYXNzRmllbGQoZmllbGQ6IG8uQ2xhc3NGaWVsZCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpIHtcbiAgICBpZiAoZmllbGQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuUHJpdmF0ZSkpIHtcbiAgICAgIC8vIGNvbW1lbnQgb3V0IGFzIGEgd29ya2Fyb3VuZCBmb3IgIzEwOTY3XG4gICAgICBjdHgucHJpbnQobnVsbCwgYC8qcHJpdmF0ZSovIGApO1xuICAgIH1cbiAgICBpZiAoZmllbGQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuU3RhdGljKSkge1xuICAgICAgY3R4LnByaW50KG51bGwsICdzdGF0aWMgJyk7XG4gICAgfVxuICAgIGN0eC5wcmludChudWxsLCBmaWVsZC5uYW1lKTtcbiAgICB0aGlzLl9wcmludENvbG9uVHlwZShmaWVsZC50eXBlLCBjdHgpO1xuICAgIGlmIChmaWVsZC5pbml0aWFsaXplcikge1xuICAgICAgY3R4LnByaW50KG51bGwsICcgPSAnKTtcbiAgICAgIGZpZWxkLmluaXRpYWxpemVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH1cbiAgICBjdHgucHJpbnRsbihudWxsLCBgO2ApO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRDbGFzc0dldHRlcihnZXR0ZXI6IG8uQ2xhc3NHZXR0ZXIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KSB7XG4gICAgaWYgKGdldHRlci5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5Qcml2YXRlKSkge1xuICAgICAgY3R4LnByaW50KG51bGwsIGBwcml2YXRlIGApO1xuICAgIH1cbiAgICBjdHgucHJpbnQobnVsbCwgYGdldCAke2dldHRlci5uYW1lfSgpYCk7XG4gICAgdGhpcy5fcHJpbnRDb2xvblR5cGUoZ2V0dGVyLnR5cGUsIGN0eCk7XG4gICAgY3R4LnByaW50bG4obnVsbCwgYCB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGdldHRlci5ib2R5LCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnRsbihudWxsLCBgfWApO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRDbGFzc0NvbnN0cnVjdG9yKHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCkge1xuICAgIGN0eC5wcmludChzdG10LCBgY29uc3RydWN0b3IoYCk7XG4gICAgdGhpcy5fdmlzaXRQYXJhbXMoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5wYXJhbXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYCkge2ApO1xuICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGN0eCk7XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdENsYXNzTWV0aG9kKG1ldGhvZDogby5DbGFzc01ldGhvZCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpIHtcbiAgICBpZiAobWV0aG9kLmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLlByaXZhdGUpKSB7XG4gICAgICBjdHgucHJpbnQobnVsbCwgYHByaXZhdGUgYCk7XG4gICAgfVxuICAgIGN0eC5wcmludChudWxsLCBgJHttZXRob2QubmFtZX0oYCk7XG4gICAgdGhpcy5fdmlzaXRQYXJhbXMobWV0aG9kLnBhcmFtcywgY3R4KTtcbiAgICBjdHgucHJpbnQobnVsbCwgYClgKTtcbiAgICB0aGlzLl9wcmludENvbG9uVHlwZShtZXRob2QudHlwZSwgY3R4LCAndm9pZCcpO1xuICAgIGN0eC5wcmludGxuKG51bGwsIGAge2ApO1xuICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhtZXRob2QuYm9keSwgY3R4KTtcbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4obnVsbCwgYH1gKTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogby5GdW5jdGlvbkV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBpZiAoYXN0Lm5hbWUpIHtcbiAgICAgIGN0eC5wcmludChhc3QsICdmdW5jdGlvbiAnKTtcbiAgICAgIGN0eC5wcmludChhc3QsIGFzdC5uYW1lKTtcbiAgICB9XG4gICAgY3R4LnByaW50KGFzdCwgYChgKTtcbiAgICB0aGlzLl92aXNpdFBhcmFtcyhhc3QucGFyYW1zLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGApYCk7XG4gICAgdGhpcy5fcHJpbnRDb2xvblR5cGUoYXN0LnR5cGUsIGN0eCwgJ3ZvaWQnKTtcbiAgICBpZiAoIWFzdC5uYW1lKSB7XG4gICAgICBjdHgucHJpbnQoYXN0LCBgID0+IGApO1xuICAgIH1cbiAgICBjdHgucHJpbnRsbihhc3QsICd7Jyk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGFzdC5zdGF0ZW1lbnRzLCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgfWApO1xuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYGV4cG9ydCBgKTtcbiAgICB9XG4gICAgY3R4LnByaW50KHN0bXQsIGBmdW5jdGlvbiAke3N0bXQubmFtZX0oYCk7XG4gICAgdGhpcy5fdmlzaXRQYXJhbXMoc3RtdC5wYXJhbXMsIGN0eCk7XG4gICAgY3R4LnByaW50KHN0bXQsIGApYCk7XG4gICAgdGhpcy5fcHJpbnRDb2xvblR5cGUoc3RtdC50eXBlLCBjdHgsICd2b2lkJyk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYCB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuc3RhdGVtZW50cywgY3R4KTtcbiAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IG8uVHJ5Q2F0Y2hTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYHRyeSB7YCk7XG4gICAgY3R4LmluY0luZGVudCgpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuYm9keVN0bXRzLCBjdHgpO1xuICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgfSBjYXRjaCAoJHtDQVRDSF9FUlJPUl9WQVIubmFtZX0pIHtgKTtcbiAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgY29uc3QgY2F0Y2hTdG10cyA9XG4gICAgICAgIFs8by5TdGF0ZW1lbnQ+Q0FUQ0hfU1RBQ0tfVkFSLnNldChDQVRDSF9FUlJPUl9WQVIucHJvcCgnc3RhY2snLCBudWxsKSkudG9EZWNsU3RtdChudWxsLCBbXG4gICAgICAgICAgby5TdG10TW9kaWZpZXIuRmluYWxcbiAgICAgICAgXSldLmNvbmNhdChzdG10LmNhdGNoU3RtdHMpO1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGNhdGNoU3RtdHMsIGN0eCk7XG4gICAgY3R4LmRlY0luZGVudCgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEJ1aWx0aW5UeXBlKHR5cGU6IG8uQnVpbHRpblR5cGUsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBsZXQgdHlwZVN0cjogc3RyaW5nO1xuICAgIHN3aXRjaCAodHlwZS5uYW1lKSB7XG4gICAgICBjYXNlIG8uQnVpbHRpblR5cGVOYW1lLkJvb2w6XG4gICAgICAgIHR5cGVTdHIgPSAnYm9vbGVhbic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljOlxuICAgICAgICB0eXBlU3RyID0gJ2FueSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJ1aWx0aW5UeXBlTmFtZS5GdW5jdGlvbjpcbiAgICAgICAgdHlwZVN0ciA9ICdGdW5jdGlvbic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJ1aWx0aW5UeXBlTmFtZS5OdW1iZXI6XG4gICAgICAgIHR5cGVTdHIgPSAnbnVtYmVyJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQnVpbHRpblR5cGVOYW1lLkludDpcbiAgICAgICAgdHlwZVN0ciA9ICdudW1iZXInO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CdWlsdGluVHlwZU5hbWUuU3RyaW5nOlxuICAgICAgICB0eXBlU3RyID0gJ3N0cmluZyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJ1aWx0aW5UeXBlTmFtZS5Ob25lOlxuICAgICAgICB0eXBlU3RyID0gJ25ldmVyJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGJ1aWx0aW4gdHlwZSAke3R5cGUubmFtZX1gKTtcbiAgICB9XG4gICAgY3R4LnByaW50KG51bGwsIHR5cGVTdHIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uVHlwZShhc3Q6IG8uRXhwcmVzc2lvblR5cGUsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBhc3QudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKGFzdC50eXBlUGFyYW1zICE9PSBudWxsKSB7XG4gICAgICBjdHgucHJpbnQobnVsbCwgJzwnKTtcbiAgICAgIHRoaXMudmlzaXRBbGxPYmplY3RzKHR5cGUgPT4gdGhpcy52aXNpdFR5cGUodHlwZSwgY3R4KSwgYXN0LnR5cGVQYXJhbXMsIGN0eCwgJywnKTtcbiAgICAgIGN0eC5wcmludChudWxsLCAnPicpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IG8uQXJyYXlUeXBlLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgdGhpcy52aXNpdFR5cGUodHlwZS5vZiwgY3R4KTtcbiAgICBjdHgucHJpbnQobnVsbCwgYFtdYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdE1hcFR5cGUodHlwZTogby5NYXBUeXBlLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KG51bGwsIGB7W2tleTogc3RyaW5nXTpgKTtcbiAgICB0aGlzLnZpc2l0VHlwZSh0eXBlLnZhbHVlVHlwZSwgY3R4KTtcbiAgICBjdHgucHJpbnQobnVsbCwgYH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldEJ1aWx0aW5NZXRob2ROYW1lKG1ldGhvZDogby5CdWlsdGluTWV0aG9kKTogc3RyaW5nIHtcbiAgICBsZXQgbmFtZTogc3RyaW5nO1xuICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICBjYXNlIG8uQnVpbHRpbk1ldGhvZC5Db25jYXRBcnJheTpcbiAgICAgICAgbmFtZSA9ICdjb25jYXQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CdWlsdGluTWV0aG9kLlN1YnNjcmliZU9ic2VydmFibGU6XG4gICAgICAgIG5hbWUgPSAnc3Vic2NyaWJlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQnVpbHRpbk1ldGhvZC5CaW5kOlxuICAgICAgICBuYW1lID0gJ2JpbmQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRQYXJhbXMocGFyYW1zOiBvLkZuUGFyYW1bXSwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiB2b2lkIHtcbiAgICB0aGlzLnZpc2l0QWxsT2JqZWN0cyhwYXJhbSA9PiB7XG4gICAgICBjdHgucHJpbnQobnVsbCwgcGFyYW0ubmFtZSk7XG4gICAgICB0aGlzLl9wcmludENvbG9uVHlwZShwYXJhbS50eXBlLCBjdHgpO1xuICAgIH0sIHBhcmFtcywgY3R4LCAnLCcpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRJZGVudGlmaWVyKFxuICAgICAgdmFsdWU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHR5cGVQYXJhbXM6IG8uVHlwZVtdfG51bGwsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge25hbWUsIG1vZHVsZU5hbWV9ID0gdmFsdWU7XG4gICAgaWYgKHRoaXMucmVmZXJlbmNlRmlsdGVyICYmIHRoaXMucmVmZXJlbmNlRmlsdGVyKHZhbHVlKSkge1xuICAgICAgY3R4LnByaW50KG51bGwsICcobnVsbCBhcyBhbnkpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChtb2R1bGVOYW1lICYmICghdGhpcy5pbXBvcnRGaWx0ZXIgfHwgIXRoaXMuaW1wb3J0RmlsdGVyKHZhbHVlKSkpIHtcbiAgICAgIGxldCBwcmVmaXggPSB0aGlzLmltcG9ydHNXaXRoUHJlZml4ZXMuZ2V0KG1vZHVsZU5hbWUpO1xuICAgICAgaWYgKHByZWZpeCA9PSBudWxsKSB7XG4gICAgICAgIHByZWZpeCA9IGBpJHt0aGlzLmltcG9ydHNXaXRoUHJlZml4ZXMuc2l6ZX1gO1xuICAgICAgICB0aGlzLmltcG9ydHNXaXRoUHJlZml4ZXMuc2V0KG1vZHVsZU5hbWUsIHByZWZpeCk7XG4gICAgICB9XG4gICAgICBjdHgucHJpbnQobnVsbCwgYCR7cHJlZml4fS5gKTtcbiAgICB9XG4gICAgY3R4LnByaW50KG51bGwsIG5hbWUhKTtcblxuICAgIGlmICh0aGlzLnR5cGVFeHByZXNzaW9uID4gMCkge1xuICAgICAgLy8gSWYgd2UgYXJlIGluIGEgdHlwZSBleHByZXNzaW9uIHRoYXQgcmVmZXJzIHRvIGEgZ2VuZXJpYyB0eXBlIHRoZW4gc3VwcGx5XG4gICAgICAvLyB0aGUgcmVxdWlyZWQgdHlwZSBwYXJhbWV0ZXJzLiBJZiB0aGVyZSB3ZXJlIG5vdCBlbm91Z2ggdHlwZSBwYXJhbWV0ZXJzXG4gICAgICAvLyBzdXBwbGllZCwgc3VwcGx5IGFueSBhcyB0aGUgdHlwZS4gT3V0c2lkZSBhIHR5cGUgZXhwcmVzc2lvbiB0aGUgcmVmZXJlbmNlXG4gICAgICAvLyBzaG91bGQgbm90IHN1cHBseSB0eXBlIHBhcmFtZXRlcnMgYW5kIGJlIHRyZWF0ZWQgYXMgYSBzaW1wbGUgdmFsdWUgcmVmZXJlbmNlXG4gICAgICAvLyB0byB0aGUgY29uc3RydWN0b3IgZnVuY3Rpb24gaXRzZWxmLlxuICAgICAgY29uc3Qgc3VwcGxpZWRQYXJhbWV0ZXJzID0gdHlwZVBhcmFtcyB8fCBbXTtcbiAgICAgIGlmIChzdXBwbGllZFBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBjdHgucHJpbnQobnVsbCwgYDxgKTtcbiAgICAgICAgdGhpcy52aXNpdEFsbE9iamVjdHModHlwZSA9PiB0eXBlLnZpc2l0VHlwZSh0aGlzLCBjdHgpLCB0eXBlUGFyYW1zISwgY3R4LCAnLCcpO1xuICAgICAgICBjdHgucHJpbnQobnVsbCwgYD5gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wcmludENvbG9uVHlwZSh0eXBlOiBvLlR5cGV8bnVsbCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQsIGRlZmF1bHRUeXBlPzogc3RyaW5nKSB7XG4gICAgaWYgKHR5cGUgIT09IG8uSU5GRVJSRURfVFlQRSkge1xuICAgICAgY3R4LnByaW50KG51bGwsICc6Jyk7XG4gICAgICB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjdHgsIGRlZmF1bHRUeXBlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==