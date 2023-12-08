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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2NvbnN0X2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDdkQsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQUMsdUJBQXVCLEVBQUUseUJBQXlCLEVBQXNCLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkcsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxvQ0FBb0M7SUFDcEMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUM3QyxNQUFNLFVBQVUsR0FBRyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLEVBQUUsQ0FBQztnQkFDbEYsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ2hE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TyxtQ0FBMkIsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2xpdGVyYWxPckFycmF5TGl0ZXJhbH0gZnJvbSAnLi4vY29udmVyc2lvbic7XG5cbi8qKlxuICogQ29udmVydHMgdGhlIHNlbWFudGljIGF0dHJpYnV0ZXMgb2YgZWxlbWVudC1saWtlIG9wZXJhdGlvbnMgKGVsZW1lbnRzLCB0ZW1wbGF0ZXMpIGludG8gY29uc3RhbnRcbiAqIGFycmF5IGV4cHJlc3Npb25zLCBhbmQgbGlmdHMgdGhlbSBpbnRvIHRoZSBvdmVyYWxsIGNvbXBvbmVudCBgY29uc3RzYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbGxlY3RFbGVtZW50Q29uc3RzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gQ29sbGVjdCBhbGwgZXh0cmFjdGVkIGF0dHJpYnV0ZXMuXG4gIGNvbnN0IGFsbEVsZW1lbnRBdHRyaWJ1dGVzID0gbmV3IE1hcDxpci5YcmVmSWQsIEVsZW1lbnRBdHRyaWJ1dGVzPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IGFsbEVsZW1lbnRBdHRyaWJ1dGVzLmdldChvcC50YXJnZXQpIHx8IG5ldyBFbGVtZW50QXR0cmlidXRlcygpO1xuICAgICAgICBhbGxFbGVtZW50QXR0cmlidXRlcy5zZXQob3AudGFyZ2V0LCBhdHRyaWJ1dGVzKTtcbiAgICAgICAgYXR0cmlidXRlcy5hZGQob3AuYmluZGluZ0tpbmQsIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24pO1xuICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU2VyaWFsaXplIHRoZSBleHRyYWN0ZWQgYXR0cmlidXRlcyBpbnRvIHRoZSBjb25zdCBhcnJheS5cbiAgaWYgKGpvYiBpbnN0YW5jZW9mIENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gICAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgICBpZiAoaXIuaXNFbGVtZW50T3JDb250YWluZXJPcChvcCkpIHtcbiAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gYWxsRWxlbWVudEF0dHJpYnV0ZXMuZ2V0KG9wLnhyZWYpO1xuICAgICAgICAgIGlmIChhdHRyaWJ1dGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGF0dHJBcnJheSA9IHNlcmlhbGl6ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICAgICAgICBpZiAoYXR0ckFycmF5LmVudHJpZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBvcC5hdHRyaWJ1dGVzID0gam9iLmFkZENvbnN0KGF0dHJBcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGpvYiBpbnN0YW5jZW9mIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IpIHtcbiAgICAvLyBUT0RPOiBJZiB0aGUgaG9zdCBiaW5kaW5nIGNhc2UgZnVydGhlciBkaXZlcmdlcywgd2UgbWF5IHdhbnQgdG8gc3BsaXQgaXQgaW50byBpdHMgb3duXG4gICAgLy8gcGhhc2UuXG4gICAgZm9yIChjb25zdCBbeHJlZiwgYXR0cmlidXRlc10gb2YgYWxsRWxlbWVudEF0dHJpYnV0ZXMuZW50cmllcygpKSB7XG4gICAgICBpZiAoeHJlZiAhPT0gam9iLnJvb3QueHJlZikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQW4gYXR0cmlidXRlIHdvdWxkIGJlIGNvbnN0IGNvbGxlY3RlZCBpbnRvIHRoZSBob3N0IGJpbmRpbmcncyB0ZW1wbGF0ZSBmdW5jdGlvbiwgYnV0IGlzIG5vdCBhc3NvY2lhdGVkIHdpdGggdGhlIHJvb3QgeHJlZi5gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGF0dHJBcnJheSA9IHNlcmlhbGl6ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICBpZiAoYXR0ckFycmF5LmVudHJpZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBqb2Iucm9vdC5hdHRyaWJ1dGVzID0gYXR0ckFycmF5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFNoYXJlZCBpbnN0YW5jZSBvZiBhbiBlbXB0eSBhcnJheSB0byBhdm9pZCB1bm5lY2Vzc2FyeSBhcnJheSBhbGxvY2F0aW9ucy5cbiAqL1xuY29uc3QgRkxZV0VJR0hUX0FSUkFZOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4gPSBPYmplY3QuZnJlZXplPG8uRXhwcmVzc2lvbltdPihbXSk7XG5cbi8qKlxuICogQ29udGFpbmVyIGZvciBhbGwgb2YgdGhlIHZhcmlvdXMga2luZHMgb2YgYXR0cmlidXRlcyB3aGljaCBhcmUgYXBwbGllZCBvbiBhbiBlbGVtZW50LlxuICovXG5jbGFzcyBFbGVtZW50QXR0cmlidXRlcyB7XG4gIHByaXZhdGUga25vd24gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcHJpdmF0ZSBieUtpbmQgPSBuZXcgTWFwPGlyLkJpbmRpbmdLaW5kLCBvLkV4cHJlc3Npb25bXT47XG5cbiAgcHJvamVjdEFzOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgZ2V0IGF0dHJpYnV0ZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGNsYXNzZXMoKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IHN0eWxlcygpOiBSZWFkb25seUFycmF5PG8uRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGJpbmRpbmdzKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IHRlbXBsYXRlKCk6IFJlYWRvbmx5QXJyYXk8by5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuYnlLaW5kLmdldChpci5CaW5kaW5nS2luZC5UZW1wbGF0ZSkgPz8gRkxZV0VJR0hUX0FSUkFZO1xuICB9XG5cbiAgZ2V0IGkxOG4oKTogUmVhZG9ubHlBcnJheTxvLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5ieUtpbmQuZ2V0KGlyLkJpbmRpbmdLaW5kLkkxOG4pID8/IEZMWVdFSUdIVF9BUlJBWTtcbiAgfVxuXG4gIGFkZChraW5kOiBpci5CaW5kaW5nS2luZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5rbm93bi5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5rbm93bi5hZGQobmFtZSk7XG4gICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgaXRzIG93biBwaGFzZVxuICAgIGlmIChuYW1lID09PSAnbmdQcm9qZWN0QXMnKSB7XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgISh2YWx1ZSBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIpIHx8ICh2YWx1ZS52YWx1ZSA9PSBudWxsKSB8fFxuICAgICAgICAgICh0eXBlb2YgdmFsdWUudmFsdWU/LnRvU3RyaW5nKCkgIT09ICdzdHJpbmcnKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignbmdQcm9qZWN0QXMgbXVzdCBoYXZlIGEgc3RyaW5nIGxpdGVyYWwgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvamVjdEFzID0gdmFsdWUudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIC8vIFRPRE86IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgYWxsb3dzIGBuZ1Byb2plY3RBc2AgdG8gYWxzbyBiZSBhc3NpZ25lZCBhcyBhIGxpdGVyYWxcbiAgICAgIC8vIGF0dHJpYnV0ZS4gSXMgdGhpcyBzYW5lP1xuICAgIH1cblxuXG4gICAgY29uc3QgYXJyYXkgPSB0aGlzLmFycmF5Rm9yKGtpbmQpO1xuICAgIGFycmF5LnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWUpKTtcbiAgICBpZiAoa2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlIHx8IGtpbmQgPT09IGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHkpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQXR0cmlidXRlLCBpMThuIGF0dHJpYnV0ZSwgJiBzdHlsZSBlbGVtZW50IGF0dHJpYnV0ZXMgbXVzdCBoYXZlIGEgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIGFycmF5LnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXJyYXlGb3Ioa2luZDogaXIuQmluZGluZ0tpbmQpOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgaWYgKCF0aGlzLmJ5S2luZC5oYXMoa2luZCkpIHtcbiAgICAgIHRoaXMuYnlLaW5kLnNldChraW5kLCBbXSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ5S2luZC5nZXQoa2luZCkhO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyBhbiBhcnJheSBvZiBsaXRlcmFsIGV4cHJlc3Npb25zIHJlcHJlc2VudGluZyB0aGUgYXR0cmlidXRlJ3MgbmFtZXNwYWNlZCBuYW1lLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZTogc3RyaW5nKTogby5MaXRlcmFsRXhwcltdIHtcbiAgY29uc3QgW2F0dHJpYnV0ZU5hbWVzcGFjZSwgYXR0cmlidXRlTmFtZV0gPSBzcGxpdE5zTmFtZShuYW1lKTtcbiAgY29uc3QgbmFtZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZSk7XG5cbiAgaWYgKGF0dHJpYnV0ZU5hbWVzcGFjZSkge1xuICAgIHJldHVybiBbXG4gICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJKSwgby5saXRlcmFsKGF0dHJpYnV0ZU5hbWVzcGFjZSksIG5hbWVMaXRlcmFsXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBbbmFtZUxpdGVyYWxdO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgYW4gRWxlbWVudEF0dHJpYnV0ZXMgb2JqZWN0IGludG8gYW4gYXJyYXkgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gc2VyaWFsaXplQXR0cmlidXRlcyh7YXR0cmlidXRlcywgYmluZGluZ3MsIGNsYXNzZXMsIGkxOG4sIHByb2plY3RBcywgc3R5bGVzLCB0ZW1wbGF0ZX06XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBFbGVtZW50QXR0cmlidXRlcyk6IG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGNvbnN0IGF0dHJBcnJheSA9IFsuLi5hdHRyaWJ1dGVzXTtcblxuICBpZiAocHJvamVjdEFzICE9PSBudWxsKSB7XG4gICAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAgIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICAgIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocHJvamVjdEFzKVswXTtcbiAgICBhdHRyQXJyYXkucHVzaChcbiAgICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGxpdGVyYWxPckFycmF5TGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKSk7XG4gIH1cbiAgaWYgKGNsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSwgLi4uY2xhc3Nlcyk7XG4gIH1cbiAgaWYgKHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgYXR0ckFycmF5LnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlN0eWxlcyksIC4uLnN0eWxlcyk7XG4gIH1cbiAgaWYgKGJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpLCAuLi5iaW5kaW5ncyk7XG4gIH1cbiAgaWYgKHRlbXBsYXRlLmxlbmd0aCA+IDApIHtcbiAgICBhdHRyQXJyYXkucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuVGVtcGxhdGUpLCAuLi50ZW1wbGF0ZSk7XG4gIH1cbiAgaWYgKGkxOG4ubGVuZ3RoID4gMCkge1xuICAgIGF0dHJBcnJheS5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSwgLi4uaTE4bik7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbEFycihhdHRyQXJyYXkpO1xufVxuIl19