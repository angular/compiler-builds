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
            buildParams: (convertFn) => {
                const params = [];
                if (!isHostBinding) {
                    params.push(this._elementIndexExpr);
                }
                params.push(convertFn(mapValue));
                return params;
            }
        };
    }
    _buildSingleInputs(reference, isHostBinding, inputs, mapIndex, allowUnits, valueConverter) {
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
                    if (!isHostBinding) {
                        params.push(this._elementIndexExpr);
                    }
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
            return this._buildSingleInputs(reference, isHostBinding, this._singleClassInputs, this._classesIndex, false, valueConverter);
        }
        return [];
    }
    _buildStyleInputs(valueConverter) {
        if (this._singleStyleInputs) {
            const isHostBinding = !!this._directiveExpr;
            const reference = isHostBinding ? R3.elementHostStyleProp : R3.elementStyleProp;
            return this._buildSingleInputs(reference, isHostBinding, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
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
            buildParams: () => {
                // HOST:
                //   params => elementHostStylingApply()
                // Template:
                //   params => elementStylingApply(elmIndex)
                return isHostBinding ? [] : [this._elementIndexExpr];
            }
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
    return prop === 'background-image' || prop === 'background' || prop === 'border-image' ||
        prop === 'filter' || prop === 'list-style' || prop === 'list-style-image';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFtQixhQUFhLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUM1RSxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRXhFLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUduRCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUF1QnBDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTZCRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBMEN6QixZQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUF6QzlGLGlFQUFpRTtRQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDbEM7OztXQUdHO1FBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFFM0IsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwyQ0FBMkM7UUFDbkMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQ3RELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQzVELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQ3BELHNCQUFpQixHQUEyQixJQUFJLENBQUM7UUFFekQsd0RBQXdEO1FBQ3hELGtDQUFrQztRQUVsQzs7OztXQUlH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QUMsQ0FBQztJQUN4QyxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUU7UUFDakIsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN6QztJQUVELE9BQU8sRUFBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBQyxDQUFDO0FBQzNDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0F0dHJpYnV0ZU1hcmtlcn0gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQmluZGluZ1R5cGUsIEludGVycG9sYXRpb259IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aXNFbXB0eUV4cHJlc3Npb259IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXInO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuXG5pbXBvcnQge3BhcnNlIGFzIHBhcnNlU3R5bGV9IGZyb20gJy4vc3R5bGVfcGFyc2VyJztcbmltcG9ydCB7VmFsdWVDb252ZXJ0ZXJ9IGZyb20gJy4vdGVtcGxhdGUnO1xuXG5jb25zdCBJTVBPUlRBTlRfRkxBRyA9ICchaW1wb3J0YW50JztcblxuLyoqXG4gKiBBIHN0eWxpbmcgZXhwcmVzc2lvbiBzdW1tYXJ5IHRoYXQgaXMgdG8gYmUgcHJvY2Vzc2VkIGJ5IHRoZSBjb21waWxlclxuICovXG5leHBvcnQgaW50ZXJmYWNlIEluc3RydWN0aW9uIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZTtcbiAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IG51bWJlcjtcbiAgYnVpbGRQYXJhbXMoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uW107XG59XG5cbi8qKlxuICogQW4gaW50ZXJuYWwgcmVjb3JkIG9mIHRoZSBpbnB1dCBkYXRhIGZvciBhIHN0eWxpbmcgYmluZGluZ1xuICovXG5pbnRlcmZhY2UgQm91bmRTdHlsaW5nRW50cnkge1xuICBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW47XG4gIG5hbWU6IHN0cmluZ3xudWxsO1xuICB1bml0OiBzdHJpbmd8bnVsbDtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2YWx1ZTogQVNUO1xufVxuXG4vKipcbiAqIFByb2R1Y2VzIGNyZWF0aW9uL3VwZGF0ZSBpbnN0cnVjdGlvbnMgZm9yIGFsbCBzdHlsaW5nIGJpbmRpbmdzIChjbGFzcyBhbmQgc3R5bGUpXG4gKlxuICogSXQgYWxzbyBwcm9kdWNlcyB0aGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24gdG8gcmVnaXN0ZXIgYWxsIGluaXRpYWwgc3R5bGluZyB2YWx1ZXNcbiAqICh3aGljaCBhcmUgYWxsIHRoZSBzdGF0aWMgY2xhc3M9XCIuLi5cIiBhbmQgc3R5bGU9XCIuLi5cIiBhdHRyaWJ1dGUgdmFsdWVzIHRoYXQgZXhpc3RcbiAqIG9uIGFuIGVsZW1lbnQgd2l0aGluIGEgdGVtcGxhdGUpLlxuICpcbiAqIFRoZSBidWlsZGVyIGNsYXNzIGJlbG93IGhhbmRsZXMgcHJvZHVjaW5nIGluc3RydWN0aW9ucyBmb3IgdGhlIGZvbGxvd2luZyBjYXNlczpcbiAqXG4gKiAtIFN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzIChzdHlsZT1cIi4uLlwiIGFuZCBjbGFzcz1cIi4uLlwiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIG1hcCBiaW5kaW5ncyAoW3N0eWxlXT1cIm1hcFwiIGFuZCBbY2xhc3NdPVwibWFwfHN0cmluZ1wiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIHByb3BlcnR5IGJpbmRpbmdzIChbc3R5bGUucHJvcF09XCJleHBcIiBhbmQgW2NsYXNzLm5hbWVdPVwiZXhwXCIpXG4gKlxuICogRHVlIHRvIHRoZSBjb21wbGV4IHJlbGF0aW9uc2hpcCBvZiBhbGwgb2YgdGhlc2UgY2FzZXMsIHRoZSBpbnN0cnVjdGlvbnMgZ2VuZXJhdGVkXG4gKiBmb3IgdGhlc2UgYXR0cmlidXRlcy9wcm9wZXJ0aWVzL2JpbmRpbmdzIG11c3QgYmUgZG9uZSBzbyBpbiB0aGUgY29ycmVjdCBvcmRlci4gVGhlXG4gKiBvcmRlciB3aGljaCB0aGVzZSBtdXN0IGJlIGdlbmVyYXRlZCBpcyBhcyBmb2xsb3dzOlxuICpcbiAqIGlmIChjcmVhdGVNb2RlKSB7XG4gKiAgIGVsZW1lbnRTdHlsaW5nKC4uLilcbiAqIH1cbiAqIGlmICh1cGRhdGVNb2RlKSB7XG4gKiAgIGVsZW1lbnRTdHlsZU1hcCguLi4pXG4gKiAgIGVsZW1lbnRDbGFzc01hcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsZVByb3AoLi4uKVxuICogICBlbGVtZW50Q2xhc3NQcm9wKC4uLilcbiAqICAgZWxlbWVudFN0eWxpbmdBcHAoLi4uKVxuICogfVxuICpcbiAqIFRoZSBjcmVhdGlvbi91cGRhdGUgbWV0aG9kcyB3aXRoaW4gdGhlIGJ1aWxkZXIgY2xhc3MgcHJvZHVjZSB0aGVzZSBpbnN0cnVjdGlvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHlsaW5nQnVpbGRlciB7XG4gIC8qKiBXaGV0aGVyIG9yIG5vdCB0aGVyZSBhcmUgYW55IHN0YXRpYyBzdHlsaW5nIHZhbHVlcyBwcmVzZW50ICovXG4gIHByaXZhdGUgX2hhc0luaXRpYWxWYWx1ZXMgPSBmYWxzZTtcbiAgLyoqXG4gICAqICBXaGV0aGVyIG9yIG5vdCB0aGVyZSBhcmUgYW55IHN0eWxpbmcgYmluZGluZ3MgcHJlc2VudFxuICAgKiAgKGkuZS4gYFtzdHlsZV1gLCBgW2NsYXNzXWAsIGBbc3R5bGUucHJvcF1gIG9yIGBbY2xhc3MubmFtZV1gKVxuICAgKi9cbiAgcHVibGljIGhhc0JpbmRpbmdzID0gZmFsc2U7XG5cbiAgLyoqIHRoZSBpbnB1dCBmb3IgW2NsYXNzXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9jbGFzc01hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIHRoZSBpbnB1dCBmb3IgW3N0eWxlXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9zdHlsZU1hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW3N0eWxlLnByb3BdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZVN0eWxlSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbY2xhc3MubmFtZV0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlQ2xhc3NJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2xhc3RTdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuXG4gIC8vIG1hcHMgYXJlIHVzZWQgaW5zdGVhZCBvZiBoYXNoIG1hcHMgYmVjYXVzZSBhIE1hcCB3aWxsXG4gIC8vIHJldGFpbiB0aGUgb3JkZXJpbmcgb2YgdGhlIGtleXNcblxuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgbG9jYXRpb24gb2YgZWFjaCBzdHlsZSBiaW5kaW5nIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiAoZS5nLiBgPGRpdiBbc3R5bGUud2lkdGhdPVwid1wiIFtzdHlsZS5oZWlnaHRdPVwiaFwiPmAgaW1wbGllc1xuICAgKiB0aGF0IGB3aWR0aD0wYCBhbmQgYGhlaWdodD0xYClcbiAgICovXG4gIHByaXZhdGUgX3N0eWxlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgbG9jYXRpb24gb2YgZWFjaCBjbGFzcyBiaW5kaW5nIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiAoZS5nLiBgPGRpdiBbY2xhc3MuYmlnXT1cImJcIiBbY2xhc3MuaGlkZGVuXT1cImhcIj5gIGltcGxpZXNcbiAgICogdGhhdCBgYmlnPTBgIGFuZCBgaGlkZGVuPTFgKVxuICAgKi9cbiAgcHJpdmF0ZSBfY2xhc3Nlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgcHJpdmF0ZSBfaW5pdGlhbFN0eWxlVmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIF9pbml0aWFsQ2xhc3NWYWx1ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gY2VydGFpbiBzdHlsZSBwcm9wZXJ0aWVzIEFMV0FZUyBuZWVkIHNhbml0aXphdGlvblxuICAvLyB0aGlzIGlzIGNoZWNrZWQgZWFjaCB0aW1lIG5ldyBzdHlsZXMgYXJlIGVuY291bnRlcmVkXG4gIHByaXZhdGUgX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9lbGVtZW50SW5kZXhFeHByOiBvLkV4cHJlc3Npb24sIHByaXZhdGUgX2RpcmVjdGl2ZUV4cHI6IG8uRXhwcmVzc2lvbnxudWxsKSB7fVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBnaXZlbiBpbnB1dCB0byB0aGUgc3R5bGluZyBidWlsZGVyIHRvIGJlIGxhdGVyIHVzZWQgd2hlbiBwcm9kdWNpbmcgQU9UIGNvZGUuXG4gICAqXG4gICAqIFRoZSBjb2RlIGJlbG93IHdpbGwgb25seSBhY2NlcHQgdGhlIGlucHV0IGlmIGl0IGlzIHNvbWVob3cgdGllZCB0byBzdHlsaW5nICh3aGV0aGVyIGl0IGJlXG4gICAqIHN0eWxlL2NsYXNzIGJpbmRpbmdzIG9yIHN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzKS5cbiAgICovXG4gIHJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICAgIC8vIFthdHRyLnN0eWxlXSBvciBbYXR0ci5jbGFzc10gYXJlIHNraXBwZWQgaW4gdGhlIGNvZGUgYmVsb3csXG4gICAgLy8gdGhleSBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgc3R5bGluZy1iYXNlZCBiaW5kaW5ncyBzaW5jZVxuICAgIC8vIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHIgYW5kXG4gICAgLy8gd2lsbCB0aGVyZWZvcmUgc2tpcCBhbGwgc3R5bGUvY2xhc3MgcmVzb2x1dGlvbiB0aGF0IGlzIHByZXNlbnRcbiAgICAvLyB3aXRoIHN0eWxlPVwiXCIsIFtzdHlsZV09XCJcIiBhbmQgW3N0eWxlLnByb3BdPVwiXCIsIGNsYXNzPVwiXCIsXG4gICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgIGxldCBiaW5kaW5nOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgICBsZXQgbmFtZSA9IGlucHV0Lm5hbWU7XG4gICAgc3dpdGNoIChpbnB1dC50eXBlKSB7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlcklucHV0QmFzZWRPbk5hbWUobmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChuYW1lLCBmYWxzZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4sIGlucHV0LnVuaXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChuYW1lLCBmYWxzZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmcgPyB0cnVlIDogZmFsc2U7XG4gIH1cblxuICByZWdpc3RlcklucHV0QmFzZWRPbk5hbWUobmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGxldCBiaW5kaW5nOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgICBjb25zdCBuYW1lVG9NYXRjaCA9IG5hbWUuc3Vic3RyaW5nKDAsIDUpOyAgLy8gY2xhc3MgfCBzdHlsZVxuICAgIGNvbnN0IGlzU3R5bGUgPSBuYW1lVG9NYXRjaCA9PT0gJ3N0eWxlJztcbiAgICBjb25zdCBpc0NsYXNzID0gaXNTdHlsZSA/IGZhbHNlIDogKG5hbWVUb01hdGNoID09PSAnY2xhc3MnKTtcbiAgICBpZiAoaXNTdHlsZSB8fCBpc0NsYXNzKSB7XG4gICAgICBjb25zdCBpc01hcEJhc2VkID0gbmFtZS5jaGFyQXQoNSkgIT09ICcuJzsgICAgICAgICAvLyBzdHlsZS5wcm9wIG9yIGNsYXNzLnByb3AgbWFrZXMgdGhpcyBhIG5vXG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKGlzTWFwQmFzZWQgPyA1IDogNik7ICAvLyB0aGUgZG90IGV4cGxhaW5zIHdoeSB0aGVyZSdzIGEgKzFcbiAgICAgIGlmIChpc1N0eWxlKSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmluZGluZztcbiAgfVxuXG4gIHJlZ2lzdGVyU3R5bGVJbnB1dChcbiAgICAgIG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdW5pdD86IHN0cmluZ3xudWxsKTogQm91bmRTdHlsaW5nRW50cnl8bnVsbCB7XG4gICAgaWYgKGlzRW1wdHlFeHByZXNzaW9uKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHtwcm9wZXJ0eSwgaGFzT3ZlcnJpZGVGbGFnLCB1bml0OiBiaW5kaW5nVW5pdH0gPSBwYXJzZVByb3BlcnR5KG5hbWUpO1xuICAgIGNvbnN0IGVudHJ5OiBCb3VuZFN0eWxpbmdFbnRyeSA9IHtcbiAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgdW5pdDogdW5pdCB8fCBiaW5kaW5nVW5pdCwgdmFsdWUsIHNvdXJjZVNwYW4sIGhhc092ZXJyaWRlRmxhZ1xuICAgIH07XG4gICAgaWYgKGlzTWFwQmFzZWQpIHtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0cnVlO1xuICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgPSB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUobmFtZSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fc3R5bGVzSW5kZXgsIHByb3BlcnR5KTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NJbnB1dChuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBCb3VuZFN0eWxpbmdFbnRyeXxudWxsIHtcbiAgICBpZiAoaXNFbXB0eUV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qge3Byb3BlcnR5LCBoYXNPdmVycmlkZUZsYWd9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTpcbiAgICAgICAgQm91bmRTdHlsaW5nRW50cnkgPSB7bmFtZTogcHJvcGVydHksIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWcsIHVuaXQ6IG51bGx9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl9jbGFzc01hcElucHV0ID0gZW50cnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyA9IHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzIHx8IFtdKS5wdXNoKGVudHJ5KTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9jbGFzc2VzSW5kZXgsIHByb3BlcnR5KTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgc3R5bGUgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIHN0eWxlIHN0cmluZyAoZS5nLiBgd2lkdGg6MTAwcHg7IGhlaWdodDoyMDBweDtgKVxuICAgKi9cbiAgcmVnaXN0ZXJTdHlsZUF0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcyA9IHBhcnNlU3R5bGUodmFsdWUpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgZWxlbWVudCdzIHN0YXRpYyBjbGFzcyBzdHJpbmcgdmFsdWUgdG8gdGhlIGJ1aWxkZXIuXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgY2xhc3NOYW1lIHN0cmluZyAoZS5nLiBgZGlzYWJsZWQgZ29sZCB6b29tYClcbiAgICovXG4gIHJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgdGhpcy5faGFzSW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQXBwZW5kcyBhbGwgc3R5bGluZy1yZWxhdGVkIGV4cHJlc3Npb25zIHRvIHRoZSBwcm92aWRlZCBhdHRycyBhcnJheS5cbiAgICpcbiAgICogQHBhcmFtIGF0dHJzIGFuIGV4aXN0aW5nIGFycmF5IHdoZXJlIGVhY2ggb2YgdGhlIHN0eWxpbmcgZXhwcmVzc2lvbnNcbiAgICogd2lsbCBiZSBpbnNlcnRlZCBpbnRvLlxuICAgKi9cbiAgcG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJzOiBvLkV4cHJlc3Npb25bXSk6IHZvaWQge1xuICAgIC8vIFtDTEFTU19NQVJLRVIsICdmb28nLCAnYmFyJywgJ2JheicgLi4uXVxuICAgIGlmICh0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMubGVuZ3RoKSB7XG4gICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbChBdHRyaWJ1dGVNYXJrZXIuQ2xhc3NlcykpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzW2ldKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gW1NUWUxFX01BUktFUiwgJ3dpZHRoJywgJzIwMHB4JywgJ2hlaWdodCcsICcxMDBweCcsIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLlN0eWxlcykpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgYXR0cnMucHVzaChcbiAgICAgICAgICAgIG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXNbaV0pLCBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2kgKyAxXSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudEhvc3RBdHRyc2AuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBnZW5lcmF0aW9uIGNvZGUgYmVsb3cgaXMgdXNlZCBmb3IgcHJvZHVjaW5nIHRoZSBBT1Qgc3RhdGVtZW50IGNvZGUgd2hpY2ggaXNcbiAgICogcmVzcG9uc2libGUgZm9yIHJlZ2lzdGVyaW5nIGluaXRpYWwgc3R5bGVzICh3aXRoaW4gYSBkaXJlY3RpdmUgaG9zdEJpbmRpbmdzJyBjcmVhdGlvbiBibG9jayksXG4gICAqIGFzIHdlbGwgYXMgYW55IG9mIHRoZSBwcm92aWRlZCBhdHRyaWJ1dGUgdmFsdWVzLCB0byB0aGUgZGlyZWN0aXZlIGhvc3QgZWxlbWVudC5cbiAgICovXG4gIGJ1aWxkSG9zdEF0dHJzSW5zdHJ1Y3Rpb24oXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgYXR0cnM6IG8uRXhwcmVzc2lvbltdLFxuICAgICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwciAmJiAoYXR0cnMubGVuZ3RoIHx8IHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRIb3N0QXR0cnMsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAgIC8vIHBhcmFtcyA9PiBlbGVtZW50SG9zdEF0dHJzKGFnZXREaXJlY3RpdmVDb250ZXh0KCl0dHJzKVxuICAgICAgICAgIHRoaXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJzKTtcbiAgICAgICAgICBjb25zdCBhdHRyQXJyYXkgPSAhYXR0cnMuc29tZShhdHRyID0+IGF0dHIgaW5zdGFuY2VvZiBvLldyYXBwZWROb2RlRXhwcikgP1xuICAgICAgICAgICAgICBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoY29uc3RhbnRQb29sLCBhdHRycykgOlxuICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoYXR0cnMpO1xuICAgICAgICAgIHJldHVybiBbYXR0ckFycmF5XTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgc3R5bGUvY2xhc3MgYmluZGluZ3MgdG8gYW4gZWxlbWVudC5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOlxuICAgICAgSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgY29uc3QgcmVmZXJlbmNlID0gdGhpcy5fZGlyZWN0aXZlRXhwciA/IFIzLmVsZW1lbnRIb3N0U3R5bGluZyA6IFIzLmVsZW1lbnRTdHlsaW5nO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCwgcmVmZXJlbmNlLFxuICAgICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAgIC8vIGEgc3RyaW5nIGFycmF5IG9mIGV2ZXJ5IHN0eWxlLWJhc2VkIGJpbmRpbmdcbiAgICAgICAgICBjb25zdCBzdHlsZUJpbmRpbmdQcm9wcyA9XG4gICAgICAgICAgICAgIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID8gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMubWFwKGkgPT4gby5saXRlcmFsKGkubmFtZSkpIDogW107XG4gICAgICAgICAgLy8gYSBzdHJpbmcgYXJyYXkgb2YgZXZlcnkgY2xhc3MtYmFzZWQgYmluZGluZ1xuICAgICAgICAgIGNvbnN0IGNsYXNzQmluZGluZ05hbWVzID1cbiAgICAgICAgICAgICAgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPyB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cy5tYXAoaSA9PiBvLmxpdGVyYWwoaS5uYW1lKSkgOiBbXTtcblxuICAgICAgICAgIC8vIHRvIHNhbHZhZ2Ugc3BhY2UgaW4gdGhlIEFPVCBnZW5lcmF0ZWQgY29kZSwgdGhlcmUgaXMgbm8gcG9pbnQgaW4gcGFzc2luZ1xuICAgICAgICAgIC8vIGluIGBudWxsYCBpbnRvIGEgcGFyYW0gaWYgYW55IGZvbGxvdy11cCBwYXJhbXMgYXJlIG5vdCB1c2VkLiBUaGVyZWZvcmUsXG4gICAgICAgICAgLy8gb25seSB3aGVuIGEgdHJhaWxpbmcgcGFyYW0gaXMgdXNlZCB0aGVuIGl0IHdpbGwgYmUgZmlsbGVkIHdpdGggbnVsbHMgaW4gYmV0d2VlblxuICAgICAgICAgIC8vIChvdGhlcndpc2UgYSBzaG9ydGVyIGFtb3VudCBvZiBwYXJhbXMgd2lsbCBiZSBmaWxsZWQpLiBUaGUgY29kZSBiZWxvdyBoZWxwc1xuICAgICAgICAgIC8vIGRldGVybWluZSBob3cgbWFueSBwYXJhbXMgYXJlIHJlcXVpcmVkIGluIHRoZSBleHByZXNzaW9uIGNvZGUuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBIT1NUOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmcoKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmcoY2xhc3NCaW5kaW5ncywgc3R5bGVCaW5kaW5ncywgc2FuaXRpemVyKVxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gVGVtcGxhdGU6XG4gICAgICAgICAgLy8gICBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKClcbiAgICAgICAgICAvLyAgIG1heCBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmcoY2xhc3NCaW5kaW5ncywgc3R5bGVCaW5kaW5ncywgc2FuaXRpemVyKVxuICAgICAgICAgIC8vXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgIGxldCBleHBlY3RlZE51bWJlck9mQXJncyA9IDA7XG4gICAgICAgICAgaWYgKHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAyO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NCaW5kaW5nTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDE7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgIHBhcmFtcywgY2xhc3NCaW5kaW5nTmFtZXMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgY2xhc3NCaW5kaW5nTmFtZXMpLCAxLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgIHBhcmFtcywgc3R5bGVCaW5kaW5nUHJvcHMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgc3R5bGVCaW5kaW5nUHJvcHMpLCAyLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgIHBhcmFtcywgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciwgby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplciksIDMsXG4gICAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzKTtcbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudENsYXNzTWFwYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGRhdGEgd2lsbCBjb250YWluIGFsbCBleHByZXNzaW9ucyBmb3IgYGVsZW1lbnRDbGFzc01hcGAgdG8gZnVuY3Rpb25cbiAgICogd2hpY2ggaW5jbHVkZXMgdGhlIGBbY2xhc3NdYCBleHByZXNzaW9uIHBhcmFtcy5cbiAgICovXG4gIGJ1aWxkRWxlbWVudENsYXNzTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2NsYXNzTWFwSW5wdXQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZE1hcEJhc2VkSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIsIHRydWUsIHRoaXMuX2NsYXNzTWFwSW5wdXQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudFN0eWxlTWFwYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGRhdGEgd2lsbCBjb250YWluIGFsbCBleHByZXNzaW9ucyBmb3IgYGVsZW1lbnRTdHlsZU1hcGAgdG8gZnVuY3Rpb25cbiAgICogd2hpY2ggaW5jbHVkZXMgdGhlIGBbc3R5bGVdYCBleHByZXNzaW9uIHBhcmFtcy5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxlTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZE1hcEJhc2VkSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIsIGZhbHNlLCB0aGlzLl9zdHlsZU1hcElucHV0KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZE1hcEJhc2VkSW5zdHJ1Y3Rpb24oXG4gICAgICB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIsIGlzQ2xhc3NCYXNlZDogYm9vbGVhbiwgc3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeSkge1xuICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMDtcblxuICAgIC8vIHRoZXNlIHZhbHVlcyBtdXN0IGJlIG91dHNpZGUgb2YgdGhlIHVwZGF0ZSBibG9jayBzbyB0aGF0IHRoZXkgY2FuXG4gICAgLy8gYmUgZXZhbHVhdGVkICh0aGUgQVNUIHZpc2l0IGNhbGwpIGR1cmluZyBjcmVhdGlvbiB0aW1lIHNvIHRoYXQgYW55XG4gICAgLy8gcGlwZXMgY2FuIGJlIHBpY2tlZCB1cCBpbiB0aW1lIGJlZm9yZSB0aGUgdGVtcGxhdGUgaXMgYnVpbHRcbiAgICBjb25zdCBtYXBWYWx1ZSA9IHN0eWxpbmdJbnB1dC52YWx1ZS52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgaWYgKG1hcFZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCArPSBtYXBWYWx1ZS5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgfVxuXG4gICAgY29uc3QgaXNIb3N0QmluZGluZyA9IHRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgbGV0IHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZTtcbiAgICBpZiAoaXNDbGFzc0Jhc2VkKSB7XG4gICAgICByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RDbGFzc01hcCA6IFIzLmVsZW1lbnRDbGFzc01hcDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVmZXJlbmNlID0gaXNIb3N0QmluZGluZyA/IFIzLmVsZW1lbnRIb3N0U3R5bGVNYXAgOiBSMy5lbGVtZW50U3R5bGVNYXA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgcmVmZXJlbmNlLFxuICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQsXG4gICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgIGlmICghaXNIb3N0QmluZGluZykge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2VsZW1lbnRJbmRleEV4cHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyYW1zLnB1c2goY29udmVydEZuKG1hcFZhbHVlKSk7XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc0hvc3RCaW5kaW5nOiBib29sZWFuLCBpbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W10sXG4gICAgICBtYXBJbmRleDogTWFwPHN0cmluZywgbnVtYmVyPiwgYWxsb3dVbml0czogYm9vbGVhbixcbiAgICAgIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMDtcbiAgICByZXR1cm4gaW5wdXRzLm1hcChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nSW5kZXg6IG51bWJlciA9IG1hcEluZGV4LmdldChpbnB1dC5uYW1lICEpICE7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAwO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQsIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICAvLyBIT1NUOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmdQcm9wKGJpbmRpbmdJbmRleCwgdmFsdWUpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRIb3N0U3R5bGluZ1Byb3AoYmluZGluZ0luZGV4LCB2YWx1ZSwgb3ZlcnJpZGVGbGFnKVxuICAgICAgICAgIC8vIFRlbXBsYXRlOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ1Byb3AoZWxtSW5kZXgsIGJpbmRpbmdJbmRleCwgdmFsdWUpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nUHJvcChlbG1JbmRleCwgYmluZGluZ0luZGV4LCB2YWx1ZSwgb3ZlcnJpZGVGbGFnKVxuICAgICAgICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgICAgIGlmICghaXNIb3N0QmluZGluZykge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZWxlbWVudEluZGV4RXhwcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGJpbmRpbmdJbmRleCkpO1xuICAgICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRGbih2YWx1ZSkpO1xuXG4gICAgICAgICAgaWYgKGFsbG93VW5pdHMpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC51bml0KSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC51bml0KSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlucHV0Lmhhc092ZXJyaWRlRmxhZykge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGlucHV0Lmhhc092ZXJyaWRlRmxhZykge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKHRydWUpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMpIHtcbiAgICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSAhIXRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RDbGFzc1Byb3AgOiBSMy5lbGVtZW50Q2xhc3NQcm9wO1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIHJlZmVyZW5jZSwgaXNIb3N0QmluZGluZywgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMsIHRoaXMuX2NsYXNzZXNJbmRleCwgZmFsc2UsXG4gICAgICAgICAgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cykge1xuICAgICAgY29uc3QgaXNIb3N0QmluZGluZyA9ICEhdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICAgIGNvbnN0IHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdFN0eWxlUHJvcCA6IFIzLmVsZW1lbnRTdHlsZVByb3A7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgcmVmZXJlbmNlLCBpc0hvc3RCaW5kaW5nLCB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cywgdGhpcy5fc3R5bGVzSW5kZXgsIHRydWUsXG4gICAgICAgICAgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZEFwcGx5Rm4oKTogSW5zdHJ1Y3Rpb24ge1xuICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSB0aGlzLl9kaXJlY3RpdmVFeHByO1xuICAgIGNvbnN0IHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdFN0eWxpbmdBcHBseSA6IFIzLmVsZW1lbnRTdHlsaW5nQXBwbHk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPyB0aGlzLl9sYXN0U3R5bGluZ0lucHV0LnNvdXJjZVNwYW4gOiBudWxsLFxuICAgICAgcmVmZXJlbmNlLFxuICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsXG4gICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAvLyBIT1NUOlxuICAgICAgICAvLyAgIHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmdBcHBseSgpXG4gICAgICAgIC8vIFRlbXBsYXRlOlxuICAgICAgICAvLyAgIHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ0FwcGx5KGVsbUluZGV4KVxuICAgICAgICByZXR1cm4gaXNIb3N0QmluZGluZyA/IFtdIDogW3RoaXMuX2VsZW1lbnRJbmRleEV4cHJdO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhbGwgaW5zdHJ1Y3Rpb25zIHdoaWNoIGNvbnRhaW4gdGhlIGV4cHJlc3Npb25zIHRoYXQgd2lsbCBiZSBwbGFjZWRcbiAgICogaW50byB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgdGVtcGxhdGUgZnVuY3Rpb24gb3IgYSBkaXJlY3RpdmUgaG9zdEJpbmRpbmdzIGZ1bmN0aW9uLlxuICAgKi9cbiAgYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpIHtcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5ncykge1xuICAgICAgY29uc3Qgc3R5bGVNYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRFbGVtZW50U3R5bGVNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAoc3R5bGVNYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChzdHlsZU1hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNsYXNzTWFwSW5zdHJ1Y3Rpb24gPSB0aGlzLmJ1aWxkRWxlbWVudENsYXNzTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKGNsYXNzTWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goY2xhc3NNYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByb3AgPT09ICdiYWNrZ3JvdW5kLWltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZCcgfHwgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHxcbiAgICAgIHByb3AgPT09ICdmaWx0ZXInIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZS1pbWFnZSc7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0byBlaXRoZXIgcHJvdmlkZSB0aGUgY29uc3RhbnQgbGl0ZXJhbCB0aGF0IHdpbGwgaG91c2UgdGhlIHZhbHVlXG4gKiBoZXJlIG9yIGEgbnVsbCB2YWx1ZSBpZiB0aGUgcHJvdmlkZWQgdmFsdWVzIGFyZSBlbXB0eS5cbiAqL1xuZnVuY3Rpb24gZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIHZhbHVlcy5sZW5ndGggPyBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycih2YWx1ZXMpLCB0cnVlKSA6IG8uTlVMTF9FWFBSO1xufVxuXG4vKipcbiAqIFNpbXBsZSBoZWxwZXIgZnVuY3Rpb24gdGhhdCBhZGRzIGEgcGFyYW1ldGVyIG9yIGRvZXMgbm90aGluZyBhdCBhbGwgZGVwZW5kaW5nIG9uIHRoZSBwcm92aWRlZFxuICogcHJlZGljYXRlIGFuZCB0b3RhbEV4cGVjdGVkQXJncyB2YWx1ZXNcbiAqL1xuZnVuY3Rpb24gYWRkUGFyYW0oXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSwgcHJlZGljYXRlOiBhbnksIHZhbHVlOiBvLkV4cHJlc3Npb24gfCBudWxsLCBhcmdOdW1iZXI6IG51bWJlcixcbiAgICB0b3RhbEV4cGVjdGVkQXJnczogbnVtYmVyKSB7XG4gIGlmIChwcmVkaWNhdGUgJiYgdmFsdWUpIHtcbiAgICBwYXJhbXMucHVzaCh2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoYXJnTnVtYmVyIDwgdG90YWxFeHBlY3RlZEFyZ3MpIHtcbiAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvcGVydHkobmFtZTogc3RyaW5nKTpcbiAgICB7cHJvcGVydHk6IHN0cmluZywgdW5pdDogc3RyaW5nLCBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW59IHtcbiAgbGV0IGhhc092ZXJyaWRlRmxhZyA9IGZhbHNlO1xuICBjb25zdCBvdmVycmlkZUluZGV4ID0gbmFtZS5pbmRleE9mKElNUE9SVEFOVF9GTEFHKTtcbiAgaWYgKG92ZXJyaWRlSW5kZXggIT09IC0xKSB7XG4gICAgbmFtZSA9IG92ZXJyaWRlSW5kZXggPiAwID8gbmFtZS5zdWJzdHJpbmcoMCwgb3ZlcnJpZGVJbmRleCkgOiAnJztcbiAgICBoYXNPdmVycmlkZUZsYWcgPSB0cnVlO1xuICB9XG5cbiAgbGV0IHVuaXQgPSAnJztcbiAgbGV0IHByb3BlcnR5ID0gbmFtZTtcbiAgY29uc3QgdW5pdEluZGV4ID0gbmFtZS5sYXN0SW5kZXhPZignLicpO1xuICBpZiAodW5pdEluZGV4ID4gMCkge1xuICAgIHVuaXQgPSBuYW1lLnN1YnN0cih1bml0SW5kZXggKyAxKTtcbiAgICBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyaW5nKDAsIHVuaXRJbmRleCk7XG4gIH1cblxuICByZXR1cm4ge3Byb3BlcnR5LCB1bml0LCBoYXNPdmVycmlkZUZsYWd9O1xufVxuIl19