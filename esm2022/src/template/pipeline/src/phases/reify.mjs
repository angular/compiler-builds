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
 * Map of target resolvers for event listeners.
 */
const GLOBAL_TARGET_RESOLVERS = new Map([
    ['window', Identifiers.resolveWindow],
    ['document', Identifiers.resolveDocument],
    ['body', Identifiers.resolveBody],
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
                ir.OpList.replace(op, ng.elementStart(op.handle.slot, op.tag, op.attributes, op.localRefs, op.startSourceSpan));
                break;
            case ir.OpKind.Element:
                ir.OpList.replace(op, ng.element(op.handle.slot, op.tag, op.attributes, op.localRefs, op.wholeSourceSpan));
                break;
            case ir.OpKind.ElementEnd:
                ir.OpList.replace(op, ng.elementEnd(op.sourceSpan));
                break;
            case ir.OpKind.ContainerStart:
                ir.OpList.replace(op, ng.elementContainerStart(op.handle.slot, op.attributes, op.localRefs, op.startSourceSpan));
                break;
            case ir.OpKind.Container:
                ir.OpList.replace(op, ng.elementContainer(op.handle.slot, op.attributes, op.localRefs, op.wholeSourceSpan));
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
            case ir.OpKind.I18nAttributes:
                if (op.i18nAttributesConfig === null) {
                    throw new Error(`AssertionError: i18nAttributesConfig was not set`);
                }
                ir.OpList.replace(op, ng.i18nAttributes(op.handle.slot, op.i18nAttributesConfig));
                break;
            case ir.OpKind.Template:
                if (!(unit instanceof ViewCompilationUnit)) {
                    throw new Error(`AssertionError: must be compiling a component`);
                }
                if (Array.isArray(op.localRefs)) {
                    throw new Error(`AssertionError: local refs array should have been extracted into a constant`);
                }
                const childView = unit.job.views.get(op.xref);
                ir.OpList.replace(op, ng.template(op.handle.slot, o.variable(childView.fnName), childView.decls, childView.vars, op.tag, op.attributes, op.localRefs, op.startSourceSpan));
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
                const eventTargetResolver = op.eventTarget ? GLOBAL_TARGET_RESOLVERS.get(op.eventTarget) : null;
                if (eventTargetResolver === undefined) {
                    throw new Error(`Unexpected global target '${op.eventTarget}' defined for '${op.name}' event. Supported list of global targets: window,document,body.`);
                }
                ir.OpList.replace(op, ng.listener(op.name, listenerFn, eventTargetResolver, op.hostListener && op.isAnimationListener, op.sourceSpan));
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
                ir.OpList.replace(op, ng.repeaterCreate(op.handle.slot, repeaterView.fnName, op.decls, op.vars, op.tag, op.attributes, op.trackByFn, op.usesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, op.wholeSourceSpan));
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
                        ir.OpList.replace(op, ng.hostProperty(op.name, op.expression, op.sanitizer, op.sourceSpan));
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
                ir.OpList.replace(op, ng.repeater(op.collection, op.sourceSpan));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVpZnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZWlmeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUVyQzs7R0FFRztBQUNILE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxHQUFHLENBQThCO0lBQ25FLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxhQUFhLENBQUM7SUFDckMsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLGVBQWUsQ0FBQztJQUN6QyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDO0NBQ2xDLENBQUMsQ0FBQztBQUVIOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsS0FBSyxDQUFDLEdBQW1CO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pDLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDMUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxJQUFxQixFQUFFLEdBQTJCO0lBQy9FLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFO1FBQ3BCLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFF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QUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNoRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge1ZpZXdDb21waWxhdGlvblVuaXQsIHR5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQgKiBhcyBuZyBmcm9tICcuLi9pbnN0cnVjdGlvbic7XG5cbi8qKlxuICogTWFwIG9mIHRhcmdldCByZXNvbHZlcnMgZm9yIGV2ZW50IGxpc3RlbmVycy5cbiAqL1xuY29uc3QgR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMgPSBuZXcgTWFwPHN0cmluZywgby5FeHRlcm5hbFJlZmVyZW5jZT4oW1xuICBbJ3dpbmRvdycsIElkZW50aWZpZXJzLnJlc29sdmVXaW5kb3ddLFxuICBbJ2RvY3VtZW50JywgSWRlbnRpZmllcnMucmVzb2x2ZURvY3VtZW50XSxcbiAgWydib2R5JywgSWRlbnRpZmllcnMucmVzb2x2ZUJvZHldLFxuXSk7XG5cbi8qKlxuICogQ29tcGlsZXMgc2VtYW50aWMgb3BlcmF0aW9ucyBhY3Jvc3MgYWxsIHZpZXdzIGFuZCBnZW5lcmF0ZXMgb3V0cHV0IGBvLlN0YXRlbWVudGBzIHdpdGggYWN0dWFsXG4gKiBydW50aW1lIGNhbGxzIGluIHRoZWlyIHBsYWNlLlxuICpcbiAqIFJlaWZpY2F0aW9uIHJlcGxhY2VzIHNlbWFudGljIG9wZXJhdGlvbnMgd2l0aCBzZWxlY3RlZCBJdnkgaW5zdHJ1Y3Rpb25zIGFuZCBvdGhlciBnZW5lcmF0ZWQgY29kZVxuICogc3RydWN0dXJlcy4gQWZ0ZXIgcmVpZmljYXRpb24sIHRoZSBjcmVhdGUvdXBkYXRlIG9wZXJhdGlvbiBsaXN0cyBvZiBhbGwgdmlld3Mgc2hvdWxkIG9ubHkgY29udGFpblxuICogYGlyLlN0YXRlbWVudE9wYHMgKHdoaWNoIHdyYXAgZ2VuZXJhdGVkIGBvLlN0YXRlbWVudGBzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlaWZ5KGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIHJlaWZ5Q3JlYXRlT3BlcmF0aW9ucyh1bml0LCB1bml0LmNyZWF0ZSk7XG4gICAgcmVpZnlVcGRhdGVPcGVyYXRpb25zKHVuaXQsIHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWlmeUNyZWF0ZU9wZXJhdGlvbnModW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy50ZXh0KG9wLmhhbmRsZS5zbG90ISwgb3AuaW5pdGlhbFZhbHVlLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudFN0YXJ0KFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AudGFnISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLFxuICAgICAgICAgICAgICAgIG9wLmxvY2FsUmVmcyBhcyBudW1iZXIgfCBudWxsLCBvcC5zdGFydFNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudChcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCEsIG9wLnRhZyEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCwgb3Aud2hvbGVTb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmVsZW1lbnRFbmQob3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNvbnRhaW5lclN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudENvbnRhaW5lclN0YXJ0KFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5zdGFydFNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXI6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50Q29udGFpbmVyKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC53aG9sZVNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJFbmQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbGVtZW50Q29udGFpbmVyRW5kKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCwgbmcuaTE4blN0YXJ0KG9wLmhhbmRsZS5zbG90ISwgb3AubWVzc2FnZUluZGV4ISwgb3Auc3ViVGVtcGxhdGVJbmRleCEpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkVuZCgpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bihvcC5oYW5kbGUuc2xvdCEsIG9wLm1lc3NhZ2VJbmRleCEsIG9wLnN1YlRlbXBsYXRlSW5kZXghKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkF0dHJpYnV0ZXM6XG4gICAgICAgIGlmIChvcC5pMThuQXR0cmlidXRlc0NvbmZpZyA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGkxOG5BdHRyaWJ1dGVzQ29uZmlnIHdhcyBub3Qgc2V0YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG5BdHRyaWJ1dGVzKG9wLmhhbmRsZS5zbG90ISwgb3AuaTE4bkF0dHJpYnV0ZXNDb25maWcpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvcC5sb2NhbFJlZnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGxvY2FsIHJlZnMgYXJyYXkgc2hvdWxkIGhhdmUgYmVlbiBleHRyYWN0ZWQgaW50byBhIGNvbnN0YW50YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnRlbXBsYXRlKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgby52YXJpYWJsZShjaGlsZFZpZXcuZm5OYW1lISksIGNoaWxkVmlldy5kZWNscyEsIGNoaWxkVmlldy52YXJzISxcbiAgICAgICAgICAgICAgICBvcC50YWcsIG9wLmF0dHJpYnV0ZXMsIG9wLmxvY2FsUmVmcywgb3Auc3RhcnRTb3VyY2VTcGFuKSxcbiAgICAgICAgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EaXNhYmxlQmluZGluZ3M6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5kaXNhYmxlQmluZGluZ3MoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRW5hYmxlQmluZGluZ3M6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbmFibGVCaW5kaW5ncygpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5QaXBlOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcucGlwZShvcC5oYW5kbGUuc2xvdCEsIG9wLm5hbWUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgY29uc3QgbGlzdGVuZXJGbiA9XG4gICAgICAgICAgICByZWlmeUxpc3RlbmVySGFuZGxlcih1bml0LCBvcC5oYW5kbGVyRm5OYW1lISwgb3AuaGFuZGxlck9wcywgb3AuY29uc3VtZXNEb2xsYXJFdmVudCk7XG4gICAgICAgIGNvbnN0IGV2ZW50VGFyZ2V0UmVzb2x2ZXIgPVxuICAgICAgICAgICAgb3AuZXZlbnRUYXJnZXQgPyBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5nZXQob3AuZXZlbnRUYXJnZXQpIDogbnVsbDtcbiAgICAgICAgaWYgKGV2ZW50VGFyZ2V0UmVzb2x2ZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBnbG9iYWwgdGFyZ2V0ICcke29wLmV2ZW50VGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7XG4gICAgICAgICAgICAgIG9wLm5hbWV9JyBldmVudC4gU3VwcG9ydGVkIGxpc3Qgb2YgZ2xvYmFsIHRhcmdldHM6IHdpbmRvdyxkb2N1bWVudCxib2R5LmApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5saXN0ZW5lcihcbiAgICAgICAgICAgICAgICBvcC5uYW1lLCBsaXN0ZW5lckZuLCBldmVudFRhcmdldFJlc29sdmVyLCBvcC5ob3N0TGlzdGVuZXIgJiYgb3AuaXNBbmltYXRpb25MaXN0ZW5lcixcbiAgICAgICAgICAgICAgICBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIGlmIChvcC52YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5uYW1lZCB2YXJpYWJsZSAke29wLnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgICAgICBvcC52YXJpYWJsZS5uYW1lLCBvcC5pbml0aWFsaXplciwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5OYW1lc3BhY2U6XG4gICAgICAgIHN3aXRjaCAob3AuYWN0aXZlKSB7XG4gICAgICAgICAgY2FzZSBpci5OYW1lc3BhY2UuSFRNTDpcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcubmFtZXNwYWNlSFRNTCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuTmFtZXNwYWNlLlNWRzpcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcubmFtZXNwYWNlU1ZHKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5OYW1lc3BhY2UuTWF0aDpcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcubmFtZXNwYWNlTWF0aCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRGVmZXI6XG4gICAgICAgIGNvbnN0IHRpbWVyU2NoZWR1bGluZyA9XG4gICAgICAgICAgICAhIW9wLmxvYWRpbmdNaW5pbXVtVGltZSB8fCAhIW9wLmxvYWRpbmdBZnRlclRpbWUgfHwgISFvcC5wbGFjZWhvbGRlck1pbmltdW1UaW1lO1xuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZGVmZXIoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvcC5tYWluU2xvdC5zbG90ISwgb3AucmVzb2x2ZXJGbiwgb3AubG9hZGluZ1Nsb3Q/LnNsb3QgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5wbGFjZWhvbGRlclNsb3Q/LnNsb3QhID8/IG51bGwsIG9wLmVycm9yU2xvdD8uc2xvdCA/PyBudWxsLCBvcC5sb2FkaW5nQ29uZmlnLFxuICAgICAgICAgICAgICAgIG9wLnBsYWNlaG9sZGVyQ29uZmlnLCB0aW1lclNjaGVkdWxpbmcsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlck9uOlxuICAgICAgICBsZXQgYXJnczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgc3dpdGNoIChvcC50cmlnZ2VyLmtpbmQpIHtcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZTpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyOlxuICAgICAgICAgICAgYXJncyA9IFtvcC50cmlnZ2VyLmRlbGF5XTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbjpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSG92ZXI6XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0OlxuICAgICAgICAgICAgaWYgKG9wLnRyaWdnZXIudGFyZ2V0U2xvdD8uc2xvdCA9PSBudWxsIHx8IG9wLnRyaWdnZXIudGFyZ2V0U2xvdFZpZXdTdGVwcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNsb3Qgb3IgdmlldyBzdGVwcyBub3Qgc2V0IGluIHRyaWdnZXIgcmVpZmljYXRpb24gZm9yIHRyaWdnZXIga2luZCAke1xuICAgICAgICAgICAgICAgICAgb3AudHJpZ2dlci5raW5kfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXJncyA9IFtvcC50cmlnZ2VyLnRhcmdldFNsb3Quc2xvdF07XG4gICAgICAgICAgICBpZiAob3AudHJpZ2dlci50YXJnZXRTbG90Vmlld1N0ZXBzICE9PSAwKSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChvcC50cmlnZ2VyLnRhcmdldFNsb3RWaWV3U3RlcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGRlZmVyIHRyaWdnZXIga2luZCAke1xuICAgICAgICAgICAgICAgIChvcC50cmlnZ2VyIGFzIGFueSkua2luZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZGVmZXJPbihvcC50cmlnZ2VyLmtpbmQsIGFyZ3MsIG9wLnByZWZldGNoLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvamVjdGlvbkRlZjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5wcm9qZWN0aW9uRGVmKG9wLmRlZikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb2plY3Rpb246XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gc2xvdCB3YXMgYXNzaWduZWQgZm9yIHByb2plY3QgaW5zdHJ1Y3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnByb2plY3Rpb24ob3AuaGFuZGxlLnNsb3QhLCBvcC5wcm9qZWN0aW9uU2xvdEluZGV4LCBvcC5hdHRyaWJ1dGVzLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGU6XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gc2xvdCB3YXMgYXNzaWduZWQgZm9yIHJlcGVhdGVyIGluc3RydWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXBlYXRlclZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAocmVwZWF0ZXJWaWV3LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHJlcGVhdGVyIHByaW1hcnkgdmlldyB0byBoYXZlIGJlZW4gbmFtZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBlbXB0eVZpZXdGbk5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICAgICAgbGV0IGVtcHR5RGVjbHM6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICAgICAgbGV0IGVtcHR5VmFyczogbnVtYmVyfG51bGwgPSBudWxsO1xuICAgICAgICBpZiAob3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgZW1wdHlWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLmVtcHR5Vmlldyk7XG4gICAgICAgICAgaWYgKGVtcHR5VmlldyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiByZXBlYXRlciBoYWQgZW1wdHkgdmlldyB4cmVmLCBidXQgZW1wdHkgdmlldyB3YXMgbm90IGZvdW5kJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChlbXB0eVZpZXcuZm5OYW1lID09PSBudWxsIHx8IGVtcHR5Vmlldy5kZWNscyA9PT0gbnVsbCB8fCBlbXB0eVZpZXcudmFycyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgcmVwZWF0ZXIgZW1wdHkgdmlldyB0byBoYXZlIGJlZW4gbmFtZWQgYW5kIGNvdW50ZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZW1wdHlWaWV3Rm5OYW1lID0gZW1wdHlWaWV3LmZuTmFtZTtcbiAgICAgICAgICBlbXB0eURlY2xzID0gZW1wdHlWaWV3LmRlY2xzO1xuICAgICAgICAgIGVtcHR5VmFycyA9IGVtcHR5Vmlldy52YXJzO1xuICAgICAgICB9XG5cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnJlcGVhdGVyQ3JlYXRlKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90LCByZXBlYXRlclZpZXcuZm5OYW1lLCBvcC5kZWNscyEsIG9wLnZhcnMhLCBvcC50YWcsIG9wLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgb3AudHJhY2tCeUZuISwgb3AudXNlc0NvbXBvbmVudEluc3RhbmNlLCBlbXB0eVZpZXdGbk5hbWUsIGVtcHR5RGVjbHMsIGVtcHR5VmFycyxcbiAgICAgICAgICAgICAgICBvcC53aG9sZVNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdGF0ZW1lbnQ6XG4gICAgICAgIC8vIFBhc3Mgc3RhdGVtZW50IG9wZXJhdGlvbnMgZGlyZWN0bHkgdGhyb3VnaC5cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGNyZWF0ZSBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVpZnlVcGRhdGVPcGVyYXRpb25zKF91bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPik6IHZvaWQge1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgcmVpZnlJckV4cHJlc3Npb24sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuQWR2YW5jZTpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmFkdmFuY2Uob3AuZGVsdGEsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5wcm9wZXJ0eUludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AubmFtZSwgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zYW5pdGl6ZXIsXG4gICAgICAgICAgICAgICAgICBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnByb3BlcnR5KG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNhbml0aXplciwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgIG5nLnN0eWxlUHJvcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AubmFtZSwgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC51bml0LFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5zdHlsZVByb3Aob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3AudW5pdCwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuY2xhc3NQcm9wKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdHlsZU1hcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5zdHlsZU1hcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnN0eWxlTWFwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzTWFwOlxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgIG5nLmNsYXNzTWFwSW50ZXJwb2xhdGUoXG4gICAgICAgICAgICAgICAgICBvcC5leHByZXNzaW9uLnN0cmluZ3MsIG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuY2xhc3NNYXAob3AuZXhwcmVzc2lvbiwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb246XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5pMThuRXhwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuQXBwbHk6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5pMThuQXBwbHkob3AuaGFuZGxlLnNsb3QhLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcudGV4dEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgIG9wLmludGVycG9sYXRpb24uc3RyaW5ncywgb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9ucywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc2FuaXRpemVyLFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5hdHRyaWJ1dGUob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3Auc2FuaXRpemVyKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbm90IHlldCBoYW5kbGVkJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKG9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgIG9wLCBuZy5ob3N0UHJvcGVydHkob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3Auc2FuaXRpemVyLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIGlmIChvcC52YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5uYW1lZCB2YXJpYWJsZSAke29wLnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuVXBkYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgICAgICBvcC52YXJpYWJsZS5uYW1lLCBvcC5pbml0aWFsaXplciwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db25kaXRpb25hbDpcbiAgICAgICAgaWYgKG9wLnByb2Nlc3NlZCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29uZGl0aW9uYWwgdGVzdCB3YXMgbm90IHNldC5gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AudGFyZ2V0U2xvdC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb25kaXRpb25hbCBzbG90IHdhcyBub3Qgc2V0LmApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsIG5nLmNvbmRpdGlvbmFsKG9wLnRhcmdldFNsb3Quc2xvdCwgb3AucHJvY2Vzc2VkLCBvcC5jb250ZXh0VmFsdWUsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlcjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnJlcGVhdGVyKG9wLmNvbGxlY3Rpb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlcldoZW46XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5kZWZlcldoZW4ob3AucHJlZmV0Y2gsIG9wLmV4cHIsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdGF0ZW1lbnQ6XG4gICAgICAgIC8vIFBhc3Mgc3RhdGVtZW50IG9wZXJhdGlvbnMgZGlyZWN0bHkgdGhyb3VnaC5cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIHVwZGF0ZSBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVpZnlJckV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgIHJldHVybiBleHByO1xuICB9XG5cbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLk5leHRDb250ZXh0OlxuICAgICAgcmV0dXJuIG5nLm5leHRDb250ZXh0KGV4cHIuc3RlcHMpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVmZXJlbmNlOlxuICAgICAgcmV0dXJuIG5nLnJlZmVyZW5jZShleHByLnRhcmdldFNsb3Quc2xvdCEgKyAxICsgZXhwci5vZmZzZXQpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuTGV4aWNhbFJlYWQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bnJlc29sdmVkIExleGljYWxSZWFkIG9mICR7ZXhwci5uYW1lfWApO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVzdG9yZVZpZXc6XG4gICAgICBpZiAodHlwZW9mIGV4cHIudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5yZXNvbHZlZCBSZXN0b3JlVmlld2ApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5nLnJlc3RvcmVWaWV3KGV4cHIudmlldyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZXNldFZpZXc6XG4gICAgICByZXR1cm4gbmcucmVzZXRWaWV3KGV4cHIuZXhwcik7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5HZXRDdXJyZW50VmlldzpcbiAgICAgIHJldHVybiBuZy5nZXRDdXJyZW50VmlldygpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVhZFZhcmlhYmxlOlxuICAgICAgaWYgKGV4cHIubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlYWQgb2YgdW5uYW1lZCB2YXJpYWJsZSAke2V4cHIueHJlZn1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKGV4cHIubmFtZSk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZWFkVGVtcG9yYXJ5RXhwcjpcbiAgICAgIGlmIChleHByLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZWFkIG9mIHVubmFtZWQgdGVtcG9yYXJ5ICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkFzc2lnblRlbXBvcmFyeUV4cHI6XG4gICAgICBpZiAoZXhwci5uYW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzaWduIG9mIHVubmFtZWQgdGVtcG9yYXJ5ICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKS5zZXQoZXhwci5leHByKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICBpZiAoZXhwci5mbiA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBQdXJlRnVuY3Rpb25zIHRvIGhhdmUgYmVlbiBleHRyYWN0ZWRgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZy5wdXJlRnVuY3Rpb24oZXhwci52YXJPZmZzZXQhLCBleHByLmZuLCBleHByLmFyZ3MpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcjpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIgdG8gaGF2ZSBiZWVuIGV4dHJhY3RlZGApO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmc6XG4gICAgICByZXR1cm4gbmcucGlwZUJpbmQoZXhwci50YXJnZXRTbG90LnNsb3QhLCBleHByLnZhck9mZnNldCEsIGV4cHIuYXJncyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZ1ZhcmlhZGljOlxuICAgICAgcmV0dXJuIG5nLnBpcGVCaW5kVihleHByLnRhcmdldFNsb3Quc2xvdCEsIGV4cHIudmFyT2Zmc2V0ISwgZXhwci5hcmdzKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlNsb3RMaXRlcmFsRXhwcjpcbiAgICAgIHJldHVybiBvLmxpdGVyYWwoZXhwci5zbG90LnNsb3QhKTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogVW5zdXBwb3J0ZWQgcmVpZmljYXRpb24gb2YgaXIuRXhwcmVzc2lvbiBraW5kOiAke1xuICAgICAgICAgIGlyLkV4cHJlc3Npb25LaW5kWyhleHByIGFzIGlyLkV4cHJlc3Npb24pLmtpbmRdfWApO1xuICB9XG59XG5cbi8qKlxuICogTGlzdGVuZXJzIGdldCB0dXJuZWQgaW50byBhIGZ1bmN0aW9uIGV4cHJlc3Npb24sIHdoaWNoIG1heSBvciBtYXkgbm90IGhhdmUgdGhlIGAkZXZlbnRgXG4gKiBwYXJhbWV0ZXIgZGVmaW5lZC5cbiAqL1xuZnVuY3Rpb24gcmVpZnlMaXN0ZW5lckhhbmRsZXIoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBuYW1lOiBzdHJpbmcsIGhhbmRsZXJPcHM6IGlyLk9wTGlzdDxpci5VcGRhdGVPcD4sXG4gICAgY29uc3VtZXNEb2xsYXJFdmVudDogYm9vbGVhbik6IG8uRnVuY3Rpb25FeHByIHtcbiAgLy8gRmlyc3QsIHJlaWZ5IGFsbCBpbnN0cnVjdGlvbiBjYWxscyB3aXRoaW4gYGhhbmRsZXJPcHNgLlxuICByZWlmeVVwZGF0ZU9wZXJhdGlvbnModW5pdCwgaGFuZGxlck9wcyk7XG5cbiAgLy8gTmV4dCwgZXh0cmFjdCBhbGwgdGhlIGBvLlN0YXRlbWVudGBzIGZyb20gdGhlIHJlaWZpZWQgb3BlcmF0aW9ucy4gV2UgY2FuIGV4cGVjdCB0aGF0IGF0IHRoaXNcbiAgLy8gcG9pbnQsIGFsbCBvcGVyYXRpb25zIGhhdmUgYmVlbiBjb252ZXJ0ZWQgdG8gc3RhdGVtZW50cy5cbiAgY29uc3QgaGFuZGxlclN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2YgaGFuZGxlck9wcykge1xuICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RhdGVtZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCByZWlmaWVkIHN0YXRlbWVudHMsIGJ1dCBmb3VuZCBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gICAgaGFuZGxlclN0bXRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuXG4gIC8vIElmIGAkZXZlbnRgIGlzIHJlZmVyZW5jZWQsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgaXQgYXMgYSBwYXJhbWV0ZXIuXG4gIGNvbnN0IHBhcmFtczogby5GblBhcmFtW10gPSBbXTtcbiAgaWYgKGNvbnN1bWVzRG9sbGFyRXZlbnQpIHtcbiAgICAvLyBXZSBuZWVkIHRoZSBgJGV2ZW50YCBwYXJhbWV0ZXIuXG4gICAgcGFyYW1zLnB1c2gobmV3IG8uRm5QYXJhbSgnJGV2ZW50JykpO1xuICB9XG5cbiAgcmV0dXJuIG8uZm4ocGFyYW1zLCBoYW5kbGVyU3RtdHMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBuYW1lKTtcbn1cbiJdfQ==