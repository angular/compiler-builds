/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { componentFactoryName, flatten, identifierName, templateSourceUrl } from '../compile_metadata';
import { ConstantPool } from '../constant_pool';
import { ViewEncapsulation } from '../core';
import { MessageBundle } from '../i18n/message_bundle';
import { Identifiers, createTokenForExternalReference } from '../identifiers';
import { HtmlParser } from '../ml_parser/html_parser';
import { removeWhitespaces } from '../ml_parser/html_whitespaces';
import { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from '../ml_parser/interpolation_config';
import * as o from '../output/output_ast';
import { compileNgModuleFromRender2 as compileR3Module } from '../render3/r3_module_compiler';
import { compilePipeFromRender2 as compileR3Pipe } from '../render3/r3_pipe_compiler';
import { htmlAstToRender3Ast } from '../render3/r3_template_transform';
import { compileComponentFromRender2 as compileR3Component, compileDirectiveFromRender2 as compileR3Directive } from '../render3/view/compiler';
import { DomElementSchemaRegistry } from '../schema/dom_element_schema_registry';
import { BindingParser } from '../template_parser/binding_parser';
import { error, newArray, syntaxError, visitValue } from '../util';
import { GeneratedFile } from './generated_file';
import { listLazyRoutes, parseLazyRoute } from './lazy_routes';
import { StaticSymbol } from './static_symbol';
import { createForJitStub, serializeSummaries } from './summary_serializer';
import { ngfactoryFilePath, normalizeGenFileSuffix, splitTypescriptSuffix, summaryFileName, summaryForJitFileName } from './util';
var AotCompiler = /** @class */ (function () {
    function AotCompiler(_config, _options, _host, reflector, _metadataResolver, _templateParser, _styleCompiler, _viewCompiler, _typeCheckCompiler, _ngModuleCompiler, _injectableCompiler, _outputEmitter, _summaryResolver, _symbolResolver) {
        this._config = _config;
        this._options = _options;
        this._host = _host;
        this.reflector = reflector;
        this._metadataResolver = _metadataResolver;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._typeCheckCompiler = _typeCheckCompiler;
        this._ngModuleCompiler = _ngModuleCompiler;
        this._injectableCompiler = _injectableCompiler;
        this._outputEmitter = _outputEmitter;
        this._summaryResolver = _summaryResolver;
        this._symbolResolver = _symbolResolver;
        this._templateAstCache = new Map();
        this._analyzedFiles = new Map();
        this._analyzedFilesForInjectables = new Map();
    }
    AotCompiler.prototype.clearCache = function () { this._metadataResolver.clearCache(); };
    AotCompiler.prototype.analyzeModulesSync = function (rootFiles) {
        var _this = this;
        var analyzeResult = analyzeAndValidateNgModules(rootFiles, this._host, this._symbolResolver, this._metadataResolver);
        analyzeResult.ngModules.forEach(function (ngModule) { return _this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(ngModule.type.reference, true); });
        return analyzeResult;
    };
    AotCompiler.prototype.analyzeModulesAsync = function (rootFiles) {
        var _this = this;
        var analyzeResult = analyzeAndValidateNgModules(rootFiles, this._host, this._symbolResolver, this._metadataResolver);
        return Promise
            .all(analyzeResult.ngModules.map(function (ngModule) { return _this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(ngModule.type.reference, false); }))
            .then(function () { return analyzeResult; });
    };
    AotCompiler.prototype._analyzeFile = function (fileName) {
        var analyzedFile = this._analyzedFiles.get(fileName);
        if (!analyzedFile) {
            analyzedFile =
                analyzeFile(this._host, this._symbolResolver, this._metadataResolver, fileName);
            this._analyzedFiles.set(fileName, analyzedFile);
        }
        return analyzedFile;
    };
    AotCompiler.prototype._analyzeFileForInjectables = function (fileName) {
        var analyzedFile = this._analyzedFilesForInjectables.get(fileName);
        if (!analyzedFile) {
            analyzedFile = analyzeFileForInjectables(this._host, this._symbolResolver, this._metadataResolver, fileName);
            this._analyzedFilesForInjectables.set(fileName, analyzedFile);
        }
        return analyzedFile;
    };
    AotCompiler.prototype.findGeneratedFileNames = function (fileName) {
        var _this = this;
        var genFileNames = [];
        var file = this._analyzeFile(fileName);
        // Make sure we create a .ngfactory if we have a injectable/directive/pipe/NgModule
        // or a reference to a non source file.
        // Note: This is overestimating the required .ngfactory files as the real calculation is harder.
        // Only do this for StubEmitFlags.Basic, as adding a type check block
        // does not change this file (as we generate type check blocks based on NgModules).
        if (this._options.allowEmptyCodegenFiles || file.directives.length || file.pipes.length ||
            file.injectables.length || file.ngModules.length || file.exportsNonSourceFiles) {
            genFileNames.push(ngfactoryFilePath(file.fileName, true));
            if (this._options.enableSummariesForJit) {
                genFileNames.push(summaryForJitFileName(file.fileName, true));
            }
        }
        var fileSuffix = normalizeGenFileSuffix(splitTypescriptSuffix(file.fileName, true)[1]);
        file.directives.forEach(function (dirSymbol) {
            var compMeta = _this._metadataResolver.getNonNormalizedDirectiveMetadata(dirSymbol).metadata;
            if (!compMeta.isComponent) {
                return;
            }
            // Note: compMeta is a component and therefore template is non null.
            compMeta.template.styleUrls.forEach(function (styleUrl) {
                var normalizedUrl = _this._host.resourceNameToFileName(styleUrl, file.fileName);
                if (!normalizedUrl) {
                    throw syntaxError("Couldn't resolve resource " + styleUrl + " relative to " + file.fileName);
                }
                var needsShim = (compMeta.template.encapsulation ||
                    _this._config.defaultEncapsulation) === ViewEncapsulation.Emulated;
                genFileNames.push(_stylesModuleUrl(normalizedUrl, needsShim, fileSuffix));
                if (_this._options.allowEmptyCodegenFiles) {
                    genFileNames.push(_stylesModuleUrl(normalizedUrl, !needsShim, fileSuffix));
                }
            });
        });
        return genFileNames;
    };
    AotCompiler.prototype.emitBasicStub = function (genFileName, originalFileName) {
        var outputCtx = this._createOutputContext(genFileName);
        if (genFileName.endsWith('.ngfactory.ts')) {
            if (!originalFileName) {
                throw new Error("Assertion error: require the original file for .ngfactory.ts stubs. File: " + genFileName);
            }
            var originalFile = this._analyzeFile(originalFileName);
            this._createNgFactoryStub(outputCtx, originalFile, 1 /* Basic */);
        }
        else if (genFileName.endsWith('.ngsummary.ts')) {
            if (this._options.enableSummariesForJit) {
                if (!originalFileName) {
                    throw new Error("Assertion error: require the original file for .ngsummary.ts stubs. File: " + genFileName);
                }
                var originalFile = this._analyzeFile(originalFileName);
                _createEmptyStub(outputCtx);
                originalFile.ngModules.forEach(function (ngModule) {
                    // create exports that user code can reference
                    createForJitStub(outputCtx, ngModule.type.reference);
                });
            }
        }
        else if (genFileName.endsWith('.ngstyle.ts')) {
            _createEmptyStub(outputCtx);
        }
        // Note: for the stubs, we don't need a property srcFileUrl,
        // as later on in emitAllImpls we will create the proper GeneratedFiles with the
        // correct srcFileUrl.
        // This is good as e.g. for .ngstyle.ts files we can't derive
        // the url of components based on the genFileUrl.
        return this._codegenSourceModule('unknown', outputCtx);
    };
    AotCompiler.prototype.emitTypeCheckStub = function (genFileName, originalFileName) {
        var originalFile = this._analyzeFile(originalFileName);
        var outputCtx = this._createOutputContext(genFileName);
        if (genFileName.endsWith('.ngfactory.ts')) {
            this._createNgFactoryStub(outputCtx, originalFile, 2 /* TypeCheck */);
        }
        return outputCtx.statements.length > 0 ?
            this._codegenSourceModule(originalFile.fileName, outputCtx) :
            null;
    };
    AotCompiler.prototype.loadFilesAsync = function (fileNames, tsFiles) {
        var _this = this;
        var files = fileNames.map(function (fileName) { return _this._analyzeFile(fileName); });
        var loadingPromises = [];
        files.forEach(function (file) { return file.ngModules.forEach(function (ngModule) {
            return loadingPromises.push(_this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(ngModule.type.reference, false));
        }); });
        var analyzedInjectables = tsFiles.map(function (tsFile) { return _this._analyzeFileForInjectables(tsFile); });
        return Promise.all(loadingPromises).then(function (_) { return ({
            analyzedModules: mergeAndValidateNgFiles(files),
            analyzedInjectables: analyzedInjectables,
        }); });
    };
    AotCompiler.prototype.loadFilesSync = function (fileNames, tsFiles) {
        var _this = this;
        var files = fileNames.map(function (fileName) { return _this._analyzeFile(fileName); });
        files.forEach(function (file) { return file.ngModules.forEach(function (ngModule) { return _this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(ngModule.type.reference, true); }); });
        var analyzedInjectables = tsFiles.map(function (tsFile) { return _this._analyzeFileForInjectables(tsFile); });
        return {
            analyzedModules: mergeAndValidateNgFiles(files),
            analyzedInjectables: analyzedInjectables,
        };
    };
    AotCompiler.prototype._createNgFactoryStub = function (outputCtx, file, emitFlags) {
        var _this = this;
        var componentId = 0;
        file.ngModules.forEach(function (ngModuleMeta, ngModuleIndex) {
            // Note: the code below needs to executed for StubEmitFlags.Basic and StubEmitFlags.TypeCheck,
            // so we don't change the .ngfactory file too much when adding the type-check block.
            // create exports that user code can reference
            _this._ngModuleCompiler.createStub(outputCtx, ngModuleMeta.type.reference);
            // add references to the symbols from the metadata.
            // These can be used by the type check block for components,
            // and they also cause TypeScript to include these files into the program too,
            // which will make them part of the analyzedFiles.
            var externalReferences = tslib_1.__spread(ngModuleMeta.transitiveModule.directives.map(function (d) { return d.reference; }), ngModuleMeta.transitiveModule.pipes.map(function (d) { return d.reference; }), ngModuleMeta.importedModules.map(function (m) { return m.type.reference; }), ngModuleMeta.exportedModules.map(function (m) { return m.type.reference; }), _this._externalIdentifierReferences([Identifiers.TemplateRef, Identifiers.ElementRef]));
            var externalReferenceVars = new Map();
            externalReferences.forEach(function (ref, typeIndex) {
                externalReferenceVars.set(ref, "_decl" + ngModuleIndex + "_" + typeIndex);
            });
            externalReferenceVars.forEach(function (varName, reference) {
                outputCtx.statements.push(o.variable(varName)
                    .set(o.NULL_EXPR.cast(o.DYNAMIC_TYPE))
                    .toDeclStmt(o.expressionType(outputCtx.importExpr(reference, /* typeParams */ null, /* useSummaries */ false))));
            });
            if (emitFlags & 2 /* TypeCheck */) {
                // add the type-check block for all components of the NgModule
                ngModuleMeta.declaredDirectives.forEach(function (dirId) {
                    var compMeta = _this._metadataResolver.getDirectiveMetadata(dirId.reference);
                    if (!compMeta.isComponent) {
                        return;
                    }
                    componentId++;
                    _this._createTypeCheckBlock(outputCtx, compMeta.type.reference.name + "_Host_" + componentId, ngModuleMeta, _this._metadataResolver.getHostComponentMetadata(compMeta), [compMeta.type], externalReferenceVars);
                    _this._createTypeCheckBlock(outputCtx, compMeta.type.reference.name + "_" + componentId, ngModuleMeta, compMeta, ngModuleMeta.transitiveModule.directives, externalReferenceVars);
                });
            }
        });
        if (outputCtx.statements.length === 0) {
            _createEmptyStub(outputCtx);
        }
    };
    AotCompiler.prototype._externalIdentifierReferences = function (references) {
        var e_1, _a;
        var result = [];
        try {
            for (var references_1 = tslib_1.__values(references), references_1_1 = references_1.next(); !references_1_1.done; references_1_1 = references_1.next()) {
                var reference = references_1_1.value;
                var token = createTokenForExternalReference(this.reflector, reference);
                if (token.identifier) {
                    result.push(token.identifier.reference);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (references_1_1 && !references_1_1.done && (_a = references_1.return)) _a.call(references_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return result;
    };
    AotCompiler.prototype._createTypeCheckBlock = function (ctx, componentId, moduleMeta, compMeta, directives, externalReferenceVars) {
        var _a;
        var _b = this._parseTemplate(compMeta, moduleMeta, directives), parsedTemplate = _b.template, usedPipes = _b.pipes;
        (_a = ctx.statements).push.apply(_a, tslib_1.__spread(this._typeCheckCompiler.compileComponent(componentId, compMeta, parsedTemplate, usedPipes, externalReferenceVars, ctx)));
    };
    AotCompiler.prototype.emitMessageBundle = function (analyzeResult, locale) {
        var _this = this;
        var errors = [];
        var htmlParser = new HtmlParser();
        // TODO(vicb): implicit tags & attributes
        var messageBundle = new MessageBundle(htmlParser, [], {}, locale);
        analyzeResult.files.forEach(function (file) {
            var compMetas = [];
            file.directives.forEach(function (directiveType) {
                var dirMeta = _this._metadataResolver.getDirectiveMetadata(directiveType);
                if (dirMeta && dirMeta.isComponent) {
                    compMetas.push(dirMeta);
                }
            });
            compMetas.forEach(function (compMeta) {
                var html = compMeta.template.template;
                // Template URL points to either an HTML or TS file depending on whether
                // the file is used with `templateUrl:` or `template:`, respectively.
                var templateUrl = compMeta.template.templateUrl;
                var interpolationConfig = InterpolationConfig.fromArray(compMeta.template.interpolation);
                errors.push.apply(errors, tslib_1.__spread(messageBundle.updateFromTemplate(html, templateUrl, interpolationConfig)));
            });
        });
        if (errors.length) {
            throw new Error(errors.map(function (e) { return e.toString(); }).join('\n'));
        }
        return messageBundle;
    };
    AotCompiler.prototype.emitAllPartialModules = function (_a, r3Files) {
        var _this = this;
        var ngModuleByPipeOrDirective = _a.ngModuleByPipeOrDirective, files = _a.files;
        var contextMap = new Map();
        var getContext = function (fileName) {
            if (!contextMap.has(fileName)) {
                contextMap.set(fileName, _this._createOutputContext(fileName));
            }
            return contextMap.get(fileName);
        };
        files.forEach(function (file) { return _this._compilePartialModule(file.fileName, ngModuleByPipeOrDirective, file.directives, file.pipes, file.ngModules, file.injectables, getContext(file.fileName)); });
        r3Files.forEach(function (file) { return _this._compileShallowModules(file.fileName, file.shallowModules, getContext(file.fileName)); });
        return Array.from(contextMap.values())
            .map(function (context) { return ({
            fileName: context.genFilePath,
            statements: tslib_1.__spread(context.constantPool.statements, context.statements),
        }); });
    };
    AotCompiler.prototype._compileShallowModules = function (fileName, shallowModules, context) {
        var _this = this;
        shallowModules.forEach(function (module) { return compileR3Module(context, module, _this._injectableCompiler); });
    };
    AotCompiler.prototype._compilePartialModule = function (fileName, ngModuleByPipeOrDirective, directives, pipes, ngModules, injectables, context) {
        var _this = this;
        var errors = [];
        var schemaRegistry = new DomElementSchemaRegistry();
        var hostBindingParser = new BindingParser(this._templateParser.expressionParser, DEFAULT_INTERPOLATION_CONFIG, schemaRegistry, [], errors);
        // Process all components and directives
        directives.forEach(function (directiveType) {
            var directiveMetadata = _this._metadataResolver.getDirectiveMetadata(directiveType);
            if (directiveMetadata.isComponent) {
                var module = ngModuleByPipeOrDirective.get(directiveType);
                module ||
                    error("Cannot determine the module for component '" + identifierName(directiveMetadata.type) + "'");
                var htmlAst = directiveMetadata.template.htmlAst;
                var preserveWhitespaces = directiveMetadata.template.preserveWhitespaces;
                if (!preserveWhitespaces) {
                    htmlAst = removeWhitespaces(htmlAst);
                }
                var render3Ast = htmlAstToRender3Ast(htmlAst.rootNodes, hostBindingParser);
                // Map of StaticType by directive selectors
                var directiveTypeBySel_1 = new Map();
                var directives_1 = module.transitiveModule.directives.map(function (dir) { return _this._metadataResolver.getDirectiveSummary(dir.reference); });
                directives_1.forEach(function (directive) {
                    if (directive.selector) {
                        directiveTypeBySel_1.set(directive.selector, directive.type.reference);
                    }
                });
                // Map of StaticType by pipe names
                var pipeTypeByName_1 = new Map();
                var pipes_1 = module.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
                pipes_1.forEach(function (pipe) { pipeTypeByName_1.set(pipe.name, pipe.type.reference); });
                compileR3Component(context, directiveMetadata, render3Ast, _this.reflector, hostBindingParser, directiveTypeBySel_1, pipeTypeByName_1);
            }
            else {
                compileR3Directive(context, directiveMetadata, _this.reflector, hostBindingParser);
            }
        });
        pipes.forEach(function (pipeType) {
            var pipeMetadata = _this._metadataResolver.getPipeMetadata(pipeType);
            if (pipeMetadata) {
                compileR3Pipe(context, pipeMetadata, _this.reflector);
            }
        });
        injectables.forEach(function (injectable) { return _this._injectableCompiler.compile(injectable, context); });
    };
    AotCompiler.prototype.emitAllPartialModules2 = function (files) {
        var _this = this;
        // Using reduce like this is a select many pattern (where map is a select pattern)
        return files.reduce(function (r, file) {
            r.push.apply(r, tslib_1.__spread(_this._emitPartialModule2(file.fileName, file.injectables)));
            return r;
        }, []);
    };
    AotCompiler.prototype._emitPartialModule2 = function (fileName, injectables) {
        var _this = this;
        var context = this._createOutputContext(fileName);
        injectables.forEach(function (injectable) { return _this._injectableCompiler.compile(injectable, context); });
        if (context.statements && context.statements.length > 0) {
            return [{ fileName: fileName, statements: tslib_1.__spread(context.constantPool.statements, context.statements) }];
        }
        return [];
    };
    AotCompiler.prototype.emitAllImpls = function (analyzeResult) {
        var _this = this;
        var ngModuleByPipeOrDirective = analyzeResult.ngModuleByPipeOrDirective, files = analyzeResult.files;
        var sourceModules = files.map(function (file) { return _this._compileImplFile(file.fileName, ngModuleByPipeOrDirective, file.directives, file.pipes, file.ngModules, file.injectables); });
        return flatten(sourceModules);
    };
    AotCompiler.prototype._compileImplFile = function (srcFileUrl, ngModuleByPipeOrDirective, directives, pipes, ngModules, injectables) {
        var _this = this;
        var fileSuffix = normalizeGenFileSuffix(splitTypescriptSuffix(srcFileUrl, true)[1]);
        var generatedFiles = [];
        var outputCtx = this._createOutputContext(ngfactoryFilePath(srcFileUrl, true));
        generatedFiles.push.apply(generatedFiles, tslib_1.__spread(this._createSummary(srcFileUrl, directives, pipes, ngModules, injectables, outputCtx)));
        // compile all ng modules
        ngModules.forEach(function (ngModuleMeta) { return _this._compileModule(outputCtx, ngModuleMeta); });
        // compile components
        directives.forEach(function (dirType) {
            var compMeta = _this._metadataResolver.getDirectiveMetadata(dirType);
            if (!compMeta.isComponent) {
                return;
            }
            var ngModule = ngModuleByPipeOrDirective.get(dirType);
            if (!ngModule) {
                throw new Error("Internal Error: cannot determine the module for component " + identifierName(compMeta.type) + "!");
            }
            // compile styles
            var componentStylesheet = _this._styleCompiler.compileComponent(outputCtx, compMeta);
            // Note: compMeta is a component and therefore template is non null.
            compMeta.template.externalStylesheets.forEach(function (stylesheetMeta) {
                // Note: fill non shim and shim style files as they might
                // be shared by component with and without ViewEncapsulation.
                var shim = _this._styleCompiler.needsStyleShim(compMeta);
                generatedFiles.push(_this._codegenStyles(srcFileUrl, compMeta, stylesheetMeta, shim, fileSuffix));
                if (_this._options.allowEmptyCodegenFiles) {
                    generatedFiles.push(_this._codegenStyles(srcFileUrl, compMeta, stylesheetMeta, !shim, fileSuffix));
                }
            });
            // compile components
            var compViewVars = _this._compileComponent(outputCtx, compMeta, ngModule, ngModule.transitiveModule.directives, componentStylesheet, fileSuffix);
            _this._compileComponentFactory(outputCtx, compMeta, ngModule, fileSuffix);
        });
        if (outputCtx.statements.length > 0 || this._options.allowEmptyCodegenFiles) {
            var srcModule = this._codegenSourceModule(srcFileUrl, outputCtx);
            generatedFiles.unshift(srcModule);
        }
        return generatedFiles;
    };
    AotCompiler.prototype._createSummary = function (srcFileName, directives, pipes, ngModules, injectables, ngFactoryCtx) {
        var _this = this;
        var symbolSummaries = this._symbolResolver.getSymbolsOf(srcFileName)
            .map(function (symbol) { return _this._symbolResolver.resolveSymbol(symbol); });
        var typeData = tslib_1.__spread(ngModules.map(function (meta) { return ({
            summary: _this._metadataResolver.getNgModuleSummary(meta.type.reference),
            metadata: _this._metadataResolver.getNgModuleMetadata(meta.type.reference)
        }); }), directives.map(function (ref) { return ({
            summary: _this._metadataResolver.getDirectiveSummary(ref),
            metadata: _this._metadataResolver.getDirectiveMetadata(ref)
        }); }), pipes.map(function (ref) { return ({
            summary: _this._metadataResolver.getPipeSummary(ref),
            metadata: _this._metadataResolver.getPipeMetadata(ref)
        }); }), injectables.map(function (ref) { return ({
            summary: _this._metadataResolver.getInjectableSummary(ref.symbol),
            metadata: _this._metadataResolver.getInjectableSummary(ref.symbol).type
        }); }));
        var forJitOutputCtx = this._options.enableSummariesForJit ?
            this._createOutputContext(summaryForJitFileName(srcFileName, true)) :
            null;
        var _a = serializeSummaries(srcFileName, forJitOutputCtx, this._summaryResolver, this._symbolResolver, symbolSummaries, typeData, this._options.createExternalSymbolFactoryReexports), json = _a.json, exportAs = _a.exportAs;
        exportAs.forEach(function (entry) {
            ngFactoryCtx.statements.push(o.variable(entry.exportAs).set(ngFactoryCtx.importExpr(entry.symbol)).toDeclStmt(null, [
                o.StmtModifier.Exported
            ]));
        });
        var summaryJson = new GeneratedFile(srcFileName, summaryFileName(srcFileName), json);
        var result = [summaryJson];
        if (forJitOutputCtx) {
            result.push(this._codegenSourceModule(srcFileName, forJitOutputCtx));
        }
        return result;
    };
    AotCompiler.prototype._compileModule = function (outputCtx, ngModule) {
        var providers = [];
        if (this._options.locale) {
            var normalizedLocale = this._options.locale.replace(/_/g, '-');
            providers.push({
                token: createTokenForExternalReference(this.reflector, Identifiers.LOCALE_ID),
                useValue: normalizedLocale,
            });
        }
        if (this._options.i18nFormat) {
            providers.push({
                token: createTokenForExternalReference(this.reflector, Identifiers.TRANSLATIONS_FORMAT),
                useValue: this._options.i18nFormat
            });
        }
        this._ngModuleCompiler.compile(outputCtx, ngModule, providers);
    };
    AotCompiler.prototype._compileComponentFactory = function (outputCtx, compMeta, ngModule, fileSuffix) {
        var hostMeta = this._metadataResolver.getHostComponentMetadata(compMeta);
        var hostViewFactoryVar = this._compileComponent(outputCtx, hostMeta, ngModule, [compMeta.type], null, fileSuffix)
            .viewClassVar;
        var compFactoryVar = componentFactoryName(compMeta.type.reference);
        var inputsExprs = [];
        for (var propName in compMeta.inputs) {
            var templateName = compMeta.inputs[propName];
            // Don't quote so that the key gets minified...
            inputsExprs.push(new o.LiteralMapEntry(propName, o.literal(templateName), false));
        }
        var outputsExprs = [];
        for (var propName in compMeta.outputs) {
            var templateName = compMeta.outputs[propName];
            // Don't quote so that the key gets minified...
            outputsExprs.push(new o.LiteralMapEntry(propName, o.literal(templateName), false));
        }
        outputCtx.statements.push(o.variable(compFactoryVar)
            .set(o.importExpr(Identifiers.createComponentFactory).callFn([
            o.literal(compMeta.selector), outputCtx.importExpr(compMeta.type.reference),
            o.variable(hostViewFactoryVar), new o.LiteralMapExpr(inputsExprs),
            new o.LiteralMapExpr(outputsExprs),
            o.literalArr(compMeta.template.ngContentSelectors.map(function (selector) { return o.literal(selector); }))
        ]))
            .toDeclStmt(o.importType(Identifiers.ComponentFactory, [o.expressionType(outputCtx.importExpr(compMeta.type.reference))], [o.TypeModifier.Const]), [o.StmtModifier.Final, o.StmtModifier.Exported]));
    };
    AotCompiler.prototype._compileComponent = function (outputCtx, compMeta, ngModule, directiveIdentifiers, componentStyles, fileSuffix) {
        var _a = this._parseTemplate(compMeta, ngModule, directiveIdentifiers), parsedTemplate = _a.template, usedPipes = _a.pipes;
        var stylesExpr = componentStyles ? o.variable(componentStyles.stylesVar) : o.literalArr([]);
        var viewResult = this._viewCompiler.compileComponent(outputCtx, compMeta, parsedTemplate, stylesExpr, usedPipes);
        if (componentStyles) {
            _resolveStyleStatements(this._symbolResolver, componentStyles, this._styleCompiler.needsStyleShim(compMeta), fileSuffix);
        }
        return viewResult;
    };
    AotCompiler.prototype._parseTemplate = function (compMeta, ngModule, directiveIdentifiers) {
        var _this = this;
        if (this._templateAstCache.has(compMeta.type.reference)) {
            return this._templateAstCache.get(compMeta.type.reference);
        }
        var preserveWhitespaces = compMeta.template.preserveWhitespaces;
        var directives = directiveIdentifiers.map(function (dir) { return _this._metadataResolver.getDirectiveSummary(dir.reference); });
        var pipes = ngModule.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
        var result = this._templateParser.parse(compMeta, compMeta.template.htmlAst, directives, pipes, ngModule.schemas, templateSourceUrl(ngModule.type, compMeta, compMeta.template), preserveWhitespaces);
        this._templateAstCache.set(compMeta.type.reference, result);
        return result;
    };
    AotCompiler.prototype._createOutputContext = function (genFilePath) {
        var _this = this;
        var importExpr = function (symbol, typeParams, useSummaries) {
            if (typeParams === void 0) { typeParams = null; }
            if (useSummaries === void 0) { useSummaries = true; }
            if (!(symbol instanceof StaticSymbol)) {
                throw new Error("Internal error: unknown identifier " + JSON.stringify(symbol));
            }
            var arity = _this._symbolResolver.getTypeArity(symbol) || 0;
            var _a = _this._symbolResolver.getImportAs(symbol, useSummaries) || symbol, filePath = _a.filePath, name = _a.name, members = _a.members;
            var importModule = _this._fileNameToModuleName(filePath, genFilePath);
            // It should be good enough to compare filePath to genFilePath and if they are equal
            // there is a self reference. However, ngfactory files generate to .ts but their
            // symbols have .d.ts so a simple compare is insufficient. They should be canonical
            // and is tracked by #17705.
            var selfReference = _this._fileNameToModuleName(genFilePath, genFilePath);
            var moduleName = importModule === selfReference ? null : importModule;
            // If we are in a type expression that refers to a generic type then supply
            // the required type parameters. If there were not enough type parameters
            // supplied, supply any as the type. Outside a type expression the reference
            // should not supply type parameters and be treated as a simple value reference
            // to the constructor function itself.
            var suppliedTypeParams = typeParams || [];
            var missingTypeParamsCount = arity - suppliedTypeParams.length;
            var allTypeParams = suppliedTypeParams.concat(newArray(missingTypeParamsCount, o.DYNAMIC_TYPE));
            return members.reduce(function (expr, memberName) { return expr.prop(memberName); }, o.importExpr(new o.ExternalReference(moduleName, name, null), allTypeParams));
        };
        return { statements: [], genFilePath: genFilePath, importExpr: importExpr, constantPool: new ConstantPool() };
    };
    AotCompiler.prototype._fileNameToModuleName = function (importedFilePath, containingFilePath) {
        return this._summaryResolver.getKnownModuleName(importedFilePath) ||
            this._symbolResolver.getKnownModuleName(importedFilePath) ||
            this._host.fileNameToModuleName(importedFilePath, containingFilePath);
    };
    AotCompiler.prototype._codegenStyles = function (srcFileUrl, compMeta, stylesheetMetadata, isShimmed, fileSuffix) {
        var outputCtx = this._createOutputContext(_stylesModuleUrl(stylesheetMetadata.moduleUrl, isShimmed, fileSuffix));
        var compiledStylesheet = this._styleCompiler.compileStyles(outputCtx, compMeta, stylesheetMetadata, isShimmed);
        _resolveStyleStatements(this._symbolResolver, compiledStylesheet, isShimmed, fileSuffix);
        return this._codegenSourceModule(srcFileUrl, outputCtx);
    };
    AotCompiler.prototype._codegenSourceModule = function (srcFileUrl, ctx) {
        return new GeneratedFile(srcFileUrl, ctx.genFilePath, ctx.statements);
    };
    AotCompiler.prototype.listLazyRoutes = function (entryRoute, analyzedModules) {
        var e_2, _a, e_3, _b;
        var self = this;
        if (entryRoute) {
            var symbol = parseLazyRoute(entryRoute, this.reflector).referencedModule;
            return visitLazyRoute(symbol);
        }
        else if (analyzedModules) {
            var allLazyRoutes = [];
            try {
                for (var _c = tslib_1.__values(analyzedModules.ngModules), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var ngModule = _d.value;
                    var lazyRoutes = listLazyRoutes(ngModule, this.reflector);
                    try {
                        for (var lazyRoutes_1 = (e_3 = void 0, tslib_1.__values(lazyRoutes)), lazyRoutes_1_1 = lazyRoutes_1.next(); !lazyRoutes_1_1.done; lazyRoutes_1_1 = lazyRoutes_1.next()) {
                            var lazyRoute = lazyRoutes_1_1.value;
                            allLazyRoutes.push(lazyRoute);
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (lazyRoutes_1_1 && !lazyRoutes_1_1.done && (_b = lazyRoutes_1.return)) _b.call(lazyRoutes_1);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return allLazyRoutes;
        }
        else {
            throw new Error("Either route or analyzedModules has to be specified!");
        }
        function visitLazyRoute(symbol, seenRoutes, allLazyRoutes) {
            var e_4, _a;
            if (seenRoutes === void 0) { seenRoutes = new Set(); }
            if (allLazyRoutes === void 0) { allLazyRoutes = []; }
            // Support pointing to default exports, but stop recursing there,
            // as the StaticReflector does not yet support default exports.
            if (seenRoutes.has(symbol) || !symbol.name) {
                return allLazyRoutes;
            }
            seenRoutes.add(symbol);
            var lazyRoutes = listLazyRoutes(self._metadataResolver.getNgModuleMetadata(symbol, true), self.reflector);
            try {
                for (var lazyRoutes_2 = tslib_1.__values(lazyRoutes), lazyRoutes_2_1 = lazyRoutes_2.next(); !lazyRoutes_2_1.done; lazyRoutes_2_1 = lazyRoutes_2.next()) {
                    var lazyRoute = lazyRoutes_2_1.value;
                    allLazyRoutes.push(lazyRoute);
                    visitLazyRoute(lazyRoute.referencedModule, seenRoutes, allLazyRoutes);
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (lazyRoutes_2_1 && !lazyRoutes_2_1.done && (_a = lazyRoutes_2.return)) _a.call(lazyRoutes_2);
                }
                finally { if (e_4) throw e_4.error; }
            }
            return allLazyRoutes;
        }
    };
    return AotCompiler;
}());
export { AotCompiler };
function _createEmptyStub(outputCtx) {
    // Note: We need to produce at least one import statement so that
    // TypeScript knows that the file is an es6 module. Otherwise our generated
    // exports / imports won't be emitted properly by TypeScript.
    outputCtx.statements.push(o.importExpr(Identifiers.ComponentFactory).toStmt());
}
function _resolveStyleStatements(symbolResolver, compileResult, needsShim, fileSuffix) {
    compileResult.dependencies.forEach(function (dep) {
        dep.setValue(symbolResolver.getStaticSymbol(_stylesModuleUrl(dep.moduleUrl, needsShim, fileSuffix), dep.name));
    });
}
function _stylesModuleUrl(stylesheetUrl, shim, suffix) {
    return "" + stylesheetUrl + (shim ? '.shim' : '') + ".ngstyle" + suffix;
}
export function analyzeNgModules(fileNames, host, staticSymbolResolver, metadataResolver) {
    var files = _analyzeFilesIncludingNonProgramFiles(fileNames, host, staticSymbolResolver, metadataResolver);
    return mergeAnalyzedFiles(files);
}
export function analyzeAndValidateNgModules(fileNames, host, staticSymbolResolver, metadataResolver) {
    return validateAnalyzedModules(analyzeNgModules(fileNames, host, staticSymbolResolver, metadataResolver));
}
function validateAnalyzedModules(analyzedModules) {
    if (analyzedModules.symbolsMissingModule && analyzedModules.symbolsMissingModule.length) {
        var messages = analyzedModules.symbolsMissingModule.map(function (s) {
            return "Cannot determine the module for class " + s.name + " in " + s.filePath + "! Add " + s.name + " to the NgModule to fix it.";
        });
        throw syntaxError(messages.join('\n'));
    }
    return analyzedModules;
}
// Analyzes all of the program files,
// including files that are not part of the program
// but are referenced by an NgModule.
function _analyzeFilesIncludingNonProgramFiles(fileNames, host, staticSymbolResolver, metadataResolver) {
    var seenFiles = new Set();
    var files = [];
    var visitFile = function (fileName) {
        if (seenFiles.has(fileName) || !host.isSourceFile(fileName)) {
            return false;
        }
        seenFiles.add(fileName);
        var analyzedFile = analyzeFile(host, staticSymbolResolver, metadataResolver, fileName);
        files.push(analyzedFile);
        analyzedFile.ngModules.forEach(function (ngModule) {
            ngModule.transitiveModule.modules.forEach(function (modMeta) { return visitFile(modMeta.reference.filePath); });
        });
    };
    fileNames.forEach(function (fileName) { return visitFile(fileName); });
    return files;
}
export function analyzeFile(host, staticSymbolResolver, metadataResolver, fileName) {
    var abstractDirectives = [];
    var directives = [];
    var pipes = [];
    var injectables = [];
    var ngModules = [];
    var hasDecorators = staticSymbolResolver.hasDecorators(fileName);
    var exportsNonSourceFiles = false;
    var isDeclarationFile = fileName.endsWith('.d.ts');
    // Don't analyze .d.ts files that have no decorators as a shortcut
    // to speed up the analysis. This prevents us from
    // resolving the references in these files.
    // Note: exportsNonSourceFiles is only needed when compiling with summaries,
    // which is not the case when .d.ts files are treated as input files.
    if (!isDeclarationFile || hasDecorators) {
        staticSymbolResolver.getSymbolsOf(fileName).forEach(function (symbol) {
            var resolvedSymbol = staticSymbolResolver.resolveSymbol(symbol);
            var symbolMeta = resolvedSymbol.metadata;
            if (!symbolMeta || symbolMeta.__symbolic === 'error') {
                return;
            }
            var isNgSymbol = false;
            if (symbolMeta.__symbolic === 'class') {
                if (metadataResolver.isDirective(symbol)) {
                    isNgSymbol = true;
                    if (!isDeclarationFile) {
                        // This directive either has a selector or doesn't. Selector-less directives get tracked
                        // in abstractDirectives, not directives. The compiler doesn't deal with selector-less
                        // directives at all, really, other than to persist their metadata. This is done so that
                        // apps will have an easier time migrating to Ivy, which requires the selector-less
                        // annotations to be applied.
                        if (!metadataResolver.isAbstractDirective(symbol)) {
                            // The directive is an ordinary directive.
                            directives.push(symbol);
                        }
                        else {
                            // The directive has no selector and is an "abstract" directive, so track it
                            // accordingly.
                            abstractDirectives.push(symbol);
                        }
                    }
                    else {
                        directives.push(symbol);
                    }
                }
                else if (metadataResolver.isPipe(symbol)) {
                    isNgSymbol = true;
                    pipes.push(symbol);
                }
                else if (metadataResolver.isNgModule(symbol)) {
                    var ngModule = metadataResolver.getNgModuleMetadata(symbol, false);
                    if (ngModule) {
                        isNgSymbol = true;
                        ngModules.push(ngModule);
                    }
                }
                else if (metadataResolver.isInjectable(symbol)) {
                    isNgSymbol = true;
                    var injectable = metadataResolver.getInjectableMetadata(symbol, null, false);
                    if (injectable) {
                        injectables.push(injectable);
                    }
                }
            }
            if (!isNgSymbol) {
                exportsNonSourceFiles =
                    exportsNonSourceFiles || isValueExportingNonSourceFile(host, symbolMeta);
            }
        });
    }
    return {
        fileName: fileName, directives: directives, abstractDirectives: abstractDirectives, pipes: pipes,
        ngModules: ngModules, injectables: injectables, exportsNonSourceFiles: exportsNonSourceFiles,
    };
}
export function analyzeFileForInjectables(host, staticSymbolResolver, metadataResolver, fileName) {
    var injectables = [];
    var shallowModules = [];
    if (staticSymbolResolver.hasDecorators(fileName)) {
        staticSymbolResolver.getSymbolsOf(fileName).forEach(function (symbol) {
            var resolvedSymbol = staticSymbolResolver.resolveSymbol(symbol);
            var symbolMeta = resolvedSymbol.metadata;
            if (!symbolMeta || symbolMeta.__symbolic === 'error') {
                return;
            }
            if (symbolMeta.__symbolic === 'class') {
                if (metadataResolver.isInjectable(symbol)) {
                    var injectable = metadataResolver.getInjectableMetadata(symbol, null, false);
                    if (injectable) {
                        injectables.push(injectable);
                    }
                }
                else if (metadataResolver.isNgModule(symbol)) {
                    var module = metadataResolver.getShallowModuleMetadata(symbol);
                    if (module) {
                        shallowModules.push(module);
                    }
                }
            }
        });
    }
    return { fileName: fileName, injectables: injectables, shallowModules: shallowModules };
}
function isValueExportingNonSourceFile(host, metadata) {
    var exportsNonSourceFiles = false;
    var Visitor = /** @class */ (function () {
        function Visitor() {
        }
        Visitor.prototype.visitArray = function (arr, context) {
            var _this = this;
            arr.forEach(function (v) { return visitValue(v, _this, context); });
        };
        Visitor.prototype.visitStringMap = function (map, context) {
            var _this = this;
            Object.keys(map).forEach(function (key) { return visitValue(map[key], _this, context); });
        };
        Visitor.prototype.visitPrimitive = function (value, context) { };
        Visitor.prototype.visitOther = function (value, context) {
            if (value instanceof StaticSymbol && !host.isSourceFile(value.filePath)) {
                exportsNonSourceFiles = true;
            }
        };
        return Visitor;
    }());
    visitValue(metadata, new Visitor(), null);
    return exportsNonSourceFiles;
}
export function mergeAnalyzedFiles(analyzedFiles) {
    var allNgModules = [];
    var ngModuleByPipeOrDirective = new Map();
    var allPipesAndDirectives = new Set();
    analyzedFiles.forEach(function (af) {
        af.ngModules.forEach(function (ngModule) {
            allNgModules.push(ngModule);
            ngModule.declaredDirectives.forEach(function (d) { return ngModuleByPipeOrDirective.set(d.reference, ngModule); });
            ngModule.declaredPipes.forEach(function (p) { return ngModuleByPipeOrDirective.set(p.reference, ngModule); });
        });
        af.directives.forEach(function (d) { return allPipesAndDirectives.add(d); });
        af.pipes.forEach(function (p) { return allPipesAndDirectives.add(p); });
    });
    var symbolsMissingModule = [];
    allPipesAndDirectives.forEach(function (ref) {
        if (!ngModuleByPipeOrDirective.has(ref)) {
            symbolsMissingModule.push(ref);
        }
    });
    return {
        ngModules: allNgModules,
        ngModuleByPipeOrDirective: ngModuleByPipeOrDirective,
        symbolsMissingModule: symbolsMissingModule,
        files: analyzedFiles
    };
}
function mergeAndValidateNgFiles(files) {
    return validateAnalyzedModules(mergeAnalyzedFiles(files));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvYW90L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQThRLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUVsWCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDOUMsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBQzFDLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNyRCxPQUFPLEVBQUMsV0FBVyxFQUFFLCtCQUErQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFHNUUsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLG1DQUFtQyxDQUFDO0FBR3BHLE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFMUMsT0FBTyxFQUFDLDBCQUEwQixJQUFJLGVBQWUsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzVGLE9BQU8sRUFBQyxzQkFBc0IsSUFBSSxhQUFhLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNwRixPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUMsMkJBQTJCLElBQUksa0JBQWtCLEVBQUUsMkJBQTJCLElBQUksa0JBQWtCLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUM5SSxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUcv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QUksT0FBQSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsRUFBcEQsQ0FBb0QsQ0FBQyxDQUFDO1FBQzVGLENBQUMsQ0FBQyxDQUFDO1FBQ0gsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQTVCLENBQTRCLENBQUMsQ0FBQztRQUN6RCxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBNUIsQ0FBNEIsQ0FBQyxDQUFDO0lBQ3RELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBTSxvQkFBb0IsR0FBbUIsRUFBRSxDQUFDO0lBQ2hELHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxVQUFBLEdBQUc7UUFDL0IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN2QyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDaEM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU87UUFDTCxTQUFTLEVBQUUsWUFBWTtRQUN2Qix5QkFBeUIsMkJBQUE7UUFDekIsb0JBQW9CLHNCQUFBO1FBQ3BCLEtBQUssRUFBRSxhQUFhO0tBQ3JCLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxLQUF1QjtJQUN0RCxPQUFPLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDNUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEsIENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGEsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBDb21waWxlUGlwZU1ldGFkYXRhLCBDb21waWxlUGlwZVN1bW1hcnksIENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBDb21waWxlU2hhbGxvd01vZHVsZU1ldGFkYXRhLCBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhLCBDb21waWxlVHlwZU1ldGFkYXRhLCBDb21waWxlVHlwZVN1bW1hcnksIGNvbXBvbmVudEZhY3RvcnlOYW1lLCBmbGF0dGVuLCBpZGVudGlmaWVyTmFtZSwgdGVtcGxhdGVTb3VyY2VVcmx9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtNZXNzYWdlQnVuZGxlfSBmcm9tICcuLi9pMThuL21lc3NhZ2VfYnVuZGxlJztcbmltcG9ydCB7SWRlbnRpZmllcnMsIGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2V9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCB7SW5qZWN0YWJsZUNvbXBpbGVyfSBmcm9tICcuLi9pbmplY3RhYmxlX2NvbXBpbGVyJztcbmltcG9ydCB7Q29tcGlsZU1ldGFkYXRhUmVzb2x2ZXJ9IGZyb20gJy4uL21ldGFkYXRhX3Jlc29sdmVyJztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7cmVtb3ZlV2hpdGVzcGFjZXN9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7TmdNb2R1bGVDb21waWxlcn0gZnJvbSAnLi4vbmdfbW9kdWxlX2NvbXBpbGVyJztcbmltcG9ydCB7T3V0cHV0RW1pdHRlcn0gZnJvbSAnLi4vb3V0cHV0L2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3J9IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtjb21waWxlTmdNb2R1bGVGcm9tUmVuZGVyMiBhcyBjb21waWxlUjNNb2R1bGV9IGZyb20gJy4uL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyJztcbmltcG9ydCB7Y29tcGlsZVBpcGVGcm9tUmVuZGVyMiBhcyBjb21waWxlUjNQaXBlfSBmcm9tICcuLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtodG1sQXN0VG9SZW5kZXIzQXN0fSBmcm9tICcuLi9yZW5kZXIzL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge2NvbXBpbGVDb21wb25lbnRGcm9tUmVuZGVyMiBhcyBjb21waWxlUjNDb21wb25lbnQsIGNvbXBpbGVEaXJlY3RpdmVGcm9tUmVuZGVyMiBhcyBjb21waWxlUjNEaXJlY3RpdmV9IGZyb20gJy4uL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0NvbXBpbGVkU3R5bGVzaGVldCwgU3R5bGVDb21waWxlcn0gZnJvbSAnLi4vc3R5bGVfY29tcGlsZXInO1xuaW1wb3J0IHtTdW1tYXJ5UmVzb2x2ZXJ9IGZyb20gJy4uL3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtUZW1wbGF0ZUFzdH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5pbXBvcnQge1RlbXBsYXRlUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmltcG9ydCB7T3V0cHV0Q29udGV4dCwgVmFsdWVWaXNpdG9yLCBlcnJvciwgbmV3QXJyYXksIHN5bnRheEVycm9yLCB2aXNpdFZhbHVlfSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7VHlwZUNoZWNrQ29tcGlsZXJ9IGZyb20gJy4uL3ZpZXdfY29tcGlsZXIvdHlwZV9jaGVja19jb21waWxlcic7XG5pbXBvcnQge1ZpZXdDb21waWxlUmVzdWx0LCBWaWV3Q29tcGlsZXJ9IGZyb20gJy4uL3ZpZXdfY29tcGlsZXIvdmlld19jb21waWxlcic7XG5cbmltcG9ydCB7QW90Q29tcGlsZXJIb3N0fSBmcm9tICcuL2NvbXBpbGVyX2hvc3QnO1xuaW1wb3J0IHtBb3RDb21waWxlck9wdGlvbnN9IGZyb20gJy4vY29tcGlsZXJfb3B0aW9ucyc7XG5pbXBvcnQge0dlbmVyYXRlZEZpbGV9IGZyb20gJy4vZ2VuZXJhdGVkX2ZpbGUnO1xuaW1wb3J0IHtMYXp5Um91dGUsIGxpc3RMYXp5Um91dGVzLCBwYXJzZUxhenlSb3V0ZX0gZnJvbSAnLi9sYXp5X3JvdXRlcyc7XG5pbXBvcnQge1BhcnRpYWxNb2R1bGV9IGZyb20gJy4vcGFydGlhbF9tb2R1bGUnO1xuaW1wb3J0IHtTdGF0aWNSZWZsZWN0b3J9IGZyb20gJy4vc3RhdGljX3JlZmxlY3Rvcic7XG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7U3RhdGljU3ltYm9sUmVzb2x2ZXJ9IGZyb20gJy4vc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5pbXBvcnQge2NyZWF0ZUZvckppdFN0dWIsIHNlcmlhbGl6ZVN1bW1hcmllc30gZnJvbSAnLi9zdW1tYXJ5X3NlcmlhbGl6ZXInO1xuaW1wb3J0IHtuZ2ZhY3RvcnlGaWxlUGF0aCwgbm9ybWFsaXplR2VuRmlsZVN1ZmZpeCwgc3BsaXRUeXBlc2NyaXB0U3VmZml4LCBzdW1tYXJ5RmlsZU5hbWUsIHN1bW1hcnlGb3JKaXRGaWxlTmFtZX0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgZW51bSBTdHViRW1pdEZsYWdzIHsgQmFzaWMgPSAxIDw8IDAsIFR5cGVDaGVjayA9IDEgPDwgMSwgQWxsID0gVHlwZUNoZWNrIHwgQmFzaWMgfVxuXG5leHBvcnQgY2xhc3MgQW90Q29tcGlsZXIge1xuICBwcml2YXRlIF90ZW1wbGF0ZUFzdENhY2hlID1cbiAgICAgIG5ldyBNYXA8U3RhdGljU3ltYm9sLCB7dGVtcGxhdGU6IFRlbXBsYXRlQXN0W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXX0+KCk7XG4gIHByaXZhdGUgX2FuYWx5emVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgTmdBbmFseXplZEZpbGU+KCk7XG4gIHByaXZhdGUgX2FuYWx5emVkRmlsZXNGb3JJbmplY3RhYmxlcyA9IG5ldyBNYXA8c3RyaW5nLCBOZ0FuYWx5emVkRmlsZVdpdGhJbmplY3RhYmxlcz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2NvbmZpZzogQ29tcGlsZXJDb25maWcsIHByaXZhdGUgX29wdGlvbnM6IEFvdENvbXBpbGVyT3B0aW9ucyxcbiAgICAgIHByaXZhdGUgX2hvc3Q6IEFvdENvbXBpbGVySG9zdCwgcmVhZG9ubHkgcmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIF9tZXRhZGF0YVJlc29sdmVyOiBDb21waWxlTWV0YWRhdGFSZXNvbHZlciwgcHJpdmF0ZSBfdGVtcGxhdGVQYXJzZXI6IFRlbXBsYXRlUGFyc2VyLFxuICAgICAgcHJpdmF0ZSBfc3R5bGVDb21waWxlcjogU3R5bGVDb21waWxlciwgcHJpdmF0ZSBfdmlld0NvbXBpbGVyOiBWaWV3Q29tcGlsZXIsXG4gICAgICBwcml2YXRlIF90eXBlQ2hlY2tDb21waWxlcjogVHlwZUNoZWNrQ29tcGlsZXIsIHByaXZhdGUgX25nTW9kdWxlQ29tcGlsZXI6IE5nTW9kdWxlQ29tcGlsZXIsXG4gICAgICBwcml2YXRlIF9pbmplY3RhYmxlQ29tcGlsZXI6IEluamVjdGFibGVDb21waWxlciwgcHJpdmF0ZSBfb3V0cHV0RW1pdHRlcjogT3V0cHV0RW1pdHRlcixcbiAgICAgIHByaXZhdGUgX3N1bW1hcnlSZXNvbHZlcjogU3VtbWFyeVJlc29sdmVyPFN0YXRpY1N5bWJvbD4sXG4gICAgICBwcml2YXRlIF9zeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXIpIHt9XG5cbiAgY2xlYXJDYWNoZSgpIHsgdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5jbGVhckNhY2hlKCk7IH1cblxuICBhbmFseXplTW9kdWxlc1N5bmMocm9vdEZpbGVzOiBzdHJpbmdbXSk6IE5nQW5hbHl6ZWRNb2R1bGVzIHtcbiAgICBjb25zdCBhbmFseXplUmVzdWx0ID0gYW5hbHl6ZUFuZFZhbGlkYXRlTmdNb2R1bGVzKFxuICAgICAgICByb290RmlsZXMsIHRoaXMuX2hvc3QsIHRoaXMuX3N5bWJvbFJlc29sdmVyLCB0aGlzLl9tZXRhZGF0YVJlc29sdmVyKTtcbiAgICBhbmFseXplUmVzdWx0Lm5nTW9kdWxlcy5mb3JFYWNoKFxuICAgICAgICBuZ01vZHVsZSA9PiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YShcbiAgICAgICAgICAgIG5nTW9kdWxlLnR5cGUucmVmZXJlbmNlLCB0cnVlKSk7XG4gICAgcmV0dXJuIGFuYWx5emVSZXN1bHQ7XG4gIH1cblxuICBhbmFseXplTW9kdWxlc0FzeW5jKHJvb3RGaWxlczogc3RyaW5nW10pOiBQcm9taXNlPE5nQW5hbHl6ZWRNb2R1bGVzPiB7XG4gICAgY29uc3QgYW5hbHl6ZVJlc3VsdCA9IGFuYWx5emVBbmRWYWxpZGF0ZU5nTW9kdWxlcyhcbiAgICAgICAgcm9vdEZpbGVzLCB0aGlzLl9ob3N0LCB0aGlzLl9zeW1ib2xSZXNvbHZlciwgdGhpcy5fbWV0YWRhdGFSZXNvbHZlcik7XG4gICAgcmV0dXJuIFByb21pc2VcbiAgICAgICAgLmFsbChhbmFseXplUmVzdWx0Lm5nTW9kdWxlcy5tYXAoXG4gICAgICAgICAgICBuZ01vZHVsZSA9PiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YShcbiAgICAgICAgICAgICAgICBuZ01vZHVsZS50eXBlLnJlZmVyZW5jZSwgZmFsc2UpKSlcbiAgICAgICAgLnRoZW4oKCkgPT4gYW5hbHl6ZVJlc3VsdCk7XG4gIH1cblxuICBwcml2YXRlIF9hbmFseXplRmlsZShmaWxlTmFtZTogc3RyaW5nKTogTmdBbmFseXplZEZpbGUge1xuICAgIGxldCBhbmFseXplZEZpbGUgPSB0aGlzLl9hbmFseXplZEZpbGVzLmdldChmaWxlTmFtZSk7XG4gICAgaWYgKCFhbmFseXplZEZpbGUpIHtcbiAgICAgIGFuYWx5emVkRmlsZSA9XG4gICAgICAgICAgYW5hbHl6ZUZpbGUodGhpcy5faG9zdCwgdGhpcy5fc3ltYm9sUmVzb2x2ZXIsIHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIsIGZpbGVOYW1lKTtcbiAgICAgIHRoaXMuX2FuYWx5emVkRmlsZXMuc2V0KGZpbGVOYW1lLCBhbmFseXplZEZpbGUpO1xuICAgIH1cbiAgICByZXR1cm4gYW5hbHl6ZWRGaWxlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYW5hbHl6ZUZpbGVGb3JJbmplY3RhYmxlcyhmaWxlTmFtZTogc3RyaW5nKTogTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXMge1xuICAgIGxldCBhbmFseXplZEZpbGUgPSB0aGlzLl9hbmFseXplZEZpbGVzRm9ySW5qZWN0YWJsZXMuZ2V0KGZpbGVOYW1lKTtcbiAgICBpZiAoIWFuYWx5emVkRmlsZSkge1xuICAgICAgYW5hbHl6ZWRGaWxlID0gYW5hbHl6ZUZpbGVGb3JJbmplY3RhYmxlcyhcbiAgICAgICAgICB0aGlzLl9ob3N0LCB0aGlzLl9zeW1ib2xSZXNvbHZlciwgdGhpcy5fbWV0YWRhdGFSZXNvbHZlciwgZmlsZU5hbWUpO1xuICAgICAgdGhpcy5fYW5hbHl6ZWRGaWxlc0ZvckluamVjdGFibGVzLnNldChmaWxlTmFtZSwgYW5hbHl6ZWRGaWxlKTtcbiAgICB9XG4gICAgcmV0dXJuIGFuYWx5emVkRmlsZTtcbiAgfVxuXG4gIGZpbmRHZW5lcmF0ZWRGaWxlTmFtZXMoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBnZW5GaWxlTmFtZXM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuX2FuYWx5emVGaWxlKGZpbGVOYW1lKTtcbiAgICAvLyBNYWtlIHN1cmUgd2UgY3JlYXRlIGEgLm5nZmFjdG9yeSBpZiB3ZSBoYXZlIGEgaW5qZWN0YWJsZS9kaXJlY3RpdmUvcGlwZS9OZ01vZHVsZVxuICAgIC8vIG9yIGEgcmVmZXJlbmNlIHRvIGEgbm9uIHNvdXJjZSBmaWxlLlxuICAgIC8vIE5vdGU6IFRoaXMgaXMgb3ZlcmVzdGltYXRpbmcgdGhlIHJlcXVpcmVkIC5uZ2ZhY3RvcnkgZmlsZXMgYXMgdGhlIHJlYWwgY2FsY3VsYXRpb24gaXMgaGFyZGVyLlxuICAgIC8vIE9ubHkgZG8gdGhpcyBmb3IgU3R1YkVtaXRGbGFncy5CYXNpYywgYXMgYWRkaW5nIGEgdHlwZSBjaGVjayBibG9ja1xuICAgIC8vIGRvZXMgbm90IGNoYW5nZSB0aGlzIGZpbGUgKGFzIHdlIGdlbmVyYXRlIHR5cGUgY2hlY2sgYmxvY2tzIGJhc2VkIG9uIE5nTW9kdWxlcykuXG4gICAgaWYgKHRoaXMuX29wdGlvbnMuYWxsb3dFbXB0eUNvZGVnZW5GaWxlcyB8fCBmaWxlLmRpcmVjdGl2ZXMubGVuZ3RoIHx8IGZpbGUucGlwZXMubGVuZ3RoIHx8XG4gICAgICAgIGZpbGUuaW5qZWN0YWJsZXMubGVuZ3RoIHx8IGZpbGUubmdNb2R1bGVzLmxlbmd0aCB8fCBmaWxlLmV4cG9ydHNOb25Tb3VyY2VGaWxlcykge1xuICAgICAgZ2VuRmlsZU5hbWVzLnB1c2gobmdmYWN0b3J5RmlsZVBhdGgoZmlsZS5maWxlTmFtZSwgdHJ1ZSkpO1xuICAgICAgaWYgKHRoaXMuX29wdGlvbnMuZW5hYmxlU3VtbWFyaWVzRm9ySml0KSB7XG4gICAgICAgIGdlbkZpbGVOYW1lcy5wdXNoKHN1bW1hcnlGb3JKaXRGaWxlTmFtZShmaWxlLmZpbGVOYW1lLCB0cnVlKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGZpbGVTdWZmaXggPSBub3JtYWxpemVHZW5GaWxlU3VmZml4KHNwbGl0VHlwZXNjcmlwdFN1ZmZpeChmaWxlLmZpbGVOYW1lLCB0cnVlKVsxXSk7XG4gICAgZmlsZS5kaXJlY3RpdmVzLmZvckVhY2goKGRpclN5bWJvbCkgPT4ge1xuICAgICAgY29uc3QgY29tcE1ldGEgPVxuICAgICAgICAgIHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0Tm9uTm9ybWFsaXplZERpcmVjdGl2ZU1ldGFkYXRhKGRpclN5bWJvbCkgIS5tZXRhZGF0YTtcbiAgICAgIGlmICghY29tcE1ldGEuaXNDb21wb25lbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gTm90ZTogY29tcE1ldGEgaXMgYSBjb21wb25lbnQgYW5kIHRoZXJlZm9yZSB0ZW1wbGF0ZSBpcyBub24gbnVsbC5cbiAgICAgIGNvbXBNZXRhLnRlbXBsYXRlICEuc3R5bGVVcmxzLmZvckVhY2goKHN0eWxlVXJsKSA9PiB7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRVcmwgPSB0aGlzLl9ob3N0LnJlc291cmNlTmFtZVRvRmlsZU5hbWUoc3R5bGVVcmwsIGZpbGUuZmlsZU5hbWUpO1xuICAgICAgICBpZiAoIW5vcm1hbGl6ZWRVcmwpIHtcbiAgICAgICAgICB0aHJvdyBzeW50YXhFcnJvcihgQ291bGRuJ3QgcmVzb2x2ZSByZXNvdXJjZSAke3N0eWxlVXJsfSByZWxhdGl2ZSB0byAke2ZpbGUuZmlsZU5hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbmVlZHNTaGltID0gKGNvbXBNZXRhLnRlbXBsYXRlICEuZW5jYXBzdWxhdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29uZmlnLmRlZmF1bHRFbmNhcHN1bGF0aW9uKSA9PT0gVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gICAgICAgIGdlbkZpbGVOYW1lcy5wdXNoKF9zdHlsZXNNb2R1bGVVcmwobm9ybWFsaXplZFVybCwgbmVlZHNTaGltLCBmaWxlU3VmZml4KSk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLmFsbG93RW1wdHlDb2RlZ2VuRmlsZXMpIHtcbiAgICAgICAgICBnZW5GaWxlTmFtZXMucHVzaChfc3R5bGVzTW9kdWxlVXJsKG5vcm1hbGl6ZWRVcmwsICFuZWVkc1NoaW0sIGZpbGVTdWZmaXgpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGdlbkZpbGVOYW1lcztcbiAgfVxuXG4gIGVtaXRCYXNpY1N0dWIoZ2VuRmlsZU5hbWU6IHN0cmluZywgb3JpZ2luYWxGaWxlTmFtZT86IHN0cmluZyk6IEdlbmVyYXRlZEZpbGUge1xuICAgIGNvbnN0IG91dHB1dEN0eCA9IHRoaXMuX2NyZWF0ZU91dHB1dENvbnRleHQoZ2VuRmlsZU5hbWUpO1xuICAgIGlmIChnZW5GaWxlTmFtZS5lbmRzV2l0aCgnLm5nZmFjdG9yeS50cycpKSB7XG4gICAgICBpZiAoIW9yaWdpbmFsRmlsZU5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbiBlcnJvcjogcmVxdWlyZSB0aGUgb3JpZ2luYWwgZmlsZSBmb3IgLm5nZmFjdG9yeS50cyBzdHVicy4gRmlsZTogJHtnZW5GaWxlTmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZSA9IHRoaXMuX2FuYWx5emVGaWxlKG9yaWdpbmFsRmlsZU5hbWUpO1xuICAgICAgdGhpcy5fY3JlYXRlTmdGYWN0b3J5U3R1YihvdXRwdXRDdHgsIG9yaWdpbmFsRmlsZSwgU3R1YkVtaXRGbGFncy5CYXNpYyk7XG4gICAgfSBlbHNlIGlmIChnZW5GaWxlTmFtZS5lbmRzV2l0aCgnLm5nc3VtbWFyeS50cycpKSB7XG4gICAgICBpZiAodGhpcy5fb3B0aW9ucy5lbmFibGVTdW1tYXJpZXNGb3JKaXQpIHtcbiAgICAgICAgaWYgKCFvcmlnaW5hbEZpbGVOYW1lKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQXNzZXJ0aW9uIGVycm9yOiByZXF1aXJlIHRoZSBvcmlnaW5hbCBmaWxlIGZvciAubmdzdW1tYXJ5LnRzIHN0dWJzLiBGaWxlOiAke2dlbkZpbGVOYW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZSA9IHRoaXMuX2FuYWx5emVGaWxlKG9yaWdpbmFsRmlsZU5hbWUpO1xuICAgICAgICBfY3JlYXRlRW1wdHlTdHViKG91dHB1dEN0eCk7XG4gICAgICAgIG9yaWdpbmFsRmlsZS5uZ01vZHVsZXMuZm9yRWFjaChuZ01vZHVsZSA9PiB7XG4gICAgICAgICAgLy8gY3JlYXRlIGV4cG9ydHMgdGhhdCB1c2VyIGNvZGUgY2FuIHJlZmVyZW5jZVxuICAgICAgICAgIGNyZWF0ZUZvckppdFN0dWIob3V0cHV0Q3R4LCBuZ01vZHVsZS50eXBlLnJlZmVyZW5jZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZ2VuRmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3N0eWxlLnRzJykpIHtcbiAgICAgIF9jcmVhdGVFbXB0eVN0dWIob3V0cHV0Q3R4KTtcbiAgICB9XG4gICAgLy8gTm90ZTogZm9yIHRoZSBzdHVicywgd2UgZG9uJ3QgbmVlZCBhIHByb3BlcnR5IHNyY0ZpbGVVcmwsXG4gICAgLy8gYXMgbGF0ZXIgb24gaW4gZW1pdEFsbEltcGxzIHdlIHdpbGwgY3JlYXRlIHRoZSBwcm9wZXIgR2VuZXJhdGVkRmlsZXMgd2l0aCB0aGVcbiAgICAvLyBjb3JyZWN0IHNyY0ZpbGVVcmwuXG4gICAgLy8gVGhpcyBpcyBnb29kIGFzIGUuZy4gZm9yIC5uZ3N0eWxlLnRzIGZpbGVzIHdlIGNhbid0IGRlcml2ZVxuICAgIC8vIHRoZSB1cmwgb2YgY29tcG9uZW50cyBiYXNlZCBvbiB0aGUgZ2VuRmlsZVVybC5cbiAgICByZXR1cm4gdGhpcy5fY29kZWdlblNvdXJjZU1vZHVsZSgndW5rbm93bicsIG91dHB1dEN0eCk7XG4gIH1cblxuICBlbWl0VHlwZUNoZWNrU3R1YihnZW5GaWxlTmFtZTogc3RyaW5nLCBvcmlnaW5hbEZpbGVOYW1lOiBzdHJpbmcpOiBHZW5lcmF0ZWRGaWxlfG51bGwge1xuICAgIGNvbnN0IG9yaWdpbmFsRmlsZSA9IHRoaXMuX2FuYWx5emVGaWxlKG9yaWdpbmFsRmlsZU5hbWUpO1xuICAgIGNvbnN0IG91dHB1dEN0eCA9IHRoaXMuX2NyZWF0ZU91dHB1dENvbnRleHQoZ2VuRmlsZU5hbWUpO1xuICAgIGlmIChnZW5GaWxlTmFtZS5lbmRzV2l0aCgnLm5nZmFjdG9yeS50cycpKSB7XG4gICAgICB0aGlzLl9jcmVhdGVOZ0ZhY3RvcnlTdHViKG91dHB1dEN0eCwgb3JpZ2luYWxGaWxlLCBTdHViRW1pdEZsYWdzLlR5cGVDaGVjayk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXRDdHguc3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgdGhpcy5fY29kZWdlblNvdXJjZU1vZHVsZShvcmlnaW5hbEZpbGUuZmlsZU5hbWUsIG91dHB1dEN0eCkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgbG9hZEZpbGVzQXN5bmMoZmlsZU5hbWVzOiBzdHJpbmdbXSwgdHNGaWxlczogc3RyaW5nW10pOiBQcm9taXNlPFxuICAgICAge2FuYWx5emVkTW9kdWxlczogTmdBbmFseXplZE1vZHVsZXMsIGFuYWx5emVkSW5qZWN0YWJsZXM6IE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzW119PiB7XG4gICAgY29uc3QgZmlsZXMgPSBmaWxlTmFtZXMubWFwKGZpbGVOYW1lID0+IHRoaXMuX2FuYWx5emVGaWxlKGZpbGVOYW1lKSk7XG4gICAgY29uc3QgbG9hZGluZ1Byb21pc2VzOiBQcm9taXNlPE5nQW5hbHl6ZWRNb2R1bGVzPltdID0gW107XG4gICAgZmlsZXMuZm9yRWFjaChcbiAgICAgICAgZmlsZSA9PiBmaWxlLm5nTW9kdWxlcy5mb3JFYWNoKFxuICAgICAgICAgICAgbmdNb2R1bGUgPT5cbiAgICAgICAgICAgICAgICBsb2FkaW5nUHJvbWlzZXMucHVzaCh0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YShcbiAgICAgICAgICAgICAgICAgICAgbmdNb2R1bGUudHlwZS5yZWZlcmVuY2UsIGZhbHNlKSkpKTtcbiAgICBjb25zdCBhbmFseXplZEluamVjdGFibGVzID0gdHNGaWxlcy5tYXAodHNGaWxlID0+IHRoaXMuX2FuYWx5emVGaWxlRm9ySW5qZWN0YWJsZXModHNGaWxlKSk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKGxvYWRpbmdQcm9taXNlcykudGhlbihfID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuYWx5emVkTW9kdWxlczogbWVyZ2VBbmRWYWxpZGF0ZU5nRmlsZXMoZmlsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmFseXplZEluamVjdGFibGVzOiBhbmFseXplZEluamVjdGFibGVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICB9XG5cbiAgbG9hZEZpbGVzU3luYyhmaWxlTmFtZXM6IHN0cmluZ1tdLCB0c0ZpbGVzOiBzdHJpbmdbXSk6XG4gICAgICB7YW5hbHl6ZWRNb2R1bGVzOiBOZ0FuYWx5emVkTW9kdWxlcywgYW5hbHl6ZWRJbmplY3RhYmxlczogTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXNbXX0ge1xuICAgIGNvbnN0IGZpbGVzID0gZmlsZU5hbWVzLm1hcChmaWxlTmFtZSA9PiB0aGlzLl9hbmFseXplRmlsZShmaWxlTmFtZSkpO1xuICAgIGZpbGVzLmZvckVhY2goXG4gICAgICAgIGZpbGUgPT4gZmlsZS5uZ01vZHVsZXMuZm9yRWFjaChcbiAgICAgICAgICAgIG5nTW9kdWxlID0+IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIubG9hZE5nTW9kdWxlRGlyZWN0aXZlQW5kUGlwZU1ldGFkYXRhKFxuICAgICAgICAgICAgICAgIG5nTW9kdWxlLnR5cGUucmVmZXJlbmNlLCB0cnVlKSkpO1xuICAgIGNvbnN0IGFuYWx5emVkSW5qZWN0YWJsZXMgPSB0c0ZpbGVzLm1hcCh0c0ZpbGUgPT4gdGhpcy5fYW5hbHl6ZUZpbGVGb3JJbmplY3RhYmxlcyh0c0ZpbGUpKTtcbiAgICByZXR1cm4ge1xuICAgICAgYW5hbHl6ZWRNb2R1bGVzOiBtZXJnZUFuZFZhbGlkYXRlTmdGaWxlcyhmaWxlcyksXG4gICAgICBhbmFseXplZEluamVjdGFibGVzOiBhbmFseXplZEluamVjdGFibGVzLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVOZ0ZhY3RvcnlTdHViKFxuICAgICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBmaWxlOiBOZ0FuYWx5emVkRmlsZSwgZW1pdEZsYWdzOiBTdHViRW1pdEZsYWdzKSB7XG4gICAgbGV0IGNvbXBvbmVudElkID0gMDtcbiAgICBmaWxlLm5nTW9kdWxlcy5mb3JFYWNoKChuZ01vZHVsZU1ldGEsIG5nTW9kdWxlSW5kZXgpID0+IHtcbiAgICAgIC8vIE5vdGU6IHRoZSBjb2RlIGJlbG93IG5lZWRzIHRvIGV4ZWN1dGVkIGZvciBTdHViRW1pdEZsYWdzLkJhc2ljIGFuZCBTdHViRW1pdEZsYWdzLlR5cGVDaGVjayxcbiAgICAgIC8vIHNvIHdlIGRvbid0IGNoYW5nZSB0aGUgLm5nZmFjdG9yeSBmaWxlIHRvbyBtdWNoIHdoZW4gYWRkaW5nIHRoZSB0eXBlLWNoZWNrIGJsb2NrLlxuXG4gICAgICAvLyBjcmVhdGUgZXhwb3J0cyB0aGF0IHVzZXIgY29kZSBjYW4gcmVmZXJlbmNlXG4gICAgICB0aGlzLl9uZ01vZHVsZUNvbXBpbGVyLmNyZWF0ZVN0dWIob3V0cHV0Q3R4LCBuZ01vZHVsZU1ldGEudHlwZS5yZWZlcmVuY2UpO1xuXG4gICAgICAvLyBhZGQgcmVmZXJlbmNlcyB0byB0aGUgc3ltYm9scyBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgICAgIC8vIFRoZXNlIGNhbiBiZSB1c2VkIGJ5IHRoZSB0eXBlIGNoZWNrIGJsb2NrIGZvciBjb21wb25lbnRzLFxuICAgICAgLy8gYW5kIHRoZXkgYWxzbyBjYXVzZSBUeXBlU2NyaXB0IHRvIGluY2x1ZGUgdGhlc2UgZmlsZXMgaW50byB0aGUgcHJvZ3JhbSB0b28sXG4gICAgICAvLyB3aGljaCB3aWxsIG1ha2UgdGhlbSBwYXJ0IG9mIHRoZSBhbmFseXplZEZpbGVzLlxuICAgICAgY29uc3QgZXh0ZXJuYWxSZWZlcmVuY2VzOiBTdGF0aWNTeW1ib2xbXSA9IFtcbiAgICAgICAgLy8gQWRkIHJlZmVyZW5jZXMgdGhhdCBhcmUgYXZhaWxhYmxlIGZyb20gYWxsIHRoZSBtb2R1bGVzIGFuZCBpbXBvcnRzLlxuICAgICAgICAuLi5uZ01vZHVsZU1ldGEudHJhbnNpdGl2ZU1vZHVsZS5kaXJlY3RpdmVzLm1hcChkID0+IGQucmVmZXJlbmNlKSxcbiAgICAgICAgLi4ubmdNb2R1bGVNZXRhLnRyYW5zaXRpdmVNb2R1bGUucGlwZXMubWFwKGQgPT4gZC5yZWZlcmVuY2UpLFxuICAgICAgICAuLi5uZ01vZHVsZU1ldGEuaW1wb3J0ZWRNb2R1bGVzLm1hcChtID0+IG0udHlwZS5yZWZlcmVuY2UpLFxuICAgICAgICAuLi5uZ01vZHVsZU1ldGEuZXhwb3J0ZWRNb2R1bGVzLm1hcChtID0+IG0udHlwZS5yZWZlcmVuY2UpLFxuXG4gICAgICAgIC8vIEFkZCByZWZlcmVuY2VzIHRoYXQgbWlnaHQgYmUgaW5zZXJ0ZWQgYnkgdGhlIHRlbXBsYXRlIGNvbXBpbGVyLlxuICAgICAgICAuLi50aGlzLl9leHRlcm5hbElkZW50aWZpZXJSZWZlcmVuY2VzKFtJZGVudGlmaWVycy5UZW1wbGF0ZVJlZiwgSWRlbnRpZmllcnMuRWxlbWVudFJlZl0pLFxuICAgICAgXTtcblxuICAgICAgY29uc3QgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzID0gbmV3IE1hcDxhbnksIHN0cmluZz4oKTtcbiAgICAgIGV4dGVybmFsUmVmZXJlbmNlcy5mb3JFYWNoKChyZWYsIHR5cGVJbmRleCkgPT4ge1xuICAgICAgICBleHRlcm5hbFJlZmVyZW5jZVZhcnMuc2V0KHJlZiwgYF9kZWNsJHtuZ01vZHVsZUluZGV4fV8ke3R5cGVJbmRleH1gKTtcbiAgICAgIH0pO1xuICAgICAgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLmZvckVhY2goKHZhck5hbWUsIHJlZmVyZW5jZSkgPT4ge1xuICAgICAgICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgICAgby52YXJpYWJsZSh2YXJOYW1lKVxuICAgICAgICAgICAgICAgIC5zZXQoby5OVUxMX0VYUFIuY2FzdChvLkRZTkFNSUNfVFlQRSkpXG4gICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQoby5leHByZXNzaW9uVHlwZShvdXRwdXRDdHguaW1wb3J0RXhwcihcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlLCAvKiB0eXBlUGFyYW1zICovIG51bGwsIC8qIHVzZVN1bW1hcmllcyAqLyBmYWxzZSkpKSk7XG4gICAgICB9KTtcblxuICAgICAgaWYgKGVtaXRGbGFncyAmIFN0dWJFbWl0RmxhZ3MuVHlwZUNoZWNrKSB7XG4gICAgICAgIC8vIGFkZCB0aGUgdHlwZS1jaGVjayBibG9jayBmb3IgYWxsIGNvbXBvbmVudHMgb2YgdGhlIE5nTW9kdWxlXG4gICAgICAgIG5nTW9kdWxlTWV0YS5kZWNsYXJlZERpcmVjdGl2ZXMuZm9yRWFjaCgoZGlySWQpID0+IHtcbiAgICAgICAgICBjb25zdCBjb21wTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGlySWQucmVmZXJlbmNlKTtcbiAgICAgICAgICBpZiAoIWNvbXBNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbXBvbmVudElkKys7XG4gICAgICAgICAgdGhpcy5fY3JlYXRlVHlwZUNoZWNrQmxvY2soXG4gICAgICAgICAgICAgIG91dHB1dEN0eCwgYCR7Y29tcE1ldGEudHlwZS5yZWZlcmVuY2UubmFtZX1fSG9zdF8ke2NvbXBvbmVudElkfWAsIG5nTW9kdWxlTWV0YSxcbiAgICAgICAgICAgICAgdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRIb3N0Q29tcG9uZW50TWV0YWRhdGEoY29tcE1ldGEpLCBbY29tcE1ldGEudHlwZV0sXG4gICAgICAgICAgICAgIGV4dGVybmFsUmVmZXJlbmNlVmFycyk7XG4gICAgICAgICAgdGhpcy5fY3JlYXRlVHlwZUNoZWNrQmxvY2soXG4gICAgICAgICAgICAgIG91dHB1dEN0eCwgYCR7Y29tcE1ldGEudHlwZS5yZWZlcmVuY2UubmFtZX1fJHtjb21wb25lbnRJZH1gLCBuZ01vZHVsZU1ldGEsIGNvbXBNZXRhLFxuICAgICAgICAgICAgICBuZ01vZHVsZU1ldGEudHJhbnNpdGl2ZU1vZHVsZS5kaXJlY3RpdmVzLCBleHRlcm5hbFJlZmVyZW5jZVZhcnMpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChvdXRwdXRDdHguc3RhdGVtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIF9jcmVhdGVFbXB0eVN0dWIob3V0cHV0Q3R4KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9leHRlcm5hbElkZW50aWZpZXJSZWZlcmVuY2VzKHJlZmVyZW5jZXM6IG8uRXh0ZXJuYWxSZWZlcmVuY2VbXSk6IFN0YXRpY1N5bWJvbFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IFN0YXRpY1N5bWJvbFtdID0gW107XG4gICAgZm9yIChsZXQgcmVmZXJlbmNlIG9mIHJlZmVyZW5jZXMpIHtcbiAgICAgIGNvbnN0IHRva2VuID0gY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnJlZmxlY3RvciwgcmVmZXJlbmNlKTtcbiAgICAgIGlmICh0b2tlbi5pZGVudGlmaWVyKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHRva2VuLmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZVR5cGVDaGVja0Jsb2NrKFxuICAgICAgY3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnRJZDogc3RyaW5nLCBtb2R1bGVNZXRhOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSxcbiAgICAgIGNvbXBNZXRhOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIGRpcmVjdGl2ZXM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSxcbiAgICAgIGV4dGVybmFsUmVmZXJlbmNlVmFyczogTWFwPGFueSwgc3RyaW5nPikge1xuICAgIGNvbnN0IHt0ZW1wbGF0ZTogcGFyc2VkVGVtcGxhdGUsIHBpcGVzOiB1c2VkUGlwZXN9ID1cbiAgICAgICAgdGhpcy5fcGFyc2VUZW1wbGF0ZShjb21wTWV0YSwgbW9kdWxlTWV0YSwgZGlyZWN0aXZlcyk7XG4gICAgY3R4LnN0YXRlbWVudHMucHVzaCguLi50aGlzLl90eXBlQ2hlY2tDb21waWxlci5jb21waWxlQ29tcG9uZW50KFxuICAgICAgICBjb21wb25lbnRJZCwgY29tcE1ldGEsIHBhcnNlZFRlbXBsYXRlLCB1c2VkUGlwZXMsIGV4dGVybmFsUmVmZXJlbmNlVmFycywgY3R4KSk7XG4gIH1cblxuICBlbWl0TWVzc2FnZUJ1bmRsZShhbmFseXplUmVzdWx0OiBOZ0FuYWx5emVkTW9kdWxlcywgbG9jYWxlOiBzdHJpbmd8bnVsbCk6IE1lc3NhZ2VCdW5kbGUge1xuICAgIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gICAgY29uc3QgaHRtbFBhcnNlciA9IG5ldyBIdG1sUGFyc2VyKCk7XG5cbiAgICAvLyBUT0RPKHZpY2IpOiBpbXBsaWNpdCB0YWdzICYgYXR0cmlidXRlc1xuICAgIGNvbnN0IG1lc3NhZ2VCdW5kbGUgPSBuZXcgTWVzc2FnZUJ1bmRsZShodG1sUGFyc2VyLCBbXSwge30sIGxvY2FsZSk7XG5cbiAgICBhbmFseXplUmVzdWx0LmZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICBjb25zdCBjb21wTWV0YXM6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YVtdID0gW107XG4gICAgICBmaWxlLmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmVUeXBlID0+IHtcbiAgICAgICAgY29uc3QgZGlyTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGlyZWN0aXZlVHlwZSk7XG4gICAgICAgIGlmIChkaXJNZXRhICYmIGRpck1ldGEuaXNDb21wb25lbnQpIHtcbiAgICAgICAgICBjb21wTWV0YXMucHVzaChkaXJNZXRhKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb21wTWV0YXMuZm9yRWFjaChjb21wTWV0YSA9PiB7XG4gICAgICAgIGNvbnN0IGh0bWwgPSBjb21wTWV0YS50ZW1wbGF0ZSAhLnRlbXBsYXRlICE7XG4gICAgICAgIC8vIFRlbXBsYXRlIFVSTCBwb2ludHMgdG8gZWl0aGVyIGFuIEhUTUwgb3IgVFMgZmlsZSBkZXBlbmRpbmcgb24gd2hldGhlclxuICAgICAgICAvLyB0aGUgZmlsZSBpcyB1c2VkIHdpdGggYHRlbXBsYXRlVXJsOmAgb3IgYHRlbXBsYXRlOmAsIHJlc3BlY3RpdmVseS5cbiAgICAgICAgY29uc3QgdGVtcGxhdGVVcmwgPSBjb21wTWV0YS50ZW1wbGF0ZSAhLnRlbXBsYXRlVXJsICE7XG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPVxuICAgICAgICAgICAgSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoY29tcE1ldGEudGVtcGxhdGUgIS5pbnRlcnBvbGF0aW9uKTtcbiAgICAgICAgZXJyb3JzLnB1c2goLi4ubWVzc2FnZUJ1bmRsZS51cGRhdGVGcm9tVGVtcGxhdGUoaHRtbCwgdGVtcGxhdGVVcmwsIGludGVycG9sYXRpb25Db25maWcpICEpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoZSA9PiBlLnRvU3RyaW5nKCkpLmpvaW4oJ1xcbicpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWVzc2FnZUJ1bmRsZTtcbiAgfVxuXG4gIGVtaXRBbGxQYXJ0aWFsTW9kdWxlcyhcbiAgICAgIHtuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlLCBmaWxlc306IE5nQW5hbHl6ZWRNb2R1bGVzLFxuICAgICAgcjNGaWxlczogTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXNbXSk6IFBhcnRpYWxNb2R1bGVbXSB7XG4gICAgY29uc3QgY29udGV4dE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBPdXRwdXRDb250ZXh0PigpO1xuXG4gICAgY29uc3QgZ2V0Q29udGV4dCA9IChmaWxlTmFtZTogc3RyaW5nKTogT3V0cHV0Q29udGV4dCA9PiB7XG4gICAgICBpZiAoIWNvbnRleHRNYXAuaGFzKGZpbGVOYW1lKSkge1xuICAgICAgICBjb250ZXh0TWFwLnNldChmaWxlTmFtZSwgdGhpcy5fY3JlYXRlT3V0cHV0Q29udGV4dChmaWxlTmFtZSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnRleHRNYXAuZ2V0KGZpbGVOYW1lKSAhO1xuICAgIH07XG5cbiAgICBmaWxlcy5mb3JFYWNoKFxuICAgICAgICBmaWxlID0+IHRoaXMuX2NvbXBpbGVQYXJ0aWFsTW9kdWxlKFxuICAgICAgICAgICAgZmlsZS5maWxlTmFtZSwgbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZSwgZmlsZS5kaXJlY3RpdmVzLCBmaWxlLnBpcGVzLCBmaWxlLm5nTW9kdWxlcyxcbiAgICAgICAgICAgIGZpbGUuaW5qZWN0YWJsZXMsIGdldENvbnRleHQoZmlsZS5maWxlTmFtZSkpKTtcbiAgICByM0ZpbGVzLmZvckVhY2goXG4gICAgICAgIGZpbGUgPT4gdGhpcy5fY29tcGlsZVNoYWxsb3dNb2R1bGVzKFxuICAgICAgICAgICAgZmlsZS5maWxlTmFtZSwgZmlsZS5zaGFsbG93TW9kdWxlcywgZ2V0Q29udGV4dChmaWxlLmZpbGVOYW1lKSkpO1xuXG4gICAgcmV0dXJuIEFycmF5LmZyb20oY29udGV4dE1hcC52YWx1ZXMoKSlcbiAgICAgICAgLm1hcChjb250ZXh0ID0+ICh7XG4gICAgICAgICAgICAgICBmaWxlTmFtZTogY29udGV4dC5nZW5GaWxlUGF0aCxcbiAgICAgICAgICAgICAgIHN0YXRlbWVudHM6IFsuLi5jb250ZXh0LmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLCAuLi5jb250ZXh0LnN0YXRlbWVudHNdLFxuICAgICAgICAgICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbXBpbGVTaGFsbG93TW9kdWxlcyhcbiAgICAgIGZpbGVOYW1lOiBzdHJpbmcsIHNoYWxsb3dNb2R1bGVzOiBDb21waWxlU2hhbGxvd01vZHVsZU1ldGFkYXRhW10sXG4gICAgICBjb250ZXh0OiBPdXRwdXRDb250ZXh0KTogdm9pZCB7XG4gICAgc2hhbGxvd01vZHVsZXMuZm9yRWFjaChtb2R1bGUgPT4gY29tcGlsZVIzTW9kdWxlKGNvbnRleHQsIG1vZHVsZSwgdGhpcy5faW5qZWN0YWJsZUNvbXBpbGVyKSk7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlUGFydGlhbE1vZHVsZShcbiAgICAgIGZpbGVOYW1lOiBzdHJpbmcsIG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmU6IE1hcDxTdGF0aWNTeW1ib2wsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhPixcbiAgICAgIGRpcmVjdGl2ZXM6IFN0YXRpY1N5bWJvbFtdLCBwaXBlczogU3RhdGljU3ltYm9sW10sIG5nTW9kdWxlczogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGFbXSxcbiAgICAgIGluamVjdGFibGVzOiBDb21waWxlSW5qZWN0YWJsZU1ldGFkYXRhW10sIGNvbnRleHQ6IE91dHB1dENvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXG4gICAgY29uc3Qgc2NoZW1hUmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdQYXJzZXIgPSBuZXcgQmluZGluZ1BhcnNlcihcbiAgICAgICAgdGhpcy5fdGVtcGxhdGVQYXJzZXIuZXhwcmVzc2lvblBhcnNlciwgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgc2NoZW1hUmVnaXN0cnksIFtdLFxuICAgICAgICBlcnJvcnMpO1xuXG4gICAgLy8gUHJvY2VzcyBhbGwgY29tcG9uZW50cyBhbmQgZGlyZWN0aXZlc1xuICAgIGRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmVUeXBlID0+IHtcbiAgICAgIGNvbnN0IGRpcmVjdGl2ZU1ldGFkYXRhID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVNZXRhZGF0YShkaXJlY3RpdmVUeXBlKTtcbiAgICAgIGlmIChkaXJlY3RpdmVNZXRhZGF0YS5pc0NvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBtb2R1bGUgPSBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlLmdldChkaXJlY3RpdmVUeXBlKSAhO1xuICAgICAgICBtb2R1bGUgfHxcbiAgICAgICAgICAgIGVycm9yKFxuICAgICAgICAgICAgICAgIGBDYW5ub3QgZGV0ZXJtaW5lIHRoZSBtb2R1bGUgZm9yIGNvbXBvbmVudCAnJHtpZGVudGlmaWVyTmFtZShkaXJlY3RpdmVNZXRhZGF0YS50eXBlKX0nYCk7XG5cbiAgICAgICAgbGV0IGh0bWxBc3QgPSBkaXJlY3RpdmVNZXRhZGF0YS50ZW1wbGF0ZSAhLmh0bWxBc3QgITtcbiAgICAgICAgY29uc3QgcHJlc2VydmVXaGl0ZXNwYWNlcyA9IGRpcmVjdGl2ZU1ldGFkYXRhICEudGVtcGxhdGUgIS5wcmVzZXJ2ZVdoaXRlc3BhY2VzO1xuXG4gICAgICAgIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgICAgICAgIGh0bWxBc3QgPSByZW1vdmVXaGl0ZXNwYWNlcyhodG1sQXN0KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZW5kZXIzQXN0ID0gaHRtbEFzdFRvUmVuZGVyM0FzdChodG1sQXN0LnJvb3ROb2RlcywgaG9zdEJpbmRpbmdQYXJzZXIpO1xuXG4gICAgICAgIC8vIE1hcCBvZiBTdGF0aWNUeXBlIGJ5IGRpcmVjdGl2ZSBzZWxlY3RvcnNcbiAgICAgICAgY29uc3QgZGlyZWN0aXZlVHlwZUJ5U2VsID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oKTtcblxuICAgICAgICBjb25zdCBkaXJlY3RpdmVzID0gbW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUuZGlyZWN0aXZlcy5tYXAoXG4gICAgICAgICAgICBkaXIgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVTdW1tYXJ5KGRpci5yZWZlcmVuY2UpKTtcblxuICAgICAgICBkaXJlY3RpdmVzLmZvckVhY2goZGlyZWN0aXZlID0+IHtcbiAgICAgICAgICBpZiAoZGlyZWN0aXZlLnNlbGVjdG9yKSB7XG4gICAgICAgICAgICBkaXJlY3RpdmVUeXBlQnlTZWwuc2V0KGRpcmVjdGl2ZS5zZWxlY3RvciwgZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE1hcCBvZiBTdGF0aWNUeXBlIGJ5IHBpcGUgbmFtZXNcbiAgICAgICAgY29uc3QgcGlwZVR5cGVCeU5hbWUgPSBuZXcgTWFwPHN0cmluZywgYW55PigpO1xuXG4gICAgICAgIGNvbnN0IHBpcGVzID0gbW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUucGlwZXMubWFwKFxuICAgICAgICAgICAgcGlwZSA9PiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldFBpcGVTdW1tYXJ5KHBpcGUucmVmZXJlbmNlKSk7XG5cbiAgICAgICAgcGlwZXMuZm9yRWFjaChwaXBlID0+IHsgcGlwZVR5cGVCeU5hbWUuc2V0KHBpcGUubmFtZSwgcGlwZS50eXBlLnJlZmVyZW5jZSk7IH0pO1xuXG4gICAgICAgIGNvbXBpbGVSM0NvbXBvbmVudChcbiAgICAgICAgICAgIGNvbnRleHQsIGRpcmVjdGl2ZU1ldGFkYXRhLCByZW5kZXIzQXN0LCB0aGlzLnJlZmxlY3RvciwgaG9zdEJpbmRpbmdQYXJzZXIsXG4gICAgICAgICAgICBkaXJlY3RpdmVUeXBlQnlTZWwsIHBpcGVUeXBlQnlOYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbXBpbGVSM0RpcmVjdGl2ZShjb250ZXh0LCBkaXJlY3RpdmVNZXRhZGF0YSwgdGhpcy5yZWZsZWN0b3IsIGhvc3RCaW5kaW5nUGFyc2VyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHBpcGVzLmZvckVhY2gocGlwZVR5cGUgPT4ge1xuICAgICAgY29uc3QgcGlwZU1ldGFkYXRhID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRQaXBlTWV0YWRhdGEocGlwZVR5cGUpO1xuICAgICAgaWYgKHBpcGVNZXRhZGF0YSkge1xuICAgICAgICBjb21waWxlUjNQaXBlKGNvbnRleHQsIHBpcGVNZXRhZGF0YSwgdGhpcy5yZWZsZWN0b3IpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaW5qZWN0YWJsZXMuZm9yRWFjaChpbmplY3RhYmxlID0+IHRoaXMuX2luamVjdGFibGVDb21waWxlci5jb21waWxlKGluamVjdGFibGUsIGNvbnRleHQpKTtcbiAgfVxuXG4gIGVtaXRBbGxQYXJ0aWFsTW9kdWxlczIoZmlsZXM6IE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzW10pOiBQYXJ0aWFsTW9kdWxlW10ge1xuICAgIC8vIFVzaW5nIHJlZHVjZSBsaWtlIHRoaXMgaXMgYSBzZWxlY3QgbWFueSBwYXR0ZXJuICh3aGVyZSBtYXAgaXMgYSBzZWxlY3QgcGF0dGVybilcbiAgICByZXR1cm4gZmlsZXMucmVkdWNlPFBhcnRpYWxNb2R1bGVbXT4oKHIsIGZpbGUpID0+IHtcbiAgICAgIHIucHVzaCguLi50aGlzLl9lbWl0UGFydGlhbE1vZHVsZTIoZmlsZS5maWxlTmFtZSwgZmlsZS5pbmplY3RhYmxlcykpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfSwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW1pdFBhcnRpYWxNb2R1bGUyKGZpbGVOYW1lOiBzdHJpbmcsIGluamVjdGFibGVzOiBDb21waWxlSW5qZWN0YWJsZU1ldGFkYXRhW10pOlxuICAgICAgUGFydGlhbE1vZHVsZVtdIHtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5fY3JlYXRlT3V0cHV0Q29udGV4dChmaWxlTmFtZSk7XG5cbiAgICBpbmplY3RhYmxlcy5mb3JFYWNoKGluamVjdGFibGUgPT4gdGhpcy5faW5qZWN0YWJsZUNvbXBpbGVyLmNvbXBpbGUoaW5qZWN0YWJsZSwgY29udGV4dCkpO1xuXG4gICAgaWYgKGNvbnRleHQuc3RhdGVtZW50cyAmJiBjb250ZXh0LnN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIFt7ZmlsZU5hbWUsIHN0YXRlbWVudHM6IFsuLi5jb250ZXh0LmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLCAuLi5jb250ZXh0LnN0YXRlbWVudHNdfV07XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGVtaXRBbGxJbXBscyhhbmFseXplUmVzdWx0OiBOZ0FuYWx5emVkTW9kdWxlcyk6IEdlbmVyYXRlZEZpbGVbXSB7XG4gICAgY29uc3Qge25nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUsIGZpbGVzfSA9IGFuYWx5emVSZXN1bHQ7XG4gICAgY29uc3Qgc291cmNlTW9kdWxlcyA9IGZpbGVzLm1hcChcbiAgICAgICAgZmlsZSA9PiB0aGlzLl9jb21waWxlSW1wbEZpbGUoXG4gICAgICAgICAgICBmaWxlLmZpbGVOYW1lLCBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlLCBmaWxlLmRpcmVjdGl2ZXMsIGZpbGUucGlwZXMsIGZpbGUubmdNb2R1bGVzLFxuICAgICAgICAgICAgZmlsZS5pbmplY3RhYmxlcykpO1xuICAgIHJldHVybiBmbGF0dGVuKHNvdXJjZU1vZHVsZXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tcGlsZUltcGxGaWxlKFxuICAgICAgc3JjRmlsZVVybDogc3RyaW5nLCBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlOiBNYXA8U3RhdGljU3ltYm9sLCBDb21waWxlTmdNb2R1bGVNZXRhZGF0YT4sXG4gICAgICBkaXJlY3RpdmVzOiBTdGF0aWNTeW1ib2xbXSwgcGlwZXM6IFN0YXRpY1N5bWJvbFtdLCBuZ01vZHVsZXM6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhW10sXG4gICAgICBpbmplY3RhYmxlczogQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YVtdKTogR2VuZXJhdGVkRmlsZVtdIHtcbiAgICBjb25zdCBmaWxlU3VmZml4ID0gbm9ybWFsaXplR2VuRmlsZVN1ZmZpeChzcGxpdFR5cGVzY3JpcHRTdWZmaXgoc3JjRmlsZVVybCwgdHJ1ZSlbMV0pO1xuICAgIGNvbnN0IGdlbmVyYXRlZEZpbGVzOiBHZW5lcmF0ZWRGaWxlW10gPSBbXTtcblxuICAgIGNvbnN0IG91dHB1dEN0eCA9IHRoaXMuX2NyZWF0ZU91dHB1dENvbnRleHQobmdmYWN0b3J5RmlsZVBhdGgoc3JjRmlsZVVybCwgdHJ1ZSkpO1xuXG4gICAgZ2VuZXJhdGVkRmlsZXMucHVzaChcbiAgICAgICAgLi4udGhpcy5fY3JlYXRlU3VtbWFyeShzcmNGaWxlVXJsLCBkaXJlY3RpdmVzLCBwaXBlcywgbmdNb2R1bGVzLCBpbmplY3RhYmxlcywgb3V0cHV0Q3R4KSk7XG5cbiAgICAvLyBjb21waWxlIGFsbCBuZyBtb2R1bGVzXG4gICAgbmdNb2R1bGVzLmZvckVhY2goKG5nTW9kdWxlTWV0YSkgPT4gdGhpcy5fY29tcGlsZU1vZHVsZShvdXRwdXRDdHgsIG5nTW9kdWxlTWV0YSkpO1xuXG4gICAgLy8gY29tcGlsZSBjb21wb25lbnRzXG4gICAgZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJUeXBlKSA9PiB7XG4gICAgICBjb25zdCBjb21wTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoPGFueT5kaXJUeXBlKTtcbiAgICAgIGlmICghY29tcE1ldGEuaXNDb21wb25lbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgbmdNb2R1bGUgPSBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlLmdldChkaXJUeXBlKTtcbiAgICAgIGlmICghbmdNb2R1bGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEludGVybmFsIEVycm9yOiBjYW5ub3QgZGV0ZXJtaW5lIHRoZSBtb2R1bGUgZm9yIGNvbXBvbmVudCAke2lkZW50aWZpZXJOYW1lKGNvbXBNZXRhLnR5cGUpfSFgKTtcbiAgICAgIH1cblxuICAgICAgLy8gY29tcGlsZSBzdHlsZXNcbiAgICAgIGNvbnN0IGNvbXBvbmVudFN0eWxlc2hlZXQgPSB0aGlzLl9zdHlsZUNvbXBpbGVyLmNvbXBpbGVDb21wb25lbnQob3V0cHV0Q3R4LCBjb21wTWV0YSk7XG4gICAgICAvLyBOb3RlOiBjb21wTWV0YSBpcyBhIGNvbXBvbmVudCBhbmQgdGhlcmVmb3JlIHRlbXBsYXRlIGlzIG5vbiBudWxsLlxuICAgICAgY29tcE1ldGEudGVtcGxhdGUgIS5leHRlcm5hbFN0eWxlc2hlZXRzLmZvckVhY2goKHN0eWxlc2hlZXRNZXRhKSA9PiB7XG4gICAgICAgIC8vIE5vdGU6IGZpbGwgbm9uIHNoaW0gYW5kIHNoaW0gc3R5bGUgZmlsZXMgYXMgdGhleSBtaWdodFxuICAgICAgICAvLyBiZSBzaGFyZWQgYnkgY29tcG9uZW50IHdpdGggYW5kIHdpdGhvdXQgVmlld0VuY2Fwc3VsYXRpb24uXG4gICAgICAgIGNvbnN0IHNoaW0gPSB0aGlzLl9zdHlsZUNvbXBpbGVyLm5lZWRzU3R5bGVTaGltKGNvbXBNZXRhKTtcbiAgICAgICAgZ2VuZXJhdGVkRmlsZXMucHVzaChcbiAgICAgICAgICAgIHRoaXMuX2NvZGVnZW5TdHlsZXMoc3JjRmlsZVVybCwgY29tcE1ldGEsIHN0eWxlc2hlZXRNZXRhLCBzaGltLCBmaWxlU3VmZml4KSk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLmFsbG93RW1wdHlDb2RlZ2VuRmlsZXMpIHtcbiAgICAgICAgICBnZW5lcmF0ZWRGaWxlcy5wdXNoKFxuICAgICAgICAgICAgICB0aGlzLl9jb2RlZ2VuU3R5bGVzKHNyY0ZpbGVVcmwsIGNvbXBNZXRhLCBzdHlsZXNoZWV0TWV0YSwgIXNoaW0sIGZpbGVTdWZmaXgpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGNvbXBpbGUgY29tcG9uZW50c1xuICAgICAgY29uc3QgY29tcFZpZXdWYXJzID0gdGhpcy5fY29tcGlsZUNvbXBvbmVudChcbiAgICAgICAgICBvdXRwdXRDdHgsIGNvbXBNZXRhLCBuZ01vZHVsZSwgbmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5kaXJlY3RpdmVzLCBjb21wb25lbnRTdHlsZXNoZWV0LFxuICAgICAgICAgIGZpbGVTdWZmaXgpO1xuICAgICAgdGhpcy5fY29tcGlsZUNvbXBvbmVudEZhY3Rvcnkob3V0cHV0Q3R4LCBjb21wTWV0YSwgbmdNb2R1bGUsIGZpbGVTdWZmaXgpO1xuICAgIH0pO1xuICAgIGlmIChvdXRwdXRDdHguc3RhdGVtZW50cy5sZW5ndGggPiAwIHx8IHRoaXMuX29wdGlvbnMuYWxsb3dFbXB0eUNvZGVnZW5GaWxlcykge1xuICAgICAgY29uc3Qgc3JjTW9kdWxlID0gdGhpcy5fY29kZWdlblNvdXJjZU1vZHVsZShzcmNGaWxlVXJsLCBvdXRwdXRDdHgpO1xuICAgICAgZ2VuZXJhdGVkRmlsZXMudW5zaGlmdChzcmNNb2R1bGUpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVkRmlsZXM7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVTdW1tYXJ5KFxuICAgICAgc3JjRmlsZU5hbWU6IHN0cmluZywgZGlyZWN0aXZlczogU3RhdGljU3ltYm9sW10sIHBpcGVzOiBTdGF0aWNTeW1ib2xbXSxcbiAgICAgIG5nTW9kdWxlczogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGFbXSwgaW5qZWN0YWJsZXM6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGFbXSxcbiAgICAgIG5nRmFjdG9yeUN0eDogT3V0cHV0Q29udGV4dCk6IEdlbmVyYXRlZEZpbGVbXSB7XG4gICAgY29uc3Qgc3ltYm9sU3VtbWFyaWVzID0gdGhpcy5fc3ltYm9sUmVzb2x2ZXIuZ2V0U3ltYm9sc09mKHNyY0ZpbGVOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKHN5bWJvbCA9PiB0aGlzLl9zeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHN5bWJvbCkpO1xuICAgIGNvbnN0IHR5cGVEYXRhOiB7XG4gICAgICBzdW1tYXJ5OiBDb21waWxlVHlwZVN1bW1hcnksXG4gICAgICBtZXRhZGF0YTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEgfCBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEgfCBDb21waWxlUGlwZU1ldGFkYXRhIHxcbiAgICAgICAgICBDb21waWxlVHlwZU1ldGFkYXRhXG4gICAgfVtdID1cbiAgICAgICAgW1xuICAgICAgICAgIC4uLm5nTW9kdWxlcy5tYXAoXG4gICAgICAgICAgICAgIG1ldGEgPT4gKHtcbiAgICAgICAgICAgICAgICBzdW1tYXJ5OiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldE5nTW9kdWxlU3VtbWFyeShtZXRhLnR5cGUucmVmZXJlbmNlKSAhLFxuICAgICAgICAgICAgICAgIG1ldGFkYXRhOiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldE5nTW9kdWxlTWV0YWRhdGEobWV0YS50eXBlLnJlZmVyZW5jZSkgIVxuICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgLi4uZGlyZWN0aXZlcy5tYXAocmVmID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZVN1bW1hcnkocmVmKSAhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YWRhdGE6IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEocmVmKSAhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgIC4uLnBpcGVzLm1hcChyZWYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldFBpcGVTdW1tYXJ5KHJlZikgISxcbiAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YTogdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRQaXBlTWV0YWRhdGEocmVmKSAhXG4gICAgICAgICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAuLi5pbmplY3RhYmxlcy5tYXAoXG4gICAgICAgICAgICAgIHJlZiA9PiAoe1xuICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0SW5qZWN0YWJsZVN1bW1hcnkocmVmLnN5bWJvbCkgISxcbiAgICAgICAgICAgICAgICBtZXRhZGF0YTogdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRJbmplY3RhYmxlU3VtbWFyeShyZWYuc3ltYm9sKSAhLnR5cGVcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgIF07XG4gICAgY29uc3QgZm9ySml0T3V0cHV0Q3R4ID0gdGhpcy5fb3B0aW9ucy5lbmFibGVTdW1tYXJpZXNGb3JKaXQgP1xuICAgICAgICB0aGlzLl9jcmVhdGVPdXRwdXRDb250ZXh0KHN1bW1hcnlGb3JKaXRGaWxlTmFtZShzcmNGaWxlTmFtZSwgdHJ1ZSkpIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCB7anNvbiwgZXhwb3J0QXN9ID0gc2VyaWFsaXplU3VtbWFyaWVzKFxuICAgICAgICBzcmNGaWxlTmFtZSwgZm9ySml0T3V0cHV0Q3R4LCB0aGlzLl9zdW1tYXJ5UmVzb2x2ZXIsIHRoaXMuX3N5bWJvbFJlc29sdmVyLCBzeW1ib2xTdW1tYXJpZXMsXG4gICAgICAgIHR5cGVEYXRhLCB0aGlzLl9vcHRpb25zLmNyZWF0ZUV4dGVybmFsU3ltYm9sRmFjdG9yeVJlZXhwb3J0cyk7XG4gICAgZXhwb3J0QXMuZm9yRWFjaCgoZW50cnkpID0+IHtcbiAgICAgIG5nRmFjdG9yeUN0eC5zdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgby52YXJpYWJsZShlbnRyeS5leHBvcnRBcykuc2V0KG5nRmFjdG9yeUN0eC5pbXBvcnRFeHByKGVudHJ5LnN5bWJvbCkpLnRvRGVjbFN0bXQobnVsbCwgW1xuICAgICAgICAgICAgby5TdG10TW9kaWZpZXIuRXhwb3J0ZWRcbiAgICAgICAgICBdKSk7XG4gICAgfSk7XG4gICAgY29uc3Qgc3VtbWFyeUpzb24gPSBuZXcgR2VuZXJhdGVkRmlsZShzcmNGaWxlTmFtZSwgc3VtbWFyeUZpbGVOYW1lKHNyY0ZpbGVOYW1lKSwganNvbik7XG4gICAgY29uc3QgcmVzdWx0ID0gW3N1bW1hcnlKc29uXTtcbiAgICBpZiAoZm9ySml0T3V0cHV0Q3R4KSB7XG4gICAgICByZXN1bHQucHVzaCh0aGlzLl9jb2RlZ2VuU291cmNlTW9kdWxlKHNyY0ZpbGVOYW1lLCBmb3JKaXRPdXRwdXRDdHgpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbXBpbGVNb2R1bGUob3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBuZ01vZHVsZTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEpOiB2b2lkIHtcbiAgICBjb25zdCBwcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10gPSBbXTtcblxuICAgIGlmICh0aGlzLl9vcHRpb25zLmxvY2FsZSkge1xuICAgICAgY29uc3Qgbm9ybWFsaXplZExvY2FsZSA9IHRoaXMuX29wdGlvbnMubG9jYWxlLnJlcGxhY2UoL18vZywgJy0nKTtcbiAgICAgIHByb3ZpZGVycy5wdXNoKHtcbiAgICAgICAgdG9rZW46IGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UodGhpcy5yZWZsZWN0b3IsIElkZW50aWZpZXJzLkxPQ0FMRV9JRCksXG4gICAgICAgIHVzZVZhbHVlOiBub3JtYWxpemVkTG9jYWxlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX29wdGlvbnMuaTE4bkZvcm1hdCkge1xuICAgICAgcHJvdmlkZXJzLnB1c2goe1xuICAgICAgICB0b2tlbjogY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnJlZmxlY3RvciwgSWRlbnRpZmllcnMuVFJBTlNMQVRJT05TX0ZPUk1BVCksXG4gICAgICAgIHVzZVZhbHVlOiB0aGlzLl9vcHRpb25zLmkxOG5Gb3JtYXRcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuX25nTW9kdWxlQ29tcGlsZXIuY29tcGlsZShvdXRwdXRDdHgsIG5nTW9kdWxlLCBwcm92aWRlcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tcGlsZUNvbXBvbmVudEZhY3RvcnkoXG4gICAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBNZXRhOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsXG4gICAgICBuZ01vZHVsZTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsIGZpbGVTdWZmaXg6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGhvc3RNZXRhID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRIb3N0Q29tcG9uZW50TWV0YWRhdGEoY29tcE1ldGEpO1xuICAgIGNvbnN0IGhvc3RWaWV3RmFjdG9yeVZhciA9XG4gICAgICAgIHRoaXMuX2NvbXBpbGVDb21wb25lbnQob3V0cHV0Q3R4LCBob3N0TWV0YSwgbmdNb2R1bGUsIFtjb21wTWV0YS50eXBlXSwgbnVsbCwgZmlsZVN1ZmZpeClcbiAgICAgICAgICAgIC52aWV3Q2xhc3NWYXI7XG4gICAgY29uc3QgY29tcEZhY3RvcnlWYXIgPSBjb21wb25lbnRGYWN0b3J5TmFtZShjb21wTWV0YS50eXBlLnJlZmVyZW5jZSk7XG4gICAgY29uc3QgaW5wdXRzRXhwcnM6IG8uTGl0ZXJhbE1hcEVudHJ5W10gPSBbXTtcbiAgICBmb3IgKGxldCBwcm9wTmFtZSBpbiBjb21wTWV0YS5pbnB1dHMpIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlTmFtZSA9IGNvbXBNZXRhLmlucHV0c1twcm9wTmFtZV07XG4gICAgICAvLyBEb24ndCBxdW90ZSBzbyB0aGF0IHRoZSBrZXkgZ2V0cyBtaW5pZmllZC4uLlxuICAgICAgaW5wdXRzRXhwcnMucHVzaChuZXcgby5MaXRlcmFsTWFwRW50cnkocHJvcE5hbWUsIG8ubGl0ZXJhbCh0ZW1wbGF0ZU5hbWUpLCBmYWxzZSkpO1xuICAgIH1cbiAgICBjb25zdCBvdXRwdXRzRXhwcnM6IG8uTGl0ZXJhbE1hcEVudHJ5W10gPSBbXTtcbiAgICBmb3IgKGxldCBwcm9wTmFtZSBpbiBjb21wTWV0YS5vdXRwdXRzKSB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBjb21wTWV0YS5vdXRwdXRzW3Byb3BOYW1lXTtcbiAgICAgIC8vIERvbid0IHF1b3RlIHNvIHRoYXQgdGhlIGtleSBnZXRzIG1pbmlmaWVkLi4uXG4gICAgICBvdXRwdXRzRXhwcnMucHVzaChuZXcgby5MaXRlcmFsTWFwRW50cnkocHJvcE5hbWUsIG8ubGl0ZXJhbCh0ZW1wbGF0ZU5hbWUpLCBmYWxzZSkpO1xuICAgIH1cblxuICAgIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgIG8udmFyaWFibGUoY29tcEZhY3RvcnlWYXIpXG4gICAgICAgICAgICAuc2V0KG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5jcmVhdGVDb21wb25lbnRGYWN0b3J5KS5jYWxsRm4oW1xuICAgICAgICAgICAgICBvLmxpdGVyYWwoY29tcE1ldGEuc2VsZWN0b3IpLCBvdXRwdXRDdHguaW1wb3J0RXhwcihjb21wTWV0YS50eXBlLnJlZmVyZW5jZSksXG4gICAgICAgICAgICAgIG8udmFyaWFibGUoaG9zdFZpZXdGYWN0b3J5VmFyKSwgbmV3IG8uTGl0ZXJhbE1hcEV4cHIoaW5wdXRzRXhwcnMpLFxuICAgICAgICAgICAgICBuZXcgby5MaXRlcmFsTWFwRXhwcihvdXRwdXRzRXhwcnMpLFxuICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoXG4gICAgICAgICAgICAgICAgICBjb21wTWV0YS50ZW1wbGF0ZSAhLm5nQ29udGVudFNlbGVjdG9ycy5tYXAoc2VsZWN0b3IgPT4gby5saXRlcmFsKHNlbGVjdG9yKSkpXG4gICAgICAgICAgICBdKSlcbiAgICAgICAgICAgIC50b0RlY2xTdG10KFxuICAgICAgICAgICAgICAgIG8uaW1wb3J0VHlwZShcbiAgICAgICAgICAgICAgICAgICAgSWRlbnRpZmllcnMuQ29tcG9uZW50RmFjdG9yeSxcbiAgICAgICAgICAgICAgICAgICAgW28uZXhwcmVzc2lvblR5cGUob3V0cHV0Q3R4LmltcG9ydEV4cHIoY29tcE1ldGEudHlwZS5yZWZlcmVuY2UpKSAhXSxcbiAgICAgICAgICAgICAgICAgICAgW28uVHlwZU1vZGlmaWVyLkNvbnN0XSksXG4gICAgICAgICAgICAgICAgW28uU3RtdE1vZGlmaWVyLkZpbmFsLCBvLlN0bXRNb2RpZmllci5FeHBvcnRlZF0pKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbXBpbGVDb21wb25lbnQoXG4gICAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBNZXRhOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsXG4gICAgICBuZ01vZHVsZTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsIGRpcmVjdGl2ZUlkZW50aWZpZXJzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10sXG4gICAgICBjb21wb25lbnRTdHlsZXM6IENvbXBpbGVkU3R5bGVzaGVldHxudWxsLCBmaWxlU3VmZml4OiBzdHJpbmcpOiBWaWV3Q29tcGlsZVJlc3VsdCB7XG4gICAgY29uc3Qge3RlbXBsYXRlOiBwYXJzZWRUZW1wbGF0ZSwgcGlwZXM6IHVzZWRQaXBlc30gPVxuICAgICAgICB0aGlzLl9wYXJzZVRlbXBsYXRlKGNvbXBNZXRhLCBuZ01vZHVsZSwgZGlyZWN0aXZlSWRlbnRpZmllcnMpO1xuICAgIGNvbnN0IHN0eWxlc0V4cHIgPSBjb21wb25lbnRTdHlsZXMgPyBvLnZhcmlhYmxlKGNvbXBvbmVudFN0eWxlcy5zdHlsZXNWYXIpIDogby5saXRlcmFsQXJyKFtdKTtcbiAgICBjb25zdCB2aWV3UmVzdWx0ID0gdGhpcy5fdmlld0NvbXBpbGVyLmNvbXBpbGVDb21wb25lbnQoXG4gICAgICAgIG91dHB1dEN0eCwgY29tcE1ldGEsIHBhcnNlZFRlbXBsYXRlLCBzdHlsZXNFeHByLCB1c2VkUGlwZXMpO1xuICAgIGlmIChjb21wb25lbnRTdHlsZXMpIHtcbiAgICAgIF9yZXNvbHZlU3R5bGVTdGF0ZW1lbnRzKFxuICAgICAgICAgIHRoaXMuX3N5bWJvbFJlc29sdmVyLCBjb21wb25lbnRTdHlsZXMsIHRoaXMuX3N0eWxlQ29tcGlsZXIubmVlZHNTdHlsZVNoaW0oY29tcE1ldGEpLFxuICAgICAgICAgIGZpbGVTdWZmaXgpO1xuICAgIH1cbiAgICByZXR1cm4gdmlld1Jlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlVGVtcGxhdGUoXG4gICAgICBjb21wTWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBuZ01vZHVsZTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsXG4gICAgICBkaXJlY3RpdmVJZGVudGlmaWVyczogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdKTpcbiAgICAgIHt0ZW1wbGF0ZTogVGVtcGxhdGVBc3RbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdfSB7XG4gICAgaWYgKHRoaXMuX3RlbXBsYXRlQXN0Q2FjaGUuaGFzKGNvbXBNZXRhLnR5cGUucmVmZXJlbmNlKSkge1xuICAgICAgcmV0dXJuIHRoaXMuX3RlbXBsYXRlQXN0Q2FjaGUuZ2V0KGNvbXBNZXRhLnR5cGUucmVmZXJlbmNlKSAhO1xuICAgIH1cbiAgICBjb25zdCBwcmVzZXJ2ZVdoaXRlc3BhY2VzID0gY29tcE1ldGEgIS50ZW1wbGF0ZSAhLnByZXNlcnZlV2hpdGVzcGFjZXM7XG4gICAgY29uc3QgZGlyZWN0aXZlcyA9XG4gICAgICAgIGRpcmVjdGl2ZUlkZW50aWZpZXJzLm1hcChkaXIgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVTdW1tYXJ5KGRpci5yZWZlcmVuY2UpKTtcbiAgICBjb25zdCBwaXBlcyA9IG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUucGlwZXMubWFwKFxuICAgICAgICBwaXBlID0+IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0UGlwZVN1bW1hcnkocGlwZS5yZWZlcmVuY2UpKTtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLl90ZW1wbGF0ZVBhcnNlci5wYXJzZShcbiAgICAgICAgY29tcE1ldGEsIGNvbXBNZXRhLnRlbXBsYXRlICEuaHRtbEFzdCAhLCBkaXJlY3RpdmVzLCBwaXBlcywgbmdNb2R1bGUuc2NoZW1hcyxcbiAgICAgICAgdGVtcGxhdGVTb3VyY2VVcmwobmdNb2R1bGUudHlwZSwgY29tcE1ldGEsIGNvbXBNZXRhLnRlbXBsYXRlICEpLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzKTtcbiAgICB0aGlzLl90ZW1wbGF0ZUFzdENhY2hlLnNldChjb21wTWV0YS50eXBlLnJlZmVyZW5jZSwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlT3V0cHV0Q29udGV4dChnZW5GaWxlUGF0aDogc3RyaW5nKTogT3V0cHV0Q29udGV4dCB7XG4gICAgY29uc3QgaW1wb3J0RXhwciA9XG4gICAgICAgIChzeW1ib2w6IFN0YXRpY1N5bWJvbCwgdHlwZVBhcmFtczogby5UeXBlW10gfCBudWxsID0gbnVsbCxcbiAgICAgICAgIHVzZVN1bW1hcmllczogYm9vbGVhbiA9IHRydWUpID0+IHtcbiAgICAgICAgICBpZiAoIShzeW1ib2wgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIGVycm9yOiB1bmtub3duIGlkZW50aWZpZXIgJHtKU09OLnN0cmluZ2lmeShzeW1ib2wpfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBhcml0eSA9IHRoaXMuX3N5bWJvbFJlc29sdmVyLmdldFR5cGVBcml0eShzeW1ib2wpIHx8IDA7XG4gICAgICAgICAgY29uc3Qge2ZpbGVQYXRoLCBuYW1lLCBtZW1iZXJzfSA9XG4gICAgICAgICAgICAgIHRoaXMuX3N5bWJvbFJlc29sdmVyLmdldEltcG9ydEFzKHN5bWJvbCwgdXNlU3VtbWFyaWVzKSB8fCBzeW1ib2w7XG4gICAgICAgICAgY29uc3QgaW1wb3J0TW9kdWxlID0gdGhpcy5fZmlsZU5hbWVUb01vZHVsZU5hbWUoZmlsZVBhdGgsIGdlbkZpbGVQYXRoKTtcblxuICAgICAgICAgIC8vIEl0IHNob3VsZCBiZSBnb29kIGVub3VnaCB0byBjb21wYXJlIGZpbGVQYXRoIHRvIGdlbkZpbGVQYXRoIGFuZCBpZiB0aGV5IGFyZSBlcXVhbFxuICAgICAgICAgIC8vIHRoZXJlIGlzIGEgc2VsZiByZWZlcmVuY2UuIEhvd2V2ZXIsIG5nZmFjdG9yeSBmaWxlcyBnZW5lcmF0ZSB0byAudHMgYnV0IHRoZWlyXG4gICAgICAgICAgLy8gc3ltYm9scyBoYXZlIC5kLnRzIHNvIGEgc2ltcGxlIGNvbXBhcmUgaXMgaW5zdWZmaWNpZW50LiBUaGV5IHNob3VsZCBiZSBjYW5vbmljYWxcbiAgICAgICAgICAvLyBhbmQgaXMgdHJhY2tlZCBieSAjMTc3MDUuXG4gICAgICAgICAgY29uc3Qgc2VsZlJlZmVyZW5jZSA9IHRoaXMuX2ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGdlbkZpbGVQYXRoLCBnZW5GaWxlUGF0aCk7XG4gICAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IGltcG9ydE1vZHVsZSA9PT0gc2VsZlJlZmVyZW5jZSA/IG51bGwgOiBpbXBvcnRNb2R1bGU7XG5cbiAgICAgICAgICAvLyBJZiB3ZSBhcmUgaW4gYSB0eXBlIGV4cHJlc3Npb24gdGhhdCByZWZlcnMgdG8gYSBnZW5lcmljIHR5cGUgdGhlbiBzdXBwbHlcbiAgICAgICAgICAvLyB0aGUgcmVxdWlyZWQgdHlwZSBwYXJhbWV0ZXJzLiBJZiB0aGVyZSB3ZXJlIG5vdCBlbm91Z2ggdHlwZSBwYXJhbWV0ZXJzXG4gICAgICAgICAgLy8gc3VwcGxpZWQsIHN1cHBseSBhbnkgYXMgdGhlIHR5cGUuIE91dHNpZGUgYSB0eXBlIGV4cHJlc3Npb24gdGhlIHJlZmVyZW5jZVxuICAgICAgICAgIC8vIHNob3VsZCBub3Qgc3VwcGx5IHR5cGUgcGFyYW1ldGVycyBhbmQgYmUgdHJlYXRlZCBhcyBhIHNpbXBsZSB2YWx1ZSByZWZlcmVuY2VcbiAgICAgICAgICAvLyB0byB0aGUgY29uc3RydWN0b3IgZnVuY3Rpb24gaXRzZWxmLlxuICAgICAgICAgIGNvbnN0IHN1cHBsaWVkVHlwZVBhcmFtcyA9IHR5cGVQYXJhbXMgfHwgW107XG4gICAgICAgICAgY29uc3QgbWlzc2luZ1R5cGVQYXJhbXNDb3VudCA9IGFyaXR5IC0gc3VwcGxpZWRUeXBlUGFyYW1zLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCBhbGxUeXBlUGFyYW1zID1cbiAgICAgICAgICAgICAgc3VwcGxpZWRUeXBlUGFyYW1zLmNvbmNhdChuZXdBcnJheShtaXNzaW5nVHlwZVBhcmFtc0NvdW50LCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgICAgIHJldHVybiBtZW1iZXJzLnJlZHVjZShcbiAgICAgICAgICAgICAgKGV4cHIsIG1lbWJlck5hbWUpID0+IGV4cHIucHJvcChtZW1iZXJOYW1lKSxcbiAgICAgICAgICAgICAgPG8uRXhwcmVzc2lvbj5vLmltcG9ydEV4cHIoXG4gICAgICAgICAgICAgICAgICBuZXcgby5FeHRlcm5hbFJlZmVyZW5jZShtb2R1bGVOYW1lLCBuYW1lLCBudWxsKSwgYWxsVHlwZVBhcmFtcykpO1xuICAgICAgICB9O1xuXG4gICAgcmV0dXJuIHtzdGF0ZW1lbnRzOiBbXSwgZ2VuRmlsZVBhdGgsIGltcG9ydEV4cHIsIGNvbnN0YW50UG9vbDogbmV3IENvbnN0YW50UG9vbCgpfTtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9zdW1tYXJ5UmVzb2x2ZXIuZ2V0S25vd25Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgpIHx8XG4gICAgICAgIHRoaXMuX3N5bWJvbFJlc29sdmVyLmdldEtub3duTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoKSB8fFxuICAgICAgICB0aGlzLl9ob3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgsIGNvbnRhaW5pbmdGaWxlUGF0aCk7XG4gIH1cblxuICBwcml2YXRlIF9jb2RlZ2VuU3R5bGVzKFxuICAgICAgc3JjRmlsZVVybDogc3RyaW5nLCBjb21wTWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgc3R5bGVzaGVldE1ldGFkYXRhOiBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhLCBpc1NoaW1tZWQ6IGJvb2xlYW4sXG4gICAgICBmaWxlU3VmZml4OiBzdHJpbmcpOiBHZW5lcmF0ZWRGaWxlIHtcbiAgICBjb25zdCBvdXRwdXRDdHggPSB0aGlzLl9jcmVhdGVPdXRwdXRDb250ZXh0KFxuICAgICAgICBfc3R5bGVzTW9kdWxlVXJsKHN0eWxlc2hlZXRNZXRhZGF0YS5tb2R1bGVVcmwgISwgaXNTaGltbWVkLCBmaWxlU3VmZml4KSk7XG4gICAgY29uc3QgY29tcGlsZWRTdHlsZXNoZWV0ID1cbiAgICAgICAgdGhpcy5fc3R5bGVDb21waWxlci5jb21waWxlU3R5bGVzKG91dHB1dEN0eCwgY29tcE1ldGEsIHN0eWxlc2hlZXRNZXRhZGF0YSwgaXNTaGltbWVkKTtcbiAgICBfcmVzb2x2ZVN0eWxlU3RhdGVtZW50cyh0aGlzLl9zeW1ib2xSZXNvbHZlciwgY29tcGlsZWRTdHlsZXNoZWV0LCBpc1NoaW1tZWQsIGZpbGVTdWZmaXgpO1xuICAgIHJldHVybiB0aGlzLl9jb2RlZ2VuU291cmNlTW9kdWxlKHNyY0ZpbGVVcmwsIG91dHB1dEN0eCk7XG4gIH1cblxuICBwcml2YXRlIF9jb2RlZ2VuU291cmNlTW9kdWxlKHNyY0ZpbGVVcmw6IHN0cmluZywgY3R4OiBPdXRwdXRDb250ZXh0KTogR2VuZXJhdGVkRmlsZSB7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmF0ZWRGaWxlKHNyY0ZpbGVVcmwsIGN0eC5nZW5GaWxlUGF0aCwgY3R4LnN0YXRlbWVudHMpO1xuICB9XG5cbiAgbGlzdExhenlSb3V0ZXMoZW50cnlSb3V0ZT86IHN0cmluZywgYW5hbHl6ZWRNb2R1bGVzPzogTmdBbmFseXplZE1vZHVsZXMpOiBMYXp5Um91dGVbXSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGVudHJ5Um91dGUpIHtcbiAgICAgIGNvbnN0IHN5bWJvbCA9IHBhcnNlTGF6eVJvdXRlKGVudHJ5Um91dGUsIHRoaXMucmVmbGVjdG9yKS5yZWZlcmVuY2VkTW9kdWxlO1xuICAgICAgcmV0dXJuIHZpc2l0TGF6eVJvdXRlKHN5bWJvbCk7XG4gICAgfSBlbHNlIGlmIChhbmFseXplZE1vZHVsZXMpIHtcbiAgICAgIGNvbnN0IGFsbExhenlSb3V0ZXM6IExhenlSb3V0ZVtdID0gW107XG4gICAgICBmb3IgKGNvbnN0IG5nTW9kdWxlIG9mIGFuYWx5emVkTW9kdWxlcy5uZ01vZHVsZXMpIHtcbiAgICAgICAgY29uc3QgbGF6eVJvdXRlcyA9IGxpc3RMYXp5Um91dGVzKG5nTW9kdWxlLCB0aGlzLnJlZmxlY3Rvcik7XG4gICAgICAgIGZvciAoY29uc3QgbGF6eVJvdXRlIG9mIGxhenlSb3V0ZXMpIHtcbiAgICAgICAgICBhbGxMYXp5Um91dGVzLnB1c2gobGF6eVJvdXRlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExhenlSb3V0ZXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRWl0aGVyIHJvdXRlIG9yIGFuYWx5emVkTW9kdWxlcyBoYXMgdG8gYmUgc3BlY2lmaWVkIWApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZpc2l0TGF6eVJvdXRlKFxuICAgICAgICBzeW1ib2w6IFN0YXRpY1N5bWJvbCwgc2VlblJvdXRlcyA9IG5ldyBTZXQ8U3RhdGljU3ltYm9sPigpLFxuICAgICAgICBhbGxMYXp5Um91dGVzOiBMYXp5Um91dGVbXSA9IFtdKTogTGF6eVJvdXRlW10ge1xuICAgICAgLy8gU3VwcG9ydCBwb2ludGluZyB0byBkZWZhdWx0IGV4cG9ydHMsIGJ1dCBzdG9wIHJlY3Vyc2luZyB0aGVyZSxcbiAgICAgIC8vIGFzIHRoZSBTdGF0aWNSZWZsZWN0b3IgZG9lcyBub3QgeWV0IHN1cHBvcnQgZGVmYXVsdCBleHBvcnRzLlxuICAgICAgaWYgKHNlZW5Sb3V0ZXMuaGFzKHN5bWJvbCkgfHwgIXN5bWJvbC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBhbGxMYXp5Um91dGVzO1xuICAgICAgfVxuICAgICAgc2VlblJvdXRlcy5hZGQoc3ltYm9sKTtcbiAgICAgIGNvbnN0IGxhenlSb3V0ZXMgPSBsaXN0TGF6eVJvdXRlcyhcbiAgICAgICAgICBzZWxmLl9tZXRhZGF0YVJlc29sdmVyLmdldE5nTW9kdWxlTWV0YWRhdGEoc3ltYm9sLCB0cnVlKSAhLCBzZWxmLnJlZmxlY3Rvcik7XG4gICAgICBmb3IgKGNvbnN0IGxhenlSb3V0ZSBvZiBsYXp5Um91dGVzKSB7XG4gICAgICAgIGFsbExhenlSb3V0ZXMucHVzaChsYXp5Um91dGUpO1xuICAgICAgICB2aXNpdExhenlSb3V0ZShsYXp5Um91dGUucmVmZXJlbmNlZE1vZHVsZSwgc2VlblJvdXRlcywgYWxsTGF6eVJvdXRlcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWxsTGF6eVJvdXRlcztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUVtcHR5U3R1YihvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpIHtcbiAgLy8gTm90ZTogV2UgbmVlZCB0byBwcm9kdWNlIGF0IGxlYXN0IG9uZSBpbXBvcnQgc3RhdGVtZW50IHNvIHRoYXRcbiAgLy8gVHlwZVNjcmlwdCBrbm93cyB0aGF0IHRoZSBmaWxlIGlzIGFuIGVzNiBtb2R1bGUuIE90aGVyd2lzZSBvdXIgZ2VuZXJhdGVkXG4gIC8vIGV4cG9ydHMgLyBpbXBvcnRzIHdvbid0IGJlIGVtaXR0ZWQgcHJvcGVybHkgYnkgVHlwZVNjcmlwdC5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuQ29tcG9uZW50RmFjdG9yeSkudG9TdG10KCkpO1xufVxuXG5cbmZ1bmN0aW9uIF9yZXNvbHZlU3R5bGVTdGF0ZW1lbnRzKFxuICAgIHN5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlciwgY29tcGlsZVJlc3VsdDogQ29tcGlsZWRTdHlsZXNoZWV0LCBuZWVkc1NoaW06IGJvb2xlYW4sXG4gICAgZmlsZVN1ZmZpeDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbXBpbGVSZXN1bHQuZGVwZW5kZW5jaWVzLmZvckVhY2goKGRlcCkgPT4ge1xuICAgIGRlcC5zZXRWYWx1ZShzeW1ib2xSZXNvbHZlci5nZXRTdGF0aWNTeW1ib2woXG4gICAgICAgIF9zdHlsZXNNb2R1bGVVcmwoZGVwLm1vZHVsZVVybCwgbmVlZHNTaGltLCBmaWxlU3VmZml4KSwgZGVwLm5hbWUpKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIF9zdHlsZXNNb2R1bGVVcmwoc3R5bGVzaGVldFVybDogc3RyaW5nLCBzaGltOiBib29sZWFuLCBzdWZmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtzdHlsZXNoZWV0VXJsfSR7c2hpbSA/ICcuc2hpbScgOiAnJ30ubmdzdHlsZSR7c3VmZml4fWA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmdBbmFseXplZE1vZHVsZXMge1xuICBuZ01vZHVsZXM6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhW107XG4gIG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmU6IE1hcDxTdGF0aWNTeW1ib2wsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhPjtcbiAgZmlsZXM6IE5nQW5hbHl6ZWRGaWxlW107XG4gIHN5bWJvbHNNaXNzaW5nTW9kdWxlPzogU3RhdGljU3ltYm9sW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXMge1xuICBmaWxlTmFtZTogc3RyaW5nO1xuICBpbmplY3RhYmxlczogQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YVtdO1xuICBzaGFsbG93TW9kdWxlczogQ29tcGlsZVNoYWxsb3dNb2R1bGVNZXRhZGF0YVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5nQW5hbHl6ZWRGaWxlIHtcbiAgZmlsZU5hbWU6IHN0cmluZztcbiAgZGlyZWN0aXZlczogU3RhdGljU3ltYm9sW107XG4gIGFic3RyYWN0RGlyZWN0aXZlczogU3RhdGljU3ltYm9sW107XG4gIHBpcGVzOiBTdGF0aWNTeW1ib2xbXTtcbiAgbmdNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YVtdO1xuICBpbmplY3RhYmxlczogQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YVtdO1xuICBleHBvcnRzTm9uU291cmNlRmlsZXM6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmdBbmFseXplTW9kdWxlc0hvc3QgeyBpc1NvdXJjZUZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW47IH1cblxuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVOZ01vZHVsZXMoXG4gICAgZmlsZU5hbWVzOiBzdHJpbmdbXSwgaG9zdDogTmdBbmFseXplTW9kdWxlc0hvc3QsIHN0YXRpY1N5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlcixcbiAgICBtZXRhZGF0YVJlc29sdmVyOiBDb21waWxlTWV0YWRhdGFSZXNvbHZlcik6IE5nQW5hbHl6ZWRNb2R1bGVzIHtcbiAgY29uc3QgZmlsZXMgPSBfYW5hbHl6ZUZpbGVzSW5jbHVkaW5nTm9uUHJvZ3JhbUZpbGVzKFxuICAgICAgZmlsZU5hbWVzLCBob3N0LCBzdGF0aWNTeW1ib2xSZXNvbHZlciwgbWV0YWRhdGFSZXNvbHZlcik7XG4gIHJldHVybiBtZXJnZUFuYWx5emVkRmlsZXMoZmlsZXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZUFuZFZhbGlkYXRlTmdNb2R1bGVzKFxuICAgIGZpbGVOYW1lczogc3RyaW5nW10sIGhvc3Q6IE5nQW5hbHl6ZU1vZHVsZXNIb3N0LCBzdGF0aWNTeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXIsXG4gICAgbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIpOiBOZ0FuYWx5emVkTW9kdWxlcyB7XG4gIHJldHVybiB2YWxpZGF0ZUFuYWx5emVkTW9kdWxlcyhcbiAgICAgIGFuYWx5emVOZ01vZHVsZXMoZmlsZU5hbWVzLCBob3N0LCBzdGF0aWNTeW1ib2xSZXNvbHZlciwgbWV0YWRhdGFSZXNvbHZlcikpO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUFuYWx5emVkTW9kdWxlcyhhbmFseXplZE1vZHVsZXM6IE5nQW5hbHl6ZWRNb2R1bGVzKTogTmdBbmFseXplZE1vZHVsZXMge1xuICBpZiAoYW5hbHl6ZWRNb2R1bGVzLnN5bWJvbHNNaXNzaW5nTW9kdWxlICYmIGFuYWx5emVkTW9kdWxlcy5zeW1ib2xzTWlzc2luZ01vZHVsZS5sZW5ndGgpIHtcbiAgICBjb25zdCBtZXNzYWdlcyA9IGFuYWx5emVkTW9kdWxlcy5zeW1ib2xzTWlzc2luZ01vZHVsZS5tYXAoXG4gICAgICAgIHMgPT5cbiAgICAgICAgICAgIGBDYW5ub3QgZGV0ZXJtaW5lIHRoZSBtb2R1bGUgZm9yIGNsYXNzICR7cy5uYW1lfSBpbiAke3MuZmlsZVBhdGh9ISBBZGQgJHtzLm5hbWV9IHRvIHRoZSBOZ01vZHVsZSB0byBmaXggaXQuYCk7XG4gICAgdGhyb3cgc3ludGF4RXJyb3IobWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG4gIHJldHVybiBhbmFseXplZE1vZHVsZXM7XG59XG5cbi8vIEFuYWx5emVzIGFsbCBvZiB0aGUgcHJvZ3JhbSBmaWxlcyxcbi8vIGluY2x1ZGluZyBmaWxlcyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGUgcHJvZ3JhbVxuLy8gYnV0IGFyZSByZWZlcmVuY2VkIGJ5IGFuIE5nTW9kdWxlLlxuZnVuY3Rpb24gX2FuYWx5emVGaWxlc0luY2x1ZGluZ05vblByb2dyYW1GaWxlcyhcbiAgICBmaWxlTmFtZXM6IHN0cmluZ1tdLCBob3N0OiBOZ0FuYWx5emVNb2R1bGVzSG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgIG1ldGFkYXRhUmVzb2x2ZXI6IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyKTogTmdBbmFseXplZEZpbGVbXSB7XG4gIGNvbnN0IHNlZW5GaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmaWxlczogTmdBbmFseXplZEZpbGVbXSA9IFtdO1xuXG4gIGNvbnN0IHZpc2l0RmlsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKHNlZW5GaWxlcy5oYXMoZmlsZU5hbWUpIHx8ICFob3N0LmlzU291cmNlRmlsZShmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgc2VlbkZpbGVzLmFkZChmaWxlTmFtZSk7XG4gICAgY29uc3QgYW5hbHl6ZWRGaWxlID0gYW5hbHl6ZUZpbGUoaG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXIsIG1ldGFkYXRhUmVzb2x2ZXIsIGZpbGVOYW1lKTtcbiAgICBmaWxlcy5wdXNoKGFuYWx5emVkRmlsZSk7XG4gICAgYW5hbHl6ZWRGaWxlLm5nTW9kdWxlcy5mb3JFYWNoKG5nTW9kdWxlID0+IHtcbiAgICAgIG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUubW9kdWxlcy5mb3JFYWNoKG1vZE1ldGEgPT4gdmlzaXRGaWxlKG1vZE1ldGEucmVmZXJlbmNlLmZpbGVQYXRoKSk7XG4gICAgfSk7XG4gIH07XG4gIGZpbGVOYW1lcy5mb3JFYWNoKChmaWxlTmFtZSkgPT4gdmlzaXRGaWxlKGZpbGVOYW1lKSk7XG4gIHJldHVybiBmaWxlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVGaWxlKFxuICAgIGhvc3Q6IE5nQW5hbHl6ZU1vZHVsZXNIb3N0LCBzdGF0aWNTeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXIsXG4gICAgbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIsIGZpbGVOYW1lOiBzdHJpbmcpOiBOZ0FuYWx5emVkRmlsZSB7XG4gIGNvbnN0IGFic3RyYWN0RGlyZWN0aXZlczogU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgY29uc3QgZGlyZWN0aXZlczogU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgY29uc3QgcGlwZXM6IFN0YXRpY1N5bWJvbFtdID0gW107XG4gIGNvbnN0IGluamVjdGFibGVzOiBDb21waWxlSW5qZWN0YWJsZU1ldGFkYXRhW10gPSBbXTtcbiAgY29uc3QgbmdNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YVtdID0gW107XG4gIGNvbnN0IGhhc0RlY29yYXRvcnMgPSBzdGF0aWNTeW1ib2xSZXNvbHZlci5oYXNEZWNvcmF0b3JzKGZpbGVOYW1lKTtcbiAgbGV0IGV4cG9ydHNOb25Tb3VyY2VGaWxlcyA9IGZhbHNlO1xuICBjb25zdCBpc0RlY2xhcmF0aW9uRmlsZSA9IGZpbGVOYW1lLmVuZHNXaXRoKCcuZC50cycpO1xuICAvLyBEb24ndCBhbmFseXplIC5kLnRzIGZpbGVzIHRoYXQgaGF2ZSBubyBkZWNvcmF0b3JzIGFzIGEgc2hvcnRjdXRcbiAgLy8gdG8gc3BlZWQgdXAgdGhlIGFuYWx5c2lzLiBUaGlzIHByZXZlbnRzIHVzIGZyb21cbiAgLy8gcmVzb2x2aW5nIHRoZSByZWZlcmVuY2VzIGluIHRoZXNlIGZpbGVzLlxuICAvLyBOb3RlOiBleHBvcnRzTm9uU291cmNlRmlsZXMgaXMgb25seSBuZWVkZWQgd2hlbiBjb21waWxpbmcgd2l0aCBzdW1tYXJpZXMsXG4gIC8vIHdoaWNoIGlzIG5vdCB0aGUgY2FzZSB3aGVuIC5kLnRzIGZpbGVzIGFyZSB0cmVhdGVkIGFzIGlucHV0IGZpbGVzLlxuICBpZiAoIWlzRGVjbGFyYXRpb25GaWxlIHx8IGhhc0RlY29yYXRvcnMpIHtcbiAgICBzdGF0aWNTeW1ib2xSZXNvbHZlci5nZXRTeW1ib2xzT2YoZmlsZU5hbWUpLmZvckVhY2goKHN5bWJvbCkgPT4ge1xuICAgICAgY29uc3QgcmVzb2x2ZWRTeW1ib2wgPSBzdGF0aWNTeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHN5bWJvbCk7XG4gICAgICBjb25zdCBzeW1ib2xNZXRhID0gcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGE7XG4gICAgICBpZiAoIXN5bWJvbE1ldGEgfHwgc3ltYm9sTWV0YS5fX3N5bWJvbGljID09PSAnZXJyb3InKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGxldCBpc05nU3ltYm9sID0gZmFsc2U7XG4gICAgICBpZiAoc3ltYm9sTWV0YS5fX3N5bWJvbGljID09PSAnY2xhc3MnKSB7XG4gICAgICAgIGlmIChtZXRhZGF0YVJlc29sdmVyLmlzRGlyZWN0aXZlKHN5bWJvbCkpIHtcbiAgICAgICAgICBpc05nU3ltYm9sID0gdHJ1ZTtcbiAgICAgICAgICBpZiAoIWlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgICAgICAvLyBUaGlzIGRpcmVjdGl2ZSBlaXRoZXIgaGFzIGEgc2VsZWN0b3Igb3IgZG9lc24ndC4gU2VsZWN0b3ItbGVzcyBkaXJlY3RpdmVzIGdldCB0cmFja2VkXG4gICAgICAgICAgICAvLyBpbiBhYnN0cmFjdERpcmVjdGl2ZXMsIG5vdCBkaXJlY3RpdmVzLiBUaGUgY29tcGlsZXIgZG9lc24ndCBkZWFsIHdpdGggc2VsZWN0b3ItbGVzc1xuICAgICAgICAgICAgLy8gZGlyZWN0aXZlcyBhdCBhbGwsIHJlYWxseSwgb3RoZXIgdGhhbiB0byBwZXJzaXN0IHRoZWlyIG1ldGFkYXRhLiBUaGlzIGlzIGRvbmUgc28gdGhhdFxuICAgICAgICAgICAgLy8gYXBwcyB3aWxsIGhhdmUgYW4gZWFzaWVyIHRpbWUgbWlncmF0aW5nIHRvIEl2eSwgd2hpY2ggcmVxdWlyZXMgdGhlIHNlbGVjdG9yLWxlc3NcbiAgICAgICAgICAgIC8vIGFubm90YXRpb25zIHRvIGJlIGFwcGxpZWQuXG4gICAgICAgICAgICBpZiAoIW1ldGFkYXRhUmVzb2x2ZXIuaXNBYnN0cmFjdERpcmVjdGl2ZShzeW1ib2wpKSB7XG4gICAgICAgICAgICAgIC8vIFRoZSBkaXJlY3RpdmUgaXMgYW4gb3JkaW5hcnkgZGlyZWN0aXZlLlxuICAgICAgICAgICAgICBkaXJlY3RpdmVzLnB1c2goc3ltYm9sKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFRoZSBkaXJlY3RpdmUgaGFzIG5vIHNlbGVjdG9yIGFuZCBpcyBhbiBcImFic3RyYWN0XCIgZGlyZWN0aXZlLCBzbyB0cmFjayBpdFxuICAgICAgICAgICAgICAvLyBhY2NvcmRpbmdseS5cbiAgICAgICAgICAgICAgYWJzdHJhY3REaXJlY3RpdmVzLnB1c2goc3ltYm9sKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGlyZWN0aXZlcy5wdXNoKHN5bWJvbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG1ldGFkYXRhUmVzb2x2ZXIuaXNQaXBlKHN5bWJvbCkpIHtcbiAgICAgICAgICBpc05nU3ltYm9sID0gdHJ1ZTtcbiAgICAgICAgICBwaXBlcy5wdXNoKHN5bWJvbCk7XG4gICAgICAgIH0gZWxzZSBpZiAobWV0YWRhdGFSZXNvbHZlci5pc05nTW9kdWxlKHN5bWJvbCkpIHtcbiAgICAgICAgICBjb25zdCBuZ01vZHVsZSA9IG1ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShzeW1ib2wsIGZhbHNlKTtcbiAgICAgICAgICBpZiAobmdNb2R1bGUpIHtcbiAgICAgICAgICAgIGlzTmdTeW1ib2wgPSB0cnVlO1xuICAgICAgICAgICAgbmdNb2R1bGVzLnB1c2gobmdNb2R1bGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChtZXRhZGF0YVJlc29sdmVyLmlzSW5qZWN0YWJsZShzeW1ib2wpKSB7XG4gICAgICAgICAgaXNOZ1N5bWJvbCA9IHRydWU7XG4gICAgICAgICAgY29uc3QgaW5qZWN0YWJsZSA9IG1ldGFkYXRhUmVzb2x2ZXIuZ2V0SW5qZWN0YWJsZU1ldGFkYXRhKHN5bWJvbCwgbnVsbCwgZmFsc2UpO1xuICAgICAgICAgIGlmIChpbmplY3RhYmxlKSB7XG4gICAgICAgICAgICBpbmplY3RhYmxlcy5wdXNoKGluamVjdGFibGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFpc05nU3ltYm9sKSB7XG4gICAgICAgIGV4cG9ydHNOb25Tb3VyY2VGaWxlcyA9XG4gICAgICAgICAgICBleHBvcnRzTm9uU291cmNlRmlsZXMgfHwgaXNWYWx1ZUV4cG9ydGluZ05vblNvdXJjZUZpbGUoaG9zdCwgc3ltYm9sTWV0YSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICAgIGZpbGVOYW1lLCAgZGlyZWN0aXZlcywgIGFic3RyYWN0RGlyZWN0aXZlcywgICAgcGlwZXMsXG4gICAgICBuZ01vZHVsZXMsIGluamVjdGFibGVzLCBleHBvcnRzTm9uU291cmNlRmlsZXMsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhbmFseXplRmlsZUZvckluamVjdGFibGVzKFxuICAgIGhvc3Q6IE5nQW5hbHl6ZU1vZHVsZXNIb3N0LCBzdGF0aWNTeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXIsXG4gICAgbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIsIGZpbGVOYW1lOiBzdHJpbmcpOiBOZ0FuYWx5emVkRmlsZVdpdGhJbmplY3RhYmxlcyB7XG4gIGNvbnN0IGluamVjdGFibGVzOiBDb21waWxlSW5qZWN0YWJsZU1ldGFkYXRhW10gPSBbXTtcbiAgY29uc3Qgc2hhbGxvd01vZHVsZXM6IENvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGFbXSA9IFtdO1xuICBpZiAoc3RhdGljU3ltYm9sUmVzb2x2ZXIuaGFzRGVjb3JhdG9ycyhmaWxlTmFtZSkpIHtcbiAgICBzdGF0aWNTeW1ib2xSZXNvbHZlci5nZXRTeW1ib2xzT2YoZmlsZU5hbWUpLmZvckVhY2goKHN5bWJvbCkgPT4ge1xuICAgICAgY29uc3QgcmVzb2x2ZWRTeW1ib2wgPSBzdGF0aWNTeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHN5bWJvbCk7XG4gICAgICBjb25zdCBzeW1ib2xNZXRhID0gcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGE7XG4gICAgICBpZiAoIXN5bWJvbE1ldGEgfHwgc3ltYm9sTWV0YS5fX3N5bWJvbGljID09PSAnZXJyb3InKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChzeW1ib2xNZXRhLl9fc3ltYm9saWMgPT09ICdjbGFzcycpIHtcbiAgICAgICAgaWYgKG1ldGFkYXRhUmVzb2x2ZXIuaXNJbmplY3RhYmxlKHN5bWJvbCkpIHtcbiAgICAgICAgICBjb25zdCBpbmplY3RhYmxlID0gbWV0YWRhdGFSZXNvbHZlci5nZXRJbmplY3RhYmxlTWV0YWRhdGEoc3ltYm9sLCBudWxsLCBmYWxzZSk7XG4gICAgICAgICAgaWYgKGluamVjdGFibGUpIHtcbiAgICAgICAgICAgIGluamVjdGFibGVzLnB1c2goaW5qZWN0YWJsZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG1ldGFkYXRhUmVzb2x2ZXIuaXNOZ01vZHVsZShzeW1ib2wpKSB7XG4gICAgICAgICAgY29uc3QgbW9kdWxlID0gbWV0YWRhdGFSZXNvbHZlci5nZXRTaGFsbG93TW9kdWxlTWV0YWRhdGEoc3ltYm9sKTtcbiAgICAgICAgICBpZiAobW9kdWxlKSB7XG4gICAgICAgICAgICBzaGFsbG93TW9kdWxlcy5wdXNoKG1vZHVsZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHtmaWxlTmFtZSwgaW5qZWN0YWJsZXMsIHNoYWxsb3dNb2R1bGVzfTtcbn1cblxuZnVuY3Rpb24gaXNWYWx1ZUV4cG9ydGluZ05vblNvdXJjZUZpbGUoaG9zdDogTmdBbmFseXplTW9kdWxlc0hvc3QsIG1ldGFkYXRhOiBhbnkpOiBib29sZWFuIHtcbiAgbGV0IGV4cG9ydHNOb25Tb3VyY2VGaWxlcyA9IGZhbHNlO1xuXG4gIGNsYXNzIFZpc2l0b3IgaW1wbGVtZW50cyBWYWx1ZVZpc2l0b3Ige1xuICAgIHZpc2l0QXJyYXkoYXJyOiBhbnlbXSwgY29udGV4dDogYW55KTogYW55IHsgYXJyLmZvckVhY2godiA9PiB2aXNpdFZhbHVlKHYsIHRoaXMsIGNvbnRleHQpKTsgfVxuICAgIHZpc2l0U3RyaW5nTWFwKG1hcDoge1trZXk6IHN0cmluZ106IGFueX0sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgICBPYmplY3Qua2V5cyhtYXApLmZvckVhY2goKGtleSkgPT4gdmlzaXRWYWx1ZShtYXBba2V5XSwgdGhpcywgY29udGV4dCkpO1xuICAgIH1cbiAgICB2aXNpdFByaW1pdGl2ZSh2YWx1ZTogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgICB2aXNpdE90aGVyKHZhbHVlOiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wgJiYgIWhvc3QuaXNTb3VyY2VGaWxlKHZhbHVlLmZpbGVQYXRoKSkge1xuICAgICAgICBleHBvcnRzTm9uU291cmNlRmlsZXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHZpc2l0VmFsdWUobWV0YWRhdGEsIG5ldyBWaXNpdG9yKCksIG51bGwpO1xuICByZXR1cm4gZXhwb3J0c05vblNvdXJjZUZpbGVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VBbmFseXplZEZpbGVzKGFuYWx5emVkRmlsZXM6IE5nQW5hbHl6ZWRGaWxlW10pOiBOZ0FuYWx5emVkTW9kdWxlcyB7XG4gIGNvbnN0IGFsbE5nTW9kdWxlczogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGFbXSA9IFtdO1xuICBjb25zdCBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhPigpO1xuICBjb25zdCBhbGxQaXBlc0FuZERpcmVjdGl2ZXMgPSBuZXcgU2V0PFN0YXRpY1N5bWJvbD4oKTtcblxuICBhbmFseXplZEZpbGVzLmZvckVhY2goYWYgPT4ge1xuICAgIGFmLm5nTW9kdWxlcy5mb3JFYWNoKG5nTW9kdWxlID0+IHtcbiAgICAgIGFsbE5nTW9kdWxlcy5wdXNoKG5nTW9kdWxlKTtcbiAgICAgIG5nTW9kdWxlLmRlY2xhcmVkRGlyZWN0aXZlcy5mb3JFYWNoKFxuICAgICAgICAgIGQgPT4gbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZS5zZXQoZC5yZWZlcmVuY2UsIG5nTW9kdWxlKSk7XG4gICAgICBuZ01vZHVsZS5kZWNsYXJlZFBpcGVzLmZvckVhY2gocCA9PiBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlLnNldChwLnJlZmVyZW5jZSwgbmdNb2R1bGUpKTtcbiAgICB9KTtcbiAgICBhZi5kaXJlY3RpdmVzLmZvckVhY2goZCA9PiBhbGxQaXBlc0FuZERpcmVjdGl2ZXMuYWRkKGQpKTtcbiAgICBhZi5waXBlcy5mb3JFYWNoKHAgPT4gYWxsUGlwZXNBbmREaXJlY3RpdmVzLmFkZChwKSk7XG4gIH0pO1xuXG4gIGNvbnN0IHN5bWJvbHNNaXNzaW5nTW9kdWxlOiBTdGF0aWNTeW1ib2xbXSA9IFtdO1xuICBhbGxQaXBlc0FuZERpcmVjdGl2ZXMuZm9yRWFjaChyZWYgPT4ge1xuICAgIGlmICghbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZS5oYXMocmVmKSkge1xuICAgICAgc3ltYm9sc01pc3NpbmdNb2R1bGUucHVzaChyZWYpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiB7XG4gICAgbmdNb2R1bGVzOiBhbGxOZ01vZHVsZXMsXG4gICAgbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZSxcbiAgICBzeW1ib2xzTWlzc2luZ01vZHVsZSxcbiAgICBmaWxlczogYW5hbHl6ZWRGaWxlc1xuICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZUFuZFZhbGlkYXRlTmdGaWxlcyhmaWxlczogTmdBbmFseXplZEZpbGVbXSk6IE5nQW5hbHl6ZWRNb2R1bGVzIHtcbiAgcmV0dXJuIHZhbGlkYXRlQW5hbHl6ZWRNb2R1bGVzKG1lcmdlQW5hbHl6ZWRGaWxlcyhmaWxlcykpO1xufVxuIl19