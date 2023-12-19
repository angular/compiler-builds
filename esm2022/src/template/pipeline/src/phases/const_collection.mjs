/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as core from '../../../../core';
import { splitNsName } from '../../../../ml_parser/tags';
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
import { ComponentCompilationJob, HostBindingCompilationJob } from '../compilation';
import { literalOrArrayLiteral } from '../conversion';
/**
 * Converts the semantic attributes of element-like operations (elements, templates) into constant
 * array expressions, and lifts them into the overall component `consts`.
 */
export function collectElementConsts(job) {
    // Collect all extracted attributes.
    const allElementAttributes = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedAttribute) {
                const attributes = allElementAttributes.get(op.target) || new ElementAttributes(job.compatibility);
                allElementAttributes.set(op.target, attributes);
                attributes.add(op.bindingKind, op.name, op.expression, op.trustedValueFn);
                ir.OpList.remove(op);
            }
        }
    }
    // Serialize the extracted attributes into the const array.
    if (job instanceof ComponentCompilationJob) {
        for (const unit of job.units) {
            for (const op of unit.create) {
                if (ir.isElementOrContainerOp(op)) {
                    op.attributes = getConstIndex(job, allElementAttributes, op.xref);
                    // TODO(dylhunn): `@for` loops with `@empty` blocks need to be special-cased here,
                    // because the slot consumer trait currently only supports one slot per consumer and we
                    // need two. This should be revisited when making the refactors mentioned in:
                    // https://github.com/angular/angular/pull/53620#discussion_r1430918822
                    if (op.kind === ir.OpKind.RepeaterCreate && op.emptyView !== null) {
                        op.emptyAttributes = getConstIndex(job, allElementAttributes, op.emptyView);
                    }
                }
            }
        }
    }
    else if (job instanceof HostBindingCompilationJob) {
        // TODO: If the host binding case further diverges, we may want to split it into its own
        // phase.
        for (const [xref, attributes] of allElementAttributes.entries()) {
            if (xref !== job.root.xref) {
                throw new Error(`An attribute would be const collected into the host binding's template function, but is not associated with the root xref.`);
            }
            const attrArray = serializeAttributes(attributes);
            if (attrArray.entries.length > 0) {
                job.root.attributes = attrArray;
            }
        }
    }
}
function getConstIndex(job, allElementAttributes, xref) {
    const attributes = allElementAttributes.get(xref);
    if (attributes !== undefined) {
        const attrArray = serializeAttributes(attributes);
        if (attrArray.entries.length > 0) {
            return job.addConst(attrArray);
        }
    }
    return null;
}
/**
 * Shared instance of an empty array to avoid unnecessary array allocations.
 */
const FLYWEIGHT_ARRAY = Object.freeze([]);
/**
 * Container for all of the various kinds of attributes which are applied on an element.
 */
class ElementAttributes {
    get attributes() {
        return this.byKind.get(ir.BindingKind.Attribute) ?? FLYWEIGHT_ARRAY;
    }
    get classes() {
        return this.byKind.get(ir.BindingKind.ClassName) ?? FLYWEIGHT_ARRAY;
    }
    get styles() {
        return this.byKind.get(ir.BindingKind.StyleProperty) ?? FLYWEIGHT_ARRAY;
    }
    get bindings() {
        return this.byKind.get(ir.BindingKind.Property) ?? FLYWEIGHT_ARRAY;
    }
    get template() {
        return this.byKind.get(ir.BindingKind.Template) ?? FLYWEIGHT_ARRAY;
    }
    get i18n() {
        return this.byKind.get(ir.BindingKind.I18n) ?? FLYWEIGHT_ARRAY;
    }
    constructor(compatibility) {
        this.compatibility = compatibility;
        this.known = new Map();
        this.byKind = new Map;
        this.projectAs = null;
    }
    isKnown(kind, name, value) {
        const nameToValue = this.known.get(kind) ?? new Set();
        this.known.set(kind, nameToValue);
        if (nameToValue.has(name)) {
            return true;
        }
        nameToValue.add(name);
        return false;
    }
    add(kind, name, value, trustedValueFn) {
        // TemplateDefinitionBuilder puts duplicate attribute, class, and style values into the consts
        // array. This seems inefficient, we can probably keep just the first one or the last value
        // (whichever actually gets applied when multiple values are listed for the same attribute).
        const allowDuplicates = this.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
            (kind === ir.BindingKind.Attribute || kind === ir.BindingKind.ClassName ||
                kind === ir.BindingKind.StyleProperty);
        if (!allowDuplicates && this.isKnown(kind, name, value)) {
            return;
        }
        // TODO: Can this be its own phase
        if (name === 'ngProjectAs') {
            if (value === null || !(value instanceof o.LiteralExpr) || (value.value == null) ||
                (typeof value.value?.toString() !== 'string')) {
                throw Error('ngProjectAs must have a string literal value');
            }
            this.projectAs = value.value.toString();
            // TODO: TemplateDefinitionBuilder allows `ngProjectAs` to also be assigned as a literal
            // attribute. Is this sane?
        }
        const array = this.arrayFor(kind);
        array.push(...getAttributeNameLiterals(name));
        if (kind === ir.BindingKind.Attribute || kind === ir.BindingKind.StyleProperty) {
            if (value === null) {
                throw Error('Attribute, i18n attribute, & style element attributes must have a value');
            }
            if (trustedValueFn !== null) {
                if (!ir.isStringLiteral(value)) {
                    throw Error('AssertionError: extracted attribute value should be string literal');
                }
                array.push(o.taggedTemplate(trustedValueFn, new o.TemplateLiteral([new o.TemplateLiteralElement(value.value)], []), undefined, value.sourceSpan));
            }
            else {
                array.push(value);
            }
        }
    }
    arrayFor(kind) {
        if (!this.byKind.has(kind)) {
            this.byKind.set(kind, []);
        }
        return this.byKind.get(kind);
    }
}
/**
 * Gets an array of literal expressions representing the attribute's namespaced name.
 */
function getAttributeNameLiterals(name) {
    const [attributeNamespace, attributeName] = splitNsName(name, false);
    const nameLiteral = o.literal(attributeName);
    if (attributeNamespace) {
        return [
            o.literal(0 /* core.AttributeMarker.NamespaceURI */), o.literal(attributeNamespace), nameLiteral
        ];
    }
    return [nameLiteral];
}
/**
 * Serializes an ElementAttributes object into an array expression.
 */
function serializeAttributes({ attributes, bindings, classes, i18n, projectAs, styles, template }) {
    const attrArray = [...attributes];
    if (projectAs !== null) {
        // Parse the attribute value into a CssSelectorList. Note that we only take the
        // first selector, because we don't support multiple selectors in ngProjectAs.
        const parsedR3Selector = core.parseSelectorToR3Selector(projectAs)[0];
        attrArray.push(o.literal(5 /* core.AttributeMarker.ProjectAs */), literalOrArrayLiteral(parsedR3Selector));
    }
    if (classes.length > 0) {
        attrArray.push(o.literal(1 /* core.AttributeMarker.Classes */), ...classes);
    }
    if (styles.length > 0) {
        attrArray.push(o.literal(2 /* core.AttributeMarker.Styles */), ...styles);
    }
    if (bindings.length > 0) {
        attrArray.push(o.literal(3 /* core.AttributeMarker.Bindings */), ...bindings);
    }
    if (template.length > 0) {
        attrArray.push(o.literal(4 /* core.AttributeMarker.Template */), ...template);
    }
    if (i18n.length > 0) {
        attrArray.push(o.literal(6 /* core.AttributeMarker.I18n */), ...i18n);
    }
    return o.literalArr(attrArray);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsdUJBQXVCLEVBQUUseUJBQXlCLEVBQXNCLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkcsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxvQ0FBb0M7SUFDcEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUM3QyxNQUFNLFVBQVUsR0FDWixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNwRixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxV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LENBQUMsT0FBTyxzQ0FBOEIsRUFBRSxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdEIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxxQ0FBNkIsRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDeEIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyx1Q0FBK0IsRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDeEIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyx1Q0FBK0IsRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDcEIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxtQ0FBMkIsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtsaXRlcmFsT3JBcnJheUxpdGVyYWx9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBzZW1hbnRpYyBhdHRyaWJ1dGVzIG9mIGVsZW1lbnQtbGlrZSBvcGVyYXRpb25zIChlbGVtZW50cywgdGVtcGxhdGVzKSBpbnRvIGNvbnN0YW50XG4gKiBhcnJheSBleHByZXNzaW9ucywgYW5kIGxpZnRzIHRoZW0gaW50byB0aGUgb3ZlcmFsbCBjb21wb25lbnQgYGNvbnN0c2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0RWxlbWVudENvbnN0cyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIENvbGxlY3QgYWxsIGV4dHJhY3RlZCBhdHRyaWJ1dGVzLlxuICBjb25zdCBhbGxFbGVtZW50QXR0cmlidXRlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSB7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPVxuICAgICAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuZ2V0KG9wLnRhcmdldCkgfHwgbmV3IEVsZW1lbnRBdHRyaWJ1dGVzKGpvYi5jb21wYXRpYmlsaXR5KTtcbiAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuc2V0KG9wLnRhcmdldCwgYXR0cmlidXRlcyk7XG4gICAgICAgIGF0dHJpYnV0ZXMuYWRkKG9wLmJpbmRpbmdLaW5kLCBvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC50cnVzdGVkVmFsdWVGbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGVzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgPSBnZXRDb25zdEluZGV4KGpvYiwgYWxsRWxlbWVudEF0dHJpYnV0ZXMsIG9wLnhyZWYpO1xuXG4gICAgICAgICAgLy8gVE9ETyhkeWxodW5uKTogYEBmb3JgIGxvb3BzIHdpdGggYEBlbXB0eWAgYmxvY2tzIG5lZWQgdG8gYmUgc3BlY2lhbC1jYXNlZCBoZXJlLFxuICAgICAgICAgIC8vIGJlY2F1c2UgdGhlIHNsb3QgY29uc3VtZXIgdHJhaXQgY3VycmVudGx5IG9ubHkgc3VwcG9ydHMgb25lIHNsb3QgcGVyIGNvbnN1bWVyIGFuZCB3ZVxuICAgICAgICAgIC8vIG5lZWQgdHdvLiBUaGlzIHNob3VsZCBiZSByZXZpc2l0ZWQgd2hlbiBtYWtpbmcgdGhlIHJlZmFjdG9ycyBtZW50aW9uZWQgaW46XG4gICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzUzNjIwI2Rpc2N1c3Npb25fcjE0MzA5MTg4MjJcbiAgICAgICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlICYmIG9wLmVtcHR5VmlldyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgb3AuZW1wdHlBdHRyaWJ1dGVzID0gZ2V0Q29uc3RJbmRleChqb2IsIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLCBvcC5lbXB0eVZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChqb2IgaW5zdGFuY2VvZiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKSB7XG4gICAgLy8gVE9ETzogSWYgdGhlIGhvc3QgYmluZGluZyBjYXNlIGZ1cnRoZXIgZGl2ZXJnZXMsIHdlIG1heSB3YW50IHRvIHNwbGl0IGl0IGludG8gaXRzIG93blxuICAgIC8vIHBoYXNlLlxuICAgIGZvciAoY29uc3QgW3hyZWYsIGF0dHJpYnV0ZXNdIG9mIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmVudHJpZXMoKSkge1xuICAgICAgaWYgKHhyZWYgIT09IGpvYi5yb290LnhyZWYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFuIGF0dHJpYnV0ZSB3b3VsZCBiZSBjb25zdCBjb2xsZWN0ZWQgaW50byB0aGUgaG9zdCBiaW5kaW5nJ3MgdGVtcGxhdGUgZnVuY3Rpb24sIGJ1dCBpcyBub3QgYXNzb2NpYXRlZCB3aXRoIHRoZSByb290IHhyZWYuYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBhdHRyQXJyYXkgPSBzZXJpYWxpemVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgaWYgKGF0dHJBcnJheS5lbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgam9iLnJvb3QuYXR0cmlidXRlcyA9IGF0dHJBcnJheTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29uc3RJbmRleChcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBhbGxFbGVtZW50QXR0cmlidXRlczogTWFwPGlyLlhyZWZJZCwgRWxlbWVudEF0dHJpYnV0ZXM+LFxuICAgIHhyZWY6IGlyLlhyZWZJZCk6IGlyLkNvbnN0SW5kZXh8bnVsbCB7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQoeHJlZik7XG4gIGlmIChhdHRyaWJ1dGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBhdHRyQXJyYXkgPSBzZXJpYWxpemVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gam9iLmFkZENvbnN0KGF0dHJBcnJheSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFNoYXJlZCBpbnN0YW5jZSBvZiBhbiBlbXB0eSBhcnJheSB0byBhdm9pZCB1bm5lY2Vzc2FyeSBhcnJheSBhbGxvY2F0aW9ucy5cbiAqL1xuY29uc3QgRkxZV0VJR0hUX0FSUkFZOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4gPSBPYmplY3QuZnJlZXplPG8uRXhwcmVzc2lvbltdPihbXSk7XG5cbi8qKlxuICogQ29udGFpbmVyIGZvciBhbGwgb2YgdGhlIHZhcmlvdXMga2luZHMgb2YgYXR0cmlidXRlcyB3aGljaCBhcmUgYXBwbGllZCBvbiBhbiBlbGVtZW50LlxuICovXG5jbGFzcyBFbGVtZW50QXR0cmlidXRlcyB7XG4gIHByaXZhdGUga25vd24gPSBuZXcgTWFwPGlyLkJpbmRpbmdLaW5kLCBTZXQ8c3RyaW5nPj4oKTtcbiAgcHJpdmF0ZSBieUtpbmQgPSBuZXcgTWFwPGlyLkJpbmRpbmdLaW5kLCBvLkV4cHJlc3Npb25bXT47XG5cbiAgcHJvamVjdEFzOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgZ2V0IGF0dHJpYnV0ZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGNsYXNzZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IHN0eWxlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGJpbmRpbmdzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IHRlbXBsYXRlKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5UZW1wbGF0ZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGkxOG4oKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLkkxOG4pID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY29tcGF0aWJpbGl0eTogaXIuQ29tcGF0aWJpbGl0eU1vZGUpIHt9XG5cbiAgaXNLbm93bihraW5kOiBpci5CaW5kaW5nS2luZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpIHtcbiAgICBjb25zdCBuYW1lVG9WYWx1ZSA9IHRoaXMua25vd24uZ2V0KGtpbmQpID8/IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIHRoaXMua25vd24uc2V0KGtpbmQsIG5hbWVUb1ZhbHVlKTtcbiAgICBpZiAobmFtZVRvVmFsdWUuaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgbmFtZVRvVmFsdWUuYWRkKG5hbWUpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFkZChraW5kOiBpci5CaW5kaW5nS2luZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwsXG4gICAgICB0cnVzdGVkVmFsdWVGbjogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIHB1dHMgZHVwbGljYXRlIGF0dHJpYnV0ZSwgY2xhc3MsIGFuZCBzdHlsZSB2YWx1ZXMgaW50byB0aGUgY29uc3RzXG4gICAgLy8gYXJyYXkuIFRoaXMgc2VlbXMgaW5lZmZpY2llbnQsIHdlIGNhbiBwcm9iYWJseSBrZWVwIGp1c3QgdGhlIGZpcnN0IG9uZSBvciB0aGUgbGFzdCB2YWx1ZVxuICAgIC8vICh3aGljaGV2ZXIgYWN0dWFsbHkgZ2V0cyBhcHBsaWVkIHdoZW4gbXVsdGlwbGUgdmFsdWVzIGFyZSBsaXN0ZWQgZm9yIHRoZSBzYW1lIGF0dHJpYnV0ZSkuXG4gICAgY29uc3QgYWxsb3dEdXBsaWNhdGVzID0gdGhpcy5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyICYmXG4gICAgICAgIChraW5kID09PSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUgfHwga2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lIHx8XG4gICAgICAgICBraW5kID09PSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KTtcbiAgICBpZiAoIWFsbG93RHVwbGljYXRlcyAmJiB0aGlzLmlzS25vd24oa2luZCwgbmFtZSwgdmFsdWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgaXRzIG93biBwaGFzZVxuICAgIGlmIChuYW1lID09PSAnbmdQcm9qZWN0QXMnKSB7XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgISh2YWx1ZSBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIpIHx8ICh2YWx1ZS52YWx1ZSA9PSBudWxsKSB8fFxuICAgICAgICAgICh0eXBlb2YgdmFsdWUudmFsdWU/LnRvU3RyaW5nKCkgIT09ICdzdHJpbmcnKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignbmdQcm9qZWN0QXMgbXVzdCBoYXZlIGEgc3RyaW5nIGxpdGVyYWwgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvamVjdEFzID0gdmFsdWUudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIC8vIFRPRE86IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgYWxsb3dzIGBuZ1Byb2plY3RBc2AgdG8gYWxzbyBiZSBhc3NpZ25lZCBhcyBhIGxpdGVyYWxcbiAgICAgIC8vIGF0dHJpYnV0ZS4gSXMgdGhpcyBzYW5lP1xuICAgIH1cblxuXG4gICAgY29uc3QgYXJyYXkgPSB0aGlzLmFycmF5Rm9yKGtpbmQpO1xuICAgIGFycmF5LnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWUpKTtcbiAgICBpZiAoa2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlIHx8IGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQXR0cmlidXRlLCBpMThuIGF0dHJpYnV0ZSwgJiBzdHlsZSBlbGVtZW50IGF0dHJpYnV0ZXMgbXVzdCBoYXZlIGEgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIGlmICh0cnVzdGVkVmFsdWVGbiAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoIWlyLmlzU3RyaW5nTGl0ZXJhbCh2YWx1ZSkpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IGV4dHJhY3RlZCBhdHRyaWJ1dGUgdmFsdWUgc2hvdWxkIGJlIHN0cmluZyBsaXRlcmFsJyk7XG4gICAgICAgIH1cbiAgICAgICAgYXJyYXkucHVzaChvLnRhZ2dlZFRlbXBsYXRlKFxuICAgICAgICAgICAgdHJ1c3RlZFZhbHVlRm4sIG5ldyBvLlRlbXBsYXRlTGl0ZXJhbChbbmV3IG8uVGVtcGxhdGVMaXRlcmFsRWxlbWVudCh2YWx1ZS52YWx1ZSldLCBbXSksXG4gICAgICAgICAgICB1bmRlZmluZWQsIHZhbHVlLnNvdXJjZVNwYW4pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFycmF5LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXJyYXlGb3Ioa2luZDogaXIuQmluZGluZ0tpbmQpOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgaWYgKCF0aGlzLmJ5S2luZC5oYXMoa2luZCkpIHtcbiAgICAgIHRoaXMuYnlLaW5kLnNldChraW5kLCBbXSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoa2luZCkhO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyBhbiBhcnJheSBvZiBsaXRlcmFsIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgYXR0cmlidXRlJ3MgbmFtZXNwYWNlZCBuYW1lLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZTogc3RyaW5nKTogby5MaXRlcmFsRXhwcltdIHtcbiAgY29uc3QgW2F0dHJpYnV0ZU5hbWVzcGFjZSwgYXR0cmlidXRlTmFtZV0gPSBzcGxpdE5zTmFtZShuYW1lLCBmYWxzZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemVzIGFuIEVsZW1lbnRBdHRyaWJ1dGVzIG9iamVjdCBpbnRvIGFuIGFycmF5IGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIHNlcmlhbGl6ZUF0dHJpYnV0ZXMoe2F0dHJpYnV0ZXMsIGJpbmRpbmdzLCBjbGFzc2VzLCBpMThuLCBwcm9qZWN0QXMsIHN0eWxlcywgdGVtcGxhdGV9OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRWxlbWVudEF0dHJpYnV0ZXMpOiBvLkxpdGVyYWxBcnJheUV4cHIge1xuICBjb25zdCBhdHRyQXJyYXkgPSBbLi4uYXR0cmlidXRlc107XG5cbiAgaWYgKHByb2plY3RBcyAhPT0gbnVsbCkge1xuICAgIC8vIFBhcnNlIHRoZSBhdHRyaWJ1dGUgdmFsdWUgaW50byBhIENzc1NlbGVjdG9yTGlzdC4gTm90ZSB0aGF0IHdlIG9ubHkgdGFrZSB0aGVcbiAgICAvLyBmaXJzdCBzZWxlY3RvciwgYmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IG11bHRpcGxlIHNlbGVjdG9ycyBpbiBuZ1Byb2plY3RBcy5cbiAgICBjb25zdCBwYXJzZWRSM1NlbGVjdG9yID0gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHByb2plY3RBcylbMF07XG4gICAgYXR0ckFycmF5LnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5Qcm9qZWN0QXMpLCBsaXRlcmFsT3JBcnJheUxpdGVyYWwocGFyc2VkUjNTZWxlY3RvcikpO1xuICB9XG4gIGlmIChjbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQ2xhc3NlcyksIC4uLmNsYXNzZXMpO1xuICB9XG4gIGlmIChzdHlsZXMubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpLCAuLi5zdHlsZXMpO1xuICB9XG4gIGlmIChiaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzKSwgLi4uYmluZGluZ3MpO1xuICB9XG4gIGlmICh0ZW1wbGF0ZS5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSwgLi4udGVtcGxhdGUpO1xuICB9XG4gIGlmIChpMThuLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuSTE4biksIC4uLmkxOG4pO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWxBcnIoYXR0ckFycmF5KTtcbn1cbiJdfQ==