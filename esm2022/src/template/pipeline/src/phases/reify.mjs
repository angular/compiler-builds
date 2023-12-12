/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
import { ViewCompilationUnit } from '../compilation';
import * as ng from '../instruction';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVpZnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZWlmeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBQyxtQkFBbUIsRUFBNEMsTUFBTSxnQkFBZ0IsQ0FBQztBQUM5RixPQUFPLEtBQUssRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRXJDOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsS0FBSyxDQUFDLEdBQW1CO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekMscUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsSUFBcUIsRUFBRSxHQUEyQjtJQUMvRSxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9FLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJO2dCQUNqQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElB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QUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDaEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Vmlld0NvbXBpbGF0aW9uVW5pdCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCAqIGFzIG5nIGZyb20gJy4uL2luc3RydWN0aW9uJztcblxuLyoqXG4gKiBDb21waWxlcyBzZW1hbnRpYyBvcGVyYXRpb25zIGFjcm9zcyBhbGwgdmlld3MgYW5kIGdlbmVyYXRlcyBvdXRwdXQgYG8uU3RhdGVtZW50YHMgd2l0aCBhY3R1YWxcbiAqIHJ1bnRpbWUgY2FsbHMgaW4gdGhlaXIgcGxhY2UuXG4gKlxuICogUmVpZmljYXRpb24gcmVwbGFjZXMgc2VtYW50aWMgb3BlcmF0aW9ucyB3aXRoIHNlbGVjdGVkIEl2eSBpbnN0cnVjdGlvbnMgYW5kIG90aGVyIGdlbmVyYXRlZCBjb2RlXG4gKiBzdHJ1Y3R1cmVzLiBBZnRlciByZWlmaWNhdGlvbiwgdGhlIGNyZWF0ZS91cGRhdGUgb3BlcmF0aW9uIGxpc3RzIG9mIGFsbCB2aWV3cyBzaG91bGQgb25seSBjb250YWluXG4gKiBgaXIuU3RhdGVtZW50T3BgcyAod2hpY2ggd3JhcCBnZW5lcmF0ZWQgYG8uU3RhdGVtZW50YHMpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVpZnkoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgcmVpZnlDcmVhdGVPcGVyYXRpb25zKHVuaXQsIHVuaXQuY3JlYXRlKTtcbiAgICByZWlmeVVwZGF0ZU9wZXJhdGlvbnModW5pdCwgdW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlaWZ5Q3JlYXRlT3BlcmF0aW9ucyh1bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPik6IHZvaWQge1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgcmVpZnlJckV4cHJlc3Npb24sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGV4dDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnRleHQob3AuaGFuZGxlLnNsb3QhLCBvcC5pbml0aWFsVmFsdWUsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50U3RhcnQoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvcC50YWchLCBvcC5hdHRyaWJ1dGVzIGFzIG51bWJlciB8IG51bGwsXG4gICAgICAgICAgICAgICAgb3AubG9jYWxSZWZzIGFzIG51bWJlciB8IG51bGwsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudChcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCEsIG9wLnRhZyEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRFbmQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbGVtZW50RW5kKG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJTdGFydDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmVsZW1lbnRDb250YWluZXJTdGFydChcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCwgb3AubG9jYWxSZWZzIGFzIG51bWJlciB8IG51bGwsXG4gICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNvbnRhaW5lcjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmVsZW1lbnRDb250YWluZXIoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvcC5hdHRyaWJ1dGVzIGFzIG51bWJlciB8IG51bGwsIG9wLmxvY2FsUmVmcyBhcyBudW1iZXIgfCBudWxsLFxuICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJFbmQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbGVtZW50Q29udGFpbmVyRW5kKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCwgbmcuaTE4blN0YXJ0KG9wLmhhbmRsZS5zbG90ISwgb3AubWVzc2FnZUluZGV4ISwgb3Auc3ViVGVtcGxhdGVJbmRleCEpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkVuZCgpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bihvcC5oYW5kbGUuc2xvdCEsIG9wLm1lc3NhZ2VJbmRleCEsIG9wLnN1YlRlbXBsYXRlSW5kZXghKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkF0dHJpYnV0ZXM6XG4gICAgICAgIGlmIChvcC5pMThuQXR0cmlidXRlc0NvbmZpZyA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGkxOG5BdHRyaWJ1dGVzQ29uZmlnIHdhcyBub3Qgc2V0YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG5BdHRyaWJ1dGVzKG9wLmhhbmRsZS5zbG90ISwgb3AuaTE4bkF0dHJpYnV0ZXNDb25maWcpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvcC5sb2NhbFJlZnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGxvY2FsIHJlZnMgYXJyYXkgc2hvdWxkIGhhdmUgYmVlbiBleHRyYWN0ZWQgaW50byBhIGNvbnN0YW50YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnRlbXBsYXRlKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgby52YXJpYWJsZShjaGlsZFZpZXcuZm5OYW1lISksIGNoaWxkVmlldy5kZWNscyEsIGNoaWxkVmlldy52YXJzISxcbiAgICAgICAgICAgICAgICBvcC50YWcsIG9wLmF0dHJpYnV0ZXMsIG9wLmxvY2FsUmVmcywgb3Auc291cmNlU3BhbiksXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRGlzYWJsZUJpbmRpbmdzOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZGlzYWJsZUJpbmRpbmdzKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVuYWJsZUJpbmRpbmdzOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZW5hYmxlQmluZGluZ3MoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUGlwZTpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnBpcGUob3AuaGFuZGxlLnNsb3QhLCBvcC5uYW1lKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGNvbnN0IGxpc3RlbmVyRm4gPVxuICAgICAgICAgICAgcmVpZnlMaXN0ZW5lckhhbmRsZXIodW5pdCwgb3AuaGFuZGxlckZuTmFtZSEsIG9wLmhhbmRsZXJPcHMsIG9wLmNvbnN1bWVzRG9sbGFyRXZlbnQpO1xuICAgICAgICBjb25zdCByZWlmaWVkID0gb3AuaG9zdExpc3RlbmVyICYmIG9wLmlzQW5pbWF0aW9uTGlzdGVuZXIgP1xuICAgICAgICAgICAgbmcuc3ludGhldGljSG9zdExpc3RlbmVyKG9wLm5hbWUsIGxpc3RlbmVyRm4sIG9wLnNvdXJjZVNwYW4pIDpcbiAgICAgICAgICAgIG5nLmxpc3RlbmVyKG9wLm5hbWUsIGxpc3RlbmVyRm4sIG9wLnNvdXJjZVNwYW4pO1xuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgcmVpZmllZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIGlmIChvcC52YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5uYW1lZCB2YXJpYWJsZSAke29wLnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgICAgICBvcC52YXJpYWJsZS5uYW1lLCBvcC5pbml0aWFsaXplciwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5OYW1lc3BhY2U6XG4gICAgICAgIHN3aXRjaCAob3AuYWN0aXZlKSB7XG4gICAgICAgICAgY2FzZSBpci5OYW1lc3BhY2UuSFRNTDpcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcubmFtZXNwYWNlSFRNTCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuTmFtZXNwYWNlLlNWRzpcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcubmFtZXNwYWNlU1ZHKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5OYW1lc3BhY2UuTWF0aDpcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcubmFtZXNwYWNlTWF0aCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRGVmZXI6XG4gICAgICAgIGNvbnN0IHRpbWVyU2NoZWR1bGluZyA9XG4gICAgICAgICAgICAhIW9wLmxvYWRpbmdNaW5pbXVtVGltZSB8fCAhIW9wLmxvYWRpbmdBZnRlclRpbWUgfHwgISFvcC5wbGFjZWhvbGRlck1pbmltdW1UaW1lO1xuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZGVmZXIoXG4gICAgICAgICAgICAgICAgb3AuaGFuZGxlLnNsb3QhLCBvcC5tYWluU2xvdC5zbG90ISwgb3AucmVzb2x2ZXJGbiwgb3AubG9hZGluZ1Nsb3Q/LnNsb3QgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5wbGFjZWhvbGRlclNsb3Q/LnNsb3QhID8/IG51bGwsIG9wLmVycm9yU2xvdD8uc2xvdCA/PyBudWxsLCBvcC5sb2FkaW5nQ29uZmlnLFxuICAgICAgICAgICAgICAgIG9wLnBsYWNlaG9sZGVyQ29uZmlnLCB0aW1lclNjaGVkdWxpbmcsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlck9uOlxuICAgICAgICBsZXQgYXJnczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgc3dpdGNoIChvcC50cmlnZ2VyLmtpbmQpIHtcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZTpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyOlxuICAgICAgICAgICAgYXJncyA9IFtvcC50cmlnZ2VyLmRlbGF5XTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbjpcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSG92ZXI6XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0OlxuICAgICAgICAgICAgaWYgKG9wLnRyaWdnZXIudGFyZ2V0U2xvdD8uc2xvdCA9PSBudWxsIHx8IG9wLnRyaWdnZXIudGFyZ2V0U2xvdFZpZXdTdGVwcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNsb3Qgb3IgdmlldyBzdGVwcyBub3Qgc2V0IGluIHRyaWdnZXIgcmVpZmljYXRpb24gZm9yIHRyaWdnZXIga2luZCAke1xuICAgICAgICAgICAgICAgICAgb3AudHJpZ2dlci5raW5kfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXJncyA9IFtvcC50cmlnZ2VyLnRhcmdldFNsb3Quc2xvdF07XG4gICAgICAgICAgICBpZiAob3AudHJpZ2dlci50YXJnZXRTbG90Vmlld1N0ZXBzICE9PSAwKSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChvcC50cmlnZ2VyLnRhcmdldFNsb3RWaWV3U3RlcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGRlZmVyIHRyaWdnZXIga2luZCAke1xuICAgICAgICAgICAgICAgIChvcC50cmlnZ2VyIGFzIGFueSkua2luZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZGVmZXJPbihvcC50cmlnZ2VyLmtpbmQsIGFyZ3MsIG9wLnByZWZldGNoLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvamVjdGlvbkRlZjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KG9wLCBuZy5wcm9qZWN0aW9uRGVmKG9wLmRlZikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb2plY3Rpb246XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gc2xvdCB3YXMgYXNzaWduZWQgZm9yIHByb2plY3QgaW5zdHJ1Y3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnByb2plY3Rpb24ob3AuaGFuZGxlLnNsb3QhLCBvcC5wcm9qZWN0aW9uU2xvdEluZGV4LCBvcC5hdHRyaWJ1dGVzLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGU6XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gc2xvdCB3YXMgYXNzaWduZWQgZm9yIHJlcGVhdGVyIGluc3RydWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEodW5pdCBpbnN0YW5jZW9mIFZpZXdDb21waWxhdGlvblVuaXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbXVzdCBiZSBjb21waWxpbmcgYSBjb21wb25lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXBlYXRlclZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpZiAocmVwZWF0ZXJWaWV3LmZuTmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHJlcGVhdGVyIHByaW1hcnkgdmlldyB0byBoYXZlIGJlZW4gbmFtZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBlbXB0eVZpZXdGbk5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICAgICAgbGV0IGVtcHR5RGVjbHM6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICAgICAgbGV0IGVtcHR5VmFyczogbnVtYmVyfG51bGwgPSBudWxsO1xuICAgICAgICBpZiAob3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgZW1wdHlWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLmVtcHR5Vmlldyk7XG4gICAgICAgICAgaWYgKGVtcHR5VmlldyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiByZXBlYXRlciBoYWQgZW1wdHkgdmlldyB4cmVmLCBidXQgZW1wdHkgdmlldyB3YXMgbm90IGZvdW5kJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChlbXB0eVZpZXcuZm5OYW1lID09PSBudWxsIHx8IGVtcHR5Vmlldy5kZWNscyA9PT0gbnVsbCB8fCBlbXB0eVZpZXcudmFycyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgcmVwZWF0ZXIgZW1wdHkgdmlldyB0byBoYXZlIGJlZW4gbmFtZWQgYW5kIGNvdW50ZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZW1wdHlWaWV3Rm5OYW1lID0gZW1wdHlWaWV3LmZuTmFtZTtcbiAgICAgICAgICBlbXB0eURlY2xzID0gZW1wdHlWaWV3LmRlY2xzO1xuICAgICAgICAgIGVtcHR5VmFycyA9IGVtcHR5Vmlldy52YXJzO1xuICAgICAgICB9XG5cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnJlcGVhdGVyQ3JlYXRlKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90LCByZXBlYXRlclZpZXcuZm5OYW1lLCBvcC5kZWNscyEsIG9wLnZhcnMhLCBvcC50YWcsIG9wLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgb3AudHJhY2tCeUZuISwgb3AudXNlc0NvbXBvbmVudEluc3RhbmNlLCBlbXB0eVZpZXdGbk5hbWUsIGVtcHR5RGVjbHMsIGVtcHR5VmFycyxcbiAgICAgICAgICAgICAgICBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3RhdGVtZW50OlxuICAgICAgICAvLyBQYXNzIHN0YXRlbWVudCBvcGVyYXRpb25zIGRpcmVjdGx5IHRocm91Z2guXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBjcmVhdGUgb3AgJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyhfdW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkFkdmFuY2U6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5hZHZhbmNlKG9wLmRlbHRhLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcucHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc2FuaXRpemVyLFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5wcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zYW5pdGl6ZXIsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5zdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3AudW5pdCxcbiAgICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuc3R5bGVQcm9wKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnVuaXQsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmNsYXNzUHJvcChvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVNYXA6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcuc3R5bGVNYXBJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5zdHlsZU1hcChvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc01hcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5jbGFzc01hcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmNsYXNzTWFwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkV4cChvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkFwcGx5OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkFwcGx5KG9wLmhhbmRsZS5zbG90ISwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnRleHRJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICBvcC5pbnRlcnBvbGF0aW9uLnN0cmluZ3MsIG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnMsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcuYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgICAgICAgICAgICAgICBvcC5uYW1lLCBvcC5leHByZXNzaW9uLnN0cmluZ3MsIG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMsIG9wLnNhbml0aXplcixcbiAgICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuYXR0cmlidXRlKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNhbml0aXplcikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vdCB5ZXQgaGFuZGxlZCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5zeW50aGV0aWNIb3N0UHJvcGVydHkob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaG9zdFByb3BlcnR5KG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgaWYgKG9wLnZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bm5hbWVkIHZhcmlhYmxlICR7b3AueHJlZn1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5VcGRhdGVPcD4oXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLkRlY2xhcmVWYXJTdG10KFxuICAgICAgICAgICAgICAgIG9wLnZhcmlhYmxlLm5hbWUsIG9wLmluaXRpYWxpemVyLCB1bmRlZmluZWQsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNvbmRpdGlvbmFsOlxuICAgICAgICBpZiAob3AucHJvY2Vzc2VkID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb25kaXRpb25hbCB0ZXN0IHdhcyBub3Qgc2V0LmApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC50YXJnZXRTbG90LnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbmRpdGlvbmFsIHNsb3Qgd2FzIG5vdCBzZXQuYCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCwgbmcuY29uZGl0aW9uYWwob3AudGFyZ2V0U2xvdC5zbG90LCBvcC5wcm9jZXNzZWQsIG9wLmNvbnRleHRWYWx1ZSwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcucmVwZWF0ZXIob3AuY29sbGVjdGlvbiwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkRlZmVyV2hlbjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmRlZmVyV2hlbihvcC5wcmVmZXRjaCwgb3AuZXhwciwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0YXRlbWVudDpcbiAgICAgICAgLy8gUGFzcyBzdGF0ZW1lbnQgb3BlcmF0aW9ucyBkaXJlY3RseSB0aHJvdWdoLlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogVW5zdXBwb3J0ZWQgcmVpZmljYXRpb24gb2YgdXBkYXRlIG9wICR7aXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWlmeUlyRXhwcmVzc2lvbihleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoIWlyLmlzSXJFeHByZXNzaW9uKGV4cHIpKSB7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cblxuICBzd2l0Y2ggKGV4cHIua2luZCkge1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuTmV4dENvbnRleHQ6XG4gICAgICByZXR1cm4gbmcubmV4dENvbnRleHQoZXhwci5zdGVwcyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZWZlcmVuY2U6XG4gICAgICByZXR1cm4gbmcucmVmZXJlbmNlKGV4cHIudGFyZ2V0U2xvdC5zbG90ISArIDEgKyBleHByLm9mZnNldCk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5MZXhpY2FsUmVhZDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVucmVzb2x2ZWQgTGV4aWNhbFJlYWQgb2YgJHtleHByLm5hbWV9YCk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZXN0b3JlVmlldzpcbiAgICAgIGlmICh0eXBlb2YgZXhwci52aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bnJlc29sdmVkIFJlc3RvcmVWaWV3YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmcucmVzdG9yZVZpZXcoZXhwci52aWV3KTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlc2V0VmlldzpcbiAgICAgIHJldHVybiBuZy5yZXNldFZpZXcoZXhwci5leHByKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkdldEN1cnJlbnRWaWV3OlxuICAgICAgcmV0dXJuIG5nLmdldEN1cnJlbnRWaWV3KCk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZWFkVmFyaWFibGU6XG4gICAgICBpZiAoZXhwci5uYW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVhZCBvZiB1bm5hbWVkIHZhcmlhYmxlICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlYWRUZW1wb3JhcnlFeHByOlxuICAgICAgaWYgKGV4cHIubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlYWQgb2YgdW5uYW1lZCB0ZW1wb3JhcnkgJHtleHByLnhyZWZ9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gby52YXJpYWJsZShleHByLm5hbWUpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuQXNzaWduVGVtcG9yYXJ5RXhwcjpcbiAgICAgIGlmIChleHByLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NpZ24gb2YgdW5uYW1lZCB0ZW1wb3JhcnkgJHtleHByLnhyZWZ9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gby52YXJpYWJsZShleHByLm5hbWUpLnNldChleHByLmV4cHIpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uRXhwcjpcbiAgICAgIGlmIChleHByLmZuID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIFB1cmVGdW5jdGlvbnMgdG8gaGF2ZSBiZWVuIGV4dHJhY3RlZGApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5nLnB1cmVGdW5jdGlvbihleHByLnZhck9mZnNldCEsIGV4cHIuZm4sIGV4cHIuYXJncyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwciB0byBoYXZlIGJlZW4gZXh0cmFjdGVkYCk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZzpcbiAgICAgIHJldHVybiBuZy5waXBlQmluZChleHByLnRhcmdldFNsb3Quc2xvdCEsIGV4cHIudmFyT2Zmc2V0ISwgZXhwci5hcmdzKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM6XG4gICAgICByZXR1cm4gbmcucGlwZUJpbmRWKGV4cHIudGFyZ2V0U2xvdC5zbG90ISwgZXhwci52YXJPZmZzZXQhLCBleHByLmFyZ3MpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuU2xvdExpdGVyYWxFeHByOlxuICAgICAgcmV0dXJuIG8ubGl0ZXJhbChleHByLnNsb3Quc2xvdCEpO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBpci5FeHByZXNzaW9uIGtpbmQ6ICR7XG4gICAgICAgICAgaXIuRXhwcmVzc2lvbktpbmRbKGV4cHIgYXMgaXIuRXhwcmVzc2lvbikua2luZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBMaXN0ZW5lcnMgZ2V0IHR1cm5lZCBpbnRvIGEgZnVuY3Rpb24gZXhwcmVzc2lvbiwgd2hpY2ggbWF5IG9yIG1heSBub3QgaGF2ZSB0aGUgYCRldmVudGBcbiAqIHBhcmFtZXRlciBkZWZpbmVkLlxuICovXG5mdW5jdGlvbiByZWlmeUxpc3RlbmVySGFuZGxlcihcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG5hbWU6IHN0cmluZywgaGFuZGxlck9wczogaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPixcbiAgICBjb25zdW1lc0RvbGxhckV2ZW50OiBib29sZWFuKTogby5GdW5jdGlvbkV4cHIge1xuICAvLyBGaXJzdCwgcmVpZnkgYWxsIGluc3RydWN0aW9uIGNhbGxzIHdpdGhpbiBgaGFuZGxlck9wc2AuXG4gIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyh1bml0LCBoYW5kbGVyT3BzKTtcblxuICAvLyBOZXh0LCBleHRyYWN0IGFsbCB0aGUgYG8uU3RhdGVtZW50YHMgZnJvbSB0aGUgcmVpZmllZCBvcGVyYXRpb25zLiBXZSBjYW4gZXhwZWN0IHRoYXQgYXQgdGhpc1xuICAvLyBwb2ludCwgYWxsIG9wZXJhdGlvbnMgaGF2ZSBiZWVuIGNvbnZlcnRlZCB0byBzdGF0ZW1lbnRzLlxuICBjb25zdCBoYW5kbGVyU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZm9yIChjb25zdCBvcCBvZiBoYW5kbGVyT3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5TdGF0ZW1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHJlaWZpZWQgc3RhdGVtZW50cywgYnV0IGZvdW5kIG9wICR7aXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICBoYW5kbGVyU3RtdHMucHVzaChvcC5zdGF0ZW1lbnQpO1xuICB9XG5cbiAgLy8gSWYgYCRldmVudGAgaXMgcmVmZXJlbmNlZCwgd2UgbmVlZCB0byBnZW5lcmF0ZSBpdCBhcyBhIHBhcmFtZXRlci5cbiAgY29uc3QgcGFyYW1zOiBvLkZuUGFyYW1bXSA9IFtdO1xuICBpZiAoY29uc3VtZXNEb2xsYXJFdmVudCkge1xuICAgIC8vIFdlIG5lZWQgdGhlIGAkZXZlbnRgIHBhcmFtZXRlci5cbiAgICBwYXJhbXMucHVzaChuZXcgby5GblBhcmFtKCckZXZlbnQnKSk7XG4gIH1cblxuICByZXR1cm4gby5mbihwYXJhbXMsIGhhbmRsZXJTdG10cywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIG5hbWUpO1xufVxuIl19