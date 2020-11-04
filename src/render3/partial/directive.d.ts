import { R3DirectiveDef, R3DirectiveMetadata } from '../view/api';
import { DefinitionMap } from '../view/util';
/**
 * Compile a directive declaration defined by the `R3DirectiveMetadata`.
 */
export declare function compileDeclareDirectiveFromMetadata(meta: R3DirectiveMetadata): R3DirectiveDef;
/**
 * Gathers the declaration fields for a directive into a `DefinitionMap`. This allows for reusing
 * this logic for components, as they extend the directive metadata.
 */
export declare function createDirectiveDefinitionMap(meta: R3DirectiveMetadata): DefinitionMap;
