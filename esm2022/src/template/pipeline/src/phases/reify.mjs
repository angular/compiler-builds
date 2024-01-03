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
/**
 * This function can be used a sanity check -- it walks every expression in the const pool, and
 * every expression reachable from an op, and makes sure that there are no IR expressions
 * left. This is nice to use for debugging mysterious failures where an IR expression cannot be
 * output from the output AST code.
 */
function ensureNoIrForDebug(job) {
    for (const stmt of job.pool.statements) {
        ir.transformExpressionsInStatement(stmt, expr => {
            if (ir.isIrExpression(expr)) {
                throw new Error(`AssertionError: IR expression found during reify: ${ir.ExpressionKind[expr.kind]}`);
            }
            return expr;
        }, ir.VisitorContextFlag.None);
    }
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            ir.visitExpressionsInOp(op, expr => {
                if (ir.isIrExpression(expr)) {
                    throw new Error(`AssertionError: IR expression found during reify: ${ir.ExpressionKind[expr.kind]}`);
                }
            });
        }
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
                ir.OpList.replace(op, ng.i18nStart(op.handle.slot, op.messageIndex, op.subTemplateIndex, op.sourceSpan));
                break;
            case ir.OpKind.I18nEnd:
                ir.OpList.replace(op, ng.i18nEnd(op.sourceSpan));
                break;
            case ir.OpKind.I18n:
                ir.OpList.replace(op, ng.i18n(op.handle.slot, op.messageIndex, op.subTemplateIndex, op.sourceSpan));
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
                ir.OpList.replace(op, ng.repeaterCreate(op.handle.slot, repeaterView.fnName, op.decls, op.vars, op.tag, op.attributes, op.trackByFn, op.usesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, op.emptyTag, op.emptyAttributes, op.wholeSourceSpan));
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
                    ir.OpList.replace(op, ng.attribute(op.name, op.expression, op.sanitizer, op.namespace));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVpZnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZWlmeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsbUJBQW1CLEVBQTRDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUYsT0FBTyxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUVyQzs7R0FFRztBQUNILE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxHQUFHLENBQThCO0lBQ25FLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxhQUFhLENBQUM7SUFDckMsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLGVBQWUsQ0FBQztJQUN6QyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDO0NBQ2xDLENBQUMsQ0FBQztBQUVIOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsS0FBSyxDQUFDLEdBQW1CO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekMscUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxHQUFtQjtJQUM3QyxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFF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QUMsQ0FBQyxDQUFDO2dCQUMzRSxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLElBQUksRUFBRSxDQUFDLFVBQVUsWUFBWSxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQzlDLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUNiLEVBQUUsRUFDRixFQUFFLENBQUMsbUJBQW1CLENBQ2xCLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUM1RSxDQUFDO3FCQUFNLENBQUM7b0JBQ04sRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDbkUsQ0FBQztnQkFDRCxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLElBQUksRUFBRSxDQUFDLFVBQVUsWUFBWSxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQzlDLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUNiLEVBQUUsRUFDRixFQUFFLENBQUMsbUJBQW1CLENBQ2xCLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUM1RSxDQUFDO3FCQUFNLENBQUM7b0JBQ04sRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDbkUsQ0FBQztnQkFDRCxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWM7Z0JBQzNCLEVBQUUs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S0FBSyxNQUFNLEVBQUUsSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNwQyxNQUFNLElBQUksS0FBSyxDQUNYLDZEQUE2RCxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekYsQ0FBQztRQUNELFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxvRUFBb0U7SUFDcEUsTUFBTSxNQUFNLEdBQWdCLEVBQUUsQ0FBQztJQUMvQixJQUFJLG1CQUFtQixFQUFFLENBQUM7UUFDeEIsa0NBQWtDO1FBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDaEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtWaWV3Q29tcGlsYXRpb25Vbml0LCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0ICogYXMgbmcgZnJvbSAnLi4vaW5zdHJ1Y3Rpb24nO1xuXG4vKipcbiAqIE1hcCBvZiB0YXJnZXQgcmVzb2x2ZXJzIGZvciBldmVudCBsaXN0ZW5lcnMuXG4gKi9cbmNvbnN0IEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTID0gbmV3IE1hcDxzdHJpbmcsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFtcbiAgWyd3aW5kb3cnLCBJZGVudGlmaWVycy5yZXNvbHZlV2luZG93XSxcbiAgWydkb2N1bWVudCcsIElkZW50aWZpZXJzLnJlc29sdmVEb2N1bWVudF0sXG4gIFsnYm9keScsIElkZW50aWZpZXJzLnJlc29sdmVCb2R5XSxcbl0pO1xuXG4vKipcbiAqIENvbXBpbGVzIHNlbWFudGljIG9wZXJhdGlvbnMgYWNyb3NzIGFsbCB2aWV3cyBhbmQgZ2VuZXJhdGVzIG91dHB1dCBgby5TdGF0ZW1lbnRgcyB3aXRoIGFjdHVhbFxuICogcnVudGltZSBjYWxscyBpbiB0aGVpciBwbGFjZS5cbiAqXG4gKiBSZWlmaWNhdGlvbiByZXBsYWNlcyBzZW1hbnRpYyBvcGVyYXRpb25zIHdpdGggc2VsZWN0ZWQgSXZ5IGluc3RydWN0aW9ucyBhbmQgb3RoZXIgZ2VuZXJhdGVkIGNvZGVcbiAqIHN0cnVjdHVyZXMuIEFmdGVyIHJlaWZpY2F0aW9uLCB0aGUgY3JlYXRlL3VwZGF0ZSBvcGVyYXRpb24gbGlzdHMgb2YgYWxsIHZpZXdzIHNob3VsZCBvbmx5IGNvbnRhaW5cbiAqIGBpci5TdGF0ZW1lbnRPcGBzICh3aGljaCB3cmFwIGdlbmVyYXRlZCBgby5TdGF0ZW1lbnRgcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWlmeShqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICByZWlmeUNyZWF0ZU9wZXJhdGlvbnModW5pdCwgdW5pdC5jcmVhdGUpO1xuICAgIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyh1bml0LCB1bml0LnVwZGF0ZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBiZSB1c2VkIGEgc2FuaXR5IGNoZWNrIC0tIGl0IHdhbGtzIGV2ZXJ5IGV4cHJlc3Npb24gaW4gdGhlIGNvbnN0IHBvb2wsIGFuZFxuICogZXZlcnkgZXhwcmVzc2lvbiByZWFjaGFibGUgZnJvbSBhbiBvcCwgYW5kIG1ha2VzIHN1cmUgdGhhdCB0aGVyZSBhcmUgbm8gSVIgZXhwcmVzc2lvbnNcbiAqIGxlZnQuIFRoaXMgaXMgbmljZSB0byB1c2UgZm9yIGRlYnVnZ2luZyBteXN0ZXJpb3VzIGZhaWx1cmVzIHdoZXJlIGFuIElSIGV4cHJlc3Npb24gY2Fubm90IGJlXG4gKiBvdXRwdXQgZnJvbSB0aGUgb3V0cHV0IEFTVCBjb2RlLlxuICovXG5mdW5jdGlvbiBlbnN1cmVOb0lyRm9yRGVidWcoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBmb3IgKGNvbnN0IHN0bXQgb2Ygam9iLnBvb2wuc3RhdGVtZW50cykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQoc3RtdCwgZXhwciA9PiB7XG4gICAgICBpZiAoaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBJUiBleHByZXNzaW9uIGZvdW5kIGR1cmluZyByZWlmeTogJHtpci5FeHByZXNzaW9uS2luZFtleHByLmtpbmRdfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4cHI7XG4gICAgfSwgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xuICB9XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKGlyLmlzSXJFeHByZXNzaW9uKGV4cHIpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IElSIGV4cHJlc3Npb24gZm91bmQgZHVyaW5nIHJlaWZ5OiAke2lyLkV4cHJlc3Npb25LaW5kW2V4cHIua2luZF19YCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWlmeUNyZWF0ZU9wZXJhdGlvbnModW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy50ZXh0KG9wLmhhbmRsZS5zbG90ISwgb3AuaW5pdGlhbFZhbHVlLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudFN0YXJ0KFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AudGFnISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLFxuICAgICAgICAgICAgICAgIG9wLmxvY2FsUmVmcyBhcyBudW1iZXIgfCBudWxsLCBvcC5zdGFydFNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudChcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCEsIG9wLnRhZyEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCwgb3Aud2hvbGVTb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmVsZW1lbnRFbmQob3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNvbnRhaW5lclN0YXJ0OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcuZWxlbWVudENvbnRhaW5lclN0YXJ0KFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC5zdGFydFNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXI6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50Q29udGFpbmVyKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgICAgICAgICBvcC53aG9sZVNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJFbmQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbGVtZW50Q29udGFpbmVyRW5kKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmkxOG5TdGFydChvcC5oYW5kbGUuc2xvdCEsIG9wLm1lc3NhZ2VJbmRleCEsIG9wLnN1YlRlbXBsYXRlSW5kZXghLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmkxOG5FbmQob3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG46XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsIG5nLmkxOG4ob3AuaGFuZGxlLnNsb3QhLCBvcC5tZXNzYWdlSW5kZXghLCBvcC5zdWJUZW1wbGF0ZUluZGV4ISwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5BdHRyaWJ1dGVzOlxuICAgICAgICBpZiAob3AuaTE4bkF0dHJpYnV0ZXNDb25maWcgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBpMThuQXR0cmlidXRlc0NvbmZpZyB3YXMgbm90IHNldGApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5pMThuQXR0cmlidXRlcyhvcC5oYW5kbGUuc2xvdCEsIG9wLmkxOG5BdHRyaWJ1dGVzQ29uZmlnKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIGlmICghKHVuaXQgaW5zdGFuY2VvZiBWaWV3Q29tcGlsYXRpb25Vbml0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IG11c3QgYmUgY29tcGlsaW5nIGEgY29tcG9uZW50YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBsb2NhbCByZWZzIGFycmF5IHNob3VsZCBoYXZlIGJlZW4gZXh0cmFjdGVkIGludG8gYSBjb25zdGFudGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy50ZW1wbGF0ZShcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCEsIG8udmFyaWFibGUoY2hpbGRWaWV3LmZuTmFtZSEpLCBjaGlsZFZpZXcuZGVjbHMhLCBjaGlsZFZpZXcudmFycyEsXG4gICAgICAgICAgICAgICAgb3AudGFnLCBvcC5hdHRyaWJ1dGVzLCBvcC5sb2NhbFJlZnMsIG9wLnN0YXJ0U291cmNlU3BhbiksXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRGlzYWJsZUJpbmRpbmdzOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZGlzYWJsZUJpbmRpbmdzKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVuYWJsZUJpbmRpbmdzOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZW5hYmxlQmluZGluZ3MoKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUGlwZTpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnBpcGUob3AuaGFuZGxlLnNsb3QhLCBvcC5uYW1lKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGNvbnN0IGxpc3RlbmVyRm4gPVxuICAgICAgICAgICAgcmVpZnlMaXN0ZW5lckhhbmRsZXIodW5pdCwgb3AuaGFuZGxlckZuTmFtZSEsIG9wLmhhbmRsZXJPcHMsIG9wLmNvbnN1bWVzRG9sbGFyRXZlbnQpO1xuICAgICAgICBjb25zdCBldmVudFRhcmdldFJlc29sdmVyID1cbiAgICAgICAgICAgIG9wLmV2ZW50VGFyZ2V0ID8gR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuZ2V0KG9wLmV2ZW50VGFyZ2V0KSA6IG51bGw7XG4gICAgICAgIGlmIChldmVudFRhcmdldFJlc29sdmVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgZ2xvYmFsIHRhcmdldCAnJHtvcC5ldmVudFRhcmdldH0nIGRlZmluZWQgZm9yICcke1xuICAgICAgICAgICAgICBvcC5uYW1lfScgZXZlbnQuIFN1cHBvcnRlZCBsaXN0IG9mIGdsb2JhbCB0YXJnZXRzOiB3aW5kb3csZG9jdW1lbnQsYm9keS5gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcubGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgb3AubmFtZSwgbGlzdGVuZXJGbiwgZXZlbnRUYXJnZXRSZXNvbHZlciwgb3AuaG9zdExpc3RlbmVyICYmIG9wLmlzQW5pbWF0aW9uTGlzdGVuZXIsXG4gICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICBpZiAob3AudmFyaWFibGUubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVubmFtZWQgdmFyaWFibGUgJHtvcC54cmVmfWApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uRGVjbGFyZVZhclN0bXQoXG4gICAgICAgICAgICAgICAgb3AudmFyaWFibGUubmFtZSwgb3AuaW5pdGlhbGl6ZXIsIHVuZGVmaW5lZCwgby5TdG10TW9kaWZpZXIuRmluYWwpKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTmFtZXNwYWNlOlxuICAgICAgICBzd2l0Y2ggKG9wLmFjdGl2ZSkge1xuICAgICAgICAgIGNhc2UgaXIuTmFtZXNwYWNlLkhUTUw6XG4gICAgICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4ob3AsIG5nLm5hbWVzcGFjZUhUTUwoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLk5hbWVzcGFjZS5TVkc6XG4gICAgICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4ob3AsIG5nLm5hbWVzcGFjZVNWRygpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuTmFtZXNwYWNlLk1hdGg6XG4gICAgICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5DcmVhdGVPcD4ob3AsIG5nLm5hbWVzcGFjZU1hdGgoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkRlZmVyOlxuICAgICAgICBjb25zdCB0aW1lclNjaGVkdWxpbmcgPVxuICAgICAgICAgICAgISFvcC5sb2FkaW5nTWluaW11bVRpbWUgfHwgISFvcC5sb2FkaW5nQWZ0ZXJUaW1lIHx8ICEhb3AucGxhY2Vob2xkZXJNaW5pbXVtVGltZTtcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmRlZmVyKFxuICAgICAgICAgICAgICAgIG9wLmhhbmRsZS5zbG90ISwgb3AubWFpblNsb3Quc2xvdCEsIG9wLnJlc29sdmVyRm4sIG9wLmxvYWRpbmdTbG90Py5zbG90ID8/IG51bGwsXG4gICAgICAgICAgICAgICAgb3AucGxhY2Vob2xkZXJTbG90Py5zbG90ISA/PyBudWxsLCBvcC5lcnJvclNsb3Q/LnNsb3QgPz8gbnVsbCwgb3AubG9hZGluZ0NvbmZpZyxcbiAgICAgICAgICAgICAgICBvcC5wbGFjZWhvbGRlckNvbmZpZywgdGltZXJTY2hlZHVsaW5nLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRGVmZXJPbjpcbiAgICAgICAgbGV0IGFyZ3M6IG51bWJlcltdID0gW107XG4gICAgICAgIHN3aXRjaCAob3AudHJpZ2dlci5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLklkbGU6XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLkltbWVkaWF0ZTpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5UaW1lcjpcbiAgICAgICAgICAgIGFyZ3MgPSBbb3AudHJpZ2dlci5kZWxheV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb246XG4gICAgICAgICAgY2FzZSBpci5EZWZlclRyaWdnZXJLaW5kLkhvdmVyOlxuICAgICAgICAgIGNhc2UgaXIuRGVmZXJUcmlnZ2VyS2luZC5WaWV3cG9ydDpcbiAgICAgICAgICAgIGlmIChvcC50cmlnZ2VyLnRhcmdldFNsb3Q/LnNsb3QgPT0gbnVsbCB8fCBvcC50cmlnZ2VyLnRhcmdldFNsb3RWaWV3U3RlcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTbG90IG9yIHZpZXcgc3RlcHMgbm90IHNldCBpbiB0cmlnZ2VyIHJlaWZpY2F0aW9uIGZvciB0cmlnZ2VyIGtpbmQgJHtcbiAgICAgICAgICAgICAgICAgIG9wLnRyaWdnZXIua2luZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFyZ3MgPSBbb3AudHJpZ2dlci50YXJnZXRTbG90LnNsb3RdO1xuICAgICAgICAgICAgaWYgKG9wLnRyaWdnZXIudGFyZ2V0U2xvdFZpZXdTdGVwcyAhPT0gMCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gob3AudHJpZ2dlci50YXJnZXRTbG90Vmlld1N0ZXBzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBkZWZlciB0cmlnZ2VyIGtpbmQgJHtcbiAgICAgICAgICAgICAgICAob3AudHJpZ2dlciBhcyBhbnkpLmtpbmR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmRlZmVyT24ob3AudHJpZ2dlci5raW5kLCBhcmdzLCBvcC5wcmVmZXRjaCwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb2plY3Rpb25EZWY6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLkNyZWF0ZU9wPihvcCwgbmcucHJvamVjdGlvbkRlZihvcC5kZWYpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9qZWN0aW9uOlxuICAgICAgICBpZiAob3AuaGFuZGxlLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHNsb3Qgd2FzIGFzc2lnbmVkIGZvciBwcm9qZWN0IGluc3RydWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5wcm9qZWN0aW9uKG9wLmhhbmRsZS5zbG90ISwgb3AucHJvamVjdGlvblNsb3RJbmRleCwgb3AuYXR0cmlidXRlcywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAob3AuaGFuZGxlLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHNsb3Qgd2FzIGFzc2lnbmVkIGZvciByZXBlYXRlciBpbnN0cnVjdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghKHVuaXQgaW5zdGFuY2VvZiBWaWV3Q29tcGlsYXRpb25Vbml0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IG11c3QgYmUgY29tcGlsaW5nIGEgY29tcG9uZW50YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVwZWF0ZXJWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgaWYgKHJlcGVhdGVyVmlldy5mbk5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCByZXBlYXRlciBwcmltYXJ5IHZpZXcgdG8gaGF2ZSBiZWVuIG5hbWVkYCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZW1wdHlWaWV3Rm5OYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgICAgIGxldCBlbXB0eURlY2xzOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgICAgIGxldCBlbXB0eVZhcnM6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICAgICAgaWYgKG9wLmVtcHR5VmlldyAhPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnN0IGVtcHR5VmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC5lbXB0eVZpZXcpO1xuICAgICAgICAgIGlmIChlbXB0eVZpZXcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICdBc3NlcnRpb25FcnJvcjogcmVwZWF0ZXIgaGFkIGVtcHR5IHZpZXcgeHJlZiwgYnV0IGVtcHR5IHZpZXcgd2FzIG5vdCBmb3VuZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZW1wdHlWaWV3LmZuTmFtZSA9PT0gbnVsbCB8fCBlbXB0eVZpZXcuZGVjbHMgPT09IG51bGwgfHwgZW1wdHlWaWV3LnZhcnMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHJlcGVhdGVyIGVtcHR5IHZpZXcgdG8gaGF2ZSBiZWVuIG5hbWVkIGFuZCBjb3VudGVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVtcHR5Vmlld0ZuTmFtZSA9IGVtcHR5Vmlldy5mbk5hbWU7XG4gICAgICAgICAgZW1wdHlEZWNscyA9IGVtcHR5Vmlldy5kZWNscztcbiAgICAgICAgICBlbXB0eVZhcnMgPSBlbXB0eVZpZXcudmFycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5yZXBlYXRlckNyZWF0ZShcbiAgICAgICAgICAgICAgICBvcC5oYW5kbGUuc2xvdCwgcmVwZWF0ZXJWaWV3LmZuTmFtZSwgb3AuZGVjbHMhLCBvcC52YXJzISwgb3AudGFnLCBvcC5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgIG9wLnRyYWNrQnlGbiEsIG9wLnVzZXNDb21wb25lbnRJbnN0YW5jZSwgZW1wdHlWaWV3Rm5OYW1lLCBlbXB0eURlY2xzLCBlbXB0eVZhcnMsXG4gICAgICAgICAgICAgICAgb3AuZW1wdHlUYWcsIG9wLmVtcHR5QXR0cmlidXRlcywgb3Aud2hvbGVTb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3RhdGVtZW50OlxuICAgICAgICAvLyBQYXNzIHN0YXRlbWVudCBvcGVyYXRpb25zIGRpcmVjdGx5IHRocm91Z2guXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBjcmVhdGUgb3AgJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyhfdW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkFkdmFuY2U6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5hZHZhbmNlKG9wLmRlbHRhLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcucHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc2FuaXRpemVyLFxuICAgICAgICAgICAgICAgICAgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5wcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zYW5pdGl6ZXIsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5zdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3AudW5pdCxcbiAgICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuc3R5bGVQcm9wKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnVuaXQsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmNsYXNzUHJvcChvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVNYXA6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcuc3R5bGVNYXBJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24uc3RyaW5ncywgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5zdHlsZU1hcChvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc01hcDpcbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICBuZy5jbGFzc01hcEludGVycG9sYXRlKFxuICAgICAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbi5zdHJpbmdzLCBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmNsYXNzTWFwKG9wLmV4cHJlc3Npb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkV4cChvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkFwcGx5OlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuaTE4bkFwcGx5KG9wLmhhbmRsZS5zbG90ISwgb3Auc291cmNlU3BhbikpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLnRleHRJbnRlcnBvbGF0ZShcbiAgICAgICAgICAgICAgICBvcC5pbnRlcnBvbGF0aW9uLnN0cmluZ3MsIG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnMsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgbmcuYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgICAgICAgICAgICAgICBvcC5uYW1lLCBvcC5leHByZXNzaW9uLnN0cmluZ3MsIG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMsIG9wLnNhbml0aXplcixcbiAgICAgICAgICAgICAgICAgIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuYXR0cmlidXRlKG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLnNhbml0aXplciwgb3AubmFtZXNwYWNlKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbm90IHlldCBoYW5kbGVkJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKG9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eShvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgIG9wLCBuZy5ob3N0UHJvcGVydHkob3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3Auc2FuaXRpemVyLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIGlmIChvcC52YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5uYW1lZCB2YXJpYWJsZSAke29wLnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuVXBkYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgICAgICBvcC52YXJpYWJsZS5uYW1lLCBvcC5pbml0aWFsaXplciwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db25kaXRpb25hbDpcbiAgICAgICAgaWYgKG9wLnByb2Nlc3NlZCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29uZGl0aW9uYWwgdGVzdCB3YXMgbm90IHNldC5gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AudGFyZ2V0U2xvdC5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb25kaXRpb25hbCBzbG90IHdhcyBub3Qgc2V0LmApO1xuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsIG5nLmNvbmRpdGlvbmFsKG9wLnRhcmdldFNsb3Quc2xvdCwgb3AucHJvY2Vzc2VkLCBvcC5jb250ZXh0VmFsdWUsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlcjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnJlcGVhdGVyKG9wLmNvbGxlY3Rpb24sIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWZlcldoZW46XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5kZWZlcldoZW4ob3AucHJlZmV0Y2gsIG9wLmV4cHIsIG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdGF0ZW1lbnQ6XG4gICAgICAgIC8vIFBhc3Mgc3RhdGVtZW50IG9wZXJhdGlvbnMgZGlyZWN0bHkgdGhyb3VnaC5cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIHVwZGF0ZSBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVpZnlJckV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgIHJldHVybiBleHByO1xuICB9XG5cbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLk5leHRDb250ZXh0OlxuICAgICAgcmV0dXJuIG5nLm5leHRDb250ZXh0KGV4cHIuc3RlcHMpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVmZXJlbmNlOlxuICAgICAgcmV0dXJuIG5nLnJlZmVyZW5jZShleHByLnRhcmdldFNsb3Quc2xvdCEgKyAxICsgZXhwci5vZmZzZXQpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuTGV4aWNhbFJlYWQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bnJlc29sdmVkIExleGljYWxSZWFkIG9mICR7ZXhwci5uYW1lfWApO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVzdG9yZVZpZXc6XG4gICAgICBpZiAodHlwZW9mIGV4cHIudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5yZXNvbHZlZCBSZXN0b3JlVmlld2ApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5nLnJlc3RvcmVWaWV3KGV4cHIudmlldyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZXNldFZpZXc6XG4gICAgICByZXR1cm4gbmcucmVzZXRWaWV3KGV4cHIuZXhwcik7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5HZXRDdXJyZW50VmlldzpcbiAgICAgIHJldHVybiBuZy5nZXRDdXJyZW50VmlldygpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVhZFZhcmlhYmxlOlxuICAgICAgaWYgKGV4cHIubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlYWQgb2YgdW5uYW1lZCB2YXJpYWJsZSAke2V4cHIueHJlZn1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKGV4cHIubmFtZSk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5SZWFkVGVtcG9yYXJ5RXhwcjpcbiAgICAgIGlmIChleHByLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZWFkIG9mIHVubmFtZWQgdGVtcG9yYXJ5ICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkFzc2lnblRlbXBvcmFyeUV4cHI6XG4gICAgICBpZiAoZXhwci5uYW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzaWduIG9mIHVubmFtZWQgdGVtcG9yYXJ5ICR7ZXhwci54cmVmfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoZXhwci5uYW1lKS5zZXQoZXhwci5leHByKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICBpZiAoZXhwci5mbiA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBQdXJlRnVuY3Rpb25zIHRvIGhhdmUgYmVlbiBleHRyYWN0ZWRgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZy5wdXJlRnVuY3Rpb24oZXhwci52YXJPZmZzZXQhLCBleHByLmZuLCBleHByLmFyZ3MpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcjpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIgdG8gaGF2ZSBiZWVuIGV4dHJhY3RlZGApO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmc6XG4gICAgICByZXR1cm4gbmcucGlwZUJpbmQoZXhwci50YXJnZXRTbG90LnNsb3QhLCBleHByLnZhck9mZnNldCEsIGV4cHIuYXJncyk7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZ1ZhcmlhZGljOlxuICAgICAgcmV0dXJuIG5nLnBpcGVCaW5kVihleHByLnRhcmdldFNsb3Quc2xvdCEsIGV4cHIudmFyT2Zmc2V0ISwgZXhwci5hcmdzKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlNsb3RMaXRlcmFsRXhwcjpcbiAgICAgIHJldHVybiBvLmxpdGVyYWwoZXhwci5zbG90LnNsb3QhKTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogVW5zdXBwb3J0ZWQgcmVpZmljYXRpb24gb2YgaXIuRXhwcmVzc2lvbiBraW5kOiAke1xuICAgICAgICAgIGlyLkV4cHJlc3Npb25LaW5kWyhleHByIGFzIGlyLkV4cHJlc3Npb24pLmtpbmRdfWApO1xuICB9XG59XG5cbi8qKlxuICogTGlzdGVuZXJzIGdldCB0dXJuZWQgaW50byBhIGZ1bmN0aW9uIGV4cHJlc3Npb24sIHdoaWNoIG1heSBvciBtYXkgbm90IGhhdmUgdGhlIGAkZXZlbnRgXG4gKiBwYXJhbWV0ZXIgZGVmaW5lZC5cbiAqL1xuZnVuY3Rpb24gcmVpZnlMaXN0ZW5lckhhbmRsZXIoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBuYW1lOiBzdHJpbmcsIGhhbmRsZXJPcHM6IGlyLk9wTGlzdDxpci5VcGRhdGVPcD4sXG4gICAgY29uc3VtZXNEb2xsYXJFdmVudDogYm9vbGVhbik6IG8uRnVuY3Rpb25FeHByIHtcbiAgLy8gRmlyc3QsIHJlaWZ5IGFsbCBpbnN0cnVjdGlvbiBjYWxscyB3aXRoaW4gYGhhbmRsZXJPcHNgLlxuICByZWlmeVVwZGF0ZU9wZXJhdGlvbnModW5pdCwgaGFuZGxlck9wcyk7XG5cbiAgLy8gTmV4dCwgZXh0cmFjdCBhbGwgdGhlIGBvLlN0YXRlbWVudGBzIGZyb20gdGhlIHJlaWZpZWQgb3BlcmF0aW9ucy4gV2UgY2FuIGV4cGVjdCB0aGF0IGF0IHRoaXNcbiAgLy8gcG9pbnQsIGFsbCBvcGVyYXRpb25zIGhhdmUgYmVlbiBjb252ZXJ0ZWQgdG8gc3RhdGVtZW50cy5cbiAgY29uc3QgaGFuZGxlclN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAoY29uc3Qgb3Agb2YgaGFuZGxlck9wcykge1xuICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RhdGVtZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCByZWlmaWVkIHN0YXRlbWVudHMsIGJ1dCBmb3VuZCBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gICAgaGFuZGxlclN0bXRzLnB1c2gob3Auc3RhdGVtZW50KTtcbiAgfVxuXG4gIC8vIElmIGAkZXZlbnRgIGlzIHJlZmVyZW5jZWQsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgaXQgYXMgYSBwYXJhbWV0ZXIuXG4gIGNvbnN0IHBhcmFtczogby5GblBhcmFtW10gPSBbXTtcbiAgaWYgKGNvbnN1bWVzRG9sbGFyRXZlbnQpIHtcbiAgICAvLyBXZSBuZWVkIHRoZSBgJGV2ZW50YCBwYXJhbWV0ZXIuXG4gICAgcGFyYW1zLnB1c2gobmV3IG8uRm5QYXJhbSgnJGV2ZW50JykpO1xuICB9XG5cbiAgcmV0dXJuIG8uZm4ocGFyYW1zLCBoYW5kbGVyU3RtdHMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBuYW1lKTtcbn1cbiJdfQ==