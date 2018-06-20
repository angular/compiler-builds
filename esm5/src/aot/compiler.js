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
import { compilePipe as compileR3Pipe } from '../render3/r3_pipe_compiler';
import { htmlAstToRender3Ast } from '../render3/r3_template_transform';
import { compileComponentFromRender2 as compileR3Component, compileDirectiveFromRender2 as compileR3Directive } from '../render3/view/compiler';
import { DomElementSchemaRegistry } from '../schema/dom_element_schema_registry';
import { BindingParser } from '../template_parser/binding_parser';
import { error, syntaxError, visitValue } from '../util';
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
        var e_1, _a;
    };
    AotCompiler.prototype._createTypeCheckBlock = function (ctx, componentId, moduleMeta, compMeta, directives, externalReferenceVars) {
        var _a = this._parseTemplate(compMeta, moduleMeta, directives), parsedTemplate = _a.template, usedPipes = _a.pipes;
        (_b = ctx.statements).push.apply(_b, tslib_1.__spread(this._typeCheckCompiler.compileComponent(componentId, compMeta, parsedTemplate, usedPipes, externalReferenceVars, ctx)));
        var _b;
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
                var interpolationConfig = InterpolationConfig.fromArray(compMeta.template.interpolation);
                errors.push.apply(errors, tslib_1.__spread(messageBundle.updateFromTemplate(html, file.fileName, interpolationConfig)));
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
        var _a = serializeSummaries(srcFileName, forJitOutputCtx, this._summaryResolver, this._symbolResolver, symbolSummaries, typeData), json = _a.json, exportAs = _a.exportAs;
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
            var allTypeParams = suppliedTypeParams.concat(new Array(missingTypeParamsCount).fill(o.DYNAMIC_TYPE));
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
        var self = this;
        if (entryRoute) {
            var symbol = parseLazyRoute(entryRoute, this.reflector).referencedModule;
            return visitLazyRoute(symbol);
        }
        else if (analyzedModules) {
            var allLazyRoutes = [];
            try {
                for (var _a = tslib_1.__values(analyzedModules.ngModules), _b = _a.next(); !_b.done; _b = _a.next()) {
                    var ngModule = _b.value;
                    var lazyRoutes = listLazyRoutes(ngModule, this.reflector);
                    try {
                        for (var lazyRoutes_1 = tslib_1.__values(lazyRoutes), lazyRoutes_1_1 = lazyRoutes_1.next(); !lazyRoutes_1_1.done; lazyRoutes_1_1 = lazyRoutes_1.next()) {
                            var lazyRoute = lazyRoutes_1_1.value;
                            allLazyRoutes.push(lazyRoute);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (lazyRoutes_1_1 && !lazyRoutes_1_1.done && (_c = lazyRoutes_1.return)) _c.call(lazyRoutes_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return allLazyRoutes;
        }
        else {
            throw new Error("Either route or analyzedModules has to be specified!");
        }
        function visitLazyRoute(symbol, seenRoutes, allLazyRoutes) {
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
            var e_4, _a;
        }
        var e_3, _d, e_2, _c;
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
    var directives = [];
    var pipes = [];
    var injectables = [];
    var ngModules = [];
    var hasDecorators = staticSymbolResolver.hasDecorators(fileName);
    var exportsNonSourceFiles = false;
    // Don't analyze .d.ts files that have no decorators as a shortcut
    // to speed up the analysis. This prevents us from
    // resolving the references in these files.
    // Note: exportsNonSourceFiles is only needed when compiling with summaries,
    // which is not the case when .d.ts files are treated as input files.
    if (!fileName.endsWith('.d.ts') || hasDecorators) {
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
                    directives.push(symbol);
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
        fileName: fileName, directives: directives, pipes: pipes, ngModules: ngModules, injectables: injectables, exportsNonSourceFiles: exportsNonSourceFiles,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvYW90L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQThRLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUVsWCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDOUMsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBQzFDLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNyRCxPQUFPLEVBQUMsV0FBVyxFQUFFLCtCQUErQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFJNUUsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLG1DQUFtQyxDQUFDO0FBR3BHLE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFMUMsT0FBTyxFQUFDLDBCQUEwQixJQUFJLGVBQWUsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzVGLE9BQU8sRUFBQyxXQUFXLElBQUksYUFBYSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDekUsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDckUsT0FBTyxFQUFDLDJCQUEyQixJQUFJLGtCQUFrQixFQUFFLDJCQUEyQixJQUFJLGtCQUFrQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDOUksT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sdUNBQXVDLENBQUM7QUFHL0Us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QixDQUFDO0FBQ0osQ0FBQztBQUVELGlDQUFpQyxLQUF1QjtJQUN0RCxPQUFPLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDNUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEsIENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGEsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBDb21waWxlUGlwZU1ldGFkYXRhLCBDb21waWxlUGlwZVN1bW1hcnksIENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBDb21waWxlU2hhbGxvd01vZHVsZU1ldGFkYXRhLCBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhLCBDb21waWxlVHlwZU1ldGFkYXRhLCBDb21waWxlVHlwZVN1bW1hcnksIGNvbXBvbmVudEZhY3RvcnlOYW1lLCBmbGF0dGVuLCBpZGVudGlmaWVyTmFtZSwgdGVtcGxhdGVTb3VyY2VVcmx9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtNZXNzYWdlQnVuZGxlfSBmcm9tICcuLi9pMThuL21lc3NhZ2VfYnVuZGxlJztcbmltcG9ydCB7SWRlbnRpZmllcnMsIGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2V9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCB7SW5qZWN0YWJsZUNvbXBpbGVyfSBmcm9tICcuLi9pbmplY3RhYmxlX2NvbXBpbGVyJztcbmltcG9ydCB7Q29tcGlsZU1ldGFkYXRhUmVzb2x2ZXJ9IGZyb20gJy4uL21ldGFkYXRhX3Jlc29sdmVyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge3JlbW92ZVdoaXRlc3BhY2VzfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge05nTW9kdWxlQ29tcGlsZXJ9IGZyb20gJy4uL25nX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge091dHB1dEVtaXR0ZXJ9IGZyb20gJy4uL291dHB1dC9hYnN0cmFjdF9lbWl0dGVyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Y29tcGlsZU5nTW9kdWxlRnJvbVJlbmRlcjIgYXMgY29tcGlsZVIzTW9kdWxlfSBmcm9tICcuLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlIGFzIGNvbXBpbGVSM1BpcGV9IGZyb20gJy4uL3JlbmRlcjMvcjNfcGlwZV9jb21waWxlcic7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7Y29tcGlsZUNvbXBvbmVudEZyb21SZW5kZXIyIGFzIGNvbXBpbGVSM0NvbXBvbmVudCwgY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyIGFzIGNvbXBpbGVSM0RpcmVjdGl2ZX0gZnJvbSAnLi4vcmVuZGVyMy92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q29tcGlsZWRTdHlsZXNoZWV0LCBTdHlsZUNvbXBpbGVyfSBmcm9tICcuLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge1N1bW1hcnlSZXNvbHZlcn0gZnJvbSAnLi4vc3VtbWFyeV9yZXNvbHZlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge1RlbXBsYXRlQXN0fSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfYXN0JztcbmltcG9ydCB7VGVtcGxhdGVQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBWYWx1ZVZpc2l0b3IsIGVycm9yLCBzeW50YXhFcnJvciwgdmlzaXRWYWx1ZX0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge1R5cGVDaGVja0NvbXBpbGVyfSBmcm9tICcuLi92aWV3X2NvbXBpbGVyL3R5cGVfY2hlY2tfY29tcGlsZXInO1xuaW1wb3J0IHtWaWV3Q29tcGlsZVJlc3VsdCwgVmlld0NvbXBpbGVyfSBmcm9tICcuLi92aWV3X2NvbXBpbGVyL3ZpZXdfY29tcGlsZXInO1xuXG5pbXBvcnQge0FvdENvbXBpbGVySG9zdH0gZnJvbSAnLi9jb21waWxlcl9ob3N0JztcbmltcG9ydCB7QW90Q29tcGlsZXJPcHRpb25zfSBmcm9tICcuL2NvbXBpbGVyX29wdGlvbnMnO1xuaW1wb3J0IHtHZW5lcmF0ZWRGaWxlfSBmcm9tICcuL2dlbmVyYXRlZF9maWxlJztcbmltcG9ydCB7TGF6eVJvdXRlLCBsaXN0TGF6eVJvdXRlcywgcGFyc2VMYXp5Um91dGV9IGZyb20gJy4vbGF6eV9yb3V0ZXMnO1xuaW1wb3J0IHtQYXJ0aWFsTW9kdWxlfSBmcm9tICcuL3BhcnRpYWxfbW9kdWxlJztcbmltcG9ydCB7U3RhdGljUmVmbGVjdG9yfSBmcm9tICcuL3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4vc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge1N0YXRpY1N5bWJvbFJlc29sdmVyfSBmcm9tICcuL3N0YXRpY19zeW1ib2xfcmVzb2x2ZXInO1xuaW1wb3J0IHtjcmVhdGVGb3JKaXRTdHViLCBzZXJpYWxpemVTdW1tYXJpZXN9IGZyb20gJy4vc3VtbWFyeV9zZXJpYWxpemVyJztcbmltcG9ydCB7bmdmYWN0b3J5RmlsZVBhdGgsIG5vcm1hbGl6ZUdlbkZpbGVTdWZmaXgsIHNwbGl0VHlwZXNjcmlwdFN1ZmZpeCwgc3VtbWFyeUZpbGVOYW1lLCBzdW1tYXJ5Rm9ySml0RmlsZU5hbWV9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IGVudW0gU3R1YkVtaXRGbGFncyB7IEJhc2ljID0gMSA8PCAwLCBUeXBlQ2hlY2sgPSAxIDw8IDEsIEFsbCA9IFR5cGVDaGVjayB8IEJhc2ljIH1cblxuZXhwb3J0IGNsYXNzIEFvdENvbXBpbGVyIHtcbiAgcHJpdmF0ZSBfdGVtcGxhdGVBc3RDYWNoZSA9XG4gICAgICBuZXcgTWFwPFN0YXRpY1N5bWJvbCwge3RlbXBsYXRlOiBUZW1wbGF0ZUFzdFtdLCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W119PigpO1xuICBwcml2YXRlIF9hbmFseXplZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE5nQW5hbHl6ZWRGaWxlPigpO1xuICBwcml2YXRlIF9hbmFseXplZEZpbGVzRm9ySW5qZWN0YWJsZXMgPSBuZXcgTWFwPHN0cmluZywgTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXM+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9jb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9vcHRpb25zOiBBb3RDb21waWxlck9wdGlvbnMsXG4gICAgICBwcml2YXRlIF9ob3N0OiBBb3RDb21waWxlckhvc3QsIHJlYWRvbmx5IHJlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yLFxuICAgICAgcHJpdmF0ZSBfbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIsIHByaXZhdGUgX3RlbXBsYXRlUGFyc2VyOiBUZW1wbGF0ZVBhcnNlcixcbiAgICAgIHByaXZhdGUgX3N0eWxlQ29tcGlsZXI6IFN0eWxlQ29tcGlsZXIsIHByaXZhdGUgX3ZpZXdDb21waWxlcjogVmlld0NvbXBpbGVyLFxuICAgICAgcHJpdmF0ZSBfdHlwZUNoZWNrQ29tcGlsZXI6IFR5cGVDaGVja0NvbXBpbGVyLCBwcml2YXRlIF9uZ01vZHVsZUNvbXBpbGVyOiBOZ01vZHVsZUNvbXBpbGVyLFxuICAgICAgcHJpdmF0ZSBfaW5qZWN0YWJsZUNvbXBpbGVyOiBJbmplY3RhYmxlQ29tcGlsZXIsIHByaXZhdGUgX291dHB1dEVtaXR0ZXI6IE91dHB1dEVtaXR0ZXIsXG4gICAgICBwcml2YXRlIF9zdW1tYXJ5UmVzb2x2ZXI6IFN1bW1hcnlSZXNvbHZlcjxTdGF0aWNTeW1ib2w+LFxuICAgICAgcHJpdmF0ZSBfc3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyKSB7fVxuXG4gIGNsZWFyQ2FjaGUoKSB7IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuY2xlYXJDYWNoZSgpOyB9XG5cbiAgYW5hbHl6ZU1vZHVsZXNTeW5jKHJvb3RGaWxlczogc3RyaW5nW10pOiBOZ0FuYWx5emVkTW9kdWxlcyB7XG4gICAgY29uc3QgYW5hbHl6ZVJlc3VsdCA9IGFuYWx5emVBbmRWYWxpZGF0ZU5nTW9kdWxlcyhcbiAgICAgICAgcm9vdEZpbGVzLCB0aGlzLl9ob3N0LCB0aGlzLl9zeW1ib2xSZXNvbHZlciwgdGhpcy5fbWV0YWRhdGFSZXNvbHZlcik7XG4gICAgYW5hbHl6ZVJlc3VsdC5uZ01vZHVsZXMuZm9yRWFjaChcbiAgICAgICAgbmdNb2R1bGUgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5sb2FkTmdNb2R1bGVEaXJlY3RpdmVBbmRQaXBlTWV0YWRhdGEoXG4gICAgICAgICAgICBuZ01vZHVsZS50eXBlLnJlZmVyZW5jZSwgdHJ1ZSkpO1xuICAgIHJldHVybiBhbmFseXplUmVzdWx0O1xuICB9XG5cbiAgYW5hbHl6ZU1vZHVsZXNBc3luYyhyb290RmlsZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxOZ0FuYWx5emVkTW9kdWxlcz4ge1xuICAgIGNvbnN0IGFuYWx5emVSZXN1bHQgPSBhbmFseXplQW5kVmFsaWRhdGVOZ01vZHVsZXMoXG4gICAgICAgIHJvb3RGaWxlcywgdGhpcy5faG9zdCwgdGhpcy5fc3ltYm9sUmVzb2x2ZXIsIHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIpO1xuICAgIHJldHVybiBQcm9taXNlXG4gICAgICAgIC5hbGwoYW5hbHl6ZVJlc3VsdC5uZ01vZHVsZXMubWFwKFxuICAgICAgICAgICAgbmdNb2R1bGUgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5sb2FkTmdNb2R1bGVEaXJlY3RpdmVBbmRQaXBlTWV0YWRhdGEoXG4gICAgICAgICAgICAgICAgbmdNb2R1bGUudHlwZS5yZWZlcmVuY2UsIGZhbHNlKSkpXG4gICAgICAgIC50aGVuKCgpID0+IGFuYWx5emVSZXN1bHQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYW5hbHl6ZUZpbGUoZmlsZU5hbWU6IHN0cmluZyk6IE5nQW5hbHl6ZWRGaWxlIHtcbiAgICBsZXQgYW5hbHl6ZWRGaWxlID0gdGhpcy5fYW5hbHl6ZWRGaWxlcy5nZXQoZmlsZU5hbWUpO1xuICAgIGlmICghYW5hbHl6ZWRGaWxlKSB7XG4gICAgICBhbmFseXplZEZpbGUgPVxuICAgICAgICAgIGFuYWx5emVGaWxlKHRoaXMuX2hvc3QsIHRoaXMuX3N5bWJvbFJlc29sdmVyLCB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLCBmaWxlTmFtZSk7XG4gICAgICB0aGlzLl9hbmFseXplZEZpbGVzLnNldChmaWxlTmFtZSwgYW5hbHl6ZWRGaWxlKTtcbiAgICB9XG4gICAgcmV0dXJuIGFuYWx5emVkRmlsZTtcbiAgfVxuXG4gIHByaXZhdGUgX2FuYWx5emVGaWxlRm9ySW5qZWN0YWJsZXMoZmlsZU5hbWU6IHN0cmluZyk6IE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzIHtcbiAgICBsZXQgYW5hbHl6ZWRGaWxlID0gdGhpcy5fYW5hbHl6ZWRGaWxlc0ZvckluamVjdGFibGVzLmdldChmaWxlTmFtZSk7XG4gICAgaWYgKCFhbmFseXplZEZpbGUpIHtcbiAgICAgIGFuYWx5emVkRmlsZSA9IGFuYWx5emVGaWxlRm9ySW5qZWN0YWJsZXMoXG4gICAgICAgICAgdGhpcy5faG9zdCwgdGhpcy5fc3ltYm9sUmVzb2x2ZXIsIHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIsIGZpbGVOYW1lKTtcbiAgICAgIHRoaXMuX2FuYWx5emVkRmlsZXNGb3JJbmplY3RhYmxlcy5zZXQoZmlsZU5hbWUsIGFuYWx5emVkRmlsZSk7XG4gICAgfVxuICAgIHJldHVybiBhbmFseXplZEZpbGU7XG4gIH1cblxuICBmaW5kR2VuZXJhdGVkRmlsZU5hbWVzKGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZ2VuRmlsZU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLl9hbmFseXplRmlsZShmaWxlTmFtZSk7XG4gICAgLy8gTWFrZSBzdXJlIHdlIGNyZWF0ZSBhIC5uZ2ZhY3RvcnkgaWYgd2UgaGF2ZSBhIGluamVjdGFibGUvZGlyZWN0aXZlL3BpcGUvTmdNb2R1bGVcbiAgICAvLyBvciBhIHJlZmVyZW5jZSB0byBhIG5vbiBzb3VyY2UgZmlsZS5cbiAgICAvLyBOb3RlOiBUaGlzIGlzIG92ZXJlc3RpbWF0aW5nIHRoZSByZXF1aXJlZCAubmdmYWN0b3J5IGZpbGVzIGFzIHRoZSByZWFsIGNhbGN1bGF0aW9uIGlzIGhhcmRlci5cbiAgICAvLyBPbmx5IGRvIHRoaXMgZm9yIFN0dWJFbWl0RmxhZ3MuQmFzaWMsIGFzIGFkZGluZyBhIHR5cGUgY2hlY2sgYmxvY2tcbiAgICAvLyBkb2VzIG5vdCBjaGFuZ2UgdGhpcyBmaWxlIChhcyB3ZSBnZW5lcmF0ZSB0eXBlIGNoZWNrIGJsb2NrcyBiYXNlZCBvbiBOZ01vZHVsZXMpLlxuICAgIGlmICh0aGlzLl9vcHRpb25zLmFsbG93RW1wdHlDb2RlZ2VuRmlsZXMgfHwgZmlsZS5kaXJlY3RpdmVzLmxlbmd0aCB8fCBmaWxlLnBpcGVzLmxlbmd0aCB8fFxuICAgICAgICBmaWxlLmluamVjdGFibGVzLmxlbmd0aCB8fCBmaWxlLm5nTW9kdWxlcy5sZW5ndGggfHwgZmlsZS5leHBvcnRzTm9uU291cmNlRmlsZXMpIHtcbiAgICAgIGdlbkZpbGVOYW1lcy5wdXNoKG5nZmFjdG9yeUZpbGVQYXRoKGZpbGUuZmlsZU5hbWUsIHRydWUpKTtcbiAgICAgIGlmICh0aGlzLl9vcHRpb25zLmVuYWJsZVN1bW1hcmllc0ZvckppdCkge1xuICAgICAgICBnZW5GaWxlTmFtZXMucHVzaChzdW1tYXJ5Rm9ySml0RmlsZU5hbWUoZmlsZS5maWxlTmFtZSwgdHJ1ZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBmaWxlU3VmZml4ID0gbm9ybWFsaXplR2VuRmlsZVN1ZmZpeChzcGxpdFR5cGVzY3JpcHRTdWZmaXgoZmlsZS5maWxlTmFtZSwgdHJ1ZSlbMV0pO1xuICAgIGZpbGUuZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJTeW1ib2wpID0+IHtcbiAgICAgIGNvbnN0IGNvbXBNZXRhID1cbiAgICAgICAgICB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldE5vbk5vcm1hbGl6ZWREaXJlY3RpdmVNZXRhZGF0YShkaXJTeW1ib2wpICEubWV0YWRhdGE7XG4gICAgICBpZiAoIWNvbXBNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIE5vdGU6IGNvbXBNZXRhIGlzIGEgY29tcG9uZW50IGFuZCB0aGVyZWZvcmUgdGVtcGxhdGUgaXMgbm9uIG51bGwuXG4gICAgICBjb21wTWV0YS50ZW1wbGF0ZSAhLnN0eWxlVXJscy5mb3JFYWNoKChzdHlsZVVybCkgPT4ge1xuICAgICAgICBjb25zdCBub3JtYWxpemVkVXJsID0gdGhpcy5faG9zdC5yZXNvdXJjZU5hbWVUb0ZpbGVOYW1lKHN0eWxlVXJsLCBmaWxlLmZpbGVOYW1lKTtcbiAgICAgICAgaWYgKCFub3JtYWxpemVkVXJsKSB7XG4gICAgICAgICAgdGhyb3cgc3ludGF4RXJyb3IoYENvdWxkbid0IHJlc29sdmUgcmVzb3VyY2UgJHtzdHlsZVVybH0gcmVsYXRpdmUgdG8gJHtmaWxlLmZpbGVOYW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5lZWRzU2hpbSA9IChjb21wTWV0YS50ZW1wbGF0ZSAhLmVuY2Fwc3VsYXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbmZpZy5kZWZhdWx0RW5jYXBzdWxhdGlvbikgPT09IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICAgICAgICBnZW5GaWxlTmFtZXMucHVzaChfc3R5bGVzTW9kdWxlVXJsKG5vcm1hbGl6ZWRVcmwsIG5lZWRzU2hpbSwgZmlsZVN1ZmZpeCkpO1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5hbGxvd0VtcHR5Q29kZWdlbkZpbGVzKSB7XG4gICAgICAgICAgZ2VuRmlsZU5hbWVzLnB1c2goX3N0eWxlc01vZHVsZVVybChub3JtYWxpemVkVXJsLCAhbmVlZHNTaGltLCBmaWxlU3VmZml4KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBnZW5GaWxlTmFtZXM7XG4gIH1cblxuICBlbWl0QmFzaWNTdHViKGdlbkZpbGVOYW1lOiBzdHJpbmcsIG9yaWdpbmFsRmlsZU5hbWU/OiBzdHJpbmcpOiBHZW5lcmF0ZWRGaWxlIHtcbiAgICBjb25zdCBvdXRwdXRDdHggPSB0aGlzLl9jcmVhdGVPdXRwdXRDb250ZXh0KGdlbkZpbGVOYW1lKTtcbiAgICBpZiAoZ2VuRmlsZU5hbWUuZW5kc1dpdGgoJy5uZ2ZhY3RvcnkudHMnKSkge1xuICAgICAgaWYgKCFvcmlnaW5hbEZpbGVOYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBc3NlcnRpb24gZXJyb3I6IHJlcXVpcmUgdGhlIG9yaWdpbmFsIGZpbGUgZm9yIC5uZ2ZhY3RvcnkudHMgc3R1YnMuIEZpbGU6ICR7Z2VuRmlsZU5hbWV9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCBvcmlnaW5hbEZpbGUgPSB0aGlzLl9hbmFseXplRmlsZShvcmlnaW5hbEZpbGVOYW1lKTtcbiAgICAgIHRoaXMuX2NyZWF0ZU5nRmFjdG9yeVN0dWIob3V0cHV0Q3R4LCBvcmlnaW5hbEZpbGUsIFN0dWJFbWl0RmxhZ3MuQmFzaWMpO1xuICAgIH0gZWxzZSBpZiAoZ2VuRmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3N1bW1hcnkudHMnKSkge1xuICAgICAgaWYgKHRoaXMuX29wdGlvbnMuZW5hYmxlU3VtbWFyaWVzRm9ySml0KSB7XG4gICAgICAgIGlmICghb3JpZ2luYWxGaWxlTmFtZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYEFzc2VydGlvbiBlcnJvcjogcmVxdWlyZSB0aGUgb3JpZ2luYWwgZmlsZSBmb3IgLm5nc3VtbWFyeS50cyBzdHVicy4gRmlsZTogJHtnZW5GaWxlTmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvcmlnaW5hbEZpbGUgPSB0aGlzLl9hbmFseXplRmlsZShvcmlnaW5hbEZpbGVOYW1lKTtcbiAgICAgICAgX2NyZWF0ZUVtcHR5U3R1YihvdXRwdXRDdHgpO1xuICAgICAgICBvcmlnaW5hbEZpbGUubmdNb2R1bGVzLmZvckVhY2gobmdNb2R1bGUgPT4ge1xuICAgICAgICAgIC8vIGNyZWF0ZSBleHBvcnRzIHRoYXQgdXNlciBjb2RlIGNhbiByZWZlcmVuY2VcbiAgICAgICAgICBjcmVhdGVGb3JKaXRTdHViKG91dHB1dEN0eCwgbmdNb2R1bGUudHlwZS5yZWZlcmVuY2UpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGdlbkZpbGVOYW1lLmVuZHNXaXRoKCcubmdzdHlsZS50cycpKSB7XG4gICAgICBfY3JlYXRlRW1wdHlTdHViKG91dHB1dEN0eCk7XG4gICAgfVxuICAgIC8vIE5vdGU6IGZvciB0aGUgc3R1YnMsIHdlIGRvbid0IG5lZWQgYSBwcm9wZXJ0eSBzcmNGaWxlVXJsLFxuICAgIC8vIGFzIGxhdGVyIG9uIGluIGVtaXRBbGxJbXBscyB3ZSB3aWxsIGNyZWF0ZSB0aGUgcHJvcGVyIEdlbmVyYXRlZEZpbGVzIHdpdGggdGhlXG4gICAgLy8gY29ycmVjdCBzcmNGaWxlVXJsLlxuICAgIC8vIFRoaXMgaXMgZ29vZCBhcyBlLmcuIGZvciAubmdzdHlsZS50cyBmaWxlcyB3ZSBjYW4ndCBkZXJpdmVcbiAgICAvLyB0aGUgdXJsIG9mIGNvbXBvbmVudHMgYmFzZWQgb24gdGhlIGdlbkZpbGVVcmwuXG4gICAgcmV0dXJuIHRoaXMuX2NvZGVnZW5Tb3VyY2VNb2R1bGUoJ3Vua25vd24nLCBvdXRwdXRDdHgpO1xuICB9XG5cbiAgZW1pdFR5cGVDaGVja1N0dWIoZ2VuRmlsZU5hbWU6IHN0cmluZywgb3JpZ2luYWxGaWxlTmFtZTogc3RyaW5nKTogR2VuZXJhdGVkRmlsZXxudWxsIHtcbiAgICBjb25zdCBvcmlnaW5hbEZpbGUgPSB0aGlzLl9hbmFseXplRmlsZShvcmlnaW5hbEZpbGVOYW1lKTtcbiAgICBjb25zdCBvdXRwdXRDdHggPSB0aGlzLl9jcmVhdGVPdXRwdXRDb250ZXh0KGdlbkZpbGVOYW1lKTtcbiAgICBpZiAoZ2VuRmlsZU5hbWUuZW5kc1dpdGgoJy5uZ2ZhY3RvcnkudHMnKSkge1xuICAgICAgdGhpcy5fY3JlYXRlTmdGYWN0b3J5U3R1YihvdXRwdXRDdHgsIG9yaWdpbmFsRmlsZSwgU3R1YkVtaXRGbGFncy5UeXBlQ2hlY2spO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0Q3R4LnN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuX2NvZGVnZW5Tb3VyY2VNb2R1bGUob3JpZ2luYWxGaWxlLmZpbGVOYW1lLCBvdXRwdXRDdHgpIDpcbiAgICAgICAgbnVsbDtcbiAgfVxuXG4gIGxvYWRGaWxlc0FzeW5jKGZpbGVOYW1lczogc3RyaW5nW10sIHRzRmlsZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxcbiAgICAgIHthbmFseXplZE1vZHVsZXM6IE5nQW5hbHl6ZWRNb2R1bGVzLCBhbmFseXplZEluamVjdGFibGVzOiBOZ0FuYWx5emVkRmlsZVdpdGhJbmplY3RhYmxlc1tdfT4ge1xuICAgIGNvbnN0IGZpbGVzID0gZmlsZU5hbWVzLm1hcChmaWxlTmFtZSA9PiB0aGlzLl9hbmFseXplRmlsZShmaWxlTmFtZSkpO1xuICAgIGNvbnN0IGxvYWRpbmdQcm9taXNlczogUHJvbWlzZTxOZ0FuYWx5emVkTW9kdWxlcz5bXSA9IFtdO1xuICAgIGZpbGVzLmZvckVhY2goXG4gICAgICAgIGZpbGUgPT4gZmlsZS5uZ01vZHVsZXMuZm9yRWFjaChcbiAgICAgICAgICAgIG5nTW9kdWxlID0+XG4gICAgICAgICAgICAgICAgbG9hZGluZ1Byb21pc2VzLnB1c2godGhpcy5fbWV0YWRhdGFSZXNvbHZlci5sb2FkTmdNb2R1bGVEaXJlY3RpdmVBbmRQaXBlTWV0YWRhdGEoXG4gICAgICAgICAgICAgICAgICAgIG5nTW9kdWxlLnR5cGUucmVmZXJlbmNlLCBmYWxzZSkpKSk7XG4gICAgY29uc3QgYW5hbHl6ZWRJbmplY3RhYmxlcyA9IHRzRmlsZXMubWFwKHRzRmlsZSA9PiB0aGlzLl9hbmFseXplRmlsZUZvckluamVjdGFibGVzKHRzRmlsZSkpO1xuICAgIHJldHVybiBQcm9taXNlLmFsbChsb2FkaW5nUHJvbWlzZXMpLnRoZW4oXyA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmFseXplZE1vZHVsZXM6IG1lcmdlQW5kVmFsaWRhdGVOZ0ZpbGVzKGZpbGVzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5hbHl6ZWRJbmplY3RhYmxlczogYW5hbHl6ZWRJbmplY3RhYmxlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgfVxuXG4gIGxvYWRGaWxlc1N5bmMoZmlsZU5hbWVzOiBzdHJpbmdbXSwgdHNGaWxlczogc3RyaW5nW10pOlxuICAgICAge2FuYWx5emVkTW9kdWxlczogTmdBbmFseXplZE1vZHVsZXMsIGFuYWx5emVkSW5qZWN0YWJsZXM6IE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzW119IHtcbiAgICBjb25zdCBmaWxlcyA9IGZpbGVOYW1lcy5tYXAoZmlsZU5hbWUgPT4gdGhpcy5fYW5hbHl6ZUZpbGUoZmlsZU5hbWUpKTtcbiAgICBmaWxlcy5mb3JFYWNoKFxuICAgICAgICBmaWxlID0+IGZpbGUubmdNb2R1bGVzLmZvckVhY2goXG4gICAgICAgICAgICBuZ01vZHVsZSA9PiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YShcbiAgICAgICAgICAgICAgICBuZ01vZHVsZS50eXBlLnJlZmVyZW5jZSwgdHJ1ZSkpKTtcbiAgICBjb25zdCBhbmFseXplZEluamVjdGFibGVzID0gdHNGaWxlcy5tYXAodHNGaWxlID0+IHRoaXMuX2FuYWx5emVGaWxlRm9ySW5qZWN0YWJsZXModHNGaWxlKSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFuYWx5emVkTW9kdWxlczogbWVyZ2VBbmRWYWxpZGF0ZU5nRmlsZXMoZmlsZXMpLFxuICAgICAgYW5hbHl6ZWRJbmplY3RhYmxlczogYW5hbHl6ZWRJbmplY3RhYmxlcyxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlTmdGYWN0b3J5U3R1YihcbiAgICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZmlsZTogTmdBbmFseXplZEZpbGUsIGVtaXRGbGFnczogU3R1YkVtaXRGbGFncykge1xuICAgIGxldCBjb21wb25lbnRJZCA9IDA7XG4gICAgZmlsZS5uZ01vZHVsZXMuZm9yRWFjaCgobmdNb2R1bGVNZXRhLCBuZ01vZHVsZUluZGV4KSA9PiB7XG4gICAgICAvLyBOb3RlOiB0aGUgY29kZSBiZWxvdyBuZWVkcyB0byBleGVjdXRlZCBmb3IgU3R1YkVtaXRGbGFncy5CYXNpYyBhbmQgU3R1YkVtaXRGbGFncy5UeXBlQ2hlY2ssXG4gICAgICAvLyBzbyB3ZSBkb24ndCBjaGFuZ2UgdGhlIC5uZ2ZhY3RvcnkgZmlsZSB0b28gbXVjaCB3aGVuIGFkZGluZyB0aGUgdHlwZS1jaGVjayBibG9jay5cblxuICAgICAgLy8gY3JlYXRlIGV4cG9ydHMgdGhhdCB1c2VyIGNvZGUgY2FuIHJlZmVyZW5jZVxuICAgICAgdGhpcy5fbmdNb2R1bGVDb21waWxlci5jcmVhdGVTdHViKG91dHB1dEN0eCwgbmdNb2R1bGVNZXRhLnR5cGUucmVmZXJlbmNlKTtcblxuICAgICAgLy8gYWRkIHJlZmVyZW5jZXMgdG8gdGhlIHN5bWJvbHMgZnJvbSB0aGUgbWV0YWRhdGEuXG4gICAgICAvLyBUaGVzZSBjYW4gYmUgdXNlZCBieSB0aGUgdHlwZSBjaGVjayBibG9jayBmb3IgY29tcG9uZW50cyxcbiAgICAgIC8vIGFuZCB0aGV5IGFsc28gY2F1c2UgVHlwZVNjcmlwdCB0byBpbmNsdWRlIHRoZXNlIGZpbGVzIGludG8gdGhlIHByb2dyYW0gdG9vLFxuICAgICAgLy8gd2hpY2ggd2lsbCBtYWtlIHRoZW0gcGFydCBvZiB0aGUgYW5hbHl6ZWRGaWxlcy5cbiAgICAgIGNvbnN0IGV4dGVybmFsUmVmZXJlbmNlczogU3RhdGljU3ltYm9sW10gPSBbXG4gICAgICAgIC8vIEFkZCByZWZlcmVuY2VzIHRoYXQgYXJlIGF2YWlsYWJsZSBmcm9tIGFsbCB0aGUgbW9kdWxlcyBhbmQgaW1wb3J0cy5cbiAgICAgICAgLi4ubmdNb2R1bGVNZXRhLnRyYW5zaXRpdmVNb2R1bGUuZGlyZWN0aXZlcy5tYXAoZCA9PiBkLnJlZmVyZW5jZSksXG4gICAgICAgIC4uLm5nTW9kdWxlTWV0YS50cmFuc2l0aXZlTW9kdWxlLnBpcGVzLm1hcChkID0+IGQucmVmZXJlbmNlKSxcbiAgICAgICAgLi4ubmdNb2R1bGVNZXRhLmltcG9ydGVkTW9kdWxlcy5tYXAobSA9PiBtLnR5cGUucmVmZXJlbmNlKSxcbiAgICAgICAgLi4ubmdNb2R1bGVNZXRhLmV4cG9ydGVkTW9kdWxlcy5tYXAobSA9PiBtLnR5cGUucmVmZXJlbmNlKSxcblxuICAgICAgICAvLyBBZGQgcmVmZXJlbmNlcyB0aGF0IG1pZ2h0IGJlIGluc2VydGVkIGJ5IHRoZSB0ZW1wbGF0ZSBjb21waWxlci5cbiAgICAgICAgLi4udGhpcy5fZXh0ZXJuYWxJZGVudGlmaWVyUmVmZXJlbmNlcyhbSWRlbnRpZmllcnMuVGVtcGxhdGVSZWYsIElkZW50aWZpZXJzLkVsZW1lbnRSZWZdKSxcbiAgICAgIF07XG5cbiAgICAgIGNvbnN0IGV4dGVybmFsUmVmZXJlbmNlVmFycyA9IG5ldyBNYXA8YW55LCBzdHJpbmc+KCk7XG4gICAgICBleHRlcm5hbFJlZmVyZW5jZXMuZm9yRWFjaCgocmVmLCB0eXBlSW5kZXgpID0+IHtcbiAgICAgICAgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLnNldChyZWYsIGBfZGVjbCR7bmdNb2R1bGVJbmRleH1fJHt0eXBlSW5kZXh9YCk7XG4gICAgICB9KTtcbiAgICAgIGV4dGVybmFsUmVmZXJlbmNlVmFycy5mb3JFYWNoKCh2YXJOYW1lLCByZWZlcmVuY2UpID0+IHtcbiAgICAgICAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICAgIG8udmFyaWFibGUodmFyTmFtZSlcbiAgICAgICAgICAgICAgICAuc2V0KG8uTlVMTF9FWFBSLmNhc3Qoby5EWU5BTUlDX1RZUEUpKVxuICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KG8uZXhwcmVzc2lvblR5cGUob3V0cHV0Q3R4LmltcG9ydEV4cHIoXG4gICAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZSwgLyogdHlwZVBhcmFtcyAqLyBudWxsLCAvKiB1c2VTdW1tYXJpZXMgKi8gZmFsc2UpKSkpO1xuICAgICAgfSk7XG5cbiAgICAgIGlmIChlbWl0RmxhZ3MgJiBTdHViRW1pdEZsYWdzLlR5cGVDaGVjaykge1xuICAgICAgICAvLyBhZGQgdGhlIHR5cGUtY2hlY2sgYmxvY2sgZm9yIGFsbCBjb21wb25lbnRzIG9mIHRoZSBOZ01vZHVsZVxuICAgICAgICBuZ01vZHVsZU1ldGEuZGVjbGFyZWREaXJlY3RpdmVzLmZvckVhY2goKGRpcklkKSA9PiB7XG4gICAgICAgICAgY29uc3QgY29tcE1ldGEgPSB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcklkLnJlZmVyZW5jZSk7XG4gICAgICAgICAgaWYgKCFjb21wTWV0YS5pc0NvbXBvbmVudCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb21wb25lbnRJZCsrO1xuICAgICAgICAgIHRoaXMuX2NyZWF0ZVR5cGVDaGVja0Jsb2NrKFxuICAgICAgICAgICAgICBvdXRwdXRDdHgsIGAke2NvbXBNZXRhLnR5cGUucmVmZXJlbmNlLm5hbWV9X0hvc3RfJHtjb21wb25lbnRJZH1gLCBuZ01vZHVsZU1ldGEsXG4gICAgICAgICAgICAgIHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0SG9zdENvbXBvbmVudE1ldGFkYXRhKGNvbXBNZXRhKSwgW2NvbXBNZXRhLnR5cGVdLFxuICAgICAgICAgICAgICBleHRlcm5hbFJlZmVyZW5jZVZhcnMpO1xuICAgICAgICAgIHRoaXMuX2NyZWF0ZVR5cGVDaGVja0Jsb2NrKFxuICAgICAgICAgICAgICBvdXRwdXRDdHgsIGAke2NvbXBNZXRhLnR5cGUucmVmZXJlbmNlLm5hbWV9XyR7Y29tcG9uZW50SWR9YCwgbmdNb2R1bGVNZXRhLCBjb21wTWV0YSxcbiAgICAgICAgICAgICAgbmdNb2R1bGVNZXRhLnRyYW5zaXRpdmVNb2R1bGUuZGlyZWN0aXZlcywgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAob3V0cHV0Q3R4LnN0YXRlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBfY3JlYXRlRW1wdHlTdHViKG91dHB1dEN0eCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZXh0ZXJuYWxJZGVudGlmaWVyUmVmZXJlbmNlcyhyZWZlcmVuY2VzOiBvLkV4dGVybmFsUmVmZXJlbmNlW10pOiBTdGF0aWNTeW1ib2xbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBTdGF0aWNTeW1ib2xbXSA9IFtdO1xuICAgIGZvciAobGV0IHJlZmVyZW5jZSBvZiByZWZlcmVuY2VzKSB7XG4gICAgICBjb25zdCB0b2tlbiA9IGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UodGhpcy5yZWZsZWN0b3IsIHJlZmVyZW5jZSk7XG4gICAgICBpZiAodG9rZW4uaWRlbnRpZmllcikge1xuICAgICAgICByZXN1bHQucHVzaCh0b2tlbi5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVUeXBlQ2hlY2tCbG9jayhcbiAgICAgIGN0eDogT3V0cHV0Q29udGV4dCwgY29tcG9uZW50SWQ6IHN0cmluZywgbW9kdWxlTWV0YTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsXG4gICAgICBjb21wTWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBkaXJlY3RpdmVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10sXG4gICAgICBleHRlcm5hbFJlZmVyZW5jZVZhcnM6IE1hcDxhbnksIHN0cmluZz4pIHtcbiAgICBjb25zdCB7dGVtcGxhdGU6IHBhcnNlZFRlbXBsYXRlLCBwaXBlczogdXNlZFBpcGVzfSA9XG4gICAgICAgIHRoaXMuX3BhcnNlVGVtcGxhdGUoY29tcE1ldGEsIG1vZHVsZU1ldGEsIGRpcmVjdGl2ZXMpO1xuICAgIGN0eC5zdGF0ZW1lbnRzLnB1c2goLi4udGhpcy5fdHlwZUNoZWNrQ29tcGlsZXIuY29tcGlsZUNvbXBvbmVudChcbiAgICAgICAgY29tcG9uZW50SWQsIGNvbXBNZXRhLCBwYXJzZWRUZW1wbGF0ZSwgdXNlZFBpcGVzLCBleHRlcm5hbFJlZmVyZW5jZVZhcnMsIGN0eCkpO1xuICB9XG5cbiAgZW1pdE1lc3NhZ2VCdW5kbGUoYW5hbHl6ZVJlc3VsdDogTmdBbmFseXplZE1vZHVsZXMsIGxvY2FsZTogc3RyaW5nfG51bGwpOiBNZXNzYWdlQnVuZGxlIHtcbiAgICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICAgIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuXG4gICAgLy8gVE9ETyh2aWNiKTogaW1wbGljaXQgdGFncyAmIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBtZXNzYWdlQnVuZGxlID0gbmV3IE1lc3NhZ2VCdW5kbGUoaHRtbFBhcnNlciwgW10sIHt9LCBsb2NhbGUpO1xuXG4gICAgYW5hbHl6ZVJlc3VsdC5maWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgY29uc3QgY29tcE1ldGFzOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFbXSA9IFtdO1xuICAgICAgZmlsZS5kaXJlY3RpdmVzLmZvckVhY2goZGlyZWN0aXZlVHlwZSA9PiB7XG4gICAgICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgICBpZiAoZGlyTWV0YSAmJiBkaXJNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgICAgY29tcE1ldGFzLnB1c2goZGlyTWV0YSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29tcE1ldGFzLmZvckVhY2goY29tcE1ldGEgPT4ge1xuICAgICAgICBjb25zdCBodG1sID0gY29tcE1ldGEudGVtcGxhdGUgIS50ZW1wbGF0ZSAhO1xuICAgICAgICBjb25zdCBpbnRlcnBvbGF0aW9uQ29uZmlnID1cbiAgICAgICAgICAgIEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGNvbXBNZXRhLnRlbXBsYXRlICEuaW50ZXJwb2xhdGlvbik7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgLi4ubWVzc2FnZUJ1bmRsZS51cGRhdGVGcm9tVGVtcGxhdGUoaHRtbCwgZmlsZS5maWxlTmFtZSwgaW50ZXJwb2xhdGlvbkNvbmZpZykgISk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1hcChlID0+IGUudG9TdHJpbmcoKSkuam9pbignXFxuJykpO1xuICAgIH1cblxuICAgIHJldHVybiBtZXNzYWdlQnVuZGxlO1xuICB9XG5cbiAgZW1pdEFsbFBhcnRpYWxNb2R1bGVzKFxuICAgICAge25nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUsIGZpbGVzfTogTmdBbmFseXplZE1vZHVsZXMsXG4gICAgICByM0ZpbGVzOiBOZ0FuYWx5emVkRmlsZVdpdGhJbmplY3RhYmxlc1tdKTogUGFydGlhbE1vZHVsZVtdIHtcbiAgICBjb25zdCBjb250ZXh0TWFwID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dENvbnRleHQ+KCk7XG5cbiAgICBjb25zdCBnZXRDb250ZXh0ID0gKGZpbGVOYW1lOiBzdHJpbmcpOiBPdXRwdXRDb250ZXh0ID0+IHtcbiAgICAgIGlmICghY29udGV4dE1hcC5oYXMoZmlsZU5hbWUpKSB7XG4gICAgICAgIGNvbnRleHRNYXAuc2V0KGZpbGVOYW1lLCB0aGlzLl9jcmVhdGVPdXRwdXRDb250ZXh0KGZpbGVOYW1lKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29udGV4dE1hcC5nZXQoZmlsZU5hbWUpICE7XG4gICAgfTtcblxuICAgIGZpbGVzLmZvckVhY2goXG4gICAgICAgIGZpbGUgPT4gdGhpcy5fY29tcGlsZVBhcnRpYWxNb2R1bGUoXG4gICAgICAgICAgICBmaWxlLmZpbGVOYW1lLCBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlLCBmaWxlLmRpcmVjdGl2ZXMsIGZpbGUucGlwZXMsIGZpbGUubmdNb2R1bGVzLFxuICAgICAgICAgICAgZmlsZS5pbmplY3RhYmxlcywgZ2V0Q29udGV4dChmaWxlLmZpbGVOYW1lKSkpO1xuICAgIHIzRmlsZXMuZm9yRWFjaChcbiAgICAgICAgZmlsZSA9PiB0aGlzLl9jb21waWxlU2hhbGxvd01vZHVsZXMoXG4gICAgICAgICAgICBmaWxlLmZpbGVOYW1lLCBmaWxlLnNoYWxsb3dNb2R1bGVzLCBnZXRDb250ZXh0KGZpbGUuZmlsZU5hbWUpKSk7XG5cbiAgICByZXR1cm4gQXJyYXkuZnJvbShjb250ZXh0TWFwLnZhbHVlcygpKVxuICAgICAgICAubWFwKGNvbnRleHQgPT4gKHtcbiAgICAgICAgICAgICAgIGZpbGVOYW1lOiBjb250ZXh0LmdlbkZpbGVQYXRoLFxuICAgICAgICAgICAgICAgc3RhdGVtZW50czogWy4uLmNvbnRleHQuY29uc3RhbnRQb29sLnN0YXRlbWVudHMsIC4uLmNvbnRleHQuc3RhdGVtZW50c10sXG4gICAgICAgICAgICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tcGlsZVNoYWxsb3dNb2R1bGVzKFxuICAgICAgZmlsZU5hbWU6IHN0cmluZywgc2hhbGxvd01vZHVsZXM6IENvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGFbXSxcbiAgICAgIGNvbnRleHQ6IE91dHB1dENvbnRleHQpOiB2b2lkIHtcbiAgICBzaGFsbG93TW9kdWxlcy5mb3JFYWNoKG1vZHVsZSA9PiBjb21waWxlUjNNb2R1bGUoY29udGV4dCwgbW9kdWxlLCB0aGlzLl9pbmplY3RhYmxlQ29tcGlsZXIpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbXBpbGVQYXJ0aWFsTW9kdWxlKFxuICAgICAgZmlsZU5hbWU6IHN0cmluZywgbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZTogTWFwPFN0YXRpY1N5bWJvbCwgQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGE+LFxuICAgICAgZGlyZWN0aXZlczogU3RhdGljU3ltYm9sW10sIHBpcGVzOiBTdGF0aWNTeW1ib2xbXSwgbmdNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YVtdLFxuICAgICAgaW5qZWN0YWJsZXM6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGFbXSwgY29udGV4dDogT3V0cHV0Q29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG5cbiAgICBjb25zdCBzY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcbiAgICBjb25zdCBob3N0QmluZGluZ1BhcnNlciA9IG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgICB0aGlzLl90ZW1wbGF0ZVBhcnNlci5leHByZXNzaW9uUGFyc2VyLCBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBzY2hlbWFSZWdpc3RyeSwgW10sXG4gICAgICAgIGVycm9ycyk7XG5cbiAgICAvLyBQcm9jZXNzIGFsbCBjb21wb25lbnRzIGFuZCBkaXJlY3RpdmVzXG4gICAgZGlyZWN0aXZlcy5mb3JFYWNoKGRpcmVjdGl2ZVR5cGUgPT4ge1xuICAgICAgY29uc3QgZGlyZWN0aXZlTWV0YWRhdGEgPSB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgaWYgKGRpcmVjdGl2ZU1ldGFkYXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZSA9IG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUuZ2V0KGRpcmVjdGl2ZVR5cGUpICE7XG4gICAgICAgIG1vZHVsZSB8fFxuICAgICAgICAgICAgZXJyb3IoXG4gICAgICAgICAgICAgICAgYENhbm5vdCBkZXRlcm1pbmUgdGhlIG1vZHVsZSBmb3IgY29tcG9uZW50ICcke2lkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZU1ldGFkYXRhLnR5cGUpfSdgKTtcblxuICAgICAgICBsZXQgaHRtbEFzdCA9IGRpcmVjdGl2ZU1ldGFkYXRhLnRlbXBsYXRlICEuaHRtbEFzdCAhO1xuICAgICAgICBjb25zdCBwcmVzZXJ2ZVdoaXRlc3BhY2VzID0gZGlyZWN0aXZlTWV0YWRhdGEgIS50ZW1wbGF0ZSAhLnByZXNlcnZlV2hpdGVzcGFjZXM7XG5cbiAgICAgICAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgICAgICAgaHRtbEFzdCA9IHJlbW92ZVdoaXRlc3BhY2VzKGh0bWxBc3QpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlbmRlcjNBc3QgPSBodG1sQXN0VG9SZW5kZXIzQXN0KGh0bWxBc3Qucm9vdE5vZGVzLCBob3N0QmluZGluZ1BhcnNlcik7XG5cbiAgICAgICAgLy8gTWFwIG9mIFN0YXRpY1R5cGUgYnkgZGlyZWN0aXZlIHNlbGVjdG9yc1xuICAgICAgICBjb25zdCBkaXJlY3RpdmVUeXBlQnlTZWwgPSBuZXcgTWFwPHN0cmluZywgYW55PigpO1xuXG4gICAgICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBtb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5kaXJlY3RpdmVzLm1hcChcbiAgICAgICAgICAgIGRpciA9PiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZVN1bW1hcnkoZGlyLnJlZmVyZW5jZSkpO1xuXG4gICAgICAgIGRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmUgPT4ge1xuICAgICAgICAgIGlmIChkaXJlY3RpdmUuc2VsZWN0b3IpIHtcbiAgICAgICAgICAgIGRpcmVjdGl2ZVR5cGVCeVNlbC5zZXQoZGlyZWN0aXZlLnNlbGVjdG9yLCBkaXJlY3RpdmUudHlwZS5yZWZlcmVuY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTWFwIG9mIFN0YXRpY1R5cGUgYnkgcGlwZSBuYW1lc1xuICAgICAgICBjb25zdCBwaXBlVHlwZUJ5TmFtZSA9IG5ldyBNYXA8c3RyaW5nLCBhbnk+KCk7XG5cbiAgICAgICAgY29uc3QgcGlwZXMgPSBtb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5waXBlcy5tYXAoXG4gICAgICAgICAgICBwaXBlID0+IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0UGlwZVN1bW1hcnkocGlwZS5yZWZlcmVuY2UpKTtcblxuICAgICAgICBwaXBlcy5mb3JFYWNoKHBpcGUgPT4geyBwaXBlVHlwZUJ5TmFtZS5zZXQocGlwZS5uYW1lLCBwaXBlLnR5cGUucmVmZXJlbmNlKTsgfSk7XG5cbiAgICAgICAgY29tcGlsZVIzQ29tcG9uZW50KFxuICAgICAgICAgICAgY29udGV4dCwgZGlyZWN0aXZlTWV0YWRhdGEsIHJlbmRlcjNBc3QsIHRoaXMucmVmbGVjdG9yLCBob3N0QmluZGluZ1BhcnNlcixcbiAgICAgICAgICAgIGRpcmVjdGl2ZVR5cGVCeVNlbCwgcGlwZVR5cGVCeU5hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGlsZVIzRGlyZWN0aXZlKGNvbnRleHQsIGRpcmVjdGl2ZU1ldGFkYXRhLCB0aGlzLnJlZmxlY3RvciwgaG9zdEJpbmRpbmdQYXJzZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcGlwZXMuZm9yRWFjaChwaXBlVHlwZSA9PiB7XG4gICAgICBjb25zdCBwaXBlTWV0YWRhdGEgPSB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldFBpcGVNZXRhZGF0YShwaXBlVHlwZSk7XG4gICAgICBpZiAocGlwZU1ldGFkYXRhKSB7XG4gICAgICAgIGNvbXBpbGVSM1BpcGUoY29udGV4dCwgcGlwZU1ldGFkYXRhLCB0aGlzLnJlZmxlY3Rvcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpbmplY3RhYmxlcy5mb3JFYWNoKGluamVjdGFibGUgPT4gdGhpcy5faW5qZWN0YWJsZUNvbXBpbGVyLmNvbXBpbGUoaW5qZWN0YWJsZSwgY29udGV4dCkpO1xuICB9XG5cbiAgZW1pdEFsbFBhcnRpYWxNb2R1bGVzMihmaWxlczogTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXNbXSk6IFBhcnRpYWxNb2R1bGVbXSB7XG4gICAgLy8gVXNpbmcgcmVkdWNlIGxpa2UgdGhpcyBpcyBhIHNlbGVjdCBtYW55IHBhdHRlcm4gKHdoZXJlIG1hcCBpcyBhIHNlbGVjdCBwYXR0ZXJuKVxuICAgIHJldHVybiBmaWxlcy5yZWR1Y2U8UGFydGlhbE1vZHVsZVtdPigociwgZmlsZSkgPT4ge1xuICAgICAgci5wdXNoKC4uLnRoaXMuX2VtaXRQYXJ0aWFsTW9kdWxlMihmaWxlLmZpbGVOYW1lLCBmaWxlLmluamVjdGFibGVzKSk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9LCBbXSk7XG4gIH1cblxuICBwcml2YXRlIF9lbWl0UGFydGlhbE1vZHVsZTIoZmlsZU5hbWU6IHN0cmluZywgaW5qZWN0YWJsZXM6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGFbXSk6XG4gICAgICBQYXJ0aWFsTW9kdWxlW10ge1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLl9jcmVhdGVPdXRwdXRDb250ZXh0KGZpbGVOYW1lKTtcblxuICAgIGluamVjdGFibGVzLmZvckVhY2goaW5qZWN0YWJsZSA9PiB0aGlzLl9pbmplY3RhYmxlQ29tcGlsZXIuY29tcGlsZShpbmplY3RhYmxlLCBjb250ZXh0KSk7XG5cbiAgICBpZiAoY29udGV4dC5zdGF0ZW1lbnRzICYmIGNvbnRleHQuc3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gW3tmaWxlTmFtZSwgc3RhdGVtZW50czogWy4uLmNvbnRleHQuY29uc3RhbnRQb29sLnN0YXRlbWVudHMsIC4uLmNvbnRleHQuc3RhdGVtZW50c119XTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgZW1pdEFsbEltcGxzKGFuYWx5emVSZXN1bHQ6IE5nQW5hbHl6ZWRNb2R1bGVzKTogR2VuZXJhdGVkRmlsZVtdIHtcbiAgICBjb25zdCB7bmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZSwgZmlsZXN9ID0gYW5hbHl6ZVJlc3VsdDtcbiAgICBjb25zdCBzb3VyY2VNb2R1bGVzID0gZmlsZXMubWFwKFxuICAgICAgICBmaWxlID0+IHRoaXMuX2NvbXBpbGVJbXBsRmlsZShcbiAgICAgICAgICAgIGZpbGUuZmlsZU5hbWUsIG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUsIGZpbGUuZGlyZWN0aXZlcywgZmlsZS5waXBlcywgZmlsZS5uZ01vZHVsZXMsXG4gICAgICAgICAgICBmaWxlLmluamVjdGFibGVzKSk7XG4gICAgcmV0dXJuIGZsYXR0ZW4oc291cmNlTW9kdWxlcyk7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlSW1wbEZpbGUoXG4gICAgICBzcmNGaWxlVXJsOiBzdHJpbmcsIG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmU6IE1hcDxTdGF0aWNTeW1ib2wsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhPixcbiAgICAgIGRpcmVjdGl2ZXM6IFN0YXRpY1N5bWJvbFtdLCBwaXBlczogU3RhdGljU3ltYm9sW10sIG5nTW9kdWxlczogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGFbXSxcbiAgICAgIGluamVjdGFibGVzOiBDb21waWxlSW5qZWN0YWJsZU1ldGFkYXRhW10pOiBHZW5lcmF0ZWRGaWxlW10ge1xuICAgIGNvbnN0IGZpbGVTdWZmaXggPSBub3JtYWxpemVHZW5GaWxlU3VmZml4KHNwbGl0VHlwZXNjcmlwdFN1ZmZpeChzcmNGaWxlVXJsLCB0cnVlKVsxXSk7XG4gICAgY29uc3QgZ2VuZXJhdGVkRmlsZXM6IEdlbmVyYXRlZEZpbGVbXSA9IFtdO1xuXG4gICAgY29uc3Qgb3V0cHV0Q3R4ID0gdGhpcy5fY3JlYXRlT3V0cHV0Q29udGV4dChuZ2ZhY3RvcnlGaWxlUGF0aChzcmNGaWxlVXJsLCB0cnVlKSk7XG5cbiAgICBnZW5lcmF0ZWRGaWxlcy5wdXNoKFxuICAgICAgICAuLi50aGlzLl9jcmVhdGVTdW1tYXJ5KHNyY0ZpbGVVcmwsIGRpcmVjdGl2ZXMsIHBpcGVzLCBuZ01vZHVsZXMsIGluamVjdGFibGVzLCBvdXRwdXRDdHgpKTtcblxuICAgIC8vIGNvbXBpbGUgYWxsIG5nIG1vZHVsZXNcbiAgICBuZ01vZHVsZXMuZm9yRWFjaCgobmdNb2R1bGVNZXRhKSA9PiB0aGlzLl9jb21waWxlTW9kdWxlKG91dHB1dEN0eCwgbmdNb2R1bGVNZXRhKSk7XG5cbiAgICAvLyBjb21waWxlIGNvbXBvbmVudHNcbiAgICBkaXJlY3RpdmVzLmZvckVhY2goKGRpclR5cGUpID0+IHtcbiAgICAgIGNvbnN0IGNvbXBNZXRhID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVNZXRhZGF0YSg8YW55PmRpclR5cGUpO1xuICAgICAgaWYgKCFjb21wTWV0YS5pc0NvbXBvbmVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBuZ01vZHVsZSA9IG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUuZ2V0KGRpclR5cGUpO1xuICAgICAgaWYgKCFuZ01vZHVsZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgSW50ZXJuYWwgRXJyb3I6IGNhbm5vdCBkZXRlcm1pbmUgdGhlIG1vZHVsZSBmb3IgY29tcG9uZW50ICR7aWRlbnRpZmllck5hbWUoY29tcE1ldGEudHlwZSl9IWApO1xuICAgICAgfVxuXG4gICAgICAvLyBjb21waWxlIHN0eWxlc1xuICAgICAgY29uc3QgY29tcG9uZW50U3R5bGVzaGVldCA9IHRoaXMuX3N0eWxlQ29tcGlsZXIuY29tcGlsZUNvbXBvbmVudChvdXRwdXRDdHgsIGNvbXBNZXRhKTtcbiAgICAgIC8vIE5vdGU6IGNvbXBNZXRhIGlzIGEgY29tcG9uZW50IGFuZCB0aGVyZWZvcmUgdGVtcGxhdGUgaXMgbm9uIG51bGwuXG4gICAgICBjb21wTWV0YS50ZW1wbGF0ZSAhLmV4dGVybmFsU3R5bGVzaGVldHMuZm9yRWFjaCgoc3R5bGVzaGVldE1ldGEpID0+IHtcbiAgICAgICAgLy8gTm90ZTogZmlsbCBub24gc2hpbSBhbmQgc2hpbSBzdHlsZSBmaWxlcyBhcyB0aGV5IG1pZ2h0XG4gICAgICAgIC8vIGJlIHNoYXJlZCBieSBjb21wb25lbnQgd2l0aCBhbmQgd2l0aG91dCBWaWV3RW5jYXBzdWxhdGlvbi5cbiAgICAgICAgY29uc3Qgc2hpbSA9IHRoaXMuX3N0eWxlQ29tcGlsZXIubmVlZHNTdHlsZVNoaW0oY29tcE1ldGEpO1xuICAgICAgICBnZW5lcmF0ZWRGaWxlcy5wdXNoKFxuICAgICAgICAgICAgdGhpcy5fY29kZWdlblN0eWxlcyhzcmNGaWxlVXJsLCBjb21wTWV0YSwgc3R5bGVzaGVldE1ldGEsIHNoaW0sIGZpbGVTdWZmaXgpKTtcbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMuYWxsb3dFbXB0eUNvZGVnZW5GaWxlcykge1xuICAgICAgICAgIGdlbmVyYXRlZEZpbGVzLnB1c2goXG4gICAgICAgICAgICAgIHRoaXMuX2NvZGVnZW5TdHlsZXMoc3JjRmlsZVVybCwgY29tcE1ldGEsIHN0eWxlc2hlZXRNZXRhLCAhc2hpbSwgZmlsZVN1ZmZpeCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gY29tcGlsZSBjb21wb25lbnRzXG4gICAgICBjb25zdCBjb21wVmlld1ZhcnMgPSB0aGlzLl9jb21waWxlQ29tcG9uZW50KFxuICAgICAgICAgIG91dHB1dEN0eCwgY29tcE1ldGEsIG5nTW9kdWxlLCBuZ01vZHVsZS50cmFuc2l0aXZlTW9kdWxlLmRpcmVjdGl2ZXMsIGNvbXBvbmVudFN0eWxlc2hlZXQsXG4gICAgICAgICAgZmlsZVN1ZmZpeCk7XG4gICAgICB0aGlzLl9jb21waWxlQ29tcG9uZW50RmFjdG9yeShvdXRwdXRDdHgsIGNvbXBNZXRhLCBuZ01vZHVsZSwgZmlsZVN1ZmZpeCk7XG4gICAgfSk7XG4gICAgaWYgKG91dHB1dEN0eC5zdGF0ZW1lbnRzLmxlbmd0aCA+IDAgfHwgdGhpcy5fb3B0aW9ucy5hbGxvd0VtcHR5Q29kZWdlbkZpbGVzKSB7XG4gICAgICBjb25zdCBzcmNNb2R1bGUgPSB0aGlzLl9jb2RlZ2VuU291cmNlTW9kdWxlKHNyY0ZpbGVVcmwsIG91dHB1dEN0eCk7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy51bnNoaWZ0KHNyY01vZHVsZSk7XG4gICAgfVxuICAgIHJldHVybiBnZW5lcmF0ZWRGaWxlcztcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZVN1bW1hcnkoXG4gICAgICBzcmNGaWxlTmFtZTogc3RyaW5nLCBkaXJlY3RpdmVzOiBTdGF0aWNTeW1ib2xbXSwgcGlwZXM6IFN0YXRpY1N5bWJvbFtdLFxuICAgICAgbmdNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YVtdLCBpbmplY3RhYmxlczogQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YVtdLFxuICAgICAgbmdGYWN0b3J5Q3R4OiBPdXRwdXRDb250ZXh0KTogR2VuZXJhdGVkRmlsZVtdIHtcbiAgICBjb25zdCBzeW1ib2xTdW1tYXJpZXMgPSB0aGlzLl9zeW1ib2xSZXNvbHZlci5nZXRTeW1ib2xzT2Yoc3JjRmlsZU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoc3ltYm9sID0+IHRoaXMuX3N5bWJvbFJlc29sdmVyLnJlc29sdmVTeW1ib2woc3ltYm9sKSk7XG4gICAgY29uc3QgdHlwZURhdGE6IHtcbiAgICAgIHN1bW1hcnk6IENvbXBpbGVUeXBlU3VtbWFyeSxcbiAgICAgIG1ldGFkYXRhOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSB8IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSB8IENvbXBpbGVQaXBlTWV0YWRhdGEgfFxuICAgICAgICAgIENvbXBpbGVUeXBlTWV0YWRhdGFcbiAgICB9W10gPVxuICAgICAgICBbXG4gICAgICAgICAgLi4ubmdNb2R1bGVzLm1hcChcbiAgICAgICAgICAgICAgbWV0YSA9PiAoe1xuICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVTdW1tYXJ5KG1ldGEudHlwZS5yZWZlcmVuY2UpICEsXG4gICAgICAgICAgICAgICAgbWV0YWRhdGE6IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShtZXRhLnR5cGUucmVmZXJlbmNlKSAhXG4gICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAuLi5kaXJlY3RpdmVzLm1hcChyZWYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlU3VtbWFyeShyZWYpICEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YTogdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVNZXRhZGF0YShyZWYpICFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgLi4ucGlwZXMubWFwKHJlZiA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0UGlwZVN1bW1hcnkocmVmKSAhLFxuICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhOiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldFBpcGVNZXRhZGF0YShyZWYpICFcbiAgICAgICAgICAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgIC4uLmluamVjdGFibGVzLm1hcChcbiAgICAgICAgICAgICAgcmVmID0+ICh7XG4gICAgICAgICAgICAgICAgc3VtbWFyeTogdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRJbmplY3RhYmxlU3VtbWFyeShyZWYuc3ltYm9sKSAhLFxuICAgICAgICAgICAgICAgIG1ldGFkYXRhOiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldEluamVjdGFibGVTdW1tYXJ5KHJlZi5zeW1ib2wpICEudHlwZVxuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgXTtcbiAgICBjb25zdCBmb3JKaXRPdXRwdXRDdHggPSB0aGlzLl9vcHRpb25zLmVuYWJsZVN1bW1hcmllc0ZvckppdCA/XG4gICAgICAgIHRoaXMuX2NyZWF0ZU91dHB1dENvbnRleHQoc3VtbWFyeUZvckppdEZpbGVOYW1lKHNyY0ZpbGVOYW1lLCB0cnVlKSkgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IHtqc29uLCBleHBvcnRBc30gPSBzZXJpYWxpemVTdW1tYXJpZXMoXG4gICAgICAgIHNyY0ZpbGVOYW1lLCBmb3JKaXRPdXRwdXRDdHgsIHRoaXMuX3N1bW1hcnlSZXNvbHZlciwgdGhpcy5fc3ltYm9sUmVzb2x2ZXIsIHN5bWJvbFN1bW1hcmllcyxcbiAgICAgICAgdHlwZURhdGEpO1xuICAgIGV4cG9ydEFzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICBuZ0ZhY3RvcnlDdHguc3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgIG8udmFyaWFibGUoZW50cnkuZXhwb3J0QXMpLnNldChuZ0ZhY3RvcnlDdHguaW1wb3J0RXhwcihlbnRyeS5zeW1ib2wpKS50b0RlY2xTdG10KG51bGwsIFtcbiAgICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkXG4gICAgICAgICAgXSkpO1xuICAgIH0pO1xuICAgIGNvbnN0IHN1bW1hcnlKc29uID0gbmV3IEdlbmVyYXRlZEZpbGUoc3JjRmlsZU5hbWUsIHN1bW1hcnlGaWxlTmFtZShzcmNGaWxlTmFtZSksIGpzb24pO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtzdW1tYXJ5SnNvbl07XG4gICAgaWYgKGZvckppdE91dHB1dEN0eCkge1xuICAgICAgcmVzdWx0LnB1c2godGhpcy5fY29kZWdlblNvdXJjZU1vZHVsZShzcmNGaWxlTmFtZSwgZm9ySml0T3V0cHV0Q3R4KSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlTW9kdWxlKG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgbmdNb2R1bGU6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhKTogdm9pZCB7XG4gICAgY29uc3QgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdID0gW107XG5cbiAgICBpZiAodGhpcy5fb3B0aW9ucy5sb2NhbGUpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWRMb2NhbGUgPSB0aGlzLl9vcHRpb25zLmxvY2FsZS5yZXBsYWNlKC9fL2csICctJyk7XG4gICAgICBwcm92aWRlcnMucHVzaCh7XG4gICAgICAgIHRva2VuOiBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMucmVmbGVjdG9yLCBJZGVudGlmaWVycy5MT0NBTEVfSUQpLFxuICAgICAgICB1c2VWYWx1ZTogbm9ybWFsaXplZExvY2FsZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9vcHRpb25zLmkxOG5Gb3JtYXQpIHtcbiAgICAgIHByb3ZpZGVycy5wdXNoKHtcbiAgICAgICAgdG9rZW46IGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UodGhpcy5yZWZsZWN0b3IsIElkZW50aWZpZXJzLlRSQU5TTEFUSU9OU19GT1JNQVQpLFxuICAgICAgICB1c2VWYWx1ZTogdGhpcy5fb3B0aW9ucy5pMThuRm9ybWF0XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLl9uZ01vZHVsZUNvbXBpbGVyLmNvbXBpbGUob3V0cHV0Q3R4LCBuZ01vZHVsZSwgcHJvdmlkZXJzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbXBpbGVDb21wb25lbnRGYWN0b3J5KFxuICAgICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wTWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgbmdNb2R1bGU6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBmaWxlU3VmZml4OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBob3N0TWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0SG9zdENvbXBvbmVudE1ldGFkYXRhKGNvbXBNZXRhKTtcbiAgICBjb25zdCBob3N0Vmlld0ZhY3RvcnlWYXIgPVxuICAgICAgICB0aGlzLl9jb21waWxlQ29tcG9uZW50KG91dHB1dEN0eCwgaG9zdE1ldGEsIG5nTW9kdWxlLCBbY29tcE1ldGEudHlwZV0sIG51bGwsIGZpbGVTdWZmaXgpXG4gICAgICAgICAgICAudmlld0NsYXNzVmFyO1xuICAgIGNvbnN0IGNvbXBGYWN0b3J5VmFyID0gY29tcG9uZW50RmFjdG9yeU5hbWUoY29tcE1ldGEudHlwZS5yZWZlcmVuY2UpO1xuICAgIGNvbnN0IGlucHV0c0V4cHJzOiBvLkxpdGVyYWxNYXBFbnRyeVtdID0gW107XG4gICAgZm9yIChsZXQgcHJvcE5hbWUgaW4gY29tcE1ldGEuaW5wdXRzKSB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBjb21wTWV0YS5pbnB1dHNbcHJvcE5hbWVdO1xuICAgICAgLy8gRG9uJ3QgcXVvdGUgc28gdGhhdCB0aGUga2V5IGdldHMgbWluaWZpZWQuLi5cbiAgICAgIGlucHV0c0V4cHJzLnB1c2gobmV3IG8uTGl0ZXJhbE1hcEVudHJ5KHByb3BOYW1lLCBvLmxpdGVyYWwodGVtcGxhdGVOYW1lKSwgZmFsc2UpKTtcbiAgICB9XG4gICAgY29uc3Qgb3V0cHV0c0V4cHJzOiBvLkxpdGVyYWxNYXBFbnRyeVtdID0gW107XG4gICAgZm9yIChsZXQgcHJvcE5hbWUgaW4gY29tcE1ldGEub3V0cHV0cykge1xuICAgICAgY29uc3QgdGVtcGxhdGVOYW1lID0gY29tcE1ldGEub3V0cHV0c1twcm9wTmFtZV07XG4gICAgICAvLyBEb24ndCBxdW90ZSBzbyB0aGF0IHRoZSBrZXkgZ2V0cyBtaW5pZmllZC4uLlxuICAgICAgb3V0cHV0c0V4cHJzLnB1c2gobmV3IG8uTGl0ZXJhbE1hcEVudHJ5KHByb3BOYW1lLCBvLmxpdGVyYWwodGVtcGxhdGVOYW1lKSwgZmFsc2UpKTtcbiAgICB9XG5cbiAgICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKFxuICAgICAgICBvLnZhcmlhYmxlKGNvbXBGYWN0b3J5VmFyKVxuICAgICAgICAgICAgLnNldChvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuY3JlYXRlQ29tcG9uZW50RmFjdG9yeSkuY2FsbEZuKFtcbiAgICAgICAgICAgICAgby5saXRlcmFsKGNvbXBNZXRhLnNlbGVjdG9yKSwgb3V0cHV0Q3R4LmltcG9ydEV4cHIoY29tcE1ldGEudHlwZS5yZWZlcmVuY2UpLFxuICAgICAgICAgICAgICBvLnZhcmlhYmxlKGhvc3RWaWV3RmFjdG9yeVZhciksIG5ldyBvLkxpdGVyYWxNYXBFeHByKGlucHV0c0V4cHJzKSxcbiAgICAgICAgICAgICAgbmV3IG8uTGl0ZXJhbE1hcEV4cHIob3V0cHV0c0V4cHJzKSxcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKFxuICAgICAgICAgICAgICAgICAgY29tcE1ldGEudGVtcGxhdGUgIS5uZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHNlbGVjdG9yID0+IG8ubGl0ZXJhbChzZWxlY3RvcikpKVxuICAgICAgICAgICAgXSkpXG4gICAgICAgICAgICAudG9EZWNsU3RtdChcbiAgICAgICAgICAgICAgICBvLmltcG9ydFR5cGUoXG4gICAgICAgICAgICAgICAgICAgIElkZW50aWZpZXJzLkNvbXBvbmVudEZhY3RvcnksXG4gICAgICAgICAgICAgICAgICAgIFtvLmV4cHJlc3Npb25UeXBlKG91dHB1dEN0eC5pbXBvcnRFeHByKGNvbXBNZXRhLnR5cGUucmVmZXJlbmNlKSkgIV0sXG4gICAgICAgICAgICAgICAgICAgIFtvLlR5cGVNb2RpZmllci5Db25zdF0pLFxuICAgICAgICAgICAgICAgIFtvLlN0bXRNb2RpZmllci5GaW5hbCwgby5TdG10TW9kaWZpZXIuRXhwb3J0ZWRdKSk7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlQ29tcG9uZW50KFxuICAgICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wTWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgbmdNb2R1bGU6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBkaXJlY3RpdmVJZGVudGlmaWVyczogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdLFxuICAgICAgY29tcG9uZW50U3R5bGVzOiBDb21waWxlZFN0eWxlc2hlZXR8bnVsbCwgZmlsZVN1ZmZpeDogc3RyaW5nKTogVmlld0NvbXBpbGVSZXN1bHQge1xuICAgIGNvbnN0IHt0ZW1wbGF0ZTogcGFyc2VkVGVtcGxhdGUsIHBpcGVzOiB1c2VkUGlwZXN9ID1cbiAgICAgICAgdGhpcy5fcGFyc2VUZW1wbGF0ZShjb21wTWV0YSwgbmdNb2R1bGUsIGRpcmVjdGl2ZUlkZW50aWZpZXJzKTtcbiAgICBjb25zdCBzdHlsZXNFeHByID0gY29tcG9uZW50U3R5bGVzID8gby52YXJpYWJsZShjb21wb25lbnRTdHlsZXMuc3R5bGVzVmFyKSA6IG8ubGl0ZXJhbEFycihbXSk7XG4gICAgY29uc3Qgdmlld1Jlc3VsdCA9IHRoaXMuX3ZpZXdDb21waWxlci5jb21waWxlQ29tcG9uZW50KFxuICAgICAgICBvdXRwdXRDdHgsIGNvbXBNZXRhLCBwYXJzZWRUZW1wbGF0ZSwgc3R5bGVzRXhwciwgdXNlZFBpcGVzKTtcbiAgICBpZiAoY29tcG9uZW50U3R5bGVzKSB7XG4gICAgICBfcmVzb2x2ZVN0eWxlU3RhdGVtZW50cyhcbiAgICAgICAgICB0aGlzLl9zeW1ib2xSZXNvbHZlciwgY29tcG9uZW50U3R5bGVzLCB0aGlzLl9zdHlsZUNvbXBpbGVyLm5lZWRzU3R5bGVTaGltKGNvbXBNZXRhKSxcbiAgICAgICAgICBmaWxlU3VmZml4KTtcbiAgICB9XG4gICAgcmV0dXJuIHZpZXdSZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVRlbXBsYXRlKFxuICAgICAgY29tcE1ldGE6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgbmdNb2R1bGU6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLFxuICAgICAgZGlyZWN0aXZlSWRlbnRpZmllcnM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSk6XG4gICAgICB7dGVtcGxhdGU6IFRlbXBsYXRlQXN0W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXX0ge1xuICAgIGlmICh0aGlzLl90ZW1wbGF0ZUFzdENhY2hlLmhhcyhjb21wTWV0YS50eXBlLnJlZmVyZW5jZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLl90ZW1wbGF0ZUFzdENhY2hlLmdldChjb21wTWV0YS50eXBlLnJlZmVyZW5jZSkgITtcbiAgICB9XG4gICAgY29uc3QgcHJlc2VydmVXaGl0ZXNwYWNlcyA9IGNvbXBNZXRhICEudGVtcGxhdGUgIS5wcmVzZXJ2ZVdoaXRlc3BhY2VzO1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPVxuICAgICAgICBkaXJlY3RpdmVJZGVudGlmaWVycy5tYXAoZGlyID0+IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlU3VtbWFyeShkaXIucmVmZXJlbmNlKSk7XG4gICAgY29uc3QgcGlwZXMgPSBuZ01vZHVsZS50cmFuc2l0aXZlTW9kdWxlLnBpcGVzLm1hcChcbiAgICAgICAgcGlwZSA9PiB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldFBpcGVTdW1tYXJ5KHBpcGUucmVmZXJlbmNlKSk7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fdGVtcGxhdGVQYXJzZXIucGFyc2UoXG4gICAgICAgIGNvbXBNZXRhLCBjb21wTWV0YS50ZW1wbGF0ZSAhLmh0bWxBc3QgISwgZGlyZWN0aXZlcywgcGlwZXMsIG5nTW9kdWxlLnNjaGVtYXMsXG4gICAgICAgIHRlbXBsYXRlU291cmNlVXJsKG5nTW9kdWxlLnR5cGUsIGNvbXBNZXRhLCBjb21wTWV0YS50ZW1wbGF0ZSAhKSwgcHJlc2VydmVXaGl0ZXNwYWNlcyk7XG4gICAgdGhpcy5fdGVtcGxhdGVBc3RDYWNoZS5zZXQoY29tcE1ldGEudHlwZS5yZWZlcmVuY2UsIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZU91dHB1dENvbnRleHQoZ2VuRmlsZVBhdGg6IHN0cmluZyk6IE91dHB1dENvbnRleHQge1xuICAgIGNvbnN0IGltcG9ydEV4cHIgPVxuICAgICAgICAoc3ltYm9sOiBTdGF0aWNTeW1ib2wsIHR5cGVQYXJhbXM6IG8uVHlwZVtdIHwgbnVsbCA9IG51bGwsXG4gICAgICAgICB1c2VTdW1tYXJpZXM6IGJvb2xlYW4gPSB0cnVlKSA9PiB7XG4gICAgICAgICAgaWYgKCEoc3ltYm9sIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBlcnJvcjogdW5rbm93biBpZGVudGlmaWVyICR7SlNPTi5zdHJpbmdpZnkoc3ltYm9sKX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgYXJpdHkgPSB0aGlzLl9zeW1ib2xSZXNvbHZlci5nZXRUeXBlQXJpdHkoc3ltYm9sKSB8fCAwO1xuICAgICAgICAgIGNvbnN0IHtmaWxlUGF0aCwgbmFtZSwgbWVtYmVyc30gPVxuICAgICAgICAgICAgICB0aGlzLl9zeW1ib2xSZXNvbHZlci5nZXRJbXBvcnRBcyhzeW1ib2wsIHVzZVN1bW1hcmllcykgfHwgc3ltYm9sO1xuICAgICAgICAgIGNvbnN0IGltcG9ydE1vZHVsZSA9IHRoaXMuX2ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGZpbGVQYXRoLCBnZW5GaWxlUGF0aCk7XG5cbiAgICAgICAgICAvLyBJdCBzaG91bGQgYmUgZ29vZCBlbm91Z2ggdG8gY29tcGFyZSBmaWxlUGF0aCB0byBnZW5GaWxlUGF0aCBhbmQgaWYgdGhleSBhcmUgZXF1YWxcbiAgICAgICAgICAvLyB0aGVyZSBpcyBhIHNlbGYgcmVmZXJlbmNlLiBIb3dldmVyLCBuZ2ZhY3RvcnkgZmlsZXMgZ2VuZXJhdGUgdG8gLnRzIGJ1dCB0aGVpclxuICAgICAgICAgIC8vIHN5bWJvbHMgaGF2ZSAuZC50cyBzbyBhIHNpbXBsZSBjb21wYXJlIGlzIGluc3VmZmljaWVudC4gVGhleSBzaG91bGQgYmUgY2Fub25pY2FsXG4gICAgICAgICAgLy8gYW5kIGlzIHRyYWNrZWQgYnkgIzE3NzA1LlxuICAgICAgICAgIGNvbnN0IHNlbGZSZWZlcmVuY2UgPSB0aGlzLl9maWxlTmFtZVRvTW9kdWxlTmFtZShnZW5GaWxlUGF0aCwgZ2VuRmlsZVBhdGgpO1xuICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBpbXBvcnRNb2R1bGUgPT09IHNlbGZSZWZlcmVuY2UgPyBudWxsIDogaW1wb3J0TW9kdWxlO1xuXG4gICAgICAgICAgLy8gSWYgd2UgYXJlIGluIGEgdHlwZSBleHByZXNzaW9uIHRoYXQgcmVmZXJzIHRvIGEgZ2VuZXJpYyB0eXBlIHRoZW4gc3VwcGx5XG4gICAgICAgICAgLy8gdGhlIHJlcXVpcmVkIHR5cGUgcGFyYW1ldGVycy4gSWYgdGhlcmUgd2VyZSBub3QgZW5vdWdoIHR5cGUgcGFyYW1ldGVyc1xuICAgICAgICAgIC8vIHN1cHBsaWVkLCBzdXBwbHkgYW55IGFzIHRoZSB0eXBlLiBPdXRzaWRlIGEgdHlwZSBleHByZXNzaW9uIHRoZSByZWZlcmVuY2VcbiAgICAgICAgICAvLyBzaG91bGQgbm90IHN1cHBseSB0eXBlIHBhcmFtZXRlcnMgYW5kIGJlIHRyZWF0ZWQgYXMgYSBzaW1wbGUgdmFsdWUgcmVmZXJlbmNlXG4gICAgICAgICAgLy8gdG8gdGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGl0c2VsZi5cbiAgICAgICAgICBjb25zdCBzdXBwbGllZFR5cGVQYXJhbXMgPSB0eXBlUGFyYW1zIHx8IFtdO1xuICAgICAgICAgIGNvbnN0IG1pc3NpbmdUeXBlUGFyYW1zQ291bnQgPSBhcml0eSAtIHN1cHBsaWVkVHlwZVBhcmFtcy5sZW5ndGg7XG4gICAgICAgICAgY29uc3QgYWxsVHlwZVBhcmFtcyA9XG4gICAgICAgICAgICAgIHN1cHBsaWVkVHlwZVBhcmFtcy5jb25jYXQobmV3IEFycmF5KG1pc3NpbmdUeXBlUGFyYW1zQ291bnQpLmZpbGwoby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgICAgICByZXR1cm4gbWVtYmVycy5yZWR1Y2UoXG4gICAgICAgICAgICAgIChleHByLCBtZW1iZXJOYW1lKSA9PiBleHByLnByb3AobWVtYmVyTmFtZSksXG4gICAgICAgICAgICAgIDxvLkV4cHJlc3Npb24+by5pbXBvcnRFeHByKFxuICAgICAgICAgICAgICAgICAgbmV3IG8uRXh0ZXJuYWxSZWZlcmVuY2UobW9kdWxlTmFtZSwgbmFtZSwgbnVsbCksIGFsbFR5cGVQYXJhbXMpKTtcbiAgICAgICAgfTtcblxuICAgIHJldHVybiB7c3RhdGVtZW50czogW10sIGdlbkZpbGVQYXRoLCBpbXBvcnRFeHByLCBjb25zdGFudFBvb2w6IG5ldyBDb25zdGFudFBvb2woKX07XG4gIH1cblxuICBwcml2YXRlIF9maWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fc3VtbWFyeVJlc29sdmVyLmdldEtub3duTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoKSB8fFxuICAgICAgICB0aGlzLl9zeW1ib2xSZXNvbHZlci5nZXRLbm93bk1vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCkgfHxcbiAgICAgICAgdGhpcy5faG9zdC5maWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoLCBjb250YWluaW5nRmlsZVBhdGgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29kZWdlblN0eWxlcyhcbiAgICAgIHNyY0ZpbGVVcmw6IHN0cmluZywgY29tcE1ldGE6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIHN0eWxlc2hlZXRNZXRhZGF0YTogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YSwgaXNTaGltbWVkOiBib29sZWFuLFxuICAgICAgZmlsZVN1ZmZpeDogc3RyaW5nKTogR2VuZXJhdGVkRmlsZSB7XG4gICAgY29uc3Qgb3V0cHV0Q3R4ID0gdGhpcy5fY3JlYXRlT3V0cHV0Q29udGV4dChcbiAgICAgICAgX3N0eWxlc01vZHVsZVVybChzdHlsZXNoZWV0TWV0YWRhdGEubW9kdWxlVXJsICEsIGlzU2hpbW1lZCwgZmlsZVN1ZmZpeCkpO1xuICAgIGNvbnN0IGNvbXBpbGVkU3R5bGVzaGVldCA9XG4gICAgICAgIHRoaXMuX3N0eWxlQ29tcGlsZXIuY29tcGlsZVN0eWxlcyhvdXRwdXRDdHgsIGNvbXBNZXRhLCBzdHlsZXNoZWV0TWV0YWRhdGEsIGlzU2hpbW1lZCk7XG4gICAgX3Jlc29sdmVTdHlsZVN0YXRlbWVudHModGhpcy5fc3ltYm9sUmVzb2x2ZXIsIGNvbXBpbGVkU3R5bGVzaGVldCwgaXNTaGltbWVkLCBmaWxlU3VmZml4KTtcbiAgICByZXR1cm4gdGhpcy5fY29kZWdlblNvdXJjZU1vZHVsZShzcmNGaWxlVXJsLCBvdXRwdXRDdHgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29kZWdlblNvdXJjZU1vZHVsZShzcmNGaWxlVXJsOiBzdHJpbmcsIGN0eDogT3V0cHV0Q29udGV4dCk6IEdlbmVyYXRlZEZpbGUge1xuICAgIHJldHVybiBuZXcgR2VuZXJhdGVkRmlsZShzcmNGaWxlVXJsLCBjdHguZ2VuRmlsZVBhdGgsIGN0eC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGxpc3RMYXp5Um91dGVzKGVudHJ5Um91dGU/OiBzdHJpbmcsIGFuYWx5emVkTW9kdWxlcz86IE5nQW5hbHl6ZWRNb2R1bGVzKTogTGF6eVJvdXRlW10ge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChlbnRyeVJvdXRlKSB7XG4gICAgICBjb25zdCBzeW1ib2wgPSBwYXJzZUxhenlSb3V0ZShlbnRyeVJvdXRlLCB0aGlzLnJlZmxlY3RvcikucmVmZXJlbmNlZE1vZHVsZTtcbiAgICAgIHJldHVybiB2aXNpdExhenlSb3V0ZShzeW1ib2wpO1xuICAgIH0gZWxzZSBpZiAoYW5hbHl6ZWRNb2R1bGVzKSB7XG4gICAgICBjb25zdCBhbGxMYXp5Um91dGVzOiBMYXp5Um91dGVbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBuZ01vZHVsZSBvZiBhbmFseXplZE1vZHVsZXMubmdNb2R1bGVzKSB7XG4gICAgICAgIGNvbnN0IGxhenlSb3V0ZXMgPSBsaXN0TGF6eVJvdXRlcyhuZ01vZHVsZSwgdGhpcy5yZWZsZWN0b3IpO1xuICAgICAgICBmb3IgKGNvbnN0IGxhenlSb3V0ZSBvZiBsYXp5Um91dGVzKSB7XG4gICAgICAgICAgYWxsTGF6eVJvdXRlcy5wdXNoKGxhenlSb3V0ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBhbGxMYXp5Um91dGVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVpdGhlciByb3V0ZSBvciBhbmFseXplZE1vZHVsZXMgaGFzIHRvIGJlIHNwZWNpZmllZCFgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2aXNpdExhenlSb3V0ZShcbiAgICAgICAgc3ltYm9sOiBTdGF0aWNTeW1ib2wsIHNlZW5Sb3V0ZXMgPSBuZXcgU2V0PFN0YXRpY1N5bWJvbD4oKSxcbiAgICAgICAgYWxsTGF6eVJvdXRlczogTGF6eVJvdXRlW10gPSBbXSk6IExhenlSb3V0ZVtdIHtcbiAgICAgIC8vIFN1cHBvcnQgcG9pbnRpbmcgdG8gZGVmYXVsdCBleHBvcnRzLCBidXQgc3RvcCByZWN1cnNpbmcgdGhlcmUsXG4gICAgICAvLyBhcyB0aGUgU3RhdGljUmVmbGVjdG9yIGRvZXMgbm90IHlldCBzdXBwb3J0IGRlZmF1bHQgZXhwb3J0cy5cbiAgICAgIGlmIChzZWVuUm91dGVzLmhhcyhzeW1ib2wpIHx8ICFzeW1ib2wubmFtZSkge1xuICAgICAgICByZXR1cm4gYWxsTGF6eVJvdXRlcztcbiAgICAgIH1cbiAgICAgIHNlZW5Sb3V0ZXMuYWRkKHN5bWJvbCk7XG4gICAgICBjb25zdCBsYXp5Um91dGVzID0gbGlzdExhenlSb3V0ZXMoXG4gICAgICAgICAgc2VsZi5fbWV0YWRhdGFSZXNvbHZlci5nZXROZ01vZHVsZU1ldGFkYXRhKHN5bWJvbCwgdHJ1ZSkgISwgc2VsZi5yZWZsZWN0b3IpO1xuICAgICAgZm9yIChjb25zdCBsYXp5Um91dGUgb2YgbGF6eVJvdXRlcykge1xuICAgICAgICBhbGxMYXp5Um91dGVzLnB1c2gobGF6eVJvdXRlKTtcbiAgICAgICAgdmlzaXRMYXp5Um91dGUobGF6eVJvdXRlLnJlZmVyZW5jZWRNb2R1bGUsIHNlZW5Sb3V0ZXMsIGFsbExhenlSb3V0ZXMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExhenlSb3V0ZXM7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVFbXB0eVN0dWIob3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KSB7XG4gIC8vIE5vdGU6IFdlIG5lZWQgdG8gcHJvZHVjZSBhdCBsZWFzdCBvbmUgaW1wb3J0IHN0YXRlbWVudCBzbyB0aGF0XG4gIC8vIFR5cGVTY3JpcHQga25vd3MgdGhhdCB0aGUgZmlsZSBpcyBhbiBlczYgbW9kdWxlLiBPdGhlcndpc2Ugb3VyIGdlbmVyYXRlZFxuICAvLyBleHBvcnRzIC8gaW1wb3J0cyB3b24ndCBiZSBlbWl0dGVkIHByb3Blcmx5IGJ5IFR5cGVTY3JpcHQuXG4gIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2goby5pbXBvcnRFeHByKElkZW50aWZpZXJzLkNvbXBvbmVudEZhY3RvcnkpLnRvU3RtdCgpKTtcbn1cblxuXG5mdW5jdGlvbiBfcmVzb2x2ZVN0eWxlU3RhdGVtZW50cyhcbiAgICBzeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXIsIGNvbXBpbGVSZXN1bHQ6IENvbXBpbGVkU3R5bGVzaGVldCwgbmVlZHNTaGltOiBib29sZWFuLFxuICAgIGZpbGVTdWZmaXg6IHN0cmluZyk6IHZvaWQge1xuICBjb21waWxlUmVzdWx0LmRlcGVuZGVuY2llcy5mb3JFYWNoKChkZXApID0+IHtcbiAgICBkZXAuc2V0VmFsdWUoc3ltYm9sUmVzb2x2ZXIuZ2V0U3RhdGljU3ltYm9sKFxuICAgICAgICBfc3R5bGVzTW9kdWxlVXJsKGRlcC5tb2R1bGVVcmwsIG5lZWRzU2hpbSwgZmlsZVN1ZmZpeCksIGRlcC5uYW1lKSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfc3R5bGVzTW9kdWxlVXJsKHN0eWxlc2hlZXRVcmw6IHN0cmluZywgc2hpbTogYm9vbGVhbiwgc3VmZml4OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7c3R5bGVzaGVldFVybH0ke3NoaW0gPyAnLnNoaW0nIDogJyd9Lm5nc3R5bGUke3N1ZmZpeH1gO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5nQW5hbHl6ZWRNb2R1bGVzIHtcbiAgbmdNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YVtdO1xuICBuZ01vZHVsZUJ5UGlwZU9yRGlyZWN0aXZlOiBNYXA8U3RhdGljU3ltYm9sLCBDb21waWxlTmdNb2R1bGVNZXRhZGF0YT47XG4gIGZpbGVzOiBOZ0FuYWx5emVkRmlsZVtdO1xuICBzeW1ib2xzTWlzc2luZ01vZHVsZT86IFN0YXRpY1N5bWJvbFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzIHtcbiAgZmlsZU5hbWU6IHN0cmluZztcbiAgaW5qZWN0YWJsZXM6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGFbXTtcbiAgc2hhbGxvd01vZHVsZXM6IENvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGFbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOZ0FuYWx5emVkRmlsZSB7XG4gIGZpbGVOYW1lOiBzdHJpbmc7XG4gIGRpcmVjdGl2ZXM6IFN0YXRpY1N5bWJvbFtdO1xuICBwaXBlczogU3RhdGljU3ltYm9sW107XG4gIG5nTW9kdWxlczogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGFbXTtcbiAgaW5qZWN0YWJsZXM6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGFbXTtcbiAgZXhwb3J0c05vblNvdXJjZUZpbGVzOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5nQW5hbHl6ZU1vZHVsZXNIb3N0IHsgaXNTb3VyY2VGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuOyB9XG5cbmV4cG9ydCBmdW5jdGlvbiBhbmFseXplTmdNb2R1bGVzKFxuICAgIGZpbGVOYW1lczogc3RyaW5nW10sIGhvc3Q6IE5nQW5hbHl6ZU1vZHVsZXNIb3N0LCBzdGF0aWNTeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXIsXG4gICAgbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIpOiBOZ0FuYWx5emVkTW9kdWxlcyB7XG4gIGNvbnN0IGZpbGVzID0gX2FuYWx5emVGaWxlc0luY2x1ZGluZ05vblByb2dyYW1GaWxlcyhcbiAgICAgIGZpbGVOYW1lcywgaG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXIsIG1ldGFkYXRhUmVzb2x2ZXIpO1xuICByZXR1cm4gbWVyZ2VBbmFseXplZEZpbGVzKGZpbGVzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVBbmRWYWxpZGF0ZU5nTW9kdWxlcyhcbiAgICBmaWxlTmFtZXM6IHN0cmluZ1tdLCBob3N0OiBOZ0FuYWx5emVNb2R1bGVzSG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgIG1ldGFkYXRhUmVzb2x2ZXI6IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyKTogTmdBbmFseXplZE1vZHVsZXMge1xuICByZXR1cm4gdmFsaWRhdGVBbmFseXplZE1vZHVsZXMoXG4gICAgICBhbmFseXplTmdNb2R1bGVzKGZpbGVOYW1lcywgaG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXIsIG1ldGFkYXRhUmVzb2x2ZXIpKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVBbmFseXplZE1vZHVsZXMoYW5hbHl6ZWRNb2R1bGVzOiBOZ0FuYWx5emVkTW9kdWxlcyk6IE5nQW5hbHl6ZWRNb2R1bGVzIHtcbiAgaWYgKGFuYWx5emVkTW9kdWxlcy5zeW1ib2xzTWlzc2luZ01vZHVsZSAmJiBhbmFseXplZE1vZHVsZXMuc3ltYm9sc01pc3NpbmdNb2R1bGUubGVuZ3RoKSB7XG4gICAgY29uc3QgbWVzc2FnZXMgPSBhbmFseXplZE1vZHVsZXMuc3ltYm9sc01pc3NpbmdNb2R1bGUubWFwKFxuICAgICAgICBzID0+XG4gICAgICAgICAgICBgQ2Fubm90IGRldGVybWluZSB0aGUgbW9kdWxlIGZvciBjbGFzcyAke3MubmFtZX0gaW4gJHtzLmZpbGVQYXRofSEgQWRkICR7cy5uYW1lfSB0byB0aGUgTmdNb2R1bGUgdG8gZml4IGl0LmApO1xuICAgIHRocm93IHN5bnRheEVycm9yKG1lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxuICByZXR1cm4gYW5hbHl6ZWRNb2R1bGVzO1xufVxuXG4vLyBBbmFseXplcyBhbGwgb2YgdGhlIHByb2dyYW0gZmlsZXMsXG4vLyBpbmNsdWRpbmcgZmlsZXMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIHByb2dyYW1cbi8vIGJ1dCBhcmUgcmVmZXJlbmNlZCBieSBhbiBOZ01vZHVsZS5cbmZ1bmN0aW9uIF9hbmFseXplRmlsZXNJbmNsdWRpbmdOb25Qcm9ncmFtRmlsZXMoXG4gICAgZmlsZU5hbWVzOiBzdHJpbmdbXSwgaG9zdDogTmdBbmFseXplTW9kdWxlc0hvc3QsIHN0YXRpY1N5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlcixcbiAgICBtZXRhZGF0YVJlc29sdmVyOiBDb21waWxlTWV0YWRhdGFSZXNvbHZlcik6IE5nQW5hbHl6ZWRGaWxlW10ge1xuICBjb25zdCBzZWVuRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZmlsZXM6IE5nQW5hbHl6ZWRGaWxlW10gPSBbXTtcblxuICBjb25zdCB2aXNpdEZpbGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChzZWVuRmlsZXMuaGFzKGZpbGVOYW1lKSB8fCAhaG9zdC5pc1NvdXJjZUZpbGUoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHNlZW5GaWxlcy5hZGQoZmlsZU5hbWUpO1xuICAgIGNvbnN0IGFuYWx5emVkRmlsZSA9IGFuYWx5emVGaWxlKGhvc3QsIHN0YXRpY1N5bWJvbFJlc29sdmVyLCBtZXRhZGF0YVJlc29sdmVyLCBmaWxlTmFtZSk7XG4gICAgZmlsZXMucHVzaChhbmFseXplZEZpbGUpO1xuICAgIGFuYWx5emVkRmlsZS5uZ01vZHVsZXMuZm9yRWFjaChuZ01vZHVsZSA9PiB7XG4gICAgICBuZ01vZHVsZS50cmFuc2l0aXZlTW9kdWxlLm1vZHVsZXMuZm9yRWFjaChtb2RNZXRhID0+IHZpc2l0RmlsZShtb2RNZXRhLnJlZmVyZW5jZS5maWxlUGF0aCkpO1xuICAgIH0pO1xuICB9O1xuICBmaWxlTmFtZXMuZm9yRWFjaCgoZmlsZU5hbWUpID0+IHZpc2l0RmlsZShmaWxlTmFtZSkpO1xuICByZXR1cm4gZmlsZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhbmFseXplRmlsZShcbiAgICBob3N0OiBOZ0FuYWx5emVNb2R1bGVzSG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgIG1ldGFkYXRhUmVzb2x2ZXI6IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyLCBmaWxlTmFtZTogc3RyaW5nKTogTmdBbmFseXplZEZpbGUge1xuICBjb25zdCBkaXJlY3RpdmVzOiBTdGF0aWNTeW1ib2xbXSA9IFtdO1xuICBjb25zdCBwaXBlczogU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgY29uc3QgaW5qZWN0YWJsZXM6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGFbXSA9IFtdO1xuICBjb25zdCBuZ01vZHVsZXM6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhW10gPSBbXTtcbiAgY29uc3QgaGFzRGVjb3JhdG9ycyA9IHN0YXRpY1N5bWJvbFJlc29sdmVyLmhhc0RlY29yYXRvcnMoZmlsZU5hbWUpO1xuICBsZXQgZXhwb3J0c05vblNvdXJjZUZpbGVzID0gZmFsc2U7XG4gIC8vIERvbid0IGFuYWx5emUgLmQudHMgZmlsZXMgdGhhdCBoYXZlIG5vIGRlY29yYXRvcnMgYXMgYSBzaG9ydGN1dFxuICAvLyB0byBzcGVlZCB1cCB0aGUgYW5hbHlzaXMuIFRoaXMgcHJldmVudHMgdXMgZnJvbVxuICAvLyByZXNvbHZpbmcgdGhlIHJlZmVyZW5jZXMgaW4gdGhlc2UgZmlsZXMuXG4gIC8vIE5vdGU6IGV4cG9ydHNOb25Tb3VyY2VGaWxlcyBpcyBvbmx5IG5lZWRlZCB3aGVuIGNvbXBpbGluZyB3aXRoIHN1bW1hcmllcyxcbiAgLy8gd2hpY2ggaXMgbm90IHRoZSBjYXNlIHdoZW4gLmQudHMgZmlsZXMgYXJlIHRyZWF0ZWQgYXMgaW5wdXQgZmlsZXMuXG4gIGlmICghZmlsZU5hbWUuZW5kc1dpdGgoJy5kLnRzJykgfHwgaGFzRGVjb3JhdG9ycykge1xuICAgIHN0YXRpY1N5bWJvbFJlc29sdmVyLmdldFN5bWJvbHNPZihmaWxlTmFtZSkuZm9yRWFjaCgoc3ltYm9sKSA9PiB7XG4gICAgICBjb25zdCByZXNvbHZlZFN5bWJvbCA9IHN0YXRpY1N5bWJvbFJlc29sdmVyLnJlc29sdmVTeW1ib2woc3ltYm9sKTtcbiAgICAgIGNvbnN0IHN5bWJvbE1ldGEgPSByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YTtcbiAgICAgIGlmICghc3ltYm9sTWV0YSB8fCBzeW1ib2xNZXRhLl9fc3ltYm9saWMgPT09ICdlcnJvcicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbGV0IGlzTmdTeW1ib2wgPSBmYWxzZTtcbiAgICAgIGlmIChzeW1ib2xNZXRhLl9fc3ltYm9saWMgPT09ICdjbGFzcycpIHtcbiAgICAgICAgaWYgKG1ldGFkYXRhUmVzb2x2ZXIuaXNEaXJlY3RpdmUoc3ltYm9sKSkge1xuICAgICAgICAgIGlzTmdTeW1ib2wgPSB0cnVlO1xuICAgICAgICAgIGRpcmVjdGl2ZXMucHVzaChzeW1ib2wpO1xuICAgICAgICB9IGVsc2UgaWYgKG1ldGFkYXRhUmVzb2x2ZXIuaXNQaXBlKHN5bWJvbCkpIHtcbiAgICAgICAgICBpc05nU3ltYm9sID0gdHJ1ZTtcbiAgICAgICAgICBwaXBlcy5wdXNoKHN5bWJvbCk7XG4gICAgICAgIH0gZWxzZSBpZiAobWV0YWRhdGFSZXNvbHZlci5pc05nTW9kdWxlKHN5bWJvbCkpIHtcbiAgICAgICAgICBjb25zdCBuZ01vZHVsZSA9IG1ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShzeW1ib2wsIGZhbHNlKTtcbiAgICAgICAgICBpZiAobmdNb2R1bGUpIHtcbiAgICAgICAgICAgIGlzTmdTeW1ib2wgPSB0cnVlO1xuICAgICAgICAgICAgbmdNb2R1bGVzLnB1c2gobmdNb2R1bGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChtZXRhZGF0YVJlc29sdmVyLmlzSW5qZWN0YWJsZShzeW1ib2wpKSB7XG4gICAgICAgICAgaXNOZ1N5bWJvbCA9IHRydWU7XG4gICAgICAgICAgY29uc3QgaW5qZWN0YWJsZSA9IG1ldGFkYXRhUmVzb2x2ZXIuZ2V0SW5qZWN0YWJsZU1ldGFkYXRhKHN5bWJvbCwgbnVsbCwgZmFsc2UpO1xuICAgICAgICAgIGlmIChpbmplY3RhYmxlKSB7XG4gICAgICAgICAgICBpbmplY3RhYmxlcy5wdXNoKGluamVjdGFibGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFpc05nU3ltYm9sKSB7XG4gICAgICAgIGV4cG9ydHNOb25Tb3VyY2VGaWxlcyA9XG4gICAgICAgICAgICBleHBvcnRzTm9uU291cmNlRmlsZXMgfHwgaXNWYWx1ZUV4cG9ydGluZ05vblNvdXJjZUZpbGUoaG9zdCwgc3ltYm9sTWV0YSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICAgIGZpbGVOYW1lLCBkaXJlY3RpdmVzLCBwaXBlcywgbmdNb2R1bGVzLCBpbmplY3RhYmxlcywgZXhwb3J0c05vblNvdXJjZUZpbGVzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZUZpbGVGb3JJbmplY3RhYmxlcyhcbiAgICBob3N0OiBOZ0FuYWx5emVNb2R1bGVzSG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgIG1ldGFkYXRhUmVzb2x2ZXI6IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyLCBmaWxlTmFtZTogc3RyaW5nKTogTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXMge1xuICBjb25zdCBpbmplY3RhYmxlczogQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YVtdID0gW107XG4gIGNvbnN0IHNoYWxsb3dNb2R1bGVzOiBDb21waWxlU2hhbGxvd01vZHVsZU1ldGFkYXRhW10gPSBbXTtcbiAgaWYgKHN0YXRpY1N5bWJvbFJlc29sdmVyLmhhc0RlY29yYXRvcnMoZmlsZU5hbWUpKSB7XG4gICAgc3RhdGljU3ltYm9sUmVzb2x2ZXIuZ2V0U3ltYm9sc09mKGZpbGVOYW1lKS5mb3JFYWNoKChzeW1ib2wpID0+IHtcbiAgICAgIGNvbnN0IHJlc29sdmVkU3ltYm9sID0gc3RhdGljU3ltYm9sUmVzb2x2ZXIucmVzb2x2ZVN5bWJvbChzeW1ib2wpO1xuICAgICAgY29uc3Qgc3ltYm9sTWV0YSA9IHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhO1xuICAgICAgaWYgKCFzeW1ib2xNZXRhIHx8IHN5bWJvbE1ldGEuX19zeW1ib2xpYyA9PT0gJ2Vycm9yJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoc3ltYm9sTWV0YS5fX3N5bWJvbGljID09PSAnY2xhc3MnKSB7XG4gICAgICAgIGlmIChtZXRhZGF0YVJlc29sdmVyLmlzSW5qZWN0YWJsZShzeW1ib2wpKSB7XG4gICAgICAgICAgY29uc3QgaW5qZWN0YWJsZSA9IG1ldGFkYXRhUmVzb2x2ZXIuZ2V0SW5qZWN0YWJsZU1ldGFkYXRhKHN5bWJvbCwgbnVsbCwgZmFsc2UpO1xuICAgICAgICAgIGlmIChpbmplY3RhYmxlKSB7XG4gICAgICAgICAgICBpbmplY3RhYmxlcy5wdXNoKGluamVjdGFibGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChtZXRhZGF0YVJlc29sdmVyLmlzTmdNb2R1bGUoc3ltYm9sKSkge1xuICAgICAgICAgIGNvbnN0IG1vZHVsZSA9IG1ldGFkYXRhUmVzb2x2ZXIuZ2V0U2hhbGxvd01vZHVsZU1ldGFkYXRhKHN5bWJvbCk7XG4gICAgICAgICAgaWYgKG1vZHVsZSkge1xuICAgICAgICAgICAgc2hhbGxvd01vZHVsZXMucHVzaChtb2R1bGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB7ZmlsZU5hbWUsIGluamVjdGFibGVzLCBzaGFsbG93TW9kdWxlc307XG59XG5cbmZ1bmN0aW9uIGlzVmFsdWVFeHBvcnRpbmdOb25Tb3VyY2VGaWxlKGhvc3Q6IE5nQW5hbHl6ZU1vZHVsZXNIb3N0LCBtZXRhZGF0YTogYW55KTogYm9vbGVhbiB7XG4gIGxldCBleHBvcnRzTm9uU291cmNlRmlsZXMgPSBmYWxzZTtcblxuICBjbGFzcyBWaXNpdG9yIGltcGxlbWVudHMgVmFsdWVWaXNpdG9yIHtcbiAgICB2aXNpdEFycmF5KGFycjogYW55W10sIGNvbnRleHQ6IGFueSk6IGFueSB7IGFyci5mb3JFYWNoKHYgPT4gdmlzaXRWYWx1ZSh2LCB0aGlzLCBjb250ZXh0KSk7IH1cbiAgICB2aXNpdFN0cmluZ01hcChtYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgICAgT2JqZWN0LmtleXMobWFwKS5mb3JFYWNoKChrZXkpID0+IHZpc2l0VmFsdWUobWFwW2tleV0sIHRoaXMsIGNvbnRleHQpKTtcbiAgICB9XG4gICAgdmlzaXRQcmltaXRpdmUodmFsdWU6IGFueSwgY29udGV4dDogYW55KTogYW55IHt9XG4gICAgdmlzaXRPdGhlcih2YWx1ZTogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sICYmICFob3N0LmlzU291cmNlRmlsZSh2YWx1ZS5maWxlUGF0aCkpIHtcbiAgICAgICAgZXhwb3J0c05vblNvdXJjZUZpbGVzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB2aXNpdFZhbHVlKG1ldGFkYXRhLCBuZXcgVmlzaXRvcigpLCBudWxsKTtcbiAgcmV0dXJuIGV4cG9ydHNOb25Tb3VyY2VGaWxlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlQW5hbHl6ZWRGaWxlcyhhbmFseXplZEZpbGVzOiBOZ0FuYWx5emVkRmlsZVtdKTogTmdBbmFseXplZE1vZHVsZXMge1xuICBjb25zdCBhbGxOZ01vZHVsZXM6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhW10gPSBbXTtcbiAgY29uc3QgbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBDb21waWxlTmdNb2R1bGVNZXRhZGF0YT4oKTtcbiAgY29uc3QgYWxsUGlwZXNBbmREaXJlY3RpdmVzID0gbmV3IFNldDxTdGF0aWNTeW1ib2w+KCk7XG5cbiAgYW5hbHl6ZWRGaWxlcy5mb3JFYWNoKGFmID0+IHtcbiAgICBhZi5uZ01vZHVsZXMuZm9yRWFjaChuZ01vZHVsZSA9PiB7XG4gICAgICBhbGxOZ01vZHVsZXMucHVzaChuZ01vZHVsZSk7XG4gICAgICBuZ01vZHVsZS5kZWNsYXJlZERpcmVjdGl2ZXMuZm9yRWFjaChcbiAgICAgICAgICBkID0+IG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUuc2V0KGQucmVmZXJlbmNlLCBuZ01vZHVsZSkpO1xuICAgICAgbmdNb2R1bGUuZGVjbGFyZWRQaXBlcy5mb3JFYWNoKHAgPT4gbmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZS5zZXQocC5yZWZlcmVuY2UsIG5nTW9kdWxlKSk7XG4gICAgfSk7XG4gICAgYWYuZGlyZWN0aXZlcy5mb3JFYWNoKGQgPT4gYWxsUGlwZXNBbmREaXJlY3RpdmVzLmFkZChkKSk7XG4gICAgYWYucGlwZXMuZm9yRWFjaChwID0+IGFsbFBpcGVzQW5kRGlyZWN0aXZlcy5hZGQocCkpO1xuICB9KTtcblxuICBjb25zdCBzeW1ib2xzTWlzc2luZ01vZHVsZTogU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgYWxsUGlwZXNBbmREaXJlY3RpdmVzLmZvckVhY2gocmVmID0+IHtcbiAgICBpZiAoIW5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUuaGFzKHJlZikpIHtcbiAgICAgIHN5bWJvbHNNaXNzaW5nTW9kdWxlLnB1c2gocmVmKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4ge1xuICAgIG5nTW9kdWxlczogYWxsTmdNb2R1bGVzLFxuICAgIG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmUsXG4gICAgc3ltYm9sc01pc3NpbmdNb2R1bGUsXG4gICAgZmlsZXM6IGFuYWx5emVkRmlsZXNcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VBbmRWYWxpZGF0ZU5nRmlsZXMoZmlsZXM6IE5nQW5hbHl6ZWRGaWxlW10pOiBOZ0FuYWx5emVkTW9kdWxlcyB7XG4gIHJldHVybiB2YWxpZGF0ZUFuYWx5emVkTW9kdWxlcyhtZXJnZUFuYWx5emVkRmlsZXMoZmlsZXMpKTtcbn1cbiJdfQ==