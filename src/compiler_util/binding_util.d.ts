import { ClassBuilder } from '../output/class_builder';
import * as o from '../output/output_ast';
export declare class CheckBindingField {
    expression: o.ReadPropExpr;
    bindingId: string;
    constructor(expression: o.ReadPropExpr, bindingId: string);
}
export declare function createCheckBindingField(builder: ClassBuilder): CheckBindingField;
export declare function isFirstViewCheck(view: o.Expression): o.Expression;
