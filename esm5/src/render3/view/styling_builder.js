import * as tslib_1 from "tslib";
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
                sourceSpan: sourceSpan,
                reference: R3.elementHostAttrs,
                allocateBindingSlots: 0,
                params: function () {
                    // params => elementHostAttrs(attrs)
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
        var totalBindingSlotsRequired = 1;
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
            sourceSpan: stylingInput.sourceSpan,
            reference: reference,
            allocateBindingSlots: totalBindingSlotsRequired,
            supportsInterpolation: isClassBased,
            params: function (convertFn) {
                var convertResult = convertFn(mapValue);
                return Array.isArray(convertResult) ? convertResult : [convertResult];
            }
        };
    };
    StylingBuilder.prototype._buildSingleInputs = function (reference, inputs, mapIndex, allowUnits, valueConverter, getInterpolationExpressionFn) {
        var totalBindingSlotsRequired = 0;
        return inputs.map(function (input) {
            var value = input.value.visit(valueConverter);
            // each styling binding value is stored in the LView
            var totalBindingSlotsRequired = 1;
            if (value instanceof Interpolation) {
                totalBindingSlotsRequired += value.expressions.length;
                if (getInterpolationExpressionFn) {
                    reference = getInterpolationExpressionFn(value);
                }
            }
            return {
                sourceSpan: input.sourceSpan,
                supportsInterpolation: !!getInterpolationExpressionFn,
                allocateBindingSlots: totalBindingSlotsRequired, reference: reference,
                params: function (convertFn) {
                    // params => stylingProp(propName, value)
                    var params = [];
                    params.push(o.literal(input.name));
                    var convertResult = convertFn(value);
                    if (Array.isArray(convertResult)) {
                        params.push.apply(params, tslib_1.__spread(convertResult));
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
        });
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
            sourceSpan: this._firstStylingInput ? this._firstStylingInput.sourceSpan : null,
            reference: R3.styleSanitizer,
            allocateBindingSlots: 0,
            params: function () { return [o.importExpr(R3.defaultStyleSanitizer)]; }
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
            instructions.push.apply(instructions, tslib_1.__spread(this._buildStyleInputs(valueConverter)));
            instructions.push.apply(instructions, tslib_1.__spread(this._buildClassInputs(valueConverter)));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQVNBLE9BQU8sRUFBTSxhQUFhLEVBQUUsV0FBVyxFQUFlLGFBQWEsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3hHLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sdUNBQXVDLENBQUM7QUFHeEUsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsU0FBUyxFQUFFLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUU5RCxPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFbEQsSUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDO0FBd0JwQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTRCRztBQUNIO0lBNENFLHdCQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUEzQzlGLGlFQUFpRTtRQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDbEM7OztXQUdHO1FBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFDcEIseUJBQW9CLEdBQUcsS0FBSyxDQUFDO1FBRXBDLDJDQUEyQztRQUNuQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7UUFDdEQsMkNBQTJDO1FBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUN0RCwwQ0FBMEM7UUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztRQUM1RCwwQ0FBMEM7UUFD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LENBQUMsSUFBWTtJQUNyQyxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFTVFdpdGhTb3VyY2UsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc0VtcHR5RXhwcmVzc2lvbn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtoeXBoZW5hdGUsIHBhcnNlIGFzIHBhcnNlU3R5bGV9IGZyb20gJy4vc3R5bGVfcGFyc2VyJztcbmltcG9ydCB7VmFsdWVDb252ZXJ0ZXJ9IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aH0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgSU1QT1JUQU5UX0ZMQUcgPSAnIWltcG9ydGFudCc7XG5cbi8qKlxuICogQSBzdHlsaW5nIGV4cHJlc3Npb24gc3VtbWFyeSB0aGF0IGlzIHRvIGJlIHByb2Nlc3NlZCBieSB0aGUgY29tcGlsZXJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsaW5nSW5zdHJ1Y3Rpb24ge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBhbGxvY2F0ZUJpbmRpbmdTbG90czogbnVtYmVyO1xuICBzdXBwb3J0c0ludGVycG9sYXRpb24/OiBib29sZWFuO1xuICBwYXJhbXM6ICgoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uIHwgby5FeHByZXNzaW9uW10pID0+IG8uRXhwcmVzc2lvbltdKTtcbn1cblxuLyoqXG4gKiBBbiBpbnRlcm5hbCByZWNvcmQgb2YgdGhlIGlucHV0IGRhdGEgZm9yIGEgc3R5bGluZyBiaW5kaW5nXG4gKi9cbmludGVyZmFjZSBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbjtcbiAgbmFtZTogc3RyaW5nfG51bGw7XG4gIHVuaXQ6IHN0cmluZ3xudWxsO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cbi8qKlxuICogUHJvZHVjZXMgY3JlYXRpb24vdXBkYXRlIGluc3RydWN0aW9ucyBmb3IgYWxsIHN0eWxpbmcgYmluZGluZ3MgKGNsYXNzIGFuZCBzdHlsZSlcbiAqXG4gKiBJdCBhbHNvIHByb2R1Y2VzIHRoZSBjcmVhdGlvbiBpbnN0cnVjdGlvbiB0byByZWdpc3RlciBhbGwgaW5pdGlhbCBzdHlsaW5nIHZhbHVlc1xuICogKHdoaWNoIGFyZSBhbGwgdGhlIHN0YXRpYyBjbGFzcz1cIi4uLlwiIGFuZCBzdHlsZT1cIi4uLlwiIGF0dHJpYnV0ZSB2YWx1ZXMgdGhhdCBleGlzdFxuICogb24gYW4gZWxlbWVudCB3aXRoaW4gYSB0ZW1wbGF0ZSkuXG4gKlxuICogVGhlIGJ1aWxkZXIgY2xhc3MgYmVsb3cgaGFuZGxlcyBwcm9kdWNpbmcgaW5zdHJ1Y3Rpb25zIGZvciB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICpcbiAqIC0gU3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMgKHN0eWxlPVwiLi4uXCIgYW5kIGNsYXNzPVwiLi4uXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgbWFwIGJpbmRpbmdzIChbc3R5bGVdPVwibWFwXCIgYW5kIFtjbGFzc109XCJtYXB8c3RyaW5nXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgcHJvcGVydHkgYmluZGluZ3MgKFtzdHlsZS5wcm9wXT1cImV4cFwiIGFuZCBbY2xhc3MubmFtZV09XCJleHBcIilcbiAqXG4gKiBEdWUgdG8gdGhlIGNvbXBsZXggcmVsYXRpb25zaGlwIG9mIGFsbCBvZiB0aGVzZSBjYXNlcywgdGhlIGluc3RydWN0aW9ucyBnZW5lcmF0ZWRcbiAqIGZvciB0aGVzZSBhdHRyaWJ1dGVzL3Byb3BlcnRpZXMvYmluZGluZ3MgbXVzdCBiZSBkb25lIHNvIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBUaGVcbiAqIG9yZGVyIHdoaWNoIHRoZXNlIG11c3QgYmUgZ2VuZXJhdGVkIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogaWYgKGNyZWF0ZU1vZGUpIHtcbiAqICAgc3R5bGluZyguLi4pXG4gKiB9XG4gKiBpZiAodXBkYXRlTW9kZSkge1xuICogICBzdHlsZU1hcCguLi4pXG4gKiAgIGNsYXNzTWFwKC4uLilcbiAqICAgc3R5bGVQcm9wKC4uLilcbiAqICAgY2xhc3NQcm9wKC4uLilcbiAqIH1cbiAqXG4gKiBUaGUgY3JlYXRpb24vdXBkYXRlIG1ldGhvZHMgd2l0aGluIHRoZSBidWlsZGVyIGNsYXNzIHByb2R1Y2UgdGhlc2UgaW5zdHJ1Y3Rpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU3R5bGluZ0J1aWxkZXIge1xuICAvKiogV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdGF0aWMgc3R5bGluZyB2YWx1ZXMgcHJlc2VudCAqL1xuICBwcml2YXRlIF9oYXNJbml0aWFsVmFsdWVzID0gZmFsc2U7XG4gIC8qKlxuICAgKiAgV2hldGhlciBvciBub3QgdGhlcmUgYXJlIGFueSBzdHlsaW5nIGJpbmRpbmdzIHByZXNlbnRcbiAgICogIChpLmUuIGBbc3R5bGVdYCwgYFtjbGFzc11gLCBgW3N0eWxlLnByb3BdYCBvciBgW2NsYXNzLm5hbWVdYClcbiAgICovXG4gIHB1YmxpYyBoYXNCaW5kaW5ncyA9IGZhbHNlO1xuICBwdWJsaWMgaGFzQmluZGluZ3NXaXRoUGlwZXMgPSBmYWxzZTtcblxuICAvKiogdGhlIGlucHV0IGZvciBbY2xhc3NdIChpZiBpdCBleGlzdHMpICovXG4gIHByaXZhdGUgX2NsYXNzTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAvKiogdGhlIGlucHV0IGZvciBbc3R5bGVdIChpZiBpdCBleGlzdHMpICovXG4gIHByaXZhdGUgX3N0eWxlTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbc3R5bGUucHJvcF0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlU3R5bGVJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIC8qKiBhbiBhcnJheSBvZiBlYWNoIFtjbGFzcy5uYW1lXSBpbnB1dCAqL1xuICBwcml2YXRlIF9zaW5nbGVDbGFzc0lucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfbGFzdFN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2ZpcnN0U3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcblxuICAvLyBtYXBzIGFyZSB1c2VkIGluc3RlYWQgb2YgaGFzaCBtYXBzIGJlY2F1c2UgYSBNYXAgd2lsbFxuICAvLyByZXRhaW4gdGhlIG9yZGVyaW5nIG9mIHRoZSBrZXlzXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggc3R5bGUgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW3N0eWxlLndpZHRoXT1cIndcIiBbc3R5bGUuaGVpZ2h0XT1cImhcIj5gIGltcGxpZXNcbiAgICogdGhhdCBgd2lkdGg9MGAgYW5kIGBoZWlnaHQ9MWApXG4gICAqL1xuICBwcml2YXRlIF9zdHlsZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGxvY2F0aW9uIG9mIGVhY2ggY2xhc3MgYmluZGluZyBpbiB0aGUgdGVtcGxhdGVcbiAgICogKGUuZy4gYDxkaXYgW2NsYXNzLmJpZ109XCJiXCIgW2NsYXNzLmhpZGRlbl09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYGJpZz0wYCBhbmQgYGhpZGRlbj0xYClcbiAgICovXG4gIHByaXZhdGUgX2NsYXNzZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxTdHlsZVZhbHVlczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBfaW5pdGlhbENsYXNzVmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGNlcnRhaW4gc3R5bGUgcHJvcGVydGllcyBBTFdBWVMgbmVlZCBzYW5pdGl6YXRpb25cbiAgLy8gdGhpcyBpcyBjaGVja2VkIGVhY2ggdGltZSBuZXcgc3R5bGVzIGFyZSBlbmNvdW50ZXJlZFxuICBwcml2YXRlIF91c2VEZWZhdWx0U2FuaXRpemVyID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZWxlbWVudEluZGV4RXhwcjogby5FeHByZXNzaW9uLCBwcml2YXRlIF9kaXJlY3RpdmVFeHByOiBvLkV4cHJlc3Npb258bnVsbCkge31cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgZ2l2ZW4gaW5wdXQgdG8gdGhlIHN0eWxpbmcgYnVpbGRlciB0byBiZSBsYXRlciB1c2VkIHdoZW4gcHJvZHVjaW5nIEFPVCBjb2RlLlxuICAgKlxuICAgKiBUaGUgY29kZSBiZWxvdyB3aWxsIG9ubHkgYWNjZXB0IHRoZSBpbnB1dCBpZiBpdCBpcyBzb21laG93IHRpZWQgdG8gc3R5bGluZyAod2hldGhlciBpdCBiZVxuICAgKiBzdHlsZS9jbGFzcyBiaW5kaW5ncyBvciBzdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcykuXG4gICAqL1xuICByZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIGFyZSBza2lwcGVkIGluIHRoZSBjb2RlIGJlbG93LFxuICAgIC8vIHRoZXkgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIHN0eWxpbmctYmFzZWQgYmluZGluZ3Mgc2luY2VcbiAgICAvLyB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyIGFuZFxuICAgIC8vIHdpbGwgdGhlcmVmb3JlIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgLy8gd2l0aCBzdHlsZT1cIlwiLCBbc3R5bGVdPVwiXCIgYW5kIFtzdHlsZS5wcm9wXT1cIlwiLCBjbGFzcz1cIlwiLFxuICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWUgPSBpbnB1dC5uYW1lO1xuICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnB1dC51bml0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQobmFtZSwgZmFsc2UsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG5cbiAgcmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgcHJlZml4ID0gbmFtZS5zdWJzdHJpbmcoMCwgNik7XG4gICAgY29uc3QgaXNTdHlsZSA9IG5hbWUgPT09ICdzdHlsZScgfHwgcHJlZml4ID09PSAnc3R5bGUuJyB8fCBwcmVmaXggPT09ICdzdHlsZSEnO1xuICAgIGNvbnN0IGlzQ2xhc3MgPSAhaXNTdHlsZSAmJlxuICAgICAgICAobmFtZSA9PT0gJ2NsYXNzJyB8fCBuYW1lID09PSAnY2xhc3NOYW1lJyB8fCBwcmVmaXggPT09ICdjbGFzcy4nIHx8IHByZWZpeCA9PT0gJ2NsYXNzIScpO1xuICAgIGlmIChpc1N0eWxlIHx8IGlzQ2xhc3MpIHtcbiAgICAgIGNvbnN0IGlzTWFwQmFzZWQgPSBuYW1lLmNoYXJBdCg1KSAhPT0gJy4nOyAgICAgICAgIC8vIHN0eWxlLnByb3Agb3IgY2xhc3MucHJvcCBtYWtlcyB0aGlzIGEgbm9cbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gbmFtZS5zdWJzdHIoaXNNYXBCYXNlZCA/IDUgOiA2KTsgIC8vIHRoZSBkb3QgZXhwbGFpbnMgd2h5IHRoZXJlJ3MgYSArMVxuICAgICAgaWYgKGlzU3R5bGUpIHtcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KHByb3BlcnR5LCBpc01hcEJhc2VkLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nO1xuICB9XG5cbiAgcmVnaXN0ZXJTdHlsZUlucHV0KFxuICAgICAgbmFtZTogc3RyaW5nLCBpc01hcEJhc2VkOiBib29sZWFuLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB1bml0Pzogc3RyaW5nfG51bGwpOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsIHtcbiAgICBpZiAoaXNFbXB0eUV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbmFtZSA9IG5vcm1hbGl6ZVByb3BOYW1lKG5hbWUpO1xuICAgIGNvbnN0IHtwcm9wZXJ0eSwgaGFzT3ZlcnJpZGVGbGFnLCB1bml0OiBiaW5kaW5nVW5pdH0gPSBwYXJzZVByb3BlcnR5KG5hbWUpO1xuICAgIGNvbnN0IGVudHJ5OiBCb3VuZFN0eWxpbmdFbnRyeSA9IHtcbiAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgdW5pdDogdW5pdCB8fCBiaW5kaW5nVW5pdCwgdmFsdWUsIHNvdXJjZVNwYW4sIGhhc092ZXJyaWRlRmxhZ1xuICAgIH07XG4gICAgaWYgKGlzTWFwQmFzZWQpIHtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0cnVlO1xuICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgPSB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUobmFtZSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fc3R5bGVzSW5kZXgsIHByb3BlcnR5KTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgIHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0ID0gdGhpcy5fZmlyc3RTdHlsaW5nSW5wdXQgfHwgZW50cnk7XG4gICAgdGhpcy5fY2hlY2tGb3JQaXBlcyh2YWx1ZSk7XG4gICAgdGhpcy5oYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgcmVnaXN0ZXJDbGFzc0lucHV0KG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTpcbiAgICAgIEJvdW5kU3R5bGluZ0VudHJ5fG51bGwge1xuICAgIGlmIChpc0VtcHR5RXhwcmVzc2lvbih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZ30gPSBwYXJzZVByb3BlcnR5KG5hbWUpO1xuICAgIGNvbnN0IGVudHJ5OlxuICAgICAgICBCb3VuZFN0eWxpbmdFbnRyeSA9IHtuYW1lOiBwcm9wZXJ0eSwgdmFsdWUsIHNvdXJjZVNwYW4sIGhhc092ZXJyaWRlRmxhZywgdW5pdDogbnVsbH07XG4gICAgaWYgKGlzTWFwQmFzZWQpIHtcbiAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzID0gdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX2NsYXNzZXNJbmRleCwgcHJvcGVydHkpO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgdGhpcy5fZmlyc3RTdHlsaW5nSW5wdXQgPSB0aGlzLl9maXJzdFN0eWxpbmdJbnB1dCB8fCBlbnRyeTtcbiAgICB0aGlzLl9jaGVja0ZvclBpcGVzKHZhbHVlKTtcbiAgICB0aGlzLmhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICBwcml2YXRlIF9jaGVja0ZvclBpcGVzKHZhbHVlOiBBU1QpIHtcbiAgICBpZiAoKHZhbHVlIGluc3RhbmNlb2YgQVNUV2l0aFNvdXJjZSkgJiYgKHZhbHVlLmFzdCBpbnN0YW5jZW9mIEJpbmRpbmdQaXBlKSkge1xuICAgICAgdGhpcy5oYXNCaW5kaW5nc1dpdGhQaXBlcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgZWxlbWVudCdzIHN0YXRpYyBzdHlsZSBzdHJpbmcgdmFsdWUgdG8gdGhlIGJ1aWxkZXIuXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgc3R5bGUgc3RyaW5nIChlLmcuIGB3aWR0aDoxMDBweDsgaGVpZ2h0OjIwMHB4O2ApXG4gICAqL1xuICByZWdpc3RlclN0eWxlQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzID0gcGFyc2VTdHlsZSh2YWx1ZSk7XG4gICAgdGhpcy5faGFzSW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIGNsYXNzIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBjbGFzc05hbWUgc3RyaW5nIChlLmcuIGBkaXNhYmxlZCBnb2xkIHpvb21gKVxuICAgKi9cbiAgcmVnaXN0ZXJDbGFzc0F0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFsbCBzdHlsaW5nLXJlbGF0ZWQgZXhwcmVzc2lvbnMgdG8gdGhlIHByb3ZpZGVkIGF0dHJzIGFycmF5LlxuICAgKlxuICAgKiBAcGFyYW0gYXR0cnMgYW4gZXhpc3RpbmcgYXJyYXkgd2hlcmUgZWFjaCBvZiB0aGUgc3R5bGluZyBleHByZXNzaW9uc1xuICAgKiB3aWxsIGJlIGluc2VydGVkIGludG8uXG4gICAqL1xuICBwb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogdm9pZCB7XG4gICAgLy8gW0NMQVNTX01BUktFUiwgJ2ZvbycsICdiYXInLCAnYmF6JyAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXNbaV0pKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBbU1RZTEVfTUFSS0VSLCAnd2lkdGgnLCAnMjAwcHgnLCAnaGVpZ2h0JywgJzEwMHB4JywgLi4uXVxuICAgIGlmICh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMubGVuZ3RoKSB7XG4gICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbChBdHRyaWJ1dGVNYXJrZXIuU3R5bGVzKSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBhdHRycy5wdXNoKFxuICAgICAgICAgICAgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpXSksIG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXNbaSArIDFdKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBlbGVtZW50SG9zdEF0dHJzYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgaW5pdGlhbCBzdHlsZXMgKHdpdGhpbiBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MnIGNyZWF0aW9uIGJsb2NrKSxcbiAgICogYXMgd2VsbCBhcyBhbnkgb2YgdGhlIHByb3ZpZGVkIGF0dHJpYnV0ZSB2YWx1ZXMsIHRvIHRoZSBkaXJlY3RpdmUgaG9zdCBlbGVtZW50LlxuICAgKi9cbiAgYnVpbGRIb3N0QXR0cnNJbnN0cnVjdGlvbihcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBhdHRyczogby5FeHByZXNzaW9uW10sXG4gICAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwciAmJiAoYXR0cnMubGVuZ3RoIHx8IHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRIb3N0QXR0cnMsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgICBwYXJhbXM6ICgpID0+IHtcbiAgICAgICAgICAvLyBwYXJhbXMgPT4gZWxlbWVudEhvc3RBdHRycyhhdHRycylcbiAgICAgICAgICB0aGlzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRycyk7XG4gICAgICAgICAgY29uc3QgYXR0ckFycmF5ID0gIWF0dHJzLnNvbWUoYXR0ciA9PiBhdHRyIGluc3RhbmNlb2Ygby5XcmFwcGVkTm9kZUV4cHIpID9cbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgYXR0cnMpIDpcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKGF0dHJzKTtcbiAgICAgICAgICByZXR1cm4gW2F0dHJBcnJheV07XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyBhbiBpbnN0cnVjdGlvbiB3aXRoIGFsbCB0aGUgZXhwcmVzc2lvbnMgYW5kIHBhcmFtZXRlcnMgZm9yIGBjbGFzc01hcGAuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBkYXRhIHdpbGwgY29udGFpbiBhbGwgZXhwcmVzc2lvbnMgZm9yIGBjbGFzc01hcGAgdG8gZnVuY3Rpb25cbiAgICogd2hpY2ggaW5jbHVkZXMgdGhlIGBbY2xhc3NdYCBleHByZXNzaW9uIHBhcmFtcy5cbiAgICovXG4gIGJ1aWxkQ2xhc3NNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2NsYXNzTWFwSW5wdXQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZE1hcEJhc2VkSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIsIHRydWUsIHRoaXMuX2NsYXNzTWFwSW5wdXQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgc3R5bGVNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgc3R5bGVNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGVzIHRoZSBgW3N0eWxlXWAgZXhwcmVzc2lvbiBwYXJhbXMuXG4gICAqL1xuICBidWlsZFN0eWxlTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyLCBmYWxzZSwgdGhpcy5fc3R5bGVNYXBJbnB1dCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKFxuICAgICAgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyLCBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sXG4gICAgICBzdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5KTogU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgICAvLyBlYWNoIHN0eWxpbmcgYmluZGluZyB2YWx1ZSBpcyBzdG9yZWQgaW4gdGhlIExWaWV3XG4gICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAxO1xuXG4gICAgLy8gdGhlc2UgdmFsdWVzIG11c3QgYmUgb3V0c2lkZSBvZiB0aGUgdXBkYXRlIGJsb2NrIHNvIHRoYXQgdGhleSBjYW5cbiAgICAvLyBiZSBldmFsdWF0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAvLyBwaXBlcyBjYW4gYmUgcGlja2VkIHVwIGluIHRpbWUgYmVmb3JlIHRoZSB0ZW1wbGF0ZSBpcyBidWlsdFxuICAgIGNvbnN0IG1hcFZhbHVlID0gc3R5bGluZ0lucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICBsZXQgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICAgIGlmIChtYXBWYWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgaXNDbGFzc0Jhc2VkKSB7XG4gICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IG1hcFZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIHJlZmVyZW5jZSA9IGdldENsYXNzTWFwSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24obWFwVmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZlcmVuY2UgPSBpc0NsYXNzQmFzZWQgPyBSMy5jbGFzc01hcCA6IFIzLnN0eWxlTWFwO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiBzdHlsaW5nSW5wdXQuc291cmNlU3BhbixcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgc3VwcG9ydHNJbnRlcnBvbGF0aW9uOiBpc0NsYXNzQmFzZWQsXG4gICAgICBwYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gY29udmVydEZuKG1hcFZhbHVlKTtcbiAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoY29udmVydFJlc3VsdCkgPyBjb252ZXJ0UmVzdWx0IDogW2NvbnZlcnRSZXN1bHRdO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgaW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdLCBtYXBJbmRleDogTWFwPHN0cmluZywgbnVtYmVyPixcbiAgICAgIGFsbG93VW5pdHM6IGJvb2xlYW4sIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcixcbiAgICAgIGdldEludGVycG9sYXRpb25FeHByZXNzaW9uRm4/OiAodmFsdWU6IEludGVycG9sYXRpb24pID0+IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOlxuICAgICAgU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMDtcbiAgICByZXR1cm4gaW5wdXRzLm1hcChpbnB1dCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcblxuICAgICAgLy8gZWFjaCBzdHlsaW5nIGJpbmRpbmcgdmFsdWUgaXMgc3RvcmVkIGluIHRoZSBMVmlld1xuICAgICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAxO1xuXG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoO1xuXG4gICAgICAgIGlmIChnZXRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbkZuKSB7XG4gICAgICAgICAgcmVmZXJlbmNlID0gZ2V0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb25Gbih2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgc3VwcG9ydHNJbnRlcnBvbGF0aW9uOiAhIWdldEludGVycG9sYXRpb25FeHByZXNzaW9uRm4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLCByZWZlcmVuY2UsXG4gICAgICAgIHBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgLy8gcGFyYW1zID0+IHN0eWxpbmdQcm9wKHByb3BOYW1lLCB2YWx1ZSlcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlucHV0Lm5hbWUpKTtcblxuICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBjb252ZXJ0Rm4odmFsdWUpO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvbnZlcnRSZXN1bHQpKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaCguLi5jb252ZXJ0UmVzdWx0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goY29udmVydFJlc3VsdCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGFsbG93VW5pdHMgJiYgaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlucHV0LnVuaXQpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgUjMuY2xhc3NQcm9wLCB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cywgdGhpcy5fY2xhc3Nlc0luZGV4LCBmYWxzZSwgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICBSMy5zdHlsZVByb3AsIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzLCB0aGlzLl9zdHlsZXNJbmRleCwgdHJ1ZSwgdmFsdWVDb252ZXJ0ZXIsXG4gICAgICAgICAgZ2V0U3R5bGVQcm9wSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24pO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNhbml0aXplckZuKCk6IFN0eWxpbmdJbnN0cnVjdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0ID8gdGhpcy5fZmlyc3RTdHlsaW5nSW5wdXQuc291cmNlU3BhbiA6IG51bGwsXG4gICAgICByZWZlcmVuY2U6IFIzLnN0eWxlU2FuaXRpemVyLFxuICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IDAsXG4gICAgICBwYXJhbXM6ICgpID0+IFtvLmltcG9ydEV4cHIoUjMuZGVmYXVsdFN0eWxlU2FuaXRpemVyKV1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYWxsIGluc3RydWN0aW9ucyB3aGljaCBjb250YWluIHRoZSBleHByZXNzaW9ucyB0aGF0IHdpbGwgYmUgcGxhY2VkXG4gICAqIGludG8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIHRlbXBsYXRlIGZ1bmN0aW9uIG9yIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncyBmdW5jdGlvbi5cbiAgICovXG4gIGJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzKSB7XG4gICAgICBpZiAodGhpcy5fdXNlRGVmYXVsdFNhbml0aXplcikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZFNhbml0aXplckZuKCkpO1xuICAgICAgfVxuICAgICAgY29uc3Qgc3R5bGVNYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRTdHlsZU1hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmIChzdHlsZU1hcEluc3RydWN0aW9uKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKHN0eWxlTWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgY29uc3QgY2xhc3NNYXBJbnN0cnVjdGlvbiA9IHRoaXMuYnVpbGRDbGFzc01hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmIChjbGFzc01hcEluc3RydWN0aW9uKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKGNsYXNzTWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgIH1cbiAgICByZXR1cm4gaW5zdHJ1Y3Rpb25zO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVySW50b01hcChtYXA6IE1hcDxzdHJpbmcsIG51bWJlcj4sIGtleTogc3RyaW5nKSB7XG4gIGlmICghbWFwLmhhcyhrZXkpKSB7XG4gICAgbWFwLnNldChrZXksIG1hcC5zaXplKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1N0eWxlU2FuaXRpemFibGUocHJvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIC8vIE5vdGUgdGhhdCBicm93c2VycyBzdXBwb3J0IGJvdGggdGhlIGRhc2ggY2FzZSBhbmRcbiAgLy8gY2FtZWwgY2FzZSBwcm9wZXJ0eSBuYW1lcyB3aGVuIHNldHRpbmcgdGhyb3VnaCBKUy5cbiAgcmV0dXJuIHByb3AgPT09ICdiYWNrZ3JvdW5kLWltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZEltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZCcgfHxcbiAgICAgIHByb3AgPT09ICdib3JkZXItaW1hZ2UnIHx8IHByb3AgPT09ICdib3JkZXJJbWFnZScgfHwgcHJvcCA9PT0gJ2ZpbHRlcicgfHxcbiAgICAgIHByb3AgPT09ICdsaXN0LXN0eWxlJyB8fCBwcm9wID09PSAnbGlzdFN0eWxlJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZS1pbWFnZScgfHxcbiAgICAgIHByb3AgPT09ICdsaXN0U3R5bGVJbWFnZScgfHwgcHJvcCA9PT0gJ2NsaXAtcGF0aCcgfHwgcHJvcCA9PT0gJ2NsaXBQYXRoJztcbn1cblxuLyoqXG4gKiBTaW1wbGUgaGVscGVyIGZ1bmN0aW9uIHRvIGVpdGhlciBwcm92aWRlIHRoZSBjb25zdGFudCBsaXRlcmFsIHRoYXQgd2lsbCBob3VzZSB0aGUgdmFsdWVcbiAqIGhlcmUgb3IgYSBudWxsIHZhbHVlIGlmIHRoZSBwcm92aWRlZCB2YWx1ZXMgYXJlIGVtcHR5LlxuICovXG5mdW5jdGlvbiBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHZhbHVlczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gdmFsdWVzLmxlbmd0aCA/IGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHZhbHVlcyksIHRydWUpIDogby5OVUxMX0VYUFI7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0aGF0IGFkZHMgYSBwYXJhbWV0ZXIgb3IgZG9lcyBub3RoaW5nIGF0IGFsbCBkZXBlbmRpbmcgb24gdGhlIHByb3ZpZGVkXG4gKiBwcmVkaWNhdGUgYW5kIHRvdGFsRXhwZWN0ZWRBcmdzIHZhbHVlc1xuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdLCBwcmVkaWNhdGU6IGFueSwgdmFsdWU6IG8uRXhwcmVzc2lvbiB8IG51bGwsIGFyZ051bWJlcjogbnVtYmVyLFxuICAgIHRvdGFsRXhwZWN0ZWRBcmdzOiBudW1iZXIpIHtcbiAgaWYgKHByZWRpY2F0ZSAmJiB2YWx1ZSkge1xuICAgIHBhcmFtcy5wdXNoKHZhbHVlKTtcbiAgfSBlbHNlIGlmIChhcmdOdW1iZXIgPCB0b3RhbEV4cGVjdGVkQXJncykge1xuICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOlxuICAgIHtwcm9wZXJ0eTogc3RyaW5nLCB1bml0OiBzdHJpbmcsIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbn0ge1xuICBsZXQgaGFzT3ZlcnJpZGVGbGFnID0gZmFsc2U7XG4gIGNvbnN0IG92ZXJyaWRlSW5kZXggPSBuYW1lLmluZGV4T2YoSU1QT1JUQU5UX0ZMQUcpO1xuICBpZiAob3ZlcnJpZGVJbmRleCAhPT0gLTEpIHtcbiAgICBuYW1lID0gb3ZlcnJpZGVJbmRleCA+IDAgPyBuYW1lLnN1YnN0cmluZygwLCBvdmVycmlkZUluZGV4KSA6ICcnO1xuICAgIGhhc092ZXJyaWRlRmxhZyA9IHRydWU7XG4gIH1cblxuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHkgPSBuYW1lO1xuICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gIGlmICh1bml0SW5kZXggPiAwKSB7XG4gICAgdW5pdCA9IG5hbWUuc3Vic3RyKHVuaXRJbmRleCArIDEpO1xuICAgIHByb3BlcnR5ID0gbmFtZS5zdWJzdHJpbmcoMCwgdW5pdEluZGV4KTtcbiAgfVxuXG4gIHJldHVybiB7cHJvcGVydHksIHVuaXQsIGhhc092ZXJyaWRlRmxhZ307XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBjbGFzcyBtYXAuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRDbGFzc01hcEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcDtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBzdHlsZSBwcm9wLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0U3R5bGVQcm9wSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcDtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVByb3BOYW1lKHByb3A6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBoeXBoZW5hdGUocHJvcCk7XG59XG4iXX0=