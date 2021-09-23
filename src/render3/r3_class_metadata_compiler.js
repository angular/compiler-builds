(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/r3_class_metadata_compiler", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileClassMetadata = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/util");
    function compileClassMetadata(metadata) {
        var _a, _b;
        // Generate an ngDevMode guarded call to setClassMetadata with the class identifier and its
        // metadata.
        var fnCall = o.importExpr(r3_identifiers_1.Identifiers.setClassMetadata).callFn([
            metadata.type,
            metadata.decorators,
            (_a = metadata.ctorParameters) !== null && _a !== void 0 ? _a : o.literal(null),
            (_b = metadata.propDecorators) !== null && _b !== void 0 ? _b : o.literal(null),
        ]);
        var iife = o.fn([], [(0, util_1.devOnlyGuardedExpression)(fnCall).toStmt()]);
        return iife.callFn([]);
    }
    exports.compileClassMetadata = compileClassMetadata;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY2xhc3NfbWV0YWRhdGFfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19jbGFzc19tZXRhZGF0YV9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBMEM7SUFFMUMsK0VBQW1EO0lBQ25ELDJEQUFnRDtJQWlDaEQsU0FBZ0Isb0JBQW9CLENBQUMsUUFBeUI7O1FBQzVELDJGQUEyRjtRQUMzRixZQUFZO1FBQ1osSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3RELFFBQVEsQ0FBQyxJQUFJO1lBQ2IsUUFBUSxDQUFDLFVBQVU7WUFDbkIsTUFBQSxRQUFRLENBQUMsY0FBYyxtQ0FBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUMxQyxNQUFBLFFBQVEsQ0FBQyxjQUFjLG1DQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1NBQzNDLENBQUMsQ0FBQztRQUNILElBQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbkUsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFYRCxvREFXQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtkZXZPbmx5R3VhcmRlZEV4cHJlc3Npb259IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIENvbXBpbGVDbGFzc01ldGFkYXRhRm4gPSAobWV0YWRhdGE6IFIzQ2xhc3NNZXRhZGF0YSkgPT4gby5FeHByZXNzaW9uO1xuXG4vKipcbiAqIE1ldGFkYXRhIG9mIGEgY2xhc3Mgd2hpY2ggY2FwdHVyZXMgdGhlIG9yaWdpbmFsIEFuZ3VsYXIgZGVjb3JhdG9ycyBvZiBhIGNsYXNzLiBUaGUgb3JpZ2luYWxcbiAqIGRlY29yYXRvcnMgYXJlIHByZXNlcnZlZCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUgdG8gYWxsb3cgVGVzdEJlZCBBUElzIHRvIHJlY29tcGlsZSB0aGUgY2xhc3NcbiAqIHVzaW5nIHRoZSBvcmlnaW5hbCBkZWNvcmF0b3Igd2l0aCBhIHNldCBvZiBvdmVycmlkZXMgYXBwbGllZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSM0NsYXNzTWV0YWRhdGEge1xuICAvKipcbiAgICogVGhlIGNsYXNzIHR5cGUgZm9yIHdoaWNoIHRoZSBtZXRhZGF0YSBpcyBjYXB0dXJlZC5cbiAgICovXG4gIHR5cGU6IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIEFuZ3VsYXIgZGVjb3JhdG9ycyB0aGF0IHdlcmUgYXBwbGllZCBvbiB0aGUgY2xhc3MuXG4gICAqL1xuICBkZWNvcmF0b3JzOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBBbmd1bGFyIGRlY29yYXRvcnMgYXBwbGllZCB0byBjb25zdHJ1Y3RvciBwYXJhbWV0ZXJzLCBvciBgbnVsbGBcbiAgICogaWYgdGhlcmUgaXMgbm8gY29uc3RydWN0b3IuXG4gICAqL1xuICBjdG9yUGFyYW1ldGVyczogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBBbmd1bGFyIGRlY29yYXRvcnMgdGhhdCB3ZXJlIGFwcGxpZWQgb24gdGhlIHByb3BlcnRpZXMgb2YgdGhlXG4gICAqIGNsYXNzLCBvciBgbnVsbGAgaWYgbm8gcHJvcGVydGllcyBoYXZlIGRlY29yYXRvcnMuXG4gICAqL1xuICBwcm9wRGVjb3JhdG9yczogby5FeHByZXNzaW9ufG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ2xhc3NNZXRhZGF0YShtZXRhZGF0YTogUjNDbGFzc01ldGFkYXRhKTogby5FeHByZXNzaW9uIHtcbiAgLy8gR2VuZXJhdGUgYW4gbmdEZXZNb2RlIGd1YXJkZWQgY2FsbCB0byBzZXRDbGFzc01ldGFkYXRhIHdpdGggdGhlIGNsYXNzIGlkZW50aWZpZXIgYW5kIGl0c1xuICAvLyBtZXRhZGF0YS5cbiAgY29uc3QgZm5DYWxsID0gby5pbXBvcnRFeHByKFIzLnNldENsYXNzTWV0YWRhdGEpLmNhbGxGbihbXG4gICAgbWV0YWRhdGEudHlwZSxcbiAgICBtZXRhZGF0YS5kZWNvcmF0b3JzLFxuICAgIG1ldGFkYXRhLmN0b3JQYXJhbWV0ZXJzID8/IG8ubGl0ZXJhbChudWxsKSxcbiAgICBtZXRhZGF0YS5wcm9wRGVjb3JhdG9ycyA/PyBvLmxpdGVyYWwobnVsbCksXG4gIF0pO1xuICBjb25zdCBpaWZlID0gby5mbihbXSwgW2Rldk9ubHlHdWFyZGVkRXhwcmVzc2lvbihmbkNhbGwpLnRvU3RtdCgpXSk7XG4gIHJldHVybiBpaWZlLmNhbGxGbihbXSk7XG59XG4iXX0=