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
        define("@angular/compiler/src/template_parser/template_ast", ["require", "exports", "tslib"], factory);
    }
})(function (require, exports) {
    "use strict";
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
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
    exports.TextAst = TextAst;
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
    exports.BoundTextAst = BoundTextAst;
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
    exports.AttrAst = AttrAst;
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
    exports.BoundElementPropertyAst = BoundElementPropertyAst;
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
    exports.BoundEventAst = BoundEventAst;
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
    exports.ReferenceAst = ReferenceAst;
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
    exports.VariableAst = VariableAst;
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
    exports.ElementAst = ElementAst;
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
    exports.EmbeddedTemplateAst = EmbeddedTemplateAst;
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
    exports.BoundDirectivePropertyAst = BoundDirectivePropertyAst;
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
    exports.DirectiveAst = DirectiveAst;
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
    exports.ProviderAst = ProviderAst;
    var ProviderAstType;
    (function (ProviderAstType) {
        ProviderAstType[ProviderAstType["PublicService"] = 0] = "PublicService";
        ProviderAstType[ProviderAstType["PrivateService"] = 1] = "PrivateService";
        ProviderAstType[ProviderAstType["Component"] = 2] = "Component";
        ProviderAstType[ProviderAstType["Directive"] = 3] = "Directive";
        ProviderAstType[ProviderAstType["Builtin"] = 4] = "Builtin";
    })(ProviderAstType = exports.ProviderAstType || (exports.ProviderAstType = {}));
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
    exports.NgContentAst = NgContentAst;
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
    exports.NullTemplateVisitor = NullTemplateVisitor;
    /**
     * Base class that can be used to build a visitor that visits each node
     * in an template ast recursively.
     */
    var RecursiveTemplateAstVisitor = /** @class */ (function (_super) {
        tslib_1.__extends(RecursiveTemplateAstVisitor, _super);
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
    exports.RecursiveTemplateAstVisitor = RecursiveTemplateAstVisitor;
    /**
     * Visit every node in a list of {@link TemplateAst}s with the given {@link TemplateAstVisitor}.
     */
    function templateVisitAll(visitor, asts, context) {
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
    exports.templateVisitAll = templateVisitAll;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQTBCSDs7T0FFRztJQUNIO1FBQ0UsaUJBQ1csS0FBYSxFQUFTLGNBQXNCLEVBQVMsVUFBMkI7WUFBaEYsVUFBSyxHQUFMLEtBQUssQ0FBUTtZQUFTLG1CQUFjLEdBQWQsY0FBYyxDQUFRO1lBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBRyxDQUFDO1FBQy9GLHVCQUFLLEdBQUwsVUFBTSxPQUEyQixFQUFFLE9BQVksSUFBUyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRyxjQUFDO0lBQUQsQ0FBQyxBQUpELElBSUM7SUFKWSwwQkFBTztJQU1wQjs7T0FFRztJQUNIO1FBQ0Usc0JBQ1csS0FBb0IsRUFBUyxjQUFzQixFQUNuRCxVQUEyQjtZQUQzQixVQUFLLEdBQUwsS0FBSyxDQUFlO1lBQVMsbUJBQWMsR0FBZCxjQUFjLENBQVE7WUFDbkQsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBRyxDQUFDO1FBQzFDLDRCQUFLLEdBQUwsVUFBTSxPQUEyQixFQUFFLE9BQVk7WUFDN0MsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBUEQsSUFPQztJQVBZLG9DQUFZO0lBU3pCOztPQUVHO0lBQ0g7UUFDRSxpQkFBbUIsSUFBWSxFQUFTLEtBQWEsRUFBUyxVQUEyQjtZQUF0RSxTQUFJLEdBQUosSUFBSSxDQUFRO1lBQVMsVUFBSyxHQUFMLEtBQUssQ0FBUTtZQUFTLGVBQVUsR0FBVixVQUFV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T0FBbUI7UUFBbkIsd0JBQUEsRUFBQSxjQUFtQjtRQUN2RSxJQUFNLE1BQU0sR0FBVSxFQUFFLENBQUM7UUFDekIsSUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3pCLFVBQUMsR0FBZ0IsSUFBSyxPQUFBLE9BQU8sQ0FBQyxLQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUE1RCxDQUE0RCxDQUFDLENBQUM7WUFDcEYsVUFBQyxHQUFnQixJQUFLLE9BQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQTNCLENBQTJCLENBQUM7UUFDdEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEdBQUc7WUFDZCxJQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0IsSUFBSSxTQUFTLEVBQUU7Z0JBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUN4QjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQWJELDRDQWFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FzdFBhdGh9IGZyb20gJy4uL2FzdF9wYXRoJztcbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBDb21waWxlVG9rZW5NZXRhZGF0YX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0FTVFdpdGhTb3VyY2UsIEJpbmRpbmdUeXBlLCBCb3VuZEVsZW1lbnRQcm9wZXJ0eSwgUGFyc2VkRXZlbnQsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VkVmFyaWFibGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xpZmVjeWNsZUhvb2tzfSBmcm9tICcuLi9saWZlY3ljbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuXG5cbi8qKlxuICogQW4gQWJzdHJhY3QgU3ludGF4IFRyZWUgbm9kZSByZXByZXNlbnRpbmcgcGFydCBvZiBhIHBhcnNlZCBBbmd1bGFyIHRlbXBsYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRlbXBsYXRlQXN0IHtcbiAgLyoqXG4gICAqIFRoZSBzb3VyY2Ugc3BhbiBmcm9tIHdoaWNoIHRoaXMgbm9kZSB3YXMgcGFyc2VkLlxuICAgKi9cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuXG4gIC8qKlxuICAgKiBWaXNpdCB0aGlzIG5vZGUgYW5kIHBvc3NpYmx5IHRyYW5zZm9ybSBpdC5cbiAgICovXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vKipcbiAqIEEgc2VnbWVudCBvZiB0ZXh0IHdpdGhpbiB0aGUgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlciwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdFRleHQodGhpcywgY29udGV4dCk7IH1cbn1cblxuLyoqXG4gKiBBIGJvdW5kIGV4cHJlc3Npb24gd2l0aGluIHRoZSB0ZXh0IG9mIGEgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBCb3VuZFRleHRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBBU1RXaXRoU291cmNlLCBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlcixcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kVGV4dCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgcGxhaW4gYXR0cmlidXRlIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBBdHRyQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdmlzaXRvci52aXNpdEF0dHIodGhpcywgY29udGV4dCk7IH1cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gUHJvcGVydHlCaW5kaW5nVHlwZSB7XG4gIC8vIEEgbm9ybWFsIGJpbmRpbmcgdG8gYSBwcm9wZXJ0eSAoZS5nLiBgW3Byb3BlcnR5XT1cImV4cHJlc3Npb25cImApLlxuICBQcm9wZXJ0eSxcbiAgLy8gQSBiaW5kaW5nIHRvIGFuIGVsZW1lbnQgYXR0cmlidXRlIChlLmcuIGBbYXR0ci5uYW1lXT1cImV4cHJlc3Npb25cImApLlxuICBBdHRyaWJ1dGUsXG4gIC8vIEEgYmluZGluZyB0byBhIENTUyBjbGFzcyAoZS5nLiBgW2NsYXNzLm5hbWVdPVwiY29uZGl0aW9uXCJgKS5cbiAgQ2xhc3MsXG4gIC8vIEEgYmluZGluZyB0byBhIHN0eWxlIHJ1bGUgKGUuZy4gYFtzdHlsZS5ydWxlXT1cImV4cHJlc3Npb25cImApLlxuICBTdHlsZSxcbiAgLy8gQSBiaW5kaW5nIHRvIGFuIGFuaW1hdGlvbiByZWZlcmVuY2UgKGUuZy4gYFthbmltYXRlLmtleV09XCJleHByZXNzaW9uXCJgKS5cbiAgQW5pbWF0aW9uLFxufVxuXG5jb25zdCBCb3VuZFByb3BlcnR5TWFwcGluZyA9IHtcbiAgW0JpbmRpbmdUeXBlLkFuaW1hdGlvbl06IFByb3BlcnR5QmluZGluZ1R5cGUuQW5pbWF0aW9uLFxuICBbQmluZGluZ1R5cGUuQXR0cmlidXRlXTogUHJvcGVydHlCaW5kaW5nVHlwZS5BdHRyaWJ1dGUsXG4gIFtCaW5kaW5nVHlwZS5DbGFzc106IFByb3BlcnR5QmluZGluZ1R5cGUuQ2xhc3MsXG4gIFtCaW5kaW5nVHlwZS5Qcm9wZXJ0eV06IFByb3BlcnR5QmluZGluZ1R5cGUuUHJvcGVydHksXG4gIFtCaW5kaW5nVHlwZS5TdHlsZV06IFByb3BlcnR5QmluZGluZ1R5cGUuU3R5bGUsXG59O1xuXG4vKipcbiAqIEEgYmluZGluZyBmb3IgYW4gZWxlbWVudCBwcm9wZXJ0eSAoZS5nLiBgW3Byb3BlcnR5XT1cImV4cHJlc3Npb25cImApIG9yIGFuIGFuaW1hdGlvbiB0cmlnZ2VyIChlLmcuXG4gKiBgW0B0cmlnZ2VyXT1cInN0YXRlRXhwXCJgKVxuICovXG5leHBvcnQgY2xhc3MgQm91bmRFbGVtZW50UHJvcGVydHlBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIHJlYWRvbmx5IGlzQW5pbWF0aW9uOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IFByb3BlcnR5QmluZGluZ1R5cGUsXG4gICAgICBwdWJsaWMgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsIHB1YmxpYyB2YWx1ZTogQVNUV2l0aFNvdXJjZSxcbiAgICAgIHB1YmxpYyB1bml0OiBzdHJpbmd8bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuaXNBbmltYXRpb24gPSB0aGlzLnR5cGUgPT09IFByb3BlcnR5QmluZGluZ1R5cGUuQW5pbWF0aW9uO1xuICB9XG5cbiAgc3RhdGljIGZyb21Cb3VuZFByb3BlcnR5KHByb3A6IEJvdW5kRWxlbWVudFByb3BlcnR5KSB7XG4gICAgY29uc3QgdHlwZSA9IEJvdW5kUHJvcGVydHlNYXBwaW5nW3Byb3AudHlwZV07XG4gICAgcmV0dXJuIG5ldyBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdChcbiAgICAgICAgcHJvcC5uYW1lLCB0eXBlLCBwcm9wLnNlY3VyaXR5Q29udGV4dCwgcHJvcC52YWx1ZSwgcHJvcC51bml0LCBwcm9wLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RWxlbWVudFByb3BlcnR5KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSBiaW5kaW5nIGZvciBhbiBlbGVtZW50IGV2ZW50IChlLmcuIGAoZXZlbnQpPVwiaGFuZGxlcigpXCJgKSBvciBhbiBhbmltYXRpb24gdHJpZ2dlciBldmVudCAoZS5nLlxuICogYChAdHJpZ2dlci5waGFzZSk9XCJjYWxsYmFjaygkZXZlbnQpXCJgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIEJvdW5kRXZlbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIHJlYWRvbmx5IGZ1bGxOYW1lOiBzdHJpbmc7XG4gIHJlYWRvbmx5IGlzQW5pbWF0aW9uOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHRhcmdldDogc3RyaW5nfG51bGwsIHB1YmxpYyBwaGFzZTogc3RyaW5nfG51bGwsXG4gICAgICBwdWJsaWMgaGFuZGxlcjogQVNUV2l0aFNvdXJjZSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgdGhpcy5mdWxsTmFtZSA9IEJvdW5kRXZlbnRBc3QuY2FsY0Z1bGxOYW1lKHRoaXMubmFtZSwgdGhpcy50YXJnZXQsIHRoaXMucGhhc2UpO1xuICAgIHRoaXMuaXNBbmltYXRpb24gPSAhIXRoaXMucGhhc2U7XG4gIH1cblxuICBzdGF0aWMgY2FsY0Z1bGxOYW1lKG5hbWU6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmd8bnVsbCwgcGhhc2U6IHN0cmluZ3xudWxsKTogc3RyaW5nIHtcbiAgICBpZiAodGFyZ2V0KSB7XG4gICAgICByZXR1cm4gYCR7dGFyZ2V0fToke25hbWV9YDtcbiAgICB9XG4gICAgaWYgKHBoYXNlKSB7XG4gICAgICByZXR1cm4gYEAke25hbWV9LiR7cGhhc2V9YDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuXG4gIHN0YXRpYyBmcm9tUGFyc2VkRXZlbnQoZXZlbnQ6IFBhcnNlZEV2ZW50KSB7XG4gICAgY29uc3QgdGFyZ2V0OiBzdHJpbmd8bnVsbCA9IGV2ZW50LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5SZWd1bGFyID8gZXZlbnQudGFyZ2V0T3JQaGFzZSA6IG51bGw7XG4gICAgY29uc3QgcGhhc2U6IHN0cmluZ3xudWxsID1cbiAgICAgICAgZXZlbnQudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IGV2ZW50LnRhcmdldE9yUGhhc2UgOiBudWxsO1xuICAgIHJldHVybiBuZXcgQm91bmRFdmVudEFzdChcbiAgICAgICAgZXZlbnQubmFtZSwgdGFyZ2V0LCBwaGFzZSwgZXZlbnQuaGFuZGxlciwgZXZlbnQuc291cmNlU3BhbiwgZXZlbnQuaGFuZGxlclNwYW4pO1xuICB9XG5cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXZlbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSBkZWNsYXJhdGlvbiBvbiBhbiBlbGVtZW50IChlLmcuIGBsZXQgc29tZU5hbWU9XCJleHByZXNzaW9uXCJgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IENvbXBpbGVUb2tlbk1ldGFkYXRhLCBwdWJsaWMgb3JpZ2luYWxWYWx1ZTogc3RyaW5nLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVmZXJlbmNlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBvbiBhIDxuZy10ZW1wbGF0ZT4gKGUuZy4gYHZhci1zb21lTmFtZT1cInNvbWVMb2NhbE5hbWVcImApLlxuICovXG5leHBvcnQgY2xhc3MgVmFyaWFibGVBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZywgcHVibGljIHJlYWRvbmx5IHZhbHVlOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgcmVhZG9ubHkgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgcmVhZG9ubHkgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHN0YXRpYyBmcm9tUGFyc2VkVmFyaWFibGUodjogUGFyc2VkVmFyaWFibGUpIHtcbiAgICByZXR1cm4gbmV3IFZhcmlhYmxlQXN0KHYubmFtZSwgdi52YWx1ZSwgdi5zb3VyY2VTcGFuLCB2LnZhbHVlU3Bhbik7XG4gIH1cblxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRWYXJpYWJsZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEFuIGVsZW1lbnQgZGVjbGFyYXRpb24gaW4gYSB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEVsZW1lbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGF0dHJzOiBBdHRyQXN0W10sIHB1YmxpYyBpbnB1dHM6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10sXG4gICAgICBwdWJsaWMgb3V0cHV0czogQm91bmRFdmVudEFzdFtdLCBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlQXN0W10sXG4gICAgICBwdWJsaWMgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sIHB1YmxpYyBwcm92aWRlcnM6IFByb3ZpZGVyQXN0W10sXG4gICAgICBwdWJsaWMgaGFzVmlld0NvbnRhaW5lcjogYm9vbGVhbiwgcHVibGljIHF1ZXJ5TWF0Y2hlczogUXVlcnlNYXRjaFtdLFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBUZW1wbGF0ZUFzdFtdLCBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlcnxudWxsLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGA8bmctdGVtcGxhdGU+YCBlbGVtZW50IGluY2x1ZGVkIGluIGFuIEFuZ3VsYXIgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBFbWJlZGRlZFRlbXBsYXRlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBhdHRyczogQXR0ckFzdFtdLCBwdWJsaWMgb3V0cHV0czogQm91bmRFdmVudEFzdFtdLCBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlQXN0W10sXG4gICAgICBwdWJsaWMgdmFyaWFibGVzOiBWYXJpYWJsZUFzdFtdLCBwdWJsaWMgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sXG4gICAgICBwdWJsaWMgcHJvdmlkZXJzOiBQcm92aWRlckFzdFtdLCBwdWJsaWMgaGFzVmlld0NvbnRhaW5lcjogYm9vbGVhbixcbiAgICAgIHB1YmxpYyBxdWVyeU1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSwgcHVibGljIGNoaWxkcmVuOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RW1iZWRkZWRUZW1wbGF0ZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgZGlyZWN0aXZlIHByb3BlcnR5IHdpdGggYSBib3VuZCB2YWx1ZSAoZS5nLiBgKm5nSWY9XCJjb25kaXRpb25cIikuXG4gKi9cbmV4cG9ydCBjbGFzcyBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBkaXJlY3RpdmVOYW1lOiBzdHJpbmcsIHB1YmxpYyB0ZW1wbGF0ZU5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBBU1RXaXRoU291cmNlLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGlyZWN0aXZlUHJvcGVydHkodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGRpcmVjdGl2ZSBkZWNsYXJlZCBvbiBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgY2xhc3MgRGlyZWN0aXZlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBwdWJsaWMgaW5wdXRzOiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0W10sXG4gICAgICBwdWJsaWMgaG9zdFByb3BlcnRpZXM6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10sIHB1YmxpYyBob3N0RXZlbnRzOiBCb3VuZEV2ZW50QXN0W10sXG4gICAgICBwdWJsaWMgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREaXJlY3RpdmUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHByb3ZpZGVyIGRlY2xhcmVkIG9uIGFuIGVsZW1lbnRcbiAqL1xuZXhwb3J0IGNsYXNzIFByb3ZpZGVyQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEsIHB1YmxpYyBtdWx0aVByb3ZpZGVyOiBib29sZWFuLCBwdWJsaWMgZWFnZXI6IGJvb2xlYW4sXG4gICAgICBwdWJsaWMgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdLCBwdWJsaWMgcHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsXG4gICAgICBwdWJsaWMgbGlmZWN5Y2xlSG9va3M6IExpZmVjeWNsZUhvb2tzW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBpc01vZHVsZTogYm9vbGVhbikge31cblxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gTm8gdmlzaXQgbWV0aG9kIGluIHRoZSB2aXNpdG9yIGZvciBub3cuLi5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBQcm92aWRlckFzdFR5cGUge1xuICBQdWJsaWNTZXJ2aWNlLFxuICBQcml2YXRlU2VydmljZSxcbiAgQ29tcG9uZW50LFxuICBEaXJlY3RpdmUsXG4gIEJ1aWx0aW5cbn1cblxuLyoqXG4gKiBQb3NpdGlvbiB3aGVyZSBjb250ZW50IGlzIHRvIGJlIHByb2plY3RlZCAoaW5zdGFuY2Ugb2YgYDxuZy1jb250ZW50PmAgaW4gYSB0ZW1wbGF0ZSkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ0NvbnRlbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGluZGV4OiBudW1iZXIsIHB1YmxpYyBuZ0NvbnRlbnRJbmRleDogbnVtYmVyLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXROZ0NvbnRlbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBRdWVyeU1hdGNoIHtcbiAgcXVlcnlJZDogbnVtYmVyO1xuICB2YWx1ZTogQ29tcGlsZVRva2VuTWV0YWRhdGE7XG59XG5cbi8qKlxuICogQSB2aXNpdG9yIGZvciB7QGxpbmsgVGVtcGxhdGVBc3R9IHRyZWVzIHRoYXQgd2lsbCBwcm9jZXNzIGVhY2ggbm9kZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZUFzdFZpc2l0b3Ige1xuICAvLyBSZXR1cm5pbmcgYSB0cnV0aHkgdmFsdWUgZnJvbSBgdmlzaXQoKWAgd2lsbCBwcmV2ZW50IGB0ZW1wbGF0ZVZpc2l0QWxsKClgIGZyb20gdGhlIGNhbGwgdG9cbiAgLy8gdGhlIHR5cGVkIG1ldGhvZCBhbmQgcmVzdWx0IHJldHVybmVkIHdpbGwgYmVjb21lIHRoZSByZXN1bHQgaW5jbHVkZWQgaW4gYHZpc2l0QWxsKClgc1xuICAvLyByZXN1bHQgYXJyYXkuXG4gIHZpc2l0Pyhhc3Q6IFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgdmlzaXROZ0NvbnRlbnQoYXN0OiBOZ0NvbnRlbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFbWJlZGRlZFRlbXBsYXRlKGFzdDogRW1iZWRkZWRUZW1wbGF0ZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEVsZW1lbnQoYXN0OiBFbGVtZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVmZXJlbmNlKGFzdDogUmVmZXJlbmNlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VmFyaWFibGUoYXN0OiBWYXJpYWJsZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV2ZW50KGFzdDogQm91bmRFdmVudEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEVsZW1lbnRQcm9wZXJ0eShhc3Q6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXR0cihhc3Q6IEF0dHJBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRCb3VuZFRleHQoYXN0OiBCb3VuZFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRUZXh0KGFzdDogVGV4dEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdERpcmVjdGl2ZShhc3Q6IERpcmVjdGl2ZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdERpcmVjdGl2ZVByb3BlcnR5KGFzdDogQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vKipcbiAqIEEgdmlzaXRvciB0aGF0IGFjY2VwdHMgZWFjaCBub2RlIGJ1dCBkb2Vzbid0IGRvIGFueXRoaW5nLiBJdCBpcyBpbnRlbmRlZCB0byBiZSB1c2VkXG4gKiBhcyB0aGUgYmFzZSBjbGFzcyBmb3IgYSB2aXNpdG9yIHRoYXQgaXMgb25seSBpbnRlcmVzdGVkIGluIGEgc3Vic2V0IG9mIHRoZSBub2RlIHR5cGVzLlxuICovXG5leHBvcnQgY2xhc3MgTnVsbFRlbXBsYXRlVmlzaXRvciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciB7XG4gIHZpc2l0TmdDb250ZW50KGFzdDogTmdDb250ZW50QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RW1iZWRkZWRUZW1wbGF0ZShhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRFbGVtZW50KGFzdDogRWxlbWVudEFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShhc3Q6IFJlZmVyZW5jZUFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKGFzdDogVmFyaWFibGVBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRFdmVudChhc3Q6IEJvdW5kRXZlbnRBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRFbGVtZW50UHJvcGVydHkoYXN0OiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdEF0dHIoYXN0OiBBdHRyQXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dChhc3Q6IFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXREaXJlY3RpdmUoYXN0OiBEaXJlY3RpdmVBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXREaXJlY3RpdmVQcm9wZXJ0eShhc3Q6IEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBCYXNlIGNsYXNzIHRoYXQgY2FuIGJlIHVzZWQgdG8gYnVpbGQgYSB2aXNpdG9yIHRoYXQgdmlzaXRzIGVhY2ggbm9kZVxuICogaW4gYW4gdGVtcGxhdGUgYXN0IHJlY3Vyc2l2ZWx5LlxuICovXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlVGVtcGxhdGVBc3RWaXNpdG9yIGV4dGVuZHMgTnVsbFRlbXBsYXRlVmlzaXRvciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKCkgeyBzdXBlcigpOyB9XG5cbiAgLy8gTm9kZXMgd2l0aCBjaGlsZHJlblxuICB2aXNpdEVtYmVkZGVkVGVtcGxhdGUoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0Q2hpbGRyZW4oY29udGV4dCwgdmlzaXQgPT4ge1xuICAgICAgdmlzaXQoYXN0LmF0dHJzKTtcbiAgICAgIHZpc2l0KGFzdC5yZWZlcmVuY2VzKTtcbiAgICAgIHZpc2l0KGFzdC52YXJpYWJsZXMpO1xuICAgICAgdmlzaXQoYXN0LmRpcmVjdGl2ZXMpO1xuICAgICAgdmlzaXQoYXN0LnByb3ZpZGVycyk7XG4gICAgICB2aXNpdChhc3QuY2hpbGRyZW4pO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGFzdDogRWxlbWVudEFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdENoaWxkcmVuKGNvbnRleHQsIHZpc2l0ID0+IHtcbiAgICAgIHZpc2l0KGFzdC5hdHRycyk7XG4gICAgICB2aXNpdChhc3QuaW5wdXRzKTtcbiAgICAgIHZpc2l0KGFzdC5vdXRwdXRzKTtcbiAgICAgIHZpc2l0KGFzdC5yZWZlcmVuY2VzKTtcbiAgICAgIHZpc2l0KGFzdC5kaXJlY3RpdmVzKTtcbiAgICAgIHZpc2l0KGFzdC5wcm92aWRlcnMpO1xuICAgICAgdmlzaXQoYXN0LmNoaWxkcmVuKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RGlyZWN0aXZlKGFzdDogRGlyZWN0aXZlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0Q2hpbGRyZW4oY29udGV4dCwgdmlzaXQgPT4ge1xuICAgICAgdmlzaXQoYXN0LmlucHV0cyk7XG4gICAgICB2aXNpdChhc3QuaG9zdFByb3BlcnRpZXMpO1xuICAgICAgdmlzaXQoYXN0Lmhvc3RFdmVudHMpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIHZpc2l0Q2hpbGRyZW4oXG4gICAgICBjb250ZXh0OiBhbnksXG4gICAgICBjYjogKHZpc2l0OiAoPFYgZXh0ZW5kcyBUZW1wbGF0ZUFzdD4oY2hpbGRyZW46IFZbXXx1bmRlZmluZWQpID0+IHZvaWQpKSA9PiB2b2lkKSB7XG4gICAgbGV0IHJlc3VsdHM6IGFueVtdW10gPSBbXTtcbiAgICBsZXQgdCA9IHRoaXM7XG4gICAgZnVuY3Rpb24gdmlzaXQ8VCBleHRlbmRzIFRlbXBsYXRlQXN0PihjaGlsZHJlbjogVFtdIHwgdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoKSByZXN1bHRzLnB1c2godGVtcGxhdGVWaXNpdEFsbCh0LCBjaGlsZHJlbiwgY29udGV4dCkpO1xuICAgIH1cbiAgICBjYih2aXNpdCk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sIHJlc3VsdHMpO1xuICB9XG59XG5cbi8qKlxuICogVmlzaXQgZXZlcnkgbm9kZSBpbiBhIGxpc3Qgb2Yge0BsaW5rIFRlbXBsYXRlQXN0fXMgd2l0aCB0aGUgZ2l2ZW4ge0BsaW5rIFRlbXBsYXRlQXN0VmlzaXRvcn0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZVZpc2l0QWxsKFxuICAgIHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgYXN0czogVGVtcGxhdGVBc3RbXSwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueVtdIHtcbiAgY29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuICBjb25zdCB2aXNpdCA9IHZpc2l0b3IudmlzaXQgP1xuICAgICAgKGFzdDogVGVtcGxhdGVBc3QpID0+IHZpc2l0b3IudmlzaXQgIShhc3QsIGNvbnRleHQpIHx8IGFzdC52aXNpdCh2aXNpdG9yLCBjb250ZXh0KSA6XG4gICAgICAoYXN0OiBUZW1wbGF0ZUFzdCkgPT4gYXN0LnZpc2l0KHZpc2l0b3IsIGNvbnRleHQpO1xuICBhc3RzLmZvckVhY2goYXN0ID0+IHtcbiAgICBjb25zdCBhc3RSZXN1bHQgPSB2aXNpdChhc3QpO1xuICAgIGlmIChhc3RSZXN1bHQpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGFzdFJlc3VsdCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IHR5cGUgVGVtcGxhdGVBc3RQYXRoID0gQXN0UGF0aDxUZW1wbGF0ZUFzdD47XG4iXX0=