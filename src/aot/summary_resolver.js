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
        define("@angular/compiler/src/aot/summary_resolver", ["require", "exports", "@angular/compiler/src/aot/summary_serializer", "@angular/compiler/src/aot/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AotSummaryResolver = void 0;
    var summary_serializer_1 = require("@angular/compiler/src/aot/summary_serializer");
    var util_1 = require("@angular/compiler/src/aot/util");
    var AotSummaryResolver = /** @class */ (function () {
        function AotSummaryResolver(host, staticSymbolCache) {
            this.host = host;
            this.staticSymbolCache = staticSymbolCache;
            // Note: this will only contain StaticSymbols without members!
            this.summaryCache = new Map();
            this.loadedFilePaths = new Map();
            // Note: this will only contain StaticSymbols without members!
            this.importAs = new Map();
            this.knownFileNameToModuleNames = new Map();
        }
        AotSummaryResolver.prototype.isLibraryFile = function (filePath) {
            // Note: We need to strip the .ngfactory. file path,
            // so this method also works for generated files
            // (for which host.isSourceFile will always return false).
            return !this.host.isSourceFile(util_1.stripGeneratedFileSuffix(filePath));
        };
        AotSummaryResolver.prototype.toSummaryFileName = function (filePath, referringSrcFileName) {
            return this.host.toSummaryFileName(filePath, referringSrcFileName);
        };
        AotSummaryResolver.prototype.fromSummaryFileName = function (fileName, referringLibFileName) {
            return this.host.fromSummaryFileName(fileName, referringLibFileName);
        };
        AotSummaryResolver.prototype.resolveSummary = function (staticSymbol) {
            var rootSymbol = staticSymbol.members.length ?
                this.staticSymbolCache.get(staticSymbol.filePath, staticSymbol.name) :
                staticSymbol;
            var summary = this.summaryCache.get(rootSymbol);
            if (!summary) {
                this._loadSummaryFile(staticSymbol.filePath);
                summary = this.summaryCache.get(staticSymbol);
            }
            return (rootSymbol === staticSymbol && summary) || null;
        };
        AotSummaryResolver.prototype.getSymbolsOf = function (filePath) {
            if (this._loadSummaryFile(filePath)) {
                return Array.from(this.summaryCache.keys()).filter(function (symbol) { return symbol.filePath === filePath; });
            }
            return null;
        };
        AotSummaryResolver.prototype.getImportAs = function (staticSymbol) {
            staticSymbol.assertNoMembers();
            return this.importAs.get(staticSymbol);
        };
        /**
         * Converts a file path to a module name that can be used as an `import`.
         */
        AotSummaryResolver.prototype.getKnownModuleName = function (importedFilePath) {
            return this.knownFileNameToModuleNames.get(importedFilePath) || null;
        };
        AotSummaryResolver.prototype.addSummary = function (summary) {
            this.summaryCache.set(summary.symbol, summary);
        };
        AotSummaryResolver.prototype._loadSummaryFile = function (filePath) {
            var _this = this;
            var hasSummary = this.loadedFilePaths.get(filePath);
            if (hasSummary != null) {
                return hasSummary;
            }
            var json = null;
            if (this.isLibraryFile(filePath)) {
                var summaryFilePath = util_1.summaryFileName(filePath);
                try {
                    json = this.host.loadSummary(summaryFilePath);
                }
                catch (e) {
                    console.error("Error loading summary file " + summaryFilePath);
                    throw e;
                }
            }
            hasSummary = json != null;
            this.loadedFilePaths.set(filePath, hasSummary);
            if (json) {
                var _a = summary_serializer_1.deserializeSummaries(this.staticSymbolCache, this, filePath, json), moduleName = _a.moduleName, summaries = _a.summaries, importAs = _a.importAs;
                summaries.forEach(function (summary) { return _this.summaryCache.set(summary.symbol, summary); });
                if (moduleName) {
                    this.knownFileNameToModuleNames.set(filePath, moduleName);
                }
                importAs.forEach(function (importAs) {
                    _this.importAs.set(importAs.symbol, importAs.importAs);
                });
            }
            return hasSummary;
        };
        return AotSummaryResolver;
    }());
    exports.AotSummaryResolver = AotSummaryResolver;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VtbWFyeV9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3VtbWFyeV9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFLSCxtRkFBMEQ7SUFDMUQsdURBQWlFO0lBNkJqRTtRQVFFLDRCQUFvQixJQUE0QixFQUFVLGlCQUFvQztZQUExRSxTQUFJLEdBQUosSUFBSSxDQUF3QjtZQUFVLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7WUFQOUYsOERBQThEO1lBQ3RELGlCQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXVDLENBQUM7WUFDOUQsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBbUIsQ0FBQztZQUNyRCw4REFBOEQ7WUFDdEQsYUFBUSxHQUFHLElBQUksR0FBRyxFQUE4QixDQUFDO1lBQ2pELCtCQUEwQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBRWtDLENBQUM7UUFFbEcsMENBQWEsR0FBYixVQUFjLFFBQWdCO1lBQzVCLG9EQUFvRDtZQUNwRCxnREFBZ0Q7WUFDaEQsMERBQTBEO1lBQzFELE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQywrQkFBd0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCw4Q0FBaUIsR0FBakIsVUFBa0IsUUFBZ0IsRUFBRSxvQkFBNEI7WUFDOUQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxnREFBbUIsR0FBbkIsVUFBb0IsUUFBZ0IsRUFBRSxvQkFBNEI7WUFDaEUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7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UUFBUSxjQUNnQyxDQUFDO2dCQUN2RSxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUMsT0FBTyxJQUFLLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsRUFBOUMsQ0FBOEMsQ0FBQyxDQUFDO2dCQUMvRSxJQUFJLFVBQVUsRUFBRTtvQkFDZCxJQUFJLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztpQkFDM0Q7Z0JBQ0QsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFDLFFBQVE7b0JBQ3hCLEtBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBQ0QsT0FBTyxVQUFVLENBQUM7UUFDcEIsQ0FBQztRQUNILHlCQUFDO0lBQUQsQ0FBQyxBQTFGRCxJQTBGQztJQTFGWSxnREFBa0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3VtbWFyeSwgU3VtbWFyeVJlc29sdmVyfSBmcm9tICcuLi9zdW1tYXJ5X3Jlc29sdmVyJztcblxuaW1wb3J0IHtTdGF0aWNTeW1ib2wsIFN0YXRpY1N5bWJvbENhY2hlfSBmcm9tICcuL3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtkZXNlcmlhbGl6ZVN1bW1hcmllc30gZnJvbSAnLi9zdW1tYXJ5X3NlcmlhbGl6ZXInO1xuaW1wb3J0IHtzdHJpcEdlbmVyYXRlZEZpbGVTdWZmaXgsIHN1bW1hcnlGaWxlTmFtZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBBb3RTdW1tYXJ5UmVzb2x2ZXJIb3N0IHtcbiAgLyoqXG4gICAqIExvYWRzIGFuIE5nTW9kdWxlL0RpcmVjdGl2ZS9QaXBlIHN1bW1hcnkgZmlsZVxuICAgKi9cbiAgbG9hZFN1bW1hcnkoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHdoZXRoZXIgYSBmaWxlIGlzIGEgc291cmNlIGZpbGUgb3Igbm90LlxuICAgKi9cbiAgaXNTb3VyY2VGaWxlKHNvdXJjZUZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuO1xuICAvKipcbiAgICogQ29udmVydHMgYSBmaWxlIG5hbWUgaW50byBhIHJlcHJlc2VudGF0aW9uIHRoYXQgc2hvdWxkIGJlIHN0b3JlZCBpbiBhIHN1bW1hcnkgZmlsZS5cbiAgICogVGhpcyBoYXMgdG8gaW5jbHVkZSBjaGFuZ2luZyB0aGUgc3VmZml4IGFzIHdlbGwuXG4gICAqIEUuZy5cbiAgICogYHNvbWVfZmlsZS50c2AgLT4gYHNvbWVfZmlsZS5kLnRzYFxuICAgKlxuICAgKiBAcGFyYW0gcmVmZXJyaW5nU3JjRmlsZU5hbWUgdGhlIHNvdXJlIGZpbGUgdGhhdCByZWZlcnMgdG8gZmlsZU5hbWVcbiAgICovXG4gIHRvU3VtbWFyeUZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgZmlsZU5hbWUgdGhhdCB3YXMgcHJvY2Vzc2VkIGJ5IGB0b1N1bW1hcnlGaWxlTmFtZWAgYmFjayBpbnRvIGEgcmVhbCBmaWxlTmFtZVxuICAgKiBnaXZlbiB0aGUgZmlsZU5hbWUgb2YgdGhlIGxpYnJhcnkgdGhhdCBpcyByZWZlcnJpZyB0byBpdC5cbiAgICovXG4gIGZyb21TdW1tYXJ5RmlsZU5hbWUoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEFvdFN1bW1hcnlSZXNvbHZlciBpbXBsZW1lbnRzIFN1bW1hcnlSZXNvbHZlcjxTdGF0aWNTeW1ib2w+IHtcbiAgLy8gTm90ZTogdGhpcyB3aWxsIG9ubHkgY29udGFpbiBTdGF0aWNTeW1ib2xzIHdpdGhvdXQgbWVtYmVycyFcbiAgcHJpdmF0ZSBzdW1tYXJ5Q2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgU3VtbWFyeTxTdGF0aWNTeW1ib2w+PigpO1xuICBwcml2YXRlIGxvYWRlZEZpbGVQYXRocyA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAvLyBOb3RlOiB0aGlzIHdpbGwgb25seSBjb250YWluIFN0YXRpY1N5bWJvbHMgd2l0aG91dCBtZW1iZXJzIVxuICBwcml2YXRlIGltcG9ydEFzID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIFN0YXRpY1N5bWJvbD4oKTtcbiAgcHJpdmF0ZSBrbm93bkZpbGVOYW1lVG9Nb2R1bGVOYW1lcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBob3N0OiBBb3RTdW1tYXJ5UmVzb2x2ZXJIb3N0LCBwcml2YXRlIHN0YXRpY1N5bWJvbENhY2hlOiBTdGF0aWNTeW1ib2xDYWNoZSkge31cblxuICBpc0xpYnJhcnlGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIHN0cmlwIHRoZSAubmdmYWN0b3J5LiBmaWxlIHBhdGgsXG4gICAgLy8gc28gdGhpcyBtZXRob2QgYWxzbyB3b3JrcyBmb3IgZ2VuZXJhdGVkIGZpbGVzXG4gICAgLy8gKGZvciB3aGljaCBob3N0LmlzU291cmNlRmlsZSB3aWxsIGFsd2F5cyByZXR1cm4gZmFsc2UpLlxuICAgIHJldHVybiAhdGhpcy5ob3N0LmlzU291cmNlRmlsZShzdHJpcEdlbmVyYXRlZEZpbGVTdWZmaXgoZmlsZVBhdGgpKTtcbiAgfVxuXG4gIHRvU3VtbWFyeUZpbGVOYW1lKGZpbGVQYXRoOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LnRvU3VtbWFyeUZpbGVOYW1lKGZpbGVQYXRoLCByZWZlcnJpbmdTcmNGaWxlTmFtZSk7XG4gIH1cblxuICBmcm9tU3VtbWFyeUZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUoZmlsZU5hbWUsIHJlZmVycmluZ0xpYkZpbGVOYW1lKTtcbiAgfVxuXG4gIHJlc29sdmVTdW1tYXJ5KHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sKTogU3VtbWFyeTxTdGF0aWNTeW1ib2w+fG51bGwge1xuICAgIGNvbnN0IHJvb3RTeW1ib2wgPSBzdGF0aWNTeW1ib2wubWVtYmVycy5sZW5ndGggP1xuICAgICAgICB0aGlzLnN0YXRpY1N5bWJvbENhY2hlLmdldChzdGF0aWNTeW1ib2wuZmlsZVBhdGgsIHN0YXRpY1N5bWJvbC5uYW1lKSA6XG4gICAgICAgIHN0YXRpY1N5bWJvbDtcbiAgICBsZXQgc3VtbWFyeSA9IHRoaXMuc3VtbWFyeUNhY2hlLmdldChyb290U3ltYm9sKTtcbiAgICBpZiAoIXN1bW1hcnkpIHtcbiAgICAgIHRoaXMuX2xvYWRTdW1tYXJ5RmlsZShzdGF0aWNTeW1ib2wuZmlsZVBhdGgpO1xuICAgICAgc3VtbWFyeSA9IHRoaXMuc3VtbWFyeUNhY2hlLmdldChzdGF0aWNTeW1ib2wpITtcbiAgICB9XG4gICAgcmV0dXJuIChyb290U3ltYm9sID09PSBzdGF0aWNTeW1ib2wgJiYgc3VtbWFyeSkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldFN5bWJvbHNPZihmaWxlUGF0aDogc3RyaW5nKTogU3RhdGljU3ltYm9sW118bnVsbCB7XG4gICAgaWYgKHRoaXMuX2xvYWRTdW1tYXJ5RmlsZShmaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuc3VtbWFyeUNhY2hlLmtleXMoKSkuZmlsdGVyKChzeW1ib2wpID0+IHN5bWJvbC5maWxlUGF0aCA9PT0gZmlsZVBhdGgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldEltcG9ydEFzKHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sKTogU3RhdGljU3ltYm9sIHtcbiAgICBzdGF0aWNTeW1ib2wuYXNzZXJ0Tm9NZW1iZXJzKCk7XG4gICAgcmV0dXJuIHRoaXMuaW1wb3J0QXMuZ2V0KHN0YXRpY1N5bWJvbCkhO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgZmlsZSBwYXRoIHRvIGEgbW9kdWxlIG5hbWUgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBgaW1wb3J0YC5cbiAgICovXG4gIGdldEtub3duTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMua25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMuZ2V0KGltcG9ydGVkRmlsZVBhdGgpIHx8IG51bGw7XG4gIH1cblxuICBhZGRTdW1tYXJ5KHN1bW1hcnk6IFN1bW1hcnk8U3RhdGljU3ltYm9sPikge1xuICAgIHRoaXMuc3VtbWFyeUNhY2hlLnNldChzdW1tYXJ5LnN5bWJvbCwgc3VtbWFyeSk7XG4gIH1cblxuICBwcml2YXRlIF9sb2FkU3VtbWFyeUZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGxldCBoYXNTdW1tYXJ5ID0gdGhpcy5sb2FkZWRGaWxlUGF0aHMuZ2V0KGZpbGVQYXRoKTtcbiAgICBpZiAoaGFzU3VtbWFyeSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gaGFzU3VtbWFyeTtcbiAgICB9XG4gICAgbGV0IGpzb246IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5pc0xpYnJhcnlGaWxlKGZpbGVQYXRoKSkge1xuICAgICAgY29uc3Qgc3VtbWFyeUZpbGVQYXRoID0gc3VtbWFyeUZpbGVOYW1lKGZpbGVQYXRoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGpzb24gPSB0aGlzLmhvc3QubG9hZFN1bW1hcnkoc3VtbWFyeUZpbGVQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgbG9hZGluZyBzdW1tYXJ5IGZpbGUgJHtzdW1tYXJ5RmlsZVBhdGh9YCk7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfVxuICAgIGhhc1N1bW1hcnkgPSBqc29uICE9IG51bGw7XG4gICAgdGhpcy5sb2FkZWRGaWxlUGF0aHMuc2V0KGZpbGVQYXRoLCBoYXNTdW1tYXJ5KTtcbiAgICBpZiAoanNvbikge1xuICAgICAgY29uc3Qge21vZHVsZU5hbWUsIHN1bW1hcmllcywgaW1wb3J0QXN9ID1cbiAgICAgICAgICBkZXNlcmlhbGl6ZVN1bW1hcmllcyh0aGlzLnN0YXRpY1N5bWJvbENhY2hlLCB0aGlzLCBmaWxlUGF0aCwganNvbik7XG4gICAgICBzdW1tYXJpZXMuZm9yRWFjaCgoc3VtbWFyeSkgPT4gdGhpcy5zdW1tYXJ5Q2FjaGUuc2V0KHN1bW1hcnkuc3ltYm9sLCBzdW1tYXJ5KSk7XG4gICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICB0aGlzLmtub3duRmlsZU5hbWVUb01vZHVsZU5hbWVzLnNldChmaWxlUGF0aCwgbW9kdWxlTmFtZSk7XG4gICAgICB9XG4gICAgICBpbXBvcnRBcy5mb3JFYWNoKChpbXBvcnRBcykgPT4ge1xuICAgICAgICB0aGlzLmltcG9ydEFzLnNldChpbXBvcnRBcy5zeW1ib2wsIGltcG9ydEFzLmltcG9ydEFzKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gaGFzU3VtbWFyeTtcbiAgfVxufVxuIl19