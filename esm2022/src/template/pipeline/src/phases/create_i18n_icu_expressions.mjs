/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Replace the ICU update ops with i18n expression ops.
 */
export function createI18nIcuExpressions(job) {
    const icus = new Map();
    const i18nContexts = new Map();
    const i18nBlocks = new Map();
    // Collect maps of ops that need to be referenced to create the I18nExpressionOps.
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.Icu:
                    icus.set(op.xref, op);
                    break;
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
                case ir.OpKind.I18nStart:
                    i18nBlocks.set(op.xref, op);
                    break;
            }
        }
        // Replace each IcuUpdateOp with an I18nExpressionOp.
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.IcuUpdate:
                    const icuOp = icus.get(op.xref);
                    if (icuOp?.icu.expressionPlaceholder === undefined) {
                        throw Error('ICU should have an i18n placeholder');
                    }
                    if (icuOp.context === null) {
                        throw Error('ICU should have its i18n context set');
                    }
                    const i18nContext = i18nContexts.get(icuOp.context);
                    const i18nBlock = i18nBlocks.get(i18nContext.i18nBlock);
                    ir.OpList.replace(op, ir.createI18nExpressionOp(i18nContext.xref, i18nBlock.xref, i18nBlock.handle, new ir.LexicalReadExpr(icuOp.icu.expression), icuOp.icu.expressionPlaceholder, 
                    // ICU-based i18n Expressions are resolved during post-processing.
                    ir.I18nParamResolutionTime.Postproccessing, null));
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5faWN1X2V4cHJlc3Npb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY3JlYXRlX2kxOG5faWN1X2V4cHJlc3Npb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEdBQW1CO0lBQzFELE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO0lBQzVDLE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDO0lBRXhELGtGQUFrRjtJQUNsRixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRztvQkFDaEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUN0QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXO29CQUN4QixZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzlCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDNUIsTUFBTTthQUNUO1NBQ0Y7UUFFRCxxREFBcUQ7UUFDckQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2hDLElBQUksS0FBSyxFQUFFLEdBQUcsQ0FBQyxxQkFBcUIsS0FBSyxTQUFTLEVBQUU7d0JBQ2xELE1BQU0sS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7cUJBQ3BEO29CQUNELElBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxJQUFJLEVBQUU7d0JBQzFCLE1BQU0sS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7cUJBQ3JEO29CQUNELE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBRSxDQUFDO29CQUNyRCxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUUsQ0FBQztvQkFDekQsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQ2IsRUFBRSxFQUNGLEVBQUUsQ0FBQyxzQkFBc0IsQ0FDckIsV0FBVyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQ2xELElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMscUJBQXFCO29CQUM3RSxrRUFBa0U7b0JBQ2xFLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLEVBQUUsSUFBSyxDQUFDLENBQUMsQ0FBQztvQkFDNUQsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlcGxhY2UgdGhlIElDVSB1cGRhdGUgb3BzIHdpdGggaTE4biBleHByZXNzaW9uIG9wcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUkxOG5JY3VFeHByZXNzaW9ucyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGNvbnN0IGljdXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSWN1T3A+KCk7XG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBjb25zdCBpMThuQmxvY2tzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPigpO1xuXG4gIC8vIENvbGxlY3QgbWFwcyBvZiBvcHMgdGhhdCBuZWVkIHRvIGJlIHJlZmVyZW5jZWQgdG8gY3JlYXRlIHRoZSBJMThuRXhwcmVzc2lvbk9wcy5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3U6XG4gICAgICAgICAgaWN1cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGkxOG5CbG9ja3Muc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXBsYWNlIGVhY2ggSWN1VXBkYXRlT3Agd2l0aCBhbiBJMThuRXhwcmVzc2lvbk9wLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VVcGRhdGU6XG4gICAgICAgICAgY29uc3QgaWN1T3AgPSBpY3VzLmdldChvcC54cmVmKTtcbiAgICAgICAgICBpZiAoaWN1T3A/LmljdS5leHByZXNzaW9uUGxhY2Vob2xkZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0lDVSBzaG91bGQgaGF2ZSBhbiBpMThuIHBsYWNlaG9sZGVyJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpY3VPcC5jb250ZXh0ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignSUNVIHNob3VsZCBoYXZlIGl0cyBpMThuIGNvbnRleHQgc2V0Jyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGkxOG5Db250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChpY3VPcC5jb250ZXh0KSE7XG4gICAgICAgICAgY29uc3QgaTE4bkJsb2NrID0gaTE4bkJsb2Nrcy5nZXQoaTE4bkNvbnRleHQuaTE4bkJsb2NrKSE7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2U8aXIuVXBkYXRlT3A+KFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgaXIuY3JlYXRlSTE4bkV4cHJlc3Npb25PcChcbiAgICAgICAgICAgICAgICAgIGkxOG5Db250ZXh0LnhyZWYsIGkxOG5CbG9jay54cmVmLCBpMThuQmxvY2suaGFuZGxlLFxuICAgICAgICAgICAgICAgICAgbmV3IGlyLkxleGljYWxSZWFkRXhwcihpY3VPcC5pY3UuZXhwcmVzc2lvbiksIGljdU9wLmljdS5leHByZXNzaW9uUGxhY2Vob2xkZXIsXG4gICAgICAgICAgICAgICAgICAvLyBJQ1UtYmFzZWQgaTE4biBFeHByZXNzaW9ucyBhcmUgcmVzb2x2ZWQgZHVyaW5nIHBvc3QtcHJvY2Vzc2luZy5cbiAgICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLlBvc3Rwcm9jY2Vzc2luZywgbnVsbCEpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==