/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
//////////////////////////////////////
// THIS FILE HAS GLOBAL SIDE EFFECT //
//       (see bottom of file)       //
//////////////////////////////////////
/**
 * @module
 * @description
 * Entry point for all APIs of the compiler package.
 *
 * <div class="callout is-critical">
 *   <header>Unstable APIs</header>
 *   <p>
 *     All compiler apis are currently considered experimental and private!
 *   </p>
 *   <p>
 *     We expect the APIs in this package to keep on changing. Do not rely on them.
 *   </p>
 * </div>
 */
import * as core from './core';
import { publishFacade } from './jit_compiler_facade';
import { global } from './util';
export { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from './core';
export { core };
export * from './version';
export { CompilerConfig, preserveWhitespacesDefault } from './config';
export * from './resource_loader';
export { ConstantPool } from './constant_pool';
export { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from './ml_parser/interpolation_config';
export * from './schema/element_schema_registry';
export * from './i18n/index';
export * from './expression_parser/ast';
export * from './expression_parser/lexer';
export * from './expression_parser/parser';
export * from './ml_parser/ast';
export * from './ml_parser/html_parser';
export * from './ml_parser/html_tags';
export * from './ml_parser/interpolation_config';
export * from './ml_parser/tags';
export { ParseTreeResult, TreeError } from './ml_parser/parser';
export * from './ml_parser/xml_parser';
export { ArrayType, DYNAMIC_TYPE, BinaryOperator, BinaryOperatorExpr, BuiltinType, BuiltinTypeName, CommaExpr, ConditionalExpr, DeclareFunctionStmt, DeclareVarStmt, Expression, ExpressionStatement, ExpressionType, ExternalExpr, ExternalReference, literalMap, FunctionExpr, IfStmt, InstantiateExpr, InvokeFunctionExpr, LiteralArrayExpr, LiteralExpr, LiteralMapExpr, MapType, NotExpr, NONE_TYPE, ReadKeyExpr, ReadPropExpr, ReadVarExpr, ReturnStatement, TaggedTemplateExpr, TemplateLiteral, TemplateLiteralElement, Type, TypeModifier, WrappedNodeExpr, WriteKeyExpr, WritePropExpr, WriteVarExpr, StmtModifier, Statement, STRING_TYPE, TypeofExpr, jsDocComment, leadingComment, LeadingComment, JSDocComment, UnaryOperator, UnaryOperatorExpr, LocalizedString, TransplantedType } from './output/output_ast';
export { EmitterVisitorContext } from './output/abstract_emitter';
export { JitEvaluator } from './output/output_jit';
export * from './parse_util';
export * from './schema/dom_element_schema_registry';
export * from './selector';
export { Version } from './util';
export * from './injectable_compiler_2';
export * from './render3/partial/api';
export * from './render3/view/api';
export { BoundAttribute as TmplAstBoundAttribute, BoundEvent as TmplAstBoundEvent, BoundText as TmplAstBoundText, Content as TmplAstContent, Element as TmplAstElement, Icu as TmplAstIcu, RecursiveVisitor as TmplAstRecursiveVisitor, Reference as TmplAstReference, Template as TmplAstTemplate, Text as TmplAstText, TextAttribute as TmplAstTextAttribute, Variable as TmplAstVariable } from './render3/r3_ast';
export * from './render3/view/t2_api';
export * from './render3/view/t2_binder';
export { Identifiers as R3Identifiers } from './render3/r3_identifiers';
export { compileClassMetadata } from './render3/r3_class_metadata_compiler';
export { compileFactoryFunction, FactoryTarget } from './render3/r3_factory';
export { compileNgModule, R3SelectorScopeMode, R3NgModuleMetadataKind } from './render3/r3_module_compiler';
export { compileInjector } from './render3/r3_injector_compiler';
export { compilePipeFromMetadata } from './render3/r3_pipe_compiler';
export { makeBindingParser, parseTemplate } from './render3/view/template';
export { createMayBeForwardRefExpression, devOnlyGuardedExpression, getSafePropertyAccessString } from './render3/util';
export { compileComponentFromMetadata, compileDirectiveFromMetadata, parseHostBindings, verifyHostBindings } from './render3/view/compiler';
export { compileDeclareClassMetadata } from './render3/partial/class_metadata';
export { compileDeclareComponentFromMetadata } from './render3/partial/component';
export { compileDeclareDirectiveFromMetadata } from './render3/partial/directive';
export { compileDeclareFactoryFunction } from './render3/partial/factory';
export { compileDeclareInjectableFromMetadata } from './render3/partial/injectable';
export { compileDeclareInjectorFromMetadata } from './render3/partial/injector';
export { compileDeclareNgModuleFromMetadata } from './render3/partial/ng_module';
export { compileDeclarePipeFromMetadata } from './render3/partial/pipe';
export { publishFacade } from './jit_compiler_facade';
export { emitDistinctChangesOnlyDefaultValue, ChangeDetectionStrategy, ViewEncapsulation } from './core';
import * as outputAst from './output/output_ast';
export { outputAst };
// This file only reexports content of the `src` folder. Keep it that way.
// This function call has a global side effects and publishes the compiler into global namespace for
// the late binding of the Compiler to the @angular/core for jit compilation.
publishFacade(global);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0NBQXNDO0FBQ3RDLHNDQUFzQztBQUN0QyxzQ0FBc0M7QUFDdEMsc0NBQXNDO0FBRXRDOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBRUgsT0FBTyxLQUFLLElBQUksTUFBTSxRQUFRLENBQUM7QUFDL0IsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3BELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFOUIsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGdCQUFnQixFQUFpQixNQUFNLFFBQVEsQ0FBQztBQUNoRixPQUFPLEVBQUMsSUFBSSxFQUFDLENBQUM7QUFFZCxjQUFjLFdBQVcsQ0FBQztBQUMxQixPQUFPLEVBQUMsY0FBYyxFQUFFLDBCQUEwQixFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ3BFLGNBQWMsbUJBQW1CLENBQUM7QUFDbEMsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBQzdDLE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ25HLGNBQWMsa0NBQWtDLENBQUM7QUFDakQsY0FBYyxjQUFjLENBQUM7QUFDN0IsY0FBYyx5QkFBeUIsQ0FBQztBQUN4QyxjQUFjLDJCQUEyQixDQUFDO0FBQzFDLGNBQWMsNEJBQTRCLENBQUM7QUFDM0MsY0FBYyxpQkFBaUIsQ0FBQztBQUNoQyxjQUFjLHlCQUF5QixDQUFDO0FBQ3hDLGNBQWMsdUJBQXVCLENBQUM7QUFDdEMsY0FBYyxrQ0FBa0MsQ0FBQztBQUNqRCxjQUFjLGtCQUFrQixDQUFDO0FBQ2pDLE9BQU8sRUFBQyxlQUFlLEVBQUUsU0FBUyxFQUFDLE1BQU0s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NkJBQTZCLENBQUM7QUFDOUcsT0FBTyxFQUFDLG1DQUFtQyxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDaEYsT0FBTyxFQUFDLDZCQUE2QixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDeEUsT0FBTyxFQUFDLG9DQUFvQyxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDbEYsT0FBTyxFQUFDLGtDQUFrQyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDOUUsT0FBTyxFQUFDLGtDQUFrQyxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDL0UsT0FBTyxFQUFDLDhCQUE4QixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDdEUsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3BELE9BQU8sRUFBQyxtQ0FBbUMsRUFBRSx1QkFBdUIsRUFBRSxpQkFBaUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUN2RyxPQUFPLEtBQUssU0FBUyxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBQyxTQUFTLEVBQUMsQ0FBQztBQUNuQiwwRUFBMEU7QUFFMUUsb0dBQW9HO0FBQ3BHLDZFQUE2RTtBQUM3RSxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFRISVMgRklMRSBIQVMgR0xPQkFMIFNJREUgRUZGRUNUIC8vXG4vLyAgICAgICAoc2VlIGJvdHRvbSBvZiBmaWxlKSAgICAgICAvL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLyoqXG4gKiBAbW9kdWxlXG4gKiBAZGVzY3JpcHRpb25cbiAqIEVudHJ5IHBvaW50IGZvciBhbGwgQVBJcyBvZiB0aGUgY29tcGlsZXIgcGFja2FnZS5cbiAqXG4gKiA8ZGl2IGNsYXNzPVwiY2FsbG91dCBpcy1jcml0aWNhbFwiPlxuICogICA8aGVhZGVyPlVuc3RhYmxlIEFQSXM8L2hlYWRlcj5cbiAqICAgPHA+XG4gKiAgICAgQWxsIGNvbXBpbGVyIGFwaXMgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbCBhbmQgcHJpdmF0ZSFcbiAqICAgPC9wPlxuICogICA8cD5cbiAqICAgICBXZSBleHBlY3QgdGhlIEFQSXMgaW4gdGhpcyBwYWNrYWdlIHRvIGtlZXAgb24gY2hhbmdpbmcuIERvIG5vdCByZWx5IG9uIHRoZW0uXG4gKiAgIDwvcD5cbiAqIDwvZGl2PlxuICovXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7cHVibGlzaEZhY2FkZX0gZnJvbSAnLi9qaXRfY29tcGlsZXJfZmFjYWRlJztcbmltcG9ydCB7Z2xvYmFsfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQge0NVU1RPTV9FTEVNRU5UU19TQ0hFTUEsIE5PX0VSUk9SU19TQ0hFTUEsIFNjaGVtYU1ldGFkYXRhfSBmcm9tICcuL2NvcmUnO1xuZXhwb3J0IHtjb3JlfTtcblxuZXhwb3J0ICogZnJvbSAnLi92ZXJzaW9uJztcbmV4cG9ydCB7Q29tcGlsZXJDb25maWcsIHByZXNlcnZlV2hpdGVzcGFjZXNEZWZhdWx0fSBmcm9tICcuL2NvbmZpZyc7XG5leHBvcnQgKiBmcm9tICcuL3Jlc291cmNlX2xvYWRlcic7XG5leHBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi9jb25zdGFudF9wb29sJztcbmV4cG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuZXhwb3J0ICogZnJvbSAnLi9zY2hlbWEvZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuZXhwb3J0ICogZnJvbSAnLi9pMThuL2luZGV4JztcbmV4cG9ydCAqIGZyb20gJy4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmV4cG9ydCAqIGZyb20gJy4vZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIvYXN0JztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfdGFncyc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci90YWdzJztcbmV4cG9ydCB7UGFyc2VUcmVlUmVzdWx0LCBUcmVlRXJyb3J9IGZyb20gJy4vbWxfcGFyc2VyL3BhcnNlcic7XG5leHBvcnQge0xleGVyUmFuZ2V9IGZyb20gJy4vbWxfcGFyc2VyL2xleGVyJztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL3htbF9wYXJzZXInO1xuZXhwb3J0IHtBcnJheVR5cGUsIERZTkFNSUNfVFlQRSwgQmluYXJ5T3BlcmF0b3IsIEJpbmFyeU9wZXJhdG9yRXhwciwgQnVpbHRpblR5cGUsIEJ1aWx0aW5UeXBlTmFtZSwgQ29tbWFFeHByLCBDb25kaXRpb25hbEV4cHIsIERlY2xhcmVGdW5jdGlvblN0bXQsIERlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBFeHByZXNzaW9uU3RhdGVtZW50LCBFeHByZXNzaW9uVHlwZSwgRXhwcmVzc2lvblZpc2l0b3IsIEV4dGVybmFsRXhwciwgRXh0ZXJuYWxSZWZlcmVuY2UsIGxpdGVyYWxNYXAsIEZ1bmN0aW9uRXhwciwgSWZTdG10LCBJbnN0YW50aWF0ZUV4cHIsIEludm9rZUZ1bmN0aW9uRXhwciwgTGl0ZXJhbEFycmF5RXhwciwgTGl0ZXJhbEV4cHIsIExpdGVyYWxNYXBFeHByLCBNYXBUeXBlLCBOb3RFeHByLCBOT05FX1RZUEUsIFJlYWRLZXlFeHByLCBSZWFkUHJvcEV4cHIsIFJlYWRWYXJFeHByLCBSZXR1cm5TdGF0ZW1lbnQsIFN0YXRlbWVudFZpc2l0b3IsIFRhZ2dlZFRlbXBsYXRlRXhwciwgVGVtcGxhdGVMaXRlcmFsLCBUZW1wbGF0ZUxpdGVyYWxFbGVtZW50LCBUeXBlLCBUeXBlTW9kaWZpZXIsIFR5cGVWaXNpdG9yLCBXcmFwcGVkTm9kZUV4cHIsIFdyaXRlS2V5RXhwciwgV3JpdGVQcm9wRXhwciwgV3JpdGVWYXJFeHByLCBTdG10TW9kaWZpZXIsIFN0YXRlbWVudCwgU1RSSU5HX1RZUEUsIFR5cGVvZkV4cHIsIGpzRG9jQ29tbWVudCwgbGVhZGluZ0NvbW1lbnQsIExlYWRpbmdDb21tZW50LCBKU0RvY0NvbW1lbnQsIFVuYXJ5T3BlcmF0b3IsIFVuYXJ5T3BlcmF0b3JFeHByLCBMb2NhbGl6ZWRTdHJpbmcsIFRyYW5zcGxhbnRlZFR5cGV9IGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuZXhwb3J0IHtFbWl0dGVyVmlzaXRvckNvbnRleHR9IGZyb20gJy4vb3V0cHV0L2Fic3RyYWN0X2VtaXR0ZXInO1xuZXhwb3J0IHtKaXRFdmFsdWF0b3J9IGZyb20gJy4vb3V0cHV0L291dHB1dF9qaXQnO1xuZXhwb3J0ICogZnJvbSAnLi9wYXJzZV91dGlsJztcbmV4cG9ydCAqIGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5leHBvcnQgKiBmcm9tICcuL3NlbGVjdG9yJztcbmV4cG9ydCB7VmVyc2lvbn0gZnJvbSAnLi91dGlsJztcbmV4cG9ydCB7U291cmNlTWFwfSBmcm9tICcuL291dHB1dC9zb3VyY2VfbWFwJztcbmV4cG9ydCAqIGZyb20gJy4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmV4cG9ydCAqIGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL2FwaSc7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlcjMvdmlldy9hcGknO1xuZXhwb3J0IHtCb3VuZEF0dHJpYnV0ZSBhcyBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUsIEJvdW5kRXZlbnQgYXMgVG1wbEFzdEJvdW5kRXZlbnQsIEJvdW5kVGV4dCBhcyBUbXBsQXN0Qm91bmRUZXh0LCBDb250ZW50IGFzIFRtcGxBc3RDb250ZW50LCBFbGVtZW50IGFzIFRtcGxBc3RFbGVtZW50LCBJY3UgYXMgVG1wbEFzdEljdSwgTm9kZSBhcyBUbXBsQXN0Tm9kZSwgUmVjdXJzaXZlVmlzaXRvciBhcyBUbXBsQXN0UmVjdXJzaXZlVmlzaXRvciwgUmVmZXJlbmNlIGFzIFRtcGxBc3RSZWZlcmVuY2UsIFRlbXBsYXRlIGFzIFRtcGxBc3RUZW1wbGF0ZSwgVGV4dCBhcyBUbXBsQXN0VGV4dCwgVGV4dEF0dHJpYnV0ZSBhcyBUbXBsQXN0VGV4dEF0dHJpYnV0ZSwgVmFyaWFibGUgYXMgVG1wbEFzdFZhcmlhYmxlfSBmcm9tICcuL3JlbmRlcjMvcjNfYXN0JztcbmV4cG9ydCAqIGZyb20gJy4vcmVuZGVyMy92aWV3L3QyX2FwaSc7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlcjMvdmlldy90Ml9iaW5kZXInO1xuZXhwb3J0IHtJZGVudGlmaWVycyBhcyBSM0lkZW50aWZpZXJzfSBmcm9tICcuL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuZXhwb3J0IHtSM0NsYXNzTWV0YWRhdGEsIENvbXBpbGVDbGFzc01ldGFkYXRhRm4sIGNvbXBpbGVDbGFzc01ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfY2xhc3NfbWV0YWRhdGFfY29tcGlsZXInO1xuZXhwb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5TWV0YWRhdGEsIEZhY3RvcnlUYXJnZXR9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmV4cG9ydCB7Y29tcGlsZU5nTW9kdWxlLCBSM05nTW9kdWxlTWV0YWRhdGEsIFIzU2VsZWN0b3JTY29wZU1vZGUsIFIzTmdNb2R1bGVNZXRhZGF0YUtpbmQsIFIzTmdNb2R1bGVNZXRhZGF0YUdsb2JhbH0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5leHBvcnQge2NvbXBpbGVJbmplY3RvciwgUjNJbmplY3Rvck1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfaW5qZWN0b3JfY29tcGlsZXInO1xuZXhwb3J0IHtjb21waWxlUGlwZUZyb21NZXRhZGF0YSwgUjNQaXBlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19waXBlX2NvbXBpbGVyJztcbmV4cG9ydCB7bWFrZUJpbmRpbmdQYXJzZXIsIFBhcnNlZFRlbXBsYXRlLCBwYXJzZVRlbXBsYXRlLCBQYXJzZVRlbXBsYXRlT3B0aW9uc30gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUnO1xuZXhwb3J0IHtGb3J3YXJkUmVmSGFuZGxpbmcsIE1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24sIFIzQ29tcGlsZWRFeHByZXNzaW9uLCBSM1JlZmVyZW5jZSwgY3JlYXRlTWF5QmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgZGV2T25seUd1YXJkZWRFeHByZXNzaW9uLCBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmd9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmV4cG9ydCB7Y29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YSwgcGFyc2VIb3N0QmluZGluZ3MsIFBhcnNlZEhvc3RCaW5kaW5ncywgdmVyaWZ5SG9zdEJpbmRpbmdzfSBmcm9tICcuL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlQ2xhc3NNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvY2xhc3NfbWV0YWRhdGEnO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgRGVjbGFyZUNvbXBvbmVudFRlbXBsYXRlSW5mb30gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvY29tcG9uZW50JztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVEaXJlY3RpdmVGcm9tTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL2RpcmVjdGl2ZSc7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9mYWN0b3J5JztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVJbmplY3RhYmxlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9pbmplY3RhYmxlJztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVJbmplY3RvckZyb21NZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvaW5qZWN0b3InO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZU5nTW9kdWxlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9uZ19tb2R1bGUnO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZVBpcGVGcm9tTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL3BpcGUnO1xuZXhwb3J0IHtwdWJsaXNoRmFjYWRlfSBmcm9tICcuL2ppdF9jb21waWxlcl9mYWNhZGUnO1xuZXhwb3J0IHtlbWl0RGlzdGluY3RDaGFuZ2VzT25seURlZmF1bHRWYWx1ZSwgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0ICogYXMgb3V0cHV0QXN0IGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuZXhwb3J0IHtvdXRwdXRBc3R9O1xuLy8gVGhpcyBmaWxlIG9ubHkgcmVleHBvcnRzIGNvbnRlbnQgb2YgdGhlIGBzcmNgIGZvbGRlci4gS2VlcCBpdCB0aGF0IHdheS5cblxuLy8gVGhpcyBmdW5jdGlvbiBjYWxsIGhhcyBhIGdsb2JhbCBzaWRlIGVmZmVjdHMgYW5kIHB1Ymxpc2hlcyB0aGUgY29tcGlsZXIgaW50byBnbG9iYWwgbmFtZXNwYWNlIGZvclxuLy8gdGhlIGxhdGUgYmluZGluZyBvZiB0aGUgQ29tcGlsZXIgdG8gdGhlIEBhbmd1bGFyL2NvcmUgZm9yIGppdCBjb21waWxhdGlvbi5cbnB1Ymxpc2hGYWNhZGUoZ2xvYmFsKTtcbiJdfQ==