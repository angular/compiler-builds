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
import { ResourceLoader } from '@angular/compiler';
/**
 * A mock implementation of {\@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
export class MockResourceLoader extends ResourceLoader {
    constructor() {
        super(...arguments);
        this._expectations = [];
        this._definitions = new Map();
        this._requests = [];
    }
    /**
     * @param {?} url
     * @return {?}
     */
    get(url) {
        const /** @type {?} */ request = new _PendingRequest(url);
        this._requests.push(request);
        return request.getPromise();
    }
    /**
     * @return {?}
     */
    hasPendingRequests() { return !!this._requests.length; }
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
    expect(url, response) {
        const /** @type {?} */ expectation = new _Expectation(url, response);
        this._expectations.push(expectation);
    }
    /**
     * Add a definition for the given URL to return the given response. Unlike expectations,
     * definitions have no order and will satisfy any matching request at any time. Also
     * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
     * to return an error.
     * @param {?} url
     * @param {?} response
     * @return {?}
     */
    when(url, response) { this._definitions.set(url, response); }
    /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     * @return {?}
     */
    flush() {
        if (this._requests.length === 0) {
            throw new Error('No pending requests to flush');
        }
        do {
            this._processRequest(/** @type {?} */ ((this._requests.shift())));
        } while (this._requests.length > 0);
        this.verifyNoOutstandingExpectations();
    }
    /**
     * Throw an exception if any expectations have not been satisfied.
     * @return {?}
     */
    verifyNoOutstandingExpectations() {
        if (this._expectations.length === 0)
            return;
        const /** @type {?} */ urls = [];
        for (let /** @type {?} */ i = 0; i < this._expectations.length; i++) {
            const /** @type {?} */ expectation = this._expectations[i];
            urls.push(expectation.url);
        }
        throw new Error(`Unsatisfied requests: ${urls.join(', ')}`);
    }
    /**
     * @param {?} request
     * @return {?}
     */
    _processRequest(request) {
        const /** @type {?} */ url = request.url;
        if (this._expectations.length > 0) {
            const /** @type {?} */ expectation = this._expectations[0];
            if (expectation.url == url) {
                remove(this._expectations, expectation);
                request.complete(expectation.response);
                return;
            }
        }
        if (this._definitions.has(url)) {
            const /** @type {?} */ response = this._definitions.get(url);
            request.complete(response == null ? null : response);
            return;
        }
        throw new Error(`Unexpected request ${url}`);
    }
}
function MockResourceLoader_tsickle_Closure_declarations() {
    /** @type {?} */
    MockResourceLoader.prototype._expectations;
    /** @type {?} */
    MockResourceLoader.prototype._definitions;
    /** @type {?} */
    MockResourceLoader.prototype._requests;
}
class _PendingRequest {
    /**
     * @param {?} url
     */
    constructor(url) {
        this.url = url;
        this.promise = new Promise((res, rej) => {
            this.resolve = res;
            this.reject = rej;
        });
    }
    /**
     * @param {?} response
     * @return {?}
     */
    complete(response) {
        if (response == null) {
            this.reject(`Failed to load ${this.url}`);
        }
        else {
            this.resolve(response);
        }
    }
    /**
     * @return {?}
     */
    getPromise() { return this.promise; }
}
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
class _Expectation {
    /**
     * @param {?} url
     * @param {?} response
     */
    constructor(url, response) {
        this.url = url;
        this.response = response;
    }
}
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
    const /** @type {?} */ index = list.indexOf(el);
    if (index > -1) {
        list.splice(index, 1);
    }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2VfbG9hZGVyX21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9yZXNvdXJjZV9sb2FkZXJfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVFBLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQzs7Ozs7QUFNakQsTUFBTSx5QkFBMEIsU0FBUSxjQUFjOzs7NkJBQ1osRUFBRTs0QkFDbkIsSUFBSSxHQUFHLEVBQWtCO3lCQUNULEVBQUU7Ozs7OztJQUV6QyxHQUFHLENBQUMsR0FBVztRQUNiLHVCQUFNLE9BQU8sR0FBRyxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3QixPQUFPLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztLQUM3Qjs7OztJQUVELGtCQUFrQixLQUFLLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUU7Ozs7Ozs7Ozs7O0lBU3hELE1BQU0sQ0FBQyxHQUFXLEVBQUUsUUFBZ0I7UUFDbEMsdUJBQU0sV0FBVyxHQUFHLElBQUksWUFBWSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztLQUN0Qzs7Ozs7Ozs7OztJQVFELElBQUksQ0FBQyxHQUFXLEVBQUUsUUFBZ0IsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRTs7Ozs7O0lBTTdFLEtBQUs7UUFDSCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUMvQixNQUFNLElBQUksS0FBSyxD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Ozs7Ozs7Ozs7Ozs7QUFFRCxnQkFBbUIsSUFBUyxFQUFFLEVBQUs7SUFDakMsdUJBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0IsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUU7UUFDZCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN2QjtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1Jlc291cmNlTG9hZGVyfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5cbi8qKlxuICogQSBtb2NrIGltcGxlbWVudGF0aW9uIG9mIHtAbGluayBSZXNvdXJjZUxvYWRlcn0gdGhhdCBhbGxvd3Mgb3V0Z29pbmcgcmVxdWVzdHMgdG8gYmUgbW9ja2VkXG4gKiBhbmQgcmVzcG9uZGVkIHRvIHdpdGhpbiBhIHNpbmdsZSB0ZXN0LCB3aXRob3V0IGdvaW5nIHRvIHRoZSBuZXR3b3JrLlxuICovXG5leHBvcnQgY2xhc3MgTW9ja1Jlc291cmNlTG9hZGVyIGV4dGVuZHMgUmVzb3VyY2VMb2FkZXIge1xuICBwcml2YXRlIF9leHBlY3RhdGlvbnM6IF9FeHBlY3RhdGlvbltdID0gW107XG4gIHByaXZhdGUgX2RlZmluaXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgcHJpdmF0ZSBfcmVxdWVzdHM6IF9QZW5kaW5nUmVxdWVzdFtdID0gW107XG5cbiAgZ2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZXF1ZXN0ID0gbmV3IF9QZW5kaW5nUmVxdWVzdCh1cmwpO1xuICAgIHRoaXMuX3JlcXVlc3RzLnB1c2gocmVxdWVzdCk7XG4gICAgcmV0dXJuIHJlcXVlc3QuZ2V0UHJvbWlzZSgpO1xuICB9XG5cbiAgaGFzUGVuZGluZ1JlcXVlc3RzKCkgeyByZXR1cm4gISF0aGlzLl9yZXF1ZXN0cy5sZW5ndGg7IH1cblxuICAvKipcbiAgICogQWRkIGFuIGV4cGVjdGF0aW9uIGZvciB0aGUgZ2l2ZW4gVVJMLiBJbmNvbWluZyByZXF1ZXN0cyB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdFxuICAgKiB0aGUgbmV4dCBleHBlY3RhdGlvbiAoaW4gRklGTyBvcmRlcikuIFRoZSBgdmVyaWZ5Tm9PdXRzdGFuZGluZ0V4cGVjdGF0aW9uc2AgbWV0aG9kXG4gICAqIGNhbiBiZSB1c2VkIHRvIGNoZWNrIGlmIGFueSBleHBlY3RhdGlvbnMgaGF2ZSBub3QgeWV0IGJlZW4gbWV0LlxuICAgKlxuICAgKiBUaGUgcmVzcG9uc2UgZ2l2ZW4gd2lsbCBiZSByZXR1cm5lZCBpZiB0aGUgZXhwZWN0YXRpb24gbWF0Y2hlcy5cbiAgICovXG4gIGV4cGVjdCh1cmw6IHN0cmluZywgcmVzcG9uc2U6IHN0cmluZykge1xuICAgIGNvbnN0IGV4cGVjdGF0aW9uID0gbmV3IF9FeHBlY3RhdGlvbih1cmwsIHJlc3BvbnNlKTtcbiAgICB0aGlzLl9leHBlY3RhdGlvbnMucHVzaChleHBlY3RhdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgZGVmaW5pdGlvbiBmb3IgdGhlIGdpdmVuIFVSTCB0byByZXR1cm4gdGhlIGdpdmVuIHJlc3BvbnNlLiBVbmxpa2UgZXhwZWN0YXRpb25zLFxuICAgKiBkZWZpbml0aW9ucyBoYXZlIG5vIG9yZGVyIGFuZCB3aWxsIHNhdGlzZnkgYW55IG1hdGNoaW5nIHJlcXVlc3QgYXQgYW55IHRpbWUuIEFsc29cbiAgICogdW5saWtlIGV4cGVjdGF0aW9ucywgdW51c2VkIGRlZmluaXRpb25zIGRvIG5vdCBjYXVzZSBgdmVyaWZ5Tm9PdXRzdGFuZGluZ0V4cGVjdGF0aW9uc2BcbiAgICogdG8gcmV0dXJuIGFuIGVycm9yLlxuICAgKi9cbiAgd2hlbih1cmw6IHN0cmluZywgcmVzcG9uc2U6IHN0cmluZykgeyB0aGlzLl9kZWZpbml0aW9ucy5zZXQodXJsLCByZXNwb25zZSk7IH1cblxuICAvKipcbiAgICogUHJvY2VzcyBwZW5kaW5nIHJlcXVlc3RzIGFuZCB2ZXJpZnkgdGhlcmUgYXJlIG5vIG91dHN0YW5kaW5nIGV4cGVjdGF0aW9ucy4gQWxzbyBmYWlsc1xuICAgKiBpZiBubyByZXF1ZXN0cyBhcmUgcGVuZGluZy5cbiAgICovXG4gIGZsdXNoKCkge1xuICAgIGlmICh0aGlzLl9yZXF1ZXN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gcGVuZGluZyByZXF1ZXN0cyB0byBmbHVzaCcpO1xuICAgIH1cblxuICAgIGRvIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NSZXF1ZXN0KHRoaXMuX3JlcXVlc3RzLnNoaWZ0KCkgISk7XG4gICAgfSB3aGlsZSAodGhpcy5fcmVxdWVzdHMubGVuZ3RoID4gMCk7XG5cbiAgICB0aGlzLnZlcmlmeU5vT3V0c3RhbmRpbmdFeHBlY3RhdGlvbnMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaHJvdyBhbiBleGNlcHRpb24gaWYgYW55IGV4cGVjdGF0aW9ucyBoYXZlIG5vdCBiZWVuIHNhdGlzZmllZC5cbiAgICovXG4gIHZlcmlmeU5vT3V0c3RhbmRpbmdFeHBlY3RhdGlvbnMoKSB7XG4gICAgaWYgKHRoaXMuX2V4cGVjdGF0aW9ucy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIGNvbnN0IHVybHM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9leHBlY3RhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGV4cGVjdGF0aW9uID0gdGhpcy5fZXhwZWN0YXRpb25zW2ldO1xuICAgICAgdXJscy5wdXNoKGV4cGVjdGF0aW9uLnVybCk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbnNhdGlzZmllZCByZXF1ZXN0czogJHt1cmxzLmpvaW4oJywgJyl9YCk7XG4gIH1cblxuICBwcml2YXRlIF9wcm9jZXNzUmVxdWVzdChyZXF1ZXN0OiBfUGVuZGluZ1JlcXVlc3QpIHtcbiAgICBjb25zdCB1cmwgPSByZXF1ZXN0LnVybDtcblxuICAgIGlmICh0aGlzLl9leHBlY3RhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXhwZWN0YXRpb24gPSB0aGlzLl9leHBlY3RhdGlvbnNbMF07XG4gICAgICBpZiAoZXhwZWN0YXRpb24udXJsID09IHVybCkge1xuICAgICAgICByZW1vdmUodGhpcy5fZXhwZWN0YXRpb25zLCBleHBlY3RhdGlvbik7XG4gICAgICAgIHJlcXVlc3QuY29tcGxldGUoZXhwZWN0YXRpb24ucmVzcG9uc2UpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2RlZmluaXRpb25zLmhhcyh1cmwpKSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuX2RlZmluaXRpb25zLmdldCh1cmwpO1xuICAgICAgcmVxdWVzdC5jb21wbGV0ZShyZXNwb25zZSA9PSBudWxsID8gbnVsbCA6IHJlc3BvbnNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgcmVxdWVzdCAke3VybH1gKTtcbiAgfVxufVxuXG5jbGFzcyBfUGVuZGluZ1JlcXVlc3Qge1xuICByZXNvbHZlOiAocmVzdWx0OiBzdHJpbmcpID0+IHZvaWQ7XG4gIHJlamVjdDogKGVycm9yOiBhbnkpID0+IHZvaWQ7XG4gIHByb21pc2U6IFByb21pc2U8c3RyaW5nPjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgdXJsOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICAgIHRoaXMucmVzb2x2ZSA9IHJlcztcbiAgICAgIHRoaXMucmVqZWN0ID0gcmVqO1xuICAgIH0pO1xuICB9XG5cbiAgY29tcGxldGUocmVzcG9uc2U6IHN0cmluZ3xudWxsKSB7XG4gICAgaWYgKHJlc3BvbnNlID09IG51bGwpIHtcbiAgICAgIHRoaXMucmVqZWN0KGBGYWlsZWQgdG8gbG9hZCAke3RoaXMudXJsfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlc29sdmUocmVzcG9uc2UpO1xuICAgIH1cbiAgfVxuXG4gIGdldFByb21pc2UoKTogUHJvbWlzZTxzdHJpbmc+IHsgcmV0dXJuIHRoaXMucHJvbWlzZTsgfVxufVxuXG5jbGFzcyBfRXhwZWN0YXRpb24ge1xuICB1cmw6IHN0cmluZztcbiAgcmVzcG9uc2U6IHN0cmluZztcbiAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcsIHJlc3BvbnNlOiBzdHJpbmcpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlPFQ+KGxpc3Q6IFRbXSwgZWw6IFQpOiB2b2lkIHtcbiAgY29uc3QgaW5kZXggPSBsaXN0LmluZGV4T2YoZWwpO1xuICBpZiAoaW5kZXggPiAtMSkge1xuICAgIGxpc3Quc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxufVxuIl19