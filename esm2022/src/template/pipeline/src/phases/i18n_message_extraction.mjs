/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../../../../i18n/i18n_ast';
import * as o from '../../../../output/output_ast';
import { sanitizeIdentifier } from '../../../../parse_util';
import { createGoogleGetMsgStatements } from '../../../../render3/view/i18n/get_msg_utils';
import { createLocalizeStatements } from '../../../../render3/view/i18n/localize_utils';
import { declareI18nVariable, formatI18nPlaceholderNamesInMap, getTranslationConstPrefix } from '../../../../render3/view/i18n/util';
import * as ir from '../../ir';
/** Name of the global variable that is used to determine if we use Closure translations or not */
const NG_I18N_CLOSURE_MODE = 'ngI18nClosureMode';
/**
 * Prefix for non-`goog.getMsg` i18n-related vars.
 * Note: the prefix uses lowercase characters intentionally due to a Closure behavior that
 * considers variables like `I18N_0` as constants and throws an error when their value changes.
 */
export const TRANSLATION_VAR_PREFIX = 'i18n_';
/** Extracts i18n messages into the consts array. */
export function phaseI18nMessageExtraction(job) {
    const fileBasedI18nSuffix = job.relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + '_';
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart && op.i18n instanceof i18n.Message) {
                const params = op.tagNameParams;
                const mainVar = o.variable(job.pool.uniqueName(TRANSLATION_VAR_PREFIX));
                // Closure Compiler requires const names to start with `MSG_` but disallows any other const
                // to start with `MSG_`. We define a variable starting with `MSG_` just for the
                // `goog.getMsg` call
                const closureVar = i18nGenerateClosureVar(job.pool, op.i18n.id, fileBasedI18nSuffix, job.i18nUseExternalIds);
                // TODO: figure out transformFn.
                const statements = getTranslationDeclStmts(op.i18n, mainVar, closureVar, params, undefined /*transformFn*/);
                unit.create.push(ir.createExtractedMessageOp(op.xref, mainVar, statements));
            }
        }
    }
}
/**
 * Generate statements that define a given translation message.
 *
 * ```
 * var I18N_1;
 * if (typeof ngI18nClosureMode !== undefined && ngI18nClosureMode) {
 *     var MSG_EXTERNAL_XXX = goog.getMsg(
 *          "Some message with {$interpolation}!",
 *          { "interpolation": "\uFFFD0\uFFFD" }
 *     );
 *     I18N_1 = MSG_EXTERNAL_XXX;
 * }
 * else {
 *     I18N_1 = $localize`Some message with ${'\uFFFD0\uFFFD'}!`;
 * }
 * ```
 *
 * @param message The original i18n AST message node
 * @param variable The variable that will be assigned the translation, e.g. `I18N_1`.
 * @param closureVar The variable for Closure `goog.getMsg` calls, e.g. `MSG_EXTERNAL_XXX`.
 * @param params Object mapping placeholder names to their values (e.g.
 * `{ "interpolation": "\uFFFD0\uFFFD" }`).
 * @param transformFn Optional transformation function that will be applied to the translation (e.g.
 * post-processing).
 * @returns An array of statements that defined a given translation.
 */
function getTranslationDeclStmts(message, variable, closureVar, params = {}, transformFn) {
    const statements = [
        declareI18nVariable(variable),
        o.ifStmt(createClosureModeGuard(), createGoogleGetMsgStatements(variable, message, closureVar, params), createLocalizeStatements(variable, message, formatI18nPlaceholderNamesInMap(params, /* useCamelCase */ false))),
    ];
    if (transformFn) {
        statements.push(new o.ExpressionStatement(variable.set(transformFn(variable))));
    }
    return statements;
}
/**
 * Create the expression that will be used to guard the closure mode block
 * It is equivalent to:
 *
 * ```
 * typeof ngI18nClosureMode !== undefined && ngI18nClosureMode
 * ```
 */
function createClosureModeGuard() {
    return o.typeofExpr(o.variable(NG_I18N_CLOSURE_MODE))
        .notIdentical(o.literal('undefined', o.STRING_TYPE))
        .and(o.variable(NG_I18N_CLOSURE_MODE));
}
/**
 * Generates vars with Closure-specific names for i18n blocks (i.e. `MSG_XXX`).
 */
function i18nGenerateClosureVar(pool, messageId, fileBasedI18nSuffix, useExternalIds) {
    let name;
    const suffix = fileBasedI18nSuffix;
    if (useExternalIds) {
        const prefix = getTranslationConstPrefix(`EXTERNAL_`);
        const uniqueSuffix = pool.uniqueName(suffix);
        name = `${prefix}${sanitizeIdentifier(messageId)}$$${uniqueSuffix}`;
    }
    else {
        const prefix = getTranslationConstPrefix(suffix);
        name = pool.uniqueName(prefix);
    }
    return o.variable(name);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9tZXNzYWdlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX21lc3NhZ2VfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssSUFBSSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDMUQsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDekYsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sOENBQThDLENBQUM7QUFDdEYsT0FBTyxFQUFDLG1CQUFtQixFQUFFLCtCQUErQixFQUFFLHlCQUF5QixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDbkksT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0Isa0dBQWtHO0FBQ2xHLE1BQU0sb0JBQW9CLEdBQUcsbUJBQW1CLENBQUM7QUFFakQ7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLHNCQUFzQixHQUFHLE9BQU8sQ0FBQztBQUU5QyxvREFBb0Q7QUFDcEQsTUFBTSxVQUFVLDBCQUEwQixDQUFDLEdBQTRCO0lBQ3JFLE1BQU0sbUJBQW1CLEdBQ3JCLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNsRixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUks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LENBQUMsQ0FBQztRQUNqRCxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNoQztJQUNELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7dHlwZSBDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvaTE4bi9nZXRfbXNnX3V0aWxzJztcbmltcG9ydCB7Y3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvaTE4bi9sb2NhbGl6ZV91dGlscyc7XG5pbXBvcnQge2RlY2xhcmVJMThuVmFyaWFibGUsIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXh9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL3V0aWwnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogUHJlZml4IGZvciBub24tYGdvb2cuZ2V0TXNnYCBpMThuLXJlbGF0ZWQgdmFycy5cbiAqIE5vdGU6IHRoZSBwcmVmaXggdXNlcyBsb3dlcmNhc2UgY2hhcmFjdGVycyBpbnRlbnRpb25hbGx5IGR1ZSB0byBhIENsb3N1cmUgYmVoYXZpb3IgdGhhdFxuICogY29uc2lkZXJzIHZhcmlhYmxlcyBsaWtlIGBJMThOXzBgIGFzIGNvbnN0YW50cyBhbmQgdGhyb3dzIGFuIGVycm9yIHdoZW4gdGhlaXIgdmFsdWUgY2hhbmdlcy5cbiAqL1xuZXhwb3J0IGNvbnN0IFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVggPSAnaTE4bl8nO1xuXG4vKiogRXh0cmFjdHMgaTE4biBtZXNzYWdlcyBpbnRvIHRoZSBjb25zdHMgYXJyYXkuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VJMThuTWVzc2FnZUV4dHJhY3Rpb24oam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBjb25zdCBmaWxlQmFzZWRJMThuU3VmZml4ID1cbiAgICAgIGpvYi5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKS50b1VwcGVyQ2FzZSgpICsgJ18nO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQgJiYgb3AuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBvcC50YWdOYW1lUGFyYW1zO1xuICAgICAgICBjb25zdCBtYWluVmFyID0gby52YXJpYWJsZShqb2IucG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgpKTtcbiAgICAgICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdFxuICAgICAgICAvLyB0byBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlXG4gICAgICAgIC8vIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgICAgICBjb25zdCBjbG9zdXJlVmFyID0gaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihcbiAgICAgICAgICAgIGpvYi5wb29sLCBvcC5pMThuLmlkLCBmaWxlQmFzZWRJMThuU3VmZml4LCBqb2IuaTE4blVzZUV4dGVybmFsSWRzKTtcbiAgICAgICAgLy8gVE9ETzogZmlndXJlIG91dCB0cmFuc2Zvcm1Gbi5cbiAgICAgICAgY29uc3Qgc3RhdGVtZW50cyA9IGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgICAgICAgICAgb3AuaTE4biwgbWFpblZhciwgY2xvc3VyZVZhciwgcGFyYW1zLCB1bmRlZmluZWQgLyp0cmFuc2Zvcm1GbiovKTtcbiAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVFeHRyYWN0ZWRNZXNzYWdlT3Aob3AueHJlZiwgbWFpblZhciwgc3RhdGVtZW50cykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlIHN0YXRlbWVudHMgdGhhdCBkZWZpbmUgYSBnaXZlbiB0cmFuc2xhdGlvbiBtZXNzYWdlLlxuICpcbiAqIGBgYFxuICogdmFyIEkxOE5fMTtcbiAqIGlmICh0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZSkge1xuICogICAgIHZhciBNU0dfRVhURVJOQUxfWFhYID0gZ29vZy5nZXRNc2coXG4gKiAgICAgICAgICBcIlNvbWUgbWVzc2FnZSB3aXRoIHskaW50ZXJwb2xhdGlvbn0hXCIsXG4gKiAgICAgICAgICB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1cbiAqICAgICApO1xuICogICAgIEkxOE5fMSA9IE1TR19FWFRFUk5BTF9YWFg7XG4gKiB9XG4gKiBlbHNlIHtcbiAqICAgICBJMThOXzEgPSAkbG9jYWxpemVgU29tZSBtZXNzYWdlIHdpdGggJHsnXFx1RkZGRDBcXHVGRkZEJ30hYDtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBtZXNzYWdlIFRoZSBvcmlnaW5hbCBpMThuIEFTVCBtZXNzYWdlIG5vZGVcbiAqIEBwYXJhbSB2YXJpYWJsZSBUaGUgdmFyaWFibGUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRoZSB0cmFuc2xhdGlvbiwgZS5nLiBgSTE4Tl8xYC5cbiAqIEBwYXJhbSBjbG9zdXJlVmFyIFRoZSB2YXJpYWJsZSBmb3IgQ2xvc3VyZSBgZ29vZy5nZXRNc2dgIGNhbGxzLCBlLmcuIGBNU0dfRVhURVJOQUxfWFhYYC5cbiAqIEBwYXJhbSBwYXJhbXMgT2JqZWN0IG1hcHBpbmcgcGxhY2Vob2xkZXIgbmFtZXMgdG8gdGhlaXIgdmFsdWVzIChlLmcuXG4gKiBgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9YCkuXG4gKiBAcGFyYW0gdHJhbnNmb3JtRm4gT3B0aW9uYWwgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHRyYW5zbGF0aW9uIChlLmcuXG4gKiBwb3N0LXByb2Nlc3NpbmcpLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IGRlZmluZWQgYSBnaXZlbiB0cmFuc2xhdGlvbi5cbiAqL1xuZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKSxcbiAgICAgICAgY3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50cyh2YXJpYWJsZSwgbWVzc2FnZSwgY2xvc3VyZVZhciwgcGFyYW1zKSxcbiAgICAgICAgY3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpKSksXG4gIF07XG5cbiAgaWYgKHRyYW5zZm9ybUZuKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGUuc2V0KHRyYW5zZm9ybUZuKHZhcmlhYmxlKSkpKTtcbiAgfVxuXG4gIHJldHVybiBzdGF0ZW1lbnRzO1xufVxuXG4vKipcbiAqIENyZWF0ZSB0aGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgdXNlZCB0byBndWFyZCB0aGUgY2xvc3VyZSBtb2RlIGJsb2NrXG4gKiBJdCBpcyBlcXVpdmFsZW50IHRvOlxuICpcbiAqIGBgYFxuICogdHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGVcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCk6IG8uQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG8udHlwZW9mRXhwcihvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSlcbiAgICAgIC5ub3RJZGVudGljYWwoby5saXRlcmFsKCd1bmRlZmluZWQnLCBvLlNUUklOR19UWVBFKSlcbiAgICAgIC5hbmQoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB2YXJzIHdpdGggQ2xvc3VyZS1zcGVjaWZpYyBuYW1lcyBmb3IgaTE4biBibG9ja3MgKGkuZS4gYE1TR19YWFhgKS5cbiAqL1xuZnVuY3Rpb24gaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihcbiAgICBwb29sOiBDb25zdGFudFBvb2wsIG1lc3NhZ2VJZDogc3RyaW5nLCBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmcsXG4gICAgdXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4pOiBvLlJlYWRWYXJFeHByIHtcbiAgbGV0IG5hbWU6IHN0cmluZztcbiAgY29uc3Qgc3VmZml4ID0gZmlsZUJhc2VkSTE4blN1ZmZpeDtcbiAgaWYgKHVzZUV4dGVybmFsSWRzKSB7XG4gICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChgRVhURVJOQUxfYCk7XG4gICAgY29uc3QgdW5pcXVlU3VmZml4ID0gcG9vbC51bmlxdWVOYW1lKHN1ZmZpeCk7XG4gICAgbmFtZSA9IGAke3ByZWZpeH0ke3Nhbml0aXplSWRlbnRpZmllcihtZXNzYWdlSWQpfSQkJHt1bmlxdWVTdWZmaXh9YDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KHN1ZmZpeCk7XG4gICAgbmFtZSA9IHBvb2wudW5pcXVlTmFtZShwcmVmaXgpO1xuICB9XG4gIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xufVxuIl19