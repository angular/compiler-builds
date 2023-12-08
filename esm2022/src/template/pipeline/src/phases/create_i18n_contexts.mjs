/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Create one helper context op per i18n block (including generate descending blocks).
 *
 * Also, if an ICU exists inside an i18n block that also contains other localizable content (such as
 * string), create an additional helper context op for the ICU.
 *
 * These context ops are later used for generating i18n messages. (Although we generate at least one
 * context op per nested view, we will collect them up the tree later, to generate a top-level
 * message.)
 */
export function createI18nContexts(job) {
    const rootContexts = new Map();
    let currentI18nOp = null;
    let xref;
    // We use the message instead of the message ID, because placeholder values might differ even
    // when IDs are the same.
    const messageToContext = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nOp = op;
                    // Each root i18n block gets its own context, child ones refer to the context for their
                    // root block.
                    if (op.xref === op.root) {
                        xref = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(ir.I18nContextKind.RootI18n, xref, op.xref, op.message, null));
                        op.context = xref;
                        rootContexts.set(op.xref, xref);
                    }
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nOp = null;
                    break;
                case ir.OpKind.IcuStart:
                    // If an ICU represents a different message than its containing block, we give it its own
                    // i18n context.
                    if (currentI18nOp === null) {
                        throw Error('Unexpected ICU outside of an i18n block.');
                    }
                    if (op.message.id !== currentI18nOp.message.id) {
                        // There was an enclosing i18n block around this ICU somewhere.
                        xref = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(ir.I18nContextKind.Icu, xref, currentI18nOp.xref, op.message, null));
                        op.context = xref;
                    }
                    else {
                        // The i18n block was generated because of this ICU, OR it was explicit, but the ICU is
                        // the only localizable content inside of it.
                        op.context = currentI18nOp.context;
                    }
                    break;
            }
        }
        for (const op of unit.ops()) {
            switch (op.kind) {
                case ir.OpKind.Binding:
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                case ir.OpKind.ExtractedAttribute:
                    if (!op.i18nMessage) {
                        continue;
                    }
                    if (!messageToContext.has(op.i18nMessage)) {
                        // create the context
                        const i18nContext = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(ir.I18nContextKind.Attr, i18nContext, null, op.i18nMessage, null));
                        messageToContext.set(op.i18nMessage, i18nContext);
                    }
                    op.i18nContext = messageToContext.get(op.i18nMessage);
                    break;
            }
        }
    }
    // Assign contexts to child i18n blocks, now that all root i18n blocks have their context
    // assigned.
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart && op.xref !== op.root) {
                op.context = rootContexts.get(op.root);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5fY29udGV4dHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGVfaTE4bl9jb250ZXh0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBbUI7SUFDcEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7SUFDckQsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztJQUM5QyxJQUFJLElBQWUsQ0FBQztJQUdwQiw2RkFBNkY7SUFDN0YseUJBQXlCO0lBQ3pCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7SUFFNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixhQUFhLEdBQUcsRUFBRSxDQUFDO29CQUNuQix1RkFBdUY7b0JBQ3ZGLGNBQWM7b0JBQ2QsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDeEIsSUFBSSxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUNuQyxFQUFFLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFB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LEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7WUFDMUMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIENyZWF0ZSBvbmUgaGVscGVyIGNvbnRleHQgb3AgcGVyIGkxOG4gYmxvY2sgKGluY2x1ZGluZyBnZW5lcmF0ZSBkZXNjZW5kaW5nIGJsb2NrcykuXG4gKlxuICogQWxzbywgaWYgYW4gSUNVIGV4aXN0cyBpbnNpZGUgYW4gaTE4biBibG9jayB0aGF0IGFsc28gY29udGFpbnMgb3RoZXIgbG9jYWxpemFibGUgY29udGVudCAoc3VjaCBhc1xuICogc3RyaW5nKSwgY3JlYXRlIGFuIGFkZGl0aW9uYWwgaGVscGVyIGNvbnRleHQgb3AgZm9yIHRoZSBJQ1UuXG4gKlxuICogVGhlc2UgY29udGV4dCBvcHMgYXJlIGxhdGVyIHVzZWQgZm9yIGdlbmVyYXRpbmcgaTE4biBtZXNzYWdlcy4gKEFsdGhvdWdoIHdlIGdlbmVyYXRlIGF0IGxlYXN0IG9uZVxuICogY29udGV4dCBvcCBwZXIgbmVzdGVkIHZpZXcsIHdlIHdpbGwgY29sbGVjdCB0aGVtIHVwIHRoZSB0cmVlIGxhdGVyLCB0byBnZW5lcmF0ZSBhIHRvcC1sZXZlbFxuICogbWVzc2FnZS4pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuQ29udGV4dHMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBjb25zdCByb290Q29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuWHJlZklkPigpO1xuICBsZXQgY3VycmVudEkxOG5PcDogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG4gIGxldCB4cmVmOiBpci5YcmVmSWQ7XG5cblxuICAvLyBXZSB1c2UgdGhlIG1lc3NhZ2UgaW5zdGVhZCBvZiB0aGUgbWVzc2FnZSBJRCwgYmVjYXVzZSBwbGFjZWhvbGRlciB2YWx1ZXMgbWlnaHQgZGlmZmVyIGV2ZW5cbiAgLy8gd2hlbiBJRHMgYXJlIHRoZSBzYW1lLlxuICBjb25zdCBtZXNzYWdlVG9Db250ZXh0ID0gbmV3IE1hcDxpMThuLk1lc3NhZ2UsIGlyLlhyZWZJZD4oKTtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gb3A7XG4gICAgICAgICAgLy8gRWFjaCByb290IGkxOG4gYmxvY2sgZ2V0cyBpdHMgb3duIGNvbnRleHQsIGNoaWxkIG9uZXMgcmVmZXIgdG8gdGhlIGNvbnRleHQgZm9yIHRoZWlyXG4gICAgICAgICAgLy8gcm9vdCBibG9jay5cbiAgICAgICAgICBpZiAob3AueHJlZiA9PT0gb3Aucm9vdCkge1xuICAgICAgICAgICAgeHJlZiA9IGpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuQ29udGV4dE9wKFxuICAgICAgICAgICAgICAgIGlyLkkxOG5Db250ZXh0S2luZC5Sb290STE4biwgeHJlZiwgb3AueHJlZiwgb3AubWVzc2FnZSwgbnVsbCEpKTtcbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSB4cmVmO1xuICAgICAgICAgICAgcm9vdENvbnRleHRzLnNldChvcC54cmVmLCB4cmVmKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdVN0YXJ0OlxuICAgICAgICAgIC8vIElmIGFuIElDVSByZXByZXNlbnRzIGEgZGlmZmVyZW50IG1lc3NhZ2UgdGhhbiBpdHMgY29udGFpbmluZyBibG9jaywgd2UgZ2l2ZSBpdCBpdHMgb3duXG4gICAgICAgICAgLy8gaTE4biBjb250ZXh0LlxuICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignVW5leHBlY3RlZCBJQ1Ugb3V0c2lkZSBvZiBhbiBpMThuIGJsb2NrLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3AubWVzc2FnZS5pZCAhPT0gY3VycmVudEkxOG5PcC5tZXNzYWdlLmlkKSB7XG4gICAgICAgICAgICAvLyBUaGVyZSB3YXMgYW4gZW5jbG9zaW5nIGkxOG4gYmxvY2sgYXJvdW5kIHRoaXMgSUNVIHNvbWV3aGVyZS5cbiAgICAgICAgICAgIHhyZWYgPSBqb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSTE4bkNvbnRleHRPcChcbiAgICAgICAgICAgICAgICBpci5JMThuQ29udGV4dEtpbmQuSWN1LCB4cmVmLCBjdXJyZW50STE4bk9wLnhyZWYsIG9wLm1lc3NhZ2UsIG51bGwhKSk7XG4gICAgICAgICAgICBvcC5jb250ZXh0ID0geHJlZjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhlIGkxOG4gYmxvY2sgd2FzIGdlbmVyYXRlZCBiZWNhdXNlIG9mIHRoaXMgSUNVLCBPUiBpdCB3YXMgZXhwbGljaXQsIGJ1dCB0aGUgSUNVIGlzXG4gICAgICAgICAgICAvLyB0aGUgb25seSBsb2NhbGl6YWJsZSBjb250ZW50IGluc2lkZSBvZiBpdC5cbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSBjdXJyZW50STE4bk9wLmNvbnRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkJpbmRpbmc6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZTpcbiAgICAgICAgICBpZiAoIW9wLmkxOG5NZXNzYWdlKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFtZXNzYWdlVG9Db250ZXh0LmhhcyhvcC5pMThuTWVzc2FnZSkpIHtcbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgY29udGV4dFxuICAgICAgICAgICAgY29uc3QgaTE4bkNvbnRleHQgPSBqb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSTE4bkNvbnRleHRPcChcbiAgICAgICAgICAgICAgICBpci5JMThuQ29udGV4dEtpbmQuQXR0ciwgaTE4bkNvbnRleHQsIG51bGwsIG9wLmkxOG5NZXNzYWdlLCBudWxsISkpO1xuICAgICAgICAgICAgbWVzc2FnZVRvQ29udGV4dC5zZXQob3AuaTE4bk1lc3NhZ2UsIGkxOG5Db250ZXh0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBvcC5pMThuQ29udGV4dCA9IG1lc3NhZ2VUb0NvbnRleHQuZ2V0KG9wLmkxOG5NZXNzYWdlKSE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQXNzaWduIGNvbnRleHRzIHRvIGNoaWxkIGkxOG4gYmxvY2tzLCBub3cgdGhhdCBhbGwgcm9vdCBpMThuIGJsb2NrcyBoYXZlIHRoZWlyIGNvbnRleHRcbiAgLy8gYXNzaWduZWQuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCAmJiBvcC54cmVmICE9PSBvcC5yb290KSB7XG4gICAgICAgIG9wLmNvbnRleHQgPSByb290Q29udGV4dHMuZ2V0KG9wLnJvb3QpITtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==