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
                    if (lastSlotConsumer === null) {
                        throw new Error('AssertionError: Expected a last slot consumer while calculating last slot consumers');
                    }
                    i18nLastSlotConsumers.set(currentI18nOp.xref, lastSlotConsumer);
                    currentI18nOp = null;
                    break;
            }
        }
        // Expresions that are currently being moved.
        let opsToMove = [];
        // Previously we found the last slot-consuming create mode op in the i18n block. That op will be
        // the new target for any moved i18n expresion inside the i18n block, and that op's slot is
        // stored here.
        let moveAfterTarget = null;
        // This is the last target in the create IR that we saw during iteration. Eventally, it will be
        // equal to moveAfterTarget. But wait! We need to find the *last* such op whose target is equal
        // to `moveAfterTarget`.
        let previousTarget = null;
        for (const op of unit.update) {
            if (ir.hasDependsOnSlotContextTrait(op)) {
                // We've found an op that depends on another slot other than the one that we want to move
                // the expressions to, after previously having seen the one we want to move to.
                if (moveAfterTarget !== null && previousTarget === moveAfterTarget &&
                    op.target !== previousTarget) {
                    ir.OpList.insertBefore(opsToMove, op);
                    moveAfterTarget = null;
                    opsToMove = [];
                }
                previousTarget = op.target;
            }
            if (op.kind === ir.OpKind.I18nExpression && op.usage === ir.I18nExpressionFor.I18nText) {
                // This is an I18nExpressionOps that is used for text (not attributes).
                ir.OpList.remove(op);
                opsToMove.push(op);
                const target = i18nLastSlotConsumers.get(op.i18nOwner);
                if (target === undefined) {
                    throw new Error('AssertionError: Expected to find a last slot consumer for an I18nExpressionOp');
                }
                op.target = target;
                moveAfterTarget = op.target;
            }
        }
        if (moveAfterTarget !== null) {
            unit.update.push(opsToMove);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsR0FBbUI7SUFDNUQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBd0IsQ0FBQztJQUM5RCxJQUFJLGdCQUFnQixHQUFtQixJQUFJLENBQUM7SUFDNUMsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztJQUU5QyxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixrRUFBa0U7UUFDbEUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDaEMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztZQUM3QixDQUFDO1lBRUQsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixhQUFhLEdBQUcsRUFBRSxDQUFDO29CQUNuQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxJQUFJLEtBQUssQ0FDWCxxRkFBcUYsQ0FBQyxDQUFDO29CQUM3RixDQUFDO29CQUNELElBQUksZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQzlCLE1BQU0sSUFBSSxLQUFLLENBQ1gscUZBQXFGLENBQUMsQ0FBQztvQkFDN0YsQ0FBQztvQkFDRCxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO29CQUNoRSxhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUNyQixNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7UUFFRCw2Q0FBNkM7UUFDN0MsSUFBSSxTQUFTLEdBQTBCLEVBQUUsQ0FBQztRQUMxQyxnR0FBZ0c7UUFDaEcsMkZBQTJGO1FBQzNGLGVBQWU7UUFDZixJQUFJLGVBQWUsR0FBbUIsSUFBSSxDQUFDO1FBQzNDLCtGQUErRjtRQUMvRiwrRkFBK0Y7UUFDL0Ysd0JBQXdCO1FBQ3hCLElBQUksY0FBYyxHQUFtQixJQUFJLENBQUM7UUFDMUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsNEJBQTRCLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDeEMseUZBQXlGO2dCQUN6RiwrRUFBK0U7Z0JBQy9FLElBQUksZUFBZSxLQUFLLElBQUksSUFBSSxjQUFjLEtBQUssZUFBZTtvQkFDOUQsRUFBRSxDQUFDLE1BQU0sS0FBSyxjQUFjLEVBQUUsQ0FBQztvQkFDakMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQWMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUNuRCxlQUFlLEdBQUcsSUFBSSxDQUFDO29CQUN2QixTQUFTLEdBQUcsRUFBRSxDQUFDO2dCQUNqQixDQUFDO2dCQUNELGNBQWMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDO1lBQzdCLENBQUM7WUFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ3ZGLHVFQUF1RTtnQkFDdkUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7Z0JBQ2xDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ25CLE1BQU0sTUFBTSxHQUFHLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3ZELElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUN6QixNQUFNLElBQUksS0FBSyxDQUNYLCtFQUErRSxDQUFDLENBQUM7Z0JBQ3ZGLENBQUM7Z0JBQ0QsRUFBRSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7Z0JBQ25CLGVBQWUsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDO1lBQzlCLENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxlQUFlLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDOUIsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBVcGRhdGVzIGkxOG4gZXhwcmVzc2lvbiBvcHMgdG8gdGFyZ2V0IHRoZSBsYXN0IHNsb3QgaW4gdGhlaXIgb3duaW5nIGkxOG4gYmxvY2ssIGFuZCBtb3ZlcyB0aGVtXG4gKiBhZnRlciB0aGUgbGFzdCB1cGRhdGUgaW5zdHJ1Y3Rpb24gdGhhdCBkZXBlbmRzIG9uIHRoYXQgc2xvdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2lnbkkxOG5TbG90RGVwZW5kZW5jaWVzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgY29uc3QgaTE4bkxhc3RTbG90Q29uc3VtZXJzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLlhyZWZJZD4oKTtcbiAgbGV0IGxhc3RTbG90Q29uc3VtZXI6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGN1cnJlbnRJMThuT3A6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBSZWNvcmQgdGhlIGxhc3QgY29uc3VtZWQgc2xvdCBiZWZvcmUgZWFjaCBpMThuIGVuZCBpbnN0cnVjdGlvbi5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNTbG90VHJhaXQob3ApKSB7XG4gICAgICAgIGxhc3RTbG90Q29uc3VtZXIgPSBvcC54cmVmO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBvcDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBpZiAoY3VycmVudEkxOG5PcCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICdBc3NlcnRpb25FcnJvcjogRXhwZWN0ZWQgYW4gYWN0aXZlIEkxOG4gYmxvY2sgd2hpbGUgY2FsY3VsYXRpbmcgbGFzdCBzbG90IGNvbnN1bWVycycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobGFzdFNsb3RDb25zdW1lciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICdBc3NlcnRpb25FcnJvcjogRXhwZWN0ZWQgYSBsYXN0IHNsb3QgY29uc3VtZXIgd2hpbGUgY2FsY3VsYXRpbmcgbGFzdCBzbG90IGNvbnN1bWVycycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpMThuTGFzdFNsb3RDb25zdW1lcnMuc2V0KGN1cnJlbnRJMThuT3AueHJlZiwgbGFzdFNsb3RDb25zdW1lcik7XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRXhwcmVzaW9ucyB0aGF0IGFyZSBjdXJyZW50bHkgYmVpbmcgbW92ZWQuXG4gICAgbGV0IG9wc1RvTW92ZTogaXIuSTE4bkV4cHJlc3Npb25PcFtdID0gW107XG4gICAgLy8gUHJldmlvdXNseSB3ZSBmb3VuZCB0aGUgbGFzdCBzbG90LWNvbnN1bWluZyBjcmVhdGUgbW9kZSBvcCBpbiB0aGUgaTE4biBibG9jay4gVGhhdCBvcCB3aWxsIGJlXG4gICAgLy8gdGhlIG5ldyB0YXJnZXQgZm9yIGFueSBtb3ZlZCBpMThuIGV4cHJlc2lvbiBpbnNpZGUgdGhlIGkxOG4gYmxvY2ssIGFuZCB0aGF0IG9wJ3Mgc2xvdCBpc1xuICAgIC8vIHN0b3JlZCBoZXJlLlxuICAgIGxldCBtb3ZlQWZ0ZXJUYXJnZXQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICAvLyBUaGlzIGlzIHRoZSBsYXN0IHRhcmdldCBpbiB0aGUgY3JlYXRlIElSIHRoYXQgd2Ugc2F3IGR1cmluZyBpdGVyYXRpb24uIEV2ZW50YWxseSwgaXQgd2lsbCBiZVxuICAgIC8vIGVxdWFsIHRvIG1vdmVBZnRlclRhcmdldC4gQnV0IHdhaXQhIFdlIG5lZWQgdG8gZmluZCB0aGUgKmxhc3QqIHN1Y2ggb3Agd2hvc2UgdGFyZ2V0IGlzIGVxdWFsXG4gICAgLy8gdG8gYG1vdmVBZnRlclRhcmdldGAuXG4gICAgbGV0IHByZXZpb3VzVGFyZ2V0OiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgaWYgKGlyLmhhc0RlcGVuZHNPblNsb3RDb250ZXh0VHJhaXQob3ApKSB7XG4gICAgICAgIC8vIFdlJ3ZlIGZvdW5kIGFuIG9wIHRoYXQgZGVwZW5kcyBvbiBhbm90aGVyIHNsb3Qgb3RoZXIgdGhhbiB0aGUgb25lIHRoYXQgd2Ugd2FudCB0byBtb3ZlXG4gICAgICAgIC8vIHRoZSBleHByZXNzaW9ucyB0bywgYWZ0ZXIgcHJldmlvdXNseSBoYXZpbmcgc2VlbiB0aGUgb25lIHdlIHdhbnQgdG8gbW92ZSB0by5cbiAgICAgICAgaWYgKG1vdmVBZnRlclRhcmdldCAhPT0gbnVsbCAmJiBwcmV2aW91c1RhcmdldCA9PT0gbW92ZUFmdGVyVGFyZ2V0ICYmXG4gICAgICAgICAgICBvcC50YXJnZXQgIT09IHByZXZpb3VzVGFyZ2V0KSB7XG4gICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5VcGRhdGVPcD4ob3BzVG9Nb3ZlLCBvcCk7XG4gICAgICAgICAgbW92ZUFmdGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgICBvcHNUb01vdmUgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBwcmV2aW91c1RhcmdldCA9IG9wLnRhcmdldDtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbiAmJiBvcC51c2FnZSA9PT0gaXIuSTE4bkV4cHJlc3Npb25Gb3IuSTE4blRleHQpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBhbiBJMThuRXhwcmVzc2lvbk9wcyB0aGF0IGlzIHVzZWQgZm9yIHRleHQgKG5vdCBhdHRyaWJ1dGVzKS5cbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5VcGRhdGVPcD4ob3ApO1xuICAgICAgICBvcHNUb01vdmUucHVzaChvcCk7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGkxOG5MYXN0U2xvdENvbnN1bWVycy5nZXQob3AuaTE4bk93bmVyKTtcbiAgICAgICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkIHRvIGZpbmQgYSBsYXN0IHNsb3QgY29uc3VtZXIgZm9yIGFuIEkxOG5FeHByZXNzaW9uT3AnKTtcbiAgICAgICAgfVxuICAgICAgICBvcC50YXJnZXQgPSB0YXJnZXQ7XG4gICAgICAgIG1vdmVBZnRlclRhcmdldCA9IG9wLnRhcmdldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobW92ZUFmdGVyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICB1bml0LnVwZGF0ZS5wdXNoKG9wc1RvTW92ZSk7XG4gICAgfVxuICB9XG59XG4iXX0=