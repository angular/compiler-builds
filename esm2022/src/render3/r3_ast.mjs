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
    constructor(reference, sourceSpan) {
        super(sourceSpan);
        this.reference = reference;
    }
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
    constructor(item, expression, trackBy, contextVariables, children, empty, sourceSpan, startSourceSpan, endSourceSpan) {
        this.item = item;
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
        block.item.visit(this);
        visitAll(this, Object.values(block.contextVariables));
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
        block.expressionAlias?.visit(this);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQVlIOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLE9BQU87SUFDbEIsWUFBbUIsS0FBYSxFQUFTLFVBQTJCO1FBQWpELFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDeEUsS0FBSyxDQUFTLFFBQXlCO1FBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sSUFBSTtJQUNmLFlBQW1CLEtBQWEsRUFBUyxVQUEyQjtRQUFqRCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7SUFBRyxDQUFDO0lBQ3hFLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVM7SUFDcEIsWUFBbUIsS0FBVSxFQUFTLFVBQTJCLEVBQVMsSUFBZTtRQUF0RSxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUM3RixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFDeEIsWUFDVyxJQUFZLEVBQVMsS0FBYSxFQUFTLFVBQTJCLEVBQ3BFLE9BQWtDLEVBQVMsU0FBMkIsRUFDeEUsSUFBZTtRQUZmLFNB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O2dCQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDdEI7U0FDRjtLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgQmluZGluZ1R5cGUsIEJvdW5kRWxlbWVudFByb3BlcnR5LCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtJMThuTWV0YX0gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQ7XG59XG5cbi8qKlxuICogVGhpcyBpcyBhbiBSMyBgTm9kZWAtbGlrZSB3cmFwcGVyIGZvciBhIHJhdyBgaHRtbC5Db21tZW50YCBub2RlLiBXZSBkbyBub3QgY3VycmVudGx5XG4gKiByZXF1aXJlIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiBhIHZpc2l0b3IgZm9yIENvbW1lbnRzIGFzIHRoZXkgYXJlIG9ubHkgY29sbGVjdGVkIGF0XG4gKiB0aGUgdG9wLWxldmVsIG9mIHRoZSBSMyBBU1QsIGFuZCBvbmx5IGlmIGBSZW5kZXIzUGFyc2VPcHRpb25zWydjb2xsZWN0Q29tbWVudE5vZGVzJ11gXG4gKiBpcyB0cnVlLlxuICovXG5leHBvcnQgY2xhc3MgQ29tbWVudCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0PihfdmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Zpc2l0KCkgbm90IGltcGxlbWVudGVkIGZvciBDb21tZW50Jyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRleHQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRleHQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Qm91bmRUZXh0KHRoaXMpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHRleHQgYXR0cmlidXRlIGluIHRoZSB0ZW1wbGF0ZS5cbiAqXG4gKiBgdmFsdWVTcGFuYCBtYXkgbm90IGJlIHByZXNlbnQgaW4gY2FzZXMgd2hlcmUgdGhlcmUgaXMgbm8gdmFsdWUgYDxkaXYgYT48L2Rpdj5gLlxuICogYGtleVNwYW5gIG1heSBhbHNvIG5vdCBiZSBwcmVzZW50IGZvciBzeW50aGV0aWMgYXR0cmlidXRlcyBmcm9tIElDVSBleHBhbnNpb25zLlxuICovXG5leHBvcnQgY2xhc3MgVGV4dEF0dHJpYnV0ZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRleHRBdHRyaWJ1dGUodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kQXR0cmlidXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IEJpbmRpbmdUeXBlLCBwdWJsaWMgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgICBwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIHVuaXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLFxuICAgICAgcHVibGljIGkxOG46IEkxOG5NZXRhfHVuZGVmaW5lZCkge31cblxuICBzdGF0aWMgZnJvbUJvdW5kRWxlbWVudFByb3BlcnR5KHByb3A6IEJvdW5kRWxlbWVudFByb3BlcnR5LCBpMThuPzogSTE4bk1ldGEpOiBCb3VuZEF0dHJpYnV0ZSB7XG4gICAgaWYgKHByb3Aua2V5U3BhbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFVuZXhwZWN0ZWQgc3RhdGU6IGtleVNwYW4gbXVzdCBiZSBkZWZpbmVkIGZvciBib3VuZCBhdHRyaWJ1dGVzIGJ1dCB3YXMgbm90IGZvciAke1xuICAgICAgICAgICAgICBwcm9wLm5hbWV9OiAke3Byb3Auc291cmNlU3Bhbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBCb3VuZEF0dHJpYnV0ZShcbiAgICAgICAgcHJvcC5uYW1lLCBwcm9wLnR5cGUsIHByb3Auc2VjdXJpdHlDb250ZXh0LCBwcm9wLnZhbHVlLCBwcm9wLnVuaXQsIHByb3Auc291cmNlU3BhbixcbiAgICAgICAgcHJvcC5rZXlTcGFuLCBwcm9wLnZhbHVlU3BhbiwgaTE4bik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZEF0dHJpYnV0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRFdmVudCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0eXBlOiBQYXJzZWRFdmVudFR5cGUsIHB1YmxpYyBoYW5kbGVyOiBBU1QsXG4gICAgICBwdWJsaWMgdGFyZ2V0OiBzdHJpbmd8bnVsbCwgcHVibGljIHBoYXNlOiBzdHJpbmd8bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuLCByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgc3RhdGljIGZyb21QYXJzZWRFdmVudChldmVudDogUGFyc2VkRXZlbnQpIHtcbiAgICBjb25zdCB0YXJnZXQ6IHN0cmluZ3xudWxsID0gZXZlbnQudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLlJlZ3VsYXIgPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICBjb25zdCBwaGFzZTogc3RyaW5nfG51bGwgPVxuICAgICAgICBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gZXZlbnQudGFyZ2V0T3JQaGFzZSA6IG51bGw7XG4gICAgaWYgKGV2ZW50LmtleVNwYW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHN0YXRlOiBrZXlTcGFuIG11c3QgYmUgZGVmaW5lZCBmb3IgYm91bmQgZXZlbnQgYnV0IHdhcyBub3QgZm9yICR7XG4gICAgICAgICAgZXZlbnQubmFtZX06ICR7ZXZlbnQuc291cmNlU3Bhbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBCb3VuZEV2ZW50KFxuICAgICAgICBldmVudC5uYW1lLCBldmVudC50eXBlLCBldmVudC5oYW5kbGVyLCB0YXJnZXQsIHBoYXNlLCBldmVudC5zb3VyY2VTcGFuLCBldmVudC5oYW5kbGVyU3BhbixcbiAgICAgICAgZXZlbnQua2V5U3Bhbik7XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZEV2ZW50KHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbGVtZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIGF0dHJpYnV0ZXM6IFRleHRBdHRyaWJ1dGVbXSwgcHVibGljIGlucHV0czogQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBvdXRwdXRzOiBCb3VuZEV2ZW50W10sIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlW10sXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEVsZW1lbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIERlZmVycmVkVHJpZ2dlciBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkVHJpZ2dlcih0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmREZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIElkbGVEZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge31cblxuZXhwb3J0IGNsYXNzIEltbWVkaWF0ZURlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7fVxuXG5leHBvcnQgY2xhc3MgSG92ZXJEZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVmZXJlbmNlOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVyRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IocHVibGljIGRlbGF5OiBudW1iZXIsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKHNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWZlcmVuY2U6IHN0cmluZ3xudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmlld3BvcnREZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVmZXJlbmNlOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgbWluaW11bVRpbWU6IG51bWJlcnxudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZEJsb2NrTG9hZGluZyBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgYWZ0ZXJUaW1lOiBudW1iZXJ8bnVsbCwgcHVibGljIG1pbmltdW1UaW1lOiBudW1iZXJ8bnVsbCxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVmZXJyZWRCbG9ja0Vycm9yIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrRXJyb3IodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMge1xuICB3aGVuPzogQm91bmREZWZlcnJlZFRyaWdnZXI7XG4gIGlkbGU/OiBJZGxlRGVmZXJyZWRUcmlnZ2VyO1xuICBpbW1lZGlhdGU/OiBJbW1lZGlhdGVEZWZlcnJlZFRyaWdnZXI7XG4gIGhvdmVyPzogSG92ZXJEZWZlcnJlZFRyaWdnZXI7XG4gIHRpbWVyPzogVGltZXJEZWZlcnJlZFRyaWdnZXI7XG4gIGludGVyYWN0aW9uPzogSW50ZXJhY3Rpb25EZWZlcnJlZFRyaWdnZXI7XG4gIHZpZXdwb3J0PzogVmlld3BvcnREZWZlcnJlZFRyaWdnZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZEJsb2NrIGltcGxlbWVudHMgTm9kZSB7XG4gIHJlYWRvbmx5IHRyaWdnZXJzOiBSZWFkb25seTxEZWZlcnJlZEJsb2NrVHJpZ2dlcnM+O1xuICByZWFkb25seSBwcmVmZXRjaFRyaWdnZXJzOiBSZWFkb25seTxEZWZlcnJlZEJsb2NrVHJpZ2dlcnM+O1xuICBwcml2YXRlIHJlYWRvbmx5IGRlZmluZWRUcmlnZ2VyczogKGtleW9mIERlZmVycmVkQmxvY2tUcmlnZ2VycylbXTtcbiAgcHJpdmF0ZSByZWFkb25seSBkZWZpbmVkUHJlZmV0Y2hUcmlnZ2VyczogKGtleW9mIERlZmVycmVkQmxvY2tUcmlnZ2VycylbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCB0cmlnZ2VyczogRGVmZXJyZWRCbG9ja1RyaWdnZXJzLFxuICAgICAgcHJlZmV0Y2hUcmlnZ2VyczogRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCBwdWJsaWMgcGxhY2Vob2xkZXI6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsLFxuICAgICAgcHVibGljIGxvYWRpbmc6IERlZmVycmVkQmxvY2tMb2FkaW5nfG51bGwsIHB1YmxpYyBlcnJvcjogRGVmZXJyZWRCbG9ja0Vycm9yfG51bGwsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICB0aGlzLnRyaWdnZXJzID0gdHJpZ2dlcnM7XG4gICAgdGhpcy5wcmVmZXRjaFRyaWdnZXJzID0gcHJlZmV0Y2hUcmlnZ2VycztcbiAgICAvLyBXZSBjYWNoZSB0aGUga2V5cyBzaW5jZSB3ZSBrbm93IHRoYXQgdGhleSB3b24ndCBjaGFuZ2UgYW5kIHdlXG4gICAgLy8gZG9uJ3Qgd2FudCB0byBlbnVtYXJhdGUgdGhlbSBldmVyeSB0aW1lIHdlJ3JlIHRyYXZlcnNpbmcgdGhlIEFTVC5cbiAgICB0aGlzLmRlZmluZWRUcmlnZ2VycyA9IE9iamVjdC5rZXlzKHRyaWdnZXJzKSBhcyAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICAgIHRoaXMuZGVmaW5lZFByZWZldGNoVHJpZ2dlcnMgPSBPYmplY3Qua2V5cyhwcmVmZXRjaFRyaWdnZXJzKSBhcyAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICB9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9jayh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0QWxsKHZpc2l0b3I6IFZpc2l0b3I8dW5rbm93bj4pOiB2b2lkIHtcbiAgICB0aGlzLnZpc2l0VHJpZ2dlcnModGhpcy5kZWZpbmVkVHJpZ2dlcnMsIHRoaXMudHJpZ2dlcnMsIHZpc2l0b3IpO1xuICAgIHRoaXMudmlzaXRUcmlnZ2Vycyh0aGlzLmRlZmluZWRQcmVmZXRjaFRyaWdnZXJzLCB0aGlzLnByZWZldGNoVHJpZ2dlcnMsIHZpc2l0b3IpO1xuICAgIHZpc2l0QWxsKHZpc2l0b3IsIHRoaXMuY2hpbGRyZW4pO1xuICAgIHRoaXMucGxhY2Vob2xkZXIgJiYgdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcih0aGlzLnBsYWNlaG9sZGVyKTtcbiAgICB0aGlzLmxvYWRpbmcgJiYgdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKHRoaXMubG9hZGluZyk7XG4gICAgdGhpcy5lcnJvciAmJiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKHRoaXMuZXJyb3IpO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdFRyaWdnZXJzKFxuICAgICAga2V5czogKGtleW9mIERlZmVycmVkQmxvY2tUcmlnZ2VycylbXSwgdHJpZ2dlcnM6IERlZmVycmVkQmxvY2tUcmlnZ2VycywgdmlzaXRvcjogVmlzaXRvcikge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIHZpc2l0b3IudmlzaXREZWZlcnJlZFRyaWdnZXIodHJpZ2dlcnNba2V5XSEpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpdGNoQmxvY2sgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZXhwcmVzc2lvbjogQVNULCBwdWJsaWMgY2FzZXM6IFN3aXRjaEJsb2NrQ2FzZVtdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U3dpdGNoQmxvY2sodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aXRjaEJsb2NrQ2FzZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1R8bnVsbCwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U3dpdGNoQmxvY2tDYXNlKHRoaXMpO1xuICB9XG59XG5cbi8vIE5vdGU6IHRoaXMgaXMgYSB3ZWlyZCB3YXkgdG8gZGVmaW5lIHRoZSBwcm9wZXJ0aWVzLCBidXQgd2UgZG8gaXQgc28gdGhhdCB3ZSBjYW5cbi8vIGdldCBzdHJvbmcgdHlwaW5nIHdoZW4gdGhlIGNvbnRleHQgaXMgcGFzc2VkIHRocm91Z2ggYE9iamVjdC52YWx1ZXNgLlxuLyoqIENvbnRleHQgdmFyaWFibGVzIHRoYXQgY2FuIGJlIHVzZWQgaW5zaWRlIGEgYEZvckxvb3BCbG9ja2AuICovXG5leHBvcnQgdHlwZSBGb3JMb29wQmxvY2tDb250ZXh0ID1cbiAgICBSZWNvcmQ8JyRpbmRleCd8JyRmaXJzdCd8JyRsYXN0J3wnJGV2ZW4nfCckb2RkJ3wnJGNvdW50JywgVmFyaWFibGU+O1xuXG5leHBvcnQgY2xhc3MgRm9yTG9vcEJsb2NrIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGl0ZW06IFZhcmlhYmxlLCBwdWJsaWMgZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZSwgcHVibGljIHRyYWNrQnk6IEFTVFdpdGhTb3VyY2UsXG4gICAgICBwdWJsaWMgY29udGV4dFZhcmlhYmxlczogRm9yTG9vcEJsb2NrQ29udGV4dCwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sXG4gICAgICBwdWJsaWMgZW1wdHk6IEZvckxvb3BCbG9ja0VtcHR5fG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGb3JMb29wQmxvY2sodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvckxvb3BCbG9ja0VtcHR5IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIElmQmxvY2sgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYnJhbmNoZXM6IElmQmxvY2tCcmFuY2hbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdElmQmxvY2sodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIElmQmxvY2tCcmFuY2ggaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZXhwcmVzc2lvbjogQVNUfG51bGwsIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLCBwdWJsaWMgZXhwcmVzc2lvbkFsaWFzOiBWYXJpYWJsZXxudWxsLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdElmQmxvY2tCcmFuY2godGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgLy8gdGFnTmFtZSBpcyB0aGUgbmFtZSBvZiB0aGUgY29udGFpbmVyIGVsZW1lbnQsIGlmIGFwcGxpY2FibGUuXG4gICAgICAvLyBgbnVsbGAgaXMgYSBzcGVjaWFsIGNhc2UgZm9yIHdoZW4gdGhlcmUgaXMgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSBvbiBhbiBgbmctdGVtcGxhdGVgIHNvXG4gICAgICAvLyB0aGUgcmVuZGVyZXIgY2FuIGRpZmZlcmVudGlhdGUgYmV0d2VlbiB0aGUgc3ludGhldGljIHRlbXBsYXRlIGFuZCB0aGUgb25lIHdyaXR0ZW4gaW4gdGhlXG4gICAgICAvLyBmaWxlLlxuICAgICAgcHVibGljIHRhZ05hbWU6IHN0cmluZ3xudWxsLFxuICAgICAgcHVibGljIGF0dHJpYnV0ZXM6IFRleHRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBpbnB1dHM6IEJvdW5kQXR0cmlidXRlW10sXG4gICAgICBwdWJsaWMgb3V0cHV0czogQm91bmRFdmVudFtdLFxuICAgICAgcHVibGljIHRlbXBsYXRlQXR0cnM6IChCb3VuZEF0dHJpYnV0ZXxUZXh0QXR0cmlidXRlKVtdLFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sXG4gICAgICBwdWJsaWMgcmVmZXJlbmNlczogUmVmZXJlbmNlW10sXG4gICAgICBwdWJsaWMgdmFyaWFibGVzOiBWYXJpYWJsZVtdLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bk1ldGEsXG4gICkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGVtcGxhdGUodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbnRlbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgcmVhZG9ubHkgbmFtZSA9ICduZy1jb250ZW50JztcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBzZWxlY3Rvcjogc3RyaW5nLCBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0Q29udGVudCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmFyaWFibGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHJlYWRvbmx5IGtleVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VmFyaWFibGUodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcmVhZG9ubHkga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRSZWZlcmVuY2UodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEljdSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2YXJzOiB7W25hbWU6IHN0cmluZ106IEJvdW5kVGV4dH0sXG4gICAgICBwdWJsaWMgcGxhY2Vob2xkZXJzOiB7W25hbWU6IHN0cmluZ106IFRleHR8Qm91bmRUZXh0fSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEljdSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZpc2l0b3I8UmVzdWx0ID0gYW55PiB7XG4gIC8vIFJldHVybmluZyBhIHRydXRoeSB2YWx1ZSBmcm9tIGB2aXNpdCgpYCB3aWxsIHByZXZlbnQgYHZpc2l0QWxsKClgIGZyb20gdGhlIGNhbGwgdG8gdGhlIHR5cGVkXG4gIC8vIG1ldGhvZCBhbmQgcmVzdWx0IHJldHVybmVkIHdpbGwgYmVjb21lIHRoZSByZXN1bHQgaW5jbHVkZWQgaW4gYHZpc2l0QWxsKClgcyByZXN1bHQgYXJyYXkuXG4gIHZpc2l0Pyhub2RlOiBOb2RlKTogUmVzdWx0O1xuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogUmVzdWx0O1xuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IFJlc3VsdDtcbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiBSZXN1bHQ7XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogUmVzdWx0O1xuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IFJlc3VsdDtcbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IFJlc3VsdDtcbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogUmVzdWx0O1xuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogUmVzdWx0O1xuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IFJlc3VsdDtcbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogUmVzdWx0O1xuICB2aXNpdEljdShpY3U6IEljdSk6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrKGRlZmVycmVkOiBEZWZlcnJlZEJsb2NrKTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKTogUmVzdWx0O1xuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZyk6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZFRyaWdnZXIodHJpZ2dlcjogRGVmZXJyZWRUcmlnZ2VyKTogUmVzdWx0O1xuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jayk6IFJlc3VsdDtcbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSk6IFJlc3VsdDtcbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jayk6IFJlc3VsdDtcbiAgdmlzaXRGb3JMb29wQmxvY2tFbXB0eShibG9jazogRm9yTG9vcEJsb2NrRW1wdHkpOiBSZXN1bHQ7XG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jayk6IFJlc3VsdDtcbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKTogUmVzdWx0O1xufVxuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlVmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3I8dm9pZD4ge1xuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuYXR0cmlidXRlcyk7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5pbnB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQub3V0cHV0cyk7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgdmlzaXRBbGwodGhpcywgZWxlbWVudC5yZWZlcmVuY2VzKTtcbiAgfVxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLmF0dHJpYnV0ZXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLmlucHV0cyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUub3V0cHV0cyk7XG4gICAgdmlzaXRBbGwodGhpcywgdGVtcGxhdGUuY2hpbGRyZW4pO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLnJlZmVyZW5jZXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLnZhcmlhYmxlcyk7XG4gIH1cbiAgdmlzaXREZWZlcnJlZEJsb2NrKGRlZmVycmVkOiBEZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gICAgZGVmZXJyZWQudmlzaXRBbGwodGhpcyk7XG4gIH1cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcik6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcoYmxvY2s6IERlZmVycmVkQmxvY2tMb2FkaW5nKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2FzZXMpO1xuICB9XG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jayk6IHZvaWQge1xuICAgIGJsb2NrLml0ZW0udmlzaXQodGhpcyk7XG4gICAgdmlzaXRBbGwodGhpcywgT2JqZWN0LnZhbHVlcyhibG9jay5jb250ZXh0VmFyaWFibGVzKSk7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5icmFuY2hlcyk7XG4gIH1cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICAgIGJsb2NrLmV4cHJlc3Npb25BbGlhcz8udmlzaXQodGhpcyk7XG4gIH1cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogdm9pZCB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cbiAgdmlzaXREZWZlcnJlZFRyaWdnZXIodHJpZ2dlcjogRGVmZXJyZWRUcmlnZ2VyKTogdm9pZCB7fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiB2aXNpdEFsbDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Piwgbm9kZXM6IE5vZGVbXSk6IFJlc3VsdFtdIHtcbiAgY29uc3QgcmVzdWx0OiBSZXN1bHRbXSA9IFtdO1xuICBpZiAodmlzaXRvci52aXNpdCkge1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuICAgICAgdmlzaXRvci52aXNpdChub2RlKSB8fCBub2RlLnZpc2l0KHZpc2l0b3IpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIGNvbnN0IG5ld05vZGUgPSBub2RlLnZpc2l0KHZpc2l0b3IpO1xuICAgICAgaWYgKG5ld05vZGUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2gobmV3Tm9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iXX0=