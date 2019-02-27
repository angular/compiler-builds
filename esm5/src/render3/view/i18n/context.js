/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { assembleBoundTextPlaceholders, findIndex, getSeqNumberGenerator, updatePlaceholderMap, wrapI18nPlaceholder } from './util';
var TagType;
(function (TagType) {
    TagType[TagType["ELEMENT"] = 0] = "ELEMENT";
    TagType[TagType["TEMPLATE"] = 1] = "TEMPLATE";
})(TagType || (TagType = {}));
/**
 * Generates an object that is used as a shared state between parent and all child contexts.
 */
function setupRegistry() {
    return { getUniqueId: getSeqNumberGenerator(), icus: new Map() };
}
/**
 * I18nContext is a helper class which keeps track of all i18n-related aspects
 * (accumulates placeholders, bindings, etc) between i18nStart and i18nEnd instructions.
 *
 * When we enter a nested template, the top-level context is being passed down
 * to the nested component, which uses this context to generate a child instance
 * of I18nContext class (to handle nested template) and at the end, reconciles it back
 * with the parent context.
 *
 * @param index Instruction index of i18nStart, which initiates this context
 * @param ref Reference to a translation const that represents the content if thus context
 * @param level Nestng level defined for child contexts
 * @param templateIndex Instruction index of a template which this context belongs to
 * @param meta Meta information (id, meaning, description, etc) associated with this context
 */
var I18nContext = /** @class */ (function () {
    function I18nContext(index, ref, level, templateIndex, meta, registry) {
        if (level === void 0) { level = 0; }
        if (templateIndex === void 0) { templateIndex = null; }
        this.index = index;
        this.ref = ref;
        this.level = level;
        this.templateIndex = templateIndex;
        this.meta = meta;
        this.registry = registry;
        this.bindings = new Set();
        this.placeholders = new Map();
        this.isEmitted = false;
        this._unresolvedCtxCount = 0;
        this._registry = registry || setupRegistry();
        this.id = this._registry.getUniqueId();
    }
    I18nContext.prototype.appendTag = function (type, node, index, closed) {
        if (node.isVoid && closed) {
            return; // ignore "close" for void tags
        }
        var ph = node.isVoid || !closed ? node.startName : node.closeName;
        var content = { type: type, index: index, ctx: this.id, isVoid: node.isVoid, closed: closed };
        updatePlaceholderMap(this.placeholders, ph, content);
    };
    Object.defineProperty(I18nContext.prototype, "icus", {
        get: function () { return this._registry.icus; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(I18nContext.prototype, "isRoot", {
        get: function () { return this.level === 0; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(I18nContext.prototype, "isResolved", {
        get: function () { return this._unresolvedCtxCount === 0; },
        enumerable: true,
        configurable: true
    });
    I18nContext.prototype.getSerializedPlaceholders = function () {
        var result = new Map();
        this.placeholders.forEach(function (values, key) { return result.set(key, values.map(serializePlaceholderValue)); });
        return result;
    };
    // public API to accumulate i18n-related content
    I18nContext.prototype.appendBinding = function (binding) { this.bindings.add(binding); };
    I18nContext.prototype.appendIcu = function (name, ref) {
        updatePlaceholderMap(this._registry.icus, name, ref);
    };
    I18nContext.prototype.appendBoundText = function (node) {
        var _this = this;
        var phs = assembleBoundTextPlaceholders(node, this.bindings.size, this.id);
        phs.forEach(function (values, key) { return updatePlaceholderMap.apply(void 0, tslib_1.__spread([_this.placeholders, key], values)); });
    };
    I18nContext.prototype.appendTemplate = function (node, index) {
        // add open and close tags at the same time,
        // since we process nested templates separately
        this.appendTag(TagType.TEMPLATE, node, index, false);
        this.appendTag(TagType.TEMPLATE, node, index, true);
        this._unresolvedCtxCount++;
    };
    I18nContext.prototype.appendElement = function (node, index, closed) {
        this.appendTag(TagType.ELEMENT, node, index, closed);
    };
    /**
     * Generates an instance of a child context based on the root one,
     * when we enter a nested template within I18n section.
     *
     * @param index Instruction index of corresponding i18nStart, which initiates this context
     * @param templateIndex Instruction index of a template which this context belongs to
     * @param meta Meta information (id, meaning, description, etc) associated with this context
     *
     * @returns I18nContext instance
     */
    I18nContext.prototype.forkChildContext = function (index, templateIndex, meta) {
        return new I18nContext(index, this.ref, this.level + 1, templateIndex, meta, this._registry);
    };
    /**
     * Reconciles child context into parent one once the end of the i18n block is reached (i18nEnd).
     *
     * @param context Child I18nContext instance to be reconciled with parent context.
     */
    I18nContext.prototype.reconcileChildContext = function (context) {
        var _this = this;
        // set the right context id for open and close
        // template tags, so we can use it as sub-block ids
        ['start', 'close'].forEach(function (op) {
            var key = context.meta[op + "Name"];
            var phs = _this.placeholders.get(key) || [];
            var tag = phs.find(findTemplateFn(_this.id, context.templateIndex));
            if (tag) {
                tag.ctx = context.id;
            }
        });
        // reconcile placeholders
        var childPhs = context.placeholders;
        childPhs.forEach(function (values, key) {
            var phs = _this.placeholders.get(key);
            if (!phs) {
                _this.placeholders.set(key, values);
                return;
            }
            // try to find matching template...
            var tmplIdx = findIndex(phs, findTemplateFn(context.id, context.templateIndex));
            if (tmplIdx >= 0) {
                // ... if found - replace it with nested template content
                var isCloseTag = key.startsWith('CLOSE');
                var isTemplateTag = key.endsWith('NG-TEMPLATE');
                if (isTemplateTag) {
                    // current template's content is placed before or after
                    // parent template tag, depending on the open/close atrribute
                    phs.splice.apply(phs, tslib_1.__spread([tmplIdx + (isCloseTag ? 0 : 1), 0], values));
                }
                else {
                    var idx = isCloseTag ? values.length - 1 : 0;
                    values[idx].tmpl = phs[tmplIdx];
                    phs.splice.apply(phs, tslib_1.__spread([tmplIdx, 1], values));
                }
            }
            else {
                // ... otherwise just append content to placeholder value
                phs.push.apply(phs, tslib_1.__spread(values));
            }
            _this.placeholders.set(key, phs);
        });
        this._unresolvedCtxCount--;
    };
    return I18nContext;
}());
export { I18nContext };
//
// Helper methods
//
function wrap(symbol, index, contextId, closed) {
    var state = closed ? '/' : '';
    return wrapI18nPlaceholder("" + state + symbol + index, contextId);
}
function wrapTag(symbol, _a, closed) {
    var index = _a.index, ctx = _a.ctx, isVoid = _a.isVoid;
    return isVoid ? wrap(symbol, index, ctx) + wrap(symbol, index, ctx, true) :
        wrap(symbol, index, ctx, closed);
}
function findTemplateFn(ctx, templateIndex) {
    return function (token) { return typeof token === 'object' && token.type === TagType.TEMPLATE &&
        token.index === templateIndex && token.ctx === ctx; };
}
function serializePlaceholderValue(value) {
    var element = function (data, closed) { return wrapTag('#', data, closed); };
    var template = function (data, closed) { return wrapTag('*', data, closed); };
    switch (value.type) {
        case TagType.ELEMENT:
            // close element tag
            if (value.closed) {
                return element(value, true) + (value.tmpl ? template(value.tmpl, true) : '');
            }
            // open element tag that also initiates a template
            if (value.tmpl) {
                return template(value.tmpl) + element(value) +
                    (value.isVoid ? template(value.tmpl, true) : '');
            }
            return element(value);
        case TagType.TEMPLATE:
            return template(value, value.closed);
        default:
            return value;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFLSCxPQUFPLEVBQUMsNkJBQTZCLEVBQUUsU0FBUyxFQUFFLHFCQUFxQixFQUFFLG9CQUFvQixFQUFFLG1CQUFtQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRWxJLElBQUssT0FHSjtBQUhELFdBQUssT0FBTztJQUNWLDJDQUFPLENBQUE7SUFDUCw2Q0FBUSxDQUFBO0FBQ1YsQ0FBQyxFQUhJLE9BQU8sS0FBUCxPQUFPLFFBR1g7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYTtJQUNwQixPQUFPLEVBQUMsV0FBVyxFQUFFLHFCQUFxQixFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksR0FBRyxFQUFpQixFQUFDLENBQUM7QUFDaEYsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0g7SUFTRSxxQkFDYSxLQUFhLEVBQVcsR0FBa0IsRUFBVyxLQUFpQixFQUN0RSxhQUFpQyxFQUFXLElBQWMsRUFBVSxRQUFjO1FBRDdCLHNCQUFBLEVBQUEsU0FBaUI7UUFDdEUsOEJBQUEsRUFBQSxvQkFBaUM7UUFEakMsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUFXLFFBQUcsR0FBSCxHQUFHLENBQWU7UUFBVyxVQUFLLEdBQUwsS0FBSyxDQUFZO1FBQ3RFLGtCQUFhLEdBQWIsYUFBYSxDQUFvQjtRQUFXLFNBQUksR0FBSixJQUFJLENBQVU7UUFBVSxhQUFRLEdBQVIsUUFBUSxDQUFNO1FBVHhGLGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0IsQ0FBQztRQUNuQyxpQkFBWSxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO1FBQ3hDLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFHMUIsd0JB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QU8sQ0FBQyxRQUFRO1lBQ25CLE9BQU8sUUFBUSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFdkM7WUFDRSxPQUFPLEtBQUssQ0FBQztLQUNoQjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHthc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgZmluZEluZGV4LCBnZXRTZXFOdW1iZXJHZW5lcmF0b3IsIHVwZGF0ZVBsYWNlaG9sZGVyTWFwLCB3cmFwSTE4blBsYWNlaG9sZGVyfSBmcm9tICcuL3V0aWwnO1xuXG5lbnVtIFRhZ1R5cGUge1xuICBFTEVNRU5ULFxuICBURU1QTEFURVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhbiBvYmplY3QgdGhhdCBpcyB1c2VkIGFzIGEgc2hhcmVkIHN0YXRlIGJldHdlZW4gcGFyZW50IGFuZCBhbGwgY2hpbGQgY29udGV4dHMuXG4gKi9cbmZ1bmN0aW9uIHNldHVwUmVnaXN0cnkoKSB7XG4gIHJldHVybiB7Z2V0VW5pcXVlSWQ6IGdldFNlcU51bWJlckdlbmVyYXRvcigpLCBpY3VzOiBuZXcgTWFwPHN0cmluZywgYW55W10+KCl9O1xufVxuXG4vKipcbiAqIEkxOG5Db250ZXh0IGlzIGEgaGVscGVyIGNsYXNzIHdoaWNoIGtlZXBzIHRyYWNrIG9mIGFsbCBpMThuLXJlbGF0ZWQgYXNwZWN0c1xuICogKGFjY3VtdWxhdGVzIHBsYWNlaG9sZGVycywgYmluZGluZ3MsIGV0YykgYmV0d2VlbiBpMThuU3RhcnQgYW5kIGkxOG5FbmQgaW5zdHJ1Y3Rpb25zLlxuICpcbiAqIFdoZW4gd2UgZW50ZXIgYSBuZXN0ZWQgdGVtcGxhdGUsIHRoZSB0b3AtbGV2ZWwgY29udGV4dCBpcyBiZWluZyBwYXNzZWQgZG93blxuICogdG8gdGhlIG5lc3RlZCBjb21wb25lbnQsIHdoaWNoIHVzZXMgdGhpcyBjb250ZXh0IHRvIGdlbmVyYXRlIGEgY2hpbGQgaW5zdGFuY2VcbiAqIG9mIEkxOG5Db250ZXh0IGNsYXNzICh0byBoYW5kbGUgbmVzdGVkIHRlbXBsYXRlKSBhbmQgYXQgdGhlIGVuZCwgcmVjb25jaWxlcyBpdCBiYWNrXG4gKiB3aXRoIHRoZSBwYXJlbnQgY29udGV4dC5cbiAqXG4gKiBAcGFyYW0gaW5kZXggSW5zdHJ1Y3Rpb24gaW5kZXggb2YgaTE4blN0YXJ0LCB3aGljaCBpbml0aWF0ZXMgdGhpcyBjb250ZXh0XG4gKiBAcGFyYW0gcmVmIFJlZmVyZW5jZSB0byBhIHRyYW5zbGF0aW9uIGNvbnN0IHRoYXQgcmVwcmVzZW50cyB0aGUgY29udGVudCBpZiB0aHVzIGNvbnRleHRcbiAqIEBwYXJhbSBsZXZlbCBOZXN0bmcgbGV2ZWwgZGVmaW5lZCBmb3IgY2hpbGQgY29udGV4dHNcbiAqIEBwYXJhbSB0ZW1wbGF0ZUluZGV4IEluc3RydWN0aW9uIGluZGV4IG9mIGEgdGVtcGxhdGUgd2hpY2ggdGhpcyBjb250ZXh0IGJlbG9uZ3MgdG9cbiAqIEBwYXJhbSBtZXRhIE1ldGEgaW5mb3JtYXRpb24gKGlkLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgZXRjKSBhc3NvY2lhdGVkIHdpdGggdGhpcyBjb250ZXh0XG4gKi9cbmV4cG9ydCBjbGFzcyBJMThuQ29udGV4dCB7XG4gIHB1YmxpYyByZWFkb25seSBpZDogbnVtYmVyO1xuICBwdWJsaWMgYmluZGluZ3MgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgcHVibGljIHBsYWNlaG9sZGVycyA9IG5ldyBNYXA8c3RyaW5nLCBhbnlbXT4oKTtcbiAgcHVibGljIGlzRW1pdHRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX3JlZ2lzdHJ5ICE6IGFueTtcbiAgcHJpdmF0ZSBfdW5yZXNvbHZlZEN0eENvdW50OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgaW5kZXg6IG51bWJlciwgcmVhZG9ubHkgcmVmOiBvLlJlYWRWYXJFeHByLCByZWFkb25seSBsZXZlbDogbnVtYmVyID0gMCxcbiAgICAgIHJlYWRvbmx5IHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCwgcmVhZG9ubHkgbWV0YTogaTE4bi5BU1QsIHByaXZhdGUgcmVnaXN0cnk/OiBhbnkpIHtcbiAgICB0aGlzLl9yZWdpc3RyeSA9IHJlZ2lzdHJ5IHx8IHNldHVwUmVnaXN0cnkoKTtcbiAgICB0aGlzLmlkID0gdGhpcy5fcmVnaXN0cnkuZ2V0VW5pcXVlSWQoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kVGFnKHR5cGU6IFRhZ1R5cGUsIG5vZGU6IGkxOG4uVGFnUGxhY2Vob2xkZXIsIGluZGV4OiBudW1iZXIsIGNsb3NlZD86IGJvb2xlYW4pIHtcbiAgICBpZiAobm9kZS5pc1ZvaWQgJiYgY2xvc2VkKSB7XG4gICAgICByZXR1cm47ICAvLyBpZ25vcmUgXCJjbG9zZVwiIGZvciB2b2lkIHRhZ3NcbiAgICB9XG4gICAgY29uc3QgcGggPSBub2RlLmlzVm9pZCB8fCAhY2xvc2VkID8gbm9kZS5zdGFydE5hbWUgOiBub2RlLmNsb3NlTmFtZTtcbiAgICBjb25zdCBjb250ZW50ID0ge3R5cGUsIGluZGV4LCBjdHg6IHRoaXMuaWQsIGlzVm9pZDogbm9kZS5pc1ZvaWQsIGNsb3NlZH07XG4gICAgdXBkYXRlUGxhY2Vob2xkZXJNYXAodGhpcy5wbGFjZWhvbGRlcnMsIHBoLCBjb250ZW50KTtcbiAgfVxuXG4gIGdldCBpY3VzKCkgeyByZXR1cm4gdGhpcy5fcmVnaXN0cnkuaWN1czsgfVxuICBnZXQgaXNSb290KCkgeyByZXR1cm4gdGhpcy5sZXZlbCA9PT0gMDsgfVxuICBnZXQgaXNSZXNvbHZlZCgpIHsgcmV0dXJuIHRoaXMuX3VucmVzb2x2ZWRDdHhDb3VudCA9PT0gMDsgfVxuXG4gIGdldFNlcmlhbGl6ZWRQbGFjZWhvbGRlcnMoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIGFueVtdPigpO1xuICAgIHRoaXMucGxhY2Vob2xkZXJzLmZvckVhY2goXG4gICAgICAgICh2YWx1ZXMsIGtleSkgPT4gcmVzdWx0LnNldChrZXksIHZhbHVlcy5tYXAoc2VyaWFsaXplUGxhY2Vob2xkZXJWYWx1ZSkpKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gcHVibGljIEFQSSB0byBhY2N1bXVsYXRlIGkxOG4tcmVsYXRlZCBjb250ZW50XG4gIGFwcGVuZEJpbmRpbmcoYmluZGluZzogby5FeHByZXNzaW9uKSB7IHRoaXMuYmluZGluZ3MuYWRkKGJpbmRpbmcpOyB9XG4gIGFwcGVuZEljdShuYW1lOiBzdHJpbmcsIHJlZjogby5FeHByZXNzaW9uKSB7XG4gICAgdXBkYXRlUGxhY2Vob2xkZXJNYXAodGhpcy5fcmVnaXN0cnkuaWN1cywgbmFtZSwgcmVmKTtcbiAgfVxuICBhcHBlbmRCb3VuZFRleHQobm9kZTogaTE4bi5BU1QpIHtcbiAgICBjb25zdCBwaHMgPSBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhub2RlLCB0aGlzLmJpbmRpbmdzLnNpemUsIHRoaXMuaWQpO1xuICAgIHBocy5mb3JFYWNoKCh2YWx1ZXMsIGtleSkgPT4gdXBkYXRlUGxhY2Vob2xkZXJNYXAodGhpcy5wbGFjZWhvbGRlcnMsIGtleSwgLi4udmFsdWVzKSk7XG4gIH1cbiAgYXBwZW5kVGVtcGxhdGUobm9kZTogaTE4bi5BU1QsIGluZGV4OiBudW1iZXIpIHtcbiAgICAvLyBhZGQgb3BlbiBhbmQgY2xvc2UgdGFncyBhdCB0aGUgc2FtZSB0aW1lLFxuICAgIC8vIHNpbmNlIHdlIHByb2Nlc3MgbmVzdGVkIHRlbXBsYXRlcyBzZXBhcmF0ZWx5XG4gICAgdGhpcy5hcHBlbmRUYWcoVGFnVHlwZS5URU1QTEFURSwgbm9kZSBhcyBpMThuLlRhZ1BsYWNlaG9sZGVyLCBpbmRleCwgZmFsc2UpO1xuICAgIHRoaXMuYXBwZW5kVGFnKFRhZ1R5cGUuVEVNUExBVEUsIG5vZGUgYXMgaTE4bi5UYWdQbGFjZWhvbGRlciwgaW5kZXgsIHRydWUpO1xuICAgIHRoaXMuX3VucmVzb2x2ZWRDdHhDb3VudCsrO1xuICB9XG4gIGFwcGVuZEVsZW1lbnQobm9kZTogaTE4bi5BU1QsIGluZGV4OiBudW1iZXIsIGNsb3NlZD86IGJvb2xlYW4pIHtcbiAgICB0aGlzLmFwcGVuZFRhZyhUYWdUeXBlLkVMRU1FTlQsIG5vZGUgYXMgaTE4bi5UYWdQbGFjZWhvbGRlciwgaW5kZXgsIGNsb3NlZCk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGFuIGluc3RhbmNlIG9mIGEgY2hpbGQgY29udGV4dCBiYXNlZCBvbiB0aGUgcm9vdCBvbmUsXG4gICAqIHdoZW4gd2UgZW50ZXIgYSBuZXN0ZWQgdGVtcGxhdGUgd2l0aGluIEkxOG4gc2VjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGluZGV4IEluc3RydWN0aW9uIGluZGV4IG9mIGNvcnJlc3BvbmRpbmcgaTE4blN0YXJ0LCB3aGljaCBpbml0aWF0ZXMgdGhpcyBjb250ZXh0XG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUluZGV4IEluc3RydWN0aW9uIGluZGV4IG9mIGEgdGVtcGxhdGUgd2hpY2ggdGhpcyBjb250ZXh0IGJlbG9uZ3MgdG9cbiAgICogQHBhcmFtIG1ldGEgTWV0YSBpbmZvcm1hdGlvbiAoaWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBldGMpIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGNvbnRleHRcbiAgICpcbiAgICogQHJldHVybnMgSTE4bkNvbnRleHQgaW5zdGFuY2VcbiAgICovXG4gIGZvcmtDaGlsZENvbnRleHQoaW5kZXg6IG51bWJlciwgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBtZXRhOiBpMThuLkFTVCkge1xuICAgIHJldHVybiBuZXcgSTE4bkNvbnRleHQoaW5kZXgsIHRoaXMucmVmLCB0aGlzLmxldmVsICsgMSwgdGVtcGxhdGVJbmRleCwgbWV0YSwgdGhpcy5fcmVnaXN0cnkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY29uY2lsZXMgY2hpbGQgY29udGV4dCBpbnRvIHBhcmVudCBvbmUgb25jZSB0aGUgZW5kIG9mIHRoZSBpMThuIGJsb2NrIGlzIHJlYWNoZWQgKGkxOG5FbmQpLlxuICAgKlxuICAgKiBAcGFyYW0gY29udGV4dCBDaGlsZCBJMThuQ29udGV4dCBpbnN0YW5jZSB0byBiZSByZWNvbmNpbGVkIHdpdGggcGFyZW50IGNvbnRleHQuXG4gICAqL1xuICByZWNvbmNpbGVDaGlsZENvbnRleHQoY29udGV4dDogSTE4bkNvbnRleHQpIHtcbiAgICAvLyBzZXQgdGhlIHJpZ2h0IGNvbnRleHQgaWQgZm9yIG9wZW4gYW5kIGNsb3NlXG4gICAgLy8gdGVtcGxhdGUgdGFncywgc28gd2UgY2FuIHVzZSBpdCBhcyBzdWItYmxvY2sgaWRzXG4gICAgWydzdGFydCcsICdjbG9zZSddLmZvckVhY2goKG9wOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IChjb250ZXh0Lm1ldGEgYXMgYW55KVtgJHtvcH1OYW1lYF07XG4gICAgICBjb25zdCBwaHMgPSB0aGlzLnBsYWNlaG9sZGVycy5nZXQoa2V5KSB8fCBbXTtcbiAgICAgIGNvbnN0IHRhZyA9IHBocy5maW5kKGZpbmRUZW1wbGF0ZUZuKHRoaXMuaWQsIGNvbnRleHQudGVtcGxhdGVJbmRleCkpO1xuICAgICAgaWYgKHRhZykge1xuICAgICAgICB0YWcuY3R4ID0gY29udGV4dC5pZDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlY29uY2lsZSBwbGFjZWhvbGRlcnNcbiAgICBjb25zdCBjaGlsZFBocyA9IGNvbnRleHQucGxhY2Vob2xkZXJzO1xuICAgIGNoaWxkUGhzLmZvckVhY2goKHZhbHVlczogYW55W10sIGtleTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBwaHMgPSB0aGlzLnBsYWNlaG9sZGVycy5nZXQoa2V5KTtcbiAgICAgIGlmICghcGhzKSB7XG4gICAgICAgIHRoaXMucGxhY2Vob2xkZXJzLnNldChrZXksIHZhbHVlcyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIHRyeSB0byBmaW5kIG1hdGNoaW5nIHRlbXBsYXRlLi4uXG4gICAgICBjb25zdCB0bXBsSWR4ID0gZmluZEluZGV4KHBocywgZmluZFRlbXBsYXRlRm4oY29udGV4dC5pZCwgY29udGV4dC50ZW1wbGF0ZUluZGV4KSk7XG4gICAgICBpZiAodG1wbElkeCA+PSAwKSB7XG4gICAgICAgIC8vIC4uLiBpZiBmb3VuZCAtIHJlcGxhY2UgaXQgd2l0aCBuZXN0ZWQgdGVtcGxhdGUgY29udGVudFxuICAgICAgICBjb25zdCBpc0Nsb3NlVGFnID0ga2V5LnN0YXJ0c1dpdGgoJ0NMT1NFJyk7XG4gICAgICAgIGNvbnN0IGlzVGVtcGxhdGVUYWcgPSBrZXkuZW5kc1dpdGgoJ05HLVRFTVBMQVRFJyk7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlVGFnKSB7XG4gICAgICAgICAgLy8gY3VycmVudCB0ZW1wbGF0ZSdzIGNvbnRlbnQgaXMgcGxhY2VkIGJlZm9yZSBvciBhZnRlclxuICAgICAgICAgIC8vIHBhcmVudCB0ZW1wbGF0ZSB0YWcsIGRlcGVuZGluZyBvbiB0aGUgb3Blbi9jbG9zZSBhdHJyaWJ1dGVcbiAgICAgICAgICBwaHMuc3BsaWNlKHRtcGxJZHggKyAoaXNDbG9zZVRhZyA/IDAgOiAxKSwgMCwgLi4udmFsdWVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBpZHggPSBpc0Nsb3NlVGFnID8gdmFsdWVzLmxlbmd0aCAtIDEgOiAwO1xuICAgICAgICAgIHZhbHVlc1tpZHhdLnRtcGwgPSBwaHNbdG1wbElkeF07XG4gICAgICAgICAgcGhzLnNwbGljZSh0bXBsSWR4LCAxLCAuLi52YWx1ZXMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIGp1c3QgYXBwZW5kIGNvbnRlbnQgdG8gcGxhY2Vob2xkZXIgdmFsdWVcbiAgICAgICAgcGhzLnB1c2goLi4udmFsdWVzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucGxhY2Vob2xkZXJzLnNldChrZXksIHBocyk7XG4gICAgfSk7XG4gICAgdGhpcy5fdW5yZXNvbHZlZEN0eENvdW50LS07XG4gIH1cbn1cblxuLy9cbi8vIEhlbHBlciBtZXRob2RzXG4vL1xuXG5mdW5jdGlvbiB3cmFwKHN5bWJvbDogc3RyaW5nLCBpbmRleDogbnVtYmVyLCBjb250ZXh0SWQ6IG51bWJlciwgY2xvc2VkPzogYm9vbGVhbik6IHN0cmluZyB7XG4gIGNvbnN0IHN0YXRlID0gY2xvc2VkID8gJy8nIDogJyc7XG4gIHJldHVybiB3cmFwSTE4blBsYWNlaG9sZGVyKGAke3N0YXRlfSR7c3ltYm9sfSR7aW5kZXh9YCwgY29udGV4dElkKTtcbn1cblxuZnVuY3Rpb24gd3JhcFRhZyhzeW1ib2w6IHN0cmluZywge2luZGV4LCBjdHgsIGlzVm9pZH06IGFueSwgY2xvc2VkPzogYm9vbGVhbik6IHN0cmluZyB7XG4gIHJldHVybiBpc1ZvaWQgPyB3cmFwKHN5bWJvbCwgaW5kZXgsIGN0eCkgKyB3cmFwKHN5bWJvbCwgaW5kZXgsIGN0eCwgdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgd3JhcChzeW1ib2wsIGluZGV4LCBjdHgsIGNsb3NlZCk7XG59XG5cbmZ1bmN0aW9uIGZpbmRUZW1wbGF0ZUZuKGN0eDogbnVtYmVyLCB0ZW1wbGF0ZUluZGV4OiBudW1iZXIgfCBudWxsKSB7XG4gIHJldHVybiAodG9rZW46IGFueSkgPT4gdHlwZW9mIHRva2VuID09PSAnb2JqZWN0JyAmJiB0b2tlbi50eXBlID09PSBUYWdUeXBlLlRFTVBMQVRFICYmXG4gICAgICB0b2tlbi5pbmRleCA9PT0gdGVtcGxhdGVJbmRleCAmJiB0b2tlbi5jdHggPT09IGN0eDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplUGxhY2Vob2xkZXJWYWx1ZSh2YWx1ZTogYW55KTogc3RyaW5nIHtcbiAgY29uc3QgZWxlbWVudCA9IChkYXRhOiBhbnksIGNsb3NlZD86IGJvb2xlYW4pID0+IHdyYXBUYWcoJyMnLCBkYXRhLCBjbG9zZWQpO1xuICBjb25zdCB0ZW1wbGF0ZSA9IChkYXRhOiBhbnksIGNsb3NlZD86IGJvb2xlYW4pID0+IHdyYXBUYWcoJyonLCBkYXRhLCBjbG9zZWQpO1xuXG4gIHN3aXRjaCAodmFsdWUudHlwZSkge1xuICAgIGNhc2UgVGFnVHlwZS5FTEVNRU5UOlxuICAgICAgLy8gY2xvc2UgZWxlbWVudCB0YWdcbiAgICAgIGlmICh2YWx1ZS5jbG9zZWQpIHtcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQodmFsdWUsIHRydWUpICsgKHZhbHVlLnRtcGwgPyB0ZW1wbGF0ZSh2YWx1ZS50bXBsLCB0cnVlKSA6ICcnKTtcbiAgICAgIH1cbiAgICAgIC8vIG9wZW4gZWxlbWVudCB0YWcgdGhhdCBhbHNvIGluaXRpYXRlcyBhIHRlbXBsYXRlXG4gICAgICBpZiAodmFsdWUudG1wbCkge1xuICAgICAgICByZXR1cm4gdGVtcGxhdGUodmFsdWUudG1wbCkgKyBlbGVtZW50KHZhbHVlKSArXG4gICAgICAgICAgICAodmFsdWUuaXNWb2lkID8gdGVtcGxhdGUodmFsdWUudG1wbCwgdHJ1ZSkgOiAnJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZWxlbWVudCh2YWx1ZSk7XG5cbiAgICBjYXNlIFRhZ1R5cGUuVEVNUExBVEU6XG4gICAgICByZXR1cm4gdGVtcGxhdGUodmFsdWUsIHZhbHVlLmNsb3NlZCk7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG4iXX0=