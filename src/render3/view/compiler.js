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
        define("@angular/compiler/src/render3/view/compiler", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/selector", "@angular/compiler/src/shadow_css", "@angular/compiler/src/style_compiler", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/styling_builder", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core = require("@angular/compiler/src/core");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var o = require("@angular/compiler/src/output/output_ast");
    var selector_1 = require("@angular/compiler/src/selector");
    var shadow_css_1 = require("@angular/compiler/src/shadow_css");
    var style_compiler_1 = require("@angular/compiler/src/style_compiler");
    var util_1 = require("@angular/compiler/src/util");
    var r3_ast_1 = require("@angular/compiler/src/render3/r3_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_2 = require("@angular/compiler/src/render3/util");
    var styling_builder_1 = require("@angular/compiler/src/render3/view/styling_builder");
    var template_1 = require("@angular/compiler/src/render3/view/template");
    var util_3 = require("@angular/compiler/src/render3/view/util");
    var EMPTY_ARRAY = [];
    // This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
    // If there is a match, the first matching group will contain the attribute name to bind.
    var ATTR_REGEX = /attr\.([^\]]+)/;
    function baseDirectiveFields(meta, constantPool, bindingParser) {
        var definitionMap = new util_3.DefinitionMap();
        var selectors = core.parseSelectorToR3Selector(meta.selector);
        // e.g. `type: MyDirective`
        definitionMap.set('type', meta.internalType);
        // e.g. `selectors: [['', 'someDir', '']]`
        if (selectors.length > 0) {
            definitionMap.set('selectors', util_3.asLiteral(selectors));
        }
        if (meta.queries.length > 0) {
            // e.g. `contentQueries: (rf, ctx, dirIndex) => { ... }
            definitionMap.set('contentQueries', createContentQueriesFunction(meta.queries, constantPool, meta.name));
        }
        if (meta.viewQueries.length) {
            definitionMap.set('viewQuery', createViewQueriesFunction(meta.viewQueries, constantPool, meta.name));
        }
        // e.g. `hostBindings: (rf, ctx, elIndex) => { ... }
        definitionMap.set('hostBindings', createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.selector || '', meta.name));
        // e.g 'inputs: {a: 'a'}`
        definitionMap.set('inputs', util_3.conditionallyCreateMapObjectLiteral(meta.inputs, true));
        // e.g 'outputs: {a: 'a'}`
        definitionMap.set('outputs', util_3.conditionallyCreateMapObjectLiteral(meta.outputs));
        if (meta.exportAs !== null) {
            definitionMap.set('exportAs', o.literalArr(meta.exportAs.map(function (e) { return o.literal(e); })));
        }
        return definitionMap;
    }
    /**
     * Add features to the definition map.
     */
    function addFeatures(definitionMap, meta) {
        // e.g. `features: [NgOnChangesFeature()]`
        var features = [];
        var providers = meta.providers;
        var viewProviders = meta.viewProviders;
        if (providers || viewProviders) {
            var args = [providers || new o.LiteralArrayExpr([])];
            if (viewProviders) {
                args.push(viewProviders);
            }
            features.push(o.importExpr(r3_identifiers_1.Identifiers.ProvidersFeature).callFn(args));
        }
        if (meta.usesInheritance) {
            features.push(o.importExpr(r3_identifiers_1.Identifiers.InheritDefinitionFeature));
        }
        if (meta.fullInheritance) {
            features.push(o.importExpr(r3_identifiers_1.Identifiers.CopyDefinitionFeature));
        }
        if (meta.lifecycle.usesOnChanges) {
            features.push(o.importExpr(r3_identifiers_1.Identifiers.NgOnChangesFeature).callFn(EMPTY_ARRAY));
        }
        if (features.length) {
            definitionMap.set('features', o.literalArr(features));
        }
    }
    /**
     * Compile a directive for the render3 runtime as defined by the `R3DirectiveMetadata`.
     */
    function compileDirectiveFromMetadata(meta, constantPool, bindingParser) {
        var definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
        addFeatures(definitionMap, meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineDirective).callFn([definitionMap.toLiteralMap()]);
        var type = createTypeForDef(meta, r3_identifiers_1.Identifiers.DirectiveDefWithMeta);
        return { expression: expression, type: type };
    }
    exports.compileDirectiveFromMetadata = compileDirectiveFromMetadata;
    /**
     * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
     */
    function compileComponentFromMetadata(meta, constantPool, bindingParser) {
        var e_1, _a;
        var definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
        addFeatures(definitionMap, meta);
        var selector = meta.selector && selector_1.CssSelector.parse(meta.selector);
        var firstSelector = selector && selector[0];
        // e.g. `attr: ["class", ".my.app"]`
        // This is optional an only included if the first selector of a component specifies attributes.
        if (firstSelector) {
            var selectorAttributes = firstSelector.getAttrs();
            if (selectorAttributes.length) {
                definitionMap.set('attrs', constantPool.getConstLiteral(o.literalArr(selectorAttributes.map(function (value) { return value != null ? o.literal(value) : o.literal(undefined); })), 
                /* forceShared */ true));
            }
        }
        // Generate the CSS matcher that recognize directive
        var directiveMatcher = null;
        if (meta.directives.length > 0) {
            var matcher = new selector_1.SelectorMatcher();
            try {
                for (var _b = tslib_1.__values(meta.directives), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = _c.value, selector_2 = _d.selector, expression_1 = _d.expression;
                    matcher.addSelectables(selector_1.CssSelector.parse(selector_2), expression_1);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            directiveMatcher = matcher;
        }
        // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
        var templateTypeName = meta.name;
        var templateName = templateTypeName ? templateTypeName + "_Template" : null;
        var directivesUsed = new Set();
        var pipesUsed = new Set();
        var changeDetection = meta.changeDetection;
        var template = meta.template;
        var templateBuilder = new template_1.TemplateDefinitionBuilder(constantPool, template_1.BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, r3_identifiers_1.Identifiers.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
        var templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, []);
        // We need to provide this so that dynamically generated components know what
        // projected content blocks to pass through to the component when it is instantiated.
        var ngContentSelectors = templateBuilder.getNgContentSelectors();
        if (ngContentSelectors) {
            definitionMap.set('ngContentSelectors', ngContentSelectors);
        }
        // e.g. `decls: 2`
        definitionMap.set('decls', o.literal(templateBuilder.getConstCount()));
        // e.g. `vars: 2`
        definitionMap.set('vars', o.literal(templateBuilder.getVarCount()));
        // e.g. `consts: [['one', 'two'], ['three', 'four']]
        var consts = templateBuilder.getConsts();
        if (consts.length > 0) {
            definitionMap.set('consts', o.literalArr(consts));
        }
        definitionMap.set('template', templateFunctionExpression);
        // e.g. `directives: [MyDirective]`
        if (directivesUsed.size) {
            var directivesExpr = o.literalArr(Array.from(directivesUsed));
            if (meta.wrapDirectivesAndPipesInClosure) {
                directivesExpr = o.fn([], [new o.ReturnStatement(directivesExpr)]);
            }
            definitionMap.set('directives', directivesExpr);
        }
        // e.g. `pipes: [MyPipe]`
        if (pipesUsed.size) {
            var pipesExpr = o.literalArr(Array.from(pipesUsed));
            if (meta.wrapDirectivesAndPipesInClosure) {
                pipesExpr = o.fn([], [new o.ReturnStatement(pipesExpr)]);
            }
            definitionMap.set('pipes', pipesExpr);
        }
        if (meta.encapsulation === null) {
            meta.encapsulation = core.ViewEncapsulation.Emulated;
        }
        // e.g. `styles: [str1, str2]`
        if (meta.styles && meta.styles.length) {
            var styleValues = meta.encapsulation == core.ViewEncapsulation.Emulated ?
                compileStyles(meta.styles, style_compiler_1.CONTENT_ATTR, style_compiler_1.HOST_ATTR) :
                meta.styles;
            var strings = styleValues.map(function (str) { return o.literal(str); });
            definitionMap.set('styles', o.literalArr(strings));
        }
        else if (meta.encapsulation === core.ViewEncapsulation.Emulated) {
            // If there is no style, don't generate css selectors on elements
            meta.encapsulation = core.ViewEncapsulation.None;
        }
        // Only set view encapsulation if it's not the default value
        if (meta.encapsulation !== core.ViewEncapsulation.Emulated) {
            definitionMap.set('encapsulation', o.literal(meta.encapsulation));
        }
        // e.g. `animation: [trigger('123', [])]`
        if (meta.animations !== null) {
            definitionMap.set('data', o.literalMap([{ key: 'animation', value: meta.animations, quoted: false }]));
        }
        // Only set the change detection flag if it's defined and it's not the default.
        if (changeDetection != null && changeDetection !== core.ChangeDetectionStrategy.Default) {
            definitionMap.set('changeDetection', o.literal(changeDetection));
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineComponent).callFn([definitionMap.toLiteralMap()]);
        var type = createTypeForDef(meta, r3_identifiers_1.Identifiers.ComponentDefWithMeta);
        return { expression: expression, type: type };
    }
    exports.compileComponentFromMetadata = compileComponentFromMetadata;
    /**
     * A wrapper around `compileDirective` which depends on render2 global analysis data as its input
     * instead of the `R3DirectiveMetadata`.
     *
     * `R3DirectiveMetadata` is computed from `CompileDirectiveMetadata` and other statically reflected
     * information.
     */
    function compileDirectiveFromRender2(outputCtx, directive, reflector, bindingParser) {
        var name = compile_metadata_1.identifierName(directive.type);
        name || util_1.error("Cannot resolver the name of " + directive.type);
        var definitionField = outputCtx.constantPool.propertyNameOf(1 /* Directive */);
        var meta = directiveMetadataFromGlobalMetadata(directive, outputCtx, reflector);
        var res = compileDirectiveFromMetadata(meta, outputCtx.constantPool, bindingParser);
        var factoryRes = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, meta), { injectFn: r3_identifiers_1.Identifiers.directiveInject, target: r3_factory_1.R3FactoryTarget.Directive }));
        var ngFactoryDefStatement = new o.ClassStmt(name, null, [new o.ClassField('ɵfac', o.INFERRED_TYPE, [o.StmtModifier.Static], factoryRes.factory)], [], new o.ClassMethod(null, [], []), []);
        var directiveDefStatement = new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []);
        // Create the partial class to be merged with the actual class.
        outputCtx.statements.push(ngFactoryDefStatement, directiveDefStatement);
    }
    exports.compileDirectiveFromRender2 = compileDirectiveFromRender2;
    /**
     * A wrapper around `compileComponent` which depends on render2 global analysis data as its input
     * instead of the `R3DirectiveMetadata`.
     *
     * `R3ComponentMetadata` is computed from `CompileDirectiveMetadata` and other statically reflected
     * information.
     */
    function compileComponentFromRender2(outputCtx, component, render3Ast, reflector, bindingParser, directiveTypeBySel, pipeTypeByName) {
        var name = compile_metadata_1.identifierName(component.type);
        name || util_1.error("Cannot resolver the name of " + component.type);
        var definitionField = outputCtx.constantPool.propertyNameOf(2 /* Component */);
        var summary = component.toSummary();
        // Compute the R3ComponentMetadata from the CompileDirectiveMetadata
        var meta = tslib_1.__assign(tslib_1.__assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector)), { selector: component.selector, template: { nodes: render3Ast.nodes }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, interpolation: interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
        var res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
        var factoryRes = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, meta), { injectFn: r3_identifiers_1.Identifiers.directiveInject, target: r3_factory_1.R3FactoryTarget.Directive }));
        var ngFactoryDefStatement = new o.ClassStmt(name, null, [new o.ClassField('ɵfac', o.INFERRED_TYPE, [o.StmtModifier.Static], factoryRes.factory)], [], new o.ClassMethod(null, [], []), []);
        var componentDefStatement = new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []);
        // Create the partial class to be merged with the actual class.
        outputCtx.statements.push(ngFactoryDefStatement, componentDefStatement);
    }
    exports.compileComponentFromRender2 = compileComponentFromRender2;
    /**
     * Compute `R3DirectiveMetadata` given `CompileDirectiveMetadata` and a `CompileReflector`.
     */
    function directiveMetadataFromGlobalMetadata(directive, outputCtx, reflector) {
        // The global-analysis based Ivy mode in ngc is no longer utilized/supported.
        throw new Error('unsupported');
    }
    /**
     * Convert `CompileQueryMetadata` into `R3QueryMetadata`.
     */
    function queriesFromGlobalMetadata(queries, outputCtx) {
        return queries.map(function (query) {
            var read = null;
            if (query.read && query.read.identifier) {
                read = outputCtx.importExpr(query.read.identifier.reference);
            }
            return {
                propertyName: query.propertyName,
                first: query.first,
                predicate: selectorsFromGlobalMetadata(query.selectors, outputCtx),
                descendants: query.descendants, read: read,
                static: !!query.static
            };
        });
    }
    /**
     * Convert `CompileTokenMetadata` for query selectors into either an expression for a predicate
     * type, or a list of string predicates.
     */
    function selectorsFromGlobalMetadata(selectors, outputCtx) {
        if (selectors.length > 1 || (selectors.length == 1 && selectors[0].value)) {
            var selectorStrings = selectors.map(function (value) { return value.value; });
            selectorStrings.some(function (value) { return !value; }) &&
                util_1.error('Found a type among the string selectors expected');
            return outputCtx.constantPool.getConstLiteral(o.literalArr(selectorStrings.map(function (value) { return o.literal(value); })));
        }
        if (selectors.length == 1) {
            var first = selectors[0];
            if (first.identifier) {
                return outputCtx.importExpr(first.identifier.reference);
            }
        }
        util_1.error('Unexpected query form');
        return o.NULL_EXPR;
    }
    function prepareQueryParams(query, constantPool) {
        var parameters = [util_3.getQueryPredicate(query, constantPool), o.literal(query.descendants)];
        if (query.read) {
            parameters.push(query.read);
        }
        return parameters;
    }
    function convertAttributesToExpressions(attributes) {
        var e_2, _a;
        var values = [];
        try {
            for (var _b = tslib_1.__values(Object.getOwnPropertyNames(attributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = attributes[key];
                values.push(o.literal(key), value);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return values;
    }
    // Define and update any content queries
    function createContentQueriesFunction(queries, constantPool, name) {
        var e_3, _a;
        var createStatements = [];
        var updateStatements = [];
        var tempAllocator = util_3.temporaryAllocator(updateStatements, util_3.TEMPORARY_NAME);
        try {
            for (var queries_1 = tslib_1.__values(queries), queries_1_1 = queries_1.next(); !queries_1_1.done; queries_1_1 = queries_1.next()) {
                var query = queries_1_1.value;
                var queryInstruction = query.static ? r3_identifiers_1.Identifiers.staticContentQuery : r3_identifiers_1.Identifiers.contentQuery;
                // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
                createStatements.push(o.importExpr(queryInstruction)
                    .callFn(tslib_1.__spread([o.variable('dirIndex')], prepareQueryParams(query, constantPool)))
                    .toStmt());
                // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
                var temporary = tempAllocator();
                var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadQuery).callFn([]);
                var refresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
                var updateDirective = o.variable(util_3.CONTEXT_NAME)
                    .prop(query.propertyName)
                    .set(query.first ? temporary.prop('first') : temporary);
                updateStatements.push(refresh.and(updateDirective).toStmt());
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (queries_1_1 && !queries_1_1.done && (_a = queries_1.return)) _a.call(queries_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        var contentQueriesFnName = name ? name + "_ContentQueries" : null;
        return o.fn([
            new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null),
            new o.FnParam('dirIndex', null)
        ], [
            template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements),
            template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements)
        ], o.INFERRED_TYPE, null, contentQueriesFnName);
    }
    function stringAsType(str) {
        return o.expressionType(o.literal(str));
    }
    function stringMapAsType(map) {
        var mapValues = Object.keys(map).map(function (key) {
            var value = Array.isArray(map[key]) ? map[key][0] : map[key];
            return {
                key: key,
                value: o.literal(value),
                quoted: true,
            };
        });
        return o.expressionType(o.literalMap(mapValues));
    }
    function stringArrayAsType(arr) {
        return arr.length > 0 ? o.expressionType(o.literalArr(arr.map(function (value) { return o.literal(value); }))) :
            o.NONE_TYPE;
    }
    function createTypeForDef(meta, typeBase) {
        // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
        // string literal, which must be on one line.
        var selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;
        return o.expressionType(o.importExpr(typeBase, [
            util_2.typeWithParameters(meta.type, meta.typeArgumentCount),
            selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
            meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
            stringMapAsType(meta.inputs),
            stringMapAsType(meta.outputs),
            stringArrayAsType(meta.queries.map(function (q) { return q.propertyName; })),
        ]));
    }
    // Define and update any view queries
    function createViewQueriesFunction(viewQueries, constantPool, name) {
        var createStatements = [];
        var updateStatements = [];
        var tempAllocator = util_3.temporaryAllocator(updateStatements, util_3.TEMPORARY_NAME);
        viewQueries.forEach(function (query) {
            var queryInstruction = query.static ? r3_identifiers_1.Identifiers.staticViewQuery : r3_identifiers_1.Identifiers.viewQuery;
            // creation, e.g. r3.viewQuery(somePredicate, true);
            var queryDefinition = o.importExpr(queryInstruction).callFn(prepareQueryParams(query, constantPool));
            createStatements.push(queryDefinition.toStmt());
            // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
            var temporary = tempAllocator();
            var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadQuery).callFn([]);
            var refresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
            var updateDirective = o.variable(util_3.CONTEXT_NAME)
                .prop(query.propertyName)
                .set(query.first ? temporary.prop('first') : temporary);
            updateStatements.push(refresh.and(updateDirective).toStmt());
        });
        var viewQueryFnName = name ? name + "_Query" : null;
        return o.fn([new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null)], [
            template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements),
            template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements)
        ], o.INFERRED_TYPE, null, viewQueryFnName);
    }
    // Return a host binding function or null if one is not necessary.
    function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name) {
        // Initialize hostVarsCount to number of bound host properties (interpolations illegal)
        var hostVarsCount = Object.keys(hostBindingsMetadata.properties).length;
        var elVarExp = o.variable('elIndex');
        var bindingContext = o.variable(util_3.CONTEXT_NAME);
        var styleBuilder = new styling_builder_1.StylingBuilder(elVarExp, bindingContext);
        var _a = hostBindingsMetadata.specialAttributes, styleAttr = _a.styleAttr, classAttr = _a.classAttr;
        if (styleAttr !== undefined) {
            styleBuilder.registerStyleAttr(styleAttr);
        }
        if (classAttr !== undefined) {
            styleBuilder.registerClassAttr(classAttr);
        }
        var createStatements = [];
        var updateStatements = [];
        var totalHostVarsCount = hostVarsCount;
        var hostBindingSourceSpan = typeSourceSpan;
        var directiveSummary = metadataAsSummary(hostBindingsMetadata);
        var valueConverter;
        var getValueConverter = function () {
            if (!valueConverter) {
                var hostVarsCountFn = function (numSlots) {
                    var originalVarsCount = totalHostVarsCount;
                    totalHostVarsCount += numSlots;
                    return originalVarsCount;
                };
                valueConverter = new template_1.ValueConverter(constantPool, function () { return util_1.error('Unexpected node'); }, // new nodes are illegal here
                hostVarsCountFn, function () { return util_1.error('Unexpected pipe'); }); // pipes are illegal here
            }
            return valueConverter;
        };
        // Calculate host event bindings
        var eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
        if (eventBindings && eventBindings.length) {
            var listeners = createHostListeners(eventBindings, name);
            createStatements.push.apply(createStatements, tslib_1.__spread(listeners));
        }
        // Calculate the host property bindings
        var bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
        var propertyBindings = [];
        var attributeBindings = [];
        var syntheticHostBindings = [];
        bindings && bindings.forEach(function (binding) {
            var name = binding.name;
            var stylingInputWasSet = styleBuilder.registerInputBasedOnName(name, binding.expression, binding.sourceSpan);
            if (!stylingInputWasSet) {
                // resolve literal arrays and literal objects
                var value = binding.expression.visit(getValueConverter());
                var bindingExpr = bindingFn(bindingContext, value);
                var _a = getBindingNameAndInstruction(binding), bindingName = _a.bindingName, instruction = _a.instruction, isAttribute = _a.isAttribute;
                var securityContexts = bindingParser.calcPossibleSecurityContexts(selector, bindingName, isAttribute)
                    .filter(function (context) { return context !== core.SecurityContext.NONE; });
                var sanitizerFn = null;
                if (securityContexts.length) {
                    if (securityContexts.length === 2 &&
                        securityContexts.indexOf(core.SecurityContext.URL) > -1 &&
                        securityContexts.indexOf(core.SecurityContext.RESOURCE_URL) > -1) {
                        // Special case for some URL attributes (such as "src" and "href") that may be a part
                        // of different security contexts. In this case we use special santitization function and
                        // select the actual sanitizer at runtime based on a tag name that is provided while
                        // invoking sanitization function.
                        sanitizerFn = o.importExpr(r3_identifiers_1.Identifiers.sanitizeUrlOrResourceUrl);
                    }
                    else {
                        sanitizerFn = template_1.resolveSanitizationFn(securityContexts[0], isAttribute);
                    }
                }
                var instructionParams = [o.literal(bindingName), bindingExpr.currValExpr];
                if (sanitizerFn) {
                    instructionParams.push(sanitizerFn);
                }
                updateStatements.push.apply(updateStatements, tslib_1.__spread(bindingExpr.stmts));
                if (instruction === r3_identifiers_1.Identifiers.hostProperty) {
                    propertyBindings.push(instructionParams);
                }
                else if (instruction === r3_identifiers_1.Identifiers.attribute) {
                    attributeBindings.push(instructionParams);
                }
                else if (instruction === r3_identifiers_1.Identifiers.updateSyntheticHostBinding) {
                    syntheticHostBindings.push(instructionParams);
                }
                else {
                    updateStatements.push(o.importExpr(instruction).callFn(instructionParams).toStmt());
                }
            }
        });
        if (propertyBindings.length > 0) {
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.hostProperty, propertyBindings).toStmt());
        }
        if (attributeBindings.length > 0) {
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.attribute, attributeBindings).toStmt());
        }
        if (syntheticHostBindings.length > 0) {
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.updateSyntheticHostBinding, syntheticHostBindings).toStmt());
        }
        // since we're dealing with directives/components and both have hostBinding
        // functions, we need to generate a special hostAttrs instruction that deals
        // with both the assignment of styling as well as static attributes to the host
        // element. The instruction below will instruct all initial styling (styling
        // that is inside of a host binding within a directive/component) to be attached
        // to the host element alongside any of the provided host attributes that were
        // collected earlier.
        var hostAttrs = convertAttributesToExpressions(hostBindingsMetadata.attributes);
        var hostInstruction = styleBuilder.buildHostAttrsInstruction(null, hostAttrs, constantPool);
        if (hostInstruction) {
            createStatements.push(createStylingStmt(hostInstruction, bindingContext, bindingFn));
        }
        if (styleBuilder.hasBindings) {
            // finally each binding that was registered in the statement above will need to be added to
            // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
            // are evaluated and updated for the element.
            styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(function (instruction) {
                // we subtract a value of `1` here because the binding slot was already
                // allocated at the top of this method when all the input bindings were
                // counted.
                totalHostVarsCount += Math.max(instruction.allocateBindingSlots - 1, 0);
                updateStatements.push(createStylingStmt(instruction, bindingContext, bindingFn));
            });
        }
        if (totalHostVarsCount) {
            createStatements.unshift(o.importExpr(r3_identifiers_1.Identifiers.allocHostVars).callFn([o.literal(totalHostVarsCount)]).toStmt());
        }
        if (createStatements.length > 0 || updateStatements.length > 0) {
            var hostBindingsFnName = name ? name + "_HostBindings" : null;
            var statements = [];
            if (createStatements.length > 0) {
                statements.push(template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements));
            }
            if (updateStatements.length > 0) {
                statements.push(template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements));
            }
            return o.fn([
                new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null),
                new o.FnParam(elVarExp.name, o.NUMBER_TYPE)
            ], statements, o.INFERRED_TYPE, null, hostBindingsFnName);
        }
        return null;
    }
    function bindingFn(implicit, value) {
        return expression_converter_1.convertPropertyBinding(null, implicit, value, 'b', expression_converter_1.BindingForm.TrySimple, function () { return util_1.error('Unexpected interpolation'); });
    }
    function createStylingStmt(instruction, bindingContext, bindingFn) {
        var params = instruction.params(function (value) { return bindingFn(bindingContext, value).currValExpr; });
        return o.importExpr(instruction.reference, null, instruction.sourceSpan)
            .callFn(params, instruction.sourceSpan)
            .toStmt();
    }
    function getBindingNameAndInstruction(binding) {
        var bindingName = binding.name;
        var instruction;
        // Check to see if this is an attr binding or a property binding
        var attrMatches = bindingName.match(ATTR_REGEX);
        if (attrMatches) {
            bindingName = attrMatches[1];
            instruction = r3_identifiers_1.Identifiers.attribute;
        }
        else {
            if (binding.isAnimation) {
                bindingName = util_2.prepareSyntheticPropertyName(bindingName);
                // host bindings that have a synthetic property (e.g. @foo) should always be rendered
                // in the context of the component and not the parent. Therefore there is a special
                // compatibility instruction available for this purpose.
                instruction = r3_identifiers_1.Identifiers.updateSyntheticHostBinding;
            }
            else {
                instruction = r3_identifiers_1.Identifiers.hostProperty;
            }
        }
        return { bindingName: bindingName, instruction: instruction, isAttribute: !!attrMatches };
    }
    function createHostListeners(eventBindings, name) {
        return eventBindings.map(function (binding) {
            var bindingName = binding.name && compile_metadata_1.sanitizeIdentifier(binding.name);
            var bindingFnName = binding.type === 1 /* Animation */ ?
                util_2.prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
                bindingName;
            var handlerName = name && bindingName ? name + "_" + bindingFnName + "_HostBindingHandler" : null;
            var params = template_1.prepareEventListenerParameters(r3_ast_1.BoundEvent.fromParsedEvent(binding), handlerName);
            var instruction = binding.type == 1 /* Animation */ ? r3_identifiers_1.Identifiers.componentHostSyntheticListener : r3_identifiers_1.Identifiers.listener;
            return o.importExpr(instruction).callFn(params).toStmt();
        });
    }
    function metadataAsSummary(meta) {
        // clang-format off
        return {
            // This is used by the BindingParser, which only deals with listeners and properties. There's no
            // need to pass attributes to it.
            hostAttributes: {},
            hostListeners: meta.listeners,
            hostProperties: meta.properties,
        };
        // clang-format on
    }
    function typeMapToExpressionMap(map, outputCtx) {
        // Convert each map entry into another entry where the value is an expression importing the type.
        var entries = Array.from(map).map(function (_a) {
            var _b = tslib_1.__read(_a, 2), key = _b[0], type = _b[1];
            return [key, outputCtx.importExpr(type)];
        });
        return new Map(entries);
    }
    var HOST_REG_EXP = /^(?:\[([^\]]+)\])|(?:\(([^\)]+)\))$/;
    function parseHostBindings(host) {
        var e_4, _a;
        var attributes = {};
        var listeners = {};
        var properties = {};
        var specialAttributes = {};
        try {
            for (var _b = tslib_1.__values(Object.keys(host)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = host[key];
                var matches = key.match(HOST_REG_EXP);
                if (matches === null) {
                    switch (key) {
                        case 'class':
                            if (typeof value !== 'string') {
                                // TODO(alxhub): make this a diagnostic.
                                throw new Error("Class binding must be string");
                            }
                            specialAttributes.classAttr = value;
                            break;
                        case 'style':
                            if (typeof value !== 'string') {
                                // TODO(alxhub): make this a diagnostic.
                                throw new Error("Style binding must be string");
                            }
                            specialAttributes.styleAttr = value;
                            break;
                        default:
                            if (typeof value === 'string') {
                                attributes[key] = o.literal(value);
                            }
                            else {
                                attributes[key] = value;
                            }
                    }
                }
                else if (matches[1 /* Binding */] != null) {
                    if (typeof value !== 'string') {
                        // TODO(alxhub): make this a diagnostic.
                        throw new Error("Property binding must be string");
                    }
                    // synthetic properties (the ones that have a `@` as a prefix)
                    // are still treated the same as regular properties. Therefore
                    // there is no point in storing them in a separate map.
                    properties[matches[1 /* Binding */]] = value;
                }
                else if (matches[2 /* Event */] != null) {
                    if (typeof value !== 'string') {
                        // TODO(alxhub): make this a diagnostic.
                        throw new Error("Event binding must be string");
                    }
                    listeners[matches[2 /* Event */]] = value;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return { attributes: attributes, listeners: listeners, properties: properties, specialAttributes: specialAttributes };
    }
    exports.parseHostBindings = parseHostBindings;
    /**
     * Verifies host bindings and returns the list of errors (if any). Empty array indicates that a
     * given set of host bindings has no errors.
     *
     * @param bindings set of host bindings to verify.
     * @param sourceSpan source span where host bindings were defined.
     * @returns array of errors associated with a given set of host bindings.
     */
    function verifyHostBindings(bindings, sourceSpan) {
        var summary = metadataAsSummary(bindings);
        // TODO: abstract out host bindings verification logic and use it instead of
        // creating events and properties ASTs to detect errors (FW-996)
        var bindingParser = template_1.makeBindingParser();
        bindingParser.createDirectiveHostEventAsts(summary, sourceSpan);
        bindingParser.createBoundHostProperties(summary, sourceSpan);
        return bindingParser.errors;
    }
    exports.verifyHostBindings = verifyHostBindings;
    function compileStyles(styles, selector, hostSelector) {
        var shadowCss = new shadow_css_1.ShadowCss();
        return styles.map(function (style) { return shadowCss.shimCssText(style, selector, hostSelector); });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUF5SztJQUV6SyxpR0FBNkY7SUFFN0YsaURBQW1DO0lBRW5DLDZGQUFrRjtJQUNsRiwyREFBNkM7SUFFN0MsMkRBQTREO0lBQzVELCtEQUEyQztJQUMzQyx1RUFBNkQ7SUFFN0QsbURBQWdEO0lBQ2hELCtEQUFxQztJQUNyQyx1RUFBc0U7SUFDdEUsK0VBQW9EO0lBRXBELDJEQUErRztJQUcvRyxzRkFBcUU7SUFDckUsd0VBQW9MO0lBQ3BMLGdFQUE0TDtJQUU1TCxJQUFNLFdBQVcsR0FBVSxFQUFFLENBQUM7SUFFOUIsNkZBQTZGO0lBQzdGLHlGQUF5RjtJQUN6RixJQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQztJQUVwQyxTQUFTLG1CQUFtQixDQUN4QixJQUF5QixFQUFFLFlBQTBCLEVBQ3JELGFBQTRCO1FBQzlCLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBRSxDQUFDO1FBQzFDLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFaEUsMkJBQTJCO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU3QywwQ0FBMEM7UUFDMUMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN4QixhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDdEQ7UUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMz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SSxzQkFBUyxFQUFFLENBQUM7UUFDbEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFNLE9BQU8sU0FBVyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uLy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZVF1ZXJ5TWV0YWRhdGEsIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZSwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbCwgRGVmaW5pdGlvbktpbmR9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Qm91bmRFdmVudH0gZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7UjNGYWN0b3J5VGFyZ2V0LCBjb21waWxlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNDb21wb25lbnREZWYsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlRGVmLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge1N0eWxpbmdCdWlsZGVyLCBTdHlsaW5nSW5zdHJ1Y3Rpb259IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7QmluZGluZ1Njb3BlLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLCBWYWx1ZUNvbnZlcnRlciwgbWFrZUJpbmRpbmdQYXJzZXIsIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycywgcmVuZGVyRmxhZ0NoZWNrSWZTdG10LCByZXNvbHZlU2FuaXRpemF0aW9uRm59IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgY2hhaW5lZEluc3RydWN0aW9uLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbCwgZ2V0UXVlcnlQcmVkaWNhdGUsIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgRU1QVFlfQVJSQVk6IGFueVtdID0gW107XG5cbi8vIFRoaXMgcmVnZXggbWF0Y2hlcyBhbnkgYmluZGluZyBuYW1lcyB0aGF0IGNvbnRhaW4gdGhlIFwiYXR0ci5cIiBwcmVmaXgsIGUuZy4gXCJhdHRyLnJlcXVpcmVkXCJcbi8vIElmIHRoZXJlIGlzIGEgbWF0Y2gsIHRoZSBmaXJzdCBtYXRjaGluZyBncm91cCB3aWxsIGNvbnRhaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHRvIGJpbmQuXG5jb25zdCBBVFRSX1JFR0VYID0gL2F0dHJcXC4oW15cXF1dKykvO1xuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBEZWZpbml0aW9uTWFwIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGNvbnN0IHNlbGVjdG9ycyA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihtZXRhLnNlbGVjdG9yKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3JzOiBbWycnLCAnc29tZURpcicsICcnXV1gXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcnMnLCBhc0xpdGVyYWwoc2VsZWN0b3JzKSk7XG4gIH1cblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBlLmcuIGBjb250ZW50UXVlcmllczogKHJmLCBjdHgsIGRpckluZGV4KSA9PiB7IC4uLiB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdjb250ZW50UXVlcmllcycsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24obWV0YS5xdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICd2aWV3UXVlcnknLCBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKG1ldGEudmlld1F1ZXJpZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5uYW1lKSk7XG4gIH1cblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChyZiwgY3R4LCBlbEluZGV4KSA9PiB7IC4uLiB9XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2hvc3RCaW5kaW5ncycsIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhLmhvc3QsIG1ldGEudHlwZVNvdXJjZVNwYW4sIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YS5zZWxlY3RvciB8fCAnJywgbWV0YS5uYW1lKSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSB8IFIzQ29tcG9uZW50TWV0YWRhdGEpIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmUoKV1gXG4gIGNvbnN0IGZlYXR1cmVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGNvbnN0IHByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICBjb25zdCB2aWV3UHJvdmlkZXJzID0gKG1ldGEgYXMgUjNDb21wb25lbnRNZXRhZGF0YSkudmlld1Byb3ZpZGVycztcbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Jbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5mdWxsSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Db3B5RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLk5nT25DaGFuZ2VzRmVhdHVyZSkuY2FsbEZuKEVNUFRZX0FSUkFZKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0RpcmVjdGl2ZURlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuRGlyZWN0aXZlRGVmV2l0aE1ldGEpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21wb25lbnREZWYge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcblxuICBjb25zdCBzZWxlY3RvciA9IG1ldGEuc2VsZWN0b3IgJiYgQ3NzU2VsZWN0b3IucGFyc2UobWV0YS5zZWxlY3Rvcik7XG4gIGNvbnN0IGZpcnN0U2VsZWN0b3IgPSBzZWxlY3RvciAmJiBzZWxlY3RvclswXTtcblxuICAvLyBlLmcuIGBhdHRyOiBbXCJjbGFzc1wiLCBcIi5teS5hcHBcIl1gXG4gIC8vIFRoaXMgaXMgb3B0aW9uYWwgYW4gb25seSBpbmNsdWRlZCBpZiB0aGUgZmlyc3Qgc2VsZWN0b3Igb2YgYSBjb21wb25lbnQgc3BlY2lmaWVzIGF0dHJpYnV0ZXMuXG4gIGlmIChmaXJzdFNlbGVjdG9yKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JBdHRyaWJ1dGVzID0gZmlyc3RTZWxlY3Rvci5nZXRBdHRycygpO1xuICAgIGlmIChzZWxlY3RvckF0dHJpYnV0ZXMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgICAnYXR0cnMnLCBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JBdHRyaWJ1dGVzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0+IHZhbHVlICE9IG51bGwgPyBvLmxpdGVyYWwodmFsdWUpIDogby5saXRlcmFsKHVuZGVmaW5lZCkpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgLyogZm9yY2VTaGFyZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEdlbmVyYXRlIHRoZSBDU1MgbWF0Y2hlciB0aGF0IHJlY29nbml6ZSBkaXJlY3RpdmVcbiAgbGV0IGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsID0gbnVsbDtcblxuICBpZiAobWV0YS5kaXJlY3RpdmVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcigpO1xuICAgIGZvciAoY29uc3Qge3NlbGVjdG9yLCBleHByZXNzaW9ufSBvZiBtZXRhLmRpcmVjdGl2ZXMpIHtcbiAgICAgIG1hdGNoZXIuYWRkU2VsZWN0YWJsZXMoQ3NzU2VsZWN0b3IucGFyc2Uoc2VsZWN0b3IpLCBleHByZXNzaW9uKTtcbiAgICB9XG4gICAgZGlyZWN0aXZlTWF0Y2hlciA9IG1hdGNoZXI7XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgZGlyZWN0aXZlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgcGlwZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IGNoYW5nZURldGVjdGlvbiA9IG1ldGEuY2hhbmdlRGV0ZWN0aW9uO1xuXG4gIGNvbnN0IHRlbXBsYXRlID0gbWV0YS50ZW1wbGF0ZTtcbiAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICBjb25zdGFudFBvb2wsIEJpbmRpbmdTY29wZS5ST09UX1NDT1BFLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICBkaXJlY3RpdmVNYXRjaGVyLCBkaXJlY3RpdmVzVXNlZCwgbWV0YS5waXBlcywgcGlwZXNVc2VkLCBSMy5uYW1lc3BhY2VIVE1MLFxuICAgICAgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMpO1xuXG4gIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5ub2RlcywgW10pO1xuXG4gIC8vIFdlIG5lZWQgdG8gcHJvdmlkZSB0aGlzIHNvIHRoYXQgZHluYW1pY2FsbHkgZ2VuZXJhdGVkIGNvbXBvbmVudHMga25vdyB3aGF0XG4gIC8vIHByb2plY3RlZCBjb250ZW50IGJsb2NrcyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIGNvbXBvbmVudCB3aGVuIGl0IGlzIGluc3RhbnRpYXRlZC5cbiAgY29uc3QgbmdDb250ZW50U2VsZWN0b3JzID0gdGVtcGxhdGVCdWlsZGVyLmdldE5nQ29udGVudFNlbGVjdG9ycygpO1xuICBpZiAobmdDb250ZW50U2VsZWN0b3JzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIG5nQ29udGVudFNlbGVjdG9ycyk7XG4gIH1cblxuICAvLyBlLmcuIGBkZWNsczogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRDb25zdENvdW50KCkpKTtcblxuICAvLyBlLmcuIGB2YXJzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgndmFycycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0VmFyQ291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYGNvbnN0czogW1snb25lJywgJ3R3byddLCBbJ3RocmVlJywgJ2ZvdXInXV1cbiAgY29uc3QgY29uc3RzID0gdGVtcGxhdGVCdWlsZGVyLmdldENvbnN0cygpO1xuICBpZiAoY29uc3RzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5saXRlcmFsQXJyKGNvbnN0cykpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24pO1xuXG4gIC8vIGUuZy4gYGRpcmVjdGl2ZXM6IFtNeURpcmVjdGl2ZV1gXG4gIGlmIChkaXJlY3RpdmVzVXNlZC5zaXplKSB7XG4gICAgbGV0IGRpcmVjdGl2ZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShkaXJlY3RpdmVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIGRpcmVjdGl2ZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChkaXJlY3RpdmVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RpcmVjdGl2ZXMnLCBkaXJlY3RpdmVzRXhwcik7XG4gIH1cblxuICAvLyBlLmcuIGBwaXBlczogW015UGlwZV1gXG4gIGlmIChwaXBlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBwaXBlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKHBpcGVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIHBpcGVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocGlwZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBwaXBlc0V4cHIpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHJpbmdzID0gc3R5bGVWYWx1ZXMubWFwKHN0ciA9PiBvLmxpdGVyYWwoc3RyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHJpbmdzKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gc3R5bGUsIGRvbid0IGdlbmVyYXRlIGNzcyBzZWxlY3RvcnMgb24gZWxlbWVudHNcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLk5vbmU7XG4gIH1cblxuICAvLyBPbmx5IHNldCB2aWV3IGVuY2Fwc3VsYXRpb24gaWYgaXQncyBub3QgdGhlIGRlZmF1bHQgdmFsdWVcbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdlbmNhcHN1bGF0aW9uJywgby5saXRlcmFsKG1ldGEuZW5jYXBzdWxhdGlvbikpO1xuICB9XG5cbiAgLy8gZS5nLiBgYW5pbWF0aW9uOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbicsIHZhbHVlOiBtZXRhLmFuaW1hdGlvbnMsIHF1b3RlZDogZmFsc2V9XSkpO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdGhlIGNoYW5nZSBkZXRlY3Rpb24gZmxhZyBpZiBpdCdzIGRlZmluZWQgYW5kIGl0J3Mgbm90IHRoZSBkZWZhdWx0LlxuICBpZiAoY2hhbmdlRGV0ZWN0aW9uICE9IG51bGwgJiYgY2hhbmdlRGV0ZWN0aW9uICE9PSBjb3JlLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKGNoYW5nZURldGVjdGlvbikpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlVHlwZUZvckRlZihtZXRhLCBSMy5Db21wb25lbnREZWZXaXRoTWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlRGlyZWN0aXZlYCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLnR5cGUpICE7XG4gIG5hbWUgfHwgZXJyb3IoYENhbm5vdCByZXNvbHZlciB0aGUgbmFtZSBvZiAke2RpcmVjdGl2ZS50eXBlfWApO1xuXG4gIGNvbnN0IGRlZmluaXRpb25GaWVsZCA9IG91dHB1dEN0eC5jb25zdGFudFBvb2wucHJvcGVydHlOYW1lT2YoRGVmaW5pdGlvbktpbmQuRGlyZWN0aXZlKTtcblxuICBjb25zdCBtZXRhID0gZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLCBvdXRwdXRDdHgsIHJlZmxlY3Rvcik7XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgb3V0cHV0Q3R4LmNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGZhY3RvcnlSZXMgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKFxuICAgICAgey4uLm1ldGEsIGluamVjdEZuOiBSMy5kaXJlY3RpdmVJbmplY3QsIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0LkRpcmVjdGl2ZX0pO1xuICBjb25zdCBuZ0ZhY3RvcnlEZWZTdGF0ZW1lbnQgPSBuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoJ8m1ZmFjJywgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgZmFjdG9yeVJlcy5mYWN0b3J5KV0sIFtdLFxuICAgICAgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pO1xuICBjb25zdCBkaXJlY3RpdmVEZWZTdGF0ZW1lbnQgPSBuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZ0ZhY3RvcnlEZWZTdGF0ZW1lbnQsIGRpcmVjdGl2ZURlZlN0YXRlbWVudCk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7bm9kZXM6IHJlbmRlcjNBc3Qubm9kZXN9LFxuICAgIGRpcmVjdGl2ZXM6IFtdLFxuICAgIHBpcGVzOiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKHBpcGVUeXBlQnlOYW1lLCBvdXRwdXRDdHgpLFxuICAgIHZpZXdRdWVyaWVzOiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudC52aWV3UXVlcmllcywgb3V0cHV0Q3R4KSxcbiAgICB3cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlOiBmYWxzZSxcbiAgICBzdHlsZXM6IChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuc3R5bGVzKSB8fCBFTVBUWV9BUlJBWSxcbiAgICBlbmNhcHN1bGF0aW9uOlxuICAgICAgICAoc3VtbWFyeS50ZW1wbGF0ZSAmJiBzdW1tYXJ5LnRlbXBsYXRlLmVuY2Fwc3VsYXRpb24pIHx8IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgaW50ZXJwb2xhdGlvbjogREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyxcbiAgICBhbmltYXRpb25zOiBudWxsLFxuICAgIHZpZXdQcm92aWRlcnM6XG4gICAgICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LnZpZXdQcm92aWRlcnMpIDogbnVsbCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICB9O1xuICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbihcbiAgICAgIHsuLi5tZXRhLCBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LCB0YXJnZXQ6IFIzRmFjdG9yeVRhcmdldC5EaXJlY3RpdmV9KTtcbiAgY29uc3QgbmdGYWN0b3J5RGVmU3RhdGVtZW50ID0gbmV3IG8uQ2xhc3NTdG10KFxuICAgICAgbmFtZSwgbnVsbCxcbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKCfJtWZhYycsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIGZhY3RvcnlSZXMuZmFjdG9yeSldLCBbXSxcbiAgICAgIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKTtcbiAgY29uc3QgY29tcG9uZW50RGVmU3RhdGVtZW50ID0gbmV3IG8uQ2xhc3NTdG10KFxuICAgICAgbmFtZSwgbnVsbCxcbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKGRlZmluaXRpb25GaWVsZCwgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgcmVzLmV4cHJlc3Npb24pXSxcbiAgICAgIFtdLCBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSk7XG5cbiAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWFsIGNsYXNzIHRvIGJlIG1lcmdlZCB3aXRoIHRoZSBhY3R1YWwgY2xhc3MuXG4gIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2gobmdGYWN0b3J5RGVmU3RhdGVtZW50LCBjb21wb25lbnREZWZTdGF0ZW1lbnQpO1xufVxuXG4vKipcbiAqIENvbXB1dGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGdpdmVuIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBhIGBDb21waWxlUmVmbGVjdG9yYC5cbiAqL1xuZnVuY3Rpb24gZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgLy8gVGhlIGdsb2JhbC1hbmFseXNpcyBiYXNlZCBJdnkgbW9kZSBpbiBuZ2MgaXMgbm8gbG9uZ2VyIHV0aWxpemVkL3N1cHBvcnRlZC5cbiAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCcpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbXBpbGVRdWVyeU1ldGFkYXRhYCBpbnRvIGBSM1F1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHF1ZXJpZXM6IENvbXBpbGVRdWVyeU1ldGFkYXRhW10sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IFIzUXVlcnlNZXRhZGF0YVtdIHtcbiAgcmV0dXJuIHF1ZXJpZXMubWFwKHF1ZXJ5ID0+IHtcbiAgICBsZXQgcmVhZDogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGlmIChxdWVyeS5yZWFkICYmIHF1ZXJ5LnJlYWQuaWRlbnRpZmllcikge1xuICAgICAgcmVhZCA9IG91dHB1dEN0eC5pbXBvcnRFeHByKHF1ZXJ5LnJlYWQuaWRlbnRpZmllci5yZWZlcmVuY2UpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcHJvcGVydHlOYW1lOiBxdWVyeS5wcm9wZXJ0eU5hbWUsXG4gICAgICBmaXJzdDogcXVlcnkuZmlyc3QsXG4gICAgICBwcmVkaWNhdGU6IHNlbGVjdG9yc0Zyb21HbG9iYWxNZXRhZGF0YShxdWVyeS5zZWxlY3RvcnMsIG91dHB1dEN0eCksXG4gICAgICBkZXNjZW5kYW50czogcXVlcnkuZGVzY2VuZGFudHMsIHJlYWQsXG4gICAgICBzdGF0aWM6ICEhcXVlcnkuc3RhdGljXG4gICAgfTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVRva2VuTWV0YWRhdGFgIGZvciBxdWVyeSBzZWxlY3RvcnMgaW50byBlaXRoZXIgYW4gZXhwcmVzc2lvbiBmb3IgYSBwcmVkaWNhdGVcbiAqIHR5cGUsIG9yIGEgbGlzdCBvZiBzdHJpbmcgcHJlZGljYXRlcy5cbiAqL1xuZnVuY3Rpb24gc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHNlbGVjdG9yczogQ29tcGlsZVRva2VuTWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogby5FeHByZXNzaW9ufHN0cmluZ1tdIHtcbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPiAxIHx8IChzZWxlY3RvcnMubGVuZ3RoID09IDEgJiYgc2VsZWN0b3JzWzBdLnZhbHVlKSkge1xuICAgIGNvbnN0IHNlbGVjdG9yU3RyaW5ncyA9IHNlbGVjdG9ycy5tYXAodmFsdWUgPT4gdmFsdWUudmFsdWUgYXMgc3RyaW5nKTtcbiAgICBzZWxlY3RvclN0cmluZ3Muc29tZSh2YWx1ZSA9PiAhdmFsdWUpICYmXG4gICAgICAgIGVycm9yKCdGb3VuZCBhIHR5cGUgYW1vbmcgdGhlIHN0cmluZyBzZWxlY3RvcnMgZXhwZWN0ZWQnKTtcbiAgICByZXR1cm4gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvclN0cmluZ3MubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSk7XG4gIH1cblxuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA9PSAxKSB7XG4gICAgY29uc3QgZmlyc3QgPSBzZWxlY3RvcnNbMF07XG4gICAgaWYgKGZpcnN0LmlkZW50aWZpZXIpIHtcbiAgICAgIHJldHVybiBvdXRwdXRDdHguaW1wb3J0RXhwcihmaXJzdC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICB9XG5cbiAgZXJyb3IoJ1VuZXhwZWN0ZWQgcXVlcnkgZm9ybScpO1xuICByZXR1cm4gby5OVUxMX0VYUFI7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgcGFyYW1ldGVycyA9IFtnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgY29uc3RhbnRQb29sKSwgby5saXRlcmFsKHF1ZXJ5LmRlc2NlbmRhbnRzKV07XG4gIGlmIChxdWVyeS5yZWFkKSB7XG4gICAgcGFyYW1ldGVycy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTpcbiAgICBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgdmFsdWVzLnB1c2goby5saXRlcmFsKGtleSksIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWVzO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgY29udGVudCBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKFxuICAgIHF1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICBmb3IgKGNvbnN0IHF1ZXJ5IG9mIHF1ZXJpZXMpIHtcbiAgICBjb25zdCBxdWVyeUluc3RydWN0aW9uID0gcXVlcnkuc3RhdGljID8gUjMuc3RhdGljQ29udGVudFF1ZXJ5IDogUjMuY29udGVudFF1ZXJ5O1xuXG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMuY29udGVudFF1ZXJ5KGRpckluZGV4LCBzb21lUHJlZGljYXRlLCB0cnVlLCBudWxsKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgIG8uaW1wb3J0RXhwcihxdWVyeUluc3RydWN0aW9uKVxuICAgICAgICAgICAgLmNhbGxGbihbby52YXJpYWJsZSgnZGlySW5kZXgnKSwgLi4ucHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpIGFzIGFueV0pXG4gICAgICAgICAgICAudG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZFF1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9XG5cbiAgY29uc3QgY29udGVudFF1ZXJpZXNGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG51bGwpXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBjb250ZW50UXVlcmllc0ZuTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNUeXBlKG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdfSk6IG8uVHlwZSB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxNYXAobWFwVmFsdWVzKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogc3RyaW5nW10pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVHlwZUZvckRlZihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCB0eXBlQmFzZTogby5FeHRlcm5hbFJlZmVyZW5jZSk6IG8uVHlwZSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSBtZXRhLnNlbGVjdG9yICE9PSBudWxsID8gbWV0YS5zZWxlY3Rvci5yZXBsYWNlKC9cXG4vZywgJycpIDogbnVsbDtcblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIodHlwZUJhc2UsIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzZWxlY3RvckZvclR5cGUgIT09IG51bGwgPyBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSA6IG8uTk9ORV9UWVBFLFxuICAgIG1ldGEuZXhwb3J0QXMgIT09IG51bGwgPyBzdHJpbmdBcnJheUFzVHlwZShtZXRhLmV4cG9ydEFzKSA6IG8uTk9ORV9UWVBFLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLmlucHV0cyksXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEub3V0cHV0cyksXG4gICAgc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5xdWVyaWVzLm1hcChxID0+IHEucHJvcGVydHlOYW1lKSksXG4gIF0pKTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIHZpZXdRdWVyaWVzLmZvckVhY2goKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpID0+IHtcbiAgICBjb25zdCBxdWVyeUluc3RydWN0aW9uID0gcXVlcnkuc3RhdGljID8gUjMuc3RhdGljVmlld1F1ZXJ5IDogUjMudmlld1F1ZXJ5O1xuXG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMudmlld1F1ZXJ5KHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9XG4gICAgICAgIG8uaW1wb3J0RXhwcihxdWVyeUluc3RydWN0aW9uKS5jYWxsRm4ocHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gocXVlcnlEZWZpbml0aW9uLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRRdWVyeSgpKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRRdWVyeSkuY2FsbEZuKFtdKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfSk7XG5cbiAgY29uc3Qgdmlld1F1ZXJ5Rm5OYW1lID0gbmFtZSA/IGAke25hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBob3N0QmluZGluZ3NNZXRhZGF0YTogUjNIb3N0TWV0YWRhdGEsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHNlbGVjdG9yOiBzdHJpbmcsXG4gICAgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgLy8gSW5pdGlhbGl6ZSBob3N0VmFyc0NvdW50IHRvIG51bWJlciBvZiBib3VuZCBob3N0IHByb3BlcnRpZXMgKGludGVycG9sYXRpb25zIGlsbGVnYWwpXG4gIGNvbnN0IGhvc3RWYXJzQ291bnQgPSBPYmplY3Qua2V5cyhob3N0QmluZGluZ3NNZXRhZGF0YS5wcm9wZXJ0aWVzKS5sZW5ndGg7XG4gIGNvbnN0IGVsVmFyRXhwID0gby52YXJpYWJsZSgnZWxJbmRleCcpO1xuICBjb25zdCBiaW5kaW5nQ29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgY29uc3Qgc3R5bGVCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKGVsVmFyRXhwLCBiaW5kaW5nQ29udGV4dCk7XG5cbiAgY29uc3Qge3N0eWxlQXR0ciwgY2xhc3NBdHRyfSA9IGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzO1xuICBpZiAoc3R5bGVBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIoc3R5bGVBdHRyKTtcbiAgfVxuICBpZiAoY2xhc3NBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIoY2xhc3NBdHRyKTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIGxldCB0b3RhbEhvc3RWYXJzQ291bnQgPSBob3N0VmFyc0NvdW50O1xuICBjb25zdCBob3N0QmluZGluZ1NvdXJjZVNwYW4gPSB0eXBlU291cmNlU3BhbjtcbiAgY29uc3QgZGlyZWN0aXZlU3VtbWFyeSA9IG1ldGFkYXRhQXNTdW1tYXJ5KGhvc3RCaW5kaW5nc01ldGFkYXRhKTtcblxuICBsZXQgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBjb25zdCBnZXRWYWx1ZUNvbnZlcnRlciA9ICgpID0+IHtcbiAgICBpZiAoIXZhbHVlQ29udmVydGVyKSB7XG4gICAgICBjb25zdCBob3N0VmFyc0NvdW50Rm4gPSAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVmFyc0NvdW50ID0gdG90YWxIb3N0VmFyc0NvdW50O1xuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gbnVtU2xvdHM7XG4gICAgICAgIHJldHVybiBvcmlnaW5hbFZhcnNDb3VudDtcbiAgICAgIH07XG4gICAgICB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCAgLy8gbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICAgICAgICBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTsgIC8vIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlQ29udmVydGVyO1xuICB9O1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzLCBuYW1lKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goLi4ubGlzdGVuZXJzKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBiaW5kaW5ncyA9IGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0hvc3RCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuXG4gIGJpbmRpbmdzICYmIGJpbmRpbmdzLmZvckVhY2goKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPVxuICAgICAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdChnZXRWYWx1ZUNvbnZlcnRlcigpKTtcbiAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSk7XG5cbiAgICAgIGNvbnN0IHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlfSA9IGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZyk7XG5cbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICAgIGJpbmRpbmdQYXJzZXIuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhzZWxlY3RvciwgYmluZGluZ05hbWUsIGlzQXR0cmlidXRlKVxuICAgICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gY29yZS5TZWN1cml0eUNvbnRleHQuTk9ORSk7XG5cbiAgICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoID09PSAyICYmXG4gICAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuVVJMKSA+IC0xICYmXG4gICAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMKSA+IC0xKSB7XG4gICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzb21lIFVSTCBhdHRyaWJ1dGVzIChzdWNoIGFzIFwic3JjXCIgYW5kIFwiaHJlZlwiKSB0aGF0IG1heSBiZSBhIHBhcnRcbiAgICAgICAgICAvLyBvZiBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbCBzYW50aXRpemF0aW9uIGZ1bmN0aW9uIGFuZFxuICAgICAgICAgIC8vIHNlbGVjdCB0aGUgYWN0dWFsIHNhbml0aXplciBhdCBydW50aW1lIGJhc2VkIG9uIGEgdGFnIG5hbWUgdGhhdCBpcyBwcm92aWRlZCB3aGlsZVxuICAgICAgICAgIC8vIGludm9raW5nIHNhbml0aXphdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgICBzYW5pdGl6ZXJGbiA9IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybE9yUmVzb3VyY2VVcmwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNhbml0aXplckZuID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKHNlY3VyaXR5Q29udGV4dHNbMF0sIGlzQXR0cmlidXRlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb25QYXJhbXMgPSBbby5saXRlcmFsKGJpbmRpbmdOYW1lKSwgYmluZGluZ0V4cHIuY3VyclZhbEV4cHJdO1xuICAgICAgaWYgKHNhbml0aXplckZuKSB7XG4gICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goc2FuaXRpemVyRm4pO1xuICAgICAgfVxuXG4gICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goLi4uYmluZGluZ0V4cHIuc3RtdHMpO1xuXG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmhvc3RQcm9wZXJ0eSkge1xuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuYXR0cmlidXRlKSB7XG4gICAgICAgIGF0dHJpYnV0ZUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMudXBkYXRlU3ludGhldGljSG9zdEJpbmRpbmcpIHtcbiAgICAgICAgc3ludGhldGljSG9zdEJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKGluc3RydWN0aW9uUGFyYW1zKS50b1N0bXQoKSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5ob3N0UHJvcGVydHksIHByb3BlcnR5QmluZGluZ3MpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChhdHRyaWJ1dGVCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5hdHRyaWJ1dGUsIGF0dHJpYnV0ZUJpbmRpbmdzKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoc3ludGhldGljSG9zdEJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgIGNoYWluZWRJbnN0cnVjdGlvbihSMy51cGRhdGVTeW50aGV0aWNIb3N0QmluZGluZywgc3ludGhldGljSG9zdEJpbmRpbmdzKS50b1N0bXQoKSk7XG4gIH1cblxuICAvLyBzaW5jZSB3ZSdyZSBkZWFsaW5nIHdpdGggZGlyZWN0aXZlcy9jb21wb25lbnRzIGFuZCBib3RoIGhhdmUgaG9zdEJpbmRpbmdcbiAgLy8gZnVuY3Rpb25zLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIGEgc3BlY2lhbCBob3N0QXR0cnMgaW5zdHJ1Y3Rpb24gdGhhdCBkZWFsc1xuICAvLyB3aXRoIGJvdGggdGhlIGFzc2lnbm1lbnQgb2Ygc3R5bGluZyBhcyB3ZWxsIGFzIHN0YXRpYyBhdHRyaWJ1dGVzIHRvIHRoZSBob3N0XG4gIC8vIGVsZW1lbnQuIFRoZSBpbnN0cnVjdGlvbiBiZWxvdyB3aWxsIGluc3RydWN0IGFsbCBpbml0aWFsIHN0eWxpbmcgKHN0eWxpbmdcbiAgLy8gdGhhdCBpcyBpbnNpZGUgb2YgYSBob3N0IGJpbmRpbmcgd2l0aGluIGEgZGlyZWN0aXZlL2NvbXBvbmVudCkgdG8gYmUgYXR0YWNoZWRcbiAgLy8gdG8gdGhlIGhvc3QgZWxlbWVudCBhbG9uZ3NpZGUgYW55IG9mIHRoZSBwcm92aWRlZCBob3N0IGF0dHJpYnV0ZXMgdGhhdCB3ZXJlXG4gIC8vIGNvbGxlY3RlZCBlYXJsaWVyLlxuICBjb25zdCBob3N0QXR0cnMgPSBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlcyk7XG4gIGNvbnN0IGhvc3RJbnN0cnVjdGlvbiA9IHN0eWxlQnVpbGRlci5idWlsZEhvc3RBdHRyc0luc3RydWN0aW9uKG51bGwsIGhvc3RBdHRycywgY29uc3RhbnRQb29sKTtcbiAgaWYgKGhvc3RJbnN0cnVjdGlvbikge1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdHlsaW5nU3RtdChob3N0SW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgfVxuXG4gIGlmIChzdHlsZUJ1aWxkZXIuaGFzQmluZGluZ3MpIHtcbiAgICAvLyBmaW5hbGx5IGVhY2ggYmluZGluZyB0aGF0IHdhcyByZWdpc3RlcmVkIGluIHRoZSBzdGF0ZW1lbnQgYWJvdmUgd2lsbCBuZWVkIHRvIGJlIGFkZGVkIHRvXG4gICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgIC8vIGFyZSBldmFsdWF0ZWQgYW5kIHVwZGF0ZWQgZm9yIHRoZSBlbGVtZW50LlxuICAgIHN0eWxlQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKGdldFZhbHVlQ29udmVydGVyKCkpLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgLy8gd2Ugc3VidHJhY3QgYSB2YWx1ZSBvZiBgMWAgaGVyZSBiZWNhdXNlIHRoZSBiaW5kaW5nIHNsb3Qgd2FzIGFscmVhZHlcbiAgICAgIC8vIGFsbG9jYXRlZCBhdCB0aGUgdG9wIG9mIHRoaXMgbWV0aG9kIHdoZW4gYWxsIHRoZSBpbnB1dCBiaW5kaW5ncyB3ZXJlXG4gICAgICAvLyBjb3VudGVkLlxuICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IE1hdGgubWF4KGluc3RydWN0aW9uLmFsbG9jYXRlQmluZGluZ1Nsb3RzIC0gMSwgMCk7XG4gICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goY3JlYXRlU3R5bGluZ1N0bXQoaW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b3RhbEhvc3RWYXJzQ291bnQpIHtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnVuc2hpZnQoXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5hbGxvY0hvc3RWYXJzKS5jYWxsRm4oW28ubGl0ZXJhbCh0b3RhbEhvc3RWYXJzQ291bnQpXSkudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCB8fCB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0QmluZGluZ3NGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oZWxWYXJFeHAubmFtZSAhLCBvLk5VTUJFUl9UWVBFKVxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gYmluZGluZ0ZuKGltcGxpY2l0OiBhbnksIHZhbHVlOiBBU1QpIHtcbiAgcmV0dXJuIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICBudWxsLCBpbXBsaWNpdCwgdmFsdWUsICdiJywgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTdHlsaW5nU3RtdChcbiAgICBpbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKTogby5TdGF0ZW1lbnQge1xuICBjb25zdCBwYXJhbXMgPSBpbnN0cnVjdGlvbi5wYXJhbXModmFsdWUgPT4gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSkuY3VyclZhbEV4cHIpO1xuICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uLnJlZmVyZW5jZSwgbnVsbCwgaW5zdHJ1Y3Rpb24uc291cmNlU3BhbilcbiAgICAgIC5jYWxsRm4ocGFyYW1zLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLnRvU3RtdCgpO1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KTpcbiAgICB7YmluZGluZ05hbWU6IHN0cmluZywgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlzQXR0cmlidXRlOiBib29sZWFufSB7XG4gIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgbGV0IGluc3RydWN0aW9uICE6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgYW4gYXR0ciBiaW5kaW5nIG9yIGEgcHJvcGVydHkgYmluZGluZ1xuICBjb25zdCBhdHRyTWF0Y2hlcyA9IGJpbmRpbmdOYW1lLm1hdGNoKEFUVFJfUkVHRVgpO1xuICBpZiAoYXR0ck1hdGNoZXMpIHtcbiAgICBiaW5kaW5nTmFtZSA9IGF0dHJNYXRjaGVzWzFdO1xuICAgIGluc3RydWN0aW9uID0gUjMuYXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLnVwZGF0ZVN5bnRoZXRpY0hvc3RCaW5kaW5nO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmhvc3RQcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGU6ICEhYXR0ck1hdGNoZXN9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sIG5hbWU/OiBzdHJpbmcpOiBvLlN0YXRlbWVudFtdIHtcbiAgcmV0dXJuIGV2ZW50QmluZGluZ3MubWFwKGJpbmRpbmcgPT4ge1xuICAgIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoYmluZGluZy5uYW1lKTtcbiAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gYmluZGluZy50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGJpbmRpbmdOYW1lLCBiaW5kaW5nLnRhcmdldE9yUGhhc2UpIDpcbiAgICAgICAgYmluZGluZ05hbWU7XG4gICAgY29uc3QgaGFuZGxlck5hbWUgPSBuYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7bmFtZX1fJHtiaW5kaW5nRm5OYW1lfV9Ib3N0QmluZGluZ0hhbmRsZXJgIDogbnVsbDtcbiAgICBjb25zdCBwYXJhbXMgPSBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoYmluZGluZyksIGhhbmRsZXJOYW1lKTtcbiAgICBjb25zdCBpbnN0cnVjdGlvbiA9XG4gICAgICAgIGJpbmRpbmcudHlwZSA9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gUjMuY29tcG9uZW50SG9zdFN5bnRoZXRpY0xpc3RlbmVyIDogUjMubGlzdGVuZXI7XG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKHBhcmFtcykudG9TdG10KCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0hvc3RNZXRhZGF0YSk6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5IHtcbiAgLy8gY2xhbmctZm9ybWF0IG9mZlxuICByZXR1cm4ge1xuICAgIC8vIFRoaXMgaXMgdXNlZCBieSB0aGUgQmluZGluZ1BhcnNlciwgd2hpY2ggb25seSBkZWFscyB3aXRoIGxpc3RlbmVycyBhbmQgcHJvcGVydGllcy4gVGhlcmUncyBub1xuICAgIC8vIG5lZWQgdG8gcGFzcyBhdHRyaWJ1dGVzIHRvIGl0LlxuICAgIGhvc3RBdHRyaWJ1dGVzOiB7fSxcbiAgICBob3N0TGlzdGVuZXJzOiBtZXRhLmxpc3RlbmVycyxcbiAgICBob3N0UHJvcGVydGllczogbWV0YS5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuLy8gRGVmaW5lcyBIb3N0IEJpbmRpbmdzIHN0cnVjdHVyZSB0aGF0IGNvbnRhaW5zIGF0dHJpYnV0ZXMsIGxpc3RlbmVycywgYW5kIHByb3BlcnRpZXMsXG4vLyBwYXJzZWQgZnJvbSB0aGUgYGhvc3RgIG9iamVjdCBkZWZpbmVkIGZvciBhIFR5cGUuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IG8uRXhwcmVzc2lvbn0pOlxuICAgIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gIGNvbnN0IGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3Qgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9ID0ge307XG5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoaG9zdCkpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG5cbiAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENsYXNzIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHlsZSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSBvLmxpdGVyYWwodmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ10gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIC8vIHN5bnRoZXRpYyBwcm9wZXJ0aWVzICh0aGUgb25lcyB0aGF0IGhhdmUgYSBgQGAgYXMgYSBwcmVmaXgpXG4gICAgICAvLyBhcmUgc3RpbGwgdHJlYXRlZCB0aGUgc2FtZSBhcyByZWd1bGFyIHByb3BlcnRpZXMuIFRoZXJlZm9yZVxuICAgICAgLy8gdGhlcmUgaXMgbm8gcG9pbnQgaW4gc3RvcmluZyB0aGVtIGluIGEgc2VwYXJhdGUgbWFwLlxuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ11dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdmVudCBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgc3BlY2lhbEF0dHJpYnV0ZXN9O1xufVxuXG4vKipcbiAqIFZlcmlmaWVzIGhvc3QgYmluZGluZ3MgYW5kIHJldHVybnMgdGhlIGxpc3Qgb2YgZXJyb3JzIChpZiBhbnkpLiBFbXB0eSBhcnJheSBpbmRpY2F0ZXMgdGhhdCBhXG4gKiBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncyBoYXMgbm8gZXJyb3JzLlxuICpcbiAqIEBwYXJhbSBiaW5kaW5ncyBzZXQgb2YgaG9zdCBiaW5kaW5ncyB0byB2ZXJpZnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBzb3VyY2Ugc3BhbiB3aGVyZSBob3N0IGJpbmRpbmdzIHdlcmUgZGVmaW5lZC5cbiAqIEByZXR1cm5zIGFycmF5IG9mIGVycm9ycyBhc3NvY2lhdGVkIHdpdGggYSBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUhvc3RCaW5kaW5ncyhcbiAgICBiaW5kaW5nczogUGFyc2VkSG9zdEJpbmRpbmdzLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBzdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkoYmluZGluZ3MpO1xuICAvLyBUT0RPOiBhYnN0cmFjdCBvdXQgaG9zdCBiaW5kaW5ncyB2ZXJpZmljYXRpb24gbG9naWMgYW5kIHVzZSBpdCBpbnN0ZWFkIG9mXG4gIC8vIGNyZWF0aW5nIGV2ZW50cyBhbmQgcHJvcGVydGllcyBBU1RzIHRvIGRldGVjdCBlcnJvcnMgKEZXLTk5NilcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhzdW1tYXJ5LCBzb3VyY2VTcGFuKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKHN1bW1hcnksIHNvdXJjZVNwYW4pO1xuICByZXR1cm4gYmluZGluZ1BhcnNlci5lcnJvcnM7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVTdHlsZXMoc3R5bGVzOiBzdHJpbmdbXSwgc2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcbiAgcmV0dXJuIHN0eWxlcy5tYXAoc3R5bGUgPT4geyByZXR1cm4gc2hhZG93Q3NzICEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpOyB9KTtcbn1cbiJdfQ==