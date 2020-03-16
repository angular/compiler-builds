/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var _a;
import { __extends } from "tslib";
/**
 * A segment of text within the template.
 */
var TextAst = /** @class */ (function () {
    function TextAst(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    TextAst.prototype.visit = function (visitor, context) { return visitor.visitText(this, context); };
    return TextAst;
}());
export { TextAst };
/**
 * A bound expression within the text of a template.
 */
var BoundTextAst = /** @class */ (function () {
    function BoundTextAst(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    BoundTextAst.prototype.visit = function (visitor, context) {
        return visitor.visitBoundText(this, context);
    };
    return BoundTextAst;
}());
export { BoundTextAst };
/**
 * A plain attribute on an element.
 */
var AttrAst = /** @class */ (function () {
    function AttrAst(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    AttrAst.prototype.visit = function (visitor, context) { return visitor.visitAttr(this, context); };
    return AttrAst;
}());
export { AttrAst };
var BoundPropertyMapping = (_a = {},
    _a[4 /* Animation */] = 4 /* Animation */,
    _a[1 /* Attribute */] = 1 /* Attribute */,
    _a[2 /* Class */] = 2 /* Class */,
    _a[0 /* Property */] = 0 /* Property */,
    _a[3 /* Style */] = 3 /* Style */,
    _a);
/**
 * A binding for an element property (e.g. `[property]="expression"`) or an animation trigger (e.g.
 * `[@trigger]="stateExp"`)
 */
var BoundElementPropertyAst = /** @class */ (function () {
    function BoundElementPropertyAst(name, type, securityContext, value, unit, sourceSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
        this.isAnimation = this.type === 4 /* Animation */;
    }
    BoundElementPropertyAst.fromBoundProperty = function (prop) {
        var type = BoundPropertyMapping[prop.type];
        return new BoundElementPropertyAst(prop.name, type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan);
    };
    BoundElementPropertyAst.prototype.visit = function (visitor, context) {
        return visitor.visitElementProperty(this, context);
    };
    return BoundElementPropertyAst;
}());
export { BoundElementPropertyAst };
/**
 * A binding for an element event (e.g. `(event)="handler()"`) or an animation trigger event (e.g.
 * `(@trigger.phase)="callback($event)"`).
 */
var BoundEventAst = /** @class */ (function () {
    function BoundEventAst(name, target, phase, handler, sourceSpan, handlerSpan) {
        this.name = name;
        this.target = target;
        this.phase = phase;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
        this.handlerSpan = handlerSpan;
        this.fullName = BoundEventAst.calcFullName(this.name, this.target, this.phase);
        this.isAnimation = !!this.phase;
    }
    BoundEventAst.calcFullName = function (name, target, phase) {
        if (target) {
            return target + ":" + name;
        }
        if (phase) {
            return "@" + name + "." + phase;
        }
        return name;
    };
    BoundEventAst.fromParsedEvent = function (event) {
        var target = event.type === 0 /* Regular */ ? event.targetOrPhase : null;
        var phase = event.type === 1 /* Animation */ ? event.targetOrPhase : null;
        return new BoundEventAst(event.name, target, phase, event.handler, event.sourceSpan, event.handlerSpan);
    };
    BoundEventAst.prototype.visit = function (visitor, context) {
        return visitor.visitEvent(this, context);
    };
    return BoundEventAst;
}());
export { BoundEventAst };
/**
 * A reference declaration on an element (e.g. `let someName="expression"`).
 */
var ReferenceAst = /** @class */ (function () {
    function ReferenceAst(name, value, originalValue, sourceSpan) {
        this.name = name;
        this.value = value;
        this.originalValue = originalValue;
        this.sourceSpan = sourceSpan;
    }
    ReferenceAst.prototype.visit = function (visitor, context) {
        return visitor.visitReference(this, context);
    };
    return ReferenceAst;
}());
export { ReferenceAst };
/**
 * A variable declaration on a <ng-template> (e.g. `var-someName="someLocalName"`).
 */
var VariableAst = /** @class */ (function () {
    function VariableAst(name, value, sourceSpan, valueSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.valueSpan = valueSpan;
    }
    VariableAst.fromParsedVariable = function (v) {
        return new VariableAst(v.name, v.value, v.sourceSpan, v.valueSpan);
    };
    VariableAst.prototype.visit = function (visitor, context) {
        return visitor.visitVariable(this, context);
    };
    return VariableAst;
}());
export { VariableAst };
/**
 * An element declaration in a template.
 */
var ElementAst = /** @class */ (function () {
    function ElementAst(name, attrs, inputs, outputs, references, directives, providers, hasViewContainer, queryMatches, children, ngContentIndex, sourceSpan, endSourceSpan) {
        this.name = name;
        this.attrs = attrs;
        this.inputs = inputs;
        this.outputs = outputs;
        this.references = references;
        this.directives = directives;
        this.providers = providers;
        this.hasViewContainer = hasViewContainer;
        this.queryMatches = queryMatches;
        this.children = children;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    ElementAst.prototype.visit = function (visitor, context) {
        return visitor.visitElement(this, context);
    };
    return ElementAst;
}());
export { ElementAst };
/**
 * A `<ng-template>` element included in an Angular template.
 */
var EmbeddedTemplateAst = /** @class */ (function () {
    function EmbeddedTemplateAst(attrs, outputs, references, variables, directives, providers, hasViewContainer, queryMatches, children, ngContentIndex, sourceSpan) {
        this.attrs = attrs;
        this.outputs = outputs;
        this.references = references;
        this.variables = variables;
        this.directives = directives;
        this.providers = providers;
        this.hasViewContainer = hasViewContainer;
        this.queryMatches = queryMatches;
        this.children = children;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    EmbeddedTemplateAst.prototype.visit = function (visitor, context) {
        return visitor.visitEmbeddedTemplate(this, context);
    };
    return EmbeddedTemplateAst;
}());
export { EmbeddedTemplateAst };
/**
 * A directive property with a bound value (e.g. `*ngIf="condition").
 */
var BoundDirectivePropertyAst = /** @class */ (function () {
    function BoundDirectivePropertyAst(directiveName, templateName, value, sourceSpan) {
        this.directiveName = directiveName;
        this.templateName = templateName;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    BoundDirectivePropertyAst.prototype.visit = function (visitor, context) {
        return visitor.visitDirectiveProperty(this, context);
    };
    return BoundDirectivePropertyAst;
}());
export { BoundDirectivePropertyAst };
/**
 * A directive declared on an element.
 */
var DirectiveAst = /** @class */ (function () {
    function DirectiveAst(directive, inputs, hostProperties, hostEvents, contentQueryStartId, sourceSpan) {
        this.directive = directive;
        this.inputs = inputs;
        this.hostProperties = hostProperties;
        this.hostEvents = hostEvents;
        this.contentQueryStartId = contentQueryStartId;
        this.sourceSpan = sourceSpan;
    }
    DirectiveAst.prototype.visit = function (visitor, context) {
        return visitor.visitDirective(this, context);
    };
    return DirectiveAst;
}());
export { DirectiveAst };
/**
 * A provider declared on an element
 */
var ProviderAst = /** @class */ (function () {
    function ProviderAst(token, multiProvider, eager, providers, providerType, lifecycleHooks, sourceSpan, isModule) {
        this.token = token;
        this.multiProvider = multiProvider;
        this.eager = eager;
        this.providers = providers;
        this.providerType = providerType;
        this.lifecycleHooks = lifecycleHooks;
        this.sourceSpan = sourceSpan;
        this.isModule = isModule;
    }
    ProviderAst.prototype.visit = function (visitor, context) {
        // No visit method in the visitor for now...
        return null;
    };
    return ProviderAst;
}());
export { ProviderAst };
export var ProviderAstType;
(function (ProviderAstType) {
    ProviderAstType[ProviderAstType["PublicService"] = 0] = "PublicService";
    ProviderAstType[ProviderAstType["PrivateService"] = 1] = "PrivateService";
    ProviderAstType[ProviderAstType["Component"] = 2] = "Component";
    ProviderAstType[ProviderAstType["Directive"] = 3] = "Directive";
    ProviderAstType[ProviderAstType["Builtin"] = 4] = "Builtin";
})(ProviderAstType || (ProviderAstType = {}));
/**
 * Position where content is to be projected (instance of `<ng-content>` in a template).
 */
var NgContentAst = /** @class */ (function () {
    function NgContentAst(index, ngContentIndex, sourceSpan) {
        this.index = index;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    NgContentAst.prototype.visit = function (visitor, context) {
        return visitor.visitNgContent(this, context);
    };
    return NgContentAst;
}());
export { NgContentAst };
/**
 * A visitor that accepts each node but doesn't do anything. It is intended to be used
 * as the base class for a visitor that is only interested in a subset of the node types.
 */
var NullTemplateVisitor = /** @class */ (function () {
    function NullTemplateVisitor() {
    }
    NullTemplateVisitor.prototype.visitNgContent = function (ast, context) { };
    NullTemplateVisitor.prototype.visitEmbeddedTemplate = function (ast, context) { };
    NullTemplateVisitor.prototype.visitElement = function (ast, context) { };
    NullTemplateVisitor.prototype.visitReference = function (ast, context) { };
    NullTemplateVisitor.prototype.visitVariable = function (ast, context) { };
    NullTemplateVisitor.prototype.visitEvent = function (ast, context) { };
    NullTemplateVisitor.prototype.visitElementProperty = function (ast, context) { };
    NullTemplateVisitor.prototype.visitAttr = function (ast, context) { };
    NullTemplateVisitor.prototype.visitBoundText = function (ast, context) { };
    NullTemplateVisitor.prototype.visitText = function (ast, context) { };
    NullTemplateVisitor.prototype.visitDirective = function (ast, context) { };
    NullTemplateVisitor.prototype.visitDirectiveProperty = function (ast, context) { };
    return NullTemplateVisitor;
}());
export { NullTemplateVisitor };
/**
 * Base class that can be used to build a visitor that visits each node
 * in an template ast recursively.
 */
var RecursiveTemplateAstVisitor = /** @class */ (function (_super) {
    __extends(RecursiveTemplateAstVisitor, _super);
    function RecursiveTemplateAstVisitor() {
        return _super.call(this) || this;
    }
    // Nodes with children
    RecursiveTemplateAstVisitor.prototype.visitEmbeddedTemplate = function (ast, context) {
        return this.visitChildren(context, function (visit) {
            visit(ast.attrs);
            visit(ast.references);
            visit(ast.variables);
            visit(ast.directives);
            visit(ast.providers);
            visit(ast.children);
        });
    };
    RecursiveTemplateAstVisitor.prototype.visitElement = function (ast, context) {
        return this.visitChildren(context, function (visit) {
            visit(ast.attrs);
            visit(ast.inputs);
            visit(ast.outputs);
            visit(ast.references);
            visit(ast.directives);
            visit(ast.providers);
            visit(ast.children);
        });
    };
    RecursiveTemplateAstVisitor.prototype.visitDirective = function (ast, context) {
        return this.visitChildren(context, function (visit) {
            visit(ast.inputs);
            visit(ast.hostProperties);
            visit(ast.hostEvents);
        });
    };
    RecursiveTemplateAstVisitor.prototype.visitChildren = function (context, cb) {
        var results = [];
        var t = this;
        function visit(children) {
            if (children && children.length)
                results.push(templateVisitAll(t, children, context));
        }
        cb(visit);
        return Array.prototype.concat.apply([], results);
    };
    return RecursiveTemplateAstVisitor;
}(NullTemplateVisitor));
export { RecursiveTemplateAstVisitor };
/**
 * Visit every node in a list of {@link TemplateAst}s with the given {@link TemplateAstVisitor}.
 */
export function templateVisitAll(visitor, asts, context) {
    if (context === void 0) { context = null; }
    var result = [];
    var visit = visitor.visit ?
        function (ast) { return visitor.visit(ast, context) || ast.visit(visitor, context); } :
        function (ast) { return ast.visit(visitor, context); };
    asts.forEach(function (ast) {
        var astResult = visit(ast);
        if (astResult) {
            result.push(astResult);
        }
    });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7QUEwQkg7O0dBRUc7QUFDSDtJQUNFLGlCQUNXLEtBQWEsRUFBUyxjQUFzQixFQUFTLFVBQTJCO1FBQWhGLFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxtQkFBYyxHQUFkLGNBQWMsQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztJQUMvRix1QkFBSyxHQUFMLFVBQU0sT0FBMkIsRUFBRSxPQUFZLElBQVMsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEcsY0FBQztBQUFELENBQUMsQUFKRCxJQUlDOztBQUVEOztHQUVHO0FBQ0g7SUFDRSxzQkFDVyxLQUFvQixFQUFTLGNBQXNCLEVBQ25ELFVBQTJCO1FBRDNCLFVBQUssR0FBTCxLQUFLLENBQWU7UUFBUyxtQkFBYyxHQUFkLGNBQWMsQ0FBUTtRQUNuRCxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDMUMsNEJBQUssR0FBTCxVQUFNLE9BQTJCLEVBQUUsT0FBWTtRQUM3QyxPQUFPLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFDSCxtQkFBQztBQUFELENBQUMsQUFQRCxJQU9DOztBQUVEOztHQUVHO0FBQ0g7SUFDRSxpQkFBbUIsSUFBWSxFQUFTLEtBQWEsRUFBUyxVQUEyQjtRQUF0RSxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztJQUM3Rix1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LE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBNUQsQ0FBNEQsQ0FBQyxDQUFDO1FBQ3BGLFVBQUMsR0FBZ0IsSUFBSyxPQUFBLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUEzQixDQUEyQixDQUFDO0lBQ3RELElBQUksQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHO1FBQ2QsSUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLElBQUksU0FBUyxFQUFFO1lBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUN4QjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBc3RQYXRofSBmcm9tICcuLi9hc3RfcGF0aCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGF9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtBU1RXaXRoU291cmNlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFZhcmlhYmxlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cblxuXG4vKipcbiAqIEFuIEFic3RyYWN0IFN5bnRheCBUcmVlIG5vZGUgcmVwcmVzZW50aW5nIHBhcnQgb2YgYSBwYXJzZWQgQW5ndWxhciB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZUFzdCB7XG4gIC8qKlxuICAgKiBUaGUgc291cmNlIHNwYW4gZnJvbSB3aGljaCB0aGlzIG5vZGUgd2FzIHBhcnNlZC5cbiAgICovXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcblxuICAvKipcbiAgICogVmlzaXQgdGhpcyBub2RlIGFuZCBwb3NzaWJseSB0cmFuc2Zvcm0gaXQuXG4gICAqL1xuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuLyoqXG4gKiBBIHNlZ21lbnQgb2YgdGV4dCB3aXRoaW4gdGhlIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVGV4dEFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRUZXh0KHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbi8qKlxuICogQSBib3VuZCBleHByZXNzaW9uIHdpdGhpbiB0aGUgdGV4dCBvZiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNUV2l0aFNvdXJjZSwgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZFRleHQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHBsYWluIGF0dHJpYnV0ZSBvbiBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgY2xhc3MgQXR0ckFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRBdHRyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFByb3BlcnR5QmluZGluZ1R5cGUge1xuICAvLyBBIG5vcm1hbCBiaW5kaW5nIHRvIGEgcHJvcGVydHkgKGUuZy4gYFtwcm9wZXJ0eV09XCJleHByZXNzaW9uXCJgKS5cbiAgUHJvcGVydHksXG4gIC8vIEEgYmluZGluZyB0byBhbiBlbGVtZW50IGF0dHJpYnV0ZSAoZS5nLiBgW2F0dHIubmFtZV09XCJleHByZXNzaW9uXCJgKS5cbiAgQXR0cmlidXRlLFxuICAvLyBBIGJpbmRpbmcgdG8gYSBDU1MgY2xhc3MgKGUuZy4gYFtjbGFzcy5uYW1lXT1cImNvbmRpdGlvblwiYCkuXG4gIENsYXNzLFxuICAvLyBBIGJpbmRpbmcgdG8gYSBzdHlsZSBydWxlIChlLmcuIGBbc3R5bGUucnVsZV09XCJleHByZXNzaW9uXCJgKS5cbiAgU3R5bGUsXG4gIC8vIEEgYmluZGluZyB0byBhbiBhbmltYXRpb24gcmVmZXJlbmNlIChlLmcuIGBbYW5pbWF0ZS5rZXldPVwiZXhwcmVzc2lvblwiYCkuXG4gIEFuaW1hdGlvbixcbn1cblxuY29uc3QgQm91bmRQcm9wZXJ0eU1hcHBpbmcgPSB7XG4gIFtCaW5kaW5nVHlwZS5BbmltYXRpb25dOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLkFuaW1hdGlvbixcbiAgW0JpbmRpbmdUeXBlLkF0dHJpYnV0ZV06IFByb3BlcnR5QmluZGluZ1R5cGUuQXR0cmlidXRlLFxuICBbQmluZGluZ1R5cGUuQ2xhc3NdOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLkNsYXNzLFxuICBbQmluZGluZ1R5cGUuUHJvcGVydHldOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLlByb3BlcnR5LFxuICBbQmluZGluZ1R5cGUuU3R5bGVdOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLlN0eWxlLFxufTtcblxuLyoqXG4gKiBBIGJpbmRpbmcgZm9yIGFuIGVsZW1lbnQgcHJvcGVydHkgKGUuZy4gYFtwcm9wZXJ0eV09XCJleHByZXNzaW9uXCJgKSBvciBhbiBhbmltYXRpb24gdHJpZ2dlciAoZS5nLlxuICogYFtAdHJpZ2dlcl09XCJzdGF0ZUV4cFwiYClcbiAqL1xuZXhwb3J0IGNsYXNzIEJvdW5kRWxlbWVudFByb3BlcnR5QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICByZWFkb25seSBpc0FuaW1hdGlvbjogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLFxuICAgICAgcHVibGljIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LCBwdWJsaWMgdmFsdWU6IEFTVFdpdGhTb3VyY2UsXG4gICAgICBwdWJsaWMgdW5pdDogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICB0aGlzLmlzQW5pbWF0aW9uID0gdGhpcy50eXBlID09PSBQcm9wZXJ0eUJpbmRpbmdUeXBlLkFuaW1hdGlvbjtcbiAgfVxuXG4gIHN0YXRpYyBmcm9tQm91bmRQcm9wZXJ0eShwcm9wOiBCb3VuZEVsZW1lbnRQcm9wZXJ0eSkge1xuICAgIGNvbnN0IHR5cGUgPSBCb3VuZFByb3BlcnR5TWFwcGluZ1twcm9wLnR5cGVdO1xuICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHlBc3QoXG4gICAgICAgIHByb3AubmFtZSwgdHlwZSwgcHJvcC5zZWN1cml0eUNvbnRleHQsIHByb3AudmFsdWUsIHByb3AudW5pdCwgcHJvcC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnRQcm9wZXJ0eSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgYmluZGluZyBmb3IgYW4gZWxlbWVudCBldmVudCAoZS5nLiBgKGV2ZW50KT1cImhhbmRsZXIoKVwiYCkgb3IgYW4gYW5pbWF0aW9uIHRyaWdnZXIgZXZlbnQgKGUuZy5cbiAqIGAoQHRyaWdnZXIucGhhc2UpPVwiY2FsbGJhY2soJGV2ZW50KVwiYCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBCb3VuZEV2ZW50QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICByZWFkb25seSBmdWxsTmFtZTogc3RyaW5nO1xuICByZWFkb25seSBpc0FuaW1hdGlvbjogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0YXJnZXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGhhc2U6IHN0cmluZ3xudWxsLFxuICAgICAgcHVibGljIGhhbmRsZXI6IEFTVFdpdGhTb3VyY2UsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuZnVsbE5hbWUgPSBCb3VuZEV2ZW50QXN0LmNhbGNGdWxsTmFtZSh0aGlzLm5hbWUsIHRoaXMudGFyZ2V0LCB0aGlzLnBoYXNlKTtcbiAgICB0aGlzLmlzQW5pbWF0aW9uID0gISF0aGlzLnBoYXNlO1xuICB9XG5cbiAgc3RhdGljIGNhbGNGdWxsTmFtZShuYW1lOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nfG51bGwsIHBoYXNlOiBzdHJpbmd8bnVsbCk6IHN0cmluZyB7XG4gICAgaWYgKHRhcmdldCkge1xuICAgICAgcmV0dXJuIGAke3RhcmdldH06JHtuYW1lfWA7XG4gICAgfVxuICAgIGlmIChwaGFzZSkge1xuICAgICAgcmV0dXJuIGBAJHtuYW1lfS4ke3BoYXNlfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICBzdGF0aWMgZnJvbVBhcnNlZEV2ZW50KGV2ZW50OiBQYXJzZWRFdmVudCkge1xuICAgIGNvbnN0IHRhcmdldDogc3RyaW5nfG51bGwgPSBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuUmVndWxhciA/IGV2ZW50LnRhcmdldE9yUGhhc2UgOiBudWxsO1xuICAgIGNvbnN0IHBoYXNlOiBzdHJpbmd8bnVsbCA9XG4gICAgICAgIGV2ZW50LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICByZXR1cm4gbmV3IEJvdW5kRXZlbnRBc3QoXG4gICAgICAgIGV2ZW50Lm5hbWUsIHRhcmdldCwgcGhhc2UsIGV2ZW50LmhhbmRsZXIsIGV2ZW50LnNvdXJjZVNwYW4sIGV2ZW50LmhhbmRsZXJTcGFuKTtcbiAgfVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV2ZW50KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSByZWZlcmVuY2UgZGVjbGFyYXRpb24gb24gYW4gZWxlbWVudCAoZS5nLiBgbGV0IHNvbWVOYW1lPVwiZXhwcmVzc2lvblwiYCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBDb21waWxlVG9rZW5NZXRhZGF0YSwgcHVibGljIG9yaWdpbmFsVmFsdWU6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlZmVyZW5jZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gb24gYSA8bmctdGVtcGxhdGU+IChlLmcuIGB2YXItc29tZU5hbWU9XCJzb21lTG9jYWxOYW1lXCJgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZhcmlhYmxlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmcsIHB1YmxpYyByZWFkb25seSB2YWx1ZTogc3RyaW5nLFxuICAgICAgcHVibGljIHJlYWRvbmx5IHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHJlYWRvbmx5IHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3Bhbikge31cblxuICBzdGF0aWMgZnJvbVBhcnNlZFZhcmlhYmxlKHY6IFBhcnNlZFZhcmlhYmxlKSB7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUFzdCh2Lm5hbWUsIHYudmFsdWUsIHYuc291cmNlU3Bhbiwgdi52YWx1ZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VmFyaWFibGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBlbGVtZW50IGRlY2xhcmF0aW9uIGluIGEgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBFbGVtZW50QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBhdHRyczogQXR0ckFzdFtdLCBwdWJsaWMgaW5wdXRzOiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRBc3RbXSwgcHVibGljIHJlZmVyZW5jZXM6IFJlZmVyZW5jZUFzdFtdLFxuICAgICAgcHVibGljIGRpcmVjdGl2ZXM6IERpcmVjdGl2ZUFzdFtdLCBwdWJsaWMgcHJvdmlkZXJzOiBQcm92aWRlckFzdFtdLFxuICAgICAgcHVibGljIGhhc1ZpZXdDb250YWluZXI6IGJvb2xlYW4sIHB1YmxpYyBxdWVyeU1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSxcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogVGVtcGxhdGVBc3RbXSwgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFbGVtZW50KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSBgPG5nLXRlbXBsYXRlPmAgZWxlbWVudCBpbmNsdWRlZCBpbiBhbiBBbmd1bGFyIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgRW1iZWRkZWRUZW1wbGF0ZUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYXR0cnM6IEF0dHJBc3RbXSwgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRBc3RbXSwgcHVibGljIHJlZmVyZW5jZXM6IFJlZmVyZW5jZUFzdFtdLFxuICAgICAgcHVibGljIHZhcmlhYmxlczogVmFyaWFibGVBc3RbXSwgcHVibGljIGRpcmVjdGl2ZXM6IERpcmVjdGl2ZUFzdFtdLFxuICAgICAgcHVibGljIHByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSwgcHVibGljIGhhc1ZpZXdDb250YWluZXI6IGJvb2xlYW4sXG4gICAgICBwdWJsaWMgcXVlcnlNYXRjaGVzOiBRdWVyeU1hdGNoW10sIHB1YmxpYyBjaGlsZHJlbjogVGVtcGxhdGVBc3RbXSxcbiAgICAgIHB1YmxpYyBuZ0NvbnRlbnRJbmRleDogbnVtYmVyLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVtYmVkZGVkVGVtcGxhdGUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGRpcmVjdGl2ZSBwcm9wZXJ0eSB3aXRoIGEgYm91bmQgdmFsdWUgKGUuZy4gYCpuZ0lmPVwiY29uZGl0aW9uXCIpLlxuICovXG5leHBvcnQgY2xhc3MgQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZGlyZWN0aXZlTmFtZTogc3RyaW5nLCBwdWJsaWMgdGVtcGxhdGVOYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogQVNUV2l0aFNvdXJjZSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERpcmVjdGl2ZVByb3BlcnR5KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSBkaXJlY3RpdmUgZGVjbGFyZWQgb24gYW4gZWxlbWVudC5cbiAqL1xuZXhwb3J0IGNsYXNzIERpcmVjdGl2ZUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgcHVibGljIGlucHV0czogQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdFtdLFxuICAgICAgcHVibGljIGhvc3RQcm9wZXJ0aWVzOiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdLCBwdWJsaWMgaG9zdEV2ZW50czogQm91bmRFdmVudEFzdFtdLFxuICAgICAgcHVibGljIGNvbnRlbnRRdWVyeVN0YXJ0SWQ6IG51bWJlciwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGlyZWN0aXZlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSBwcm92aWRlciBkZWNsYXJlZCBvbiBhbiBlbGVtZW50XG4gKi9cbmV4cG9ydCBjbGFzcyBQcm92aWRlckFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhLCBwdWJsaWMgbXVsdGlQcm92aWRlcjogYm9vbGVhbiwgcHVibGljIGVhZ2VyOiBib29sZWFuLFxuICAgICAgcHVibGljIHByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSwgcHVibGljIHByb3ZpZGVyVHlwZTogUHJvdmlkZXJBc3RUeXBlLFxuICAgICAgcHVibGljIGxpZmVjeWNsZUhvb2tzOiBMaWZlY3ljbGVIb29rc1tdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkgaXNNb2R1bGU6IGJvb2xlYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIC8vIE5vIHZpc2l0IG1ldGhvZCBpbiB0aGUgdmlzaXRvciBmb3Igbm93Li4uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGVudW0gUHJvdmlkZXJBc3RUeXBlIHtcbiAgUHVibGljU2VydmljZSxcbiAgUHJpdmF0ZVNlcnZpY2UsXG4gIENvbXBvbmVudCxcbiAgRGlyZWN0aXZlLFxuICBCdWlsdGluXG59XG5cbi8qKlxuICogUG9zaXRpb24gd2hlcmUgY29udGVudCBpcyB0byBiZSBwcm9qZWN0ZWQgKGluc3RhbmNlIG9mIGA8bmctY29udGVudD5gIGluIGEgdGVtcGxhdGUpLlxuICovXG5leHBvcnQgY2xhc3MgTmdDb250ZW50QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBpbmRleDogbnVtYmVyLCBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlciwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TmdDb250ZW50KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlcnlNYXRjaCB7XG4gIHF1ZXJ5SWQ6IG51bWJlcjtcbiAgdmFsdWU6IENvbXBpbGVUb2tlbk1ldGFkYXRhO1xufVxuXG4vKipcbiAqIEEgdmlzaXRvciBmb3Ige0BsaW5rIFRlbXBsYXRlQXN0fSB0cmVlcyB0aGF0IHdpbGwgcHJvY2VzcyBlYWNoIG5vZGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVGVtcGxhdGVBc3RWaXNpdG9yIHtcbiAgLy8gUmV0dXJuaW5nIGEgdHJ1dGh5IHZhbHVlIGZyb20gYHZpc2l0KClgIHdpbGwgcHJldmVudCBgdGVtcGxhdGVWaXNpdEFsbCgpYCBmcm9tIHRoZSBjYWxsIHRvXG4gIC8vIHRoZSB0eXBlZCBtZXRob2QgYW5kIHJlc3VsdCByZXR1cm5lZCB3aWxsIGJlY29tZSB0aGUgcmVzdWx0IGluY2x1ZGVkIGluIGB2aXNpdEFsbCgpYHNcbiAgLy8gcmVzdWx0IGFycmF5LlxuICB2aXNpdD8oYXN0OiBUZW1wbGF0ZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuXG4gIHZpc2l0TmdDb250ZW50KGFzdDogTmdDb250ZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RW1iZWRkZWRUZW1wbGF0ZShhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFbGVtZW50KGFzdDogRWxlbWVudEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFJlZmVyZW5jZShhc3Q6IFJlZmVyZW5jZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFZhcmlhYmxlKGFzdDogVmFyaWFibGVBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFdmVudChhc3Q6IEJvdW5kRXZlbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFbGVtZW50UHJvcGVydHkoYXN0OiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEF0dHIoYXN0OiBBdHRyQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VGV4dChhc3Q6IFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXREaXJlY3RpdmUoYXN0OiBEaXJlY3RpdmVBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXREaXJlY3RpdmVQcm9wZXJ0eShhc3Q6IEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuLyoqXG4gKiBBIHZpc2l0b3IgdGhhdCBhY2NlcHRzIGVhY2ggbm9kZSBidXQgZG9lc24ndCBkbyBhbnl0aGluZy4gSXQgaXMgaW50ZW5kZWQgdG8gYmUgdXNlZFxuICogYXMgdGhlIGJhc2UgY2xhc3MgZm9yIGEgdmlzaXRvciB0aGF0IGlzIG9ubHkgaW50ZXJlc3RlZCBpbiBhIHN1YnNldCBvZiB0aGUgbm9kZSB0eXBlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE51bGxUZW1wbGF0ZVZpc2l0b3IgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdFZpc2l0b3Ige1xuICB2aXNpdE5nQ29udGVudChhc3Q6IE5nQ29udGVudEFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdEVtYmVkZGVkVGVtcGxhdGUoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRSZWZlcmVuY2UoYXN0OiBSZWZlcmVuY2VBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRWYXJpYWJsZShhc3Q6IFZhcmlhYmxlQXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RXZlbnQoYXN0OiBCb3VuZEV2ZW50QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RWxlbWVudFByb3BlcnR5KGFzdDogQm91bmRFbGVtZW50UHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRBdHRyKGFzdDogQXR0ckFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kVGV4dChhc3Q6IEJvdW5kVGV4dEFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdFRleHQoYXN0OiBUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RGlyZWN0aXZlKGFzdDogRGlyZWN0aXZlQXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RGlyZWN0aXZlUHJvcGVydHkoYXN0OiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG59XG5cbi8qKlxuICogQmFzZSBjbGFzcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGJ1aWxkIGEgdmlzaXRvciB0aGF0IHZpc2l0cyBlYWNoIG5vZGVcbiAqIGluIGFuIHRlbXBsYXRlIGFzdCByZWN1cnNpdmVseS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZVRlbXBsYXRlQXN0VmlzaXRvciBleHRlbmRzIE51bGxUZW1wbGF0ZVZpc2l0b3IgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdFZpc2l0b3Ige1xuICBjb25zdHJ1Y3RvcigpIHsgc3VwZXIoKTsgfVxuXG4gIC8vIE5vZGVzIHdpdGggY2hpbGRyZW5cbiAgdmlzaXRFbWJlZGRlZFRlbXBsYXRlKGFzdDogRW1iZWRkZWRUZW1wbGF0ZUFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdENoaWxkcmVuKGNvbnRleHQsIHZpc2l0ID0+IHtcbiAgICAgIHZpc2l0KGFzdC5hdHRycyk7XG4gICAgICB2aXNpdChhc3QucmVmZXJlbmNlcyk7XG4gICAgICB2aXNpdChhc3QudmFyaWFibGVzKTtcbiAgICAgIHZpc2l0KGFzdC5kaXJlY3RpdmVzKTtcbiAgICAgIHZpc2l0KGFzdC5wcm92aWRlcnMpO1xuICAgICAgdmlzaXQoYXN0LmNoaWxkcmVuKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRDaGlsZHJlbihjb250ZXh0LCB2aXNpdCA9PiB7XG4gICAgICB2aXNpdChhc3QuYXR0cnMpO1xuICAgICAgdmlzaXQoYXN0LmlucHV0cyk7XG4gICAgICB2aXNpdChhc3Qub3V0cHV0cyk7XG4gICAgICB2aXNpdChhc3QucmVmZXJlbmNlcyk7XG4gICAgICB2aXNpdChhc3QuZGlyZWN0aXZlcyk7XG4gICAgICB2aXNpdChhc3QucHJvdmlkZXJzKTtcbiAgICAgIHZpc2l0KGFzdC5jaGlsZHJlbik7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdERpcmVjdGl2ZShhc3Q6IERpcmVjdGl2ZUFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdENoaWxkcmVuKGNvbnRleHQsIHZpc2l0ID0+IHtcbiAgICAgIHZpc2l0KGFzdC5pbnB1dHMpO1xuICAgICAgdmlzaXQoYXN0Lmhvc3RQcm9wZXJ0aWVzKTtcbiAgICAgIHZpc2l0KGFzdC5ob3N0RXZlbnRzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByb3RlY3RlZCB2aXNpdENoaWxkcmVuKFxuICAgICAgY29udGV4dDogYW55LFxuICAgICAgY2I6ICh2aXNpdDogKDxWIGV4dGVuZHMgVGVtcGxhdGVBc3Q+KGNoaWxkcmVuOiBWW118dW5kZWZpbmVkKSA9PiB2b2lkKSkgPT4gdm9pZCkge1xuICAgIGxldCByZXN1bHRzOiBhbnlbXVtdID0gW107XG4gICAgbGV0IHQgPSB0aGlzO1xuICAgIGZ1bmN0aW9uIHZpc2l0PFQgZXh0ZW5kcyBUZW1wbGF0ZUFzdD4oY2hpbGRyZW46IFRbXSB8IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGNoaWxkcmVuICYmIGNoaWxkcmVuLmxlbmd0aCkgcmVzdWx0cy5wdXNoKHRlbXBsYXRlVmlzaXRBbGwodCwgY2hpbGRyZW4sIGNvbnRleHQpKTtcbiAgICB9XG4gICAgY2IodmlzaXQpO1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KFtdLCByZXN1bHRzKTtcbiAgfVxufVxuXG4vKipcbiAqIFZpc2l0IGV2ZXJ5IG5vZGUgaW4gYSBsaXN0IG9mIHtAbGluayBUZW1wbGF0ZUFzdH1zIHdpdGggdGhlIGdpdmVuIHtAbGluayBUZW1wbGF0ZUFzdFZpc2l0b3J9LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcGxhdGVWaXNpdEFsbChcbiAgICB2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGFzdHM6IFRlbXBsYXRlQXN0W10sIGNvbnRleHQ6IGFueSA9IG51bGwpOiBhbnlbXSB7XG4gIGNvbnN0IHJlc3VsdDogYW55W10gPSBbXTtcbiAgY29uc3QgdmlzaXQgPSB2aXNpdG9yLnZpc2l0ID9cbiAgICAgIChhc3Q6IFRlbXBsYXRlQXN0KSA9PiB2aXNpdG9yLnZpc2l0ICEoYXN0LCBjb250ZXh0KSB8fCBhc3QudmlzaXQodmlzaXRvciwgY29udGV4dCkgOlxuICAgICAgKGFzdDogVGVtcGxhdGVBc3QpID0+IGFzdC52aXNpdCh2aXNpdG9yLCBjb250ZXh0KTtcbiAgYXN0cy5mb3JFYWNoKGFzdCA9PiB7XG4gICAgY29uc3QgYXN0UmVzdWx0ID0gdmlzaXQoYXN0KTtcbiAgICBpZiAoYXN0UmVzdWx0KSB7XG4gICAgICByZXN1bHQucHVzaChhc3RSZXN1bHQpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCB0eXBlIFRlbXBsYXRlQXN0UGF0aCA9IEFzdFBhdGg8VGVtcGxhdGVBc3Q+O1xuIl19