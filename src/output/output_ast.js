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
        define("@angular/compiler/src/output/output_ast", ["require", "exports", "tslib"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isNull = exports.localizedString = exports.literal = exports.ifStmt = exports.fn = exports.assertNotNull = exports.not = exports.unary = exports.literalMap = exports.literalArr = exports.typeofExpr = exports.expressionType = exports.importType = exports.importExpr = exports.variable = exports.applySourceSpanToExpressionIfNeeded = exports.applySourceSpanToStatementIfNeeded = exports.collectExternalReferences = exports.findReadVarNames = exports.RecursiveAstVisitor = exports.AstTransformer = exports.ThrowStmt = exports.TryCatchStmt = exports.JSDocCommentStmt = exports.CommentStmt = exports.IfStmt = exports.ClassStmt = exports.ClassGetter = exports.ClassMethod = exports.ClassField = exports.AbstractClassPart = exports.ReturnStatement = exports.ExpressionStatement = exports.DeclareFunctionStmt = exports.DeclareVarStmt = exports.Statement = exports.StmtModifier = exports.TYPED_NULL_EXPR = exports.NULL_EXPR = exports.CATCH_STACK_VAR = exports.CATCH_ERROR_VAR = exports.SUPER_EXPR = exports.THIS_EXPR = exports.CommaExpr = exports.LiteralMapExpr = exports.LiteralMapEntry = exports.LiteralArrayExpr = exports.ReadKeyExpr = exports.ReadPropExpr = exports.BinaryOperatorExpr = exports.UnaryOperatorExpr = exports.FunctionExpr = exports.FnParam = exports.CastExpr = exports.AssertNotNull = exports.NotExpr = exports.ConditionalExpr = exports.ExternalReference = exports.ExternalExpr = exports.LocalizedString = exports.PlaceholderPiece = exports.LiteralPiece = exports.MessagePiece = exports.LiteralExpr = exports.InstantiateExpr = exports.InvokeFunctionExpr = exports.InvokeMethodExpr = exports.BuiltinMethod = exports.WritePropExpr = exports.WriteKeyExpr = exports.WriteVarExpr = exports.WrappedNodeExpr = exports.TypeofExpr = exports.ReadVarExpr = exports.BuiltinVar = exports.Expression = exports.areAllEquivalent = exports.nullSafeIsEquivalent = exports.BinaryOperator = exports.UnaryOperator = exports.NONE_TYPE = exports.FUNCTION_TYPE = exports.STRING_TYPE = exports.NUMBER_TYPE = exports.INT_TYPE = exports.BOOL_TYPE = exports.INFERRED_TYPE = exports.DYNAMIC_TYPE = exports.MapType = exports.ArrayType = exports.ExpressionType = exports.BuiltinType = exports.BuiltinTypeName = exports.Type = exports.TypeModifier = void 0;
    var tslib_1 = require("tslib");
    //// Types
    var TypeModifier;
    (function (TypeModifier) {
        TypeModifier[TypeModifier["Const"] = 0] = "Const";
    })(TypeModifier = exports.TypeModifier || (exports.TypeModifier = {}));
    var Type = /** @class */ (function () {
        function Type(modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            this.modifiers = modifiers;
            if (!modifiers) {
                this.modifiers = [];
            }
        }
        Type.prototype.hasModifier = function (modifier) {
            return this.modifiers.indexOf(modifier) !== -1;
        };
        return Type;
    }());
    exports.Type = Type;
    var BuiltinTypeName;
    (function (BuiltinTypeName) {
        BuiltinTypeName[BuiltinTypeName["Dynamic"] = 0] = "Dynamic";
        BuiltinTypeName[BuiltinTypeName["Bool"] = 1] = "Bool";
        BuiltinTypeName[BuiltinTypeName["String"] = 2] = "String";
        BuiltinTypeName[BuiltinTypeName["Int"] = 3] = "Int";
        BuiltinTypeName[BuiltinTypeName["Number"] = 4] = "Number";
        BuiltinTypeName[BuiltinTypeName["Function"] = 5] = "Function";
        BuiltinTypeName[BuiltinTypeName["Inferred"] = 6] = "Inferred";
        BuiltinTypeName[BuiltinTypeName["None"] = 7] = "None";
    })(BuiltinTypeName = exports.BuiltinTypeName || (exports.BuiltinTypeName = {}));
    var BuiltinType = /** @class */ (function (_super) {
        tslib_1.__extends(BuiltinType, _super);
        function BuiltinType(name, modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, modifiers) || this;
            _this.name = name;
            return _this;
        }
        BuiltinType.prototype.visitType = function (visitor, context) {
            return visitor.visitBuiltinType(this, context);
        };
        return BuiltinType;
    }(Type));
    exports.BuiltinType = BuiltinType;
    var ExpressionType = /** @class */ (function (_super) {
        tslib_1.__extends(ExpressionType, _super);
        function ExpressionType(value, modifiers, typeParams) {
            if (modifiers === void 0) { modifiers = null; }
            if (typeParams === void 0) { typeParams = null; }
            var _this = _super.call(this, modifiers) || this;
            _this.value = value;
            _this.typeParams = typeParams;
            return _this;
        }
        ExpressionType.prototype.visitType = function (visitor, context) {
            return visitor.visitExpressionType(this, context);
        };
        return ExpressionType;
    }(Type));
    exports.ExpressionType = ExpressionType;
    var ArrayType = /** @class */ (function (_super) {
        tslib_1.__extends(ArrayType, _super);
        function ArrayType(of, modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, modifiers) || this;
            _this.of = of;
            return _this;
        }
        ArrayType.prototype.visitType = function (visitor, context) {
            return visitor.visitArrayType(this, context);
        };
        return ArrayType;
    }(Type));
    exports.ArrayType = ArrayType;
    var MapType = /** @class */ (function (_super) {
        tslib_1.__extends(MapType, _super);
        function MapType(valueType, modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, modifiers) || this;
            _this.valueType = valueType || null;
            return _this;
        }
        MapType.prototype.visitType = function (visitor, context) {
            return visitor.visitMapType(this, context);
        };
        return MapType;
    }(Type));
    exports.MapType = MapType;
    exports.DYNAMIC_TYPE = new BuiltinType(BuiltinTypeName.Dynamic);
    exports.INFERRED_TYPE = new BuiltinType(BuiltinTypeName.Inferred);
    exports.BOOL_TYPE = new BuiltinType(BuiltinTypeName.Bool);
    exports.INT_TYPE = new BuiltinType(BuiltinTypeName.Int);
    exports.NUMBER_TYPE = new BuiltinType(BuiltinTypeName.Number);
    exports.STRING_TYPE = new BuiltinType(BuiltinTypeName.String);
    exports.FUNCTION_TYPE = new BuiltinType(BuiltinTypeName.Function);
    exports.NONE_TYPE = new BuiltinType(BuiltinTypeName.None);
    ///// Expressions
    var UnaryOperator;
    (function (UnaryOperator) {
        UnaryOperator[UnaryOperator["Minus"] = 0] = "Minus";
        UnaryOperator[UnaryOperator["Plus"] = 1] = "Plus";
    })(UnaryOperator = exports.UnaryOperator || (exports.UnaryOperator = {}));
    var BinaryOperator;
    (function (BinaryOperator) {
        BinaryOperator[BinaryOperator["Equals"] = 0] = "Equals";
        BinaryOperator[BinaryOperator["NotEquals"] = 1] = "NotEquals";
        BinaryOperator[BinaryOperator["Identical"] = 2] = "Identical";
        BinaryOperator[BinaryOperator["NotIdentical"] = 3] = "NotIdentical";
        BinaryOperator[BinaryOperator["Minus"] = 4] = "Minus";
        BinaryOperator[BinaryOperator["Plus"] = 5] = "Plus";
        BinaryOperator[BinaryOperator["Divide"] = 6] = "Divide";
        BinaryOperator[BinaryOperator["Multiply"] = 7] = "Multiply";
        BinaryOperator[BinaryOperator["Modulo"] = 8] = "Modulo";
        BinaryOperator[BinaryOperator["And"] = 9] = "And";
        BinaryOperator[BinaryOperator["Or"] = 10] = "Or";
        BinaryOperator[BinaryOperator["BitwiseAnd"] = 11] = "BitwiseAnd";
        BinaryOperator[BinaryOperator["Lower"] = 12] = "Lower";
        BinaryOperator[BinaryOperator["LowerEquals"] = 13] = "LowerEquals";
        BinaryOperator[BinaryOperator["Bigger"] = 14] = "Bigger";
        BinaryOperator[BinaryOperator["BiggerEquals"] = 15] = "BiggerEquals";
    })(BinaryOperator = exports.BinaryOperator || (exports.BinaryOperator = {}));
    function nullSafeIsEquivalent(base, other) {
        if (base == null || other == null) {
            return base == other;
        }
        return base.isEquivalent(other);
    }
    exports.nullSafeIsEquivalent = nullSafeIsEquivalent;
    function areAllEquivalent(base, other) {
        var len = base.length;
        if (len !== other.length) {
            return false;
        }
        for (var i = 0; i < len; i++) {
            if (!base[i].isEquivalent(other[i])) {
                return false;
            }
        }
        return true;
    }
    exports.areAllEquivalent = areAllEquivalent;
    var Expression = /** @class */ (function () {
        function Expression(type, sourceSpan) {
            this.type = type || null;
            this.sourceSpan = sourceSpan || null;
        }
        Expression.prototype.prop = function (name, sourceSpan) {
            return new ReadPropExpr(this, name, null, sourceSpan);
        };
        Expression.prototype.key = function (index, type, sourceSpan) {
            return new ReadKeyExpr(this, index, type, sourceSpan);
        };
        Expression.prototype.callMethod = function (name, params, sourceSpan) {
            return new InvokeMethodExpr(this, name, params, null, sourceSpan);
        };
        Expression.prototype.callFn = function (params, sourceSpan, pure) {
            return new InvokeFunctionExpr(this, params, null, sourceSpan, pure);
        };
        Expression.prototype.instantiate = function (params, type, sourceSpan) {
            return new InstantiateExpr(this, params, type, sourceSpan);
        };
        Expression.prototype.conditional = function (trueCase, falseCase, sourceSpan) {
            if (falseCase === void 0) { falseCase = null; }
            return new ConditionalExpr(this, trueCase, falseCase, null, sourceSpan);
        };
        Expression.prototype.equals = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Equals, this, rhs, null, sourceSpan);
        };
        Expression.prototype.notEquals = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.NotEquals, this, rhs, null, sourceSpan);
        };
        Expression.prototype.identical = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Identical, this, rhs, null, sourceSpan);
        };
        Expression.prototype.notIdentical = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.NotIdentical, this, rhs, null, sourceSpan);
        };
        Expression.prototype.minus = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Minus, this, rhs, null, sourceSpan);
        };
        Expression.prototype.plus = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Plus, this, rhs, null, sourceSpan);
        };
        Expression.prototype.divide = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Divide, this, rhs, null, sourceSpan);
        };
        Expression.prototype.multiply = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Multiply, this, rhs, null, sourceSpan);
        };
        Expression.prototype.modulo = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Modulo, this, rhs, null, sourceSpan);
        };
        Expression.prototype.and = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.And, this, rhs, null, sourceSpan);
        };
        Expression.prototype.bitwiseAnd = function (rhs, sourceSpan, parens) {
            if (parens === void 0) { parens = true; }
            return new BinaryOperatorExpr(BinaryOperator.BitwiseAnd, this, rhs, null, sourceSpan, parens);
        };
        Expression.prototype.or = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Or, this, rhs, null, sourceSpan);
        };
        Expression.prototype.lower = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Lower, this, rhs, null, sourceSpan);
        };
        Expression.prototype.lowerEquals = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.LowerEquals, this, rhs, null, sourceSpan);
        };
        Expression.prototype.bigger = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.Bigger, this, rhs, null, sourceSpan);
        };
        Expression.prototype.biggerEquals = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.BiggerEquals, this, rhs, null, sourceSpan);
        };
        Expression.prototype.isBlank = function (sourceSpan) {
            // Note: We use equals by purpose here to compare to null and undefined in JS.
            // We use the typed null to allow strictNullChecks to narrow types.
            return this.equals(exports.TYPED_NULL_EXPR, sourceSpan);
        };
        Expression.prototype.cast = function (type, sourceSpan) {
            return new CastExpr(this, type, sourceSpan);
        };
        Expression.prototype.toStmt = function () {
            return new ExpressionStatement(this, null);
        };
        return Expression;
    }());
    exports.Expression = Expression;
    var BuiltinVar;
    (function (BuiltinVar) {
        BuiltinVar[BuiltinVar["This"] = 0] = "This";
        BuiltinVar[BuiltinVar["Super"] = 1] = "Super";
        BuiltinVar[BuiltinVar["CatchError"] = 2] = "CatchError";
        BuiltinVar[BuiltinVar["CatchStack"] = 3] = "CatchStack";
    })(BuiltinVar = exports.BuiltinVar || (exports.BuiltinVar = {}));
    var ReadVarExpr = /** @class */ (function (_super) {
        tslib_1.__extends(ReadVarExpr, _super);
        function ReadVarExpr(name, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            if (typeof name === 'string') {
                _this.name = name;
                _this.builtin = null;
            }
            else {
                _this.name = null;
                _this.builtin = name;
            }
            return _this;
        }
        ReadVarExpr.prototype.isEquivalent = function (e) {
            return e instanceof ReadVarExpr && this.name === e.name && this.builtin === e.builtin;
        };
        ReadVarExpr.prototype.isConstant = function () {
            return false;
        };
        ReadVarExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitReadVarExpr(this, context);
        };
        ReadVarExpr.prototype.set = function (value) {
            if (!this.name) {
                throw new Error("Built in variable " + this.builtin + " can not be assigned to.");
            }
            return new WriteVarExpr(this.name, value, null, this.sourceSpan);
        };
        return ReadVarExpr;
    }(Expression));
    exports.ReadVarExpr = ReadVarExpr;
    var TypeofExpr = /** @class */ (function (_super) {
        tslib_1.__extends(TypeofExpr, _super);
        function TypeofExpr(expr, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.expr = expr;
            return _this;
        }
        TypeofExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitTypeofExpr(this, context);
        };
        TypeofExpr.prototype.isEquivalent = function (e) {
            return e instanceof TypeofExpr && e.expr.isEquivalent(this.expr);
        };
        TypeofExpr.prototype.isConstant = function () {
            return this.expr.isConstant();
        };
        return TypeofExpr;
    }(Expression));
    exports.TypeofExpr = TypeofExpr;
    var WrappedNodeExpr = /** @class */ (function (_super) {
        tslib_1.__extends(WrappedNodeExpr, _super);
        function WrappedNodeExpr(node, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.node = node;
            return _this;
        }
        WrappedNodeExpr.prototype.isEquivalent = function (e) {
            return e instanceof WrappedNodeExpr && this.node === e.node;
        };
        WrappedNodeExpr.prototype.isConstant = function () {
            return false;
        };
        WrappedNodeExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitWrappedNodeExpr(this, context);
        };
        return WrappedNodeExpr;
    }(Expression));
    exports.WrappedNodeExpr = WrappedNodeExpr;
    var WriteVarExpr = /** @class */ (function (_super) {
        tslib_1.__extends(WriteVarExpr, _super);
        function WriteVarExpr(name, value, type, sourceSpan) {
            var _this = _super.call(this, type || value.type, sourceSpan) || this;
            _this.name = name;
            _this.value = value;
            return _this;
        }
        WriteVarExpr.prototype.isEquivalent = function (e) {
            return e instanceof WriteVarExpr && this.name === e.name && this.value.isEquivalent(e.value);
        };
        WriteVarExpr.prototype.isConstant = function () {
            return false;
        };
        WriteVarExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitWriteVarExpr(this, context);
        };
        WriteVarExpr.prototype.toDeclStmt = function (type, modifiers) {
            return new DeclareVarStmt(this.name, this.value, type, modifiers, this.sourceSpan);
        };
        WriteVarExpr.prototype.toConstDecl = function () {
            return this.toDeclStmt(exports.INFERRED_TYPE, [StmtModifier.Final]);
        };
        return WriteVarExpr;
    }(Expression));
    exports.WriteVarExpr = WriteVarExpr;
    var WriteKeyExpr = /** @class */ (function (_super) {
        tslib_1.__extends(WriteKeyExpr, _super);
        function WriteKeyExpr(receiver, index, value, type, sourceSpan) {
            var _this = _super.call(this, type || value.type, sourceSpan) || this;
            _this.receiver = receiver;
            _this.index = index;
            _this.value = value;
            return _this;
        }
        WriteKeyExpr.prototype.isEquivalent = function (e) {
            return e instanceof WriteKeyExpr && this.receiver.isEquivalent(e.receiver) &&
                this.index.isEquivalent(e.index) && this.value.isEquivalent(e.value);
        };
        WriteKeyExpr.prototype.isConstant = function () {
            return false;
        };
        WriteKeyExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitWriteKeyExpr(this, context);
        };
        return WriteKeyExpr;
    }(Expression));
    exports.WriteKeyExpr = WriteKeyExpr;
    var WritePropExpr = /** @class */ (function (_super) {
        tslib_1.__extends(WritePropExpr, _super);
        function WritePropExpr(receiver, name, value, type, sourceSpan) {
            var _this = _super.call(this, type || value.type, sourceSpan) || this;
            _this.receiver = receiver;
            _this.name = name;
            _this.value = value;
            return _this;
        }
        WritePropExpr.prototype.isEquivalent = function (e) {
            return e instanceof WritePropExpr && this.receiver.isEquivalent(e.receiver) &&
                this.name === e.name && this.value.isEquivalent(e.value);
        };
        WritePropExpr.prototype.isConstant = function () {
            return false;
        };
        WritePropExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitWritePropExpr(this, context);
        };
        return WritePropExpr;
    }(Expression));
    exports.WritePropExpr = WritePropExpr;
    var BuiltinMethod;
    (function (BuiltinMethod) {
        BuiltinMethod[BuiltinMethod["ConcatArray"] = 0] = "ConcatArray";
        BuiltinMethod[BuiltinMethod["SubscribeObservable"] = 1] = "SubscribeObservable";
        BuiltinMethod[BuiltinMethod["Bind"] = 2] = "Bind";
    })(BuiltinMethod = exports.BuiltinMethod || (exports.BuiltinMethod = {}));
    var InvokeMethodExpr = /** @class */ (function (_super) {
        tslib_1.__extends(InvokeMethodExpr, _super);
        function InvokeMethodExpr(receiver, method, args, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.receiver = receiver;
            _this.args = args;
            if (typeof method === 'string') {
                _this.name = method;
                _this.builtin = null;
            }
            else {
                _this.name = null;
                _this.builtin = method;
            }
            return _this;
        }
        InvokeMethodExpr.prototype.isEquivalent = function (e) {
            return e instanceof InvokeMethodExpr && this.receiver.isEquivalent(e.receiver) &&
                this.name === e.name && this.builtin === e.builtin && areAllEquivalent(this.args, e.args);
        };
        InvokeMethodExpr.prototype.isConstant = function () {
            return false;
        };
        InvokeMethodExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitInvokeMethodExpr(this, context);
        };
        return InvokeMethodExpr;
    }(Expression));
    exports.InvokeMethodExpr = InvokeMethodExpr;
    var InvokeFunctionExpr = /** @class */ (function (_super) {
        tslib_1.__extends(InvokeFunctionExpr, _super);
        function InvokeFunctionExpr(fn, args, type, sourceSpan, pure) {
            if (pure === void 0) { pure = false; }
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.fn = fn;
            _this.args = args;
            _this.pure = pure;
            return _this;
        }
        InvokeFunctionExpr.prototype.isEquivalent = function (e) {
            return e instanceof InvokeFunctionExpr && this.fn.isEquivalent(e.fn) &&
                areAllEquivalent(this.args, e.args) && this.pure === e.pure;
        };
        InvokeFunctionExpr.prototype.isConstant = function () {
            return false;
        };
        InvokeFunctionExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitInvokeFunctionExpr(this, context);
        };
        return InvokeFunctionExpr;
    }(Expression));
    exports.InvokeFunctionExpr = InvokeFunctionExpr;
    var InstantiateExpr = /** @class */ (function (_super) {
        tslib_1.__extends(InstantiateExpr, _super);
        function InstantiateExpr(classExpr, args, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.classExpr = classExpr;
            _this.args = args;
            return _this;
        }
        InstantiateExpr.prototype.isEquivalent = function (e) {
            return e instanceof InstantiateExpr && this.classExpr.isEquivalent(e.classExpr) &&
                areAllEquivalent(this.args, e.args);
        };
        InstantiateExpr.prototype.isConstant = function () {
            return false;
        };
        InstantiateExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitInstantiateExpr(this, context);
        };
        return InstantiateExpr;
    }(Expression));
    exports.InstantiateExpr = InstantiateExpr;
    var LiteralExpr = /** @class */ (function (_super) {
        tslib_1.__extends(LiteralExpr, _super);
        function LiteralExpr(value, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.value = value;
            return _this;
        }
        LiteralExpr.prototype.isEquivalent = function (e) {
            return e instanceof LiteralExpr && this.value === e.value;
        };
        LiteralExpr.prototype.isConstant = function () {
            return true;
        };
        LiteralExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitLiteralExpr(this, context);
        };
        return LiteralExpr;
    }(Expression));
    exports.LiteralExpr = LiteralExpr;
    var MessagePiece = /** @class */ (function () {
        function MessagePiece(text, sourceSpan) {
            this.text = text;
            this.sourceSpan = sourceSpan;
        }
        return MessagePiece;
    }());
    exports.MessagePiece = MessagePiece;
    var LiteralPiece = /** @class */ (function (_super) {
        tslib_1.__extends(LiteralPiece, _super);
        function LiteralPiece() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return LiteralPiece;
    }(MessagePiece));
    exports.LiteralPiece = LiteralPiece;
    var PlaceholderPiece = /** @class */ (function (_super) {
        tslib_1.__extends(PlaceholderPiece, _super);
        function PlaceholderPiece() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return PlaceholderPiece;
    }(MessagePiece));
    exports.PlaceholderPiece = PlaceholderPiece;
    var LocalizedString = /** @class */ (function (_super) {
        tslib_1.__extends(LocalizedString, _super);
        function LocalizedString(metaBlock, messageParts, placeHolderNames, expressions, sourceSpan) {
            var _this = _super.call(this, exports.STRING_TYPE, sourceSpan) || this;
            _this.metaBlock = metaBlock;
            _this.messageParts = messageParts;
            _this.placeHolderNames = placeHolderNames;
            _this.expressions = expressions;
            return _this;
        }
        LocalizedString.prototype.isEquivalent = function (e) {
            // return e instanceof LocalizedString && this.message === e.message;
            return false;
        };
        LocalizedString.prototype.isConstant = function () {
            return false;
        };
        LocalizedString.prototype.visitExpression = function (visitor, context) {
            return visitor.visitLocalizedString(this, context);
        };
        /**
         * Serialize the given `meta` and `messagePart` into "cooked" and "raw" strings that can be used
         * in a `$localize` tagged string. The format of the metadata is the same as that parsed by
         * `parseI18nMeta()`.
         *
         * @param meta The metadata to serialize
         * @param messagePart The first part of the tagged string
         */
        LocalizedString.prototype.serializeI18nHead = function () {
            var MEANING_SEPARATOR = '|';
            var ID_SEPARATOR = '@@';
            var LEGACY_ID_INDICATOR = '␟';
            var metaBlock = this.metaBlock.description || '';
            if (this.metaBlock.meaning) {
                metaBlock = "" + this.metaBlock.meaning + MEANING_SEPARATOR + metaBlock;
            }
            if (this.metaBlock.customId) {
                metaBlock = "" + metaBlock + ID_SEPARATOR + this.metaBlock.customId;
            }
            if (this.metaBlock.legacyIds) {
                this.metaBlock.legacyIds.forEach(function (legacyId) {
                    metaBlock = "" + metaBlock + LEGACY_ID_INDICATOR + legacyId;
                });
            }
            return createCookedRawString(metaBlock, this.messageParts[0].text);
        };
        LocalizedString.prototype.getMessagePartSourceSpan = function (i) {
            var _a, _b;
            return (_b = (_a = this.messageParts[i]) === null || _a === void 0 ? void 0 : _a.sourceSpan) !== null && _b !== void 0 ? _b : this.sourceSpan;
        };
        LocalizedString.prototype.getPlaceholderSourceSpan = function (i) {
            var _a, _b, _c, _d;
            return (_d = (_b = (_a = this.placeHolderNames[i]) === null || _a === void 0 ? void 0 : _a.sourceSpan) !== null && _b !== void 0 ? _b : (_c = this.expressions[i]) === null || _c === void 0 ? void 0 : _c.sourceSpan) !== null && _d !== void 0 ? _d : this.sourceSpan;
        };
        /**
         * Serialize the given `placeholderName` and `messagePart` into "cooked" and "raw" strings that
         * can be used in a `$localize` tagged string.
         *
         * @param placeholderName The placeholder name to serialize
         * @param messagePart The following message string after this placeholder
         */
        LocalizedString.prototype.serializeI18nTemplatePart = function (partIndex) {
            var placeholderName = this.placeHolderNames[partIndex - 1].text;
            var messagePart = this.messageParts[partIndex];
            return createCookedRawString(placeholderName, messagePart.text);
        };
        return LocalizedString;
    }(Expression));
    exports.LocalizedString = LocalizedString;
    var escapeSlashes = function (str) { return str.replace(/\\/g, '\\\\'); };
    var escapeStartingColon = function (str) { return str.replace(/^:/, '\\:'); };
    var escapeColons = function (str) { return str.replace(/:/g, '\\:'); };
    var escapeForMessagePart = function (str) {
        return str.replace(/`/g, '\\`').replace(/\${/g, '$\\{');
    };
    /**
     * Creates a `{cooked, raw}` object from the `metaBlock` and `messagePart`.
     *
     * The `raw` text must have various character sequences escaped:
     * * "\" would otherwise indicate that the next character is a control character.
     * * "`" and "${" are template string control sequences that would otherwise prematurely indicate
     *   the end of a message part.
     * * ":" inside a metablock would prematurely indicate the end of the metablock.
     * * ":" at the start of a messagePart with no metablock would erroneously indicate the start of a
     *   metablock.
     *
     * @param metaBlock Any metadata that should be prepended to the string
     * @param messagePart The message part of the string
     */
    function createCookedRawString(metaBlock, messagePart) {
        if (metaBlock === '') {
            return {
                cooked: messagePart,
                raw: escapeForMessagePart(escapeStartingColon(escapeSlashes(messagePart)))
            };
        }
        else {
            return {
                cooked: ":" + metaBlock + ":" + messagePart,
                raw: escapeForMessagePart(":" + escapeColons(escapeSlashes(metaBlock)) + ":" + escapeSlashes(messagePart))
            };
        }
    }
    var ExternalExpr = /** @class */ (function (_super) {
        tslib_1.__extends(ExternalExpr, _super);
        function ExternalExpr(value, type, typeParams, sourceSpan) {
            if (typeParams === void 0) { typeParams = null; }
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.value = value;
            _this.typeParams = typeParams;
            return _this;
        }
        ExternalExpr.prototype.isEquivalent = function (e) {
            return e instanceof ExternalExpr && this.value.name === e.value.name &&
                this.value.moduleName === e.value.moduleName && this.value.runtime === e.value.runtime;
        };
        ExternalExpr.prototype.isConstant = function () {
            return false;
        };
        ExternalExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitExternalExpr(this, context);
        };
        return ExternalExpr;
    }(Expression));
    exports.ExternalExpr = ExternalExpr;
    var ExternalReference = /** @class */ (function () {
        function ExternalReference(moduleName, name, runtime) {
            this.moduleName = moduleName;
            this.name = name;
            this.runtime = runtime;
        }
        return ExternalReference;
    }());
    exports.ExternalReference = ExternalReference;
    var ConditionalExpr = /** @class */ (function (_super) {
        tslib_1.__extends(ConditionalExpr, _super);
        function ConditionalExpr(condition, trueCase, falseCase, type, sourceSpan) {
            if (falseCase === void 0) { falseCase = null; }
            var _this = _super.call(this, type || trueCase.type, sourceSpan) || this;
            _this.condition = condition;
            _this.falseCase = falseCase;
            _this.trueCase = trueCase;
            return _this;
        }
        ConditionalExpr.prototype.isEquivalent = function (e) {
            return e instanceof ConditionalExpr && this.condition.isEquivalent(e.condition) &&
                this.trueCase.isEquivalent(e.trueCase) && nullSafeIsEquivalent(this.falseCase, e.falseCase);
        };
        ConditionalExpr.prototype.isConstant = function () {
            return false;
        };
        ConditionalExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitConditionalExpr(this, context);
        };
        return ConditionalExpr;
    }(Expression));
    exports.ConditionalExpr = ConditionalExpr;
    var NotExpr = /** @class */ (function (_super) {
        tslib_1.__extends(NotExpr, _super);
        function NotExpr(condition, sourceSpan) {
            var _this = _super.call(this, exports.BOOL_TYPE, sourceSpan) || this;
            _this.condition = condition;
            return _this;
        }
        NotExpr.prototype.isEquivalent = function (e) {
            return e instanceof NotExpr && this.condition.isEquivalent(e.condition);
        };
        NotExpr.prototype.isConstant = function () {
            return false;
        };
        NotExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitNotExpr(this, context);
        };
        return NotExpr;
    }(Expression));
    exports.NotExpr = NotExpr;
    var AssertNotNull = /** @class */ (function (_super) {
        tslib_1.__extends(AssertNotNull, _super);
        function AssertNotNull(condition, sourceSpan) {
            var _this = _super.call(this, condition.type, sourceSpan) || this;
            _this.condition = condition;
            return _this;
        }
        AssertNotNull.prototype.isEquivalent = function (e) {
            return e instanceof AssertNotNull && this.condition.isEquivalent(e.condition);
        };
        AssertNotNull.prototype.isConstant = function () {
            return false;
        };
        AssertNotNull.prototype.visitExpression = function (visitor, context) {
            return visitor.visitAssertNotNullExpr(this, context);
        };
        return AssertNotNull;
    }(Expression));
    exports.AssertNotNull = AssertNotNull;
    var CastExpr = /** @class */ (function (_super) {
        tslib_1.__extends(CastExpr, _super);
        function CastExpr(value, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.value = value;
            return _this;
        }
        CastExpr.prototype.isEquivalent = function (e) {
            return e instanceof CastExpr && this.value.isEquivalent(e.value);
        };
        CastExpr.prototype.isConstant = function () {
            return false;
        };
        CastExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitCastExpr(this, context);
        };
        return CastExpr;
    }(Expression));
    exports.CastExpr = CastExpr;
    var FnParam = /** @class */ (function () {
        function FnParam(name, type) {
            if (type === void 0) { type = null; }
            this.name = name;
            this.type = type;
        }
        FnParam.prototype.isEquivalent = function (param) {
            return this.name === param.name;
        };
        return FnParam;
    }());
    exports.FnParam = FnParam;
    var FunctionExpr = /** @class */ (function (_super) {
        tslib_1.__extends(FunctionExpr, _super);
        function FunctionExpr(params, statements, type, sourceSpan, name) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.params = params;
            _this.statements = statements;
            _this.name = name;
            return _this;
        }
        FunctionExpr.prototype.isEquivalent = function (e) {
            return e instanceof FunctionExpr && areAllEquivalent(this.params, e.params) &&
                areAllEquivalent(this.statements, e.statements);
        };
        FunctionExpr.prototype.isConstant = function () {
            return false;
        };
        FunctionExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitFunctionExpr(this, context);
        };
        FunctionExpr.prototype.toDeclStmt = function (name, modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers, this.sourceSpan);
        };
        return FunctionExpr;
    }(Expression));
    exports.FunctionExpr = FunctionExpr;
    var UnaryOperatorExpr = /** @class */ (function (_super) {
        tslib_1.__extends(UnaryOperatorExpr, _super);
        function UnaryOperatorExpr(operator, expr, type, sourceSpan, parens) {
            if (parens === void 0) { parens = true; }
            var _this = _super.call(this, type || exports.NUMBER_TYPE, sourceSpan) || this;
            _this.operator = operator;
            _this.expr = expr;
            _this.parens = parens;
            return _this;
        }
        UnaryOperatorExpr.prototype.isEquivalent = function (e) {
            return e instanceof UnaryOperatorExpr && this.operator === e.operator &&
                this.expr.isEquivalent(e.expr);
        };
        UnaryOperatorExpr.prototype.isConstant = function () {
            return false;
        };
        UnaryOperatorExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitUnaryOperatorExpr(this, context);
        };
        return UnaryOperatorExpr;
    }(Expression));
    exports.UnaryOperatorExpr = UnaryOperatorExpr;
    var BinaryOperatorExpr = /** @class */ (function (_super) {
        tslib_1.__extends(BinaryOperatorExpr, _super);
        function BinaryOperatorExpr(operator, lhs, rhs, type, sourceSpan, parens) {
            if (parens === void 0) { parens = true; }
            var _this = _super.call(this, type || lhs.type, sourceSpan) || this;
            _this.operator = operator;
            _this.rhs = rhs;
            _this.parens = parens;
            _this.lhs = lhs;
            return _this;
        }
        BinaryOperatorExpr.prototype.isEquivalent = function (e) {
            return e instanceof BinaryOperatorExpr && this.operator === e.operator &&
                this.lhs.isEquivalent(e.lhs) && this.rhs.isEquivalent(e.rhs);
        };
        BinaryOperatorExpr.prototype.isConstant = function () {
            return false;
        };
        BinaryOperatorExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitBinaryOperatorExpr(this, context);
        };
        return BinaryOperatorExpr;
    }(Expression));
    exports.BinaryOperatorExpr = BinaryOperatorExpr;
    var ReadPropExpr = /** @class */ (function (_super) {
        tslib_1.__extends(ReadPropExpr, _super);
        function ReadPropExpr(receiver, name, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.receiver = receiver;
            _this.name = name;
            return _this;
        }
        ReadPropExpr.prototype.isEquivalent = function (e) {
            return e instanceof ReadPropExpr && this.receiver.isEquivalent(e.receiver) &&
                this.name === e.name;
        };
        ReadPropExpr.prototype.isConstant = function () {
            return false;
        };
        ReadPropExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitReadPropExpr(this, context);
        };
        ReadPropExpr.prototype.set = function (value) {
            return new WritePropExpr(this.receiver, this.name, value, null, this.sourceSpan);
        };
        return ReadPropExpr;
    }(Expression));
    exports.ReadPropExpr = ReadPropExpr;
    var ReadKeyExpr = /** @class */ (function (_super) {
        tslib_1.__extends(ReadKeyExpr, _super);
        function ReadKeyExpr(receiver, index, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.receiver = receiver;
            _this.index = index;
            return _this;
        }
        ReadKeyExpr.prototype.isEquivalent = function (e) {
            return e instanceof ReadKeyExpr && this.receiver.isEquivalent(e.receiver) &&
                this.index.isEquivalent(e.index);
        };
        ReadKeyExpr.prototype.isConstant = function () {
            return false;
        };
        ReadKeyExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitReadKeyExpr(this, context);
        };
        ReadKeyExpr.prototype.set = function (value) {
            return new WriteKeyExpr(this.receiver, this.index, value, null, this.sourceSpan);
        };
        return ReadKeyExpr;
    }(Expression));
    exports.ReadKeyExpr = ReadKeyExpr;
    var LiteralArrayExpr = /** @class */ (function (_super) {
        tslib_1.__extends(LiteralArrayExpr, _super);
        function LiteralArrayExpr(entries, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.entries = entries;
            return _this;
        }
        LiteralArrayExpr.prototype.isConstant = function () {
            return this.entries.every(function (e) { return e.isConstant(); });
        };
        LiteralArrayExpr.prototype.isEquivalent = function (e) {
            return e instanceof LiteralArrayExpr && areAllEquivalent(this.entries, e.entries);
        };
        LiteralArrayExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitLiteralArrayExpr(this, context);
        };
        return LiteralArrayExpr;
    }(Expression));
    exports.LiteralArrayExpr = LiteralArrayExpr;
    var LiteralMapEntry = /** @class */ (function () {
        function LiteralMapEntry(key, value, quoted) {
            this.key = key;
            this.value = value;
            this.quoted = quoted;
        }
        LiteralMapEntry.prototype.isEquivalent = function (e) {
            return this.key === e.key && this.value.isEquivalent(e.value);
        };
        return LiteralMapEntry;
    }());
    exports.LiteralMapEntry = LiteralMapEntry;
    var LiteralMapExpr = /** @class */ (function (_super) {
        tslib_1.__extends(LiteralMapExpr, _super);
        function LiteralMapExpr(entries, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.entries = entries;
            _this.valueType = null;
            if (type) {
                _this.valueType = type.valueType;
            }
            return _this;
        }
        LiteralMapExpr.prototype.isEquivalent = function (e) {
            return e instanceof LiteralMapExpr && areAllEquivalent(this.entries, e.entries);
        };
        LiteralMapExpr.prototype.isConstant = function () {
            return this.entries.every(function (e) { return e.value.isConstant(); });
        };
        LiteralMapExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitLiteralMapExpr(this, context);
        };
        return LiteralMapExpr;
    }(Expression));
    exports.LiteralMapExpr = LiteralMapExpr;
    var CommaExpr = /** @class */ (function (_super) {
        tslib_1.__extends(CommaExpr, _super);
        function CommaExpr(parts, sourceSpan) {
            var _this = _super.call(this, parts[parts.length - 1].type, sourceSpan) || this;
            _this.parts = parts;
            return _this;
        }
        CommaExpr.prototype.isEquivalent = function (e) {
            return e instanceof CommaExpr && areAllEquivalent(this.parts, e.parts);
        };
        CommaExpr.prototype.isConstant = function () {
            return false;
        };
        CommaExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitCommaExpr(this, context);
        };
        return CommaExpr;
    }(Expression));
    exports.CommaExpr = CommaExpr;
    exports.THIS_EXPR = new ReadVarExpr(BuiltinVar.This, null, null);
    exports.SUPER_EXPR = new ReadVarExpr(BuiltinVar.Super, null, null);
    exports.CATCH_ERROR_VAR = new ReadVarExpr(BuiltinVar.CatchError, null, null);
    exports.CATCH_STACK_VAR = new ReadVarExpr(BuiltinVar.CatchStack, null, null);
    exports.NULL_EXPR = new LiteralExpr(null, null, null);
    exports.TYPED_NULL_EXPR = new LiteralExpr(null, exports.INFERRED_TYPE, null);
    //// Statements
    var StmtModifier;
    (function (StmtModifier) {
        StmtModifier[StmtModifier["Final"] = 0] = "Final";
        StmtModifier[StmtModifier["Private"] = 1] = "Private";
        StmtModifier[StmtModifier["Exported"] = 2] = "Exported";
        StmtModifier[StmtModifier["Static"] = 3] = "Static";
    })(StmtModifier = exports.StmtModifier || (exports.StmtModifier = {}));
    var Statement = /** @class */ (function () {
        function Statement(modifiers, sourceSpan) {
            this.modifiers = modifiers || [];
            this.sourceSpan = sourceSpan || null;
        }
        Statement.prototype.hasModifier = function (modifier) {
            return this.modifiers.indexOf(modifier) !== -1;
        };
        return Statement;
    }());
    exports.Statement = Statement;
    var DeclareVarStmt = /** @class */ (function (_super) {
        tslib_1.__extends(DeclareVarStmt, _super);
        function DeclareVarStmt(name, value, type, modifiers, sourceSpan) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, modifiers, sourceSpan) || this;
            _this.name = name;
            _this.value = value;
            _this.type = type || (value && value.type) || null;
            return _this;
        }
        DeclareVarStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof DeclareVarStmt && this.name === stmt.name &&
                (this.value ? !!stmt.value && this.value.isEquivalent(stmt.value) : !stmt.value);
        };
        DeclareVarStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitDeclareVarStmt(this, context);
        };
        return DeclareVarStmt;
    }(Statement));
    exports.DeclareVarStmt = DeclareVarStmt;
    var DeclareFunctionStmt = /** @class */ (function (_super) {
        tslib_1.__extends(DeclareFunctionStmt, _super);
        function DeclareFunctionStmt(name, params, statements, type, modifiers, sourceSpan) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, modifiers, sourceSpan) || this;
            _this.name = name;
            _this.params = params;
            _this.statements = statements;
            _this.type = type || null;
            return _this;
        }
        DeclareFunctionStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof DeclareFunctionStmt && areAllEquivalent(this.params, stmt.params) &&
                areAllEquivalent(this.statements, stmt.statements);
        };
        DeclareFunctionStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitDeclareFunctionStmt(this, context);
        };
        return DeclareFunctionStmt;
    }(Statement));
    exports.DeclareFunctionStmt = DeclareFunctionStmt;
    var ExpressionStatement = /** @class */ (function (_super) {
        tslib_1.__extends(ExpressionStatement, _super);
        function ExpressionStatement(expr, sourceSpan) {
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.expr = expr;
            return _this;
        }
        ExpressionStatement.prototype.isEquivalent = function (stmt) {
            return stmt instanceof ExpressionStatement && this.expr.isEquivalent(stmt.expr);
        };
        ExpressionStatement.prototype.visitStatement = function (visitor, context) {
            return visitor.visitExpressionStmt(this, context);
        };
        return ExpressionStatement;
    }(Statement));
    exports.ExpressionStatement = ExpressionStatement;
    var ReturnStatement = /** @class */ (function (_super) {
        tslib_1.__extends(ReturnStatement, _super);
        function ReturnStatement(value, sourceSpan) {
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.value = value;
            return _this;
        }
        ReturnStatement.prototype.isEquivalent = function (stmt) {
            return stmt instanceof ReturnStatement && this.value.isEquivalent(stmt.value);
        };
        ReturnStatement.prototype.visitStatement = function (visitor, context) {
            return visitor.visitReturnStmt(this, context);
        };
        return ReturnStatement;
    }(Statement));
    exports.ReturnStatement = ReturnStatement;
    var AbstractClassPart = /** @class */ (function () {
        function AbstractClassPart(type, modifiers) {
            this.modifiers = modifiers;
            if (!modifiers) {
                this.modifiers = [];
            }
            this.type = type || null;
        }
        AbstractClassPart.prototype.hasModifier = function (modifier) {
            return this.modifiers.indexOf(modifier) !== -1;
        };
        return AbstractClassPart;
    }());
    exports.AbstractClassPart = AbstractClassPart;
    var ClassField = /** @class */ (function (_super) {
        tslib_1.__extends(ClassField, _super);
        function ClassField(name, type, modifiers, initializer) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, type, modifiers) || this;
            _this.name = name;
            _this.initializer = initializer;
            return _this;
        }
        ClassField.prototype.isEquivalent = function (f) {
            return this.name === f.name;
        };
        return ClassField;
    }(AbstractClassPart));
    exports.ClassField = ClassField;
    var ClassMethod = /** @class */ (function (_super) {
        tslib_1.__extends(ClassMethod, _super);
        function ClassMethod(name, params, body, type, modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, type, modifiers) || this;
            _this.name = name;
            _this.params = params;
            _this.body = body;
            return _this;
        }
        ClassMethod.prototype.isEquivalent = function (m) {
            return this.name === m.name && areAllEquivalent(this.body, m.body);
        };
        return ClassMethod;
    }(AbstractClassPart));
    exports.ClassMethod = ClassMethod;
    var ClassGetter = /** @class */ (function (_super) {
        tslib_1.__extends(ClassGetter, _super);
        function ClassGetter(name, body, type, modifiers) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, type, modifiers) || this;
            _this.name = name;
            _this.body = body;
            return _this;
        }
        ClassGetter.prototype.isEquivalent = function (m) {
            return this.name === m.name && areAllEquivalent(this.body, m.body);
        };
        return ClassGetter;
    }(AbstractClassPart));
    exports.ClassGetter = ClassGetter;
    var ClassStmt = /** @class */ (function (_super) {
        tslib_1.__extends(ClassStmt, _super);
        function ClassStmt(name, parent, fields, getters, constructorMethod, methods, modifiers, sourceSpan) {
            if (modifiers === void 0) { modifiers = null; }
            var _this = _super.call(this, modifiers, sourceSpan) || this;
            _this.name = name;
            _this.parent = parent;
            _this.fields = fields;
            _this.getters = getters;
            _this.constructorMethod = constructorMethod;
            _this.methods = methods;
            return _this;
        }
        ClassStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof ClassStmt && this.name === stmt.name &&
                nullSafeIsEquivalent(this.parent, stmt.parent) &&
                areAllEquivalent(this.fields, stmt.fields) &&
                areAllEquivalent(this.getters, stmt.getters) &&
                this.constructorMethod.isEquivalent(stmt.constructorMethod) &&
                areAllEquivalent(this.methods, stmt.methods);
        };
        ClassStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitDeclareClassStmt(this, context);
        };
        return ClassStmt;
    }(Statement));
    exports.ClassStmt = ClassStmt;
    var IfStmt = /** @class */ (function (_super) {
        tslib_1.__extends(IfStmt, _super);
        function IfStmt(condition, trueCase, falseCase, sourceSpan) {
            if (falseCase === void 0) { falseCase = []; }
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.condition = condition;
            _this.trueCase = trueCase;
            _this.falseCase = falseCase;
            return _this;
        }
        IfStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof IfStmt && this.condition.isEquivalent(stmt.condition) &&
                areAllEquivalent(this.trueCase, stmt.trueCase) &&
                areAllEquivalent(this.falseCase, stmt.falseCase);
        };
        IfStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitIfStmt(this, context);
        };
        return IfStmt;
    }(Statement));
    exports.IfStmt = IfStmt;
    var CommentStmt = /** @class */ (function (_super) {
        tslib_1.__extends(CommentStmt, _super);
        function CommentStmt(comment, multiline, sourceSpan) {
            if (multiline === void 0) { multiline = false; }
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.comment = comment;
            _this.multiline = multiline;
            return _this;
        }
        CommentStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof CommentStmt;
        };
        CommentStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitCommentStmt(this, context);
        };
        return CommentStmt;
    }(Statement));
    exports.CommentStmt = CommentStmt;
    var JSDocCommentStmt = /** @class */ (function (_super) {
        tslib_1.__extends(JSDocCommentStmt, _super);
        function JSDocCommentStmt(tags, sourceSpan) {
            if (tags === void 0) { tags = []; }
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.tags = tags;
            return _this;
        }
        JSDocCommentStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof JSDocCommentStmt && this.toString() === stmt.toString();
        };
        JSDocCommentStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitJSDocCommentStmt(this, context);
        };
        JSDocCommentStmt.prototype.toString = function () {
            return serializeTags(this.tags);
        };
        return JSDocCommentStmt;
    }(Statement));
    exports.JSDocCommentStmt = JSDocCommentStmt;
    var TryCatchStmt = /** @class */ (function (_super) {
        tslib_1.__extends(TryCatchStmt, _super);
        function TryCatchStmt(bodyStmts, catchStmts, sourceSpan) {
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.bodyStmts = bodyStmts;
            _this.catchStmts = catchStmts;
            return _this;
        }
        TryCatchStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof TryCatchStmt && areAllEquivalent(this.bodyStmts, stmt.bodyStmts) &&
                areAllEquivalent(this.catchStmts, stmt.catchStmts);
        };
        TryCatchStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitTryCatchStmt(this, context);
        };
        return TryCatchStmt;
    }(Statement));
    exports.TryCatchStmt = TryCatchStmt;
    var ThrowStmt = /** @class */ (function (_super) {
        tslib_1.__extends(ThrowStmt, _super);
        function ThrowStmt(error, sourceSpan) {
            var _this = _super.call(this, null, sourceSpan) || this;
            _this.error = error;
            return _this;
        }
        ThrowStmt.prototype.isEquivalent = function (stmt) {
            return stmt instanceof TryCatchStmt && this.error.isEquivalent(stmt.error);
        };
        ThrowStmt.prototype.visitStatement = function (visitor, context) {
            return visitor.visitThrowStmt(this, context);
        };
        return ThrowStmt;
    }(Statement));
    exports.ThrowStmt = ThrowStmt;
    var AstTransformer = /** @class */ (function () {
        function AstTransformer() {
        }
        AstTransformer.prototype.transformExpr = function (expr, context) {
            return expr;
        };
        AstTransformer.prototype.transformStmt = function (stmt, context) {
            return stmt;
        };
        AstTransformer.prototype.visitReadVarExpr = function (ast, context) {
            return this.transformExpr(ast, context);
        };
        AstTransformer.prototype.visitWrappedNodeExpr = function (ast, context) {
            return this.transformExpr(ast, context);
        };
        AstTransformer.prototype.visitTypeofExpr = function (expr, context) {
            return this.transformExpr(new TypeofExpr(expr.expr.visitExpression(this, context), expr.type, expr.sourceSpan), context);
        };
        AstTransformer.prototype.visitWriteVarExpr = function (expr, context) {
            return this.transformExpr(new WriteVarExpr(expr.name, expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
        };
        AstTransformer.prototype.visitWriteKeyExpr = function (expr, context) {
            return this.transformExpr(new WriteKeyExpr(expr.receiver.visitExpression(this, context), expr.index.visitExpression(this, context), expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
        };
        AstTransformer.prototype.visitWritePropExpr = function (expr, context) {
            return this.transformExpr(new WritePropExpr(expr.receiver.visitExpression(this, context), expr.name, expr.value.visitExpression(this, context), expr.type, expr.sourceSpan), context);
        };
        AstTransformer.prototype.visitInvokeMethodExpr = function (ast, context) {
            var method = ast.builtin || ast.name;
            return this.transformExpr(new InvokeMethodExpr(ast.receiver.visitExpression(this, context), method, this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitInvokeFunctionExpr = function (ast, context) {
            return this.transformExpr(new InvokeFunctionExpr(ast.fn.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitInstantiateExpr = function (ast, context) {
            return this.transformExpr(new InstantiateExpr(ast.classExpr.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitLiteralExpr = function (ast, context) {
            return this.transformExpr(ast, context);
        };
        AstTransformer.prototype.visitLocalizedString = function (ast, context) {
            return this.transformExpr(new LocalizedString(ast.metaBlock, ast.messageParts, ast.placeHolderNames, this.visitAllExpressions(ast.expressions, context), ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitExternalExpr = function (ast, context) {
            return this.transformExpr(ast, context);
        };
        AstTransformer.prototype.visitConditionalExpr = function (ast, context) {
            return this.transformExpr(new ConditionalExpr(ast.condition.visitExpression(this, context), ast.trueCase.visitExpression(this, context), ast.falseCase.visitExpression(this, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitNotExpr = function (ast, context) {
            return this.transformExpr(new NotExpr(ast.condition.visitExpression(this, context), ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitAssertNotNullExpr = function (ast, context) {
            return this.transformExpr(new AssertNotNull(ast.condition.visitExpression(this, context), ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitCastExpr = function (ast, context) {
            return this.transformExpr(new CastExpr(ast.value.visitExpression(this, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitFunctionExpr = function (ast, context) {
            return this.transformExpr(new FunctionExpr(ast.params, this.visitAllStatements(ast.statements, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitUnaryOperatorExpr = function (ast, context) {
            return this.transformExpr(new UnaryOperatorExpr(ast.operator, ast.expr.visitExpression(this, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitBinaryOperatorExpr = function (ast, context) {
            return this.transformExpr(new BinaryOperatorExpr(ast.operator, ast.lhs.visitExpression(this, context), ast.rhs.visitExpression(this, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitReadPropExpr = function (ast, context) {
            return this.transformExpr(new ReadPropExpr(ast.receiver.visitExpression(this, context), ast.name, ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitReadKeyExpr = function (ast, context) {
            return this.transformExpr(new ReadKeyExpr(ast.receiver.visitExpression(this, context), ast.index.visitExpression(this, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitLiteralArrayExpr = function (ast, context) {
            return this.transformExpr(new LiteralArrayExpr(this.visitAllExpressions(ast.entries, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitLiteralMapExpr = function (ast, context) {
            var _this = this;
            var entries = ast.entries.map(function (entry) { return new LiteralMapEntry(entry.key, entry.value.visitExpression(_this, context), entry.quoted); });
            var mapType = new MapType(ast.valueType, null);
            return this.transformExpr(new LiteralMapExpr(entries, mapType, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitCommaExpr = function (ast, context) {
            return this.transformExpr(new CommaExpr(this.visitAllExpressions(ast.parts, context), ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitAllExpressions = function (exprs, context) {
            var _this = this;
            return exprs.map(function (expr) { return expr.visitExpression(_this, context); });
        };
        AstTransformer.prototype.visitDeclareVarStmt = function (stmt, context) {
            var value = stmt.value && stmt.value.visitExpression(this, context);
            return this.transformStmt(new DeclareVarStmt(stmt.name, value, stmt.type, stmt.modifiers, stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitDeclareFunctionStmt = function (stmt, context) {
            return this.transformStmt(new DeclareFunctionStmt(stmt.name, stmt.params, this.visitAllStatements(stmt.statements, context), stmt.type, stmt.modifiers, stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitExpressionStmt = function (stmt, context) {
            return this.transformStmt(new ExpressionStatement(stmt.expr.visitExpression(this, context), stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitReturnStmt = function (stmt, context) {
            return this.transformStmt(new ReturnStatement(stmt.value.visitExpression(this, context), stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitDeclareClassStmt = function (stmt, context) {
            var _this = this;
            var parent = stmt.parent.visitExpression(this, context);
            var getters = stmt.getters.map(function (getter) { return new ClassGetter(getter.name, _this.visitAllStatements(getter.body, context), getter.type, getter.modifiers); });
            var ctorMethod = stmt.constructorMethod &&
                new ClassMethod(stmt.constructorMethod.name, stmt.constructorMethod.params, this.visitAllStatements(stmt.constructorMethod.body, context), stmt.constructorMethod.type, stmt.constructorMethod.modifiers);
            var methods = stmt.methods.map(function (method) { return new ClassMethod(method.name, method.params, _this.visitAllStatements(method.body, context), method.type, method.modifiers); });
            return this.transformStmt(new ClassStmt(stmt.name, parent, stmt.fields, getters, ctorMethod, methods, stmt.modifiers, stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitIfStmt = function (stmt, context) {
            return this.transformStmt(new IfStmt(stmt.condition.visitExpression(this, context), this.visitAllStatements(stmt.trueCase, context), this.visitAllStatements(stmt.falseCase, context), stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitTryCatchStmt = function (stmt, context) {
            return this.transformStmt(new TryCatchStmt(this.visitAllStatements(stmt.bodyStmts, context), this.visitAllStatements(stmt.catchStmts, context), stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitThrowStmt = function (stmt, context) {
            return this.transformStmt(new ThrowStmt(stmt.error.visitExpression(this, context), stmt.sourceSpan), context);
        };
        AstTransformer.prototype.visitCommentStmt = function (stmt, context) {
            return this.transformStmt(stmt, context);
        };
        AstTransformer.prototype.visitJSDocCommentStmt = function (stmt, context) {
            return this.transformStmt(stmt, context);
        };
        AstTransformer.prototype.visitAllStatements = function (stmts, context) {
            var _this = this;
            return stmts.map(function (stmt) { return stmt.visitStatement(_this, context); });
        };
        return AstTransformer;
    }());
    exports.AstTransformer = AstTransformer;
    var RecursiveAstVisitor = /** @class */ (function () {
        function RecursiveAstVisitor() {
        }
        RecursiveAstVisitor.prototype.visitType = function (ast, context) {
            return ast;
        };
        RecursiveAstVisitor.prototype.visitExpression = function (ast, context) {
            if (ast.type) {
                ast.type.visitType(this, context);
            }
            return ast;
        };
        RecursiveAstVisitor.prototype.visitBuiltinType = function (type, context) {
            return this.visitType(type, context);
        };
        RecursiveAstVisitor.prototype.visitExpressionType = function (type, context) {
            var _this = this;
            type.value.visitExpression(this, context);
            if (type.typeParams !== null) {
                type.typeParams.forEach(function (param) { return _this.visitType(param, context); });
            }
            return this.visitType(type, context);
        };
        RecursiveAstVisitor.prototype.visitArrayType = function (type, context) {
            return this.visitType(type, context);
        };
        RecursiveAstVisitor.prototype.visitMapType = function (type, context) {
            return this.visitType(type, context);
        };
        RecursiveAstVisitor.prototype.visitWrappedNodeExpr = function (ast, context) {
            return ast;
        };
        RecursiveAstVisitor.prototype.visitTypeofExpr = function (ast, context) {
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitReadVarExpr = function (ast, context) {
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitWriteVarExpr = function (ast, context) {
            ast.value.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitWriteKeyExpr = function (ast, context) {
            ast.receiver.visitExpression(this, context);
            ast.index.visitExpression(this, context);
            ast.value.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitWritePropExpr = function (ast, context) {
            ast.receiver.visitExpression(this, context);
            ast.value.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitInvokeMethodExpr = function (ast, context) {
            ast.receiver.visitExpression(this, context);
            this.visitAllExpressions(ast.args, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitInvokeFunctionExpr = function (ast, context) {
            ast.fn.visitExpression(this, context);
            this.visitAllExpressions(ast.args, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitInstantiateExpr = function (ast, context) {
            ast.classExpr.visitExpression(this, context);
            this.visitAllExpressions(ast.args, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitLiteralExpr = function (ast, context) {
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitLocalizedString = function (ast, context) {
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitExternalExpr = function (ast, context) {
            var _this = this;
            if (ast.typeParams) {
                ast.typeParams.forEach(function (type) { return type.visitType(_this, context); });
            }
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitConditionalExpr = function (ast, context) {
            ast.condition.visitExpression(this, context);
            ast.trueCase.visitExpression(this, context);
            ast.falseCase.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitNotExpr = function (ast, context) {
            ast.condition.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitAssertNotNullExpr = function (ast, context) {
            ast.condition.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitCastExpr = function (ast, context) {
            ast.value.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitFunctionExpr = function (ast, context) {
            this.visitAllStatements(ast.statements, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitUnaryOperatorExpr = function (ast, context) {
            ast.expr.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitBinaryOperatorExpr = function (ast, context) {
            ast.lhs.visitExpression(this, context);
            ast.rhs.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitReadPropExpr = function (ast, context) {
            ast.receiver.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitReadKeyExpr = function (ast, context) {
            ast.receiver.visitExpression(this, context);
            ast.index.visitExpression(this, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitLiteralArrayExpr = function (ast, context) {
            this.visitAllExpressions(ast.entries, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitLiteralMapExpr = function (ast, context) {
            var _this = this;
            ast.entries.forEach(function (entry) { return entry.value.visitExpression(_this, context); });
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitCommaExpr = function (ast, context) {
            this.visitAllExpressions(ast.parts, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitAllExpressions = function (exprs, context) {
            var _this = this;
            exprs.forEach(function (expr) { return expr.visitExpression(_this, context); });
        };
        RecursiveAstVisitor.prototype.visitDeclareVarStmt = function (stmt, context) {
            if (stmt.value) {
                stmt.value.visitExpression(this, context);
            }
            if (stmt.type) {
                stmt.type.visitType(this, context);
            }
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitDeclareFunctionStmt = function (stmt, context) {
            this.visitAllStatements(stmt.statements, context);
            if (stmt.type) {
                stmt.type.visitType(this, context);
            }
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitExpressionStmt = function (stmt, context) {
            stmt.expr.visitExpression(this, context);
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitReturnStmt = function (stmt, context) {
            stmt.value.visitExpression(this, context);
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitDeclareClassStmt = function (stmt, context) {
            var _this = this;
            stmt.parent.visitExpression(this, context);
            stmt.getters.forEach(function (getter) { return _this.visitAllStatements(getter.body, context); });
            if (stmt.constructorMethod) {
                this.visitAllStatements(stmt.constructorMethod.body, context);
            }
            stmt.methods.forEach(function (method) { return _this.visitAllStatements(method.body, context); });
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitIfStmt = function (stmt, context) {
            stmt.condition.visitExpression(this, context);
            this.visitAllStatements(stmt.trueCase, context);
            this.visitAllStatements(stmt.falseCase, context);
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitTryCatchStmt = function (stmt, context) {
            this.visitAllStatements(stmt.bodyStmts, context);
            this.visitAllStatements(stmt.catchStmts, context);
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitThrowStmt = function (stmt, context) {
            stmt.error.visitExpression(this, context);
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitCommentStmt = function (stmt, context) {
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitJSDocCommentStmt = function (stmt, context) {
            return stmt;
        };
        RecursiveAstVisitor.prototype.visitAllStatements = function (stmts, context) {
            var _this = this;
            stmts.forEach(function (stmt) { return stmt.visitStatement(_this, context); });
        };
        return RecursiveAstVisitor;
    }());
    exports.RecursiveAstVisitor = RecursiveAstVisitor;
    function findReadVarNames(stmts) {
        var visitor = new _ReadVarVisitor();
        visitor.visitAllStatements(stmts, null);
        return visitor.varNames;
    }
    exports.findReadVarNames = findReadVarNames;
    var _ReadVarVisitor = /** @class */ (function (_super) {
        tslib_1.__extends(_ReadVarVisitor, _super);
        function _ReadVarVisitor() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.varNames = new Set();
            return _this;
        }
        _ReadVarVisitor.prototype.visitDeclareFunctionStmt = function (stmt, context) {
            // Don't descend into nested functions
            return stmt;
        };
        _ReadVarVisitor.prototype.visitDeclareClassStmt = function (stmt, context) {
            // Don't descend into nested classes
            return stmt;
        };
        _ReadVarVisitor.prototype.visitReadVarExpr = function (ast, context) {
            if (ast.name) {
                this.varNames.add(ast.name);
            }
            return null;
        };
        return _ReadVarVisitor;
    }(RecursiveAstVisitor));
    function collectExternalReferences(stmts) {
        var visitor = new _FindExternalReferencesVisitor();
        visitor.visitAllStatements(stmts, null);
        return visitor.externalReferences;
    }
    exports.collectExternalReferences = collectExternalReferences;
    var _FindExternalReferencesVisitor = /** @class */ (function (_super) {
        tslib_1.__extends(_FindExternalReferencesVisitor, _super);
        function _FindExternalReferencesVisitor() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.externalReferences = [];
            return _this;
        }
        _FindExternalReferencesVisitor.prototype.visitExternalExpr = function (e, context) {
            this.externalReferences.push(e.value);
            return _super.prototype.visitExternalExpr.call(this, e, context);
        };
        return _FindExternalReferencesVisitor;
    }(RecursiveAstVisitor));
    function applySourceSpanToStatementIfNeeded(stmt, sourceSpan) {
        if (!sourceSpan) {
            return stmt;
        }
        var transformer = new _ApplySourceSpanTransformer(sourceSpan);
        return stmt.visitStatement(transformer, null);
    }
    exports.applySourceSpanToStatementIfNeeded = applySourceSpanToStatementIfNeeded;
    function applySourceSpanToExpressionIfNeeded(expr, sourceSpan) {
        if (!sourceSpan) {
            return expr;
        }
        var transformer = new _ApplySourceSpanTransformer(sourceSpan);
        return expr.visitExpression(transformer, null);
    }
    exports.applySourceSpanToExpressionIfNeeded = applySourceSpanToExpressionIfNeeded;
    var _ApplySourceSpanTransformer = /** @class */ (function (_super) {
        tslib_1.__extends(_ApplySourceSpanTransformer, _super);
        function _ApplySourceSpanTransformer(sourceSpan) {
            var _this = _super.call(this) || this;
            _this.sourceSpan = sourceSpan;
            return _this;
        }
        _ApplySourceSpanTransformer.prototype._clone = function (obj) {
            var e_1, _a;
            var clone = Object.create(obj.constructor.prototype);
            try {
                for (var _b = tslib_1.__values(Object.keys(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var prop = _c.value;
                    clone[prop] = obj[prop];
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return clone;
        };
        _ApplySourceSpanTransformer.prototype.transformExpr = function (expr, context) {
            if (!expr.sourceSpan) {
                expr = this._clone(expr);
                expr.sourceSpan = this.sourceSpan;
            }
            return expr;
        };
        _ApplySourceSpanTransformer.prototype.transformStmt = function (stmt, context) {
            if (!stmt.sourceSpan) {
                stmt = this._clone(stmt);
                stmt.sourceSpan = this.sourceSpan;
            }
            return stmt;
        };
        return _ApplySourceSpanTransformer;
    }(AstTransformer));
    function variable(name, type, sourceSpan) {
        return new ReadVarExpr(name, type, sourceSpan);
    }
    exports.variable = variable;
    function importExpr(id, typeParams, sourceSpan) {
        if (typeParams === void 0) { typeParams = null; }
        return new ExternalExpr(id, null, typeParams, sourceSpan);
    }
    exports.importExpr = importExpr;
    function importType(id, typeParams, typeModifiers) {
        if (typeParams === void 0) { typeParams = null; }
        if (typeModifiers === void 0) { typeModifiers = null; }
        return id != null ? expressionType(importExpr(id, typeParams, null), typeModifiers) : null;
    }
    exports.importType = importType;
    function expressionType(expr, typeModifiers, typeParams) {
        if (typeModifiers === void 0) { typeModifiers = null; }
        if (typeParams === void 0) { typeParams = null; }
        return new ExpressionType(expr, typeModifiers, typeParams);
    }
    exports.expressionType = expressionType;
    function typeofExpr(expr) {
        return new TypeofExpr(expr);
    }
    exports.typeofExpr = typeofExpr;
    function literalArr(values, type, sourceSpan) {
        return new LiteralArrayExpr(values, type, sourceSpan);
    }
    exports.literalArr = literalArr;
    function literalMap(values, type) {
        if (type === void 0) { type = null; }
        return new LiteralMapExpr(values.map(function (e) { return new LiteralMapEntry(e.key, e.value, e.quoted); }), type, null);
    }
    exports.literalMap = literalMap;
    function unary(operator, expr, type, sourceSpan) {
        return new UnaryOperatorExpr(operator, expr, type, sourceSpan);
    }
    exports.unary = unary;
    function not(expr, sourceSpan) {
        return new NotExpr(expr, sourceSpan);
    }
    exports.not = not;
    function assertNotNull(expr, sourceSpan) {
        return new AssertNotNull(expr, sourceSpan);
    }
    exports.assertNotNull = assertNotNull;
    function fn(params, body, type, sourceSpan, name) {
        return new FunctionExpr(params, body, type, sourceSpan, name);
    }
    exports.fn = fn;
    function ifStmt(condition, thenClause, elseClause) {
        return new IfStmt(condition, thenClause, elseClause);
    }
    exports.ifStmt = ifStmt;
    function literal(value, type, sourceSpan) {
        return new LiteralExpr(value, type, sourceSpan);
    }
    exports.literal = literal;
    function localizedString(metaBlock, messageParts, placeholderNames, expressions, sourceSpan) {
        return new LocalizedString(metaBlock, messageParts, placeholderNames, expressions, sourceSpan);
    }
    exports.localizedString = localizedString;
    function isNull(exp) {
        return exp instanceof LiteralExpr && exp.value === null;
    }
    exports.isNull = isNull;
    /*
     * Serializes a `Tag` into a string.
     * Returns a string like " @foo {bar} baz" (note the leading whitespace before `@foo`).
     */
    function tagToString(tag) {
        var out = '';
        if (tag.tagName) {
            out += " @" + tag.tagName;
        }
        if (tag.text) {
            if (tag.text.match(/\/\*|\*\//)) {
                throw new Error('JSDoc text cannot contain "/*" and "*/"');
            }
            out += ' ' + tag.text.replace(/@/g, '\\@');
        }
        return out;
    }
    function serializeTags(tags) {
        var e_2, _a;
        if (tags.length === 0)
            return '';
        var out = '*\n';
        try {
            for (var tags_1 = tslib_1.__values(tags), tags_1_1 = tags_1.next(); !tags_1_1.done; tags_1_1 = tags_1.next()) {
                var tag = tags_1_1.value;
                out += ' *';
                // If the tagToString is multi-line, insert " * " prefixes on subsequent lines.
                out += tagToString(tag).replace(/\n/g, '\n * ');
                out += '\n';
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (tags_1_1 && !tags_1_1.done && (_a = tags_1.return)) _a.call(tags_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        out += ' ';
        return out;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBTUgsVUFBVTtJQUNWLElBQVksWUFFWDtJQUZELFdBQVksWUFBWTtRQUN0QixpREFBSyxDQUFBO0lBQ1AsQ0FBQyxFQUZXLFlBQVksR0FBWixvQkFBWSxLQUFaLG9CQUFZLFFBRXZCO0lBRUQ7UUFDRSxjQUFtQixTQUFxQztZQUFyQywwQkFBQSxFQUFBLGdCQUFxQztZQUFyQyxjQUFTLEdBQVQsU0FBUyxDQUE0QjtZQUN0RCxJQUFJLENBQUMsU0FBUyxFQUFFO2dCQUNkLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO2FBQ3JCO1FBQ0gsQ0FBQztRQUdELDBCQUFXLEdBQVgsVUFBWSxRQUFzQjtZQUNoQyxPQUFPLElBQUksQ0FBQyxTQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFDSCxXQUFDO0lBQUQsQ0FBQyxBQVhELElBV0M7SUFYcUIsb0JBQUk7SUFhMUIsSUFBWSxlQVNYO0lBVEQsV0FBWSxlQUFlO1FBQ3pCLDJEQUFPLENBQUE7UUFDUCxxREFBSSxDQUFBO1FBQ0oseURBQU0sQ0FBQTtRQUNOLG1EQUFHLENBQUE7UUFDSCx5REFBTSxDQUFBO1FBQ04sNkRBQVEsQ0FBQTtRQUNSLDZEQUFRLENBQUE7UUFDUixxREFBSSxDQUFBO0lBQ04sQ0FBQyxFQVRXLGVBQWUsR0FBZix1QkFBZSxLQUFmLHVCQUFlLFFBUzFCO0lBRUQ7UUFBaUMsdUNBQUk7UUFDbkMscUJBQW1CLElBQXFCLEVBQUUsU0FBcUM7WUFBckMsMEJBQUEsRUFBQSxnQkFBcUM7WUFBL0UsWUFDRSxrQkFBTSxTQUFTLENBQUMsU0FDakI7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QUksRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsMkJBQU0sR0FBTixVQUFPLEdBQWUsRUFBRSxVQUFpQztZQUN2RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ0QsOEJBQVMsR0FBVCxVQUFVLEdBQWUsRUFBRSxVQUFpQztZQUMxRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBQ0QsOEJBQVMsR0FBVCxVQUFVLEdBQWUsRUFBRSxVQUFpQztZQUMxRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBQ0QsaUNBQVksR0FBWixVQUFhLEdBQWUsRUFBRSxVQUFpQztZQUM3RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMxRixDQUFDO1FBQ0QsMEJBQUssR0FBTCxVQUFNLEdBQWUsRUFBRSxVQUFpQztZQUN0RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNuRixDQUFDO1FBQ0QseUJBQUksR0FBSixVQUFLLEdBQWUsRUFBRSxVQUFpQztZQUNyRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztR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LEVBQUU7WUFDWixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7YUFDNUQ7WUFDRCxHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztTQUM1QztRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELFNBQVMsYUFBYSxDQUFDLElBQWdCOztRQUNyQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBRWpDLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQzs7WUFDaEIsS0FBa0IsSUFBQSxTQUFBLGlCQUFBLElBQUksQ0FBQSwwQkFBQSw0Q0FBRTtnQkFBbkIsSUFBTSxHQUFHLGlCQUFBO2dCQUNaLEdBQUcsSUFBSSxJQUFJLENBQUM7Z0JBQ1osK0VBQStFO2dCQUMvRSxHQUFHLElBQUksV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2hELEdBQUcsSUFBSSxJQUFJLENBQUM7YUFDYjs7Ozs7Ozs7O1FBQ0QsR0FBRyxJQUFJLEdBQUcsQ0FBQztRQUNYLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7STE4bk1ldGF9IGZyb20gJy4uL3JlbmRlcjMvdmlldy9pMThuL21ldGEnO1xuXG4vLy8vIFR5cGVzXG5leHBvcnQgZW51bSBUeXBlTW9kaWZpZXIge1xuICBDb25zdFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgaWYgKCFtb2RpZmllcnMpIHtcbiAgICAgIHRoaXMubW9kaWZpZXJzID0gW107XG4gICAgfVxuICB9XG4gIGFic3RyYWN0IHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xuXG4gIGhhc01vZGlmaWVyKG1vZGlmaWVyOiBUeXBlTW9kaWZpZXIpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tb2RpZmllcnMhLmluZGV4T2YobW9kaWZpZXIpICE9PSAtMTtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBCdWlsdGluVHlwZU5hbWUge1xuICBEeW5hbWljLFxuICBCb29sLFxuICBTdHJpbmcsXG4gIEludCxcbiAgTnVtYmVyLFxuICBGdW5jdGlvbixcbiAgSW5mZXJyZWQsXG4gIE5vbmUsXG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogQnVpbHRpblR5cGVOYW1lLCBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCdWlsdGluVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhwcmVzc2lvblR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIG1vZGlmaWVyczogVHlwZU1vZGlmaWVyW118bnVsbCA9IG51bGwsXG4gICAgICBwdWJsaWMgdHlwZVBhcmFtczogVHlwZVtdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHByZXNzaW9uVHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBBcnJheVR5cGUgZXh0ZW5kcyBUeXBlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG9mOiBUeXBlLCBtb2RpZmllcnM6IFR5cGVNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzKTtcbiAgfVxuICB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRBcnJheVR5cGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTWFwVHlwZSBleHRlbmRzIFR5cGUge1xuICBwdWJsaWMgdmFsdWVUeXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKHZhbHVlVHlwZTogVHlwZXxudWxsfHVuZGVmaW5lZCwgbW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXXxudWxsID0gbnVsbCkge1xuICAgIHN1cGVyKG1vZGlmaWVycyk7XG4gICAgdGhpcy52YWx1ZVR5cGUgPSB2YWx1ZVR5cGUgfHwgbnVsbDtcbiAgfVxuICB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRNYXBUeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBEWU5BTUlDX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkR5bmFtaWMpO1xuZXhwb3J0IGNvbnN0IElORkVSUkVEX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkluZmVycmVkKTtcbmV4cG9ydCBjb25zdCBCT09MX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkJvb2wpO1xuZXhwb3J0IGNvbnN0IElOVF9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5JbnQpO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5OdW1iZXIpO1xuZXhwb3J0IGNvbnN0IFNUUklOR19UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5TdHJpbmcpO1xuZXhwb3J0IGNvbnN0IEZVTkNUSU9OX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkZ1bmN0aW9uKTtcbmV4cG9ydCBjb25zdCBOT05FX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLk5vbmUpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVWaXNpdG9yIHtcbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cHJlc3Npb25UeXBlKHR5cGU6IEV4cHJlc3Npb25UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vLy8vLyBFeHByZXNzaW9uc1xuXG5leHBvcnQgZW51bSBVbmFyeU9wZXJhdG9yIHtcbiAgTWludXMsXG4gIFBsdXMsXG59XG5cbmV4cG9ydCBlbnVtIEJpbmFyeU9wZXJhdG9yIHtcbiAgRXF1YWxzLFxuICBOb3RFcXVhbHMsXG4gIElkZW50aWNhbCxcbiAgTm90SWRlbnRpY2FsLFxuICBNaW51cyxcbiAgUGx1cyxcbiAgRGl2aWRlLFxuICBNdWx0aXBseSxcbiAgTW9kdWxvLFxuICBBbmQsXG4gIE9yLFxuICBCaXR3aXNlQW5kLFxuICBMb3dlcixcbiAgTG93ZXJFcXVhbHMsXG4gIEJpZ2dlcixcbiAgQmlnZ2VyRXF1YWxzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBudWxsU2FmZUlzRXF1aXZhbGVudDxUIGV4dGVuZHMge2lzRXF1aXZhbGVudChvdGhlcjogVCk6IGJvb2xlYW59PihcbiAgICBiYXNlOiBUfG51bGwsIG90aGVyOiBUfG51bGwpIHtcbiAgaWYgKGJhc2UgPT0gbnVsbCB8fCBvdGhlciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGJhc2UgPT0gb3RoZXI7XG4gIH1cbiAgcmV0dXJuIGJhc2UuaXNFcXVpdmFsZW50KG90aGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFyZUFsbEVxdWl2YWxlbnQ8VCBleHRlbmRzIHtpc0VxdWl2YWxlbnQob3RoZXI6IFQpOiBib29sZWFufT4oXG4gICAgYmFzZTogVFtdLCBvdGhlcjogVFtdKSB7XG4gIGNvbnN0IGxlbiA9IGJhc2UubGVuZ3RoO1xuICBpZiAobGVuICE9PSBvdGhlci5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghYmFzZVtpXS5pc0VxdWl2YWxlbnQob3RoZXJbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcblxuICBjb25zdHJ1Y3Rvcih0eXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VTcGFuID0gc291cmNlU3BhbiB8fCBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIGV4cHJlc3Npb24gcHJvZHVjZXMgdGhlIHNhbWUgdmFsdWUgYXMgdGhlIGdpdmVuIGV4cHJlc3Npb24uXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIGNvbnN0YW50LlxuICAgKi9cbiAgYWJzdHJhY3QgaXNDb25zdGFudCgpOiBib29sZWFuO1xuXG4gIHByb3AobmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgUmVhZFByb3BFeHByKHRoaXMsIG5hbWUsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAga2V5KGluZGV4OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWFkS2V5RXhwcih0aGlzLCBpbmRleCwgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjYWxsTWV0aG9kKG5hbWU6IHN0cmluZ3xCdWlsdGluTWV0aG9kLCBwYXJhbXM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTpcbiAgICAgIEludm9rZU1ldGhvZEV4cHIge1xuICAgIHJldHVybiBuZXcgSW52b2tlTWV0aG9kRXhwcih0aGlzLCBuYW1lLCBwYXJhbXMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgY2FsbEZuKHBhcmFtczogRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1cmU/OiBib29sZWFuKTpcbiAgICAgIEludm9rZUZ1bmN0aW9uRXhwciB7XG4gICAgcmV0dXJuIG5ldyBJbnZva2VGdW5jdGlvbkV4cHIodGhpcywgcGFyYW1zLCBudWxsLCBzb3VyY2VTcGFuLCBwdXJlKTtcbiAgfVxuXG4gIGluc3RhbnRpYXRlKHBhcmFtczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOlxuICAgICAgSW5zdGFudGlhdGVFeHByIHtcbiAgICByZXR1cm4gbmV3IEluc3RhbnRpYXRlRXhwcih0aGlzLCBwYXJhbXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgY29uZGl0aW9uYWwoXG4gICAgICB0cnVlQ2FzZTogRXhwcmVzc2lvbiwgZmFsc2VDYXNlOiBFeHByZXNzaW9ufG51bGwgPSBudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQ29uZGl0aW9uYWxFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsRXhwcih0aGlzLCB0cnVlQ2FzZSwgZmFsc2VDYXNlLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuRXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG5vdEVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlkZW50aWNhbChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG5vdElkZW50aWNhbChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG1pbnVzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5NaW51cywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBwbHVzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5QbHVzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGRpdmlkZShyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuRGl2aWRlLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG11bHRpcGx5KHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5NdWx0aXBseSwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBtb2R1bG8ocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk1vZHVsbywgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBhbmQocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkFuZCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBiaXR3aXNlQW5kKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwYXJlbnM6IGJvb2xlYW4gPSB0cnVlKTpcbiAgICAgIEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZCwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuLCBwYXJlbnMpO1xuICB9XG4gIG9yKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5PciwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBsb3dlcihyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTG93ZXIsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbG93ZXJFcXVhbHMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGJpZ2dlcihyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQmlnZ2VyLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGJpZ2dlckVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzQmxhbmsoc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXhwcmVzc2lvbiB7XG4gICAgLy8gTm90ZTogV2UgdXNlIGVxdWFscyBieSBwdXJwb3NlIGhlcmUgdG8gY29tcGFyZSB0byBudWxsIGFuZCB1bmRlZmluZWQgaW4gSlMuXG4gICAgLy8gV2UgdXNlIHRoZSB0eXBlZCBudWxsIHRvIGFsbG93IHN0cmljdE51bGxDaGVja3MgdG8gbmFycm93IHR5cGVzLlxuICAgIHJldHVybiB0aGlzLmVxdWFscyhUWVBFRF9OVUxMX0VYUFIsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGNhc3QodHlwZTogVHlwZSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIG5ldyBDYXN0RXhwcih0aGlzLCB0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvU3RtdCgpOiBTdGF0ZW1lbnQge1xuICAgIHJldHVybiBuZXcgRXhwcmVzc2lvblN0YXRlbWVudCh0aGlzLCBudWxsKTtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBCdWlsdGluVmFyIHtcbiAgVGhpcyxcbiAgU3VwZXIsXG4gIENhdGNoRXJyb3IsXG4gIENhdGNoU3RhY2tcbn1cblxuZXhwb3J0IGNsYXNzIFJlYWRWYXJFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbDtcbiAgcHVibGljIGJ1aWx0aW46IEJ1aWx0aW5WYXJ8bnVsbDtcblxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmd8QnVpbHRpblZhciwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgIHRoaXMuYnVpbHRpbiA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubmFtZSA9IG51bGw7XG4gICAgICB0aGlzLmJ1aWx0aW4gPSBuYW1lO1xuICAgIH1cbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkVmFyRXhwciAmJiB0aGlzLm5hbWUgPT09IGUubmFtZSAmJiB0aGlzLmJ1aWx0aW4gPT09IGUuYnVpbHRpbjtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVhZFZhckV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZVZhckV4cHIge1xuICAgIGlmICghdGhpcy5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJ1aWx0IGluIHZhcmlhYmxlICR7dGhpcy5idWlsdGlufSBjYW4gbm90IGJlIGFzc2lnbmVkIHRvLmApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFdyaXRlVmFyRXhwcih0aGlzLm5hbWUsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUeXBlb2ZFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBleHByOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUeXBlb2ZFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFR5cGVvZkV4cHIgJiYgZS5leHByLmlzRXF1aXZhbGVudCh0aGlzLmV4cHIpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5leHByLmlzQ29uc3RhbnQoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV3JhcHBlZE5vZGVFeHByPFQ+IGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBub2RlOiBULCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcmFwcGVkTm9kZUV4cHIgJiYgdGhpcy5ub2RlID09PSBlLm5vZGU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyYXBwZWROb2RlRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV3JpdGVWYXJFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbjtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCB2YWx1ZTogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSB8fCB2YWx1ZS50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgV3JpdGVWYXJFeHByICYmIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcml0ZVZhckV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICB0b0RlY2xTdG10KHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVycz86IFN0bXRNb2RpZmllcltdfG51bGwpOiBEZWNsYXJlVmFyU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlVmFyU3RtdCh0aGlzLm5hbWUsIHRoaXMudmFsdWUsIHR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvQ29uc3REZWNsKCk6IERlY2xhcmVWYXJTdG10IHtcbiAgICByZXR1cm4gdGhpcy50b0RlY2xTdG10KElORkVSUkVEX1RZUEUsIFtTdG10TW9kaWZpZXIuRmluYWxdKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXcml0ZUtleUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIGluZGV4OiBFeHByZXNzaW9uLCB2YWx1ZTogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JpdGVLZXlFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFdyaXRlUHJvcEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIG5hbWU6IHN0cmluZywgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZVByb3BFeHByICYmIHRoaXMucmVjZWl2ZXIuaXNFcXVpdmFsZW50KGUucmVjZWl2ZXIpICYmXG4gICAgICAgIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcml0ZVByb3BFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWx0aW5NZXRob2Qge1xuICBDb25jYXRBcnJheSxcbiAgU3Vic2NyaWJlT2JzZXJ2YWJsZSxcbiAgQmluZFxufVxuXG5leHBvcnQgY2xhc3MgSW52b2tlTWV0aG9kRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGw7XG4gIHB1YmxpYyBidWlsdGluOiBCdWlsdGluTWV0aG9kfG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBtZXRob2Q6IHN0cmluZ3xCdWlsdGluTWV0aG9kLCBwdWJsaWMgYXJnczogRXhwcmVzc2lvbltdLFxuICAgICAgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGVvZiBtZXRob2QgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLm5hbWUgPSBtZXRob2Q7XG4gICAgICB0aGlzLmJ1aWx0aW4gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm5hbWUgPSBudWxsO1xuICAgICAgdGhpcy5idWlsdGluID0gPEJ1aWx0aW5NZXRob2Q+bWV0aG9kO1xuICAgIH1cbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBJbnZva2VNZXRob2RFeHByICYmIHRoaXMucmVjZWl2ZXIuaXNFcXVpdmFsZW50KGUucmVjZWl2ZXIpICYmXG4gICAgICAgIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMuYnVpbHRpbiA9PT0gZS5idWlsdGluICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnZva2VNZXRob2RFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEludm9rZUZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBmbjogRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIHB1cmUgPSBmYWxzZSkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEludm9rZUZ1bmN0aW9uRXhwciAmJiB0aGlzLmZuLmlzRXF1aXZhbGVudChlLmZuKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYXJncywgZS5hcmdzKSAmJiB0aGlzLnB1cmUgPT09IGUucHVyZTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SW52b2tlRnVuY3Rpb25FeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEluc3RhbnRpYXRlRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjbGFzc0V4cHI6IEV4cHJlc3Npb24sIHB1YmxpYyBhcmdzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBJbnN0YW50aWF0ZUV4cHIgJiYgdGhpcy5jbGFzc0V4cHIuaXNFcXVpdmFsZW50KGUuY2xhc3NFeHByKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYXJncywgZS5hcmdzKTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SW5zdGFudGlhdGVFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBudW1iZXJ8c3RyaW5nfGJvb2xlYW58bnVsbHx1bmRlZmluZWQsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBMaXRlcmFsRXhwciAmJiB0aGlzLnZhbHVlID09PSBlLnZhbHVlO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdExpdGVyYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBNZXNzYWdlUGllY2Uge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuZXhwb3J0IGNsYXNzIExpdGVyYWxQaWVjZSBleHRlbmRzIE1lc3NhZ2VQaWVjZSB7fVxuZXhwb3J0IGNsYXNzIFBsYWNlaG9sZGVyUGllY2UgZXh0ZW5kcyBNZXNzYWdlUGllY2Uge31cblxuZXhwb3J0IGNsYXNzIExvY2FsaXplZFN0cmluZyBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IG1ldGFCbG9jazogSTE4bk1ldGEsIHJlYWRvbmx5IG1lc3NhZ2VQYXJ0czogTGl0ZXJhbFBpZWNlW10sXG4gICAgICByZWFkb25seSBwbGFjZUhvbGRlck5hbWVzOiBQbGFjZWhvbGRlclBpZWNlW10sIHJlYWRvbmx5IGV4cHJlc3Npb25zOiBFeHByZXNzaW9uW10sXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihTVFJJTkdfVFlQRSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIC8vIHJldHVybiBlIGluc3RhbmNlb2YgTG9jYWxpemVkU3RyaW5nICYmIHRoaXMubWVzc2FnZSA9PT0gZS5tZXNzYWdlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TG9jYWxpemVkU3RyaW5nKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYG1ldGFgIGFuZCBgbWVzc2FnZVBhcnRgIGludG8gXCJjb29rZWRcIiBhbmQgXCJyYXdcIiBzdHJpbmdzIHRoYXQgY2FuIGJlIHVzZWRcbiAgICogaW4gYSBgJGxvY2FsaXplYCB0YWdnZWQgc3RyaW5nLiBUaGUgZm9ybWF0IG9mIHRoZSBtZXRhZGF0YSBpcyB0aGUgc2FtZSBhcyB0aGF0IHBhcnNlZCBieVxuICAgKiBgcGFyc2VJMThuTWV0YSgpYC5cbiAgICpcbiAgICogQHBhcmFtIG1ldGEgVGhlIG1ldGFkYXRhIHRvIHNlcmlhbGl6ZVxuICAgKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZpcnN0IHBhcnQgb2YgdGhlIHRhZ2dlZCBzdHJpbmdcbiAgICovXG4gIHNlcmlhbGl6ZUkxOG5IZWFkKCk6IHtjb29rZWQ6IHN0cmluZywgcmF3OiBzdHJpbmd9IHtcbiAgICBjb25zdCBNRUFOSU5HX1NFUEFSQVRPUiA9ICd8JztcbiAgICBjb25zdCBJRF9TRVBBUkFUT1IgPSAnQEAnO1xuICAgIGNvbnN0IExFR0FDWV9JRF9JTkRJQ0FUT1IgPSAn4pCfJztcblxuICAgIGxldCBtZXRhQmxvY2sgPSB0aGlzLm1ldGFCbG9jay5kZXNjcmlwdGlvbiB8fCAnJztcbiAgICBpZiAodGhpcy5tZXRhQmxvY2subWVhbmluZykge1xuICAgICAgbWV0YUJsb2NrID0gYCR7dGhpcy5tZXRhQmxvY2subWVhbmluZ30ke01FQU5JTkdfU0VQQVJBVE9SfSR7bWV0YUJsb2NrfWA7XG4gICAgfVxuICAgIGlmICh0aGlzLm1ldGFCbG9jay5jdXN0b21JZCkge1xuICAgICAgbWV0YUJsb2NrID0gYCR7bWV0YUJsb2NrfSR7SURfU0VQQVJBVE9SfSR7dGhpcy5tZXRhQmxvY2suY3VzdG9tSWR9YDtcbiAgICB9XG4gICAgaWYgKHRoaXMubWV0YUJsb2NrLmxlZ2FjeUlkcykge1xuICAgICAgdGhpcy5tZXRhQmxvY2subGVnYWN5SWRzLmZvckVhY2gobGVnYWN5SWQgPT4ge1xuICAgICAgICBtZXRhQmxvY2sgPSBgJHttZXRhQmxvY2t9JHtMRUdBQ1lfSURfSU5ESUNBVE9SfSR7bGVnYWN5SWR9YDtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ29va2VkUmF3U3RyaW5nKG1ldGFCbG9jaywgdGhpcy5tZXNzYWdlUGFydHNbMF0udGV4dCk7XG4gIH1cblxuICBnZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VQYXJ0c1tpXT8uc291cmNlU3BhbiA/PyB0aGlzLnNvdXJjZVNwYW47XG4gIH1cblxuICBnZXRQbGFjZWhvbGRlclNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gdGhpcy5wbGFjZUhvbGRlck5hbWVzW2ldPy5zb3VyY2VTcGFuID8/IHRoaXMuZXhwcmVzc2lvbnNbaV0/LnNvdXJjZVNwYW4gPz9cbiAgICAgICAgdGhpcy5zb3VyY2VTcGFuO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYHBsYWNlaG9sZGVyTmFtZWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBcImNvb2tlZFwiIGFuZCBcInJhd1wiIHN0cmluZ3MgdGhhdFxuICAgKiBjYW4gYmUgdXNlZCBpbiBhIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gICAqXG4gICAqIEBwYXJhbSBwbGFjZWhvbGRlck5hbWUgVGhlIHBsYWNlaG9sZGVyIG5hbWUgdG8gc2VyaWFsaXplXG4gICAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZm9sbG93aW5nIG1lc3NhZ2Ugc3RyaW5nIGFmdGVyIHRoaXMgcGxhY2Vob2xkZXJcbiAgICovXG4gIHNlcmlhbGl6ZUkxOG5UZW1wbGF0ZVBhcnQocGFydEluZGV4OiBudW1iZXIpOiB7Y29va2VkOiBzdHJpbmcsIHJhdzogc3RyaW5nfSB7XG4gICAgY29uc3QgcGxhY2Vob2xkZXJOYW1lID0gdGhpcy5wbGFjZUhvbGRlck5hbWVzW3BhcnRJbmRleCAtIDFdLnRleHQ7XG4gICAgY29uc3QgbWVzc2FnZVBhcnQgPSB0aGlzLm1lc3NhZ2VQYXJ0c1twYXJ0SW5kZXhdO1xuICAgIHJldHVybiBjcmVhdGVDb29rZWRSYXdTdHJpbmcocGxhY2Vob2xkZXJOYW1lLCBtZXNzYWdlUGFydC50ZXh0KTtcbiAgfVxufVxuXG5jb25zdCBlc2NhcGVTbGFzaGVzID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+IHN0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpO1xuY29uc3QgZXNjYXBlU3RhcnRpbmdDb2xvbiA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUNvbG9ucyA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUZvck1lc3NhZ2VQYXJ0ID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgc3RyLnJlcGxhY2UoL2AvZywgJ1xcXFxgJykucmVwbGFjZSgvXFwkey9nLCAnJFxcXFx7Jyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGB7Y29va2VkLCByYXd9YCBvYmplY3QgZnJvbSB0aGUgYG1ldGFCbG9ja2AgYW5kIGBtZXNzYWdlUGFydGAuXG4gKlxuICogVGhlIGByYXdgIHRleHQgbXVzdCBoYXZlIHZhcmlvdXMgY2hhcmFjdGVyIHNlcXVlbmNlcyBlc2NhcGVkOlxuICogKiBcIlxcXCIgd291bGQgb3RoZXJ3aXNlIGluZGljYXRlIHRoYXQgdGhlIG5leHQgY2hhcmFjdGVyIGlzIGEgY29udHJvbCBjaGFyYWN0ZXIuXG4gKiAqIFwiYFwiIGFuZCBcIiR7XCIgYXJlIHRlbXBsYXRlIHN0cmluZyBjb250cm9sIHNlcXVlbmNlcyB0aGF0IHdvdWxkIG90aGVyd2lzZSBwcmVtYXR1cmVseSBpbmRpY2F0ZVxuICogICB0aGUgZW5kIG9mIGEgbWVzc2FnZSBwYXJ0LlxuICogKiBcIjpcIiBpbnNpZGUgYSBtZXRhYmxvY2sgd291bGQgcHJlbWF0dXJlbHkgaW5kaWNhdGUgdGhlIGVuZCBvZiB0aGUgbWV0YWJsb2NrLlxuICogKiBcIjpcIiBhdCB0aGUgc3RhcnQgb2YgYSBtZXNzYWdlUGFydCB3aXRoIG5vIG1ldGFibG9jayB3b3VsZCBlcnJvbmVvdXNseSBpbmRpY2F0ZSB0aGUgc3RhcnQgb2YgYVxuICogICBtZXRhYmxvY2suXG4gKlxuICogQHBhcmFtIG1ldGFCbG9jayBBbnkgbWV0YWRhdGEgdGhhdCBzaG91bGQgYmUgcHJlcGVuZGVkIHRvIHRoZSBzdHJpbmdcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgbWVzc2FnZSBwYXJ0IG9mIHRoZSBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ29va2VkUmF3U3RyaW5nKG1ldGFCbG9jazogc3RyaW5nLCBtZXNzYWdlUGFydDogc3RyaW5nKSB7XG4gIGlmIChtZXRhQmxvY2sgPT09ICcnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogbWVzc2FnZVBhcnQsXG4gICAgICByYXc6IGVzY2FwZUZvck1lc3NhZ2VQYXJ0KGVzY2FwZVN0YXJ0aW5nQ29sb24oZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCkpKVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogYDoke21ldGFCbG9ja306JHttZXNzYWdlUGFydH1gLFxuICAgICAgcmF3OiBlc2NhcGVGb3JNZXNzYWdlUGFydChcbiAgICAgICAgICBgOiR7ZXNjYXBlQ29sb25zKGVzY2FwZVNsYXNoZXMobWV0YUJsb2NrKSl9OiR7ZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCl9YClcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlcm5hbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlPzogVHlwZXxudWxsLCBwdWJsaWMgdHlwZVBhcmFtczogVHlwZVtdfG51bGwgPSBudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRXh0ZXJuYWxFeHByICYmIHRoaXMudmFsdWUubmFtZSA9PT0gZS52YWx1ZS5uYW1lICYmXG4gICAgICAgIHRoaXMudmFsdWUubW9kdWxlTmFtZSA9PT0gZS52YWx1ZS5tb2R1bGVOYW1lICYmIHRoaXMudmFsdWUucnVudGltZSA9PT0gZS52YWx1ZS5ydW50aW1lO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHRlcm5hbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVybmFsUmVmZXJlbmNlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG1vZHVsZU5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGwsIHB1YmxpYyBydW50aW1lPzogYW55fG51bGwpIHtcbiAgfVxuICAvLyBOb3RlOiBubyBpc0VxdWl2YWxlbnQgbWV0aG9kIGhlcmUgYXMgd2UgdXNlIHRoaXMgYXMgYW4gaW50ZXJmYWNlIHRvby5cbn1cblxuZXhwb3J0IGNsYXNzIENvbmRpdGlvbmFsRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdHJ1ZUNhc2U6IEV4cHJlc3Npb247XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY29uZGl0aW9uOiBFeHByZXNzaW9uLCB0cnVlQ2FzZTogRXhwcmVzc2lvbiwgcHVibGljIGZhbHNlQ2FzZTogRXhwcmVzc2lvbnxudWxsID0gbnVsbCxcbiAgICAgIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdHJ1ZUNhc2UudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy50cnVlQ2FzZSA9IHRydWVDYXNlO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbmRpdGlvbmFsRXhwciAmJiB0aGlzLmNvbmRpdGlvbi5pc0VxdWl2YWxlbnQoZS5jb25kaXRpb24pICYmXG4gICAgICAgIHRoaXMudHJ1ZUNhc2UuaXNFcXVpdmFsZW50KGUudHJ1ZUNhc2UpICYmIG51bGxTYWZlSXNFcXVpdmFsZW50KHRoaXMuZmFsc2VDYXNlLCBlLmZhbHNlQ2FzZSk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbmRpdGlvbmFsRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBOb3RFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKEJPT0xfVFlQRSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTm90RXhwciAmJiB0aGlzLmNvbmRpdGlvbi5pc0VxdWl2YWxlbnQoZS5jb25kaXRpb24pO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXROb3RFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnROb3ROdWxsIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKGNvbmRpdGlvbi50eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBBc3NlcnROb3ROdWxsICYmIHRoaXMuY29uZGl0aW9uLmlzRXF1aXZhbGVudChlLmNvbmRpdGlvbik7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFzc2VydE5vdE51bGxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDYXN0RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENhc3RFeHByICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDYXN0RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBGblBhcmFtIHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IFR5cGV8bnVsbCA9IG51bGwpIHt9XG5cbiAgaXNFcXVpdmFsZW50KHBhcmFtOiBGblBhcmFtKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gcGFyYW0ubmFtZTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcGFyYW1zOiBGblBhcmFtW10sIHB1YmxpYyBzdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIG5hbWU/OiBzdHJpbmd8bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEZ1bmN0aW9uRXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMucGFyYW1zLCBlLnBhcmFtcykgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnN0YXRlbWVudHMsIGUuc3RhdGVtZW50cyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEZ1bmN0aW9uRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHRvRGVjbFN0bXQobmFtZTogc3RyaW5nLCBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsKTogRGVjbGFyZUZ1bmN0aW9uU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlRnVuY3Rpb25TdG10KFxuICAgICAgICBuYW1lLCB0aGlzLnBhcmFtcywgdGhpcy5zdGF0ZW1lbnRzLCB0aGlzLnR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBVbmFyeU9wZXJhdG9yRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBvcGVyYXRvcjogVW5hcnlPcGVyYXRvciwgcHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBwYXJlbnM6IGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgc3VwZXIodHlwZSB8fCBOVU1CRVJfVFlQRSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgVW5hcnlPcGVyYXRvckV4cHIgJiYgdGhpcy5vcGVyYXRvciA9PT0gZS5vcGVyYXRvciAmJlxuICAgICAgICB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KGUuZXhwcik7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFVuYXJ5T3BlcmF0b3JFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIEJpbmFyeU9wZXJhdG9yRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgbGhzOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBvcGVyYXRvcjogQmluYXJ5T3BlcmF0b3IsIGxoczogRXhwcmVzc2lvbiwgcHVibGljIHJoczogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIHBhcmVuczogYm9vbGVhbiA9IHRydWUpIHtcbiAgICBzdXBlcih0eXBlIHx8IGxocy50eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLmxocyA9IGxocztcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBCaW5hcnlPcGVyYXRvckV4cHIgJiYgdGhpcy5vcGVyYXRvciA9PT0gZS5vcGVyYXRvciAmJlxuICAgICAgICB0aGlzLmxocy5pc0VxdWl2YWxlbnQoZS5saHMpICYmIHRoaXMucmhzLmlzRXF1aXZhbGVudChlLnJocyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJpbmFyeU9wZXJhdG9yRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBSZWFkUHJvcEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkUHJvcEV4cHIgJiYgdGhpcy5yZWNlaXZlci5pc0VxdWl2YWxlbnQoZS5yZWNlaXZlcikgJiZcbiAgICAgICAgdGhpcy5uYW1lID09PSBlLm5hbWU7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlYWRQcm9wRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVQcm9wRXhwcih0aGlzLnJlY2VpdmVyLCB0aGlzLm5hbWUsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRLZXlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBFeHByZXNzaW9uLCBwdWJsaWMgaW5kZXg6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWFkS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KTtcbiAgfVxuXG4gIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVhZEtleUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBzZXQodmFsdWU6IEV4cHJlc3Npb24pOiBXcml0ZUtleUV4cHIge1xuICAgIHJldHVybiBuZXcgV3JpdGVLZXlFeHByKHRoaXMucmVjZWl2ZXIsIHRoaXMuaW5kZXgsIHZhbHVlLCBudWxsLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxBcnJheUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIGVudHJpZXM6IEV4cHJlc3Npb25bXTtcbiAgY29uc3RydWN0b3IoZW50cmllczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS5pc0NvbnN0YW50KCkpO1xuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxBcnJheUV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmVudHJpZXMsIGUuZW50cmllcyk7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEFycmF5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbE1hcEVudHJ5IHtcbiAgY29uc3RydWN0b3IocHVibGljIGtleTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IEV4cHJlc3Npb24sIHB1YmxpYyBxdW90ZWQ6IGJvb2xlYW4pIHt9XG4gIGlzRXF1aXZhbGVudChlOiBMaXRlcmFsTWFwRW50cnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5rZXkgPT09IGUua2V5ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgdmFsdWVUeXBlOiBUeXBlfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBlbnRyaWVzOiBMaXRlcmFsTWFwRW50cnlbXSwgdHlwZT86IE1hcFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHRoaXMudmFsdWVUeXBlID0gdHlwZS52YWx1ZVR5cGU7XG4gICAgfVxuICB9XG5cbiAgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxNYXBFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5lbnRyaWVzLCBlLmVudHJpZXMpO1xuICB9XG5cbiAgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmV2ZXJ5KGUgPT4gZS52YWx1ZS5pc0NvbnN0YW50KCkpO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbE1hcEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbW1hRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcGFydHM6IEV4cHJlc3Npb25bXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIocGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29tbWFFeHByICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJ0cywgZS5wYXJ0cyk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbW1hRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4cHJlc3Npb25WaXNpdG9yIHtcbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IFdyaXRlVmFyRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBXcml0ZUtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcml0ZVByb3BFeHByKGV4cHI6IFdyaXRlUHJvcEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJbnZva2VNZXRob2RFeHByKGFzdDogSW52b2tlTWV0aG9kRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEluc3RhbnRpYXRlRXhwcihhc3Q6IEluc3RhbnRpYXRlRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBMb2NhbGl6ZWRTdHJpbmcsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogQmluYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBMaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNvbnN0IFRISVNfRVhQUiA9IG5ldyBSZWFkVmFyRXhwcihCdWlsdGluVmFyLlRoaXMsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IFNVUEVSX0VYUFIgPSBuZXcgUmVhZFZhckV4cHIoQnVpbHRpblZhci5TdXBlciwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuQ2F0Y2hFcnJvciwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfU1RBQ0tfVkFSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuQ2F0Y2hTdGFjaywgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgTlVMTF9FWFBSID0gbmV3IExpdGVyYWxFeHByKG51bGwsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IFRZUEVEX05VTExfRVhQUiA9IG5ldyBMaXRlcmFsRXhwcihudWxsLCBJTkZFUlJFRF9UWVBFLCBudWxsKTtcblxuLy8vLyBTdGF0ZW1lbnRzXG5leHBvcnQgZW51bSBTdG10TW9kaWZpZXIge1xuICBGaW5hbCxcbiAgUHJpdmF0ZSxcbiAgRXhwb3J0ZWQsXG4gIFN0YXRpYyxcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN0YXRlbWVudCB7XG4gIHB1YmxpYyBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdO1xuICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIGNvbnN0cnVjdG9yKG1vZGlmaWVycz86IFN0bXRNb2RpZmllcltdfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHRoaXMubW9kaWZpZXJzID0gbW9kaWZpZXJzIHx8IFtdO1xuICAgIHRoaXMuc291cmNlU3BhbiA9IHNvdXJjZVNwYW4gfHwgbnVsbDtcbiAgfVxuICAvKipcbiAgICogQ2FsY3VsYXRlcyB3aGV0aGVyIHRoaXMgc3RhdGVtZW50IHByb2R1Y2VzIHRoZSBzYW1lIHZhbHVlIGFzIHRoZSBnaXZlbiBzdGF0ZW1lbnQuXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbjtcblxuICBhYnN0cmFjdCB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgaGFzTW9kaWZpZXIobW9kaWZpZXI6IFN0bXRNb2RpZmllcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1vZGlmaWVycyEuaW5kZXhPZihtb2RpZmllcikgIT09IC0xO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIERlY2xhcmVWYXJTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU/OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsID0gbnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobW9kaWZpZXJzLCBzb3VyY2VTcGFuKTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8ICh2YWx1ZSAmJiB2YWx1ZS50eXBlKSB8fCBudWxsO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIERlY2xhcmVWYXJTdG10ICYmIHRoaXMubmFtZSA9PT0gc3RtdC5uYW1lICYmXG4gICAgICAgICh0aGlzLnZhbHVlID8gISFzdG10LnZhbHVlICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpIDogIXN0bXQudmFsdWUpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlVmFyU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVjbGFyZUZ1bmN0aW9uU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHBhcmFtczogRm5QYXJhbVtdLCBwdWJsaWMgc3RhdGVtZW50czogU3RhdGVtZW50W10sXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHlwZSA9IHR5cGUgfHwgbnVsbDtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBEZWNsYXJlRnVuY3Rpb25TdG10ICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5wYXJhbXMsIHN0bXQucGFyYW1zKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuc3RhdGVtZW50cywgc3RtdC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uU3RhdGVtZW50IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIEV4cHJlc3Npb25TdGF0ZW1lbnQgJiYgdGhpcy5leHByLmlzRXF1aXZhbGVudChzdG10LmV4cHIpO1xuICB9XG5cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV4cHJlc3Npb25TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJldHVyblN0YXRlbWVudCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgUmV0dXJuU3RhdGVtZW50ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpO1xuICB9XG4gIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZXR1cm5TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBYnN0cmFjdENsYXNzUGFydCB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKHR5cGU6IFR5cGV8bnVsbHx1bmRlZmluZWQsIHB1YmxpYyBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwpIHtcbiAgICBpZiAoIW1vZGlmaWVycykge1xuICAgICAgdGhpcy5tb2RpZmllcnMgPSBbXTtcbiAgICB9XG4gICAgdGhpcy50eXBlID0gdHlwZSB8fCBudWxsO1xuICB9XG4gIGhhc01vZGlmaWVyKG1vZGlmaWVyOiBTdG10TW9kaWZpZXIpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tb2RpZmllcnMhLmluZGV4T2YobW9kaWZpZXIpICE9PSAtMTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2xhc3NGaWVsZCBleHRlbmRzIEFic3RyYWN0Q2xhc3NQYXJ0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsLFxuICAgICAgcHVibGljIGluaXRpYWxpemVyPzogRXhwcmVzc2lvbikge1xuICAgIHN1cGVyKHR5cGUsIG1vZGlmaWVycyk7XG4gIH1cbiAgaXNFcXVpdmFsZW50KGY6IENsYXNzRmllbGQpIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lID09PSBmLm5hbWU7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2xhc3NNZXRob2QgZXh0ZW5kcyBBYnN0cmFjdENsYXNzUGFydCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGFyYW1zOiBGblBhcmFtW10sIHB1YmxpYyBib2R5OiBTdGF0ZW1lbnRbXSxcbiAgICAgIHR5cGU/OiBUeXBlfG51bGwsIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBtb2RpZmllcnMpO1xuICB9XG4gIGlzRXF1aXZhbGVudChtOiBDbGFzc01ldGhvZCkge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IG0ubmFtZSAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYm9keSwgbS5ib2R5KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBDbGFzc0dldHRlciBleHRlbmRzIEFic3RyYWN0Q2xhc3NQYXJ0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYm9keTogU3RhdGVtZW50W10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBtb2RpZmllcnM6IFN0bXRNb2RpZmllcltdfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIodHlwZSwgbW9kaWZpZXJzKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQobTogQ2xhc3NHZXR0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lID09PSBtLm5hbWUgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmJvZHksIG0uYm9keSk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2xhc3NTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgcGFyZW50OiBFeHByZXNzaW9ufG51bGwsIHB1YmxpYyBmaWVsZHM6IENsYXNzRmllbGRbXSxcbiAgICAgIHB1YmxpYyBnZXR0ZXJzOiBDbGFzc0dldHRlcltdLCBwdWJsaWMgY29uc3RydWN0b3JNZXRob2Q6IENsYXNzTWV0aG9kLFxuICAgICAgcHVibGljIG1ldGhvZHM6IENsYXNzTWV0aG9kW10sIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW118bnVsbCA9IG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIENsYXNzU3RtdCAmJiB0aGlzLm5hbWUgPT09IHN0bXQubmFtZSAmJlxuICAgICAgICBudWxsU2FmZUlzRXF1aXZhbGVudCh0aGlzLnBhcmVudCwgc3RtdC5wYXJlbnQpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5maWVsZHMsIHN0bXQuZmllbGRzKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMuZ2V0dGVycywgc3RtdC5nZXR0ZXJzKSAmJlxuICAgICAgICB0aGlzLmNvbnN0cnVjdG9yTWV0aG9kLmlzRXF1aXZhbGVudChzdG10LmNvbnN0cnVjdG9yTWV0aG9kKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMubWV0aG9kcywgc3RtdC5tZXRob2RzKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVjbGFyZUNsYXNzU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBJZlN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjb25kaXRpb246IEV4cHJlc3Npb24sIHB1YmxpYyB0cnVlQ2FzZTogU3RhdGVtZW50W10sXG4gICAgICBwdWJsaWMgZmFsc2VDYXNlOiBTdGF0ZW1lbnRbXSA9IFtdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBJZlN0bXQgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KHN0bXQuY29uZGl0aW9uKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMudHJ1ZUNhc2UsIHN0bXQudHJ1ZUNhc2UpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5mYWxzZUNhc2UsIHN0bXQuZmFsc2VDYXNlKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50U3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb21tZW50OiBzdHJpbmcsIHB1YmxpYyBtdWx0aWxpbmUgPSBmYWxzZSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgQ29tbWVudFN0bXQ7XG4gIH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbW1lbnRTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBKU0RvY0NvbW1lbnRTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHRhZ3M6IEpTRG9jVGFnW10gPSBbXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgSlNEb2NDb21tZW50U3RtdCAmJiB0aGlzLnRvU3RyaW5nKCkgPT09IHN0bXQudG9TdHJpbmcoKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SlNEb2NDb21tZW50U3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiBzZXJpYWxpemVUYWdzKHRoaXMudGFncyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyeUNhdGNoU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGJvZHlTdG10czogU3RhdGVtZW50W10sIHB1YmxpYyBjYXRjaFN0bXRzOiBTdGF0ZW1lbnRbXSxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIFRyeUNhdGNoU3RtdCAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYm9keVN0bXRzLCBzdG10LmJvZHlTdG10cykgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmNhdGNoU3RtdHMsIHN0bXQuY2F0Y2hTdG10cyk7XG4gIH1cbiAgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRyeUNhdGNoU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBUaHJvd1N0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXJyb3I6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGlzRXF1aXZhbGVudChzdG10OiBUaHJvd1N0bXQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIFRyeUNhdGNoU3RtdCAmJiB0aGlzLmVycm9yLmlzRXF1aXZhbGVudChzdG10LmVycm9yKTtcbiAgfVxuICB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGhyb3dTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdGVtZW50VmlzaXRvciB7XG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogRGVjbGFyZVZhclN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBSZXR1cm5TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IENsYXNzU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdElmU3RtdChzdG10OiBJZlN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRUcnlDYXRjaFN0bXQoc3RtdDogVHJ5Q2F0Y2hTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IFRocm93U3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IENvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0SlNEb2NDb21tZW50U3RtdChzdG10OiBKU0RvY0NvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBBc3RUcmFuc2Zvcm1lciBpbXBsZW1lbnRzIFN0YXRlbWVudFZpc2l0b3IsIEV4cHJlc3Npb25WaXNpdG9yIHtcbiAgdHJhbnNmb3JtRXhwcihleHByOiBFeHByZXNzaW9uLCBjb250ZXh0OiBhbnkpOiBFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxuXG4gIHRyYW5zZm9ybVN0bXQoc3RtdDogU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBTdGF0ZW1lbnQge1xuICAgIHJldHVybiBzdG10O1xuICB9XG5cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0V3JhcHBlZE5vZGVFeHByKGFzdDogV3JhcHBlZE5vZGVFeHByPGFueT4sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRUeXBlb2ZFeHByKGV4cHI6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IFR5cGVvZkV4cHIoZXhwci5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci50eXBlLCBleHByLnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IFdyaXRlVmFyRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgV3JpdGVWYXJFeHByKFxuICAgICAgICAgICAgZXhwci5uYW1lLCBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci50eXBlLCBleHByLnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IFdyaXRlS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgV3JpdGVLZXlFeHByKFxuICAgICAgICAgICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIudHlwZSwgZXhwci5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogV3JpdGVQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgV3JpdGVQcm9wRXhwcihcbiAgICAgICAgICAgIGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLm5hbWUsXG4gICAgICAgICAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci50eXBlLCBleHByLnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0SW52b2tlTWV0aG9kRXhwcihhc3Q6IEludm9rZU1ldGhvZEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgbWV0aG9kID0gYXN0LmJ1aWx0aW4gfHwgYXN0Lm5hbWU7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEludm9rZU1ldGhvZEV4cHIoXG4gICAgICAgICAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBtZXRob2QhLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgICAgYXN0LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBJbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEluc3RhbnRpYXRlRXhwcihcbiAgICAgICAgICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBMb2NhbGl6ZWRTdHJpbmcsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IExvY2FsaXplZFN0cmluZyhcbiAgICAgICAgICAgIGFzdC5tZXRhQmxvY2ssIGFzdC5tZXNzYWdlUGFydHMsIGFzdC5wbGFjZUhvbGRlck5hbWVzLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5leHByZXNzaW9ucywgY29udGV4dCksIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IEV4dGVybmFsRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IENvbmRpdGlvbmFsRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICAgICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgYXN0LmZhbHNlQ2FzZSEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0Tm90RXhwcihhc3Q6IE5vdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IE5vdEV4cHIoYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQXNzZXJ0Tm90TnVsbChhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0Q2FzdEV4cHIoYXN0OiBDYXN0RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQ2FzdEV4cHIoYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgRnVuY3Rpb25FeHByKFxuICAgICAgICAgICAgYXN0LnBhcmFtcywgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoYXN0LnN0YXRlbWVudHMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VW5hcnlPcGVyYXRvckV4cHIoYXN0OiBVbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgVW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBhc3Qub3BlcmF0b3IsIGFzdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgYXN0Lm9wZXJhdG9yLCBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBSZWFkUHJvcEV4cHIoXG4gICAgICAgICAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QubmFtZSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogUmVhZEtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IFJlYWRLZXlFeHByKFxuICAgICAgICAgICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgTGl0ZXJhbEFycmF5RXhwcihcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZW50cmllcywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihhc3Q6IExpdGVyYWxNYXBFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhc3QuZW50cmllcy5tYXAoXG4gICAgICAgIChlbnRyeSk6IExpdGVyYWxNYXBFbnRyeSA9PiBuZXcgTGl0ZXJhbE1hcEVudHJ5KFxuICAgICAgICAgICAgZW50cnkua2V5LCBlbnRyeS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGVudHJ5LnF1b3RlZCkpO1xuICAgIGNvbnN0IG1hcFR5cGUgPSBuZXcgTWFwVHlwZShhc3QudmFsdWVUeXBlLCBudWxsKTtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKG5ldyBMaXRlcmFsTWFwRXhwcihlbnRyaWVzLCBtYXBUeXBlLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0Q29tbWFFeHByKGFzdDogQ29tbWFFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBDb21tYUV4cHIodGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5wYXJ0cywgY29udGV4dCksIGFzdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBbGxFeHByZXNzaW9ucyhleHByczogRXhwcmVzc2lvbltdLCBjb250ZXh0OiBhbnkpOiBFeHByZXNzaW9uW10ge1xuICAgIHJldHVybiBleHBycy5tYXAoZXhwciA9PiBleHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlID0gc3RtdC52YWx1ZSAmJiBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgRGVjbGFyZVZhclN0bXQoc3RtdC5uYW1lLCB2YWx1ZSwgc3RtdC50eXBlLCBzdG10Lm1vZGlmaWVycywgc3RtdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IERlY2xhcmVGdW5jdGlvblN0bXQoXG4gICAgICAgICAgICBzdG10Lm5hbWUsIHN0bXQucGFyYW1zLCB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnN0YXRlbWVudHMsIGNvbnRleHQpLCBzdG10LnR5cGUsXG4gICAgICAgICAgICBzdG10Lm1vZGlmaWVycywgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IEV4cHJlc3Npb25TdGF0ZW1lbnQoc3RtdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBSZXR1cm5TdGF0ZW1lbnQoc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHN0bXQuc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IENsYXNzU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBwYXJlbnQgPSBzdG10LnBhcmVudCEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGNvbnN0IGdldHRlcnMgPSBzdG10LmdldHRlcnMubWFwKFxuICAgICAgICBnZXR0ZXIgPT4gbmV3IENsYXNzR2V0dGVyKFxuICAgICAgICAgICAgZ2V0dGVyLm5hbWUsIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGdldHRlci5ib2R5LCBjb250ZXh0KSwgZ2V0dGVyLnR5cGUsXG4gICAgICAgICAgICBnZXR0ZXIubW9kaWZpZXJzKSk7XG4gICAgY29uc3QgY3Rvck1ldGhvZCA9IHN0bXQuY29uc3RydWN0b3JNZXRob2QgJiZcbiAgICAgICAgbmV3IENsYXNzTWV0aG9kKHN0bXQuY29uc3RydWN0b3JNZXRob2QubmFtZSwgc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5wYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGNvbnRleHQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC50eXBlLCBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLm1vZGlmaWVycyk7XG4gICAgY29uc3QgbWV0aG9kcyA9IHN0bXQubWV0aG9kcy5tYXAoXG4gICAgICAgIG1ldGhvZCA9PiBuZXcgQ2xhc3NNZXRob2QoXG4gICAgICAgICAgICBtZXRob2QubmFtZSwgbWV0aG9kLnBhcmFtcywgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMobWV0aG9kLmJvZHksIGNvbnRleHQpLCBtZXRob2QudHlwZSxcbiAgICAgICAgICAgIG1ldGhvZC5tb2RpZmllcnMpKTtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgQ2xhc3NTdG10KFxuICAgICAgICAgICAgc3RtdC5uYW1lLCBwYXJlbnQsIHN0bXQuZmllbGRzLCBnZXR0ZXJzLCBjdG9yTWV0aG9kLCBtZXRob2RzLCBzdG10Lm1vZGlmaWVycyxcbiAgICAgICAgICAgIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBJZlN0bXQoXG4gICAgICAgICAgICBzdG10LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjb250ZXh0KSxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBUcnlDYXRjaFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IFRyeUNhdGNoU3RtdChcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuYm9keVN0bXRzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY2F0Y2hTdG10cywgY29udGV4dCksIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRUaHJvd1N0bXQoc3RtdDogVGhyb3dTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBUaHJvd1N0bXQoc3RtdC5lcnJvci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHN0bXQuc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDb21tZW50U3RtdChzdG10OiBDb21tZW50U3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KHN0bXQsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRKU0RvY0NvbW1lbnRTdG10KHN0bXQ6IEpTRG9jQ29tbWVudFN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChzdG10LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0QWxsU3RhdGVtZW50cyhzdG10czogU3RhdGVtZW50W10sIGNvbnRleHQ6IGFueSk6IFN0YXRlbWVudFtdIHtcbiAgICByZXR1cm4gc3RtdHMubWFwKHN0bXQgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFN0YXRlbWVudFZpc2l0b3IsIEV4cHJlc3Npb25WaXNpdG9yIHtcbiAgdmlzaXRUeXBlKGFzdDogVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXN0O1xuICB9XG4gIHZpc2l0RXhwcmVzc2lvbihhc3Q6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlKSB7XG4gICAgICBhc3QudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uVHlwZSh0eXBlOiBFeHByZXNzaW9uVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0eXBlLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBpZiAodHlwZS50eXBlUGFyYW1zICE9PSBudWxsKSB7XG4gICAgICB0eXBlLnR5cGVQYXJhbXMuZm9yRWFjaChwYXJhbSA9PiB0aGlzLnZpc2l0VHlwZShwYXJhbSwgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBcnJheVR5cGUodHlwZTogQXJyYXlUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXN0O1xuICB9XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0V3JpdGVWYXJFeHByKGFzdDogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZUtleUV4cHIoYXN0OiBXcml0ZUtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZVByb3BFeHByKGFzdDogV3JpdGVQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnZva2VNZXRob2RFeHByKGFzdDogSW52b2tlTWV0aG9kRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBJbnZva2VGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IExpdGVyYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChhc3QudHlwZVBhcmFtcykge1xuICAgICAgYXN0LnR5cGVQYXJhbXMuZm9yRWFjaCh0eXBlID0+IHR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuZmFsc2VDYXNlIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4gZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJzOiBFeHByZXNzaW9uW10sIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGV4cHJzLmZvckVhY2goZXhwciA9PiBleHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChzdG10LnZhbHVlKSB7XG4gICAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHN0bXQudHlwZSkge1xuICAgICAgc3RtdC50eXBlLnZpc2l0VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzLCBjb250ZXh0KTtcbiAgICBpZiAoc3RtdC50eXBlKSB7XG4gICAgICBzdG10LnR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5wYXJlbnQhLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBzdG10LmdldHRlcnMuZm9yRWFjaChnZXR0ZXIgPT4gdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoZ2V0dGVyLmJvZHksIGNvbnRleHQpKTtcbiAgICBpZiAoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCkge1xuICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5ib2R5LCBjb250ZXh0KTtcbiAgICB9XG4gICAgc3RtdC5tZXRob2RzLmZvckVhY2gobWV0aG9kID0+IHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKG1ldGhvZC5ib2R5LCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmZhbHNlQ2FzZSwgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRUcnlDYXRjaFN0bXQoc3RtdDogVHJ5Q2F0Y2hTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuYm9keVN0bXRzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNhdGNoU3RtdHMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IFRocm93U3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBzdG10LmVycm9yLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IENvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0SlNEb2NDb21tZW50U3RtdChzdG10OiBKU0RvY0NvbW1lbnRTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0QWxsU3RhdGVtZW50cyhzdG10czogU3RhdGVtZW50W10sIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIHN0bXRzLmZvckVhY2goc3RtdCA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQpKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZFJlYWRWYXJOYW1lcyhzdG10czogU3RhdGVtZW50W10pOiBTZXQ8c3RyaW5nPiB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX1JlYWRWYXJWaXNpdG9yKCk7XG4gIHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzLCBudWxsKTtcbiAgcmV0dXJuIHZpc2l0b3IudmFyTmFtZXM7XG59XG5cbmNsYXNzIF9SZWFkVmFyVmlzaXRvciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3Ige1xuICB2YXJOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICAvLyBEb24ndCBkZXNjZW5kIGludG8gbmVzdGVkIGZ1bmN0aW9uc1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gRG9uJ3QgZGVzY2VuZCBpbnRvIG5lc3RlZCBjbGFzc2VzXG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChhc3QubmFtZSkge1xuICAgICAgdGhpcy52YXJOYW1lcy5hZGQoYXN0Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdEV4dGVybmFsUmVmZXJlbmNlcyhzdG10czogU3RhdGVtZW50W10pOiBFeHRlcm5hbFJlZmVyZW5jZVtdIHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfRmluZEV4dGVybmFsUmVmZXJlbmNlc1Zpc2l0b3IoKTtcbiAgdmlzaXRvci52aXNpdEFsbFN0YXRlbWVudHMoc3RtdHMsIG51bGwpO1xuICByZXR1cm4gdmlzaXRvci5leHRlcm5hbFJlZmVyZW5jZXM7XG59XG5cbmNsYXNzIF9GaW5kRXh0ZXJuYWxSZWZlcmVuY2VzVmlzaXRvciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3Ige1xuICBleHRlcm5hbFJlZmVyZW5jZXM6IEV4dGVybmFsUmVmZXJlbmNlW10gPSBbXTtcbiAgdmlzaXRFeHRlcm5hbEV4cHIoZTogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLmV4dGVybmFsUmVmZXJlbmNlcy5wdXNoKGUudmFsdWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdEV4dGVybmFsRXhwcihlLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlTb3VyY2VTcGFuVG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICBzdG10OiBTdGF0ZW1lbnQsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogU3RhdGVtZW50IHtcbiAgaWYgKCFzb3VyY2VTcGFuKSB7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgX0FwcGx5U291cmNlU3BhblRyYW5zZm9ybWVyKHNvdXJjZVNwYW4pO1xuICByZXR1cm4gc3RtdC52aXNpdFN0YXRlbWVudCh0cmFuc2Zvcm1lciwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVNvdXJjZVNwYW5Ub0V4cHJlc3Npb25JZk5lZWRlZChcbiAgICBleHByOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEV4cHJlc3Npb24ge1xuICBpZiAoIXNvdXJjZVNwYW4pIHtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxuICBjb25zdCB0cmFuc2Zvcm1lciA9IG5ldyBfQXBwbHlTb3VyY2VTcGFuVHJhbnNmb3JtZXIoc291cmNlU3Bhbik7XG4gIHJldHVybiBleHByLnZpc2l0RXhwcmVzc2lvbih0cmFuc2Zvcm1lciwgbnVsbCk7XG59XG5cbmNsYXNzIF9BcHBseVNvdXJjZVNwYW5UcmFuc2Zvcm1lciBleHRlbmRzIEFzdFRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcigpO1xuICB9XG4gIHByaXZhdGUgX2Nsb25lKG9iajogYW55KTogYW55IHtcbiAgICBjb25zdCBjbG9uZSA9IE9iamVjdC5jcmVhdGUob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG4gICAgZm9yIChsZXQgcHJvcCBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgICBjbG9uZVtwcm9wXSA9IG9ialtwcm9wXTtcbiAgICB9XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG5cbiAgdHJhbnNmb3JtRXhwcihleHByOiBFeHByZXNzaW9uLCBjb250ZXh0OiBhbnkpOiBFeHByZXNzaW9uIHtcbiAgICBpZiAoIWV4cHIuc291cmNlU3Bhbikge1xuICAgICAgZXhwciA9IHRoaXMuX2Nsb25lKGV4cHIpO1xuICAgICAgZXhwci5zb3VyY2VTcGFuID0gdGhpcy5zb3VyY2VTcGFuO1xuICAgIH1cbiAgICByZXR1cm4gZXhwcjtcbiAgfVxuXG4gIHRyYW5zZm9ybVN0bXQoc3RtdDogU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBTdGF0ZW1lbnQge1xuICAgIGlmICghc3RtdC5zb3VyY2VTcGFuKSB7XG4gICAgICBzdG10ID0gdGhpcy5fY2xvbmUoc3RtdCk7XG4gICAgICBzdG10LnNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW47XG4gICAgfVxuICAgIHJldHVybiBzdG10O1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJpYWJsZShcbiAgICBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG5ldyBSZWFkVmFyRXhwcihuYW1lLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydEV4cHIoXG4gICAgaWQ6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlUGFyYW1zOiBUeXBlW118bnVsbCA9IG51bGwsXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXh0ZXJuYWxFeHByIHtcbiAgcmV0dXJuIG5ldyBFeHRlcm5hbEV4cHIoaWQsIG51bGwsIHR5cGVQYXJhbXMsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0VHlwZShcbiAgICBpZDogRXh0ZXJuYWxSZWZlcmVuY2UsIHR5cGVQYXJhbXM6IFR5cGVbXXxudWxsID0gbnVsbCxcbiAgICB0eXBlTW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXXxudWxsID0gbnVsbCk6IEV4cHJlc3Npb25UeXBlfG51bGwge1xuICByZXR1cm4gaWQgIT0gbnVsbCA/IGV4cHJlc3Npb25UeXBlKGltcG9ydEV4cHIoaWQsIHR5cGVQYXJhbXMsIG51bGwpLCB0eXBlTW9kaWZpZXJzKSA6IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHByZXNzaW9uVHlwZShcbiAgICBleHByOiBFeHByZXNzaW9uLCB0eXBlTW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXXxudWxsID0gbnVsbCxcbiAgICB0eXBlUGFyYW1zOiBUeXBlW118bnVsbCA9IG51bGwpOiBFeHByZXNzaW9uVHlwZSB7XG4gIHJldHVybiBuZXcgRXhwcmVzc2lvblR5cGUoZXhwciwgdHlwZU1vZGlmaWVycywgdHlwZVBhcmFtcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0eXBlb2ZFeHByKGV4cHI6IEV4cHJlc3Npb24pIHtcbiAgcmV0dXJuIG5ldyBUeXBlb2ZFeHByKGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbEFycihcbiAgICB2YWx1ZXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTGl0ZXJhbEFycmF5RXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5RXhwcih2YWx1ZXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbE1hcChcbiAgICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogRXhwcmVzc2lvbn1bXSxcbiAgICB0eXBlOiBNYXBUeXBlfG51bGwgPSBudWxsKTogTGl0ZXJhbE1hcEV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxNYXBFeHByKFxuICAgICAgdmFsdWVzLm1hcChlID0+IG5ldyBMaXRlcmFsTWFwRW50cnkoZS5rZXksIGUudmFsdWUsIGUucXVvdGVkKSksIHR5cGUsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5hcnkoXG4gICAgb3BlcmF0b3I6IFVuYXJ5T3BlcmF0b3IsIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFVuYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG5ldyBVbmFyeU9wZXJhdG9yRXhwcihvcGVyYXRvciwgZXhwciwgdHlwZSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3QoZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTm90RXhwciB7XG4gIHJldHVybiBuZXcgTm90RXhwcihleHByLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdE51bGwoZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQXNzZXJ0Tm90TnVsbCB7XG4gIHJldHVybiBuZXcgQXNzZXJ0Tm90TnVsbChleHByLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZuKFxuICAgIHBhcmFtczogRm5QYXJhbVtdLCBib2R5OiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIG5hbWU/OiBzdHJpbmd8bnVsbCk6IEZ1bmN0aW9uRXhwciB7XG4gIHJldHVybiBuZXcgRnVuY3Rpb25FeHByKHBhcmFtcywgYm9keSwgdHlwZSwgc291cmNlU3BhbiwgbmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpZlN0bXQoY29uZGl0aW9uOiBFeHByZXNzaW9uLCB0aGVuQ2xhdXNlOiBTdGF0ZW1lbnRbXSwgZWxzZUNsYXVzZT86IFN0YXRlbWVudFtdKSB7XG4gIHJldHVybiBuZXcgSWZTdG10KGNvbmRpdGlvbiwgdGhlbkNsYXVzZSwgZWxzZUNsYXVzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXRlcmFsKFxuICAgIHZhbHVlOiBhbnksIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IExpdGVyYWxFeHByIHtcbiAgcmV0dXJuIG5ldyBMaXRlcmFsRXhwcih2YWx1ZSwgdHlwZSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2NhbGl6ZWRTdHJpbmcoXG4gICAgbWV0YUJsb2NrOiBJMThuTWV0YSwgbWVzc2FnZVBhcnRzOiBMaXRlcmFsUGllY2VbXSwgcGxhY2Vob2xkZXJOYW1lczogUGxhY2Vob2xkZXJQaWVjZVtdLFxuICAgIGV4cHJlc3Npb25zOiBFeHByZXNzaW9uW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IExvY2FsaXplZFN0cmluZyB7XG4gIHJldHVybiBuZXcgTG9jYWxpemVkU3RyaW5nKG1ldGFCbG9jaywgbWVzc2FnZVBhcnRzLCBwbGFjZWhvbGRlck5hbWVzLCBleHByZXNzaW9ucywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc051bGwoZXhwOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiBleHAgaW5zdGFuY2VvZiBMaXRlcmFsRXhwciAmJiBleHAudmFsdWUgPT09IG51bGw7XG59XG5cbi8vIFRoZSBsaXN0IG9mIEpTRG9jIHRhZ3MgdGhhdCB3ZSBjdXJyZW50bHkgc3VwcG9ydC4gRXh0ZW5kIGl0IGlmIG5lZWRlZC5cbmV4cG9ydCBjb25zdCBlbnVtIEpTRG9jVGFnTmFtZSB7XG4gIERlc2MgPSAnZGVzYycsXG4gIElkID0gJ2lkJyxcbiAgTWVhbmluZyA9ICdtZWFuaW5nJyxcbn1cblxuLypcbiAqIFR5cGVTY3JpcHQgaGFzIGFuIEFQSSBmb3IgSlNEb2MgYWxyZWFkeSwgYnV0IGl0J3Mgbm90IGV4cG9zZWQuXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzczOTNcbiAqIEZvciBub3cgd2UgY3JlYXRlIHR5cGVzIHRoYXQgYXJlIHNpbWlsYXIgdG8gdGhlaXJzIHNvIHRoYXQgbWlncmF0aW5nXG4gKiB0byB0aGVpciBBUEkgd2lsbCBiZSBlYXNpZXIuIFNlZSBlLmcuIGB0cy5KU0RvY1RhZ2AgYW5kIGB0cy5KU0RvY0NvbW1lbnRgLlxuICovXG5leHBvcnQgdHlwZSBKU0RvY1RhZyA9IHtcbiAgLy8gYHRhZ05hbWVgIGlzIGUuZy4gXCJwYXJhbVwiIGluIGFuIGBAcGFyYW1gIGRlY2xhcmF0aW9uXG4gIHRhZ05hbWU6IEpTRG9jVGFnTmFtZXxzdHJpbmcsXG4gIC8vIEFueSByZW1haW5pbmcgdGV4dCBvbiB0aGUgdGFnLCBlLmcuIHRoZSBkZXNjcmlwdGlvblxuICB0ZXh0Pzogc3RyaW5nLFxufXx7XG4gIC8vIG5vIGB0YWdOYW1lYCBmb3IgcGxhaW4gdGV4dCBkb2N1bWVudGF0aW9uIHRoYXQgb2NjdXJzIGJlZm9yZSBhbnkgYEBwYXJhbWAgbGluZXNcbiAgdGFnTmFtZT86IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nLFxufTtcblxuLypcbiAqIFNlcmlhbGl6ZXMgYSBgVGFnYCBpbnRvIGEgc3RyaW5nLlxuICogUmV0dXJucyBhIHN0cmluZyBsaWtlIFwiIEBmb28ge2Jhcn0gYmF6XCIgKG5vdGUgdGhlIGxlYWRpbmcgd2hpdGVzcGFjZSBiZWZvcmUgYEBmb29gKS5cbiAqL1xuZnVuY3Rpb24gdGFnVG9TdHJpbmcodGFnOiBKU0RvY1RhZyk6IHN0cmluZyB7XG4gIGxldCBvdXQgPSAnJztcbiAgaWYgKHRhZy50YWdOYW1lKSB7XG4gICAgb3V0ICs9IGAgQCR7dGFnLnRhZ05hbWV9YDtcbiAgfVxuICBpZiAodGFnLnRleHQpIHtcbiAgICBpZiAodGFnLnRleHQubWF0Y2goL1xcL1xcKnxcXCpcXC8vKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdKU0RvYyB0ZXh0IGNhbm5vdCBjb250YWluIFwiLypcIiBhbmQgXCIqL1wiJyk7XG4gICAgfVxuICAgIG91dCArPSAnICcgKyB0YWcudGV4dC5yZXBsYWNlKC9AL2csICdcXFxcQCcpO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVRhZ3ModGFnczogSlNEb2NUYWdbXSk6IHN0cmluZyB7XG4gIGlmICh0YWdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xuXG4gIGxldCBvdXQgPSAnKlxcbic7XG4gIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICBvdXQgKz0gJyAqJztcbiAgICAvLyBJZiB0aGUgdGFnVG9TdHJpbmcgaXMgbXVsdGktbGluZSwgaW5zZXJ0IFwiICogXCIgcHJlZml4ZXMgb24gc3Vic2VxdWVudCBsaW5lcy5cbiAgICBvdXQgKz0gdGFnVG9TdHJpbmcodGFnKS5yZXBsYWNlKC9cXG4vZywgJ1xcbiAqICcpO1xuICAgIG91dCArPSAnXFxuJztcbiAgfVxuICBvdXQgKz0gJyAnO1xuICByZXR1cm4gb3V0O1xufVxuIl19