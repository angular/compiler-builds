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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFtQixhQUFhLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUM1RSxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRXhFLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUduRCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUF1QnBDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTZCRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBMEN6QixZQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUF6QzlGLGlFQUFpRTtRQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDbEM7OztXQUdHO1FBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFFM0IsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwyQ0FBMkM7UUFDbkMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQ3RELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQzVELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQ3BELHNCQUFpQixHQUEyQixJQUFJLENBQUM7UUFFekQsd0RBQXdEO1FBQ3hELGtDQUFrQztRQUVsQzs7OztXQUlH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QztLQUNwQjtTQUFNLElBQUksU0FBUyxHQUFHLGlCQUFpQixFQUFFO1FBQ3hDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQzFCO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsSUFBWTtJQUV4QyxJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7SUFDNUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNuRCxJQUFJLGFBQWEsS0FBSyxDQUFDLENBQUMsRUFBRTtRQUN4QixJQUFJLEdBQUcsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNqRSxlQUFlLEdBQUcsSUFBSSxDQUFDO0tBQ3hCO0lBRUQsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2QsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3BCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFO1FBQ2pCLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNsQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7S0FDekM7SUFFRCxPQUFPLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUMsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEJpbmRpbmdUeXBlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzRW1wdHlFeHByZXNzaW9ufSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcblxuY29uc3QgSU1QT1JUQU5UX0ZMQUcgPSAnIWltcG9ydGFudCc7XG5cbi8qKlxuICogQSBzdHlsaW5nIGV4cHJlc3Npb24gc3VtbWFyeSB0aGF0IGlzIHRvIGJlIHByb2Nlc3NlZCBieSB0aGUgY29tcGlsZXJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbnN0cnVjdGlvbiB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiBudW1iZXI7XG4gIGJ1aWxkUGFyYW1zKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbltdO1xufVxuXG4vKipcbiAqIEFuIGludGVybmFsIHJlY29yZCBvZiB0aGUgaW5wdXQgZGF0YSBmb3IgYSBzdHlsaW5nIGJpbmRpbmdcbiAqL1xuaW50ZXJmYWNlIEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgaGFzT3ZlcnJpZGVGbGFnOiBib29sZWFuO1xuICBuYW1lOiBzdHJpbmd8bnVsbDtcbiAgdW5pdDogc3RyaW5nfG51bGw7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmFsdWU6IEFTVDtcbn1cblxuLyoqXG4gKiBQcm9kdWNlcyBjcmVhdGlvbi91cGRhdGUgaW5zdHJ1Y3Rpb25zIGZvciBhbGwgc3R5bGluZyBiaW5kaW5ncyAoY2xhc3MgYW5kIHN0eWxlKVxuICpcbiAqIEl0IGFsc28gcHJvZHVjZXMgdGhlIGNyZWF0aW9uIGluc3RydWN0aW9uIHRvIHJlZ2lzdGVyIGFsbCBpbml0aWFsIHN0eWxpbmcgdmFsdWVzXG4gKiAod2hpY2ggYXJlIGFsbCB0aGUgc3RhdGljIGNsYXNzPVwiLi4uXCIgYW5kIHN0eWxlPVwiLi4uXCIgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGV4aXN0XG4gKiBvbiBhbiBlbGVtZW50IHdpdGhpbiBhIHRlbXBsYXRlKS5cbiAqXG4gKiBUaGUgYnVpbGRlciBjbGFzcyBiZWxvdyBoYW5kbGVzIHByb2R1Y2luZyBpbnN0cnVjdGlvbnMgZm9yIHRoZSBmb2xsb3dpbmcgY2FzZXM6XG4gKlxuICogLSBTdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcyAoc3R5bGU9XCIuLi5cIiBhbmQgY2xhc3M9XCIuLi5cIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBtYXAgYmluZGluZ3MgKFtzdHlsZV09XCJtYXBcIiBhbmQgW2NsYXNzXT1cIm1hcHxzdHJpbmdcIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBwcm9wZXJ0eSBiaW5kaW5ncyAoW3N0eWxlLnByb3BdPVwiZXhwXCIgYW5kIFtjbGFzcy5uYW1lXT1cImV4cFwiKVxuICpcbiAqIER1ZSB0byB0aGUgY29tcGxleCByZWxhdGlvbnNoaXAgb2YgYWxsIG9mIHRoZXNlIGNhc2VzLCB0aGUgaW5zdHJ1Y3Rpb25zIGdlbmVyYXRlZFxuICogZm9yIHRoZXNlIGF0dHJpYnV0ZXMvcHJvcGVydGllcy9iaW5kaW5ncyBtdXN0IGJlIGRvbmUgc28gaW4gdGhlIGNvcnJlY3Qgb3JkZXIuIFRoZVxuICogb3JkZXIgd2hpY2ggdGhlc2UgbXVzdCBiZSBnZW5lcmF0ZWQgaXMgYXMgZm9sbG93czpcbiAqXG4gKiBpZiAoY3JlYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGluZyguLi4pXG4gKiB9XG4gKiBpZiAodXBkYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGVNYXAoLi4uKVxuICogICBlbGVtZW50Q2xhc3NNYXAoLi4uKVxuICogICBlbGVtZW50U3R5bGVQcm9wKC4uLilcbiAqICAgZWxlbWVudENsYXNzUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsaW5nQXBwKC4uLilcbiAqIH1cbiAqXG4gKiBUaGUgY3JlYXRpb24vdXBkYXRlIG1ldGhvZHMgd2l0aGluIHRoZSBidWlsZGVyIGNsYXNzIHByb2R1Y2UgdGhlc2UgaW5zdHJ1Y3Rpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU3R5bGluZ0J1aWxkZXIge1xuICAvKiogV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdGF0aWMgc3R5bGluZyB2YWx1ZXMgcHJlc2VudCAqL1xuICBwcml2YXRlIF9oYXNJbml0aWFsVmFsdWVzID0gZmFsc2U7XG4gIC8qKlxuICAgKiAgV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdHlsaW5nIGJpbmRpbmdzIHByZXNlbnRcbiAgICogIChpLmUuIGBbc3R5bGVdYCwgYFtjbGFzc11gLCBgW3N0eWxlLnByb3BdYCBvciBgW2NsYXNzLm5hbWVdYClcbiAgICovXG4gIHB1YmxpYyBoYXNCaW5kaW5ncyA9IGZhbHNlO1xuXG4gIC8qKiB0aGUgaW5wdXQgZm9yIFtjbGFzc10gKGlmIGl0IGV4aXN0cykgKi9cbiAgcHJpdmF0ZSBfY2xhc3NNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIC8qKiB0aGUgaW5wdXQgZm9yIFtzdHlsZV0gKGlmIGl0IGV4aXN0cykgKi9cbiAgcHJpdmF0ZSBfc3R5bGVNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIC8qKiBhbiBhcnJheSBvZiBlYWNoIFtzdHlsZS5wcm9wXSBpbnB1dCAqL1xuICBwcml2YXRlIF9zaW5nbGVTdHlsZUlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW2NsYXNzLm5hbWVdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZUNsYXNzSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9sYXN0U3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcblxuICAvLyBtYXBzIGFyZSB1c2VkIGluc3RlYWQgb2YgaGFzaCBtYXBzIGJlY2F1c2UgYSBNYXAgd2lsbFxuICAvLyByZXRhaW4gdGhlIG9yZGVyaW5nIG9mIHRoZSBrZXlzXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggc3R5bGUgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW3N0eWxlLndpZHRoXT1cIndcIiBbc3R5bGUuaGVpZ2h0XT1cImhcIj5gIGltcGxpZXNcbiAgICogdGhhdCBgd2lkdGg9MGAgYW5kIGBoZWlnaHQ9MWApXG4gICAqL1xuICBwcml2YXRlIF9zdHlsZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggY2xhc3MgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW2NsYXNzLmJpZ109XCJiXCIgW2NsYXNzLmhpZGRlbl09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYGJpZz0wYCBhbmQgYGhpZGRlbj0xYClcbiAgICovXG4gIHByaXZhdGUgX2NsYXNzZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxTdHlsZVZhbHVlczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBfaW5pdGlhbENsYXNzVmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGNlcnRhaW4gc3R5bGUgcHJvcGVydGllcyBBTFdBWVMgbmVlZCBzYW5pdGl6YXRpb25cbiAgLy8gdGhpcyBpcyBjaGVja2VkIGVhY2ggdGltZSBuZXcgc3R5bGVzIGFyZSBlbmNvdW50ZXJlZFxuICBwcml2YXRlIF91c2VEZWZhdWx0U2FuaXRpemVyID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZWxlbWVudEluZGV4RXhwcjogby5FeHByZXNzaW9uLCBwcml2YXRlIF9kaXJlY3RpdmVFeHByOiBvLkV4cHJlc3Npb258bnVsbCkge31cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgZ2l2ZW4gaW5wdXQgdG8gdGhlIHN0eWxpbmcgYnVpbGRlciB0byBiZSBsYXRlciB1c2VkIHdoZW4gcHJvZHVjaW5nIEFPVCBjb2RlLlxuICAgKlxuICAgKiBUaGUgY29kZSBiZWxvdyB3aWxsIG9ubHkgYWNjZXB0IHRoZSBpbnB1dCBpZiBpdCBpcyBzb21laG93IHRpZWQgdG8gc3R5bGluZyAod2hldGhlciBpdCBiZVxuICAgKiBzdHlsZS9jbGFzcyBiaW5kaW5ncyBvciBzdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcykuXG4gICAqL1xuICByZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIGFyZSBza2lwcGVkIGluIHRoZSBjb2RlIGJlbG93LFxuICAgIC8vIHRoZXkgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIHN0eWxpbmctYmFzZWQgYmluZGluZ3Mgc2luY2VcbiAgICAvLyB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyIGFuZFxuICAgIC8vIHdpbGwgdGhlcmVmb3JlIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgLy8gd2l0aCBzdHlsZT1cIlwiLCBbc3R5bGVdPVwiXCIgYW5kIFtzdHlsZS5wcm9wXT1cIlwiLCBjbGFzcz1cIlwiLFxuICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWUgPSBpbnB1dC5uYW1lO1xuICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnB1dC51bml0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG5cbiAgcmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgbmFtZVRvTWF0Y2ggPSBuYW1lLnN1YnN0cmluZygwLCA1KTsgIC8vIGNsYXNzIHwgc3R5bGVcbiAgICBjb25zdCBpc1N0eWxlID0gbmFtZVRvTWF0Y2ggPT09ICdzdHlsZSc7XG4gICAgY29uc3QgaXNDbGFzcyA9IGlzU3R5bGUgPyBmYWxzZSA6IChuYW1lVG9NYXRjaCA9PT0gJ2NsYXNzJyk7XG4gICAgaWYgKGlzU3R5bGUgfHwgaXNDbGFzcykge1xuICAgICAgY29uc3QgaXNNYXBCYXNlZCA9IG5hbWUuY2hhckF0KDUpICE9PSAnLic7ICAgICAgICAgLy8gc3R5bGUucHJvcCBvciBjbGFzcy5wcm9wIG1ha2VzIHRoaXMgYSBub1xuICAgICAgY29uc3QgcHJvcGVydHkgPSBuYW1lLnN1YnN0cihpc01hcEJhc2VkID8gNSA6IDYpOyAgLy8gdGhlIGRvdCBleHBsYWlucyB3aHkgdGhlcmUncyBhICsxXG4gICAgICBpZiAoaXNTdHlsZSkge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KHByb3BlcnR5LCBpc01hcEJhc2VkLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmc7XG4gIH1cblxuICByZWdpc3RlclN0eWxlSW5wdXQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHVuaXQ/OiBzdHJpbmd8bnVsbCk6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwge1xuICAgIGlmIChpc0VtcHR5RXhwcmVzc2lvbih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZywgdW5pdDogYmluZGluZ1VuaXR9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTogQm91bmRTdHlsaW5nRW50cnkgPSB7XG4gICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgIHVuaXQ6IHVuaXQgfHwgYmluZGluZ1VuaXQsIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWdcbiAgICB9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID0gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKG5hbWUpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICByZWdpc3RlckNsYXNzSW5wdXQobmFtZTogc3RyaW5nLCBpc01hcEJhc2VkOiBib29sZWFuLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgQm91bmRTdHlsaW5nRW50cnl8bnVsbCB7XG4gICAgaWYgKGlzRW1wdHlFeHByZXNzaW9uKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHtwcm9wZXJ0eSwgaGFzT3ZlcnJpZGVGbGFnfSA9IHBhcnNlUHJvcGVydHkobmFtZSk7XG4gICAgY29uc3QgZW50cnk6XG4gICAgICAgIEJvdW5kU3R5bGluZ0VudHJ5ID0ge25hbWU6IHByb3BlcnR5LCB2YWx1ZSwgc291cmNlU3BhbiwgaGFzT3ZlcnJpZGVGbGFnLCB1bml0OiBudWxsfTtcbiAgICBpZiAoaXNNYXBCYXNlZCkge1xuICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIHN0eWxlIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBzdHlsZSBzdHJpbmcgKGUuZy4gYHdpZHRoOjEwMHB4OyBoZWlnaHQ6MjAwcHg7YClcbiAgICovXG4gIHJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgY2xhc3Mgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIGNsYXNzTmFtZSBzdHJpbmcgKGUuZy4gYGRpc2FibGVkIGdvbGQgem9vbWApXG4gICAqL1xuICByZWdpc3RlckNsYXNzQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYWxsIHN0eWxpbmctcmVsYXRlZCBleHByZXNzaW9ucyB0byB0aGUgcHJvdmlkZWQgYXR0cnMgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSBhdHRycyBhbiBleGlzdGluZyBhcnJheSB3aGVyZSBlYWNoIG9mIHRoZSBzdHlsaW5nIGV4cHJlc3Npb25zXG4gICAqIHdpbGwgYmUgaW5zZXJ0ZWQgaW50by5cbiAgICovXG4gIHBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyczogby5FeHByZXNzaW9uW10pOiB2b2lkIHtcbiAgICAvLyBbQ0xBU1NfTUFSS0VSLCAnZm9vJywgJ2JhcicsICdiYXonIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlc1tpXSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFtTVFlMRV9NQVJLRVIsICd3aWR0aCcsICcyMDBweCcsICdoZWlnaHQnLCAnMTAwcHgnLCAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGF0dHJzLnB1c2goXG4gICAgICAgICAgICBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2ldKSwgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpICsgMV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRIb3N0QXR0cnNgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZ2VuZXJhdGlvbiBjb2RlIGJlbG93IGlzIHVzZWQgZm9yIHByb2R1Y2luZyB0aGUgQU9UIHN0YXRlbWVudCBjb2RlIHdoaWNoIGlzXG4gICAqIHJlc3BvbnNpYmxlIGZvciByZWdpc3RlcmluZyBpbml0aWFsIHN0eWxlcyAod2l0aGluIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncycgY3JlYXRpb24gYmxvY2spLFxuICAgKiBhcyB3ZWxsIGFzIGFueSBvZiB0aGUgcHJvdmlkZWQgYXR0cmlidXRlIHZhbHVlcywgdG8gdGhlIGRpcmVjdGl2ZSBob3N0IGVsZW1lbnQuXG4gICAqL1xuICBidWlsZEhvc3RBdHRyc0luc3RydWN0aW9uKFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGF0dHJzOiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIgJiYgKGF0dHJzLmxlbmd0aCB8fCB0aGlzLl9oYXNJbml0aWFsVmFsdWVzKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50SG9zdEF0dHJzLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCxcbiAgICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAvLyBwYXJhbXMgPT4gZWxlbWVudEhvc3RBdHRycyhhZ2V0RGlyZWN0aXZlQ29udGV4dCgpdHRycylcbiAgICAgICAgICB0aGlzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRycyk7XG4gICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gIWF0dHJzLnNvbWUoYXR0ciA9PiBhdHRyIGluc3RhbmNlb2Ygby5XcmFwcGVkTm9kZUV4cHIpID9cbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgYXR0cnMpIDpcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKGF0dHJzKTtcbiAgICAgICAgICByZXR1cm4gW2F0dHJBcnJheV07XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50U3R5bGluZ2AuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBnZW5lcmF0aW9uIGNvZGUgYmVsb3cgaXMgdXNlZCBmb3IgcHJvZHVjaW5nIHRoZSBBT1Qgc3RhdGVtZW50IGNvZGUgd2hpY2ggaXNcbiAgICogcmVzcG9uc2libGUgZm9yIHJlZ2lzdGVyaW5nIHN0eWxlL2NsYXNzIGJpbmRpbmdzIHRvIGFuIGVsZW1lbnQuXG4gICAqL1xuICBidWlsZEVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24oc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTpcbiAgICAgIEluc3RydWN0aW9ufG51bGwge1xuICAgIGNvbnN0IHJlZmVyZW5jZSA9IHRoaXMuX2RpcmVjdGl2ZUV4cHIgPyBSMy5lbGVtZW50SG9zdFN0eWxpbmcgOiBSMy5lbGVtZW50U3R5bGluZztcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5ncykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAvLyBhIHN0cmluZyBhcnJheSBvZiBldmVyeSBzdHlsZS1iYXNlZCBiaW5kaW5nXG4gICAgICAgICAgY29uc3Qgc3R5bGVCaW5kaW5nUHJvcHMgPVxuICAgICAgICAgICAgICB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyA/IHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzLm1hcChpID0+IG8ubGl0ZXJhbChpLm5hbWUpKSA6IFtdO1xuICAgICAgICAgIC8vIGEgc3RyaW5nIGFycmF5IG9mIGV2ZXJ5IGNsYXNzLWJhc2VkIGJpbmRpbmdcbiAgICAgICAgICBjb25zdCBjbGFzc0JpbmRpbmdOYW1lcyA9XG4gICAgICAgICAgICAgIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzID8gdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMubWFwKGkgPT4gby5saXRlcmFsKGkubmFtZSkpIDogW107XG5cbiAgICAgICAgICAvLyB0byBzYWx2YWdlIHNwYWNlIGluIHRoZSBBT1QgZ2VuZXJhdGVkIGNvZGUsIHRoZXJlIGlzIG5vIHBvaW50IGluIHBhc3NpbmdcbiAgICAgICAgICAvLyBpbiBgbnVsbGAgaW50byBhIHBhcmFtIGlmIGFueSBmb2xsb3ctdXAgcGFyYW1zIGFyZSBub3QgdXNlZC4gVGhlcmVmb3JlLFxuICAgICAgICAgIC8vIG9ubHkgd2hlbiBhIHRyYWlsaW5nIHBhcmFtIGlzIHVzZWQgdGhlbiBpdCB3aWxsIGJlIGZpbGxlZCB3aXRoIG51bGxzIGluIGJldHdlZW5cbiAgICAgICAgICAvLyAob3RoZXJ3aXNlIGEgc2hvcnRlciBhbW91bnQgb2YgcGFyYW1zIHdpbGwgYmUgZmlsbGVkKS4gVGhlIGNvZGUgYmVsb3cgaGVscHNcbiAgICAgICAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcGFyYW1zIGFyZSByZXF1aXJlZCBpbiB0aGUgZXhwcmVzc2lvbiBjb2RlLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nKClcbiAgICAgICAgICAvLyAgIG1heCBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nKGNsYXNzQmluZGluZ3MsIHN0eWxlQmluZGluZ3MsIHNhbml0aXplcilcbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFRlbXBsYXRlOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZygpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKGNsYXNzQmluZGluZ3MsIHN0eWxlQmluZGluZ3MsIHNhbml0aXplcilcbiAgICAgICAgICAvL1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgICBsZXQgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAwO1xuICAgICAgICAgIGlmICh0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmIChzdHlsZUJpbmRpbmdQcm9wcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMjtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzQmluZGluZ05hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAxO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIGNsYXNzQmluZGluZ05hbWVzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIGNsYXNzQmluZGluZ05hbWVzKSwgMSxcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIHN0eWxlQmluZGluZ1Byb3BzKSwgMixcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIsIG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpLCAzLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRDbGFzc01hcGAuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBkYXRhIHdpbGwgY29udGFpbiBhbGwgZXhwcmVzc2lvbnMgZm9yIGBlbGVtZW50Q2xhc3NNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGVzIHRoZSBgW2NsYXNzXWAgZXhwcmVzc2lvbiBwYXJhbXMuXG4gICAqL1xuICBidWlsZEVsZW1lbnRDbGFzc01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9jbGFzc01hcElucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyLCB0cnVlLCB0aGlzLl9jbGFzc01hcElucHV0KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRTdHlsZU1hcGAuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBkYXRhIHdpbGwgY29udGFpbiBhbGwgZXhwcmVzc2lvbnMgZm9yIGBlbGVtZW50U3R5bGVNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGVzIHRoZSBgW3N0eWxlXWAgZXhwcmVzc2lvbiBwYXJhbXMuXG4gICAqL1xuICBidWlsZEVsZW1lbnRTdHlsZU1hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyLCBmYWxzZSwgdGhpcy5fc3R5bGVNYXBJbnB1dCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKFxuICAgICAgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyLCBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sIHN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnkpIHtcbiAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDA7XG5cbiAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgIC8vIGJlIGV2YWx1YXRlZCAodGhlIEFTVCB2aXNpdCBjYWxsKSBkdXJpbmcgY3JlYXRpb24gdGltZSBzbyB0aGF0IGFueVxuICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgY29uc3QgbWFwVmFsdWUgPSBzdHlsaW5nSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgIGlmIChtYXBWYWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gbWFwVmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIH1cblxuICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSB0aGlzLl9kaXJlY3RpdmVFeHByO1xuICAgIGxldCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gICAgaWYgKGlzQ2xhc3NCYXNlZCkge1xuICAgICAgcmVmZXJlbmNlID0gaXNIb3N0QmluZGluZyA/IFIzLmVsZW1lbnRIb3N0Q2xhc3NNYXAgOiBSMy5lbGVtZW50Q2xhc3NNYXA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdFN0eWxlTWFwIDogUjMuZWxlbWVudFN0eWxlTWFwO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiBzdHlsaW5nSW5wdXQuc291cmNlU3BhbixcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHsgcmV0dXJuIFtjb252ZXJ0Rm4obWFwVmFsdWUpXTsgfVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgaW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdLCBtYXBJbmRleDogTWFwPHN0cmluZywgbnVtYmVyPixcbiAgICAgIGFsbG93VW5pdHM6IGJvb2xlYW4sIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMDtcbiAgICByZXR1cm4gaW5wdXRzLm1hcChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nSW5kZXg6IG51bWJlciA9IG1hcEluZGV4LmdldChpbnB1dC5uYW1lICEpICE7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAwO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQsIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICAvLyBIT1NUOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmdQcm9wKGJpbmRpbmdJbmRleCwgdmFsdWUpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRIb3N0U3R5bGluZ1Byb3AoYmluZGluZ0luZGV4LCB2YWx1ZSwgb3ZlcnJpZGVGbGFnKVxuICAgICAgICAgIC8vIFRlbXBsYXRlOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ1Byb3AoZWxtSW5kZXgsIGJpbmRpbmdJbmRleCwgdmFsdWUpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nUHJvcChlbG1JbmRleCwgYmluZGluZ0luZGV4LCB2YWx1ZSwgb3ZlcnJpZGVGbGFnKVxuICAgICAgICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoYmluZGluZ0luZGV4KSk7XG4gICAgICAgICAgcGFyYW1zLnB1c2goY29udmVydEZuKHZhbHVlKSk7XG5cbiAgICAgICAgICBpZiAoYWxsb3dVbml0cykge1xuICAgICAgICAgICAgaWYgKGlucHV0LnVuaXQpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlucHV0LnVuaXQpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5wdXQuaGFzT3ZlcnJpZGVGbGFnKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaW5wdXQuaGFzT3ZlcnJpZGVGbGFnKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cykge1xuICAgICAgY29uc3QgaXNIb3N0QmluZGluZyA9ICEhdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICAgIGNvbnN0IHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdENsYXNzUHJvcCA6IFIzLmVsZW1lbnRDbGFzc1Byb3A7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgcmVmZXJlbmNlLCB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cywgdGhpcy5fY2xhc3Nlc0luZGV4LCBmYWxzZSwgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cykge1xuICAgICAgY29uc3QgaXNIb3N0QmluZGluZyA9ICEhdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICAgIGNvbnN0IHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdFN0eWxlUHJvcCA6IFIzLmVsZW1lbnRTdHlsZVByb3A7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgcmVmZXJlbmNlLCB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cywgdGhpcy5fc3R5bGVzSW5kZXgsIHRydWUsIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRBcHBseUZuKCk6IEluc3RydWN0aW9uIHtcbiAgICBjb25zdCBpc0hvc3RCaW5kaW5nID0gdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsaW5nQXBwbHkgOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5O1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID8gdGhpcy5fbGFzdFN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuIDogbnVsbCxcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHsgcmV0dXJuIFtdOyB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFsbCBpbnN0cnVjdGlvbnMgd2hpY2ggY29udGFpbiB0aGUgZXhwcmVzc2lvbnMgdGhhdCB3aWxsIGJlIHBsYWNlZFxuICAgKiBpbnRvIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSB0ZW1wbGF0ZSBmdW5jdGlvbiBvciBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MgZnVuY3Rpb24uXG4gICAqL1xuICBidWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcikge1xuICAgIGNvbnN0IGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzKSB7XG4gICAgICBjb25zdCBzdHlsZU1hcEluc3RydWN0aW9uID0gdGhpcy5idWlsZEVsZW1lbnRTdHlsZU1hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmIChzdHlsZU1hcEluc3RydWN0aW9uKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKHN0eWxlTWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgY29uc3QgY2xhc3NNYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRFbGVtZW50Q2xhc3NNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAoY2xhc3NNYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChjbGFzc01hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKHRoaXMuX2J1aWxkQXBwbHlGbigpKTtcbiAgICB9XG4gICAgcmV0dXJuIGluc3RydWN0aW9ucztcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3RlckludG9NYXAobWFwOiBNYXA8c3RyaW5nLCBudW1iZXI+LCBrZXk6IHN0cmluZykge1xuICBpZiAoIW1hcC5oYXMoa2V5KSkge1xuICAgIG1hcC5zZXQoa2V5LCBtYXAuc2l6ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gcHJvcCA9PT0gJ2JhY2tncm91bmQtaW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kJyB8fCBwcm9wID09PSAnYm9yZGVyLWltYWdlJyB8fFxuICAgICAgcHJvcCA9PT0gJ2ZpbHRlcicgfHwgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUnIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlLWltYWdlJztcbn1cblxuLyoqXG4gKiBTaW1wbGUgaGVscGVyIGZ1bmN0aW9uIHRvIGVpdGhlciBwcm92aWRlIHRoZSBjb25zdGFudCBsaXRlcmFsIHRoYXQgd2lsbCBob3VzZSB0aGUgdmFsdWVcbiAqIGhlcmUgb3IgYSBudWxsIHZhbHVlIGlmIHRoZSBwcm92aWRlZCB2YWx1ZXMgYXJlIGVtcHR5LlxuICovXG5mdW5jdGlvbiBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHZhbHVlczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gdmFsdWVzLmxlbmd0aCA/IGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHZhbHVlcyksIHRydWUpIDogby5OVUxMX0VYUFI7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0aGF0IGFkZHMgYSBwYXJhbWV0ZXIgb3IgZG9lcyBub3RoaW5nIGF0IGFsbCBkZXBlbmRpbmcgb24gdGhlIHByb3ZpZGVkXG4gKiBwcmVkaWNhdGUgYW5kIHRvdGFsRXhwZWN0ZWRBcmdzIHZhbHVlc1xuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdLCBwcmVkaWNhdGU6IGFueSwgdmFsdWU6IG8uRXhwcmVzc2lvbiB8IG51bGwsIGFyZ051bWJlcjogbnVtYmVyLFxuICAgIHRvdGFsRXhwZWN0ZWRBcmdzOiBudW1iZXIpIHtcbiAgaWYgKHByZWRpY2F0ZSAmJiB2YWx1ZSkge1xuICAgIHBhcmFtcy5wdXNoKHZhbHVlKTtcbiAgfSBlbHNlIGlmIChhcmdOdW1iZXIgPCB0b3RhbEV4cGVjdGVkQXJncykge1xuICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOlxuICAgIHtwcm9wZXJ0eTogc3RyaW5nLCB1bml0OiBzdHJpbmcsIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbn0ge1xuICBsZXQgaGFzT3ZlcnJpZGVGbGFnID0gZmFsc2U7XG4gIGNvbnN0IG92ZXJyaWRlSW5kZXggPSBuYW1lLmluZGV4T2YoSU1QT1JUQU5UX0ZMQUcpO1xuICBpZiAob3ZlcnJpZGVJbmRleCAhPT0gLTEpIHtcbiAgICBuYW1lID0gb3ZlcnJpZGVJbmRleCA+IDAgPyBuYW1lLnN1YnN0cmluZygwLCBvdmVycmlkZUluZGV4KSA6ICcnO1xuICAgIGhhc092ZXJyaWRlRmxhZyA9IHRydWU7XG4gIH1cblxuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHkgPSBuYW1lO1xuICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gIGlmICh1bml0SW5kZXggPiAwKSB7XG4gICAgdW5pdCA9IG5hbWUuc3Vic3RyKHVuaXRJbmRleCArIDEpO1xuICAgIHByb3BlcnR5ID0gbmFtZS5zdWJzdHJpbmcoMCwgdW5pdEluZGV4KTtcbiAgfVxuXG4gIHJldHVybiB7cHJvcGVydHksIHVuaXQsIGhhc092ZXJyaWRlRmxhZ307XG59XG4iXX0=