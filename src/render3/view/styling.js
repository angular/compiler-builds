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
        function StylingBuilder(elementIndex) {
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
            this._indexLiteral = o.literal(elementIndex);
        }
        StylingBuilder.prototype.registerInput = function (input) {
            // [attr.style] or [attr.class] are skipped in the code below,
            // they should not be treated as styling-based bindings since
            // they are intended to be written directly to the attr and
            // will therefore skip all style/class resolution that is present
            // with style="", [style]="" and [style.prop]="", class="",
            // [class.prop]="". [class]="" assignments
            var registered = false;
            var name = input.name;
            switch (input.type) {
                case 0 /* Property */:
                    if (name == 'style') {
                        this._styleMapInput = input;
                        this._useDefaultSanitizer = true;
                        registered = true;
                    }
                    else if (isClassBinding(input)) {
                        this._classMapInput = input;
                        registered = true;
                    }
                    break;
                case 3 /* Style */:
                    (this._singleStyleInputs = this._singleStyleInputs || []).push(input);
                    this._useDefaultSanitizer = this._useDefaultSanitizer || isStyleSanitizable(name);
                    registerIntoMap(this._stylesIndex, name);
                    registered = true;
                    break;
                case 2 /* Class */:
                    (this._singleClassInputs = this._singleClassInputs || []).push(input);
                    registerIntoMap(this._classesIndex, name);
                    registered = true;
                    break;
            }
            if (registered) {
                this._lastStylingInput = input;
                this.hasBindingsOrInitialValues = true;
                this._applyFnRequired = true;
            }
            return registered;
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
                else if (useSanitizer) {
                    // no point in having an extra `null` value unless there are follow-up params
                    params_1.push(o.NULL_EXPR);
                }
                if (useSanitizer) {
                    params_1.push(o.importExpr(r3_identifiers_1.Identifiers.defaultStyleSanitizer));
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
                        var params = [_this._indexLiteral];
                        if (mapBasedClassValue_1) {
                            params.push(convertFn(mapBasedClassValue_1));
                        }
                        else if (_this._styleMapInput) {
                            params.push(o.NULL_EXPR);
                        }
                        if (mapBasedStyleValue_1) {
                            params.push(convertFn(mapBasedStyleValue_1));
                        }
                        return params;
                    }
                };
            }
            return null;
        };
        StylingBuilder.prototype._buildSingleInputs = function (reference, inputs, mapIndex, valueConverter) {
            var _this = this;
            return inputs.map(function (input) {
                var bindingIndex = mapIndex.get(input.name);
                var value = input.value.visit(valueConverter);
                return {
                    sourceSpan: input.sourceSpan,
                    reference: reference,
                    buildParams: function (convertFn) {
                        var params = [_this._indexLiteral, o.literal(bindingIndex), convertFn(value)];
                        if (input.unit != null) {
                            params.push(o.literal(input.unit));
                        }
                        return params;
                    }
                };
            });
        };
        StylingBuilder.prototype._buildClassInputs = function (valueConverter) {
            if (this._singleClassInputs) {
                return this._buildSingleInputs(r3_identifiers_1.Identifiers.elementClassProp, this._singleClassInputs, this._classesIndex, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildStyleInputs = function (valueConverter) {
            if (this._singleStyleInputs) {
                return this._buildSingleInputs(r3_identifiers_1.Identifiers.elementStyleProp, this._singleStyleInputs, this._stylesIndex, valueConverter);
            }
            return [];
        };
        StylingBuilder.prototype._buildApplyFn = function () {
            var _this = this;
            return {
                sourceSpan: this._lastStylingInput ? this._lastStylingInput.sourceSpan : null,
                reference: r3_identifiers_1.Identifiers.elementStylingApply,
                buildParams: function () { return [_this._indexLiteral]; }
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
    function isClassBinding(input) {
        return input.name == 'className' || input.name == 'class';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvc3R5bGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFVQSwyREFBNkM7SUFHN0MsK0VBQW9EO0lBRXBELGdGQUFtRDtJQVluRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09Bd0JHO0lBQ0g7UUFtQkUsd0JBQVksWUFBb0I7WUFsQmhCLCtCQUEwQixHQUFHLEtBQUssQ0FBQztZQUczQyxtQkFBYyxHQUEwQixJQUFJLENBQUM7WUFDN0MsbUJBQWMsR0FBMEIsSUFBSSxDQUFDO1lBQzdDLHVCQUFrQixHQUE0QixJQUFJLENBQUM7WUFDbkQsdUJBQWtCLEdBQTRCLElBQUksQ0FBQztZQUNuRCxzQkFBaUIsR0FBMEIsSUFBSSxDQUFDO1lBRXhELHdEQUF3RDtZQUN4RCxrQ0FBa0M7WUFDMUIsaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztZQUN6QyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1lBQzFDLHdCQUFtQixHQUFpQyxFQUFFLENBQUM7WUFDdkQsd0JBQW1CLEdBQW1DLEVBQUUsQ0FBQztZQUN6RCx5QkFBb0IsR0FBRyxLQUFLLENBQUM7WUFDN0IscUJBQWdCLEdBQUcsS0FBSyxDQUFDO1lBRUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQUMsQ0FBQztRQUVuRixzQ0FBYSxHQUFiLFVBQWMsS0FBdUI7WUFDbkMsOERBQThEO1lBQzlELDZEQUE2RDtZQUM3RCwyREFBMkQ7WUFDM0QsaUVBQWlFO1lBQ2pFLDJEQUEyRDtZQUMzRCwwQ0FBMEM7WUFDMUMsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLElBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7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QzdDLE9BQU8sS0FBSyxDQUFDLElBQUksSUFBSSxXQUFXLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxPQUFPLENBQUM7SUFDNUQsQ0FBQztJQUVELFNBQVMsZUFBZSxDQUFDLEdBQXdCLEVBQUUsR0FBVztRQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNqQixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7SUFDSCxDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFZO1FBQ3RDLE9BQU8sSUFBSSxLQUFLLGtCQUFrQixJQUFJLElBQUksS0FBSyxZQUFZLElBQUksSUFBSSxLQUFLLGNBQWM7WUFDbEYsSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLEtBQUssWUFBWSxJQUFJLElBQUksS0FBSyxrQkFBa0IsQ0FBQztJQUNoRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtJbml0aWFsU3R5bGluZ0ZsYWdzfSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QmluZGluZ1R5cGV9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcblxuLyoqXG4gKiBBIHN0eWxpbmcgZXhwcmVzc2lvbiBzdW1tYXJ5IHRoYXQgaXMgdG8gYmUgcHJvY2Vzc2VkIGJ5IHRoZSBjb21waWxlclxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0eWxpbmdJbnN0cnVjdGlvbiB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIGJ1aWxkUGFyYW1zKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbltdO1xufVxuXG4vKipcbiAqIFByb2R1Y2VzIGNyZWF0aW9uL3VwZGF0ZSBpbnN0cnVjdGlvbnMgZm9yIGFsbCBzdHlsaW5nIGJpbmRpbmdzIChjbGFzcyBhbmQgc3R5bGUpXG4gKlxuICogVGhlIGJ1aWxkZXIgY2xhc3MgYmVsb3cgaGFuZGxlcyBwcm9kdWNpbmcgaW5zdHJ1Y3Rpb25zIGZvciB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICpcbiAqIC0gU3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMgKHN0eWxlPVwiLi4uXCIgYW5kIGNsYXNzPVwiLi4uXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgbWFwIGJpbmRpbmdzIChbc3R5bGVdPVwibWFwXCIgYW5kIFtjbGFzc109XCJtYXB8c3RyaW5nXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgcHJvcGVydHkgYmluZGluZ3MgKFtzdHlsZS5wcm9wXT1cImV4cFwiIGFuZCBbY2xhc3MubmFtZV09XCJleHBcIilcbiAqXG4gKiBEdWUgdG8gdGhlIGNvbXBsZXggcmVsYXRpb25zaGlwIG9mIGFsbCBvZiB0aGVzZSBjYXNlcywgdGhlIGluc3RydWN0aW9ucyBnZW5lcmF0ZWRcbiAqIGZvciB0aGVzZSBhdHRyaWJ1dGVzL3Byb3BlcnRpZXMvYmluZGluZ3MgbXVzdCBiZSBkb25lIHNvIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBUaGVcbiAqIG9yZGVyIHdoaWNoIHRoZXNlIG11c3QgYmUgZ2VuZXJhdGVkIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogaWYgKGNyZWF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmcoLi4uKVxuICogfVxuICogaWYgKHVwZGF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmdNYXAoLi4uKVxuICogICBlbGVtZW50U3R5bGVQcm9wKC4uLilcbiAqICAgZWxlbWVudENsYXNzUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsaW5nQXBwKC4uLilcbiAqIH1cbiAqXG4gKiBUaGUgY3JlYXRpb24vdXBkYXRlIG1ldGhvZHMgd2l0aGluIHRoZSBidWlsZGVyIGNsYXNzIHByb2R1Y2UgdGhlc2UgaW5zdHJ1Y3Rpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU3R5bGluZ0J1aWxkZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSBmYWxzZTtcblxuICBwcml2YXRlIF9pbmRleExpdGVyYWw6IG8uTGl0ZXJhbEV4cHI7XG4gIHByaXZhdGUgX2NsYXNzTWFwSW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGV8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3N0eWxlTWFwSW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGV8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3NpbmdsZVN0eWxlSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3NpbmdsZUNsYXNzSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2xhc3RTdHlsaW5nSW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGV8bnVsbCA9IG51bGw7XG5cbiAgLy8gbWFwcyBhcmUgdXNlZCBpbnN0ZWFkIG9mIGhhc2ggbWFwcyBiZWNhdXNlIGEgTWFwIHdpbGxcbiAgLy8gcmV0YWluIHRoZSBvcmRlcmluZyBvZiB0aGUga2V5c1xuICBwcml2YXRlIF9zdHlsZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2NsYXNzZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxTdHlsZVZhbHVlczoge1twcm9wTmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBwcml2YXRlIF9pbml0aWFsQ2xhc3NWYWx1ZXM6IHtbY2xhc3NOYW1lOiBzdHJpbmddOiBib29sZWFufSA9IHt9O1xuICBwcml2YXRlIF91c2VEZWZhdWx0U2FuaXRpemVyID0gZmFsc2U7XG4gIHByaXZhdGUgX2FwcGx5Rm5SZXF1aXJlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnRJbmRleDogbnVtYmVyKSB7IHRoaXMuX2luZGV4TGl0ZXJhbCA9IG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpOyB9XG5cbiAgcmVnaXN0ZXJJbnB1dChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICAgIC8vIFthdHRyLnN0eWxlXSBvciBbYXR0ci5jbGFzc10gYXJlIHNraXBwZWQgaW4gdGhlIGNvZGUgYmVsb3csXG4gICAgLy8gdGhleSBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgc3R5bGluZy1iYXNlZCBiaW5kaW5ncyBzaW5jZVxuICAgIC8vIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHIgYW5kXG4gICAgLy8gd2lsbCB0aGVyZWZvcmUgc2tpcCBhbGwgc3R5bGUvY2xhc3MgcmVzb2x1dGlvbiB0aGF0IGlzIHByZXNlbnRcbiAgICAvLyB3aXRoIHN0eWxlPVwiXCIsIFtzdHlsZV09XCJcIiBhbmQgW3N0eWxlLnByb3BdPVwiXCIsIGNsYXNzPVwiXCIsXG4gICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgIGxldCByZWdpc3RlcmVkID0gZmFsc2U7XG4gICAgY29uc3QgbmFtZSA9IGlucHV0Lm5hbWU7XG4gICAgc3dpdGNoIChpbnB1dC50eXBlKSB7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICBpZiAobmFtZSA9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA9IGlucHV0O1xuICAgICAgICAgIHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgPSB0cnVlO1xuICAgICAgICAgIHJlZ2lzdGVyZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQ2xhc3NCaW5kaW5nKGlucHV0KSkge1xuICAgICAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPSBpbnB1dDtcbiAgICAgICAgICByZWdpc3RlcmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyA9IHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzIHx8IFtdKS5wdXNoKGlucHV0KTtcbiAgICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKG5hbWUpO1xuICAgICAgICByZWdpc3RlckludG9NYXAodGhpcy5fc3R5bGVzSW5kZXgsIG5hbWUpO1xuICAgICAgICByZWdpc3RlcmVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChpbnB1dCk7XG4gICAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9jbGFzc2VzSW5kZXgsIG5hbWUpO1xuICAgICAgICByZWdpc3RlcmVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGlmIChyZWdpc3RlcmVkKSB7XG4gICAgICB0aGlzLl9sYXN0U3R5bGluZ0lucHV0ID0gaW5wdXQ7XG4gICAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2FwcGx5Rm5SZXF1aXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiByZWdpc3RlcmVkO1xuICB9XG5cbiAgcmVnaXN0ZXJTdHlsZUF0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcyA9IHBhcnNlU3R5bGUodmFsdWUpO1xuICAgIE9iamVjdC5rZXlzKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcykuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9zdHlsZXNJbmRleCwgcHJvcCk7XG4gICAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMgPSB7fTtcbiAgICB2YWx1ZS5zcGxpdCgvXFxzKy9nKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXNbY2xhc3NOYW1lXSA9IHRydWU7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBjbGFzc05hbWUpO1xuICAgICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZEluaXRFeHByKHJlZ2lzdHJ5OiBNYXA8c3RyaW5nLCBudW1iZXI+LCBpbml0aWFsVmFsdWVzOiB7W2tleTogc3RyaW5nXTogYW55fSk6XG4gICAgICBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgY29uc3QgZXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgbmFtZUFuZFZhbHVlRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAvLyBfYzAgPSBbcHJvcCwgcHJvcDIsIHByb3AzLCAuLi5dXG4gICAgcmVnaXN0cnkuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgY29uc3Qga2V5TGl0ZXJhbCA9IG8ubGl0ZXJhbChrZXkpO1xuICAgICAgZXhwcnMucHVzaChrZXlMaXRlcmFsKTtcbiAgICAgIGNvbnN0IGluaXRpYWxWYWx1ZSA9IGluaXRpYWxWYWx1ZXNba2V5XTtcbiAgICAgIGlmIChpbml0aWFsVmFsdWUpIHtcbiAgICAgICAgbmFtZUFuZFZhbHVlRXhwcnMucHVzaChrZXlMaXRlcmFsLCBvLmxpdGVyYWwoaW5pdGlhbFZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmFtZUFuZFZhbHVlRXhwcnMubGVuZ3RoKSB7XG4gICAgICAvLyBfYzAgPSBbLi4uIE1BUktFUiAuLi5dXG4gICAgICBleHBycy5wdXNoKG8ubGl0ZXJhbChJbml0aWFsU3R5bGluZ0ZsYWdzLlZBTFVFU19NT0RFKSk7XG4gICAgICAvLyBfYzAgPSBbcHJvcCwgVkFMVUUsIHByb3AyLCBWQUxVRTIsIC4uLl1cbiAgICAgIGV4cHJzLnB1c2goLi4ubmFtZUFuZFZhbHVlRXhwcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBleHBycy5sZW5ndGggPyBvLmxpdGVyYWxBcnIoZXhwcnMpIDogbnVsbDtcbiAgfVxuXG4gIGJ1aWxkQ3JlYXRlTGV2ZWxJbnN0cnVjdGlvbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTpcbiAgICAgIFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcykge1xuICAgICAgY29uc3QgaW5pdGlhbENsYXNzZXMgPSB0aGlzLl9idWlsZEluaXRFeHByKHRoaXMuX2NsYXNzZXNJbmRleCwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzKTtcbiAgICAgIGNvbnN0IGluaXRpYWxTdHlsZXMgPSB0aGlzLl9idWlsZEluaXRFeHByKHRoaXMuX3N0eWxlc0luZGV4LCB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMpO1xuXG4gICAgICAvLyBpbiB0aGUgZXZlbnQgdGhhdCBhIFtzdHlsZV0gYmluZGluZyBpcyB1c2VkIHRoZW4gc2FuaXRpemF0aW9uIHdpbGxcbiAgICAgIC8vIGFsd2F5cyBiZSBpbXBvcnRlZCBiZWNhdXNlIGl0IGlzIG5vdCBwb3NzaWJsZSB0byBrbm93IGFoZWFkIG9mIHRpbWVcbiAgICAgIC8vIHdoZXRoZXIgc3R5bGUgYmluZGluZ3Mgd2lsbCB1c2Ugb3Igbm90IHVzZSBhbnkgc2FuaXRpemFibGUgcHJvcGVydGllc1xuICAgICAgLy8gdGhhdCBpc1N0eWxlU2FuaXRpemFibGUoKSB3aWxsIGRldGVjdFxuICAgICAgY29uc3QgdXNlU2FuaXRpemVyID0gdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplcjtcbiAgICAgIGNvbnN0IHBhcmFtczogKG8uRXhwcmVzc2lvbilbXSA9IFtdO1xuXG4gICAgICBpZiAoaW5pdGlhbENsYXNzZXMpIHtcbiAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBjbGFzcyBzdHlsaW5nIChlLmcuIGNsYXNzPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRDbGFzc2Agc28gdGhhdCB0aGUgaW5pdGlhbCBjbGFzc1xuICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIGNsYXNzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgY2xhc3MgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgcGFyYW1zLnB1c2goY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChpbml0aWFsQ2xhc3NlcywgdHJ1ZSkpO1xuICAgICAgfSBlbHNlIGlmIChpbml0aWFsU3R5bGVzIHx8IHVzZVNhbml0aXplcikge1xuICAgICAgICAvLyBubyBwb2ludCBpbiBoYXZpbmcgYW4gZXh0cmEgYG51bGxgIHZhbHVlIHVubGVzcyB0aGVyZSBhcmUgZm9sbG93LXVwIHBhcmFtc1xuICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICB9XG5cbiAgICAgIGlmIChpbml0aWFsU3R5bGVzKSB7XG4gICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBjb21waWxlciBoYW5kbGVzIGluaXRpYWwgc3R5bGUgKGUuZy4gc3R5bGU9XCJmb29cIikgdmFsdWVzXG4gICAgICAgIC8vIGluIGEgc3BlY2lhbCBjb21tYW5kIGNhbGxlZCBgZWxlbWVudFN0eWxlYCBzbyB0aGF0IHRoZSBpbml0aWFsIHN0eWxlc1xuICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIHN0eWxlcyB2YWx1ZXMgYXJlIGJvdW5kIHRvXG4gICAgICAgIC8vIGEgY29uc3RhbnQgYmVjYXVzZSB0aGUgaW5pdGFsIHN0eWxlIHZhbHVlcyBkbyBub3QgY2hhbmdlIChzaW5jZSB0aGV5J3JlIHN0YXRpYykuXG4gICAgICAgIHBhcmFtcy5wdXNoKGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoaW5pdGlhbFN0eWxlcywgdHJ1ZSkpO1xuICAgICAgfSBlbHNlIGlmICh1c2VTYW5pdGl6ZXIpIHtcbiAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgfVxuXG4gICAgICBpZiAodXNlU2FuaXRpemVyKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtzb3VyY2VTcGFuLCByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nLCBidWlsZFBhcmFtczogKCkgPT4gcGFyYW1zfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxpbmdNYXAodmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9jbGFzc01hcElucHV0IHx8IHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dCA9IHRoaXMuX2NsYXNzTWFwSW5wdXQgISB8fCB0aGlzLl9zdHlsZU1hcElucHV0ICE7XG5cbiAgICAgIC8vIHRoZXNlIHZhbHVlcyBtdXN0IGJlIG91dHNpZGUgb2YgdGhlIHVwZGF0ZSBibG9jayBzbyB0aGF0IHRoZXkgY2FuXG4gICAgICAvLyBiZSBldmFsdXRlZCAodGhlIEFTVCB2aXNpdCBjYWxsKSBkdXJpbmcgY3JlYXRpb24gdGltZSBzbyB0aGF0IGFueVxuICAgICAgLy8gcGlwZXMgY2FuIGJlIHBpY2tlZCB1cCBpbiB0aW1lIGJlZm9yZSB0aGUgdGVtcGxhdGUgaXMgYnVpbHRcbiAgICAgIGNvbnN0IG1hcEJhc2VkQ2xhc3NWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA/IHRoaXMuX2NsYXNzTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcbiAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA/IHRoaXMuX3N0eWxlTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudFN0eWxpbmdNYXAsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFt0aGlzLl9pbmRleExpdGVyYWxdO1xuXG4gICAgICAgICAgaWYgKG1hcEJhc2VkQ2xhc3NWYWx1ZSkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goY29udmVydEZuKG1hcEJhc2VkQ2xhc3NWYWx1ZSkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fc3R5bGVNYXBJbnB1dCkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChtYXBCYXNlZFN0eWxlVmFsdWUpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRGbihtYXBCYXNlZFN0eWxlVmFsdWUpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4gICAgICB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgcmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0luZGV4OiBudW1iZXIgPSBtYXBJbmRleC5nZXQoaW5wdXQubmFtZSkgITtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgcmVmZXJlbmNlLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IFt0aGlzLl9pbmRleExpdGVyYWwsIG8ubGl0ZXJhbChiaW5kaW5nSW5kZXgpLCBjb252ZXJ0Rm4odmFsdWUpXTtcbiAgICAgICAgICBpZiAoaW5wdXQudW5pdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaW5wdXQudW5pdCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgaWYgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICAgICAgUjMuZWxlbWVudENsYXNzUHJvcCwgdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMsIHRoaXMuX2NsYXNzZXNJbmRleCwgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICBSMy5lbGVtZW50U3R5bGVQcm9wLCB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cywgdGhpcy5fc3R5bGVzSW5kZXgsIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRBcHBseUZuKCk6IFN0eWxpbmdJbnN0cnVjdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPyB0aGlzLl9sYXN0U3R5bGluZ0lucHV0LnNvdXJjZVNwYW4gOiBudWxsLFxuICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LFxuICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IFt0aGlzLl9pbmRleExpdGVyYWxdXG4gICAgfTtcbiAgfVxuXG4gIGJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzKSB7XG4gICAgICBjb25zdCBtYXBJbnN0cnVjdGlvbiA9IHRoaXMuX2J1aWxkU3R5bGluZ01hcCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAobWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2gobWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaWYgKHRoaXMuX2FwcGx5Rm5SZXF1aXJlZCkge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDbGFzc0JpbmRpbmcoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlucHV0Lm5hbWUgPT0gJ2NsYXNzTmFtZScgfHwgaW5wdXQubmFtZSA9PSAnY2xhc3MnO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlckludG9NYXAobWFwOiBNYXA8c3RyaW5nLCBudW1iZXI+LCBrZXk6IHN0cmluZykge1xuICBpZiAoIW1hcC5oYXMoa2V5KSkge1xuICAgIG1hcC5zZXQoa2V5LCBtYXAuc2l6ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gcHJvcCA9PT0gJ2JhY2tncm91bmQtaW1hZ2UnIHx8IHByb3AgPT09ICdiYWNrZ3JvdW5kJyB8fCBwcm9wID09PSAnYm9yZGVyLWltYWdlJyB8fFxuICAgICAgcHJvcCA9PT0gJ2ZpbHRlcicgfHwgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUnIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlLWltYWdlJztcbn1cbiJdfQ==