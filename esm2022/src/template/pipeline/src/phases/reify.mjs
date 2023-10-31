/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import { Identifiers } from '../../../../render3/r3_identifiers';
import * as ir from '../../ir';
import { ViewCompilationUnit } from '../compilation';
import * as ng from '../instruction';
/**
 * Map of sanitizers to their identifier.
 */
const sanitizerIdentifierMap = new Map([
    [ir.SanitizerFn.Html, Identifiers.sanitizeHtml],
    [ir.SanitizerFn.IframeAttribute, Identifiers.validateIframeAttribute],
    [ir.SanitizerFn.ResourceUrl, Identifiers.sanitizeResourceUrl],
    [ir.SanitizerFn.Script, Identifiers.sanitizeScript],
    [ir.SanitizerFn.Style, Identifiers.sanitizeStyle], [ir.SanitizerFn.Url, Identifiers.sanitizeUrl]
]);
/**
 * Compiles semantic operations across all views and generates output `o.Statement`s with actual
 * runtime calls in their place.
 *
 * Reification replaces semantic operations with selected Ivy instructions and other generated code
 * structures. After reification, the create/update operation lists of all views should only contain
 * `ir.StatementOp`s (which wrap generated `o.Statement`s).
 */
export function phaseReify(cpl) {
    for (const unit of cpl.units) {
        reifyCreateOperations(unit, unit.create);
        reifyUpdateOperations(unit, unit.update);
    }
}
function reifyCreateOperations(unit, ops) {
    for (const op of ops) {
        ir.transformExpressionsInOp(op, reifyIrExpression, ir.VisitorContextFlag.None);
        switch (op.kind) {
            case ir.OpKind.Text:
                ir.OpList.replace(op, ng.text(op.slot.slot, op.initialValue, op.sourceSpan));
                break;
            case ir.OpKind.ElementStart:
                ir.OpList.replace(op, ng.elementStart(op.slot.slot, op.tag, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.Element:
                ir.OpList.replace(op, ng.element(op.slot.slot, op.tag, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.ElementEnd:
                ir.OpList.replace(op, ng.elementEnd(op.sourceSpan));
                break;
            case ir.OpKind.ContainerStart:
                ir.OpList.replace(op, ng.elementContainerStart(op.slot.slot, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.Container:
                ir.OpList.replace(op, ng.elementContainer(op.slot.slot, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.ContainerEnd:
                ir.OpList.replace(op, ng.elementContainerEnd());
                break;
            case ir.OpKind.I18nStart:
                ir.OpList.replace(op, ng.i18nStart(op.slot.slot, op.messageIndex, op.subTemplateIndex));
                break;
            case ir.OpKind.I18nEnd:
                ir.OpList.replace(op, ng.i18nEnd());
                break;
            case ir.OpKind.I18n:
                ir.OpList.replace(op, ng.i18n(op.slot.slot, op.messageIndex, op.subTemplateIndex));
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                const childView = unit.job.views.get(op.xref);
                ir.OpList.replace(op, ng.template(op.slot.slot, o.variable(childView.fnName), childView.decls, childView.vars, op.block ? null : op.tag, op.attributes, op.sourceSpan));
                break;
            case ir.OpKind.DisableBindings:
                ir.OpList.replace(op, ng.disableBindings());
                break;
            case ir.OpKind.EnableBindings:
                ir.OpList.replace(op, ng.enableBindings());
                break;
            case ir.OpKind.Pipe:
                ir.OpList.replace(op, ng.pipe(op.slot.slot, op.name));
                break;
            case ir.OpKind.Listener:
                const listenerFn = reifyListenerHandler(unit, op.handlerFnName, op.handlerOps, op.consumesDollarEvent);
                const reified = op.hostListener && op.isAnimationListener ?
                    ng.syntheticHostListener(op.name, listenerFn, op.sourceSpan) :
                    ng.listener(op.name, listenerFn, op.sourceSpan);
                ir.OpList.replace(op, reified);
                break;
            case ir.OpKind.Variable:
                if (op.variable.name === null) {
                    throw new Error(`AssertionError: unnamed variable ${op.xref}`);
                }
                ir.OpList.replace(op, ir.createStatementOp(new o.DeclareVarStmt(op.variable.name, op.initializer, undefined, o.StmtModifier.Final)));
                break;
            case ir.OpKind.Namespace:
                switch (op.active) {
                    case ir.Namespace.HTML:
                        ir.OpList.replace(op, ng.namespaceHTML());
                        break;
                    case ir.Namespace.SVG:
                        ir.OpList.replace(op, ng.namespaceSVG());
                        break;
                    case ir.Namespace.Math:
                        ir.OpList.replace(op, ng.namespaceMath());
                        break;
                }
                break;
            case ir.OpKind.Defer:
                const timerScheduling = !!op.loadingMinimumTime || !!op.loadingAfterTime || !!op.placeholderMinimumTime;
                ir.OpList.replace(op, ng.defer(op.slot.slot, op.mainSlot.slot, null, op.loadingSlot?.slot ?? null, op.placeholderSlot?.slot ?? null, op.errorSlot?.slot ?? null, op.loadingConfig, op.placeholderConfig, timerScheduling, op.sourceSpan));
                break;
            case ir.OpKind.DeferOn:
                let args = [];
                switch (op.trigger.kind) {
                    case ir.DeferTriggerKind.Idle:
                    case ir.DeferTriggerKind.Immediate:
                        break;
                    case ir.DeferTriggerKind.Timer:
                        args = [op.trigger.delay];
                        break;
                    case ir.DeferTriggerKind.Interaction:
                    case ir.DeferTriggerKind.Hover:
                    case ir.DeferTriggerKind.Viewport:
                        if (op.trigger.targetSlot?.slot == null || op.trigger.targetSlotViewSteps === null) {
                            throw new Error(`Slot or view steps not set in trigger reification for trigger kind ${op.trigger.kind}`);
                        }
                        args = [op.trigger.targetSlot.slot];
                        if (op.trigger.targetSlotViewSteps !== 0) {
                            args.push(op.trigger.targetSlotViewSteps);
                        }
                        break;
                    default:
                        throw new Error(`AssertionError: Unsupported reification of defer trigger kind ${op.trigger.kind}`);
                }
                ir.OpList.replace(op, ng.deferOn(op.trigger.kind, args, op.prefetch, op.sourceSpan));
                break;
            case ir.OpKind.ProjectionDef:
                ir.OpList.replace(op, ng.projectionDef(op.def));
                break;
            case ir.OpKind.Projection:
                if (op.slot.slot === null) {
                    throw new Error('No slot was assigned for project instruction');
                }
                ir.OpList.replace(op, ng.projection(op.slot.slot, op.projectionSlotIndex, op.attributes, op.sourceSpan));
                break;
            case ir.OpKind.RepeaterCreate:
                if (op.slot.slot === null) {
                    throw new Error('No slot was assigned for repeater instruction');
                }
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                const repeaterView = unit.job.views.get(op.xref);
                if (repeaterView.fnName === null) {
                    throw new Error(`AssertionError: expected repeater primary view to have been named`);
                }
                let emptyViewFnName = null;
                let emptyDecls = null;
                let emptyVars = null;
                if (op.emptyView !== null) {
                    const emptyView = unit.job.views.get(op.emptyView);
                    if (emptyView === undefined) {
                        throw new Error('AssertionError: repeater had empty view xref, but empty view was not found');
                    }
                    if (emptyView.fnName === null || emptyView.decls === null || emptyView.vars === null) {
                        throw new Error(`AssertionError: expected repeater empty view to have been named and counted`);
                    }
                    emptyViewFnName = emptyView.fnName;
                    emptyDecls = emptyView.decls;
                    emptyVars = emptyView.vars;
                }
                ir.OpList.replace(op, ng.repeaterCreate(op.slot.slot, repeaterView.fnName, op.decls, op.vars, op.trackByFn, op.usesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, op.sourceSpan));
                break;
            case ir.OpKind.Statement:
                // Pass statement operations directly through.
                break;
            default:
                throw new Error(`AssertionError: Unsupported reification of create op ${ir.OpKind[op.kind]}`);
        }
    }
}
function reifyUpdateOperations(_unit, ops) {
    for (const op of ops) {
        ir.transformExpressionsInOp(op, reifyIrExpression, ir.VisitorContextFlag.None);
        switch (op.kind) {
            case ir.OpKind.Advance:
                ir.OpList.replace(op, ng.advance(op.delta, op.sourceSpan));
                break;
            case ir.OpKind.Property:
                if (op.expression instanceof ir.Interpolation) {
                    ir.OpList.replace(op, ng.propertyInterpolate(op.name, op.expression.strings, op.expression.expressions, op.sanitizer, op.sourceSpan));
                }
                else {
                    ir.OpList.replace(op, ng.property(op.name, op.expression, op.sanitizer, op.sourceSpan));
                }
                break;
            case ir.OpKind.StyleProp:
                if (op.expression instanceof ir.Interpolation) {
                    ir.OpList.replace(op, ng.stylePropInterpolate(op.name, op.expression.strings, op.expression.expressions, op.unit, op.sourceSpan));
                }
                else {
                    ir.OpList.replace(op, ng.styleProp(op.name, op.expression, op.unit, op.sourceSpan));
                }
                break;
            case ir.OpKind.ClassProp:
                ir.OpList.replace(op, ng.classProp(op.name, op.expression, op.sourceSpan));
                break;
            case ir.OpKind.StyleMap:
                if (op.expression instanceof ir.Interpolation) {
                    ir.OpList.replace(op, ng.styleMapInterpolate(op.expression.strings, op.expression.expressions, op.sourceSpan));
                }
                else {
                    ir.OpList.replace(op, ng.styleMap(op.expression, op.sourceSpan));
                }
                break;
            case ir.OpKind.ClassMap:
                if (op.expression instanceof ir.Interpolation) {
                    ir.OpList.replace(op, ng.classMapInterpolate(op.expression.strings, op.expression.expressions, op.sourceSpan));
                }
                else {
                    ir.OpList.replace(op, ng.classMap(op.expression, op.sourceSpan));
                }
                break;
            case ir.OpKind.I18nExpression:
                ir.OpList.replace(op, ng.i18nExp(op.expression, op.sourceSpan));
                break;
            case ir.OpKind.I18nApply:
                ir.OpList.replace(op, ng.i18nApply(op.targetSlot.slot, op.sourceSpan));
                break;
            case ir.OpKind.InterpolateText:
                ir.OpList.replace(op, ng.textInterpolate(op.interpolation.strings, op.interpolation.expressions, op.sourceSpan));
                break;
            case ir.OpKind.Attribute:
                if (op.expression instanceof ir.Interpolation) {
                    ir.OpList.replace(op, ng.attributeInterpolate(op.name, op.expression.strings, op.expression.expressions, op.sanitizer, op.sourceSpan));
                }
                else {
                    ir.OpList.replace(op, ng.attribute(op.name, op.expression, op.sanitizer));
                }
                break;
            case ir.OpKind.HostProperty:
                if (op.expression instanceof ir.Interpolation) {
                    throw new Error('not yet handled');
                }
                else {
                    if (op.isAnimationTrigger) {
                        ir.OpList.replace(op, ng.syntheticHostProperty(op.name, op.expression, op.sourceSpan));
                    }
                    else {
                        ir.OpList.replace(op, ng.hostProperty(op.name, op.expression, op.sourceSpan));
                    }
                }
                break;
            case ir.OpKind.Variable:
                if (op.variable.name === null) {
                    throw new Error(`AssertionError: unnamed variable ${op.xref}`);
                }
                ir.OpList.replace(op, ir.createStatementOp(new o.DeclareVarStmt(op.variable.name, op.initializer, undefined, o.StmtModifier.Final)));
                break;
            case ir.OpKind.Conditional:
                if (op.processed === null) {
                    throw new Error(`Conditional test was not set.`);
                }
                if (op.targetSlot.slot === null) {
                    throw new Error(`Conditional slot was not set.`);
                }
                ir.OpList.replace(op, ng.conditional(op.targetSlot.slot, op.processed, op.contextValue, op.sourceSpan));
                break;
            case ir.OpKind.Repeater:
                ir.OpList.replace(op, ng.repeater(op.targetSlot.slot, op.collection, op.sourceSpan));
                break;
            case ir.OpKind.Statement:
                // Pass statement operations directly through.
                break;
            default:
                throw new Error(`AssertionError: Unsupported reification of update op ${ir.OpKind[op.kind]}`);
        }
    }
}
function reifyIrExpression(expr) {
    if (!ir.isIrExpression(expr)) {
        return expr;
    }
    switch (expr.kind) {
        case ir.ExpressionKind.NextContext:
            return ng.nextContext(expr.steps);
        case ir.ExpressionKind.Reference:
            return ng.reference(expr.targetSlot.slot + 1 + expr.offset);
        case ir.ExpressionKind.LexicalRead:
            throw new Error(`AssertionError: unresolved LexicalRead of ${expr.name}`);
        case ir.ExpressionKind.RestoreView:
            if (typeof expr.view === 'number') {
                throw new Error(`AssertionError: unresolved RestoreView`);
            }
            return ng.restoreView(expr.view);
        case ir.ExpressionKind.ResetView:
            return ng.resetView(expr.expr);
        case ir.ExpressionKind.GetCurrentView:
            return ng.getCurrentView();
        case ir.ExpressionKind.ReadVariable:
            if (expr.name === null) {
                throw new Error(`Read of unnamed variable ${expr.xref}`);
            }
            return o.variable(expr.name);
        case ir.ExpressionKind.ReadTemporaryExpr:
            if (expr.name === null) {
                throw new Error(`Read of unnamed temporary ${expr.xref}`);
            }
            return o.variable(expr.name);
        case ir.ExpressionKind.AssignTemporaryExpr:
            if (expr.name === null) {
                throw new Error(`Assign of unnamed temporary ${expr.xref}`);
            }
            return o.variable(expr.name).set(expr.expr);
        case ir.ExpressionKind.PureFunctionExpr:
            if (expr.fn === null) {
                throw new Error(`AssertionError: expected PureFunctions to have been extracted`);
            }
            return ng.pureFunction(expr.varOffset, expr.fn, expr.args);
        case ir.ExpressionKind.PureFunctionParameterExpr:
            throw new Error(`AssertionError: expected PureFunctionParameterExpr to have been extracted`);
        case ir.ExpressionKind.PipeBinding:
            return ng.pipeBind(expr.targetSlot.slot, expr.varOffset, expr.args);
        case ir.ExpressionKind.PipeBindingVariadic:
            return ng.pipeBindV(expr.targetSlot.slot, expr.varOffset, expr.args);
        case ir.ExpressionKind.SanitizerExpr:
            return o.importExpr(sanitizerIdentifierMap.get(expr.fn));
        case ir.ExpressionKind.SlotLiteralExpr:
            return o.literal(expr.slot.slot);
        default:
            throw new Error(`AssertionError: Unsupported reification of ir.Expression kind: ${ir.ExpressionKind[expr.kind]}`);
    }
}
/**
 * Listeners get turned into a function expression, which may or may not have the `$event`
 * parameter defined.
 */
function reifyListenerHandler(unit, name, handlerOps, consumesDollarEvent) {
    // First, reify all instruction calls within `handlerOps`.
    reifyUpdateOperations(unit, handlerOps);
    // Next, extract all the `o.Statement`s from the reified operations. We can expect that at this
    // point, all operations have been converted to statements.
    const handlerStmts = [];
    for (const op of handlerOps) {
        if (op.kind !== ir.OpKind.Statement) {
            throw new Error(`AssertionError: expected reified statements, but found op ${ir.OpKind[op.kind]}`);
        }
        handlerStmts.push(op.statement);
    }
    // If `$event` is referenced, we need to generate it as a parameter.
    const params = [];
    if (consumesDollarEvent) {
        // We need the `$event` parameter.
        params.push(new o.FnParam('$event'));
    }
    return o.fn(params, handlerStmts, undefined, undefined, name);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVpZnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZWlmeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUVyQzs7R0FFRztBQUNILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxHQUFHLENBQXNDO0lBQzFFLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVksQ0FBQztJQUMvQyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQztJQUNyRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztJQUM3RCxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxjQUFjLENBQUM7SUFDbkQsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDO0NBQ2pHLENBQUMsQ0FBQztBQUVIOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsVUFBVSxDQUFDLEdBQW1CO0lBQzVDLEtBQUssTUFBTSxJQUFJLElBQUksR0FB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VUFBa0MsRUFDdkUsbUJBQTRCO0lBQzlCLDBEQUEwRDtJQUMxRCxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFFeEMsK0ZBQStGO0lBQy9GLDJEQUEyRDtJQUMzRCxNQUFNLFlBQVksR0FBa0IsRUFBRSxDQUFDO0lBQ3ZDLEtBQUssTUFBTSxFQUFFLElBQUksVUFBVSxFQUFFO1FBQzNCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtZQUNuQyxNQUFNLElBQUksS0FBSyxDQUNYLDZEQUE2RCxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDeEY7UUFDRCxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUNqQztJQUVELG9FQUFvRTtJQUNwRSxNQUFNLE1BQU0sR0FBZ0IsRUFBRSxDQUFDO0lBQy9CLElBQUksbUJBQW1CLEVBQUU7UUFDdkIsa0NBQWtDO1FBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7S0FDdEM7SUFFRCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2hFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Vmlld0NvbXBpbGF0aW9uVW5pdCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCAqIGFzIG5nIGZyb20gJy4uL2luc3RydWN0aW9uJztcblxuLyoqXG4gKiBNYXAgb2Ygc2FuaXRpemVycyB0byB0aGVpciBpZGVudGlmaWVyLlxuICovXG5jb25zdCBzYW5pdGl6ZXJJZGVudGlmaWVyTWFwID0gbmV3IE1hcDxpci5TYW5pdGl6ZXJGbiwgby5FeHRlcm5hbFJlZmVyZW5jZT4oW1xuICBbaXIuU2FuaXRpemVyRm4uSHRtbCwgSWRlbnRpZmllcnMuc2FuaXRpemVIdG1sXSxcbiAgW2lyLlNhbml0aXplckZuLklmcmFtZUF0dHJpYnV0ZSwgSWRlbnRpZmllcnMudmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGVdLFxuICBbaXIuU2FuaXRpemVyRm4uUmVzb3VyY2VVcmwsIElkZW50aWZpZXJzLnNhbml0aXplUmVzb3VyY2VVcmxdLFxuICBbaXIuU2FuaXRpemVyRm4uU2NyaXB0LCBJZGVudGlmaWVycy5zYW5pdGl6ZVNjcmlwdF0sXG4gIFtpci5TYW5pdGl6ZXJGbi5TdHlsZSwgSWRlbnRpZmllcnMuc2FuaXRpemVTdHlsZV0sIFtpci5TYW5pdGl6ZXJGbi5VcmwsIElkZW50aWZpZXJzLnNhbml0aXplVXJsXVxuXSk7XG5cbi8qKlxuICogQ29tcGlsZXMgc2VtYW50aWMgb3BlcmF0aW9ucyBhY3Jvc3MgYWxsIHZpZXdzIGFuZCBnZW5lcmF0ZXMgb3V0cHV0IGBvLlN0YXRlbWVudGBzIHdpdGggYWN0dWFsXG4gKiBydW50aW1lIGNhbGxzIGluIHRoZWlyIHBsYWNlLlxuICpcbiAqIFJlaWZpY2F0aW9uIHJlcGxhY2VzIHNlbWFudGljIG9wZXJhdGlvbnMgd2l0aCBzZWxlY3RlZCBJdnkgaW5zdHJ1Y3Rpb25zIGFuZCBvdGhlciBnZW5lcmF0ZWQgY29kZVxuICogc3RydWN0dXJlcy4gQWZ0ZXIgcmVpZmljYXRpb24sIHRoZSBjcmVhdGUvdXBkYXRlIG9wZXJhdGlvbiBsaXN0cyBvZiBhbGwgdmlld3Mgc2hvdWxkIG9ubHkgY29udGFpblxuICogYGlyLlN0YXRlbWVudE9wYHMgKHdoaWNoIHdyYXAgZ2VuZXJhdGVkIGBvLlN0YXRlbWVudGBzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVpZnkoY3BsOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2YgY3BsLnVuaXRzKSB7XG4gICAgcmVpZnlDcmVhdGVPcGVyYXRpb25zKHVuaXQsIHVuaXQuY3JlYXRlKTtcbiAgICByZWlmeVVwZGF0ZU9wZXJhdGlvbnModW5pdCwgdW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlaWZ5Q3JlYXRlT3BlcmF0aW9ucyh1bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPik6IHZvaWQge1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgcmVpZnlJckV4cHJlc3Npb24sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGV4dDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnRleHQob3Auc2xvdC5zbG90ISwgb3AuaW5pdGlhbFZhbHVlLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudFN0YXJ0KFxuICAgICAgICAgICAgICAgIG9wLnNsb3Quc2xvdCEsIG9wLnRhZyEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50KFxuICAgICAgICAgICAgICAgIG9wLnNsb3Quc2xvdCEsIG9wLnRhZyEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRFbmQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbGVtZW50RW5kKG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJTdGFydDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmVsZW1lbnRDb250YWluZXJTdGFydChcbiAgICAgICAgICAgICAgICBvcC5zbG90LnNsb3QhLCBvcC5hdHRyaWJ1dGVzIGFzIG51bWJlciB8IG51bGwsIG9wLmxvY2FsUmVmcyBhcyBudW1iZXIgfCBudWxsLFxuICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXI6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50Q29udGFpbmVyKFxuICAgICAgICAgICAgICAgIG9wLnNsb3Quc2xvdCEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCwgb3AubG9jYWxSZWZzIGFzIG51bWJlciB8IG51bGwsXG4gICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNvbnRhaW5lckVuZDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmVsZW1lbnRDb250YWluZXJFbmQoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4blN0YXJ0KG9wLnNsb3Quc2xvdCEsIG9wLm1lc3NhZ2VJbmRleCEsIG9wLnN1YlRlbXBsYXRlSW5kZXghKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG5FbmQoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG4ob3Auc2xvdC5zbG90ISwgb3AubWVzc2FnZUluZGV4ISwgb3Auc3ViVGVtcGxhdGVJbmRleCEpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcudGVtcGxhdGUoXG4gICAgICAgICAgICAgICAgb3Auc2xvdC5zbG90ISwgby52YXJpYWJsZShjaGlsZFZpZXcuZm5OYW1lISksIGNoaWxkVmlldy5kZWNscyEsIGNoaWxkVmlldy52YXJzISxcbiAgICAgICAgICAgICAgICBvcC5ibG9jayA/IG51bGwgOiBvcC50YWcsIG9wLmF0dHJpYnV0ZXMsIG9wLnNvdXJjZVNwYW4pLFxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkRpc2FibGVCaW5kaW5nczpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmRpc2FibGVCaW5kaW5ncygpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbmFibGVCaW5kaW5nczpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmVuYWJsZUJpbmRpbmdzKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlBpcGU6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5waXBlKG9wLnNsb3Quc2xvdCEsIG9wLm5hbWUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgY29uc3QgbGlzdGVuZXJGbiA9XG4gICAgICAgICAgICByZWlmeUxpc3RlbmVySGFuZGxlcih1bml0LCBvcC5oYW5kbGVyRm5OYW1lISwgb3AuaGFuZGxlck9wcywgb3AuY29uc3VtZXNEb2xsYXJFdmVudCk7XG4gICAgICAgIGNvbnN0IHJlaWZpZWQgPSBvcC5ob3N0TGlzdGVuZXIgJiYgb3AuaXNBbmltYXRpb25MaXN0ZW5lciA/XG4gICAgICAgICAgICBuZy5zeW50aGV0aWNIb3N0TGlzdGVuZXIob3AubmFtZSwgbGlzdGVuZXJGbiwgb3Auc291cmNlU3BhbikgOlxuICAgICAgICAgICAgbmcubGlzdGVuZXIob3AubmFtZSwgbGlzdGVuZXJGbiwgb3Auc291cmNlU3Bhbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCByZWlmaWVkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgaWYgKG9wLnZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bm5hbWVkIHZhcmlhYmxlICR7b3AueHJlZn1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLkRlY2xhcmVWYXJTdG10KFxuICAgICAgICAgICAgICAgIG9wLnZhcmlhYmxlLm5hbWUsIG9wLmluaXRpYWxpemVyLCB1bmRlZmluZWQsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLk5hbWVzcGFjZTpcbiAgICAgICAgc3dpdGNoIChvcC5hY3RpdmUpIHtcbiAgICAgICAgICBjYXNlIGlyLk5hbWVzcGFjZS5IVE1MOlxuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5uYW1lc3BhY2VIVE1MKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5OYW1lc3BhY2UuU1ZHOlxuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5uYW1lc3BhY2VTVkcoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLk5hbWVzcGFjZS5NYXRoOlxuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5uYW1lc3BhY2VNYXRoKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlcjpcbiAgICAgICAgY29uc3QgdGltZXJTY2hlZHVsaW5nID1cbiAgICAgICAgICAgICEhb3AubG9hZGluZ01pbmltdW1UaW1lIHx8ICEhb3AubG9hZGluZ0FmdGVyVGltZSB8fCAhIW9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWU7XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5kZWZlcihcbiAgICAgICAgICAgICAgICBvcC5zbG90LnNsb3QhLCBvcC5tYWluU2xvdC5zbG90ISwgbnVsbCwgb3AubG9hZGluZ1Nsb3Q/LnNsb3QgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5wbGFjZWhvbGRlclNsb3Q/LnNsb3QhID8/IG51bGwsIG9wLmVycm9yU2xvdD8uc2xvdCA/PyBudWxsLCBvcC5sb2FkaW5nQ29uZmlnLFxuICAgICAgICAgICAgICAgIG9wLnBsYWNlaG9sZGVyQ29uZmlnLCB0aW1lclNjaGVkdWxpbmcsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlck9uOlxuICAgICAgICBsZXQgYXJnczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgc3dpdGNoIChvcC50cmlnZ2VyLmtpbmQpIHtcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZTpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyOlxuICAgICAgICAgICAgYXJncyA9IFtvcC50cmlnZ2VyLmRlbGF5XTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbjpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSG92ZXI6XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0OlxuICAgICAgICAgICAgaWYgKG9wLnRyaWdnZXIudGFyZ2V0U2xvdD8uc2xvdCA9PSBudWxsIHx8IG9wLnRyaWdnZXIudGFyZ2V0U2xvdFZpZXdTdGVwcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNsb3Qgb3IgdmlldyBzdGVwcyBub3Qgc2V0IGluIHRyaWdnZXIgcmVpZmljYXRpb24gZm9yIHRyaWdnZXIga2luZCAke1xuICAgICAgICAgICAgICAgICAgb3AudHJpZ2dlci5raW5kfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXJncyA9IFtvcC50cmlnZ2VyLnRhcmdldFNsb3Quc2xvdF07XG4gICAgICAgICAgICBpZiAob3AudHJpZ2dlci50YXJnZXRTbG90Vmlld1N0ZXBzICE9PSAwKSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChvcC50cmlnZ2VyLnRhcmdldFNsb3RWaWV3U3RlcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGRlZmVyIHRyaWdnZXIga2luZCAke1xuICAgICAgICAgICAgICAgIChvcC50cmlnZ2VyIGFzIGFueSkua2luZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZGVmZXJPbihvcC50cmlnZ2VyLmtpbmQsIGFyZ3MsIG9wLnByZWZldGNoLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvamVjdGlvbkRlZjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5wcm9qZWN0aW9uRGVmKG9wLmRlZikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb2plY3Rpb246XG4gICAgICAgIGlmIChvcC5zbG90LnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHNsb3Qgd2FzIGFzc2lnbmVkIGZvciBwcm9qZWN0IGluc3RydWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgb3AsIG5nLnByb2plY3Rpb24ob3Auc2xvdC5zbG90ISwgb3AucHJvamVjdGlvblNsb3RJbmRleCwgb3AuYXR0cmlidXRlcywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAob3Auc2xvdC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBzbG90IHdhcyBhc3NpZ25lZCBmb3IgcmVwZWF0ZXIgaW5zdHJ1Y3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlcGVhdGVyVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChyZXBlYXRlclZpZXcuZm5OYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgcmVwZWF0ZXIgcHJpbWFyeSB2aWV3IHRvIGhhdmUgYmVlbiBuYW1lZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGVtcHR5Vmlld0ZuTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICAgICAgICBsZXQgZW1wdHlEZWNsczogbnVtYmVyfG51bGwgPSBudWxsO1xuICAgICAgICBsZXQgZW1wdHlWYXJzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChvcC5lbXB0eVZpZXcgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBlbXB0eVZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AuZW1wdHlWaWV3KTtcbiAgICAgICAgICBpZiAoZW1wdHlWaWV3ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IHJlcGVhdGVyIGhhZCBlbXB0eSB2aWV3IHhyZWYsIGJ1dCBlbXB0eSB2aWV3IHdhcyBub3QgZm91bmQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVtcHR5Vmlldy5mbk5hbWUgPT09IG51bGwgfHwgZW1wdHlWaWV3LmRlY2xzID09PSBudWxsIHx8IGVtcHR5Vmlldy52YXJzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCByZXBlYXRlciBlbXB0eSB2aWV3IHRvIGhhdmUgYmVlbiBuYW1lZCBhbmQgY291bnRlZGApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbXB0eVZpZXdGbk5hbWUgPSBlbXB0eVZpZXcuZm5OYW1lO1xuICAgICAgICAgIGVtcHR5RGVjbHMgPSBlbXB0eVZpZXcuZGVjbHM7XG4gICAgICAgICAgZW1wdHlWYXJzID0gZW1wdHlWaWV3LnZhcnM7XG4gICAgICAgIH1cblxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcucmVwZWF0ZXJDcmVhdGUoXG4gICAgICAgICAgICAgICAgb3Auc2xvdC5zbG90ISwgcmVwZWF0ZXJWaWV3LmZuTmFtZSwgb3AuZGVjbHMhLCBvcC52YXJzISwgb3AudHJhY2tCeUZuISxcbiAgICAgICAgICAgICAgICBvcC51c2VzQ29tcG9uZW50SW5zdGFuY2UsIGVtcHR5Vmlld0ZuTmFtZSwgZW1wdHlEZWNscywgZW1wdHlWYXJzLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3RhdGVtZW50OlxuICAgICAgICAvLyBQYXNzIHN0YXRlbWVudCBvcGVyYXRpb25zIGRpcmVjdGx5IHRocm91Z2guXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBjcmVhdGUgb3AgJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyhfdW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkFkdmFuY2U6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5hZHZhbmNlKG9wLmRlbHRhLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcucHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc2FuaXRpemVyLFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5wcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zYW5pdGl6ZXIsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5zdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3AudW5pdCxcbiAgICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuc3R5bGVQcm9wKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnVuaXQsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmNsYXNzUHJvcChvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVNYXA6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcuc3R5bGVNYXBJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5zdHlsZU1hcChvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc01hcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5jbGFzc01hcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmNsYXNzTWFwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkV4cChvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkFwcGx5OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkFwcGx5KG9wLnRhcmdldFNsb3Quc2xvdCEsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy50ZXh0SW50ZXJwb2xhdGUoXG4gICAgICAgICAgICAgICAgb3AuaW50ZXJwb2xhdGlvbi5zdHJpbmdzLCBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgIG5nLmF0dHJpYnV0ZUludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AubmFtZSwgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zYW5pdGl6ZXIsXG4gICAgICAgICAgICAgICAgICBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmF0dHJpYnV0ZShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zYW5pdGl6ZXIpKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdub3QgeWV0IGhhbmRsZWQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAob3AuaXNBbmltYXRpb25UcmlnZ2VyKSB7XG4gICAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuc3ludGhldGljSG9zdFByb3BlcnR5KG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmhvc3RQcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIGlmIChvcC52YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5uYW1lZCB2YXJpYWJsZSAke29wLnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuVXBkYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgICAgICBvcC52YXJpYWJsZS5uYW1lLCBvcC5pbml0aWFsaXplciwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db25kaXRpb25hbDpcbiAgICAgICAgaWYgKG9wLnByb2Nlc3NlZCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29uZGl0aW9uYWwgdGVzdCB3YXMgbm90IHNldC5gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AudGFyZ2V0U2xvdC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb25kaXRpb25hbCBzbG90IHdhcyBub3Qgc2V0LmApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsIG5nLmNvbmRpdGlvbmFsKG9wLnRhcmdldFNsb3Quc2xvdCwgb3AucHJvY2Vzc2VkLCBvcC5jb250ZXh0VmFsdWUsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlcjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnJlcGVhdGVyKG9wLnRhcmdldFNsb3Quc2xvdCEsIG9wLmNvbGxlY3Rpb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdGF0ZW1lbnQ6XG4gICAgICAgIC8vIFBhc3Mgc3RhdGVtZW50IG9wZXJhdGlvbnMgZGlyZWN0bHkgdGhyb3VnaC5cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIHVwZGF0ZSBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVpZnlJckV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgIHJldHVybiBleHByO1xuICB9XG5cbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLk5leHRDb250ZXh0OlxuICAgICAgcmV0dXJuIG5nLm5leHRDb250ZXh0KGV4cHIuc3RlcHMpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVmZXJlbmNlOlxuICAgICAgcmV0dXJuIG5nLnJlZmVyZW5jZShleHByLnRhcmdldFNsb3Quc2xvdCEgKyAxICsgZXhwci5vZmZzZXQpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuTGV4aWNhbFJlYWQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bnJlc29sdmVkIExleGljYWxSZWFkIG9mICR7ZXhwci5uYW1lfWApO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVzdG9yZVZpZXc6XG4gICAgICBpZiAodHlwZW9mIGV4cHIudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5yZXNvbHZlZCBSZXN0b3JlVmlld2ApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5nLnJlc3RvcmVWaWV3KGV4cHIudmlldyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZXNldFZpZXc6XG4gICAgICByZXR1cm4gbmcucmVzZXRWaWV3KGV4cHIuZXhwcik7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5HZXRDdXJyZW50VmlldzpcbiAgICAgIHJldHVybiBuZy5nZXRDdXJyZW50VmlldygpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVhZFZhcmlhYmxlOlxuICAgICAgaWYgKGV4cHIubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlYWQgb2YgdW5uYW1lZCB2YXJpYWJsZSAke2V4cHIueHJlZn1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKGV4cHIubmFtZSk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZWFkVGVtcG9yYXJ5RXhwcjpcbiAgICAgIGlmIChleHByLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZWFkIG9mIHVubmFtZWQgdGVtcG9yYXJ5ICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkFzc2lnblRlbXBvcmFyeUV4cHI6XG4gICAgICBpZiAoZXhwci5uYW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzaWduIG9mIHVubmFtZWQgdGVtcG9yYXJ5ICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKS5zZXQoZXhwci5leHByKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICBpZiAoZXhwci5mbiA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBQdXJlRnVuY3Rpb25zIHRvIGhhdmUgYmVlbiBleHRyYWN0ZWRgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZy5wdXJlRnVuY3Rpb24oZXhwci52YXJPZmZzZXQhLCBleHByLmZuLCBleHByLmFyZ3MpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcjpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIgdG8gaGF2ZSBiZWVuIGV4dHJhY3RlZGApO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmc6XG4gICAgICByZXR1cm4gbmcucGlwZUJpbmQoZXhwci50YXJnZXRTbG90LnNsb3QhLCBleHByLnZhck9mZnNldCEsIGV4cHIuYXJncyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZ1ZhcmlhZGljOlxuICAgICAgcmV0dXJuIG5nLnBpcGVCaW5kVihleHByLnRhcmdldFNsb3Quc2xvdCEsIGV4cHIudmFyT2Zmc2V0ISwgZXhwci5hcmdzKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlNhbml0aXplckV4cHI6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKHNhbml0aXplcklkZW50aWZpZXJNYXAuZ2V0KGV4cHIuZm4pISk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5TbG90TGl0ZXJhbEV4cHI6XG4gICAgICByZXR1cm4gby5saXRlcmFsKGV4cHIuc2xvdC5zbG90ISk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGlyLkV4cHJlc3Npb24ga2luZDogJHtcbiAgICAgICAgICBpci5FeHByZXNzaW9uS2luZFsoZXhwciBhcyBpci5FeHByZXNzaW9uKS5raW5kXX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIExpc3RlbmVycyBnZXQgdHVybmVkIGludG8gYSBmdW5jdGlvbiBleHByZXNzaW9uLCB3aGljaCBtYXkgb3IgbWF5IG5vdCBoYXZlIHRoZSBgJGV2ZW50YFxuICogcGFyYW1ldGVyIGRlZmluZWQuXG4gKi9cbmZ1bmN0aW9uIHJlaWZ5TGlzdGVuZXJIYW5kbGVyKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgbmFtZTogc3RyaW5nLCBoYW5kbGVyT3BzOiBpci5PcExpc3Q8aXIuVXBkYXRlT3A+LFxuICAgIGNvbnN1bWVzRG9sbGFyRXZlbnQ6IGJvb2xlYW4pOiBvLkZ1bmN0aW9uRXhwciB7XG4gIC8vIEZpcnN0LCByZWlmeSBhbGwgaW5zdHJ1Y3Rpb24gY2FsbHMgd2l0aGluIGBoYW5kbGVyT3BzYC5cbiAgcmVpZnlVcGRhdGVPcGVyYXRpb25zKHVuaXQsIGhhbmRsZXJPcHMpO1xuXG4gIC8vIE5leHQsIGV4dHJhY3QgYWxsIHRoZSBgby5TdGF0ZW1lbnRgcyBmcm9tIHRoZSByZWlmaWVkIG9wZXJhdGlvbnMuIFdlIGNhbiBleHBlY3QgdGhhdCBhdCB0aGlzXG4gIC8vIHBvaW50LCBhbGwgb3BlcmF0aW9ucyBoYXZlIGJlZW4gY29udmVydGVkIHRvIHN0YXRlbWVudHMuXG4gIGNvbnN0IGhhbmRsZXJTdG10czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBmb3IgKGNvbnN0IG9wIG9mIGhhbmRsZXJPcHMpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgcmVpZmllZCBzdGF0ZW1lbnRzLCBidXQgZm91bmQgb3AgJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICAgIGhhbmRsZXJTdG10cy5wdXNoKG9wLnN0YXRlbWVudCk7XG4gIH1cblxuICAvLyBJZiBgJGV2ZW50YCBpcyByZWZlcmVuY2VkLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIGl0IGFzIGEgcGFyYW1ldGVyLlxuICBjb25zdCBwYXJhbXM6IG8uRm5QYXJhbVtdID0gW107XG4gIGlmIChjb25zdW1lc0RvbGxhckV2ZW50KSB7XG4gICAgLy8gV2UgbmVlZCB0aGUgYCRldmVudGAgcGFyYW1ldGVyLlxuICAgIHBhcmFtcy5wdXNoKG5ldyBvLkZuUGFyYW0oJyRldmVudCcpKTtcbiAgfVxuXG4gIHJldHVybiBvLmZuKHBhcmFtcywgaGFuZGxlclN0bXRzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbmFtZSk7XG59XG4iXX0=