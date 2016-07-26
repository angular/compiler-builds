/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var core_private_1 = require('../core_private');
var lang_1 = require('../src/facade/lang');
var exceptions_1 = require('../src/facade/exceptions');
function _isComponentMetadata(obj) {
    return obj instanceof core_1.ComponentMetadata;
}
var ViewResolver = (function () {
    function ViewResolver(_reflector) {
        if (_reflector === void 0) { _reflector = core_private_1.reflector; }
        this._reflector = _reflector;
    }
    ViewResolver.prototype.resolve = function (component, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        var compMeta = this._reflector.annotations(component).find(_isComponentMetadata);
        if (lang_1.isPresent(compMeta)) {
            if (lang_1.isBlank(compMeta.template) && lang_1.isBlank(compMeta.templateUrl)) {
                throw new exceptions_1.BaseException("Component '" + lang_1.stringify(component) + "' must have either 'template' or 'templateUrl' set.");
            }
            else {
                return new core_1.ViewMetadata({
                    templateUrl: compMeta.templateUrl,
                    template: compMeta.template,
                    directives: compMeta.directives,
                    pipes: compMeta.pipes,
                    encapsulation: compMeta.encapsulation,
                    styles: compMeta.styles,
                    styleUrls: compMeta.styleUrls,
                    animations: compMeta.animations,
                    interpolation: compMeta.interpolation
                });
            }
        }
        else {
            if (throwIfNotFound) {
                throw new exceptions_1.BaseException("Could not compile '" + lang_1.stringify(component) + "' because it is not a component.");
            }
            return null;
        }
    };
    /** @nocollapse */
    ViewResolver.decorators = [
        { type: core_1.Injectable },
    ];
    /** @nocollapse */
    ViewResolver.ctorParameters = [
        { type: core_private_1.ReflectorReader, },
    ];
    return ViewResolver;
}());
exports.ViewResolver = ViewResolver;
//# sourceMappingURL=view_resolver.js.map