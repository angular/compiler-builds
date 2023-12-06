/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { mapLiteral } from '../../../../output/map_util';
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
/** Prefix of ICU expressions for post processing */
export const I18N_ICU_MAPPING_PREFIX = 'I18N_EXP_';
/**
 * The escape sequence used for message param values.
 */
const ESCAPE = '\uFFFD';
/**
 * Lifts i18n properties into the consts array.
 * TODO: Can we use `ConstCollectedExpr`?
 * TODO: The way the various attributes are linked together is very complex. Perhaps we could
 * simplify the process, maybe by combining the context and message ops?
 */
export function collectI18nConsts(job) {
    const fileBasedI18nSuffix = job.relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + '_';
    // Step One: Build up various lookup maps we need to collect all the consts.
    // Context Xref -> Extracted Attribute Op
    const extractedAttributesByI18nContext = new Map();
    // Target Xref (element for i18n attributes, last item in i18n block for i18n values) -> I18n
    // Attributes config op
    const i18nAttributesByTarget = new Map();
    // Target Element Xref -> All I18n Expression ops for that target
    const i18nExpressionsByTarget = new Map();
    // I18n Message Xref -> I18n Message Op (TODO: use a central op map)
    const messages = new Map();
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            if (op.kind === ir.OpKind.ExtractedAttribute && op.i18nContext !== null) {
                extractedAttributesByI18nContext.set(op.i18nContext, op);
            }
            else if (op.kind === ir.OpKind.I18nAttributes) {
                i18nAttributesByTarget.set(op.target, op);
            }
            else if (op.kind === ir.OpKind.I18nExpression) {
                const expressions = i18nExpressionsByTarget.get(op.target) ?? [];
                expressions.push(op);
                i18nExpressionsByTarget.set(op.target, expressions);
            }
            else if (op.kind === ir.OpKind.I18nMessage) {
                messages.set(op.xref, op);
            }
        }
    }
    // Step Two: Serialize the extracted i18n messages for root i18n blocks and i18n attributes into
    // the const array.
    //
    // Also, each i18n message will have a variable expression that can refer to its
    // value. Store these expressions in the appropriate place:
    // 1. For normal i18n content, it also goes in the const array. We save the const index to use
    // later.
    // 2. For extracted attributes, it becomes the value of the extracted attribute instruction.
    // 3. For i18n bindings, it will go in a separate const array instruction below; for now, we just
    // save it.
    const i18nValuesByContext = new Map();
    const messageConstIndices = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nMessage) {
                if (op.messagePlaceholder === null) {
                    const { mainVar, statements } = collectMessage(job, fileBasedI18nSuffix, messages, op);
                    if (op.i18nBlock !== null) {
                        // This is a regular i18n message with a corresponding i18n block. Collect it into the
                        // const array.
                        const i18nConst = job.addConst(mainVar, statements);
                        messageConstIndices.set(op.i18nBlock, i18nConst);
                    }
                    else {
                        // This is an i18n attribute. Extract the initializers into the const pool.
                        job.constsInitializers.push(...statements);
                        // Save the i18n variable value for later.
                        i18nValuesByContext.set(op.i18nContext, mainVar);
                        // This i18n message may correspond to an individual extracted attribute. If so, The
                        // value of that attribute is updated to read the extracted i18n variable.
                        const attributeForMessage = extractedAttributesByI18nContext.get(op.i18nContext);
                        if (attributeForMessage !== undefined) {
                            attributeForMessage.expression = mainVar;
                        }
                    }
                }
                ir.OpList.remove(op);
            }
        }
    }
    // Step Three: Serialize I18nAttributes configurations into the const array. Each I18nAttributes
    // instruction has a config array, which contains k-v pairs describing each binding name, and the
    // i18n variable that provides the value.
    for (const unit of job.units) {
        for (const elem of unit.create) {
            if (ir.isElementOrContainerOp(elem)) {
                const i18nAttributes = i18nAttributesByTarget.get(elem.xref);
                if (i18nAttributes === undefined) {
                    // This element is not associated with an i18n attributes configuration instruction.
                    continue;
                }
                let i18nExpressions = i18nExpressionsByTarget.get(elem.xref);
                if (i18nExpressions === undefined) {
                    // Unused i18nAttributes should have already been removed.
                    // TODO: Should the removal of those dead instructions be merged with this phase?
                    throw new Error('AssertionError: Could not find any i18n expressions associated with an I18nAttributes instruction');
                }
                // Find expressions for all the unique property names, removing duplicates.
                const seenPropertyNames = new Set();
                i18nExpressions = i18nExpressions.filter(i18nExpr => {
                    const seen = (seenPropertyNames.has(i18nExpr.name));
                    seenPropertyNames.add(i18nExpr.name);
                    return !seen;
                });
                const i18nAttributeConfig = i18nExpressions.flatMap(i18nExpr => {
                    const i18nExprValue = i18nValuesByContext.get(i18nExpr.context);
                    if (i18nExprValue === undefined) {
                        throw new Error('AssertionError: Could not find i18n expression\'s value');
                    }
                    return [o.literal(i18nExpr.name), i18nExprValue];
                });
                i18nAttributes.i18nAttributesConfig =
                    job.addConst(new o.LiteralArrayExpr(i18nAttributeConfig));
            }
        }
    }
    // Step Four: Propagate the extracted const index into i18n ops that messages were extracted from.
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart) {
                const msgIndex = messageConstIndices.get(op.root);
                if (msgIndex === undefined) {
                    throw new Error('AssertionError: Could not find corresponding i18n block index for an i18n message op; was an i18n message incorrectly assumed to correspond to an attribute?');
                }
                op.messageIndex = msgIndex;
            }
        }
    }
}
/**
 * Collects the given message into a set of statements that can be added to the const array.
 * This will recursively collect any sub-messages referenced from the parent message as well.
 */
function collectMessage(job, fileBasedI18nSuffix, messages, messageOp) {
    // Recursively collect any sub-messages, record each sub-message's main variable under its
    // placeholder so that we can add them to the params for the parent message. It is possible
    // that multiple sub-messages will share the same placeholder, so we need to track an array of
    // variables for each placeholder.
    const statements = [];
    const subMessagePlaceholders = new Map();
    for (const subMessageId of messageOp.subMessages) {
        const subMessage = messages.get(subMessageId);
        const { mainVar: subMessageVar, statements: subMessageStatements } = collectMessage(job, fileBasedI18nSuffix, messages, subMessage);
        statements.push(...subMessageStatements);
        const subMessages = subMessagePlaceholders.get(subMessage.messagePlaceholder) ?? [];
        subMessages.push(subMessageVar);
        subMessagePlaceholders.set(subMessage.messagePlaceholder, subMessages);
    }
    addSubMessageParams(messageOp, subMessagePlaceholders);
    // Sort the params for consistency with TemaplateDefinitionBuilder output.
    messageOp.params = new Map([...messageOp.params.entries()].sort());
    const mainVar = o.variable(job.pool.uniqueName(TRANSLATION_VAR_PREFIX));
    // Closure Compiler requires const names to start with `MSG_` but disallows any other
    // const to start with `MSG_`. We define a variable starting with `MSG_` just for the
    // `goog.getMsg` call
    const closureVar = i18nGenerateClosureVar(job.pool, messageOp.message.id, fileBasedI18nSuffix, job.i18nUseExternalIds);
    let transformFn = undefined;
    // If nescessary, add a post-processing step and resolve any placeholder params that are
    // set in post-processing.
    if (messageOp.needsPostprocessing) {
        // Sort the post-processing params for consistency with TemaplateDefinitionBuilder output.
        const postprocessingParams = Object.fromEntries([...messageOp.postprocessingParams.entries()].sort());
        const formattedPostprocessingParams = formatI18nPlaceholderNamesInMap(postprocessingParams, /* useCamelCase */ false);
        const extraTransformFnParams = [];
        if (messageOp.postprocessingParams.size > 0) {
            extraTransformFnParams.push(mapLiteral(formattedPostprocessingParams, /* quoted */ true));
        }
        transformFn = (expr) => o.importExpr(Identifiers.i18nPostprocess).callFn([expr, ...extraTransformFnParams]);
    }
    // Add the message's statements
    statements.push(...getTranslationDeclStmts(messageOp.message, mainVar, closureVar, messageOp.params, transformFn));
    return { mainVar, statements };
}
/**
 * Adds the given subMessage placeholders to the given message op.
 *
 * If a placeholder only corresponds to a single sub-message variable, we just set that variable
 * as the param value. However, if the placeholder corresponds to multiple sub-message
 * variables, we need to add a special placeholder value that is handled by the post-processing
 * step. We then add the array of variables as a post-processing param.
 */
function addSubMessageParams(messageOp, subMessagePlaceholders) {
    for (const [placeholder, subMessages] of subMessagePlaceholders) {
        if (subMessages.length === 1) {
            messageOp.params.set(placeholder, subMessages[0]);
        }
        else {
            messageOp.params.set(placeholder, o.literal(`${ESCAPE}${I18N_ICU_MAPPING_PREFIX}${placeholder}${ESCAPE}`));
            messageOp.postprocessingParams.set(placeholder, o.literalArr(subMessages));
            messageOp.needsPostprocessing = true;
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
 * @param transformFn Optional transformation function that will be applied to the translation
 *     (e.g.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6RixPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUMsbUJBQW1CLEVBQUUsK0JBQStCLEVBQUUseUJBQXlCLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUNuSSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQixrR0FBa0c7QUFDbEcsTUFBTSxvQkFBb0IsR0FBRyxtQkFBbUIsQ0FBQztBQUVqRDs7OztHQUlHO0FBQ0gsTUFBTSxzQkFBc0IsR0FBRyxPQUFPLENBQUM7QUFFdkMsb0RBQW9EO0FBQ3BELE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLFdBQVcsQ0FBQztBQUVuRDs7R0FFRztBQUNILE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUE0QjtJQUM1RCxNQUFNLG1CQUFtQixHQUNyQixHQUFHLENBQUMsdUJBQXVCLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxHQUFHLENBQUMs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QztRQUN0RCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLElBQUksR0FBRyxHQUFHLE1BQU0sR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsS0FBSyxZQUFZLEVBQUUsQ0FBQztLQUNyRTtTQUFNO1FBQ0wsTUFBTSxNQUFNLEdBQUcseUJBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDaEM7SUFDRCxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3R5cGUgQ29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi8uLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge21hcExpdGVyYWx9IGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9tYXBfdXRpbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7c2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvaTE4bi9nZXRfbXNnX3V0aWxzJztcbmltcG9ydCB7Y3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvaTE4bi9sb2NhbGl6ZV91dGlscyc7XG5pbXBvcnQge2RlY2xhcmVJMThuVmFyaWFibGUsIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXh9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL3V0aWwnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKiogTmFtZSBvZiB0aGUgZ2xvYmFsIHZhcmlhYmxlIHRoYXQgaXMgdXNlZCB0byBkZXRlcm1pbmUgaWYgd2UgdXNlIENsb3N1cmUgdHJhbnNsYXRpb25zIG9yIG5vdCAqL1xuY29uc3QgTkdfSTE4Tl9DTE9TVVJFX01PREUgPSAnbmdJMThuQ2xvc3VyZU1vZGUnO1xuXG4vKipcbiAqIFByZWZpeCBmb3Igbm9uLWBnb29nLmdldE1zZ2AgaTE4bi1yZWxhdGVkIHZhcnMuXG4gKiBOb3RlOiB0aGUgcHJlZml4IHVzZXMgbG93ZXJjYXNlIGNoYXJhY3RlcnMgaW50ZW50aW9uYWxseSBkdWUgdG8gYSBDbG9zdXJlIGJlaGF2aW9yIHRoYXRcbiAqIGNvbnNpZGVycyB2YXJpYWJsZXMgbGlrZSBgSTE4Tl8wYCBhcyBjb25zdGFudHMgYW5kIHRocm93cyBhbiBlcnJvciB3aGVuIHRoZWlyIHZhbHVlIGNoYW5nZXMuXG4gKi9cbmNvbnN0IFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVggPSAnaTE4bl8nO1xuXG4vKiogUHJlZml4IG9mIElDVSBleHByZXNzaW9ucyBmb3IgcG9zdCBwcm9jZXNzaW5nICovXG5leHBvcnQgY29uc3QgSTE4Tl9JQ1VfTUFQUElOR19QUkVGSVggPSAnSTE4Tl9FWFBfJztcblxuLyoqXG4gKiBUaGUgZXNjYXBlIHNlcXVlbmNlIHVzZWQgZm9yIG1lc3NhZ2UgcGFyYW0gdmFsdWVzLlxuICovXG5jb25zdCBFU0NBUEUgPSAnXFx1RkZGRCc7XG5cbi8qKlxuICogTGlmdHMgaTE4biBwcm9wZXJ0aWVzIGludG8gdGhlIGNvbnN0cyBhcnJheS5cbiAqIFRPRE86IENhbiB3ZSB1c2UgYENvbnN0Q29sbGVjdGVkRXhwcmA/XG4gKiBUT0RPOiBUaGUgd2F5IHRoZSB2YXJpb3VzIGF0dHJpYnV0ZXMgYXJlIGxpbmtlZCB0b2dldGhlciBpcyB2ZXJ5IGNvbXBsZXguIFBlcmhhcHMgd2UgY291bGRcbiAqIHNpbXBsaWZ5IHRoZSBwcm9jZXNzLCBtYXliZSBieSBjb21iaW5pbmcgdGhlIGNvbnRleHQgYW5kIG1lc3NhZ2Ugb3BzP1xuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdEkxOG5Db25zdHMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBjb25zdCBmaWxlQmFzZWRJMThuU3VmZml4ID1cbiAgICAgIGpvYi5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKS50b1VwcGVyQ2FzZSgpICsgJ18nO1xuICAvLyBTdGVwIE9uZTogQnVpbGQgdXAgdmFyaW91cyBsb29rdXAgbWFwcyB3ZSBuZWVkIHRvIGNvbGxlY3QgYWxsIHRoZSBjb25zdHMuXG5cbiAgLy8gQ29udGV4dCBYcmVmIC0+IEV4dHJhY3RlZCBBdHRyaWJ1dGUgT3BcbiAgY29uc3QgZXh0cmFjdGVkQXR0cmlidXRlc0J5STE4bkNvbnRleHQgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3A+KCk7XG4gIC8vIFRhcmdldCBYcmVmIChlbGVtZW50IGZvciBpMThuIGF0dHJpYnV0ZXMsIGxhc3QgaXRlbSBpbiBpMThuIGJsb2NrIGZvciBpMThuIHZhbHVlcykgLT4gSTE4blxuICAvLyBBdHRyaWJ1dGVzIGNvbmZpZyBvcFxuICBjb25zdCBpMThuQXR0cmlidXRlc0J5VGFyZ2V0ID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5BdHRyaWJ1dGVzT3A+KCk7XG4gIC8vIFRhcmdldCBFbGVtZW50IFhyZWYgLT4gQWxsIEkxOG4gRXhwcmVzc2lvbiBvcHMgZm9yIHRoYXQgdGFyZ2V0XG4gIGNvbnN0IGkxOG5FeHByZXNzaW9uc0J5VGFyZ2V0ID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5FeHByZXNzaW9uT3BbXT4oKTtcbiAgLy8gSTE4biBNZXNzYWdlIFhyZWYgLT4gSTE4biBNZXNzYWdlIE9wIChUT0RPOiB1c2UgYSBjZW50cmFsIG9wIG1hcClcbiAgY29uc3QgbWVzc2FnZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bk1lc3NhZ2VPcD4oKTtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSAmJiBvcC5pMThuQ29udGV4dCAhPT0gbnVsbCkge1xuICAgICAgICBleHRyYWN0ZWRBdHRyaWJ1dGVzQnlJMThuQ29udGV4dC5zZXQob3AuaTE4bkNvbnRleHQsIG9wKTtcbiAgICAgIH0gZWxzZSBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5BdHRyaWJ1dGVzKSB7XG4gICAgICAgIGkxOG5BdHRyaWJ1dGVzQnlUYXJnZXQuc2V0KG9wLnRhcmdldCwgb3ApO1xuICAgICAgfSBlbHNlIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbnMgPSBpMThuRXhwcmVzc2lvbnNCeVRhcmdldC5nZXQob3AudGFyZ2V0KSA/PyBbXTtcbiAgICAgICAgZXhwcmVzc2lvbnMucHVzaChvcCk7XG4gICAgICAgIGkxOG5FeHByZXNzaW9uc0J5VGFyZ2V0LnNldChvcC50YXJnZXQsIGV4cHJlc3Npb25zKTtcbiAgICAgIH0gZWxzZSBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5NZXNzYWdlKSB7XG4gICAgICAgIG1lc3NhZ2VzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU3RlcCBUd286IFNlcmlhbGl6ZSB0aGUgZXh0cmFjdGVkIGkxOG4gbWVzc2FnZXMgZm9yIHJvb3QgaTE4biBibG9ja3MgYW5kIGkxOG4gYXR0cmlidXRlcyBpbnRvXG4gIC8vIHRoZSBjb25zdCBhcnJheS5cbiAgLy9cbiAgLy8gQWxzbywgZWFjaCBpMThuIG1lc3NhZ2Ugd2lsbCBoYXZlIGEgdmFyaWFibGUgZXhwcmVzc2lvbiB0aGF0IGNhbiByZWZlciB0byBpdHNcbiAgLy8gdmFsdWUuIFN0b3JlIHRoZXNlIGV4cHJlc3Npb25zIGluIHRoZSBhcHByb3ByaWF0ZSBwbGFjZTpcbiAgLy8gMS4gRm9yIG5vcm1hbCBpMThuIGNvbnRlbnQsIGl0IGFsc28gZ29lcyBpbiB0aGUgY29uc3QgYXJyYXkuIFdlIHNhdmUgdGhlIGNvbnN0IGluZGV4IHRvIHVzZVxuICAvLyBsYXRlci5cbiAgLy8gMi4gRm9yIGV4dHJhY3RlZCBhdHRyaWJ1dGVzLCBpdCBiZWNvbWVzIHRoZSB2YWx1ZSBvZiB0aGUgZXh0cmFjdGVkIGF0dHJpYnV0ZSBpbnN0cnVjdGlvbi5cbiAgLy8gMy4gRm9yIGkxOG4gYmluZGluZ3MsIGl0IHdpbGwgZ28gaW4gYSBzZXBhcmF0ZSBjb25zdCBhcnJheSBpbnN0cnVjdGlvbiBiZWxvdzsgZm9yIG5vdywgd2UganVzdFxuICAvLyBzYXZlIGl0LlxuXG4gIGNvbnN0IGkxOG5WYWx1ZXNCeUNvbnRleHQgPSBuZXcgTWFwPGlyLlhyZWZJZCwgby5FeHByZXNzaW9uPigpO1xuICBjb25zdCBtZXNzYWdlQ29uc3RJbmRpY2VzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkNvbnN0SW5kZXg+KCk7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bk1lc3NhZ2UpIHtcbiAgICAgICAgaWYgKG9wLm1lc3NhZ2VQbGFjZWhvbGRlciA9PT0gbnVsbCkge1xuICAgICAgICAgIGNvbnN0IHttYWluVmFyLCBzdGF0ZW1lbnRzfSA9IGNvbGxlY3RNZXNzYWdlKGpvYiwgZmlsZUJhc2VkSTE4blN1ZmZpeCwgbWVzc2FnZXMsIG9wKTtcbiAgICAgICAgICBpZiAob3AuaTE4bkJsb2NrICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBUaGlzIGlzIGEgcmVndWxhciBpMThuIG1lc3NhZ2Ugd2l0aCBhIGNvcnJlc3BvbmRpbmcgaTE4biBibG9jay4gQ29sbGVjdCBpdCBpbnRvIHRoZVxuICAgICAgICAgICAgLy8gY29uc3QgYXJyYXkuXG4gICAgICAgICAgICBjb25zdCBpMThuQ29uc3QgPSBqb2IuYWRkQ29uc3QobWFpblZhciwgc3RhdGVtZW50cyk7XG4gICAgICAgICAgICBtZXNzYWdlQ29uc3RJbmRpY2VzLnNldChvcC5pMThuQmxvY2ssIGkxOG5Db25zdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoaXMgaXMgYW4gaTE4biBhdHRyaWJ1dGUuIEV4dHJhY3QgdGhlIGluaXRpYWxpemVycyBpbnRvIHRoZSBjb25zdCBwb29sLlxuICAgICAgICAgICAgam9iLmNvbnN0c0luaXRpYWxpemVycy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuXG4gICAgICAgICAgICAvLyBTYXZlIHRoZSBpMThuIHZhcmlhYmxlIHZhbHVlIGZvciBsYXRlci5cbiAgICAgICAgICAgIGkxOG5WYWx1ZXNCeUNvbnRleHQuc2V0KG9wLmkxOG5Db250ZXh0LCBtYWluVmFyKTtcblxuICAgICAgICAgICAgLy8gVGhpcyBpMThuIG1lc3NhZ2UgbWF5IGNvcnJlc3BvbmQgdG8gYW4gaW5kaXZpZHVhbCBleHRyYWN0ZWQgYXR0cmlidXRlLiBJZiBzbywgVGhlXG4gICAgICAgICAgICAvLyB2YWx1ZSBvZiB0aGF0IGF0dHJpYnV0ZSBpcyB1cGRhdGVkIHRvIHJlYWQgdGhlIGV4dHJhY3RlZCBpMThuIHZhcmlhYmxlLlxuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlRm9yTWVzc2FnZSA9IGV4dHJhY3RlZEF0dHJpYnV0ZXNCeUkxOG5Db250ZXh0LmdldChvcC5pMThuQ29udGV4dCk7XG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlRm9yTWVzc2FnZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGF0dHJpYnV0ZUZvck1lc3NhZ2UuZXhwcmVzc2lvbiA9IG1haW5WYXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTdGVwIFRocmVlOiBTZXJpYWxpemUgSTE4bkF0dHJpYnV0ZXMgY29uZmlndXJhdGlvbnMgaW50byB0aGUgY29uc3QgYXJyYXkuIEVhY2ggSTE4bkF0dHJpYnV0ZXNcbiAgLy8gaW5zdHJ1Y3Rpb24gaGFzIGEgY29uZmlnIGFycmF5LCB3aGljaCBjb250YWlucyBrLXYgcGFpcnMgZGVzY3JpYmluZyBlYWNoIGJpbmRpbmcgbmFtZSwgYW5kIHRoZVxuICAvLyBpMThuIHZhcmlhYmxlIHRoYXQgcHJvdmlkZXMgdGhlIHZhbHVlLlxuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IGVsZW0gb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKGVsZW0pKSB7XG4gICAgICAgIGNvbnN0IGkxOG5BdHRyaWJ1dGVzID0gaTE4bkF0dHJpYnV0ZXNCeVRhcmdldC5nZXQoZWxlbS54cmVmKTtcbiAgICAgICAgaWYgKGkxOG5BdHRyaWJ1dGVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBUaGlzIGVsZW1lbnQgaXMgbm90IGFzc29jaWF0ZWQgd2l0aCBhbiBpMThuIGF0dHJpYnV0ZXMgY29uZmlndXJhdGlvbiBpbnN0cnVjdGlvbi5cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBpMThuRXhwcmVzc2lvbnMgPSBpMThuRXhwcmVzc2lvbnNCeVRhcmdldC5nZXQoZWxlbS54cmVmKTtcbiAgICAgICAgaWYgKGkxOG5FeHByZXNzaW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gVW51c2VkIGkxOG5BdHRyaWJ1dGVzIHNob3VsZCBoYXZlIGFscmVhZHkgYmVlbiByZW1vdmVkLlxuICAgICAgICAgIC8vIFRPRE86IFNob3VsZCB0aGUgcmVtb3ZhbCBvZiB0aG9zZSBkZWFkIGluc3RydWN0aW9ucyBiZSBtZXJnZWQgd2l0aCB0aGlzIHBoYXNlP1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBDb3VsZCBub3QgZmluZCBhbnkgaTE4biBleHByZXNzaW9ucyBhc3NvY2lhdGVkIHdpdGggYW4gSTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbmQgZXhwcmVzc2lvbnMgZm9yIGFsbCB0aGUgdW5pcXVlIHByb3BlcnR5IG5hbWVzLCByZW1vdmluZyBkdXBsaWNhdGVzLlxuICAgICAgICBjb25zdCBzZWVuUHJvcGVydHlOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBpMThuRXhwcmVzc2lvbnMgPSBpMThuRXhwcmVzc2lvbnMuZmlsdGVyKGkxOG5FeHByID0+IHtcbiAgICAgICAgICBjb25zdCBzZWVuID0gKHNlZW5Qcm9wZXJ0eU5hbWVzLmhhcyhpMThuRXhwci5uYW1lKSk7XG4gICAgICAgICAgc2VlblByb3BlcnR5TmFtZXMuYWRkKGkxOG5FeHByLm5hbWUpO1xuICAgICAgICAgIHJldHVybiAhc2VlbjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgaTE4bkF0dHJpYnV0ZUNvbmZpZyA9IGkxOG5FeHByZXNzaW9ucy5mbGF0TWFwKGkxOG5FeHByID0+IHtcbiAgICAgICAgICBjb25zdCBpMThuRXhwclZhbHVlID0gaTE4blZhbHVlc0J5Q29udGV4dC5nZXQoaTE4bkV4cHIuY29udGV4dCk7XG4gICAgICAgICAgaWYgKGkxOG5FeHByVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBc3NlcnRpb25FcnJvcjogQ291bGQgbm90IGZpbmQgaTE4biBleHByZXNzaW9uXFwncyB2YWx1ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gW28ubGl0ZXJhbChpMThuRXhwci5uYW1lKSwgaTE4bkV4cHJWYWx1ZV07XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgaTE4bkF0dHJpYnV0ZXMuaTE4bkF0dHJpYnV0ZXNDb25maWcgPVxuICAgICAgICAgICAgam9iLmFkZENvbnN0KG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoaTE4bkF0dHJpYnV0ZUNvbmZpZykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFN0ZXAgRm91cjogUHJvcGFnYXRlIHRoZSBleHRyYWN0ZWQgY29uc3QgaW5kZXggaW50byBpMThuIG9wcyB0aGF0IG1lc3NhZ2VzIHdlcmUgZXh0cmFjdGVkIGZyb20uXG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0KSB7XG4gICAgICAgIGNvbnN0IG1zZ0luZGV4ID0gbWVzc2FnZUNvbnN0SW5kaWNlcy5nZXQob3Aucm9vdCk7XG4gICAgICAgIGlmIChtc2dJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IENvdWxkIG5vdCBmaW5kIGNvcnJlc3BvbmRpbmcgaTE4biBibG9jayBpbmRleCBmb3IgYW4gaTE4biBtZXNzYWdlIG9wOyB3YXMgYW4gaTE4biBtZXNzYWdlIGluY29ycmVjdGx5IGFzc3VtZWQgdG8gY29ycmVzcG9uZCB0byBhbiBhdHRyaWJ1dGU/Jyk7XG4gICAgICAgIH1cbiAgICAgICAgb3AubWVzc2FnZUluZGV4ID0gbXNnSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29sbGVjdHMgdGhlIGdpdmVuIG1lc3NhZ2UgaW50byBhIHNldCBvZiBzdGF0ZW1lbnRzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIHRoZSBjb25zdCBhcnJheS5cbiAqIFRoaXMgd2lsbCByZWN1cnNpdmVseSBjb2xsZWN0IGFueSBzdWItbWVzc2FnZXMgcmVmZXJlbmNlZCBmcm9tIHRoZSBwYXJlbnQgbWVzc2FnZSBhcyB3ZWxsLlxuICovXG5mdW5jdGlvbiBjb2xsZWN0TWVzc2FnZShcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmcsXG4gICAgbWVzc2FnZXM6IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5NZXNzYWdlT3A+LFxuICAgIG1lc3NhZ2VPcDogaXIuSTE4bk1lc3NhZ2VPcCk6IHttYWluVmFyOiBvLlJlYWRWYXJFeHByLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB7XG4gIC8vIFJlY3Vyc2l2ZWx5IGNvbGxlY3QgYW55IHN1Yi1tZXNzYWdlcywgcmVjb3JkIGVhY2ggc3ViLW1lc3NhZ2UncyBtYWluIHZhcmlhYmxlIHVuZGVyIGl0c1xuICAvLyBwbGFjZWhvbGRlciBzbyB0aGF0IHdlIGNhbiBhZGQgdGhlbSB0byB0aGUgcGFyYW1zIGZvciB0aGUgcGFyZW50IG1lc3NhZ2UuIEl0IGlzIHBvc3NpYmxlXG4gIC8vIHRoYXQgbXVsdGlwbGUgc3ViLW1lc3NhZ2VzIHdpbGwgc2hhcmUgdGhlIHNhbWUgcGxhY2Vob2xkZXIsIHNvIHdlIG5lZWQgdG8gdHJhY2sgYW4gYXJyYXkgb2ZcbiAgLy8gdmFyaWFibGVzIGZvciBlYWNoIHBsYWNlaG9sZGVyLlxuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnMgPSBuZXcgTWFwPHN0cmluZywgby5FeHByZXNzaW9uW10+KCk7XG4gIGZvciAoY29uc3Qgc3ViTWVzc2FnZUlkIG9mIG1lc3NhZ2VPcC5zdWJNZXNzYWdlcykge1xuICAgIGNvbnN0IHN1Yk1lc3NhZ2UgPSBtZXNzYWdlcy5nZXQoc3ViTWVzc2FnZUlkKSE7XG4gICAgY29uc3Qge21haW5WYXI6IHN1Yk1lc3NhZ2VWYXIsIHN0YXRlbWVudHM6IHN1Yk1lc3NhZ2VTdGF0ZW1lbnRzfSA9XG4gICAgICAgIGNvbGxlY3RNZXNzYWdlKGpvYiwgZmlsZUJhc2VkSTE4blN1ZmZpeCwgbWVzc2FnZXMsIHN1Yk1lc3NhZ2UpO1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zdWJNZXNzYWdlU3RhdGVtZW50cyk7XG4gICAgY29uc3Qgc3ViTWVzc2FnZXMgPSBzdWJNZXNzYWdlUGxhY2Vob2xkZXJzLmdldChzdWJNZXNzYWdlLm1lc3NhZ2VQbGFjZWhvbGRlciEpID8/IFtdO1xuICAgIHN1Yk1lc3NhZ2VzLnB1c2goc3ViTWVzc2FnZVZhcik7XG4gICAgc3ViTWVzc2FnZVBsYWNlaG9sZGVycy5zZXQoc3ViTWVzc2FnZS5tZXNzYWdlUGxhY2Vob2xkZXIhLCBzdWJNZXNzYWdlcyk7XG4gIH1cbiAgYWRkU3ViTWVzc2FnZVBhcmFtcyhtZXNzYWdlT3AsIHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnMpO1xuXG4gIC8vIFNvcnQgdGhlIHBhcmFtcyBmb3IgY29uc2lzdGVuY3kgd2l0aCBUZW1hcGxhdGVEZWZpbml0aW9uQnVpbGRlciBvdXRwdXQuXG4gIG1lc3NhZ2VPcC5wYXJhbXMgPSBuZXcgTWFwKFsuLi5tZXNzYWdlT3AucGFyYW1zLmVudHJpZXMoKV0uc29ydCgpKTtcblxuICBjb25zdCBtYWluVmFyID0gby52YXJpYWJsZShqb2IucG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgpKTtcbiAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlclxuICAvLyBjb25zdCB0byBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlXG4gIC8vIGBnb29nLmdldE1zZ2AgY2FsbFxuICBjb25zdCBjbG9zdXJlVmFyID0gaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihcbiAgICAgIGpvYi5wb29sLCBtZXNzYWdlT3AubWVzc2FnZS5pZCwgZmlsZUJhc2VkSTE4blN1ZmZpeCwgam9iLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG4gIGxldCB0cmFuc2Zvcm1GbiA9IHVuZGVmaW5lZDtcblxuICAvLyBJZiBuZXNjZXNzYXJ5LCBhZGQgYSBwb3N0LXByb2Nlc3Npbmcgc3RlcCBhbmQgcmVzb2x2ZSBhbnkgcGxhY2Vob2xkZXIgcGFyYW1zIHRoYXQgYXJlXG4gIC8vIHNldCBpbiBwb3N0LXByb2Nlc3NpbmcuXG4gIGlmIChtZXNzYWdlT3AubmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgIC8vIFNvcnQgdGhlIHBvc3QtcHJvY2Vzc2luZyBwYXJhbXMgZm9yIGNvbnNpc3RlbmN5IHdpdGggVGVtYXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb3V0cHV0LlxuICAgIGNvbnN0IHBvc3Rwcm9jZXNzaW5nUGFyYW1zID1cbiAgICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKFsuLi5tZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXMuZW50cmllcygpXS5zb3J0KCkpO1xuICAgIGNvbnN0IGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zID1cbiAgICAgICAgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwb3N0cHJvY2Vzc2luZ1BhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKTtcbiAgICBjb25zdCBleHRyYVRyYW5zZm9ybUZuUGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGlmIChtZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXMuc2l6ZSA+IDApIHtcbiAgICAgIGV4dHJhVHJhbnNmb3JtRm5QYXJhbXMucHVzaChtYXBMaXRlcmFsKGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zLCAvKiBxdW90ZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgICB0cmFuc2Zvcm1GbiA9IChleHByOiBvLlJlYWRWYXJFeHByKSA9PlxuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaTE4blBvc3Rwcm9jZXNzKS5jYWxsRm4oW2V4cHIsIC4uLmV4dHJhVHJhbnNmb3JtRm5QYXJhbXNdKTtcbiAgfVxuXG4gIC8vIEFkZCB0aGUgbWVzc2FnZSdzIHN0YXRlbWVudHNcbiAgc3RhdGVtZW50cy5wdXNoKC4uLmdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgICAgbWVzc2FnZU9wLm1lc3NhZ2UsIG1haW5WYXIsIGNsb3N1cmVWYXIsIG1lc3NhZ2VPcC5wYXJhbXMsIHRyYW5zZm9ybUZuKSk7XG5cbiAgcmV0dXJuIHttYWluVmFyLCBzdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBBZGRzIHRoZSBnaXZlbiBzdWJNZXNzYWdlIHBsYWNlaG9sZGVycyB0byB0aGUgZ2l2ZW4gbWVzc2FnZSBvcC5cbiAqXG4gKiBJZiBhIHBsYWNlaG9sZGVyIG9ubHkgY29ycmVzcG9uZHMgdG8gYSBzaW5nbGUgc3ViLW1lc3NhZ2UgdmFyaWFibGUsIHdlIGp1c3Qgc2V0IHRoYXQgdmFyaWFibGVcbiAqIGFzIHRoZSBwYXJhbSB2YWx1ZS4gSG93ZXZlciwgaWYgdGhlIHBsYWNlaG9sZGVyIGNvcnJlc3BvbmRzIHRvIG11bHRpcGxlIHN1Yi1tZXNzYWdlXG4gKiB2YXJpYWJsZXMsIHdlIG5lZWQgdG8gYWRkIGEgc3BlY2lhbCBwbGFjZWhvbGRlciB2YWx1ZSB0aGF0IGlzIGhhbmRsZWQgYnkgdGhlIHBvc3QtcHJvY2Vzc2luZ1xuICogc3RlcC4gV2UgdGhlbiBhZGQgdGhlIGFycmF5IG9mIHZhcmlhYmxlcyBhcyBhIHBvc3QtcHJvY2Vzc2luZyBwYXJhbS5cbiAqL1xuZnVuY3Rpb24gYWRkU3ViTWVzc2FnZVBhcmFtcyhcbiAgICBtZXNzYWdlT3A6IGlyLkkxOG5NZXNzYWdlT3AsIHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbltdPikge1xuICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgc3ViTWVzc2FnZXNdIG9mIHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnMpIHtcbiAgICBpZiAoc3ViTWVzc2FnZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICBtZXNzYWdlT3AucGFyYW1zLnNldChwbGFjZWhvbGRlciwgc3ViTWVzc2FnZXNbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBtZXNzYWdlT3AucGFyYW1zLnNldChcbiAgICAgICAgICBwbGFjZWhvbGRlciwgby5saXRlcmFsKGAke0VTQ0FQRX0ke0kxOE5fSUNVX01BUFBJTkdfUFJFRklYfSR7cGxhY2Vob2xkZXJ9JHtFU0NBUEV9YCkpO1xuICAgICAgbWVzc2FnZU9wLnBvc3Rwcm9jZXNzaW5nUGFyYW1zLnNldChwbGFjZWhvbGRlciwgby5saXRlcmFsQXJyKHN1Yk1lc3NhZ2VzKSk7XG4gICAgICBtZXNzYWdlT3AubmVlZHNQb3N0cHJvY2Vzc2luZyA9IHRydWU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb25cbiAqICAgICAoZS5nLlxuICogcG9zdC1wcm9jZXNzaW5nKS5cbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHN0YXRlbWVudHMgdGhhdCBkZWZpbmVkIGEgZ2l2ZW4gdHJhbnNsYXRpb24uXG4gKi9cbmZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgdmFyaWFibGU6IG8uUmVhZFZhckV4cHIsIGNsb3N1cmVWYXI6IG8uUmVhZFZhckV4cHIsXG4gICAgcGFyYW1zOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHBhcmFtc09iamVjdCA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbXMpO1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW1xuICAgIGRlY2xhcmVJMThuVmFyaWFibGUodmFyaWFibGUpLFxuICAgIG8uaWZTdG10KFxuICAgICAgICBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCksXG4gICAgICAgIGNyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHModmFyaWFibGUsIG1lc3NhZ2UsIGNsb3N1cmVWYXIsIHBhcmFtc09iamVjdCksXG4gICAgICAgIGNyZWF0ZUxvY2FsaXplU3RhdGVtZW50cyhcbiAgICAgICAgICAgIHZhcmlhYmxlLCBtZXNzYWdlLFxuICAgICAgICAgICAgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwYXJhbXNPYmplY3QsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpKSxcbiAgXTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGd1YXJkIHRoZSBjbG9zdXJlIG1vZGUgYmxvY2tcbiAqIEl0IGlzIGVxdWl2YWxlbnQgdG86XG4gKlxuICogYGBgXG4gKiB0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKTogby5CaW5hcnlPcGVyYXRvckV4cHIge1xuICByZXR1cm4gby50eXBlb2ZFeHByKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKVxuICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoJ3VuZGVmaW5lZCcsIG8uU1RSSU5HX1RZUEUpKVxuICAgICAgLmFuZChvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSk7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIHZhcnMgd2l0aCBDbG9zdXJlLXNwZWNpZmljIG5hbWVzIGZvciBpMThuIGJsb2NrcyAoaS5lLiBgTVNHX1hYWGApLlxuICovXG5mdW5jdGlvbiBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKFxuICAgIHBvb2w6IENvbnN0YW50UG9vbCwgbWVzc2FnZUlkOiBzdHJpbmcsIGZpbGVCYXNlZEkxOG5TdWZmaXg6IHN0cmluZyxcbiAgICB1c2VFeHRlcm5hbElkczogYm9vbGVhbik6IG8uUmVhZFZhckV4cHIge1xuICBsZXQgbmFtZTogc3RyaW5nO1xuICBjb25zdCBzdWZmaXggPSBmaWxlQmFzZWRJMThuU3VmZml4O1xuICBpZiAodXNlRXh0ZXJuYWxJZHMpIHtcbiAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICBjb25zdCB1bmlxdWVTdWZmaXggPSBwb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICBuYW1lID0gYCR7cHJlZml4fSR7c2FuaXRpemVJZGVudGlmaWVyKG1lc3NhZ2VJZCl9JCQke3VuaXF1ZVN1ZmZpeH1gO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICBuYW1lID0gcG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gIH1cbiAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG59XG4iXX0=