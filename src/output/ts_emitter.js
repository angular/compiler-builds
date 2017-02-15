/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { StaticSymbol } from '../aot/static_symbol';
import { isBlank, isPresent } from '../facade/lang';
import { AbstractEmitterVisitor, CATCH_ERROR_VAR, CATCH_STACK_VAR, EmitterVisitorContext } from './abstract_emitter';
import * as o from './output_ast';
var /** @type {?} */ _debugFilePath = '/debug/lib';
/**
 * @param {?} ast
 * @return {?}
 */
export function debugOutputAstAsTypeScript(ast) {
    var /** @type {?} */ converter = new _TsEmitterVisitor(_debugFilePath, {
        /**
         * @param {?} filePath
         * @param {?} containingFilePath
         * @return {?}
         */
        fileNameToModuleName: function (filePath, containingFilePath) { return filePath; },
        /**
         * @param {?} symbol
         * @return {?}
         */
        getImportAs: function (symbol) { return null; },
        getTypeArity: function (symbol) { return null; }
    });
    var /** @type {?} */ ctx = EmitterVisitorContext.createRoot([]);
    var /** @type {?} */ asts = Array.isArray(ast) ? ast : [ast];
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
var TypeScriptEmitter = (function () {
    /**
     * @param {?} _importResolver
     */
    function TypeScriptEmitter(_importResolver) {
        this._importResolver = _importResolver;
    }
    /**
     * @param {?} genFilePath
     * @param {?} stmts
     * @param {?} exportedVars
     * @return {?}
     */
    TypeScriptEmitter.prototype.emitStatements = function (genFilePath, stmts, exportedVars) {
        var _this = this;
        var /** @type {?} */ converter = new _TsEmitterVisitor(genFilePath, this._importResolver);
        var /** @type {?} */ ctx = EmitterVisitorContext.createRoot(exportedVars);
        converter.visitAllStatements(stmts, ctx);
        var /** @type {?} */ srcParts = [];
        converter.reexports.forEach(function (reexports, exportedFilePath) {
            var /** @type {?} */ reexportsCode = reexports.map(function (reexport) { return reexport.name + " as " + reexport.as; }).join(',');
            srcParts.push("export {" + reexportsCode + "} from '" + _this._importResolver.fileNameToModuleName(exportedFilePath, genFilePath) + "';");
        });
        converter.importsWithPrefixes.forEach(function (prefix, importedFilePath) {
            // Note: can't write the real word for import as it screws up system.js auto detection...
            srcParts.push("imp" +
                ("ort * as " + prefix + " from '" + _this._importResolver.fileNameToModuleName(importedFilePath, genFilePath) + "';"));
        });
        srcParts.push(ctx.toSource());
        var /** @type {?} */ prefixLines = converter.reexports.size + converter.importsWithPrefixes.size;
        var /** @type {?} */ sm = ctx.toSourceMapGenerator(null, prefixLines).toJsComment();
        if (sm) {
            srcParts.push(sm);
        }
        return srcParts.join('\n');
    };
    return TypeScriptEmitter;
}());
export { TypeScriptEmitter };
function TypeScriptEmitter_tsickle_Closure_declarations() {
    /** @type {?} */
    TypeScriptEmitter.prototype._importResolver;
}
var _TsEmitterVisitor = (function (_super) {
    __extends(_TsEmitterVisitor, _super);
    /**
     * @param {?} _genFilePath
     * @param {?} _importResolver
     */
    function _TsEmitterVisitor(_genFilePath, _importResolver) {
        var _this = _super.call(this, false) || this;
        _this._genFilePath = _genFilePath;
        _this._importResolver = _importResolver;
        _this.typeExpression = 0;
        _this.importsWithPrefixes = new Map();
        _this.reexports = new Map();
        return _this;
    }
    /**
     * @param {?} t
     * @param {?} ctx
     * @param {?=} defaultType
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitType = function (t, ctx, defaultType) {
        if (defaultType === void 0) { defaultType = 'any'; }
        if (isPresent(t)) {
            this.typeExpression++;
            t.visitType(this, ctx);
            this.typeExpression--;
        }
        else {
            ctx.print(null, defaultType);
        }
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitLiteralExpr = function (ast, ctx) {
        var /** @type {?} */ value = ast.value;
        if (isBlank(value) && ast.type != o.NULL_TYPE) {
            ctx.print(ast, "(" + value + " as any)");
            return null;
        }
        return _super.prototype.visitLiteralExpr.call(this, ast, ctx);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitLiteralArrayExpr = function (ast, ctx) {
        if (ast.entries.length === 0) {
            ctx.print(ast, '(');
        }
        var /** @type {?} */ result = _super.prototype.visitLiteralArrayExpr.call(this, ast, ctx);
        if (ast.entries.length === 0) {
            ctx.print(ast, ' as any[])');
        }
        return result;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitExternalExpr = function (ast, ctx) {
        this._visitIdentifier(ast.value, ast.typeParams, ctx);
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) {
        if (ctx.isExportedVar(stmt.name) && stmt.value instanceof o.ExternalExpr && !stmt.type) {
            // check for a reexport
            var _a = this._resolveStaticSymbol(stmt.value.value), name_1 = _a.name, filePath = _a.filePath, members = _a.members;
            if (members.length === 0 && filePath !== this._genFilePath) {
                var /** @type {?} */ reexports = this.reexports.get(filePath);
                if (!reexports) {
                    reexports = [];
                    this.reexports.set(filePath, reexports);
                }
                reexports.push({ name: name_1, as: stmt.name });
                return null;
            }
        }
        if (ctx.isExportedVar(stmt.name)) {
            ctx.print(stmt, "export ");
        }
        if (stmt.hasModifier(o.StmtModifier.Final)) {
            ctx.print(stmt, "const");
        }
        else {
            ctx.print(stmt, "var");
        }
        ctx.print(stmt, " " + stmt.name + ":");
        this.visitType(stmt.type, ctx);
        ctx.print(stmt, " = ");
        stmt.value.visitExpression(this, ctx);
        ctx.println(stmt, ";");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitCastExpr = function (ast, ctx) {
        ctx.print(ast, "(<");
        ast.type.visitType(this, ctx);
        ctx.print(ast, ">");
        ast.value.visitExpression(this, ctx);
        ctx.print(ast, ")");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
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
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) {
        var _this = this;
        ctx.pushClass(stmt);
        if (ctx.isExportedVar(stmt.name)) {
            ctx.print(stmt, "export ");
        }
        ctx.print(stmt, "class " + stmt.name);
        if (isPresent(stmt.parent)) {
            ctx.print(stmt, " extends ");
            this.typeExpression++;
            stmt.parent.visitExpression(this, ctx);
            this.typeExpression--;
        }
        ctx.println(stmt, " {");
        ctx.incIndent();
        stmt.fields.forEach(function (field) { return _this._visitClassField(field, ctx); });
        if (isPresent(stmt.constructorMethod)) {
            this._visitClassConstructor(stmt, ctx);
        }
        stmt.getters.forEach(function (getter) { return _this._visitClassGetter(getter, ctx); });
        stmt.methods.forEach(function (method) { return _this._visitClassMethod(method, ctx); });
        ctx.decIndent();
        ctx.println(stmt, "}");
        ctx.popClass();
        return null;
    };
    /**
     * @param {?} field
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype._visitClassField = function (field, ctx) {
        if (field.hasModifier(o.StmtModifier.Private)) {
            // comment out as a workaround for #10967
            ctx.print(null, "/*private*/ ");
        }
        ctx.print(null, field.name);
        ctx.print(null, ':');
        this.visitType(field.type, ctx);
        ctx.println(null, ";");
    };
    /**
     * @param {?} getter
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype._visitClassGetter = function (getter, ctx) {
        if (getter.hasModifier(o.StmtModifier.Private)) {
            ctx.print(null, "private ");
        }
        ctx.print(null, "get " + getter.name + "()");
        ctx.print(null, ':');
        this.visitType(getter.type, ctx);
        ctx.println(null, " {");
        ctx.incIndent();
        this.visitAllStatements(getter.body, ctx);
        ctx.decIndent();
        ctx.println(null, "}");
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype._visitClassConstructor = function (stmt, ctx) {
        ctx.print(stmt, "constructor(");
        this._visitParams(stmt.constructorMethod.params, ctx);
        ctx.println(stmt, ") {");
        ctx.incIndent();
        this.visitAllStatements(stmt.constructorMethod.body, ctx);
        ctx.decIndent();
        ctx.println(stmt, "}");
    };
    /**
     * @param {?} method
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype._visitClassMethod = function (method, ctx) {
        if (method.hasModifier(o.StmtModifier.Private)) {
            ctx.print(null, "private ");
        }
        ctx.print(null, method.name + "(");
        this._visitParams(method.params, ctx);
        ctx.print(null, "):");
        this.visitType(method.type, ctx, 'void');
        ctx.println(null, " {");
        ctx.incIndent();
        this.visitAllStatements(method.body, ctx);
        ctx.decIndent();
        ctx.println(null, "}");
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitFunctionExpr = function (ast, ctx) {
        ctx.print(ast, "(");
        this._visitParams(ast.params, ctx);
        ctx.print(ast, "):");
        this.visitType(ast.type, ctx, 'void');
        ctx.println(ast, " => {");
        ctx.incIndent();
        this.visitAllStatements(ast.statements, ctx);
        ctx.decIndent();
        ctx.print(ast, "}");
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
        if (ctx.isExportedVar(stmt.name)) {
            ctx.print(stmt, "export ");
        }
        ctx.print(stmt, "function " + stmt.name + "(");
        this._visitParams(stmt.params, ctx);
        ctx.print(stmt, "):");
        this.visitType(stmt.type, ctx, 'void');
        ctx.println(stmt, " {");
        ctx.incIndent();
        this.visitAllStatements(stmt.statements, ctx);
        ctx.decIndent();
        ctx.println(stmt, "}");
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitTryCatchStmt = function (stmt, ctx) {
        ctx.println(stmt, "try {");
        ctx.incIndent();
        this.visitAllStatements(stmt.bodyStmts, ctx);
        ctx.decIndent();
        ctx.println(stmt, "} catch (" + CATCH_ERROR_VAR.name + ") {");
        ctx.incIndent();
        var /** @type {?} */ catchStmts = [/** @type {?} */ (CATCH_STACK_VAR.set(CATCH_ERROR_VAR.prop('stack')).toDeclStmt(null, [
                o.StmtModifier.Final
            ]))].concat(stmt.catchStmts);
        this.visitAllStatements(catchStmts, ctx);
        ctx.decIndent();
        ctx.println(stmt, "}");
        return null;
    };
    /**
     * @param {?} type
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitBuiltintType = function (type, ctx) {
        var /** @type {?} */ typeStr;
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
            default:
                throw new Error("Unsupported builtin type " + type.name);
        }
        ctx.print(null, typeStr);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitExpressionType = function (ast, ctx) {
        ast.value.visitExpression(this, ctx);
        return null;
    };
    /**
     * @param {?} type
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitArrayType = function (type, ctx) {
        this.visitType(type.of, ctx);
        ctx.print(null, "[]");
        return null;
    };
    /**
     * @param {?} type
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype.visitMapType = function (type, ctx) {
        ctx.print(null, "{[key: string]:");
        this.visitType(type.valueType, ctx);
        ctx.print(null, "}");
        return null;
    };
    /**
     * @param {?} method
     * @return {?}
     */
    _TsEmitterVisitor.prototype.getBuiltinMethodName = function (method) {
        var /** @type {?} */ name;
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
    /**
     * @param {?} params
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype._visitParams = function (params, ctx) {
        var _this = this;
        this.visitAllObjects(function (param) {
            ctx.print(null, param.name);
            ctx.print(null, ':');
            _this.visitType(param.type, ctx);
        }, params, ctx, ',');
    };
    /**
     * @param {?} value
     * @return {?}
     */
    _TsEmitterVisitor.prototype._resolveStaticSymbol = function (value) {
        var /** @type {?} */ reference = value.reference;
        if (!(reference instanceof StaticSymbol)) {
            throw new Error("Internal error: unknown identifier " + JSON.stringify(value));
        }
        var /** @type {?} */ arity = this._importResolver.getTypeArity(reference) || undefined;
        var /** @type {?} */ importReference = this._importResolver.getImportAs(reference) || reference;
        return {
            name: importReference.name,
            filePath: importReference.filePath,
            members: importReference.members, arity: arity
        };
    };
    /**
     * @param {?} value
     * @param {?} typeParams
     * @param {?} ctx
     * @return {?}
     */
    _TsEmitterVisitor.prototype._visitIdentifier = function (value, typeParams, ctx) {
        var _this = this;
        var _a = this._resolveStaticSymbol(value), name = _a.name, filePath = _a.filePath, members = _a.members, arity = _a.arity;
        if (filePath != this._genFilePath) {
            var /** @type {?} */ prefix = this.importsWithPrefixes.get(filePath);
            if (isBlank(prefix)) {
                prefix = "import" + this.importsWithPrefixes.size;
                this.importsWithPrefixes.set(filePath, prefix);
            }
            ctx.print(null, prefix + ".");
        }
        if (members.length) {
            ctx.print(null, name);
            ctx.print(null, '.');
            ctx.print(null, members.join('.'));
        }
        else {
            ctx.print(null, name);
        }
        if (this.typeExpression > 0) {
            // If we are in a type expression that refers to a generic type then supply
            // the required type parameters. If there were not enough type parameters
            // supplied, supply any as the type. Outside a type expression the reference
            // should not supply type parameters and be treated as a simple value reference
            // to the constructor function itself.
            var /** @type {?} */ suppliedParameters = (typeParams && typeParams.length) || 0;
            var /** @type {?} */ additionalParameters = (arity || 0) - suppliedParameters;
            if (suppliedParameters > 0 || additionalParameters > 0) {
                ctx.print(null, "<");
                if (suppliedParameters > 0) {
                    this.visitAllObjects(function (type) { return type.visitType(_this, ctx); }, typeParams, ctx, ',');
                }
                if (additionalParameters > 0) {
                    for (var /** @type {?} */ i = 0; i < additionalParameters; i++) {
                        if (i > 0 || suppliedParameters > 0)
                            ctx.print(null, ',');
                        ctx.print(null, 'any');
                    }
                }
                ctx.print(null, ">");
            }
        }
    };
    return _TsEmitterVisitor;
}(AbstractEmitterVisitor));
function _TsEmitterVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _TsEmitterVisitor.prototype.typeExpression;
    /** @type {?} */
    _TsEmitterVisitor.prototype.importsWithPrefixes;
    /** @type {?} */
    _TsEmitterVisitor.prototype.reexports;
    /** @type {?} */
    _TsEmitterVisitor.prototype._genFilePath;
    /** @type {?} */
    _TsEmitterVisitor.prototype._importResolver;
}
//# sourceMappingURL=ts_emitter.js.map