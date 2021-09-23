(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/i18n/util", ["require", "exports", "tslib", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/serializers/xmb", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.declareI18nVariable = exports.getTranslationConstPrefix = exports.formatI18nPlaceholderName = exports.i18nFormatPlaceholderNames = exports.assembleBoundTextPlaceholders = exports.updatePlaceholderMap = exports.placeholdersToParams = exports.getSeqNumberGenerator = exports.assembleI18nBoundString = exports.wrapI18nPlaceholder = exports.icuFromI18nMessage = exports.hasI18nAttrs = exports.hasI18nMeta = exports.isSingleI18nIcu = exports.isI18nRootNode = exports.isI18nAttribute = exports.I18N_PLACEHOLDER_SYMBOL = exports.I18N_ICU_MAPPING_PREFIX = exports.I18N_ICU_VAR_PREFIX = exports.I18N_ATTR_PREFIX = exports.I18N_ATTR = exports.TRANSLATION_VAR_PREFIX = void 0;
    var tslib_1 = require("tslib");
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    var xmb_1 = require("@angular/compiler/src/i18n/serializers/xmb");
    var o = require("@angular/compiler/src/output/output_ast");
    /* Closure variables holding messages must be named `MSG_[A-Z0-9]+` */
    var CLOSURE_TRANSLATION_VAR_PREFIX = 'MSG_';
    /**
     * Prefix for non-`goog.getMsg` i18n-related vars.
     * Note: the prefix uses lowercase characters intentionally due to a Closure behavior that
     * considers variables like `I18N_0` as constants and throws an error when their value changes.
     */
    exports.TRANSLATION_VAR_PREFIX = 'i18n_';
    /** Name of the i18n attributes **/
    exports.I18N_ATTR = 'i18n';
    exports.I18N_ATTR_PREFIX = 'i18n-';
    /** Prefix of var expressions used in ICUs */
    exports.I18N_ICU_VAR_PREFIX = 'VAR_';
    /** Prefix of ICU expressions for post processing */
    exports.I18N_ICU_MAPPING_PREFIX = 'I18N_EXP_';
    /** Placeholder wrapper for i18n expressions **/
    exports.I18N_PLACEHOLDER_SYMBOL = '�';
    function isI18nAttribute(name) {
        return name === exports.I18N_ATTR || name.startsWith(exports.I18N_ATTR_PREFIX);
    }
    exports.isI18nAttribute = isI18nAttribute;
    function isI18nRootNode(meta) {
        return meta instanceof i18n.Message;
    }
    exports.isI18nRootNode = isI18nRootNode;
    function isSingleI18nIcu(meta) {
        return isI18nRootNode(meta) && meta.nodes.length === 1 && meta.nodes[0] instanceof i18n.Icu;
    }
    exports.isSingleI18nIcu = isSingleI18nIcu;
    function hasI18nMeta(node) {
        return !!node.i18n;
    }
    exports.hasI18nMeta = hasI18nMeta;
    function hasI18nAttrs(element) {
        return element.attrs.some(function (attr) { return isI18nAttribute(attr.name); });
    }
    exports.hasI18nAttrs = hasI18nAttrs;
    function icuFromI18nMessage(message) {
        return message.nodes[0];
    }
    exports.icuFromI18nMessage = icuFromI18nMessage;
    function wrapI18nPlaceholder(content, contextId) {
        if (contextId === void 0) { contextId = 0; }
        var blockId = contextId > 0 ? ":" + contextId : '';
        return "" + exports.I18N_PLACEHOLDER_SYMBOL + content + blockId + exports.I18N_PLACEHOLDER_SYMBOL;
    }
    exports.wrapI18nPlaceholder = wrapI18nPlaceholder;
    function assembleI18nBoundString(strings, bindingStartIndex, contextId) {
        if (bindingStartIndex === void 0) { bindingStartIndex = 0; }
        if (contextId === void 0) { contextId = 0; }
        if (!strings.length)
            return '';
        var acc = '';
        var lastIdx = strings.length - 1;
        for (var i = 0; i < lastIdx; i++) {
            acc += "" + strings[i] + wrapI18nPlaceholder(bindingStartIndex + i, contextId);
        }
        acc += strings[lastIdx];
        return acc;
    }
    exports.assembleI18nBoundString = assembleI18nBoundString;
    function getSeqNumberGenerator(startsAt) {
        if (startsAt === void 0) { startsAt = 0; }
        var current = startsAt;
        return function () { return current++; };
    }
    exports.getSeqNumberGenerator = getSeqNumberGenerator;
    function placeholdersToParams(placeholders) {
        var params = {};
        placeholders.forEach(function (values, key) {
            params[key] = o.literal(values.length > 1 ? "[" + values.join('|') + "]" : values[0]);
        });
        return params;
    }
    exports.placeholdersToParams = placeholdersToParams;
    function updatePlaceholderMap(map, name) {
        var values = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            values[_i - 2] = arguments[_i];
        }
        var current = map.get(name) || [];
        current.push.apply(current, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(values), false));
        map.set(name, current);
    }
    exports.updatePlaceholderMap = updatePlaceholderMap;
    function assembleBoundTextPlaceholders(meta, bindingStartIndex, contextId) {
        if (bindingStartIndex === void 0) { bindingStartIndex = 0; }
        if (contextId === void 0) { contextId = 0; }
        var startIdx = bindingStartIndex;
        var placeholders = new Map();
        var node = meta instanceof i18n.Message ? meta.nodes.find(function (node) { return node instanceof i18n.Container; }) : meta;
        if (node) {
            node
                .children
                .filter(function (child) { return child instanceof i18n.Placeholder; })
                .forEach(function (child, idx) {
                var content = wrapI18nPlaceholder(startIdx + idx, contextId);
                updatePlaceholderMap(placeholders, child.name, content);
            });
        }
        return placeholders;
    }
    exports.assembleBoundTextPlaceholders = assembleBoundTextPlaceholders;
    /**
     * Format the placeholder names in a map of placeholders to expressions.
     *
     * The placeholder names are converted from "internal" format (e.g. `START_TAG_DIV_1`) to "external"
     * format (e.g. `startTagDiv_1`).
     *
     * @param params A map of placeholder names to expressions.
     * @param useCamelCase whether to camelCase the placeholder name when formatting.
     * @returns A new map of formatted placeholder names to expressions.
     */
    function i18nFormatPlaceholderNames(params, useCamelCase) {
        if (params === void 0) { params = {}; }
        var _params = {};
        if (params && Object.keys(params).length) {
            Object.keys(params).forEach(function (key) { return _params[formatI18nPlaceholderName(key, useCamelCase)] = params[key]; });
        }
        return _params;
    }
    exports.i18nFormatPlaceholderNames = i18nFormatPlaceholderNames;
    /**
     * Converts internal placeholder names to public-facing format
     * (for example to use in goog.getMsg call).
     * Example: `START_TAG_DIV_1` is converted to `startTagDiv_1`.
     *
     * @param name The placeholder name that should be formatted
     * @returns Formatted placeholder name
     */
    function formatI18nPlaceholderName(name, useCamelCase) {
        if (useCamelCase === void 0) { useCamelCase = true; }
        var publicName = (0, xmb_1.toPublicName)(name);
        if (!useCamelCase) {
            return publicName;
        }
        var chunks = publicName.split('_');
        if (chunks.length === 1) {
            // if no "_" found - just lowercase the value
            return name.toLowerCase();
        }
        var postfix;
        // eject last element if it's a number
        if (/^\d+$/.test(chunks[chunks.length - 1])) {
            postfix = chunks.pop();
        }
        var raw = chunks.shift().toLowerCase();
        if (chunks.length) {
            raw += chunks.map(function (c) { return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(); }).join('');
        }
        return postfix ? raw + "_" + postfix : raw;
    }
    exports.formatI18nPlaceholderName = formatI18nPlaceholderName;
    /**
     * Generates a prefix for translation const name.
     *
     * @param extra Additional local prefix that should be injected into translation var name
     * @returns Complete translation const prefix
     */
    function getTranslationConstPrefix(extra) {
        return ("" + CLOSURE_TRANSLATION_VAR_PREFIX + extra).toUpperCase();
    }
    exports.getTranslationConstPrefix = getTranslationConstPrefix;
    /**
     * Generate AST to declare a variable. E.g. `var I18N_1;`.
     * @param variable the name of the variable to declare.
     */
    function declareI18nVariable(variable) {
        return new o.DeclareVarStmt(variable.name, undefined, o.INFERRED_TYPE, undefined, variable.sourceSpan);
    }
    exports.declareI18nVariable = declareI18nVariable;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwwREFBK0M7SUFDL0Msa0VBQTJEO0lBRTNELDJEQUFnRDtJQUdoRCxzRUFBc0U7SUFDdEUsSUFBTSw4QkFBOEIsR0FBRyxNQUFNLENBQUM7SUFFOUM7Ozs7T0FJRztJQUNVLFFBQUEsc0JBQXNCLEdBQUcsT0FBTyxDQUFDO0lBRTlDLG1DQUFtQztJQUN0QixRQUFBLFNBQVMsR0FBRyxNQUFNLENBQUM7SUFDbkIsUUFBQSxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7SUFFeEMsNkNBQTZDO0lBQ2hDLFFBQUEsbUJBQW1CLEdBQUcsTUFBTSxDQUFDO0lBRTFDLG9EQUFvRDtJQUN2QyxRQUFBLHVCQUF1QixHQUFHLFdBQVcsQ0FBQztJQUVuRCxnREFBZ0Q7SUFDbkMsUUFBQSx1QkFBdUIsR0FBRyxHQUFHLENBQUM7SUFFM0MsU0FBZ0IsZUFBZSxDQUFDLElBQVk7UUFDMUMsT0FBTyxJQUFJLEtBQUssaUJBQVMsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLHdCQUFnQixDQUFDLENBQUM7SUFDakUsQ0FBQztJQUZELDBDQUVDO0lBRUQsU0FBZ0IsY0FBYyxDQUFDLElBQW9CO1FBQ2pELE9BQU8sSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDdEMsQ0FBQztJQUZELHdDQUVDO0lBRUQsU0FBZ0IsZUFBZSxDQUFDLElBQW9CO1FBQ2xELE9BQU8sY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxHQUFHLENBQUM7SUFD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QUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFwRCxDQUFvRCxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ3ZGO1FBQ0QsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFJLEdBQUcsU0FBSSxPQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUM3QyxDQUFDO0lBcEJELDhEQW9CQztJQUVEOzs7OztPQUtHO0lBQ0gsU0FBZ0IseUJBQXlCLENBQUMsS0FBYTtRQUNyRCxPQUFPLENBQUEsS0FBRyw4QkFBOEIsR0FBRyxLQUFPLENBQUEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNuRSxDQUFDO0lBRkQsOERBRUM7SUFFRDs7O09BR0c7SUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxRQUF1QjtRQUN6RCxPQUFPLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FDdkIsUUFBUSxDQUFDLElBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFIRCxrREFHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7dG9QdWJsaWNOYW1lfSBmcm9tICcuLi8uLi8uLi9pMThuL3NlcmlhbGl6ZXJzL3htYic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uL3IzX2FzdCc7XG5cbi8qIENsb3N1cmUgdmFyaWFibGVzIGhvbGRpbmcgbWVzc2FnZXMgbXVzdCBiZSBuYW1lZCBgTVNHX1tBLVowLTldK2AgKi9cbmNvbnN0IENMT1NVUkVfVFJBTlNMQVRJT05fVkFSX1BSRUZJWCA9ICdNU0dfJztcblxuLyoqXG4gKiBQcmVmaXggZm9yIG5vbi1gZ29vZy5nZXRNc2dgIGkxOG4tcmVsYXRlZCB2YXJzLlxuICogTm90ZTogdGhlIHByZWZpeCB1c2VzIGxvd2VyY2FzZSBjaGFyYWN0ZXJzIGludGVudGlvbmFsbHkgZHVlIHRvIGEgQ2xvc3VyZSBiZWhhdmlvciB0aGF0XG4gKiBjb25zaWRlcnMgdmFyaWFibGVzIGxpa2UgYEkxOE5fMGAgYXMgY29uc3RhbnRzIGFuZCB0aHJvd3MgYW4gZXJyb3Igd2hlbiB0aGVpciB2YWx1ZSBjaGFuZ2VzLlxuICovXG5leHBvcnQgY29uc3QgVFJBTlNMQVRJT05fVkFSX1BSRUZJWCA9ICdpMThuXyc7XG5cbi8qKiBOYW1lIG9mIHRoZSBpMThuIGF0dHJpYnV0ZXMgKiovXG5leHBvcnQgY29uc3QgSTE4Tl9BVFRSID0gJ2kxOG4nO1xuZXhwb3J0IGNvbnN0IEkxOE5fQVRUUl9QUkVGSVggPSAnaTE4bi0nO1xuXG4vKiogUHJlZml4IG9mIHZhciBleHByZXNzaW9ucyB1c2VkIGluIElDVXMgKi9cbmV4cG9ydCBjb25zdCBJMThOX0lDVV9WQVJfUFJFRklYID0gJ1ZBUl8nO1xuXG4vKiogUHJlZml4IG9mIElDVSBleHByZXNzaW9ucyBmb3IgcG9zdCBwcm9jZXNzaW5nICovXG5leHBvcnQgY29uc3QgSTE4Tl9JQ1VfTUFQUElOR19QUkVGSVggPSAnSTE4Tl9FWFBfJztcblxuLyoqIFBsYWNlaG9sZGVyIHdyYXBwZXIgZm9yIGkxOG4gZXhwcmVzc2lvbnMgKiovXG5leHBvcnQgY29uc3QgSTE4Tl9QTEFDRUhPTERFUl9TWU1CT0wgPSAn77+9JztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzSTE4bkF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09IEkxOE5fQVRUUiB8fCBuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0kxOG5Sb290Tm9kZShtZXRhPzogaTE4bi5JMThuTWV0YSk6IG1ldGEgaXMgaTE4bi5NZXNzYWdlIHtcbiAgcmV0dXJuIG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NpbmdsZUkxOG5JY3UobWV0YT86IGkxOG4uSTE4bk1ldGEpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlzSTE4blJvb3ROb2RlKG1ldGEpICYmIG1ldGEubm9kZXMubGVuZ3RoID09PSAxICYmIG1ldGEubm9kZXNbMF0gaW5zdGFuY2VvZiBpMThuLkljdTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0kxOG5NZXRhKG5vZGU6IHQuTm9kZSZ7aTE4bj86IGkxOG4uSTE4bk1ldGF9KTogYm9vbGVhbiB7XG4gIHJldHVybiAhIW5vZGUuaTE4bjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0kxOG5BdHRycyhlbGVtZW50OiBodG1sLkVsZW1lbnQpOiBib29sZWFuIHtcbiAgcmV0dXJuIGVsZW1lbnQuYXR0cnMuc29tZSgoYXR0cjogaHRtbC5BdHRyaWJ1dGUpID0+IGlzSTE4bkF0dHJpYnV0ZShhdHRyLm5hbWUpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UpIHtcbiAgcmV0dXJuIG1lc3NhZ2Uubm9kZXNbMF0gYXMgaTE4bi5JY3VQbGFjZWhvbGRlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBJMThuUGxhY2Vob2xkZXIoY29udGVudDogc3RyaW5nfG51bWJlciwgY29udGV4dElkOiBudW1iZXIgPSAwKTogc3RyaW5nIHtcbiAgY29uc3QgYmxvY2tJZCA9IGNvbnRleHRJZCA+IDAgPyBgOiR7Y29udGV4dElkfWAgOiAnJztcbiAgcmV0dXJuIGAke0kxOE5fUExBQ0VIT0xERVJfU1lNQk9MfSR7Y29udGVudH0ke2Jsb2NrSWR9JHtJMThOX1BMQUNFSE9MREVSX1NZTUJPTH1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZW1ibGVJMThuQm91bmRTdHJpbmcoXG4gICAgc3RyaW5nczogc3RyaW5nW10sIGJpbmRpbmdTdGFydEluZGV4OiBudW1iZXIgPSAwLCBjb250ZXh0SWQ6IG51bWJlciA9IDApOiBzdHJpbmcge1xuICBpZiAoIXN0cmluZ3MubGVuZ3RoKSByZXR1cm4gJyc7XG4gIGxldCBhY2MgPSAnJztcbiAgY29uc3QgbGFzdElkeCA9IHN0cmluZ3MubGVuZ3RoIC0gMTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXN0SWR4OyBpKyspIHtcbiAgICBhY2MgKz0gYCR7c3RyaW5nc1tpXX0ke3dyYXBJMThuUGxhY2Vob2xkZXIoYmluZGluZ1N0YXJ0SW5kZXggKyBpLCBjb250ZXh0SWQpfWA7XG4gIH1cbiAgYWNjICs9IHN0cmluZ3NbbGFzdElkeF07XG4gIHJldHVybiBhY2M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXFOdW1iZXJHZW5lcmF0b3Ioc3RhcnRzQXQ6IG51bWJlciA9IDApOiAoKSA9PiBudW1iZXIge1xuICBsZXQgY3VycmVudCA9IHN0YXJ0c0F0O1xuICByZXR1cm4gKCkgPT4gY3VycmVudCsrO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzOiBNYXA8c3RyaW5nLCBzdHJpbmdbXT4pOlxuICAgIHtbbmFtZTogc3RyaW5nXTogby5MaXRlcmFsRXhwcn0ge1xuICBjb25zdCBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5MaXRlcmFsRXhwcn0gPSB7fTtcbiAgcGxhY2Vob2xkZXJzLmZvckVhY2goKHZhbHVlczogc3RyaW5nW10sIGtleTogc3RyaW5nKSA9PiB7XG4gICAgcGFyYW1zW2tleV0gPSBvLmxpdGVyYWwodmFsdWVzLmxlbmd0aCA+IDEgPyBgWyR7dmFsdWVzLmpvaW4oJ3wnKX1dYCA6IHZhbHVlc1swXSk7XG4gIH0pO1xuICByZXR1cm4gcGFyYW1zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlUGxhY2Vob2xkZXJNYXAobWFwOiBNYXA8c3RyaW5nLCBhbnlbXT4sIG5hbWU6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSkge1xuICBjb25zdCBjdXJyZW50ID0gbWFwLmdldChuYW1lKSB8fCBbXTtcbiAgY3VycmVudC5wdXNoKC4uLnZhbHVlcyk7XG4gIG1hcC5zZXQobmFtZSwgY3VycmVudCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhcbiAgICBtZXRhOiBpMThuLkkxOG5NZXRhLCBiaW5kaW5nU3RhcnRJbmRleDogbnVtYmVyID0gMCwgY29udGV4dElkOiBudW1iZXIgPSAwKTogTWFwPHN0cmluZywgYW55W10+IHtcbiAgY29uc3Qgc3RhcnRJZHggPSBiaW5kaW5nU3RhcnRJbmRleDtcbiAgY29uc3QgcGxhY2Vob2xkZXJzID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oKTtcbiAgY29uc3Qgbm9kZSA9XG4gICAgICBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlID8gbWV0YS5ub2Rlcy5maW5kKG5vZGUgPT4gbm9kZSBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSA6IG1ldGE7XG4gIGlmIChub2RlKSB7XG4gICAgKG5vZGUgYXMgaTE4bi5Db250YWluZXIpXG4gICAgICAgIC5jaGlsZHJlblxuICAgICAgICAuZmlsdGVyKChjaGlsZDogaTE4bi5Ob2RlKTogY2hpbGQgaXMgaTE4bi5QbGFjZWhvbGRlciA9PiBjaGlsZCBpbnN0YW5jZW9mIGkxOG4uUGxhY2Vob2xkZXIpXG4gICAgICAgIC5mb3JFYWNoKChjaGlsZDogaTE4bi5QbGFjZWhvbGRlciwgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gd3JhcEkxOG5QbGFjZWhvbGRlcihzdGFydElkeCArIGlkeCwgY29udGV4dElkKTtcbiAgICAgICAgICB1cGRhdGVQbGFjZWhvbGRlck1hcChwbGFjZWhvbGRlcnMsIGNoaWxkLm5hbWUsIGNvbnRlbnQpO1xuICAgICAgICB9KTtcbiAgfVxuICByZXR1cm4gcGxhY2Vob2xkZXJzO1xufVxuXG4vKipcbiAqIEZvcm1hdCB0aGUgcGxhY2Vob2xkZXIgbmFtZXMgaW4gYSBtYXAgb2YgcGxhY2Vob2xkZXJzIHRvIGV4cHJlc3Npb25zLlxuICpcbiAqIFRoZSBwbGFjZWhvbGRlciBuYW1lcyBhcmUgY29udmVydGVkIGZyb20gXCJpbnRlcm5hbFwiIGZvcm1hdCAoZS5nLiBgU1RBUlRfVEFHX0RJVl8xYCkgdG8gXCJleHRlcm5hbFwiXG4gKiBmb3JtYXQgKGUuZy4gYHN0YXJ0VGFnRGl2XzFgKS5cbiAqXG4gKiBAcGFyYW0gcGFyYW1zIEEgbWFwIG9mIHBsYWNlaG9sZGVyIG5hbWVzIHRvIGV4cHJlc3Npb25zLlxuICogQHBhcmFtIHVzZUNhbWVsQ2FzZSB3aGV0aGVyIHRvIGNhbWVsQ2FzZSB0aGUgcGxhY2Vob2xkZXIgbmFtZSB3aGVuIGZvcm1hdHRpbmcuXG4gKiBAcmV0dXJucyBBIG5ldyBtYXAgb2YgZm9ybWF0dGVkIHBsYWNlaG9sZGVyIG5hbWVzIHRvIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMoXG4gICAgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgdXNlQ2FtZWxDYXNlOiBib29sZWFuKSB7XG4gIGNvbnN0IF9wYXJhbXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gIGlmIChwYXJhbXMgJiYgT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGgpIHtcbiAgICBPYmplY3Qua2V5cyhwYXJhbXMpLmZvckVhY2goXG4gICAgICAgIGtleSA9PiBfcGFyYW1zW2Zvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWUoa2V5LCB1c2VDYW1lbENhc2UpXSA9IHBhcmFtc1trZXldKTtcbiAgfVxuICByZXR1cm4gX3BhcmFtcztcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBpbnRlcm5hbCBwbGFjZWhvbGRlciBuYW1lcyB0byBwdWJsaWMtZmFjaW5nIGZvcm1hdFxuICogKGZvciBleGFtcGxlIHRvIHVzZSBpbiBnb29nLmdldE1zZyBjYWxsKS5cbiAqIEV4YW1wbGU6IGBTVEFSVF9UQUdfRElWXzFgIGlzIGNvbnZlcnRlZCB0byBgc3RhcnRUYWdEaXZfMWAuXG4gKlxuICogQHBhcmFtIG5hbWUgVGhlIHBsYWNlaG9sZGVyIG5hbWUgdGhhdCBzaG91bGQgYmUgZm9ybWF0dGVkXG4gKiBAcmV0dXJucyBGb3JtYXR0ZWQgcGxhY2Vob2xkZXIgbmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZShuYW1lOiBzdHJpbmcsIHVzZUNhbWVsQ2FzZTogYm9vbGVhbiA9IHRydWUpOiBzdHJpbmcge1xuICBjb25zdCBwdWJsaWNOYW1lID0gdG9QdWJsaWNOYW1lKG5hbWUpO1xuICBpZiAoIXVzZUNhbWVsQ2FzZSkge1xuICAgIHJldHVybiBwdWJsaWNOYW1lO1xuICB9XG4gIGNvbnN0IGNodW5rcyA9IHB1YmxpY05hbWUuc3BsaXQoJ18nKTtcbiAgaWYgKGNodW5rcy5sZW5ndGggPT09IDEpIHtcbiAgICAvLyBpZiBubyBcIl9cIiBmb3VuZCAtIGp1c3QgbG93ZXJjYXNlIHRoZSB2YWx1ZVxuICAgIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCk7XG4gIH1cbiAgbGV0IHBvc3RmaXg7XG4gIC8vIGVqZWN0IGxhc3QgZWxlbWVudCBpZiBpdCdzIGEgbnVtYmVyXG4gIGlmICgvXlxcZCskLy50ZXN0KGNodW5rc1tjaHVua3MubGVuZ3RoIC0gMV0pKSB7XG4gICAgcG9zdGZpeCA9IGNodW5rcy5wb3AoKTtcbiAgfVxuICBsZXQgcmF3ID0gY2h1bmtzLnNoaWZ0KCkhLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChjaHVua3MubGVuZ3RoKSB7XG4gICAgcmF3ICs9IGNodW5rcy5tYXAoYyA9PiBjLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgYy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpKS5qb2luKCcnKTtcbiAgfVxuICByZXR1cm4gcG9zdGZpeCA/IGAke3Jhd31fJHtwb3N0Zml4fWAgOiByYXc7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgcHJlZml4IGZvciB0cmFuc2xhdGlvbiBjb25zdCBuYW1lLlxuICpcbiAqIEBwYXJhbSBleHRyYSBBZGRpdGlvbmFsIGxvY2FsIHByZWZpeCB0aGF0IHNob3VsZCBiZSBpbmplY3RlZCBpbnRvIHRyYW5zbGF0aW9uIHZhciBuYW1lXG4gKiBAcmV0dXJucyBDb21wbGV0ZSB0cmFuc2xhdGlvbiBjb25zdCBwcmVmaXhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoZXh0cmE6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtDTE9TVVJFX1RSQU5TTEFUSU9OX1ZBUl9QUkVGSVh9JHtleHRyYX1gLnRvVXBwZXJDYXNlKCk7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgQVNUIHRvIGRlY2xhcmUgYSB2YXJpYWJsZS4gRS5nLiBgdmFyIEkxOE5fMTtgLlxuICogQHBhcmFtIHZhcmlhYmxlIHRoZSBuYW1lIG9mIHRoZSB2YXJpYWJsZSB0byBkZWNsYXJlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZTogby5SZWFkVmFyRXhwcik6IG8uU3RhdGVtZW50IHtcbiAgcmV0dXJuIG5ldyBvLkRlY2xhcmVWYXJTdG10KFxuICAgICAgdmFyaWFibGUubmFtZSEsIHVuZGVmaW5lZCwgby5JTkZFUlJFRF9UWVBFLCB1bmRlZmluZWQsIHZhcmlhYmxlLnNvdXJjZVNwYW4pO1xufVxuIl19