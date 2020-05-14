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
        define("@angular/compiler/src/i18n/serializers/xml_helper", ["require", "exports", "tslib"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.escapeXml = exports.CR = exports.Text = exports.Tag = exports.Doctype = exports.Declaration = exports.serialize = void 0;
    var tslib_1 = require("tslib");
    var _Visitor = /** @class */ (function () {
        function _Visitor() {
        }
        _Visitor.prototype.visitTag = function (tag) {
            var _this = this;
            var strAttrs = this._serializeAttributes(tag.attrs);
            if (tag.children.length == 0) {
                return "<" + tag.name + strAttrs + "/>";
            }
            var strChildren = tag.children.map(function (node) { return node.visit(_this); });
            return "<" + tag.name + strAttrs + ">" + strChildren.join('') + "</" + tag.name + ">";
        };
        _Visitor.prototype.visitText = function (text) {
            return text.value;
        };
        _Visitor.prototype.visitDeclaration = function (decl) {
            return "<?xml" + this._serializeAttributes(decl.attrs) + " ?>";
        };
        _Visitor.prototype._serializeAttributes = function (attrs) {
            var strAttrs = Object.keys(attrs).map(function (name) { return name + "=\"" + attrs[name] + "\""; }).join(' ');
            return strAttrs.length > 0 ? ' ' + strAttrs : '';
        };
        _Visitor.prototype.visitDoctype = function (doctype) {
            return "<!DOCTYPE " + doctype.rootTag + " [\n" + doctype.dtd + "\n]>";
        };
        return _Visitor;
    }());
    var _visitor = new _Visitor();
    function serialize(nodes) {
        return nodes.map(function (node) { return node.visit(_visitor); }).join('');
    }
    exports.serialize = serialize;
    var Declaration = /** @class */ (function () {
        function Declaration(unescapedAttrs) {
            var _this = this;
            this.attrs = {};
            Object.keys(unescapedAttrs).forEach(function (k) {
                _this.attrs[k] = escapeXml(unescapedAttrs[k]);
            });
        }
        Declaration.prototype.visit = function (visitor) {
            return visitor.visitDeclaration(this);
        };
        return Declaration;
    }());
    exports.Declaration = Declaration;
    var Doctype = /** @class */ (function () {
        function Doctype(rootTag, dtd) {
            this.rootTag = rootTag;
            this.dtd = dtd;
        }
        Doctype.prototype.visit = function (visitor) {
            return visitor.visitDoctype(this);
        };
        return Doctype;
    }());
    exports.Doctype = Doctype;
    var Tag = /** @class */ (function () {
        function Tag(name, unescapedAttrs, children) {
            var _this = this;
            if (unescapedAttrs === void 0) { unescapedAttrs = {}; }
            if (children === void 0) { children = []; }
            this.name = name;
            this.children = children;
            this.attrs = {};
            Object.keys(unescapedAttrs).forEach(function (k) {
                _this.attrs[k] = escapeXml(unescapedAttrs[k]);
            });
        }
        Tag.prototype.visit = function (visitor) {
            return visitor.visitTag(this);
        };
        return Tag;
    }());
    exports.Tag = Tag;
    var Text = /** @class */ (function () {
        function Text(unescapedValue) {
            this.value = escapeXml(unescapedValue);
        }
        Text.prototype.visit = function (visitor) {
            return visitor.visitText(this);
        };
        return Text;
    }());
    exports.Text = Text;
    var CR = /** @class */ (function (_super) {
        tslib_1.__extends(CR, _super);
        function CR(ws) {
            if (ws === void 0) { ws = 0; }
            return _super.call(this, "\n" + new Array(ws + 1).join(' ')) || this;
        }
        return CR;
    }(Text));
    exports.CR = CR;
    var _ESCAPED_CHARS = [
        [/&/g, '&amp;'],
        [/"/g, '&quot;'],
        [/'/g, '&apos;'],
        [/</g, '&lt;'],
        [/>/g, '&gt;'],
    ];
    // Escape `_ESCAPED_CHARS` characters in the given text with encoded entities
    function escapeXml(text) {
        return _ESCAPED_CHARS.reduce(function (text, entry) { return text.replace(entry[0], entry[1]); }, text);
    }
    exports.escapeXml = escapeXml;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieG1sX2hlbHBlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9pMThuL3NlcmlhbGl6ZXJzL3htbF9oZWxwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQVNIO1FBQUE7UUE0QkEsQ0FBQztRQTNCQywyQkFBUSxHQUFSLFVBQVMsR0FBUTtZQUFqQixpQkFTQztZQVJDLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFdEQsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Z0JBQzVCLE9BQU8sTUFBSSxHQUFHLENBQUMsSUFBSSxHQUFHLFFBQVEsT0FBSSxDQUFDO2FBQ3BDO1lBRUQsSUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFoQixDQUFnQixDQUFDLENBQUM7WUFDL0QsT0FBTyxNQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUcsUUFBUSxTQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQUssR0FBRyxDQUFDLElBQUksTUFBRyxDQUFDO1FBQ3pFLENBQUM7UUFFRCw0QkFBUyxHQUFULFVBQVUsSUFBVTtZQUNsQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDcEIsQ0FBQztRQUVELG1DQUFnQixHQUFoQixVQUFpQixJQUFpQjtZQUNoQyxPQUFPLFVBQVEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBSyxDQUFDO1FBQzVELENBQUM7UUFFTyx1Q0FBb0IsR0FBNUIsVUFBNkIsS0FBNEI7WUFDdkQsSUFBTSxRQUFRLEdBQUcsTUFB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QUFJLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQ0gsV0FBQztJQUFELENBQUMsQUFURCxJQVNDO0lBVFksb0JBQUk7SUFXakI7UUFBd0IsOEJBQUk7UUFDMUIsWUFBWSxFQUFjO1lBQWQsbUJBQUEsRUFBQSxNQUFjO21CQUN4QixrQkFBTSxPQUFLLElBQUksS0FBSyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFHLENBQUM7UUFDM0MsQ0FBQztRQUNILFNBQUM7SUFBRCxDQUFDLEFBSkQsQ0FBd0IsSUFBSSxHQUkzQjtJQUpZLGdCQUFFO0lBTWYsSUFBTSxjQUFjLEdBQXVCO1FBQ3pDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztRQUNmLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQztRQUNoQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUM7UUFDaEIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDO1FBQ2QsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDO0tBQ2YsQ0FBQztJQUVGLDZFQUE2RTtJQUM3RSxTQUFnQixTQUFTLENBQUMsSUFBWTtRQUNwQyxPQUFPLGNBQWMsQ0FBQyxNQUFNLENBQ3hCLFVBQUMsSUFBWSxFQUFFLEtBQXVCLElBQUssT0FBQSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBaEMsQ0FBZ0MsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6RixDQUFDO0lBSEQsOEJBR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpc2l0b3Ige1xuICB2aXNpdFRhZyh0YWc6IFRhZyk6IGFueTtcbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiBhbnk7XG4gIHZpc2l0RGVjbGFyYXRpb24oZGVjbDogRGVjbGFyYXRpb24pOiBhbnk7XG4gIHZpc2l0RG9jdHlwZShkb2N0eXBlOiBEb2N0eXBlKTogYW55O1xufVxuXG5jbGFzcyBfVmlzaXRvciBpbXBsZW1lbnRzIElWaXNpdG9yIHtcbiAgdmlzaXRUYWcodGFnOiBUYWcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0ckF0dHJzID0gdGhpcy5fc2VyaWFsaXplQXR0cmlidXRlcyh0YWcuYXR0cnMpO1xuXG4gICAgaWYgKHRhZy5jaGlsZHJlbi5sZW5ndGggPT0gMCkge1xuICAgICAgcmV0dXJuIGA8JHt0YWcubmFtZX0ke3N0ckF0dHJzfS8+YDtcbiAgICB9XG5cbiAgICBjb25zdCBzdHJDaGlsZHJlbiA9IHRhZy5jaGlsZHJlbi5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICByZXR1cm4gYDwke3RhZy5uYW1lfSR7c3RyQXR0cnN9PiR7c3RyQ2hpbGRyZW4uam9pbignJyl9PC8ke3RhZy5uYW1lfT5gO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiBzdHJpbmcge1xuICAgIHJldHVybiB0ZXh0LnZhbHVlO1xuICB9XG5cbiAgdmlzaXREZWNsYXJhdGlvbihkZWNsOiBEZWNsYXJhdGlvbik6IHN0cmluZyB7XG4gICAgcmV0dXJuIGA8P3htbCR7dGhpcy5fc2VyaWFsaXplQXR0cmlidXRlcyhkZWNsLmF0dHJzKX0gPz5gO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9KSB7XG4gICAgY29uc3Qgc3RyQXR0cnMgPSBPYmplY3Qua2V5cyhhdHRycykubWFwKChuYW1lOiBzdHJpbmcpID0+IGAke25hbWV9PVwiJHthdHRyc1tuYW1lXX1cImApLmpvaW4oJyAnKTtcbiAgICByZXR1cm4gc3RyQXR0cnMubGVuZ3RoID4gMCA/ICcgJyArIHN0ckF0dHJzIDogJyc7XG4gIH1cblxuICB2aXNpdERvY3R5cGUoZG9jdHlwZTogRG9jdHlwZSk6IGFueSB7XG4gICAgcmV0dXJuIGA8IURPQ1RZUEUgJHtkb2N0eXBlLnJvb3RUYWd9IFtcXG4ke2RvY3R5cGUuZHRkfVxcbl0+YDtcbiAgfVxufVxuXG5jb25zdCBfdmlzaXRvciA9IG5ldyBfVmlzaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplKG5vZGVzOiBOb2RlW10pOiBzdHJpbmcge1xuICByZXR1cm4gbm9kZXMubWFwKChub2RlOiBOb2RlKTogc3RyaW5nID0+IG5vZGUudmlzaXQoX3Zpc2l0b3IpKS5qb2luKCcnKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb2RlIHtcbiAgdmlzaXQodmlzaXRvcjogSVZpc2l0b3IpOiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBEZWNsYXJhdGlvbiBpbXBsZW1lbnRzIE5vZGUge1xuICBwdWJsaWMgYXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIGNvbnN0cnVjdG9yKHVuZXNjYXBlZEF0dHJzOiB7W2s6IHN0cmluZ106IHN0cmluZ30pIHtcbiAgICBPYmplY3Qua2V5cyh1bmVzY2FwZWRBdHRycykuZm9yRWFjaCgoazogc3RyaW5nKSA9PiB7XG4gICAgICB0aGlzLmF0dHJzW2tdID0gZXNjYXBlWG1sKHVuZXNjYXBlZEF0dHJzW2tdKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0KHZpc2l0b3I6IElWaXNpdG9yKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlY2xhcmF0aW9uKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEb2N0eXBlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByb290VGFnOiBzdHJpbmcsIHB1YmxpYyBkdGQ6IHN0cmluZykge31cblxuICB2aXNpdCh2aXNpdG9yOiBJVmlzaXRvcik6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREb2N0eXBlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUYWcgaW1wbGVtZW50cyBOb2RlIHtcbiAgcHVibGljIGF0dHJzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHVuZXNjYXBlZEF0dHJzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7fSxcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdID0gW10pIHtcbiAgICBPYmplY3Qua2V5cyh1bmVzY2FwZWRBdHRycykuZm9yRWFjaCgoazogc3RyaW5nKSA9PiB7XG4gICAgICB0aGlzLmF0dHJzW2tdID0gZXNjYXBlWG1sKHVuZXNjYXBlZEF0dHJzW2tdKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0KHZpc2l0b3I6IElWaXNpdG9yKTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRhZyh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjb25zdHJ1Y3Rvcih1bmVzY2FwZWRWYWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy52YWx1ZSA9IGVzY2FwZVhtbCh1bmVzY2FwZWRWYWx1ZSk7XG4gIH1cblxuICB2aXNpdCh2aXNpdG9yOiBJVmlzaXRvcik6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUZXh0KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDUiBleHRlbmRzIFRleHQge1xuICBjb25zdHJ1Y3Rvcih3czogbnVtYmVyID0gMCkge1xuICAgIHN1cGVyKGBcXG4ke25ldyBBcnJheSh3cyArIDEpLmpvaW4oJyAnKX1gKTtcbiAgfVxufVxuXG5jb25zdCBfRVNDQVBFRF9DSEFSUzogW1JlZ0V4cCwgc3RyaW5nXVtdID0gW1xuICBbLyYvZywgJyZhbXA7J10sXG4gIFsvXCIvZywgJyZxdW90OyddLFxuICBbLycvZywgJyZhcG9zOyddLFxuICBbLzwvZywgJyZsdDsnXSxcbiAgWy8+L2csICcmZ3Q7J10sXG5dO1xuXG4vLyBFc2NhcGUgYF9FU0NBUEVEX0NIQVJTYCBjaGFyYWN0ZXJzIGluIHRoZSBnaXZlbiB0ZXh0IHdpdGggZW5jb2RlZCBlbnRpdGllc1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZVhtbCh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gX0VTQ0FQRURfQ0hBUlMucmVkdWNlKFxuICAgICAgKHRleHQ6IHN0cmluZywgZW50cnk6IFtSZWdFeHAsIHN0cmluZ10pID0+IHRleHQucmVwbGFjZShlbnRyeVswXSwgZW50cnlbMV0pLCB0ZXh0KTtcbn1cbiJdfQ==