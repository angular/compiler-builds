/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../../core';
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * Parses string representation of a style and converts it into object literal.
 *
 * @param value string representation of style as used in the `style` attribute in HTML.
 *   Example: `color: red; height: auto`.
 * @returns An array of style property name and value pairs, e.g. `['color', 'red', 'height',
 * 'auto']`
 */
export function parse(value) {
    // we use a string array here instead of a string map
    // because a string-map is not guaranteed to retain the
    // order of the entries whereas a string array can be
    // constructed in a [key, value, key, value] format.
    const styles = [];
    let i = 0;
    let parenDepth = 0;
    let quote = 0 /* Char.QuoteNone */;
    let valueStart = 0;
    let propStart = 0;
    let currentProp = null;
    while (i < value.length) {
        const token = value.charCodeAt(i++);
        switch (token) {
            case 40 /* Char.OpenParen */:
                parenDepth++;
                break;
            case 41 /* Char.CloseParen */:
                parenDepth--;
                break;
            case 39 /* Char.QuoteSingle */:
                // valueStart needs to be there since prop values don't
                // have quotes in CSS
                if (quote === 0 /* Char.QuoteNone */) {
                    quote = 39 /* Char.QuoteSingle */;
                }
                else if (quote === 39 /* Char.QuoteSingle */ && value.charCodeAt(i - 1) !== 92 /* Char.BackSlash */) {
                    quote = 0 /* Char.QuoteNone */;
                }
                break;
            case 34 /* Char.QuoteDouble */:
                // same logic as above
                if (quote === 0 /* Char.QuoteNone */) {
                    quote = 34 /* Char.QuoteDouble */;
                }
                else if (quote === 34 /* Char.QuoteDouble */ && value.charCodeAt(i - 1) !== 92 /* Char.BackSlash */) {
                    quote = 0 /* Char.QuoteNone */;
                }
                break;
            case 58 /* Char.Colon */:
                if (!currentProp && parenDepth === 0 && quote === 0 /* Char.QuoteNone */) {
                    // TODO: Do not hyphenate CSS custom property names like: `--intentionallyCamelCase`
                    currentProp = hyphenate(value.substring(propStart, i - 1).trim());
                    valueStart = i;
                }
                break;
            case 59 /* Char.Semicolon */:
                if (currentProp && valueStart > 0 && parenDepth === 0 && quote === 0 /* Char.QuoteNone */) {
                    const styleVal = value.substring(valueStart, i - 1).trim();
                    styles.push(currentProp, styleVal);
                    propStart = i;
                    valueStart = 0;
                    currentProp = null;
                }
                break;
        }
    }
    if (currentProp && valueStart) {
        const styleVal = value.slice(valueStart).trim();
        styles.push(currentProp, styleVal);
    }
    return styles;
}
export function hyphenate(value) {
    return value
        .replace(/[a-z][A-Z]/g, v => {
        return v.charAt(0) + '-' + v.charAt(1);
    })
        .toLowerCase();
}
/**
 * Parses extracted style and class attributes into separate ExtractedAttributeOps per style or
 * class property.
 */
export function parseExtractedStyles(job) {
    const elements = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (ir.isElementOrContainerOp(op)) {
                elements.set(op.xref, op);
            }
        }
    }
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedAttribute && op.bindingKind === ir.BindingKind.Attribute &&
                ir.isStringLiteral(op.expression)) {
                const target = elements.get(op.target);
                if (target !== undefined && target.kind === ir.OpKind.Template &&
                    target.templateKind === ir.TemplateKind.Structural) {
                    // TemplateDefinitionBuilder will not apply class and style bindings to structural
                    // directives; instead, it will leave them as attributes.
                    // (It's not clear what that would mean, anyway -- classes and styles on a structural
                    // element should probably be a parse error.)
                    // TODO: We may be able to remove this once Template Pipeline is the default.
                    continue;
                }
                if (op.name === 'style') {
                    const parsedStyles = parse(op.expression.value);
                    for (let i = 0; i < parsedStyles.length - 1; i += 2) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.StyleProperty, null, parsedStyles[i], o.literal(parsedStyles[i + 1]), null, null, SecurityContext.STYLE), op);
                    }
                    ir.OpList.remove(op);
                }
                else if (op.name === 'class') {
                    const parsedClasses = op.expression.value.trim().split(/\s+/g);
                    for (const parsedClass of parsedClasses) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.ClassName, null, parsedClass, null, null, null, SecurityContext.NONE), op);
                    }
                    ir.OpList.remove(op);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VfZXh0cmFjdGVkX3N0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BhcnNlX2V4dHJhY3RlZF9zdHlsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFtQi9COzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsS0FBSyxDQUFDLEtBQWE7SUFDakMscURBQXFEO0lBQ3JELHVEQUF1RDtJQUN2RCxxREFBcUQ7SUFDckQsb0RBQW9EO0lBQ3BELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUU1QixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDVixJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDbkIsSUFBSSxLQUFLLHlCQUF1QixDQUFDO0lBQ2pDLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNuQixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDbEIsSUFBSSxXQUFXLEdBQWdCLElBQUksQ0FBQztJQUNwQyxPQUFPLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDeEIsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBUyxDQUFDO1FBQzVDLFFBQVEsS0FBSyxFQUFFLENBQUM7WUFDZDtnQkFDRSxVQUFVLEVBQUUsQ0FBQztnQkFDYixNQUFNO1lBQ1I7Z0JBQ0UsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsTUFBTTtZQUNSO2dCQUNFLHVEQUF1RDtnQkFDdkQscUJBQXFCO2dCQUNyQixJ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LE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQ3RFLEVBQUUsQ0FBQyxDQUFDO29CQUNWLENBQUM7b0JBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7cUJBQU0sSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO29CQUMvQixNQUFNLGFBQWEsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQy9ELEtBQUssTUFBTSxXQUFXLElBQUksYUFBYSxFQUFFLENBQUM7d0JBQ3hDLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsMEJBQTBCLENBQ3pCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDeEUsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUN6QixFQUFFLENBQUMsQ0FBQztvQkFDVixDQUFDO29CQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cblxuLy8gQW55IGNoYW5nZXMgaGVyZSBzaG91bGQgYmUgcG9ydGVkIHRvIHRoZSBBbmd1bGFyIERvbWlubyBmb3JrLlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvZG9taW5vL2Jsb2IvbWFpbi9saWIvc3R5bGVfcGFyc2VyLmpzXG5cbmNvbnN0IGVudW0gQ2hhciB7XG4gIE9wZW5QYXJlbiA9IDQwLFxuICBDbG9zZVBhcmVuID0gNDEsXG4gIENvbG9uID0gNTgsXG4gIFNlbWljb2xvbiA9IDU5LFxuICBCYWNrU2xhc2ggPSA5MixcbiAgUXVvdGVOb25lID0gMCwgIC8vIGluZGljYXRpbmcgd2UgYXJlIG5vdCBpbnNpZGUgYSBxdW90ZVxuICBRdW90ZURvdWJsZSA9IDM0LFxuICBRdW90ZVNpbmdsZSA9IDM5LFxufVxuXG4vKipcbiAqIFBhcnNlcyBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYSBzdHlsZSBhbmQgY29udmVydHMgaXQgaW50byBvYmplY3QgbGl0ZXJhbC5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHN0eWxlIGFzIHVzZWQgaW4gdGhlIGBzdHlsZWAgYXR0cmlidXRlIGluIEhUTUwuXG4gKiAgIEV4YW1wbGU6IGBjb2xvcjogcmVkOyBoZWlnaHQ6IGF1dG9gLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2Ygc3R5bGUgcHJvcGVydHkgbmFtZSBhbmQgdmFsdWUgcGFpcnMsIGUuZy4gYFsnY29sb3InLCAncmVkJywgJ2hlaWdodCcsXG4gKiAnYXV0byddYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UodmFsdWU6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgLy8gd2UgdXNlIGEgc3RyaW5nIGFycmF5IGhlcmUgaW5zdGVhZCBvZiBhIHN0cmluZyBtYXBcbiAgLy8gYmVjYXVzZSBhIHN0cmluZy1tYXAgaXMgbm90IGd1YXJhbnRlZWQgdG8gcmV0YWluIHRoZVxuICAvLyBvcmRlciBvZiB0aGUgZW50cmllcyB3aGVyZWFzIGEgc3RyaW5nIGFycmF5IGNhbiBiZVxuICAvLyBjb25zdHJ1Y3RlZCBpbiBhIFtrZXksIHZhbHVlLCBrZXksIHZhbHVlXSBmb3JtYXQuXG4gIGNvbnN0IHN0eWxlczogc3RyaW5nW10gPSBbXTtcblxuICBsZXQgaSA9IDA7XG4gIGxldCBwYXJlbkRlcHRoID0gMDtcbiAgbGV0IHF1b3RlOiBDaGFyID0gQ2hhci5RdW90ZU5vbmU7XG4gIGxldCB2YWx1ZVN0YXJ0ID0gMDtcbiAgbGV0IHByb3BTdGFydCA9IDA7XG4gIGxldCBjdXJyZW50UHJvcDogc3RyaW5nfG51bGwgPSBudWxsO1xuICB3aGlsZSAoaSA8IHZhbHVlLmxlbmd0aCkge1xuICAgIGNvbnN0IHRva2VuID0gdmFsdWUuY2hhckNvZGVBdChpKyspIGFzIENoYXI7XG4gICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgY2FzZSBDaGFyLk9wZW5QYXJlbjpcbiAgICAgICAgcGFyZW5EZXB0aCsrO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQ2hhci5DbG9zZVBhcmVuOlxuICAgICAgICBwYXJlbkRlcHRoLS07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDaGFyLlF1b3RlU2luZ2xlOlxuICAgICAgICAvLyB2YWx1ZVN0YXJ0IG5lZWRzIHRvIGJlIHRoZXJlIHNpbmNlIHByb3AgdmFsdWVzIGRvbid0XG4gICAgICAgIC8vIGhhdmUgcXVvdGVzIGluIENTU1xuICAgICAgICBpZiAocXVvdGUgPT09IENoYXIuUXVvdGVOb25lKSB7XG4gICAgICAgICAgcXVvdGUgPSBDaGFyLlF1b3RlU2luZ2xlO1xuICAgICAgICB9IGVsc2UgaWYgKHF1b3RlID09PSBDaGFyLlF1b3RlU2luZ2xlICYmIHZhbHVlLmNoYXJDb2RlQXQoaSAtIDEpICE9PSBDaGFyLkJhY2tTbGFzaCkge1xuICAgICAgICAgIHF1b3RlID0gQ2hhci5RdW90ZU5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIENoYXIuUXVvdGVEb3VibGU6XG4gICAgICAgIC8vIHNhbWUgbG9naWMgYXMgYWJvdmVcbiAgICAgICAgaWYgKHF1b3RlID09PSBDaGFyLlF1b3RlTm9uZSkge1xuICAgICAgICAgIHF1b3RlID0gQ2hhci5RdW90ZURvdWJsZTtcbiAgICAgICAgfSBlbHNlIGlmIChxdW90ZSA9PT0gQ2hhci5RdW90ZURvdWJsZSAmJiB2YWx1ZS5jaGFyQ29kZUF0KGkgLSAxKSAhPT0gQ2hhci5CYWNrU2xhc2gpIHtcbiAgICAgICAgICBxdW90ZSA9IENoYXIuUXVvdGVOb25lO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDaGFyLkNvbG9uOlxuICAgICAgICBpZiAoIWN1cnJlbnRQcm9wICYmIHBhcmVuRGVwdGggPT09IDAgJiYgcXVvdGUgPT09IENoYXIuUXVvdGVOb25lKSB7XG4gICAgICAgICAgLy8gVE9ETzogRG8gbm90IGh5cGhlbmF0ZSBDU1MgY3VzdG9tIHByb3BlcnR5IG5hbWVzIGxpa2U6IGAtLWludGVudGlvbmFsbHlDYW1lbENhc2VgXG4gICAgICAgICAgY3VycmVudFByb3AgPSBoeXBoZW5hdGUodmFsdWUuc3Vic3RyaW5nKHByb3BTdGFydCwgaSAtIDEpLnRyaW0oKSk7XG4gICAgICAgICAgdmFsdWVTdGFydCA9IGk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIENoYXIuU2VtaWNvbG9uOlxuICAgICAgICBpZiAoY3VycmVudFByb3AgJiYgdmFsdWVTdGFydCA+IDAgJiYgcGFyZW5EZXB0aCA9PT0gMCAmJiBxdW90ZSA9PT0gQ2hhci5RdW90ZU5vbmUpIHtcbiAgICAgICAgICBjb25zdCBzdHlsZVZhbCA9IHZhbHVlLnN1YnN0cmluZyh2YWx1ZVN0YXJ0LCBpIC0gMSkudHJpbSgpO1xuICAgICAgICAgIHN0eWxlcy5wdXNoKGN1cnJlbnRQcm9wLCBzdHlsZVZhbCk7XG4gICAgICAgICAgcHJvcFN0YXJ0ID0gaTtcbiAgICAgICAgICB2YWx1ZVN0YXJ0ID0gMDtcbiAgICAgICAgICBjdXJyZW50UHJvcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKGN1cnJlbnRQcm9wICYmIHZhbHVlU3RhcnQpIHtcbiAgICBjb25zdCBzdHlsZVZhbCA9IHZhbHVlLnNsaWNlKHZhbHVlU3RhcnQpLnRyaW0oKTtcbiAgICBzdHlsZXMucHVzaChjdXJyZW50UHJvcCwgc3R5bGVWYWwpO1xuICB9XG5cbiAgcmV0dXJuIHN0eWxlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGh5cGhlbmF0ZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlXG4gICAgICAucmVwbGFjZShcbiAgICAgICAgICAvW2Etel1bQS1aXS9nLFxuICAgICAgICAgIHYgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHYuY2hhckF0KDApICsgJy0nICsgdi5jaGFyQXQoMSk7XG4gICAgICAgICAgfSlcbiAgICAgIC50b0xvd2VyQ2FzZSgpO1xufVxuXG5cbi8qKlxuICogUGFyc2VzIGV4dHJhY3RlZCBzdHlsZSBhbmQgY2xhc3MgYXR0cmlidXRlcyBpbnRvIHNlcGFyYXRlIEV4dHJhY3RlZEF0dHJpYnV0ZU9wcyBwZXIgc3R5bGUgb3JcbiAqIGNsYXNzIHByb3BlcnR5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VFeHRyYWN0ZWRTdHlsZXMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBjb25zdCBlbGVtZW50cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5DcmVhdGVPcD4oKTtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKGlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICAgIGVsZW1lbnRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlICYmIG9wLmJpbmRpbmdLaW5kID09PSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUgJiZcbiAgICAgICAgICBpci5pc1N0cmluZ0xpdGVyYWwob3AuZXhwcmVzc2lvbiEpKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGVsZW1lbnRzLmdldChvcC50YXJnZXQpITtcblxuICAgICAgICBpZiAodGFyZ2V0ICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LmtpbmQgPT09IGlyLk9wS2luZC5UZW1wbGF0ZSAmJlxuICAgICAgICAgICAgdGFyZ2V0LnRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWwpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIHdpbGwgbm90IGFwcGx5IGNsYXNzIGFuZCBzdHlsZSBiaW5kaW5ncyB0byBzdHJ1Y3R1cmFsXG4gICAgICAgICAgLy8gZGlyZWN0aXZlczsgaW5zdGVhZCwgaXQgd2lsbCBsZWF2ZSB0aGVtIGFzIGF0dHJpYnV0ZXMuXG4gICAgICAgICAgLy8gKEl0J3Mgbm90IGNsZWFyIHdoYXQgdGhhdCB3b3VsZCBtZWFuLCBhbnl3YXkgLS0gY2xhc3NlcyBhbmQgc3R5bGVzIG9uIGEgc3RydWN0dXJhbFxuICAgICAgICAgIC8vIGVsZW1lbnQgc2hvdWxkIHByb2JhYmx5IGJlIGEgcGFyc2UgZXJyb3IuKVxuICAgICAgICAgIC8vIFRPRE86IFdlIG1heSBiZSBhYmxlIHRvIHJlbW92ZSB0aGlzIG9uY2UgVGVtcGxhdGUgUGlwZWxpbmUgaXMgdGhlIGRlZmF1bHQuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3AubmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICAgIGNvbnN0IHBhcnNlZFN0eWxlcyA9IHBhcnNlKG9wLmV4cHJlc3Npb24udmFsdWUpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyc2VkU3R5bGVzLmxlbmd0aCAtIDE7IGkgKz0gMikge1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eSwgbnVsbCwgcGFyc2VkU3R5bGVzW2ldLFxuICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWwocGFyc2VkU3R5bGVzW2kgKyAxXSksIG51bGwsIG51bGwsIFNlY3VyaXR5Q29udGV4dC5TVFlMRSksXG4gICAgICAgICAgICAgICAgb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3AubmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICAgIGNvbnN0IHBhcnNlZENsYXNzZXMgPSBvcC5leHByZXNzaW9uLnZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHBhcnNlZENsYXNzIG9mIHBhcnNlZENsYXNzZXMpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZSwgbnVsbCwgcGFyc2VkQ2xhc3MsIG51bGwsIG51bGwsIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FKSxcbiAgICAgICAgICAgICAgICBvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19