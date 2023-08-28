/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../../../../i18n/i18n_ast';
import * as ir from '../../ir';
import { getElementsByXrefId } from '../util/elements';
/**
 * Generate i18n start and end isntructions to mark i18n blocks.
 */
export function phaseGenerateI18nBlocks(job) {
    for (const unit of job.units) {
        const elements = getElementsByXrefId(unit);
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.ElementEnd:
                    const start = elements.get(op.xref);
                    if (start.i18n instanceof i18n.Message) {
                        const id = job.allocateXrefId();
                        ir.OpList.insertAfter(ir.createI18nStartOp(id, start.i18n), start);
                        ir.OpList.insertBefore(ir.createI18nEndOp(id), op);
                    }
                    break;
                case ir.OpKind.Template:
                    if (op.i18n !== undefined) {
                        const id = job.allocateXrefId();
                        ir.OpList.insertBefore(ir.createI18nStartOp(id, op.i18n), op);
                        ir.OpList.insertAfter(ir.createI18nEndOp(id), op);
                    }
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfaTE4bl9ibG9ja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9nZW5lcmF0ZV9pMThuX2Jsb2Nrcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssSUFBSSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRS9CLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRXJEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUFDLEdBQW1CO0lBQ3pELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixNQUFNLFFBQVEsR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxVQUFVO29CQUN2QixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsQ0FBQztvQkFDckMsSUFBSSxLQUFLLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLEVBQUU7d0JBQ3RDLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDaEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQWMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7d0JBQ2hGLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFjLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7cUJBQ2pFO29CQUNELE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7b0JBQ3JCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7d0JBQ3pCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDaEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQWMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQzNFLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7cUJBQ2hFO29CQUNELE1BQU07YUFDVDtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2dldEVsZW1lbnRzQnlYcmVmSWR9IGZyb20gJy4uL3V0aWwvZWxlbWVudHMnO1xuXG4vKipcbiAqIEdlbmVyYXRlIGkxOG4gc3RhcnQgYW5kIGVuZCBpc250cnVjdGlvbnMgdG8gbWFyayBpMThuIGJsb2Nrcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlR2VuZXJhdGVJMThuQmxvY2tzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gZ2V0RWxlbWVudHNCeVhyZWZJZCh1bml0KTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgICBjb25zdCBzdGFydCA9IGVsZW1lbnRzLmdldChvcC54cmVmKSE7XG4gICAgICAgICAgaWYgKHN0YXJ0LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuQ3JlYXRlT3A+KGlyLmNyZWF0ZUkxOG5TdGFydE9wKGlkLCBzdGFydC5pMThuKSwgc3RhcnQpO1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oaXIuY3JlYXRlSTE4bkVuZE9wKGlkKSwgb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgICAgaWYgKG9wLmkxOG4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgaWQgPSBqb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KGlyLmNyZWF0ZUkxOG5TdGFydE9wKGlkLCBvcC5pMThuKSwgb3ApO1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVJMThuRW5kT3AoaWQpLCBvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19