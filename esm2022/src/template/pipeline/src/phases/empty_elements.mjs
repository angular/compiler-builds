/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Replace sequences of `ElementStart` followed by `ElementEnd` with a condensed `Element`
 * instruction.
 */
export function phaseEmptyElements(cpl) {
    for (const [_, view] of cpl.views) {
        for (const op of view.create) {
            if (op.kind === ir.OpKind.ElementEnd && op.prev !== null &&
                op.prev.kind === ir.OpKind.ElementStart) {
                // Transmute the `ElementStart` instruction to `Element`. This is safe as they're designed
                // to be identical apart from the `kind`.
                op.prev.kind = ir.OpKind.Element;
                // Remove the `ElementEnd` instruction.
                ir.OpList.remove(op);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1wdHlfZWxlbWVudHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9lbXB0eV9lbGVtZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBeUI7SUFDMUQsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUk7Z0JBQ3BELEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFO2dCQUMzQywwRkFBMEY7Z0JBQzFGLHlDQUF5QztnQkFDeEMsRUFBRSxDQUFDLElBQWdDLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO2dCQUU5RCx1Q0FBdUM7Z0JBQ3ZDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO2FBQ25DO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlcGxhY2Ugc2VxdWVuY2VzIG9mIGBFbGVtZW50U3RhcnRgIGZvbGxvd2VkIGJ5IGBFbGVtZW50RW5kYCB3aXRoIGEgY29uZGVuc2VkIGBFbGVtZW50YFxuICogaW5zdHJ1Y3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUVtcHR5RWxlbWVudHMoY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtfLCB2aWV3XSBvZiBjcGwudmlld3MpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkVsZW1lbnRFbmQgJiYgb3AucHJldiAhPT0gbnVsbCAmJlxuICAgICAgICAgIG9wLnByZXYua2luZCA9PT0gaXIuT3BLaW5kLkVsZW1lbnRTdGFydCkge1xuICAgICAgICAvLyBUcmFuc211dGUgdGhlIGBFbGVtZW50U3RhcnRgIGluc3RydWN0aW9uIHRvIGBFbGVtZW50YC4gVGhpcyBpcyBzYWZlIGFzIHRoZXkncmUgZGVzaWduZWRcbiAgICAgICAgLy8gdG8gYmUgaWRlbnRpY2FsIGFwYXJ0IGZyb20gdGhlIGBraW5kYC5cbiAgICAgICAgKG9wLnByZXYgYXMgdW5rbm93biBhcyBpci5FbGVtZW50T3ApLmtpbmQgPSBpci5PcEtpbmQuRWxlbWVudDtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIGBFbGVtZW50RW5kYCBpbnN0cnVjdGlvbi5cbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19