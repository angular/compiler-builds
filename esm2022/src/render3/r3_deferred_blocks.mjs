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
    // The `defer` block has a main span encompassing all of the connected branches as well.
    let lastEndSourceSpan = ast.endSourceSpan;
    let endOfLastSourceSpan = ast.sourceSpan.end;
    if (connectedBlocks.length > 0) {
        const lastConnectedBlock = connectedBlocks[connectedBlocks.length - 1];
        lastEndSourceSpan = lastConnectedBlock.endSourceSpan;
        endOfLastSourceSpan = lastConnectedBlock.sourceSpan.end;
    }
    const sourceSpanWithConnectedBlocks = new ParseSourceSpan(ast.sourceSpan.start, endOfLastSourceSpan);
    const node = new t.DeferredBlock(html.visitAll(visitor, ast.children, ast.children), triggers, prefetchTriggers, placeholder, loading, error, ast.nameSpan, sourceSpanWithConnectedBlocks, ast.sourceSpan, ast.startSourceSpan, lastEndSourceSpan, ast.i18n);
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
    return new t.DeferredBlockPlaceholder(html.visitAll(visitor, ast.children, ast.children), minimumTime, ast.nameSpan, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.i18n);
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
    return new t.DeferredBlockLoading(html.visitAll(visitor, ast.children, ast.children), afterTime, minimumTime, ast.nameSpan, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.i18n);
}
function parseErrorBlock(ast, visitor) {
    if (ast.parameters.length > 0) {
        throw new Error(`@error block cannot have parameters`);
    }
    return new t.DeferredBlockError(html.visitAll(visitor, ast.children, ast.children), ast.nameSpan, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.i18n);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfZGVmZXJyZWRfYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFDOUIsT0FBTyxFQUFDLHlCQUF5QixFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRXRILHFEQUFxRDtBQUNyRCxNQUFNLHFCQUFxQixHQUFHLG9CQUFvQixDQUFDO0FBRW5ELG1EQUFtRDtBQUNuRCxNQUFNLG1CQUFtQixHQUFHLGtCQUFrQixDQUFDO0FBRS9DLDREQUE0RDtBQUM1RCxNQUFNLHlCQUF5QixHQUFHLFlBQVksQ0FBQztBQUUvQywwREFBMEQ7QUFDMUQsTUFBTSx1QkFBdUIsR0FBRyxVQUFVLENBQUM7QUFFM0MseURBQXlEO0FBQ3pELE1BQU0sc0JBQXNCLEdBQUcsU0FBUyxDQUFDO0FBRXpDLHVEQUF1RDtBQUN2RCxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQztBQUVyQzs7O0dBR0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsSUFBWTtJQUNwRCxPQUFPLElBQUksS0FBSyxhQUFhLElBQUksSUFBSSxLQUFLLFNBQVMsSUFBSSxJQUFJLEtBQUssT0FBTyxDQUFDO0FBQzFFLENBQUM7QUFFRCxzREFBc0Q7QUFDdEQsTUFBTSxVQUFVLG1CQUFtQixDQUMvQixHQUFlLEVBQUUsZUFBNkIsRUFBRSxPQUFxQixFQUNyRSxhQUE0QjtJQUM5QixNQUFNLE1BQU0sR0FBaUIsRUFB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Q25FLENBQUM7YUFBTSxJQUFJLG1CQUFtQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUN0RCxjQUFjLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztRQUMvRCxDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7UUFDeEUsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLEVBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFDLENBQUM7QUFDdEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcbmltcG9ydCB7Z2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydCwgcGFyc2VEZWZlcnJlZFRpbWUsIHBhcnNlT25UcmlnZ2VyLCBwYXJzZVdoZW5UcmlnZ2VyfSBmcm9tICcuL3IzX2RlZmVycmVkX3RyaWdnZXJzJztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgcHJlZmV0Y2ggd2hlbmAgdHJpZ2dlci4gKi9cbmNvbnN0IFBSRUZFVENIX1dIRU5fUEFUVEVSTiA9IC9ecHJlZmV0Y2hcXHMrd2hlblxccy87XG5cbi8qKiBQYXR0ZXJuIHRvIGlkZW50aWZ5IGEgYHByZWZldGNoIG9uYCB0cmlnZ2VyLiAqL1xuY29uc3QgUFJFRkVUQ0hfT05fUEFUVEVSTiA9IC9ecHJlZmV0Y2hcXHMrb25cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBtaW5pbXVtYCBwYXJhbWV0ZXIgaW4gYSBibG9jay4gKi9cbmNvbnN0IE1JTklNVU1fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXm1pbmltdW1cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBhZnRlcmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBBRlRFUl9QQVJBTUVURVJfUEFUVEVSTiA9IC9eYWZ0ZXJcXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGB3aGVuYCBwYXJhbWV0ZXIgaW4gYSBibG9jay4gKi9cbmNvbnN0IFdIRU5fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXndoZW5cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBvbmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBPTl9QQVJBTUVURVJfUEFUVEVSTiA9IC9eb25cXHMvO1xuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhIGBkZWZlcmAgYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Nvbm5lY3RlZERlZmVyTG9vcEJsb2NrKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PT0gJ3BsYWNlaG9sZGVyJyB8fCBuYW1lID09PSAnbG9hZGluZycgfHwgbmFtZSA9PT0gJ2Vycm9yJztcbn1cblxuLyoqIENyZWF0ZXMgYSBkZWZlcnJlZCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWRCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2ssIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LkRlZmVycmVkQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGNvbnN0IHtwbGFjZWhvbGRlciwgbG9hZGluZywgZXJyb3J9ID0gcGFyc2VDb25uZWN0ZWRCbG9ja3MoY29ubmVjdGVkQmxvY2tzLCBlcnJvcnMsIHZpc2l0b3IpO1xuICBjb25zdCB7dHJpZ2dlcnMsIHByZWZldGNoVHJpZ2dlcnN9ID1cbiAgICAgIHBhcnNlUHJpbWFyeVRyaWdnZXJzKGFzdC5wYXJhbWV0ZXJzLCBiaW5kaW5nUGFyc2VyLCBlcnJvcnMsIHBsYWNlaG9sZGVyKTtcblxuICAvLyBUaGUgYGRlZmVyYCBibG9jayBoYXMgYSBtYWluIHNwYW4gZW5jb21wYXNzaW5nIGFsbCBvZiB0aGUgY29ubmVjdGVkIGJyYW5jaGVzIGFzIHdlbGwuXG4gIGxldCBsYXN0RW5kU291cmNlU3BhbiA9IGFzdC5lbmRTb3VyY2VTcGFuO1xuICBsZXQgZW5kT2ZMYXN0U291cmNlU3BhbiA9IGFzdC5zb3VyY2VTcGFuLmVuZDtcbiAgaWYgKGNvbm5lY3RlZEJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbGFzdENvbm5lY3RlZEJsb2NrID0gY29ubmVjdGVkQmxvY2tzW2Nvbm5lY3RlZEJsb2Nrcy5sZW5ndGggLSAxXTtcbiAgICBsYXN0RW5kU291cmNlU3BhbiA9IGxhc3RDb25uZWN0ZWRCbG9jay5lbmRTb3VyY2VTcGFuO1xuICAgIGVuZE9mTGFzdFNvdXJjZVNwYW4gPSBsYXN0Q29ubmVjdGVkQmxvY2suc291cmNlU3Bhbi5lbmQ7XG4gIH1cblxuICBjb25zdCBzb3VyY2VTcGFuV2l0aENvbm5lY3RlZEJsb2NrcyA9XG4gICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGFzdC5zb3VyY2VTcGFuLnN0YXJ0LCBlbmRPZkxhc3RTb3VyY2VTcGFuKTtcblxuICBjb25zdCBub2RlID0gbmV3IHQuRGVmZXJyZWRCbG9jayhcbiAgICAgIGh0bWwudmlzaXRBbGwodmlzaXRvciwgYXN0LmNoaWxkcmVuLCBhc3QuY2hpbGRyZW4pLCB0cmlnZ2VycywgcHJlZmV0Y2hUcmlnZ2VycywgcGxhY2Vob2xkZXIsXG4gICAgICBsb2FkaW5nLCBlcnJvciwgYXN0Lm5hbWVTcGFuLCBzb3VyY2VTcGFuV2l0aENvbm5lY3RlZEJsb2NrcywgYXN0LnNvdXJjZVNwYW4sXG4gICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBsYXN0RW5kU291cmNlU3BhbiwgYXN0LmkxOG4pO1xuXG4gIHJldHVybiB7bm9kZSwgZXJyb3JzfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VDb25uZWN0ZWRCbG9ja3MoXG4gICAgY29ubmVjdGVkQmxvY2tzOiBodG1sLkJsb2NrW10sIGVycm9yczogUGFyc2VFcnJvcltdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IpIHtcbiAgbGV0IHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsID0gbnVsbDtcbiAgbGV0IGxvYWRpbmc6IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCA9IG51bGw7XG4gIGxldCBlcnJvcjogdC5EZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBjb25uZWN0ZWRCbG9ja3MpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFpc0Nvbm5lY3RlZERlZmVyTG9vcEJsb2NrKGJsb2NrLm5hbWUpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgYFVucmVjb2duaXplZCBibG9jayBcIkAke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGJsb2NrLm5hbWUpIHtcbiAgICAgICAgY2FzZSAncGxhY2Vob2xkZXInOlxuICAgICAgICAgIGlmIChwbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBwbGFjZWhvbGRlciBibG9ja2ApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGxhY2Vob2xkZXIgPSBwYXJzZVBsYWNlaG9sZGVyQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdsb2FkaW5nJzpcbiAgICAgICAgICBpZiAobG9hZGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBsb2FkaW5nIGJsb2NrYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkaW5nID0gcGFyc2VMb2FkaW5nQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgaWYgKGVycm9yICE9PSBudWxsKSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGBAZGVmZXIgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgQGVycm9yIGJsb2NrYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IHBhcnNlRXJyb3JCbG9jayhibG9jaywgdmlzaXRvcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge3BsYWNlaG9sZGVyLCBsb2FkaW5nLCBlcnJvcn07XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGxhY2Vob2xkZXJCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIHtcbiAgbGV0IG1pbmltdW1UaW1lOiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBhc3QucGFyYW1ldGVycykge1xuICAgIGlmIChNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChtaW5pbXVtVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQHBsYWNlaG9sZGVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIFwibWluaW11bVwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJtaW5pbXVtXCJgKTtcbiAgICAgIH1cblxuICAgICAgbWluaW11bVRpbWUgPSBwYXJzZWRUaW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBwYXJhbWV0ZXIgaW4gQHBsYWNlaG9sZGVyIGJsb2NrOiBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgbWluaW11bVRpbWUsIGFzdC5uYW1lU3BhbiwgYXN0LnNvdXJjZVNwYW4sXG4gICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3BhbiwgYXN0LmkxOG4pO1xufVxuXG5mdW5jdGlvbiBwYXJzZUxvYWRpbmdCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmcge1xuICBsZXQgYWZ0ZXJUaW1lOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gIGxldCBtaW5pbXVtVGltZTogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgcGFyYW0gb2YgYXN0LnBhcmFtZXRlcnMpIHtcbiAgICBpZiAoQUZURVJfUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgaWYgKGFmdGVyVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQGxvYWRpbmcgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJhZnRlclwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJhZnRlclwiYCk7XG4gICAgICB9XG5cbiAgICAgIGFmdGVyVGltZSA9IHBhcnNlZFRpbWU7XG4gICAgfSBlbHNlIGlmIChNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChtaW5pbXVtVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQGxvYWRpbmcgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJtaW5pbXVtXCIgcGFyYW1ldGVyYCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhcnNlZFRpbWUgPVxuICAgICAgICAgIHBhcnNlRGVmZXJyZWRUaW1lKHBhcmFtLmV4cHJlc3Npb24uc2xpY2UoZ2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydChwYXJhbS5leHByZXNzaW9uKSkpO1xuXG4gICAgICBpZiAocGFyc2VkVGltZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSB0aW1lIHZhbHVlIG9mIHBhcmFtZXRlciBcIm1pbmltdW1cImApO1xuICAgICAgfVxuXG4gICAgICBtaW5pbXVtVGltZSA9IHBhcnNlZFRpbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIHBhcmFtZXRlciBpbiBAbG9hZGluZyBibG9jazogXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmcoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgYWZ0ZXJUaW1lLCBtaW5pbXVtVGltZSwgYXN0Lm5hbWVTcGFuLFxuICAgICAgYXN0LnNvdXJjZVNwYW4sIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuLCBhc3QuaTE4bik7XG59XG5cblxuZnVuY3Rpb24gcGFyc2VFcnJvckJsb2NrKGFzdDogaHRtbC5CbG9jaywgdmlzaXRvcjogaHRtbC5WaXNpdG9yKTogdC5EZWZlcnJlZEJsb2NrRXJyb3Ige1xuICBpZiAoYXN0LnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQGVycm9yIGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnNgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5EZWZlcnJlZEJsb2NrRXJyb3IoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgYXN0Lm5hbWVTcGFuLCBhc3Quc291cmNlU3BhbixcbiAgICAgIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuLCBhc3QuaTE4bik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJpbWFyeVRyaWdnZXJzKFxuICAgIHBhcmFtczogaHRtbC5CbG9ja1BhcmFtZXRlcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgICBwbGFjZWhvbGRlcjogdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXJ8bnVsbCkge1xuICBjb25zdCB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMgPSB7fTtcbiAgY29uc3QgcHJlZmV0Y2hUcmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMgPSB7fTtcblxuICBmb3IgKGNvbnN0IHBhcmFtIG9mIHBhcmFtcykge1xuICAgIC8vIFRoZSBsZXhlciBpZ25vcmVzIHRoZSBsZWFkaW5nIHNwYWNlcyBzbyB3ZSBjYW4gYXNzdW1lXG4gICAgLy8gdGhhdCB0aGUgZXhwcmVzc2lvbiBzdGFydHMgd2l0aCBhIGtleXdvcmQuXG4gICAgaWYgKFdIRU5fUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgcGFyc2VXaGVuVHJpZ2dlcihwYXJhbSwgYmluZGluZ1BhcnNlciwgdHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIGlmIChPTl9QQVJBTUVURVJfUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBwYXJzZU9uVHJpZ2dlcihwYXJhbSwgdHJpZ2dlcnMsIGVycm9ycywgcGxhY2Vob2xkZXIpO1xuICAgIH0gZWxzZSBpZiAoUFJFRkVUQ0hfV0hFTl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIHBhcnNlV2hlblRyaWdnZXIocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHByZWZldGNoVHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIGlmIChQUkVGRVRDSF9PTl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIHBhcnNlT25UcmlnZ2VyKHBhcmFtLCBwcmVmZXRjaFRyaWdnZXJzLCBlcnJvcnMsIHBsYWNlaG9sZGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ1VucmVjb2duaXplZCB0cmlnZ2VyJykpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7dHJpZ2dlcnMsIHByZWZldGNoVHJpZ2dlcnN9O1xufVxuIl19