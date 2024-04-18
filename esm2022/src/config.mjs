/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ViewEncapsulation } from './core';
import { noUndefined } from './util';
export class CompilerConfig {
    constructor({ defaultEncapsulation = ViewEncapsulation.Emulated, preserveWhitespaces, strictInjectionParameters, } = {}) {
        this.defaultEncapsulation = defaultEncapsulation;
        this.preserveWhitespaces = preserveWhitespacesDefault(noUndefined(preserveWhitespaces));
        this.strictInjectionParameters = strictInjectionParameters === true;
    }
}
export function preserveWhitespacesDefault(preserveWhitespacesOption, defaultSetting = false) {
    return preserveWhitespacesOption === null ? defaultSetting : preserveWhitespacesOption;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQTZCLGlCQUFpQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQ3JFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFbkMsTUFBTSxPQUFPLGNBQWM7SUFLekIsWUFBWSxFQUNWLG9CQUFvQixHQUFHLGlCQUFpQixDQUFDLFFBQVEsRUFDakQsbUJBQW1CLEVBQ25CLHlCQUF5QixNQUt2QixFQUFFO1FBQ0osSUFBSSxDQUFDLG9CQUFvQixHQUFHLG9CQUFvQixDQUFDO1FBQ2pELElBQUksQ0FBQyxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQyxXQUFXLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQ3hGLElBQUksQ0FBQyx5QkFBeUIsR0FBRyx5QkFBeUIsS0FBSyxJQUFJLENBQUM7SUFDdEUsQ0FBQztDQUNGO0FBRUQsTUFBTSxVQUFVLDBCQUEwQixDQUN4Qyx5QkFBeUMsRUFDekMsY0FBYyxHQUFHLEtBQUs7SUFFdEIsT0FBTyx5QkFBeUIsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUM7QUFDekYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge01pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5LCBWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7bm9VbmRlZmluZWR9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlckNvbmZpZyB7XG4gIHB1YmxpYyBkZWZhdWx0RW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24gfCBudWxsO1xuICBwdWJsaWMgcHJlc2VydmVXaGl0ZXNwYWNlczogYm9vbGVhbjtcbiAgcHVibGljIHN0cmljdEluamVjdGlvblBhcmFtZXRlcnM6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3Ioe1xuICAgIGRlZmF1bHRFbmNhcHN1bGF0aW9uID0gVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzLFxuICB9OiB7XG4gICAgZGVmYXVsdEVuY2Fwc3VsYXRpb24/OiBWaWV3RW5jYXBzdWxhdGlvbjtcbiAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbjtcbiAgICBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzPzogYm9vbGVhbjtcbiAgfSA9IHt9KSB7XG4gICAgdGhpcy5kZWZhdWx0RW5jYXBzdWxhdGlvbiA9IGRlZmF1bHRFbmNhcHN1bGF0aW9uO1xuICAgIHRoaXMucHJlc2VydmVXaGl0ZXNwYWNlcyA9IHByZXNlcnZlV2hpdGVzcGFjZXNEZWZhdWx0KG5vVW5kZWZpbmVkKHByZXNlcnZlV2hpdGVzcGFjZXMpKTtcbiAgICB0aGlzLnN0cmljdEluamVjdGlvblBhcmFtZXRlcnMgPSBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzID09PSB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVzZXJ2ZVdoaXRlc3BhY2VzRGVmYXVsdChcbiAgcHJlc2VydmVXaGl0ZXNwYWNlc09wdGlvbjogYm9vbGVhbiB8IG51bGwsXG4gIGRlZmF1bHRTZXR0aW5nID0gZmFsc2UsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIHByZXNlcnZlV2hpdGVzcGFjZXNPcHRpb24gPT09IG51bGwgPyBkZWZhdWx0U2V0dGluZyA6IHByZXNlcnZlV2hpdGVzcGFjZXNPcHRpb247XG59XG4iXX0=