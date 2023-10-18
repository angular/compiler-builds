/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import { sanitizeIdentifier } from '../../../../parse_util';
import { Identifiers } from '../../../../render3/r3_identifiers';
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
            if (op.kind === ir.OpKind.I18nStart) {
                // Only extract messages from root i18n ops, not sub-template ones.
                if (op.xref === op.root) {
                    // Sort the params map to match the ordering in TemplateDefinitionBuilder.
                    const params = new Map([...op.params.entries()].sort());
                    const mainVar = o.variable(job.pool.uniqueName(TRANSLATION_VAR_PREFIX));
                    // Closure Compiler requires const names to start with `MSG_` but disallows any other
                    // const to start with `MSG_`. We define a variable starting with `MSG_` just for the
                    // `goog.getMsg` call
                    const closureVar = i18nGenerateClosureVar(job.pool, op.message.id, fileBasedI18nSuffix, job.i18nUseExternalIds);
                    let transformFn = undefined;
                    // If nescessary, add a post-processing step and resolve any placeholder params that are
                    // set in post-processing.
                    if (op.needsPostprocessing) {
                        const extraTransformFnParams = [];
                        if (op.postprocessingParams.size > 0) {
                            extraTransformFnParams.push(o.literalMap([...op.postprocessingParams.entries()].map(([key, value]) => ({ key, value, quoted: true }))));
                        }
                        transformFn = (expr) => o.importExpr(Identifiers.i18nPostprocess).callFn([expr, ...extraTransformFnParams]);
                    }
                    const statements = getTranslationDeclStmts(op.message, mainVar, closureVar, params, transformFn);
                    unit.create.push(ir.createExtractedMessageOp(op.xref, mainVar, statements));
                }
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
function getTranslationDeclStmts(message, variable, closureVar, params, transformFn) {
    const paramsObject = Object.fromEntries(params);
    const statements = [
        declareI18nVariable(variable),
        o.ifStmt(createClosureModeGuard(), createGoogleGetMsgStatements(variable, message, closureVar, paramsObject), createLocalizeStatements(variable, message, formatI18nPlaceholderNamesInMap(paramsObject, /* useCamelCase */ false))),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9tZXNzYWdlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX21lc3NhZ2VfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6RixPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUMsbUJBQW1CLEVBQUUsK0JBQStCLEVBQUUseUJBQXlCLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUNuSSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQixrR0FBa0c7QUFDbEcsTUFBTSxvQkFBb0IsR0FBRyxtQkFBbUIsQ0FBQztBQUVqRDs7OztHQUlHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sc0JBQXNCLEdBQUcsT0FBTyxDQUFDO0FBRTlDLG9EQUFvRDtBQUNwRCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsR0FBNEI7SUFDckUsTUFBTSxtQkFBbUIsR0FDckIsR0FBRyxDQUFDLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLENBQUMsV0FBVyxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2xGLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIs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IFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7dHlwZSBDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2NyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL2xvY2FsaXplX3V0aWxzJztcbmltcG9ydCB7ZGVjbGFyZUkxOG5WYXJpYWJsZSwgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcCwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeH0gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vdXRpbCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cblxuLyoqIE5hbWUgb2YgdGhlIGdsb2JhbCB2YXJpYWJsZSB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHdlIHVzZSBDbG9zdXJlIHRyYW5zbGF0aW9ucyBvciBub3QgKi9cbmNvbnN0IE5HX0kxOE5fQ0xPU1VSRV9NT0RFID0gJ25nSTE4bkNsb3N1cmVNb2RlJztcblxuLyoqXG4gKiBQcmVmaXggZm9yIG5vbi1gZ29vZy5nZXRNc2dgIGkxOG4tcmVsYXRlZCB2YXJzLlxuICogTm90ZTogdGhlIHByZWZpeCB1c2VzIGxvd2VyY2FzZSBjaGFyYWN0ZXJzIGludGVudGlvbmFsbHkgZHVlIHRvIGEgQ2xvc3VyZSBiZWhhdmlvciB0aGF0XG4gKiBjb25zaWRlcnMgdmFyaWFibGVzIGxpa2UgYEkxOE5fMGAgYXMgY29uc3RhbnRzIGFuZCB0aHJvd3MgYW4gZXJyb3Igd2hlbiB0aGVpciB2YWx1ZSBjaGFuZ2VzLlxuICovXG5leHBvcnQgY29uc3QgVFJBTlNMQVRJT05fVkFSX1BSRUZJWCA9ICdpMThuXyc7XG5cbi8qKiBFeHRyYWN0cyBpMThuIG1lc3NhZ2VzIGludG8gdGhlIGNvbnN0cyBhcnJheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUkxOG5NZXNzYWdlRXh0cmFjdGlvbihqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGNvbnN0IGZpbGVCYXNlZEkxOG5TdWZmaXggPVxuICAgICAgam9iLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpLnRvVXBwZXJDYXNlKCkgKyAnXyc7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgICAvLyBPbmx5IGV4dHJhY3QgbWVzc2FnZXMgZnJvbSByb290IGkxOG4gb3BzLCBub3Qgc3ViLXRlbXBsYXRlIG9uZXMuXG4gICAgICAgIGlmIChvcC54cmVmID09PSBvcC5yb290KSB7XG4gICAgICAgICAgLy8gU29ydCB0aGUgcGFyYW1zIG1hcCB0byBtYXRjaCB0aGUgb3JkZXJpbmcgaW4gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci5cbiAgICAgICAgICBjb25zdCBwYXJhbXMgPSBuZXcgTWFwKFsuLi5vcC5wYXJhbXMuZW50cmllcygpXS5zb3J0KCkpO1xuXG4gICAgICAgICAgY29uc3QgbWFpblZhciA9IG8udmFyaWFibGUoam9iLnBvb2wudW5pcXVlTmFtZShUUkFOU0xBVElPTl9WQVJfUFJFRklYKSk7XG4gICAgICAgICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlclxuICAgICAgICAgIC8vIGNvbnN0IHRvIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGVcbiAgICAgICAgICAvLyBgZ29vZy5nZXRNc2dgIGNhbGxcbiAgICAgICAgICBjb25zdCBjbG9zdXJlVmFyID0gaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihcbiAgICAgICAgICAgICAgam9iLnBvb2wsIG9wLm1lc3NhZ2UuaWQsIGZpbGVCYXNlZEkxOG5TdWZmaXgsIGpvYi5pMThuVXNlRXh0ZXJuYWxJZHMpO1xuICAgICAgICAgIGxldCB0cmFuc2Zvcm1GbiA9IHVuZGVmaW5lZDtcblxuICAgICAgICAgIC8vIElmIG5lc2Nlc3NhcnksIGFkZCBhIHBvc3QtcHJvY2Vzc2luZyBzdGVwIGFuZCByZXNvbHZlIGFueSBwbGFjZWhvbGRlciBwYXJhbXMgdGhhdCBhcmVcbiAgICAgICAgICAvLyBzZXQgaW4gcG9zdC1wcm9jZXNzaW5nLlxuICAgICAgICAgIGlmIChvcC5uZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgICAgICBjb25zdCBleHRyYVRyYW5zZm9ybUZuUGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICAgICAgaWYgKG9wLnBvc3Rwcm9jZXNzaW5nUGFyYW1zLnNpemUgPiAwKSB7XG4gICAgICAgICAgICAgIGV4dHJhVHJhbnNmb3JtRm5QYXJhbXMucHVzaChvLmxpdGVyYWxNYXAoWy4uLm9wLnBvc3Rwcm9jZXNzaW5nUGFyYW1zLmVudHJpZXMoKV0ubWFwKFxuICAgICAgICAgICAgICAgICAgKFtrZXksIHZhbHVlXSkgPT4gKHtrZXksIHZhbHVlLCBxdW90ZWQ6IHRydWV9KSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYW5zZm9ybUZuID0gKGV4cHI6IG8uUmVhZFZhckV4cHIpID0+XG4gICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmkxOG5Qb3N0cHJvY2VzcykuY2FsbEZuKFtleHByLCAuLi5leHRyYVRyYW5zZm9ybUZuUGFyYW1zXSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgc3RhdGVtZW50cyA9XG4gICAgICAgICAgICAgIGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKG9wLm1lc3NhZ2UsIG1haW5WYXIsIGNsb3N1cmVWYXIsIHBhcmFtcywgdHJhbnNmb3JtRm4pO1xuICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkTWVzc2FnZU9wKG9wLnhyZWYsIG1haW5WYXIsIHN0YXRlbWVudHMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlIHN0YXRlbWVudHMgdGhhdCBkZWZpbmUgYSBnaXZlbiB0cmFuc2xhdGlvbiBtZXNzYWdlLlxuICpcbiAqIGBgYFxuICogdmFyIEkxOE5fMTtcbiAqIGlmICh0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZSkge1xuICogICAgIHZhciBNU0dfRVhURVJOQUxfWFhYID0gZ29vZy5nZXRNc2coXG4gKiAgICAgICAgICBcIlNvbWUgbWVzc2FnZSB3aXRoIHskaW50ZXJwb2xhdGlvbn0hXCIsXG4gKiAgICAgICAgICB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1cbiAqICAgICApO1xuICogICAgIEkxOE5fMSA9IE1TR19FWFRFUk5BTF9YWFg7XG4gKiB9XG4gKiBlbHNlIHtcbiAqICAgICBJMThOXzEgPSAkbG9jYWxpemVgU29tZSBtZXNzYWdlIHdpdGggJHsnXFx1RkZGRDBcXHVGRkZEJ30hYDtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBtZXNzYWdlIFRoZSBvcmlnaW5hbCBpMThuIEFTVCBtZXNzYWdlIG5vZGVcbiAqIEBwYXJhbSB2YXJpYWJsZSBUaGUgdmFyaWFibGUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRoZSB0cmFuc2xhdGlvbiwgZS5nLiBgSTE4Tl8xYC5cbiAqIEBwYXJhbSBjbG9zdXJlVmFyIFRoZSB2YXJpYWJsZSBmb3IgQ2xvc3VyZSBgZ29vZy5nZXRNc2dgIGNhbGxzLCBlLmcuIGBNU0dfRVhURVJOQUxfWFhYYC5cbiAqIEBwYXJhbSBwYXJhbXMgT2JqZWN0IG1hcHBpbmcgcGxhY2Vob2xkZXIgbmFtZXMgdG8gdGhlaXIgdmFsdWVzIChlLmcuXG4gKiBgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9YCkuXG4gKiBAcGFyYW0gdHJhbnNmb3JtRm4gT3B0aW9uYWwgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHRyYW5zbGF0aW9uIChlLmcuXG4gKiBwb3N0LXByb2Nlc3NpbmcpLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IGRlZmluZWQgYSBnaXZlbiB0cmFuc2xhdGlvbi5cbiAqL1xuZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sXG4gICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3QgcGFyYW1zT2JqZWN0ID0gT2JqZWN0LmZyb21FbnRyaWVzKHBhcmFtcyk7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKSxcbiAgICAgICAgY3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50cyh2YXJpYWJsZSwgbWVzc2FnZSwgY2xvc3VyZVZhciwgcGFyYW1zT2JqZWN0KSxcbiAgICAgICAgY3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsXG4gICAgICAgICAgICBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lc0luTWFwKHBhcmFtc09iamVjdCwgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKSkpLFxuICBdO1xuXG4gIGlmICh0cmFuc2Zvcm1Gbikge1xuICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHZhcmlhYmxlLnNldCh0cmFuc2Zvcm1Gbih2YXJpYWJsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cblxuLyoqXG4gKiBDcmVhdGUgdGhlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHVzZWQgdG8gZ3VhcmQgdGhlIGNsb3N1cmUgbW9kZSBibG9ja1xuICogSXQgaXMgZXF1aXZhbGVudCB0bzpcbiAqXG4gKiBgYGBcbiAqIHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlXG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpOiBvLkJpbmFyeU9wZXJhdG9yRXhwciB7XG4gIHJldHVybiBvLnR5cGVvZkV4cHIoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpXG4gICAgICAubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCgndW5kZWZpbmVkJywgby5TVFJJTkdfVFlQRSkpXG4gICAgICAuYW5kKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgdmFycyB3aXRoIENsb3N1cmUtc3BlY2lmaWMgbmFtZXMgZm9yIGkxOG4gYmxvY2tzIChpLmUuIGBNU0dfWFhYYCkuXG4gKi9cbmZ1bmN0aW9uIGkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIoXG4gICAgcG9vbDogQ29uc3RhbnRQb29sLCBtZXNzYWdlSWQ6IHN0cmluZywgZmlsZUJhc2VkSTE4blN1ZmZpeDogc3RyaW5nLFxuICAgIHVzZUV4dGVybmFsSWRzOiBib29sZWFuKTogby5SZWFkVmFyRXhwciB7XG4gIGxldCBuYW1lOiBzdHJpbmc7XG4gIGNvbnN0IHN1ZmZpeCA9IGZpbGVCYXNlZEkxOG5TdWZmaXg7XG4gIGlmICh1c2VFeHRlcm5hbElkcykge1xuICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoYEVYVEVSTkFMX2ApO1xuICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHBvb2wudW5pcXVlTmFtZShzdWZmaXgpO1xuICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChzdWZmaXgpO1xuICAgIG5hbWUgPSBwb29sLnVuaXF1ZU5hbWUocHJlZml4KTtcbiAgfVxuICByZXR1cm4gby52YXJpYWJsZShuYW1lKTtcbn1cbiJdfQ==