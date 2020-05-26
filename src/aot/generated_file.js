/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/aot/generated_file", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/ts_emitter"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.toTypeScript = exports.GeneratedFile = void 0;
    var output_ast_1 = require("@angular/compiler/src/output/output_ast");
    var ts_emitter_1 = require("@angular/compiler/src/output/ts_emitter");
    var GeneratedFile = /** @class */ (function () {
        function GeneratedFile(srcFileUrl, genFileUrl, sourceOrStmts) {
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
        GeneratedFile.prototype.isEquivalent = function (other) {
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
            return output_ast_1.areAllEquivalent(this.stmts, other.stmts);
        };
        return GeneratedFile;
    }());
    exports.GeneratedFile = GeneratedFile;
    function toTypeScript(file, preamble) {
        if (preamble === void 0) { preamble = ''; }
        if (!file.stmts) {
            throw new Error("Illegal state: No stmts present on GeneratedFile " + file.genFileUrl);
        }
        return new ts_emitter_1.TypeScriptEmitter().emitStatements(file.genFileUrl, file.stmts, preamble);
    }
    exports.toTypeScript = toTypeScript;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkX2ZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvYW90L2dlbmVyYXRlZF9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILHNFQUFpRTtJQUNqRSxzRUFBdUQ7SUFFdkQ7UUFJRSx1QkFDVyxVQUFrQixFQUFTLFVBQWtCLEVBQUUsYUFBaUM7WUFBaEYsZUFBVSxHQUFWLFVBQVUsQ0FBUTtZQUFTLGVBQVUsR0FBVixVQUFVLENBQVE7WUFDdEQsSUFBSSxPQUFPLGFBQWEsS0FBSyxRQUFRLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDO2dCQUM1QixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQzthQUNuQjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztnQkFDbkIsSUFBSSxDQUFDLEtBQUssR0FBRyxhQUFhLENBQUM7YUFDNUI7UUFDSCxDQUFDO1FBRUQsb0NBQVksR0FBWixVQUFhLEtBQW9CO1lBQy9CLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUN4QyxPQUFPLEtBQUssQ0FBQzthQUNkO1lBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO2dCQUNmLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsTUFBTSxDQUFDO2FBQ3JDO1lBQ0QsSUFBSSxLQUFLLENBQUMsS0FBSyxJQUFJLElBQUksRUFBRTtnQkFDdkIsT0FBTyxLQUFLLENBQUM7YUFDZDtZQUNELHNFQUFzRTtZQUN0RSxzQkFBc0I7WUFDdEIsT0FBTyw2QkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBTSxFQUFFLEtBQUssQ0FBQyxLQUFNLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBQ0gsb0JBQUM7SUFBRCxDQUFDLEFBN0JELElBNkJDO0lBN0JZLHNDQUFhO0lBK0IxQixTQUFnQixZQUFZLENBQUMsSUFBbUIsRUFBRSxRQUFxQjtRQUFyQix5QkFBQSxFQUFBLGFBQXFCO1FBQ3JFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBb0QsSUFBSSxDQUFDLFVBQVksQ0FBQyxDQUFDO1NBQ3hGO1FBQ0QsT0FBTyxJQUFJLDhCQUFpQixFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN2RixDQUFDO0lBTEQsb0NBS0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXJlQWxsRXF1aXZhbGVudCwgU3RhdGVtZW50fSBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1R5cGVTY3JpcHRFbWl0dGVyfSBmcm9tICcuLi9vdXRwdXQvdHNfZW1pdHRlcic7XG5cbmV4cG9ydCBjbGFzcyBHZW5lcmF0ZWRGaWxlIHtcbiAgcHVibGljIHNvdXJjZTogc3RyaW5nfG51bGw7XG4gIHB1YmxpYyBzdG10czogU3RhdGVtZW50W118bnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBzcmNGaWxlVXJsOiBzdHJpbmcsIHB1YmxpYyBnZW5GaWxlVXJsOiBzdHJpbmcsIHNvdXJjZU9yU3RtdHM6IHN0cmluZ3xTdGF0ZW1lbnRbXSkge1xuICAgIGlmICh0eXBlb2Ygc291cmNlT3JTdG10cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuc291cmNlID0gc291cmNlT3JTdG10cztcbiAgICAgIHRoaXMuc3RtdHMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICB0aGlzLnN0bXRzID0gc291cmNlT3JTdG10cztcbiAgICB9XG4gIH1cblxuICBpc0VxdWl2YWxlbnQob3RoZXI6IEdlbmVyYXRlZEZpbGUpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5nZW5GaWxlVXJsICE9PSBvdGhlci5nZW5GaWxlVXJsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgcmV0dXJuIHRoaXMuc291cmNlID09PSBvdGhlci5zb3VyY2U7XG4gICAgfVxuICAgIGlmIChvdGhlci5zdG10cyA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIE5vdGU6IHRoZSBjb25zdHJ1Y3RvciBndWFyYW50ZWVzIHRoYXQgaWYgdGhpcy5zb3VyY2UgaXMgbm90IGZpbGxlZCxcbiAgICAvLyB0aGVuIHRoaXMuc3RtdHMgaXMuXG4gICAgcmV0dXJuIGFyZUFsbEVxdWl2YWxlbnQodGhpcy5zdG10cyEsIG90aGVyLnN0bXRzISk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvVHlwZVNjcmlwdChmaWxlOiBHZW5lcmF0ZWRGaWxlLCBwcmVhbWJsZTogc3RyaW5nID0gJycpOiBzdHJpbmcge1xuICBpZiAoIWZpbGUuc3RtdHMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgc3RhdGU6IE5vIHN0bXRzIHByZXNlbnQgb24gR2VuZXJhdGVkRmlsZSAke2ZpbGUuZ2VuRmlsZVVybH1gKTtcbiAgfVxuICByZXR1cm4gbmV3IFR5cGVTY3JpcHRFbWl0dGVyKCkuZW1pdFN0YXRlbWVudHMoZmlsZS5nZW5GaWxlVXJsLCBmaWxlLnN0bXRzLCBwcmVhbWJsZSk7XG59XG4iXX0=