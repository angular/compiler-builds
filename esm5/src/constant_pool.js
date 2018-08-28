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
var CONSTANT_PREFIX = '_c';
// Closure variables holding messages must be named `MSG_[A-Z0-9]+`
var TRANSLATION_PREFIX = 'MSG_';
/**
 * Closure uses `goog.getMsg(message)` to lookup translations
 */
var GOOG_GET_MSG = 'goog.getMsg';
/**
 * Context to use when producing a key.
 *
 * This ensures we see the constant not the reference variable when producing
 * a key.
 */
var KEY_CONTEXT = {};
/**
 * A node that is a place-holder that allows the node to be replaced when the actual
 * node is known.
 *
 * This allows the constant pool to change an expression from a direct reference to
 * a constant to a shared constant. It returns a fix-up node that is later allowed to
 * change the referenced expression.
 */
var FixupExpression = /** @class */ (function (_super) {
    tslib_1.__extends(FixupExpression, _super);
    function FixupExpression(resolved) {
        var _this = _super.call(this, resolved.type) || this;
        _this.resolved = resolved;
        _this.original = resolved;
        return _this;
    }
    FixupExpression.prototype.visitExpression = function (visitor, context) {
        if (context === KEY_CONTEXT) {
            // When producing a key we want to traverse the constant not the
            // variable used to refer to it.
            return this.original.visitExpression(visitor, context);
        }
        else {
            return this.resolved.visitExpression(visitor, context);
        }
    };
    FixupExpression.prototype.isEquivalent = function (e) {
        return e instanceof FixupExpression && this.resolved.isEquivalent(e.resolved);
    };
    FixupExpression.prototype.isConstant = function () { return true; };
    FixupExpression.prototype.fixup = function (expression) {
        this.resolved = expression;
        this.shared = true;
    };
    return FixupExpression;
}(o.Expression));
/**
 * A constant pool allows a code emitter to share constant in an output context.
 *
 * The constant pool also supports sharing access to ivy definitions references.
 */
var ConstantPool = /** @class */ (function () {
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
    ConstantPool.prototype.getConstLiteral = function (literal, forceShared) {
        if (literal instanceof o.LiteralExpr || literal instanceof FixupExpression) {
            // Do no put simple literals into the constant pool or try to produce a constant for a
            // reference to a constant.
            return literal;
        }
        var key = this.keyOf(literal);
        var fixup = this.literals.get(key);
        var newValue = false;
        if (!fixup) {
            fixup = new FixupExpression(literal);
            this.literals.set(key, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            // Replace the expression with a variable
            var name_1 = this.freshName();
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
    ConstantPool.prototype.getTranslation = function (message, meta) {
        // The identity of an i18n message depends on the message and its meaning
        var key = meta.meaning ? message + "\0\0" + meta.meaning : message;
        var exp = this.translations.get(key);
        if (exp) {
            return exp;
        }
        var docStmt = i18nMetaToDocStmt(meta);
        if (docStmt) {
            this.statements.push(docStmt);
        }
        // Call closure to get the translation
        var variable = o.variable(this.freshTranslationName());
        var fnCall = o.variable(GOOG_GET_MSG).callFn([o.literal(message)]);
        var msgStmt = variable.set(fnCall).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]);
        this.statements.push(msgStmt);
        this.translations.set(key, variable);
        return variable;
    };
    ConstantPool.prototype.getDefinition = function (type, kind, ctx, forceShared) {
        if (forceShared === void 0) { forceShared = false; }
        var definitions = this.definitionsOf(kind);
        var fixup = definitions.get(type);
        var newValue = false;
        if (!fixup) {
            var property = this.propertyNameOf(kind);
            fixup = new FixupExpression(ctx.importExpr(type).prop(property));
            definitions.set(type, fixup);
            newValue = true;
        }
        if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
            var name_2 = this.freshName();
            this.statements.push(o.variable(name_2).set(fixup.resolved).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            fixup.fixup(o.variable(name_2));
        }
        return fixup;
    };
    ConstantPool.prototype.getLiteralFactory = function (literal) {
        // Create a pure function that builds an array of a mix of constant  and variable expressions
        if (literal instanceof o.LiteralArrayExpr) {
            var argumentsForKey = literal.entries.map(function (e) { return e.isConstant() ? e : o.literal(null); });
            var key = this.keyOf(o.literalArr(argumentsForKey));
            return this._getLiteralFactory(key, literal.entries, function (entries) { return o.literalArr(entries); });
        }
        else {
            var expressionForKey = o.literalMap(literal.entries.map(function (e) { return ({
                key: e.key,
                value: e.value.isConstant() ? e.value : o.literal(null),
                quoted: e.quoted
            }); }));
            var key = this.keyOf(expressionForKey);
            return this._getLiteralFactory(key, literal.entries.map(function (e) { return e.value; }), function (entries) { return o.literalMap(entries.map(function (value, index) { return ({
                key: literal.entries[index].key,
                value: value,
                quoted: literal.entries[index].quoted
            }); })); });
        }
    };
    ConstantPool.prototype._getLiteralFactory = function (key, values, resultMap) {
        var _this = this;
        var literalFactory = this.literalFactories.get(key);
        var literalFactoryArguments = values.filter((function (e) { return !e.isConstant(); }));
        if (!literalFactory) {
            var resultExpressions = values.map(function (e, index) { return e.isConstant() ? _this.getConstLiteral(e, true) : o.variable("a" + index); });
            var parameters = resultExpressions.filter(isVariable).map(function (e) { return new o.FnParam(e.name, o.DYNAMIC_TYPE); });
            var pureFunctionDeclaration = o.fn(parameters, [new o.ReturnStatement(resultMap(resultExpressions))], o.INFERRED_TYPE);
            var name_3 = this.freshName();
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
    ConstantPool.prototype.uniqueName = function (prefix) { return "" + prefix + this.nextNameIndex++; };
    ConstantPool.prototype.definitionsOf = function (kind) {
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
    ConstantPool.prototype.propertyNameOf = function (kind) {
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
    ConstantPool.prototype.freshName = function () { return this.uniqueName(CONSTANT_PREFIX); };
    ConstantPool.prototype.freshTranslationName = function () {
        return this.uniqueName(TRANSLATION_PREFIX).toUpperCase();
    };
    ConstantPool.prototype.keyOf = function (expression) {
        return expression.visitExpression(new KeyVisitor(), KEY_CONTEXT);
    };
    return ConstantPool;
}());
export { ConstantPool };
/**
 * Visitor used to determine if 2 expressions are equivalent and can be shared in the
 * `ConstantPool`.
 *
 * When the id (string) generated by the visitor is equal, expressions are considered equivalent.
 */
var KeyVisitor = /** @class */ (function () {
    function KeyVisitor() {
        this.visitWrappedNodeExpr = invalid;
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
    KeyVisitor.prototype.visitLiteralExpr = function (ast) {
        return "" + (typeof ast.value === 'string' ? '"' + ast.value + '"' : ast.value);
    };
    KeyVisitor.prototype.visitLiteralArrayExpr = function (ast, context) {
        var _this = this;
        return "[" + ast.entries.map(function (entry) { return entry.visitExpression(_this, context); }).join(',') + "]";
    };
    KeyVisitor.prototype.visitLiteralMapExpr = function (ast, context) {
        var _this = this;
        var mapKey = function (entry) {
            var quote = entry.quoted ? '"' : '';
            return "" + quote + entry.key + quote;
        };
        var mapEntry = function (entry) {
            return mapKey(entry) + ":" + entry.value.visitExpression(_this, context);
        };
        return "{" + ast.entries.map(mapEntry).join(',');
    };
    KeyVisitor.prototype.visitExternalExpr = function (ast) {
        return ast.value.moduleName ? "EX:" + ast.value.moduleName + ":" + ast.value.name :
            "EX:" + ast.value.runtime.name;
    };
    KeyVisitor.prototype.visitReadVarExpr = function (node) { return "VAR:" + node.name; };
    KeyVisitor.prototype.visitTypeofExpr = function (node, context) {
        return "TYPEOF:" + node.expr.visitExpression(this, context);
    };
    return KeyVisitor;
}());
function invalid(arg) {
    throw new Error("Invalid state: Visitor " + this.constructor.name + " doesn't handle " + arg.constructor.name);
}
function isVariable(e) {
    return e instanceof o.ReadVarExpr;
}
// Converts i18n meta informations for a message (description, meaning) to a JsDoc statement
// formatted as expected by the Closure compiler.
function i18nMetaToDocStmt(meta) {
    var tags = [];
    if (meta.description) {
        tags.push({ tagName: "desc" /* Desc */, text: meta.description });
    }
    if (meta.meaning) {
        tags.push({ tagName: "meaning" /* Meaning */, text: meta.meaning });
    }
    return tags.length == 0 ? null : new o.JSDocCommentStmt(tags);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRfcG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb25zdGFudF9wb29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3pDLE9BQU8sRUFBZ0IsS0FBSyxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUU3QixtRUFBbUU7QUFDbkUsSUFBTSxrQkFBa0IsR0FBRyxNQUFNLENBQUM7QUFJbEM7O0dBRUc7QUFDSCxJQUFNLFlBQVksR0FBRyxhQUFhLENBQUM7QUFFbkM7Ozs7O0dBS0c7QUFDSCxJQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFFdkI7Ozs7Ozs7R0FPRztBQUNIO0lBQThCLDJDQUFZO0lBTXhDLHlCQUFtQixRQUFzQjtRQUF6QyxZQUNFLGtCQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FFckI7UUFIa0IsY0FBUSxHQUFSLFFBQVEsQ0FBYztRQUV2QyxLQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQzs7SUFDM0IsQ0FBQztJQUVELHlDQUFlLEdBQWYsVUFBZ0IsT0FBNEIsRUFBRSxPQUFZO1FBQ3hELElBQUksT0FBTyxLQUFLLFdBQVcsRUFBRTtZQUMzQixnRUFBZ0U7WUFDaEUsZ0NBQWdDO1lBQ2hDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3hEO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN4RDtJQUNILENBQUM7SUFFRCxzQ0FBWSxHQUFaLFVBQWEsQ0FBZTtRQUMxQixPQUFPLENBQUMsWUFBWSxlQUFlLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFRCxvQ0FBVSxHQUFWLGNBQWUsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRTdCLCtCQUFLLEdBQUwsVUFBTSxVQUF3QjtRQUM1QixJQUFJLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztRQUMzQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztJQUNyQixDQUFDO0lBQ0gsc0JBQUM7QUFBRCxDQUFDLEFBL0JELENBQThCLENBQUMsQ0FBQyxVQUFVLEdBK0J6QztBQUVEOzs7O0dBSUc7QUFDSDtJQUFBO1FBQ0UsZUFBVSxHQUFrQixFQUFFLENBQUM7UUFDdkIsaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBd0IsQ0FBQztRQUMvQyxhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7UUFDOUMscUJBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7UUFDbkQsd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7UUFDdEQseUJBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7UUFDdkQseUJBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7UUFDdkQsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBd0IsQ0FBQztRQUVsRCxrQkFBYSxHQUFHLENBQUMsQ0FBQztJQW1MNUIsQ0FBQztJQWpMQyxzQ0FBZSxHQUFmLFVBQWdCLE9BQXFCLEVBQUUsV0FBcUI7UUFDMUQsSUFBSSxPQUFPLFlBQVksQ0FBQyxDQUFDLFdBQVcsSUFBSSxPQUFPLFlBQVksZUFBZSxFQUFFO1lBQzFFLHNGQUFzRjtZQUN0RiwyQkFBMkI7WUFDM0IsT0FBTyxPQUFPLENBQUM7U0FDaEI7UUFDRCxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hDLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25DLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztRQUNyQixJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsS0FBSyxHQUFHLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM5QixRQUFRLEdBQUcsSUFBSSxDQUFDO1NBQ2pCO1FBRUQsSUFBSSxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLFdBQVcsQ0FBQyxFQUFFO1lBQzdELHlDQUF5QztZQUN6QyxJQUFNLE1BQUksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQ2hCLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkYsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQUksQ0FBQyxDQUFDLENBQUM7U0FDL0I7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxtREFBbUQ7SUFDbkQsRUFBRTtJQUNGLE1BQU07SUFDTixNQUFNO0lBQ04sd0JBQXdCO0lBQ3hCLHVCQUF1QjtJQUN2QixNQUFNO0lBQ04sMENBQTBDO0lBQzFDLE1BQU07SUFDTixxQ0FBYyxHQUFkLFVBQWUsT0FBZSxFQUFFLElBQThDO1FBQzVFLHlFQUF5RTtRQUN6RSxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBSSxPQUFPLFlBQWUsSUFBSSxDQUFDLE9BQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBRTdFLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXZDLElBQUksR0FBRyxFQUFFO1lBQ1AsT0FBTyxHQUFHLENBQUM7U0FDWjtRQUVELElBQU0sT0FBTyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksT0FBTyxFQUFFO1lBQ1gsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDL0I7UUFFRCxzQ0FBc0M7UUFDdEMsSUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckUsSUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN6RixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU5QixJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDckMsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVELG9DQUFhLEdBQWIsVUFBYyxJQUFTLEVBQUUsSUFBb0IsRUFBRSxHQUFrQixFQUFFLFdBQTRCO1FBQTVCLDRCQUFBLEVBQUEsbUJBQTRCO1FBRTdGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsSUFBSSxLQUFLLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDckIsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNWLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0MsS0FBSyxHQUFHLElBQUksZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDakUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDN0IsUUFBUSxHQUFHLElBQUksQ0FBQztTQUNqQjtRQUVELElBQUksQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsRUFBRTtZQUM3RCxJQUFNLE1BQUksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQ2hCLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlGLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFJLENBQUMsQ0FBQyxDQUFDO1NBQy9CO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsd0NBQWlCLEdBQWpCLFVBQWtCLE9BQTRDO1FBRTVELDZGQUE2RjtRQUM3RixJQUFJLE9BQU8sWUFBWSxDQUFDLENBQUMsZ0JBQWdCLEVBQUU7WUFDekMsSUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBcEMsQ0FBb0MsQ0FBQyxDQUFDO1lBQ3ZGLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO1lBQ3RELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQUEsT0FBTyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBckIsQ0FBcUIsQ0FBQyxDQUFDO1NBQ3hGO2FBQU07WUFDTCxJQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxVQUFVLENBQ2pDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQztnQkFDSixHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUc7Z0JBQ1YsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUN2RCxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07YUFDakIsQ0FBQyxFQUpHLENBSUgsQ0FBQyxDQUFDLENBQUM7WUFDN0IsSUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUMxQixHQUFHLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsS0FBSyxFQUFQLENBQU8sQ0FBQyxFQUN0QyxVQUFBLE9BQU8sSUFBSSxPQUFBLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEtBQUssRUFBRSxLQUFLLElBQUssT0FBQSxDQUFDO2dCQUNqQixHQUFHLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHO2dCQUMvQixLQUFLLE9BQUE7Z0JBQ0wsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTTthQUN0QyxDQUFDLEVBSmdCLENBSWhCLENBQUMsQ0FBQyxFQUo3QixDQUk2QixDQUFDLENBQUM7U0FDL0M7SUFDSCxDQUFDO0lBRU8seUNBQWtCLEdBQTFCLFVBQ0ksR0FBVyxFQUFFLE1BQXNCLEVBQUUsU0FBdUQ7UUFEaEcsaUJBcUJDO1FBbEJDLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDcEQsSUFBTSx1QkFBdUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBZixDQUFlLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDbkIsSUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUNoQyxVQUFDLENBQUMsRUFBRSxLQUFLLElBQUssT0FBQSxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQUksS0FBTyxDQUFDLEVBQXhFLENBQXdFLENBQUMsQ0FBQztZQUM1RixJQUFNLFVBQVUsR0FDWixpQkFBaUIsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFNLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUF2QyxDQUF1QyxDQUFDLENBQUM7WUFDM0YsSUFBTSx1QkFBdUIsR0FDekIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUM3RixJQUFNLE1BQUksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQ2hCLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUU7Z0JBQ3hFLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSzthQUNyQixDQUFDLENBQUMsQ0FBQztZQUNSLGNBQWMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQUksQ0FBQyxDQUFDO1lBQ2xDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1NBQ2hEO1FBQ0QsT0FBTyxFQUFDLGNBQWMsZ0JBQUEsRUFBRSx1QkFBdUIseUJBQUEsRUFBQyxDQUFDO0lBQ25ELENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxpQ0FBVSxHQUFWLFVBQVcsTUFBYyxJQUFZLE9BQU8sS0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBSSxDQUFDLENBQUMsQ0FBQztJQUV6RSxvQ0FBYSxHQUFyQixVQUFzQixJQUFvQjtRQUN4QyxRQUFRLElBQUksRUFBRTtZQUNaO2dCQUNFLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDO1lBQ25DO2dCQUNFLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDO1lBQ25DO2dCQUNFLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDO1lBQ2xDO2dCQUNFLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQztTQUMvQjtRQUNELEtBQUssQ0FBQyw2QkFBMkIsSUFBTSxDQUFDLENBQUM7UUFDekMsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDbkMsQ0FBQztJQUVNLHFDQUFjLEdBQXJCLFVBQXNCLElBQW9CO1FBQ3hDLFFBQVEsSUFBSSxFQUFFO1lBQ1o7Z0JBQ0UsT0FBTyxnQkFBZ0IsQ0FBQztZQUMxQjtnQkFDRSxPQUFPLGdCQUFnQixDQUFDO1lBQzFCO2dCQUNFLE9BQU8sZUFBZSxDQUFDO1lBQ3pCO2dCQUNFLE9BQU8sV0FBVyxDQUFDO1NBQ3RCO1FBQ0QsS0FBSyxDQUFDLDZCQUEyQixJQUFNLENBQUMsQ0FBQztRQUN6QyxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRU8sZ0NBQVMsR0FBakIsY0FBOEIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVoRSwyQ0FBb0IsR0FBNUI7UUFDRSxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUMzRCxDQUFDO0lBRU8sNEJBQUssR0FBYixVQUFjLFVBQXdCO1FBQ3BDLE9BQU8sVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLFVBQVUsRUFBRSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFDSCxtQkFBQztBQUFELENBQUMsQUE3TEQsSUE2TEM7O0FBRUQ7Ozs7O0dBS0c7QUFDSDtJQUFBO1FBOEJFLHlCQUFvQixHQUFHLE9BQU8sQ0FBQztRQUMvQixzQkFBaUIsR0FBRyxPQUFPLENBQUM7UUFDNUIsc0JBQWlCLEdBQUcsT0FBTyxDQUFDO1FBQzVCLHVCQUFrQixHQUFHLE9BQU8sQ0FBQztRQUM3QiwwQkFBcUIsR0FBRyxPQUFPLENBQUM7UUFDaEMsNEJBQXVCLEdBQUcsT0FBTyxDQUFDO1FBQ2xDLHlCQUFvQixHQUFHLE9BQU8sQ0FBQztRQUMvQix5QkFBb0IsR0FBRyxPQUFPLENBQUM7UUFDL0IsaUJBQVksR0FBRyxPQUFPLENBQUM7UUFDdkIsMkJBQXNCLEdBQUcsT0FBTyxDQUFDO1FBQ2pDLGtCQUFhLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLHNCQUFpQixHQUFHLE9BQU8sQ0FBQztRQUM1Qiw0QkFBdUIsR0FBRyxPQUFPLENBQUM7UUFDbEMsc0JBQWlCLEdBQUcsT0FBTyxDQUFDO1FBQzVCLHFCQUFnQixHQUFHLE9BQU8sQ0FBQztRQUMzQixtQkFBYyxHQUFHLE9BQU8sQ0FBQztJQUMzQixDQUFDO0lBN0NDLHFDQUFnQixHQUFoQixVQUFpQixHQUFrQjtRQUNqQyxPQUFPLE1BQUcsT0FBTyxHQUFHLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFFLENBQUM7SUFDaEYsQ0FBQztJQUVELDBDQUFxQixHQUFyQixVQUFzQixHQUF1QixFQUFFLE9BQWU7UUFBOUQsaUJBRUM7UUFEQyxPQUFPLE1BQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQUksRUFBRSxPQUFPLENBQUMsRUFBcEMsQ0FBb0MsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBRyxDQUFDO0lBQ3pGLENBQUM7SUFFRCx3Q0FBbUIsR0FBbkIsVUFBb0IsR0FBcUIsRUFBRSxPQUFlO1FBQTFELGlCQVFDO1FBUEMsSUFBTSxNQUFNLEdBQUcsVUFBQyxLQUF3QjtZQUN0QyxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUN0QyxPQUFPLEtBQUcsS0FBSyxHQUFHLEtBQUssQ0FBQyxHQUFHLEdBQUcsS0FBTyxDQUFDO1FBQ3hDLENBQUMsQ0FBQztRQUNGLElBQU0sUUFBUSxHQUFHLFVBQUMsS0FBd0I7WUFDdEMsT0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsS0FBSSxFQUFFLE9BQU8sQ0FBRztRQUFoRSxDQUFnRSxDQUFDO1FBQ3JFLE9BQU8sTUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFHLENBQUM7SUFDbkQsQ0FBQztJQUVELHNDQUFpQixHQUFqQixVQUFrQixHQUFtQjtRQUNuQyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxTQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBTSxDQUFDLENBQUM7WUFDaEQsUUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFNLENBQUM7SUFDL0QsQ0FBQztJQUVELHFDQUFnQixHQUFoQixVQUFpQixJQUFtQixJQUFJLE9BQU8sU0FBTyxJQUFJLENBQUMsSUFBTSxDQUFDLENBQUMsQ0FBQztJQUVwRSxvQ0FBZSxHQUFmLFVBQWdCLElBQWtCLEVBQUUsT0FBWTtRQUM5QyxPQUFPLFlBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBRyxDQUFDO0lBQzlELENBQUM7SUFrQkgsaUJBQUM7QUFBRCxDQUFDLEFBOUNELElBOENDO0FBRUQsU0FBUyxPQUFPLENBQUksR0FBK0I7SUFDakQsTUFBTSxJQUFJLEtBQUssQ0FDWCw0QkFBMEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLHdCQUFtQixHQUFHLENBQUMsV0FBVyxDQUFDLElBQU0sQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxDQUFlO0lBQ2pDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLENBQUM7QUFDcEMsQ0FBQztBQUVELDRGQUE0RjtBQUM1RixpREFBaUQ7QUFDakQsU0FBUyxpQkFBaUIsQ0FBQyxJQUEyRDtJQUVwRixJQUFNLElBQUksR0FBaUIsRUFBRSxDQUFDO0lBRTlCLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsT0FBTyxtQkFBcUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBQyxDQUFDLENBQUM7S0FDbkU7SUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8seUJBQXdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDO0tBQ2xFO0lBRUQsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBlcnJvcn0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgQ09OU1RBTlRfUFJFRklYID0gJ19jJztcblxuLy8gQ2xvc3VyZSB2YXJpYWJsZXMgaG9sZGluZyBtZXNzYWdlcyBtdXN0IGJlIG5hbWVkIGBNU0dfW0EtWjAtOV0rYFxuY29uc3QgVFJBTlNMQVRJT05fUFJFRklYID0gJ01TR18nO1xuXG5leHBvcnQgY29uc3QgZW51bSBEZWZpbml0aW9uS2luZCB7SW5qZWN0b3IsIERpcmVjdGl2ZSwgQ29tcG9uZW50LCBQaXBlfVxuXG4vKipcbiAqIENsb3N1cmUgdXNlcyBgZ29vZy5nZXRNc2cobWVzc2FnZSlgIHRvIGxvb2t1cCB0cmFuc2xhdGlvbnNcbiAqL1xuY29uc3QgR09PR19HRVRfTVNHID0gJ2dvb2cuZ2V0TXNnJztcblxuLyoqXG4gKiBDb250ZXh0IHRvIHVzZSB3aGVuIHByb2R1Y2luZyBhIGtleS5cbiAqXG4gKiBUaGlzIGVuc3VyZXMgd2Ugc2VlIHRoZSBjb25zdGFudCBub3QgdGhlIHJlZmVyZW5jZSB2YXJpYWJsZSB3aGVuIHByb2R1Y2luZ1xuICogYSBrZXkuXG4gKi9cbmNvbnN0IEtFWV9DT05URVhUID0ge307XG5cbi8qKlxuICogQSBub2RlIHRoYXQgaXMgYSBwbGFjZS1ob2xkZXIgdGhhdCBhbGxvd3MgdGhlIG5vZGUgdG8gYmUgcmVwbGFjZWQgd2hlbiB0aGUgYWN0dWFsXG4gKiBub2RlIGlzIGtub3duLlxuICpcbiAqIFRoaXMgYWxsb3dzIHRoZSBjb25zdGFudCBwb29sIHRvIGNoYW5nZSBhbiBleHByZXNzaW9uIGZyb20gYSBkaXJlY3QgcmVmZXJlbmNlIHRvXG4gKiBhIGNvbnN0YW50IHRvIGEgc2hhcmVkIGNvbnN0YW50LiBJdCByZXR1cm5zIGEgZml4LXVwIG5vZGUgdGhhdCBpcyBsYXRlciBhbGxvd2VkIHRvXG4gKiBjaGFuZ2UgdGhlIHJlZmVyZW5jZWQgZXhwcmVzc2lvbi5cbiAqL1xuY2xhc3MgRml4dXBFeHByZXNzaW9uIGV4dGVuZHMgby5FeHByZXNzaW9uIHtcbiAgcHJpdmF0ZSBvcmlnaW5hbDogby5FeHByZXNzaW9uO1xuXG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBzaGFyZWQgITogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVzb2x2ZWQ6IG8uRXhwcmVzc2lvbikge1xuICAgIHN1cGVyKHJlc29sdmVkLnR5cGUpO1xuICAgIHRoaXMub3JpZ2luYWwgPSByZXNvbHZlZDtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChjb250ZXh0ID09PSBLRVlfQ09OVEVYVCkge1xuICAgICAgLy8gV2hlbiBwcm9kdWNpbmcgYSBrZXkgd2Ugd2FudCB0byB0cmF2ZXJzZSB0aGUgY29uc3RhbnQgbm90IHRoZVxuICAgICAgLy8gdmFyaWFibGUgdXNlZCB0byByZWZlciB0byBpdC5cbiAgICAgIHJldHVybiB0aGlzLm9yaWdpbmFsLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZWQudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEZpeHVwRXhwcmVzc2lvbiAmJiB0aGlzLnJlc29sdmVkLmlzRXF1aXZhbGVudChlLnJlc29sdmVkKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7IHJldHVybiB0cnVlOyB9XG5cbiAgZml4dXAoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gICAgdGhpcy5yZXNvbHZlZCA9IGV4cHJlc3Npb247XG4gICAgdGhpcy5zaGFyZWQgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQSBjb25zdGFudCBwb29sIGFsbG93cyBhIGNvZGUgZW1pdHRlciB0byBzaGFyZSBjb25zdGFudCBpbiBhbiBvdXRwdXQgY29udGV4dC5cbiAqXG4gKiBUaGUgY29uc3RhbnQgcG9vbCBhbHNvIHN1cHBvcnRzIHNoYXJpbmcgYWNjZXNzIHRvIGl2eSBkZWZpbml0aW9ucyByZWZlcmVuY2VzLlxuICovXG5leHBvcnQgY2xhc3MgQ29uc3RhbnRQb29sIHtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIHRyYW5zbGF0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+KCk7XG4gIHByaXZhdGUgbGl0ZXJhbHMgPSBuZXcgTWFwPHN0cmluZywgRml4dXBFeHByZXNzaW9uPigpO1xuICBwcml2YXRlIGxpdGVyYWxGYWN0b3JpZXMgPSBuZXcgTWFwPHN0cmluZywgby5FeHByZXNzaW9uPigpO1xuICBwcml2YXRlIGluamVjdG9yRGVmaW5pdGlvbnMgPSBuZXcgTWFwPGFueSwgRml4dXBFeHByZXNzaW9uPigpO1xuICBwcml2YXRlIGRpcmVjdGl2ZURlZmluaXRpb25zID0gbmV3IE1hcDxhbnksIEZpeHVwRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBjb21wb25lbnREZWZpbml0aW9ucyA9IG5ldyBNYXA8YW55LCBGaXh1cEV4cHJlc3Npb24+KCk7XG4gIHByaXZhdGUgcGlwZURlZmluaXRpb25zID0gbmV3IE1hcDxhbnksIEZpeHVwRXhwcmVzc2lvbj4oKTtcblxuICBwcml2YXRlIG5leHROYW1lSW5kZXggPSAwO1xuXG4gIGdldENvbnN0TGl0ZXJhbChsaXRlcmFsOiBvLkV4cHJlc3Npb24sIGZvcmNlU2hhcmVkPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKGxpdGVyYWwgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByIHx8IGxpdGVyYWwgaW5zdGFuY2VvZiBGaXh1cEV4cHJlc3Npb24pIHtcbiAgICAgIC8vIERvIG5vIHB1dCBzaW1wbGUgbGl0ZXJhbHMgaW50byB0aGUgY29uc3RhbnQgcG9vbCBvciB0cnkgdG8gcHJvZHVjZSBhIGNvbnN0YW50IGZvciBhXG4gICAgICAvLyByZWZlcmVuY2UgdG8gYSBjb25zdGFudC5cbiAgICAgIHJldHVybiBsaXRlcmFsO1xuICAgIH1cbiAgICBjb25zdCBrZXkgPSB0aGlzLmtleU9mKGxpdGVyYWwpO1xuICAgIGxldCBmaXh1cCA9IHRoaXMubGl0ZXJhbHMuZ2V0KGtleSk7XG4gICAgbGV0IG5ld1ZhbHVlID0gZmFsc2U7XG4gICAgaWYgKCFmaXh1cCkge1xuICAgICAgZml4dXAgPSBuZXcgRml4dXBFeHByZXNzaW9uKGxpdGVyYWwpO1xuICAgICAgdGhpcy5saXRlcmFscy5zZXQoa2V5LCBmaXh1cCk7XG4gICAgICBuZXdWYWx1ZSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCghbmV3VmFsdWUgJiYgIWZpeHVwLnNoYXJlZCkgfHwgKG5ld1ZhbHVlICYmIGZvcmNlU2hhcmVkKSkge1xuICAgICAgLy8gUmVwbGFjZSB0aGUgZXhwcmVzc2lvbiB3aXRoIGEgdmFyaWFibGVcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmZyZXNoTmFtZSgpO1xuICAgICAgdGhpcy5zdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgby52YXJpYWJsZShuYW1lKS5zZXQobGl0ZXJhbCkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgICAgIGZpeHVwLmZpeHVwKG8udmFyaWFibGUobmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBmaXh1cDtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlcyBjbG9zdXJlIHNwZWNpZmljIGNvZGUgZm9yIHRyYW5zbGF0aW9uLlxuICAvL1xuICAvLyBgYGBcbiAgLy8gLyoqXG4gIC8vICAqIEBkZXNjIGRlc2NyaXB0aW9uP1xuICAvLyAgKiBAbWVhbmluZyBtZWFuaW5nP1xuICAvLyAgKi9cbiAgLy8gY29uc3QgTVNHX1hZWiA9IGdvb2cuZ2V0TXNnKCdtZXNzYWdlJyk7XG4gIC8vIGBgYFxuICBnZXRUcmFuc2xhdGlvbihtZXNzYWdlOiBzdHJpbmcsIG1ldGE6IHtkZXNjcmlwdGlvbj86IHN0cmluZywgbWVhbmluZz86IHN0cmluZ30pOiBvLkV4cHJlc3Npb24ge1xuICAgIC8vIFRoZSBpZGVudGl0eSBvZiBhbiBpMThuIG1lc3NhZ2UgZGVwZW5kcyBvbiB0aGUgbWVzc2FnZSBhbmQgaXRzIG1lYW5pbmdcbiAgICBjb25zdCBrZXkgPSBtZXRhLm1lYW5pbmcgPyBgJHttZXNzYWdlfVxcdTAwMDBcXHUwMDAwJHttZXRhLm1lYW5pbmd9YCA6IG1lc3NhZ2U7XG5cbiAgICBjb25zdCBleHAgPSB0aGlzLnRyYW5zbGF0aW9ucy5nZXQoa2V5KTtcblxuICAgIGlmIChleHApIHtcbiAgICAgIHJldHVybiBleHA7XG4gICAgfVxuXG4gICAgY29uc3QgZG9jU3RtdCA9IGkxOG5NZXRhVG9Eb2NTdG10KG1ldGEpO1xuICAgIGlmIChkb2NTdG10KSB7XG4gICAgICB0aGlzLnN0YXRlbWVudHMucHVzaChkb2NTdG10KTtcbiAgICB9XG5cbiAgICAvLyBDYWxsIGNsb3N1cmUgdG8gZ2V0IHRoZSB0cmFuc2xhdGlvblxuICAgIGNvbnN0IHZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLmZyZXNoVHJhbnNsYXRpb25OYW1lKCkpO1xuICAgIGNvbnN0IGZuQ2FsbCA9IG8udmFyaWFibGUoR09PR19HRVRfTVNHKS5jYWxsRm4oW28ubGl0ZXJhbChtZXNzYWdlKV0pO1xuICAgIGNvbnN0IG1zZ1N0bXQgPSB2YXJpYWJsZS5zZXQoZm5DYWxsKS50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSk7XG4gICAgdGhpcy5zdGF0ZW1lbnRzLnB1c2gobXNnU3RtdCk7XG5cbiAgICB0aGlzLnRyYW5zbGF0aW9ucy5zZXQoa2V5LCB2YXJpYWJsZSk7XG4gICAgcmV0dXJuIHZhcmlhYmxlO1xuICB9XG5cbiAgZ2V0RGVmaW5pdGlvbih0eXBlOiBhbnksIGtpbmQ6IERlZmluaXRpb25LaW5kLCBjdHg6IE91dHB1dENvbnRleHQsIGZvcmNlU2hhcmVkOiBib29sZWFuID0gZmFsc2UpOlxuICAgICAgby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBkZWZpbml0aW9ucyA9IHRoaXMuZGVmaW5pdGlvbnNPZihraW5kKTtcbiAgICBsZXQgZml4dXAgPSBkZWZpbml0aW9ucy5nZXQodHlwZSk7XG4gICAgbGV0IG5ld1ZhbHVlID0gZmFsc2U7XG4gICAgaWYgKCFmaXh1cCkge1xuICAgICAgY29uc3QgcHJvcGVydHkgPSB0aGlzLnByb3BlcnR5TmFtZU9mKGtpbmQpO1xuICAgICAgZml4dXAgPSBuZXcgRml4dXBFeHByZXNzaW9uKGN0eC5pbXBvcnRFeHByKHR5cGUpLnByb3AocHJvcGVydHkpKTtcbiAgICAgIGRlZmluaXRpb25zLnNldCh0eXBlLCBmaXh1cCk7XG4gICAgICBuZXdWYWx1ZSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCghbmV3VmFsdWUgJiYgIWZpeHVwLnNoYXJlZCkgfHwgKG5ld1ZhbHVlICYmIGZvcmNlU2hhcmVkKSkge1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuZnJlc2hOYW1lKCk7XG4gICAgICB0aGlzLnN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICBvLnZhcmlhYmxlKG5hbWUpLnNldChmaXh1cC5yZXNvbHZlZCkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgICAgIGZpeHVwLmZpeHVwKG8udmFyaWFibGUobmFtZSkpO1xuICAgIH1cbiAgICByZXR1cm4gZml4dXA7XG4gIH1cblxuICBnZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHJ8by5MaXRlcmFsTWFwRXhwcik6XG4gICAgICB7bGl0ZXJhbEZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHM6IG8uRXhwcmVzc2lvbltdfSB7XG4gICAgLy8gQ3JlYXRlIGEgcHVyZSBmdW5jdGlvbiB0aGF0IGJ1aWxkcyBhbiBhcnJheSBvZiBhIG1peCBvZiBjb25zdGFudCAgYW5kIHZhcmlhYmxlIGV4cHJlc3Npb25zXG4gICAgaWYgKGxpdGVyYWwgaW5zdGFuY2VvZiBvLkxpdGVyYWxBcnJheUV4cHIpIHtcbiAgICAgIGNvbnN0IGFyZ3VtZW50c0ZvcktleSA9IGxpdGVyYWwuZW50cmllcy5tYXAoZSA9PiBlLmlzQ29uc3RhbnQoKSA/IGUgOiBvLmxpdGVyYWwobnVsbCkpO1xuICAgICAgY29uc3Qga2V5ID0gdGhpcy5rZXlPZihvLmxpdGVyYWxBcnIoYXJndW1lbnRzRm9yS2V5KSk7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0TGl0ZXJhbEZhY3Rvcnkoa2V5LCBsaXRlcmFsLmVudHJpZXMsIGVudHJpZXMgPT4gby5saXRlcmFsQXJyKGVudHJpZXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZXhwcmVzc2lvbkZvcktleSA9IG8ubGl0ZXJhbE1hcChcbiAgICAgICAgICBsaXRlcmFsLmVudHJpZXMubWFwKGUgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBlLmtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGUudmFsdWUuaXNDb25zdGFudCgpID8gZS52YWx1ZSA6IG8ubGl0ZXJhbChudWxsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVvdGVkOiBlLnF1b3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgIGNvbnN0IGtleSA9IHRoaXMua2V5T2YoZXhwcmVzc2lvbkZvcktleSk7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgICAgICAga2V5LCBsaXRlcmFsLmVudHJpZXMubWFwKGUgPT4gZS52YWx1ZSksXG4gICAgICAgICAgZW50cmllcyA9PiBvLmxpdGVyYWxNYXAoZW50cmllcy5tYXAoKHZhbHVlLCBpbmRleCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogbGl0ZXJhbC5lbnRyaWVzW2luZGV4XS5rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogbGl0ZXJhbC5lbnRyaWVzW2luZGV4XS5xdW90ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSkpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9nZXRMaXRlcmFsRmFjdG9yeShcbiAgICAgIGtleTogc3RyaW5nLCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdLCByZXN1bHRNYXA6IChwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSkgPT4gby5FeHByZXNzaW9uKTpcbiAgICAgIHtsaXRlcmFsRmFjdG9yeTogby5FeHByZXNzaW9uLCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50czogby5FeHByZXNzaW9uW119IHtcbiAgICBsZXQgbGl0ZXJhbEZhY3RvcnkgPSB0aGlzLmxpdGVyYWxGYWN0b3JpZXMuZ2V0KGtleSk7XG4gICAgY29uc3QgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMgPSB2YWx1ZXMuZmlsdGVyKChlID0+ICFlLmlzQ29uc3RhbnQoKSkpO1xuICAgIGlmICghbGl0ZXJhbEZhY3RvcnkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdEV4cHJlc3Npb25zID0gdmFsdWVzLm1hcChcbiAgICAgICAgICAoZSwgaW5kZXgpID0+IGUuaXNDb25zdGFudCgpID8gdGhpcy5nZXRDb25zdExpdGVyYWwoZSwgdHJ1ZSkgOiBvLnZhcmlhYmxlKGBhJHtpbmRleH1gKSk7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzID1cbiAgICAgICAgICByZXN1bHRFeHByZXNzaW9ucy5maWx0ZXIoaXNWYXJpYWJsZSkubWFwKGUgPT4gbmV3IG8uRm5QYXJhbShlLm5hbWUgISwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIGNvbnN0IHB1cmVGdW5jdGlvbkRlY2xhcmF0aW9uID1cbiAgICAgICAgICBvLmZuKHBhcmFtZXRlcnMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmVzdWx0TWFwKHJlc3VsdEV4cHJlc3Npb25zKSldLCBvLklORkVSUkVEX1RZUEUpO1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuZnJlc2hOYW1lKCk7XG4gICAgICB0aGlzLnN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICBvLnZhcmlhYmxlKG5hbWUpLnNldChwdXJlRnVuY3Rpb25EZWNsYXJhdGlvbikudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkZpbmFsXG4gICAgICAgICAgXSkpO1xuICAgICAgbGl0ZXJhbEZhY3RvcnkgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgICAgdGhpcy5saXRlcmFsRmFjdG9yaWVzLnNldChrZXksIGxpdGVyYWxGYWN0b3J5KTtcbiAgICB9XG4gICAgcmV0dXJuIHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2R1Y2UgYSB1bmlxdWUgbmFtZS5cbiAgICpcbiAgICogVGhlIG5hbWUgbWlnaHQgYmUgdW5pcXVlIGFtb25nIGRpZmZlcmVudCBwcmVmaXhlcyBpZiBhbnkgb2YgdGhlIHByZWZpeGVzIGVuZCBpblxuICAgKiBhIGRpZ2l0IHNvIHRoZSBwcmVmaXggc2hvdWxkIGJlIGEgY29uc3RhbnQgc3RyaW5nIChub3QgYmFzZWQgb24gdXNlciBpbnB1dCkgYW5kXG4gICAqIG11c3Qgbm90IGVuZCBpbiBhIGRpZ2l0LlxuICAgKi9cbiAgdW5pcXVlTmFtZShwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7IHJldHVybiBgJHtwcmVmaXh9JHt0aGlzLm5leHROYW1lSW5kZXgrK31gOyB9XG5cbiAgcHJpdmF0ZSBkZWZpbml0aW9uc09mKGtpbmQ6IERlZmluaXRpb25LaW5kKTogTWFwPGFueSwgRml4dXBFeHByZXNzaW9uPiB7XG4gICAgc3dpdGNoIChraW5kKSB7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLkNvbXBvbmVudDpcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcG9uZW50RGVmaW5pdGlvbnM7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLkRpcmVjdGl2ZTpcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlyZWN0aXZlRGVmaW5pdGlvbnM7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLkluamVjdG9yOlxuICAgICAgICByZXR1cm4gdGhpcy5pbmplY3RvckRlZmluaXRpb25zO1xuICAgICAgY2FzZSBEZWZpbml0aW9uS2luZC5QaXBlOlxuICAgICAgICByZXR1cm4gdGhpcy5waXBlRGVmaW5pdGlvbnM7XG4gICAgfVxuICAgIGVycm9yKGBVbmtub3duIGRlZmluaXRpb24ga2luZCAke2tpbmR9YCk7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50RGVmaW5pdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgcHJvcGVydHlOYW1lT2Yoa2luZDogRGVmaW5pdGlvbktpbmQpOiBzdHJpbmcge1xuICAgIHN3aXRjaCAoa2luZCkge1xuICAgICAgY2FzZSBEZWZpbml0aW9uS2luZC5Db21wb25lbnQ6XG4gICAgICAgIHJldHVybiAnbmdDb21wb25lbnREZWYnO1xuICAgICAgY2FzZSBEZWZpbml0aW9uS2luZC5EaXJlY3RpdmU6XG4gICAgICAgIHJldHVybiAnbmdEaXJlY3RpdmVEZWYnO1xuICAgICAgY2FzZSBEZWZpbml0aW9uS2luZC5JbmplY3RvcjpcbiAgICAgICAgcmV0dXJuICduZ0luamVjdG9yRGVmJztcbiAgICAgIGNhc2UgRGVmaW5pdGlvbktpbmQuUGlwZTpcbiAgICAgICAgcmV0dXJuICduZ1BpcGVEZWYnO1xuICAgIH1cbiAgICBlcnJvcihgVW5rbm93biBkZWZpbml0aW9uIGtpbmQgJHtraW5kfWApO1xuICAgIHJldHVybiAnPHVua25vd24+JztcbiAgfVxuXG4gIHByaXZhdGUgZnJlc2hOYW1lKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLnVuaXF1ZU5hbWUoQ09OU1RBTlRfUFJFRklYKTsgfVxuXG4gIHByaXZhdGUgZnJlc2hUcmFuc2xhdGlvbk5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1BSRUZJWCkudG9VcHBlckNhc2UoKTtcbiAgfVxuXG4gIHByaXZhdGUga2V5T2YoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb24udmlzaXRFeHByZXNzaW9uKG5ldyBLZXlWaXNpdG9yKCksIEtFWV9DT05URVhUKTtcbiAgfVxufVxuXG4vKipcbiAqIFZpc2l0b3IgdXNlZCB0byBkZXRlcm1pbmUgaWYgMiBleHByZXNzaW9ucyBhcmUgZXF1aXZhbGVudCBhbmQgY2FuIGJlIHNoYXJlZCBpbiB0aGVcbiAqIGBDb25zdGFudFBvb2xgLlxuICpcbiAqIFdoZW4gdGhlIGlkIChzdHJpbmcpIGdlbmVyYXRlZCBieSB0aGUgdmlzaXRvciBpcyBlcXVhbCwgZXhwcmVzc2lvbnMgYXJlIGNvbnNpZGVyZWQgZXF1aXZhbGVudC5cbiAqL1xuY2xhc3MgS2V5VmlzaXRvciBpbXBsZW1lbnRzIG8uRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdExpdGVyYWxFeHByKGFzdDogby5MaXRlcmFsRXhwcik6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3R5cGVvZiBhc3QudmFsdWUgPT09ICdzdHJpbmcnID8gJ1wiJyArIGFzdC52YWx1ZSArICdcIicgOiBhc3QudmFsdWV9YDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IG8uTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogb2JqZWN0KTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFske2FzdC5lbnRyaWVzLm1hcChlbnRyeSA9PiBlbnRyeS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpLmpvaW4oJywnKX1dYDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBvLkxpdGVyYWxNYXBFeHByLCBjb250ZXh0OiBvYmplY3QpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1hcEtleSA9IChlbnRyeTogby5MaXRlcmFsTWFwRW50cnkpID0+IHtcbiAgICAgIGNvbnN0IHF1b3RlID0gZW50cnkucXVvdGVkID8gJ1wiJyA6ICcnO1xuICAgICAgcmV0dXJuIGAke3F1b3RlfSR7ZW50cnkua2V5fSR7cXVvdGV9YDtcbiAgICB9O1xuICAgIGNvbnN0IG1hcEVudHJ5ID0gKGVudHJ5OiBvLkxpdGVyYWxNYXBFbnRyeSkgPT5cbiAgICAgICAgYCR7bWFwS2V5KGVudHJ5KX06JHtlbnRyeS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCl9YDtcbiAgICByZXR1cm4gYHske2FzdC5lbnRyaWVzLm1hcChtYXBFbnRyeSkuam9pbignLCcpfWA7XG4gIH1cblxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYXN0LnZhbHVlLm1vZHVsZU5hbWUgPyBgRVg6JHthc3QudmFsdWUubW9kdWxlTmFtZX06JHthc3QudmFsdWUubmFtZX1gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgRVg6JHthc3QudmFsdWUucnVudGltZS5uYW1lfWA7XG4gIH1cblxuICB2aXNpdFJlYWRWYXJFeHByKG5vZGU6IG8uUmVhZFZhckV4cHIpIHsgcmV0dXJuIGBWQVI6JHtub2RlLm5hbWV9YDsgfVxuXG4gIHZpc2l0VHlwZW9mRXhwcihub2RlOiBvLlR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBUWVBFT0Y6JHtub2RlLmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpfWA7XG4gIH1cblxuICB2aXNpdFdyYXBwZWROb2RlRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0V3JpdGVWYXJFeHByID0gaW52YWxpZDtcbiAgdmlzaXRXcml0ZUtleUV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdFdyaXRlUHJvcEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEludm9rZU1ldGhvZEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByID0gaW52YWxpZDtcbiAgdmlzaXRDb25kaXRpb25hbEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdE5vdEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEFzc2VydE5vdE51bGxFeHByID0gaW52YWxpZDtcbiAgdmlzaXRDYXN0RXhwciA9IGludmFsaWQ7XG4gIHZpc2l0RnVuY3Rpb25FeHByID0gaW52YWxpZDtcbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdFJlYWRQcm9wRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0UmVhZEtleUV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdENvbW1hRXhwciA9IGludmFsaWQ7XG59XG5cbmZ1bmN0aW9uIGludmFsaWQ8VD4oYXJnOiBvLkV4cHJlc3Npb24gfCBvLlN0YXRlbWVudCk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgc3RhdGU6IFZpc2l0b3IgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGRvZXNuJ3QgaGFuZGxlICR7YXJnLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG59XG5cbmZ1bmN0aW9uIGlzVmFyaWFibGUoZTogby5FeHByZXNzaW9uKTogZSBpcyBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIGUgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByO1xufVxuXG4vLyBDb252ZXJ0cyBpMThuIG1ldGEgaW5mb3JtYXRpb25zIGZvciBhIG1lc3NhZ2UgKGRlc2NyaXB0aW9uLCBtZWFuaW5nKSB0byBhIEpzRG9jIHN0YXRlbWVudFxuLy8gZm9ybWF0dGVkIGFzIGV4cGVjdGVkIGJ5IHRoZSBDbG9zdXJlIGNvbXBpbGVyLlxuZnVuY3Rpb24gaTE4bk1ldGFUb0RvY1N0bXQobWV0YToge2Rlc2NyaXB0aW9uPzogc3RyaW5nLCBpZD86IHN0cmluZywgbWVhbmluZz86IHN0cmluZ30pOlxuICAgIG8uSlNEb2NDb21tZW50U3RtdHxudWxsIHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG5cbiAgaWYgKG1ldGEuZGVzY3JpcHRpb24pIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLkRlc2MsIHRleHQ6IG1ldGEuZGVzY3JpcHRpb259KTtcbiAgfVxuXG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLk1lYW5pbmcsIHRleHQ6IG1ldGEubWVhbmluZ30pO1xuICB9XG5cbiAgcmV0dXJuIHRhZ3MubGVuZ3RoID09IDAgPyBudWxsIDogbmV3IG8uSlNEb2NDb21tZW50U3RtdCh0YWdzKTtcbn1cbiJdfQ==