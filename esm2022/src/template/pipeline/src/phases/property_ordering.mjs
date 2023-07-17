/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Defines the groups based on `OpKind` that ops will be divided into. Ops will be collected into
 * groups, then optionally transformed, before recombining the groups in the order defined here.
 */
const ORDERING = [
    { kinds: new Set([ir.OpKind.StyleMap, ir.OpKind.InterpolateStyleMap]), transform: keepLast },
    { kinds: new Set([ir.OpKind.ClassMap, ir.OpKind.InterpolateClassMap]), transform: keepLast },
    { kinds: new Set([ir.OpKind.StyleProp, ir.OpKind.InterpolateStyleProp]) },
    { kinds: new Set([ir.OpKind.ClassProp]) },
    { kinds: new Set([ir.OpKind.InterpolateProperty]) },
    { kinds: new Set([ir.OpKind.Property]) },
    { kinds: new Set([ir.OpKind.Attribute, ir.OpKind.InterpolateAttribute]) },
];
/**
 * The set of all op kinds we handle in the reordering phase.
 */
const handledOpKinds = new Set(ORDERING.flatMap(group => [...group.kinds]));
/**
 * Reorders property and attribute ops according to the following ordering:
 * 1. styleMap & styleMapInterpolate (drops all but the last op in the group)
 * 2. classMap & classMapInterpolate (drops all but the last op in the group)
 * 3. styleProp & stylePropInterpolate (ordering preserved within group)
 * 4. classProp (ordering preserved within group)
 * 5. propertyInterpolate (ordering preserved within group)
 * 6. property (ordering preserved within group)
 * 7. attribute & attributeInterpolate (ordering preserve within group)
 */
export function phasePropertyOrdering(cpl) {
    for (const [_, view] of cpl.views) {
        let opsToOrder = [];
        for (const op of view.update) {
            if (handledOpKinds.has(op.kind)) {
                // Pull out ops that need o be ordered.
                opsToOrder.push(op);
                ir.OpList.remove(op);
            }
            else {
                // When we encounter an op that shouldn't be reordered, put the ones we've pulled so far
                // back in the correct order.
                for (const orderedOp of reorder(opsToOrder)) {
                    ir.OpList.insertBefore(orderedOp, op);
                }
                opsToOrder = [];
            }
        }
        // If we still have ops pulled at the end, put them back in the correct order.
        for (const orderedOp of reorder(opsToOrder)) {
            view.update.push(orderedOp);
        }
    }
}
/**
 * Reorders the given list of ops according to the ordering defined by `ORDERING`.
 */
function reorder(ops) {
    // Break the ops list into groups based on OpKind.
    const groups = Array.from(ORDERING, () => new Array());
    for (const op of ops) {
        const groupIndex = ORDERING.findIndex(o => o.kinds.has(op.kind));
        groups[groupIndex].push(op);
    }
    // Reassemble the groups into a single list, in the correct order.
    return groups.flatMap((group, i) => {
        const transform = ORDERING[i].transform;
        return transform ? transform(group) : group;
    });
}
/**
 * Keeps only the last op in a list of ops.
 */
function keepLast(ops) {
    return ops.slice(ops.length - 1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGVydHlfb3JkZXJpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9wcm9wZXJ0eV9vcmRlcmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7O0dBR0c7QUFDSCxNQUFNLFFBQVEsR0FJVjtJQUNFLEVBQUMsS0FBSyxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBQztJQUMxRixFQUFDLEtBQUssRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUM7SUFDMUYsRUFBQyxLQUFLLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUMsRUFBQztJQUN2RSxFQUFDLEtBQUssRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQztJQUN2QyxFQUFDLEtBQUssRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxFQUFDO0lBQ2pELEVBQUMsS0FBSyxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFDO0lBQ3RDLEVBQUMsS0FBSyxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUM7Q0FDeEUsQ0FBQztBQUVOOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTVFOzs7Ozs7Ozs7R0FTRztBQUNILE1BQU0sVUFBVSxxQkFBcUIsQ0FBQyxHQUF5QjtJQUM3RCxLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNqQyxJQUFJLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDcEIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQy9CLHVDQUF1QztnQkFDdkMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDcEIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDdEI7aUJBQU07Z0JBQ0wsd0ZBQXdGO2dCQUN4Riw2QkFBNkI7Z0JBQzdCLEtBQUssTUFBTSxTQUFTLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFO29CQUMzQyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7aUJBQ3ZDO2dCQUNELFVBQVUsR0FBRyxFQUFFLENBQUM7YUFDakI7U0FDRjtRQUNELDhFQUE4RTtRQUM5RSxLQUFLLE1BQU0sU0FBUyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUMzQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUF3QixDQUFDLENBQUM7U0FDNUM7S0FDRjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsT0FBTyxDQUFDLEdBQW1DO0lBQ2xELGtEQUFrRDtJQUNsRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBMkIsQ0FBQyxDQUFDO0lBQ2hGLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFO1FBQ3BCLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNqRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQzdCO0lBQ0Qsa0VBQWtFO0lBQ2xFLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNqQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3hDLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUM5QyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsUUFBUSxDQUFDLEdBQW1DO0lBQ25ELE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ25DLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIERlZmluZXMgdGhlIGdyb3VwcyBiYXNlZCBvbiBgT3BLaW5kYCB0aGF0IG9wcyB3aWxsIGJlIGRpdmlkZWQgaW50by4gT3BzIHdpbGwgYmUgY29sbGVjdGVkIGludG9cbiAqIGdyb3VwcywgdGhlbiBvcHRpb25hbGx5IHRyYW5zZm9ybWVkLCBiZWZvcmUgcmVjb21iaW5pbmcgdGhlIGdyb3VwcyBpbiB0aGUgb3JkZXIgZGVmaW5lZCBoZXJlLlxuICovXG5jb25zdCBPUkRFUklORzoge1xuICBraW5kczogU2V0PGlyLk9wS2luZD4sXG4gIHRyYW5zZm9ybT86IChvcHM6IEFycmF5PGlyLlVwZGF0ZU9wfGlyLkNyZWF0ZU9wPikgPT4gQXJyYXk8aXIuVXBkYXRlT3B8aXIuQ3JlYXRlT3A+XG59W10gPVxuICAgIFtcbiAgICAgIHtraW5kczogbmV3IFNldChbaXIuT3BLaW5kLlN0eWxlTWFwLCBpci5PcEtpbmQuSW50ZXJwb2xhdGVTdHlsZU1hcF0pLCB0cmFuc2Zvcm06IGtlZXBMYXN0fSxcbiAgICAgIHtraW5kczogbmV3IFNldChbaXIuT3BLaW5kLkNsYXNzTWFwLCBpci5PcEtpbmQuSW50ZXJwb2xhdGVDbGFzc01hcF0pLCB0cmFuc2Zvcm06IGtlZXBMYXN0fSxcbiAgICAgIHtraW5kczogbmV3IFNldChbaXIuT3BLaW5kLlN0eWxlUHJvcCwgaXIuT3BLaW5kLkludGVycG9sYXRlU3R5bGVQcm9wXSl9LFxuICAgICAge2tpbmRzOiBuZXcgU2V0KFtpci5PcEtpbmQuQ2xhc3NQcm9wXSl9LFxuICAgICAge2tpbmRzOiBuZXcgU2V0KFtpci5PcEtpbmQuSW50ZXJwb2xhdGVQcm9wZXJ0eV0pfSxcbiAgICAgIHtraW5kczogbmV3IFNldChbaXIuT3BLaW5kLlByb3BlcnR5XSl9LFxuICAgICAge2tpbmRzOiBuZXcgU2V0KFtpci5PcEtpbmQuQXR0cmlidXRlLCBpci5PcEtpbmQuSW50ZXJwb2xhdGVBdHRyaWJ1dGVdKX0sXG4gICAgXTtcblxuLyoqXG4gKiBUaGUgc2V0IG9mIGFsbCBvcCBraW5kcyB3ZSBoYW5kbGUgaW4gdGhlIHJlb3JkZXJpbmcgcGhhc2UuXG4gKi9cbmNvbnN0IGhhbmRsZWRPcEtpbmRzID0gbmV3IFNldChPUkRFUklORy5mbGF0TWFwKGdyb3VwID0+IFsuLi5ncm91cC5raW5kc10pKTtcblxuLyoqXG4gKiBSZW9yZGVycyBwcm9wZXJ0eSBhbmQgYXR0cmlidXRlIG9wcyBhY2NvcmRpbmcgdG8gdGhlIGZvbGxvd2luZyBvcmRlcmluZzpcbiAqIDEuIHN0eWxlTWFwICYgc3R5bGVNYXBJbnRlcnBvbGF0ZSAoZHJvcHMgYWxsIGJ1dCB0aGUgbGFzdCBvcCBpbiB0aGUgZ3JvdXApXG4gKiAyLiBjbGFzc01hcCAmIGNsYXNzTWFwSW50ZXJwb2xhdGUgKGRyb3BzIGFsbCBidXQgdGhlIGxhc3Qgb3AgaW4gdGhlIGdyb3VwKVxuICogMy4gc3R5bGVQcm9wICYgc3R5bGVQcm9wSW50ZXJwb2xhdGUgKG9yZGVyaW5nIHByZXNlcnZlZCB3aXRoaW4gZ3JvdXApXG4gKiA0LiBjbGFzc1Byb3AgKG9yZGVyaW5nIHByZXNlcnZlZCB3aXRoaW4gZ3JvdXApXG4gKiA1LiBwcm9wZXJ0eUludGVycG9sYXRlIChvcmRlcmluZyBwcmVzZXJ2ZWQgd2l0aGluIGdyb3VwKVxuICogNi4gcHJvcGVydHkgKG9yZGVyaW5nIHByZXNlcnZlZCB3aXRoaW4gZ3JvdXApXG4gKiA3LiBhdHRyaWJ1dGUgJiBhdHRyaWJ1dGVJbnRlcnBvbGF0ZSAob3JkZXJpbmcgcHJlc2VydmUgd2l0aGluIGdyb3VwKVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VQcm9wZXJ0eU9yZGVyaW5nKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pIHtcbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgbGV0IG9wc1RvT3JkZXIgPSBbXTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcudXBkYXRlKSB7XG4gICAgICBpZiAoaGFuZGxlZE9wS2luZHMuaGFzKG9wLmtpbmQpKSB7XG4gICAgICAgIC8vIFB1bGwgb3V0IG9wcyB0aGF0IG5lZWQgbyBiZSBvcmRlcmVkLlxuICAgICAgICBvcHNUb09yZGVyLnB1c2gob3ApO1xuICAgICAgICBpci5PcExpc3QucmVtb3ZlKG9wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdoZW4gd2UgZW5jb3VudGVyIGFuIG9wIHRoYXQgc2hvdWxkbid0IGJlIHJlb3JkZXJlZCwgcHV0IHRoZSBvbmVzIHdlJ3ZlIHB1bGxlZCBzbyBmYXJcbiAgICAgICAgLy8gYmFjayBpbiB0aGUgY29ycmVjdCBvcmRlci5cbiAgICAgICAgZm9yIChjb25zdCBvcmRlcmVkT3Agb2YgcmVvcmRlcihvcHNUb09yZGVyKSkge1xuICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmUob3JkZXJlZE9wLCBvcCk7XG4gICAgICAgIH1cbiAgICAgICAgb3BzVG9PcmRlciA9IFtdO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBJZiB3ZSBzdGlsbCBoYXZlIG9wcyBwdWxsZWQgYXQgdGhlIGVuZCwgcHV0IHRoZW0gYmFjayBpbiB0aGUgY29ycmVjdCBvcmRlci5cbiAgICBmb3IgKGNvbnN0IG9yZGVyZWRPcCBvZiByZW9yZGVyKG9wc1RvT3JkZXIpKSB7XG4gICAgICB2aWV3LnVwZGF0ZS5wdXNoKG9yZGVyZWRPcCBhcyBpci5VcGRhdGVPcCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmVvcmRlcnMgdGhlIGdpdmVuIGxpc3Qgb2Ygb3BzIGFjY29yZGluZyB0byB0aGUgb3JkZXJpbmcgZGVmaW5lZCBieSBgT1JERVJJTkdgLlxuICovXG5mdW5jdGlvbiByZW9yZGVyKG9wczogQXJyYXk8aXIuVXBkYXRlT3B8aXIuQ3JlYXRlT3A+KTogQXJyYXk8aXIuVXBkYXRlT3B8aXIuQ3JlYXRlT3A+IHtcbiAgLy8gQnJlYWsgdGhlIG9wcyBsaXN0IGludG8gZ3JvdXBzIGJhc2VkIG9uIE9wS2luZC5cbiAgY29uc3QgZ3JvdXBzID0gQXJyYXkuZnJvbShPUkRFUklORywgKCkgPT4gbmV3IEFycmF5PGlyLlVwZGF0ZU9wfGlyLkNyZWF0ZU9wPigpKTtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBjb25zdCBncm91cEluZGV4ID0gT1JERVJJTkcuZmluZEluZGV4KG8gPT4gby5raW5kcy5oYXMob3Aua2luZCkpO1xuICAgIGdyb3Vwc1tncm91cEluZGV4XS5wdXNoKG9wKTtcbiAgfVxuICAvLyBSZWFzc2VtYmxlIHRoZSBncm91cHMgaW50byBhIHNpbmdsZSBsaXN0LCBpbiB0aGUgY29ycmVjdCBvcmRlci5cbiAgcmV0dXJuIGdyb3Vwcy5mbGF0TWFwKChncm91cCwgaSkgPT4ge1xuICAgIGNvbnN0IHRyYW5zZm9ybSA9IE9SREVSSU5HW2ldLnRyYW5zZm9ybTtcbiAgICByZXR1cm4gdHJhbnNmb3JtID8gdHJhbnNmb3JtKGdyb3VwKSA6IGdyb3VwO1xuICB9KTtcbn1cblxuLyoqXG4gKiBLZWVwcyBvbmx5IHRoZSBsYXN0IG9wIGluIGEgbGlzdCBvZiBvcHMuXG4gKi9cbmZ1bmN0aW9uIGtlZXBMYXN0KG9wczogQXJyYXk8aXIuVXBkYXRlT3B8aXIuQ3JlYXRlT3A+KSB7XG4gIHJldHVybiBvcHMuc2xpY2Uob3BzLmxlbmd0aCAtIDEpO1xufVxuIl19