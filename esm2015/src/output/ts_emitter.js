/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AbstractEmitterVisitor, CATCH_ERROR_VAR, CATCH_STACK_VAR, EmitterVisitorContext } from './abstract_emitter';
import * as o from './output_ast';
const /** @type {?} */ _debugFilePath = '/debug/lib';
/**
 * @param {?} ast
 * @return {?}
 */
export function debugOutputAstAsTypeScript(ast) {
    const /** @type {?} */ converter = new _TsEmitterVisitor();
    const /** @type {?} */ ctx = EmitterVisitorContext.createRoot();
    const /** @type {?} */ asts = Array.isArray(ast) ? ast : [ast];
    asts.forEach((ast) => {
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
            throw new Error(`Don't know how to print debug info for ${ast}`);
        }
    });
    return ctx.toSource();
}
export class TypeScriptEmitter {
    /**
     * @param {?} genFilePath
     * @param {?} stmts
     * @param {?=} preamble
     * @param {?=} emitSourceMaps
     * @param {?=} referenceFilter
     * @param {?=} importFilter
     * @return {?}
     */
    emitStatementsAndContext(genFilePath, stmts, preamble = '', emitSourceMaps = true, referenceFilter, importFilter) {
        const /** @type {?} */ converter = new _TsEmitterVisitor(referenceFilter, importFilter);
        const /** @type {?} */ ctx = EmitterVisitorContext.createRoot();
        converter.visitAllStatements(stmts, ctx);
        const /** @type {?} */ preambleLines = preamble ? preamble.split('\n') : [];
        converter.reexports.forEach((reexports, exportedModuleName) => {
            const /** @type {?} */ reexportsCode = reexports.map(reexport => `${reexport.name} as ${reexport.as}`).join(',');
            preambleLines.push(`export {${reexportsCode}} from '${exportedModuleName}';`);
        });
        converter.importsWithPrefixes.forEach((prefix, importedModuleName) => {
            // Note: can't write the real word for import as it screws up system.js auto detection...
            preambleLines.push(`imp` +
                `ort * as ${prefix} from '${importedModuleName}';`);
        });
        const /** @type {?} */ sm = emitSourceMaps ?
            ctx.toSourceMapGenerator(genFilePath, preambleLines.length).toJsComment() :
            '';
        const /** @type {?} */ lines = [...preambleLines, ctx.toSource(), sm];
        if (sm) {
            // always add a newline at the end, as some tools have bugs without it.
            lines.push('');
        }
        ctx.setPreambleLineCount(preambleLines.length);
        return { sourceText: lines.join('\n'), context: ctx };
    }
    /**
     * @param {?} genFilePath
     * @param {?} stmts
     * @param {?=} preamble
     * @return {?}
     */
    emitStatements(genFilePath, stmts, preamble = '') {
        return this.emitStatementsAndContext(genFilePath, stmts, preamble).sourceText;
    }
}
class _TsEmitterVisitor extends AbstractEmitterVisitor {
    /**
     * @param {?=} referenceFilter
     * @param {?=} importFilter
     */
    constructor(referenceFilter, importFilter) {
        super(false);
        this.referenceFilter = referenceFilter;
        this.importFilter = importFilter;
        this.typeExpression = 0;
        this.importsWithPrefixes = new Map();
        this.reexports = new Map();
    }
    /**
     * @param {?} t
     * @param {?} ctx
     * @param {?=} defaultType
     * @return {?}
     */
    visitType(t, ctx, defaultType = 'any') {
        if (t) {
            this.typeExpression++;
            t.visitType(this, ctx);
            this.typeExpression--;
        }
        else {
            ctx.print(null, defaultType);
        }
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralExpr(ast, ctx) {
        const /** @type {?} */ value = ast.value;
        if (value == null && ast.type != o.INFERRED_TYPE) {
            ctx.print(ast, `(${value} as any)`);
            return null;
        }
        return super.visitLiteralExpr(ast, ctx);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralArrayExpr(ast, ctx) {
        if (ast.entries.length === 0) {
            ctx.print(ast, '(');
        }
        const /** @type {?} */ result = super.visitLiteralArrayExpr(ast, ctx);
        if (ast.entries.length === 0) {
            ctx.print(ast, ' as any[])');
        }
        return result;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitExternalExpr(ast, ctx) {
        this._visitIdentifier(ast.value, ast.typeParams, ctx);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitAssertNotNullExpr(ast, ctx) {
        const /** @type {?} */ result = super.visitAssertNotNullExpr(ast, ctx);
        ctx.print(ast, '!');
        return result;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareVarStmt(stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported) && stmt.value instanceof o.ExternalExpr &&
            !stmt.type) {
            // check for a reexport
            const { name, moduleName } = stmt.value.value;
            if (moduleName) {
                let /** @type {?} */ reexports = this.reexports.get(moduleName);
                if (!reexports) {
                    reexports = [];
                    this.reexports.set(moduleName, reexports);
                }
                reexports.push({ name: /** @type {?} */ ((name)), as: stmt.name });
                return null;
            }
        }
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            ctx.print(stmt, `export `);
        }
        if (stmt.hasModifier(o.StmtModifier.Final)) {
            ctx.print(stmt, `const`);
        }
        else {
            ctx.print(stmt, `var`);
        }
        ctx.print(stmt, ` ${stmt.name}`);
        this._printColonType(stmt.type, ctx);
        if (stmt.value) {
            ctx.print(stmt, ` = `);
            stmt.value.visitExpression(this, ctx);
        }
        ctx.println(stmt, `;`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitCastExpr(ast, ctx) {
        ctx.print(ast, `(<`); /** @type {?} */
        ((ast.type)).visitType(this, ctx);
        ctx.print(ast, `>`);
        ast.value.visitExpression(this, ctx);
        ctx.print(ast, `)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitInstantiateExpr(ast, ctx) {
        ctx.print(ast, `new `);
        this.typeExpression++;
        ast.classExpr.visitExpression(this, ctx);
        this.typeExpression--;
        ctx.print(ast, `(`);
        this.visitAllExpressions(ast.args, ctx, ',');
        ctx.print(ast, `)`);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareClassStmt(stmt, ctx) {
        ctx.pushClass(stmt);
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            ctx.print(stmt, `export `);
        }
        ctx.print(stmt, `class ${stmt.name}`);
        if (stmt.parent != null) {
            ctx.print(stmt, ` extends `);
            this.typeExpression++;
            stmt.parent.visitExpression(this, ctx);
            this.typeExpression--;
        }
        ctx.println(stmt, ` {`);
        ctx.incIndent();
        stmt.fields.forEach((field) => this._visitClassField(field, ctx));
        if (stmt.constructorMethod != null) {
            this._visitClassConstructor(stmt, ctx);
        }
        stmt.getters.forEach((getter) => this._visitClassGetter(getter, ctx));
        stmt.methods.forEach((method) => this._visitClassMethod(method, ctx));
        ctx.decIndent();
        ctx.println(stmt, `}`);
        ctx.popClass();
        return null;
    }
    /**
     * @param {?} field
     * @param {?} ctx
     * @return {?}
     */
    _visitClassField(field, ctx) {
        if (field.hasModifier(o.StmtModifier.Private)) {
            // comment out as a workaround for #10967
            ctx.print(null, `/*private*/ `);
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
        ctx.println(null, `;`);
    }
    /**
     * @param {?} getter
     * @param {?} ctx
     * @return {?}
     */
    _visitClassGetter(getter, ctx) {
        if (getter.hasModifier(o.StmtModifier.Private)) {
            ctx.print(null, `private `);
        }
        ctx.print(null, `get ${getter.name}()`);
        this._printColonType(getter.type, ctx);
        ctx.println(null, ` {`);
        ctx.incIndent();
        this.visitAllStatements(getter.body, ctx);
        ctx.decIndent();
        ctx.println(null, `}`);
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    _visitClassConstructor(stmt, ctx) {
        ctx.print(stmt, `constructor(`);
        this._visitParams(stmt.constructorMethod.params, ctx);
        ctx.println(stmt, `) {`);
        ctx.incIndent();
        this.visitAllStatements(stmt.constructorMethod.body, ctx);
        ctx.decIndent();
        ctx.println(stmt, `}`);
    }
    /**
     * @param {?} method
     * @param {?} ctx
     * @return {?}
     */
    _visitClassMethod(method, ctx) {
        if (method.hasModifier(o.StmtModifier.Private)) {
            ctx.print(null, `private `);
        }
        ctx.print(null, `${method.name}(`);
        this._visitParams(method.params, ctx);
        ctx.print(null, `)`);
        this._printColonType(method.type, ctx, 'void');
        ctx.println(null, ` {`);
        ctx.incIndent();
        this.visitAllStatements(method.body, ctx);
        ctx.decIndent();
        ctx.println(null, `}`);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitFunctionExpr(ast, ctx) {
        if (ast.name) {
            ctx.print(ast, 'function ');
            ctx.print(ast, ast.name);
        }
        ctx.print(ast, `(`);
        this._visitParams(ast.params, ctx);
        ctx.print(ast, `)`);
        this._printColonType(ast.type, ctx, 'void');
        if (!ast.name) {
            ctx.print(ast, ` => `);
        }
        ctx.println(ast, '{');
        ctx.incIndent();
        this.visitAllStatements(ast.statements, ctx);
        ctx.decIndent();
        ctx.print(ast, `}`);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareFunctionStmt(stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            ctx.print(stmt, `export `);
        }
        ctx.print(stmt, `function ${stmt.name}(`);
        this._visitParams(stmt.params, ctx);
        ctx.print(stmt, `)`);
        this._printColonType(stmt.type, ctx, 'void');
        ctx.println(stmt, ` {`);
        ctx.incIndent();
        this.visitAllStatements(stmt.statements, ctx);
        ctx.decIndent();
        ctx.println(stmt, `}`);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitTryCatchStmt(stmt, ctx) {
        ctx.println(stmt, `try {`);
        ctx.incIndent();
        this.visitAllStatements(stmt.bodyStmts, ctx);
        ctx.decIndent();
        ctx.println(stmt, `} catch (${CATCH_ERROR_VAR.name}) {`);
        ctx.incIndent();
        const /** @type {?} */ catchStmts = [/** @type {?} */ (CATCH_STACK_VAR.set(CATCH_ERROR_VAR.prop('stack', null)).toDeclStmt(null, [
                o.StmtModifier.Final
            ]))].concat(stmt.catchStmts);
        this.visitAllStatements(catchStmts, ctx);
        ctx.decIndent();
        ctx.println(stmt, `}`);
        return null;
    }
    /**
     * @param {?} type
     * @param {?} ctx
     * @return {?}
     */
    visitBuiltinType(type, ctx) {
        let /** @type {?} */ typeStr;
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
                throw new Error(`Unsupported builtin type ${type.name}`);
        }
        ctx.print(null, typeStr);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitExpressionType(ast, ctx) {
        ast.value.visitExpression(this, ctx);
        return null;
    }
    /**
     * @param {?} type
     * @param {?} ctx
     * @return {?}
     */
    visitArrayType(type, ctx) {
        this.visitType(type.of, ctx);
        ctx.print(null, `[]`);
        return null;
    }
    /**
     * @param {?} type
     * @param {?} ctx
     * @return {?}
     */
    visitMapType(type, ctx) {
        ctx.print(null, `{[key: string]:`);
        this.visitType(type.valueType, ctx);
        ctx.print(null, `}`);
        return null;
    }
    /**
     * @param {?} method
     * @return {?}
     */
    getBuiltinMethodName(method) {
        let /** @type {?} */ name;
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
                throw new Error(`Unknown builtin method: ${method}`);
        }
        return name;
    }
    /**
     * @param {?} params
     * @param {?} ctx
     * @return {?}
     */
    _visitParams(params, ctx) {
        this.visitAllObjects(param => {
            ctx.print(null, param.name);
            this._printColonType(param.type, ctx);
        }, params, ctx, ',');
    }
    /**
     * @param {?} value
     * @param {?} typeParams
     * @param {?} ctx
     * @return {?}
     */
    _visitIdentifier(value, typeParams, ctx) {
        const { name, moduleName } = value;
        if (this.referenceFilter && this.referenceFilter(value)) {
            ctx.print(null, '(null as any)');
            return;
        }
        if (moduleName && (!this.importFilter || !this.importFilter(value))) {
            let /** @type {?} */ prefix = this.importsWithPrefixes.get(moduleName);
            if (prefix == null) {
                prefix = `i${this.importsWithPrefixes.size}`;
                this.importsWithPrefixes.set(moduleName, prefix);
            }
            ctx.print(null, `${prefix}.`);
        }
        ctx.print(null, /** @type {?} */ ((name)));
        if (this.typeExpression > 0) {
            // If we are in a type expression that refers to a generic type then supply
            // the required type parameters. If there were not enough type parameters
            // supplied, supply any as the type. Outside a type expression the reference
            // should not supply type parameters and be treated as a simple value reference
            // to the constructor function itself.
            const /** @type {?} */ suppliedParameters = typeParams || [];
            if (suppliedParameters.length > 0) {
                ctx.print(null, `<`);
                this.visitAllObjects(type => type.visitType(this, ctx), /** @type {?} */ ((typeParams)), ctx, ',');
                ctx.print(null, `>`);
            }
        }
    }
    /**
     * @param {?} type
     * @param {?} ctx
     * @param {?=} defaultType
     * @return {?}
     */
    _printColonType(type, ctx, defaultType) {
        if (type !== o.INFERRED_TYPE) {
            ctx.print(null, ':');
            this.visitType(type, ctx, defaultType);
        }
    }
}
function _TsEmitterVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _TsEmitterVisitor.prototype.typeExpression;
    /** @type {?} */
    _TsEmitterVisitor.prototype.importsWithPrefixes;
    /** @type {?} */
    _TsEmitterVisitor.prototype.reexports;
    /** @type {?} */
    _TsEmitterVisitor.prototype.referenceFilter;
    /** @type {?} */
    _TsEmitterVisitor.prototype.importFilter;
}
//# sourceMappingURL=ts_emitter.js.map