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
                // TODO: Simplify and combine these cases.
                if (op.kind == ir.OpKind.Projection) {
                    const attributes = allElementAttributes.get(op.xref);
                    if (attributes !== undefined) {
                        const attrArray = serializeAttributes(attributes);
                        if (attrArray.entries.length > 0) {
                            op.attributes = attrArray;
                        }
                    }
                }
                else if (ir.isElementOrContainerOp(op)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsdUJBQXVCLEVBQUUseUJBQXlCLEVBQXNCLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkcsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxvQ0FBb0M7SUFDcEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUM3QyxNQUFNLFVBQVUsR0FDWixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNwRixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxV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RSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtsaXRlcmFsT3JBcnJheUxpdGVyYWx9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBzZW1hbnRpYyBhdHRyaWJ1dGVzIG9mIGVsZW1lbnQtbGlrZSBvcGVyYXRpb25zIChlbGVtZW50cywgdGVtcGxhdGVzKSBpbnRvIGNvbnN0YW50XG4gKiBhcnJheSBleHByZXNzaW9ucywgYW5kIGxpZnRzIHRoZW0gaW50byB0aGUgb3ZlcmFsbCBjb21wb25lbnQgYGNvbnN0c2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0RWxlbWVudENvbnN0cyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIENvbGxlY3QgYWxsIGV4dHJhY3RlZCBhdHRyaWJ1dGVzLlxuICBjb25zdCBhbGxFbGVtZW50QXR0cmlidXRlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSB7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPVxuICAgICAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuZ2V0KG9wLnRhcmdldCkgfHwgbmV3IEVsZW1lbnRBdHRyaWJ1dGVzKGpvYi5jb21wYXRpYmlsaXR5KTtcbiAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuc2V0KG9wLnRhcmdldCwgYXR0cmlidXRlcyk7XG4gICAgICAgIGF0dHJpYnV0ZXMuYWRkKG9wLmJpbmRpbmdLaW5kLCBvcC5uYW1lLCBvcC5leHByZXNzaW9uLCBvcC50cnVzdGVkVmFsdWVGbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGVzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIC8vIFRPRE86IFNpbXBsaWZ5IGFuZCBjb21iaW5lIHRoZXNlIGNhc2VzLlxuICAgICAgICBpZiAob3Aua2luZCA9PSBpci5PcEtpbmQuUHJvamVjdGlvbikge1xuICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgPSBhdHRyQXJyYXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICAgICAgb3AuYXR0cmlidXRlcyA9IGdldENvbnN0SW5kZXgoam9iLCBhbGxFbGVtZW50QXR0cmlidXRlcywgb3AueHJlZik7XG5cbiAgICAgICAgICAvLyBUT0RPKGR5bGh1bm4pOiBgQGZvcmAgbG9vcHMgd2l0aCBgQGVtcHR5YCBibG9ja3MgbmVlZCB0byBiZSBzcGVjaWFsLWNhc2VkIGhlcmUsXG4gICAgICAgICAgLy8gYmVjYXVzZSB0aGUgc2xvdCBjb25zdW1lciB0cmFpdCBjdXJyZW50bHkgb25seSBzdXBwb3J0cyBvbmUgc2xvdCBwZXIgY29uc3VtZXIgYW5kIHdlXG4gICAgICAgICAgLy8gbmVlZCB0d28uIFRoaXMgc2hvdWxkIGJlIHJldmlzaXRlZCB3aGVuIG1ha2luZyB0aGUgcmVmYWN0b3JzIG1lbnRpb25lZCBpbjpcbiAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL3B1bGwvNTM2MjAjZGlzY3Vzc2lvbl9yMTQzMDkxODgyMlxuICAgICAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGUgJiYgb3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBvcC5lbXB0eUF0dHJpYnV0ZXMgPSBnZXRDb25zdEluZGV4KGpvYiwgYWxsRWxlbWVudEF0dHJpYnV0ZXMsIG9wLmVtcHR5Vmlldyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGpvYiBpbnN0YW5jZW9mIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IpIHtcbiAgICAvLyBUT0RPOiBJZiB0aGUgaG9zdCBiaW5kaW5nIGNhc2UgZnVydGhlciBkaXZlcmdlcywgd2UgbWF5IHdhbnQgdG8gc3BsaXQgaXQgaW50byBpdHMgb3duXG4gICAgLy8gcGhhc2UuXG4gICAgZm9yIChjb25zdCBbeHJlZiwgYXR0cmlidXRlc10gb2YgYWxsRWxlbWVudEF0dHJpYnV0ZXMuZW50cmllcygpKSB7XG4gICAgICBpZiAoeHJlZiAhPT0gam9iLnJvb3QueHJlZikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQW4gYXR0cmlidXRlIHdvdWxkIGJlIGNvbnN0IGNvbGxlY3RlZCBpbnRvIHRoZSBob3N0IGJpbmRpbmcncyB0ZW1wbGF0ZSBmdW5jdGlvbiwgYnV0IGlzIG5vdCBhc3NvY2lhdGVkIHdpdGggdGhlIHJvb3QgeHJlZi5gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGF0dHJBcnJheSA9IHNlcmlhbGl6ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICBpZiAoYXR0ckFycmF5LmVudHJpZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBqb2Iucm9vdC5hdHRyaWJ1dGVzID0gYXR0ckFycmF5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb25zdEluZGV4KFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGFsbEVsZW1lbnRBdHRyaWJ1dGVzOiBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4sXG4gICAgeHJlZjogaXIuWHJlZklkKTogaXIuQ29uc3RJbmRleHxudWxsIHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmdldCh4cmVmKTtcbiAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGF0dHJBcnJheSA9IHNlcmlhbGl6ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgaWYgKGF0dHJBcnJheS5lbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBqb2IuYWRkQ29uc3QoYXR0ckFycmF5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogU2hhcmVkIGluc3RhbmNlIG9mIGFuIGVtcHR5IGFycmF5IHRvIGF2b2lkIHVubmVjZXNzYXJ5IGFycmF5IGFsbG9jYXRpb25zLlxuICovXG5jb25zdCBGTFlXRUlHSFRfQVJSQVk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiA9IE9iamVjdC5mcmVlemU8by5FeHByZXNzaW9uW10+KFtdKTtcblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBvZiB0aGUgdmFyaW91cyBraW5kcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGFyZSBhcHBsaWVkIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgcHJpdmF0ZSBrbm93biA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIFNldDxzdHJpbmc+PigpO1xuICBwcml2YXRlIGJ5S2luZCA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIG8uRXhwcmVzc2lvbltdPjtcblxuICBwcm9qZWN0QXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBnZXQgYXR0cmlidXRlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgY2xhc3NlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgc3R5bGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgYmluZGluZ3MoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgaTE4bigpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuSTE4bikgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge31cblxuICBpc0tub3duKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIGNvbnN0IG5hbWVUb1ZhbHVlID0gdGhpcy5rbm93bi5nZXQoa2luZCkgPz8gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgdGhpcy5rbm93bi5zZXQoa2luZCwgbmFtZVRvVmFsdWUpO1xuICAgIGlmIChuYW1lVG9WYWx1ZS5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBuYW1lVG9WYWx1ZS5hZGQobmFtZSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYWRkKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICAgIHRydXN0ZWRWYWx1ZUZuOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgcHV0cyBkdXBsaWNhdGUgYXR0cmlidXRlLCBjbGFzcywgYW5kIHN0eWxlIHZhbHVlcyBpbnRvIHRoZSBjb25zdHNcbiAgICAvLyBhcnJheS4gVGhpcyBzZWVtcyBpbmVmZmljaWVudCwgd2UgY2FuIHByb2JhYmx5IGtlZXAganVzdCB0aGUgZmlyc3Qgb25lIG9yIHRoZSBsYXN0IHZhbHVlXG4gICAgLy8gKHdoaWNoZXZlciBhY3R1YWxseSBnZXRzIGFwcGxpZWQgd2hlbiBtdWx0aXBsZSB2YWx1ZXMgYXJlIGxpc3RlZCBmb3IgdGhlIHNhbWUgYXR0cmlidXRlKS5cbiAgICBjb25zdCBhbGxvd0R1cGxpY2F0ZXMgPSB0aGlzLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5DbGFzc05hbWUgfHxcbiAgICAgICAgIGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpO1xuICAgIGlmICghYWxsb3dEdXBsaWNhdGVzICYmIHRoaXMuaXNLbm93bihraW5kLCBuYW1lLCB2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBpdHMgb3duIHBoYXNlXG4gICAgaWYgKG5hbWUgPT09ICduZ1Byb2plY3RBcycpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCAhKHZhbHVlIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwcikgfHwgKHZhbHVlLnZhbHVlID09IG51bGwpIHx8XG4gICAgICAgICAgKHR5cGVvZiB2YWx1ZS52YWx1ZT8udG9TdHJpbmcoKSAhPT0gJ3N0cmluZycpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCduZ1Byb2plY3RBcyBtdXN0IGhhdmUgYSBzdHJpbmcgbGl0ZXJhbCB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0QXMgPSB2YWx1ZS52YWx1ZS50b1N0cmluZygpO1xuICAgICAgLy8gVE9ETzogVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBhbGxvd3MgYG5nUHJvamVjdEFzYCB0byBhbHNvIGJlIGFzc2lnbmVkIGFzIGEgbGl0ZXJhbFxuICAgICAgLy8gYXR0cmlidXRlLiBJcyB0aGlzIHNhbmU/XG4gICAgfVxuXG5cbiAgICBjb25zdCBhcnJheSA9IHRoaXMuYXJyYXlGb3Ioa2luZCk7XG4gICAgYXJyYXkucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZSkpO1xuICAgIGlmIChraW5kID09PSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUgfHwga2luZCA9PT0gaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eSkge1xuICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdBdHRyaWJ1dGUsIGkxOG4gYXR0cmlidXRlLCAmIHN0eWxlIGVsZW1lbnQgYXR0cmlidXRlcyBtdXN0IGhhdmUgYSB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgaWYgKHRydXN0ZWRWYWx1ZUZuICE9PSBudWxsKSB7XG4gICAgICAgIGlmICghaXIuaXNTdHJpbmdMaXRlcmFsKHZhbHVlKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdBc3NlcnRpb25FcnJvcjogZXh0cmFjdGVkIGF0dHJpYnV0ZSB2YWx1ZSBzaG91bGQgYmUgc3RyaW5nIGxpdGVyYWwnKTtcbiAgICAgICAgfVxuICAgICAgICBhcnJheS5wdXNoKG8udGFnZ2VkVGVtcGxhdGUoXG4gICAgICAgICAgICB0cnVzdGVkVmFsdWVGbiwgbmV3IG8uVGVtcGxhdGVMaXRlcmFsKFtuZXcgby5UZW1wbGF0ZUxpdGVyYWxFbGVtZW50KHZhbHVlLnZhbHVlKV0sIFtdKSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgdmFsdWUuc291cmNlU3BhbikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcnJheUZvcihraW5kOiBpci5CaW5kaW5nS2luZCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBpZiAoIXRoaXMuYnlLaW5kLmhhcyhraW5kKSkge1xuICAgICAgdGhpcy5ieUtpbmQuc2V0KGtpbmQsIFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChraW5kKSE7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWwgZXhwcmVzc2lvbnMgcmVwcmVzZW50aW5nIHRoZSBhdHRyaWJ1dGUncyBuYW1lc3BhY2VkIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lOiBzdHJpbmcpOiBvLkxpdGVyYWxFeHByW10ge1xuICBjb25zdCBbYXR0cmlidXRlTmFtZXNwYWNlLCBhdHRyaWJ1dGVOYW1lXSA9IHNwbGl0TnNOYW1lKG5hbWUsIGZhbHNlKTtcbiAgY29uc3QgbmFtZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZSk7XG5cbiAgaWYgKGF0dHJpYnV0ZU5hbWVzcGFjZSkge1xuICAgIHJldHVybiBbXG4gICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJKSwgby5saXRlcmFsKGF0dHJpYnV0ZU5hbWVzcGFjZSksIG5hbWVMaXRlcmFsXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBbbmFtZUxpdGVyYWxdO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgYW4gRWxlbWVudEF0dHJpYnV0ZXMgb2JqZWN0IGludG8gYW4gYXJyYXkgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gc2VyaWFsaXplQXR0cmlidXRlcyh7YXR0cmlidXRlcywgYmluZGluZ3MsIGNsYXNzZXMsIGkxOG4sIHByb2plY3RBcywgc3R5bGVzLCB0ZW1wbGF0ZX06XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBFbGVtZW50QXR0cmlidXRlcyk6IG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGNvbnN0IGF0dHJBcnJheSA9IFsuLi5hdHRyaWJ1dGVzXTtcblxuICBpZiAocHJvamVjdEFzICE9PSBudWxsKSB7XG4gICAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAgIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICAgIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocHJvamVjdEFzKVswXTtcbiAgICBhdHRyQXJyYXkucHVzaChcbiAgICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGxpdGVyYWxPckFycmF5TGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKSk7XG4gIH1cbiAgaWYgKGNsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSwgLi4uY2xhc3Nlcyk7XG4gIH1cbiAgaWYgKHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlN0eWxlcyksIC4uLnN0eWxlcyk7XG4gIH1cbiAgaWYgKGJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpLCAuLi5iaW5kaW5ncyk7XG4gIH1cbiAgaWYgKHRlbXBsYXRlLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuVGVtcGxhdGUpLCAuLi50ZW1wbGF0ZSk7XG4gIH1cbiAgaWYgKGkxOG4ubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSwgLi4uaTE4bik7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbEFycihhdHRyQXJyYXkpO1xufVxuIl19