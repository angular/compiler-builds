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
    exports.publishFacade = exports.compileDeclarePipeFromMetadata = exports.compileDeclareNgModuleFromMetadata = exports.compileDeclareInjectorFromMetadata = exports.compileDeclareInjectableFromMetadata = exports.compileDeclareFactoryFunction = exports.compileDeclareDirectiveFromMetadata = exports.compileDeclareComponentFromMetadata = exports.compileDeclareClassMetadata = exports.verifyHostBindings = exports.parseHostBindings = exports.compileDirectiveFromMetadata = exports.compileComponentFromMetadata = exports.getSafePropertyAccessString = exports.devOnlyGuardedExpression = exports.createMayBeForwardRefExpression = exports.parseTemplate = exports.makeBindingParser = exports.compilePipeFromMetadata = exports.compileInjector = exports.compileNgModule = exports.FactoryTarget = exports.compileFactoryFunction = exports.compileClassMetadata = exports.R3Identifiers = exports.TmplAstVariable = exports.TmplAstTextAttribute = exports.TmplAstText = exports.TmplAstTemplate = exports.TmplAstReference = exports.TmplAstRecursiveVisitor = exports.TmplAstIcu = exports.TmplAstElement = exports.TmplAstContent = exports.TmplAstBoundText = exports.TmplAstBoundEvent = exports.TmplAstBoundAttribute = exports.Version = exports.ViewCompiler = exports.JitEvaluator = exports.EmitterVisitorContext = exports.LocalizedString = exports.UnaryOperatorExpr = exports.UnaryOperator = exports.JSDocComment = exports.LeadingComment = exports.leadingComment = exports.jsDocComment = exports.collectExternalReferences = exports.TypeofExpr = exports.STRING_TYPE = exports.Statement = exports.StmtModifier = exports.WriteVarExpr = exports.WritePropExpr = exports.WriteKeyExpr = exports.WrappedNodeExpr = exports.Type = exports.TryCatchStmt = exports.ThrowStmt = exports.TemplateLiteralElement = exports.TemplateLiteral = exports.TaggedTemplateExpr = exports.ReturnStatement = exports.ReadVarExpr = exports.ReadPropExpr = exports.ReadKeyExpr = exports.NONE_TYPE = exports.NotExpr = exports.MapType = exports.LiteralMapExpr = exports.LiteralExpr = exports.LiteralArrayExpr = exports.InvokeMethodExpr = exports.InvokeFunctionExpr = exports.InstantiateExpr = exports.IfStmt = exports.FunctionExpr = exports.literalMap = exports.ExternalReference = exports.ExternalExpr = exports.ExpressionType = exports.ExpressionStatement = exports.Expression = exports.DeclareVarStmt = exports.DeclareFunctionStmt = exports.ConditionalExpr = exports.CommaExpr = exports.ClassStmt = exports.ClassMethod = exports.ClassField = exports.CastExpr = exports.BuiltinVar = exports.BuiltinTypeName = exports.BuiltinType = exports.BuiltinMethod = exports.BinaryOperatorExpr = exports.BinaryOperator = exports.DYNAMIC_TYPE = exports.AssertNotNull = exports.ArrayType = exports.NgModuleCompiler = exports.InterpolationConfig = exports.DEFAULT_INTERPOLATION_CONFIG = exports.NgModuleResolver = exports.PipeResolver = exports.DirectiveResolver = exports.ConstantPool = exports.JitCompiler = exports.Identifiers = exports.createLoweredSymbol = exports.isLoweredSymbol = exports.preserveWhitespacesDefault = exports.CompilerConfig = exports.core = exports.NO_ERRORS_SCHEMA = exports.CUSTOM_ELEMENTS_SCHEMA = void 0;
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
    tslib_1.__exportStar(require("@angular/compiler/src/output/ts_emitter"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/parse_util"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/schema/dom_element_schema_registry"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/selector"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/style_compiler"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/template_parser/template_parser"), exports);
    var view_compiler_1 = require("@angular/compiler/src/view_compiler/view_compiler");
    Object.defineProperty(exports, "ViewCompiler", { enumerable: true, get: function () { return view_compiler_1.ViewCompiler; } });
    var util_3 = require("@angular/compiler/src/util");
    Object.defineProperty(exports, "Version", { enumerable: true, get: function () { return util_3.Version; } });
    tslib_1.__exportStar(require("@angular/compiler/src/injectable_compiler_2"), exports);
    tslib_1.__exportStar(require("@angular/compiler/src/render3/partial/api"), exports);
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
    Object.defineProperty(exports, "createMayBeForwardRefExpression", { enumerable: true, get: function () { return util_4.createMayBeForwardRefExpression; } });
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
    jit_compiler_facade_1.publishFacade(util_1.global);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILHNDQUFzQztJQUN0QyxzQ0FBc0M7SUFDdEMsc0NBQXNDO0lBQ3RDLHNDQUFzQztJQUV0Qzs7Ozs7Ozs7Ozs7Ozs7T0FjRztJQUVILGlEQUErQjtJQUt2QixvQkFBSTtJQUpaLGlGQUFvRDtJQUNwRCxtREFBOEI7SUFFOUIsbURBQWdGO0lBQXhFLDhHQUFBLHNCQUFzQixPQUFBO0lBQUUsd0dBQUEsZ0JBQWdCLE9BQUE7SUFHaEQsd0VBQTBCO0lBQzFCLDZGQUErQztJQUMvQyx1REFBb0U7SUFBNUQsd0dBQUEsY0FBYyxPQUFBO0lBQUUsb0hBQUEsMEJBQTBCLE9BQUE7SUFDbEQsaUZBQW1DO0lBQ25DLHFGQUF1QztJQUN2Qyw2RUFBK0I7SUFDL0IsbUZBQXFDO0lBQ3JDLHFGQUF1QztJQUN2QyxrRkFBb0M7SUFDcEMsb0ZBQXNDO0lBQ3RDLG1GQUFxQztJQUNyQyxxRkFBdUM7SUFDdkMsa0ZBQW9DO0lBQ3BDLDJGQUE2QztJQUM3QyxxRkFBdUM7SUFDdkMsdURBQWdFO0lBQXhELHVHQUFBLGVBQWUsT0FBQTtJQUFFLDJHQUFBLG1CQUFtQixPQUFBO0lBRTVDLHlFQUEyQjtJQUMzQixpRkFBbUM7SUFDbkMsaUVBQTBDO0lBQWxDLDBHQUFBLFdBQVcsT0FBQTtJQUNuQiwrREFBMkM7SUFBbkMsdUdBQUEsV0FBVyxPQUFBO0lBQ25CLGtGQUFvQztJQUNwQyw2RUFBK0I7SUFDL0IsZ0ZBQWtDO0lBQ2xDLHFFQUE2QztJQUFyQyw2R0FBQSxZQUFZLE9BQUE7SUFDcEIsK0VBQXVEO0lBQS9DLHVIQUFBLGlCQUFpQixPQUFBO0lBQ3pCLHFFQUE2QztJQUFyQyw2R0FBQSxZQUFZLE9BQUE7SUFDcEIsK0VB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RyxnSUFBQSxtQ0FBbUMsT0FBQTtJQUMzQyw2RUFBZ0Y7SUFBeEUsZ0lBQUEsbUNBQW1DLE9BQUE7SUFDM0MseUVBQXdFO0lBQWhFLHdIQUFBLDZCQUE2QixPQUFBO0lBQ3JDLCtFQUFrRjtJQUExRSxrSUFBQSxvQ0FBb0MsT0FBQTtJQUM1QywyRUFBOEU7SUFBdEUsOEhBQUEsa0NBQWtDLE9BQUE7SUFDMUMsNkVBQStFO0lBQXZFLCtIQUFBLGtDQUFrQyxPQUFBO0lBQzFDLG1FQUFzRTtJQUE5RCxzSEFBQSw4QkFBOEIsT0FBQTtJQUN0QyxpRkFBb0Q7SUFBNUMsb0hBQUEsYUFBYSxPQUFBO0lBQ3JCLDBFQUEwRTtJQUUxRSxvR0FBb0c7SUFDcEcsNkVBQTZFO0lBQzdFLG1DQUFhLENBQUMsYUFBTSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFRISVMgRklMRSBIQVMgR0xPQkFMIFNJREUgRUZGRUNUIC8vXG4vLyAgICAgICAoc2VlIGJvdHRvbSBvZiBmaWxlKSAgICAgICAvL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLyoqXG4gKiBAbW9kdWxlXG4gKiBAZGVzY3JpcHRpb25cbiAqIEVudHJ5IHBvaW50IGZvciBhbGwgQVBJcyBvZiB0aGUgY29tcGlsZXIgcGFja2FnZS5cbiAqXG4gKiA8ZGl2IGNsYXNzPVwiY2FsbG91dCBpcy1jcml0aWNhbFwiPlxuICogICA8aGVhZGVyPlVuc3RhYmxlIEFQSXM8L2hlYWRlcj5cbiAqICAgPHA+XG4gKiAgICAgQWxsIGNvbXBpbGVyIGFwaXMgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbCBhbmQgcHJpdmF0ZSFcbiAqICAgPC9wPlxuICogICA8cD5cbiAqICAgICBXZSBleHBlY3QgdGhlIEFQSXMgaW4gdGhpcyBwYWNrYWdlIHRvIGtlZXAgb24gY2hhbmdpbmcuIERvIG5vdCByZWx5IG9uIHRoZW0uXG4gKiAgIDwvcD5cbiAqIDwvZGl2PlxuICovXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7cHVibGlzaEZhY2FkZX0gZnJvbSAnLi9qaXRfY29tcGlsZXJfZmFjYWRlJztcbmltcG9ydCB7Z2xvYmFsfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQge0NVU1RPTV9FTEVNRU5UU19TQ0hFTUEsIE5PX0VSUk9SU19TQ0hFTUEsIFNjaGVtYU1ldGFkYXRhfSBmcm9tICcuL2NvcmUnO1xuZXhwb3J0IHtjb3JlfTtcblxuZXhwb3J0ICogZnJvbSAnLi92ZXJzaW9uJztcbmV4cG9ydCAqIGZyb20gJy4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5leHBvcnQge0NvbXBpbGVyQ29uZmlnLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzRGVmYXVsdH0gZnJvbSAnLi9jb25maWcnO1xuZXhwb3J0ICogZnJvbSAnLi9jb21waWxlX21ldGFkYXRhJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2NvbXBpbGVyX2ZhY3RvcnknO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvY29tcGlsZXInO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvZ2VuZXJhdGVkX2ZpbGUnO1xuZXhwb3J0ICogZnJvbSAnLi9hb3QvY29tcGlsZXJfb3B0aW9ucyc7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9jb21waWxlcl9ob3N0JztcbmV4cG9ydCAqIGZyb20gJy4vYW90L2Zvcm1hdHRlZF9lcnJvcic7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9wYXJ0aWFsX21vZHVsZSc7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9zdGF0aWNfcmVmbGVjdG9yJztcbmV4cG9ydCAqIGZyb20gJy4vYW90L3N0YXRpY19zeW1ib2wnO1xuZXhwb3J0ICogZnJvbSAnLi9hb3Qvc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5leHBvcnQgKiBmcm9tICcuL2FvdC9zdW1tYXJ5X3Jlc29sdmVyJztcbmV4cG9ydCB7aXNMb3dlcmVkU3ltYm9sLCBjcmVhdGVMb3dlcmVkU3ltYm9sfSBmcm9tICcuL2FvdC91dGlsJztcbmV4cG9ydCB7TGF6eVJvdXRlfSBmcm9tICcuL2FvdC9sYXp5X3JvdXRlcyc7XG5leHBvcnQgKiBmcm9tICcuL2FzdF9wYXRoJztcbmV4cG9ydCAqIGZyb20gJy4vc3VtbWFyeV9yZXNvbHZlcic7XG5leHBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmV4cG9ydCB7Sml0Q29tcGlsZXJ9IGZyb20gJy4vaml0L2NvbXBpbGVyJztcbmV4cG9ydCAqIGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuZXhwb3J0ICogZnJvbSAnLi91cmxfcmVzb2x2ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuZXhwb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5leHBvcnQge0RpcmVjdGl2ZVJlc29sdmVyfSBmcm9tICcuL2RpcmVjdGl2ZV9yZXNvbHZlcic7XG5leHBvcnQge1BpcGVSZXNvbHZlcn0gZnJvbSAnLi9waXBlX3Jlc29sdmVyJztcbmV4cG9ydCB7TmdNb2R1bGVSZXNvbHZlcn0gZnJvbSAnLi9uZ19tb2R1bGVfcmVzb2x2ZXInO1xuZXhwb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5leHBvcnQgKiBmcm9tICcuL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5leHBvcnQgKiBmcm9tICcuL2kxOG4vaW5kZXgnO1xuZXhwb3J0ICogZnJvbSAnLi9kaXJlY3RpdmVfbm9ybWFsaXplcic7XG5leHBvcnQgKiBmcm9tICcuL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5leHBvcnQgKiBmcm9tICcuL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmV4cG9ydCAqIGZyb20gJy4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmV4cG9ydCAqIGZyb20gJy4vbWV0YWRhdGFfcmVzb2x2ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIvYXN0JztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmV4cG9ydCAqIGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfdGFncyc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5leHBvcnQgKiBmcm9tICcuL21sX3BhcnNlci90YWdzJztcbmV4cG9ydCB7TGV4ZXJSYW5nZX0gZnJvbSAnLi9tbF9wYXJzZXIvbGV4ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9tbF9wYXJzZXIveG1sX3BhcnNlcic7XG5leHBvcnQge05nTW9kdWxlQ29tcGlsZXJ9IGZyb20gJy4vbmdfbW9kdWxlX2NvbXBpbGVyJztcbmV4cG9ydCB7QXJyYXlUeXBlLCBBc3NlcnROb3ROdWxsLCBEWU5BTUlDX1RZUEUsIEJpbmFyeU9wZXJhdG9yLCBCaW5hcnlPcGVyYXRvckV4cHIsIEJ1aWx0aW5NZXRob2QsIEJ1aWx0aW5UeXBlLCBCdWlsdGluVHlwZU5hbWUsIEJ1aWx0aW5WYXIsIENhc3RFeHByLCBDbGFzc0ZpZWxkLCBDbGFzc01ldGhvZCwgQ2xhc3NTdG10LCBDb21tYUV4cHIsIENvbmRpdGlvbmFsRXhwciwgRGVjbGFyZUZ1bmN0aW9uU3RtdCwgRGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb24sIEV4cHJlc3Npb25TdGF0ZW1lbnQsIEV4cHJlc3Npb25UeXBlLCBFeHByZXNzaW9uVmlzaXRvciwgRXh0ZXJuYWxFeHByLCBFeHRlcm5hbFJlZmVyZW5jZSwgbGl0ZXJhbE1hcCwgRnVuY3Rpb25FeHByLCBJZlN0bXQsIEluc3RhbnRpYXRlRXhwciwgSW52b2tlRnVuY3Rpb25FeHByLCBJbnZva2VNZXRob2RFeHByLCBMaXRlcmFsQXJyYXlFeHByLCBMaXRlcmFsRXhwciwgTGl0ZXJhbE1hcEV4cHIsIE1hcFR5cGUsIE5vdEV4cHIsIE5PTkVfVFlQRSwgUmVhZEtleUV4cHIsIFJlYWRQcm9wRXhwciwgUmVhZFZhckV4cHIsIFJldHVyblN0YXRlbWVudCwgU3RhdGVtZW50VmlzaXRvciwgVGFnZ2VkVGVtcGxhdGVFeHByLCBUZW1wbGF0ZUxpdGVyYWwsIFRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQsIFRocm93U3RtdCwgVHJ5Q2F0Y2hTdG10LCBUeXBlLCBUeXBlVmlzaXRvciwgV3JhcHBlZE5vZGVFeHByLCBXcml0ZUtleUV4cHIsIFdyaXRlUHJvcEV4cHIsIFdyaXRlVmFyRXhwciwgU3RtdE1vZGlmaWVyLCBTdGF0ZW1lbnQsIFNUUklOR19UWVBFLCBUeXBlb2ZFeHByLCBjb2xsZWN0RXh0ZXJuYWxSZWZlcmVuY2VzLCBqc0RvY0NvbW1lbnQsIGxlYWRpbmdDb21tZW50LCBMZWFkaW5nQ29tbWVudCwgSlNEb2NDb21tZW50LCBVbmFyeU9wZXJhdG9yLCBVbmFyeU9wZXJhdG9yRXhwciwgTG9jYWxpemVkU3RyaW5nfSBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmV4cG9ydCB7RW1pdHRlclZpc2l0b3JDb250ZXh0fSBmcm9tICcuL291dHB1dC9hYnN0cmFjdF9lbWl0dGVyJztcbmV4cG9ydCB7Sml0RXZhbHVhdG9yfSBmcm9tICcuL291dHB1dC9vdXRwdXRfaml0JztcbmV4cG9ydCAqIGZyb20gJy4vb3V0cHV0L3RzX2VtaXR0ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9wYXJzZV91dGlsJztcbmV4cG9ydCAqIGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5leHBvcnQgKiBmcm9tICcuL3NlbGVjdG9yJztcbmV4cG9ydCAqIGZyb20gJy4vc3R5bGVfY29tcGlsZXInO1xuZXhwb3J0ICogZnJvbSAnLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmV4cG9ydCB7Vmlld0NvbXBpbGVyfSBmcm9tICcuL3ZpZXdfY29tcGlsZXIvdmlld19jb21waWxlcic7XG5leHBvcnQge1ZlcnNpb259IGZyb20gJy4vdXRpbCc7XG5leHBvcnQge1NvdXJjZU1hcH0gZnJvbSAnLi9vdXRwdXQvc291cmNlX21hcCc7XG5leHBvcnQgKiBmcm9tICcuL2luamVjdGFibGVfY29tcGlsZXJfMic7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9hcGknO1xuZXhwb3J0ICogZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmV4cG9ydCB7Qm91bmRBdHRyaWJ1dGUgYXMgVG1wbEFzdEJvdW5kQXR0cmlidXRlLCBCb3VuZEV2ZW50IGFzIFRtcGxBc3RCb3VuZEV2ZW50LCBCb3VuZFRleHQgYXMgVG1wbEFzdEJvdW5kVGV4dCwgQ29udGVudCBhcyBUbXBsQXN0Q29udGVudCwgRWxlbWVudCBhcyBUbXBsQXN0RWxlbWVudCwgSWN1IGFzIFRtcGxBc3RJY3UsIE5vZGUgYXMgVG1wbEFzdE5vZGUsIFJlY3Vyc2l2ZVZpc2l0b3IgYXMgVG1wbEFzdFJlY3Vyc2l2ZVZpc2l0b3IsIFJlZmVyZW5jZSBhcyBUbXBsQXN0UmVmZXJlbmNlLCBUZW1wbGF0ZSBhcyBUbXBsQXN0VGVtcGxhdGUsIFRleHQgYXMgVG1wbEFzdFRleHQsIFRleHRBdHRyaWJ1dGUgYXMgVG1wbEFzdFRleHRBdHRyaWJ1dGUsIFZhcmlhYmxlIGFzIFRtcGxBc3RWYXJpYWJsZX0gZnJvbSAnLi9yZW5kZXIzL3IzX2FzdCc7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlcjMvdmlldy90Ml9hcGknO1xuZXhwb3J0ICogZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdDJfYmluZGVyJztcbmV4cG9ydCB7SWRlbnRpZmllcnMgYXMgUjNJZGVudGlmaWVyc30gZnJvbSAnLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmV4cG9ydCB7UjNDbGFzc01ldGFkYXRhLCBDb21waWxlQ2xhc3NNZXRhZGF0YUZuLCBjb21waWxlQ2xhc3NNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX2NsYXNzX21ldGFkYXRhX2NvbXBpbGVyJztcbmV4cG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgUjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeU1ldGFkYXRhLCBGYWN0b3J5VGFyZ2V0fSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5leHBvcnQge2NvbXBpbGVOZ01vZHVsZSwgUjNOZ01vZHVsZU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyJztcbmV4cG9ydCB7Y29tcGlsZUluamVjdG9yLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlcic7XG5leHBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuZXhwb3J0IHttYWtlQmluZGluZ1BhcnNlciwgUGFyc2VkVGVtcGxhdGUsIHBhcnNlVGVtcGxhdGUsIFBhcnNlVGVtcGxhdGVPcHRpb25zfSBmcm9tICcuL3JlbmRlcjMvdmlldy90ZW1wbGF0ZSc7XG5leHBvcnQge0ZvcndhcmRSZWZIYW5kbGluZywgTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgUjNDb21waWxlZEV4cHJlc3Npb24sIFIzUmVmZXJlbmNlLCBjcmVhdGVNYXlCZUZvcndhcmRSZWZFeHByZXNzaW9uLCBkZXZPbmx5R3VhcmRlZEV4cHJlc3Npb24sIGdldFNhZmVQcm9wZXJ0eUFjY2Vzc1N0cmluZ30gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuZXhwb3J0IHtjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBwYXJzZUhvc3RCaW5kaW5ncywgUGFyc2VkSG9zdEJpbmRpbmdzLCB2ZXJpZnlIb3N0QmluZGluZ3N9IGZyb20gJy4vcmVuZGVyMy92aWV3L2NvbXBpbGVyJztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVDbGFzc01ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9jbGFzc19tZXRhZGF0YSc7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBEZWNsYXJlQ29tcG9uZW50VGVtcGxhdGVJbmZvfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQnO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvZGlyZWN0aXZlJztcbmV4cG9ydCB7Y29tcGlsZURlY2xhcmVGYWN0b3J5RnVuY3Rpb259IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL2ZhY3RvcnknO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZUluamVjdGFibGVGcm9tTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL2luamVjdGFibGUnO1xuZXhwb3J0IHtjb21waWxlRGVjbGFyZUluamVjdG9yRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcGFydGlhbC9pbmplY3Rvcic7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlTmdNb2R1bGVGcm9tTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9wYXJ0aWFsL25nX21vZHVsZSc7XG5leHBvcnQge2NvbXBpbGVEZWNsYXJlUGlwZUZyb21NZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3BhcnRpYWwvcGlwZSc7XG5leHBvcnQge3B1Ymxpc2hGYWNhZGV9IGZyb20gJy4vaml0X2NvbXBpbGVyX2ZhY2FkZSc7XG4vLyBUaGlzIGZpbGUgb25seSByZWV4cG9ydHMgY29udGVudCBvZiB0aGUgYHNyY2AgZm9sZGVyLiBLZWVwIGl0IHRoYXQgd2F5LlxuXG4vLyBUaGlzIGZ1bmN0aW9uIGNhbGwgaGFzIGEgZ2xvYmFsIHNpZGUgZWZmZWN0cyBhbmQgcHVibGlzaGVzIHRoZSBjb21waWxlciBpbnRvIGdsb2JhbCBuYW1lc3BhY2UgZm9yXG4vLyB0aGUgbGF0ZSBiaW5kaW5nIG9mIHRoZSBDb21waWxlciB0byB0aGUgQGFuZ3VsYXIvY29yZSBmb3Igaml0IGNvbXBpbGF0aW9uLlxucHVibGlzaEZhY2FkZShnbG9iYWwpO1xuIl19