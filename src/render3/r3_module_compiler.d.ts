import { CompileShallowModuleMetadata } from '../compile_metadata';
import { InjectableCompiler } from '../injectable_compiler';
import * as o from '../output/output_ast';
import { OutputContext } from '../util';
export interface R3NgModuleDef {
    expression: o.Expression;
    type: o.Type;
    additionalStatements: o.Statement[];
}
/**
 * Metadata required by the module compiler to generate a `ngModuleDef` for a type.
 */
export interface R3NgModuleMetadata {
    /**
     * An expression representing the module type being compiled.
     */
    type: o.Expression;
    /**
     * An array of expressions representing the bootstrap components specified by the module.
     */
    bootstrap: o.Expression[];
    /**
     * An array of expressions representing the directives and pipes declared by the module.
     */
    declarations: o.Expression[];
    /**
     * An array of expressions representing the imports of the module.
     */
    imports: o.Expression[];
    /**
     * An array of expressions representing the exports of the module.
     */
    exports: o.Expression[];
    /**
     * Whether to emit the selector scope values (declarations, imports, exports) inline into the
     * module definition, or to generate additional statements which patch them on. Inline emission
     * does not allow components to be tree-shaken, but is useful for JIT mode.
     */
    emitInline: boolean;
}
/**
 * Construct an `R3NgModuleDef` for the given `R3NgModuleMetadata`.
 */
export declare function compileNgModule(meta: R3NgModuleMetadata): R3NgModuleDef;
export declare function compileNgModuleFromRender2(ctx: OutputContext, ngModule: CompileShallowModuleMetadata, injectableCompiler: InjectableCompiler): void;
