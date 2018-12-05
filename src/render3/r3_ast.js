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
        define("@angular/compiler/src/render3/r3_ast", ["require", "exports", "tslib"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var Text = /** @class */ (function () {
        function Text(value, sourceSpan) {
            this.value = value;
            this.sourceSpan = sourceSpan;
        }
        Text.prototype.visit = function (visitor) { return visitor.visitText(this); };
        return Text;
    }());
    exports.Text = Text;
    var BoundText = /** @class */ (function () {
        function BoundText(value, sourceSpan, i18n) {
            this.value = value;
            this.sourceSpan = sourceSpan;
            this.i18n = i18n;
        }
        BoundText.prototype.visit = function (visitor) { return visitor.visitBoundText(this); };
        return BoundText;
    }());
    exports.BoundText = BoundText;
    var TextAttribute = /** @class */ (function () {
        function TextAttribute(name, value, sourceSpan, valueSpan, i18n) {
            this.name = name;
            this.value = value;
            this.sourceSpan = sourceSpan;
            this.valueSpan = valueSpan;
            this.i18n = i18n;
        }
        TextAttribute.prototype.visit = function (visitor) { return visitor.visitTextAttribute(this); };
        return TextAttribute;
    }());
    exports.TextAttribute = TextAttribute;
    var BoundAttribute = /** @class */ (function () {
        function BoundAttribute(name, type, securityContext, value, unit, sourceSpan, i18n) {
            this.name = name;
            this.type = type;
            this.securityContext = securityContext;
            this.value = value;
            this.unit = unit;
            this.sourceSpan = sourceSpan;
            this.i18n = i18n;
        }
        BoundAttribute.fromBoundElementProperty = function (prop, i18n) {
            return new BoundAttribute(prop.name, prop.type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan, i18n);
        };
        BoundAttribute.prototype.visit = function (visitor) { return visitor.visitBoundAttribute(this); };
        return BoundAttribute;
    }());
    exports.BoundAttribute = BoundAttribute;
    var BoundEvent = /** @class */ (function () {
        function BoundEvent(name, handler, target, phase, sourceSpan) {
            this.name = name;
            this.handler = handler;
            this.target = target;
            this.phase = phase;
            this.sourceSpan = sourceSpan;
        }
        BoundEvent.fromParsedEvent = function (event) {
            var target = event.type === 0 /* Regular */ ? event.targetOrPhase : null;
            var phase = event.type === 1 /* Animation */ ? event.targetOrPhase : null;
            return new BoundEvent(event.name, event.handler, target, phase, event.sourceSpan);
        };
        BoundEvent.prototype.visit = function (visitor) { return visitor.visitBoundEvent(this); };
        return BoundEvent;
    }());
    exports.BoundEvent = BoundEvent;
    var Element = /** @class */ (function () {
        function Element(name, attributes, inputs, outputs, children, references, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
            this.name = name;
            this.attributes = attributes;
            this.inputs = inputs;
            this.outputs = outputs;
            this.children = children;
            this.references = references;
            this.sourceSpan = sourceSpan;
            this.startSourceSpan = startSourceSpan;
            this.endSourceSpan = endSourceSpan;
            this.i18n = i18n;
        }
        Element.prototype.visit = function (visitor) { return visitor.visitElement(this); };
        return Element;
    }());
    exports.Element = Element;
    var Template = /** @class */ (function () {
        function Template(attributes, inputs, outputs, children, references, variables, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
            this.attributes = attributes;
            this.inputs = inputs;
            this.outputs = outputs;
            this.children = children;
            this.references = references;
            this.variables = variables;
            this.sourceSpan = sourceSpan;
            this.startSourceSpan = startSourceSpan;
            this.endSourceSpan = endSourceSpan;
            this.i18n = i18n;
        }
        Template.prototype.visit = function (visitor) { return visitor.visitTemplate(this); };
        return Template;
    }());
    exports.Template = Template;
    var Content = /** @class */ (function () {
        function Content(selector, attributes, sourceSpan, i18n) {
            this.selector = selector;
            this.attributes = attributes;
            this.sourceSpan = sourceSpan;
            this.i18n = i18n;
        }
        Content.prototype.visit = function (visitor) { return visitor.visitContent(this); };
        return Content;
    }());
    exports.Content = Content;
    var Variable = /** @class */ (function () {
        function Variable(name, value, sourceSpan) {
            this.name = name;
            this.value = value;
            this.sourceSpan = sourceSpan;
        }
        Variable.prototype.visit = function (visitor) { return visitor.visitVariable(this); };
        return Variable;
    }());
    exports.Variable = Variable;
    var Reference = /** @class */ (function () {
        function Reference(name, value, sourceSpan) {
            this.name = name;
            this.value = value;
            this.sourceSpan = sourceSpan;
        }
        Reference.prototype.visit = function (visitor) { return visitor.visitReference(this); };
        return Reference;
    }());
    exports.Reference = Reference;
    var Icu = /** @class */ (function () {
        function Icu(vars, placeholders, sourceSpan, i18n) {
            this.vars = vars;
            this.placeholders = placeholders;
            this.sourceSpan = sourceSpan;
            this.i18n = i18n;
        }
        Icu.prototype.visit = function (visitor) { return visitor.visitIcu(this); };
        return Icu;
    }());
    exports.Icu = Icu;
    var NullVisitor = /** @class */ (function () {
        function NullVisitor() {
        }
        NullVisitor.prototype.visitElement = function (element) { };
        NullVisitor.prototype.visitTemplate = function (template) { };
        NullVisitor.prototype.visitContent = function (content) { };
        NullVisitor.prototype.visitVariable = function (variable) { };
        NullVisitor.prototype.visitReference = function (reference) { };
        NullVisitor.prototype.visitTextAttribute = function (attribute) { };
        NullVisitor.prototype.visitBoundAttribute = function (attribute) { };
        NullVisitor.prototype.visitBoundEvent = function (attribute) { };
        NullVisitor.prototype.visitText = function (text) { };
        NullVisitor.prototype.visitBoundText = function (text) { };
        NullVisitor.prototype.visitIcu = function (icu) { };
        return NullVisitor;
    }());
    exports.NullVisitor = NullVisitor;
    var RecursiveVisitor = /** @class */ (function () {
        function RecursiveVisitor() {
        }
        RecursiveVisitor.prototype.visitElement = function (element) {
            visitAll(this, element.attributes);
            visitAll(this, element.children);
            visitAll(this, element.references);
        };
        RecursiveVisitor.prototype.visitTemplate = function (template) {
            visitAll(this, template.attributes);
            visitAll(this, template.children);
            visitAll(this, template.references);
            visitAll(this, template.variables);
        };
        RecursiveVisitor.prototype.visitContent = function (content) { };
        RecursiveVisitor.prototype.visitVariable = function (variable) { };
        RecursiveVisitor.prototype.visitReference = function (reference) { };
        RecursiveVisitor.prototype.visitTextAttribute = function (attribute) { };
        RecursiveVisitor.prototype.visitBoundAttribute = function (attribute) { };
        RecursiveVisitor.prototype.visitBoundEvent = function (attribute) { };
        RecursiveVisitor.prototype.visitText = function (text) { };
        RecursiveVisitor.prototype.visitBoundText = function (text) { };
        RecursiveVisitor.prototype.visitIcu = function (icu) { };
        return RecursiveVisitor;
    }());
    exports.RecursiveVisitor = RecursiveVisitor;
    var TransformVisitor = /** @class */ (function () {
        function TransformVisitor() {
        }
        TransformVisitor.prototype.visitElement = function (element) {
            var newAttributes = transformAll(this, element.attributes);
            var newInputs = transformAll(this, element.inputs);
            var newOutputs = transformAll(this, element.outputs);
            var newChildren = transformAll(this, element.children);
            var newReferences = transformAll(this, element.references);
            if (newAttributes != element.attributes || newInputs != element.inputs ||
                newOutputs != element.outputs || newChildren != element.children ||
                newReferences != element.references) {
                return new Element(element.name, newAttributes, newInputs, newOutputs, newChildren, newReferences, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
            }
            return element;
        };
        TransformVisitor.prototype.visitTemplate = function (template) {
            var newAttributes = transformAll(this, template.attributes);
            var newInputs = transformAll(this, template.inputs);
            var newOutputs = transformAll(this, template.outputs);
            var newChildren = transformAll(this, template.children);
            var newReferences = transformAll(this, template.references);
            var newVariables = transformAll(this, template.variables);
            if (newAttributes != template.attributes || newInputs != template.inputs ||
                newChildren != template.children || newVariables != template.variables ||
                newReferences != template.references) {
                return new Template(newAttributes, newInputs, newOutputs, newChildren, newReferences, newVariables, template.sourceSpan, template.startSourceSpan, template.endSourceSpan);
            }
            return template;
        };
        TransformVisitor.prototype.visitContent = function (content) { return content; };
        TransformVisitor.prototype.visitVariable = function (variable) { return variable; };
        TransformVisitor.prototype.visitReference = function (reference) { return reference; };
        TransformVisitor.prototype.visitTextAttribute = function (attribute) { return attribute; };
        TransformVisitor.prototype.visitBoundAttribute = function (attribute) { return attribute; };
        TransformVisitor.prototype.visitBoundEvent = function (attribute) { return attribute; };
        TransformVisitor.prototype.visitText = function (text) { return text; };
        TransformVisitor.prototype.visitBoundText = function (text) { return text; };
        TransformVisitor.prototype.visitIcu = function (icu) { return icu; };
        return TransformVisitor;
    }());
    exports.TransformVisitor = TransformVisitor;
    function visitAll(visitor, nodes) {
        var e_1, _a, e_2, _b;
        var result = [];
        if (visitor.visit) {
            try {
                for (var nodes_1 = tslib_1.__values(nodes), nodes_1_1 = nodes_1.next(); !nodes_1_1.done; nodes_1_1 = nodes_1.next()) {
                    var node = nodes_1_1.value;
                    var newNode = visitor.visit(node) || node.visit(visitor);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (nodes_1_1 && !nodes_1_1.done && (_a = nodes_1.return)) _a.call(nodes_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        else {
            try {
                for (var nodes_2 = tslib_1.__values(nodes), nodes_2_1 = nodes_2.next(); !nodes_2_1.done; nodes_2_1 = nodes_2.next()) {
                    var node = nodes_2_1.value;
                    var newNode = node.visit(visitor);
                    if (newNode) {
                        result.push(newNode);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (nodes_2_1 && !nodes_2_1.done && (_b = nodes_2.return)) _b.call(nodes_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        return result;
    }
    exports.visitAll = visitAll;
    function transformAll(visitor, nodes) {
        var e_3, _a;
        var result = [];
        var changed = false;
        try {
            for (var nodes_3 = tslib_1.__values(nodes), nodes_3_1 = nodes_3.next(); !nodes_3_1.done; nodes_3_1 = nodes_3.next()) {
                var node = nodes_3_1.value;
                var newNode = node.visit(visitor);
                if (newNode) {
                    result.push(newNode);
                }
                changed = changed || newNode != node;
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (nodes_3_1 && !nodes_3_1.done && (_a = nodes_3.return)) _a.call(nodes_3);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return changed ? result : nodes;
    }
    exports.transformAll = transformAll;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQVlIO1FBQ0UsY0FBbUIsS0FBYSxFQUFTLFVBQTJCO1lBQWpELFVBQUssR0FBTCxLQUFLLENBQVE7WUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUFHLENBQUM7UUFDeEUsb0JBQUssR0FBTCxVQUFjLE9BQXdCLElBQVksT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRixXQUFDO0lBQUQsQ0FBQyxBQUhELElBR0M7SUFIWSxvQkFBSTtJQUtqQjtRQUNFLG1CQUFtQixLQUFVLEVBQVMsVUFBMkIsRUFBUyxJQUFjO1lBQXJFLFVBQUssR0FBTCxLQUFLLENBQUs7WUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtZQUFTLFNBQUksR0FBSixJQUFJLENBQVU7UUFBRyxDQUFDO1FBQzVGLHlCQUFLLEdBQUwsVUFBYyxPQUF3QixJQUFZLE9BQU8sT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUYsZ0JBQUM7SUFBRCxDQUFDLEFBSEQsSUFHQztJQUhZLDhCQUFTO0lBS3RCO1FBQ0UsdUJBQ1csSUFBWSxFQUFTLEtBQWEsRUFBUyxVQUEyQixFQUN0RSxTQUEyQixFQUFTLElBQWM7WUFEbEQsU0FBSSxHQUFKLElBQUksQ0FBUTtZQUFTLFVBQUssR0FBTCxLQUFLLENBQVE7WUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtZQUN0RSxjQUFTLEdBQVQsU0FBUyxDQUFrQjtZQUFTLFNBQUksR0FBSixJQUFJLENBQVU7UUFBRyxDQUFDO1FBQ2pFLDZCQUFLLEdBQUwsVUFBYyxPQUF3QixJQUFZLE9BQU8sT0FBTyxDQUFD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LENBQUMsT0FBTyxDQUFDLENBQUM7aUJBQzVEOzs7Ozs7Ozs7U0FDRjthQUFNOztnQkFDTCxLQUFtQixJQUFBLFVBQUEsaUJBQUEsS0FBSyxDQUFBLDRCQUFBLCtDQUFFO29CQUFyQixJQUFNLElBQUksa0JBQUE7b0JBQ2IsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDcEMsSUFBSSxPQUFPLEVBQUU7d0JBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztxQkFDdEI7aUJBQ0Y7Ozs7Ozs7OztTQUNGO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQWZELDRCQWVDO0lBRUQsU0FBZ0IsWUFBWSxDQUN4QixPQUFzQixFQUFFLEtBQWU7O1FBQ3pDLElBQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7O1lBQ3BCLEtBQW1CLElBQUEsVUFBQSxpQkFBQSxLQUFLLENBQUEsNEJBQUEsK0NBQUU7Z0JBQXJCLElBQU0sSUFBSSxrQkFBQTtnQkFDYixJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLE9BQU8sRUFBRTtvQkFDWCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQWlCLENBQUMsQ0FBQztpQkFDaEM7Z0JBQ0QsT0FBTyxHQUFHLE9BQU8sSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDO2FBQ3RDOzs7Ozs7Ozs7UUFDRCxPQUFPLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7SUFDbEMsQ0FBQztJQVpELG9DQVlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQmluZGluZ1R5cGUsIEJvdW5kRWxlbWVudFByb3BlcnR5LCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtBU1QgYXMgSTE4bkFTVH0gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQ7XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7IHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5BU1QpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZFRleHQodGhpcyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRleHRBdHRyaWJ1dGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBpMThuPzogSTE4bkFTVCkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQgeyByZXR1cm4gdmlzaXRvci52aXNpdFRleHRBdHRyaWJ1dGUodGhpcyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kQXR0cmlidXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IEJpbmRpbmdUeXBlLCBwdWJsaWMgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgICBwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIHVuaXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuQVNUKSB7fVxuXG4gIHN0YXRpYyBmcm9tQm91bmRFbGVtZW50UHJvcGVydHkocHJvcDogQm91bmRFbGVtZW50UHJvcGVydHksIGkxOG4/OiBJMThuQVNUKSB7XG4gICAgcmV0dXJuIG5ldyBCb3VuZEF0dHJpYnV0ZShcbiAgICAgICAgcHJvcC5uYW1lLCBwcm9wLnR5cGUsIHByb3Auc2VjdXJpdHlDb250ZXh0LCBwcm9wLnZhbHVlLCBwcm9wLnVuaXQsIHByb3Auc291cmNlU3BhbiwgaTE4bik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7IHJldHVybiB2aXNpdG9yLnZpc2l0Qm91bmRBdHRyaWJ1dGUodGhpcyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kRXZlbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgaGFuZGxlcjogQVNULCBwdWJsaWMgdGFyZ2V0OiBzdHJpbmd8bnVsbCxcbiAgICAgIHB1YmxpYyBwaGFzZTogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgc3RhdGljIGZyb21QYXJzZWRFdmVudChldmVudDogUGFyc2VkRXZlbnQpIHtcbiAgICBjb25zdCB0YXJnZXQ6IHN0cmluZ3xudWxsID0gZXZlbnQudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLlJlZ3VsYXIgPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICBjb25zdCBwaGFzZTogc3RyaW5nfG51bGwgPVxuICAgICAgICBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gZXZlbnQudGFyZ2V0T3JQaGFzZSA6IG51bGw7XG4gICAgcmV0dXJuIG5ldyBCb3VuZEV2ZW50KGV2ZW50Lm5hbWUsIGV2ZW50LmhhbmRsZXIsIHRhcmdldCwgcGhhc2UsIGV2ZW50LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQgeyByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kRXZlbnQodGhpcyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEVsZW1lbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLCBwdWJsaWMgaW5wdXRzOiBCb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRbXSwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgaTE4bj86IEkxOG5BU1QpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRFbGVtZW50KHRoaXMpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBUZXh0QXR0cmlidXRlW10sIHB1YmxpYyBpbnB1dHM6IEJvdW5kQXR0cmlidXRlW10sXG4gICAgICBwdWJsaWMgb3V0cHV0czogQm91bmRFdmVudFtdLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIHJlZmVyZW5jZXM6IFJlZmVyZW5jZVtdLFxuICAgICAgcHVibGljIHZhcmlhYmxlczogVmFyaWFibGVbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBwdWJsaWMgaTE4bj86IEkxOG5BU1QpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRUZW1wbGF0ZSh0aGlzKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29udGVudCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBzZWxlY3Rvcjogc3RyaW5nLCBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGkxOG4/OiBJMThuQVNUKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7IHJldHVybiB2aXNpdG9yLnZpc2l0Q29udGVudCh0aGlzKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgVmFyaWFibGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRWYXJpYWJsZSh0aGlzKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVmZXJlbmNlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7IHJldHVybiB2aXNpdG9yLnZpc2l0UmVmZXJlbmNlKHRoaXMpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBJY3UgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFyczoge1tuYW1lOiBzdHJpbmddOiBCb3VuZFRleHR9LFxuICAgICAgcHVibGljIHBsYWNlaG9sZGVyczoge1tuYW1lOiBzdHJpbmddOiBUZXh0IHwgQm91bmRUZXh0fSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bkFTVCkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQgeyByZXR1cm4gdmlzaXRvci52aXNpdEljdSh0aGlzKTsgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZpc2l0b3I8UmVzdWx0ID0gYW55PiB7XG4gIC8vIFJldHVybmluZyBhIHRydXRoeSB2YWx1ZSBmcm9tIGB2aXNpdCgpYCB3aWxsIHByZXZlbnQgYHZpc2l0QWxsKClgIGZyb20gdGhlIGNhbGwgdG8gdGhlIHR5cGVkXG4gIC8vIG1ldGhvZCBhbmQgcmVzdWx0IHJldHVybmVkIHdpbGwgYmVjb21lIHRoZSByZXN1bHQgaW5jbHVkZWQgaW4gYHZpc2l0QWxsKClgcyByZXN1bHQgYXJyYXkuXG4gIHZpc2l0Pyhub2RlOiBOb2RlKTogUmVzdWx0O1xuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogUmVzdWx0O1xuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IFJlc3VsdDtcbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiBSZXN1bHQ7XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogUmVzdWx0O1xuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IFJlc3VsdDtcbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IFJlc3VsdDtcbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogUmVzdWx0O1xuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogUmVzdWx0O1xuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IFJlc3VsdDtcbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogUmVzdWx0O1xuICB2aXNpdEljdShpY3U6IEljdSk6IFJlc3VsdDtcbn1cblxuZXhwb3J0IGNsYXNzIE51bGxWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvcjx2b2lkPiB7XG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7fVxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge31cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogdm9pZCB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cbn1cblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZVZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yPHZvaWQ+IHtcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmF0dHJpYnV0ZXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gIH1cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5hdHRyaWJ1dGVzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5jaGlsZHJlbik7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUucmVmZXJlbmNlcyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUudmFyaWFibGVzKTtcbiAgfVxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IHZvaWQge31cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpOiB2b2lkIHt9XG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKTogdm9pZCB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRFdmVudChhdHRyaWJ1dGU6IEJvdW5kRXZlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNmb3JtVmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3I8Tm9kZT4ge1xuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IE5vZGUge1xuICAgIGNvbnN0IG5ld0F0dHJpYnV0ZXMgPSB0cmFuc2Zvcm1BbGwodGhpcywgZWxlbWVudC5hdHRyaWJ1dGVzKTtcbiAgICBjb25zdCBuZXdJbnB1dHMgPSB0cmFuc2Zvcm1BbGwodGhpcywgZWxlbWVudC5pbnB1dHMpO1xuICAgIGNvbnN0IG5ld091dHB1dHMgPSB0cmFuc2Zvcm1BbGwodGhpcywgZWxlbWVudC5vdXRwdXRzKTtcbiAgICBjb25zdCBuZXdDaGlsZHJlbiA9IHRyYW5zZm9ybUFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgICBjb25zdCBuZXdSZWZlcmVuY2VzID0gdHJhbnNmb3JtQWxsKHRoaXMsIGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gICAgaWYgKG5ld0F0dHJpYnV0ZXMgIT0gZWxlbWVudC5hdHRyaWJ1dGVzIHx8IG5ld0lucHV0cyAhPSBlbGVtZW50LmlucHV0cyB8fFxuICAgICAgICBuZXdPdXRwdXRzICE9IGVsZW1lbnQub3V0cHV0cyB8fCBuZXdDaGlsZHJlbiAhPSBlbGVtZW50LmNoaWxkcmVuIHx8XG4gICAgICAgIG5ld1JlZmVyZW5jZXMgIT0gZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgICByZXR1cm4gbmV3IEVsZW1lbnQoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBuZXdBdHRyaWJ1dGVzLCBuZXdJbnB1dHMsIG5ld091dHB1dHMsIG5ld0NoaWxkcmVuLCBuZXdSZWZlcmVuY2VzLFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3Bhbik7XG4gICAgfVxuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBOb2RlIHtcbiAgICBjb25zdCBuZXdBdHRyaWJ1dGVzID0gdHJhbnNmb3JtQWxsKHRoaXMsIHRlbXBsYXRlLmF0dHJpYnV0ZXMpO1xuICAgIGNvbnN0IG5ld0lucHV0cyA9IHRyYW5zZm9ybUFsbCh0aGlzLCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgIGNvbnN0IG5ld091dHB1dHMgPSB0cmFuc2Zvcm1BbGwodGhpcywgdGVtcGxhdGUub3V0cHV0cyk7XG4gICAgY29uc3QgbmV3Q2hpbGRyZW4gPSB0cmFuc2Zvcm1BbGwodGhpcywgdGVtcGxhdGUuY2hpbGRyZW4pO1xuICAgIGNvbnN0IG5ld1JlZmVyZW5jZXMgPSB0cmFuc2Zvcm1BbGwodGhpcywgdGVtcGxhdGUucmVmZXJlbmNlcyk7XG4gICAgY29uc3QgbmV3VmFyaWFibGVzID0gdHJhbnNmb3JtQWxsKHRoaXMsIHRlbXBsYXRlLnZhcmlhYmxlcyk7XG4gICAgaWYgKG5ld0F0dHJpYnV0ZXMgIT0gdGVtcGxhdGUuYXR0cmlidXRlcyB8fCBuZXdJbnB1dHMgIT0gdGVtcGxhdGUuaW5wdXRzIHx8XG4gICAgICAgIG5ld0NoaWxkcmVuICE9IHRlbXBsYXRlLmNoaWxkcmVuIHx8IG5ld1ZhcmlhYmxlcyAhPSB0ZW1wbGF0ZS52YXJpYWJsZXMgfHxcbiAgICAgICAgbmV3UmVmZXJlbmNlcyAhPSB0ZW1wbGF0ZS5yZWZlcmVuY2VzKSB7XG4gICAgICByZXR1cm4gbmV3IFRlbXBsYXRlKFxuICAgICAgICAgIG5ld0F0dHJpYnV0ZXMsIG5ld0lucHV0cywgbmV3T3V0cHV0cywgbmV3Q2hpbGRyZW4sIG5ld1JlZmVyZW5jZXMsIG5ld1ZhcmlhYmxlcyxcbiAgICAgICAgICB0ZW1wbGF0ZS5zb3VyY2VTcGFuLCB0ZW1wbGF0ZS5zdGFydFNvdXJjZVNwYW4sIHRlbXBsYXRlLmVuZFNvdXJjZVNwYW4pO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH1cblxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IE5vZGUgeyByZXR1cm4gY29udGVudDsgfVxuXG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogTm9kZSB7IHJldHVybiB2YXJpYWJsZTsgfVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IE5vZGUgeyByZXR1cm4gcmVmZXJlbmNlOyB9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiBOb2RlIHsgcmV0dXJuIGF0dHJpYnV0ZTsgfVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiBOb2RlIHsgcmV0dXJuIGF0dHJpYnV0ZTsgfVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogTm9kZSB7IHJldHVybiBhdHRyaWJ1dGU7IH1cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiBOb2RlIHsgcmV0dXJuIHRleHQ7IH1cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogTm9kZSB7IHJldHVybiB0ZXh0OyB9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogTm9kZSB7IHJldHVybiBpY3U7IH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0QWxsPFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+LCBub2RlczogTm9kZVtdKTogUmVzdWx0W10ge1xuICBjb25zdCByZXN1bHQ6IFJlc3VsdFtdID0gW107XG4gIGlmICh2aXNpdG9yLnZpc2l0KSB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICBjb25zdCBuZXdOb2RlID0gdmlzaXRvci52aXNpdChub2RlKSB8fCBub2RlLnZpc2l0KHZpc2l0b3IpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIGNvbnN0IG5ld05vZGUgPSBub2RlLnZpc2l0KHZpc2l0b3IpO1xuICAgICAgaWYgKG5ld05vZGUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2gobmV3Tm9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1BbGw8UmVzdWx0IGV4dGVuZHMgTm9kZT4oXG4gICAgdmlzaXRvcjogVmlzaXRvcjxOb2RlPiwgbm9kZXM6IFJlc3VsdFtdKTogUmVzdWx0W10ge1xuICBjb25zdCByZXN1bHQ6IFJlc3VsdFtdID0gW107XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuICAgIGNvbnN0IG5ld05vZGUgPSBub2RlLnZpc2l0KHZpc2l0b3IpO1xuICAgIGlmIChuZXdOb2RlKSB7XG4gICAgICByZXN1bHQucHVzaChuZXdOb2RlIGFzIFJlc3VsdCk7XG4gICAgfVxuICAgIGNoYW5nZWQgPSBjaGFuZ2VkIHx8IG5ld05vZGUgIT0gbm9kZTtcbiAgfVxuICByZXR1cm4gY2hhbmdlZCA/IHJlc3VsdCA6IG5vZGVzO1xufSJdfQ==