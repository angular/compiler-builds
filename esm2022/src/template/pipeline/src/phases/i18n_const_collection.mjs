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
    // Context Xref -> Extracted Attribute Ops
    const extractedAttributesByI18nContext = new Map();
    // Element/ElementStart Xref -> I18n Attributes config op
    const i18nAttributesByElement = new Map();
    // Element/ElementStart Xref -> All I18n Expression ops for attrs on that target
    const i18nExpressionsByElement = new Map();
    // I18n Message Xref -> I18n Message Op (TODO: use a central op map)
    const messages = new Map();
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            if (op.kind === ir.OpKind.ExtractedAttribute && op.i18nContext !== null) {
                const attributes = extractedAttributesByI18nContext.get(op.i18nContext) ?? [];
                attributes.push(op);
                extractedAttributesByI18nContext.set(op.i18nContext, attributes);
            }
            else if (op.kind === ir.OpKind.I18nAttributes) {
                i18nAttributesByElement.set(op.target, op);
            }
            else if (op.kind === ir.OpKind.I18nExpression && op.usage === ir.I18nExpressionFor.I18nAttribute) {
                const expressions = i18nExpressionsByElement.get(op.target) ?? [];
                expressions.push(op);
                i18nExpressionsByElement.set(op.target, expressions);
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
                        const attributesForMessage = extractedAttributesByI18nContext.get(op.i18nContext);
                        if (attributesForMessage !== undefined) {
                            for (const attr of attributesForMessage) {
                                attr.expression = mainVar.clone();
                            }
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
                const i18nAttributes = i18nAttributesByElement.get(elem.xref);
                if (i18nAttributes === undefined) {
                    // This element is not associated with an i18n attributes configuration instruction.
                    continue;
                }
                let i18nExpressions = i18nExpressionsByElement.get(elem.xref);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6RixPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUMsbUJBQW1CLEVBQUUsK0JBQStCLEVBQUUseUJBQXlCLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUNuSSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQixrR0FBa0c7QUFDbEcsTUFBTSxvQkFBb0IsR0FBRyxtQkFBbUIsQ0FBQztBQUVqRDs7OztHQUlHO0FBQ0gsTUFBTSxzQkFBc0IsR0FBRyxPQUFPLENBQUM7QUFFdkMsb0RBQW9EO0FBQ3BELE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLFdBQVcsQ0FBQztBQUVuRDs7R0FFRztBQUNILE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUE0QjtJQUM1RCxNQUFNLG1CQUFtQixHQUNyQixHQUFHLENBQUMsdUJBQXVCLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxHQUFHLENBQUMs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LENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLHNCQUFzQixDQUMzQixJQUFrQixFQUFFLFNBQWlCLEVBQUUsbUJBQTJCLEVBQ2xFLGNBQXVCO0lBQ3pCLElBQUksSUFBWSxDQUFDO0lBQ2pCLE1BQU0sTUFBTSxHQUFHLG1CQUFtQixDQUFDO0lBQ25DLElBQUksY0FBYyxFQUFFO1FBQ2xCLE1BQU0sTUFBTSxHQUFHLHlCQUF5QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0MsSUFBSSxHQUFHLEdBQUcsTUFBTSxHQUFHLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxLQUFLLFlBQVksRUFBRSxDQUFDO0tBQ3JFO1NBQU07UUFDTCxNQUFNLE1BQU0sR0FBRyx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRCxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNoQztJQUNELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7dHlwZSBDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2NyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL2xvY2FsaXplX3V0aWxzJztcbmltcG9ydCB7ZGVjbGFyZUkxOG5WYXJpYWJsZSwgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcCwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeH0gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vdXRpbCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogUHJlZml4IGZvciBub24tYGdvb2cuZ2V0TXNnYCBpMThuLXJlbGF0ZWQgdmFycy5cbiAqIE5vdGU6IHRoZSBwcmVmaXggdXNlcyBsb3dlcmNhc2UgY2hhcmFjdGVycyBpbnRlbnRpb25hbGx5IGR1ZSB0byBhIENsb3N1cmUgYmVoYXZpb3IgdGhhdFxuICogY29uc2lkZXJzIHZhcmlhYmxlcyBsaWtlIGBJMThOXzBgIGFzIGNvbnN0YW50cyBhbmQgdGhyb3dzIGFuIGVycm9yIHdoZW4gdGhlaXIgdmFsdWUgY2hhbmdlcy5cbiAqL1xuY29uc3QgVFJBTlNMQVRJT05fVkFSX1BSRUZJWCA9ICdpMThuXyc7XG5cbi8qKiBQcmVmaXggb2YgSUNVIGV4cHJlc3Npb25zIGZvciBwb3N0IHByb2Nlc3NpbmcgKi9cbmV4cG9ydCBjb25zdCBJMThOX0lDVV9NQVBQSU5HX1BSRUZJWCA9ICdJMThOX0VYUF8nO1xuXG4vKipcbiAqIFRoZSBlc2NhcGUgc2VxdWVuY2UgdXNlZCBmb3IgbWVzc2FnZSBwYXJhbSB2YWx1ZXMuXG4gKi9cbmNvbnN0IEVTQ0FQRSA9ICdcXHVGRkZEJztcblxuLyoqXG4gKiBMaWZ0cyBpMThuIHByb3BlcnRpZXMgaW50byB0aGUgY29uc3RzIGFycmF5LlxuICogVE9ETzogQ2FuIHdlIHVzZSBgQ29uc3RDb2xsZWN0ZWRFeHByYD9cbiAqIFRPRE86IFRoZSB3YXkgdGhlIHZhcmlvdXMgYXR0cmlidXRlcyBhcmUgbGlua2VkIHRvZ2V0aGVyIGlzIHZlcnkgY29tcGxleC4gUGVyaGFwcyB3ZSBjb3VsZFxuICogc2ltcGxpZnkgdGhlIHByb2Nlc3MsIG1heWJlIGJ5IGNvbWJpbmluZyB0aGUgY29udGV4dCBhbmQgbWVzc2FnZSBvcHM/XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0STE4bkNvbnN0cyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGNvbnN0IGZpbGVCYXNlZEkxOG5TdWZmaXggPVxuICAgICAgam9iLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpLnRvVXBwZXJDYXNlKCkgKyAnXyc7XG4gIC8vIFN0ZXAgT25lOiBCdWlsZCB1cCB2YXJpb3VzIGxvb2t1cCBtYXBzIHdlIG5lZWQgdG8gY29sbGVjdCBhbGwgdGhlIGNvbnN0cy5cblxuICAvLyBDb250ZXh0IFhyZWYgLT4gRXh0cmFjdGVkIEF0dHJpYnV0ZSBPcHNcbiAgY29uc3QgZXh0cmFjdGVkQXR0cmlidXRlc0J5STE4bkNvbnRleHQgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3BbXT4oKTtcbiAgLy8gRWxlbWVudC9FbGVtZW50U3RhcnQgWHJlZiAtPiBJMThuIEF0dHJpYnV0ZXMgY29uZmlnIG9wXG4gIGNvbnN0IGkxOG5BdHRyaWJ1dGVzQnlFbGVtZW50ID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5BdHRyaWJ1dGVzT3A+KCk7XG4gIC8vIEVsZW1lbnQvRWxlbWVudFN0YXJ0IFhyZWYgLT4gQWxsIEkxOG4gRXhwcmVzc2lvbiBvcHMgZm9yIGF0dHJzIG9uIHRoYXQgdGFyZ2V0XG4gIGNvbnN0IGkxOG5FeHByZXNzaW9uc0J5RWxlbWVudCA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuRXhwcmVzc2lvbk9wW10+KCk7XG4gIC8vIEkxOG4gTWVzc2FnZSBYcmVmIC0+IEkxOG4gTWVzc2FnZSBPcCAoVE9ETzogdXNlIGEgY2VudHJhbCBvcCBtYXApXG4gIGNvbnN0IG1lc3NhZ2VzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5NZXNzYWdlT3A+KCk7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUgJiYgb3AuaTE4bkNvbnRleHQgIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IGV4dHJhY3RlZEF0dHJpYnV0ZXNCeUkxOG5Db250ZXh0LmdldChvcC5pMThuQ29udGV4dCkgPz8gW107XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaChvcCk7XG4gICAgICAgIGV4dHJhY3RlZEF0dHJpYnV0ZXNCeUkxOG5Db250ZXh0LnNldChvcC5pMThuQ29udGV4dCwgYXR0cmlidXRlcyk7XG4gICAgICB9IGVsc2UgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuQXR0cmlidXRlcykge1xuICAgICAgICBpMThuQXR0cmlidXRlc0J5RWxlbWVudC5zZXQob3AudGFyZ2V0LCBvcCk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgIG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbiAmJiBvcC51c2FnZSA9PT0gaXIuSTE4bkV4cHJlc3Npb25Gb3IuSTE4bkF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCBleHByZXNzaW9ucyA9IGkxOG5FeHByZXNzaW9uc0J5RWxlbWVudC5nZXQob3AudGFyZ2V0KSA/PyBbXTtcbiAgICAgICAgZXhwcmVzc2lvbnMucHVzaChvcCk7XG4gICAgICAgIGkxOG5FeHByZXNzaW9uc0J5RWxlbWVudC5zZXQob3AudGFyZ2V0LCBleHByZXNzaW9ucyk7XG4gICAgICB9IGVsc2UgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuTWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFN0ZXAgVHdvOiBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBpMThuIG1lc3NhZ2VzIGZvciByb290IGkxOG4gYmxvY2tzIGFuZCBpMThuIGF0dHJpYnV0ZXMgaW50b1xuICAvLyB0aGUgY29uc3QgYXJyYXkuXG4gIC8vXG4gIC8vIEFsc28sIGVhY2ggaTE4biBtZXNzYWdlIHdpbGwgaGF2ZSBhIHZhcmlhYmxlIGV4cHJlc3Npb24gdGhhdCBjYW4gcmVmZXIgdG8gaXRzXG4gIC8vIHZhbHVlLiBTdG9yZSB0aGVzZSBleHByZXNzaW9ucyBpbiB0aGUgYXBwcm9wcmlhdGUgcGxhY2U6XG4gIC8vIDEuIEZvciBub3JtYWwgaTE4biBjb250ZW50LCBpdCBhbHNvIGdvZXMgaW4gdGhlIGNvbnN0IGFycmF5LiBXZSBzYXZlIHRoZSBjb25zdCBpbmRleCB0byB1c2VcbiAgLy8gbGF0ZXIuXG4gIC8vIDIuIEZvciBleHRyYWN0ZWQgYXR0cmlidXRlcywgaXQgYmVjb21lcyB0aGUgdmFsdWUgb2YgdGhlIGV4dHJhY3RlZCBhdHRyaWJ1dGUgaW5zdHJ1Y3Rpb24uXG4gIC8vIDMuIEZvciBpMThuIGJpbmRpbmdzLCBpdCB3aWxsIGdvIGluIGEgc2VwYXJhdGUgY29uc3QgYXJyYXkgaW5zdHJ1Y3Rpb24gYmVsb3c7IGZvciBub3csIHdlIGp1c3RcbiAgLy8gc2F2ZSBpdC5cblxuICBjb25zdCBpMThuVmFsdWVzQnlDb250ZXh0ID0gbmV3IE1hcDxpci5YcmVmSWQsIG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgbWVzc2FnZUNvbnN0SW5kaWNlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5Db25zdEluZGV4PigpO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5NZXNzYWdlKSB7XG4gICAgICAgIGlmIChvcC5tZXNzYWdlUGxhY2Vob2xkZXIgPT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCB7bWFpblZhciwgc3RhdGVtZW50c30gPSBjb2xsZWN0TWVzc2FnZShqb2IsIGZpbGVCYXNlZEkxOG5TdWZmaXgsIG1lc3NhZ2VzLCBvcCk7XG4gICAgICAgICAgaWYgKG9wLmkxOG5CbG9jayAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gVGhpcyBpcyBhIHJlZ3VsYXIgaTE4biBtZXNzYWdlIHdpdGggYSBjb3JyZXNwb25kaW5nIGkxOG4gYmxvY2suIENvbGxlY3QgaXQgaW50byB0aGVcbiAgICAgICAgICAgIC8vIGNvbnN0IGFycmF5LlxuICAgICAgICAgICAgY29uc3QgaTE4bkNvbnN0ID0gam9iLmFkZENvbnN0KG1haW5WYXIsIHN0YXRlbWVudHMpO1xuICAgICAgICAgICAgbWVzc2FnZUNvbnN0SW5kaWNlcy5zZXQob3AuaTE4bkJsb2NrLCBpMThuQ29uc3QpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGlzIGlzIGFuIGkxOG4gYXR0cmlidXRlLiBFeHRyYWN0IHRoZSBpbml0aWFsaXplcnMgaW50byB0aGUgY29uc3QgcG9vbC5cbiAgICAgICAgICAgIGpvYi5jb25zdHNJbml0aWFsaXplcnMucHVzaCguLi5zdGF0ZW1lbnRzKTtcblxuICAgICAgICAgICAgLy8gU2F2ZSB0aGUgaTE4biB2YXJpYWJsZSB2YWx1ZSBmb3IgbGF0ZXIuXG4gICAgICAgICAgICBpMThuVmFsdWVzQnlDb250ZXh0LnNldChvcC5pMThuQ29udGV4dCwgbWFpblZhcik7XG5cbiAgICAgICAgICAgIC8vIFRoaXMgaTE4biBtZXNzYWdlIG1heSBjb3JyZXNwb25kIHRvIGFuIGluZGl2aWR1YWwgZXh0cmFjdGVkIGF0dHJpYnV0ZS4gSWYgc28sIFRoZVxuICAgICAgICAgICAgLy8gdmFsdWUgb2YgdGhhdCBhdHRyaWJ1dGUgaXMgdXBkYXRlZCB0byByZWFkIHRoZSBleHRyYWN0ZWQgaTE4biB2YXJpYWJsZS5cbiAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXNGb3JNZXNzYWdlID0gZXh0cmFjdGVkQXR0cmlidXRlc0J5STE4bkNvbnRleHQuZ2V0KG9wLmkxOG5Db250ZXh0KTtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzRm9yTWVzc2FnZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRyaWJ1dGVzRm9yTWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGF0dHIuZXhwcmVzc2lvbiA9IG1haW5WYXIuY2xvbmUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU3RlcCBUaHJlZTogU2VyaWFsaXplIEkxOG5BdHRyaWJ1dGVzIGNvbmZpZ3VyYXRpb25zIGludG8gdGhlIGNvbnN0IGFycmF5LiBFYWNoIEkxOG5BdHRyaWJ1dGVzXG4gIC8vIGluc3RydWN0aW9uIGhhcyBhIGNvbmZpZyBhcnJheSwgd2hpY2ggY29udGFpbnMgay12IHBhaXJzIGRlc2NyaWJpbmcgZWFjaCBiaW5kaW5nIG5hbWUsIGFuZCB0aGVcbiAgLy8gaTE4biB2YXJpYWJsZSB0aGF0IHByb3ZpZGVzIHRoZSB2YWx1ZS5cblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBlbGVtIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAoaXIuaXNFbGVtZW50T3JDb250YWluZXJPcChlbGVtKSkge1xuICAgICAgICBjb25zdCBpMThuQXR0cmlidXRlcyA9IGkxOG5BdHRyaWJ1dGVzQnlFbGVtZW50LmdldChlbGVtLnhyZWYpO1xuICAgICAgICBpZiAoaTE4bkF0dHJpYnV0ZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFRoaXMgZWxlbWVudCBpcyBub3QgYXNzb2NpYXRlZCB3aXRoIGFuIGkxOG4gYXR0cmlidXRlcyBjb25maWd1cmF0aW9uIGluc3RydWN0aW9uLlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGkxOG5FeHByZXNzaW9ucyA9IGkxOG5FeHByZXNzaW9uc0J5RWxlbWVudC5nZXQoZWxlbS54cmVmKTtcbiAgICAgICAgaWYgKGkxOG5FeHByZXNzaW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gVW51c2VkIGkxOG5BdHRyaWJ1dGVzIHNob3VsZCBoYXZlIGFscmVhZHkgYmVlbiByZW1vdmVkLlxuICAgICAgICAgIC8vIFRPRE86IFNob3VsZCB0aGUgcmVtb3ZhbCBvZiB0aG9zZSBkZWFkIGluc3RydWN0aW9ucyBiZSBtZXJnZWQgd2l0aCB0aGlzIHBoYXNlP1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBDb3VsZCBub3QgZmluZCBhbnkgaTE4biBleHByZXNzaW9ucyBhc3NvY2lhdGVkIHdpdGggYW4gSTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbmQgZXhwcmVzc2lvbnMgZm9yIGFsbCB0aGUgdW5pcXVlIHByb3BlcnR5IG5hbWVzLCByZW1vdmluZyBkdXBsaWNhdGVzLlxuICAgICAgICBjb25zdCBzZWVuUHJvcGVydHlOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBpMThuRXhwcmVzc2lvbnMgPSBpMThuRXhwcmVzc2lvbnMuZmlsdGVyKGkxOG5FeHByID0+IHtcbiAgICAgICAgICBjb25zdCBzZWVuID0gKHNlZW5Qcm9wZXJ0eU5hbWVzLmhhcyhpMThuRXhwci5uYW1lKSk7XG4gICAgICAgICAgc2VlblByb3BlcnR5TmFtZXMuYWRkKGkxOG5FeHByLm5hbWUpO1xuICAgICAgICAgIHJldHVybiAhc2VlbjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgaTE4bkF0dHJpYnV0ZUNvbmZpZyA9IGkxOG5FeHByZXNzaW9ucy5mbGF0TWFwKGkxOG5FeHByID0+IHtcbiAgICAgICAgICBjb25zdCBpMThuRXhwclZhbHVlID0gaTE4blZhbHVlc0J5Q29udGV4dC5nZXQoaTE4bkV4cHIuY29udGV4dCk7XG4gICAgICAgICAgaWYgKGkxOG5FeHByVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBc3NlcnRpb25FcnJvcjogQ291bGQgbm90IGZpbmQgaTE4biBleHByZXNzaW9uXFwncyB2YWx1ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gW28ubGl0ZXJhbChpMThuRXhwci5uYW1lKSwgaTE4bkV4cHJWYWx1ZV07XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgaTE4bkF0dHJpYnV0ZXMuaTE4bkF0dHJpYnV0ZXNDb25maWcgPVxuICAgICAgICAgICAgam9iLmFkZENvbnN0KG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoaTE4bkF0dHJpYnV0ZUNvbmZpZykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFN0ZXAgRm91cjogUHJvcGFnYXRlIHRoZSBleHRyYWN0ZWQgY29uc3QgaW5kZXggaW50byBpMThuIG9wcyB0aGF0IG1lc3NhZ2VzIHdlcmUgZXh0cmFjdGVkIGZyb20uXG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0KSB7XG4gICAgICAgIGNvbnN0IG1zZ0luZGV4ID0gbWVzc2FnZUNvbnN0SW5kaWNlcy5nZXQob3Aucm9vdCk7XG4gICAgICAgIGlmIChtc2dJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IENvdWxkIG5vdCBmaW5kIGNvcnJlc3BvbmRpbmcgaTE4biBibG9jayBpbmRleCBmb3IgYW4gaTE4biBtZXNzYWdlIG9wOyB3YXMgYW4gaTE4biBtZXNzYWdlIGluY29ycmVjdGx5IGFzc3VtZWQgdG8gY29ycmVzcG9uZCB0byBhbiBhdHRyaWJ1dGU/Jyk7XG4gICAgICAgIH1cbiAgICAgICAgb3AubWVzc2FnZUluZGV4ID0gbXNnSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29sbGVjdHMgdGhlIGdpdmVuIG1lc3NhZ2UgaW50byBhIHNldCBvZiBzdGF0ZW1lbnRzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIHRoZSBjb25zdCBhcnJheS5cbiAqIFRoaXMgd2lsbCByZWN1cnNpdmVseSBjb2xsZWN0IGFueSBzdWItbWVzc2FnZXMgcmVmZXJlbmNlZCBmcm9tIHRoZSBwYXJlbnQgbWVzc2FnZSBhcyB3ZWxsLlxuICovXG5mdW5jdGlvbiBjb2xsZWN0TWVzc2FnZShcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmcsXG4gICAgbWVzc2FnZXM6IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5NZXNzYWdlT3A+LFxuICAgIG1lc3NhZ2VPcDogaXIuSTE4bk1lc3NhZ2VPcCk6IHttYWluVmFyOiBvLlJlYWRWYXJFeHByLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB7XG4gIC8vIFJlY3Vyc2l2ZWx5IGNvbGxlY3QgYW55IHN1Yi1tZXNzYWdlcywgcmVjb3JkIGVhY2ggc3ViLW1lc3NhZ2UncyBtYWluIHZhcmlhYmxlIHVuZGVyIGl0c1xuICAvLyBwbGFjZWhvbGRlciBzbyB0aGF0IHdlIGNhbiBhZGQgdGhlbSB0byB0aGUgcGFyYW1zIGZvciB0aGUgcGFyZW50IG1lc3NhZ2UuIEl0IGlzIHBvc3NpYmxlXG4gIC8vIHRoYXQgbXVsdGlwbGUgc3ViLW1lc3NhZ2VzIHdpbGwgc2hhcmUgdGhlIHNhbWUgcGxhY2Vob2xkZXIsIHNvIHdlIG5lZWQgdG8gdHJhY2sgYW4gYXJyYXkgb2ZcbiAgLy8gdmFyaWFibGVzIGZvciBlYWNoIHBsYWNlaG9sZGVyLlxuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnMgPSBuZXcgTWFwPHN0cmluZywgby5FeHByZXNzaW9uW10+KCk7XG4gIGZvciAoY29uc3Qgc3ViTWVzc2FnZUlkIG9mIG1lc3NhZ2VPcC5zdWJNZXNzYWdlcykge1xuICAgIGNvbnN0IHN1Yk1lc3NhZ2UgPSBtZXNzYWdlcy5nZXQoc3ViTWVzc2FnZUlkKSE7XG4gICAgY29uc3Qge21haW5WYXI6IHN1Yk1lc3NhZ2VWYXIsIHN0YXRlbWVudHM6IHN1Yk1lc3NhZ2VTdGF0ZW1lbnRzfSA9XG4gICAgICAgIGNvbGxlY3RNZXNzYWdlKGpvYiwgZmlsZUJhc2VkSTE4blN1ZmZpeCwgbWVzc2FnZXMsIHN1Yk1lc3NhZ2UpO1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zdWJNZXNzYWdlU3RhdGVtZW50cyk7XG4gICAgY29uc3Qgc3ViTWVzc2FnZXMgPSBzdWJNZXNzYWdlUGxhY2Vob2xkZXJzLmdldChzdWJNZXNzYWdlLm1lc3NhZ2VQbGFjZWhvbGRlciEpID8/IFtdO1xuICAgIHN1Yk1lc3NhZ2VzLnB1c2goc3ViTWVzc2FnZVZhcik7XG4gICAgc3ViTWVzc2FnZVBsYWNlaG9sZGVycy5zZXQoc3ViTWVzc2FnZS5tZXNzYWdlUGxhY2Vob2xkZXIhLCBzdWJNZXNzYWdlcyk7XG4gIH1cbiAgYWRkU3ViTWVzc2FnZVBhcmFtcyhtZXNzYWdlT3AsIHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnMpO1xuXG4gIC8vIFNvcnQgdGhlIHBhcmFtcyBmb3IgY29uc2lzdGVuY3kgd2l0aCBUZW1hcGxhdGVEZWZpbml0aW9uQnVpbGRlciBvdXRwdXQuXG4gIG1lc3NhZ2VPcC5wYXJhbXMgPSBuZXcgTWFwKFsuLi5tZXNzYWdlT3AucGFyYW1zLmVudHJpZXMoKV0uc29ydCgpKTtcblxuICBjb25zdCBtYWluVmFyID0gby52YXJpYWJsZShqb2IucG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgpKTtcbiAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlclxuICAvLyBjb25zdCB0byBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlXG4gIC8vIGBnb29nLmdldE1zZ2AgY2FsbFxuICBjb25zdCBjbG9zdXJlVmFyID0gaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihcbiAgICAgIGpvYi5wb29sLCBtZXNzYWdlT3AubWVzc2FnZS5pZCwgZmlsZUJhc2VkSTE4blN1ZmZpeCwgam9iLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG4gIGxldCB0cmFuc2Zvcm1GbiA9IHVuZGVmaW5lZDtcblxuICAvLyBJZiBuZXNjZXNzYXJ5LCBhZGQgYSBwb3N0LXByb2Nlc3Npbmcgc3RlcCBhbmQgcmVzb2x2ZSBhbnkgcGxhY2Vob2xkZXIgcGFyYW1zIHRoYXQgYXJlXG4gIC8vIHNldCBpbiBwb3N0LXByb2Nlc3NpbmcuXG4gIGlmIChtZXNzYWdlT3AubmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgIC8vIFNvcnQgdGhlIHBvc3QtcHJvY2Vzc2luZyBwYXJhbXMgZm9yIGNvbnNpc3RlbmN5IHdpdGggVGVtYXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb3V0cHV0LlxuICAgIGNvbnN0IHBvc3Rwcm9jZXNzaW5nUGFyYW1zID1cbiAgICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKFsuLi5tZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXMuZW50cmllcygpXS5zb3J0KCkpO1xuICAgIGNvbnN0IGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zID1cbiAgICAgICAgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwb3N0cHJvY2Vzc2luZ1BhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKTtcbiAgICBjb25zdCBleHRyYVRyYW5zZm9ybUZuUGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGlmIChtZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXMuc2l6ZSA+IDApIHtcbiAgICAgIGV4dHJhVHJhbnNmb3JtRm5QYXJhbXMucHVzaChtYXBMaXRlcmFsKGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zLCAvKiBxdW90ZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgICB0cmFuc2Zvcm1GbiA9IChleHByOiBvLlJlYWRWYXJFeHByKSA9PlxuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaTE4blBvc3Rwcm9jZXNzKS5jYWxsRm4oW2V4cHIsIC4uLmV4dHJhVHJhbnNmb3JtRm5QYXJhbXNdKTtcbiAgfVxuXG4gIC8vIEFkZCB0aGUgbWVzc2FnZSdzIHN0YXRlbWVudHNcbiAgc3RhdGVtZW50cy5wdXNoKC4uLmdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgICAgbWVzc2FnZU9wLm1lc3NhZ2UsIG1haW5WYXIsIGNsb3N1cmVWYXIsIG1lc3NhZ2VPcC5wYXJhbXMsIHRyYW5zZm9ybUZuKSk7XG5cbiAgcmV0dXJuIHttYWluVmFyLCBzdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBBZGRzIHRoZSBnaXZlbiBzdWJNZXNzYWdlIHBsYWNlaG9sZGVycyB0byB0aGUgZ2l2ZW4gbWVzc2FnZSBvcC5cbiAqXG4gKiBJZiBhIHBsYWNlaG9sZGVyIG9ubHkgY29ycmVzcG9uZHMgdG8gYSBzaW5nbGUgc3ViLW1lc3NhZ2UgdmFyaWFibGUsIHdlIGp1c3Qgc2V0IHRoYXQgdmFyaWFibGVcbiAqIGFzIHRoZSBwYXJhbSB2YWx1ZS4gSG93ZXZlciwgaWYgdGhlIHBsYWNlaG9sZGVyIGNvcnJlc3BvbmRzIHRvIG11bHRpcGxlIHN1Yi1tZXNzYWdlXG4gKiB2YXJpYWJsZXMsIHdlIG5lZWQgdG8gYWRkIGEgc3BlY2lhbCBwbGFjZWhvbGRlciB2YWx1ZSB0aGF0IGlzIGhhbmRsZWQgYnkgdGhlIHBvc3QtcHJvY2Vzc2luZ1xuICogc3RlcC4gV2UgdGhlbiBhZGQgdGhlIGFycmF5IG9mIHZhcmlhYmxlcyBhcyBhIHBvc3QtcHJvY2Vzc2luZyBwYXJhbS5cbiAqL1xuZnVuY3Rpb24gYWRkU3ViTWVzc2FnZVBhcmFtcyhcbiAgICBtZXNzYWdlT3A6IGlyLkkxOG5NZXNzYWdlT3AsIHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnM6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbltdPikge1xuICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgc3ViTWVzc2FnZXNdIG9mIHN1Yk1lc3NhZ2VQbGFjZWhvbGRlcnMpIHtcbiAgICBpZiAoc3ViTWVzc2FnZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICBtZXNzYWdlT3AucGFyYW1zLnNldChwbGFjZWhvbGRlciwgc3ViTWVzc2FnZXNbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBtZXNzYWdlT3AucGFyYW1zLnNldChcbiAgICAgICAgICBwbGFjZWhvbGRlciwgby5saXRlcmFsKGAke0VTQ0FQRX0ke0kxOE5fSUNVX01BUFBJTkdfUFJFRklYfSR7cGxhY2Vob2xkZXJ9JHtFU0NBUEV9YCkpO1xuICAgICAgbWVzc2FnZU9wLnBvc3Rwcm9jZXNzaW5nUGFyYW1zLnNldChwbGFjZWhvbGRlciwgby5saXRlcmFsQXJyKHN1Yk1lc3NhZ2VzKSk7XG4gICAgICBtZXNzYWdlT3AubmVlZHNQb3N0cHJvY2Vzc2luZyA9IHRydWU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb25cbiAqICAgICAoZS5nLlxuICogcG9zdC1wcm9jZXNzaW5nKS5cbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHN0YXRlbWVudHMgdGhhdCBkZWZpbmVkIGEgZ2l2ZW4gdHJhbnNsYXRpb24uXG4gKi9cbmZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgdmFyaWFibGU6IG8uUmVhZFZhckV4cHIsIGNsb3N1cmVWYXI6IG8uUmVhZFZhckV4cHIsXG4gICAgcGFyYW1zOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHBhcmFtc09iamVjdCA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbXMpO1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW1xuICAgIGRlY2xhcmVJMThuVmFyaWFibGUodmFyaWFibGUpLFxuICAgIG8uaWZTdG10KFxuICAgICAgICBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCksXG4gICAgICAgIGNyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHModmFyaWFibGUsIG1lc3NhZ2UsIGNsb3N1cmVWYXIsIHBhcmFtc09iamVjdCksXG4gICAgICAgIGNyZWF0ZUxvY2FsaXplU3RhdGVtZW50cyhcbiAgICAgICAgICAgIHZhcmlhYmxlLCBtZXNzYWdlLFxuICAgICAgICAgICAgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwYXJhbXNPYmplY3QsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpKSxcbiAgXTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGd1YXJkIHRoZSBjbG9zdXJlIG1vZGUgYmxvY2tcbiAqIEl0IGlzIGVxdWl2YWxlbnQgdG86XG4gKlxuICogYGBgXG4gKiB0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKTogby5CaW5hcnlPcGVyYXRvckV4cHIge1xuICByZXR1cm4gby50eXBlb2ZFeHByKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKVxuICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoJ3VuZGVmaW5lZCcsIG8uU1RSSU5HX1RZUEUpKVxuICAgICAgLmFuZChvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSk7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIHZhcnMgd2l0aCBDbG9zdXJlLXNwZWNpZmljIG5hbWVzIGZvciBpMThuIGJsb2NrcyAoaS5lLiBgTVNHX1hYWGApLlxuICovXG5mdW5jdGlvbiBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKFxuICAgIHBvb2w6IENvbnN0YW50UG9vbCwgbWVzc2FnZUlkOiBzdHJpbmcsIGZpbGVCYXNlZEkxOG5TdWZmaXg6IHN0cmluZyxcbiAgICB1c2VFeHRlcm5hbElkczogYm9vbGVhbik6IG8uUmVhZFZhckV4cHIge1xuICBsZXQgbmFtZTogc3RyaW5nO1xuICBjb25zdCBzdWZmaXggPSBmaWxlQmFzZWRJMThuU3VmZml4O1xuICBpZiAodXNlRXh0ZXJuYWxJZHMpIHtcbiAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICBjb25zdCB1bmlxdWVTdWZmaXggPSBwb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICBuYW1lID0gYCR7cHJlZml4fSR7c2FuaXRpemVJZGVudGlmaWVyKG1lc3NhZ2VJZCl9JCQke3VuaXF1ZVN1ZmZpeH1gO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICBuYW1lID0gcG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gIH1cbiAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG59XG4iXX0=