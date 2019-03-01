import { Interpolation } from '../../expression_parser/ast';
import * as o from '../../output/output_ast';
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
 *   elementStylingMap(...)
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
                    // params => elementHostAttrs(directive, attrs)
                    this.populateInitialStylingAttrs(attrs);
                    const attrArray = !attrs.some(attr => attr instanceof o.WrappedNodeExpr) ?
                        getConstantLiteralFromArray(constantPool, attrs) :
                        o.literalArr(attrs);
                    return [this._directiveExpr, attrArray];
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
        if (this.hasBindings) {
            return {
                sourceSpan,
                allocateBindingSlots: 0,
                reference: R3.elementStyling,
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
                    // min params => elementStyling()
                    // max params => elementStyling(classBindings, styleBindings, sanitizer, directive)
                    let expectedNumberOfArgs = 0;
                    if (this._directiveExpr) {
                        expectedNumberOfArgs = 4;
                    }
                    else if (this._useDefaultSanitizer) {
                        expectedNumberOfArgs = 3;
                    }
                    else if (styleBindingProps.length) {
                        expectedNumberOfArgs = 2;
                    }
                    else if (classBindingNames.length) {
                        expectedNumberOfArgs = 1;
                    }
                    const params = [];
                    addParam(params, classBindingNames.length > 0, getConstantLiteralFromArray(constantPool, classBindingNames), 1, expectedNumberOfArgs);
                    addParam(params, styleBindingProps.length > 0, getConstantLiteralFromArray(constantPool, styleBindingProps), 2, expectedNumberOfArgs);
                    addParam(params, this._useDefaultSanitizer, o.importExpr(R3.defaultStyleSanitizer), 3, expectedNumberOfArgs);
                    if (this._directiveExpr) {
                        params.push(this._directiveExpr);
                    }
                    return params;
                }
            };
        }
        return null;
    }
    /**
     * Builds an instruction with all the expressions and parameters for `elementStylingMap`.
     *
     * The instruction data will contain all expressions for `elementStylingMap` to function
     * which include the `[style]` and `[class]` expression params (if they exist) as well as
     * the sanitizer and directive reference expression.
     */
    buildElementStylingMapInstruction(valueConverter) {
        if (this._classMapInput || this._styleMapInput) {
            const stylingInput = this._classMapInput || this._styleMapInput;
            let totalBindingSlotsRequired = 0;
            // these values must be outside of the update block so that they can
            // be evaluted (the AST visit call) during creation time so that any
            // pipes can be picked up in time before the template is built
            const mapBasedClassValue = this._classMapInput ? this._classMapInput.value.visit(valueConverter) : null;
            if (mapBasedClassValue instanceof Interpolation) {
                totalBindingSlotsRequired += mapBasedClassValue.expressions.length;
            }
            const mapBasedStyleValue = this._styleMapInput ? this._styleMapInput.value.visit(valueConverter) : null;
            if (mapBasedStyleValue instanceof Interpolation) {
                totalBindingSlotsRequired += mapBasedStyleValue.expressions.length;
            }
            return {
                sourceSpan: stylingInput.sourceSpan,
                reference: R3.elementStylingMap,
                allocateBindingSlots: totalBindingSlotsRequired,
                buildParams: (convertFn) => {
                    // min params => elementStylingMap(index, classMap)
                    // max params => elementStylingMap(index, classMap, styleMap, directive)
                    let expectedNumberOfArgs = 0;
                    if (this._directiveExpr) {
                        expectedNumberOfArgs = 4;
                    }
                    else if (mapBasedStyleValue) {
                        expectedNumberOfArgs = 3;
                    }
                    else if (mapBasedClassValue) {
                        // index and class = 2
                        expectedNumberOfArgs = 2;
                    }
                    const params = [this._elementIndexExpr];
                    addParam(params, mapBasedClassValue, mapBasedClassValue ? convertFn(mapBasedClassValue) : null, 2, expectedNumberOfArgs);
                    addParam(params, mapBasedStyleValue, mapBasedStyleValue ? convertFn(mapBasedStyleValue) : null, 3, expectedNumberOfArgs);
                    addParam(params, this._directiveExpr, this._directiveExpr, 4, expectedNumberOfArgs);
                    return params;
                }
            };
        }
        return null;
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
                    // min params => elementStlyingProp(elmIndex, bindingIndex, value)
                    // max params => elementStlyingProp(elmIndex, bindingIndex, value, overrideFlag)
                    const params = [this._elementIndexExpr, o.literal(bindingIndex), convertFn(value)];
                    if (allowUnits) {
                        if (input.unit) {
                            params.push(o.literal(input.unit));
                        }
                        else if (this._directiveExpr) {
                            params.push(o.NULL_EXPR);
                        }
                    }
                    if (this._directiveExpr) {
                        params.push(this._directiveExpr);
                    }
                    else if (input.hasOverrideFlag) {
                        params.push(o.NULL_EXPR);
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
            return this._buildSingleInputs(R3.elementClassProp, this._singleClassInputs, this._classesIndex, false, valueConverter);
        }
        return [];
    }
    _buildStyleInputs(valueConverter) {
        if (this._singleStyleInputs) {
            return this._buildSingleInputs(R3.elementStyleProp, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
        }
        return [];
    }
    _buildApplyFn() {
        return {
            sourceSpan: this._lastStylingInput ? this._lastStylingInput.sourceSpan : null,
            reference: R3.elementStylingApply,
            allocateBindingSlots: 0,
            buildParams: () => {
                // min params => elementStylingApply(elmIndex)
                // max params => elementStylingApply(elmIndex, directive)
                const params = [this._elementIndexExpr];
                if (this._directiveExpr) {
                    params.push(this._directiveExpr);
                }
                return params;
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
            const mapInstruction = this.buildElementStylingMapInstruction(valueConverter);
            if (mapInstruction) {
                instructions.push(mapInstruction);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFtQixhQUFhLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUM1RSxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRzdDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUduRCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUF1QnBDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNEJHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUEwQ3pCLFlBQW9CLGlCQUErQixFQUFVLGNBQWlDO1FBQTFFLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBYztRQUFVLG1CQUFjLEdBQWQsY0FBYyxDQUFtQjtRQXpDOUYsaUVBQWlFO1FBQ3pELHNCQUFpQixHQUFHLEtBQUssQ0FBQztRQUNsQzs7O1dBR0c7UUFDSSxnQkFBVyxHQUFHLEtBQUssQ0FBQztRQUUzQiwyQ0FBMkM7UUFDbkMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQ3RELDJDQUEyQztRQUNuQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7UUFDdEQsMENBQTBDO1FBQ2xDLHVCQUFrQixHQUE2QixJQUFJLENBQUM7UUFDNUQsMENBQTBDO1FBQ2xDLHVCQUFrQixHQUE2QixJQUFJLENBQUM7UUFDcEQsc0JBQWlCLEdBQTJCLElBQUksQ0FBQztRQUV6RCx3REFBd0Q7UUFDeEQsa0NBQWtDO1FBRWxDOzs7O1dBSUc7UUFDSyxpQkFBWSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBRWpEOzs7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SSxTQUFTLElBQUksS0FBSyxFQUFFO1FBQ3RCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDcEI7U0FBTSxJQUFJLFNBQVMsR0FBRyxpQkFBaUIsRUFBRTtRQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUMxQjtBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLElBQVk7SUFFeEMsSUFBSSxlQUFlLEdBQUcsS0FBSyxDQUFDO0lBQzVCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDbkQsSUFBSSxhQUFhLEtBQUssQ0FBQyxDQUFDLEVBQUU7UUFDeEIsSUFBSSxHQUFHLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDakUsZUFBZSxHQUFHLElBQUksQ0FBQztLQUN4QjtJQUVELElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNkLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQztJQUNwQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRTtRQUNqQixJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbEMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ3pDO0lBRUQsT0FBTyxFQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFDLENBQUM7QUFDM0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7QXR0cmlidXRlTWFya2VyfSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBCaW5kaW5nVHlwZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuXG5pbXBvcnQge3BhcnNlIGFzIHBhcnNlU3R5bGV9IGZyb20gJy4vc3R5bGVfcGFyc2VyJztcbmltcG9ydCB7VmFsdWVDb252ZXJ0ZXJ9IGZyb20gJy4vdGVtcGxhdGUnO1xuXG5jb25zdCBJTVBPUlRBTlRfRkxBRyA9ICchaW1wb3J0YW50JztcblxuLyoqXG4gKiBBIHN0eWxpbmcgZXhwcmVzc2lvbiBzdW1tYXJ5IHRoYXQgaXMgdG8gYmUgcHJvY2Vzc2VkIGJ5IHRoZSBjb21waWxlclxuICovXG5leHBvcnQgaW50ZXJmYWNlIEluc3RydWN0aW9uIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZTtcbiAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IG51bWJlcjtcbiAgYnVpbGRQYXJhbXMoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uW107XG59XG5cbi8qKlxuICogQW4gaW50ZXJuYWwgcmVjb3JkIG9mIHRoZSBpbnB1dCBkYXRhIGZvciBhIHN0eWxpbmcgYmluZGluZ1xuICovXG5pbnRlcmZhY2UgQm91bmRTdHlsaW5nRW50cnkge1xuICBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW47XG4gIG5hbWU6IHN0cmluZ3xudWxsO1xuICB1bml0OiBzdHJpbmd8bnVsbDtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2YWx1ZTogQVNUO1xufVxuXG4vKipcbiAqIFByb2R1Y2VzIGNyZWF0aW9uL3VwZGF0ZSBpbnN0cnVjdGlvbnMgZm9yIGFsbCBzdHlsaW5nIGJpbmRpbmdzIChjbGFzcyBhbmQgc3R5bGUpXG4gKlxuICogSXQgYWxzbyBwcm9kdWNlcyB0aGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24gdG8gcmVnaXN0ZXIgYWxsIGluaXRpYWwgc3R5bGluZyB2YWx1ZXNcbiAqICh3aGljaCBhcmUgYWxsIHRoZSBzdGF0aWMgY2xhc3M9XCIuLi5cIiBhbmQgc3R5bGU9XCIuLi5cIiBhdHRyaWJ1dGUgdmFsdWVzIHRoYXQgZXhpc3RcbiAqIG9uIGFuIGVsZW1lbnQgd2l0aGluIGEgdGVtcGxhdGUpLlxuICpcbiAqIFRoZSBidWlsZGVyIGNsYXNzIGJlbG93IGhhbmRsZXMgcHJvZHVjaW5nIGluc3RydWN0aW9ucyBmb3IgdGhlIGZvbGxvd2luZyBjYXNlczpcbiAqXG4gKiAtIFN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzIChzdHlsZT1cIi4uLlwiIGFuZCBjbGFzcz1cIi4uLlwiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIG1hcCBiaW5kaW5ncyAoW3N0eWxlXT1cIm1hcFwiIGFuZCBbY2xhc3NdPVwibWFwfHN0cmluZ1wiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIHByb3BlcnR5IGJpbmRpbmdzIChbc3R5bGUucHJvcF09XCJleHBcIiBhbmQgW2NsYXNzLm5hbWVdPVwiZXhwXCIpXG4gKlxuICogRHVlIHRvIHRoZSBjb21wbGV4IHJlbGF0aW9uc2hpcCBvZiBhbGwgb2YgdGhlc2UgY2FzZXMsIHRoZSBpbnN0cnVjdGlvbnMgZ2VuZXJhdGVkXG4gKiBmb3IgdGhlc2UgYXR0cmlidXRlcy9wcm9wZXJ0aWVzL2JpbmRpbmdzIG11c3QgYmUgZG9uZSBzbyBpbiB0aGUgY29ycmVjdCBvcmRlci4gVGhlXG4gKiBvcmRlciB3aGljaCB0aGVzZSBtdXN0IGJlIGdlbmVyYXRlZCBpcyBhcyBmb2xsb3dzOlxuICpcbiAqIGlmIChjcmVhdGVNb2RlKSB7XG4gKiAgIGVsZW1lbnRTdHlsaW5nKC4uLilcbiAqIH1cbiAqIGlmICh1cGRhdGVNb2RlKSB7XG4gKiAgIGVsZW1lbnRTdHlsaW5nTWFwKC4uLilcbiAqICAgZWxlbWVudFN0eWxlUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRDbGFzc1Byb3AoLi4uKVxuICogICBlbGVtZW50U3R5bGluZ0FwcCguLi4pXG4gKiB9XG4gKlxuICogVGhlIGNyZWF0aW9uL3VwZGF0ZSBtZXRob2RzIHdpdGhpbiB0aGUgYnVpbGRlciBjbGFzcyBwcm9kdWNlIHRoZXNlIGluc3RydWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0eWxpbmdCdWlsZGVyIHtcbiAgLyoqIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3RhdGljIHN0eWxpbmcgdmFsdWVzIHByZXNlbnQgKi9cbiAgcHJpdmF0ZSBfaGFzSW5pdGlhbFZhbHVlcyA9IGZhbHNlO1xuICAvKipcbiAgICogIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3R5bGluZyBiaW5kaW5ncyBwcmVzZW50XG4gICAqICAoaS5lLiBgW3N0eWxlXWAsIGBbY2xhc3NdYCwgYFtzdHlsZS5wcm9wXWAgb3IgYFtjbGFzcy5uYW1lXWApXG4gICAqL1xuICBwdWJsaWMgaGFzQmluZGluZ3MgPSBmYWxzZTtcblxuICAvKiogdGhlIGlucHV0IGZvciBbY2xhc3NdIChpZiBpdCBleGlzdHMpICovXG4gIHByaXZhdGUgX2NsYXNzTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAvKiogdGhlIGlucHV0IGZvciBbc3R5bGVdIChpZiBpdCBleGlzdHMpICovXG4gIHByaXZhdGUgX3N0eWxlTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbc3R5bGUucHJvcF0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlU3R5bGVJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIC8qKiBhbiBhcnJheSBvZiBlYWNoIFtjbGFzcy5uYW1lXSBpbnB1dCAqL1xuICBwcml2YXRlIF9zaW5nbGVDbGFzc0lucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfbGFzdFN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG5cbiAgLy8gbWFwcyBhcmUgdXNlZCBpbnN0ZWFkIG9mIGhhc2ggbWFwcyBiZWNhdXNlIGEgTWFwIHdpbGxcbiAgLy8gcmV0YWluIHRoZSBvcmRlcmluZyBvZiB0aGUga2V5c1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIHN0eWxlIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtzdHlsZS53aWR0aF09XCJ3XCIgW3N0eWxlLmhlaWdodF09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYHdpZHRoPTBgIGFuZCBgaGVpZ2h0PTFgKVxuICAgKi9cbiAgcHJpdmF0ZSBfc3R5bGVzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIGNsYXNzIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtjbGFzcy5iaWddPVwiYlwiIFtjbGFzcy5oaWRkZW5dPVwiaFwiPmAgaW1wbGllc1xuICAgKiB0aGF0IGBiaWc9MGAgYW5kIGBoaWRkZW49MWApXG4gICAqL1xuICBwcml2YXRlIF9jbGFzc2VzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBwcml2YXRlIF9pbml0aWFsU3R5bGVWYWx1ZXM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgX2luaXRpYWxDbGFzc1ZhbHVlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBjZXJ0YWluIHN0eWxlIHByb3BlcnRpZXMgQUxXQVlTIG5lZWQgc2FuaXRpemF0aW9uXG4gIC8vIHRoaXMgaXMgY2hlY2tlZCBlYWNoIHRpbWUgbmV3IHN0eWxlcyBhcmUgZW5jb3VudGVyZWRcbiAgcHJpdmF0ZSBfdXNlRGVmYXVsdFNhbml0aXplciA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2VsZW1lbnRJbmRleEV4cHI6IG8uRXhwcmVzc2lvbiwgcHJpdmF0ZSBfZGlyZWN0aXZlRXhwcjogby5FeHByZXNzaW9ufG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGdpdmVuIGlucHV0IHRvIHRoZSBzdHlsaW5nIGJ1aWxkZXIgdG8gYmUgbGF0ZXIgdXNlZCB3aGVuIHByb2R1Y2luZyBBT1QgY29kZS5cbiAgICpcbiAgICogVGhlIGNvZGUgYmVsb3cgd2lsbCBvbmx5IGFjY2VwdCB0aGUgaW5wdXQgaWYgaXQgaXMgc29tZWhvdyB0aWVkIHRvIHN0eWxpbmcgKHdoZXRoZXIgaXQgYmVcbiAgICogc3R5bGUvY2xhc3MgYmluZGluZ3Mgb3Igc3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMpLlxuICAgKi9cbiAgcmVnaXN0ZXJCb3VuZElucHV0KGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKTogYm9vbGVhbiB7XG4gICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBhcmUgc2tpcHBlZCBpbiB0aGUgY29kZSBiZWxvdyxcbiAgICAvLyB0aGV5IHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkIGJpbmRpbmdzIHNpbmNlXG4gICAgLy8gdGhleSBhcmUgaW50ZW5kZWQgdG8gYmUgd3JpdHRlbiBkaXJlY3RseSB0byB0aGUgYXR0ciBhbmRcbiAgICAvLyB3aWxsIHRoZXJlZm9yZSBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAvLyBbY2xhc3MucHJvcF09XCJcIi4gW2NsYXNzXT1cIlwiIGFzc2lnbm1lbnRzXG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGxldCBuYW1lID0gaW5wdXQubmFtZTtcbiAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3BhbiwgaW5wdXQudW5pdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZyA/IHRydWUgOiBmYWxzZTtcbiAgfVxuXG4gIHJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGNvbnN0IG5hbWVUb01hdGNoID0gbmFtZS5zdWJzdHJpbmcoMCwgNSk7ICAvLyBjbGFzcyB8IHN0eWxlXG4gICAgY29uc3QgaXNTdHlsZSA9IG5hbWVUb01hdGNoID09PSAnc3R5bGUnO1xuICAgIGNvbnN0IGlzQ2xhc3MgPSBpc1N0eWxlID8gZmFsc2UgOiAobmFtZVRvTWF0Y2ggPT09ICdjbGFzcycpO1xuICAgIGlmIChpc1N0eWxlIHx8IGlzQ2xhc3MpIHtcbiAgICAgIGNvbnN0IGlzTWFwQmFzZWQgPSBuYW1lLmNoYXJBdCg1KSAhPT0gJy4nOyAgICAgICAgIC8vIHN0eWxlLnByb3Agb3IgY2xhc3MucHJvcCBtYWtlcyB0aGlzIGEgbm9cbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gbmFtZS5zdWJzdHIoaXNNYXBCYXNlZCA/IDUgOiA2KTsgIC8vIHRoZSBkb3QgZXhwbGFpbnMgd2h5IHRoZXJlJ3MgYSArMVxuICAgICAgaWYgKGlzU3R5bGUpIHtcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KHByb3BlcnR5LCBpc01hcEJhc2VkLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nO1xuICB9XG5cbiAgcmVnaXN0ZXJTdHlsZUlucHV0KFxuICAgICAgbmFtZTogc3RyaW5nLCBpc01hcEJhc2VkOiBib29sZWFuLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB1bml0Pzogc3RyaW5nfG51bGwpOiBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gICAgY29uc3Qge3Byb3BlcnR5LCBoYXNPdmVycmlkZUZsYWcsIHVuaXQ6IGJpbmRpbmdVbml0fSA9IHBhcnNlUHJvcGVydHkobmFtZSk7XG4gICAgY29uc3QgZW50cnk6IEJvdW5kU3R5bGluZ0VudHJ5ID0ge1xuICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICB1bml0OiB1bml0IHx8IGJpbmRpbmdVbml0LCB2YWx1ZSwgc291cmNlU3BhbiwgaGFzT3ZlcnJpZGVGbGFnXG4gICAgfTtcbiAgICBpZiAoaXNNYXBCYXNlZCkge1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRydWU7XG4gICAgICB0aGlzLl9zdHlsZU1hcElucHV0ID0gZW50cnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyA9IHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzIHx8IFtdKS5wdXNoKGVudHJ5KTtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyIHx8IGlzU3R5bGVTYW5pdGl6YWJsZShuYW1lKTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9zdHlsZXNJbmRleCwgcHJvcGVydHkpO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgdGhpcy5oYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgcmVnaXN0ZXJDbGFzc0lucHV0KG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTpcbiAgICAgIEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZ30gPSBwYXJzZVByb3BlcnR5KG5hbWUpO1xuICAgIGNvbnN0IGVudHJ5OlxuICAgICAgICBCb3VuZFN0eWxpbmdFbnRyeSA9IHtuYW1lOiBwcm9wZXJ0eSwgdmFsdWUsIHNvdXJjZVNwYW4sIGhhc092ZXJyaWRlRmxhZywgdW5pdDogbnVsbH07XG4gICAgaWYgKGlzTWFwQmFzZWQpIHtcbiAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzID0gdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX2NsYXNzZXNJbmRleCwgcHJvcGVydHkpO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgdGhpcy5oYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgZWxlbWVudCdzIHN0YXRpYyBzdHlsZSBzdHJpbmcgdmFsdWUgdG8gdGhlIGJ1aWxkZXIuXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgc3R5bGUgc3RyaW5nIChlLmcuIGB3aWR0aDoxMDBweDsgaGVpZ2h0OjIwMHB4O2ApXG4gICAqL1xuICByZWdpc3RlclN0eWxlQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzID0gcGFyc2VTdHlsZSh2YWx1ZSk7XG4gICAgdGhpcy5faGFzSW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIGNsYXNzIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBjbGFzc05hbWUgc3RyaW5nIChlLmcuIGBkaXNhYmxlZCBnb2xkIHpvb21gKVxuICAgKi9cbiAgcmVnaXN0ZXJDbGFzc0F0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFsbCBzdHlsaW5nLXJlbGF0ZWQgZXhwcmVzc2lvbnMgdG8gdGhlIHByb3ZpZGVkIGF0dHJzIGFycmF5LlxuICAgKlxuICAgKiBAcGFyYW0gYXR0cnMgYW4gZXhpc3RpbmcgYXJyYXkgd2hlcmUgZWFjaCBvZiB0aGUgc3R5bGluZyBleHByZXNzaW9uc1xuICAgKiB3aWxsIGJlIGluc2VydGVkIGludG8uXG4gICAqL1xuICBwb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogdm9pZCB7XG4gICAgLy8gW0NMQVNTX01BUktFUiwgJ2ZvbycsICdiYXInLCAnYmF6JyAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXNbaV0pKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBbU1RZTEVfTUFSS0VSLCAnd2lkdGgnLCAnMjAwcHgnLCAnaGVpZ2h0JywgJzEwMHB4JywgLi4uXVxuICAgIGlmICh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMubGVuZ3RoKSB7XG4gICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbChBdHRyaWJ1dGVNYXJrZXIuU3R5bGVzKSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBhdHRycy5wdXNoKFxuICAgICAgICAgICAgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpXSksIG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXNbaSArIDFdKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50SG9zdEF0dHJzYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgaW5pdGlhbCBzdHlsZXMgKHdpdGhpbiBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MnIGNyZWF0aW9uIGJsb2NrKSxcbiAgICogYXMgd2VsbCBhcyBhbnkgb2YgdGhlIHByb3ZpZGVkIGF0dHJpYnV0ZSB2YWx1ZXMsIHRvIHRoZSBkaXJlY3RpdmUgaG9zdCBlbGVtZW50LlxuICAgKi9cbiAgYnVpbGRIb3N0QXR0cnNJbnN0cnVjdGlvbihcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBhdHRyczogby5FeHByZXNzaW9uW10sXG4gICAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IEluc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByICYmIChhdHRycy5sZW5ndGggfHwgdGhpcy5faGFzSW5pdGlhbFZhbHVlcykpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudEhvc3RBdHRycyxcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoKSA9PiB7XG4gICAgICAgICAgLy8gcGFyYW1zID0+IGVsZW1lbnRIb3N0QXR0cnMoZGlyZWN0aXZlLCBhdHRycylcbiAgICAgICAgICB0aGlzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRycyk7XG4gICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gIWF0dHJzLnNvbWUoYXR0ciA9PiBhdHRyIGluc3RhbmNlb2Ygby5XcmFwcGVkTm9kZUV4cHIpID9cbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgYXR0cnMpIDpcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKGF0dHJzKTtcbiAgICAgICAgICByZXR1cm4gW3RoaXMuX2RpcmVjdGl2ZUV4cHIgISwgYXR0ckFycmF5XTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgc3R5bGUvY2xhc3MgYmluZGluZ3MgdG8gYW4gZWxlbWVudC5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOlxuICAgICAgSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3MpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nLFxuICAgICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAgIC8vIGEgc3RyaW5nIGFycmF5IG9mIGV2ZXJ5IHN0eWxlLWJhc2VkIGJpbmRpbmdcbiAgICAgICAgICBjb25zdCBzdHlsZUJpbmRpbmdQcm9wcyA9XG4gICAgICAgICAgICAgIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID8gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMubWFwKGkgPT4gby5saXRlcmFsKGkubmFtZSkpIDogW107XG4gICAgICAgICAgLy8gYSBzdHJpbmcgYXJyYXkgb2YgZXZlcnkgY2xhc3MtYmFzZWQgYmluZGluZ1xuICAgICAgICAgIGNvbnN0IGNsYXNzQmluZGluZ05hbWVzID1cbiAgICAgICAgICAgICAgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPyB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cy5tYXAoaSA9PiBvLmxpdGVyYWwoaS5uYW1lKSkgOiBbXTtcblxuICAgICAgICAgIC8vIHRvIHNhbHZhZ2Ugc3BhY2UgaW4gdGhlIEFPVCBnZW5lcmF0ZWQgY29kZSwgdGhlcmUgaXMgbm8gcG9pbnQgaW4gcGFzc2luZ1xuICAgICAgICAgIC8vIGluIGBudWxsYCBpbnRvIGEgcGFyYW0gaWYgYW55IGZvbGxvdy11cCBwYXJhbXMgYXJlIG5vdCB1c2VkLiBUaGVyZWZvcmUsXG4gICAgICAgICAgLy8gb25seSB3aGVuIGEgdHJhaWxpbmcgcGFyYW0gaXMgdXNlZCB0aGVuIGl0IHdpbGwgYmUgZmlsbGVkIHdpdGggbnVsbHMgaW4gYmV0d2VlblxuICAgICAgICAgIC8vIChvdGhlcndpc2UgYSBzaG9ydGVyIGFtb3VudCBvZiBwYXJhbXMgd2lsbCBiZSBmaWxsZWQpLiBUaGUgY29kZSBiZWxvdyBoZWxwc1xuICAgICAgICAgIC8vIGRldGVybWluZSBob3cgbWFueSBwYXJhbXMgYXJlIHJlcXVpcmVkIGluIHRoZSBleHByZXNzaW9uIGNvZGUuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKClcbiAgICAgICAgICAvLyBtYXggcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKGNsYXNzQmluZGluZ3MsIHN0eWxlQmluZGluZ3MsIHNhbml0aXplciwgZGlyZWN0aXZlKVxuICAgICAgICAgIGxldCBleHBlY3RlZE51bWJlck9mQXJncyA9IDA7XG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gNDtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAyO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NCaW5kaW5nTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDE7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIGNsYXNzQmluZGluZ05hbWVzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIGNsYXNzQmluZGluZ05hbWVzKSwgMSxcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIHN0eWxlQmluZGluZ1Byb3BzKSwgMixcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIsIG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpLCAzLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudFN0eWxpbmdNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgZWxlbWVudFN0eWxpbmdNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGUgdGhlIGBbc3R5bGVdYCBhbmQgYFtjbGFzc11gIGV4cHJlc3Npb24gcGFyYW1zIChpZiB0aGV5IGV4aXN0KSBhcyB3ZWxsIGFzXG4gICAqIHRoZSBzYW5pdGl6ZXIgYW5kIGRpcmVjdGl2ZSByZWZlcmVuY2UgZXhwcmVzc2lvbi5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCB8fCB0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXQgPSB0aGlzLl9jbGFzc01hcElucHV0ICEgfHwgdGhpcy5fc3R5bGVNYXBJbnB1dCAhO1xuICAgICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAwO1xuXG4gICAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgICAgLy8gYmUgZXZhbHV0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzVmFsdWUgPVxuICAgICAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPyB0aGlzLl9jbGFzc01hcElucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKSA6IG51bGw7XG4gICAgICBpZiAobWFwQmFzZWRDbGFzc1ZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IG1hcEJhc2VkQ2xhc3NWYWx1ZS5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA/IHRoaXMuX3N0eWxlTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcbiAgICAgIGlmIChtYXBCYXNlZFN0eWxlVmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gbWFwQmFzZWRTdHlsZVZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudFN0eWxpbmdNYXAsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIC8vIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdNYXAoaW5kZXgsIGNsYXNzTWFwKVxuICAgICAgICAgIC8vIG1heCBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdNYXAoaW5kZXgsIGNsYXNzTWFwLCBzdHlsZU1hcCwgZGlyZWN0aXZlKVxuICAgICAgICAgIGxldCBleHBlY3RlZE51bWJlck9mQXJncyA9IDA7XG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gNDtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1hcEJhc2VkU3R5bGVWYWx1ZSkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWFwQmFzZWRDbGFzc1ZhbHVlKSB7XG4gICAgICAgICAgICAvLyBpbmRleCBhbmQgY2xhc3MgPSAyXG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgcGFyYW1zLCBtYXBCYXNlZENsYXNzVmFsdWUsIG1hcEJhc2VkQ2xhc3NWYWx1ZSA/IGNvbnZlcnRGbihtYXBCYXNlZENsYXNzVmFsdWUpIDogbnVsbCxcbiAgICAgICAgICAgICAgMiwgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIG1hcEJhc2VkU3R5bGVWYWx1ZSwgbWFwQmFzZWRTdHlsZVZhbHVlID8gY29udmVydEZuKG1hcEJhc2VkU3R5bGVWYWx1ZSkgOiBudWxsLFxuICAgICAgICAgICAgICAzLCBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgYWRkUGFyYW0ocGFyYW1zLCB0aGlzLl9kaXJlY3RpdmVFeHByLCB0aGlzLl9kaXJlY3RpdmVFeHByLCA0LCBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgaW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdLCBtYXBJbmRleDogTWFwPHN0cmluZywgbnVtYmVyPixcbiAgICAgIGFsbG93VW5pdHM6IGJvb2xlYW4sIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMDtcbiAgICByZXR1cm4gaW5wdXRzLm1hcChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nSW5kZXg6IG51bWJlciA9IG1hcEluZGV4LmdldChpbnB1dC5uYW1lICEpICE7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAwO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQsIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICAvLyBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdGx5aW5nUHJvcChlbG1JbmRleCwgYmluZGluZ0luZGV4LCB2YWx1ZSlcbiAgICAgICAgICAvLyBtYXggcGFyYW1zID0+IGVsZW1lbnRTdGx5aW5nUHJvcChlbG1JbmRleCwgYmluZGluZ0luZGV4LCB2YWx1ZSwgb3ZlcnJpZGVGbGFnKVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zID0gW3RoaXMuX2VsZW1lbnRJbmRleEV4cHIsIG8ubGl0ZXJhbChiaW5kaW5nSW5kZXgpLCBjb252ZXJ0Rm4odmFsdWUpXTtcblxuICAgICAgICAgIGlmIChhbGxvd1VuaXRzKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaW5wdXQudW5pdCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZGlyZWN0aXZlRXhwcik7XG4gICAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5oYXNPdmVycmlkZUZsYWcpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaW5wdXQuaGFzT3ZlcnJpZGVGbGFnKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmVsZW1lbnRDbGFzc1Byb3AsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgUjMuZWxlbWVudFN0eWxlUHJvcCwgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMsIHRoaXMuX3N0eWxlc0luZGV4LCB0cnVlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQXBwbHlGbigpOiBJbnN0cnVjdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPyB0aGlzLl9sYXN0U3R5bGluZ0lucHV0LnNvdXJjZVNwYW4gOiBudWxsLFxuICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LFxuICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsXG4gICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAvLyBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nQXBwbHkoZWxtSW5kZXgpXG4gICAgICAgIC8vIG1heCBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdBcHBseShlbG1JbmRleCwgZGlyZWN0aXZlKVxuICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW3RoaXMuX2VsZW1lbnRJbmRleEV4cHJdO1xuICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFsbCBpbnN0cnVjdGlvbnMgd2hpY2ggY29udGFpbiB0aGUgZXhwcmVzc2lvbnMgdGhhdCB3aWxsIGJlIHBsYWNlZFxuICAgKiBpbnRvIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSB0ZW1wbGF0ZSBmdW5jdGlvbiBvciBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MgZnVuY3Rpb24uXG4gICAqL1xuICBidWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcikge1xuICAgIGNvbnN0IGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzKSB7XG4gICAgICBjb25zdCBtYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRFbGVtZW50U3R5bGluZ01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmIChtYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChtYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByb3AgPT09ICdiYWNrZ3JvdW5kLWltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZCcgfHwgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHxcbiAgICAgIHByb3AgPT09ICdmaWx0ZXInIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZS1pbWFnZSc7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0byBlaXRoZXIgcHJvdmlkZSB0aGUgY29uc3RhbnQgbGl0ZXJhbCB0aGF0IHdpbGwgaG91c2UgdGhlIHZhbHVlXG4gKiBoZXJlIG9yIGEgbnVsbCB2YWx1ZSBpZiB0aGUgcHJvdmlkZWQgdmFsdWVzIGFyZSBlbXB0eS5cbiAqL1xuZnVuY3Rpb24gZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIHZhbHVlcy5sZW5ndGggPyBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycih2YWx1ZXMpLCB0cnVlKSA6IG8uTlVMTF9FWFBSO1xufVxuXG4vKipcbiAqIFNpbXBsZSBoZWxwZXIgZnVuY3Rpb24gdGhhdCBhZGRzIGEgcGFyYW1ldGVyIG9yIGRvZXMgbm90aGluZyBhdCBhbGwgZGVwZW5kaW5nIG9uIHRoZSBwcm92aWRlZFxuICogcHJlZGljYXRlIGFuZCB0b3RhbEV4cGVjdGVkQXJncyB2YWx1ZXNcbiAqL1xuZnVuY3Rpb24gYWRkUGFyYW0oXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSwgcHJlZGljYXRlOiBhbnksIHZhbHVlOiBvLkV4cHJlc3Npb24gfCBudWxsLCBhcmdOdW1iZXI6IG51bWJlcixcbiAgICB0b3RhbEV4cGVjdGVkQXJnczogbnVtYmVyKSB7XG4gIGlmIChwcmVkaWNhdGUgJiYgdmFsdWUpIHtcbiAgICBwYXJhbXMucHVzaCh2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoYXJnTnVtYmVyIDwgdG90YWxFeHBlY3RlZEFyZ3MpIHtcbiAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvcGVydHkobmFtZTogc3RyaW5nKTpcbiAgICB7cHJvcGVydHk6IHN0cmluZywgdW5pdDogc3RyaW5nLCBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW59IHtcbiAgbGV0IGhhc092ZXJyaWRlRmxhZyA9IGZhbHNlO1xuICBjb25zdCBvdmVycmlkZUluZGV4ID0gbmFtZS5pbmRleE9mKElNUE9SVEFOVF9GTEFHKTtcbiAgaWYgKG92ZXJyaWRlSW5kZXggIT09IC0xKSB7XG4gICAgbmFtZSA9IG92ZXJyaWRlSW5kZXggPiAwID8gbmFtZS5zdWJzdHJpbmcoMCwgb3ZlcnJpZGVJbmRleCkgOiAnJztcbiAgICBoYXNPdmVycmlkZUZsYWcgPSB0cnVlO1xuICB9XG5cbiAgbGV0IHVuaXQgPSAnJztcbiAgbGV0IHByb3BlcnR5ID0gbmFtZTtcbiAgY29uc3QgdW5pdEluZGV4ID0gbmFtZS5sYXN0SW5kZXhPZignLicpO1xuICBpZiAodW5pdEluZGV4ID4gMCkge1xuICAgIHVuaXQgPSBuYW1lLnN1YnN0cih1bml0SW5kZXggKyAxKTtcbiAgICBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyaW5nKDAsIHVuaXRJbmRleCk7XG4gIH1cblxuICByZXR1cm4ge3Byb3BlcnR5LCB1bml0LCBoYXNPdmVycmlkZUZsYWd9O1xufVxuIl19