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
import { analyzeAndValidateNgModules } from '../aot/compiler';
import { createAotUrlResolver } from '../aot/compiler_factory';
import { StaticReflector } from '../aot/static_reflector';
import { StaticSymbolCache } from '../aot/static_symbol';
import { StaticSymbolResolver } from '../aot/static_symbol_resolver';
import { AotSummaryResolver } from '../aot/summary_resolver';
import { CompilerConfig } from '../config';
import { ViewEncapsulation } from '../core';
import { DirectiveNormalizer } from '../directive_normalizer';
import { DirectiveResolver } from '../directive_resolver';
import { CompileMetadataResolver } from '../metadata_resolver';
import { HtmlParser } from '../ml_parser/html_parser';
import { InterpolationConfig } from '../ml_parser/interpolation_config';
import { NgModuleResolver } from '../ng_module_resolver';
import { PipeResolver } from '../pipe_resolver';
import { DomElementSchemaRegistry } from '../schema/dom_element_schema_registry';
import { MessageBundle } from './message_bundle';
/**
 * The host of the Extractor disconnects the implementation from TypeScript / other language
 * services and from underlying file systems.
 * @record
 */
export function ExtractorHost() { }
function ExtractorHost_tsickle_Closure_declarations() {
    /**
     * Converts a path that refers to a resource into an absolute filePath
     * that can be lateron used for loading the resource via `loadResource.
     * @type {?}
     */
    ExtractorHost.prototype.resourceNameToFileName;
    /**
     * Loads a resource (e.g. html / css)
     * @type {?}
     */
    ExtractorHost.prototype.loadResource;
}
export class Extractor {
    /**
     * @param {?} host
     * @param {?} staticSymbolResolver
     * @param {?} messageBundle
     * @param {?} metadataResolver
     */
    constructor(host, staticSymbolResolver, messageBundle, metadataResolver) {
        this.host = host;
        this.staticSymbolResolver = staticSymbolResolver;
        this.messageBundle = messageBundle;
        this.metadataResolver = metadataResolver;
    }
    /**
     * @param {?} rootFiles
     * @return {?}
     */
    extract(rootFiles) {
        const { files, ngModules } = analyzeAndValidateNgModules(rootFiles, this.host, this.staticSymbolResolver, this.metadataResolver);
        return Promise
            .all(ngModules.map(ngModule => this.metadataResolver.loadNgModuleDirectiveAndPipeMetadata(ngModule.type.reference, false)))
            .then(() => {
            const /** @type {?} */ errors = [];
            files.forEach(file => {
                const /** @type {?} */ compMetas = [];
                file.directives.forEach(directiveType => {
                    const /** @type {?} */ dirMeta = this.metadataResolver.getDirectiveMetadata(directiveType);
                    if (dirMeta && dirMeta.isComponent) {
                        compMetas.push(dirMeta);
                    }
                });
                compMetas.forEach(compMeta => {
                    const /** @type {?} */ html = /** @type {?} */ ((/** @type {?} */ ((compMeta.template)).template));
                    const /** @type {?} */ interpolationConfig = InterpolationConfig.fromArray(/** @type {?} */ ((compMeta.template)).interpolation);
                    errors.push(.../** @type {?} */ ((this.messageBundle.updateFromTemplate(html, file.fileName, interpolationConfig))));
                });
            });
            if (errors.length) {
                throw new Error(errors.map(e => e.toString()).join('\n'));
            }
            return this.messageBundle;
        });
    }
    /**
     * @param {?} host
     * @param {?} locale
     * @return {?}
     */
    static create(host, locale) {
        const /** @type {?} */ htmlParser = new HtmlParser();
        const /** @type {?} */ urlResolver = createAotUrlResolver(host);
        const /** @type {?} */ symbolCache = new StaticSymbolCache();
        const /** @type {?} */ summaryResolver = new AotSummaryResolver(host, symbolCache);
        const /** @type {?} */ staticSymbolResolver = new StaticSymbolResolver(host, symbolCache, summaryResolver);
        const /** @type {?} */ staticReflector = new StaticReflector(summaryResolver, staticSymbolResolver);
        const /** @type {?} */ config = new CompilerConfig({ defaultEncapsulation: ViewEncapsulation.Emulated, useJit: false });
        const /** @type {?} */ normalizer = new DirectiveNormalizer({ get: (url) => host.loadResource(url) }, urlResolver, htmlParser, config);
        const /** @type {?} */ elementSchemaRegistry = new DomElementSchemaRegistry();
        const /** @type {?} */ resolver = new CompileMetadataResolver(config, htmlParser, new NgModuleResolver(staticReflector), new DirectiveResolver(staticReflector), new PipeResolver(staticReflector), summaryResolver, elementSchemaRegistry, normalizer, console, symbolCache, staticReflector);
        // TODO(vicb): implicit tags & attributes
        const /** @type {?} */ messageBundle = new MessageBundle(htmlParser, [], {}, locale);
        const /** @type {?} */ extractor = new Extractor(host, staticSymbolResolver, messageBundle, resolver);
        return { extractor, staticReflector };
    }
}
function Extractor_tsickle_Closure_declarations() {
    /** @type {?} */
    Extractor.prototype.host;
    /** @type {?} */
    Extractor.prototype.staticSymbolResolver;
    /** @type {?} */
    Extractor.prototype.messageBundle;
    /** @type {?} */
    Extractor.prototype.metadataResolver;
}
//# sourceMappingURL=extractor.js.map