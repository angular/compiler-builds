/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { ParseError, ParseSourceSpan } from '../parse_util';
import * as t from './r3_ast';
import { getTriggerParametersStart, parseDeferredTime, parseOnTrigger, parseWhenTrigger } from './r3_deferred_triggers';
/** Pattern to identify a `prefetch when` trigger. */
const PREFETCH_WHEN_PATTERN = /^prefetch\s+when\s/;
/** Pattern to identify a `prefetch on` trigger. */
const PREFETCH_ON_PATTERN = /^prefetch\s+on\s/;
/** Pattern to identify a `minimum` parameter in a block. */
const MINIMUM_PARAMETER_PATTERN = /^minimum\s/;
/** Pattern to identify a `after` parameter in a block. */
const AFTER_PARAMETER_PATTERN = /^after\s/;
/** Pattern to identify a `when` parameter in a block. */
const WHEN_PARAMETER_PATTERN = /^when\s/;
/** Pattern to identify a `on` parameter in a block. */
const ON_PARAMETER_PATTERN = /^on\s/;
/**
 * Predicate function that determines if a block with
 * a specific name cam be connected to a `defer` block.
 */
export function isConnectedDeferLoopBlock(name) {
    return name === 'placeholder' || name === 'loading' || name === 'error';
}
/** Creates a deferred block from an HTML AST node. */
export function createDeferredBlock(ast, connectedBlocks, visitor, bindingParser) {
    const errors = [];
    const { placeholder, loading, error } = parseConnectedBlocks(connectedBlocks, errors, visitor);
    const { triggers, prefetchTriggers } = parsePrimaryTriggers(ast.parameters, bindingParser, errors, placeholder);
    // The `defer` block has a main span encompassing all of the connected branches as well. For the
    // span of only the first "main" branch, use `mainSourceSpan`.
    let lastEndSourceSpan = ast.endSourceSpan;
    let endOfLastSourceSpan = ast.sourceSpan.end;
    if (connectedBlocks.length > 0) {
        const lastConnectedBlock = connectedBlocks[connectedBlocks.length - 1];
        lastEndSourceSpan = lastConnectedBlock.endSourceSpan;
        endOfLastSourceSpan = lastConnectedBlock.sourceSpan.end;
    }
    const mainDeferredSourceSpan = new ParseSourceSpan(ast.sourceSpan.start, endOfLastSourceSpan);
    const node = new t.DeferredBlock(html.visitAll(visitor, ast.children, ast.children), triggers, prefetchTriggers, placeholder, loading, error, mainDeferredSourceSpan, ast.sourceSpan, ast.startSourceSpan, lastEndSourceSpan);
    return { node, errors };
}
function parseConnectedBlocks(connectedBlocks, errors, visitor) {
    let placeholder = null;
    let loading = null;
    let error = null;
    for (const block of connectedBlocks) {
        try {
            if (!isConnectedDeferLoopBlock(block.name)) {
                errors.push(new ParseError(block.startSourceSpan, `Unrecognized block "@${block.name}"`));
                break;
            }
            switch (block.name) {
                case 'placeholder':
                    if (placeholder !== null) {
                        errors.push(new ParseError(block.startSourceSpan, `@defer block can only have one @placeholder block`));
                    }
                    else {
                        placeholder = parsePlaceholderBlock(block, visitor);
                    }
                    break;
                case 'loading':
                    if (loading !== null) {
                        errors.push(new ParseError(block.startSourceSpan, `@defer block can only have one @loading block`));
                    }
                    else {
                        loading = parseLoadingBlock(block, visitor);
                    }
                    break;
                case 'error':
                    if (error !== null) {
                        errors.push(new ParseError(block.startSourceSpan, `@defer block can only have one @error block`));
                    }
                    else {
                        error = parseErrorBlock(block, visitor);
                    }
                    break;
            }
        }
        catch (e) {
            errors.push(new ParseError(block.startSourceSpan, e.message));
        }
    }
    return { placeholder, loading, error };
}
function parsePlaceholderBlock(ast, visitor) {
    let minimumTime = null;
    for (const param of ast.parameters) {
        if (MINIMUM_PARAMETER_PATTERN.test(param.expression)) {
            if (minimumTime != null) {
                throw new Error(`@placeholder block can only have one "minimum" parameter`);
            }
            const parsedTime = parseDeferredTime(param.expression.slice(getTriggerParametersStart(param.expression)));
            if (parsedTime === null) {
                throw new Error(`Could not parse time value of parameter "minimum"`);
            }
            minimumTime = parsedTime;
        }
        else {
            throw new Error(`Unrecognized parameter in @placeholder block: "${param.expression}"`);
        }
    }
    return new t.DeferredBlockPlaceholder(html.visitAll(visitor, ast.children, ast.children), minimumTime, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
}
function parseLoadingBlock(ast, visitor) {
    let afterTime = null;
    let minimumTime = null;
    for (const param of ast.parameters) {
        if (AFTER_PARAMETER_PATTERN.test(param.expression)) {
            if (afterTime != null) {
                throw new Error(`@loading block can only have one "after" parameter`);
            }
            const parsedTime = parseDeferredTime(param.expression.slice(getTriggerParametersStart(param.expression)));
            if (parsedTime === null) {
                throw new Error(`Could not parse time value of parameter "after"`);
            }
            afterTime = parsedTime;
        }
        else if (MINIMUM_PARAMETER_PATTERN.test(param.expression)) {
            if (minimumTime != null) {
                throw new Error(`@loading block can only have one "minimum" parameter`);
            }
            const parsedTime = parseDeferredTime(param.expression.slice(getTriggerParametersStart(param.expression)));
            if (parsedTime === null) {
                throw new Error(`Could not parse time value of parameter "minimum"`);
            }
            minimumTime = parsedTime;
        }
        else {
            throw new Error(`Unrecognized parameter in @loading block: "${param.expression}"`);
        }
    }
    return new t.DeferredBlockLoading(html.visitAll(visitor, ast.children, ast.children), afterTime, minimumTime, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
}
function parseErrorBlock(ast, visitor) {
    if (ast.parameters.length > 0) {
        throw new Error(`@error block cannot have parameters`);
    }
    return new t.DeferredBlockError(html.visitAll(visitor, ast.children, ast.children), ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
}
function parsePrimaryTriggers(params, bindingParser, errors, placeholder) {
    const triggers = {};
    const prefetchTriggers = {};
    for (const param of params) {
        // The lexer ignores the leading spaces so we can assume
        // that the expression starts with a keyword.
        if (WHEN_PARAMETER_PATTERN.test(param.expression)) {
            parseWhenTrigger(param, bindingParser, triggers, errors);
        }
        else if (ON_PARAMETER_PATTERN.test(param.expression)) {
            parseOnTrigger(param, triggers, errors, placeholder);
        }
        else if (PREFETCH_WHEN_PATTERN.test(param.expression)) {
            parseWhenTrigger(param, bindingParser, prefetchTriggers, errors);
        }
        else if (PREFETCH_ON_PATTERN.test(param.expression)) {
            parseOnTrigger(param, prefetchTriggers, errors, placeholder);
        }
        else {
            errors.push(new ParseError(param.sourceSpan, 'Unrecognized trigger'));
        }
    }
    return { triggers, prefetchTriggers };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfZGVmZXJyZWRfYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFDOUIsT0FBTyxFQUFDLHlCQUF5QixFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRXRILHFEQUFxRDtBQUNyRCxNQUFNLHFCQUFxQixHQUFHLG9CQUFvQixDQUFDO0FBRW5ELG1EQUFtRDtBQUNuRCxNQUFNLG1CQUFtQixHQUFHLGtCQUFrQixDQUFDO0FBRS9DLDREQUE0RDtBQUM1RCxNQUFNLHlCQUF5QixHQUFHLFlBQVksQ0FBQztBQUUvQywwREFBMEQ7QUFDMUQsTUFBTSx1QkFBdUIsR0FBRyxVQUFVLENBQUM7QUFFM0MseURBQXlEO0FBQ3pELE1BQU0sc0JBQXNCLEdBQUcsU0FBUyxDQUFDO0FBRXpDLHVEQUF1RDtBQUN2RCxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQztBQUVyQzs7O0dBR0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsSUFBWTtJQUNwRCxPQUFPLElBQUksS0FBSyxhQUFhLElBQUksSUFBSSxLQUFLLFNBQVMsSUFBSSxJQUFJLEtBQUssT0FBTyxDQUFDO0FBQzFFLENBQUM7QUFFRCxzREFBc0Q7QUFDdEQsTUFBTSxVQUFVLG1CQUFtQixDQUMvQixHQUFlLEVBQUUsZUFBNkIsRUFBRSxPQUFxQixFQUNyRSxhQUE0QjtJQUM5QixNQUFNLE1BQU0sR0FBaUIsRUFB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TSxnQkFBZ0IsR0FBNEIsRUFBRSxDQUFDO0lBRXJELEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1FBQzFCLHdEQUF3RDtRQUN4RCw2Q0FBNkM7UUFDN0MsSUFBSSxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ2pELGdCQUFnQixDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQzFEO2FBQU0sSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3RELGNBQWMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztTQUN0RDthQUFNLElBQUkscUJBQXFCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN2RCxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ2xFO2FBQU0sSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3JELGNBQWMsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1NBQzlEO2FBQU07WUFDTCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO1NBQ3ZFO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFDLENBQUM7QUFDdEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcbmltcG9ydCB7Z2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydCwgcGFyc2VEZWZlcnJlZFRpbWUsIHBhcnNlT25UcmlnZ2VyLCBwYXJzZVdoZW5UcmlnZ2VyfSBmcm9tICcuL3IzX2RlZmVycmVkX3RyaWdnZXJzJztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgcHJlZmV0Y2ggd2hlbmAgdHJpZ2dlci4gKi9cbmNvbnN0IFBSRUZFVENIX1dIRU5fUEFUVEVSTiA9IC9ecHJlZmV0Y2hcXHMrd2hlblxccy87XG5cbi8qKiBQYXR0ZXJuIHRvIGlkZW50aWZ5IGEgYHByZWZldGNoIG9uYCB0cmlnZ2VyLiAqL1xuY29uc3QgUFJFRkVUQ0hfT05fUEFUVEVSTiA9IC9ecHJlZmV0Y2hcXHMrb25cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBtaW5pbXVtYCBwYXJhbWV0ZXIgaW4gYSBibG9jay4gKi9cbmNvbnN0IE1JTklNVU1fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXm1pbmltdW1cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBhZnRlcmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBBRlRFUl9QQVJBTUVURVJfUEFUVEVSTiA9IC9eYWZ0ZXJcXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGB3aGVuYCBwYXJhbWV0ZXIgaW4gYSBibG9jay4gKi9cbmNvbnN0IFdIRU5fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXndoZW5cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBvbmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBPTl9QQVJBTUVURVJfUEFUVEVSTiA9IC9eb25cXHMvO1xuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhIGBkZWZlcmAgYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Nvbm5lY3RlZERlZmVyTG9vcEJsb2NrKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PT0gJ3BsYWNlaG9sZGVyJyB8fCBuYW1lID09PSAnbG9hZGluZycgfHwgbmFtZSA9PT0gJ2Vycm9yJztcbn1cblxuLyoqIENyZWF0ZXMgYSBkZWZlcnJlZCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWRCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2ssIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LkRlZmVycmVkQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGNvbnN0IHtwbGFjZWhvbGRlciwgbG9hZGluZywgZXJyb3J9ID0gcGFyc2VDb25uZWN0ZWRCbG9ja3MoY29ubmVjdGVkQmxvY2tzLCBlcnJvcnMsIHZpc2l0b3IpO1xuICBjb25zdCB7dHJpZ2dlcnMsIHByZWZldGNoVHJpZ2dlcnN9ID1cbiAgICAgIHBhcnNlUHJpbWFyeVRyaWdnZXJzKGFzdC5wYXJhbWV0ZXJzLCBiaW5kaW5nUGFyc2VyLCBlcnJvcnMsIHBsYWNlaG9sZGVyKTtcblxuICAvLyBUaGUgYGRlZmVyYCBibG9jayBoYXMgYSBtYWluIHNwYW4gZW5jb21wYXNzaW5nIGFsbCBvZiB0aGUgY29ubmVjdGVkIGJyYW5jaGVzIGFzIHdlbGwuIEZvciB0aGVcbiAgLy8gc3BhbiBvZiBvbmx5IHRoZSBmaXJzdCBcIm1haW5cIiBicmFuY2gsIHVzZSBgbWFpblNvdXJjZVNwYW5gLlxuICBsZXQgbGFzdEVuZFNvdXJjZVNwYW4gPSBhc3QuZW5kU291cmNlU3BhbjtcbiAgbGV0IGVuZE9mTGFzdFNvdXJjZVNwYW4gPSBhc3Quc291cmNlU3Bhbi5lbmQ7XG4gIGlmIChjb25uZWN0ZWRCbG9ja3MubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGxhc3RDb25uZWN0ZWRCbG9jayA9IGNvbm5lY3RlZEJsb2Nrc1tjb25uZWN0ZWRCbG9ja3MubGVuZ3RoIC0gMV07XG4gICAgbGFzdEVuZFNvdXJjZVNwYW4gPSBsYXN0Q29ubmVjdGVkQmxvY2suZW5kU291cmNlU3BhbjtcbiAgICBlbmRPZkxhc3RTb3VyY2VTcGFuID0gbGFzdENvbm5lY3RlZEJsb2NrLnNvdXJjZVNwYW4uZW5kO1xuICB9XG5cbiAgY29uc3QgbWFpbkRlZmVycmVkU291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oYXN0LnNvdXJjZVNwYW4uc3RhcnQsIGVuZE9mTGFzdFNvdXJjZVNwYW4pO1xuXG4gIGNvbnN0IG5vZGUgPSBuZXcgdC5EZWZlcnJlZEJsb2NrKFxuICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksIHRyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzLCBwbGFjZWhvbGRlcixcbiAgICAgIGxvYWRpbmcsIGVycm9yLCBtYWluRGVmZXJyZWRTb3VyY2VTcGFuLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbixcbiAgICAgIGxhc3RFbmRTb3VyY2VTcGFuKTtcblxuICByZXR1cm4ge25vZGUsIGVycm9yc307XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ29ubmVjdGVkQmxvY2tzKFxuICAgIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSwgdmlzaXRvcjogaHRtbC5WaXNpdG9yKSB7XG4gIGxldCBwbGFjZWhvbGRlcjogdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXJ8bnVsbCA9IG51bGw7XG4gIGxldCBsb2FkaW5nOiB0LkRlZmVycmVkQmxvY2tMb2FkaW5nfG51bGwgPSBudWxsO1xuICBsZXQgZXJyb3I6IHQuRGVmZXJyZWRCbG9ja0Vycm9yfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgY29ubmVjdGVkQmxvY2tzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghaXNDb25uZWN0ZWREZWZlckxvb3BCbG9jayhibG9jay5uYW1lKSkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zdGFydFNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgYmxvY2sgXCJAJHtibG9jay5uYW1lfVwiYCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgc3dpdGNoIChibG9jay5uYW1lKSB7XG4gICAgICAgIGNhc2UgJ3BsYWNlaG9sZGVyJzpcbiAgICAgICAgICBpZiAocGxhY2Vob2xkZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgICAgICAgIGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgYEBkZWZlciBibG9jayBjYW4gb25seSBoYXZlIG9uZSBAcGxhY2Vob2xkZXIgYmxvY2tgKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyID0gcGFyc2VQbGFjZWhvbGRlckJsb2NrKGJsb2NrLCB2aXNpdG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnbG9hZGluZyc6XG4gICAgICAgICAgaWYgKGxvYWRpbmcgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgICAgICAgIGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgYEBkZWZlciBibG9jayBjYW4gb25seSBoYXZlIG9uZSBAbG9hZGluZyBibG9ja2ApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9hZGluZyA9IHBhcnNlTG9hZGluZ0Jsb2NrKGJsb2NrLCB2aXNpdG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgIGlmIChlcnJvciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBlcnJvciBibG9ja2ApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXJyb3IgPSBwYXJzZUVycm9yQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zdGFydFNvdXJjZVNwYW4sIChlIGFzIEVycm9yKS5tZXNzYWdlKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtwbGFjZWhvbGRlciwgbG9hZGluZywgZXJyb3J9O1xufVxuXG5mdW5jdGlvbiBwYXJzZVBsYWNlaG9sZGVyQmxvY2soYXN0OiBodG1sLkJsb2NrLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IpOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlciB7XG4gIGxldCBtaW5pbXVtVGltZTogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgcGFyYW0gb2YgYXN0LnBhcmFtZXRlcnMpIHtcbiAgICBpZiAoTUlOSU1VTV9QQVJBTUVURVJfUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBpZiAobWluaW11bVRpbWUgIT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEBwbGFjZWhvbGRlciBibG9jayBjYW4gb25seSBoYXZlIG9uZSBcIm1pbmltdW1cIiBwYXJhbWV0ZXJgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyc2VkVGltZSA9XG4gICAgICAgICAgcGFyc2VEZWZlcnJlZFRpbWUocGFyYW0uZXhwcmVzc2lvbi5zbGljZShnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KHBhcmFtLmV4cHJlc3Npb24pKSk7XG5cbiAgICAgIGlmIChwYXJzZWRUaW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHBhcnNlIHRpbWUgdmFsdWUgb2YgcGFyYW1ldGVyIFwibWluaW11bVwiYCk7XG4gICAgICB9XG5cbiAgICAgIG1pbmltdW1UaW1lID0gcGFyc2VkVGltZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgcGFyYW1ldGVyIGluIEBwbGFjZWhvbGRlciBibG9jazogXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKFxuICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksIG1pbmltdW1UaW1lLCBhc3Quc291cmNlU3BhbixcbiAgICAgIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VMb2FkaW5nQmxvY2soYXN0OiBodG1sLkJsb2NrLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IpOiB0LkRlZmVycmVkQmxvY2tMb2FkaW5nIHtcbiAgbGV0IGFmdGVyVGltZTogbnVtYmVyfG51bGwgPSBudWxsO1xuICBsZXQgbWluaW11bVRpbWU6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICBmb3IgKGNvbnN0IHBhcmFtIG9mIGFzdC5wYXJhbWV0ZXJzKSB7XG4gICAgaWYgKEFGVEVSX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChhZnRlclRpbWUgIT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEBsb2FkaW5nIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIFwiYWZ0ZXJcIiBwYXJhbWV0ZXJgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyc2VkVGltZSA9XG4gICAgICAgICAgcGFyc2VEZWZlcnJlZFRpbWUocGFyYW0uZXhwcmVzc2lvbi5zbGljZShnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KHBhcmFtLmV4cHJlc3Npb24pKSk7XG5cbiAgICAgIGlmIChwYXJzZWRUaW1lID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHBhcnNlIHRpbWUgdmFsdWUgb2YgcGFyYW1ldGVyIFwiYWZ0ZXJcImApO1xuICAgICAgfVxuXG4gICAgICBhZnRlclRpbWUgPSBwYXJzZWRUaW1lO1xuICAgIH0gZWxzZSBpZiAoTUlOSU1VTV9QQVJBTUVURVJfUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBpZiAobWluaW11bVRpbWUgIT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEBsb2FkaW5nIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIFwibWluaW11bVwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJtaW5pbXVtXCJgKTtcbiAgICAgIH1cblxuICAgICAgbWluaW11bVRpbWUgPSBwYXJzZWRUaW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBwYXJhbWV0ZXIgaW4gQGxvYWRpbmcgYmxvY2s6IFwiJHtwYXJhbS5leHByZXNzaW9ufVwiYCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyB0LkRlZmVycmVkQmxvY2tMb2FkaW5nKFxuICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksIGFmdGVyVGltZSwgbWluaW11bVRpbWUsIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xufVxuXG5cbmZ1bmN0aW9uIHBhcnNlRXJyb3JCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja0Vycm9yIHtcbiAgaWYgKGFzdC5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEBlcnJvciBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzYCk7XG4gIH1cblxuICByZXR1cm4gbmV3IHQuRGVmZXJyZWRCbG9ja0Vycm9yKFxuICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgYXN0LmVuZFNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBwYXJzZVByaW1hcnlUcmlnZ2VycyhcbiAgICBwYXJhbXM6IGh0bWwuQmxvY2tQYXJhbWV0ZXJbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZXJyb3JzOiBQYXJzZUVycm9yW10sXG4gICAgcGxhY2Vob2xkZXI6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwpIHtcbiAgY29uc3QgdHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzID0ge307XG4gIGNvbnN0IHByZWZldGNoVHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzID0ge307XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBwYXJhbXMpIHtcbiAgICAvLyBUaGUgbGV4ZXIgaWdub3JlcyB0aGUgbGVhZGluZyBzcGFjZXMgc28gd2UgY2FuIGFzc3VtZVxuICAgIC8vIHRoYXQgdGhlIGV4cHJlc3Npb24gc3RhcnRzIHdpdGggYSBrZXl3b3JkLlxuICAgIGlmIChXSEVOX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIHBhcnNlV2hlblRyaWdnZXIocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHRyaWdnZXJzLCBlcnJvcnMpO1xuICAgIH0gZWxzZSBpZiAoT05fUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgcGFyc2VPblRyaWdnZXIocGFyYW0sIHRyaWdnZXJzLCBlcnJvcnMsIHBsYWNlaG9sZGVyKTtcbiAgICB9IGVsc2UgaWYgKFBSRUZFVENIX1dIRU5fUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBwYXJzZVdoZW5UcmlnZ2VyKHBhcmFtLCBiaW5kaW5nUGFyc2VyLCBwcmVmZXRjaFRyaWdnZXJzLCBlcnJvcnMpO1xuICAgIH0gZWxzZSBpZiAoUFJFRkVUQ0hfT05fUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBwYXJzZU9uVHJpZ2dlcihwYXJhbSwgcHJlZmV0Y2hUcmlnZ2VycywgZXJyb3JzLCBwbGFjZWhvbGRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdVbnJlY29nbml6ZWQgdHJpZ2dlcicpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge3RyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzfTtcbn1cbiJdfQ==