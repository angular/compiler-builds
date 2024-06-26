import { toPublicName } from '../../../i18n/serializers/xmb';
import * as o from '../../../output/output_ast';
/** Name of the i18n attributes **/
export const I18N_ATTR = 'i18n';
export const I18N_ATTR_PREFIX = 'i18n-';
/** Prefix of var expressions used in ICUs */
export const I18N_ICU_VAR_PREFIX = 'VAR_';
export function isI18nAttribute(name) {
    return name === I18N_ATTR || name.startsWith(I18N_ATTR_PREFIX);
}
export function hasI18nAttrs(element) {
    return element.attrs.some((attr) => isI18nAttribute(attr.name));
}
export function icuFromI18nMessage(message) {
    return message.nodes[0];
}
export function placeholdersToParams(placeholders) {
    const params = {};
    placeholders.forEach((values, key) => {
        params[key] = o.literal(values.length > 1 ? `[${values.join('|')}]` : values[0]);
    });
    return params;
}
/**
 * Format the placeholder names in a map of placeholders to expressions.
 *
 * The placeholder names are converted from "internal" format (e.g. `START_TAG_DIV_1`) to "external"
 * format (e.g. `startTagDiv_1`).
 *
 * @param params A map of placeholder names to expressions.
 * @param useCamelCase whether to camelCase the placeholder name when formatting.
 * @returns A new map of formatted placeholder names to expressions.
 */
export function formatI18nPlaceholderNamesInMap(params = {}, useCamelCase) {
    const _params = {};
    if (params && Object.keys(params).length) {
        Object.keys(params).forEach((key) => (_params[formatI18nPlaceholderName(key, useCamelCase)] = params[key]));
    }
    return _params;
}
/**
 * Converts internal placeholder names to public-facing format
 * (for example to use in goog.getMsg call).
 * Example: `START_TAG_DIV_1` is converted to `startTagDiv_1`.
 *
 * @param name The placeholder name that should be formatted
 * @returns Formatted placeholder name
 */
export function formatI18nPlaceholderName(name, useCamelCase = true) {
    const publicName = toPublicName(name);
    if (!useCamelCase) {
        return publicName;
    }
    const chunks = publicName.split('_');
    if (chunks.length === 1) {
        // if no "_" found - just lowercase the value
        return name.toLowerCase();
    }
    let postfix;
    // eject last element if it's a number
    if (/^\d+$/.test(chunks[chunks.length - 1])) {
        postfix = chunks.pop();
    }
    let raw = chunks.shift().toLowerCase();
    if (chunks.length) {
        raw += chunks.map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()).join('');
    }
    return postfix ? `${raw}_${postfix}` : raw;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUUzRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBRWhELG1DQUFtQztBQUNuQyxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDO0FBQ2hDLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLE9BQU8sQ0FBQztBQUV4Qyw2Q0FBNkM7QUFDN0MsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsTUFBTSxDQUFDO0FBRTFDLE1BQU0sVUFBVSxlQUFlLENBQUMsSUFBWTtJQUMxQyxPQUFPLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ2pFLENBQUM7QUFFRCxNQUFNLFVBQVUsWUFBWSxDQUFDLE9BQXFCO0lBQ2hELE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFvQixFQUFFLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQztBQUVELE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxPQUFxQjtJQUN0RCxPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUF3QixDQUFDO0FBQ2pELENBQUM7QUFFRCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsWUFBbUM7SUFHdEUsTUFBTSxNQUFNLEdBQW9DLEVBQUUsQ0FBQztJQUNuRCxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBZ0IsRUFBRSxHQUFXLEVBQUUsRUFBRTtRQUNyRCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVEOzs7Ozs7Ozs7R0FTRztBQUNILE1BQU0sVUFBVSwrQkFBK0IsQ0FDN0MsU0FBeUMsRUFBRSxFQUMzQyxZQUFxQjtJQUVyQixNQUFNLE9BQU8sR0FBa0MsRUFBRSxDQUFDO0lBQ2xELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDekMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQ3pCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUUsWUFBWSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FDL0UsQ0FBQztJQUNKLENBQUM7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxJQUFZLEVBQUUsZUFBd0IsSUFBSTtJQUNsRixNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2xCLE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7SUFDRCxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN4Qiw2Q0FBNkM7UUFDN0MsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDNUIsQ0FBQztJQUNELElBQUksT0FBTyxDQUFDO0lBQ1osc0NBQXNDO0lBQ3RDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDNUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBQ0QsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3hDLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2xCLEdBQUcsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUNELE9BQU8sT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge3RvUHVibGljTmFtZX0gZnJvbSAnLi4vLi4vLi4vaTE4bi9zZXJpYWxpemVycy94bWInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgaTE4biBhdHRyaWJ1dGVzICoqL1xuZXhwb3J0IGNvbnN0IEkxOE5fQVRUUiA9ICdpMThuJztcbmV4cG9ydCBjb25zdCBJMThOX0FUVFJfUFJFRklYID0gJ2kxOG4tJztcblxuLyoqIFByZWZpeCBvZiB2YXIgZXhwcmVzc2lvbnMgdXNlZCBpbiBJQ1VzICovXG5leHBvcnQgY29uc3QgSTE4Tl9JQ1VfVkFSX1BSRUZJWCA9ICdWQVJfJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzSTE4bkF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09IEkxOE5fQVRUUiB8fCBuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNJMThuQXR0cnMoZWxlbWVudDogaHRtbC5FbGVtZW50KTogYm9vbGVhbiB7XG4gIHJldHVybiBlbGVtZW50LmF0dHJzLnNvbWUoKGF0dHI6IGh0bWwuQXR0cmlidXRlKSA9PiBpc0kxOG5BdHRyaWJ1dGUoYXR0ci5uYW1lKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlKSB7XG4gIHJldHVybiBtZXNzYWdlLm5vZGVzWzBdIGFzIGkxOG4uSWN1UGxhY2Vob2xkZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnM6IE1hcDxzdHJpbmcsIHN0cmluZ1tdPik6IHtcbiAgW25hbWU6IHN0cmluZ106IG8uTGl0ZXJhbEV4cHI7XG59IHtcbiAgY29uc3QgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uTGl0ZXJhbEV4cHJ9ID0ge307XG4gIHBsYWNlaG9sZGVycy5mb3JFYWNoKCh2YWx1ZXM6IHN0cmluZ1tdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHZhbHVlcy5sZW5ndGggPiAxID8gYFske3ZhbHVlcy5qb2luKCd8Jyl9XWAgOiB2YWx1ZXNbMF0pO1xuICB9KTtcbiAgcmV0dXJuIHBhcmFtcztcbn1cblxuLyoqXG4gKiBGb3JtYXQgdGhlIHBsYWNlaG9sZGVyIG5hbWVzIGluIGEgbWFwIG9mIHBsYWNlaG9sZGVycyB0byBleHByZXNzaW9ucy5cbiAqXG4gKiBUaGUgcGxhY2Vob2xkZXIgbmFtZXMgYXJlIGNvbnZlcnRlZCBmcm9tIFwiaW50ZXJuYWxcIiBmb3JtYXQgKGUuZy4gYFNUQVJUX1RBR19ESVZfMWApIHRvIFwiZXh0ZXJuYWxcIlxuICogZm9ybWF0IChlLmcuIGBzdGFydFRhZ0Rpdl8xYCkuXG4gKlxuICogQHBhcmFtIHBhcmFtcyBBIG1hcCBvZiBwbGFjZWhvbGRlciBuYW1lcyB0byBleHByZXNzaW9ucy5cbiAqIEBwYXJhbSB1c2VDYW1lbENhc2Ugd2hldGhlciB0byBjYW1lbENhc2UgdGhlIHBsYWNlaG9sZGVyIG5hbWUgd2hlbiBmb3JtYXR0aW5nLlxuICogQHJldHVybnMgQSBuZXcgbWFwIG9mIGZvcm1hdHRlZCBwbGFjZWhvbGRlciBuYW1lcyB0byBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAoXG4gIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sXG4gIHVzZUNhbWVsQ2FzZTogYm9vbGVhbixcbikge1xuICBjb25zdCBfcGFyYW1zOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICBpZiAocGFyYW1zICYmIE9iamVjdC5rZXlzKHBhcmFtcykubGVuZ3RoKSB7XG4gICAgT2JqZWN0LmtleXMocGFyYW1zKS5mb3JFYWNoKFxuICAgICAgKGtleSkgPT4gKF9wYXJhbXNbZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZShrZXksIHVzZUNhbWVsQ2FzZSldID0gcGFyYW1zW2tleV0pLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIF9wYXJhbXM7XG59XG5cbi8qKlxuICogQ29udmVydHMgaW50ZXJuYWwgcGxhY2Vob2xkZXIgbmFtZXMgdG8gcHVibGljLWZhY2luZyBmb3JtYXRcbiAqIChmb3IgZXhhbXBsZSB0byB1c2UgaW4gZ29vZy5nZXRNc2cgY2FsbCkuXG4gKiBFeGFtcGxlOiBgU1RBUlRfVEFHX0RJVl8xYCBpcyBjb252ZXJ0ZWQgdG8gYHN0YXJ0VGFnRGl2XzFgLlxuICpcbiAqIEBwYXJhbSBuYW1lIFRoZSBwbGFjZWhvbGRlciBuYW1lIHRoYXQgc2hvdWxkIGJlIGZvcm1hdHRlZFxuICogQHJldHVybnMgRm9ybWF0dGVkIHBsYWNlaG9sZGVyIG5hbWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWUobmFtZTogc3RyaW5nLCB1c2VDYW1lbENhc2U6IGJvb2xlYW4gPSB0cnVlKTogc3RyaW5nIHtcbiAgY29uc3QgcHVibGljTmFtZSA9IHRvUHVibGljTmFtZShuYW1lKTtcbiAgaWYgKCF1c2VDYW1lbENhc2UpIHtcbiAgICByZXR1cm4gcHVibGljTmFtZTtcbiAgfVxuICBjb25zdCBjaHVua3MgPSBwdWJsaWNOYW1lLnNwbGl0KCdfJyk7XG4gIGlmIChjaHVua3MubGVuZ3RoID09PSAxKSB7XG4gICAgLy8gaWYgbm8gXCJfXCIgZm91bmQgLSBqdXN0IGxvd2VyY2FzZSB0aGUgdmFsdWVcbiAgICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpO1xuICB9XG4gIGxldCBwb3N0Zml4O1xuICAvLyBlamVjdCBsYXN0IGVsZW1lbnQgaWYgaXQncyBhIG51bWJlclxuICBpZiAoL15cXGQrJC8udGVzdChjaHVua3NbY2h1bmtzLmxlbmd0aCAtIDFdKSkge1xuICAgIHBvc3RmaXggPSBjaHVua3MucG9wKCk7XG4gIH1cbiAgbGV0IHJhdyA9IGNodW5rcy5zaGlmdCgpIS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoY2h1bmtzLmxlbmd0aCkge1xuICAgIHJhdyArPSBjaHVua3MubWFwKChjKSA9PiBjLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgYy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpKS5qb2luKCcnKTtcbiAgfVxuICByZXR1cm4gcG9zdGZpeCA/IGAke3Jhd31fJHtwb3N0Zml4fWAgOiByYXc7XG59XG4iXX0=