import { AnimationOutput } from '../../core_private';
import { CompileDirectiveMetadata } from '../compile_metadata';
import * as o from '../output/output_ast';
import * as t from '../template_parser/template_ast';
import { AnimationParseError } from './animation_parser';
export declare class CompiledAnimationTriggerResult {
    name: string;
    statesMapStatement: o.Statement;
    statesVariableName: string;
    fnStatement: o.Statement;
    fnVariable: o.Expression;
    constructor(name: string, statesMapStatement: o.Statement, statesVariableName: string, fnStatement: o.Statement, fnVariable: o.Expression);
}
export declare class CompiledComponentAnimationResult {
    outputs: AnimationOutput[];
    triggers: CompiledAnimationTriggerResult[];
    constructor(outputs: AnimationOutput[], triggers: CompiledAnimationTriggerResult[]);
}
export declare class AnimationCompiler {
    compileComponent(component: CompileDirectiveMetadata, template: t.TemplateAst[]): CompiledComponentAnimationResult;
}
export declare class AnimationPropertyValidationOutput {
    outputs: AnimationOutput[];
    errors: AnimationParseError[];
    constructor(outputs: AnimationOutput[], errors: AnimationParseError[]);
}
