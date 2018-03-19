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
import * as tslib_1 from "tslib";
import { ResourceLoader } from '@angular/compiler';
/**
 * A mock implementation of {\@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
var /**
 * A mock implementation of {\@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
MockResourceLoader = /** @class */ (function (_super) {
    tslib_1.__extends(MockResourceLoader, _super);
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
    MockResourceLoader.prototype.get = /**
     * @param {?} url
     * @return {?}
     */
    function (url) {
        var /** @type {?} */ request = new _PendingRequest(url);
        this._requests.push(request);
        return request.getPromise();
    };
    /**
     * @return {?}
     */
    MockResourceLoader.prototype.hasPendingRequests = /**
     * @return {?}
     */
    function () { return !!this._requests.length; };
    /**
     * Add an expectation for the given URL. Incoming requests will be checked against
     * the next expectation (in FIFO order). The `verifyNoOutstandingExpectations` method
     * can be used to check if any expectations have not yet been met.
     *
     * The response given will be returned if the expectation matches.
     */
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
    MockResourceLoader.prototype.expect = /**
     * Add an expectation for the given URL. Incoming requests will be checked against
     * the next expectation (in FIFO order). The `verifyNoOutstandingExpectations` method
     * can be used to check if any expectations have not yet been met.
     *
     * The response given will be returned if the expectation matches.
     * @param {?} url
     * @param {?} response
     * @return {?}
     */
    function (url, response) {
        var /** @type {?} */ expectation = new _Expectation(url, response);
        this._expectations.push(expectation);
    };
    /**
     * Add a definition for the given URL to return the given response. Unlike expectations,
     * definitions have no order and will satisfy any matching request at any time. Also
     * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
     * to return an error.
     */
    /**
     * Add a definition for the given URL to return the given response. Unlike expectations,
     * definitions have no order and will satisfy any matching request at any time. Also
     * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
     * to return an error.
     * @param {?} url
     * @param {?} response
     * @return {?}
     */
    MockResourceLoader.prototype.when = /**
     * Add a definition for the given URL to return the given response. Unlike expectations,
     * definitions have no order and will satisfy any matching request at any time. Also
     * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
     * to return an error.
     * @param {?} url
     * @param {?} response
     * @return {?}
     */
    function (url, response) { this._definitions.set(url, response); };
    /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     */
    /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     * @return {?}
     */
    MockResourceLoader.prototype.flush = /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     * @return {?}
     */
    function () {
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
     */
    /**
     * Throw an exception if any expectations have not been satisfied.
     * @return {?}
     */
    MockResourceLoader.prototype.verifyNoOutstandingExpectations = /**
     * Throw an exception if any expectations have not been satisfied.
     * @return {?}
     */
    function () {
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
    MockResourceLoader.prototype._processRequest = /**
     * @param {?} request
     * @return {?}
     */
    function (request) {
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
/**
 * A mock implementation of {\@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
export { MockResourceLoader };
function MockResourceLoader_tsickle_Closure_declarations() {
    /** @type {?} */
    MockResourceLoader.prototype._expectations;
    /** @type {?} */
    MockResourceLoader.prototype._definitions;
    /** @type {?} */
    MockResourceLoader.prototype._requests;
}
var _PendingRequest = /** @class */ (function () {
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
    _PendingRequest.prototype.complete = /**
     * @param {?} response
     * @return {?}
     */
    function (response) {
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
    _PendingRequest.prototype.getPromise = /**
     * @return {?}
     */
    function () { return this.promise; };
    return _PendingRequest;
}());
function _PendingRequest_tsickle_Closure_declarations() {
    /** @type {?} */
    _PendingRequest.prototype.resolve;
    /** @type {?} */
    _PendingRequest.prototype.reject;
    /** @type {?} */
    _PendingRequest.prototype.promise;
    /** @type {?} */
    _PendingRequest.prototype.url;
}
var _Expectation = /** @class */ (function () {
    function _Expectation(url, response) {
        this.url = url;
        this.response = response;
    }
    return _Expectation;
}());
function _Expectation_tsickle_Closure_declarations() {
    /** @type {?} */
    _Expectation.prototype.url;
    /** @type {?} */
    _Expectation.prototype.response;
}
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
//# sourceMappingURL=resource_loader_mock.js.map