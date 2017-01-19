/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { deserializeSummaries } from './summary_serializer';
import { ngfactoryFilePath, stripNgFactory, summaryFileName } from './util';
export class AotSummaryResolver {
    /**
     * @param {?} host
     * @param {?} staticSymbolCache
     */
    constructor(host, staticSymbolCache) {
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
    isLibraryFile(filePath) {
        // Note: We need to strip the .ngfactory. file path,
        // so this method also works for generated files
        // (for which host.isSourceFile will always return false).
        return !this.host.isSourceFile(stripNgFactory(filePath));
    }
    /**
     * @param {?} filePath
     * @return {?}
     */
    getLibraryFileName(filePath) { return this.host.getOutputFileName(filePath); }
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    resolveSummary(staticSymbol) {
        staticSymbol.assertNoMembers();
        let /** @type {?} */ summary = this.summaryCache.get(staticSymbol);
        if (!summary) {
            this._loadSummaryFile(staticSymbol.filePath);
            summary = this.summaryCache.get(staticSymbol);
        }
        return summary;
    }
    /**
     * @param {?} filePath
     * @return {?}
     */
    getSymbolsOf(filePath) {
        this._loadSummaryFile(filePath);
        return Array.from(this.summaryCache.keys()).filter((symbol) => symbol.filePath === filePath);
    }
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    getImportAs(staticSymbol) {
        staticSymbol.assertNoMembers();
        return this.importAs.get(staticSymbol);
    }
    /**
     * @param {?} filePath
     * @return {?}
     */
    _loadSummaryFile(filePath) {
        if (this.loadedFilePaths.has(filePath)) {
            return;
        }
        this.loadedFilePaths.add(filePath);
        if (this.isLibraryFile(filePath)) {
            const /** @type {?} */ summaryFilePath = summaryFileName(filePath);
            let /** @type {?} */ json;
            try {
                json = this.host.loadSummary(summaryFilePath);
            }
            catch (e) {
                console.error(`Error loading summary file ${summaryFilePath}`);
                throw e;
            }
            if (json) {
                const { summaries, importAs } = deserializeSummaries(this.staticSymbolCache, json);
                summaries.forEach((summary) => this.summaryCache.set(summary.symbol, summary));
                importAs.forEach((importAs) => {
                    this.importAs.set(importAs.symbol, this.staticSymbolCache.get(ngfactoryFilePath(filePath), importAs.importAs));
                });
            }
        }
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
    AotSummaryResolver.prototype.host;
    /** @type {?} */
    AotSummaryResolver.prototype.staticSymbolCache;
}
//# sourceMappingURL=summary_resolver.js.map