/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
const STYLE_DOT = 'style.';
const CLASS_DOT = 'class.';
const STYLE_BANG = 'style!';
const CLASS_BANG = 'class!';
const BANG_IMPORTANT = '!important';
/**
 * Host bindings are compiled using a different parser entrypoint, and are parsed quite differently
 * as a result. Therefore, we need to do some extra parsing for host style properties, as compared
 * to non-host style properties.
 * TODO: Unify host bindings and non-host bindings in the parser.
 */
export function parseHostStyleProperties(job) {
    for (const op of job.root.update) {
        if (!(op.kind === ir.OpKind.Binding && op.bindingKind === ir.BindingKind.Property)) {
            continue;
        }
        if (op.name.endsWith(BANG_IMPORTANT)) {
            // Delete any `!important` suffixes from the binding name.
            op.name = op.name.substring(0, op.name.length - BANG_IMPORTANT.length);
        }
        if (op.name.startsWith(STYLE_DOT)) {
            op.bindingKind = ir.BindingKind.StyleProperty;
            op.name = op.name.substring(STYLE_DOT.length);
            if (isCssCustomProperty(op.name)) {
                op.name = hyphenate(op.name);
            }
            const { property, suffix } = parseProperty(op.name);
            op.name = property;
            op.unit = suffix;
        }
        else if (op.name.startsWith(STYLE_BANG)) {
            op.bindingKind = ir.BindingKind.StyleProperty;
            op.name = 'style';
        }
        else if (op.name.startsWith(CLASS_DOT)) {
            op.bindingKind = ir.BindingKind.ClassName;
            op.name = parseProperty(op.name.substring(CLASS_DOT.length)).property;
        }
        else if (op.name.startsWith(CLASS_BANG)) {
            op.bindingKind = ir.BindingKind.ClassName;
            op.name = parseProperty(op.name.substring(CLASS_BANG.length)).property;
        }
    }
}
/**
 * Checks whether property name is a custom CSS property.
 * See: https://www.w3.org/TR/css-variables-1
 */
function isCssCustomProperty(name) {
    return name.startsWith('--');
}
function hyphenate(value) {
    return value
        .replace(/[a-z][A-Z]/g, v => {
        return v.charAt(0) + '-' + v.charAt(1);
    })
        .toLowerCase();
}
function parseProperty(name) {
    const overrideIndex = name.indexOf('!important');
    if (overrideIndex !== -1) {
        name = overrideIndex > 0 ? name.substring(0, overrideIndex) : '';
    }
    let suffix = null;
    let property = name;
    const unitIndex = name.lastIndexOf('.');
    if (unitIndex > 0) {
        suffix = name.slice(unitIndex + 1);
        property = name.substring(0, unitIndex);
    }
    return { property, suffix };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdF9zdHlsZV9wcm9wZXJ0eV9wYXJzaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaG9zdF9zdHlsZV9wcm9wZXJ0eV9wYXJzaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBSS9CLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQztBQUMzQixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFFM0IsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDO0FBQzVCLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQztBQUM1QixNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUFFcEM7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQUMsR0FBbUI7SUFDMUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLFdBQVcsS0FBSyxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDbkYsU0FBUztRQUNYLENBQUM7UUFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7WUFDckMsMERBQTBEO1lBQzFELEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRUQsSUFBSSxF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LElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ2xCLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELE9BQU8sRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUM7QUFDNUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5jb25zdCBTVFlMRV9ET1QgPSAnc3R5bGUuJztcbmNvbnN0IENMQVNTX0RPVCA9ICdjbGFzcy4nO1xuXG5jb25zdCBTVFlMRV9CQU5HID0gJ3N0eWxlISc7XG5jb25zdCBDTEFTU19CQU5HID0gJ2NsYXNzISc7XG5jb25zdCBCQU5HX0lNUE9SVEFOVCA9ICchaW1wb3J0YW50JztcblxuLyoqXG4gKiBIb3N0IGJpbmRpbmdzIGFyZSBjb21waWxlZCB1c2luZyBhIGRpZmZlcmVudCBwYXJzZXIgZW50cnlwb2ludCwgYW5kIGFyZSBwYXJzZWQgcXVpdGUgZGlmZmVyZW50bHlcbiAqIGFzIGEgcmVzdWx0LiBUaGVyZWZvcmUsIHdlIG5lZWQgdG8gZG8gc29tZSBleHRyYSBwYXJzaW5nIGZvciBob3N0IHN0eWxlIHByb3BlcnRpZXMsIGFzIGNvbXBhcmVkXG4gKiB0byBub24taG9zdCBzdHlsZSBwcm9wZXJ0aWVzLlxuICogVE9ETzogVW5pZnkgaG9zdCBiaW5kaW5ncyBhbmQgbm9uLWhvc3QgYmluZGluZ3MgaW4gdGhlIHBhcnNlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdFN0eWxlUHJvcGVydGllcyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgb3Agb2Ygam9iLnJvb3QudXBkYXRlKSB7XG4gICAgaWYgKCEob3Aua2luZCA9PT0gaXIuT3BLaW5kLkJpbmRpbmcgJiYgb3AuYmluZGluZ0tpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKG9wLm5hbWUuZW5kc1dpdGgoQkFOR19JTVBPUlRBTlQpKSB7XG4gICAgICAvLyBEZWxldGUgYW55IGAhaW1wb3J0YW50YCBzdWZmaXhlcyBmcm9tIHRoZSBiaW5kaW5nIG5hbWUuXG4gICAgICBvcC5uYW1lID0gb3AubmFtZS5zdWJzdHJpbmcoMCwgb3AubmFtZS5sZW5ndGggLSBCQU5HX0lNUE9SVEFOVC5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChvcC5uYW1lLnN0YXJ0c1dpdGgoU1RZTEVfRE9UKSkge1xuICAgICAgb3AuYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5O1xuICAgICAgb3AubmFtZSA9IG9wLm5hbWUuc3Vic3RyaW5nKFNUWUxFX0RPVC5sZW5ndGgpO1xuXG4gICAgICBpZiAoaXNDc3NDdXN0b21Qcm9wZXJ0eShvcC5uYW1lKSkge1xuICAgICAgICBvcC5uYW1lID0gaHlwaGVuYXRlKG9wLm5hbWUpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7cHJvcGVydHksIHN1ZmZpeH0gPSBwYXJzZVByb3BlcnR5KG9wLm5hbWUpO1xuICAgICAgb3AubmFtZSA9IHByb3BlcnR5O1xuICAgICAgb3AudW5pdCA9IHN1ZmZpeDtcbiAgICB9IGVsc2UgaWYgKG9wLm5hbWUuc3RhcnRzV2l0aChTVFlMRV9CQU5HKSkge1xuICAgICAgb3AuYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5O1xuICAgICAgb3AubmFtZSA9ICdzdHlsZSc7XG4gICAgfSBlbHNlIGlmIChvcC5uYW1lLnN0YXJ0c1dpdGgoQ0xBU1NfRE9UKSkge1xuICAgICAgb3AuYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5DbGFzc05hbWU7XG4gICAgICBvcC5uYW1lID0gcGFyc2VQcm9wZXJ0eShvcC5uYW1lLnN1YnN0cmluZyhDTEFTU19ET1QubGVuZ3RoKSkucHJvcGVydHk7XG4gICAgfSBlbHNlIGlmIChvcC5uYW1lLnN0YXJ0c1dpdGgoQ0xBU1NfQkFORykpIHtcbiAgICAgIG9wLmJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lO1xuICAgICAgb3AubmFtZSA9IHBhcnNlUHJvcGVydHkob3AubmFtZS5zdWJzdHJpbmcoQ0xBU1NfQkFORy5sZW5ndGgpKS5wcm9wZXJ0eTtcbiAgICB9XG4gIH1cbn1cblxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHByb3BlcnR5IG5hbWUgaXMgYSBjdXN0b20gQ1NTIHByb3BlcnR5LlxuICogU2VlOiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXZhcmlhYmxlcy0xXG4gKi9cbmZ1bmN0aW9uIGlzQ3NzQ3VzdG9tUHJvcGVydHkobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgoJy0tJyk7XG59XG5cbmZ1bmN0aW9uIGh5cGhlbmF0ZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlXG4gICAgICAucmVwbGFjZShcbiAgICAgICAgICAvW2Etel1bQS1aXS9nLFxuICAgICAgICAgIHYgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHYuY2hhckF0KDApICsgJy0nICsgdi5jaGFyQXQoMSk7XG4gICAgICAgICAgfSlcbiAgICAgIC50b0xvd2VyQ2FzZSgpO1xufVxuXG5mdW5jdGlvbiBwYXJzZVByb3BlcnR5KG5hbWU6IHN0cmluZyk6IHtwcm9wZXJ0eTogc3RyaW5nLCBzdWZmaXg6IHN0cmluZ3xudWxsfSB7XG4gIGNvbnN0IG92ZXJyaWRlSW5kZXggPSBuYW1lLmluZGV4T2YoJyFpbXBvcnRhbnQnKTtcbiAgaWYgKG92ZXJyaWRlSW5kZXggIT09IC0xKSB7XG4gICAgbmFtZSA9IG92ZXJyaWRlSW5kZXggPiAwID8gbmFtZS5zdWJzdHJpbmcoMCwgb3ZlcnJpZGVJbmRleCkgOiAnJztcbiAgfVxuXG4gIGxldCBzdWZmaXg6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgbGV0IHByb3BlcnR5ID0gbmFtZTtcbiAgY29uc3QgdW5pdEluZGV4ID0gbmFtZS5sYXN0SW5kZXhPZignLicpO1xuICBpZiAodW5pdEluZGV4ID4gMCkge1xuICAgIHN1ZmZpeCA9IG5hbWUuc2xpY2UodW5pdEluZGV4ICsgMSk7XG4gICAgcHJvcGVydHkgPSBuYW1lLnN1YnN0cmluZygwLCB1bml0SW5kZXgpO1xuICB9XG5cbiAgcmV0dXJuIHtwcm9wZXJ0eSwgc3VmZml4fTtcbn1cbiJdfQ==