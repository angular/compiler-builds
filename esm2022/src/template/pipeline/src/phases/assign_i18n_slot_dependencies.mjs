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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUFtQjtJQUM1RCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO0lBQzlELElBQUksZ0JBQWdCLEdBQW1CLElBQUksQ0FBQztJQUM1QyxJQUFJLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lBRTlDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLGtFQUFrRTtRQUNsRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO1lBQzdCLENBQUM7WUFFRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUM7b0JBQ25CLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87b0JBQ3BCLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxhQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFpQixDQUFDLENBQUM7b0JBQ2xFLGFBQWEsR0FBRyxJQUFJLENBQUM7b0JBQ3JCLE1BQU07WUFDVixDQUFDO1FBQ0gsQ0FBQztRQUVELDJGQUEyRjtRQUMzRixxRkFBcUY7UUFDckYsNkJBQTZCO1FBQzdCLHFGQUFxRjtRQUNyRiw4RkFBOEY7UUFDOUYsbURBQW1EO1FBQ25ELElBQUksWUFBWSxHQUFtQixJQUFJLENBQUM7UUFDeEMsSUFBSSxTQUFTLEdBQWtCLEVBQUUsQ0FBQztRQUNsQyxJQUFJLGNBQWMsR0FBbUIsSUFBSSxDQUFDO1FBQzFDLElBQUksYUFBYSxHQUFtQixJQUFJLENBQUM7UUFDekMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsYUFBYSxHQUFHLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBRXZFLGlDQUFpQztZQUNqQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDekMsRUFBRSxDQUFDLE1BQU0sR0FBRyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDO2dCQUNsRCxZQUFZLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQztZQUMzQixDQUFDO1lBRUQsc0RBQXNEO1lBQ3RELElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQzVFLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ25CLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO2dCQUNsQyxhQUFhLEdBQUcsWUFBWSxDQUFDO1lBQy9CLENBQUM7WUFFRCwyRkFBMkY7WUFDM0YsWUFBWTtZQUNaLElBQUksWUFBWSxLQUFLLElBQUksSUFBSSxjQUFjLEtBQUssWUFBWTtnQkFDeEQsYUFBYSxLQUFLLGNBQWMsRUFBRSxDQUFDO2dCQUNyQyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3RDLFNBQVMsR0FBRyxFQUFFLENBQUM7WUFDakIsQ0FBQztZQUVELHVEQUF1RDtZQUN2RCxjQUFjLEdBQUcsYUFBYSxDQUFDO1FBQ2pDLENBQUM7UUFFRCx1RkFBdUY7UUFDdkYsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogVXBkYXRlcyBpMThuIGV4cHJlc3Npb24gb3BzIHRvIGRlcGVuZCBvbiB0aGUgbGFzdCBzbG90IGluIHRoZWlyIG93bmluZyBpMThuIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzaWduSTE4blNsb3REZXBlbmRlbmNpZXMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBjb25zdCBpMThuTGFzdFNsb3RDb25zdW1lcnMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuWHJlZklkPigpO1xuICBsZXQgbGFzdFNsb3RDb25zdW1lcjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgY3VycmVudEkxOG5PcDogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFJlY29yZCB0aGUgbGFzdCBjb25zdW1lZCBzbG90IGJlZm9yZSBlYWNoIGkxOG4gZW5kIGluc3RydWN0aW9uLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChpci5oYXNDb25zdW1lc1Nsb3RUcmFpdChvcCkpIHtcbiAgICAgICAgbGFzdFNsb3RDb25zdW1lciA9IG9wLnhyZWY7XG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG9wO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGkxOG5MYXN0U2xvdENvbnN1bWVycy5zZXQoY3VycmVudEkxOG5PcCEueHJlZiwgbGFzdFNsb3RDb25zdW1lciEpO1xuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFzc2lnbiBpMThuIGV4cHJlc3Npb25zIHRvIHRhcmdldCB0aGUgbGFzdCBzbG90IGluIHRoZWlyIG93bmluZyBibG9jay4gQWxzbyBtb3ZlIHRoZSBvcHNcbiAgICAvLyBiZWxvdyBhbnkgb3RoZXIgb3BzIHRoYXQgZGVwZW5kIG9uIHRoYXQgc2FtZSBzbG90IGNvbnRleHQgdG8gbWltaWMgdGhlIGJlaGF2aW9yIG9mXG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci5cbiAgICAvLyBUT0RPKG1tYWxlcmJhKTogV2UgbWF5IHdhbnQgdG8gc2ltcGxpZnkgdGhlIG9yZGVyaW5nIGxvZ2ljIG9uY2UgY29tcGF0aWJpbGl0eSB3aXRoXG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpcyBubyBsb25nZXIgcmVxdWlyZWQuIFRob3VnaCB3ZSBsaWtlbHkgc3RpbGwgd2FudCAqc29tZSogdHlwZSBvZlxuICAgIC8vIG9yZGVyaW5nIHRvIG1heGltaXplIG9wcG9ydHVuaXRpZXMgZm9yIGNoYWluaW5nLlxuICAgIGxldCBtb3ZlVG9UYXJnZXQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICBsZXQgb3BzVG9Nb3ZlOiBpci5VcGRhdGVPcFtdID0gW107XG4gICAgbGV0IHByZXZpb3VzVGFyZ2V0OiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gICAgbGV0IGN1cnJlbnRUYXJnZXQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBjdXJyZW50VGFyZ2V0ID0gaXIuaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdChvcCkgPyBvcC50YXJnZXQgOiBudWxsO1xuXG4gICAgICAvLyBSZS10YXJnZXQgaTE4biBleHByZXNzaW9uIG9wcy5cbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgb3AudGFyZ2V0ID0gaTE4bkxhc3RTbG90Q29uc3VtZXJzLmdldChvcC50YXJnZXQpITtcbiAgICAgICAgbW92ZVRvVGFyZ2V0ID0gb3AudGFyZ2V0O1xuICAgICAgfVxuXG4gICAgICAvLyBQdWxsIG91dCBpMThuIGV4cHJlc3Npb24gYW5kIGFwcGx5IG9wcyB0byBiZSBtb3ZlZC5cbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24gfHwgb3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5BcHBseSkge1xuICAgICAgICBvcHNUb01vdmUucHVzaChvcCk7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuVXBkYXRlT3A+KG9wKTtcbiAgICAgICAgY3VycmVudFRhcmdldCA9IG1vdmVUb1RhcmdldDtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGJhY2sgYW55IG9wcyB0aGF0IHdlcmUgcHJldmlvdXNseSBwdWxsZWQgb25jZSB3ZSBwYXNzIHRoZSBwb2ludCB3aGVyZSB0aGV5IHNob3VsZCBiZVxuICAgICAgLy8gaW5zZXJ0ZWQuXG4gICAgICBpZiAobW92ZVRvVGFyZ2V0ICE9PSBudWxsICYmIHByZXZpb3VzVGFyZ2V0ID09PSBtb3ZlVG9UYXJnZXQgJiZcbiAgICAgICAgICBjdXJyZW50VGFyZ2V0ICE9PSBwcmV2aW91c1RhcmdldCkge1xuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlKG9wc1RvTW92ZSwgb3ApO1xuICAgICAgICBvcHNUb01vdmUgPSBbXTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRoZSBwcmV2aW91cyB0YXJnZXQgZm9yIHRoZSBuZXh0IHBhc3MgdGhyb3VnaFxuICAgICAgcHJldmlvdXNUYXJnZXQgPSBjdXJyZW50VGFyZ2V0O1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGFyZSBhbnkgbXZvZWQgb3BzIHRoYXQgaGF2ZW4ndCBiZWVuIHB1dCBiYWNrIHlldCwgcHV0IHRoZW0gYmFjayBhdCB0aGUgZW5kLlxuICAgIGlmIChvcHNUb01vdmUpIHtcbiAgICAgIHVuaXQudXBkYXRlLnB1c2gob3BzVG9Nb3ZlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==