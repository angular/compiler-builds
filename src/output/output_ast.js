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
    exports.isNull = exports.localizedString = exports.literal = exports.taggedTemplate = exports.ifStmt = exports.fn = exports.assertNotNull = exports.not = exports.unary = exports.literalMap = exports.literalArr = exports.typeofExpr = exports.expressionType = exports.importType = exports.importExpr = exports.variable = exports.jsDocComment = exports.leadingComment = exports.applySourceSpanToExpressionIfNeeded = exports.applySourceSpanToStatementIfNeeded = exports.collectExternalReferences = exports.findReadVarNames = exports.RecursiveAstVisitor = exports.AstTransformer = exports.ThrowStmt = exports.TryCatchStmt = exports.IfStmt = exports.ClassStmt = exports.ClassGetter = exports.ClassMethod = exports.ClassField = exports.AbstractClassPart = exports.ReturnStatement = exports.ExpressionStatement = exports.DeclareFunctionStmt = exports.DeclareVarStmt = exports.Statement = exports.JSDocComment = exports.LeadingComment = exports.StmtModifier = exports.TYPED_NULL_EXPR = exports.NULL_EXPR = exports.CATCH_STACK_VAR = exports.CATCH_ERROR_VAR = exports.SUPER_EXPR = exports.THIS_EXPR = exports.CommaExpr = exports.LiteralMapExpr = exports.LiteralMapEntry = exports.LiteralArrayExpr = exports.ReadKeyExpr = exports.ReadPropExpr = exports.BinaryOperatorExpr = exports.UnaryOperatorExpr = exports.FunctionExpr = exports.FnParam = exports.CastExpr = exports.AssertNotNull = exports.NotExpr = exports.ConditionalExpr = exports.ExternalReference = exports.ExternalExpr = exports.LocalizedString = exports.PlaceholderPiece = exports.LiteralPiece = exports.MessagePiece = exports.TemplateLiteralElement = exports.TemplateLiteral = exports.LiteralExpr = exports.InstantiateExpr = exports.TaggedTemplateExpr = exports.InvokeFunctionExpr = exports.BuiltinMethod = exports.WritePropExpr = exports.WriteKeyExpr = exports.WriteVarExpr = exports.WrappedNodeExpr = exports.TypeofExpr = exports.ReadVarExpr = exports.BuiltinVar = exports.Expression = exports.areAllEquivalent = exports.nullSafeIsEquivalent = exports.BinaryOperator = exports.UnaryOperator = exports.NONE_TYPE = exports.FUNCTION_TYPE = exports.STRING_TYPE = exports.NUMBER_TYPE = exports.INT_TYPE = exports.BOOL_TYPE = exports.INFERRED_TYPE = exports.DYNAMIC_TYPE = exports.MapType = exports.ArrayType = exports.ExpressionType = exports.BuiltinType = exports.BuiltinTypeName = exports.Type = exports.TypeModifier = void 0;
    var tslib_1 = require("tslib");
    //// Types
    var TypeModifier;
    (function (TypeModifier) {
        TypeModifier[TypeModifier["Const"] = 0] = "Const";
    })(TypeModifier = exports.TypeModifier || (exports.TypeModifier = {}));
    var Type = /** @class */ (function () {
        function Type(modifiers) {
            if (modifiers === void 0) { modifiers = []; }
            this.modifiers = modifiers;
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
        (0, tslib_1.__extends)(BuiltinType, _super);
        function BuiltinType(name, modifiers) {
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
        (0, tslib_1.__extends)(ExpressionType, _super);
        function ExpressionType(value, modifiers, typeParams) {
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
        (0, tslib_1.__extends)(ArrayType, _super);
        function ArrayType(of, modifiers) {
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
        (0, tslib_1.__extends)(MapType, _super);
        function MapType(valueType, modifiers) {
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
        BinaryOperator[BinaryOperator["NullishCoalesce"] = 16] = "NullishCoalesce";
    })(BinaryOperator = exports.BinaryOperator || (exports.BinaryOperator = {}));
    function nullSafeIsEquivalent(base, other) {
        if (base == null || other == null) {
            return base == other;
        }
        return base.isEquivalent(other);
    }
    exports.nullSafeIsEquivalent = nullSafeIsEquivalent;
    function areAllEquivalentPredicate(base, other, equivalentPredicate) {
        var len = base.length;
        if (len !== other.length) {
            return false;
        }
        for (var i = 0; i < len; i++) {
            if (!equivalentPredicate(base[i], other[i])) {
                return false;
            }
        }
        return true;
    }
    function areAllEquivalent(base, other) {
        return areAllEquivalentPredicate(base, other, function (baseElement, otherElement) { return baseElement.isEquivalent(otherElement); });
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
        Expression.prototype.nullishCoalesce = function (rhs, sourceSpan) {
            return new BinaryOperatorExpr(BinaryOperator.NullishCoalesce, this, rhs, null, sourceSpan);
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
        (0, tslib_1.__extends)(ReadVarExpr, _super);
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
        (0, tslib_1.__extends)(TypeofExpr, _super);
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
        (0, tslib_1.__extends)(WrappedNodeExpr, _super);
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
        (0, tslib_1.__extends)(WriteVarExpr, _super);
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
        (0, tslib_1.__extends)(WriteKeyExpr, _super);
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
        (0, tslib_1.__extends)(WritePropExpr, _super);
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
    var InvokeFunctionExpr = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(InvokeFunctionExpr, _super);
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
    var TaggedTemplateExpr = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(TaggedTemplateExpr, _super);
        function TaggedTemplateExpr(tag, template, type, sourceSpan) {
            var _this = _super.call(this, type, sourceSpan) || this;
            _this.tag = tag;
            _this.template = template;
            return _this;
        }
        TaggedTemplateExpr.prototype.isEquivalent = function (e) {
            return e instanceof TaggedTemplateExpr && this.tag.isEquivalent(e.tag) &&
                areAllEquivalentPredicate(this.template.elements, e.template.elements, function (a, b) { return a.text === b.text; }) &&
                areAllEquivalent(this.template.expressions, e.template.expressions);
        };
        TaggedTemplateExpr.prototype.isConstant = function () {
            return false;
        };
        TaggedTemplateExpr.prototype.visitExpression = function (visitor, context) {
            return visitor.visitTaggedTemplateExpr(this, context);
        };
        return TaggedTemplateExpr;
    }(Expression));
    exports.TaggedTemplateExpr = TaggedTemplateExpr;
    var InstantiateExpr = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(InstantiateExpr, _super);
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
        (0, tslib_1.__extends)(LiteralExpr, _super);
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
    var TemplateLiteral = /** @class */ (function () {
        function TemplateLiteral(elements, expressions) {
            this.elements = elements;
            this.expressions = expressions;
        }
        return TemplateLiteral;
    }());
    exports.TemplateLiteral = TemplateLiteral;
    var TemplateLiteralElement = /** @class */ (function () {
        function TemplateLiteralElement(text, sourceSpan, rawText) {
            var _a;
            this.text = text;
            this.sourceSpan = sourceSpan;
            // If `rawText` is not provided, try to extract the raw string from its
            // associated `sourceSpan`. If that is also not available, "fake" the raw
            // string instead by escaping the following control sequences:
            // - "\" would otherwise indicate that the next character is a control character.
            // - "`" and "${" are template string control sequences that would otherwise prematurely
            // indicate the end of the template literal element.
            this.rawText =
                (_a = rawText !== null && rawText !== void 0 ? rawText : sourceSpan === null || sourceSpan === void 0 ? void 0 : sourceSpan.toString()) !== null && _a !== void 0 ? _a : escapeForTemplateLiteral(escapeSlashes(text));
        }
        return TemplateLiteralElement;
    }());
    exports.TemplateLiteralElement = TemplateLiteralElement;
    var MessagePiece = /** @class */ (function () {
        function MessagePiece(text, sourceSpan) {
            this.text = text;
            this.sourceSpan = sourceSpan;
        }
        return MessagePiece;
    }());
    exports.MessagePiece = MessagePiece;
    var LiteralPiece = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(LiteralPiece, _super);
        function LiteralPiece() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return LiteralPiece;
    }(MessagePiece));
    exports.LiteralPiece = LiteralPiece;
    var PlaceholderPiece = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(PlaceholderPiece, _super);
        function PlaceholderPiece() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return PlaceholderPiece;
    }(MessagePiece));
    exports.PlaceholderPiece = PlaceholderPiece;
    var LocalizedString = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(LocalizedString, _super);
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
            return createCookedRawString(metaBlock, this.messageParts[0].text, this.getMessagePartSourceSpan(0));
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
            return createCookedRawString(placeholderName, messagePart.text, this.getMessagePartSourceSpan(partIndex));
        };
        return LocalizedString;
    }(Expression));
    exports.LocalizedString = LocalizedString;
    var escapeSlashes = function (str) { return str.replace(/\\/g, '\\\\'); };
    var escapeStartingColon = function (str) { return str.replace(/^:/, '\\:'); };
    var escapeColons = function (str) { return str.replace(/:/g, '\\:'); };
    var escapeForTemplateLiteral = function (str) {
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
    function createCookedRawString(metaBlock, messagePart, range) {
        if (metaBlock === '') {
            return {
                cooked: messagePart,
                raw: escapeForTemplateLiteral(escapeStartingColon(escapeSlashes(messagePart))),
                range: range,
            };
        }
        else {
            return {
                cooked: ":" + metaBlock + ":" + messagePart,
                raw: escapeForTemplateLiteral(":" + escapeColons(escapeSlashes(metaBlock)) + ":" + escapeSlashes(messagePart)),
                range: range,
            };
        }
    }
    var ExternalExpr = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(ExternalExpr, _super);
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
        (0, tslib_1.__extends)(ConditionalExpr, _super);
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
        (0, tslib_1.__extends)(NotExpr, _super);
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
        (0, tslib_1.__extends)(AssertNotNull, _super);
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
        (0, tslib_1.__extends)(CastExpr, _super);
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
        (0, tslib_1.__extends)(FunctionExpr, _super);
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
            return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers, this.sourceSpan);
        };
        return FunctionExpr;
    }(Expression));
    exports.FunctionExpr = FunctionExpr;
    var UnaryOperatorExpr = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(UnaryOperatorExpr, _super);
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
        (0, tslib_1.__extends)(BinaryOperatorExpr, _super);
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
        (0, tslib_1.__extends)(ReadPropExpr, _super);
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
        (0, tslib_1.__extends)(ReadKeyExpr, _super);
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
        (0, tslib_1.__extends)(LiteralArrayExpr, _super);
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
        (0, tslib_1.__extends)(LiteralMapExpr, _super);
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
        (0, tslib_1.__extends)(CommaExpr, _super);
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
    var LeadingComment = /** @class */ (function () {
        function LeadingComment(text, multiline, trailingNewline) {
            this.text = text;
            this.multiline = multiline;
            this.trailingNewline = trailingNewline;
        }
        LeadingComment.prototype.toString = function () {
            return this.multiline ? " " + this.text + " " : this.text;
        };
        return LeadingComment;
    }());
    exports.LeadingComment = LeadingComment;
    var JSDocComment = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(JSDocComment, _super);
        function JSDocComment(tags) {
            var _this = _super.call(this, '', /* multiline */ true, /* trailingNewline */ true) || this;
            _this.tags = tags;
            return _this;
        }
        JSDocComment.prototype.toString = function () {
            return serializeTags(this.tags);
        };
        return JSDocComment;
    }(LeadingComment));
    exports.JSDocComment = JSDocComment;
    var Statement = /** @class */ (function () {
        function Statement(modifiers, sourceSpan, leadingComments) {
            if (modifiers === void 0) { modifiers = []; }
            if (sourceSpan === void 0) { sourceSpan = null; }
            this.modifiers = modifiers;
            this.sourceSpan = sourceSpan;
            this.leadingComments = leadingComments;
        }
        Statement.prototype.hasModifier = function (modifier) {
            return this.modifiers.indexOf(modifier) !== -1;
        };
        Statement.prototype.addLeadingComment = function (leadingComment) {
            var _a;
            this.leadingComments = (_a = this.leadingComments) !== null && _a !== void 0 ? _a : [];
            this.leadingComments.push(leadingComment);
        };
        return Statement;
    }());
    exports.Statement = Statement;
    var DeclareVarStmt = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(DeclareVarStmt, _super);
        function DeclareVarStmt(name, value, type, modifiers, sourceSpan, leadingComments) {
            var _this = _super.call(this, modifiers, sourceSpan, leadingComments) || this;
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
        (0, tslib_1.__extends)(DeclareFunctionStmt, _super);
        function DeclareFunctionStmt(name, params, statements, type, modifiers, sourceSpan, leadingComments) {
            var _this = _super.call(this, modifiers, sourceSpan, leadingComments) || this;
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
        (0, tslib_1.__extends)(ExpressionStatement, _super);
        function ExpressionStatement(expr, sourceSpan, leadingComments) {
            var _this = _super.call(this, [], sourceSpan, leadingComments) || this;
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
        (0, tslib_1.__extends)(ReturnStatement, _super);
        function ReturnStatement(value, sourceSpan, leadingComments) {
            if (sourceSpan === void 0) { sourceSpan = null; }
            var _this = _super.call(this, [], sourceSpan, leadingComments) || this;
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
            if (type === void 0) { type = null; }
            if (modifiers === void 0) { modifiers = []; }
            this.type = type;
            this.modifiers = modifiers;
        }
        AbstractClassPart.prototype.hasModifier = function (modifier) {
            return this.modifiers.indexOf(modifier) !== -1;
        };
        return AbstractClassPart;
    }());
    exports.AbstractClassPart = AbstractClassPart;
    var ClassField = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(ClassField, _super);
        function ClassField(name, type, modifiers, initializer) {
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
        (0, tslib_1.__extends)(ClassMethod, _super);
        function ClassMethod(name, params, body, type, modifiers) {
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
        (0, tslib_1.__extends)(ClassGetter, _super);
        function ClassGetter(name, body, type, modifiers) {
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
        (0, tslib_1.__extends)(ClassStmt, _super);
        function ClassStmt(name, parent, fields, getters, constructorMethod, methods, modifiers, sourceSpan, leadingComments) {
            var _this = _super.call(this, modifiers, sourceSpan, leadingComments) || this;
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
        (0, tslib_1.__extends)(IfStmt, _super);
        function IfStmt(condition, trueCase, falseCase, sourceSpan, leadingComments) {
            if (falseCase === void 0) { falseCase = []; }
            var _this = _super.call(this, [], sourceSpan, leadingComments) || this;
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
    var TryCatchStmt = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(TryCatchStmt, _super);
        function TryCatchStmt(bodyStmts, catchStmts, sourceSpan, leadingComments) {
            if (sourceSpan === void 0) { sourceSpan = null; }
            var _this = _super.call(this, [], sourceSpan, leadingComments) || this;
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
        (0, tslib_1.__extends)(ThrowStmt, _super);
        function ThrowStmt(error, sourceSpan, leadingComments) {
            if (sourceSpan === void 0) { sourceSpan = null; }
            var _this = _super.call(this, [], sourceSpan, leadingComments) || this;
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
        AstTransformer.prototype.visitInvokeFunctionExpr = function (ast, context) {
            return this.transformExpr(new InvokeFunctionExpr(ast.fn.visitExpression(this, context), this.visitAllExpressions(ast.args, context), ast.type, ast.sourceSpan), context);
        };
        AstTransformer.prototype.visitTaggedTemplateExpr = function (ast, context) {
            var _this = this;
            return this.transformExpr(new TaggedTemplateExpr(ast.tag.visitExpression(this, context), new TemplateLiteral(ast.template.elements, ast.template.expressions.map(function (e) { return e.visitExpression(_this, context); })), ast.type, ast.sourceSpan), context);
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
            var mapType = new MapType(ast.valueType);
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
            return this.transformStmt(new DeclareVarStmt(stmt.name, value, stmt.type, stmt.modifiers, stmt.sourceSpan, stmt.leadingComments), context);
        };
        AstTransformer.prototype.visitDeclareFunctionStmt = function (stmt, context) {
            return this.transformStmt(new DeclareFunctionStmt(stmt.name, stmt.params, this.visitAllStatements(stmt.statements, context), stmt.type, stmt.modifiers, stmt.sourceSpan, stmt.leadingComments), context);
        };
        AstTransformer.prototype.visitExpressionStmt = function (stmt, context) {
            return this.transformStmt(new ExpressionStatement(stmt.expr.visitExpression(this, context), stmt.sourceSpan, stmt.leadingComments), context);
        };
        AstTransformer.prototype.visitReturnStmt = function (stmt, context) {
            return this.transformStmt(new ReturnStatement(stmt.value.visitExpression(this, context), stmt.sourceSpan, stmt.leadingComments), context);
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
            return this.transformStmt(new IfStmt(stmt.condition.visitExpression(this, context), this.visitAllStatements(stmt.trueCase, context), this.visitAllStatements(stmt.falseCase, context), stmt.sourceSpan, stmt.leadingComments), context);
        };
        AstTransformer.prototype.visitTryCatchStmt = function (stmt, context) {
            return this.transformStmt(new TryCatchStmt(this.visitAllStatements(stmt.bodyStmts, context), this.visitAllStatements(stmt.catchStmts, context), stmt.sourceSpan, stmt.leadingComments), context);
        };
        AstTransformer.prototype.visitThrowStmt = function (stmt, context) {
            return this.transformStmt(new ThrowStmt(stmt.error.visitExpression(this, context), stmt.sourceSpan, stmt.leadingComments), context);
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
        RecursiveAstVisitor.prototype.visitInvokeFunctionExpr = function (ast, context) {
            ast.fn.visitExpression(this, context);
            this.visitAllExpressions(ast.args, context);
            return this.visitExpression(ast, context);
        };
        RecursiveAstVisitor.prototype.visitTaggedTemplateExpr = function (ast, context) {
            ast.tag.visitExpression(this, context);
            this.visitAllExpressions(ast.template.expressions, context);
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
        (0, tslib_1.__extends)(_ReadVarVisitor, _super);
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
        (0, tslib_1.__extends)(_FindExternalReferencesVisitor, _super);
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
        (0, tslib_1.__extends)(_ApplySourceSpanTransformer, _super);
        function _ApplySourceSpanTransformer(sourceSpan) {
            var _this = _super.call(this) || this;
            _this.sourceSpan = sourceSpan;
            return _this;
        }
        _ApplySourceSpanTransformer.prototype._clone = function (obj) {
            var e_1, _a;
            var clone = Object.create(obj.constructor.prototype);
            try {
                for (var _b = (0, tslib_1.__values)(Object.keys(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
    function leadingComment(text, multiline, trailingNewline) {
        if (multiline === void 0) { multiline = false; }
        if (trailingNewline === void 0) { trailingNewline = true; }
        return new LeadingComment(text, multiline, trailingNewline);
    }
    exports.leadingComment = leadingComment;
    function jsDocComment(tags) {
        if (tags === void 0) { tags = []; }
        return new JSDocComment(tags);
    }
    exports.jsDocComment = jsDocComment;
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
        return id != null ? expressionType(importExpr(id, typeParams, null), typeModifiers) : null;
    }
    exports.importType = importType;
    function expressionType(expr, typeModifiers, typeParams) {
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
    function ifStmt(condition, thenClause, elseClause, sourceSpan, leadingComments) {
        return new IfStmt(condition, thenClause, elseClause, sourceSpan, leadingComments);
    }
    exports.ifStmt = ifStmt;
    function taggedTemplate(tag, template, type, sourceSpan) {
        return new TaggedTemplateExpr(tag, template, type, sourceSpan);
    }
    exports.taggedTemplate = taggedTemplate;
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
        if (tags.length === 1 && tags[0].tagName && !tags[0].text) {
            // The JSDOC comment is a single simple tag: e.g `/** @tagname */`.
            return "*" + tagToString(tags[0]) + " ";
        }
        var out = '*\n';
        try {
            for (var tags_1 = (0, tslib_1.__values)(tags), tags_1_1 = tags_1.next(); !tags_1_1.done; tags_1_1 = tags_1.next()) {
                var tag = tags_1_1.value;
                out += ' *';
                // If the tagToString is multi-line, insert " * " prefixes on lines.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBS0gsVUFBVTtJQUNWLElBQVksWUFFWDtJQUZELFdBQVksWUFBWTtRQUN0QixpREFBSyxDQUFBO0lBQ1AsQ0FBQyxFQUZXLFlBQVksR0FBWixvQkFBWSxLQUFaLG9CQUFZLFFBRXZCO0lBRUQ7UUFDRSxjQUFtQixTQUE4QjtZQUE5QiwwQkFBQSxFQUFBLGNBQThCO1lBQTlCLGNBQVMsR0FBVCxTQUFTLENBQXFCO1FBQUcsQ0FBQztRQUdyRCwwQkFBVyxHQUFYLFVBQVksUUFBc0I7WUFDaEMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBQ0gsV0FBQztJQUFELENBQUMsQUFQRCxJQU9DO0lBUHFCLG9CQUFJO0lBUzFCLElBQVksZUFTWDtJQVRELFdBQVksZUFBZTtRQUN6QiwyREFBTyxDQUFBO1FBQ1AscURBQUksQ0FBQTtRQUNKLHlEQUFNLENBQUE7UUFDTixtREFBRyxDQUFBO1FBQ0gseURBQU0sQ0FBQTtRQUNOLDZEQUFRLENBQUE7UUFDUiw2REFBUSxDQUFBO1FBQ1IscURBQUksQ0FBQTtJQUNOLENBQUMsRUFUVyxlQUFlLEdBQWYsdUJBQWUsS0FBZix1QkFBZSxRQVMxQjtJQUVEO1FBQWlDLDRDQUFJO1FBQ25DLHFCQUFtQixJQUFxQixFQUFFLFNBQTBCO1lBQXBFLFlBQ0Usa0JBQU0sU0FBUyxDQUFDLFNBQ2pCO1lBRmtCLFVBQUksR0FBSixJQUFJLENBQWlCOztRQUV4QyxDQUFDO1FBQ1EsK0JBQVMsR0FBbEIsVUFBbUIsT0FBb0IsRUFBRSxPQUFZO1lBQ25ELE9BQU8sT0FB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RSxVQUFpQztZQUN2RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ0QsOEJBQVMsR0FBVCxVQUFVLEdBQWUsRUFBRSxVQUFpQztZQUMxRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBQ0QsOEJBQVMsR0FBVCxVQUFVLEdBQWUsRUFBRSxVQUFpQztZQUMxRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBQ0QsaUNBQVksR0FBWixVQUFhLEdBQWUsRUFBRSxVQUFpQztZQUM3RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMxRixDQUFDO1FBQ0QsMEJBQUssR0FBTCxVQUFNLEdBQWUsRUFBRSxVQUFpQztZQUN0RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNuRixDQUFDO1FBQ0QseUJBQUksR0FBSixVQUFLLEdBQWUsRUFBRSxVQUFpQztZQUNyRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBQ0QsMkJBQU0sR0FBTixVQUFPLEdBQWUsRUFBRSxVQUFpQztZQUN2RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ0QsNkJBQVEsR0FBUixVQUFTLEdBQWUsRUFBRSxVQUFpQztZQUN6RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBQ0QsMkJBQU0sR0FBTixVQUFPLEdBQWUsRUFBRSxVQUFpQztZQUN2RCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ0Qsd0JBQUcsR0FBSCxVQUFJLEdBQWUsRUFBRSxVQUFpQztZQUNwRCxPQUFPLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNqRixDQUFDO1FBQ0QsK0JBQVUsR0FBVixVQUFXLEdBQWUsRUFBRSxVQUFpQyxFQUFFLE1BQXNCO1lBQXRCLHVCQUFBLEVBQUEsYUFBc0I7WUFFbkYsT0FBTyxJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2hHLENBQUM7UUFDRCx1QkFBRSxHQUFGLFVBQUcsR0FBZSxFQUFFLFVBQWlDO1lBQ25ELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2hGLENBQUM7UUFDRCwwQkFBSyxHQUFMLFVBQU0sR0FBZSxFQUFFLFVBQWlDO1lBQ3RELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFDRCxnQ0FBVyxHQUFYLFVBQVksR0FBZSxFQUFFLFVBQWlDO1lBQzVELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3pGLENBQUM7UUFDRCwyQkFBTSxHQUFOLFVBQU8sR0FBZSxFQUFFLFVBQWlDO1lBQ3ZELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3BGLENBQUM7UUFDRCxpQ0FBWSxHQUFaLFVBQWEsR0FBZSxFQUFFLFVBQWlDO1lBQzdELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzFGLENBQUM7UUFDRCw0QkFBTyxHQUFQLFVBQVEsVUFBaUM7WUFDdkMsOEVBQThFO1lBQzlFLG1FQUFtRTtZQUNuRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsdUJBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0QseUJBQUksR0FBSixVQUFLLElBQVUsRUFBRSxVQUFpQztZQUNoRCxPQUFPLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUNELG9DQUFlLEdBQWYsVUFBZ0IsR0FBZSxFQUFFLFVBQWlDO1lBQ2hFLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsZUFBZSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzdGLENBQUM7UUFFRCwyQkFBTSxHQUFOO1lBQ0UsT0FBTyxJQUFJLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBQ0gsaUJBQUM7SUFBRCxDQUFDLEFBOUdELElBOEdDO0lBOUdxQixnQ0FBVTtJQWdIaEMsSUFBWSxVQUtYO0lBTEQsV0FBWSxVQUFVO1FBQ3BCLDJDQUFJLENBQUE7UUFDSiw2Q0FBSyxDQUFBO1FBQ0wsdURBQVUsQ0FBQTtRQUNWLHVEQUFVLENBQUE7SUFDWixDQUFDLEVBTFcsVUFBVSxHQUFWLGtCQUFVLEtBQVYsa0JBQVUsUUFLckI7SUFFRDtRQUFpQyw0Q0FBVTtRQUl6QyxxQkFBWSxJQUF1QixFQUFFLElBQWdCLEVBQUUsVUFBaUM7WUFBeEYsWUFDRSxrQkFBTSxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBUXhCO1lBUEMsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQzVCLEtBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixLQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQzthQUNyQjtpQkFBTTtnQkFDTCxLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztnQkFDakIsS0FBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7YUFDckI7O1FBQ0gsQ0FBQztRQUVRLGtDQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksV0FBVyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUM7UUFDeEYsQ0FBQztRQUVRLGdDQUFVLEdBQW5CO1lBQ0UsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRVEscUNBQWUsR0FBeEIsVUFBeUIsT0FBMEIsRUFBRSxPQUFZO1lBQy9ELE9BQU8sT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBRUQseUJBQUcsR0FBSCxVQUFJLEtBQWlCO1lBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXFCLElBQUksQ0FBQyxPQUFPLDZCQUEwQixDQUFDLENBQUM7YUFDOUU7WUFDRCxPQUFPLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNILGtCQUFDO0lBQUQsQ0FBQyxBQWpDRCxDQUFpQyxVQUFVLEdBaUMxQztJQWpDWSxrQ0FBVztJQW1DeEI7UUFBZ0MsMkNBQVU7UUFDeEMsb0JBQW1CLElBQWdCLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztZQUF4RixZQUNFLGtCQUFNLElBQUksRUFBRSxVQUFVLENBQUMsU0FDeEI7WUFGa0IsVUFBSSxHQUFKLElBQUksQ0FBWTs7UUFFbkMsQ0FBQztRQUVRLG9DQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFFUSxpQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLFVBQVUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUVRLCtCQUFVLEdBQW5CO1lBQ0UsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2hDLENBQUM7UUFDSCxpQkFBQztJQUFELENBQUMsQUFoQkQsQ0FBZ0MsVUFBVSxHQWdCekM7SUFoQlksZ0NBQVU7SUFrQnZCO1FBQXdDLGdEQUFVO1FBQ2hELHlCQUFtQixJQUFPLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztZQUEvRSxZQUNFLGtCQUFNLElBQUksRUFBRSxVQUFVLENBQUMsU0FDeEI7WUFGa0IsVUFBSSxHQUFKLElBQUksQ0FBRzs7UUFFMUIsQ0FBQztRQUVRLHNDQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksZUFBZSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQztRQUM5RCxDQUFDO1FBRVEsb0NBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSx5Q0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFDSCxzQkFBQztJQUFELENBQUMsQUFoQkQsQ0FBd0MsVUFBVSxHQWdCakQ7SUFoQlksMENBQWU7SUFrQjVCO1FBQWtDLDZDQUFVO1FBRTFDLHNCQUNXLElBQVksRUFBRSxLQUFpQixFQUFFLElBQWdCLEVBQUUsVUFBaUM7WUFEL0YsWUFFRSxrQkFBTSxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsU0FFdEM7WUFIVSxVQUFJLEdBQUosSUFBSSxDQUFRO1lBRXJCLEtBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDOztRQUNyQixDQUFDO1FBRVEsbUNBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxZQUFZLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvRixDQUFDO1FBRVEsaUNBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSxzQ0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFFRCxpQ0FBVSxHQUFWLFVBQVcsSUFBZ0IsRUFBRSxTQUEwQjtZQUNyRCxPQUFPLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyRixDQUFDO1FBRUQsa0NBQVcsR0FBWDtZQUNFLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxxQkFBYSxFQUFFLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQTNCRCxDQUFrQyxVQUFVLEdBMkIzQztJQTNCWSxvQ0FBWTtJQThCekI7UUFBa0MsNkNBQVU7UUFFMUMsc0JBQ1csUUFBb0IsRUFBUyxLQUFpQixFQUFFLEtBQWlCLEVBQUUsSUFBZ0IsRUFDMUYsVUFBaUM7WUFGckMsWUFHRSxrQkFBTSxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsU0FFdEM7WUFKVSxjQUFRLEdBQVIsUUFBUSxDQUFZO1lBQVMsV0FBSyxHQUFMLEtBQUssQ0FBWTtZQUd2RCxLQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQzs7UUFDckIsQ0FBQztRQUVRLG1DQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksWUFBWSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ3RFLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0UsQ0FBQztRQUVRLGlDQUFVLEdBQW5CO1lBQ0UsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRVEsc0NBQWUsR0FBeEIsVUFBeUIsT0FBMEIsRUFBRSxPQUFZO1lBQy9ELE9BQU8sT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBckJELENBQWtDLFVBQVUsR0FxQjNDO0lBckJZLG9DQUFZO0lBd0J6QjtRQUFtQyw4Q0FBVTtRQUUzQyx1QkFDVyxRQUFvQixFQUFTLElBQVksRUFBRSxLQUFpQixFQUFFLElBQWdCLEVBQ3JGLFVBQWlDO1lBRnJDLFlBR0Usa0JBQU0sSUFBSSxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBRXRDO1lBSlUsY0FBUSxHQUFSLFFBQVEsQ0FBWTtZQUFTLFVBQUksR0FBSixJQUFJLENBQVE7WUFHbEQsS0FBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7O1FBQ3JCLENBQUM7UUFFUSxvQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLGFBQWEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUN2RSxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFUSxrQ0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLHVDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUNILG9CQUFDO0lBQUQsQ0FBQyxBQXJCRCxDQUFtQyxVQUFVLEdBcUI1QztJQXJCWSxzQ0FBYTtJQXVCMUIsSUFBWSxhQUlYO0lBSkQsV0FBWSxhQUFhO1FBQ3ZCLCtEQUFXLENBQUE7UUFDWCwrRUFBbUIsQ0FBQTtRQUNuQixpREFBSSxDQUFBO0lBQ04sQ0FBQyxFQUpXLGFBQWEsR0FBYixxQkFBYSxLQUFiLHFCQUFhLFFBSXhCO0lBRUQ7UUFBd0MsbURBQVU7UUFDaEQsNEJBQ1csRUFBYyxFQUFTLElBQWtCLEVBQUUsSUFBZ0IsRUFDbEUsVUFBaUMsRUFBUyxJQUFZO1lBQVoscUJBQUEsRUFBQSxZQUFZO1lBRjFELFlBR0Usa0JBQU0sSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUN4QjtZQUhVLFFBQUUsR0FBRixFQUFFLENBQVk7WUFBUyxVQUFJLEdBQUosSUFBSSxDQUFjO1lBQ04sVUFBSSxHQUFKLElBQUksQ0FBUTs7UUFFMUQsQ0FBQztRQUVRLHlDQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksa0JBQWtCLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDaEUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ2xFLENBQUM7UUFFUSx1Q0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLDRDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUNILHlCQUFDO0lBQUQsQ0FBQyxBQW5CRCxDQUF3QyxVQUFVLEdBbUJqRDtJQW5CWSxnREFBa0I7SUFzQi9CO1FBQXdDLG1EQUFVO1FBQ2hELDRCQUNXLEdBQWUsRUFBUyxRQUF5QixFQUFFLElBQWdCLEVBQzFFLFVBQWlDO1lBRnJDLFlBR0Usa0JBQU0sSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUN4QjtZQUhVLFNBQUcsR0FBSCxHQUFHLENBQVk7WUFBUyxjQUFRLEdBQVIsUUFBUSxDQUFpQjs7UUFHNUQsQ0FBQztRQUVRLHlDQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksa0JBQWtCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztnQkFDbEUseUJBQXlCLENBQ2xCLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSyxPQUFBLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBakIsQ0FBaUIsQ0FBQztnQkFDaEYsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRVEsdUNBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSw0Q0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFDSCx5QkFBQztJQUFELENBQUMsQUFyQkQsQ0FBd0MsVUFBVSxHQXFCakQ7SUFyQlksZ0RBQWtCO0lBd0IvQjtRQUFxQyxnREFBVTtRQUM3Qyx5QkFDVyxTQUFxQixFQUFTLElBQWtCLEVBQUUsSUFBZ0IsRUFDekUsVUFBaUM7WUFGckMsWUFHRSxrQkFBTSxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBQ3hCO1lBSFUsZUFBUyxHQUFULFNBQVMsQ0FBWTtZQUFTLFVBQUksR0FBSixJQUFJLENBQWM7O1FBRzNELENBQUM7UUFFUSxzQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLGVBQWUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUMzRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRVEsb0NBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSx5Q0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFDSCxzQkFBQztJQUFELENBQUMsQUFuQkQsQ0FBcUMsVUFBVSxHQW1COUM7SUFuQlksMENBQWU7SUFzQjVCO1FBQWlDLDRDQUFVO1FBQ3pDLHFCQUNXLEtBQTJDLEVBQUUsSUFBZ0IsRUFDcEUsVUFBaUM7WUFGckMsWUFHRSxrQkFBTSxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBQ3hCO1lBSFUsV0FBSyxHQUFMLEtBQUssQ0FBc0M7O1FBR3RELENBQUM7UUFFUSxrQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLFdBQVcsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDNUQsQ0FBQztRQUVRLGdDQUFVLEdBQW5CO1lBQ0UsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRVEscUNBQWUsR0FBeEIsVUFBeUIsT0FBMEIsRUFBRSxPQUFZO1lBQy9ELE9BQU8sT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBQ0gsa0JBQUM7SUFBRCxDQUFDLEFBbEJELENBQWlDLFVBQVUsR0FrQjFDO0lBbEJZLGtDQUFXO0lBb0J4QjtRQUNFLHlCQUFtQixRQUFrQyxFQUFTLFdBQXlCO1lBQXBFLGFBQVEsR0FBUixRQUFRLENBQTBCO1lBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFBRyxDQUFDO1FBQzdGLHNCQUFDO0lBQUQsQ0FBQyxBQUZELElBRUM7SUFGWSwwQ0FBZTtJQUc1QjtRQUVFLGdDQUFtQixJQUFZLEVBQVMsVUFBNEIsRUFBRSxPQUFnQjs7WUFBbkUsU0FBSSxHQUFKLElBQUksQ0FBUTtZQUFTLGVBQVUsR0FBVixVQUFVLENBQWtCO1lBQ2xFLHVFQUF1RTtZQUN2RSx5RUFBeUU7WUFDekUsOERBQThEO1lBQzlELGlGQUFpRjtZQUNqRix3RkFBd0Y7WUFDeEYsb0RBQW9EO1lBQ3BELElBQUksQ0FBQyxPQUFPO2dCQUNSLE1BQUEsT0FBTyxhQUFQLE9BQU8sY0FBUCxPQUFPLEdBQUksVUFBVSxhQUFWLFVBQVUsdUJBQVYsVUFBVSxDQUFFLFFBQVEsRUFBRSxtQ0FBSSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN6RixDQUFDO1FBQ0gsNkJBQUM7SUFBRCxDQUFDLEFBWkQsSUFZQztJQVpZLHdEQUFzQjtJQWNuQztRQUNFLHNCQUFtQixJQUFZLEVBQVMsVUFBMkI7WUFBaEQsU0FBSSxHQUFKLElBQUksQ0FBUTtZQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQUcsQ0FBQztRQUN6RSxtQkFBQztJQUFELENBQUMsQUFGRCxJQUVDO0lBRnFCLG9DQUFZO0lBR2xDO1FBQWtDLDZDQUFZO1FBQTlDOztRQUFnRCxDQUFDO1FBQUQsbUJBQUM7SUFBRCxDQUFDLEFBQWpELENBQWtDLFlBQVksR0FBRztJQUFwQyxvQ0FBWTtJQUN6QjtRQUFzQyxpREFBWTtRQUFsRDs7UUFBb0QsQ0FBQztRQUFELHVCQUFDO0lBQUQsQ0FBQyxBQUFyRCxDQUFzQyxZQUFZLEdBQUc7SUFBeEMsNENBQWdCO0lBRTdCO1FBQXFDLGdEQUFVO1FBQzdDLHlCQUNhLFNBQW1CLEVBQVcsWUFBNEIsRUFDMUQsZ0JBQW9DLEVBQVcsV0FBeUIsRUFDakYsVUFBaUM7WUFIckMsWUFJRSxrQkFBTSxtQkFBVyxFQUFFLFVBQVUsQ0FBQyxTQUMvQjtZQUpZLGVBQVMsR0FBVCxTQUFTLENBQVU7WUFBVyxrQkFBWSxHQUFaLFlBQVksQ0FBZ0I7WUFDMUQsc0JBQWdCLEdBQWhCLGdCQUFnQixDQUFvQjtZQUFXLGlCQUFXLEdBQVgsV0FBVyxDQUFjOztRQUdyRixDQUFDO1FBRVEsc0NBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxxRUFBcUU7WUFDckUsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRVEsb0NBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSx5Q0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRDs7Ozs7OztXQU9HO1FBQ0gsMkNBQWlCLEdBQWpCO1lBQ0UsSUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUM7WUFDOUIsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO1lBQzFCLElBQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUFDO1lBRWhDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQztZQUNqRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFO2dCQUMxQixTQUFTLEdBQUcsS0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxpQkFBaUIsR0FBRyxTQUFXLENBQUM7YUFDekU7WUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFO2dCQUMzQixTQUFTLEdBQUcsS0FBRyxTQUFTLEdBQUcsWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBVSxDQUFDO2FBQ3JFO1lBQ0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRTtnQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUEsUUFBUTtvQkFDdkMsU0FBUyxHQUFHLEtBQUcsU0FBUyxHQUFHLG1CQUFtQixHQUFHLFFBQVUsQ0FBQztnQkFDOUQsQ0FBQyxDQUFDLENBQUM7YUFDSjtZQUNELE9BQU8scUJBQXFCLENBQ3hCLFNBQVMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRUQsa0RBQXdCLEdBQXhCLFVBQXlCLENBQVM7O1lBQ2hDLE9BQU8sTUFBQSxNQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLDBDQUFFLFVBQVUsbUNBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUM3RCxDQUFDO1FBRUQsa0RBQXdCLEdBQXhCLFVBQXlCLENBQVM7O1lBQ2hDLE9BQU8sTUFBQSxNQUFBLE1BQUEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQywwQ0FBRSxVQUFVLG1DQUFJLE1BQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsMENBQUUsVUFBVSxtQ0FDMUUsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUN0QixDQUFDO1FBRUQ7Ozs7OztXQU1HO1FBQ0gsbURBQXlCLEdBQXpCLFVBQTBCLFNBQWlCO1lBQ3pDLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2xFLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakQsT0FBTyxxQkFBcUIsQ0FDeEIsZUFBZSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDbkYsQ0FBQztRQUNILHNCQUFDO0lBQUQsQ0FBQyxBQXhFRCxDQUFxQyxVQUFVLEdBd0U5QztJQXhFWSwwQ0FBZTtJQW9GNUIsSUFBTSxhQUFhLEdBQUcsVUFBQyxHQUFXLElBQWEsT0FBQSxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsRUFBMUIsQ0FBMEIsQ0FBQztJQUMxRSxJQUFNLG1CQUFtQixHQUFHLFVBQUMsR0FBVyxJQUFhLE9BQUEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQXhCLENBQXdCLENBQUM7SUFDOUUsSUFBTSxZQUFZLEdBQUcsVUFBQyxHQUFXLElBQWEsT0FBQSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsRUFBeEIsQ0FBd0IsQ0FBQztJQUN2RSxJQUFNLHdCQUF3QixHQUFHLFVBQUMsR0FBVztRQUN6QyxPQUFBLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDO0lBQWhELENBQWdELENBQUM7SUFFckQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNILFNBQVMscUJBQXFCLENBQzFCLFNBQWlCLEVBQUUsV0FBbUIsRUFBRSxLQUEyQjtRQUNyRSxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7WUFDcEIsT0FBTztnQkFDTCxNQUFNLEVBQUUsV0FBVztnQkFDbkIsR0FBRyxFQUFFLHdCQUF3QixDQUFDLG1CQUFtQixDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUM5RSxLQUFLLE9BQUE7YUFDTixDQUFDO1NBQ0g7YUFBTTtZQUNMLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLE1BQUksU0FBUyxTQUFJLFdBQWE7Z0JBQ3RDLEdBQUcsRUFBRSx3QkFBd0IsQ0FDekIsTUFBSSxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQUksYUFBYSxDQUFDLFdBQVcsQ0FBRyxDQUFDO2dCQUMvRSxLQUFLLE9BQUE7YUFDTixDQUFDO1NBQ0g7SUFDSCxDQUFDO0lBRUQ7UUFBa0MsNkNBQVU7UUFDMUMsc0JBQ1csS0FBd0IsRUFBRSxJQUFnQixFQUFTLFVBQThCLEVBQ3hGLFVBQWlDO1lBRHlCLDJCQUFBLEVBQUEsaUJBQThCO1lBRDVGLFlBR0Usa0JBQU0sSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUN4QjtZQUhVLFdBQUssR0FBTCxLQUFLLENBQW1CO1lBQTJCLGdCQUFVLEdBQVYsVUFBVSxDQUFvQjs7UUFHNUYsQ0FBQztRQUVRLG1DQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksWUFBWSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSTtnQkFDaEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDN0YsQ0FBQztRQUVRLGlDQUFVLEdBQW5CO1lBQ0UsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRVEsc0NBQWUsR0FBeEIsVUFBeUIsT0FBMEIsRUFBRSxPQUFZO1lBQy9ELE9BQU8sT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBbkJELENBQWtDLFVBQVUsR0FtQjNDO0lBbkJZLG9DQUFZO0lBcUJ6QjtRQUNFLDJCQUFtQixVQUF1QixFQUFTLElBQWlCLEVBQVMsT0FBa0I7WUFBNUUsZUFBVSxHQUFWLFVBQVUsQ0FBYTtZQUFTLFNBQUksR0FBSixJQUFJLENBQWE7WUFBUyxZQUFPLEdBQVAsT0FBTyxDQUFXO1FBQy9GLENBQUM7UUFFSCx3QkFBQztJQUFELENBQUMsQUFKRCxJQUlDO0lBSlksOENBQWlCO0lBTTlCO1FBQXFDLGdEQUFVO1FBRzdDLHlCQUNXLFNBQXFCLEVBQUUsUUFBb0IsRUFBUyxTQUFpQyxFQUM1RixJQUFnQixFQUFFLFVBQWlDO1lBRFEsMEJBQUEsRUFBQSxnQkFBaUM7WUFEaEcsWUFHRSxrQkFBTSxJQUFJLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsU0FFekM7WUFKVSxlQUFTLEdBQVQsU0FBUyxDQUFZO1lBQStCLGVBQVMsR0FBVCxTQUFTLENBQXdCO1lBRzlGLEtBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDOztRQUMzQixDQUFDO1FBRVEsc0NBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxlQUFlLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztnQkFDM0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLG9CQUFvQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xHLENBQUM7UUFFUSxvQ0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLHlDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckQsQ0FBQztRQUNILHNCQUFDO0lBQUQsQ0FBQyxBQXRCRCxDQUFxQyxVQUFVLEdBc0I5QztJQXRCWSwwQ0FBZTtJQXlCNUI7UUFBNkIsd0NBQVU7UUFDckMsaUJBQW1CLFNBQXFCLEVBQUUsVUFBaUM7WUFBM0UsWUFDRSxrQkFBTSxpQkFBUyxFQUFFLFVBQVUsQ0FBQyxTQUM3QjtZQUZrQixlQUFTLEdBQVQsU0FBUyxDQUFZOztRQUV4QyxDQUFDO1FBRVEsOEJBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxPQUFPLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFFUSw0QkFBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLGlDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFDSCxjQUFDO0lBQUQsQ0FBQyxBQWhCRCxDQUE2QixVQUFVLEdBZ0J0QztJQWhCWSwwQkFBTztJQWtCcEI7UUFBbUMsOENBQVU7UUFDM0MsdUJBQW1CLFNBQXFCLEVBQUUsVUFBaUM7WUFBM0UsWUFDRSxrQkFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUNsQztZQUZrQixlQUFTLEdBQVQsU0FBUyxDQUFZOztRQUV4QyxDQUFDO1FBRVEsb0NBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxhQUFhLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hGLENBQUM7UUFFUSxrQ0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLHVDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkQsQ0FBQztRQUNILG9CQUFDO0lBQUQsQ0FBQyxBQWhCRCxDQUFtQyxVQUFVLEdBZ0I1QztJQWhCWSxzQ0FBYTtJQWtCMUI7UUFBOEIseUNBQVU7UUFDdEMsa0JBQW1CLEtBQWlCLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztZQUF6RixZQUNFLGtCQUFNLElBQUksRUFBRSxVQUFVLENBQUMsU0FDeEI7WUFGa0IsV0FBSyxHQUFMLEtBQUssQ0FBWTs7UUFFcEMsQ0FBQztRQUVRLCtCQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksUUFBUSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBRVEsNkJBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSxrQ0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5QyxDQUFDO1FBQ0gsZUFBQztJQUFELENBQUMsQUFoQkQsQ0FBOEIsVUFBVSxHQWdCdkM7SUFoQlksNEJBQVE7SUFtQnJCO1FBQ0UsaUJBQW1CLElBQVksRUFBUyxJQUFzQjtZQUF0QixxQkFBQSxFQUFBLFdBQXNCO1lBQTNDLFNBQUksR0FBSixJQUFJLENBQVE7WUFBUyxTQUFJLEdBQUosSUFBSSxDQUFrQjtRQUFHLENBQUM7UUFFbEUsOEJBQVksR0FBWixVQUFhLEtBQWM7WUFDekIsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDbEMsQ0FBQztRQUNILGNBQUM7SUFBRCxDQUFDLEFBTkQsSUFNQztJQU5ZLDBCQUFPO0lBU3BCO1FBQWtDLDZDQUFVO1FBQzFDLHNCQUNXLE1BQWlCLEVBQVMsVUFBdUIsRUFBRSxJQUFnQixFQUMxRSxVQUFpQyxFQUFTLElBQWtCO1lBRmhFLFlBR0Usa0JBQU0sSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUN4QjtZQUhVLFlBQU0sR0FBTixNQUFNLENBQVc7WUFBUyxnQkFBVSxHQUFWLFVBQVUsQ0FBYTtZQUNkLFVBQUksR0FBSixJQUFJLENBQWM7O1FBRWhFLENBQUM7UUFFUSxtQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLFlBQVksSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUM7Z0JBQ3ZFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFUSxpQ0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLHNDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUVELGlDQUFVLEdBQVYsVUFBVyxJQUFZLEVBQUUsU0FBMEI7WUFDakQsT0FBTyxJQUFJLG1CQUFtQixDQUMxQixJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNqRixDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBeEJELENBQWtDLFVBQVUsR0F3QjNDO0lBeEJZLG9DQUFZO0lBMkJ6QjtRQUF1QyxrREFBVTtRQUMvQywyQkFDVyxRQUF1QixFQUFTLElBQWdCLEVBQUUsSUFBZ0IsRUFDekUsVUFBaUMsRUFBUyxNQUFzQjtZQUF0Qix1QkFBQSxFQUFBLGFBQXNCO1lBRnBFLFlBR0Usa0JBQU0sSUFBSSxJQUFJLG1CQUFXLEVBQUUsVUFBVSxDQUFDLFNBQ3ZDO1lBSFUsY0FBUSxHQUFSLFFBQVEsQ0FBZTtZQUFTLFVBQUksR0FBSixJQUFJLENBQVk7WUFDYixZQUFNLEdBQU4sTUFBTSxDQUFnQjs7UUFFcEUsQ0FBQztRQUVRLHdDQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksaUJBQWlCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxDQUFDLENBQUMsUUFBUTtnQkFDakUsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFFUSxzQ0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLDJDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkQsQ0FBQztRQUNILHdCQUFDO0lBQUQsQ0FBQyxBQW5CRCxDQUF1QyxVQUFVLEdBbUJoRDtJQW5CWSw4Q0FBaUI7SUFzQjlCO1FBQXdDLG1EQUFVO1FBRWhELDRCQUNXLFFBQXdCLEVBQUUsR0FBZSxFQUFTLEdBQWUsRUFBRSxJQUFnQixFQUMxRixVQUFpQyxFQUFTLE1BQXNCO1lBQXRCLHVCQUFBLEVBQUEsYUFBc0I7WUFGcEUsWUFHRSxrQkFBTSxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsU0FFcEM7WUFKVSxjQUFRLEdBQVIsUUFBUSxDQUFnQjtZQUEwQixTQUFHLEdBQUgsR0FBRyxDQUFZO1lBQzlCLFlBQU0sR0FBTixNQUFNLENBQWdCO1lBRWxFLEtBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDOztRQUNqQixDQUFDO1FBRVEseUNBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxrQkFBa0IsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQyxRQUFRO2dCQUNsRSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFFUSx1Q0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLDRDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUNILHlCQUFDO0lBQUQsQ0FBQyxBQXJCRCxDQUF3QyxVQUFVLEdBcUJqRDtJQXJCWSxnREFBa0I7SUF3Qi9CO1FBQWtDLDZDQUFVO1FBQzFDLHNCQUNXLFFBQW9CLEVBQVMsSUFBWSxFQUFFLElBQWdCLEVBQ2xFLFVBQWlDO1lBRnJDLFlBR0Usa0JBQU0sSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUN4QjtZQUhVLGNBQVEsR0FBUixRQUFRLENBQVk7WUFBUyxVQUFJLEdBQUosSUFBSSxDQUFROztRQUdwRCxDQUFDO1FBRVEsbUNBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxZQUFZLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDdEUsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQzNCLENBQUM7UUFFUSxpQ0FBVSxHQUFuQjtZQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVRLHNDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUVELDBCQUFHLEdBQUgsVUFBSSxLQUFpQjtZQUNuQixPQUFPLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuRixDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBdkJELENBQWtDLFVBQVUsR0F1QjNDO0lBdkJZLG9DQUFZO0lBMEJ6QjtRQUFpQyw0Q0FBVTtRQUN6QyxxQkFDVyxRQUFvQixFQUFTLEtBQWlCLEVBQUUsSUFBZ0IsRUFDdkUsVUFBaUM7WUFGckMsWUFHRSxrQkFBTSxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBQ3hCO1lBSFUsY0FBUSxHQUFSLFFBQVEsQ0FBWTtZQUFTLFdBQUssR0FBTCxLQUFLLENBQVk7O1FBR3pELENBQUM7UUFFUSxrQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLFdBQVcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUNyRSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUVRLGdDQUFVLEdBQW5CO1lBQ0UsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRVEscUNBQWUsR0FBeEIsVUFBeUIsT0FBMEIsRUFBRSxPQUFZO1lBQy9ELE9BQU8sT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBRUQseUJBQUcsR0FBSCxVQUFJLEtBQWlCO1lBQ25CLE9BQU8sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFDSCxrQkFBQztJQUFELENBQUMsQUF2QkQsQ0FBaUMsVUFBVSxHQXVCMUM7SUF2Qlksa0NBQVc7SUEwQnhCO1FBQXNDLGlEQUFVO1FBRTlDLDBCQUFZLE9BQXFCLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztZQUF0RixZQUNFLGtCQUFNLElBQUksRUFBRSxVQUFVLENBQUMsU0FFeEI7WUFEQyxLQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQzs7UUFDekIsQ0FBQztRQUVRLHFDQUFVLEdBQW5CO1lBQ0UsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBZCxDQUFjLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBRVEsdUNBQVksR0FBckIsVUFBc0IsQ0FBYTtZQUNqQyxPQUFPLENBQUMsWUFBWSxnQkFBZ0IsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ1EsMENBQWUsR0FBeEIsVUFBeUIsT0FBMEIsRUFBRSxPQUFZO1lBQy9ELE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBQ0gsdUJBQUM7SUFBRCxDQUFDLEFBakJELENBQXNDLFVBQVUsR0FpQi9DO0lBakJZLDRDQUFnQjtJQW1CN0I7UUFDRSx5QkFBbUIsR0FBVyxFQUFTLEtBQWlCLEVBQVMsTUFBZTtZQUE3RCxRQUFHLEdBQUgsR0FBRyxDQUFRO1lBQVMsVUFBSyxHQUFMLEtBQUssQ0FBWTtZQUFTLFdBQU0sR0FBTixNQUFNLENBQVM7UUFBRyxDQUFDO1FBQ3BGLHNDQUFZLEdBQVosVUFBYSxDQUFrQjtZQUM3QixPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEUsQ0FBQztRQUNILHNCQUFDO0lBQUQsQ0FBQyxBQUxELElBS0M7SUFMWSwwQ0FBZTtJQU81QjtRQUFvQywrQ0FBVTtRQUU1Qyx3QkFDVyxPQUEwQixFQUFFLElBQW1CLEVBQUUsVUFBaUM7WUFEN0YsWUFFRSxrQkFBTSxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBSXhCO1lBTFUsYUFBTyxHQUFQLE9BQU8sQ0FBbUI7WUFGOUIsZUFBUyxHQUFjLElBQUksQ0FBQztZQUlqQyxJQUFJLElBQUksRUFBRTtnQkFDUixLQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakM7O1FBQ0gsQ0FBQztRQUVRLHFDQUFZLEdBQXJCLFVBQXNCLENBQWE7WUFDakMsT0FBTyxDQUFDLFlBQVksY0FBYyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xGLENBQUM7UUFFUSxtQ0FBVSxHQUFuQjtZQUNFLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxFQUFwQixDQUFvQixDQUFDLENBQUM7UUFDdkQsQ0FBQztRQUVRLHdDQUFlLEdBQXhCLFVBQXlCLE9BQTBCLEVBQUUsT0FBWTtZQUMvRCxPQUFPLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDcEQsQ0FBQztRQUNILHFCQUFDO0lBQUQsQ0FBQyxBQXJCRCxDQUFvQyxVQUFVLEdBcUI3QztJQXJCWSx3Q0FBYztJQXVCM0I7UUFBK0IsMENBQVU7UUFDdkMsbUJBQW1CLEtBQW1CLEVBQUUsVUFBaUM7WUFBekUsWUFDRSxrQkFBTSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBQ2hEO1lBRmtCLFdBQUssR0FBTCxLQUFLLENBQWM7O1FBRXRDLENBQUM7UUFFUSxnQ0FBWSxHQUFyQixVQUFzQixDQUFhO1lBQ2pDLE9BQU8sQ0FBQyxZQUFZLFNBQVMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRVEsOEJBQVUsR0FBbkI7WUFDRSxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFUSxtQ0FBZSxHQUF4QixVQUF5QixPQUEwQixFQUFFLE9BQVk7WUFDL0QsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQ0gsZ0JBQUM7SUFBRCxDQUFDLEFBaEJELENBQStCLFVBQVUsR0FnQnhDO0lBaEJZLDhCQUFTO0lBNkNULFFBQUEsU0FBUyxHQUFHLElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pELFFBQUEsVUFBVSxHQUFHLElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzNELFFBQUEsZUFBZSxHQUFHLElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3JFLFFBQUEsZUFBZSxHQUFHLElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3JFLFFBQUEsU0FBUyxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDOUMsUUFBQSxlQUFlLEdBQUcsSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLHFCQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFMUUsZUFBZTtJQUNmLElBQVksWUFLWDtJQUxELFdBQVksWUFBWTtRQUN0QixpREFBSyxDQUFBO1FBQ0wscURBQU8sQ0FBQTtRQUNQLHVEQUFRLENBQUE7UUFDUixtREFBTSxDQUFBO0lBQ1IsQ0FBQyxFQUxXLFlBQVksR0FBWixvQkFBWSxLQUFaLG9CQUFZLFFBS3ZCO0lBRUQ7UUFDRSx3QkFBbUIsSUFBWSxFQUFTLFNBQWtCLEVBQVMsZUFBd0I7WUFBeEUsU0FBSSxHQUFKLElBQUksQ0FBUTtZQUFTLGNBQVMsR0FBVCxTQUFTLENBQVM7WUFBUyxvQkFBZSxHQUFmLGVBQWUsQ0FBUztRQUFHLENBQUM7UUFDL0YsaUNBQVEsR0FBUjtZQUNFLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBSSxJQUFJLENBQUMsSUFBSSxNQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdkQsQ0FBQztRQUNILHFCQUFDO0lBQUQsQ0FBQyxBQUxELElBS0M7SUFMWSx3Q0FBYztJQU0zQjtRQUFrQyw2Q0FBYztRQUM5QyxzQkFBbUIsSUFBZ0I7WUFBbkMsWUFDRSxrQkFBTSxFQUFFLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsU0FDNUQ7WUFGa0IsVUFBSSxHQUFKLElBQUksQ0FBWTs7UUFFbkMsQ0FBQztRQUNRLCtCQUFRLEdBQWpCO1lBQ0UsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFDSCxtQkFBQztJQUFELENBQUMsQUFQRCxDQUFrQyxjQUFjLEdBTy9DO0lBUFksb0NBQVk7SUFTekI7UUFDRSxtQkFDVyxTQUE4QixFQUFTLFVBQXVDLEVBQzlFLGVBQWtDO1lBRGxDLDBCQUFBLEVBQUEsY0FBOEI7WUFBUywyQkFBQSxFQUFBLGlCQUF1QztZQUE5RSxjQUFTLEdBQVQsU0FBUyxDQUFxQjtZQUFTLGVBQVUsR0FBVixVQUFVLENBQTZCO1lBQzlFLG9CQUFlLEdBQWYsZUFBZSxDQUFtQjtRQUFHLENBQUM7UUFTakQsK0JBQVcsR0FBWCxVQUFZLFFBQXNCO1lBQ2hDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUVELHFDQUFpQixHQUFqQixVQUFrQixjQUE4Qjs7WUFDOUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFBLElBQUksQ0FBQyxlQUFlLG1DQUFJLEVBQUUsQ0FBQztZQUNsRCxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0gsZ0JBQUM7SUFBRCxDQUFDLEFBcEJELElBb0JDO0lBcEJxQiw4QkFBUztJQXVCL0I7UUFBb0MsK0NBQVM7UUFFM0Msd0JBQ1csSUFBWSxFQUFTLEtBQWtCLEVBQUUsSUFBZ0IsRUFBRSxTQUEwQixFQUM1RixVQUFpQyxFQUFFLGVBQWtDO1lBRnpFLFlBR0Usa0JBQU0sU0FBUyxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUMsU0FFOUM7WUFKVSxVQUFJLEdBQUosSUFBSSxDQUFRO1lBQVMsV0FBSyxHQUFMLEtBQUssQ0FBYTtZQUdoRCxLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDOztRQUNwRCxDQUFDO1FBQ1EscUNBQVksR0FBckIsVUFBc0IsSUFBZTtZQUNuQyxPQUFPLElBQUksWUFBWSxjQUFjLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSTtnQkFDNUQsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFDUSx1Q0FBYyxHQUF2QixVQUF3QixPQUF5QixFQUFFLE9BQVk7WUFDN0QsT0FBTyxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3BELENBQUM7UUFDSCxxQkFBQztJQUFELENBQUMsQUFmRCxDQUFvQyxTQUFTLEdBZTVDO0lBZlksd0NBQWM7SUFpQjNCO1FBQXlDLG9EQUFTO1FBRWhELDZCQUNXLElBQVksRUFBUyxNQUFpQixFQUFTLFVBQXVCLEVBQzdFLElBQWdCLEVBQUUsU0FBMEIsRUFBRSxVQUFpQyxFQUMvRSxlQUFrQztZQUh0QyxZQUlFLGtCQUFNLFNBQVMsRUFBRSxVQUFVLEVBQUUsZUFBZSxDQUFDLFNBRTlDO1lBTFUsVUFBSSxHQUFKLElBQUksQ0FBUTtZQUFTLFlBQU0sR0FBTixNQUFNLENBQVc7WUFBUyxnQkFBVSxHQUFWLFVBQVUsQ0FBYTtZQUkvRSxLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJLENBQUM7O1FBQzNCLENBQUM7UUFDUSwwQ0FBWSxHQUFyQixVQUFzQixJQUFlO1lBQ25DLE9BQU8sSUFBSSxZQUFZLG1CQUFtQixJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDcEYsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNRLDRDQUFjLEdBQXZCLFVBQXdCLE9BQXlCLEVBQUUsT0FBWTtZQUM3RCxPQUFPLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNILDBCQUFDO0lBQUQsQ0FBQyxBQWhCRCxDQUF5QyxTQUFTLEdBZ0JqRDtJQWhCWSxrREFBbUI7SUFrQmhDO1FBQXlDLG9EQUFTO1FBQ2hELDZCQUNXLElBQWdCLEVBQUUsVUFBaUMsRUFDMUQsZUFBa0M7WUFGdEMsWUFHRSxrQkFBTSxFQUFFLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQyxTQUN2QztZQUhVLFVBQUksR0FBSixJQUFJLENBQVk7O1FBRzNCLENBQUM7UUFDUSwwQ0FBWSxHQUFyQixVQUFzQixJQUFlO1lBQ25DLE9BQU8sSUFBSSxZQUFZLG1CQUFtQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBQ1EsNENBQWMsR0FBdkIsVUFBd0IsT0FBeUIsRUFBRSxPQUFZO1lBQzdELE9BQU8sT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNwRCxDQUFDO1FBQ0gsMEJBQUM7SUFBRCxDQUFDLEFBWkQsQ0FBeUMsU0FBUyxHQVlqRDtJQVpZLGtEQUFtQjtJQWVoQztRQUFxQyxnREFBUztRQUM1Qyx5QkFDVyxLQUFpQixFQUFFLFVBQXVDLEVBQ2pFLGVBQWtDO1lBRFIsMkJBQUEsRUFBQSxpQkFBdUM7WUFEckUsWUFHRSxrQkFBTSxFQUFFLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQyxTQUN2QztZQUhVLFdBQUssR0FBTCxLQUFLLENBQVk7O1FBRzVCLENBQUM7UUFDUSxzQ0FBWSxHQUFyQixVQUFzQixJQUFlO1lBQ25DLE9BQU8sSUFBSSxZQUFZLGVBQWUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUNRLHdDQUFjLEdBQXZCLFVBQXdCLE9BQXlCLEVBQUUsT0FBWTtZQUM3RCxPQUFPLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDSCxzQkFBQztJQUFELENBQUMsQUFaRCxDQUFxQyxTQUFTLEdBWTdDO0lBWlksMENBQWU7SUFjNUI7UUFDRSwyQkFBbUIsSUFBc0IsRUFBUyxTQUE4QjtZQUE3RCxxQkFBQSxFQUFBLFdBQXNCO1lBQVMsMEJBQUEsRUFBQSxjQUE4QjtZQUE3RCxTQUFJLEdBQUosSUFBSSxDQUFrQjtZQUFTLGNBQVMsR0FBVCxTQUFTLENBQXFCO1FBQUcsQ0FBQztRQUNwRix1Q0FBVyxHQUFYLFVBQVksUUFBc0I7WUFDaEMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBQ0gsd0JBQUM7SUFBRCxDQUFDLEFBTEQsSUFLQztJQUxZLDhDQUFpQjtJQU85QjtRQUFnQywyQ0FBaUI7UUFDL0Msb0JBQ1csSUFBWSxFQUFFLElBQWdCLEVBQUUsU0FBMEIsRUFDMUQsV0FBd0I7WUFGbkMsWUFHRSxrQkFBTSxJQUFJLEVBQUUsU0FBUyxDQUFDLFNBQ3ZCO1lBSFUsVUFBSSxHQUFKLElBQUksQ0FBUTtZQUNaLGlCQUFXLEdBQVgsV0FBVyxDQUFhOztRQUVuQyxDQUFDO1FBQ0QsaUNBQVksR0FBWixVQUFhLENBQWE7WUFDeEIsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDOUIsQ0FBQztRQUNILGlCQUFDO0lBQUQsQ0FBQyxBQVRELENBQWdDLGlCQUFpQixHQVNoRDtJQVRZLGdDQUFVO0lBWXZCO1FBQWlDLDRDQUFpQjtRQUNoRCxxQkFDVyxJQUFpQixFQUFTLE1BQWlCLEVBQVMsSUFBaUIsRUFDNUUsSUFBZ0IsRUFBRSxTQUEwQjtZQUZoRCxZQUdFLGtCQUFNLElBQUksRUFBRSxTQUFTLENBQUMsU0FDdkI7WUFIVSxVQUFJLEdBQUosSUFBSSxDQUFhO1lBQVMsWUFBTSxHQUFOLE1BQU0sQ0FBVztZQUFTLFVBQUksR0FBSixJQUFJLENBQWE7O1FBR2hGLENBQUM7UUFDRCxrQ0FBWSxHQUFaLFVBQWEsQ0FBYztZQUN6QixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBQ0gsa0JBQUM7SUFBRCxDQUFDLEFBVEQsQ0FBaUMsaUJBQWlCLEdBU2pEO0lBVFksa0NBQVc7SUFZeEI7UUFBaUMsNENBQWlCO1FBQ2hELHFCQUNXLElBQVksRUFBUyxJQUFpQixFQUFFLElBQWdCLEVBQUUsU0FBMEI7WUFEL0YsWUFFRSxrQkFBTSxJQUFJLEVBQUUsU0FBUyxDQUFDLFNBQ3ZCO1lBRlUsVUFBSSxHQUFKLElBQUksQ0FBUTtZQUFTLFVBQUksR0FBSixJQUFJLENBQWE7O1FBRWpELENBQUM7UUFDRCxrQ0FBWSxHQUFaLFVBQWEsQ0FBYztZQUN6QixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBQ0gsa0JBQUM7SUFBRCxDQUFDLEFBUkQsQ0FBaUMsaUJBQWlCLEdBUWpEO0lBUlksa0NBQVc7SUFXeEI7UUFBK0IsMENBQVM7UUFDdEMsbUJBQ1csSUFBWSxFQUFTLE1BQXVCLEVBQVMsTUFBb0IsRUFDekUsT0FBc0IsRUFBUyxpQkFBOEIsRUFDN0QsT0FBc0IsRUFBRSxTQUEwQixFQUFFLFVBQWlDLEVBQzVGLGVBQWtDO1lBSnRDLFlBS0Usa0JBQU0sU0FBUyxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUMsU0FDOUM7WUFMVSxVQUFJLEdBQUosSUFBSSxDQUFRO1lBQVMsWUFBTSxHQUFOLE1BQU0sQ0FBaUI7WUFBUyxZQUFNLEdBQU4sTUFBTSxDQUFjO1lBQ3pFLGFBQU8sR0FBUCxPQUFPLENBQWU7WUFBUyx1QkFBaUIsR0FBakIsaUJBQWlCLENBQWE7WUFDN0QsYUFBTyxHQUFQLE9BQU8sQ0FBZTs7UUFHakMsQ0FBQztRQUNRLGdDQUFZLEdBQXJCLFVBQXNCLElBQWU7WUFDbkMsT0FBTyxJQUFJLFlBQVksU0FBUyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUk7Z0JBQ3ZELG9CQUFvQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDOUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUMxQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7Z0JBQzVDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDO2dCQUMzRCxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRCxDQUFDO1FBQ1Esa0NBQWMsR0FBdkIsVUFBd0IsT0FBeUIsRUFBRSxPQUFZO1lBQzdELE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBQ0gsZ0JBQUM7SUFBRCxDQUFDLEFBbkJELENBQStCLFNBQVMsR0FtQnZDO0lBbkJZLDhCQUFTO0lBc0J0QjtRQUE0Qix1Q0FBUztRQUNuQyxnQkFDVyxTQUFxQixFQUFTLFFBQXFCLEVBQ25ELFNBQTJCLEVBQUUsVUFBaUMsRUFDckUsZUFBa0M7WUFEM0IsMEJBQUEsRUFBQSxjQUEyQjtZQUZ0QyxZQUlFLGtCQUFNLEVBQUUsRUFBRSxVQUFVLEVBQUUsZUFBZSxDQUFDLFNBQ3ZDO1lBSlUsZUFBUyxHQUFULFNBQVMsQ0FBWTtZQUFTLGNBQVEsR0FBUixRQUFRLENBQWE7WUFDbkQsZUFBUyxHQUFULFNBQVMsQ0FBa0I7O1FBR3RDLENBQUM7UUFDUSw2QkFBWSxHQUFyQixVQUFzQixJQUFlO1lBQ25DLE9BQU8sSUFBSSxZQUFZLE1BQU0sSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN4RSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQzlDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDUSwrQkFBYyxHQUF2QixVQUF3QixPQUF5QixFQUFFLE9BQVk7WUFDN0QsT0FBTyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0gsYUFBQztJQUFELENBQUMsQUFmRCxDQUE0QixTQUFTLEdBZXBDO0lBZlksd0JBQU07SUFpQm5CO1FBQWtDLDZDQUFTO1FBQ3pDLHNCQUNXLFNBQXNCLEVBQVMsVUFBdUIsRUFDN0QsVUFBdUMsRUFBRSxlQUFrQztZQUEzRSwyQkFBQSxFQUFBLGlCQUF1QztZQUYzQyxZQUdFLGtCQUFNLEVBQUUsRUFBRSxVQUFVLEVBQUUsZUFBZSxDQUFDLFNBQ3ZDO1lBSFUsZUFBUyxHQUFULFNBQVMsQ0FBYTtZQUFTLGdCQUFVLEdBQVYsVUFBVSxDQUFhOztRQUdqRSxDQUFDO1FBQ1EsbUNBQVksR0FBckIsVUFBc0IsSUFBZTtZQUNuQyxPQUFPLElBQUksWUFBWSxZQUFZLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNuRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBQ1EscUNBQWMsR0FBdkIsVUFBd0IsT0FBeUIsRUFBRSxPQUFZO1lBQzdELE9BQU8sT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBYkQsQ0FBa0MsU0FBUyxHQWExQztJQWJZLG9DQUFZO0lBZ0J6QjtRQUErQiwwQ0FBUztRQUN0QyxtQkFDVyxLQUFpQixFQUFFLFVBQXVDLEVBQ2pFLGVBQWtDO1lBRFIsMkJBQUEsRUFBQSxpQkFBdUM7WUFEckUsWUFHRSxrQkFBTSxFQUFFLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQyxTQUN2QztZQUhVLFdBQUssR0FBTCxLQUFLLENBQVk7O1FBRzVCLENBQUM7UUFDUSxnQ0FBWSxHQUFyQixVQUFzQixJQUFlO1lBQ25DLE9BQU8sSUFBSSxZQUFZLFlBQVksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUNRLGtDQUFjLEdBQXZCLFVBQXdCLE9BQXlCLEVBQUUsT0FBWTtZQUM3RCxPQUFPLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFDSCxnQkFBQztJQUFELENBQUMsQUFaRCxDQUErQixTQUFTLEdBWXZDO0lBWlksOEJBQVM7SUF5QnRCO1FBQUE7UUEyUEEsQ0FBQztRQTFQQyxzQ0FBYSxHQUFiLFVBQWMsSUFBZ0IsRUFBRSxPQUFZO1lBQzFDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELHNDQUFhLEdBQWIsVUFBYyxJQUFlLEVBQUUsT0FBWTtZQUN6QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCx5Q0FBZ0IsR0FBaEIsVUFBaUIsR0FBZ0IsRUFBRSxPQUFZO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUVELDZDQUFvQixHQUFwQixVQUFxQixHQUF5QixFQUFFLE9BQVk7WUFDMUQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsd0NBQWUsR0FBZixVQUFnQixJQUFnQixFQUFFLE9BQVk7WUFDNUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQ3BGLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsQ0FBQztRQUVELDBDQUFpQixHQUFqQixVQUFrQixJQUFrQixFQUFFLE9BQVk7WUFDaEQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLFlBQVksQ0FDWixJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFDckYsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsMENBQWlCLEdBQWpCLFVBQWtCLElBQWtCLEVBQUUsT0FBWTtZQUNoRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLElBQUksWUFBWSxDQUNaLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQ3ZGLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFDMUUsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsMkNBQWtCLEdBQWxCLFVBQW1CLElBQW1CLEVBQUUsT0FBWTtZQUNsRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLElBQUksYUFBYSxDQUNiLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUN2RCxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQzFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsQ0FBQztRQUVELGdEQUF1QixHQUF2QixVQUF3QixHQUF1QixFQUFFLE9BQVk7WUFDM0QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLGtCQUFrQixDQUNsQixHQUFHLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQ2xGLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUM3QixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCxnREFBdUIsR0FBdkIsVUFBd0IsR0FBdUIsRUFBRSxPQUFZO1lBQTdELGlCQVNDO1lBUkMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLGtCQUFrQixDQUNsQixHQUFHLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQ3RDLElBQUksZUFBZSxDQUNmLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUNyQixHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFDLElBQUssT0FBQSxDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUksRUFBRSxPQUFPLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDLEVBQzFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUM3QixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCw2Q0FBb0IsR0FBcEIsVUFBcUIsR0FBb0IsRUFBRSxPQUFZO1lBQ3JELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxlQUFlLENBQ2YsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUM1QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFDMUUsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQseUNBQWdCLEdBQWhCLFVBQWlCLEdBQWdCLEVBQUUsT0FBWTtZQUM3QyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzFDLENBQUM7UUFFRCw2Q0FBb0IsR0FBcEIsVUFBcUIsR0FBb0IsRUFBRSxPQUFZO1lBQ3JELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxlQUFlLENBQ2YsR0FBRyxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxnQkFBZ0IsRUFDckQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUN2RSxPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCwwQ0FBaUIsR0FBakIsVUFBa0IsR0FBaUIsRUFBRSxPQUFZO1lBQy9DLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUVELDZDQUFvQixHQUFwQixVQUFxQixHQUFvQixFQUFFLE9BQVk7WUFDckQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLGVBQWUsQ0FDZixHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQzVDLEdBQUcsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFDM0MsR0FBRyxDQUFDLFNBQVUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUM1RSxPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCxxQ0FBWSxHQUFaLFVBQWEsR0FBWSxFQUFFLE9BQVk7WUFDckMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzFGLENBQUM7UUFFRCwrQ0FBc0IsR0FBdEIsVUFBdUIsR0FBa0IsRUFBRSxPQUFZO1lBQ3JELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNoRyxDQUFDO1FBRUQsc0NBQWEsR0FBYixVQUFjLEdBQWEsRUFBRSxPQUFZO1lBQ3ZDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pHLENBQUM7UUFFRCwwQ0FBaUIsR0FBakIsVUFBa0IsR0FBaUIsRUFBRSxPQUFZO1lBQy9DLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxZQUFZLENBQ1osR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFDM0YsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsK0NBQXNCLEdBQXRCLFVBQXVCLEdBQXNCLEVBQUUsT0FBWTtZQUN6RCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLElBQUksaUJBQWlCLENBQ2pCLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUNwRixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCxnREFBdUIsR0FBdkIsVUFBd0IsR0FBdUIsRUFBRSxPQUFZO1lBQzNELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxrQkFBa0IsQ0FDbEIsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQ3BELEdBQUcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFDckUsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsMENBQWlCLEdBQWpCLFVBQWtCLEdBQWlCLEVBQUUsT0FBWTtZQUMvQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLElBQUksWUFBWSxDQUNaLEdBQUcsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUNwRixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCx5Q0FBZ0IsR0FBaEIsVUFBaUIsR0FBZ0IsRUFBRSxPQUFZO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxXQUFXLENBQ1gsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFDckYsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQzdCLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsQ0FBQztRQUVELDhDQUFxQixHQUFyQixVQUFzQixHQUFxQixFQUFFLE9BQVk7WUFDdkQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLGdCQUFnQixDQUNoQixJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFDN0UsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsNENBQW1CLEdBQW5CLFVBQW9CLEdBQW1CLEVBQUUsT0FBWTtZQUFyRCxpQkFNQztZQUxDLElBQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUMzQixVQUFDLEtBQUssSUFBc0IsT0FBQSxJQUFJLGVBQWUsQ0FDM0MsS0FBSyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUQ1QyxDQUM0QyxDQUFDLENBQUM7WUFDOUUsSUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzNDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMzRixDQUFDO1FBQ0QsdUNBQWMsR0FBZCxVQUFlLEdBQWMsRUFBRSxPQUFZO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVGLENBQUM7UUFDRCw0Q0FBbUIsR0FBbkIsVUFBMEMsS0FBVSxFQUFFLE9BQVk7WUFBbEUsaUJBRUM7WUFEQyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUksRUFBRSxPQUFPLENBQUMsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFFRCw0Q0FBbUIsR0FBbkIsVUFBb0IsSUFBb0IsRUFBRSxPQUFZO1lBQ3BELElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3RFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxjQUFjLENBQ2QsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUN2RixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFDRCxpREFBd0IsR0FBeEIsVUFBeUIsSUFBeUIsRUFBRSxPQUFZO1lBQzlELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxtQkFBbUIsQ0FDbkIsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQ3BGLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQzFELE9BQU8sQ0FBQyxDQUFDO1FBQ2YsQ0FBQztRQUVELDRDQUFtQixHQUFuQixVQUFvQixJQUF5QixFQUFFLE9BQVk7WUFDekQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLG1CQUFtQixDQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQ3BGLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsQ0FBQztRQUVELHdDQUFlLEdBQWYsVUFBZ0IsSUFBcUIsRUFBRSxPQUFZO1lBQ2pELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxlQUFlLENBQ2YsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUNyRixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCw4Q0FBcUIsR0FBckIsVUFBc0IsSUFBZSxFQUFFLE9BQVk7WUFBbkQsaUJBbUJDO1lBbEJDLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFPLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMzRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FDNUIsVUFBQSxNQUFNLElBQUksT0FBQSxJQUFJLFdBQVcsQ0FDckIsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUN2RSxNQUFNLENBQUMsU0FBUyxDQUFDLEVBRlgsQ0FFVyxDQUFDLENBQUM7WUFDM0IsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGlCQUFpQjtnQkFDckMsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUMxRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFDN0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDbkYsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQzVCLFVBQUEsTUFBTSxJQUFJLE9BQUEsSUFBSSxXQUFXLENBQ3JCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxLQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUN0RixNQUFNLENBQUMsU0FBUyxDQUFDLEVBRlgsQ0FFVyxDQUFDLENBQUM7WUFDM0IsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixJQUFJLFNBQVMsQ0FDVCxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQzVFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFDcEIsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsb0NBQVcsR0FBWCxVQUFZLElBQVksRUFBRSxPQUFZO1lBQ3BDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxNQUFNLENBQ04sSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUM3QyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsRUFDL0MsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFDakUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUN6QixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCwwQ0FBaUIsR0FBakIsVUFBa0IsSUFBa0IsRUFBRSxPQUFZO1lBQ2hELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxZQUFZLENBQ1osSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLEVBQ2hELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQ2xFLElBQUksQ0FBQyxlQUFlLENBQUMsRUFDekIsT0FBTyxDQUFDLENBQUM7UUFDZixDQUFDO1FBRUQsdUNBQWMsR0FBZCxVQUFlLElBQWUsRUFBRSxPQUFZO1lBQzFDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsSUFBSSxTQUFTLENBQ1QsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUNyRixPQUFPLENBQUMsQ0FBQztRQUNmLENBQUM7UUFFRCwyQ0FBa0IsR0FBbEIsVUFBbUIsS0FBa0IsRUFBRSxPQUFZO1lBQW5ELGlCQUVDO1lBREMsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFJLEVBQUUsT0FBTyxDQUFDLEVBQWxDLENBQWtDLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQ0gscUJBQUM7SUFBRCxDQUFDLEFBM1BELElBMlBDO0lBM1BZLHdDQUFjO0lBOFAzQjtRQUFBO1FBd0xBLENBQUM7UUF2TEMsdUNBQVMsR0FBVCxVQUFVLEdBQVMsRUFBRSxPQUFZO1lBQy9CLE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQztRQUNELDZDQUFlLEdBQWYsVUFBZ0IsR0FBZSxFQUFFLE9BQVk7WUFDM0MsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO2dCQUNaLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNuQztZQUNELE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQztRQUNELDhDQUFnQixHQUFoQixVQUFpQixJQUFpQixFQUFFLE9BQVk7WUFDOUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsaURBQW1CLEdBQW5CLFVBQW9CLElBQW9CLEVBQUUsT0FBWTtZQUF0RCxpQkFNQztZQUxDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMxQyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUM1QixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxFQUE5QixDQUE4QixDQUFDLENBQUM7YUFDbEU7WUFDRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCw0Q0FBYyxHQUFkLFVBQWUsSUFBZSxFQUFFLE9BQVk7WUFDMUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsMENBQVksR0FBWixVQUFhLElBQWEsRUFBRSxPQUFZO1lBQ3RDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUNELGtEQUFvQixHQUFwQixVQUFxQixHQUF5QixFQUFFLE9BQVk7WUFDMUQsT0FBTyxHQUFHLENBQUM7UUFDYixDQUFDO1FBQ0QsNkNBQWUsR0FBZixVQUFnQixHQUFlLEVBQUUsT0FBWTtZQUMzQyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCw4Q0FBZ0IsR0FBaEIsVUFBaUIsR0FBZ0IsRUFBRSxPQUFZO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELCtDQUFpQixHQUFqQixVQUFrQixHQUFpQixFQUFFLE9BQVk7WUFDL0MsR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELCtDQUFpQixHQUFqQixVQUFrQixHQUFpQixFQUFFLE9BQVk7WUFDL0MsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN6QyxHQUFHLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDekMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsZ0RBQWtCLEdBQWxCLFVBQW1CLEdBQWtCLEVBQUUsT0FBWTtZQUNqRCxHQUFHLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDNUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELHFEQUF1QixHQUF2QixVQUF3QixHQUF1QixFQUFFLE9BQVk7WUFDM0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELHFEQUF1QixHQUF2QixVQUF3QixHQUF1QixFQUFFLE9BQVk7WUFDM0QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM1RCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCxrREFBb0IsR0FBcEIsVUFBcUIsR0FBb0IsRUFBRSxPQUFZO1lBQ3JELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM1QyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCw4Q0FBZ0IsR0FBaEIsVUFBaUIsR0FBZ0IsRUFBRSxPQUFZO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELGtEQUFvQixHQUFwQixVQUFxQixHQUFvQixFQUFFLE9BQVk7WUFDckQsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsK0NBQWlCLEdBQWpCLFVBQWtCLEdBQWlCLEVBQUUsT0FBWTtZQUFqRCxpQkFLQztZQUpDLElBQUksR0FBRyxDQUFDLFVBQVUsRUFBRTtnQkFDbEIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUksRUFBRSxPQUFPLENBQUMsRUFBN0IsQ0FBNkIsQ0FBQyxDQUFDO2FBQy9EO1lBQ0QsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0Qsa0RBQW9CLEdBQXBCLFVBQXFCLEdBQW9CLEVBQUUsT0FBWTtZQUNyRCxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDN0MsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLEdBQUcsQ0FBQyxTQUFVLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM5QyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCwwQ0FBWSxHQUFaLFVBQWEsR0FBWSxFQUFFLE9BQVk7WUFDckMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELG9EQUFzQixHQUF0QixVQUF1QixHQUFrQixFQUFFLE9BQVk7WUFDckQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELDJDQUFhLEdBQWIsVUFBYyxHQUFhLEVBQUUsT0FBWTtZQUN2QyxHQUFHLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDekMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsK0NBQWlCLEdBQWpCLFVBQWtCLEdBQWlCLEVBQUUsT0FBWTtZQUMvQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNqRCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCxvREFBc0IsR0FBdEIsVUFBdUIsR0FBc0IsRUFBRSxPQUFZO1lBQ3pELEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN4QyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCxxREFBdUIsR0FBdkIsVUFBd0IsR0FBdUIsRUFBRSxPQUFZO1lBQzNELEdBQUcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN2QyxHQUFHLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDdkMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsK0NBQWlCLEdBQWpCLFVBQWtCLEdBQWlCLEVBQUUsT0FBWTtZQUMvQyxHQUFHLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDNUMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsOENBQWdCLEdBQWhCLFVBQWlCLEdBQWdCLEVBQUUsT0FBWTtZQUM3QyxHQUFHLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDNUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELG1EQUFxQixHQUFyQixVQUFzQixHQUFxQixFQUFFLE9BQVk7WUFDdkQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDL0MsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsaURBQW1CLEdBQW5CLFVBQW9CLEdBQW1CLEVBQUUsT0FBWTtZQUFyRCxpQkFHQztZQUZDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBSyxJQUFLLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsS0FBSSxFQUFFLE9BQU8sQ0FBQyxFQUExQyxDQUEwQyxDQUFDLENBQUM7WUFDM0UsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsNENBQWMsR0FBZCxVQUFlLEdBQWMsRUFBRSxPQUFZO1lBQ3pDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzdDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELGlEQUFtQixHQUFuQixVQUFvQixLQUFtQixFQUFFLE9BQVk7WUFBckQsaUJBRUM7WUFEQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFJLEVBQUUsT0FBTyxDQUFDLEVBQW5DLENBQW1DLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsaURBQW1CLEdBQW5CLFVBQW9CLElBQW9CLEVBQUUsT0FBWTtZQUNwRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ2QsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNiLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNwQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELHNEQUF3QixHQUF4QixVQUF5QixJQUF5QixFQUFFLE9BQVk7WUFDOUQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbEQsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNiLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNwQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELGlEQUFtQixHQUFuQixVQUFvQixJQUF5QixFQUFFLE9BQVk7WUFDekQsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3pDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELDZDQUFlLEdBQWYsVUFBZ0IsSUFBcUIsRUFBRSxPQUFZO1lBQ2pELElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMxQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxtREFBcUIsR0FBckIsVUFBc0IsSUFBZSxFQUFFLE9BQVk7WUFBbkQsaUJBUUM7WUFQQyxJQUFJLENBQUMsTUFBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDNUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQSxNQUFNLElBQUksT0FBQSxLQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBN0MsQ0FBNkMsQ0FBQyxDQUFDO1lBQzlFLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO2dCQUMxQixJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQzthQUMvRDtZQUNELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUEsTUFBTSxJQUFJLE9BQUEsS0FBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQTdDLENBQTZDLENBQUMsQ0FBQztZQUM5RSxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCx5Q0FBVyxHQUFYLFVBQVksSUFBWSxFQUFFLE9BQVk7WUFDcEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzlDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2hELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2pELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELCtDQUFpQixHQUFqQixVQUFrQixJQUFrQixFQUFFLE9BQVk7WUFDaEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbEQsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsNENBQWMsR0FBZCxVQUFlLElBQWUsRUFBRSxPQUFZO1lBQzFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMxQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxnREFBa0IsR0FBbEIsVUFBbUIsS0FBa0IsRUFBRSxPQUFZO1lBQW5ELGlCQUVDO1lBREMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSSxFQUFFLE9BQU8sQ0FBQyxFQUFsQyxDQUFrQyxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUNILDBCQUFDO0lBQUQsQ0FBQyxBQXhMRCxJQXdMQztJQXhMWSxrREFBbUI7SUEwTGhDLFNBQWdCLGdCQUFnQixDQUFDLEtBQWtCO1FBQ2pELElBQU0sT0FBTyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDdEMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN4QyxPQUFPLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDMUIsQ0FBQztJQUpELDRDQUlDO0lBRUQ7UUFBOEIsZ0RBQW1CO1FBQWpEO1lBQUEscUVBZ0JDO1lBZkMsY0FBUSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7O1FBZS9CLENBQUM7UUFkVSxrREFBd0IsR0FBakMsVUFBa0MsSUFBeUIsRUFBRSxPQUFZO1lBQ3ZFLHNDQUFzQztZQUN0QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDUSwrQ0FBcUIsR0FBOUIsVUFBK0IsSUFBZSxFQUFFLE9BQVk7WUFDMUQsb0NBQW9DO1lBQ3BDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNRLDBDQUFnQixHQUF6QixVQUEwQixHQUFnQixFQUFFLE9BQVk7WUFDdEQsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO2dCQUNaLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUM3QjtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNILHNCQUFDO0lBQUQsQ0FBQyxBQWhCRCxDQUE4QixtQkFBbUIsR0FnQmhEO0lBRUQsU0FBZ0IseUJBQXlCLENBQUMsS0FBa0I7UUFDMUQsSUFBTSxPQUFPLEdBQUcsSUFBSSw4QkFBOEIsRUFBRSxDQUFDO1FBQ3JELE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEMsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUM7SUFDcEMsQ0FBQztJQUpELDhEQUlDO0lBRUQ7UUFBNkMsK0RBQW1CO1FBQWhFO1lBQUEscUVBTUM7WUFMQyx3QkFBa0IsR0FBd0IsRUFBRSxDQUFDOztRQUsvQyxDQUFDO1FBSlUsMERBQWlCLEdBQTFCLFVBQTJCLENBQWUsRUFBRSxPQUFZO1lBQ3RELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RDLE9BQU8saUJBQU0saUJBQWlCLFlBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFDSCxxQ0FBQztJQUFELENBQUMsQUFORCxDQUE2QyxtQkFBbUIsR0FNL0Q7SUFFRCxTQUFnQixrQ0FBa0MsQ0FDOUMsSUFBZSxFQUFFLFVBQWdDO1FBQ25ELElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsSUFBTSxXQUFXLEdBQUcsSUFBSSwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFQRCxnRkFPQztJQUVELFNBQWdCLG1DQUFtQyxDQUMvQyxJQUFnQixFQUFFLFVBQWdDO1FBQ3BELElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsSUFBTSxXQUFXLEdBQUcsSUFBSSwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRSxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFQRCxrRkFPQztJQUVEO1FBQTBDLDREQUFjO1FBQ3RELHFDQUFvQixVQUEyQjtZQUEvQyxZQUNFLGlCQUFPLFNBQ1I7WUFGbUIsZ0JBQVUsR0FBVixVQUFVLENBQWlCOztRQUUvQyxDQUFDO1FBQ08sNENBQU0sR0FBZCxVQUFlLEdBQVE7O1lBQ3JCLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQzs7Z0JBQ3ZELEtBQWlCLElBQUEsS0FBQSxzQkFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLGdCQUFBLDRCQUFFO29CQUE5QixJQUFJLElBQUksV0FBQTtvQkFDWCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN6Qjs7Ozs7Ozs7O1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRVEsbURBQWEsR0FBdEIsVUFBdUIsSUFBZ0IsRUFBRSxPQUFZO1lBQ25ELElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO2dCQUNwQixJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDekIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO2FBQ25DO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRVEsbURBQWEsR0FBdEIsVUFBdUIsSUFBZSxFQUFFLE9BQVk7WUFDbEQsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQ3BCLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN6QixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7YUFDbkM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDSCxrQ0FBQztJQUFELENBQUMsQUEzQkQsQ0FBMEMsY0FBYyxHQTJCdkQ7SUFFRCxTQUFnQixjQUFjLENBQzFCLElBQVksRUFBRSxTQUEwQixFQUFFLGVBQStCO1FBQTNELDBCQUFBLEVBQUEsaUJBQTBCO1FBQUUsZ0NBQUEsRUFBQSxzQkFBK0I7UUFDM0UsT0FBTyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFIRCx3Q0FHQztJQUVELFNBQWdCLFlBQVksQ0FBQyxJQUFxQjtRQUFyQixxQkFBQSxFQUFBLFNBQXFCO1FBQ2hELE9BQU8sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUZELG9DQUVDO0lBRUQsU0FBZ0IsUUFBUSxDQUNwQixJQUFZLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQztRQUNuRSxPQUFPLElBQUksV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUhELDRCQUdDO0lBRUQsU0FBZ0IsVUFBVSxDQUN0QixFQUFxQixFQUFFLFVBQThCLEVBQ3JELFVBQWlDO1FBRFYsMkJBQUEsRUFBQSxpQkFBOEI7UUFFdkQsT0FBTyxJQUFJLFlBQVksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBSkQsZ0NBSUM7SUFFRCxTQUFnQixVQUFVLENBQ3RCLEVBQXFCLEVBQUUsVUFBd0IsRUFDL0MsYUFBOEI7UUFDaEMsT0FBTyxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUM3RixDQUFDO0lBSkQsZ0NBSUM7SUFFRCxTQUFnQixjQUFjLENBQzFCLElBQWdCLEVBQUUsYUFBOEIsRUFBRSxVQUF3QjtRQUM1RSxPQUFPLElBQUksY0FBYyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUhELHdDQUdDO0lBRUQsU0FBZ0IsVUFBVSxDQUFDLElBQWdCO1FBQ3pDLE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUZELGdDQUVDO0lBRUQsU0FBZ0IsVUFBVSxDQUN0QixNQUFvQixFQUFFLElBQWdCLEVBQUUsVUFBaUM7UUFDM0UsT0FBTyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUhELGdDQUdDO0lBRUQsU0FBZ0IsVUFBVSxDQUN0QixNQUEyRCxFQUMzRCxJQUF5QjtRQUF6QixxQkFBQSxFQUFBLFdBQXlCO1FBQzNCLE9BQU8sSUFBSSxjQUFjLENBQ3JCLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUE3QyxDQUE2QyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFMRCxnQ0FLQztJQUVELFNBQWdCLEtBQUssQ0FDakIsUUFBdUIsRUFBRSxJQUFnQixFQUFFLElBQVcsRUFDdEQsVUFBaUM7UUFDbkMsT0FBTyxJQUFJLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFKRCxzQkFJQztJQUVELFNBQWdCLEdBQUcsQ0FBQyxJQUFnQixFQUFFLFVBQWlDO1FBQ3JFLE9BQU8sSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFGRCxrQkFFQztJQUVELFNBQWdCLGFBQWEsQ0FBQyxJQUFnQixFQUFFLFVBQWlDO1FBQy9FLE9BQU8sSUFBSSxhQUFhLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFGRCxzQ0FFQztJQUVELFNBQWdCLEVBQUUsQ0FDZCxNQUFpQixFQUFFLElBQWlCLEVBQUUsSUFBZ0IsRUFBRSxVQUFpQyxFQUN6RixJQUFrQjtRQUNwQixPQUFPLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBSkQsZ0JBSUM7SUFFRCxTQUFnQixNQUFNLENBQ2xCLFNBQXFCLEVBQUUsVUFBdUIsRUFBRSxVQUF3QixFQUN4RSxVQUE0QixFQUFFLGVBQWtDO1FBQ2xFLE9BQU8sSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFKRCx3QkFJQztJQUVELFNBQWdCLGNBQWMsQ0FDMUIsR0FBZSxFQUFFLFFBQXlCLEVBQUUsSUFBZ0IsRUFDNUQsVUFBaUM7UUFDbkMsT0FBTyxJQUFJLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFKRCx3Q0FJQztJQUVELFNBQWdCLE9BQU8sQ0FDbkIsS0FBVSxFQUFFLElBQWdCLEVBQUUsVUFBaUM7UUFDakUsT0FBTyxJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFIRCwwQkFHQztJQUVELFNBQWdCLGVBQWUsQ0FDM0IsU0FBbUIsRUFBRSxZQUE0QixFQUFFLGdCQUFvQyxFQUN2RixXQUF5QixFQUFFLFVBQWlDO1FBQzlELE9BQU8sSUFBSSxlQUFlLENBQUMsU0FBUyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDakcsQ0FBQztJQUpELDBDQUlDO0lBRUQsU0FBZ0IsTUFBTSxDQUFDLEdBQWU7UUFDcEMsT0FBTyxHQUFHLFlBQVksV0FBVyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDO0lBQzFELENBQUM7SUFGRCx3QkFFQztJQXlCRDs7O09BR0c7SUFDSCxTQUFTLFdBQVcsQ0FBQyxHQUFhO1FBQ2hDLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRTtZQUNmLEdBQUcsSUFBSSxPQUFLLEdBQUcsQ0FBQyxPQUFTLENBQUM7U0FDM0I7UUFDRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUU7WUFDWixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7YUFDNUQ7WUFDRCxHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztTQUM1QztRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELFNBQVMsYUFBYSxDQUFDLElBQWdCOztRQUNyQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBRWpDLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUU7WUFDekQsbUVBQW1FO1lBQ25FLE9BQU8sTUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUcsQ0FBQztTQUNwQztRQUVELElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQzs7WUFDaEIsS0FBa0IsSUFBQSxTQUFBLHNCQUFBLElBQUksQ0FBQSwwQkFBQSw0Q0FBRTtnQkFBbkIsSUFBTSxHQUFHLGlCQUFBO2dCQUNaLEdBQUcsSUFBSSxJQUFJLENBQUM7Z0JBQ1osb0VBQW9FO2dCQUNwRSxHQUFHLElBQUksV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2hELEdBQUcsSUFBSSxJQUFJLENBQUM7YUFDYjs7Ozs7Ozs7O1FBQ0QsR0FBRyxJQUFJLEdBQUcsQ0FBQztRQUNYLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0kxOG5NZXRhfSBmcm9tICcuLi9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhJztcblxuLy8vLyBUeXBlc1xuZXhwb3J0IGVudW0gVHlwZU1vZGlmaWVyIHtcbiAgQ29uc3Rcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbW9kaWZpZXJzOiBUeXBlTW9kaWZpZXJbXSA9IFtdKSB7fVxuICBhYnN0cmFjdCB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICBoYXNNb2RpZmllcihtb2RpZmllcjogVHlwZU1vZGlmaWVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubW9kaWZpZXJzLmluZGV4T2YobW9kaWZpZXIpICE9PSAtMTtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBCdWlsdGluVHlwZU5hbWUge1xuICBEeW5hbWljLFxuICBCb29sLFxuICBTdHJpbmcsXG4gIEludCxcbiAgTnVtYmVyLFxuICBGdW5jdGlvbixcbiAgSW5mZXJyZWQsXG4gIE5vbmUsXG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluVHlwZSBleHRlbmRzIFR5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogQnVpbHRpblR5cGVOYW1lLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXJbXSkge1xuICAgIHN1cGVyKG1vZGlmaWVycyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QnVpbHRpblR5cGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4cHJlc3Npb25UeXBlIGV4dGVuZHMgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXJbXSwgcHVibGljIHR5cGVQYXJhbXM6IFR5cGVbXXxudWxsID0gbnVsbCkge1xuICAgIHN1cGVyKG1vZGlmaWVycyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRUeXBlKHZpc2l0b3I6IFR5cGVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXhwcmVzc2lvblR5cGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQXJyYXlUeXBlIGV4dGVuZHMgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBvZjogVHlwZSwgbW9kaWZpZXJzPzogVHlwZU1vZGlmaWVyW10pIHtcbiAgICBzdXBlcihtb2RpZmllcnMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0VHlwZSh2aXNpdG9yOiBUeXBlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFycmF5VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBNYXBUeXBlIGV4dGVuZHMgVHlwZSB7XG4gIHB1YmxpYyB2YWx1ZVR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IodmFsdWVUeXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBtb2RpZmllcnM/OiBUeXBlTW9kaWZpZXJbXSkge1xuICAgIHN1cGVyKG1vZGlmaWVycyk7XG4gICAgdGhpcy52YWx1ZVR5cGUgPSB2YWx1ZVR5cGUgfHwgbnVsbDtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFR5cGUodmlzaXRvcjogVHlwZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRNYXBUeXBlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBEWU5BTUlDX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkR5bmFtaWMpO1xuZXhwb3J0IGNvbnN0IElORkVSUkVEX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkluZmVycmVkKTtcbmV4cG9ydCBjb25zdCBCT09MX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkJvb2wpO1xuZXhwb3J0IGNvbnN0IElOVF9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5JbnQpO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5OdW1iZXIpO1xuZXhwb3J0IGNvbnN0IFNUUklOR19UWVBFID0gbmV3IEJ1aWx0aW5UeXBlKEJ1aWx0aW5UeXBlTmFtZS5TdHJpbmcpO1xuZXhwb3J0IGNvbnN0IEZVTkNUSU9OX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLkZ1bmN0aW9uKTtcbmV4cG9ydCBjb25zdCBOT05FX1RZUEUgPSBuZXcgQnVpbHRpblR5cGUoQnVpbHRpblR5cGVOYW1lLk5vbmUpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVWaXNpdG9yIHtcbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cHJlc3Npb25UeXBlKHR5cGU6IEV4cHJlc3Npb25UeXBlLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXJyYXlUeXBlKHR5cGU6IEFycmF5VHlwZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vLy8vLyBFeHByZXNzaW9uc1xuXG5leHBvcnQgZW51bSBVbmFyeU9wZXJhdG9yIHtcbiAgTWludXMsXG4gIFBsdXMsXG59XG5cbmV4cG9ydCBlbnVtIEJpbmFyeU9wZXJhdG9yIHtcbiAgRXF1YWxzLFxuICBOb3RFcXVhbHMsXG4gIElkZW50aWNhbCxcbiAgTm90SWRlbnRpY2FsLFxuICBNaW51cyxcbiAgUGx1cyxcbiAgRGl2aWRlLFxuICBNdWx0aXBseSxcbiAgTW9kdWxvLFxuICBBbmQsXG4gIE9yLFxuICBCaXR3aXNlQW5kLFxuICBMb3dlcixcbiAgTG93ZXJFcXVhbHMsXG4gIEJpZ2dlcixcbiAgQmlnZ2VyRXF1YWxzLFxuICBOdWxsaXNoQ29hbGVzY2UsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBudWxsU2FmZUlzRXF1aXZhbGVudDxUIGV4dGVuZHMge2lzRXF1aXZhbGVudChvdGhlcjogVCk6IGJvb2xlYW59PihcbiAgICBiYXNlOiBUfG51bGwsIG90aGVyOiBUfG51bGwpIHtcbiAgaWYgKGJhc2UgPT0gbnVsbCB8fCBvdGhlciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGJhc2UgPT0gb3RoZXI7XG4gIH1cbiAgcmV0dXJuIGJhc2UuaXNFcXVpdmFsZW50KG90aGVyKTtcbn1cblxuZnVuY3Rpb24gYXJlQWxsRXF1aXZhbGVudFByZWRpY2F0ZTxUPihcbiAgICBiYXNlOiBUW10sIG90aGVyOiBUW10sIGVxdWl2YWxlbnRQcmVkaWNhdGU6IChiYXNlRWxlbWVudDogVCwgb3RoZXJFbGVtZW50OiBUKSA9PiBib29sZWFuKSB7XG4gIGNvbnN0IGxlbiA9IGJhc2UubGVuZ3RoO1xuICBpZiAobGVuICE9PSBvdGhlci5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghZXF1aXZhbGVudFByZWRpY2F0ZShiYXNlW2ldLCBvdGhlcltpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmVBbGxFcXVpdmFsZW50PFQgZXh0ZW5kcyB7aXNFcXVpdmFsZW50KG90aGVyOiBUKTogYm9vbGVhbn0+KFxuICAgIGJhc2U6IFRbXSwgb3RoZXI6IFRbXSkge1xuICByZXR1cm4gYXJlQWxsRXF1aXZhbGVudFByZWRpY2F0ZShcbiAgICAgIGJhc2UsIG90aGVyLCAoYmFzZUVsZW1lbnQ6IFQsIG90aGVyRWxlbWVudDogVCkgPT4gYmFzZUVsZW1lbnQuaXNFcXVpdmFsZW50KG90aGVyRWxlbWVudCkpO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcblxuICBjb25zdHJ1Y3Rvcih0eXBlOiBUeXBlfG51bGx8dW5kZWZpbmVkLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VTcGFuID0gc291cmNlU3BhbiB8fCBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgd2hldGhlciB0aGlzIGV4cHJlc3Npb24gcHJvZHVjZXMgdGhlIHNhbWUgdmFsdWUgYXMgdGhlIGdpdmVuIGV4cHJlc3Npb24uXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIGNvbnN0YW50LlxuICAgKi9cbiAgYWJzdHJhY3QgaXNDb25zdGFudCgpOiBib29sZWFuO1xuXG4gIHByb3AobmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkUHJvcEV4cHIge1xuICAgIHJldHVybiBuZXcgUmVhZFByb3BFeHByKHRoaXMsIG5hbWUsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAga2V5KGluZGV4OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBSZWFkS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWFkS2V5RXhwcih0aGlzLCBpbmRleCwgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjYWxsRm4ocGFyYW1zOiBFeHByZXNzaW9uW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVyZT86IGJvb2xlYW4pOlxuICAgICAgSW52b2tlRnVuY3Rpb25FeHByIHtcbiAgICByZXR1cm4gbmV3IEludm9rZUZ1bmN0aW9uRXhwcih0aGlzLCBwYXJhbXMsIG51bGwsIHNvdXJjZVNwYW4sIHB1cmUpO1xuICB9XG5cbiAgaW5zdGFudGlhdGUocGFyYW1zOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6XG4gICAgICBJbnN0YW50aWF0ZUV4cHIge1xuICAgIHJldHVybiBuZXcgSW5zdGFudGlhdGVFeHByKHRoaXMsIHBhcmFtcywgdHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBjb25kaXRpb25hbChcbiAgICAgIHRydWVDYXNlOiBFeHByZXNzaW9uLCBmYWxzZUNhc2U6IEV4cHJlc3Npb258bnVsbCA9IG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBDb25kaXRpb25hbEV4cHIge1xuICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWxFeHByKHRoaXMsIHRydWVDYXNlLCBmYWxzZUNhc2UsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgZXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5FcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbm90RXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaWRlbnRpY2FsKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5JZGVudGljYWwsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbm90SWRlbnRpY2FsKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWwsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbWludXMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk1pbnVzLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIHBsdXMocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLlBsdXMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgZGl2aWRlKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5EaXZpZGUsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgbXVsdGlwbHkocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk11bHRpcGx5LCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG1vZHVsbyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTW9kdWxvLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGFuZChyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuQW5kLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGJpdHdpc2VBbmQocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHBhcmVuczogYm9vbGVhbiA9IHRydWUpOlxuICAgICAgQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5CaXR3aXNlQW5kLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4sIHBhcmVucyk7XG4gIH1cbiAgb3IocmhzOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBCaW5hcnlPcGVyYXRvckV4cHIge1xuICAgIHJldHVybiBuZXcgQmluYXJ5T3BlcmF0b3JFeHByKEJpbmFyeU9wZXJhdG9yLk9yLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG4gIGxvd2VyKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5Mb3dlciwgdGhpcywgcmhzLCBudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuICBsb3dlckVxdWFscyhyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYmlnZ2VyKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5CaWdnZXIsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgYmlnZ2VyRXF1YWxzKHJoczogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgICByZXR1cm4gbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihCaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHMsIHRoaXMsIHJocywgbnVsbCwgc291cmNlU3Bhbik7XG4gIH1cbiAgaXNCbGFuayhzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBFeHByZXNzaW9uIHtcbiAgICAvLyBOb3RlOiBXZSB1c2UgZXF1YWxzIGJ5IHB1cnBvc2UgaGVyZSB0byBjb21wYXJlIHRvIG51bGwgYW5kIHVuZGVmaW5lZCBpbiBKUy5cbiAgICAvLyBXZSB1c2UgdGhlIHR5cGVkIG51bGwgdG8gYWxsb3cgc3RyaWN0TnVsbENoZWNrcyB0byBuYXJyb3cgdHlwZXMuXG4gICAgcmV0dXJuIHRoaXMuZXF1YWxzKFRZUEVEX05VTExfRVhQUiwgc291cmNlU3Bhbik7XG4gIH1cbiAgY2FzdCh0eXBlOiBUeXBlLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gbmV3IENhc3RFeHByKHRoaXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG4gIG51bGxpc2hDb2FsZXNjZShyaHM6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IEJpbmFyeU9wZXJhdG9yRXhwciB7XG4gICAgcmV0dXJuIG5ldyBCaW5hcnlPcGVyYXRvckV4cHIoQmluYXJ5T3BlcmF0b3IuTnVsbGlzaENvYWxlc2NlLCB0aGlzLCByaHMsIG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdG9TdG10KCk6IFN0YXRlbWVudCB7XG4gICAgcmV0dXJuIG5ldyBFeHByZXNzaW9uU3RhdGVtZW50KHRoaXMsIG51bGwpO1xuICB9XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWx0aW5WYXIge1xuICBUaGlzLFxuICBTdXBlcixcbiAgQ2F0Y2hFcnJvcixcbiAgQ2F0Y2hTdGFja1xufVxuXG5leHBvcnQgY2xhc3MgUmVhZFZhckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsO1xuICBwdWJsaWMgYnVpbHRpbjogQnVpbHRpblZhcnxudWxsO1xuXG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZ3xCdWlsdGluVmFyLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgdGhpcy5idWlsdGluID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5uYW1lID0gbnVsbDtcbiAgICAgIHRoaXMuYnVpbHRpbiA9IG5hbWU7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlYWRWYXJFeHByICYmIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMuYnVpbHRpbiA9PT0gZS5idWlsdGluO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWFkVmFyRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlVmFyRXhwciB7XG4gICAgaWYgKCF0aGlzLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQnVpbHQgaW4gdmFyaWFibGUgJHt0aGlzLmJ1aWx0aW59IGNhbiBub3QgYmUgYXNzaWduZWQgdG8uYCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgV3JpdGVWYXJFeHByKHRoaXMubmFtZSwgdmFsdWUsIG51bGwsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFR5cGVvZkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpIHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFR5cGVvZkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgVHlwZW9mRXhwciAmJiBlLmV4cHIuaXNFcXVpdmFsZW50KHRoaXMuZXhwcik7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmV4cHIuaXNDb25zdGFudCgpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXcmFwcGVkTm9kZUV4cHI8VD4gZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIG5vZGU6IFQsIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyYXBwZWROb2RlRXhwciAmJiB0aGlzLm5vZGUgPT09IGUubm9kZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JhcHBlZE5vZGVFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXcml0ZVZhckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZVZhckV4cHIgJiYgdGhpcy5uYW1lID09PSBlLm5hbWUgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBFeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFdyaXRlVmFyRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHRvRGVjbFN0bXQodHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyW10pOiBEZWNsYXJlVmFyU3RtdCB7XG4gICAgcmV0dXJuIG5ldyBEZWNsYXJlVmFyU3RtdCh0aGlzLm5hbWUsIHRoaXMudmFsdWUsIHR5cGUsIG1vZGlmaWVycywgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHRvQ29uc3REZWNsKCk6IERlY2xhcmVWYXJTdG10IHtcbiAgICByZXR1cm4gdGhpcy50b0RlY2xTdG10KElORkVSUkVEX1RZUEUsIFtTdG10TW9kaWZpZXIuRmluYWxdKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBXcml0ZUtleUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIGluZGV4OiBFeHByZXNzaW9uLCB2YWx1ZTogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUgfHwgdmFsdWUudHlwZSwgc291cmNlU3Bhbik7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFdyaXRlS2V5RXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLmluZGV4LmlzRXF1aXZhbGVudChlLmluZGV4KSAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0V3JpdGVLZXlFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFdyaXRlUHJvcEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIG5hbWU6IHN0cmluZywgdmFsdWU6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHZhbHVlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBXcml0ZVByb3BFeHByICYmIHRoaXMucmVjZWl2ZXIuaXNFcXVpdmFsZW50KGUucmVjZWl2ZXIpICYmXG4gICAgICAgIHRoaXMubmFtZSA9PT0gZS5uYW1lICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KGUudmFsdWUpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRXcml0ZVByb3BFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWx0aW5NZXRob2Qge1xuICBDb25jYXRBcnJheSxcbiAgU3Vic2NyaWJlT2JzZXJ2YWJsZSxcbiAgQmluZFxufVxuXG5leHBvcnQgY2xhc3MgSW52b2tlRnVuY3Rpb25FeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGZuOiBFeHByZXNzaW9uLCBwdWJsaWMgYXJnczogRXhwcmVzc2lvbltdLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgcHVyZSA9IGZhbHNlKSB7XG4gICAgc3VwZXIodHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgSW52b2tlRnVuY3Rpb25FeHByICYmIHRoaXMuZm4uaXNFcXVpdmFsZW50KGUuZm4pICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpICYmIHRoaXMucHVyZSA9PT0gZS5wdXJlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnZva2VGdW5jdGlvbkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgVGFnZ2VkVGVtcGxhdGVFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRhZzogRXhwcmVzc2lvbiwgcHVibGljIHRlbXBsYXRlOiBUZW1wbGF0ZUxpdGVyYWwsIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBUYWdnZWRUZW1wbGF0ZUV4cHIgJiYgdGhpcy50YWcuaXNFcXVpdmFsZW50KGUudGFnKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50UHJlZGljYXRlKFxuICAgICAgICAgICAgICAgdGhpcy50ZW1wbGF0ZS5lbGVtZW50cywgZS50ZW1wbGF0ZS5lbGVtZW50cywgKGEsIGIpID0+IGEudGV4dCA9PT0gYi50ZXh0KSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMudGVtcGxhdGUuZXhwcmVzc2lvbnMsIGUudGVtcGxhdGUuZXhwcmVzc2lvbnMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgSW5zdGFudGlhdGVFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNsYXNzRXhwcjogRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEluc3RhbnRpYXRlRXhwciAmJiB0aGlzLmNsYXNzRXhwci5pc0VxdWl2YWxlbnQoZS5jbGFzc0V4cHIpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5hcmdzLCBlLmFyZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJbnN0YW50aWF0ZUV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IG51bWJlcnxzdHJpbmd8Ym9vbGVhbnxudWxsfHVuZGVmaW5lZCwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIExpdGVyYWxFeHByICYmIHRoaXMudmFsdWUgPT09IGUudmFsdWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TGl0ZXJhbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlTGl0ZXJhbCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlbGVtZW50czogVGVtcGxhdGVMaXRlcmFsRWxlbWVudFtdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSkge31cbn1cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZUxpdGVyYWxFbGVtZW50IHtcbiAgcmF3VGV4dDogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nLCBwdWJsaWMgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiwgcmF3VGV4dD86IHN0cmluZykge1xuICAgIC8vIElmIGByYXdUZXh0YCBpcyBub3QgcHJvdmlkZWQsIHRyeSB0byBleHRyYWN0IHRoZSByYXcgc3RyaW5nIGZyb20gaXRzXG4gICAgLy8gYXNzb2NpYXRlZCBgc291cmNlU3BhbmAuIElmIHRoYXQgaXMgYWxzbyBub3QgYXZhaWxhYmxlLCBcImZha2VcIiB0aGUgcmF3XG4gICAgLy8gc3RyaW5nIGluc3RlYWQgYnkgZXNjYXBpbmcgdGhlIGZvbGxvd2luZyBjb250cm9sIHNlcXVlbmNlczpcbiAgICAvLyAtIFwiXFxcIiB3b3VsZCBvdGhlcndpc2UgaW5kaWNhdGUgdGhhdCB0aGUgbmV4dCBjaGFyYWN0ZXIgaXMgYSBjb250cm9sIGNoYXJhY3Rlci5cbiAgICAvLyAtIFwiYFwiIGFuZCBcIiR7XCIgYXJlIHRlbXBsYXRlIHN0cmluZyBjb250cm9sIHNlcXVlbmNlcyB0aGF0IHdvdWxkIG90aGVyd2lzZSBwcmVtYXR1cmVseVxuICAgIC8vIGluZGljYXRlIHRoZSBlbmQgb2YgdGhlIHRlbXBsYXRlIGxpdGVyYWwgZWxlbWVudC5cbiAgICB0aGlzLnJhd1RleHQgPVxuICAgICAgICByYXdUZXh0ID8/IHNvdXJjZVNwYW4/LnRvU3RyaW5nKCkgPz8gZXNjYXBlRm9yVGVtcGxhdGVMaXRlcmFsKGVzY2FwZVNsYXNoZXModGV4dCkpO1xuICB9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBNZXNzYWdlUGllY2Uge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuZXhwb3J0IGNsYXNzIExpdGVyYWxQaWVjZSBleHRlbmRzIE1lc3NhZ2VQaWVjZSB7fVxuZXhwb3J0IGNsYXNzIFBsYWNlaG9sZGVyUGllY2UgZXh0ZW5kcyBNZXNzYWdlUGllY2Uge31cblxuZXhwb3J0IGNsYXNzIExvY2FsaXplZFN0cmluZyBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IG1ldGFCbG9jazogSTE4bk1ldGEsIHJlYWRvbmx5IG1lc3NhZ2VQYXJ0czogTGl0ZXJhbFBpZWNlW10sXG4gICAgICByZWFkb25seSBwbGFjZUhvbGRlck5hbWVzOiBQbGFjZWhvbGRlclBpZWNlW10sIHJlYWRvbmx5IGV4cHJlc3Npb25zOiBFeHByZXNzaW9uW10sXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihTVFJJTkdfVFlQRSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIC8vIHJldHVybiBlIGluc3RhbmNlb2YgTG9jYWxpemVkU3RyaW5nICYmIHRoaXMubWVzc2FnZSA9PT0gZS5tZXNzYWdlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TG9jYWxpemVkU3RyaW5nKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYG1ldGFgIGFuZCBgbWVzc2FnZVBhcnRgIGludG8gXCJjb29rZWRcIiBhbmQgXCJyYXdcIiBzdHJpbmdzIHRoYXQgY2FuIGJlIHVzZWRcbiAgICogaW4gYSBgJGxvY2FsaXplYCB0YWdnZWQgc3RyaW5nLiBUaGUgZm9ybWF0IG9mIHRoZSBtZXRhZGF0YSBpcyB0aGUgc2FtZSBhcyB0aGF0IHBhcnNlZCBieVxuICAgKiBgcGFyc2VJMThuTWV0YSgpYC5cbiAgICpcbiAgICogQHBhcmFtIG1ldGEgVGhlIG1ldGFkYXRhIHRvIHNlcmlhbGl6ZVxuICAgKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZpcnN0IHBhcnQgb2YgdGhlIHRhZ2dlZCBzdHJpbmdcbiAgICovXG4gIHNlcmlhbGl6ZUkxOG5IZWFkKCk6IENvb2tlZFJhd1N0cmluZyB7XG4gICAgY29uc3QgTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG4gICAgY29uc3QgSURfU0VQQVJBVE9SID0gJ0BAJztcbiAgICBjb25zdCBMRUdBQ1lfSURfSU5ESUNBVE9SID0gJ+KQnyc7XG5cbiAgICBsZXQgbWV0YUJsb2NrID0gdGhpcy5tZXRhQmxvY2suZGVzY3JpcHRpb24gfHwgJyc7XG4gICAgaWYgKHRoaXMubWV0YUJsb2NrLm1lYW5pbmcpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke3RoaXMubWV0YUJsb2NrLm1lYW5pbmd9JHtNRUFOSU5HX1NFUEFSQVRPUn0ke21ldGFCbG9ja31gO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZXRhQmxvY2suY3VzdG9tSWQpIHtcbiAgICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja30ke0lEX1NFUEFSQVRPUn0ke3RoaXMubWV0YUJsb2NrLmN1c3RvbUlkfWA7XG4gICAgfVxuICAgIGlmICh0aGlzLm1ldGFCbG9jay5sZWdhY3lJZHMpIHtcbiAgICAgIHRoaXMubWV0YUJsb2NrLmxlZ2FjeUlkcy5mb3JFYWNoKGxlZ2FjeUlkID0+IHtcbiAgICAgICAgbWV0YUJsb2NrID0gYCR7bWV0YUJsb2NrfSR7TEVHQUNZX0lEX0lORElDQVRPUn0ke2xlZ2FjeUlkfWA7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhcbiAgICAgICAgbWV0YUJsb2NrLCB0aGlzLm1lc3NhZ2VQYXJ0c1swXS50ZXh0LCB0aGlzLmdldE1lc3NhZ2VQYXJ0U291cmNlU3BhbigwKSk7XG4gIH1cblxuICBnZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VQYXJ0c1tpXT8uc291cmNlU3BhbiA/PyB0aGlzLnNvdXJjZVNwYW47XG4gIH1cblxuICBnZXRQbGFjZWhvbGRlclNvdXJjZVNwYW4oaTogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gdGhpcy5wbGFjZUhvbGRlck5hbWVzW2ldPy5zb3VyY2VTcGFuID8/IHRoaXMuZXhwcmVzc2lvbnNbaV0/LnNvdXJjZVNwYW4gPz9cbiAgICAgICAgdGhpcy5zb3VyY2VTcGFuO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYHBsYWNlaG9sZGVyTmFtZWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBcImNvb2tlZFwiIGFuZCBcInJhd1wiIHN0cmluZ3MgdGhhdFxuICAgKiBjYW4gYmUgdXNlZCBpbiBhIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gICAqXG4gICAqIEBwYXJhbSBwbGFjZWhvbGRlck5hbWUgVGhlIHBsYWNlaG9sZGVyIG5hbWUgdG8gc2VyaWFsaXplXG4gICAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZm9sbG93aW5nIG1lc3NhZ2Ugc3RyaW5nIGFmdGVyIHRoaXMgcGxhY2Vob2xkZXJcbiAgICovXG4gIHNlcmlhbGl6ZUkxOG5UZW1wbGF0ZVBhcnQocGFydEluZGV4OiBudW1iZXIpOiBDb29rZWRSYXdTdHJpbmcge1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyTmFtZSA9IHRoaXMucGxhY2VIb2xkZXJOYW1lc1twYXJ0SW5kZXggLSAxXS50ZXh0O1xuICAgIGNvbnN0IG1lc3NhZ2VQYXJ0ID0gdGhpcy5tZXNzYWdlUGFydHNbcGFydEluZGV4XTtcbiAgICByZXR1cm4gY3JlYXRlQ29va2VkUmF3U3RyaW5nKFxuICAgICAgICBwbGFjZWhvbGRlck5hbWUsIG1lc3NhZ2VQYXJ0LnRleHQsIHRoaXMuZ2V0TWVzc2FnZVBhcnRTb3VyY2VTcGFuKHBhcnRJbmRleCkpO1xuICB9XG59XG5cbi8qKlxuICogQSBzdHJ1Y3R1cmUgdG8gaG9sZCB0aGUgY29va2VkIGFuZCByYXcgc3RyaW5ncyBvZiBhIHRlbXBsYXRlIGxpdGVyYWwgZWxlbWVudCwgYWxvbmcgd2l0aCBpdHNcbiAqIHNvdXJjZS1zcGFuIHJhbmdlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvb2tlZFJhd1N0cmluZyB7XG4gIGNvb2tlZDogc3RyaW5nO1xuICByYXc6IHN0cmluZztcbiAgcmFuZ2U6IFBhcnNlU291cmNlU3BhbnxudWxsO1xufVxuXG5jb25zdCBlc2NhcGVTbGFzaGVzID0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+IHN0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpO1xuY29uc3QgZXNjYXBlU3RhcnRpbmdDb2xvbiA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUNvbG9ucyA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbmNvbnN0IGVzY2FwZUZvclRlbXBsYXRlTGl0ZXJhbCA9IChzdHI6IHN0cmluZyk6IHN0cmluZyA9PlxuICAgIHN0ci5yZXBsYWNlKC9gL2csICdcXFxcYCcpLnJlcGxhY2UoL1xcJHsvZywgJyRcXFxceycpO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBge2Nvb2tlZCwgcmF3fWAgb2JqZWN0IGZyb20gdGhlIGBtZXRhQmxvY2tgIGFuZCBgbWVzc2FnZVBhcnRgLlxuICpcbiAqIFRoZSBgcmF3YCB0ZXh0IG11c3QgaGF2ZSB2YXJpb3VzIGNoYXJhY3RlciBzZXF1ZW5jZXMgZXNjYXBlZDpcbiAqICogXCJcXFwiIHdvdWxkIG90aGVyd2lzZSBpbmRpY2F0ZSB0aGF0IHRoZSBuZXh0IGNoYXJhY3RlciBpcyBhIGNvbnRyb2wgY2hhcmFjdGVyLlxuICogKiBcImBcIiBhbmQgXCIke1wiIGFyZSB0ZW1wbGF0ZSBzdHJpbmcgY29udHJvbCBzZXF1ZW5jZXMgdGhhdCB3b3VsZCBvdGhlcndpc2UgcHJlbWF0dXJlbHkgaW5kaWNhdGVcbiAqICAgdGhlIGVuZCBvZiBhIG1lc3NhZ2UgcGFydC5cbiAqICogXCI6XCIgaW5zaWRlIGEgbWV0YWJsb2NrIHdvdWxkIHByZW1hdHVyZWx5IGluZGljYXRlIHRoZSBlbmQgb2YgdGhlIG1ldGFibG9jay5cbiAqICogXCI6XCIgYXQgdGhlIHN0YXJ0IG9mIGEgbWVzc2FnZVBhcnQgd2l0aCBubyBtZXRhYmxvY2sgd291bGQgZXJyb25lb3VzbHkgaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGFcbiAqICAgbWV0YWJsb2NrLlxuICpcbiAqIEBwYXJhbSBtZXRhQmxvY2sgQW55IG1ldGFkYXRhIHRoYXQgc2hvdWxkIGJlIHByZXBlbmRlZCB0byB0aGUgc3RyaW5nXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIG1lc3NhZ2UgcGFydCBvZiB0aGUgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNvb2tlZFJhd1N0cmluZyhcbiAgICBtZXRhQmxvY2s6IHN0cmluZywgbWVzc2FnZVBhcnQ6IHN0cmluZywgcmFuZ2U6IFBhcnNlU291cmNlU3BhbnxudWxsKTogQ29va2VkUmF3U3RyaW5nIHtcbiAgaWYgKG1ldGFCbG9jayA9PT0gJycpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29va2VkOiBtZXNzYWdlUGFydCxcbiAgICAgIHJhdzogZXNjYXBlRm9yVGVtcGxhdGVMaXRlcmFsKGVzY2FwZVN0YXJ0aW5nQ29sb24oZXNjYXBlU2xhc2hlcyhtZXNzYWdlUGFydCkpKSxcbiAgICAgIHJhbmdlLFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvb2tlZDogYDoke21ldGFCbG9ja306JHttZXNzYWdlUGFydH1gLFxuICAgICAgcmF3OiBlc2NhcGVGb3JUZW1wbGF0ZUxpdGVyYWwoXG4gICAgICAgICAgYDoke2VzY2FwZUNvbG9ucyhlc2NhcGVTbGFzaGVzKG1ldGFCbG9jaykpfToke2VzY2FwZVNsYXNoZXMobWVzc2FnZVBhcnQpfWApLFxuICAgICAgcmFuZ2UsXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZXJuYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBFeHRlcm5hbFJlZmVyZW5jZSwgdHlwZT86IFR5cGV8bnVsbCwgcHVibGljIHR5cGVQYXJhbXM6IFR5cGVbXXxudWxsID0gbnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEV4dGVybmFsRXhwciAmJiB0aGlzLnZhbHVlLm5hbWUgPT09IGUudmFsdWUubmFtZSAmJlxuICAgICAgICB0aGlzLnZhbHVlLm1vZHVsZU5hbWUgPT09IGUudmFsdWUubW9kdWxlTmFtZSAmJiB0aGlzLnZhbHVlLnJ1bnRpbWUgPT09IGUudmFsdWUucnVudGltZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXh0ZXJuYWxFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlcm5hbFJlZmVyZW5jZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtb2R1bGVOYW1lOiBzdHJpbmd8bnVsbCwgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsLCBwdWJsaWMgcnVudGltZT86IGFueXxudWxsKSB7XG4gIH1cbiAgLy8gTm90ZTogbm8gaXNFcXVpdmFsZW50IG1ldGhvZCBoZXJlIGFzIHdlIHVzZSB0aGlzIGFzIGFuIGludGVyZmFjZSB0b28uXG59XG5cbmV4cG9ydCBjbGFzcyBDb25kaXRpb25hbEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgcHVibGljIHRydWVDYXNlOiBFeHByZXNzaW9uO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgdHJ1ZUNhc2U6IEV4cHJlc3Npb24sIHB1YmxpYyBmYWxzZUNhc2U6IEV4cHJlc3Npb258bnVsbCA9IG51bGwsXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlIHx8IHRydWVDYXNlLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHJ1ZUNhc2UgPSB0cnVlQ2FzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDb25kaXRpb25hbEV4cHIgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKSAmJlxuICAgICAgICB0aGlzLnRydWVDYXNlLmlzRXF1aXZhbGVudChlLnRydWVDYXNlKSAmJiBudWxsU2FmZUlzRXF1aXZhbGVudCh0aGlzLmZhbHNlQ2FzZSwgZS5mYWxzZUNhc2UpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb25kaXRpb25hbEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTm90RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29uZGl0aW9uOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihCT09MX1RZUEUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIE5vdEV4cHIgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KGUuY29uZGl0aW9uKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Tm90RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQXNzZXJ0Tm90TnVsbCBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29uZGl0aW9uOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihjb25kaXRpb24udHlwZSwgc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQXNzZXJ0Tm90TnVsbCAmJiB0aGlzLmNvbmRpdGlvbi5pc0VxdWl2YWxlbnQoZS5jb25kaXRpb24pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRBc3NlcnROb3ROdWxsRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2FzdEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDYXN0RXhwciAmJiB0aGlzLnZhbHVlLmlzRXF1aXZhbGVudChlLnZhbHVlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q2FzdEV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgRm5QYXJhbSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBUeXBlfG51bGwgPSBudWxsKSB7fVxuXG4gIGlzRXF1aXZhbGVudChwYXJhbTogRm5QYXJhbSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IHBhcmFtLm5hbWU7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgRnVuY3Rpb25FeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHBhcmFtczogRm5QYXJhbVtdLCBwdWJsaWMgc3RhdGVtZW50czogU3RhdGVtZW50W10sIHR5cGU/OiBUeXBlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBuYW1lPzogc3RyaW5nfG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBGdW5jdGlvbkV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnBhcmFtcywgZS5wYXJhbXMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5zdGF0ZW1lbnRzLCBlLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGdW5jdGlvbkV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cblxuICB0b0RlY2xTdG10KG5hbWU6IHN0cmluZywgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyW10pOiBEZWNsYXJlRnVuY3Rpb25TdG10IHtcbiAgICByZXR1cm4gbmV3IERlY2xhcmVGdW5jdGlvblN0bXQoXG4gICAgICAgIG5hbWUsIHRoaXMucGFyYW1zLCB0aGlzLnN0YXRlbWVudHMsIHRoaXMudHlwZSwgbW9kaWZpZXJzLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFVuYXJ5T3BlcmF0b3JFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG9wZXJhdG9yOiBVbmFyeU9wZXJhdG9yLCBwdWJsaWMgZXhwcjogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIHBhcmVuczogYm9vbGVhbiA9IHRydWUpIHtcbiAgICBzdXBlcih0eXBlIHx8IE5VTUJFUl9UWVBFLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBVbmFyeU9wZXJhdG9yRXhwciAmJiB0aGlzLm9wZXJhdG9yID09PSBlLm9wZXJhdG9yICYmXG4gICAgICAgIHRoaXMuZXhwci5pc0VxdWl2YWxlbnQoZS5leHByKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VW5hcnlPcGVyYXRvckV4cHIodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQmluYXJ5T3BlcmF0b3JFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyBsaHM6IEV4cHJlc3Npb247XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG9wZXJhdG9yOiBCaW5hcnlPcGVyYXRvciwgbGhzOiBFeHByZXNzaW9uLCBwdWJsaWMgcmhzOiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLFxuICAgICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgcGFyZW5zOiBib29sZWFuID0gdHJ1ZSkge1xuICAgIHN1cGVyKHR5cGUgfHwgbGhzLnR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMubGhzID0gbGhzO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEJpbmFyeU9wZXJhdG9yRXhwciAmJiB0aGlzLm9wZXJhdG9yID09PSBlLm9wZXJhdG9yICYmXG4gICAgICAgIHRoaXMubGhzLmlzRXF1aXZhbGVudChlLmxocykgJiYgdGhpcy5yaHMuaXNFcXVpdmFsZW50KGUucmhzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlYWRQcm9wRXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogRXhwcmVzc2lvbiwgcHVibGljIG5hbWU6IHN0cmluZywgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlYWRQcm9wRXhwciAmJiB0aGlzLnJlY2VpdmVyLmlzRXF1aXZhbGVudChlLnJlY2VpdmVyKSAmJlxuICAgICAgICB0aGlzLm5hbWUgPT09IGUubmFtZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVhZFByb3BFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgc2V0KHZhbHVlOiBFeHByZXNzaW9uKTogV3JpdGVQcm9wRXhwciB7XG4gICAgcmV0dXJuIG5ldyBXcml0ZVByb3BFeHByKHRoaXMucmVjZWl2ZXIsIHRoaXMubmFtZSwgdmFsdWUsIG51bGwsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUmVhZEtleUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IEV4cHJlc3Npb24sIHB1YmxpYyBpbmRleDogRXhwcmVzc2lvbiwgdHlwZT86IFR5cGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlYWRLZXlFeHByICYmIHRoaXMucmVjZWl2ZXIuaXNFcXVpdmFsZW50KGUucmVjZWl2ZXIpICYmXG4gICAgICAgIHRoaXMuaW5kZXguaXNFcXVpdmFsZW50KGUuaW5kZXgpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWFkS2V5RXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHNldCh2YWx1ZTogRXhwcmVzc2lvbik6IFdyaXRlS2V5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBXcml0ZUtleUV4cHIodGhpcy5yZWNlaXZlciwgdGhpcy5pbmRleCwgdmFsdWUsIG51bGwsIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEFycmF5RXhwciBleHRlbmRzIEV4cHJlc3Npb24ge1xuICBwdWJsaWMgZW50cmllczogRXhwcmVzc2lvbltdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzOiBFeHByZXNzaW9uW10sIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHR5cGUsIHNvdXJjZVNwYW4pO1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXMuZXZlcnkoZSA9PiBlLmlzQ29uc3RhbnQoKSk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTGl0ZXJhbEFycmF5RXhwciAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuZW50cmllcywgZS5lbnRyaWVzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsQXJyYXlFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMaXRlcmFsTWFwRW50cnkge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMga2V5OiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogRXhwcmVzc2lvbiwgcHVibGljIHF1b3RlZDogYm9vbGVhbikge31cbiAgaXNFcXVpdmFsZW50KGU6IExpdGVyYWxNYXBFbnRyeSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmtleSA9PT0gZS5rZXkgJiYgdGhpcy52YWx1ZS5pc0VxdWl2YWxlbnQoZS52YWx1ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIExpdGVyYWxNYXBFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIHB1YmxpYyB2YWx1ZVR5cGU6IFR5cGV8bnVsbCA9IG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGVudHJpZXM6IExpdGVyYWxNYXBFbnRyeVtdLCB0eXBlPzogTWFwVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcih0eXBlLCBzb3VyY2VTcGFuKTtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdGhpcy52YWx1ZVR5cGUgPSB0eXBlLnZhbHVlVHlwZTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTGl0ZXJhbE1hcEV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmVudHJpZXMsIGUuZW50cmllcyk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXMuZXZlcnkoZSA9PiBlLnZhbHVlLmlzQ29uc3RhbnQoKSk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRMaXRlcmFsTWFwRXhwcih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29tbWFFeHByIGV4dGVuZHMgRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwYXJ0czogRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXS50eXBlLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDb21tYUV4cHIgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnBhcnRzLCBlLnBhcnRzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IEV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q29tbWFFeHByKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IFdyaXRlS2V5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogV3JpdGVQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihhc3Q6IEludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRhZ2dlZFRlbXBsYXRlRXhwcihhc3Q6IFRhZ2dlZFRlbXBsYXRlRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEluc3RhbnRpYXRlRXhwcihhc3Q6IEluc3RhbnRpYXRlRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBMb2NhbGl6ZWRTdHJpbmcsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogQmluYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBMaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNvbnN0IFRISVNfRVhQUiA9IG5ldyBSZWFkVmFyRXhwcihCdWlsdGluVmFyLlRoaXMsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IFNVUEVSX0VYUFIgPSBuZXcgUmVhZFZhckV4cHIoQnVpbHRpblZhci5TdXBlciwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuQ2F0Y2hFcnJvciwgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfU1RBQ0tfVkFSID0gbmV3IFJlYWRWYXJFeHByKEJ1aWx0aW5WYXIuQ2F0Y2hTdGFjaywgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgTlVMTF9FWFBSID0gbmV3IExpdGVyYWxFeHByKG51bGwsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IFRZUEVEX05VTExfRVhQUiA9IG5ldyBMaXRlcmFsRXhwcihudWxsLCBJTkZFUlJFRF9UWVBFLCBudWxsKTtcblxuLy8vLyBTdGF0ZW1lbnRzXG5leHBvcnQgZW51bSBTdG10TW9kaWZpZXIge1xuICBGaW5hbCxcbiAgUHJpdmF0ZSxcbiAgRXhwb3J0ZWQsXG4gIFN0YXRpYyxcbn1cblxuZXhwb3J0IGNsYXNzIExlYWRpbmdDb21tZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHRleHQ6IHN0cmluZywgcHVibGljIG11bHRpbGluZTogYm9vbGVhbiwgcHVibGljIHRyYWlsaW5nTmV3bGluZTogYm9vbGVhbikge31cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVsdGlsaW5lID8gYCAke3RoaXMudGV4dH0gYCA6IHRoaXMudGV4dDtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEpTRG9jQ29tbWVudCBleHRlbmRzIExlYWRpbmdDb21tZW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHRhZ3M6IEpTRG9jVGFnW10pIHtcbiAgICBzdXBlcignJywgLyogbXVsdGlsaW5lICovIHRydWUsIC8qIHRyYWlsaW5nTmV3bGluZSAqLyB0cnVlKTtcbiAgfVxuICBvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiBzZXJpYWxpemVUYWdzKHRoaXMudGFncyk7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG1vZGlmaWVyczogU3RtdE1vZGlmaWVyW10gPSBbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCxcbiAgICAgIHB1YmxpYyBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7fVxuICAvKipcbiAgICogQ2FsY3VsYXRlcyB3aGV0aGVyIHRoaXMgc3RhdGVtZW50IHByb2R1Y2VzIHRoZSBzYW1lIHZhbHVlIGFzIHRoZSBnaXZlbiBzdGF0ZW1lbnQuXG4gICAqIE5vdGU6IFdlIGRvbid0IGNoZWNrIFR5cGVzIG5vciBQYXJzZVNvdXJjZVNwYW5zIG5vciBmdW5jdGlvbiBhcmd1bWVudHMuXG4gICAqL1xuICBhYnN0cmFjdCBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbjtcblxuICBhYnN0cmFjdCB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgaGFzTW9kaWZpZXIobW9kaWZpZXI6IFN0bXRNb2RpZmllcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1vZGlmaWVycy5pbmRleE9mKG1vZGlmaWVyKSAhPT0gLTE7XG4gIH1cblxuICBhZGRMZWFkaW5nQ29tbWVudChsZWFkaW5nQ29tbWVudDogTGVhZGluZ0NvbW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmxlYWRpbmdDb21tZW50cyA9IHRoaXMubGVhZGluZ0NvbW1lbnRzID8/IFtdO1xuICAgIHRoaXMubGVhZGluZ0NvbW1lbnRzLnB1c2gobGVhZGluZ0NvbW1lbnQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIERlY2xhcmVWYXJTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgcHVibGljIHR5cGU6IFR5cGV8bnVsbDtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU/OiBFeHByZXNzaW9uLCB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXJbXSxcbiAgICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgbGVhZGluZ0NvbW1lbnRzPzogTGVhZGluZ0NvbW1lbnRbXSkge1xuICAgIHN1cGVyKG1vZGlmaWVycywgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8ICh2YWx1ZSAmJiB2YWx1ZS50eXBlKSB8fCBudWxsO1xuICB9XG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChzdG10OiBTdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RtdCBpbnN0YW5jZW9mIERlY2xhcmVWYXJTdG10ICYmIHRoaXMubmFtZSA9PT0gc3RtdC5uYW1lICYmXG4gICAgICAgICh0aGlzLnZhbHVlID8gISFzdG10LnZhbHVlICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpIDogIXN0bXQudmFsdWUpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlVmFyU3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVjbGFyZUZ1bmN0aW9uU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIHB1YmxpYyB0eXBlOiBUeXBlfG51bGw7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHBhcmFtczogRm5QYXJhbVtdLCBwdWJsaWMgc3RhdGVtZW50czogU3RhdGVtZW50W10sXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXJbXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgbGVhZGluZ0NvbW1lbnRzPzogTGVhZGluZ0NvbW1lbnRbXSkge1xuICAgIHN1cGVyKG1vZGlmaWVycywgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRGVjbGFyZUZ1bmN0aW9uU3RtdCAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMucGFyYW1zLCBzdG10LnBhcmFtcykgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLnN0YXRlbWVudHMsIHN0bXQuc3RhdGVtZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlY2xhcmVGdW5jdGlvblN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4cHJlc3Npb25TdGF0ZW1lbnQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIoW10sIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgRXhwcmVzc2lvblN0YXRlbWVudCAmJiB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KHN0bXQuZXhwcik7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV4cHJlc3Npb25TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJldHVyblN0YXRlbWVudCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBFeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsXG4gICAgICBsZWFkaW5nQ29tbWVudHM/OiBMZWFkaW5nQ29tbWVudFtdKSB7XG4gICAgc3VwZXIoW10sIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgUmV0dXJuU3RhdGVtZW50ICYmIHRoaXMudmFsdWUuaXNFcXVpdmFsZW50KHN0bXQudmFsdWUpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZXR1cm5TdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBYnN0cmFjdENsYXNzUGFydCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0eXBlOiBUeXBlfG51bGwgPSBudWxsLCBwdWJsaWMgbW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXSA9IFtdKSB7fVxuICBoYXNNb2RpZmllcihtb2RpZmllcjogU3RtdE1vZGlmaWVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubW9kaWZpZXJzLmluZGV4T2YobW9kaWZpZXIpICE9PSAtMTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2xhc3NGaWVsZCBleHRlbmRzIEFic3RyYWN0Q2xhc3NQYXJ0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXJbXSxcbiAgICAgIHB1YmxpYyBpbml0aWFsaXplcj86IEV4cHJlc3Npb24pIHtcbiAgICBzdXBlcih0eXBlLCBtb2RpZmllcnMpO1xuICB9XG4gIGlzRXF1aXZhbGVudChmOiBDbGFzc0ZpZWxkKSB7XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gZi5uYW1lO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIENsYXNzTWV0aG9kIGV4dGVuZHMgQWJzdHJhY3RDbGFzc1BhcnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbCwgcHVibGljIHBhcmFtczogRm5QYXJhbVtdLCBwdWJsaWMgYm9keTogU3RhdGVtZW50W10sXG4gICAgICB0eXBlPzogVHlwZXxudWxsLCBtb2RpZmllcnM/OiBTdG10TW9kaWZpZXJbXSkge1xuICAgIHN1cGVyKHR5cGUsIG1vZGlmaWVycyk7XG4gIH1cbiAgaXNFcXVpdmFsZW50KG06IENsYXNzTWV0aG9kKSB7XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gbS5uYW1lICYmIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5ib2R5LCBtLmJvZHkpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIENsYXNzR2V0dGVyIGV4dGVuZHMgQWJzdHJhY3RDbGFzc1BhcnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBib2R5OiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCwgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyW10pIHtcbiAgICBzdXBlcih0eXBlLCBtb2RpZmllcnMpO1xuICB9XG4gIGlzRXF1aXZhbGVudChtOiBDbGFzc0dldHRlcikge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IG0ubmFtZSAmJiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuYm9keSwgbS5ib2R5KTtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBDbGFzc1N0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBwYXJlbnQ6IEV4cHJlc3Npb258bnVsbCwgcHVibGljIGZpZWxkczogQ2xhc3NGaWVsZFtdLFxuICAgICAgcHVibGljIGdldHRlcnM6IENsYXNzR2V0dGVyW10sIHB1YmxpYyBjb25zdHJ1Y3Rvck1ldGhvZDogQ2xhc3NNZXRob2QsXG4gICAgICBwdWJsaWMgbWV0aG9kczogQ2xhc3NNZXRob2RbXSwgbW9kaWZpZXJzPzogU3RtdE1vZGlmaWVyW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihtb2RpZmllcnMsIHNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cyk7XG4gIH1cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KHN0bXQ6IFN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzdG10IGluc3RhbmNlb2YgQ2xhc3NTdG10ICYmIHRoaXMubmFtZSA9PT0gc3RtdC5uYW1lICYmXG4gICAgICAgIG51bGxTYWZlSXNFcXVpdmFsZW50KHRoaXMucGFyZW50LCBzdG10LnBhcmVudCkgJiZcbiAgICAgICAgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmZpZWxkcywgc3RtdC5maWVsZHMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5nZXR0ZXJzLCBzdG10LmdldHRlcnMpICYmXG4gICAgICAgIHRoaXMuY29uc3RydWN0b3JNZXRob2QuaXNFcXVpdmFsZW50KHN0bXQuY29uc3RydWN0b3JNZXRob2QpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5tZXRob2RzLCBzdG10Lm1ldGhvZHMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWNsYXJlQ2xhc3NTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIElmU3RtdCBleHRlbmRzIFN0YXRlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNvbmRpdGlvbjogRXhwcmVzc2lvbiwgcHVibGljIHRydWVDYXNlOiBTdGF0ZW1lbnRbXSxcbiAgICAgIHB1YmxpYyBmYWxzZUNhc2U6IFN0YXRlbWVudFtdID0gW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihbXSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBJZlN0bXQgJiYgdGhpcy5jb25kaXRpb24uaXNFcXVpdmFsZW50KHN0bXQuY29uZGl0aW9uKSAmJlxuICAgICAgICBhcmVBbGxFcXVpdmFsZW50KHRoaXMudHJ1ZUNhc2UsIHN0bXQudHJ1ZUNhc2UpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5mYWxzZUNhc2UsIHN0bXQuZmFsc2VDYXNlKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFN0YXRlbWVudCh2aXNpdG9yOiBTdGF0ZW1lbnRWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZTdG10KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcnlDYXRjaFN0bXQgZXh0ZW5kcyBTdGF0ZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBib2R5U3RtdHM6IFN0YXRlbWVudFtdLCBwdWJsaWMgY2F0Y2hTdG10czogU3RhdGVtZW50W10sXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihbXSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBUcnlDYXRjaFN0bXQgJiYgYXJlQWxsRXF1aXZhbGVudCh0aGlzLmJvZHlTdG10cywgc3RtdC5ib2R5U3RtdHMpICYmXG4gICAgICAgIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5jYXRjaFN0bXRzLCBzdG10LmNhdGNoU3RtdHMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0U3RhdGVtZW50KHZpc2l0b3I6IFN0YXRlbWVudFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUcnlDYXRjaFN0bXQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgVGhyb3dTdG10IGV4dGVuZHMgU3RhdGVtZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZXJyb3I6IEV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCxcbiAgICAgIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgICBzdXBlcihbXSwgc291cmNlU3BhbiwgbGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoc3RtdDogVGhyb3dTdG10KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHN0bXQgaW5zdGFuY2VvZiBUcnlDYXRjaFN0bXQgJiYgdGhpcy5lcnJvci5pc0VxdWl2YWxlbnQoc3RtdC5lcnJvcik7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRTdGF0ZW1lbnQodmlzaXRvcjogU3RhdGVtZW50VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRocm93U3RtdCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRlbWVudFZpc2l0b3Ige1xuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBEZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXhwcmVzc2lvblN0bXQoc3RtdDogRXhwcmVzc2lvblN0YXRlbWVudCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IFRyeUNhdGNoU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRocm93U3RtdChzdG10OiBUaHJvd1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIEFzdFRyYW5zZm9ybWVyIGltcGxlbWVudHMgU3RhdGVtZW50VmlzaXRvciwgRXhwcmVzc2lvblZpc2l0b3Ige1xuICB0cmFuc2Zvcm1FeHByKGV4cHI6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IEV4cHJlc3Npb24ge1xuICAgIHJldHVybiBleHByO1xuICB9XG5cbiAgdHJhbnNmb3JtU3RtdChzdG10OiBTdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IFN0YXRlbWVudCB7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cblxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFR5cGVvZkV4cHIoZXhwcjogVHlwZW9mRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgVHlwZW9mRXhwcihleHByLmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBXcml0ZVZhckV4cHIoXG4gICAgICAgICAgICBleHByLm5hbWUsIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogV3JpdGVLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBXcml0ZUtleUV4cHIoXG4gICAgICAgICAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgZXhwci50eXBlLCBleHByLnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBXcml0ZVByb3BFeHByKFxuICAgICAgICAgICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIubmFtZSxcbiAgICAgICAgICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLnR5cGUsIGV4cHIuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBJbnZva2VGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgICAgIGFzdC5mbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VGFnZ2VkVGVtcGxhdGVFeHByKGFzdDogVGFnZ2VkVGVtcGxhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBUYWdnZWRUZW1wbGF0ZUV4cHIoXG4gICAgICAgICAgICBhc3QudGFnLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIG5ldyBUZW1wbGF0ZUxpdGVyYWwoXG4gICAgICAgICAgICAgICAgYXN0LnRlbXBsYXRlLmVsZW1lbnRzLFxuICAgICAgICAgICAgICAgIGFzdC50ZW1wbGF0ZS5leHByZXNzaW9ucy5tYXAoKGUpID0+IGUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKSksXG4gICAgICAgICAgICBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBJbnN0YW50aWF0ZUV4cHIoXG4gICAgICAgICAgICBhc3QuY2xhc3NFeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IExpdGVyYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBMb2NhbGl6ZWRTdHJpbmcoXG4gICAgICAgICAgICBhc3QubWV0YUJsb2NrLCBhc3QubWVzc2FnZVBhcnRzLCBhc3QucGxhY2VIb2xkZXJOYW1lcyxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZXhwcmVzc2lvbnMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBFeHRlcm5hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IENvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC5mYWxzZUNhc2UhLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdE5vdEV4cHIoYXN0OiBOb3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBOb3RFeHByKGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwcihhc3Q6IEFzc2VydE5vdE51bGwsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEFzc2VydE5vdE51bGwoYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5zb3VyY2VTcGFuKSwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IENhc3RFeHByKGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEZ1bmN0aW9uRXhwcihcbiAgICAgICAgICAgIGFzdC5wYXJhbXMsIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGFzdC5zdGF0ZW1lbnRzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFVuYXJ5T3BlcmF0b3JFeHByKGFzdDogVW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IFVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgYXN0Lm9wZXJhdG9yLCBhc3QuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBCaW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IEJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIGFzdC5vcGVyYXRvciwgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0LnR5cGUsIGFzdC5zb3VyY2VTcGFuKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgUmVhZFByb3BFeHByKFxuICAgICAgICAgICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0Lm5hbWUsIGFzdC50eXBlLCBhc3Quc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IFJlYWRLZXlFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUV4cHIoXG4gICAgICAgIG5ldyBSZWFkS2V5RXhwcihcbiAgICAgICAgICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IExpdGVyYWxBcnJheUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihcbiAgICAgICAgbmV3IExpdGVyYWxBcnJheUV4cHIoXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGNvbnRleHQpLCBhc3QudHlwZSwgYXN0LnNvdXJjZVNwYW4pLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmVudHJpZXMubWFwKFxuICAgICAgICAoZW50cnkpOiBMaXRlcmFsTWFwRW50cnkgPT4gbmV3IExpdGVyYWxNYXBFbnRyeShcbiAgICAgICAgICAgIGVudHJ5LmtleSwgZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBlbnRyeS5xdW90ZWQpKTtcbiAgICBjb25zdCBtYXBUeXBlID0gbmV3IE1hcFR5cGUoYXN0LnZhbHVlVHlwZSk7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRXhwcihuZXcgTGl0ZXJhbE1hcEV4cHIoZW50cmllcywgbWFwVHlwZSwgYXN0LnNvdXJjZVNwYW4pLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1FeHByKFxuICAgICAgICBuZXcgQ29tbWFFeHByKHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QucGFydHMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbiksIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0QWxsRXhwcmVzc2lvbnM8VCBleHRlbmRzIEV4cHJlc3Npb24+KGV4cHJzOiBUW10sIGNvbnRleHQ6IGFueSk6IFRbXSB7XG4gICAgcmV0dXJuIGV4cHJzLm1hcChleHByID0+IGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogRGVjbGFyZVZhclN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgdmFsdWUgPSBzdG10LnZhbHVlICYmIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgIHN0bXQubmFtZSwgdmFsdWUsIHN0bXQudHlwZSwgc3RtdC5tb2RpZmllcnMsIHN0bXQuc291cmNlU3Bhbiwgc3RtdC5sZWFkaW5nQ29tbWVudHMpLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgRGVjbGFyZUZ1bmN0aW9uU3RtdChcbiAgICAgICAgICAgIHN0bXQubmFtZSwgc3RtdC5wYXJhbXMsIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuc3RhdGVtZW50cywgY29udGV4dCksIHN0bXQudHlwZSxcbiAgICAgICAgICAgIHN0bXQubW9kaWZpZXJzLCBzdG10LnNvdXJjZVNwYW4sIHN0bXQubGVhZGluZ0NvbW1lbnRzKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtU3RtdChcbiAgICAgICAgbmV3IEV4cHJlc3Npb25TdGF0ZW1lbnQoXG4gICAgICAgICAgICBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBzdG10LnNvdXJjZVNwYW4sIHN0bXQubGVhZGluZ0NvbW1lbnRzKSxcbiAgICAgICAgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBSZXR1cm5TdGF0ZW1lbnQoXG4gICAgICAgICAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuLCBzdG10LmxlYWRpbmdDb21tZW50cyksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IENsYXNzU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBwYXJlbnQgPSBzdG10LnBhcmVudCEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGNvbnN0IGdldHRlcnMgPSBzdG10LmdldHRlcnMubWFwKFxuICAgICAgICBnZXR0ZXIgPT4gbmV3IENsYXNzR2V0dGVyKFxuICAgICAgICAgICAgZ2V0dGVyLm5hbWUsIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKGdldHRlci5ib2R5LCBjb250ZXh0KSwgZ2V0dGVyLnR5cGUsXG4gICAgICAgICAgICBnZXR0ZXIubW9kaWZpZXJzKSk7XG4gICAgY29uc3QgY3Rvck1ldGhvZCA9IHN0bXQuY29uc3RydWN0b3JNZXRob2QgJiZcbiAgICAgICAgbmV3IENsYXNzTWV0aG9kKHN0bXQuY29uc3RydWN0b3JNZXRob2QubmFtZSwgc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5wYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGNvbnRleHQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC50eXBlLCBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLm1vZGlmaWVycyk7XG4gICAgY29uc3QgbWV0aG9kcyA9IHN0bXQubWV0aG9kcy5tYXAoXG4gICAgICAgIG1ldGhvZCA9PiBuZXcgQ2xhc3NNZXRob2QoXG4gICAgICAgICAgICBtZXRob2QubmFtZSwgbWV0aG9kLnBhcmFtcywgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMobWV0aG9kLmJvZHksIGNvbnRleHQpLCBtZXRob2QudHlwZSxcbiAgICAgICAgICAgIG1ldGhvZC5tb2RpZmllcnMpKTtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgQ2xhc3NTdG10KFxuICAgICAgICAgICAgc3RtdC5uYW1lLCBwYXJlbnQsIHN0bXQuZmllbGRzLCBnZXR0ZXJzLCBjdG9yTWV0aG9kLCBtZXRob2RzLCBzdG10Lm1vZGlmaWVycyxcbiAgICAgICAgICAgIHN0bXQuc291cmNlU3BhbiksXG4gICAgICAgIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN0bXQoXG4gICAgICAgIG5ldyBJZlN0bXQoXG4gICAgICAgICAgICBzdG10LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgICAgICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjb250ZXh0KSxcbiAgICAgICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgc3RtdC5sZWFkaW5nQ29tbWVudHMpLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IFRyeUNhdGNoU3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgVHJ5Q2F0Y2hTdG10KFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5ib2R5U3RtdHMsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jYXRjaFN0bXRzLCBjb250ZXh0KSwgc3RtdC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgc3RtdC5sZWFkaW5nQ29tbWVudHMpLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IFRocm93U3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1TdG10KFxuICAgICAgICBuZXcgVGhyb3dTdG10KFxuICAgICAgICAgICAgc3RtdC5lcnJvci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHN0bXQuc291cmNlU3Bhbiwgc3RtdC5sZWFkaW5nQ29tbWVudHMpLFxuICAgICAgICBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0QWxsU3RhdGVtZW50cyhzdG10czogU3RhdGVtZW50W10sIGNvbnRleHQ6IGFueSk6IFN0YXRlbWVudFtdIHtcbiAgICByZXR1cm4gc3RtdHMubWFwKHN0bXQgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFN0YXRlbWVudFZpc2l0b3IsIEV4cHJlc3Npb25WaXNpdG9yIHtcbiAgdmlzaXRUeXBlKGFzdDogVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXN0O1xuICB9XG4gIHZpc2l0RXhwcmVzc2lvbihhc3Q6IEV4cHJlc3Npb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGFzdC50eXBlKSB7XG4gICAgICBhc3QudHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBhc3Q7XG4gIH1cbiAgdmlzaXRCdWlsdGluVHlwZSh0eXBlOiBCdWlsdGluVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uVHlwZSh0eXBlOiBFeHByZXNzaW9uVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0eXBlLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBpZiAodHlwZS50eXBlUGFyYW1zICE9PSBudWxsKSB7XG4gICAgICB0eXBlLnR5cGVQYXJhbXMuZm9yRWFjaChwYXJhbSA9PiB0aGlzLnZpc2l0VHlwZShwYXJhbSwgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRBcnJheVR5cGUodHlwZTogQXJyYXlUeXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0VHlwZSh0eXBlLCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdE1hcFR5cGUodHlwZTogTWFwVHlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUodHlwZSwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBXcmFwcGVkTm9kZUV4cHI8YW55PiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXN0O1xuICB9XG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IFR5cGVvZkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IFJlYWRWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0V3JpdGVWYXJFeHByKGFzdDogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZUtleUV4cHIoYXN0OiBXcml0ZUtleUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRXcml0ZVByb3BFeHByKGFzdDogV3JpdGVQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBJbnZva2VGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0VGFnZ2VkVGVtcGxhdGVFeHByKGFzdDogVGFnZ2VkVGVtcGxhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC50YWcudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QudGVtcGxhdGUuZXhwcmVzc2lvbnMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IExpdGVyYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChhc3QudHlwZVBhcmFtcykge1xuICAgICAgYXN0LnR5cGVQYXJhbXMuZm9yRWFjaCh0eXBlID0+IHR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QuZmFsc2VDYXNlIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IEZ1bmN0aW9uRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhhc3Quc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGFzdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IFJlYWRQcm9wRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBSZWFkS2V5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKGFzdCwgY29udGV4dCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihhc3QsIGNvbnRleHQpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBhc3QuZW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4gZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24oYXN0LCBjb250ZXh0KTtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJzOiBFeHByZXNzaW9uW10sIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGV4cHJzLmZvckVhY2goZXhwciA9PiBleHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IERlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChzdG10LnZhbHVlKSB7XG4gICAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHN0bXQudHlwZSkge1xuICAgICAgc3RtdC50eXBlLnZpc2l0VHlwZSh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzLCBjb250ZXh0KTtcbiAgICBpZiAoc3RtdC50eXBlKSB7XG4gICAgICBzdG10LnR5cGUudmlzaXRUeXBlKHRoaXMsIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogUmV0dXJuU3RhdGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBDbGFzc1N0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3RtdC5wYXJlbnQhLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBzdG10LmdldHRlcnMuZm9yRWFjaChnZXR0ZXIgPT4gdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoZ2V0dGVyLmJvZHksIGNvbnRleHQpKTtcbiAgICBpZiAoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCkge1xuICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5ib2R5LCBjb250ZXh0KTtcbiAgICB9XG4gICAgc3RtdC5tZXRob2RzLmZvckVhY2gobWV0aG9kID0+IHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKG1ldGhvZC5ib2R5LCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmZhbHNlQ2FzZSwgY29udGV4dCk7XG4gICAgcmV0dXJuIHN0bXQ7XG4gIH1cbiAgdmlzaXRUcnlDYXRjaFN0bXQoc3RtdDogVHJ5Q2F0Y2hTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuYm9keVN0bXRzLCBjb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmNhdGNoU3RtdHMsIGNvbnRleHQpO1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IFRocm93U3RtdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBzdG10LmVycm9yLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICB2aXNpdEFsbFN0YXRlbWVudHMoc3RtdHM6IFN0YXRlbWVudFtdLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBzdG10cy5mb3JFYWNoKHN0bXQgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRSZWFkVmFyTmFtZXMoc3RtdHM6IFN0YXRlbWVudFtdKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9SZWFkVmFyVmlzaXRvcigpO1xuICB2aXNpdG9yLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10cywgbnVsbCk7XG4gIHJldHVybiB2aXNpdG9yLnZhck5hbWVzO1xufVxuXG5jbGFzcyBfUmVhZFZhclZpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgdmFyTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgb3ZlcnJpZGUgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gRG9uJ3QgZGVzY2VuZCBpbnRvIG5lc3RlZCBmdW5jdGlvbnNcbiAgICByZXR1cm4gc3RtdDtcbiAgfVxuICBvdmVycmlkZSB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogQ2xhc3NTdG10LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIC8vIERvbid0IGRlc2NlbmQgaW50byBuZXN0ZWQgY2xhc3Nlc1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoYXN0Lm5hbWUpIHtcbiAgICAgIHRoaXMudmFyTmFtZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxlY3RFeHRlcm5hbFJlZmVyZW5jZXMoc3RtdHM6IFN0YXRlbWVudFtdKTogRXh0ZXJuYWxSZWZlcmVuY2VbXSB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0ZpbmRFeHRlcm5hbFJlZmVyZW5jZXNWaXNpdG9yKCk7XG4gIHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXRzLCBudWxsKTtcbiAgcmV0dXJuIHZpc2l0b3IuZXh0ZXJuYWxSZWZlcmVuY2VzO1xufVxuXG5jbGFzcyBfRmluZEV4dGVybmFsUmVmZXJlbmNlc1Zpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgZXh0ZXJuYWxSZWZlcmVuY2VzOiBFeHRlcm5hbFJlZmVyZW5jZVtdID0gW107XG4gIG92ZXJyaWRlIHZpc2l0RXh0ZXJuYWxFeHByKGU6IEV4dGVybmFsRXhwciwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5leHRlcm5hbFJlZmVyZW5jZXMucHVzaChlLnZhbHVlKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRFeHRlcm5hbEV4cHIoZSwgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgc3RtdDogU3RhdGVtZW50LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFN0YXRlbWVudCB7XG4gIGlmICghc291cmNlU3Bhbikge1xuICAgIHJldHVybiBzdG10O1xuICB9XG4gIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IF9BcHBseVNvdXJjZVNwYW5UcmFuc2Zvcm1lcihzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIHN0bXQudmlzaXRTdGF0ZW1lbnQodHJhbnNmb3JtZXIsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlTb3VyY2VTcGFuVG9FeHByZXNzaW9uSWZOZWVkZWQoXG4gICAgZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBFeHByZXNzaW9uIHtcbiAgaWYgKCFzb3VyY2VTcGFuKSB7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbiAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgX0FwcGx5U291cmNlU3BhblRyYW5zZm9ybWVyKHNvdXJjZVNwYW4pO1xuICByZXR1cm4gZXhwci52aXNpdEV4cHJlc3Npb24odHJhbnNmb3JtZXIsIG51bGwpO1xufVxuXG5jbGFzcyBfQXBwbHlTb3VyY2VTcGFuVHJhbnNmb3JtZXIgZXh0ZW5kcyBBc3RUcmFuc2Zvcm1lciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuICBwcml2YXRlIF9jbG9uZShvYmo6IGFueSk6IGFueSB7XG4gICAgY29uc3QgY2xvbmUgPSBPYmplY3QuY3JlYXRlKG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUpO1xuICAgIGZvciAobGV0IHByb3Agb2YgT2JqZWN0LmtleXMob2JqKSkge1xuICAgICAgY2xvbmVbcHJvcF0gPSBvYmpbcHJvcF07XG4gICAgfVxuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUV4cHIoZXhwcjogRXhwcmVzc2lvbiwgY29udGV4dDogYW55KTogRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFleHByLnNvdXJjZVNwYW4pIHtcbiAgICAgIGV4cHIgPSB0aGlzLl9jbG9uZShleHByKTtcbiAgICAgIGV4cHIuc291cmNlU3BhbiA9IHRoaXMuc291cmNlU3BhbjtcbiAgICB9XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1TdG10KHN0bXQ6IFN0YXRlbWVudCwgY29udGV4dDogYW55KTogU3RhdGVtZW50IHtcbiAgICBpZiAoIXN0bXQuc291cmNlU3Bhbikge1xuICAgICAgc3RtdCA9IHRoaXMuX2Nsb25lKHN0bXQpO1xuICAgICAgc3RtdC5zb3VyY2VTcGFuID0gdGhpcy5zb3VyY2VTcGFuO1xuICAgIH1cbiAgICByZXR1cm4gc3RtdDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbGVhZGluZ0NvbW1lbnQoXG4gICAgdGV4dDogc3RyaW5nLCBtdWx0aWxpbmU6IGJvb2xlYW4gPSBmYWxzZSwgdHJhaWxpbmdOZXdsaW5lOiBib29sZWFuID0gdHJ1ZSk6IExlYWRpbmdDb21tZW50IHtcbiAgcmV0dXJuIG5ldyBMZWFkaW5nQ29tbWVudCh0ZXh0LCBtdWx0aWxpbmUsIHRyYWlsaW5nTmV3bGluZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBqc0RvY0NvbW1lbnQodGFnczogSlNEb2NUYWdbXSA9IFtdKTogSlNEb2NDb21tZW50IHtcbiAgcmV0dXJuIG5ldyBKU0RvY0NvbW1lbnQodGFncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJpYWJsZShcbiAgICBuYW1lOiBzdHJpbmcsIHR5cGU/OiBUeXBlfG51bGwsIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG5ldyBSZWFkVmFyRXhwcihuYW1lLCB0eXBlLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydEV4cHIoXG4gICAgaWQ6IEV4dGVybmFsUmVmZXJlbmNlLCB0eXBlUGFyYW1zOiBUeXBlW118bnVsbCA9IG51bGwsXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogRXh0ZXJuYWxFeHByIHtcbiAgcmV0dXJuIG5ldyBFeHRlcm5hbEV4cHIoaWQsIG51bGwsIHR5cGVQYXJhbXMsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0VHlwZShcbiAgICBpZDogRXh0ZXJuYWxSZWZlcmVuY2UsIHR5cGVQYXJhbXM/OiBUeXBlW118bnVsbCxcbiAgICB0eXBlTW9kaWZpZXJzPzogVHlwZU1vZGlmaWVyW10pOiBFeHByZXNzaW9uVHlwZXxudWxsIHtcbiAgcmV0dXJuIGlkICE9IG51bGwgPyBleHByZXNzaW9uVHlwZShpbXBvcnRFeHByKGlkLCB0eXBlUGFyYW1zLCBudWxsKSwgdHlwZU1vZGlmaWVycykgOiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhwcmVzc2lvblR5cGUoXG4gICAgZXhwcjogRXhwcmVzc2lvbiwgdHlwZU1vZGlmaWVycz86IFR5cGVNb2RpZmllcltdLCB0eXBlUGFyYW1zPzogVHlwZVtdfG51bGwpOiBFeHByZXNzaW9uVHlwZSB7XG4gIHJldHVybiBuZXcgRXhwcmVzc2lvblR5cGUoZXhwciwgdHlwZU1vZGlmaWVycywgdHlwZVBhcmFtcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0eXBlb2ZFeHByKGV4cHI6IEV4cHJlc3Npb24pIHtcbiAgcmV0dXJuIG5ldyBUeXBlb2ZFeHByKGV4cHIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbEFycihcbiAgICB2YWx1ZXM6IEV4cHJlc3Npb25bXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTGl0ZXJhbEFycmF5RXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5RXhwcih2YWx1ZXMsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbE1hcChcbiAgICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogRXhwcmVzc2lvbn1bXSxcbiAgICB0eXBlOiBNYXBUeXBlfG51bGwgPSBudWxsKTogTGl0ZXJhbE1hcEV4cHIge1xuICByZXR1cm4gbmV3IExpdGVyYWxNYXBFeHByKFxuICAgICAgdmFsdWVzLm1hcChlID0+IG5ldyBMaXRlcmFsTWFwRW50cnkoZS5rZXksIGUudmFsdWUsIGUucXVvdGVkKSksIHR5cGUsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5hcnkoXG4gICAgb3BlcmF0b3I6IFVuYXJ5T3BlcmF0b3IsIGV4cHI6IEV4cHJlc3Npb24sIHR5cGU/OiBUeXBlLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFVuYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG5ldyBVbmFyeU9wZXJhdG9yRXhwcihvcGVyYXRvciwgZXhwciwgdHlwZSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3QoZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogTm90RXhwciB7XG4gIHJldHVybiBuZXcgTm90RXhwcihleHByLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdE51bGwoZXhwcjogRXhwcmVzc2lvbiwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsKTogQXNzZXJ0Tm90TnVsbCB7XG4gIHJldHVybiBuZXcgQXNzZXJ0Tm90TnVsbChleHByLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZuKFxuICAgIHBhcmFtczogRm5QYXJhbVtdLCBib2R5OiBTdGF0ZW1lbnRbXSwgdHlwZT86IFR5cGV8bnVsbCwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIG5hbWU/OiBzdHJpbmd8bnVsbCk6IEZ1bmN0aW9uRXhwciB7XG4gIHJldHVybiBuZXcgRnVuY3Rpb25FeHByKHBhcmFtcywgYm9keSwgdHlwZSwgc291cmNlU3BhbiwgbmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpZlN0bXQoXG4gICAgY29uZGl0aW9uOiBFeHByZXNzaW9uLCB0aGVuQ2xhdXNlOiBTdGF0ZW1lbnRbXSwgZWxzZUNsYXVzZT86IFN0YXRlbWVudFtdLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pIHtcbiAgcmV0dXJuIG5ldyBJZlN0bXQoY29uZGl0aW9uLCB0aGVuQ2xhdXNlLCBlbHNlQ2xhdXNlLCBzb3VyY2VTcGFuLCBsZWFkaW5nQ29tbWVudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFnZ2VkVGVtcGxhdGUoXG4gICAgdGFnOiBFeHByZXNzaW9uLCB0ZW1wbGF0ZTogVGVtcGxhdGVMaXRlcmFsLCB0eXBlPzogVHlwZXxudWxsLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFRhZ2dlZFRlbXBsYXRlRXhwciB7XG4gIHJldHVybiBuZXcgVGFnZ2VkVGVtcGxhdGVFeHByKHRhZywgdGVtcGxhdGUsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbChcbiAgICB2YWx1ZTogYW55LCB0eXBlPzogVHlwZXxudWxsLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBMaXRlcmFsRXhwciB7XG4gIHJldHVybiBuZXcgTGl0ZXJhbEV4cHIodmFsdWUsIHR5cGUsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9jYWxpemVkU3RyaW5nKFxuICAgIG1ldGFCbG9jazogSTE4bk1ldGEsIG1lc3NhZ2VQYXJ0czogTGl0ZXJhbFBpZWNlW10sIHBsYWNlaG9sZGVyTmFtZXM6IFBsYWNlaG9sZGVyUGllY2VbXSxcbiAgICBleHByZXNzaW9uczogRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBMb2NhbGl6ZWRTdHJpbmcge1xuICByZXR1cm4gbmV3IExvY2FsaXplZFN0cmluZyhtZXRhQmxvY2ssIG1lc3NhZ2VQYXJ0cywgcGxhY2Vob2xkZXJOYW1lcywgZXhwcmVzc2lvbnMsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdWxsKGV4cDogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gZXhwIGluc3RhbmNlb2YgTGl0ZXJhbEV4cHIgJiYgZXhwLnZhbHVlID09PSBudWxsO1xufVxuXG4vLyBUaGUgbGlzdCBvZiBKU0RvYyB0YWdzIHRoYXQgd2UgY3VycmVudGx5IHN1cHBvcnQuIEV4dGVuZCBpdCBpZiBuZWVkZWQuXG5leHBvcnQgY29uc3QgZW51bSBKU0RvY1RhZ05hbWUge1xuICBEZXNjID0gJ2Rlc2MnLFxuICBJZCA9ICdpZCcsXG4gIE1lYW5pbmcgPSAnbWVhbmluZycsXG59XG5cbi8qXG4gKiBUeXBlU2NyaXB0IGhhcyBhbiBBUEkgZm9yIEpTRG9jIGFscmVhZHksIGJ1dCBpdCdzIG5vdCBleHBvc2VkLlxuICogaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy83MzkzXG4gKiBGb3Igbm93IHdlIGNyZWF0ZSB0eXBlcyB0aGF0IGFyZSBzaW1pbGFyIHRvIHRoZWlycyBzbyB0aGF0IG1pZ3JhdGluZ1xuICogdG8gdGhlaXIgQVBJIHdpbGwgYmUgZWFzaWVyLiBTZWUgZS5nLiBgdHMuSlNEb2NUYWdgIGFuZCBgdHMuSlNEb2NDb21tZW50YC5cbiAqL1xuZXhwb3J0IHR5cGUgSlNEb2NUYWcgPSB7XG4gIC8vIGB0YWdOYW1lYCBpcyBlLmcuIFwicGFyYW1cIiBpbiBhbiBgQHBhcmFtYCBkZWNsYXJhdGlvblxuICB0YWdOYW1lOiBKU0RvY1RhZ05hbWV8c3RyaW5nLFxuICAvLyBBbnkgcmVtYWluaW5nIHRleHQgb24gdGhlIHRhZywgZS5nLiB0aGUgZGVzY3JpcHRpb25cbiAgdGV4dD86IHN0cmluZyxcbn18e1xuICAvLyBubyBgdGFnTmFtZWAgZm9yIHBsYWluIHRleHQgZG9jdW1lbnRhdGlvbiB0aGF0IG9jY3VycyBiZWZvcmUgYW55IGBAcGFyYW1gIGxpbmVzXG4gIHRhZ05hbWU/OiB1bmRlZmluZWQsIHRleHQ6IHN0cmluZyxcbn07XG5cbi8qXG4gKiBTZXJpYWxpemVzIGEgYFRhZ2AgaW50byBhIHN0cmluZy5cbiAqIFJldHVybnMgYSBzdHJpbmcgbGlrZSBcIiBAZm9vIHtiYXJ9IGJhelwiIChub3RlIHRoZSBsZWFkaW5nIHdoaXRlc3BhY2UgYmVmb3JlIGBAZm9vYCkuXG4gKi9cbmZ1bmN0aW9uIHRhZ1RvU3RyaW5nKHRhZzogSlNEb2NUYWcpOiBzdHJpbmcge1xuICBsZXQgb3V0ID0gJyc7XG4gIGlmICh0YWcudGFnTmFtZSkge1xuICAgIG91dCArPSBgIEAke3RhZy50YWdOYW1lfWA7XG4gIH1cbiAgaWYgKHRhZy50ZXh0KSB7XG4gICAgaWYgKHRhZy50ZXh0Lm1hdGNoKC9cXC9cXCp8XFwqXFwvLykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSlNEb2MgdGV4dCBjYW5ub3QgY29udGFpbiBcIi8qXCIgYW5kIFwiKi9cIicpO1xuICAgIH1cbiAgICBvdXQgKz0gJyAnICsgdGFnLnRleHQucmVwbGFjZSgvQC9nLCAnXFxcXEAnKTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVUYWdzKHRhZ3M6IEpTRG9jVGFnW10pOiBzdHJpbmcge1xuICBpZiAodGFncy5sZW5ndGggPT09IDApIHJldHVybiAnJztcblxuICBpZiAodGFncy5sZW5ndGggPT09IDEgJiYgdGFnc1swXS50YWdOYW1lICYmICF0YWdzWzBdLnRleHQpIHtcbiAgICAvLyBUaGUgSlNET0MgY29tbWVudCBpcyBhIHNpbmdsZSBzaW1wbGUgdGFnOiBlLmcgYC8qKiBAdGFnbmFtZSAqL2AuXG4gICAgcmV0dXJuIGAqJHt0YWdUb1N0cmluZyh0YWdzWzBdKX0gYDtcbiAgfVxuXG4gIGxldCBvdXQgPSAnKlxcbic7XG4gIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICBvdXQgKz0gJyAqJztcbiAgICAvLyBJZiB0aGUgdGFnVG9TdHJpbmcgaXMgbXVsdGktbGluZSwgaW5zZXJ0IFwiICogXCIgcHJlZml4ZXMgb24gbGluZXMuXG4gICAgb3V0ICs9IHRhZ1RvU3RyaW5nKHRhZykucmVwbGFjZSgvXFxuL2csICdcXG4gKiAnKTtcbiAgICBvdXQgKz0gJ1xcbic7XG4gIH1cbiAgb3V0ICs9ICcgJztcbiAgcmV0dXJuIG91dDtcbn1cbiJdfQ==