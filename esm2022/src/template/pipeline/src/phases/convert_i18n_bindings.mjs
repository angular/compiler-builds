/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Some binding instructions in the update block may actually correspond to i18n bindings. In that
 * case, they should be replaced with i18nExp instructions for the dynamic portions.
 */
export function convertI18nBindings(job) {
    const i18nAttributesByElem = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nAttributes) {
                i18nAttributesByElem.set(op.target, op);
            }
        }
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                    if (op.i18nContext === null) {
                        continue;
                    }
                    if (!(op.expression instanceof ir.Interpolation)) {
                        continue;
                    }
                    const i18nAttributesForElem = i18nAttributesByElem.get(op.target);
                    if (i18nAttributesForElem === undefined) {
                        throw new Error('AssertionError: An i18n attribute binding instruction requires the owning element to have an I18nAttributes create instruction');
                    }
                    if (i18nAttributesForElem.target !== op.target) {
                        throw new Error('AssertionError: Expected i18nAttributes target element to match binding target element');
                    }
                    const ops = [];
                    for (let i = 0; i < op.expression.expressions.length; i++) {
                        const expr = op.expression.expressions[i];
                        if (op.expression.i18nPlaceholders.length !== op.expression.expressions.length) {
                            throw new Error(`AssertionError: An i18n attribute binding instruction requires the same number of expressions and placeholders, but found ${op.expression.i18nPlaceholders.length} placeholders and ${op.expression.expressions.length} expressions`);
                        }
                        ops.push(ir.createI18nExpressionOp(op.i18nContext, i18nAttributesForElem.target, i18nAttributesForElem.handle, expr, op.expression.i18nPlaceholders[i], ir.I18nParamResolutionTime.Creation, ir.I18nExpressionContext.Binding, op.name, op.sourceSpan));
                    }
                    ir.OpList.replaceWithMany(op, ops);
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udmVydF9pMThuX2JpbmRpbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY29udmVydF9pMThuX2JpbmRpbmdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFtQjtJQUNyRCxNQUFNLG9CQUFvQixHQUF3QyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQzVFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO2dCQUN4QyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQzthQUN6QztTQUNGO1FBRUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO2dCQUN4QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLElBQUksRUFBRTt3QkFDM0IsU0FBUztxQkFDVjtvQkFFRCxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxZQUFZLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRTt3QkFDaEQsU0FBUztxQkFDVjtvQkFFRCxNQUFNLHFCQUFxQixHQUFHLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ2xFLElBQUkscUJBQXFCLEtBQUssU0FBUyxFQUFFO3dCQUN2QyxNQUFNLElBQUksS0FBSyxDQUNYLGdJQUFnSSxDQUFDLENBQUM7cUJBQ3ZJO29CQUVELElBQUkscUJBQXFCLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxNQUFNLEVBQUU7d0JBQzlDLE1BQU0sSUFBSSxLQUFLLENBQ1gsd0ZBQXdGLENBQUMsQ0FBQztxQkFDL0Y7b0JBRUQsTUFBTSxHQUFHLEdBQWtCLEVBQUUsQ0FBQztvQkFDOUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDekQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBRTFDLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFOzRCQUM5RSxNQUFNLElBQUksS0FBSyxDQUNYLDZIQUNJLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxxQkFDckMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsTUFBTSxjQUFjLENBQUMsQ0FBQzt5QkFDekQ7d0JBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQzlCLEVBQUUsQ0FBQyxXQUFXLEVBQUUscUJBQXFCLENBQUMsTUFBTSxFQUFFLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQ2hGLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFDdEUsRUFBRSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3FCQUNoRTtvQkFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFpQixFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUNsRCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogU29tZSBiaW5kaW5nIGluc3RydWN0aW9ucyBpbiB0aGUgdXBkYXRlIGJsb2NrIG1heSBhY3R1YWxseSBjb3JyZXNwb25kIHRvIGkxOG4gYmluZGluZ3MuIEluIHRoYXRcbiAqIGNhc2UsIHRoZXkgc2hvdWxkIGJlIHJlcGxhY2VkIHdpdGggaTE4bkV4cCBpbnN0cnVjdGlvbnMgZm9yIHRoZSBkeW5hbWljIHBvcnRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEkxOG5CaW5kaW5ncyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGNvbnN0IGkxOG5BdHRyaWJ1dGVzQnlFbGVtOiBNYXA8aXIuWHJlZklkLCBpci5JMThuQXR0cmlidXRlc09wPiA9IG5ldyBNYXAoKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkF0dHJpYnV0ZXMpIHtcbiAgICAgICAgaTE4bkF0dHJpYnV0ZXNCeUVsZW0uc2V0KG9wLnRhcmdldCwgb3ApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICAgIGlmIChvcC5pMThuQ29udGV4dCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCEob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpMThuQXR0cmlidXRlc0ZvckVsZW0gPSBpMThuQXR0cmlidXRlc0J5RWxlbS5nZXQob3AudGFyZ2V0KTtcbiAgICAgICAgICBpZiAoaTE4bkF0dHJpYnV0ZXNGb3JFbGVtID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IEFuIGkxOG4gYXR0cmlidXRlIGJpbmRpbmcgaW5zdHJ1Y3Rpb24gcmVxdWlyZXMgdGhlIG93bmluZyBlbGVtZW50IHRvIGhhdmUgYW4gSTE4bkF0dHJpYnV0ZXMgY3JlYXRlIGluc3RydWN0aW9uJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGkxOG5BdHRyaWJ1dGVzRm9yRWxlbS50YXJnZXQgIT09IG9wLnRhcmdldCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICdBc3NlcnRpb25FcnJvcjogRXhwZWN0ZWQgaTE4bkF0dHJpYnV0ZXMgdGFyZ2V0IGVsZW1lbnQgdG8gbWF0Y2ggYmluZGluZyB0YXJnZXQgZWxlbWVudCcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG9wczogaXIuVXBkYXRlT3BbXSA9IFtdO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXhwciA9IG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnNbaV07XG5cbiAgICAgICAgICAgIGlmIChvcC5leHByZXNzaW9uLmkxOG5QbGFjZWhvbGRlcnMubGVuZ3RoICE9PSBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IEFuIGkxOG4gYXR0cmlidXRlIGJpbmRpbmcgaW5zdHJ1Y3Rpb24gcmVxdWlyZXMgdGhlIHNhbWUgbnVtYmVyIG9mIGV4cHJlc3Npb25zIGFuZCBwbGFjZWhvbGRlcnMsIGJ1dCBmb3VuZCAke1xuICAgICAgICAgICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24uaTE4blBsYWNlaG9sZGVycy5sZW5ndGh9IHBsYWNlaG9sZGVycyBhbmQgJHtcbiAgICAgICAgICAgICAgICAgICAgICBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aH0gZXhwcmVzc2lvbnNgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3BzLnB1c2goaXIuY3JlYXRlSTE4bkV4cHJlc3Npb25PcChcbiAgICAgICAgICAgICAgICBvcC5pMThuQ29udGV4dCwgaTE4bkF0dHJpYnV0ZXNGb3JFbGVtLnRhcmdldCwgaTE4bkF0dHJpYnV0ZXNGb3JFbGVtLmhhbmRsZSwgZXhwcixcbiAgICAgICAgICAgICAgICBvcC5leHByZXNzaW9uLmkxOG5QbGFjZWhvbGRlcnNbaV0sIGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLkNyZWF0aW9uLFxuICAgICAgICAgICAgICAgIGlyLkkxOG5FeHByZXNzaW9uQ29udGV4dC5CaW5kaW5nLCBvcC5uYW1lLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlV2l0aE1hbnkob3AgYXMgaXIuVXBkYXRlT3AsIG9wcyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=