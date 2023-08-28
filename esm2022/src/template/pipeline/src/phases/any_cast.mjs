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
 * Find any function calls to `$any`, excluding `this.$any`, and delete them.
 */
export function phaseFindAnyCasts(job) {
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            ir.transformExpressionsInOp(op, removeAnys, ir.VisitorContextFlag.None);
        }
    }
}
function removeAnys(e) {
    if (e instanceof o.InvokeFunctionExpr && e.fn instanceof ir.LexicalReadExpr &&
        e.fn.name === '$any') {
        if (e.args.length !== 1) {
            throw new Error('The $any builtin function expects exactly one argument.');
        }
        return e.args[0];
    }
    return e;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW55X2Nhc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hbnlfY2FzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEdBQW1CO0lBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixFQUFFLENBQUMsd0JBQXdCLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDekU7S0FDRjtBQUNILENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxDQUFlO0lBQ2pDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLENBQUMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxlQUFlO1FBQ3ZFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUN4QixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7U0FDNUU7UUFDRCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDbEI7SUFDRCxPQUFPLENBQUMsQ0FBQztBQUNYLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogRmluZCBhbnkgZnVuY3Rpb24gY2FsbHMgdG8gYCRhbnlgLCBleGNsdWRpbmcgYHRoaXMuJGFueWAsIGFuZCBkZWxldGUgdGhlbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlRmluZEFueUNhc3RzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCByZW1vdmVBbnlzLCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUFueXMoZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGUgaW5zdGFuY2VvZiBvLkludm9rZUZ1bmN0aW9uRXhwciAmJiBlLmZuIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByICYmXG4gICAgICBlLmZuLm5hbWUgPT09ICckYW55Jykge1xuICAgIGlmIChlLmFyZ3MubGVuZ3RoICE9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSAkYW55IGJ1aWx0aW4gZnVuY3Rpb24gZXhwZWN0cyBleGFjdGx5IG9uZSBhcmd1bWVudC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGUuYXJnc1swXTtcbiAgfVxuICByZXR1cm4gZTtcbn1cbiJdfQ==