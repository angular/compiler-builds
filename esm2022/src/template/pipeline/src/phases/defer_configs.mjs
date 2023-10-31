/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { literalOrArrayLiteral } from '../conversion';
export function phaseDeferConfigs(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind !== ir.OpKind.Defer) {
                continue;
            }
            if (op.placeholderMinimumTime !== null) {
                op.placeholderConfig =
                    new ir.ConstCollectedExpr(literalOrArrayLiteral([op.placeholderMinimumTime]));
            }
            if (op.loadingMinimumTime !== null || op.loadingAfterTime !== null) {
                op.loadingConfig = new ir.ConstCollectedExpr(literalOrArrayLiteral([op.loadingMinimumTime, op.loadingAfterTime]));
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJfY29uZmlncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2RlZmVyX2NvbmZpZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFL0IsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXBELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUE0QjtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtnQkFDL0IsU0FBUzthQUNWO1lBRUQsSUFBSSxFQUFFLENBQUMsc0JBQXNCLEtBQUssSUFBSSxFQUFFO2dCQUN0QyxFQUFFLENBQUMsaUJBQWlCO29CQUNoQixJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNuRjtZQUNELElBQUksRUFBRSxDQUFDLGtCQUFrQixLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxFQUFFO2dCQUNsRSxFQUFFLENBQUMsYUFBYSxHQUFHLElBQUksRUFBRSxDQUFDLGtCQUFrQixDQUN4QyxxQkFBcUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDMUU7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtWaWV3Q29tcGlsYXRpb25Vbml0LCBDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtsaXRlcmFsT3JBcnJheUxpdGVyYWx9IGZyb20gJy4uL2NvbnZlcnNpb24nO1xuXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VEZWZlckNvbmZpZ3Moam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5EZWZlcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWUgIT09IG51bGwpIHtcbiAgICAgICAgb3AucGxhY2Vob2xkZXJDb25maWcgPVxuICAgICAgICAgICAgbmV3IGlyLkNvbnN0Q29sbGVjdGVkRXhwcihsaXRlcmFsT3JBcnJheUxpdGVyYWwoW29wLnBsYWNlaG9sZGVyTWluaW11bVRpbWVdKSk7XG4gICAgICB9XG4gICAgICBpZiAob3AubG9hZGluZ01pbmltdW1UaW1lICE9PSBudWxsIHx8IG9wLmxvYWRpbmdBZnRlclRpbWUgIT09IG51bGwpIHtcbiAgICAgICAgb3AubG9hZGluZ0NvbmZpZyA9IG5ldyBpci5Db25zdENvbGxlY3RlZEV4cHIoXG4gICAgICAgICAgICBsaXRlcmFsT3JBcnJheUxpdGVyYWwoW29wLmxvYWRpbmdNaW5pbXVtVGltZSwgb3AubG9hZGluZ0FmdGVyVGltZV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==