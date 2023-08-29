/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * This is an R3 `Node`-like wrapper for a raw `html.Comment` node. We do not currently
 * require the implementation of a visitor for Comments as they are only collected at
 * the top-level of the R3 AST, and only if `Render3ParseOptions['collectCommentNodes']`
 * is true.
 */
export class Comment {
    constructor(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(_visitor) {
        throw new Error('visit() not implemented for Comment');
    }
}
export class Text {
    constructor(value, sourceSpan) {
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor) {
        return visitor.visitText(this);
    }
}
export class BoundText {
    constructor(value, sourceSpan, i18n) {
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitBoundText(this);
    }
}
/**
 * Represents a text attribute in the template.
 *
 * `valueSpan` may not be present in cases where there is no value `<div a></div>`.
 * `keySpan` may also not be present for synthetic attributes from ICU expansions.
 */
export class TextAttribute {
    constructor(name, value, sourceSpan, keySpan, valueSpan, i18n) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.keySpan = keySpan;
        this.valueSpan = valueSpan;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitTextAttribute(this);
    }
}
export class BoundAttribute {
    constructor(name, type, securityContext, value, unit, sourceSpan, keySpan, valueSpan, i18n) {
        this.name = name;
        this.type = type;
        this.securityContext = securityContext;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
        this.keySpan = keySpan;
        this.valueSpan = valueSpan;
        this.i18n = i18n;
    }
    static fromBoundElementProperty(prop, i18n) {
        if (prop.keySpan === undefined) {
            throw new Error(`Unexpected state: keySpan must be defined for bound attributes but was not for ${prop.name}: ${prop.sourceSpan}`);
        }
        return new BoundAttribute(prop.name, prop.type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan, prop.keySpan, prop.valueSpan, i18n);
    }
    visit(visitor) {
        return visitor.visitBoundAttribute(this);
    }
}
export class BoundEvent {
    constructor(name, type, handler, target, phase, sourceSpan, handlerSpan, keySpan) {
        this.name = name;
        this.type = type;
        this.handler = handler;
        this.target = target;
        this.phase = phase;
        this.sourceSpan = sourceSpan;
        this.handlerSpan = handlerSpan;
        this.keySpan = keySpan;
    }
    static fromParsedEvent(event) {
        const target = event.type === 0 /* ParsedEventType.Regular */ ? event.targetOrPhase : null;
        const phase = event.type === 1 /* ParsedEventType.Animation */ ? event.targetOrPhase : null;
        if (event.keySpan === undefined) {
            throw new Error(`Unexpected state: keySpan must be defined for bound event but was not for ${event.name}: ${event.sourceSpan}`);
        }
        return new BoundEvent(event.name, event.type, event.handler, target, phase, event.sourceSpan, event.handlerSpan, event.keySpan);
    }
    visit(visitor) {
        return visitor.visitBoundEvent(this);
    }
}
export class Element {
    constructor(name, attributes, inputs, outputs, children, references, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
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
    visit(visitor) {
        return visitor.visitElement(this);
    }
}
export class DeferredTrigger {
    constructor(sourceSpan) {
        this.sourceSpan = sourceSpan;
    }
    visit(visitor) {
        return visitor.visitDeferredTrigger(this);
    }
}
export class BoundDeferredTrigger extends DeferredTrigger {
    constructor(value, sourceSpan) {
        super(sourceSpan);
        this.value = value;
    }
}
export class IdleDeferredTrigger extends DeferredTrigger {
}
export class ImmediateDeferredTrigger extends DeferredTrigger {
}
export class HoverDeferredTrigger extends DeferredTrigger {
}
export class TimerDeferredTrigger extends DeferredTrigger {
    constructor(delay, sourceSpan) {
        super(sourceSpan);
        this.delay = delay;
    }
}
export class InteractionDeferredTrigger extends DeferredTrigger {
    constructor(reference, sourceSpan) {
        super(sourceSpan);
        this.reference = reference;
    }
}
export class ViewportDeferredTrigger extends DeferredTrigger {
    constructor(reference, sourceSpan) {
        super(sourceSpan);
        this.reference = reference;
    }
}
export class DeferredBlockPlaceholder {
    constructor(children, minimumTime, sourceSpan, startSourceSpan, endSourceSpan) {
        this.children = children;
        this.minimumTime = minimumTime;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockPlaceholder(this);
    }
}
export class DeferredBlockLoading {
    constructor(children, afterTime, minimumTime, sourceSpan, startSourceSpan, endSourceSpan) {
        this.children = children;
        this.afterTime = afterTime;
        this.minimumTime = minimumTime;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockLoading(this);
    }
}
export class DeferredBlockError {
    constructor(children, sourceSpan, startSourceSpan, endSourceSpan) {
        this.children = children;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockError(this);
    }
}
export class DeferredBlock {
    constructor(children, triggers, prefetchTriggers, placeholder, loading, error, sourceSpan, startSourceSpan, endSourceSpan) {
        this.children = children;
        this.placeholder = placeholder;
        this.loading = loading;
        this.error = error;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
        this.triggers = triggers;
        this.prefetchTriggers = prefetchTriggers;
        // We cache the keys since we know that they won't change and we
        // don't want to enumarate them every time we're traversing the AST.
        this.definedTriggers = Object.keys(triggers);
        this.definedPrefetchTriggers = Object.keys(prefetchTriggers);
    }
    visit(visitor) {
        return visitor.visitDeferredBlock(this);
    }
    visitAll(visitor) {
        this.visitTriggers(this.definedTriggers, this.triggers, visitor);
        this.visitTriggers(this.definedPrefetchTriggers, this.prefetchTriggers, visitor);
        visitAll(visitor, this.children);
        this.placeholder && visitor.visitDeferredBlockPlaceholder(this.placeholder);
        this.loading && visitor.visitDeferredBlockLoading(this.loading);
        this.error && visitor.visitDeferredBlockError(this.error);
    }
    visitTriggers(keys, triggers, visitor) {
        for (const key of keys) {
            visitor.visitDeferredTrigger(triggers[key]);
        }
    }
}
export class SwitchBlock {
    constructor(expression, cases, sourceSpan, startSourceSpan, endSourceSpan) {
        this.expression = expression;
        this.cases = cases;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    visit(visitor) {
        return visitor.visitSwitchBlock(this);
    }
}
export class SwitchBlockCase {
    constructor(expression, children, sourceSpan, startSourceSpan) {
        this.expression = expression;
        this.children = children;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
    }
    visit(visitor) {
        return visitor.visitSwitchBlockCase(this);
    }
}
export class ForLoopBlock {
    constructor(itemName, expression, trackBy, contextVariables, children, empty, sourceSpan, startSourceSpan, endSourceSpan) {
        this.itemName = itemName;
        this.expression = expression;
        this.trackBy = trackBy;
        this.contextVariables = contextVariables;
        this.children = children;
        this.empty = empty;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    visit(visitor) {
        return visitor.visitForLoopBlock(this);
    }
}
export class ForLoopBlockEmpty {
    constructor(children, sourceSpan, startSourceSpan) {
        this.children = children;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
    }
    visit(visitor) {
        return visitor.visitForLoopBlockEmpty(this);
    }
}
export class IfBlock {
    constructor(branches, sourceSpan, startSourceSpan, endSourceSpan) {
        this.branches = branches;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
    visit(visitor) {
        return visitor.visitIfBlock(this);
    }
}
export class IfBlockBranch {
    constructor(expression, children, expressionAlias, sourceSpan, startSourceSpan) {
        this.expression = expression;
        this.children = children;
        this.expressionAlias = expressionAlias;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
    }
    visit(visitor) {
        return visitor.visitIfBlockBranch(this);
    }
}
export class Template {
    constructor(
    // tagName is the name of the container element, if applicable.
    // `null` is a special case for when there is a structural directive on an `ng-template` so
    // the renderer can differentiate between the synthetic template and the one written in the
    // file.
    tagName, attributes, inputs, outputs, templateAttrs, children, references, variables, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
        this.tagName = tagName;
        this.attributes = attributes;
        this.inputs = inputs;
        this.outputs = outputs;
        this.templateAttrs = templateAttrs;
        this.children = children;
        this.references = references;
        this.variables = variables;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitTemplate(this);
    }
}
export class Content {
    constructor(selector, attributes, sourceSpan, i18n) {
        this.selector = selector;
        this.attributes = attributes;
        this.sourceSpan = sourceSpan;
        this.i18n = i18n;
        this.name = 'ng-content';
    }
    visit(visitor) {
        return visitor.visitContent(this);
    }
}
export class Variable {
    constructor(name, value, sourceSpan, keySpan, valueSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.keySpan = keySpan;
        this.valueSpan = valueSpan;
    }
    visit(visitor) {
        return visitor.visitVariable(this);
    }
}
export class Reference {
    constructor(name, value, sourceSpan, keySpan, valueSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
        this.keySpan = keySpan;
        this.valueSpan = valueSpan;
    }
    visit(visitor) {
        return visitor.visitReference(this);
    }
}
export class Icu {
    constructor(vars, placeholders, sourceSpan, i18n) {
        this.vars = vars;
        this.placeholders = placeholders;
        this.sourceSpan = sourceSpan;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitIcu(this);
    }
}
export class RecursiveVisitor {
    visitElement(element) {
        visitAll(this, element.attributes);
        visitAll(this, element.inputs);
        visitAll(this, element.outputs);
        visitAll(this, element.children);
        visitAll(this, element.references);
    }
    visitTemplate(template) {
        visitAll(this, template.attributes);
        visitAll(this, template.inputs);
        visitAll(this, template.outputs);
        visitAll(this, template.children);
        visitAll(this, template.references);
        visitAll(this, template.variables);
    }
    visitDeferredBlock(deferred) {
        deferred.visitAll(this);
    }
    visitDeferredBlockPlaceholder(block) {
        visitAll(this, block.children);
    }
    visitDeferredBlockError(block) {
        visitAll(this, block.children);
    }
    visitDeferredBlockLoading(block) {
        visitAll(this, block.children);
    }
    visitSwitchBlock(block) {
        visitAll(this, block.cases);
    }
    visitSwitchBlockCase(block) {
        visitAll(this, block.children);
    }
    visitForLoopBlock(block) {
        visitAll(this, block.children);
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        visitAll(this, block.children);
    }
    visitIfBlock(block) {
        visitAll(this, block.branches);
    }
    visitIfBlockBranch(block) {
        visitAll(this, block.children);
    }
    visitContent(content) { }
    visitVariable(variable) { }
    visitReference(reference) { }
    visitTextAttribute(attribute) { }
    visitBoundAttribute(attribute) { }
    visitBoundEvent(attribute) { }
    visitText(text) { }
    visitBoundText(text) { }
    visitIcu(icu) { }
    visitDeferredTrigger(trigger) { }
}
export function visitAll(visitor, nodes) {
    const result = [];
    if (visitor.visit) {
        for (const node of nodes) {
            visitor.visit(node) || node.visit(visitor);
        }
    }
    else {
        for (const node of nodes) {
            const newNode = node.visit(visitor);
            if (newNode) {
                result.push(newNode);
            }
        }
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQVlIOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLE9BQU87SUFDbEIsWUFBbUIsS0FBYSxFQUFTLFVBQTJCO1FBQWpELFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDeEUsS0FBSyxDQUFTLFFBQXlCO1FBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sSUFBSTtJQUNmLFlBQW1CLEtBQWEsRUFBUyxVQUEyQjtRQUFqRCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7SUFBRyxDQUFDO0lBQ3hFLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVM7SUFDcEIsWUFBbUIsS0FBVSxFQUFTLFVBQTJCLEVBQVMsSUFBZTtRQUF0RSxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUM3RixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFDeEIsWUFDVyxJQUFZLEVBQVMsS0FBYSxFQUFTLFVBQTJCLEVBQ3BFLE9BQWtDLEVBQVMsU0FBMkIsRUFDeEUsSUFBZTtRQUZmLFNB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QUMsUUFBa0IsSUFBUyxDQUFDO0lBQzFDLGNBQWMsQ0FBQyxTQUFvQixJQUFTLENBQUM7SUFDN0Msa0JBQWtCLENBQUMsU0FBd0IsSUFBUyxDQUFDO0lBQ3JELG1CQUFtQixDQUFDLFNBQXlCLElBQVMsQ0FBQztJQUN2RCxlQUFlLENBQUMsU0FBcUIsSUFBUyxDQUFDO0lBQy9DLFNBQVMsQ0FBQyxJQUFVLElBQVMsQ0FBQztJQUM5QixjQUFjLENBQUMsSUFBZSxJQUFTLENBQUM7SUFDeEMsUUFBUSxDQUFDLEdBQVEsSUFBUyxDQUFDO0lBQzNCLG9CQUFvQixDQUFDLE9BQXdCLElBQVMsQ0FBQztDQUN4RDtBQUdELE1BQU0sVUFBVSxRQUFRLENBQVMsT0FBd0IsRUFBRSxLQUFhO0lBQ3RFLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUM1QixJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDakIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQzVDO0tBQ0Y7U0FBTTtRQUNMLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDcEMsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUN0QjtTQUNGO0tBQ0Y7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0kxOG5NZXRhfSBmcm9tICcuLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBOb2RlIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdDtcbn1cblxuLyoqXG4gKiBUaGlzIGlzIGFuIFIzIGBOb2RlYC1saWtlIHdyYXBwZXIgZm9yIGEgcmF3IGBodG1sLkNvbW1lbnRgIG5vZGUuIFdlIGRvIG5vdCBjdXJyZW50bHlcbiAqIHJlcXVpcmUgdGhlIGltcGxlbWVudGF0aW9uIG9mIGEgdmlzaXRvciBmb3IgQ29tbWVudHMgYXMgdGhleSBhcmUgb25seSBjb2xsZWN0ZWQgYXRcbiAqIHRoZSB0b3AtbGV2ZWwgb2YgdGhlIFIzIEFTVCwgYW5kIG9ubHkgaWYgYFJlbmRlcjNQYXJzZU9wdGlvbnNbJ2NvbGxlY3RDb21tZW50Tm9kZXMnXWBcbiAqIGlzIHRydWUuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21tZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KF92aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHRocm93IG5ldyBFcnJvcigndmlzaXQoKSBub3QgaW1wbGVtZW50ZWQgZm9yIENvbW1lbnQnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZFRleHQodGhpcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgdGV4dCBhdHRyaWJ1dGUgaW4gdGhlIHRlbXBsYXRlLlxuICpcbiAqIGB2YWx1ZVNwYW5gIG1heSBub3QgYmUgcHJlc2VudCBpbiBjYXNlcyB3aGVyZSB0aGVyZSBpcyBubyB2YWx1ZSBgPGRpdiBhPjwvZGl2PmAuXG4gKiBga2V5U3BhbmAgbWF5IGFsc28gbm90IGJlIHByZXNlbnQgZm9yIHN5bnRoZXRpYyBhdHRyaWJ1dGVzIGZyb20gSUNVIGV4cGFuc2lvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0QXR0cmlidXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dEF0dHJpYnV0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRBdHRyaWJ1dGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdHlwZTogQmluZGluZ1R5cGUsIHB1YmxpYyBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgdW5pdDogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsXG4gICAgICBwdWJsaWMgaTE4bjogSTE4bk1ldGF8dW5kZWZpbmVkKSB7fVxuXG4gIHN0YXRpYyBmcm9tQm91bmRFbGVtZW50UHJvcGVydHkocHJvcDogQm91bmRFbGVtZW50UHJvcGVydHksIGkxOG4/OiBJMThuTWV0YSk6IEJvdW5kQXR0cmlidXRlIHtcbiAgICBpZiAocHJvcC5rZXlTcGFuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5leHBlY3RlZCBzdGF0ZToga2V5U3BhbiBtdXN0IGJlIGRlZmluZWQgZm9yIGJvdW5kIGF0dHJpYnV0ZXMgYnV0IHdhcyBub3QgZm9yICR7XG4gICAgICAgICAgICAgIHByb3AubmFtZX06ICR7cHJvcC5zb3VyY2VTcGFufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJvdW5kQXR0cmlidXRlKFxuICAgICAgICBwcm9wLm5hbWUsIHByb3AudHlwZSwgcHJvcC5zZWN1cml0eUNvbnRleHQsIHByb3AudmFsdWUsIHByb3AudW5pdCwgcHJvcC5zb3VyY2VTcGFuLFxuICAgICAgICBwcm9wLmtleVNwYW4sIHByb3AudmFsdWVTcGFuLCBpMThuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kQXR0cmlidXRlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZEV2ZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IFBhcnNlZEV2ZW50VHlwZSwgcHVibGljIGhhbmRsZXI6IEFTVCxcbiAgICAgIHB1YmxpYyB0YXJnZXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGhhc2U6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHJlYWRvbmx5IGtleVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICBzdGF0aWMgZnJvbVBhcnNlZEV2ZW50KGV2ZW50OiBQYXJzZWRFdmVudCkge1xuICAgIGNvbnN0IHRhcmdldDogc3RyaW5nfG51bGwgPSBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuUmVndWxhciA/IGV2ZW50LnRhcmdldE9yUGhhc2UgOiBudWxsO1xuICAgIGNvbnN0IHBoYXNlOiBzdHJpbmd8bnVsbCA9XG4gICAgICAgIGV2ZW50LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICBpZiAoZXZlbnQua2V5U3BhbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc3RhdGU6IGtleVNwYW4gbXVzdCBiZSBkZWZpbmVkIGZvciBib3VuZCBldmVudCBidXQgd2FzIG5vdCBmb3IgJHtcbiAgICAgICAgICBldmVudC5uYW1lfTogJHtldmVudC5zb3VyY2VTcGFufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJvdW5kRXZlbnQoXG4gICAgICAgIGV2ZW50Lm5hbWUsIGV2ZW50LnR5cGUsIGV2ZW50LmhhbmRsZXIsIHRhcmdldCwgcGhhc2UsIGV2ZW50LnNvdXJjZVNwYW4sIGV2ZW50LmhhbmRsZXJTcGFuLFxuICAgICAgICBldmVudC5rZXlTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kRXZlbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVsZW1lbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLCBwdWJsaWMgaW5wdXRzOiBCb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRbXSwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RWxlbWVudCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGVmZXJyZWRUcmlnZ2VyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZERlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWRsZURlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7fVxuXG5leHBvcnQgY2xhc3MgSW1tZWRpYXRlRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHt9XG5cbmV4cG9ydCBjbGFzcyBIb3ZlckRlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7fVxuXG5leHBvcnQgY2xhc3MgVGltZXJEZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXk6IG51bWJlciwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IocHVibGljIHJlZmVyZW5jZTogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKHNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWaWV3cG9ydERlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWZlcmVuY2U6IHN0cmluZ3xudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBtaW5pbXVtVGltZTogbnVtYmVyfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2tMb2FkaW5nIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBhZnRlclRpbWU6IG51bWJlcnxudWxsLCBwdWJsaWMgbWluaW11bVRpbWU6IG51bWJlcnxudWxsLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZEJsb2NrRXJyb3IgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tFcnJvcih0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlZmVycmVkQmxvY2tUcmlnZ2VycyB7XG4gIHdoZW4/OiBCb3VuZERlZmVycmVkVHJpZ2dlcjtcbiAgaWRsZT86IElkbGVEZWZlcnJlZFRyaWdnZXI7XG4gIGltbWVkaWF0ZT86IEltbWVkaWF0ZURlZmVycmVkVHJpZ2dlcjtcbiAgaG92ZXI/OiBIb3ZlckRlZmVycmVkVHJpZ2dlcjtcbiAgdGltZXI/OiBUaW1lckRlZmVycmVkVHJpZ2dlcjtcbiAgaW50ZXJhY3Rpb24/OiBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcjtcbiAgdmlld3BvcnQ/OiBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2sgaW1wbGVtZW50cyBOb2RlIHtcbiAgcmVhZG9ubHkgdHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHJlYWRvbmx5IHByZWZldGNoVHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHByaXZhdGUgcmVhZG9ubHkgZGVmaW5lZFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICBwcml2YXRlIHJlYWRvbmx5IGRlZmluZWRQcmVmZXRjaFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsXG4gICAgICBwcmVmZXRjaFRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHB1YmxpYyBwbGFjZWhvbGRlcjogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwsXG4gICAgICBwdWJsaWMgbG9hZGluZzogRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCwgcHVibGljIGVycm9yOiBEZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHRoaXMudHJpZ2dlcnMgPSB0cmlnZ2VycztcbiAgICB0aGlzLnByZWZldGNoVHJpZ2dlcnMgPSBwcmVmZXRjaFRyaWdnZXJzO1xuICAgIC8vIFdlIGNhY2hlIHRoZSBrZXlzIHNpbmNlIHdlIGtub3cgdGhhdCB0aGV5IHdvbid0IGNoYW5nZSBhbmQgd2VcbiAgICAvLyBkb24ndCB3YW50IHRvIGVudW1hcmF0ZSB0aGVtIGV2ZXJ5IHRpbWUgd2UncmUgdHJhdmVyc2luZyB0aGUgQVNULlxuICAgIHRoaXMuZGVmaW5lZFRyaWdnZXJzID0gT2JqZWN0LmtleXModHJpZ2dlcnMpIGFzIChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW107XG4gICAgdGhpcy5kZWZpbmVkUHJlZmV0Y2hUcmlnZ2VycyA9IE9iamVjdC5rZXlzKHByZWZldGNoVHJpZ2dlcnMpIGFzIChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW107XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrKHRoaXMpO1xuICB9XG5cbiAgdmlzaXRBbGwodmlzaXRvcjogVmlzaXRvcjx1bmtub3duPik6IHZvaWQge1xuICAgIHRoaXMudmlzaXRUcmlnZ2Vycyh0aGlzLmRlZmluZWRUcmlnZ2VycywgdGhpcy50cmlnZ2VycywgdmlzaXRvcik7XG4gICAgdGhpcy52aXNpdFRyaWdnZXJzKHRoaXMuZGVmaW5lZFByZWZldGNoVHJpZ2dlcnMsIHRoaXMucHJlZmV0Y2hUcmlnZ2VycywgdmlzaXRvcik7XG4gICAgdmlzaXRBbGwodmlzaXRvciwgdGhpcy5jaGlsZHJlbik7XG4gICAgdGhpcy5wbGFjZWhvbGRlciAmJiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKHRoaXMucGxhY2Vob2xkZXIpO1xuICAgIHRoaXMubG9hZGluZyAmJiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcodGhpcy5sb2FkaW5nKTtcbiAgICB0aGlzLmVycm9yICYmIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrRXJyb3IodGhpcy5lcnJvcik7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0VHJpZ2dlcnMoXG4gICAgICBrZXlzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdLCB0cmlnZ2VyczogRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCB2aXNpdG9yOiBWaXNpdG9yKSB7XG4gICAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgICAgdmlzaXRvci52aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2Vyc1trZXldISk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2l0Y2hCbG9jayBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1QsIHB1YmxpYyBjYXNlczogU3dpdGNoQmxvY2tDYXNlW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRTd2l0Y2hCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpdGNoQmxvY2tDYXNlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHJlc3Npb246IEFTVHxudWxsLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRTd2l0Y2hCbG9ja0Nhc2UodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBGb3JMb29wQmxvY2tDb250ZXh0IHtcbiAgJGluZGV4Pzogc3RyaW5nO1xuICAkZmlyc3Q/OiBzdHJpbmc7XG4gICRsYXN0Pzogc3RyaW5nO1xuICAkZXZlbj86IHN0cmluZztcbiAgJG9kZD86IHN0cmluZztcbiAgJGNvdW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRm9yTG9vcEJsb2NrIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGl0ZW1OYW1lOiBzdHJpbmcsIHB1YmxpYyBleHByZXNzaW9uOiBBU1RXaXRoU291cmNlLCBwdWJsaWMgdHJhY2tCeTogQVNUV2l0aFNvdXJjZSxcbiAgICAgIHB1YmxpYyBjb250ZXh0VmFyaWFibGVzOiBGb3JMb29wQmxvY2tDb250ZXh0fG51bGwsIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLFxuICAgICAgcHVibGljIGVtcHR5OiBGb3JMb29wQmxvY2tFbXB0eXxudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Rm9yTG9vcEJsb2NrKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3JMb29wQmxvY2tFbXB0eSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEZvckxvb3BCbG9ja0VtcHR5KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJZkJsb2NrIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGJyYW5jaGVzOiBJZkJsb2NrQnJhbmNoW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJZkJsb2NrKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJZkJsb2NrQnJhbmNoIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHJlc3Npb246IEFTVHxudWxsLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIGV4cHJlc3Npb25BbGlhczogc3RyaW5nfG51bGwsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZCbG9ja0JyYW5jaCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICAvLyB0YWdOYW1lIGlzIHRoZSBuYW1lIG9mIHRoZSBjb250YWluZXIgZWxlbWVudCwgaWYgYXBwbGljYWJsZS5cbiAgICAgIC8vIGBudWxsYCBpcyBhIHNwZWNpYWwgY2FzZSBmb3Igd2hlbiB0aGVyZSBpcyBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIG9uIGFuIGBuZy10ZW1wbGF0ZWAgc29cbiAgICAgIC8vIHRoZSByZW5kZXJlciBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIHRoZSBzeW50aGV0aWMgdGVtcGxhdGUgYW5kIHRoZSBvbmUgd3JpdHRlbiBpbiB0aGVcbiAgICAgIC8vIGZpbGUuXG4gICAgICBwdWJsaWMgdGFnTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIGlucHV0czogQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBvdXRwdXRzOiBCb3VuZEV2ZW50W10sXG4gICAgICBwdWJsaWMgdGVtcGxhdGVBdHRyczogKEJvdW5kQXR0cmlidXRlfFRleHRBdHRyaWJ1dGUpW10sXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSxcbiAgICAgIHB1YmxpYyByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXSxcbiAgICAgIHB1YmxpYyB2YXJpYWJsZXM6IFZhcmlhYmxlW10sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSxcbiAgKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUZW1wbGF0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29udGVudCBpbXBsZW1lbnRzIE5vZGUge1xuICByZWFkb25seSBuYW1lID0gJ25nLWNvbnRlbnQnO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHNlbGVjdG9yOiBzdHJpbmcsIHB1YmxpYyBhdHRyaWJ1dGVzOiBUZXh0QXR0cmlidXRlW10sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb250ZW50KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRWYXJpYWJsZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVmZXJlbmNlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlZmVyZW5jZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWN1IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhcnM6IHtbbmFtZTogc3RyaW5nXTogQm91bmRUZXh0fSxcbiAgICAgIHB1YmxpYyBwbGFjZWhvbGRlcnM6IHtbbmFtZTogc3RyaW5nXTogVGV4dHxCb3VuZFRleHR9LCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWN1KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlzaXRvcjxSZXN1bHQgPSBhbnk+IHtcbiAgLy8gUmV0dXJuaW5nIGEgdHJ1dGh5IHZhbHVlIGZyb20gYHZpc2l0KClgIHdpbGwgcHJldmVudCBgdmlzaXRBbGwoKWAgZnJvbSB0aGUgY2FsbCB0byB0aGUgdHlwZWRcbiAgLy8gbWV0aG9kIGFuZCByZXN1bHQgcmV0dXJuZWQgd2lsbCBiZWNvbWUgdGhlIHJlc3VsdCBpbmNsdWRlZCBpbiBgdmlzaXRBbGwoKWBzIHJlc3VsdCBhcnJheS5cbiAgdmlzaXQ/KG5vZGU6IE5vZGUpOiBSZXN1bHQ7XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiBSZXN1bHQ7XG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogUmVzdWx0O1xuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IFJlc3VsdDtcbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpOiBSZXN1bHQ7XG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKTogUmVzdWx0O1xuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKTogUmVzdWx0O1xuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiBSZXN1bHQ7XG4gIHZpc2l0Qm91bmRFdmVudChhdHRyaWJ1dGU6IEJvdW5kRXZlbnQpOiBSZXN1bHQ7XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogUmVzdWx0O1xuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiBSZXN1bHQ7XG4gIHZpc2l0SWN1KGljdTogSWN1KTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKGJsb2NrOiBEZWZlcnJlZEJsb2NrRXJyb3IpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcoYmxvY2s6IERlZmVycmVkQmxvY2tMb2FkaW5nKTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpOiBSZXN1bHQ7XG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKTogUmVzdWx0O1xuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKTogUmVzdWx0O1xuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKTogUmVzdWx0O1xuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSk6IFJlc3VsdDtcbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKTogUmVzdWx0O1xuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpOiBSZXN1bHQ7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvcjx2b2lkPiB7XG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5hdHRyaWJ1dGVzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmlucHV0cyk7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5vdXRwdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LnJlZmVyZW5jZXMpO1xuICB9XG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUuYXR0cmlidXRlcyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUuaW5wdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5vdXRwdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5jaGlsZHJlbik7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUucmVmZXJlbmNlcyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUudmFyaWFibGVzKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spOiB2b2lkIHtcbiAgICBkZWZlcnJlZC52aXNpdEFsbCh0aGlzKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKGJsb2NrOiBEZWZlcnJlZEJsb2NrRXJyb3IpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jYXNlcyk7XG4gIH1cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5icmFuY2hlcyk7XG4gIH1cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IHZvaWQge31cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IHZvaWQge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IHZvaWQge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IHZvaWQge31cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRBbGw8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4sIG5vZGVzOiBOb2RlW10pOiBSZXN1bHRbXSB7XG4gIGNvbnN0IHJlc3VsdDogUmVzdWx0W10gPSBbXTtcbiAgaWYgKHZpc2l0b3IudmlzaXQpIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIHZpc2l0b3IudmlzaXQobm9kZSkgfHwgbm9kZS52aXNpdCh2aXNpdG9yKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICBjb25zdCBuZXdOb2RlID0gbm9kZS52aXNpdCh2aXNpdG9yKTtcbiAgICAgIGlmIChuZXdOb2RlKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKG5ld05vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIl19