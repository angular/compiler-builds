/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Interface that defines how import statements should be generated.
 * @abstract
 */
var ImportResolver = (function () {
    function ImportResolver() {
    }
    /**
     * Converts a file path to a module name that can be used as an `import.
     * I.e. `path/to/importedFile.ts` should be imported by `path/to/containingFile.ts`.
     * @abstract
     * @param {?} importedFilePath
     * @param {?} containingFilePath
     * @return {?}
     */
    ImportResolver.prototype.fileNameToModuleName = function (importedFilePath, containingFilePath) { };
    /**
     * Converts the given StaticSymbol into another StaticSymbol that should be used
     * to generate the import from.
     * @abstract
     * @param {?} symbol
     * @return {?}
     */
    ImportResolver.prototype.getImportAs = function (symbol) { };
    /**
     * Determine the airty of a type.
     * @abstract
     * @param {?} symbol
     * @return {?}
     */
    ImportResolver.prototype.getTypeArity = function (symbol) { };
    return ImportResolver;
}());
export { ImportResolver };
//# sourceMappingURL=path_util.js.map