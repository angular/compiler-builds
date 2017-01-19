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
    const /** @type {?} */ serializer = new Serializer(symbolResolver, summaryResolver);
    // for symbols, we use everything except for the class metadata itself
    // (we keep the statics though), as the class metadata is contained in the
    // CompileTypeSummary.
    symbols.forEach((resolvedSymbol) => serializer.addOrMergeSummary({ symbol: resolvedSymbol.symbol, metadata: resolvedSymbol.metadata }));
    // Add summaries that are referenced by the given symbols (transitively)
    // Note: the serializer.symbols array might be growing while
    // we execute the loop!
    for (let /** @type {?} */ processedIndex = 0; processedIndex < serializer.symbols.length; processedIndex++) {
        const /** @type {?} */ symbol = serializer.symbols[processedIndex];
        if (summaryResolver.isLibraryFile(symbol.filePath)) {
            let /** @type {?} */ summary = summaryResolver.resolveSummary(symbol);
            if (!summary) {
                // some symbols might originate from a plain typescript library
                // that just exported .d.ts and .metadata.json files, i.e. where no summary
                // files were created.
                const /** @type {?} */ resolvedSymbol = symbolResolver.resolveSymbol(symbol);
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
    types.forEach((typeSummary) => {
        serializer.addOrMergeSummary({ symbol: typeSummary.type.reference, metadata: { __symbolic: 'class' }, type: typeSummary });
        if (typeSummary.summaryKind === CompileSummaryKind.NgModule) {
            const /** @type {?} */ ngModuleSummary = (typeSummary);
            ngModuleSummary.exportedDirectives.concat(ngModuleSummary.exportedPipes).forEach((id) => {
                const /** @type {?} */ symbol = id.reference;
                if (summaryResolver.isLibraryFile(symbol.filePath)) {
                    const /** @type {?} */ summary = summaryResolver.resolveSummary(symbol);
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
    const /** @type {?} */ deserializer = new Deserializer(symbolCache);
    return deserializer.deserialize(json);
}
class Serializer extends ValueTransformer {
    /**
     * @param {?} symbolResolver
     * @param {?} summaryResolver
     */
    constructor(symbolResolver, summaryResolver) {
        super();
        this.symbolResolver = symbolResolver;
        this.summaryResolver = summaryResolver;
        // Note: This only contains symbols without members.
        this.symbols = [];
        this.indexBySymbol = new Map();
        this.processedSummaryBySymbol = new Map();
        this.processedSummaries = [];
    }
    /**
     * @param {?} summary
     * @return {?}
     */
    addOrMergeSummary(summary) {
        let /** @type {?} */ symbolMeta = summary.metadata;
        if (symbolMeta && symbolMeta.__symbolic === 'class') {
            // For classes, we only keep their statics, but not the metadata
            // of the class itself as that has been captured already via other summaries
            // (e.g. DirectiveSummary, ...).
            symbolMeta = { __symbolic: 'class', statics: symbolMeta.statics };
        }
        let /** @type {?} */ processedSummary = this.processedSummaryBySymbol.get(summary.symbol);
        if (!processedSummary) {
            processedSummary = this.processValue({ symbol: summary.symbol });
            this.processedSummaries.push(processedSummary);
            this.processedSummaryBySymbol.set(summary.symbol, processedSummary);
        }
        // Note: == by purpose to compare with undefined!
        if (processedSummary.metadata == null && symbolMeta != null) {
            processedSummary.metadata = this.processValue(symbolMeta);
        }
        // Note: == by purpose to compare with undefined!
        if (processedSummary.type == null && summary.type != null) {
            processedSummary.type = this.processValue(summary.type);
        }
    }
    /**
     * @return {?}
     */
    serialize() {
        const /** @type {?} */ exportAs = [];
        const /** @type {?} */ json = JSON.stringify({
            summaries: this.processedSummaries,
            symbols: this.symbols.map((symbol, index) => {
                symbol.assertNoMembers();
                let /** @type {?} */ importAs;
                if (this.summaryResolver.isLibraryFile(symbol.filePath)) {
                    importAs = `${symbol.name}_${index}`;
                    exportAs.push({ symbol, exportAs: importAs });
                }
                return {
                    __symbol: index,
                    name: symbol.name,
                    // We convert the source filenames tinto output filenames,
                    // as the generated summary file will be used when teh current
                    // compilation unit is used as a library
                    filePath: this.summaryResolver.getLibraryFileName(symbol.filePath),
                    importAs: importAs
                };
            })
        });
        return { json, exportAs };
    }
    /**
     * @param {?} value
     * @return {?}
     */
    processValue(value) { return visitValue(value, this, null); }
    /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    visitOther(value, context) {
        if (value instanceof StaticSymbol) {
            const /** @type {?} */ baseSymbol = this.symbolResolver.getStaticSymbol(value.filePath, value.name);
            let /** @type {?} */ index = this.indexBySymbol.get(baseSymbol);
            // Note: == by purpose to compare with undefined!
            if (index == null) {
                index = this.indexBySymbol.size;
                this.indexBySymbol.set(baseSymbol, index);
                this.symbols.push(baseSymbol);
            }
            return { __symbol: index, members: value.members };
        }
    }
}
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
class Deserializer extends ValueTransformer {
    /**
     * @param {?} symbolCache
     */
    constructor(symbolCache) {
        super();
        this.symbolCache = symbolCache;
    }
    /**
     * @param {?} json
     * @return {?}
     */
    deserialize(json) {
        const /** @type {?} */ data = JSON.parse(json);
        const /** @type {?} */ importAs = [];
        this.symbols = [];
        data.symbols.forEach((serializedSymbol) => {
            const /** @type {?} */ symbol = this.symbolCache.get(serializedSymbol.filePath, serializedSymbol.name);
            this.symbols.push(symbol);
            if (serializedSymbol.importAs) {
                importAs.push({ symbol: symbol, importAs: serializedSymbol.importAs });
            }
        });
        const /** @type {?} */ summaries = visitValue(data.summaries, this, null);
        return { summaries, importAs };
    }
    /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    visitStringMap(map, context) {
        if ('__symbol' in map) {
            const /** @type {?} */ baseSymbol = this.symbols[map['__symbol']];
            const /** @type {?} */ members = map['members'];
            return members.length ? this.symbolCache.get(baseSymbol.filePath, baseSymbol.name, members) :
                baseSymbol;
        }
        else {
            return super.visitStringMap(map, context);
        }
    }
}
function Deserializer_tsickle_Closure_declarations() {
    /** @type {?} */
    Deserializer.prototype.symbols;
    /** @type {?} */
    Deserializer.prototype.symbolCache;
}
//# sourceMappingURL=summary_serializer.js.map