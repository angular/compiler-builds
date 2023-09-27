/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { ParseError } from '../parse_util';
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
    const node = new t.DeferredBlock(html.visitAll(visitor, ast.children, ast.children), triggers, prefetchTriggers, placeholder, loading, error, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfZGVmZXJyZWRfYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUd6QyxPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUM5QixPQUFPLEVBQUMseUJBQXlCLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFdEgscURBQXFEO0FBQ3JELE1BQU0scUJBQXFCLEdBQUcsb0JBQW9CLENBQUM7QUFFbkQsbURBQW1EO0FBQ25ELE1BQU0sbUJBQW1CLEdBQUcsa0JBQWtCLENBQUM7QUFFL0MsNERBQTREO0FBQzVELE1BQU0seUJBQXlCLEdBQUcsWUFBWSxDQUFDO0FBRS9DLDBEQUEwRDtBQUMxRCxNQUFNLHVCQUF1QixHQUFHLFVBQVUsQ0FBQztBQUUzQyx5REFBeUQ7QUFDekQsTUFBTSxzQkFBc0IsR0FBRyxTQUFTLENBQUM7QUFFekMsdURBQXVEO0FBQ3ZELE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDO0FBRXJDOzs7R0FHRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxJQUFZO0lBQ3BELE9BQU8sSUFBSSxLQUFLLGFBQWEsSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLElBQUksS0FBSyxPQUFPLENBQUM7QUFDMUUsQ0FBQztBQUVELHNEQUFzRDtBQUN0RCxNQUFNLFVBQVUsbUJBQW1CLENBQy9CLEdBQWUsRUFBRSxlQUE2QixFQUFFLE9BQXFCLEVBQ3JFLGFBQTRCO0lBQzlCLE1BQU0sTUFBTSxHQUFpQixFQUFFLENBQUM7SUFD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YSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ2xFO2FBQU0sSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3JELGNBQWMsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1NBQzlEO2FBQU07WUFDTCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO1NBQ3ZFO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFDLENBQUM7QUFDdEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5pbXBvcnQge2dldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQsIHBhcnNlRGVmZXJyZWRUaW1lLCBwYXJzZU9uVHJpZ2dlciwgcGFyc2VXaGVuVHJpZ2dlcn0gZnJvbSAnLi9yM19kZWZlcnJlZF90cmlnZ2Vycyc7XG5cbi8qKiBQYXR0ZXJuIHRvIGlkZW50aWZ5IGEgYHByZWZldGNoIHdoZW5gIHRyaWdnZXIuICovXG5jb25zdCBQUkVGRVRDSF9XSEVOX1BBVFRFUk4gPSAvXnByZWZldGNoXFxzK3doZW5cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBwcmVmZXRjaCBvbmAgdHJpZ2dlci4gKi9cbmNvbnN0IFBSRUZFVENIX09OX1BBVFRFUk4gPSAvXnByZWZldGNoXFxzK29uXFxzLztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgbWluaW11bWAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOID0gL15taW5pbXVtXFxzLztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgYWZ0ZXJgIHBhcmFtZXRlciBpbiBhIGJsb2NrLiAqL1xuY29uc3QgQUZURVJfUEFSQU1FVEVSX1BBVFRFUk4gPSAvXmFmdGVyXFxzLztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgd2hlbmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBXSEVOX1BBUkFNRVRFUl9QQVRURVJOID0gL153aGVuXFxzLztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgb25gIHBhcmFtZXRlciBpbiBhIGJsb2NrLiAqL1xuY29uc3QgT05fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXm9uXFxzLztcblxuLyoqXG4gKiBQcmVkaWNhdGUgZnVuY3Rpb24gdGhhdCBkZXRlcm1pbmVzIGlmIGEgYmxvY2sgd2l0aFxuICogYSBzcGVjaWZpYyBuYW1lIGNhbSBiZSBjb25uZWN0ZWQgdG8gYSBgZGVmZXJgIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNDb25uZWN0ZWREZWZlckxvb3BCbG9jayhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09ICdwbGFjZWhvbGRlcicgfHwgbmFtZSA9PT0gJ2xvYWRpbmcnIHx8IG5hbWUgPT09ICdlcnJvcic7XG59XG5cbi8qKiBDcmVhdGVzIGEgZGVmZXJyZWQgYmxvY2sgZnJvbSBhbiBIVE1MIEFTVCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkQmxvY2soXG4gICAgYXN0OiBodG1sLkJsb2NrLCBjb25uZWN0ZWRCbG9ja3M6IGh0bWwuQmxvY2tbXSwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5EZWZlcnJlZEJsb2NrLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBjb25zdCB7cGxhY2Vob2xkZXIsIGxvYWRpbmcsIGVycm9yfSA9IHBhcnNlQ29ubmVjdGVkQmxvY2tzKGNvbm5lY3RlZEJsb2NrcywgZXJyb3JzLCB2aXNpdG9yKTtcbiAgY29uc3Qge3RyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzfSA9XG4gICAgICBwYXJzZVByaW1hcnlUcmlnZ2Vycyhhc3QucGFyYW1ldGVycywgYmluZGluZ1BhcnNlciwgZXJyb3JzLCBwbGFjZWhvbGRlcik7XG4gIGNvbnN0IG5vZGUgPSBuZXcgdC5EZWZlcnJlZEJsb2NrKFxuICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksIHRyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzLCBwbGFjZWhvbGRlcixcbiAgICAgIGxvYWRpbmcsIGVycm9yLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xuXG4gIHJldHVybiB7bm9kZSwgZXJyb3JzfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VDb25uZWN0ZWRCbG9ja3MoXG4gICAgY29ubmVjdGVkQmxvY2tzOiBodG1sLkJsb2NrW10sIGVycm9yczogUGFyc2VFcnJvcltdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IpIHtcbiAgbGV0IHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsID0gbnVsbDtcbiAgbGV0IGxvYWRpbmc6IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCA9IG51bGw7XG4gIGxldCBlcnJvcjogdC5EZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBjb25uZWN0ZWRCbG9ja3MpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFpc0Nvbm5lY3RlZERlZmVyTG9vcEJsb2NrKGJsb2NrLm5hbWUpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgYFVucmVjb2duaXplZCBibG9jayBcIkAke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGJsb2NrLm5hbWUpIHtcbiAgICAgICAgY2FzZSAncGxhY2Vob2xkZXInOlxuICAgICAgICAgIGlmIChwbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBwbGFjZWhvbGRlciBibG9ja2ApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGxhY2Vob2xkZXIgPSBwYXJzZVBsYWNlaG9sZGVyQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdsb2FkaW5nJzpcbiAgICAgICAgICBpZiAobG9hZGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBsb2FkaW5nIGJsb2NrYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkaW5nID0gcGFyc2VMb2FkaW5nQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgaWYgKGVycm9yICE9PSBudWxsKSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGBAZGVmZXIgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgQGVycm9yIGJsb2NrYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IHBhcnNlRXJyb3JCbG9jayhibG9jaywgdmlzaXRvcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge3BsYWNlaG9sZGVyLCBsb2FkaW5nLCBlcnJvcn07XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGxhY2Vob2xkZXJCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIHtcbiAgbGV0IG1pbmltdW1UaW1lOiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBhc3QucGFyYW1ldGVycykge1xuICAgIGlmIChNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChtaW5pbXVtVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQHBsYWNlaG9sZGVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIFwibWluaW11bVwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJtaW5pbXVtXCJgKTtcbiAgICAgIH1cblxuICAgICAgbWluaW11bVRpbWUgPSBwYXJzZWRUaW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBwYXJhbWV0ZXIgaW4gQHBsYWNlaG9sZGVyIGJsb2NrOiBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgbWluaW11bVRpbWUsIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBwYXJzZUxvYWRpbmdCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmcge1xuICBsZXQgYWZ0ZXJUaW1lOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gIGxldCBtaW5pbXVtVGltZTogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgcGFyYW0gb2YgYXN0LnBhcmFtZXRlcnMpIHtcbiAgICBpZiAoQUZURVJfUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgaWYgKGFmdGVyVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQGxvYWRpbmcgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJhZnRlclwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJhZnRlclwiYCk7XG4gICAgICB9XG5cbiAgICAgIGFmdGVyVGltZSA9IHBhcnNlZFRpbWU7XG4gICAgfSBlbHNlIGlmIChNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChtaW5pbXVtVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQGxvYWRpbmcgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJtaW5pbXVtXCIgcGFyYW1ldGVyYCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhcnNlZFRpbWUgPVxuICAgICAgICAgIHBhcnNlRGVmZXJyZWRUaW1lKHBhcmFtLmV4cHJlc3Npb24uc2xpY2UoZ2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydChwYXJhbS5leHByZXNzaW9uKSkpO1xuXG4gICAgICBpZiAocGFyc2VkVGltZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSB0aW1lIHZhbHVlIG9mIHBhcmFtZXRlciBcIm1pbmltdW1cImApO1xuICAgICAgfVxuXG4gICAgICBtaW5pbXVtVGltZSA9IHBhcnNlZFRpbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIHBhcmFtZXRlciBpbiBAbG9hZGluZyBibG9jazogXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmcoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgYWZ0ZXJUaW1lLCBtaW5pbXVtVGltZSwgYXN0LnNvdXJjZVNwYW4sXG4gICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG59XG5cblxuZnVuY3Rpb24gcGFyc2VFcnJvckJsb2NrKGFzdDogaHRtbC5CbG9jaywgdmlzaXRvcjogaHRtbC5WaXNpdG9yKTogdC5EZWZlcnJlZEJsb2NrRXJyb3Ige1xuICBpZiAoYXN0LnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQGVycm9yIGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnNgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5EZWZlcnJlZEJsb2NrRXJyb3IoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgYXN0LnNvdXJjZVNwYW4sIGFzdC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBhc3QuZW5kU291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJpbWFyeVRyaWdnZXJzKFxuICAgIHBhcmFtczogaHRtbC5CbG9ja1BhcmFtZXRlcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgICBwbGFjZWhvbGRlcjogdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXJ8bnVsbCkge1xuICBjb25zdCB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMgPSB7fTtcbiAgY29uc3QgcHJlZmV0Y2hUcmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMgPSB7fTtcblxuICBmb3IgKGNvbnN0IHBhcmFtIG9mIHBhcmFtcykge1xuICAgIC8vIFRoZSBsZXhlciBpZ25vcmVzIHRoZSBsZWFkaW5nIHNwYWNlcyBzbyB3ZSBjYW4gYXNzdW1lXG4gICAgLy8gdGhhdCB0aGUgZXhwcmVzc2lvbiBzdGFydHMgd2l0aCBhIGtleXdvcmQuXG4gICAgaWYgKFdIRU5fUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgcGFyc2VXaGVuVHJpZ2dlcihwYXJhbSwgYmluZGluZ1BhcnNlciwgdHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIGlmIChPTl9QQVJBTUVURVJfUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBwYXJzZU9uVHJpZ2dlcihwYXJhbSwgdHJpZ2dlcnMsIGVycm9ycywgcGxhY2Vob2xkZXIpO1xuICAgIH0gZWxzZSBpZiAoUFJFRkVUQ0hfV0hFTl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIHBhcnNlV2hlblRyaWdnZXIocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHByZWZldGNoVHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIGlmIChQUkVGRVRDSF9PTl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIHBhcnNlT25UcmlnZ2VyKHBhcmFtLCBwcmVmZXRjaFRyaWdnZXJzLCBlcnJvcnMsIHBsYWNlaG9sZGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ1VucmVjb2duaXplZCB0cmlnZ2VyJykpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7dHJpZ2dlcnMsIHByZWZldGNoVHJpZ2dlcnN9O1xufVxuIl19