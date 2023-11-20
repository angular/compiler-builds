/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertInterpolationSymbols } from '../assertions';
export class InterpolationConfig {
    static fromArray(markers) {
        if (!markers) {
            return DEFAULT_INTERPOLATION_CONFIG;
        }
        assertInterpolationSymbols('interpolation', markers);
        return new InterpolationConfig(markers[0], markers[1]);
    }
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
export const DEFAULT_INTERPOLATION_CONFIG = new InterpolationConfig('{{', '}}');
export const DEFAULT_CONTAINER_BLOCKS = new Set(['switch']);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2RlZmF1bHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUV6RCxNQUFNLE9BQU8sbUJBQW1CO0lBQzlCLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBOEI7UUFDN0MsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNaLE9BQU8sNEJBQTRCLENBQUM7U0FDckM7UUFFRCwwQkFBMEIsQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckQsT0FBTyxJQUFJLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBRUQsWUFBbUIsS0FBYSxFQUFTLEdBQVc7UUFBakMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFTLFFBQUcsR0FBSCxHQUFHLENBQVE7SUFBRyxDQUFDO0NBQ3pEO0FBRUQsTUFBTSxDQUFDLE1BQU0sNEJBQTRCLEdBQ3JDLElBQUksbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sQ0FBQyxNQUFNLHdCQUF3QixHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Fzc2VydEludGVycG9sYXRpb25TeW1ib2xzfSBmcm9tICcuLi9hc3NlcnRpb25zJztcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25Db25maWcge1xuICBzdGF0aWMgZnJvbUFycmF5KG1hcmtlcnM6IFtzdHJpbmcsIHN0cmluZ118bnVsbCk6IEludGVycG9sYXRpb25Db25maWcge1xuICAgIGlmICghbWFya2Vycykge1xuICAgICAgcmV0dXJuIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgfVxuXG4gICAgYXNzZXJ0SW50ZXJwb2xhdGlvblN5bWJvbHMoJ2ludGVycG9sYXRpb24nLCBtYXJrZXJzKTtcbiAgICByZXR1cm4gbmV3IEludGVycG9sYXRpb25Db25maWcobWFya2Vyc1swXSwgbWFya2Vyc1sxXSk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RhcnQ6IHN0cmluZywgcHVibGljIGVuZDogc3RyaW5nKSB7fVxufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9XG4gICAgbmV3IEludGVycG9sYXRpb25Db25maWcoJ3t7JywgJ319Jyk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTlRBSU5FUl9CTE9DS1MgPSBuZXcgU2V0KFsnc3dpdGNoJ10pO1xuIl19