/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Updates i18n expression ops to target the last slot in their owning i18n block, and moves them
 * after the last update instruction that depends on that slot.
 */
export function assignI18nSlotDependencies(job) {
    for (const unit of job.units) {
        // The first update op.
        let updateOp = unit.update.head;
        // I18n expressions currently being moved during the iteration.
        let i18nExpressionsInProgress = [];
        // Non-null  while we are iterating through an i18nStart/i18nEnd pair
        let state = null;
        for (const createOp of unit.create) {
            if (createOp.kind === ir.OpKind.I18nStart) {
                state = {
                    blockXref: createOp.xref,
                    lastSlotConsumer: createOp.xref,
                };
            }
            else if (createOp.kind === ir.OpKind.I18nEnd) {
                for (const op of i18nExpressionsInProgress) {
                    op.target = state.lastSlotConsumer;
                    ir.OpList.insertBefore(op, updateOp);
                }
                i18nExpressionsInProgress.length = 0;
                state = null;
            }
            if (ir.hasConsumesSlotTrait(createOp)) {
                if (state !== null) {
                    state.lastSlotConsumer = createOp.xref;
                }
                while (true) {
                    if (updateOp.next === null) {
                        break;
                    }
                    if (state !== null && updateOp.kind === ir.OpKind.I18nExpression &&
                        updateOp.usage === ir.I18nExpressionFor.I18nText &&
                        updateOp.i18nOwner === state.blockXref) {
                        const opToRemove = updateOp;
                        updateOp = updateOp.next;
                        ir.OpList.remove(opToRemove);
                        i18nExpressionsInProgress.push(opToRemove);
                        continue;
                    }
                    if (ir.hasDependsOnSlotContextTrait(updateOp) && updateOp.target !== createOp.xref) {
                        break;
                    }
                    updateOp = updateOp.next;
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQVEvQjs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsR0FBbUI7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLHVCQUF1QjtRQUN2QixJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztRQUVoQywrREFBK0Q7UUFDL0QsSUFBSSx5QkFBeUIsR0FBMEIsRUFBRSxDQUFDO1FBRTFELHFFQUFxRTtRQUNyRSxJQUFJLEtBQUssR0FBb0IsSUFBSSxDQUFDO1FBRWxDLEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNsQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7Z0JBQ3pDLEtBQUssR0FBRztvQkFDTixTQUFTLEVBQUUsUUFBUSxDQUFDLElBQUk7b0JBQ3hCLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxJQUFJO2lCQUNoQyxDQUFDO2FBQ0g7aUJBQU0sSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO2dCQUM5QyxLQUFLLE1BQU0sRUFBRSxJQUFJLHlCQUF5QixFQUFFO29CQUMxQyxFQUFFLENBQUMsTUFBTSxHQUFHLEtBQU0sQ0FBQyxnQkFBZ0IsQ0FBQztvQkFDcEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBaUIsRUFBRSxRQUFTLENBQUMsQ0FBQztpQkFDdEQ7Z0JBQ0QseUJBQXlCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDckMsS0FBSyxHQUFHLElBQUksQ0FBQzthQUNkO1lBRUQsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ3JDLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtvQkFDbEIsS0FBSyxDQUFDLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7aUJBQ3hDO2dCQUVELE9BQU8sSUFBSSxFQUFFO29CQUNYLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7d0JBQzFCLE1BQU07cUJBQ1A7b0JBRUQsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjO3dCQUM1RCxRQUFRLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRO3dCQUNoRCxRQUFRLENBQUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxTQUFTLEVBQUU7d0JBQzFDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQzt3QkFDNUIsUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFLLENBQUM7d0JBQzFCLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLFVBQVUsQ0FBQyxDQUFDO3dCQUMxQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7d0JBQzNDLFNBQVM7cUJBQ1Y7b0JBRUQsSUFBSSxFQUFFLENBQUMsNEJBQTRCLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsSUFBSSxFQUFFO3dCQUNsRixNQUFNO3FCQUNQO29CQUVELFFBQVEsR0FBRyxRQUFRLENBQUMsSUFBSyxDQUFDO2lCQUMzQjthQUNGO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5pbnRlcmZhY2UgQmxvY2tTdGF0ZSB7XG4gIGJsb2NrWHJlZjogaXIuWHJlZklkO1xuICBsYXN0U2xvdENvbnN1bWVyOiBpci5YcmVmSWQ7XG59XG5cbi8qKlxuICogVXBkYXRlcyBpMThuIGV4cHJlc3Npb24gb3BzIHRvIHRhcmdldCB0aGUgbGFzdCBzbG90IGluIHRoZWlyIG93bmluZyBpMThuIGJsb2NrLCBhbmQgbW92ZXMgdGhlbVxuICogYWZ0ZXIgdGhlIGxhc3QgdXBkYXRlIGluc3RydWN0aW9uIHRoYXQgZGVwZW5kcyBvbiB0aGF0IHNsb3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NpZ25JMThuU2xvdERlcGVuZGVuY2llcyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBUaGUgZmlyc3QgdXBkYXRlIG9wLlxuICAgIGxldCB1cGRhdGVPcCA9IHVuaXQudXBkYXRlLmhlYWQ7XG5cbiAgICAvLyBJMThuIGV4cHJlc3Npb25zIGN1cnJlbnRseSBiZWluZyBtb3ZlZCBkdXJpbmcgdGhlIGl0ZXJhdGlvbi5cbiAgICBsZXQgaTE4bkV4cHJlc3Npb25zSW5Qcm9ncmVzczogaXIuSTE4bkV4cHJlc3Npb25PcFtdID0gW107XG5cbiAgICAvLyBOb24tbnVsbCAgd2hpbGUgd2UgYXJlIGl0ZXJhdGluZyB0aHJvdWdoIGFuIGkxOG5TdGFydC9pMThuRW5kIHBhaXJcbiAgICBsZXQgc3RhdGU6IEJsb2NrU3RhdGV8bnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IGNyZWF0ZU9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAoY3JlYXRlT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgICBzdGF0ZSA9IHtcbiAgICAgICAgICBibG9ja1hyZWY6IGNyZWF0ZU9wLnhyZWYsXG4gICAgICAgICAgbGFzdFNsb3RDb25zdW1lcjogY3JlYXRlT3AueHJlZixcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAoY3JlYXRlT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FbmQpIHtcbiAgICAgICAgZm9yIChjb25zdCBvcCBvZiBpMThuRXhwcmVzc2lvbnNJblByb2dyZXNzKSB7XG4gICAgICAgICAgb3AudGFyZ2V0ID0gc3RhdGUhLmxhc3RTbG90Q29uc3VtZXI7XG4gICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShvcCBhcyBpci5VcGRhdGVPcCwgdXBkYXRlT3AhKTtcbiAgICAgICAgfVxuICAgICAgICBpMThuRXhwcmVzc2lvbnNJblByb2dyZXNzLmxlbmd0aCA9IDA7XG4gICAgICAgIHN0YXRlID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0KGNyZWF0ZU9wKSkge1xuICAgICAgICBpZiAoc3RhdGUgIT09IG51bGwpIHtcbiAgICAgICAgICBzdGF0ZS5sYXN0U2xvdENvbnN1bWVyID0gY3JlYXRlT3AueHJlZjtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKHVwZGF0ZU9wLm5leHQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdGF0ZSAhPT0gbnVsbCAmJiB1cGRhdGVPcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24gJiZcbiAgICAgICAgICAgICAgdXBkYXRlT3AudXNhZ2UgPT09IGlyLkkxOG5FeHByZXNzaW9uRm9yLkkxOG5UZXh0ICYmXG4gICAgICAgICAgICAgIHVwZGF0ZU9wLmkxOG5Pd25lciA9PT0gc3RhdGUuYmxvY2tYcmVmKSB7XG4gICAgICAgICAgICBjb25zdCBvcFRvUmVtb3ZlID0gdXBkYXRlT3A7XG4gICAgICAgICAgICB1cGRhdGVPcCA9IHVwZGF0ZU9wLm5leHQhO1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5VcGRhdGVPcD4ob3BUb1JlbW92ZSk7XG4gICAgICAgICAgICBpMThuRXhwcmVzc2lvbnNJblByb2dyZXNzLnB1c2gob3BUb1JlbW92ZSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaXIuaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdCh1cGRhdGVPcCkgJiYgdXBkYXRlT3AudGFyZ2V0ICE9PSBjcmVhdGVPcC54cmVmKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB1cGRhdGVPcCA9IHVwZGF0ZU9wLm5leHQhO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=