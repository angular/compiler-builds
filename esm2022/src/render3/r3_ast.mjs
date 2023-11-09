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
    constructor(children, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.minimumTime = minimumTime;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockPlaceholder(this);
    }
}
export class DeferredBlockLoading extends BlockNode {
    constructor(children, afterTime, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.afterTime = afterTime;
        this.minimumTime = minimumTime;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockLoading(this);
    }
}
export class DeferredBlockError extends BlockNode {
    constructor(children, nameSpan, sourceSpan, startSourceSpan, endSourceSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
    }
    visit(visitor) {
        return visitor.visitDeferredBlockError(this);
    }
}
export class DeferredBlock extends BlockNode {
    constructor(children, triggers, prefetchTriggers, placeholder, loading, error, nameSpan, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
        this.placeholder = placeholder;
        this.loading = loading;
        this.error = error;
        this.mainBlockSpan = mainBlockSpan;
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
    constructor(expression, children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.expression = expression;
        this.children = children;
    }
    visit(visitor) {
        return visitor.visitSwitchBlockCase(this);
    }
}
export class ForLoopBlock extends BlockNode {
    constructor(item, expression, trackBy, trackKeywordSpan, contextVariables, children, empty, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, nameSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.item = item;
        this.expression = expression;
        this.trackBy = trackBy;
        this.trackKeywordSpan = trackKeywordSpan;
        this.contextVariables = contextVariables;
        this.children = children;
        this.empty = empty;
        this.mainBlockSpan = mainBlockSpan;
    }
    visit(visitor) {
        return visitor.visitForLoopBlock(this);
    }
}
export class ForLoopBlockEmpty extends BlockNode {
    constructor(children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.children = children;
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
    constructor(expression, children, expressionAlias, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
        super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
        this.expression = expression;
        this.children = children;
        this.expressionAlias = expressionAlias;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQVlIOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLE9BQU87SUFDbEIsWUFBbUIsS0FBYSxFQUFTLFVBQTJCO1FBQWpELFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDeEUsS0FBSyxDQUFTLFFBQXlCO1FBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sSUFBSTtJQUNmLFlBQW1CLEtBQWEsRUFBUyxVQUEyQjtRQUFqRCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7SUFBRyxDQUFDO0lBQ3hFLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVM7SUFDcEIsWUFBbUIsS0FBVSxFQUFTLFVBQTJCLEVBQVMsSUFBZTtRQUF0RSxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUM3RixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFDeEIsWUFDVyxJQUFZLEVBQVMsS0FBYSxFQUFTLFVBQTJCLEVBQ3BFLE9BQWtDLEVBQVMsU0FBMkIsRUFDeEUsSUFBZTtRQUZmLFNB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dkQsaUJBQWlCLENBQUMsS0FBbUIsSUFBUyxDQUFDO0NBQ2hEO0FBR0QsTUFBTSxVQUFVLFFBQVEsQ0FBUyxPQUF3QixFQUFFLEtBQWE7SUFDdEUsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2xCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7WUFDekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzdDLENBQUM7SUFDSCxDQUFDO1NBQU0sQ0FBQztRQUNOLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7WUFDekIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNwQyxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNaLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdkIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgQmluZGluZ1R5cGUsIEJvdW5kRWxlbWVudFByb3BlcnR5LCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtJMThuTWV0YX0gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQ7XG59XG5cbi8qKlxuICogVGhpcyBpcyBhbiBSMyBgTm9kZWAtbGlrZSB3cmFwcGVyIGZvciBhIHJhdyBgaHRtbC5Db21tZW50YCBub2RlLiBXZSBkbyBub3QgY3VycmVudGx5XG4gKiByZXF1aXJlIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiBhIHZpc2l0b3IgZm9yIENvbW1lbnRzIGFzIHRoZXkgYXJlIG9ubHkgY29sbGVjdGVkIGF0XG4gKiB0aGUgdG9wLWxldmVsIG9mIHRoZSBSMyBBU1QsIGFuZCBvbmx5IGlmIGBSZW5kZXIzUGFyc2VPcHRpb25zWydjb2xsZWN0Q29tbWVudE5vZGVzJ11gXG4gKiBpcyB0cnVlLlxuICovXG5leHBvcnQgY2xhc3MgQ29tbWVudCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0PihfdmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Zpc2l0KCkgbm90IGltcGxlbWVudGVkIGZvciBDb21tZW50Jyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRleHQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRleHQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Qm91bmRUZXh0KHRoaXMpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHRleHQgYXR0cmlidXRlIGluIHRoZSB0ZW1wbGF0ZS5cbiAqXG4gKiBgdmFsdWVTcGFuYCBtYXkgbm90IGJlIHByZXNlbnQgaW4gY2FzZXMgd2hlcmUgdGhlcmUgaXMgbm8gdmFsdWUgYDxkaXYgYT48L2Rpdj5gLlxuICogYGtleVNwYW5gIG1heSBhbHNvIG5vdCBiZSBwcmVzZW50IGZvciBzeW50aGV0aWMgYXR0cmlidXRlcyBmcm9tIElDVSBleHBhbnNpb25zLlxuICovXG5leHBvcnQgY2xhc3MgVGV4dEF0dHJpYnV0ZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRleHRBdHRyaWJ1dGUodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kQXR0cmlidXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IEJpbmRpbmdUeXBlLCBwdWJsaWMgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgICBwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIHVuaXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLFxuICAgICAgcHVibGljIGkxOG46IEkxOG5NZXRhfHVuZGVmaW5lZCkge31cblxuICBzdGF0aWMgZnJvbUJvdW5kRWxlbWVudFByb3BlcnR5KHByb3A6IEJvdW5kRWxlbWVudFByb3BlcnR5LCBpMThuPzogSTE4bk1ldGEpOiBCb3VuZEF0dHJpYnV0ZSB7XG4gICAgaWYgKHByb3Aua2V5U3BhbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFVuZXhwZWN0ZWQgc3RhdGU6IGtleVNwYW4gbXVzdCBiZSBkZWZpbmVkIGZvciBib3VuZCBhdHRyaWJ1dGVzIGJ1dCB3YXMgbm90IGZvciAke1xuICAgICAgICAgICAgICBwcm9wLm5hbWV9OiAke3Byb3Auc291cmNlU3Bhbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBCb3VuZEF0dHJpYnV0ZShcbiAgICAgICAgcHJvcC5uYW1lLCBwcm9wLnR5cGUsIHByb3Auc2VjdXJpdHlDb250ZXh0LCBwcm9wLnZhbHVlLCBwcm9wLnVuaXQsIHByb3Auc291cmNlU3BhbixcbiAgICAgICAgcHJvcC5rZXlTcGFuLCBwcm9wLnZhbHVlU3BhbiwgaTE4bik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZEF0dHJpYnV0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRFdmVudCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBQYXJzZWRFdmVudFR5cGUsIHB1YmxpYyBoYW5kbGVyOiBBU1QsXG4gICAgICBwdWJsaWMgdGFyZ2V0OiBzdHJpbmd8bnVsbCwgcHVibGljIHBoYXNlOiBzdHJpbmd8bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuLCByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgc3RhdGljIGZyb21QYXJzZWRFdmVudChldmVudDogUGFyc2VkRXZlbnQpIHtcbiAgICBjb25zdCB0YXJnZXQ6IHN0cmluZ3xudWxsID0gZXZlbnQudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLlJlZ3VsYXIgPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICBjb25zdCBwaGFzZTogc3RyaW5nfG51bGwgPVxuICAgICAgICBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gZXZlbnQudGFyZ2V0T3JQaGFzZSA6IG51bGw7XG4gICAgaWYgKGV2ZW50LmtleVNwYW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHN0YXRlOiBrZXlTcGFuIG11c3QgYmUgZGVmaW5lZCBmb3IgYm91bmQgZXZlbnQgYnV0IHdhcyBub3QgZm9yICR7XG4gICAgICAgICAgZXZlbnQubmFtZX06ICR7ZXZlbnQuc291cmNlU3Bhbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBCb3VuZEV2ZW50KFxuICAgICAgICBldmVudC5uYW1lLCBldmVudC50eXBlLCBldmVudC5oYW5kbGVyLCB0YXJnZXQsIHBoYXNlLCBldmVudC5zb3VyY2VTcGFuLCBldmVudC5oYW5kbGVyU3BhbixcbiAgICAgICAgZXZlbnQua2V5U3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZEV2ZW50KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbGVtZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGF0dHJpYnV0ZXM6IFRleHRBdHRyaWJ1dGVbXSwgcHVibGljIGlucHV0czogQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBvdXRwdXRzOiBCb3VuZEV2ZW50W10sIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlW10sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIERlZmVycmVkVHJpZ2dlciBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIHdoZW5Pck9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZERlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIHdoZW5Tb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICAvLyBCb3VuZERlZmVycmVkVHJpZ2dlciBpcyBmb3IgJ3doZW4nIHRyaWdnZXJzLiBUaGVzZSBhcmVuJ3QgcmVhbGx5IFwidHJpZ2dlcnNcIiBhbmQgZG9uJ3QgaGF2ZSBhXG4gICAgLy8gbmFtZVNwYW4uIFRyaWdnZXIgbmFtZXMgYXJlIHRoZSBidWlsdCBpbiBldmVudCB0cmlnZ2VycyBsaWtlIGhvdmVyLCBpbnRlcmFjdGlvbiwgZXRjLlxuICAgIHN1cGVyKC8qKiBuYW1lU3BhbiAqLyBudWxsLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIHdoZW5Tb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWRsZURlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7fVxuXG5leHBvcnQgY2xhc3MgSW1tZWRpYXRlRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHt9XG5cbmV4cG9ydCBjbGFzcyBIb3ZlckRlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlZmVyZW5jZTogc3RyaW5nfG51bGwsIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHByZWZldGNoU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUaW1lckRlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGRlbGF5OiBudW1iZXIsIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHByZWZldGNoU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlZmVyZW5jZTogc3RyaW5nfG51bGwsIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHByZWZldGNoU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWaWV3cG9ydERlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlZmVyZW5jZTogc3RyaW5nfG51bGwsIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHByZWZldGNoU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCbG9ja05vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIgZXh0ZW5kcyBCbG9ja05vZGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIG1pbmltdW1UaW1lOiBudW1iZXJ8bnVsbCwgbmFtZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZEJsb2NrTG9hZGluZyBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgYWZ0ZXJUaW1lOiBudW1iZXJ8bnVsbCwgcHVibGljIG1pbmltdW1UaW1lOiBudW1iZXJ8bnVsbCxcbiAgICAgIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2tFcnJvciBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tFcnJvcih0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlZmVycmVkQmxvY2tUcmlnZ2VycyB7XG4gIHdoZW4/OiBCb3VuZERlZmVycmVkVHJpZ2dlcjtcbiAgaWRsZT86IElkbGVEZWZlcnJlZFRyaWdnZXI7XG4gIGltbWVkaWF0ZT86IEltbWVkaWF0ZURlZmVycmVkVHJpZ2dlcjtcbiAgaG92ZXI/OiBIb3ZlckRlZmVycmVkVHJpZ2dlcjtcbiAgdGltZXI/OiBUaW1lckRlZmVycmVkVHJpZ2dlcjtcbiAgaW50ZXJhY3Rpb24/OiBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcjtcbiAgdmlld3BvcnQ/OiBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2sgZXh0ZW5kcyBCbG9ja05vZGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgcmVhZG9ubHkgdHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHJlYWRvbmx5IHByZWZldGNoVHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHByaXZhdGUgcmVhZG9ubHkgZGVmaW5lZFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICBwcml2YXRlIHJlYWRvbmx5IGRlZmluZWRQcmVmZXRjaFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsXG4gICAgICBwcmVmZXRjaFRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHB1YmxpYyBwbGFjZWhvbGRlcjogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwsXG4gICAgICBwdWJsaWMgbG9hZGluZzogRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCwgcHVibGljIGVycm9yOiBEZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCxcbiAgICAgIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIG1haW5CbG9ja1NwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICAgIHRoaXMudHJpZ2dlcnMgPSB0cmlnZ2VycztcbiAgICB0aGlzLnByZWZldGNoVHJpZ2dlcnMgPSBwcmVmZXRjaFRyaWdnZXJzO1xuICAgIC8vIFdlIGNhY2hlIHRoZSBrZXlzIHNpbmNlIHdlIGtub3cgdGhhdCB0aGV5IHdvbid0IGNoYW5nZSBhbmQgd2VcbiAgICAvLyBkb24ndCB3YW50IHRvIGVudW1hcmF0ZSB0aGVtIGV2ZXJ5IHRpbWUgd2UncmUgdHJhdmVyc2luZyB0aGUgQVNULlxuICAgIHRoaXMuZGVmaW5lZFRyaWdnZXJzID0gT2JqZWN0LmtleXModHJpZ2dlcnMpIGFzIChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW107XG4gICAgdGhpcy5kZWZpbmVkUHJlZmV0Y2hUcmlnZ2VycyA9IE9iamVjdC5rZXlzKHByZWZldGNoVHJpZ2dlcnMpIGFzIChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW107XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrKHRoaXMpO1xuICB9XG5cbiAgdmlzaXRBbGwodmlzaXRvcjogVmlzaXRvcjx1bmtub3duPik6IHZvaWQge1xuICAgIHRoaXMudmlzaXRUcmlnZ2Vycyh0aGlzLmRlZmluZWRUcmlnZ2VycywgdGhpcy50cmlnZ2VycywgdmlzaXRvcik7XG4gICAgdGhpcy52aXNpdFRyaWdnZXJzKHRoaXMuZGVmaW5lZFByZWZldGNoVHJpZ2dlcnMsIHRoaXMucHJlZmV0Y2hUcmlnZ2VycywgdmlzaXRvcik7XG4gICAgdmlzaXRBbGwodmlzaXRvciwgdGhpcy5jaGlsZHJlbik7XG4gICAgY29uc3QgcmVtYWluaW5nQmxvY2tzID1cbiAgICAgICAgW3RoaXMucGxhY2Vob2xkZXIsIHRoaXMubG9hZGluZywgdGhpcy5lcnJvcl0uZmlsdGVyKHggPT4geCAhPT0gbnVsbCkgYXMgQXJyYXk8Tm9kZT47XG4gICAgdmlzaXRBbGwodmlzaXRvciwgcmVtYWluaW5nQmxvY2tzKTtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRUcmlnZ2VycyhcbiAgICAgIGtleXM6IChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW10sIHRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHZpc2l0b3I6IFZpc2l0b3IpIHtcbiAgICB2aXNpdEFsbCh2aXNpdG9yLCBrZXlzLm1hcChrID0+IHRyaWdnZXJzW2tdISkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2l0Y2hCbG9jayBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1QsIHB1YmxpYyBjYXNlczogU3dpdGNoQmxvY2tDYXNlW10sXG4gICAgICAvKipcbiAgICAgICAqIFRoZXNlIGJsb2NrcyBhcmUgb25seSBjYXB0dXJlZCB0byBhbGxvdyBmb3IgYXV0b2NvbXBsZXRpb24gaW4gdGhlIGxhbmd1YWdlIHNlcnZpY2UuIFRoZXlcbiAgICAgICAqIGFyZW4ndCBtZWFudCB0byBiZSBwcm9jZXNzZWQgaW4gYW55IG90aGVyIHdheS5cbiAgICAgICAqL1xuICAgICAgcHVibGljIHVua25vd25CbG9ja3M6IFVua25vd25CbG9ja1tdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIobmFtZVNwYW4sIHNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbiwgZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRTd2l0Y2hCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpdGNoQmxvY2tDYXNlIGV4dGVuZHMgQmxvY2tOb2RlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHJlc3Npb246IEFTVHxudWxsLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICAgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U3dpdGNoQmxvY2tDYXNlKHRoaXMpO1xuICB9XG59XG5cbi8vIE5vdGU6IHRoaXMgaXMgYSB3ZWlyZCB3YXkgdG8gZGVmaW5lIHRoZSBwcm9wZXJ0aWVzLCBidXQgd2UgZG8gaXQgc28gdGhhdCB3ZSBjYW5cbi8vIGdldCBzdHJvbmcgdHlwaW5nIHdoZW4gdGhlIGNvbnRleHQgaXMgcGFzc2VkIHRocm91Z2ggYE9iamVjdC52YWx1ZXNgLlxuLyoqIENvbnRleHQgdmFyaWFibGVzIHRoYXQgY2FuIGJlIHVzZWQgaW5zaWRlIGEgYEZvckxvb3BCbG9ja2AuICovXG5leHBvcnQgdHlwZSBGb3JMb29wQmxvY2tDb250ZXh0ID1cbiAgICBSZWNvcmQ8JyRpbmRleCd8JyRmaXJzdCd8JyRsYXN0J3wnJGV2ZW4nfCckb2RkJ3wnJGNvdW50JywgVmFyaWFibGU+O1xuXG5leHBvcnQgY2xhc3MgRm9yTG9vcEJsb2NrIGV4dGVuZHMgQmxvY2tOb2RlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGl0ZW06IFZhcmlhYmxlLCBwdWJsaWMgZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZSwgcHVibGljIHRyYWNrQnk6IEFTVFdpdGhTb3VyY2UsXG4gICAgICBwdWJsaWMgdHJhY2tLZXl3b3JkU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgY29udGV4dFZhcmlhYmxlczogRm9yTG9vcEJsb2NrQ29udGV4dCxcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgZW1wdHk6IEZvckxvb3BCbG9ja0VtcHR5fG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBtYWluQmxvY2tTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihuYW1lU3Bhbiwgc291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuLCBlbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEZvckxvb3BCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRm9yTG9vcEJsb2NrRW1wdHkgZXh0ZW5kcyBCbG9ja05vZGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIobmFtZVNwYW4sIHNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbiwgZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGb3JMb29wQmxvY2tFbXB0eSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWZCbG9jayBleHRlbmRzIEJsb2NrTm9kZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBicmFuY2hlczogSWZCbG9ja0JyYW5jaFtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIobmFtZVNwYW4sIHNvdXJjZVNwYW4sIHN0YXJ0U291cmNlU3BhbiwgZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJZkJsb2NrKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJZkJsb2NrQnJhbmNoIGV4dGVuZHMgQmxvY2tOb2RlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHJlc3Npb246IEFTVHxudWxsLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIGV4cHJlc3Npb25BbGlhczogVmFyaWFibGV8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbiwgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgbmFtZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBzdGFydFNvdXJjZVNwYW4sIGVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZCbG9ja0JyYW5jaCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVW5rbm93bkJsb2NrIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VW5rbm93bkJsb2NrKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIC8vIHRhZ05hbWUgaXMgdGhlIG5hbWUgb2YgdGhlIGNvbnRhaW5lciBlbGVtZW50LCBpZiBhcHBsaWNhYmxlLlxuICAgICAgLy8gYG51bGxgIGlzIGEgc3BlY2lhbCBjYXNlIGZvciB3aGVuIHRoZXJlIGlzIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgb24gYW4gYG5nLXRlbXBsYXRlYCBzb1xuICAgICAgLy8gdGhlIHJlbmRlcmVyIGNhbiBkaWZmZXJlbnRpYXRlIGJldHdlZW4gdGhlIHN5bnRoZXRpYyB0ZW1wbGF0ZSBhbmQgdGhlIG9uZSB3cml0dGVuIGluIHRoZVxuICAgICAgLy8gZmlsZS5cbiAgICAgIHB1YmxpYyB0YWdOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBUZXh0QXR0cmlidXRlW10sXG4gICAgICBwdWJsaWMgaW5wdXRzOiBCb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRbXSxcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUF0dHJzOiAoQm91bmRBdHRyaWJ1dGV8VGV4dEF0dHJpYnV0ZSlbXSxcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLFxuICAgICAgcHVibGljIHJlZmVyZW5jZXM6IFJlZmVyZW5jZVtdLFxuICAgICAgcHVibGljIHZhcmlhYmxlczogVmFyaWFibGVbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBwdWJsaWMgaTE4bj86IEkxOG5NZXRhLFxuICApIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRlbXBsYXRlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb250ZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIHJlYWRvbmx5IG5hbWUgPSAnbmctY29udGVudCc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc2VsZWN0b3I6IHN0cmluZywgcHVibGljIGF0dHJpYnV0ZXM6IFRleHRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbnRlbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhcmlhYmxlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFZhcmlhYmxlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2UgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHJlYWRvbmx5IGtleVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVmZXJlbmNlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJY3UgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFyczoge1tuYW1lOiBzdHJpbmddOiBCb3VuZFRleHR9LFxuICAgICAgcHVibGljIHBsYWNlaG9sZGVyczoge1tuYW1lOiBzdHJpbmddOiBUZXh0fEJvdW5kVGV4dH0sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJY3UodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBWaXNpdG9yPFJlc3VsdCA9IGFueT4ge1xuICAvLyBSZXR1cm5pbmcgYSB0cnV0aHkgdmFsdWUgZnJvbSBgdmlzaXQoKWAgd2lsbCBwcmV2ZW50IGB2aXNpdEFsbCgpYCBmcm9tIHRoZSBjYWxsIHRvIHRoZSB0eXBlZFxuICAvLyBtZXRob2QgYW5kIHJlc3VsdCByZXR1cm5lZCB3aWxsIGJlY29tZSB0aGUgcmVzdWx0IGluY2x1ZGVkIGluIGB2aXNpdEFsbCgpYHMgcmVzdWx0IGFycmF5LlxuICB2aXNpdD8obm9kZTogTm9kZSk6IFJlc3VsdDtcblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IFJlc3VsdDtcbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBSZXN1bHQ7XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogUmVzdWx0O1xuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IFJlc3VsdDtcbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiBSZXN1bHQ7XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiBSZXN1bHQ7XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IFJlc3VsdDtcbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IFJlc3VsdDtcbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiBSZXN1bHQ7XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IFJlc3VsdDtcbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcik6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IFJlc3VsdDtcbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpOiBSZXN1bHQ7XG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KTogUmVzdWx0O1xuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCk6IFJlc3VsdDtcbiAgdmlzaXRVbmtub3duQmxvY2soYmxvY2s6IFVua25vd25CbG9jayk6IFJlc3VsdDtcbn1cblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZVZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yPHZvaWQ+IHtcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmF0dHJpYnV0ZXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuaW5wdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50Lm91dHB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gIH1cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5hdHRyaWJ1dGVzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLm91dHB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLmNoaWxkcmVuKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICAgIGRlZmVycmVkLnZpc2l0QWxsKHRoaXMpO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZyk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jayk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNhc2VzKTtcbiAgfVxuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spOiB2b2lkIHtcbiAgICBjb25zdCBibG9ja0l0ZW1zID0gW2Jsb2NrLml0ZW0sIC4uLk9iamVjdC52YWx1ZXMoYmxvY2suY29udGV4dFZhcmlhYmxlcyksIC4uLmJsb2NrLmNoaWxkcmVuXTtcbiAgICBibG9jay5lbXB0eSAmJiBibG9ja0l0ZW1zLnB1c2goYmxvY2suZW1wdHkpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrSXRlbXMpO1xuICB9XG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jayk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmJyYW5jaGVzKTtcbiAgfVxuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpOiB2b2lkIHtcbiAgICBjb25zdCBibG9ja0l0ZW1zID0gYmxvY2suY2hpbGRyZW47XG4gICAgYmxvY2suZXhwcmVzc2lvbkFsaWFzICYmIGJsb2NrSXRlbXMucHVzaChibG9jay5leHByZXNzaW9uQWxpYXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrSXRlbXMpO1xuICB9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IHZvaWQge31cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IHZvaWQge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IHZvaWQge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IHZvaWQge31cbiAgdmlzaXRVbmtub3duQmxvY2soYmxvY2s6IFVua25vd25CbG9jayk6IHZvaWQge31cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRBbGw8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4sIG5vZGVzOiBOb2RlW10pOiBSZXN1bHRbXSB7XG4gIGNvbnN0IHJlc3VsdDogUmVzdWx0W10gPSBbXTtcbiAgaWYgKHZpc2l0b3IudmlzaXQpIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIHZpc2l0b3IudmlzaXQobm9kZSkgfHwgbm9kZS52aXNpdCh2aXNpdG9yKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICBjb25zdCBuZXdOb2RlID0gbm9kZS52aXNpdCh2aXNpdG9yKTtcbiAgICAgIGlmIChuZXdOb2RlKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKG5ld05vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIl19