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
        define("@angular/compiler/src/compiler", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/jit_compiler_facade", "@angular/compiler/src/util", "@angular/compiler/src/core", "@angular/compiler/src/version", "@angular/compiler/src/template_parser/template_ast", "@angular/compiler/src/config", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/aot/compiler_factory", "@angular/compiler/src/aot/compiler", "@angular/compiler/src/aot/generated_file", "@angular/compiler/src/aot/compiler_options", "@angular/compiler/src/aot/compiler_host", "@angular/compiler/src/aot/formatted_error", "@angular/compiler/src/aot/partial_module", "@angular/compiler/src/aot/static_reflector", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/aot/static_symbol_resolver", "@angular/compiler/src/aot/summary_resolver", "@angular/compiler/src/aot/util", "@angular/compiler/src/ast_path", "@angular/compiler/src/summary_resolver", "@angular/compiler/src/identifiers", "@angular/compiler/src/jit/compiler", "@angular/compiler/src/compile_reflector", "@angular/compiler/src/url_resolver", "@angular/compiler/src/resource_loader", "@angular/compiler/src/constant_pool", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/pipe_resolver", "@angular/compiler/src/ng_module_resolver", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/schema/element_schema_registry", "@angular/compiler/src/i18n/index", "@angular/compiler/src/directive_normalizer", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/metadata_resolver", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_tags", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/ml_parser/xml_parser", "@angular/compiler/src/ng_module_compiler", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/output/ts_emitter", "@angular/compiler/src/parse_util", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/selector", "@angular/compiler/src/style_compiler", "@angular/compiler/src/template_parser/template_parser", "@angular/compiler/src/view_compiler/view_compiler", "@angular/compiler/src/util", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/render3/partial/api", "@angular/compiler/src/render3/view/api", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/view/t2_api", "@angular/compiler/src/render3/view/t2_binder", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_class_metadata_compiler", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_injector_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/partial/class_metadata", "@angular/compiler/src/render3/partial/component", "@angular/compiler/src/render3/partial/directive", "@angular/compiler/src/render3/partial/factory", "@angular/compiler/src/render3/partial/injectable", "@angular/compiler/src/render3/partial/injector", "@angular/compiler/src/render3/partial/ng_module", "@angular/compiler/src/render3/partial/pipe", "@angular/compiler/src/jit_compiler_facade"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishFacade = exports.compileDeclarePipeFromMetadata = exports.compileDeclareNgModuleFromMetadata = exports.compileDeclareInjectorFromMetadata = exports.compileDeclareInjectableFromMetadata = exports.compileDeclareFactoryFunction = exports.compileDeclareDirectiveFromMetadata = exports.compileDeclareComponentFromMetadata = exports.compileDeclareClassMetadata = exports.verifyHostBindings = exports.parseHostBindings = exports.compileDirectiveFromMetadata = exports.compileComponentFromMetadata = exports.getSafePropertyAccessString = exports.devOnlyGuardedExpression = exports.parseTemplate = exports.makeBindingParser = exports.compilePipeFromMetadata = exports.compileInjector = exports.compileNgModule = exports.FactoryTarget = exports.compileFactoryFunction = exports.compileClassMetadata = exports.R3Identifiers = exports.TmplAstVariable = exports.TmplAstTextAttribute = exports.TmplAstText = exports.TmplAstTemplate = exports.TmplAstReference = exports.TmplAstRecursiveVisitor = exports.TmplAstIcu = exports.TmplAstElement = exports.TmplAstContent = exports.TmplAstBoundText = exports.TmplAstBoundEvent = exports.TmplAstBoundAttribute = exports.Version = exports.ViewCompiler = exports.JitEvaluator = exports.EmitterVisitorContext = exports.LocalizedString = exports.UnaryOperatorExpr = exports.UnaryOperator = exports.JSDocComment = exports.LeadingComment = exports.leadingComment = exports.jsDocComment = exports.collectExternalReferences = exports.TypeofExpr = exports.STRING_TYPE = exports.Statement = exports.StmtModifier = exports.WriteVarExpr = exports.WritePropExpr = exports.WriteKeyExpr = exports.WrappedNodeExpr = exports.Type = exports.TryCatchStmt = exports.ThrowStmt = exports.TemplateLiteralElement = exports.TemplateLiteral = exports.TaggedTemplateExpr = exports.ReturnStatement = exports.ReadVarExpr = exports.ReadPropExpr = exports.ReadKeyExpr = exports.NONE_TYPE = exports.NotExpr = exports.MapType = exports.LiteralMapExpr = exports.LiteralExpr = exports.LiteralArrayExpr = exports.InvokeFunctionExpr = exports.InstantiateExpr = exports.IfStmt = exports.FunctionExpr = exports.literalMap = exports.ExternalReference = exports.ExternalExpr = exports.ExpressionType = exports.ExpressionStatement = exports.Expression = exports.DeclareVarStmt = exports.DeclareFunctionStmt = exports.ConditionalExpr = exports.CommaExpr = exports.ClassStmt = exports.ClassMethod = exports.ClassField = exports.CastExpr = exports.BuiltinVar = exports.BuiltinTypeName = exports.BuiltinType = exports.BuiltinMethod = exports.BinaryOperatorExpr = exports.BinaryOperator = exports.DYNAMIC_TYPE = exports.AssertNotNull = exports.ArrayType = exports.NgModuleCompiler = exports.InterpolationConfig = exports.DEFAULT_INTERPOLATION_CONFIG = exports.NgModuleResolver = exports.PipeResolver = exports.DirectiveResolver = exports.ConstantPool = exports.JitCompiler = exports.Identifiers = exports.createLoweredSymbol = exports.isLoweredSymbol = exports.preserveWhitespacesDefault = exports.CompilerConfig = exports.core = exports.NO_ERRORS_SCHEMA = exports.CUSTOM_ELEMENTS_SCHEMA = void 0;
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
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/version"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/template_parser/template_ast"), exports);
    var config_1 = require("@angular/compiler/src/config");
    Object.defineProperty(exports, "CompilerConfig", { enumerable: true, get: function () { return config_1.CompilerConfig; } });
    Object.defineProperty(exports, "preserveWhitespacesDefault", { enumerable: true, get: function () { return config_1.preserveWhitespacesDefault; } });
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/compile_metadata"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/compiler_factory"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/compiler"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/generated_file"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/compiler_options"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/compiler_host"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/formatted_error"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/partial_module"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/static_reflector"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/static_symbol"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/static_symbol_resolver"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/aot/summary_resolver"), exports);
    var util_2 = require("@angular/compiler/src/aot/util");
    Object.defineProperty(exports, "isLoweredSymbol", { enumerable: true, get: function () { return util_2.isLoweredSymbol; } });
    Object.defineProperty(exports, "createLoweredSymbol", { enumerable: true, get: function () { return util_2.createLoweredSymbol; } });
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ast_path"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/summary_resolver"), exports);
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    Object.defineProperty(exports, "Identifiers", { enumerable: true, get: function () { return identifiers_1.Identifiers; } });
    var compiler_1 = require("@angular/compiler/src/jit/compiler");
    Object.defineProperty(exports, "JitCompiler", { enumerable: true, get: function () { return compiler_1.JitCompiler; } });
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/compile_reflector"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/url_resolver"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/resource_loader"), exports);
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
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/schema/element_schema_registry"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/i18n/index"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/directive_normalizer"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/expression_parser/ast"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/expression_parser/lexer"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/expression_parser/parser"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/metadata_resolver"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ml_parser/ast"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ml_parser/html_parser"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ml_parser/html_tags"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ml_parser/interpolation_config"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ml_parser/tags"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/ml_parser/xml_parser"), exports);
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
    Object.defineProperty(exports, "TaggedTemplateExpr", { enumerable: true, get: function () { return output_ast_1.TaggedTemplateExpr; } });
    Object.defineProperty(exports, "TemplateLiteral", { enumerable: true, get: function () { return output_ast_1.TemplateLiteral; } });
    Object.defineProperty(exports, "TemplateLiteralElement", { enumerable: true, get: function () { return output_ast_1.TemplateLiteralElement; } });
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
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/output/ts_emitter"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/parse_util"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/schema/dom_element_schema_registry"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/selector"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/style_compiler"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/template_parser/template_parser"), exports);
    var view_compiler_1 = require("@angular/compiler/src/view_compiler/view_compiler");
    Object.defineProperty(exports, "ViewCompiler", { enumerable: true, get: function () { return view_compiler_1.ViewCompiler; } });
    var util_3 = require("@angular/compiler/src/util");
    Object.defineProperty(exports, "Version", { enumerable: true, get: function () { return util_3.Version; } });
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/injectable_compiler_2"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/render3/partial/api"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/render3/view/api"), exports);
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
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/render3/view/t2_api"), exports);
    (0, tslib_1.__exportStar)(require("@angular/compiler/src/render3/view/t2_binder"), exports);
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    Object.defineProperty(exports, "R3Identifiers", { enumerable: true, get: function () { return r3_identifiers_1.Identifiers; } });
    var r3_class_metadata_compiler_1 = require("@angular/compiler/src/render3/r3_class_metadata_compiler");
    Object.defineProperty(exports, "compileClassMetadata", { enumerable: true, get: function () { return r3_class_metadata_compiler_1.compileClassMetadata; } });
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    Object.defineProperty(exports, "compileFactoryFunction", { enumerable: true, get: function () { return r3_factory_1.compileFactoryFunction; } });
    Object.defineProperty(exports, "FactoryTarget", { enumerable: true, get: function () { return r3_factory_1.FactoryTarget; } });
    var r3_module_compiler_1 = require("@angular/compiler/src/render3/r3_module_compiler");
    Object.defineProperty(exports, "compileNgModule", { enumerable: true, get: function () { return r3_module_compiler_1.compileNgModule; } });
    var r3_injector_compiler_1 = require("@angular/compiler/src/render3/r3_injector_compiler");
    Object.defineProperty(exports, "compileInjector", { enumerable: true, get: function () { return r3_injector_compiler_1.compileInjector; } });
    var r3_pipe_compiler_1 = require("@angular/compiler/src/render3/r3_pipe_compiler");
    Object.defineProperty(exports, "compilePipeFromMetadata", { enumerable: true, get: function () { return r3_pipe_compiler_1.compilePipeFromMetadata; } });
    var template_1 = require("@angular/compiler/src/render3/view/template");
    Object.defineProperty(exports, "makeBindingParser", { enumerable: true, get: function () { return template_1.makeBindingParser; } });
    Object.defineProperty(exports, "parseTemplate", { enumerable: true, get: function () { return template_1.parseTemplate; } });
    var util_4 = require("@angular/compiler/src/render3/util");
    Object.defineProperty(exports, "devOnlyGuardedExpression", { enumerable: true, get: function () { return util_4.devOnlyGuardedExpression; } });
    Object.defineProperty(exports, "getSafePropertyAccessString", { enumerable: true, get: function () { return util_4.getSafePropertyAccessString; } });
    var compiler_2 = require("@angular/compiler/src/render3/view/compiler");
    Object.defineProperty(exports, "compileComponentFromMetadata", { enumerable: true, get: function () { return compiler_2.compileComponentFromMetadata; } });
    Object.defineProperty(exports, "compileDirectiveFromMetadata", { enumerable: true, get: function () { return compiler_2.compileDirectiveFromMetadata; } });
    Object.defineProperty(exports, "parseHostBindings", { enumerable: true, get: function () { return compiler_2.parseHostBindings; } });
    Object.defineProperty(exports, "verifyHostBindings", { enumerable: true, get: function () { return compiler_2.verifyHostBindings; } });
    var class_metadata_1 = require("@angular/compiler/src/render3/partial/class_metadata");
    Object.defineProperty(exports, "compileDeclareClassMetadata", { enumerable: true, get: function () { return class_metadata_1.compileDeclareClassMetadata; } });
    var component_1 = require("@angular/compiler/src/render3/partial/component");
    Object.defineProperty(exports, "compileDeclareComponentFromMetadata", { enumerable: true, get: function () { return component_1.compileDeclareComponentFromMetadata; } });
    var directive_1 = require("@angular/compiler/src/render3/partial/directive");
    Object.defineProperty(exports, "compileDeclareDirectiveFromMetadata", { enumerable: true, get: function () { return directive_1.compileDeclareDirectiveFromMetadata; } });
    var factory_1 = require("@angular/compiler/src/render3/partial/factory");
    Object.defineProperty(exports, "compileDeclareFactoryFunction", { enumerable: true, get: function () { return factory_1.compileDeclareFactoryFunction; } });
    var injectable_1 = require("@angular/compiler/src/render3/partial/injectable");
    Object.defineProperty(exports, "compileDeclareInjectableFromMetadata", { enumerable: true, get: function () { return injectable_1.compileDeclareInjectableFromMetadata; } });
    var injector_1 = require("@angular/compiler/src/render3/partial/injector");
    Object.defineProperty(exports, "compileDeclareInjectorFromMetadata", { enumerable: true, get: function () { return injector_1.compileDeclareInjectorFromMetadata; } });
    var ng_module_1 = require("@angular/compiler/src/render3/partial/ng_module");
    Object.defineProperty(exports, "compileDeclareNgModuleFromMetadata", { enumerable: true, get: function () { return ng_module_1.compileDeclareNgModuleFromMetadata; } });
    var pipe_1 = require("@angular/compiler/src/render3/partial/pipe");
    Object.defineProperty(exports, "compileDeclarePipeFromMetadata", { enumerable: true, get: function () { return pipe_1.compileDeclarePipeFromMetadata; } });
    var jit_compiler_facade_2 = require("@angular/compiler/src/jit_compiler_facade");
    Object.defineProperty(exports, "publishFacade", { enumerable: true, get: function () { return jit_compiler_facade_2.publishFacade; } });
    // This file only reexports content of the `src` folder. Keep it that way.
    // This function call has a global side effects and publishes the compiler into global namespace for
    // the late binding of the Compiler to the @angular/core for jit compilation.
    (0, jit_compiler_facade_1.publishFacade)(util_1.global);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILHNDQUFzQztJQUN0QyxzQ0FBc0M7SUFDdEMsc0NBQXNDO0lBQ3RDLHNDQUFzQztJQUV0Qzs7Ozs7Ozs7Ozs7Ozs7T0FjRztJQUVILGlEQUErQjtJQUt2QixvQkFBSTtJQUpaLGlGQUFvRDtJQUNwRCxtREFBOEI7SUFFOUIsbURBQWdGO0lBQXhFLDhHQUFBLHNCQUFzQixPQUFBO0lBQUUsd0dBQUEsZ0JBQWdCLE9BQUE7SUFHaEQsNkVBQTBCO0lBQzFCLGtHQUErQztJQUMvQyx1REFBb0U7SUFBNUQsd0dBQUEsY0FBYyxPQUFBO0lBQUUsb0hBQUEsMEJBQTBCLE9BQUE7SUFDbEQsc0ZBQW1DO0lBQ25DLDBGQUF1QztJQUN2QyxrRkFBK0I7SUFDL0Isd0ZBQXFDO0lBQ3JDLDBGQUF1QztJQUN2Qyx1RkFBb0M7SUFDcEMseUZBQXNDO0lBQ3RDLHdGQUFxQztJQUNyQywwRkFBdUM7SUFDdkMsdUZBQW9DO0lBQ3BDLGdHQUE2QztJQUM3QywwRkFBdUM7SUFDdkMsdURBQWdFO0lBQXhELHVHQUFBLGVBQWUsT0FBQTtJQUFFLDJHQUFBLG1CQUFtQixPQUFBO0lBQzVDLDhFQUEyQjtJQUMzQixzRkFBbUM7SUFDbkMsaUVBQTBDO0lBQWxDLDBHQUFBLFdBQVcsT0FBQTtJQUNuQiwrREFBMkM7SUFBbkMsdUdBQUEsV0FBVyxPQUFBO0lBQ25CLHVGQUFvQztJQUNwQyxrRkFBK0I7SUFDL0IscUZBQWtDO0lBQ2xDLHFFQUE2QztJQUFyQyw2R0FBQSxZQUFZLE9BQUE7SUFDcEIsK0VBQXVEO0lBQS9DLHVIQUFBLGlCQUFpQixPQUFBO0lBQ3pCLHFFQUE2QztJQUFyQyw2R0FBQSxZQUFZLE9BQUE7SUFDcEIsK0VB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Q0FBbUMsT0FBQTtJQUMzQyx5RUFBd0U7SUFBaEUsd0hBQUEsNkJBQTZCLE9BQUE7SUFDckMsK0VBQWtGO0lBQTFFLGtJQUFBLG9DQUFvQyxPQUFBO0lBQzVDLDJFQUE4RTtJQUF0RSw4SEFBQSxrQ0FBa0MsT0FBQTtJQUMxQyw2RUFBK0U7SUFBdkUsK0hBQUEsa0NBQWtDLE9BQUE7SUFDMUMsbUVBQXNFO0lBQTlELHNIQUFBLDhCQUE4QixPQUFBO0lBQ3RDLGlGQUFvRDtJQUE1QyxvSEFBQSxhQUFhLE9BQUE7SUFDckIsMEVBQTBFO0lBRTFFLG9HQUFvRztJQUNwRyw2RUFBNkU7SUFDN0UsSUFBQSxtQ0FBYSxFQUFDLGFBQU0sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBUSElTIEZJTEUgSEFTIEdMT0JBTCBTSURFIEVGRkVDVCAvL1xuLy8gICAgICAgKHNlZSBib3R0b20gb2YgZmlsZSkgICAgICAgLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbi8qKlxuICogQG1vZHVsZVxuICogQGRlc2NyaXB0aW9uXG4gKiBFbnRyeSBwb2ludCBmb3IgYWxsIEFQSXMgb2YgdGhlIGNvbXBpbGVyIHBhY2thZ2UuXG4gKlxuICogPGRpdiBjbGFzcz1cImNhbGxvdXQgaXMtY3JpdGljYWxcIj5cbiAqICAgPGhlYWRlcj5VbnN0YWJsZSBBUElzPC9oZWFkZXI+XG4gKiAgIDxwPlxuICogICAgIEFsbCBjb21waWxlciBhcGlzIGFyZSBjdXJyZW50bHkgY29uc2lkZXJlZCBleHBlcmltZW50YWwgYW5kIHByaXZhdGUhXG4gKiAgIDwvcD5cbiAqICAgPHA+XG4gKiAgICAgV2UgZXhwZWN0IHRoZSBBUElzIGluIHRoaXMgcGFja2FnZSB0byBrZWVwIG9uIGNoYW5naW5nLiBEbyBub3QgcmVseSBvbiB0aGVtLlxuICogICA8L3A+XG4gKiA8L2Rpdj5cbiAqL1xuXG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4vY29yZSc7XG5pbXBvcnQge3B1Ymxpc2hGYWNhZGV9IGZyb20gJy4vaml0X2NvbXBpbGVyX2ZhY2FkZSc7XG5pbXBvcnQge2dsb2JhbH0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IHtDVVNUT01fRUxFTUVOVFNfU0NIRU1BLCBOT19FUlJPUlNfU0NIRU1BLCBTY2hlbWFNZXRhZGF0YX0gZnJvbSAnLi9jb3JlJztcbmV4cG9ydCB7Y29yZX07XG5cbmV4cG9ydCAqIGZyb20gJy4vdmVyc2lvbic7XG5leHBvcnQgKiBmcm9tICcuL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QnO1xuZXhwb3J0IHtDb21waWxlckNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlc0RlZmF1bHR9IGZyb20gJy4vY29uZmlnJztcbmV4cG9ydCAqIGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9jb21waWxlcl9mYWN0b3J5JztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2NvbXBpbGVyJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2dlbmVyYXRlZF9maWxlJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2NvbXBpbGVyX29wdGlvbnMnO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvY29tcGlsZXJfaG9zdCc7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9mb3JtYXR0ZWRfZXJyb3InO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvcGFydGlhbF9tb2R1bGUnO1xuZXhwb3J0ICogZnJvbSAnLi9hb3Qvc3RhdGljX3JlZmxlY3Rvcic7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9zdGF0aWNfc3ltYm9sJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L3N0YXRpY19zeW1ib2xfcmVzb2x2ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9hb3Qvc3VtbWFyeV9yZXNvbHZlcic7XG5leHBvcnQge2lzTG93ZXJlZFN5bWJvbCwgY3JlYXRlTG93ZXJlZFN5bWJvbH0gZnJvbSAnLi9hb3QvdXRpbCc7XG5leHBvcnQgKiBmcm9tICcuL2FzdF9wYXRoJztcbmV4cG9ydCAqIGZyb20gJy4vc3VtbWFyeV9yZXNvbHZlcic7XG5leHBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmV4cG9ydCB7Sml0Q29tcGlsZXJ9IGZyb20gJy4vaml0L2NvbXBpbGVyJztcbmV4cG9ydCAqIGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuZXhwb3J0ICogZnJvbSAnLi91cmxfcmVzb2x2ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuZXhwb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5leHBvcnQge0RpcmVjdGl2ZVJlc29sdmVyfSBmcm9tICcuL2RpcmVjdGl2ZV9yZXNvbHZlcic7XG5leHBvcnQge1BpcGVSZXNvbHZlcn0gZnJvbSAnLi9waXBlX3Jlc29sdmVyJztcbmV4cG9ydCB7TmdNb2R1bGVSZXNvbHZlcn0gZnJvbSAnLi9uZ19tb2R1bGVfcmVzb2x2ZXInO1xuZXhwb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5leHBvcnQgKiBmcm9tICcuL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5leHBvcnQgKiBmcm9tICcuL2kxOG4vaW5kZXgnO1xuZXhwb3J0ICogZnJvbSAnLi9kaXJlY3RpdmVfbm9ybWFsaXplcic7XG5leHBvcnQgKiBmcm9tICcuL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5leHBvcnQgKiBmcm9tICcuL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmV4cG9ydCAqIGZyb20gJy4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmV4cG9ydCAqIGZyb20gJy4vbWV0YWRhdGFfcmVzb2x2ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIvYXN0JztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfdGFncyc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci90YWdzJztcbmV4cG9ydCB7TGV4ZXJSYW5nZX0gZnJvbSAnLi9tbF9wYXJzZXIvbGV4ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIveG1sX3BhcnNlcic7XG5leHBvcnQge05nTW9kdWxlQ29tcGlsZXJ9IGZyb20gJy4vbmdfbW9kdWxlX2NvbXBpbGVyJztcbmV4cG9ydCB7QXJyYXlUeXBlLCBBc3NlcnROb3ROdWxsLCBEWU5BTUlDX1RZUEUsIEJpbmFyeU9wZXJhdG9yLCBCaW5hcnlPcGVyYXRvckV4cHIsIEJ1aWx0aW5NZXRob2QsIEJ1aWx0aW5UeXBlLCBCdWlsdGluVHlwZU5hbWUsIEJ1aWx0aW5WYXIsIENhc3RFeHByLCBDbGFzc0ZpZWxkLCBDbGFzc01ldGhvZCwgQ2xhc3NTdG10LCBDb21tYUV4cHIsIENvbmRpdGlvbmFsRXhwciwgRGVjbGFyZUZ1bmN0aW9uU3RtdCwgRGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb24sIEV4cHJlc3Npb25TdGF0ZW1lbnQsIEV4cHJlc3Npb25UeXBlLCBFeHByZXNzaW9uVmlzaXRvciwgRXh0ZXJuYWxFeHByLCBFeHRlcm5hbFJlZmVyZW5jZSwgbGl0ZXJhbE1hcCwgRnVuY3Rpb25FeHByLCBJZlN0bXQsIEluc3RhbnRpYXRlRXhwciwgSW52b2tlRnVuY3Rpb25FeHByLCBMaXRlcmFsQXJyYXlFeHByLCBMaXRlcmFsRXhwciwgTGl0ZXJhbE1hcEV4cHIsIE1hcFR5cGUsIE5vdEV4cHIsIE5PTkVfVFlQRSwgUmVhZEtleUV4cHIsIFJlYWRQcm9wRXhwciwgUmVhZFZhckV4cHIsIFJldHVyblN0YXRlbWVudCwgU3RhdGVtZW50VmlzaXRvciwgVGFnZ2VkVGVtcGxhdGVFeHByLCBUZW1wbGF0ZUxpdGVyYWwsIFRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQsIFRocm93U3RtdCwgVHJ5Q2F0Y2hTdG10LCBUeXBlLCBUeXBlVmlzaXRvciwgV3JhcHBlZE5vZGVFeHByLCBXcml0ZUtleUV4cHIsIFdyaXRlUHJvcEV4cHIsIFdyaXRlVmFyRXhwciwgU3RtdE1vZGlmaWVyLCBTdGF0ZW1lbnQsIFNUUklOR19UWVBFLCBUeXBlb2ZFeHByLCBjb2xsZWN0RXh0ZXJuYWxSZWZlcmVuY2VzLCBqc0RvY0NvbW1lbnQsIGxlYWRpbmdDb21tZW50LCBMZWFkaW5nQ29tbWVudCwgSlNEb2NDb21tZW50LCBVbmFyeU9wZXJhdG9yLCBVbmFyeU9wZXJhdG9yRXhwciwgTG9jYWxpemVkU3RyaW5nfSBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmV4cG9ydCB7RW1pdHRlclZpc2l0b3JDb250ZXh0fSBmcm9tICcuL291dHB1dC9hYnN0cmFjdF9lbWl0dGVyJztcbmV4cG9ydCB7Sml0RXZhbHVhdG9yfSBmcm9tICcuL291dHB1dC9vdXRwdXRfaml0JztcbmV4cG9ydCAqIGZyb20gJy4vb3V0cHV0L3RzX2VtaXR0ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9wYXJzZV91dGlsJztcbmV4cG9ydCAqIGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5leHBvcnQgKiBmcm9tICcuL3NlbGVjdG9yJztcbmV4cG9ydCAqIGZyb20gJy4vc3R5bGVfY29tcGlsZXInO1xuZXhwb3J0ICogZnJvbSAnLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmV4cG9ydCB7Vmlld0NvbXBpbGVyfSBmcm9tICcuL3ZpZXdfY29tcGlsZXIvdmlld19jb21waWxlcic7XG5leHBvcnQge1ZlcnNpb259IGZyb20gJy4vdXRpbCc7XG5leHBvcnQge1NvdXJjZU1hcH0gZnJvbSAnLi9vdXRwdXQvc291cmNlX21hcCc7XG5leHBvcnQgKiBmcm9tICcuL2luamVjdGFibGVfY29tcGlsZXJfMic7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9hcGknO1xuZXhwb3J0ICogZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmV4cG9ydCB7Qm91bmRBdHRyaWJ1dGUgYXMgVG1wbEFzdEJvdW5kQXR0cmlidXRlLCBCb3VuZEV2ZW50IGFzIFRtcGxBc3RCb3VuZEV2ZW50LCBCb3VuZFRleHQgYXMgVG1wbEFzdEJvdW5kVGV4dCwgQ29udGVudCBhcyBUbXBsQXN0Q29udGVudCwgRWxlbWVudCBhcyBUbXBsQXN0RWxlbWVudCwgSWN1IGFzIFRtcGxBc3RJY3UsIE5vZGUgYXMgVG1wbEFzdE5vZGUsIFJlY3Vyc2l2ZVZpc2l0b3IgYXMgVG1wbEFzdFJlY3Vyc2l2ZVZpc2l0b3IsIFJlZmVyZW5jZSBhcyBUbXBsQXN0UmVmZXJlbmNlLCBUZW1wbGF0ZSBhcyBUbXBsQXN0VGVtcGxhdGUsIFRleHQgYXMgVG1wbEFzdFRleHQsIFRleHRBdHRyaWJ1dGUgYXMgVG1wbEFzdFRleHRBdHRyaWJ1dGUsIFZhcmlhYmxlIGFzIFRtcGxBc3RWYXJpYWJsZX0gZnJvbSAnLi9yZW5kZXIzL3IzX2FzdCc7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlcjMvdmlldy90Ml9hcGknO1xuZXhwb3J0ICogZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdDJfYmluZGVyJztcbmV4cG9ydCB7SWRlbnRpZmllcnMgYXMgUjNJZGVudGlmaWVyc30gZnJvbSAnLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmV4cG9ydCB7UjNDbGFzc01ldGFkYXRhLCBDb21waWxlQ2xhc3NNZXRhZGF0YUZuLCBjb21waWxlQ2xhc3NNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX2NsYXNzX21ldGFkYXRhX2NvbXBpbGVyJztcbmV4cG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgUjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeU1ldGFkYXRhLCBGYWN0b3J5VGFyZ2V0fSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5leHBvcnQge2NvbXBpbGVOZ01vZHVsZSwgUjNOZ01vZHVsZU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyJztcbmV4cG9ydCB7Y29tcGlsZUluamVjdG9yLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlcic7XG5leHBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuZXhwb3J0IHttYWtlQmluZGluZ1BhcnNlciwgUGFyc2VkVGVtcGxhdGUsIHBhcnNlVGVtcGxhdGUsIFBhcnNlVGVtcGxhdGVPcHRpb25zfSBmcm9tICcuL3JlbmRlcjMvdmlldy90ZW1wbGF0ZSc7XG5leHBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9uLCBSM1JlZmVyZW5jZSwgZGV2T25seUd1YXJkZWRFeHByZXNzaW9uLCBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmd9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmV4cG9ydCB7Y29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YSwgcGFyc2VIb3N0QmluZGluZ3MsIFBhcnNlZEhvc3RCaW5kaW5ncywgdmVyaWZ5SG9zdEJpbmRpbmdzfSBmcm9tICcuL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlQ2xhc3NNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvY2xhc3NfbWV0YWRhdGEnO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgRGVjbGFyZUNvbXBvbmVudFRlbXBsYXRlSW5mb30gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvY29tcG9uZW50JztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVEaXJlY3RpdmVGcm9tTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL2RpcmVjdGl2ZSc7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9mYWN0b3J5JztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVJbmplY3RhYmxlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9pbmplY3RhYmxlJztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVJbmplY3RvckZyb21NZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvaW5qZWN0b3InO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZU5nTW9kdWxlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9uZ19tb2R1bGUnO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZVBpcGVGcm9tTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL3BpcGUnO1xuZXhwb3J0IHtwdWJsaXNoRmFjYWRlfSBmcm9tICcuL2ppdF9jb21waWxlcl9mYWNhZGUnO1xuLy8gVGhpcyBmaWxlIG9ubHkgcmVleHBvcnRzIGNvbnRlbnQgb2YgdGhlIGBzcmNgIGZvbGRlci4gS2VlcCBpdCB0aGF0IHdheS5cblxuLy8gVGhpcyBmdW5jdGlvbiBjYWxsIGhhcyBhIGdsb2JhbCBzaWRlIGVmZmVjdHMgYW5kIHB1Ymxpc2hlcyB0aGUgY29tcGlsZXIgaW50byBnbG9iYWwgbmFtZXNwYWNlIGZvclxuLy8gdGhlIGxhdGUgYmluZGluZyBvZiB0aGUgQ29tcGlsZXIgdG8gdGhlIEBhbmd1bGFyL2NvcmUgZm9yIGppdCBjb21waWxhdGlvbi5cbnB1Ymxpc2hGYWNhZGUoZ2xvYmFsKTtcbiJdfQ==