/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
import * as ng from '../instruction';
/**
 * Compiles semantic operations across all views and generates output `o.Statement`s with actual
 * runtime calls in their place.
 *
 * Reification replaces semantic operations with selected Ivy instructions and other generated code
 * structures. After reification, the create/update operation lists of all views should only contain
 * `ir.StatementOp`s (which wrap generated `o.Statement`s).
 */
export function phaseReify(cpl) {
    for (const [_, view] of cpl.views) {
        reifyCreateOperations(view, view.create);
        reifyUpdateOperations(view, view.update);
    }
}
function reifyCreateOperations(view, ops) {
    for (const op of ops) {
        ir.transformExpressionsInOp(op, reifyIrExpression, ir.VisitorContextFlag.None);
        switch (op.kind) {
            case ir.OpKind.Text:
                ir.OpList.replace(op, ng.text(op.slot, op.initialValue));
                break;
            case ir.OpKind.ElementStart:
                ir.OpList.replace(op, ng.elementStart(op.slot, op.tag, op.attributes, op.localRefs));
                break;
            case ir.OpKind.Element:
                ir.OpList.replace(op, ng.element(op.slot, op.tag, op.attributes, op.localRefs));
                break;
            case ir.OpKind.ElementEnd:
                ir.OpList.replace(op, ng.elementEnd());
                break;
            case ir.OpKind.ContainerStart:
                ir.OpList.replace(op, ng.elementContainerStart(op.slot, op.attributes, op.localRefs));
                break;
            case ir.OpKind.Container:
                ir.OpList.replace(op, ng.elementContainer(op.slot, op.attributes, op.localRefs));
                break;
            case ir.OpKind.ContainerEnd:
                ir.OpList.replace(op, ng.elementContainerEnd());
                break;
            case ir.OpKind.Template:
                const childView = view.tpl.views.get(op.xref);
                ir.OpList.replace(op, ng.template(op.slot, o.variable(childView.fnName), childView.decls, childView.vars, op.tag, op.attributes));
                break;
            case ir.OpKind.Listener:
                const listenerFn = reifyListenerHandler(view, op.handlerFnName, op.handlerOps);
                ir.OpList.replace(op, ng.listener(op.name, listenerFn));
                break;
            case ir.OpKind.Variable:
                if (op.variable.name === null) {
                    throw new Error(`AssertionError: unnamed variable ${op.xref}`);
                }
                ir.OpList.replace(op, ir.createStatementOp(new o.DeclareVarStmt(op.variable.name, op.initializer, undefined, o.StmtModifier.Final)));
                break;
            case ir.OpKind.Statement:
                // Pass statement operations directly through.
                break;
            default:
                throw new Error(`AssertionError: Unsupported reification of create op ${ir.OpKind[op.kind]}`);
        }
    }
}
function reifyUpdateOperations(_view, ops) {
    for (const op of ops) {
        ir.transformExpressionsInOp(op, reifyIrExpression, ir.VisitorContextFlag.None);
        switch (op.kind) {
            case ir.OpKind.Advance:
                ir.OpList.replace(op, ng.advance(op.delta));
                break;
            case ir.OpKind.Property:
                ir.OpList.replace(op, ng.property(op.name, op.expression));
                break;
            case ir.OpKind.InterpolateText:
                ir.OpList.replace(op, ng.textInterpolate(op.strings, op.expressions));
                break;
            case ir.OpKind.Variable:
                if (op.variable.name === null) {
                    throw new Error(`AssertionError: unnamed variable ${op.xref}`);
                }
                ir.OpList.replace(op, ir.createStatementOp(new o.DeclareVarStmt(op.variable.name, op.initializer, undefined, o.StmtModifier.Final)));
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
    switch (expr.kind) {
        case ir.ExpressionKind.NextContext:
            return ng.nextContext(expr.steps);
        case ir.ExpressionKind.Reference:
            return ng.reference(expr.slot + 1 + expr.offset);
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
        default:
            throw new Error(`AssertionError: Unsupported reification of ir.Expression kind: ${ir.ExpressionKind[expr.kind]}`);
    }
}
/**
 * Listeners get turned into a function expression, which may or may not have the `$event`
 * parameter defined.
 */
function reifyListenerHandler(view, name, handlerOps) {
    const lookForEvent = new LookForEventVisitor();
    // First, reify all instruction calls within `handlerOps`.
    reifyUpdateOperations(view, handlerOps);
    // Next, extract all the `o.Statement`s from the reified operations. We can expect that at this
    // point, all operations have been converted to statements.
    const handlerStmts = [];
    for (const op of handlerOps) {
        if (op.kind !== ir.OpKind.Statement) {
            throw new Error(`AssertionError: expected reified statements, but found op ${ir.OpKind[op.kind]}`);
        }
        handlerStmts.push(op.statement);
    }
    // Scan the statement list for usages of `$event`. If referenced, we need to generate it as a
    // parameter.
    lookForEvent.visitAllStatements(handlerStmts, null);
    const params = [];
    if (lookForEvent.seenEventRead) {
        // We need the `$event` parameter.
        params.push(new o.FnParam('$event'));
    }
    return o.fn(params, handlerStmts, undefined, undefined, name);
}
/**
 * Visitor which scans for reads of the `$event` special variable.
 */
class LookForEventVisitor extends o.RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.seenEventRead = false;
    }
    visitReadVarExpr(ast, context) {
        if (ast.name === '$event') {
            this.seenEventRead = true;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVpZnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZWlmeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE9BQU8sS0FBSyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFFckM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxVQUFVLENBQUMsR0FBeUI7SUFDbEQsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMscUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6QyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQzFDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsSUFBcUIsRUFBRSxHQUEyQjtJQUMvRSxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtRQUNwQixFQUFFLENBQUMsd0JBQXdCLENBQUMsRUFBRSxFQUFFLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUvRSxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSTtnQkFDakIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUssRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDMUQsTUFBTTtZQUNSLEtB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QUFHLElBQUksQ0FBQztTQUMzQjtJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uLCBWaWV3Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCAqIGFzIG5nIGZyb20gJy4uL2luc3RydWN0aW9uJztcblxuLyoqXG4gKiBDb21waWxlcyBzZW1hbnRpYyBvcGVyYXRpb25zIGFjcm9zcyBhbGwgdmlld3MgYW5kIGdlbmVyYXRlcyBvdXRwdXQgYG8uU3RhdGVtZW50YHMgd2l0aCBhY3R1YWxcbiAqIHJ1bnRpbWUgY2FsbHMgaW4gdGhlaXIgcGxhY2UuXG4gKlxuICogUmVpZmljYXRpb24gcmVwbGFjZXMgc2VtYW50aWMgb3BlcmF0aW9ucyB3aXRoIHNlbGVjdGVkIEl2eSBpbnN0cnVjdGlvbnMgYW5kIG90aGVyIGdlbmVyYXRlZCBjb2RlXG4gKiBzdHJ1Y3R1cmVzLiBBZnRlciByZWlmaWNhdGlvbiwgdGhlIGNyZWF0ZS91cGRhdGUgb3BlcmF0aW9uIGxpc3RzIG9mIGFsbCB2aWV3cyBzaG91bGQgb25seSBjb250YWluXG4gKiBgaXIuU3RhdGVtZW50T3BgcyAod2hpY2ggd3JhcCBnZW5lcmF0ZWQgYG8uU3RhdGVtZW50YHMpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VSZWlmeShjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uKTogdm9pZCB7XG4gIGZvciAoY29uc3QgW18sIHZpZXddIG9mIGNwbC52aWV3cykge1xuICAgIHJlaWZ5Q3JlYXRlT3BlcmF0aW9ucyh2aWV3LCB2aWV3LmNyZWF0ZSk7XG4gICAgcmVpZnlVcGRhdGVPcGVyYXRpb25zKHZpZXcsIHZpZXcudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWlmeUNyZWF0ZU9wZXJhdGlvbnModmlldzogVmlld0NvbXBpbGF0aW9uLCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIHJlaWZ5SXJFeHByZXNzaW9uLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG5cbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy50ZXh0KG9wLnNsb3QhLCBvcC5pbml0aWFsVmFsdWUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50U3RhcnQoXG4gICAgICAgICAgICAgICAgb3Auc2xvdCEsIG9wLnRhZywgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5lbGVtZW50KFxuICAgICAgICAgICAgICAgIG9wLnNsb3QhLCBvcC50YWcsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCwgb3AubG9jYWxSZWZzIGFzIG51bWJlciB8IG51bGwpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50RW5kOlxuICAgICAgICBpci5PcExpc3QucmVwbGFjZShvcCwgbmcuZWxlbWVudEVuZCgpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJTdGFydDpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmVsZW1lbnRDb250YWluZXJTdGFydChcbiAgICAgICAgICAgICAgICBvcC5zbG90ISwgb3AuYXR0cmlidXRlcyBhcyBudW1iZXIgfCBudWxsLCBvcC5sb2NhbFJlZnMgYXMgbnVtYmVyIHwgbnVsbCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNvbnRhaW5lcjpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2UoXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIG5nLmVsZW1lbnRDb250YWluZXIoXG4gICAgICAgICAgICAgICAgb3Auc2xvdCEsIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyIHwgbnVsbCwgb3AubG9jYWxSZWZzIGFzIG51bWJlciB8IG51bGwpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Db250YWluZXJFbmQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy5lbGVtZW50Q29udGFpbmVyRW5kKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSB2aWV3LnRwbC52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBpci5PcExpc3QucmVwbGFjZShcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgbmcudGVtcGxhdGUoXG4gICAgICAgICAgICAgICAgb3Auc2xvdCEsXG4gICAgICAgICAgICAgICAgby52YXJpYWJsZShjaGlsZFZpZXcuZm5OYW1lISksXG4gICAgICAgICAgICAgICAgY2hpbGRWaWV3LmRlY2xzISxcbiAgICAgICAgICAgICAgICBjaGlsZFZpZXcudmFycyEsXG4gICAgICAgICAgICAgICAgb3AudGFnLFxuICAgICAgICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgYXMgbnVtYmVyLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGNvbnN0IGxpc3RlbmVyRm4gPSByZWlmeUxpc3RlbmVySGFuZGxlcih2aWV3LCBvcC5oYW5kbGVyRm5OYW1lISwgb3AuaGFuZGxlck9wcyk7XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBuZy5saXN0ZW5lcihcbiAgICAgICAgICAgICAgICBvcC5uYW1lLFxuICAgICAgICAgICAgICAgIGxpc3RlbmVyRm4sXG4gICAgICAgICAgICAgICAgKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIGlmIChvcC52YXJpYWJsZS5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5uYW1lZCB2YXJpYWJsZSAke29wLnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgICAgICAgICBvcC52YXJpYWJsZS5uYW1lLCBvcC5pbml0aWFsaXplciwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5TdGF0ZW1lbnQ6XG4gICAgICAgIC8vIFBhc3Mgc3RhdGVtZW50IG9wZXJhdGlvbnMgZGlyZWN0bHkgdGhyb3VnaC5cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IFVuc3VwcG9ydGVkIHJlaWZpY2F0aW9uIG9mIGNyZWF0ZSBvcCAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVpZnlVcGRhdGVPcGVyYXRpb25zKF92aWV3OiBWaWV3Q29tcGlsYXRpb24sIG9wczogaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPik6IHZvaWQge1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgcmVpZnlJckV4cHJlc3Npb24sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuQWR2YW5jZTpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLmFkdmFuY2Uob3AuZGVsdGEpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2Uob3AsIG5nLnByb3BlcnR5KG9wLm5hbWUsIG9wLmV4cHJlc3Npb24pKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlKG9wLCBuZy50ZXh0SW50ZXJwb2xhdGUob3Auc3RyaW5ncywgb3AuZXhwcmVzc2lvbnMpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgaWYgKG9wLnZhcmlhYmxlLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bm5hbWVkIHZhcmlhYmxlICR7b3AueHJlZn1gKTtcbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVwbGFjZTxpci5VcGRhdGVPcD4oXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLkRlY2xhcmVWYXJTdG10KFxuICAgICAgICAgICAgICAgIG9wLnZhcmlhYmxlLm5hbWUsIG9wLmluaXRpYWxpemVyLCB1bmRlZmluZWQsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0YXRlbWVudDpcbiAgICAgICAgLy8gUGFzcyBzdGF0ZW1lbnQgb3BlcmF0aW9ucyBkaXJlY3RseSB0aHJvdWdoLlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogVW5zdXBwb3J0ZWQgcmVpZmljYXRpb24gb2YgdXBkYXRlIG9wICR7aXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWlmeUlyRXhwcmVzc2lvbihleHByOiBpci5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLk5leHRDb250ZXh0OlxuICAgICAgcmV0dXJuIG5nLm5leHRDb250ZXh0KGV4cHIuc3RlcHMpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVmZXJlbmNlOlxuICAgICAgcmV0dXJuIG5nLnJlZmVyZW5jZShleHByLnNsb3QhICsgMSArIGV4cHIub2Zmc2V0KTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkxleGljYWxSZWFkOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5yZXNvbHZlZCBMZXhpY2FsUmVhZCBvZiAke2V4cHIubmFtZX1gKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlc3RvcmVWaWV3OlxuICAgICAgaWYgKHR5cGVvZiBleHByLnZpZXcgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVucmVzb2x2ZWQgUmVzdG9yZVZpZXdgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZy5yZXN0b3JlVmlldyhleHByLnZpZXcpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVzZXRWaWV3OlxuICAgICAgcmV0dXJuIG5nLnJlc2V0VmlldyhleHByLmV4cHIpO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuR2V0Q3VycmVudFZpZXc6XG4gICAgICByZXR1cm4gbmcuZ2V0Q3VycmVudFZpZXcoKTtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlJlYWRWYXJpYWJsZTpcbiAgICAgIGlmIChleHByLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZWFkIG9mIHVubmFtZWQgdmFyaWFibGUgJHtleHByLnhyZWZ9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gby52YXJpYWJsZShleHByLm5hbWUpO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBVbnN1cHBvcnRlZCByZWlmaWNhdGlvbiBvZiBpci5FeHByZXNzaW9uIGtpbmQ6ICR7XG4gICAgICAgICAgaXIuRXhwcmVzc2lvbktpbmRbKGV4cHIgYXMgaXIuRXhwcmVzc2lvbikua2luZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBMaXN0ZW5lcnMgZ2V0IHR1cm5lZCBpbnRvIGEgZnVuY3Rpb24gZXhwcmVzc2lvbiwgd2hpY2ggbWF5IG9yIG1heSBub3QgaGF2ZSB0aGUgYCRldmVudGBcbiAqIHBhcmFtZXRlciBkZWZpbmVkLlxuICovXG5mdW5jdGlvbiByZWlmeUxpc3RlbmVySGFuZGxlcihcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb24sIG5hbWU6IHN0cmluZywgaGFuZGxlck9wczogaXIuT3BMaXN0PGlyLlVwZGF0ZU9wPik6IG8uRnVuY3Rpb25FeHByIHtcbiAgY29uc3QgbG9va0ZvckV2ZW50ID0gbmV3IExvb2tGb3JFdmVudFZpc2l0b3IoKTtcblxuICAvLyBGaXJzdCwgcmVpZnkgYWxsIGluc3RydWN0aW9uIGNhbGxzIHdpdGhpbiBgaGFuZGxlck9wc2AuXG4gIHJlaWZ5VXBkYXRlT3BlcmF0aW9ucyh2aWV3LCBoYW5kbGVyT3BzKTtcblxuICAvLyBOZXh0LCBleHRyYWN0IGFsbCB0aGUgYG8uU3RhdGVtZW50YHMgZnJvbSB0aGUgcmVpZmllZCBvcGVyYXRpb25zLiBXZSBjYW4gZXhwZWN0IHRoYXQgYXQgdGhpc1xuICAvLyBwb2ludCwgYWxsIG9wZXJhdGlvbnMgaGF2ZSBiZWVuIGNvbnZlcnRlZCB0byBzdGF0ZW1lbnRzLlxuICBjb25zdCBoYW5kbGVyU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZm9yIChjb25zdCBvcCBvZiBoYW5kbGVyT3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5TdGF0ZW1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHJlaWZpZWQgc3RhdGVtZW50cywgYnV0IGZvdW5kIG9wICR7aXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgICBoYW5kbGVyU3RtdHMucHVzaChvcC5zdGF0ZW1lbnQpO1xuICB9XG5cbiAgLy8gU2NhbiB0aGUgc3RhdGVtZW50IGxpc3QgZm9yIHVzYWdlcyBvZiBgJGV2ZW50YC4gSWYgcmVmZXJlbmNlZCwgd2UgbmVlZCB0byBnZW5lcmF0ZSBpdCBhcyBhXG4gIC8vIHBhcmFtZXRlci5cbiAgbG9va0ZvckV2ZW50LnZpc2l0QWxsU3RhdGVtZW50cyhoYW5kbGVyU3RtdHMsIG51bGwpO1xuXG4gIGNvbnN0IHBhcmFtczogby5GblBhcmFtW10gPSBbXTtcbiAgaWYgKGxvb2tGb3JFdmVudC5zZWVuRXZlbnRSZWFkKSB7XG4gICAgLy8gV2UgbmVlZCB0aGUgYCRldmVudGAgcGFyYW1ldGVyLlxuICAgIHBhcmFtcy5wdXNoKG5ldyBvLkZuUGFyYW0oJyRldmVudCcpKTtcbiAgfVxuXG4gIHJldHVybiBvLmZuKHBhcmFtcywgaGFuZGxlclN0bXRzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbmFtZSk7XG59XG5cbi8qKlxuICogVmlzaXRvciB3aGljaCBzY2FucyBmb3IgcmVhZHMgb2YgdGhlIGAkZXZlbnRgIHNwZWNpYWwgdmFyaWFibGUuXG4gKi9cbmNsYXNzIExvb2tGb3JFdmVudFZpc2l0b3IgZXh0ZW5kcyBvLlJlY3Vyc2l2ZUFzdFZpc2l0b3Ige1xuICBzZWVuRXZlbnRSZWFkID0gZmFsc2U7XG5cbiAgb3ZlcnJpZGUgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IG8uUmVhZFZhckV4cHIsIGNvbnRleHQ6IGFueSkge1xuICAgIGlmIChhc3QubmFtZSA9PT0gJyRldmVudCcpIHtcbiAgICAgIHRoaXMuc2VlbkV2ZW50UmVhZCA9IHRydWU7XG4gICAgfVxuICB9XG59XG4iXX0=