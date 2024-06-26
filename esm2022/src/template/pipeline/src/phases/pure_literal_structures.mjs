/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function generatePureLiteralStructures(job) {
    for (const unit of job.units) {
        for (const op of unit.update) {
            ir.transformExpressionsInOp(op, (expr, flags) => {
                if (flags & ir.VisitorContextFlag.InChildOperation) {
                    return expr;
                }
                if (expr instanceof o.LiteralArrayExpr) {
                    return transformLiteralArray(expr);
                }
                else if (expr instanceof o.LiteralMapExpr) {
                    return transformLiteralMap(expr);
                }
                return expr;
            }, ir.VisitorContextFlag.None);
        }
    }
}
function transformLiteralArray(expr) {
    const derivedEntries = [];
    const nonConstantArgs = [];
    for (const entry of expr.entries) {
        if (entry.isConstant()) {
            derivedEntries.push(entry);
        }
        else {
            const idx = nonConstantArgs.length;
            nonConstantArgs.push(entry);
            derivedEntries.push(new ir.PureFunctionParameterExpr(idx));
        }
    }
    return new ir.PureFunctionExpr(o.literalArr(derivedEntries), nonConstantArgs);
}
function transformLiteralMap(expr) {
    let derivedEntries = [];
    const nonConstantArgs = [];
    for (const entry of expr.entries) {
        if (entry.value.isConstant()) {
            derivedEntries.push(entry);
        }
        else {
            const idx = nonConstantArgs.length;
            nonConstantArgs.push(entry.value);
            derivedEntries.push(new o.LiteralMapEntry(entry.key, new ir.PureFunctionParameterExpr(idx), entry.quoted));
        }
    }
    return new ir.PureFunctionExpr(o.literalMap(derivedEntries), nonConstantArgs);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZV9saXRlcmFsX3N0cnVjdHVyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9wdXJlX2xpdGVyYWxfc3RydWN0dXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxHQUFtQjtJQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixFQUFFLENBQUMsd0JBQXdCLENBQ3pCLEVBQUUsRUFDRixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDZCxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyxJQUFJLENBQUM7Z0JBQ2QsQ0FBQztnQkFFRCxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDdkMsT0FBTyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckMsQ0FBQztxQkFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQzVDLE9BQU8sbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25DLENBQUM7Z0JBRUQsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDLEVBQ0QsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FDM0IsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsSUFBd0I7SUFDckQsTUFBTSxjQUFjLEdBQW1CLEVBQUUsQ0FBQztJQUMxQyxNQUFNLGVBQWUsR0FBbUIsRUFBRSxDQUFDO0lBQzNDLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2pDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDdkIsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QixDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sR0FBRyxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUM7WUFDbkMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QixjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0QsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLElBQUksRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDaEYsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsSUFBc0I7SUFDakQsSUFBSSxjQUFjLEdBQXdCLEVBQUUsQ0FBQztJQUM3QyxNQUFNLGVBQWUsR0FBbUIsRUFBRSxDQUFDO0lBQzNDLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2pDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQzdCLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLEdBQUcsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDO1lBQ25DLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xDLGNBQWMsQ0FBQyxJQUFJLENBQ2pCLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FDdEYsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBQ2hGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlUHVyZUxpdGVyYWxTdHJ1Y3R1cmVzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChcbiAgICAgICAgb3AsXG4gICAgICAgIChleHByLCBmbGFncykgPT4ge1xuICAgICAgICAgIGlmIChmbGFncyAmIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEFycmF5RXhwcikge1xuICAgICAgICAgICAgcmV0dXJuIHRyYW5zZm9ybUxpdGVyYWxBcnJheShleHByKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxNYXBFeHByKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJhbnNmb3JtTGl0ZXJhbE1hcChleHByKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgICAgfSxcbiAgICAgICAgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUsXG4gICAgICApO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1MaXRlcmFsQXJyYXkoZXhwcjogby5MaXRlcmFsQXJyYXlFeHByKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgZGVyaXZlZEVudHJpZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGNvbnN0IG5vbkNvbnN0YW50QXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgZm9yIChjb25zdCBlbnRyeSBvZiBleHByLmVudHJpZXMpIHtcbiAgICBpZiAoZW50cnkuaXNDb25zdGFudCgpKSB7XG4gICAgICBkZXJpdmVkRW50cmllcy5wdXNoKGVudHJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaWR4ID0gbm9uQ29uc3RhbnRBcmdzLmxlbmd0aDtcbiAgICAgIG5vbkNvbnN0YW50QXJncy5wdXNoKGVudHJ5KTtcbiAgICAgIGRlcml2ZWRFbnRyaWVzLnB1c2gobmV3IGlyLlB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIoaWR4KSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgaXIuUHVyZUZ1bmN0aW9uRXhwcihvLmxpdGVyYWxBcnIoZGVyaXZlZEVudHJpZXMpLCBub25Db25zdGFudEFyZ3MpO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1MaXRlcmFsTWFwKGV4cHI6IG8uTGl0ZXJhbE1hcEV4cHIpOiBvLkV4cHJlc3Npb24ge1xuICBsZXQgZGVyaXZlZEVudHJpZXM6IG8uTGl0ZXJhbE1hcEVudHJ5W10gPSBbXTtcbiAgY29uc3Qgbm9uQ29uc3RhbnRBcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGVudHJ5IG9mIGV4cHIuZW50cmllcykge1xuICAgIGlmIChlbnRyeS52YWx1ZS5pc0NvbnN0YW50KCkpIHtcbiAgICAgIGRlcml2ZWRFbnRyaWVzLnB1c2goZW50cnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpZHggPSBub25Db25zdGFudEFyZ3MubGVuZ3RoO1xuICAgICAgbm9uQ29uc3RhbnRBcmdzLnB1c2goZW50cnkudmFsdWUpO1xuICAgICAgZGVyaXZlZEVudHJpZXMucHVzaChcbiAgICAgICAgbmV3IG8uTGl0ZXJhbE1hcEVudHJ5KGVudHJ5LmtleSwgbmV3IGlyLlB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIoaWR4KSwgZW50cnkucXVvdGVkKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgaXIuUHVyZUZ1bmN0aW9uRXhwcihvLmxpdGVyYWxNYXAoZGVyaXZlZEVudHJpZXMpLCBub25Db25zdGFudEFyZ3MpO1xufVxuIl19