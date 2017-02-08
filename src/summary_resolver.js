var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { CompilerInjectable } from './injectable';
var SummaryResolver = (function () {
    function SummaryResolver() {
    }
    /**
     * @param {?} fileName
     * @return {?}
     */
    SummaryResolver.prototype.isLibraryFile = function (fileName) { return false; };
    ;
    /**
     * @param {?} fileName
     * @return {?}
     */
    SummaryResolver.prototype.getLibraryFileName = function (fileName) { return null; };
    /**
     * @param {?} reference
     * @return {?}
     */
    SummaryResolver.prototype.resolveSummary = function (reference) { return null; };
    ;
    /**
     * @param {?} filePath
     * @return {?}
     */
    SummaryResolver.prototype.getSymbolsOf = function (filePath) { return []; };
    /**
     * @param {?} reference
     * @return {?}
     */
    SummaryResolver.prototype.getImportAs = function (reference) { return reference; };
    return SummaryResolver;
}());
SummaryResolver = __decorate([
    CompilerInjectable()
], SummaryResolver);
export { SummaryResolver };
//# sourceMappingURL=summary_resolver.js.map