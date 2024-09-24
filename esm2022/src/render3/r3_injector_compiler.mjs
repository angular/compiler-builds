/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import * as o from '../output/output_ast';
import { Identifiers as R3 } from './r3_identifiers';
import { DefinitionMap } from './view/util';
export function compileInjector(meta) {
    const definitionMap = new DefinitionMap();
    if (meta.providers !== null) {
        definitionMap.set('providers', meta.providers);
    }
    if (meta.imports.length > 0) {
        definitionMap.set('imports', o.literalArr(meta.imports));
    }
    const expression = o
        .importExpr(R3.defineInjector)
        .callFn([definitionMap.toLiteralMap()], undefined, true);
    const type = createInjectorType(meta);
    return { expression, type, statements: [] };
}
export function createInjectorType(meta) {
    return new o.ExpressionType(o.importExpr(R3.InjectorDeclaration, [new o.ExpressionType(meta.type.type)]));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaW5qZWN0b3JfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHNCQUFzQixDQUFDO0FBRTFDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFbkQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQVMxQyxNQUFNLFVBQVUsZUFBZSxDQUFDLElBQXdCO0lBQ3RELE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUFvRCxDQUFDO0lBRTVGLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUM1QixhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDNUIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRUQsTUFBTSxVQUFVLEdBQUcsQ0FBQztTQUNqQixVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQztTQUM3QixNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDM0QsTUFBTSxJQUFJLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsT0FBTyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBQyxDQUFDO0FBQzVDLENBQUM7QUFFRCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsSUFBd0I7SUFDekQsT0FBTyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQ3pCLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUM3RSxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmRldi9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbiwgUjNSZWZlcmVuY2V9IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4vdmlldy91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBSM0luamVjdG9yTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IFIzUmVmZXJlbmNlO1xuICBwcm92aWRlcnM6IG8uRXhwcmVzc2lvbiB8IG51bGw7XG4gIGltcG9ydHM6IG8uRXhwcmVzc2lvbltdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUluamVjdG9yKG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPHtwcm92aWRlcnM6IG8uRXhwcmVzc2lvbjsgaW1wb3J0czogby5FeHByZXNzaW9ufT4oKTtcblxuICBpZiAobWV0YS5wcm92aWRlcnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZXJzJywgbWV0YS5wcm92aWRlcnMpO1xuICB9XG5cbiAgaWYgKG1ldGEuaW1wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ltcG9ydHMnLCBvLmxpdGVyYWxBcnIobWV0YS5pbXBvcnRzKSk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gb1xuICAgIC5pbXBvcnRFeHByKFIzLmRlZmluZUluamVjdG9yKVxuICAgIC5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldLCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCB0eXBlID0gY3JlYXRlSW5qZWN0b3JUeXBlKG1ldGEpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUluamVjdG9yVHlwZShtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOiBvLlR5cGUge1xuICByZXR1cm4gbmV3IG8uRXhwcmVzc2lvblR5cGUoXG4gICAgby5pbXBvcnRFeHByKFIzLkluamVjdG9yRGVjbGFyYXRpb24sIFtuZXcgby5FeHByZXNzaW9uVHlwZShtZXRhLnR5cGUudHlwZSldKSxcbiAgKTtcbn1cbiJdfQ==