import * as o from '../output/output_ast';
import { BoundElementPropertyAst } from '../template_parser/template_ast';
export declare function writeToRenderer(view: o.Expression, boundProp: BoundElementPropertyAst, renderNode: o.Expression, renderValue: o.Expression, logBindingUpdate: boolean): o.Statement[];
