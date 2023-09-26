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
    const { triggers, prefetchTriggers } = parsePrimaryTriggers(ast.parameters, bindingParser, errors);
    const { placeholder, loading, error } = parseConnectedBlocks(connectedBlocks, errors, visitor);
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
function parsePrimaryTriggers(params, bindingParser, errors) {
    const triggers = {};
    const prefetchTriggers = {};
    for (const param of params) {
        // The lexer ignores the leading spaces so we can assume
        // that the expression starts with a keyword.
        if (WHEN_PARAMETER_PATTERN.test(param.expression)) {
            parseWhenTrigger(param, bindingParser, triggers, errors);
        }
        else if (ON_PARAMETER_PATTERN.test(param.expression)) {
            parseOnTrigger(param, triggers, errors);
        }
        else if (PREFETCH_WHEN_PATTERN.test(param.expression)) {
            parseWhenTrigger(param, bindingParser, prefetchTriggers, errors);
        }
        else if (PREFETCH_ON_PATTERN.test(param.expression)) {
            parseOnTrigger(param, prefetchTriggers, errors);
        }
        else {
            errors.push(new ParseError(param.sourceSpan, 'Unrecognized trigger'));
        }
    }
    return { triggers, prefetchTriggers };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfZGVmZXJyZWRfYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUd6QyxPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUM5QixPQUFPLEVBQUMseUJBQXlCLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFdEgscURBQXFEO0FBQ3JELE1BQU0scUJBQXFCLEdBQUcsb0JBQW9CLENBQUM7QUFFbkQsbURBQW1EO0FBQ25ELE1BQU0sbUJBQW1CLEdBQUcsa0JBQWtCLENBQUM7QUFFL0MsNERBQTREO0FBQzVELE1BQU0seUJBQXlCLEdBQUcsWUFBWSxDQUFDO0FBRS9DLDBEQUEwRDtBQUMxRCxNQUFNLHVCQUF1QixHQUFHLFVBQVUsQ0FBQztBQUUzQyx5REFBeUQ7QUFDekQsTUFBTSxzQkFBc0IsR0FBRyxTQUFTLENBQUM7QUFFekMsdURBQXVEO0FBQ3ZELE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDO0FBRXJDOzs7R0FHRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxJQUFZO0lBQ3BELE9BQU8sSUFBSSxLQUFLLGFBQWEsSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLElBQUksS0FBSyxPQUFPLENBQUM7QUFDMUUsQ0FBQztBQUVELHNEQUFzRDtBQUN0RCxNQUFNLFVBQVUsbUJBQW1CLENBQy9CLEdBQWUsRUFBRSxlQUE2QixFQUFFLE9BQXFCLEVBQ3JFLGFBQTRCO0lBQzlCLE1BQU0sTUFBTSxHQUFpQixFQUFFLENBQUM7SUFD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O1NBQ2xFO2FBQU0sSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3JELGNBQWMsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDakQ7YUFBTTtZQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7U0FDdkU7S0FDRjtJQUVELE9BQU8sRUFBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3J9IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcbmltcG9ydCB7Z2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydCwgcGFyc2VEZWZlcnJlZFRpbWUsIHBhcnNlT25UcmlnZ2VyLCBwYXJzZVdoZW5UcmlnZ2VyfSBmcm9tICcuL3IzX2RlZmVycmVkX3RyaWdnZXJzJztcblxuLyoqIFBhdHRlcm4gdG8gaWRlbnRpZnkgYSBgcHJlZmV0Y2ggd2hlbmAgdHJpZ2dlci4gKi9cbmNvbnN0IFBSRUZFVENIX1dIRU5fUEFUVEVSTiA9IC9ecHJlZmV0Y2hcXHMrd2hlblxccy87XG5cbi8qKiBQYXR0ZXJuIHRvIGlkZW50aWZ5IGEgYHByZWZldGNoIG9uYCB0cmlnZ2VyLiAqL1xuY29uc3QgUFJFRkVUQ0hfT05fUEFUVEVSTiA9IC9ecHJlZmV0Y2hcXHMrb25cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBtaW5pbXVtYCBwYXJhbWV0ZXIgaW4gYSBibG9jay4gKi9cbmNvbnN0IE1JTklNVU1fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXm1pbmltdW1cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBhZnRlcmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBBRlRFUl9QQVJBTUVURVJfUEFUVEVSTiA9IC9eYWZ0ZXJcXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGB3aGVuYCBwYXJhbWV0ZXIgaW4gYSBibG9jay4gKi9cbmNvbnN0IFdIRU5fUEFSQU1FVEVSX1BBVFRFUk4gPSAvXndoZW5cXHMvO1xuXG4vKiogUGF0dGVybiB0byBpZGVudGlmeSBhIGBvbmAgcGFyYW1ldGVyIGluIGEgYmxvY2suICovXG5jb25zdCBPTl9QQVJBTUVURVJfUEFUVEVSTiA9IC9eb25cXHMvO1xuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhIGBkZWZlcmAgYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Nvbm5lY3RlZERlZmVyTG9vcEJsb2NrKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PT0gJ3BsYWNlaG9sZGVyJyB8fCBuYW1lID09PSAnbG9hZGluZycgfHwgbmFtZSA9PT0gJ2Vycm9yJztcbn1cblxuLyoqIENyZWF0ZXMgYSBkZWZlcnJlZCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWRCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2ssIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LkRlZmVycmVkQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGNvbnN0IHt0cmlnZ2VycywgcHJlZmV0Y2hUcmlnZ2Vyc30gPSBwYXJzZVByaW1hcnlUcmlnZ2Vycyhhc3QucGFyYW1ldGVycywgYmluZGluZ1BhcnNlciwgZXJyb3JzKTtcbiAgY29uc3Qge3BsYWNlaG9sZGVyLCBsb2FkaW5nLCBlcnJvcn0gPSBwYXJzZUNvbm5lY3RlZEJsb2Nrcyhjb25uZWN0ZWRCbG9ja3MsIGVycm9ycywgdmlzaXRvcik7XG4gIGNvbnN0IG5vZGUgPSBuZXcgdC5EZWZlcnJlZEJsb2NrKFxuICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksIHRyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzLCBwbGFjZWhvbGRlcixcbiAgICAgIGxvYWRpbmcsIGVycm9yLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xuXG4gIHJldHVybiB7bm9kZSwgZXJyb3JzfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VDb25uZWN0ZWRCbG9ja3MoXG4gICAgY29ubmVjdGVkQmxvY2tzOiBodG1sLkJsb2NrW10sIGVycm9yczogUGFyc2VFcnJvcltdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IpIHtcbiAgbGV0IHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsID0gbnVsbDtcbiAgbGV0IGxvYWRpbmc6IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmd8bnVsbCA9IG51bGw7XG4gIGxldCBlcnJvcjogdC5EZWZlcnJlZEJsb2NrRXJyb3J8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBjb25uZWN0ZWRCbG9ja3MpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFpc0Nvbm5lY3RlZERlZmVyTG9vcEJsb2NrKGJsb2NrLm5hbWUpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgYFVucmVjb2duaXplZCBibG9jayBcIkAke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGJsb2NrLm5hbWUpIHtcbiAgICAgICAgY2FzZSAncGxhY2Vob2xkZXInOlxuICAgICAgICAgIGlmIChwbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBwbGFjZWhvbGRlciBibG9ja2ApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGxhY2Vob2xkZXIgPSBwYXJzZVBsYWNlaG9sZGVyQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdsb2FkaW5nJzpcbiAgICAgICAgICBpZiAobG9hZGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBgQGRlZmVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIEBsb2FkaW5nIGJsb2NrYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkaW5nID0gcGFyc2VMb2FkaW5nQmxvY2soYmxvY2ssIHZpc2l0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgaWYgKGVycm9yICE9PSBudWxsKSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGBAZGVmZXIgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgQGVycm9yIGJsb2NrYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IHBhcnNlRXJyb3JCbG9jayhibG9jaywgdmlzaXRvcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge3BsYWNlaG9sZGVyLCBsb2FkaW5nLCBlcnJvcn07XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGxhY2Vob2xkZXJCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIHtcbiAgbGV0IG1pbmltdW1UaW1lOiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBhc3QucGFyYW1ldGVycykge1xuICAgIGlmIChNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChtaW5pbXVtVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQHBsYWNlaG9sZGVyIGJsb2NrIGNhbiBvbmx5IGhhdmUgb25lIFwibWluaW11bVwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJtaW5pbXVtXCJgKTtcbiAgICAgIH1cblxuICAgICAgbWluaW11bVRpbWUgPSBwYXJzZWRUaW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBwYXJhbWV0ZXIgaW4gQHBsYWNlaG9sZGVyIGJsb2NrOiBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgbWluaW11bVRpbWUsIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBwYXJzZUxvYWRpbmdCbG9jayhhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcik6IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmcge1xuICBsZXQgYWZ0ZXJUaW1lOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gIGxldCBtaW5pbXVtVGltZTogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgcGFyYW0gb2YgYXN0LnBhcmFtZXRlcnMpIHtcbiAgICBpZiAoQUZURVJfUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgaWYgKGFmdGVyVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQGxvYWRpbmcgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJhZnRlclwiIHBhcmFtZXRlcmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWRUaW1lID1cbiAgICAgICAgICBwYXJzZURlZmVycmVkVGltZShwYXJhbS5leHByZXNzaW9uLnNsaWNlKGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQocGFyYW0uZXhwcmVzc2lvbikpKTtcblxuICAgICAgaWYgKHBhcnNlZFRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiBwYXJhbWV0ZXIgXCJhZnRlclwiYCk7XG4gICAgICB9XG5cbiAgICAgIGFmdGVyVGltZSA9IHBhcnNlZFRpbWU7XG4gICAgfSBlbHNlIGlmIChNSU5JTVVNX1BBUkFNRVRFUl9QQVRURVJOLnRlc3QocGFyYW0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmIChtaW5pbXVtVGltZSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQGxvYWRpbmcgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJtaW5pbXVtXCIgcGFyYW1ldGVyYCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhcnNlZFRpbWUgPVxuICAgICAgICAgIHBhcnNlRGVmZXJyZWRUaW1lKHBhcmFtLmV4cHJlc3Npb24uc2xpY2UoZ2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydChwYXJhbS5leHByZXNzaW9uKSkpO1xuXG4gICAgICBpZiAocGFyc2VkVGltZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSB0aW1lIHZhbHVlIG9mIHBhcmFtZXRlciBcIm1pbmltdW1cImApO1xuICAgICAgfVxuXG4gICAgICBtaW5pbXVtVGltZSA9IHBhcnNlZFRpbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIHBhcmFtZXRlciBpbiBAbG9hZGluZyBibG9jazogXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IHQuRGVmZXJyZWRCbG9ja0xvYWRpbmcoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgYWZ0ZXJUaW1lLCBtaW5pbXVtVGltZSwgYXN0LnNvdXJjZVNwYW4sXG4gICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG59XG5cblxuZnVuY3Rpb24gcGFyc2VFcnJvckJsb2NrKGFzdDogaHRtbC5CbG9jaywgdmlzaXRvcjogaHRtbC5WaXNpdG9yKTogdC5EZWZlcnJlZEJsb2NrRXJyb3Ige1xuICBpZiAoYXN0LnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQGVycm9yIGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnNgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5EZWZlcnJlZEJsb2NrRXJyb3IoXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSwgYXN0LnNvdXJjZVNwYW4sIGFzdC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBhc3QuZW5kU291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJpbWFyeVRyaWdnZXJzKFxuICAgIHBhcmFtczogaHRtbC5CbG9ja1BhcmFtZXRlcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge1xuICBjb25zdCB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMgPSB7fTtcbiAgY29uc3QgcHJlZmV0Y2hUcmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMgPSB7fTtcblxuICBmb3IgKGNvbnN0IHBhcmFtIG9mIHBhcmFtcykge1xuICAgIC8vIFRoZSBsZXhlciBpZ25vcmVzIHRoZSBsZWFkaW5nIHNwYWNlcyBzbyB3ZSBjYW4gYXNzdW1lXG4gICAgLy8gdGhhdCB0aGUgZXhwcmVzc2lvbiBzdGFydHMgd2l0aCBhIGtleXdvcmQuXG4gICAgaWYgKFdIRU5fUEFSQU1FVEVSX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgcGFyc2VXaGVuVHJpZ2dlcihwYXJhbSwgYmluZGluZ1BhcnNlciwgdHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIGlmIChPTl9QQVJBTUVURVJfUEFUVEVSTi50ZXN0KHBhcmFtLmV4cHJlc3Npb24pKSB7XG4gICAgICBwYXJzZU9uVHJpZ2dlcihwYXJhbSwgdHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIGlmIChQUkVGRVRDSF9XSEVOX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgcGFyc2VXaGVuVHJpZ2dlcihwYXJhbSwgYmluZGluZ1BhcnNlciwgcHJlZmV0Y2hUcmlnZ2VycywgZXJyb3JzKTtcbiAgICB9IGVsc2UgaWYgKFBSRUZFVENIX09OX1BBVFRFUk4udGVzdChwYXJhbS5leHByZXNzaW9uKSkge1xuICAgICAgcGFyc2VPblRyaWdnZXIocGFyYW0sIHByZWZldGNoVHJpZ2dlcnMsIGVycm9ycyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdVbnJlY29nbml6ZWQgdHJpZ2dlcicpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge3RyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzfTtcbn1cbiJdfQ==