/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { deserializeSummaries } from './summary_serializer';
import { stripGeneratedFileSuffix, summaryFileName } from './util';
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
        return !this.host.isSourceFile(stripGeneratedFileSuffix(filePath));
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
    AotSummaryResolver.prototype.addSummary = function (summary) { this.summaryCache.set(summary.symbol, summary); };
    AotSummaryResolver.prototype._loadSummaryFile = function (filePath) {
        var _this = this;
        var hasSummary = this.loadedFilePaths.get(filePath);
        if (hasSummary != null) {
            return hasSummary;
        }
        var json = null;
        if (this.isLibraryFile(filePath)) {
            var summaryFilePath = summaryFileName(filePath);
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
            var _a = deserializeSummaries(this.staticSymbolCache, this, filePath, json), moduleName = _a.moduleName, summaries = _a.summaries, importAs = _a.importAs;
            summaries.forEach(function (summary) { return _this.summaryCache.set(summary.symbol, summary); });
            if (moduleName) {
                this.knownFileNameToModuleNames.set(filePath, moduleName);
                if (filePath.endsWith('.d.ts')) {
                    // Also add entries to map the ngfactory & ngsummary files to their module names.
                    // This is necessary to resolve ngfactory & ngsummary files to their AMD module
                    // names when building angular with Bazel from source downstream.
                    // See https://github.com/bazelbuild/rules_typescript/pull/223 for context.
                    this.knownFileNameToModuleNames.set(filePath.replace(/\.d\.ts$/, '.ngfactory.d.ts'), moduleName + '.ngfactory');
                    this.knownFileNameToModuleNames.set(filePath.replace(/\.d\.ts$/, '.ngsummary.d.ts'), moduleName + '.ngsummary');
                }
            }
            importAs.forEach(function (importAs) { _this.importAs.set(importAs.symbol, importAs.importAs); });
        }
        return hasSummary;
    };
    return AotSummaryResolver;
}());
export { AotSummaryResolver };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VtbWFyeV9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3VtbWFyeV9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFLSCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsd0JBQXdCLEVBQUUsZUFBZSxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBNkJqRTtJQVFFLDRCQUFvQixJQUE0QixFQUFVLGlCQUFvQztRQUExRSxTQUFJLEdBQUosSUFBSSxDQUF3QjtRQUFVLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFQOUYsOERBQThEO1FBQ3RELGlCQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXVDLENBQUM7UUFDOUQsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBbUIsQ0FBQztRQUNyRCw4REFBOEQ7UUFDdEQsYUFBUSxHQUFHLElBQUksR0FBRyxFQUE4QixDQUFDO1FBQ2pELCtCQUEwQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBRWtDLENBQUM7SUFFbEcsMENBQWEsR0FBYixVQUFjLFFBQWdCO1FBQzVCLG9EQUFvRDtRQUNwRCxnREFBZ0Q7UUFDaEQsMERBQTBEO1FBQzFELE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLHdCQUF3QixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVELDhDQUFpQixHQUFqQixVQUFrQixRQUFnQixFQUFFLG9CQUE0QjtRQUM5RCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRUQsZ0RBQW1CLEdBQW5CLFVBQW9CLFFBQWdCLEVBQUUsb0JBQTRCO1FB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USxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RixDQUFDO1FBQ0QsTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUNwQixDQUFDO0lBQ0gseUJBQUM7QUFBRCxDQUFDLEFBaEdELElBZ0dDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N1bW1hcnksIFN1bW1hcnlSZXNvbHZlcn0gZnJvbSAnLi4vc3VtbWFyeV9yZXNvbHZlcic7XG5cbmltcG9ydCB7U3RhdGljU3ltYm9sLCBTdGF0aWNTeW1ib2xDYWNoZX0gZnJvbSAnLi9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7ZGVzZXJpYWxpemVTdW1tYXJpZXN9IGZyb20gJy4vc3VtbWFyeV9zZXJpYWxpemVyJztcbmltcG9ydCB7c3RyaXBHZW5lcmF0ZWRGaWxlU3VmZml4LCBzdW1tYXJ5RmlsZU5hbWV9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW90U3VtbWFyeVJlc29sdmVySG9zdCB7XG4gIC8qKlxuICAgKiBMb2FkcyBhbiBOZ01vZHVsZS9EaXJlY3RpdmUvUGlwZSBzdW1tYXJ5IGZpbGVcbiAgICovXG4gIGxvYWRTdW1tYXJ5KGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmd8bnVsbDtcblxuICAvKipcbiAgICogUmV0dXJucyB3aGV0aGVyIGEgZmlsZSBpcyBhIHNvdXJjZSBmaWxlIG9yIG5vdC5cbiAgICovXG4gIGlzU291cmNlRmlsZShzb3VyY2VGaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgZmlsZSBuYW1lIGludG8gYSByZXByZXNlbnRhdGlvbiB0aGF0IHNob3VsZCBiZSBzdG9yZWQgaW4gYSBzdW1tYXJ5IGZpbGUuXG4gICAqIFRoaXMgaGFzIHRvIGluY2x1ZGUgY2hhbmdpbmcgdGhlIHN1ZmZpeCBhcyB3ZWxsLlxuICAgKiBFLmcuXG4gICAqIGBzb21lX2ZpbGUudHNgIC0+IGBzb21lX2ZpbGUuZC50c2BcbiAgICpcbiAgICogQHBhcmFtIHJlZmVycmluZ1NyY0ZpbGVOYW1lIHRoZSBzb3VyZSBmaWxlIHRoYXQgcmVmZXJzIHRvIGZpbGVOYW1lXG4gICAqL1xuICB0b1N1bW1hcnlGaWxlTmFtZShmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyBhIGZpbGVOYW1lIHRoYXQgd2FzIHByb2Nlc3NlZCBieSBgdG9TdW1tYXJ5RmlsZU5hbWVgIGJhY2sgaW50byBhIHJlYWwgZmlsZU5hbWVcbiAgICogZ2l2ZW4gdGhlIGZpbGVOYW1lIG9mIHRoZSBsaWJyYXJ5IHRoYXQgaXMgcmVmZXJyaWcgdG8gaXQuXG4gICAqL1xuICBmcm9tU3VtbWFyeUZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBb3RTdW1tYXJ5UmVzb2x2ZXIgaW1wbGVtZW50cyBTdW1tYXJ5UmVzb2x2ZXI8U3RhdGljU3ltYm9sPiB7XG4gIC8vIE5vdGU6IHRoaXMgd2lsbCBvbmx5IGNvbnRhaW4gU3RhdGljU3ltYm9scyB3aXRob3V0IG1lbWJlcnMhXG4gIHByaXZhdGUgc3VtbWFyeUNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIFN1bW1hcnk8U3RhdGljU3ltYm9sPj4oKTtcbiAgcHJpdmF0ZSBsb2FkZWRGaWxlUGF0aHMgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgLy8gTm90ZTogdGhpcyB3aWxsIG9ubHkgY29udGFpbiBTdGF0aWNTeW1ib2xzIHdpdGhvdXQgbWVtYmVycyFcbiAgcHJpdmF0ZSBpbXBvcnRBcyA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBTdGF0aWNTeW1ib2w+KCk7XG4gIHByaXZhdGUga25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaG9zdDogQW90U3VtbWFyeVJlc29sdmVySG9zdCwgcHJpdmF0ZSBzdGF0aWNTeW1ib2xDYWNoZTogU3RhdGljU3ltYm9sQ2FjaGUpIHt9XG5cbiAgaXNMaWJyYXJ5RmlsZShmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgLy8gTm90ZTogV2UgbmVlZCB0byBzdHJpcCB0aGUgLm5nZmFjdG9yeS4gZmlsZSBwYXRoLFxuICAgIC8vIHNvIHRoaXMgbWV0aG9kIGFsc28gd29ya3MgZm9yIGdlbmVyYXRlZCBmaWxlc1xuICAgIC8vIChmb3Igd2hpY2ggaG9zdC5pc1NvdXJjZUZpbGUgd2lsbCBhbHdheXMgcmV0dXJuIGZhbHNlKS5cbiAgICByZXR1cm4gIXRoaXMuaG9zdC5pc1NvdXJjZUZpbGUoc3RyaXBHZW5lcmF0ZWRGaWxlU3VmZml4KGZpbGVQYXRoKSk7XG4gIH1cblxuICB0b1N1bW1hcnlGaWxlTmFtZShmaWxlUGF0aDogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuaG9zdC50b1N1bW1hcnlGaWxlTmFtZShmaWxlUGF0aCwgcmVmZXJyaW5nU3JjRmlsZU5hbWUpO1xuICB9XG5cbiAgZnJvbVN1bW1hcnlGaWxlTmFtZShmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdMaWJGaWxlTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuaG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lKGZpbGVOYW1lLCByZWZlcnJpbmdMaWJGaWxlTmFtZSk7XG4gIH1cblxuICByZXNvbHZlU3VtbWFyeShzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IFN1bW1hcnk8U3RhdGljU3ltYm9sPnxudWxsIHtcbiAgICBjb25zdCByb290U3ltYm9sID0gc3RhdGljU3ltYm9sLm1lbWJlcnMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5zdGF0aWNTeW1ib2xDYWNoZS5nZXQoc3RhdGljU3ltYm9sLmZpbGVQYXRoLCBzdGF0aWNTeW1ib2wubmFtZSkgOlxuICAgICAgICBzdGF0aWNTeW1ib2w7XG4gICAgbGV0IHN1bW1hcnkgPSB0aGlzLnN1bW1hcnlDYWNoZS5nZXQocm9vdFN5bWJvbCk7XG4gICAgaWYgKCFzdW1tYXJ5KSB7XG4gICAgICB0aGlzLl9sb2FkU3VtbWFyeUZpbGUoc3RhdGljU3ltYm9sLmZpbGVQYXRoKTtcbiAgICAgIHN1bW1hcnkgPSB0aGlzLnN1bW1hcnlDYWNoZS5nZXQoc3RhdGljU3ltYm9sKSAhO1xuICAgIH1cbiAgICByZXR1cm4gKHJvb3RTeW1ib2wgPT09IHN0YXRpY1N5bWJvbCAmJiBzdW1tYXJ5KSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0U3ltYm9sc09mKGZpbGVQYXRoOiBzdHJpbmcpOiBTdGF0aWNTeW1ib2xbXXxudWxsIHtcbiAgICBpZiAodGhpcy5fbG9hZFN1bW1hcnlGaWxlKGZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5zdW1tYXJ5Q2FjaGUua2V5cygpKS5maWx0ZXIoKHN5bWJvbCkgPT4gc3ltYm9sLmZpbGVQYXRoID09PSBmaWxlUGF0aCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0SW1wb3J0QXMoc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBTdGF0aWNTeW1ib2wge1xuICAgIHN0YXRpY1N5bWJvbC5hc3NlcnROb01lbWJlcnMoKTtcbiAgICByZXR1cm4gdGhpcy5pbXBvcnRBcy5nZXQoc3RhdGljU3ltYm9sKSAhO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgZmlsZSBwYXRoIHRvIGEgbW9kdWxlIG5hbWUgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBgaW1wb3J0YC5cbiAgICovXG4gIGdldEtub3duTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMua25vd25GaWxlTmFtZVRvTW9kdWxlTmFtZXMuZ2V0KGltcG9ydGVkRmlsZVBhdGgpIHx8IG51bGw7XG4gIH1cblxuICBhZGRTdW1tYXJ5KHN1bW1hcnk6IFN1bW1hcnk8U3RhdGljU3ltYm9sPikgeyB0aGlzLnN1bW1hcnlDYWNoZS5zZXQoc3VtbWFyeS5zeW1ib2wsIHN1bW1hcnkpOyB9XG5cbiAgcHJpdmF0ZSBfbG9hZFN1bW1hcnlGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBsZXQgaGFzU3VtbWFyeSA9IHRoaXMubG9hZGVkRmlsZVBhdGhzLmdldChmaWxlUGF0aCk7XG4gICAgaWYgKGhhc1N1bW1hcnkgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGhhc1N1bW1hcnk7XG4gICAgfVxuICAgIGxldCBqc29uOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuaXNMaWJyYXJ5RmlsZShmaWxlUGF0aCkpIHtcbiAgICAgIGNvbnN0IHN1bW1hcnlGaWxlUGF0aCA9IHN1bW1hcnlGaWxlTmFtZShmaWxlUGF0aCk7XG4gICAgICB0cnkge1xuICAgICAgICBqc29uID0gdGhpcy5ob3N0LmxvYWRTdW1tYXJ5KHN1bW1hcnlGaWxlUGF0aCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGxvYWRpbmcgc3VtbWFyeSBmaWxlICR7c3VtbWFyeUZpbGVQYXRofWApO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cbiAgICBoYXNTdW1tYXJ5ID0ganNvbiAhPSBudWxsO1xuICAgIHRoaXMubG9hZGVkRmlsZVBhdGhzLnNldChmaWxlUGF0aCwgaGFzU3VtbWFyeSk7XG4gICAgaWYgKGpzb24pIHtcbiAgICAgIGNvbnN0IHttb2R1bGVOYW1lLCBzdW1tYXJpZXMsIGltcG9ydEFzfSA9XG4gICAgICAgICAgZGVzZXJpYWxpemVTdW1tYXJpZXModGhpcy5zdGF0aWNTeW1ib2xDYWNoZSwgdGhpcywgZmlsZVBhdGgsIGpzb24pO1xuICAgICAgc3VtbWFyaWVzLmZvckVhY2goKHN1bW1hcnkpID0+IHRoaXMuc3VtbWFyeUNhY2hlLnNldChzdW1tYXJ5LnN5bWJvbCwgc3VtbWFyeSkpO1xuICAgICAgaWYgKG1vZHVsZU5hbWUpIHtcbiAgICAgICAgdGhpcy5rbm93bkZpbGVOYW1lVG9Nb2R1bGVOYW1lcy5zZXQoZmlsZVBhdGgsIG1vZHVsZU5hbWUpO1xuICAgICAgICBpZiAoZmlsZVBhdGguZW5kc1dpdGgoJy5kLnRzJykpIHtcbiAgICAgICAgICAvLyBBbHNvIGFkZCBlbnRyaWVzIHRvIG1hcCB0aGUgbmdmYWN0b3J5ICYgbmdzdW1tYXJ5IGZpbGVzIHRvIHRoZWlyIG1vZHVsZSBuYW1lcy5cbiAgICAgICAgICAvLyBUaGlzIGlzIG5lY2Vzc2FyeSB0byByZXNvbHZlIG5nZmFjdG9yeSAmIG5nc3VtbWFyeSBmaWxlcyB0byB0aGVpciBBTUQgbW9kdWxlXG4gICAgICAgICAgLy8gbmFtZXMgd2hlbiBidWlsZGluZyBhbmd1bGFyIHdpdGggQmF6ZWwgZnJvbSBzb3VyY2UgZG93bnN0cmVhbS5cbiAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2JhemVsYnVpbGQvcnVsZXNfdHlwZXNjcmlwdC9wdWxsLzIyMyBmb3IgY29udGV4dC5cbiAgICAgICAgICB0aGlzLmtub3duRmlsZU5hbWVUb01vZHVsZU5hbWVzLnNldChcbiAgICAgICAgICAgICAgZmlsZVBhdGgucmVwbGFjZSgvXFwuZFxcLnRzJC8sICcubmdmYWN0b3J5LmQudHMnKSwgbW9kdWxlTmFtZSArICcubmdmYWN0b3J5Jyk7XG4gICAgICAgICAgdGhpcy5rbm93bkZpbGVOYW1lVG9Nb2R1bGVOYW1lcy5zZXQoXG4gICAgICAgICAgICAgIGZpbGVQYXRoLnJlcGxhY2UoL1xcLmRcXC50cyQvLCAnLm5nc3VtbWFyeS5kLnRzJyksIG1vZHVsZU5hbWUgKyAnLm5nc3VtbWFyeScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpbXBvcnRBcy5mb3JFYWNoKChpbXBvcnRBcykgPT4geyB0aGlzLmltcG9ydEFzLnNldChpbXBvcnRBcy5zeW1ib2wsIGltcG9ydEFzLmltcG9ydEFzKTsgfSk7XG4gICAgfVxuICAgIHJldHVybiBoYXNTdW1tYXJ5O1xuICB9XG59XG4iXX0=