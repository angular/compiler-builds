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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBc0IsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2RyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFcEQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEdBQW1CO0lBQ3RELG9DQUFvQztJQUNwQyxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO0lBQ3JFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQzdDLE1BQU0sVUFBVSxHQUNaLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ3BGLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUNoRCxVQUFVLENBQUMsR0FBRyxDQUFDLEVB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QUFDO0FBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7bGl0ZXJhbE9yQXJyYXlMaXRlcmFsfSBmcm9tICcuLi9jb252ZXJzaW9uJztcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgc2VtYW50aWMgYXR0cmlidXRlcyBvZiBlbGVtZW50LWxpa2Ugb3BlcmF0aW9ucyAoZWxlbWVudHMsIHRlbXBsYXRlcykgaW50byBjb25zdGFudFxuICogYXJyYXkgZXhwcmVzc2lvbnMsIGFuZCBsaWZ0cyB0aGVtIGludG8gdGhlIG92ZXJhbGwgY29tcG9uZW50IGBjb25zdHNgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdEVsZW1lbnRDb25zdHMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBDb2xsZWN0IGFsbCBleHRyYWN0ZWQgYXR0cmlidXRlcy5cbiAgY29uc3QgYWxsRWxlbWVudEF0dHJpYnV0ZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgRWxlbWVudEF0dHJpYnV0ZXM+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID1cbiAgICAgICAgICAgIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmdldChvcC50YXJnZXQpIHx8IG5ldyBFbGVtZW50QXR0cmlidXRlcyhqb2IuY29tcGF0aWJpbGl0eSk7XG4gICAgICAgIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLnNldChvcC50YXJnZXQsIGF0dHJpYnV0ZXMpO1xuICAgICAgICBhdHRyaWJ1dGVzLmFkZChvcC5iaW5kaW5nS2luZCwgb3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3AubmFtZXNwYWNlLCBvcC50cnVzdGVkVmFsdWVGbik7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGVzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIC8vIFRPRE86IFNpbXBsaWZ5IGFuZCBjb21iaW5lIHRoZXNlIGNhc2VzLlxuICAgICAgICBpZiAob3Aua2luZCA9PSBpci5PcEtpbmQuUHJvamVjdGlvbikge1xuICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gc2VyaWFsaXplQXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcbiAgICAgICAgICAgIGlmIChhdHRyQXJyYXkuZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG9wLmF0dHJpYnV0ZXMgPSBhdHRyQXJyYXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICAgICAgb3AuYXR0cmlidXRlcyA9IGdldENvbnN0SW5kZXgoam9iLCBhbGxFbGVtZW50QXR0cmlidXRlcywgb3AueHJlZik7XG5cbiAgICAgICAgICAvLyBUT0RPKGR5bGh1bm4pOiBgQGZvcmAgbG9vcHMgd2l0aCBgQGVtcHR5YCBibG9ja3MgbmVlZCB0byBiZSBzcGVjaWFsLWNhc2VkIGhlcmUsXG4gICAgICAgICAgLy8gYmVjYXVzZSB0aGUgc2xvdCBjb25zdW1lciB0cmFpdCBjdXJyZW50bHkgb25seSBzdXBwb3J0cyBvbmUgc2xvdCBwZXIgY29uc3VtZXIgYW5kIHdlXG4gICAgICAgICAgLy8gbmVlZCB0d28uIFRoaXMgc2hvdWxkIGJlIHJldmlzaXRlZCB3aGVuIG1ha2luZyB0aGUgcmVmYWN0b3JzIG1lbnRpb25lZCBpbjpcbiAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL3B1bGwvNTM2MjAjZGlzY3Vzc2lvbl9yMTQzMDkxODgyMlxuICAgICAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGUgJiYgb3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBvcC5lbXB0eUF0dHJpYnV0ZXMgPSBnZXRDb25zdEluZGV4KGpvYiwgYWxsRWxlbWVudEF0dHJpYnV0ZXMsIG9wLmVtcHR5Vmlldyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGpvYiBpbnN0YW5jZW9mIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IpIHtcbiAgICAvLyBUT0RPOiBJZiB0aGUgaG9zdCBiaW5kaW5nIGNhc2UgZnVydGhlciBkaXZlcmdlcywgd2UgbWF5IHdhbnQgdG8gc3BsaXQgaXQgaW50byBpdHMgb3duXG4gICAgLy8gcGhhc2UuXG4gICAgZm9yIChjb25zdCBbeHJlZiwgYXR0cmlidXRlc10gb2YgYWxsRWxlbWVudEF0dHJpYnV0ZXMuZW50cmllcygpKSB7XG4gICAgICBpZiAoeHJlZiAhPT0gam9iLnJvb3QueHJlZikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQW4gYXR0cmlidXRlIHdvdWxkIGJlIGNvbnN0IGNvbGxlY3RlZCBpbnRvIHRoZSBob3N0IGJpbmRpbmcncyB0ZW1wbGF0ZSBmdW5jdGlvbiwgYnV0IGlzIG5vdCBhc3NvY2lhdGVkIHdpdGggdGhlIHJvb3QgeHJlZi5gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGF0dHJBcnJheSA9IHNlcmlhbGl6ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICBpZiAoYXR0ckFycmF5LmVudHJpZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBqb2Iucm9vdC5hdHRyaWJ1dGVzID0gYXR0ckFycmF5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb25zdEluZGV4KFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGFsbEVsZW1lbnRBdHRyaWJ1dGVzOiBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4sXG4gICAgeHJlZjogaXIuWHJlZklkKTogaXIuQ29uc3RJbmRleHxudWxsIHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmdldCh4cmVmKTtcbiAgaWYgKGF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGF0dHJBcnJheSA9IHNlcmlhbGl6ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgaWYgKGF0dHJBcnJheS5lbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBqb2IuYWRkQ29uc3QoYXR0ckFycmF5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogU2hhcmVkIGluc3RhbmNlIG9mIGFuIGVtcHR5IGFycmF5IHRvIGF2b2lkIHVubmVjZXNzYXJ5IGFycmF5IGFsbG9jYXRpb25zLlxuICovXG5jb25zdCBGTFlXRUlHSFRfQVJSQVk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiA9IE9iamVjdC5mcmVlemU8by5FeHByZXNzaW9uW10+KFtdKTtcblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBvZiB0aGUgdmFyaW91cyBraW5kcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGFyZSBhcHBsaWVkIG9uIGFuIGVsZW1lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRBdHRyaWJ1dGVzIHtcbiAgcHJpdmF0ZSBrbm93biA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIFNldDxzdHJpbmc+PigpO1xuICBwcml2YXRlIGJ5S2luZCA9IG5ldyBNYXA8aXIuQmluZGluZ0tpbmQsIG8uRXhwcmVzc2lvbltdPjtcblxuICBwcm9qZWN0QXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBnZXQgYXR0cmlidXRlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgY2xhc3NlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgc3R5bGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgYmluZGluZ3MoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5KSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBnZXQgaTE4bigpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuSTE4bikgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjb21wYXRpYmlsaXR5OiBpci5Db21wYXRpYmlsaXR5TW9kZSkge31cblxuICBpc0tub3duKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIGNvbnN0IG5hbWVUb1ZhbHVlID0gdGhpcy5rbm93bi5nZXQoa2luZCkgPz8gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgdGhpcy5rbm93bi5zZXQoa2luZCwgbmFtZVRvVmFsdWUpO1xuICAgIGlmIChuYW1lVG9WYWx1ZS5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBuYW1lVG9WYWx1ZS5hZGQobmFtZSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYWRkKGtpbmQ6IGlyLkJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCwgbmFtZXNwYWNlOiBzdHJpbmd8bnVsbCxcbiAgICAgIHRydXN0ZWRWYWx1ZUZuOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgcHV0cyBkdXBsaWNhdGUgYXR0cmlidXRlLCBjbGFzcywgYW5kIHN0eWxlIHZhbHVlcyBpbnRvIHRoZSBjb25zdHNcbiAgICAvLyBhcnJheS4gVGhpcyBzZWVtcyBpbmVmZmljaWVudCwgd2UgY2FuIHByb2JhYmx5IGtlZXAganVzdCB0aGUgZmlyc3Qgb25lIG9yIHRoZSBsYXN0IHZhbHVlXG4gICAgLy8gKHdoaWNoZXZlciBhY3R1YWxseSBnZXRzIGFwcGxpZWQgd2hlbiBtdWx0aXBsZSB2YWx1ZXMgYXJlIGxpc3RlZCBmb3IgdGhlIHNhbWUgYXR0cmlidXRlKS5cbiAgICBjb25zdCBhbGxvd0R1cGxpY2F0ZXMgPSB0aGlzLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5DbGFzc05hbWUgfHxcbiAgICAgICAgIGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpO1xuICAgIGlmICghYWxsb3dEdXBsaWNhdGVzICYmIHRoaXMuaXNLbm93bihraW5kLCBuYW1lLCB2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBpdHMgb3duIHBoYXNlXG4gICAgaWYgKG5hbWUgPT09ICduZ1Byb2plY3RBcycpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCAhKHZhbHVlIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwcikgfHwgKHZhbHVlLnZhbHVlID09IG51bGwpIHx8XG4gICAgICAgICAgKHR5cGVvZiB2YWx1ZS52YWx1ZT8udG9TdHJpbmcoKSAhPT0gJ3N0cmluZycpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCduZ1Byb2plY3RBcyBtdXN0IGhhdmUgYSBzdHJpbmcgbGl0ZXJhbCB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9qZWN0QXMgPSB2YWx1ZS52YWx1ZS50b1N0cmluZygpO1xuICAgICAgLy8gVE9ETzogVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBhbGxvd3MgYG5nUHJvamVjdEFzYCB0byBhbHNvIGJlIGFzc2lnbmVkIGFzIGEgbGl0ZXJhbFxuICAgICAgLy8gYXR0cmlidXRlLiBJcyB0aGlzIHNhbmU/XG4gICAgfVxuXG5cbiAgICBjb25zdCBhcnJheSA9IHRoaXMuYXJyYXlGb3Ioa2luZCk7XG4gICAgYXJyYXkucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZXNwYWNlLCBuYW1lKSk7XG4gICAgaWYgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSB7XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0F0dHJpYnV0ZSwgaTE4biBhdHRyaWJ1dGUsICYgc3R5bGUgZWxlbWVudCBhdHRyaWJ1dGVzIG11c3QgaGF2ZSBhIHZhbHVlJyk7XG4gICAgICB9XG4gICAgICBpZiAodHJ1c3RlZFZhbHVlRm4gIT09IG51bGwpIHtcbiAgICAgICAgaWYgKCFpci5pc1N0cmluZ0xpdGVyYWwodmFsdWUpKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBleHRyYWN0ZWQgYXR0cmlidXRlIHZhbHVlIHNob3VsZCBiZSBzdHJpbmcgbGl0ZXJhbCcpO1xuICAgICAgICB9XG4gICAgICAgIGFycmF5LnB1c2goby50YWdnZWRUZW1wbGF0ZShcbiAgICAgICAgICAgIHRydXN0ZWRWYWx1ZUZuLCBuZXcgby5UZW1wbGF0ZUxpdGVyYWwoW25ldyBvLlRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQodmFsdWUudmFsdWUpXSwgW10pLFxuICAgICAgICAgICAgdW5kZWZpbmVkLCB2YWx1ZS5zb3VyY2VTcGFuKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcnJheS5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFycmF5Rm9yKGtpbmQ6IGlyLkJpbmRpbmdLaW5kKTogby5FeHByZXNzaW9uW10ge1xuICAgIGlmICghdGhpcy5ieUtpbmQuaGFzKGtpbmQpKSB7XG4gICAgICB0aGlzLmJ5S2luZC5zZXQoa2luZCwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGtpbmQpITtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbCBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSdzIG5hbWVzcGFjZWQgbmFtZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWVzcGFjZTogc3RyaW5nfG51bGwsIG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKG5hbWUpO1xuXG4gIGlmIChuYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW28ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwobmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBhbiBFbGVtZW50QXR0cmlidXRlcyBvYmplY3QgaW50byBhbiBhcnJheSBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBzZXJpYWxpemVBdHRyaWJ1dGVzKHthdHRyaWJ1dGVzLCBiaW5kaW5ncywgY2xhc3NlcywgaTE4biwgcHJvamVjdEFzLCBzdHlsZXMsIHRlbXBsYXRlfTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEVsZW1lbnRBdHRyaWJ1dGVzKTogby5MaXRlcmFsQXJyYXlFeHByIHtcbiAgY29uc3QgYXR0ckFycmF5ID0gWy4uLmF0dHJpYnV0ZXNdO1xuXG4gIGlmIChwcm9qZWN0QXMgIT09IG51bGwpIHtcbiAgICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gICAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gICAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3Rvcihwcm9qZWN0QXMpWzBdO1xuICAgIGF0dHJBcnJheS5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgbGl0ZXJhbE9yQXJyYXlMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpKTtcbiAgfVxuICBpZiAoY2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpLCAuLi5jbGFzc2VzKTtcbiAgfVxuICBpZiAoc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuU3R5bGVzKSwgLi4uc3R5bGVzKTtcbiAgfVxuICBpZiAoYmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncyksIC4uLmJpbmRpbmdzKTtcbiAgfVxuICBpZiAodGVtcGxhdGUubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSksIC4uLnRlbXBsYXRlKTtcbiAgfVxuICBpZiAoaTE4bi5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkkxOG4pLCAuLi5pMThuKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsQXJyKGF0dHJBcnJheSk7XG59XG4iXX0=