import { GeneratedFile } from './generated_file';
import { isStaticSymbol } from './static_symbol';
import { filterFileByPatterns } from './utils';
var /** @type {?} */ STRIP_SRC_FILE_SUFFIXES = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
export var AotSummaryResolver = (function () {
    /**
     * @param {?} host
     * @param {?} staticReflector
     * @param {?} options
     */
    function AotSummaryResolver(host, staticReflector, options) {
        this.host = host;
        this.staticReflector = staticReflector;
        this.options = options;
        this.summaryCache = {};
    }
    /**
     * @param {?} srcFileUrl
     * @param {?} summaries
     * @return {?}
     */
    AotSummaryResolver.prototype.serializeSummaries = function (srcFileUrl, summaries) {
        var _this = this;
        var /** @type {?} */ jsonReplacer = function (key, value) {
            if (key === 'reference' && isStaticSymbol(value)) {
                // We convert the source filenames into output filenames,
                // as the generated summary file will be used when the current
                // compilation unit is used as a library
                return {
                    '__symbolic__': 'symbol',
                    'name': value.name,
                    'path': _this.host.getOutputFileName(value.filePath),
                    'members': value.members
                };
            }
            return value;
        };
        return new GeneratedFile(srcFileUrl, summaryFileName(srcFileUrl), JSON.stringify(summaries, jsonReplacer));
    };
    /**
     * @param {?} staticSymbol
     * @return {?}
     */
    AotSummaryResolver.prototype.resolveSummary = function (staticSymbol) {
        var _this = this;
        var /** @type {?} */ filePath = staticSymbol.filePath;
        var /** @type {?} */ name = staticSymbol.name;
        if (!filterFileByPatterns(filePath, this.options)) {
            var /** @type {?} */ summaries = this.summaryCache[filePath];
            var /** @type {?} */ summaryFilePath = summaryFileName(filePath);
            if (!summaries) {
                try {
                    var /** @type {?} */ jsonReviver = function (key, value) {
                        if (key === 'reference' && value && value['__symbolic__'] === 'symbol') {
                            // Note: We can't use staticReflector.findDeclaration here:
                            // Summary files can contain symbols of transitive compilation units
                            // (via the providers), and findDeclaration needs .metadata.json / .d.ts files,
                            // but we don't want to depend on these for transitive dependencies.
                            return _this.staticReflector.getStaticSymbol(value['path'], value['name'], value['members']);
                        }
                        else {
                            return value;
                        }
                    };
                    summaries = JSON.parse(this.host.loadSummary(summaryFilePath), jsonReviver);
                }
                catch (e) {
                    console.error("Error loading summary file " + summaryFilePath);
                    throw e;
                }
                this.summaryCache[filePath] = summaries;
            }
            var /** @type {?} */ result = summaries.find(function (summary) { return summary.type.reference === staticSymbol; });
            if (!result) {
                throw new Error("Could not find the symbol " + name + " in the summary file " + summaryFilePath + "!");
            }
            return result;
        }
        else {
            return null;
        }
    };
    return AotSummaryResolver;
}());
function AotSummaryResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    AotSummaryResolver.prototype.summaryCache;
    /** @type {?} */
    AotSummaryResolver.prototype.host;
    /** @type {?} */
    AotSummaryResolver.prototype.staticReflector;
    /** @type {?} */
    AotSummaryResolver.prototype.options;
}
/**
 * @param {?} fileName
 * @return {?}
 */
function summaryFileName(fileName) {
    var /** @type {?} */ fileNameWithoutSuffix = fileName.replace(STRIP_SRC_FILE_SUFFIXES, '');
    return fileNameWithoutSuffix + ".ngsummary.json";
}
//# sourceMappingURL=summary_resolver.js.map