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
 * A mock implementation of {@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
var /**
 * A mock implementation of {@link ResourceLoader} that allows outgoing requests to be mocked
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
    MockResourceLoader.prototype.get = function (url) {
        var request = new _PendingRequest(url);
        this._requests.push(request);
        return request.getPromise();
    };
    MockResourceLoader.prototype.hasPendingRequests = function () { return !!this._requests.length; };
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
       */
    MockResourceLoader.prototype.expect = /**
       * Add an expectation for the given URL. Incoming requests will be checked against
       * the next expectation (in FIFO order). The `verifyNoOutstandingExpectations` method
       * can be used to check if any expectations have not yet been met.
       *
       * The response given will be returned if the expectation matches.
       */
    function (url, response) {
        var expectation = new _Expectation(url, response);
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
       */
    MockResourceLoader.prototype.when = /**
       * Add a definition for the given URL to return the given response. Unlike expectations,
       * definitions have no order and will satisfy any matching request at any time. Also
       * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
       * to return an error.
       */
    function (url, response) { this._definitions.set(url, response); };
    /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     */
    /**
       * Process pending requests and verify there are no outstanding expectations. Also fails
       * if no requests are pending.
       */
    MockResourceLoader.prototype.flush = /**
       * Process pending requests and verify there are no outstanding expectations. Also fails
       * if no requests are pending.
       */
    function () {
        if (this._requests.length === 0) {
            throw new Error('No pending requests to flush');
        }
        do {
            this._processRequest((this._requests.shift()));
        } while (this._requests.length > 0);
        this.verifyNoOutstandingExpectations();
    };
    /**
     * Throw an exception if any expectations have not been satisfied.
     */
    /**
       * Throw an exception if any expectations have not been satisfied.
       */
    MockResourceLoader.prototype.verifyNoOutstandingExpectations = /**
       * Throw an exception if any expectations have not been satisfied.
       */
    function () {
        if (this._expectations.length === 0)
            return;
        var urls = [];
        for (var i = 0; i < this._expectations.length; i++) {
            var expectation = this._expectations[i];
            urls.push(expectation.url);
        }
        throw new Error("Unsatisfied requests: " + urls.join(', '));
    };
    MockResourceLoader.prototype._processRequest = function (request) {
        var url = request.url;
        if (this._expectations.length > 0) {
            var expectation = this._expectations[0];
            if (expectation.url == url) {
                remove(this._expectations, expectation);
                request.complete(expectation.response);
                return;
            }
        }
        if (this._definitions.has(url)) {
            var response = this._definitions.get(url);
            request.complete(response == null ? null : response);
            return;
        }
        throw new Error("Unexpected request " + url);
    };
    return MockResourceLoader;
}(ResourceLoader));
/**
 * A mock implementation of {@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
export { MockResourceLoader };
var _PendingRequest = /** @class */ (function () {
    function _PendingRequest(url) {
        var _this = this;
        this.url = url;
        this.promise = new Promise(function (res, rej) {
            _this.resolve = res;
            _this.reject = rej;
        });
    }
    _PendingRequest.prototype.complete = function (response) {
        if (response == null) {
            this.reject("Failed to load " + this.url);
        }
        else {
            this.resolve(response);
        }
    };
    _PendingRequest.prototype.getPromise = function () { return this.promise; };
    return _PendingRequest;
}());
var _Expectation = /** @class */ (function () {
    function _Expectation(url, response) {
        this.url = url;
        this.response = response;
    }
    return _Expectation;
}());
function remove(list, el) {
    var index = list.indexOf(el);
    if (index > -1) {
        list.splice(index, 1);
    }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2VfbG9hZGVyX21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9yZXNvdXJjZV9sb2FkZXJfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQVFBLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQzs7Ozs7QUFNakQ7Ozs7QUFBQTtJQUF3Qyw4Q0FBYzs7OzhCQUNaLEVBQUU7NkJBQ25CLElBQUksR0FBRyxFQUFrQjswQkFDVCxFQUFFOzs7SUFFekMsZ0NBQUcsR0FBSCxVQUFJLEdBQVc7UUFDYixJQUFNLE9BQU8sR0FBRyxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3QixPQUFPLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztLQUM3QjtJQUVELCtDQUFrQixHQUFsQixjQUF1QixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0lBRXhEOzs7Ozs7T0FNRzs7Ozs7Ozs7SUFDSCxtQ0FBTTs7Ozs7OztJQUFOLFVBQU8sR0FBVyxFQUFFLFFBQWdCO1FBQ2xDLElBQU0sV0FBVyxHQUFHLElBQUksWUFBWSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztLQUN0QztJQUVEOzs7OztPQUtHOzs7Ozs7O0lBQ0gsaUNBQUk7Ozs7OztJQUFKLFVBQUssR0FBVyxFQUFFLFFBQWdCLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7SUFFN0U7OztPQUdHOzs7OztJQUNILGtDQUFLOzs7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QUU7MEJBeEh4RDtJQXlIQyxDQUFBO0FBRUQsSUFBQTtJQUdFLHNCQUFZLEdBQVcsRUFBRSxRQUFnQjtRQUN2QyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0tBQzFCO3VCQWpJSDtJQWtJQyxDQUFBO0FBRUQsZ0JBQW1CLElBQVMsRUFBRSxFQUFLO0lBQ2pDLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0IsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUU7UUFDZCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN2QjtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1Jlc291cmNlTG9hZGVyfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5cbi8qKlxuICogQSBtb2NrIGltcGxlbWVudGF0aW9uIG9mIHtAbGluayBSZXNvdXJjZUxvYWRlcn0gdGhhdCBhbGxvd3Mgb3V0Z29pbmcgcmVxdWVzdHMgdG8gYmUgbW9ja2VkXG4gKiBhbmQgcmVzcG9uZGVkIHRvIHdpdGhpbiBhIHNpbmdsZSB0ZXN0LCB3aXRob3V0IGdvaW5nIHRvIHRoZSBuZXR3b3JrLlxuICovXG5leHBvcnQgY2xhc3MgTW9ja1Jlc291cmNlTG9hZGVyIGV4dGVuZHMgUmVzb3VyY2VMb2FkZXIge1xuICBwcml2YXRlIF9leHBlY3RhdGlvbnM6IF9FeHBlY3RhdGlvbltdID0gW107XG4gIHByaXZhdGUgX2RlZmluaXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgcHJpdmF0ZSBfcmVxdWVzdHM6IF9QZW5kaW5nUmVxdWVzdFtdID0gW107XG5cbiAgZ2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZXF1ZXN0ID0gbmV3IF9QZW5kaW5nUmVxdWVzdCh1cmwpO1xuICAgIHRoaXMuX3JlcXVlc3RzLnB1c2gocmVxdWVzdCk7XG4gICAgcmV0dXJuIHJlcXVlc3QuZ2V0UHJvbWlzZSgpO1xuICB9XG5cbiAgaGFzUGVuZGluZ1JlcXVlc3RzKCkgeyByZXR1cm4gISF0aGlzLl9yZXF1ZXN0cy5sZW5ndGg7IH1cblxuICAvKipcbiAgICogQWRkIGFuIGV4cGVjdGF0aW9uIGZvciB0aGUgZ2l2ZW4gVVJMLiBJbmNvbWluZyByZXF1ZXN0cyB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdFxuICAgKiB0aGUgbmV4dCBleHBlY3RhdGlvbiAoaW4gRklGTyBvcmRlcikuIFRoZSBgdmVyaWZ5Tm9PdXRzdGFuZGluZ0V4cGVjdGF0aW9uc2AgbWV0aG9kXG4gICAqIGNhbiBiZSB1c2VkIHRvIGNoZWNrIGlmIGFueSBleHBlY3RhdGlvbnMgaGF2ZSBub3QgeWV0IGJlZW4gbWV0LlxuICAgKlxuICAgKiBUaGUgcmVzcG9uc2UgZ2l2ZW4gd2lsbCBiZSByZXR1cm5lZCBpZiB0aGUgZXhwZWN0YXRpb24gbWF0Y2hlcy5cbiAgICovXG4gIGV4cGVjdCh1cmw6IHN0cmluZywgcmVzcG9uc2U6IHN0cmluZykge1xuICAgIGNvbnN0IGV4cGVjdGF0aW9uID0gbmV3IF9FeHBlY3RhdGlvbih1cmwsIHJlc3BvbnNlKTtcbiAgICB0aGlzLl9leHBlY3RhdGlvbnMucHVzaChleHBlY3RhdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgZGVmaW5pdGlvbiBmb3IgdGhlIGdpdmVuIFVSTCB0byByZXR1cm4gdGhlIGdpdmVuIHJlc3BvbnNlLiBVbmxpa2UgZXhwZWN0YXRpb25zLFxuICAgKiBkZWZpbml0aW9ucyBoYXZlIG5vIG9yZGVyIGFuZCB3aWxsIHNhdGlzZnkgYW55IG1hdGNoaW5nIHJlcXVlc3QgYXQgYW55IHRpbWUuIEFsc29cbiAgICogdW5saWtlIGV4cGVjdGF0aW9ucywgdW51c2VkIGRlZmluaXRpb25zIGRvIG5vdCBjYXVzZSBgdmVyaWZ5Tm9PdXRzdGFuZGluZ0V4cGVjdGF0aW9uc2BcbiAgICogdG8gcmV0dXJuIGFuIGVycm9yLlxuICAgKi9cbiAgd2hlbih1cmw6IHN0cmluZywgcmVzcG9uc2U6IHN0cmluZykgeyB0aGlzLl9kZWZpbml0aW9ucy5zZXQodXJsLCByZXNwb25zZSk7IH1cblxuICAvKipcbiAgICogUHJvY2VzcyBwZW5kaW5nIHJlcXVlc3RzIGFuZCB2ZXJpZnkgdGhlcmUgYXJlIG5vIG91dHN0YW5kaW5nIGV4cGVjdGF0aW9ucy4gQWxzbyBmYWlsc1xuICAgKiBpZiBubyByZXF1ZXN0cyBhcmUgcGVuZGluZy5cbiAgICovXG4gIGZsdXNoKCkge1xuICAgIGlmICh0aGlzLl9yZXF1ZXN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gcGVuZGluZyByZXF1ZXN0cyB0byBmbHVzaCcpO1xuICAgIH1cblxuICAgIGRvIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NSZXF1ZXN0KHRoaXMuX3JlcXVlc3RzLnNoaWZ0KCkgISk7XG4gICAgfSB3aGlsZSAodGhpcy5fcmVxdWVzdHMubGVuZ3RoID4gMCk7XG5cbiAgICB0aGlzLnZlcmlmeU5vT3V0c3RhbmRpbmdFeHBlY3RhdGlvbnMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaHJvdyBhbiBleGNlcHRpb24gaWYgYW55IGV4cGVjdGF0aW9ucyBoYXZlIG5vdCBiZWVuIHNhdGlzZmllZC5cbiAgICovXG4gIHZlcmlmeU5vT3V0c3RhbmRpbmdFeHBlY3RhdGlvbnMoKSB7XG4gICAgaWYgKHRoaXMuX2V4cGVjdGF0aW9ucy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIGNvbnN0IHVybHM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9leHBlY3RhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGV4cGVjdGF0aW9uID0gdGhpcy5fZXhwZWN0YXRpb25zW2ldO1xuICAgICAgdXJscy5wdXNoKGV4cGVjdGF0aW9uLnVybCk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbnNhdGlzZmllZCByZXF1ZXN0czogJHt1cmxzLmpvaW4oJywgJyl9YCk7XG4gIH1cblxuICBwcml2YXRlIF9wcm9jZXNzUmVxdWVzdChyZXF1ZXN0OiBfUGVuZGluZ1JlcXVlc3QpIHtcbiAgICBjb25zdCB1cmwgPSByZXF1ZXN0LnVybDtcblxuICAgIGlmICh0aGlzLl9leHBlY3RhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXhwZWN0YXRpb24gPSB0aGlzLl9leHBlY3RhdGlvbnNbMF07XG4gICAgICBpZiAoZXhwZWN0YXRpb24udXJsID09IHVybCkge1xuICAgICAgICByZW1vdmUodGhpcy5fZXhwZWN0YXRpb25zLCBleHBlY3RhdGlvbik7XG4gICAgICAgIHJlcXVlc3QuY29tcGxldGUoZXhwZWN0YXRpb24ucmVzcG9uc2UpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2RlZmluaXRpb25zLmhhcyh1cmwpKSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuX2RlZmluaXRpb25zLmdldCh1cmwpO1xuICAgICAgcmVxdWVzdC5jb21wbGV0ZShyZXNwb25zZSA9PSBudWxsID8gbnVsbCA6IHJlc3BvbnNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgcmVxdWVzdCAke3VybH1gKTtcbiAgfVxufVxuXG5jbGFzcyBfUGVuZGluZ1JlcXVlc3Qge1xuICByZXNvbHZlOiAocmVzdWx0OiBzdHJpbmcpID0+IHZvaWQ7XG4gIHJlamVjdDogKGVycm9yOiBhbnkpID0+IHZvaWQ7XG4gIHByb21pc2U6IFByb21pc2U8c3RyaW5nPjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgdXJsOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICAgIHRoaXMucmVzb2x2ZSA9IHJlcztcbiAgICAgIHRoaXMucmVqZWN0ID0gcmVqO1xuICAgIH0pO1xuICB9XG5cbiAgY29tcGxldGUocmVzcG9uc2U6IHN0cmluZ3xudWxsKSB7XG4gICAgaWYgKHJlc3BvbnNlID09IG51bGwpIHtcbiAgICAgIHRoaXMucmVqZWN0KGBGYWlsZWQgdG8gbG9hZCAke3RoaXMudXJsfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlc29sdmUocmVzcG9uc2UpO1xuICAgIH1cbiAgfVxuXG4gIGdldFByb21pc2UoKTogUHJvbWlzZTxzdHJpbmc+IHsgcmV0dXJuIHRoaXMucHJvbWlzZTsgfVxufVxuXG5jbGFzcyBfRXhwZWN0YXRpb24ge1xuICB1cmw6IHN0cmluZztcbiAgcmVzcG9uc2U6IHN0cmluZztcbiAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcsIHJlc3BvbnNlOiBzdHJpbmcpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlPFQ+KGxpc3Q6IFRbXSwgZWw6IFQpOiB2b2lkIHtcbiAgY29uc3QgaW5kZXggPSBsaXN0LmluZGV4T2YoZWwpO1xuICBpZiAoaW5kZXggPiAtMSkge1xuICAgIGxpc3Quc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxufVxuIl19