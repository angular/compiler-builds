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
import * as tslib_1 from "tslib";
import * as o from './output/output_ast';
import { error } from './util';
var /** @type {?} */ CONSTANT_PREFIX = '_c';
// Closure variables holding messages must be named `MSG_[A-Z0-9]+`
var /** @type {?} */ TRANSLATION_PREFIX = 'MSG_';
/** @enum {number} */
var DefinitionKind = { Injector: 0, Directive: 1, Component: 2, Pipe: 3, };
export { DefinitionKind };
/**
 * Closure uses `goog.getMsg(message)` to lookup translations
 */
var /** @type {?} */ GOOG_GET_MSG = 'goog.getMsg';
/**
 * Context to use when producing a key.
 *
 * This ensures we see the constant not the reference variable when producing
 * a key.
 */
var /** @type {?} */ KEY_CONTEXT = {};
/**
 * A node that is a place-holder that allows the node to be replaced when the actual
 * node is known.
 *
 * This allows the constant pool to change an expression from a direct reference to
 * a constant to a shared constant. It returns a fix-up node that is later allowed to
 * change the referenced expression.
 */
var /**
 * A node that is a place-holder that allows the node to be replaced when the actual
 * node is known.
 *
 * This allows the constant pool to change an expression from a direct reference to
 * a constant to a shared constant. It returns a fix-up node that is later allowed to
 * change the referenced expression.
 */
FixupExpression = /** @class */ (function (_super) {
    tslib_1.__extends(FixupExpression, _super);
    function FixupExpression(resolved) {
        var _this = _super.call(this, resolved.type) || this;
        _this.resolved = resolved;
        _this.original = resolved;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    FixupExpression.prototype.visitExpression = /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    function (visitor, context) {
        if (context === KEY_CONTEXT) {
            // When producing a key we want to traverse the constant not the
            // variable used to refer to it.
            return this.original.visitExpression(visitor, context);
        }
        else {
            return this.resolved.visitExpression(visitor, context);
        }
    };
    /**
     * @param {?} e
     * @return {?}
     */
    FixupExpression.prototype.isEquivalent = /**
     * @param {?} e
     * @return {?}
     */
    function (e) {
        return e instanceof FixupExpression && this.resolved.isEquivalent(e.resolved);
    };
    /**
     * @return {?}
     */
    FixupExpression.prototype.isConstant = /**
     * @return {?}
     */
    function () { return true; };
    /**
     * @param {?} expression
     * @return {?}
     */
    FixupExpression.prototype.fixup = /**
     * @param {?} expression
     * @return {?}
     */
    function (expression) {
        this.resolved = expression;
        this.shared = true;
    };
    return FixupExpression;
}(o.Expression));
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
var /**
 * A constant pool allows a code emitter to share constant in an output context.
 *
 * The constant pool also supports sharing access to ivy definitions references.
 */
ConstantPool = /** @class */ (function () {
    function ConstantPool() {
        this.statements = [];
        this.translations = new Map();
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
    ConstantPool.prototype.getConstLiteral = /**
     * @param {?} literal
     * @param {?=} forceShared
     * @return {?}
     */
    function (literal, forceShared) {
        if (literal instanceof o.LiteralExpr || literal instanceof FixupExpression) {
            // Do no put simple literals into the constant pool or try to produce a constant for a
            // reference to a constant.
            return literal;
        }
        var /** @type {?} */ key = this.keyOf(literal);
        var /** @type {?} */ fixup = this.literals.get(key);
        var /** @type {?} */ newValue = false;
        if (!fixup) {
            fixup = new FixupExpression(literal);
            this.literals.set(key, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            // Replace the expression with a variable
            var /** @type {?} */ name_1 = this.freshName();
            this.statements.push(o.variable(name_1).set(literal).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            fixup.fixup(o.variable(name_1));
        }
        return fixup;
    };
    // Generates closure specific code for translation.
    //
    // ```
    // /**
    //  * @desc description?
    //  * @meaning meaning?
    //  */
    // const MSG_XYZ = goog.getMsg('message');
    // ```
    /**
     * @param {?} message
     * @param {?} meta
     * @return {?}
     */
    ConstantPool.prototype.getTranslation = /**
     * @param {?} message
     * @param {?} meta
     * @return {?}
     */
    function (message, meta) {
        // The identity of an i18n message depends on the message and its meaning
        var /** @type {?} */ key = meta.meaning ? message + "\0\0" + meta.meaning : message;
        var /** @type {?} */ exp = this.translations.get(key);
        if (exp) {
            return exp;
        }
        var /** @type {?} */ docStmt = i18nMetaToDocStmt(meta);
        if (docStmt) {
            this.statements.push(docStmt);
        }
        // Call closure to get the translation
        var /** @type {?} */ variable = o.variable(this.freshTranslationName());
        var /** @type {?} */ fnCall = o.variable(GOOG_GET_MSG).callFn([o.literal(message)]);
        var /** @type {?} */ msgStmt = variable.set(fnCall).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]);
        this.statements.push(msgStmt);
        this.translations.set(key, variable);
        return variable;
    };
    /**
     * @param {?} type
     * @param {?} kind
     * @param {?} ctx
     * @param {?=} forceShared
     * @return {?}
     */
    ConstantPool.prototype.getDefinition = /**
     * @param {?} type
     * @param {?} kind
     * @param {?} ctx
     * @param {?=} forceShared
     * @return {?}
     */
    function (type, kind, ctx, forceShared) {
        if (forceShared === void 0) { forceShared = false; }
        var /** @type {?} */ definitions = this.definitionsOf(kind);
        var /** @type {?} */ fixup = definitions.get(type);
        var /** @type {?} */ newValue = false;
        if (!fixup) {
            var /** @type {?} */ property = this.propertyNameOf(kind);
            fixup = new FixupExpression(ctx.importExpr(type).prop(property));
            definitions.set(type, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            var /** @type {?} */ name_2 = this.freshName();
            this.statements.push(o.variable(name_2).set(fixup.resolved).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            fixup.fixup(o.variable(name_2));
        }
        return fixup;
    };
    /**
     * @param {?} literal
     * @return {?}
     */
    ConstantPool.prototype.getLiteralFactory = /**
     * @param {?} literal
     * @return {?}
     */
    function (literal) {
        // Create a pure function that builds an array of a mix of constant  and variable expressions
        if (literal instanceof o.LiteralArrayExpr) {
            var /** @type {?} */ argumentsForKey = literal.entries.map(function (e) { return e.isConstant() ? e : o.literal(null); });
            var /** @type {?} */ key = this.keyOf(o.literalArr(argumentsForKey));
            return this._getLiteralFactory(key, literal.entries, function (entries) { return o.literalArr(entries); });
        }
        else {
            var /** @type {?} */ expressionForKey = o.literalMap(literal.entries.map(function (e) {
                return ({
                    key: e.key,
                    value: e.value.isConstant() ? e.value : o.literal(null),
                    quoted: e.quoted
                });
            }));
            var /** @type {?} */ key = this.keyOf(expressionForKey);
            return this._getLiteralFactory(key, literal.entries.map(function (e) { return e.value; }), function (entries) {
                return o.literalMap(entries.map(function (value, index) {
                    return ({
                        key: literal.entries[index].key,
                        value: value,
                        quoted: literal.entries[index].quoted
                    });
                }));
            });
        }
    };
    /**
     * @param {?} key
     * @param {?} values
     * @param {?} resultMap
     * @return {?}
     */
    ConstantPool.prototype._getLiteralFactory = /**
     * @param {?} key
     * @param {?} values
     * @param {?} resultMap
     * @return {?}
     */
    function (key, values, resultMap) {
        var _this = this;
        var /** @type {?} */ literalFactory = this.literalFactories.get(key);
        var /** @type {?} */ literalFactoryArguments = values.filter((function (e) { return !e.isConstant(); }));
        if (!literalFactory) {
            var /** @type {?} */ resultExpressions = values.map(function (e, index) { return e.isConstant() ? _this.getConstLiteral(e, true) : o.variable("a" + index); });
            var /** @type {?} */ parameters = resultExpressions.filter(isVariable).map(function (e) { return new o.FnParam(/** @type {?} */ ((e.name)), o.DYNAMIC_TYPE); });
            var /** @type {?} */ pureFunctionDeclaration = o.fn(parameters, [new o.ReturnStatement(resultMap(resultExpressions))], o.INFERRED_TYPE);
            var /** @type {?} */ name_3 = this.freshName();
            this.statements.push(o.variable(name_3).set(pureFunctionDeclaration).toDeclStmt(o.INFERRED_TYPE, [
                o.StmtModifier.Final
            ]));
            literalFactory = o.variable(name_3);
            this.literalFactories.set(key, literalFactory);
        }
        return { literalFactory: literalFactory, literalFactoryArguments: literalFactoryArguments };
    };
    /**
     * Produce a unique name.
     *
     * The name might be unique among different prefixes if any of the prefixes end in
     * a digit so the prefix should be a constant string (not based on user input) and
     * must not end in a digit.
     */
    /**
     * Produce a unique name.
     *
     * The name might be unique among different prefixes if any of the prefixes end in
     * a digit so the prefix should be a constant string (not based on user input) and
     * must not end in a digit.
     * @param {?} prefix
     * @return {?}
     */
    ConstantPool.prototype.uniqueName = /**
     * Produce a unique name.
     *
     * The name might be unique among different prefixes if any of the prefixes end in
     * a digit so the prefix should be a constant string (not based on user input) and
     * must not end in a digit.
     * @param {?} prefix
     * @return {?}
     */
    function (prefix) { return "" + prefix + this.nextNameIndex++; };
    /**
     * @param {?} kind
     * @return {?}
     */
    ConstantPool.prototype.definitionsOf = /**
     * @param {?} kind
     * @return {?}
     */
    function (kind) {
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
        error("Unknown definition kind " + kind);
        return this.componentDefinitions;
    };
    /**
     * @param {?} kind
     * @return {?}
     */
    ConstantPool.prototype.propertyNameOf = /**
     * @param {?} kind
     * @return {?}
     */
    function (kind) {
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
        error("Unknown definition kind " + kind);
        return '<unknown>';
    };
    /**
     * @return {?}
     */
    ConstantPool.prototype.freshName = /**
     * @return {?}
     */
    function () { return this.uniqueName(CONSTANT_PREFIX); };
    /**
     * @return {?}
     */
    ConstantPool.prototype.freshTranslationName = /**
     * @return {?}
     */
    function () {
        return this.uniqueName(TRANSLATION_PREFIX).toUpperCase();
    };
    /**
     * @param {?} expression
     * @return {?}
     */
    ConstantPool.prototype.keyOf = /**
     * @param {?} expression
     * @return {?}
     */
    function (expression) {
        return expression.visitExpression(new KeyVisitor(), KEY_CONTEXT);
    };
    return ConstantPool;
}());
/**
 * A constant pool allows a code emitter to share constant in an output context.
 *
 * The constant pool also supports sharing access to ivy definitions references.
 */
export { ConstantPool };
function ConstantPool_tsickle_Closure_declarations() {
    /** @type {?} */
    ConstantPool.prototype.statements;
    /** @type {?} */
    ConstantPool.prototype.translations;
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
/**
 * Visitor used to determine if 2 expressions are equivalent and can be shared in the
 * `ConstantPool`.
 *
 * When the id (string) generated by the visitor is equal, expressions are considered equivalent.
 */
var /**
 * Visitor used to determine if 2 expressions are equivalent and can be shared in the
 * `ConstantPool`.
 *
 * When the id (string) generated by the visitor is equal, expressions are considered equivalent.
 */
KeyVisitor = /** @class */ (function () {
    function KeyVisitor() {
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
    KeyVisitor.prototype.visitLiteralExpr = /**
     * @param {?} ast
     * @return {?}
     */
    function (ast) {
        return "" + (typeof ast.value === 'string' ? '"' + ast.value + '"' : ast.value);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    KeyVisitor.prototype.visitLiteralArrayExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        return "[" + ast.entries.map(function (entry) { return entry.visitExpression(_this, context); }).join(',') + "]";
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    KeyVisitor.prototype.visitLiteralMapExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        var /** @type {?} */ mapKey = function (entry) {
            var /** @type {?} */ quote = entry.quoted ? '"' : '';
            return "" + quote + entry.key + quote;
        };
        var /** @type {?} */ mapEntry = function (entry) {
            return mapKey(entry) + ":" + entry.value.visitExpression(_this, context);
        };
        return "{" + ast.entries.map(mapEntry).join(',');
    };
    /**
     * @param {?} ast
     * @return {?}
     */
    KeyVisitor.prototype.visitExternalExpr = /**
     * @param {?} ast
     * @return {?}
     */
    function (ast) {
        return ast.value.moduleName ? "EX:" + ast.value.moduleName + ":" + ast.value.name :
            "EX:" + ast.value.runtime.name;
    };
    return KeyVisitor;
}());
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
    throw new Error("Invalid state: Visitor " + this.constructor.name + " doesn't handle " + arg.constructor.name);
}
/**
 * @param {?} e
 * @return {?}
 */
function isVariable(e) {
    return e instanceof o.ReadVarExpr;
}
/**
 * @param {?} meta
 * @return {?}
 */
function i18nMetaToDocStmt(meta) {
    var /** @type {?} */ tags = [];
    if (meta.description) {
        tags.push({ tagName: "desc" /* Desc */, text: meta.description });
    }
    if (meta.meaning) {
        tags.push({ tagName: "meaning" /* Meaning */, text: meta.meaning });
    }
    return tags.length == 0 ? null : new o.JSDocCommentStmt(tags);
}
//# sourceMappingURL=constant_pool.js.map