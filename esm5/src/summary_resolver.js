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
var /**
 * @abstract
 * @template T
 */
SummaryResolver = /** @class */ (function () {
    function SummaryResolver() {
    }
    return SummaryResolver;
}());
/**
 * @abstract
 * @template T
 */
export { SummaryResolver };
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
var JitSummaryResolver = /** @class */ (function () {
    function JitSummaryResolver() {
        this._summaries = new Map();
    }
    /**
     * @return {?}
     */
    JitSummaryResolver.prototype.isLibraryFile = /**
     * @return {?}
     */
    function () { return false; };
    /**
     * @param {?} fileName
     * @return {?}
     */
    JitSummaryResolver.prototype.toSummaryFileName = /**
     * @param {?} fileName
     * @return {?}
     */
    function (fileName) { return fileName; };
    /**
     * @param {?} fileName
     * @return {?}
     */
    JitSummaryResolver.prototype.fromSummaryFileName = /**
     * @param {?} fileName
     * @return {?}
     */
    function (fileName) { return fileName; };
    /**
     * @param {?} reference
     * @return {?}
     */
    JitSummaryResolver.prototype.resolveSummary = /**
     * @param {?} reference
     * @return {?}
     */
    function (reference) {
        return this._summaries.get(reference) || null;
    };
    /**
     * @return {?}
     */
    JitSummaryResolver.prototype.getSymbolsOf = /**
     * @return {?}
     */
    function () { return []; };
    /**
     * @param {?} reference
     * @return {?}
     */
    JitSummaryResolver.prototype.getImportAs = /**
     * @param {?} reference
     * @return {?}
     */
    function (reference) { return reference; };
    /**
     * @param {?} fileName
     * @return {?}
     */
    JitSummaryResolver.prototype.getKnownModuleName = /**
     * @param {?} fileName
     * @return {?}
     */
    function (fileName) { return null; };
    /**
     * @param {?} summary
     * @return {?}
     */
    JitSummaryResolver.prototype.addSummary = /**
     * @param {?} summary
     * @return {?}
     */
    function (summary) { this._summaries.set(summary.symbol, summary); };
    return JitSummaryResolver;
}());
export { JitSummaryResolver };
function JitSummaryResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    JitSummaryResolver.prototype._summaries;
}
//# sourceMappingURL=summary_resolver.js.map