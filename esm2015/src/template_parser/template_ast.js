/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * A segment of text within the template.
 */
export class TextAst {
    constructor(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) { return visitor.visitText(this, context); }
}
/**
 * A bound expression within the text of a template.
 */
export class BoundTextAst {
    constructor(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitBoundText(this, context);
    }
}
/**
 * A plain attribute on an element.
 */
export class AttrAst {
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) { return visitor.visitAttr(this, context); }
}
const BoundPropertyMapping = {
    [4 /* Animation */]: 4 /* Animation */,
    [1 /* Attribute */]: 1 /* Attribute */,
    [2 /* Class */]: 2 /* Class */,
    [0 /* Property */]: 0 /* Property */,
    [3 /* Style */]: 3 /* Style */,
};
/**
 * A binding for an element property (e.g. `[property]="expression"`) or an animation trigger (e.g.
 * `[@trigger]="stateExp"`)
 */
export class BoundElementPropertyAst {
    constructor(name, type, securityContext, value, unit, sourceSpan) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
        this.isAnimation = this.type === 4 /* Animation */;
    }
    static fromBoundProperty(prop) {
        const type = BoundPropertyMapping[prop.type];
        return new BoundElementPropertyAst(prop.name, type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan);
    }
    visit(visitor, context) {
        return visitor.visitElementProperty(this, context);
    }
}
/**
 * A binding for an element event (e.g. `(event)="handler()"`) or an animation trigger event (e.g.
 * `(@trigger.phase)="callback($event)"`).
 */
export class BoundEventAst {
    constructor(name, target, phase, handler, sourceSpan, handlerSpan) {
        this.name = name;
        this.target = target;
        this.phase = phase;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
        this.handlerSpan = handlerSpan;
        this.fullName = BoundEventAst.calcFullName(this.name, this.target, this.phase);
        this.isAnimation = !!this.phase;
    }
    static calcFullName(name, target, phase) {
        if (target) {
            return `${target}:${name}`;
        }
        if (phase) {
            return `@${name}.${phase}`;
        }
        return name;
    }
    static fromParsedEvent(event) {
        const target = event.type === 0 /* Regular */ ? event.targetOrPhase : null;
        const phase = event.type === 1 /* Animation */ ? event.targetOrPhase : null;
        return new BoundEventAst(event.name, target, phase, event.handler, event.sourceSpan, event.handlerSpan);
    }
    visit(visitor, context) {
        return visitor.visitEvent(this, context);
    }
}
/**
 * A reference declaration on an element (e.g. `let someName="expression"`).
 */
export class ReferenceAst {
    constructor(name, value, originalValue, sourceSpan) {
        this.name = name;
        this.value = value;
        this.originalValue = originalValue;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitReference(this, context);
    }
}
/**
 * A variable declaration on a <ng-template> (e.g. `var-someName="someLocalName"`).
 */
export class VariableAst {
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    static fromParsedVariable(v) {
        return new VariableAst(v.name, v.value, v.sourceSpan);
    }
    visit(visitor, context) {
        return visitor.visitVariable(this, context);
    }
}
/**
 * An element declaration in a template.
 */
export class ElementAst {
    constructor(name, attrs, inputs, outputs, references, directives, providers, hasViewContainer, queryMatches, children, ngContentIndex, sourceSpan, endSourceSpan) {
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
    visit(visitor, context) {
        return visitor.visitElement(this, context);
    }
}
/**
 * A `<ng-template>` element included in an Angular template.
 */
export class EmbeddedTemplateAst {
    constructor(attrs, outputs, references, variables, directives, providers, hasViewContainer, queryMatches, children, ngContentIndex, sourceSpan) {
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
    visit(visitor, context) {
        return visitor.visitEmbeddedTemplate(this, context);
    }
}
/**
 * A directive property with a bound value (e.g. `*ngIf="condition").
 */
export class BoundDirectivePropertyAst {
    constructor(directiveName, templateName, value, sourceSpan) {
        this.directiveName = directiveName;
        this.templateName = templateName;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitDirectiveProperty(this, context);
    }
}
/**
 * A directive declared on an element.
 */
export class DirectiveAst {
    constructor(directive, inputs, hostProperties, hostEvents, contentQueryStartId, sourceSpan) {
        this.directive = directive;
        this.inputs = inputs;
        this.hostProperties = hostProperties;
        this.hostEvents = hostEvents;
        this.contentQueryStartId = contentQueryStartId;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitDirective(this, context);
    }
}
/**
 * A provider declared on an element
 */
export class ProviderAst {
    constructor(token, multiProvider, eager, providers, providerType, lifecycleHooks, sourceSpan, isModule) {
        this.token = token;
        this.multiProvider = multiProvider;
        this.eager = eager;
        this.providers = providers;
        this.providerType = providerType;
        this.lifecycleHooks = lifecycleHooks;
        this.sourceSpan = sourceSpan;
        this.isModule = isModule;
    }
    visit(visitor, context) {
        // No visit method in the visitor for now...
        return null;
    }
}
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
export class NgContentAst {
    constructor(index, ngContentIndex, sourceSpan) {
        this.index = index;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitNgContent(this, context);
    }
}
/**
 * A visitor that accepts each node but doesn't do anything. It is intended to be used
 * as the base class for a visitor that is only interested in a subset of the node types.
 */
export class NullTemplateVisitor {
    visitNgContent(ast, context) { }
    visitEmbeddedTemplate(ast, context) { }
    visitElement(ast, context) { }
    visitReference(ast, context) { }
    visitVariable(ast, context) { }
    visitEvent(ast, context) { }
    visitElementProperty(ast, context) { }
    visitAttr(ast, context) { }
    visitBoundText(ast, context) { }
    visitText(ast, context) { }
    visitDirective(ast, context) { }
    visitDirectiveProperty(ast, context) { }
}
/**
 * Base class that can be used to build a visitor that visits each node
 * in an template ast recursively.
 */
export class RecursiveTemplateAstVisitor extends NullTemplateVisitor {
    constructor() { super(); }
    // Nodes with children
    visitEmbeddedTemplate(ast, context) {
        return this.visitChildren(context, visit => {
            visit(ast.attrs);
            visit(ast.references);
            visit(ast.variables);
            visit(ast.directives);
            visit(ast.providers);
            visit(ast.children);
        });
    }
    visitElement(ast, context) {
        return this.visitChildren(context, visit => {
            visit(ast.attrs);
            visit(ast.inputs);
            visit(ast.outputs);
            visit(ast.references);
            visit(ast.directives);
            visit(ast.providers);
            visit(ast.children);
        });
    }
    visitDirective(ast, context) {
        return this.visitChildren(context, visit => {
            visit(ast.inputs);
            visit(ast.hostProperties);
            visit(ast.hostEvents);
        });
    }
    visitChildren(context, cb) {
        let results = [];
        let t = this;
        function visit(children) {
            if (children && children.length)
                results.push(templateVisitAll(t, children, context));
        }
        cb(visit);
        return Array.prototype.concat.apply([], results);
    }
}
/**
 * Visit every node in a list of {@link TemplateAst}s with the given {@link TemplateAstVisitor}.
 */
export function templateVisitAll(visitor, asts, context = null) {
    const result = [];
    const visit = visitor.visit ?
        (ast) => visitor.visit(ast, context) || ast.visit(visitor, context) :
        (ast) => ast.visit(visitor, context);
    asts.forEach(ast => {
        const astResult = visit(ast);
        if (astResult) {
            result.push(astResult);
        }
    });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBMEJIOztHQUVHO0FBQ0gsTUFBTSxPQUFPLE9BQU87SUFDbEIsWUFDVyxLQUFhLEVBQVMsY0FBc0IsRUFBUyxVQUEyQjtRQUFoRixVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsbUJBQWMsR0FBZCxjQUFjLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDL0YsS0FBSyxDQUFDLE9BQTJCLEVBQUUsT0FBWSxJQUFTLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25HO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sWUFBWTtJQUN2QixZQUNXLEtBQW9CLEVBQVMsY0FBc0IsRUFDbkQsVUFBMkI7UUFEM0IsVUFBSyxHQUFMLEtBQUssQ0FBZTtRQUFTLG1CQUFjLEdBQWQsY0FBYyxDQUFRO1FBQ25ELGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztJQUMxQyxLQUFLLENBQUMsT0FBMkIsRUFBRSxPQUFZO1FBQzdDLE9BQU8sT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sT0FBTztJQUNsQixZQUFtQixJQUFZLEVBQVMsS0FBYSxFQUFTLFVBQTJCO1FBQXRFLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7SUFBRyxDQUFDO0lBQzdGLEtBQUssQ0FBQyxPQUEyQixFQUFFLE9BQVksSUFBUyxP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UUFDYixTQUFTLEtBQUssQ0FBd0IsUUFBeUI7WUFDN0QsSUFBSSxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU07Z0JBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDeEYsQ0FBQztRQUNELEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNWLE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0NBQ0Y7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FDNUIsT0FBMkIsRUFBRSxJQUFtQixFQUFFLFVBQWUsSUFBSTtJQUN2RSxNQUFNLE1BQU0sR0FBVSxFQUFFLENBQUM7SUFDekIsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3pCLENBQUMsR0FBZ0IsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQU8sQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNwRixDQUFDLEdBQWdCLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDakIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLElBQUksU0FBUyxFQUFFO1lBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUN4QjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBc3RQYXRofSBmcm9tICcuLi9hc3RfcGF0aCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGF9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtBU1RXaXRoU291cmNlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFZhcmlhYmxlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cblxuXG4vKipcbiAqIEFuIEFic3RyYWN0IFN5bnRheCBUcmVlIG5vZGUgcmVwcmVzZW50aW5nIHBhcnQgb2YgYSBwYXJzZWQgQW5ndWxhciB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZUFzdCB7XG4gIC8qKlxuICAgKiBUaGUgc291cmNlIHNwYW4gZnJvbSB3aGljaCB0aGlzIG5vZGUgd2FzIHBhcnNlZC5cbiAgICovXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcblxuICAvKipcbiAgICogVmlzaXQgdGhpcyBub2RlIGFuZCBwb3NzaWJseSB0cmFuc2Zvcm0gaXQuXG4gICAqL1xuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuLyoqXG4gKiBBIHNlZ21lbnQgb2YgdGV4dCB3aXRoaW4gdGhlIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVGV4dEFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRUZXh0KHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbi8qKlxuICogQSBib3VuZCBleHByZXNzaW9uIHdpdGhpbiB0aGUgdGV4dCBvZiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNUV2l0aFNvdXJjZSwgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZFRleHQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHBsYWluIGF0dHJpYnV0ZSBvbiBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgY2xhc3MgQXR0ckFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRBdHRyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFByb3BlcnR5QmluZGluZ1R5cGUge1xuICAvLyBBIG5vcm1hbCBiaW5kaW5nIHRvIGEgcHJvcGVydHkgKGUuZy4gYFtwcm9wZXJ0eV09XCJleHByZXNzaW9uXCJgKS5cbiAgUHJvcGVydHksXG4gIC8vIEEgYmluZGluZyB0byBhbiBlbGVtZW50IGF0dHJpYnV0ZSAoZS5nLiBgW2F0dHIubmFtZV09XCJleHByZXNzaW9uXCJgKS5cbiAgQXR0cmlidXRlLFxuICAvLyBBIGJpbmRpbmcgdG8gYSBDU1MgY2xhc3MgKGUuZy4gYFtjbGFzcy5uYW1lXT1cImNvbmRpdGlvblwiYCkuXG4gIENsYXNzLFxuICAvLyBBIGJpbmRpbmcgdG8gYSBzdHlsZSBydWxlIChlLmcuIGBbc3R5bGUucnVsZV09XCJleHByZXNzaW9uXCJgKS5cbiAgU3R5bGUsXG4gIC8vIEEgYmluZGluZyB0byBhbiBhbmltYXRpb24gcmVmZXJlbmNlIChlLmcuIGBbYW5pbWF0ZS5rZXldPVwiZXhwcmVzc2lvblwiYCkuXG4gIEFuaW1hdGlvbixcbn1cblxuY29uc3QgQm91bmRQcm9wZXJ0eU1hcHBpbmcgPSB7XG4gIFtCaW5kaW5nVHlwZS5BbmltYXRpb25dOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLkFuaW1hdGlvbixcbiAgW0JpbmRpbmdUeXBlLkF0dHJpYnV0ZV06IFByb3BlcnR5QmluZGluZ1R5cGUuQXR0cmlidXRlLFxuICBbQmluZGluZ1R5cGUuQ2xhc3NdOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLkNsYXNzLFxuICBbQmluZGluZ1R5cGUuUHJvcGVydHldOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLlByb3BlcnR5LFxuICBbQmluZGluZ1R5cGUuU3R5bGVdOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLlN0eWxlLFxufTtcblxuLyoqXG4gKiBBIGJpbmRpbmcgZm9yIGFuIGVsZW1lbnQgcHJvcGVydHkgKGUuZy4gYFtwcm9wZXJ0eV09XCJleHByZXNzaW9uXCJgKSBvciBhbiBhbmltYXRpb24gdHJpZ2dlciAoZS5nLlxuICogYFtAdHJpZ2dlcl09XCJzdGF0ZUV4cFwiYClcbiAqL1xuZXhwb3J0IGNsYXNzIEJvdW5kRWxlbWVudFByb3BlcnR5QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICByZWFkb25seSBpc0FuaW1hdGlvbjogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBQcm9wZXJ0eUJpbmRpbmdUeXBlLFxuICAgICAgcHVibGljIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LCBwdWJsaWMgdmFsdWU6IEFTVFdpdGhTb3VyY2UsXG4gICAgICBwdWJsaWMgdW5pdDogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICB0aGlzLmlzQW5pbWF0aW9uID0gdGhpcy50eXBlID09PSBQcm9wZXJ0eUJpbmRpbmdUeXBlLkFuaW1hdGlvbjtcbiAgfVxuXG4gIHN0YXRpYyBmcm9tQm91bmRQcm9wZXJ0eShwcm9wOiBCb3VuZEVsZW1lbnRQcm9wZXJ0eSkge1xuICAgIGNvbnN0IHR5cGUgPSBCb3VuZFByb3BlcnR5TWFwcGluZ1twcm9wLnR5cGVdO1xuICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHlBc3QoXG4gICAgICAgIHByb3AubmFtZSwgdHlwZSwgcHJvcC5zZWN1cml0eUNvbnRleHQsIHByb3AudmFsdWUsIHByb3AudW5pdCwgcHJvcC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnRQcm9wZXJ0eSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgYmluZGluZyBmb3IgYW4gZWxlbWVudCBldmVudCAoZS5nLiBgKGV2ZW50KT1cImhhbmRsZXIoKVwiYCkgb3IgYW4gYW5pbWF0aW9uIHRyaWdnZXIgZXZlbnQgKGUuZy5cbiAqIGAoQHRyaWdnZXIucGhhc2UpPVwiY2FsbGJhY2soJGV2ZW50KVwiYCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBCb3VuZEV2ZW50QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICByZWFkb25seSBmdWxsTmFtZTogc3RyaW5nO1xuICByZWFkb25seSBpc0FuaW1hdGlvbjogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0YXJnZXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGhhc2U6IHN0cmluZ3xudWxsLFxuICAgICAgcHVibGljIGhhbmRsZXI6IEFTVFdpdGhTb3VyY2UsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuZnVsbE5hbWUgPSBCb3VuZEV2ZW50QXN0LmNhbGNGdWxsTmFtZSh0aGlzLm5hbWUsIHRoaXMudGFyZ2V0LCB0aGlzLnBoYXNlKTtcbiAgICB0aGlzLmlzQW5pbWF0aW9uID0gISF0aGlzLnBoYXNlO1xuICB9XG5cbiAgc3RhdGljIGNhbGNGdWxsTmFtZShuYW1lOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nfG51bGwsIHBoYXNlOiBzdHJpbmd8bnVsbCk6IHN0cmluZyB7XG4gICAgaWYgKHRhcmdldCkge1xuICAgICAgcmV0dXJuIGAke3RhcmdldH06JHtuYW1lfWA7XG4gICAgfVxuICAgIGlmIChwaGFzZSkge1xuICAgICAgcmV0dXJuIGBAJHtuYW1lfS4ke3BoYXNlfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICBzdGF0aWMgZnJvbVBhcnNlZEV2ZW50KGV2ZW50OiBQYXJzZWRFdmVudCkge1xuICAgIGNvbnN0IHRhcmdldDogc3RyaW5nfG51bGwgPSBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuUmVndWxhciA/IGV2ZW50LnRhcmdldE9yUGhhc2UgOiBudWxsO1xuICAgIGNvbnN0IHBoYXNlOiBzdHJpbmd8bnVsbCA9XG4gICAgICAgIGV2ZW50LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICByZXR1cm4gbmV3IEJvdW5kRXZlbnRBc3QoXG4gICAgICAgIGV2ZW50Lm5hbWUsIHRhcmdldCwgcGhhc2UsIGV2ZW50LmhhbmRsZXIsIGV2ZW50LnNvdXJjZVNwYW4sIGV2ZW50LmhhbmRsZXJTcGFuKTtcbiAgfVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEV2ZW50KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbi8qKlxuICogQSByZWZlcmVuY2UgZGVjbGFyYXRpb24gb24gYW4gZWxlbWVudCAoZS5nLiBgbGV0IHNvbWVOYW1lPVwiZXhwcmVzc2lvblwiYCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBDb21waWxlVG9rZW5NZXRhZGF0YSwgcHVibGljIG9yaWdpbmFsVmFsdWU6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlZmVyZW5jZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gb24gYSA8bmctdGVtcGxhdGU+IChlLmcuIGB2YXItc29tZU5hbWU9XCJzb21lTG9jYWxOYW1lXCJgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZhcmlhYmxlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICBzdGF0aWMgZnJvbVBhcnNlZFZhcmlhYmxlKHY6IFBhcnNlZFZhcmlhYmxlKSB7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUFzdCh2Lm5hbWUsIHYudmFsdWUsIHYuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRWYXJpYWJsZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEFuIGVsZW1lbnQgZGVjbGFyYXRpb24gaW4gYSB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEVsZW1lbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGF0dHJzOiBBdHRyQXN0W10sIHB1YmxpYyBpbnB1dHM6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10sXG4gICAgICBwdWJsaWMgb3V0cHV0czogQm91bmRFdmVudEFzdFtdLCBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlQXN0W10sXG4gICAgICBwdWJsaWMgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sIHB1YmxpYyBwcm92aWRlcnM6IFByb3ZpZGVyQXN0W10sXG4gICAgICBwdWJsaWMgaGFzVmlld0NvbnRhaW5lcjogYm9vbGVhbiwgcHVibGljIHF1ZXJ5TWF0Y2hlczogUXVlcnlNYXRjaFtdLFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBUZW1wbGF0ZUFzdFtdLCBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlcnxudWxsLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGA8bmctdGVtcGxhdGU+YCBlbGVtZW50IGluY2x1ZGVkIGluIGFuIEFuZ3VsYXIgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBFbWJlZGRlZFRlbXBsYXRlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBhdHRyczogQXR0ckFzdFtdLCBwdWJsaWMgb3V0cHV0czogQm91bmRFdmVudEFzdFtdLCBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlQXN0W10sXG4gICAgICBwdWJsaWMgdmFyaWFibGVzOiBWYXJpYWJsZUFzdFtdLCBwdWJsaWMgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sXG4gICAgICBwdWJsaWMgcHJvdmlkZXJzOiBQcm92aWRlckFzdFtdLCBwdWJsaWMgaGFzVmlld0NvbnRhaW5lcjogYm9vbGVhbixcbiAgICAgIHB1YmxpYyBxdWVyeU1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSwgcHVibGljIGNoaWxkcmVuOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RW1iZWRkZWRUZW1wbGF0ZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgZGlyZWN0aXZlIHByb3BlcnR5IHdpdGggYSBib3VuZCB2YWx1ZSAoZS5nLiBgKm5nSWY9XCJjb25kaXRpb25cIikuXG4gKi9cbmV4cG9ydCBjbGFzcyBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBkaXJlY3RpdmVOYW1lOiBzdHJpbmcsIHB1YmxpYyB0ZW1wbGF0ZU5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBBU1RXaXRoU291cmNlLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGlyZWN0aXZlUHJvcGVydHkodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGRpcmVjdGl2ZSBkZWNsYXJlZCBvbiBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgY2xhc3MgRGlyZWN0aXZlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBwdWJsaWMgaW5wdXRzOiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0W10sXG4gICAgICBwdWJsaWMgaG9zdFByb3BlcnRpZXM6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10sIHB1YmxpYyBob3N0RXZlbnRzOiBCb3VuZEV2ZW50QXN0W10sXG4gICAgICBwdWJsaWMgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREaXJlY3RpdmUodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHByb3ZpZGVyIGRlY2xhcmVkIG9uIGFuIGVsZW1lbnRcbiAqL1xuZXhwb3J0IGNsYXNzIFByb3ZpZGVyQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEsIHB1YmxpYyBtdWx0aVByb3ZpZGVyOiBib29sZWFuLCBwdWJsaWMgZWFnZXI6IGJvb2xlYW4sXG4gICAgICBwdWJsaWMgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdLCBwdWJsaWMgcHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsXG4gICAgICBwdWJsaWMgbGlmZWN5Y2xlSG9va3M6IExpZmVjeWNsZUhvb2tzW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBpc01vZHVsZTogYm9vbGVhbikge31cblxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gTm8gdmlzaXQgbWV0aG9kIGluIHRoZSB2aXNpdG9yIGZvciBub3cuLi5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBQcm92aWRlckFzdFR5cGUge1xuICBQdWJsaWNTZXJ2aWNlLFxuICBQcml2YXRlU2VydmljZSxcbiAgQ29tcG9uZW50LFxuICBEaXJlY3RpdmUsXG4gIEJ1aWx0aW5cbn1cblxuLyoqXG4gKiBQb3NpdGlvbiB3aGVyZSBjb250ZW50IGlzIHRvIGJlIHByb2plY3RlZCAoaW5zdGFuY2Ugb2YgYDxuZy1jb250ZW50PmAgaW4gYSB0ZW1wbGF0ZSkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ0NvbnRlbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGluZGV4OiBudW1iZXIsIHB1YmxpYyBuZ0NvbnRlbnRJbmRleDogbnVtYmVyLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXROZ0NvbnRlbnQodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBRdWVyeU1hdGNoIHtcbiAgcXVlcnlJZDogbnVtYmVyO1xuICB2YWx1ZTogQ29tcGlsZVRva2VuTWV0YWRhdGE7XG59XG5cbi8qKlxuICogQSB2aXNpdG9yIGZvciB7QGxpbmsgVGVtcGxhdGVBc3R9IHRyZWVzIHRoYXQgd2lsbCBwcm9jZXNzIGVhY2ggbm9kZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZUFzdFZpc2l0b3Ige1xuICAvLyBSZXR1cm5pbmcgYSB0cnV0aHkgdmFsdWUgZnJvbSBgdmlzaXQoKWAgd2lsbCBwcmV2ZW50IGB0ZW1wbGF0ZVZpc2l0QWxsKClgIGZyb20gdGhlIGNhbGwgdG9cbiAgLy8gdGhlIHR5cGVkIG1ldGhvZCBhbmQgcmVzdWx0IHJldHVybmVkIHdpbGwgYmVjb21lIHRoZSByZXN1bHQgaW5jbHVkZWQgaW4gYHZpc2l0QWxsKClgc1xuICAvLyByZXN1bHQgYXJyYXkuXG4gIHZpc2l0Pyhhc3Q6IFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgdmlzaXROZ0NvbnRlbnQoYXN0OiBOZ0NvbnRlbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRFbWJlZGRlZFRlbXBsYXRlKGFzdDogRW1iZWRkZWRUZW1wbGF0ZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEVsZW1lbnQoYXN0OiBFbGVtZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UmVmZXJlbmNlKGFzdDogUmVmZXJlbmNlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0VmFyaWFibGUoYXN0OiBWYXJpYWJsZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEV2ZW50KGFzdDogQm91bmRFdmVudEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEVsZW1lbnRQcm9wZXJ0eShhc3Q6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0QXR0cihhc3Q6IEF0dHJBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRCb3VuZFRleHQoYXN0OiBCb3VuZFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRUZXh0KGFzdDogVGV4dEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdERpcmVjdGl2ZShhc3Q6IERpcmVjdGl2ZUFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdERpcmVjdGl2ZVByb3BlcnR5KGFzdDogQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55O1xufVxuXG4vKipcbiAqIEEgdmlzaXRvciB0aGF0IGFjY2VwdHMgZWFjaCBub2RlIGJ1dCBkb2Vzbid0IGRvIGFueXRoaW5nLiBJdCBpcyBpbnRlbmRlZCB0byBiZSB1c2VkXG4gKiBhcyB0aGUgYmFzZSBjbGFzcyBmb3IgYSB2aXNpdG9yIHRoYXQgaXMgb25seSBpbnRlcmVzdGVkIGluIGEgc3Vic2V0IG9mIHRoZSBub2RlIHR5cGVzLlxuICovXG5leHBvcnQgY2xhc3MgTnVsbFRlbXBsYXRlVmlzaXRvciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciB7XG4gIHZpc2l0TmdDb250ZW50KGFzdDogTmdDb250ZW50QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0RW1iZWRkZWRUZW1wbGF0ZShhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRFbGVtZW50KGFzdDogRWxlbWVudEFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShhc3Q6IFJlZmVyZW5jZUFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKGFzdDogVmFyaWFibGVBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRFdmVudChhc3Q6IEJvdW5kRXZlbnRBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXRFbGVtZW50UHJvcGVydHkoYXN0OiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogdm9pZCB7fVxuICB2aXNpdEF0dHIoYXN0OiBBdHRyQXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dChhc3Q6IFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXREaXJlY3RpdmUoYXN0OiBEaXJlY3RpdmVBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbiAgdmlzaXREaXJlY3RpdmVQcm9wZXJ0eShhc3Q6IEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBCYXNlIGNsYXNzIHRoYXQgY2FuIGJlIHVzZWQgdG8gYnVpbGQgYSB2aXNpdG9yIHRoYXQgdmlzaXRzIGVhY2ggbm9kZVxuICogaW4gYW4gdGVtcGxhdGUgYXN0IHJlY3Vyc2l2ZWx5LlxuICovXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlVGVtcGxhdGVBc3RWaXNpdG9yIGV4dGVuZHMgTnVsbFRlbXBsYXRlVmlzaXRvciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKCkgeyBzdXBlcigpOyB9XG5cbiAgLy8gTm9kZXMgd2l0aCBjaGlsZHJlblxuICB2aXNpdEVtYmVkZGVkVGVtcGxhdGUoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0Q2hpbGRyZW4oY29udGV4dCwgdmlzaXQgPT4ge1xuICAgICAgdmlzaXQoYXN0LmF0dHJzKTtcbiAgICAgIHZpc2l0KGFzdC5yZWZlcmVuY2VzKTtcbiAgICAgIHZpc2l0KGFzdC52YXJpYWJsZXMpO1xuICAgICAgdmlzaXQoYXN0LmRpcmVjdGl2ZXMpO1xuICAgICAgdmlzaXQoYXN0LnByb3ZpZGVycyk7XG4gICAgICB2aXNpdChhc3QuY2hpbGRyZW4pO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGFzdDogRWxlbWVudEFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdENoaWxkcmVuKGNvbnRleHQsIHZpc2l0ID0+IHtcbiAgICAgIHZpc2l0KGFzdC5hdHRycyk7XG4gICAgICB2aXNpdChhc3QuaW5wdXRzKTtcbiAgICAgIHZpc2l0KGFzdC5vdXRwdXRzKTtcbiAgICAgIHZpc2l0KGFzdC5yZWZlcmVuY2VzKTtcbiAgICAgIHZpc2l0KGFzdC5kaXJlY3RpdmVzKTtcbiAgICAgIHZpc2l0KGFzdC5wcm92aWRlcnMpO1xuICAgICAgdmlzaXQoYXN0LmNoaWxkcmVuKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RGlyZWN0aXZlKGFzdDogRGlyZWN0aXZlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0Q2hpbGRyZW4oY29udGV4dCwgdmlzaXQgPT4ge1xuICAgICAgdmlzaXQoYXN0LmlucHV0cyk7XG4gICAgICB2aXNpdChhc3QuaG9zdFByb3BlcnRpZXMpO1xuICAgICAgdmlzaXQoYXN0Lmhvc3RFdmVudHMpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIHZpc2l0Q2hpbGRyZW4oXG4gICAgICBjb250ZXh0OiBhbnksXG4gICAgICBjYjogKHZpc2l0OiAoPFYgZXh0ZW5kcyBUZW1wbGF0ZUFzdD4oY2hpbGRyZW46IFZbXXx1bmRlZmluZWQpID0+IHZvaWQpKSA9PiB2b2lkKSB7XG4gICAgbGV0IHJlc3VsdHM6IGFueVtdW10gPSBbXTtcbiAgICBsZXQgdCA9IHRoaXM7XG4gICAgZnVuY3Rpb24gdmlzaXQ8VCBleHRlbmRzIFRlbXBsYXRlQXN0PihjaGlsZHJlbjogVFtdIHwgdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoKSByZXN1bHRzLnB1c2godGVtcGxhdGVWaXNpdEFsbCh0LCBjaGlsZHJlbiwgY29udGV4dCkpO1xuICAgIH1cbiAgICBjYih2aXNpdCk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sIHJlc3VsdHMpO1xuICB9XG59XG5cbi8qKlxuICogVmlzaXQgZXZlcnkgbm9kZSBpbiBhIGxpc3Qgb2Yge0BsaW5rIFRlbXBsYXRlQXN0fXMgd2l0aCB0aGUgZ2l2ZW4ge0BsaW5rIFRlbXBsYXRlQXN0VmlzaXRvcn0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZVZpc2l0QWxsKFxuICAgIHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgYXN0czogVGVtcGxhdGVBc3RbXSwgY29udGV4dDogYW55ID0gbnVsbCk6IGFueVtdIHtcbiAgY29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuICBjb25zdCB2aXNpdCA9IHZpc2l0b3IudmlzaXQgP1xuICAgICAgKGFzdDogVGVtcGxhdGVBc3QpID0+IHZpc2l0b3IudmlzaXQgIShhc3QsIGNvbnRleHQpIHx8IGFzdC52aXNpdCh2aXNpdG9yLCBjb250ZXh0KSA6XG4gICAgICAoYXN0OiBUZW1wbGF0ZUFzdCkgPT4gYXN0LnZpc2l0KHZpc2l0b3IsIGNvbnRleHQpO1xuICBhc3RzLmZvckVhY2goYXN0ID0+IHtcbiAgICBjb25zdCBhc3RSZXN1bHQgPSB2aXNpdChhc3QpO1xuICAgIGlmIChhc3RSZXN1bHQpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGFzdFJlc3VsdCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IHR5cGUgVGVtcGxhdGVBc3RQYXRoID0gQXN0UGF0aDxUZW1wbGF0ZUFzdD47XG4iXX0=