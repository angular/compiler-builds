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
    let currentI18nOp = null;
    let xref;
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    // Each i18n block gets its own context.
                    xref = job.allocateXrefId();
                    unit.create.push(ir.createI18nContextOp(xref, op.xref, op.message, null));
                    op.context = xref;
                    currentI18nOp = op;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nOp = null;
                    break;
                case ir.OpKind.Icu:
                    // If an ICU represents a different message than its containing block, we give it its own
                    // i18n context.
                    if (currentI18nOp === null) {
                        throw Error('Unexpected ICU outside of an i18n block.');
                    }
                    if (op.message.id !== currentI18nOp.message.id) {
                        // There was an enclosing i18n block around this ICU somewhere.
                        xref = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(xref, currentI18nOp.xref, op.message, null));
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
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5fY29udGV4dHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGVfaTE4bl9jb250ZXh0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBbUI7SUFDcEQsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztJQUM5QyxJQUFJLElBQWUsQ0FBQztJQUNwQixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsd0NBQXdDO29CQUN4QyxJQUFJLEdBQUcsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO29CQUM1QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFLLENBQUMsQ0FBQyxDQUFDO29CQUMzRSxFQUFFLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztvQkFDbEIsYUFBYSxHQUFHLEVBQUUsQ0FBQztvQkFDbkIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTztvQkFDcEIsYUFBYSxHQUFHLElBQUksQ0FBQztvQkFDckIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRztvQkFDaEIseUZBQXlGO29CQUN6RixnQkFBZ0I7b0JBQ2hCLElBQUksYUFBYSxLQUFLLElBQUksRUFBRTt3QkFDMUIsTUFBTSxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQztxQkFDekQ7b0JBQ0QsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxhQUFhLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTt3QkFDOUMsK0RBQStEO3dCQUMvRCxJQUFJLEdBQUcsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO3dCQUM1QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUN0RixFQUFFLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztxQkFDbkI7eUJBQU07d0JBQ0wsdUZBQXVGO3dCQUN2Riw2Q0FBNkM7d0JBQzdDLEVBQUUsQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztxQkFDcEM7b0JBQ0QsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIENyZWF0ZSBvbmUgaGVscGVyIGNvbnRleHQgb3AgcGVyIGkxOG4gYmxvY2sgKGluY2x1ZGluZyBnZW5lcmF0ZSBkZXNjZW5kaW5nIGJsb2NrcykuXG4gKlxuICogQWxzbywgaWYgYW4gSUNVIGV4aXN0cyBpbnNpZGUgYW4gaTE4biBibG9jayB0aGF0IGFsc28gY29udGFpbnMgb3RoZXIgbG9jYWxpemFibGUgY29udGVudCAoc3VjaCBhc1xuICogc3RyaW5nKSwgY3JlYXRlIGFuIGFkZGl0aW9uYWwgaGVscGVyIGNvbnRleHQgb3AgZm9yIHRoZSBJQ1UuXG4gKlxuICogVGhlc2UgY29udGV4dCBvcHMgYXJlIGxhdGVyIHVzZWQgZm9yIGdlbmVyYXRpbmcgaTE4biBtZXNzYWdlcy4gKEFsdGhvdWdoIHdlIGdlbmVyYXRlIGF0IGxlYXN0IG9uZVxuICogY29udGV4dCBvcCBwZXIgbmVzdGVkIHZpZXcsIHdlIHdpbGwgY29sbGVjdCB0aGVtIHVwIHRoZSB0cmVlIGxhdGVyLCB0byBnZW5lcmF0ZSBhIHRvcC1sZXZlbFxuICogbWVzc2FnZS4pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuQ29udGV4dHMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBsZXQgY3VycmVudEkxOG5PcDogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG4gIGxldCB4cmVmOiBpci5YcmVmSWQ7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIC8vIEVhY2ggaTE4biBibG9jayBnZXRzIGl0cyBvd24gY29udGV4dC5cbiAgICAgICAgICB4cmVmID0gam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuQ29udGV4dE9wKHhyZWYsIG9wLnhyZWYsIG9wLm1lc3NhZ2UsIG51bGwhKSk7XG4gICAgICAgICAgb3AuY29udGV4dCA9IHhyZWY7XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG9wO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3U6XG4gICAgICAgICAgLy8gSWYgYW4gSUNVIHJlcHJlc2VudHMgYSBkaWZmZXJlbnQgbWVzc2FnZSB0aGFuIGl0cyBjb250YWluaW5nIGJsb2NrLCB3ZSBnaXZlIGl0IGl0cyBvd25cbiAgICAgICAgICAvLyBpMThuIGNvbnRleHQuXG4gICAgICAgICAgaWYgKGN1cnJlbnRJMThuT3AgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdVbmV4cGVjdGVkIElDVSBvdXRzaWRlIG9mIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcC5tZXNzYWdlLmlkICE9PSBjdXJyZW50STE4bk9wLm1lc3NhZ2UuaWQpIHtcbiAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhbiBlbmNsb3NpbmcgaTE4biBibG9jayBhcm91bmQgdGhpcyBJQ1Ugc29tZXdoZXJlLlxuICAgICAgICAgICAgeHJlZiA9IGpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuQ29udGV4dE9wKHhyZWYsIGN1cnJlbnRJMThuT3AueHJlZiwgb3AubWVzc2FnZSwgbnVsbCEpKTtcbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSB4cmVmO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGUgaTE4biBibG9jayB3YXMgZ2VuZXJhdGVkIGJlY2F1c2Ugb2YgdGhpcyBJQ1UsIE9SIGl0IHdhcyBleHBsaWNpdCwgYnV0IHRoZSBJQ1UgaXNcbiAgICAgICAgICAgIC8vIHRoZSBvbmx5IGxvY2FsaXphYmxlIGNvbnRlbnQgaW5zaWRlIG9mIGl0LlxuICAgICAgICAgICAgb3AuY29udGV4dCA9IGN1cnJlbnRJMThuT3AuY29udGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=