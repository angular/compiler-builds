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
        define("@angular/compiler/src/ml_parser/ast", ["require", "exports", "tslib", "@angular/compiler/src/ast_path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.findNode = exports.RecursiveVisitor = exports.visitAll = exports.Comment = exports.Element = exports.Attribute = exports.ExpansionCase = exports.Expansion = exports.Text = exports.NodeWithI18n = void 0;
    var tslib_1 = require("tslib");
    var ast_path_1 = require("@angular/compiler/src/ast_path");
    var NodeWithI18n = /** @class */ (function () {
        function NodeWithI18n(sourceSpan, i18n) {
            this.sourceSpan = sourceSpan;
            this.i18n = i18n;
        }
        return NodeWithI18n;
    }());
    exports.NodeWithI18n = NodeWithI18n;
    var Text = /** @class */ (function (_super) {
        tslib_1.__extends(Text, _super);
        function Text(value, sourceSpan, i18n) {
            var _this = _super.call(this, sourceSpan, i18n) || this;
            _this.value = value;
            return _this;
        }
        Text.prototype.visit = function (visitor, context) {
            return visitor.visitText(this, context);
        };
        return Text;
    }(NodeWithI18n));
    exports.Text = Text;
    var Expansion = /** @class */ (function (_super) {
        tslib_1.__extends(Expansion, _super);
        function Expansion(switchValue, type, cases, sourceSpan, switchValueSourceSpan, i18n) {
            var _this = _super.call(this, sourceSpan, i18n) || this;
            _this.switchValue = switchValue;
            _this.type = type;
            _this.cases = cases;
            _this.switchValueSourceSpan = switchValueSourceSpan;
            return _this;
        }
        Expansion.prototype.visit = function (visitor, context) {
            return visitor.visitExpansion(this, context);
        };
        return Expansion;
    }(NodeWithI18n));
    exports.Expansion = Expansion;
    var ExpansionCase = /** @class */ (function () {
        function ExpansionCase(value, expression, sourceSpan, valueSourceSpan, expSourceSpan) {
            this.value = value;
            this.expression = expression;
            this.sourceSpan = sourceSpan;
            this.valueSourceSpan = valueSourceSpan;
            this.expSourceSpan = expSourceSpan;
        }
        ExpansionCase.prototype.visit = function (visitor, context) {
            return visitor.visitExpansionCase(this, context);
        };
        return ExpansionCase;
    }());
    exports.ExpansionCase = ExpansionCase;
    var Attribute = /** @class */ (function (_super) {
        tslib_1.__extends(Attribute, _super);
        function Attribute(name, value, sourceSpan, valueSpan, i18n) {
            var _this = _super.call(this, sourceSpan, i18n) || this;
            _this.name = name;
            _this.value = value;
            _this.valueSpan = valueSpan;
            return _this;
        }
        Attribute.prototype.visit = function (visitor, context) {
            return visitor.visitAttribute(this, context);
        };
        return Attribute;
    }(NodeWithI18n));
    exports.Attribute = Attribute;
    var Element = /** @class */ (function (_super) {
        tslib_1.__extends(Element, _super);
        function Element(name, attrs, children, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
            if (startSourceSpan === void 0) { startSourceSpan = null; }
            if (endSourceSpan === void 0) { endSourceSpan = null; }
            var _this = _super.call(this, sourceSpan, i18n) || this;
            _this.name = name;
            _this.attrs = attrs;
            _this.children = children;
            _this.startSourceSpan = startSourceSpan;
            _this.endSourceSpan = endSourceSpan;
            return _this;
        }
        Element.prototype.visit = function (visitor, context) {
            return visitor.visitElement(this, context);
        };
        return Element;
    }(NodeWithI18n));
    exports.Element = Element;
    var Comment = /** @class */ (function () {
        function Comment(value, sourceSpan) {
            this.value = value;
            this.sourceSpan = sourceSpan;
        }
        Comment.prototype.visit = function (visitor, context) {
            return visitor.visitComment(this, context);
        };
        return Comment;
    }());
    exports.Comment = Comment;
    function visitAll(visitor, nodes, context) {
        if (context === void 0) { context = null; }
        var result = [];
        var visit = visitor.visit ?
            function (ast) { return visitor.visit(ast, context) || ast.visit(visitor, context); } :
            function (ast) { return ast.visit(visitor, context); };
        nodes.forEach(function (ast) {
            var astResult = visit(ast);
            if (astResult) {
                result.push(astResult);
            }
        });
        return result;
    }
    exports.visitAll = visitAll;
    var RecursiveVisitor = /** @class */ (function () {
        function RecursiveVisitor() {
        }
        RecursiveVisitor.prototype.visitElement = function (ast, context) {
            this.visitChildren(context, function (visit) {
                visit(ast.attrs);
                visit(ast.children);
            });
        };
        RecursiveVisitor.prototype.visitAttribute = function (ast, context) { };
        RecursiveVisitor.prototype.visitText = function (ast, context) { };
        RecursiveVisitor.prototype.visitComment = function (ast, context) { };
        RecursiveVisitor.prototype.visitExpansion = function (ast, context) {
            return this.visitChildren(context, function (visit) {
                visit(ast.cases);
            });
        };
        RecursiveVisitor.prototype.visitExpansionCase = function (ast, context) { };
        RecursiveVisitor.prototype.visitChildren = function (context, cb) {
            var results = [];
            var t = this;
            function visit(children) {
                if (children)
                    results.push(visitAll(t, children, context));
            }
            cb(visit);
            return Array.prototype.concat.apply([], results);
        };
        return RecursiveVisitor;
    }());
    exports.RecursiveVisitor = RecursiveVisitor;
    function spanOf(ast) {
        var start = ast.sourceSpan.start.offset;
        var end = ast.sourceSpan.end.offset;
        if (ast instanceof Element) {
            if (ast.endSourceSpan) {
                end = ast.endSourceSpan.end.offset;
            }
            else if (ast.children && ast.children.length) {
                end = spanOf(ast.children[ast.children.length - 1]).end;
            }
        }
        return { start: start, end: end };
    }
    function findNode(nodes, position) {
        var path = [];
        var visitor = new /** @class */ (function (_super) {
            tslib_1.__extends(class_1, _super);
            function class_1() {
                return _super !== null && _super.apply(this, arguments) || this;
            }
            class_1.prototype.visit = function (ast, context) {
                var span = spanOf(ast);
                if (span.start <= position && position < span.end) {
                    path.push(ast);
                }
                else {
                    // Returning a value here will result in the children being skipped.
                    return true;
                }
            };
            return class_1;
        }(RecursiveVisitor));
        visitAll(visitor, nodes);
        return new ast_path_1.AstPath(path, position);
    }
    exports.findNode = findNode;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9hc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILDJEQUFvQztJQVNwQztRQUNFLHNCQUFtQixVQUEyQixFQUFTLElBQWU7WUFBbkQsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7WUFBUyxTQUFJLEdBQUosSUFBSSxDQUFXO1FBQUcsQ0FBQztRQUU1RSxtQkFBQztJQUFELENBQUMsQUFIRCxJQUdDO0lBSHFCLG9DQUFZO0lBS2xDO1FBQTBCLGdDQUFZO1FBQ3BDLGNBQW1CLEtBQWEsRUFBRSxVQUEyQixFQUFFLElBQWU7WUFBOUUsWUFDRSxrQkFBTSxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQ3hCO1lBRmtCLFdBQUssR0FBTCxLQUFLLENBQVE7O1FBRWhDLENBQUM7UUFDRCxvQkFBSyxHQUFMLFVBQU0sT0FBZ0IsRUFBRSxPQUFZO1lBQ2xDLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUNILFdBQUM7SUFBRCxDQUFDLEFBUEQsQ0FBMEIsWUFBWSxHQU9yQztJQVBZLG9CQUFJO0lBU2pCO1FBQStCLHFDQUFZO1FBQ3pDLG1CQUNXLFdBQW1CLEVBQVMsSUFBWSxFQUFTLEtBQXNCLEVBQzlFLFVBQTJCLEVBQVMscUJBQXNDLEVBQUUsSUFBZTtZQUYvRixZQUdFLGtCQUFNLFVBQVUsRUFBRSxJQUFJLENBQUMsU0FDeEI7WUFIVSxpQkFBVyxHQUFYLFdBQVcsQ0FBUTtZQUFTLFVBQUksR0FBSixJQUFJLENBQVE7WUFBUyxXQUFLLEdBQUwsS0FBSyxDQUFpQjtZQUMxQywyQkFBcUIsR0FBckIscUJBQXFCLENBQWlCOztRQUU5RSxDQUFDO1FBQ0QseUJBQUssR0FBTCxVQUFNLE9BQWdCLEVB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QUFLLE9BQUEsRUFBRSxHQUFHLEtBQUEsRUFBQyxDQUFDO0lBQ3RCLENBQUM7SUFFRCxTQUFnQixRQUFRLENBQUMsS0FBYSxFQUFFLFFBQWdCO1FBQ3RELElBQU0sSUFBSSxHQUFXLEVBQUUsQ0FBQztRQUV4QixJQUFNLE9BQU8sR0FBRztZQUFrQixtQ0FBZ0I7WUFBOUI7O1lBVXBCLENBQUM7WUFUQyx1QkFBSyxHQUFMLFVBQU0sR0FBUyxFQUFFLE9BQVk7Z0JBQzNCLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLFFBQVEsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRTtvQkFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDaEI7cUJBQU07b0JBQ0wsb0VBQW9FO29CQUNwRSxPQUFPLElBQUksQ0FBQztpQkFDYjtZQUNILENBQUM7WUFDSCxjQUFDO1FBQUQsQ0FBQyxBQVZtQixDQUFjLGdCQUFnQixFQVVqRCxDQUFDO1FBRUYsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV6QixPQUFPLElBQUksa0JBQU8sQ0FBTyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQWxCRCw0QkFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXN0UGF0aH0gZnJvbSAnLi4vYXN0X3BhdGgnO1xuaW1wb3J0IHtJMThuTWV0YX0gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgTm9kZVdpdGhJMThuIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIGFic3RyYWN0IHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIFRleHQgZXh0ZW5kcyBOb2RlV2l0aEkxOG4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBpMThuPzogSTE4bk1ldGEpIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuLCBpMThuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhwYW5zaW9uIGV4dGVuZHMgTm9kZVdpdGhJMThuIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3dpdGNoVmFsdWU6IHN0cmluZywgcHVibGljIHR5cGU6IHN0cmluZywgcHVibGljIGNhc2VzOiBFeHBhbnNpb25DYXNlW10sXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzd2l0Y2hWYWx1ZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaTE4bj86IEkxOG5NZXRhKSB7XG4gICAgc3VwZXIoc291cmNlU3BhbiwgaTE4bik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV4cGFuc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhwYW5zaW9uQ2FzZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgZXhwcmVzc2lvbjogTm9kZVtdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHZhbHVlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgZXhwU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFeHBhbnNpb25DYXNlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBdHRyaWJ1dGUgZXh0ZW5kcyBOb2RlV2l0aEkxOG4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuLCBpMThuPzogSTE4bk1ldGEpIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuLCBpMThuKTtcbiAgfVxuICB2aXNpdCh2aXNpdG9yOiBWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QXR0cmlidXRlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbGVtZW50IGV4dGVuZHMgTm9kZVdpdGhJMThuIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXR0cnM6IEF0dHJpYnV0ZVtdLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLFxuICAgICAgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgaTE4bj86IEkxOG5NZXRhKSB7XG4gICAgc3VwZXIoc291cmNlU3BhbiwgaTE4bik7XG4gIH1cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbW1lbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmd8bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbW1lbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBWaXNpdG9yIHtcbiAgLy8gUmV0dXJuaW5nIGEgdHJ1dGh5IHZhbHVlIGZyb20gYHZpc2l0KClgIHdpbGwgcHJldmVudCBgdmlzaXRBbGwoKWAgZnJvbSB0aGUgY2FsbCB0byB0aGUgdHlwZWRcbiAgLy8gbWV0aG9kIGFuZCByZXN1bHQgcmV0dXJuZWQgd2lsbCBiZWNvbWUgdGhlIHJlc3VsdCBpbmNsdWRlZCBpbiBgdmlzaXRBbGwoKWBzIHJlc3VsdCBhcnJheS5cbiAgdmlzaXQ/KG5vZGU6IE5vZGUsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRleHQodGV4dDogVGV4dCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdENvbW1lbnQoY29tbWVudDogQ29tbWVudCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IEV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRBbGwodmlzaXRvcjogVmlzaXRvciwgbm9kZXM6IE5vZGVbXSwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueVtdIHtcbiAgY29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuXG4gIGNvbnN0IHZpc2l0ID0gdmlzaXRvci52aXNpdCA/XG4gICAgICAoYXN0OiBOb2RlKSA9PiB2aXNpdG9yLnZpc2l0IShhc3QsIGNvbnRleHQpIHx8IGFzdC52aXNpdCh2aXNpdG9yLCBjb250ZXh0KSA6XG4gICAgICAoYXN0OiBOb2RlKSA9PiBhc3QudmlzaXQodmlzaXRvciwgY29udGV4dCk7XG4gIG5vZGVzLmZvckVhY2goYXN0ID0+IHtcbiAgICBjb25zdCBhc3RSZXN1bHQgPSB2aXNpdChhc3QpO1xuICAgIGlmIChhc3RSZXN1bHQpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGFzdFJlc3VsdCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZVZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoKSB7fVxuXG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdENoaWxkcmVuKGNvbnRleHQsIHZpc2l0ID0+IHtcbiAgICAgIHZpc2l0KGFzdC5hdHRycyk7XG4gICAgICB2aXNpdChhc3QuY2hpbGRyZW4pO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXN0OiBBdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFRleHQoYXN0OiBUZXh0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRDb21tZW50KGFzdDogQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgdmlzaXRFeHBhbnNpb24oYXN0OiBFeHBhbnNpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRDaGlsZHJlbihjb250ZXh0LCB2aXNpdCA9PiB7XG4gICAgICB2aXNpdChhc3QuY2FzZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGFzdDogRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgcHJpdmF0ZSB2aXNpdENoaWxkcmVuPFQgZXh0ZW5kcyBOb2RlPihcbiAgICAgIGNvbnRleHQ6IGFueSwgY2I6ICh2aXNpdDogKDxWIGV4dGVuZHMgTm9kZT4oY2hpbGRyZW46IFZbXXx1bmRlZmluZWQpID0+IHZvaWQpKSA9PiB2b2lkKSB7XG4gICAgbGV0IHJlc3VsdHM6IGFueVtdW10gPSBbXTtcbiAgICBsZXQgdCA9IHRoaXM7XG4gICAgZnVuY3Rpb24gdmlzaXQ8VCBleHRlbmRzIE5vZGU+KGNoaWxkcmVuOiBUW118dW5kZWZpbmVkKSB7XG4gICAgICBpZiAoY2hpbGRyZW4pIHJlc3VsdHMucHVzaCh2aXNpdEFsbCh0LCBjaGlsZHJlbiwgY29udGV4dCkpO1xuICAgIH1cbiAgICBjYih2aXNpdCk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sIHJlc3VsdHMpO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIEh0bWxBc3RQYXRoID0gQXN0UGF0aDxOb2RlPjtcblxuZnVuY3Rpb24gc3Bhbk9mKGFzdDogTm9kZSkge1xuICBjb25zdCBzdGFydCA9IGFzdC5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldDtcbiAgbGV0IGVuZCA9IGFzdC5zb3VyY2VTcGFuLmVuZC5vZmZzZXQ7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgaWYgKGFzdC5lbmRTb3VyY2VTcGFuKSB7XG4gICAgICBlbmQgPSBhc3QuZW5kU291cmNlU3Bhbi5lbmQub2Zmc2V0O1xuICAgIH0gZWxzZSBpZiAoYXN0LmNoaWxkcmVuICYmIGFzdC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgIGVuZCA9IHNwYW5PZihhc3QuY2hpbGRyZW5bYXN0LmNoaWxkcmVuLmxlbmd0aCAtIDFdKS5lbmQ7XG4gICAgfVxuICB9XG4gIHJldHVybiB7c3RhcnQsIGVuZH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaW5kTm9kZShub2RlczogTm9kZVtdLCBwb3NpdGlvbjogbnVtYmVyKTogSHRtbEFzdFBhdGgge1xuICBjb25zdCBwYXRoOiBOb2RlW10gPSBbXTtcblxuICBjb25zdCB2aXNpdG9yID0gbmV3IGNsYXNzIGV4dGVuZHMgUmVjdXJzaXZlVmlzaXRvciB7XG4gICAgdmlzaXQoYXN0OiBOb2RlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgICAgY29uc3Qgc3BhbiA9IHNwYW5PZihhc3QpO1xuICAgICAgaWYgKHNwYW4uc3RhcnQgPD0gcG9zaXRpb24gJiYgcG9zaXRpb24gPCBzcGFuLmVuZCkge1xuICAgICAgICBwYXRoLnB1c2goYXN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFJldHVybmluZyBhIHZhbHVlIGhlcmUgd2lsbCByZXN1bHQgaW4gdGhlIGNoaWxkcmVuIGJlaW5nIHNraXBwZWQuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICB2aXNpdEFsbCh2aXNpdG9yLCBub2Rlcyk7XG5cbiAgcmV0dXJuIG5ldyBBc3RQYXRoPE5vZGU+KHBhdGgsIHBvc2l0aW9uKTtcbn1cbiJdfQ==