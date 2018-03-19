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
/**
 * The host of the AotCompiler disconnects the implementation from TypeScript / other language
 * services and from underlying file systems.
 * @record
 */
export function AotCompilerHost() { }
function AotCompilerHost_tsickle_Closure_declarations() {
    /**
     * Converts a file path to a module name that can be used as an `import.
     * I.e. `path/to/importedFile.ts` should be imported by `path/to/containingFile.ts`.
     *
     * See ImportResolver.
     * @type {?}
     */
    AotCompilerHost.prototype.fileNameToModuleName;
    /**
     * Converts a path that refers to a resource into an absolute filePath
     * that can be later on used for loading the resource via `loadResource.
     * @type {?}
     */
    AotCompilerHost.prototype.resourceNameToFileName;
    /**
     * Loads a resource (e.g. html / css)
     * @type {?}
     */
    AotCompilerHost.prototype.loadResource;
}
//# sourceMappingURL=compiler_host.js.map