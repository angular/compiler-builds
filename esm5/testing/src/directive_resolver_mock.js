/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
import * as tslib_1 from "tslib";
import { DirectiveResolver } from '@angular/compiler';
/**
 * An implementation of {\@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
var /**
 * An implementation of {\@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
MockDirectiveResolver = /** @class */ (function (_super) {
    tslib_1.__extends(MockDirectiveResolver, _super);
    function MockDirectiveResolver(reflector) {
        var _this = _super.call(this, reflector) || this;
        _this._directives = new Map();
        return _this;
    }
    /**
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    MockDirectiveResolver.prototype.resolve = /**
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        return this._directives.get(type) || _super.prototype.resolve.call(this, type, throwIfNotFound);
    };
    /**
     * Overrides the {@link core.Directive} for a directive.
     */
    /**
     * Overrides the {\@link core.Directive} for a directive.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    MockDirectiveResolver.prototype.setDirective = /**
     * Overrides the {\@link core.Directive} for a directive.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    function (type, metadata) {
        this._directives.set(type, metadata);
    };
    return MockDirectiveResolver;
}(DirectiveResolver));
/**
 * An implementation of {\@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
export { MockDirectiveResolver };
function MockDirectiveResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    MockDirectiveResolver.prototype._directives;
}
//# sourceMappingURL=directive_resolver_mock.js.map