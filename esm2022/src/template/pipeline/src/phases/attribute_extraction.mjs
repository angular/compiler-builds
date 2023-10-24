/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { CompilationJobKind } from '../compilation';
import { createOpXrefMap } from '../util/elements';
/**
 * Find all extractable attribute and binding ops, and create ExtractedAttributeOps for them.
 * In cases where no instruction needs to be generated for the attribute or binding, it is removed.
 */
export function phaseAttributeExtraction(job) {
    for (const unit of job.units) {
        const elements = createOpXrefMap(unit);
        for (const op of unit.ops()) {
            switch (op.kind) {
                case ir.OpKind.Attribute:
                    extractAttributeOp(unit, op, elements);
                    break;
                case ir.OpKind.Property:
                    if (!op.isAnimationTrigger) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, op.isTemplate ? ir.BindingKind.Template : ir.BindingKind.Property, op.name, null), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.StyleProp:
                case ir.OpKind.ClassProp:
                    // The old compiler treated empty style bindings as regular bindings for the purpose of
                    // directive matching. That behavior is incorrect, but we emulate it in compatibility
                    // mode.
                    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
                        op.expression instanceof ir.EmptyExpr) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, op.name, null), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.Listener:
                    if (!op.isAnimationListener) {
                        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, op.name, null);
                        if (job.kind === CompilationJobKind.Host) {
                            // This attribute will apply to the enclosing host binding compilation unit, so order
                            // doesn't matter.
                            unit.create.push(extractedAttributeOp);
                        }
                        else {
                            ir.OpList.insertBefore(extractedAttributeOp, lookupElement(elements, op.target));
                        }
                    }
                    break;
            }
        }
    }
}
/**
 * Looks up an element in the given map by xref ID.
 */
function lookupElement(elements, xref) {
    const el = elements.get(xref);
    if (el === undefined) {
        throw new Error('All attributes should have an element-like target.');
    }
    return el;
}
/**
 * Extracts an attribute binding.
 */
function extractAttributeOp(unit, op, elements) {
    if (op.expression instanceof ir.Interpolation) {
        return;
    }
    let extractable = op.expression.isConstant();
    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder) {
        // TemplateDefinitionBuilder only extracted attributes that were string literals.
        extractable = ir.isStringLiteral(op.expression);
        if (op.name === 'style' || op.name === 'class') {
            // For style and class attributes, TemplateDefinitionBuilder only extracted them if they were
            // text attributes. For example, `[attr.class]="'my-class'"` was not extracted despite being a
            // string literal, because it is not a text attribute.
            extractable &&= op.isTextAttribute;
        }
        if (unit.job.kind === CompilationJobKind.Host) {
            // TemplateDefinitionBuilder also does not seem to extract string literals if they are part of
            // a host attribute.
            extractable &&= op.isTextAttribute;
        }
    }
    if (extractable) {
        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, op.isTemplate ? ir.BindingKind.Template : ir.BindingKind.Attribute, op.name, op.expression);
        if (unit.job.kind === CompilationJobKind.Host) {
            // This attribute will apply to the enclosing host binding compilation unit, so order doesn't
            // matter.
            unit.create.push(extractedAttributeOp);
        }
        else {
            const ownerOp = lookupElement(elements, op.target);
            ir.OpList.insertBefore(extractedAttributeOp, ownerOp);
        }
        ir.OpList.remove(op);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQTRDLGtCQUFrQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0YsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRWpEOzs7R0FHRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUFtQjtJQUMxRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsa0JBQWtCLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDdkMsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtvQkFDckIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRTt3QkFDMUIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQ2xCLEVBQUUsQ0FBQywwQkFBMEIsQ0FDekIsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFD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R0FBRyxDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUU7WUFDN0MsOEZBQThGO1lBQzlGLG9CQUFvQjtZQUNwQixXQUFXLEtBQUssRUFBRSxDQUFDLGVBQWUsQ0FBQztTQUNwQztLQUNGO0lBRUQsSUFBSSxXQUFXLEVBQUU7UUFDZixNQUFNLG9CQUFvQixHQUFHLEVBQUUsQ0FBQywwQkFBMEIsQ0FDdEQsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksRUFDdEYsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25CLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssa0JBQWtCLENBQUMsSUFBSSxFQUFFO1lBQzdDLDZGQUE2RjtZQUM3RixVQUFVO1lBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUN4QzthQUFNO1lBQ0wsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkQsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQWMsb0JBQW9CLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDcEU7UUFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztLQUNuQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge3R5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Vbml0LCBDb21waWxhdGlvbkpvYktpbmR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7Y3JlYXRlT3BYcmVmTWFwfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBGaW5kIGFsbCBleHRyYWN0YWJsZSBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY3JlYXRlIEV4dHJhY3RlZEF0dHJpYnV0ZU9wcyBmb3IgdGhlbS5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9uKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gY3JlYXRlT3BYcmVmTWFwKHVuaXQpO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgICBleHRyYWN0QXR0cmlidXRlT3AodW5pdCwgb3AsIGVsZW1lbnRzKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgICAgaWYgKCFvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIG9wLmlzVGVtcGxhdGUgPyBpci5CaW5kaW5nS2luZC5UZW1wbGF0ZSA6IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICBvcC5uYW1lLCBudWxsKSxcbiAgICAgICAgICAgICAgICBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgdHJlYXRlZCBlbXB0eSBzdHlsZSBiaW5kaW5ncyBhcyByZWd1bGFyIGJpbmRpbmdzIGZvciB0aGUgcHVycG9zZSBvZlxuICAgICAgICAgIC8vIGRpcmVjdGl2ZSBtYXRjaGluZy4gVGhhdCBiZWhhdmlvciBpcyBpbmNvcnJlY3QsIGJ1dCB3ZSBlbXVsYXRlIGl0IGluIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAvLyBtb2RlLlxuICAgICAgICAgIGlmICh1bml0LmpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyICYmXG4gICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5FbXB0eUV4cHIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG9wLm5hbWUsIG51bGwpLFxuICAgICAgICAgICAgICAgIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgICAgaWYgKCFvcC5pc0FuaW1hdGlvbkxpc3RlbmVyKSB7XG4gICAgICAgICAgICBjb25zdCBleHRyYWN0ZWRBdHRyaWJ1dGVPcCA9XG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3Aob3AudGFyZ2V0LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgb3AubmFtZSwgbnVsbCk7XG4gICAgICAgICAgICBpZiAoam9iLmtpbmQgPT09IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KSB7XG4gICAgICAgICAgICAgIC8vIFRoaXMgYXR0cmlidXRlIHdpbGwgYXBwbHkgdG8gdGhlIGVuY2xvc2luZyBob3N0IGJpbmRpbmcgY29tcGlsYXRpb24gdW5pdCwgc28gb3JkZXJcbiAgICAgICAgICAgICAgLy8gZG9lc24ndCBtYXR0ZXIuXG4gICAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goZXh0cmFjdGVkQXR0cmlidXRlT3ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgICBleHRyYWN0ZWRBdHRyaWJ1dGVPcCwgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIExvb2tzIHVwIGFuIGVsZW1lbnQgaW4gdGhlIGdpdmVuIG1hcCBieSB4cmVmIElELlxuICovXG5mdW5jdGlvbiBsb29rdXBFbGVtZW50KFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPixcbiAgICB4cmVmOiBpci5YcmVmSWQpOiBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgZWwgPSBlbGVtZW50cy5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2UgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0cyBhbiBhdHRyaWJ1dGUgYmluZGluZy5cbiAqL1xuZnVuY3Rpb24gZXh0cmFjdEF0dHJpYnV0ZU9wKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkF0dHJpYnV0ZU9wLFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPikge1xuICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgZXh0cmFjdGFibGUgPSBvcC5leHByZXNzaW9uLmlzQ29uc3RhbnQoKTtcbiAgaWYgKHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpIHtcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIG9ubHkgZXh0cmFjdGVkIGF0dHJpYnV0ZXMgdGhhdCB3ZXJlIHN0cmluZyBsaXRlcmFscy5cbiAgICBleHRyYWN0YWJsZSA9IGlyLmlzU3RyaW5nTGl0ZXJhbChvcC5leHByZXNzaW9uKTtcbiAgICBpZiAob3AubmFtZSA9PT0gJ3N0eWxlJyB8fCBvcC5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAvLyBGb3Igc3R5bGUgYW5kIGNsYXNzIGF0dHJpYnV0ZXMsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb25seSBleHRyYWN0ZWQgdGhlbSBpZiB0aGV5IHdlcmVcbiAgICAgIC8vIHRleHQgYXR0cmlidXRlcy4gRm9yIGV4YW1wbGUsIGBbYXR0ci5jbGFzc109XCInbXktY2xhc3MnXCJgIHdhcyBub3QgZXh0cmFjdGVkIGRlc3BpdGUgYmVpbmcgYVxuICAgICAgLy8gc3RyaW5nIGxpdGVyYWwsIGJlY2F1c2UgaXQgaXMgbm90IGEgdGV4dCBhdHRyaWJ1dGUuXG4gICAgICBleHRyYWN0YWJsZSAmJj0gb3AuaXNUZXh0QXR0cmlidXRlO1xuICAgIH1cbiAgICBpZiAodW5pdC5qb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgYWxzbyBkb2VzIG5vdCBzZWVtIHRvIGV4dHJhY3Qgc3RyaW5nIGxpdGVyYWxzIGlmIHRoZXkgYXJlIHBhcnQgb2ZcbiAgICAgIC8vIGEgaG9zdCBhdHRyaWJ1dGUuXG4gICAgICBleHRyYWN0YWJsZSAmJj0gb3AuaXNUZXh0QXR0cmlidXRlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChleHRyYWN0YWJsZSkge1xuICAgIGNvbnN0IGV4dHJhY3RlZEF0dHJpYnV0ZU9wID0gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgIG9wLnRhcmdldCwgb3AuaXNUZW1wbGF0ZSA/IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlIDogaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBvcC5uYW1lLFxuICAgICAgICBvcC5leHByZXNzaW9uKTtcbiAgICBpZiAodW5pdC5qb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgIC8vIFRoaXMgYXR0cmlidXRlIHdpbGwgYXBwbHkgdG8gdGhlIGVuY2xvc2luZyBob3N0IGJpbmRpbmcgY29tcGlsYXRpb24gdW5pdCwgc28gb3JkZXIgZG9lc24ndFxuICAgICAgLy8gbWF0dGVyLlxuICAgICAgdW5pdC5jcmVhdGUucHVzaChleHRyYWN0ZWRBdHRyaWJ1dGVPcCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oZXh0cmFjdGVkQXR0cmlidXRlT3AsIG93bmVyT3ApO1xuICAgIH1cbiAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gIH1cbn1cbiJdfQ==