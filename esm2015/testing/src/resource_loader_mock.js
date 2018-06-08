/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ResourceLoader } from '@angular/compiler';
/**
 * A mock implementation of {@link ResourceLoader} that allows outgoing requests to be mocked
 * and responded to within a single test, without going to the network.
 */
export class MockResourceLoader extends ResourceLoader {
    constructor() {
        super(...arguments);
        this._expectations = [];
        this._definitions = new Map();
        this._requests = [];
    }
    get(url) {
        const request = new _PendingRequest(url);
        this._requests.push(request);
        return request.getPromise();
    }
    hasPendingRequests() { return !!this._requests.length; }
    /**
     * Add an expectation for the given URL. Incoming requests will be checked against
     * the next expectation (in FIFO order). The `verifyNoOutstandingExpectations` method
     * can be used to check if any expectations have not yet been met.
     *
     * The response given will be returned if the expectation matches.
     */
    expect(url, response) {
        const expectation = new _Expectation(url, response);
        this._expectations.push(expectation);
    }
    /**
     * Add a definition for the given URL to return the given response. Unlike expectations,
     * definitions have no order and will satisfy any matching request at any time. Also
     * unlike expectations, unused definitions do not cause `verifyNoOutstandingExpectations`
     * to return an error.
     */
    when(url, response) { this._definitions.set(url, response); }
    /**
     * Process pending requests and verify there are no outstanding expectations. Also fails
     * if no requests are pending.
     */
    flush() {
        if (this._requests.length === 0) {
            throw new Error('No pending requests to flush');
        }
        do {
            this._processRequest(this._requests.shift());
        } while (this._requests.length > 0);
        this.verifyNoOutstandingExpectations();
    }
    /**
     * Throw an exception if any expectations have not been satisfied.
     */
    verifyNoOutstandingExpectations() {
        if (this._expectations.length === 0)
            return;
        const urls = [];
        for (let i = 0; i < this._expectations.length; i++) {
            const expectation = this._expectations[i];
            urls.push(expectation.url);
        }
        throw new Error(`Unsatisfied requests: ${urls.join(', ')}`);
    }
    _processRequest(request) {
        const url = request.url;
        if (this._expectations.length > 0) {
            const expectation = this._expectations[0];
            if (expectation.url == url) {
                remove(this._expectations, expectation);
                request.complete(expectation.response);
                return;
            }
        }
        if (this._definitions.has(url)) {
            const response = this._definitions.get(url);
            request.complete(response == null ? null : response);
            return;
        }
        throw new Error(`Unexpected request ${url}`);
    }
}
class _PendingRequest {
    constructor(url) {
        this.url = url;
        this.promise = new Promise((res, rej) => {
            this.resolve = res;
            this.reject = rej;
        });
    }
    complete(response) {
        if (response == null) {
            this.reject(`Failed to load ${this.url}`);
        }
        else {
            this.resolve(response);
        }
    }
    getPromise() { return this.promise; }
}
class _Expectation {
    constructor(url, response) {
        this.url = url;
        this.response = response;
    }
}
function remove(list, el) {
    const index = list.indexOf(el);
    if (index > -1) {
        list.splice(index, 1);
    }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2VfbG9hZGVyX21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9yZXNvdXJjZV9sb2FkZXJfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFakQ7OztHQUdHO0FBQ0gsTUFBTSx5QkFBMEIsU0FBUSxjQUFjO0lBQXREOztRQUNVLGtCQUFhLEdBQW1CLEVBQUUsQ0FBQztRQUNuQyxpQkFBWSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBQ3pDLGNBQVMsR0FBc0IsRUFBRSxDQUFDO0lBaUY1QyxDQUFDO0lBL0VDLEdBQUcsQ0FBQyxHQUFXO1FBQ2IsTUFBTSxPQUFPLEdBQUcsSUFBSSxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0IsT0FBTyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDOUIsQ0FBQztJQUVELGtCQUFrQixLQUFLLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUV4RDs7Ozs7O09BTUc7SUFDSCxNQUFNLENBQUMsR0FBVyxFQUFFLFFBQWdCO1FBQ2xDLE1BQU0sV0FBVyxHQUFHLElBQUksWUFBWSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxJQUFJLENBQUMsR0FBVyxFQUFFLFFBQWdCLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENB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R0UsWUFBWSxHQUFXLEVBQUUsUUFBZ0I7UUFDdkMsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDZixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztJQUMzQixDQUFDO0NBQ0Y7QUFFRCxnQkFBbUIsSUFBUyxFQUFFLEVBQUs7SUFDakMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMvQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRTtRQUNkLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3ZCO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuXG4vKipcbiAqIEEgbW9jayBpbXBsZW1lbnRhdGlvbiBvZiB7QGxpbmsgUmVzb3VyY2VMb2FkZXJ9IHRoYXQgYWxsb3dzIG91dGdvaW5nIHJlcXVlc3RzIHRvIGJlIG1vY2tlZFxuICogYW5kIHJlc3BvbmRlZCB0byB3aXRoaW4gYSBzaW5nbGUgdGVzdCwgd2l0aG91dCBnb2luZyB0byB0aGUgbmV0d29yay5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vY2tSZXNvdXJjZUxvYWRlciBleHRlbmRzIFJlc291cmNlTG9hZGVyIHtcbiAgcHJpdmF0ZSBfZXhwZWN0YXRpb25zOiBfRXhwZWN0YXRpb25bXSA9IFtdO1xuICBwcml2YXRlIF9kZWZpbml0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIHByaXZhdGUgX3JlcXVlc3RzOiBfUGVuZGluZ1JlcXVlc3RbXSA9IFtdO1xuXG4gIGdldCh1cmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVxdWVzdCA9IG5ldyBfUGVuZGluZ1JlcXVlc3QodXJsKTtcbiAgICB0aGlzLl9yZXF1ZXN0cy5wdXNoKHJlcXVlc3QpO1xuICAgIHJldHVybiByZXF1ZXN0LmdldFByb21pc2UoKTtcbiAgfVxuXG4gIGhhc1BlbmRpbmdSZXF1ZXN0cygpIHsgcmV0dXJuICEhdGhpcy5fcmVxdWVzdHMubGVuZ3RoOyB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBleHBlY3RhdGlvbiBmb3IgdGhlIGdpdmVuIFVSTC4gSW5jb21pbmcgcmVxdWVzdHMgd2lsbCBiZSBjaGVja2VkIGFnYWluc3RcbiAgICogdGhlIG5leHQgZXhwZWN0YXRpb24gKGluIEZJRk8gb3JkZXIpLiBUaGUgYHZlcmlmeU5vT3V0c3RhbmRpbmdFeHBlY3RhdGlvbnNgIG1ldGhvZFxuICAgKiBjYW4gYmUgdXNlZCB0byBjaGVjayBpZiBhbnkgZXhwZWN0YXRpb25zIGhhdmUgbm90IHlldCBiZWVuIG1ldC5cbiAgICpcbiAgICogVGhlIHJlc3BvbnNlIGdpdmVuIHdpbGwgYmUgcmV0dXJuZWQgaWYgdGhlIGV4cGVjdGF0aW9uIG1hdGNoZXMuXG4gICAqL1xuICBleHBlY3QodXJsOiBzdHJpbmcsIHJlc3BvbnNlOiBzdHJpbmcpIHtcbiAgICBjb25zdCBleHBlY3RhdGlvbiA9IG5ldyBfRXhwZWN0YXRpb24odXJsLCByZXNwb25zZSk7XG4gICAgdGhpcy5fZXhwZWN0YXRpb25zLnB1c2goZXhwZWN0YXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGRlZmluaXRpb24gZm9yIHRoZSBnaXZlbiBVUkwgdG8gcmV0dXJuIHRoZSBnaXZlbiByZXNwb25zZS4gVW5saWtlIGV4cGVjdGF0aW9ucyxcbiAgICogZGVmaW5pdGlvbnMgaGF2ZSBubyBvcmRlciBhbmQgd2lsbCBzYXRpc2Z5IGFueSBtYXRjaGluZyByZXF1ZXN0IGF0IGFueSB0aW1lLiBBbHNvXG4gICAqIHVubGlrZSBleHBlY3RhdGlvbnMsIHVudXNlZCBkZWZpbml0aW9ucyBkbyBub3QgY2F1c2UgYHZlcmlmeU5vT3V0c3RhbmRpbmdFeHBlY3RhdGlvbnNgXG4gICAqIHRvIHJldHVybiBhbiBlcnJvci5cbiAgICovXG4gIHdoZW4odXJsOiBzdHJpbmcsIHJlc3BvbnNlOiBzdHJpbmcpIHsgdGhpcy5fZGVmaW5pdGlvbnMuc2V0KHVybCwgcmVzcG9uc2UpOyB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgcGVuZGluZyByZXF1ZXN0cyBhbmQgdmVyaWZ5IHRoZXJlIGFyZSBubyBvdXRzdGFuZGluZyBleHBlY3RhdGlvbnMuIEFsc28gZmFpbHNcbiAgICogaWYgbm8gcmVxdWVzdHMgYXJlIHBlbmRpbmcuXG4gICAqL1xuICBmbHVzaCgpIHtcbiAgICBpZiAodGhpcy5fcmVxdWVzdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHBlbmRpbmcgcmVxdWVzdHMgdG8gZmx1c2gnKTtcbiAgICB9XG5cbiAgICBkbyB7XG4gICAgICB0aGlzLl9wcm9jZXNzUmVxdWVzdCh0aGlzLl9yZXF1ZXN0cy5zaGlmdCgpICEpO1xuICAgIH0gd2hpbGUgKHRoaXMuX3JlcXVlc3RzLmxlbmd0aCA+IDApO1xuXG4gICAgdGhpcy52ZXJpZnlOb091dHN0YW5kaW5nRXhwZWN0YXRpb25zKCk7XG4gIH1cblxuICAvKipcbiAgICogVGhyb3cgYW4gZXhjZXB0aW9uIGlmIGFueSBleHBlY3RhdGlvbnMgaGF2ZSBub3QgYmVlbiBzYXRpc2ZpZWQuXG4gICAqL1xuICB2ZXJpZnlOb091dHN0YW5kaW5nRXhwZWN0YXRpb25zKCkge1xuICAgIGlmICh0aGlzLl9leHBlY3RhdGlvbnMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBjb25zdCB1cmxzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXhwZWN0YXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBleHBlY3RhdGlvbiA9IHRoaXMuX2V4cGVjdGF0aW9uc1tpXTtcbiAgICAgIHVybHMucHVzaChleHBlY3RhdGlvbi51cmwpO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihgVW5zYXRpc2ZpZWQgcmVxdWVzdHM6ICR7dXJscy5qb2luKCcsICcpfWApO1xuICB9XG5cbiAgcHJpdmF0ZSBfcHJvY2Vzc1JlcXVlc3QocmVxdWVzdDogX1BlbmRpbmdSZXF1ZXN0KSB7XG4gICAgY29uc3QgdXJsID0gcmVxdWVzdC51cmw7XG5cbiAgICBpZiAodGhpcy5fZXhwZWN0YXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGV4cGVjdGF0aW9uID0gdGhpcy5fZXhwZWN0YXRpb25zWzBdO1xuICAgICAgaWYgKGV4cGVjdGF0aW9uLnVybCA9PSB1cmwpIHtcbiAgICAgICAgcmVtb3ZlKHRoaXMuX2V4cGVjdGF0aW9ucywgZXhwZWN0YXRpb24pO1xuICAgICAgICByZXF1ZXN0LmNvbXBsZXRlKGV4cGVjdGF0aW9uLnJlc3BvbnNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLl9kZWZpbml0aW9ucy5oYXModXJsKSkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLl9kZWZpbml0aW9ucy5nZXQodXJsKTtcbiAgICAgIHJlcXVlc3QuY29tcGxldGUocmVzcG9uc2UgPT0gbnVsbCA/IG51bGwgOiByZXNwb25zZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHJlcXVlc3QgJHt1cmx9YCk7XG4gIH1cbn1cblxuY2xhc3MgX1BlbmRpbmdSZXF1ZXN0IHtcbiAgcmVzb2x2ZTogKHJlc3VsdDogc3RyaW5nKSA9PiB2b2lkO1xuICByZWplY3Q6IChlcnJvcjogYW55KSA9PiB2b2lkO1xuICBwcm9taXNlOiBQcm9taXNlPHN0cmluZz47XG5cbiAgY29uc3RydWN0b3IocHVibGljIHVybDogc3RyaW5nKSB7XG4gICAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiB7XG4gICAgICB0aGlzLnJlc29sdmUgPSByZXM7XG4gICAgICB0aGlzLnJlamVjdCA9IHJlajtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbXBsZXRlKHJlc3BvbnNlOiBzdHJpbmd8bnVsbCkge1xuICAgIGlmIChyZXNwb25zZSA9PSBudWxsKSB7XG4gICAgICB0aGlzLnJlamVjdChgRmFpbGVkIHRvIGxvYWQgJHt0aGlzLnVybH1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZXNvbHZlKHJlc3BvbnNlKTtcbiAgICB9XG4gIH1cblxuICBnZXRQcm9taXNlKCk6IFByb21pc2U8c3RyaW5nPiB7IHJldHVybiB0aGlzLnByb21pc2U7IH1cbn1cblxuY2xhc3MgX0V4cGVjdGF0aW9uIHtcbiAgdXJsOiBzdHJpbmc7XG4gIHJlc3BvbnNlOiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKHVybDogc3RyaW5nLCByZXNwb25zZTogc3RyaW5nKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZTxUPihsaXN0OiBUW10sIGVsOiBUKTogdm9pZCB7XG4gIGNvbnN0IGluZGV4ID0gbGlzdC5pbmRleE9mKGVsKTtcbiAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICBsaXN0LnNwbGljZShpbmRleCwgMSk7XG4gIH1cbn1cbiJdfQ==