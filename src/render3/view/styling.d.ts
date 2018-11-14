/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ConstantPool } from '../../constant_pool';
import * as o from '../../output/output_ast';
import { ParseSourceSpan } from '../../parse_util';
import * as t from '../r3_ast';
import { ValueConverter } from './template';
/**
 * A styling expression summary that is to be processed by the compiler
 */
export interface StylingInstruction {
    sourceSpan: ParseSourceSpan | null;
    reference: o.ExternalReference;
    buildParams(convertFn: (value: any) => o.Expression): o.Expression[];
}
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
export declare class StylingBuilder {
    readonly hasBindingsOrInitialValues = false;
    private _indexLiteral;
    private _classMapInput;
    private _styleMapInput;
    private _singleStyleInputs;
    private _singleClassInputs;
    private _lastStylingInput;
    private _stylesIndex;
    private _classesIndex;
    private _initialStyleValues;
    private _initialClassValues;
    private _useDefaultSanitizer;
    private _applyFnRequired;
    constructor(elementIndex: number);
    registerInput(input: t.BoundAttribute): boolean;
    registerStyleAttr(value: string): void;
    registerClassAttr(value: string): void;
    private _buildInitExpr;
    buildCreateLevelInstruction(sourceSpan: ParseSourceSpan, constantPool: ConstantPool): StylingInstruction | null;
    private _buildStylingMap;
    private _buildSingleInputs;
    private _buildClassInputs;
    private _buildStyleInputs;
    private _buildApplyFn;
    buildUpdateLevelInstructions(valueConverter: ValueConverter): StylingInstruction[];
}
