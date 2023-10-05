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
export class UnknownBlock {
    constructor(name, sourceSpan) {
        this.name = name;
        this.sourceSpan = sourceSpan;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQVlIOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLE9BQU87SUFDbEIsWUFBbUIsS0FBYSxFQUFTLFVBQTJCO1FBQWpELFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFDeEUsS0FBSyxDQUFTLFFBQXlCO1FBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sSUFBSTtJQUNmLFlBQW1CLEtBQWEsRUFBUyxVQUEyQjtRQUFqRCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7SUFBRyxDQUFDO0lBQ3hFLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVM7SUFDcEIsWUFBbUIsS0FBVSxFQUFTLFVBQTJCLEVBQVMsSUFBZTtRQUF0RSxVQUFLLEdBQUwsS0FBSyxDQUFLO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUM3RixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFDeEIsWUFDVyxJQUFZLEVBQVMsS0FBYSxFQUFTLFVBQTJCLEVBQ3BFLE9BQWtDLEVBQVMsU0FBMkIsRUFDeEUsSUFBZTtRQUZmLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFDcEUsWUFBTyxHQUFQLE9BQU8sQ0FBMkI7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFrQjtRQUN4RSxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUM5QixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLGNBQWM7SUFDekIsWUFDVyxJQUFZLEVBQVMsSUFBaUIsRUFBUyxlQUFnQyxFQUMvRSxLQUFVLEVBQVMsSUFBaUIsRUFBUyxVQUEyQixFQUN0RSxPQUF3QixFQUFTLFNBQW9DLEVBQ3ZFLElBQXdCO1FBSHhCLFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFhO1FBQVMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQy9FLFVBQUssR0FBTCxLQUFLLENBQUs7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFhO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFDdEUsWUFBTyxHQUFQLE9BQU8sQ0FBaUI7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUEyQjtRQUN2RSxTQUFJLEdBQUosSUFBSSxDQUFvQjtJQUFHLENBQUM7SUFFdkMsTUFBTSxDQUFDLHdCQUF3QixDQUFDLElBQTBCLEVBQUUsSUFBZTtRQUN6RSxJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFFO1lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQ1gsa0ZBQ0ksSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztTQUMxQztRQUNELE9BQU8sSUFBSSxjQUFjLENBQ3JCLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxFQUNsRixJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sVUFBVTtJQUNyQixZQUNXLElBQVksRUFBUyxJQUFxQixFQUFTLE9BQVksRUFDL0QsTUFBbUIsRUFBUyxLQUFrQixFQUFTLFVBQTJCLEVBQ2xGLFdBQTRCLEVBQVcsT0FBd0I7UUFGL0QsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUFTLFNBQUksR0FBSixJQUFJLENBQWlCO1FBQVMsWUFBTyxHQUFQLE9BQU8sQ0FBSztRQUMvRCxXQUFNLEdBQU4sTUFBTSxDQUFhO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBYTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ2xGLGdCQUFXLEdBQVgsV0FBVyxDQUFpQjtRQUFXLFlBQU8sR0FBUCxPQUFPLENBQWlCO0lBQUcsQ0FBQztJQUU5RSxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQWtCO1FBQ3ZDLE1BQU0sTUFBTSxHQUFnQixLQUFLLENBQUMsSUFBSSxvQ0FBNEIsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ2hHLE1BQU0sS0FBSyxHQUNQLEtBQUssQ0FBQyxJQUFJLHNDQUE4QixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDMUUsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRTtZQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLDZFQUNaLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7U0FDeEM7UUFDRCxPQUFPLElBQUksVUFBVSxDQUNqQixLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFDekYsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxPQUFPO0lBQ2xCLFlBQ1csSUFBWSxFQUFTLFVBQTJCLEVBQVMsTUFBd0IsRUFDakYsT0FBcUIsRUFBUyxRQUFnQixFQUFTLFVBQXVCLEVBQzlFLFVBQTJCLEVBQVMsZUFBZ0MsRUFDcEUsYUFBbUMsRUFBUyxJQUFlO1FBSDNELFNBQUksR0FBSixJQUFJLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUFTLFdBQU0sR0FBTixNQUFNLENBQWtCO1FBQ2pGLFlBQU8sR0FBUCxPQUFPLENBQWM7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUM5RSxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUFTLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUNwRSxrQkFBYSxHQUFiLGFBQWEsQ0FBc0I7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUMxRSxLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBZ0IsZUFBZTtJQUNuQyxZQUFtQixVQUEyQjtRQUEzQixlQUFVLEdBQVYsVUFBVSxDQUFpQjtJQUFHLENBQUM7SUFFbEQsS0FBSyxDQUFTLE9BQXdCO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxlQUFlO0lBQ3ZELFlBQW1CLEtBQVUsRUFBRSxVQUEyQjtRQUN4RCxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFERCxVQUFLLEdBQUwsS0FBSyxDQUFLO0lBRTdCLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxtQkFBb0IsU0FBUSxlQUFlO0NBQUc7QUFFM0QsTUFBTSxPQUFPLHdCQUF5QixTQUFRLGVBQWU7Q0FBRztBQUVoRSxNQUFNLE9BQU8sb0JBQXFCLFNBQVEsZUFBZTtJQUN2RCxZQUFtQixTQUFzQixFQUFFLFVBQTJCO1FBQ3BFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQURELGNBQVMsR0FBVCxTQUFTLENBQWE7SUFFekMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLG9CQUFxQixTQUFRLGVBQWU7SUFDdkQsWUFBbUIsS0FBYSxFQUFFLFVBQTJCO1FBQzNELEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQURELFVBQUssR0FBTCxLQUFLLENBQVE7SUFFaEMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLDBCQUEyQixTQUFRLGVBQWU7SUFDN0QsWUFBbUIsU0FBc0IsRUFBRSxVQUEyQjtRQUNwRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFERCxjQUFTLEdBQVQsU0FBUyxDQUFhO0lBRXpDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxlQUFlO0lBQzFELFlBQW1CLFNBQXNCLEVBQUUsVUFBMkI7UUFDcEUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBREQsY0FBUyxHQUFULFNBQVMsQ0FBYTtJQUV6QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sd0JBQXdCO0lBQ25DLFlBQ1csUUFBZ0IsRUFBUyxXQUF3QixFQUFTLFVBQTJCLEVBQ3JGLGVBQWdDLEVBQVMsYUFBbUM7UUFENUUsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFDckYsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQVMsa0JBQWEsR0FBYixhQUFhLENBQXNCO0lBQUcsQ0FBQztJQUUzRixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckQsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLG9CQUFvQjtJQUMvQixZQUNXLFFBQWdCLEVBQVMsU0FBc0IsRUFBUyxXQUF3QixFQUNoRixVQUEyQixFQUFTLGVBQWdDLEVBQ3BFLGFBQW1DO1FBRm5DLGFBQVEsR0FBUixRQUFRLENBQVE7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFhO1FBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDaEYsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBUyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDcEUsa0JBQWEsR0FBYixhQUFhLENBQXNCO0lBQUcsQ0FBQztJQUVsRCxLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLGtCQUFrQjtJQUM3QixZQUNXLFFBQWdCLEVBQVMsVUFBMkIsRUFDcEQsZUFBZ0MsRUFBUyxhQUFtQztRQUQ1RSxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFDcEQsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQVMsa0JBQWEsR0FBYixhQUFhLENBQXNCO0lBQUcsQ0FBQztJQUUzRixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBWUQsTUFBTSxPQUFPLGFBQWE7SUFNeEIsWUFDVyxRQUFnQixFQUFFLFFBQStCLEVBQ3hELGdCQUF1QyxFQUFTLFdBQTBDLEVBQ25GLE9BQWtDLEVBQVMsS0FBOEIsRUFDekUsVUFBMkIsRUFBUyxlQUFnQyxFQUNwRSxhQUFtQztRQUpuQyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQ3lCLGdCQUFXLEdBQVgsV0FBVyxDQUErQjtRQUNuRixZQUFPLEdBQVAsT0FBTyxDQUEyQjtRQUFTLFVBQUssR0FBTCxLQUFLLENBQXlCO1FBQ3pFLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQVMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQ3BFLGtCQUFhLEdBQWIsYUFBYSxDQUFzQjtRQUM1QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUM7UUFDekMsZ0VBQWdFO1FBQ2hFLG9FQUFvRTtRQUNwRSxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFvQyxDQUFDO1FBQ2hGLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFvQyxDQUFDO0lBQ2xHLENBQUM7SUFFRCxLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELFFBQVEsQ0FBQyxPQUF5QjtRQUNoQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakYsUUFBUSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFdBQVcsSUFBSSxPQUFPLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVFLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVPLGFBQWEsQ0FDakIsSUFBcUMsRUFBRSxRQUErQixFQUFFLE9BQWdCO1FBQzFGLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1lBQ3RCLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFFLENBQUMsQ0FBQztTQUM5QztJQUNILENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxXQUFXO0lBQ3RCLFlBQ1csVUFBZSxFQUFTLEtBQXdCLEVBQVMsVUFBMkIsRUFDcEYsZUFBZ0MsRUFBUyxhQUFtQztRQUQ1RSxlQUFVLEdBQVYsVUFBVSxDQUFLO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBbUI7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUNwRixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFBUyxrQkFBYSxHQUFiLGFBQWEsQ0FBc0I7SUFBRyxDQUFDO0lBRTNGLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sZUFBZTtJQUMxQixZQUNXLFVBQW9CLEVBQVMsUUFBZ0IsRUFBUyxVQUEyQixFQUNqRixlQUFnQztRQURoQyxlQUFVLEdBQVYsVUFBVSxDQUFVO1FBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ2pGLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtJQUFHLENBQUM7SUFFL0MsS0FBSyxDQUFTLE9BQXdCO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQVFELE1BQU0sT0FBTyxZQUFZO0lBQ3ZCLFlBQ1csSUFBYyxFQUFTLFVBQXlCLEVBQVMsT0FBc0IsRUFDL0UsZ0JBQXFDLEVBQVMsUUFBZ0IsRUFDOUQsS0FBNkIsRUFBUyxVQUEyQixFQUNqRSxlQUFnQyxFQUFTLGFBQW1DO1FBSDVFLFNBQUksR0FBSixJQUFJLENBQVU7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFlO1FBQVMsWUFBTyxHQUFQLE9BQU8sQ0FBZTtRQUMvRSxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQXFCO1FBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUM5RCxVQUFLLEdBQUwsS0FBSyxDQUF3QjtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ2pFLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUFTLGtCQUFhLEdBQWIsYUFBYSxDQUFzQjtJQUFHLENBQUM7SUFFM0YsS0FBSyxDQUFTLE9BQXdCO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxpQkFBaUI7SUFDNUIsWUFDVyxRQUFnQixFQUFTLFVBQTJCLEVBQ3BELGVBQWdDO1FBRGhDLGFBQVEsR0FBUixRQUFRLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUNwRCxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7SUFBRyxDQUFDO0lBRS9DLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sT0FBTztJQUNsQixZQUNXLFFBQXlCLEVBQVMsVUFBMkIsRUFDN0QsZUFBZ0MsRUFBUyxhQUFtQztRQUQ1RSxhQUFRLEdBQVIsUUFBUSxDQUFpQjtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQzdELG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUFTLGtCQUFhLEdBQWIsYUFBYSxDQUFzQjtJQUFHLENBQUM7SUFFM0YsS0FBSyxDQUFTLE9BQXdCO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sYUFBYTtJQUN4QixZQUNXLFVBQW9CLEVBQVMsUUFBZ0IsRUFBUyxlQUE4QixFQUNwRixVQUEyQixFQUFTLGVBQWdDO1FBRHBFLGVBQVUsR0FBVixVQUFVLENBQVU7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQVMsb0JBQWUsR0FBZixlQUFlLENBQWU7UUFDcEYsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFBUyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7SUFBRyxDQUFDO0lBRW5GLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sWUFBWTtJQUN2QixZQUFtQixJQUFZLEVBQVMsVUFBMkI7UUFBaEQsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO0lBQUcsQ0FBQztJQUV2RSxLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFFBQVE7SUFDbkI7SUFDSSwrREFBK0Q7SUFDL0QsMkZBQTJGO0lBQzNGLDJGQUEyRjtJQUMzRixRQUFRO0lBQ0QsT0FBb0IsRUFDcEIsVUFBMkIsRUFDM0IsTUFBd0IsRUFDeEIsT0FBcUIsRUFDckIsYUFBK0MsRUFDL0MsUUFBZ0IsRUFDaEIsVUFBdUIsRUFDdkIsU0FBcUIsRUFDckIsVUFBMkIsRUFDM0IsZUFBZ0MsRUFDaEMsYUFBbUMsRUFDbkMsSUFBZTtRQVhmLFlBQU8sR0FBUCxPQUFPLENBQWE7UUFDcEIsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFDM0IsV0FBTSxHQUFOLE1BQU0sQ0FBa0I7UUFDeEIsWUFBTyxHQUFQLE9BQU8sQ0FBYztRQUNyQixrQkFBYSxHQUFiLGFBQWEsQ0FBa0M7UUFDL0MsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUNoQixlQUFVLEdBQVYsVUFBVSxDQUFhO1FBQ3ZCLGNBQVMsR0FBVCxTQUFTLENBQVk7UUFDckIsZUFBVSxHQUFWLFVBQVUsQ0FBaUI7UUFDM0Isb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQ2hDLGtCQUFhLEdBQWIsYUFBYSxDQUFzQjtRQUNuQyxTQUFJLEdBQUosSUFBSSxDQUFXO0lBQ3ZCLENBQUM7SUFDSixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxPQUFPO0lBR2xCLFlBQ1csUUFBZ0IsRUFBUyxVQUEyQixFQUNwRCxVQUEyQixFQUFTLElBQWU7UUFEbkQsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ3BELGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBVztRQUpyRCxTQUFJLEdBQUcsWUFBWSxDQUFDO0lBSW9DLENBQUM7SUFDbEUsS0FBSyxDQUFTLE9BQXdCO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sUUFBUTtJQUNuQixZQUNXLElBQVksRUFBUyxLQUFhLEVBQVMsVUFBMkIsRUFDcEUsT0FBd0IsRUFBUyxTQUEyQjtRQUQ5RCxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQ3BFLFlBQU8sR0FBUCxPQUFPLENBQWlCO1FBQVMsY0FBUyxHQUFULFNBQVMsQ0FBa0I7SUFBRyxDQUFDO0lBQzdFLEtBQUssQ0FBUyxPQUF3QjtRQUNwQyxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVM7SUFDcEIsWUFDVyxJQUFZLEVBQVMsS0FBYSxFQUFTLFVBQTJCLEVBQ3BFLE9BQXdCLEVBQVMsU0FBMkI7UUFEOUQsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUFTLFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUNwRSxZQUFPLEdBQVAsT0FBTyxDQUFpQjtRQUFTLGNBQVMsR0FBVCxTQUFTLENBQWtCO0lBQUcsQ0FBQztJQUM3RSxLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxHQUFHO0lBQ2QsWUFDVyxJQUFpQyxFQUNqQyxZQUE4QyxFQUFTLFVBQTJCLEVBQ2xGLElBQWU7UUFGZixTQUFJLEdBQUosSUFBSSxDQUE2QjtRQUNqQyxpQkFBWSxHQUFaLFlBQVksQ0FBa0M7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUNsRixTQUFJLEdBQUosSUFBSSxDQUFXO0lBQUcsQ0FBQztJQUM5QixLQUFLLENBQVMsT0FBd0I7UUFDcEMsT0FBTyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7Q0FDRjtBQWdDRCxNQUFNLE9BQU8sZ0JBQWdCO0lBQzNCLFlBQVksQ0FBQyxPQUFnQjtRQUMzQixRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQixRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNoQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBQ0QsYUFBYSxDQUFDLFFBQWtCO1FBQzlCLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFDRCxrQkFBa0IsQ0FBQyxRQUF1QjtRQUN4QyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFDRCw2QkFBNkIsQ0FBQyxLQUErQjtRQUMzRCxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ0QsdUJBQXVCLENBQUMsS0FBeUI7UUFDL0MsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUNELHlCQUF5QixDQUFDLEtBQTJCO1FBQ25ELFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxLQUFrQjtRQUNqQyxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBQ0Qsb0JBQW9CLENBQUMsS0FBc0I7UUFDekMsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUNELGlCQUFpQixDQUFDLEtBQW1CO1FBQ25DLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZCLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1FBQ3RELFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9CLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFDRCxzQkFBc0IsQ0FBQyxLQUF3QjtRQUM3QyxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ0QsWUFBWSxDQUFDLEtBQWM7UUFDekIsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUNELGtCQUFrQixDQUFDLEtBQW9CO1FBQ3JDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9CLEtBQUssQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFDRCxZQUFZLENBQUMsT0FBZ0IsSUFBUyxDQUFDO0lBQ3ZDLGFBQWEsQ0FBQyxRQUFrQixJQUFTLENBQUM7SUFDMUMsY0FBYyxDQUFDLFNBQW9CLElBQVMsQ0FBQztJQUM3QyxrQkFBa0IsQ0FBQyxTQUF3QixJQUFTLENBQUM7SUFDckQsbUJBQW1CLENBQUMsU0FBeUIsSUFBUyxDQUFDO0lBQ3ZELGVBQWUsQ0FBQyxTQUFxQixJQUFTLENBQUM7SUFDL0MsU0FBUyxDQUFDLElBQVUsSUFBUyxDQUFDO0lBQzlCLGNBQWMsQ0FBQyxJQUFlLElBQVMsQ0FBQztJQUN4QyxRQUFRLENBQUMsR0FBUSxJQUFTLENBQUM7SUFDM0Isb0JBQW9CLENBQUMsT0FBd0IsSUFBUyxDQUFDO0lBQ3ZELGlCQUFpQixDQUFDLEtBQW1CLElBQVMsQ0FBQztDQUNoRDtBQUdELE1BQU0sVUFBVSxRQUFRLENBQVMsT0FBd0IsRUFBRSxLQUFhO0lBQ3RFLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUM1QixJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDakIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQzVDO0tBQ0Y7U0FBTTtRQUNMLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDcEMsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUN0QjtTQUNGO0tBQ0Y7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0kxOG5NZXRhfSBmcm9tICcuLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBOb2RlIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdDtcbn1cblxuLyoqXG4gKiBUaGlzIGlzIGFuIFIzIGBOb2RlYC1saWtlIHdyYXBwZXIgZm9yIGEgcmF3IGBodG1sLkNvbW1lbnRgIG5vZGUuIFdlIGRvIG5vdCBjdXJyZW50bHlcbiAqIHJlcXVpcmUgdGhlIGltcGxlbWVudGF0aW9uIG9mIGEgdmlzaXRvciBmb3IgQ29tbWVudHMgYXMgdGhleSBhcmUgb25seSBjb2xsZWN0ZWQgYXRcbiAqIHRoZSB0b3AtbGV2ZWwgb2YgdGhlIFIzIEFTVCwgYW5kIG9ubHkgaWYgYFJlbmRlcjNQYXJzZU9wdGlvbnNbJ2NvbGxlY3RDb21tZW50Tm9kZXMnXWBcbiAqIGlzIHRydWUuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21tZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdDxSZXN1bHQ+KF92aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHRocm93IG5ldyBFcnJvcigndmlzaXQoKSBub3QgaW1wbGVtZW50ZWQgZm9yIENvbW1lbnQnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRCb3VuZFRleHQodGhpcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgdGV4dCBhdHRyaWJ1dGUgaW4gdGhlIHRlbXBsYXRlLlxuICpcbiAqIGB2YWx1ZVNwYW5gIG1heSBub3QgYmUgcHJlc2VudCBpbiBjYXNlcyB3aGVyZSB0aGVyZSBpcyBubyB2YWx1ZSBgPGRpdiBhPjwvZGl2PmAuXG4gKiBga2V5U3BhbmAgbWF5IGFsc28gbm90IGJlIHByZXNlbnQgZm9yIHN5bnRoZXRpYyBhdHRyaWJ1dGVzIGZyb20gSUNVIGV4cGFuc2lvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0QXR0cmlidXRlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCBwdWJsaWMgdmFsdWVTcGFuPzogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dEF0dHJpYnV0ZSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRBdHRyaWJ1dGUgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdHlwZTogQmluZGluZ1R5cGUsIHB1YmxpYyBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICAgIHB1YmxpYyB2YWx1ZTogQVNULCBwdWJsaWMgdW5pdDogc3RyaW5nfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsXG4gICAgICBwdWJsaWMgaTE4bjogSTE4bk1ldGF8dW5kZWZpbmVkKSB7fVxuXG4gIHN0YXRpYyBmcm9tQm91bmRFbGVtZW50UHJvcGVydHkocHJvcDogQm91bmRFbGVtZW50UHJvcGVydHksIGkxOG4/OiBJMThuTWV0YSk6IEJvdW5kQXR0cmlidXRlIHtcbiAgICBpZiAocHJvcC5rZXlTcGFuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5leHBlY3RlZCBzdGF0ZToga2V5U3BhbiBtdXN0IGJlIGRlZmluZWQgZm9yIGJvdW5kIGF0dHJpYnV0ZXMgYnV0IHdhcyBub3QgZm9yICR7XG4gICAgICAgICAgICAgIHByb3AubmFtZX06ICR7cHJvcC5zb3VyY2VTcGFufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJvdW5kQXR0cmlidXRlKFxuICAgICAgICBwcm9wLm5hbWUsIHByb3AudHlwZSwgcHJvcC5zZWN1cml0eUNvbnRleHQsIHByb3AudmFsdWUsIHByb3AudW5pdCwgcHJvcC5zb3VyY2VTcGFuLFxuICAgICAgICBwcm9wLmtleVNwYW4sIHByb3AudmFsdWVTcGFuLCBpMThuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kQXR0cmlidXRlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZEV2ZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IFBhcnNlZEV2ZW50VHlwZSwgcHVibGljIGhhbmRsZXI6IEFTVCxcbiAgICAgIHB1YmxpYyB0YXJnZXQ6IHN0cmluZ3xudWxsLCBwdWJsaWMgcGhhc2U6IHN0cmluZ3xudWxsLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHJlYWRvbmx5IGtleVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICBzdGF0aWMgZnJvbVBhcnNlZEV2ZW50KGV2ZW50OiBQYXJzZWRFdmVudCkge1xuICAgIGNvbnN0IHRhcmdldDogc3RyaW5nfG51bGwgPSBldmVudC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuUmVndWxhciA/IGV2ZW50LnRhcmdldE9yUGhhc2UgOiBudWxsO1xuICAgIGNvbnN0IHBoYXNlOiBzdHJpbmd8bnVsbCA9XG4gICAgICAgIGV2ZW50LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBldmVudC50YXJnZXRPclBoYXNlIDogbnVsbDtcbiAgICBpZiAoZXZlbnQua2V5U3BhbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgc3RhdGU6IGtleVNwYW4gbXVzdCBiZSBkZWZpbmVkIGZvciBib3VuZCBldmVudCBidXQgd2FzIG5vdCBmb3IgJHtcbiAgICAgICAgICBldmVudC5uYW1lfTogJHtldmVudC5zb3VyY2VTcGFufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJvdW5kRXZlbnQoXG4gICAgICAgIGV2ZW50Lm5hbWUsIGV2ZW50LnR5cGUsIGV2ZW50LmhhbmRsZXIsIHRhcmdldCwgcGhhc2UsIGV2ZW50LnNvdXJjZVNwYW4sIGV2ZW50LmhhbmRsZXJTcGFuLFxuICAgICAgICBldmVudC5rZXlTcGFuKTtcbiAgfVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kRXZlbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVsZW1lbnQgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXR0cmlidXRlczogVGV4dEF0dHJpYnV0ZVtdLCBwdWJsaWMgaW5wdXRzOiBCb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRbXSwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcHVibGljIGkxOG4/OiBJMThuTWV0YSkge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RWxlbWVudCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGVmZXJyZWRUcmlnZ2VyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZERlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWRsZURlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7fVxuXG5leHBvcnQgY2xhc3MgSW1tZWRpYXRlRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHt9XG5cbmV4cG9ydCBjbGFzcyBIb3ZlckRlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWZlcmVuY2U6IHN0cmluZ3xudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGltZXJEZWZlcnJlZFRyaWdnZXIgZXh0ZW5kcyBEZWZlcnJlZFRyaWdnZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXk6IG51bWJlciwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyIGV4dGVuZHMgRGVmZXJyZWRUcmlnZ2VyIHtcbiAgY29uc3RydWN0b3IocHVibGljIHJlZmVyZW5jZTogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKHNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWaWV3cG9ydERlZmVycmVkVHJpZ2dlciBleHRlbmRzIERlZmVycmVkVHJpZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWZlcmVuY2U6IHN0cmluZ3xudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBtaW5pbXVtVGltZTogbnVtYmVyfG51bGwsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2tMb2FkaW5nIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBhZnRlclRpbWU6IG51bWJlcnxudWxsLCBwdWJsaWMgbWluaW11bVRpbWU6IG51bWJlcnxudWxsLFxuICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZEJsb2NrRXJyb3IgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdERlZmVycmVkQmxvY2tFcnJvcih0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlZmVycmVkQmxvY2tUcmlnZ2VycyB7XG4gIHdoZW4/OiBCb3VuZERlZmVycmVkVHJpZ2dlcjtcbiAgaWRsZT86IElkbGVEZWZlcnJlZFRyaWdnZXI7XG4gIGltbWVkaWF0ZT86IEltbWVkaWF0ZURlZmVycmVkVHJpZ2dlcjtcbiAgaG92ZXI/OiBIb3ZlckRlZmVycmVkVHJpZ2dlcjtcbiAgdGltZXI/OiBUaW1lckRlZmVycmVkVHJpZ2dlcjtcbiAgaW50ZXJhY3Rpb24/OiBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcjtcbiAgdmlld3BvcnQ/OiBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmVycmVkQmxvY2sgaW1wbGVtZW50cyBOb2RlIHtcbiAgcmVhZG9ubHkgdHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHJlYWRvbmx5IHByZWZldGNoVHJpZ2dlcnM6IFJlYWRvbmx5PERlZmVycmVkQmxvY2tUcmlnZ2Vycz47XG4gIHByaXZhdGUgcmVhZG9ubHkgZGVmaW5lZFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuICBwcml2YXRlIHJlYWRvbmx5IGRlZmluZWRQcmVmZXRjaFRyaWdnZXJzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsXG4gICAgICBwcmVmZXRjaFRyaWdnZXJzOiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHB1YmxpYyBwbGFjZWhvbGRlcjogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwsXG4gICAgICBwdWJsaWMgbG9hZGluZzogRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCwgcHVibGljIGVycm9yOiBEZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHRoaXMudHJpZ2dlcnMgPSB0cmlnZ2VycztcbiAgICB0aGlzLnByZWZldGNoVHJpZ2dlcnMgPSBwcmVmZXRjaFRyaWdnZXJzO1xuICAgIC8vIFdlIGNhY2hlIHRoZSBrZXlzIHNpbmNlIHdlIGtub3cgdGhhdCB0aGV5IHdvbid0IGNoYW5nZSBhbmQgd2VcbiAgICAvLyBkb24ndCB3YW50IHRvIGVudW1hcmF0ZSB0aGVtIGV2ZXJ5IHRpbWUgd2UncmUgdHJhdmVyc2luZyB0aGUgQVNULlxuICAgIHRoaXMuZGVmaW5lZFRyaWdnZXJzID0gT2JqZWN0LmtleXModHJpZ2dlcnMpIGFzIChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW107XG4gICAgdGhpcy5kZWZpbmVkUHJlZmV0Y2hUcmlnZ2VycyA9IE9iamVjdC5rZXlzKHByZWZldGNoVHJpZ2dlcnMpIGFzIChrZXlvZiBEZWZlcnJlZEJsb2NrVHJpZ2dlcnMpW107XG4gIH1cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrKHRoaXMpO1xuICB9XG5cbiAgdmlzaXRBbGwodmlzaXRvcjogVmlzaXRvcjx1bmtub3duPik6IHZvaWQge1xuICAgIHRoaXMudmlzaXRUcmlnZ2Vycyh0aGlzLmRlZmluZWRUcmlnZ2VycywgdGhpcy50cmlnZ2VycywgdmlzaXRvcik7XG4gICAgdGhpcy52aXNpdFRyaWdnZXJzKHRoaXMuZGVmaW5lZFByZWZldGNoVHJpZ2dlcnMsIHRoaXMucHJlZmV0Y2hUcmlnZ2VycywgdmlzaXRvcik7XG4gICAgdmlzaXRBbGwodmlzaXRvciwgdGhpcy5jaGlsZHJlbik7XG4gICAgdGhpcy5wbGFjZWhvbGRlciAmJiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKHRoaXMucGxhY2Vob2xkZXIpO1xuICAgIHRoaXMubG9hZGluZyAmJiB2aXNpdG9yLnZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcodGhpcy5sb2FkaW5nKTtcbiAgICB0aGlzLmVycm9yICYmIHZpc2l0b3IudmlzaXREZWZlcnJlZEJsb2NrRXJyb3IodGhpcy5lcnJvcik7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0VHJpZ2dlcnMoXG4gICAgICBrZXlzOiAoa2V5b2YgRGVmZXJyZWRCbG9ja1RyaWdnZXJzKVtdLCB0cmlnZ2VyczogRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCB2aXNpdG9yOiBWaXNpdG9yKSB7XG4gICAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgICAgdmlzaXRvci52aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2Vyc1trZXldISk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2l0Y2hCbG9jayBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1QsIHB1YmxpYyBjYXNlczogU3dpdGNoQmxvY2tDYXNlW10sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRTd2l0Y2hCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpdGNoQmxvY2tDYXNlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHJlc3Npb246IEFTVHxudWxsLCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRTd2l0Y2hCbG9ja0Nhc2UodGhpcyk7XG4gIH1cbn1cblxuLy8gTm90ZTogdGhpcyBpcyBhIHdlaXJkIHdheSB0byBkZWZpbmUgdGhlIHByb3BlcnRpZXMsIGJ1dCB3ZSBkbyBpdCBzbyB0aGF0IHdlIGNhblxuLy8gZ2V0IHN0cm9uZyB0eXBpbmcgd2hlbiB0aGUgY29udGV4dCBpcyBwYXNzZWQgdGhyb3VnaCBgT2JqZWN0LnZhbHVlc2AuXG4vKiogQ29udGV4dCB2YXJpYWJsZXMgdGhhdCBjYW4gYmUgdXNlZCBpbnNpZGUgYSBgRm9yTG9vcEJsb2NrYC4gKi9cbmV4cG9ydCB0eXBlIEZvckxvb3BCbG9ja0NvbnRleHQgPVxuICAgIFJlY29yZDwnJGluZGV4J3wnJGZpcnN0J3wnJGxhc3QnfCckZXZlbid8JyRvZGQnfCckY291bnQnLCBWYXJpYWJsZT47XG5cbmV4cG9ydCBjbGFzcyBGb3JMb29wQmxvY2sgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaXRlbTogVmFyaWFibGUsIHB1YmxpYyBleHByZXNzaW9uOiBBU1RXaXRoU291cmNlLCBwdWJsaWMgdHJhY2tCeTogQVNUV2l0aFNvdXJjZSxcbiAgICAgIHB1YmxpYyBjb250ZXh0VmFyaWFibGVzOiBGb3JMb29wQmxvY2tDb250ZXh0LCBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSxcbiAgICAgIHB1YmxpYyBlbXB0eTogRm9yTG9vcEJsb2NrRW1wdHl8bnVsbCwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7fVxuXG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEZvckxvb3BCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRm9yTG9vcEJsb2NrRW1wdHkgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgY2hpbGRyZW46IE5vZGVbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHB1YmxpYyBzdGFydFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRGb3JMb29wQmxvY2tFbXB0eSh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWZCbG9jayBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBicmFuY2hlczogSWZCbG9ja0JyYW5jaFtdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHVibGljIHN0YXJ0U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZCbG9jayh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSWZCbG9ja0JyYW5jaCBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByZXNzaW9uOiBBU1R8bnVsbCwgcHVibGljIGNoaWxkcmVuOiBOb2RlW10sIHB1YmxpYyBleHByZXNzaW9uQWxpYXM6IFZhcmlhYmxlfG51bGwsXG4gICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0SWZCbG9ja0JyYW5jaCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVW5rbm93bkJsb2NrIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0VW5rbm93bkJsb2NrKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZSBpbXBsZW1lbnRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIC8vIHRhZ05hbWUgaXMgdGhlIG5hbWUgb2YgdGhlIGNvbnRhaW5lciBlbGVtZW50LCBpZiBhcHBsaWNhYmxlLlxuICAgICAgLy8gYG51bGxgIGlzIGEgc3BlY2lhbCBjYXNlIGZvciB3aGVuIHRoZXJlIGlzIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgb24gYW4gYG5nLXRlbXBsYXRlYCBzb1xuICAgICAgLy8gdGhlIHJlbmRlcmVyIGNhbiBkaWZmZXJlbnRpYXRlIGJldHdlZW4gdGhlIHN5bnRoZXRpYyB0ZW1wbGF0ZSBhbmQgdGhlIG9uZSB3cml0dGVuIGluIHRoZVxuICAgICAgLy8gZmlsZS5cbiAgICAgIHB1YmxpYyB0YWdOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBUZXh0QXR0cmlidXRlW10sXG4gICAgICBwdWJsaWMgaW5wdXRzOiBCb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRbXSxcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUF0dHJzOiAoQm91bmRBdHRyaWJ1dGV8VGV4dEF0dHJpYnV0ZSlbXSxcbiAgICAgIHB1YmxpYyBjaGlsZHJlbjogTm9kZVtdLFxuICAgICAgcHVibGljIHJlZmVyZW5jZXM6IFJlZmVyZW5jZVtdLFxuICAgICAgcHVibGljIHZhcmlhYmxlczogVmFyaWFibGVbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgc3RhcnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgICBwdWJsaWMgaTE4bj86IEkxOG5NZXRhLFxuICApIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFRlbXBsYXRlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb250ZW50IGltcGxlbWVudHMgTm9kZSB7XG4gIHJlYWRvbmx5IG5hbWUgPSAnbmctY29udGVudCc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc2VsZWN0b3I6IHN0cmluZywgcHVibGljIGF0dHJpYnV0ZXM6IFRleHRBdHRyaWJ1dGVbXSxcbiAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyBpMThuPzogSTE4bk1ldGEpIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdENvbnRlbnQodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhcmlhYmxlIGltcGxlbWVudHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICByZWFkb25seSBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHB1YmxpYyB2YWx1ZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0PFJlc3VsdD4odmlzaXRvcjogVmlzaXRvcjxSZXN1bHQ+KTogUmVzdWx0IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFZhcmlhYmxlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2UgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHJlYWRvbmx5IGtleVNwYW46IFBhcnNlU291cmNlU3BhbiwgcHVibGljIHZhbHVlU3Bhbj86IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQ8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4pOiBSZXN1bHQge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UmVmZXJlbmNlKHRoaXMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJY3UgaW1wbGVtZW50cyBOb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmFyczoge1tuYW1lOiBzdHJpbmddOiBCb3VuZFRleHR9LFxuICAgICAgcHVibGljIHBsYWNlaG9sZGVyczoge1tuYW1lOiBzdHJpbmddOiBUZXh0fEJvdW5kVGV4dH0sIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBwdWJsaWMgaTE4bj86IEkxOG5NZXRhKSB7fVxuICB2aXNpdDxSZXN1bHQ+KHZpc2l0b3I6IFZpc2l0b3I8UmVzdWx0Pik6IFJlc3VsdCB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRJY3UodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBWaXNpdG9yPFJlc3VsdCA9IGFueT4ge1xuICAvLyBSZXR1cm5pbmcgYSB0cnV0aHkgdmFsdWUgZnJvbSBgdmlzaXQoKWAgd2lsbCBwcmV2ZW50IGB2aXNpdEFsbCgpYCBmcm9tIHRoZSBjYWxsIHRvIHRoZSB0eXBlZFxuICAvLyBtZXRob2QgYW5kIHJlc3VsdCByZXR1cm5lZCB3aWxsIGJlY29tZSB0aGUgcmVzdWx0IGluY2x1ZGVkIGluIGB2aXNpdEFsbCgpYHMgcmVzdWx0IGFycmF5LlxuICB2aXNpdD8obm9kZTogTm9kZSk6IFJlc3VsdDtcblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IFJlc3VsdDtcbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBSZXN1bHQ7XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogUmVzdWx0O1xuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IFJlc3VsdDtcbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiBSZXN1bHQ7XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiBSZXN1bHQ7XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IFJlc3VsdDtcbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IFJlc3VsdDtcbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiBSZXN1bHQ7XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IFJlc3VsdDtcbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcik6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IFJlc3VsdDtcbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpOiBSZXN1bHQ7XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IFJlc3VsdDtcbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpOiBSZXN1bHQ7XG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KTogUmVzdWx0O1xuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spOiBSZXN1bHQ7XG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCk6IFJlc3VsdDtcbiAgdmlzaXRVbmtub3duQmxvY2soYmxvY2s6IFVua25vd25CbG9jayk6IFJlc3VsdDtcbn1cblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZVZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yPHZvaWQ+IHtcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50LmF0dHJpYnV0ZXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuaW5wdXRzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50Lm91dHB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gIH1cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5hdHRyaWJ1dGVzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLm91dHB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIHRlbXBsYXRlLmNoaWxkcmVuKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICAgIGRlZmVycmVkLnZpc2l0QWxsKHRoaXMpO1xuICB9XG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZyk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgfVxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jayk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNhc2VzKTtcbiAgfVxuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4pO1xuICB9XG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spOiB2b2lkIHtcbiAgICBibG9jay5pdGVtLnZpc2l0KHRoaXMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIE9iamVjdC52YWx1ZXMoYmxvY2suY29udGV4dFZhcmlhYmxlcykpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cbiAgdmlzaXRGb3JMb29wQmxvY2tFbXB0eShibG9jazogRm9yTG9vcEJsb2NrRW1wdHkpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbik7XG4gIH1cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKTogdm9pZCB7XG4gICAgdmlzaXRBbGwodGhpcywgYmxvY2suYnJhbmNoZXMpO1xuICB9XG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCk6IHZvaWQge1xuICAgIHZpc2l0QWxsKHRoaXMsIGJsb2NrLmNoaWxkcmVuKTtcbiAgICBibG9jay5leHByZXNzaW9uQWxpYXM/LnZpc2l0KHRoaXMpO1xuICB9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IHZvaWQge31cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IHZvaWQge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IHZvaWQge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IHZvaWQge31cbiAgdmlzaXRVbmtub3duQmxvY2soYmxvY2s6IFVua25vd25CbG9jayk6IHZvaWQge31cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRBbGw8UmVzdWx0Pih2aXNpdG9yOiBWaXNpdG9yPFJlc3VsdD4sIG5vZGVzOiBOb2RlW10pOiBSZXN1bHRbXSB7XG4gIGNvbnN0IHJlc3VsdDogUmVzdWx0W10gPSBbXTtcbiAgaWYgKHZpc2l0b3IudmlzaXQpIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIHZpc2l0b3IudmlzaXQobm9kZSkgfHwgbm9kZS52aXNpdCh2aXNpdG9yKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICBjb25zdCBuZXdOb2RlID0gbm9kZS52aXNpdCh2aXNpdG9yKTtcbiAgICAgIGlmIChuZXdOb2RlKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKG5ld05vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIl19