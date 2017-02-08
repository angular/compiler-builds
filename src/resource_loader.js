/**
 * An interface for retrieving documents by URL that the compiler uses
 * to load templates.
 */
var ResourceLoader = (function () {
    function ResourceLoader() {
    }
    /**
     * @param {?} url
     * @return {?}
     */
    ResourceLoader.prototype.get = function (url) { return null; };
    return ResourceLoader;
}());
export { ResourceLoader };
//# sourceMappingURL=resource_loader.js.map