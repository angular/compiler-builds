var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileSummaryKind } from '../compile_metadata';
import { ValueTransformer, visitValue } from '../util';
import { StaticSymbol } from './static_symbol';
/**
 * @param {?} summaryResolver
 * @param {?} symbolResolver
 * @param {?} symbols
 * @param {?} types
 * @return {?}
 */
export function serializeSummaries(summaryResolver, symbolResolver, symbols, types) {
    var /** @type {?} */ serializer = new Serializer(symbolResolver, summaryResolver);
    // for symbols, we use everything except for the class metadata itself
    // (we keep the statics though), as the class metadata is contained in the
    // CompileTypeSummary.
    symbols.forEach(function (resolvedSymbol) { return serializer.addOrMergeSummary({ symbol: resolvedSymbol.symbol, metadata: resolvedSymbol.metadata }); });
    // Add summaries that are referenced by the given symbols (transitively)
    // Note: the serializer.symbols array might be growing while
    // we execute the loop!
    for (var /** @type {?} */ processedIndex = 0; processedIndex < serializer.symbols.length; processedIndex++) {
        var /** @type {?} */ symbol = serializer.symbols[processedIndex];
        if (summaryResolver.isLibraryFile(symbol.filePath)) {
            var /** @type {?} */ summary = summaryResolver.resolveSummary(symbol);
            if (!summary) {
                // some symbols might originate from a plain typescript library
                // that just exported .d.ts and .metadata.json files, i.e. where no summary
                // files were created.
                var /** @type {?} */ resolvedSymbol = symbolResolver.resolveSymbol(symbol);
                if (resolvedSymbol) {
                    summary = { symbol: resolvedSymbol.symbol, metadata: resolvedSymbol.metadata };
                }
            }
            if (summary) {
                serializer.addOrMergeSummary(summary);
            }
        }
    }
    // Add type summaries.
    // Note: We don't add the summaries of all referenced symbols as for the ResolvedSymbols,
    // as the type summaries already contain the transitive data that they require
    // (in a minimal way).
    types.forEach(function (typeSummary) {
        serializer.addOrMergeSummary({ symbol: typeSummary.type.reference, metadata: { __symbolic: 'class' }, type: typeSummary });
        if (typeSummary.summaryKind === CompileSummaryKind.NgModule) {
            var /** @type {?} */ ngModuleSummary = (typeSummary);
            ngModuleSummary.exportedDirectives.concat(ngModuleSummary.exportedPipes).forEach(function (id) {
                var /** @type {?} */ symbol = id.reference;
                if (summaryResolver.isLibraryFile(symbol.filePath)) {
                    var /** @type {?} */ summary = summaryResolver.resolveSummary(symbol);
                    if (summary) {
                        serializer.addOrMergeSummary(summary);
                    }
                }
            });
        }
    });
    return serializer.serialize();
}
/**
 * @param {?} symbolCache
 * @param {?} json
 * @return {?}
 */
export function deserializeSummaries(symbolCache, json) {
    var /** @type {?} */ deserializer = new Deserializer(symbolCache);
    return deserializer.deserialize(json);
}
var Serializer = (function (_super) {
    __extends(Serializer, _super);
    /**
     * @param {?} symbolResolver
     * @param {?} summaryResolver
     */
    function Serializer(symbolResolver, summaryResolver) {
        var _this = _super.call(this) || this;
        _this.symbolResolver = symbolResolver;
        _this.summaryResolver = summaryResolver;
        // Note: This only contains symbols without members.
        _this.symbols = [];
        _this.indexBySymbol = new Map();
        _this.processedSummaryBySymbol = new Map();
        _this.processedSummaries = [];
        return _this;
    }
    /**
     * @param {?} summary
     * @return {?}
     */
    Serializer.prototype.addOrMergeSummary = function (summary) {
        var /** @type {?} */ symbolMeta = summary.metadata;
        if (symbolMeta && symbolMeta.__symbolic === 'class') {
            // For classes, we only keep their statics and arity, but not the metadata
            // of the class itself as that has been captured already via other summaries
            // (e.g. DirectiveSummary, ...).
            symbolMeta = { __symbolic: 'class', statics: symbolMeta.statics, arity: symbolMeta.arity };
        }
        var /** @type {?} */ processedSummary = this.processedSummaryBySymbol.get(summary.symbol);
        if (!processedSummary) {
            processedSummary = this.processValue({ symbol: summary.symbol });
            this.processedSummaries.push(processedSummary);
            this.processedSummaryBySymbol.set(summary.symbol, processedSummary);
        }
        // Note: == on purpose to compare with undefined!
        if (processedSummary.metadata == null && symbolMeta != null) {
            processedSummary.metadata = this.processValue(symbolMeta);
        }
        // Note: == on purpose to compare with undefined!
        if (processedSummary.type == null && summary.type != null) {
            processedSummary.type = this.processValue(summary.type);
        }
    };
    /**
     * @return {?}
     */
    Serializer.prototype.serialize = function () {
        var _this = this;
        var /** @type {?} */ exportAs = [];
        var /** @type {?} */ json = JSON.stringify({
            summaries: this.processedSummaries,
            symbols: this.symbols.map(function (symbol, index) {
                symbol.assertNoMembers();
                var /** @type {?} */ importAs;
                if (_this.summaryResolver.isLibraryFile(symbol.filePath)) {
                    importAs = symbol.name + "_" + index;
                    exportAs.push({ symbol: symbol, exportAs: importAs });
                }
                return {
                    __symbol: index,
                    name: symbol.name,
                    // We convert the source filenames tinto output filenames,
                    // as the generated summary file will be used when teh current
                    // compilation unit is used as a library
                    filePath: _this.summaryResolver.getLibraryFileName(symbol.filePath),
                    importAs: importAs
                };
            })
        });
        return { json: json, exportAs: exportAs };
    };
    /**
     * @param {?} value
     * @return {?}
     */
    Serializer.prototype.processValue = function (value) { return visitValue(value, this, null); };
    /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    Serializer.prototype.visitOther = function (value, context) {
        if (value instanceof StaticSymbol) {
            var /** @type {?} */ baseSymbol = this.symbolResolver.getStaticSymbol(value.filePath, value.name);
            var /** @type {?} */ index = this.indexBySymbol.get(baseSymbol);
            // Note: == on purpose to compare with undefined!
            if (index == null) {
                index = this.indexBySymbol.size;
                this.indexBySymbol.set(baseSymbol, index);
                this.symbols.push(baseSymbol);
            }
            return { __symbol: index, members: value.members };
        }
    };
    return Serializer;
}(ValueTransformer));
function Serializer_tsickle_Closure_declarations() {
    /** @type {?} */
    Serializer.prototype.symbols;
    /** @type {?} */
    Serializer.prototype.indexBySymbol;
    /** @type {?} */
    Serializer.prototype.processedSummaryBySymbol;
    /** @type {?} */
    Serializer.prototype.processedSummaries;
    /** @type {?} */
    Serializer.prototype.symbolResolver;
    /** @type {?} */
    Serializer.prototype.summaryResolver;
}
var Deserializer = (function (_super) {
    __extends(Deserializer, _super);
    /**
     * @param {?} symbolCache
     */
    function Deserializer(symbolCache) {
        var _this = _super.call(this) || this;
        _this.symbolCache = symbolCache;
        return _this;
    }
    /**
     * @param {?} json
     * @return {?}
     */
    Deserializer.prototype.deserialize = function (json) {
        var _this = this;
        var /** @type {?} */ data = JSON.parse(json);
        var /** @type {?} */ importAs = [];
        this.symbols = [];
        data.symbols.forEach(function (serializedSymbol) {
            var /** @type {?} */ symbol = _this.symbolCache.get(serializedSymbol.filePath, serializedSymbol.name);
            _this.symbols.push(symbol);
            if (serializedSymbol.importAs) {
                importAs.push({ symbol: symbol, importAs: serializedSymbol.importAs });
            }
        });
        var /** @type {?} */ summaries = visitValue(data.summaries, this, null);
        return { summaries: summaries, importAs: importAs };
    };
    /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    Deserializer.prototype.visitStringMap = function (map, context) {
        if ('__symbol' in map) {
            var /** @type {?} */ baseSymbol = this.symbols[map['__symbol']];
            var /** @type {?} */ members = map['members'];
            return members.length ? this.symbolCache.get(baseSymbol.filePath, baseSymbol.name, members) :
                baseSymbol;
        }
        else {
            return _super.prototype.visitStringMap.call(this, map, context);
        }
    };
    return Deserializer;
}(ValueTransformer));
function Deserializer_tsickle_Closure_declarations() {
    /** @type {?} */
    Deserializer.prototype.symbols;
    /** @type {?} */
    Deserializer.prototype.symbolCache;
}
//# sourceMappingURL=summary_serializer.js.map