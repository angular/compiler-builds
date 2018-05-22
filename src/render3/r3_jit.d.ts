import { ConstantPool } from '../constant_pool';
import * as o from '../output/output_ast';
/**
 * JIT compiles an expression and monkey-patches the result of executing the expression onto a given
 * type.
 *
 * @param type the type which will receive the monkey-patched result
 * @param field name of the field on the type to monkey-patch
 * @param def the definition which will be compiled and executed to get the value to patch
 * @param context an object map of @angular/core symbol names to symbols which will be available in
 * the context of the compiled expression
 * @param constantPool an optional `ConstantPool` which contains constants used in the expression
 */
export declare function jitPatchDefinition(type: any, field: string, def: o.Expression, context: {
    [key: string]: any;
}, constantPool?: ConstantPool): void;
