(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/styling_builder", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/style_parser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var style_parser_1 = require("@angular/compiler/src/render3/view/style_parser");
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
        StylingBuilder.prototype.buildHostAttrsInstruction = function (sourceSpan, attrs, constantPool) {
            var _this = this;
            if (this._directiveExpr && (attrs.length || this._hasInitialValues)) {
                return {
                    sourceSpan: sourceSpan,
                    reference: r3_identifiers_1.Identifiers.elementHostAttrs,
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
            var reference = this._directiveExpr ? r3_identifiers_1.Identifiers.elementHostStyling : r3_identifiers_1.Identifiers.elementStyling;
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
                        addParam(params, _this._useDefaultSanitizer, o.importExpr(r3_identifiers_1.Identifiers.defaultStyleSanitizer), 3, expectedNumberOfArgs);
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
                if (mapBasedClassValue_1 instanceof ast_1.Interpolation) {
                    totalBindingSlotsRequired += mapBasedClassValue_1.expressions.length;
                }
                var mapBasedStyleValue_1 = this._styleMapInput ? this._styleMapInput.value.visit(valueConverter) : null;
                if (mapBasedStyleValue_1 instanceof ast_1.Interpolation) {
                    totalBindingSlotsRequired += mapBasedStyleValue_1.expressions.length;
                }
                var isHostBinding_1 = this._directiveExpr;
                var reference = isHostBinding_1 ? r3_identifiers_1.Identifiers.elementHostStylingMap : r3_identifiers_1.Identifiers.elementStylingMap;
                return {
                    sourceSpan: stylingInput.sourceSpan,
                    reference: reference,
                    allocateBindingSlots: totalBindingSlotsRequired,
                    buildParams: function (convertFn) {
                        // HOST:
                        //   min params => elementHostStylingMap(classMap)
                        //   max params => elementHostStylingMap(classMap, styleMap)
                        // Template:
                        //   min params => elementStylingMap(elmIndex, classMap)
                        //   max params => elementStylingMap(elmIndex, classMap, styleMap)
                        var params = [];
                        if (!isHostBinding_1) {
                            params.push(_this._elementIndexExpr);
                        }
                        var expectedNumberOfArgs = 0;
                        if (mapBasedStyleValue_1) {
                            expectedNumberOfArgs = 2;
                        }
                        else if (mapBasedClassValue_1) {
                            // index and class = 2
                            expectedNumberOfArgs = 1;
                        }
                        addParam(params, mapBasedClassValue_1, mapBasedClassValue_1 ? convertFn(mapBasedClassValue_1) : null, 1, expectedNumberOfArgs);
                        addParam(params, mapBasedStyleValue_1, mapBasedStyleValue_1 ? convertFn(mapBasedStyleValue_1) : null, 2, expectedNumberOfArgs);
                        return params;
                    }
                };
            }
            return null;
        };
        StylingBuilder.prototype._buildSingleInputs = function (reference, isHostBinding, inputs, mapIndex, allowUnits, valueConverter) {
            var _this = this;
            var totalBindingSlotsRequired = 0;
            return inputs.map(function (input) {
                var bindingIndex = mapIndex.get(input.name);
                var value = input.value.visit(valueConverter);
                totalBindingSlotsRequired += (value instanceof ast_1.Interpolation) ? value.expressions.length : 0;
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
                var reference = isHostBinding ? r3_identifiers_1.Identifiers.elementHostClassProp : r3_identifiers_1.Identifiers.elementClassProp;
                return this._buildSingleInputs(reference, isHostBinding, this._singleClassInputs, this._classesIndex, false, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
            if (this._singleStyleInputs) {
                var isHostBinding = !!this._directiveExpr;
                var reference = isHostBinding ? r3_identifiers_1.Identifiers.elementHostStyleProp : r3_identifiers_1.Identifiers.elementStyleProp;
                return this._buildSingleInputs(reference, isHostBinding, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildApplyFn = function () {
            var _this = this;
            var isHostBinding = this._directiveExpr;
            var reference = isHostBinding ? r3_identifiers_1.Identifiers.elementHostStylingApply : r3_identifiers_1.Identifiers.elementStylingApply;
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
    exports.StylingBuilder = StylingBuilder;
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy9zdHlsaW5nX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBU0EsbUVBQTRFO0lBQzVFLDJEQUE2QztJQUc3QywrRUFBb0Q7SUFFcEQsZ0ZBQW1EO0lBR25ELElBQU0sY0FBYyxHQUFHLFlBQVksQ0FBQztJQXVCcEM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0E0Qkc7SUFDSDtRQTBDRSx3QkFBb0IsaUJBQStCLEVBQVUsY0FBaUM7WUFBMUUsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFjO1lBQVUsbUJBQWMsR0FBZCxjQUFjLENBQW1CO1lBekM5RixpRUFBaUU7WUFDekQsc0JBQWlCLEdBQUcsS0FBSyxDQUFDO1lBQ2xDOzs7ZUFHRztZQUNJLGdCQUFXLEdBQUcsS0FBSyxDQUFDO1lBRTNCLDJDQUEyQztZQUNuQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7WUFDdEQsMkNBQTJDO1lBQ25DLG1CQUFjLEdBQTJCLElBQUksQ0FBQztZQUN0RCwwQ0FBMEM7WUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztZQUM1RCwwQ0FBMEM7WUFDbEMsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztZQUNwRCxzQkFBaUIsR0FBMkIsSUFBSSxDQUFDO1lBRXpELHdEQUF3RDtZQUN4RCxrQ0FBa0M7WUFFbEM7Ozs7ZUFJRztZQUNLLGlCQUFZLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7WUFFakQ7Ozs7ZUFJRztZQUNLLGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7WUFDMUMsd0JBQW1CLEdBQWEsRUFBRSxDQUFDO1lBQ25DLHdCQUFtQixHQUFhLEVBQUUsQ0FBQztZQUUzQyxvREFBb0Q7WUFDcEQsdURBQXVEO1lBQy9DLHlCQUFvQixHQUFHLEtBQUssQ0FBQztRQUU0RCxDQUFDO1FBRWxHOzs7OztXQUtHO1FBQ0gsMkNBQWtCLEdBQWxCLFVBQW1CLEtBQXVCO1lBQ3hDLDhEQUE4RDtZQUM5RCw2REFBNkQ7WUFDN0QsMkRBQTJEO1lBQzNELGlFQUFpRTtZQUNqRSwyREFBMkQ7WUFDM0QsMENBQTBDO1lBQzFDLElBQUksT0FBTyxHQUEyQixJQUFJLENBQUM7WUFDM0MsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztZQUN0QixRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUU7Z0JBQ2xCO29CQUNFLE9BQU8sR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUM3RSxNQUFNO2dCQUNSO29CQUNFLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMxRixNQUFNO2dCQUNSO29CQUNFLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDOUUsTUFBTTthQUNUO1lBQ0QsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ2hDLENBQUM7UUFFRCxpREFBd0IsR0FBeEIsVUFBeUIsSUFBWSxFQUFFLFVBQWUsRUFBRSxVQUEyQjtZQUNqRixJQUFJLE9BQU8sR0FBMkIsSUFBSSxDQUFDO1lBQzNDLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUUsZ0JBQWdCO1lBQzNELElBQU0sT0FBTyxHQUFHLFdBQVcsS0FBSyxPQUFPLENBQUM7WUFDeEMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1lBQzVELElBQUksT0FBTyxJQUFJLE9BQU8sRUFBRTtnQkFDdEIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBUywyQ0FBMkM7Z0JBQzlGLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsb0NBQW9DO2dCQUN2RixJQUFJLE9BQU8sRUFBRTtvQkFDWCxPQUFPLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2lCQUNqRjtxQkFBTTtvQkFDTCxPQUFPLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2lCQUNqRjthQUNGO1lBQ0QsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztRQUVELDJDQUFrQixHQUFsQixVQUNJLElBQVksRUFBRSxVQUFtQixFQUFFLEtBQVUsRUFBRSxVQUEyQixFQUMxRSxJQUFrQjtZQUNkLElBQUEsd0JBQW9FLEVBQW5FLHNCQUFRLEVBQUUsb0NBQWUsRUFBRSxxQkFBd0MsQ0FBQztZQUMzRSxJQUFNLEtBQUssR0FBc0I7Z0JBQy9CLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxJQUFJLElBQUksV0FBVyxFQUFFLEtBQUssT0FBQSxFQUFFLFVBQVUsWUFBQSxFQUFFLGVBQWUsaUJBQUE7YUFDOUQsQ0FBQztZQUNGLElBQUksVUFBVSxFQUFFO2dCQUNkLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO2FBQzdCO2lCQUFNO2dCQUNMLENBQUMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUMsb0JBQW9CLElBQUksa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xGLGVBQWUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQzlDO1lBQ0QsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQztZQUMvQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztZQUN4QixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFRCwyQ0FBa0IsR0FBbEIsVUFBbUIsSUFBWSxFQUFFLFVBQW1CLEVBQUUsS0FBVSxFQUFFLFVBQTJCO1lBRXJGLElBQUEsd0JBQWlELEVBQWhELHNCQUFRLEVBQUUsb0NBQXNDLENBQUM7WUFDeEQsSUFBTSxLQUFLLEdBQ2EsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssT0FBQSxFQUFFLFVBQVUsWUFBQSxFQUFFLGVBQWUsaUJBQUEsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLENBQUM7WUFDekYsSUFBSSxVQUFVLEVBQUU7Z0JBQ2QsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7YUFDN0I7aUJBQU07Z0JBQ0wsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEUsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7YUFDL0M7WUFDRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO1lBQy9CLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1lBQ3hCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVEOzs7O1dBSUc7UUFDSCwwQ0FBaUIsR0FBakIsVUFBa0IsS0FBYTtZQUM3QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsb0JBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLENBQUM7UUFFRDs7OztXQUlHO1FBQ0gsMENBQWlCLEdBQWpCLFVBQWtCLEtBQWE7WUFDN0IsSUFBSSxDQUFDLG1CQUFtQixHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQztRQUNoQyxDQUFDO1FBRUQ7Ozs7O1dBS0c7UUFDSCxvREFBMkIsR0FBM0IsVUFBNEIsS0FBcUI7WUFDL0MsMENBQTBDO1lBQzFDLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtnQkFDbkMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxpQkFBeUIsQ0FBQyxDQUFDO2dCQUMvQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDeEQsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ3BEO2FBQ0Y7WUFFRCwyREFBMkQ7WUFDM0QsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFO2dCQUNuQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLGdCQUF3QixDQUFDLENBQUM7Z0JBQzlDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzNELEtBQUssQ0FBQyxJQUFJLENBQ04sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUN6RjthQUNGO1FBQ0gsQ0FBQztRQUVEOzs7Ozs7V0FNRztRQUNILGtEQUF5QixHQUF6QixVQUNJLFVBQWdDLEVBQUUsS0FBcUIsRUFDdkQsWUFBMEI7WUFGOUIsaUJBbUJDO1lBaEJDLElBQUksSUFBSSxDQUFDLGNBQWMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7Z0JBQ25FLE9BQU87b0JBQ0wsVUFBVSxZQUFBO29CQUNWLFNBQVMsRUFBRSw0QkFBRSxDQUFDLGdCQUFnQjtvQkFDOUIsb0JBQW9CLEVBQUUsQ0FBQztvQkFDdkIsV0FBVyxFQUFFO3dCQUNYLHlEQUF5RDt3QkFDekQsS0FBSSxDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN4QyxJQUFNLFNBQVMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLFlBQVksQ0FBQyxDQUFDLGVBQWUsRUFBakMsQ0FBaUMsQ0FBQyxDQUFDLENBQUM7NEJBQ3RFLDJCQUEyQixDQUFDLFlBQVksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDOzRCQUNsRCxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN4QixPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3JCLENBQUM7aUJBQ0YsQ0FBQzthQUNIO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQ7Ozs7O1dBS0c7UUFDSCx1REFBOEIsR0FBOUIsVUFBK0IsVUFBZ0MsRUFBRSxZQUEwQjtZQUEzRixpQkF1REM7WUFyREMsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUM7WUFDbEYsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO2dCQUNwQixPQUFPO29CQUNMLFVBQVUsWUFBQTtvQkFDVixvQkFBb0IsRUFBRSxDQUFDLEVBQUUsU0FBUyxXQUFBO29CQUNsQyxXQUFXLEVBQUU7d0JBQ1gsOENBQThDO3dCQUM5QyxJQUFNLGlCQUFpQixHQUNuQixLQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQ3ZGLDhDQUE4Qzt3QkFDOUMsSUFBTSxpQkFBaUIsR0FDbkIsS0FBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxLQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQWpCLENBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUV2RiwyRUFBMkU7d0JBQzNFLDBFQUEwRTt3QkFDMUUsa0ZBQWtGO3dCQUNsRiw4RUFBOEU7d0JBQzlFLGlFQUFpRTt3QkFDakUsRUFBRTt3QkFDRixRQUFRO3dCQUNSLHVDQUF1Qzt3QkFDdkMsOEVBQThFO3dCQUM5RSxFQUFFO3dCQUNGLFlBQVk7d0JBQ1osbUNBQW1DO3dCQUNuQywwRUFBMEU7d0JBQzFFLEVBQUU7d0JBQ0YsSUFBTSxNQUFNLEdBQW1CLEVBQUUsQ0FBQzt3QkFDbEMsSUFBSSxvQkFBb0IsR0FBRyxDQUFDLENBQUM7d0JBQzdCLElBQUksS0FBSSxDQUFDLG9CQUFvQixFQUFFOzRCQUM3QixvQkFBb0IsR0FBRyxDQUFDLENBQUM7eUJBQzFCOzZCQUFNLElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFOzRCQUNuQyxvQkFBb0IsR0FBRyxDQUFDLENBQUM7eUJBQzFCOzZCQUFNLElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFOzRCQUNuQyxvQkFBb0IsR0FBRyxDQUFDLENBQUM7eUJBQzFCO3dCQUVELFFBQVEsQ0FDSixNQUFNLEVBQUUsaUJBQWlCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFDcEMsMkJBQTJCLENBQUMsWUFBWSxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxFQUMvRCxvQkFBb0IsQ0FBQyxDQUFDO3dCQUMxQixRQUFRLENBQ0osTUFBTSxFQUFFLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQ3BDLDJCQUEyQixDQUFDLFlBQVksRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsRUFDL0Qsb0JBQW9CLENBQUMsQ0FBQzt3QkFDMUIsUUFBUSxDQUNKLE1BQU0sRUFBRSxLQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxFQUM1RSxvQkFBb0IsQ0FBQyxDQUFDO3dCQUMxQixPQUFPLE1BQU0sQ0FBQztvQkFDaEIsQ0FBQztpQkFDRixDQUFDO2FBQ0g7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRDs7Ozs7O1dBTUc7UUFDSCwwREFBaUMsR0FBakMsVUFBa0MsY0FBOEI7WUFBaEUsaUJBMkRDO1lBMURDLElBQUksSUFBSSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO2dCQUM5QyxJQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsY0FBZ0IsSUFBSSxJQUFJLENBQUMsY0FBZ0IsQ0FBQztnQkFDcEUsSUFBSSx5QkFBeUIsR0FBRyxDQUFDLENBQUM7Z0JBRWxDLG9FQUFvRTtnQkFDcEUsb0VBQW9FO2dCQUNwRSw4REFBOEQ7Z0JBQzlELElBQU0sb0JBQWtCLEdBQ3BCLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO2dCQUNqRixJQUFJLG9CQUFrQixZQUFZLG1CQUFhLEVBQUU7b0JBQy9DLHlCQUF5QixJQUFJLG9CQUFrQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7aUJBQ3BFO2dCQUVELElBQU0sb0JBQWtCLEdBQ3BCLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO2dCQUNqRixJQUFJLG9CQUFrQixZQUFZLG1CQUFhLEVBQUU7b0JBQy9DLHlCQUF5QixJQUFJLG9CQUFrQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7aUJBQ3BFO2dCQUVELElBQU0sZUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQzFDLElBQU0sU0FBUyxHQUFHLGVBQWEsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxpQkFBaUIsQ0FBQztnQkFFbEYsT0FBTztvQkFDTCxVQUFVLEVBQUUsWUFBWSxDQUFDLFVBQVU7b0JBQ25DLFNBQVMsV0FBQTtvQkFDVCxvQkFBb0IsRUFBRSx5QkFBeUI7b0JBQy9DLFdBQVcsRUFBRSxVQUFDLFNBQXVDO3dCQUNuRCxRQUFRO3dCQUNSLGtEQUFrRDt3QkFDbEQsNERBQTREO3dCQUM1RCxZQUFZO3dCQUNaLHdEQUF3RDt3QkFDeEQsa0VBQWtFO3dCQUVsRSxJQUFNLE1BQU0sR0FBbUIsRUFBRSxDQUFDO3dCQUNsQyxJQUFJLENBQUMsZUFBYSxFQUFFOzRCQUNsQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO3lCQUNyQzt3QkFFRCxJQUFJLG9CQUFvQixHQUFHLENBQUMsQ0FBQzt3QkFDN0IsSUFBSSxvQkFBa0IsRUFBRTs0QkFDdEIsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO3lCQUMxQjs2QkFBTSxJQUFJLG9CQUFrQixFQUFFOzRCQUM3QixzQkFBc0I7NEJBQ3RCLG9CQUFvQixHQUFHLENBQUMsQ0FBQzt5QkFDMUI7d0JBRUQsUUFBUSxDQUNKLE1BQU0sRUFBRSxvQkFBa0IsRUFBRSxvQkFBa0IsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLG9CQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFDckYsQ0FBQyxFQUFFLG9CQUFvQixDQUFDLENBQUM7d0JBQzdCLFFBQVEsQ0FDSixNQUFNLEVBQUUsb0JBQWtCLEVBQUUsb0JBQWtCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxvQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQ3JGLENBQUMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO3dCQUM3QixPQUFPLE1BQU0sQ0FBQztvQkFDaEIsQ0FBQztpQkFDRixDQUFDO2FBQ0g7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFTywyQ0FBa0IsR0FBMUIsVUFDSSxTQUE4QixFQUFFLGFBQXNCLEVBQUUsTUFBMkIsRUFDbkYsUUFBNkIsRUFBRSxVQUFtQixFQUNsRCxjQUE4QjtZQUhsQyxpQkE0Q0M7WUF4Q0MsSUFBSSx5QkFBeUIsR0FBRyxDQUFDLENBQUM7WUFDbEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSztnQkFDckIsSUFBTSxZQUFZLEdBQVcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBTSxDQUFHLENBQUM7Z0JBQzFELElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUNoRCx5QkFBeUIsSUFBSSxDQUFDLEtBQUssWUFBWSxtQkFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdGLE9BQU87b0JBQ0wsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO29CQUM1QixvQkFBb0IsRUFBRSx5QkFBeUIsRUFBRSxTQUFTLFdBQUE7b0JBQzFELFdBQVcsRUFBRSxVQUFDLFNBQXVDO3dCQUNuRCxRQUFRO3dCQUNSLDhEQUE4RDt3QkFDOUQsNEVBQTRFO3dCQUM1RSxZQUFZO3dCQUNaLG9FQUFvRTt3QkFDcEUsa0ZBQWtGO3dCQUNsRixJQUFNLE1BQU0sR0FBbUIsRUFBRSxDQUFDO3dCQUVsQyxJQUFJLENBQUMsYUFBYSxFQUFFOzRCQUNsQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO3lCQUNyQzt3QkFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQzt3QkFDckMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzt3QkFFOUIsSUFBSSxVQUFVLEVBQUU7NEJBQ2QsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFO2dDQUNkLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzs2QkFDcEM7aUNBQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFO2dDQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQzs2QkFDMUI7eUJBQ0Y7d0JBRUQsSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFOzRCQUN6QixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt5QkFDOUI7d0JBRUQsT0FBTyxNQUFNLENBQUM7b0JBQ2hCLENBQUM7aUJBQ0YsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVPLDBDQUFpQixHQUF6QixVQUEwQixjQUE4QjtZQUN0RCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQkFDM0IsSUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQzVDLElBQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDaEYsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQzFCLFNBQVMsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxFQUM1RSxjQUFjLENBQUMsQ0FBQzthQUNyQjtZQUNELE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVPLDBDQUFpQixHQUF6QixVQUEwQixjQUE4QjtZQUN0RCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQkFDM0IsSUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQzVDLElBQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDaEYsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQzFCLFNBQVMsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUMxRSxjQUFjLENBQUMsQ0FBQzthQUNyQjtZQUNELE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVPLHNDQUFhLEdBQXJCO1lBQUEsaUJBZUM7WUFkQyxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO1lBQzFDLElBQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxtQkFBbUIsQ0FBQztZQUN0RixPQUFPO2dCQUNMLFVBQVUsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUk7Z0JBQzdFLFNBQVMsV0FBQTtnQkFDVCxvQkFBb0IsRUFBRSxDQUFDO2dCQUN2QixXQUFXLEVBQUU7b0JBQ1gsUUFBUTtvQkFDUix3Q0FBd0M7b0JBQ3hDLFlBQVk7b0JBQ1osNENBQTRDO29CQUM1QyxPQUFPLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO2FBQ0YsQ0FBQztRQUNKLENBQUM7UUFFRDs7O1dBR0c7UUFDSCxxREFBNEIsR0FBNUIsVUFBNkIsY0FBOEI7WUFDekQsSUFBTSxZQUFZLEdBQWtCLEVBQUUsQ0FBQztZQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ3BCLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDOUUsSUFBSSxjQUFjLEVBQUU7b0JBQ2xCLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7aUJBQ25DO2dCQUNELFlBQVksQ0FBQyxJQUFJLE9BQWpCLFlBQVksbUJBQVMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxHQUFFO2dCQUM3RCxZQUFZLENBQUMsSUFBSSxPQUFqQixZQUFZLG1CQUFTLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsR0FBRTtnQkFDN0QsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQzthQUN6QztZQUNELE9BQU8sWUFBWSxDQUFDO1FBQ3RCLENBQUM7UUFDSCxxQkFBQztJQUFELENBQUMsQUFqYkQsSUFpYkM7SUFqYlksd0NBQWM7SUFtYjNCLFNBQVMsZUFBZSxDQUFDLEdBQXdCLEVBQUUsR0FBVztRQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNqQixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7SUFDSCxDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFZO1FBQ3RDLE9BQU8sSUFBSSxLQUFLLGtCQUFrQixJQUFJLElBQUksS0FBSyxZQUFZLElBQUksSUFBSSxLQUFLLGNBQWM7WUFDbEYsSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLEtBQUssWUFBWSxJQUFJLElBQUksS0FBSyxrQkFBa0IsQ0FBQztJQUNoRixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUywyQkFBMkIsQ0FDaEMsWUFBMEIsRUFBRSxNQUFzQjtRQUNwRCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNoRyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyxRQUFRLENBQ2IsTUFBc0IsRUFBRSxTQUFjLEVBQUUsS0FBMEIsRUFBRSxTQUFpQixFQUNyRixpQkFBeUI7UUFDM0IsSUFBSSxTQUFTLElBQUksS0FBSyxFQUFFO1lBQ3RCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDcEI7YUFBTSxJQUFJLFNBQVMsR0FBRyxpQkFBaUIsRUFBRTtZQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUMxQjtJQUNILENBQUM7SUFFRCxTQUFnQixhQUFhLENBQUMsSUFBWTtRQUV4QyxJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7UUFDNUIsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNuRCxJQUFJLGFBQWEsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUN4QixJQUFJLEdBQUcsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNqRSxlQUFlLEdBQUcsSUFBSSxDQUFDO1NBQ3hCO1FBRUQsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ2QsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFO1lBQ2pCLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNsQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDekM7UUFFRCxPQUFPLEVBQUMsUUFBUSxVQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsZUFBZSxpQkFBQSxFQUFDLENBQUM7SUFDM0MsQ0FBQztJQWxCRCxzQ0FrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0F0dHJpYnV0ZU1hcmtlcn0gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQmluZGluZ1R5cGUsIEludGVycG9sYXRpb259IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcblxuY29uc3QgSU1QT1JUQU5UX0ZMQUcgPSAnIWltcG9ydGFudCc7XG5cbi8qKlxuICogQSBzdHlsaW5nIGV4cHJlc3Npb24gc3VtbWFyeSB0aGF0IGlzIHRvIGJlIHByb2Nlc3NlZCBieSB0aGUgY29tcGlsZXJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbnN0cnVjdGlvbiB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiBudW1iZXI7XG4gIGJ1aWxkUGFyYW1zKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbltdO1xufVxuXG4vKipcbiAqIEFuIGludGVybmFsIHJlY29yZCBvZiB0aGUgaW5wdXQgZGF0YSBmb3IgYSBzdHlsaW5nIGJpbmRpbmdcbiAqL1xuaW50ZXJmYWNlIEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgaGFzT3ZlcnJpZGVGbGFnOiBib29sZWFuO1xuICBuYW1lOiBzdHJpbmd8bnVsbDtcbiAgdW5pdDogc3RyaW5nfG51bGw7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmFsdWU6IEFTVDtcbn1cblxuLyoqXG4gKiBQcm9kdWNlcyBjcmVhdGlvbi91cGRhdGUgaW5zdHJ1Y3Rpb25zIGZvciBhbGwgc3R5bGluZyBiaW5kaW5ncyAoY2xhc3MgYW5kIHN0eWxlKVxuICpcbiAqIEl0IGFsc28gcHJvZHVjZXMgdGhlIGNyZWF0aW9uIGluc3RydWN0aW9uIHRvIHJlZ2lzdGVyIGFsbCBpbml0aWFsIHN0eWxpbmcgdmFsdWVzXG4gKiAod2hpY2ggYXJlIGFsbCB0aGUgc3RhdGljIGNsYXNzPVwiLi4uXCIgYW5kIHN0eWxlPVwiLi4uXCIgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGV4aXN0XG4gKiBvbiBhbiBlbGVtZW50IHdpdGhpbiBhIHRlbXBsYXRlKS5cbiAqXG4gKiBUaGUgYnVpbGRlciBjbGFzcyBiZWxvdyBoYW5kbGVzIHByb2R1Y2luZyBpbnN0cnVjdGlvbnMgZm9yIHRoZSBmb2xsb3dpbmcgY2FzZXM6XG4gKlxuICogLSBTdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcyAoc3R5bGU9XCIuLi5cIiBhbmQgY2xhc3M9XCIuLi5cIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBtYXAgYmluZGluZ3MgKFtzdHlsZV09XCJtYXBcIiBhbmQgW2NsYXNzXT1cIm1hcHxzdHJpbmdcIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBwcm9wZXJ0eSBiaW5kaW5ncyAoW3N0eWxlLnByb3BdPVwiZXhwXCIgYW5kIFtjbGFzcy5uYW1lXT1cImV4cFwiKVxuICpcbiAqIER1ZSB0byB0aGUgY29tcGxleCByZWxhdGlvbnNoaXAgb2YgYWxsIG9mIHRoZXNlIGNhc2VzLCB0aGUgaW5zdHJ1Y3Rpb25zIGdlbmVyYXRlZFxuICogZm9yIHRoZXNlIGF0dHJpYnV0ZXMvcHJvcGVydGllcy9iaW5kaW5ncyBtdXN0IGJlIGRvbmUgc28gaW4gdGhlIGNvcnJlY3Qgb3JkZXIuIFRoZVxuICogb3JkZXIgd2hpY2ggdGhlc2UgbXVzdCBiZSBnZW5lcmF0ZWQgaXMgYXMgZm9sbG93czpcbiAqXG4gKiBpZiAoY3JlYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGluZyguLi4pXG4gKiB9XG4gKiBpZiAodXBkYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGluZ01hcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsZVByb3AoLi4uKVxuICogICBlbGVtZW50Q2xhc3NQcm9wKC4uLilcbiAqICAgZWxlbWVudFN0eWxpbmdBcHAoLi4uKVxuICogfVxuICpcbiAqIFRoZSBjcmVhdGlvbi91cGRhdGUgbWV0aG9kcyB3aXRoaW4gdGhlIGJ1aWxkZXIgY2xhc3MgcHJvZHVjZSB0aGVzZSBpbnN0cnVjdGlvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHlsaW5nQnVpbGRlciB7XG4gIC8qKiBXaGV0aGVyIG9yIG5vdCB0aGVyZSBhcmUgYW55IHN0YXRpYyBzdHlsaW5nIHZhbHVlcyBwcmVzZW50ICovXG4gIHByaXZhdGUgX2hhc0luaXRpYWxWYWx1ZXMgPSBmYWxzZTtcbiAgLyoqXG4gICAqICBXaGV0aGVyIG9yIG5vdCB0aGVyZSBhcmUgYW55IHN0eWxpbmcgYmluZGluZ3MgcHJlc2VudFxuICAgKiAgKGkuZS4gYFtzdHlsZV1gLCBgW2NsYXNzXWAsIGBbc3R5bGUucHJvcF1gIG9yIGBbY2xhc3MubmFtZV1gKVxuICAgKi9cbiAgcHVibGljIGhhc0JpbmRpbmdzID0gZmFsc2U7XG5cbiAgLyoqIHRoZSBpbnB1dCBmb3IgW2NsYXNzXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9jbGFzc01hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIHRoZSBpbnB1dCBmb3IgW3N0eWxlXSAoaWYgaXQgZXhpc3RzKSAqL1xuICBwcml2YXRlIF9zdHlsZU1hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgLyoqIGFuIGFycmF5IG9mIGVhY2ggW3N0eWxlLnByb3BdIGlucHV0ICovXG4gIHByaXZhdGUgX3NpbmdsZVN0eWxlSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICAvKiogYW4gYXJyYXkgb2YgZWFjaCBbY2xhc3MubmFtZV0gaW5wdXQgKi9cbiAgcHJpdmF0ZSBfc2luZ2xlQ2xhc3NJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2xhc3RTdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuXG4gIC8vIG1hcHMgYXJlIHVzZWQgaW5zdGVhZCBvZiBoYXNoIG1hcHMgYmVjYXVzZSBhIE1hcCB3aWxsXG4gIC8vIHJldGFpbiB0aGUgb3JkZXJpbmcgb2YgdGhlIGtleXNcblxuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgbG9jYXRpb24gb2YgZWFjaCBzdHlsZSBiaW5kaW5nIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiAoZS5nLiBgPGRpdiBbc3R5bGUud2lkdGhdPVwid1wiIFtzdHlsZS5oZWlnaHRdPVwiaFwiPmAgaW1wbGllc1xuICAgKiB0aGF0IGB3aWR0aD0wYCBhbmQgYGhlaWdodD0xYClcbiAgICovXG4gIHByaXZhdGUgX3N0eWxlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgbG9jYXRpb24gb2YgZWFjaCBjbGFzcyBiaW5kaW5nIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiAoZS5nLiBgPGRpdiBbY2xhc3MuYmlnXT1cImJcIiBbY2xhc3MuaGlkZGVuXT1cImhcIj5gIGltcGxpZXNcbiAgICogdGhhdCBgYmlnPTBgIGFuZCBgaGlkZGVuPTFgKVxuICAgKi9cbiAgcHJpdmF0ZSBfY2xhc3Nlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgcHJpdmF0ZSBfaW5pdGlhbFN0eWxlVmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIF9pbml0aWFsQ2xhc3NWYWx1ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gY2VydGFpbiBzdHlsZSBwcm9wZXJ0aWVzIEFMV0FZUyBuZWVkIHNhbml0aXphdGlvblxuICAvLyB0aGlzIGlzIGNoZWNrZWQgZWFjaCB0aW1lIG5ldyBzdHlsZXMgYXJlIGVuY291bnRlcmVkXG4gIHByaXZhdGUgX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9lbGVtZW50SW5kZXhFeHByOiBvLkV4cHJlc3Npb24sIHByaXZhdGUgX2RpcmVjdGl2ZUV4cHI6IG8uRXhwcmVzc2lvbnxudWxsKSB7fVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBnaXZlbiBpbnB1dCB0byB0aGUgc3R5bGluZyBidWlsZGVyIHRvIGJlIGxhdGVyIHVzZWQgd2hlbiBwcm9kdWNpbmcgQU9UIGNvZGUuXG4gICAqXG4gICAqIFRoZSBjb2RlIGJlbG93IHdpbGwgb25seSBhY2NlcHQgdGhlIGlucHV0IGlmIGl0IGlzIHNvbWVob3cgdGllZCB0byBzdHlsaW5nICh3aGV0aGVyIGl0IGJlXG4gICAqIHN0eWxlL2NsYXNzIGJpbmRpbmdzIG9yIHN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzKS5cbiAgICovXG4gIHJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICAgIC8vIFthdHRyLnN0eWxlXSBvciBbYXR0ci5jbGFzc10gYXJlIHNraXBwZWQgaW4gdGhlIGNvZGUgYmVsb3csXG4gICAgLy8gdGhleSBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgc3R5bGluZy1iYXNlZCBiaW5kaW5ncyBzaW5jZVxuICAgIC8vIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHIgYW5kXG4gICAgLy8gd2lsbCB0aGVyZWZvcmUgc2tpcCBhbGwgc3R5bGUvY2xhc3MgcmVzb2x1dGlvbiB0aGF0IGlzIHByZXNlbnRcbiAgICAvLyB3aXRoIHN0eWxlPVwiXCIsIFtzdHlsZV09XCJcIiBhbmQgW3N0eWxlLnByb3BdPVwiXCIsIGNsYXNzPVwiXCIsXG4gICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgIGxldCBiaW5kaW5nOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgICBsZXQgbmFtZSA9IGlucHV0Lm5hbWU7XG4gICAgc3dpdGNoIChpbnB1dC50eXBlKSB7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlcklucHV0QmFzZWRPbk5hbWUobmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChuYW1lLCBmYWxzZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4sIGlucHV0LnVuaXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChuYW1lLCBmYWxzZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmcgPyB0cnVlIDogZmFsc2U7XG4gIH1cblxuICByZWdpc3RlcklucHV0QmFzZWRPbk5hbWUobmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGxldCBiaW5kaW5nOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgICBjb25zdCBuYW1lVG9NYXRjaCA9IG5hbWUuc3Vic3RyaW5nKDAsIDUpOyAgLy8gY2xhc3MgfCBzdHlsZVxuICAgIGNvbnN0IGlzU3R5bGUgPSBuYW1lVG9NYXRjaCA9PT0gJ3N0eWxlJztcbiAgICBjb25zdCBpc0NsYXNzID0gaXNTdHlsZSA/IGZhbHNlIDogKG5hbWVUb01hdGNoID09PSAnY2xhc3MnKTtcbiAgICBpZiAoaXNTdHlsZSB8fCBpc0NsYXNzKSB7XG4gICAgICBjb25zdCBpc01hcEJhc2VkID0gbmFtZS5jaGFyQXQoNSkgIT09ICcuJzsgICAgICAgICAvLyBzdHlsZS5wcm9wIG9yIGNsYXNzLnByb3AgbWFrZXMgdGhpcyBhIG5vXG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKGlzTWFwQmFzZWQgPyA1IDogNik7ICAvLyB0aGUgZG90IGV4cGxhaW5zIHdoeSB0aGVyZSdzIGEgKzFcbiAgICAgIGlmIChpc1N0eWxlKSB7XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChwcm9wZXJ0eSwgaXNNYXBCYXNlZCwgZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQocHJvcGVydHksIGlzTWFwQmFzZWQsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmluZGluZztcbiAgfVxuXG4gIHJlZ2lzdGVyU3R5bGVJbnB1dChcbiAgICAgIG5hbWU6IHN0cmluZywgaXNNYXBCYXNlZDogYm9vbGVhbiwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdW5pdD86IHN0cmluZ3xudWxsKTogQm91bmRTdHlsaW5nRW50cnkge1xuICAgIGNvbnN0IHtwcm9wZXJ0eSwgaGFzT3ZlcnJpZGVGbGFnLCB1bml0OiBiaW5kaW5nVW5pdH0gPSBwYXJzZVByb3BlcnR5KG5hbWUpO1xuICAgIGNvbnN0IGVudHJ5OiBCb3VuZFN0eWxpbmdFbnRyeSA9IHtcbiAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgdW5pdDogdW5pdCB8fCBiaW5kaW5nVW5pdCwgdmFsdWUsIHNvdXJjZVNwYW4sIGhhc092ZXJyaWRlRmxhZ1xuICAgIH07XG4gICAgaWYgKGlzTWFwQmFzZWQpIHtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0cnVlO1xuICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgPSB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUobmFtZSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fc3R5bGVzSW5kZXgsIHByb3BlcnR5KTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NJbnB1dChuYW1lOiBzdHJpbmcsIGlzTWFwQmFzZWQ6IGJvb2xlYW4sIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gICAgY29uc3Qge3Byb3BlcnR5LCBoYXNPdmVycmlkZUZsYWd9ID0gcGFyc2VQcm9wZXJ0eShuYW1lKTtcbiAgICBjb25zdCBlbnRyeTpcbiAgICAgICAgQm91bmRTdHlsaW5nRW50cnkgPSB7bmFtZTogcHJvcGVydHksIHZhbHVlLCBzb3VyY2VTcGFuLCBoYXNPdmVycmlkZUZsYWcsIHVuaXQ6IG51bGx9O1xuICAgIGlmIChpc01hcEJhc2VkKSB7XG4gICAgICB0aGlzLl9jbGFzc01hcElucHV0ID0gZW50cnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyA9IHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzIHx8IFtdKS5wdXNoKGVudHJ5KTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9jbGFzc2VzSW5kZXgsIHByb3BlcnR5KTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgIHRoaXMuaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgdGhlIGVsZW1lbnQncyBzdGF0aWMgc3R5bGUgc3RyaW5nIHZhbHVlIHRvIHRoZSBidWlsZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgdGhlIHN0eWxlIHN0cmluZyAoZS5nLiBgd2lkdGg6MTAwcHg7IGhlaWdodDoyMDBweDtgKVxuICAgKi9cbiAgcmVnaXN0ZXJTdHlsZUF0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcyA9IHBhcnNlU3R5bGUodmFsdWUpO1xuICAgIHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgZWxlbWVudCdzIHN0YXRpYyBjbGFzcyBzdHJpbmcgdmFsdWUgdG8gdGhlIGJ1aWxkZXIuXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgY2xhc3NOYW1lIHN0cmluZyAoZS5nLiBgZGlzYWJsZWQgZ29sZCB6b29tYClcbiAgICovXG4gIHJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgdGhpcy5faGFzSW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQXBwZW5kcyBhbGwgc3R5bGluZy1yZWxhdGVkIGV4cHJlc3Npb25zIHRvIHRoZSBwcm92aWRlZCBhdHRycyBhcnJheS5cbiAgICpcbiAgICogQHBhcmFtIGF0dHJzIGFuIGV4aXN0aW5nIGFycmF5IHdoZXJlIGVhY2ggb2YgdGhlIHN0eWxpbmcgZXhwcmVzc2lvbnNcbiAgICogd2lsbCBiZSBpbnNlcnRlZCBpbnRvLlxuICAgKi9cbiAgcG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJzOiBvLkV4cHJlc3Npb25bXSk6IHZvaWQge1xuICAgIC8vIFtDTEFTU19NQVJLRVIsICdmb28nLCAnYmFyJywgJ2JheicgLi4uXVxuICAgIGlmICh0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMubGVuZ3RoKSB7XG4gICAgICBhdHRycy5wdXNoKG8ubGl0ZXJhbChBdHRyaWJ1dGVNYXJrZXIuQ2xhc3NlcykpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwodGhpcy5faW5pdGlhbENsYXNzVmFsdWVzW2ldKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gW1NUWUxFX01BUktFUiwgJ3dpZHRoJywgJzIwMHB4JywgJ2hlaWdodCcsICcxMDBweCcsIC4uLl1cbiAgICBpZiAodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzLmxlbmd0aCkge1xuICAgICAgYXR0cnMucHVzaChvLmxpdGVyYWwoQXR0cmlidXRlTWFya2VyLlN0eWxlcykpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgYXR0cnMucHVzaChcbiAgICAgICAgICAgIG8ubGl0ZXJhbCh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXNbaV0pLCBvLmxpdGVyYWwodGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzW2kgKyAxXSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudEhvc3RBdHRyc2AuXG4gICAqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiBnZW5lcmF0aW9uIGNvZGUgYmVsb3cgaXMgdXNlZCBmb3IgcHJvZHVjaW5nIHRoZSBBT1Qgc3RhdGVtZW50IGNvZGUgd2hpY2ggaXNcbiAgICogcmVzcG9uc2libGUgZm9yIHJlZ2lzdGVyaW5nIGluaXRpYWwgc3R5bGVzICh3aXRoaW4gYSBkaXJlY3RpdmUgaG9zdEJpbmRpbmdzJyBjcmVhdGlvbiBibG9jayksXG4gICAqIGFzIHdlbGwgYXMgYW55IG9mIHRoZSBwcm92aWRlZCBhdHRyaWJ1dGUgdmFsdWVzLCB0byB0aGUgZGlyZWN0aXZlIGhvc3QgZWxlbWVudC5cbiAgICovXG4gIGJ1aWxkSG9zdEF0dHJzSW5zdHJ1Y3Rpb24oXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgYXR0cnM6IG8uRXhwcmVzc2lvbltdLFxuICAgICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwciAmJiAoYXR0cnMubGVuZ3RoIHx8IHRoaXMuX2hhc0luaXRpYWxWYWx1ZXMpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRIb3N0QXR0cnMsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAgIC8vIHBhcmFtcyA9PiBlbGVtZW50SG9zdEF0dHJzKGFnZXREaXJlY3RpdmVDb250ZXh0KCl0dHJzKVxuICAgICAgICAgIHRoaXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJzKTtcbiAgICAgICAgICBjb25zdCBhdHRyQXJyYXkgPSAhYXR0cnMuc29tZShhdHRyID0+IGF0dHIgaW5zdGFuY2VvZiBvLldyYXBwZWROb2RlRXhwcikgP1xuICAgICAgICAgICAgICBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoY29uc3RhbnRQb29sLCBhdHRycykgOlxuICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoYXR0cnMpO1xuICAgICAgICAgIHJldHVybiBbYXR0ckFycmF5XTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIGFuIGluc3RydWN0aW9uIHdpdGggYWxsIHRoZSBleHByZXNzaW9ucyBhbmQgcGFyYW1ldGVycyBmb3IgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICpcbiAgICogVGhlIGluc3RydWN0aW9uIGdlbmVyYXRpb24gY29kZSBiZWxvdyBpcyB1c2VkIGZvciBwcm9kdWNpbmcgdGhlIEFPVCBzdGF0ZW1lbnQgY29kZSB3aGljaCBpc1xuICAgKiByZXNwb25zaWJsZSBmb3IgcmVnaXN0ZXJpbmcgc3R5bGUvY2xhc3MgYmluZGluZ3MgdG8gYW4gZWxlbWVudC5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOlxuICAgICAgSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgY29uc3QgcmVmZXJlbmNlID0gdGhpcy5fZGlyZWN0aXZlRXhwciA/IFIzLmVsZW1lbnRIb3N0U3R5bGluZyA6IFIzLmVsZW1lbnRTdHlsaW5nO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90czogMCwgcmVmZXJlbmNlLFxuICAgICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICAgIC8vIGEgc3RyaW5nIGFycmF5IG9mIGV2ZXJ5IHN0eWxlLWJhc2VkIGJpbmRpbmdcbiAgICAgICAgICBjb25zdCBzdHlsZUJpbmRpbmdQcm9wcyA9XG4gICAgICAgICAgICAgIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID8gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMubWFwKGkgPT4gby5saXRlcmFsKGkubmFtZSkpIDogW107XG4gICAgICAgICAgLy8gYSBzdHJpbmcgYXJyYXkgb2YgZXZlcnkgY2xhc3MtYmFzZWQgYmluZGluZ1xuICAgICAgICAgIGNvbnN0IGNsYXNzQmluZGluZ05hbWVzID1cbiAgICAgICAgICAgICAgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPyB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cy5tYXAoaSA9PiBvLmxpdGVyYWwoaS5uYW1lKSkgOiBbXTtcblxuICAgICAgICAgIC8vIHRvIHNhbHZhZ2Ugc3BhY2UgaW4gdGhlIEFPVCBnZW5lcmF0ZWQgY29kZSwgdGhlcmUgaXMgbm8gcG9pbnQgaW4gcGFzc2luZ1xuICAgICAgICAgIC8vIGluIGBudWxsYCBpbnRvIGEgcGFyYW0gaWYgYW55IGZvbGxvdy11cCBwYXJhbXMgYXJlIG5vdCB1c2VkLiBUaGVyZWZvcmUsXG4gICAgICAgICAgLy8gb25seSB3aGVuIGEgdHJhaWxpbmcgcGFyYW0gaXMgdXNlZCB0aGVuIGl0IHdpbGwgYmUgZmlsbGVkIHdpdGggbnVsbHMgaW4gYmV0d2VlblxuICAgICAgICAgIC8vIChvdGhlcndpc2UgYSBzaG9ydGVyIGFtb3VudCBvZiBwYXJhbXMgd2lsbCBiZSBmaWxsZWQpLiBUaGUgY29kZSBiZWxvdyBoZWxwc1xuICAgICAgICAgIC8vIGRldGVybWluZSBob3cgbWFueSBwYXJhbXMgYXJlIHJlcXVpcmVkIGluIHRoZSBleHByZXNzaW9uIGNvZGUuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBIT1NUOlxuICAgICAgICAgIC8vICAgbWluIHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmcoKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmcoY2xhc3NCaW5kaW5ncywgc3R5bGVCaW5kaW5ncywgc2FuaXRpemVyKVxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gVGVtcGxhdGU6XG4gICAgICAgICAgLy8gICBtaW4gcGFyYW1zID0+IGVsZW1lbnRTdHlsaW5nKClcbiAgICAgICAgICAvLyAgIG1heCBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmcoY2xhc3NCaW5kaW5ncywgc3R5bGVCaW5kaW5ncywgc2FuaXRpemVyKVxuICAgICAgICAgIC8vXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgIGxldCBleHBlY3RlZE51bWJlck9mQXJncyA9IDA7XG4gICAgICAgICAgaWYgKHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0eWxlQmluZGluZ1Byb3BzLmxlbmd0aCkge1xuICAgICAgICAgICAgZXhwZWN0ZWROdW1iZXJPZkFyZ3MgPSAyO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NCaW5kaW5nTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDE7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgIHBhcmFtcywgY2xhc3NCaW5kaW5nTmFtZXMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgY2xhc3NCaW5kaW5nTmFtZXMpLCAxLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgIHBhcmFtcywgc3R5bGVCaW5kaW5nUHJvcHMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgZ2V0Q29uc3RhbnRMaXRlcmFsRnJvbUFycmF5KGNvbnN0YW50UG9vbCwgc3R5bGVCaW5kaW5nUHJvcHMpLCAyLFxuICAgICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgIHBhcmFtcywgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciwgby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplciksIDMsXG4gICAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzKTtcbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gaW5zdHJ1Y3Rpb24gd2l0aCBhbGwgdGhlIGV4cHJlc3Npb25zIGFuZCBwYXJhbWV0ZXJzIGZvciBgZWxlbWVudFN0eWxpbmdNYXBgLlxuICAgKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gZGF0YSB3aWxsIGNvbnRhaW4gYWxsIGV4cHJlc3Npb25zIGZvciBgZWxlbWVudFN0eWxpbmdNYXBgIHRvIGZ1bmN0aW9uXG4gICAqIHdoaWNoIGluY2x1ZGUgdGhlIGBbc3R5bGVdYCBhbmQgYFtjbGFzc11gIGV4cHJlc3Npb24gcGFyYW1zIChpZiB0aGV5IGV4aXN0KSBhcyB3ZWxsIGFzXG4gICAqIHRoZSBzYW5pdGl6ZXIgYW5kIGRpcmVjdGl2ZSByZWZlcmVuY2UgZXhwcmVzc2lvbi5cbiAgICovXG4gIGJ1aWxkRWxlbWVudFN0eWxpbmdNYXBJbnN0cnVjdGlvbih2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCB8fCB0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXQgPSB0aGlzLl9jbGFzc01hcElucHV0ICEgfHwgdGhpcy5fc3R5bGVNYXBJbnB1dCAhO1xuICAgICAgbGV0IHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgPSAwO1xuXG4gICAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgICAgLy8gYmUgZXZhbHV0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzVmFsdWUgPVxuICAgICAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPyB0aGlzLl9jbGFzc01hcElucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKSA6IG51bGw7XG4gICAgICBpZiAobWFwQmFzZWRDbGFzc1ZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9IG1hcEJhc2VkQ2xhc3NWYWx1ZS5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA/IHRoaXMuX3N0eWxlTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcbiAgICAgIGlmIChtYXBCYXNlZFN0eWxlVmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRvdGFsQmluZGluZ1Nsb3RzUmVxdWlyZWQgKz0gbWFwQmFzZWRTdHlsZVZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNIb3N0QmluZGluZyA9IHRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsaW5nTWFwIDogUjMuZWxlbWVudFN0eWxpbmdNYXA7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW46IHN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICByZWZlcmVuY2UsXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIC8vIEhPU1Q6XG4gICAgICAgICAgLy8gICBtaW4gcGFyYW1zID0+IGVsZW1lbnRIb3N0U3R5bGluZ01hcChjbGFzc01hcClcbiAgICAgICAgICAvLyAgIG1heCBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nTWFwKGNsYXNzTWFwLCBzdHlsZU1hcClcbiAgICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdNYXAoZWxtSW5kZXgsIGNsYXNzTWFwKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ01hcChlbG1JbmRleCwgY2xhc3NNYXAsIHN0eWxlTWFwKVxuXG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgIGlmICghaXNIb3N0QmluZGluZykge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZWxlbWVudEluZGV4RXhwcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMDtcbiAgICAgICAgICBpZiAobWFwQmFzZWRTdHlsZVZhbHVlKSB7XG4gICAgICAgICAgICBleHBlY3RlZE51bWJlck9mQXJncyA9IDI7XG4gICAgICAgICAgfSBlbHNlIGlmIChtYXBCYXNlZENsYXNzVmFsdWUpIHtcbiAgICAgICAgICAgIC8vIGluZGV4IGFuZCBjbGFzcyA9IDJcbiAgICAgICAgICAgIGV4cGVjdGVkTnVtYmVyT2ZBcmdzID0gMTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgcGFyYW1zLCBtYXBCYXNlZENsYXNzVmFsdWUsIG1hcEJhc2VkQ2xhc3NWYWx1ZSA/IGNvbnZlcnRGbihtYXBCYXNlZENsYXNzVmFsdWUpIDogbnVsbCxcbiAgICAgICAgICAgICAgMSwgZXhwZWN0ZWROdW1iZXJPZkFyZ3MpO1xuICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICBwYXJhbXMsIG1hcEJhc2VkU3R5bGVWYWx1ZSwgbWFwQmFzZWRTdHlsZVZhbHVlID8gY29udmVydEZuKG1hcEJhc2VkU3R5bGVWYWx1ZSkgOiBudWxsLFxuICAgICAgICAgICAgICAyLCBleHBlY3RlZE51bWJlck9mQXJncyk7XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNIb3N0QmluZGluZzogYm9vbGVhbiwgaW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdLFxuICAgICAgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sIGFsbG93VW5pdHM6IGJvb2xlYW4sXG4gICAgICB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBsZXQgdG90YWxCaW5kaW5nU2xvdHNSZXF1aXJlZCA9IDA7XG4gICAgcmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0luZGV4OiBudW1iZXIgPSBtYXBJbmRleC5nZXQoaW5wdXQubmFtZSAhKSAhO1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkICs9ICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMDtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiB0b3RhbEJpbmRpbmdTbG90c1JlcXVpcmVkLCByZWZlcmVuY2UsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nUHJvcChiaW5kaW5nSW5kZXgsIHZhbHVlKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50SG9zdFN0eWxpbmdQcm9wKGJpbmRpbmdJbmRleCwgdmFsdWUsIG92ZXJyaWRlRmxhZylcbiAgICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgICAvLyAgIG1pbiBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdQcm9wKGVsbUluZGV4LCBiaW5kaW5nSW5kZXgsIHZhbHVlKVxuICAgICAgICAgIC8vICAgbWF4IHBhcmFtcyA9PiBlbGVtZW50U3R5bGluZ1Byb3AoZWxtSW5kZXgsIGJpbmRpbmdJbmRleCwgdmFsdWUsIG92ZXJyaWRlRmxhZylcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAgICAgICBpZiAoIWlzSG9zdEJpbmRpbmcpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2VsZW1lbnRJbmRleEV4cHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChiaW5kaW5nSW5kZXgpKTtcbiAgICAgICAgICBwYXJhbXMucHVzaChjb252ZXJ0Rm4odmFsdWUpKTtcblxuICAgICAgICAgIGlmIChhbGxvd1VuaXRzKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaW5wdXQudW5pdCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5oYXNPdmVycmlkZUZsYWcpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpbnB1dC5oYXNPdmVycmlkZUZsYWcpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbCh0cnVlKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzKSB7XG4gICAgICBjb25zdCBpc0hvc3RCaW5kaW5nID0gISF0aGlzLl9kaXJlY3RpdmVFeHByO1xuICAgICAgY29uc3QgcmVmZXJlbmNlID0gaXNIb3N0QmluZGluZyA/IFIzLmVsZW1lbnRIb3N0Q2xhc3NQcm9wIDogUjMuZWxlbWVudENsYXNzUHJvcDtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICByZWZlcmVuY2UsIGlzSG9zdEJpbmRpbmcsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLFxuICAgICAgICAgIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMpIHtcbiAgICAgIGNvbnN0IGlzSG9zdEJpbmRpbmcgPSAhIXRoaXMuX2RpcmVjdGl2ZUV4cHI7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsZVByb3AgOiBSMy5lbGVtZW50U3R5bGVQcm9wO1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIHJlZmVyZW5jZSwgaXNIb3N0QmluZGluZywgdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMsIHRoaXMuX3N0eWxlc0luZGV4LCB0cnVlLFxuICAgICAgICAgIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRBcHBseUZuKCk6IEluc3RydWN0aW9uIHtcbiAgICBjb25zdCBpc0hvc3RCaW5kaW5nID0gdGhpcy5fZGlyZWN0aXZlRXhwcjtcbiAgICBjb25zdCByZWZlcmVuY2UgPSBpc0hvc3RCaW5kaW5nID8gUjMuZWxlbWVudEhvc3RTdHlsaW5nQXBwbHkgOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5O1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID8gdGhpcy5fbGFzdFN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuIDogbnVsbCxcbiAgICAgIHJlZmVyZW5jZSxcbiAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzOiAwLFxuICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgLy8gSE9TVDpcbiAgICAgICAgLy8gICBwYXJhbXMgPT4gZWxlbWVudEhvc3RTdHlsaW5nQXBwbHkoKVxuICAgICAgICAvLyBUZW1wbGF0ZTpcbiAgICAgICAgLy8gICBwYXJhbXMgPT4gZWxlbWVudFN0eWxpbmdBcHBseShlbG1JbmRleClcbiAgICAgICAgcmV0dXJuIGlzSG9zdEJpbmRpbmcgPyBbXSA6IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYWxsIGluc3RydWN0aW9ucyB3aGljaCBjb250YWluIHRoZSBleHByZXNzaW9ucyB0aGF0IHdpbGwgYmUgcGxhY2VkXG4gICAqIGludG8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIHRlbXBsYXRlIGZ1bmN0aW9uIG9yIGEgZGlyZWN0aXZlIGhvc3RCaW5kaW5ncyBmdW5jdGlvbi5cbiAgICovXG4gIGJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3MpIHtcbiAgICAgIGNvbnN0IG1hcEluc3RydWN0aW9uID0gdGhpcy5idWlsZEVsZW1lbnRTdHlsaW5nTWFwSW5zdHJ1Y3Rpb24odmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKG1hcEluc3RydWN0aW9uKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKG1hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKHRoaXMuX2J1aWxkQXBwbHlGbigpKTtcbiAgICB9XG4gICAgcmV0dXJuIGluc3RydWN0aW9ucztcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3RlckludG9NYXAobWFwOiBNYXA8c3RyaW5nLCBudW1iZXI+LCBrZXk6IHN0cmluZykge1xuICBpZiAoIW1hcC5oYXMoa2V5KSkge1xuICAgIG1hcC5zZXQoa2V5LCBtYXAuc2l6ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gcHJvcCA9PT0gJ2JhY2tncm91bmQtaW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kJyB8fCBwcm9wID09PSAnYm9yZGVyLWltYWdlJyB8fFxuICAgICAgcHJvcCA9PT0gJ2ZpbHRlcicgfHwgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUnIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlLWltYWdlJztcbn1cblxuLyoqXG4gKiBTaW1wbGUgaGVscGVyIGZ1bmN0aW9uIHRvIGVpdGhlciBwcm92aWRlIHRoZSBjb25zdGFudCBsaXRlcmFsIHRoYXQgd2lsbCBob3VzZSB0aGUgdmFsdWVcbiAqIGhlcmUgb3IgYSBudWxsIHZhbHVlIGlmIHRoZSBwcm92aWRlZCB2YWx1ZXMgYXJlIGVtcHR5LlxuICovXG5mdW5jdGlvbiBnZXRDb25zdGFudExpdGVyYWxGcm9tQXJyYXkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHZhbHVlczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gdmFsdWVzLmxlbmd0aCA/IGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHZhbHVlcyksIHRydWUpIDogby5OVUxMX0VYUFI7XG59XG5cbi8qKlxuICogU2ltcGxlIGhlbHBlciBmdW5jdGlvbiB0aGF0IGFkZHMgYSBwYXJhbWV0ZXIgb3IgZG9lcyBub3RoaW5nIGF0IGFsbCBkZXBlbmRpbmcgb24gdGhlIHByb3ZpZGVkXG4gKiBwcmVkaWNhdGUgYW5kIHRvdGFsRXhwZWN0ZWRBcmdzIHZhbHVlc1xuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdLCBwcmVkaWNhdGU6IGFueSwgdmFsdWU6IG8uRXhwcmVzc2lvbiB8IG51bGwsIGFyZ051bWJlcjogbnVtYmVyLFxuICAgIHRvdGFsRXhwZWN0ZWRBcmdzOiBudW1iZXIpIHtcbiAgaWYgKHByZWRpY2F0ZSAmJiB2YWx1ZSkge1xuICAgIHBhcmFtcy5wdXNoKHZhbHVlKTtcbiAgfSBlbHNlIGlmIChhcmdOdW1iZXIgPCB0b3RhbEV4cGVjdGVkQXJncykge1xuICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOlxuICAgIHtwcm9wZXJ0eTogc3RyaW5nLCB1bml0OiBzdHJpbmcsIGhhc092ZXJyaWRlRmxhZzogYm9vbGVhbn0ge1xuICBsZXQgaGFzT3ZlcnJpZGVGbGFnID0gZmFsc2U7XG4gIGNvbnN0IG92ZXJyaWRlSW5kZXggPSBuYW1lLmluZGV4T2YoSU1QT1JUQU5UX0ZMQUcpO1xuICBpZiAob3ZlcnJpZGVJbmRleCAhPT0gLTEpIHtcbiAgICBuYW1lID0gb3ZlcnJpZGVJbmRleCA+IDAgPyBuYW1lLnN1YnN0cmluZygwLCBvdmVycmlkZUluZGV4KSA6ICcnO1xuICAgIGhhc092ZXJyaWRlRmxhZyA9IHRydWU7XG4gIH1cblxuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHkgPSBuYW1lO1xuICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gIGlmICh1bml0SW5kZXggPiAwKSB7XG4gICAgdW5pdCA9IG5hbWUuc3Vic3RyKHVuaXRJbmRleCArIDEpO1xuICAgIHByb3BlcnR5ID0gbmFtZS5zdWJzdHJpbmcoMCwgdW5pdEluZGV4KTtcbiAgfVxuXG4gIHJldHVybiB7cHJvcGVydHksIHVuaXQsIGhhc092ZXJyaWRlRmxhZ307XG59XG4iXX0=