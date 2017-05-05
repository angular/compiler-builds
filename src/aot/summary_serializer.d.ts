/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileDirectiveMetadata, CompileNgModuleMetadata, CompilePipeMetadata, CompileTypeMetadata, CompileTypeSummary } from '../compile_metadata';
import * as o from '../output/output_ast';
import { Summary, SummaryResolver } from '../summary_resolver';
import { StaticSymbol, StaticSymbolCache } from './static_symbol';
import { ResolvedStaticSymbol, StaticSymbolResolver } from './static_symbol_resolver';
export declare function serializeSummaries(summaryResolver: SummaryResolver<StaticSymbol>, symbolResolver: StaticSymbolResolver, symbols: ResolvedStaticSymbol[], types: {
    summary: CompileTypeSummary;
    metadata: CompileNgModuleMetadata | CompileDirectiveMetadata | CompilePipeMetadata | CompileTypeMetadata;
}[]): {
    json: string;
    exportAs: {
        symbol: StaticSymbol;
        exportAs: string;
    }[];
    forJit: {
        statements: o.Statement[];
        exportedVars: string[];
    };
};
export declare function deserializeSummaries(symbolCache: StaticSymbolCache, json: string): {
    summaries: Summary<StaticSymbol>[];
    importAs: {
        symbol: StaticSymbol;
        importAs: string;
    }[];
};
