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
export class StylingBuilder {
    constructor(_elementIndexExpr, _directiveExpr) {
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
    registerBoundInput(input) {
        // [attr.style] or [attr.class] are skipped in the code below,
        // they should not be treated as styling-based bindings since
        // they are intended to be written directly to the attr and
        // will therefore skip all style/class resolution that is present
        // with style="", [style]="" and [style.prop]="", class="",
        // [class.prop]="". [class]="" assignments
        const name = input.name;
        let binding = null;
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
    }
    registerStyleInput(propertyName, value, unit, sourceSpan) {
        const entry = { name: propertyName, unit, value, sourceSpan };
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
    }
    registerClassInput(className, value, sourceSpan) {
        const entry = { name: className, value, sourceSpan };
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
    }
    registerStyleAttr(value) {
        this._initialStyleValues = parseStyle(value);
        Object.keys(this._initialStyleValues).forEach(prop => {
            registerIntoMap(this._stylesIndex, prop);
            this.hasBindingsOrInitialValues = true;
        });
    }
    registerClassAttr(value) {
        this._initialClassValues = {};
        value.split(/\s+/g).forEach(className => {
            this._initialClassValues[className] = true;
            registerIntoMap(this._classesIndex, className);
            this.hasBindingsOrInitialValues = true;
        });
    }
    _buildInitExpr(registry, initialValues) {
        const exprs = [];
        const nameAndValueExprs = [];
        // _c0 = [prop, prop2, prop3, ...]
        registry.forEach((value, key) => {
            const keyLiteral = o.literal(key);
            exprs.push(keyLiteral);
            const initialValue = initialValues[key];
            if (initialValue) {
                nameAndValueExprs.push(keyLiteral, o.literal(initialValue));
            }
        });
        if (nameAndValueExprs.length) {
            // _c0 = [... MARKER ...]
            exprs.push(o.literal(1 /* VALUES_MODE */));
            // _c0 = [prop, VALUE, prop2, VALUE2, ...]
            exprs.push(...nameAndValueExprs);
        }
        return exprs.length ? o.literalArr(exprs) : null;
    }
    buildCreateLevelInstruction(sourceSpan, constantPool) {
        if (this.hasBindingsOrInitialValues) {
            const initialClasses = this._buildInitExpr(this._classesIndex, this._initialClassValues);
            const initialStyles = this._buildInitExpr(this._stylesIndex, this._initialStyleValues);
            // in the event that a [style] binding is used then sanitization will
            // always be imported because it is not possible to know ahead of time
            // whether style bindings will use or not use any sanitizable properties
            // that isStyleSanitizable() will detect
            const useSanitizer = this._useDefaultSanitizer;
            const params = [];
            if (initialClasses) {
                // the template compiler handles initial class styling (e.g. class="foo") values
                // in a special command called `elementClass` so that the initial class
                // can be processed during runtime. These initial class values are bound to
                // a constant because the inital class values do not change (since they're static).
                params.push(constantPool.getConstLiteral(initialClasses, true));
            }
            else if (initialStyles || useSanitizer || this._directiveExpr) {
                // no point in having an extra `null` value unless there are follow-up params
                params.push(o.NULL_EXPR);
            }
            if (initialStyles) {
                // the template compiler handles initial style (e.g. style="foo") values
                // in a special command called `elementStyle` so that the initial styles
                // can be processed during runtime. These initial styles values are bound to
                // a constant because the inital style values do not change (since they're static).
                params.push(constantPool.getConstLiteral(initialStyles, true));
            }
            else if (useSanitizer || this._directiveExpr) {
                // no point in having an extra `null` value unless there are follow-up params
                params.push(o.NULL_EXPR);
            }
            if (useSanitizer || this._directiveExpr) {
                params.push(useSanitizer ? o.importExpr(R3.defaultStyleSanitizer) : o.NULL_EXPR);
                if (this._directiveExpr) {
                    params.push(this._directiveExpr);
                }
            }
            return { sourceSpan, reference: R3.elementStyling, buildParams: () => params };
        }
        return null;
    }
    _buildStylingMap(valueConverter) {
        if (this._classMapInput || this._styleMapInput) {
            const stylingInput = this._classMapInput || this._styleMapInput;
            // these values must be outside of the update block so that they can
            // be evaluted (the AST visit call) during creation time so that any
            // pipes can be picked up in time before the template is built
            const mapBasedClassValue = this._classMapInput ? this._classMapInput.value.visit(valueConverter) : null;
            const mapBasedStyleValue = this._styleMapInput ? this._styleMapInput.value.visit(valueConverter) : null;
            return {
                sourceSpan: stylingInput.sourceSpan,
                reference: R3.elementStylingMap,
                buildParams: (convertFn) => {
                    const params = [this._elementIndexExpr];
                    if (mapBasedClassValue) {
                        params.push(convertFn(mapBasedClassValue));
                    }
                    else if (this._styleMapInput) {
                        params.push(o.NULL_EXPR);
                    }
                    if (mapBasedStyleValue) {
                        params.push(convertFn(mapBasedStyleValue));
                    }
                    else if (this._directiveExpr) {
                        params.push(o.NULL_EXPR);
                    }
                    if (this._directiveExpr) {
                        params.push(this._directiveExpr);
                    }
                    return params;
                }
            };
        }
        return null;
    }
    _buildSingleInputs(reference, inputs, mapIndex, allowUnits, valueConverter) {
        return inputs.map(input => {
            const bindingIndex = mapIndex.get(input.name);
            const value = input.value.visit(valueConverter);
            return {
                sourceSpan: input.sourceSpan,
                reference,
                buildParams: (convertFn) => {
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
            buildParams: () => {
                const params = [this._elementIndexExpr];
                if (this._directiveExpr) {
                    params.push(this._directiveExpr);
                }
                return params;
            }
        };
    }
    buildUpdateLevelInstructions(valueConverter) {
        const instructions = [];
        if (this.hasBindingsOrInitialValues) {
            const mapInstruction = this._buildStylingMap(valueConverter);
            if (mapInstruction) {
                instructions.push(mapInstruction);
            }
            instructions.push(...this._buildStyleInputs(valueConverter));
            instructions.push(...this._buildClassInputs(valueConverter));
            if (this._applyFnRequired) {
                instructions.push(this._buildApplyFn());
            }
        }
        return instructions;
    }
}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvc3R5bGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFVQSxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRzdDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQXdCbkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXdCRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBa0J6QixZQUFvQixpQkFBK0IsRUFBVSxjQUFpQztRQUExRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWM7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUFqQjlFLCtCQUEwQixHQUFHLEtBQUssQ0FBQztRQUUzQyxtQkFBYyxHQUEyQixJQUFJLENBQUM7UUFDOUMsbUJBQWMsR0FBMkIsSUFBSSxDQUFDO1FBQzlDLHVCQUFrQixHQUE2QixJQUFJLENBQUM7UUFDcEQsdUJBQWtCLEdBQTZCLElBQUksQ0FBQztRQUNwRCxzQkFBaUIsR0FBMkIsSUFBSSxDQUFDO1FBRXpELHdEQUF3RDtRQUN4RCxrQ0FBa0M7UUFDMUIsaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUN6QyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBQzFDLHdCQUFtQixHQUFpQyxFQUFFLENBQUM7UUFDdkQsd0JBQW1CLEdBQW1DLEVBQUUsQ0FBQztRQUN6RCx5QkFBb0IsR0FBRyxLQUFLLENBQUM7UUFDN0IscUJBQWdCLEdBQUcsS0FBSyxDQUFDO0lBRWdFLENBQUM7SUFFbEcsa0JBQWtCLENBQUMsS0FBdUI7UUFDeEMsOERBQThEO1FBQzlELDZEQUE2RDtRQUM3RCwy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QVMsa0JBQWtCLENBQUMsSUFBWTtJQUN0QyxPQUFPLElBQUksS0FBSyxrQkFBa0IsSUFBSSxJQUFJLEtBQUssWUFBWSxJQUFJLElBQUksS0FBSyxjQUFjO1FBQ2xGLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxLQUFLLFlBQVksSUFBSSxJQUFJLEtBQUssa0JBQWtCLENBQUM7QUFDaEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7SW5pdGlhbFN0eWxpbmdGbGFnc30gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQmluZGluZ1R5cGUsIFBhcnNlU3Bhbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuXG5pbXBvcnQge3BhcnNlIGFzIHBhcnNlU3R5bGV9IGZyb20gJy4vc3R5bGVfcGFyc2VyJztcbmltcG9ydCB7VmFsdWVDb252ZXJ0ZXJ9IGZyb20gJy4vdGVtcGxhdGUnO1xuXG5cbi8qKlxuICogQSBzdHlsaW5nIGV4cHJlc3Npb24gc3VtbWFyeSB0aGF0IGlzIHRvIGJlIHByb2Nlc3NlZCBieSB0aGUgY29tcGlsZXJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsaW5nSW5zdHJ1Y3Rpb24ge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBidWlsZFBhcmFtcyhjb252ZXJ0Rm46ICh2YWx1ZTogYW55KSA9PiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuLyoqXG4gKiBBbiBpbnRlcm5hbCByZWNvcmQgb2YgdGhlIGlucHV0IGRhdGEgZm9yIGEgc3R5bGluZyBiaW5kaW5nXG4gKi9cbmludGVyZmFjZSBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdW5pdDogc3RyaW5nfG51bGw7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmFsdWU6IEFTVDtcbn1cblxuXG4vKipcbiAqIFByb2R1Y2VzIGNyZWF0aW9uL3VwZGF0ZSBpbnN0cnVjdGlvbnMgZm9yIGFsbCBzdHlsaW5nIGJpbmRpbmdzIChjbGFzcyBhbmQgc3R5bGUpXG4gKlxuICogVGhlIGJ1aWxkZXIgY2xhc3MgYmVsb3cgaGFuZGxlcyBwcm9kdWNpbmcgaW5zdHJ1Y3Rpb25zIGZvciB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICpcbiAqIC0gU3RhdGljIHN0eWxlL2NsYXNzIGF0dHJpYnV0ZXMgKHN0eWxlPVwiLi4uXCIgYW5kIGNsYXNzPVwiLi4uXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgbWFwIGJpbmRpbmdzIChbc3R5bGVdPVwibWFwXCIgYW5kIFtjbGFzc109XCJtYXB8c3RyaW5nXCIpXG4gKiAtIER5bmFtaWMgc3R5bGUvY2xhc3MgcHJvcGVydHkgYmluZGluZ3MgKFtzdHlsZS5wcm9wXT1cImV4cFwiIGFuZCBbY2xhc3MubmFtZV09XCJleHBcIilcbiAqXG4gKiBEdWUgdG8gdGhlIGNvbXBsZXggcmVsYXRpb25zaGlwIG9mIGFsbCBvZiB0aGVzZSBjYXNlcywgdGhlIGluc3RydWN0aW9ucyBnZW5lcmF0ZWRcbiAqIGZvciB0aGVzZSBhdHRyaWJ1dGVzL3Byb3BlcnRpZXMvYmluZGluZ3MgbXVzdCBiZSBkb25lIHNvIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBUaGVcbiAqIG9yZGVyIHdoaWNoIHRoZXNlIG11c3QgYmUgZ2VuZXJhdGVkIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogaWYgKGNyZWF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmcoLi4uKVxuICogfVxuICogaWYgKHVwZGF0ZU1vZGUpIHtcbiAqICAgZWxlbWVudFN0eWxpbmdNYXAoLi4uKVxuICogICBlbGVtZW50U3R5bGVQcm9wKC4uLilcbiAqICAgZWxlbWVudENsYXNzUHJvcCguLi4pXG4gKiAgIGVsZW1lbnRTdHlsaW5nQXBwKC4uLilcbiAqIH1cbiAqXG4gKiBUaGUgY3JlYXRpb24vdXBkYXRlIG1ldGhvZHMgd2l0aGluIHRoZSBidWlsZGVyIGNsYXNzIHByb2R1Y2UgdGhlc2UgaW5zdHJ1Y3Rpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU3R5bGluZ0J1aWxkZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSBmYWxzZTtcblxuICBwcml2YXRlIF9jbGFzc01hcElucHV0OiBCb3VuZFN0eWxpbmdFbnRyeXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfc3R5bGVNYXBJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3NpbmdsZVN0eWxlSW5wdXRzOiBCb3VuZFN0eWxpbmdFbnRyeVtdfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9zaW5nbGVDbGFzc0lucHV0czogQm91bmRTdHlsaW5nRW50cnlbXXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfbGFzdFN0eWxpbmdJbnB1dDogQm91bmRTdHlsaW5nRW50cnl8bnVsbCA9IG51bGw7XG5cbiAgLy8gbWFwcyBhcmUgdXNlZCBpbnN0ZWFkIG9mIGhhc2ggbWFwcyBiZWNhdXNlIGEgTWFwIHdpbGxcbiAgLy8gcmV0YWluIHRoZSBvcmRlcmluZyBvZiB0aGUga2V5c1xuICBwcml2YXRlIF9zdHlsZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2NsYXNzZXNJbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxTdHlsZVZhbHVlczoge1twcm9wTmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBwcml2YXRlIF9pbml0aWFsQ2xhc3NWYWx1ZXM6IHtbY2xhc3NOYW1lOiBzdHJpbmddOiBib29sZWFufSA9IHt9O1xuICBwcml2YXRlIF91c2VEZWZhdWx0U2FuaXRpemVyID0gZmFsc2U7XG4gIHByaXZhdGUgX2FwcGx5Rm5SZXF1aXJlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2VsZW1lbnRJbmRleEV4cHI6IG8uRXhwcmVzc2lvbiwgcHJpdmF0ZSBfZGlyZWN0aXZlRXhwcjogby5FeHByZXNzaW9ufG51bGwpIHt9XG5cbiAgcmVnaXN0ZXJCb3VuZElucHV0KGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKTogYm9vbGVhbiB7XG4gICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBhcmUgc2tpcHBlZCBpbiB0aGUgY29kZSBiZWxvdyxcbiAgICAvLyB0aGV5IHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkIGJpbmRpbmdzIHNpbmNlXG4gICAgLy8gdGhleSBhcmUgaW50ZW5kZWQgdG8gYmUgd3JpdHRlbiBkaXJlY3RseSB0byB0aGUgYXR0ciBhbmRcbiAgICAvLyB3aWxsIHRoZXJlZm9yZSBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAvLyBbY2xhc3MucHJvcF09XCJcIi4gW2NsYXNzXT1cIlwiIGFzc2lnbm1lbnRzXG4gICAgY29uc3QgbmFtZSA9IGlucHV0Lm5hbWU7XG4gICAgbGV0IGJpbmRpbmc6IEJvdW5kU3R5bGluZ0VudHJ5fG51bGwgPSBudWxsO1xuICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgaWYgKG5hbWUgPT0gJ3N0eWxlJykge1xuICAgICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChudWxsLCBpbnB1dC52YWx1ZSwgJycsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQ2xhc3NCaW5kaW5nKGlucHV0Lm5hbWUpKSB7XG4gICAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KG51bGwsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgIGJpbmRpbmcgPSB0aGlzLnJlZ2lzdGVyU3R5bGVJbnB1dChpbnB1dC5uYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQudW5pdCwgaW5wdXQuc291cmNlU3Bhbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgYmluZGluZyA9IHRoaXMucmVnaXN0ZXJDbGFzc0lucHV0KGlucHV0Lm5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5nID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG5cbiAgcmVnaXN0ZXJTdHlsZUlucHV0KFxuICAgICAgcHJvcGVydHlOYW1lOiBzdHJpbmd8bnVsbCwgdmFsdWU6IEFTVCwgdW5pdDogc3RyaW5nfG51bGwsXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gICAgY29uc3QgZW50cnkgPSB7IG5hbWU6IHByb3BlcnR5TmFtZSwgdW5pdCwgdmFsdWUsIHNvdXJjZVNwYW4gfSBhcyBCb3VuZFN0eWxpbmdFbnRyeTtcbiAgICBpZiAocHJvcGVydHlOYW1lKSB7XG4gICAgICAodGhpcy5fc2luZ2xlU3R5bGVJbnB1dHMgPSB0aGlzLl9zaW5nbGVTdHlsZUlucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdGhpcy5fdXNlRGVmYXVsdFNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUocHJvcGVydHlOYW1lKTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9zdHlsZXNJbmRleCwgcHJvcGVydHlOYW1lKTtcbiAgICAgICh0aGlzIGFzIGFueSkuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgICh0aGlzIGFzIGFueSkuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICAgIHRoaXMuX2FwcGx5Rm5SZXF1aXJlZCA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgcmVnaXN0ZXJDbGFzc0lucHV0KGNsYXNzTmFtZTogc3RyaW5nfG51bGwsIHZhbHVlOiBBU1QsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBCb3VuZFN0eWxpbmdFbnRyeSB7XG4gICAgY29uc3QgZW50cnkgPSB7IG5hbWU6IGNsYXNzTmFtZSwgdmFsdWUsIHNvdXJjZVNwYW4gfSBhcyBCb3VuZFN0eWxpbmdFbnRyeTtcbiAgICBpZiAoY2xhc3NOYW1lKSB7XG4gICAgICAodGhpcy5fc2luZ2xlQ2xhc3NJbnB1dHMgPSB0aGlzLl9zaW5nbGVDbGFzc0lucHV0cyB8fCBbXSkucHVzaChlbnRyeSk7XG4gICAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9jbGFzc2VzSW5kZXgsIGNsYXNzTmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NsYXNzTWFwSW5wdXQgPSBlbnRyeTtcbiAgICB9XG4gICAgdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA9IGVudHJ5O1xuICAgICh0aGlzIGFzIGFueSkuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMgPSB0cnVlO1xuICAgIHRoaXMuX2FwcGx5Rm5SZXF1aXJlZCA9IHRydWU7XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9XG5cbiAgcmVnaXN0ZXJTdHlsZUF0dHIodmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcyA9IHBhcnNlU3R5bGUodmFsdWUpO1xuICAgIE9iamVjdC5rZXlzKHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcykuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIHJlZ2lzdGVySW50b01hcCh0aGlzLl9zdHlsZXNJbmRleCwgcHJvcCk7XG4gICAgICAodGhpcyBhcyBhbnkpLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMgPSB7fTtcbiAgICB2YWx1ZS5zcGxpdCgvXFxzKy9nKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXNbY2xhc3NOYW1lXSA9IHRydWU7XG4gICAgICByZWdpc3RlckludG9NYXAodGhpcy5fY2xhc3Nlc0luZGV4LCBjbGFzc05hbWUpO1xuICAgICAgKHRoaXMgYXMgYW55KS5oYXNCaW5kaW5nc09ySW5pdGlhbFZhbHVlcyA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZEluaXRFeHByKHJlZ2lzdHJ5OiBNYXA8c3RyaW5nLCBudW1iZXI+LCBpbml0aWFsVmFsdWVzOiB7W2tleTogc3RyaW5nXTogYW55fSk6XG4gICAgICBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgY29uc3QgZXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgbmFtZUFuZFZhbHVlRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAvLyBfYzAgPSBbcHJvcCwgcHJvcDIsIHByb3AzLCAuLi5dXG4gICAgcmVnaXN0cnkuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgY29uc3Qga2V5TGl0ZXJhbCA9IG8ubGl0ZXJhbChrZXkpO1xuICAgICAgZXhwcnMucHVzaChrZXlMaXRlcmFsKTtcbiAgICAgIGNvbnN0IGluaXRpYWxWYWx1ZSA9IGluaXRpYWxWYWx1ZXNba2V5XTtcbiAgICAgIGlmIChpbml0aWFsVmFsdWUpIHtcbiAgICAgICAgbmFtZUFuZFZhbHVlRXhwcnMucHVzaChrZXlMaXRlcmFsLCBvLmxpdGVyYWwoaW5pdGlhbFZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmFtZUFuZFZhbHVlRXhwcnMubGVuZ3RoKSB7XG4gICAgICAvLyBfYzAgPSBbLi4uIE1BUktFUiAuLi5dXG4gICAgICBleHBycy5wdXNoKG8ubGl0ZXJhbChJbml0aWFsU3R5bGluZ0ZsYWdzLlZBTFVFU19NT0RFKSk7XG4gICAgICAvLyBfYzAgPSBbcHJvcCwgVkFMVUUsIHByb3AyLCBWQUxVRTIsIC4uLl1cbiAgICAgIGV4cHJzLnB1c2goLi4ubmFtZUFuZFZhbHVlRXhwcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBleHBycy5sZW5ndGggPyBvLmxpdGVyYWxBcnIoZXhwcnMpIDogbnVsbDtcbiAgfVxuXG4gIGJ1aWxkQ3JlYXRlTGV2ZWxJbnN0cnVjdGlvbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOlxuICAgICAgU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzKSB7XG4gICAgICBjb25zdCBpbml0aWFsQ2xhc3NlcyA9IHRoaXMuX2J1aWxkSW5pdEV4cHIodGhpcy5fY2xhc3Nlc0luZGV4LCB0aGlzLl9pbml0aWFsQ2xhc3NWYWx1ZXMpO1xuICAgICAgY29uc3QgaW5pdGlhbFN0eWxlcyA9IHRoaXMuX2J1aWxkSW5pdEV4cHIodGhpcy5fc3R5bGVzSW5kZXgsIHRoaXMuX2luaXRpYWxTdHlsZVZhbHVlcyk7XG5cbiAgICAgIC8vIGluIHRoZSBldmVudCB0aGF0IGEgW3N0eWxlXSBiaW5kaW5nIGlzIHVzZWQgdGhlbiBzYW5pdGl6YXRpb24gd2lsbFxuICAgICAgLy8gYWx3YXlzIGJlIGltcG9ydGVkIGJlY2F1c2UgaXQgaXMgbm90IHBvc3NpYmxlIHRvIGtub3cgYWhlYWQgb2YgdGltZVxuICAgICAgLy8gd2hldGhlciBzdHlsZSBiaW5kaW5ncyB3aWxsIHVzZSBvciBub3QgdXNlIGFueSBzYW5pdGl6YWJsZSBwcm9wZXJ0aWVzXG4gICAgICAvLyB0aGF0IGlzU3R5bGVTYW5pdGl6YWJsZSgpIHdpbGwgZGV0ZWN0XG4gICAgICBjb25zdCB1c2VTYW5pdGl6ZXIgPSB0aGlzLl91c2VEZWZhdWx0U2FuaXRpemVyO1xuICAgICAgY29uc3QgcGFyYW1zOiAoby5FeHByZXNzaW9uKVtdID0gW107XG5cbiAgICAgIGlmIChpbml0aWFsQ2xhc3Nlcykge1xuICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIGNsYXNzIHN0eWxpbmcgKGUuZy4gY2xhc3M9XCJmb29cIikgdmFsdWVzXG4gICAgICAgIC8vIGluIGEgc3BlY2lhbCBjb21tYW5kIGNhbGxlZCBgZWxlbWVudENsYXNzYCBzbyB0aGF0IHRoZSBpbml0aWFsIGNsYXNzXG4gICAgICAgIC8vIGNhbiBiZSBwcm9jZXNzZWQgZHVyaW5nIHJ1bnRpbWUuIFRoZXNlIGluaXRpYWwgY2xhc3MgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBjbGFzcyB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICBwYXJhbXMucHVzaChjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGluaXRpYWxDbGFzc2VzLCB0cnVlKSk7XG4gICAgICB9IGVsc2UgaWYgKGluaXRpYWxTdHlsZXMgfHwgdXNlU2FuaXRpemVyIHx8IHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5pdGlhbFN0eWxlcykge1xuICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIHN0eWxlIChlLmcuIHN0eWxlPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRTdHlsZWAgc28gdGhhdCB0aGUgaW5pdGlhbCBzdHlsZXNcbiAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBzdHlsZXMgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBzdHlsZSB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICBwYXJhbXMucHVzaChjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGluaXRpYWxTdHlsZXMsIHRydWUpKTtcbiAgICAgIH0gZWxzZSBpZiAodXNlU2FuaXRpemVyIHx8IHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgfVxuXG4gICAgICBpZiAodXNlU2FuaXRpemVyIHx8IHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgcGFyYW1zLnB1c2godXNlU2FuaXRpemVyID8gby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplcikgOiBvLk5VTExfRVhQUik7XG4gICAgICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5fZGlyZWN0aXZlRXhwcik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtzb3VyY2VTcGFuLCByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nLCBidWlsZFBhcmFtczogKCkgPT4gcGFyYW1zfTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFN0eWxpbmdNYXAodmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9jbGFzc01hcElucHV0IHx8IHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dCA9IHRoaXMuX2NsYXNzTWFwSW5wdXQgISB8fCB0aGlzLl9zdHlsZU1hcElucHV0ICE7XG5cbiAgICAgIC8vIHRoZXNlIHZhbHVlcyBtdXN0IGJlIG91dHNpZGUgb2YgdGhlIHVwZGF0ZSBibG9jayBzbyB0aGF0IHRoZXkgY2FuXG4gICAgICAvLyBiZSBldmFsdXRlZCAodGhlIEFTVCB2aXNpdCBjYWxsKSBkdXJpbmcgY3JlYXRpb24gdGltZSBzbyB0aGF0IGFueVxuICAgICAgLy8gcGlwZXMgY2FuIGJlIHBpY2tlZCB1cCBpbiB0aW1lIGJlZm9yZSB0aGUgdGVtcGxhdGUgaXMgYnVpbHRcbiAgICAgIGNvbnN0IG1hcEJhc2VkQ2xhc3NWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fY2xhc3NNYXBJbnB1dCA/IHRoaXMuX2NsYXNzTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcbiAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVNYXBJbnB1dCA/IHRoaXMuX3N0eWxlTWFwSW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpIDogbnVsbDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3Bhbjogc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgIHJlZmVyZW5jZTogUjMuZWxlbWVudFN0eWxpbmdNYXAsXG4gICAgICAgIGJ1aWxkUGFyYW1zOiAoY29udmVydEZuOiAodmFsdWU6IGFueSkgPT4gby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByXTtcblxuICAgICAgICAgIGlmIChtYXBCYXNlZENsYXNzVmFsdWUpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKGNvbnZlcnRGbihtYXBCYXNlZENsYXNzVmFsdWUpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3N0eWxlTWFwSW5wdXQpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobWFwQmFzZWRTdHlsZVZhbHVlKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChjb252ZXJ0Rm4obWFwQmFzZWRTdHlsZVZhbHVlKSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTaW5nbGVJbnB1dHMoXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlucHV0czogQm91bmRTdHlsaW5nRW50cnlbXSwgbWFwSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4gICAgICBhbGxvd1VuaXRzOiBib29sZWFuLCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXIpOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSB7XG4gICAgcmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0luZGV4OiBudW1iZXIgPSBtYXBJbmRleC5nZXQoaW5wdXQubmFtZSkgITtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgcmVmZXJlbmNlLFxuICAgICAgICBidWlsZFBhcmFtczogKGNvbnZlcnRGbjogKHZhbHVlOiBhbnkpID0+IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IFt0aGlzLl9lbGVtZW50SW5kZXhFeHByLCBvLmxpdGVyYWwoYmluZGluZ0luZGV4KSwgY29udmVydEZuKHZhbHVlKV07XG4gICAgICAgICAgaWYgKGFsbG93VW5pdHMpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC51bml0KSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC51bml0KSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2RpcmVjdGl2ZUV4cHIpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLl9kaXJlY3RpdmVFeHByKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLl9kaXJlY3RpdmVFeHByKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkQ2xhc3NJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVDbGFzc0lucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmVsZW1lbnRDbGFzc1Byb3AsIHRoaXMuX3NpbmdsZUNsYXNzSW5wdXRzLCB0aGlzLl9jbGFzc2VzSW5kZXgsIGZhbHNlLCB2YWx1ZUNvbnZlcnRlcik7XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU3R5bGVJbnB1dHModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKTogU3R5bGluZ0luc3RydWN0aW9uW10ge1xuICAgIGlmICh0aGlzLl9zaW5nbGVTdHlsZUlucHV0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2J1aWxkU2luZ2xlSW5wdXRzKFxuICAgICAgICAgIFIzLmVsZW1lbnRTdHlsZVByb3AsIHRoaXMuX3NpbmdsZVN0eWxlSW5wdXRzLCB0aGlzLl9zdHlsZXNJbmRleCwgdHJ1ZSwgdmFsdWVDb252ZXJ0ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBwcml2YXRlIF9idWlsZEFwcGx5Rm4oKTogU3R5bGluZ0luc3RydWN0aW9uIHtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlU3BhbjogdGhpcy5fbGFzdFN0eWxpbmdJbnB1dCA/IHRoaXMuX2xhc3RTdHlsaW5nSW5wdXQuc291cmNlU3BhbiA6IG51bGwsXG4gICAgICByZWZlcmVuY2U6IFIzLmVsZW1lbnRTdHlsaW5nQXBwbHksXG4gICAgICBidWlsZFBhcmFtczogKCkgPT4ge1xuICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW3RoaXMuX2VsZW1lbnRJbmRleEV4cHJdO1xuICAgICAgICBpZiAodGhpcy5fZGlyZWN0aXZlRXhwcikge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuX2RpcmVjdGl2ZUV4cHIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyKSB7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBTdHlsaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGlmICh0aGlzLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzKSB7XG4gICAgICBjb25zdCBtYXBJbnN0cnVjdGlvbiA9IHRoaXMuX2J1aWxkU3R5bGluZ01hcCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAobWFwSW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2gobWFwSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRTdHlsZUlucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaW5zdHJ1Y3Rpb25zLnB1c2goLi4udGhpcy5fYnVpbGRDbGFzc0lucHV0cyh2YWx1ZUNvbnZlcnRlcikpO1xuICAgICAgaWYgKHRoaXMuX2FwcGx5Rm5SZXF1aXJlZCkge1xuICAgICAgICBpbnN0cnVjdGlvbnMucHVzaCh0aGlzLl9idWlsZEFwcGx5Rm4oKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDbGFzc0JpbmRpbmcobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lID09ICdjbGFzc05hbWUnIHx8IG5hbWUgPT0gJ2NsYXNzJztcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJbnRvTWFwKG1hcDogTWFwPHN0cmluZywgbnVtYmVyPiwga2V5OiBzdHJpbmcpIHtcbiAgaWYgKCFtYXAuaGFzKGtleSkpIHtcbiAgICBtYXAuc2V0KGtleSwgbWFwLnNpemUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByb3AgPT09ICdiYWNrZ3JvdW5kLWltYWdlJyB8fCBwcm9wID09PSAnYmFja2dyb3VuZCcgfHwgcHJvcCA9PT0gJ2JvcmRlci1pbWFnZScgfHxcbiAgICAgIHByb3AgPT09ICdmaWx0ZXInIHx8IHByb3AgPT09ICdsaXN0LXN0eWxlJyB8fCBwcm9wID09PSAnbGlzdC1zdHlsZS1pbWFnZSc7XG59XG4iXX0=