/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { deserializeSummaries } from './summary_serializer';
import { ngfactoryFilePath, stripNgFactory, summaryFileName } from './util';
var AotSummaryResolver = (function () {
    /**
     * @param {?} host
     * @param {?} staticSymbolCache
     */
    function AotSummaryResolver(host, staticSymbolCache) {
        this.host = host;
        this.staticSymbolCache = staticSymbolCache;
        this.summaryCache = new Map();
        this.loadedFilePaths = new Set();
        this.importAs = new Map();
    }
    /**
     * @param {?} filePath
     * @return {?}
     */
    AotSummaryResolver.prototype.isLibraryFile = function (filePath) {
        // Note: We need to strip the .ngfactory. file path,
        // so this method also works for generated files
        // (for which host.isSourceFile will always return false).
        return !this.host.isSourceFile(stripNgFactory(filePath));
    };
    /**
     * @param {?} filePath
     * @return {?}
     */
    AotSummaryResolver.prototype.getLibraryFileName = function (filePath) { return this.host.getOutputFileName(filePath); };
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    AotSummaryResolver.prototype.resolveSummary = function (staticSymbol) {
        staticSymbol.assertNoMembers();
        var /** @type {?} */ summary = this.summaryCache.get(staticSymbol);
        if (!summary) {
            this._loadSummaryFile(staticSymbol.filePath);
            summary = this.summaryCache.get(staticSymbol);
        }
        return summary;
    };
    /**
     * @param {?} filePath
     * @return {?}
     */
    AotSummaryResolver.prototype.getSymbolsOf = function (filePath) {
        this._loadSummaryFile(filePath);
        return Array.from(this.summaryCache.keys()).filter(function (symbol) { return symbol.filePath === filePath; });
    };
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    AotSummaryResolver.prototype.getImportAs = function (staticSymbol) {
        staticSymbol.assertNoMembers();
        return this.importAs.get(staticSymbol);
    };
    /**
     * @param {?} filePath
     * @return {?}
     */
    AotSummaryResolver.prototype._loadSummaryFile = function (filePath) {
        var _this = this;
        if (this.loadedFilePaths.has(filePath)) {
            return;
        }
        this.loadedFilePaths.add(filePath);
        if (this.isLibraryFile(filePath)) {
            var /** @type {?} */ summaryFilePath = summaryFileName(filePath);
            var /** @type {?} */ json = void 0;
            try {
                json = this.host.loadSummary(summaryFilePath);
            }
            catch (e) {
                console.error("Error loading summary file " + summaryFilePath);
                throw e;
            }
            if (json) {
                var _a = deserializeSummaries(this.staticSymbolCache, json), summaries = _a.summaries, importAs = _a.importAs;
                summaries.forEach(function (summary) { return _this.summaryCache.set(summary.symbol, summary); });
                importAs.forEach(function (importAs) {
                    _this.importAs.set(importAs.symbol, _this.staticSymbolCache.get(ngfactoryFilePath(filePath), importAs.importAs));
                });
            }
        }
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
    AotSummaryResolver.prototype.host;
    /** @type {?} */
    AotSummaryResolver.prototype.staticSymbolCache;
}
//# sourceMappingURL=summary_resolver.js.map