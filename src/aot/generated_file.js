/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
            return (0, output_ast_1.areAllEquivalent)(this.stmts, other.stmts);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkX2ZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvYW90L2dlbmVyYXRlZF9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILHNFQUFpRTtJQUNqRSxzRUFBdUQ7SUFFdkQ7UUFJRSx1QkFDVyxVQUFrQixFQUFTLFVBQWtCLEVBQUUsYUFBaUM7WUFBaEYsZUFBVSxHQUFWLFVBQVUsQ0FBUTtZQUFTLGVBQVUsR0FBVixVQUFVLENBQVE7WUFDdEQsSUFBSSxPQUFPLGFBQWEsS0FBSyxRQUFRLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDO2dCQUM1QixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQzthQUNuQjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztnQkFDbkIsSUFBSSxDQUFDLEtBQUssR0FBRyxhQUFhLENBQUM7YUFDNUI7UUFDSCxDQUFDO1FBRUQsb0NBQVksR0FBWixVQUFhLEtBQW9CO1lBQy9CLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUN4QyxPQUFPLEtBQUssQ0FBQzthQUNkO1lBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO2dCQUNmLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsTUFBTSxDQUFDO2FBQ3JDO1lBQ0QsSUFBSSxLQUFLLENBQUMsS0FBSyxJQUFJLElBQUksRUFBRTtnQkFDdkIsT0FBTyxLQUFLLENBQUM7YUFDZDtZQUNELHNFQUFzRTtZQUN0RSxzQkFBc0I7WUFDdEIsT0FBTyxJQUFBLDZCQUFnQixFQUFDLElBQUksQ0FBQyxLQUFNLEVBQUUsS0FBSyxDQUFDLEtBQU0sQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFDSCxvQkFBQztJQUFELENBQUMsQUE3QkQsSUE2QkM7SUE3Qlksc0NBQWE7SUErQjFCLFNBQWdCLFlBQVksQ0FBQyxJQUFtQixFQUFFLFFBQXFCO1FBQXJCLHlCQUFBLEVBQUEsYUFBcUI7UUFDckUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZixNQUFNLElBQUksS0FBSyxDQUFDLHNEQUFvRCxJQUFJLENBQUMsVUFBWSxDQUFDLENBQUM7U0FDeEY7UUFDRCxPQUFPLElBQUksOEJBQWlCLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFMRCxvQ0FLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2FyZUFsbEVxdWl2YWxlbnQsIFN0YXRlbWVudH0gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtUeXBlU2NyaXB0RW1pdHRlcn0gZnJvbSAnLi4vb3V0cHV0L3RzX2VtaXR0ZXInO1xuXG5leHBvcnQgY2xhc3MgR2VuZXJhdGVkRmlsZSB7XG4gIHB1YmxpYyBzb3VyY2U6IHN0cmluZ3xudWxsO1xuICBwdWJsaWMgc3RtdHM6IFN0YXRlbWVudFtdfG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3JjRmlsZVVybDogc3RyaW5nLCBwdWJsaWMgZ2VuRmlsZVVybDogc3RyaW5nLCBzb3VyY2VPclN0bXRzOiBzdHJpbmd8U3RhdGVtZW50W10pIHtcbiAgICBpZiAodHlwZW9mIHNvdXJjZU9yU3RtdHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZU9yU3RtdHM7XG4gICAgICB0aGlzLnN0bXRzID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgICAgdGhpcy5zdG10cyA9IHNvdXJjZU9yU3RtdHM7XG4gICAgfVxuICB9XG5cbiAgaXNFcXVpdmFsZW50KG90aGVyOiBHZW5lcmF0ZWRGaWxlKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuZ2VuRmlsZVVybCAhPT0gb3RoZXIuZ2VuRmlsZVVybCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLnNvdXJjZSA9PT0gb3RoZXIuc291cmNlO1xuICAgIH1cbiAgICBpZiAob3RoZXIuc3RtdHMgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBOb3RlOiB0aGUgY29uc3RydWN0b3IgZ3VhcmFudGVlcyB0aGF0IGlmIHRoaXMuc291cmNlIGlzIG5vdCBmaWxsZWQsXG4gICAgLy8gdGhlbiB0aGlzLnN0bXRzIGlzLlxuICAgIHJldHVybiBhcmVBbGxFcXVpdmFsZW50KHRoaXMuc3RtdHMhLCBvdGhlci5zdG10cyEpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1R5cGVTY3JpcHQoZmlsZTogR2VuZXJhdGVkRmlsZSwgcHJlYW1ibGU6IHN0cmluZyA9ICcnKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlLnN0bXRzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIHN0YXRlOiBObyBzdG10cyBwcmVzZW50IG9uIEdlbmVyYXRlZEZpbGUgJHtmaWxlLmdlbkZpbGVVcmx9YCk7XG4gIH1cbiAgcmV0dXJuIG5ldyBUeXBlU2NyaXB0RW1pdHRlcigpLmVtaXRTdGF0ZW1lbnRzKGZpbGUuZ2VuRmlsZVVybCwgZmlsZS5zdG10cywgcHJlYW1ibGUpO1xufVxuIl19