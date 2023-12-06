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
                    if (currentI18nOp === null) {
                        throw new Error('AssertionError: Expected an active I18n block while calculating last slot consumers');
                    }
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
                // TODO: Is this handling of i18n bindings correct?
                op.target = op.usage === ir.I18nExpressionContext.Normal ?
                    i18nLastSlotConsumers.get(op.target) :
                    op.target;
                if (op.target === undefined) {
                    throw new Error('AssertionError: Expected every I18nExpressionOp to have a valid reordering target');
                }
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
        // If there are any moved ops that haven't been put back yet, put them back at the end.
        if (opsToMove) {
            unit.update.push(opsToMove);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUFtQjtJQUM1RCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO0lBQzlELElBQUksZ0JBQWdCLEdBQW1CLElBQUksQ0FBQztJQUM1QyxJQUFJLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lBRTlDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixrRUFBa0U7UUFDbEUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixnQkFBZ0IsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO2FBQzVCO1lBRUQsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixhQUFhLEdBQUcsRUFBRSxDQUFDO29CQUNuQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUU7d0JBQzFCLE1BQU0sSUFBSSxLQUFLLENBQ1gscUZBQXFGLENBQUMsQ0FBQztxQkFDNUY7b0JBQ0QscUJBQXFCLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsZ0JBQWlCLENBQUMsQ0FBQztvQkFDakUsYUFBYSxHQUFHLElBQUksQ0FBQztvQkFDckIsTUFBTTthQUNUO1NBQ0Y7UUFFRCwyRkFBMkY7UUFDM0YscUZBQXFGO1FBQ3JGLDZCQUE2QjtRQUM3QixxRkFBcUY7UUFDckYsOEZBQThGO1FBQzlGLG1EQUFtRDtRQUNuRCxJQUFJLFlBQVksR0FBbUIsSUFBSSxDQUFDO1FBQ3hDLElBQUksU0FBUyxHQUFrQixFQUFFLENBQUM7UUFDbEMsSUFBSSxjQUFjLEdBQW1CLElBQUksQ0FBQztRQUMxQyxJQUFJLGFBQWEsR0FBbUIsSUFBSSxDQUFDO1FBQ3pDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixhQUFhLEdBQUcsRUFBRSxDQUFDLDRCQUE0QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFFdkUsaUNBQWlDO1lBQ2pDLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtnQkFDeEMsbURBQW1EO2dCQUNuRCxFQUFFLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN0RCxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDLENBQUM7b0JBQ3ZDLEVBQUUsQ0FBQyxNQUFNLENBQUM7Z0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtvQkFDM0IsTUFBTSxJQUFJLEtBQUssQ0FDWCxtRkFBbUYsQ0FBQyxDQUFDO2lCQUMxRjtnQkFDRCxZQUFZLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUMxQjtZQUVELHNEQUFzRDtZQUN0RCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtnQkFDM0UsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDbkIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7Z0JBQ2xDLGFBQWEsR0FBRyxZQUFZLENBQUM7YUFDOUI7WUFFRCwyRkFBMkY7WUFDM0YsWUFBWTtZQUNaLElBQUksWUFBWSxLQUFLLElBQUksSUFBSSxjQUFjLEtBQUssWUFBWTtnQkFDeEQsYUFBYSxLQUFLLGNBQWMsRUFBRTtnQkFDcEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUN0QyxTQUFTLEdBQUcsRUFBRSxDQUFDO2FBQ2hCO1lBRUQsdURBQXVEO1lBQ3ZELGNBQWMsR0FBRyxhQUFhLENBQUM7U0FDaEM7UUFFRCx1RkFBdUY7UUFDdkYsSUFBSSxTQUFTLEVBQUU7WUFDYixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM3QjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogVXBkYXRlcyBpMThuIGV4cHJlc3Npb24gb3BzIHRvIGRlcGVuZCBvbiB0aGUgbGFzdCBzbG90IGluIHRoZWlyIG93bmluZyBpMThuIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzaWduSTE4blNsb3REZXBlbmRlbmNpZXMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBjb25zdCBpMThuTGFzdFNsb3RDb25zdW1lcnMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuWHJlZklkPigpO1xuICBsZXQgbGFzdFNsb3RDb25zdW1lcjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgY3VycmVudEkxOG5PcDogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFJlY29yZCB0aGUgbGFzdCBjb25zdW1lZCBzbG90IGJlZm9yZSBlYWNoIGkxOG4gZW5kIGluc3RydWN0aW9uLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChpci5oYXNDb25zdW1lc1Nsb3RUcmFpdChvcCkpIHtcbiAgICAgICAgbGFzdFNsb3RDb25zdW1lciA9IG9wLnhyZWY7XG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG9wO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBFeHBlY3RlZCBhbiBhY3RpdmUgSTE4biBibG9jayB3aGlsZSBjYWxjdWxhdGluZyBsYXN0IHNsb3QgY29uc3VtZXJzJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGkxOG5MYXN0U2xvdENvbnN1bWVycy5zZXQoY3VycmVudEkxOG5PcC54cmVmLCBsYXN0U2xvdENvbnN1bWVyISk7XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXNzaWduIGkxOG4gZXhwcmVzc2lvbnMgdG8gdGFyZ2V0IHRoZSBsYXN0IHNsb3QgaW4gdGhlaXIgb3duaW5nIGJsb2NrLiBBbHNvIG1vdmUgdGhlIG9wc1xuICAgIC8vIGJlbG93IGFueSBvdGhlciBvcHMgdGhhdCBkZXBlbmQgb24gdGhhdCBzYW1lIHNsb3QgY29udGV4dCB0byBtaW1pYyB0aGUgYmVoYXZpb3Igb2ZcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLlxuICAgIC8vIFRPRE8obW1hbGVyYmEpOiBXZSBtYXkgd2FudCB0byBzaW1wbGlmeSB0aGUgb3JkZXJpbmcgbG9naWMgb25jZSBjb21wYXRpYmlsaXR5IHdpdGhcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGlzIG5vIGxvbmdlciByZXF1aXJlZC4gVGhvdWdoIHdlIGxpa2VseSBzdGlsbCB3YW50ICpzb21lKiB0eXBlIG9mXG4gICAgLy8gb3JkZXJpbmcgdG8gbWF4aW1pemUgb3Bwb3J0dW5pdGllcyBmb3IgY2hhaW5pbmcuXG4gICAgbGV0IG1vdmVUb1RhcmdldDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICAgIGxldCBvcHNUb01vdmU6IGlyLlVwZGF0ZU9wW10gPSBbXTtcbiAgICBsZXQgcHJldmlvdXNUYXJnZXQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudFRhcmdldDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGN1cnJlbnRUYXJnZXQgPSBpci5oYXNEZXBlbmRzT25TbG90Q29udGV4dFRyYWl0KG9wKSA/IG9wLnRhcmdldCA6IG51bGw7XG5cbiAgICAgIC8vIFJlLXRhcmdldCBpMThuIGV4cHJlc3Npb24gb3BzLlxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgICAgICAvLyBUT0RPOiBJcyB0aGlzIGhhbmRsaW5nIG9mIGkxOG4gYmluZGluZ3MgY29ycmVjdD9cbiAgICAgICAgb3AudGFyZ2V0ID0gb3AudXNhZ2UgPT09IGlyLkkxOG5FeHByZXNzaW9uQ29udGV4dC5Ob3JtYWwgP1xuICAgICAgICAgICAgaTE4bkxhc3RTbG90Q29uc3VtZXJzLmdldChvcC50YXJnZXQpISA6XG4gICAgICAgICAgICBvcC50YXJnZXQ7XG4gICAgICAgIGlmIChvcC50YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBFeHBlY3RlZCBldmVyeSBJMThuRXhwcmVzc2lvbk9wIHRvIGhhdmUgYSB2YWxpZCByZW9yZGVyaW5nIHRhcmdldCcpO1xuICAgICAgICB9XG4gICAgICAgIG1vdmVUb1RhcmdldCA9IG9wLnRhcmdldDtcbiAgICAgIH1cblxuICAgICAgLy8gUHVsbCBvdXQgaTE4biBleHByZXNzaW9uIGFuZCBhcHBseSBvcHMgdG8gYmUgbW92ZWQuXG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uIHx8IG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuQXBwbHkpIHtcbiAgICAgICAgb3BzVG9Nb3ZlLnB1c2gob3ApO1xuICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gICAgICAgIGN1cnJlbnRUYXJnZXQgPSBtb3ZlVG9UYXJnZXQ7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBiYWNrIGFueSBvcHMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgcHVsbGVkIG9uY2Ugd2UgcGFzcyB0aGUgcG9pbnQgd2hlcmUgdGhleSBzaG91bGQgYmVcbiAgICAgIC8vIGluc2VydGVkLlxuICAgICAgaWYgKG1vdmVUb1RhcmdldCAhPT0gbnVsbCAmJiBwcmV2aW91c1RhcmdldCA9PT0gbW92ZVRvVGFyZ2V0ICYmXG4gICAgICAgICAgY3VycmVudFRhcmdldCAhPT0gcHJldmlvdXNUYXJnZXQpIHtcbiAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShvcHNUb01vdmUsIG9wKTtcbiAgICAgICAgb3BzVG9Nb3ZlID0gW107XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgcHJldmlvdXMgdGFyZ2V0IGZvciB0aGUgbmV4dCBwYXNzIHRocm91Z2hcbiAgICAgIHByZXZpb3VzVGFyZ2V0ID0gY3VycmVudFRhcmdldDtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgYW55IG1vdmVkIG9wcyB0aGF0IGhhdmVuJ3QgYmVlbiBwdXQgYmFjayB5ZXQsIHB1dCB0aGVtIGJhY2sgYXQgdGhlIGVuZC5cbiAgICBpZiAob3BzVG9Nb3ZlKSB7XG4gICAgICB1bml0LnVwZGF0ZS5wdXNoKG9wc1RvTW92ZSk7XG4gICAgfVxuICB9XG59XG4iXX0=