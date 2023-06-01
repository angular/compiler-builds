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
        OpList.assertIsNotEnd(before);
        OpList.assertIsNotEnd(op);
        OpList.assertIsUnowned(op);
        OpList.assertIsOwned(before);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvb3BlcmF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBeUMvQjs7OztHQUlHO0FBQ0gsTUFBYSxNQUFNO2FBQ1YsZUFBVSxHQUFHLENBQUMsQUFBSixDQUFLO0lBeUJ0QjtRQXZCQTs7V0FFRztRQUNNLGdCQUFXLEdBQUcsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRTNDLGtFQUFrRTtRQUNsRSxxRUFBcUU7UUFDckUsbUNBQW1DO1FBQzFCLFNBQUksR0FBUTtZQUNuQixJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU87WUFDcEIsSUFBSSxFQUFFLElBQUk7WUFDVixJQUFJLEVBQUUsSUFBSTtZQUNWLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztTQUN2QixDQUFDO1FBRUEsU0FBSSxHQUFHO1lBQ2QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPO1lBQ3BCLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7WUFDVixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7U0FDdkIsQ0FBQztRQUlQLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLEVBQU87UUFDVixNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFM0IsRUFBRSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBRWxDLDJFQUEyRTtRQUMzRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUssQ0FBQztRQUVoQywyQ0FBMkM7UUFDM0MsRUFBRSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUM7UUFDbEIsT0FBTyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFbEIsbUNBQW1DO1FBQ25DLEVBQUUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTyxDQUFDLEdBQVU7UUFDaEIsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNwQixPQUFPO1NBQ1I7UUFFRCxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNwQixNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUM7WUFFM0IsRUFBRSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1NBQ25DO1FBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFLLENBQUM7UUFFOUIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNyQixLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNwQixJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNmLEVBQUUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBRWYsSUFBSSxHQUFHLEVBQUUsQ0FBQztTQUNYO1FBRUQsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7UUFDbEIsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDcEIsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILENBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBQ2pCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSyxDQUFDO1FBQzlCLE9BQU8sT0FBTyxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDNUIsOEZBQThGO1lBQzlGLGFBQWE7WUFDYixNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFaEQsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUssQ0FBQztZQUMzQixNQUFNLE9BQU8sQ0FBQztZQUNkLE9BQU8sR0FBRyxJQUFJLENBQUM7U0FDaEI7SUFDSCxDQUFDO0lBRUQsQ0FBRSxRQUFRO1FBQ1IsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFLLENBQUM7UUFDOUIsT0FBTyxPQUFPLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRTtZQUM1QixNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFaEQsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUssQ0FBQztZQUMzQixNQUFNLE9BQU8sQ0FBQztZQUNkLE9BQU8sR0FBRyxJQUFJLENBQUM7U0FDaEI7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsT0FBTyxDQUFzQixLQUFVLEVBQUUsS0FBVTtRQUN4RCxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdCLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFN0IsTUFBTSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QixNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTlCLEtBQUssQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztRQUN0QyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1lBQ3ZCLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztZQUN4QixLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDekI7UUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1lBQ3ZCLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztZQUN4QixLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDekI7UUFDRCxLQUFLLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztRQUN6QixLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNsQixLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztJQUNwQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsZUFBZSxDQUFzQixLQUFVLEVBQUUsTUFBYTtRQUNuRSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3ZCLGdEQUFnRDtZQUNoRCxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3JCLE9BQU87U0FDUjtRQUVELE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsTUFBTSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU1QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1FBQ2pDLEtBQUssQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBRXpCLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1lBQzFCLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFN0IsMkVBQTJFO1lBQzNFLE1BQU0sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDL0I7UUFFRCwwRkFBMEY7UUFDMUYsaUNBQWlDO1FBQ2pDLE1BQU0sRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUMsR0FBRyxLQUFLLENBQUM7UUFDN0MsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDbEIsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFFbEIsSUFBSSxJQUFJLEdBQVEsT0FBUSxDQUFDO1FBQ3pCLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1lBQzFCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUIsS0FBSyxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUM7WUFFM0IsSUFBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7WUFDbkIsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7WUFFbEIsc0RBQXNEO1lBQ3RELEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBRWxCLElBQUksR0FBRyxLQUFLLENBQUM7U0FDZDtRQUNELG1FQUFtRTtRQUNuRSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFFLENBQUM7UUFDekIsTUFBTSxJQUFJLEdBQUcsSUFBSyxDQUFDO1FBRW5CLG9EQUFvRDtRQUNwRCxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7WUFDcEIsT0FBTyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7WUFDckIsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1NBQ3pCO1FBRUQsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1lBQ3BCLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDO1NBQ3JCO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLE1BQU0sQ0FBc0IsRUFBTztRQUN4QyxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFekIsRUFBRSxDQUFDLElBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztRQUN4QixFQUFFLENBQUMsSUFBSyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO1FBRXhCLHlGQUF5RjtRQUN6RixjQUFjO1FBQ2QsRUFBRSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDdEIsRUFBRSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDZixFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztJQUNqQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsWUFBWSxDQUFzQixFQUFPLEVBQUUsTUFBVztRQUMzRCxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFMUIsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMzQixNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTdCLEVBQUUsQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUVwQyxnQkFBZ0I7UUFDaEIsRUFBRSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFFZixNQUFNLENBQUMsSUFBSyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDdkIsRUFBRSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRXRCLEVBQUUsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO1FBQ2pCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxlQUFlLENBQXNCLEVBQU87UUFDakQsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLElBQUksRUFBRTtZQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUN4RjtJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsYUFBYSxDQUFzQixFQUFPLEVBQUUsTUFBZTtRQUNoRSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQzFGO2FBQU0sSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEtBQUssTUFBTSxFQUFFO1lBQzVELE1BQU0sSUFBSSxLQUFLLENBQUMsNERBQTRELE1BQU0sWUFDOUUsRUFBRSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7U0FDeEI7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsY0FBYyxDQUFzQixFQUFPO1FBQ2hELElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsT0FBTyxFQUFFO1lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsd0RBQXdELENBQUMsQ0FBQztTQUMzRTtJQUNILENBQUM7O1NBdlFVLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtPcEtpbmR9IGZyb20gJy4vZW51bXMnO1xuXG4vKipcbiAqIEJyYW5kZWQgdHlwZSBmb3IgYSBjcm9zcy1yZWZlcmVuY2UgSUQuIER1cmluZyBpbmdlc3QsIGBYcmVmSWRgcyBhcmUgZ2VuZXJhdGVkIHRvIGxpbmsgdG9nZXRoZXJcbiAqIGRpZmZlcmVudCBJUiBvcGVyYXRpb25zIHdoaWNoIG5lZWQgdG8gcmVmZXJlbmNlIGVhY2ggb3RoZXIuXG4gKi9cbmV4cG9ydCB0eXBlIFhyZWZJZCA9IG51bWJlciZ7X19icmFuZDogJ1hyZWZJZCd9O1xuXG4vKipcbiAqIEJhc2UgaW50ZXJmYWNlIGZvciBzZW1hbnRpYyBvcGVyYXRpb25zIGJlaW5nIHBlcmZvcm1lZCB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0gT3BUIGEgc3BlY2lmaWMgbmFycm93ZXIgdHlwZSBvZiBgT3BgIChmb3IgZXhhbXBsZSwgY3JlYXRpb24gb3BlcmF0aW9ucykgd2hpY2ggdGhpc1xuICogICAgIHNwZWNpZmljIHN1YnR5cGUgb2YgYE9wYCBjYW4gYmUgbGlua2VkIHdpdGggaW4gYSBsaW5rZWQgbGlzdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPcDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PiB7XG4gIC8qKlxuICAgKiBBbGwgb3BlcmF0aW9ucyBoYXZlIGEgZGlzdGluY3Qga2luZC5cbiAgICovXG4gIGtpbmQ6IE9wS2luZDtcblxuICAvKipcbiAgICogVGhlIHByZXZpb3VzIG9wZXJhdGlvbiBpbiB0aGUgbGlua2VkIGxpc3QsIGlmIGFueS5cbiAgICpcbiAgICogVGhpcyBpcyBgbnVsbGAgZm9yIG9wZXJhdGlvbiBub2RlcyBub3QgY3VycmVudGx5IGluIGEgbGlzdCwgb3IgZm9yIHRoZSBzcGVjaWFsIGhlYWQvdGFpbCBub2Rlcy5cbiAgICovXG4gIHByZXY6IE9wVHxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbmV4dCBvcGVyYXRpb24gaW4gdGhlIGxpbmtlZCBsaXN0LCBpZiBhbnkuXG4gICAqXG4gICAqIFRoaXMgaXMgYG51bGxgIGZvciBvcGVyYXRpb24gbm9kZXMgbm90IGN1cnJlbnRseSBpbiBhIGxpc3QsIG9yIGZvciB0aGUgc3BlY2lhbCBoZWFkL3RhaWwgbm9kZXMuXG4gICAqL1xuICBuZXh0OiBPcFR8bnVsbDtcblxuICAvKipcbiAgICogRGVidWcgaWQgb2YgdGhlIGxpc3QgdG8gd2hpY2ggdGhpcyBub2RlIGN1cnJlbnRseSBiZWxvbmdzLCBvciBgbnVsbGAgaWYgdGhpcyBub2RlIGlzIG5vdCBwYXJ0XG4gICAqIG9mIGEgbGlzdC5cbiAgICovXG4gIGRlYnVnTGlzdElkOiBudW1iZXJ8bnVsbDtcbn1cblxuLyoqXG4gKiBBIGxpbmtlZCBsaXN0IG9mIGBPcGAgbm9kZXMgb2YgYSBnaXZlbiBzdWJ0eXBlLlxuICpcbiAqIEBwYXJhbSBPcFQgc3BlY2lmaWMgc3VidHlwZSBvZiBgT3BgIG5vZGVzIHdoaWNoIHRoaXMgbGlzdCBjb250YWlucy5cbiAqL1xuZXhwb3J0IGNsYXNzIE9wTGlzdDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PiB7XG4gIHN0YXRpYyBuZXh0TGlzdElkID0gMDtcblxuICAvKipcbiAgICogRGVidWcgSUQgb2YgdGhpcyBgT3BMaXN0YCBpbnN0YW5jZS5cbiAgICovXG4gIHJlYWRvbmx5IGRlYnVnTGlzdElkID0gT3BMaXN0Lm5leHRMaXN0SWQrKztcblxuICAvLyBPcExpc3QgdXNlcyBzdGF0aWMgaGVhZC90YWlsIG5vZGVzIG9mIGEgc3BlY2lhbCBgTGlzdEVuZGAgdHlwZS5cbiAgLy8gVGhpcyBhdm9pZHMgdGhlIG5lZWQgZm9yIHNwZWNpYWwgY2FzaW5nIG9mIHRoZSBmaXJzdCBhbmQgbGFzdCBsaXN0XG4gIC8vIGVsZW1lbnRzIGluIGFsbCBsaXN0IG9wZXJhdGlvbnMuXG4gIHJlYWRvbmx5IGhlYWQ6IE9wVCA9IHtcbiAgICBraW5kOiBPcEtpbmQuTGlzdEVuZCxcbiAgICBuZXh0OiBudWxsLFxuICAgIHByZXY6IG51bGwsXG4gICAgZGVidWdMaXN0SWQ6IHRoaXMuZGVidWdMaXN0SWQsXG4gIH0gYXMgT3BUO1xuXG4gIHJlYWRvbmx5IHRhaWwgPSB7XG4gICAga2luZDogT3BLaW5kLkxpc3RFbmQsXG4gICAgbmV4dDogbnVsbCxcbiAgICBwcmV2OiBudWxsLFxuICAgIGRlYnVnTGlzdElkOiB0aGlzLmRlYnVnTGlzdElkLFxuICB9IGFzIE9wVDtcblxuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIExpbmsgYGhlYWRgIGFuZCBgdGFpbGAgdG9nZXRoZXIgYXQgdGhlIHN0YXJ0IChsaXN0IGlzIGVtcHR5KS5cbiAgICB0aGlzLmhlYWQubmV4dCA9IHRoaXMudGFpbDtcbiAgICB0aGlzLnRhaWwucHJldiA9IHRoaXMuaGVhZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdXNoIGEgbmV3IG9wZXJhdGlvbiB0byB0aGUgdGFpbCBvZiB0aGUgbGlzdC5cbiAgICovXG4gIHB1c2gob3A6IE9wVCk6IHZvaWQge1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvcCk7XG4gICAgT3BMaXN0LmFzc2VydElzVW5vd25lZChvcCk7XG5cbiAgICBvcC5kZWJ1Z0xpc3RJZCA9IHRoaXMuZGVidWdMaXN0SWQ7XG5cbiAgICAvLyBUaGUgb2xkIFwicHJldmlvdXNcIiBub2RlICh3aGljaCBtaWdodCBiZSB0aGUgaGVhZCwgaWYgdGhlIGxpc3QgaXMgZW1wdHkpLlxuICAgIGNvbnN0IG9sZExhc3QgPSB0aGlzLnRhaWwucHJldiE7XG5cbiAgICAvLyBJbnNlcnQgYG9wYCBmb2xsb3dpbmcgdGhlIG9sZCBsYXN0IG5vZGUuXG4gICAgb3AucHJldiA9IG9sZExhc3Q7XG4gICAgb2xkTGFzdC5uZXh0ID0gb3A7XG5cbiAgICAvLyBDb25uZWN0IGBvcGAgd2l0aCB0aGUgbGlzdCB0YWlsLlxuICAgIG9wLm5leHQgPSB0aGlzLnRhaWw7XG4gICAgdGhpcy50YWlsLnByZXYgPSBvcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kIG9uZSBvciBtb3JlIG5vZGVzIHRvIHRoZSBzdGFydCBvZiB0aGUgbGlzdC5cbiAgICovXG4gIHByZXBlbmQob3BzOiBPcFRbXSk6IHZvaWQge1xuICAgIGlmIChvcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvcCk7XG4gICAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG9wKTtcblxuICAgICAgb3AuZGVidWdMaXN0SWQgPSB0aGlzLmRlYnVnTGlzdElkO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0ID0gdGhpcy5oZWFkLm5leHQhO1xuXG4gICAgbGV0IHByZXYgPSB0aGlzLmhlYWQ7XG4gICAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICAgIHByZXYubmV4dCA9IG9wO1xuICAgICAgb3AucHJldiA9IHByZXY7XG5cbiAgICAgIHByZXYgPSBvcDtcbiAgICB9XG5cbiAgICBwcmV2Lm5leHQgPSBmaXJzdDtcbiAgICBmaXJzdC5wcmV2ID0gcHJldjtcbiAgfVxuXG4gIC8qKlxuICAgKiBgT3BMaXN0YCBpcyBpdGVyYWJsZSB2aWEgdGhlIGl0ZXJhdGlvbiBwcm90b2NvbC5cbiAgICpcbiAgICogSXQncyBzYWZlIHRvIG11dGF0ZSB0aGUgcGFydCBvZiB0aGUgbGlzdCB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmV0dXJuZWQgYnkgdGhlIGl0ZXJhdG9yLCB1cCB0b1xuICAgKiBhbmQgaW5jbHVkaW5nIHRoZSBsYXN0IG9wZXJhdGlvbiByZXR1cm5lZC4gTXV0YXRpb25zIGJleW9uZCB0aGF0IHBvaW50IF9tYXlfIGJlIHNhZmUsIGJ1dCBtYXlcbiAgICogYWxzbyBjb3JydXB0IHRoZSBpdGVyYXRpb24gcG9zaXRpb24gYW5kIHNob3VsZCBiZSBhdm9pZGVkLlxuICAgKi9cbiAgKiBbU3ltYm9sLml0ZXJhdG9yXSgpOiBHZW5lcmF0b3I8T3BUPiB7XG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLmhlYWQubmV4dCE7XG4gICAgd2hpbGUgKGN1cnJlbnQgIT09IHRoaXMudGFpbCkge1xuICAgICAgLy8gR3VhcmRzIGFnYWluc3QgY29ycnVwdGlvbiBvZiB0aGUgaXRlcmF0b3Igc3RhdGUgYnkgbXV0YXRpb25zIHRvIHRoZSB0YWlsIG9mIHRoZSBsaXN0IGR1cmluZ1xuICAgICAgLy8gaXRlcmF0aW9uLlxuICAgICAgT3BMaXN0LmFzc2VydElzT3duZWQoY3VycmVudCwgdGhpcy5kZWJ1Z0xpc3RJZCk7XG5cbiAgICAgIGNvbnN0IG5leHQgPSBjdXJyZW50Lm5leHQhO1xuICAgICAgeWllbGQgY3VycmVudDtcbiAgICAgIGN1cnJlbnQgPSBuZXh0O1xuICAgIH1cbiAgfVxuXG4gICogcmV2ZXJzZWQoKTogR2VuZXJhdG9yPE9wVD4ge1xuICAgIGxldCBjdXJyZW50ID0gdGhpcy50YWlsLnByZXYhO1xuICAgIHdoaWxlIChjdXJyZW50ICE9PSB0aGlzLmhlYWQpIHtcbiAgICAgIE9wTGlzdC5hc3NlcnRJc093bmVkKGN1cnJlbnQsIHRoaXMuZGVidWdMaXN0SWQpO1xuXG4gICAgICBjb25zdCBwcmV2ID0gY3VycmVudC5wcmV2ITtcbiAgICAgIHlpZWxkIGN1cnJlbnQ7XG4gICAgICBjdXJyZW50ID0gcHJldjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZSBgb2xkT3BgIHdpdGggYG5ld09wYCBpbiB0aGUgbGlzdC5cbiAgICovXG4gIHN0YXRpYyByZXBsYWNlPE9wVCBleHRlbmRzIE9wPE9wVD4+KG9sZE9wOiBPcFQsIG5ld09wOiBPcFQpOiB2b2lkIHtcbiAgICBPcExpc3QuYXNzZXJ0SXNOb3RFbmQob2xkT3ApO1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChuZXdPcCk7XG5cbiAgICBPcExpc3QuYXNzZXJ0SXNPd25lZChvbGRPcCk7XG4gICAgT3BMaXN0LmFzc2VydElzVW5vd25lZChuZXdPcCk7XG5cbiAgICBuZXdPcC5kZWJ1Z0xpc3RJZCA9IG9sZE9wLmRlYnVnTGlzdElkO1xuICAgIGlmIChvbGRPcC5wcmV2ICE9PSBudWxsKSB7XG4gICAgICBvbGRPcC5wcmV2Lm5leHQgPSBuZXdPcDtcbiAgICAgIG5ld09wLnByZXYgPSBvbGRPcC5wcmV2O1xuICAgIH1cbiAgICBpZiAob2xkT3AubmV4dCAhPT0gbnVsbCkge1xuICAgICAgb2xkT3AubmV4dC5wcmV2ID0gbmV3T3A7XG4gICAgICBuZXdPcC5uZXh0ID0gb2xkT3AubmV4dDtcbiAgICB9XG4gICAgb2xkT3AuZGVidWdMaXN0SWQgPSBudWxsO1xuICAgIG9sZE9wLnByZXYgPSBudWxsO1xuICAgIG9sZE9wLm5leHQgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2UgYG9sZE9wYCB3aXRoIHNvbWUgbnVtYmVyIG9mIG5ldyBvcGVyYXRpb25zIGluIHRoZSBsaXN0ICh3aGljaCBtYXkgaW5jbHVkZSBgb2xkT3BgKS5cbiAgICovXG4gIHN0YXRpYyByZXBsYWNlV2l0aE1hbnk8T3BUIGV4dGVuZHMgT3A8T3BUPj4ob2xkT3A6IE9wVCwgbmV3T3BzOiBPcFRbXSk6IHZvaWQge1xuICAgIGlmIChuZXdPcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBSZXBsYWNpbmcgd2l0aCBhbiBlbXB0eSBsaXN0IC0+IHB1cmUgcmVtb3ZhbC5cbiAgICAgIE9wTGlzdC5yZW1vdmUob2xkT3ApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvbGRPcCk7XG4gICAgT3BMaXN0LmFzc2VydElzT3duZWQob2xkT3ApO1xuXG4gICAgY29uc3QgbGlzdElkID0gb2xkT3AuZGVidWdMaXN0SWQ7XG4gICAgb2xkT3AuZGVidWdMaXN0SWQgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCBuZXdPcCBvZiBuZXdPcHMpIHtcbiAgICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChuZXdPcCk7XG5cbiAgICAgIC8vIGBuZXdPcGAgbWlnaHQgYmUgYG9sZE9wYCwgYnV0IGF0IHRoaXMgcG9pbnQgaXQncyBiZWVuIG1hcmtlZCBhcyB1bm93bmVkLlxuICAgICAgT3BMaXN0LmFzc2VydElzVW5vd25lZChuZXdPcCk7XG4gICAgfVxuXG4gICAgLy8gSXQgc2hvdWxkIGJlIHNhZmUgdG8gcmV1c2UgYG9sZE9wYCBpbiB0aGUgYG5ld09wc2AgbGlzdCAtIG1heWJlIHlvdSB3YW50IHRvIHNhbmR3aWNoIGFuXG4gICAgLy8gb3BlcmF0aW9uIGJldHdlZW4gdHdvIG5ldyBvcHMuXG4gICAgY29uc3Qge3ByZXY6IG9sZFByZXYsIG5leHQ6IG9sZE5leHR9ID0gb2xkT3A7XG4gICAgb2xkT3AucHJldiA9IG51bGw7XG4gICAgb2xkT3AubmV4dCA9IG51bGw7XG5cbiAgICBsZXQgcHJldjogT3BUID0gb2xkUHJldiE7XG4gICAgZm9yIChjb25zdCBuZXdPcCBvZiBuZXdPcHMpIHtcbiAgICAgIHRoaXMuYXNzZXJ0SXNVbm93bmVkKG5ld09wKTtcbiAgICAgIG5ld09wLmRlYnVnTGlzdElkID0gbGlzdElkO1xuXG4gICAgICBwcmV2IS5uZXh0ID0gbmV3T3A7XG4gICAgICBuZXdPcC5wcmV2ID0gcHJldjtcblxuICAgICAgLy8gVGhpcyBfc2hvdWxkXyBiZSB0aGUgY2FzZSwgYnV0IHNldCBpdCBqdXN0IGluIGNhc2UuXG4gICAgICBuZXdPcC5uZXh0ID0gbnVsbDtcblxuICAgICAgcHJldiA9IG5ld09wO1xuICAgIH1cbiAgICAvLyBBdCB0aGUgZW5kIG9mIGl0ZXJhdGlvbiwgYHByZXZgIGhvbGRzIHRoZSBsYXN0IG5vZGUgaW4gdGhlIGxpc3QuXG4gICAgY29uc3QgZmlyc3QgPSBuZXdPcHNbMF0hO1xuICAgIGNvbnN0IGxhc3QgPSBwcmV2ITtcblxuICAgIC8vIFJlcGxhY2UgYG9sZE9wYCB3aXRoIHRoZSBjaGFpbiBgZmlyc3RgIC0+IGBsYXN0YC5cbiAgICBpZiAob2xkUHJldiAhPT0gbnVsbCkge1xuICAgICAgb2xkUHJldi5uZXh0ID0gZmlyc3Q7XG4gICAgICBmaXJzdC5wcmV2ID0gb2xkT3AucHJldjtcbiAgICB9XG5cbiAgICBpZiAob2xkTmV4dCAhPT0gbnVsbCkge1xuICAgICAgb2xkTmV4dC5wcmV2ID0gbGFzdDtcbiAgICAgIGxhc3QubmV4dCA9IG9sZE5leHQ7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZ2l2ZW4gbm9kZSBmcm9tIHRoZSBsaXN0IHdoaWNoIGNvbnRhaW5zIGl0LlxuICAgKi9cbiAgc3RhdGljIHJlbW92ZTxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvcDogT3BUKTogdm9pZCB7XG4gICAgT3BMaXN0LmFzc2VydElzTm90RW5kKG9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNPd25lZChvcCk7XG5cbiAgICBvcC5wcmV2IS5uZXh0ID0gb3AubmV4dDtcbiAgICBvcC5uZXh0IS5wcmV2ID0gb3AucHJldjtcblxuICAgIC8vIEJyZWFrIGFueSBsaW5rIGJldHdlZW4gdGhlIG5vZGUgYW5kIHRoaXMgbGlzdCB0byBzYWZlZ3VhcmQgYWdhaW5zdCBpdHMgdXNhZ2UgaW4gZnV0dXJlXG4gICAgLy8gb3BlcmF0aW9ucy5cbiAgICBvcC5kZWJ1Z0xpc3RJZCA9IG51bGw7XG4gICAgb3AucHJldiA9IG51bGw7XG4gICAgb3AubmV4dCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0IGBvcGAgYmVmb3JlIGBiZWZvcmVgLlxuICAgKi9cbiAgc3RhdGljIGluc2VydEJlZm9yZTxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvcDogT3BULCBiZWZvcmU6IE9wVCk6IHZvaWQge1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChiZWZvcmUpO1xuICAgIE9wTGlzdC5hc3NlcnRJc05vdEVuZChvcCk7XG5cbiAgICBPcExpc3QuYXNzZXJ0SXNVbm93bmVkKG9wKTtcbiAgICBPcExpc3QuYXNzZXJ0SXNPd25lZChiZWZvcmUpO1xuXG4gICAgb3AuZGVidWdMaXN0SWQgPSBiZWZvcmUuZGVidWdMaXN0SWQ7XG5cbiAgICAvLyBKdXN0IGluIGNhc2UuXG4gICAgb3AucHJldiA9IG51bGw7XG5cbiAgICBiZWZvcmUucHJldiEubmV4dCA9IG9wO1xuICAgIG9wLnByZXYgPSBiZWZvcmUucHJldjtcblxuICAgIG9wLm5leHQgPSBiZWZvcmU7XG4gICAgYmVmb3JlLnByZXYgPSBvcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9wYCBkb2VzIG5vdCBjdXJyZW50bHkgYmVsb25nIHRvIGEgbGlzdC5cbiAgICovXG4gIHN0YXRpYyBhc3NlcnRJc1Vub3duZWQ8T3BUIGV4dGVuZHMgT3A8T3BUPj4ob3A6IE9wVCk6IHZvaWQge1xuICAgIGlmIChvcC5kZWJ1Z0xpc3RJZCAhPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogaWxsZWdhbCBvcGVyYXRpb24gb24gb3duZWQgbm9kZTogJHtPcEtpbmRbb3Aua2luZF19YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VydHMgdGhhdCBgb3BgIGN1cnJlbnRseSBiZWxvbmdzIHRvIGEgbGlzdC4gSWYgYGJ5TGlzdGAgaXMgcGFzc2VkLCBgb3BgIGlzIGFzc2VydGVkIHRvXG4gICAqIHNwZWNpZmljYWxseSBiZWxvbmcgdG8gdGhhdCBsaXN0LlxuICAgKi9cbiAgc3RhdGljIGFzc2VydElzT3duZWQ8T3BUIGV4dGVuZHMgT3A8T3BUPj4ob3A6IE9wVCwgYnlMaXN0PzogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKG9wLmRlYnVnTGlzdElkID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBpbGxlZ2FsIG9wZXJhdGlvbiBvbiB1bm93bmVkIG5vZGU6ICR7T3BLaW5kW29wLmtpbmRdfWApO1xuICAgIH0gZWxzZSBpZiAoYnlMaXN0ICE9PSB1bmRlZmluZWQgJiYgb3AuZGVidWdMaXN0SWQgIT09IGJ5TGlzdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbm9kZSBiZWxvbmdzIHRvIHRoZSB3cm9uZyBsaXN0IChleHBlY3RlZCAke2J5TGlzdH0sIGFjdHVhbCAke1xuICAgICAgICAgIG9wLmRlYnVnTGlzdElkfSlgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXNzZXJ0cyB0aGF0IGBvcGAgaXMgbm90IGEgc3BlY2lhbCBgTGlzdEVuZGAgbm9kZS5cbiAgICovXG4gIHN0YXRpYyBhc3NlcnRJc05vdEVuZDxPcFQgZXh0ZW5kcyBPcDxPcFQ+PihvcDogT3BUKTogdm9pZCB7XG4gICAgaWYgKG9wLmtpbmQgPT09IE9wS2luZC5MaXN0RW5kKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBpbGxlZ2FsIG9wZXJhdGlvbiBvbiBsaXN0IGhlYWQgb3IgdGFpbGApO1xuICAgIH1cbiAgfVxufVxuIl19