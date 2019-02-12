import * as tslib_1 from "tslib";
import { Interpolation } from '../../expression_parser/ast';
import * as o from '../../output/output_ast';
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
 *   elementStylingMap(...)
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
                    // params => elementHostAttrs(directive, attrs)
                    _this.populateInitialStylingAttrs(attrs);
                    return [_this._directiveExpr, getConstantLiteralFromArray(constantPool, attrs)];
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
        if (this.hasBindings) {
            return {
                sourceSpan: sourceSpan,
                allocateBindingSlots: 0,
                reference: R3.elementStyling,
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
                    // min params => elementStyling()
                    // max params => elementStyling(classBindings, styleBindings, sanitizer, directive)
                    var expectedNumberOfArgs = 0;
                    if (_this._directiveExpr) {
                        expectedNumberOfArgs = 4;
                    }
                    else if (_this._useDefaultSanitizer) {
                        expectedNumberOfArgs = 3;
                    }
                    else if (styleBindingProps.length) {
                        expectedNumberOfArgs = 2;
                    }
                    else if (classBindingNames.length) {
                        expectedNumberOfArgs = 1;
                    }
                    var params = [];
                    addParam(params, classBindingNames.length > 0, getConstantLiteralFromArray(constantPool, classBindingNames), 1, expectedNumberOfArgs);
                    addParam(params, styleBindingProps.length > 0, getConstantLiteralFromArray(constantPool, styleBindingProps), 2, expectedNumberOfArgs);
                    addParam(params, _this._useDefaultSanitizer, o.importExpr(R3.defaultStyleSanitizer), 3, expectedNumberOfArgs);
                    if (_this._directiveExpr) {
                        params.push(_this._directiveExpr);
                    }
                    return params;
                }
            };
        }
        return null;
    };
    /**
     * Builds an instruction with all the expressions and parameters for `elementStylingMap`.
     *
     * The instruction data will contain all expressions for `elementStylingMap` to function
     * which include the `[style]` and `[class]` expression params (if they exist) as well as
     * the sanitizer and directive reference expression.
     */
    StylingBuilder.prototype.buildElementStylingMapInstruction = function (valueConverter) {
        var _this = this;
        if (this._classMapInput || this._styleMapInput) {
            var stylingInput = this._classMapInput || this._styleMapInput;
            var totalBindingSlotsRequired = 0;
            // these values must be outside of the update block so that they can
            // be evaluted (the AST visit call) during creation time so that any
            // pipes can be picked up in time before the template is built
            var mapBasedClassValue_1 = this._classMapInput ? this._classMapInput.value.visit(valueConverter) : null;
            if (mapBasedClassValue_1 instanceof Interpolation) {
                totalBindingSlotsRequired += mapBasedClassValue_1.expressions.length;
            }
            var mapBasedStyleValue_1 = this._styleMapInput ? this._styleMapInput.value.visit(valueConverter) : null;
            if (mapBasedStyleValue_1 instanceof Interpolation) {
                totalBindingSlotsRequired += mapBasedStyleValue_1.expressions.length;
            }
            return {
                sourceSpan: stylingInput.sourceSpan,
                reference: R3.elementStylingMap,
                allocateBindingSlots: totalBindingSlotsRequired,
                buildParams: function (convertFn) {
                    // min params => elementStylingMap(index, classMap)
                    // max params => elementStylingMap(index, classMap, styleMap, directive)
                    var expectedNumberOfArgs = 0;
                    if (_this._directiveExpr) {
                        expectedNumberOfArgs = 4;
                    }
                    else if (mapBasedStyleValue_1) {
                        expectedNumberOfArgs = 3;
                    }
                    else if (mapBasedClassValue_1) {
                        // index and class = 2
                        expectedNumberOfArgs = 2;
                    }
                    var params = [_this._elementIndexExpr];
                    addParam(params, mapBasedClassValue_1, mapBasedClassValue_1 ? convertFn(mapBasedClassValue_1) : null, 2, expectedNumberOfArgs);
                    addParam(params, mapBasedStyleValue_1, mapBasedStyleValue_1 ? convertFn(mapBasedStyleValue_1) : null, 3, expectedNumberOfArgs);
                    addParam(params, _this._directiveExpr, _this._directiveExpr, 4, expectedNumberOfArgs);
                    return params;
                }
            };
        }
        return null;
    };
    StylingBuilder.prototype._buildSingleInputs = function (reference, inputs, mapIndex, allowUnits, valueConverter) {
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
                    // min params => elementStlyingProp(elmIndex, bindingIndex, value)
                    // max params => elementStlyingProp(elmIndex, bindingIndex, value, overrideFlag)
                    var params = [_this._elementIndexExpr, o.literal(bindingIndex), convertFn(value)];
                    if (allowUnits) {
                        if (input.unit) {
                            params.push(o.literal(input.unit));
                        }
                        else if (_this._directiveExpr) {
                            params.push(o.NULL_EXPR);
                        }
                    }
                    if (_this._directiveExpr) {
                        params.push(_this._directiveExpr);
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
    };
    StylingBuilder.prototype._buildClassInputs = function (valueConverter) {
        if (this._singleClassInputs) {
            return this._buildSingleInputs(R3.elementClassProp, this._singleClassInputs, this._classesIndex, false, valueConverter);
        }
        return [];
    };
    StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
        if (this._singleStyleInputs) {
            return this._buildSingleInputs(R3.elementStyleProp, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
        }
        return [];
    };
    StylingBuilder.prototype._buildApplyFn = function () {
        var _this = this;
        return {
            sourceSpan: this._lastStylingInput ? this._lastStylingInput.sourceSpan : null,
            reference: R3.elementStylingApply,
            allocateBindingSlots: 0,
            buildParams: function () {
                // min params => elementStylingApply(elmIndex)
                // max params => elementStylingApply(elmIndex, directive)
                var params = [_this._elementIndexExpr];
                if (_this._directiveExpr) {
                    params.push(_this._directiveExpr);
                }
                return params;
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
            var mapInstruction = this.buildElementStylingMapInstruction(valueConverter);
            if (mapInstruction) {
                instructions.push(mapInstruction);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQVNBLE9BQU8sRUFBbUIsYUFBYSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDNUUsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUc3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxLQUFLLElBQUksVUFBVSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFHbkQsSUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDO0FBdUJwQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTRCRztBQUNIO0lBMENFLHdCQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUF6QzlGLGlFQUFpRTtRQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDbEM7OztXQUdHO1FBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFFM0IsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwyQ0FBMkM7UUFDbkMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQ3RELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQzVELDBDQUEwQztRQUNsQyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQ3BELHNCQUFpQixHQUEyQixJQUFJLENBQUM7UUFFekQsd0RBQXdEO1FBQ3hELGtDQUFrQztRQUVsQzs7OztXQUlHO1FBQ0ssaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUVqRDs7OztXQUlH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RUFBRTtRQUN0QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3BCO1NBQU0sSUFBSSxTQUFTLEdBQUcsaUJBQWlCLEVBQUU7UUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDMUI7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLGFBQWEsQ0FBQyxJQUFZO0lBRXhDLElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQztJQUM1QixJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ25ELElBQUksYUFBYSxLQUFLLENBQUMsQ0FBQyxFQUFFO1FBQ3hCLElBQUksR0FBRyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2pFLGVBQWUsR0FBRyxJQUFJLENBQUM7S0FDeEI7SUFFRCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7SUFDZCxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDcEIsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QyxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUU7UUFDakIsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN6QztJQUVELE9BQU8sRUFBQyxRQUFRLFVBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxlQUFlLGlCQUFBLEVBQUMsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEJpbmRpbmdUeXBlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7cGFyc2UgYXMgcGFyc2VTdHlsZX0gZnJvbSAnLi9zdHlsZV9wYXJzZXInO1xuaW1wb3J0IHtWYWx1ZUNvbnZlcnRlcn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5cbmNvbnN0IElNUE9SVEFOVF9GTEFHID0gJyFpbXBvcnRhbnQnO1xuXG4vKipcbiAqIEEgc3R5bGluZyBleHByZXNzaW9uIHN1bW1hcnkgdGhhdCBpcyB0byBiZSBwcm9jZXNzZWQgYnkgdGhlIGNvbXBpbGVyXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5zdHJ1Y3Rpb24ge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBhbGxvY2F0ZUJpbmRpbmdTbG90czogbnVtYmVyO1xuICBidWlsZFBhcmFtcyhjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuLyoqXG4gKiBBbiBpbnRlcm5hbCByZWNvcmQgb2YgdGhlIGlucHV0IGRhdGEgZm9yIGEgc3R5bGluZyBiaW5kaW5nXG4gKi9cbmludGVyZmFjZSBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbjtcbiAgbmFtZTogc3RyaW5nfG51bGw7XG4gIHVuaXQ6IHN0cmluZ3xudWxsO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cbi8qKlxuICogUHJvZHVjZXMgY3JlYXRpb24vdXBkYXRlIGluc3RydWN0aW9ucyBmb3IgYWxsIHN0eWxpbmcgYmluZGluZ3MgKGNsYXNzIGFuZCBzdHlsZSlcbiAqXG4gKiBJdCBhbHNvIHByb2R1Y2VzIHRoZSBjcmVhdGlvbiBpbnN0cnVjdGlvbiB0byByZWdpc3RlciBhbGwgaW5pdGlhbCBzdHlsaW5nIHZhbHVlc1xuICogKHdoaWNoIGFyZSBhbGwgdGhlIHN0YXRpYyBjbGFzcz1cIi4uLlwiIGFuZCBzdHlsZT1cIi4uLlwiIGF0dHJpYnV0ZSB2YWx1ZXMgdGhhdCBleGlzdFxuICogb24gYW4gZWxlbWVudCB3aXRoaW4gYSB0ZW1wbGF0ZSkuXG4gKlxuICogVGhlIGJ1aWxkZXIgY2xhc3MgYmVsb3cgaGFuZGxlcyBwcm9kdWNpbmcgaW5zdHJ1Y3Rpb25zIGZvciB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICpcbiAqIC0gU3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMgKHN0eWxlPVwiLi4uXCIgYW5kIGNsYXNzPVwiLi4uXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgbWFwIGJpbmRpbmdzIChbc3R5bGVdPVwibWFwXCIgYW5kIFtjbGFzc109XCJtYXB8c3RyaW5nXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgcHJvcGVydHkgYmluZGluZ3MgKFtzdHlsZS5wcm9wXT1cImV4cFwiIGFuZCBbY2xhc3MubmFtZV09XCJleHBcIilcbiAqXG4gKiBEdWUgdG8gdGhlIGNvbXBsZXggcmVsYXRpb25zaGlwIG9mIGFsbCBvZiB0aGVzZSBjYXNlcywgdGhlIGluc3RydWN0aW9ucyBnZW5lcmF0ZWRcbiAqIGZvciB0aGVzZSBhdHRyaWJ1dGVzL3Byb3BlcnRpZXMvYmluZGluZ3MgbXVzdCBiZSBkb25lIHNvIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBUaGVcbiAqIG9yZGVyIHdoaWNoIHRoZXNlIG11c3QgYmUgZ2VuZXJhdGVkIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogaWYgKGNyZWF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmcoLi4uKVxuICogfVxuICogaWYgKHVwZGF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmdNYXAoLi4uKVxuICogICBlbGVtZW50U3R5bGVQcm9wKC4uLilcbiAqICAgZWxlbWVudENsYXNzUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsaW5nQXBwKC4uLilcbiAqIH1cbiAqXG4gKiBUaGUgY3JlYXRpb24vdXBkYXRlIG1ldGhvZHMgd2l0aGluIHRoZSBidWlsZGVyIGNsYXNzIHByb2R1Y2UgdGhlc2UgaW5zdHJ1Y3Rpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU3R5bGluZ0J1aWxkZXIge1xuICAvKiogV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdGF0aWMgc3R5bGluZyB2YWx1ZXMgcHJlc2VudCAqL1xuICBwcml2YXRlIF9oYXNJbml0aWFsVmFsdWVzID0gZmFsc2U7XG4gIC8qKlxuICAgKiAgV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdHlsaW5nIGJpbmRpbmdzIHByZXNlbnRcbiAgICogIChpLmUuIGBbc3R5bGVdYCwgYFtjbGFzc11gLCBgW3N0eWxlLnByb3BdYCBvciBgW2NsYXNzLm5hbWVdYClcbiAgICovXG4gIHB1YmxpYyBoYXNCaW5kaW5ncyA9IGZhbHNlO1xuXG4gIC8qKiB0aGUgaW5wdXQgZm9yIFtjbGFzc10gKGlmIGl0IGV4aXN0cykgKi9cbiAgcHJpdmF0ZSBfY2xhc3NNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIC8qKiB0aGUgaW5wdXQgZm9yIFtzdHlsZV0gKGlmIGl0IGV4aXN0cykgKi9cbiAgcHJpdmF0ZSBfc3R5bGVNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIC8qKiBhbiBhcnJheSBvZiBlYWNoIFtzdHlsZS5wcm9wXSBpbnB1dCAqL1xuICBwcml2YXRlIF9zaW5nbGVTdHlsZUlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW2NsYXNzLm5hbWVdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZUNsYXNzSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9sYXN0U3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcblxuICAvLyBtYXBzIGFyZSB1c2VkIGluc3RlYWQgb2YgaGFzaCBtYXBzIGJlY2F1c2UgYSBNYXAgd2lsbFxuICAvLyByZXRhaW4gdGhlIG9yZGVyaW5nIG9mIHRoZSBrZXlzXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggc3R5bGUgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW3N0eWxlLndpZHRoXT1cIndcIiBbc3R5bGUuaGVpZ2h0XT1cImhcIj5gIGltcGxpZXNcbiAgICogdGhhdCBgd2lkdGg9MGAgYW5kIGBoZWlnaHQ9MWApXG4gICAqL1xuICBwcml2YXRlIF9zdHlsZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggY2xhc3MgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW2NsYXNzLmJpZ109XCJiXCIgW2NsYXNzLmhpZGRlbl09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYGJpZz0wYCBhbmQgYGhpZGRlbj0xYClcbiAgICovXG4gIHByaXZhdGUgX2NsYXNzZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxTdHlsZVZhbHVlczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBfaW5pdGlhbENsYXNzVmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGNlcnRhaW4gc3R5bGUgcHJvcGVydGllcyBBTFdBWVMgbmVlZCBzYW5pdGl6YXRpb25cbiAgLy8gdGhpcyBpcyBjaGVja2VkIGVhY2ggdGltZSBuZXcgc3R5bGVzIGFyZSBlbmNvdW50ZXJlZFxuICBwcml2YXRlIF91c2VEZWZhdWx0U2FuaXRpemVyID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZWxlbWVudEluZGV4RXhwcjogby5FeHByZXNzaW9uLCBwcml2YXRlIF9kaXJlY3RpdmVFeHByOiBvLkV4cHJlc3Npb258bnVsbCkge31cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgZ2l2ZW4gaW5wdXQgdG8gdGhlIHN0eWxpbmcgYnVpbGRlciB0byBiZSBsYXRlciB1c2VkIHdoZW4gcHJvZHVjaW5nIEFPVCBjb2RlLlxuICAgKlxuICAgKiBUaGUgY29kZSBiZWxvdyB3aWxsIG9ubHkgYWNjZXB0IHRoZSBpbnB1dCBpZiBpdCBpcyBzb21laG93IHRpZWQgdG8gc3R5bGluZyAod2hldGhlciBpdCBiZVxuICAgKiBzdHlsZS9jbGFzcyBiaW5kaW5ncyBvciBzdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcykuXG4gICAqL1xuICByZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIGFyZSBza2lwcGVkIGluIHRoZSBjb2RlIGJlbG93LFxuICAgIC8vIHRoZXkgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIHN0eWxpbmctYmFzZWQgYmluZGluZ3Mgc2luY2VcbiAgICAvLyB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyIGFuZFxuICAgIC8vIHdpbGwgdGhlcmVmb3JlIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgLy8gd2l0aCBzdHlsZT1cIlwiLCBbc3R5bGVdPVwiXCIgYW5kIFtzdHlsZS5wcm9wXT1cIlwiLCBjbGFzcz1cIlwiLFxuICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWUgPSBpbnB1dC5uYW1lO1xuICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnB1dC51bml0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG5cbiAgcmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgbmFtZVRvTWF0Y2ggPSBuYW1lLnN1YnN0cmluZygwLCA1KTsgIC8vIGNsYXNzIHwgc3R5bGVcbiAgICBjb25zdCBpc1N0eWxlID0gbmFtZVRvTWF0Y2ggPT09ICdzdHlsZSc7XG4gICAgY29uc3QgaXNDbGFzcyA9IGlzU3R5bGUgPyBmYWxzZSA6IChuYW1lVG9NYXRjaCA9PT0gJ2NsYXNzJyk7XG4gICAgaWYgKGlzU3R5bGUgfHwgaXNDbGFzcykge1xuICAgICAgY29uc3QgaXNNYXBCYXNlZCA9IG5hbWUuY2hhckF0KDUpICE9PSAnLic7ICAgICAgICAgLy8gc3R5bGUucHJvcCBvciBjbGFzcy5wcm9wIG1ha2VzIHRoaXMgYSBub1xuICAgICAgY29uc3QgcHJvcGVydHkgPSBuYW1lLnN1YnN0cihpc01hcEJhc2VkID8gNSA6IDYpOyAgLy8gdGhlIGRvdCBleHBsYWlucyB3aHkgdGhlcmUncyBhICsxXG4gICAgICBpZiAoaXNTdHlsZSkge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KHByb3BlcnR5LCBpc01hcEJhc2VkLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmc7XG4gIH1cblxuICByZWdpc3RlclN0eWxlSW5wdXQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHVuaXQ/OiBzdHJpbmd8bnVsbCk6IEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZywgdW5pdDogYmluZGluZ1VuaXR9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTogQm91bmRTdHlsaW5nRW50cnkgPSB7XG4gICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgIHVuaXQ6IHVuaXQgfHwgYmluZGluZ1VuaXQsIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWdcbiAgICB9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID0gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKG5hbWUpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICByZWdpc3RlckNsYXNzSW5wdXQobmFtZTogc3RyaW5nLCBpc01hcEJhc2VkOiBib29sZWFuLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgQm91bmRTdHlsaW5nRW50cnkge1xuICAgIGNvbnN0IHtwcm9wZXJ0eSwgaGFzT3ZlcnJpZGVGbGFnfSA9IHBhcnNlUHJvcGVydHkobmFtZSk7XG4gICAgY29uc3QgZW50cnk6XG4gICAgICAgIEJvdW5kU3R5bGluZ0VudHJ5ID0ge25hbWU6IHByb3BlcnR5LCB2YWx1ZSwgc291cmNlU3BhbiwgaGFzT3ZlcnJpZGVGbGFnLCB1bml0OiBudWxsfTtcbiAgICBpZiAoaXNNYXBCYXNlZCkge1xuICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIHN0eWxlIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBzdHlsZSBzdHJpbmcgKGUuZy4gYHdpZHRoOjEwMHB4OyBoZWlnaHQ6MjAwcHg7YClcbiAgICovXG4gIHJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgY2xhc3Mgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIGNsYXNzTmFtZSBzdHJpbmcgKGUuZy4gYGRpc2FibGVkIGdvbGQgem9vbWApXG4gICAqL1xuICByZWdpc3RlckNsYXNzQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYWxsIHN0eWxpbmctcmVsYXRlZCBleHByZXNzaW9ucyB0byB0aGUgcHJvdmlkZWQgYXR0cnMgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSBhdHRycyBhbiBleGlzdGluZyBhcnJheSB3aGVyZSBlYWNoIG9mIHRoZSBzdHlsaW5nIGV4cHJlc3Npb25zXG4gICAqIHdpbGwgYmUgaW5zZXJ0ZWQgaW50by5cbiAgICovXG4gIHBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyczogby5FeHByZXNzaW9uW10pOiB2b2lkIHtcbiAgICAvLyBbQ0xBU1NfTUFSS0VSLCAnZm9vJywgJ2JhcicsICdiYXonIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlc1tpXSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFtTVFlMRV9NQVJLRVIsICd3aWR0aCcsICcyMDBweCcsICdoZWlnaHQnLCAnMTAwcHgnLCAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGF0dHJzLnB1c2goXG4gICAgICAgICAgICBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2ldKSwgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpICsgMV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRIb3N0QXR0cnNgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZ2VuZXJhdGlvbiBjb2RlIGJlbG93IGlzIHVzZWQgZm9yIHByb2R1Y2luZyB0aGUgQU9UIHN0YXRlbWVudCBjb2RlIHdoaWNoIGlzXG4gICAqIHJlc3BvbnNpYmxlIGZvciByZWdpc3RlcmluZyBpbml0aWFsIHN0eWxlcyAod2l0aGluIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncycgY3JlYXRpb24gYmxvY2spLFxuICAgKiBhcyB3ZWxsIGFzIGFueSBvZiB0aGUgcHJvdmlkZWQgYXR0cmlidXRlIHZhbHVlcywgdG8gdGhlIGRpcmVjdGl2ZSBob3N0IGVsZW1lbnQuXG4gICAqL1xuICBidWlsZEhvc3RBdHRyc0luc3RydWN0aW9uKFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGF0dHJzOiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIgJiYgKGF0dHJzLmxlbmd0aCB8fCB0aGlzLl9oYXNJbml0aWFsVmFsdWVzKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50SG9zdEF0dHJzLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCxcbiAgICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAvLyBwYXJhbXMgPT4gZWxlbWVudEhvc3RBdHRycyhkaXJlY3RpdmUsIGF0dHJzKVxuICAgICAgICAgIHRoaXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJzKTtcbiAgICAgICAgICByZXR1cm4gW3RoaXMuX2RpcmVjdGl2ZUV4cHIgISwgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgYXR0cnMpXTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgc3R5bGUvY2xhc3MgYmluZGluZ3MgdG8gYW4gZWxlbWVudC5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOlxuICAgICAgSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3MpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nLFxuICAgICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAgIC8vIGEgc3RyaW5nIGFycmF5IG9mIGV2ZXJ5IHN0eWxlLWJhc2VkIGJpbmRpbmdcbiAgICAgICAgICBjb25zdCBzdHlsZUJpbmRpbmdQcm9wcyA9XG4gICAgICAgICAgICAgIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID8gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMubWFwKGkgPT4gby5saXRlcmFsKGkubmFtZSkpIDogW107XG4gICAgICAgICAgLy8gYSBzdHJpbmcgYXJyYXkgb2YgZXZlcnkgY2xhc3MtYmFzZWQgYmluZGluZ1xuICAgICAgICAgIGNvbnN0IGNsYXNzQmluZGluZ05hbWVzID1cbiAgICAgICAgICAgICAgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPyB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cy5tYXAoaSA9PiBvLmxpdGVyYWwoaS5uYW1lKSkgOiBbXTtcblxuICAgICAgICAgIC8vIHRvIHNhbHZhZ2Ugc3BhY2UgaW4gdGhlIEFPVCBnZW5lcmF0ZWQgY29kZSwgdGhlcmUgaXMgbm8gcG9pbnQgaW4gcGFzc2luZ1xuICAgICAgICAgIC8vIGluIGBudWxsYCBpbnRvIGEgcGFyYW0gaWYgYW55IGZvbGxvdy11cCBwYXJhbXMgYXJlIG5vdCB1c2VkLiBUaGVyZWZvcmUsXG4gICAgICAgICAgLy8gb25seSB3aGVuIGEgdHJhaWxpbmcgcGFyYW0gaXMgdXNlZCB0aGVuIGl0IHdpbGwgYmUgZmlsbGVkIHdpdGggbnVsbHMgaW4gYmV0d2VlblxuICAgICAgICAgIC8vIChvdGhlcndpc2UgYSBzaG9ydGVyIGFtb3VudCBvZiBwYXJhbXMgd2lsbCBiZSBmaWxsZWQpLiBUaGUgY29kZSBiZWxvdyBoZWxwc1xuICAgICAgICAgIC8vIGRldGVybWluZSBob3cgbWFueSBwYXJhbXMgYXJlIHJlcXVpcmVkIGluIHRoZSBleHByZXNzaW9uIGNvZGUuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKClcbiAgICAgICAgICAvLyBtYXggcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKGNsYXNzQmluZGluZ3MsIHN0eWxlQmluZGluZ3MsIHNhbml0aXplciwgZGlyZWN0aXZlKVxuICAgICAgICAgIGxldCBleHBlY3RlZE51bWJlck9mQXJncyA9IDA7XG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gNDtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAyO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NCaW5kaW5nTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDE7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIGNsYXNzQmluZGluZ05hbWVzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIGNsYXNzQmluZGluZ05hbWVzKSwgMSxcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShjb25zdGFudFBvb2wsIHN0eWxlQmluZGluZ1Byb3BzKSwgMixcbiAgICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIsIG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpLCAzLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudFN0eWxpbmdNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgZWxlbWVudFN0eWxpbmdNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGUgdGhlIGBbc3R5bGVdYCBhbmQgYFtjbGFzc11gIGV4cHJlc3Npb24gcGFyYW1zIChpZiB0aGV5IGV4aXN0KSBhcyB3ZWxsIGFzXG4gICAqIHRoZSBzYW5pdGl6ZXIgYW5kIGRpcmVjdGl2ZSByZWZlcmVuY2UgZXhwcmVzc2lvbi5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCB8fCB0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXQgPSB0aGlzLl9jbGFzc01hcElucHV0ICEgfHwgdGhpcy5fc3R5bGVNYXBJbnB1dCAhO1xuICAgICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAwO1xuXG4gICAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgICAgLy8gYmUgZXZhbHV0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzVmFsdWUgPVxuICAgICAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPyB0aGlzLl9jbGFzc01hcElucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKSA6IG51bGw7XG4gICAgICBpZiAobWFwQmFzZWRDbGFzc1ZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IG1hcEJhc2VkQ2xhc3NWYWx1ZS5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA/IHRoaXMuX3N0eWxlTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcbiAgICAgIGlmIChtYXBCYXNlZFN0eWxlVmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gbWFwQmFzZWRTdHlsZVZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudFN0eWxpbmdNYXAsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIC8vIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdNYXAoaW5kZXgsIGNsYXNzTWFwKVxuICAgICAgICAgIC8vIG1heCBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdNYXAoaW5kZXgsIGNsYXNzTWFwLCBzdHlsZU1hcCwgZGlyZWN0aXZlKVxuICAgICAgICAgIGxldCBleHBlY3RlZE51bWJlck9mQXJncyA9IDA7XG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gNDtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1hcEJhc2VkU3R5bGVWYWx1ZSkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWFwQmFzZWRDbGFzc1ZhbHVlKSB7XG4gICAgICAgICAgICAvLyBpbmRleCBhbmQgY2xhc3MgPSAyXG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgcGFyYW1zLCBtYXBCYXNlZENsYXNzVmFsdWUsIG1hcEJhc2VkQ2xhc3NWYWx1ZSA/IGNvbnZlcnRGbihtYXBCYXNlZENsYXNzVmFsdWUpIDogbnVsbCxcbiAgICAgICAgICAgICAgMiwgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIG1hcEJhc2VkU3R5bGVWYWx1ZSwgbWFwQmFzZWRTdHlsZVZhbHVlID8gY29udmVydEZuKG1hcEJhc2VkU3R5bGVWYWx1ZSkgOiBudWxsLFxuICAgICAgICAgICAgICAzLCBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgYWRkUGFyYW0ocGFyYW1zLCB0aGlzLl9kaXJlY3RpdmVFeHByLCB0aGlzLl9kaXJlY3RpdmVFeHByLCA0LCBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgaW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdLCBtYXBJbmRleDogTWFwPHN0cmluZywgbnVtYmVyPixcbiAgICAgIGFsbG93VW5pdHM6IGJvb2xlYW4sIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMDtcbiAgICByZXR1cm4gaW5wdXRzLm1hcChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nSW5kZXg6IG51bWJlciA9IG1hcEluZGV4LmdldChpbnB1dC5uYW1lICEpICE7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAwO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQsIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICAvLyBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdGx5aW5nUHJvcChlbG1JbmRleCwgYmluZGluZ0luZGV4LCB2YWx1ZSlcbiAgICAgICAgICAvLyBtYXggcGFyYW1zID0+IGVsZW1lbnRTdGx5aW5nUHJvcChlbG1JbmRleCwgYmluZGluZ0luZGV4LCB2YWx1ZSwgb3ZlcnJpZGVGbGFnKVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zID0gW3RoaXMuX2VsZW1lbnRJbmRleEV4cHIsIG8ubGl0ZXJhbChiaW5kaW5nSW5kZXgpLCBjb252ZXJ0Rm4odmFsdWUpXTtcblxuICAgICAgICAgIGlmIChhbGxvd1VuaXRzKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaW5wdXQudW5pdCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZGlyZWN0aXZlRXhwcik7XG4gICAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5oYXNPdmVycmlkZUZsYWcpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaW5wdXQuaGFzT3ZlcnJpZGVGbGFnKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IEluc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmVsZW1lbnRDbGFzc1Byb3AsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgUjMuZWxlbWVudFN0eWxlUHJvcCwgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMsIHRoaXMuX3N0eWxlc0luZGV4LCB0cnVlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQXBwbHlGbigpOiBJbnN0cnVjdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPyB0aGlzLl9sYXN0U3R5bGluZ0lucHV0LnNvdXJjZVNwYW4gOiBudWxsLFxuICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LFxuICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsXG4gICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAvLyBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nQXBwbHkoZWxtSW5kZXgpXG4gICAgICAgIC8vIG1heCBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdBcHBseShlbG1JbmRleCwgZGlyZWN0aXZlKVxuICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW3RoaXMuX2VsZW1lbnRJbmRleEV4cHJdO1xuICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFsbCBpbnN0cnVjdGlvbnMgd2hpY2ggY29udGFpbiB0aGUgZXhwcmVzc2lvbnMgdGhhdCB3aWxsIGJlIHBsYWNlZFxuICAgKiBpbnRvIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSB0ZW1wbGF0ZSBmdW5jdGlvbiBvciBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MgZnVuY3Rpb24uXG4gICAqL1xuICBidWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcikge1xuICAgIGNvbnN0IGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzKSB7XG4gICAgICBjb25zdCBtYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRFbGVtZW50U3R5bGluZ01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmIChtYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChtYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByb3AgPT09ICdiYWNrZ3JvdW5kLWltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZCcgfHwgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHxcbiAgICAgIHByb3AgPT09ICdmaWx0ZXInIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZS1pbWFnZSc7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0byBlaXRoZXIgcHJvdmlkZSB0aGUgY29uc3RhbnQgbGl0ZXJhbCB0aGF0IHdpbGwgaG91c2UgdGhlIHZhbHVlXG4gKiBoZXJlIG9yIGEgbnVsbCB2YWx1ZSBpZiB0aGUgcHJvdmlkZWQgdmFsdWVzIGFyZSBlbXB0eS5cbiAqL1xuZnVuY3Rpb24gZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIHZhbHVlcy5sZW5ndGggPyBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycih2YWx1ZXMpLCB0cnVlKSA6IG8uTlVMTF9FWFBSO1xufVxuXG4vKipcbiAqIFNpbXBsZSBoZWxwZXIgZnVuY3Rpb24gdGhhdCBhZGRzIGEgcGFyYW1ldGVyIG9yIGRvZXMgbm90aGluZyBhdCBhbGwgZGVwZW5kaW5nIG9uIHRoZSBwcm92aWRlZFxuICogcHJlZGljYXRlIGFuZCB0b3RhbEV4cGVjdGVkQXJncyB2YWx1ZXNcbiAqL1xuZnVuY3Rpb24gYWRkUGFyYW0oXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSwgcHJlZGljYXRlOiBhbnksIHZhbHVlOiBvLkV4cHJlc3Npb24gfCBudWxsLCBhcmdOdW1iZXI6IG51bWJlcixcbiAgICB0b3RhbEV4cGVjdGVkQXJnczogbnVtYmVyKSB7XG4gIGlmIChwcmVkaWNhdGUgJiYgdmFsdWUpIHtcbiAgICBwYXJhbXMucHVzaCh2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoYXJnTnVtYmVyIDwgdG90YWxFeHBlY3RlZEFyZ3MpIHtcbiAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvcGVydHkobmFtZTogc3RyaW5nKTpcbiAgICB7cHJvcGVydHk6IHN0cmluZywgdW5pdDogc3RyaW5nLCBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW59IHtcbiAgbGV0IGhhc092ZXJyaWRlRmxhZyA9IGZhbHNlO1xuICBjb25zdCBvdmVycmlkZUluZGV4ID0gbmFtZS5pbmRleE9mKElNUE9SVEFOVF9GTEFHKTtcbiAgaWYgKG92ZXJyaWRlSW5kZXggIT09IC0xKSB7XG4gICAgbmFtZSA9IG92ZXJyaWRlSW5kZXggPiAwID8gbmFtZS5zdWJzdHJpbmcoMCwgb3ZlcnJpZGVJbmRleCkgOiAnJztcbiAgICBoYXNPdmVycmlkZUZsYWcgPSB0cnVlO1xuICB9XG5cbiAgbGV0IHVuaXQgPSAnJztcbiAgbGV0IHByb3BlcnR5ID0gbmFtZTtcbiAgY29uc3QgdW5pdEluZGV4ID0gbmFtZS5sYXN0SW5kZXhPZignLicpO1xuICBpZiAodW5pdEluZGV4ID4gMCkge1xuICAgIHVuaXQgPSBuYW1lLnN1YnN0cih1bml0SW5kZXggKyAxKTtcbiAgICBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyaW5nKDAsIHVuaXRJbmRleCk7XG4gIH1cblxuICByZXR1cm4ge3Byb3BlcnR5LCB1bml0LCBoYXNPdmVycmlkZUZsYWd9O1xufVxuIl19