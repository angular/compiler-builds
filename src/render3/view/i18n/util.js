/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
        define("@angular/compiler/src/render3/view/i18n/util", ["require", "exports", "tslib", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/serializers/xmb", "@angular/compiler/src/output/map_util", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    var xmb_1 = require("@angular/compiler/src/i18n/serializers/xmb");
    var map_util_1 = require("@angular/compiler/src/output/map_util");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    /* Closure variables holding messages must be named `MSG_[A-Z0-9]+` */
    var CLOSURE_TRANSLATION_PREFIX = 'MSG_';
    /* Prefix for non-`goog.getMsg` i18n-related vars */
    exports.TRANSLATION_PREFIX = 'I18N_';
    /** Closure uses `goog.getMsg(message)` to lookup translations */
    var GOOG_GET_MSG = 'goog.getMsg';
    /** Name of the global variable that is used to determine if we use Closure translations or not */
    var NG_I18N_CLOSURE_MODE = 'ngI18nClosureMode';
    /** I18n separators for metadata **/
    var I18N_MEANING_SEPARATOR = '|';
    var I18N_ID_SEPARATOR = '@@';
    /** Name of the i18n attributes **/
    exports.I18N_ATTR = 'i18n';
    exports.I18N_ATTR_PREFIX = 'i18n-';
    /** Prefix of var expressions used in ICUs */
    exports.I18N_ICU_VAR_PREFIX = 'VAR_';
    /** Prefix of ICU expressions for post processing */
    exports.I18N_ICU_MAPPING_PREFIX = 'I18N_EXP_';
    /** Placeholder wrapper for i18n expressions **/
    exports.I18N_PLACEHOLDER_SYMBOL = '�';
    function i18nTranslationToDeclStmt(variable, closureVar, message, meta, params) {
        var statements = [];
        // var I18N_X;
        statements.push(new o.DeclareVarStmt(variable.name, undefined, o.INFERRED_TYPE, null, variable.sourceSpan));
        var args = [o.literal(message)];
        if (params && Object.keys(params).length) {
            args.push(map_util_1.mapLiteral(params, true));
        }
        // Closure JSDoc comments
        var docStatements = i18nMetaToDocStmt(meta);
        var thenStatements = docStatements ? [docStatements] : [];
        var googFnCall = o.variable(GOOG_GET_MSG).callFn(args);
        // const MSG_... = goog.getMsg(..);
        thenStatements.push(closureVar.set(googFnCall).toConstDecl());
        // I18N_X = MSG_...;
        thenStatements.push(new o.ExpressionStatement(variable.set(closureVar)));
        var localizeFnCall = o.importExpr(r3_identifiers_1.Identifiers.i18nLocalize).callFn(args);
        // I18N_X = i18nLocalize(...);
        var elseStatements = [new o.ExpressionStatement(variable.set(localizeFnCall))];
        // if(ngI18nClosureMode) { ... } else { ... }
        statements.push(o.ifStmt(o.variable(NG_I18N_CLOSURE_MODE), thenStatements, elseStatements));
        return statements;
    }
    // Converts i18n meta information for a message (id, description, meaning)
    // to a JsDoc statement formatted as expected by the Closure compiler.
    function i18nMetaToDocStmt(meta) {
        var tags = [];
        if (meta.description) {
            tags.push({ tagName: "desc" /* Desc */, text: meta.description });
        }
        if (meta.meaning) {
            tags.push({ tagName: "meaning" /* Meaning */, text: meta.meaning });
        }
        return tags.length == 0 ? null : new o.JSDocCommentStmt(tags);
    }
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
    function hasI18nAttrs(element) {
        return element.attrs.some(function (attr) { return isI18nAttribute(attr.name); });
    }
    exports.hasI18nAttrs = hasI18nAttrs;
    function metaFromI18nMessage(message, id) {
        if (id === void 0) { id = null; }
        return {
            id: typeof id === 'string' ? id : message.id || '',
            meaning: message.meaning || '',
            description: message.description || ''
        };
    }
    exports.metaFromI18nMessage = metaFromI18nMessage;
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
        current.push.apply(current, tslib_1.__spread(values));
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
                .children.filter(function (child) { return child instanceof i18n.Placeholder; })
                .forEach(function (child, idx) {
                var content = wrapI18nPlaceholder(startIdx + idx, contextId);
                updatePlaceholderMap(placeholders, child.name, content);
            });
        }
        return placeholders;
    }
    exports.assembleBoundTextPlaceholders = assembleBoundTextPlaceholders;
    function findIndex(items, callback) {
        for (var i = 0; i < items.length; i++) {
            if (callback(items[i])) {
                return i;
            }
        }
        return -1;
    }
    exports.findIndex = findIndex;
    /**
     * Parses i18n metas like:
     *  - "@@id",
     *  - "description[@@id]",
     *  - "meaning|description[@@id]"
     * and returns an object with parsed output.
     *
     * @param meta String that represents i18n meta
     * @returns Object with id, meaning and description fields
     */
    function parseI18nMeta(meta) {
        var _a, _b;
        var id;
        var meaning;
        var description;
        if (meta) {
            var idIndex = meta.indexOf(I18N_ID_SEPARATOR);
            var descIndex = meta.indexOf(I18N_MEANING_SEPARATOR);
            var meaningAndDesc = void 0;
            _a = tslib_1.__read((idIndex > -1) ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''], 2), meaningAndDesc = _a[0], id = _a[1];
            _b = tslib_1.__read((descIndex > -1) ?
                [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
                ['', meaningAndDesc], 2), meaning = _b[0], description = _b[1];
        }
        return { id: id, meaning: meaning, description: description };
    }
    exports.parseI18nMeta = parseI18nMeta;
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
        var publicName = xmb_1.toPublicName(name);
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
        return ("" + CLOSURE_TRANSLATION_PREFIX + extra).toUpperCase();
    }
    exports.getTranslationConstPrefix = getTranslationConstPrefix;
    /**
     * Generates translation declaration statements.
     *
     * @param variable Translation value reference
     * @param closureVar Variable for Closure `goog.getMsg` calls
     * @param message Text message to be translated
     * @param meta Object that contains meta information (id, meaning and description)
     * @param params Object with placeholders key-value pairs
     * @param transformFn Optional transformation (post processing) function reference
     * @returns Array of Statements that represent a given translation
     */
    function getTranslationDeclStmts(variable, closureVar, message, meta, params, transformFn) {
        if (params === void 0) { params = {}; }
        var statements = [];
        statements.push.apply(statements, tslib_1.__spread(i18nTranslationToDeclStmt(variable, closureVar, message, meta, params)));
        if (transformFn) {
            statements.push(new o.ExpressionStatement(variable.set(transformFn(variable))));
        }
        return statements;
    }
    exports.getTranslationDeclStmts = getTranslationDeclStmts;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDBEQUErQztJQUMvQyxrRUFBMkQ7SUFFM0Qsa0VBQW9EO0lBQ3BELDJEQUFnRDtJQUNoRCwrRUFBdUQ7SUFHdkQsc0VBQXNFO0lBQ3RFLElBQU0sMEJBQTBCLEdBQUcsTUFBTSxDQUFDO0lBRTFDLG9EQUFvRDtJQUN2QyxRQUFBLGtCQUFrQixHQUFHLE9BQU8sQ0FBQztJQUUxQyxpRUFBaUU7SUFDakUsSUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDO0lBRW5DLGtHQUFrRztJQUNsRyxJQUFNLG9CQUFvQixHQUFHLG1CQUFtQixDQUFDO0lBRWpELG9DQUFvQztJQUNwQyxJQUFNLHNCQUFzQixHQUFHLEdBQUcsQ0FBQztJQUNuQyxJQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQztJQUUvQixtQ0FBbUM7SUFDdEIsUUFBQSxTQUFTLEdBQUcsTUFBTSxDQUFDO0lBQ25CLFFBQUEsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDO0lBRXhDLDZDQUE2QztJQUNoQyxRQUFBLG1CQUFtQixHQUFHLE1BQU0sQ0FBQztJQUUxQyxvREFBb0Q7SUFDdkMsUUFBQSx1QkFBdUIsR0FBRyxXQUFXLENBQUM7SUFFbkQsZ0RBQWdEO0lBQ25DLFFBQUEsdUJBQXVCLEdBQUcsR0FBRyxDQUFDO0lBUTNDLFNBQVMseUJBQXlCLENBQzlCLFFBQXVCLEVBQUUsVUFBeUIsRUFBRSxPQUFlLEVBQUUsSUFBYyxFQUNuRixNQUF1QztRQUN6QyxJQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO1FBQ3JDLGNBQWM7UUFDZCxVQUFVLENBQUMsSUFBSSxDQUNYLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENB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LE9BQU8sQ0FBQSxLQUFHLDBCQUEwQixHQUFHLEtBQU8sQ0FBQSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQy9ELENBQUM7SUFGRCw4REFFQztJQUVEOzs7Ozs7Ozs7O09BVUc7SUFDSCxTQUFnQix1QkFBdUIsQ0FDbkMsUUFBdUIsRUFBRSxVQUF5QixFQUFFLE9BQWUsRUFBRSxJQUFjLEVBQ25GLE1BQTJDLEVBQzNDLFdBQWtEO1FBRGxELHVCQUFBLEVBQUEsV0FBMkM7UUFFN0MsSUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztRQUVyQyxVQUFVLENBQUMsSUFBSSxPQUFmLFVBQVUsbUJBQVMseUJBQXlCLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxHQUFFO1FBRTNGLElBQUksV0FBVyxFQUFFO1lBQ2YsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNqRjtRQUVELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7SUFiRCwwREFhQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7dG9QdWJsaWNOYW1lfSBmcm9tICcuLi8uLi8uLi9pMThuL3NlcmlhbGl6ZXJzL3htYic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHttYXBMaXRlcmFsfSBmcm9tICcuLi8uLi8uLi9vdXRwdXQvbWFwX3V0aWwnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi8uLi9yM19pZGVudGlmaWVycyc7XG5cblxuLyogQ2xvc3VyZSB2YXJpYWJsZXMgaG9sZGluZyBtZXNzYWdlcyBtdXN0IGJlIG5hbWVkIGBNU0dfW0EtWjAtOV0rYCAqL1xuY29uc3QgQ0xPU1VSRV9UUkFOU0xBVElPTl9QUkVGSVggPSAnTVNHXyc7XG5cbi8qIFByZWZpeCBmb3Igbm9uLWBnb29nLmdldE1zZ2AgaTE4bi1yZWxhdGVkIHZhcnMgKi9cbmV4cG9ydCBjb25zdCBUUkFOU0xBVElPTl9QUkVGSVggPSAnSTE4Tl8nO1xuXG4vKiogQ2xvc3VyZSB1c2VzIGBnb29nLmdldE1zZyhtZXNzYWdlKWAgdG8gbG9va3VwIHRyYW5zbGF0aW9ucyAqL1xuY29uc3QgR09PR19HRVRfTVNHID0gJ2dvb2cuZ2V0TXNnJztcblxuLyoqIE5hbWUgb2YgdGhlIGdsb2JhbCB2YXJpYWJsZSB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHdlIHVzZSBDbG9zdXJlIHRyYW5zbGF0aW9ucyBvciBub3QgKi9cbmNvbnN0IE5HX0kxOE5fQ0xPU1VSRV9NT0RFID0gJ25nSTE4bkNsb3N1cmVNb2RlJztcblxuLyoqIEkxOG4gc2VwYXJhdG9ycyBmb3IgbWV0YWRhdGEgKiovXG5jb25zdCBJMThOX01FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSTE4Tl9JRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKiogTmFtZSBvZiB0aGUgaTE4biBhdHRyaWJ1dGVzICoqL1xuZXhwb3J0IGNvbnN0IEkxOE5fQVRUUiA9ICdpMThuJztcbmV4cG9ydCBjb25zdCBJMThOX0FUVFJfUFJFRklYID0gJ2kxOG4tJztcblxuLyoqIFByZWZpeCBvZiB2YXIgZXhwcmVzc2lvbnMgdXNlZCBpbiBJQ1VzICovXG5leHBvcnQgY29uc3QgSTE4Tl9JQ1VfVkFSX1BSRUZJWCA9ICdWQVJfJztcblxuLyoqIFByZWZpeCBvZiBJQ1UgZXhwcmVzc2lvbnMgZm9yIHBvc3QgcHJvY2Vzc2luZyAqL1xuZXhwb3J0IGNvbnN0IEkxOE5fSUNVX01BUFBJTkdfUFJFRklYID0gJ0kxOE5fRVhQXyc7XG5cbi8qKiBQbGFjZWhvbGRlciB3cmFwcGVyIGZvciBpMThuIGV4cHJlc3Npb25zICoqL1xuZXhwb3J0IGNvbnN0IEkxOE5fUExBQ0VIT0xERVJfU1lNQk9MID0gJ++/vSc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZyxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cbmZ1bmN0aW9uIGkxOG5UcmFuc2xhdGlvblRvRGVjbFN0bXQoXG4gICAgdmFyaWFibGU6IG8uUmVhZFZhckV4cHIsIGNsb3N1cmVWYXI6IG8uUmVhZFZhckV4cHIsIG1lc3NhZ2U6IHN0cmluZywgbWV0YTogSTE4bk1ldGEsXG4gICAgcGFyYW1zPzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLy8gdmFyIEkxOE5fWDtcbiAgc3RhdGVtZW50cy5wdXNoKFxuICAgICAgbmV3IG8uRGVjbGFyZVZhclN0bXQodmFyaWFibGUubmFtZSAhLCB1bmRlZmluZWQsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmFyaWFibGUuc291cmNlU3BhbikpO1xuXG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG1lc3NhZ2UpIGFzIG8uRXhwcmVzc2lvbl07XG4gIGlmIChwYXJhbXMgJiYgT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGgpIHtcbiAgICBhcmdzLnB1c2gobWFwTGl0ZXJhbChwYXJhbXMsIHRydWUpKTtcbiAgfVxuXG4gIC8vIENsb3N1cmUgSlNEb2MgY29tbWVudHNcbiAgY29uc3QgZG9jU3RhdGVtZW50cyA9IGkxOG5NZXRhVG9Eb2NTdG10KG1ldGEpO1xuICBjb25zdCB0aGVuU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IGRvY1N0YXRlbWVudHMgPyBbZG9jU3RhdGVtZW50c10gOiBbXTtcbiAgY29uc3QgZ29vZ0ZuQ2FsbCA9IG8udmFyaWFibGUoR09PR19HRVRfTVNHKS5jYWxsRm4oYXJncyk7XG4gIC8vIGNvbnN0IE1TR18uLi4gPSBnb29nLmdldE1zZyguLik7XG4gIHRoZW5TdGF0ZW1lbnRzLnB1c2goY2xvc3VyZVZhci5zZXQoZ29vZ0ZuQ2FsbCkudG9Db25zdERlY2woKSk7XG4gIC8vIEkxOE5fWCA9IE1TR18uLi47XG4gIHRoZW5TdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQoY2xvc3VyZVZhcikpKTtcbiAgY29uc3QgbG9jYWxpemVGbkNhbGwgPSBvLmltcG9ydEV4cHIoUjMuaTE4bkxvY2FsaXplKS5jYWxsRm4oYXJncyk7XG4gIC8vIEkxOE5fWCA9IGkxOG5Mb2NhbGl6ZSguLi4pO1xuICBjb25zdCBlbHNlU3RhdGVtZW50cyA9IFtuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHZhcmlhYmxlLnNldChsb2NhbGl6ZUZuQ2FsbCkpXTtcbiAgLy8gaWYobmdJMThuQ2xvc3VyZU1vZGUpIHsgLi4uIH0gZWxzZSB7IC4uLiB9XG4gIHN0YXRlbWVudHMucHVzaChvLmlmU3RtdChvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSwgdGhlblN0YXRlbWVudHMsIGVsc2VTdGF0ZW1lbnRzKSk7XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8vIENvbnZlcnRzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiBmb3IgYSBtZXNzYWdlIChpZCwgZGVzY3JpcHRpb24sIG1lYW5pbmcpXG4vLyB0byBhIEpzRG9jIHN0YXRlbWVudCBmb3JtYXR0ZWQgYXMgZXhwZWN0ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG5mdW5jdGlvbiBpMThuTWV0YVRvRG9jU3RtdChtZXRhOiBJMThuTWV0YSk6IG8uSlNEb2NDb21tZW50U3RtdHxudWxsIHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG4gIGlmIChtZXRhLmRlc2NyaXB0aW9uKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5EZXNjLCB0ZXh0OiBtZXRhLmRlc2NyaXB0aW9ufSk7XG4gIH1cbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuTWVhbmluZywgdGV4dDogbWV0YS5tZWFuaW5nfSk7XG4gIH1cbiAgcmV0dXJuIHRhZ3MubGVuZ3RoID09IDAgPyBudWxsIDogbmV3IG8uSlNEb2NDb21tZW50U3RtdCh0YWdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSTE4bkF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09IEkxOE5fQVRUUiB8fCBuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0kxOG5Sb290Tm9kZShtZXRhPzogaTE4bi5BU1QpOiBtZXRhIGlzIGkxOG4uTWVzc2FnZSB7XG4gIHJldHVybiBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTaW5nbGVJMThuSWN1KG1ldGE/OiBpMThuLkFTVCk6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNJMThuUm9vdE5vZGUobWV0YSkgJiYgbWV0YS5ub2Rlcy5sZW5ndGggPT09IDEgJiYgbWV0YS5ub2Rlc1swXSBpbnN0YW5jZW9mIGkxOG4uSWN1O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzSTE4bkF0dHJzKGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gZWxlbWVudC5hdHRycy5zb21lKChhdHRyOiBodG1sLkF0dHJpYnV0ZSkgPT4gaXNJMThuQXR0cmlidXRlKGF0dHIubmFtZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIGlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IEkxOG5NZXRhIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdHlwZW9mIGlkID09PSAnc3RyaW5nJyA/IGlkIDogbWVzc2FnZS5pZCB8fCAnJyxcbiAgICBtZWFuaW5nOiBtZXNzYWdlLm1lYW5pbmcgfHwgJycsXG4gICAgZGVzY3JpcHRpb246IG1lc3NhZ2UuZGVzY3JpcHRpb24gfHwgJydcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UpIHtcbiAgcmV0dXJuIG1lc3NhZ2Uubm9kZXNbMF0gYXMgaTE4bi5JY3VQbGFjZWhvbGRlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBJMThuUGxhY2Vob2xkZXIoY29udGVudDogc3RyaW5nIHwgbnVtYmVyLCBjb250ZXh0SWQ6IG51bWJlciA9IDApOiBzdHJpbmcge1xuICBjb25zdCBibG9ja0lkID0gY29udGV4dElkID4gMCA/IGA6JHtjb250ZXh0SWR9YCA6ICcnO1xuICByZXR1cm4gYCR7STE4Tl9QTEFDRUhPTERFUl9TWU1CT0x9JHtjb250ZW50fSR7YmxvY2tJZH0ke0kxOE5fUExBQ0VIT0xERVJfU1lNQk9MfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZyhcbiAgICBzdHJpbmdzOiBzdHJpbmdbXSwgYmluZGluZ1N0YXJ0SW5kZXg6IG51bWJlciA9IDAsIGNvbnRleHRJZDogbnVtYmVyID0gMCk6IHN0cmluZyB7XG4gIGlmICghc3RyaW5ncy5sZW5ndGgpIHJldHVybiAnJztcbiAgbGV0IGFjYyA9ICcnO1xuICBjb25zdCBsYXN0SWR4ID0gc3RyaW5ncy5sZW5ndGggLSAxO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGxhc3RJZHg7IGkrKykge1xuICAgIGFjYyArPSBgJHtzdHJpbmdzW2ldfSR7d3JhcEkxOG5QbGFjZWhvbGRlcihiaW5kaW5nU3RhcnRJbmRleCArIGksIGNvbnRleHRJZCl9YDtcbiAgfVxuICBhY2MgKz0gc3RyaW5nc1tsYXN0SWR4XTtcbiAgcmV0dXJuIGFjYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlcU51bWJlckdlbmVyYXRvcihzdGFydHNBdDogbnVtYmVyID0gMCk6ICgpID0+IG51bWJlciB7XG4gIGxldCBjdXJyZW50ID0gc3RhcnRzQXQ7XG4gIHJldHVybiAoKSA9PiBjdXJyZW50Kys7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnM6IE1hcDxzdHJpbmcsIHN0cmluZ1tdPik6XG4gICAge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259IHtcbiAgY29uc3QgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgcGxhY2Vob2xkZXJzLmZvckVhY2goKHZhbHVlczogc3RyaW5nW10sIGtleTogc3RyaW5nKSA9PiB7XG4gICAgcGFyYW1zW2tleV0gPSBvLmxpdGVyYWwodmFsdWVzLmxlbmd0aCA+IDEgPyBgWyR7dmFsdWVzLmpvaW4oJ3wnKX1dYCA6IHZhbHVlc1swXSk7XG4gIH0pO1xuICByZXR1cm4gcGFyYW1zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlUGxhY2Vob2xkZXJNYXAobWFwOiBNYXA8c3RyaW5nLCBhbnlbXT4sIG5hbWU6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSkge1xuICBjb25zdCBjdXJyZW50ID0gbWFwLmdldChuYW1lKSB8fCBbXTtcbiAgY3VycmVudC5wdXNoKC4uLnZhbHVlcyk7XG4gIG1hcC5zZXQobmFtZSwgY3VycmVudCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhcbiAgICBtZXRhOiBpMThuLkFTVCwgYmluZGluZ1N0YXJ0SW5kZXg6IG51bWJlciA9IDAsIGNvbnRleHRJZDogbnVtYmVyID0gMCk6IE1hcDxzdHJpbmcsIGFueVtdPiB7XG4gIGNvbnN0IHN0YXJ0SWR4ID0gYmluZGluZ1N0YXJ0SW5kZXg7XG4gIGNvbnN0IHBsYWNlaG9sZGVycyA9IG5ldyBNYXA8c3RyaW5nLCBhbnk+KCk7XG4gIGNvbnN0IG5vZGUgPVxuICAgICAgbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSA/IG1ldGEubm9kZXMuZmluZChub2RlID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lcikgOiBtZXRhO1xuICBpZiAobm9kZSkge1xuICAgIChub2RlIGFzIGkxOG4uQ29udGFpbmVyKVxuICAgICAgICAuY2hpbGRyZW4uZmlsdGVyKChjaGlsZDogaTE4bi5Ob2RlKSA9PiBjaGlsZCBpbnN0YW5jZW9mIGkxOG4uUGxhY2Vob2xkZXIpXG4gICAgICAgIC5mb3JFYWNoKChjaGlsZDogaTE4bi5QbGFjZWhvbGRlciwgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gd3JhcEkxOG5QbGFjZWhvbGRlcihzdGFydElkeCArIGlkeCwgY29udGV4dElkKTtcbiAgICAgICAgICB1cGRhdGVQbGFjZWhvbGRlck1hcChwbGFjZWhvbGRlcnMsIGNoaWxkLm5hbWUsIGNvbnRlbnQpO1xuICAgICAgICB9KTtcbiAgfVxuICByZXR1cm4gcGxhY2Vob2xkZXJzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZEluZGV4KGl0ZW1zOiBhbnlbXSwgY2FsbGJhY2s6IChpdGVtOiBhbnkpID0+IGJvb2xlYW4pOiBudW1iZXIge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNhbGxiYWNrKGl0ZW1zW2ldKSkge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG4gIHJldHVybiAtMTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgaTE4biBtZXRhcyBsaWtlOlxuICogIC0gXCJAQGlkXCIsXG4gKiAgLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4gKiAgLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuICogYW5kIHJldHVybnMgYW4gb2JqZWN0IHdpdGggcGFyc2VkIG91dHB1dC5cbiAqXG4gKiBAcGFyYW0gbWV0YSBTdHJpbmcgdGhhdCByZXByZXNlbnRzIGkxOG4gbWV0YVxuICogQHJldHVybnMgT2JqZWN0IHdpdGggaWQsIG1lYW5pbmcgYW5kIGRlc2NyaXB0aW9uIGZpZWxkc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VJMThuTWV0YShtZXRhPzogc3RyaW5nKTogSTE4bk1ldGEge1xuICBsZXQgaWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKG1ldGEpIHtcbiAgICBjb25zdCBpZEluZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fSURfU0VQQVJBVE9SKTtcbiAgICBjb25zdCBkZXNjSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBpZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFttZXRhLnNsaWNlKDAsIGlkSW5kZXgpLCBtZXRhLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbbWV0YSwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtpZCwgbWVhbmluZywgZGVzY3JpcHRpb259O1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGludGVybmFsIHBsYWNlaG9sZGVyIG5hbWVzIHRvIHB1YmxpYy1mYWNpbmcgZm9ybWF0XG4gKiAoZm9yIGV4YW1wbGUgdG8gdXNlIGluIGdvb2cuZ2V0TXNnIGNhbGwpLlxuICogRXhhbXBsZTogYFNUQVJUX1RBR19ESVZfMWAgaXMgY29udmVydGVkIHRvIGBzdGFydFRhZ0Rpdl8xYC5cbiAqXG4gKiBAcGFyYW0gbmFtZSBUaGUgcGxhY2Vob2xkZXIgbmFtZSB0aGF0IHNob3VsZCBiZSBmb3JtYXR0ZWRcbiAqIEByZXR1cm5zIEZvcm1hdHRlZCBwbGFjZWhvbGRlciBuYW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lKG5hbWU6IHN0cmluZywgdXNlQ2FtZWxDYXNlOiBib29sZWFuID0gdHJ1ZSk6IHN0cmluZyB7XG4gIGNvbnN0IHB1YmxpY05hbWUgPSB0b1B1YmxpY05hbWUobmFtZSk7XG4gIGlmICghdXNlQ2FtZWxDYXNlKSB7XG4gICAgcmV0dXJuIHB1YmxpY05hbWU7XG4gIH1cbiAgY29uc3QgY2h1bmtzID0gcHVibGljTmFtZS5zcGxpdCgnXycpO1xuICBpZiAoY2h1bmtzLmxlbmd0aCA9PT0gMSkge1xuICAgIC8vIGlmIG5vIFwiX1wiIGZvdW5kIC0ganVzdCBsb3dlcmNhc2UgdGhlIHZhbHVlXG4gICAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgfVxuICBsZXQgcG9zdGZpeDtcbiAgLy8gZWplY3QgbGFzdCBlbGVtZW50IGlmIGl0J3MgYSBudW1iZXJcbiAgaWYgKC9eXFxkKyQvLnRlc3QoY2h1bmtzW2NodW5rcy5sZW5ndGggLSAxXSkpIHtcbiAgICBwb3N0Zml4ID0gY2h1bmtzLnBvcCgpO1xuICB9XG4gIGxldCByYXcgPSBjaHVua3Muc2hpZnQoKSAhLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChjaHVua3MubGVuZ3RoKSB7XG4gICAgcmF3ICs9IGNodW5rcy5tYXAoYyA9PiBjLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgYy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpKS5qb2luKCcnKTtcbiAgfVxuICByZXR1cm4gcG9zdGZpeCA/IGAke3Jhd31fJHtwb3N0Zml4fWAgOiByYXc7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgcHJlZml4IGZvciB0cmFuc2xhdGlvbiBjb25zdCBuYW1lLlxuICpcbiAqIEBwYXJhbSBleHRyYSBBZGRpdGlvbmFsIGxvY2FsIHByZWZpeCB0aGF0IHNob3VsZCBiZSBpbmplY3RlZCBpbnRvIHRyYW5zbGF0aW9uIHZhciBuYW1lXG4gKiBAcmV0dXJucyBDb21wbGV0ZSB0cmFuc2xhdGlvbiBjb25zdCBwcmVmaXhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoZXh0cmE6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtDTE9TVVJFX1RSQU5TTEFUSU9OX1BSRUZJWH0ke2V4dHJhfWAudG9VcHBlckNhc2UoKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgdHJhbnNsYXRpb24gZGVjbGFyYXRpb24gc3RhdGVtZW50cy5cbiAqXG4gKiBAcGFyYW0gdmFyaWFibGUgVHJhbnNsYXRpb24gdmFsdWUgcmVmZXJlbmNlXG4gKiBAcGFyYW0gY2xvc3VyZVZhciBWYXJpYWJsZSBmb3IgQ2xvc3VyZSBgZ29vZy5nZXRNc2dgIGNhbGxzXG4gKiBAcGFyYW0gbWVzc2FnZSBUZXh0IG1lc3NhZ2UgdG8gYmUgdHJhbnNsYXRlZFxuICogQHBhcmFtIG1ldGEgT2JqZWN0IHRoYXQgY29udGFpbnMgbWV0YSBpbmZvcm1hdGlvbiAoaWQsIG1lYW5pbmcgYW5kIGRlc2NyaXB0aW9uKVxuICogQHBhcmFtIHBhcmFtcyBPYmplY3Qgd2l0aCBwbGFjZWhvbGRlcnMga2V5LXZhbHVlIHBhaXJzXG4gKiBAcGFyYW0gdHJhbnNmb3JtRm4gT3B0aW9uYWwgdHJhbnNmb3JtYXRpb24gKHBvc3QgcHJvY2Vzc2luZykgZnVuY3Rpb24gcmVmZXJlbmNlXG4gKiBAcmV0dXJucyBBcnJheSBvZiBTdGF0ZW1lbnRzIHRoYXQgcmVwcmVzZW50IGEgZ2l2ZW4gdHJhbnNsYXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgIHZhcmlhYmxlOiBvLlJlYWRWYXJFeHByLCBjbG9zdXJlVmFyOiBvLlJlYWRWYXJFeHByLCBtZXNzYWdlOiBzdHJpbmcsIG1ldGE6IEkxOG5NZXRhLFxuICAgIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sXG4gICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIHN0YXRlbWVudHMucHVzaCguLi5pMThuVHJhbnNsYXRpb25Ub0RlY2xTdG10KHZhcmlhYmxlLCBjbG9zdXJlVmFyLCBtZXNzYWdlLCBtZXRhLCBwYXJhbXMpKTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG4iXX0=