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
import * as o from './output/output_ast';
import { error } from './util';
const /** @type {?} */ CONSTANT_PREFIX = '_c';
/** @enum {number} */
const DefinitionKind = { Injector: 0, Directive: 1, Component: 2, Pipe: 3, };
export { DefinitionKind };
/**
 * Context to use when producing a key.
 *
 * This ensures we see the constant not the reference variable when producing
 * a key.
 */
const /** @type {?} */ KEY_CONTEXT = {};
/**
 * A node that is a place-holder that allows the node to be replaced when the actual
 * node is known.
 *
 * This allows the constant pool to change an expression from a direct reference to
 * a constant to a shared constant. It returns a fix-up node that is later allowed to
 * change the referenced expression.
 */
class FixupExpression extends o.Expression {
    /**
     * @param {?} resolved
     */
    constructor(resolved) {
        super(resolved.type);
        this.resolved = resolved;
        this.original = resolved;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visitExpression(visitor, context) {
        if (context === KEY_CONTEXT) {
            // When producing a key we want to traverse the constant not the
            // variable used to refer to it.
            return this.original.visitExpression(visitor, context);
        }
        else {
            return this.resolved.visitExpression(visitor, context);
        }
    }
    /**
     * @param {?} e
     * @return {?}
     */
    isEquivalent(e) {
        return e instanceof FixupExpression && this.resolved.isEquivalent(e.resolved);
    }
    /**
     * @return {?}
     */
    isConstant() { return true; }
    /**
     * @param {?} expression
     * @return {?}
     */
    fixup(expression) {
        this.resolved = expression;
        this.shared = true;
    }
}
function FixupExpression_tsickle_Closure_declarations() {
    /** @type {?} */
    FixupExpression.prototype.original;
    /** @type {?} */
    FixupExpression.prototype.shared;
    /** @type {?} */
    FixupExpression.prototype.resolved;
}
/**
 * A constant pool allows a code emitter to share constant in an output context.
 *
 * The constant pool also supports sharing access to ivy definitions references.
 */
export class ConstantPool {
    constructor() {
        this.statements = [];
        this.literals = new Map();
        this.literalFactories = new Map();
        this.injectorDefinitions = new Map();
        this.directiveDefinitions = new Map();
        this.componentDefinitions = new Map();
        this.pipeDefinitions = new Map();
        this.nextNameIndex = 0;
    }
    /**
     * @param {?} literal
     * @param {?=} forceShared
     * @return {?}
     */
    getConstLiteral(literal, forceShared) {
        if (literal instanceof o.LiteralExpr || literal instanceof FixupExpression) {
            // Do no put simple literals into the constant pool or try to produce a constant for a
            // reference to a constant.
            return literal;
        }
        const /** @type {?} */ key = this.keyOf(literal);
        let /** @type {?} */ fixup = this.literals.get(key);
        let /** @type {?} */ newValue = false;
        if (!fixup) {
            fixup = new FixupExpression(literal);
            this.literals.set(key, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            // Replace the expression with a variable
            const /** @type {?} */ name = this.freshName();
            this.statements.push(o.variable(name).set(literal).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            fixup.fixup(o.variable(name));
        }
        return fixup;
    }
    /**
     * @param {?} type
     * @param {?} kind
     * @param {?} ctx
     * @param {?=} forceShared
     * @return {?}
     */
    getDefinition(type, kind, ctx, forceShared = false) {
        const /** @type {?} */ definitions = this.definitionsOf(kind);
        let /** @type {?} */ fixup = definitions.get(type);
        let /** @type {?} */ newValue = false;
        if (!fixup) {
            const /** @type {?} */ property = this.propertyNameOf(kind);
            fixup = new FixupExpression(ctx.importExpr(type).prop(property));
            definitions.set(type, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            const /** @type {?} */ name = this.freshName();
            this.statements.push(o.variable(name).set(fixup.resolved).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            fixup.fixup(o.variable(name));
        }
        return fixup;
    }
    /**
     * @param {?} literal
     * @return {?}
     */
    getLiteralFactory(literal) {
        // Create a pure function that builds an array of a mix of constant  and variable expressions
        if (literal instanceof o.LiteralArrayExpr) {
            const /** @type {?} */ argumentsForKey = literal.entries.map(e => e.isConstant() ? e : o.literal(null));
            const /** @type {?} */ key = this.keyOf(o.literalArr(argumentsForKey));
            return this._getLiteralFactory(key, literal.entries, entries => o.literalArr(entries));
        }
        else {
            const /** @type {?} */ expressionForKey = o.literalMap(literal.entries.map(e => ({
                key: e.key,
                value: e.value.isConstant() ? e.value : o.literal(null),
                quoted: e.quoted
            })));
            const /** @type {?} */ key = this.keyOf(expressionForKey);
            return this._getLiteralFactory(key, literal.entries.map(e => e.value), entries => o.literalMap(entries.map((value, index) => ({
                key: literal.entries[index].key,
                value,
                quoted: literal.entries[index].quoted
            }))));
        }
    }
    /**
     * @param {?} key
     * @param {?} values
     * @param {?} resultMap
     * @return {?}
     */
    _getLiteralFactory(key, values, resultMap) {
        let /** @type {?} */ literalFactory = this.literalFactories.get(key);
        const /** @type {?} */ literalFactoryArguments = values.filter((e => !e.isConstant()));
        if (!literalFactory) {
            const /** @type {?} */ resultExpressions = values.map((e, index) => e.isConstant() ? this.getConstLiteral(e, true) : o.variable(`a${index}`));
            const /** @type {?} */ parameters = resultExpressions.filter(isVariable).map(e => new o.FnParam(/** @type {?} */ ((e.name)), o.DYNAMIC_TYPE));
            const /** @type {?} */ pureFunctionDeclaration = o.fn(parameters, [new o.ReturnStatement(resultMap(resultExpressions))], o.INFERRED_TYPE);
            const /** @type {?} */ name = this.freshName();
            this.statements.push(o.variable(name).set(pureFunctionDeclaration).toDeclStmt(o.INFERRED_TYPE, [
                o.StmtModifier.Final
            ]));
            literalFactory = o.variable(name);
            this.literalFactories.set(key, literalFactory);
        }
        return { literalFactory, literalFactoryArguments };
    }
    /**
     * Produce a unique name.
     *
     * The name might be unique among different prefixes if any of the prefixes end in
     * a digit so the prefix should be a constant string (not based on user input) and
     * must not end in a digit.
     * @param {?} prefix
     * @return {?}
     */
    uniqueName(prefix) { return `${prefix}${this.nextNameIndex++}`; }
    /**
     * @param {?} kind
     * @return {?}
     */
    definitionsOf(kind) {
        switch (kind) {
            case 2 /* Component */:
                return this.componentDefinitions;
            case 1 /* Directive */:
                return this.directiveDefinitions;
            case 0 /* Injector */:
                return this.injectorDefinitions;
            case 3 /* Pipe */:
                return this.pipeDefinitions;
        }
        error(`Unknown definition kind ${kind}`);
        return this.componentDefinitions;
    }
    /**
     * @param {?} kind
     * @return {?}
     */
    propertyNameOf(kind) {
        switch (kind) {
            case 2 /* Component */:
                return 'ngComponentDef';
            case 1 /* Directive */:
                return 'ngDirectiveDef';
            case 0 /* Injector */:
                return 'ngInjectorDef';
            case 3 /* Pipe */:
                return 'ngPipeDef';
        }
        error(`Unknown definition kind ${kind}`);
        return '<unknown>';
    }
    /**
     * @return {?}
     */
    freshName() { return this.uniqueName(CONSTANT_PREFIX); }
    /**
     * @param {?} expression
     * @return {?}
     */
    keyOf(expression) {
        return expression.visitExpression(new KeyVisitor(), KEY_CONTEXT);
    }
}
function ConstantPool_tsickle_Closure_declarations() {
    /** @type {?} */
    ConstantPool.prototype.statements;
    /** @type {?} */
    ConstantPool.prototype.literals;
    /** @type {?} */
    ConstantPool.prototype.literalFactories;
    /** @type {?} */
    ConstantPool.prototype.injectorDefinitions;
    /** @type {?} */
    ConstantPool.prototype.directiveDefinitions;
    /** @type {?} */
    ConstantPool.prototype.componentDefinitions;
    /** @type {?} */
    ConstantPool.prototype.pipeDefinitions;
    /** @type {?} */
    ConstantPool.prototype.nextNameIndex;
}
class KeyVisitor {
    constructor() {
        this.visitReadVarExpr = invalid;
        this.visitWriteVarExpr = invalid;
        this.visitWriteKeyExpr = invalid;
        this.visitWritePropExpr = invalid;
        this.visitInvokeMethodExpr = invalid;
        this.visitInvokeFunctionExpr = invalid;
        this.visitInstantiateExpr = invalid;
        this.visitConditionalExpr = invalid;
        this.visitNotExpr = invalid;
        this.visitAssertNotNullExpr = invalid;
        this.visitCastExpr = invalid;
        this.visitFunctionExpr = invalid;
        this.visitBinaryOperatorExpr = invalid;
        this.visitReadPropExpr = invalid;
        this.visitReadKeyExpr = invalid;
        this.visitCommaExpr = invalid;
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    visitLiteralExpr(ast) {
        return `${typeof ast.value === 'string' ? '"' + ast.value + '"' : ast.value}`;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArrayExpr(ast, context) {
        return `[${ast.entries.map(entry => entry.visitExpression(this, context)).join(',')}]`;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMapExpr(ast, context) {
        const /** @type {?} */ mapEntry = (entry) => `${entry.key}:${entry.value.visitExpression(this, context)}`;
        return `{${ast.entries.map(mapEntry).join(',')}`;
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    visitExternalExpr(ast) {
        return ast.value.moduleName ? `EX:${ast.value.moduleName}:${ast.value.name}` :
            `EX:${ast.value.runtime.name}`;
    }
}
function KeyVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    KeyVisitor.prototype.visitReadVarExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitWriteVarExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitWriteKeyExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitWritePropExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitInvokeMethodExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitInvokeFunctionExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitInstantiateExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitConditionalExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitNotExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitAssertNotNullExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitCastExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitFunctionExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitBinaryOperatorExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitReadPropExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitReadKeyExpr;
    /** @type {?} */
    KeyVisitor.prototype.visitCommaExpr;
}
/**
 * @template T
 * @param {?} arg
 * @return {?}
 */
function invalid(arg) {
    throw new Error(`Invalid state: Visitor ${this.constructor.name} doesn't handle ${o.constructor.name}`);
}
/**
 * @param {?} e
 * @return {?}
 */
function isVariable(e) {
    return e instanceof o.ReadVarExpr;
}
//# sourceMappingURL=constant_pool.js.map