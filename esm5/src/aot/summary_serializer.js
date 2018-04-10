/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
import * as tslib_1 from "tslib";
import { CompileNgModuleMetadata, CompileSummaryKind } from '../compile_metadata';
import * as o from '../output/output_ast';
import { ValueTransformer, visitValue } from '../util';
import { StaticSymbol } from './static_symbol';
import { unwrapResolvedMetadata } from './static_symbol_resolver';
import { isLoweredSymbol, ngfactoryFilePath, summaryForJitFileName, summaryForJitName } from './util';
/**
 * @param {?} srcFileName
 * @param {?} forJitCtx
 * @param {?} summaryResolver
 * @param {?} symbolResolver
 * @param {?} symbols
 * @param {?} types
 * @return {?}
 */
export function serializeSummaries(srcFileName, forJitCtx, summaryResolver, symbolResolver, symbols, types) {
    var /** @type {?} */ toJsonSerializer = new ToJsonSerializer(symbolResolver, summaryResolver, srcFileName);
    // for symbols, we use everything except for the class metadata itself
    // (we keep the statics though), as the class metadata is contained in the
    // CompileTypeSummary.
    symbols.forEach(function (resolvedSymbol) {
        return toJsonSerializer.addSummary({ symbol: resolvedSymbol.symbol, metadata: resolvedSymbol.metadata });
    });
    // Add type summaries.
    types.forEach(function (_a) {
        var summary = _a.summary, metadata = _a.metadata;
        toJsonSerializer.addSummary({ symbol: summary.type.reference, metadata: undefined, type: summary });
    });
    var _a = toJsonSerializer.serialize(), json = _a.json, exportAs = _a.exportAs;
    if (forJitCtx) {
        var /** @type {?} */ forJitSerializer_1 = new ForJitSerializer(forJitCtx, symbolResolver, summaryResolver);
        types.forEach(function (_a) {
            var summary = _a.summary, metadata = _a.metadata;
            forJitSerializer_1.addSourceType(summary, metadata);
        });
        toJsonSerializer.unprocessedSymbolSummariesBySymbol.forEach(function (summary) {
            if (summaryResolver.isLibraryFile(summary.symbol.filePath) && summary.type) {
                forJitSerializer_1.addLibType(summary.type);
            }
        });
        forJitSerializer_1.serialize(exportAs);
    }
    return { json: json, exportAs: exportAs };
}
/**
 * @param {?} symbolCache
 * @param {?} summaryResolver
 * @param {?} libraryFileName
 * @param {?} json
 * @return {?}
 */
export function deserializeSummaries(symbolCache, summaryResolver, libraryFileName, json) {
    var /** @type {?} */ deserializer = new FromJsonDeserializer(symbolCache, summaryResolver);
    return deserializer.deserialize(libraryFileName, json);
}
/**
 * @param {?} outputCtx
 * @param {?} reference
 * @return {?}
 */
export function createForJitStub(outputCtx, reference) {
    return createSummaryForJitFunction(outputCtx, reference, o.NULL_EXPR);
}
/**
 * @param {?} outputCtx
 * @param {?} reference
 * @param {?} value
 * @return {?}
 */
function createSummaryForJitFunction(outputCtx, reference, value) {
    var /** @type {?} */ fnName = summaryForJitName(reference.name);
    outputCtx.statements.push(o.fn([], [new o.ReturnStatement(value)], new o.ArrayType(o.DYNAMIC_TYPE)).toDeclStmt(fnName, [
        o.StmtModifier.Final, o.StmtModifier.Exported
    ]));
}
/** @enum {number} */
var SerializationFlags = {
    None: 0,
    ResolveValue: 1,
};
var ToJsonSerializer = /** @class */ (function (_super) {
    tslib_1.__extends(ToJsonSerializer, _super);
    function ToJsonSerializer(symbolResolver, summaryResolver, srcFileName) {
        var _this = _super.call(this) || this;
        _this.symbolResolver = symbolResolver;
        _this.summaryResolver = summaryResolver;
        _this.srcFileName = srcFileName;
        _this.symbols = [];
        _this.indexBySymbol = new Map();
        _this.reexportedBy = new Map();
        _this.processedSummaryBySymbol = new Map();
        _this.processedSummaries = [];
        _this.unprocessedSymbolSummariesBySymbol = new Map();
        _this.moduleName = symbolResolver.getKnownModuleName(srcFileName);
        return _this;
    }
    /**
     * @param {?} summary
     * @return {?}
     */
    ToJsonSerializer.prototype.addSummary = /**
     * @param {?} summary
     * @return {?}
     */
    function (summary) {
        var _this = this;
        var /** @type {?} */ unprocessedSummary = this.unprocessedSymbolSummariesBySymbol.get(summary.symbol);
        var /** @type {?} */ processedSummary = this.processedSummaryBySymbol.get(summary.symbol);
        if (!unprocessedSummary) {
            unprocessedSummary = { symbol: summary.symbol, metadata: undefined };
            this.unprocessedSymbolSummariesBySymbol.set(summary.symbol, unprocessedSummary);
            processedSummary = { symbol: this.processValue(summary.symbol, 0 /* None */) };
            this.processedSummaries.push(processedSummary);
            this.processedSummaryBySymbol.set(summary.symbol, processedSummary);
        }
        if (!unprocessedSummary.metadata && summary.metadata) {
            var /** @type {?} */ metadata_1 = summary.metadata || {};
            if (metadata_1.__symbolic === 'class') {
                // For classes, we keep everything except their class decorators.
                // We need to keep e.g. the ctor args, method names, method decorators
                // so that the class can be extended in another compilation unit.
                // We don't keep the class decorators as
                // 1) they refer to data
                //   that should not cause a rebuild of downstream compilation units
                //   (e.g. inline templates of @Component, or @NgModule.declarations)
                // 2) their data is already captured in TypeSummaries, e.g. DirectiveSummary.
                var /** @type {?} */ clone_1 = {};
                Object.keys(metadata_1).forEach(function (propName) {
                    if (propName !== 'decorators') {
                        clone_1[propName] = metadata_1[propName];
                    }
                });
                metadata_1 = clone_1;
            }
            else if (isCall(metadata_1)) {
                if (!isFunctionCall(metadata_1) && !isMethodCallOnVariable(metadata_1)) {
                    // Don't store complex calls as we won't be able to simplify them anyways later on.
                    // Don't store complex calls as we won't be able to simplify them anyways later on.
                    metadata_1 = {
                        __symbolic: 'error',
                        message: 'Complex function calls are not supported.',
                    };
                }
            }
            // Note: We need to keep storing ctor calls for e.g.
            // `export const x = new InjectionToken(...)`
            unprocessedSummary.metadata = metadata_1;
            processedSummary.metadata = this.processValue(metadata_1, 1 /* ResolveValue */);
            if (metadata_1 instanceof StaticSymbol &&
                this.summaryResolver.isLibraryFile(metadata_1.filePath)) {
                var /** @type {?} */ declarationSymbol = this.symbols[/** @type {?} */ ((this.indexBySymbol.get(metadata_1)))];
                if (!isLoweredSymbol(declarationSymbol.name)) {
                    // Note: symbols that were introduced during codegen in the user file can have a reexport
                    // if a user used `export *`. However, we can't rely on this as tsickle will change
                    // `export *` into named exports, using only the information from the typechecker.
                    // As we introduce the new symbols after typecheck, Tsickle does not know about them,
                    // and omits them when expanding `export *`.
                    // So we have to keep reexporting these symbols manually via .ngfactory files.
                    this.reexportedBy.set(declarationSymbol, summary.symbol);
                }
            }
        }
        if (!unprocessedSummary.type && summary.type) {
            unprocessedSummary.type = summary.type;
            // Note: We don't add the summaries of all referenced symbols as for the ResolvedSymbols,
            // as the type summaries already contain the transitive data that they require
            // (in a minimal way).
            processedSummary.type = this.processValue(summary.type, 0 /* None */);
            // except for reexported directives / pipes, so we need to store
            // their summaries explicitly.
            if (summary.type.summaryKind === CompileSummaryKind.NgModule) {
                var /** @type {?} */ ngModuleSummary = /** @type {?} */ (summary.type);
                ngModuleSummary.exportedDirectives.concat(ngModuleSummary.exportedPipes).forEach(function (id) {
                    var /** @type {?} */ symbol = id.reference;
                    if (_this.summaryResolver.isLibraryFile(symbol.filePath) &&
                        !_this.unprocessedSymbolSummariesBySymbol.has(symbol)) {
                        var /** @type {?} */ summary_1 = _this.summaryResolver.resolveSummary(symbol);
                        if (summary_1) {
                            _this.addSummary(summary_1);
                        }
                    }
                });
            }
        }
    };
    /**
     * @return {?}
     */
    ToJsonSerializer.prototype.serialize = /**
     * @return {?}
     */
    function () {
        var _this = this;
        var /** @type {?} */ exportAs = [];
        var /** @type {?} */ json = JSON.stringify({
            moduleName: this.moduleName,
            summaries: this.processedSummaries,
            symbols: this.symbols.map(function (symbol, index) {
                symbol.assertNoMembers();
                var /** @type {?} */ importAs = /** @type {?} */ ((undefined));
                if (_this.summaryResolver.isLibraryFile(symbol.filePath)) {
                    var /** @type {?} */ reexportSymbol = _this.reexportedBy.get(symbol);
                    if (reexportSymbol) {
                        importAs = /** @type {?} */ ((_this.indexBySymbol.get(reexportSymbol)));
                    }
                    else {
                        var /** @type {?} */ summary = _this.unprocessedSymbolSummariesBySymbol.get(symbol);
                        if (!summary || !summary.metadata || summary.metadata.__symbolic !== 'interface') {
                            importAs = symbol.name + "_" + index;
                            exportAs.push({ symbol: symbol, exportAs: importAs });
                        }
                    }
                }
                return {
                    __symbol: index,
                    name: symbol.name,
                    filePath: _this.summaryResolver.toSummaryFileName(symbol.filePath, _this.srcFileName),
                    importAs: importAs
                };
            })
        });
        return { json: json, exportAs: exportAs };
    };
    /**
     * @param {?} value
     * @param {?} flags
     * @return {?}
     */
    ToJsonSerializer.prototype.processValue = /**
     * @param {?} value
     * @param {?} flags
     * @return {?}
     */
    function (value, flags) {
        return visitValue(value, this, flags);
    };
    /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    ToJsonSerializer.prototype.visitOther = /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    function (value, context) {
        if (value instanceof StaticSymbol) {
            var /** @type {?} */ baseSymbol = this.symbolResolver.getStaticSymbol(value.filePath, value.name);
            var /** @type {?} */ index = this.visitStaticSymbol(baseSymbol, context);
            return { __symbol: index, members: value.members };
        }
    };
    /**
     * Strip line and character numbers from ngsummaries.
     * Emitting them causes white spaces changes to retrigger upstream
     * recompilations in bazel.
     * TODO: find out a way to have line and character numbers in errors without
     * excessive recompilation in bazel.
     */
    /**
     * Strip line and character numbers from ngsummaries.
     * Emitting them causes white spaces changes to retrigger upstream
     * recompilations in bazel.
     * TODO: find out a way to have line and character numbers in errors without
     * excessive recompilation in bazel.
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    ToJsonSerializer.prototype.visitStringMap = /**
     * Strip line and character numbers from ngsummaries.
     * Emitting them causes white spaces changes to retrigger upstream
     * recompilations in bazel.
     * TODO: find out a way to have line and character numbers in errors without
     * excessive recompilation in bazel.
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    function (map, context) {
        if (map['__symbolic'] === 'resolved') {
            return visitValue(map["symbol"], this, context);
        }
        if (map['__symbolic'] === 'error') {
            delete map['line'];
            delete map['character'];
        }
        return _super.prototype.visitStringMap.call(this, map, context);
    };
    /**
     * Returns null if the options.resolveValue is true, and the summary for the symbol
     * resolved to a type or could not be resolved.
     * @param {?} baseSymbol
     * @param {?} flags
     * @return {?}
     */
    ToJsonSerializer.prototype.visitStaticSymbol = /**
     * Returns null if the options.resolveValue is true, and the summary for the symbol
     * resolved to a type or could not be resolved.
     * @param {?} baseSymbol
     * @param {?} flags
     * @return {?}
     */
    function (baseSymbol, flags) {
        var /** @type {?} */ index = this.indexBySymbol.get(baseSymbol);
        var /** @type {?} */ summary = null;
        if (flags & 1 /* ResolveValue */ &&
            this.summaryResolver.isLibraryFile(baseSymbol.filePath)) {
            if (this.unprocessedSymbolSummariesBySymbol.has(baseSymbol)) {
                // the summary for this symbol was already added
                // -> nothing to do.
                return /** @type {?} */ ((index));
            }
            summary = this.loadSummary(baseSymbol);
            if (summary && summary.metadata instanceof StaticSymbol) {
                // The summary is a reexport
                index = this.visitStaticSymbol(summary.metadata, flags);
                // reset the summary as it is just a reexport, so we don't want to store it.
                summary = null;
            }
        }
        else if (index != null) {
            // Note: == on purpose to compare with undefined!
            // No summary and the symbol is already added -> nothing to do.
            return index;
        }
        // Note: == on purpose to compare with undefined!
        if (index == null) {
            index = this.symbols.length;
            this.symbols.push(baseSymbol);
        }
        this.indexBySymbol.set(baseSymbol, index);
        if (summary) {
            this.addSummary(summary);
        }
        return index;
    };
    /**
     * @param {?} symbol
     * @return {?}
     */
    ToJsonSerializer.prototype.loadSummary = /**
     * @param {?} symbol
     * @return {?}
     */
    function (symbol) {
        var /** @type {?} */ summary = this.summaryResolver.resolveSummary(symbol);
        if (!summary) {
            // some symbols might originate from a plain typescript library
            // that just exported .d.ts and .metadata.json files, i.e. where no summary
            // files were created.
            var /** @type {?} */ resolvedSymbol = this.symbolResolver.resolveSymbol(symbol);
            if (resolvedSymbol) {
                summary = { symbol: resolvedSymbol.symbol, metadata: resolvedSymbol.metadata };
            }
        }
        return summary;
    };
    return ToJsonSerializer;
}(ValueTransformer));
function ToJsonSerializer_tsickle_Closure_declarations() {
    /** @type {?} */
    ToJsonSerializer.prototype.symbols;
    /** @type {?} */
    ToJsonSerializer.prototype.indexBySymbol;
    /** @type {?} */
    ToJsonSerializer.prototype.reexportedBy;
    /** @type {?} */
    ToJsonSerializer.prototype.processedSummaryBySymbol;
    /** @type {?} */
    ToJsonSerializer.prototype.processedSummaries;
    /** @type {?} */
    ToJsonSerializer.prototype.moduleName;
    /** @type {?} */
    ToJsonSerializer.prototype.unprocessedSymbolSummariesBySymbol;
    /** @type {?} */
    ToJsonSerializer.prototype.symbolResolver;
    /** @type {?} */
    ToJsonSerializer.prototype.summaryResolver;
    /** @type {?} */
    ToJsonSerializer.prototype.srcFileName;
}
var ForJitSerializer = /** @class */ (function () {
    function ForJitSerializer(outputCtx, symbolResolver, summaryResolver) {
        this.outputCtx = outputCtx;
        this.symbolResolver = symbolResolver;
        this.summaryResolver = summaryResolver;
        this.data = [];
    }
    /**
     * @param {?} summary
     * @param {?} metadata
     * @return {?}
     */
    ForJitSerializer.prototype.addSourceType = /**
     * @param {?} summary
     * @param {?} metadata
     * @return {?}
     */
    function (summary, metadata) {
        this.data.push({ summary: summary, metadata: metadata, isLibrary: false });
    };
    /**
     * @param {?} summary
     * @return {?}
     */
    ForJitSerializer.prototype.addLibType = /**
     * @param {?} summary
     * @return {?}
     */
    function (summary) {
        this.data.push({ summary: summary, metadata: null, isLibrary: true });
    };
    /**
     * @param {?} exportAsArr
     * @return {?}
     */
    ForJitSerializer.prototype.serialize = /**
     * @param {?} exportAsArr
     * @return {?}
     */
    function (exportAsArr) {
        var _this = this;
        var /** @type {?} */ exportAsBySymbol = new Map();
        for (var _i = 0, exportAsArr_1 = exportAsArr; _i < exportAsArr_1.length; _i++) {
            var _a = exportAsArr_1[_i], symbol = _a.symbol, exportAs = _a.exportAs;
            exportAsBySymbol.set(symbol, exportAs);
        }
        var /** @type {?} */ ngModuleSymbols = new Set();
        for (var _b = 0, _c = this.data; _b < _c.length; _b++) {
            var _d = _c[_b], summary = _d.summary, metadata = _d.metadata, isLibrary = _d.isLibrary;
            if (summary.summaryKind === CompileSummaryKind.NgModule) {
                // collect the symbols that refer to NgModule classes.
                // Note: we can't just rely on `summary.type.summaryKind` to determine this as
                // we don't add the summaries of all referenced symbols when we serialize type summaries.
                // See serializeSummaries for details.
                ngModuleSymbols.add(summary.type.reference);
                var /** @type {?} */ modSummary = /** @type {?} */ (summary);
                for (var _e = 0, _f = modSummary.modules; _e < _f.length; _e++) {
                    var mod = _f[_e];
                    ngModuleSymbols.add(mod.reference);
                }
            }
            if (!isLibrary) {
                var /** @type {?} */ fnName = summaryForJitName(summary.type.reference.name);
                createSummaryForJitFunction(this.outputCtx, summary.type.reference, this.serializeSummaryWithDeps(summary, /** @type {?} */ ((metadata))));
            }
        }
        ngModuleSymbols.forEach(function (ngModuleSymbol) {
            if (_this.summaryResolver.isLibraryFile(ngModuleSymbol.filePath)) {
                var /** @type {?} */ exportAs = exportAsBySymbol.get(ngModuleSymbol) || ngModuleSymbol.name;
                var /** @type {?} */ jitExportAsName = summaryForJitName(exportAs);
                _this.outputCtx.statements.push(o.variable(jitExportAsName)
                    .set(_this.serializeSummaryRef(ngModuleSymbol))
                    .toDeclStmt(null, [o.StmtModifier.Exported]));
            }
        });
    };
    /**
     * @param {?} summary
     * @param {?} metadata
     * @return {?}
     */
    ForJitSerializer.prototype.serializeSummaryWithDeps = /**
     * @param {?} summary
     * @param {?} metadata
     * @return {?}
     */
    function (summary, metadata) {
        var _this = this;
        var /** @type {?} */ expressions = [this.serializeSummary(summary)];
        var /** @type {?} */ providers = [];
        if (metadata instanceof CompileNgModuleMetadata) {
            expressions.push.apply(expressions, 
            // For directives / pipes, we only add the declared ones,
            // and rely on transitively importing NgModules to get the transitive
            // summaries.
            metadata.declaredDirectives.concat(metadata.declaredPipes)
                .map(function (type) { return type.reference; })
                .concat(metadata.transitiveModule.modules.map(function (type) { return type.reference; })
                .filter(function (ref) { return ref !== metadata.type.reference; }))
                .map(function (ref) { return _this.serializeSummaryRef(ref); }));
            // Note: We don't use `NgModuleSummary.providers`, as that one is transitive,
            // and we already have transitive modules.
            providers = metadata.providers;
        }
        else if (summary.summaryKind === CompileSummaryKind.Directive) {
            var /** @type {?} */ dirSummary = /** @type {?} */ (summary);
            providers = dirSummary.providers.concat(dirSummary.viewProviders);
        }
        // Note: We can't just refer to the `ngsummary.ts` files for `useClass` providers (as we do for
        // declaredDirectives / declaredPipes), as we allow
        // providers without ctor arguments to skip the `@Injectable` decorator,
        // i.e. we didn't generate .ngsummary.ts files for these.
        expressions.push.apply(expressions, providers.filter(function (provider) { return !!provider.useClass; }).map(function (provider) {
            return _this.serializeSummary(/** @type {?} */ ({
                summaryKind: CompileSummaryKind.Injectable, type: provider.useClass
            }));
        }));
        return o.literalArr(expressions);
    };
    /**
     * @param {?} typeSymbol
     * @return {?}
     */
    ForJitSerializer.prototype.serializeSummaryRef = /**
     * @param {?} typeSymbol
     * @return {?}
     */
    function (typeSymbol) {
        var /** @type {?} */ jitImportedSymbol = this.symbolResolver.getStaticSymbol(summaryForJitFileName(typeSymbol.filePath), summaryForJitName(typeSymbol.name));
        return this.outputCtx.importExpr(jitImportedSymbol);
    };
    /**
     * @param {?} data
     * @return {?}
     */
    ForJitSerializer.prototype.serializeSummary = /**
     * @param {?} data
     * @return {?}
     */
    function (data) {
        var /** @type {?} */ outputCtx = this.outputCtx;
        var Transformer = /** @class */ (function () {
            function Transformer() {
            }
            /**
             * @param {?} arr
             * @param {?} context
             * @return {?}
             */
            Transformer.prototype.visitArray = /**
             * @param {?} arr
             * @param {?} context
             * @return {?}
             */
            function (arr, context) {
                var _this = this;
                return o.literalArr(arr.map(function (entry) { return visitValue(entry, _this, context); }));
            };
            /**
             * @param {?} map
             * @param {?} context
             * @return {?}
             */
            Transformer.prototype.visitStringMap = /**
             * @param {?} map
             * @param {?} context
             * @return {?}
             */
            function (map, context) {
                var _this = this;
                return new o.LiteralMapExpr(Object.keys(map).map(function (key) { return new o.LiteralMapEntry(key, visitValue(map[key], _this, context), false); }));
            };
            /**
             * @param {?} value
             * @param {?} context
             * @return {?}
             */
            Transformer.prototype.visitPrimitive = /**
             * @param {?} value
             * @param {?} context
             * @return {?}
             */
            function (value, context) { return o.literal(value); };
            /**
             * @param {?} value
             * @param {?} context
             * @return {?}
             */
            Transformer.prototype.visitOther = /**
             * @param {?} value
             * @param {?} context
             * @return {?}
             */
            function (value, context) {
                if (value instanceof StaticSymbol) {
                    return outputCtx.importExpr(value);
                }
                else {
                    throw new Error("Illegal State: Encountered value " + value);
                }
            };
            return Transformer;
        }());
        return visitValue(data, new Transformer(), null);
    };
    return ForJitSerializer;
}());
function ForJitSerializer_tsickle_Closure_declarations() {
    /** @type {?} */
    ForJitSerializer.prototype.data;
    /** @type {?} */
    ForJitSerializer.prototype.outputCtx;
    /** @type {?} */
    ForJitSerializer.prototype.symbolResolver;
    /** @type {?} */
    ForJitSerializer.prototype.summaryResolver;
}
var FromJsonDeserializer = /** @class */ (function (_super) {
    tslib_1.__extends(FromJsonDeserializer, _super);
    function FromJsonDeserializer(symbolCache, summaryResolver) {
        var _this = _super.call(this) || this;
        _this.symbolCache = symbolCache;
        _this.summaryResolver = summaryResolver;
        return _this;
    }
    /**
     * @param {?} libraryFileName
     * @param {?} json
     * @return {?}
     */
    FromJsonDeserializer.prototype.deserialize = /**
     * @param {?} libraryFileName
     * @param {?} json
     * @return {?}
     */
    function (libraryFileName, json) {
        var _this = this;
        var /** @type {?} */ data = JSON.parse(json);
        var /** @type {?} */ allImportAs = [];
        this.symbols = data.symbols.map(function (serializedSymbol) {
            return _this.symbolCache.get(_this.summaryResolver.fromSummaryFileName(serializedSymbol.filePath, libraryFileName), serializedSymbol.name);
        });
        data.symbols.forEach(function (serializedSymbol, index) {
            var /** @type {?} */ symbol = _this.symbols[index];
            var /** @type {?} */ importAs = serializedSymbol.importAs;
            if (typeof importAs === 'number') {
                allImportAs.push({ symbol: symbol, importAs: _this.symbols[importAs] });
            }
            else if (typeof importAs === 'string') {
                allImportAs.push({ symbol: symbol, importAs: _this.symbolCache.get(ngfactoryFilePath(libraryFileName), importAs) });
            }
        });
        var /** @type {?} */ summaries = /** @type {?} */ (visitValue(data.summaries, this, null));
        return { moduleName: data.moduleName, summaries: summaries, importAs: allImportAs };
    };
    /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    FromJsonDeserializer.prototype.visitStringMap = /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    function (map, context) {
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
    return FromJsonDeserializer;
}(ValueTransformer));
function FromJsonDeserializer_tsickle_Closure_declarations() {
    /** @type {?} */
    FromJsonDeserializer.prototype.symbols;
    /** @type {?} */
    FromJsonDeserializer.prototype.symbolCache;
    /** @type {?} */
    FromJsonDeserializer.prototype.summaryResolver;
}
/**
 * @param {?} metadata
 * @return {?}
 */
function isCall(metadata) {
    return metadata && metadata.__symbolic === 'call';
}
/**
 * @param {?} metadata
 * @return {?}
 */
function isFunctionCall(metadata) {
    return isCall(metadata) && unwrapResolvedMetadata(metadata.expression) instanceof StaticSymbol;
}
/**
 * @param {?} metadata
 * @return {?}
 */
function isMethodCallOnVariable(metadata) {
    return isCall(metadata) && metadata.expression && metadata.expression.__symbolic === 'select' &&
        unwrapResolvedMetadata(metadata.expression.expression) instanceof StaticSymbol;
}
//# sourceMappingURL=summary_serializer.js.map