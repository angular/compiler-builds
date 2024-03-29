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
 * Nullish coalescing expressions such as `a ?? b` have different semantics in Angular templates as
 * compared to JavaScript. In particular, they default to `null` instead of `undefined`. Therefore,
 * we replace them with ternary expressions, assigning temporaries as needed to avoid re-evaluating
 * the same sub-expression multiple times.
 */
export function generateNullishCoalesceExpressions(job) {
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            ir.transformExpressionsInOp(op, expr => {
                if (!(expr instanceof o.BinaryOperatorExpr) ||
                    expr.operator !== o.BinaryOperator.NullishCoalesce) {
                    return expr;
                }
                const assignment = new ir.AssignTemporaryExpr(expr.lhs.clone(), job.allocateXrefId());
                const read = new ir.ReadTemporaryExpr(assignment.xref);
                // TODO: When not in compatibility mode for TemplateDefinitionBuilder, we can just emit
                // `t != null` instead of including an undefined check as well.
                return new o.ConditionalExpr(new o.BinaryOperatorExpr(o.BinaryOperator.And, new o.BinaryOperatorExpr(o.BinaryOperator.NotIdentical, assignment, o.NULL_EXPR), new o.BinaryOperatorExpr(o.BinaryOperator.NotIdentical, read, new o.LiteralExpr(undefined))), read.clone(), expr.rhs);
            }, ir.VisitorContextFlag.None);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibnVsbGlzaF9jb2FsZXNjaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbnVsbGlzaF9jb2FsZXNjaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsa0NBQWtDLENBQUMsR0FBbUI7SUFDcEUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUM1QixFQUFFLENBQUMsd0JBQXdCLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNyQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLGtCQUFrQixDQUFDO29CQUN2QyxJQUFJLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ3ZELE9BQU8sSUFBSSxDQUFDO2dCQUNkLENBQUM7Z0JBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztnQkFDdEYsTUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUV2RCx1RkFBdUY7Z0JBQ3ZGLCtEQUErRDtnQkFDL0QsT0FBTyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQ3hCLElBQUksQ0FBQyxDQUFDLGtCQUFrQixDQUNwQixDQUFDLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFDcEIsSUFBSSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFDaEYsSUFBSSxDQUFDLENBQUMsa0JBQWtCLENBQ3BCLENBQUMsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUMzRSxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQ1osSUFBSSxDQUFDLEdBQUcsQ0FDWCxDQUFDO1lBQ0osQ0FBQyxFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqQyxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBOdWxsaXNoIGNvYWxlc2NpbmcgZXhwcmVzc2lvbnMgc3VjaCBhcyBgYSA/PyBiYCBoYXZlIGRpZmZlcmVudCBzZW1hbnRpY3MgaW4gQW5ndWxhciB0ZW1wbGF0ZXMgYXNcbiAqIGNvbXBhcmVkIHRvIEphdmFTY3JpcHQuIEluIHBhcnRpY3VsYXIsIHRoZXkgZGVmYXVsdCB0byBgbnVsbGAgaW5zdGVhZCBvZiBgdW5kZWZpbmVkYC4gVGhlcmVmb3JlLFxuICogd2UgcmVwbGFjZSB0aGVtIHdpdGggdGVybmFyeSBleHByZXNzaW9ucywgYXNzaWduaW5nIHRlbXBvcmFyaWVzIGFzIG5lZWRlZCB0byBhdm9pZCByZS1ldmFsdWF0aW5nXG4gKiB0aGUgc2FtZSBzdWItZXhwcmVzc2lvbiBtdWx0aXBsZSB0aW1lcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlTnVsbGlzaENvYWxlc2NlRXhwcmVzc2lvbnMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgICBpZiAoIShleHByIGluc3RhbmNlb2Ygby5CaW5hcnlPcGVyYXRvckV4cHIpIHx8XG4gICAgICAgICAgICBleHByLm9wZXJhdG9yICE9PSBvLkJpbmFyeU9wZXJhdG9yLk51bGxpc2hDb2FsZXNjZSkge1xuICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXNzaWdubWVudCA9IG5ldyBpci5Bc3NpZ25UZW1wb3JhcnlFeHByKGV4cHIubGhzLmNsb25lKCksIGpvYi5hbGxvY2F0ZVhyZWZJZCgpKTtcbiAgICAgICAgY29uc3QgcmVhZCA9IG5ldyBpci5SZWFkVGVtcG9yYXJ5RXhwcihhc3NpZ25tZW50LnhyZWYpO1xuXG4gICAgICAgIC8vIFRPRE86IFdoZW4gbm90IGluIGNvbXBhdGliaWxpdHkgbW9kZSBmb3IgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgd2UgY2FuIGp1c3QgZW1pdFxuICAgICAgICAvLyBgdCAhPSBudWxsYCBpbnN0ZWFkIG9mIGluY2x1ZGluZyBhbiB1bmRlZmluZWQgY2hlY2sgYXMgd2VsbC5cbiAgICAgICAgcmV0dXJuIG5ldyBvLkNvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgICAgICBvLkJpbmFyeU9wZXJhdG9yLkFuZCxcbiAgICAgICAgICAgICAgICBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWwsIGFzc2lnbm1lbnQsIG8uTlVMTF9FWFBSKSxcbiAgICAgICAgICAgICAgICBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICAgICAgICAgIG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsLCByZWFkLCBuZXcgby5MaXRlcmFsRXhwcih1bmRlZmluZWQpKSksXG4gICAgICAgICAgICByZWFkLmNsb25lKCksXG4gICAgICAgICAgICBleHByLnJocyxcbiAgICAgICAgKTtcbiAgICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==