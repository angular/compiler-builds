/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Updates i18n expression ops to depend on the last slot in their owning i18n block.
 */
export function phaseAssignI18nSlotDependencies(job) {
    const i18nLastSlotConsumers = new Map();
    let lastSlotConsumer = null;
    for (const unit of job.units) {
        // Record the last consumed slot before each i18n end instruction.
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nEnd) {
                i18nLastSlotConsumers.set(op.xref, lastSlotConsumer);
            }
            if (ir.hasConsumesSlotTrait(op)) {
                lastSlotConsumer = op.xref;
            }
        }
        // Assign i18n expressions to target the last slot in its owning block.
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                op.target = i18nLastSlotConsumers.get(op.owner);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSwrQkFBK0IsQ0FBQyxHQUFtQjtJQUNqRSxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO0lBQzlELElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO0lBQzVCLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixrRUFBa0U7UUFDbEUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtnQkFDakMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsZ0JBQWlCLENBQUMsQ0FBQzthQUN2RDtZQUNELElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixnQkFBZ0IsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO2FBQzVCO1NBQ0Y7UUFFRCx1RUFBdUU7UUFDdkUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtnQkFDeEMsRUFBRSxDQUFDLE1BQU0sR0FBRyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBRSxDQUFDO2FBQ2xEO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFVwZGF0ZXMgaTE4biBleHByZXNzaW9uIG9wcyB0byBkZXBlbmQgb24gdGhlIGxhc3Qgc2xvdCBpbiB0aGVpciBvd25pbmcgaTE4biBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQXNzaWduSTE4blNsb3REZXBlbmRlbmNpZXMoam9iOiBDb21waWxhdGlvbkpvYikge1xuICBjb25zdCBpMThuTGFzdFNsb3RDb25zdW1lcnMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuWHJlZklkPigpO1xuICBsZXQgbGFzdFNsb3RDb25zdW1lciA9IG51bGw7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBSZWNvcmQgdGhlIGxhc3QgY29uc3VtZWQgc2xvdCBiZWZvcmUgZWFjaCBpMThuIGVuZCBpbnN0cnVjdGlvbi5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FbmQpIHtcbiAgICAgICAgaTE4bkxhc3RTbG90Q29uc3VtZXJzLnNldChvcC54cmVmLCBsYXN0U2xvdENvbnN1bWVyISk7XG4gICAgICB9XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNTbG90VHJhaXQob3ApKSB7XG4gICAgICAgIGxhc3RTbG90Q29uc3VtZXIgPSBvcC54cmVmO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFzc2lnbiBpMThuIGV4cHJlc3Npb25zIHRvIHRhcmdldCB0aGUgbGFzdCBzbG90IGluIGl0cyBvd25pbmcgYmxvY2suXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgICAgICBvcC50YXJnZXQgPSBpMThuTGFzdFNsb3RDb25zdW1lcnMuZ2V0KG9wLm93bmVyKSE7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=