/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Updates i18n expression ops to depend on the last slot in their owning i18n block.
 */
export function assignI18nSlotDependencies(job) {
    const i18nLastSlotConsumers = new Map();
    let lastSlotConsumer = null;
    let currentI18nOp = null;
    for (const unit of job.units) {
        // Record the last consumed slot before each i18n end instruction.
        for (const op of unit.create) {
            if (ir.hasConsumesSlotTrait(op)) {
                lastSlotConsumer = op.xref;
            }
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nOp = op;
                    break;
                case ir.OpKind.I18nEnd:
                    i18nLastSlotConsumers.set(currentI18nOp.xref, lastSlotConsumer);
                    currentI18nOp = null;
                    break;
            }
        }
        // Assign i18n expressions to target the last slot in their owning block. Also move the ops
        // below any other ops that depend on that same slot context to mimic the behavior of
        // TemplateDefinitionBuilder.
        // TODO(mmalerba): We may want to simplify the ordering logic once compatibility with
        // TemplateDefinitionBuilder is no longer required. Though we likely still want *some* type of
        // ordering to maximize opportunities for chaining.
        let moveToTarget = null;
        let opsToMove = [];
        let previousTarget = null;
        let currentTarget = null;
        for (const op of unit.update) {
            currentTarget = ir.hasDependsOnSlotContextTrait(op) ? op.target : null;
            // Re-target i18n expression ops.
            if (op.kind === ir.OpKind.I18nExpression) {
                op.target = i18nLastSlotConsumers.get(op.target);
                moveToTarget = op.target;
            }
            // Pull out i18n expression and apply ops to be moved.
            if (op.kind === ir.OpKind.I18nExpression || op.kind === ir.OpKind.I18nApply) {
                opsToMove.push(op);
                ir.OpList.remove(op);
                currentTarget = moveToTarget;
            }
            // Add back any ops that were previously pulled once we pass the point where they should be
            // inserted.
            if (moveToTarget !== null && previousTarget === moveToTarget &&
                currentTarget !== previousTarget) {
                ir.OpList.insertBefore(opsToMove, op);
                opsToMove = [];
            }
            // Update the previous target for the next pass through
            previousTarget = currentTarget;
        }
        // If there are any mvoed ops that haven't been put back yet, put them back at the end.
        if (opsToMove) {
            unit.update.push(opsToMove);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUFtQjtJQUM1RCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO0lBQzlELElBQUksZ0JBQWdCLEdBQW1CLElBQUksQ0FBQztJQUM1QyxJQUFJLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lBRTlDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixrRUFBa0U7UUFDbEUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixnQkFBZ0IsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO2FBQzVCO1lBRUQsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixhQUFhLEdBQUcsRUFBRSxDQUFDO29CQUNuQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixxQkFBcUIsQ0FBQyxHQUFHLENBQUMsYUFBYyxDQUFDLElBQUksRUFBRSxnQkFBaUIsQ0FBQyxDQUFDO29CQUNsRSxhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUNyQixNQUFNO2FBQ1Q7U0FDRjtRQUVELDJGQUEyRjtRQUMzRixxRkFBcUY7UUFDckYsNkJBQTZCO1FBQzdCLHFGQUFxRjtRQUNyRiw4RkFBOEY7UUFDOUYsbURBQW1EO1FBQ25ELElBQUksWUFBWSxHQUFtQixJQUFJLENBQUM7UUFDeEMsSUFBSSxTQUFTLEdBQWtCLEVBQUUsQ0FBQztRQUNsQyxJQUFJLGNBQWMsR0FBbUIsSUFBSSxDQUFDO1FBQzFDLElBQUksYUFBYSxHQUFtQixJQUFJLENBQUM7UUFDekMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLGFBQWEsR0FBRyxFQUFFLENBQUMsNEJBQTRCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUV2RSxpQ0FBaUM7WUFDakMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO2dCQUN4QyxFQUFFLENBQUMsTUFBTSxHQUFHLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUM7Z0JBQ2xELFlBQVksR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDO2FBQzFCO1lBRUQsc0RBQXNEO1lBQ3RELElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFO2dCQUMzRSxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNuQixFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztnQkFDbEMsYUFBYSxHQUFHLFlBQVksQ0FBQzthQUM5QjtZQUVELDJGQUEyRjtZQUMzRixZQUFZO1lBQ1osSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLGNBQWMsS0FBSyxZQUFZO2dCQUN4RCxhQUFhLEtBQUssY0FBYyxFQUFFO2dCQUNwQyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3RDLFNBQVMsR0FBRyxFQUFFLENBQUM7YUFDaEI7WUFFRCx1REFBdUQ7WUFDdkQsY0FBYyxHQUFHLGFBQWEsQ0FBQztTQUNoQztRQUVELHVGQUF1RjtRQUN2RixJQUFJLFNBQVMsRUFBRTtZQUNiLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzdCO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBVcGRhdGVzIGkxOG4gZXhwcmVzc2lvbiBvcHMgdG8gZGVwZW5kIG9uIHRoZSBsYXN0IHNsb3QgaW4gdGhlaXIgb3duaW5nIGkxOG4gYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NpZ25JMThuU2xvdERlcGVuZGVuY2llcyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGNvbnN0IGkxOG5MYXN0U2xvdENvbnN1bWVycyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5YcmVmSWQ+KCk7XG4gIGxldCBsYXN0U2xvdENvbnN1bWVyOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gIGxldCBjdXJyZW50STE4bk9wOiBpci5JMThuU3RhcnRPcHxudWxsID0gbnVsbDtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgLy8gUmVjb3JkIHRoZSBsYXN0IGNvbnN1bWVkIHNsb3QgYmVmb3JlIGVhY2ggaTE4biBlbmQgaW5zdHJ1Y3Rpb24uXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0KG9wKSkge1xuICAgICAgICBsYXN0U2xvdENvbnN1bWVyID0gb3AueHJlZjtcbiAgICAgIH1cblxuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gb3A7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgaTE4bkxhc3RTbG90Q29uc3VtZXJzLnNldChjdXJyZW50STE4bk9wIS54cmVmLCBsYXN0U2xvdENvbnN1bWVyISk7XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXNzaWduIGkxOG4gZXhwcmVzc2lvbnMgdG8gdGFyZ2V0IHRoZSBsYXN0IHNsb3QgaW4gdGhlaXIgb3duaW5nIGJsb2NrLiBBbHNvIG1vdmUgdGhlIG9wc1xuICAgIC8vIGJlbG93IGFueSBvdGhlciBvcHMgdGhhdCBkZXBlbmQgb24gdGhhdCBzYW1lIHNsb3QgY29udGV4dCB0byBtaW1pYyB0aGUgYmVoYXZpb3Igb2ZcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLlxuICAgIC8vIFRPRE8obW1hbGVyYmEpOiBXZSBtYXkgd2FudCB0byBzaW1wbGlmeSB0aGUgb3JkZXJpbmcgbG9naWMgb25jZSBjb21wYXRpYmlsaXR5IHdpdGhcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGlzIG5vIGxvbmdlciByZXF1aXJlZC4gVGhvdWdoIHdlIGxpa2VseSBzdGlsbCB3YW50ICpzb21lKiB0eXBlIG9mXG4gICAgLy8gb3JkZXJpbmcgdG8gbWF4aW1pemUgb3Bwb3J0dW5pdGllcyBmb3IgY2hhaW5pbmcuXG4gICAgbGV0IG1vdmVUb1RhcmdldDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICAgIGxldCBvcHNUb01vdmU6IGlyLlVwZGF0ZU9wW10gPSBbXTtcbiAgICBsZXQgcHJldmlvdXNUYXJnZXQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudFRhcmdldDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGN1cnJlbnRUYXJnZXQgPSBpci5oYXNEZXBlbmRzT25TbG90Q29udGV4dFRyYWl0KG9wKSA/IG9wLnRhcmdldCA6IG51bGw7XG5cbiAgICAgIC8vIFJlLXRhcmdldCBpMThuIGV4cHJlc3Npb24gb3BzLlxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgICAgICBvcC50YXJnZXQgPSBpMThuTGFzdFNsb3RDb25zdW1lcnMuZ2V0KG9wLnRhcmdldCkhO1xuICAgICAgICBtb3ZlVG9UYXJnZXQgPSBvcC50YXJnZXQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFB1bGwgb3V0IGkxOG4gZXhwcmVzc2lvbiBhbmQgYXBwbHkgb3BzIHRvIGJlIG1vdmVkLlxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbiB8fCBvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkFwcGx5KSB7XG4gICAgICAgIG9wc1RvTW92ZS5wdXNoKG9wKTtcbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5VcGRhdGVPcD4ob3ApO1xuICAgICAgICBjdXJyZW50VGFyZ2V0ID0gbW92ZVRvVGFyZ2V0O1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgYmFjayBhbnkgb3BzIHRoYXQgd2VyZSBwcmV2aW91c2x5IHB1bGxlZCBvbmNlIHdlIHBhc3MgdGhlIHBvaW50IHdoZXJlIHRoZXkgc2hvdWxkIGJlXG4gICAgICAvLyBpbnNlcnRlZC5cbiAgICAgIGlmIChtb3ZlVG9UYXJnZXQgIT09IG51bGwgJiYgcHJldmlvdXNUYXJnZXQgPT09IG1vdmVUb1RhcmdldCAmJlxuICAgICAgICAgIGN1cnJlbnRUYXJnZXQgIT09IHByZXZpb3VzVGFyZ2V0KSB7XG4gICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmUob3BzVG9Nb3ZlLCBvcCk7XG4gICAgICAgIG9wc1RvTW92ZSA9IFtdO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGhlIHByZXZpb3VzIHRhcmdldCBmb3IgdGhlIG5leHQgcGFzcyB0aHJvdWdoXG4gICAgICBwcmV2aW91c1RhcmdldCA9IGN1cnJlbnRUYXJnZXQ7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgYXJlIGFueSBtdm9lZCBvcHMgdGhhdCBoYXZlbid0IGJlZW4gcHV0IGJhY2sgeWV0LCBwdXQgdGhlbSBiYWNrIGF0IHRoZSBlbmQuXG4gICAgaWYgKG9wc1RvTW92ZSkge1xuICAgICAgdW5pdC51cGRhdGUucHVzaChvcHNUb01vdmUpO1xuICAgIH1cbiAgfVxufVxuIl19