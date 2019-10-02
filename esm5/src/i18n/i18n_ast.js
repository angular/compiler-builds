/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var Message = /** @class */ (function () {
    /**
     * @param nodes message AST
     * @param placeholders maps placeholder names to static content
     * @param placeholderToMessage maps placeholder names to messages (used for nested ICU messages)
     * @param meaning
     * @param description
     * @param id
     */
    function Message(nodes, placeholders, placeholderToMessage, meaning, description, customId) {
        this.nodes = nodes;
        this.placeholders = placeholders;
        this.placeholderToMessage = placeholderToMessage;
        this.meaning = meaning;
        this.description = description;
        this.customId = customId;
        this.id = this.customId;
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
export { Message };
var Text = /** @class */ (function () {
    function Text(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    Text.prototype.visit = function (visitor, context) { return visitor.visitText(this, context); };
    return Text;
}());
export { Text };
// TODO(vicb): do we really need this node (vs an array) ?
var Container = /** @class */ (function () {
    function Container(children, sourceSpan) {
        this.children = children;
        this.sourceSpan = sourceSpan;
    }
    Container.prototype.visit = function (visitor, context) { return visitor.visitContainer(this, context); };
    return Container;
}());
export { Container };
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
export { Icu };
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
export { TagPlaceholder };
var Placeholder = /** @class */ (function () {
    function Placeholder(value, name, sourceSpan) {
        this.value = value;
        this.name = name;
        this.sourceSpan = sourceSpan;
    }
    Placeholder.prototype.visit = function (visitor, context) { return visitor.visitPlaceholder(this, context); };
    return Placeholder;
}());
export { Placeholder };
var IcuPlaceholder = /** @class */ (function () {
    function IcuPlaceholder(value, name, sourceSpan) {
        this.value = value;
        this.name = name;
        this.sourceSpan = sourceSpan;
    }
    IcuPlaceholder.prototype.visit = function (visitor, context) { return visitor.visitIcuPlaceholder(this, context); };
    return IcuPlaceholder;
}());
export { IcuPlaceholder };
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
export { CloneVisitor };
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
export { RecurseVisitor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9hc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSDtJQUlFOzs7Ozs7O09BT0c7SUFDSCxpQkFDVyxLQUFhLEVBQVMsWUFBd0MsRUFDOUQsb0JBQWlELEVBQVMsT0FBZSxFQUN6RSxXQUFtQixFQUFTLFFBQWdCO1FBRjVDLFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxpQkFBWSxHQUFaLFlBQVksQ0FBNEI7UUFDOUQseUJBQW9CLEdBQXBCLG9CQUFvQixDQUE2QjtRQUFTLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFDekUsZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBYnZELE9BQUUsR0FBVyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBY3pCLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUNoQixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUM7b0JBQ2QsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHO29CQUM1QyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUM7b0JBQzdDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQztvQkFDM0MsT0FBTyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUM7b0JBQ3hELE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxD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QUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFqQixDQUFpQixDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVELGlDQUFRLEdBQVIsVUFBUyxHQUFRLEVBQUUsT0FBYTtRQUFoQyxpQkFFQztRQURDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7SUFFRCw0Q0FBbUIsR0FBbkIsVUFBb0IsRUFBa0IsRUFBRSxPQUFhO1FBQXJELGlCQUVDO1FBREMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFqQixDQUFpQixDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELHlDQUFnQixHQUFoQixVQUFpQixFQUFlLEVBQUUsT0FBYSxJQUFRLENBQUM7SUFFeEQsNENBQW1CLEdBQW5CLFVBQW9CLEVBQWtCLEVBQUUsT0FBYSxJQUFRLENBQUM7SUFDaEUscUJBQUM7QUFBRCxDQUFDLEFBbEJELElBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBNZXNzYWdlIHtcbiAgc291cmNlczogTWVzc2FnZVNwYW5bXTtcbiAgaWQ6IHN0cmluZyA9IHRoaXMuY3VzdG9tSWQ7XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBub2RlcyBtZXNzYWdlIEFTVFxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXJzIG1hcHMgcGxhY2Vob2xkZXIgbmFtZXMgdG8gc3RhdGljIGNvbnRlbnRcbiAgICogQHBhcmFtIHBsYWNlaG9sZGVyVG9NZXNzYWdlIG1hcHMgcGxhY2Vob2xkZXIgbmFtZXMgdG8gbWVzc2FnZXMgKHVzZWQgZm9yIG5lc3RlZCBJQ1UgbWVzc2FnZXMpXG4gICAqIEBwYXJhbSBtZWFuaW5nXG4gICAqIEBwYXJhbSBkZXNjcmlwdGlvblxuICAgKiBAcGFyYW0gaWRcbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5vZGVzOiBOb2RlW10sIHB1YmxpYyBwbGFjZWhvbGRlcnM6IHtbcGhOYW1lOiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgcHVibGljIHBsYWNlaG9sZGVyVG9NZXNzYWdlOiB7W3BoTmFtZTogc3RyaW5nXTogTWVzc2FnZX0sIHB1YmxpYyBtZWFuaW5nOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgZGVzY3JpcHRpb246IHN0cmluZywgcHVibGljIGN1c3RvbUlkOiBzdHJpbmcpIHtcbiAgICBpZiAobm9kZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnNvdXJjZXMgPSBbe1xuICAgICAgICBmaWxlUGF0aDogbm9kZXNbMF0uc291cmNlU3Bhbi5zdGFydC5maWxlLnVybCxcbiAgICAgICAgc3RhcnRMaW5lOiBub2Rlc1swXS5zb3VyY2VTcGFuLnN0YXJ0LmxpbmUgKyAxLFxuICAgICAgICBzdGFydENvbDogbm9kZXNbMF0uc291cmNlU3Bhbi5zdGFydC5jb2wgKyAxLFxuICAgICAgICBlbmRMaW5lOiBub2Rlc1tub2Rlcy5sZW5ndGggLSAxXS5zb3VyY2VTcGFuLmVuZC5saW5lICsgMSxcbiAgICAgICAgZW5kQ29sOiBub2Rlc1swXS5zb3VyY2VTcGFuLnN0YXJ0LmNvbCArIDFcbiAgICAgIH1dO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNvdXJjZXMgPSBbXTtcbiAgICB9XG4gIH1cbn1cblxuLy8gbGluZSBhbmQgY29sdW1ucyBpbmRleGVzIGFyZSAxIGJhc2VkXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VTcGFuIHtcbiAgZmlsZVBhdGg6IHN0cmluZztcbiAgc3RhcnRMaW5lOiBudW1iZXI7XG4gIHN0YXJ0Q29sOiBudW1iZXI7XG4gIGVuZExpbmU6IG51bWJlcjtcbiAgZW5kQ29sOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dD86IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIFRleHQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dD86IGFueSk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzLCBjb250ZXh0KTsgfVxufVxuXG4vLyBUT0RPKHZpY2IpOiBkbyB3ZSByZWFsbHkgbmVlZCB0aGlzIG5vZGUgKHZzIGFuIGFycmF5KSA/XG5leHBvcnQgY2xhc3MgQ29udGFpbmVyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ/OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdENvbnRhaW5lcih0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgSWN1IGltcGxlbWVudHMgTm9kZSB7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwdWJsaWMgZXhwcmVzc2lvblBsYWNlaG9sZGVyICE6IHN0cmluZztcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZXhwcmVzc2lvbjogc3RyaW5nLCBwdWJsaWMgdHlwZTogc3RyaW5nLCBwdWJsaWMgY2FzZXM6IHtbazogc3RyaW5nXTogTm9kZX0sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ/OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdEljdSh0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGFnUGxhY2Vob2xkZXIgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdGFnOiBzdHJpbmcsIHB1YmxpYyBhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9LCBwdWJsaWMgc3RhcnROYW1lOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgY2xvc2VOYW1lOiBzdHJpbmcsIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgaXNWb2lkOiBib29sZWFuLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICB2aXNpdCh2aXNpdG9yOiBWaXNpdG9yLCBjb250ZXh0PzogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRUYWdQbGFjZWhvbGRlcih0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxhY2Vob2xkZXIgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVmlzaXRvciwgY29udGV4dD86IGFueSk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0UGxhY2Vob2xkZXIodGhpcywgY29udGV4dCk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEljdVBsYWNlaG9sZGVyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogSWN1LCBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ/OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdEljdVBsYWNlaG9sZGVyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCB0eXBlIEFTVCA9IE1lc3NhZ2UgfCBOb2RlO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZpc2l0b3Ige1xuICB2aXNpdFRleHQodGV4dDogVGV4dCwgY29udGV4dD86IGFueSk6IGFueTtcbiAgdmlzaXRDb250YWluZXIoY29udGFpbmVyOiBDb250YWluZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnk7XG4gIHZpc2l0SWN1KGljdTogSWN1LCBjb250ZXh0PzogYW55KTogYW55O1xuICB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBoOiBUYWdQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueTtcbiAgdmlzaXRQbGFjZWhvbGRlcihwaDogUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnk7XG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IEljdVBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55O1xufVxuXG4vLyBDbG9uZSB0aGUgQVNUXG5leHBvcnQgY2xhc3MgQ2xvbmVWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvciB7XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0LCBjb250ZXh0PzogYW55KTogVGV4dCB7IHJldHVybiBuZXcgVGV4dCh0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4pOyB9XG5cbiAgdmlzaXRDb250YWluZXIoY29udGFpbmVyOiBDb250YWluZXIsIGNvbnRleHQ/OiBhbnkpOiBDb250YWluZXIge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gY29udGFpbmVyLmNoaWxkcmVuLm1hcChuID0+IG4udmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBuZXcgQ29udGFpbmVyKGNoaWxkcmVuLCBjb250YWluZXIuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IEljdSwgY29udGV4dD86IGFueSk6IEljdSB7XG4gICAgY29uc3QgY2FzZXM6IHtbazogc3RyaW5nXTogTm9kZX0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhpY3UuY2FzZXMpLmZvckVhY2goa2V5ID0+IGNhc2VzW2tleV0gPSBpY3UuY2FzZXNba2V5XS52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgY29uc3QgbXNnID0gbmV3IEljdShpY3UuZXhwcmVzc2lvbiwgaWN1LnR5cGUsIGNhc2VzLCBpY3Uuc291cmNlU3Bhbik7XG4gICAgbXNnLmV4cHJlc3Npb25QbGFjZWhvbGRlciA9IGljdS5leHByZXNzaW9uUGxhY2Vob2xkZXI7XG4gICAgcmV0dXJuIG1zZztcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IFRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogVGFnUGxhY2Vob2xkZXIge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gcGguY2hpbGRyZW4ubWFwKG4gPT4gbi52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBUYWdQbGFjZWhvbGRlcihcbiAgICAgICAgcGgudGFnLCBwaC5hdHRycywgcGguc3RhcnROYW1lLCBwaC5jbG9zZU5hbWUsIGNoaWxkcmVuLCBwaC5pc1ZvaWQsIHBoLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRQbGFjZWhvbGRlcihwaDogUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBQbGFjZWhvbGRlciB7XG4gICAgcmV0dXJuIG5ldyBQbGFjZWhvbGRlcihwaC52YWx1ZSwgcGgubmFtZSwgcGguc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdEljdVBsYWNlaG9sZGVyKHBoOiBJY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IEljdVBsYWNlaG9sZGVyIHtcbiAgICByZXR1cm4gbmV3IEljdVBsYWNlaG9sZGVyKHBoLnZhbHVlLCBwaC5uYW1lLCBwaC5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG4vLyBWaXNpdCBhbGwgdGhlIG5vZGVzIHJlY3Vyc2l2ZWx5XG5leHBvcnQgY2xhc3MgUmVjdXJzZVZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQsIGNvbnRleHQ/OiBhbnkpOiBhbnkge31cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IENvbnRhaW5lciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgY29udGFpbmVyLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiBJY3UsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIE9iamVjdC5rZXlzKGljdS5jYXNlcykuZm9yRWFjaChrID0+IHsgaWN1LmNhc2VzW2tdLnZpc2l0KHRoaXMpOyB9KTtcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IFRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICBwaC5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IFBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55IHt9XG5cbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge31cbn1cbiJdfQ==