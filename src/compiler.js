/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/compiler", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/jit_compiler_facade", "@angular/compiler/src/util", "@angular/compiler/src/core", "@angular/compiler/src/version", "@angular/compiler/src/template_parser/template_ast", "@angular/compiler/src/config", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/aot/compiler_factory", "@angular/compiler/src/aot/compiler", "@angular/compiler/src/aot/generated_file", "@angular/compiler/src/aot/compiler_options", "@angular/compiler/src/aot/compiler_host", "@angular/compiler/src/aot/formatted_error", "@angular/compiler/src/aot/partial_module", "@angular/compiler/src/aot/static_reflector", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/aot/static_symbol_resolver", "@angular/compiler/src/aot/summary_resolver", "@angular/compiler/src/aot/util", "@angular/compiler/src/ast_path", "@angular/compiler/src/summary_resolver", "@angular/compiler/src/identifiers", "@angular/compiler/src/jit/compiler", "@angular/compiler/src/compile_reflector", "@angular/compiler/src/url_resolver", "@angular/compiler/src/resource_loader", "@angular/compiler/src/constant_pool", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/pipe_resolver", "@angular/compiler/src/ng_module_resolver", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/schema/element_schema_registry", "@angular/compiler/src/i18n/index", "@angular/compiler/src/directive_normalizer", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/metadata_resolver", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_tags", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/ml_parser/xml_parser", "@angular/compiler/src/ng_module_compiler", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/output/ts_emitter", "@angular/compiler/src/parse_util", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/selector", "@angular/compiler/src/style_compiler", "@angular/compiler/src/template_parser/template_parser", "@angular/compiler/src/view_compiler/view_compiler", "@angular/compiler/src/util", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/render3/view/api", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/view/t2_api", "@angular/compiler/src/render3/view/t2_binder", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/partial/directive", "@angular/compiler/src/jit_compiler_facade"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishFacade = exports.compileDeclareDirectiveFromMetadata = exports.verifyHostBindings = exports.parseHostBindings = exports.compileDirectiveFromMetadata = exports.compileComponentFromMetadata = exports.parseTemplate = exports.makeBindingParser = exports.compilePipeFromMetadata = exports.compileNgModule = exports.compileInjector = exports.R3FactoryTarget = exports.compileFactoryFunction = exports.R3ResolvedDependencyType = exports.R3Identifiers = exports.TmplAstVariable = exports.TmplAstTextAttribute = exports.TmplAstText = exports.TmplAstTemplate = exports.TmplAstReference = exports.TmplAstRecursiveVisitor = exports.TmplAstIcu = exports.TmplAstElement = exports.TmplAstContent = exports.TmplAstBoundText = exports.TmplAstBoundEvent = exports.TmplAstBoundAttribute = exports.Version = exports.syntaxError = exports.isSyntaxError = exports.getParseErrors = exports.ViewCompiler = exports.JitEvaluator = exports.EmitterVisitorContext = exports.LocalizedString = exports.UnaryOperatorExpr = exports.UnaryOperator = exports.JSDocComment = exports.LeadingComment = exports.leadingComment = exports.jsDocComment = exports.collectExternalReferences = exports.TypeofExpr = exports.STRING_TYPE = exports.Statement = exports.StmtModifier = exports.WriteVarExpr = exports.WritePropExpr = exports.WriteKeyExpr = exports.WrappedNodeExpr = exports.Type = exports.TryCatchStmt = exports.ThrowStmt = exports.ReturnStatement = exports.ReadVarExpr = exports.ReadPropExpr = exports.ReadKeyExpr = exports.NONE_TYPE = exports.NotExpr = exports.MapType = exports.LiteralMapExpr = exports.LiteralExpr = exports.LiteralArrayExpr = exports.InvokeMethodExpr = exports.InvokeFunctionExpr = exports.InstantiateExpr = exports.IfStmt = exports.FunctionExpr = exports.literalMap = exports.ExternalReference = exports.ExternalExpr = exports.ExpressionType = exports.ExpressionStatement = exports.Expression = exports.DeclareVarStmt = exports.DeclareFunctionStmt = exports.ConditionalExpr = exports.CommaExpr = exports.ClassStmt = exports.ClassMethod = exports.ClassField = exports.CastExpr = exports.BuiltinVar = exports.BuiltinTypeName = exports.BuiltinType = exports.BuiltinMethod = exports.BinaryOperatorExpr = exports.BinaryOperator = exports.DYNAMIC_TYPE = exports.AssertNotNull = exports.ArrayType = exports.NgModuleCompiler = exports.InterpolationConfig = exports.DEFAULT_INTERPOLATION_CONFIG = exports.NgModuleResolver = exports.PipeResolver = exports.DirectiveResolver = exports.ConstantPool = exports.JitCompiler = exports.Identifiers = exports.createLoweredSymbol = exports.isLoweredSymbol = exports.preserveWhitespacesDefault = exports.CompilerConfig = exports.core = exports.NO_ERRORS_SCHEMA = exports.CUSTOM_ELEMENTS_SCHEMA = void 0;
    var tslib_1 = require("tslib");
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
    var core = require("@angular/compiler/src/core");
    exports.core = core;
    var jit_compiler_facade_1 = require("@angular/compiler/src/jit_compiler_facade");
    var util_1 = require("@angular/compiler/src/util");
    var core_1 = require("@angular/compiler/src/core");
    Object.defineProperty(exports, "CUSTOM_ELEMENTS_SCHEMA", { enumerable: true, get: function () { return core_1.CUSTOM_ELEMENTS_SCHEMA; } });
    Object.defineProperty(exports, "NO_ERRORS_SCHEMA", { enumerable: true, get: function () { return core_1.NO_ERRORS_SCHEMA; } });
    tslib_1.__exportStar(require("@angular/compiler/src/version"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/template_parser/template_ast"), exports);
    var config_1 = require("@angular/compiler/src/config");
    Object.defineProperty(exports, "CompilerConfig", { enumerable: true, get: function () { return config_1.CompilerConfig; } });
    Object.defineProperty(exports, "preserveWhitespacesDefault", { enumerable: true, get: function () { return config_1.preserveWhitespacesDefault; } });
    tslib_1.__exportStar(require("@angular/compiler/src/compile_metadata"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/compiler_factory"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/compiler"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/generated_file"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/compiler_options"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/compiler_host"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/formatted_error"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/partial_module"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/static_reflector"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/static_symbol"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/static_symbol_resolver"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/aot/summary_resolver"), exports);
    var util_2 = require("@angular/compiler/src/aot/util");
    Object.defineProperty(exports, "isLoweredSymbol", { enumerable: true, get: function () { return util_2.isLoweredSymbol; } });
    Object.defineProperty(exports, "createLoweredSymbol", { enumerable: true, get: function () { return util_2.createLoweredSymbol; } });
    tslib_1.__exportStar(require("@angular/compiler/src/ast_path"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/summary_resolver"), exports);
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    Object.defineProperty(exports, "Identifiers", { enumerable: true, get: function () { return identifiers_1.Identifiers; } });
    var compiler_1 = require("@angular/compiler/src/jit/compiler");
    Object.defineProperty(exports, "JitCompiler", { enumerable: true, get: function () { return compiler_1.JitCompiler; } });
    tslib_1.__exportStar(require("@angular/compiler/src/compile_reflector"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/url_resolver"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/resource_loader"), exports);
    var constant_pool_1 = require("@angular/compiler/src/constant_pool");
    Object.defineProperty(exports, "ConstantPool", { enumerable: true, get: function () { return constant_pool_1.ConstantPool; } });
    var directive_resolver_1 = require("@angular/compiler/src/directive_resolver");
    Object.defineProperty(exports, "DirectiveResolver", { enumerable: true, get: function () { return directive_resolver_1.DirectiveResolver; } });
    var pipe_resolver_1 = require("@angular/compiler/src/pipe_resolver");
    Object.defineProperty(exports, "PipeResolver", { enumerable: true, get: function () { return pipe_resolver_1.PipeResolver; } });
    var ng_module_resolver_1 = require("@angular/compiler/src/ng_module_resolver");
    Object.defineProperty(exports, "NgModuleResolver", { enumerable: true, get: function () { return ng_module_resolver_1.NgModuleResolver; } });
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    Object.defineProperty(exports, "DEFAULT_INTERPOLATION_CONFIG", { enumerable: true, get: function () { return interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; } });
    Object.defineProperty(exports, "InterpolationConfig", { enumerable: true, get: function () { return interpolation_config_1.InterpolationConfig; } });
    tslib_1.__exportStar(require("@angular/compiler/src/schema/element_schema_registry"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/i18n/index"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/directive_normalizer"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/expression_parser/ast"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/expression_parser/lexer"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/expression_parser/parser"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/metadata_resolver"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/ml_parser/ast"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/ml_parser/html_parser"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/ml_parser/html_tags"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/ml_parser/interpolation_config"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/ml_parser/tags"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/ml_parser/xml_parser"), exports);
    var ng_module_compiler_1 = require("@angular/compiler/src/ng_module_compiler");
    Object.defineProperty(exports, "NgModuleCompiler", { enumerable: true, get: function () { return ng_module_compiler_1.NgModuleCompiler; } });
    var output_ast_1 = require("@angular/compiler/src/output/output_ast");
    Object.defineProperty(exports, "ArrayType", { enumerable: true, get: function () { return output_ast_1.ArrayType; } });
    Object.defineProperty(exports, "AssertNotNull", { enumerable: true, get: function () { return output_ast_1.AssertNotNull; } });
    Object.defineProperty(exports, "DYNAMIC_TYPE", { enumerable: true, get: function () { return output_ast_1.DYNAMIC_TYPE; } });
    Object.defineProperty(exports, "BinaryOperator", { enumerable: true, get: function () { return output_ast_1.BinaryOperator; } });
    Object.defineProperty(exports, "BinaryOperatorExpr", { enumerable: true, get: function () { return output_ast_1.BinaryOperatorExpr; } });
    Object.defineProperty(exports, "BuiltinMethod", { enumerable: true, get: function () { return output_ast_1.BuiltinMethod; } });
    Object.defineProperty(exports, "BuiltinType", { enumerable: true, get: function () { return output_ast_1.BuiltinType; } });
    Object.defineProperty(exports, "BuiltinTypeName", { enumerable: true, get: function () { return output_ast_1.BuiltinTypeName; } });
    Object.defineProperty(exports, "BuiltinVar", { enumerable: true, get: function () { return output_ast_1.BuiltinVar; } });
    Object.defineProperty(exports, "CastExpr", { enumerable: true, get: function () { return output_ast_1.CastExpr; } });
    Object.defineProperty(exports, "ClassField", { enumerable: true, get: function () { return output_ast_1.ClassField; } });
    Object.defineProperty(exports, "ClassMethod", { enumerable: true, get: function () { return output_ast_1.ClassMethod; } });
    Object.defineProperty(exports, "ClassStmt", { enumerable: true, get: function () { return output_ast_1.ClassStmt; } });
    Object.defineProperty(exports, "CommaExpr", { enumerable: true, get: function () { return output_ast_1.CommaExpr; } });
    Object.defineProperty(exports, "ConditionalExpr", { enumerable: true, get: function () { return output_ast_1.ConditionalExpr; } });
    Object.defineProperty(exports, "DeclareFunctionStmt", { enumerable: true, get: function () { return output_ast_1.DeclareFunctionStmt; } });
    Object.defineProperty(exports, "DeclareVarStmt", { enumerable: true, get: function () { return output_ast_1.DeclareVarStmt; } });
    Object.defineProperty(exports, "Expression", { enumerable: true, get: function () { return output_ast_1.Expression; } });
    Object.defineProperty(exports, "ExpressionStatement", { enumerable: true, get: function () { return output_ast_1.ExpressionStatement; } });
    Object.defineProperty(exports, "ExpressionType", { enumerable: true, get: function () { return output_ast_1.ExpressionType; } });
    Object.defineProperty(exports, "ExternalExpr", { enumerable: true, get: function () { return output_ast_1.ExternalExpr; } });
    Object.defineProperty(exports, "ExternalReference", { enumerable: true, get: function () { return output_ast_1.ExternalReference; } });
    Object.defineProperty(exports, "literalMap", { enumerable: true, get: function () { return output_ast_1.literalMap; } });
    Object.defineProperty(exports, "FunctionExpr", { enumerable: true, get: function () { return output_ast_1.FunctionExpr; } });
    Object.defineProperty(exports, "IfStmt", { enumerable: true, get: function () { return output_ast_1.IfStmt; } });
    Object.defineProperty(exports, "InstantiateExpr", { enumerable: true, get: function () { return output_ast_1.InstantiateExpr; } });
    Object.defineProperty(exports, "InvokeFunctionExpr", { enumerable: true, get: function () { return output_ast_1.InvokeFunctionExpr; } });
    Object.defineProperty(exports, "InvokeMethodExpr", { enumerable: true, get: function () { return output_ast_1.InvokeMethodExpr; } });
    Object.defineProperty(exports, "LiteralArrayExpr", { enumerable: true, get: function () { return output_ast_1.LiteralArrayExpr; } });
    Object.defineProperty(exports, "LiteralExpr", { enumerable: true, get: function () { return output_ast_1.LiteralExpr; } });
    Object.defineProperty(exports, "LiteralMapExpr", { enumerable: true, get: function () { return output_ast_1.LiteralMapExpr; } });
    Object.defineProperty(exports, "MapType", { enumerable: true, get: function () { return output_ast_1.MapType; } });
    Object.defineProperty(exports, "NotExpr", { enumerable: true, get: function () { return output_ast_1.NotExpr; } });
    Object.defineProperty(exports, "NONE_TYPE", { enumerable: true, get: function () { return output_ast_1.NONE_TYPE; } });
    Object.defineProperty(exports, "ReadKeyExpr", { enumerable: true, get: function () { return output_ast_1.ReadKeyExpr; } });
    Object.defineProperty(exports, "ReadPropExpr", { enumerable: true, get: function () { return output_ast_1.ReadPropExpr; } });
    Object.defineProperty(exports, "ReadVarExpr", { enumerable: true, get: function () { return output_ast_1.ReadVarExpr; } });
    Object.defineProperty(exports, "ReturnStatement", { enumerable: true, get: function () { return output_ast_1.ReturnStatement; } });
    Object.defineProperty(exports, "ThrowStmt", { enumerable: true, get: function () { return output_ast_1.ThrowStmt; } });
    Object.defineProperty(exports, "TryCatchStmt", { enumerable: true, get: function () { return output_ast_1.TryCatchStmt; } });
    Object.defineProperty(exports, "Type", { enumerable: true, get: function () { return output_ast_1.Type; } });
    Object.defineProperty(exports, "WrappedNodeExpr", { enumerable: true, get: function () { return output_ast_1.WrappedNodeExpr; } });
    Object.defineProperty(exports, "WriteKeyExpr", { enumerable: true, get: function () { return output_ast_1.WriteKeyExpr; } });
    Object.defineProperty(exports, "WritePropExpr", { enumerable: true, get: function () { return output_ast_1.WritePropExpr; } });
    Object.defineProperty(exports, "WriteVarExpr", { enumerable: true, get: function () { return output_ast_1.WriteVarExpr; } });
    Object.defineProperty(exports, "StmtModifier", { enumerable: true, get: function () { return output_ast_1.StmtModifier; } });
    Object.defineProperty(exports, "Statement", { enumerable: true, get: function () { return output_ast_1.Statement; } });
    Object.defineProperty(exports, "STRING_TYPE", { enumerable: true, get: function () { return output_ast_1.STRING_TYPE; } });
    Object.defineProperty(exports, "TypeofExpr", { enumerable: true, get: function () { return output_ast_1.TypeofExpr; } });
    Object.defineProperty(exports, "collectExternalReferences", { enumerable: true, get: function () { return output_ast_1.collectExternalReferences; } });
    Object.defineProperty(exports, "jsDocComment", { enumerable: true, get: function () { return output_ast_1.jsDocComment; } });
    Object.defineProperty(exports, "leadingComment", { enumerable: true, get: function () { return output_ast_1.leadingComment; } });
    Object.defineProperty(exports, "LeadingComment", { enumerable: true, get: function () { return output_ast_1.LeadingComment; } });
    Object.defineProperty(exports, "JSDocComment", { enumerable: true, get: function () { return output_ast_1.JSDocComment; } });
    Object.defineProperty(exports, "UnaryOperator", { enumerable: true, get: function () { return output_ast_1.UnaryOperator; } });
    Object.defineProperty(exports, "UnaryOperatorExpr", { enumerable: true, get: function () { return output_ast_1.UnaryOperatorExpr; } });
    Object.defineProperty(exports, "LocalizedString", { enumerable: true, get: function () { return output_ast_1.LocalizedString; } });
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    Object.defineProperty(exports, "EmitterVisitorContext", { enumerable: true, get: function () { return abstract_emitter_1.EmitterVisitorContext; } });
    var output_jit_1 = require("@angular/compiler/src/output/output_jit");
    Object.defineProperty(exports, "JitEvaluator", { enumerable: true, get: function () { return output_jit_1.JitEvaluator; } });
    tslib_1.__exportStar(require("@angular/compiler/src/output/ts_emitter"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/parse_util"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/schema/dom_element_schema_registry"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/selector"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/style_compiler"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/template_parser/template_parser"), exports);
    var view_compiler_1 = require("@angular/compiler/src/view_compiler/view_compiler");
    Object.defineProperty(exports, "ViewCompiler", { enumerable: true, get: function () { return view_compiler_1.ViewCompiler; } });
    var util_3 = require("@angular/compiler/src/util");
    Object.defineProperty(exports, "getParseErrors", { enumerable: true, get: function () { return util_3.getParseErrors; } });
    Object.defineProperty(exports, "isSyntaxError", { enumerable: true, get: function () { return util_3.isSyntaxError; } });
    Object.defineProperty(exports, "syntaxError", { enumerable: true, get: function () { return util_3.syntaxError; } });
    Object.defineProperty(exports, "Version", { enumerable: true, get: function () { return util_3.Version; } });
    tslib_1.__exportStar(require("@angular/compiler/src/injectable_compiler_2"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/render3/view/api"), exports);
    var r3_ast_1 = require("@angular/compiler/src/render3/r3_ast");
    Object.defineProperty(exports, "TmplAstBoundAttribute", { enumerable: true, get: function () { return r3_ast_1.BoundAttribute; } });
    Object.defineProperty(exports, "TmplAstBoundEvent", { enumerable: true, get: function () { return r3_ast_1.BoundEvent; } });
    Object.defineProperty(exports, "TmplAstBoundText", { enumerable: true, get: function () { return r3_ast_1.BoundText; } });
    Object.defineProperty(exports, "TmplAstContent", { enumerable: true, get: function () { return r3_ast_1.Content; } });
    Object.defineProperty(exports, "TmplAstElement", { enumerable: true, get: function () { return r3_ast_1.Element; } });
    Object.defineProperty(exports, "TmplAstIcu", { enumerable: true, get: function () { return r3_ast_1.Icu; } });
    Object.defineProperty(exports, "TmplAstRecursiveVisitor", { enumerable: true, get: function () { return r3_ast_1.RecursiveVisitor; } });
    Object.defineProperty(exports, "TmplAstReference", { enumerable: true, get: function () { return r3_ast_1.Reference; } });
    Object.defineProperty(exports, "TmplAstTemplate", { enumerable: true, get: function () { return r3_ast_1.Template; } });
    Object.defineProperty(exports, "TmplAstText", { enumerable: true, get: function () { return r3_ast_1.Text; } });
    Object.defineProperty(exports, "TmplAstTextAttribute", { enumerable: true, get: function () { return r3_ast_1.TextAttribute; } });
    Object.defineProperty(exports, "TmplAstVariable", { enumerable: true, get: function () { return r3_ast_1.Variable; } });
    tslib_1.__exportStar(require("@angular/compiler/src/render3/view/t2_api"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/render3/view/t2_binder"), exports);
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    Object.defineProperty(exports, "R3Identifiers", { enumerable: true, get: function () { return r3_identifiers_1.Identifiers; } });
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    Object.defineProperty(exports, "R3ResolvedDependencyType", { enumerable: true, get: function () { return r3_factory_1.R3ResolvedDependencyType; } });
    Object.defineProperty(exports, "compileFactoryFunction", { enumerable: true, get: function () { return r3_factory_1.compileFactoryFunction; } });
    Object.defineProperty(exports, "R3FactoryTarget", { enumerable: true, get: function () { return r3_factory_1.R3FactoryTarget; } });
    var r3_module_compiler_1 = require("@angular/compiler/src/render3/r3_module_compiler");
    Object.defineProperty(exports, "compileInjector", { enumerable: true, get: function () { return r3_module_compiler_1.compileInjector; } });
    Object.defineProperty(exports, "compileNgModule", { enumerable: true, get: function () { return r3_module_compiler_1.compileNgModule; } });
    var r3_pipe_compiler_1 = require("@angular/compiler/src/render3/r3_pipe_compiler");
    Object.defineProperty(exports, "compilePipeFromMetadata", { enumerable: true, get: function () { return r3_pipe_compiler_1.compilePipeFromMetadata; } });
    var template_1 = require("@angular/compiler/src/render3/view/template");
    Object.defineProperty(exports, "makeBindingParser", { enumerable: true, get: function () { return template_1.makeBindingParser; } });
    Object.defineProperty(exports, "parseTemplate", { enumerable: true, get: function () { return template_1.parseTemplate; } });
    var compiler_2 = require("@angular/compiler/src/render3/view/compiler");
    Object.defineProperty(exports, "compileComponentFromMetadata", { enumerable: true, get: function () { return compiler_2.compileComponentFromMetadata; } });
    Object.defineProperty(exports, "compileDirectiveFromMetadata", { enumerable: true, get: function () { return compiler_2.compileDirectiveFromMetadata; } });
    Object.defineProperty(exports, "parseHostBindings", { enumerable: true, get: function () { return compiler_2.parseHostBindings; } });
    Object.defineProperty(exports, "verifyHostBindings", { enumerable: true, get: function () { return compiler_2.verifyHostBindings; } });
    var directive_1 = require("@angular/compiler/src/render3/partial/directive");
    Object.defineProperty(exports, "compileDeclareDirectiveFromMetadata", { enumerable: true, get: function () { return directive_1.compileDeclareDirectiveFromMetadata; } });
    var jit_compiler_facade_2 = require("@angular/compiler/src/jit_compiler_facade");
    Object.defineProperty(exports, "publishFacade", { enumerable: true, get: function () { return jit_compiler_facade_2.publishFacade; } });
    // This file only reexports content of the `src` folder. Keep it that way.
    // This function call has a global side effects and publishes the compiler into global namespace for
    // the late binding of the Compiler to the @angular/core for jit compilation.
    jit_compiler_facade_1.publishFacade(util_1.global);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILHNDQUFzQztJQUN0QyxzQ0FBc0M7SUFDdEMsc0NBQXNDO0lBQ3RDLHNDQUFzQztJQUV0Qzs7Ozs7Ozs7Ozs7Ozs7T0FjRztJQUVILGlEQUErQjtJQUt2QixvQkFBSTtJQUpaLGlGQUFvRDtJQUNwRCxtREFBOEI7SUFFOUIsbURBQWdGO0lBQXhFLDhHQUFBLHNCQUFzQixPQUFBO0lBQUUsd0dBQUEsZ0JBQWdCLE9BQUE7SUFHaEQsd0VBQTBCO0lBQzFCLDZGQUErQztJQUMvQyx1REFBb0U7SUFBNUQsd0dBQUEsY0FBYyxPQUFBO0lBQUUsb0hBQUEsMEJBQTBCLE9BQUE7SUFDbEQsaUZBQW1DO0lBQ25DLHFGQUF1QztJQUN2Qyw2RUFBK0I7SUFDL0IsbUZBQXFDO0lBQ3JDLHFGQUF1QztJQUN2QyxrRkFBb0M7SUFDcEMsb0ZBQXNDO0lBQ3RDLG1GQUFxQztJQUNyQyxxRkFBdUM7SUFDdkMsa0ZBQW9DO0lBQ3BDLDJGQUE2QztJQUM3QyxxRkFBdUM7SUFDdkMsdURBQWdFO0lBQXhELHVHQUFBLGVBQWUsT0FBQTtJQUFFLDJHQUFBLG1CQUFtQixPQUFBO0lBRTVDLHlFQUEyQjtJQUMzQixpRkFBbUM7SUFDbkMsaUVBQTBDO0lBQWxDLDBHQUFBLFdBQVcsT0FBQTtJQUNuQiwrREFBMkM7SUFBbkMsdUdBQUEsV0FBVyxPQUFBO0lBQ25CLGtGQUFvQztJQUNwQyw2RUFBK0I7SUFDL0IsZ0ZBQWtDO0lBQ2xDLHFFQUE2QztJQUFyQyw2R0FBQSxZQUFZLE9BQUE7SUFDcEIsK0VBQXVEO0lBQS9DLHVIQUFBLGlCQUFpQixPQUFBO0lBQ3pCLHFFQUE2QztJQUFyQyw2R0FBQSxZQUFZLE9BQUE7SUFDcEIsK0VB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ICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBUSElTIEZJTEUgSEFTIEdMT0JBTCBTSURFIEVGRkVDVCAvL1xuLy8gICAgICAgKHNlZSBib3R0b20gb2YgZmlsZSkgICAgICAgLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbi8qKlxuICogQG1vZHVsZVxuICogQGRlc2NyaXB0aW9uXG4gKiBFbnRyeSBwb2ludCBmb3IgYWxsIEFQSXMgb2YgdGhlIGNvbXBpbGVyIHBhY2thZ2UuXG4gKlxuICogPGRpdiBjbGFzcz1cImNhbGxvdXQgaXMtY3JpdGljYWxcIj5cbiAqICAgPGhlYWRlcj5VbnN0YWJsZSBBUElzPC9oZWFkZXI+XG4gKiAgIDxwPlxuICogICAgIEFsbCBjb21waWxlciBhcGlzIGFyZSBjdXJyZW50bHkgY29uc2lkZXJlZCBleHBlcmltZW50YWwgYW5kIHByaXZhdGUhXG4gKiAgIDwvcD5cbiAqICAgPHA+XG4gKiAgICAgV2UgZXhwZWN0IHRoZSBBUElzIGluIHRoaXMgcGFja2FnZSB0byBrZWVwIG9uIGNoYW5naW5nLiBEbyBub3QgcmVseSBvbiB0aGVtLlxuICogICA8L3A+XG4gKiA8L2Rpdj5cbiAqL1xuXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4vY29yZSc7XG5pbXBvcnQge3B1Ymxpc2hGYWNhZGV9IGZyb20gJy4vaml0X2NvbXBpbGVyX2ZhY2FkZSc7XG5pbXBvcnQge2dsb2JhbH0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IHtDVVNUT01fRUxFTUVOVFNfU0NIRU1BLCBOT19FUlJPUlNfU0NIRU1BLCBTY2hlbWFNZXRhZGF0YX0gZnJvbSAnLi9jb3JlJztcbmV4cG9ydCB7Y29yZX07XG5cbmV4cG9ydCAqIGZyb20gJy4vdmVyc2lvbic7XG5leHBvcnQgKiBmcm9tICcuL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QnO1xuZXhwb3J0IHtDb21waWxlckNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlc0RlZmF1bHR9IGZyb20gJy4vY29uZmlnJztcbmV4cG9ydCAqIGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9jb21waWxlcl9mYWN0b3J5JztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2NvbXBpbGVyJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2dlbmVyYXRlZF9maWxlJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2NvbXBpbGVyX29wdGlvbnMnO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvY29tcGlsZXJfaG9zdCc7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9mb3JtYXR0ZWRfZXJyb3InO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvcGFydGlhbF9tb2R1bGUnO1xuZXhwb3J0ICogZnJvbSAnLi9hb3Qvc3RhdGljX3JlZmxlY3Rvcic7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9zdGF0aWNfc3ltYm9sJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L3N0YXRpY19zeW1ib2xfcmVzb2x2ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9hb3Qvc3VtbWFyeV9yZXNvbHZlcic7XG5leHBvcnQge2lzTG93ZXJlZFN5bWJvbCwgY3JlYXRlTG93ZXJlZFN5bWJvbH0gZnJvbSAnLi9hb3QvdXRpbCc7XG5leHBvcnQge0xhenlSb3V0ZX0gZnJvbSAnLi9hb3QvbGF6eV9yb3V0ZXMnO1xuZXhwb3J0ICogZnJvbSAnLi9hc3RfcGF0aCc7XG5leHBvcnQgKiBmcm9tICcuL3N1bW1hcnlfcmVzb2x2ZXInO1xuZXhwb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5leHBvcnQge0ppdENvbXBpbGVyfSBmcm9tICcuL2ppdC9jb21waWxlcic7XG5leHBvcnQgKiBmcm9tICcuL2NvbXBpbGVfcmVmbGVjdG9yJztcbmV4cG9ydCAqIGZyb20gJy4vdXJsX3Jlc29sdmVyJztcbmV4cG9ydCAqIGZyb20gJy4vcmVzb3VyY2VfbG9hZGVyJztcbmV4cG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuZXhwb3J0IHtEaXJlY3RpdmVSZXNvbHZlcn0gZnJvbSAnLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuZXhwb3J0IHtQaXBlUmVzb2x2ZXJ9IGZyb20gJy4vcGlwZV9yZXNvbHZlcic7XG5leHBvcnQge05nTW9kdWxlUmVzb2x2ZXJ9IGZyb20gJy4vbmdfbW9kdWxlX3Jlc29sdmVyJztcbmV4cG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuZXhwb3J0ICogZnJvbSAnLi9zY2hlbWEvZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuZXhwb3J0ICogZnJvbSAnLi9pMThuL2luZGV4JztcbmV4cG9ydCAqIGZyb20gJy4vZGlyZWN0aXZlX25vcm1hbGl6ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuZXhwb3J0ICogZnJvbSAnLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5leHBvcnQgKiBmcm9tICcuL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5leHBvcnQgKiBmcm9tICcuL21ldGFkYXRhX3Jlc29sdmVyJztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2FzdCc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci9odG1sX3RhZ3MnO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIvdGFncyc7XG5leHBvcnQge0xleGVyUmFuZ2V9IGZyb20gJy4vbWxfcGFyc2VyL2xleGVyJztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL3htbF9wYXJzZXInO1xuZXhwb3J0IHtOZ01vZHVsZUNvbXBpbGVyfSBmcm9tICcuL25nX21vZHVsZV9jb21waWxlcic7XG5leHBvcnQge0FycmF5VHlwZSwgQXNzZXJ0Tm90TnVsbCwgRFlOQU1JQ19UWVBFLCBCaW5hcnlPcGVyYXRvciwgQmluYXJ5T3BlcmF0b3JFeHByLCBCdWlsdGluTWV0aG9kLCBCdWlsdGluVHlwZSwgQnVpbHRpblR5cGVOYW1lLCBCdWlsdGluVmFyLCBDYXN0RXhwciwgQ2xhc3NGaWVsZCwgQ2xhc3NNZXRob2QsIENsYXNzU3RtdCwgQ29tbWFFeHByLCBDb25kaXRpb25hbEV4cHIsIERlY2xhcmVGdW5jdGlvblN0bXQsIERlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBFeHByZXNzaW9uU3RhdGVtZW50LCBFeHByZXNzaW9uVHlwZSwgRXhwcmVzc2lvblZpc2l0b3IsIEV4dGVybmFsRXhwciwgRXh0ZXJuYWxSZWZlcmVuY2UsIGxpdGVyYWxNYXAsIEZ1bmN0aW9uRXhwciwgSWZTdG10LCBJbnN0YW50aWF0ZUV4cHIsIEludm9rZUZ1bmN0aW9uRXhwciwgSW52b2tlTWV0aG9kRXhwciwgTGl0ZXJhbEFycmF5RXhwciwgTGl0ZXJhbEV4cHIsIExpdGVyYWxNYXBFeHByLCBNYXBUeXBlLCBOb3RFeHByLCBOT05FX1RZUEUsIFJlYWRLZXlFeHByLCBSZWFkUHJvcEV4cHIsIFJlYWRWYXJFeHByLCBSZXR1cm5TdGF0ZW1lbnQsIFN0YXRlbWVudFZpc2l0b3IsIFRocm93U3RtdCwgVHJ5Q2F0Y2hTdG10LCBUeXBlLCBUeXBlVmlzaXRvciwgV3JhcHBlZE5vZGVFeHByLCBXcml0ZUtleUV4cHIsIFdyaXRlUHJvcEV4cHIsIFdyaXRlVmFyRXhwciwgU3RtdE1vZGlmaWVyLCBTdGF0ZW1lbnQsIFNUUklOR19UWVBFLCBUeXBlb2ZFeHByLCBjb2xsZWN0RXh0ZXJuYWxSZWZlcmVuY2VzLCBqc0RvY0NvbW1lbnQsIGxlYWRpbmdDb21tZW50LCBMZWFkaW5nQ29tbWVudCwgSlNEb2NDb21tZW50LCBVbmFyeU9wZXJhdG9yLCBVbmFyeU9wZXJhdG9yRXhwciwgTG9jYWxpemVkU3RyaW5nfSBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmV4cG9ydCB7RW1pdHRlclZpc2l0b3JDb250ZXh0fSBmcm9tICcuL291dHB1dC9hYnN0cmFjdF9lbWl0dGVyJztcbmV4cG9ydCB7Sml0RXZhbHVhdG9yfSBmcm9tICcuL291dHB1dC9vdXRwdXRfaml0JztcbmV4cG9ydCAqIGZyb20gJy4vb3V0cHV0L3RzX2VtaXR0ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9wYXJzZV91dGlsJztcbmV4cG9ydCAqIGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5leHBvcnQgKiBmcm9tICcuL3NlbGVjdG9yJztcbmV4cG9ydCAqIGZyb20gJy4vc3R5bGVfY29tcGlsZXInO1xuZXhwb3J0ICogZnJvbSAnLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmV4cG9ydCB7Vmlld0NvbXBpbGVyfSBmcm9tICcuL3ZpZXdfY29tcGlsZXIvdmlld19jb21waWxlcic7XG5leHBvcnQge2dldFBhcnNlRXJyb3JzLCBpc1N5bnRheEVycm9yLCBzeW50YXhFcnJvciwgVmVyc2lvbn0gZnJvbSAnLi91dGlsJztcbmV4cG9ydCB7U291cmNlTWFwfSBmcm9tICcuL291dHB1dC9zb3VyY2VfbWFwJztcbmV4cG9ydCAqIGZyb20gJy4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmV4cG9ydCAqIGZyb20gJy4vcmVuZGVyMy92aWV3L2FwaSc7XG5leHBvcnQge0JvdW5kQXR0cmlidXRlIGFzIFRtcGxBc3RCb3VuZEF0dHJpYnV0ZSwgQm91bmRFdmVudCBhcyBUbXBsQXN0Qm91bmRFdmVudCwgQm91bmRUZXh0IGFzIFRtcGxBc3RCb3VuZFRleHQsIENvbnRlbnQgYXMgVG1wbEFzdENvbnRlbnQsIEVsZW1lbnQgYXMgVG1wbEFzdEVsZW1lbnQsIEljdSBhcyBUbXBsQXN0SWN1LCBOb2RlIGFzIFRtcGxBc3ROb2RlLCBSZWN1cnNpdmVWaXNpdG9yIGFzIFRtcGxBc3RSZWN1cnNpdmVWaXNpdG9yLCBSZWZlcmVuY2UgYXMgVG1wbEFzdFJlZmVyZW5jZSwgVGVtcGxhdGUgYXMgVG1wbEFzdFRlbXBsYXRlLCBUZXh0IGFzIFRtcGxBc3RUZXh0LCBUZXh0QXR0cmlidXRlIGFzIFRtcGxBc3RUZXh0QXR0cmlidXRlLCBWYXJpYWJsZSBhcyBUbXBsQXN0VmFyaWFibGV9IGZyb20gJy4vcmVuZGVyMy9yM19hc3QnO1xuZXhwb3J0ICogZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdDJfYXBpJztcbmV4cG9ydCAqIGZyb20gJy4vcmVuZGVyMy92aWV3L3QyX2JpbmRlcic7XG5leHBvcnQge0lkZW50aWZpZXJzIGFzIFIzSWRlbnRpZmllcnN9IGZyb20gJy4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5leHBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUsIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIFIzRmFjdG9yeU1ldGFkYXRhLCBSM0ZhY3RvcnlUYXJnZXR9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmV4cG9ydCB7Y29tcGlsZUluamVjdG9yLCBjb21waWxlTmdNb2R1bGUsIFIzSW5qZWN0b3JNZXRhZGF0YSwgUjNOZ01vZHVsZU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyJztcbmV4cG9ydCB7Y29tcGlsZVBpcGVGcm9tTWV0YWRhdGEsIFIzUGlwZU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfcGlwZV9jb21waWxlcic7XG5leHBvcnQge21ha2VCaW5kaW5nUGFyc2VyLCBQYXJzZWRUZW1wbGF0ZSwgcGFyc2VUZW1wbGF0ZSwgUGFyc2VUZW1wbGF0ZU9wdGlvbnN9IGZyb20gJy4vcmVuZGVyMy92aWV3L3RlbXBsYXRlJztcbmV4cG9ydCB7UjNSZWZlcmVuY2V9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmV4cG9ydCB7Y29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YSwgcGFyc2VIb3N0QmluZGluZ3MsIFBhcnNlZEhvc3RCaW5kaW5ncywgdmVyaWZ5SG9zdEJpbmRpbmdzfSBmcm9tICcuL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlRGlyZWN0aXZlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUnO1xuZXhwb3J0IHtwdWJsaXNoRmFjYWRlfSBmcm9tICcuL2ppdF9jb21waWxlcl9mYWNhZGUnO1xuLy8gVGhpcyBmaWxlIG9ubHkgcmVleHBvcnRzIGNvbnRlbnQgb2YgdGhlIGBzcmNgIGZvbGRlci4gS2VlcCBpdCB0aGF0IHdheS5cblxuLy8gVGhpcyBmdW5jdGlvbiBjYWxsIGhhcyBhIGdsb2JhbCBzaWRlIGVmZmVjdHMgYW5kIHB1Ymxpc2hlcyB0aGUgY29tcGlsZXIgaW50byBnbG9iYWwgbmFtZXNwYWNlIGZvclxuLy8gdGhlIGxhdGUgYmluZGluZyBvZiB0aGUgQ29tcGlsZXIgdG8gdGhlIEBhbmd1bGFyL2NvcmUgZm9yIGppdCBjb21waWxhdGlvbi5cbnB1Ymxpc2hGYWNhZGUoZ2xvYmFsKTtcbiJdfQ==