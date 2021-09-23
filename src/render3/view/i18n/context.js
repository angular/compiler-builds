/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/i18n/context", ["require", "exports", "tslib", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.I18nContext = void 0;
    var tslib_1 = require("tslib");
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    var TagType;
    (function (TagType) {
        TagType[TagType["ELEMENT"] = 0] = "ELEMENT";
        TagType[TagType["TEMPLATE"] = 1] = "TEMPLATE";
    })(TagType || (TagType = {}));
    /**
     * Generates an object that is used as a shared state between parent and all child contexts.
     */
    function setupRegistry() {
        return { getUniqueId: (0, util_1.getSeqNumberGenerator)(), icus: new Map() };
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
            (0, util_1.updatePlaceholderMap)(this.placeholders, ph, content);
        };
        Object.defineProperty(I18nContext.prototype, "icus", {
            get: function () {
                return this._registry.icus;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(I18nContext.prototype, "isRoot", {
            get: function () {
                return this.level === 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(I18nContext.prototype, "isResolved", {
            get: function () {
                return this._unresolvedCtxCount === 0;
            },
            enumerable: false,
            configurable: true
        });
        I18nContext.prototype.getSerializedPlaceholders = function () {
            var result = new Map();
            this.placeholders.forEach(function (values, key) { return result.set(key, values.map(serializePlaceholderValue)); });
            return result;
        };
        // public API to accumulate i18n-related content
        I18nContext.prototype.appendBinding = function (binding) {
            this.bindings.add(binding);
        };
        I18nContext.prototype.appendIcu = function (name, ref) {
            (0, util_1.updatePlaceholderMap)(this._registry.icus, name, ref);
        };
        I18nContext.prototype.appendBoundText = function (node) {
            var _this = this;
            var phs = (0, util_1.assembleBoundTextPlaceholders)(node, this.bindings.size, this.id);
            phs.forEach(function (values, key) { return util_1.updatePlaceholderMap.apply(void 0, (0, tslib_1.__spreadArray)([_this.placeholders, key], (0, tslib_1.__read)(values), false)); });
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
        I18nContext.prototype.appendProjection = function (node, index) {
            // Add open and close tags at the same time, since `<ng-content>` has no content,
            // so when we come across `<ng-content>` we can register both open and close tags.
            // Note: runtime i18n logic doesn't distinguish `<ng-content>` tag placeholders and
            // regular element tag placeholders, so we generate element placeholders for both types.
            this.appendTag(TagType.ELEMENT, node, index, false);
            this.appendTag(TagType.ELEMENT, node, index, true);
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
                var tmplIdx = phs.findIndex(findTemplateFn(context.id, context.templateIndex));
                if (tmplIdx >= 0) {
                    // ... if found - replace it with nested template content
                    var isCloseTag = key.startsWith('CLOSE');
                    var isTemplateTag = key.endsWith('NG-TEMPLATE');
                    if (isTemplateTag) {
                        // current template's content is placed before or after
                        // parent template tag, depending on the open/close atrribute
                        phs.splice.apply(phs, (0, tslib_1.__spreadArray)([tmplIdx + (isCloseTag ? 0 : 1), 0], (0, tslib_1.__read)(values), false));
                    }
                    else {
                        var idx = isCloseTag ? values.length - 1 : 0;
                        values[idx].tmpl = phs[tmplIdx];
                        phs.splice.apply(phs, (0, tslib_1.__spreadArray)([tmplIdx, 1], (0, tslib_1.__read)(values), false));
                    }
                }
                else {
                    // ... otherwise just append content to placeholder value
                    phs.push.apply(phs, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(values), false));
                }
                _this.placeholders.set(key, phs);
            });
            this._unresolvedCtxCount--;
        };
        return I18nContext;
    }());
    exports.I18nContext = I18nContext;
    //
    // Helper methods
    //
    function wrap(symbol, index, contextId, closed) {
        var state = closed ? '/' : '';
        return (0, util_1.wrapI18nPlaceholder)("" + state + symbol + index, contextId);
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
        var projection = function (data, closed) { return wrapTag('!', data, closed); };
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFNSCxxRUFBdUg7SUFFdkgsSUFBSyxPQUdKO0lBSEQsV0FBSyxPQUFPO1FBQ1YsMkNBQU8sQ0FBQTtRQUNQLDZDQUFRLENBQUE7SUFDVixDQUFDLEVBSEksT0FBTyxLQUFQLE9BQU8sUUFHWDtJQUVEOztPQUVHO0lBQ0gsU0FBUyxhQUFhO1FBQ3BCLE9BQU8sRUFBQyxXQUFXLEVBQUUsSUFBQSw0QkFBcUIsR0FBRSxFQUFFLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBaUIsRUFBQyxDQUFDO0lBQ2hGLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7T0FjRztJQUNIO1FBU0UscUJBQ2EsS0FBYSxFQUFXLEdBQWtCLEVBQVcsS0FBaUIsRUFDdEUsYUFBaUMsRUFBVyxJQUFtQixFQUNoRSxRQUFjO1lBRndDLHNCQUFBLEVBQUEsU0FBaUI7WUFDdEUsOEJBQUEsRUFBQSxvQkFBaUM7WUFEakMsVUFBSyxHQUFMLEtBQUssQ0FBUTtZQUFXLFFBQUcsR0FBSCxHQUFHLENBQWU7WUFBVyxVQUFLLEdBQUwsS0FBSyxDQUFZO1lBQ3RFLGtCQUFhLEdBQWIsYUFBYSxDQUFvQjtZQUFXLFNBQUksR0FBSixJQUFJLENBQWU7WUFDaEUsYUFBUSxHQUFSLFFBQVEsQ0FBTTtZQVZuQixhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQU8sQ0FBQztZQUMxQixpQkFBWSxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO1lBQ3hDLGNBQVMsR0FBWSxLQUFLLENBQUM7WUFHMUIsd0JBQW1CLEdBQVcsQ0FBQyxDQUFDO1lBTXRDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxJQUFJLGFBQWEsRUFBRSxD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QUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDOUU7Z0JBQ0Qsa0RBQWtEO2dCQUNsRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7b0JBQ2QsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7d0JBQ3hDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUN0RDtnQkFDRCxPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUV4QixLQUFLLE9BQU8sQ0FBQyxRQUFRO2dCQUNuQixPQUFPLFFBQVEsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXZDO2dCQUNFLE9BQU8sS0FBSyxDQUFDO1NBQ2hCO0lBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FTVH0gZnJvbSAnLi4vLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHthc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgZ2V0U2VxTnVtYmVyR2VuZXJhdG9yLCB1cGRhdGVQbGFjZWhvbGRlck1hcCwgd3JhcEkxOG5QbGFjZWhvbGRlcn0gZnJvbSAnLi91dGlsJztcblxuZW51bSBUYWdUeXBlIHtcbiAgRUxFTUVOVCxcbiAgVEVNUExBVEUsXG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGFuIG9iamVjdCB0aGF0IGlzIHVzZWQgYXMgYSBzaGFyZWQgc3RhdGUgYmV0d2VlbiBwYXJlbnQgYW5kIGFsbCBjaGlsZCBjb250ZXh0cy5cbiAqL1xuZnVuY3Rpb24gc2V0dXBSZWdpc3RyeSgpIHtcbiAgcmV0dXJuIHtnZXRVbmlxdWVJZDogZ2V0U2VxTnVtYmVyR2VuZXJhdG9yKCksIGljdXM6IG5ldyBNYXA8c3RyaW5nLCBhbnlbXT4oKX07XG59XG5cbi8qKlxuICogSTE4bkNvbnRleHQgaXMgYSBoZWxwZXIgY2xhc3Mgd2hpY2gga2VlcHMgdHJhY2sgb2YgYWxsIGkxOG4tcmVsYXRlZCBhc3BlY3RzXG4gKiAoYWNjdW11bGF0ZXMgcGxhY2Vob2xkZXJzLCBiaW5kaW5ncywgZXRjKSBiZXR3ZWVuIGkxOG5TdGFydCBhbmQgaTE4bkVuZCBpbnN0cnVjdGlvbnMuXG4gKlxuICogV2hlbiB3ZSBlbnRlciBhIG5lc3RlZCB0ZW1wbGF0ZSwgdGhlIHRvcC1sZXZlbCBjb250ZXh0IGlzIGJlaW5nIHBhc3NlZCBkb3duXG4gKiB0byB0aGUgbmVzdGVkIGNvbXBvbmVudCwgd2hpY2ggdXNlcyB0aGlzIGNvbnRleHQgdG8gZ2VuZXJhdGUgYSBjaGlsZCBpbnN0YW5jZVxuICogb2YgSTE4bkNvbnRleHQgY2xhc3MgKHRvIGhhbmRsZSBuZXN0ZWQgdGVtcGxhdGUpIGFuZCBhdCB0aGUgZW5kLCByZWNvbmNpbGVzIGl0IGJhY2tcbiAqIHdpdGggdGhlIHBhcmVudCBjb250ZXh0LlxuICpcbiAqIEBwYXJhbSBpbmRleCBJbnN0cnVjdGlvbiBpbmRleCBvZiBpMThuU3RhcnQsIHdoaWNoIGluaXRpYXRlcyB0aGlzIGNvbnRleHRcbiAqIEBwYXJhbSByZWYgUmVmZXJlbmNlIHRvIGEgdHJhbnNsYXRpb24gY29uc3QgdGhhdCByZXByZXNlbnRzIHRoZSBjb250ZW50IGlmIHRodXMgY29udGV4dFxuICogQHBhcmFtIGxldmVsIE5lc3RuZyBsZXZlbCBkZWZpbmVkIGZvciBjaGlsZCBjb250ZXh0c1xuICogQHBhcmFtIHRlbXBsYXRlSW5kZXggSW5zdHJ1Y3Rpb24gaW5kZXggb2YgYSB0ZW1wbGF0ZSB3aGljaCB0aGlzIGNvbnRleHQgYmVsb25ncyB0b1xuICogQHBhcmFtIG1ldGEgTWV0YSBpbmZvcm1hdGlvbiAoaWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBldGMpIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGNvbnRleHRcbiAqL1xuZXhwb3J0IGNsYXNzIEkxOG5Db250ZXh0IHtcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBudW1iZXI7XG4gIHB1YmxpYyBiaW5kaW5ncyA9IG5ldyBTZXQ8QVNUPigpO1xuICBwdWJsaWMgcGxhY2Vob2xkZXJzID0gbmV3IE1hcDxzdHJpbmcsIGFueVtdPigpO1xuICBwdWJsaWMgaXNFbWl0dGVkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgcHJpdmF0ZSBfcmVnaXN0cnkhOiBhbnk7XG4gIHByaXZhdGUgX3VucmVzb2x2ZWRDdHhDb3VudDogbnVtYmVyID0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IGluZGV4OiBudW1iZXIsIHJlYWRvbmx5IHJlZjogby5SZWFkVmFyRXhwciwgcmVhZG9ubHkgbGV2ZWw6IG51bWJlciA9IDAsXG4gICAgICByZWFkb25seSB0ZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwsIHJlYWRvbmx5IG1ldGE6IGkxOG4uSTE4bk1ldGEsXG4gICAgICBwcml2YXRlIHJlZ2lzdHJ5PzogYW55KSB7XG4gICAgdGhpcy5fcmVnaXN0cnkgPSByZWdpc3RyeSB8fCBzZXR1cFJlZ2lzdHJ5KCk7XG4gICAgdGhpcy5pZCA9IHRoaXMuX3JlZ2lzdHJ5LmdldFVuaXF1ZUlkKCk7XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZFRhZyh0eXBlOiBUYWdUeXBlLCBub2RlOiBpMThuLlRhZ1BsYWNlaG9sZGVyLCBpbmRleDogbnVtYmVyLCBjbG9zZWQ/OiBib29sZWFuKSB7XG4gICAgaWYgKG5vZGUuaXNWb2lkICYmIGNsb3NlZCkge1xuICAgICAgcmV0dXJuOyAgLy8gaWdub3JlIFwiY2xvc2VcIiBmb3Igdm9pZCB0YWdzXG4gICAgfVxuICAgIGNvbnN0IHBoID0gbm9kZS5pc1ZvaWQgfHwgIWNsb3NlZCA/IG5vZGUuc3RhcnROYW1lIDogbm9kZS5jbG9zZU5hbWU7XG4gICAgY29uc3QgY29udGVudCA9IHt0eXBlLCBpbmRleCwgY3R4OiB0aGlzLmlkLCBpc1ZvaWQ6IG5vZGUuaXNWb2lkLCBjbG9zZWR9O1xuICAgIHVwZGF0ZVBsYWNlaG9sZGVyTWFwKHRoaXMucGxhY2Vob2xkZXJzLCBwaCwgY29udGVudCk7XG4gIH1cblxuICBnZXQgaWN1cygpIHtcbiAgICByZXR1cm4gdGhpcy5fcmVnaXN0cnkuaWN1cztcbiAgfVxuICBnZXQgaXNSb290KCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsID09PSAwO1xuICB9XG4gIGdldCBpc1Jlc29sdmVkKCkge1xuICAgIHJldHVybiB0aGlzLl91bnJlc29sdmVkQ3R4Q291bnQgPT09IDA7XG4gIH1cblxuICBnZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBNYXA8c3RyaW5nLCBhbnlbXT4oKTtcbiAgICB0aGlzLnBsYWNlaG9sZGVycy5mb3JFYWNoKFxuICAgICAgICAodmFsdWVzLCBrZXkpID0+IHJlc3VsdC5zZXQoa2V5LCB2YWx1ZXMubWFwKHNlcmlhbGl6ZVBsYWNlaG9sZGVyVmFsdWUpKSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIHB1YmxpYyBBUEkgdG8gYWNjdW11bGF0ZSBpMThuLXJlbGF0ZWQgY29udGVudFxuICBhcHBlbmRCaW5kaW5nKGJpbmRpbmc6IEFTVCkge1xuICAgIHRoaXMuYmluZGluZ3MuYWRkKGJpbmRpbmcpO1xuICB9XG4gIGFwcGVuZEljdShuYW1lOiBzdHJpbmcsIHJlZjogby5FeHByZXNzaW9uKSB7XG4gICAgdXBkYXRlUGxhY2Vob2xkZXJNYXAodGhpcy5fcmVnaXN0cnkuaWN1cywgbmFtZSwgcmVmKTtcbiAgfVxuICBhcHBlbmRCb3VuZFRleHQobm9kZTogaTE4bi5JMThuTWV0YSkge1xuICAgIGNvbnN0IHBocyA9IGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzKG5vZGUsIHRoaXMuYmluZGluZ3Muc2l6ZSwgdGhpcy5pZCk7XG4gICAgcGhzLmZvckVhY2goKHZhbHVlcywga2V5KSA9PiB1cGRhdGVQbGFjZWhvbGRlck1hcCh0aGlzLnBsYWNlaG9sZGVycywga2V5LCAuLi52YWx1ZXMpKTtcbiAgfVxuICBhcHBlbmRUZW1wbGF0ZShub2RlOiBpMThuLkkxOG5NZXRhLCBpbmRleDogbnVtYmVyKSB7XG4gICAgLy8gYWRkIG9wZW4gYW5kIGNsb3NlIHRhZ3MgYXQgdGhlIHNhbWUgdGltZSxcbiAgICAvLyBzaW5jZSB3ZSBwcm9jZXNzIG5lc3RlZCB0ZW1wbGF0ZXMgc2VwYXJhdGVseVxuICAgIHRoaXMuYXBwZW5kVGFnKFRhZ1R5cGUuVEVNUExBVEUsIG5vZGUgYXMgaTE4bi5UYWdQbGFjZWhvbGRlciwgaW5kZXgsIGZhbHNlKTtcbiAgICB0aGlzLmFwcGVuZFRhZyhUYWdUeXBlLlRFTVBMQVRFLCBub2RlIGFzIGkxOG4uVGFnUGxhY2Vob2xkZXIsIGluZGV4LCB0cnVlKTtcbiAgICB0aGlzLl91bnJlc29sdmVkQ3R4Q291bnQrKztcbiAgfVxuICBhcHBlbmRFbGVtZW50KG5vZGU6IGkxOG4uSTE4bk1ldGEsIGluZGV4OiBudW1iZXIsIGNsb3NlZD86IGJvb2xlYW4pIHtcbiAgICB0aGlzLmFwcGVuZFRhZyhUYWdUeXBlLkVMRU1FTlQsIG5vZGUgYXMgaTE4bi5UYWdQbGFjZWhvbGRlciwgaW5kZXgsIGNsb3NlZCk7XG4gIH1cbiAgYXBwZW5kUHJvamVjdGlvbihub2RlOiBpMThuLkkxOG5NZXRhLCBpbmRleDogbnVtYmVyKSB7XG4gICAgLy8gQWRkIG9wZW4gYW5kIGNsb3NlIHRhZ3MgYXQgdGhlIHNhbWUgdGltZSwgc2luY2UgYDxuZy1jb250ZW50PmAgaGFzIG5vIGNvbnRlbnQsXG4gICAgLy8gc28gd2hlbiB3ZSBjb21lIGFjcm9zcyBgPG5nLWNvbnRlbnQ+YCB3ZSBjYW4gcmVnaXN0ZXIgYm90aCBvcGVuIGFuZCBjbG9zZSB0YWdzLlxuICAgIC8vIE5vdGU6IHJ1bnRpbWUgaTE4biBsb2dpYyBkb2Vzbid0IGRpc3Rpbmd1aXNoIGA8bmctY29udGVudD5gIHRhZyBwbGFjZWhvbGRlcnMgYW5kXG4gICAgLy8gcmVndWxhciBlbGVtZW50IHRhZyBwbGFjZWhvbGRlcnMsIHNvIHdlIGdlbmVyYXRlIGVsZW1lbnQgcGxhY2Vob2xkZXJzIGZvciBib3RoIHR5cGVzLlxuICAgIHRoaXMuYXBwZW5kVGFnKFRhZ1R5cGUuRUxFTUVOVCwgbm9kZSBhcyBpMThuLlRhZ1BsYWNlaG9sZGVyLCBpbmRleCwgZmFsc2UpO1xuICAgIHRoaXMuYXBwZW5kVGFnKFRhZ1R5cGUuRUxFTUVOVCwgbm9kZSBhcyBpMThuLlRhZ1BsYWNlaG9sZGVyLCBpbmRleCwgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGFuIGluc3RhbmNlIG9mIGEgY2hpbGQgY29udGV4dCBiYXNlZCBvbiB0aGUgcm9vdCBvbmUsXG4gICAqIHdoZW4gd2UgZW50ZXIgYSBuZXN0ZWQgdGVtcGxhdGUgd2l0aGluIEkxOG4gc2VjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGluZGV4IEluc3RydWN0aW9uIGluZGV4IG9mIGNvcnJlc3BvbmRpbmcgaTE4blN0YXJ0LCB3aGljaCBpbml0aWF0ZXMgdGhpcyBjb250ZXh0XG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUluZGV4IEluc3RydWN0aW9uIGluZGV4IG9mIGEgdGVtcGxhdGUgd2hpY2ggdGhpcyBjb250ZXh0IGJlbG9uZ3MgdG9cbiAgICogQHBhcmFtIG1ldGEgTWV0YSBpbmZvcm1hdGlvbiAoaWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBldGMpIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGNvbnRleHRcbiAgICpcbiAgICogQHJldHVybnMgSTE4bkNvbnRleHQgaW5zdGFuY2VcbiAgICovXG4gIGZvcmtDaGlsZENvbnRleHQoaW5kZXg6IG51bWJlciwgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBtZXRhOiBpMThuLkkxOG5NZXRhKSB7XG4gICAgcmV0dXJuIG5ldyBJMThuQ29udGV4dChpbmRleCwgdGhpcy5yZWYsIHRoaXMubGV2ZWwgKyAxLCB0ZW1wbGF0ZUluZGV4LCBtZXRhLCB0aGlzLl9yZWdpc3RyeSk7XG4gIH1cblxuICAvKipcbiAgICogUmVjb25jaWxlcyBjaGlsZCBjb250ZXh0IGludG8gcGFyZW50IG9uZSBvbmNlIHRoZSBlbmQgb2YgdGhlIGkxOG4gYmxvY2sgaXMgcmVhY2hlZCAoaTE4bkVuZCkuXG4gICAqXG4gICAqIEBwYXJhbSBjb250ZXh0IENoaWxkIEkxOG5Db250ZXh0IGluc3RhbmNlIHRvIGJlIHJlY29uY2lsZWQgd2l0aCBwYXJlbnQgY29udGV4dC5cbiAgICovXG4gIHJlY29uY2lsZUNoaWxkQ29udGV4dChjb250ZXh0OiBJMThuQ29udGV4dCkge1xuICAgIC8vIHNldCB0aGUgcmlnaHQgY29udGV4dCBpZCBmb3Igb3BlbiBhbmQgY2xvc2VcbiAgICAvLyB0ZW1wbGF0ZSB0YWdzLCBzbyB3ZSBjYW4gdXNlIGl0IGFzIHN1Yi1ibG9jayBpZHNcbiAgICBbJ3N0YXJ0JywgJ2Nsb3NlJ10uZm9yRWFjaCgob3A6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gKGNvbnRleHQubWV0YSBhcyBhbnkpW2Ake29wfU5hbWVgXTtcbiAgICAgIGNvbnN0IHBocyA9IHRoaXMucGxhY2Vob2xkZXJzLmdldChrZXkpIHx8IFtdO1xuICAgICAgY29uc3QgdGFnID0gcGhzLmZpbmQoZmluZFRlbXBsYXRlRm4odGhpcy5pZCwgY29udGV4dC50ZW1wbGF0ZUluZGV4KSk7XG4gICAgICBpZiAodGFnKSB7XG4gICAgICAgIHRhZy5jdHggPSBjb250ZXh0LmlkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcmVjb25jaWxlIHBsYWNlaG9sZGVyc1xuICAgIGNvbnN0IGNoaWxkUGhzID0gY29udGV4dC5wbGFjZWhvbGRlcnM7XG4gICAgY2hpbGRQaHMuZm9yRWFjaCgodmFsdWVzOiBhbnlbXSwga2V5OiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHBocyA9IHRoaXMucGxhY2Vob2xkZXJzLmdldChrZXkpO1xuICAgICAgaWYgKCFwaHMpIHtcbiAgICAgICAgdGhpcy5wbGFjZWhvbGRlcnMuc2V0KGtleSwgdmFsdWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gdHJ5IHRvIGZpbmQgbWF0Y2hpbmcgdGVtcGxhdGUuLi5cbiAgICAgIGNvbnN0IHRtcGxJZHggPSBwaHMuZmluZEluZGV4KGZpbmRUZW1wbGF0ZUZuKGNvbnRleHQuaWQsIGNvbnRleHQudGVtcGxhdGVJbmRleCkpO1xuICAgICAgaWYgKHRtcGxJZHggPj0gMCkge1xuICAgICAgICAvLyAuLi4gaWYgZm91bmQgLSByZXBsYWNlIGl0IHdpdGggbmVzdGVkIHRlbXBsYXRlIGNvbnRlbnRcbiAgICAgICAgY29uc3QgaXNDbG9zZVRhZyA9IGtleS5zdGFydHNXaXRoKCdDTE9TRScpO1xuICAgICAgICBjb25zdCBpc1RlbXBsYXRlVGFnID0ga2V5LmVuZHNXaXRoKCdORy1URU1QTEFURScpO1xuICAgICAgICBpZiAoaXNUZW1wbGF0ZVRhZykge1xuICAgICAgICAgIC8vIGN1cnJlbnQgdGVtcGxhdGUncyBjb250ZW50IGlzIHBsYWNlZCBiZWZvcmUgb3IgYWZ0ZXJcbiAgICAgICAgICAvLyBwYXJlbnQgdGVtcGxhdGUgdGFnLCBkZXBlbmRpbmcgb24gdGhlIG9wZW4vY2xvc2UgYXRycmlidXRlXG4gICAgICAgICAgcGhzLnNwbGljZSh0bXBsSWR4ICsgKGlzQ2xvc2VUYWcgPyAwIDogMSksIDAsIC4uLnZhbHVlcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaWR4ID0gaXNDbG9zZVRhZyA/IHZhbHVlcy5sZW5ndGggLSAxIDogMDtcbiAgICAgICAgICB2YWx1ZXNbaWR4XS50bXBsID0gcGhzW3RtcGxJZHhdO1xuICAgICAgICAgIHBocy5zcGxpY2UodG1wbElkeCwgMSwgLi4udmFsdWVzKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gLi4uIG90aGVyd2lzZSBqdXN0IGFwcGVuZCBjb250ZW50IHRvIHBsYWNlaG9sZGVyIHZhbHVlXG4gICAgICAgIHBocy5wdXNoKC4uLnZhbHVlcyk7XG4gICAgICB9XG4gICAgICB0aGlzLnBsYWNlaG9sZGVycy5zZXQoa2V5LCBwaHMpO1xuICAgIH0pO1xuICAgIHRoaXMuX3VucmVzb2x2ZWRDdHhDb3VudC0tO1xuICB9XG59XG5cbi8vXG4vLyBIZWxwZXIgbWV0aG9kc1xuLy9cblxuZnVuY3Rpb24gd3JhcChzeW1ib2w6IHN0cmluZywgaW5kZXg6IG51bWJlciwgY29udGV4dElkOiBudW1iZXIsIGNsb3NlZD86IGJvb2xlYW4pOiBzdHJpbmcge1xuICBjb25zdCBzdGF0ZSA9IGNsb3NlZCA/ICcvJyA6ICcnO1xuICByZXR1cm4gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtzdGF0ZX0ke3N5bWJvbH0ke2luZGV4fWAsIGNvbnRleHRJZCk7XG59XG5cbmZ1bmN0aW9uIHdyYXBUYWcoc3ltYm9sOiBzdHJpbmcsIHtpbmRleCwgY3R4LCBpc1ZvaWR9OiBhbnksIGNsb3NlZD86IGJvb2xlYW4pOiBzdHJpbmcge1xuICByZXR1cm4gaXNWb2lkID8gd3JhcChzeW1ib2wsIGluZGV4LCBjdHgpICsgd3JhcChzeW1ib2wsIGluZGV4LCBjdHgsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgIHdyYXAoc3ltYm9sLCBpbmRleCwgY3R4LCBjbG9zZWQpO1xufVxuXG5mdW5jdGlvbiBmaW5kVGVtcGxhdGVGbihjdHg6IG51bWJlciwgdGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwpIHtcbiAgcmV0dXJuICh0b2tlbjogYW55KSA9PiB0eXBlb2YgdG9rZW4gPT09ICdvYmplY3QnICYmIHRva2VuLnR5cGUgPT09IFRhZ1R5cGUuVEVNUExBVEUgJiZcbiAgICAgIHRva2VuLmluZGV4ID09PSB0ZW1wbGF0ZUluZGV4ICYmIHRva2VuLmN0eCA9PT0gY3R4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVQbGFjZWhvbGRlclZhbHVlKHZhbHVlOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBlbGVtZW50ID0gKGRhdGE6IGFueSwgY2xvc2VkPzogYm9vbGVhbikgPT4gd3JhcFRhZygnIycsIGRhdGEsIGNsb3NlZCk7XG4gIGNvbnN0IHRlbXBsYXRlID0gKGRhdGE6IGFueSwgY2xvc2VkPzogYm9vbGVhbikgPT4gd3JhcFRhZygnKicsIGRhdGEsIGNsb3NlZCk7XG4gIGNvbnN0IHByb2plY3Rpb24gPSAoZGF0YTogYW55LCBjbG9zZWQ/OiBib29sZWFuKSA9PiB3cmFwVGFnKCchJywgZGF0YSwgY2xvc2VkKTtcblxuICBzd2l0Y2ggKHZhbHVlLnR5cGUpIHtcbiAgICBjYXNlIFRhZ1R5cGUuRUxFTUVOVDpcbiAgICAgIC8vIGNsb3NlIGVsZW1lbnQgdGFnXG4gICAgICBpZiAodmFsdWUuY2xvc2VkKSB7XG4gICAgICAgIHJldHVybiBlbGVtZW50KHZhbHVlLCB0cnVlKSArICh2YWx1ZS50bXBsID8gdGVtcGxhdGUodmFsdWUudG1wbCwgdHJ1ZSkgOiAnJyk7XG4gICAgICB9XG4gICAgICAvLyBvcGVuIGVsZW1lbnQgdGFnIHRoYXQgYWxzbyBpbml0aWF0ZXMgYSB0ZW1wbGF0ZVxuICAgICAgaWYgKHZhbHVlLnRtcGwpIHtcbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlKHZhbHVlLnRtcGwpICsgZWxlbWVudCh2YWx1ZSkgK1xuICAgICAgICAgICAgKHZhbHVlLmlzVm9pZCA/IHRlbXBsYXRlKHZhbHVlLnRtcGwsIHRydWUpIDogJycpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW1lbnQodmFsdWUpO1xuXG4gICAgY2FzZSBUYWdUeXBlLlRFTVBMQVRFOlxuICAgICAgcmV0dXJuIHRlbXBsYXRlKHZhbHVlLCB2YWx1ZS5jbG9zZWQpO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgfVxufVxuIl19