/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { varsUsedByIrExpression } from './var_counting';
export function phaseAlignPipeVariadicVarOffset(job) {
    for (const unit of job.units) {
        for (const op of unit.update) {
            ir.visitExpressionsInOp(op, expr => {
                if (!(expr instanceof ir.PipeBindingVariadicExpr)) {
                    return expr;
                }
                if (!(expr.args instanceof ir.PureFunctionExpr)) {
                    return expr;
                }
                if (expr.varOffset === null || expr.args.varOffset === null) {
                    throw new Error(`Must run after variable counting`);
                }
                // The structure of this variadic pipe expression is:
                // PipeBindingVariadic(#, Y, PureFunction(X, ...ARGS))
                // Where X and Y are the slot offsets for the variables used by these operations, and Y > X.
                // In `TemplateDefinitionBuilder` the PipeBindingVariadic variable slots are allocated
                // before the PureFunction slots, which is unusually out-of-order.
                //
                // To maintain identical output for the tests in question, we adjust the variable offsets of
                // these two calls to emulate TDB's behavior. This is not perfect, because the ARGS of the
                // PureFunction call may also allocate slots which by TDB's ordering would come after X, and
                // we don't account for that. Still, this should be enough to pass the existing pipe tests.
                // Put the PipeBindingVariadic vars where the PureFunction vars were previously allocated.
                expr.varOffset = expr.args.varOffset;
                // Put the PureFunction vars following the PipeBindingVariadic vars.
                expr.args.varOffset = expr.varOffset + varsUsedByIrExpression(expr);
                return undefined;
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxpZ25fcGlwZV92YXJpYWRpY192YXJfb2Zmc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvYWxpZ25fcGlwZV92YXJpYWRpY192YXJfb2Zmc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRXRELE1BQU0sVUFBVSwrQkFBK0IsQ0FBQyxHQUFtQjtJQUNqRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRTtvQkFDakQsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBRUQsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtvQkFDL0MsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBRUQsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7b0JBQzNELE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztpQkFDckQ7Z0JBRUQscURBQXFEO2dCQUNyRCxzREFBc0Q7Z0JBQ3RELDRGQUE0RjtnQkFFNUYsc0ZBQXNGO2dCQUN0RixrRUFBa0U7Z0JBQ2xFLEVBQUU7Z0JBQ0YsNEZBQTRGO2dCQUM1RiwwRkFBMEY7Z0JBQzFGLDRGQUE0RjtnQkFDNUYsMkZBQTJGO2dCQUUzRiwwRkFBMEY7Z0JBQzFGLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBRXJDLG9FQUFvRTtnQkFDcEUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDcEUsT0FBTyxTQUFTLENBQUM7WUFDbkIsQ0FBQyxDQUFDLENBQUM7U0FDSjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHt2YXJzVXNlZEJ5SXJFeHByZXNzaW9ufSBmcm9tICcuL3Zhcl9jb3VudGluZyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUFsaWduUGlwZVZhcmlhZGljVmFyT2Zmc2V0KGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIGlyLlBpcGVCaW5kaW5nVmFyaWFkaWNFeHByKSkge1xuICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEoZXhwci5hcmdzIGluc3RhbmNlb2YgaXIuUHVyZUZ1bmN0aW9uRXhwcikpIHtcbiAgICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChleHByLnZhck9mZnNldCA9PT0gbnVsbCB8fCBleHByLmFyZ3MudmFyT2Zmc2V0ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNdXN0IHJ1biBhZnRlciB2YXJpYWJsZSBjb3VudGluZ2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIHN0cnVjdHVyZSBvZiB0aGlzIHZhcmlhZGljIHBpcGUgZXhwcmVzc2lvbiBpczpcbiAgICAgICAgLy8gUGlwZUJpbmRpbmdWYXJpYWRpYygjLCBZLCBQdXJlRnVuY3Rpb24oWCwgLi4uQVJHUykpXG4gICAgICAgIC8vIFdoZXJlIFggYW5kIFkgYXJlIHRoZSBzbG90IG9mZnNldHMgZm9yIHRoZSB2YXJpYWJsZXMgdXNlZCBieSB0aGVzZSBvcGVyYXRpb25zLCBhbmQgWSA+IFguXG5cbiAgICAgICAgLy8gSW4gYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgIHRoZSBQaXBlQmluZGluZ1ZhcmlhZGljIHZhcmlhYmxlIHNsb3RzIGFyZSBhbGxvY2F0ZWRcbiAgICAgICAgLy8gYmVmb3JlIHRoZSBQdXJlRnVuY3Rpb24gc2xvdHMsIHdoaWNoIGlzIHVudXN1YWxseSBvdXQtb2Ytb3JkZXIuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRvIG1haW50YWluIGlkZW50aWNhbCBvdXRwdXQgZm9yIHRoZSB0ZXN0cyBpbiBxdWVzdGlvbiwgd2UgYWRqdXN0IHRoZSB2YXJpYWJsZSBvZmZzZXRzIG9mXG4gICAgICAgIC8vIHRoZXNlIHR3byBjYWxscyB0byBlbXVsYXRlIFREQidzIGJlaGF2aW9yLiBUaGlzIGlzIG5vdCBwZXJmZWN0LCBiZWNhdXNlIHRoZSBBUkdTIG9mIHRoZVxuICAgICAgICAvLyBQdXJlRnVuY3Rpb24gY2FsbCBtYXkgYWxzbyBhbGxvY2F0ZSBzbG90cyB3aGljaCBieSBUREIncyBvcmRlcmluZyB3b3VsZCBjb21lIGFmdGVyIFgsIGFuZFxuICAgICAgICAvLyB3ZSBkb24ndCBhY2NvdW50IGZvciB0aGF0LiBTdGlsbCwgdGhpcyBzaG91bGQgYmUgZW5vdWdoIHRvIHBhc3MgdGhlIGV4aXN0aW5nIHBpcGUgdGVzdHMuXG5cbiAgICAgICAgLy8gUHV0IHRoZSBQaXBlQmluZGluZ1ZhcmlhZGljIHZhcnMgd2hlcmUgdGhlIFB1cmVGdW5jdGlvbiB2YXJzIHdlcmUgcHJldmlvdXNseSBhbGxvY2F0ZWQuXG4gICAgICAgIGV4cHIudmFyT2Zmc2V0ID0gZXhwci5hcmdzLnZhck9mZnNldDtcblxuICAgICAgICAvLyBQdXQgdGhlIFB1cmVGdW5jdGlvbiB2YXJzIGZvbGxvd2luZyB0aGUgUGlwZUJpbmRpbmdWYXJpYWRpYyB2YXJzLlxuICAgICAgICBleHByLmFyZ3MudmFyT2Zmc2V0ID0gZXhwci52YXJPZmZzZXQgKyB2YXJzVXNlZEJ5SXJFeHByZXNzaW9uKGV4cHIpO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iXX0=