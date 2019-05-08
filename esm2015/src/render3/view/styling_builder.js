import { Interpolation } from '../../expression_parser/ast';
import * as o from '../../output/output_ast';
import { isEmptyExpression } from '../../template_parser/template_parser';
import { Identifiers as R3 } from '../r3_identifiers';
import { parse as parseStyle } from './style_parser';
const IMPORTANT_FLAG = '!important';
/**
 * Produces creation/update instructions for all styling bindings (class and style)
 *
 * It also produces the creation instruction to register all initial styling values
 * (which are all the static class="..." and style="..." attribute values that exist
 * on an element within a template).
 *
 * The builder class below handles producing instructions for the following cases:
 *
 * - Static style/class attributes (style="..." and class="...")
 * - Dynamic style/class map bindings ([style]="map" and [class]="map|string")
 * - Dynamic style/class property bindings ([style.prop]="exp" and [class.name]="exp")
 *
 * Due to the complex relationship of all of these cases, the instructions generated
 * for these attributes/properties/bindings must be done so in the correct order. The
 * order which these must be generated is as follows:
 *
 * if (createMode) {
 *   elementStyling(...)
 * }
 * if (updateMode) {
 *   elementStyleMap(...)
 *   elementClassMap(...)
 *   elementStyleProp(...)
 *   elementClassProp(...)
 *   elementStylingApp(...)
 * }
 *
 * The creation/update methods within the builder class produce these instructions.
 */
export class StylingBuilder {
    constructor(_elementIndexExpr, _directiveExpr) {
        this._elementIndexExpr = _elementIndexExpr;
        this._directiveExpr = _directiveExpr;
        /** Whether or not there are any static styling values present */
        this._hasInitialValues = false;
        /**
         *  Whether or not there are any styling bindings present
         *  (i.e. `[style]`, `[class]`, `[style.prop]` or `[class.name]`)
         */
        this.hasBindings = false;
        /** the input for [class] (if it exists) */
        this._classMapInput = null;
        /** the input for [style] (if it exists) */
        this._styleMapInput = null;
        /** an array of each [style.prop] input */
        this._singleStyleInputs = null;
        /** an array of each [class.name] input */
        this._singleClassInputs = null;
        this._lastStylingInput = null;
        // maps are used instead of hash maps because a Map will
        // retain the ordering of the keys
        /**
         * Represents the location of each style binding in the template
         * (e.g. `<div [style.width]="w" [style.height]="h">` implies
         * that `width=0` and `height=1`)
         */
        this._stylesIndex = new Map();
        /**
         * Represents the location of each class binding in the template
         * (e.g. `<div [class.big]="b" [class.hidden]="h">` implies
         * that `big=0` and `hidden=1`)
         */
        this._classesIndex = new Map();
        this._initialStyleValues = [];
        this._initialClassValues = [];
        // certain style properties ALWAYS need sanitization
        // this is checked each time new styles are encountered
        this._useDefaultSanitizer = false;
    }
    /**
     * Registers a given input to the styling builder to be later used when producing AOT code.
     *
     * The code below will only accept the input if it is somehow tied to styling (whether it be
     * style/class bindings or static style/class attributes).
     */
    registerBoundInput(input) {
        // [attr.style] or [attr.class] are skipped in the code below,
        // they should not be treated as styling-based bindings since
        // they are intended to be written directly to the attr and
        // will therefore skip all style/class resolution that is present
        // with style="", [style]="" and [style.prop]="", class="",
        // [class.prop]="". [class]="" assignments
        let binding = null;
        let name = input.name;
        switch (input.type) {
            case 0 /* Property */:
                binding = this.registerInputBasedOnName(name, input.value, input.sourceSpan);
                break;
            case 3 /* Style */:
                binding = this.registerStyleInput(name, false, input.value, input.sourceSpan, input.unit);
                break;
            case 2 /* Class */:
                binding = this.registerClassInput(name, false, input.value, input.sourceSpan);
                break;
        }
        return binding ? true : false;
    }
    registerInputBasedOnName(name, expression, sourceSpan) {
        let binding = null;
        const nameToMatch = name.substring(0, 5); // class | style
        const isStyle = nameToMatch === 'style';
        const isClass = isStyle ? false : (nameToMatch === 'class');
        if (isStyle || isClass) {
            const isMapBased = name.charAt(5) !== '.'; // style.prop or class.prop makes this a no
            const property = name.substr(isMapBased ? 5 : 6); // the dot explains why there's a +1
            if (isStyle) {
                binding = this.registerStyleInput(property, isMapBased, expression, sourceSpan);
            }
            else {
                binding = this.registerClassInput(property, isMapBased, expression, sourceSpan);
            }
        }
        return binding;
    }
    registerStyleInput(name, isMapBased, value, sourceSpan, unit) {
        if (isEmptyExpression(value)) {
            return null;
        }
        const { property, hasOverrideFlag, unit: bindingUnit } = parseProperty(name);
        const entry = {
            name: property,
            unit: unit || bindingUnit, value, sourceSpan, hasOverrideFlag
        };
        if (isMapBased) {
            this._useDefaultSanitizer = true;
            this._styleMapInput = entry;
        }
        else {
            (this._singleStyleInputs = this._singleStyleInputs || []).push(entry);
            this._useDefaultSanitizer = this._useDefaultSanitizer || isStyleSanitizable(name);
            registerIntoMap(this._stylesIndex, property);
        }
        this._lastStylingInput = entry;
        this.hasBindings = true;
        return entry;
    }
    registerClassInput(name, isMapBased, value, sourceSpan) {
        if (isEmptyExpression(value)) {
            return null;
        }
        const { property, hasOverrideFlag } = parseProperty(name);
        const entry = { name: property, value, sourceSpan, hasOverrideFlag, unit: null };
        if (isMapBased) {
            this._classMapInput = entry;
        }
        else {
            (this._singleClassInputs = this._singleClassInputs || []).push(entry);
            registerIntoMap(this._classesIndex, property);
        }
        this._lastStylingInput = entry;
        this.hasBindings = true;
        return entry;
    }
    /**
     * Registers the element's static style string value to the builder.
     *
     * @param value the style string (e.g. `width:100px; height:200px;`)
     */
    registerStyleAttr(value) {
        this._initialStyleValues = parseStyle(value);
        this._hasInitialValues = true;
    }
    /**
     * Registers the element's static class string value to the builder.
     *
     * @param value the className string (e.g. `disabled gold zoom`)
     */
    registerClassAttr(value) {
        this._initialClassValues = value.trim().split(/\s+/g);
        this._hasInitialValues = true;
    }
    /**
     * Appends all styling-related expressions to the provided attrs array.
     *
     * @param attrs an existing array where each of the styling expressions
     * will be inserted into.
     */
    populateInitialStylingAttrs(attrs) {
        // [CLASS_MARKER, 'foo', 'bar', 'baz' ...]
        if (this._initialClassValues.length) {
            attrs.push(o.literal(1 /* Classes */));
            for (let i = 0; i < this._initialClassValues.length; i++) {
                attrs.push(o.literal(this._initialClassValues[i]));
            }
        }
        // [STYLE_MARKER, 'width', '200px', 'height', '100px', ...]
        if (this._initialStyleValues.length) {
            attrs.push(o.literal(2 /* Styles */));
            for (let i = 0; i < this._initialStyleValues.length; i += 2) {
                attrs.push(o.literal(this._initialStyleValues[i]), o.literal(this._initialStyleValues[i + 1]));
            }
        }
    }
    /**
     * Builds an instruction with all the expressions and parameters for `elementHostAttrs`.
     *
     * The instruction generation code below is used for producing the AOT statement code which is
     * responsible for registering initial styles (within a directive hostBindings' creation block),
     * as well as any of the provided attribute values, to the directive host element.
     */
    buildHostAttrsInstruction(sourceSpan, attrs, constantPool) {
        if (this._directiveExpr && (attrs.length || this._hasInitialValues)) {
            return {
                sourceSpan,
                reference: R3.elementHostAttrs,
                allocateBindingSlots: 0,
                buildParams: () => {
                    // params => elementHostAttrs(agetDirectiveContext()ttrs)
                    this.populateInitialStylingAttrs(attrs);
                    const attrArray = !attrs.some(attr => attr instanceof o.WrappedNodeExpr) ?
                        getConstantLiteralFromArray(constantPool, attrs) :
                        o.literalArr(attrs);
                    return [attrArray];
                }
            };
        }
        return null;
    }
    /**
     * Builds an instruction with all the expressions and parameters for `elementStyling`.
     *
     * The instruction generation code below is used for producing the AOT statement code which is
     * responsible for registering style/class bindings to an element.
     */
    buildElementStylingInstruction(sourceSpan, constantPool) {
        const reference = this._directiveExpr ? R3.elementHostStyling : R3.elementStyling;
        if (this.hasBindings) {
            return {
                sourceSpan,
                allocateBindingSlots: 0, reference,
                buildParams: () => {
                    // a string array of every style-based binding
                    const styleBindingProps = this._singleStyleInputs ? this._singleStyleInputs.map(i => o.literal(i.name)) : [];
                    // a string array of every class-based binding
                    const classBindingNames = this._singleClassInputs ? this._singleClassInputs.map(i => o.literal(i.name)) : [];
                    // to salvage space in the AOT generated code, there is no point in passing
                    // in `null` into a param if any follow-up params are not used. Therefore,
                    // only when a trailing param is used then it will be filled with nulls in between
                    // (otherwise a shorter amount of params will be filled). The code below helps
                    // determine how many params are required in the expression code.
                    //
                    // HOST:
                    //   min params => elementHostStyling()
                    //   max params => elementHostStyling(classBindings, styleBindings, sanitizer)
                    //
                    // Template:
                    //   min params => elementStyling()
                    //   max params => elementStyling(classBindings, styleBindings, sanitizer)
                    //
                    const params = [];
                    let expectedNumberOfArgs = 0;
                    if (this._useDefaultSanitizer) {
                        expectedNumberOfArgs = 3;
                    }
                    else if (styleBindingProps.length) {
                        expectedNumberOfArgs = 2;
                    }
                    else if (classBindingNames.length) {
                        expectedNumberOfArgs = 1;
                    }
                    addParam(params, classBindingNames.length > 0, getConstantLiteralFromArray(constantPool, classBindingNames), 1, expectedNumberOfArgs);
                    addParam(params, styleBindingProps.length > 0, getConstantLiteralFromArray(constantPool, styleBindingProps), 2, expectedNumberOfArgs);
                    addParam(params, this._useDefaultSanitizer, o.importExpr(R3.defaultStyleSanitizer), 3, expectedNumberOfArgs);
                    return params;
                }
            };
        }
        return null;
    }
    /**
     * Builds an instruction with all the expressions and parameters for `elementClassMap`.
     *
     * The instruction data will contain all expressions for `elementClassMap` to function
     * which includes the `[class]` expression params.
     */
    buildElementClassMapInstruction(valueConverter) {
        if (this._classMapInput) {
            return this._buildMapBasedInstruction(valueConverter, true, this._classMapInput);
        }
        return null;
    }
    /**
     * Builds an instruction with all the expressions and parameters for `elementStyleMap`.
     *
     * The instruction data will contain all expressions for `elementStyleMap` to function
     * which includes the `[style]` expression params.
     */
    buildElementStyleMapInstruction(valueConverter) {
        if (this._styleMapInput) {
            return this._buildMapBasedInstruction(valueConverter, false, this._styleMapInput);
        }
        return null;
    }
    _buildMapBasedInstruction(valueConverter, isClassBased, stylingInput) {
        let totalBindingSlotsRequired = 0;
        // these values must be outside of the update block so that they can
        // be evaluated (the AST visit call) during creation time so that any
        // pipes can be picked up in time before the template is built
        const mapValue = stylingInput.value.visit(valueConverter);
        if (mapValue instanceof Interpolation) {
            totalBindingSlotsRequired += mapValue.expressions.length;
        }
        const isHostBinding = this._directiveExpr;
        let reference;
        if (isClassBased) {
            reference = isHostBinding ? R3.elementHostClassMap : R3.elementClassMap;
        }
        else {
            reference = isHostBinding ? R3.elementHostStyleMap : R3.elementStyleMap;
        }
        return {
            sourceSpan: stylingInput.sourceSpan,
            reference,
            allocateBindingSlots: totalBindingSlotsRequired,
            buildParams: (convertFn) => { return [convertFn(mapValue)]; }
        };
    }
    _buildSingleInputs(reference, inputs, mapIndex, allowUnits, valueConverter) {
        let totalBindingSlotsRequired = 0;
        return inputs.map(input => {
            const bindingIndex = mapIndex.get(input.name);
            const value = input.value.visit(valueConverter);
            totalBindingSlotsRequired += (value instanceof Interpolation) ? value.expressions.length : 0;
            return {
                sourceSpan: input.sourceSpan,
                allocateBindingSlots: totalBindingSlotsRequired, reference,
                buildParams: (convertFn) => {
                    // HOST:
                    //   min params => elementHostStylingProp(bindingIndex, value)
                    //   max params => elementHostStylingProp(bindingIndex, value, overrideFlag)
                    // Template:
                    //   min params => elementStylingProp(elmIndex, bindingIndex, value)
                    //   max params => elementStylingProp(elmIndex, bindingIndex, value, overrideFlag)
                    const params = [];
                    params.push(o.literal(bindingIndex));
                    params.push(convertFn(value));
                    if (allowUnits) {
                        if (input.unit) {
                            params.push(o.literal(input.unit));
                        }
                        else if (input.hasOverrideFlag) {
                            params.push(o.NULL_EXPR);
                        }
                    }
                    if (input.hasOverrideFlag) {
                        params.push(o.literal(true));
                    }
                    return params;
                }
            };
        });
    }
    _buildClassInputs(valueConverter) {
        if (this._singleClassInputs) {
            const isHostBinding = !!this._directiveExpr;
            const reference = isHostBinding ? R3.elementHostClassProp : R3.elementClassProp;
            return this._buildSingleInputs(reference, this._singleClassInputs, this._classesIndex, false, valueConverter);
        }
        return [];
    }
    _buildStyleInputs(valueConverter) {
        if (this._singleStyleInputs) {
            const isHostBinding = !!this._directiveExpr;
            const reference = isHostBinding ? R3.elementHostStyleProp : R3.elementStyleProp;
            return this._buildSingleInputs(reference, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
        }
        return [];
    }
    _buildApplyFn() {
        const isHostBinding = this._directiveExpr;
        const reference = isHostBinding ? R3.elementHostStylingApply : R3.elementStylingApply;
        return {
            sourceSpan: this._lastStylingInput ? this._lastStylingInput.sourceSpan : null,
            reference,
            allocateBindingSlots: 0,
            buildParams: () => { return []; }
        };
    }
    /**
     * Constructs all instructions which contain the expressions that will be placed
     * into the update block of a template function or a directive hostBindings function.
     */
    buildUpdateLevelInstructions(valueConverter) {
        const instructions = [];
        if (this.hasBindings) {
            const styleMapInstruction = this.buildElementStyleMapInstruction(valueConverter);
            if (styleMapInstruction) {
                instructions.push(styleMapInstruction);
            }
            const classMapInstruction = this.buildElementClassMapInstruction(valueConverter);
            if (classMapInstruction) {
                instructions.push(classMapInstruction);
            }
            instructions.push(...this._buildStyleInputs(valueConverter));
            instructions.push(...this._buildClassInputs(valueConverter));
            instructions.push(this._buildApplyFn());
        }
        return instructions;
    }
}
function registerIntoMap(map, key) {
    if (!map.has(key)) {
        map.set(key, map.size);
    }
}
function isStyleSanitizable(prop) {
    // Note that browsers support both the dash case and
    // camel case property names when setting through JS.
    return prop === 'background-image' || prop === 'backgroundImage' || prop === 'background' ||
        prop === 'border-image' || prop === 'borderImage' || prop === 'filter' ||
        prop === 'list-style' || prop === 'listStyle' || prop === 'list-style-image' ||
        prop === 'listStyleImage';
}
/**
 * Simple helper function to either provide the constant literal that will house the value
 * here or a null value if the provided values are empty.
 */
function getConstantLiteralFromArray(constantPool, values) {
    return values.length ? constantPool.getConstLiteral(o.literalArr(values), true) : o.NULL_EXPR;
}
/**
 * Simple helper function that adds a parameter or does nothing at all depending on the provided
 * predicate and totalExpectedArgs values
 */
function addParam(params, predicate, value, argNumber, totalExpectedArgs) {
    if (predicate && value) {
        params.push(value);
    }
    else if (argNumber < totalExpectedArgs) {
        params.push(o.NULL_EXPR);
    }
}
export function parseProperty(name) {
    let hasOverrideFlag = false;
    const overrideIndex = name.indexOf(IMPORTANT_FLAG);
    if (overrideIndex !== -1) {
        name = overrideIndex > 0 ? name.substring(0, overrideIndex) : '';
        hasOverrideFlag = true;
    }
    let unit = '';
    let property = name;
    const unitIndex = name.lastIndexOf('.');
    if (unitIndex > 0) {
        unit = name.substr(unitIndex + 1);
        property = name.substring(0, unitIndex);
    }
    return { property, unit, hasOverrideFlag };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFtQixhQUFhLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUM1RSxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRXhFLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUduRCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUF1QnBDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTZCRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBMEN6QixZQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUF6QzlGLGlFQUFpRTtRQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDbEM7OztXQUdHO1FBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFFM0IsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwyQ0FBMkM7UUFDbkMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQ3RELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQzVELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQ3BELHNCQUFpQixHQUEyQixJQUFJLENBQUM7UUFFekQsd0RBQXdEO1FBQ3hELGtDQUFrQztRQUVsQzs7OztXQUlH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dCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7QXR0cmlidXRlTWFya2VyfSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBCaW5kaW5nVHlwZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc0VtcHR5RXhwcmVzc2lvbn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3BhcnNlcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7cGFyc2UgYXMgcGFyc2VTdHlsZX0gZnJvbSAnLi9zdHlsZV9wYXJzZXInO1xuaW1wb3J0IHtWYWx1ZUNvbnZlcnRlcn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5cbmNvbnN0IElNUE9SVEFOVF9GTEFHID0gJyFpbXBvcnRhbnQnO1xuXG4vKipcbiAqIEEgc3R5bGluZyBleHByZXNzaW9uIHN1bW1hcnkgdGhhdCBpcyB0byBiZSBwcm9jZXNzZWQgYnkgdGhlIGNvbXBpbGVyXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5zdHJ1Y3Rpb24ge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBhbGxvY2F0ZUJpbmRpbmdTbG90czogbnVtYmVyO1xuICBidWlsZFBhcmFtcyhjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuLyoqXG4gKiBBbiBpbnRlcm5hbCByZWNvcmQgb2YgdGhlIGlucHV0IGRhdGEgZm9yIGEgc3R5bGluZyBiaW5kaW5nXG4gKi9cbmludGVyZmFjZSBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbjtcbiAgbmFtZTogc3RyaW5nfG51bGw7XG4gIHVuaXQ6IHN0cmluZ3xudWxsO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cbi8qKlxuICogUHJvZHVjZXMgY3JlYXRpb24vdXBkYXRlIGluc3RydWN0aW9ucyBmb3IgYWxsIHN0eWxpbmcgYmluZGluZ3MgKGNsYXNzIGFuZCBzdHlsZSlcbiAqXG4gKiBJdCBhbHNvIHByb2R1Y2VzIHRoZSBjcmVhdGlvbiBpbnN0cnVjdGlvbiB0byByZWdpc3RlciBhbGwgaW5pdGlhbCBzdHlsaW5nIHZhbHVlc1xuICogKHdoaWNoIGFyZSBhbGwgdGhlIHN0YXRpYyBjbGFzcz1cIi4uLlwiIGFuZCBzdHlsZT1cIi4uLlwiIGF0dHJpYnV0ZSB2YWx1ZXMgdGhhdCBleGlzdFxuICogb24gYW4gZWxlbWVudCB3aXRoaW4gYSB0ZW1wbGF0ZSkuXG4gKlxuICogVGhlIGJ1aWxkZXIgY2xhc3MgYmVsb3cgaGFuZGxlcyBwcm9kdWNpbmcgaW5zdHJ1Y3Rpb25zIGZvciB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICpcbiAqIC0gU3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMgKHN0eWxlPVwiLi4uXCIgYW5kIGNsYXNzPVwiLi4uXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgbWFwIGJpbmRpbmdzIChbc3R5bGVdPVwibWFwXCIgYW5kIFtjbGFzc109XCJtYXB8c3RyaW5nXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgcHJvcGVydHkgYmluZGluZ3MgKFtzdHlsZS5wcm9wXT1cImV4cFwiIGFuZCBbY2xhc3MubmFtZV09XCJleHBcIilcbiAqXG4gKiBEdWUgdG8gdGhlIGNvbXBsZXggcmVsYXRpb25zaGlwIG9mIGFsbCBvZiB0aGVzZSBjYXNlcywgdGhlIGluc3RydWN0aW9ucyBnZW5lcmF0ZWRcbiAqIGZvciB0aGVzZSBhdHRyaWJ1dGVzL3Byb3BlcnRpZXMvYmluZGluZ3MgbXVzdCBiZSBkb25lIHNvIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBUaGVcbiAqIG9yZGVyIHdoaWNoIHRoZXNlIG11c3QgYmUgZ2VuZXJhdGVkIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogaWYgKGNyZWF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmcoLi4uKVxuICogfVxuICogaWYgKHVwZGF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxlTWFwKC4uLilcbiAqICAgZWxlbWVudENsYXNzTWFwKC4uLilcbiAqICAgZWxlbWVudFN0eWxlUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRDbGFzc1Byb3AoLi4uKVxuICogICBlbGVtZW50U3R5bGluZ0FwcCguLi4pXG4gKiB9XG4gKlxuICogVGhlIGNyZWF0aW9uL3VwZGF0ZSBtZXRob2RzIHdpdGhpbiB0aGUgYnVpbGRlciBjbGFzcyBwcm9kdWNlIHRoZXNlIGluc3RydWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0eWxpbmdCdWlsZGVyIHtcbiAgLyoqIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3RhdGljIHN0eWxpbmcgdmFsdWVzIHByZXNlbnQgKi9cbiAgcHJpdmF0ZSBfaGFzSW5pdGlhbFZhbHVlcyA9IGZhbHNlO1xuICAvKipcbiAgICogIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3R5bGluZyBiaW5kaW5ncyBwcmVzZW50XG4gICAqICAoaS5lLiBgW3N0eWxlXWAsIGBbY2xhc3NdYCwgYFtzdHlsZS5wcm9wXWAgb3IgYFtjbGFzcy5uYW1lXWApXG4gICAqL1xuICBwdWJsaWMgaGFzQmluZGluZ3MgPSBmYWxzZTtcblxuICAvKiogdGhlIGlucHV0IGZvciBbY2xhc3NdIChpZiBpdCBleGlzdHMpICovXG4gIHByaXZhdGUgX2NsYXNzTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAvKiogdGhlIGlucHV0IGZvciBbc3R5bGVdIChpZiBpdCBleGlzdHMpICovXG4gIHByaXZhdGUgX3N0eWxlTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbc3R5bGUucHJvcF0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlU3R5bGVJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIC8qKiBhbiBhcnJheSBvZiBlYWNoIFtjbGFzcy5uYW1lXSBpbnB1dCAqL1xuICBwcml2YXRlIF9zaW5nbGVDbGFzc0lucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfbGFzdFN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG5cbiAgLy8gbWFwcyBhcmUgdXNlZCBpbnN0ZWFkIG9mIGhhc2ggbWFwcyBiZWNhdXNlIGEgTWFwIHdpbGxcbiAgLy8gcmV0YWluIHRoZSBvcmRlcmluZyBvZiB0aGUga2V5c1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIHN0eWxlIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtzdHlsZS53aWR0aF09XCJ3XCIgW3N0eWxlLmhlaWdodF09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYHdpZHRoPTBgIGFuZCBgaGVpZ2h0PTFgKVxuICAgKi9cbiAgcHJpdmF0ZSBfc3R5bGVzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIGNsYXNzIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtjbGFzcy5iaWddPVwiYlwiIFtjbGFzcy5oaWRkZW5dPVwiaFwiPmAgaW1wbGllc1xuICAgKiB0aGF0IGBiaWc9MGAgYW5kIGBoaWRkZW49MWApXG4gICAqL1xuICBwcml2YXRlIF9jbGFzc2VzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBwcml2YXRlIF9pbml0aWFsU3R5bGVWYWx1ZXM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgX2luaXRpYWxDbGFzc1ZhbHVlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBjZXJ0YWluIHN0eWxlIHByb3BlcnRpZXMgQUxXQVlTIG5lZWQgc2FuaXRpemF0aW9uXG4gIC8vIHRoaXMgaXMgY2hlY2tlZCBlYWNoIHRpbWUgbmV3IHN0eWxlcyBhcmUgZW5jb3VudGVyZWRcbiAgcHJpdmF0ZSBfdXNlRGVmYXVsdFNhbml0aXplciA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2VsZW1lbnRJbmRleEV4cHI6IG8uRXhwcmVzc2lvbiwgcHJpdmF0ZSBfZGlyZWN0aXZlRXhwcjogby5FeHByZXNzaW9ufG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGdpdmVuIGlucHV0IHRvIHRoZSBzdHlsaW5nIGJ1aWxkZXIgdG8gYmUgbGF0ZXIgdXNlZCB3aGVuIHByb2R1Y2luZyBBT1QgY29kZS5cbiAgICpcbiAgICogVGhlIGNvZGUgYmVsb3cgd2lsbCBvbmx5IGFjY2VwdCB0aGUgaW5wdXQgaWYgaXQgaXMgc29tZWhvdyB0aWVkIHRvIHN0eWxpbmcgKHdoZXRoZXIgaXQgYmVcbiAgICogc3R5bGUvY2xhc3MgYmluZGluZ3Mgb3Igc3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMpLlxuICAgKi9cbiAgcmVnaXN0ZXJCb3VuZElucHV0KGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKTogYm9vbGVhbiB7XG4gICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBhcmUgc2tpcHBlZCBpbiB0aGUgY29kZSBiZWxvdyxcbiAgICAvLyB0aGV5IHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkIGJpbmRpbmdzIHNpbmNlXG4gICAgLy8gdGhleSBhcmUgaW50ZW5kZWQgdG8gYmUgd3JpdHRlbiBkaXJlY3RseSB0byB0aGUgYXR0ciBhbmRcbiAgICAvLyB3aWxsIHRoZXJlZm9yZSBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAvLyBbY2xhc3MucHJvcF09XCJcIi4gW2NsYXNzXT1cIlwiIGFzc2lnbm1lbnRzXG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGxldCBuYW1lID0gaW5wdXQubmFtZTtcbiAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3BhbiwgaW5wdXQudW5pdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZyA/IHRydWUgOiBmYWxzZTtcbiAgfVxuXG4gIHJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGNvbnN0IG5hbWVUb01hdGNoID0gbmFtZS5zdWJzdHJpbmcoMCwgNSk7ICAvLyBjbGFzcyB8IHN0eWxlXG4gICAgY29uc3QgaXNTdHlsZSA9IG5hbWVUb01hdGNoID09PSAnc3R5bGUnO1xuICAgIGNvbnN0IGlzQ2xhc3MgPSBpc1N0eWxlID8gZmFsc2UgOiAobmFtZVRvTWF0Y2ggPT09ICdjbGFzcycpO1xuICAgIGlmIChpc1N0eWxlIHx8IGlzQ2xhc3MpIHtcbiAgICAgIGNvbnN0IGlzTWFwQmFzZWQgPSBuYW1lLmNoYXJBdCg1KSAhPT0gJy4nOyAgICAgICAgIC8vIHN0eWxlLnByb3Agb3IgY2xhc3MucHJvcCBtYWtlcyB0aGlzIGEgbm9cbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gbmFtZS5zdWJzdHIoaXNNYXBCYXNlZCA/IDUgOiA2KTsgIC8vIHRoZSBkb3QgZXhwbGFpbnMgd2h5IHRoZXJlJ3MgYSArMVxuICAgICAgaWYgKGlzU3R5bGUpIHtcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KHByb3BlcnR5LCBpc01hcEJhc2VkLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nO1xuICB9XG5cbiAgcmVnaXN0ZXJTdHlsZUlucHV0KFxuICAgICAgbmFtZTogc3RyaW5nLCBpc01hcEJhc2VkOiBib29sZWFuLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB1bml0Pzogc3RyaW5nfG51bGwpOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsIHtcbiAgICBpZiAoaXNFbXB0eUV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qge3Byb3BlcnR5LCBoYXNPdmVycmlkZUZsYWcsIHVuaXQ6IGJpbmRpbmdVbml0fSA9IHBhcnNlUHJvcGVydHkobmFtZSk7XG4gICAgY29uc3QgZW50cnk6IEJvdW5kU3R5bGluZ0VudHJ5ID0ge1xuICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICB1bml0OiB1bml0IHx8IGJpbmRpbmdVbml0LCB2YWx1ZSwgc291cmNlU3BhbiwgaGFzT3ZlcnJpZGVGbGFnXG4gICAgfTtcbiAgICBpZiAoaXNNYXBCYXNlZCkge1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRydWU7XG4gICAgICB0aGlzLl9zdHlsZU1hcElucHV0ID0gZW50cnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyA9IHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzIHx8IFtdKS5wdXNoKGVudHJ5KTtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyIHx8IGlzU3R5bGVTYW5pdGl6YWJsZShuYW1lKTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9zdHlsZXNJbmRleCwgcHJvcGVydHkpO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgdGhpcy5oYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgcmVnaXN0ZXJDbGFzc0lucHV0KG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTpcbiAgICAgIEJvdW5kU3R5bGluZ0VudHJ5fG51bGwge1xuICAgIGlmIChpc0VtcHR5RXhwcmVzc2lvbih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZ30gPSBwYXJzZVByb3BlcnR5KG5hbWUpO1xuICAgIGNvbnN0IGVudHJ5OlxuICAgICAgICBCb3VuZFN0eWxpbmdFbnRyeSA9IHtuYW1lOiBwcm9wZXJ0eSwgdmFsdWUsIHNvdXJjZVNwYW4sIGhhc092ZXJyaWRlRmxhZywgdW5pdDogbnVsbH07XG4gICAgaWYgKGlzTWFwQmFzZWQpIHtcbiAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzID0gdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX2NsYXNzZXNJbmRleCwgcHJvcGVydHkpO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgdGhpcy5oYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgZWxlbWVudCdzIHN0YXRpYyBzdHlsZSBzdHJpbmcgdmFsdWUgdG8gdGhlIGJ1aWxkZXIuXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgc3R5bGUgc3RyaW5nIChlLmcuIGB3aWR0aDoxMDBweDsgaGVpZ2h0OjIwMHB4O2ApXG4gICAqL1xuICByZWdpc3RlclN0eWxlQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzID0gcGFyc2VTdHlsZSh2YWx1ZSk7XG4gICAgdGhpcy5faGFzSW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIGNsYXNzIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBjbGFzc05hbWUgc3RyaW5nIChlLmcuIGBkaXNhYmxlZCBnb2xkIHpvb21gKVxuICAgKi9cbiAgcmVnaXN0ZXJDbGFzc0F0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFsbCBzdHlsaW5nLXJlbGF0ZWQgZXhwcmVzc2lvbnMgdG8gdGhlIHByb3ZpZGVkIGF0dHJzIGFycmF5LlxuICAgKlxuICAgKiBAcGFyYW0gYXR0cnMgYW4gZXhpc3RpbmcgYXJyYXkgd2hlcmUgZWFjaCBvZiB0aGUgc3R5bGluZyBleHByZXNzaW9uc1xuICAgKiB3aWxsIGJlIGluc2VydGVkIGludG8uXG4gICAqL1xuICBwb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogdm9pZCB7XG4gICAgLy8gW0NMQVNTX01BUktFUiwgJ2ZvbycsICdiYXInLCAnYmF6JyAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXNbaV0pKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBbU1RZTEVfTUFSS0VSLCAnd2lkdGgnLCAnMjAwcHgnLCAnaGVpZ2h0JywgJzEwMHB4JywgLi4uXVxuICAgIGlmICh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMubGVuZ3RoKSB7XG4gICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbChBdHRyaWJ1dGVNYXJrZXIuU3R5bGVzKSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBhdHRycy5wdXNoKFxuICAgICAgICAgICAgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpXSksIG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXNbaSArIDFdKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50SG9zdEF0dHJzYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgaW5pdGlhbCBzdHlsZXMgKHdpdGhpbiBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MnIGNyZWF0aW9uIGJsb2NrKSxcbiAgICogYXMgd2VsbCBhcyBhbnkgb2YgdGhlIHByb3ZpZGVkIGF0dHJpYnV0ZSB2YWx1ZXMsIHRvIHRoZSBkaXJlY3RpdmUgaG9zdCBlbGVtZW50LlxuICAgKi9cbiAgYnVpbGRIb3N0QXR0cnNJbnN0cnVjdGlvbihcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBhdHRyczogby5FeHByZXNzaW9uW10sXG4gICAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IEluc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByICYmIChhdHRycy5sZW5ndGggfHwgdGhpcy5faGFzSW5pdGlhbFZhbHVlcykpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudEhvc3RBdHRycyxcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoKSA9PiB7XG4gICAgICAgICAgLy8gcGFyYW1zID0+IGVsZW1lbnRIb3N0QXR0cnMoYWdldERpcmVjdGl2ZUNvbnRleHQoKXR0cnMpXG4gICAgICAgICAgdGhpcy5wb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0cnMpO1xuICAgICAgICAgIGNvbnN0IGF0dHJBcnJheSA9ICFhdHRycy5zb21lKGF0dHIgPT4gYXR0ciBpbnN0YW5jZW9mIG8uV3JhcHBlZE5vZGVFeHByKSA/XG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIGF0dHJzKSA6XG4gICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihhdHRycyk7XG4gICAgICAgICAgcmV0dXJuIFthdHRyQXJyYXldO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudFN0eWxpbmdgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZ2VuZXJhdGlvbiBjb2RlIGJlbG93IGlzIHVzZWQgZm9yIHByb2R1Y2luZyB0aGUgQU9UIHN0YXRlbWVudCBjb2RlIHdoaWNoIGlzXG4gICAqIHJlc3BvbnNpYmxlIGZvciByZWdpc3RlcmluZyBzdHlsZS9jbGFzcyBiaW5kaW5ncyB0byBhbiBlbGVtZW50LlxuICAgKi9cbiAgYnVpbGRFbGVtZW50U3R5bGluZ0luc3RydWN0aW9uKHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6XG4gICAgICBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBjb25zdCByZWZlcmVuY2UgPSB0aGlzLl9kaXJlY3RpdmVFeHByID8gUjMuZWxlbWVudEhvc3RTdHlsaW5nIDogUjMuZWxlbWVudFN0eWxpbmc7XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3MpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLCByZWZlcmVuY2UsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoKSA9PiB7XG4gICAgICAgICAgLy8gYSBzdHJpbmcgYXJyYXkgb2YgZXZlcnkgc3R5bGUtYmFzZWQgYmluZGluZ1xuICAgICAgICAgIGNvbnN0IHN0eWxlQmluZGluZ1Byb3BzID1cbiAgICAgICAgICAgICAgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgPyB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cy5tYXAoaSA9PiBvLmxpdGVyYWwoaS5uYW1lKSkgOiBbXTtcbiAgICAgICAgICAvLyBhIHN0cmluZyBhcnJheSBvZiBldmVyeSBjbGFzcy1iYXNlZCBiaW5kaW5nXG4gICAgICAgICAgY29uc3QgY2xhc3NCaW5kaW5nTmFtZXMgPVxuICAgICAgICAgICAgICB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyA/IHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLm1hcChpID0+IG8ubGl0ZXJhbChpLm5hbWUpKSA6IFtdO1xuXG4gICAgICAgICAgLy8gdG8gc2FsdmFnZSBzcGFjZSBpbiB0aGUgQU9UIGdlbmVyYXRlZCBjb2RlLCB0aGVyZSBpcyBubyBwb2ludCBpbiBwYXNzaW5nXG4gICAgICAgICAgLy8gaW4gYG51bGxgIGludG8gYSBwYXJhbSBpZiBhbnkgZm9sbG93LXVwIHBhcmFtcyBhcmUgbm90IHVzZWQuIFRoZXJlZm9yZSxcbiAgICAgICAgICAvLyBvbmx5IHdoZW4gYSB0cmFpbGluZyBwYXJhbSBpcyB1c2VkIHRoZW4gaXQgd2lsbCBiZSBmaWxsZWQgd2l0aCBudWxscyBpbiBiZXR3ZWVuXG4gICAgICAgICAgLy8gKG90aGVyd2lzZSBhIHNob3J0ZXIgYW1vdW50IG9mIHBhcmFtcyB3aWxsIGJlIGZpbGxlZCkuIFRoZSBjb2RlIGJlbG93IGhlbHBzXG4gICAgICAgICAgLy8gZGV0ZXJtaW5lIGhvdyBtYW55IHBhcmFtcyBhcmUgcmVxdWlyZWQgaW4gdGhlIGV4cHJlc3Npb24gY29kZS5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIEhPU1Q6XG4gICAgICAgICAgLy8gICBtaW4gcGFyYW1zID0+IGVsZW1lbnRIb3N0U3R5bGluZygpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRIb3N0U3R5bGluZyhjbGFzc0JpbmRpbmdzLCBzdHlsZUJpbmRpbmdzLCBzYW5pdGl6ZXIpXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmcoKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZyhjbGFzc0JpbmRpbmdzLCBzdHlsZUJpbmRpbmdzLCBzYW5pdGl6ZXIpXG4gICAgICAgICAgLy9cbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgICAgbGV0IGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMDtcbiAgICAgICAgICBpZiAodGhpcy5fdXNlRGVmYXVsdFNhbml0aXplcikge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc3R5bGVCaW5kaW5nUHJvcHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDI7XG4gICAgICAgICAgfSBlbHNlIGlmIChjbGFzc0JpbmRpbmdOYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgcGFyYW1zLCBjbGFzc0JpbmRpbmdOYW1lcy5sZW5ndGggPiAwLFxuICAgICAgICAgICAgICBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoY29uc3RhbnRQb29sLCBjbGFzc0JpbmRpbmdOYW1lcyksIDEsXG4gICAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzKTtcbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgcGFyYW1zLCBzdHlsZUJpbmRpbmdQcm9wcy5sZW5ndGggPiAwLFxuICAgICAgICAgICAgICBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoY29uc3RhbnRQb29sLCBzdHlsZUJpbmRpbmdQcm9wcyksIDIsXG4gICAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzKTtcbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgcGFyYW1zLCB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyLCBvLmltcG9ydEV4cHIoUjMuZGVmYXVsdFN0eWxlU2FuaXRpemVyKSwgMyxcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50Q2xhc3NNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgZWxlbWVudENsYXNzTWFwYCB0byBmdW5jdGlvblxuICAgKiB3aGljaCBpbmNsdWRlcyB0aGUgYFtjbGFzc11gIGV4cHJlc3Npb24gcGFyYW1zLlxuICAgKi9cbiAgYnVpbGRFbGVtZW50Q2xhc3NNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkTWFwQmFzZWRJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlciwgdHJ1ZSwgdGhpcy5fY2xhc3NNYXBJbnB1dCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50U3R5bGVNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgZWxlbWVudFN0eWxlTWFwYCB0byBmdW5jdGlvblxuICAgKiB3aGljaCBpbmNsdWRlcyB0aGUgYFtzdHlsZV1gIGV4cHJlc3Npb24gcGFyYW1zLlxuICAgKi9cbiAgYnVpbGRFbGVtZW50U3R5bGVNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fc3R5bGVNYXBJbnB1dCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkTWFwQmFzZWRJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlciwgZmFsc2UsIHRoaXMuX3N0eWxlTWFwSW5wdXQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkTWFwQmFzZWRJbnN0cnVjdGlvbihcbiAgICAgIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlciwgaXNDbGFzc0Jhc2VkOiBib29sZWFuLCBzdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5KSB7XG4gICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAwO1xuXG4gICAgLy8gdGhlc2UgdmFsdWVzIG11c3QgYmUgb3V0c2lkZSBvZiB0aGUgdXBkYXRlIGJsb2NrIHNvIHRoYXQgdGhleSBjYW5cbiAgICAvLyBiZSBldmFsdWF0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAvLyBwaXBlcyBjYW4gYmUgcGlja2VkIHVwIGluIHRpbWUgYmVmb3JlIHRoZSB0ZW1wbGF0ZSBpcyBidWlsdFxuICAgIGNvbnN0IG1hcFZhbHVlID0gc3R5bGluZ0lucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICBpZiAobWFwVmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IG1hcFZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICB9XG5cbiAgICBjb25zdCBpc0hvc3RCaW5kaW5nID0gdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICBsZXQgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICAgIGlmIChpc0NsYXNzQmFzZWQpIHtcbiAgICAgIHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdENsYXNzTWFwIDogUjMuZWxlbWVudENsYXNzTWFwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsZU1hcCA6IFIzLmVsZW1lbnRTdHlsZU1hcDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICByZWZlcmVuY2UsXG4gICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCxcbiAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7IHJldHVybiBbY29udmVydEZuKG1hcFZhbHVlKV07IH1cbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXSwgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4gICAgICBhbGxvd1VuaXRzOiBib29sZWFuLCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDA7XG4gICAgcmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0luZGV4OiBudW1iZXIgPSBtYXBJbmRleC5nZXQoaW5wdXQubmFtZSAhKSAhO1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9ICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMDtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLCByZWZlcmVuY2UsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nUHJvcChiaW5kaW5nSW5kZXgsIHZhbHVlKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmdQcm9wKGJpbmRpbmdJbmRleCwgdmFsdWUsIG92ZXJyaWRlRmxhZylcbiAgICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdQcm9wKGVsbUluZGV4LCBiaW5kaW5nSW5kZXgsIHZhbHVlKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ1Byb3AoZWxtSW5kZXgsIGJpbmRpbmdJbmRleCwgdmFsdWUsIG92ZXJyaWRlRmxhZylcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGJpbmRpbmdJbmRleCkpO1xuICAgICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRGbih2YWx1ZSkpO1xuXG4gICAgICAgICAgaWYgKGFsbG93VW5pdHMpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC51bml0KSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC51bml0KSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlucHV0Lmhhc092ZXJyaWRlRmxhZykge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGlucHV0Lmhhc092ZXJyaWRlRmxhZykge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKHRydWUpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMpIHtcbiAgICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSAhIXRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RDbGFzc1Byb3AgOiBSMy5lbGVtZW50Q2xhc3NQcm9wO1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIHJlZmVyZW5jZSwgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMsIHRoaXMuX2NsYXNzZXNJbmRleCwgZmFsc2UsIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMpIHtcbiAgICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSAhIXRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsZVByb3AgOiBSMy5lbGVtZW50U3R5bGVQcm9wO1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIHJlZmVyZW5jZSwgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMsIHRoaXMuX3N0eWxlc0luZGV4LCB0cnVlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQXBwbHlGbigpOiBJbnN0cnVjdGlvbiB7XG4gICAgY29uc3QgaXNIb3N0QmluZGluZyA9IHRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgY29uc3QgcmVmZXJlbmNlID0gaXNIb3N0QmluZGluZyA/IFIzLmVsZW1lbnRIb3N0U3R5bGluZ0FwcGx5IDogUjMuZWxlbWVudFN0eWxpbmdBcHBseTtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlU3BhbjogdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA/IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQuc291cmNlU3BhbiA6IG51bGwsXG4gICAgICByZWZlcmVuY2UsXG4gICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCxcbiAgICAgIGJ1aWxkUGFyYW1zOiAoKSA9PiB7IHJldHVybiBbXTsgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhbGwgaW5zdHJ1Y3Rpb25zIHdoaWNoIGNvbnRhaW4gdGhlIGV4cHJlc3Npb25zIHRoYXQgd2lsbCBiZSBwbGFjZWRcbiAgICogaW50byB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgdGVtcGxhdGUgZnVuY3Rpb24gb3IgYSBkaXJlY3RpdmUgaG9zdEJpbmRpbmdzIGZ1bmN0aW9uLlxuICAgKi9cbiAgYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpIHtcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5ncykge1xuICAgICAgY29uc3Qgc3R5bGVNYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRFbGVtZW50U3R5bGVNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAoc3R5bGVNYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChzdHlsZU1hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNsYXNzTWFwSW5zdHJ1Y3Rpb24gPSB0aGlzLmJ1aWxkRWxlbWVudENsYXNzTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKGNsYXNzTWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goY2xhc3NNYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gTm90ZSB0aGF0IGJyb3dzZXJzIHN1cHBvcnQgYm90aCB0aGUgZGFzaCBjYXNlIGFuZFxuICAvLyBjYW1lbCBjYXNlIHByb3BlcnR5IG5hbWVzIHdoZW4gc2V0dGluZyB0aHJvdWdoIEpTLlxuICByZXR1cm4gcHJvcCA9PT0gJ2JhY2tncm91bmQtaW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kSW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kJyB8fFxuICAgICAgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHwgcHJvcCA9PT0gJ2JvcmRlckltYWdlJyB8fCBwcm9wID09PSAnZmlsdGVyJyB8fFxuICAgICAgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUnIHx8IHByb3AgPT09ICdsaXN0U3R5bGUnIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlLWltYWdlJyB8fFxuICAgICAgcHJvcCA9PT0gJ2xpc3RTdHlsZUltYWdlJztcbn1cblxuLyoqXG4gKiBTaW1wbGUgaGVscGVyIGZ1bmN0aW9uIHRvIGVpdGhlciBwcm92aWRlIHRoZSBjb25zdGFudCBsaXRlcmFsIHRoYXQgd2lsbCBob3VzZSB0aGUgdmFsdWVcbiAqIGhlcmUgb3IgYSBudWxsIHZhbHVlIGlmIHRoZSBwcm92aWRlZCB2YWx1ZXMgYXJlIGVtcHR5LlxuICovXG5mdW5jdGlvbiBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHZhbHVlczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gdmFsdWVzLmxlbmd0aCA/IGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHZhbHVlcyksIHRydWUpIDogby5OVUxMX0VYUFI7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0aGF0IGFkZHMgYSBwYXJhbWV0ZXIgb3IgZG9lcyBub3RoaW5nIGF0IGFsbCBkZXBlbmRpbmcgb24gdGhlIHByb3ZpZGVkXG4gKiBwcmVkaWNhdGUgYW5kIHRvdGFsRXhwZWN0ZWRBcmdzIHZhbHVlc1xuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdLCBwcmVkaWNhdGU6IGFueSwgdmFsdWU6IG8uRXhwcmVzc2lvbiB8IG51bGwsIGFyZ051bWJlcjogbnVtYmVyLFxuICAgIHRvdGFsRXhwZWN0ZWRBcmdzOiBudW1iZXIpIHtcbiAgaWYgKHByZWRpY2F0ZSAmJiB2YWx1ZSkge1xuICAgIHBhcmFtcy5wdXNoKHZhbHVlKTtcbiAgfSBlbHNlIGlmIChhcmdOdW1iZXIgPCB0b3RhbEV4cGVjdGVkQXJncykge1xuICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOlxuICAgIHtwcm9wZXJ0eTogc3RyaW5nLCB1bml0OiBzdHJpbmcsIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbn0ge1xuICBsZXQgaGFzT3ZlcnJpZGVGbGFnID0gZmFsc2U7XG4gIGNvbnN0IG92ZXJyaWRlSW5kZXggPSBuYW1lLmluZGV4T2YoSU1QT1JUQU5UX0ZMQUcpO1xuICBpZiAob3ZlcnJpZGVJbmRleCAhPT0gLTEpIHtcbiAgICBuYW1lID0gb3ZlcnJpZGVJbmRleCA+IDAgPyBuYW1lLnN1YnN0cmluZygwLCBvdmVycmlkZUluZGV4KSA6ICcnO1xuICAgIGhhc092ZXJyaWRlRmxhZyA9IHRydWU7XG4gIH1cblxuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHkgPSBuYW1lO1xuICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gIGlmICh1bml0SW5kZXggPiAwKSB7XG4gICAgdW5pdCA9IG5hbWUuc3Vic3RyKHVuaXRJbmRleCArIDEpO1xuICAgIHByb3BlcnR5ID0gbmFtZS5zdWJzdHJpbmcoMCwgdW5pdEluZGV4KTtcbiAgfVxuXG4gIHJldHVybiB7cHJvcGVydHksIHVuaXQsIGhhc092ZXJyaWRlRmxhZ307XG59XG4iXX0=