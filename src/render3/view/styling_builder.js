(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/styling_builder", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/template_parser/template_parser", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/style_parser", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var o = require("@angular/compiler/src/output/output_ast");
    var template_parser_1 = require("@angular/compiler/src/template_parser/template_parser");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var style_parser_1 = require("@angular/compiler/src/render3/view/style_parser");
    var util_1 = require("@angular/compiler/src/render3/view/util");
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
            if (template_parser_1.isEmptyExpression(value)) {
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
            if (template_parser_1.isEmptyExpression(value)) {
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
            if ((value instanceof ast_1.ASTWithSource) && (value.ast instanceof ast_1.BindingPipe)) {
                this.hasBindingsWithPipes = true;
            }
        };
        /**
         * Registers the element's static style string value to the builder.
         *
         * @param value the style string (e.g. `width:100px; height:200px;`)
         */
        StylingBuilder.prototype.registerStyleAttr = function (value) {
            this._initialStyleValues = style_parser_1.parse(value);
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
        StylingBuilder.prototype.assignHostAttrs = function (attrs, definitionMap) {
            if (this._directiveExpr && (attrs.length || this._hasInitialValues)) {
                this.populateInitialStylingAttrs(attrs);
                definitionMap.set('hostAttrs', o.literalArr(attrs));
            }
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
            if (mapValue instanceof ast_1.Interpolation && isClassBased) {
                totalBindingSlotsRequired += mapValue.expressions.length;
                reference = getClassMapInterpolationExpression(mapValue);
            }
            else {
                reference = isClassBased ? r3_identifiers_1.Identifiers.classMap : r3_identifiers_1.Identifiers.styleMap;
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
                if (value instanceof ast_1.Interpolation) {
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
                return this._buildSingleInputs(r3_identifiers_1.Identifiers.classProp, this._singleClassInputs, this._classesIndex, false, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
            if (this._singleStyleInputs) {
                return this._buildSingleInputs(r3_identifiers_1.Identifiers.styleProp, this._singleStyleInputs, this._stylesIndex, true, valueConverter, getStylePropInterpolationExpression);
            }
            return [];
        };
        StylingBuilder.prototype._buildSanitizerFn = function () {
            return {
                reference: r3_identifiers_1.Identifiers.styleSanitizer,
                calls: [{
                        sourceSpan: this._firstStylingInput ? this._firstStylingInput.sourceSpan : null,
                        allocateBindingSlots: 0,
                        params: function () { return [o.importExpr(r3_identifiers_1.Identifiers.defaultStyleSanitizer)]; }
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
                instructions.push.apply(instructions, tslib_1.__spread(this._buildStyleInputs(valueConverter)));
                instructions.push.apply(instructions, tslib_1.__spread(this._buildClassInputs(valueConverter)));
            }
            return instructions;
        };
        return StylingBuilder;
    }());
    exports.StylingBuilder = StylingBuilder;
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
    function parseProperty(name) {
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
    exports.parseProperty = parseProperty;
    /**
     * Gets the instruction to generate for an interpolated class map.
     * @param interpolation An Interpolation AST
     */
    function getClassMapInterpolationExpression(interpolation) {
        switch (util_1.getInterpolationArgsLength(interpolation)) {
            case 1:
                return r3_identifiers_1.Identifiers.classMap;
            case 3:
                return r3_identifiers_1.Identifiers.classMapInterpolate1;
            case 5:
                return r3_identifiers_1.Identifiers.classMapInterpolate2;
            case 7:
                return r3_identifiers_1.Identifiers.classMapInterpolate3;
            case 9:
                return r3_identifiers_1.Identifiers.classMapInterpolate4;
            case 11:
                return r3_identifiers_1.Identifiers.classMapInterpolate5;
            case 13:
                return r3_identifiers_1.Identifiers.classMapInterpolate6;
            case 15:
                return r3_identifiers_1.Identifiers.classMapInterpolate7;
            case 17:
                return r3_identifiers_1.Identifiers.classMapInterpolate8;
            default:
                return r3_identifiers_1.Identifiers.classMapInterpolateV;
        }
    }
    /**
     * Gets the instruction to generate for an interpolated style prop.
     * @param interpolation An Interpolation AST
     */
    function getStylePropInterpolationExpression(interpolation) {
        switch (util_1.getInterpolationArgsLength(interpolation)) {
            case 1:
                return r3_identifiers_1.Identifiers.styleProp;
            case 3:
                return r3_identifiers_1.Identifiers.stylePropInterpolate1;
            case 5:
                return r3_identifiers_1.Identifiers.stylePropInterpolate2;
            case 7:
                return r3_identifiers_1.Identifiers.stylePropInterpolate3;
            case 9:
                return r3_identifiers_1.Identifiers.stylePropInterpolate4;
            case 11:
                return r3_identifiers_1.Identifiers.stylePropInterpolate5;
            case 13:
                return r3_identifiers_1.Identifiers.stylePropInterpolate6;
            case 15:
                return r3_identifiers_1.Identifiers.stylePropInterpolate7;
            case 17:
                return r3_identifiers_1.Identifiers.stylePropInterpolate8;
            default:
                return r3_identifiers_1.Identifiers.stylePropInterpolateV;
        }
    }
    function normalizePropName(prop) {
        return style_parser_1.hyphenate(prop);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBU0EsbUVBQXdHO0lBQ3hHLDJEQUE2QztJQUU3Qyx5RkFBd0U7SUFFeEUsK0VBQW9EO0lBRXBELGdGQUE4RDtJQUU5RCxnRUFBaUU7SUFFakUsSUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDO0lBNkJwQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQTRCRztJQUNIO1FBNENFLHdCQUFvQixpQkFBK0IsRUFBVSxjQUFpQztZQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7WUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7WUEzQzlGLGlFQUFpRTtZQUN6RCxzQkFBaUIsR0FBRyxLQUFLLENBQUM7WUFDbEM7OztlQUdHO1lBQ0ksZ0JBQVcsR0FBRyxLQUFLLENBQUM7WUFDcEIseUJBQW9CLEdBQUcsS0FBSyxDQUFDO1lBRXBDLDJDQUEyQztZQUNuQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7WUFDdEQsMkNBQTJDO1lBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztZQUN0RCwwQ0FBMEM7WUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztZQUM1RCwwQ0FBMEM7WUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztZQUNwRCxzQkFBaUIsR0FBMkIsSUFBSSxDQUFDO1lBQ2pELHVCQUFrQixHQUEyQixJQUFJLENBQUM7WUFFMUQsd0RBQXdEO1lBQ3hELGtDQUFrQztZQUVsQzs7OztlQUlHO1lBQ0ssaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztZQUVqRDs7OztlQUlHO1lBQ0ssa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztZQUMxQyx3QkFBbUIs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Q29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFTVFdpdGhTb3VyY2UsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc0VtcHR5RXhwcmVzc2lvbn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3BhcnNlcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7aHlwaGVuYXRlLCBwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcCwgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGh9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IElNUE9SVEFOVF9GTEFHID0gJyFpbXBvcnRhbnQnO1xuXG4vKipcbiAqIEEgc3R5bGluZyBleHByZXNzaW9uIHN1bW1hcnkgdGhhdCBpcyB0byBiZSBwcm9jZXNzZWQgYnkgdGhlIGNvbXBpbGVyXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICAvKiogQ2FsbHMgdG8gaW5kaXZpZHVhbCBzdHlsaW5nIGluc3RydWN0aW9ucy4gVXNlZCB3aGVuIGNoYWluaW5nIGNhbGxzIHRvIHRoZSBzYW1lIGluc3RydWN0aW9uLiAqL1xuICBjYWxsczogU3R5bGluZ0luc3RydWN0aW9uQ2FsbFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0eWxpbmdJbnN0cnVjdGlvbkNhbGwge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgc3VwcG9ydHNJbnRlcnBvbGF0aW9uPzogYm9vbGVhbjtcbiAgYWxsb2NhdGVCaW5kaW5nU2xvdHM6IG51bWJlcjtcbiAgcGFyYW1zOiAoKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdKSA9PiBvLkV4cHJlc3Npb25bXSk7XG59XG5cbi8qKlxuICogQW4gaW50ZXJuYWwgcmVjb3JkIG9mIHRoZSBpbnB1dCBkYXRhIGZvciBhIHN0eWxpbmcgYmluZGluZ1xuICovXG5pbnRlcmZhY2UgQm91bmRTdHlsaW5nRW50cnkge1xuICBoYXNPdmVycmlkZUZsYWc6IGJvb2xlYW47XG4gIG5hbWU6IHN0cmluZ3xudWxsO1xuICB1bml0OiBzdHJpbmd8bnVsbDtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2YWx1ZTogQVNUO1xufVxuXG4vKipcbiAqIFByb2R1Y2VzIGNyZWF0aW9uL3VwZGF0ZSBpbnN0cnVjdGlvbnMgZm9yIGFsbCBzdHlsaW5nIGJpbmRpbmdzIChjbGFzcyBhbmQgc3R5bGUpXG4gKlxuICogSXQgYWxzbyBwcm9kdWNlcyB0aGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24gdG8gcmVnaXN0ZXIgYWxsIGluaXRpYWwgc3R5bGluZyB2YWx1ZXNcbiAqICh3aGljaCBhcmUgYWxsIHRoZSBzdGF0aWMgY2xhc3M9XCIuLi5cIiBhbmQgc3R5bGU9XCIuLi5cIiBhdHRyaWJ1dGUgdmFsdWVzIHRoYXQgZXhpc3RcbiAqIG9uIGFuIGVsZW1lbnQgd2l0aGluIGEgdGVtcGxhdGUpLlxuICpcbiAqIFRoZSBidWlsZGVyIGNsYXNzIGJlbG93IGhhbmRsZXMgcHJvZHVjaW5nIGluc3RydWN0aW9ucyBmb3IgdGhlIGZvbGxvd2luZyBjYXNlczpcbiAqXG4gKiAtIFN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzIChzdHlsZT1cIi4uLlwiIGFuZCBjbGFzcz1cIi4uLlwiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIG1hcCBiaW5kaW5ncyAoW3N0eWxlXT1cIm1hcFwiIGFuZCBbY2xhc3NdPVwibWFwfHN0cmluZ1wiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIHByb3BlcnR5IGJpbmRpbmdzIChbc3R5bGUucHJvcF09XCJleHBcIiBhbmQgW2NsYXNzLm5hbWVdPVwiZXhwXCIpXG4gKlxuICogRHVlIHRvIHRoZSBjb21wbGV4IHJlbGF0aW9uc2hpcCBvZiBhbGwgb2YgdGhlc2UgY2FzZXMsIHRoZSBpbnN0cnVjdGlvbnMgZ2VuZXJhdGVkXG4gKiBmb3IgdGhlc2UgYXR0cmlidXRlcy9wcm9wZXJ0aWVzL2JpbmRpbmdzIG11c3QgYmUgZG9uZSBzbyBpbiB0aGUgY29ycmVjdCBvcmRlci4gVGhlXG4gKiBvcmRlciB3aGljaCB0aGVzZSBtdXN0IGJlIGdlbmVyYXRlZCBpcyBhcyBmb2xsb3dzOlxuICpcbiAqIGlmIChjcmVhdGVNb2RlKSB7XG4gKiAgIHN0eWxpbmcoLi4uKVxuICogfVxuICogaWYgKHVwZGF0ZU1vZGUpIHtcbiAqICAgc3R5bGVNYXAoLi4uKVxuICogICBjbGFzc01hcCguLi4pXG4gKiAgIHN0eWxlUHJvcCguLi4pXG4gKiAgIGNsYXNzUHJvcCguLi4pXG4gKiB9XG4gKlxuICogVGhlIGNyZWF0aW9uL3VwZGF0ZSBtZXRob2RzIHdpdGhpbiB0aGUgYnVpbGRlciBjbGFzcyBwcm9kdWNlIHRoZXNlIGluc3RydWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0eWxpbmdCdWlsZGVyIHtcbiAgLyoqIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3RhdGljIHN0eWxpbmcgdmFsdWVzIHByZXNlbnQgKi9cbiAgcHJpdmF0ZSBfaGFzSW5pdGlhbFZhbHVlcyA9IGZhbHNlO1xuICAvKipcbiAgICogIFdoZXRoZXIgb3Igbm90IHRoZXJlIGFyZSBhbnkgc3R5bGluZyBiaW5kaW5ncyBwcmVzZW50XG4gICAqICAoaS5lLiBgW3N0eWxlXWAsIGBbY2xhc3NdYCwgYFtzdHlsZS5wcm9wXWAgb3IgYFtjbGFzcy5uYW1lXWApXG4gICAqL1xuICBwdWJsaWMgaGFzQmluZGluZ3MgPSBmYWxzZTtcbiAgcHVibGljIGhhc0JpbmRpbmdzV2l0aFBpcGVzID0gZmFsc2U7XG5cbiAgLyoqIHRoZSBpbnB1dCBmb3IgW2NsYXNzXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9jbGFzc01hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIHRoZSBpbnB1dCBmb3IgW3N0eWxlXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9zdHlsZU1hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW3N0eWxlLnByb3BdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZVN0eWxlSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbY2xhc3MubmFtZV0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlQ2xhc3NJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2xhc3RTdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9maXJzdFN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG5cbiAgLy8gbWFwcyBhcmUgdXNlZCBpbnN0ZWFkIG9mIGhhc2ggbWFwcyBiZWNhdXNlIGEgTWFwIHdpbGxcbiAgLy8gcmV0YWluIHRoZSBvcmRlcmluZyBvZiB0aGUga2V5c1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIHN0eWxlIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtzdHlsZS53aWR0aF09XCJ3XCIgW3N0eWxlLmhlaWdodF09XCJoXCI+YCBpbXBsaWVzXG4gICAqIHRoYXQgYHdpZHRoPTBgIGFuZCBgaGVpZ2h0PTFgKVxuICAgKi9cbiAgcHJpdmF0ZSBfc3R5bGVzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhdGlvbiBvZiBlYWNoIGNsYXNzIGJpbmRpbmcgaW4gdGhlIHRlbXBsYXRlXG4gICAqIChlLmcuIGA8ZGl2IFtjbGFzcy5iaWddPVwiYlwiIFtjbGFzcy5oaWRkZW5dPVwiaFwiPmAgaW1wbGllc1xuICAgKiB0aGF0IGBiaWc9MGAgYW5kIGBoaWRkZW49MWApXG4gICAqL1xuICBwcml2YXRlIF9jbGFzc2VzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBwcml2YXRlIF9pbml0aWFsU3R5bGVWYWx1ZXM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgX2luaXRpYWxDbGFzc1ZhbHVlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBjZXJ0YWluIHN0eWxlIHByb3BlcnRpZXMgQUxXQVlTIG5lZWQgc2FuaXRpemF0aW9uXG4gIC8vIHRoaXMgaXMgY2hlY2tlZCBlYWNoIHRpbWUgbmV3IHN0eWxlcyBhcmUgZW5jb3VudGVyZWRcbiAgcHJpdmF0ZSBfdXNlRGVmYXVsdFNhbml0aXplciA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2VsZW1lbnRJbmRleEV4cHI6IG8uRXhwcmVzc2lvbiwgcHJpdmF0ZSBfZGlyZWN0aXZlRXhwcjogby5FeHByZXNzaW9ufG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGdpdmVuIGlucHV0IHRvIHRoZSBzdHlsaW5nIGJ1aWxkZXIgdG8gYmUgbGF0ZXIgdXNlZCB3aGVuIHByb2R1Y2luZyBBT1QgY29kZS5cbiAgICpcbiAgICogVGhlIGNvZGUgYmVsb3cgd2lsbCBvbmx5IGFjY2VwdCB0aGUgaW5wdXQgaWYgaXQgaXMgc29tZWhvdyB0aWVkIHRvIHN0eWxpbmcgKHdoZXRoZXIgaXQgYmVcbiAgICogc3R5bGUvY2xhc3MgYmluZGluZ3Mgb3Igc3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMpLlxuICAgKi9cbiAgcmVnaXN0ZXJCb3VuZElucHV0KGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKTogYm9vbGVhbiB7XG4gICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBhcmUgc2tpcHBlZCBpbiB0aGUgY29kZSBiZWxvdyxcbiAgICAvLyB0aGV5IHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkIGJpbmRpbmdzIHNpbmNlXG4gICAgLy8gdGhleSBhcmUgaW50ZW5kZWQgdG8gYmUgd3JpdHRlbiBkaXJlY3RseSB0byB0aGUgYXR0ciBhbmRcbiAgICAvLyB3aWxsIHRoZXJlZm9yZSBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAvLyBbY2xhc3MucHJvcF09XCJcIi4gW2NsYXNzXT1cIlwiIGFzc2lnbm1lbnRzXG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGxldCBuYW1lID0gaW5wdXQubmFtZTtcbiAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3BhbiwgaW5wdXQudW5pdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KG5hbWUsIGZhbHNlLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZyA/IHRydWUgOiBmYWxzZTtcbiAgfVxuXG4gIHJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIGNvbnN0IHByZWZpeCA9IG5hbWUuc3Vic3RyaW5nKDAsIDYpO1xuICAgIGNvbnN0IGlzU3R5bGUgPSBuYW1lID09PSAnc3R5bGUnIHx8IHByZWZpeCA9PT0gJ3N0eWxlLicgfHwgcHJlZml4ID09PSAnc3R5bGUhJztcbiAgICBjb25zdCBpc0NsYXNzID0gIWlzU3R5bGUgJiZcbiAgICAgICAgKG5hbWUgPT09ICdjbGFzcycgfHwgbmFtZSA9PT0gJ2NsYXNzTmFtZScgfHwgcHJlZml4ID09PSAnY2xhc3MuJyB8fCBwcmVmaXggPT09ICdjbGFzcyEnKTtcbiAgICBpZiAoaXNTdHlsZSB8fCBpc0NsYXNzKSB7XG4gICAgICBjb25zdCBpc01hcEJhc2VkID0gbmFtZS5jaGFyQXQoNSkgIT09ICcuJzsgICAgICAgICAvLyBzdHlsZS5wcm9wIG9yIGNsYXNzLnByb3AgbWFrZXMgdGhpcyBhIG5vXG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKGlzTWFwQmFzZWQgPyA1IDogNik7ICAvLyB0aGUgZG90IGV4cGxhaW5zIHdoeSB0aGVyZSdzIGEgKzFcbiAgICAgIGlmIChpc1N0eWxlKSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmluZGluZztcbiAgfVxuXG4gIHJlZ2lzdGVyU3R5bGVJbnB1dChcbiAgICAgIG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdW5pdD86IHN0cmluZ3xudWxsKTogQm91bmRTdHlsaW5nRW50cnl8bnVsbCB7XG4gICAgaWYgKGlzRW1wdHlFeHByZXNzaW9uKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIG5hbWUgPSBub3JtYWxpemVQcm9wTmFtZShuYW1lKTtcbiAgICBjb25zdCB7cHJvcGVydHksIGhhc092ZXJyaWRlRmxhZywgdW5pdDogYmluZGluZ1VuaXR9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTogQm91bmRTdHlsaW5nRW50cnkgPSB7XG4gICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgIHVuaXQ6IHVuaXQgfHwgYmluZGluZ1VuaXQsIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWdcbiAgICB9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID0gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKG5hbWUpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLl9maXJzdFN0eWxpbmdJbnB1dCA9IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0IHx8IGVudHJ5O1xuICAgIHRoaXMuX2NoZWNrRm9yUGlwZXModmFsdWUpO1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NJbnB1dChuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBCb3VuZFN0eWxpbmdFbnRyeXxudWxsIHtcbiAgICBpZiAoaXNFbXB0eUV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qge3Byb3BlcnR5LCBoYXNPdmVycmlkZUZsYWd9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTpcbiAgICAgICAgQm91bmRTdHlsaW5nRW50cnkgPSB7bmFtZTogcHJvcGVydHksIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWcsIHVuaXQ6IG51bGx9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnW2NsYXNzXSBhbmQgW2NsYXNzTmFtZV0gYmluZGluZ3MgY2Fubm90IGJlIHVzZWQgb24gdGhlIHNhbWUgZWxlbWVudCBzaW11bHRhbmVvdXNseScpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBwcm9wZXJ0eSk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICB0aGlzLl9maXJzdFN0eWxpbmdJbnB1dCA9IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0IHx8IGVudHJ5O1xuICAgIHRoaXMuX2NoZWNrRm9yUGlwZXModmFsdWUpO1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrRm9yUGlwZXModmFsdWU6IEFTVCkge1xuICAgIGlmICgodmFsdWUgaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlKSAmJiAodmFsdWUuYXN0IGluc3RhbmNlb2YgQmluZGluZ1BpcGUpKSB7XG4gICAgICB0aGlzLmhhc0JpbmRpbmdzV2l0aFBpcGVzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIHRoZSBlbGVtZW50J3Mgc3RhdGljIHN0eWxlIHN0cmluZyB2YWx1ZSB0byB0aGUgYnVpbGRlci5cbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIHRoZSBzdHlsZSBzdHJpbmcgKGUuZy4gYHdpZHRoOjEwMHB4OyBoZWlnaHQ6MjAwcHg7YClcbiAgICovXG4gIHJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICB0aGlzLl9oYXNJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgY2xhc3Mgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIGNsYXNzTmFtZSBzdHJpbmcgKGUuZy4gYGRpc2FibGVkIGdvbGQgem9vbWApXG4gICAqL1xuICByZWdpc3RlckNsYXNzQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYWxsIHN0eWxpbmctcmVsYXRlZCBleHByZXNzaW9ucyB0byB0aGUgcHJvdmlkZWQgYXR0cnMgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSBhdHRycyBhbiBleGlzdGluZyBhcnJheSB3aGVyZSBlYWNoIG9mIHRoZSBzdHlsaW5nIGV4cHJlc3Npb25zXG4gICAqIHdpbGwgYmUgaW5zZXJ0ZWQgaW50by5cbiAgICovXG4gIHBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyczogby5FeHByZXNzaW9uW10pOiB2b2lkIHtcbiAgICAvLyBbQ0xBU1NfTUFSS0VSLCAnZm9vJywgJ2JhcicsICdiYXonIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLkNsYXNzZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlc1tpXSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFtTVFlMRV9NQVJLRVIsICd3aWR0aCcsICcyMDBweCcsICdoZWlnaHQnLCAnMTAwcHgnLCAuLi5dXG4gICAgaWYgKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcy5sZW5ndGgpIHtcbiAgICAgIGF0dHJzLnB1c2goby5saXRlcmFsKEF0dHJpYnV0ZU1hcmtlci5TdHlsZXMpKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGF0dHJzLnB1c2goXG4gICAgICAgICAgICBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2ldKSwgby5saXRlcmFsKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlc1tpICsgMV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRIb3N0QXR0cnNgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZ2VuZXJhdGlvbiBjb2RlIGJlbG93IGlzIHVzZWQgZm9yIHByb2R1Y2luZyB0aGUgQU9UIHN0YXRlbWVudCBjb2RlIHdoaWNoIGlzXG4gICAqIHJlc3BvbnNpYmxlIGZvciByZWdpc3RlcmluZyBpbml0aWFsIHN0eWxlcyAod2l0aGluIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncycgY3JlYXRpb24gYmxvY2spLFxuICAgKiBhcyB3ZWxsIGFzIGFueSBvZiB0aGUgcHJvdmlkZWQgYXR0cmlidXRlIHZhbHVlcywgdG8gdGhlIGRpcmVjdGl2ZSBob3N0IGVsZW1lbnQuXG4gICAqL1xuICBhc3NpZ25Ib3N0QXR0cnMoYXR0cnM6IG8uRXhwcmVzc2lvbltdLCBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIgJiYgKGF0dHJzLmxlbmd0aCB8fCB0aGlzLl9oYXNJbml0aWFsVmFsdWVzKSkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0cnMpO1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3RBdHRycycsIG8ubGl0ZXJhbEFycihhdHRycykpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgY2xhc3NNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgY2xhc3NNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGVzIHRoZSBgW2NsYXNzXWAgZXhwcmVzc2lvbiBwYXJhbXMuXG4gICAqL1xuICBidWlsZENsYXNzTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9jbGFzc01hcElucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRNYXBCYXNlZEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyLCB0cnVlLCB0aGlzLl9jbGFzc01hcElucHV0KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYHN0eWxlTWFwYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGRhdGEgd2lsbCBjb250YWluIGFsbCBleHByZXNzaW9ucyBmb3IgYHN0eWxlTWFwYCB0byBmdW5jdGlvblxuICAgKiB3aGljaCBpbmNsdWRlcyB0aGUgYFtzdHlsZV1gIGV4cHJlc3Npb24gcGFyYW1zLlxuICAgKi9cbiAgYnVpbGRTdHlsZU1hcEluc3RydWN0aW9uKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fc3R5bGVNYXBJbnB1dCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkTWFwQmFzZWRJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlciwgZmFsc2UsIHRoaXMuX3N0eWxlTWFwSW5wdXQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkTWFwQmFzZWRJbnN0cnVjdGlvbihcbiAgICAgIHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlciwgaXNDbGFzc0Jhc2VkOiBib29sZWFuLFxuICAgICAgc3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeSk6IFN0eWxpbmdJbnN0cnVjdGlvbiB7XG4gICAgLy8gZWFjaCBzdHlsaW5nIGJpbmRpbmcgdmFsdWUgaXMgc3RvcmVkIGluIHRoZSBMVmlld1xuICAgIC8vIG1hcC1iYXNlZCBiaW5kaW5ncyBhbGxvY2F0ZSB0d28gc2xvdHM6IG9uZSBmb3IgdGhlXG4gICAgLy8gcHJldmlvdXMgYmluZGluZyB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgdGhlIHByZXZpb3VzXG4gICAgLy8gY2xhc3NOYW1lIG9yIHN0eWxlIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDI7XG5cbiAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgIC8vIGJlIGV2YWx1YXRlZCAodGhlIEFTVCB2aXNpdCBjYWxsKSBkdXJpbmcgY3JlYXRpb24gdGltZSBzbyB0aGF0IGFueVxuICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgY29uc3QgbWFwVmFsdWUgPSBzdHlsaW5nSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgIGxldCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gICAgaWYgKG1hcFZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiAmJiBpc0NsYXNzQmFzZWQpIHtcbiAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gbWFwVmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgICAgcmVmZXJlbmNlID0gZ2V0Q2xhc3NNYXBJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihtYXBWYWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZmVyZW5jZSA9IGlzQ2xhc3NCYXNlZCA/IFIzLmNsYXNzTWFwIDogUjMuc3R5bGVNYXA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGNhbGxzOiBbe1xuICAgICAgICBzdXBwb3J0c0ludGVycG9sYXRpb246IGlzQ2xhc3NCYXNlZCxcbiAgICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgICBwYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBjb252ZXJ0Rm4obWFwVmFsdWUpO1xuICAgICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KGNvbnZlcnRSZXN1bHQpID8gY29udmVydFJlc3VsdCA6IFtjb252ZXJ0UmVzdWx0XTtcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXSwgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4gICAgICBhbGxvd1VuaXRzOiBib29sZWFuLCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIsXG4gICAgICBnZXRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbkZuPzogKHZhbHVlOiBJbnRlcnBvbGF0aW9uKSA9PiBvLkV4dGVybmFsUmVmZXJlbmNlKTpcbiAgICAgIFN0eWxpbmdJbnN0cnVjdGlvbltdIHtcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IFN0eWxpbmdJbnN0cnVjdGlvbltdID0gW107XG5cbiAgICBpbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBwcmV2aW91c0luc3RydWN0aW9uOiBTdHlsaW5nSW5zdHJ1Y3Rpb258dW5kZWZpbmVkID1cbiAgICAgICAgICBpbnN0cnVjdGlvbnNbaW5zdHJ1Y3Rpb25zLmxlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBsZXQgcmVmZXJlbmNlRm9yQ2FsbCA9IHJlZmVyZW5jZTtcbiAgICAgIGxldCB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkID0gMTsgIC8vIGVhY2ggc3R5bGluZyBiaW5kaW5nIHZhbHVlIGlzIHN0b3JlZCBpbiB0aGUgTFZpZXdcblxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcblxuICAgICAgICBpZiAoZ2V0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb25Gbikge1xuICAgICAgICAgIHJlZmVyZW5jZUZvckNhbGwgPSBnZXRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbkZuKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBjYWxsID0ge1xuICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCxcbiAgICAgICAgc3VwcG9ydHNJbnRlcnBvbGF0aW9uOiAhIWdldEludGVycG9sYXRpb25FeHByZXNzaW9uRm4sXG4gICAgICAgIHBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgLy8gcGFyYW1zID0+IHN0eWxpbmdQcm9wKHByb3BOYW1lLCB2YWx1ZSlcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlucHV0Lm5hbWUpKTtcblxuICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBjb252ZXJ0Rm4odmFsdWUpO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvbnZlcnRSZXN1bHQpKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaCguLi5jb252ZXJ0UmVzdWx0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goY29udmVydFJlc3VsdCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGFsbG93VW5pdHMgJiYgaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlucHV0LnVuaXQpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB3ZSBlbmRlZCB1cCBnZW5lcmF0aW5nIGEgY2FsbCB0byB0aGUgc2FtZSBpbnN0cnVjdGlvbiBhcyB0aGUgcHJldmlvdXMgc3R5bGluZyBwcm9wZXJ0eVxuICAgICAgLy8gd2UgY2FuIGNoYWluIHRoZSBjYWxscyB0b2dldGhlciBzYWZlbHkgdG8gc2F2ZSBzb21lIGJ5dGVzLCBvdGhlcndpc2Ugd2UgaGF2ZSB0byBnZW5lcmF0ZVxuICAgICAgLy8gYSBzZXBhcmF0ZSBpbnN0cnVjdGlvbiBjYWxsLiBUaGlzIGlzIHByaW1hcmlseSBhIGNvbmNlcm4gd2l0aCBpbnRlcnBvbGF0aW9uIGluc3RydWN0aW9uc1xuICAgICAgLy8gd2hlcmUgd2UgbWF5IHN0YXJ0IG9mZiB3aXRoIG9uZSBgcmVmZXJlbmNlYCwgYnV0IGVuZCB1cCB1c2luZyBhbm90aGVyIGJhc2VkIG9uIHRoZVxuICAgICAgLy8gbnVtYmVyIG9mIGludGVycG9sYXRpb25zLlxuICAgICAgaWYgKHByZXZpb3VzSW5zdHJ1Y3Rpb24gJiYgcHJldmlvdXNJbnN0cnVjdGlvbi5yZWZlcmVuY2UgPT09IHJlZmVyZW5jZUZvckNhbGwpIHtcbiAgICAgICAgcHJldmlvdXNJbnN0cnVjdGlvbi5jYWxscy5wdXNoKGNhbGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogcmVmZXJlbmNlRm9yQ2FsbCwgY2FsbHM6IFtjYWxsXX0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGluc3RydWN0aW9ucztcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmNsYXNzUHJvcCwgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMsIHRoaXMuX2NsYXNzZXNJbmRleCwgZmFsc2UsIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgUjMuc3R5bGVQcm9wLCB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cywgdGhpcy5fc3R5bGVzSW5kZXgsIHRydWUsIHZhbHVlQ29udmVydGVyLFxuICAgICAgICAgIGdldFN0eWxlUHJvcEludGVycG9sYXRpb25FeHByZXNzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTYW5pdGl6ZXJGbigpOiBTdHlsaW5nSW5zdHJ1Y3Rpb24ge1xuICAgIHJldHVybiB7XG4gICAgICByZWZlcmVuY2U6IFIzLnN0eWxlU2FuaXRpemVyLFxuICAgICAgY2FsbHM6IFt7XG4gICAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2ZpcnN0U3R5bGluZ0lucHV0ID8gdGhpcy5fZmlyc3RTdHlsaW5nSW5wdXQuc291cmNlU3BhbiA6IG51bGwsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgICBwYXJhbXM6ICgpID0+IFtvLmltcG9ydEV4cHIoUjMuZGVmYXVsdFN0eWxlU2FuaXRpemVyKV1cbiAgICAgIH1dXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFsbCBpbnN0cnVjdGlvbnMgd2hpY2ggY29udGFpbiB0aGUgZXhwcmVzc2lvbnMgdGhhdCB3aWxsIGJlIHBsYWNlZFxuICAgKiBpbnRvIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSB0ZW1wbGF0ZSBmdW5jdGlvbiBvciBhIGRpcmVjdGl2ZSBob3N0QmluZGluZ3MgZnVuY3Rpb24uXG4gICAqL1xuICBidWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcikge1xuICAgIGNvbnN0IGluc3RydWN0aW9uczogU3R5bGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5ncykge1xuICAgICAgaWYgKHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIpIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2godGhpcy5fYnVpbGRTYW5pdGl6ZXJGbigpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0eWxlTWFwSW5zdHJ1Y3Rpb24gPSB0aGlzLmJ1aWxkU3R5bGVNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAoc3R5bGVNYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChzdHlsZU1hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNsYXNzTWFwSW5zdHJ1Y3Rpb24gPSB0aGlzLmJ1aWxkQ2xhc3NNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAoY2xhc3NNYXBJbnN0cnVjdGlvbikge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaChjbGFzc01hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICB9XG4gICAgcmV0dXJuIGluc3RydWN0aW9ucztcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3RlckludG9NYXAobWFwOiBNYXA8c3RyaW5nLCBudW1iZXI+LCBrZXk6IHN0cmluZykge1xuICBpZiAoIW1hcC5oYXMoa2V5KSkge1xuICAgIG1hcC5zZXQoa2V5LCBtYXAuc2l6ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAvLyBOb3RlIHRoYXQgYnJvd3NlcnMgc3VwcG9ydCBib3RoIHRoZSBkYXNoIGNhc2UgYW5kXG4gIC8vIGNhbWVsIGNhc2UgcHJvcGVydHkgbmFtZXMgd2hlbiBzZXR0aW5nIHRocm91Z2ggSlMuXG4gIHJldHVybiBwcm9wID09PSAnYmFja2dyb3VuZC1pbWFnZScgfHwgcHJvcCA9PT0gJ2JhY2tncm91bmRJbWFnZScgfHwgcHJvcCA9PT0gJ2JhY2tncm91bmQnIHx8XG4gICAgICBwcm9wID09PSAnYm9yZGVyLWltYWdlJyB8fCBwcm9wID09PSAnYm9yZGVySW1hZ2UnIHx8IHByb3AgPT09ICdmaWx0ZXInIHx8XG4gICAgICBwcm9wID09PSAnbGlzdC1zdHlsZScgfHwgcHJvcCA9PT0gJ2xpc3RTdHlsZScgfHwgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUtaW1hZ2UnIHx8XG4gICAgICBwcm9wID09PSAnbGlzdFN0eWxlSW1hZ2UnIHx8IHByb3AgPT09ICdjbGlwLXBhdGgnIHx8IHByb3AgPT09ICdjbGlwUGF0aCc7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0byBlaXRoZXIgcHJvdmlkZSB0aGUgY29uc3RhbnQgbGl0ZXJhbCB0aGF0IHdpbGwgaG91c2UgdGhlIHZhbHVlXG4gKiBoZXJlIG9yIGEgbnVsbCB2YWx1ZSBpZiB0aGUgcHJvdmlkZWQgdmFsdWVzIGFyZSBlbXB0eS5cbiAqL1xuZnVuY3Rpb24gZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIHZhbHVlcy5sZW5ndGggPyBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycih2YWx1ZXMpLCB0cnVlKSA6IG8uTlVMTF9FWFBSO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOlxuICAgIHtwcm9wZXJ0eTogc3RyaW5nLCB1bml0OiBzdHJpbmcsIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbn0ge1xuICBsZXQgaGFzT3ZlcnJpZGVGbGFnID0gZmFsc2U7XG4gIGNvbnN0IG92ZXJyaWRlSW5kZXggPSBuYW1lLmluZGV4T2YoSU1QT1JUQU5UX0ZMQUcpO1xuICBpZiAob3ZlcnJpZGVJbmRleCAhPT0gLTEpIHtcbiAgICBuYW1lID0gb3ZlcnJpZGVJbmRleCA+IDAgPyBuYW1lLnN1YnN0cmluZygwLCBvdmVycmlkZUluZGV4KSA6ICcnO1xuICAgIGhhc092ZXJyaWRlRmxhZyA9IHRydWU7XG4gIH1cblxuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHkgPSBuYW1lO1xuICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gIGlmICh1bml0SW5kZXggPiAwKSB7XG4gICAgdW5pdCA9IG5hbWUuc3Vic3RyKHVuaXRJbmRleCArIDEpO1xuICAgIHByb3BlcnR5ID0gbmFtZS5zdWJzdHJpbmcoMCwgdW5pdEluZGV4KTtcbiAgfVxuXG4gIHJldHVybiB7cHJvcGVydHksIHVuaXQsIGhhc092ZXJyaWRlRmxhZ307XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBjbGFzcyBtYXAuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRDbGFzc01hcEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcDtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuY2xhc3NNYXBJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5jbGFzc01hcEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLmNsYXNzTWFwSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBzdHlsZSBwcm9wLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0U3R5bGVQcm9wSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcDtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVByb3BOYW1lKHByb3A6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBoeXBoZW5hdGUocHJvcCk7XG59XG4iXX0=