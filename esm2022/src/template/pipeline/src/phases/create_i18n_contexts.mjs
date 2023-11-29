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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5fY29udGV4dHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGVfaTE4bl9jb250ZXh0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBbUI7SUFDcEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7SUFDckQsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztJQUM5QyxJQUFJLElBQWUsQ0FBQztJQUVwQixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUM7b0JBQ25CLHVGQUF1RjtvQkFDdkYsY0FBYztvQkFDZCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO3dCQUN4QixJQUFJLEdBQUcsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO3dCQUM1QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQ25DLEVBQUUsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsSUFBSyxDQUFDLENBQUMsQ0FBQzt3QkFDcEUsRUFBRSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7d0JBQ2xCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDbEMsQ0FBQztvQkFDRCxNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUNyQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO29CQUNyQix5RkFBeUY7b0JBQ3pGLGdCQUFnQjtvQkFDaEIsSUFBSSxhQUFhLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQzNCLE1BQU0sS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7b0JBQzFELENBQUM7b0JBQ0QsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxhQUFhLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUMvQywrREFBK0Q7d0JBQy9ELElBQUksR0FBRyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7d0JBQzVCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FDbkMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUMxRSxFQUFFLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztvQkFDcEIsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLHVGQUF1Rjt3QkFDdkYsNkNBQTZDO3dCQUM3QyxFQUFFLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7b0JBQ3JDLENBQUM7b0JBQ0QsTUFBTTtZQUNWLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELHlGQUF5RjtJQUN6RixZQUFZO0lBQ1osS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUMzRCxFQUFFLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxDQUFDO1lBQzFDLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIENyZWF0ZSBvbmUgaGVscGVyIGNvbnRleHQgb3AgcGVyIGkxOG4gYmxvY2sgKGluY2x1ZGluZyBnZW5lcmF0ZSBkZXNjZW5kaW5nIGJsb2NrcykuXG4gKlxuICogQWxzbywgaWYgYW4gSUNVIGV4aXN0cyBpbnNpZGUgYW4gaTE4biBibG9jayB0aGF0IGFsc28gY29udGFpbnMgb3RoZXIgbG9jYWxpemFibGUgY29udGVudCAoc3VjaCBhc1xuICogc3RyaW5nKSwgY3JlYXRlIGFuIGFkZGl0aW9uYWwgaGVscGVyIGNvbnRleHQgb3AgZm9yIHRoZSBJQ1UuXG4gKlxuICogVGhlc2UgY29udGV4dCBvcHMgYXJlIGxhdGVyIHVzZWQgZm9yIGdlbmVyYXRpbmcgaTE4biBtZXNzYWdlcy4gKEFsdGhvdWdoIHdlIGdlbmVyYXRlIGF0IGxlYXN0IG9uZVxuICogY29udGV4dCBvcCBwZXIgbmVzdGVkIHZpZXcsIHdlIHdpbGwgY29sbGVjdCB0aGVtIHVwIHRoZSB0cmVlIGxhdGVyLCB0byBnZW5lcmF0ZSBhIHRvcC1sZXZlbFxuICogbWVzc2FnZS4pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuQ29udGV4dHMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBjb25zdCByb290Q29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuWHJlZklkPigpO1xuICBsZXQgY3VycmVudEkxOG5PcDogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG4gIGxldCB4cmVmOiBpci5YcmVmSWQ7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG9wO1xuICAgICAgICAgIC8vIEVhY2ggcm9vdCBpMThuIGJsb2NrIGdldHMgaXRzIG93biBjb250ZXh0LCBjaGlsZCBvbmVzIHJlZmVyIHRvIHRoZSBjb250ZXh0IGZvciB0aGVpclxuICAgICAgICAgIC8vIHJvb3QgYmxvY2suXG4gICAgICAgICAgaWYgKG9wLnhyZWYgPT09IG9wLnJvb3QpIHtcbiAgICAgICAgICAgIHhyZWYgPSBqb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSTE4bkNvbnRleHRPcChcbiAgICAgICAgICAgICAgICBpci5JMThuQ29udGV4dEtpbmQuUm9vdEkxOG4sIHhyZWYsIG9wLnhyZWYsIG9wLm1lc3NhZ2UsIG51bGwhKSk7XG4gICAgICAgICAgICBvcC5jb250ZXh0ID0geHJlZjtcbiAgICAgICAgICAgIHJvb3RDb250ZXh0cy5zZXQob3AueHJlZiwgeHJlZik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VTdGFydDpcbiAgICAgICAgICAvLyBJZiBhbiBJQ1UgcmVwcmVzZW50cyBhIGRpZmZlcmVudCBtZXNzYWdlIHRoYW4gaXRzIGNvbnRhaW5pbmcgYmxvY2ssIHdlIGdpdmUgaXQgaXRzIG93blxuICAgICAgICAgIC8vIGkxOG4gY29udGV4dC5cbiAgICAgICAgICBpZiAoY3VycmVudEkxOG5PcCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgSUNVIG91dHNpZGUgb2YgYW4gaTE4biBibG9jay4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wLm1lc3NhZ2UuaWQgIT09IGN1cnJlbnRJMThuT3AubWVzc2FnZS5pZCkge1xuICAgICAgICAgICAgLy8gVGhlcmUgd2FzIGFuIGVuY2xvc2luZyBpMThuIGJsb2NrIGFyb3VuZCB0aGlzIElDVSBzb21ld2hlcmUuXG4gICAgICAgICAgICB4cmVmID0gam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUkxOG5Db250ZXh0T3AoXG4gICAgICAgICAgICAgICAgaXIuSTE4bkNvbnRleHRLaW5kLkljdSwgeHJlZiwgY3VycmVudEkxOG5PcC54cmVmLCBvcC5tZXNzYWdlLCBudWxsISkpO1xuICAgICAgICAgICAgb3AuY29udGV4dCA9IHhyZWY7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoZSBpMThuIGJsb2NrIHdhcyBnZW5lcmF0ZWQgYmVjYXVzZSBvZiB0aGlzIElDVSwgT1IgaXQgd2FzIGV4cGxpY2l0LCBidXQgdGhlIElDVSBpc1xuICAgICAgICAgICAgLy8gdGhlIG9ubHkgbG9jYWxpemFibGUgY29udGVudCBpbnNpZGUgb2YgaXQuXG4gICAgICAgICAgICBvcC5jb250ZXh0ID0gY3VycmVudEkxOG5PcC5jb250ZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBc3NpZ24gY29udGV4dHMgdG8gY2hpbGQgaTE4biBibG9ja3MsIG5vdyB0aGF0IGFsbCByb290IGkxOG4gYmxvY2tzIGhhdmUgdGhlaXIgY29udGV4dFxuICAvLyBhc3NpZ25lZC5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0ICYmIG9wLnhyZWYgIT09IG9wLnJvb3QpIHtcbiAgICAgICAgb3AuY29udGV4dCA9IHJvb3RDb250ZXh0cy5nZXQob3Aucm9vdCkhO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19