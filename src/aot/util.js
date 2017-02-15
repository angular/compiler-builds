/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var /** @type {?} */ STRIP_SRC_FILE_SUFFIXES = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
var /** @type {?} */ NG_FACTORY = /\.ngfactory\./;
/**
 * @param {?} filePath
 * @return {?}
 */
export function ngfactoryFilePath(filePath) {
    var /** @type {?} */ urlWithSuffix = splitTypescriptSuffix(filePath);
    return urlWithSuffix[0] + ".ngfactory" + urlWithSuffix[1];
}
/**
 * @param {?} filePath
 * @return {?}
 */
export function stripNgFactory(filePath) {
    return filePath.replace(NG_FACTORY, '.');
}
/**
 * @param {?} filePath
 * @return {?}
 */
export function isNgFactoryFile(filePath) {
    return NG_FACTORY.test(filePath);
}
/**
 * @param {?} path
 * @return {?}
 */
export function splitTypescriptSuffix(path) {
    if (path.endsWith('.d.ts')) {
        return [path.slice(0, -5), '.ts'];
    }
    var /** @type {?} */ lastDot = path.lastIndexOf('.');
    if (lastDot !== -1) {
        return [path.substring(0, lastDot), path.substring(lastDot)];
    }
    return [path, ''];
}
/**
 * @param {?} fileName
 * @return {?}
 */
export function summaryFileName(fileName) {
    var /** @type {?} */ fileNameWithoutSuffix = fileName.replace(STRIP_SRC_FILE_SUFFIXES, '');
    return fileNameWithoutSuffix + ".ngsummary.json";
}
//# sourceMappingURL=util.js.map