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
const TRANSLATION_VAR_PREFIX = 'i18n_';
/**
 * Lifts i18n properties into the consts array.
 */
export function phaseI18nConstCollection(job) {
    const fileBasedI18nSuffix = job.relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + '_';
    const messageConstIndices = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedMessage) {
                // Serialize the extracted root messages into the const array.
                if (op.isRoot) {
                    assertAllParamsResolved(op);
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
                        if (op.formattedPostprocessingParams.size > 0) {
                            extraTransformFnParams.push(o.literalMap([...op.formattedPostprocessingParams].map(([key, value]) => ({ key, value, quoted: true }))));
                        }
                        transformFn = (expr) => o.importExpr(Identifiers.i18nPostprocess).callFn([expr, ...extraTransformFnParams]);
                    }
                    const statements = getTranslationDeclStmts(op.message, mainVar, closureVar, op.formattedParams, transformFn);
                    messageConstIndices.set(op.owner, job.addConst(mainVar, statements));
                }
                // Remove the extracted messages from the IR now that they have been collected.
                ir.OpList.remove(op);
            }
        }
    }
    // Assign const index to i18n ops that messages were extracted from.
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart) {
                op.messageIndex = messageConstIndices.get(op.root);
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
/**
 * Asserts that all of the message's placeholders have values.
 */
function assertAllParamsResolved(op) {
    if (op.formattedParams === null || op.formattedPostprocessingParams === null) {
        throw Error('Params should have been formatted.');
    }
    for (const placeholder in op.message.placeholders) {
        if (!op.formattedParams.has(placeholder) &&
            !op.formattedPostprocessingParams.has(placeholder)) {
            throw Error(`Failed to resolve i18n placeholder: ${placeholder}`);
        }
    }
    for (const placeholder in op.message.placeholderToMessage) {
        if (!op.formattedParams.has(placeholder) &&
            !op.formattedPostprocessingParams.has(placeholder)) {
            throw Error(`Failed to resolve i18n message placeholder: ${placeholder}`);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDMUQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sRUFBQyw0QkFBNEIsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBQ3pGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDhDQUE4QyxDQUFDO0FBQ3RGLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSwrQkFBK0IsRUFBRSx5QkFBeUIsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBQ25JLE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLGtHQUFrRztBQUNsRyxNQUFNLG9CQUFvQixHQUFHLG1CQUFtQixDQUFDO0FBRWpEOzs7O0dBSUc7QUFDSCxNQUFNLHNCQUFzQixHQUFHLE9BQU8sQ0FBQztBQUV2Qzs7R0FFRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUE0QjtJQUNuRSxNQUFNLG1CQUFtQixHQUNyQixHQUFHLENBQUMsdUJBQXVCLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxHQUFHLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFDbEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBNEIsQ0FBQztJQUVoRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFB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U0FBTTtRQUNMLE1BQU0sTUFBTSxHQUFHLHlCQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pELElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2hDO0lBQ0QsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsdUJBQXVCLENBQUMsRUFBeUI7SUFJeEQsSUFBSSxFQUFFLENBQUMsZUFBZSxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsNkJBQTZCLEtBQUssSUFBSSxFQUFFO1FBQzVFLE1BQU0sS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7S0FDbkQ7SUFDRCxLQUFLLE1BQU0sV0FBVyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFO1FBQ2pELElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUM7WUFDcEMsQ0FBQyxFQUFFLENBQUMsNkJBQTZCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3RELE1BQU0sS0FBSyxDQUFDLHVDQUF1QyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1NBQ25FO0tBQ0Y7SUFDRCxLQUFLLE1BQU0sV0FBVyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLEVBQUU7UUFDekQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQztZQUNwQyxDQUFDLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDdEQsTUFBTSxLQUFLLENBQUMsK0NBQStDLFdBQVcsRUFBRSxDQUFDLENBQUM7U0FDM0U7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHt0eXBlIENvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge3Nhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50c30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vZ2V0X21zZ191dGlscyc7XG5pbXBvcnQge2NyZWF0ZUxvY2FsaXplU3RhdGVtZW50c30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vbG9jYWxpemVfdXRpbHMnO1xuaW1wb3J0IHtkZWNsYXJlSTE4blZhcmlhYmxlLCBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lc0luTWFwLCBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4fSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvaTE4bi91dGlsJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqIE5hbWUgb2YgdGhlIGdsb2JhbCB2YXJpYWJsZSB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHdlIHVzZSBDbG9zdXJlIHRyYW5zbGF0aW9ucyBvciBub3QgKi9cbmNvbnN0IE5HX0kxOE5fQ0xPU1VSRV9NT0RFID0gJ25nSTE4bkNsb3N1cmVNb2RlJztcblxuLyoqXG4gKiBQcmVmaXggZm9yIG5vbi1gZ29vZy5nZXRNc2dgIGkxOG4tcmVsYXRlZCB2YXJzLlxuICogTm90ZTogdGhlIHByZWZpeCB1c2VzIGxvd2VyY2FzZSBjaGFyYWN0ZXJzIGludGVudGlvbmFsbHkgZHVlIHRvIGEgQ2xvc3VyZSBiZWhhdmlvciB0aGF0XG4gKiBjb25zaWRlcnMgdmFyaWFibGVzIGxpa2UgYEkxOE5fMGAgYXMgY29uc3RhbnRzIGFuZCB0aHJvd3MgYW4gZXJyb3Igd2hlbiB0aGVpciB2YWx1ZSBjaGFuZ2VzLlxuICovXG5jb25zdCBUUkFOU0xBVElPTl9WQVJfUFJFRklYID0gJ2kxOG5fJztcblxuLyoqXG4gKiBMaWZ0cyBpMThuIHByb3BlcnRpZXMgaW50byB0aGUgY29uc3RzIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VJMThuQ29uc3RDb2xsZWN0aW9uKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgY29uc3QgZmlsZUJhc2VkSTE4blN1ZmZpeCA9XG4gICAgICBqb2IucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgucmVwbGFjZSgvW15BLVphLXowLTldL2csICdfJykudG9VcHBlckNhc2UoKSArICdfJztcbiAgY29uc3QgbWVzc2FnZUNvbnN0SW5kaWNlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5Db25zdEluZGV4PigpO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZE1lc3NhZ2UpIHtcbiAgICAgICAgLy8gU2VyaWFsaXplIHRoZSBleHRyYWN0ZWQgcm9vdCBtZXNzYWdlcyBpbnRvIHRoZSBjb25zdCBhcnJheS5cbiAgICAgICAgaWYgKG9wLmlzUm9vdCkge1xuICAgICAgICAgIGFzc2VydEFsbFBhcmFtc1Jlc29sdmVkKG9wKTtcblxuICAgICAgICAgIGNvbnN0IG1haW5WYXIgPSBvLnZhcmlhYmxlKGpvYi5wb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fVkFSX1BSRUZJWCkpO1xuICAgICAgICAgIC8vIENsb3N1cmUgQ29tcGlsZXIgcmVxdWlyZXMgY29uc3QgbmFtZXMgdG8gc3RhcnQgd2l0aCBgTVNHX2AgYnV0IGRpc2FsbG93cyBhbnkgb3RoZXJcbiAgICAgICAgICAvLyBjb25zdCB0byBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlXG4gICAgICAgICAgLy8gYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgICAgICAgY29uc3QgY2xvc3VyZVZhciA9IGkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIoXG4gICAgICAgICAgICAgIGpvYi5wb29sLCBvcC5tZXNzYWdlLmlkLCBmaWxlQmFzZWRJMThuU3VmZml4LCBqb2IuaTE4blVzZUV4dGVybmFsSWRzKTtcbiAgICAgICAgICBsZXQgdHJhbnNmb3JtRm4gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAvLyBJZiBuZXNjZXNzYXJ5LCBhZGQgYSBwb3N0LXByb2Nlc3Npbmcgc3RlcCBhbmQgcmVzb2x2ZSBhbnkgcGxhY2Vob2xkZXIgcGFyYW1zIHRoYXQgYXJlXG4gICAgICAgICAgLy8gc2V0IGluIHBvc3QtcHJvY2Vzc2luZy5cbiAgICAgICAgICBpZiAob3AubmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgICAgICAgICAgY29uc3QgZXh0cmFUcmFuc2Zvcm1GblBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgICAgIGlmIChvcC5mb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcy5zaXplID4gMCkge1xuICAgICAgICAgICAgICBleHRyYVRyYW5zZm9ybUZuUGFyYW1zLnB1c2goby5saXRlcmFsTWFwKFsuLi5vcC5mb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtc10ubWFwKFxuICAgICAgICAgICAgICAgICAgKFtrZXksIHZhbHVlXSkgPT4gKHtrZXksIHZhbHVlLCBxdW90ZWQ6IHRydWV9KSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYW5zZm9ybUZuID0gKGV4cHI6IG8uUmVhZFZhckV4cHIpID0+XG4gICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmkxOG5Qb3N0cHJvY2VzcykuY2FsbEZuKFtleHByLCAuLi5leHRyYVRyYW5zZm9ybUZuUGFyYW1zXSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgc3RhdGVtZW50cyA9IGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgICAgICAgICAgICBvcC5tZXNzYWdlLCBtYWluVmFyLCBjbG9zdXJlVmFyLCBvcC5mb3JtYXR0ZWRQYXJhbXMhLCB0cmFuc2Zvcm1Gbik7XG5cbiAgICAgICAgICBtZXNzYWdlQ29uc3RJbmRpY2VzLnNldChvcC5vd25lciwgam9iLmFkZENvbnN0KG1haW5WYXIsIHN0YXRlbWVudHMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgZXh0cmFjdGVkIG1lc3NhZ2VzIGZyb20gdGhlIElSIG5vdyB0aGF0IHRoZXkgaGF2ZSBiZWVuIGNvbGxlY3RlZC5cbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEFzc2lnbiBjb25zdCBpbmRleCB0byBpMThuIG9wcyB0aGF0IG1lc3NhZ2VzIHdlcmUgZXh0cmFjdGVkIGZyb20uXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgICBvcC5tZXNzYWdlSW5kZXggPSBtZXNzYWdlQ29uc3RJbmRpY2VzLmdldChvcC5yb290KSE7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb24gKGUuZy5cbiAqIHBvc3QtcHJvY2Vzc2luZykuXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lZCBhIGdpdmVuIHRyYW5zbGF0aW9uLlxuICovXG5mdW5jdGlvbiBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhcbiAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHZhcmlhYmxlOiBvLlJlYWRWYXJFeHByLCBjbG9zdXJlVmFyOiBvLlJlYWRWYXJFeHByLFxuICAgIHBhcmFtczogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPixcbiAgICB0cmFuc2Zvcm1Gbj86IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IG8uRXhwcmVzc2lvbik6IG8uU3RhdGVtZW50W10ge1xuICBjb25zdCBwYXJhbXNPYmplY3QgPSBPYmplY3QuZnJvbUVudHJpZXMocGFyYW1zKTtcbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtcbiAgICBkZWNsYXJlSTE4blZhcmlhYmxlKHZhcmlhYmxlKSxcbiAgICBvLmlmU3RtdChcbiAgICAgICAgY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpLFxuICAgICAgICBjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzKHZhcmlhYmxlLCBtZXNzYWdlLCBjbG9zdXJlVmFyLCBwYXJhbXNPYmplY3QpLFxuICAgICAgICBjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHMoXG4gICAgICAgICAgICB2YXJpYWJsZSwgbWVzc2FnZSxcbiAgICAgICAgICAgIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAocGFyYW1zT2JqZWN0LCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpKSksXG4gIF07XG5cbiAgaWYgKHRyYW5zZm9ybUZuKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGUuc2V0KHRyYW5zZm9ybUZuKHZhcmlhYmxlKSkpKTtcbiAgfVxuXG4gIHJldHVybiBzdGF0ZW1lbnRzO1xufVxuXG4vKipcbiAqIENyZWF0ZSB0aGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgdXNlZCB0byBndWFyZCB0aGUgY2xvc3VyZSBtb2RlIGJsb2NrXG4gKiBJdCBpcyBlcXVpdmFsZW50IHRvOlxuICpcbiAqIGBgYFxuICogdHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGVcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCk6IG8uQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG8udHlwZW9mRXhwcihvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSlcbiAgICAgIC5ub3RJZGVudGljYWwoby5saXRlcmFsKCd1bmRlZmluZWQnLCBvLlNUUklOR19UWVBFKSlcbiAgICAgIC5hbmQoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB2YXJzIHdpdGggQ2xvc3VyZS1zcGVjaWZpYyBuYW1lcyBmb3IgaTE4biBibG9ja3MgKGkuZS4gYE1TR19YWFhgKS5cbiAqL1xuZnVuY3Rpb24gaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihcbiAgICBwb29sOiBDb25zdGFudFBvb2wsIG1lc3NhZ2VJZDogc3RyaW5nLCBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmcsXG4gICAgdXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4pOiBvLlJlYWRWYXJFeHByIHtcbiAgbGV0IG5hbWU6IHN0cmluZztcbiAgY29uc3Qgc3VmZml4ID0gZmlsZUJhc2VkSTE4blN1ZmZpeDtcbiAgaWYgKHVzZUV4dGVybmFsSWRzKSB7XG4gICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChgRVhURVJOQUxfYCk7XG4gICAgY29uc3QgdW5pcXVlU3VmZml4ID0gcG9vbC51bmlxdWVOYW1lKHN1ZmZpeCk7XG4gICAgbmFtZSA9IGAke3ByZWZpeH0ke3Nhbml0aXplSWRlbnRpZmllcihtZXNzYWdlSWQpfSQkJHt1bmlxdWVTdWZmaXh9YDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KHN1ZmZpeCk7XG4gICAgbmFtZSA9IHBvb2wudW5pcXVlTmFtZShwcmVmaXgpO1xuICB9XG4gIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xufVxuXG4vKipcbiAqIEFzc2VydHMgdGhhdCBhbGwgb2YgdGhlIG1lc3NhZ2UncyBwbGFjZWhvbGRlcnMgaGF2ZSB2YWx1ZXMuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydEFsbFBhcmFtc1Jlc29sdmVkKG9wOiBpci5FeHRyYWN0ZWRNZXNzYWdlT3ApOiBhc3NlcnRzIG9wIGlzIGlyLkV4dHJhY3RlZE1lc3NhZ2VPcCZ7XG4gIGZvcm1hdHRlZFBhcmFtczogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPixcbiAgZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sXG59IHtcbiAgaWYgKG9wLmZvcm1hdHRlZFBhcmFtcyA9PT0gbnVsbCB8fCBvcC5mb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcyA9PT0gbnVsbCkge1xuICAgIHRocm93IEVycm9yKCdQYXJhbXMgc2hvdWxkIGhhdmUgYmVlbiBmb3JtYXR0ZWQuJyk7XG4gIH1cbiAgZm9yIChjb25zdCBwbGFjZWhvbGRlciBpbiBvcC5tZXNzYWdlLnBsYWNlaG9sZGVycykge1xuICAgIGlmICghb3AuZm9ybWF0dGVkUGFyYW1zLmhhcyhwbGFjZWhvbGRlcikgJiZcbiAgICAgICAgIW9wLmZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zLmhhcyhwbGFjZWhvbGRlcikpIHtcbiAgICAgIHRocm93IEVycm9yKGBGYWlsZWQgdG8gcmVzb2x2ZSBpMThuIHBsYWNlaG9sZGVyOiAke3BsYWNlaG9sZGVyfWApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIGluIG9wLm1lc3NhZ2UucGxhY2Vob2xkZXJUb01lc3NhZ2UpIHtcbiAgICBpZiAoIW9wLmZvcm1hdHRlZFBhcmFtcy5oYXMocGxhY2Vob2xkZXIpICYmXG4gICAgICAgICFvcC5mb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcy5oYXMocGxhY2Vob2xkZXIpKSB7XG4gICAgICB0aHJvdyBFcnJvcihgRmFpbGVkIHRvIHJlc29sdmUgaTE4biBtZXNzYWdlIHBsYWNlaG9sZGVyOiAke3BsYWNlaG9sZGVyfWApO1xuICAgIH1cbiAgfVxufVxuIl19