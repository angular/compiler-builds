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
                attributes.add(op.bindingKind, op.name, op.expression);
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
        this.known = new Set();
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
    add(kind, name, value) {
        if (this.known.has(name)) {
            return;
        }
        this.known.add(name);
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
            array.push(value);
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
    const [attributeNamespace, attributeName] = splitNsName(name);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsdUJBQXVCLEVBQUUseUJBQXlCLEVBQXNCLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkcsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxvQ0FBb0M7SUFDcEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFO2dCQUM1QyxNQUFNLFVBQVUsR0FBRyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLEVBQUUsQ0FBQztnQkFDbEYsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ2hELFVBQVUsQ0FBQyxHQUFH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dEUsU0FBUyxDQUFDLElBQUksQ0FDVixDQUFDLENBQUMsT0FBTyx3Q0FBZ0MsRUFBRSxxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7S0FDekY7SUFDRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3RCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sc0NBQThCLEVBQUUsR0FBRyxPQUFPLENBQUMsQ0FBQztLQUNyRTtJQUNELElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxxQ0FBNkIsRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDO0tBQ25FO0lBQ0QsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUN2QixTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLHVDQUErQixFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7S0FDdkU7SUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sdUNBQStCLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztLQUN2RTtJQUNELElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDbkIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxtQ0FBMkIsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0tBQy9EO0lBQ0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi8uLi8uLi9jb3JlJztcbmltcG9ydCB7c3BsaXROc05hbWV9IGZyb20gJy4uLy4uLy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtsaXRlcmFsT3JBcnJheUxpdGVyYWx9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBzZW1hbnRpYyBhdHRyaWJ1dGVzIG9mIGVsZW1lbnQtbGlrZSBvcGVyYXRpb25zIChlbGVtZW50cywgdGVtcGxhdGVzKSBpbnRvIGNvbnN0YW50XG4gKiBhcnJheSBleHByZXNzaW9ucywgYW5kIGxpZnRzIHRoZW0gaW50byB0aGUgb3ZlcmFsbCBjb21wb25lbnQgYGNvbnN0c2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0RWxlbWVudENvbnN0cyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIENvbGxlY3QgYWxsIGV4dHJhY3RlZCBhdHRyaWJ1dGVzLlxuICBjb25zdCBhbGxFbGVtZW50QXR0cmlidXRlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBFbGVtZW50QXR0cmlidXRlcz4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSB7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxFbGVtZW50QXR0cmlidXRlcy5nZXQob3AudGFyZ2V0KSB8fCBuZXcgRWxlbWVudEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgYWxsRWxlbWVudEF0dHJpYnV0ZXMuc2V0KG9wLnRhcmdldCwgYXR0cmlidXRlcyk7XG4gICAgICAgIGF0dHJpYnV0ZXMuYWRkKG9wLmJpbmRpbmdLaW5kLCBvcC5uYW1lLCBvcC5leHByZXNzaW9uKTtcbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFNlcmlhbGl6ZSB0aGUgZXh0cmFjdGVkIGF0dHJpYnV0ZXMgaW50byB0aGUgY29uc3QgYXJyYXkuXG4gIGlmIChqb2IgaW5zdGFuY2VvZiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAgIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgICAgaWYgKGlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmdldChvcC54cmVmKTtcbiAgICAgICAgICBpZiAoYXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25zdCBhdHRyQXJyYXkgPSBzZXJpYWxpemVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgICAgICAgaWYgKGF0dHJBcnJheS5lbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgb3AuYXR0cmlidXRlcyA9IGpvYi5hZGRDb25zdChhdHRyQXJyYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChqb2IgaW5zdGFuY2VvZiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKSB7XG4gICAgLy8gVE9ETzogSWYgdGhlIGhvc3QgYmluZGluZyBjYXNlIGZ1cnRoZXIgZGl2ZXJnZXMsIHdlIG1heSB3YW50IHRvIHNwbGl0IGl0IGludG8gaXRzIG93blxuICAgIC8vIHBoYXNlLlxuICAgIGZvciAoY29uc3QgW3hyZWYsIGF0dHJpYnV0ZXNdIG9mIGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmVudHJpZXMoKSkge1xuICAgICAgaWYgKHhyZWYgIT09IGpvYi5yb290LnhyZWYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFuIGF0dHJpYnV0ZSB3b3VsZCBiZSBjb25zdCBjb2xsZWN0ZWQgaW50byB0aGUgaG9zdCBiaW5kaW5nJ3MgdGVtcGxhdGUgZnVuY3Rpb24sIGJ1dCBpcyBub3QgYXNzb2NpYXRlZCB3aXRoIHRoZSByb290IHhyZWYuYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBhdHRyQXJyYXkgPSBzZXJpYWxpemVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgaWYgKGF0dHJBcnJheS5lbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgam9iLnJvb3QuYXR0cmlidXRlcyA9IGF0dHJBcnJheTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTaGFyZWQgaW5zdGFuY2Ugb2YgYW4gZW1wdHkgYXJyYXkgdG8gYXZvaWQgdW5uZWNlc3NhcnkgYXJyYXkgYWxsb2NhdGlvbnMuXG4gKi9cbmNvbnN0IEZMWVdFSUdIVF9BUlJBWTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+ID0gT2JqZWN0LmZyZWV6ZTxvLkV4cHJlc3Npb25bXT4oW10pO1xuXG4vKipcbiAqIENvbnRhaW5lciBmb3IgYWxsIG9mIHRoZSB2YXJpb3VzIGtpbmRzIG9mIGF0dHJpYnV0ZXMgd2hpY2ggYXJlIGFwcGxpZWQgb24gYW4gZWxlbWVudC5cbiAqL1xuY2xhc3MgRWxlbWVudEF0dHJpYnV0ZXMge1xuICBwcml2YXRlIGtub3duID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByaXZhdGUgYnlLaW5kID0gbmV3IE1hcDxpci5CaW5kaW5nS2luZCwgby5FeHByZXNzaW9uW10+O1xuXG4gIHByb2plY3RBczogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIGdldCBhdHRyaWJ1dGVzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCBjbGFzc2VzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5DbGFzc05hbWUpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCBzdHlsZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCBiaW5kaW5ncygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuUHJvcGVydHkpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCB0ZW1wbGF0ZSgpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuVGVtcGxhdGUpID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGdldCBpMThuKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5JMThuKSA/PyBGTFlXRUlHSFRfQVJSQVk7XG4gIH1cblxuICBhZGQoa2luZDogaXIuQmluZGluZ0tpbmQsIG5hbWU6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMua25vd24uaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMua25vd24uYWRkKG5hbWUpO1xuICAgIC8vIFRPRE86IENhbiB0aGlzIGJlIGl0cyBvd24gcGhhc2VcbiAgICBpZiAobmFtZSA9PT0gJ25nUHJvamVjdEFzJykge1xuICAgICAgaWYgKHZhbHVlID09PSBudWxsIHx8ICEodmFsdWUgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByKSB8fCAodmFsdWUudmFsdWUgPT0gbnVsbCkgfHxcbiAgICAgICAgICAodHlwZW9mIHZhbHVlLnZhbHVlPy50b1N0cmluZygpICE9PSAnc3RyaW5nJykpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ25nUHJvamVjdEFzIG11c3QgaGF2ZSBhIHN0cmluZyBsaXRlcmFsIHZhbHVlJyk7XG4gICAgICB9XG4gICAgICB0aGlzLnByb2plY3RBcyA9IHZhbHVlLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAvLyBUT0RPOiBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGFsbG93cyBgbmdQcm9qZWN0QXNgIHRvIGFsc28gYmUgYXNzaWduZWQgYXMgYSBsaXRlcmFsXG4gICAgICAvLyBhdHRyaWJ1dGUuIElzIHRoaXMgc2FuZT9cbiAgICB9XG5cblxuICAgIGNvbnN0IGFycmF5ID0gdGhpcy5hcnJheUZvcihraW5kKTtcbiAgICBhcnJheS5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lKSk7XG4gICAgaWYgKGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSB8fCBraW5kID09PSBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5KSB7XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0F0dHJpYnV0ZSwgaTE4biBhdHRyaWJ1dGUsICYgc3R5bGUgZWxlbWVudCBhdHRyaWJ1dGVzIG11c3QgaGF2ZSBhIHZhbHVlJyk7XG4gICAgICB9XG4gICAgICBhcnJheS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFycmF5Rm9yKGtpbmQ6IGlyLkJpbmRpbmdLaW5kKTogby5FeHByZXNzaW9uW10ge1xuICAgIGlmICghdGhpcy5ieUtpbmQuaGFzKGtpbmQpKSB7XG4gICAgICB0aGlzLmJ5S2luZC5zZXQoa2luZCwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGtpbmQpITtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbCBleHByZXNzaW9ucyByZXByZXNlbnRpbmcgdGhlIGF0dHJpYnV0ZSdzIG5hbWVzcGFjZWQgbmFtZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemVzIGFuIEVsZW1lbnRBdHRyaWJ1dGVzIG9iamVjdCBpbnRvIGFuIGFycmF5IGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIHNlcmlhbGl6ZUF0dHJpYnV0ZXMoe2F0dHJpYnV0ZXMsIGJpbmRpbmdzLCBjbGFzc2VzLCBpMThuLCBwcm9qZWN0QXMsIHN0eWxlcywgdGVtcGxhdGV9OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRWxlbWVudEF0dHJpYnV0ZXMpOiBvLkxpdGVyYWxBcnJheUV4cHIge1xuICBjb25zdCBhdHRyQXJyYXkgPSBbLi4uYXR0cmlidXRlc107XG5cbiAgaWYgKHByb2plY3RBcyAhPT0gbnVsbCkge1xuICAgIC8vIFBhcnNlIHRoZSBhdHRyaWJ1dGUgdmFsdWUgaW50byBhIENzc1NlbGVjdG9yTGlzdC4gTm90ZSB0aGF0IHdlIG9ubHkgdGFrZSB0aGVcbiAgICAvLyBmaXJzdCBzZWxlY3RvciwgYmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IG11bHRpcGxlIHNlbGVjdG9ycyBpbiBuZ1Byb2plY3RBcy5cbiAgICBjb25zdCBwYXJzZWRSM1NlbGVjdG9yID0gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHByb2plY3RBcylbMF07XG4gICAgYXR0ckFycmF5LnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5Qcm9qZWN0QXMpLCBsaXRlcmFsT3JBcnJheUxpdGVyYWwocGFyc2VkUjNTZWxlY3RvcikpO1xuICB9XG4gIGlmIChjbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQ2xhc3NlcyksIC4uLmNsYXNzZXMpO1xuICB9XG4gIGlmIChzdHlsZXMubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpLCAuLi5zdHlsZXMpO1xuICB9XG4gIGlmIChiaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzKSwgLi4uYmluZGluZ3MpO1xuICB9XG4gIGlmICh0ZW1wbGF0ZS5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSwgLi4udGVtcGxhdGUpO1xuICB9XG4gIGlmIChpMThuLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuSTE4biksIC4uLmkxOG4pO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWxBcnIoYXR0ckFycmF5KTtcbn1cbiJdfQ==