import * as tslib_1 from "tslib";
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { parse as parseStyle } from './style_parser';
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
        this._initialStyleValues = parseStyle(value);
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
            else if (initialStyles || useSanitizer || this._directiveExpr) {
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
                params_1.push(useSanitizer ? o.importExpr(R3.defaultStyleSanitizer) : o.NULL_EXPR);
                if (this._directiveExpr) {
                    params_1.push(this._directiveExpr);
                }
            }
            return { sourceSpan: sourceSpan, reference: R3.elementStyling, buildParams: function () { return params_1; } };
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
                reference: R3.elementStylingMap,
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
export { StylingBuilder };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvc3R5bGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBVUEsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUc3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxLQUFLLElBQUksVUFBVSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUF3Qm5EOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F3Qkc7QUFDSDtJQWtCRSx3QkFBb0IsaUJBQStCLEVBQVUsY0FBaUM7UUFBMUUsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFjO1FBQVUsbUJBQWMsR0FBZCxjQUFjLENBQW1CO1FBakI5RSwrQkFBMEIsR0FBRyxLQUFLLENBQUM7UUFFM0MsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQzlDLG1CQUFjLEdBQTJCLElBQUksQ0FBQztRQUM5Qyx1QkFBa0IsR0FBNkIsSUFBSSxDQUFDO1FBQ3BELHVCQUFrQixHQUE2QixJQUFJLENBQUM7UUFDcEQsc0JBQWlCLEdBQTJCLElBQUksQ0FBQztRQUV6RCx3REFBd0Q7UUFDeEQsa0NBQWtDO1FBQzFCLGlCQUFZLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFDekMsa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUMxQyx3QkFBbUIsR0FBaUMsRUFBRSxDQUFDO1FBQ3ZELHdCQUFtQixHQUFtQyxFQUFFLENBQUM7UUFDekQseUJBQW9CLEdBQUcsS0FBSyxDQUFDO1FBQzdCLHFCQUFnQixHQUFHLEtBQUssQ0FBQztJQUVnRSxDQUFDO0lBRWxHLDJDQUFrQixHQUFsQixVQUFtQixLQUF1QjtRQUN4Qyw4REFBOEQ7UUFDOUQsNkRBQTZEO1FBQzdE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QUFlLENBQUMsR0FBd0IsRUFBRSxHQUFXO0lBQzVELElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ2pCLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN4QjtBQUNILENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLElBQVk7SUFDdEMsT0FBTyxJQUFJLEtBQUssa0JBQWtCLElBQUksSUFBSSxLQUFLLFlBQVksSUFBSSxJQUFJLEtBQUssY0FBYztRQUNsRixJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksS0FBSyxZQUFZLElBQUksSUFBSSxLQUFLLGtCQUFrQixDQUFDO0FBQ2hGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0luaXRpYWxTdHlsaW5nRmxhZ3N9IGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEJpbmRpbmdUeXBlLCBQYXJzZVNwYW59IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxlX3BhcnNlcic7XG5pbXBvcnQge1ZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcblxuXG4vKipcbiAqIEEgc3R5bGluZyBleHByZXNzaW9uIHN1bW1hcnkgdGhhdCBpcyB0byBiZSBwcm9jZXNzZWQgYnkgdGhlIGNvbXBpbGVyXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZTtcbiAgYnVpbGRQYXJhbXMoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uW107XG59XG5cbi8qKlxuICogQW4gaW50ZXJuYWwgcmVjb3JkIG9mIHRoZSBpbnB1dCBkYXRhIGZvciBhIHN0eWxpbmcgYmluZGluZ1xuICovXG5pbnRlcmZhY2UgQm91bmRTdHlsaW5nRW50cnkge1xuICBuYW1lOiBzdHJpbmc7XG4gIHVuaXQ6IHN0cmluZ3xudWxsO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cblxuLyoqXG4gKiBQcm9kdWNlcyBjcmVhdGlvbi91cGRhdGUgaW5zdHJ1Y3Rpb25zIGZvciBhbGwgc3R5bGluZyBiaW5kaW5ncyAoY2xhc3MgYW5kIHN0eWxlKVxuICpcbiAqIFRoZSBidWlsZGVyIGNsYXNzIGJlbG93IGhhbmRsZXMgcHJvZHVjaW5nIGluc3RydWN0aW9ucyBmb3IgdGhlIGZvbGxvd2luZyBjYXNlczpcbiAqXG4gKiAtIFN0YXRpYyBzdHlsZS9jbGFzcyBhdHRyaWJ1dGVzIChzdHlsZT1cIi4uLlwiIGFuZCBjbGFzcz1cIi4uLlwiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIG1hcCBiaW5kaW5ncyAoW3N0eWxlXT1cIm1hcFwiIGFuZCBbY2xhc3NdPVwibWFwfHN0cmluZ1wiKVxuICogLSBEeW5hbWljIHN0eWxlL2NsYXNzIHByb3BlcnR5IGJpbmRpbmdzIChbc3R5bGUucHJvcF09XCJleHBcIiBhbmQgW2NsYXNzLm5hbWVdPVwiZXhwXCIpXG4gKlxuICogRHVlIHRvIHRoZSBjb21wbGV4IHJlbGF0aW9uc2hpcCBvZiBhbGwgb2YgdGhlc2UgY2FzZXMsIHRoZSBpbnN0cnVjdGlvbnMgZ2VuZXJhdGVkXG4gKiBmb3IgdGhlc2UgYXR0cmlidXRlcy9wcm9wZXJ0aWVzL2JpbmRpbmdzIG11c3QgYmUgZG9uZSBzbyBpbiB0aGUgY29ycmVjdCBvcmRlci4gVGhlXG4gKiBvcmRlciB3aGljaCB0aGVzZSBtdXN0IGJlIGdlbmVyYXRlZCBpcyBhcyBmb2xsb3dzOlxuICpcbiAqIGlmIChjcmVhdGVNb2RlKSB7XG4gKiAgIGVsZW1lbnRTdHlsaW5nKC4uLilcbiAqIH1cbiAqIGlmICh1cGRhdGVNb2RlKSB7XG4gKiAgIGVsZW1lbnRTdHlsaW5nTWFwKC4uLilcbiAqICAgZWxlbWVudFN0eWxlUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRDbGFzc1Byb3AoLi4uKVxuICogICBlbGVtZW50U3R5bGluZ0FwcCguLi4pXG4gKiB9XG4gKlxuICogVGhlIGNyZWF0aW9uL3VwZGF0ZSBtZXRob2RzIHdpdGhpbiB0aGUgYnVpbGRlciBjbGFzcyBwcm9kdWNlIHRoZXNlIGluc3RydWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0eWxpbmdCdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gZmFsc2U7XG5cbiAgcHJpdmF0ZSBfY2xhc3NNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3N0eWxlTWFwSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9zaW5nbGVTdHlsZUlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfc2luZ2xlQ2xhc3NJbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W118bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2xhc3RTdHlsaW5nSW5wdXQ6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuXG4gIC8vIG1hcHMgYXJlIHVzZWQgaW5zdGVhZCBvZiBoYXNoIG1hcHMgYmVjYXVzZSBhIE1hcCB3aWxsXG4gIC8vIHJldGFpbiB0aGUgb3JkZXJpbmcgb2YgdGhlIGtleXNcbiAgcHJpdmF0ZSBfc3R5bGVzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBwcml2YXRlIF9jbGFzc2VzSW5kZXggPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBwcml2YXRlIF9pbml0aWFsU3R5bGVWYWx1ZXM6IHtbcHJvcE5hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgcHJpdmF0ZSBfaW5pdGlhbENsYXNzVmFsdWVzOiB7W2NsYXNzTmFtZTogc3RyaW5nXTogYm9vbGVhbn0gPSB7fTtcbiAgcHJpdmF0ZSBfdXNlRGVmYXVsdFNhbml0aXplciA9IGZhbHNlO1xuICBwcml2YXRlIF9hcHBseUZuUmVxdWlyZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9lbGVtZW50SW5kZXhFeHByOiBvLkV4cHJlc3Npb24sIHByaXZhdGUgX2RpcmVjdGl2ZUV4cHI6IG8uRXhwcmVzc2lvbnxudWxsKSB7fVxuXG4gIHJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICAgIC8vIFthdHRyLnN0eWxlXSBvciBbYXR0ci5jbGFzc10gYXJlIHNraXBwZWQgaW4gdGhlIGNvZGUgYmVsb3csXG4gICAgLy8gdGhleSBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgc3R5bGluZy1iYXNlZCBiaW5kaW5ncyBzaW5jZVxuICAgIC8vIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHIgYW5kXG4gICAgLy8gd2lsbCB0aGVyZWZvcmUgc2tpcCBhbGwgc3R5bGUvY2xhc3MgcmVzb2x1dGlvbiB0aGF0IGlzIHByZXNlbnRcbiAgICAvLyB3aXRoIHN0eWxlPVwiXCIsIFtzdHlsZV09XCJcIiBhbmQgW3N0eWxlLnByb3BdPVwiXCIsIGNsYXNzPVwiXCIsXG4gICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgIGNvbnN0IG5hbWUgPSBpbnB1dC5uYW1lO1xuICAgIGxldCBiaW5kaW5nOiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGlmIChuYW1lID09ICdzdHlsZScpIHtcbiAgICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQobnVsbCwgaW5wdXQudmFsdWUsICcnLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0NsYXNzQmluZGluZyhpbnB1dC5uYW1lKSkge1xuICAgICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChudWxsLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICBiaW5kaW5nID0gdGhpcy5yZWdpc3RlclN0eWxlSW5wdXQoaW5wdXQubmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnVuaXQsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyQ2xhc3NJbnB1dChpbnB1dC5uYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZyA/IHRydWUgOiBmYWxzZTtcbiAgfVxuXG4gIHJlZ2lzdGVyU3R5bGVJbnB1dChcbiAgICAgIHByb3BlcnR5TmFtZTogc3RyaW5nfG51bGwsIHZhbHVlOiBBU1QsIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQm91bmRTdHlsaW5nRW50cnkge1xuICAgIGNvbnN0IGVudHJ5ID0geyBuYW1lOiBwcm9wZXJ0eU5hbWUsIHVuaXQsIHZhbHVlLCBzb3VyY2VTcGFuIH0gYXMgQm91bmRTdHlsaW5nRW50cnk7XG4gICAgaWYgKHByb3BlcnR5TmFtZSkge1xuICAgICAgKHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzID0gdGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRoaXMuX3VzZURlZmF1bHRTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKHByb3BlcnR5TmFtZSk7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fc3R5bGVzSW5kZXgsIHByb3BlcnR5TmFtZSk7XG4gICAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciA9IHRydWU7XG4gICAgICB0aGlzLl9zdHlsZU1hcElucHV0ID0gZW50cnk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICB0aGlzLl9hcHBseUZuUmVxdWlyZWQgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NJbnB1dChjbGFzc05hbWU6IHN0cmluZ3xudWxsLCB2YWx1ZTogQVNULCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgQm91bmRTdHlsaW5nRW50cnkge1xuICAgIGNvbnN0IGVudHJ5ID0geyBuYW1lOiBjbGFzc05hbWUsIHZhbHVlLCBzb3VyY2VTcGFuIH0gYXMgQm91bmRTdHlsaW5nRW50cnk7XG4gICAgaWYgKGNsYXNzTmFtZSkge1xuICAgICAgKHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzID0gdGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgfHwgW10pLnB1c2goZW50cnkpO1xuICAgICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBjbGFzc05hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jbGFzc01hcElucHV0ID0gZW50cnk7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPSBlbnRyeTtcbiAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICB0aGlzLl9hcHBseUZuUmVxdWlyZWQgPSB0cnVlO1xuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIHJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMpLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fc3R5bGVzSW5kZXgsIHByb3ApO1xuICAgICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICByZWdpc3RlckNsYXNzQXR0cih2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzID0ge307XG4gICAgdmFsdWUuc3BsaXQoL1xccysvZykuZm9yRWFjaChjbGFzc05hbWUgPT4ge1xuICAgICAgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzW2NsYXNzTmFtZV0gPSB0cnVlO1xuICAgICAgcmVnaXN0ZXJJbnRvTWFwKHRoaXMuX2NsYXNzZXNJbmRleCwgY2xhc3NOYW1lKTtcbiAgICAgICh0aGlzIGFzIGFueSkuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRJbml0RXhwcihyZWdpc3RyeTogTWFwPHN0cmluZywgbnVtYmVyPiwgaW5pdGlhbFZhbHVlczoge1trZXk6IHN0cmluZ106IGFueX0pOlxuICAgICAgby5FeHByZXNzaW9ufG51bGwge1xuICAgIGNvbnN0IGV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IG5hbWVBbmRWYWx1ZUV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgLy8gX2MwID0gW3Byb3AsIHByb3AyLCBwcm9wMywgLi4uXVxuICAgIHJlZ2lzdHJ5LmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgIGNvbnN0IGtleUxpdGVyYWwgPSBvLmxpdGVyYWwoa2V5KTtcbiAgICAgIGV4cHJzLnB1c2goa2V5TGl0ZXJhbCk7XG4gICAgICBjb25zdCBpbml0aWFsVmFsdWUgPSBpbml0aWFsVmFsdWVzW2tleV07XG4gICAgICBpZiAoaW5pdGlhbFZhbHVlKSB7XG4gICAgICAgIG5hbWVBbmRWYWx1ZUV4cHJzLnB1c2goa2V5TGl0ZXJhbCwgby5saXRlcmFsKGluaXRpYWxWYWx1ZSkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKG5hbWVBbmRWYWx1ZUV4cHJzLmxlbmd0aCkge1xuICAgICAgLy8gX2MwID0gWy4uLiBNQVJLRVIgLi4uXVxuICAgICAgZXhwcnMucHVzaChvLmxpdGVyYWwoSW5pdGlhbFN0eWxpbmdGbGFncy5WQUxVRVNfTU9ERSkpO1xuICAgICAgLy8gX2MwID0gW3Byb3AsIFZBTFVFLCBwcm9wMiwgVkFMVUUyLCAuLi5dXG4gICAgICBleHBycy5wdXNoKC4uLm5hbWVBbmRWYWx1ZUV4cHJzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXhwcnMubGVuZ3RoID8gby5saXRlcmFsQXJyKGV4cHJzKSA6IG51bGw7XG4gIH1cblxuICBidWlsZENyZWF0ZUxldmVsSW5zdHJ1Y3Rpb24oc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTpcbiAgICAgIFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcykge1xuICAgICAgY29uc3QgaW5pdGlhbENsYXNzZXMgPSB0aGlzLl9idWlsZEluaXRFeHByKHRoaXMuX2NsYXNzZXNJbmRleCwgdGhpcy5faW5pdGlhbENsYXNzVmFsdWVzKTtcbiAgICAgIGNvbnN0IGluaXRpYWxTdHlsZXMgPSB0aGlzLl9idWlsZEluaXRFeHByKHRoaXMuX3N0eWxlc0luZGV4LCB0aGlzLl9pbml0aWFsU3R5bGVWYWx1ZXMpO1xuXG4gICAgICAvLyBpbiB0aGUgZXZlbnQgdGhhdCBhIFtzdHlsZV0gYmluZGluZyBpcyB1c2VkIHRoZW4gc2FuaXRpemF0aW9uIHdpbGxcbiAgICAgIC8vIGFsd2F5cyBiZSBpbXBvcnRlZCBiZWNhdXNlIGl0IGlzIG5vdCBwb3NzaWJsZSB0byBrbm93IGFoZWFkIG9mIHRpbWVcbiAgICAgIC8vIHdoZXRoZXIgc3R5bGUgYmluZGluZ3Mgd2lsbCB1c2Ugb3Igbm90IHVzZSBhbnkgc2FuaXRpemFibGUgcHJvcGVydGllc1xuICAgICAgLy8gdGhhdCBpc1N0eWxlU2FuaXRpemFibGUoKSB3aWxsIGRldGVjdFxuICAgICAgY29uc3QgdXNlU2FuaXRpemVyID0gdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplcjtcbiAgICAgIGNvbnN0IHBhcmFtczogKG8uRXhwcmVzc2lvbilbXSA9IFtdO1xuXG4gICAgICBpZiAoaW5pdGlhbENsYXNzZXMpIHtcbiAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBjbGFzcyBzdHlsaW5nIChlLmcuIGNsYXNzPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRDbGFzc2Agc28gdGhhdCB0aGUgaW5pdGlhbCBjbGFzc1xuICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIGNsYXNzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgY2xhc3MgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgcGFyYW1zLnB1c2goY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChpbml0aWFsQ2xhc3NlcywgdHJ1ZSkpO1xuICAgICAgfSBlbHNlIGlmIChpbml0aWFsU3R5bGVzIHx8IHVzZVNhbml0aXplciB8fCB0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgIC8vIG5vIHBvaW50IGluIGhhdmluZyBhbiBleHRyYSBgbnVsbGAgdmFsdWUgdW5sZXNzIHRoZXJlIGFyZSBmb2xsb3ctdXAgcGFyYW1zXG4gICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGluaXRpYWxTdHlsZXMpIHtcbiAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBzdHlsZSAoZS5nLiBzdHlsZT1cImZvb1wiKSB2YWx1ZXNcbiAgICAgICAgLy8gaW4gYSBzcGVjaWFsIGNvbW1hbmQgY2FsbGVkIGBlbGVtZW50U3R5bGVgIHNvIHRoYXQgdGhlIGluaXRpYWwgc3R5bGVzXG4gICAgICAgIC8vIGNhbiBiZSBwcm9jZXNzZWQgZHVyaW5nIHJ1bnRpbWUuIFRoZXNlIGluaXRpYWwgc3R5bGVzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgc3R5bGUgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgcGFyYW1zLnB1c2goY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChpbml0aWFsU3R5bGVzLCB0cnVlKSk7XG4gICAgICB9IGVsc2UgaWYgKHVzZVNhbml0aXplciB8fCB0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgIC8vIG5vIHBvaW50IGluIGhhdmluZyBhbiBleHRyYSBgbnVsbGAgdmFsdWUgdW5sZXNzIHRoZXJlIGFyZSBmb2xsb3ctdXAgcGFyYW1zXG4gICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVzZVNhbml0aXplciB8fCB0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKHVzZVNhbml0aXplciA/IG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIDogby5OVUxMX0VYUFIpO1xuICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7c291cmNlU3BhbiwgcmVmZXJlbmNlOiBSMy5lbGVtZW50U3R5bGluZywgYnVpbGRQYXJhbXM6ICgpID0+IHBhcmFtc307XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTdHlsaW5nTWFwKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fY2xhc3NNYXBJbnB1dCB8fCB0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXQgPSB0aGlzLl9jbGFzc01hcElucHV0ICEgfHwgdGhpcy5fc3R5bGVNYXBJbnB1dCAhO1xuXG4gICAgICAvLyB0aGVzZSB2YWx1ZXMgbXVzdCBiZSBvdXRzaWRlIG9mIHRoZSB1cGRhdGUgYmxvY2sgc28gdGhhdCB0aGV5IGNhblxuICAgICAgLy8gYmUgZXZhbHV0ZWQgKHRoZSBBU1QgdmlzaXQgY2FsbCkgZHVyaW5nIGNyZWF0aW9uIHRpbWUgc28gdGhhdCBhbnlcbiAgICAgIC8vIHBpcGVzIGNhbiBiZSBwaWNrZWQgdXAgaW4gdGltZSBiZWZvcmUgdGhlIHRlbXBsYXRlIGlzIGJ1aWx0XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzVmFsdWUgPVxuICAgICAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPyB0aGlzLl9jbGFzc01hcElucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKSA6IG51bGw7XG4gICAgICBjb25zdCBtYXBCYXNlZFN0eWxlVmFsdWUgPVxuICAgICAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPyB0aGlzLl9zdHlsZU1hcElucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKSA6IG51bGw7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW46IHN0eWxpbmdJbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nTWFwLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbdGhpcy5fZWxlbWVudEluZGV4RXhwcl07XG5cbiAgICAgICAgICBpZiAobWFwQmFzZWRDbGFzc1ZhbHVlKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChjb252ZXJ0Rm4obWFwQmFzZWRDbGFzc1ZhbHVlKSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9zdHlsZU1hcElucHV0KSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG1hcEJhc2VkU3R5bGVWYWx1ZSkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goY29udmVydEZuKG1hcEJhc2VkU3R5bGVWYWx1ZSkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLl9kaXJlY3RpdmVFeHByKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpbnB1dHM6IEJvdW5kU3R5bGluZ0VudHJ5W10sIG1hcEluZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+LFxuICAgICAgYWxsb3dVbml0czogYm9vbGVhbiwgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIHJldHVybiBpbnB1dHMubWFwKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IGJpbmRpbmdJbmRleDogbnVtYmVyID0gbWFwSW5kZXguZ2V0KGlucHV0Lm5hbWUpICE7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZSxcbiAgICAgICAgYnVpbGRQYXJhbXM6IChjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICBjb25zdCBwYXJhbXMgPSBbdGhpcy5fZWxlbWVudEluZGV4RXhwciwgby5saXRlcmFsKGJpbmRpbmdJbmRleCksIGNvbnZlcnRGbih2YWx1ZSldO1xuICAgICAgICAgIGlmIChhbGxvd1VuaXRzKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQudW5pdCkge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaW5wdXQudW5pdCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZGlyZWN0aXZlRXhwcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZENsYXNzSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICBSMy5lbGVtZW50Q2xhc3NQcm9wLCB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cywgdGhpcy5fY2xhc3Nlc0luZGV4LCBmYWxzZSwgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxlSW5wdXRzKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcik6IFN0eWxpbmdJbnN0cnVjdGlvbltdIHtcbiAgICBpZiAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9idWlsZFNpbmdsZUlucHV0cyhcbiAgICAgICAgICBSMy5lbGVtZW50U3R5bGVQcm9wLCB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cywgdGhpcy5fc3R5bGVzSW5kZXgsIHRydWUsIHZhbHVlQ29udmVydGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRBcHBseUZuKCk6IFN0eWxpbmdJbnN0cnVjdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQgPyB0aGlzLl9sYXN0U3R5bGluZ0lucHV0LnNvdXJjZVNwYW4gOiBudWxsLFxuICAgICAgcmVmZXJlbmNlOiBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LFxuICAgICAgYnVpbGRQYXJhbXM6ICgpID0+IHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcbiAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLl9kaXJlY3RpdmVFeHByKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBidWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcikge1xuICAgIGNvbnN0IGluc3RydWN0aW9uczogU3R5bGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBpZiAodGhpcy5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcykge1xuICAgICAgY29uc3QgbWFwSW5zdHJ1Y3Rpb24gPSB0aGlzLl9idWlsZFN0eWxpbmdNYXAodmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgaWYgKG1hcEluc3RydWN0aW9uKSB7XG4gICAgICAgIGluc3RydWN0aW9ucy5wdXNoKG1hcEluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKC4uLnRoaXMuX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXIpKTtcbiAgICAgIGlmICh0aGlzLl9hcHBseUZuUmVxdWlyZWQpIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2godGhpcy5fYnVpbGRBcHBseUZuKCkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5zdHJ1Y3Rpb25zO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzQ2xhc3NCaW5kaW5nKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PSAnY2xhc3NOYW1lJyB8fCBuYW1lID09ICdjbGFzcyc7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVySW50b01hcChtYXA6IE1hcDxzdHJpbmcsIG51bWJlcj4sIGtleTogc3RyaW5nKSB7XG4gIGlmICghbWFwLmhhcyhrZXkpKSB7XG4gICAgbWFwLnNldChrZXksIG1hcC5zaXplKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1N0eWxlU2FuaXRpemFibGUocHJvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBwcm9wID09PSAnYmFja2dyb3VuZC1pbWFnZScgfHwgcHJvcCA9PT0gJ2JhY2tncm91bmQnIHx8IHByb3AgPT09ICdib3JkZXItaW1hZ2UnIHx8XG4gICAgICBwcm9wID09PSAnZmlsdGVyJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZScgfHwgcHJvcCA9PT0gJ2xpc3Qtc3R5bGUtaW1hZ2UnO1xufVxuIl19