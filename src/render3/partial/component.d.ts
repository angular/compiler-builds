import { R3CompiledExpression } from '../util';
import { R3ComponentMetadata } from '../view/api';
import { ParsedTemplate } from '../view/template';
import { DefinitionMap } from '../view/util';
import { R3DeclareComponentMetadata } from './api';
/**
 * Compile a component declaration defined by the `R3ComponentMetadata`.
 */
export declare function compileDeclareComponentFromMetadata(meta: R3ComponentMetadata, template: ParsedTemplate): R3CompiledExpression;
/**
 * Gathers the declaration fields for a component into a `DefinitionMap`.
 */
export declare function createComponentDefinitionMap(meta: R3ComponentMetadata, template: ParsedTemplate): DefinitionMap<R3DeclareComponentMetadata>;
