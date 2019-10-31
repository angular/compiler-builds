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
        define("@angular/compiler/src/i18n/i18n_ast", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Message = /** @class */ (function () {
        /**
         * @param nodes message AST
         * @param placeholders maps placeholder names to static content
         * @param placeholderToMessage maps placeholder names to messages (used for nested ICU messages)
         * @param meaning
         * @param description
         * @param customId
         */
        function Message(nodes, placeholders, placeholderToMessage, meaning, description, customId) {
            this.nodes = nodes;
            this.placeholders = placeholders;
            this.placeholderToMessage = placeholderToMessage;
            this.meaning = meaning;
            this.description = description;
            this.customId = customId;
            this.id = this.customId;
            /** The id to use if there is no custom id and if `i18nLegacyMessageIdFormat` is not empty */
            this.legacyId = '';
            if (nodes.length) {
                this.sources = [{
                        filePath: nodes[0].sourceSpan.start.file.url,
                        startLine: nodes[0].sourceSpan.start.line + 1,
                        startCol: nodes[0].sourceSpan.start.col + 1,
                        endLine: nodes[nodes.length - 1].sourceSpan.end.line + 1,
                        endCol: nodes[0].sourceSpan.start.col + 1
                    }];
            }
            else {
                this.sources = [];
            }
        }
        return Message;
    }());
    exports.Message = Message;
    var Text = /** @class */ (function () {
        function Text(value, sourceSpan) {
            this.value = value;
            this.sourceSpan = sourceSpan;
        }
        Text.prototype.visit = function (visitor, context) { return visitor.visitText(this, context); };
        return Text;
    }());
    exports.Text = Text;
    // TODO(vicb): do we really need this node (vs an array) ?
    var Container = /** @class */ (function () {
        function Container(children, sourceSpan) {
            this.children = children;
            this.sourceSpan = sourceSpan;
        }
        Container.prototype.visit = function (visitor, context) { return visitor.visitContainer(this, context); };
        return Container;
    }());
    exports.Container = Container;
    var Icu = /** @class */ (function () {
        function Icu(expression, type, cases, sourceSpan) {
            this.expression = expression;
            this.type = type;
            this.cases = cases;
            this.sourceSpan = sourceSpan;
        }
        Icu.prototype.visit = function (visitor, context) { return visitor.visitIcu(this, context); };
        return Icu;
    }());
    exports.Icu = Icu;
    var TagPlaceholder = /** @class */ (function () {
        function TagPlaceholder(tag, attrs, startName, closeName, children, isVoid, sourceSpan) {
            this.tag = tag;
            this.attrs = attrs;
            this.startName = startName;
            this.closeName = closeName;
            this.children = children;
            this.isVoid = isVoid;
            this.sourceSpan = sourceSpan;
        }
        TagPlaceholder.prototype.visit = function (visitor, context) { return visitor.visitTagPlaceholder(this, context); };
        return TagPlaceholder;
    }());
    exports.TagPlaceholder = TagPlaceholder;
    var Placeholder = /** @class */ (function () {
        function Placeholder(value, name, sourceSpan) {
            this.value = value;
            this.name = name;
            this.sourceSpan = sourceSpan;
        }
        Placeholder.prototype.visit = function (visitor, context) { return visitor.visitPlaceholder(this, context); };
        return Placeholder;
    }());
    exports.Placeholder = Placeholder;
    var IcuPlaceholder = /** @class */ (function () {
        function IcuPlaceholder(value, name, sourceSpan) {
            this.value = value;
            this.name = name;
            this.sourceSpan = sourceSpan;
        }
        IcuPlaceholder.prototype.visit = function (visitor, context) { return visitor.visitIcuPlaceholder(this, context); };
        return IcuPlaceholder;
    }());
    exports.IcuPlaceholder = IcuPlaceholder;
    // Clone the AST
    var CloneVisitor = /** @class */ (function () {
        function CloneVisitor() {
        }
        CloneVisitor.prototype.visitText = function (text, context) { return new Text(text.value, text.sourceSpan); };
        CloneVisitor.prototype.visitContainer = function (container, context) {
            var _this = this;
            var children = container.children.map(function (n) { return n.visit(_this, context); });
            return new Container(children, container.sourceSpan);
        };
        CloneVisitor.prototype.visitIcu = function (icu, context) {
            var _this = this;
            var cases = {};
            Object.keys(icu.cases).forEach(function (key) { return cases[key] = icu.cases[key].visit(_this, context); });
            var msg = new Icu(icu.expression, icu.type, cases, icu.sourceSpan);
            msg.expressionPlaceholder = icu.expressionPlaceholder;
            return msg;
        };
        CloneVisitor.prototype.visitTagPlaceholder = function (ph, context) {
            var _this = this;
            var children = ph.children.map(function (n) { return n.visit(_this, context); });
            return new TagPlaceholder(ph.tag, ph.attrs, ph.startName, ph.closeName, children, ph.isVoid, ph.sourceSpan);
        };
        CloneVisitor.prototype.visitPlaceholder = function (ph, context) {
            return new Placeholder(ph.value, ph.name, ph.sourceSpan);
        };
        CloneVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            return new IcuPlaceholder(ph.value, ph.name, ph.sourceSpan);
        };
        return CloneVisitor;
    }());
    exports.CloneVisitor = CloneVisitor;
    // Visit all the nodes recursively
    var RecurseVisitor = /** @class */ (function () {
        function RecurseVisitor() {
        }
        RecurseVisitor.prototype.visitText = function (text, context) { };
        RecurseVisitor.prototype.visitContainer = function (container, context) {
            var _this = this;
            container.children.forEach(function (child) { return child.visit(_this); });
        };
        RecurseVisitor.prototype.visitIcu = function (icu, context) {
            var _this = this;
            Object.keys(icu.cases).forEach(function (k) { icu.cases[k].visit(_this); });
        };
        RecurseVisitor.prototype.visitTagPlaceholder = function (ph, context) {
            var _this = this;
            ph.children.forEach(function (child) { return child.visit(_this); });
        };
        RecurseVisitor.prototype.visitPlaceholder = function (ph, context) { };
        RecurseVisitor.prototype.visitIcuPlaceholder = function (ph, context) { };
        return RecurseVisitor;
    }());
    exports.RecurseVisitor = RecurseVisitor;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9hc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlIO1FBTUU7Ozs7Ozs7V0FPRztRQUNILGlCQUNXLEtBQWEsRUFBUyxZQUF3QyxFQUM5RCxvQkFBaUQsRUFBUyxPQUFlLEVBQ3pFLFdBQW1CLEVBQVMsUUFBZ0I7WUFGNUMsVUFBSyxHQUFMLEtBQUssQ0FBUTtZQUFTLGlCQUFZLEdBQVosWUFBWSxDQUE0QjtZQUM5RCx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQTZCO1lBQVMsWUFBTyxHQUFQLE9BQU8sQ0FBUTtZQUN6RSxnQkFBVyxHQUFYLFdBQVcsQ0FBUTtZQUFTLGFBQVEsR0FBUixRQUFRLENBQVE7WUFmdkQsT0FBRSxHQUFXLElBQUksQ0FBQyxRQUFRLENBQUM7WUFDM0IsNkZBQTZGO1lBQzdGLGFBQVEsR0FBWSxFQUFFLENBQUM7WUFjckIsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO2dCQUNoQixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUM7d0JBQ2QsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHO3dCQUM1QyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUM7d0JBQzdDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQzt3QkFDM0MsT0FBTyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUM7d0JBQ3hE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VUFBVSxJQUFVLEVBQUUsT0FBYSxJQUFRLENBQUM7UUFFNUMsdUNBQWMsR0FBZCxVQUFlLFNBQW9CLEVBQUUsT0FBYTtZQUFsRCxpQkFFQztZQURDLFNBQVMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRCxpQ0FBUSxHQUFSLFVBQVMsR0FBUSxFQUFFLE9BQWE7WUFBaEMsaUJBRUM7WUFEQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBRUQsNENBQW1CLEdBQW5CLFVBQW9CLEVBQWtCLEVBQUUsT0FBYTtZQUFyRCxpQkFFQztZQURDLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFFRCx5Q0FBZ0IsR0FBaEIsVUFBaUIsRUFBZSxFQUFFLE9BQWEsSUFBUSxDQUFDO1FBRXhELDRDQUFtQixHQUFuQixVQUFvQixFQUFrQixFQUFFLE9BQWEsSUFBUSxDQUFDO1FBQ2hFLHFCQUFDO0lBQUQsQ0FBQyxBQWxCRCxJQWtCQztJQWxCWSx3Q0FBYyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgTWVzc2FnZSB7XG4gIHNvdXJjZXM6IE1lc3NhZ2VTcGFuW107XG4gIGlkOiBzdHJpbmcgPSB0aGlzLmN1c3RvbUlkO1xuICAvKiogVGhlIGlkIHRvIHVzZSBpZiB0aGVyZSBpcyBubyBjdXN0b20gaWQgYW5kIGlmIGBpMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0YCBpcyBub3QgZW1wdHkgKi9cbiAgbGVnYWN5SWQ/OiBzdHJpbmcgPSAnJztcblxuICAvKipcbiAgICogQHBhcmFtIG5vZGVzIG1lc3NhZ2UgQVNUXG4gICAqIEBwYXJhbSBwbGFjZWhvbGRlcnMgbWFwcyBwbGFjZWhvbGRlciBuYW1lcyB0byBzdGF0aWMgY29udGVudFxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXJUb01lc3NhZ2UgbWFwcyBwbGFjZWhvbGRlciBuYW1lcyB0byBtZXNzYWdlcyAodXNlZCBmb3IgbmVzdGVkIElDVSBtZXNzYWdlcylcbiAgICogQHBhcmFtIG1lYW5pbmdcbiAgICogQHBhcmFtIGRlc2NyaXB0aW9uXG4gICAqIEBwYXJhbSBjdXN0b21JZFxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbm9kZXM6IE5vZGVbXSwgcHVibGljIHBsYWNlaG9sZGVyczoge1twaE5hbWU6IHN0cmluZ106IHN0cmluZ30sXG4gICAgICBwdWJsaWMgcGxhY2Vob2xkZXJUb01lc3NhZ2U6IHtbcGhOYW1lOiBzdHJpbmddOiBNZXNzYWdlfSwgcHVibGljIG1lYW5pbmc6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBkZXNjcmlwdGlvbjogc3RyaW5nLCBwdWJsaWMgY3VzdG9tSWQ6IHN0cmluZykge1xuICAgIGlmIChub2Rlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuc291cmNlcyA9IFt7XG4gICAgICAgIGZpbGVQYXRoOiBub2Rlc1swXS5zb3VyY2VTcGFuLnN0YXJ0LmZpbGUudXJsLFxuICAgICAgICBzdGFydExpbmU6IG5vZGVzWzBdLnNvdXJjZVNwYW4uc3RhcnQubGluZSArIDEsXG4gICAgICAgIHN0YXJ0Q29sOiBub2Rlc1swXS5zb3VyY2VTcGFuLnN0YXJ0LmNvbCArIDEsXG4gICAgICAgIGVuZExpbmU6IG5vZGVzW25vZGVzLmxlbmd0aCAtIDFdLnNvdXJjZVNwYW4uZW5kLmxpbmUgKyAxLFxuICAgICAgICBlbmRDb2w6IG5vZGVzWzBdLnNvdXJjZVNwYW4uc3RhcnQuY29sICsgMVxuICAgICAgfV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc291cmNlcyA9IFtdO1xuICAgIH1cbiAgfVxufVxuXG4vLyBsaW5lIGFuZCBjb2x1bW5zIGluZGV4ZXMgYXJlIDEgYmFzZWRcbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZVNwYW4ge1xuICBmaWxlUGF0aDogc3RyaW5nO1xuICBzdGFydExpbmU6IG51bWJlcjtcbiAgc3RhcnRDb2w6IG51bWJlcjtcbiAgZW5kTGluZTogbnVtYmVyO1xuICBlbmRDb2w6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb2RlIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2aXNpdCh2aXNpdG9yOiBWaXNpdG9yLCBjb250ZXh0PzogYW55KTogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICB2aXNpdCh2aXNpdG9yOiBWaXNpdG9yLCBjb250ZXh0PzogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRUZXh0KHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbi8vIFRPRE8odmljYik6IGRvIHdlIHJlYWxseSBuZWVkIHRoaXMgbm9kZSAodnMgYW4gYXJyYXkpID9cbmV4cG9ydCBjbGFzcyBDb250YWluZXIgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dD86IGFueSk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0Q29udGFpbmVyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBJY3UgaW1wbGVtZW50cyBOb2RlIHtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHB1YmxpYyBleHByZXNzaW9uUGxhY2Vob2xkZXIgITogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBzdHJpbmcsIHB1YmxpYyBjYXNlczoge1trOiBzdHJpbmddOiBOb2RlfSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dD86IGFueSk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0SWN1KHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUYWdQbGFjZWhvbGRlciBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0YWc6IHN0cmluZywgcHVibGljIGF0dHJzOiB7W2s6IHN0cmluZ106IHN0cmluZ30sIHB1YmxpYyBzdGFydE5hbWU6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBjbG9zZU5hbWU6IHN0cmluZywgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBpc1ZvaWQ6IGJvb2xlYW4sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ/OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdFRhZ1BsYWNlaG9sZGVyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBQbGFjZWhvbGRlciBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICB2aXNpdCh2aXNpdG9yOiBWaXNpdG9yLCBjb250ZXh0PzogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRQbGFjZWhvbGRlcih0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgSWN1UGxhY2Vob2xkZXIgaW1wbGVtZW50cyBOb2RlIHtcbiAgLyoqIFVzZWQgdG8gY2FwdHVyZSBhIG1lc3NhZ2UgY29tcHV0ZWQgZnJvbSBhIHByZXZpb3VzIHByb2Nlc3NpbmcgcGFzcyAoc2VlIGBzZXRJMThuUmVmcygpYCkuICovXG4gIHByZXZpb3VzTWVzc2FnZT86IE1lc3NhZ2U7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogSWN1LCBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ/OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdEljdVBsYWNlaG9sZGVyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbi8qKlxuICogRWFjaCBIVE1MIG5vZGUgdGhhdCBpcyBhZmZlY3QgYnkgYW4gaTE4biB0YWcgd2lsbCBhbHNvIGhhdmUgYW4gYGkxOG5gIHByb3BlcnR5IHRoYXQgaXMgb2YgdHlwZVxuICogYEkxOG5NZXRhYC5cbiAqIFRoaXMgaW5mb3JtYXRpb24gaXMgZWl0aGVyIGEgYE1lc3NhZ2VgLCB3aGljaCBpbmRpY2F0ZXMgaXQgaXMgdGhlIHJvb3Qgb2YgYW4gaTE4biBtZXNzYWdlLCBvciBhXG4gKiBgTm9kZWAsIHdoaWNoIGluZGljYXRlcyBpcyBpdCBwYXJ0IG9mIGEgY29udGFpbmluZyBgTWVzc2FnZWAuXG4gKi9cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0gTWVzc2FnZSB8IE5vZGU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlzaXRvciB7XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0LCBjb250ZXh0PzogYW55KTogYW55O1xuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IENvbnRhaW5lciwgY29udGV4dD86IGFueSk6IGFueTtcbiAgdmlzaXRJY3UoaWN1OiBJY3UsIGNvbnRleHQ/OiBhbnkpOiBhbnk7XG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IFRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55O1xuICB2aXNpdFBsYWNlaG9sZGVyKHBoOiBQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueTtcbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnk7XG59XG5cbi8vIENsb25lIHRoZSBBU1RcbmV4cG9ydCBjbGFzcyBDbG9uZVZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQsIGNvbnRleHQ/OiBhbnkpOiBUZXh0IHsgcmV0dXJuIG5ldyBUZXh0KHRleHQudmFsdWUsIHRleHQuc291cmNlU3Bhbik7IH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IENvbnRhaW5lciwgY29udGV4dD86IGFueSk6IENvbnRhaW5lciB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBjb250YWluZXIuY2hpbGRyZW4ubWFwKG4gPT4gbi52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBDb250YWluZXIoY2hpbGRyZW4sIGNvbnRhaW5lci5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogSWN1LCBjb250ZXh0PzogYW55KTogSWN1IHtcbiAgICBjb25zdCBjYXNlczoge1trOiBzdHJpbmddOiBOb2RlfSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKGljdS5jYXNlcykuZm9yRWFjaChrZXkgPT4gY2FzZXNba2V5XSA9IGljdS5jYXNlc1trZXldLnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICBjb25zdCBtc2cgPSBuZXcgSWN1KGljdS5leHByZXNzaW9uLCBpY3UudHlwZSwgY2FzZXMsIGljdS5zb3VyY2VTcGFuKTtcbiAgICBtc2cuZXhwcmVzc2lvblBsYWNlaG9sZGVyID0gaWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlcjtcbiAgICByZXR1cm4gbXNnO1xuICB9XG5cbiAgdmlzaXRUYWdQbGFjZWhvbGRlcihwaDogVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBUYWdQbGFjZWhvbGRlciB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBwaC5jaGlsZHJlbi5tYXAobiA9PiBuLnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbmV3IFRhZ1BsYWNlaG9sZGVyKFxuICAgICAgICBwaC50YWcsIHBoLmF0dHJzLCBwaC5zdGFydE5hbWUsIHBoLmNsb3NlTmFtZSwgY2hpbGRyZW4sIHBoLmlzVm9pZCwgcGguc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdFBsYWNlaG9sZGVyKHBoOiBQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IFBsYWNlaG9sZGVyIHtcbiAgICByZXR1cm4gbmV3IFBsYWNlaG9sZGVyKHBoLnZhbHVlLCBwaC5uYW1lLCBwaC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IEljdVBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogSWN1UGxhY2Vob2xkZXIge1xuICAgIHJldHVybiBuZXcgSWN1UGxhY2Vob2xkZXIocGgudmFsdWUsIHBoLm5hbWUsIHBoLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cbi8vIFZpc2l0IGFsbCB0aGUgbm9kZXMgcmVjdXJzaXZlbHlcbmV4cG9ydCBjbGFzcyBSZWN1cnNlVmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICB2aXNpdFRleHQodGV4dDogVGV4dCwgY29udGV4dD86IGFueSk6IGFueSB7fVxuXG4gIHZpc2l0Q29udGFpbmVyKGNvbnRhaW5lcjogQ29udGFpbmVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICBjb250YWluZXIuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IEljdSwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgT2JqZWN0LmtleXMoaWN1LmNhc2VzKS5mb3JFYWNoKGsgPT4geyBpY3UuY2FzZXNba10udmlzaXQodGhpcyk7IH0pO1xuICB9XG5cbiAgdmlzaXRUYWdQbGFjZWhvbGRlcihwaDogVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIHBoLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRQbGFjZWhvbGRlcihwaDogUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge31cblxuICB2aXNpdEljdVBsYWNlaG9sZGVyKHBoOiBJY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueSB7fVxufVxuIl19