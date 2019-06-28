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
    function getStylingPrefix(name) {
        return name.substring(0, 5); // style or class
    }
    function baseDirectiveFields(meta, constantPool, bindingParser) {
        var definitionMap = new util_3.DefinitionMap();
        // e.g. `type: MyDirective`
        definitionMap.set('type', meta.type);
        // e.g. `selectors: [['', 'someDir', '']]`
        definitionMap.set('selectors', createDirectiveSelector(meta.selector));
        // e.g. `factory: () => new MyApp(directiveInject(ElementRef))`
        var result = r3_factory_1.compileFactoryFunction({
            name: meta.name,
            type: meta.type,
            deps: meta.deps,
            injectFn: r3_identifiers_1.Identifiers.directiveInject,
        });
        definitionMap.set('factory', result.factory);
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
        return { definitionMap: definitionMap, statements: result.statements };
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
        var _a = baseDirectiveFields(meta, constantPool, bindingParser), definitionMap = _a.definitionMap, statements = _a.statements;
        addFeatures(definitionMap, meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineDirective).callFn([definitionMap.toLiteralMap()]);
        if (!meta.selector) {
            throw new Error("Directive " + meta.name + " has no selector, please add it!");
        }
        var type = createTypeForDef(meta, r3_identifiers_1.Identifiers.DirectiveDefWithMeta);
        return { expression: expression, type: type, statements: statements };
    }
    exports.compileDirectiveFromMetadata = compileDirectiveFromMetadata;
    /**
     * Compile a base definition for the render3 runtime as defined by {@link R3BaseRefMetadata}
     * @param meta the metadata used for compilation.
     */
    function compileBaseDefFromMetadata(meta, constantPool, bindingParser) {
        var definitionMap = new util_3.DefinitionMap();
        if (meta.inputs) {
            var inputs_1 = meta.inputs;
            var inputsMap = Object.keys(inputs_1).map(function (key) {
                var v = inputs_1[key];
                var value = Array.isArray(v) ? o.literalArr(v.map(function (vx) { return o.literal(vx); })) : o.literal(v);
                return { key: key, value: value, quoted: false };
            });
            definitionMap.set('inputs', o.literalMap(inputsMap));
        }
        if (meta.outputs) {
            var outputs_1 = meta.outputs;
            var outputsMap = Object.keys(outputs_1).map(function (key) {
                var value = o.literal(outputs_1[key]);
                return { key: key, value: value, quoted: false };
            });
            definitionMap.set('outputs', o.literalMap(outputsMap));
        }
        if (meta.viewQueries && meta.viewQueries.length > 0) {
            definitionMap.set('viewQuery', createViewQueriesFunction(meta.viewQueries, constantPool));
        }
        if (meta.queries && meta.queries.length > 0) {
            definitionMap.set('contentQueries', createContentQueriesFunction(meta.queries, constantPool));
        }
        if (meta.host) {
            definitionMap.set('hostBindings', createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.name));
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineBase).callFn([definitionMap.toLiteralMap()]);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.BaseDef));
        return { expression: expression, type: type };
    }
    exports.compileBaseDefFromMetadata = compileBaseDefFromMetadata;
    /**
     * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
     */
    function compileComponentFromMetadata(meta, constantPool, bindingParser) {
        var e_1, _a;
        var _b = baseDirectiveFields(meta, constantPool, bindingParser), definitionMap = _b.definitionMap, statements = _b.statements;
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
                for (var _c = tslib_1.__values(meta.directives), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var _e = _d.value, selector_2 = _e.selector, expression_1 = _e.expression;
                    matcher.addSelectables(selector_1.CssSelector.parse(selector_2), expression_1);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
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
        // e.g. `consts: 2`
        definitionMap.set('consts', o.literal(templateBuilder.getConstCount()));
        // e.g. `vars: 2`
        definitionMap.set('vars', o.literal(templateBuilder.getVarCount()));
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
        // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
        // string literal, which must be on one line.
        var selectorForType = (meta.selector || '').replace(/\n/g, '');
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineComponent).callFn([definitionMap.toLiteralMap()]);
        var type = createTypeForDef(meta, r3_identifiers_1.Identifiers.ComponentDefWithMeta);
        return { expression: expression, type: type, statements: statements };
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
        // Create the partial class to be merged with the actual class.
        outputCtx.statements.push(new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []));
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
        var meta = tslib_1.__assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector), { selector: component.selector, template: { nodes: render3Ast.nodes }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, interpolation: interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
        var res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
        // Create the partial class to be merged with the actual class.
        outputCtx.statements.push(new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []));
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
        var parameters = [
            util_3.getQueryPredicate(query, constantPool),
            o.literal(query.descendants),
            query.read || o.literal(null),
        ];
        return parameters;
    }
    // Turn a directive selector into an R3-compatible selector for directive def
    function createDirectiveSelector(selector) {
        return util_3.asLiteral(core.parseSelectorToR3Selector(selector));
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
                // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
                var args = tslib_1.__spread([o.variable('dirIndex')], prepareQueryParams(query, constantPool));
                var queryInstruction = query.static ? r3_identifiers_1.Identifiers.staticContentQuery : r3_identifiers_1.Identifiers.contentQuery;
                createStatements.push(o.importExpr(queryInstruction).callFn(args).toStmt());
                // update, e.g. (r3.queryRefresh(tmp = r3.loadContentQuery()) && (ctx.someDir = tmp));
                var temporary = tempAllocator();
                var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadContentQuery).callFn([]);
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
        var selectorForType = (meta.selector || '').replace(/\n/g, '');
        return o.expressionType(o.importExpr(typeBase, [
            util_2.typeWithParameters(meta.type, meta.typeArgumentCount),
            stringAsType(selectorForType),
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
            // update, e.g. (r3.queryRefresh(tmp = r3.loadViewQuery()) && (ctx.someDir = tmp));
            var temporary = tempAllocator();
            var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadViewQuery).callFn([]);
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
        // Initialize hostVarsCount to number of bound host properties (interpolations illegal),
        // except 'style' and 'class' properties, since they should *not* allocate host var slots
        var hostVarsCount = Object.keys(hostBindingsMetadata.properties)
            .filter(function (name) {
            var prefix = getStylingPrefix(name);
            return prefix !== 'style' && prefix !== 'class';
        })
            .length;
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
        (bindings || []).forEach(function (binding) {
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
                if (!isAttribute) {
                    if (!sanitizerFn) {
                        // append `null` in front of `nativeOnly` flag if no sanitizer fn defined
                        instructionParams.push(o.literal(null));
                    }
                    // host bindings must have nativeOnly prop set to true
                    instructionParams.push(o.literal(true));
                }
                updateStatements.push.apply(updateStatements, tslib_1.__spread(bindingExpr.stmts));
                if (instruction === r3_identifiers_1.Identifiers.property) {
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
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.property, propertyBindings).toStmt());
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
            // singular style/class bindings (things like `[style.prop]` and `[class.name]`)
            // MUST be registered on a given element within the component/directive
            // templateFn/hostBindingsFn functions. The instruction below will figure out
            // what all the bindings are and then generate the statements required to register
            // those bindings to the element via `styling`.
            var stylingInstruction = styleBuilder.buildStylingInstruction(null, constantPool);
            if (stylingInstruction) {
                createStatements.push(createStylingStmt(stylingInstruction, bindingContext, bindingFn));
            }
            // finally each binding that was registered in the statement above will need to be added to
            // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
            // are evaluated and updated for the element.
            styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(function (instruction) {
                totalHostVarsCount += instruction.allocateBindingSlots;
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
        var params = instruction.buildParams(function (value) { return bindingFn(bindingContext, value).currValExpr; });
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
                instruction = r3_identifiers_1.Identifiers.property;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUF5SztJQUV6SyxpR0FBNkY7SUFFN0YsaURBQW1DO0lBRW5DLDZGQUFrRjtJQUNsRiwyREFBNkM7SUFFN0MsMkRBQTREO0lBQzVELCtEQUEyQztJQUMzQyx1RUFBNkQ7SUFFN0QsbURBQWdEO0lBQ2hELCtEQUFxQztJQUNyQyx1RUFBcUY7SUFDckYsK0VBQW9EO0lBRXBELDJEQUErRztJQUcvRyxzRkFBOEQ7SUFDOUQsd0VBQW9MO0lBQ3BMLGdFQUE0TDtJQUU1TCxJQUFNLFdBQVcsR0FBVSxFQUFFLENBQUM7SUFFOUIsNkZBQTZGO0lBQzdGLHlGQUF5RjtJQUN6RixJQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQztJQUVwQyxTQUFTLGdCQUFnQixDQUFDLElBQVk7UUFDcEMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFFLGlCQUFpQjtJQUNqRCxDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBeUIsRUFBRSxZQUEwQixFQUNyRCxhQUE0QjtRQUM5QixJQUFNLGFBQWEsR0FBRyxJQUFJLG9CQUFhLEVBQUUsQ0FBQztRQUUxQywyQkFBMkI7UUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXJDLDBDQUEwQztRQUMxQyxhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUd2RSwrREFBK0Q7UUFDL0QsSUFBTSxNQUFNLEdBQUcsbUNBQXNCLENBQUM7WUFDcEMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsUUFBUSxFQUFFLDRCQUFFLENBQUMsZUFBZTtTQUM3QixDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFN0MsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDM0IsdURBQXVEO1lBQ3ZELGFBQWEsQ0FBQyxHQUFHLENBQ2IsZ0JBQWdCLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDNUY7UUFFRCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQ2IsV0FBVyxFQUFFLHlCQUF5QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ3hGO1FBRUQsb0RBQW9EO1FBQ3BELGFBQWEsQ0FBQyxHQUFHLENBQ2IsY0FBYyxFQUFFLDBCQUEwQixDQUN0QixJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFDM0QsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFekQseUJBQXlCO1FBQ3pCLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLDBDQUFtQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVwRiwwQkFBMEI7UUFDMUIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsMENBQW1DLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFFaEYsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUMxQixhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBWixDQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbkY7UUFFRCxPQUFPLEVBQUMsYUFBYSxlQUFBLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLFdBQVcsQ0FDaEIsYUFBNEIsRUFBRSxJQUErQztRQUMvRSwwQ0FBMEM7UUFDMUMsSUFBTSxRQUFRLEdBQW1CLEVBQUUsQ0FBQztRQUVwQyxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ2pDLElBQU0sYUFBYSxHQUFJLElBQTRCLENBQUMsYUFBYSxDQUFDO1FBQ2xFLElBQUksU0FBUyxJQUFJLGFBQWEsRUFBRTtZQUM5QixJQUFNLElBQUksR0FBRyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELElBQUksYUFBYSxFQUFFO2dCQUNqQixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2FBQzFCO1lBQ0QsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMvRDtRQUVELElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUN4QixRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7U0FDMUQ7UUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO1lBQ2hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7U0FDeEU7UUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7WUFDbkIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1NBQ3ZEO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsNEJBQTRCLENBQ3hDLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7UUFDeEIsSUFBQSwyREFBb0YsRUFBbkYsZ0NBQWEsRUFBRSwwQkFBb0UsQ0FBQztRQUMzRixXQUFXLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pDLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTNGLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBYSxJQUFJLENBQUMsSUFBSSxxQ0FBa0MsQ0FBQyxDQUFDO1NBQzNFO1FBRUQsSUFBTSxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLDRCQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUM3RCxPQUFPLEVBQUMsVUFBVSxZQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsVUFBVSxZQUFBLEVBQUMsQ0FBQztJQUN4QyxDQUFDO0lBYkQsb0VBYUM7SUFZRDs7O09BR0c7SUFDSCxTQUFnQiwwQkFBMEIsQ0FDdEMsSUFBdUIsRUFBRSxZQUEwQixFQUFFLGFBQTRCO1FBQ25GLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBRSxDQUFDO1FBQzFDLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNmLElBQU0sUUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDM0IsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHO2dCQUMzQyxJQUFNLENBQUMsR0FBRyxRQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3RCLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEVBQUUsSUFBSSxPQUFBLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQWIsQ0FBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekYsT0FBTyxFQUFDLEdBQUcsS0FBQSxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQztZQUNyQyxDQUFDLENBQUMsQ0FBQztZQUNILGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztTQUN0RDtRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixJQUFNLFNBQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQzdCLElBQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRztnQkFDN0MsSUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsT0FBTyxFQUFDLEdBQUcsS0FBQSxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQztZQUNyQyxDQUFDLENBQUMsQ0FBQztZQUNILGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztTQUN4RDtRQUNELElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDbkQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUseUJBQXlCLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1NBQzNGO1FBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMzQyxhQUFhLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLDRCQUE0QixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztTQUMvRjtRQUNELElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtZQUNiLGFBQWEsQ0FBQyxHQUFHLENBQ2IsY0FBYyxFQUNkLDBCQUEwQixDQUN0QixJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUNsRjtRQUVELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RGLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUU1RCxPQUFPLEVBQUMsVUFBVSxZQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUMsQ0FBQztJQUM1QixDQUFDO0lBckNELGdFQXFDQztJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsNEJBQTRCLENBQ3hDLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7O1FBQ3hCLElBQUEsMkRBQW9GLEVBQW5GLGdDQUFhLEVBQUUsMEJBQW9FLENBQUM7UUFDM0YsV0FBVyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVqQyxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLHNCQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuRSxJQUFNLGFBQWEsR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlDLG9DQUFvQztRQUNwQywrRkFBK0Y7UUFDL0YsSUFBSSxhQUFhLEVBQUU7WUFDakIsSUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDcEQsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUU7Z0JBQzdCLGFBQWEsQ0FBQyxHQUFHLENBQ2IsT0FBTyxFQUFFLFlBQVksQ0FBQyxlQUFlLENBQ3hCLENBQUMsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUMvQixVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQXZELENBQXVELENBQUMsQ0FBQztnQkFDdEUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUMzQztTQUNGO1FBRUQsb0RBQW9EO1FBQ3BELElBQUksZ0JBQWdCLEdBQXlCLElBQUksQ0FBQztRQUVsRCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM5QixJQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQzs7Z0JBQ3RDLEtBQXFDLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsVUFBVSxDQUFBLGdCQUFBLDRCQUFFO29CQUEzQyxJQUFBLGFBQXNCLEVBQXJCLHdCQUFRLEVBQUUsNEJBQVU7b0JBQzlCLE9BQU8sQ0FBQyxjQUFjLENBQUMsc0JBQVcsQ0FBQyxLQUFLLENBQUMsVUFBUSxDQUFDLEVBQUUsWUFBVSxDQUFDLENBQUM7aUJBQ2pFOzs7Ozs7Ozs7WUFDRCxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7U0FDNUI7UUFFRCxrRUFBa0U7UUFDbEUsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ25DLElBQU0sWUFBWSxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBSSxnQkFBZ0IsY0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFFOUUsSUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7UUFDL0MsSUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7UUFDMUMsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUU3QyxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQy9CLElBQU0sZUFBZSxHQUFHLElBQUksb0NBQXlCLENBQ2pELFlBQVksRUFBRSx1QkFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQ3BGLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSw0QkFBRSxDQUFDLGFBQWEsRUFDekUsSUFBSSxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRTNELElBQU0sMEJBQTBCLEdBQUcsZUFBZSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFN0YsNkVBQTZFO1FBQzdFLHFGQUFxRjtRQUNyRixJQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ25FLElBQUksa0JBQWtCLEVBQUU7WUFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1NBQzdEO1FBRUQsbUJBQW1CO1FBQ25CLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV4RSxpQkFBaUI7UUFDakIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXBFLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLDBCQUEwQixDQUFDLENBQUM7UUFFMUQsbUNBQW1DO1FBQ25DLElBQUksY0FBYyxDQUFDLElBQUksRUFBRTtZQUN2QixJQUFJLGNBQWMsR0FBaUIsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7WUFDNUUsSUFBSSxJQUFJLENBQUMsK0JBQStCLEVBQUU7Z0JBQ3hDLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDcEU7WUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztTQUNqRDtRQUVELHlCQUF5QjtRQUN6QixJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUU7WUFDbEIsSUFBSSxTQUFTLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2xFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO2dCQUN4QyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzFEO1lBQ0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDdkM7UUFFRCxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSSxFQUFFO1lBQy9CLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQztTQUN0RDtRQUVELDhCQUE4QjtRQUM5QixJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDckMsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3ZFLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLDZCQUFZLEVBQUUsMEJBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELElBQUksQ0FBQyxNQUFNLENBQUM7WUFDaEIsSUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQWQsQ0FBYyxDQUFDLENBQUM7WUFDdkQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ3BEO2FBQU0sSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7WUFDakUsaUVBQWlFO1lBQ2pFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztTQUNsRDtRQUVELDREQUE0RDtRQUM1RCxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtZQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1NBQ25FO1FBRUQseUNBQXlDO1FBQ3pDLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDNUIsYUFBYSxDQUFDLEdBQUcsQ0FDYixNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDeEY7UUFFRCwrRUFBK0U7UUFDL0UsSUFBSSxlQUFlLElBQUksSUFBSSxJQUFJLGVBQWUsS0FBSyxJQUFJLENBQUMsdUJBQXVCLENBQUMsT0FBTyxFQUFFO1lBQ3ZGLGFBQWEsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO1NBQ2xFO1FBRUQsK0ZBQStGO1FBQy9GLDZDQUE2QztRQUM3QyxJQUFNLGVBQWUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqRSxJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzRixJQUFNLElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsNEJBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRTdELE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLFlBQUEsRUFBQyxDQUFDO0lBQ3hDLENBQUM7SUExSEQsb0VBMEhDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsU0FBZ0IsMkJBQTJCLENBQ3ZDLFNBQXdCLEVBQUUsU0FBbUMsRUFBRSxTQUEyQixFQUMxRixhQUE0QjtRQUM5QixJQUFNLElBQUksR0FBRyxpQ0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUcsQ0FBQztRQUM5QyxJQUFJLElBQUksWUFBSyxDQUFDLGlDQUErQixTQUFTLENBQUMsSUFBTSxDQUFDLENBQUM7UUFFL0QsSUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLFlBQVksQ0FBQyxjQUFjLG1CQUEwQixDQUFDO1FBRXhGLElBQU0sSUFBSSxHQUFHLG1DQUFtQyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbEYsSUFBTSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFdEYsK0RBQStEO1FBQy9ELFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FDckMsSUFBSSxFQUFFLElBQUksRUFDVixDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQzdGLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFoQkQsa0VBZ0JDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsU0FBZ0IsMkJBQTJCLENBQ3ZDLFNBQXdCLEVBQUUsU0FBbUMsRUFBRSxVQUE4QixFQUM3RixTQUEyQixFQUFFLGFBQTRCLEVBQUUsa0JBQW9DLEVBQy9GLGNBQWdDO1FBQ2xDLElBQU0sSUFBSSxHQUFHLGlDQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBRyxDQUFDO1FBQzlDLElBQUksSUFBSSxZQUFLLENBQUMsaUNBQStCLFNBQVMsQ0FBQyxJQUFNLENBQUMsQ0FBQztRQUUvRCxJQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLGNBQWMsbUJBQTBCLENBQUM7UUFFeEYsSUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBRXRDLG9FQUFvRTtRQUNwRSxJQUFNLElBQUksd0JBQ0wsbUNBQW1DLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsSUFDdkUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQzVCLFFBQVEsRUFBRSxFQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFDLEVBQ25DLFVBQVUsRUFBRSxFQUFFLEVBQ2QsS0FBSyxFQUFFLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsRUFDeEQsV0FBVyxFQUFFLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLEVBQ3hFLCtCQUErQixFQUFFLEtBQUssRUFDdEMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFdBQVcsRUFDcEUsYUFBYSxFQUNULENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQzNGLGFBQWEsRUFBRSxtREFBNEIsRUFDM0MsVUFBVSxFQUFFLElBQUksRUFDaEIsYUFBYSxFQUNULFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUM5Rix1QkFBdUIsRUFBRSxFQUFFLEVBQzNCLGtCQUFrQixFQUFFLElBQUksR0FDekIsQ0FBQztRQUNGLElBQU0sR0FBRyxHQUFHLDRCQUE0QixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRXRGLCtEQUErRDtRQUMvRCxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3JDLElBQUksRUFBRSxJQUFJLEVBQ1YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUM3RixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBckNELGtFQXFDQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxtQ0FBbUMsQ0FDeEMsU0FBbUMsRUFBRSxTQUF3QixFQUM3RCxTQUEyQjtRQUM3Qiw2RUFBNkU7UUFDN0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLHlCQUF5QixDQUM5QixPQUErQixFQUFFLFNBQXdCO1FBQzNELE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUs7WUFDdEIsSUFBSSxJQUFJLEdBQXNCLElBQUksQ0FBQztZQUNuQyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQ3ZDLElBQUksR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzlEO1lBQ0QsT0FBTztnQkFDTCxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7Z0JBQ2hDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztnQkFDbEIsU0FBUyxFQUFFLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO2dCQUNsRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxJQUFJLE1BQUE7Z0JBQ3BDLE1BQU0sRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU07YUFDdkIsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsMkJBQTJCLENBQ2hDLFNBQWlDLEVBQUUsU0FBd0I7UUFDN0QsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN6RSxJQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQWUsRUFBckIsQ0FBcUIsQ0FBQyxDQUFDO1lBQ3RFLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxDQUFDLEtBQUssRUFBTixDQUFNLENBQUM7Z0JBQ2pDLFlBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1lBQzlELE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQ3pDLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbkU7UUFFRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1lBQ3pCLElBQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUU7Z0JBQ3BCLE9BQU8sU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ3pEO1NBQ0Y7UUFFRCxZQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUMvQixPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDckIsQ0FBQztJQUVELFNBQVMsa0JBQWtCLENBQUMsS0FBc0IsRUFBRSxZQUEwQjtRQUM1RSxJQUFNLFVBQVUsR0FBRztZQUNqQix3QkFBaUIsQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDO1lBQ3RDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztZQUM1QixLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1NBQzlCLENBQUM7UUFDRixPQUFPLFVBQVUsQ0FBQztJQUNwQixDQUFDO0lBRUQsNkVBQTZFO0lBQzdFLFNBQVMsdUJBQXVCLENBQUMsUUFBdUI7UUFDdEQsT0FBTyxnQkFBUyxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRCxTQUFTLDhCQUE4QixDQUFDLFVBQTBDOztRQUVoRixJQUFNLE1BQU0sR0FBbUIsRUFBRSxDQUFDOztZQUNsQyxLQUFnQixJQUFBLEtBQUEsaUJBQUEsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxDQUFBLGdCQUFBLDRCQUFFO2dCQUFuRCxJQUFJLEdBQUcsV0FBQTtnQkFDVixJQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNwQzs7Ozs7Ozs7O1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELHdDQUF3QztJQUN4QyxTQUFTLDRCQUE0QixDQUNqQyxPQUEwQixFQUFFLFlBQTBCLEVBQUUsSUFBYTs7UUFDdkUsSUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO1FBQzNDLElBQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztRQUMzQyxJQUFNLGFBQWEsR0FBRyx5QkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBYyxDQUFDLENBQUM7O1lBRTNFLEtBQW9CLElBQUEsWUFBQSxpQkFBQSxPQUFPLENBQUEsZ0NBQUEscURBQUU7Z0JBQXhCLElBQU0sS0FBSyxvQkFBQTtnQkFDZCx1RUFBdUU7Z0JBQ3ZFLElBQU0sSUFBSSxxQkFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFLLGtCQUFrQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQVEsQ0FBQyxDQUFDO2dCQUV6RixJQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLDRCQUFFLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLDRCQUFFLENBQUMsWUFBWSxDQUFDO2dCQUVoRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUU1RSxzRkFBc0Y7Z0JBQ3RGLElBQU0sU0FBUyxHQUFHLGFBQWEsRUFBRSxDQUFDO2dCQUNsQyxJQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2xFLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEYsSUFBTSxlQUFlLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBWSxDQUFDO3FCQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztxQkFDeEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNwRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2FBQzlEOzs7Ozs7Ozs7UUFFRCxJQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxDQUFDLENBQUksSUFBSSxvQkFBaUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3BFLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUDtZQUNFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQVksRUFBRSxJQUFJLENBQUM7WUFDN0UsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUM7U0FDaEMsRUFDRDtZQUNFLGdDQUFxQixpQkFBMEIsZ0JBQWdCLENBQUM7WUFDaEUsZ0NBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQztTQUNqRSxFQUNELENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELFNBQVMsWUFBWSxDQUFDLEdBQVc7UUFDL0IsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsU0FBUyxlQUFlLENBQUMsR0FBdUM7UUFDOUQsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHO1lBQ3hDLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQy9ELE9BQU87Z0JBQ0wsR0FBRyxLQUFBO2dCQUNILEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztnQkFDdkIsTUFBTSxFQUFFLElBQUk7YUFDYixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxTQUFTLGlCQUFpQixDQUFDLEdBQWE7UUFDdEMsT0FBTyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFoQixDQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxJQUF5QixFQUFFLFFBQTZCO1FBQ2hGLCtGQUErRjtRQUMvRiw2Q0FBNkM7UUFDN0MsSUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakUsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFO1lBQzdDLHlCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1lBQ3JELFlBQVksQ0FBQyxlQUFlLENBQUM7WUFDN0IsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDdkUsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDNUIsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDN0IsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsWUFBWSxFQUFkLENBQWMsQ0FBQyxDQUFDO1NBQ3pELENBQUMsQ0FBQyxDQUFDO0lBQ04sQ0FBQztJQUVELHFDQUFxQztJQUNyQyxTQUFTLHlCQUF5QixDQUM5QixXQUE4QixFQUFFLFlBQTBCLEVBQUUsSUFBYTtRQUMzRSxJQUFNLGdCQUFnQixHQUFrQixFQUFFLENBQUM7UUFDM0MsSUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO1FBQzNDLElBQU0sYUFBYSxHQUFHLHlCQUFrQixDQUFDLGdCQUFnQixFQUFFLHFCQUFjLENBQUMsQ0FBQztRQUUzRSxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBc0I7WUFDekMsSUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyw0QkFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsNEJBQUUsQ0FBQyxTQUFTLENBQUM7WUFFMUUsb0RBQW9EO1lBQ3BELElBQU0sZUFBZSxHQUNqQixDQUFDLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ25GLGdCQUFnQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUVoRCxtRkFBbUY7WUFDbkYsSUFBTSxTQUFTLEdBQUcsYUFBYSxFQUFFLENBQUM7WUFDbEMsSUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMvRCxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEYsSUFBTSxlQUFlLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBWSxDQUFDO2lCQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztpQkFDeEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3BGLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDL0QsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFJLElBQUksV0FBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDdEQsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUNQLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFZLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBWSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQy9FO1lBQ0UsZ0NBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQztZQUNoRSxnQ0FBcUIsaUJBQTBCLGdCQUFnQixDQUFDO1NBQ2pFLEVBQ0QsQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVELGtFQUFrRTtJQUNsRSxTQUFTLDBCQUEwQixDQUMvQixvQkFBb0MsRUFBRSxjQUErQixFQUNyRSxhQUE0QixFQUFFLFlBQTBCLEVBQUUsUUFBZ0IsRUFDMUUsSUFBYTtRQUNmLHdGQUF3RjtRQUN4Rix5RkFBeUY7UUFDekYsSUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUM7YUFDdkMsTUFBTSxDQUFDLFVBQUEsSUFBSTtZQUNWLElBQU0sTUFBTSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RDLE9BQU8sTUFBTSxLQUFLLE9BQU8sSUFBSSxNQUFNLEtBQUssT0FBTyxDQUFDO1FBQ2xELENBQUMsQ0FBQzthQUNELE1BQU0sQ0FBQztRQUNsQyxJQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZDLElBQU0sY0FBYyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsbUJBQVksQ0FBQyxDQUFDO1FBQ2hELElBQU0sWUFBWSxHQUFHLElBQUksZ0NBQWMsQ0FBQyxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFNUQsSUFBQSwyQ0FBK0QsRUFBOUQsd0JBQVMsRUFBRSx3QkFBbUQsQ0FBQztRQUN0RSxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUU7WUFDM0IsWUFBWSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzNDO1FBQ0QsSUFBSSxTQUFTLEtBQUssU0FBUyxFQUFFO1lBQzNCLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUMzQztRQUVELElBQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztRQUMzQyxJQUFNLGdCQUFnQixHQUFrQixFQUFFLENBQUM7UUFFM0MsSUFBSSxrQkFBa0IsR0FBRyxhQUFhLENBQUM7UUFDdkMsSUFBTSxxQkFBcUIsR0FBRyxjQUFjLENBQUM7UUFDN0MsSUFBTSxnQkFBZ0IsR0FBRyxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRWpFLElBQUksY0FBOEIsQ0FBQztRQUNuQyxJQUFNLGlCQUFpQixHQUFHO1lBQ3hCLElBQUksQ0FBQyxjQUFjLEVBQUU7Z0JBQ25CLElBQU0sZUFBZSxHQUFHLFVBQUMsUUFBZ0I7b0JBQ3ZDLElBQU0saUJBQWlCLEdBQUcsa0JBQWtCLENBQUM7b0JBQzdDLGtCQUFrQixJQUFJLFFBQVEsQ0FBQztvQkFDL0IsT0FBTyxpQkFBaUIsQ0FBQztnQkFDM0IsQ0FBQyxDQUFDO2dCQUNGLGNBQWMsR0FBRyxJQUFJLHlCQUFjLENBQy9CLFlBQVksRUFDWixjQUFNLE9BQUEsWUFBSyxDQUFDLGlCQUFpQixDQUFDLEVBQXhCLENBQXdCLEVBQUcsNkJBQTZCO2dCQUM5RCxlQUFlLEVBQ2YsY0FBTSxPQUFBLFlBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUF4QixDQUF3QixDQUFDLENBQUMsQ0FBRSx5QkFBeUI7YUFDaEU7WUFDRCxPQUFPLGNBQWMsQ0FBQztRQUN4QixDQUFDLENBQUM7UUFFRixnQ0FBZ0M7UUFDaEMsSUFBTSxhQUFhLEdBQ2YsYUFBYSxDQUFDLDRCQUE0QixDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDLENBQUM7UUFDeEYsSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN6QyxJQUFNLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDM0QsZ0JBQWdCLENBQUMsSUFBSSxPQUFyQixnQkFBZ0IsbUJBQVMsU0FBUyxHQUFFO1NBQ3JDO1FBRUQsdUNBQXVDO1FBQ3ZDLElBQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyx5QkFBeUIsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2xHLElBQU0sZ0JBQWdCLEdBQXFCLEVBQUUsQ0FBQztRQUM5QyxJQUFNLGlCQUFpQixHQUFxQixFQUFFLENBQUM7UUFDL0MsSUFBTSxxQkFBcUIsR0FBcUIsRUFBRSxDQUFDO1FBRW5ELENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLE9BQXVCO1lBQy9DLElBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDMUIsSUFBTSxrQkFBa0IsR0FDcEIsWUFBWSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUN4RixJQUFJLENBQUMsa0JBQWtCLEVBQUU7Z0JBQ3ZCLDZDQUE2QztnQkFDN0MsSUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO2dCQUM1RCxJQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUUvQyxJQUFBLDBDQUErRSxFQUE5RSw0QkFBVyxFQUFFLDRCQUFXLEVBQUUsNEJBQW9ELENBQUM7Z0JBRXRGLElBQU0sZ0JBQWdCLEdBQ2xCLGFBQWEsQ0FBQyw0QkFBNEIsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztxQkFDekUsTUFBTSxDQUFDLFVBQUEsT0FBTyxJQUFJLE9BQUEsT0FBTyxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFyQyxDQUFxQyxDQUFDLENBQUM7Z0JBRWxFLElBQUksV0FBVyxHQUF3QixJQUFJLENBQUM7Z0JBQzVDLElBQUksZ0JBQWdCLENBQUMsTUFBTSxFQUFFO29CQUMzQixJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxDQUFDO3dCQUM3QixnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ3ZELGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO3dCQUNwRSxxRkFBcUY7d0JBQ3JGLHlGQUF5Rjt3QkFDekYsb0ZBQW9GO3dCQUNwRixrQ0FBa0M7d0JBQ2xDLFdBQVcsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsd0JBQXdCLENBQUMsQ0FBQztxQkFDekQ7eUJBQU07d0JBQ0wsV0FBVyxHQUFHLGdDQUFxQixDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO3FCQUN2RTtpQkFDRjtnQkFDRCxJQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQzVFLElBQUksV0FBVyxFQUFFO29CQUNmLGlCQUFpQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztpQkFDckM7Z0JBQ0QsSUFBSSxDQUFDLFdBQVcsRUFBRTtvQkFDaEIsSUFBSSxDQUFDLFdBQVcsRUFBRTt3QkFDaEIseUVBQXlFO3dCQUN6RSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3FCQUN6QztvQkFDRCxzREFBc0Q7b0JBQ3RELGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQ3pDO2dCQUVELGdCQUFnQixDQUFDLElBQUksT0FBckIsZ0JBQWdCLG1CQUFTLFdBQVcsQ0FBQyxLQUFLLEdBQUU7Z0JBRTVDLElBQUksV0FBVyxLQUFLLDRCQUFFLENBQUMsUUFBUSxFQUFFO29CQUMvQixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztpQkFDMUM7cUJBQU0sSUFBSSxXQUFXLEtBQUssNEJBQUUsQ0FBQyxTQUFTLEVBQUU7b0JBQ3ZDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2lCQUMzQztxQkFBTSxJQUFJLFdBQVcsS0FBSyw0QkFBRSxDQUFDLDBCQUEwQixFQUFFO29CQUN4RCxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztpQkFDL0M7cUJBQU07b0JBQ0wsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztpQkFDckY7YUFDRjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQy9CLGdCQUFnQixDQUFDLElBQUksQ0FBQyx5QkFBa0IsQ0FBQyw0QkFBRSxDQUFDLFFBQVEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7U0FDbkY7UUFFRCxJQUFJLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDaEMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLHlCQUFrQixDQUFDLDRCQUFFLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNyRjtRQUVELElBQUkscUJBQXFCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNwQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQ2pCLHlCQUFrQixDQUFDLDRCQUFFLENBQUMsMEJBQTBCLEVBQUUscUJBQXFCLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQ3hGO1FBRUQsMkVBQTJFO1FBQzNFLDRFQUE0RTtRQUM1RSwrRUFBK0U7UUFDL0UsNEVBQTRFO1FBQzVFLGdGQUFnRjtRQUNoRiw4RUFBOEU7UUFDOUUscUJBQXFCO1FBQ3JCLElBQU0sU0FBUyxHQUFHLDhCQUE4QixDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xGLElBQU0sZUFBZSxHQUFHLFlBQVksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzlGLElBQUksZUFBZSxFQUFFO1lBQ25CLGdCQUFnQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEVBQUUsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDdEY7UUFFRCxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUU7WUFDNUIsZ0ZBQWdGO1lBQ2hGLHVFQUF1RTtZQUN2RSw2RUFBNkU7WUFDN0Usa0ZBQWtGO1lBQ2xGLCtDQUErQztZQUMvQyxJQUFNLGtCQUFrQixHQUFHLFlBQVksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDcEYsSUFBSSxrQkFBa0IsRUFBRTtnQkFDdEIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO2FBQ3pGO1lBRUQsMkZBQTJGO1lBQzNGLDJGQUEyRjtZQUMzRiw2Q0FBNkM7WUFDN0MsWUFBWSxDQUFDLDRCQUE0QixDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxXQUFXO2dCQUNoRixrQkFBa0IsSUFBSSxXQUFXLENBQUMsb0JBQW9CLENBQUM7Z0JBQ3ZELGdCQUFnQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbkYsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELElBQUksa0JBQWtCLEVBQUU7WUFDdEIsZ0JBQWdCLENBQUMsT0FBTyxDQUNwQixDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQ3RGO1FBRUQsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDOUQsSUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFJLElBQUksa0JBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2hFLElBQU0sVUFBVSxHQUFrQixFQUFFLENBQUM7WUFDckMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLGdDQUFxQixpQkFBMEIsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO2FBQ25GO1lBQ0QsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLGdDQUFxQixpQkFBMEIsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO2FBQ25GO1lBQ0QsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUNQO2dCQUNFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQVksRUFBRSxJQUFJLENBQUM7Z0JBQzdFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBTSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUM7YUFDOUMsRUFDRCxVQUFVLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztTQUM1RDtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELFNBQVMsU0FBUyxDQUFDLFFBQWEsRUFBRSxLQUFVO1FBQzFDLE9BQU8sNkNBQXNCLENBQ3pCLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxrQ0FBVyxDQUFDLFNBQVMsRUFBRSxjQUFNLE9BQUEsWUFBSyxDQUFDLDBCQUEwQixDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQztJQUNsRyxDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FDdEIsV0FBd0IsRUFBRSxjQUFtQixFQUFFLFNBQW1CO1FBQ3BFLElBQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxTQUFTLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDLFdBQVcsRUFBNUMsQ0FBNEMsQ0FBQyxDQUFDO1FBQzlGLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDO2FBQ25FLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLFVBQVUsQ0FBQzthQUN0QyxNQUFNLEVBQUUsQ0FBQztJQUNoQixDQUFDO0lBRUQsU0FBUyw0QkFBNEIsQ0FBQyxPQUF1QjtRQUUzRCxJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQy9CLElBQUksV0FBa0MsQ0FBQztRQUV2QyxnRUFBZ0U7UUFDaEUsSUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsRCxJQUFJLFdBQVcsRUFBRTtZQUNmLFdBQVcsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0IsV0FBVyxHQUFHLDRCQUFFLENBQUMsU0FBUyxDQUFDO1NBQzVCO2FBQU07WUFDTCxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUU7Z0JBQ3ZCLFdBQVcsR0FBRyxtQ0FBNEIsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDeEQscUZBQXFGO2dCQUNyRixtRkFBbUY7Z0JBQ25GLHdEQUF3RDtnQkFDeEQsV0FBVyxHQUFHLDRCQUFFLENBQUMsMEJBQTBCLENBQUM7YUFDN0M7aUJBQU07Z0JBQ0wsV0FBVyxHQUFHLDRCQUFFLENBQUMsUUFBUSxDQUFDO2FBQzNCO1NBQ0Y7UUFFRCxPQUFPLEVBQUMsV0FBVyxhQUFBLEVBQUUsV0FBVyxhQUFBLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FBQyxhQUE0QixFQUFFLElBQWE7UUFDdEUsT0FBTyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQUEsT0FBTztZQUM5QixJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLHFDQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuRSxJQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsSUFBSSxzQkFBOEIsQ0FBQyxDQUFDO2dCQUM5RCwyQ0FBb0MsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBQzFFLFdBQVcsQ0FBQztZQUNoQixJQUFNLFdBQVcsR0FBRyxJQUFJLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBSSxJQUFJLFNBQUksYUFBYSx3QkFBcUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQy9GLElBQU0sTUFBTSxHQUFHLHlDQUE4QixDQUFDLG1CQUFVLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQ2hHLElBQU0sV0FBVyxHQUNiLE9BQU8sQ0FBQyxJQUFJLHFCQUE2QixDQUFDLENBQUMsQ0FBQyw0QkFBRSxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQyw0QkFBRSxDQUFDLFFBQVEsQ0FBQztZQUNoRyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzNELENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBb0I7UUFDN0MsbUJBQW1CO1FBQ25CLE9BQU87WUFDTCxnR0FBZ0c7WUFDaEcsaUNBQWlDO1lBQ2pDLGNBQWMsRUFBRSxFQUFFO1lBQ2xCLGFBQWEsRUFBRSxJQUFJLENBQUMsU0FBUztZQUM3QixjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVU7U0FDTCxDQUFDO1FBQzdCLGtCQUFrQjtJQUNwQixDQUFDO0lBR0QsU0FBUyxzQkFBc0IsQ0FDM0IsR0FBOEIsRUFBRSxTQUF3QjtRQUMxRCxpR0FBaUc7UUFDakcsSUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQy9CLFVBQUMsRUFBVztnQkFBWCwwQkFBVyxFQUFWLFdBQUcsRUFBRSxZQUFJO1lBQThCLE9BQUEsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUFqQyxDQUFpQyxDQUFDLENBQUM7UUFDaEYsT0FBTyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQsSUFBTSxZQUFZLEdBQUcscUNBQXFDLENBQUM7SUFtQjNELFNBQWdCLGlCQUFpQixDQUFDLElBQTRDOztRQUU1RSxJQUFNLFVBQVUsR0FBa0MsRUFBRSxDQUFDO1FBQ3JELElBQU0sU0FBUyxHQUE0QixFQUFFLENBQUM7UUFDOUMsSUFBTSxVQUFVLEdBQTRCLEVBQUUsQ0FBQztRQUMvQyxJQUFNLGlCQUFpQixHQUE4QyxFQUFFLENBQUM7O1lBRXhFLEtBQWtCLElBQUEsS0FBQSxpQkFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLGdCQUFBLDRCQUFFO2dCQUFoQyxJQUFNLEdBQUcsV0FBQTtnQkFDWixJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3hCLElBQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBRXhDLElBQUksT0FBTyxLQUFLLElBQUksRUFBRTtvQkFDcEIsUUFBUSxHQUFHLEVBQUU7d0JBQ1gsS0FBSyxPQUFPOzRCQUNWLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO2dDQUM3Qix3Q0FBd0M7Z0NBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQzs2QkFDakQ7NEJBQ0QsaUJBQWlCLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQzs0QkFDcEMsTUFBTTt3QkFDUixLQUFLLE9BQU87NEJBQ1YsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7Z0NBQzdCLHdDQUF3QztnQ0FDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDOzZCQUNqRDs0QkFDRCxpQkFBaUIsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDOzRCQUNwQyxNQUFNO3dCQUNSOzRCQUNFLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO2dDQUM3QixVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQzs2QkFDcEM7aUNBQU07Z0NBQ0wsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQzs2QkFDekI7cUJBQ0o7aUJBQ0Y7cUJBQU0sSUFBSSxPQUFPLGlCQUEwQixJQUFJLElBQUksRUFBRTtvQkFDcEQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7d0JBQzdCLHdDQUF3Qzt3QkFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO3FCQUNwRDtvQkFDRCw4REFBOEQ7b0JBQzlELDhEQUE4RDtvQkFDOUQsdURBQXVEO29CQUN2RCxVQUFVLENBQUMsT0FBTyxpQkFBMEIsQ0FBQyxHQUFHLEtBQUssQ0FBQztpQkFDdkQ7cUJBQU0sSUFBSSxPQUFPLGVBQXdCLElBQUksSUFBSSxFQUFFO29CQUNsRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTt3QkFDN0Isd0NBQXdDO3dCQUN4QyxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7cUJBQ2pEO29CQUNELFNBQVMsQ0FBQyxPQUFPLGVBQXdCLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQ3BEO2FBQ0Y7Ozs7Ozs7OztRQUVELE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxTQUFTLFdBQUEsRUFBRSxVQUFVLFlBQUEsRUFBRSxpQkFBaUIsbUJBQUEsRUFBQyxDQUFDO0lBQ2hFLENBQUM7SUFyREQsOENBcURDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILFNBQWdCLGtCQUFrQixDQUM5QixRQUE0QixFQUFFLFVBQTJCO1FBQzNELElBQU0sT0FBTyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVDLDRFQUE0RTtRQUM1RSxnRUFBZ0U7UUFDaEUsSUFBTSxhQUFhLEdBQUcsNEJBQWlCLEVBQUUsQ0FBQztRQUMxQyxhQUFhLENBQUMsNEJBQTRCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2hFLGFBQWEsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDN0QsT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDO0lBQzlCLENBQUM7SUFURCxnREFTQztJQUVELFNBQVMsYUFBYSxDQUFDLE1BQWdCLEVBQUUsUUFBZ0IsRUFBRSxZQUFvQjtRQUM3RSxJQUFNLFNBQVMsR0FBRyxJQUFJLHNCQUFTLEVBQUUsQ0FBQztRQUNsQyxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQU0sT0FBTyxTQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgdHlwZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Qm91bmRFdmVudH0gZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNDb21wb25lbnREZWYsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlRGVmLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0luc3RydWN0aW9uLCBTdHlsaW5nQnVpbGRlcn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyLCBtYWtlQmluZGluZ1BhcnNlciwgcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXQsIHJlc29sdmVTYW5pdGl6YXRpb25Gbn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgRGVmaW5pdGlvbk1hcCwgUkVOREVSX0ZMQUdTLCBURU1QT1JBUllfTkFNRSwgYXNMaXRlcmFsLCBjaGFpbmVkSW5zdHJ1Y3Rpb24sIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBnZXRRdWVyeVByZWRpY2F0ZSwgdGVtcG9yYXJ5QWxsb2NhdG9yfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9BUlJBWTogYW55W10gPSBbXTtcblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cbmZ1bmN0aW9uIGdldFN0eWxpbmdQcmVmaXgobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKDAsIDUpOyAgLy8gc3R5bGUgb3IgY2xhc3Ncbn1cblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge2RlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W119IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKG1ldGEuc2VsZWN0b3IpKTtcblxuXG4gIC8vIGUuZy4gYGZhY3Rvcnk6ICgpID0+IG5ldyBNeUFwcChkaXJlY3RpdmVJbmplY3QoRWxlbWVudFJlZikpYFxuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LFxuICB9KTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZmFjdG9yeSk7XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gZS5nLiBgY29udGVudFF1ZXJpZXM6IChyZiwgY3R4LCBkaXJJbmRleCkgPT4geyAuLi4gfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY29udGVudFF1ZXJpZXMnLCBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKG1ldGEucXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAndmlld1F1ZXJ5JywgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLnZpZXdRdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgLy8gZS5nLiBgaG9zdEJpbmRpbmdzOiAocmYsIGN0eCwgZWxJbmRleCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLCBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YS5ob3N0LCBtZXRhLnR5cGVTb3VyY2VTcGFuLCBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGEuc2VsZWN0b3IgfHwgJycsIG1ldGEubmFtZSkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG5cbiAgLy8gZS5nICdvdXRwdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIG8ubGl0ZXJhbEFycihtZXRhLmV4cG9ydEFzLm1hcChlID0+IG8ubGl0ZXJhbChlKSkpKTtcbiAgfVxuXG4gIHJldHVybiB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50czogcmVzdWx0LnN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEFkZCBmZWF0dXJlcyB0byB0aGUgZGVmaW5pdGlvbiBtYXAuXG4gKi9cbmZ1bmN0aW9uIGFkZEZlYXR1cmVzKFxuICAgIGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgfCBSM0NvbXBvbmVudE1ldGFkYXRhKSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlKCldYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGEpLnZpZXdQcm92aWRlcnM7XG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpLmNhbGxGbihFTVBUWV9BUlJBWSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNEaXJlY3RpdmVEZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgaWYgKCFtZXRhLnNlbGVjdG9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBEaXJlY3RpdmUgJHttZXRhLm5hbWV9IGhhcyBubyBzZWxlY3RvciwgcGxlYXNlIGFkZCBpdCFgKTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkRpcmVjdGl2ZURlZldpdGhNZXRhKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0Jhc2VSZWZNZXRhRGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgaW5wdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IFtzdHJpbmcsIHN0cmluZ119O1xuICBvdXRwdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHZpZXdRdWVyaWVzPzogUjNRdWVyeU1ldGFkYXRhW107XG4gIHF1ZXJpZXM/OiBSM1F1ZXJ5TWV0YWRhdGFbXTtcbiAgaG9zdD86IFIzSG9zdE1ldGFkYXRhO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBiYXNlIGRlZmluaXRpb24gZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB7QGxpbmsgUjNCYXNlUmVmTWV0YWRhdGF9XG4gKiBAcGFyYW0gbWV0YSB0aGUgbWV0YWRhdGEgdXNlZCBmb3IgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQmFzZURlZkZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0Jhc2VSZWZNZXRhRGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGlmIChtZXRhLmlucHV0cykge1xuICAgIGNvbnN0IGlucHV0cyA9IG1ldGEuaW5wdXRzO1xuICAgIGNvbnN0IGlucHV0c01hcCA9IE9iamVjdC5rZXlzKGlucHV0cykubWFwKGtleSA9PiB7XG4gICAgICBjb25zdCB2ID0gaW5wdXRzW2tleV07XG4gICAgICBjb25zdCB2YWx1ZSA9IEFycmF5LmlzQXJyYXkodikgPyBvLmxpdGVyYWxBcnIodi5tYXAodnggPT4gby5saXRlcmFsKHZ4KSkpIDogby5saXRlcmFsKHYpO1xuICAgICAgcmV0dXJuIHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfTtcbiAgICB9KTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgby5saXRlcmFsTWFwKGlucHV0c01hcCkpO1xuICB9XG4gIGlmIChtZXRhLm91dHB1dHMpIHtcbiAgICBjb25zdCBvdXRwdXRzID0gbWV0YS5vdXRwdXRzO1xuICAgIGNvbnN0IG91dHB1dHNNYXAgPSBPYmplY3Qua2V5cyhvdXRwdXRzKS5tYXAoa2V5ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gby5saXRlcmFsKG91dHB1dHNba2V5XSk7XG4gICAgICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xuICAgIH0pO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgby5saXRlcmFsTWFwKG91dHB1dHNNYXApKTtcbiAgfVxuICBpZiAobWV0YS52aWV3UXVlcmllcyAmJiBtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJ5JywgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLnZpZXdRdWVyaWVzLCBjb25zdGFudFBvb2wpKTtcbiAgfVxuICBpZiAobWV0YS5xdWVyaWVzICYmIG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLnF1ZXJpZXMsIGNvbnN0YW50UG9vbCkpO1xuICB9XG4gIGlmIChtZXRhLmhvc3QpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2hvc3RCaW5kaW5ncycsXG4gICAgICAgIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgICAgbWV0YS5ob3N0LCBtZXRhLnR5cGVTb3VyY2VTcGFuLCBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVCYXNlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5CYXNlRGVmKSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgY29tcG9uZW50IGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0NvbXBvbmVudE1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzQ29tcG9uZW50RGVmIHtcbiAgY29uc3Qge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHN9ID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcblxuICBjb25zdCBzZWxlY3RvciA9IG1ldGEuc2VsZWN0b3IgJiYgQ3NzU2VsZWN0b3IucGFyc2UobWV0YS5zZWxlY3Rvcik7XG4gIGNvbnN0IGZpcnN0U2VsZWN0b3IgPSBzZWxlY3RvciAmJiBzZWxlY3RvclswXTtcblxuICAvLyBlLmcuIGBhdHRyOiBbXCJjbGFzc1wiLCBcIi5teS5hcHBcIl1gXG4gIC8vIFRoaXMgaXMgb3B0aW9uYWwgYW4gb25seSBpbmNsdWRlZCBpZiB0aGUgZmlyc3Qgc2VsZWN0b3Igb2YgYSBjb21wb25lbnQgc3BlY2lmaWVzIGF0dHJpYnV0ZXMuXG4gIGlmIChmaXJzdFNlbGVjdG9yKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JBdHRyaWJ1dGVzID0gZmlyc3RTZWxlY3Rvci5nZXRBdHRycygpO1xuICAgIGlmIChzZWxlY3RvckF0dHJpYnV0ZXMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgICAnYXR0cnMnLCBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JBdHRyaWJ1dGVzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0+IHZhbHVlICE9IG51bGwgPyBvLmxpdGVyYWwodmFsdWUpIDogby5saXRlcmFsKHVuZGVmaW5lZCkpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgLyogZm9yY2VTaGFyZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEdlbmVyYXRlIHRoZSBDU1MgbWF0Y2hlciB0aGF0IHJlY29nbml6ZSBkaXJlY3RpdmVcbiAgbGV0IGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsID0gbnVsbDtcblxuICBpZiAobWV0YS5kaXJlY3RpdmVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcigpO1xuICAgIGZvciAoY29uc3Qge3NlbGVjdG9yLCBleHByZXNzaW9ufSBvZiBtZXRhLmRpcmVjdGl2ZXMpIHtcbiAgICAgIG1hdGNoZXIuYWRkU2VsZWN0YWJsZXMoQ3NzU2VsZWN0b3IucGFyc2Uoc2VsZWN0b3IpLCBleHByZXNzaW9uKTtcbiAgICB9XG4gICAgZGlyZWN0aXZlTWF0Y2hlciA9IG1hdGNoZXI7XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgZGlyZWN0aXZlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgcGlwZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IGNoYW5nZURldGVjdGlvbiA9IG1ldGEuY2hhbmdlRGV0ZWN0aW9uO1xuXG4gIGNvbnN0IHRlbXBsYXRlID0gbWV0YS50ZW1wbGF0ZTtcbiAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICBjb25zdGFudFBvb2wsIEJpbmRpbmdTY29wZS5ST09UX1NDT1BFLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICBkaXJlY3RpdmVNYXRjaGVyLCBkaXJlY3RpdmVzVXNlZCwgbWV0YS5waXBlcywgcGlwZXNVc2VkLCBSMy5uYW1lc3BhY2VIVE1MLFxuICAgICAgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMpO1xuXG4gIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5ub2RlcywgW10pO1xuXG4gIC8vIFdlIG5lZWQgdG8gcHJvdmlkZSB0aGlzIHNvIHRoYXQgZHluYW1pY2FsbHkgZ2VuZXJhdGVkIGNvbXBvbmVudHMga25vdyB3aGF0XG4gIC8vIHByb2plY3RlZCBjb250ZW50IGJsb2NrcyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIGNvbXBvbmVudCB3aGVuIGl0IGlzIGluc3RhbnRpYXRlZC5cbiAgY29uc3QgbmdDb250ZW50U2VsZWN0b3JzID0gdGVtcGxhdGVCdWlsZGVyLmdldE5nQ29udGVudFNlbGVjdG9ycygpO1xuICBpZiAobmdDb250ZW50U2VsZWN0b3JzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIG5nQ29udGVudFNlbGVjdG9ycyk7XG4gIH1cblxuICAvLyBlLmcuIGBjb25zdHM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYHZhcnM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24pO1xuXG4gIC8vIGUuZy4gYGRpcmVjdGl2ZXM6IFtNeURpcmVjdGl2ZV1gXG4gIGlmIChkaXJlY3RpdmVzVXNlZC5zaXplKSB7XG4gICAgbGV0IGRpcmVjdGl2ZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShkaXJlY3RpdmVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIGRpcmVjdGl2ZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChkaXJlY3RpdmVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RpcmVjdGl2ZXMnLCBkaXJlY3RpdmVzRXhwcik7XG4gIH1cblxuICAvLyBlLmcuIGBwaXBlczogW015UGlwZV1gXG4gIGlmIChwaXBlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBwaXBlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKHBpcGVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIHBpcGVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocGlwZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBwaXBlc0V4cHIpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHJpbmdzID0gc3R5bGVWYWx1ZXMubWFwKHN0ciA9PiBvLmxpdGVyYWwoc3RyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHJpbmdzKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gc3R5bGUsIGRvbid0IGdlbmVyYXRlIGNzcyBzZWxlY3RvcnMgb24gZWxlbWVudHNcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLk5vbmU7XG4gIH1cblxuICAvLyBPbmx5IHNldCB2aWV3IGVuY2Fwc3VsYXRpb24gaWYgaXQncyBub3QgdGhlIGRlZmF1bHQgdmFsdWVcbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdlbmNhcHN1bGF0aW9uJywgby5saXRlcmFsKG1ldGEuZW5jYXBzdWxhdGlvbikpO1xuICB9XG5cbiAgLy8gZS5nLiBgYW5pbWF0aW9uOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbicsIHZhbHVlOiBtZXRhLmFuaW1hdGlvbnMsIHF1b3RlZDogZmFsc2V9XSkpO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdGhlIGNoYW5nZSBkZXRlY3Rpb24gZmxhZyBpZiBpdCdzIGRlZmluZWQgYW5kIGl0J3Mgbm90IHRoZSBkZWZhdWx0LlxuICBpZiAoY2hhbmdlRGV0ZWN0aW9uICE9IG51bGwgJiYgY2hhbmdlRGV0ZWN0aW9uICE9PSBjb3JlLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKGNoYW5nZURldGVjdGlvbikpO1xuICB9XG5cbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IChtZXRhLnNlbGVjdG9yIHx8ICcnKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lQ29tcG9uZW50KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuQ29tcG9uZW50RGVmV2l0aE1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50c307XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZURpcmVjdGl2ZWAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtkaXJlY3RpdmUudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkRpcmVjdGl2ZSk7XG5cbiAgY29uc3QgbWV0YSA9IGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGRpcmVjdGl2ZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpO1xuICBjb25zdCByZXMgPSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlQ29tcG9uZW50YCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzQ29tcG9uZW50TWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZW5kZXIzQXN0OiBSZW5kZXIzUGFyc2VSZXN1bHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBkaXJlY3RpdmVUeXBlQnlTZWw6IE1hcDxzdHJpbmcsIGFueT4sXG4gICAgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIGFueT4pIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGNvbXBvbmVudC50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtjb21wb25lbnQudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkNvbXBvbmVudCk7XG5cbiAgY29uc3Qgc3VtbWFyeSA9IGNvbXBvbmVudC50b1N1bW1hcnkoKTtcblxuICAvLyBDb21wdXRlIHRoZSBSM0NvbXBvbmVudE1ldGFkYXRhIGZyb20gdGhlIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YVxuICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhID0ge1xuICAgIC4uLmRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudCwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHNlbGVjdG9yOiBjb21wb25lbnQuc2VsZWN0b3IsXG4gICAgdGVtcGxhdGU6IHtub2RlczogcmVuZGVyM0FzdC5ub2Rlc30sXG4gICAgZGlyZWN0aXZlczogW10sXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgIHN0eWxlczogKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5zdHlsZXMpIHx8IEVNUFRZX0FSUkFZLFxuICAgIGVuY2Fwc3VsYXRpb246XG4gICAgICAgIChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuZW5jYXBzdWxhdGlvbikgfHwgY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgIGFuaW1hdGlvbnM6IG51bGwsXG4gICAgdmlld1Byb3ZpZGVyczpcbiAgICAgICAgY29tcG9uZW50LnZpZXdQcm92aWRlcnMubGVuZ3RoID4gMCA/IG5ldyBvLldyYXBwZWROb2RlRXhwcihjb21wb25lbnQudmlld1Byb3ZpZGVycykgOiBudWxsLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEobWV0YSwgb3V0cHV0Q3R4LmNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG5cbiAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWFsIGNsYXNzIHRvIGJlIG1lcmdlZCB3aXRoIHRoZSBhY3R1YWwgY2xhc3MuXG4gIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2gobmV3IG8uQ2xhc3NTdG10KFxuICAgICAgbmFtZSwgbnVsbCxcbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKGRlZmluaXRpb25GaWVsZCwgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgcmVzLmV4cHJlc3Npb24pXSxcbiAgICAgIFtdLCBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSkpO1xufVxuXG4vKipcbiAqIENvbXB1dGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGdpdmVuIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBhIGBDb21waWxlUmVmbGVjdG9yYC5cbiAqL1xuZnVuY3Rpb24gZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgLy8gVGhlIGdsb2JhbC1hbmFseXNpcyBiYXNlZCBJdnkgbW9kZSBpbiBuZ2MgaXMgbm8gbG9uZ2VyIHV0aWxpemVkL3N1cHBvcnRlZC5cbiAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCcpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbXBpbGVRdWVyeU1ldGFkYXRhYCBpbnRvIGBSM1F1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHF1ZXJpZXM6IENvbXBpbGVRdWVyeU1ldGFkYXRhW10sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IFIzUXVlcnlNZXRhZGF0YVtdIHtcbiAgcmV0dXJuIHF1ZXJpZXMubWFwKHF1ZXJ5ID0+IHtcbiAgICBsZXQgcmVhZDogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGlmIChxdWVyeS5yZWFkICYmIHF1ZXJ5LnJlYWQuaWRlbnRpZmllcikge1xuICAgICAgcmVhZCA9IG91dHB1dEN0eC5pbXBvcnRFeHByKHF1ZXJ5LnJlYWQuaWRlbnRpZmllci5yZWZlcmVuY2UpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcHJvcGVydHlOYW1lOiBxdWVyeS5wcm9wZXJ0eU5hbWUsXG4gICAgICBmaXJzdDogcXVlcnkuZmlyc3QsXG4gICAgICBwcmVkaWNhdGU6IHNlbGVjdG9yc0Zyb21HbG9iYWxNZXRhZGF0YShxdWVyeS5zZWxlY3RvcnMsIG91dHB1dEN0eCksXG4gICAgICBkZXNjZW5kYW50czogcXVlcnkuZGVzY2VuZGFudHMsIHJlYWQsXG4gICAgICBzdGF0aWM6ICEhcXVlcnkuc3RhdGljXG4gICAgfTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVRva2VuTWV0YWRhdGFgIGZvciBxdWVyeSBzZWxlY3RvcnMgaW50byBlaXRoZXIgYW4gZXhwcmVzc2lvbiBmb3IgYSBwcmVkaWNhdGVcbiAqIHR5cGUsIG9yIGEgbGlzdCBvZiBzdHJpbmcgcHJlZGljYXRlcy5cbiAqL1xuZnVuY3Rpb24gc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHNlbGVjdG9yczogQ29tcGlsZVRva2VuTWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogby5FeHByZXNzaW9ufHN0cmluZ1tdIHtcbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPiAxIHx8IChzZWxlY3RvcnMubGVuZ3RoID09IDEgJiYgc2VsZWN0b3JzWzBdLnZhbHVlKSkge1xuICAgIGNvbnN0IHNlbGVjdG9yU3RyaW5ncyA9IHNlbGVjdG9ycy5tYXAodmFsdWUgPT4gdmFsdWUudmFsdWUgYXMgc3RyaW5nKTtcbiAgICBzZWxlY3RvclN0cmluZ3Muc29tZSh2YWx1ZSA9PiAhdmFsdWUpICYmXG4gICAgICAgIGVycm9yKCdGb3VuZCBhIHR5cGUgYW1vbmcgdGhlIHN0cmluZyBzZWxlY3RvcnMgZXhwZWN0ZWQnKTtcbiAgICByZXR1cm4gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvclN0cmluZ3MubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSk7XG4gIH1cblxuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA9PSAxKSB7XG4gICAgY29uc3QgZmlyc3QgPSBzZWxlY3RvcnNbMF07XG4gICAgaWYgKGZpcnN0LmlkZW50aWZpZXIpIHtcbiAgICAgIHJldHVybiBvdXRwdXRDdHguaW1wb3J0RXhwcihmaXJzdC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICB9XG5cbiAgZXJyb3IoJ1VuZXhwZWN0ZWQgcXVlcnkgZm9ybScpO1xuICByZXR1cm4gby5OVUxMX0VYUFI7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgcGFyYW1ldGVycyA9IFtcbiAgICBnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgY29uc3RhbnRQb29sKSxcbiAgICBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMpLFxuICAgIHF1ZXJ5LnJlYWQgfHwgby5saXRlcmFsKG51bGwpLFxuICBdO1xuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuLy8gVHVybiBhIGRpcmVjdGl2ZSBzZWxlY3RvciBpbnRvIGFuIFIzLWNvbXBhdGlibGUgc2VsZWN0b3IgZm9yIGRpcmVjdGl2ZSBkZWZcbmZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKHNlbGVjdG9yOiBzdHJpbmcgfCBudWxsKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGFzTGl0ZXJhbChjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3Ioc2VsZWN0b3IpKTtcbn1cblxuZnVuY3Rpb24gY29udmVydEF0dHJpYnV0ZXNUb0V4cHJlc3Npb25zKGF0dHJpYnV0ZXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSk6XG4gICAgby5FeHByZXNzaW9uW10ge1xuICBjb25zdCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGZvciAobGV0IGtleSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKSkge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1trZXldO1xuICAgIHZhbHVlcy5wdXNoKG8ubGl0ZXJhbChrZXkpLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlcztcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IGNvbnRlbnQgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihcbiAgICBxdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIG5hbWU/OiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdGVtcEFsbG9jYXRvciA9IHRlbXBvcmFyeUFsbG9jYXRvcih1cGRhdGVTdGF0ZW1lbnRzLCBURU1QT1JBUllfTkFNRSk7XG5cbiAgZm9yIChjb25zdCBxdWVyeSBvZiBxdWVyaWVzKSB7XG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMuY29udGVudFF1ZXJ5KGRpckluZGV4LCBzb21lUHJlZGljYXRlLCB0cnVlLCBudWxsKTtcbiAgICBjb25zdCBhcmdzID0gW28udmFyaWFibGUoJ2RpckluZGV4JyksIC4uLnByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSBhcyBhbnldO1xuXG4gICAgY29uc3QgcXVlcnlJbnN0cnVjdGlvbiA9IHF1ZXJ5LnN0YXRpYyA/IFIzLnN0YXRpY0NvbnRlbnRRdWVyeSA6IFIzLmNvbnRlbnRRdWVyeTtcblxuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIocXVlcnlJbnN0cnVjdGlvbikuY2FsbEZuKGFyZ3MpLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRDb250ZW50UXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkQ29udGVudFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9XG5cbiAgY29uc3QgY29udGVudFF1ZXJpZXNGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG51bGwpXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBjb250ZW50UXVlcmllc0ZuTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNUeXBlKG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdfSk6IG8uVHlwZSB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxNYXAobWFwVmFsdWVzKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogc3RyaW5nW10pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVHlwZUZvckRlZihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCB0eXBlQmFzZTogby5FeHRlcm5hbFJlZmVyZW5jZSk6IG8uVHlwZSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIodHlwZUJhc2UsIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5leHBvcnRBcykgOiBvLk5PTkVfVFlQRSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5pbnB1dHMpLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLm91dHB1dHMpLFxuICAgIHN0cmluZ0FycmF5QXNUeXBlKG1ldGEucXVlcmllcy5tYXAocSA9PiBxLnByb3BlcnR5TmFtZSkpLFxuICBdKSk7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24oXG4gICAgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICB2aWV3UXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhKSA9PiB7XG4gICAgY29uc3QgcXVlcnlJbnN0cnVjdGlvbiA9IHF1ZXJ5LnN0YXRpYyA/IFIzLnN0YXRpY1ZpZXdRdWVyeSA6IFIzLnZpZXdRdWVyeTtcblxuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLnZpZXdRdWVyeShzb21lUHJlZGljYXRlLCB0cnVlKTtcbiAgICBjb25zdCBxdWVyeURlZmluaXRpb24gPVxuICAgICAgICBvLmltcG9ydEV4cHIocXVlcnlJbnN0cnVjdGlvbikuY2FsbEZuKHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKHF1ZXJ5RGVmaW5pdGlvbi50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkVmlld1F1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFZpZXdRdWVyeSkuY2FsbEZuKFtdKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfSk7XG5cbiAgY29uc3Qgdmlld1F1ZXJ5Rm5OYW1lID0gbmFtZSA/IGAke25hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBob3N0QmluZGluZ3NNZXRhZGF0YTogUjNIb3N0TWV0YWRhdGEsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHNlbGVjdG9yOiBzdHJpbmcsXG4gICAgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgLy8gSW5pdGlhbGl6ZSBob3N0VmFyc0NvdW50IHRvIG51bWJlciBvZiBib3VuZCBob3N0IHByb3BlcnRpZXMgKGludGVycG9sYXRpb25zIGlsbGVnYWwpLFxuICAvLyBleGNlcHQgJ3N0eWxlJyBhbmQgJ2NsYXNzJyBwcm9wZXJ0aWVzLCBzaW5jZSB0aGV5IHNob3VsZCAqbm90KiBhbGxvY2F0ZSBob3N0IHZhciBzbG90c1xuICBjb25zdCBob3N0VmFyc0NvdW50ID0gT2JqZWN0LmtleXMoaG9zdEJpbmRpbmdzTWV0YWRhdGEucHJvcGVydGllcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKG5hbWUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gZ2V0U3R5bGluZ1ByZWZpeChuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVmaXggIT09ICdzdHlsZScgJiYgcHJlZml4ICE9PSAnY2xhc3MnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmxlbmd0aDtcbiAgY29uc3QgZWxWYXJFeHAgPSBvLnZhcmlhYmxlKCdlbEluZGV4Jyk7XG4gIGNvbnN0IGJpbmRpbmdDb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICBjb25zdCBzdHlsZUJ1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIoZWxWYXJFeHAsIGJpbmRpbmdDb250ZXh0KTtcblxuICBjb25zdCB7c3R5bGVBdHRyLCBjbGFzc0F0dHJ9ID0gaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXM7XG4gIGlmIChzdHlsZUF0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cihzdHlsZUF0dHIpO1xuICB9XG4gIGlmIChjbGFzc0F0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cihjbGFzc0F0dHIpO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgbGV0IHRvdGFsSG9zdFZhcnNDb3VudCA9IGhvc3RWYXJzQ291bnQ7XG4gIGNvbnN0IGhvc3RCaW5kaW5nU291cmNlU3BhbiA9IHR5cGVTb3VyY2VTcGFuO1xuICBjb25zdCBkaXJlY3RpdmVTdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkoaG9zdEJpbmRpbmdzTWV0YWRhdGEpO1xuXG4gIGxldCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIGNvbnN0IGdldFZhbHVlQ29udmVydGVyID0gKCkgPT4ge1xuICAgIGlmICghdmFsdWVDb252ZXJ0ZXIpIHtcbiAgICAgIGNvbnN0IGhvc3RWYXJzQ291bnRGbiA9IChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxWYXJzQ291bnQgPSB0b3RhbEhvc3RWYXJzQ291bnQ7XG4gICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBudW1TbG90cztcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsVmFyc0NvdW50O1xuICAgICAgfTtcbiAgICAgIHZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICAgIGNvbnN0YW50UG9vbCxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBub2RlJyksICAvLyBuZXcgbm9kZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgICAgICAgIGhvc3RWYXJzQ291bnRGbixcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBwaXBlJykpOyAgLy8gcGlwZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVDb252ZXJ0ZXI7XG4gIH07XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgaWYgKGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGgpIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBjcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3MsIG5hbWUpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaCguLi5saXN0ZW5lcnMpO1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmdzXG4gIGNvbnN0IGJpbmRpbmdzID0gYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgYXR0cmlidXRlQmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljSG9zdEJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG5cbiAgKGJpbmRpbmdzIHx8IFtdKS5mb3JFYWNoKChiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBiaW5kaW5nLm5hbWU7XG4gICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID1cbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgaWYgKCFzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgIC8vIHJlc29sdmUgbGl0ZXJhbCBhcnJheXMgYW5kIGxpdGVyYWwgb2JqZWN0c1xuICAgICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLmV4cHJlc3Npb24udmlzaXQoZ2V0VmFsdWVDb252ZXJ0ZXIoKSk7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUpO1xuXG4gICAgICBjb25zdCB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZX0gPSBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmcpO1xuXG4gICAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgICBiaW5kaW5nUGFyc2VyLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3IsIGJpbmRpbmdOYW1lLCBpc0F0dHJpYnV0ZSlcbiAgICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IGNvcmUuU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuXG4gICAgICBsZXQgc2FuaXRpemVyRm46IG8uRXh0ZXJuYWxFeHByfG51bGwgPSBudWxsO1xuICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCA9PT0gMiAmJlxuICAgICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTCkgPiAtMSAmJlxuICAgICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCkgPiAtMSkge1xuICAgICAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3Igc29tZSBVUkwgYXR0cmlidXRlcyAoc3VjaCBhcyBcInNyY1wiIGFuZCBcImhyZWZcIikgdGhhdCBtYXkgYmUgYSBwYXJ0XG4gICAgICAgICAgLy8gb2YgZGlmZmVyZW50IHNlY3VyaXR5IGNvbnRleHRzLiBJbiB0aGlzIGNhc2Ugd2UgdXNlIHNwZWNpYWwgc2FudGl0aXphdGlvbiBmdW5jdGlvbiBhbmRcbiAgICAgICAgICAvLyBzZWxlY3QgdGhlIGFjdHVhbCBzYW5pdGl6ZXIgYXQgcnVudGltZSBiYXNlZCBvbiBhIHRhZyBuYW1lIHRoYXQgaXMgcHJvdmlkZWQgd2hpbGVcbiAgICAgICAgICAvLyBpbnZva2luZyBzYW5pdGl6YXRpb24gZnVuY3Rpb24uXG4gICAgICAgICAgc2FuaXRpemVyRm4gPSBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmxPclJlc291cmNlVXJsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzYW5pdGl6ZXJGbiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihzZWN1cml0eUNvbnRleHRzWzBdLCBpc0F0dHJpYnV0ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IGluc3RydWN0aW9uUGFyYW1zID0gW28ubGl0ZXJhbChiaW5kaW5nTmFtZSksIGJpbmRpbmdFeHByLmN1cnJWYWxFeHByXTtcbiAgICAgIGlmIChzYW5pdGl6ZXJGbikge1xuICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKHNhbml0aXplckZuKTtcbiAgICAgIH1cbiAgICAgIGlmICghaXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgaWYgKCFzYW5pdGl6ZXJGbikge1xuICAgICAgICAgIC8vIGFwcGVuZCBgbnVsbGAgaW4gZnJvbnQgb2YgYG5hdGl2ZU9ubHlgIGZsYWcgaWYgbm8gc2FuaXRpemVyIGZuIGRlZmluZWRcbiAgICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKG8ubGl0ZXJhbChudWxsKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaG9zdCBiaW5kaW5ncyBtdXN0IGhhdmUgbmF0aXZlT25seSBwcm9wIHNldCB0byB0cnVlXG4gICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goby5saXRlcmFsKHRydWUpKTtcbiAgICAgIH1cblxuICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcblxuICAgICAgaWYgKGluc3RydWN0aW9uID09PSBSMy5wcm9wZXJ0eSkge1xuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuYXR0cmlidXRlKSB7XG4gICAgICAgIGF0dHJpYnV0ZUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMudXBkYXRlU3ludGhldGljSG9zdEJpbmRpbmcpIHtcbiAgICAgICAgc3ludGhldGljSG9zdEJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKGluc3RydWN0aW9uUGFyYW1zKS50b1N0bXQoKSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5ncykudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKGF0dHJpYnV0ZUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goY2hhaW5lZEluc3RydWN0aW9uKFIzLmF0dHJpYnV0ZSwgYXR0cmlidXRlQmluZGluZ3MpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChzeW50aGV0aWNIb3N0QmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgY2hhaW5lZEluc3RydWN0aW9uKFIzLnVwZGF0ZVN5bnRoZXRpY0hvc3RCaW5kaW5nLCBzeW50aGV0aWNIb3N0QmluZGluZ3MpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIC8vIHNpbmNlIHdlJ3JlIGRlYWxpbmcgd2l0aCBkaXJlY3RpdmVzL2NvbXBvbmVudHMgYW5kIGJvdGggaGF2ZSBob3N0QmluZGluZ1xuICAvLyBmdW5jdGlvbnMsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgYSBzcGVjaWFsIGhvc3RBdHRycyBpbnN0cnVjdGlvbiB0aGF0IGRlYWxzXG4gIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgLy8gZWxlbWVudC4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgaW5zdHJ1Y3QgYWxsIGluaXRpYWwgc3R5bGluZyAoc3R5bGluZ1xuICAvLyB0aGF0IGlzIGluc2lkZSBvZiBhIGhvc3QgYmluZGluZyB3aXRoaW4gYSBkaXJlY3RpdmUvY29tcG9uZW50KSB0byBiZSBhdHRhY2hlZFxuICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgLy8gY29sbGVjdGVkIGVhcmxpZXIuXG4gIGNvbnN0IGhvc3RBdHRycyA9IGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzKTtcbiAgY29uc3QgaG9zdEluc3RydWN0aW9uID0gc3R5bGVCdWlsZGVyLmJ1aWxkSG9zdEF0dHJzSW5zdHJ1Y3Rpb24obnVsbCwgaG9zdEF0dHJzLCBjb25zdGFudFBvb2wpO1xuICBpZiAoaG9zdEluc3RydWN0aW9uKSB7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKGNyZWF0ZVN0eWxpbmdTdG10KGhvc3RJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICB9XG5cbiAgaWYgKHN0eWxlQnVpbGRlci5oYXNCaW5kaW5ncykge1xuICAgIC8vIHNpbmd1bGFyIHN0eWxlL2NsYXNzIGJpbmRpbmdzICh0aGluZ3MgbGlrZSBgW3N0eWxlLnByb3BdYCBhbmQgYFtjbGFzcy5uYW1lXWApXG4gICAgLy8gTVVTVCBiZSByZWdpc3RlcmVkIG9uIGEgZ2l2ZW4gZWxlbWVudCB3aXRoaW4gdGhlIGNvbXBvbmVudC9kaXJlY3RpdmVcbiAgICAvLyB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIGZ1bmN0aW9ucy4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgZmlndXJlIG91dFxuICAgIC8vIHdoYXQgYWxsIHRoZSBiaW5kaW5ncyBhcmUgYW5kIHRoZW4gZ2VuZXJhdGUgdGhlIHN0YXRlbWVudHMgcmVxdWlyZWQgdG8gcmVnaXN0ZXJcbiAgICAvLyB0aG9zZSBiaW5kaW5ncyB0byB0aGUgZWxlbWVudCB2aWEgYHN0eWxpbmdgLlxuICAgIGNvbnN0IHN0eWxpbmdJbnN0cnVjdGlvbiA9IHN0eWxlQnVpbGRlci5idWlsZFN0eWxpbmdJbnN0cnVjdGlvbihudWxsLCBjb25zdGFudFBvb2wpO1xuICAgIGlmIChzdHlsaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdHlsaW5nU3RtdChzdHlsaW5nSW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICB9XG5cbiAgICAvLyBmaW5hbGx5IGVhY2ggYmluZGluZyB0aGF0IHdhcyByZWdpc3RlcmVkIGluIHRoZSBzdGF0ZW1lbnQgYWJvdmUgd2lsbCBuZWVkIHRvIGJlIGFkZGVkIHRvXG4gICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgIC8vIGFyZSBldmFsdWF0ZWQgYW5kIHVwZGF0ZWQgZm9yIHRoZSBlbGVtZW50LlxuICAgIHN0eWxlQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKGdldFZhbHVlQ29udmVydGVyKCkpLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IGluc3RydWN0aW9uLmFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNyZWF0ZVN0eWxpbmdTdG10KGluc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dCwgYmluZGluZ0ZuKSk7XG4gICAgfSk7XG4gIH1cblxuICBpZiAodG90YWxIb3N0VmFyc0NvdW50KSB7XG4gICAgY3JlYXRlU3RhdGVtZW50cy51bnNoaWZ0KFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuYWxsb2NIb3N0VmFycykuY2FsbEZuKFtvLmxpdGVyYWwodG90YWxIb3N0VmFyc0NvdW50KV0pLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgfHwgdXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdzRm5OYW1lID0gbmFtZSA/IGAke25hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsO1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSk7XG4gICAgfVxuICAgIGlmICh1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKSxcbiAgICAgICAgICBuZXcgby5GblBhcmFtKGVsVmFyRXhwLm5hbWUgISwgby5OVU1CRVJfVFlQRSlcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBob3N0QmluZGluZ3NGbk5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdGbihpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNUKSB7XG4gIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgbnVsbCwgaW1wbGljaXQsIHZhbHVlLCAnYicsIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSwgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3R5bGluZ1N0bXQoXG4gICAgaW5zdHJ1Y3Rpb246IEluc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKTogby5TdGF0ZW1lbnQge1xuICBjb25zdCBwYXJhbXMgPSBpbnN0cnVjdGlvbi5idWlsZFBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBudWxsLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLmNhbGxGbihwYXJhbXMsIGluc3RydWN0aW9uLnNvdXJjZVNwYW4pXG4gICAgICAudG9TdG10KCk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24gITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5hdHRyaWJ1dGU7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGJpbmRpbmcuaXNBbmltYXRpb24pIHtcbiAgICAgIGJpbmRpbmdOYW1lID0gcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShiaW5kaW5nTmFtZSk7XG4gICAgICAvLyBob3N0IGJpbmRpbmdzIHRoYXQgaGF2ZSBhIHN5bnRoZXRpYyBwcm9wZXJ0eSAoZS5nLiBAZm9vKSBzaG91bGQgYWx3YXlzIGJlIHJlbmRlcmVkXG4gICAgICAvLyBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcG9uZW50IGFuZCBub3QgdGhlIHBhcmVudC4gVGhlcmVmb3JlIHRoZXJlIGlzIGEgc3BlY2lhbFxuICAgICAgLy8gY29tcGF0aWJpbGl0eSBpbnN0cnVjdGlvbiBhdmFpbGFibGUgZm9yIHRoaXMgcHVycG9zZS5cbiAgICAgIGluc3RydWN0aW9uID0gUjMudXBkYXRlU3ludGhldGljSG9zdEJpbmRpbmc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc3RydWN0aW9uID0gUjMucHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlOiAhIWF0dHJNYXRjaGVzfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzOiBQYXJzZWRFdmVudFtdLCBuYW1lPzogc3RyaW5nKTogby5TdGF0ZW1lbnRbXSB7XG4gIHJldHVybiBldmVudEJpbmRpbmdzLm1hcChiaW5kaW5nID0+IHtcbiAgICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IGJpbmRpbmcudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShiaW5kaW5nTmFtZSwgYmluZGluZy50YXJnZXRPclBoYXNlKSA6XG4gICAgICAgIGJpbmRpbmdOYW1lO1xuICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gbmFtZSAmJiBiaW5kaW5nTmFtZSA/IGAke25hbWV9XyR7YmluZGluZ0ZuTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgcGFyYW1zID0gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKEJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGJpbmRpbmcpLCBoYW5kbGVyTmFtZSk7XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb24gPVxuICAgICAgICBiaW5kaW5nLnR5cGUgPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IFIzLmNvbXBvbmVudEhvc3RTeW50aGV0aWNMaXN0ZW5lciA6IFIzLmxpc3RlbmVyO1xuICAgIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihwYXJhbXMpLnRvU3RtdCgpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gbWV0YWRhdGFBc1N1bW1hcnkobWV0YTogUjNIb3N0TWV0YWRhdGEpOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSB7XG4gIC8vIGNsYW5nLWZvcm1hdCBvZmZcbiAgcmV0dXJuIHtcbiAgICAvLyBUaGlzIGlzIHVzZWQgYnkgdGhlIEJpbmRpbmdQYXJzZXIsIHdoaWNoIG9ubHkgZGVhbHMgd2l0aCBsaXN0ZW5lcnMgYW5kIHByb3BlcnRpZXMuIFRoZXJlJ3Mgbm9cbiAgICAvLyBuZWVkIHRvIHBhc3MgYXR0cmlidXRlcyB0byBpdC5cbiAgICBob3N0QXR0cmlidXRlczoge30sXG4gICAgaG9zdExpc3RlbmVyczogbWV0YS5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEucHJvcGVydGllcyxcbiAgfSBhcyBDb21waWxlRGlyZWN0aXZlU3VtbWFyeTtcbiAgLy8gY2xhbmctZm9ybWF0IG9uXG59XG5cblxuZnVuY3Rpb24gdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChcbiAgICBtYXA6IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4ge1xuICAvLyBDb252ZXJ0IGVhY2ggbWFwIGVudHJ5IGludG8gYW5vdGhlciBlbnRyeSB3aGVyZSB0aGUgdmFsdWUgaXMgYW4gZXhwcmVzc2lvbiBpbXBvcnRpbmcgdGhlIHR5cGUuXG4gIGNvbnN0IGVudHJpZXMgPSBBcnJheS5mcm9tKG1hcCkubWFwKFxuICAgICAgKFtrZXksIHR5cGVdKTogW3N0cmluZywgby5FeHByZXNzaW9uXSA9PiBba2V5LCBvdXRwdXRDdHguaW1wb3J0RXhwcih0eXBlKV0pO1xuICByZXR1cm4gbmV3IE1hcChlbnRyaWVzKTtcbn1cblxuY29uc3QgSE9TVF9SRUdfRVhQID0gL14oPzpcXFsoW15cXF1dKylcXF0pfCg/OlxcKChbXlxcKV0rKVxcKSkkLztcbi8vIFJlcHJlc2VudHMgdGhlIGdyb3VwcyBpbiB0aGUgYWJvdmUgcmVnZXguXG5jb25zdCBlbnVtIEhvc3RCaW5kaW5nR3JvdXAge1xuICAvLyBncm91cCAxOiBcInByb3BcIiBmcm9tIFwiW3Byb3BdXCIsIG9yIFwiYXR0ci5yb2xlXCIgZnJvbSBcIlthdHRyLnJvbGVdXCIsIG9yIEBhbmltIGZyb20gW0BhbmltXVxuICBCaW5kaW5nID0gMSxcblxuICAvLyBncm91cCAyOiBcImV2ZW50XCIgZnJvbSBcIihldmVudClcIlxuICBFdmVudCA9IDIsXG59XG5cbi8vIERlZmluZXMgSG9zdCBCaW5kaW5ncyBzdHJ1Y3R1cmUgdGhhdCBjb250YWlucyBhdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIGFuZCBwcm9wZXJ0aWVzLFxuLy8gcGFyc2VkIGZyb20gdGhlIGBob3N0YCBvYmplY3QgZGVmaW5lZCBmb3IgYSBUeXBlLlxuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufTtcbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdEJpbmRpbmdzKGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBvLkV4cHJlc3Npb259KTpcbiAgICBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICBjb25zdCBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICBjb25zdCBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fSA9IHt9O1xuXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGhvc3QpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBob3N0W2tleV07XG4gICAgY29uc3QgbWF0Y2hlcyA9IGtleS5tYXRjaChIT1NUX1JFR19FWFApO1xuXG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDbGFzcyBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzdHlsZSc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3R5bGUgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgYXR0cmlidXRlc1trZXldID0gby5saXRlcmFsKHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICAvLyBzeW50aGV0aWMgcHJvcGVydGllcyAodGhlIG9uZXMgdGhhdCBoYXZlIGEgYEBgIGFzIGEgcHJlZml4KVxuICAgICAgLy8gYXJlIHN0aWxsIHRyZWF0ZWQgdGhlIHNhbWUgYXMgcmVndWxhciBwcm9wZXJ0aWVzLiBUaGVyZWZvcmVcbiAgICAgIC8vIHRoZXJlIGlzIG5vIHBvaW50IGluIHN0b3JpbmcgdGhlbSBpbiBhIHNlcGFyYXRlIG1hcC5cbiAgICAgIHByb3BlcnRpZXNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgbGlzdGVuZXJzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF1dID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHthdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIHByb3BlcnRpZXMsIHNwZWNpYWxBdHRyaWJ1dGVzfTtcbn1cblxuLyoqXG4gKiBWZXJpZmllcyBob3N0IGJpbmRpbmdzIGFuZCByZXR1cm5zIHRoZSBsaXN0IG9mIGVycm9ycyAoaWYgYW55KS4gRW1wdHkgYXJyYXkgaW5kaWNhdGVzIHRoYXQgYVxuICogZ2l2ZW4gc2V0IG9mIGhvc3QgYmluZGluZ3MgaGFzIG5vIGVycm9ycy5cbiAqXG4gKiBAcGFyYW0gYmluZGluZ3Mgc2V0IG9mIGhvc3QgYmluZGluZ3MgdG8gdmVyaWZ5LlxuICogQHBhcmFtIHNvdXJjZVNwYW4gc291cmNlIHNwYW4gd2hlcmUgaG9zdCBiaW5kaW5ncyB3ZXJlIGRlZmluZWQuXG4gKiBAcmV0dXJucyBhcnJheSBvZiBlcnJvcnMgYXNzb2NpYXRlZCB3aXRoIGEgZ2l2ZW4gc2V0IG9mIGhvc3QgYmluZGluZ3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlIb3N0QmluZGluZ3MoXG4gICAgYmluZGluZ3M6IFBhcnNlZEhvc3RCaW5kaW5ncywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3Qgc3VtbWFyeSA9IG1ldGFkYXRhQXNTdW1tYXJ5KGJpbmRpbmdzKTtcbiAgLy8gVE9ETzogYWJzdHJhY3Qgb3V0IGhvc3QgYmluZGluZ3MgdmVyaWZpY2F0aW9uIGxvZ2ljIGFuZCB1c2UgaXQgaW5zdGVhZCBvZlxuICAvLyBjcmVhdGluZyBldmVudHMgYW5kIHByb3BlcnRpZXMgQVNUcyB0byBkZXRlY3QgZXJyb3JzIChGVy05OTYpXG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoc3VtbWFyeSwgc291cmNlU3Bhbik7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhzdW1tYXJ5LCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGJpbmRpbmdQYXJzZXIuZXJyb3JzO1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHsgcmV0dXJuIHNoYWRvd0NzcyAhLnNoaW1Dc3NUZXh0KHN0eWxlLCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTsgfSk7XG59XG4iXX0=