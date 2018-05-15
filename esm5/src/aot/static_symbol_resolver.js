/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { ValueTransformer, visitValue } from '../util';
import { StaticSymbol } from './static_symbol';
import { isGeneratedFile, stripSummaryForJitFileSuffix, stripSummaryForJitNameSuffix, summaryForJitFileName, summaryForJitName } from './util';
var DTS = /\.d\.ts$/;
var TS = /^(?!.*\.d\.ts$).*\.ts$/;
var ResolvedStaticSymbol = /** @class */ (function () {
    function ResolvedStaticSymbol(symbol, metadata) {
        this.symbol = symbol;
        this.metadata = metadata;
    }
    return ResolvedStaticSymbol;
}());
export { ResolvedStaticSymbol };
var SUPPORTED_SCHEMA_VERSION = 4;
/**
 * This class is responsible for loading metadata per symbol,
 * and normalizing references between symbols.
 *
 * Internally, it only uses symbols without members,
 * and deduces the values for symbols with members based
 * on these symbols.
 */
var StaticSymbolResolver = /** @class */ (function () {
    function StaticSymbolResolver(host, staticSymbolCache, summaryResolver, errorRecorder) {
        this.host = host;
        this.staticSymbolCache = staticSymbolCache;
        this.summaryResolver = summaryResolver;
        this.errorRecorder = errorRecorder;
        this.metadataCache = new Map();
        // Note: this will only contain StaticSymbols without members!
        this.resolvedSymbols = new Map();
        this.resolvedFilePaths = new Set();
        // Note: this will only contain StaticSymbols without members!
        this.importAs = new Map();
        this.symbolResourcePaths = new Map();
        this.symbolFromFile = new Map();
        this.knownFileNameToModuleNames = new Map();
    }
    StaticSymbolResolver.prototype.resolveSymbol = function (staticSymbol) {
        if (staticSymbol.members.length > 0) {
            return this._resolveSymbolMembers(staticSymbol);
        }
        // Note: always ask for a summary first,
        // as we might have read shallow metadata via a .d.ts file
        // for the symbol.
        var resultFromSummary = this._resolveSymbolFromSummary(staticSymbol);
        if (resultFromSummary) {
            return resultFromSummary;
        }
        var resultFromCache = this.resolvedSymbols.get(staticSymbol);
        if (resultFromCache) {
            return resultFromCache;
        }
        // Note: Some users use libraries that were not compiled with ngc, i.e. they don't
        // have summaries, only .d.ts files. So we always need to check both, the summary
        // and metadata.
        this._createSymbolsOf(staticSymbol.filePath);
        return this.resolvedSymbols.get(staticSymbol);
    };
    /**
     * getImportAs produces a symbol that can be used to import the given symbol.
     * The import might be different than the symbol if the symbol is exported from
     * a library with a summary; in which case we want to import the symbol from the
     * ngfactory re-export instead of directly to avoid introducing a direct dependency
     * on an otherwise indirect dependency.
     *
     * @param staticSymbol the symbol for which to generate a import symbol
     */
    StaticSymbolResolver.prototype.getImportAs = function (staticSymbol, useSummaries) {
        if (useSummaries === void 0) { useSummaries = true; }
        if (staticSymbol.members.length) {
            var baseSymbol = this.getStaticSymbol(staticSymbol.filePath, staticSymbol.name);
            var baseImportAs = this.getImportAs(baseSymbol, useSummaries);
            return baseImportAs ?
                this.getStaticSymbol(baseImportAs.filePath, baseImportAs.name, staticSymbol.members) :
                null;
        }
        var summarizedFileName = stripSummaryForJitFileSuffix(staticSymbol.filePath);
        if (summarizedFileName !== staticSymbol.filePath) {
            var summarizedName = stripSummaryForJitNameSuffix(staticSymbol.name);
            var baseSymbol = this.getStaticSymbol(summarizedFileName, summarizedName, staticSymbol.members);
            var baseImportAs = this.getImportAs(baseSymbol, useSummaries);
            return baseImportAs ?
                this.getStaticSymbol(summaryForJitFileName(baseImportAs.filePath), summaryForJitName(baseImportAs.name), baseSymbol.members) :
                null;
        }
        var result = (useSummaries && this.summaryResolver.getImportAs(staticSymbol)) || null;
        if (!result) {
            result = this.importAs.get(staticSymbol);
        }
        return result;
    };
    /**
     * getResourcePath produces the path to the original location of the symbol and should
     * be used to determine the relative location of resource references recorded in
     * symbol metadata.
     */
    StaticSymbolResolver.prototype.getResourcePath = function (staticSymbol) {
        return this.symbolResourcePaths.get(staticSymbol) || staticSymbol.filePath;
    };
    /**
     * getTypeArity returns the number of generic type parameters the given symbol
     * has. If the symbol is not a type the result is null.
     */
    StaticSymbolResolver.prototype.getTypeArity = function (staticSymbol) {
        // If the file is a factory/ngsummary file, don't resolve the symbol as doing so would
        // cause the metadata for an factory/ngsummary file to be loaded which doesn't exist.
        // All references to generated classes must include the correct arity whenever
        // generating code.
        if (isGeneratedFile(staticSymbol.filePath)) {
            return null;
        }
        var resolvedSymbol = unwrapResolvedMetadata(this.resolveSymbol(staticSymbol));
        while (resolvedSymbol && resolvedSymbol.metadata instanceof StaticSymbol) {
            resolvedSymbol = unwrapResolvedMetadata(this.resolveSymbol(resolvedSymbol.metadata));
        }
        return (resolvedSymbol && resolvedSymbol.metadata && resolvedSymbol.metadata.arity) || null;
    };
    StaticSymbolResolver.prototype.getKnownModuleName = function (filePath) {
        return this.knownFileNameToModuleNames.get(filePath) || null;
    };
    StaticSymbolResolver.prototype.recordImportAs = function (sourceSymbol, targetSymbol) {
        sourceSymbol.assertNoMembers();
        targetSymbol.assertNoMembers();
        this.importAs.set(sourceSymbol, targetSymbol);
    };
    StaticSymbolResolver.prototype.recordModuleNameForFileName = function (fileName, moduleName) {
        this.knownFileNameToModuleNames.set(fileName, moduleName);
    };
    /**
     * Invalidate all information derived from the given file.
     *
     * @param fileName the file to invalidate
     */
    StaticSymbolResolver.prototype.invalidateFile = function (fileName) {
        this.metadataCache.delete(fileName);
        this.resolvedFilePaths.delete(fileName);
        var symbols = this.symbolFromFile.get(fileName);
        if (symbols) {
            this.symbolFromFile.delete(fileName);
            try {
                for (var symbols_1 = tslib_1.__values(symbols), symbols_1_1 = symbols_1.next(); !symbols_1_1.done; symbols_1_1 = symbols_1.next()) {
                    var symbol = symbols_1_1.value;
                    this.resolvedSymbols.delete(symbol);
                    this.importAs.delete(symbol);
                    this.symbolResourcePaths.delete(symbol);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (symbols_1_1 && !symbols_1_1.done && (_a = symbols_1.return)) _a.call(symbols_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        var e_1, _a;
    };
    /* @internal */
    StaticSymbolResolver.prototype.ignoreErrorsFor = function (cb) {
        var recorder = this.errorRecorder;
        this.errorRecorder = function () { };
        try {
            return cb();
        }
        finally {
            this.errorRecorder = recorder;
        }
    };
    StaticSymbolResolver.prototype._resolveSymbolMembers = function (staticSymbol) {
        var members = staticSymbol.members;
        var baseResolvedSymbol = this.resolveSymbol(this.getStaticSymbol(staticSymbol.filePath, staticSymbol.name));
        if (!baseResolvedSymbol) {
            return null;
        }
        var baseMetadata = unwrapResolvedMetadata(baseResolvedSymbol.metadata);
        if (baseMetadata instanceof StaticSymbol) {
            return new ResolvedStaticSymbol(staticSymbol, this.getStaticSymbol(baseMetadata.filePath, baseMetadata.name, members));
        }
        else if (baseMetadata && baseMetadata.__symbolic === 'class') {
            if (baseMetadata.statics && members.length === 1) {
                return new ResolvedStaticSymbol(staticSymbol, baseMetadata.statics[members[0]]);
            }
        }
        else {
            var value = baseMetadata;
            for (var i = 0; i < members.length && value; i++) {
                value = value[members[i]];
            }
            return new ResolvedStaticSymbol(staticSymbol, value);
        }
        return null;
    };
    StaticSymbolResolver.prototype._resolveSymbolFromSummary = function (staticSymbol) {
        var summary = this.summaryResolver.resolveSummary(staticSymbol);
        return summary ? new ResolvedStaticSymbol(staticSymbol, summary.metadata) : null;
    };
    /**
     * getStaticSymbol produces a Type whose metadata is known but whose implementation is not loaded.
     * All types passed to the StaticResolver should be pseudo-types returned by this method.
     *
     * @param declarationFile the absolute path of the file where the symbol is declared
     * @param name the name of the type.
     * @param members a symbol for a static member of the named type
     */
    StaticSymbolResolver.prototype.getStaticSymbol = function (declarationFile, name, members) {
        return this.staticSymbolCache.get(declarationFile, name, members);
    };
    /**
     * hasDecorators checks a file's metadata for the presence of decorators without evaluating the
     * metadata.
     *
     * @param filePath the absolute path to examine for decorators.
     * @returns true if any class in the file has a decorator.
     */
    StaticSymbolResolver.prototype.hasDecorators = function (filePath) {
        var metadata = this.getModuleMetadata(filePath);
        if (metadata['metadata']) {
            return Object.keys(metadata['metadata']).some(function (metadataKey) {
                var entry = metadata['metadata'][metadataKey];
                return entry && entry.__symbolic === 'class' && entry.decorators;
            });
        }
        return false;
    };
    StaticSymbolResolver.prototype.getSymbolsOf = function (filePath) {
        var summarySymbols = this.summaryResolver.getSymbolsOf(filePath);
        if (summarySymbols) {
            return summarySymbols;
        }
        // Note: Some users use libraries that were not compiled with ngc, i.e. they don't
        // have summaries, only .d.ts files, but `summaryResolver.isLibraryFile` returns true.
        this._createSymbolsOf(filePath);
        var metadataSymbols = [];
        this.resolvedSymbols.forEach(function (resolvedSymbol) {
            if (resolvedSymbol.symbol.filePath === filePath) {
                metadataSymbols.push(resolvedSymbol.symbol);
            }
        });
        return metadataSymbols;
    };
    StaticSymbolResolver.prototype._createSymbolsOf = function (filePath) {
        var _this = this;
        if (this.resolvedFilePaths.has(filePath)) {
            return;
        }
        this.resolvedFilePaths.add(filePath);
        var resolvedSymbols = [];
        var metadata = this.getModuleMetadata(filePath);
        if (metadata['importAs']) {
            // Index bundle indices should use the importAs module name defined
            // in the bundle.
            this.knownFileNameToModuleNames.set(filePath, metadata['importAs']);
        }
        // handle the symbols in one of the re-export location
        if (metadata['exports']) {
            var _loop_1 = function (moduleExport) {
                // handle the symbols in the list of explicitly re-exported symbols.
                if (moduleExport.export) {
                    moduleExport.export.forEach(function (exportSymbol) {
                        var symbolName;
                        if (typeof exportSymbol === 'string') {
                            symbolName = exportSymbol;
                        }
                        else {
                            symbolName = exportSymbol.as;
                        }
                        symbolName = unescapeIdentifier(symbolName);
                        var symName = symbolName;
                        if (typeof exportSymbol !== 'string') {
                            symName = unescapeIdentifier(exportSymbol.name);
                        }
                        var resolvedModule = _this.resolveModule(moduleExport.from, filePath);
                        if (resolvedModule) {
                            var targetSymbol = _this.getStaticSymbol(resolvedModule, symName);
                            var sourceSymbol = _this.getStaticSymbol(filePath, symbolName);
                            resolvedSymbols.push(_this.createExport(sourceSymbol, targetSymbol));
                        }
                    });
                }
                else {
                    // handle the symbols via export * directives.
                    var resolvedModule = this_1.resolveModule(moduleExport.from, filePath);
                    if (resolvedModule) {
                        var nestedExports = this_1.getSymbolsOf(resolvedModule);
                        nestedExports.forEach(function (targetSymbol) {
                            var sourceSymbol = _this.getStaticSymbol(filePath, targetSymbol.name);
                            resolvedSymbols.push(_this.createExport(sourceSymbol, targetSymbol));
                        });
                    }
                }
            };
            var this_1 = this;
            try {
                for (var _a = tslib_1.__values(metadata['exports']), _b = _a.next(); !_b.done; _b = _a.next()) {
                    var moduleExport = _b.value;
                    _loop_1(moduleExport);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        // handle the actual metadata. Has to be after the exports
        // as there migth be collisions in the names, and we want the symbols
        // of the current module to win ofter reexports.
        if (metadata['metadata']) {
            // handle direct declarations of the symbol
            var topLevelSymbolNames_1 = new Set(Object.keys(metadata['metadata']).map(unescapeIdentifier));
            var origins_1 = metadata['origins'] || {};
            Object.keys(metadata['metadata']).forEach(function (metadataKey) {
                var symbolMeta = metadata['metadata'][metadataKey];
                var name = unescapeIdentifier(metadataKey);
                var symbol = _this.getStaticSymbol(filePath, name);
                var origin = origins_1.hasOwnProperty(metadataKey) && origins_1[metadataKey];
                if (origin) {
                    // If the symbol is from a bundled index, use the declaration location of the
                    // symbol so relative references (such as './my.html') will be calculated
                    // correctly.
                    var originFilePath = _this.resolveModule(origin, filePath);
                    if (!originFilePath) {
                        _this.reportError(new Error("Couldn't resolve original symbol for " + origin + " from " + filePath));
                    }
                    else {
                        _this.symbolResourcePaths.set(symbol, originFilePath);
                    }
                }
                resolvedSymbols.push(_this.createResolvedSymbol(symbol, filePath, topLevelSymbolNames_1, symbolMeta));
            });
        }
        resolvedSymbols.forEach(function (resolvedSymbol) { return _this.resolvedSymbols.set(resolvedSymbol.symbol, resolvedSymbol); });
        this.symbolFromFile.set(filePath, resolvedSymbols.map(function (resolvedSymbol) { return resolvedSymbol.symbol; }));
        var e_2, _c;
    };
    StaticSymbolResolver.prototype.createResolvedSymbol = function (sourceSymbol, topLevelPath, topLevelSymbolNames, metadata) {
        var _this = this;
        // For classes that don't have Angular summaries / metadata,
        // we only keep their arity, but nothing else
        // (e.g. their constructor parameters).
        // We do this to prevent introducing deep imports
        // as we didn't generate .ngfactory.ts files with proper reexports.
        var isTsFile = TS.test(sourceSymbol.filePath);
        if (this.summaryResolver.isLibraryFile(sourceSymbol.filePath) && !isTsFile && metadata &&
            metadata['__symbolic'] === 'class') {
            var transformedMeta_1 = { __symbolic: 'class', arity: metadata.arity };
            return new ResolvedStaticSymbol(sourceSymbol, transformedMeta_1);
        }
        var _originalFileMemo;
        var getOriginalName = function () {
            if (!_originalFileMemo) {
                // Guess what hte original file name is from the reference. If it has a `.d.ts` extension
                // replace it with `.ts`. If it already has `.ts` just leave it in place. If it doesn't have
                // .ts or .d.ts, append `.ts'. Also, if it is in `node_modules`, trim the `node_module`
                // location as it is not important to finding the file.
                _originalFileMemo =
                    _this.host.getOutputName(topLevelPath.replace(/((\.ts)|(\.d\.ts)|)$/, '.ts')
                        .replace(/^.*node_modules[/\\]/, ''));
            }
            return _originalFileMemo;
        };
        var self = this;
        var ReferenceTransformer = /** @class */ (function (_super) {
            tslib_1.__extends(ReferenceTransformer, _super);
            function ReferenceTransformer() {
                return _super !== null && _super.apply(this, arguments) || this;
            }
            ReferenceTransformer.prototype.visitStringMap = function (map, functionParams) {
                var symbolic = map['__symbolic'];
                if (symbolic === 'function') {
                    var oldLen = functionParams.length;
                    functionParams.push.apply(functionParams, tslib_1.__spread((map['parameters'] || [])));
                    var result = _super.prototype.visitStringMap.call(this, map, functionParams);
                    functionParams.length = oldLen;
                    return result;
                }
                else if (symbolic === 'reference') {
                    var module = map['module'];
                    var name_1 = map['name'] ? unescapeIdentifier(map['name']) : map['name'];
                    if (!name_1) {
                        return null;
                    }
                    var filePath = void 0;
                    if (module) {
                        filePath = self.resolveModule(module, sourceSymbol.filePath);
                        if (!filePath) {
                            return {
                                __symbolic: 'error',
                                message: "Could not resolve " + module + " relative to " + sourceSymbol.filePath + ".",
                                line: map.line,
                                character: map.character,
                                fileName: getOriginalName()
                            };
                        }
                        return {
                            __symbolic: 'resolved',
                            symbol: self.getStaticSymbol(filePath, name_1),
                            line: map.line,
                            character: map.character,
                            fileName: getOriginalName()
                        };
                    }
                    else if (functionParams.indexOf(name_1) >= 0) {
                        // reference to a function parameter
                        return { __symbolic: 'reference', name: name_1 };
                    }
                    else {
                        if (topLevelSymbolNames.has(name_1)) {
                            return self.getStaticSymbol(topLevelPath, name_1);
                        }
                        // ambient value
                        null;
                    }
                }
                else if (symbolic === 'error') {
                    return tslib_1.__assign({}, map, { fileName: getOriginalName() });
                }
                else {
                    return _super.prototype.visitStringMap.call(this, map, functionParams);
                }
            };
            return ReferenceTransformer;
        }(ValueTransformer));
        var transformedMeta = visitValue(metadata, new ReferenceTransformer(), []);
        var unwrappedTransformedMeta = unwrapResolvedMetadata(transformedMeta);
        if (unwrappedTransformedMeta instanceof StaticSymbol) {
            return this.createExport(sourceSymbol, unwrappedTransformedMeta);
        }
        return new ResolvedStaticSymbol(sourceSymbol, transformedMeta);
    };
    StaticSymbolResolver.prototype.createExport = function (sourceSymbol, targetSymbol) {
        sourceSymbol.assertNoMembers();
        targetSymbol.assertNoMembers();
        if (this.summaryResolver.isLibraryFile(sourceSymbol.filePath) &&
            this.summaryResolver.isLibraryFile(targetSymbol.filePath)) {
            // This case is for an ng library importing symbols from a plain ts library
            // transitively.
            // Note: We rely on the fact that we discover symbols in the direction
            // from source files to library files
            this.importAs.set(targetSymbol, this.getImportAs(sourceSymbol) || sourceSymbol);
        }
        return new ResolvedStaticSymbol(sourceSymbol, targetSymbol);
    };
    StaticSymbolResolver.prototype.reportError = function (error, context, path) {
        if (this.errorRecorder) {
            this.errorRecorder(error, (context && context.filePath) || path);
        }
        else {
            throw error;
        }
    };
    /**
     * @param module an absolute path to a module file.
     */
    StaticSymbolResolver.prototype.getModuleMetadata = function (module) {
        var moduleMetadata = this.metadataCache.get(module);
        if (!moduleMetadata) {
            var moduleMetadatas = this.host.getMetadataFor(module);
            if (moduleMetadatas) {
                var maxVersion_1 = -1;
                moduleMetadatas.forEach(function (md) {
                    if (md && md['version'] > maxVersion_1) {
                        maxVersion_1 = md['version'];
                        moduleMetadata = md;
                    }
                });
            }
            if (!moduleMetadata) {
                moduleMetadata =
                    { __symbolic: 'module', version: SUPPORTED_SCHEMA_VERSION, module: module, metadata: {} };
            }
            if (moduleMetadata['version'] != SUPPORTED_SCHEMA_VERSION) {
                var errorMessage = moduleMetadata['version'] == 2 ?
                    "Unsupported metadata version " + moduleMetadata['version'] + " for module " + module + ". This module should be compiled with a newer version of ngc" :
                    "Metadata version mismatch for module " + module + ", found version " + moduleMetadata['version'] + ", expected " + SUPPORTED_SCHEMA_VERSION;
                this.reportError(new Error(errorMessage));
            }
            this.metadataCache.set(module, moduleMetadata);
        }
        return moduleMetadata;
    };
    StaticSymbolResolver.prototype.getSymbolByModule = function (module, symbolName, containingFile) {
        var filePath = this.resolveModule(module, containingFile);
        if (!filePath) {
            this.reportError(new Error("Could not resolve module " + module + (containingFile ? ' relative to ' +
                containingFile : '')));
            return this.getStaticSymbol("ERROR:" + module, symbolName);
        }
        return this.getStaticSymbol(filePath, symbolName);
    };
    StaticSymbolResolver.prototype.resolveModule = function (module, containingFile) {
        try {
            return this.host.moduleNameToFileName(module, containingFile);
        }
        catch (e) {
            console.error("Could not resolve module '" + module + "' relative to file " + containingFile);
            this.reportError(e, undefined, containingFile);
        }
        return null;
    };
    return StaticSymbolResolver;
}());
export { StaticSymbolResolver };
// Remove extra underscore from escaped identifier.
// See https://github.com/Microsoft/TypeScript/blob/master/src/compiler/utilities.ts
export function unescapeIdentifier(identifier) {
    return identifier.startsWith('___') ? identifier.substr(1) : identifier;
}
export function unwrapResolvedMetadata(metadata) {
    if (metadata && metadata.__symbolic === 'resolved') {
        return metadata.symbol;
    }
    return metadata;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3N5bWJvbF9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3RhdGljX3N5bWJvbF9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBR0gsT0FBTyxFQUFDLGdCQUFnQixFQUFFLFVBQVUsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVyRCxPQUFPLEVBQUMsWUFBWSxFQUFvQixNQUFNLGlCQUFpQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyxlQUFlLEVBQUUsNEJBQTRCLEVBQUUsNEJBQTRCLEVBQUUscUJBQXFCLEVBQUUsaUJBQWlCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFN0ksSUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDO0FBQ3ZCLElBQU0sRUFBRSxHQUFHLHdCQUF3QixDQUFDO0FBRXBDO0lBQ0UsOEJBQW1CLE1BQW9CLEVBQVMsUUFBYTtRQUExQyxXQUFNLEdBQU4sTUFBTSxDQUFjO1FBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBSztJQUFHLENBQUM7SUFDbkUsMkJBQUM7QUFBRCxDQUFDLEFBRkQsSUFFQzs7QUFpQ0QsSUFBTSx3QkFBd0IsR0FBRyxDQUFDLENBQUM7QUFFbkM7Ozs7Ozs7R0FPRztBQUNIO0lBV0UsOEJBQ1ksSUFBOEIsRUFBVSxpQkFBb0MsRUFDNUUsZUFBOEMsRUFDOUMsYUFBdUQ7UUFGdkQsU0FBSSxHQUFKLElBQUksQ0FBMEI7UUFBVSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBQzVFLG9CQUFlLEdBQWYsZUFBZSxDQUErQjtRQUM5QyxrQkFBYSxHQUFiLGFBQWEsQ0FBMEM7UUFiM0Qsa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztRQUNoRSw4REFBOEQ7UUFDdEQsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBc0MsQ0FBQztRQUNoRSxzQkFBaUIs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ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdW1tYXJ5UmVzb2x2ZXJ9IGZyb20gJy4uL3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtWYWx1ZVRyYW5zZm9ybWVyLCB2aXNpdFZhbHVlfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtTdGF0aWNTeW1ib2wsIFN0YXRpY1N5bWJvbENhY2hlfSBmcm9tICcuL3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtpc0dlbmVyYXRlZEZpbGUsIHN0cmlwU3VtbWFyeUZvckppdEZpbGVTdWZmaXgsIHN0cmlwU3VtbWFyeUZvckppdE5hbWVTdWZmaXgsIHN1bW1hcnlGb3JKaXRGaWxlTmFtZSwgc3VtbWFyeUZvckppdE5hbWV9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IERUUyA9IC9cXC5kXFwudHMkLztcbmNvbnN0IFRTID0gL14oPyEuKlxcLmRcXC50cyQpLipcXC50cyQvO1xuXG5leHBvcnQgY2xhc3MgUmVzb2x2ZWRTdGF0aWNTeW1ib2wge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3ltYm9sOiBTdGF0aWNTeW1ib2wsIHB1YmxpYyBtZXRhZGF0YTogYW55KSB7fVxufVxuXG4vKipcbiAqIFRoZSBob3N0IG9mIHRoZSBTeW1ib2xSZXNvbHZlckhvc3QgZGlzY29ubmVjdHMgdGhlIGltcGxlbWVudGF0aW9uIGZyb20gVHlwZVNjcmlwdCAvIG90aGVyXG4gKiBsYW5ndWFnZVxuICogc2VydmljZXMgYW5kIGZyb20gdW5kZXJseWluZyBmaWxlIHN5c3RlbXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdGljU3ltYm9sUmVzb2x2ZXJIb3N0IHtcbiAgLyoqXG4gICAqIFJldHVybiBhIE1vZHVsZU1ldGFkYXRhIGZvciB0aGUgZ2l2ZW4gbW9kdWxlLlxuICAgKiBBbmd1bGFyIENMSSB3aWxsIHByb2R1Y2UgdGhpcyBtZXRhZGF0YSBmb3IgYSBtb2R1bGUgd2hlbmV2ZXIgYSAuZC50cyBmaWxlcyBpc1xuICAgKiBwcm9kdWNlZCBhbmQgdGhlIG1vZHVsZSBoYXMgZXhwb3J0ZWQgdmFyaWFibGVzIG9yIGNsYXNzZXMgd2l0aCBkZWNvcmF0b3JzLiBNb2R1bGUgbWV0YWRhdGEgY2FuXG4gICAqIGFsc28gYmUgcHJvZHVjZWQgZGlyZWN0bHkgZnJvbSBUeXBlU2NyaXB0IHNvdXJjZXMgYnkgdXNpbmcgTWV0YWRhdGFDb2xsZWN0b3IgaW4gdG9vbHMvbWV0YWRhdGEuXG4gICAqXG4gICAqIEBwYXJhbSBtb2R1bGVQYXRoIGlzIGEgc3RyaW5nIGlkZW50aWZpZXIgZm9yIGEgbW9kdWxlIGFzIGFuIGFic29sdXRlIHBhdGguXG4gICAqIEByZXR1cm5zIHRoZSBtZXRhZGF0YSBmb3IgdGhlIGdpdmVuIG1vZHVsZS5cbiAgICovXG4gIGdldE1ldGFkYXRhRm9yKG1vZHVsZVBhdGg6IHN0cmluZyk6IHtba2V5OiBzdHJpbmddOiBhbnl9W118dW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyBhIG1vZHVsZSBuYW1lIHRoYXQgaXMgdXNlZCBpbiBhbiBgaW1wb3J0YCB0byBhIGZpbGUgcGF0aC5cbiAgICogSS5lLlxuICAgKiBgcGF0aC90by9jb250YWluaW5nRmlsZS50c2AgY29udGFpbmluZyBgaW1wb3J0IHsuLi59IGZyb20gJ21vZHVsZS1uYW1lJ2AuXG4gICAqL1xuICBtb2R1bGVOYW1lVG9GaWxlTmFtZShtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlPzogc3RyaW5nKTogc3RyaW5nfG51bGw7XG5cbiAgLyoqXG4gICAqIEdldCBhIGZpbGUgc3VpdGFibGUgZm9yIGRpc3BsYXkgdG8gdGhlIHVzZXIgdGhhdCBzaG91bGQgYmUgcmVsYXRpdmUgdG8gdGhlIHByb2plY3QgZGlyZWN0b3J5XG4gICAqIG9yIHRoZSBjdXJyZW50IGRpcmVjdG9yeS5cbiAgICovXG4gIGdldE91dHB1dE5hbWUoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZztcbn1cblxuY29uc3QgU1VQUE9SVEVEX1NDSEVNQV9WRVJTSU9OID0gNDtcblxuLyoqXG4gKiBUaGlzIGNsYXNzIGlzIHJlc3BvbnNpYmxlIGZvciBsb2FkaW5nIG1ldGFkYXRhIHBlciBzeW1ib2wsXG4gKiBhbmQgbm9ybWFsaXppbmcgcmVmZXJlbmNlcyBiZXR3ZWVuIHN5bWJvbHMuXG4gKlxuICogSW50ZXJuYWxseSwgaXQgb25seSB1c2VzIHN5bWJvbHMgd2l0aG91dCBtZW1iZXJzLFxuICogYW5kIGRlZHVjZXMgdGhlIHZhbHVlcyBmb3Igc3ltYm9scyB3aXRoIG1lbWJlcnMgYmFzZWRcbiAqIG9uIHRoZXNlIHN5bWJvbHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGF0aWNTeW1ib2xSZXNvbHZlciB7XG4gIHByaXZhdGUgbWV0YWRhdGFDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCB7W2tleTogc3RyaW5nXTogYW55fT4oKTtcbiAgLy8gTm90ZTogdGhpcyB3aWxsIG9ubHkgY29udGFpbiBTdGF0aWNTeW1ib2xzIHdpdGhvdXQgbWVtYmVycyFcbiAgcHJpdmF0ZSByZXNvbHZlZFN5bWJvbHMgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgUmVzb2x2ZWRTdGF0aWNTeW1ib2w+KCk7XG4gIHByaXZhdGUgcmVzb2x2ZWRGaWxlUGF0aHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgLy8gTm90ZTogdGhpcyB3aWxsIG9ubHkgY29udGFpbiBTdGF0aWNTeW1ib2xzIHdpdGhvdXQgbWVtYmVycyFcbiAgcHJpdmF0ZSBpbXBvcnRBcyA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBTdGF0aWNTeW1ib2w+KCk7XG4gIHByaXZhdGUgc3ltYm9sUmVzb3VyY2VQYXRocyA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBzdHJpbmc+KCk7XG4gIHByaXZhdGUgc3ltYm9sRnJvbUZpbGUgPSBuZXcgTWFwPHN0cmluZywgU3RhdGljU3ltYm9sW10+KCk7XG4gIHByaXZhdGUga25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBob3N0OiBTdGF0aWNTeW1ib2xSZXNvbHZlckhvc3QsIHByaXZhdGUgc3RhdGljU3ltYm9sQ2FjaGU6IFN0YXRpY1N5bWJvbENhY2hlLFxuICAgICAgcHJpdmF0ZSBzdW1tYXJ5UmVzb2x2ZXI6IFN1bW1hcnlSZXNvbHZlcjxTdGF0aWNTeW1ib2w+LFxuICAgICAgcHJpdmF0ZSBlcnJvclJlY29yZGVyPzogKGVycm9yOiBhbnksIGZpbGVOYW1lPzogc3RyaW5nKSA9PiB2b2lkKSB7fVxuXG4gIHJlc29sdmVTeW1ib2woc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBSZXNvbHZlZFN0YXRpY1N5bWJvbCB7XG4gICAgaWYgKHN0YXRpY1N5bWJvbC5tZW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0aGlzLl9yZXNvbHZlU3ltYm9sTWVtYmVycyhzdGF0aWNTeW1ib2wpICE7XG4gICAgfVxuICAgIC8vIE5vdGU6IGFsd2F5cyBhc2sgZm9yIGEgc3VtbWFyeSBmaXJzdCxcbiAgICAvLyBhcyB3ZSBtaWdodCBoYXZlIHJlYWQgc2hhbGxvdyBtZXRhZGF0YSB2aWEgYSAuZC50cyBmaWxlXG4gICAgLy8gZm9yIHRoZSBzeW1ib2wuXG4gICAgY29uc3QgcmVzdWx0RnJvbVN1bW1hcnkgPSB0aGlzLl9yZXNvbHZlU3ltYm9sRnJvbVN1bW1hcnkoc3RhdGljU3ltYm9sKSAhO1xuICAgIGlmIChyZXN1bHRGcm9tU3VtbWFyeSkge1xuICAgICAgcmV0dXJuIHJlc3VsdEZyb21TdW1tYXJ5O1xuICAgIH1cbiAgICBjb25zdCByZXN1bHRGcm9tQ2FjaGUgPSB0aGlzLnJlc29sdmVkU3ltYm9scy5nZXQoc3RhdGljU3ltYm9sKTtcbiAgICBpZiAocmVzdWx0RnJvbUNhY2hlKSB7XG4gICAgICByZXR1cm4gcmVzdWx0RnJvbUNhY2hlO1xuICAgIH1cbiAgICAvLyBOb3RlOiBTb21lIHVzZXJzIHVzZSBsaWJyYXJpZXMgdGhhdCB3ZXJlIG5vdCBjb21waWxlZCB3aXRoIG5nYywgaS5lLiB0aGV5IGRvbid0XG4gICAgLy8gaGF2ZSBzdW1tYXJpZXMsIG9ubHkgLmQudHMgZmlsZXMuIFNvIHdlIGFsd2F5cyBuZWVkIHRvIGNoZWNrIGJvdGgsIHRoZSBzdW1tYXJ5XG4gICAgLy8gYW5kIG1ldGFkYXRhLlxuICAgIHRoaXMuX2NyZWF0ZVN5bWJvbHNPZihzdGF0aWNTeW1ib2wuZmlsZVBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJlc29sdmVkU3ltYm9scy5nZXQoc3RhdGljU3ltYm9sKSAhO1xuICB9XG5cbiAgLyoqXG4gICAqIGdldEltcG9ydEFzIHByb2R1Y2VzIGEgc3ltYm9sIHRoYXQgY2FuIGJlIHVzZWQgdG8gaW1wb3J0IHRoZSBnaXZlbiBzeW1ib2wuXG4gICAqIFRoZSBpbXBvcnQgbWlnaHQgYmUgZGlmZmVyZW50IHRoYW4gdGhlIHN5bWJvbCBpZiB0aGUgc3ltYm9sIGlzIGV4cG9ydGVkIGZyb21cbiAgICogYSBsaWJyYXJ5IHdpdGggYSBzdW1tYXJ5OyBpbiB3aGljaCBjYXNlIHdlIHdhbnQgdG8gaW1wb3J0IHRoZSBzeW1ib2wgZnJvbSB0aGVcbiAgICogbmdmYWN0b3J5IHJlLWV4cG9ydCBpbnN0ZWFkIG9mIGRpcmVjdGx5IHRvIGF2b2lkIGludHJvZHVjaW5nIGEgZGlyZWN0IGRlcGVuZGVuY3lcbiAgICogb24gYW4gb3RoZXJ3aXNlIGluZGlyZWN0IGRlcGVuZGVuY3kuXG4gICAqXG4gICAqIEBwYXJhbSBzdGF0aWNTeW1ib2wgdGhlIHN5bWJvbCBmb3Igd2hpY2ggdG8gZ2VuZXJhdGUgYSBpbXBvcnQgc3ltYm9sXG4gICAqL1xuICBnZXRJbXBvcnRBcyhzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCwgdXNlU3VtbWFyaWVzOiBib29sZWFuID0gdHJ1ZSk6IFN0YXRpY1N5bWJvbHxudWxsIHtcbiAgICBpZiAoc3RhdGljU3ltYm9sLm1lbWJlcnMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBiYXNlU3ltYm9sID0gdGhpcy5nZXRTdGF0aWNTeW1ib2woc3RhdGljU3ltYm9sLmZpbGVQYXRoLCBzdGF0aWNTeW1ib2wubmFtZSk7XG4gICAgICBjb25zdCBiYXNlSW1wb3J0QXMgPSB0aGlzLmdldEltcG9ydEFzKGJhc2VTeW1ib2wsIHVzZVN1bW1hcmllcyk7XG4gICAgICByZXR1cm4gYmFzZUltcG9ydEFzID9cbiAgICAgICAgICB0aGlzLmdldFN0YXRpY1N5bWJvbChiYXNlSW1wb3J0QXMuZmlsZVBhdGgsIGJhc2VJbXBvcnRBcy5uYW1lLCBzdGF0aWNTeW1ib2wubWVtYmVycykgOlxuICAgICAgICAgIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHN1bW1hcml6ZWRGaWxlTmFtZSA9IHN0cmlwU3VtbWFyeUZvckppdEZpbGVTdWZmaXgoc3RhdGljU3ltYm9sLmZpbGVQYXRoKTtcbiAgICBpZiAoc3VtbWFyaXplZEZpbGVOYW1lICE9PSBzdGF0aWNTeW1ib2wuZmlsZVBhdGgpIHtcbiAgICAgIGNvbnN0IHN1bW1hcml6ZWROYW1lID0gc3RyaXBTdW1tYXJ5Rm9ySml0TmFtZVN1ZmZpeChzdGF0aWNTeW1ib2wubmFtZSk7XG4gICAgICBjb25zdCBiYXNlU3ltYm9sID1cbiAgICAgICAgICB0aGlzLmdldFN0YXRpY1N5bWJvbChzdW1tYXJpemVkRmlsZU5hbWUsIHN1bW1hcml6ZWROYW1lLCBzdGF0aWNTeW1ib2wubWVtYmVycyk7XG4gICAgICBjb25zdCBiYXNlSW1wb3J0QXMgPSB0aGlzLmdldEltcG9ydEFzKGJhc2VTeW1ib2wsIHVzZVN1bW1hcmllcyk7XG4gICAgICByZXR1cm4gYmFzZUltcG9ydEFzID9cbiAgICAgICAgICB0aGlzLmdldFN0YXRpY1N5bWJvbChcbiAgICAgICAgICAgICAgc3VtbWFyeUZvckppdEZpbGVOYW1lKGJhc2VJbXBvcnRBcy5maWxlUGF0aCksIHN1bW1hcnlGb3JKaXROYW1lKGJhc2VJbXBvcnRBcy5uYW1lKSxcbiAgICAgICAgICAgICAgYmFzZVN5bWJvbC5tZW1iZXJzKSA6XG4gICAgICAgICAgbnVsbDtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9ICh1c2VTdW1tYXJpZXMgJiYgdGhpcy5zdW1tYXJ5UmVzb2x2ZXIuZ2V0SW1wb3J0QXMoc3RhdGljU3ltYm9sKSkgfHwgbnVsbDtcbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgcmVzdWx0ID0gdGhpcy5pbXBvcnRBcy5nZXQoc3RhdGljU3ltYm9sKSAhO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIGdldFJlc291cmNlUGF0aCBwcm9kdWNlcyB0aGUgcGF0aCB0byB0aGUgb3JpZ2luYWwgbG9jYXRpb24gb2YgdGhlIHN5bWJvbCBhbmQgc2hvdWxkXG4gICAqIGJlIHVzZWQgdG8gZGV0ZXJtaW5lIHRoZSByZWxhdGl2ZSBsb2NhdGlvbiBvZiByZXNvdXJjZSByZWZlcmVuY2VzIHJlY29yZGVkIGluXG4gICAqIHN5bWJvbCBtZXRhZGF0YS5cbiAgICovXG4gIGdldFJlc291cmNlUGF0aChzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9sUmVzb3VyY2VQYXRocy5nZXQoc3RhdGljU3ltYm9sKSB8fCBzdGF0aWNTeW1ib2wuZmlsZVBhdGg7XG4gIH1cblxuICAvKipcbiAgICogZ2V0VHlwZUFyaXR5IHJldHVybnMgdGhlIG51bWJlciBvZiBnZW5lcmljIHR5cGUgcGFyYW1ldGVycyB0aGUgZ2l2ZW4gc3ltYm9sXG4gICAqIGhhcy4gSWYgdGhlIHN5bWJvbCBpcyBub3QgYSB0eXBlIHRoZSByZXN1bHQgaXMgbnVsbC5cbiAgICovXG4gIGdldFR5cGVBcml0eShzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IG51bWJlcnxudWxsIHtcbiAgICAvLyBJZiB0aGUgZmlsZSBpcyBhIGZhY3RvcnkvbmdzdW1tYXJ5IGZpbGUsIGRvbid0IHJlc29sdmUgdGhlIHN5bWJvbCBhcyBkb2luZyBzbyB3b3VsZFxuICAgIC8vIGNhdXNlIHRoZSBtZXRhZGF0YSBmb3IgYW4gZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZSB0byBiZSBsb2FkZWQgd2hpY2ggZG9lc24ndCBleGlzdC5cbiAgICAvLyBBbGwgcmVmZXJlbmNlcyB0byBnZW5lcmF0ZWQgY2xhc3NlcyBtdXN0IGluY2x1ZGUgdGhlIGNvcnJlY3QgYXJpdHkgd2hlbmV2ZXJcbiAgICAvLyBnZW5lcmF0aW5nIGNvZGUuXG4gICAgaWYgKGlzR2VuZXJhdGVkRmlsZShzdGF0aWNTeW1ib2wuZmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbGV0IHJlc29sdmVkU3ltYm9sID0gdW53cmFwUmVzb2x2ZWRNZXRhZGF0YSh0aGlzLnJlc29sdmVTeW1ib2woc3RhdGljU3ltYm9sKSk7XG4gICAgd2hpbGUgKHJlc29sdmVkU3ltYm9sICYmIHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICByZXNvbHZlZFN5bWJvbCA9IHVud3JhcFJlc29sdmVkTWV0YWRhdGEodGhpcy5yZXNvbHZlU3ltYm9sKHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhKSk7XG4gICAgfVxuICAgIHJldHVybiAocmVzb2x2ZWRTeW1ib2wgJiYgcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEgJiYgcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEuYXJpdHkpIHx8IG51bGw7XG4gIH1cblxuICBnZXRLbm93bk1vZHVsZU5hbWUoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZ3xudWxsIHtcbiAgICByZXR1cm4gdGhpcy5rbm93bkZpbGVOYW1lVG9Nb2R1bGVOYW1lcy5nZXQoZmlsZVBhdGgpIHx8IG51bGw7XG4gIH1cblxuICByZWNvcmRJbXBvcnRBcyhzb3VyY2VTeW1ib2w6IFN0YXRpY1N5bWJvbCwgdGFyZ2V0U3ltYm9sOiBTdGF0aWNTeW1ib2wpIHtcbiAgICBzb3VyY2VTeW1ib2wuYXNzZXJ0Tm9NZW1iZXJzKCk7XG4gICAgdGFyZ2V0U3ltYm9sLmFzc2VydE5vTWVtYmVycygpO1xuICAgIHRoaXMuaW1wb3J0QXMuc2V0KHNvdXJjZVN5bWJvbCwgdGFyZ2V0U3ltYm9sKTtcbiAgfVxuXG4gIHJlY29yZE1vZHVsZU5hbWVGb3JGaWxlTmFtZShmaWxlTmFtZTogc3RyaW5nLCBtb2R1bGVOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmtub3duRmlsZU5hbWVUb01vZHVsZU5hbWVzLnNldChmaWxlTmFtZSwgbW9kdWxlTmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogSW52YWxpZGF0ZSBhbGwgaW5mb3JtYXRpb24gZGVyaXZlZCBmcm9tIHRoZSBnaXZlbiBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gZmlsZU5hbWUgdGhlIGZpbGUgdG8gaW52YWxpZGF0ZVxuICAgKi9cbiAgaW52YWxpZGF0ZUZpbGUoZmlsZU5hbWU6IHN0cmluZykge1xuICAgIHRoaXMubWV0YWRhdGFDYWNoZS5kZWxldGUoZmlsZU5hbWUpO1xuICAgIHRoaXMucmVzb2x2ZWRGaWxlUGF0aHMuZGVsZXRlKGZpbGVOYW1lKTtcbiAgICBjb25zdCBzeW1ib2xzID0gdGhpcy5zeW1ib2xGcm9tRmlsZS5nZXQoZmlsZU5hbWUpO1xuICAgIGlmIChzeW1ib2xzKSB7XG4gICAgICB0aGlzLnN5bWJvbEZyb21GaWxlLmRlbGV0ZShmaWxlTmFtZSk7XG4gICAgICBmb3IgKGNvbnN0IHN5bWJvbCBvZiBzeW1ib2xzKSB7XG4gICAgICAgIHRoaXMucmVzb2x2ZWRTeW1ib2xzLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgICB0aGlzLmltcG9ydEFzLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgICB0aGlzLnN5bWJvbFJlc291cmNlUGF0aHMuZGVsZXRlKHN5bWJvbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyogQGludGVybmFsICovXG4gIGlnbm9yZUVycm9yc0ZvcjxUPihjYjogKCkgPT4gVCkge1xuICAgIGNvbnN0IHJlY29yZGVyID0gdGhpcy5lcnJvclJlY29yZGVyO1xuICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9ICgpID0+IHt9O1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gY2IoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5lcnJvclJlY29yZGVyID0gcmVjb3JkZXI7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZVN5bWJvbE1lbWJlcnMoc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBSZXNvbHZlZFN0YXRpY1N5bWJvbHxudWxsIHtcbiAgICBjb25zdCBtZW1iZXJzID0gc3RhdGljU3ltYm9sLm1lbWJlcnM7XG4gICAgY29uc3QgYmFzZVJlc29sdmVkU3ltYm9sID1cbiAgICAgICAgdGhpcy5yZXNvbHZlU3ltYm9sKHRoaXMuZ2V0U3RhdGljU3ltYm9sKHN0YXRpY1N5bWJvbC5maWxlUGF0aCwgc3RhdGljU3ltYm9sLm5hbWUpKTtcbiAgICBpZiAoIWJhc2VSZXNvbHZlZFN5bWJvbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCBiYXNlTWV0YWRhdGEgPSB1bndyYXBSZXNvbHZlZE1ldGFkYXRhKGJhc2VSZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSk7XG4gICAgaWYgKGJhc2VNZXRhZGF0YSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgcmV0dXJuIG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChcbiAgICAgICAgICBzdGF0aWNTeW1ib2wsIHRoaXMuZ2V0U3RhdGljU3ltYm9sKGJhc2VNZXRhZGF0YS5maWxlUGF0aCwgYmFzZU1ldGFkYXRhLm5hbWUsIG1lbWJlcnMpKTtcbiAgICB9IGVsc2UgaWYgKGJhc2VNZXRhZGF0YSAmJiBiYXNlTWV0YWRhdGEuX19zeW1ib2xpYyA9PT0gJ2NsYXNzJykge1xuICAgICAgaWYgKGJhc2VNZXRhZGF0YS5zdGF0aWNzICYmIG1lbWJlcnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzb2x2ZWRTdGF0aWNTeW1ib2woc3RhdGljU3ltYm9sLCBiYXNlTWV0YWRhdGEuc3RhdGljc1ttZW1iZXJzWzBdXSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB2YWx1ZSA9IGJhc2VNZXRhZGF0YTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVtYmVycy5sZW5ndGggJiYgdmFsdWU7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlW21lbWJlcnNbaV1dO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChzdGF0aWNTeW1ib2wsIHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9yZXNvbHZlU3ltYm9sRnJvbVN1bW1hcnkoc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBSZXNvbHZlZFN0YXRpY1N5bWJvbHxudWxsIHtcbiAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5zdW1tYXJ5UmVzb2x2ZXIucmVzb2x2ZVN1bW1hcnkoc3RhdGljU3ltYm9sKTtcbiAgICByZXR1cm4gc3VtbWFyeSA/IG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChzdGF0aWNTeW1ib2wsIHN1bW1hcnkubWV0YWRhdGEpIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBnZXRTdGF0aWNTeW1ib2wgcHJvZHVjZXMgYSBUeXBlIHdob3NlIG1ldGFkYXRhIGlzIGtub3duIGJ1dCB3aG9zZSBpbXBsZW1lbnRhdGlvbiBpcyBub3QgbG9hZGVkLlxuICAgKiBBbGwgdHlwZXMgcGFzc2VkIHRvIHRoZSBTdGF0aWNSZXNvbHZlciBzaG91bGQgYmUgcHNldWRvLXR5cGVzIHJldHVybmVkIGJ5IHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbGFyYXRpb25GaWxlIHRoZSBhYnNvbHV0ZSBwYXRoIG9mIHRoZSBmaWxlIHdoZXJlIHRoZSBzeW1ib2wgaXMgZGVjbGFyZWRcbiAgICogQHBhcmFtIG5hbWUgdGhlIG5hbWUgb2YgdGhlIHR5cGUuXG4gICAqIEBwYXJhbSBtZW1iZXJzIGEgc3ltYm9sIGZvciBhIHN0YXRpYyBtZW1iZXIgb2YgdGhlIG5hbWVkIHR5cGVcbiAgICovXG4gIGdldFN0YXRpY1N5bWJvbChkZWNsYXJhdGlvbkZpbGU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10pOiBTdGF0aWNTeW1ib2wge1xuICAgIHJldHVybiB0aGlzLnN0YXRpY1N5bWJvbENhY2hlLmdldChkZWNsYXJhdGlvbkZpbGUsIG5hbWUsIG1lbWJlcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIGhhc0RlY29yYXRvcnMgY2hlY2tzIGEgZmlsZSdzIG1ldGFkYXRhIGZvciB0aGUgcHJlc2VuY2Ugb2YgZGVjb3JhdG9ycyB3aXRob3V0IGV2YWx1YXRpbmcgdGhlXG4gICAqIG1ldGFkYXRhLlxuICAgKlxuICAgKiBAcGFyYW0gZmlsZVBhdGggdGhlIGFic29sdXRlIHBhdGggdG8gZXhhbWluZSBmb3IgZGVjb3JhdG9ycy5cbiAgICogQHJldHVybnMgdHJ1ZSBpZiBhbnkgY2xhc3MgaW4gdGhlIGZpbGUgaGFzIGEgZGVjb3JhdG9yLlxuICAgKi9cbiAgaGFzRGVjb3JhdG9ycyhmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmdldE1vZHVsZU1ldGFkYXRhKGZpbGVQYXRoKTtcbiAgICBpZiAobWV0YWRhdGFbJ21ldGFkYXRhJ10pIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhtZXRhZGF0YVsnbWV0YWRhdGEnXSkuc29tZSgobWV0YWRhdGFLZXkpID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSBtZXRhZGF0YVsnbWV0YWRhdGEnXVttZXRhZGF0YUtleV07XG4gICAgICAgIHJldHVybiBlbnRyeSAmJiBlbnRyeS5fX3N5bWJvbGljID09PSAnY2xhc3MnICYmIGVudHJ5LmRlY29yYXRvcnM7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZ2V0U3ltYm9sc09mKGZpbGVQYXRoOiBzdHJpbmcpOiBTdGF0aWNTeW1ib2xbXSB7XG4gICAgY29uc3Qgc3VtbWFyeVN5bWJvbHMgPSB0aGlzLnN1bW1hcnlSZXNvbHZlci5nZXRTeW1ib2xzT2YoZmlsZVBhdGgpO1xuICAgIGlmIChzdW1tYXJ5U3ltYm9scykge1xuICAgICAgcmV0dXJuIHN1bW1hcnlTeW1ib2xzO1xuICAgIH1cbiAgICAvLyBOb3RlOiBTb21lIHVzZXJzIHVzZSBsaWJyYXJpZXMgdGhhdCB3ZXJlIG5vdCBjb21waWxlZCB3aXRoIG5nYywgaS5lLiB0aGV5IGRvbid0XG4gICAgLy8gaGF2ZSBzdW1tYXJpZXMsIG9ubHkgLmQudHMgZmlsZXMsIGJ1dCBgc3VtbWFyeVJlc29sdmVyLmlzTGlicmFyeUZpbGVgIHJldHVybnMgdHJ1ZS5cbiAgICB0aGlzLl9jcmVhdGVTeW1ib2xzT2YoZmlsZVBhdGgpO1xuICAgIGNvbnN0IG1ldGFkYXRhU3ltYm9sczogU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgICB0aGlzLnJlc29sdmVkU3ltYm9scy5mb3JFYWNoKChyZXNvbHZlZFN5bWJvbCkgPT4ge1xuICAgICAgaWYgKHJlc29sdmVkU3ltYm9sLnN5bWJvbC5maWxlUGF0aCA9PT0gZmlsZVBhdGgpIHtcbiAgICAgICAgbWV0YWRhdGFTeW1ib2xzLnB1c2gocmVzb2x2ZWRTeW1ib2wuc3ltYm9sKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbWV0YWRhdGFTeW1ib2xzO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlU3ltYm9sc09mKGZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5yZXNvbHZlZEZpbGVQYXRocy5oYXMoZmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMucmVzb2x2ZWRGaWxlUGF0aHMuYWRkKGZpbGVQYXRoKTtcbiAgICBjb25zdCByZXNvbHZlZFN5bWJvbHM6IFJlc29sdmVkU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgICBjb25zdCBtZXRhZGF0YSA9IHRoaXMuZ2V0TW9kdWxlTWV0YWRhdGEoZmlsZVBhdGgpO1xuICAgIGlmIChtZXRhZGF0YVsnaW1wb3J0QXMnXSkge1xuICAgICAgLy8gSW5kZXggYnVuZGxlIGluZGljZXMgc2hvdWxkIHVzZSB0aGUgaW1wb3J0QXMgbW9kdWxlIG5hbWUgZGVmaW5lZFxuICAgICAgLy8gaW4gdGhlIGJ1bmRsZS5cbiAgICAgIHRoaXMua25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMuc2V0KGZpbGVQYXRoLCBtZXRhZGF0YVsnaW1wb3J0QXMnXSk7XG4gICAgfVxuICAgIC8vIGhhbmRsZSB0aGUgc3ltYm9scyBpbiBvbmUgb2YgdGhlIHJlLWV4cG9ydCBsb2NhdGlvblxuICAgIGlmIChtZXRhZGF0YVsnZXhwb3J0cyddKSB7XG4gICAgICBmb3IgKGNvbnN0IG1vZHVsZUV4cG9ydCBvZiBtZXRhZGF0YVsnZXhwb3J0cyddKSB7XG4gICAgICAgIC8vIGhhbmRsZSB0aGUgc3ltYm9scyBpbiB0aGUgbGlzdCBvZiBleHBsaWNpdGx5IHJlLWV4cG9ydGVkIHN5bWJvbHMuXG4gICAgICAgIGlmIChtb2R1bGVFeHBvcnQuZXhwb3J0KSB7XG4gICAgICAgICAgbW9kdWxlRXhwb3J0LmV4cG9ydC5mb3JFYWNoKChleHBvcnRTeW1ib2w6IGFueSkgPT4ge1xuICAgICAgICAgICAgbGV0IHN5bWJvbE5hbWU6IHN0cmluZztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwb3J0U3ltYm9sID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICBzeW1ib2xOYW1lID0gZXhwb3J0U3ltYm9sO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3ltYm9sTmFtZSA9IGV4cG9ydFN5bWJvbC5hcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN5bWJvbE5hbWUgPSB1bmVzY2FwZUlkZW50aWZpZXIoc3ltYm9sTmFtZSk7XG4gICAgICAgICAgICBsZXQgc3ltTmFtZSA9IHN5bWJvbE5hbWU7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydFN5bWJvbCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgc3ltTmFtZSA9IHVuZXNjYXBlSWRlbnRpZmllcihleHBvcnRTeW1ib2wubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZE1vZHVsZSA9IHRoaXMucmVzb2x2ZU1vZHVsZShtb2R1bGVFeHBvcnQuZnJvbSwgZmlsZVBhdGgpO1xuICAgICAgICAgICAgaWYgKHJlc29sdmVkTW9kdWxlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhcmdldFN5bWJvbCA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKHJlc29sdmVkTW9kdWxlLCBzeW1OYW1lKTtcbiAgICAgICAgICAgICAgY29uc3Qgc291cmNlU3ltYm9sID0gdGhpcy5nZXRTdGF0aWNTeW1ib2woZmlsZVBhdGgsIHN5bWJvbE5hbWUpO1xuICAgICAgICAgICAgICByZXNvbHZlZFN5bWJvbHMucHVzaCh0aGlzLmNyZWF0ZUV4cG9ydChzb3VyY2VTeW1ib2wsIHRhcmdldFN5bWJvbCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGhhbmRsZSB0aGUgc3ltYm9scyB2aWEgZXhwb3J0ICogZGlyZWN0aXZlcy5cbiAgICAgICAgICBjb25zdCByZXNvbHZlZE1vZHVsZSA9IHRoaXMucmVzb2x2ZU1vZHVsZShtb2R1bGVFeHBvcnQuZnJvbSwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmIChyZXNvbHZlZE1vZHVsZSkge1xuICAgICAgICAgICAgY29uc3QgbmVzdGVkRXhwb3J0cyA9IHRoaXMuZ2V0U3ltYm9sc09mKHJlc29sdmVkTW9kdWxlKTtcbiAgICAgICAgICAgIG5lc3RlZEV4cG9ydHMuZm9yRWFjaCgodGFyZ2V0U3ltYm9sKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHNvdXJjZVN5bWJvbCA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKGZpbGVQYXRoLCB0YXJnZXRTeW1ib2wubmFtZSk7XG4gICAgICAgICAgICAgIHJlc29sdmVkU3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlRXhwb3J0KHNvdXJjZVN5bWJvbCwgdGFyZ2V0U3ltYm9sKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBoYW5kbGUgdGhlIGFjdHVhbCBtZXRhZGF0YS4gSGFzIHRvIGJlIGFmdGVyIHRoZSBleHBvcnRzXG4gICAgLy8gYXMgdGhlcmUgbWlndGggYmUgY29sbGlzaW9ucyBpbiB0aGUgbmFtZXMsIGFuZCB3ZSB3YW50IHRoZSBzeW1ib2xzXG4gICAgLy8gb2YgdGhlIGN1cnJlbnQgbW9kdWxlIHRvIHdpbiBvZnRlciByZWV4cG9ydHMuXG4gICAgaWYgKG1ldGFkYXRhWydtZXRhZGF0YSddKSB7XG4gICAgICAvLyBoYW5kbGUgZGlyZWN0IGRlY2xhcmF0aW9ucyBvZiB0aGUgc3ltYm9sXG4gICAgICBjb25zdCB0b3BMZXZlbFN5bWJvbE5hbWVzID1cbiAgICAgICAgICBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LmtleXMobWV0YWRhdGFbJ21ldGFkYXRhJ10pLm1hcCh1bmVzY2FwZUlkZW50aWZpZXIpKTtcbiAgICAgIGNvbnN0IG9yaWdpbnM6IHtbaW5kZXg6IHN0cmluZ106IHN0cmluZ30gPSBtZXRhZGF0YVsnb3JpZ2lucyddIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMobWV0YWRhdGFbJ21ldGFkYXRhJ10pLmZvckVhY2goKG1ldGFkYXRhS2V5KSA9PiB7XG4gICAgICAgIGNvbnN0IHN5bWJvbE1ldGEgPSBtZXRhZGF0YVsnbWV0YWRhdGEnXVttZXRhZGF0YUtleV07XG4gICAgICAgIGNvbnN0IG5hbWUgPSB1bmVzY2FwZUlkZW50aWZpZXIobWV0YWRhdGFLZXkpO1xuXG4gICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKGZpbGVQYXRoLCBuYW1lKTtcblxuICAgICAgICBjb25zdCBvcmlnaW4gPSBvcmlnaW5zLmhhc093blByb3BlcnR5KG1ldGFkYXRhS2V5KSAmJiBvcmlnaW5zW21ldGFkYXRhS2V5XTtcbiAgICAgICAgaWYgKG9yaWdpbikge1xuICAgICAgICAgIC8vIElmIHRoZSBzeW1ib2wgaXMgZnJvbSBhIGJ1bmRsZWQgaW5kZXgsIHVzZSB0aGUgZGVjbGFyYXRpb24gbG9jYXRpb24gb2YgdGhlXG4gICAgICAgICAgLy8gc3ltYm9sIHNvIHJlbGF0aXZlIHJlZmVyZW5jZXMgKHN1Y2ggYXMgJy4vbXkuaHRtbCcpIHdpbGwgYmUgY2FsY3VsYXRlZFxuICAgICAgICAgIC8vIGNvcnJlY3RseS5cbiAgICAgICAgICBjb25zdCBvcmlnaW5GaWxlUGF0aCA9IHRoaXMucmVzb2x2ZU1vZHVsZShvcmlnaW4sIGZpbGVQYXRoKTtcbiAgICAgICAgICBpZiAoIW9yaWdpbkZpbGVQYXRoKSB7XG4gICAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAgIG5ldyBFcnJvcihgQ291bGRuJ3QgcmVzb2x2ZSBvcmlnaW5hbCBzeW1ib2wgZm9yICR7b3JpZ2lufSBmcm9tICR7ZmlsZVBhdGh9YCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN5bWJvbFJlc291cmNlUGF0aHMuc2V0KHN5bWJvbCwgb3JpZ2luRmlsZVBhdGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlZFN5bWJvbHMucHVzaChcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlUmVzb2x2ZWRTeW1ib2woc3ltYm9sLCBmaWxlUGF0aCwgdG9wTGV2ZWxTeW1ib2xOYW1lcywgc3ltYm9sTWV0YSkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJlc29sdmVkU3ltYm9scy5mb3JFYWNoKFxuICAgICAgICAocmVzb2x2ZWRTeW1ib2wpID0+IHRoaXMucmVzb2x2ZWRTeW1ib2xzLnNldChyZXNvbHZlZFN5bWJvbC5zeW1ib2wsIHJlc29sdmVkU3ltYm9sKSk7XG4gICAgdGhpcy5zeW1ib2xGcm9tRmlsZS5zZXQoZmlsZVBhdGgsIHJlc29sdmVkU3ltYm9scy5tYXAocmVzb2x2ZWRTeW1ib2wgPT4gcmVzb2x2ZWRTeW1ib2wuc3ltYm9sKSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVJlc29sdmVkU3ltYm9sKFxuICAgICAgc291cmNlU3ltYm9sOiBTdGF0aWNTeW1ib2wsIHRvcExldmVsUGF0aDogc3RyaW5nLCB0b3BMZXZlbFN5bWJvbE5hbWVzOiBTZXQ8c3RyaW5nPixcbiAgICAgIG1ldGFkYXRhOiBhbnkpOiBSZXNvbHZlZFN0YXRpY1N5bWJvbCB7XG4gICAgLy8gRm9yIGNsYXNzZXMgdGhhdCBkb24ndCBoYXZlIEFuZ3VsYXIgc3VtbWFyaWVzIC8gbWV0YWRhdGEsXG4gICAgLy8gd2Ugb25seSBrZWVwIHRoZWlyIGFyaXR5LCBidXQgbm90aGluZyBlbHNlXG4gICAgLy8gKGUuZy4gdGhlaXIgY29uc3RydWN0b3IgcGFyYW1ldGVycykuXG4gICAgLy8gV2UgZG8gdGhpcyB0byBwcmV2ZW50IGludHJvZHVjaW5nIGRlZXAgaW1wb3J0c1xuICAgIC8vIGFzIHdlIGRpZG4ndCBnZW5lcmF0ZSAubmdmYWN0b3J5LnRzIGZpbGVzIHdpdGggcHJvcGVyIHJlZXhwb3J0cy5cbiAgICBjb25zdCBpc1RzRmlsZSA9IFRTLnRlc3Qoc291cmNlU3ltYm9sLmZpbGVQYXRoKTtcbiAgICBpZiAodGhpcy5zdW1tYXJ5UmVzb2x2ZXIuaXNMaWJyYXJ5RmlsZShzb3VyY2VTeW1ib2wuZmlsZVBhdGgpICYmICFpc1RzRmlsZSAmJiBtZXRhZGF0YSAmJlxuICAgICAgICBtZXRhZGF0YVsnX19zeW1ib2xpYyddID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCB0cmFuc2Zvcm1lZE1ldGEgPSB7X19zeW1ib2xpYzogJ2NsYXNzJywgYXJpdHk6IG1ldGFkYXRhLmFyaXR5fTtcbiAgICAgIHJldHVybiBuZXcgUmVzb2x2ZWRTdGF0aWNTeW1ib2woc291cmNlU3ltYm9sLCB0cmFuc2Zvcm1lZE1ldGEpO1xuICAgIH1cblxuICAgIGxldCBfb3JpZ2luYWxGaWxlTWVtbzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICBjb25zdCBnZXRPcmlnaW5hbE5hbWU6ICgpID0+IHN0cmluZyA9ICgpID0+IHtcbiAgICAgIGlmICghX29yaWdpbmFsRmlsZU1lbW8pIHtcbiAgICAgICAgLy8gR3Vlc3Mgd2hhdCBodGUgb3JpZ2luYWwgZmlsZSBuYW1lIGlzIGZyb20gdGhlIHJlZmVyZW5jZS4gSWYgaXQgaGFzIGEgYC5kLnRzYCBleHRlbnNpb25cbiAgICAgICAgLy8gcmVwbGFjZSBpdCB3aXRoIGAudHNgLiBJZiBpdCBhbHJlYWR5IGhhcyBgLnRzYCBqdXN0IGxlYXZlIGl0IGluIHBsYWNlLiBJZiBpdCBkb2Vzbid0IGhhdmVcbiAgICAgICAgLy8gLnRzIG9yIC5kLnRzLCBhcHBlbmQgYC50cycuIEFsc28sIGlmIGl0IGlzIGluIGBub2RlX21vZHVsZXNgLCB0cmltIHRoZSBgbm9kZV9tb2R1bGVgXG4gICAgICAgIC8vIGxvY2F0aW9uIGFzIGl0IGlzIG5vdCBpbXBvcnRhbnQgdG8gZmluZGluZyB0aGUgZmlsZS5cbiAgICAgICAgX29yaWdpbmFsRmlsZU1lbW8gPVxuICAgICAgICAgICAgdGhpcy5ob3N0LmdldE91dHB1dE5hbWUodG9wTGV2ZWxQYXRoLnJlcGxhY2UoLygoXFwudHMpfChcXC5kXFwudHMpfCkkLywgJy50cycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL14uKm5vZGVfbW9kdWxlc1svXFxcXF0vLCAnJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9vcmlnaW5hbEZpbGVNZW1vO1xuICAgIH07XG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNsYXNzIFJlZmVyZW5jZVRyYW5zZm9ybWVyIGV4dGVuZHMgVmFsdWVUcmFuc2Zvcm1lciB7XG4gICAgICB2aXNpdFN0cmluZ01hcChtYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBmdW5jdGlvblBhcmFtczogc3RyaW5nW10pOiBhbnkge1xuICAgICAgICBjb25zdCBzeW1ib2xpYyA9IG1hcFsnX19zeW1ib2xpYyddO1xuICAgICAgICBpZiAoc3ltYm9saWMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBjb25zdCBvbGRMZW4gPSBmdW5jdGlvblBhcmFtcy5sZW5ndGg7XG4gICAgICAgICAgZnVuY3Rpb25QYXJhbXMucHVzaCguLi4obWFwWydwYXJhbWV0ZXJzJ10gfHwgW10pKTtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBzdXBlci52aXNpdFN0cmluZ01hcChtYXAsIGZ1bmN0aW9uUGFyYW1zKTtcbiAgICAgICAgICBmdW5jdGlvblBhcmFtcy5sZW5ndGggPSBvbGRMZW47XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIGlmIChzeW1ib2xpYyA9PT0gJ3JlZmVyZW5jZScpIHtcbiAgICAgICAgICBjb25zdCBtb2R1bGUgPSBtYXBbJ21vZHVsZSddO1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBtYXBbJ25hbWUnXSA/IHVuZXNjYXBlSWRlbnRpZmllcihtYXBbJ25hbWUnXSkgOiBtYXBbJ25hbWUnXTtcbiAgICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgZmlsZVBhdGg6IHN0cmluZztcbiAgICAgICAgICBpZiAobW9kdWxlKSB7XG4gICAgICAgICAgICBmaWxlUGF0aCA9IHNlbGYucmVzb2x2ZU1vZHVsZShtb2R1bGUsIHNvdXJjZVN5bWJvbC5maWxlUGF0aCkgITtcbiAgICAgICAgICAgIGlmICghZmlsZVBhdGgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBfX3N5bWJvbGljOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBDb3VsZCBub3QgcmVzb2x2ZSAke21vZHVsZX0gcmVsYXRpdmUgdG8gJHtzb3VyY2VTeW1ib2wuZmlsZVBhdGh9LmAsXG4gICAgICAgICAgICAgICAgbGluZTogbWFwLmxpbmUsXG4gICAgICAgICAgICAgICAgY2hhcmFjdGVyOiBtYXAuY2hhcmFjdGVyLFxuICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBnZXRPcmlnaW5hbE5hbWUoKVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgX19zeW1ib2xpYzogJ3Jlc29sdmVkJyxcbiAgICAgICAgICAgICAgc3ltYm9sOiBzZWxmLmdldFN0YXRpY1N5bWJvbChmaWxlUGF0aCwgbmFtZSksXG4gICAgICAgICAgICAgIGxpbmU6IG1hcC5saW5lLFxuICAgICAgICAgICAgICBjaGFyYWN0ZXI6IG1hcC5jaGFyYWN0ZXIsXG4gICAgICAgICAgICAgIGZpbGVOYW1lOiBnZXRPcmlnaW5hbE5hbWUoKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGZ1bmN0aW9uUGFyYW1zLmluZGV4T2YobmFtZSkgPj0gMCkge1xuICAgICAgICAgICAgLy8gcmVmZXJlbmNlIHRvIGEgZnVuY3Rpb24gcGFyYW1ldGVyXG4gICAgICAgICAgICByZXR1cm4ge19fc3ltYm9saWM6ICdyZWZlcmVuY2UnLCBuYW1lOiBuYW1lfTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRvcExldmVsU3ltYm9sTmFtZXMuaGFzKG5hbWUpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLmdldFN0YXRpY1N5bWJvbCh0b3BMZXZlbFBhdGgsIG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gYW1iaWVudCB2YWx1ZVxuICAgICAgICAgICAgbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc3ltYm9saWMgPT09ICdlcnJvcicpIHtcbiAgICAgICAgICByZXR1cm4gey4uLm1hcCwgZmlsZU5hbWU6IGdldE9yaWdpbmFsTmFtZSgpfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gc3VwZXIudmlzaXRTdHJpbmdNYXAobWFwLCBmdW5jdGlvblBhcmFtcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgdHJhbnNmb3JtZWRNZXRhID0gdmlzaXRWYWx1ZShtZXRhZGF0YSwgbmV3IFJlZmVyZW5jZVRyYW5zZm9ybWVyKCksIFtdKTtcbiAgICBsZXQgdW53cmFwcGVkVHJhbnNmb3JtZWRNZXRhID0gdW53cmFwUmVzb2x2ZWRNZXRhZGF0YSh0cmFuc2Zvcm1lZE1ldGEpO1xuICAgIGlmICh1bndyYXBwZWRUcmFuc2Zvcm1lZE1ldGEgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUV4cG9ydChzb3VyY2VTeW1ib2wsIHVud3JhcHBlZFRyYW5zZm9ybWVkTWV0YSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUmVzb2x2ZWRTdGF0aWNTeW1ib2woc291cmNlU3ltYm9sLCB0cmFuc2Zvcm1lZE1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFeHBvcnQoc291cmNlU3ltYm9sOiBTdGF0aWNTeW1ib2wsIHRhcmdldFN5bWJvbDogU3RhdGljU3ltYm9sKTpcbiAgICAgIFJlc29sdmVkU3RhdGljU3ltYm9sIHtcbiAgICBzb3VyY2VTeW1ib2wuYXNzZXJ0Tm9NZW1iZXJzKCk7XG4gICAgdGFyZ2V0U3ltYm9sLmFzc2VydE5vTWVtYmVycygpO1xuICAgIGlmICh0aGlzLnN1bW1hcnlSZXNvbHZlci5pc0xpYnJhcnlGaWxlKHNvdXJjZVN5bWJvbC5maWxlUGF0aCkgJiZcbiAgICAgICAgdGhpcy5zdW1tYXJ5UmVzb2x2ZXIuaXNMaWJyYXJ5RmlsZSh0YXJnZXRTeW1ib2wuZmlsZVBhdGgpKSB7XG4gICAgICAvLyBUaGlzIGNhc2UgaXMgZm9yIGFuIG5nIGxpYnJhcnkgaW1wb3J0aW5nIHN5bWJvbHMgZnJvbSBhIHBsYWluIHRzIGxpYnJhcnlcbiAgICAgIC8vIHRyYW5zaXRpdmVseS5cbiAgICAgIC8vIE5vdGU6IFdlIHJlbHkgb24gdGhlIGZhY3QgdGhhdCB3ZSBkaXNjb3ZlciBzeW1ib2xzIGluIHRoZSBkaXJlY3Rpb25cbiAgICAgIC8vIGZyb20gc291cmNlIGZpbGVzIHRvIGxpYnJhcnkgZmlsZXNcbiAgICAgIHRoaXMuaW1wb3J0QXMuc2V0KHRhcmdldFN5bWJvbCwgdGhpcy5nZXRJbXBvcnRBcyhzb3VyY2VTeW1ib2wpIHx8IHNvdXJjZVN5bWJvbCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUmVzb2x2ZWRTdGF0aWNTeW1ib2woc291cmNlU3ltYm9sLCB0YXJnZXRTeW1ib2wpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXBvcnRFcnJvcihlcnJvcjogRXJyb3IsIGNvbnRleHQ/OiBTdGF0aWNTeW1ib2wsIHBhdGg/OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5lcnJvclJlY29yZGVyKSB7XG4gICAgICB0aGlzLmVycm9yUmVjb3JkZXIoZXJyb3IsIChjb250ZXh0ICYmIGNvbnRleHQuZmlsZVBhdGgpIHx8IHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIG1vZHVsZSBhbiBhYnNvbHV0ZSBwYXRoIHRvIGEgbW9kdWxlIGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGdldE1vZHVsZU1ldGFkYXRhKG1vZHVsZTogc3RyaW5nKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGxldCBtb2R1bGVNZXRhZGF0YSA9IHRoaXMubWV0YWRhdGFDYWNoZS5nZXQobW9kdWxlKTtcbiAgICBpZiAoIW1vZHVsZU1ldGFkYXRhKSB7XG4gICAgICBjb25zdCBtb2R1bGVNZXRhZGF0YXMgPSB0aGlzLmhvc3QuZ2V0TWV0YWRhdGFGb3IobW9kdWxlKTtcbiAgICAgIGlmIChtb2R1bGVNZXRhZGF0YXMpIHtcbiAgICAgICAgbGV0IG1heFZlcnNpb24gPSAtMTtcbiAgICAgICAgbW9kdWxlTWV0YWRhdGFzLmZvckVhY2goKG1kKSA9PiB7XG4gICAgICAgICAgaWYgKG1kICYmIG1kWyd2ZXJzaW9uJ10gPiBtYXhWZXJzaW9uKSB7XG4gICAgICAgICAgICBtYXhWZXJzaW9uID0gbWRbJ3ZlcnNpb24nXTtcbiAgICAgICAgICAgIG1vZHVsZU1ldGFkYXRhID0gbWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICghbW9kdWxlTWV0YWRhdGEpIHtcbiAgICAgICAgbW9kdWxlTWV0YWRhdGEgPVxuICAgICAgICAgICAge19fc3ltYm9saWM6ICdtb2R1bGUnLCB2ZXJzaW9uOiBTVVBQT1JURURfU0NIRU1BX1ZFUlNJT04sIG1vZHVsZTogbW9kdWxlLCBtZXRhZGF0YToge319O1xuICAgICAgfVxuICAgICAgaWYgKG1vZHVsZU1ldGFkYXRhWyd2ZXJzaW9uJ10gIT0gU1VQUE9SVEVEX1NDSEVNQV9WRVJTSU9OKSB7XG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IG1vZHVsZU1ldGFkYXRhWyd2ZXJzaW9uJ10gPT0gMiA/XG4gICAgICAgICAgICBgVW5zdXBwb3J0ZWQgbWV0YWRhdGEgdmVyc2lvbiAke21vZHVsZU1ldGFkYXRhWyd2ZXJzaW9uJ119IGZvciBtb2R1bGUgJHttb2R1bGV9LiBUaGlzIG1vZHVsZSBzaG91bGQgYmUgY29tcGlsZWQgd2l0aCBhIG5ld2VyIHZlcnNpb24gb2YgbmdjYCA6XG4gICAgICAgICAgICBgTWV0YWRhdGEgdmVyc2lvbiBtaXNtYXRjaCBmb3IgbW9kdWxlICR7bW9kdWxlfSwgZm91bmQgdmVyc2lvbiAke21vZHVsZU1ldGFkYXRhWyd2ZXJzaW9uJ119LCBleHBlY3RlZCAke1NVUFBPUlRFRF9TQ0hFTUFfVkVSU0lPTn1gO1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0YWRhdGFDYWNoZS5zZXQobW9kdWxlLCBtb2R1bGVNZXRhZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBtb2R1bGVNZXRhZGF0YTtcbiAgfVxuXG5cbiAgZ2V0U3ltYm9sQnlNb2R1bGUobW9kdWxlOiBzdHJpbmcsIHN5bWJvbE5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU/OiBzdHJpbmcpOiBTdGF0aWNTeW1ib2wge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlTW9kdWxlKG1vZHVsZSwgY29udGFpbmluZ0ZpbGUpO1xuICAgIGlmICghZmlsZVBhdGgpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKGBDb3VsZCBub3QgcmVzb2x2ZSBtb2R1bGUgJHttb2R1bGV9JHtjb250YWluaW5nRmlsZSA/ICcgcmVsYXRpdmUgdG8gJyArXG4gICAgICAgICAgICBjb250YWluaW5nRmlsZSA6ICcnfWApKTtcbiAgICAgIHJldHVybiB0aGlzLmdldFN0YXRpY1N5bWJvbChgRVJST1I6JHttb2R1bGV9YCwgc3ltYm9sTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldFN0YXRpY1N5bWJvbChmaWxlUGF0aCwgc3ltYm9sTmFtZSk7XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVNb2R1bGUobW9kdWxlOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlPzogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5ob3N0Lm1vZHVsZU5hbWVUb0ZpbGVOYW1lKG1vZHVsZSwgY29udGFpbmluZ0ZpbGUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkIG5vdCByZXNvbHZlIG1vZHVsZSAnJHttb2R1bGV9JyByZWxhdGl2ZSB0byBmaWxlICR7Y29udGFpbmluZ0ZpbGV9YCk7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGUsIHVuZGVmaW5lZCwgY29udGFpbmluZ0ZpbGUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyBSZW1vdmUgZXh0cmEgdW5kZXJzY29yZSBmcm9tIGVzY2FwZWQgaWRlbnRpZmllci5cbi8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvYmxvYi9tYXN0ZXIvc3JjL2NvbXBpbGVyL3V0aWxpdGllcy50c1xuZXhwb3J0IGZ1bmN0aW9uIHVuZXNjYXBlSWRlbnRpZmllcihpZGVudGlmaWVyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaWRlbnRpZmllci5zdGFydHNXaXRoKCdfX18nKSA/IGlkZW50aWZpZXIuc3Vic3RyKDEpIDogaWRlbnRpZmllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVud3JhcFJlc29sdmVkTWV0YWRhdGEobWV0YWRhdGE6IGFueSk6IGFueSB7XG4gIGlmIChtZXRhZGF0YSAmJiBtZXRhZGF0YS5fX3N5bWJvbGljID09PSAncmVzb2x2ZWQnKSB7XG4gICAgcmV0dXJuIG1ldGFkYXRhLnN5bWJvbDtcbiAgfVxuICByZXR1cm4gbWV0YWRhdGE7XG59Il19