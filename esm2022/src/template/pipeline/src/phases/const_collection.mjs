/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as core from '../../../../core';
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
                attributes.add(op.bindingKind, op.name, op.expression, op.namespace, op.trustedValueFn);
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
    add(kind, name, value, namespace, trustedValueFn) {
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
        array.push(...getAttributeNameLiterals(namespace, name));
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
function getAttributeNameLiterals(namespace, name) {
    const nameLiteral = o.literal(name);
    if (namespace) {
        return [o.literal(0 /* core.AttributeMarker.NamespaceURI */), o.literal(namespace), nameLiteral];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBc0IsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2RyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFcEQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEdBQW1CO0lBQ3RELG9DQUFvQztJQUNwQyxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO0lBQ3JFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLEVBQUU7Z0JBQzVDLE1BQU0sVUFBVSxHQUNaLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ3BGLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUNoRCxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVB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UyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEUsU0FBUyxDQUFDLElBQUksQ0FDVixDQUFDLENBQUMsT0FBTyx3Q0FBZ0MsRUFBRSxxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7S0FDekY7SUFDRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3RCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sc0NBQThCLEVBQUUsR0FBRyxPQUFPLENBQUMsQ0FBQztLQUNyRTtJQUNELElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxxQ0FBNkIsRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDO0tBQ25FO0lBQ0QsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUN2QixTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLHVDQUErQixFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7S0FDdkU7SUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sdUNBQStCLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztLQUN2RTtJQUNELElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDbkIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxtQ0FBMkIsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0tBQy9EO0lBQ0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7bGl0ZXJhbE9yQXJyYXlMaXRlcmFsfSBmcm9tICcuLi9jb252ZXJzaW9uJztcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgc2VtYW50aWMgYXR0cmlidXRlcyBvZiBlbGVtZW50LWxpa2Ugb3BlcmF0aW9ucyAoZWxlbWVudHMsIHRlbXBsYXRlcykgaW50byBjb25zdGFudFxuICogYXJyYXkgZXhwcmVzc2lvbnMsIGFuZCBsaWZ0cyB0aGVtIGludG8gdGhlIG92ZXJhbGwgY29tcG9uZW50IGBjb25zdHNgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdEVsZW1lbnRDb25zdHMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBDb2xsZWN0IGFsbCBleHRyYWN0ZWQgYXR0cmlidXRlcy5cbiAgY29uc3QgYWxsRWxlbWVudEF0dHJpYnV0ZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgRWxlbWVudEF0dHJpYnV0ZXM+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID1cbiAgICAgICAgICAgIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmdldChvcC50YXJnZXQpIHx8IG5ldyBFbGVtZW50QXR0cmlidXRlcyhqb2IuY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLnNldChvcC50YXJnZXQsIGF0dHJpYnV0ZXMpO1xuICAgICAgICBhdHRyaWJ1dGVzLmFkZChvcC5iaW5kaW5nS2luZCwgb3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3AubmFtZXNwYWNlLCBvcC50cnVzdGVkVmFsdWVGbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGVzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgPSBqb2IuYWRkQ29uc3QoYXR0ckFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoam9iIGluc3RhbmNlb2YgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYikge1xuICAgIC8vIFRPRE86IElmIHRoZSBob3N0IGJpbmRpbmcgY2FzZSBmdXJ0aGVyIGRpdmVyZ2VzLCB3ZSBtYXkgd2FudCB0byBzcGxpdCBpdCBpbnRvIGl0cyBvd25cbiAgICAvLyBwaGFzZS5cbiAgICBmb3IgKGNvbnN0IFt4cmVmLCBhdHRyaWJ1dGVzXSBvZiBhbGxFbGVtZW50QXR0cmlidXRlcy5lbnRyaWVzKCkpIHtcbiAgICAgIGlmICh4cmVmICE9PSBqb2Iucm9vdC54cmVmKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBbiBhdHRyaWJ1dGUgd291bGQgYmUgY29uc3QgY29sbGVjdGVkIGludG8gdGhlIGhvc3QgYmluZGluZydzIHRlbXBsYXRlIGZ1bmN0aW9uLCBidXQgaXMgbm90IGFzc29jaWF0ZWQgd2l0aCB0aGUgcm9vdCB4cmVmLmApO1xuICAgICAgfVxuICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGpvYi5yb290LmF0dHJpYnV0ZXMgPSBhdHRyQXJyYXk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2hhcmVkIGluc3RhbmNlIG9mIGFuIGVtcHR5IGFycmF5IHRvIGF2b2lkIHVubmVjZXNzYXJ5IGFycmF5IGFsbG9jYXRpb25zLlxuICovXG5jb25zdCBGTFlXRUlHSFRfQVJSQVk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiA9IE9iamVjdC5mcmVlemU8by5FeHByZXNzaW9uW10+KFtdKTtcblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBvZiB0aGUgdmFyaW91cyBraW5kcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGFyZSBhcHBsaWVkIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgcHJpdmF0ZSBrbm93biA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIFNldDxzdHJpbmc+PigpO1xuICBwcml2YXRlIGJ5S2luZCA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIG8uRXhwcmVzc2lvbltdPjtcblxuICBwcm9qZWN0QXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBnZXQgYXR0cmlidXRlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgY2xhc3NlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgc3R5bGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgYmluZGluZ3MoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgaTE4bigpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuSTE4bikgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge31cblxuICBpc0tub3duKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIGNvbnN0IG5hbWVUb1ZhbHVlID0gdGhpcy5rbm93bi5nZXQoa2luZCkgPz8gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgdGhpcy5rbm93bi5zZXQoa2luZCwgbmFtZVRvVmFsdWUpO1xuICAgIGlmIChuYW1lVG9WYWx1ZS5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBuYW1lVG9WYWx1ZS5hZGQobmFtZSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYWRkKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCwgbmFtZXNwYWNlOiBzdHJpbmd8bnVsbCxcbiAgICAgIHRydXN0ZWRWYWx1ZUZuOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgcHV0cyBkdXBsaWNhdGUgYXR0cmlidXRlLCBjbGFzcywgYW5kIHN0eWxlIHZhbHVlcyBpbnRvIHRoZSBjb25zdHNcbiAgICAvLyBhcnJheS4gVGhpcyBzZWVtcyBpbmVmZmljaWVudCwgd2UgY2FuIHByb2JhYmx5IGtlZXAganVzdCB0aGUgZmlyc3Qgb25lIG9yIHRoZSBsYXN0IHZhbHVlXG4gICAgLy8gKHdoaWNoZXZlciBhY3R1YWxseSBnZXRzIGFwcGxpZWQgd2hlbiBtdWx0aXBsZSB2YWx1ZXMgYXJlIGxpc3RlZCBmb3IgdGhlIHNhbWUgYXR0cmlidXRlKS5cbiAgICBjb25zdCBhbGxvd0R1cGxpY2F0ZXMgPSB0aGlzLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5DbGFzc05hbWUgfHxcbiAgICAgICAgIGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpO1xuICAgIGlmICghYWxsb3dEdXBsaWNhdGVzICYmIHRoaXMuaXNLbm93bihraW5kLCBuYW1lLCB2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBpdHMgb3duIHBoYXNlXG4gICAgaWYgKG5hbWUgPT09ICduZ1Byb2plY3RBcycpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCAhKHZhbHVlIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwcikgfHwgKHZhbHVlLnZhbHVlID09IG51bGwpIHx8XG4gICAgICAgICAgKHR5cGVvZiB2YWx1ZS52YWx1ZT8udG9TdHJpbmcoKSAhPT0gJ3N0cmluZycpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCduZ1Byb2plY3RBcyBtdXN0IGhhdmUgYSBzdHJpbmcgbGl0ZXJhbCB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0QXMgPSB2YWx1ZS52YWx1ZS50b1N0cmluZygpO1xuICAgICAgLy8gVE9ETzogVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBhbGxvd3MgYG5nUHJvamVjdEFzYCB0byBhbHNvIGJlIGFzc2lnbmVkIGFzIGEgbGl0ZXJhbFxuICAgICAgLy8gYXR0cmlidXRlLiBJcyB0aGlzIHNhbmU/XG4gICAgfVxuXG5cbiAgICBjb25zdCBhcnJheSA9IHRoaXMuYXJyYXlGb3Ioa2luZCk7XG4gICAgYXJyYXkucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZXNwYWNlLCBuYW1lKSk7XG4gICAgaWYgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSB7XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0F0dHJpYnV0ZSwgaTE4biBhdHRyaWJ1dGUsICYgc3R5bGUgZWxlbWVudCBhdHRyaWJ1dGVzIG11c3QgaGF2ZSBhIHZhbHVlJyk7XG4gICAgICB9XG4gICAgICBpZiAodHJ1c3RlZFZhbHVlRm4gIT09IG51bGwpIHtcbiAgICAgICAgaWYgKCFpci5pc1N0cmluZ0xpdGVyYWwodmFsdWUpKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBleHRyYWN0ZWQgYXR0cmlidXRlIHZhbHVlIHNob3VsZCBiZSBzdHJpbmcgbGl0ZXJhbCcpO1xuICAgICAgICB9XG4gICAgICAgIGFycmF5LnB1c2goby50YWdnZWRUZW1wbGF0ZShcbiAgICAgICAgICAgIHRydXN0ZWRWYWx1ZUZuLCBuZXcgby5UZW1wbGF0ZUxpdGVyYWwoW25ldyBvLlRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQodmFsdWUudmFsdWUpXSwgW10pLFxuICAgICAgICAgICAgdW5kZWZpbmVkLCB2YWx1ZS5zb3VyY2VTcGFuKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcnJheS5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFycmF5Rm9yKGtpbmQ6IGlyLkJpbmRpbmdLaW5kKTogby5FeHByZXNzaW9uW10ge1xuICAgIGlmICghdGhpcy5ieUtpbmQuaGFzKGtpbmQpKSB7XG4gICAgICB0aGlzLmJ5S2luZC5zZXQoa2luZCwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGtpbmQpITtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbCBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSdzIG5hbWVzcGFjZWQgbmFtZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWVzcGFjZTogc3RyaW5nfG51bGwsIG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKG5hbWUpO1xuXG4gIGlmIChuYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW28ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwobmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBhbiBFbGVtZW50QXR0cmlidXRlcyBvYmplY3QgaW50byBhbiBhcnJheSBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBzZXJpYWxpemVBdHRyaWJ1dGVzKHthdHRyaWJ1dGVzLCBiaW5kaW5ncywgY2xhc3NlcywgaTE4biwgcHJvamVjdEFzLCBzdHlsZXMsIHRlbXBsYXRlfTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEVsZW1lbnRBdHRyaWJ1dGVzKTogby5MaXRlcmFsQXJyYXlFeHByIHtcbiAgY29uc3QgYXR0ckFycmF5ID0gWy4uLmF0dHJpYnV0ZXNdO1xuXG4gIGlmIChwcm9qZWN0QXMgIT09IG51bGwpIHtcbiAgICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gICAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gICAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3Rvcihwcm9qZWN0QXMpWzBdO1xuICAgIGF0dHJBcnJheS5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgbGl0ZXJhbE9yQXJyYXlMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpKTtcbiAgfVxuICBpZiAoY2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpLCAuLi5jbGFzc2VzKTtcbiAgfVxuICBpZiAoc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuU3R5bGVzKSwgLi4uc3R5bGVzKTtcbiAgfVxuICBpZiAoYmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncyksIC4uLmJpbmRpbmdzKTtcbiAgfVxuICBpZiAodGVtcGxhdGUubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSksIC4uLnRlbXBsYXRlKTtcbiAgfVxuICBpZiAoaTE4bi5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkkxOG4pLCAuLi5pMThuKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsQXJyKGF0dHJBcnJheSk7XG59XG4iXX0=