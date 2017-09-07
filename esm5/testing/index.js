/**
 * @license Angular v5.0.0-beta.6-5ef6e63
 * (c) 2010-2017 Google, Inc. https://angular.io/
 * License: MIT
 */
import { __extends } from 'tslib';
import { DirectiveResolver, NgModuleResolver, PipeResolver, ResourceLoader, core } from '@angular/compiler';

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
/**
 * A mock implementation of {\@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
var MockResourceLoader = (function (_super) {
    __extends(MockResourceLoader, _super);
    function MockResourceLoader() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._expectations = [];
        _this._definitions = new Map();
        _this._requests = [];
        return _this;
    }
    /**
     * @param {?} url
     * @return {?}
     */
    MockResourceLoader.prototype.get = function (url) {
        var /** @type {?} */ request = new _PendingRequest(url);
        this._requests.push(request);
        return request.getPromise();
    };
    /**
     * @return {?}
     */
    MockResourceLoader.prototype.hasPendingRequests = function () { return !!this._requests.length; };
    /**
     * Add an expectation for the given URL. Incoming requests will be checked against
     * the next expectation (in FIFO order). The `verifyNoOutstandingExpectations` method
     * can be used to check if any expectations have not yet been met.
     *
     * The response given will be returned if the expectation matches.
     * @param {?} url
     * @param {?} response
     * @return {?}
     */
    MockResourceLoader.prototype.expect = function (url, response) {
        var /** @type {?} */ expectation = new _Expectation(url, response);
        this._expectations.push(expectation);
    };
    /**
     * Add a definition for the given URL to return the given response. Unlike expectations,
     * definitions have no order and will satisfy any matching request at any time. Also
     * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
     * to return an error.
     * @param {?} url
     * @param {?} response
     * @return {?}
     */
    MockResourceLoader.prototype.when = function (url, response) { this._definitions.set(url, response); };
    /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     * @return {?}
     */
    MockResourceLoader.prototype.flush = function () {
        if (this._requests.length === 0) {
            throw new Error('No pending requests to flush');
        }
        do {
            this._processRequest(/** @type {?} */ ((this._requests.shift())));
        } while (this._requests.length > 0);
        this.verifyNoOutstandingExpectations();
    };
    /**
     * Throw an exception if any expectations have not been satisfied.
     * @return {?}
     */
    MockResourceLoader.prototype.verifyNoOutstandingExpectations = function () {
        if (this._expectations.length === 0)
            return;
        var /** @type {?} */ urls = [];
        for (var /** @type {?} */ i = 0; i < this._expectations.length; i++) {
            var /** @type {?} */ expectation = this._expectations[i];
            urls.push(expectation.url);
        }
        throw new Error("Unsatisfied requests: " + urls.join(', '));
    };
    /**
     * @param {?} request
     * @return {?}
     */
    MockResourceLoader.prototype._processRequest = function (request) {
        var /** @type {?} */ url = request.url;
        if (this._expectations.length > 0) {
            var /** @type {?} */ expectation = this._expectations[0];
            if (expectation.url == url) {
                remove(this._expectations, expectation);
                request.complete(expectation.response);
                return;
            }
        }
        if (this._definitions.has(url)) {
            var /** @type {?} */ response = this._definitions.get(url);
            request.complete(response == null ? null : response);
            return;
        }
        throw new Error("Unexpected request " + url);
    };
    return MockResourceLoader;
}(ResourceLoader));
var _PendingRequest = (function () {
    /**
     * @param {?} url
     */
    function _PendingRequest(url) {
        var _this = this;
        this.url = url;
        this.promise = new Promise(function (res, rej) {
            _this.resolve = res;
            _this.reject = rej;
        });
    }
    /**
     * @param {?} response
     * @return {?}
     */
    _PendingRequest.prototype.complete = function (response) {
        if (response == null) {
            this.reject("Failed to load " + this.url);
        }
        else {
            this.resolve(response);
        }
    };
    /**
     * @return {?}
     */
    _PendingRequest.prototype.getPromise = function () { return this.promise; };
    return _PendingRequest;
}());
var _Expectation = (function () {
    /**
     * @param {?} url
     * @param {?} response
     */
    function _Expectation(url, response) {
        this.url = url;
        this.response = response;
    }
    return _Expectation;
}());
/**
 * @template T
 * @param {?} list
 * @param {?} el
 * @return {?}
 */
function remove(list, el) {
    var /** @type {?} */ index = list.indexOf(el);
    if (index > -1) {
        list.splice(index, 1);
    }
}

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
var MockSchemaRegistry = (function () {
    /**
     * @param {?} existingProperties
     * @param {?} attrPropMapping
     * @param {?} existingElements
     * @param {?} invalidProperties
     * @param {?} invalidAttributes
     */
    function MockSchemaRegistry(existingProperties, attrPropMapping, existingElements, invalidProperties, invalidAttributes) {
        this.existingProperties = existingProperties;
        this.attrPropMapping = attrPropMapping;
        this.existingElements = existingElements;
        this.invalidProperties = invalidProperties;
        this.invalidAttributes = invalidAttributes;
    }
    /**
     * @param {?} tagName
     * @param {?} property
     * @param {?} schemas
     * @return {?}
     */
    MockSchemaRegistry.prototype.hasProperty = function (tagName, property, schemas) {
        var /** @type {?} */ value = this.existingProperties[property];
        return value === void 0 ? true : value;
    };
    /**
     * @param {?} tagName
     * @param {?} schemaMetas
     * @return {?}
     */
    MockSchemaRegistry.prototype.hasElement = function (tagName, schemaMetas) {
        var /** @type {?} */ value = this.existingElements[tagName.toLowerCase()];
        return value === void 0 ? true : value;
    };
    /**
     * @return {?}
     */
    MockSchemaRegistry.prototype.allKnownElementNames = function () { return Object.keys(this.existingElements); };
    /**
     * @param {?} selector
     * @param {?} property
     * @param {?} isAttribute
     * @return {?}
     */
    MockSchemaRegistry.prototype.securityContext = function (selector, property, isAttribute) {
        return core.SecurityContext.NONE;
    };
    /**
     * @param {?} attrName
     * @return {?}
     */
    MockSchemaRegistry.prototype.getMappedPropName = function (attrName) { return this.attrPropMapping[attrName] || attrName; };
    /**
     * @return {?}
     */
    MockSchemaRegistry.prototype.getDefaultComponentElementName = function () { return 'ng-component'; };
    /**
     * @param {?} name
     * @return {?}
     */
    MockSchemaRegistry.prototype.validateProperty = function (name) {
        if (this.invalidProperties.indexOf(name) > -1) {
            return { error: true, msg: "Binding to property '" + name + "' is disallowed for security reasons" };
        }
        else {
            return { error: false };
        }
    };
    /**
     * @param {?} name
     * @return {?}
     */
    MockSchemaRegistry.prototype.validateAttribute = function (name) {
        if (this.invalidAttributes.indexOf(name) > -1) {
            return {
                error: true,
                msg: "Binding to attribute '" + name + "' is disallowed for security reasons"
            };
        }
        else {
            return { error: false };
        }
    };
    /**
     * @param {?} propName
     * @return {?}
     */
    MockSchemaRegistry.prototype.normalizeAnimationStyleProperty = function (propName) { return propName; };
    /**
     * @param {?} camelCaseProp
     * @param {?} userProvidedProp
     * @param {?} val
     * @return {?}
     */
    MockSchemaRegistry.prototype.normalizeAnimationStyleValue = function (camelCaseProp, userProvidedProp, val) {
        return { error: /** @type {?} */ ((null)), value: val.toString() };
    };
    return MockSchemaRegistry;
}());

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
/**
 * An implementation of {\@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
var MockDirectiveResolver = (function (_super) {
    __extends(MockDirectiveResolver, _super);
    /**
     * @param {?} reflector
     */
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
    MockDirectiveResolver.prototype.resolve = function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        return this._directives.get(type) || _super.prototype.resolve.call(this, type, throwIfNotFound);
    };
    /**
     * Overrides the {\@link core.Directive} for a directive.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    MockDirectiveResolver.prototype.setDirective = function (type, metadata) {
        this._directives.set(type, metadata);
    };
    return MockDirectiveResolver;
}(DirectiveResolver));

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
var MockNgModuleResolver = (function (_super) {
    __extends(MockNgModuleResolver, _super);
    /**
     * @param {?} reflector
     */
    function MockNgModuleResolver(reflector) {
        var _this = _super.call(this, reflector) || this;
        _this._ngModules = new Map();
        return _this;
    }
    /**
     * Overrides the {\@link NgModule} for a module.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    MockNgModuleResolver.prototype.setNgModule = function (type, metadata) {
        this._ngModules.set(type, metadata);
    };
    /**
     * Returns the {\@link NgModule} for a module:
     * - Set the {\@link NgModule} to the overridden view when it exists or fallback to the
     * default
     * `NgModuleResolver`, see `setNgModule`.
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    MockNgModuleResolver.prototype.resolve = function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        return this._ngModules.get(type) || ((_super.prototype.resolve.call(this, type, throwIfNotFound)));
    };
    return MockNgModuleResolver;
}(NgModuleResolver));

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
var MockPipeResolver = (function (_super) {
    __extends(MockPipeResolver, _super);
    /**
     * @param {?} refector
     */
    function MockPipeResolver(refector) {
        var _this = _super.call(this, refector) || this;
        _this._pipes = new Map();
        return _this;
    }
    /**
     * Overrides the {\@link Pipe} for a pipe.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    MockPipeResolver.prototype.setPipe = function (type, metadata) { this._pipes.set(type, metadata); };
    /**
     * Returns the {\@link Pipe} for a pipe:
     * - Set the {\@link Pipe} to the overridden view when it exists or fallback to the
     * default
     * `PipeResolver`, see `setPipe`.
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    MockPipeResolver.prototype.resolve = function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        var /** @type {?} */ metadata = this._pipes.get(type);
        if (!metadata) {
            metadata = ((_super.prototype.resolve.call(this, type, throwIfNotFound)));
        }
        return metadata;
    };
    return MockPipeResolver;
}(PipeResolver));

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
/**
 * @module
 * @description
 * Entry point for all APIs of the compiler package.
 *
 * <div class="callout is-critical">
 *   <header>Unstable APIs</header>
 *   <p>
 *     All compiler apis are currently considered experimental and private!
 *   </p>
 *   <p>
 *     We expect the APIs in this package to keep on changing. Do not rely on them.
 *   </p>
 * </div>
 */

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
/**
 * @module
 * @description
 * Entry point for all public APIs of this package.
 */

// This file only reexports content of the `src` folder. Keep it that way.

/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * Generated bundle index. Do not edit.
 */

export { MockResourceLoader, MockSchemaRegistry, MockDirectiveResolver, MockNgModuleResolver, MockPipeResolver };
//# sourceMappingURL=index.js.map
