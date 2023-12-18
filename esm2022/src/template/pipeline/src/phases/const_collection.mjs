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
                    const attributes = allElementAttributes.get(op.xref);
                    if (attributes !== undefined) {
                        const attrArray = serializeAttributes(attributes);
                        if (attrArray.entries.length > 0) {
                            op.attributes = job.addConst(attrArray);
                        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsdUJBQXVCLEVBQUUseUJBQXlCLEVBQXNCLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkcsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxvQ0FBb0M7SUFDcEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFO2dCQUM1QyxNQUFNLFVBQVUsR0FDWixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNwRixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztn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bGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtsaXRlcmFsT3JBcnJheUxpdGVyYWx9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBzZW1hbnRpYyBhdHRyaWJ1dGVzIG9mIGVsZW1lbnQtbGlrZSBvcGVyYXRpb25zIChlbGVtZW50cywgdGVtcGxhdGVzKSBpbnRvIGNvbnN0YW50XG4gKiBhcnJheSBleHByZXNzaW9ucywgYW5kIGxpZnRzIHRoZW0gaW50byB0aGUgb3ZlcmFsbCBjb21wb25lbnQgYGNvbnN0c2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0RWxlbWVudENvbnN0cyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIENvbGxlY3QgYWxsIGV4dHJhY3RlZCBhdHRyaWJ1dGVzLlxuICBjb25zdCBhbGxFbGVtZW50QXR0cmlidXRlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSB7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPVxuICAgICAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuZ2V0KG9wLnRhcmdldCkgfHwgbmV3IEVsZW1lbnRBdHRyaWJ1dGVzKGpvYi5jb21wYXRpYmlsaXR5KTtcbiAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuc2V0KG9wLnRhcmdldCwgYXR0cmlidXRlcyk7XG4gICAgICAgIGF0dHJpYnV0ZXMuYWRkKG9wLmJpbmRpbmdLaW5kLCBvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC50cnVzdGVkVmFsdWVGbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGVzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgPSBqb2IuYWRkQ29uc3QoYXR0ckFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoam9iIGluc3RhbmNlb2YgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYikge1xuICAgIC8vIFRPRE86IElmIHRoZSBob3N0IGJpbmRpbmcgY2FzZSBmdXJ0aGVyIGRpdmVyZ2VzLCB3ZSBtYXkgd2FudCB0byBzcGxpdCBpdCBpbnRvIGl0cyBvd25cbiAgICAvLyBwaGFzZS5cbiAgICBmb3IgKGNvbnN0IFt4cmVmLCBhdHRyaWJ1dGVzXSBvZiBhbGxFbGVtZW50QXR0cmlidXRlcy5lbnRyaWVzKCkpIHtcbiAgICAgIGlmICh4cmVmICE9PSBqb2Iucm9vdC54cmVmKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBbiBhdHRyaWJ1dGUgd291bGQgYmUgY29uc3QgY29sbGVjdGVkIGludG8gdGhlIGhvc3QgYmluZGluZydzIHRlbXBsYXRlIGZ1bmN0aW9uLCBidXQgaXMgbm90IGFzc29jaWF0ZWQgd2l0aCB0aGUgcm9vdCB4cmVmLmApO1xuICAgICAgfVxuICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGpvYi5yb290LmF0dHJpYnV0ZXMgPSBhdHRyQXJyYXk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2hhcmVkIGluc3RhbmNlIG9mIGFuIGVtcHR5IGFycmF5IHRvIGF2b2lkIHVubmVjZXNzYXJ5IGFycmF5IGFsbG9jYXRpb25zLlxuICovXG5jb25zdCBGTFlXRUlHSFRfQVJSQVk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiA9IE9iamVjdC5mcmVlemU8by5FeHByZXNzaW9uW10+KFtdKTtcblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBvZiB0aGUgdmFyaW91cyBraW5kcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGFyZSBhcHBsaWVkIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgcHJpdmF0ZSBrbm93biA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIFNldDxzdHJpbmc+PigpO1xuICBwcml2YXRlIGJ5S2luZCA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIG8uRXhwcmVzc2lvbltdPjtcblxuICBwcm9qZWN0QXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBnZXQgYXR0cmlidXRlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgY2xhc3NlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgc3R5bGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgYmluZGluZ3MoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgaTE4bigpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuSTE4bikgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge31cblxuICBpc0tub3duKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIGNvbnN0IG5hbWVUb1ZhbHVlID0gdGhpcy5rbm93bi5nZXQoa2luZCkgPz8gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgdGhpcy5rbm93bi5zZXQoa2luZCwgbmFtZVRvVmFsdWUpO1xuICAgIGlmIChuYW1lVG9WYWx1ZS5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBuYW1lVG9WYWx1ZS5hZGQobmFtZSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYWRkKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICAgIHRydXN0ZWRWYWx1ZUZuOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgcHV0cyBkdXBsaWNhdGUgYXR0cmlidXRlLCBjbGFzcywgYW5kIHN0eWxlIHZhbHVlcyBpbnRvIHRoZSBjb25zdHNcbiAgICAvLyBhcnJheS4gVGhpcyBzZWVtcyBpbmVmZmljaWVudCwgd2UgY2FuIHByb2JhYmx5IGtlZXAganVzdCB0aGUgZmlyc3Qgb25lIG9yIHRoZSBsYXN0IHZhbHVlXG4gICAgLy8gKHdoaWNoZXZlciBhY3R1YWxseSBnZXRzIGFwcGxpZWQgd2hlbiBtdWx0aXBsZSB2YWx1ZXMgYXJlIGxpc3RlZCBmb3IgdGhlIHNhbWUgYXR0cmlidXRlKS5cbiAgICBjb25zdCBhbGxvd0R1cGxpY2F0ZXMgPSB0aGlzLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5DbGFzc05hbWUgfHxcbiAgICAgICAgIGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpO1xuICAgIGlmICghYWxsb3dEdXBsaWNhdGVzICYmIHRoaXMuaXNLbm93bihraW5kLCBuYW1lLCB2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBpdHMgb3duIHBoYXNlXG4gICAgaWYgKG5hbWUgPT09ICduZ1Byb2plY3RBcycpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCAhKHZhbHVlIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwcikgfHwgKHZhbHVlLnZhbHVlID09IG51bGwpIHx8XG4gICAgICAgICAgKHR5cGVvZiB2YWx1ZS52YWx1ZT8udG9TdHJpbmcoKSAhPT0gJ3N0cmluZycpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCduZ1Byb2plY3RBcyBtdXN0IGhhdmUgYSBzdHJpbmcgbGl0ZXJhbCB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0QXMgPSB2YWx1ZS52YWx1ZS50b1N0cmluZygpO1xuICAgICAgLy8gVE9ETzogVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBhbGxvd3MgYG5nUHJvamVjdEFzYCB0byBhbHNvIGJlIGFzc2lnbmVkIGFzIGEgbGl0ZXJhbFxuICAgICAgLy8gYXR0cmlidXRlLiBJcyB0aGlzIHNhbmU/XG4gICAgfVxuXG5cbiAgICBjb25zdCBhcnJheSA9IHRoaXMuYXJyYXlGb3Ioa2luZCk7XG4gICAgYXJyYXkucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZSkpO1xuICAgIGlmIChraW5kID09PSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUgfHwga2luZCA9PT0gaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eSkge1xuICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdBdHRyaWJ1dGUsIGkxOG4gYXR0cmlidXRlLCAmIHN0eWxlIGVsZW1lbnQgYXR0cmlidXRlcyBtdXN0IGhhdmUgYSB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgaWYgKHRydXN0ZWRWYWx1ZUZuICE9PSBudWxsKSB7XG4gICAgICAgIGlmICghaXIuaXNTdHJpbmdMaXRlcmFsKHZhbHVlKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdBc3NlcnRpb25FcnJvcjogZXh0cmFjdGVkIGF0dHJpYnV0ZSB2YWx1ZSBzaG91bGQgYmUgc3RyaW5nIGxpdGVyYWwnKTtcbiAgICAgICAgfVxuICAgICAgICBhcnJheS5wdXNoKG8udGFnZ2VkVGVtcGxhdGUoXG4gICAgICAgICAgICB0cnVzdGVkVmFsdWVGbiwgbmV3IG8uVGVtcGxhdGVMaXRlcmFsKFtuZXcgby5UZW1wbGF0ZUxpdGVyYWxFbGVtZW50KHZhbHVlLnZhbHVlKV0sIFtdKSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgdmFsdWUuc291cmNlU3BhbikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcnJheUZvcihraW5kOiBpci5CaW5kaW5nS2luZCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBpZiAoIXRoaXMuYnlLaW5kLmhhcyhraW5kKSkge1xuICAgICAgdGhpcy5ieUtpbmQuc2V0KGtpbmQsIFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChraW5kKSE7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWwgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBhdHRyaWJ1dGUncyBuYW1lc3BhY2VkIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lOiBzdHJpbmcpOiBvLkxpdGVyYWxFeHByW10ge1xuICBjb25zdCBbYXR0cmlidXRlTmFtZXNwYWNlLCBhdHRyaWJ1dGVOYW1lXSA9IHNwbGl0TnNOYW1lKG5hbWUsIGZhbHNlKTtcbiAgY29uc3QgbmFtZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZSk7XG5cbiAgaWYgKGF0dHJpYnV0ZU5hbWVzcGFjZSkge1xuICAgIHJldHVybiBbXG4gICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJKSwgby5saXRlcmFsKGF0dHJpYnV0ZU5hbWVzcGFjZSksIG5hbWVMaXRlcmFsXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBbbmFtZUxpdGVyYWxdO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgYW4gRWxlbWVudEF0dHJpYnV0ZXMgb2JqZWN0IGludG8gYW4gYXJyYXkgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gc2VyaWFsaXplQXR0cmlidXRlcyh7YXR0cmlidXRlcywgYmluZGluZ3MsIGNsYXNzZXMsIGkxOG4sIHByb2plY3RBcywgc3R5bGVzLCB0ZW1wbGF0ZX06XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBFbGVtZW50QXR0cmlidXRlcyk6IG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGNvbnN0IGF0dHJBcnJheSA9IFsuLi5hdHRyaWJ1dGVzXTtcblxuICBpZiAocHJvamVjdEFzICE9PSBudWxsKSB7XG4gICAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAgIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICAgIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocHJvamVjdEFzKVswXTtcbiAgICBhdHRyQXJyYXkucHVzaChcbiAgICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGxpdGVyYWxPckFycmF5TGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKSk7XG4gIH1cbiAgaWYgKGNsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSwgLi4uY2xhc3Nlcyk7XG4gIH1cbiAgaWYgKHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlN0eWxlcyksIC4uLnN0eWxlcyk7XG4gIH1cbiAgaWYgKGJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpLCAuLi5iaW5kaW5ncyk7XG4gIH1cbiAgaWYgKHRlbXBsYXRlLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuVGVtcGxhdGUpLCAuLi50ZW1wbGF0ZSk7XG4gIH1cbiAgaWYgKGkxOG4ubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSwgLi4uaTE4bik7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbEFycihhdHRyQXJyYXkpO1xufVxuIl19