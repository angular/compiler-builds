(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/styling", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/style_parser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var style_parser_1 = require("@angular/compiler/src/render3/view/style_parser");
    /**
     * Produces creation/update instructions for all styling bindings (class and style)
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
            this.hasBindingsOrInitialValues = false;
            this._classMapInput = null;
            this._styleMapInput = null;
            this._singleStyleInputs = null;
            this._singleClassInputs = null;
            this._lastStylingInput = null;
            // maps are used instead of hash maps because a Map will
            // retain the ordering of the keys
            this._stylesIndex = new Map();
            this._classesIndex = new Map();
            this._initialStyleValues = {};
            this._initialClassValues = {};
            this._useDefaultSanitizer = false;
            this._applyFnRequired = false;
        }
        StylingBuilder.prototype.registerBoundInput = function (input) {
            // [attr.style] or [attr.class] are skipped in the code below,
            // they should not be treated as styling-based bindings since
            // they are intended to be written directly to the attr and
            // will therefore skip all style/class resolution that is present
            // with style="", [style]="" and [style.prop]="", class="",
            // [class.prop]="". [class]="" assignments
            var name = input.name;
            var binding = null;
            switch (input.type) {
                case 0 /* Property */:
                    if (name == 'style') {
                        binding = this.registerStyleInput(null, input.value, '', input.sourceSpan);
                    }
                    else if (isClassBinding(input.name)) {
                        binding = this.registerClassInput(null, input.value, input.sourceSpan);
                    }
                    break;
                case 3 /* Style */:
                    binding = this.registerStyleInput(input.name, input.value, input.unit, input.sourceSpan);
                    break;
                case 2 /* Class */:
                    binding = this.registerClassInput(input.name, input.value, input.sourceSpan);
                    break;
            }
            return binding ? true : false;
        };
        StylingBuilder.prototype.registerStyleInput = function (propertyName, value, unit, sourceSpan) {
            var entry = { name: propertyName, unit: unit, value: value, sourceSpan: sourceSpan };
            if (propertyName) {
                (this._singleStyleInputs = this._singleStyleInputs || []).push(entry);
                this._useDefaultSanitizer = this._useDefaultSanitizer || isStyleSanitizable(propertyName);
                registerIntoMap(this._stylesIndex, propertyName);
                this.hasBindingsOrInitialValues = true;
            }
            else {
                this._useDefaultSanitizer = true;
                this._styleMapInput = entry;
            }
            this._lastStylingInput = entry;
            this.hasBindingsOrInitialValues = true;
            this._applyFnRequired = true;
            return entry;
        };
        StylingBuilder.prototype.registerClassInput = function (className, value, sourceSpan) {
            var entry = { name: className, value: value, sourceSpan: sourceSpan };
            if (className) {
                (this._singleClassInputs = this._singleClassInputs || []).push(entry);
                this.hasBindingsOrInitialValues = true;
                registerIntoMap(this._classesIndex, className);
            }
            else {
                this._classMapInput = entry;
            }
            this._lastStylingInput = entry;
            this.hasBindingsOrInitialValues = true;
            this._applyFnRequired = true;
            return entry;
        };
        StylingBuilder.prototype.registerStyleAttr = function (value) {
            var _this = this;
            this._initialStyleValues = style_parser_1.parse(value);
            Object.keys(this._initialStyleValues).forEach(function (prop) {
                registerIntoMap(_this._stylesIndex, prop);
                _this.hasBindingsOrInitialValues = true;
            });
        };
        StylingBuilder.prototype.registerClassAttr = function (value) {
            var _this = this;
            this._initialClassValues = {};
            value.split(/\s+/g).forEach(function (className) {
                _this._initialClassValues[className] = true;
                registerIntoMap(_this._classesIndex, className);
                _this.hasBindingsOrInitialValues = true;
            });
        };
        StylingBuilder.prototype._buildInitExpr = function (registry, initialValues) {
            var exprs = [];
            var nameAndValueExprs = [];
            // _c0 = [prop, prop2, prop3, ...]
            registry.forEach(function (value, key) {
                var keyLiteral = o.literal(key);
                exprs.push(keyLiteral);
                var initialValue = initialValues[key];
                if (initialValue) {
                    nameAndValueExprs.push(keyLiteral, o.literal(initialValue));
                }
            });
            if (nameAndValueExprs.length) {
                // _c0 = [... MARKER ...]
                exprs.push(o.literal(1 /* VALUES_MODE */));
                // _c0 = [prop, VALUE, prop2, VALUE2, ...]
                exprs.push.apply(exprs, tslib_1.__spread(nameAndValueExprs));
            }
            return exprs.length ? o.literalArr(exprs) : null;
        };
        StylingBuilder.prototype.buildCreateLevelInstruction = function (sourceSpan, constantPool) {
            if (this.hasBindingsOrInitialValues) {
                var initialClasses = this._buildInitExpr(this._classesIndex, this._initialClassValues);
                var initialStyles = this._buildInitExpr(this._stylesIndex, this._initialStyleValues);
                // in the event that a [style] binding is used then sanitization will
                // always be imported because it is not possible to know ahead of time
                // whether style bindings will use or not use any sanitizable properties
                // that isStyleSanitizable() will detect
                var useSanitizer = this._useDefaultSanitizer;
                var params_1 = [];
                if (initialClasses) {
                    // the template compiler handles initial class styling (e.g. class="foo") values
                    // in a special command called `elementClass` so that the initial class
                    // can be processed during runtime. These initial class values are bound to
                    // a constant because the inital class values do not change (since they're static).
                    params_1.push(constantPool.getConstLiteral(initialClasses, true));
                }
                else if (initialStyles || useSanitizer) {
                    // no point in having an extra `null` value unless there are follow-up params
                    params_1.push(o.NULL_EXPR);
                }
                if (initialStyles) {
                    // the template compiler handles initial style (e.g. style="foo") values
                    // in a special command called `elementStyle` so that the initial styles
                    // can be processed during runtime. These initial styles values are bound to
                    // a constant because the inital style values do not change (since they're static).
                    params_1.push(constantPool.getConstLiteral(initialStyles, true));
                }
                else if (useSanitizer || this._directiveExpr) {
                    // no point in having an extra `null` value unless there are follow-up params
                    params_1.push(o.NULL_EXPR);
                }
                if (useSanitizer || this._directiveExpr) {
                    params_1.push(useSanitizer ? o.importExpr(r3_identifiers_1.Identifiers.defaultStyleSanitizer) : o.NULL_EXPR);
                    if (this._directiveExpr) {
                        params_1.push(this._directiveExpr);
                    }
                }
                return { sourceSpan: sourceSpan, reference: r3_identifiers_1.Identifiers.elementStyling, buildParams: function () { return params_1; } };
            }
            return null;
        };
        StylingBuilder.prototype._buildStylingMap = function (valueConverter) {
            var _this = this;
            if (this._classMapInput || this._styleMapInput) {
                var stylingInput = this._classMapInput || this._styleMapInput;
                // these values must be outside of the update block so that they can
                // be evaluted (the AST visit call) during creation time so that any
                // pipes can be picked up in time before the template is built
                var mapBasedClassValue_1 = this._classMapInput ? this._classMapInput.value.visit(valueConverter) : null;
                var mapBasedStyleValue_1 = this._styleMapInput ? this._styleMapInput.value.visit(valueConverter) : null;
                return {
                    sourceSpan: stylingInput.sourceSpan,
                    reference: r3_identifiers_1.Identifiers.elementStylingMap,
                    buildParams: function (convertFn) {
                        var params = [_this._elementIndexExpr];
                        if (mapBasedClassValue_1) {
                            params.push(convertFn(mapBasedClassValue_1));
                        }
                        else if (_this._styleMapInput) {
                            params.push(o.NULL_EXPR);
                        }
                        if (mapBasedStyleValue_1) {
                            params.push(convertFn(mapBasedStyleValue_1));
                        }
                        else if (_this._directiveExpr) {
                            params.push(o.NULL_EXPR);
                        }
                        if (_this._directiveExpr) {
                            params.push(_this._directiveExpr);
                        }
                        return params;
                    }
                };
            }
            return null;
        };
        StylingBuilder.prototype._buildSingleInputs = function (reference, inputs, mapIndex, allowUnits, valueConverter) {
            var _this = this;
            return inputs.map(function (input) {
                var bindingIndex = mapIndex.get(input.name);
                var value = input.value.visit(valueConverter);
                return {
                    sourceSpan: input.sourceSpan,
                    reference: reference,
                    buildParams: function (convertFn) {
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
                        return params;
                    }
                };
            });
        };
        StylingBuilder.prototype._buildClassInputs = function (valueConverter) {
            if (this._singleClassInputs) {
                return this._buildSingleInputs(r3_identifiers_1.Identifiers.elementClassProp, this._singleClassInputs, this._classesIndex, false, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
            if (this._singleStyleInputs) {
                return this._buildSingleInputs(r3_identifiers_1.Identifiers.elementStyleProp, this._singleStyleInputs, this._stylesIndex, true, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildApplyFn = function () {
            var _this = this;
            return {
                sourceSpan: this._lastStylingInput ? this._lastStylingInput.sourceSpan : null,
                reference: r3_identifiers_1.Identifiers.elementStylingApply,
                buildParams: function () {
                    var params = [_this._elementIndexExpr];
                    if (_this._directiveExpr) {
                        params.push(_this._directiveExpr);
                    }
                    return params;
                }
            };
        };
        StylingBuilder.prototype.buildUpdateLevelInstructions = function (valueConverter) {
            var instructions = [];
            if (this.hasBindingsOrInitialValues) {
                var mapInstruction = this._buildStylingMap(valueConverter);
                if (mapInstruction) {
                    instructions.push(mapInstruction);
                }
                instructions.push.apply(instructions, tslib_1.__spread(this._buildStyleInputs(valueConverter)));
                instructions.push.apply(instructions, tslib_1.__spread(this._buildClassInputs(valueConverter)));
                if (this._applyFnRequired) {
                    instructions.push(this._buildApplyFn());
                }
            }
            return instructions;
        };
        return StylingBuilder;
    }());
    exports.StylingBuilder = StylingBuilder;
    function isClassBinding(name) {
        return name == 'className' || name == 'class';
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvc3R5bGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFVQSwyREFBNkM7SUFHN0MsK0VBQW9EO0lBRXBELGdGQUFtRDtJQXdCbkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQXdCRztJQUNIO1FBa0JFLHdCQUFvQixpQkFBK0IsRUFBVSxjQUFpQztZQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7WUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7WUFqQjlFLCtCQUEwQixHQUFHLEtBQUssQ0FBQztZQUUzQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7WUFDOUMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1lBQzlDLHVCQUFrQixHQUE2QixJQUFJLENBQUM7WUFDcEQsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztZQUNwRCxzQkFBaUIsR0FBMkIsSUFBSSxDQUFDO1lBRXpELHdEQUF3RDtZQUN4RCxrQ0FBa0M7WUFDMUIsaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztZQUN6QyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1lBQzFDLHdCQUFtQixHQUFpQyxFQUFFLENBQUM7WUFDdkQsd0JBQW1CLEdBQW1DLEVBQUUsQ0FBQztZQUN6RCx5QkFBb0IsR0FBRyxLQUFLLENBQUM7WUFDN0IscUJBQWdCLEdBQUcsS0FBSyxDQUFDO1FBRWdFLENBQUM7UUFFbEcsMkNBQWtCLEdBQWxCLFVBQW1CLEtBQXVCO1lBQ3hDLDhEQUE4RDtZQUM5RCw2REFBNkQ7WUFDN0QsMkRBQTJEO1lBQzNELGlFQUFpRTtZQUNqRSwyREFBMkQ7WUFDM0QsMENBQTBDO1lBQzFDLElBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDeEIsSUFBSSxPQUFPLEdBQTJCLElBQUksQ0FBQztZQUMzQyxRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUU7Z0JBQ2xCO29CQUNFLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTt3QkFDbkIsT0FBTyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO3FCQUM1RTt5QkFBTSxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ3JDLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO3FCQUN4RTtvQkFDRCxNQUFNO2dCQUNSO29CQUNFLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUN6RixNQUFNO2dCQUNSO29CQUNFLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDN0UsTUFBTTthQUNUO1lBQ0QsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ2hDLENBQUM7UUFFRCwyQ0FBa0IsR0FBbEIsVUFDSSxZQUF5QixFQUFFLEtBQVUsRUFBRSxJQUFpQixFQUN4RCxVQUEyQjtZQUM3QixJQUFNLEtBQUssR0FBRyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxNQUFBLEVBQUUsS0FBSyxPQUFBLEVBQUUsVUFBVSxZQUFBLEVBQXVCLENBQUM7WUFDbkYsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLENBQUMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUMsb0JBQW9CLElBQUksa0JBQWtCLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQzFGLGVBQWUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUNoRCxJQUFZLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDO2FBQ2pEO2lCQUFNO2dCQUNMLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO2FBQzdCO1lBQ0QsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQztZQUM5QixJQUFZLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDO1lBQ2hELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7WUFDN0IsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRUQsMkNBQWtCLEdBQWxCLFVBQW1CLFNBQXNCLEVBQUUsS0FBVSxFQUFFLFVBQTJCO1lBRWhGLElBQU0sS0FBSyxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLE9BQUEsRUFBRSxVQUFVLFlBQUEsRUFBdUIsQ0FBQztZQUMxRSxJQUFJLFNBQVMsRUFBRTtnQkFDYixDQUFDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNyRSxJQUFZLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDO2dCQUNoRCxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsQ0FBQzthQUNoRDtpQkFBTTtnQkFDTCxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQzthQUM3QjtZQUNELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUM7WUFDOUIsSUFBWSxDQUFDLDBCQUEwQixHQUFHLElBQUksQ0FBQztZQUNoRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO1lBQzdCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVELDBDQUFpQixHQUFqQixVQUFrQixLQUFhO1lBQS9CLGlCQU1DO1lBTEMsSUFBSSxDQUFDLG1CQUFtQixHQUFHLG9CQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDN0MsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO2dCQUNoRCxlQUFlLENBQUMsS0FBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDeEMsS0FBWSxDQUFDLDBCQUEwQixHQUFHLElBQUksQ0FBQztZQUNsRCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCwwQ0FBaUIsR0FBakIsVUFBa0IsS0FBYTtZQUEvQixpQkFPQztZQU5DLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxFQUFFLENBQUM7WUFDOUIsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxTQUFTO2dCQUNuQyxLQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUMzQyxlQUFlLENBQUMsS0FBSSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDOUMsS0FBWSxDQUFDLDBCQUEwQixHQUFHLElBQUksQ0FBQztZQUNsRCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFTyx1Q0FBYyxHQUF0QixVQUF1QixRQUE2QixFQUFFLGFBQW1DO1lBRXZGLElBQU0sS0FBSyxHQUFtQixFQUFFLENBQUM7WUFDakMsSUFBTSxpQkFBaUIsR0FBbUIsRUFBRSxDQUFDO1lBRTdDLGtDQUFrQztZQUNsQyxRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBSyxFQUFFLEdBQUc7Z0JBQzFCLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3ZCLElBQU0sWUFBWSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDeEMsSUFBSSxZQUFZLEVBQUU7b0JBQ2hCLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2lCQUM3RDtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUU7Z0JBQzVCLHlCQUF5QjtnQkFDekIsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxxQkFBaUMsQ0FBQyxDQUFDO2dCQUN2RCwwQ0FBMEM7Z0JBQzFDLEtBQUssQ0FBQyxJQUFJLE9BQVYsS0FBSyxtQkFBUyxpQkFBaUIsR0FBRTthQUNsQztZQUVELE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ25ELENBQUM7UUFFRCxvREFBMkIsR0FBM0IsVUFBNEIsVUFBZ0MsRUFBRSxZQUEwQjtZQUV0RixJQUFJLElBQUksQ0FBQywwQkFBMEIsRUFBRTtnQkFDbkMsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUN6RixJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBRXZGLHFFQUFxRTtnQkFDckUsc0VBQXNFO2dCQUN0RSx3RUFBd0U7Z0JBQ3hFLHdDQUF3QztnQkFDeEMsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDO2dCQUMvQyxJQUFNLFFBQU0sR0FBcUIsRUFBRSxDQUFDO2dCQUVwQyxJQUFJLGNBQWMsRUFBRTtvQkFDbEIsZ0ZBQWdGO29CQUNoRix1RUFBdUU7b0JBQ3ZFLDJFQUEyRTtvQkFDM0UsbUZBQW1GO29CQUNuRixRQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQ2pFO3FCQUFNLElBQUksYUFBYSxJQUFJLFlBQVksRUFBRTtvQkFDeEMsNkVBQTZFO29CQUM3RSxRQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDMUI7Z0JBRUQsSUFBSSxhQUFhLEVBQUU7b0JBQ2pCLHdFQUF3RTtvQkFDeEUsd0VBQXdFO29CQUN4RSw0RUFBNEU7b0JBQzVFLG1GQUFtRjtvQkFDbkYsUUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUNoRTtxQkFBTSxJQUFJLFlBQVksSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO29CQUM5Qyw2RUFBNkU7b0JBQzdFLFFBQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2lCQUMxQjtnQkFFRCxJQUFJLFlBQVksSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO29CQUN2QyxRQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDakYsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO3dCQUN2QixRQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztxQkFDbEM7aUJBQ0Y7Z0JBRUQsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLFNBQVMsRUFBRSw0QkFBRSxDQUFDLGNBQWMsRUFBRSxXQUFXLEVBQUUsY0FBTSxPQUFBLFFBQU0sRUFBTixDQUFNLEVBQUMsQ0FBQzthQUM5RTtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVPLHlDQUFnQixHQUF4QixVQUF5QixjQUE4QjtZQUF2RCxpQkF1Q0M7WUF0Q0MsSUFBSSxJQUFJLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUU7Z0JBQzlDLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxjQUFnQixJQUFJLElBQUksQ0FBQyxjQUFnQixDQUFDO2dCQUVwRSxvRUFBb0U7Z0JBQ3BFLG9FQUFvRTtnQkFDcEUsOERBQThEO2dCQUM5RCxJQUFNLG9CQUFrQixHQUNwQixJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDakYsSUFBTSxvQkFBa0IsR0FDcEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7Z0JBRWpGLE9BQU87b0JBQ0wsVUFBVSxFQUFFLFlBQVksQ0FBQyxVQUFVO29CQUNuQyxTQUFTLEVBQUUsNEJBQUUsQ0FBQyxpQkFBaUI7b0JBQy9CLFdBQVcsRUFBRSxVQUFDLFNBQXVDO3dCQUNuRCxJQUFNLE1BQU0sR0FBbUIsQ0FBQyxLQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQzt3QkFFeEQsSUFBSSxvQkFBa0IsRUFBRTs0QkFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQWtCLENBQUMsQ0FBQyxDQUFDO3lCQUM1Qzs2QkFBTSxJQUFJLEtBQUksQ0FBQyxjQUFjLEVBQUU7NEJBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3lCQUMxQjt3QkFFRCxJQUFJLG9CQUFrQixFQUFFOzRCQUN0QixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBa0IsQ0FBQyxDQUFDLENBQUM7eUJBQzVDOzZCQUFNLElBQUksS0FBSSxDQUFDLGNBQWMsRUFBRTs0QkFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7eUJBQzFCO3dCQUVELElBQUksS0FBSSxDQUFDLGNBQWMsRUFBRTs0QkFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7eUJBQ2xDO3dCQUVELE9BQU8sTUFBTSxDQUFDO29CQUNoQixDQUFDO2lCQUNGLENBQUM7YUFDSDtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVPLDJDQUFrQixHQUExQixVQUNJLFNBQThCLEVBQUUsTUFBMkIsRUFBRSxRQUE2QixFQUMxRixVQUFtQixFQUFFLGNBQThCO1lBRnZELGlCQTBCQztZQXZCQyxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLO2dCQUNyQixJQUFNLFlBQVksR0FBVyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUcsQ0FBQztnQkFDeEQsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2hELE9BQU87b0JBQ0wsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO29CQUM1QixTQUFTLFdBQUE7b0JBQ1QsV0FBVyxFQUFFLFVBQUMsU0FBdUM7d0JBQ25ELElBQU0sTUFBTSxHQUFHLENBQUMsS0FBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7d0JBQ25GLElBQUksVUFBVSxFQUFFOzRCQUNkLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtnQ0FDZCxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7NkJBQ3BDO2lDQUFNLElBQUksS0FBSSxDQUFDLGNBQWMsRUFBRTtnQ0FDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7NkJBQzFCO3lCQUNGO3dCQUVELElBQUksS0FBSSxDQUFDLGNBQWMsRUFBRTs0QkFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7eUJBQ2xDO3dCQUNELE9BQU8sTUFBTSxDQUFDO29CQUNoQixDQUFDO2lCQUNGLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFTywwQ0FBaUIsR0FBekIsVUFBMEIsY0FBOEI7WUFDdEQsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUU7Z0JBQzNCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUMxQiw0QkFBRSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxjQUFjLENBQUMsQ0FBQzthQUM5RjtZQUNELE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVPLDBDQUFpQixHQUF6QixVQUEwQixjQUE4QjtZQUN0RCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQkFDM0IsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQzFCLDRCQUFFLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO2FBQzVGO1lBQ0QsT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDO1FBRU8sc0NBQWEsR0FBckI7WUFBQSxpQkFZQztZQVhDLE9BQU87Z0JBQ0wsVUFBVSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSTtnQkFDN0UsU0FBUyxFQUFFLDRCQUFFLENBQUMsbUJBQW1CO2dCQUNqQyxXQUFXLEVBQUU7b0JBQ1gsSUFBTSxNQUFNLEdBQW1CLENBQUMsS0FBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7b0JBQ3hELElBQUksS0FBSSxDQUFDLGNBQWMsRUFBRTt3QkFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7cUJBQ2xDO29CQUNELE9BQU8sTUFBTSxDQUFDO2dCQUNoQixDQUFDO2FBQ0YsQ0FBQztRQUNKLENBQUM7UUFFRCxxREFBNEIsR0FBNUIsVUFBNkIsY0FBOEI7WUFDekQsSUFBTSxZQUFZLEdBQXlCLEVBQUUsQ0FBQztZQUM5QyxJQUFJLElBQUksQ0FBQywwQkFBMEIsRUFBRTtnQkFDbkMsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLGNBQWMsRUFBRTtvQkFDbEIsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztpQkFDbkM7Z0JBQ0QsWUFBWSxDQUFDLElBQUksT0FBakIsWUFBWSxtQkFBUyxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDLEdBQUU7Z0JBQzdELFlBQVksQ0FBQyxJQUFJLE9BQWpCLFlBQVksbUJBQVMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxHQUFFO2dCQUM3RCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtvQkFDekIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztpQkFDekM7YUFDRjtZQUNELE9BQU8sWUFBWSxDQUFDO1FBQ3RCLENBQUM7UUFDSCxxQkFBQztJQUFELENBQUMsQUE3UkQsSUE2UkM7SUE3Ulksd0NBQWM7SUErUjNCLFNBQVMsY0FBYyxDQUFDLElBQVk7UUFDbEMsT0FBTyxJQUFJLElBQUksV0FBVyxJQUFJLElBQUksSUFBSSxPQUFPLENBQUM7SUFDaEQsQ0FBQztJQUVELFNBQVMsZUFBZSxDQUFDLEdBQXdCLEVBQUUsR0FBVztRQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNqQixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7SUFDSCxDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFZO1FBQ3RDLE9BQU8sSUFBSSxLQUFLLGtCQUFrQixJQUFJLElBQUksS0FBSyxZQUFZLElBQUksSUFBSSxLQUFLLGNBQWM7WUFDbEYsSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLEtBQUssWUFBWSxJQUFJLElBQUksS0FBSyxrQkFBa0IsQ0FBQztJQUNoRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtJbml0aWFsU3R5bGluZ0ZsYWdzfSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBCaW5kaW5nVHlwZSwgUGFyc2VTcGFufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7cGFyc2UgYXMgcGFyc2VTdHlsZX0gZnJvbSAnLi9zdHlsZV9wYXJzZXInO1xuaW1wb3J0IHtWYWx1ZUNvbnZlcnRlcn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5cblxuLyoqXG4gKiBBIHN0eWxpbmcgZXhwcmVzc2lvbiBzdW1tYXJ5IHRoYXQgaXMgdG8gYmUgcHJvY2Vzc2VkIGJ5IHRoZSBjb21waWxlclxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0eWxpbmdJbnN0cnVjdGlvbiB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIGJ1aWxkUGFyYW1zKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbltdO1xufVxuXG4vKipcbiAqIEFuIGludGVybmFsIHJlY29yZCBvZiB0aGUgaW5wdXQgZGF0YSBmb3IgYSBzdHlsaW5nIGJpbmRpbmdcbiAqL1xuaW50ZXJmYWNlIEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgbmFtZTogc3RyaW5nO1xuICB1bml0OiBzdHJpbmd8bnVsbDtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICB2YWx1ZTogQVNUO1xufVxuXG5cbi8qKlxuICogUHJvZHVjZXMgY3JlYXRpb24vdXBkYXRlIGluc3RydWN0aW9ucyBmb3IgYWxsIHN0eWxpbmcgYmluZGluZ3MgKGNsYXNzIGFuZCBzdHlsZSlcbiAqXG4gKiBUaGUgYnVpbGRlciBjbGFzcyBiZWxvdyBoYW5kbGVzIHByb2R1Y2luZyBpbnN0cnVjdGlvbnMgZm9yIHRoZSBmb2xsb3dpbmcgY2FzZXM6XG4gKlxuICogLSBTdGF0aWMgc3R5bGUvY2xhc3MgYXR0cmlidXRlcyAoc3R5bGU9XCIuLi5cIiBhbmQgY2xhc3M9XCIuLi5cIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBtYXAgYmluZGluZ3MgKFtzdHlsZV09XCJtYXBcIiBhbmQgW2NsYXNzXT1cIm1hcHxzdHJpbmdcIilcbiAqIC0gRHluYW1pYyBzdHlsZS9jbGFzcyBwcm9wZXJ0eSBiaW5kaW5ncyAoW3N0eWxlLnByb3BdPVwiZXhwXCIgYW5kIFtjbGFzcy5uYW1lXT1cImV4cFwiKVxuICpcbiAqIER1ZSB0byB0aGUgY29tcGxleCByZWxhdGlvbnNoaXAgb2YgYWxsIG9mIHRoZXNlIGNhc2VzLCB0aGUgaW5zdHJ1Y3Rpb25zIGdlbmVyYXRlZFxuICogZm9yIHRoZXNlIGF0dHJpYnV0ZXMvcHJvcGVydGllcy9iaW5kaW5ncyBtdXN0IGJlIGRvbmUgc28gaW4gdGhlIGNvcnJlY3Qgb3JkZXIuIFRoZVxuICogb3JkZXIgd2hpY2ggdGhlc2UgbXVzdCBiZSBnZW5lcmF0ZWQgaXMgYXMgZm9sbG93czpcbiAqXG4gKiBpZiAoY3JlYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGluZyguLi4pXG4gKiB9XG4gKiBpZiAodXBkYXRlTW9kZSkge1xuICogICBlbGVtZW50U3R5bGluZ01hcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsZVByb3AoLi4uKVxuICogICBlbGVtZW50Q2xhc3NQcm9wKC4uLilcbiAqICAgZWxlbWVudFN0eWxpbmdBcHAoLi4uKVxuICogfVxuICpcbiAqIFRoZSBjcmVhdGlvbi91cGRhdGUgbWV0aG9kcyB3aXRoaW4gdGhlIGJ1aWxkZXIgY2xhc3MgcHJvZHVjZSB0aGVzZSBpbnN0cnVjdGlvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHlsaW5nQnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBoYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX2NsYXNzTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9zdHlsZU1hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfc2luZ2xlU3R5bGVJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3NpbmdsZUNsYXNzSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9sYXN0U3R5bGluZ0lucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcblxuICAvLyBtYXBzIGFyZSB1c2VkIGluc3RlYWQgb2YgaGFzaCBtYXBzIGJlY2F1c2UgYSBNYXAgd2lsbFxuICAvLyByZXRhaW4gdGhlIG9yZGVyaW5nIG9mIHRoZSBrZXlzXG4gIHByaXZhdGUgX3N0eWxlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgcHJpdmF0ZSBfY2xhc3Nlc0luZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgcHJpdmF0ZSBfaW5pdGlhbFN0eWxlVmFsdWVzOiB7W3Byb3BOYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIHByaXZhdGUgX2luaXRpYWxDbGFzc1ZhbHVlczoge1tjbGFzc05hbWU6IHN0cmluZ106IGJvb2xlYW59ID0ge307XG4gIHByaXZhdGUgX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSBmYWxzZTtcbiAgcHJpdmF0ZSBfYXBwbHlGblJlcXVpcmVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZWxlbWVudEluZGV4RXhwcjogby5FeHByZXNzaW9uLCBwcml2YXRlIF9kaXJlY3RpdmVFeHByOiBvLkV4cHJlc3Npb258bnVsbCkge31cblxuICByZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIGFyZSBza2lwcGVkIGluIHRoZSBjb2RlIGJlbG93LFxuICAgIC8vIHRoZXkgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIHN0eWxpbmctYmFzZWQgYmluZGluZ3Mgc2luY2VcbiAgICAvLyB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyIGFuZFxuICAgIC8vIHdpbGwgdGhlcmVmb3JlIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgLy8gd2l0aCBzdHlsZT1cIlwiLCBbc3R5bGVdPVwiXCIgYW5kIFtzdHlsZS5wcm9wXT1cIlwiLCBjbGFzcz1cIlwiLFxuICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICBjb25zdCBuYW1lID0gaW5wdXQubmFtZTtcbiAgICBsZXQgYmluZGluZzogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gICAgc3dpdGNoIChpbnB1dC50eXBlKSB7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICBpZiAobmFtZSA9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KG51bGwsIGlucHV0LnZhbHVlLCAnJywgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNDbGFzc0JpbmRpbmcoaW5wdXQubmFtZSkpIHtcbiAgICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQobnVsbCwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJTdHlsZUlucHV0KGlucHV0Lm5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC51bml0LCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlckNsYXNzSW5wdXQoaW5wdXQubmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmcgPyB0cnVlIDogZmFsc2U7XG4gIH1cblxuICByZWdpc3RlclN0eWxlSW5wdXQoXG4gICAgICBwcm9wZXJ0eU5hbWU6IHN0cmluZ3xudWxsLCB2YWx1ZTogQVNULCB1bml0OiBzdHJpbmd8bnVsbCxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgICBjb25zdCBlbnRyeSA9IHsgbmFtZTogcHJvcGVydHlOYW1lLCB1bml0LCB2YWx1ZSwgc291cmNlU3BhbiB9IGFzIEJvdW5kU3R5bGluZ0VudHJ5O1xuICAgIGlmIChwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyA9IHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzIHx8IFtdKS5wdXNoKGVudHJ5KTtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyIHx8IGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wZXJ0eU5hbWUpO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wZXJ0eU5hbWUpO1xuICAgICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0cnVlO1xuICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgdGhpcy5fYXBwbHlGblJlcXVpcmVkID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICByZWdpc3RlckNsYXNzSW5wdXQoY2xhc3NOYW1lOiBzdHJpbmd8bnVsbCwgdmFsdWU6IEFTVCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTpcbiAgICAgIEJvdW5kU3R5bGluZ0VudHJ5IHtcbiAgICBjb25zdCBlbnRyeSA9IHsgbmFtZTogY2xhc3NOYW1lLCB2YWx1ZSwgc291cmNlU3BhbiB9IGFzIEJvdW5kU3R5bGluZ0VudHJ5O1xuICAgIGlmIChjbGFzc05hbWUpIHtcbiAgICAgICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyA9IHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzIHx8IFtdKS5wdXNoKGVudHJ5KTtcbiAgICAgICh0aGlzIGFzIGFueSkuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX2NsYXNzZXNJbmRleCwgY2xhc3NOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA9IGVudHJ5O1xuICAgIH1cbiAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gZW50cnk7XG4gICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgdGhpcy5fYXBwbHlGblJlcXVpcmVkID0gdHJ1ZTtcbiAgICByZXR1cm4gZW50cnk7XG4gIH1cblxuICByZWdpc3RlclN0eWxlQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzID0gcGFyc2VTdHlsZSh2YWx1ZSk7XG4gICAgT2JqZWN0LmtleXModGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX3N0eWxlc0luZGV4LCBwcm9wKTtcbiAgICAgICh0aGlzIGFzIGFueSkuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJDbGFzc0F0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcyA9IHt9O1xuICAgIHZhbHVlLnNwbGl0KC9cXHMrL2cpLmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgIHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlc1tjbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9jbGFzc2VzSW5kZXgsIGNsYXNzTmFtZSk7XG4gICAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkSW5pdEV4cHIocmVnaXN0cnk6IE1hcDxzdHJpbmcsIG51bWJlcj4sIGluaXRpYWxWYWx1ZXM6IHtba2V5OiBzdHJpbmddOiBhbnl9KTpcbiAgICAgIG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBjb25zdCBleHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBuYW1lQW5kVmFsdWVFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIC8vIF9jMCA9IFtwcm9wLCBwcm9wMiwgcHJvcDMsIC4uLl1cbiAgICByZWdpc3RyeS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICBjb25zdCBrZXlMaXRlcmFsID0gby5saXRlcmFsKGtleSk7XG4gICAgICBleHBycy5wdXNoKGtleUxpdGVyYWwpO1xuICAgICAgY29uc3QgaW5pdGlhbFZhbHVlID0gaW5pdGlhbFZhbHVlc1trZXldO1xuICAgICAgaWYgKGluaXRpYWxWYWx1ZSkge1xuICAgICAgICBuYW1lQW5kVmFsdWVFeHBycy5wdXNoKGtleUxpdGVyYWwsIG8ubGl0ZXJhbChpbml0aWFsVmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuYW1lQW5kVmFsdWVFeHBycy5sZW5ndGgpIHtcbiAgICAgIC8vIF9jMCA9IFsuLi4gTUFSS0VSIC4uLl1cbiAgICAgIGV4cHJzLnB1c2goby5saXRlcmFsKEluaXRpYWxTdHlsaW5nRmxhZ3MuVkFMVUVTX01PREUpKTtcbiAgICAgIC8vIF9jMCA9IFtwcm9wLCBWQUxVRSwgcHJvcDIsIFZBTFVFMiwgLi4uXVxuICAgICAgZXhwcnMucHVzaCguLi5uYW1lQW5kVmFsdWVFeHBycyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4cHJzLmxlbmd0aCA/IG8ubGl0ZXJhbEFycihleHBycykgOiBudWxsO1xuICB9XG5cbiAgYnVpbGRDcmVhdGVMZXZlbEluc3RydWN0aW9uKHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6XG4gICAgICBTdHlsaW5nSW5zdHJ1Y3Rpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMpIHtcbiAgICAgIGNvbnN0IGluaXRpYWxDbGFzc2VzID0gdGhpcy5fYnVpbGRJbml0RXhwcih0aGlzLl9jbGFzc2VzSW5kZXgsIHRoaXMuX2luaXRpYWxDbGFzc1ZhbHVlcyk7XG4gICAgICBjb25zdCBpbml0aWFsU3R5bGVzID0gdGhpcy5fYnVpbGRJbml0RXhwcih0aGlzLl9zdHlsZXNJbmRleCwgdGhpcy5faW5pdGlhbFN0eWxlVmFsdWVzKTtcblxuICAgICAgLy8gaW4gdGhlIGV2ZW50IHRoYXQgYSBbc3R5bGVdIGJpbmRpbmcgaXMgdXNlZCB0aGVuIHNhbml0aXphdGlvbiB3aWxsXG4gICAgICAvLyBhbHdheXMgYmUgaW1wb3J0ZWQgYmVjYXVzZSBpdCBpcyBub3QgcG9zc2libGUgdG8ga25vdyBhaGVhZCBvZiB0aW1lXG4gICAgICAvLyB3aGV0aGVyIHN0eWxlIGJpbmRpbmdzIHdpbGwgdXNlIG9yIG5vdCB1c2UgYW55IHNhbml0aXphYmxlIHByb3BlcnRpZXNcbiAgICAgIC8vIHRoYXQgaXNTdHlsZVNhbml0aXphYmxlKCkgd2lsbCBkZXRlY3RcbiAgICAgIGNvbnN0IHVzZVNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXI7XG4gICAgICBjb25zdCBwYXJhbXM6IChvLkV4cHJlc3Npb24pW10gPSBbXTtcblxuICAgICAgaWYgKGluaXRpYWxDbGFzc2VzKSB7XG4gICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBjb21waWxlciBoYW5kbGVzIGluaXRpYWwgY2xhc3Mgc3R5bGluZyAoZS5nLiBjbGFzcz1cImZvb1wiKSB2YWx1ZXNcbiAgICAgICAgLy8gaW4gYSBzcGVjaWFsIGNvbW1hbmQgY2FsbGVkIGBlbGVtZW50Q2xhc3NgIHNvIHRoYXQgdGhlIGluaXRpYWwgY2xhc3NcbiAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBjbGFzcyB2YWx1ZXMgYXJlIGJvdW5kIHRvXG4gICAgICAgIC8vIGEgY29uc3RhbnQgYmVjYXVzZSB0aGUgaW5pdGFsIGNsYXNzIHZhbHVlcyBkbyBub3QgY2hhbmdlIChzaW5jZSB0aGV5J3JlIHN0YXRpYykuXG4gICAgICAgIHBhcmFtcy5wdXNoKGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoaW5pdGlhbENsYXNzZXMsIHRydWUpKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5pdGlhbFN0eWxlcyB8fCB1c2VTYW5pdGl6ZXIpIHtcbiAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5pdGlhbFN0eWxlcykge1xuICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIHN0eWxlIChlLmcuIHN0eWxlPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRTdHlsZWAgc28gdGhhdCB0aGUgaW5pdGlhbCBzdHlsZXNcbiAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBzdHlsZXMgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBzdHlsZSB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICBwYXJhbXMucHVzaChjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGluaXRpYWxTdHlsZXMsIHRydWUpKTtcbiAgICAgIH0gZWxzZSBpZiAodXNlU2FuaXRpemVyIHx8IHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgfVxuXG4gICAgICBpZiAodXNlU2FuaXRpemVyIHx8IHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgcGFyYW1zLnB1c2godXNlU2FuaXRpemVyID8gby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplcikgOiBvLk5VTExfRVhQUik7XG4gICAgICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZGlyZWN0aXZlRXhwcik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtzb3VyY2VTcGFuLCByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nLCBidWlsZFBhcmFtczogKCkgPT4gcGFyYW1zfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxpbmdNYXAodmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9jbGFzc01hcElucHV0IHx8IHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dCA9IHRoaXMuX2NsYXNzTWFwSW5wdXQgISB8fCB0aGlzLl9zdHlsZU1hcElucHV0ICE7XG5cbiAgICAgIC8vIHRoZXNlIHZhbHVlcyBtdXN0IGJlIG91dHNpZGUgb2YgdGhlIHVwZGF0ZSBibG9jayBzbyB0aGF0IHRoZXkgY2FuXG4gICAgICAvLyBiZSBldmFsdXRlZCAodGhlIEFTVCB2aXNpdCBjYWxsKSBkdXJpbmcgY3JlYXRpb24gdGltZSBzbyB0aGF0IGFueVxuICAgICAgLy8gcGlwZXMgY2FuIGJlIHBpY2tlZCB1cCBpbiB0aW1lIGJlZm9yZSB0aGUgdGVtcGxhdGUgaXMgYnVpbHRcbiAgICAgIGNvbnN0IG1hcEJhc2VkQ2xhc3NWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA/IHRoaXMuX2NsYXNzTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcbiAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA/IHRoaXMuX3N0eWxlTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudFN0eWxpbmdNYXAsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcblxuICAgICAgICAgIGlmIChtYXBCYXNlZENsYXNzVmFsdWUpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRGbihtYXBCYXNlZENsYXNzVmFsdWUpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobWFwQmFzZWRTdHlsZVZhbHVlKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChjb252ZXJ0Rm4obWFwQmFzZWRTdHlsZVZhbHVlKSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXSwgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4gICAgICBhbGxvd1VuaXRzOiBib29sZWFuLCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgcmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0luZGV4OiBudW1iZXIgPSBtYXBJbmRleC5nZXQoaW5wdXQubmFtZSkgITtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgcmVmZXJlbmNlLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByLCBvLmxpdGVyYWwoYmluZGluZ0luZGV4KSwgY29udmVydEZuKHZhbHVlKV07XG4gICAgICAgICAgaWYgKGFsbG93VW5pdHMpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC51bml0KSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC51bml0KSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLl9kaXJlY3RpdmVFeHByKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmVsZW1lbnRDbGFzc1Byb3AsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmVsZW1lbnRTdHlsZVByb3AsIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzLCB0aGlzLl9zdHlsZXNJbmRleCwgdHJ1ZSwgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZEFwcGx5Rm4oKTogU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlU3BhbjogdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA/IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQuc291cmNlU3BhbiA6IG51bGwsXG4gICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nQXBwbHksXG4gICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW3RoaXMuX2VsZW1lbnRJbmRleEV4cHJdO1xuICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzKSB7XG4gICAgICBjb25zdCBtYXBJbnN0cnVjdGlvbiA9IHRoaXMuX2J1aWxkU3R5bGluZ01hcCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAobWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2gobWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaWYgKHRoaXMuX2FwcGx5Rm5SZXF1aXJlZCkge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDbGFzc0JpbmRpbmcobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lID09ICdjbGFzc05hbWUnIHx8IG5hbWUgPT0gJ2NsYXNzJztcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByb3AgPT09ICdiYWNrZ3JvdW5kLWltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZCcgfHwgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHxcbiAgICAgIHByb3AgPT09ICdmaWx0ZXInIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZS1pbWFnZSc7XG59XG4iXX0=