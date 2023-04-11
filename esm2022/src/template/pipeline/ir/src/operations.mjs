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
class OpList {
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
            OpList.assertIsOwned(current);
            const next = current.next;
            yield current;
            current = next;
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
        OpList.assertIsNotEnd(before);
        OpList.assertIsNotEnd(op);
        OpList.assertIsUnowned(op);
        OpList.assertIsOwned(before, op.debugListId);
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
export { OpList };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvb3BlcmF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBeUMvQjs7OztHQUlHO0FBQ0gsTUFBYSxNQUFNO2FBQ1YsZUFBVSxHQUFHLENBQUMsQUFBSixDQUFLO0lBeUJ0QjtRQXZCQTs7V0FFRztRQUNNLGdCQUFXLEdBQUcsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRTNDLGtFQUFrRTtRQUNsRSxxRUFBcUU7UUFDckUsbUNBQW1DO1FBQzFCLFNBQUksR0FBUTtZQUNuQixJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU87WUFDcEIsSUFBSSxFQUFFLElBQUk7WUFDVixJQUFJLEVBQUUsSUFBSTtZQUNWLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztTQUN2QixDQUFDO1FBRUEsU0FBSSxHQUFHO1lBQ2QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPO1lBQ3BCLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7WUFDVixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7U0FDdkIsQ0FBQztRQUlQLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLEVBQU87UUFDVixNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUM7UUFF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SUFDSCxNQUFNLENBQUMsY0FBYyxDQUFzQixFQUFPO1FBQ2hELElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsT0FBTyxFQUFFO1lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsd0RBQXdELENBQUMsQ0FBQztTQUMzRTtJQUNILENBQUM7O1NBNVBVLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtPcEtpbmR9IGZyb20gJy4vZW51bXMnO1xuXG4vKipcbiAqIEJyYW5kZWQgdHlwZSBmb3IgYSBjcm9zcy1yZWZlcmVuY2UgSUQuIER1cmluZyBpbmdlc3QsIGBYcmVmSWRgcyBhcmUgZ2VuZXJhdGVkIHRvIGxpbmsgdG9nZXRoZXJcbiAqIGRpZmZlcmVudCBJUiBvcGVyYXRpb25zIHdoaWNoIG5lZWQgdG8gcmVmZXJlbmNlIGVhY2ggb3RoZXIuXG4gKi9cbmV4cG9ydCB0eXBlIFhyZWZJZCA9IG51bWJlciZ7X19icmFuZDogJ1hyZWZJZCd9O1xuXG4vKipcbiAqIEJhc2UgaW50ZXJmYWNlIGZvciBzZW1hbnRpYyBvcGVyYXRpb25zIGJlaW5nIHBlcmZvcm1lZCB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0gT3BUIGEgc3BlY2lmaWMgbmFycm93ZXIgdHlwZSBvZiBgT3BgIChmb3IgZXhhbXBsZSwgY3JlYXRpb24gb3BlcmF0aW9ucykgd2hpY2ggdGhpc1xuICogICAgIHNwZWNpZmljIHN1YnR5cGUgb2YgYE9wYCBjYW4gYmUgbGlua2VkIHdpdGggaW4gYSBsaW5rZWQgbGlzdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPcDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PiB7XG4gIC8qKlxuICAgKiBBbGwgb3BlcmF0aW9ucyBoYXZlIGEgZGlzdGluY3Qga2luZC5cbiAgICovXG4gIGtpbmQ6IE9wS2luZDtcblxuICAvKipcbiAgICogVGhlIHByZXZpb3VzIG9wZXJhdGlvbiBpbiB0aGUgbGlua2VkIGxpc3QsIGlmIGFueS5cbiAgICpcbiAgICogVGhpcyBpcyBgbnVsbGAgZm9yIG9wZXJhdGlvbiBub2RlcyBub3QgY3VycmVudGx5IGluIGEgbGlzdCwgb3IgZm9yIHRoZSBzcGVjaWFsIGhlYWQvdGFpbCBub2Rlcy5cbiAgICovXG4gIHByZXY6IE9wVHxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbmV4dCBvcGVyYXRpb24gaW4gdGhlIGxpbmtlZCBsaXN0LCBpZiBhbnkuXG4gICAqXG4gICAqIFRoaXMgaXMgYG51bGxgIGZvciBvcGVyYXRpb24gbm9kZXMgbm90IGN1cnJlbnRseSBpbiBhIGxpc3QsIG9yIGZvciB0aGUgc3BlY2lhbCBoZWFkL3RhaWwgbm9kZXMuXG4gICAqL1xuICBuZXh0OiBPcFR8bnVsbDtcblxuICAvKipcbiAgICogRGVidWcgaWQgb2YgdGhlIGxpc3QgdG8gd2hpY2ggdGhpcyBub2RlIGN1cnJlbnRseSBiZWxvbmdzLCBvciBgbnVsbGAgaWYgdGhpcyBub2RlIGlzIG5vdCBwYXJ0XG4gICAqIG9mIGEgbGlzdC5cbiAgICovXG4gIGRlYnVnTGlzdElkOiBudW1iZXJ8bnVsbDtcbn1cblxuLyoqXG4gKiBBIGxpbmtlZCBsaXN0IG9mIGBPcGAgbm9kZXMgb2YgYSBnaXZlbiBzdWJ0eXBlLlxuICpcbiAqIEBwYXJhbSBPcFQgc3BlY2lmaWMgc3VidHlwZSBvZiBgT3BgIG5vZGVzIHdoaWNoIHRoaXMgbGlzdCBjb250YWlucy5cbiAqL1xuZXhwb3J0IGNsYXNzIE9wTGlzdDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PiB7XG4gIHN0YXRpYyBuZXh0TGlzdElkID0gMDtcblxuICAvKipcbiAgICogRGVidWcgSUQgb2YgdGhpcyBgT3BMaXN0YCBpbnN0YW5jZS5cbiAgICovXG4gIHJlYWRvbmx5IGRlYnVnTGlzdElkID0gT3BMaXN0Lm5leHRMaXN0SWQrKztcblxuICAvLyBPcExpc3QgdXNlcyBzdGF0aWMgaGVhZC90YWlsIG5vZGVzIG9mIGEgc3BlY2lhbCBgTGlzdEVuZGAgdHlwZS5cbiAgLy8gVGhpcyBhdm9pZHMgdGhlIG5lZWQgZm9yIHNwZWNpYWwgY2FzaW5nIG9mIHRoZSBmaXJzdCBhbmQgbGFzdCBsaXN0XG4gIC8vIGVsZW1lbnRzIGluIGFsbCBsaXN0IG9wZXJhdGlvbnMuXG4gIHJlYWRvbmx5IGhlYWQ6IE9wVCA9IHtcbiAgICBraW5kOiBPcEtpbmQuTGlzdEVuZCxcbiAgICBuZXh0OiBudWxsLFxuICAgIHByZXY6IG51bGwsXG4gICAgZGVidWdMaXN0SWQ6IHRoaXMuZGVidWdMaXN0SWQsXG4gIH0gYXMgT3BUO1xuXG4gIHJlYWRvbmx5IHRhaWwgPSB7XG4gICAga2luZDogT3BLaW5kLkxpc3RFbmQsXG4gICAgbmV4dDogbnVsbCxcbiAgICBwcmV2OiBudWxsLFxuICAgIGRlYnVnTGlzdElkOiB0aGlzLmRlYnVnTGlzdElkLFxuICB9IGFzIE9wVDtcblxuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIExpbmsgYGhlYWRgIGFuZCBgdGFpbGAgdG9nZXRoZXIgYXQgdGhlIHN0YXJ0IChsaXN0IGlzIGVtcHR5KS5cbiAgICB0aGlzLmhlYWQubmV4dCA9IHRoaXMudGFpbDtcbiAgICB0aGlzLnRhaWwucHJldiA9IHRoaXMuaGVhZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdXNoIGEgbmV3IG9wZXJhdGlvbiB0byB0aGUgdGFpbCBvZiB0aGUgbGlzdC5cbiAgICovXG4gIHB1c2gob3A6IE9wVCk6IHZvaWQge1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvcCk7XG4gICAgT3BMaXN0LmFzc2VydElzVW5vd25lZChvcCk7XG5cbiAgICBvcC5kZWJ1Z0xpc3RJZCA9IHRoaXMuZGVidWdMaXN0SWQ7XG5cbiAgICAvLyBUaGUgb2xkIFwicHJldmlvdXNcIiBub2RlICh3aGljaCBtaWdodCBiZSB0aGUgaGVhZCwgaWYgdGhlIGxpc3QgaXMgZW1wdHkpLlxuICAgIGNvbnN0IG9sZExhc3QgPSB0aGlzLnRhaWwucHJldiE7XG5cbiAgICAvLyBJbnNlcnQgYG9wYCBmb2xsb3dpbmcgdGhlIG9sZCBsYXN0IG5vZGUuXG4gICAgb3AucHJldiA9IG9sZExhc3Q7XG4gICAgb2xkTGFzdC5uZXh0ID0gb3A7XG5cbiAgICAvLyBDb25uZWN0IGBvcGAgd2l0aCB0aGUgbGlzdCB0YWlsLlxuICAgIG9wLm5leHQgPSB0aGlzLnRhaWw7XG4gICAgdGhpcy50YWlsLnByZXYgPSBvcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kIG9uZSBvciBtb3JlIG5vZGVzIHRvIHRoZSBzdGFydCBvZiB0aGUgbGlzdC5cbiAgICovXG4gIHByZXBlbmQob3BzOiBPcFRbXSk6IHZvaWQge1xuICAgIGlmIChvcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvcCk7XG4gICAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG9wKTtcblxuICAgICAgb3AuZGVidWdMaXN0SWQgPSB0aGlzLmRlYnVnTGlzdElkO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0ID0gdGhpcy5oZWFkLm5leHQhO1xuXG4gICAgbGV0IHByZXYgPSB0aGlzLmhlYWQ7XG4gICAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICAgIHByZXYubmV4dCA9IG9wO1xuICAgICAgb3AucHJldiA9IHByZXY7XG5cbiAgICAgIHByZXYgPSBvcDtcbiAgICB9XG5cbiAgICBwcmV2Lm5leHQgPSBmaXJzdDtcbiAgICBmaXJzdC5wcmV2ID0gcHJldjtcbiAgfVxuXG4gIC8qKlxuICAgKiBgT3BMaXN0YCBpcyBpdGVyYWJsZSB2aWEgdGhlIGl0ZXJhdGlvbiBwcm90b2NvbC5cbiAgICpcbiAgICogSXQncyBzYWZlIHRvIG11dGF0ZSB0aGUgcGFydCBvZiB0aGUgbGlzdCB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmV0dXJuZWQgYnkgdGhlIGl0ZXJhdG9yLCB1cCB0b1xuICAgKiBhbmQgaW5jbHVkaW5nIHRoZSBsYXN0IG9wZXJhdGlvbiByZXR1cm5lZC4gTXV0YXRpb25zIGJleW9uZCB0aGF0IHBvaW50IF9tYXlfIGJlIHNhZmUsIGJ1dCBtYXlcbiAgICogYWxzbyBjb3JydXB0IHRoZSBpdGVyYXRpb24gcG9zaXRpb24gYW5kIHNob3VsZCBiZSBhdm9pZGVkLlxuICAgKi9cbiAgKiBbU3ltYm9sLml0ZXJhdG9yXSgpOiBHZW5lcmF0b3I8T3BUPiB7XG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLmhlYWQubmV4dCE7XG4gICAgd2hpbGUgKGN1cnJlbnQgIT09IHRoaXMudGFpbCkge1xuICAgICAgLy8gR3VhcmRzIGFnYWluc3QgY29ycnVwdGlvbiBvZiB0aGUgaXRlcmF0b3Igc3RhdGUgYnkgbXV0YXRpb25zIHRvIHRoZSB0YWlsIG9mIHRoZSBsaXN0IGR1cmluZ1xuICAgICAgLy8gaXRlcmF0aW9uLlxuICAgICAgT3BMaXN0LmFzc2VydElzT3duZWQoY3VycmVudCk7XG5cbiAgICAgIGNvbnN0IG5leHQgPSBjdXJyZW50Lm5leHQhO1xuICAgICAgeWllbGQgY3VycmVudDtcbiAgICAgIGN1cnJlbnQgPSBuZXh0O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYWNlIGBvbGRPcGAgd2l0aCBgbmV3T3BgIGluIHRoZSBsaXN0LlxuICAgKi9cbiAgc3RhdGljIHJlcGxhY2U8T3BUIGV4dGVuZHMgT3A8T3BUPj4ob2xkT3A6IE9wVCwgbmV3T3A6IE9wVCk6IHZvaWQge1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvbGRPcCk7XG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG5ld09wKTtcblxuICAgIE9wTGlzdC5hc3NlcnRJc093bmVkKG9sZE9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG5ld09wKTtcblxuICAgIG5ld09wLmRlYnVnTGlzdElkID0gb2xkT3AuZGVidWdMaXN0SWQ7XG4gICAgaWYgKG9sZE9wLnByZXYgIT09IG51bGwpIHtcbiAgICAgIG9sZE9wLnByZXYubmV4dCA9IG5ld09wO1xuICAgICAgbmV3T3AucHJldiA9IG9sZE9wLnByZXY7XG4gICAgfVxuICAgIGlmIChvbGRPcC5uZXh0ICE9PSBudWxsKSB7XG4gICAgICBvbGRPcC5uZXh0LnByZXYgPSBuZXdPcDtcbiAgICAgIG5ld09wLm5leHQgPSBvbGRPcC5uZXh0O1xuICAgIH1cbiAgICBvbGRPcC5kZWJ1Z0xpc3RJZCA9IG51bGw7XG4gICAgb2xkT3AucHJldiA9IG51bGw7XG4gICAgb2xkT3AubmV4dCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZSBgb2xkT3BgIHdpdGggc29tZSBudW1iZXIgb2YgbmV3IG9wZXJhdGlvbnMgaW4gdGhlIGxpc3QgKHdoaWNoIG1heSBpbmNsdWRlIGBvbGRPcGApLlxuICAgKi9cbiAgc3RhdGljIHJlcGxhY2VXaXRoTWFueTxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvbGRPcDogT3BULCBuZXdPcHM6IE9wVFtdKTogdm9pZCB7XG4gICAgaWYgKG5ld09wcy5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFJlcGxhY2luZyB3aXRoIGFuIGVtcHR5IGxpc3QgLT4gcHVyZSByZW1vdmFsLlxuICAgICAgT3BMaXN0LnJlbW92ZShvbGRPcCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG9sZE9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNPd25lZChvbGRPcCk7XG5cbiAgICBjb25zdCBsaXN0SWQgPSBvbGRPcC5kZWJ1Z0xpc3RJZDtcbiAgICBvbGRPcC5kZWJ1Z0xpc3RJZCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IG5ld09wIG9mIG5ld09wcykge1xuICAgICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG5ld09wKTtcblxuICAgICAgLy8gYG5ld09wYCBtaWdodCBiZSBgb2xkT3BgLCBidXQgYXQgdGhpcyBwb2ludCBpdCdzIGJlZW4gbWFya2VkIGFzIHVub3duZWQuXG4gICAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG5ld09wKTtcbiAgICB9XG5cbiAgICAvLyBJdCBzaG91bGQgYmUgc2FmZSB0byByZXVzZSBgb2xkT3BgIGluIHRoZSBgbmV3T3BzYCBsaXN0IC0gbWF5YmUgeW91IHdhbnQgdG8gc2FuZHdpY2ggYW5cbiAgICAvLyBvcGVyYXRpb24gYmV0d2VlbiB0d28gbmV3IG9wcy5cbiAgICBjb25zdCB7cHJldjogb2xkUHJldiwgbmV4dDogb2xkTmV4dH0gPSBvbGRPcDtcbiAgICBvbGRPcC5wcmV2ID0gbnVsbDtcbiAgICBvbGRPcC5uZXh0ID0gbnVsbDtcblxuICAgIGxldCBwcmV2OiBPcFQgPSBvbGRQcmV2ITtcbiAgICBmb3IgKGNvbnN0IG5ld09wIG9mIG5ld09wcykge1xuICAgICAgdGhpcy5hc3NlcnRJc1Vub3duZWQobmV3T3ApO1xuICAgICAgbmV3T3AuZGVidWdMaXN0SWQgPSBsaXN0SWQ7XG5cbiAgICAgIHByZXYhLm5leHQgPSBuZXdPcDtcbiAgICAgIG5ld09wLnByZXYgPSBwcmV2O1xuXG4gICAgICAvLyBUaGlzIF9zaG91bGRfIGJlIHRoZSBjYXNlLCBidXQgc2V0IGl0IGp1c3QgaW4gY2FzZS5cbiAgICAgIG5ld09wLm5leHQgPSBudWxsO1xuXG4gICAgICBwcmV2ID0gbmV3T3A7XG4gICAgfVxuICAgIC8vIEF0IHRoZSBlbmQgb2YgaXRlcmF0aW9uLCBgcHJldmAgaG9sZHMgdGhlIGxhc3Qgbm9kZSBpbiB0aGUgbGlzdC5cbiAgICBjb25zdCBmaXJzdCA9IG5ld09wc1swXSE7XG4gICAgY29uc3QgbGFzdCA9IHByZXYhO1xuXG4gICAgLy8gUmVwbGFjZSBgb2xkT3BgIHdpdGggdGhlIGNoYWluIGBmaXJzdGAgLT4gYGxhc3RgLlxuICAgIGlmIChvbGRQcmV2ICE9PSBudWxsKSB7XG4gICAgICBvbGRQcmV2Lm5leHQgPSBmaXJzdDtcbiAgICAgIGZpcnN0LnByZXYgPSBvbGRPcC5wcmV2O1xuICAgIH1cblxuICAgIGlmIChvbGROZXh0ICE9PSBudWxsKSB7XG4gICAgICBvbGROZXh0LnByZXYgPSBsYXN0O1xuICAgICAgbGFzdC5uZXh0ID0gb2xkTmV4dDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBnaXZlbiBub2RlIGZyb20gdGhlIGxpc3Qgd2hpY2ggY29udGFpbnMgaXQuXG4gICAqL1xuICBzdGF0aWMgcmVtb3ZlPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQpOiB2b2lkIHtcbiAgICBPcExpc3QuYXNzZXJ0SXNOb3RFbmQob3ApO1xuICAgIE9wTGlzdC5hc3NlcnRJc093bmVkKG9wKTtcblxuICAgIG9wLnByZXYhLm5leHQgPSBvcC5uZXh0O1xuICAgIG9wLm5leHQhLnByZXYgPSBvcC5wcmV2O1xuXG4gICAgLy8gQnJlYWsgYW55IGxpbmsgYmV0d2VlbiB0aGUgbm9kZSBhbmQgdGhpcyBsaXN0IHRvIHNhZmVndWFyZCBhZ2FpbnN0IGl0cyB1c2FnZSBpbiBmdXR1cmVcbiAgICAvLyBvcGVyYXRpb25zLlxuICAgIG9wLmRlYnVnTGlzdElkID0gbnVsbDtcbiAgICBvcC5wcmV2ID0gbnVsbDtcbiAgICBvcC5uZXh0ID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnQgYG9wYCBiZWZvcmUgYGJlZm9yZWAuXG4gICAqL1xuICBzdGF0aWMgaW5zZXJ0QmVmb3JlPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQsIGJlZm9yZTogT3BUKTogdm9pZCB7XG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKGJlZm9yZSk7XG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG9wKTtcblxuICAgIE9wTGlzdC5hc3NlcnRJc1Vub3duZWQob3ApO1xuICAgIE9wTGlzdC5hc3NlcnRJc093bmVkKGJlZm9yZSwgb3AuZGVidWdMaXN0SWQhKTtcblxuICAgIG9wLmRlYnVnTGlzdElkID0gYmVmb3JlLmRlYnVnTGlzdElkO1xuXG4gICAgLy8gSnVzdCBpbiBjYXNlLlxuICAgIG9wLnByZXYgPSBudWxsO1xuXG4gICAgYmVmb3JlLnByZXYhLm5leHQgPSBvcDtcbiAgICBvcC5wcmV2ID0gYmVmb3JlLnByZXY7XG5cbiAgICBvcC5uZXh0ID0gYmVmb3JlO1xuICAgIGJlZm9yZS5wcmV2ID0gb3A7XG4gIH1cblxuICAvKipcbiAgICogQXNzZXJ0cyB0aGF0IGBvcGAgZG9lcyBub3QgY3VycmVudGx5IGJlbG9uZyB0byBhIGxpc3QuXG4gICAqL1xuICBzdGF0aWMgYXNzZXJ0SXNVbm93bmVkPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQpOiB2b2lkIHtcbiAgICBpZiAob3AuZGVidWdMaXN0SWQgIT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGlsbGVnYWwgb3BlcmF0aW9uIG9uIG93bmVkIG5vZGU6ICR7T3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9wYCBjdXJyZW50bHkgYmVsb25ncyB0byBhIGxpc3QuIElmIGBieUxpc3RgIGlzIHBhc3NlZCwgYG9wYCBpcyBhc3NlcnRlZCB0b1xuICAgKiBzcGVjaWZpY2FsbHkgYmVsb25nIHRvIHRoYXQgbGlzdC5cbiAgICovXG4gIHN0YXRpYyBhc3NlcnRJc093bmVkPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9wOiBPcFQsIGJ5TGlzdD86IG51bWJlcik6IHZvaWQge1xuICAgIGlmIChvcC5kZWJ1Z0xpc3RJZCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogaWxsZWdhbCBvcGVyYXRpb24gb24gdW5vd25lZCBub2RlOiAke09wS2luZFtvcC5raW5kXX1gKTtcbiAgICB9IGVsc2UgaWYgKGJ5TGlzdCAhPT0gdW5kZWZpbmVkICYmIG9wLmRlYnVnTGlzdElkICE9PSBieUxpc3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IG5vZGUgYmVsb25ncyB0byB0aGUgd3JvbmcgbGlzdCAoZXhwZWN0ZWQgJHtieUxpc3R9LCBhY3R1YWwgJHtcbiAgICAgICAgICBvcC5kZWJ1Z0xpc3RJZH0pYCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VydHMgdGhhdCBgb3BgIGlzIG5vdCBhIHNwZWNpYWwgYExpc3RFbmRgIG5vZGUuXG4gICAqL1xuICBzdGF0aWMgYXNzZXJ0SXNOb3RFbmQ8T3BUIGV4dGVuZHMgT3A8T3BUPj4ob3A6IE9wVCk6IHZvaWQge1xuICAgIGlmIChvcC5raW5kID09PSBPcEtpbmQuTGlzdEVuZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogaWxsZWdhbCBvcGVyYXRpb24gb24gbGlzdCBoZWFkIG9yIHRhaWxgKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==