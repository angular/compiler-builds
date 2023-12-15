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
                const attributes = allElementAttributes.get(op.target) || new ElementAttributes();
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
    constructor() {
        this.known = new Map();
        this.byKind = new Map;
        this.projectAs = null;
    }
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
        if (this.isKnown(kind, name, value)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsdUJBQXVCLEVBQUUseUJBQXlCLEVBQXNCLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkcsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxvQ0FBb0M7SUFDcEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFO2dCQUM1QyxNQUFNLFVBQVUsR0FBRyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLEVBQUUsQ0FBQztnQkFDbEYsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ2hELFVBQVUsQ0FBQyxHQUFH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QUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUNyQixTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLHFDQUE2QixFQUFFLEdBQUcsTUFBTSxDQUFDLENBQUM7S0FDbkU7SUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sdUNBQStCLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztLQUN2RTtJQUNELElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDdkIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyx1Q0FBK0IsRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUNuQixTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLG1DQUEyQixFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7S0FDL0Q7SUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtsaXRlcmFsT3JBcnJheUxpdGVyYWx9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBzZW1hbnRpYyBhdHRyaWJ1dGVzIG9mIGVsZW1lbnQtbGlrZSBvcGVyYXRpb25zIChlbGVtZW50cywgdGVtcGxhdGVzKSBpbnRvIGNvbnN0YW50XG4gKiBhcnJheSBleHByZXNzaW9ucywgYW5kIGxpZnRzIHRoZW0gaW50byB0aGUgb3ZlcmFsbCBjb21wb25lbnQgYGNvbnN0c2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0RWxlbWVudENvbnN0cyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIENvbGxlY3QgYWxsIGV4dHJhY3RlZCBhdHRyaWJ1dGVzLlxuICBjb25zdCBhbGxFbGVtZW50QXR0cmlidXRlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSB7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AudGFyZ2V0KSB8fCBuZXcgRWxlbWVudEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuc2V0KG9wLnRhcmdldCwgYXR0cmlidXRlcyk7XG4gICAgICAgIGF0dHJpYnV0ZXMuYWRkKG9wLmJpbmRpbmdLaW5kLCBvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC50cnVzdGVkVmFsdWVGbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGVzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgPSBqb2IuYWRkQ29uc3QoYXR0ckFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoam9iIGluc3RhbmNlb2YgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYikge1xuICAgIC8vIFRPRE86IElmIHRoZSBob3N0IGJpbmRpbmcgY2FzZSBmdXJ0aGVyIGRpdmVyZ2VzLCB3ZSBtYXkgd2FudCB0byBzcGxpdCBpdCBpbnRvIGl0cyBvd25cbiAgICAvLyBwaGFzZS5cbiAgICBmb3IgKGNvbnN0IFt4cmVmLCBhdHRyaWJ1dGVzXSBvZiBhbGxFbGVtZW50QXR0cmlidXRlcy5lbnRyaWVzKCkpIHtcbiAgICAgIGlmICh4cmVmICE9PSBqb2Iucm9vdC54cmVmKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBbiBhdHRyaWJ1dGUgd291bGQgYmUgY29uc3QgY29sbGVjdGVkIGludG8gdGhlIGhvc3QgYmluZGluZydzIHRlbXBsYXRlIGZ1bmN0aW9uLCBidXQgaXMgbm90IGFzc29jaWF0ZWQgd2l0aCB0aGUgcm9vdCB4cmVmLmApO1xuICAgICAgfVxuICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGpvYi5yb290LmF0dHJpYnV0ZXMgPSBhdHRyQXJyYXk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2hhcmVkIGluc3RhbmNlIG9mIGFuIGVtcHR5IGFycmF5IHRvIGF2b2lkIHVubmVjZXNzYXJ5IGFycmF5IGFsbG9jYXRpb25zLlxuICovXG5jb25zdCBGTFlXRUlHSFRfQVJSQVk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiA9IE9iamVjdC5mcmVlemU8by5FeHByZXNzaW9uW10+KFtdKTtcblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBvZiB0aGUgdmFyaW91cyBraW5kcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGFyZSBhcHBsaWVkIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgcHJpdmF0ZSBrbm93biA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIFNldDxzdHJpbmc+PigpO1xuICBwcml2YXRlIGJ5S2luZCA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIG8uRXhwcmVzc2lvbltdPjtcblxuICBwcm9qZWN0QXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBnZXQgYXR0cmlidXRlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgY2xhc3NlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgc3R5bGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgYmluZGluZ3MoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgaTE4bigpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuSTE4bikgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgaXNLbm93bihraW5kOiBpci5CaW5kaW5nS2luZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpIHtcbiAgICBjb25zdCBuYW1lVG9WYWx1ZSA9IHRoaXMua25vd24uZ2V0KGtpbmQpID8/IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIHRoaXMua25vd24uc2V0KGtpbmQsIG5hbWVUb1ZhbHVlKTtcbiAgICBpZiAobmFtZVRvVmFsdWUuaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgbmFtZVRvVmFsdWUuYWRkKG5hbWUpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFkZChraW5kOiBpci5CaW5kaW5nS2luZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwsXG4gICAgICB0cnVzdGVkVmFsdWVGbjogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0tub3duKGtpbmQsIG5hbWUsIHZhbHVlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRPRE86IENhbiB0aGlzIGJlIGl0cyBvd24gcGhhc2VcbiAgICBpZiAobmFtZSA9PT0gJ25nUHJvamVjdEFzJykge1xuICAgICAgaWYgKHZhbHVlID09PSBudWxsIHx8ICEodmFsdWUgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByKSB8fCAodmFsdWUudmFsdWUgPT0gbnVsbCkgfHxcbiAgICAgICAgICAodHlwZW9mIHZhbHVlLnZhbHVlPy50b1N0cmluZygpICE9PSAnc3RyaW5nJykpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ25nUHJvamVjdEFzIG11c3QgaGF2ZSBhIHN0cmluZyBsaXRlcmFsIHZhbHVlJyk7XG4gICAgICB9XG4gICAgICB0aGlzLnByb2plY3RBcyA9IHZhbHVlLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAvLyBUT0RPOiBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGFsbG93cyBgbmdQcm9qZWN0QXNgIHRvIGFsc28gYmUgYXNzaWduZWQgYXMgYSBsaXRlcmFsXG4gICAgICAvLyBhdHRyaWJ1dGUuIElzIHRoaXMgc2FuZT9cbiAgICB9XG5cblxuICAgIGNvbnN0IGFycmF5ID0gdGhpcy5hcnJheUZvcihraW5kKTtcbiAgICBhcnJheS5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lKSk7XG4gICAgaWYgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSB7XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0F0dHJpYnV0ZSwgaTE4biBhdHRyaWJ1dGUsICYgc3R5bGUgZWxlbWVudCBhdHRyaWJ1dGVzIG11c3QgaGF2ZSBhIHZhbHVlJyk7XG4gICAgICB9XG4gICAgICBpZiAodHJ1c3RlZFZhbHVlRm4gIT09IG51bGwpIHtcbiAgICAgICAgaWYgKCFpci5pc1N0cmluZ0xpdGVyYWwodmFsdWUpKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBleHRyYWN0ZWQgYXR0cmlidXRlIHZhbHVlIHNob3VsZCBiZSBzdHJpbmcgbGl0ZXJhbCcpO1xuICAgICAgICB9XG4gICAgICAgIGFycmF5LnB1c2goby50YWdnZWRUZW1wbGF0ZShcbiAgICAgICAgICAgIHRydXN0ZWRWYWx1ZUZuLCBuZXcgby5UZW1wbGF0ZUxpdGVyYWwoW25ldyBvLlRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQodmFsdWUudmFsdWUpXSwgW10pLFxuICAgICAgICAgICAgdW5kZWZpbmVkLCB2YWx1ZS5zb3VyY2VTcGFuKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcnJheS5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFycmF5Rm9yKGtpbmQ6IGlyLkJpbmRpbmdLaW5kKTogby5FeHByZXNzaW9uW10ge1xuICAgIGlmICghdGhpcy5ieUtpbmQuaGFzKGtpbmQpKSB7XG4gICAgICB0aGlzLmJ5S2luZC5zZXQoa2luZCwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGtpbmQpITtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbCBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSdzIG5hbWVzcGFjZWQgbmFtZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSwgZmFsc2UpO1xuICBjb25zdCBuYW1lTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lKTtcblxuICBpZiAoYXR0cmlidXRlTmFtZXNwYWNlKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBhbiBFbGVtZW50QXR0cmlidXRlcyBvYmplY3QgaW50byBhbiBhcnJheSBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBzZXJpYWxpemVBdHRyaWJ1dGVzKHthdHRyaWJ1dGVzLCBiaW5kaW5ncywgY2xhc3NlcywgaTE4biwgcHJvamVjdEFzLCBzdHlsZXMsIHRlbXBsYXRlfTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEVsZW1lbnRBdHRyaWJ1dGVzKTogby5MaXRlcmFsQXJyYXlFeHByIHtcbiAgY29uc3QgYXR0ckFycmF5ID0gWy4uLmF0dHJpYnV0ZXNdO1xuXG4gIGlmIChwcm9qZWN0QXMgIT09IG51bGwpIHtcbiAgICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gICAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gICAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3Rvcihwcm9qZWN0QXMpWzBdO1xuICAgIGF0dHJBcnJheS5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgbGl0ZXJhbE9yQXJyYXlMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpKTtcbiAgfVxuICBpZiAoY2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpLCAuLi5jbGFzc2VzKTtcbiAgfVxuICBpZiAoc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuU3R5bGVzKSwgLi4uc3R5bGVzKTtcbiAgfVxuICBpZiAoYmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncyksIC4uLmJpbmRpbmdzKTtcbiAgfVxuICBpZiAodGVtcGxhdGUubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSksIC4uLnRlbXBsYXRlKTtcbiAgfVxuICBpZiAoaTE4bi5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkkxOG4pLCAuLi5pMThuKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsQXJyKGF0dHJBcnJheSk7XG59XG4iXX0=