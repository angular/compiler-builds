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
import { areAllEquivalent } from '../output/output_ast';
import { TypeScriptEmitter } from '../output/ts_emitter';
export class GeneratedFile {
    /**
     * @param {?} srcFileUrl
     * @param {?} genFileUrl
     * @param {?} sourceOrStmts
     */
    constructor(srcFileUrl, genFileUrl, sourceOrStmts) {
        this.srcFileUrl = srcFileUrl;
        this.genFileUrl = genFileUrl;
        if (typeof sourceOrStmts === 'string') {
            this.source = sourceOrStmts;
            this.stmts = null;
        }
        else {
            this.source = null;
            this.stmts = sourceOrStmts;
        }
    }
    /**
     * @param {?} other
     * @return {?}
     */
    isEquivalent(other) {
        if (this.genFileUrl !== other.genFileUrl) {
            return false;
        }
        if (this.source) {
            return this.source === other.source;
        }
        if (other.stmts == null) {
            return false;
        }
        // Note: the constructor guarantees that if this.source is not filled,
        // then this.stmts is.
        return areAllEquivalent(/** @type {?} */ ((this.stmts)), /** @type {?} */ ((other.stmts)));
    }
}
function GeneratedFile_tsickle_Closure_declarations() {
    /** @type {?} */
    GeneratedFile.prototype.source;
    /** @type {?} */
    GeneratedFile.prototype.stmts;
    /** @type {?} */
    GeneratedFile.prototype.srcFileUrl;
    /** @type {?} */
    GeneratedFile.prototype.genFileUrl;
}
/**
 * @param {?} file
 * @param {?=} preamble
 * @return {?}
 */
export function toTypeScript(file, preamble = '') {
    if (!file.stmts) {
        throw new Error(`Illegal state: No stmts present on GeneratedFile ${file.genFileUrl}`);
    }
    return new TypeScriptEmitter().emitStatements(file.genFileUrl, file.stmts, preamble);
}
//# sourceMappingURL=generated_file.js.map