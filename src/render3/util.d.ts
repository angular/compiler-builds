import * as o from '../output/output_ast';
import { OutputContext } from '../util';
/**
 * Convert an object map with `Expression` values into a `LiteralMapExpr`.
 */
export declare function mapToMapExpression(map: {
    [key: string]: o.Expression;
}): o.LiteralMapExpr;
/**
 * Convert metadata into an `Expression` in the given `OutputContext`.
 *
 * This operation will handle arrays, references to symbols, or literal `null` or `undefined`.
 */
export declare function convertMetaToOutput(meta: any, ctx: OutputContext): o.Expression;
