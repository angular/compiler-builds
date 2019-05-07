import * as tslib_1 from "tslib";
import { Interpolation } from '../../expression_parser/ast';
import * as o from '../../output/output_ast';
import { isEmptyExpression } from '../../template_parser/template_parser';
import { Identifiers as R3 } from '../r3_identifiers';
import { parse as parseStyle } from './style_parser';
var IMPORTANT_FLAG = '!important';
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
var StylingBuilder = /** @class */ (function () {
    function StylingBuilder(_elementIndexExpr, _directiveExpr) {
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
    StylingBuilder.prototype.registerBoundInput = function (input) {
        // [attr.style] or [attr.class] are skipped in the code below,
        // they should not be treated as styling-based bindings since
        // they are intended to be written directly to the attr and
        // will therefore skip all style/class resolution that is present
        // with style="", [style]="" and [style.prop]="", class="",
        // [class.prop]="". [class]="" assignments
        var binding = null;
        var name = input.name;
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
    };
    StylingBuilder.prototype.registerInputBasedOnName = function (name, expression, sourceSpan) {
        var binding = null;
        var nameToMatch = name.substring(0, 5); // class | style
        var isStyle = nameToMatch === 'style';
        var isClass = isStyle ? false : (nameToMatch === 'class');
        if (isStyle || isClass) {
            var isMapBased = name.charAt(5) !== '.'; // style.prop or class.prop makes this a no
            var property = name.substr(isMapBased ? 5 : 6); // the dot explains why there's a +1
            if (isStyle) {
                binding = this.registerStyleInput(property, isMapBased, expression, sourceSpan);
            }
            else {
                binding = this.registerClassInput(property, isMapBased, expression, sourceSpan);
            }
        }
        return binding;
    };
    StylingBuilder.prototype.registerStyleInput = function (name, isMapBased, value, sourceSpan, unit) {
        if (isEmptyExpression(value)) {
            return null;
        }
        var _a = parseProperty(name), property = _a.property, hasOverrideFlag = _a.hasOverrideFlag, bindingUnit = _a.unit;
        var entry = {
            name: property,
            unit: unit || bindingUnit, value: value, sourceSpan: sourceSpan, hasOverrideFlag: hasOverrideFlag
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
    };
    StylingBuilder.prototype.registerClassInput = function (name, isMapBased, value, sourceSpan) {
        if (isEmptyExpression(value)) {
            return null;
        }
        var _a = parseProperty(name), property = _a.property, hasOverrideFlag = _a.hasOverrideFlag;
        var entry = { name: property, value: value, sourceSpan: sourceSpan, hasOverrideFlag: hasOverrideFlag, unit: null };
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
    };
    /**
     * Registers the element's static style string value to the builder.
     *
     * @param value the style string (e.g. `width:100px; height:200px;`)
     */
    StylingBuilder.prototype.registerStyleAttr = function (value) {
        this._initialStyleValues = parseStyle(value);
        this._hasInitialValues = true;
    };
    /**
     * Registers the element's static class string value to the builder.
     *
     * @param value the className string (e.g. `disabled gold zoom`)
     */
    StylingBuilder.prototype.registerClassAttr = function (value) {
        this._initialClassValues = value.trim().split(/\s+/g);
        this._hasInitialValues = true;
    };
    /**
     * Appends all styling-related expressions to the provided attrs array.
     *
     * @param attrs an existing array where each of the styling expressions
     * will be inserted into.
     */
    StylingBuilder.prototype.populateInitialStylingAttrs = function (attrs) {
        // [CLASS_MARKER, 'foo', 'bar', 'baz' ...]
        if (this._initialClassValues.length) {
            attrs.push(o.literal(1 /* Classes */));
            for (var i = 0; i < this._initialClassValues.length; i++) {
                attrs.push(o.literal(this._initialClassValues[i]));
            }
        }
        // [STYLE_MARKER, 'width', '200px', 'height', '100px', ...]
        if (this._initialStyleValues.length) {
            attrs.push(o.literal(2 /* Styles */));
            for (var i = 0; i < this._initialStyleValues.length; i += 2) {
                attrs.push(o.literal(this._initialStyleValues[i]), o.literal(this._initialStyleValues[i + 1]));
            }
        }
    };
    /**
     * Builds an instruction with all the expressions and parameters for `elementHostAttrs`.
     *
     * The instruction generation code below is used for producing the AOT statement code which is
     * responsible for registering initial styles (within a directive hostBindings' creation block),
     * as well as any of the provided attribute values, to the directive host element.
     */
    StylingBuilder.prototype.buildHostAttrsInstruction = function (sourceSpan, attrs, constantPool) {
        var _this = this;
        if (this._directiveExpr && (attrs.length || this._hasInitialValues)) {
            return {
                sourceSpan: sourceSpan,
                reference: R3.elementHostAttrs,
                allocateBindingSlots: 0,
                buildParams: function () {
                    // params => elementHostAttrs(agetDirectiveContext()ttrs)
                    _this.populateInitialStylingAttrs(attrs);
                    var attrArray = !attrs.some(function (attr) { return attr instanceof o.WrappedNodeExpr; }) ?
                        getConstantLiteralFromArray(constantPool, attrs) :
                        o.literalArr(attrs);
                    return [attrArray];
                }
            };
        }
        return null;
    };
    /**
     * Builds an instruction with all the expressions and parameters for `elementStyling`.
     *
     * The instruction generation code below is used for producing the AOT statement code which is
     * responsible for registering style/class bindings to an element.
     */
    StylingBuilder.prototype.buildElementStylingInstruction = function (sourceSpan, constantPool) {
        var _this = this;
        var reference = this._directiveExpr ? R3.elementHostStyling : R3.elementStyling;
        if (this.hasBindings) {
            return {
                sourceSpan: sourceSpan,
                allocateBindingSlots: 0, reference: reference,
                buildParams: function () {
                    // a string array of every style-based binding
                    var styleBindingProps = _this._singleStyleInputs ? _this._singleStyleInputs.map(function (i) { return o.literal(i.name); }) : [];
                    // a string array of every class-based binding
                    var classBindingNames = _this._singleClassInputs ? _this._singleClassInputs.map(function (i) { return o.literal(i.name); }) : [];
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
                    var params = [];
                    var expectedNumberOfArgs = 0;
                    if (_this._useDefaultSanitizer) {
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
                    addParam(params, _this._useDefaultSanitizer, o.importExpr(R3.defaultStyleSanitizer), 3, expectedNumberOfArgs);
                    return params;
                }
            };
        }
        return null;
    };
    /**
     * Builds an instruction with all the expressions and parameters for `elementClassMap`.
     *
     * The instruction data will contain all expressions for `elementClassMap` to function
     * which includes the `[class]` expression params.
     */
    StylingBuilder.prototype.buildElementClassMapInstruction = function (valueConverter) {
        if (this._classMapInput) {
            return this._buildMapBasedInstruction(valueConverter, true, this._classMapInput);
        }
        return null;
    };
    /**
     * Builds an instruction with all the expressions and parameters for `elementStyleMap`.
     *
     * The instruction data will contain all expressions for `elementStyleMap` to function
     * which includes the `[style]` expression params.
     */
    StylingBuilder.prototype.buildElementStyleMapInstruction = function (valueConverter) {
        if (this._styleMapInput) {
            return this._buildMapBasedInstruction(valueConverter, false, this._styleMapInput);
        }
        return null;
    };
    StylingBuilder.prototype._buildMapBasedInstruction = function (valueConverter, isClassBased, stylingInput) {
        var _this = this;
        var totalBindingSlotsRequired = 0;
        // these values must be outside of the update block so that they can
        // be evaluated (the AST visit call) during creation time so that any
        // pipes can be picked up in time before the template is built
        var mapValue = stylingInput.value.visit(valueConverter);
        if (mapValue instanceof Interpolation) {
            totalBindingSlotsRequired += mapValue.expressions.length;
        }
        var isHostBinding = this._directiveExpr;
        var reference;
        if (isClassBased) {
            reference = isHostBinding ? R3.elementHostClassMap : R3.elementClassMap;
        }
        else {
            reference = isHostBinding ? R3.elementHostStyleMap : R3.elementStyleMap;
        }
        return {
            sourceSpan: stylingInput.sourceSpan,
            reference: reference,
            allocateBindingSlots: totalBindingSlotsRequired,
            buildParams: function (convertFn) {
                var params = [];
                if (!isHostBinding) {
                    params.push(_this._elementIndexExpr);
                }
                params.push(convertFn(mapValue));
                return params;
            }
        };
    };
    StylingBuilder.prototype._buildSingleInputs = function (reference, isHostBinding, inputs, mapIndex, allowUnits, valueConverter) {
        var _this = this;
        var totalBindingSlotsRequired = 0;
        return inputs.map(function (input) {
            var bindingIndex = mapIndex.get(input.name);
            var value = input.value.visit(valueConverter);
            totalBindingSlotsRequired += (value instanceof Interpolation) ? value.expressions.length : 0;
            return {
                sourceSpan: input.sourceSpan,
                allocateBindingSlots: totalBindingSlotsRequired, reference: reference,
                buildParams: function (convertFn) {
                    // HOST:
                    //   min params => elementHostStylingProp(bindingIndex, value)
                    //   max params => elementHostStylingProp(bindingIndex, value, overrideFlag)
                    // Template:
                    //   min params => elementStylingProp(elmIndex, bindingIndex, value)
                    //   max params => elementStylingProp(elmIndex, bindingIndex, value, overrideFlag)
                    var params = [];
                    if (!isHostBinding) {
                        params.push(_this._elementIndexExpr);
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
    };
    StylingBuilder.prototype._buildClassInputs = function (valueConverter) {
        if (this._singleClassInputs) {
            var isHostBinding = !!this._directiveExpr;
            var reference = isHostBinding ? R3.elementHostClassProp : R3.elementClassProp;
            return this._buildSingleInputs(reference, isHostBinding, this._singleClassInputs, this._classesIndex, false, valueConverter);
        }
        return [];
    };
    StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
        if (this._singleStyleInputs) {
            var isHostBinding = !!this._directiveExpr;
            var reference = isHostBinding ? R3.elementHostStyleProp : R3.elementStyleProp;
            return this._buildSingleInputs(reference, isHostBinding, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
        }
        return [];
    };
    StylingBuilder.prototype._buildApplyFn = function () {
        var _this = this;
        var isHostBinding = this._directiveExpr;
        var reference = isHostBinding ? R3.elementHostStylingApply : R3.elementStylingApply;
        return {
            sourceSpan: this._lastStylingInput ? this._lastStylingInput.sourceSpan : null,
            reference: reference,
            allocateBindingSlots: 0,
            buildParams: function () {
                // HOST:
                //   params => elementHostStylingApply()
                // Template:
                //   params => elementStylingApply(elmIndex)
                return isHostBinding ? [] : [_this._elementIndexExpr];
            }
        };
    };
    /**
     * Constructs all instructions which contain the expressions that will be placed
     * into the update block of a template function or a directive hostBindings function.
     */
    StylingBuilder.prototype.buildUpdateLevelInstructions = function (valueConverter) {
        var instructions = [];
        if (this.hasBindings) {
            var styleMapInstruction = this.buildElementStyleMapInstruction(valueConverter);
            if (styleMapInstruction) {
                instructions.push(styleMapInstruction);
            }
            var classMapInstruction = this.buildElementClassMapInstruction(valueConverter);
            if (classMapInstruction) {
                instructions.push(classMapInstruction);
            }
            instructions.push.apply(instructions, tslib_1.__spread(this._buildStyleInputs(valueConverter)));
            instructions.push.apply(instructions, tslib_1.__spread(this._buildClassInputs(valueConverter)));
            instructions.push(this._buildApplyFn());
        }
        return instructions;
    };
    return StylingBuilder;
}());
export { StylingBuilder };
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
    var hasOverrideFlag = false;
    var overrideIndex = name.indexOf(IMPORTANT_FLAG);
    if (overrideIndex !== -1) {
        name = overrideIndex > 0 ? name.substring(0, overrideIndex) : '';
        hasOverrideFlag = true;
    }
    var unit = '';
    var property = name;
    var unitIndex = name.lastIndexOf('.');
    if (unitIndex > 0) {
        unit = name.substr(unitIndex + 1);
        property = name.substring(0, unitIndex);
    }
    return { property: property, unit: unit, hasOverrideFlag: hasOverrideFlag };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQVNBLE9BQU8sRUFBbUIsYUFBYSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDNUUsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUU3QyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUV4RSxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxLQUFLLElBQUksVUFBVSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFHbkQsSUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDO0FBdUJwQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E2Qkc7QUFDSDtJQTBDRSx3QkFBb0IsaUJBQStCLEVBQVUsY0FBaUM7UUFBMUUsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFjO1FBQVUsbUJBQWMsR0FBZCxjQUFjLENBQW1CO1FBekM5RixpRUFBaUU7UUFDekQsc0JBQWlCLEdBQUcsS0FBSyxDQUFDO1FBQ2xDOzs7V0FHRztRQUNJLGdCQUFXLEdBQUcsS0FBSyxDQUFDO1FBRTNCLDJDQUEyQztRQUNuQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7UUFDdEQsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwwQ0FBMEM7UUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztRQUM1RCwwQ0FBMEM7UUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztRQUNwRCxzQkFBaUIsR0FBMkIsSUFBSSxDQUFDO1FBRXpELHdEQUF3RDtRQUN4RCxrQ0FBa0M7UUFFbEM7Ozs7V0FJRztRQUNL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U0FBUyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2pFLGVBQWUsR0FBRyxJQUFJLENBQUM7S0FDeEI7SUFFRCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7SUFDZCxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDcEIsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QyxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUU7UUFDakIsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN6QztJQUVELE9BQU8sRUFBQyxRQUFRLFVBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxlQUFlLGlCQUFBLEVBQUMsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEJpbmRpbmdUeXBlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzRW1wdHlFeHByZXNzaW9ufSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcblxuY29uc3QgSU1QT1JUQU5UX0ZMQUcgPSAnIWltcG9ydGFudCc7XG5cbi8qKlxuICogQSBzdHlsaW5nIGV4cHJlc3Npb24gc3VtbWFyeSB0aGF0IGlzIHRvIGJlIHByb2Nlc3NlZCBieSB0aGUgY29tcGlsZXJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbnN0cnVjdGlvbiB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiBudW1iZXI7XG4gIGJ1aWxkUGFyYW1zKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbltdO1xufVxuXG4vKipcbiAqIEFuIGludGVybmFsIHJlY29yZCBvZiB0aGUgaW5wdXQgZGF0YSBmb3IgYSBzdHlsaW5nIGJpbmRpbmdcbiAqL1xuaW50ZXJmYWNlIEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgaGFzT3ZlcnJpZGVGbGFnOiBib29sZWFuO1xuICBuYW1lOiBzdHJpbmd8bnVsbDtcbiAgdW5pdDogc3RyaW5nfG51bGw7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmFsdWU6IEFTVDtcbn1cblxuLyoqXG4gKiBQcm9kdWNlcyBjcmVhdGlvbi91cGRhdGUgaW5zdHJ1Y3Rpb25zIGZvciBhbGwgc3R5bGluZyBiaW5kaW5ncyAoY2xhc3MgYW5kIHN0eWxlKVxuICpcbiAqIEl0IGFsc28gcHJvZHVjZXMgdGhlIGNyZWF0aW9uIGluc3RydWN0aW9uIHRvIHJlZ2lzdGVyIGFsbCBpbml0aWFsIHN0eWxpbmcgdmFsdWVzXG4gKiAod2hpY2ggYXJlIGFsbCB0aGUgc3RhdGljIGNsYXNzPVwiLi4uXCIgYW5kIHN0eWxlPVwiLi4uXCIgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGV4aXN0XG4gKiBvbiBhbiBlbGVtZW50IHdpdGhpbiBhIHRlbXBsYXRlKS5cbiAqXG4gKiBUaGUgYnVpbGRlciBjbGFzcyBiZWxvdyBoYW5kbGVzIHByb2R1Y2luZyBpbnN0cnVjdGlvbnMgZm9yIHRoZSBmb2xsb3dpbmcgY2FzZXM6XG4gKlxuICogLSBTdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcyAoc3R5bGU9XCIuLi5cIiBhbmQgY2xhc3M9XCIuLi5cIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBtYXAgYmluZGluZ3MgKFtzdHlsZV09XCJtYXBcIiBhbmQgW2NsYXNzXT1cIm1hcHxzdHJpbmdcIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBwcm9wZXJ0eSBiaW5kaW5ncyAoW3N0eWxlLnByb3BdPVwiZXhwXCIgYW5kIFtjbGFzcy5uYW1lXT1cImV4cFwiKVxuICpcbiAqIER1ZSB0byB0aGUgY29tcGxleCByZWxhdGlvbnNoaXAgb2YgYWxsIG9mIHRoZXNlIGNhc2VzLCB0aGUgaW5zdHJ1Y3Rpb25zIGdlbmVyYXRlZFxuICogZm9yIHRoZXNlIGF0dHJpYnV0ZXMvcHJvcGVydGllcy9iaW5kaW5ncyBtdXN0IGJlIGRvbmUgc28gaW4gdGhlIGNvcnJlY3Qgb3JkZXIuIFRoZVxuICogb3JkZXIgd2hpY2ggdGhlc2UgbXVzdCBiZSBnZW5lcmF0ZWQgaXMgYXMgZm9sbG93czpcbiAqXG4gKiBpZiAoY3JlYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGluZyguLi4pXG4gKiB9XG4gKiBpZiAodXBkYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGVNYXAoLi4uKVxuICogICBlbGVtZW50Q2xhc3NNYXAoLi4uKVxuICogICBlbGVtZW50U3R5bGVQcm9wKC4uLilcbiAqICAgZWxlbWVudENsYXNzUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsaW5nQXBwKC4uLilcbiAqIH1cbiAqXG4gKiBUaGUgY3JlYXRpb24vdXBkYXRlIG1ldGhvZHMgd2l0aGluIHRoZSBidWlsZGVyIGNsYXNzIHByb2R1Y2UgdGhlc2UgaW5zdHJ1Y3Rpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU3R5bGluZ0J1aWxkZXIge1xuICAvKiogV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdGF0aWMgc3R5bGluZyB2YWx1ZXMgcHJlc2VudCAqL1xuICBwcml2YXRlIF9oYXNJbml0aWFsVmFsdWVzID0gZmFsc2U7XG4gIC8qKlxuICAgKiAgV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdHlsaW5nIGJpbmRpbmdzIHByZXNlbnRcbiAgICogIChpLmUuIGBbc3R5bGVdYCwgYFtjbGFzc11gLCBgW3N0eWxlLnByb3BdYCBvciBgW2NsYXNzLm5hbWVdYClcbiAgICovXG4gIHB1YmxpYyBoYXNCaW5kaW5ncyA9IGZhbHNlO1xuXG4gIC8qKiB0aGUgaW5wdXQgZm9yIFtjbGFzc10gKGlmIGl0IGV4aXN0cykgKi9cbiAgcHJpdmF0ZSBfY2xhc3NNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIC8qKiB0aGUgaW5wdXQgZm9yIFtzdHlsZV0gKGlmIGl0IGV4aXN0cykgKi9cbiAgcHJpdmF0ZSBfc3R5bGVNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIC8qKiBhbiBhcnJheSBvZiBlYWNoIFtzdHlsZS5wcm9wXSBpbnB1dCAqL1xuICBwcml2YXRlIF9zaW5nbGVTdHlsZUlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW2NsYXNzLm5hbWVdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZUNsYXNzSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9sYXN0U3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcblxuICAvLyBtYXBzIGFyZSB1c2VkIGluc3RlYWQgb2YgaGFzaCBtYXBzIGJlY2F1c2UgYSBNYXAgd2lsbFxuICAvLyByZXRhaW4gdGhlIG9yZGVyaW5nIG9mIHRoZSBrZXlzXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggc3R5bGUgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW3N0eWxlLndpZHRoXT1cIndcIiBbc3R5bGUuaGVpZ2h0XT1cImhcIj5gIGltcGxpZXNcbiAgICogdGhhdCBgd2lkdGg9MGAgYW5kIGBoZWlnaHQ9MWApXG4gICAqL1xuICBwcml2YXRlIF9zdHlsZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggY2xhc3MgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW2NsYXNzLmJpZ109XCJiXCIgW2NsYXNzLmhpZGRlbl09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYGJpZz0wYCBhbmQgYGhpZGRlbj0xYClcbiAgICovXG4gIHByaXZhdGUgX2NsYXNzZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxTdHlsZVZhbHVlczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBfaW5pdGlhbENsYXNzVmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGNlcnRhaW4gc3R5bGUgcHJvcGVydGllcyBBTFdBWVMgbmVlZCBzYW5pdGl6YXRpb25cbiAgLy8gdGhpcyBpcyBjaGVja2VkIGVhY2ggdGltZSBuZXcgc3R5bGVzIGFyZSBlbmNvdW50ZXJlZFxuICBwcml2YXRlIF91c2VEZWZhdWx0U2FuaXRpemVyID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZWxlbWVudEluZGV4RXhwcjogby5FeHByZXNzaW9uLCBwcml2YXRlIF9kaXJlY3RpdmVFeHByOiBvLkV4cHJlc3Npb258bnVsbCkge31cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgZ2l2ZW4gaW5wdXQgdG8gdGhlIHN0eWxpbmcgYnVpbGRlciB0byBiZSBsYXRlciB1c2VkIHdoZW4gcHJvZHVjaW5nIEFPVCBjb2RlLlxuICAgKlxuICAgKiBUaGUgY29kZSBiZWxvdyB3aWxsIG9ubHkgYWNjZXB0IHRoZSBpbnB1dCBpZiBpdCBpcyBzb21laG93IHRpZWQgdG8gc3R5bGluZyAod2hldGhlciBpdCBiZVxuICAgKiBzdHlsZS9jbGFzcyBiaW5kaW5ncyBvciBzdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcykuXG4gICAqL1xuICByZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIGFyZSBza2lwcGVkIGluIHRoZSBjb2RlIGJlbG93LFxuICAgIC8vIHRoZXkgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIHN0eWxpbmctYmFzZWQgYmluZGluZ3Mgc2luY2VcbiAgICAvLyB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyIGFuZFxuICAgIC8vIHdpbGwgdGhlcmVmb3JlIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgLy8gd2l0aCBzdHlsZT1cIlwiLCBbc3R5bGVdPVwiXCIgYW5kIFtzdHlsZS5wcm9wXT1cIlwiLCBjbGFzcz1cIlwiLFxuICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWUgPSBpbnB1dC5uYW1lO1xuICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnB1dC51bml0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG5cbiAgcmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgbmFtZVRvTWF0Y2ggPSBuYW1lLnN1YnN0cmluZygwLCA1KTsgIC8vIGNsYXNzIHwgc3R5bGVcbiAgICBjb25zdCBpc1N0eWxlID0gbmFtZVRvTWF0Y2ggPT09ICdzdHlsZSc7XG4gICAgY29uc3QgaXNDbGFzcyA9IGlzU3R5bGUgPyBmYWxzZSA6IChuYW1lVG9NYXRjaCA9PT0gJ2NsYXNzJyk7XG4gICAgaWYgKGlzU3R5bGUgfHwgaXNDbGFzcykge1xuICAgICAgY29uc3QgaXNNYXBCYXNlZCA9IG5hbWUuY2hhckF0KDUpICE9PSAnLic7ICAgICAgICAgLy8gc3R5bGUucHJvcCBvciBjbGFzcy5wcm9wIG1ha2VzIHRoaXMgYSBub1xuICAgICAgY29uc3QgcHJvcGVydHkgPSBuYW1lLnN1YnN0cihpc01hcEJhc2VkID8gNSA6IDYpOyAgLy8gdGhlIGRvdCBleHBsYWlucyB3aHkgdGhlcmUncyBhICsxXG4gICAgICBpZiAoaXNTdHlsZSkge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KHByb3BlcnR5LCBpc01hcEJhc2VkLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmc7XG4gIH1cblxuICByZWdpc3RlclN0eWxlSW5wdXQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHVuaXQ/OiBzdHJpbmd8bnVsbCk6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwge1xuICAgIGlmIChpc0VtcHR5RXhwcmVzc2lvbih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZywgdW5pdDogYmluZGluZ1VuaXR9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTogQm91bmRTdHlsaW5nRW50cnkgPSB7XG4gICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgIHVuaXQ6IHVuaXQgfHwgYmluZGluZ1VuaXQsIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWdcbiAgICB9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID0gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKG5hbWUpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICByZWdpc3RlckNsYXNzSW5wdXQobmFtZTogc3RyaW5nLCBpc01hcEJhc2VkOiBib29sZWFuLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgQm91bmRTdHlsaW5nRW50cnl8bnVsbCB7XG4gICAgaWYgKGlzRW1wdHlFeHByZXNzaW9uKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHtwcm9wZXJ0eSwgaGFzT3ZlcnJpZGVGbGFnfSA9IHBhcnNlUHJvcGVydHkobmFtZSk7XG4gICAgY29uc3QgZW50cnk6XG4gICAgICAgIEJvdW5kU3R5bGluZ0VudHJ5ID0ge25hbWU6IHByb3BlcnR5LCB2YWx1ZSwgc291cmNlU3BhbiwgaGFzT3ZlcnJpZGVGbGFnLCB1bml0OiBudWxsfTtcbiAgICBpZiAoaXNNYXBCYXNlZCkge1xuICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIHN0eWxlIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBzdHlsZSBzdHJpbmcgKGUuZy4gYHdpZHRoOjEwMHB4OyBoZWlnaHQ6MjAwcHg7YClcbiAgICovXG4gIHJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgY2xhc3Mgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIGNsYXNzTmFtZSBzdHJpbmcgKGUuZy4gYGRpc2FibGVkIGdvbGQgem9vbWApXG4gICAqL1xuICByZWdpc3RlckNsYXNzQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYWxsIHN0eWxpbmctcmVsYXRlZCBleHByZXNzaW9ucyB0byB0aGUgcHJvdmlkZWQgYXR0cnMgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSBhdHRycyBhbiBleGlzdGluZyBhcnJheSB3aGVyZSBlYWNoIG9mIHRoZSBzdHlsaW5nIGV4cHJlc3Npb25zXG4gICAqIHdpbGwgYmUgaW5zZXJ0ZWQgaW50by5cbiAgICovXG4gIHBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyczogby5FeHByZXNzaW9uW10pOiB2b2lkIHtcbiAgICAvLyBbQ0xBU1NfTUFSS0VSLCAnZm9vJywgJ2JhcicsICdiYXonIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlc1tpXSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFtTVFlMRV9NQVJLRVIsICd3aWR0aCcsICcyMDBweCcsICdoZWlnaHQnLCAnMTAwcHgnLCAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGF0dHJzLnB1c2goXG4gICAgICAgICAgICBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2ldKSwgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpICsgMV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRIb3N0QXR0cnNgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZ2VuZXJhdGlvbiBjb2RlIGJlbG93IGlzIHVzZWQgZm9yIHByb2R1Y2luZyB0aGUgQU9UIHN0YXRlbWVudCBjb2RlIHdoaWNoIGlzXG4gICAqIHJlc3BvbnNpYmxlIGZvciByZWdpc3RlcmluZyBpbml0aWFsIHN0eWxlcyAod2l0aGluIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncycgY3JlYXRpb24gYmxvY2spLFxuICAgKiBhcyB3ZWxsIGFzIGFueSBvZiB0aGUgcHJvdmlkZWQgYXR0cmlidXRlIHZhbHVlcywgdG8gdGhlIGRpcmVjdGl2ZSBob3N0IGVsZW1lbnQuXG4gICAqL1xuICBidWlsZEhvc3RBdHRyc0luc3RydWN0aW9uKFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGF0dHJzOiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIgJiYgKGF0dHJzLmxlbmd0aCB8fCB0aGlzLl9oYXNJbml0aWFsVmFsdWVzKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50SG9zdEF0dHJzLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCxcbiAgICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAvLyBwYXJhbXMgPT4gZWxlbWVudEhvc3RBdHRycyhhZ2V0RGlyZWN0aXZlQ29udGV4dCgpdHRycylcbiAgICAgICAgICB0aGlzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRycyk7XG4gICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gIWF0dHJzLnNvbWUoYXR0ciA9PiBhdHRyIGluc3RhbmNlb2Ygby5XcmFwcGVkTm9kZUV4cHIpID9cbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgYXR0cnMpIDpcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKGF0dHJzKTtcbiAgICAgICAgICByZXR1cm4gW2F0dHJBcnJheV07XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50U3R5bGluZ2AuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBnZW5lcmF0aW9uIGNvZGUgYmVsb3cgaXMgdXNlZCBmb3IgcHJvZHVjaW5nIHRoZSBBT1Qgc3RhdGVtZW50IGNvZGUgd2hpY2ggaXNcbiAgICogcmVzcG9uc2libGUgZm9yIHJlZ2lzdGVyaW5nIHN0eWxlL2NsYXNzIGJpbmRpbmdzIHRvIGFuIGVsZW1lbnQuXG4gICAqL1xuICBidWlsZEVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24oc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTpcbiAgICAgIEluc3RydWN0aW9ufG51bGwge1xuICAgIGNvbnN0IHJlZmVyZW5jZSA9IHRoaXMuX2RpcmVjdGl2ZUV4cHIgPyBSMy5lbGVtZW50SG9zdFN0eWxpbmcgOiBSMy5lbGVtZW50U3R5bGluZztcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5ncykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAvLyBhIHN0cmluZyBhcnJheSBvZiBldmVyeSBzdHlsZS1iYXNlZCBiaW5kaW5nXG4gICAgICAgICAgY29uc3Qgc3R5bGVCaW5kaW5nUHJvcHMgPVxuICAgICAgICAgICAgICB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyA/IHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzLm1hcChpID0+IG8ubGl0ZXJhbChpLm5hbWUpKSA6IFtdO1xuICAgICAgICAgIC8vIGEgc3RyaW5nIGFycmF5IG9mIGV2ZXJ5IGNsYXNzLWJhc2VkIGJpbmRpbmdcbiAgICAgICAgICBjb25zdCBjbGFzc0JpbmRpbmdOYW1lcyA9XG4gICAgICAgICAgICAgIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzID8gdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMubWFwKGkgPT4gby5saXRlcmFsKGkubmFtZSkpIDogW107XG5cbiAgICAgICAgICAvLyB0byBzYWx2YWdlIHNwYWNlIGluIHRoZSBBT1QgZ2VuZXJhdGVkIGNvZGUsIHRoZXJlIGlzIG5vIHBvaW50IGluIHBhc3NpbmdcbiAgICAgICAgICAvLyBpbiBgbnVsbGAgaW50byBhIHBhcmFtIGlmIGFueSBmb2xsb3ctdXAgcGFyYW1zIGFyZSBub3QgdXNlZC4gVGhlcmVmb3JlLFxuICAgICAgICAgIC8vIG9ubHkgd2hlbiBhIHRyYWlsaW5nIHBhcmFtIGlzIHVzZWQgdGhlbiBpdCB3aWxsIGJlIGZpbGxlZCB3aXRoIG51bGxzIGluIGJldHdlZW5cbiAgICAgICAgICAvLyAob3RoZXJ3aXNlIGEgc2hvcnRlciBhbW91bnQgb2YgcGFyYW1zIHdpbGwgYmUgZmlsbGVkKS4gVGhlIGNvZGUgYmVsb3cgaGVscHNcbiAgICAgICAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcGFyYW1zIGFyZSByZXF1aXJlZCBpbiB0aGUgZXhwcmVzc2lvbiBjb2RlLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nKClcbiAgICAgICAgICAvLyAgIG1heCBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nKGNsYXNzQmluZGluZ3MsIHN0eWxlQmluZGluZ3MsIHNhbml0aXplcilcbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFRlbXBsYXRlOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZygpXG4gICAgICAgICAgLy8gICBtYXggcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKGNsYXNzQmluZGluZ3MsIHN0eWxlQmluZGluZ3MsIHNhbml0aXplcilcbiAgICAgICAgICAvL1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgICBsZXQgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAwO1xuICAgICAgICAgIGlmICh0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmIChzdHlsZUJpbmRpbmdQcm9wcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMjtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzQmluZGluZ05hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAxO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIGNsYXNzQmluZGluZ05hbWVzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIGNsYXNzQmluZGluZ05hbWVzKSwgMSxcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIHN0eWxlQmluZGluZ1Byb3BzKSwgMixcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIsIG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpLCAzLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRDbGFzc01hcGAuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBkYXRhIHdpbGwgY29udGFpbiBhbGwgZXhwcmVzc2lvbnMgZm9yIGBlbGVtZW50Q2xhc3NNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGVzIHRoZSBgW2NsYXNzXWAgZXhwcmVzc2lvbiBwYXJhbXMuXG4gICAqL1xuICBidWlsZEVsZW1lbnRDbGFzc01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9jbGFzc01hcElucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyLCB0cnVlLCB0aGlzLl9jbGFzc01hcElucHV0KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRTdHlsZU1hcGAuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBkYXRhIHdpbGwgY29udGFpbiBhbGwgZXhwcmVzc2lvbnMgZm9yIGBlbGVtZW50U3R5bGVNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGVzIHRoZSBgW3N0eWxlXWAgZXhwcmVzc2lvbiBwYXJhbXMuXG4gICAqL1xuICBidWlsZEVsZW1lbnRTdHlsZU1hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyLCBmYWxzZSwgdGhpcy5fc3R5bGVNYXBJbnB1dCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKFxuICAgICAgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyLCBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sIHN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnkpIHtcbiAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDA7XG5cbiAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgIC8vIGJlIGV2YWx1YXRlZCAodGhlIEFTVCB2aXNpdCBjYWxsKSBkdXJpbmcgY3JlYXRpb24gdGltZSBzbyB0aGF0IGFueVxuICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgY29uc3QgbWFwVmFsdWUgPSBzdHlsaW5nSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgIGlmIChtYXBWYWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gbWFwVmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIH1cblxuICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSB0aGlzLl9kaXJlY3RpdmVFeHByO1xuICAgIGxldCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gICAgaWYgKGlzQ2xhc3NCYXNlZCkge1xuICAgICAgcmVmZXJlbmNlID0gaXNIb3N0QmluZGluZyA/IFIzLmVsZW1lbnRIb3N0Q2xhc3NNYXAgOiBSMy5lbGVtZW50Q2xhc3NNYXA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZmVyZW5jZSA9IGlzSG9zdEJpbmRpbmcgPyBSMy5lbGVtZW50SG9zdFN0eWxlTWFwIDogUjMuZWxlbWVudFN0eWxlTWFwO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiBzdHlsaW5nSW5wdXQuc291cmNlU3BhbixcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBpZiAoIWlzSG9zdEJpbmRpbmcpIHtcbiAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLl9lbGVtZW50SW5kZXhFeHByKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRGbihtYXBWYWx1ZSkpO1xuICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNIb3N0QmluZGluZzogYm9vbGVhbiwgaW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdLFxuICAgICAgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sIGFsbG93VW5pdHM6IGJvb2xlYW4sXG4gICAgICB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDA7XG4gICAgcmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0luZGV4OiBudW1iZXIgPSBtYXBJbmRleC5nZXQoaW5wdXQubmFtZSAhKSAhO1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9ICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMDtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLCByZWZlcmVuY2UsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nUHJvcChiaW5kaW5nSW5kZXgsIHZhbHVlKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmdQcm9wKGJpbmRpbmdJbmRleCwgdmFsdWUsIG92ZXJyaWRlRmxhZylcbiAgICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdQcm9wKGVsbUluZGV4LCBiaW5kaW5nSW5kZXgsIHZhbHVlKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ1Byb3AoZWxtSW5kZXgsIGJpbmRpbmdJbmRleCwgdmFsdWUsIG92ZXJyaWRlRmxhZylcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAgICAgICBpZiAoIWlzSG9zdEJpbmRpbmcpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2VsZW1lbnRJbmRleEV4cHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChiaW5kaW5nSW5kZXgpKTtcbiAgICAgICAgICBwYXJhbXMucHVzaChjb252ZXJ0Rm4odmFsdWUpKTtcblxuICAgICAgICAgIGlmIChhbGxvd1VuaXRzKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaW5wdXQudW5pdCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5oYXNPdmVycmlkZUZsYWcpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpbnB1dC5oYXNPdmVycmlkZUZsYWcpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbCh0cnVlKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzKSB7XG4gICAgICBjb25zdCBpc0hvc3RCaW5kaW5nID0gISF0aGlzLl9kaXJlY3RpdmVFeHByO1xuICAgICAgY29uc3QgcmVmZXJlbmNlID0gaXNIb3N0QmluZGluZyA/IFIzLmVsZW1lbnRIb3N0Q2xhc3NQcm9wIDogUjMuZWxlbWVudENsYXNzUHJvcDtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICByZWZlcmVuY2UsIGlzSG9zdEJpbmRpbmcsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLFxuICAgICAgICAgIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMpIHtcbiAgICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSAhIXRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsZVByb3AgOiBSMy5lbGVtZW50U3R5bGVQcm9wO1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIHJlZmVyZW5jZSwgaXNIb3N0QmluZGluZywgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMsIHRoaXMuX3N0eWxlc0luZGV4LCB0cnVlLFxuICAgICAgICAgIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRBcHBseUZuKCk6IEluc3RydWN0aW9uIHtcbiAgICBjb25zdCBpc0hvc3RCaW5kaW5nID0gdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsaW5nQXBwbHkgOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5O1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID8gdGhpcy5fbGFzdFN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuIDogbnVsbCxcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgLy8gICBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nQXBwbHkoKVxuICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgLy8gICBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdBcHBseShlbG1JbmRleClcbiAgICAgICAgcmV0dXJuIGlzSG9zdEJpbmRpbmcgPyBbXSA6IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYWxsIGluc3RydWN0aW9ucyB3aGljaCBjb250YWluIHRoZSBleHByZXNzaW9ucyB0aGF0IHdpbGwgYmUgcGxhY2VkXG4gICAqIGludG8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIHRlbXBsYXRlIGZ1bmN0aW9uIG9yIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncyBmdW5jdGlvbi5cbiAgICovXG4gIGJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3MpIHtcbiAgICAgIGNvbnN0IHN0eWxlTWFwSW5zdHJ1Y3Rpb24gPSB0aGlzLmJ1aWxkRWxlbWVudFN0eWxlTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKHN0eWxlTWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goc3R5bGVNYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBjb25zdCBjbGFzc01hcEluc3RydWN0aW9uID0gdGhpcy5idWlsZEVsZW1lbnRDbGFzc01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmIChjbGFzc01hcEluc3RydWN0aW9uKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKGNsYXNzTWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2godGhpcy5fYnVpbGRBcHBseUZuKCkpO1xuICAgIH1cbiAgICByZXR1cm4gaW5zdHJ1Y3Rpb25zO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVySW50b01hcChtYXA6IE1hcDxzdHJpbmcsIG51bWJlcj4sIGtleTogc3RyaW5nKSB7XG4gIGlmICghbWFwLmhhcyhrZXkpKSB7XG4gICAgbWFwLnNldChrZXksIG1hcC5zaXplKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1N0eWxlU2FuaXRpemFibGUocHJvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBwcm9wID09PSAnYmFja2dyb3VuZC1pbWFnZScgfHwgcHJvcCA9PT0gJ2JhY2tncm91bmQnIHx8IHByb3AgPT09ICdib3JkZXItaW1hZ2UnIHx8XG4gICAgICBwcm9wID09PSAnZmlsdGVyJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZScgfHwgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUtaW1hZ2UnO1xufVxuXG4vKipcbiAqIFNpbXBsZSBoZWxwZXIgZnVuY3Rpb24gdG8gZWl0aGVyIHByb3ZpZGUgdGhlIGNvbnN0YW50IGxpdGVyYWwgdGhhdCB3aWxsIGhvdXNlIHRoZSB2YWx1ZVxuICogaGVyZSBvciBhIG51bGwgdmFsdWUgaWYgdGhlIHByb3ZpZGVkIHZhbHVlcyBhcmUgZW1wdHkuXG4gKi9cbmZ1bmN0aW9uIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiB2YWx1ZXMubGVuZ3RoID8gY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIodmFsdWVzKSwgdHJ1ZSkgOiBvLk5VTExfRVhQUjtcbn1cblxuLyoqXG4gKiBTaW1wbGUgaGVscGVyIGZ1bmN0aW9uIHRoYXQgYWRkcyBhIHBhcmFtZXRlciBvciBkb2VzIG5vdGhpbmcgYXQgYWxsIGRlcGVuZGluZyBvbiB0aGUgcHJvdmlkZWRcbiAqIHByZWRpY2F0ZSBhbmQgdG90YWxFeHBlY3RlZEFyZ3MgdmFsdWVzXG4gKi9cbmZ1bmN0aW9uIGFkZFBhcmFtKFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10sIHByZWRpY2F0ZTogYW55LCB2YWx1ZTogby5FeHByZXNzaW9uIHwgbnVsbCwgYXJnTnVtYmVyOiBudW1iZXIsXG4gICAgdG90YWxFeHBlY3RlZEFyZ3M6IG51bWJlcikge1xuICBpZiAocHJlZGljYXRlICYmIHZhbHVlKSB7XG4gICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICB9IGVsc2UgaWYgKGFyZ051bWJlciA8IHRvdGFsRXhwZWN0ZWRBcmdzKSB7XG4gICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVByb3BlcnR5KG5hbWU6IHN0cmluZyk6XG4gICAge3Byb3BlcnR5OiBzdHJpbmcsIHVuaXQ6IHN0cmluZywgaGFzT3ZlcnJpZGVGbGFnOiBib29sZWFufSB7XG4gIGxldCBoYXNPdmVycmlkZUZsYWcgPSBmYWxzZTtcbiAgY29uc3Qgb3ZlcnJpZGVJbmRleCA9IG5hbWUuaW5kZXhPZihJTVBPUlRBTlRfRkxBRyk7XG4gIGlmIChvdmVycmlkZUluZGV4ICE9PSAtMSkge1xuICAgIG5hbWUgPSBvdmVycmlkZUluZGV4ID4gMCA/IG5hbWUuc3Vic3RyaW5nKDAsIG92ZXJyaWRlSW5kZXgpIDogJyc7XG4gICAgaGFzT3ZlcnJpZGVGbGFnID0gdHJ1ZTtcbiAgfVxuXG4gIGxldCB1bml0ID0gJyc7XG4gIGxldCBwcm9wZXJ0eSA9IG5hbWU7XG4gIGNvbnN0IHVuaXRJbmRleCA9IG5hbWUubGFzdEluZGV4T2YoJy4nKTtcbiAgaWYgKHVuaXRJbmRleCA+IDApIHtcbiAgICB1bml0ID0gbmFtZS5zdWJzdHIodW5pdEluZGV4ICsgMSk7XG4gICAgcHJvcGVydHkgPSBuYW1lLnN1YnN0cmluZygwLCB1bml0SW5kZXgpO1xuICB9XG5cbiAgcmV0dXJuIHtwcm9wZXJ0eSwgdW5pdCwgaGFzT3ZlcnJpZGVGbGFnfTtcbn1cbiJdfQ==