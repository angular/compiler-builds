/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { OpKind } from './enums';
/**
 * A linked list of `Op` nodes of a given subtype.
 *
 * @param OpT specific subtype of `Op` nodes which this list contains.
 */
export class OpList {
    static { this.nextListId = 0; }
    constructor() {
        /**
         * Debug ID of this `OpList` instance.
         */
        this.debugListId = OpList.nextListId++;
        // OpList uses static head/tail nodes of a special `ListEnd` type.
        // This avoids the need for special casing of the first and last list
        // elements in all list operations.
        this.head = {
            kind: OpKind.ListEnd,
            next: null,
            prev: null,
            debugListId: this.debugListId,
        };
        this.tail = {
            kind: OpKind.ListEnd,
            next: null,
            prev: null,
            debugListId: this.debugListId,
        };
        // Link `head` and `tail` together at the start (list is empty).
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }
    /**
     * Push a new operation to the tail of the list.
     */
    push(op) {
        OpList.assertIsNotEnd(op);
        OpList.assertIsUnowned(op);
        op.debugListId = this.debugListId;
        // The old "previous" node (which might be the head, if the list is empty).
        const oldLast = this.tail.prev;
        // Insert `op` following the old last node.
        op.prev = oldLast;
        oldLast.next = op;
        // Connect `op` with the list tail.
        op.next = this.tail;
        this.tail.prev = op;
    }
    /**
     * Prepend one or more nodes to the start of the list.
     */
    prepend(ops) {
        if (ops.length === 0) {
            return;
        }
        for (const op of ops) {
            OpList.assertIsNotEnd(op);
            OpList.assertIsUnowned(op);
            op.debugListId = this.debugListId;
        }
        const first = this.head.next;
        let prev = this.head;
        for (const op of ops) {
            prev.next = op;
            op.prev = prev;
            prev = op;
        }
        prev.next = first;
        first.prev = prev;
    }
    /**
     * `OpList` is iterable via the iteration protocol.
     *
     * It's safe to mutate the part of the list that has already been returned by the iterator, up to
     * and including the last operation returned. Mutations beyond that point _may_ be safe, but may
     * also corrupt the iteration position and should be avoided.
     */
    *[Symbol.iterator]() {
        let current = this.head.next;
        while (current !== this.tail) {
            // Guards against corruption of the iterator state by mutations to the tail of the list during
            // iteration.
            OpList.assertIsOwned(current, this.debugListId);
            const next = current.next;
            yield current;
            current = next;
        }
    }
    *reversed() {
        let current = this.tail.prev;
        while (current !== this.head) {
            OpList.assertIsOwned(current, this.debugListId);
            const prev = current.prev;
            yield current;
            current = prev;
        }
    }
    /**
     * Replace `oldOp` with `newOp` in the list.
     */
    static replace(oldOp, newOp) {
        OpList.assertIsNotEnd(oldOp);
        OpList.assertIsNotEnd(newOp);
        OpList.assertIsOwned(oldOp);
        OpList.assertIsUnowned(newOp);
        newOp.debugListId = oldOp.debugListId;
        if (oldOp.prev !== null) {
            oldOp.prev.next = newOp;
            newOp.prev = oldOp.prev;
        }
        if (oldOp.next !== null) {
            oldOp.next.prev = newOp;
            newOp.next = oldOp.next;
        }
        oldOp.debugListId = null;
        oldOp.prev = null;
        oldOp.next = null;
    }
    /**
     * Replace `oldOp` with some number of new operations in the list (which may include `oldOp`).
     */
    static replaceWithMany(oldOp, newOps) {
        if (newOps.length === 0) {
            // Replacing with an empty list -> pure removal.
            OpList.remove(oldOp);
            return;
        }
        OpList.assertIsNotEnd(oldOp);
        OpList.assertIsOwned(oldOp);
        const listId = oldOp.debugListId;
        oldOp.debugListId = null;
        for (const newOp of newOps) {
            OpList.assertIsNotEnd(newOp);
            // `newOp` might be `oldOp`, but at this point it's been marked as unowned.
            OpList.assertIsUnowned(newOp);
        }
        // It should be safe to reuse `oldOp` in the `newOps` list - maybe you want to sandwich an
        // operation between two new ops.
        const { prev: oldPrev, next: oldNext } = oldOp;
        oldOp.prev = null;
        oldOp.next = null;
        let prev = oldPrev;
        for (const newOp of newOps) {
            this.assertIsUnowned(newOp);
            newOp.debugListId = listId;
            prev.next = newOp;
            newOp.prev = prev;
            // This _should_ be the case, but set it just in case.
            newOp.next = null;
            prev = newOp;
        }
        // At the end of iteration, `prev` holds the last node in the list.
        const first = newOps[0];
        const last = prev;
        // Replace `oldOp` with the chain `first` -> `last`.
        if (oldPrev !== null) {
            oldPrev.next = first;
            first.prev = oldOp.prev;
        }
        if (oldNext !== null) {
            oldNext.prev = last;
            last.next = oldNext;
        }
    }
    /**
     * Remove the given node from the list which contains it.
     */
    static remove(op) {
        OpList.assertIsNotEnd(op);
        OpList.assertIsOwned(op);
        op.prev.next = op.next;
        op.next.prev = op.prev;
        // Break any link between the node and this list to safeguard against its usage in future
        // operations.
        op.debugListId = null;
        op.prev = null;
        op.next = null;
    }
    /**
     * Insert `op` before `before`.
     */
    static insertBefore(op, before) {
        OpList.assertIsOwned(before);
        if (before.prev === null) {
            throw new Error(`AssertionError: illegal operation on list start`);
        }
        OpList.assertIsNotEnd(op);
        OpList.assertIsUnowned(op);
        op.debugListId = before.debugListId;
        // Just in case.
        op.prev = null;
        before.prev.next = op;
        op.prev = before.prev;
        op.next = before;
        before.prev = op;
    }
    /**
     * Asserts that `op` does not currently belong to a list.
     */
    static assertIsUnowned(op) {
        if (op.debugListId !== null) {
            throw new Error(`AssertionError: illegal operation on owned node: ${OpKind[op.kind]}`);
        }
    }
    /**
     * Asserts that `op` currently belongs to a list. If `byList` is passed, `op` is asserted to
     * specifically belong to that list.
     */
    static assertIsOwned(op, byList) {
        if (op.debugListId === null) {
            throw new Error(`AssertionError: illegal operation on unowned node: ${OpKind[op.kind]}`);
        }
        else if (byList !== undefined && op.debugListId !== byList) {
            throw new Error(`AssertionError: node belongs to the wrong list (expected ${byList}, actual ${op.debugListId})`);
        }
    }
    /**
     * Asserts that `op` is not a special `ListEnd` node.
     */
    static assertIsNotEnd(op) {
        if (op.kind === OpKind.ListEnd) {
            throw new Error(`AssertionError: illegal operation on list head or tail`);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvb3BlcmF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBeUMvQjs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLE1BQU07YUFDVixlQUFVLEdBQUcsQ0FBQyxBQUFKLENBQUs7SUF5QnRCO1FBdkJBOztXQUVHO1FBQ00sZ0JBQVcsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7UUFFM0Msa0VBQWtFO1FBQ2xFLHFFQUFxRTtRQUNyRSxtQ0FBbUM7UUFDMUIsU0FBSSxHQUFRO1lBQ25CLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTztZQUNwQixJQUFJLEVBQUUsSUFBSTtZQUNWLElBQUksRUFBRSxJQUFJO1lBQ1YsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO1NBQ3ZCLENBQUM7UUFFQSxTQUFJLEdBQUc7WUFDZCxJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU87WUFDcEIsSUFBSSxFQUFFLElBQUk7WUFDVixJQUFJLEVBQUUsSUFBSTtZQUNWLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztTQUN2QixDQUFDO1FBSVAsZ0VBQWdFO1FBQ2hFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDM0IsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLENBQUMsRUFBTztRQUNWLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDMUIsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsQ0FB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LE1BQU0sQ0FBQyxhQUFhLENBQXNCLEVBQU8sRUFBRSxNQUFlO1FBQ2hFLElBQUksRUFBRSxDQUFDLFdBQVcsS0FBSyxJQUFJLEVBQUU7WUFDM0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBc0QsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDMUY7YUFBTSxJQUFJLE1BQU0sS0FBSyxTQUFTLElBQUksRUFBRSxDQUFDLFdBQVcsS0FBSyxNQUFNLEVBQUU7WUFDNUQsTUFBTSxJQUFJLEtBQUssQ0FBQyw0REFBNEQsTUFBTSxZQUM5RSxFQUFFLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztTQUN4QjtJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxjQUFjLENBQXNCLEVBQU87UUFDaEQsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxPQUFPLEVBQUU7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1NBQzNFO0lBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge09wS2luZH0gZnJvbSAnLi9lbnVtcyc7XG5cbi8qKlxuICogQnJhbmRlZCB0eXBlIGZvciBhIGNyb3NzLXJlZmVyZW5jZSBJRC4gRHVyaW5nIGluZ2VzdCwgYFhyZWZJZGBzIGFyZSBnZW5lcmF0ZWQgdG8gbGluayB0b2dldGhlclxuICogZGlmZmVyZW50IElSIG9wZXJhdGlvbnMgd2hpY2ggbmVlZCB0byByZWZlcmVuY2UgZWFjaCBvdGhlci5cbiAqL1xuZXhwb3J0IHR5cGUgWHJlZklkID0gbnVtYmVyJntfX2JyYW5kOiAnWHJlZklkJ307XG5cbi8qKlxuICogQmFzZSBpbnRlcmZhY2UgZm9yIHNlbWFudGljIG9wZXJhdGlvbnMgYmVpbmcgcGVyZm9ybWVkIHdpdGhpbiBhIHRlbXBsYXRlLlxuICpcbiAqIEBwYXJhbSBPcFQgYSBzcGVjaWZpYyBuYXJyb3dlciB0eXBlIG9mIGBPcGAgKGZvciBleGFtcGxlLCBjcmVhdGlvbiBvcGVyYXRpb25zKSB3aGljaCB0aGlzXG4gKiAgICAgc3BlY2lmaWMgc3VidHlwZSBvZiBgT3BgIGNhbiBiZSBsaW5rZWQgd2l0aCBpbiBhIGxpbmtlZCBsaXN0LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE9wPE9wVCBleHRlbmRzIE9wPE9wVD4+IHtcbiAgLyoqXG4gICAqIEFsbCBvcGVyYXRpb25zIGhhdmUgYSBkaXN0aW5jdCBraW5kLlxuICAgKi9cbiAga2luZDogT3BLaW5kO1xuXG4gIC8qKlxuICAgKiBUaGUgcHJldmlvdXMgb3BlcmF0aW9uIGluIHRoZSBsaW5rZWQgbGlzdCwgaWYgYW55LlxuICAgKlxuICAgKiBUaGlzIGlzIGBudWxsYCBmb3Igb3BlcmF0aW9uIG5vZGVzIG5vdCBjdXJyZW50bHkgaW4gYSBsaXN0LCBvciBmb3IgdGhlIHNwZWNpYWwgaGVhZC90YWlsIG5vZGVzLlxuICAgKi9cbiAgcHJldjogT3BUfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBuZXh0IG9wZXJhdGlvbiBpbiB0aGUgbGlua2VkIGxpc3QsIGlmIGFueS5cbiAgICpcbiAgICogVGhpcyBpcyBgbnVsbGAgZm9yIG9wZXJhdGlvbiBub2RlcyBub3QgY3VycmVudGx5IGluIGEgbGlzdCwgb3IgZm9yIHRoZSBzcGVjaWFsIGhlYWQvdGFpbCBub2Rlcy5cbiAgICovXG4gIG5leHQ6IE9wVHxudWxsO1xuXG4gIC8qKlxuICAgKiBEZWJ1ZyBpZCBvZiB0aGUgbGlzdCB0byB3aGljaCB0aGlzIG5vZGUgY3VycmVudGx5IGJlbG9uZ3MsIG9yIGBudWxsYCBpZiB0aGlzIG5vZGUgaXMgbm90IHBhcnRcbiAgICogb2YgYSBsaXN0LlxuICAgKi9cbiAgZGVidWdMaXN0SWQ6IG51bWJlcnxudWxsO1xufVxuXG4vKipcbiAqIEEgbGlua2VkIGxpc3Qgb2YgYE9wYCBub2RlcyBvZiBhIGdpdmVuIHN1YnR5cGUuXG4gKlxuICogQHBhcmFtIE9wVCBzcGVjaWZpYyBzdWJ0eXBlIG9mIGBPcGAgbm9kZXMgd2hpY2ggdGhpcyBsaXN0IGNvbnRhaW5zLlxuICovXG5leHBvcnQgY2xhc3MgT3BMaXN0PE9wVCBleHRlbmRzIE9wPE9wVD4+IHtcbiAgc3RhdGljIG5leHRMaXN0SWQgPSAwO1xuXG4gIC8qKlxuICAgKiBEZWJ1ZyBJRCBvZiB0aGlzIGBPcExpc3RgIGluc3RhbmNlLlxuICAgKi9cbiAgcmVhZG9ubHkgZGVidWdMaXN0SWQgPSBPcExpc3QubmV4dExpc3RJZCsrO1xuXG4gIC8vIE9wTGlzdCB1c2VzIHN0YXRpYyBoZWFkL3RhaWwgbm9kZXMgb2YgYSBzcGVjaWFsIGBMaXN0RW5kYCB0eXBlLlxuICAvLyBUaGlzIGF2b2lkcyB0aGUgbmVlZCBmb3Igc3BlY2lhbCBjYXNpbmcgb2YgdGhlIGZpcnN0IGFuZCBsYXN0IGxpc3RcbiAgLy8gZWxlbWVudHMgaW4gYWxsIGxpc3Qgb3BlcmF0aW9ucy5cbiAgcmVhZG9ubHkgaGVhZDogT3BUID0ge1xuICAgIGtpbmQ6IE9wS2luZC5MaXN0RW5kLFxuICAgIG5leHQ6IG51bGwsXG4gICAgcHJldjogbnVsbCxcbiAgICBkZWJ1Z0xpc3RJZDogdGhpcy5kZWJ1Z0xpc3RJZCxcbiAgfSBhcyBPcFQ7XG5cbiAgcmVhZG9ubHkgdGFpbCA9IHtcbiAgICBraW5kOiBPcEtpbmQuTGlzdEVuZCxcbiAgICBuZXh0OiBudWxsLFxuICAgIHByZXY6IG51bGwsXG4gICAgZGVidWdMaXN0SWQ6IHRoaXMuZGVidWdMaXN0SWQsXG4gIH0gYXMgT3BUO1xuXG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gTGluayBgaGVhZGAgYW5kIGB0YWlsYCB0b2dldGhlciBhdCB0aGUgc3RhcnQgKGxpc3QgaXMgZW1wdHkpLlxuICAgIHRoaXMuaGVhZC5uZXh0ID0gdGhpcy50YWlsO1xuICAgIHRoaXMudGFpbC5wcmV2ID0gdGhpcy5oZWFkO1xuICB9XG5cbiAgLyoqXG4gICAqIFB1c2ggYSBuZXcgb3BlcmF0aW9uIHRvIHRoZSB0YWlsIG9mIHRoZSBsaXN0LlxuICAgKi9cbiAgcHVzaChvcDogT3BUKTogdm9pZCB7XG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG9wKTtcblxuICAgIG9wLmRlYnVnTGlzdElkID0gdGhpcy5kZWJ1Z0xpc3RJZDtcblxuICAgIC8vIFRoZSBvbGQgXCJwcmV2aW91c1wiIG5vZGUgKHdoaWNoIG1pZ2h0IGJlIHRoZSBoZWFkLCBpZiB0aGUgbGlzdCBpcyBlbXB0eSkuXG4gICAgY29uc3Qgb2xkTGFzdCA9IHRoaXMudGFpbC5wcmV2ITtcblxuICAgIC8vIEluc2VydCBgb3BgIGZvbGxvd2luZyB0aGUgb2xkIGxhc3Qgbm9kZS5cbiAgICBvcC5wcmV2ID0gb2xkTGFzdDtcbiAgICBvbGRMYXN0Lm5leHQgPSBvcDtcblxuICAgIC8vIENvbm5lY3QgYG9wYCB3aXRoIHRoZSBsaXN0IHRhaWwuXG4gICAgb3AubmV4dCA9IHRoaXMudGFpbDtcbiAgICB0aGlzLnRhaWwucHJldiA9IG9wO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBlbmQgb25lIG9yIG1vcmUgbm9kZXMgdG8gdGhlIHN0YXJ0IG9mIHRoZSBsaXN0LlxuICAgKi9cbiAgcHJlcGVuZChvcHM6IE9wVFtdKTogdm9pZCB7XG4gICAgaWYgKG9wcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG9wKTtcbiAgICAgIE9wTGlzdC5hc3NlcnRJc1Vub3duZWQob3ApO1xuXG4gICAgICBvcC5kZWJ1Z0xpc3RJZCA9IHRoaXMuZGVidWdMaXN0SWQ7XG4gICAgfVxuXG4gICAgY29uc3QgZmlyc3QgPSB0aGlzLmhlYWQubmV4dCE7XG5cbiAgICBsZXQgcHJldiA9IHRoaXMuaGVhZDtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgICAgcHJldi5uZXh0ID0gb3A7XG4gICAgICBvcC5wcmV2ID0gcHJldjtcblxuICAgICAgcHJldiA9IG9wO1xuICAgIH1cblxuICAgIHByZXYubmV4dCA9IGZpcnN0O1xuICAgIGZpcnN0LnByZXYgPSBwcmV2O1xuICB9XG5cbiAgLyoqXG4gICAqIGBPcExpc3RgIGlzIGl0ZXJhYmxlIHZpYSB0aGUgaXRlcmF0aW9uIHByb3RvY29sLlxuICAgKlxuICAgKiBJdCdzIHNhZmUgdG8gbXV0YXRlIHRoZSBwYXJ0IG9mIHRoZSBsaXN0IHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZXR1cm5lZCBieSB0aGUgaXRlcmF0b3IsIHVwIHRvXG4gICAqIGFuZCBpbmNsdWRpbmcgdGhlIGxhc3Qgb3BlcmF0aW9uIHJldHVybmVkLiBNdXRhdGlvbnMgYmV5b25kIHRoYXQgcG9pbnQgX21heV8gYmUgc2FmZSwgYnV0IG1heVxuICAgKiBhbHNvIGNvcnJ1cHQgdGhlIGl0ZXJhdGlvbiBwb3NpdGlvbiBhbmQgc2hvdWxkIGJlIGF2b2lkZWQuXG4gICAqL1xuICAqIFtTeW1ib2wuaXRlcmF0b3JdKCk6IEdlbmVyYXRvcjxPcFQ+IHtcbiAgICBsZXQgY3VycmVudCA9IHRoaXMuaGVhZC5uZXh0ITtcbiAgICB3aGlsZSAoY3VycmVudCAhPT0gdGhpcy50YWlsKSB7XG4gICAgICAvLyBHdWFyZHMgYWdhaW5zdCBjb3JydXB0aW9uIG9mIHRoZSBpdGVyYXRvciBzdGF0ZSBieSBtdXRhdGlvbnMgdG8gdGhlIHRhaWwgb2YgdGhlIGxpc3QgZHVyaW5nXG4gICAgICAvLyBpdGVyYXRpb24uXG4gICAgICBPcExpc3QuYXNzZXJ0SXNPd25lZChjdXJyZW50LCB0aGlzLmRlYnVnTGlzdElkKTtcblxuICAgICAgY29uc3QgbmV4dCA9IGN1cnJlbnQubmV4dCE7XG4gICAgICB5aWVsZCBjdXJyZW50O1xuICAgICAgY3VycmVudCA9IG5leHQ7XG4gICAgfVxuICB9XG5cbiAgKiByZXZlcnNlZCgpOiBHZW5lcmF0b3I8T3BUPiB7XG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLnRhaWwucHJldiE7XG4gICAgd2hpbGUgKGN1cnJlbnQgIT09IHRoaXMuaGVhZCkge1xuICAgICAgT3BMaXN0LmFzc2VydElzT3duZWQoY3VycmVudCwgdGhpcy5kZWJ1Z0xpc3RJZCk7XG5cbiAgICAgIGNvbnN0IHByZXYgPSBjdXJyZW50LnByZXYhO1xuICAgICAgeWllbGQgY3VycmVudDtcbiAgICAgIGN1cnJlbnQgPSBwcmV2O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYWNlIGBvbGRPcGAgd2l0aCBgbmV3T3BgIGluIHRoZSBsaXN0LlxuICAgKi9cbiAgc3RhdGljIHJlcGxhY2U8T3BUIGV4dGVuZHMgT3A8T3BUPj4ob2xkT3A6IE9wVCwgbmV3T3A6IE9wVCk6IHZvaWQge1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvbGRPcCk7XG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG5ld09wKTtcblxuICAgIE9wTGlzdC5hc3NlcnRJc093bmVkKG9sZE9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG5ld09wKTtcblxuICAgIG5ld09wLmRlYnVnTGlzdElkID0gb2xkT3AuZGVidWdMaXN0SWQ7XG4gICAgaWYgKG9sZE9wLnByZXYgIT09IG51bGwpIHtcbiAgICAgIG9sZE9wLnByZXYubmV4dCA9IG5ld09wO1xuICAgICAgbmV3T3AucHJldiA9IG9sZE9wLnByZXY7XG4gICAgfVxuICAgIGlmIChvbGRPcC5uZXh0ICE9PSBudWxsKSB7XG4gICAgICBvbGRPcC5uZXh0LnByZXYgPSBuZXdPcDtcbiAgICAgIG5ld09wLm5leHQgPSBvbGRPcC5uZXh0O1xuICAgIH1cbiAgICBvbGRPcC5kZWJ1Z0xpc3RJZCA9IG51bGw7XG4gICAgb2xkT3AucHJldiA9IG51bGw7XG4gICAgb2xkT3AubmV4dCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZSBgb2xkT3BgIHdpdGggc29tZSBudW1iZXIgb2YgbmV3IG9wZXJhdGlvbnMgaW4gdGhlIGxpc3QgKHdoaWNoIG1heSBpbmNsdWRlIGBvbGRPcGApLlxuICAgKi9cbiAgc3RhdGljIHJlcGxhY2VXaXRoTWFueTxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvbGRPcDogT3BULCBuZXdPcHM6IE9wVFtdKTogdm9pZCB7XG4gICAgaWYgKG5ld09wcy5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFJlcGxhY2luZyB3aXRoIGFuIGVtcHR5IGxpc3QgLT4gcHVyZSByZW1vdmFsLlxuICAgICAgT3BMaXN0LnJlbW92ZShvbGRPcCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG9sZE9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNPd25lZChvbGRPcCk7XG5cbiAgICBjb25zdCBsaXN0SWQgPSBvbGRPcC5kZWJ1Z0xpc3RJZDtcbiAgICBvbGRPcC5kZWJ1Z0xpc3RJZCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IG5ld09wIG9mIG5ld09wcykge1xuICAgICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG5ld09wKTtcblxuICAgICAgLy8gYG5ld09wYCBtaWdodCBiZSBgb2xkT3BgLCBidXQgYXQgdGhpcyBwb2ludCBpdCdzIGJlZW4gbWFya2VkIGFzIHVub3duZWQuXG4gICAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG5ld09wKTtcbiAgICB9XG5cbiAgICAvLyBJdCBzaG91bGQgYmUgc2FmZSB0byByZXVzZSBgb2xkT3BgIGluIHRoZSBgbmV3T3BzYCBsaXN0IC0gbWF5YmUgeW91IHdhbnQgdG8gc2FuZHdpY2ggYW5cbiAgICAvLyBvcGVyYXRpb24gYmV0d2VlbiB0d28gbmV3IG9wcy5cbiAgICBjb25zdCB7cHJldjogb2xkUHJldiwgbmV4dDogb2xkTmV4dH0gPSBvbGRPcDtcbiAgICBvbGRPcC5wcmV2ID0gbnVsbDtcbiAgICBvbGRPcC5uZXh0ID0gbnVsbDtcblxuICAgIGxldCBwcmV2OiBPcFQgPSBvbGRQcmV2ITtcbiAgICBmb3IgKGNvbnN0IG5ld09wIG9mIG5ld09wcykge1xuICAgICAgdGhpcy5hc3NlcnRJc1Vub3duZWQobmV3T3ApO1xuICAgICAgbmV3T3AuZGVidWdMaXN0SWQgPSBsaXN0SWQ7XG5cbiAgICAgIHByZXYhLm5leHQgPSBuZXdPcDtcbiAgICAgIG5ld09wLnByZXYgPSBwcmV2O1xuXG4gICAgICAvLyBUaGlzIF9zaG91bGRfIGJlIHRoZSBjYXNlLCBidXQgc2V0IGl0IGp1c3QgaW4gY2FzZS5cbiAgICAgIG5ld09wLm5leHQgPSBudWxsO1xuXG4gICAgICBwcmV2ID0gbmV3T3A7XG4gICAgfVxuICAgIC8vIEF0IHRoZSBlbmQgb2YgaXRlcmF0aW9uLCBgcHJldmAgaG9sZHMgdGhlIGxhc3Qgbm9kZSBpbiB0aGUgbGlzdC5cbiAgICBjb25zdCBmaXJzdCA9IG5ld09wc1swXSE7XG4gICAgY29uc3QgbGFzdCA9IHByZXYhO1xuXG4gICAgLy8gUmVwbGFjZSBgb2xkT3BgIHdpdGggdGhlIGNoYWluIGBmaXJzdGAgLT4gYGxhc3RgLlxuICAgIGlmIChvbGRQcmV2ICE9PSBudWxsKSB7XG4gICAgICBvbGRQcmV2Lm5leHQgPSBmaXJzdDtcbiAgICAgIGZpcnN0LnByZXYgPSBvbGRPcC5wcmV2O1xuICAgIH1cblxuICAgIGlmIChvbGROZXh0ICE9PSBudWxsKSB7XG4gICAgICBvbGROZXh0LnByZXYgPSBsYXN0O1xuICAgICAgbGFzdC5uZXh0ID0gb2xkTmV4dDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBnaXZlbiBub2RlIGZyb20gdGhlIGxpc3Qgd2hpY2ggY29udGFpbnMgaXQuXG4gICAqL1xuICBzdGF0aWMgcmVtb3ZlPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQpOiB2b2lkIHtcbiAgICBPcExpc3QuYXNzZXJ0SXNOb3RFbmQob3ApO1xuICAgIE9wTGlzdC5hc3NlcnRJc093bmVkKG9wKTtcblxuICAgIG9wLnByZXYhLm5leHQgPSBvcC5uZXh0O1xuICAgIG9wLm5leHQhLnByZXYgPSBvcC5wcmV2O1xuXG4gICAgLy8gQnJlYWsgYW55IGxpbmsgYmV0d2VlbiB0aGUgbm9kZSBhbmQgdGhpcyBsaXN0IHRvIHNhZmVndWFyZCBhZ2FpbnN0IGl0cyB1c2FnZSBpbiBmdXR1cmVcbiAgICAvLyBvcGVyYXRpb25zLlxuICAgIG9wLmRlYnVnTGlzdElkID0gbnVsbDtcbiAgICBvcC5wcmV2ID0gbnVsbDtcbiAgICBvcC5uZXh0ID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnQgYG9wYCBiZWZvcmUgYGJlZm9yZWAuXG4gICAqL1xuICBzdGF0aWMgaW5zZXJ0QmVmb3JlPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQsIGJlZm9yZTogT3BUKTogdm9pZCB7XG4gICAgT3BMaXN0LmFzc2VydElzT3duZWQoYmVmb3JlKTtcbiAgICBpZiAoYmVmb3JlLnByZXYgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGlsbGVnYWwgb3BlcmF0aW9uIG9uIGxpc3Qgc3RhcnRgKTtcbiAgICB9XG5cbiAgICBPcExpc3QuYXNzZXJ0SXNOb3RFbmQob3ApO1xuXG4gICAgT3BMaXN0LmFzc2VydElzVW5vd25lZChvcCk7XG5cbiAgICBvcC5kZWJ1Z0xpc3RJZCA9IGJlZm9yZS5kZWJ1Z0xpc3RJZDtcblxuICAgIC8vIEp1c3QgaW4gY2FzZS5cbiAgICBvcC5wcmV2ID0gbnVsbDtcblxuICAgIGJlZm9yZS5wcmV2IS5uZXh0ID0gb3A7XG4gICAgb3AucHJldiA9IGJlZm9yZS5wcmV2O1xuXG4gICAgb3AubmV4dCA9IGJlZm9yZTtcbiAgICBiZWZvcmUucHJldiA9IG9wO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VydHMgdGhhdCBgb3BgIGRvZXMgbm90IGN1cnJlbnRseSBiZWxvbmcgdG8gYSBsaXN0LlxuICAgKi9cbiAgc3RhdGljIGFzc2VydElzVW5vd25lZDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvcDogT3BUKTogdm9pZCB7XG4gICAgaWYgKG9wLmRlYnVnTGlzdElkICE9PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBpbGxlZ2FsIG9wZXJhdGlvbiBvbiBvd25lZCBub2RlOiAke09wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXNzZXJ0cyB0aGF0IGBvcGAgY3VycmVudGx5IGJlbG9uZ3MgdG8gYSBsaXN0LiBJZiBgYnlMaXN0YCBpcyBwYXNzZWQsIGBvcGAgaXMgYXNzZXJ0ZWQgdG9cbiAgICogc3BlY2lmaWNhbGx5IGJlbG9uZyB0byB0aGF0IGxpc3QuXG4gICAqL1xuICBzdGF0aWMgYXNzZXJ0SXNPd25lZDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvcDogT3BULCBieUxpc3Q/OiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAob3AuZGVidWdMaXN0SWQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGlsbGVnYWwgb3BlcmF0aW9uIG9uIHVub3duZWQgbm9kZTogJHtPcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfSBlbHNlIGlmIChieUxpc3QgIT09IHVuZGVmaW5lZCAmJiBvcC5kZWJ1Z0xpc3RJZCAhPT0gYnlMaXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBub2RlIGJlbG9uZ3MgdG8gdGhlIHdyb25nIGxpc3QgKGV4cGVjdGVkICR7YnlMaXN0fSwgYWN0dWFsICR7XG4gICAgICAgICAgb3AuZGVidWdMaXN0SWR9KWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9wYCBpcyBub3QgYSBzcGVjaWFsIGBMaXN0RW5kYCBub2RlLlxuICAgKi9cbiAgc3RhdGljIGFzc2VydElzTm90RW5kPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQpOiB2b2lkIHtcbiAgICBpZiAob3Aua2luZCA9PT0gT3BLaW5kLkxpc3RFbmQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGlsbGVnYWwgb3BlcmF0aW9uIG9uIGxpc3QgaGVhZCBvciB0YWlsYCk7XG4gICAgfVxuICB9XG59XG4iXX0=