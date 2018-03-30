/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @record
 * @template T
 */
export function Summary() { }
function Summary_tsickle_Closure_declarations() {
    /** @type {?} */
    Summary.prototype.symbol;
    /** @type {?} */
    Summary.prototype.metadata;
    /** @type {?|undefined} */
    Summary.prototype.type;
}
/**
 * @abstract
 * @template T
 */
export class SummaryResolver {
}
function SummaryResolver_tsickle_Closure_declarations() {
    /**
     * @abstract
     * @param {?} fileName
     * @return {?}
     */
    SummaryResolver.prototype.isLibraryFile = function (fileName) { };
    /**
     * @abstract
     * @param {?} fileName
     * @param {?} referringSrcFileName
     * @return {?}
     */
    SummaryResolver.prototype.toSummaryFileName = function (fileName, referringSrcFileName) { };
    /**
     * @abstract
     * @param {?} fileName
     * @param {?} referringLibFileName
     * @return {?}
     */
    SummaryResolver.prototype.fromSummaryFileName = function (fileName, referringLibFileName) { };
    /**
     * @abstract
     * @param {?} reference
     * @return {?}
     */
    SummaryResolver.prototype.resolveSummary = function (reference) { };
    /**
     * @abstract
     * @param {?} filePath
     * @return {?}
     */
    SummaryResolver.prototype.getSymbolsOf = function (filePath) { };
    /**
     * @abstract
     * @param {?} reference
     * @return {?}
     */
    SummaryResolver.prototype.getImportAs = function (reference) { };
    /**
     * @abstract
     * @param {?} fileName
     * @return {?}
     */
    SummaryResolver.prototype.getKnownModuleName = function (fileName) { };
    /**
     * @abstract
     * @param {?} summary
     * @return {?}
     */
    SummaryResolver.prototype.addSummary = function (summary) { };
}
export class JitSummaryResolver {
    constructor() {
        this._summaries = new Map();
    }
    /**
     * @return {?}
     */
    isLibraryFile() { return false; }
    /**
     * @param {?} fileName
     * @return {?}
     */
    toSummaryFileName(fileName) { return fileName; }
    /**
     * @param {?} fileName
     * @return {?}
     */
    fromSummaryFileName(fileName) { return fileName; }
    /**
     * @param {?} reference
     * @return {?}
     */
    resolveSummary(reference) {
        return this._summaries.get(reference) || null;
    }
    /**
     * @return {?}
     */
    getSymbolsOf() { return []; }
    /**
     * @param {?} reference
     * @return {?}
     */
    getImportAs(reference) { return reference; }
    /**
     * @param {?} fileName
     * @return {?}
     */
    getKnownModuleName(fileName) { return null; }
    /**
     * @param {?} summary
     * @return {?}
     */
    addSummary(summary) { this._summaries.set(summary.symbol, summary); }
}
function JitSummaryResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    JitSummaryResolver.prototype._summaries;
}
//# sourceMappingURL=summary_resolver.js.map