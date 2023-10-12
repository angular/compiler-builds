/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * Moves variables defined in creation mode to only be initialized after their creation, splitting
 * declaration and initialization if necessary to allow forward references.
 */
export function phaseCreationVarColocation(cpl) {
    for (const unit of cpl.units) {
        processUnit(unit);
    }
}
function processUnit(unit) {
    const shallowDeclarations = new Map();
    const seenVariableReads = new Set;
    let shallow = true;
    for (const op of unit.create) {
        if (shallow && op.kind === ir.OpKind.Variable &&
            op.variable.kind === ir.SemanticVariableKind.Identifier && op.variable.target !== null) {
            // This variable represents the identity of an entity within the current view (shallow) which
            // may or may not have been created yet.
            const target = op.variable.target;
            if (!shallowDeclarations.has(target)) {
                shallowDeclarations.set(target, []);
            }
            shallowDeclarations.get(target).push(op);
            continue;
        }
        // Scan expressions in this operation for both `NextContext` operations (which affect whether
        // seen reference declarations are shallow or not) or for `ReferenceExpr`s which may represent
        // forward references that later need to be accounted for.
        ir.visitExpressionsInOp(op, (exp, flags) => {
            if (flags & ir.VisitorContextFlag.InChildOperation) {
                return;
            }
            if (exp instanceof ir.NextContextExpr) {
                shallow = false;
            }
            else if (exp instanceof ir.ReadVariableExpr) {
                seenVariableReads.add(exp.xref);
            }
        });
        if (ir.hasConsumesSlotTrait(op) && shallowDeclarations.has(op.xref)) {
            // `op` is creating an entity for which at least one shallow declaration has previously been
            // established. If nothing has referenced those declarations, it can be moved to follow `op`.
            // Otherwise, we can split the variable into its declaration and assignment.
            for (const declOp of shallowDeclarations.get(op.xref)) {
                // Within the variable initializer, convert the `ReferenceExpr` into a
                // `ShallowReferenceExpr`. This is necessary since we might be moving the initializer past a
                // `NextContext` call.
                declOp.initializer = ir.transformExpressionsInExpression(declOp.initializer, expr => {
                    if (!(expr instanceof ir.ReferenceExpr)) {
                        return expr;
                    }
                    const shallowExpr = new ir.ShallowReferenceExpr(expr.target, expr.offset);
                    shallowExpr.targetSlot = expr.targetSlot;
                    return shallowExpr;
                }, ir.VisitorContextFlag.None);
                if (!seenVariableReads.has(declOp.xref)) {
                    // No references have been recorded to this variable, so move it to follow this
                    // declaration.
                    ir.OpList.remove(declOp);
                    ir.OpList.insertAfter(declOp, op);
                }
                else {
                    // A forward reference has been observed, so leave the existing declaration in place as an
                    // initializer to `undefined`, and set the variable to its value after its declaration.
                    const initializer = declOp.initializer;
                    declOp.initializer = o.literal(undefined);
                    declOp.isConstant = false;
                    const readVar = new ir.ReadVariableExpr(declOp.xref);
                    // TODO: variable naming should run after this and take care of this for us.
                    readVar.name = declOp.variable.name;
                    const assignment = new o.BinaryOperatorExpr(o.BinaryOperator.Assign, readVar, initializer);
                    ir.OpList.insertAfter(ir.createStatementOp(assignment.toStmt()), op);
                }
            }
            shallowDeclarations.delete(op.xref);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRpb25fdmFyX2NvbG9jYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGlvbl92YXJfY29sb2NhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUFtQjtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ25CO0FBQ0gsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLElBQXFCO0lBQ3hDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQTJDLENBQUM7SUFDL0UsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQWMsQ0FBQztJQUM3QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDbkIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQzVCLElBQUksT0FBTyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO1lBQ3pDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1lBQzFGLDZGQUE2RjtZQUM3Rix3Q0FBd0M7WUFDeEMsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFDbEMsSUFBSSxDQUFDLG1CQUFtQixDQUFD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QUFDLENBQUM7b0JBQzVFLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDbkY7YUFDRjtZQUNELG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDckM7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIE1vdmVzIHZhcmlhYmxlcyBkZWZpbmVkIGluIGNyZWF0aW9uIG1vZGUgdG8gb25seSBiZSBpbml0aWFsaXplZCBhZnRlciB0aGVpciBjcmVhdGlvbiwgc3BsaXR0aW5nXG4gKiBkZWNsYXJhdGlvbiBhbmQgaW5pdGlhbGl6YXRpb24gaWYgbmVjZXNzYXJ5IHRvIGFsbG93IGZvcndhcmQgcmVmZXJlbmNlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQ3JlYXRpb25WYXJDb2xvY2F0aW9uKGNwbDogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGNwbC51bml0cykge1xuICAgIHByb2Nlc3NVbml0KHVuaXQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NVbml0KHVuaXQ6IENvbXBpbGF0aW9uVW5pdCk6IHZvaWQge1xuICBjb25zdCBzaGFsbG93RGVjbGFyYXRpb25zID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLlZhcmlhYmxlT3A8aXIuQ3JlYXRlT3A+W10+KCk7XG4gIGNvbnN0IHNlZW5WYXJpYWJsZVJlYWRzID0gbmV3IFNldDxpci5YcmVmSWQ+O1xuICBsZXQgc2hhbGxvdyA9IHRydWU7XG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICBpZiAoc2hhbGxvdyAmJiBvcC5raW5kID09PSBpci5PcEtpbmQuVmFyaWFibGUgJiZcbiAgICAgICAgb3AudmFyaWFibGUua2luZCA9PT0gaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllciAmJiBvcC52YXJpYWJsZS50YXJnZXQgIT09IG51bGwpIHtcbiAgICAgIC8vIFRoaXMgdmFyaWFibGUgcmVwcmVzZW50cyB0aGUgaWRlbnRpdHkgb2YgYW4gZW50aXR5IHdpdGhpbiB0aGUgY3VycmVudCB2aWV3IChzaGFsbG93KSB3aGljaFxuICAgICAgLy8gbWF5IG9yIG1heSBub3QgaGF2ZSBiZWVuIGNyZWF0ZWQgeWV0LlxuICAgICAgY29uc3QgdGFyZ2V0ID0gb3AudmFyaWFibGUudGFyZ2V0O1xuICAgICAgaWYgKCFzaGFsbG93RGVjbGFyYXRpb25zLmhhcyh0YXJnZXQpKSB7XG4gICAgICAgIHNoYWxsb3dEZWNsYXJhdGlvbnMuc2V0KHRhcmdldCwgW10pO1xuICAgICAgfVxuICAgICAgc2hhbGxvd0RlY2xhcmF0aW9ucy5nZXQodGFyZ2V0KSEucHVzaChvcCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTY2FuIGV4cHJlc3Npb25zIGluIHRoaXMgb3BlcmF0aW9uIGZvciBib3RoIGBOZXh0Q29udGV4dGAgb3BlcmF0aW9ucyAod2hpY2ggYWZmZWN0IHdoZXRoZXJcbiAgICAvLyBzZWVuIHJlZmVyZW5jZSBkZWNsYXJhdGlvbnMgYXJlIHNoYWxsb3cgb3Igbm90KSBvciBmb3IgYFJlZmVyZW5jZUV4cHJgcyB3aGljaCBtYXkgcmVwcmVzZW50XG4gICAgLy8gZm9yd2FyZCByZWZlcmVuY2VzIHRoYXQgbGF0ZXIgbmVlZCB0byBiZSBhY2NvdW50ZWQgZm9yLlxuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCAoZXhwLCBmbGFncykgPT4ge1xuICAgICAgaWYgKGZsYWdzICYgaXIuVmlzaXRvckNvbnRleHRGbGFnLkluQ2hpbGRPcGVyYXRpb24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGV4cCBpbnN0YW5jZW9mIGlyLk5leHRDb250ZXh0RXhwcikge1xuICAgICAgICBzaGFsbG93ID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGV4cCBpbnN0YW5jZW9mIGlyLlJlYWRWYXJpYWJsZUV4cHIpIHtcbiAgICAgICAgc2VlblZhcmlhYmxlUmVhZHMuYWRkKGV4cC54cmVmKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChpci5oYXNDb25zdW1lc1Nsb3RUcmFpdChvcCkgJiYgc2hhbGxvd0RlY2xhcmF0aW9ucy5oYXMob3AueHJlZikpIHtcbiAgICAgIC8vIGBvcGAgaXMgY3JlYXRpbmcgYW4gZW50aXR5IGZvciB3aGljaCBhdCBsZWFzdCBvbmUgc2hhbGxvdyBkZWNsYXJhdGlvbiBoYXMgcHJldmlvdXNseSBiZWVuXG4gICAgICAvLyBlc3RhYmxpc2hlZC4gSWYgbm90aGluZyBoYXMgcmVmZXJlbmNlZCB0aG9zZSBkZWNsYXJhdGlvbnMsIGl0IGNhbiBiZSBtb3ZlZCB0byBmb2xsb3cgYG9wYC5cbiAgICAgIC8vIE90aGVyd2lzZSwgd2UgY2FuIHNwbGl0IHRoZSB2YXJpYWJsZSBpbnRvIGl0cyBkZWNsYXJhdGlvbiBhbmQgYXNzaWdubWVudC5cbiAgICAgIGZvciAoY29uc3QgZGVjbE9wIG9mIHNoYWxsb3dEZWNsYXJhdGlvbnMuZ2V0KG9wLnhyZWYpISkge1xuICAgICAgICAvLyBXaXRoaW4gdGhlIHZhcmlhYmxlIGluaXRpYWxpemVyLCBjb252ZXJ0IHRoZSBgUmVmZXJlbmNlRXhwcmAgaW50byBhXG4gICAgICAgIC8vIGBTaGFsbG93UmVmZXJlbmNlRXhwcmAuIFRoaXMgaXMgbmVjZXNzYXJ5IHNpbmNlIHdlIG1pZ2h0IGJlIG1vdmluZyB0aGUgaW5pdGlhbGl6ZXIgcGFzdCBhXG4gICAgICAgIC8vIGBOZXh0Q29udGV4dGAgY2FsbC5cbiAgICAgICAgZGVjbE9wLmluaXRpYWxpemVyID0gaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZGVjbE9wLmluaXRpYWxpemVyLCBleHByID0+IHtcbiAgICAgICAgICBpZiAoIShleHByIGluc3RhbmNlb2YgaXIuUmVmZXJlbmNlRXhwcikpIHtcbiAgICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHNoYWxsb3dFeHByID0gbmV3IGlyLlNoYWxsb3dSZWZlcmVuY2VFeHByKGV4cHIudGFyZ2V0LCBleHByLm9mZnNldCk7XG4gICAgICAgICAgc2hhbGxvd0V4cHIudGFyZ2V0U2xvdCA9IGV4cHIudGFyZ2V0U2xvdDtcbiAgICAgICAgICByZXR1cm4gc2hhbGxvd0V4cHI7XG4gICAgICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgICAgICBpZiAoIXNlZW5WYXJpYWJsZVJlYWRzLmhhcyhkZWNsT3AueHJlZikpIHtcbiAgICAgICAgICAvLyBObyByZWZlcmVuY2VzIGhhdmUgYmVlbiByZWNvcmRlZCB0byB0aGlzIHZhcmlhYmxlLCBzbyBtb3ZlIGl0IHRvIGZvbGxvdyB0aGlzXG4gICAgICAgICAgLy8gZGVjbGFyYXRpb24uXG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4oZGVjbE9wKTtcbiAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuQ3JlYXRlT3A+KGRlY2xPcCwgb3ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEEgZm9yd2FyZCByZWZlcmVuY2UgaGFzIGJlZW4gb2JzZXJ2ZWQsIHNvIGxlYXZlIHRoZSBleGlzdGluZyBkZWNsYXJhdGlvbiBpbiBwbGFjZSBhcyBhblxuICAgICAgICAgIC8vIGluaXRpYWxpemVyIHRvIGB1bmRlZmluZWRgLCBhbmQgc2V0IHRoZSB2YXJpYWJsZSB0byBpdHMgdmFsdWUgYWZ0ZXIgaXRzIGRlY2xhcmF0aW9uLlxuICAgICAgICAgIGNvbnN0IGluaXRpYWxpemVyID0gZGVjbE9wLmluaXRpYWxpemVyO1xuICAgICAgICAgIGRlY2xPcC5pbml0aWFsaXplciA9IG8ubGl0ZXJhbCh1bmRlZmluZWQpO1xuICAgICAgICAgIGRlY2xPcC5pc0NvbnN0YW50ID0gZmFsc2U7XG5cbiAgICAgICAgICBjb25zdCByZWFkVmFyID0gbmV3IGlyLlJlYWRWYXJpYWJsZUV4cHIoZGVjbE9wLnhyZWYpO1xuICAgICAgICAgIC8vIFRPRE86IHZhcmlhYmxlIG5hbWluZyBzaG91bGQgcnVuIGFmdGVyIHRoaXMgYW5kIHRha2UgY2FyZSBvZiB0aGlzIGZvciB1cy5cbiAgICAgICAgICByZWFkVmFyLm5hbWUgPSBkZWNsT3AudmFyaWFibGUubmFtZTtcbiAgICAgICAgICBjb25zdCBhc3NpZ25tZW50ID1cbiAgICAgICAgICAgICAgbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKG8uQmluYXJ5T3BlcmF0b3IuQXNzaWduLCByZWFkVmFyLCBpbml0aWFsaXplcik7XG4gICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVTdGF0ZW1lbnRPcChhc3NpZ25tZW50LnRvU3RtdCgpKSwgb3ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzaGFsbG93RGVjbGFyYXRpb25zLmRlbGV0ZShvcC54cmVmKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==