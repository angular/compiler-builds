/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ValueTransformer, visitValue } from '../util';
import { StaticSymbol } from './static_symbol';
import { isGeneratedFile, stripSummaryForJitFileSuffix, stripSummaryForJitNameSuffix, summaryForJitFileName, summaryForJitName } from './util';
const TS = /^(?!.*\.d\.ts$).*\.ts$/;
export class ResolvedStaticSymbol {
    constructor(symbol, metadata) {
        this.symbol = symbol;
        this.metadata = metadata;
    }
}
const SUPPORTED_SCHEMA_VERSION = 4;
/**
 * This class is responsible for loading metadata per symbol,
 * and normalizing references between symbols.
 *
 * Internally, it only uses symbols without members,
 * and deduces the values for symbols with members based
 * on these symbols.
 */
export class StaticSymbolResolver {
    constructor(host, staticSymbolCache, summaryResolver, errorRecorder) {
        this.host = host;
        this.staticSymbolCache = staticSymbolCache;
        this.summaryResolver = summaryResolver;
        this.errorRecorder = errorRecorder;
        this.metadataCache = new Map();
        // Note: this will only contain StaticSymbols without members!
        this.resolvedSymbols = new Map();
        // Note: this will only contain StaticSymbols without members!
        this.importAs = new Map();
        this.symbolResourcePaths = new Map();
        this.symbolFromFile = new Map();
        this.knownFileNameToModuleNames = new Map();
    }
    resolveSymbol(staticSymbol) {
        if (staticSymbol.members.length > 0) {
            return this._resolveSymbolMembers(staticSymbol);
        }
        // Note: always ask for a summary first,
        // as we might have read shallow metadata via a .d.ts file
        // for the symbol.
        const resultFromSummary = this._resolveSymbolFromSummary(staticSymbol);
        if (resultFromSummary) {
            return resultFromSummary;
        }
        const resultFromCache = this.resolvedSymbols.get(staticSymbol);
        if (resultFromCache) {
            return resultFromCache;
        }
        // Note: Some users use libraries that were not compiled with ngc, i.e. they don't
        // have summaries, only .d.ts files. So we always need to check both, the summary
        // and metadata.
        this._createSymbolsOf(staticSymbol.filePath);
        return this.resolvedSymbols.get(staticSymbol);
    }
    /**
     * getImportAs produces a symbol that can be used to import the given symbol.
     * The import might be different than the symbol if the symbol is exported from
     * a library with a summary; in which case we want to import the symbol from the
     * ngfactory re-export instead of directly to avoid introducing a direct dependency
     * on an otherwise indirect dependency.
     *
     * @param staticSymbol the symbol for which to generate a import symbol
     */
    getImportAs(staticSymbol, useSummaries = true) {
        if (staticSymbol.members.length) {
            const baseSymbol = this.getStaticSymbol(staticSymbol.filePath, staticSymbol.name);
            const baseImportAs = this.getImportAs(baseSymbol, useSummaries);
            return baseImportAs ?
                this.getStaticSymbol(baseImportAs.filePath, baseImportAs.name, staticSymbol.members) :
                null;
        }
        const summarizedFileName = stripSummaryForJitFileSuffix(staticSymbol.filePath);
        if (summarizedFileName !== staticSymbol.filePath) {
            const summarizedName = stripSummaryForJitNameSuffix(staticSymbol.name);
            const baseSymbol = this.getStaticSymbol(summarizedFileName, summarizedName, staticSymbol.members);
            const baseImportAs = this.getImportAs(baseSymbol, useSummaries);
            return baseImportAs ?
                this.getStaticSymbol(summaryForJitFileName(baseImportAs.filePath), summaryForJitName(baseImportAs.name), baseSymbol.members) :
                null;
        }
        let result = (useSummaries && this.summaryResolver.getImportAs(staticSymbol)) || null;
        if (!result) {
            result = this.importAs.get(staticSymbol);
        }
        return result;
    }
    /**
     * getResourcePath produces the path to the original location of the symbol and should
     * be used to determine the relative location of resource references recorded in
     * symbol metadata.
     */
    getResourcePath(staticSymbol) {
        return this.symbolResourcePaths.get(staticSymbol) || staticSymbol.filePath;
    }
    /**
     * getTypeArity returns the number of generic type parameters the given symbol
     * has. If the symbol is not a type the result is null.
     */
    getTypeArity(staticSymbol) {
        // If the file is a factory/ngsummary file, don't resolve the symbol as doing so would
        // cause the metadata for an factory/ngsummary file to be loaded which doesn't exist.
        // All references to generated classes must include the correct arity whenever
        // generating code.
        if (isGeneratedFile(staticSymbol.filePath)) {
            return null;
        }
        let resolvedSymbol = unwrapResolvedMetadata(this.resolveSymbol(staticSymbol));
        while (resolvedSymbol && resolvedSymbol.metadata instanceof StaticSymbol) {
            resolvedSymbol = unwrapResolvedMetadata(this.resolveSymbol(resolvedSymbol.metadata));
        }
        return (resolvedSymbol && resolvedSymbol.metadata && resolvedSymbol.metadata.arity) || null;
    }
    getKnownModuleName(filePath) {
        return this.knownFileNameToModuleNames.get(filePath) || null;
    }
    recordImportAs(sourceSymbol, targetSymbol) {
        sourceSymbol.assertNoMembers();
        targetSymbol.assertNoMembers();
        this.importAs.set(sourceSymbol, targetSymbol);
    }
    recordModuleNameForFileName(fileName, moduleName) {
        this.knownFileNameToModuleNames.set(fileName, moduleName);
    }
    /**
     * Invalidate all information derived from the given file and return the
     * static symbols contained in the file.
     *
     * @param fileName the file to invalidate
     */
    invalidateFile(fileName) {
        this.metadataCache.delete(fileName);
        const symbols = this.symbolFromFile.get(fileName);
        if (!symbols) {
            return [];
        }
        this.symbolFromFile.delete(fileName);
        for (const symbol of symbols) {
            this.resolvedSymbols.delete(symbol);
            this.importAs.delete(symbol);
            this.symbolResourcePaths.delete(symbol);
        }
        return symbols;
    }
    /** @internal */
    ignoreErrorsFor(cb) {
        const recorder = this.errorRecorder;
        this.errorRecorder = () => { };
        try {
            return cb();
        }
        finally {
            this.errorRecorder = recorder;
        }
    }
    _resolveSymbolMembers(staticSymbol) {
        const members = staticSymbol.members;
        const baseResolvedSymbol = this.resolveSymbol(this.getStaticSymbol(staticSymbol.filePath, staticSymbol.name));
        if (!baseResolvedSymbol) {
            return null;
        }
        let baseMetadata = unwrapResolvedMetadata(baseResolvedSymbol.metadata);
        if (baseMetadata instanceof StaticSymbol) {
            return new ResolvedStaticSymbol(staticSymbol, this.getStaticSymbol(baseMetadata.filePath, baseMetadata.name, members));
        }
        else if (baseMetadata && baseMetadata.__symbolic === 'class') {
            if (baseMetadata.statics && members.length === 1) {
                return new ResolvedStaticSymbol(staticSymbol, baseMetadata.statics[members[0]]);
            }
        }
        else {
            let value = baseMetadata;
            for (let i = 0; i < members.length && value; i++) {
                value = value[members[i]];
            }
            return new ResolvedStaticSymbol(staticSymbol, value);
        }
        return null;
    }
    _resolveSymbolFromSummary(staticSymbol) {
        const summary = this.summaryResolver.resolveSummary(staticSymbol);
        return summary ? new ResolvedStaticSymbol(staticSymbol, summary.metadata) : null;
    }
    /**
     * getStaticSymbol produces a Type whose metadata is known but whose implementation is not loaded.
     * All types passed to the StaticResolver should be pseudo-types returned by this method.
     *
     * @param declarationFile the absolute path of the file where the symbol is declared
     * @param name the name of the type.
     * @param members a symbol for a static member of the named type
     */
    getStaticSymbol(declarationFile, name, members) {
        return this.staticSymbolCache.get(declarationFile, name, members);
    }
    /**
     * hasDecorators checks a file's metadata for the presence of decorators without evaluating the
     * metadata.
     *
     * @param filePath the absolute path to examine for decorators.
     * @returns true if any class in the file has a decorator.
     */
    hasDecorators(filePath) {
        const metadata = this.getModuleMetadata(filePath);
        if (metadata['metadata']) {
            return Object.keys(metadata['metadata']).some((metadataKey) => {
                const entry = metadata['metadata'][metadataKey];
                return entry && entry.__symbolic === 'class' && entry.decorators;
            });
        }
        return false;
    }
    getSymbolsOf(filePath) {
        const summarySymbols = this.summaryResolver.getSymbolsOf(filePath);
        if (summarySymbols) {
            return summarySymbols;
        }
        // Note: Some users use libraries that were not compiled with ngc, i.e. they don't
        // have summaries, only .d.ts files, but `summaryResolver.isLibraryFile` returns true.
        this._createSymbolsOf(filePath);
        return this.symbolFromFile.get(filePath) || [];
    }
    _createSymbolsOf(filePath) {
        if (this.symbolFromFile.has(filePath)) {
            return;
        }
        const resolvedSymbols = [];
        const metadata = this.getModuleMetadata(filePath);
        if (metadata['importAs']) {
            // Index bundle indices should use the importAs module name defined
            // in the bundle.
            this.knownFileNameToModuleNames.set(filePath, metadata['importAs']);
        }
        // handle the symbols in one of the re-export location
        if (metadata['exports']) {
            for (const moduleExport of metadata['exports']) {
                // handle the symbols in the list of explicitly re-exported symbols.
                if (moduleExport.export) {
                    moduleExport.export.forEach((exportSymbol) => {
                        let symbolName;
                        if (typeof exportSymbol === 'string') {
                            symbolName = exportSymbol;
                        }
                        else {
                            symbolName = exportSymbol.as;
                        }
                        symbolName = unescapeIdentifier(symbolName);
                        let symName = symbolName;
                        if (typeof exportSymbol !== 'string') {
                            symName = unescapeIdentifier(exportSymbol.name);
                        }
                        const resolvedModule = this.resolveModule(moduleExport.from, filePath);
                        if (resolvedModule) {
                            const targetSymbol = this.getStaticSymbol(resolvedModule, symName);
                            const sourceSymbol = this.getStaticSymbol(filePath, symbolName);
                            resolvedSymbols.push(this.createExport(sourceSymbol, targetSymbol));
                        }
                    });
                }
                else {
                    // Handle the symbols loaded by 'export *' directives.
                    const resolvedModule = this.resolveModule(moduleExport.from, filePath);
                    if (resolvedModule && resolvedModule !== filePath) {
                        const nestedExports = this.getSymbolsOf(resolvedModule);
                        nestedExports.forEach((targetSymbol) => {
                            const sourceSymbol = this.getStaticSymbol(filePath, targetSymbol.name);
                            resolvedSymbols.push(this.createExport(sourceSymbol, targetSymbol));
                        });
                    }
                }
            }
        }
        // handle the actual metadata. Has to be after the exports
        // as there might be collisions in the names, and we want the symbols
        // of the current module to win ofter reexports.
        if (metadata['metadata']) {
            // handle direct declarations of the symbol
            const topLevelSymbolNames = new Set(Object.keys(metadata['metadata']).map(unescapeIdentifier));
            const origins = metadata['origins'] || {};
            Object.keys(metadata['metadata']).forEach((metadataKey) => {
                const symbolMeta = metadata['metadata'][metadataKey];
                const name = unescapeIdentifier(metadataKey);
                const symbol = this.getStaticSymbol(filePath, name);
                const origin = origins.hasOwnProperty(metadataKey) && origins[metadataKey];
                if (origin) {
                    // If the symbol is from a bundled index, use the declaration location of the
                    // symbol so relative references (such as './my.html') will be calculated
                    // correctly.
                    const originFilePath = this.resolveModule(origin, filePath);
                    if (!originFilePath) {
                        this.reportError(new Error(`Couldn't resolve original symbol for ${origin} from ${this.host.getOutputName(filePath)}`));
                    }
                    else {
                        this.symbolResourcePaths.set(symbol, originFilePath);
                    }
                }
                resolvedSymbols.push(this.createResolvedSymbol(symbol, filePath, topLevelSymbolNames, symbolMeta));
            });
        }
        const uniqueSymbols = new Set();
        for (const resolvedSymbol of resolvedSymbols) {
            this.resolvedSymbols.set(resolvedSymbol.symbol, resolvedSymbol);
            uniqueSymbols.add(resolvedSymbol.symbol);
        }
        this.symbolFromFile.set(filePath, Array.from(uniqueSymbols));
    }
    createResolvedSymbol(sourceSymbol, topLevelPath, topLevelSymbolNames, metadata) {
        // For classes that don't have Angular summaries / metadata,
        // we only keep their arity, but nothing else
        // (e.g. their constructor parameters).
        // We do this to prevent introducing deep imports
        // as we didn't generate .ngfactory.ts files with proper reexports.
        const isTsFile = TS.test(sourceSymbol.filePath);
        if (this.summaryResolver.isLibraryFile(sourceSymbol.filePath) && !isTsFile && metadata &&
            metadata['__symbolic'] === 'class') {
            const transformedMeta = { __symbolic: 'class', arity: metadata.arity };
            return new ResolvedStaticSymbol(sourceSymbol, transformedMeta);
        }
        let _originalFileMemo;
        const getOriginalName = () => {
            if (!_originalFileMemo) {
                // Guess what the original file name is from the reference. If it has a `.d.ts` extension
                // replace it with `.ts`. If it already has `.ts` just leave it in place. If it doesn't have
                // .ts or .d.ts, append `.ts'. Also, if it is in `node_modules`, trim the `node_module`
                // location as it is not important to finding the file.
                _originalFileMemo =
                    this.host.getOutputName(topLevelPath.replace(/((\.ts)|(\.d\.ts)|)$/, '.ts')
                        .replace(/^.*node_modules[/\\]/, ''));
            }
            return _originalFileMemo;
        };
        const self = this;
        class ReferenceTransformer extends ValueTransformer {
            visitStringMap(map, functionParams) {
                const symbolic = map['__symbolic'];
                if (symbolic === 'function') {
                    const oldLen = functionParams.length;
                    functionParams.push(...(map['parameters'] || []));
                    const result = super.visitStringMap(map, functionParams);
                    functionParams.length = oldLen;
                    return result;
                }
                else if (symbolic === 'reference') {
                    const module = map['module'];
                    const name = map['name'] ? unescapeIdentifier(map['name']) : map['name'];
                    if (!name) {
                        return null;
                    }
                    let filePath;
                    if (module) {
                        filePath = self.resolveModule(module, sourceSymbol.filePath);
                        if (!filePath) {
                            return {
                                __symbolic: 'error',
                                message: `Could not resolve ${module} relative to ${self.host.getMetadataFor(sourceSymbol.filePath)}.`,
                                line: map['line'],
                                character: map['character'],
                                fileName: getOriginalName()
                            };
                        }
                        return {
                            __symbolic: 'resolved',
                            symbol: self.getStaticSymbol(filePath, name),
                            line: map['line'],
                            character: map['character'],
                            fileName: getOriginalName()
                        };
                    }
                    else if (functionParams.indexOf(name) >= 0) {
                        // reference to a function parameter
                        return { __symbolic: 'reference', name: name };
                    }
                    else {
                        if (topLevelSymbolNames.has(name)) {
                            return self.getStaticSymbol(topLevelPath, name);
                        }
                        // ambient value
                        null;
                    }
                }
                else if (symbolic === 'error') {
                    return Object.assign(Object.assign({}, map), { fileName: getOriginalName() });
                }
                else {
                    return super.visitStringMap(map, functionParams);
                }
            }
        }
        const transformedMeta = visitValue(metadata, new ReferenceTransformer(), []);
        let unwrappedTransformedMeta = unwrapResolvedMetadata(transformedMeta);
        if (unwrappedTransformedMeta instanceof StaticSymbol) {
            return this.createExport(sourceSymbol, unwrappedTransformedMeta);
        }
        return new ResolvedStaticSymbol(sourceSymbol, transformedMeta);
    }
    createExport(sourceSymbol, targetSymbol) {
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
    }
    reportError(error, context, path) {
        if (this.errorRecorder) {
            this.errorRecorder(error, (context && context.filePath) || path);
        }
        else {
            throw error;
        }
    }
    /**
     * @param module an absolute path to a module file.
     */
    getModuleMetadata(module) {
        let moduleMetadata = this.metadataCache.get(module);
        if (!moduleMetadata) {
            const moduleMetadatas = this.host.getMetadataFor(module);
            if (moduleMetadatas) {
                let maxVersion = -1;
                moduleMetadatas.forEach((md) => {
                    if (md && md['version'] > maxVersion) {
                        maxVersion = md['version'];
                        moduleMetadata = md;
                    }
                });
            }
            if (!moduleMetadata) {
                moduleMetadata =
                    { __symbolic: 'module', version: SUPPORTED_SCHEMA_VERSION, module: module, metadata: {} };
            }
            if (moduleMetadata['version'] != SUPPORTED_SCHEMA_VERSION) {
                const errorMessage = moduleMetadata['version'] == 2 ?
                    `Unsupported metadata version ${moduleMetadata['version']} for module ${module}. This module should be compiled with a newer version of ngc` :
                    `Metadata version mismatch for module ${this.host.getOutputName(module)}, found version ${moduleMetadata['version']}, expected ${SUPPORTED_SCHEMA_VERSION}`;
                this.reportError(new Error(errorMessage));
            }
            this.metadataCache.set(module, moduleMetadata);
        }
        return moduleMetadata;
    }
    getSymbolByModule(module, symbolName, containingFile) {
        const filePath = this.resolveModule(module, containingFile);
        if (!filePath) {
            this.reportError(new Error(`Could not resolve module ${module}${containingFile ? ' relative to ' +
                this.host.getOutputName(containingFile) : ''}`));
            return this.getStaticSymbol(`ERROR:${module}`, symbolName);
        }
        return this.getStaticSymbol(filePath, symbolName);
    }
    resolveModule(module, containingFile) {
        try {
            return this.host.moduleNameToFileName(module, containingFile);
        }
        catch (e) {
            console.error(`Could not resolve module '${module}' relative to file ${containingFile}`);
            this.reportError(e, undefined, containingFile);
        }
        return null;
    }
}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3N5bWJvbF9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3RhdGljX3N5bWJvbF9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsVUFBVSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRXJELE9BQU8sRUFBQyxZQUFZLEVBQW9CLE1BQU0saUJBQWlCLENBQUM7QUFDaEUsT0FBTyxFQUFDLGVBQWUsRUFBRSw0QkFBNEIsRUFBRSw0QkFBNEIsRUFBRSxxQkFBcUIsRUFBRSxpQkFBaUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUU3SSxNQUFNLEVBQUUsR0FBRyx3QkFBd0IsQ0FBQztBQUVwQyxNQUFNLE9BQU8sb0JBQW9CO0lBQy9CLFlBQW1CLE1BQW9CLEVBQVMsUUFBYTtRQUExQyxXQUFNLEdBQU4sTUFBTSxDQUFjO1FBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBSztJQUFHLENBQUM7Q0FDbEU7QUFpQ0QsTUFBTSx3QkFBd0IsR0FBRyxDQUFDLENBQUM7QUFFbkM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7SUFVL0IsWUFDWSxJQUE4QixFQUFVLGlCQUFvQyxFQUM1RSxlQUE4QyxFQUM5QyxhQUF1RDtRQUZ2RCxTQUFJLEdBQUosSUFBSSxDQUEwQjtRQUFVLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDNUUsb0JBQWUsR0FBZixlQUFlLENBQStCO1FBQzlDLGtCQUFhLEdBQWIsYUFBYSxDQUEwQztRQVozRCxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO1FBQ2hFLDhEQUE4RDtRQUN0RCxvQkFBZSxHQUFHLElBQUksR0FBRyxFQUFzQyxDQUFDO1FBQ3hFLDhEQUE4RDtRQUN0RCxhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQThCLENB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QWMsQ0FBQyxDQUFDO1NBQy9EO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixNQUFNLHNCQUFzQixjQUFjLEVBQUUsQ0FBQyxDQUFDO1lBQ3pGLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxjQUFjLENBQUMsQ0FBQztTQUNoRDtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGO0FBRUQsbURBQW1EO0FBQ25ELG9GQUFvRjtBQUNwRixNQUFNLFVBQVUsa0JBQWtCLENBQUMsVUFBa0I7SUFDbkQsT0FBTyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDMUUsQ0FBQztBQUVELE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxRQUFhO0lBQ2xELElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFO1FBQ2xELE9BQU8sUUFBUSxDQUFDLE1BQU0sQ0FBQztLQUN4QjtJQUNELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3VtbWFyeVJlc29sdmVyfSBmcm9tICcuLi9zdW1tYXJ5X3Jlc29sdmVyJztcbmltcG9ydCB7VmFsdWVUcmFuc2Zvcm1lciwgdmlzaXRWYWx1ZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7U3RhdGljU3ltYm9sLCBTdGF0aWNTeW1ib2xDYWNoZX0gZnJvbSAnLi9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7aXNHZW5lcmF0ZWRGaWxlLCBzdHJpcFN1bW1hcnlGb3JKaXRGaWxlU3VmZml4LCBzdHJpcFN1bW1hcnlGb3JKaXROYW1lU3VmZml4LCBzdW1tYXJ5Rm9ySml0RmlsZU5hbWUsIHN1bW1hcnlGb3JKaXROYW1lfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBUUyA9IC9eKD8hLipcXC5kXFwudHMkKS4qXFwudHMkLztcblxuZXhwb3J0IGNsYXNzIFJlc29sdmVkU3RhdGljU3ltYm9sIHtcbiAgY29uc3RydWN0b3IocHVibGljIHN5bWJvbDogU3RhdGljU3ltYm9sLCBwdWJsaWMgbWV0YWRhdGE6IGFueSkge31cbn1cblxuLyoqXG4gKiBUaGUgaG9zdCBvZiB0aGUgU3ltYm9sUmVzb2x2ZXJIb3N0IGRpc2Nvbm5lY3RzIHRoZSBpbXBsZW1lbnRhdGlvbiBmcm9tIFR5cGVTY3JpcHQgLyBvdGhlclxuICogbGFuZ3VhZ2VcbiAqIHNlcnZpY2VzIGFuZCBmcm9tIHVuZGVybHlpbmcgZmlsZSBzeXN0ZW1zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRpY1N5bWJvbFJlc29sdmVySG9zdCB7XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBNb2R1bGVNZXRhZGF0YSBmb3IgdGhlIGdpdmVuIG1vZHVsZS5cbiAgICogQW5ndWxhciBDTEkgd2lsbCBwcm9kdWNlIHRoaXMgbWV0YWRhdGEgZm9yIGEgbW9kdWxlIHdoZW5ldmVyIGEgLmQudHMgZmlsZXMgaXNcbiAgICogcHJvZHVjZWQgYW5kIHRoZSBtb2R1bGUgaGFzIGV4cG9ydGVkIHZhcmlhYmxlcyBvciBjbGFzc2VzIHdpdGggZGVjb3JhdG9ycy4gTW9kdWxlIG1ldGFkYXRhIGNhblxuICAgKiBhbHNvIGJlIHByb2R1Y2VkIGRpcmVjdGx5IGZyb20gVHlwZVNjcmlwdCBzb3VyY2VzIGJ5IHVzaW5nIE1ldGFkYXRhQ29sbGVjdG9yIGluIHRvb2xzL21ldGFkYXRhLlxuICAgKlxuICAgKiBAcGFyYW0gbW9kdWxlUGF0aCBpcyBhIHN0cmluZyBpZGVudGlmaWVyIGZvciBhIG1vZHVsZSBhcyBhbiBhYnNvbHV0ZSBwYXRoLlxuICAgKiBAcmV0dXJucyB0aGUgbWV0YWRhdGEgZm9yIHRoZSBnaXZlbiBtb2R1bGUuXG4gICAqL1xuICBnZXRNZXRhZGF0YUZvcihtb2R1bGVQYXRoOiBzdHJpbmcpOiB7W2tleTogc3RyaW5nXTogYW55fVtdfHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogQ29udmVydHMgYSBtb2R1bGUgbmFtZSB0aGF0IGlzIHVzZWQgaW4gYW4gYGltcG9ydGAgdG8gYSBmaWxlIHBhdGguXG4gICAqIEkuZS5cbiAgICogYHBhdGgvdG8vY29udGFpbmluZ0ZpbGUudHNgIGNvbnRhaW5pbmcgYGltcG9ydCB7Li4ufSBmcm9tICdtb2R1bGUtbmFtZSdgLlxuICAgKi9cbiAgbW9kdWxlTmFtZVRvRmlsZU5hbWUobW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBHZXQgYSBmaWxlIHN1aXRhYmxlIGZvciBkaXNwbGF5IHRvIHRoZSB1c2VyIHRoYXQgc2hvdWxkIGJlIHJlbGF0aXZlIHRvIHRoZSBwcm9qZWN0IGRpcmVjdG9yeVxuICAgKiBvciB0aGUgY3VycmVudCBkaXJlY3RvcnkuXG4gICAqL1xuICBnZXRPdXRwdXROYW1lKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmc7XG59XG5cbmNvbnN0IFNVUFBPUlRFRF9TQ0hFTUFfVkVSU0lPTiA9IDQ7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyByZXNwb25zaWJsZSBmb3IgbG9hZGluZyBtZXRhZGF0YSBwZXIgc3ltYm9sLFxuICogYW5kIG5vcm1hbGl6aW5nIHJlZmVyZW5jZXMgYmV0d2VlbiBzeW1ib2xzLlxuICpcbiAqIEludGVybmFsbHksIGl0IG9ubHkgdXNlcyBzeW1ib2xzIHdpdGhvdXQgbWVtYmVycyxcbiAqIGFuZCBkZWR1Y2VzIHRoZSB2YWx1ZXMgZm9yIHN5bWJvbHMgd2l0aCBtZW1iZXJzIGJhc2VkXG4gKiBvbiB0aGVzZSBzeW1ib2xzLlxuICovXG5leHBvcnQgY2xhc3MgU3RhdGljU3ltYm9sUmVzb2x2ZXIge1xuICBwcml2YXRlIG1ldGFkYXRhQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywge1trZXk6IHN0cmluZ106IGFueX0+KCk7XG4gIC8vIE5vdGU6IHRoaXMgd2lsbCBvbmx5IGNvbnRhaW4gU3RhdGljU3ltYm9scyB3aXRob3V0IG1lbWJlcnMhXG4gIHByaXZhdGUgcmVzb2x2ZWRTeW1ib2xzID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIFJlc29sdmVkU3RhdGljU3ltYm9sPigpO1xuICAvLyBOb3RlOiB0aGlzIHdpbGwgb25seSBjb250YWluIFN0YXRpY1N5bWJvbHMgd2l0aG91dCBtZW1iZXJzIVxuICBwcml2YXRlIGltcG9ydEFzID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIFN0YXRpY1N5bWJvbD4oKTtcbiAgcHJpdmF0ZSBzeW1ib2xSZXNvdXJjZVBhdGhzID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIHN0cmluZz4oKTtcbiAgcHJpdmF0ZSBzeW1ib2xGcm9tRmlsZSA9IG5ldyBNYXA8c3RyaW5nLCBTdGF0aWNTeW1ib2xbXT4oKTtcbiAgcHJpdmF0ZSBrbm93bkZpbGVOYW1lVG9Nb2R1bGVOYW1lcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGhvc3Q6IFN0YXRpY1N5bWJvbFJlc29sdmVySG9zdCwgcHJpdmF0ZSBzdGF0aWNTeW1ib2xDYWNoZTogU3RhdGljU3ltYm9sQ2FjaGUsXG4gICAgICBwcml2YXRlIHN1bW1hcnlSZXNvbHZlcjogU3VtbWFyeVJlc29sdmVyPFN0YXRpY1N5bWJvbD4sXG4gICAgICBwcml2YXRlIGVycm9yUmVjb3JkZXI/OiAoZXJyb3I6IGFueSwgZmlsZU5hbWU/OiBzdHJpbmcpID0+IHZvaWQpIHt9XG5cbiAgcmVzb2x2ZVN5bWJvbChzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IFJlc29sdmVkU3RhdGljU3ltYm9sIHtcbiAgICBpZiAoc3RhdGljU3ltYm9sLm1lbWJlcnMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdmVTeW1ib2xNZW1iZXJzKHN0YXRpY1N5bWJvbCkgITtcbiAgICB9XG4gICAgLy8gTm90ZTogYWx3YXlzIGFzayBmb3IgYSBzdW1tYXJ5IGZpcnN0LFxuICAgIC8vIGFzIHdlIG1pZ2h0IGhhdmUgcmVhZCBzaGFsbG93IG1ldGFkYXRhIHZpYSBhIC5kLnRzIGZpbGVcbiAgICAvLyBmb3IgdGhlIHN5bWJvbC5cbiAgICBjb25zdCByZXN1bHRGcm9tU3VtbWFyeSA9IHRoaXMuX3Jlc29sdmVTeW1ib2xGcm9tU3VtbWFyeShzdGF0aWNTeW1ib2wpICE7XG4gICAgaWYgKHJlc3VsdEZyb21TdW1tYXJ5KSB7XG4gICAgICByZXR1cm4gcmVzdWx0RnJvbVN1bW1hcnk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdEZyb21DYWNoZSA9IHRoaXMucmVzb2x2ZWRTeW1ib2xzLmdldChzdGF0aWNTeW1ib2wpO1xuICAgIGlmIChyZXN1bHRGcm9tQ2FjaGUpIHtcbiAgICAgIHJldHVybiByZXN1bHRGcm9tQ2FjaGU7XG4gICAgfVxuICAgIC8vIE5vdGU6IFNvbWUgdXNlcnMgdXNlIGxpYnJhcmllcyB0aGF0IHdlcmUgbm90IGNvbXBpbGVkIHdpdGggbmdjLCBpLmUuIHRoZXkgZG9uJ3RcbiAgICAvLyBoYXZlIHN1bW1hcmllcywgb25seSAuZC50cyBmaWxlcy4gU28gd2UgYWx3YXlzIG5lZWQgdG8gY2hlY2sgYm90aCwgdGhlIHN1bW1hcnlcbiAgICAvLyBhbmQgbWV0YWRhdGEuXG4gICAgdGhpcy5fY3JlYXRlU3ltYm9sc09mKHN0YXRpY1N5bWJvbC5maWxlUGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucmVzb2x2ZWRTeW1ib2xzLmdldChzdGF0aWNTeW1ib2wpICE7XG4gIH1cblxuICAvKipcbiAgICogZ2V0SW1wb3J0QXMgcHJvZHVjZXMgYSBzeW1ib2wgdGhhdCBjYW4gYmUgdXNlZCB0byBpbXBvcnQgdGhlIGdpdmVuIHN5bWJvbC5cbiAgICogVGhlIGltcG9ydCBtaWdodCBiZSBkaWZmZXJlbnQgdGhhbiB0aGUgc3ltYm9sIGlmIHRoZSBzeW1ib2wgaXMgZXhwb3J0ZWQgZnJvbVxuICAgKiBhIGxpYnJhcnkgd2l0aCBhIHN1bW1hcnk7IGluIHdoaWNoIGNhc2Ugd2Ugd2FudCB0byBpbXBvcnQgdGhlIHN5bWJvbCBmcm9tIHRoZVxuICAgKiBuZ2ZhY3RvcnkgcmUtZXhwb3J0IGluc3RlYWQgb2YgZGlyZWN0bHkgdG8gYXZvaWQgaW50cm9kdWNpbmcgYSBkaXJlY3QgZGVwZW5kZW5jeVxuICAgKiBvbiBhbiBvdGhlcndpc2UgaW5kaXJlY3QgZGVwZW5kZW5jeS5cbiAgICpcbiAgICogQHBhcmFtIHN0YXRpY1N5bWJvbCB0aGUgc3ltYm9sIGZvciB3aGljaCB0byBnZW5lcmF0ZSBhIGltcG9ydCBzeW1ib2xcbiAgICovXG4gIGdldEltcG9ydEFzKHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sLCB1c2VTdW1tYXJpZXM6IGJvb2xlYW4gPSB0cnVlKTogU3RhdGljU3ltYm9sfG51bGwge1xuICAgIGlmIChzdGF0aWNTeW1ib2wubWVtYmVycy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGJhc2VTeW1ib2wgPSB0aGlzLmdldFN0YXRpY1N5bWJvbChzdGF0aWNTeW1ib2wuZmlsZVBhdGgsIHN0YXRpY1N5bWJvbC5uYW1lKTtcbiAgICAgIGNvbnN0IGJhc2VJbXBvcnRBcyA9IHRoaXMuZ2V0SW1wb3J0QXMoYmFzZVN5bWJvbCwgdXNlU3VtbWFyaWVzKTtcbiAgICAgIHJldHVybiBiYXNlSW1wb3J0QXMgP1xuICAgICAgICAgIHRoaXMuZ2V0U3RhdGljU3ltYm9sKGJhc2VJbXBvcnRBcy5maWxlUGF0aCwgYmFzZUltcG9ydEFzLm5hbWUsIHN0YXRpY1N5bWJvbC5tZW1iZXJzKSA6XG4gICAgICAgICAgbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3VtbWFyaXplZEZpbGVOYW1lID0gc3RyaXBTdW1tYXJ5Rm9ySml0RmlsZVN1ZmZpeChzdGF0aWNTeW1ib2wuZmlsZVBhdGgpO1xuICAgIGlmIChzdW1tYXJpemVkRmlsZU5hbWUgIT09IHN0YXRpY1N5bWJvbC5maWxlUGF0aCkge1xuICAgICAgY29uc3Qgc3VtbWFyaXplZE5hbWUgPSBzdHJpcFN1bW1hcnlGb3JKaXROYW1lU3VmZml4KHN0YXRpY1N5bWJvbC5uYW1lKTtcbiAgICAgIGNvbnN0IGJhc2VTeW1ib2wgPVxuICAgICAgICAgIHRoaXMuZ2V0U3RhdGljU3ltYm9sKHN1bW1hcml6ZWRGaWxlTmFtZSwgc3VtbWFyaXplZE5hbWUsIHN0YXRpY1N5bWJvbC5tZW1iZXJzKTtcbiAgICAgIGNvbnN0IGJhc2VJbXBvcnRBcyA9IHRoaXMuZ2V0SW1wb3J0QXMoYmFzZVN5bWJvbCwgdXNlU3VtbWFyaWVzKTtcbiAgICAgIHJldHVybiBiYXNlSW1wb3J0QXMgP1xuICAgICAgICAgIHRoaXMuZ2V0U3RhdGljU3ltYm9sKFxuICAgICAgICAgICAgICBzdW1tYXJ5Rm9ySml0RmlsZU5hbWUoYmFzZUltcG9ydEFzLmZpbGVQYXRoKSwgc3VtbWFyeUZvckppdE5hbWUoYmFzZUltcG9ydEFzLm5hbWUpLFxuICAgICAgICAgICAgICBiYXNlU3ltYm9sLm1lbWJlcnMpIDpcbiAgICAgICAgICBudWxsO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0ID0gKHVzZVN1bW1hcmllcyAmJiB0aGlzLnN1bW1hcnlSZXNvbHZlci5nZXRJbXBvcnRBcyhzdGF0aWNTeW1ib2wpKSB8fCBudWxsO1xuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICByZXN1bHQgPSB0aGlzLmltcG9ydEFzLmdldChzdGF0aWNTeW1ib2wpICE7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogZ2V0UmVzb3VyY2VQYXRoIHByb2R1Y2VzIHRoZSBwYXRoIHRvIHRoZSBvcmlnaW5hbCBsb2NhdGlvbiBvZiB0aGUgc3ltYm9sIGFuZCBzaG91bGRcbiAgICogYmUgdXNlZCB0byBkZXRlcm1pbmUgdGhlIHJlbGF0aXZlIGxvY2F0aW9uIG9mIHJlc291cmNlIHJlZmVyZW5jZXMgcmVjb3JkZWQgaW5cbiAgICogc3ltYm9sIG1ldGFkYXRhLlxuICAgKi9cbiAgZ2V0UmVzb3VyY2VQYXRoKHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xSZXNvdXJjZVBhdGhzLmdldChzdGF0aWNTeW1ib2wpIHx8IHN0YXRpY1N5bWJvbC5maWxlUGF0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBnZXRUeXBlQXJpdHkgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGdlbmVyaWMgdHlwZSBwYXJhbWV0ZXJzIHRoZSBnaXZlbiBzeW1ib2xcbiAgICogaGFzLiBJZiB0aGUgc3ltYm9sIGlzIG5vdCBhIHR5cGUgdGhlIHJlc3VsdCBpcyBudWxsLlxuICAgKi9cbiAgZ2V0VHlwZUFyaXR5KHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sKTogbnVtYmVyfG51bGwge1xuICAgIC8vIElmIHRoZSBmaWxlIGlzIGEgZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZSwgZG9uJ3QgcmVzb2x2ZSB0aGUgc3ltYm9sIGFzIGRvaW5nIHNvIHdvdWxkXG4gICAgLy8gY2F1c2UgdGhlIG1ldGFkYXRhIGZvciBhbiBmYWN0b3J5L25nc3VtbWFyeSBmaWxlIHRvIGJlIGxvYWRlZCB3aGljaCBkb2Vzbid0IGV4aXN0LlxuICAgIC8vIEFsbCByZWZlcmVuY2VzIHRvIGdlbmVyYXRlZCBjbGFzc2VzIG11c3QgaW5jbHVkZSB0aGUgY29ycmVjdCBhcml0eSB3aGVuZXZlclxuICAgIC8vIGdlbmVyYXRpbmcgY29kZS5cbiAgICBpZiAoaXNHZW5lcmF0ZWRGaWxlKHN0YXRpY1N5bWJvbC5maWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgcmVzb2x2ZWRTeW1ib2wgPSB1bndyYXBSZXNvbHZlZE1ldGFkYXRhKHRoaXMucmVzb2x2ZVN5bWJvbChzdGF0aWNTeW1ib2wpKTtcbiAgICB3aGlsZSAocmVzb2x2ZWRTeW1ib2wgJiYgcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJlc29sdmVkU3ltYm9sID0gdW53cmFwUmVzb2x2ZWRNZXRhZGF0YSh0aGlzLnJlc29sdmVTeW1ib2wocmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEpKTtcbiAgICB9XG4gICAgcmV0dXJuIChyZXNvbHZlZFN5bWJvbCAmJiByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSAmJiByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YS5hcml0eSkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldEtub3duTW9kdWxlTmFtZShmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICAgIHJldHVybiB0aGlzLmtub3duRmlsZU5hbWVUb01vZHVsZU5hbWVzLmdldChmaWxlUGF0aCkgfHwgbnVsbDtcbiAgfVxuXG4gIHJlY29yZEltcG9ydEFzKHNvdXJjZVN5bWJvbDogU3RhdGljU3ltYm9sLCB0YXJnZXRTeW1ib2w6IFN0YXRpY1N5bWJvbCkge1xuICAgIHNvdXJjZVN5bWJvbC5hc3NlcnROb01lbWJlcnMoKTtcbiAgICB0YXJnZXRTeW1ib2wuYXNzZXJ0Tm9NZW1iZXJzKCk7XG4gICAgdGhpcy5pbXBvcnRBcy5zZXQoc291cmNlU3ltYm9sLCB0YXJnZXRTeW1ib2wpO1xuICB9XG5cbiAgcmVjb3JkTW9kdWxlTmFtZUZvckZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcsIG1vZHVsZU5hbWU6IHN0cmluZykge1xuICAgIHRoaXMua25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMuc2V0KGZpbGVOYW1lLCBtb2R1bGVOYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZhbGlkYXRlIGFsbCBpbmZvcm1hdGlvbiBkZXJpdmVkIGZyb20gdGhlIGdpdmVuIGZpbGUgYW5kIHJldHVybiB0aGVcbiAgICogc3RhdGljIHN5bWJvbHMgY29udGFpbmVkIGluIHRoZSBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gZmlsZU5hbWUgdGhlIGZpbGUgdG8gaW52YWxpZGF0ZVxuICAgKi9cbiAgaW52YWxpZGF0ZUZpbGUoZmlsZU5hbWU6IHN0cmluZyk6IFN0YXRpY1N5bWJvbFtdIHtcbiAgICB0aGlzLm1ldGFkYXRhQ2FjaGUuZGVsZXRlKGZpbGVOYW1lKTtcbiAgICBjb25zdCBzeW1ib2xzID0gdGhpcy5zeW1ib2xGcm9tRmlsZS5nZXQoZmlsZU5hbWUpO1xuICAgIGlmICghc3ltYm9scykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICB0aGlzLnN5bWJvbEZyb21GaWxlLmRlbGV0ZShmaWxlTmFtZSk7XG4gICAgZm9yIChjb25zdCBzeW1ib2wgb2Ygc3ltYm9scykge1xuICAgICAgdGhpcy5yZXNvbHZlZFN5bWJvbHMuZGVsZXRlKHN5bWJvbCk7XG4gICAgICB0aGlzLmltcG9ydEFzLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5zeW1ib2xSZXNvdXJjZVBhdGhzLmRlbGV0ZShzeW1ib2wpO1xuICAgIH1cbiAgICByZXR1cm4gc3ltYm9scztcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgaWdub3JlRXJyb3JzRm9yPFQ+KGNiOiAoKSA9PiBUKSB7XG4gICAgY29uc3QgcmVjb3JkZXIgPSB0aGlzLmVycm9yUmVjb3JkZXI7XG4gICAgdGhpcy5lcnJvclJlY29yZGVyID0gKCkgPT4ge307XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBjYigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmVycm9yUmVjb3JkZXIgPSByZWNvcmRlcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9yZXNvbHZlU3ltYm9sTWVtYmVycyhzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IFJlc29sdmVkU3RhdGljU3ltYm9sfG51bGwge1xuICAgIGNvbnN0IG1lbWJlcnMgPSBzdGF0aWNTeW1ib2wubWVtYmVycztcbiAgICBjb25zdCBiYXNlUmVzb2x2ZWRTeW1ib2wgPVxuICAgICAgICB0aGlzLnJlc29sdmVTeW1ib2wodGhpcy5nZXRTdGF0aWNTeW1ib2woc3RhdGljU3ltYm9sLmZpbGVQYXRoLCBzdGF0aWNTeW1ib2wubmFtZSkpO1xuICAgIGlmICghYmFzZVJlc29sdmVkU3ltYm9sKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbGV0IGJhc2VNZXRhZGF0YSA9IHVud3JhcFJlc29sdmVkTWV0YWRhdGEoYmFzZVJlc29sdmVkU3ltYm9sLm1ldGFkYXRhKTtcbiAgICBpZiAoYmFzZU1ldGFkYXRhIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICByZXR1cm4gbmV3IFJlc29sdmVkU3RhdGljU3ltYm9sKFxuICAgICAgICAgIHN0YXRpY1N5bWJvbCwgdGhpcy5nZXRTdGF0aWNTeW1ib2woYmFzZU1ldGFkYXRhLmZpbGVQYXRoLCBiYXNlTWV0YWRhdGEubmFtZSwgbWVtYmVycykpO1xuICAgIH0gZWxzZSBpZiAoYmFzZU1ldGFkYXRhICYmIGJhc2VNZXRhZGF0YS5fX3N5bWJvbGljID09PSAnY2xhc3MnKSB7XG4gICAgICBpZiAoYmFzZU1ldGFkYXRhLnN0YXRpY3MgJiYgbWVtYmVycy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChzdGF0aWNTeW1ib2wsIGJhc2VNZXRhZGF0YS5zdGF0aWNzW21lbWJlcnNbMF1dKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHZhbHVlID0gYmFzZU1ldGFkYXRhO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZW1iZXJzLmxlbmd0aCAmJiB2YWx1ZTsgaSsrKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWVbbWVtYmVyc1tpXV07XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFJlc29sdmVkU3RhdGljU3ltYm9sKHN0YXRpY1N5bWJvbCwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX3Jlc29sdmVTeW1ib2xGcm9tU3VtbWFyeShzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IFJlc29sdmVkU3RhdGljU3ltYm9sfG51bGwge1xuICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLnN1bW1hcnlSZXNvbHZlci5yZXNvbHZlU3VtbWFyeShzdGF0aWNTeW1ib2wpO1xuICAgIHJldHVybiBzdW1tYXJ5ID8gbmV3IFJlc29sdmVkU3RhdGljU3ltYm9sKHN0YXRpY1N5bWJvbCwgc3VtbWFyeS5tZXRhZGF0YSkgOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIGdldFN0YXRpY1N5bWJvbCBwcm9kdWNlcyBhIFR5cGUgd2hvc2UgbWV0YWRhdGEgaXMga25vd24gYnV0IHdob3NlIGltcGxlbWVudGF0aW9uIGlzIG5vdCBsb2FkZWQuXG4gICAqIEFsbCB0eXBlcyBwYXNzZWQgdG8gdGhlIFN0YXRpY1Jlc29sdmVyIHNob3VsZCBiZSBwc2V1ZG8tdHlwZXMgcmV0dXJuZWQgYnkgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSBkZWNsYXJhdGlvbkZpbGUgdGhlIGFic29sdXRlIHBhdGggb2YgdGhlIGZpbGUgd2hlcmUgdGhlIHN5bWJvbCBpcyBkZWNsYXJlZFxuICAgKiBAcGFyYW0gbmFtZSB0aGUgbmFtZSBvZiB0aGUgdHlwZS5cbiAgICogQHBhcmFtIG1lbWJlcnMgYSBzeW1ib2wgZm9yIGEgc3RhdGljIG1lbWJlciBvZiB0aGUgbmFtZWQgdHlwZVxuICAgKi9cbiAgZ2V0U3RhdGljU3ltYm9sKGRlY2xhcmF0aW9uRmlsZTogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIG1lbWJlcnM/OiBzdHJpbmdbXSk6IFN0YXRpY1N5bWJvbCB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGljU3ltYm9sQ2FjaGUuZ2V0KGRlY2xhcmF0aW9uRmlsZSwgbmFtZSwgbWVtYmVycyk7XG4gIH1cblxuICAvKipcbiAgICogaGFzRGVjb3JhdG9ycyBjaGVja3MgYSBmaWxlJ3MgbWV0YWRhdGEgZm9yIHRoZSBwcmVzZW5jZSBvZiBkZWNvcmF0b3JzIHdpdGhvdXQgZXZhbHVhdGluZyB0aGVcbiAgICogbWV0YWRhdGEuXG4gICAqXG4gICAqIEBwYXJhbSBmaWxlUGF0aCB0aGUgYWJzb2x1dGUgcGF0aCB0byBleGFtaW5lIGZvciBkZWNvcmF0b3JzLlxuICAgKiBAcmV0dXJucyB0cnVlIGlmIGFueSBjbGFzcyBpbiB0aGUgZmlsZSBoYXMgYSBkZWNvcmF0b3IuXG4gICAqL1xuICBoYXNEZWNvcmF0b3JzKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBtZXRhZGF0YSA9IHRoaXMuZ2V0TW9kdWxlTWV0YWRhdGEoZmlsZVBhdGgpO1xuICAgIGlmIChtZXRhZGF0YVsnbWV0YWRhdGEnXSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKG1ldGFkYXRhWydtZXRhZGF0YSddKS5zb21lKChtZXRhZGF0YUtleSkgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IG1ldGFkYXRhWydtZXRhZGF0YSddW21ldGFkYXRhS2V5XTtcbiAgICAgICAgcmV0dXJuIGVudHJ5ICYmIGVudHJ5Ll9fc3ltYm9saWMgPT09ICdjbGFzcycgJiYgZW50cnkuZGVjb3JhdG9ycztcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBnZXRTeW1ib2xzT2YoZmlsZVBhdGg6IHN0cmluZyk6IFN0YXRpY1N5bWJvbFtdIHtcbiAgICBjb25zdCBzdW1tYXJ5U3ltYm9scyA9IHRoaXMuc3VtbWFyeVJlc29sdmVyLmdldFN5bWJvbHNPZihmaWxlUGF0aCk7XG4gICAgaWYgKHN1bW1hcnlTeW1ib2xzKSB7XG4gICAgICByZXR1cm4gc3VtbWFyeVN5bWJvbHM7XG4gICAgfVxuICAgIC8vIE5vdGU6IFNvbWUgdXNlcnMgdXNlIGxpYnJhcmllcyB0aGF0IHdlcmUgbm90IGNvbXBpbGVkIHdpdGggbmdjLCBpLmUuIHRoZXkgZG9uJ3RcbiAgICAvLyBoYXZlIHN1bW1hcmllcywgb25seSAuZC50cyBmaWxlcywgYnV0IGBzdW1tYXJ5UmVzb2x2ZXIuaXNMaWJyYXJ5RmlsZWAgcmV0dXJucyB0cnVlLlxuICAgIHRoaXMuX2NyZWF0ZVN5bWJvbHNPZihmaWxlUGF0aCk7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9sRnJvbUZpbGUuZ2V0KGZpbGVQYXRoKSB8fCBbXTtcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZVN5bWJvbHNPZihmaWxlUGF0aDogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuc3ltYm9sRnJvbUZpbGUuaGFzKGZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZXNvbHZlZFN5bWJvbHM6IFJlc29sdmVkU3RhdGljU3ltYm9sW10gPSBbXTtcbiAgICBjb25zdCBtZXRhZGF0YSA9IHRoaXMuZ2V0TW9kdWxlTWV0YWRhdGEoZmlsZVBhdGgpO1xuICAgIGlmIChtZXRhZGF0YVsnaW1wb3J0QXMnXSkge1xuICAgICAgLy8gSW5kZXggYnVuZGxlIGluZGljZXMgc2hvdWxkIHVzZSB0aGUgaW1wb3J0QXMgbW9kdWxlIG5hbWUgZGVmaW5lZFxuICAgICAgLy8gaW4gdGhlIGJ1bmRsZS5cbiAgICAgIHRoaXMua25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMuc2V0KGZpbGVQYXRoLCBtZXRhZGF0YVsnaW1wb3J0QXMnXSk7XG4gICAgfVxuICAgIC8vIGhhbmRsZSB0aGUgc3ltYm9scyBpbiBvbmUgb2YgdGhlIHJlLWV4cG9ydCBsb2NhdGlvblxuICAgIGlmIChtZXRhZGF0YVsnZXhwb3J0cyddKSB7XG4gICAgICBmb3IgKGNvbnN0IG1vZHVsZUV4cG9ydCBvZiBtZXRhZGF0YVsnZXhwb3J0cyddKSB7XG4gICAgICAgIC8vIGhhbmRsZSB0aGUgc3ltYm9scyBpbiB0aGUgbGlzdCBvZiBleHBsaWNpdGx5IHJlLWV4cG9ydGVkIHN5bWJvbHMuXG4gICAgICAgIGlmIChtb2R1bGVFeHBvcnQuZXhwb3J0KSB7XG4gICAgICAgICAgbW9kdWxlRXhwb3J0LmV4cG9ydC5mb3JFYWNoKChleHBvcnRTeW1ib2w6IGFueSkgPT4ge1xuICAgICAgICAgICAgbGV0IHN5bWJvbE5hbWU6IHN0cmluZztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwb3J0U3ltYm9sID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICBzeW1ib2xOYW1lID0gZXhwb3J0U3ltYm9sO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3ltYm9sTmFtZSA9IGV4cG9ydFN5bWJvbC5hcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN5bWJvbE5hbWUgPSB1bmVzY2FwZUlkZW50aWZpZXIoc3ltYm9sTmFtZSk7XG4gICAgICAgICAgICBsZXQgc3ltTmFtZSA9IHN5bWJvbE5hbWU7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydFN5bWJvbCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgc3ltTmFtZSA9IHVuZXNjYXBlSWRlbnRpZmllcihleHBvcnRTeW1ib2wubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZE1vZHVsZSA9IHRoaXMucmVzb2x2ZU1vZHVsZShtb2R1bGVFeHBvcnQuZnJvbSwgZmlsZVBhdGgpO1xuICAgICAgICAgICAgaWYgKHJlc29sdmVkTW9kdWxlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhcmdldFN5bWJvbCA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKHJlc29sdmVkTW9kdWxlLCBzeW1OYW1lKTtcbiAgICAgICAgICAgICAgY29uc3Qgc291cmNlU3ltYm9sID0gdGhpcy5nZXRTdGF0aWNTeW1ib2woZmlsZVBhdGgsIHN5bWJvbE5hbWUpO1xuICAgICAgICAgICAgICByZXNvbHZlZFN5bWJvbHMucHVzaCh0aGlzLmNyZWF0ZUV4cG9ydChzb3VyY2VTeW1ib2wsIHRhcmdldFN5bWJvbCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEhhbmRsZSB0aGUgc3ltYm9scyBsb2FkZWQgYnkgJ2V4cG9ydCAqJyBkaXJlY3RpdmVzLlxuICAgICAgICAgIGNvbnN0IHJlc29sdmVkTW9kdWxlID0gdGhpcy5yZXNvbHZlTW9kdWxlKG1vZHVsZUV4cG9ydC5mcm9tLCBmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKHJlc29sdmVkTW9kdWxlICYmIHJlc29sdmVkTW9kdWxlICE9PSBmaWxlUGF0aCkge1xuICAgICAgICAgICAgY29uc3QgbmVzdGVkRXhwb3J0cyA9IHRoaXMuZ2V0U3ltYm9sc09mKHJlc29sdmVkTW9kdWxlKTtcbiAgICAgICAgICAgIG5lc3RlZEV4cG9ydHMuZm9yRWFjaCgodGFyZ2V0U3ltYm9sKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHNvdXJjZVN5bWJvbCA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKGZpbGVQYXRoLCB0YXJnZXRTeW1ib2wubmFtZSk7XG4gICAgICAgICAgICAgIHJlc29sdmVkU3ltYm9scy5wdXNoKHRoaXMuY3JlYXRlRXhwb3J0KHNvdXJjZVN5bWJvbCwgdGFyZ2V0U3ltYm9sKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBoYW5kbGUgdGhlIGFjdHVhbCBtZXRhZGF0YS4gSGFzIHRvIGJlIGFmdGVyIHRoZSBleHBvcnRzXG4gICAgLy8gYXMgdGhlcmUgbWlnaHQgYmUgY29sbGlzaW9ucyBpbiB0aGUgbmFtZXMsIGFuZCB3ZSB3YW50IHRoZSBzeW1ib2xzXG4gICAgLy8gb2YgdGhlIGN1cnJlbnQgbW9kdWxlIHRvIHdpbiBvZnRlciByZWV4cG9ydHMuXG4gICAgaWYgKG1ldGFkYXRhWydtZXRhZGF0YSddKSB7XG4gICAgICAvLyBoYW5kbGUgZGlyZWN0IGRlY2xhcmF0aW9ucyBvZiB0aGUgc3ltYm9sXG4gICAgICBjb25zdCB0b3BMZXZlbFN5bWJvbE5hbWVzID1cbiAgICAgICAgICBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LmtleXMobWV0YWRhdGFbJ21ldGFkYXRhJ10pLm1hcCh1bmVzY2FwZUlkZW50aWZpZXIpKTtcbiAgICAgIGNvbnN0IG9yaWdpbnM6IHtbaW5kZXg6IHN0cmluZ106IHN0cmluZ30gPSBtZXRhZGF0YVsnb3JpZ2lucyddIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMobWV0YWRhdGFbJ21ldGFkYXRhJ10pLmZvckVhY2goKG1ldGFkYXRhS2V5KSA9PiB7XG4gICAgICAgIGNvbnN0IHN5bWJvbE1ldGEgPSBtZXRhZGF0YVsnbWV0YWRhdGEnXVttZXRhZGF0YUtleV07XG4gICAgICAgIGNvbnN0IG5hbWUgPSB1bmVzY2FwZUlkZW50aWZpZXIobWV0YWRhdGFLZXkpO1xuXG4gICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKGZpbGVQYXRoLCBuYW1lKTtcblxuICAgICAgICBjb25zdCBvcmlnaW4gPSBvcmlnaW5zLmhhc093blByb3BlcnR5KG1ldGFkYXRhS2V5KSAmJiBvcmlnaW5zW21ldGFkYXRhS2V5XTtcbiAgICAgICAgaWYgKG9yaWdpbikge1xuICAgICAgICAgIC8vIElmIHRoZSBzeW1ib2wgaXMgZnJvbSBhIGJ1bmRsZWQgaW5kZXgsIHVzZSB0aGUgZGVjbGFyYXRpb24gbG9jYXRpb24gb2YgdGhlXG4gICAgICAgICAgLy8gc3ltYm9sIHNvIHJlbGF0aXZlIHJlZmVyZW5jZXMgKHN1Y2ggYXMgJy4vbXkuaHRtbCcpIHdpbGwgYmUgY2FsY3VsYXRlZFxuICAgICAgICAgIC8vIGNvcnJlY3RseS5cbiAgICAgICAgICBjb25zdCBvcmlnaW5GaWxlUGF0aCA9IHRoaXMucmVzb2x2ZU1vZHVsZShvcmlnaW4sIGZpbGVQYXRoKTtcbiAgICAgICAgICBpZiAoIW9yaWdpbkZpbGVQYXRoKSB7XG4gICAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgQ291bGRuJ3QgcmVzb2x2ZSBvcmlnaW5hbCBzeW1ib2wgZm9yICR7b3JpZ2lufSBmcm9tICR7dGhpcy5ob3N0LmdldE91dHB1dE5hbWUoZmlsZVBhdGgpfWApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zeW1ib2xSZXNvdXJjZVBhdGhzLnNldChzeW1ib2wsIG9yaWdpbkZpbGVQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZWRTeW1ib2xzLnB1c2goXG4gICAgICAgICAgICB0aGlzLmNyZWF0ZVJlc29sdmVkU3ltYm9sKHN5bWJvbCwgZmlsZVBhdGgsIHRvcExldmVsU3ltYm9sTmFtZXMsIHN5bWJvbE1ldGEpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCB1bmlxdWVTeW1ib2xzID0gbmV3IFNldDxTdGF0aWNTeW1ib2w+KCk7XG4gICAgZm9yIChjb25zdCByZXNvbHZlZFN5bWJvbCBvZiByZXNvbHZlZFN5bWJvbHMpIHtcbiAgICAgIHRoaXMucmVzb2x2ZWRTeW1ib2xzLnNldChyZXNvbHZlZFN5bWJvbC5zeW1ib2wsIHJlc29sdmVkU3ltYm9sKTtcbiAgICAgIHVuaXF1ZVN5bWJvbHMuYWRkKHJlc29sdmVkU3ltYm9sLnN5bWJvbCk7XG4gICAgfVxuICAgIHRoaXMuc3ltYm9sRnJvbUZpbGUuc2V0KGZpbGVQYXRoLCBBcnJheS5mcm9tKHVuaXF1ZVN5bWJvbHMpKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUmVzb2x2ZWRTeW1ib2woXG4gICAgICBzb3VyY2VTeW1ib2w6IFN0YXRpY1N5bWJvbCwgdG9wTGV2ZWxQYXRoOiBzdHJpbmcsIHRvcExldmVsU3ltYm9sTmFtZXM6IFNldDxzdHJpbmc+LFxuICAgICAgbWV0YWRhdGE6IGFueSk6IFJlc29sdmVkU3RhdGljU3ltYm9sIHtcbiAgICAvLyBGb3IgY2xhc3NlcyB0aGF0IGRvbid0IGhhdmUgQW5ndWxhciBzdW1tYXJpZXMgLyBtZXRhZGF0YSxcbiAgICAvLyB3ZSBvbmx5IGtlZXAgdGhlaXIgYXJpdHksIGJ1dCBub3RoaW5nIGVsc2VcbiAgICAvLyAoZS5nLiB0aGVpciBjb25zdHJ1Y3RvciBwYXJhbWV0ZXJzKS5cbiAgICAvLyBXZSBkbyB0aGlzIHRvIHByZXZlbnQgaW50cm9kdWNpbmcgZGVlcCBpbXBvcnRzXG4gICAgLy8gYXMgd2UgZGlkbid0IGdlbmVyYXRlIC5uZ2ZhY3RvcnkudHMgZmlsZXMgd2l0aCBwcm9wZXIgcmVleHBvcnRzLlxuICAgIGNvbnN0IGlzVHNGaWxlID0gVFMudGVzdChzb3VyY2VTeW1ib2wuZmlsZVBhdGgpO1xuICAgIGlmICh0aGlzLnN1bW1hcnlSZXNvbHZlci5pc0xpYnJhcnlGaWxlKHNvdXJjZVN5bWJvbC5maWxlUGF0aCkgJiYgIWlzVHNGaWxlICYmIG1ldGFkYXRhICYmXG4gICAgICAgIG1ldGFkYXRhWydfX3N5bWJvbGljJ10gPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IHRyYW5zZm9ybWVkTWV0YSA9IHtfX3N5bWJvbGljOiAnY2xhc3MnLCBhcml0eTogbWV0YWRhdGEuYXJpdHl9O1xuICAgICAgcmV0dXJuIG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChzb3VyY2VTeW1ib2wsIHRyYW5zZm9ybWVkTWV0YSk7XG4gICAgfVxuXG4gICAgbGV0IF9vcmlnaW5hbEZpbGVNZW1vOiBzdHJpbmd8dW5kZWZpbmVkO1xuICAgIGNvbnN0IGdldE9yaWdpbmFsTmFtZTogKCkgPT4gc3RyaW5nID0gKCkgPT4ge1xuICAgICAgaWYgKCFfb3JpZ2luYWxGaWxlTWVtbykge1xuICAgICAgICAvLyBHdWVzcyB3aGF0IHRoZSBvcmlnaW5hbCBmaWxlIG5hbWUgaXMgZnJvbSB0aGUgcmVmZXJlbmNlLiBJZiBpdCBoYXMgYSBgLmQudHNgIGV4dGVuc2lvblxuICAgICAgICAvLyByZXBsYWNlIGl0IHdpdGggYC50c2AuIElmIGl0IGFscmVhZHkgaGFzIGAudHNgIGp1c3QgbGVhdmUgaXQgaW4gcGxhY2UuIElmIGl0IGRvZXNuJ3QgaGF2ZVxuICAgICAgICAvLyAudHMgb3IgLmQudHMsIGFwcGVuZCBgLnRzJy4gQWxzbywgaWYgaXQgaXMgaW4gYG5vZGVfbW9kdWxlc2AsIHRyaW0gdGhlIGBub2RlX21vZHVsZWBcbiAgICAgICAgLy8gbG9jYXRpb24gYXMgaXQgaXMgbm90IGltcG9ydGFudCB0byBmaW5kaW5nIHRoZSBmaWxlLlxuICAgICAgICBfb3JpZ2luYWxGaWxlTWVtbyA9XG4gICAgICAgICAgICB0aGlzLmhvc3QuZ2V0T3V0cHV0TmFtZSh0b3BMZXZlbFBhdGgucmVwbGFjZSgvKChcXC50cyl8KFxcLmRcXC50cyl8KSQvLCAnLnRzJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXi4qbm9kZV9tb2R1bGVzWy9cXFxcXS8sICcnKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX29yaWdpbmFsRmlsZU1lbW87XG4gICAgfTtcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY2xhc3MgUmVmZXJlbmNlVHJhbnNmb3JtZXIgZXh0ZW5kcyBWYWx1ZVRyYW5zZm9ybWVyIHtcbiAgICAgIHZpc2l0U3RyaW5nTWFwKG1hcDoge1trZXk6IHN0cmluZ106IGFueX0sIGZ1bmN0aW9uUGFyYW1zOiBzdHJpbmdbXSk6IGFueSB7XG4gICAgICAgIGNvbnN0IHN5bWJvbGljID0gbWFwWydfX3N5bWJvbGljJ107XG4gICAgICAgIGlmIChzeW1ib2xpYyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGNvbnN0IG9sZExlbiA9IGZ1bmN0aW9uUGFyYW1zLmxlbmd0aDtcbiAgICAgICAgICBmdW5jdGlvblBhcmFtcy5wdXNoKC4uLihtYXBbJ3BhcmFtZXRlcnMnXSB8fCBbXSkpO1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLnZpc2l0U3RyaW5nTWFwKG1hcCwgZnVuY3Rpb25QYXJhbXMpO1xuICAgICAgICAgIGZ1bmN0aW9uUGFyYW1zLmxlbmd0aCA9IG9sZExlbjtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGVsc2UgaWYgKHN5bWJvbGljID09PSAncmVmZXJlbmNlJykge1xuICAgICAgICAgIGNvbnN0IG1vZHVsZSA9IG1hcFsnbW9kdWxlJ107XG4gICAgICAgICAgY29uc3QgbmFtZSA9IG1hcFsnbmFtZSddID8gdW5lc2NhcGVJZGVudGlmaWVyKG1hcFsnbmFtZSddKSA6IG1hcFsnbmFtZSddO1xuICAgICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBmaWxlUGF0aDogc3RyaW5nO1xuICAgICAgICAgIGlmIChtb2R1bGUpIHtcbiAgICAgICAgICAgIGZpbGVQYXRoID0gc2VsZi5yZXNvbHZlTW9kdWxlKG1vZHVsZSwgc291cmNlU3ltYm9sLmZpbGVQYXRoKSAhO1xuICAgICAgICAgICAgaWYgKCFmaWxlUGF0aCkge1xuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIF9fc3ltYm9saWM6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCByZXNvbHZlICR7bW9kdWxlfSByZWxhdGl2ZSB0byAke1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmhvc3QuZ2V0TWV0YWRhdGFGb3Ioc291cmNlU3ltYm9sLmZpbGVQYXRoKX0uYCxcbiAgICAgICAgICAgICAgICBsaW5lOiBtYXBbJ2xpbmUnXSxcbiAgICAgICAgICAgICAgICBjaGFyYWN0ZXI6IG1hcFsnY2hhcmFjdGVyJ10sXG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGdldE9yaWdpbmFsTmFtZSgpXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBfX3N5bWJvbGljOiAncmVzb2x2ZWQnLFxuICAgICAgICAgICAgICBzeW1ib2w6IHNlbGYuZ2V0U3RhdGljU3ltYm9sKGZpbGVQYXRoLCBuYW1lKSxcbiAgICAgICAgICAgICAgbGluZTogbWFwWydsaW5lJ10sXG4gICAgICAgICAgICAgIGNoYXJhY3RlcjogbWFwWydjaGFyYWN0ZXInXSxcbiAgICAgICAgICAgICAgZmlsZU5hbWU6IGdldE9yaWdpbmFsTmFtZSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gZWxzZSBpZiAoZnVuY3Rpb25QYXJhbXMuaW5kZXhPZihuYW1lKSA+PSAwKSB7XG4gICAgICAgICAgICAvLyByZWZlcmVuY2UgdG8gYSBmdW5jdGlvbiBwYXJhbWV0ZXJcbiAgICAgICAgICAgIHJldHVybiB7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG5hbWU6IG5hbWV9O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodG9wTGV2ZWxTeW1ib2xOYW1lcy5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuZ2V0U3RhdGljU3ltYm9sKHRvcExldmVsUGF0aCwgbmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBhbWJpZW50IHZhbHVlXG4gICAgICAgICAgICBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzeW1ib2xpYyA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgIHJldHVybiB7Li4ubWFwLCBmaWxlTmFtZTogZ2V0T3JpZ2luYWxOYW1lKCl9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBzdXBlci52aXNpdFN0cmluZ01hcChtYXAsIGZ1bmN0aW9uUGFyYW1zKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB0cmFuc2Zvcm1lZE1ldGEgPSB2aXNpdFZhbHVlKG1ldGFkYXRhLCBuZXcgUmVmZXJlbmNlVHJhbnNmb3JtZXIoKSwgW10pO1xuICAgIGxldCB1bndyYXBwZWRUcmFuc2Zvcm1lZE1ldGEgPSB1bndyYXBSZXNvbHZlZE1ldGFkYXRhKHRyYW5zZm9ybWVkTWV0YSk7XG4gICAgaWYgKHVud3JhcHBlZFRyYW5zZm9ybWVkTWV0YSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlRXhwb3J0KHNvdXJjZVN5bWJvbCwgdW53cmFwcGVkVHJhbnNmb3JtZWRNZXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChzb3VyY2VTeW1ib2wsIHRyYW5zZm9ybWVkTWV0YSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUV4cG9ydChzb3VyY2VTeW1ib2w6IFN0YXRpY1N5bWJvbCwgdGFyZ2V0U3ltYm9sOiBTdGF0aWNTeW1ib2wpOlxuICAgICAgUmVzb2x2ZWRTdGF0aWNTeW1ib2wge1xuICAgIHNvdXJjZVN5bWJvbC5hc3NlcnROb01lbWJlcnMoKTtcbiAgICB0YXJnZXRTeW1ib2wuYXNzZXJ0Tm9NZW1iZXJzKCk7XG4gICAgaWYgKHRoaXMuc3VtbWFyeVJlc29sdmVyLmlzTGlicmFyeUZpbGUoc291cmNlU3ltYm9sLmZpbGVQYXRoKSAmJlxuICAgICAgICB0aGlzLnN1bW1hcnlSZXNvbHZlci5pc0xpYnJhcnlGaWxlKHRhcmdldFN5bWJvbC5maWxlUGF0aCkpIHtcbiAgICAgIC8vIFRoaXMgY2FzZSBpcyBmb3IgYW4gbmcgbGlicmFyeSBpbXBvcnRpbmcgc3ltYm9scyBmcm9tIGEgcGxhaW4gdHMgbGlicmFyeVxuICAgICAgLy8gdHJhbnNpdGl2ZWx5LlxuICAgICAgLy8gTm90ZTogV2UgcmVseSBvbiB0aGUgZmFjdCB0aGF0IHdlIGRpc2NvdmVyIHN5bWJvbHMgaW4gdGhlIGRpcmVjdGlvblxuICAgICAgLy8gZnJvbSBzb3VyY2UgZmlsZXMgdG8gbGlicmFyeSBmaWxlc1xuICAgICAgdGhpcy5pbXBvcnRBcy5zZXQodGFyZ2V0U3ltYm9sLCB0aGlzLmdldEltcG9ydEFzKHNvdXJjZVN5bWJvbCkgfHwgc291cmNlU3ltYm9sKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBSZXNvbHZlZFN0YXRpY1N5bWJvbChzb3VyY2VTeW1ib2wsIHRhcmdldFN5bWJvbCk7XG4gIH1cblxuICBwcml2YXRlIHJlcG9ydEVycm9yKGVycm9yOiBFcnJvciwgY29udGV4dD86IFN0YXRpY1N5bWJvbCwgcGF0aD86IHN0cmluZykge1xuICAgIGlmICh0aGlzLmVycm9yUmVjb3JkZXIpIHtcbiAgICAgIHRoaXMuZXJyb3JSZWNvcmRlcihlcnJvciwgKGNvbnRleHQgJiYgY29udGV4dC5maWxlUGF0aCkgfHwgcGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0gbW9kdWxlIGFuIGFic29sdXRlIHBhdGggdG8gYSBtb2R1bGUgZmlsZS5cbiAgICovXG4gIHByaXZhdGUgZ2V0TW9kdWxlTWV0YWRhdGEobW9kdWxlOiBzdHJpbmcpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gICAgbGV0IG1vZHVsZU1ldGFkYXRhID0gdGhpcy5tZXRhZGF0YUNhY2hlLmdldChtb2R1bGUpO1xuICAgIGlmICghbW9kdWxlTWV0YWRhdGEpIHtcbiAgICAgIGNvbnN0IG1vZHVsZU1ldGFkYXRhcyA9IHRoaXMuaG9zdC5nZXRNZXRhZGF0YUZvcihtb2R1bGUpO1xuICAgICAgaWYgKG1vZHVsZU1ldGFkYXRhcykge1xuICAgICAgICBsZXQgbWF4VmVyc2lvbiA9IC0xO1xuICAgICAgICBtb2R1bGVNZXRhZGF0YXMuZm9yRWFjaCgobWQpID0+IHtcbiAgICAgICAgICBpZiAobWQgJiYgbWRbJ3ZlcnNpb24nXSA+IG1heFZlcnNpb24pIHtcbiAgICAgICAgICAgIG1heFZlcnNpb24gPSBtZFsndmVyc2lvbiddO1xuICAgICAgICAgICAgbW9kdWxlTWV0YWRhdGEgPSBtZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCFtb2R1bGVNZXRhZGF0YSkge1xuICAgICAgICBtb2R1bGVNZXRhZGF0YSA9XG4gICAgICAgICAgICB7X19zeW1ib2xpYzogJ21vZHVsZScsIHZlcnNpb246IFNVUFBPUlRFRF9TQ0hFTUFfVkVSU0lPTiwgbW9kdWxlOiBtb2R1bGUsIG1ldGFkYXRhOiB7fX07XG4gICAgICB9XG4gICAgICBpZiAobW9kdWxlTWV0YWRhdGFbJ3ZlcnNpb24nXSAhPSBTVVBQT1JURURfU0NIRU1BX1ZFUlNJT04pIHtcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gbW9kdWxlTWV0YWRhdGFbJ3ZlcnNpb24nXSA9PSAyID9cbiAgICAgICAgICAgIGBVbnN1cHBvcnRlZCBtZXRhZGF0YSB2ZXJzaW9uICR7bW9kdWxlTWV0YWRhdGFbJ3ZlcnNpb24nXX0gZm9yIG1vZHVsZSAke21vZHVsZX0uIFRoaXMgbW9kdWxlIHNob3VsZCBiZSBjb21waWxlZCB3aXRoIGEgbmV3ZXIgdmVyc2lvbiBvZiBuZ2NgIDpcbiAgICAgICAgICAgIGBNZXRhZGF0YSB2ZXJzaW9uIG1pc21hdGNoIGZvciBtb2R1bGUgJHt0aGlzLmhvc3QuZ2V0T3V0cHV0TmFtZShtb2R1bGUpfSwgZm91bmQgdmVyc2lvbiAke21vZHVsZU1ldGFkYXRhWyd2ZXJzaW9uJ119LCBleHBlY3RlZCAke1NVUFBPUlRFRF9TQ0hFTUFfVkVSU0lPTn1gO1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0YWRhdGFDYWNoZS5zZXQobW9kdWxlLCBtb2R1bGVNZXRhZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBtb2R1bGVNZXRhZGF0YTtcbiAgfVxuXG5cbiAgZ2V0U3ltYm9sQnlNb2R1bGUobW9kdWxlOiBzdHJpbmcsIHN5bWJvbE5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU/OiBzdHJpbmcpOiBTdGF0aWNTeW1ib2wge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlTW9kdWxlKG1vZHVsZSwgY29udGFpbmluZ0ZpbGUpO1xuICAgIGlmICghZmlsZVBhdGgpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKGBDb3VsZCBub3QgcmVzb2x2ZSBtb2R1bGUgJHttb2R1bGV9JHtjb250YWluaW5nRmlsZSA/ICcgcmVsYXRpdmUgdG8gJyArXG4gICAgICAgICAgICB0aGlzLmhvc3QuZ2V0T3V0cHV0TmFtZShjb250YWluaW5nRmlsZSkgOiAnJ31gKSk7XG4gICAgICByZXR1cm4gdGhpcy5nZXRTdGF0aWNTeW1ib2woYEVSUk9SOiR7bW9kdWxlfWAsIHN5bWJvbE5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5nZXRTdGF0aWNTeW1ib2woZmlsZVBhdGgsIHN5bWJvbE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNvbHZlTW9kdWxlKG1vZHVsZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IHN0cmluZ3xudWxsIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMuaG9zdC5tb2R1bGVOYW1lVG9GaWxlTmFtZShtb2R1bGUsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBDb3VsZCBub3QgcmVzb2x2ZSBtb2R1bGUgJyR7bW9kdWxlfScgcmVsYXRpdmUgdG8gZmlsZSAke2NvbnRhaW5pbmdGaWxlfWApO1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihlLCB1bmRlZmluZWQsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLy8gUmVtb3ZlIGV4dHJhIHVuZGVyc2NvcmUgZnJvbSBlc2NhcGVkIGlkZW50aWZpZXIuXG4vLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2Jsb2IvbWFzdGVyL3NyYy9jb21waWxlci91dGlsaXRpZXMudHNcbmV4cG9ydCBmdW5jdGlvbiB1bmVzY2FwZUlkZW50aWZpZXIoaWRlbnRpZmllcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlkZW50aWZpZXIuc3RhcnRzV2l0aCgnX19fJykgPyBpZGVudGlmaWVyLnN1YnN0cigxKSA6IGlkZW50aWZpZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bndyYXBSZXNvbHZlZE1ldGFkYXRhKG1ldGFkYXRhOiBhbnkpOiBhbnkge1xuICBpZiAobWV0YWRhdGEgJiYgbWV0YWRhdGEuX19zeW1ib2xpYyA9PT0gJ3Jlc29sdmVkJykge1xuICAgIHJldHVybiBtZXRhZGF0YS5zeW1ib2w7XG4gIH1cbiAgcmV0dXJuIG1ldGFkYXRhO1xufVxuIl19