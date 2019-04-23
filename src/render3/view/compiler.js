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
            definitionMap.set('contentQueries', createContentQueriesFunction(meta, constantPool));
        }
        if (meta.viewQueries.length) {
            definitionMap.set('viewQuery', createViewQueriesFunction(meta, constantPool));
        }
        // Initialize hostVarsCount to number of bound host properties (interpolations illegal),
        // except 'style' and 'class' properties, since they should *not* allocate host var slots
        var hostVarsCount = Object.keys(meta.host.properties)
            .filter(function (name) {
            var prefix = getStylingPrefix(name);
            return prefix !== 'style' && prefix !== 'class';
        })
            .length;
        var elVarExp = o.variable('elIndex');
        var contextVarExp = o.variable(util_3.CONTEXT_NAME);
        var styleBuilder = new styling_builder_1.StylingBuilder(elVarExp, contextVarExp);
        var _a = meta.host.specialAttributes, styleAttr = _a.styleAttr, classAttr = _a.classAttr;
        if (styleAttr !== undefined) {
            styleBuilder.registerStyleAttr(styleAttr);
        }
        if (classAttr !== undefined) {
            styleBuilder.registerClassAttr(classAttr);
        }
        // e.g. `hostBindings: (rf, ctx, elIndex) => { ... }
        definitionMap.set('hostBindings', createHostBindingsFunction(meta, elVarExp, contextVarExp, meta.host.attributes, styleBuilder, bindingParser, constantPool, hostVarsCount));
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
    function compileBaseDefFromMetadata(meta) {
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
    function createContentQueriesFunction(meta, constantPool) {
        var e_3, _a;
        var createStatements = [];
        var updateStatements = [];
        var tempAllocator = util_3.temporaryAllocator(updateStatements, util_3.TEMPORARY_NAME);
        try {
            for (var _b = tslib_1.__values(meta.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var query = _c.value;
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
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        var contentQueriesFnName = meta.name ? meta.name + "_ContentQueries" : null;
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
    function createViewQueriesFunction(meta, constantPool) {
        var createStatements = [];
        var updateStatements = [];
        var tempAllocator = util_3.temporaryAllocator(updateStatements, util_3.TEMPORARY_NAME);
        meta.viewQueries.forEach(function (query) {
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
        var viewQueryFnName = meta.name ? meta.name + "_Query" : null;
        return o.fn([new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null)], [
            template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements),
            template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements)
        ], o.INFERRED_TYPE, null, viewQueryFnName);
    }
    // Return a host binding function or null if one is not necessary.
    function createHostBindingsFunction(meta, elVarExp, bindingContext, staticAttributesAndValues, styleBuilder, bindingParser, constantPool, hostVarsCount) {
        var createStatements = [];
        var updateStatements = [];
        var totalHostVarsCount = hostVarsCount;
        var hostBindingSourceSpan = meta.typeSourceSpan;
        var directiveSummary = metadataAsSummary(meta);
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
            var listeners = createHostListeners(bindingContext, eventBindings, meta);
            createStatements.push.apply(createStatements, tslib_1.__spread(listeners));
        }
        // Calculate the host property bindings
        var bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
        (bindings || []).forEach(function (binding) {
            var name = binding.name;
            var stylingInputWasSet = styleBuilder.registerInputBasedOnName(name, binding.expression, binding.sourceSpan);
            if (!stylingInputWasSet) {
                // resolve literal arrays and literal objects
                var value = binding.expression.visit(getValueConverter());
                var bindingExpr = bindingFn(bindingContext, value);
                var _a = getBindingNameAndInstruction(binding), bindingName = _a.bindingName, instruction = _a.instruction, isAttribute = _a.isAttribute;
                var securityContexts = bindingParser.calcPossibleSecurityContexts(meta.selector || '', bindingName, isAttribute)
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
                var isPropertyInstruction = instruction === r3_identifiers_1.Identifiers.property;
                var instructionParams = isPropertyInstruction ?
                    [
                        o.literal(bindingName),
                        bindingExpr.currValExpr,
                    ] :
                    [
                        elVarExp,
                        o.literal(bindingName),
                        o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([bindingExpr.currValExpr]),
                    ];
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
                updateStatements.push(o.importExpr(instruction).callFn(instructionParams).toStmt());
            }
        });
        // since we're dealing with directives/components and both have hostBinding
        // functions, we need to generate a special hostAttrs instruction that deals
        // with both the assignment of styling as well as static attributes to the host
        // element. The instruction below will instruct all initial styling (styling
        // that is inside of a host binding within a directive/component) to be attached
        // to the host element alongside any of the provided host attributes that were
        // collected earlier.
        var hostAttrs = convertAttributesToExpressions(staticAttributesAndValues);
        var hostInstruction = styleBuilder.buildHostAttrsInstruction(null, hostAttrs, constantPool);
        if (hostInstruction) {
            createStatements.push(createStylingStmt(hostInstruction, bindingContext, bindingFn));
        }
        if (styleBuilder.hasBindings) {
            // singular style/class bindings (things like `[style.prop]` and `[class.name]`)
            // MUST be registered on a given element within the component/directive
            // templateFn/hostBindingsFn functions. The instruction below will figure out
            // what all the bindings are and then generate the statements required to register
            // those bindings to the element via `elementStyling`.
            var elementStylingInstruction = styleBuilder.buildElementStylingInstruction(null, constantPool);
            if (elementStylingInstruction) {
                createStatements.push(createStylingStmt(elementStylingInstruction, bindingContext, bindingFn));
            }
            // finally each binding that was registered in the statement above will need to be added to
            // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
            // are evaluated and updated for the element.
            styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(function (instruction) {
                updateStatements.push(createStylingStmt(instruction, bindingContext, bindingFn));
            });
        }
        if (totalHostVarsCount) {
            createStatements.unshift(o.importExpr(r3_identifiers_1.Identifiers.allocHostVars).callFn([o.literal(totalHostVarsCount)]).toStmt());
        }
        if (createStatements.length > 0 || updateStatements.length > 0) {
            var hostBindingsFnName = meta.name ? meta.name + "_HostBindings" : null;
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
            instruction = r3_identifiers_1.Identifiers.elementAttribute;
        }
        else {
            if (binding.isAnimation) {
                bindingName = util_2.prepareSyntheticPropertyName(bindingName);
                // host bindings that have a synthetic property (e.g. @foo) should always be rendered
                // in the context of the component and not the parent. Therefore there is a special
                // compatibility instruction available for this purpose.
                instruction = r3_identifiers_1.Identifiers.componentHostSyntheticProperty;
            }
            else {
                instruction = r3_identifiers_1.Identifiers.property;
            }
        }
        return { bindingName: bindingName, instruction: instruction, isAttribute: !!attrMatches };
    }
    function createHostListeners(bindingContext, eventBindings, meta) {
        return eventBindings.map(function (binding) {
            var bindingName = binding.name && compile_metadata_1.sanitizeIdentifier(binding.name);
            var bindingFnName = binding.type === 1 /* Animation */ ?
                util_2.prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
                bindingName;
            var handlerName = meta.name && bindingName ? meta.name + "_" + bindingFnName + "_HostBindingHandler" : null;
            var params = template_1.prepareEventListenerParameters(r3_ast_1.BoundEvent.fromParsedEvent(binding), bindingContext, handlerName);
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
            hostListeners: meta.host.listeners,
            hostProperties: meta.host.properties,
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
        var summary = metadataAsSummary({ host: bindings });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUF5SztJQUV6SyxpR0FBNkY7SUFFN0YsaURBQW1DO0lBR25DLDZGQUFrRjtJQUNsRiwyREFBNkM7SUFFN0MsMkRBQTREO0lBQzVELCtEQUEyQztJQUMzQyx1RUFBNkQ7SUFFN0QsbURBQWdEO0lBQ2hELCtEQUFxQztJQUNyQyx1RUFBcUY7SUFDckYsK0VBQW9EO0lBRXBELDJEQUErRztJQUcvRyxzRkFBOEQ7SUFDOUQsd0VBQW9MO0lBQ3BMLGdFQUF3SztJQUV4SyxJQUFNLFdBQVcsR0FBVSxFQUFFLENBQUM7SUFFOUIsNkZBQTZGO0lBQzdGLHlGQUF5RjtJQUN6RixJQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQztJQUVwQyxTQUFTLGdCQUFnQixDQUFDLElBQVk7UUFDcEMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFFLGlCQUFpQjtJQUNqRCxDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBeUIsRUFBRSxZQUEwQixFQUNyRCxhQUE0QjtRQUM5QixJQUFNLGFBQWEsR0FBRyxJQUFJLG9CQUFhLEVBQUUsQ0FBQztRQUUxQywyQkFBMkI7UUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXJDLDBDQUEwQztRQUMxQyxhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUd2RSwrREFBK0Q7UUFDL0QsSUFBTSxNQUFNLEdBQUcsbUNBQXNCLENBQUM7WUFDcEMs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LENBQUM7SUFDakcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uLy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZVF1ZXJ5TWV0YWRhdGEsIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZSwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbCwgRGVmaW5pdGlvbktpbmR9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGlmZWN5Y2xlSG9va3N9IGZyb20gJy4uLy4uL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgdHlwZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Qm91bmRFdmVudH0gZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNDb21wb25lbnREZWYsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlRGVmLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7SW5zdHJ1Y3Rpb24sIFN0eWxpbmdCdWlsZGVyfSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge0JpbmRpbmdTY29wZSwgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgVmFsdWVDb252ZXJ0ZXIsIG1ha2VCaW5kaW5nUGFyc2VyLCBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMsIHJlbmRlckZsYWdDaGVja0lmU3RtdCwgcmVzb2x2ZVNhbml0aXphdGlvbkZufSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBEZWZpbml0aW9uTWFwLCBSRU5ERVJfRkxBR1MsIFRFTVBPUkFSWV9OQU1FLCBhc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBnZXRRdWVyeVByZWRpY2F0ZSwgdGVtcG9yYXJ5QWxsb2NhdG9yfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9BUlJBWTogYW55W10gPSBbXTtcblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cbmZ1bmN0aW9uIGdldFN0eWxpbmdQcmVmaXgobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5hbWUuc3Vic3RyaW5nKDAsIDUpOyAgLy8gc3R5bGUgb3IgY2xhc3Ncbn1cblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge2RlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W119IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKG1ldGEuc2VsZWN0b3IpKTtcblxuXG4gIC8vIGUuZy4gYGZhY3Rvcnk6ICgpID0+IG5ldyBNeUFwcChkaXJlY3RpdmVJbmplY3QoRWxlbWVudFJlZikpYFxuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LFxuICB9KTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZmFjdG9yeSk7XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gZS5nLiBgY29udGVudFF1ZXJpZXM6IChyZiwgY3R4LCBkaXJJbmRleCkgPT4geyAuLi4gfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb250ZW50UXVlcmllcycsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG4gIH1cblxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJ5JywgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcbiAgfVxuXG4gIC8vIEluaXRpYWxpemUgaG9zdFZhcnNDb3VudCB0byBudW1iZXIgb2YgYm91bmQgaG9zdCBwcm9wZXJ0aWVzIChpbnRlcnBvbGF0aW9ucyBpbGxlZ2FsKSxcbiAgLy8gZXhjZXB0ICdzdHlsZScgYW5kICdjbGFzcycgcHJvcGVydGllcywgc2luY2UgdGhleSBzaG91bGQgKm5vdCogYWxsb2NhdGUgaG9zdCB2YXIgc2xvdHNcbiAgY29uc3QgaG9zdFZhcnNDb3VudCA9IE9iamVjdC5rZXlzKG1ldGEuaG9zdC5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIobmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBnZXRTdHlsaW5nUHJlZml4KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWZpeCAhPT0gJ3N0eWxlJyAmJiBwcmVmaXggIT09ICdjbGFzcyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubGVuZ3RoO1xuXG4gIGNvbnN0IGVsVmFyRXhwID0gby52YXJpYWJsZSgnZWxJbmRleCcpO1xuICBjb25zdCBjb250ZXh0VmFyRXhwID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICBjb25zdCBzdHlsZUJ1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIoZWxWYXJFeHAsIGNvbnRleHRWYXJFeHApO1xuXG4gIGNvbnN0IHtzdHlsZUF0dHIsIGNsYXNzQXR0cn0gPSBtZXRhLmhvc3Quc3BlY2lhbEF0dHJpYnV0ZXM7XG4gIGlmIChzdHlsZUF0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cihzdHlsZUF0dHIpO1xuICB9XG4gIGlmIChjbGFzc0F0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cihjbGFzc0F0dHIpO1xuICB9XG5cbiAgLy8gZS5nLiBgaG9zdEJpbmRpbmdzOiAocmYsIGN0eCwgZWxJbmRleCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLCBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YSwgZWxWYXJFeHAsIGNvbnRleHRWYXJFeHAsIG1ldGEuaG9zdC5hdHRyaWJ1dGVzLCBzdHlsZUJ1aWxkZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCwgaG9zdFZhcnNDb3VudCkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG5cbiAgLy8gZS5nICdvdXRwdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIG8ubGl0ZXJhbEFycihtZXRhLmV4cG9ydEFzLm1hcChlID0+IG8ubGl0ZXJhbChlKSkpKTtcbiAgfVxuXG4gIHJldHVybiB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50czogcmVzdWx0LnN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEFkZCBmZWF0dXJlcyB0byB0aGUgZGVmaW5pdGlvbiBtYXAuXG4gKi9cbmZ1bmN0aW9uIGFkZEZlYXR1cmVzKFxuICAgIGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgfCBSM0NvbXBvbmVudE1ldGFkYXRhKSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlKCldYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGEpLnZpZXdQcm92aWRlcnM7XG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpLmNhbGxGbihFTVBUWV9BUlJBWSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNEaXJlY3RpdmVEZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgaWYgKCFtZXRhLnNlbGVjdG9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBEaXJlY3RpdmUgJHttZXRhLm5hbWV9IGhhcyBubyBzZWxlY3RvciwgcGxlYXNlIGFkZCBpdCFgKTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkRpcmVjdGl2ZURlZldpdGhNZXRhKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0Jhc2VSZWZNZXRhRGF0YSB7XG4gIGlucHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBbc3RyaW5nLCBzdHJpbmddfTtcbiAgb3V0cHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBiYXNlIGRlZmluaXRpb24gZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB7QGxpbmsgUjNCYXNlUmVmTWV0YWRhdGF9XG4gKiBAcGFyYW0gbWV0YSB0aGUgbWV0YWRhdGEgdXNlZCBmb3IgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQmFzZURlZkZyb21NZXRhZGF0YShtZXRhOiBSM0Jhc2VSZWZNZXRhRGF0YSkge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcbiAgaWYgKG1ldGEuaW5wdXRzKSB7XG4gICAgY29uc3QgaW5wdXRzID0gbWV0YS5pbnB1dHM7XG4gICAgY29uc3QgaW5wdXRzTWFwID0gT2JqZWN0LmtleXMoaW5wdXRzKS5tYXAoa2V5ID0+IHtcbiAgICAgIGNvbnN0IHYgPSBpbnB1dHNba2V5XTtcbiAgICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheSh2KSA/IG8ubGl0ZXJhbEFycih2Lm1hcCh2eCA9PiBvLmxpdGVyYWwodngpKSkgOiBvLmxpdGVyYWwodik7XG4gICAgICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xuICAgIH0pO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBvLmxpdGVyYWxNYXAoaW5wdXRzTWFwKSk7XG4gIH1cbiAgaWYgKG1ldGEub3V0cHV0cykge1xuICAgIGNvbnN0IG91dHB1dHMgPSBtZXRhLm91dHB1dHM7XG4gICAgY29uc3Qgb3V0cHV0c01hcCA9IE9iamVjdC5rZXlzKG91dHB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBvLmxpdGVyYWwob3V0cHV0c1trZXldKTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBvLmxpdGVyYWxNYXAob3V0cHV0c01hcCkpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVCYXNlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkJhc2VEZWYpKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21wb25lbnREZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvckF0dHJpYnV0ZXMubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gdmFsdWUgIT0gbnVsbCA/IG8ubGl0ZXJhbCh2YWx1ZSkgOiBvLmxpdGVyYWwodW5kZWZpbmVkKSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAvKiBmb3JjZVNoYXJlZCAqLyB0cnVlKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIENTUyBtYXRjaGVyIHRoYXQgcmVjb2duaXplIGRpcmVjdGl2ZVxuICBsZXQgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwgPSBudWxsO1xuXG4gIGlmIChtZXRhLmRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgZm9yIChjb25zdCB7c2VsZWN0b3IsIGV4cHJlc3Npb259IG9mIG1ldGEuZGlyZWN0aXZlcykge1xuICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvciksIGV4cHJlc3Npb24pO1xuICAgIH1cbiAgICBkaXJlY3RpdmVNYXRjaGVyID0gbWF0Y2hlcjtcbiAgfVxuXG4gIC8vIGUuZy4gYHRlbXBsYXRlOiBmdW5jdGlvbiBNeUNvbXBvbmVudF9UZW1wbGF0ZShfY3R4LCBfY20pIHsuLi59YFxuICBjb25zdCB0ZW1wbGF0ZVR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZVR5cGVOYW1lID8gYCR7dGVtcGxhdGVUeXBlTmFtZX1fVGVtcGxhdGVgIDogbnVsbDtcblxuICBjb25zdCBkaXJlY3RpdmVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBwaXBlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgY2hhbmdlRGV0ZWN0aW9uID0gbWV0YS5jaGFuZ2VEZXRlY3Rpb247XG5cbiAgY29uc3QgdGVtcGxhdGUgPSBtZXRhLnRlbXBsYXRlO1xuICBjb25zdCB0ZW1wbGF0ZUJ1aWxkZXIgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLlJPT1RfU0NPUEUsIDAsIHRlbXBsYXRlVHlwZU5hbWUsIG51bGwsIG51bGwsIHRlbXBsYXRlTmFtZSxcbiAgICAgIGRpcmVjdGl2ZU1hdGNoZXIsIGRpcmVjdGl2ZXNVc2VkLCBtZXRhLnBpcGVzLCBwaXBlc1VzZWQsIFIzLm5hbWVzcGFjZUhUTUwsXG4gICAgICBtZXRhLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBtZXRhLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgLy8gV2UgbmVlZCB0byBwcm92aWRlIHRoaXMgc28gdGhhdCBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY29tcG9uZW50cyBrbm93IHdoYXRcbiAgLy8gcHJvamVjdGVkIGNvbnRlbnQgYmxvY2tzIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgY29tcG9uZW50IHdoZW4gaXQgaXMgaW5zdGFudGlhdGVkLlxuICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk7XG4gIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnbmdDb250ZW50U2VsZWN0b3JzJywgbmdDb250ZW50U2VsZWN0b3JzKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGNvbnN0czogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgLy8gZS5nLiBgdmFyczogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG5cbiAgLy8gZS5nLiBgZGlyZWN0aXZlczogW015RGlyZWN0aXZlXWBcbiAgaWYgKGRpcmVjdGl2ZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgZGlyZWN0aXZlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKGRpcmVjdGl2ZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgZGlyZWN0aXZlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGRpcmVjdGl2ZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGlyZWN0aXZlcycsIGRpcmVjdGl2ZXNFeHByKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHBpcGVzOiBbTXlQaXBlXWBcbiAgaWYgKHBpcGVzVXNlZC5zaXplKSB7XG4gICAgbGV0IHBpcGVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20ocGlwZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgcGlwZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChwaXBlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIHBpcGVzRXhwcik7XG4gIH1cblxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBudWxsKSB7XG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZDtcbiAgfVxuXG4gIC8vIGUuZy4gYHN0eWxlczogW3N0cjEsIHN0cjJdYFxuICBpZiAobWV0YS5zdHlsZXMgJiYgbWV0YS5zdHlsZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc3R5bGVWYWx1ZXMgPSBtZXRhLmVuY2Fwc3VsYXRpb24gPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCA/XG4gICAgICAgIGNvbXBpbGVTdHlsZXMobWV0YS5zdHlsZXMsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKSA6XG4gICAgICAgIG1ldGEuc3R5bGVzO1xuICAgIGNvbnN0IHN0cmluZ3MgPSBzdHlsZVZhbHVlcy5tYXAoc3RyID0+IG8ubGl0ZXJhbChzdHIpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgby5saXRlcmFsQXJyKHN0cmluZ3MpKTtcbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb246IFt0cmlnZ2VyKCcxMjMnLCBbXSldYFxuICBpZiAobWV0YS5hbmltYXRpb25zICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkYXRhJywgby5saXRlcmFsTWFwKFt7a2V5OiAnYW5pbWF0aW9uJywgdmFsdWU6IG1ldGEuYW5pbWF0aW9ucywgcXVvdGVkOiBmYWxzZX1dKSk7XG4gIH1cblxuICAvLyBPbmx5IHNldCB0aGUgY2hhbmdlIGRldGVjdGlvbiBmbGFnIGlmIGl0J3MgZGVmaW5lZCBhbmQgaXQncyBub3QgdGhlIGRlZmF1bHQuXG4gIGlmIChjaGFuZ2VEZXRlY3Rpb24gIT0gbnVsbCAmJiBjaGFuZ2VEZXRlY3Rpb24gIT09IGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGVmYXVsdCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdjaGFuZ2VEZXRlY3Rpb24nLCBvLmxpdGVyYWwoY2hhbmdlRGV0ZWN0aW9uKSk7XG4gIH1cblxuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlVHlwZUZvckRlZihtZXRhLCBSMy5Db21wb25lbnREZWZXaXRoTWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlRGlyZWN0aXZlYCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLnR5cGUpICE7XG4gIG5hbWUgfHwgZXJyb3IoYENhbm5vdCByZXNvbHZlciB0aGUgbmFtZSBvZiAke2RpcmVjdGl2ZS50eXBlfWApO1xuXG4gIGNvbnN0IGRlZmluaXRpb25GaWVsZCA9IG91dHB1dEN0eC5jb25zdGFudFBvb2wucHJvcGVydHlOYW1lT2YoRGVmaW5pdGlvbktpbmQuRGlyZWN0aXZlKTtcblxuICBjb25zdCBtZXRhID0gZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLCBvdXRwdXRDdHgsIHJlZmxlY3Rvcik7XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgb3V0cHV0Q3R4LmNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG5cbiAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWFsIGNsYXNzIHRvIGJlIG1lcmdlZCB3aXRoIHRoZSBhY3R1YWwgY2xhc3MuXG4gIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2gobmV3IG8uQ2xhc3NTdG10KFxuICAgICAgbmFtZSwgbnVsbCxcbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKGRlZmluaXRpb25GaWVsZCwgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgcmVzLmV4cHJlc3Npb24pXSxcbiAgICAgIFtdLCBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSkpO1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVDb21wb25lbnRgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNDb21wb25lbnRNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlbmRlcjNBc3Q6IFJlbmRlcjNQYXJzZVJlc3VsdCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIGRpcmVjdGl2ZVR5cGVCeVNlbDogTWFwPHN0cmluZywgYW55PixcbiAgICBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgYW55Pikge1xuICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoY29tcG9uZW50LnR5cGUpICE7XG4gIG5hbWUgfHwgZXJyb3IoYENhbm5vdCByZXNvbHZlciB0aGUgbmFtZSBvZiAke2NvbXBvbmVudC50eXBlfWApO1xuXG4gIGNvbnN0IGRlZmluaXRpb25GaWVsZCA9IG91dHB1dEN0eC5jb25zdGFudFBvb2wucHJvcGVydHlOYW1lT2YoRGVmaW5pdGlvbktpbmQuQ29tcG9uZW50KTtcblxuICBjb25zdCBzdW1tYXJ5ID0gY29tcG9uZW50LnRvU3VtbWFyeSgpO1xuXG4gIC8vIENvbXB1dGUgdGhlIFIzQ29tcG9uZW50TWV0YWRhdGEgZnJvbSB0aGUgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhXG4gIGNvbnN0IG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEgPSB7XG4gICAgLi4uZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LCBvdXRwdXRDdHgsIHJlZmxlY3RvciksXG4gICAgc2VsZWN0b3I6IGNvbXBvbmVudC5zZWxlY3RvcixcbiAgICB0ZW1wbGF0ZToge25vZGVzOiByZW5kZXIzQXN0Lm5vZGVzfSxcbiAgICBkaXJlY3RpdmVzOiBbXSxcbiAgICBwaXBlczogdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChwaXBlVHlwZUJ5TmFtZSwgb3V0cHV0Q3R4KSxcbiAgICB2aWV3UXVlcmllczogcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQudmlld1F1ZXJpZXMsIG91dHB1dEN0eCksXG4gICAgd3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZTogZmFsc2UsXG4gICAgc3R5bGVzOiAoc3VtbWFyeS50ZW1wbGF0ZSAmJiBzdW1tYXJ5LnRlbXBsYXRlLnN0eWxlcykgfHwgRU1QVFlfQVJSQVksXG4gICAgZW5jYXBzdWxhdGlvbjpcbiAgICAgICAgKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5lbmNhcHN1bGF0aW9uKSB8fCBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkLFxuICAgIGludGVycG9sYXRpb246IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgYW5pbWF0aW9uczogbnVsbCxcbiAgICB2aWV3UHJvdmlkZXJzOlxuICAgICAgICBjb21wb25lbnQudmlld1Byb3ZpZGVycy5sZW5ndGggPiAwID8gbmV3IG8uV3JhcHBlZE5vZGVFeHByKGNvbXBvbmVudC52aWV3UHJvdmlkZXJzKSA6IG51bGwsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgfTtcbiAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQ29tcHV0ZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgZ2l2ZW4gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIGEgYENvbXBpbGVSZWZsZWN0b3JgLlxuICovXG5mdW5jdGlvbiBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShcbiAgICBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICAvLyBUaGUgZ2xvYmFsLWFuYWx5c2lzIGJhc2VkIEl2eSBtb2RlIGluIG5nYyBpcyBubyBsb25nZXIgdXRpbGl6ZWQvc3VwcG9ydGVkLlxuICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkJyk7XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVF1ZXJ5TWV0YWRhdGFgIGludG8gYFIzUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogUjNRdWVyeU1ldGFkYXRhW10ge1xuICByZXR1cm4gcXVlcmllcy5tYXAocXVlcnkgPT4ge1xuICAgIGxldCByZWFkOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHF1ZXJ5LnJlYWQgJiYgcXVlcnkucmVhZC5pZGVudGlmaWVyKSB7XG4gICAgICByZWFkID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIocXVlcnkucmVhZC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwcm9wZXJ0eU5hbWU6IHF1ZXJ5LnByb3BlcnR5TmFtZSxcbiAgICAgIGZpcnN0OiBxdWVyeS5maXJzdCxcbiAgICAgIHByZWRpY2F0ZTogc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKHF1ZXJ5LnNlbGVjdG9ycywgb3V0cHV0Q3R4KSxcbiAgICAgIGRlc2NlbmRhbnRzOiBxdWVyeS5kZXNjZW5kYW50cywgcmVhZCxcbiAgICAgIHN0YXRpYzogISFxdWVyeS5zdGF0aWNcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCBwYXJhbWV0ZXJzID0gW1xuICAgIGdldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCBjb25zdGFudFBvb2wpLFxuICAgIG8ubGl0ZXJhbChxdWVyeS5kZXNjZW5kYW50cyksXG4gICAgcXVlcnkucmVhZCB8fCBvLmxpdGVyYWwobnVsbCksXG4gIF07XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG4vLyBUdXJuIGEgZGlyZWN0aXZlIHNlbGVjdG9yIGludG8gYW4gUjMtY29tcGF0aWJsZSBzZWxlY3RvciBmb3IgZGlyZWN0aXZlIGRlZlxuZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlU2VsZWN0b3Ioc2VsZWN0b3I6IHN0cmluZyB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gYXNMaXRlcmFsKGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzZWxlY3RvcikpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTpcbiAgICBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgdmFsdWVzLnB1c2goby5saXRlcmFsKGtleSksIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWVzO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgY29udGVudCBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAoY29uc3QgcXVlcnkgb2YgbWV0YS5xdWVyaWVzKSB7XG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMuY29udGVudFF1ZXJ5KGRpckluZGV4LCBzb21lUHJlZGljYXRlLCB0cnVlLCBudWxsKTtcbiAgICBjb25zdCBhcmdzID0gW28udmFyaWFibGUoJ2RpckluZGV4JyksIC4uLnByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSBhcyBhbnldO1xuXG4gICAgY29uc3QgcXVlcnlJbnN0cnVjdGlvbiA9IHF1ZXJ5LnN0YXRpYyA/IFIzLnN0YXRpY0NvbnRlbnRRdWVyeSA6IFIzLmNvbnRlbnRRdWVyeTtcblxuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIocXVlcnlJbnN0cnVjdGlvbikuY2FsbEZuKGFyZ3MpLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRDb250ZW50UXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkQ29udGVudFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9XG5cbiAgY29uc3QgY29udGVudFF1ZXJpZXNGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW1xuICAgICAgICBuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKSxcbiAgICAgICAgbmV3IG8uRm5QYXJhbSgnZGlySW5kZXgnLCBudWxsKVxuICAgICAgXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgY29udGVudFF1ZXJpZXNGbk5hbWUpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzVHlwZShtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0pOiBvLlR5cGUge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsTWFwKG1hcFZhbHVlcykpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IHN0cmluZ1tdKTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVR5cGVGb3JEZWYobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgdHlwZUJhc2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLlR5cGUge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKHR5cGVCYXNlLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSksXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FycmF5QXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEuaW5wdXRzKSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5vdXRwdXRzKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXSkpO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIG1ldGEudmlld1F1ZXJpZXMuZm9yRWFjaCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgIGNvbnN0IHF1ZXJ5SW5zdHJ1Y3Rpb24gPSBxdWVyeS5zdGF0aWMgPyBSMy5zdGF0aWNWaWV3UXVlcnkgOiBSMy52aWV3UXVlcnk7XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy52aWV3UXVlcnkoc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID1cbiAgICAgICAgby5pbXBvcnRFeHByKHF1ZXJ5SW5zdHJ1Y3Rpb24pLmNhbGxGbihwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnksIGNvbnN0YW50UG9vbCkpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChxdWVyeURlZmluaXRpb24udG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZFZpZXdRdWVyeSgpKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRWaWV3UXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH0pO1xuXG4gIGNvbnN0IHZpZXdRdWVyeUZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fUXVlcnlgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB2aWV3UXVlcnlGbk5hbWUpO1xufVxuXG4vLyBSZXR1cm4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24gb3IgbnVsbCBpZiBvbmUgaXMgbm90IG5lY2Vzc2FyeS5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGVsVmFyRXhwOiBvLlJlYWRWYXJFeHByLCBiaW5kaW5nQ29udGV4dDogby5SZWFkVmFyRXhwcixcbiAgICBzdGF0aWNBdHRyaWJ1dGVzQW5kVmFsdWVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0sIHN0eWxlQnVpbGRlcjogU3R5bGluZ0J1aWxkZXIsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGhvc3RWYXJzQ291bnQ6IG51bWJlcik6IG8uRXhwcmVzc2lvbnxcbiAgICBudWxsIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgbGV0IHRvdGFsSG9zdFZhcnNDb3VudCA9IGhvc3RWYXJzQ291bnQ7XG4gIGNvbnN0IGhvc3RCaW5kaW5nU291cmNlU3BhbiA9IG1ldGEudHlwZVNvdXJjZVNwYW47XG4gIGNvbnN0IGRpcmVjdGl2ZVN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeShtZXRhKTtcblxuICBsZXQgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBjb25zdCBnZXRWYWx1ZUNvbnZlcnRlciA9ICgpID0+IHtcbiAgICBpZiAoIXZhbHVlQ29udmVydGVyKSB7XG4gICAgICBjb25zdCBob3N0VmFyc0NvdW50Rm4gPSAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVmFyc0NvdW50ID0gdG90YWxIb3N0VmFyc0NvdW50O1xuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gbnVtU2xvdHM7XG4gICAgICAgIHJldHVybiBvcmlnaW5hbFZhcnNDb3VudDtcbiAgICAgIH07XG4gICAgICB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCAgLy8gbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICAgICAgICBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTsgIC8vIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlQ29udmVydGVyO1xuICB9O1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gY3JlYXRlSG9zdExpc3RlbmVycyhiaW5kaW5nQ29udGV4dCwgZXZlbnRCaW5kaW5ncywgbWV0YSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKC4uLmxpc3RlbmVycyk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZ3NcbiAgY29uc3QgYmluZGluZ3MgPSBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgKGJpbmRpbmdzIHx8IFtdKS5mb3JFYWNoKChiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBiaW5kaW5nLm5hbWU7XG4gICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID1cbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgaWYgKCFzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgIC8vIHJlc29sdmUgbGl0ZXJhbCBhcnJheXMgYW5kIGxpdGVyYWwgb2JqZWN0c1xuICAgICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLmV4cHJlc3Npb24udmlzaXQoZ2V0VmFsdWVDb252ZXJ0ZXIoKSk7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUpO1xuXG4gICAgICBjb25zdCB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZX0gPSBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmcpO1xuXG4gICAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgICBiaW5kaW5nUGFyc2VyLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMobWV0YS5zZWxlY3RvciB8fCAnJywgYmluZGluZ05hbWUsIGlzQXR0cmlidXRlKVxuICAgICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gY29yZS5TZWN1cml0eUNvbnRleHQuTk9ORSk7XG5cbiAgICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoID09PSAyICYmXG4gICAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuVVJMKSA+IC0xICYmXG4gICAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMKSA+IC0xKSB7XG4gICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzb21lIFVSTCBhdHRyaWJ1dGVzIChzdWNoIGFzIFwic3JjXCIgYW5kIFwiaHJlZlwiKSB0aGF0IG1heSBiZSBhIHBhcnRcbiAgICAgICAgICAvLyBvZiBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbCBzYW50aXRpemF0aW9uIGZ1bmN0aW9uIGFuZFxuICAgICAgICAgIC8vIHNlbGVjdCB0aGUgYWN0dWFsIHNhbml0aXplciBhdCBydW50aW1lIGJhc2VkIG9uIGEgdGFnIG5hbWUgdGhhdCBpcyBwcm92aWRlZCB3aGlsZVxuICAgICAgICAgIC8vIGludm9raW5nIHNhbml0aXphdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgICBzYW5pdGl6ZXJGbiA9IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybE9yUmVzb3VyY2VVcmwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNhbml0aXplckZuID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKHNlY3VyaXR5Q29udGV4dHNbMF0sIGlzQXR0cmlidXRlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBpc1Byb3BlcnR5SW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbiA9PT0gUjMucHJvcGVydHk7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvblBhcmFtczogby5FeHByZXNzaW9uW10gPSBpc1Byb3BlcnR5SW5zdHJ1Y3Rpb24gP1xuICAgICAgICAgIFtcbiAgICAgICAgICAgIG8ubGl0ZXJhbChiaW5kaW5nTmFtZSksXG4gICAgICAgICAgICBiaW5kaW5nRXhwci5jdXJyVmFsRXhwcixcbiAgICAgICAgICBdIDpcbiAgICAgICAgICBbXG4gICAgICAgICAgICBlbFZhckV4cCxcbiAgICAgICAgICAgIG8ubGl0ZXJhbChiaW5kaW5nTmFtZSksXG4gICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl0pLFxuICAgICAgICAgIF07XG4gICAgICBpZiAoc2FuaXRpemVyRm4pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChzYW5pdGl6ZXJGbik7XG4gICAgICB9XG4gICAgICBpZiAoIWlzQXR0cmlidXRlKSB7XG4gICAgICAgIGlmICghc2FuaXRpemVyRm4pIHtcbiAgICAgICAgICAvLyBhcHBlbmQgYG51bGxgIGluIGZyb250IG9mIGBuYXRpdmVPbmx5YCBmbGFnIGlmIG5vIHNhbml0aXplciBmbiBkZWZpbmVkXG4gICAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCkpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGhvc3QgYmluZGluZ3MgbXVzdCBoYXZlIG5hdGl2ZU9ubHkgcHJvcCBzZXQgdG8gdHJ1ZVxuICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKG8ubGl0ZXJhbCh0cnVlKSk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5zdG10cyk7XG4gICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oaW5zdHJ1Y3Rpb25QYXJhbXMpLnRvU3RtdCgpKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHNpbmNlIHdlJ3JlIGRlYWxpbmcgd2l0aCBkaXJlY3RpdmVzL2NvbXBvbmVudHMgYW5kIGJvdGggaGF2ZSBob3N0QmluZGluZ1xuICAvLyBmdW5jdGlvbnMsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgYSBzcGVjaWFsIGhvc3RBdHRycyBpbnN0cnVjdGlvbiB0aGF0IGRlYWxzXG4gIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgLy8gZWxlbWVudC4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgaW5zdHJ1Y3QgYWxsIGluaXRpYWwgc3R5bGluZyAoc3R5bGluZ1xuICAvLyB0aGF0IGlzIGluc2lkZSBvZiBhIGhvc3QgYmluZGluZyB3aXRoaW4gYSBkaXJlY3RpdmUvY29tcG9uZW50KSB0byBiZSBhdHRhY2hlZFxuICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgLy8gY29sbGVjdGVkIGVhcmxpZXIuXG4gIGNvbnN0IGhvc3RBdHRycyA9IGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhzdGF0aWNBdHRyaWJ1dGVzQW5kVmFsdWVzKTtcbiAgY29uc3QgaG9zdEluc3RydWN0aW9uID0gc3R5bGVCdWlsZGVyLmJ1aWxkSG9zdEF0dHJzSW5zdHJ1Y3Rpb24obnVsbCwgaG9zdEF0dHJzLCBjb25zdGFudFBvb2wpO1xuICBpZiAoaG9zdEluc3RydWN0aW9uKSB7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKGNyZWF0ZVN0eWxpbmdTdG10KGhvc3RJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICB9XG5cbiAgaWYgKHN0eWxlQnVpbGRlci5oYXNCaW5kaW5ncykge1xuICAgIC8vIHNpbmd1bGFyIHN0eWxlL2NsYXNzIGJpbmRpbmdzICh0aGluZ3MgbGlrZSBgW3N0eWxlLnByb3BdYCBhbmQgYFtjbGFzcy5uYW1lXWApXG4gICAgLy8gTVVTVCBiZSByZWdpc3RlcmVkIG9uIGEgZ2l2ZW4gZWxlbWVudCB3aXRoaW4gdGhlIGNvbXBvbmVudC9kaXJlY3RpdmVcbiAgICAvLyB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIGZ1bmN0aW9ucy4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgZmlndXJlIG91dFxuICAgIC8vIHdoYXQgYWxsIHRoZSBiaW5kaW5ncyBhcmUgYW5kIHRoZW4gZ2VuZXJhdGUgdGhlIHN0YXRlbWVudHMgcmVxdWlyZWQgdG8gcmVnaXN0ZXJcbiAgICAvLyB0aG9zZSBiaW5kaW5ncyB0byB0aGUgZWxlbWVudCB2aWEgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICBjb25zdCBlbGVtZW50U3R5bGluZ0luc3RydWN0aW9uID1cbiAgICAgICAgc3R5bGVCdWlsZGVyLmJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihudWxsLCBjb25zdGFudFBvb2wpO1xuICAgIGlmIChlbGVtZW50U3R5bGluZ0luc3RydWN0aW9uKSB7XG4gICAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgY3JlYXRlU3R5bGluZ1N0bXQoZWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICAgIH1cblxuICAgIC8vIGZpbmFsbHkgZWFjaCBiaW5kaW5nIHRoYXQgd2FzIHJlZ2lzdGVyZWQgaW4gdGhlIHN0YXRlbWVudCBhYm92ZSB3aWxsIG5lZWQgdG8gYmUgYWRkZWQgdG9cbiAgICAvLyB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgY29tcG9uZW50L2RpcmVjdGl2ZSB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIHNvIHRoYXQgdGhlIGJpbmRpbmdzXG4gICAgLy8gYXJlIGV2YWx1YXRlZCBhbmQgdXBkYXRlZCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgc3R5bGVCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnMoZ2V0VmFsdWVDb252ZXJ0ZXIoKSkuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goY3JlYXRlU3R5bGluZ1N0bXQoaW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b3RhbEhvc3RWYXJzQ291bnQpIHtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnVuc2hpZnQoXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5hbGxvY0hvc3RWYXJzKS5jYWxsRm4oW28ubGl0ZXJhbCh0b3RhbEhvc3RWYXJzQ291bnQpXSkudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCB8fCB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0QmluZGluZ3NGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsO1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSk7XG4gICAgfVxuICAgIGlmICh1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKSxcbiAgICAgICAgICBuZXcgby5GblBhcmFtKGVsVmFyRXhwLm5hbWUgISwgby5OVU1CRVJfVFlQRSlcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBob3N0QmluZGluZ3NGbk5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdGbihpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNUKSB7XG4gIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgbnVsbCwgaW1wbGljaXQsIHZhbHVlLCAnYicsIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSwgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3R5bGluZ1N0bXQoXG4gICAgaW5zdHJ1Y3Rpb246IEluc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKTogby5TdGF0ZW1lbnQge1xuICBjb25zdCBwYXJhbXMgPSBpbnN0cnVjdGlvbi5idWlsZFBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBudWxsLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLmNhbGxGbihwYXJhbXMsIGluc3RydWN0aW9uLnNvdXJjZVNwYW4pXG4gICAgICAudG9TdG10KCk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24gITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50QXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmNvbXBvbmVudEhvc3RTeW50aGV0aWNQcm9wZXJ0eTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5wcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGU6ICEhYXR0ck1hdGNoZXN9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKFxuICAgIGJpbmRpbmdDb250ZXh0OiBvLkV4cHJlc3Npb24sIGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uU3RhdGVtZW50W10ge1xuICByZXR1cm4gZXZlbnRCaW5kaW5ncy5tYXAoYmluZGluZyA9PiB7XG4gICAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBiaW5kaW5nLnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gP1xuICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoYmluZGluZ05hbWUsIGJpbmRpbmcudGFyZ2V0T3JQaGFzZSkgOlxuICAgICAgICBiaW5kaW5nTmFtZTtcbiAgICBjb25zdCBoYW5kbGVyTmFtZSA9XG4gICAgICAgIG1ldGEubmFtZSAmJiBiaW5kaW5nTmFtZSA/IGAke21ldGEubmFtZX1fJHtiaW5kaW5nRm5OYW1lfV9Ib3N0QmluZGluZ0hhbmRsZXJgIDogbnVsbDtcbiAgICBjb25zdCBwYXJhbXMgPSBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgICAgIEJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGJpbmRpbmcpLCBiaW5kaW5nQ29udGV4dCwgaGFuZGxlck5hbWUpO1xuICAgIGNvbnN0IGluc3RydWN0aW9uID1cbiAgICAgICAgYmluZGluZy50eXBlID09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBSMy5jb21wb25lbnRIb3N0U3ludGhldGljTGlzdGVuZXIgOiBSMy5saXN0ZW5lcjtcbiAgICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4ocGFyYW1zKS50b1N0bXQoKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSB7XG4gIC8vIGNsYW5nLWZvcm1hdCBvZmZcbiAgcmV0dXJuIHtcbiAgICAvLyBUaGlzIGlzIHVzZWQgYnkgdGhlIEJpbmRpbmdQYXJzZXIsIHdoaWNoIG9ubHkgZGVhbHMgd2l0aCBsaXN0ZW5lcnMgYW5kIHByb3BlcnRpZXMuIFRoZXJlJ3Mgbm9cbiAgICAvLyBuZWVkIHRvIHBhc3MgYXR0cmlidXRlcyB0byBpdC5cbiAgICBob3N0QXR0cmlidXRlczoge30sXG4gICAgaG9zdExpc3RlbmVyczogbWV0YS5ob3N0Lmxpc3RlbmVycyxcbiAgICBob3N0UHJvcGVydGllczogbWV0YS5ob3N0LnByb3BlcnRpZXMsXG4gIH0gYXMgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnk7XG4gIC8vIGNsYW5nLWZvcm1hdCBvblxufVxuXG5cbmZ1bmN0aW9uIHR5cGVNYXBUb0V4cHJlc3Npb25NYXAoXG4gICAgbWFwOiBNYXA8c3RyaW5nLCBTdGF0aWNTeW1ib2w+LCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+IHtcbiAgLy8gQ29udmVydCBlYWNoIG1hcCBlbnRyeSBpbnRvIGFub3RoZXIgZW50cnkgd2hlcmUgdGhlIHZhbHVlIGlzIGFuIGV4cHJlc3Npb24gaW1wb3J0aW5nIHRoZSB0eXBlLlxuICBjb25zdCBlbnRyaWVzID0gQXJyYXkuZnJvbShtYXApLm1hcChcbiAgICAgIChba2V5LCB0eXBlXSk6IFtzdHJpbmcsIG8uRXhwcmVzc2lvbl0gPT4gW2tleSwgb3V0cHV0Q3R4LmltcG9ydEV4cHIodHlwZSldKTtcbiAgcmV0dXJuIG5ldyBNYXAoZW50cmllcyk7XG59XG5cbmNvbnN0IEhPU1RfUkVHX0VYUCA9IC9eKD86XFxbKFteXFxdXSspXFxdKXwoPzpcXCgoW15cXCldKylcXCkpJC87XG4vLyBSZXByZXNlbnRzIHRoZSBncm91cHMgaW4gdGhlIGFib3ZlIHJlZ2V4LlxuY29uc3QgZW51bSBIb3N0QmluZGluZ0dyb3VwIHtcbiAgLy8gZ3JvdXAgMTogXCJwcm9wXCIgZnJvbSBcIltwcm9wXVwiLCBvciBcImF0dHIucm9sZVwiIGZyb20gXCJbYXR0ci5yb2xlXVwiLCBvciBAYW5pbSBmcm9tIFtAYW5pbV1cbiAgQmluZGluZyA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxufVxuXG4vLyBEZWZpbmVzIEhvc3QgQmluZGluZ3Mgc3RydWN0dXJlIHRoYXQgY29udGFpbnMgYXR0cmlidXRlcywgbGlzdGVuZXJzLCBhbmQgcHJvcGVydGllcyxcbi8vIHBhcnNlZCBmcm9tIHRoZSBgaG9zdGAgb2JqZWN0IGRlZmluZWQgZm9yIGEgVHlwZS5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO307XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhvc3RCaW5kaW5ncyhob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgby5FeHByZXNzaW9ufSk6XG4gICAgUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO30gPSB7fTtcblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhob3N0KSkge1xuICAgIGNvbnN0IHZhbHVlID0gaG9zdFtrZXldO1xuICAgIGNvbnN0IG1hdGNoZXMgPSBrZXkubWF0Y2goSE9TVF9SRUdfRVhQKTtcblxuICAgIGlmIChtYXRjaGVzID09PSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2xhc3MgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0eWxlIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgLy8gc3ludGhldGljIHByb3BlcnRpZXMgKHRoZSBvbmVzIHRoYXQgaGF2ZSBhIGBAYCBhcyBhIHByZWZpeClcbiAgICAgIC8vIGFyZSBzdGlsbCB0cmVhdGVkIHRoZSBzYW1lIGFzIHJlZ3VsYXIgcHJvcGVydGllcy4gVGhlcmVmb3JlXG4gICAgICAvLyB0aGVyZSBpcyBubyBwb2ludCBpbiBzdG9yaW5nIHRoZW0gaW4gYSBzZXBhcmF0ZSBtYXAuXG4gICAgICBwcm9wZXJ0aWVzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF0gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YXR0cmlidXRlcywgbGlzdGVuZXJzLCBwcm9wZXJ0aWVzLCBzcGVjaWFsQXR0cmlidXRlc307XG59XG5cbi8qKlxuICogVmVyaWZpZXMgaG9zdCBiaW5kaW5ncyBhbmQgcmV0dXJucyB0aGUgbGlzdCBvZiBlcnJvcnMgKGlmIGFueSkuIEVtcHR5IGFycmF5IGluZGljYXRlcyB0aGF0IGFcbiAqIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzIGhhcyBubyBlcnJvcnMuXG4gKlxuICogQHBhcmFtIGJpbmRpbmdzIHNldCBvZiBob3N0IGJpbmRpbmdzIHRvIHZlcmlmeS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIHNvdXJjZSBzcGFuIHdoZXJlIGhvc3QgYmluZGluZ3Mgd2VyZSBkZWZpbmVkLlxuICogQHJldHVybnMgYXJyYXkgb2YgZXJyb3JzIGFzc29jaWF0ZWQgd2l0aCBhIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5SG9zdEJpbmRpbmdzKFxuICAgIGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3MsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeSh7IGhvc3Q6IGJpbmRpbmdzIH0gYXMgYW55KTtcbiAgLy8gVE9ETzogYWJzdHJhY3Qgb3V0IGhvc3QgYmluZGluZ3MgdmVyaWZpY2F0aW9uIGxvZ2ljIGFuZCB1c2UgaXQgaW5zdGVhZCBvZlxuICAvLyBjcmVhdGluZyBldmVudHMgYW5kIHByb3BlcnRpZXMgQVNUcyB0byBkZXRlY3QgZXJyb3JzIChGVy05OTYpXG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoc3VtbWFyeSwgc291cmNlU3Bhbik7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhzdW1tYXJ5LCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGJpbmRpbmdQYXJzZXIuZXJyb3JzO1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHsgcmV0dXJuIHNoYWRvd0NzcyAhLnNoaW1Dc3NUZXh0KHN0eWxlLCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTsgfSk7XG59XG4iXX0=