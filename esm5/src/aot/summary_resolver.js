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
var AotSummaryResolver = /** @class */ (function () {
    function AotSummaryResolver(host, staticSymbolCache) {
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
    AotSummaryResolver.prototype.isLibraryFile = /**
     * @param {?} filePath
     * @return {?}
     */
    function (filePath) {
        // Note: We need to strip the .ngfactory. file path,
        // so this method also works for generated files
        // (for which host.isSourceFile will always return false).
        return !this.host.isSourceFile(stripGeneratedFileSuffix(filePath));
    };
    /**
     * @param {?} filePath
     * @param {?} referringSrcFileName
     * @return {?}
     */
    AotSummaryResolver.prototype.toSummaryFileName = /**
     * @param {?} filePath
     * @param {?} referringSrcFileName
     * @return {?}
     */
    function (filePath, referringSrcFileName) {
        return this.host.toSummaryFileName(filePath, referringSrcFileName);
    };
    /**
     * @param {?} fileName
     * @param {?} referringLibFileName
     * @return {?}
     */
    AotSummaryResolver.prototype.fromSummaryFileName = /**
     * @param {?} fileName
     * @param {?} referringLibFileName
     * @return {?}
     */
    function (fileName, referringLibFileName) {
        return this.host.fromSummaryFileName(fileName, referringLibFileName);
    };
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    AotSummaryResolver.prototype.resolveSummary = /**
     * @param {?} staticSymbol
     * @return {?}
     */
    function (staticSymbol) {
        var /** @type {?} */ rootSymbol = staticSymbol.members.length ?
            this.staticSymbolCache.get(staticSymbol.filePath, staticSymbol.name) :
            staticSymbol;
        var /** @type {?} */ summary = this.summaryCache.get(rootSymbol);
        if (!summary) {
            this._loadSummaryFile(staticSymbol.filePath);
            summary = /** @type {?} */ ((this.summaryCache.get(staticSymbol)));
        }
        return (rootSymbol === staticSymbol && summary) || null;
    };
    /**
     * @param {?} filePath
     * @return {?}
     */
    AotSummaryResolver.prototype.getSymbolsOf = /**
     * @param {?} filePath
     * @return {?}
     */
    function (filePath) {
        if (this._loadSummaryFile(filePath)) {
            return Array.from(this.summaryCache.keys()).filter(function (symbol) { return symbol.filePath === filePath; });
        }
        return null;
    };
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    AotSummaryResolver.prototype.getImportAs = /**
     * @param {?} staticSymbol
     * @return {?}
     */
    function (staticSymbol) {
        staticSymbol.assertNoMembers();
        return /** @type {?} */ ((this.importAs.get(staticSymbol)));
    };
    /**
     * Converts a file path to a module name that can be used as an `import`.
     */
    /**
     * Converts a file path to a module name that can be used as an `import`.
     * @param {?} importedFilePath
     * @return {?}
     */
    AotSummaryResolver.prototype.getKnownModuleName = /**
     * Converts a file path to a module name that can be used as an `import`.
     * @param {?} importedFilePath
     * @return {?}
     */
    function (importedFilePath) {
        return this.knownFileNameToModuleNames.get(importedFilePath) || null;
    };
    /**
     * @param {?} summary
     * @return {?}
     */
    AotSummaryResolver.prototype.addSummary = /**
     * @param {?} summary
     * @return {?}
     */
    function (summary) { this.summaryCache.set(summary.symbol, summary); };
    /**
     * @param {?} filePath
     * @return {?}
     */
    AotSummaryResolver.prototype._loadSummaryFile = /**
     * @param {?} filePath
     * @return {?}
     */
    function (filePath) {
        var _this = this;
        var /** @type {?} */ hasSummary = this.loadedFilePaths.get(filePath);
        if (hasSummary != null) {
            return hasSummary;
        }
        var /** @type {?} */ json = null;
        if (this.isLibraryFile(filePath)) {
            var /** @type {?} */ summaryFilePath = summaryFileName(filePath);
            try {
                json = this.host.loadSummary(summaryFilePath);
            }
            catch (/** @type {?} */ e) {
                console.error("Error loading summary file " + summaryFilePath);
                throw e;
            }
        }
        hasSummary = json != null;
        this.loadedFilePaths.set(filePath, hasSummary);
        if (json) {
            var _a = deserializeSummaries(this.staticSymbolCache, this, filePath, json), moduleName = _a.moduleName, summaries = _a.summaries, importAs = _a.importAs;
            summaries.forEach(function (summary) { return _this.summaryCache.set(summary.symbol, summary); });
            if (moduleName) {
                this.knownFileNameToModuleNames.set(filePath, moduleName);
            }
            importAs.forEach(function (importAs) { _this.importAs.set(importAs.symbol, importAs.importAs); });
        }
        return hasSummary;
    };
    return AotSummaryResolver;
}());
export { AotSummaryResolver };
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