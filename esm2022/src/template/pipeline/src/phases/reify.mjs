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
export function reify(job) {
    for (const unit of job.units) {
        reifyCreateOperations(unit, unit.create);
        reifyUpdateOperations(unit, unit.update);
    }
}
function reifyCreateOperations(unit, ops) {
    for (const op of ops) {
        ir.transformExpressionsInOp(op, reifyIrExpression, ir.VisitorContextFlag.None);
        switch (op.kind) {
            case ir.OpKind.Text:
                ir.OpList.replace(op, ng.text(op.handle.slot, op.initialValue, op.sourceSpan));
                break;
            case ir.OpKind.ElementStart:
                ir.OpList.replace(op, ng.elementStart(op.handle.slot, op.tag, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.Element:
                ir.OpList.replace(op, ng.element(op.handle.slot, op.tag, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.ElementEnd:
                ir.OpList.replace(op, ng.elementEnd(op.sourceSpan));
                break;
            case ir.OpKind.ContainerStart:
                ir.OpList.replace(op, ng.elementContainerStart(op.handle.slot, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.Container:
                ir.OpList.replace(op, ng.elementContainer(op.handle.slot, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.ContainerEnd:
                ir.OpList.replace(op, ng.elementContainerEnd());
                break;
            case ir.OpKind.I18nStart:
                ir.OpList.replace(op, ng.i18nStart(op.handle.slot, op.messageIndex, op.subTemplateIndex));
                break;
            case ir.OpKind.I18nEnd:
                ir.OpList.replace(op, ng.i18nEnd());
                break;
            case ir.OpKind.I18n:
                ir.OpList.replace(op, ng.i18n(op.handle.slot, op.messageIndex, op.subTemplateIndex));
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                if (Array.isArray(op.localRefs)) {
                    throw new Error(`AssertionError: local refs array should have been extracted into a constant`);
                }
                const childView = unit.job.views.get(op.xref);
                ir.OpList.replace(op, ng.template(op.handle.slot, o.variable(childView.fnName), childView.decls, childView.vars, op.tag, op.attributes, op.localRefs, op.sourceSpan));
                break;
            case ir.OpKind.DisableBindings:
                ir.OpList.replace(op, ng.disableBindings());
                break;
            case ir.OpKind.EnableBindings:
                ir.OpList.replace(op, ng.enableBindings());
                break;
            case ir.OpKind.Pipe:
                ir.OpList.replace(op, ng.pipe(op.handle.slot, op.name));
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
                ir.OpList.replace(op, ng.defer(op.handle.slot, op.mainSlot.slot, op.resolverFn, op.loadingSlot?.slot ?? null, op.placeholderSlot?.slot ?? null, op.errorSlot?.slot ?? null, op.loadingConfig, op.placeholderConfig, timerScheduling, op.sourceSpan));
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
                if (op.handle.slot === null) {
                    throw new Error('No slot was assigned for project instruction');
                }
                ir.OpList.replace(op, ng.projection(op.handle.slot, op.projectionSlotIndex, op.attributes, op.sourceSpan));
                break;
            case ir.OpKind.RepeaterCreate:
                if (op.handle.slot === null) {
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
                ir.OpList.replace(op, ng.repeaterCreate(op.handle.slot, repeaterView.fnName, op.decls, op.vars, op.tag, op.attributes, op.trackByFn, op.usesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, op.sourceSpan));
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
                ir.OpList.replace(op, ng.i18nApply(op.handle.slot, op.sourceSpan));
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
            case ir.OpKind.DeferWhen:
                ir.OpList.replace(op, ng.deferWhen(op.prefetch, op.expr, op.sourceSpan));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVpZnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZWlmeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUVyQzs7R0FFRztBQUNILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxHQUFHLENBQXNDO0lBQzFFLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLFlBQVksQ0FBQztJQUMvQyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQztJQUNyRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztJQUM3RCxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxjQUFjLENBQUM7SUFDbkQsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDO0NBQ2pHLENBQUMsQ0FBQztBQUVIOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsS0FBSyxDQUFDLEdBQW1CO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksR0FB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QUksVUFBVSxFQUFFLENBQUM7UUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FDWCw2REFBNkQsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLENBQUM7UUFDRCxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsb0VBQW9FO0lBQ3BFLE1BQU0sTUFBTSxHQUFnQixFQUFFLENBQUM7SUFDL0IsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1FBQ3hCLGtDQUFrQztRQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2hFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Vmlld0NvbXBpbGF0aW9uVW5pdCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCAqIGFzIG5nIGZyb20gJy4uL2luc3RydWN0aW9uJztcblxuLyoqXG4gKiBNYXAgb2Ygc2FuaXRpemVycyB0byB0aGVpciBpZGVudGlmaWVyLlxuICovXG5jb25zdCBzYW5pdGl6ZXJJZGVudGlmaWVyTWFwID0gbmV3IE1hcDxpci5TYW5pdGl6ZXJGbiwgby5FeHRlcm5hbFJlZmVyZW5jZT4oW1xuICBbaXIuU2FuaXRpemVyRm4uSHRtbCwgSWRlbnRpZmllcnMuc2FuaXRpemVIdG1sXSxcbiAgW2lyLlNhbml0aXplckZuLklmcmFtZUF0dHJpYnV0ZSwgSWRlbnRpZmllcnMudmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGVdLFxuICBbaXIuU2FuaXRpemVyRm4uUmVzb3VyY2VVcmwsIElkZW50aWZpZXJzLnNhbml0aXplUmVzb3VyY2VVcmxdLFxuICBbaXIuU2FuaXRpemVyRm4uU2NyaXB0LCBJZGVudGlmaWVycy5zYW5pdGl6ZVNjcmlwdF0sXG4gIFtpci5TYW5pdGl6ZXJGbi5TdHlsZSwgSWRlbnRpZmllcnMuc2FuaXRpemVTdHlsZV0sIFtpci5TYW5pdGl6ZXJGbi5VcmwsIElkZW50aWZpZXJzLnNhbml0aXplVXJsXVxuXSk7XG5cbi8qKlxuICogQ29tcGlsZXMgc2VtYW50aWMgb3BlcmF0aW9ucyBhY3Jvc3MgYWxsIHZpZXdzIGFuZCBnZW5lcmF0ZXMgb3V0cHV0IGBvLlN0YXRlbWVudGBzIHdpdGggYWN0dWFsXG4gKiBydW50aW1lIGNhbGxzIGluIHRoZWlyIHBsYWNlLlxuICpcbiAqIFJlaWZpY2F0aW9uIHJlcGxhY2VzIHNlbWFudGljIG9wZXJhdGlvbnMgd2l0aCBzZWxlY3RlZCBJdnkgaW5zdHJ1Y3Rpb25zIGFuZCBvdGhlciBnZW5lcmF0ZWQgY29kZVxuICogc3RydWN0dXJlcy4gQWZ0ZXIgcmVpZmljYXRpb24sIHRoZSBjcmVhdGUvdXBkYXRlIG9wZXJhdGlvbiBsaXN0cyBvZiBhbGwgdmlld3Mgc2hvdWxkIG9ubHkgY29udGFpblxuICogYGlyLlN0YXRlbWVudE9wYHMgKHdoaWNoIHdyYXAgZ2VuZXJhdGVkIGBvLlN0YXRlbWVudGBzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlaWZ5KGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIHJlaWZ5Q3JlYXRlT3BlcmF0aW9ucyh1bml0LCB1bml0LmNyZWF0ZSk7XG4gICAgcmVpZnlVcGRhdGVPcGVyYXRpb25zKHVuaXQsIHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWlmeUNyZWF0ZU9wZXJhdGlvbnModW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy50ZXh0KG9wLmhhbmRsZS5zbG90ISwgb3AuaW5pdGlhbFZhbHVlLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudFN0YXJ0KFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AudGFnISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLFxuICAgICAgICAgICAgICAgIG9wLmxvY2FsUmVmcyBhcyBudW1iZXIgfCBudWxsLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmVsZW1lbnQoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvcC50YWchLCBvcC5hdHRyaWJ1dGVzIGFzIG51bWJlciB8IG51bGwsXG4gICAgICAgICAgICAgICAgb3AubG9jYWxSZWZzIGFzIG51bWJlciB8IG51bGwsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50RW5kOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZWxlbWVudEVuZChvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ29udGFpbmVyU3RhcnQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50Q29udGFpbmVyU3RhcnQoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvcC5hdHRyaWJ1dGVzIGFzIG51bWJlciB8IG51bGwsIG9wLmxvY2FsUmVmcyBhcyBudW1iZXIgfCBudWxsLFxuICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXI6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50Q29udGFpbmVyKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ29udGFpbmVyRW5kOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZWxlbWVudENvbnRhaW5lckVuZCgpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsIG5nLmkxOG5TdGFydChvcC5oYW5kbGUuc2xvdCEsIG9wLm1lc3NhZ2VJbmRleCEsIG9wLnN1YlRlbXBsYXRlSW5kZXghKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG5FbmQoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG4ob3AuaGFuZGxlLnNsb3QhLCBvcC5tZXNzYWdlSW5kZXghLCBvcC5zdWJUZW1wbGF0ZUluZGV4ISkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KG9wLmxvY2FsUmVmcykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogbG9jYWwgcmVmcyBhcnJheSBzaG91bGQgaGF2ZSBiZWVuIGV4dHJhY3RlZCBpbnRvIGEgY29uc3RhbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcudGVtcGxhdGUoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvLnZhcmlhYmxlKGNoaWxkVmlldy5mbk5hbWUhKSwgY2hpbGRWaWV3LmRlY2xzISwgY2hpbGRWaWV3LnZhcnMhLFxuICAgICAgICAgICAgICAgIG9wLnRhZywgb3AuYXR0cmlidXRlcywgb3AubG9jYWxSZWZzLCBvcC5zb3VyY2VTcGFuKSxcbiAgICAgICAgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EaXNhYmxlQmluZGluZ3M6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5kaXNhYmxlQmluZGluZ3MoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRW5hYmxlQmluZGluZ3M6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbmFibGVCaW5kaW5ncygpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5QaXBlOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcucGlwZShvcC5oYW5kbGUuc2xvdCEsIG9wLm5hbWUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgY29uc3QgbGlzdGVuZXJGbiA9XG4gICAgICAgICAgICByZWlmeUxpc3RlbmVySGFuZGxlcih1bml0LCBvcC5oYW5kbGVyRm5OYW1lISwgb3AuaGFuZGxlck9wcywgb3AuY29uc3VtZXNEb2xsYXJFdmVudCk7XG4gICAgICAgIGNvbnN0IHJlaWZpZWQgPSBvcC5ob3N0TGlzdGVuZXIgJiYgb3AuaXNBbmltYXRpb25MaXN0ZW5lciA/XG4gICAgICAgICAgICBuZy5zeW50aGV0aWNIb3N0TGlzdGVuZXIob3AubmFtZSwgbGlzdGVuZXJGbiwgb3Auc291cmNlU3BhbikgOlxuICAgICAgICAgICAgbmcubGlzdGVuZXIob3AubmFtZSwgbGlzdGVuZXJGbiwgb3Auc291cmNlU3Bhbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCByZWlmaWVkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgaWYgKG9wLnZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bm5hbWVkIHZhcmlhYmxlICR7b3AueHJlZn1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLkRlY2xhcmVWYXJTdG10KFxuICAgICAgICAgICAgICAgIG9wLnZhcmlhYmxlLm5hbWUsIG9wLmluaXRpYWxpemVyLCB1bmRlZmluZWQsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLk5hbWVzcGFjZTpcbiAgICAgICAgc3dpdGNoIChvcC5hY3RpdmUpIHtcbiAgICAgICAgICBjYXNlIGlyLk5hbWVzcGFjZS5IVE1MOlxuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5uYW1lc3BhY2VIVE1MKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5OYW1lc3BhY2UuU1ZHOlxuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5uYW1lc3BhY2VTVkcoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLk5hbWVzcGFjZS5NYXRoOlxuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5uYW1lc3BhY2VNYXRoKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlcjpcbiAgICAgICAgY29uc3QgdGltZXJTY2hlZHVsaW5nID1cbiAgICAgICAgICAgICEhb3AubG9hZGluZ01pbmltdW1UaW1lIHx8ICEhb3AubG9hZGluZ0FmdGVyVGltZSB8fCAhIW9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWU7XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5kZWZlcihcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCEsIG9wLm1haW5TbG90LnNsb3QhLCBvcC5yZXNvbHZlckZuLCBvcC5sb2FkaW5nU2xvdD8uc2xvdCA/PyBudWxsLFxuICAgICAgICAgICAgICAgIG9wLnBsYWNlaG9sZGVyU2xvdD8uc2xvdCEgPz8gbnVsbCwgb3AuZXJyb3JTbG90Py5zbG90ID8/IG51bGwsIG9wLmxvYWRpbmdDb25maWcsXG4gICAgICAgICAgICAgICAgb3AucGxhY2Vob2xkZXJDb25maWcsIHRpbWVyU2NoZWR1bGluZywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkRlZmVyT246XG4gICAgICAgIGxldCBhcmdzOiBudW1iZXJbXSA9IFtdO1xuICAgICAgICBzd2l0Y2ggKG9wLnRyaWdnZXIua2luZCkge1xuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlOlxuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGU6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuVGltZXI6XG4gICAgICAgICAgICBhcmdzID0gW29wLnRyaWdnZXIuZGVsYXldO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLkludGVyYWN0aW9uOlxuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcjpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuVmlld3BvcnQ6XG4gICAgICAgICAgICBpZiAob3AudHJpZ2dlci50YXJnZXRTbG90Py5zbG90ID09IG51bGwgfHwgb3AudHJpZ2dlci50YXJnZXRTbG90Vmlld1N0ZXBzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2xvdCBvciB2aWV3IHN0ZXBzIG5vdCBzZXQgaW4gdHJpZ2dlciByZWlmaWNhdGlvbiBmb3IgdHJpZ2dlciBraW5kICR7XG4gICAgICAgICAgICAgICAgICBvcC50cmlnZ2VyLmtpbmR9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhcmdzID0gW29wLnRyaWdnZXIudGFyZ2V0U2xvdC5zbG90XTtcbiAgICAgICAgICAgIGlmIChvcC50cmlnZ2VyLnRhcmdldFNsb3RWaWV3U3RlcHMgIT09IDApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG9wLnRyaWdnZXIudGFyZ2V0U2xvdFZpZXdTdGVwcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogVW5zdXBwb3J0ZWQgcmVpZmljYXRpb24gb2YgZGVmZXIgdHJpZ2dlciBraW5kICR7XG4gICAgICAgICAgICAgICAgKG9wLnRyaWdnZXIgYXMgYW55KS5raW5kfWApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5kZWZlck9uKG9wLnRyaWdnZXIua2luZCwgYXJncywgb3AucHJlZmV0Y2gsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9qZWN0aW9uRGVmOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4ob3AsIG5nLnByb2plY3Rpb25EZWYob3AuZGVmKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvamVjdGlvbjpcbiAgICAgICAgaWYgKG9wLmhhbmRsZS5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBzbG90IHdhcyBhc3NpZ25lZCBmb3IgcHJvamVjdCBpbnN0cnVjdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcucHJvamVjdGlvbihvcC5oYW5kbGUuc2xvdCEsIG9wLnByb2plY3Rpb25TbG90SW5kZXgsIG9wLmF0dHJpYnV0ZXMsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZTpcbiAgICAgICAgaWYgKG9wLmhhbmRsZS5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBzbG90IHdhcyBhc3NpZ25lZCBmb3IgcmVwZWF0ZXIgaW5zdHJ1Y3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoISh1bml0IGluc3RhbmNlb2YgVmlld0NvbXBpbGF0aW9uVW5pdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBtdXN0IGJlIGNvbXBpbGluZyBhIGNvbXBvbmVudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlcGVhdGVyVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChyZXBlYXRlclZpZXcuZm5OYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgcmVwZWF0ZXIgcHJpbWFyeSB2aWV3IHRvIGhhdmUgYmVlbiBuYW1lZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGVtcHR5Vmlld0ZuTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICAgICAgICBsZXQgZW1wdHlEZWNsczogbnVtYmVyfG51bGwgPSBudWxsO1xuICAgICAgICBsZXQgZW1wdHlWYXJzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChvcC5lbXB0eVZpZXcgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBlbXB0eVZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AuZW1wdHlWaWV3KTtcbiAgICAgICAgICBpZiAoZW1wdHlWaWV3ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IHJlcGVhdGVyIGhhZCBlbXB0eSB2aWV3IHhyZWYsIGJ1dCBlbXB0eSB2aWV3IHdhcyBub3QgZm91bmQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVtcHR5Vmlldy5mbk5hbWUgPT09IG51bGwgfHwgZW1wdHlWaWV3LmRlY2xzID09PSBudWxsIHx8IGVtcHR5Vmlldy52YXJzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCByZXBlYXRlciBlbXB0eSB2aWV3IHRvIGhhdmUgYmVlbiBuYW1lZCBhbmQgY291bnRlZGApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbXB0eVZpZXdGbk5hbWUgPSBlbXB0eVZpZXcuZm5OYW1lO1xuICAgICAgICAgIGVtcHR5RGVjbHMgPSBlbXB0eVZpZXcuZGVjbHM7XG4gICAgICAgICAgZW1wdHlWYXJzID0gZW1wdHlWaWV3LnZhcnM7XG4gICAgICAgIH1cblxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcucmVwZWF0ZXJDcmVhdGUoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QsIHJlcGVhdGVyVmlldy5mbk5hbWUsIG9wLmRlY2xzISwgb3AudmFycyEsIG9wLnRhZywgb3AuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICBvcC50cmFja0J5Rm4hLCBvcC51c2VzQ29tcG9uZW50SW5zdGFuY2UsIGVtcHR5Vmlld0ZuTmFtZSwgZW1wdHlEZWNscywgZW1wdHlWYXJzLFxuICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdGF0ZW1lbnQ6XG4gICAgICAgIC8vIFBhc3Mgc3RhdGVtZW50IG9wZXJhdGlvbnMgZGlyZWN0bHkgdGhyb3VnaC5cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGNyZWF0ZSBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVpZnlVcGRhdGVPcGVyYXRpb25zKF91bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPik6IHZvaWQge1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgcmVpZnlJckV4cHJlc3Npb24sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuQWR2YW5jZTpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmFkdmFuY2Uob3AuZGVsdGEsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5wcm9wZXJ0eUludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AubmFtZSwgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zYW5pdGl6ZXIsXG4gICAgICAgICAgICAgICAgICBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnByb3BlcnR5KG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNhbml0aXplciwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgIG5nLnN0eWxlUHJvcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AubmFtZSwgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC51bml0LFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5zdHlsZVByb3Aob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3AudW5pdCwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuY2xhc3NQcm9wKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdHlsZU1hcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5zdHlsZU1hcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnN0eWxlTWFwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzTWFwOlxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgIG5nLmNsYXNzTWFwSW50ZXJwb2xhdGUoXG4gICAgICAgICAgICAgICAgICBvcC5leHByZXNzaW9uLnN0cmluZ3MsIG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuY2xhc3NNYXAob3AuZXhwcmVzc2lvbiwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb246XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5pMThuRXhwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuQXBwbHk6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5pMThuQXBwbHkob3AuaGFuZGxlLnNsb3QhLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcudGV4dEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgIG9wLmludGVycG9sYXRpb24uc3RyaW5ncywgb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9ucywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc2FuaXRpemVyLFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5hdHRyaWJ1dGUob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3Auc2FuaXRpemVyKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbm90IHlldCBoYW5kbGVkJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKG9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5ob3N0UHJvcGVydHkob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICBpZiAob3AudmFyaWFibGUubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVubmFtZWQgdmFyaWFibGUgJHtvcC54cmVmfWApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLlVwZGF0ZU9wPihcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uRGVjbGFyZVZhclN0bXQoXG4gICAgICAgICAgICAgICAgb3AudmFyaWFibGUubmFtZSwgb3AuaW5pdGlhbGl6ZXIsIHVuZGVmaW5lZCwgby5TdG10TW9kaWZpZXIuRmluYWwpKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ29uZGl0aW9uYWw6XG4gICAgICAgIGlmIChvcC5wcm9jZXNzZWQgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbmRpdGlvbmFsIHRlc3Qgd2FzIG5vdCBzZXQuYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLnRhcmdldFNsb3Quc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29uZGl0aW9uYWwgc2xvdCB3YXMgbm90IHNldC5gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLCBuZy5jb25kaXRpb25hbChvcC50YXJnZXRTbG90LnNsb3QsIG9wLnByb2Nlc3NlZCwgb3AuY29udGV4dFZhbHVlLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUmVwZWF0ZXI6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5yZXBlYXRlcihvcC50YXJnZXRTbG90LnNsb3QhLCBvcC5jb2xsZWN0aW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRGVmZXJXaGVuOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZGVmZXJXaGVuKG9wLnByZWZldGNoLCBvcC5leHByLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3RhdGVtZW50OlxuICAgICAgICAvLyBQYXNzIHN0YXRlbWVudCBvcGVyYXRpb25zIGRpcmVjdGx5IHRocm91Z2guXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiB1cGRhdGUgb3AgJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlaWZ5SXJFeHByZXNzaW9uKGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxuXG4gIHN3aXRjaCAoZXhwci5raW5kKSB7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5OZXh0Q29udGV4dDpcbiAgICAgIHJldHVybiBuZy5uZXh0Q29udGV4dChleHByLnN0ZXBzKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlZmVyZW5jZTpcbiAgICAgIHJldHVybiBuZy5yZWZlcmVuY2UoZXhwci50YXJnZXRTbG90LnNsb3QhICsgMSArIGV4cHIub2Zmc2V0KTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkxleGljYWxSZWFkOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5yZXNvbHZlZCBMZXhpY2FsUmVhZCBvZiAke2V4cHIubmFtZX1gKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlc3RvcmVWaWV3OlxuICAgICAgaWYgKHR5cGVvZiBleHByLnZpZXcgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVucmVzb2x2ZWQgUmVzdG9yZVZpZXdgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZy5yZXN0b3JlVmlldyhleHByLnZpZXcpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVzZXRWaWV3OlxuICAgICAgcmV0dXJuIG5nLnJlc2V0VmlldyhleHByLmV4cHIpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuR2V0Q3VycmVudFZpZXc6XG4gICAgICByZXR1cm4gbmcuZ2V0Q3VycmVudFZpZXcoKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlYWRWYXJpYWJsZTpcbiAgICAgIGlmIChleHByLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZWFkIG9mIHVubmFtZWQgdmFyaWFibGUgJHtleHByLnhyZWZ9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gby52YXJpYWJsZShleHByLm5hbWUpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVhZFRlbXBvcmFyeUV4cHI6XG4gICAgICBpZiAoZXhwci5uYW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVhZCBvZiB1bm5hbWVkIHRlbXBvcmFyeSAke2V4cHIueHJlZn1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKGV4cHIubmFtZSk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5Bc3NpZ25UZW1wb3JhcnlFeHByOlxuICAgICAgaWYgKGV4cHIubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2lnbiBvZiB1bm5hbWVkIHRlbXBvcmFyeSAke2V4cHIueHJlZn1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKGV4cHIubmFtZSkuc2V0KGV4cHIuZXhwcik7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25FeHByOlxuICAgICAgaWYgKGV4cHIuZm4gPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgUHVyZUZ1bmN0aW9ucyB0byBoYXZlIGJlZW4gZXh0cmFjdGVkYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmcucHVyZUZ1bmN0aW9uKGV4cHIudmFyT2Zmc2V0ISwgZXhwci5mbiwgZXhwci5hcmdzKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHI6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByIHRvIGhhdmUgYmVlbiBleHRyYWN0ZWRgKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nOlxuICAgICAgcmV0dXJuIG5nLnBpcGVCaW5kKGV4cHIudGFyZ2V0U2xvdC5zbG90ISwgZXhwci52YXJPZmZzZXQhLCBleHByLmFyZ3MpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmdWYXJpYWRpYzpcbiAgICAgIHJldHVybiBuZy5waXBlQmluZFYoZXhwci50YXJnZXRTbG90LnNsb3QhLCBleHByLnZhck9mZnNldCEsIGV4cHIuYXJncyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5TYW5pdGl6ZXJFeHByOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihzYW5pdGl6ZXJJZGVudGlmaWVyTWFwLmdldChleHByLmZuKSEpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuU2xvdExpdGVyYWxFeHByOlxuICAgICAgcmV0dXJuIG8ubGl0ZXJhbChleHByLnNsb3Quc2xvdCEpO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBpci5FeHByZXNzaW9uIGtpbmQ6ICR7XG4gICAgICAgICAgaXIuRXhwcmVzc2lvbktpbmRbKGV4cHIgYXMgaXIuRXhwcmVzc2lvbikua2luZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBMaXN0ZW5lcnMgZ2V0IHR1cm5lZCBpbnRvIGEgZnVuY3Rpb24gZXhwcmVzc2lvbiwgd2hpY2ggbWF5IG9yIG1heSBub3QgaGF2ZSB0aGUgYCRldmVudGBcbiAqIHBhcmFtZXRlciBkZWZpbmVkLlxuICovXG5mdW5jdGlvbiByZWlmeUxpc3RlbmVySGFuZGxlcihcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG5hbWU6IHN0cmluZywgaGFuZGxlck9wczogaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPixcbiAgICBjb25zdW1lc0RvbGxhckV2ZW50OiBib29sZWFuKTogby5GdW5jdGlvbkV4cHIge1xuICAvLyBGaXJzdCwgcmVpZnkgYWxsIGluc3RydWN0aW9uIGNhbGxzIHdpdGhpbiBgaGFuZGxlck9wc2AuXG4gIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyh1bml0LCBoYW5kbGVyT3BzKTtcblxuICAvLyBOZXh0LCBleHRyYWN0IGFsbCB0aGUgYG8uU3RhdGVtZW50YHMgZnJvbSB0aGUgcmVpZmllZCBvcGVyYXRpb25zLiBXZSBjYW4gZXhwZWN0IHRoYXQgYXQgdGhpc1xuICAvLyBwb2ludCwgYWxsIG9wZXJhdGlvbnMgaGF2ZSBiZWVuIGNvbnZlcnRlZCB0byBzdGF0ZW1lbnRzLlxuICBjb25zdCBoYW5kbGVyU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZm9yIChjb25zdCBvcCBvZiBoYW5kbGVyT3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5TdGF0ZW1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHJlaWZpZWQgc3RhdGVtZW50cywgYnV0IGZvdW5kIG9wICR7aXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICBoYW5kbGVyU3RtdHMucHVzaChvcC5zdGF0ZW1lbnQpO1xuICB9XG5cbiAgLy8gSWYgYCRldmVudGAgaXMgcmVmZXJlbmNlZCwgd2UgbmVlZCB0byBnZW5lcmF0ZSBpdCBhcyBhIHBhcmFtZXRlci5cbiAgY29uc3QgcGFyYW1zOiBvLkZuUGFyYW1bXSA9IFtdO1xuICBpZiAoY29uc3VtZXNEb2xsYXJFdmVudCkge1xuICAgIC8vIFdlIG5lZWQgdGhlIGAkZXZlbnRgIHBhcmFtZXRlci5cbiAgICBwYXJhbXMucHVzaChuZXcgby5GblBhcmFtKCckZXZlbnQnKSk7XG4gIH1cblxuICByZXR1cm4gby5mbihwYXJhbXMsIGhhbmRsZXJTdG10cywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIG5hbWUpO1xufVxuIl19