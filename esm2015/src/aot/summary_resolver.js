/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { deserializeSummaries } from './summary_serializer';
import { stripGeneratedFileSuffix, summaryFileName } from './util';
/**
 * @record
 */
export function AotSummaryResolverHost() { }
function AotSummaryResolverHost_tsickle_Closure_declarations() {
    /**
     * Loads an NgModule/Directive/Pipe summary file
     * @type {?}
     */
    AotSummaryResolverHost.prototype.loadSummary;
    /**
     * Returns whether a file is a source file or not.
     * @type {?}
     */
    AotSummaryResolverHost.prototype.isSourceFile;
    /**
     * Converts a file name into a representation that should be stored in a summary file.
     * This has to include changing the suffix as well.
     * E.g.
     * `some_file.ts` -> `some_file.d.ts`
     *
     * \@param referringSrcFileName the soure file that refers to fileName
     * @type {?}
     */
    AotSummaryResolverHost.prototype.toSummaryFileName;
    /**
     * Converts a fileName that was processed by `toSummaryFileName` back into a real fileName
     * given the fileName of the library that is referrig to it.
     * @type {?}
     */
    AotSummaryResolverHost.prototype.fromSummaryFileName;
}
export class AotSummaryResolver {
    /**
     * @param {?} host
     * @param {?} staticSymbolCache
     */
    constructor(host, staticSymbolCache) {
        this.host = host;
        this.staticSymbolCache = staticSymbolCache;
        this.summaryCache = new Map();
        this.loadedFilePaths = new Map();
        this.importAs = new Map();
        this.knownFileNameToModuleNames = new Map();
    }
    /**
     * @param {?} filePath
     * @return {?}
     */
    isLibraryFile(filePath) {
        // Note: We need to strip the .ngfactory. file path,
        // so this method also works for generated files
        // (for which host.isSourceFile will always return false).
        return !this.host.isSourceFile(stripGeneratedFileSuffix(filePath));
    }
    /**
     * @param {?} filePath
     * @param {?} referringSrcFileName
     * @return {?}
     */
    toSummaryFileName(filePath, referringSrcFileName) {
        return this.host.toSummaryFileName(filePath, referringSrcFileName);
    }
    /**
     * @param {?} fileName
     * @param {?} referringLibFileName
     * @return {?}
     */
    fromSummaryFileName(fileName, referringLibFileName) {
        return this.host.fromSummaryFileName(fileName, referringLibFileName);
    }
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    resolveSummary(staticSymbol) {
        const /** @type {?} */ rootSymbol = staticSymbol.members.length ?
            this.staticSymbolCache.get(staticSymbol.filePath, staticSymbol.name) :
            staticSymbol;
        let /** @type {?} */ summary = this.summaryCache.get(rootSymbol);
        if (!summary) {
            this._loadSummaryFile(staticSymbol.filePath);
            summary = /** @type {?} */ ((this.summaryCache.get(staticSymbol)));
        }
        return (rootSymbol === staticSymbol && summary) || null;
    }
    /**
     * @param {?} filePath
     * @return {?}
     */
    getSymbolsOf(filePath) {
        if (this._loadSummaryFile(filePath)) {
            return Array.from(this.summaryCache.keys()).filter((symbol) => symbol.filePath === filePath);
        }
        return null;
    }
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    getImportAs(staticSymbol) {
        staticSymbol.assertNoMembers();
        return /** @type {?} */ ((this.importAs.get(staticSymbol)));
    }
    /**
     * Converts a file path to a module name that can be used as an `import`.
     * @param {?} importedFilePath
     * @return {?}
     */
    getKnownModuleName(importedFilePath) {
        return this.knownFileNameToModuleNames.get(importedFilePath) || null;
    }
    /**
     * @param {?} summary
     * @return {?}
     */
    addSummary(summary) { this.summaryCache.set(summary.symbol, summary); }
    /**
     * @param {?} filePath
     * @return {?}
     */
    _loadSummaryFile(filePath) {
        let /** @type {?} */ hasSummary = this.loadedFilePaths.get(filePath);
        if (hasSummary != null) {
            return hasSummary;
        }
        let /** @type {?} */ json = null;
        if (this.isLibraryFile(filePath)) {
            const /** @type {?} */ summaryFilePath = summaryFileName(filePath);
            try {
                json = this.host.loadSummary(summaryFilePath);
            }
            catch (/** @type {?} */ e) {
                console.error(`Error loading summary file ${summaryFilePath}`);
                throw e;
            }
        }
        hasSummary = json != null;
        this.loadedFilePaths.set(filePath, hasSummary);
        if (json) {
            const { moduleName, summaries, importAs } = deserializeSummaries(this.staticSymbolCache, this, filePath, json);
            summaries.forEach((summary) => this.summaryCache.set(summary.symbol, summary));
            if (moduleName) {
                this.knownFileNameToModuleNames.set(filePath, moduleName);
            }
            importAs.forEach((importAs) => { this.importAs.set(importAs.symbol, importAs.importAs); });
        }
        return hasSummary;
    }
}
function AotSummaryResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    AotSummaryResolver.prototype.summaryCache;
    /** @type {?} */
    AotSummaryResolver.prototype.loadedFilePaths;
    /** @type {?} */
    AotSummaryResolver.prototype.importAs;
    /** @type {?} */
    AotSummaryResolver.prototype.knownFileNameToModuleNames;
    /** @type {?} */
    AotSummaryResolver.prototype.host;
    /** @type {?} */
    AotSummaryResolver.prototype.staticSymbolCache;
}
//# sourceMappingURL=summary_resolver.js.map