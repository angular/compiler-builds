/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../../../../i18n/i18n_ast';
import * as ir from '../../ir';
/**
 * Extracts ICUs into i18n expressions.
 */
export function phaseIcuExtraction(job) {
    for (const unit of job.units) {
        // Build a map of ICU to the i18n block they belong to, then remove the `Icu` ops.
        const icus = new Map();
        let currentI18nId = null;
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nId = op.xref;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nId = null;
                    break;
                case ir.OpKind.Icu:
                    if (currentI18nId === null) {
                        throw Error('Unexpected ICU outside of an i18n block.');
                    }
                    icus.set(op.xref, { message: op.message, i18nBlockId: currentI18nId });
                    ir.OpList.remove(op);
                    break;
            }
        }
        // Replace the `IcuUpdate` ops with `i18nExpr` ops.
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.IcuUpdate:
                    const { message, i18nBlockId } = icus.get(op.xref);
                    const icuNode = message.nodes.find((n) => n instanceof i18n.Icu);
                    if (icuNode === undefined) {
                        throw Error('Could not find ICU in i18n AST');
                    }
                    if (icuNode.expressionPlaceholder === undefined) {
                        throw Error('ICU is missing an i18n placeholder');
                    }
                    ir.OpList.replace(op, ir.createI18nExpressionOp(i18nBlockId, new ir.LexicalReadExpr(icuNode.expression), icuNode.expressionPlaceholder, ir.I18nParamResolutionTime.Postproccessing, null));
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWN1X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pY3VfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssSUFBSSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLEdBQW1CO0lBQ3BELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixrRkFBa0Y7UUFDbEYsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQThELENBQUM7UUFDbkYsSUFBSSxhQUFhLEdBQW1CLElBQUksQ0FBQztRQUN6QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixhQUFhLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztvQkFDeEIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTztvQkFDcEIsYUFBYSxHQUFHLElBQUksQ0FBQztvQkFDckIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRztvQkFDaEIsSUFBSSxhQUFhLEtBQUssSUFBSSxFQUFFO3dCQUMxQixNQUFNLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO3FCQUN6RDtvQkFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFDLENBQUMsQ0FBQztvQkFDckUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7b0JBQ2xDLE1BQU07YUFDVDtTQUNGO1FBRUQsbURBQW1EO1FBQ25ELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLE1BQU0sRUFBQyxPQUFPLEVBQUUsV0FBVyxFQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7b0JBQ2xELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFpQixFQUFFLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDaEYsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFO3dCQUN6QixNQUFNLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO3FCQUMvQztvQkFDRCxJQUFJLE9BQU8sQ0FBQyxxQkFBcUIsS0FBSyxTQUFTLEVBQUU7d0JBQy9DLE1BQU0sS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7cUJBQ25EO29CQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUNiLEVBQUUsRUFDRixFQUFFLENBQUMsc0JBQXNCLENBQ3JCLFdBQVcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUN2RCxPQUFPLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsRUFDekUsSUFBSyxDQUFDLENBQUMsQ0FBQztvQkFDaEIsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBFeHRyYWN0cyBJQ1VzIGludG8gaTE4biBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlSWN1RXh0cmFjdGlvbihqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBCdWlsZCBhIG1hcCBvZiBJQ1UgdG8gdGhlIGkxOG4gYmxvY2sgdGhleSBiZWxvbmcgdG8sIHRoZW4gcmVtb3ZlIHRoZSBgSWN1YCBvcHMuXG4gICAgY29uc3QgaWN1cyA9IG5ldyBNYXA8aXIuWHJlZklkLCB7bWVzc2FnZTogaTE4bi5NZXNzYWdlLCBpMThuQmxvY2tJZDogaXIuWHJlZklkfT4oKTtcbiAgICBsZXQgY3VycmVudEkxOG5JZDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgY3VycmVudEkxOG5JZCA9IG9wLnhyZWY7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG5JZCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdTpcbiAgICAgICAgICBpZiAoY3VycmVudEkxOG5JZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgSUNVIG91dHNpZGUgb2YgYW4gaTE4biBibG9jay4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWN1cy5zZXQob3AueHJlZiwge21lc3NhZ2U6IG9wLm1lc3NhZ2UsIGkxOG5CbG9ja0lkOiBjdXJyZW50STE4bklkfSk7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlcGxhY2UgdGhlIGBJY3VVcGRhdGVgIG9wcyB3aXRoIGBpMThuRXhwcmAgb3BzLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VVcGRhdGU6XG4gICAgICAgICAgY29uc3Qge21lc3NhZ2UsIGkxOG5CbG9ja0lkfSA9IGljdXMuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgICBjb25zdCBpY3VOb2RlID0gbWVzc2FnZS5ub2Rlcy5maW5kKChuKTogbiBpcyBpMThuLkljdSA9PiBuIGluc3RhbmNlb2YgaTE4bi5JY3UpO1xuICAgICAgICAgIGlmIChpY3VOb2RlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBJQ1UgaW4gaTE4biBBU1QnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGljdU5vZGUuZXhwcmVzc2lvblBsYWNlaG9sZGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdJQ1UgaXMgbWlzc2luZyBhbiBpMThuIHBsYWNlaG9sZGVyJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlPGlyLlVwZGF0ZU9wPihcbiAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgIGlyLmNyZWF0ZUkxOG5FeHByZXNzaW9uT3AoXG4gICAgICAgICAgICAgICAgICBpMThuQmxvY2tJZCwgbmV3IGlyLkxleGljYWxSZWFkRXhwcihpY3VOb2RlLmV4cHJlc3Npb24pLFxuICAgICAgICAgICAgICAgICAgaWN1Tm9kZS5leHByZXNzaW9uUGxhY2Vob2xkZXIsIGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLlBvc3Rwcm9jY2Vzc2luZyxcbiAgICAgICAgICAgICAgICAgIG51bGwhKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=