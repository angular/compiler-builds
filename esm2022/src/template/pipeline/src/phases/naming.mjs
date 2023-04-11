/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Generate names for functions and variables across all views.
 *
 * This includes propagating those names into any `ir.ReadVariableExpr`s of those variables, so that
 * the reads can be emitted correctly.
 */
export function phaseNaming(cpl) {
    // TODO(alxhub): convert this temporary name to match how the `TemplateDefinitionBuilder`
    // names the main component template function.
    cpl.root.fnName = `${cpl.componentName}_Template`;
    for (const [id, view] of cpl.views) {
        let vIndex = 0;
        if (view.fnName === null) {
            // TODO(alxhub): convert this temporary name to match how the `TemplateDefinitionBuilder`
            // names embedded view functions.
            view.fnName = `${cpl.componentName}_EmbeddedView_${id}`;
        }
        // Keep track of the names we assign to variables in the view. We'll need to propagate these
        // into reads of those variables afterwards.
        const varNames = new Map();
        for (const op of view.ops()) {
            switch (op.kind) {
                case ir.OpKind.Listener:
                    if (op.handlerFnName === null) {
                        // TODO(alxhub): convert this temporary name to match how the
                        // `TemplateDefinitionBuilder` names listener functions.
                        op.handlerFnName = `${view.fnName}_${op.name}_listener`;
                    }
                    break;
                case ir.OpKind.Variable:
                    if (op.name === null) {
                        op.name = `_r${vIndex++}`;
                        varNames.set(op.xref, op.name);
                    }
                    break;
            }
        }
        // Having named all variables declared in the view, now we can push those names into the
        // `ir.ReadVariableExpr` expressions which represent reads of those variables.
        for (const op of view.ops()) {
            ir.visitExpressionsInOp(op, expr => {
                if (!(expr instanceof ir.ReadVariableExpr) || expr.name !== null) {
                    return;
                }
                if (!varNames.has(expr.xref)) {
                    throw new Error(`Variable ${expr.xref} not yet named`);
                }
                expr.name = varNames.get(expr.xref);
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBSS9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUF5QjtJQUNuRCx5RkFBeUY7SUFDekYsOENBQThDO0lBQzlDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLGFBQWEsV0FBVyxDQUFDO0lBRWxELEtBQUssTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQ2xDLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztRQUVmLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7WUFDeEIseUZBQXlGO1lBQ3pGLGlDQUFpQztZQUNqQyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLGFBQWEsaUJBQWlCLEVBQUUsRUFBRSxDQUFDO1NBQ3pEO1FBRUQsNEZBQTRGO1FBQzVGLDRDQUE0QztRQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztRQUU5QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7b0JBQ3JCLElBQUksRUFBRSxDQUFDLGFBQWEsS0FBSyxJQUFJLEVBQUU7d0JBQzdCLDZEQUE2RDt3QkFDN0Qsd0RBQXdEO3dCQUN4RCxFQUFFLENBQUMsYUFBYSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsSUFBSSxXQUFXLENBQUM7cUJBQ3pEO29CQUNELE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7b0JBQ3JCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7d0JBQ3BCLEVBQUUsQ0FBQyxJQUFJLEdBQUcsS0FBSyxNQUFNLEVBQUUsRUFBRSxDQUFDO3dCQUMxQixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUNoQztvQkFDRCxNQUFNO2FBQ1Q7U0FDRjtRQUVELHdGQUF3RjtRQUN4Riw4RUFBOEU7UUFDOUUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDM0IsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO29CQUNoRSxPQUFPO2lCQUNSO2dCQUNELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxJQUFJLGdCQUFnQixDQUFDLENBQUM7aUJBQ3hEO2dCQUNELElBQUksQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUM7WUFDdkMsQ0FBQyxDQUFDLENBQUM7U0FDSjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEdlbmVyYXRlIG5hbWVzIGZvciBmdW5jdGlvbnMgYW5kIHZhcmlhYmxlcyBhY3Jvc3MgYWxsIHZpZXdzLlxuICpcbiAqIFRoaXMgaW5jbHVkZXMgcHJvcGFnYXRpbmcgdGhvc2UgbmFtZXMgaW50byBhbnkgYGlyLlJlYWRWYXJpYWJsZUV4cHJgcyBvZiB0aG9zZSB2YXJpYWJsZXMsIHNvIHRoYXRcbiAqIHRoZSByZWFkcyBjYW4gYmUgZW1pdHRlZCBjb3JyZWN0bHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZU5hbWluZyhjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uKTogdm9pZCB7XG4gIC8vIFRPRE8oYWx4aHViKTogY29udmVydCB0aGlzIHRlbXBvcmFyeSBuYW1lIHRvIG1hdGNoIGhvdyB0aGUgYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgXG4gIC8vIG5hbWVzIHRoZSBtYWluIGNvbXBvbmVudCB0ZW1wbGF0ZSBmdW5jdGlvbi5cbiAgY3BsLnJvb3QuZm5OYW1lID0gYCR7Y3BsLmNvbXBvbmVudE5hbWV9X1RlbXBsYXRlYDtcblxuICBmb3IgKGNvbnN0IFtpZCwgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgbGV0IHZJbmRleCA9IDA7XG5cbiAgICBpZiAodmlldy5mbk5hbWUgPT09IG51bGwpIHtcbiAgICAgIC8vIFRPRE8oYWx4aHViKTogY29udmVydCB0aGlzIHRlbXBvcmFyeSBuYW1lIHRvIG1hdGNoIGhvdyB0aGUgYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgXG4gICAgICAvLyBuYW1lcyBlbWJlZGRlZCB2aWV3IGZ1bmN0aW9ucy5cbiAgICAgIHZpZXcuZm5OYW1lID0gYCR7Y3BsLmNvbXBvbmVudE5hbWV9X0VtYmVkZGVkVmlld18ke2lkfWA7XG4gICAgfVxuXG4gICAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmFtZXMgd2UgYXNzaWduIHRvIHZhcmlhYmxlcyBpbiB0aGUgdmlldy4gV2UnbGwgbmVlZCB0byBwcm9wYWdhdGUgdGhlc2VcbiAgICAvLyBpbnRvIHJlYWRzIG9mIHRob3NlIHZhcmlhYmxlcyBhZnRlcndhcmRzLlxuICAgIGNvbnN0IHZhck5hbWVzID0gbmV3IE1hcDxpci5YcmVmSWQsIHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICAgIGlmIChvcC5oYW5kbGVyRm5OYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IGNvbnZlcnQgdGhpcyB0ZW1wb3JhcnkgbmFtZSB0byBtYXRjaCBob3cgdGhlXG4gICAgICAgICAgICAvLyBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgbmFtZXMgbGlzdGVuZXIgZnVuY3Rpb25zLlxuICAgICAgICAgICAgb3AuaGFuZGxlckZuTmFtZSA9IGAke3ZpZXcuZm5OYW1lfV8ke29wLm5hbWV9X2xpc3RlbmVyYDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgICAgIGlmIChvcC5uYW1lID09PSBudWxsKSB7XG4gICAgICAgICAgICBvcC5uYW1lID0gYF9yJHt2SW5kZXgrK31gO1xuICAgICAgICAgICAgdmFyTmFtZXMuc2V0KG9wLnhyZWYsIG9wLm5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIYXZpbmcgbmFtZWQgYWxsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdmlldywgbm93IHdlIGNhbiBwdXNoIHRob3NlIG5hbWVzIGludG8gdGhlXG4gICAgLy8gYGlyLlJlYWRWYXJpYWJsZUV4cHJgIGV4cHJlc3Npb25zIHdoaWNoIHJlcHJlc2VudCByZWFkcyBvZiB0aG9zZSB2YXJpYWJsZXMuXG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3Lm9wcygpKSB7XG4gICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVmFyaWFibGVFeHByKSB8fCBleHByLm5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF2YXJOYW1lcy5oYXMoZXhwci54cmVmKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmFyaWFibGUgJHtleHByLnhyZWZ9IG5vdCB5ZXQgbmFtZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBleHByLm5hbWUgPSB2YXJOYW1lcy5nZXQoZXhwci54cmVmKSE7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==