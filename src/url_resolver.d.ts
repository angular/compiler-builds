/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InjectionToken } from '@angular/core';
export declare function createOfflineCompileUrlResolver(): UrlResolver;
/**
 * A default provider for {@link PACKAGE_ROOT_URL} that maps to '/'.
 */
export declare const DEFAULT_PACKAGE_URL_PROVIDER: {
    provide: InjectionToken<string>;
    useValue: string;
};
/**
 * Used by the {@link Compiler} when resolving HTML and CSS template URLs.
 *
 * This class can be overridden by the application developer to create custom behavior.
 *
 * See {@link Compiler}
 *
 * ## Example
 *
 * {@example compiler/ts/url_resolver/url_resolver.ts region='url_resolver'}
 *
 * @security  When compiling templates at runtime, you must
 * ensure that the entire template comes from a trusted source.
 * Attacker-controlled data introduced by a template could expose your
 * application to XSS risks. For more detail, see the [Security Guide](http://g.co/ng/security).
 */
export interface UrlResolver {
    resolve(baseUrl: string, url: string): string;
}
export interface UrlResolverCtor {
    new (packagePrefix?: string | null): UrlResolver;
}
export declare const UrlResolver: UrlResolverCtor;
/**
 * Extract the scheme of a URL.
 */
export declare function getUrlScheme(url: string): string;
