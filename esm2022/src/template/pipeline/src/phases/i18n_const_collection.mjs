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
 * TODO: Can we use `ConstCollectedExpr`?
 */
export function collectI18nConsts(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDMUQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sRUFBQyw0QkFBNEIsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBQ3pGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDhDQUE4QyxDQUFDO0FBQ3RGLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSwrQkFBK0IsRUFBRSx5QkFBeUIsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBQ25JLE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLGtHQUFrRztBQUNsRyxNQUFNLG9CQUFvQixHQUFHLG1CQUFtQixDQUFDO0FBRWpEOzs7O0dBSUc7QUFDSCxNQUFNLHNCQUFzQixHQUFHLE9BQU8sQ0FBQztBQUV2Qzs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBNEI7SUFDNUQsTUFBTSxtQkFBbUIsR0FDckIsR0FBRyxDQUFDLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLENBQUMsV0FBVyxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2xGLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7SUFFaEUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElB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O1NBQU07UUFDTCxNQUFNLE1BQU0sR0FBRyx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRCxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNoQztJQUNELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLHVCQUF1QixDQUFDLEVBQXlCO0lBSXhELElBQUksRUFBRSxDQUFDLGVBQWUsS0FBSyxJQUFJLElBQUksRUFBRSxDQUFDLDZCQUE2QixLQUFLLElBQUksRUFBRTtRQUM1RSxNQUFNLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0tBQ25EO0lBQ0QsS0FBSyxNQUFNLFdBQVcsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRTtRQUNqRCxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO1lBQ3BDLENBQUMsRUFBRSxDQUFDLDZCQUE2QixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUN0RCxNQUFNLEtBQUssQ0FBQyx1Q0FBdUMsV0FBVyxFQUFFLENBQUMsQ0FBQztTQUNuRTtLQUNGO0lBQ0QsS0FBSyxNQUFNLFdBQVcsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLG9CQUFvQixFQUFFO1FBQ3pELElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUM7WUFDcEMsQ0FBQyxFQUFFLENBQUMsNkJBQTZCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3RELE1BQU0sS0FBSyxDQUFDLCtDQUErQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1NBQzNFO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7dHlwZSBDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2NyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL2xvY2FsaXplX3V0aWxzJztcbmltcG9ydCB7ZGVjbGFyZUkxOG5WYXJpYWJsZSwgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcCwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeH0gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vdXRpbCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogUHJlZml4IGZvciBub24tYGdvb2cuZ2V0TXNnYCBpMThuLXJlbGF0ZWQgdmFycy5cbiAqIE5vdGU6IHRoZSBwcmVmaXggdXNlcyBsb3dlcmNhc2UgY2hhcmFjdGVycyBpbnRlbnRpb25hbGx5IGR1ZSB0byBhIENsb3N1cmUgYmVoYXZpb3IgdGhhdFxuICogY29uc2lkZXJzIHZhcmlhYmxlcyBsaWtlIGBJMThOXzBgIGFzIGNvbnN0YW50cyBhbmQgdGhyb3dzIGFuIGVycm9yIHdoZW4gdGhlaXIgdmFsdWUgY2hhbmdlcy5cbiAqL1xuY29uc3QgVFJBTlNMQVRJT05fVkFSX1BSRUZJWCA9ICdpMThuXyc7XG5cbi8qKlxuICogTGlmdHMgaTE4biBwcm9wZXJ0aWVzIGludG8gdGhlIGNvbnN0cyBhcnJheS5cbiAqIFRPRE86IENhbiB3ZSB1c2UgYENvbnN0Q29sbGVjdGVkRXhwcmA/XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0STE4bkNvbnN0cyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGNvbnN0IGZpbGVCYXNlZEkxOG5TdWZmaXggPVxuICAgICAgam9iLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpLnRvVXBwZXJDYXNlKCkgKyAnXyc7XG4gIGNvbnN0IG1lc3NhZ2VDb25zdEluZGljZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuQ29uc3RJbmRleD4oKTtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRNZXNzYWdlKSB7XG4gICAgICAgIC8vIFNlcmlhbGl6ZSB0aGUgZXh0cmFjdGVkIHJvb3QgbWVzc2FnZXMgaW50byB0aGUgY29uc3QgYXJyYXkuXG4gICAgICAgIGlmIChvcC5pc1Jvb3QpIHtcbiAgICAgICAgICBhc3NlcnRBbGxQYXJhbXNSZXNvbHZlZChvcCk7XG5cbiAgICAgICAgICBjb25zdCBtYWluVmFyID0gby52YXJpYWJsZShqb2IucG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgpKTtcbiAgICAgICAgICAvLyBDbG9zdXJlIENvbXBpbGVyIHJlcXVpcmVzIGNvbnN0IG5hbWVzIHRvIHN0YXJ0IHdpdGggYE1TR19gIGJ1dCBkaXNhbGxvd3MgYW55IG90aGVyXG4gICAgICAgICAgLy8gY29uc3QgdG8gc3RhcnQgd2l0aCBgTVNHX2AuIFdlIGRlZmluZSBhIHZhcmlhYmxlIHN0YXJ0aW5nIHdpdGggYE1TR19gIGp1c3QgZm9yIHRoZVxuICAgICAgICAgIC8vIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgICAgICAgIGNvbnN0IGNsb3N1cmVWYXIgPSBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKFxuICAgICAgICAgICAgICBqb2IucG9vbCwgb3AubWVzc2FnZS5pZCwgZmlsZUJhc2VkSTE4blN1ZmZpeCwgam9iLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG4gICAgICAgICAgbGV0IHRyYW5zZm9ybUZuID0gdW5kZWZpbmVkO1xuXG4gICAgICAgICAgLy8gSWYgbmVzY2Vzc2FyeSwgYWRkIGEgcG9zdC1wcm9jZXNzaW5nIHN0ZXAgYW5kIHJlc29sdmUgYW55IHBsYWNlaG9sZGVyIHBhcmFtcyB0aGF0IGFyZVxuICAgICAgICAgIC8vIHNldCBpbiBwb3N0LXByb2Nlc3NpbmcuXG4gICAgICAgICAgaWYgKG9wLm5lZWRzUG9zdHByb2Nlc3NpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhVHJhbnNmb3JtRm5QYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgICAgICBpZiAob3AuZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXMuc2l6ZSA+IDApIHtcbiAgICAgICAgICAgICAgZXh0cmFUcmFuc2Zvcm1GblBhcmFtcy5wdXNoKG8ubGl0ZXJhbE1hcChbLi4ub3AuZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXNdLm1hcChcbiAgICAgICAgICAgICAgICAgIChba2V5LCB2YWx1ZV0pID0+ICh7a2V5LCB2YWx1ZSwgcXVvdGVkOiB0cnVlfSkpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFuc2Zvcm1GbiA9IChleHByOiBvLlJlYWRWYXJFeHByKSA9PlxuICAgICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pMThuUG9zdHByb2Nlc3MpLmNhbGxGbihbZXhwciwgLi4uZXh0cmFUcmFuc2Zvcm1GblBhcmFtc10pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHN0YXRlbWVudHMgPSBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhcbiAgICAgICAgICAgICAgb3AubWVzc2FnZSwgbWFpblZhciwgY2xvc3VyZVZhciwgb3AuZm9ybWF0dGVkUGFyYW1zISwgdHJhbnNmb3JtRm4pO1xuXG4gICAgICAgICAgbWVzc2FnZUNvbnN0SW5kaWNlcy5zZXQob3Aub3duZXIsIGpvYi5hZGRDb25zdChtYWluVmFyLCBzdGF0ZW1lbnRzKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgdGhlIGV4dHJhY3RlZCBtZXNzYWdlcyBmcm9tIHRoZSBJUiBub3cgdGhhdCB0aGV5IGhhdmUgYmVlbiBjb2xsZWN0ZWQuXG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBc3NpZ24gY29uc3QgaW5kZXggdG8gaTE4biBvcHMgdGhhdCBtZXNzYWdlcyB3ZXJlIGV4dHJhY3RlZCBmcm9tLlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICAgICAgb3AubWVzc2FnZUluZGV4ID0gbWVzc2FnZUNvbnN0SW5kaWNlcy5nZXQob3Aucm9vdCkhO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlIHN0YXRlbWVudHMgdGhhdCBkZWZpbmUgYSBnaXZlbiB0cmFuc2xhdGlvbiBtZXNzYWdlLlxuICpcbiAqIGBgYFxuICogdmFyIEkxOE5fMTtcbiAqIGlmICh0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZSkge1xuICogICAgIHZhciBNU0dfRVhURVJOQUxfWFhYID0gZ29vZy5nZXRNc2coXG4gKiAgICAgICAgICBcIlNvbWUgbWVzc2FnZSB3aXRoIHskaW50ZXJwb2xhdGlvbn0hXCIsXG4gKiAgICAgICAgICB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1cbiAqICAgICApO1xuICogICAgIEkxOE5fMSA9IE1TR19FWFRFUk5BTF9YWFg7XG4gKiB9XG4gKiBlbHNlIHtcbiAqICAgICBJMThOXzEgPSAkbG9jYWxpemVgU29tZSBtZXNzYWdlIHdpdGggJHsnXFx1RkZGRDBcXHVGRkZEJ30hYDtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBtZXNzYWdlIFRoZSBvcmlnaW5hbCBpMThuIEFTVCBtZXNzYWdlIG5vZGVcbiAqIEBwYXJhbSB2YXJpYWJsZSBUaGUgdmFyaWFibGUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRoZSB0cmFuc2xhdGlvbiwgZS5nLiBgSTE4Tl8xYC5cbiAqIEBwYXJhbSBjbG9zdXJlVmFyIFRoZSB2YXJpYWJsZSBmb3IgQ2xvc3VyZSBgZ29vZy5nZXRNc2dgIGNhbGxzLCBlLmcuIGBNU0dfRVhURVJOQUxfWFhYYC5cbiAqIEBwYXJhbSBwYXJhbXMgT2JqZWN0IG1hcHBpbmcgcGxhY2Vob2xkZXIgbmFtZXMgdG8gdGhlaXIgdmFsdWVzIChlLmcuXG4gKiBgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9YCkuXG4gKiBAcGFyYW0gdHJhbnNmb3JtRm4gT3B0aW9uYWwgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHRyYW5zbGF0aW9uIChlLmcuXG4gKiBwb3N0LXByb2Nlc3NpbmcpLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IGRlZmluZWQgYSBnaXZlbiB0cmFuc2xhdGlvbi5cbiAqL1xuZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sXG4gICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3QgcGFyYW1zT2JqZWN0ID0gT2JqZWN0LmZyb21FbnRyaWVzKHBhcmFtcyk7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKSxcbiAgICAgICAgY3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50cyh2YXJpYWJsZSwgbWVzc2FnZSwgY2xvc3VyZVZhciwgcGFyYW1zT2JqZWN0KSxcbiAgICAgICAgY3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsXG4gICAgICAgICAgICBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lc0luTWFwKHBhcmFtc09iamVjdCwgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKSkpLFxuICBdO1xuXG4gIGlmICh0cmFuc2Zvcm1Gbikge1xuICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHZhcmlhYmxlLnNldCh0cmFuc2Zvcm1Gbih2YXJpYWJsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cblxuLyoqXG4gKiBDcmVhdGUgdGhlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHVzZWQgdG8gZ3VhcmQgdGhlIGNsb3N1cmUgbW9kZSBibG9ja1xuICogSXQgaXMgZXF1aXZhbGVudCB0bzpcbiAqXG4gKiBgYGBcbiAqIHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlXG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpOiBvLkJpbmFyeU9wZXJhdG9yRXhwciB7XG4gIHJldHVybiBvLnR5cGVvZkV4cHIoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpXG4gICAgICAubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCgndW5kZWZpbmVkJywgby5TVFJJTkdfVFlQRSkpXG4gICAgICAuYW5kKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgdmFycyB3aXRoIENsb3N1cmUtc3BlY2lmaWMgbmFtZXMgZm9yIGkxOG4gYmxvY2tzIChpLmUuIGBNU0dfWFhYYCkuXG4gKi9cbmZ1bmN0aW9uIGkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIoXG4gICAgcG9vbDogQ29uc3RhbnRQb29sLCBtZXNzYWdlSWQ6IHN0cmluZywgZmlsZUJhc2VkSTE4blN1ZmZpeDogc3RyaW5nLFxuICAgIHVzZUV4dGVybmFsSWRzOiBib29sZWFuKTogby5SZWFkVmFyRXhwciB7XG4gIGxldCBuYW1lOiBzdHJpbmc7XG4gIGNvbnN0IHN1ZmZpeCA9IGZpbGVCYXNlZEkxOG5TdWZmaXg7XG4gIGlmICh1c2VFeHRlcm5hbElkcykge1xuICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoYEVYVEVSTkFMX2ApO1xuICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHBvb2wudW5pcXVlTmFtZShzdWZmaXgpO1xuICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChzdWZmaXgpO1xuICAgIG5hbWUgPSBwb29sLnVuaXF1ZU5hbWUocHJlZml4KTtcbiAgfVxuICByZXR1cm4gby52YXJpYWJsZShuYW1lKTtcbn1cblxuLyoqXG4gKiBBc3NlcnRzIHRoYXQgYWxsIG9mIHRoZSBtZXNzYWdlJ3MgcGxhY2Vob2xkZXJzIGhhdmUgdmFsdWVzLlxuICovXG5mdW5jdGlvbiBhc3NlcnRBbGxQYXJhbXNSZXNvbHZlZChvcDogaXIuRXh0cmFjdGVkTWVzc2FnZU9wKTogYXNzZXJ0cyBvcCBpcyBpci5FeHRyYWN0ZWRNZXNzYWdlT3Ame1xuICBmb3JtYXR0ZWRQYXJhbXM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sXG4gIGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LFxufSB7XG4gIGlmIChvcC5mb3JtYXR0ZWRQYXJhbXMgPT09IG51bGwgfHwgb3AuZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXMgPT09IG51bGwpIHtcbiAgICB0aHJvdyBFcnJvcignUGFyYW1zIHNob3VsZCBoYXZlIGJlZW4gZm9ybWF0dGVkLicpO1xuICB9XG4gIGZvciAoY29uc3QgcGxhY2Vob2xkZXIgaW4gb3AubWVzc2FnZS5wbGFjZWhvbGRlcnMpIHtcbiAgICBpZiAoIW9wLmZvcm1hdHRlZFBhcmFtcy5oYXMocGxhY2Vob2xkZXIpICYmXG4gICAgICAgICFvcC5mb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcy5oYXMocGxhY2Vob2xkZXIpKSB7XG4gICAgICB0aHJvdyBFcnJvcihgRmFpbGVkIHRvIHJlc29sdmUgaTE4biBwbGFjZWhvbGRlcjogJHtwbGFjZWhvbGRlcn1gKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwbGFjZWhvbGRlciBpbiBvcC5tZXNzYWdlLnBsYWNlaG9sZGVyVG9NZXNzYWdlKSB7XG4gICAgaWYgKCFvcC5mb3JtYXR0ZWRQYXJhbXMuaGFzKHBsYWNlaG9sZGVyKSAmJlxuICAgICAgICAhb3AuZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXMuaGFzKHBsYWNlaG9sZGVyKSkge1xuICAgICAgdGhyb3cgRXJyb3IoYEZhaWxlZCB0byByZXNvbHZlIGkxOG4gbWVzc2FnZSBwbGFjZWhvbGRlcjogJHtwbGFjZWhvbGRlcn1gKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==