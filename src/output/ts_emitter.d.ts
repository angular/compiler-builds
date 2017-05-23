import { OutputEmitter } from './abstract_emitter';
import * as o from './output_ast';
export declare function debugOutputAstAsTypeScript(ast: o.Statement | o.Expression | o.Type | any[]): string;
export declare class TypeScriptEmitter implements OutputEmitter {
    emitStatements(srcFilePath: string, genFilePath: string, stmts: o.Statement[], preamble?: string): string;
}
