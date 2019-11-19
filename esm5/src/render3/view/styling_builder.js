import { __read, __spread } from "tslib";
import { ASTWithSource, BindingPipe, Interpolation } from '../../expression_parser/ast';
import * as o from '../../output/output_ast';
import { isEmptyExpression } from '../../template_parser/template_parser';
import { Identifiers as R3 } from '../r3_identifiers';
import { hyphenate, parse as parseStyle } from './style_parser';
import { getInterpolationArgsLength } from './util';
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
 *   styling(...)
 * }
 * if (updateMode) {
 *   styleMap(...)
 *   classMap(...)
 *   styleProp(...)
 *   classProp(...)
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
        this.hasBindingsWithPipes = false;
        /** the input for [class] (if it exists) */
        this._classMapInput = null;
        /** the input for [style] (if it exists) */
        this._styleMapInput = null;
        /** an array of each [style.prop] input */
        this._singleStyleInputs = null;
        /** an array of each [class.name] input */
        this._singleClassInputs = null;
        this._lastStylingInput = null;
        this._firstStylingInput = null;
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
        var prefix = name.substring(0, 6);
        var isStyle = name === 'style' || prefix === 'style.' || prefix === 'style!';
        var isClass = !isStyle &&
            (name === 'class' || name === 'className' || prefix === 'class.' || prefix === 'class!');
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
        name = normalizePropName(name);
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
        this._firstStylingInput = this._firstStylingInput || entry;
        this._checkForPipes(value);
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
            if (this._classMapInput) {
                throw new Error('[class] and [className] bindings cannot be used on the same element simultaneously');
            }
            this._classMapInput = entry;
        }
        else {
            (this._singleClassInputs = this._singleClassInputs || []).push(entry);
            registerIntoMap(this._classesIndex, property);
        }
        this._lastStylingInput = entry;
        this._firstStylingInput = this._firstStylingInput || entry;
        this._checkForPipes(value);
        this.hasBindings = true;
        return entry;
    };
    StylingBuilder.prototype._checkForPipes = function (value) {
        if ((value instanceof ASTWithSource) && (value.ast instanceof BindingPipe)) {
            this.hasBindingsWithPipes = true;
        }
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
                reference: R3.elementHostAttrs,
                calls: [{
                        sourceSpan: sourceSpan,
                        allocateBindingSlots: 0,
                        params: function () {
                            // params => elementHostAttrs(attrs)
                            _this.populateInitialStylingAttrs(attrs);
                            var attrArray = !attrs.some(function (attr) { return attr instanceof o.WrappedNodeExpr; }) ?
                                getConstantLiteralFromArray(constantPool, attrs) :
                                o.literalArr(attrs);
                            return [attrArray];
                        }
                    }]
            };
        }
        return null;
    };
    /**
     * Builds an instruction with all the expressions and parameters for `classMap`.
     *
     * The instruction data will contain all expressions for `classMap` to function
     * which includes the `[class]` expression params.
     */
    StylingBuilder.prototype.buildClassMapInstruction = function (valueConverter) {
        if (this._classMapInput) {
            return this._buildMapBasedInstruction(valueConverter, true, this._classMapInput);
        }
        return null;
    };
    /**
     * Builds an instruction with all the expressions and parameters for `styleMap`.
     *
     * The instruction data will contain all expressions for `styleMap` to function
     * which includes the `[style]` expression params.
     */
    StylingBuilder.prototype.buildStyleMapInstruction = function (valueConverter) {
        if (this._styleMapInput) {
            return this._buildMapBasedInstruction(valueConverter, false, this._styleMapInput);
        }
        return null;
    };
    StylingBuilder.prototype._buildMapBasedInstruction = function (valueConverter, isClassBased, stylingInput) {
        // each styling binding value is stored in the LView
        // map-based bindings allocate two slots: one for the
        // previous binding value and another for the previous
        // className or style attribute value.
        var totalBindingSlotsRequired = 2;
        // these values must be outside of the update block so that they can
        // be evaluated (the AST visit call) during creation time so that any
        // pipes can be picked up in time before the template is built
        var mapValue = stylingInput.value.visit(valueConverter);
        var reference;
        if (mapValue instanceof Interpolation && isClassBased) {
            totalBindingSlotsRequired += mapValue.expressions.length;
            reference = getClassMapInterpolationExpression(mapValue);
        }
        else {
            reference = isClassBased ? R3.classMap : R3.styleMap;
        }
        return {
            reference: reference,
            calls: [{
                    supportsInterpolation: isClassBased,
                    sourceSpan: stylingInput.sourceSpan,
                    allocateBindingSlots: totalBindingSlotsRequired,
                    params: function (convertFn) {
                        var convertResult = convertFn(mapValue);
                        return Array.isArray(convertResult) ? convertResult : [convertResult];
                    }
                }]
        };
    };
    StylingBuilder.prototype._buildSingleInputs = function (reference, inputs, mapIndex, allowUnits, valueConverter, getInterpolationExpressionFn) {
        var instructions = [];
        inputs.forEach(function (input) {
            var previousInstruction = instructions[instructions.length - 1];
            var value = input.value.visit(valueConverter);
            var referenceForCall = reference;
            var totalBindingSlotsRequired = 1; // each styling binding value is stored in the LView
            if (value instanceof Interpolation) {
                totalBindingSlotsRequired += value.expressions.length;
                if (getInterpolationExpressionFn) {
                    referenceForCall = getInterpolationExpressionFn(value);
                }
            }
            var call = {
                sourceSpan: input.sourceSpan,
                allocateBindingSlots: totalBindingSlotsRequired,
                supportsInterpolation: !!getInterpolationExpressionFn,
                params: function (convertFn) {
                    // params => stylingProp(propName, value)
                    var params = [];
                    params.push(o.literal(input.name));
                    var convertResult = convertFn(value);
                    if (Array.isArray(convertResult)) {
                        params.push.apply(params, __spread(convertResult));
                    }
                    else {
                        params.push(convertResult);
                    }
                    if (allowUnits && input.unit) {
                        params.push(o.literal(input.unit));
                    }
                    return params;
                }
            };
            // If we ended up generating a call to the same instruction as the previous styling property
            // we can chain the calls together safely to save some bytes, otherwise we have to generate
            // a separate instruction call. This is primarily a concern with interpolation instructions
            // where we may start off with one `reference`, but end up using another based on the
            // number of interpolations.
            if (previousInstruction && previousInstruction.reference === referenceForCall) {
                previousInstruction.calls.push(call);
            }
            else {
                instructions.push({ reference: referenceForCall, calls: [call] });
            }
        });
        return instructions;
    };
    StylingBuilder.prototype._buildClassInputs = function (valueConverter) {
        if (this._singleClassInputs) {
            return this._buildSingleInputs(R3.classProp, this._singleClassInputs, this._classesIndex, false, valueConverter);
        }
        return [];
    };
    StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
        if (this._singleStyleInputs) {
            return this._buildSingleInputs(R3.styleProp, this._singleStyleInputs, this._stylesIndex, true, valueConverter, getStylePropInterpolationExpression);
        }
        return [];
    };
    StylingBuilder.prototype._buildSanitizerFn = function () {
        return {
            reference: R3.styleSanitizer,
            calls: [{
                    sourceSpan: this._firstStylingInput ? this._firstStylingInput.sourceSpan : null,
                    allocateBindingSlots: 0,
                    params: function () { return [o.importExpr(R3.defaultStyleSanitizer)]; }
                }]
        };
    };
    /**
     * Constructs all instructions which contain the expressions that will be placed
     * into the update block of a template function or a directive hostBindings function.
     */
    StylingBuilder.prototype.buildUpdateLevelInstructions = function (valueConverter) {
        var instructions = [];
        if (this.hasBindings) {
            if (this._useDefaultSanitizer) {
                instructions.push(this._buildSanitizerFn());
            }
            var styleMapInstruction = this.buildStyleMapInstruction(valueConverter);
            if (styleMapInstruction) {
                instructions.push(styleMapInstruction);
            }
            var classMapInstruction = this.buildClassMapInstruction(valueConverter);
            if (classMapInstruction) {
                instructions.push(classMapInstruction);
            }
            instructions.push.apply(instructions, __spread(this._buildStyleInputs(valueConverter)));
            instructions.push.apply(instructions, __spread(this._buildClassInputs(valueConverter)));
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
    // Note that browsers support both the dash case and
    // camel case property names when setting through JS.
    return prop === 'background-image' || prop === 'backgroundImage' || prop === 'background' ||
        prop === 'border-image' || prop === 'borderImage' || prop === 'filter' ||
        prop === 'list-style' || prop === 'listStyle' || prop === 'list-style-image' ||
        prop === 'listStyleImage' || prop === 'clip-path' || prop === 'clipPath';
}
/**
 * Simple helper function to either provide the constant literal that will house the value
 * here or a null value if the provided values are empty.
 */
function getConstantLiteralFromArray(constantPool, values) {
    return values.length ? constantPool.getConstLiteral(o.literalArr(values), true) : o.NULL_EXPR;
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
/**
 * Gets the instruction to generate for an interpolated class map.
 * @param interpolation An Interpolation AST
 */
function getClassMapInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 1:
            return R3.classMap;
        case 3:
            return R3.classMapInterpolate1;
        case 5:
            return R3.classMapInterpolate2;
        case 7:
            return R3.classMapInterpolate3;
        case 9:
            return R3.classMapInterpolate4;
        case 11:
            return R3.classMapInterpolate5;
        case 13:
            return R3.classMapInterpolate6;
        case 15:
            return R3.classMapInterpolate7;
        case 17:
            return R3.classMapInterpolate8;
        default:
            return R3.classMapInterpolateV;
    }
}
/**
 * Gets the instruction to generate for an interpolated style prop.
 * @param interpolation An Interpolation AST
 */
function getStylePropInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 1:
            return R3.styleProp;
        case 3:
            return R3.stylePropInterpolate1;
        case 5:
            return R3.stylePropInterpolate2;
        case 7:
            return R3.stylePropInterpolate3;
        case 9:
            return R3.stylePropInterpolate4;
        case 11:
            return R3.stylePropInterpolate5;
        case 13:
            return R3.stylePropInterpolate6;
        case 15:
            return R3.stylePropInterpolate7;
        case 17:
            return R3.stylePropInterpolate8;
        default:
            return R3.stylePropInterpolateV;
    }
}
function normalizePropName(prop) {
    return hyphenate(prop);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQVNBLE9BQU8sRUFBTSxhQUFhLEVBQUUsV0FBVyxFQUFlLGFBQWEsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3hHLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sdUNBQXVDLENBQUM7QUFFeEUsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsU0FBUyxFQUFFLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUU5RCxPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFbEQsSUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDO0FBNkJwQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTRCRztBQUNIO0lBNENFLHdCQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUEzQzlGLGlFQUFpRTtRQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDbEM7OztXQUdHO1FBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFDcEIseUJBQW9CLEdBQUcsS0FBSyxDQUFDO1FBRXBDLDJDQUEyQztRQUNuQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7UUFDdEQsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwwQ0FBMEM7UUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztRQUM1RCwwQ0FBMEM7UUFD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QUNsQyxLQUFLLENBQUM7WUFDSixPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztRQUNsQyxLQUFLLENBQUM7WUFDSixPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztRQUNsQyxLQUFLLEVBQUU7WUFDTCxPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztRQUNsQyxLQUFLLEVBQUU7WUFDTCxPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztRQUNsQyxLQUFLLEVBQUU7WUFDTCxPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztRQUNsQyxLQUFLLEVBQUU7WUFDTCxPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztRQUNsQztZQUNFLE9BQU8sRUFBRSxDQUFDLHFCQUFxQixDQUFDO0tBQ25DO0FBQ0gsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBWTtJQUNyQyxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFTVFdpdGhTb3VyY2UsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc0VtcHR5RXhwcmVzc2lvbn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3BhcnNlcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7aHlwaGVuYXRlLCBwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7Z2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGh9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IElNUE9SVEFOVF9GTEFHID0gJyFpbXBvcnRhbnQnO1xuXG4vKipcbiAqIEEgc3R5bGluZyBleHByZXNzaW9uIHN1bW1hcnkgdGhhdCBpcyB0byBiZSBwcm9jZXNzZWQgYnkgdGhlIGNvbXBpbGVyXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICAvKiogQ2FsbHMgdG8gaW5kaXZpZHVhbCBzdHlsaW5nIGluc3RydWN0aW9ucy4gVXNlZCB3aGVuIGNoYWluaW5nIGNhbGxzIHRvIHRoZSBzYW1lIGluc3RydWN0aW9uLiAqL1xuICBjYWxsczogU3R5bGluZ0luc3RydWN0aW9uQ2FsbFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0eWxpbmdJbnN0cnVjdGlvbkNhbGwge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgc3VwcG9ydHNJbnRlcnBvbGF0aW9uPzogYm9vbGVhbjtcbiAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IG51bWJlcjtcbiAgcGFyYW1zOiAoKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdKSA9PiBvLkV4cHJlc3Npb25bXSk7XG59XG5cbi8qKlxuICogQW4gaW50ZXJuYWwgcmVjb3JkIG9mIHRoZSBpbnB1dCBkYXRhIGZvciBhIHN0eWxpbmcgYmluZGluZ1xuICovXG5pbnRlcmZhY2UgQm91bmRTdHlsaW5nRW50cnkge1xuICBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW47XG4gIG5hbWU6IHN0cmluZ3xudWxsO1xuICB1bml0OiBzdHJpbmd8bnVsbDtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2YWx1ZTogQVNUO1xufVxuXG4vKipcbiAqIFByb2R1Y2VzIGNyZWF0aW9uL3VwZGF0ZSBpbnN0cnVjdGlvbnMgZm9yIGFsbCBzdHlsaW5nIGJpbmRpbmdzIChjbGFzcyBhbmQgc3R5bGUpXG4gKlxuICogSXQgYWxzbyBwcm9kdWNlcyB0aGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24gdG8gcmVnaXN0ZXIgYWxsIGluaXRpYWwgc3R5bGluZyB2YWx1ZXNcbiAqICh3aGljaCBhcmUgYWxsIHRoZSBzdGF0aWMgY2xhc3M9XCIuLi5cIiBhbmQgc3R5bGU9XCIuLi5cIiBhdHRyaWJ1dGUgdmFsdWVzIHRoYXQgZXhpc3RcbiAqIG9uIGFuIGVsZW1lbnQgd2l0aGluIGEgdGVtcGxhdGUpLlxuICpcbiAqIFRoZSBidWlsZGVyIGNsYXNzIGJlbG93IGhhbmRsZXMgcHJvZHVjaW5nIGluc3RydWN0aW9ucyBmb3IgdGhlIGZvbGxvd2luZyBjYXNlczpcbiAqXG4gKiAtIFN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzIChzdHlsZT1cIi4uLlwiIGFuZCBjbGFzcz1cIi4uLlwiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIG1hcCBiaW5kaW5ncyAoW3N0eWxlXT1cIm1hcFwiIGFuZCBbY2xhc3NdPVwibWFwfHN0cmluZ1wiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIHByb3BlcnR5IGJpbmRpbmdzIChbc3R5bGUucHJvcF09XCJleHBcIiBhbmQgW2NsYXNzLm5hbWVdPVwiZXhwXCIpXG4gKlxuICogRHVlIHRvIHRoZSBjb21wbGV4IHJlbGF0aW9uc2hpcCBvZiBhbGwgb2YgdGhlc2UgY2FzZXMsIHRoZSBpbnN0cnVjdGlvbnMgZ2VuZXJhdGVkXG4gKiBmb3IgdGhlc2UgYXR0cmlidXRlcy9wcm9wZXJ0aWVzL2JpbmRpbmdzIG11c3QgYmUgZG9uZSBzbyBpbiB0aGUgY29ycmVjdCBvcmRlci4gVGhlXG4gKiBvcmRlciB3aGljaCB0aGVzZSBtdXN0IGJlIGdlbmVyYXRlZCBpcyBhcyBmb2xsb3dzOlxuICpcbiAqIGlmIChjcmVhdGVNb2RlKSB7XG4gKiAgIHN0eWxpbmcoLi4uKVxuICogfVxuICogaWYgKHVwZGF0ZU1vZGUpIHtcbiAqICAgc3R5bGVNYXAoLi4uKVxuICogICBjbGFzc01hcCguLi4pXG4gKiAgIHN0eWxlUHJvcCguLi4pXG4gKiAgIGNsYXNzUHJvcCguLi4pXG4gKiB9XG4gKlxuICogVGhlIGNyZWF0aW9uL3VwZGF0ZSBtZXRob2RzIHdpdGhpbiB0aGUgYnVpbGRlciBjbGFzcyBwcm9kdWNlIHRoZXNlIGluc3RydWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0eWxpbmdCdWlsZGVyIHtcbiAgLyoqIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3RhdGljIHN0eWxpbmcgdmFsdWVzIHByZXNlbnQgKi9cbiAgcHJpdmF0ZSBfaGFzSW5pdGlhbFZhbHVlcyA9IGZhbHNlO1xuICAvKipcbiAgICogIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3R5bGluZyBiaW5kaW5ncyBwcmVzZW50XG4gICAqICAoaS5lLiBgW3N0eWxlXWAsIGBbY2xhc3NdYCwgYFtzdHlsZS5wcm9wXWAgb3IgYFtjbGFzcy5uYW1lXWApXG4gICAqL1xuICBwdWJsaWMgaGFzQmluZGluZ3MgPSBmYWxzZTtcbiAgcHVibGljIGhhc0JpbmRpbmdzV2l0aFBpcGVzID0gZmFsc2U7XG5cbiAgLyoqIHRoZSBpbnB1dCBmb3IgW2NsYXNzXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9jbGFzc01hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIHRoZSBpbnB1dCBmb3IgW3N0eWxlXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9zdHlsZU1hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW3N0eWxlLnByb3BdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZVN0eWxlSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbY2xhc3MubmFtZV0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlQ2xhc3NJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2xhc3RTdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9maXJzdFN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG5cbiAgLy8gbWFwcyBhcmUgdXNlZCBpbnN0ZWFkIG9mIGhhc2ggbWFwcyBiZWNhdXNlIGEgTWFwIHdpbGxcbiAgLy8gcmV0YWluIHRoZSBvcmRlcmluZyBvZiB0aGUga2V5c1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIHN0eWxlIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtzdHlsZS53aWR0aF09XCJ3XCIgW3N0eWxlLmhlaWdodF09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYHdpZHRoPTBgIGFuZCBgaGVpZ2h0PTFgKVxuICAgKi9cbiAgcHJpdmF0ZSBfc3R5bGVzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIGNsYXNzIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtjbGFzcy5iaWddPVwiYlwiIFtjbGFzcy5oaWRkZW5dPVwiaFwiPmAgaW1wbGllc1xuICAgKiB0aGF0IGBiaWc9MGAgYW5kIGBoaWRkZW49MWApXG4gICAqL1xuICBwcml2YXRlIF9jbGFzc2VzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBwcml2YXRlIF9pbml0aWFsU3R5bGVWYWx1ZXM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgX2luaXRpYWxDbGFzc1ZhbHVlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBjZXJ0YWluIHN0eWxlIHByb3BlcnRpZXMgQUxXQVlTIG5lZWQgc2FuaXRpemF0aW9uXG4gIC8vIHRoaXMgaXMgY2hlY2tlZCBlYWNoIHRpbWUgbmV3IHN0eWxlcyBhcmUgZW5jb3VudGVyZWRcbiAgcHJpdmF0ZSBfdXNlRGVmYXVsdFNhbml0aXplciA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2VsZW1lbnRJbmRleEV4cHI6IG8uRXhwcmVzc2lvbiwgcHJpdmF0ZSBfZGlyZWN0aXZlRXhwcjogby5FeHByZXNzaW9ufG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGdpdmVuIGlucHV0IHRvIHRoZSBzdHlsaW5nIGJ1aWxkZXIgdG8gYmUgbGF0ZXIgdXNlZCB3aGVuIHByb2R1Y2luZyBBT1QgY29kZS5cbiAgICpcbiAgICogVGhlIGNvZGUgYmVsb3cgd2lsbCBvbmx5IGFjY2VwdCB0aGUgaW5wdXQgaWYgaXQgaXMgc29tZWhvdyB0aWVkIHRvIHN0eWxpbmcgKHdoZXRoZXIgaXQgYmVcbiAgICogc3R5bGUvY2xhc3MgYmluZGluZ3Mgb3Igc3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMpLlxuICAgKi9cbiAgcmVnaXN0ZXJCb3VuZElucHV0KGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKTogYm9vbGVhbiB7XG4gICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBhcmUgc2tpcHBlZCBpbiB0aGUgY29kZSBiZWxvdyxcbiAgICAvLyB0aGV5IHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkIGJpbmRpbmdzIHNpbmNlXG4gICAgLy8gdGhleSBhcmUgaW50ZW5kZWQgdG8gYmUgd3JpdHRlbiBkaXJlY3RseSB0byB0aGUgYXR0ciBhbmRcbiAgICAvLyB3aWxsIHRoZXJlZm9yZSBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAvLyBbY2xhc3MucHJvcF09XCJcIi4gW2NsYXNzXT1cIlwiIGFzc2lnbm1lbnRzXG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGxldCBuYW1lID0gaW5wdXQubmFtZTtcbiAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3BhbiwgaW5wdXQudW5pdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZyA/IHRydWUgOiBmYWxzZTtcbiAgfVxuXG4gIHJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGNvbnN0IHByZWZpeCA9IG5hbWUuc3Vic3RyaW5nKDAsIDYpO1xuICAgIGNvbnN0IGlzU3R5bGUgPSBuYW1lID09PSAnc3R5bGUnIHx8IHByZWZpeCA9PT0gJ3N0eWxlLicgfHwgcHJlZml4ID09PSAnc3R5bGUhJztcbiAgICBjb25zdCBpc0NsYXNzID0gIWlzU3R5bGUgJiZcbiAgICAgICAgKG5hbWUgPT09ICdjbGFzcycgfHwgbmFtZSA9PT0gJ2NsYXNzTmFtZScgfHwgcHJlZml4ID09PSAnY2xhc3MuJyB8fCBwcmVmaXggPT09ICdjbGFzcyEnKTtcbiAgICBpZiAoaXNTdHlsZSB8fCBpc0NsYXNzKSB7XG4gICAgICBjb25zdCBpc01hcEJhc2VkID0gbmFtZS5jaGFyQXQoNSkgIT09ICcuJzsgICAgICAgICAvLyBzdHlsZS5wcm9wIG9yIGNsYXNzLnByb3AgbWFrZXMgdGhpcyBhIG5vXG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKGlzTWFwQmFzZWQgPyA1IDogNik7ICAvLyB0aGUgZG90IGV4cGxhaW5zIHdoeSB0aGVyZSdzIGEgKzFcbiAgICAgIGlmIChpc1N0eWxlKSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmluZGluZztcbiAgfVxuXG4gIHJlZ2lzdGVyU3R5bGVJbnB1dChcbiAgICAgIG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdW5pdD86IHN0cmluZ3xudWxsKTogQm91bmRTdHlsaW5nRW50cnl8bnVsbCB7XG4gICAgaWYgKGlzRW1wdHlFeHByZXNzaW9uKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIG5hbWUgPSBub3JtYWxpemVQcm9wTmFtZShuYW1lKTtcbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZywgdW5pdDogYmluZGluZ1VuaXR9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTogQm91bmRTdHlsaW5nRW50cnkgPSB7XG4gICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgIHVuaXQ6IHVuaXQgfHwgYmluZGluZ1VuaXQsIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWdcbiAgICB9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID0gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKG5hbWUpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLl9maXJzdFN0eWxpbmdJbnB1dCA9IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0IHx8IGVudHJ5O1xuICAgIHRoaXMuX2NoZWNrRm9yUGlwZXModmFsdWUpO1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NJbnB1dChuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBCb3VuZFN0eWxpbmdFbnRyeXxudWxsIHtcbiAgICBpZiAoaXNFbXB0eUV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qge3Byb3BlcnR5LCBoYXNPdmVycmlkZUZsYWd9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTpcbiAgICAgICAgQm91bmRTdHlsaW5nRW50cnkgPSB7bmFtZTogcHJvcGVydHksIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWcsIHVuaXQ6IG51bGx9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnW2NsYXNzXSBhbmQgW2NsYXNzTmFtZV0gYmluZGluZ3MgY2Fubm90IGJlIHVzZWQgb24gdGhlIHNhbWUgZWxlbWVudCBzaW11bHRhbmVvdXNseScpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLl9maXJzdFN0eWxpbmdJbnB1dCA9IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0IHx8IGVudHJ5O1xuICAgIHRoaXMuX2NoZWNrRm9yUGlwZXModmFsdWUpO1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrRm9yUGlwZXModmFsdWU6IEFTVCkge1xuICAgIGlmICgodmFsdWUgaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlKSAmJiAodmFsdWUuYXN0IGluc3RhbmNlb2YgQmluZGluZ1BpcGUpKSB7XG4gICAgICB0aGlzLmhhc0JpbmRpbmdzV2l0aFBpcGVzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIHN0eWxlIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBzdHlsZSBzdHJpbmcgKGUuZy4gYHdpZHRoOjEwMHB4OyBoZWlnaHQ6MjAwcHg7YClcbiAgICovXG4gIHJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgY2xhc3Mgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIGNsYXNzTmFtZSBzdHJpbmcgKGUuZy4gYGRpc2FibGVkIGdvbGQgem9vbWApXG4gICAqL1xuICByZWdpc3RlckNsYXNzQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYWxsIHN0eWxpbmctcmVsYXRlZCBleHByZXNzaW9ucyB0byB0aGUgcHJvdmlkZWQgYXR0cnMgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSBhdHRycyBhbiBleGlzdGluZyBhcnJheSB3aGVyZSBlYWNoIG9mIHRoZSBzdHlsaW5nIGV4cHJlc3Npb25zXG4gICAqIHdpbGwgYmUgaW5zZXJ0ZWQgaW50by5cbiAgICovXG4gIHBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyczogby5FeHByZXNzaW9uW10pOiB2b2lkIHtcbiAgICAvLyBbQ0xBU1NfTUFSS0VSLCAnZm9vJywgJ2JhcicsICdiYXonIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlc1tpXSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFtTVFlMRV9NQVJLRVIsICd3aWR0aCcsICcyMDBweCcsICdoZWlnaHQnLCAnMTAwcHgnLCAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGF0dHJzLnB1c2goXG4gICAgICAgICAgICBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2ldKSwgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpICsgMV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRIb3N0QXR0cnNgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZ2VuZXJhdGlvbiBjb2RlIGJlbG93IGlzIHVzZWQgZm9yIHByb2R1Y2luZyB0aGUgQU9UIHN0YXRlbWVudCBjb2RlIHdoaWNoIGlzXG4gICAqIHJlc3BvbnNpYmxlIGZvciByZWdpc3RlcmluZyBpbml0aWFsIHN0eWxlcyAod2l0aGluIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncycgY3JlYXRpb24gYmxvY2spLFxuICAgKiBhcyB3ZWxsIGFzIGFueSBvZiB0aGUgcHJvdmlkZWQgYXR0cmlidXRlIHZhbHVlcywgdG8gdGhlIGRpcmVjdGl2ZSBob3N0IGVsZW1lbnQuXG4gICAqL1xuICBidWlsZEhvc3RBdHRyc0luc3RydWN0aW9uKFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGF0dHJzOiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByICYmIChhdHRycy5sZW5ndGggfHwgdGhpcy5faGFzSW5pdGlhbFZhbHVlcykpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudEhvc3RBdHRycyxcbiAgICAgICAgY2FsbHM6IFt7XG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCxcbiAgICAgICAgICBwYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAgIC8vIHBhcmFtcyA9PiBlbGVtZW50SG9zdEF0dHJzKGF0dHJzKVxuICAgICAgICAgICAgdGhpcy5wb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0cnMpO1xuICAgICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gIWF0dHJzLnNvbWUoYXR0ciA9PiBhdHRyIGluc3RhbmNlb2Ygby5XcmFwcGVkTm9kZUV4cHIpID9cbiAgICAgICAgICAgICAgICBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoY29uc3RhbnRQb29sLCBhdHRycykgOlxuICAgICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihhdHRycyk7XG4gICAgICAgICAgICByZXR1cm4gW2F0dHJBcnJheV07XG4gICAgICAgICAgfVxuICAgICAgICB9XVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGNsYXNzTWFwYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGRhdGEgd2lsbCBjb250YWluIGFsbCBleHByZXNzaW9ucyBmb3IgYGNsYXNzTWFwYCB0byBmdW5jdGlvblxuICAgKiB3aGljaCBpbmNsdWRlcyB0aGUgYFtjbGFzc11gIGV4cHJlc3Npb24gcGFyYW1zLlxuICAgKi9cbiAgYnVpbGRDbGFzc01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkTWFwQmFzZWRJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlciwgdHJ1ZSwgdGhpcy5fY2xhc3NNYXBJbnB1dCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBzdHlsZU1hcGAuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBkYXRhIHdpbGwgY29udGFpbiBhbGwgZXhwcmVzc2lvbnMgZm9yIGBzdHlsZU1hcGAgdG8gZnVuY3Rpb25cbiAgICogd2hpY2ggaW5jbHVkZXMgdGhlIGBbc3R5bGVdYCBleHByZXNzaW9uIHBhcmFtcy5cbiAgICovXG4gIGJ1aWxkU3R5bGVNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZE1hcEJhc2VkSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIsIGZhbHNlLCB0aGlzLl9zdHlsZU1hcElucHV0KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZE1hcEJhc2VkSW5zdHJ1Y3Rpb24oXG4gICAgICB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIsIGlzQ2xhc3NCYXNlZDogYm9vbGVhbixcbiAgICAgIHN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnkpOiBTdHlsaW5nSW5zdHJ1Y3Rpb24ge1xuICAgIC8vIGVhY2ggc3R5bGluZyBiaW5kaW5nIHZhbHVlIGlzIHN0b3JlZCBpbiB0aGUgTFZpZXdcbiAgICAvLyBtYXAtYmFzZWQgYmluZGluZ3MgYWxsb2NhdGUgdHdvIHNsb3RzOiBvbmUgZm9yIHRoZVxuICAgIC8vIHByZXZpb3VzIGJpbmRpbmcgdmFsdWUgYW5kIGFub3RoZXIgZm9yIHRoZSBwcmV2aW91c1xuICAgIC8vIGNsYXNzTmFtZSBvciBzdHlsZSBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAyO1xuXG4gICAgLy8gdGhlc2UgdmFsdWVzIG11c3QgYmUgb3V0c2lkZSBvZiB0aGUgdXBkYXRlIGJsb2NrIHNvIHRoYXQgdGhleSBjYW5cbiAgICAvLyBiZSBldmFsdWF0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAvLyBwaXBlcyBjYW4gYmUgcGlja2VkIHVwIGluIHRpbWUgYmVmb3JlIHRoZSB0ZW1wbGF0ZSBpcyBidWlsdFxuICAgIGNvbnN0IG1hcFZhbHVlID0gc3R5bGluZ0lucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICBsZXQgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICAgIGlmIChtYXBWYWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgaXNDbGFzc0Jhc2VkKSB7XG4gICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IG1hcFZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIHJlZmVyZW5jZSA9IGdldENsYXNzTWFwSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24obWFwVmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZlcmVuY2UgPSBpc0NsYXNzQmFzZWQgPyBSMy5jbGFzc01hcCA6IFIzLnN0eWxlTWFwO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICByZWZlcmVuY2UsXG4gICAgICBjYWxsczogW3tcbiAgICAgICAgc3VwcG9ydHNJbnRlcnBvbGF0aW9uOiBpc0NsYXNzQmFzZWQsXG4gICAgICAgIHNvdXJjZVNwYW46IHN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCxcbiAgICAgICAgcGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uIHwgby5FeHByZXNzaW9uW10pID0+IHtcbiAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gY29udmVydEZuKG1hcFZhbHVlKTtcbiAgICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShjb252ZXJ0UmVzdWx0KSA/IGNvbnZlcnRSZXN1bHQgOiBbY29udmVydFJlc3VsdF07XG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W10sIG1hcEluZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+LFxuICAgICAgYWxsb3dVbml0czogYm9vbGVhbiwgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyLFxuICAgICAgZ2V0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb25Gbj86ICh2YWx1ZTogSW50ZXJwb2xhdGlvbikgPT4gby5FeHRlcm5hbFJlZmVyZW5jZSk6XG4gICAgICBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gICAgaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgcHJldmlvdXNJbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9ufHVuZGVmaW5lZCA9XG4gICAgICAgICAgaW5zdHJ1Y3Rpb25zW2luc3RydWN0aW9ucy5sZW5ndGggLSAxXTtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgbGV0IHJlZmVyZW5jZUZvckNhbGwgPSByZWZlcmVuY2U7XG4gICAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDE7ICAvLyBlYWNoIHN0eWxpbmcgYmluZGluZyB2YWx1ZSBpcyBzdG9yZWQgaW4gdGhlIExWaWV3XG5cbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCArPSB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGdldEludGVycG9sYXRpb25FeHByZXNzaW9uRm4pIHtcbiAgICAgICAgICByZWZlcmVuY2VGb3JDYWxsID0gZ2V0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb25Gbih2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgY2FsbCA9IHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQsXG4gICAgICAgIHN1cHBvcnRzSW50ZXJwb2xhdGlvbjogISFnZXRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbkZuLFxuICAgICAgICBwYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgIC8vIHBhcmFtcyA9PiBzdHlsaW5nUHJvcChwcm9wTmFtZSwgdmFsdWUpXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC5uYW1lKSk7XG5cbiAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gY29udmVydEZuKHZhbHVlKTtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb252ZXJ0UmVzdWx0KSkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4uY29udmVydFJlc3VsdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRSZXN1bHQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChhbGxvd1VuaXRzICYmIGlucHV0LnVuaXQpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC51bml0KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gSWYgd2UgZW5kZWQgdXAgZ2VuZXJhdGluZyBhIGNhbGwgdG8gdGhlIHNhbWUgaW5zdHJ1Y3Rpb24gYXMgdGhlIHByZXZpb3VzIHN0eWxpbmcgcHJvcGVydHlcbiAgICAgIC8vIHdlIGNhbiBjaGFpbiB0aGUgY2FsbHMgdG9nZXRoZXIgc2FmZWx5IHRvIHNhdmUgc29tZSBieXRlcywgb3RoZXJ3aXNlIHdlIGhhdmUgdG8gZ2VuZXJhdGVcbiAgICAgIC8vIGEgc2VwYXJhdGUgaW5zdHJ1Y3Rpb24gY2FsbC4gVGhpcyBpcyBwcmltYXJpbHkgYSBjb25jZXJuIHdpdGggaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbnNcbiAgICAgIC8vIHdoZXJlIHdlIG1heSBzdGFydCBvZmYgd2l0aCBvbmUgYHJlZmVyZW5jZWAsIGJ1dCBlbmQgdXAgdXNpbmcgYW5vdGhlciBiYXNlZCBvbiB0aGVcbiAgICAgIC8vIG51bWJlciBvZiBpbnRlcnBvbGF0aW9ucy5cbiAgICAgIGlmIChwcmV2aW91c0luc3RydWN0aW9uICYmIHByZXZpb3VzSW5zdHJ1Y3Rpb24ucmVmZXJlbmNlID09PSByZWZlcmVuY2VGb3JDYWxsKSB7XG4gICAgICAgIHByZXZpb3VzSW5zdHJ1Y3Rpb24uY2FsbHMucHVzaChjYWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IHJlZmVyZW5jZUZvckNhbGwsIGNhbGxzOiBbY2FsbF19KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICBSMy5jbGFzc1Byb3AsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLnN0eWxlUHJvcCwgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMsIHRoaXMuX3N0eWxlc0luZGV4LCB0cnVlLCB2YWx1ZUNvbnZlcnRlcixcbiAgICAgICAgICBnZXRTdHlsZVByb3BJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2FuaXRpemVyRm4oKTogU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgICByZXR1cm4ge1xuICAgICAgcmVmZXJlbmNlOiBSMy5zdHlsZVNhbml0aXplcixcbiAgICAgIGNhbGxzOiBbe1xuICAgICAgICBzb3VyY2VTcGFuOiB0aGlzLl9maXJzdFN0eWxpbmdJbnB1dCA/IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0LnNvdXJjZVNwYW4gOiBudWxsLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCxcbiAgICAgICAgcGFyYW1zOiAoKSA9PiBbby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplcildXG4gICAgICB9XVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhbGwgaW5zdHJ1Y3Rpb25zIHdoaWNoIGNvbnRhaW4gdGhlIGV4cHJlc3Npb25zIHRoYXQgd2lsbCBiZSBwbGFjZWRcbiAgICogaW50byB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgdGVtcGxhdGUgZnVuY3Rpb24gb3IgYSBkaXJlY3RpdmUgaG9zdEJpbmRpbmdzIGZ1bmN0aW9uLlxuICAgKi9cbiAgYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpIHtcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IFN0eWxpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3MpIHtcbiAgICAgIGlmICh0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKHRoaXMuX2J1aWxkU2FuaXRpemVyRm4oKSk7XG4gICAgICB9XG4gICAgICBjb25zdCBzdHlsZU1hcEluc3RydWN0aW9uID0gdGhpcy5idWlsZFN0eWxlTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKHN0eWxlTWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goc3R5bGVNYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBjb25zdCBjbGFzc01hcEluc3RydWN0aW9uID0gdGhpcy5idWlsZENsYXNzTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKGNsYXNzTWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goY2xhc3NNYXBJbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCguLi50aGlzLl9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyKSk7XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gTm90ZSB0aGF0IGJyb3dzZXJzIHN1cHBvcnQgYm90aCB0aGUgZGFzaCBjYXNlIGFuZFxuICAvLyBjYW1lbCBjYXNlIHByb3BlcnR5IG5hbWVzIHdoZW4gc2V0dGluZyB0aHJvdWdoIEpTLlxuICByZXR1cm4gcHJvcCA9PT0gJ2JhY2tncm91bmQtaW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kSW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kJyB8fFxuICAgICAgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHwgcHJvcCA9PT0gJ2JvcmRlckltYWdlJyB8fCBwcm9wID09PSAnZmlsdGVyJyB8fFxuICAgICAgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUnIHx8IHByb3AgPT09ICdsaXN0U3R5bGUnIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlLWltYWdlJyB8fFxuICAgICAgcHJvcCA9PT0gJ2xpc3RTdHlsZUltYWdlJyB8fCBwcm9wID09PSAnY2xpcC1wYXRoJyB8fCBwcm9wID09PSAnY2xpcFBhdGgnO1xufVxuXG4vKipcbiAqIFNpbXBsZSBoZWxwZXIgZnVuY3Rpb24gdG8gZWl0aGVyIHByb3ZpZGUgdGhlIGNvbnN0YW50IGxpdGVyYWwgdGhhdCB3aWxsIGhvdXNlIHRoZSB2YWx1ZVxuICogaGVyZSBvciBhIG51bGwgdmFsdWUgaWYgdGhlIHByb3ZpZGVkIHZhbHVlcyBhcmUgZW1wdHkuXG4gKi9cbmZ1bmN0aW9uIGdldENvbnN0YW50TGl0ZXJhbEZyb21BcnJheShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiB2YWx1ZXMubGVuZ3RoID8gY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIodmFsdWVzKSwgdHJ1ZSkgOiBvLk5VTExfRVhQUjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvcGVydHkobmFtZTogc3RyaW5nKTpcbiAgICB7cHJvcGVydHk6IHN0cmluZywgdW5pdDogc3RyaW5nLCBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW59IHtcbiAgbGV0IGhhc092ZXJyaWRlRmxhZyA9IGZhbHNlO1xuICBjb25zdCBvdmVycmlkZUluZGV4ID0gbmFtZS5pbmRleE9mKElNUE9SVEFOVF9GTEFHKTtcbiAgaWYgKG92ZXJyaWRlSW5kZXggIT09IC0xKSB7XG4gICAgbmFtZSA9IG92ZXJyaWRlSW5kZXggPiAwID8gbmFtZS5zdWJzdHJpbmcoMCwgb3ZlcnJpZGVJbmRleCkgOiAnJztcbiAgICBoYXNPdmVycmlkZUZsYWcgPSB0cnVlO1xuICB9XG5cbiAgbGV0IHVuaXQgPSAnJztcbiAgbGV0IHByb3BlcnR5ID0gbmFtZTtcbiAgY29uc3QgdW5pdEluZGV4ID0gbmFtZS5sYXN0SW5kZXhPZignLicpO1xuICBpZiAodW5pdEluZGV4ID4gMCkge1xuICAgIHVuaXQgPSBuYW1lLnN1YnN0cih1bml0SW5kZXggKyAxKTtcbiAgICBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyaW5nKDAsIHVuaXRJbmRleCk7XG4gIH1cblxuICByZXR1cm4ge3Byb3BlcnR5LCB1bml0LCBoYXNPdmVycmlkZUZsYWd9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgY2xhc3MgbWFwLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0Q2xhc3NNYXBJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKTogby5FeHRlcm5hbFJlZmVyZW5jZSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXA7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgc3R5bGUgcHJvcC5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFN0eWxlUHJvcEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5zdHlsZVByb3A7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlVjtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQcm9wTmFtZShwcm9wOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaHlwaGVuYXRlKHByb3ApO1xufVxuIl19