/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ParsedEventType } from '../expression_parser/ast';
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
        const target = event.type === ParsedEventType.Regular ? event.targetOrPhase : null;
        const phase = event.type === ParsedEventType.Animation ? event.targetOrPhase : null;
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
    constructor(nameSpan, sourceSpan, prefetchSpan, whenOrOnSourceSpan) {
        this.nameSpan = nameSpan;
        this.sourceSpan = sourceSpan;
        this.prefetchSpan = prefetchSpan;
        this.whenOrOnSourceSpan = whenOrOnSourceSpan;
    }
    visit(visitor) {
        return visitor.visitDeferredTrigger(this);
    }
}
export class BoundDeferredTrigger extends DeferredTrigger {
    constructor(value, sourceSpan, prefetchSpan, whenSourceSpan) {
        // BoundDeferredTrigger is for 'when' triggers. These aren't really "triggers" and don't have a
        // nameSpan. Trigger names are the built in event triggers like hover, interaction, etc.
        super(/** nameSpan */ null, sourceSpan, prefetchSpan, whenSourceSpan);
        this.value = value;
    }
}
export class IdleDeferredTrigger extends DeferredTrigger {
}
export class ImmediateDeferredTrigger extends DeferredTrigger {
}
export class HoverDeferredTrigger extends DeferredTrigger {
    constructor(reference, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
        super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
        this.reference = reference;
    }
}
export class TimerDeferredTrigger extends DeferredTrigger {
    constructor(delay, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
        super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
        this.delay = delay;
    }
}
export class InteractionDeferredTrigger extends DeferredTrigger {
    constructor(reference, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
        super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
        this.reference = reference;
    }
}
export class ViewportDeferredTrigger extends DeferredTrigger {
    constructor(reference, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
        super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
        this.reference = reference;
    }
}
export class BlockNode {
    constructor(nameSpan, sourceSpan, startSourceSpan, endSourceSpan) {
        this.nameSpan = nameSpan;
        this.sourceSpan = sourceSpan;
        this.startSourceSpan = startSourceSpan;
        this.endSourceSpan = endSourceSpan;
    }
}
export class DeferredBlockPlaceholder extends BlockNode {
    constructor(children, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.minimumTime = minimumTime;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockPlaceholder(this);
    }
}
export class DeferredBlockLoading extends BlockNode {
    constructor(children, afterTime, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.afterTime = afterTime;
        this.minimumTime = minimumTime;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockLoading(this);
    }
}
export class DeferredBlockError extends BlockNode {
    constructor(children, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockError(this);
    }
}
export class DeferredBlock extends BlockNode {
    constructor(children, triggers, prefetchTriggers, placeholder, loading, error, nameSpan, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.placeholder = placeholder;
        this.loading = loading;
        this.error = error;
        this.mainBlockSpan = mainBlockSpan;
        this.i18n = i18n;
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
        const remainingBlocks = [this.placeholder, this.loading, this.error].filter(x => x !== null);
        visitAll(visitor, remainingBlocks);
    }
    visitTriggers(keys, triggers, visitor) {
        visitAll(visitor, keys.map(k => triggers[k]));
    }
}
export class SwitchBlock extends BlockNode {
    constructor(expression, cases, 
    /**
     * These blocks are only captured to allow for autocompletion in the language service. They
     * aren't meant to be processed in any other way.
     */
    unknownBlocks, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.expression = expression;
        this.cases = cases;
        this.unknownBlocks = unknownBlocks;
    }
    visit(visitor) {
        return visitor.visitSwitchBlock(this);
    }
}
export class SwitchBlockCase extends BlockNode {
    constructor(expression, children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.expression = expression;
        this.children = children;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitSwitchBlockCase(this);
    }
}
export class ForLoopBlock extends BlockNode {
    constructor(item, expression, trackBy, trackKeywordSpan, contextVariables, children, empty, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.item = item;
        this.expression = expression;
        this.trackBy = trackBy;
        this.trackKeywordSpan = trackKeywordSpan;
        this.contextVariables = contextVariables;
        this.children = children;
        this.empty = empty;
        this.mainBlockSpan = mainBlockSpan;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitForLoopBlock(this);
    }
}
export class ForLoopBlockEmpty extends BlockNode {
    constructor(children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitForLoopBlockEmpty(this);
    }
}
export class IfBlock extends BlockNode {
    constructor(branches, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.branches = branches;
    }
    visit(visitor) {
        return visitor.visitIfBlock(this);
    }
}
export class IfBlockBranch extends BlockNode {
    constructor(expression, children, expressionAlias, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.expression = expression;
        this.children = children;
        this.expressionAlias = expressionAlias;
        this.i18n = i18n;
    }
    visit(visitor) {
        return visitor.visitIfBlockBranch(this);
    }
}
export class UnknownBlock {
    constructor(name, sourceSpan, nameSpan) {
        this.name = name;
        this.sourceSpan = sourceSpan;
        this.nameSpan = nameSpan;
    }
    visit(visitor) {
        return visitor.visitUnknownBlock(this);
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
        const blockItems = [block.item, ...Object.values(block.contextVariables), ...block.children];
        block.empty && blockItems.push(block.empty);
        visitAll(this, blockItems);
    }
    visitForLoopBlockEmpty(block) {
        visitAll(this, block.children);
    }
    visitIfBlock(block) {
        visitAll(this, block.branches);
    }
    visitIfBlockBranch(block) {
        const blockItems = block.children;
        block.expressionAlias && blockItems.push(block.expressionAlias);
        visitAll(this, blockItems);
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
    visitUnknownBlock(block) { }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBcUUsZUFBZSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFTN0g7Ozs7O0dBS0c7QUFDSCxNQUFNLE9BQU8sT0FBTztJQUNsQixZQUFtQixLQUFhLEVBQVMsVUFBMkI7UUFBakQsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztJQUN4RSxLQUFLLENBQVMsUUFBeUI7UUFDckMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQ3pELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxJQUFJO0lBQ2YsWUFBbUIsS0FBYSxFQUFTLFVBQTJCO1FBQWpELFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDeEUsS0FBSyxDQUFTLE9BQXdCO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sU0FBUztJQUNwQixZQUFtQixLQUFVLEVBQVMsVUFBMkIsRUFBUyxJQUFlO1FBQXRFLFVBQUssR0FBTCxLQUFLLENBQUs7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUFTLFNBQUksR0FBSixJQUFJLENBQVc7SUFBRyxDQUFDO0lBQzdGLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsQ0FBQztDQUNGO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLE9BQU8sYUFBYTtJQUN4QixZQUNXLElBQVksRUFBUyxLQUFhLEVBQVMsVUFB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XG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0kxOG5NZXRhfSBmcm9tICcuLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBOb2RlIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdDtcbn1cblxuLyoqXG4gKiBUaGlzIGlzIGFuIFIzIGBOb2RlYC1saWtlIHdyYXBwZXIgZm9yIGEgcmF3IGBodG1sLkNvbW1lbnRgIG5vZGUuIFdlIGRvIG5vdCBjdXJyZW50bHlcbiAqIHJlcXVpcmUgdGhlIGltcGxlbWVudGF0aW9uIG9mIGEgdmlzaXRvciBmb3IgQ29tbWVudHMgYXMgdGhleSBhcmUgb25seSBjb2xsZWN0ZWQgYXRcbiAqIHRoZSB0b3AtbGV2ZWwgb2YgdGhlIFIzIEFTVCwgYW5kIG9ubHkgaWYgYFJlbmRlcjNQYXJzZU9wdGlvbnNbJ2NvbGxlY3RDb21tZW50Tm9kZXMnXWBcbiAqIGlzIHRydWUuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21tZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KF92aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHRocm93IG5ldyBFcnJvcigndmlzaXQoKSBub3QgaW1wbGVtZW50ZWQgZm9yIENvbW1lbnQnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZFRleHQodGhpcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgdGV4dCBhdHRyaWJ1dGUgaW4gdGhlIHRlbXBsYXRlLlxuICpcbiAqIGB2YWx1ZVNwYW5gIG1heSBub3QgYmUgcHJlc2VudCBpbiBjYXNlcyB3aGVyZSB0aGVyZSBpcyBubyB2YWx1ZSBgPGRpdiBhPjwvZGl2PmAuXG4gKiBga2V5U3BhbmAgbWF5IGFsc28gbm90IGJlIHByZXNlbnQgZm9yIHN5bnRoZXRpYyBhdHRyaWJ1dGVzIGZyb20gSUNVIGV4cGFuc2lvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0QXR0cmlidXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dEF0dHJpYnV0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRBdHRyaWJ1dGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdHlwZTogQmluZGluZ1R5cGUsIHB1YmxpYyBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgdW5pdDogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsXG4gICAgICBwdWJsaWMgaTE4bjogSTE4bk1ldGF8dW5kZWZpbmVkKSB7fVxuXG4gIHN0YXRpYyBmcm9tQm91bmRFbGVtZW50UHJvcGVydHkocHJvcDogQm91bmRFbGVtZW50UHJvcGVydHksIGkxOG4/OiBJMThuTWV0YSk6IEJvdW5kQXR0cmlidXRlIHtcbiAgICBpZiAocHJvcC5rZXlTcGFuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5leHBlY3RlZCBzdGF0ZToga2V5U3BhbiBtdXN0IGJlIGRlZmluZWQgZm9yIGJvdW5kIGF0dHJpYnV0ZXMgYnV0IHdhcyBub3QgZm9yICR7XG4gICAgICAgICAgICAgIHByb3AubmFtZX06ICR7cHJvcC5zb3VyY2VTcGFufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJvdW5kQXR0cmlidXRlKFxuICAgICAgICBwcm9wLm5hbWUsIHByb3AudHlwZSwgcHJvcC5zZWN1cml0eUNvbnRleHQsIHByb3AudmFsdWUsIHByb3AudW5pdCwgcHJvcC5zb3VyY2VTcGFuLFxuICAgICAgICBwcm9wLmtleVNwYW4sIHByb3AudmFsdWVTcGFuLCBpMThuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kQXR0cmlidXRlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZEV2ZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IFBhcnNlZEV2ZW50VHlwZSwgcHVibGljIGhhbmRsZXI6IEFTVCxcbiAgICAgIHB1YmxpYyB0YXJnZXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGhhc2U6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHJlYWRvbmx5IGtleVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICBzdGF0aWMgZnJvbVBhcnNlZEV2ZW50KGV2ZW50OiBQYXJzZWRFdmVudCkge1xuICAgIGNvbnN0IHRhcmdldDogc3RyaW5nfG51bGwgPSBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuUmVndWxhciA/IGV2ZW50LnRhcmdldE9yUGhhc2UgOiBudWxsO1xuICAgIGNvbnN0IHBoYXNlOiBzdHJpbmd8bnVsbCA9XG4gICAgICAgIGV2ZW50LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICBpZiAoZXZlbnQua2V5U3BhbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc3RhdGU6IGtleVNwYW4gbXVzdCBiZSBkZWZpbmVkIGZvciBib3VuZCBldmVudCBidXQgd2FzIG5vdCBmb3IgJHtcbiAgICAgICAgICBldmVudC5uYW1lfTogJHtldmVudC5zb3VyY2VTcGFufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJvdW5kRXZlbnQoXG4gICAgICAgIGV2ZW50Lm5hbWUsIGV2ZW50LnR5cGUsIGV2ZW50LmhhbmRsZXIsIHRhcmdldCwgcGhhc2UsIGV2ZW50LnNvdXJjZVNwYW4sIGV2ZW50LmhhbmRsZXJTcGFuLFxuICAgICAgICBldmVudC5rZXlTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kRXZlbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVsZW1lbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLCBwdWJsaWMgaW5wdXRzOiBCb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRbXSwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RWxlbWVudCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGVmZXJyZWRUcmlnZ2VyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgd2hlbk9yT25Tb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZFRyaWdnZXIodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgd2hlblNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIC8vIEJvdW5kRGVmZXJyZWRUcmlnZ2VyIGlzIGZvciAnd2hlbicgdHJpZ2dlcnMuIFRoZXNlIGFyZW4ndCByZWFsbHkgXCJ0cmlnZ2Vyc1wiIGFuZCBkb24ndCBoYXZlIGFcbiAgICAvLyBuYW1lU3Bhbi4gVHJpZ2dlciBuYW1lcyBhcmUgdGhlIGJ1aWx0IGluIGV2ZW50IHRyaWdnZXJzIGxpa2UgaG92ZXIsIGludGVyYWN0aW9uLCBldGMuXG4gICAgc3VwZXIoLyoqIG5hbWVTcGFuICovIG51bGwsIHNvdXJjZVNwYW4sIHByZWZldGNoU3Bhbiwgd2hlblNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJZGxlRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHt9XG5cbmV4cG9ydCBjbGFzcyBJbW1lZGlhdGVEZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge31cblxuZXhwb3J0IGNsYXNzIEhvdmVyRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVmZXJlbmNlOiBzdHJpbmd8bnVsbCwgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgb25Tb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIG9uU291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVyRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZGVsYXk6IG51bWJlciwgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgb25Tb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIG9uU291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVmZXJlbmNlOiBzdHJpbmd8bnVsbCwgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgb25Tb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIG9uU291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVmZXJlbmNlOiBzdHJpbmd8bnVsbCwgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgb25Tb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIG9uU291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJsb2NrTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgbWluaW11bVRpbWU6IG51bWJlcnxudWxsLCBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7XG4gICAgc3VwZXIobmFtZVNwYW4sIHNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbiwgZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2tMb2FkaW5nIGV4dGVuZHMgQmxvY2tOb2RlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBhZnRlclRpbWU6IG51bWJlcnxudWxsLCBwdWJsaWMgbWluaW11bVRpbWU6IG51bWJlcnxudWxsLFxuICAgICAgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7XG4gICAgc3VwZXIobmFtZVNwYW4sIHNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbiwgZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVmZXJyZWRCbG9ja0Vycm9yIGV4dGVuZHMgQmxvY2tOb2RlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tFcnJvcih0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlZmVycmVkQmxvY2tUcmlnZ2VycyB7XG4gIHdoZW4/OiBCb3VuZERlZmVycmVkVHJpZ2dlcjtcbiAgaWRsZT86IElkbGVEZWZlcnJlZFRyaWdnZXI7XG4gIGltbWVkaWF0ZT86IEltbWVkaWF0ZURlZmVycmVkVHJpZ2dlcjtcbiAgaG92ZXI/OiBIb3ZlckRlZmVycmVkVHJpZ2dlcjtcbiAgdGltZXI/OiBUaW1lckRlZmVycmVkVHJpZ2dlcjtcbiAgaW50ZXJhY3Rpb24/OiBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcjtcbiAgdmlld3BvcnQ/OiBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2sgZXh0ZW5kcyBCbG9ja05vZGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgcmVhZG9ubHkgdHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHJlYWRvbmx5IHByZWZldGNoVHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHByaXZhdGUgcmVhZG9ubHkgZGVmaW5lZFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICBwcml2YXRlIHJlYWRvbmx5IGRlZmluZWRQcmVmZXRjaFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsXG4gICAgICBwcmVmZXRjaFRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHB1YmxpYyBwbGFjZWhvbGRlcjogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwsXG4gICAgICBwdWJsaWMgbG9hZGluZzogRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCwgcHVibGljIGVycm9yOiBEZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCxcbiAgICAgIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIG1haW5CbG9ja1NwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuKTtcbiAgICB0aGlzLnRyaWdnZXJzID0gdHJpZ2dlcnM7XG4gICAgdGhpcy5wcmVmZXRjaFRyaWdnZXJzID0gcHJlZmV0Y2hUcmlnZ2VycztcbiAgICAvLyBXZSBjYWNoZSB0aGUga2V5cyBzaW5jZSB3ZSBrbm93IHRoYXQgdGhleSB3b24ndCBjaGFuZ2UgYW5kIHdlXG4gICAgLy8gZG9uJ3Qgd2FudCB0byBlbnVtYXJhdGUgdGhlbSBldmVyeSB0aW1lIHdlJ3JlIHRyYXZlcnNpbmcgdGhlIEFTVC5cbiAgICB0aGlzLmRlZmluZWRUcmlnZ2VycyA9IE9iamVjdC5rZXlzKHRyaWdnZXJzKSBhcyAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICAgIHRoaXMuZGVmaW5lZFByZWZldGNoVHJpZ2dlcnMgPSBPYmplY3Qua2V5cyhwcmVmZXRjaFRyaWdnZXJzKSBhcyAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9jayh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0QWxsKHZpc2l0b3I6IFZpc2l0b3I8dW5rbm93bj4pOiB2b2lkIHtcbiAgICB0aGlzLnZpc2l0VHJpZ2dlcnModGhpcy5kZWZpbmVkVHJpZ2dlcnMsIHRoaXMudHJpZ2dlcnMsIHZpc2l0b3IpO1xuICAgIHRoaXMudmlzaXRUcmlnZ2Vycyh0aGlzLmRlZmluZWRQcmVmZXRjaFRyaWdnZXJzLCB0aGlzLnByZWZldGNoVHJpZ2dlcnMsIHZpc2l0b3IpO1xuICAgIHZpc2l0QWxsKHZpc2l0b3IsIHRoaXMuY2hpbGRyZW4pO1xuICAgIGNvbnN0IHJlbWFpbmluZ0Jsb2NrcyA9XG4gICAgICAgIFt0aGlzLnBsYWNlaG9sZGVyLCB0aGlzLmxvYWRpbmcsIHRoaXMuZXJyb3JdLmZpbHRlcih4ID0+IHggIT09IG51bGwpIGFzIEFycmF5PE5vZGU+O1xuICAgIHZpc2l0QWxsKHZpc2l0b3IsIHJlbWFpbmluZ0Jsb2Nrcyk7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0VHJpZ2dlcnMoXG4gICAgICBrZXlzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdLCB0cmlnZ2VyczogRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCB2aXNpdG9yOiBWaXNpdG9yKSB7XG4gICAgdmlzaXRBbGwodmlzaXRvciwga2V5cy5tYXAoayA9PiB0cmlnZ2Vyc1trXSEpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpdGNoQmxvY2sgZXh0ZW5kcyBCbG9ja05vZGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZXhwcmVzc2lvbjogQVNULCBwdWJsaWMgY2FzZXM6IFN3aXRjaEJsb2NrQ2FzZVtdLFxuICAgICAgLyoqXG4gICAgICAgKiBUaGVzZSBibG9ja3MgYXJlIG9ubHkgY2FwdHVyZWQgdG8gYWxsb3cgZm9yIGF1dG9jb21wbGV0aW9uIGluIHRoZSBsYW5ndWFnZSBzZXJ2aWNlLiBUaGV5XG4gICAgICAgKiBhcmVuJ3QgbWVhbnQgdG8gYmUgcHJvY2Vzc2VkIGluIGFueSBvdGhlciB3YXkuXG4gICAgICAgKi9cbiAgICAgIHB1YmxpYyB1bmtub3duQmxvY2tzOiBVbmtub3duQmxvY2tbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U3dpdGNoQmxvY2sodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aXRjaEJsb2NrQ2FzZSBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1R8bnVsbCwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFN3aXRjaEJsb2NrQ2FzZSh0aGlzKTtcbiAgfVxufVxuXG4vLyBOb3RlOiB0aGlzIGlzIGEgd2VpcmQgd2F5IHRvIGRlZmluZSB0aGUgcHJvcGVydGllcywgYnV0IHdlIGRvIGl0IHNvIHRoYXQgd2UgY2FuXG4vLyBnZXQgc3Ryb25nIHR5cGluZyB3aGVuIHRoZSBjb250ZXh0IGlzIHBhc3NlZCB0aHJvdWdoIGBPYmplY3QudmFsdWVzYC5cbi8qKiBDb250ZXh0IHZhcmlhYmxlcyB0aGF0IGNhbiBiZSB1c2VkIGluc2lkZSBhIGBGb3JMb29wQmxvY2tgLiAqL1xuZXhwb3J0IHR5cGUgRm9yTG9vcEJsb2NrQ29udGV4dCA9XG4gICAgUmVjb3JkPCckaW5kZXgnfCckZmlyc3QnfCckbGFzdCd8JyRldmVuJ3wnJG9kZCd8JyRjb3VudCcsIFZhcmlhYmxlPjtcblxuZXhwb3J0IGNsYXNzIEZvckxvb3BCbG9jayBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBpdGVtOiBWYXJpYWJsZSwgcHVibGljIGV4cHJlc3Npb246IEFTVFdpdGhTb3VyY2UsIHB1YmxpYyB0cmFja0J5OiBBU1RXaXRoU291cmNlLFxuICAgICAgcHVibGljIHRyYWNrS2V5d29yZFNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGNvbnRleHRWYXJpYWJsZXM6IEZvckxvb3BCbG9ja0NvbnRleHQsXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIGVtcHR5OiBGb3JMb29wQmxvY2tFbXB0eXxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgbWFpbkJsb2NrU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7XG4gICAgc3VwZXIobmFtZVNwYW4sIHNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbiwgZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGb3JMb29wQmxvY2sodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvckxvb3BCbG9ja0VtcHR5IGV4dGVuZHMgQmxvY2tOb2RlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgbmFtZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIElmQmxvY2sgZXh0ZW5kcyBCbG9ja05vZGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYnJhbmNoZXM6IElmQmxvY2tCcmFuY2hbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWZCbG9ja0JyYW5jaCBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1R8bnVsbCwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBleHByZXNzaW9uQWxpYXM6IFZhcmlhYmxlfG51bGwsXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdElmQmxvY2tCcmFuY2godGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFVua25vd25CbG9jayBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFVua25vd25CbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICAvLyB0YWdOYW1lIGlzIHRoZSBuYW1lIG9mIHRoZSBjb250YWluZXIgZWxlbWVudCwgaWYgYXBwbGljYWJsZS5cbiAgICAgIC8vIGBudWxsYCBpcyBhIHNwZWNpYWwgY2FzZSBmb3Igd2hlbiB0aGVyZSBpcyBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIG9uIGFuIGBuZy10ZW1wbGF0ZWAgc29cbiAgICAgIC8vIHRoZSByZW5kZXJlciBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIHRoZSBzeW50aGV0aWMgdGVtcGxhdGUgYW5kIHRoZSBvbmUgd3JpdHRlbiBpbiB0aGVcbiAgICAgIC8vIGZpbGUuXG4gICAgICBwdWJsaWMgdGFnTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIGlucHV0czogQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBvdXRwdXRzOiBCb3VuZEV2ZW50W10sXG4gICAgICBwdWJsaWMgdGVtcGxhdGVBdHRyczogKEJvdW5kQXR0cmlidXRlfFRleHRBdHRyaWJ1dGUpW10sXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSxcbiAgICAgIHB1YmxpYyByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXSxcbiAgICAgIHB1YmxpYyB2YXJpYWJsZXM6IFZhcmlhYmxlW10sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSxcbiAgKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRUZW1wbGF0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29udGVudCBpbXBsZW1lbnRzIE5vZGUge1xuICByZWFkb25seSBuYW1lID0gJ25nLWNvbnRlbnQnO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHNlbGVjdG9yOiBzdHJpbmcsIHB1YmxpYyBhdHRyaWJ1dGVzOiBUZXh0QXR0cmlidXRlW10sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRDb250ZW50KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRWYXJpYWJsZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVmZXJlbmNlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFJlZmVyZW5jZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWN1IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhcnM6IHtbbmFtZTogc3RyaW5nXTogQm91bmRUZXh0fSxcbiAgICAgIHB1YmxpYyBwbGFjZWhvbGRlcnM6IHtbbmFtZTogc3RyaW5nXTogVGV4dHxCb3VuZFRleHR9LCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWN1KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlzaXRvcjxSZXN1bHQgPSBhbnk+IHtcbiAgLy8gUmV0dXJuaW5nIGEgdHJ1dGh5IHZhbHVlIGZyb20gYHZpc2l0KClgIHdpbGwgcHJldmVudCBgdmlzaXRBbGwoKWAgZnJvbSB0aGUgY2FsbCB0byB0aGUgdHlwZWRcbiAgLy8gbWV0aG9kIGFuZCByZXN1bHQgcmV0dXJuZWQgd2lsbCBiZWNvbWUgdGhlIHJlc3VsdCBpbmNsdWRlZCBpbiBgdmlzaXRBbGwoKWBzIHJlc3VsdCBhcnJheS5cbiAgdmlzaXQ/KG5vZGU6IE5vZGUpOiBSZXN1bHQ7XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiBSZXN1bHQ7XG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogUmVzdWx0O1xuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IFJlc3VsdDtcbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpOiBSZXN1bHQ7XG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKTogUmVzdWx0O1xuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKTogUmVzdWx0O1xuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiBSZXN1bHQ7XG4gIHZpc2l0Qm91bmRFdmVudChhdHRyaWJ1dGU6IEJvdW5kRXZlbnQpOiBSZXN1bHQ7XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogUmVzdWx0O1xuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiBSZXN1bHQ7XG4gIHZpc2l0SWN1KGljdTogSWN1KTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKGJsb2NrOiBEZWZlcnJlZEJsb2NrRXJyb3IpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcoYmxvY2s6IERlZmVycmVkQmxvY2tMb2FkaW5nKTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpOiBSZXN1bHQ7XG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKTogUmVzdWx0O1xuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKTogUmVzdWx0O1xuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKTogUmVzdWx0O1xuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSk6IFJlc3VsdDtcbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKTogUmVzdWx0O1xuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpOiBSZXN1bHQ7XG4gIHZpc2l0VW5rbm93bkJsb2NrKGJsb2NrOiBVbmtub3duQmxvY2spOiBSZXN1bHQ7XG59XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvcjx2b2lkPiB7XG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5hdHRyaWJ1dGVzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmlucHV0cyk7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5vdXRwdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LnJlZmVyZW5jZXMpO1xuICB9XG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUuYXR0cmlidXRlcyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUuaW5wdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5vdXRwdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5jaGlsZHJlbik7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUucmVmZXJlbmNlcyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUudmFyaWFibGVzKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spOiB2b2lkIHtcbiAgICBkZWZlcnJlZC52aXNpdEFsbCh0aGlzKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKGJsb2NrOiBEZWZlcnJlZEJsb2NrRXJyb3IpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jYXNlcyk7XG4gIH1cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gICAgY29uc3QgYmxvY2tJdGVtcyA9IFtibG9jay5pdGVtLCAuLi5PYmplY3QudmFsdWVzKGJsb2NrLmNvbnRleHRWYXJpYWJsZXMpLCAuLi5ibG9jay5jaGlsZHJlbl07XG4gICAgYmxvY2suZW1wdHkgJiYgYmxvY2tJdGVtcy5wdXNoKGJsb2NrLmVtcHR5KTtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9ja0l0ZW1zKTtcbiAgfVxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5icmFuY2hlcyk7XG4gIH1cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKTogdm9pZCB7XG4gICAgY29uc3QgYmxvY2tJdGVtcyA9IGJsb2NrLmNoaWxkcmVuO1xuICAgIGJsb2NrLmV4cHJlc3Npb25BbGlhcyAmJiBibG9ja0l0ZW1zLnB1c2goYmxvY2suZXhwcmVzc2lvbkFsaWFzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9ja0l0ZW1zKTtcbiAgfVxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IHZvaWQge31cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpOiB2b2lkIHt9XG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKTogdm9pZCB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRFdmVudChhdHRyaWJ1dGU6IEJvdW5kRXZlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpOiB2b2lkIHt9XG4gIHZpc2l0VW5rbm93bkJsb2NrKGJsb2NrOiBVbmtub3duQmxvY2spOiB2b2lkIHt9XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0QWxsPFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+LCBub2RlczogTm9kZVtdKTogUmVzdWx0W10ge1xuICBjb25zdCByZXN1bHQ6IFJlc3VsdFtdID0gW107XG4gIGlmICh2aXNpdG9yLnZpc2l0KSB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICB2aXNpdG9yLnZpc2l0KG5vZGUpIHx8IG5vZGUudmlzaXQodmlzaXRvcik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuICAgICAgY29uc3QgbmV3Tm9kZSA9IG5vZGUudmlzaXQodmlzaXRvcik7XG4gICAgICBpZiAobmV3Tm9kZSkge1xuICAgICAgICByZXN1bHQucHVzaChuZXdOb2RlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==