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
        define("@angular/compiler/src/render3/view/compiler", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/lifecycle_reflector", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/selector", "@angular/compiler/src/shadow_css", "@angular/compiler/src/style_compiler", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core = require("@angular/compiler/src/core");
    var lifecycle_reflector_1 = require("@angular/compiler/src/lifecycle_reflector");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var selector_1 = require("@angular/compiler/src/selector");
    var shadow_css_1 = require("@angular/compiler/src/shadow_css");
    var style_compiler_1 = require("@angular/compiler/src/style_compiler");
    var util_1 = require("@angular/compiler/src/util");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_2 = require("@angular/compiler/src/render3/util");
    var template_1 = require("@angular/compiler/src/render3/view/template");
    var util_3 = require("@angular/compiler/src/render3/view/util");
    var EMPTY_ARRAY = [];
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
            extraStatementFn: createFactoryExtraStatementsFn(meta, bindingParser)
        });
        definitionMap.set('factory', result.factory);
        definitionMap.set('contentQueries', createContentQueriesFunction(meta, constantPool));
        definitionMap.set('contentQueriesRefresh', createContentQueriesRefreshFunction(meta));
        // Initialize hostVars to number of bound host properties (interpolations illegal)
        var hostVars = Object.keys(meta.host.properties).length;
        // e.g. `hostBindings: (dirIndex, elIndex) => { ... }
        definitionMap.set('hostBindings', createHostBindingsFunction(meta, bindingParser, constantPool, function (slots) {
            var originalSlots = hostVars;
            hostVars += slots;
            return originalSlots;
        }));
        if (hostVars) {
            // e.g. `hostVars: 2
            definitionMap.set('hostVars', o.literal(hostVars));
        }
        // e.g. `attributes: ['role', 'listbox']`
        definitionMap.set('attributes', createHostAttributesArray(meta));
        // e.g 'inputs: {a: 'a'}`
        definitionMap.set('inputs', util_3.conditionallyCreateMapObjectLiteral(meta.inputs));
        // e.g 'outputs: {a: 'a'}`
        definitionMap.set('outputs', util_3.conditionallyCreateMapObjectLiteral(meta.outputs));
        if (meta.exportAs !== null) {
            definitionMap.set('exportAs', o.literal(meta.exportAs));
        }
        return { definitionMap: definitionMap, statements: result.statements };
    }
    /**
     * Add features to the definition map.
     */
    function addFeatures(definitionMap, meta) {
        // e.g. `features: [NgOnChangesFeature]`
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
            features.push(o.importExpr(r3_identifiers_1.Identifiers.NgOnChangesFeature));
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
        // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
        // string literal, which must be on one line.
        var selectorForType = (meta.selector || '').replace(/\n/g, '');
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
        var _a = baseDirectiveFields(meta, constantPool, bindingParser), definitionMap = _a.definitionMap, statements = _a.statements;
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
        if (meta.directives.size) {
            var matcher_1 = new selector_1.SelectorMatcher();
            meta.directives.forEach(function (expression, selector) {
                matcher_1.addSelectables(selector_1.CssSelector.parse(selector), expression);
            });
            directiveMatcher = matcher_1;
        }
        if (meta.viewQueries.length) {
            definitionMap.set('viewQuery', createViewQueriesFunction(meta, constantPool));
        }
        // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
        var templateTypeName = meta.name;
        var templateName = templateTypeName ? templateTypeName + "_Template" : null;
        var directivesUsed = new Set();
        var pipesUsed = new Set();
        var template = meta.template;
        var templateBuilder = new template_1.TemplateDefinitionBuilder(constantPool, template_1.BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, meta.viewQueries, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, r3_identifiers_1.Identifiers.namespaceHTML, meta.template.relativeContextFilePath);
        var templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, [], template.hasNgContent, template.ngContentSelectors);
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
        // e.g. `styles: [str1, str2]`
        if (meta.styles && meta.styles.length) {
            var styleValues = meta.encapsulation == core.ViewEncapsulation.Emulated ?
                compileStyles(meta.styles, style_compiler_1.CONTENT_ATTR, style_compiler_1.HOST_ATTR) :
                meta.styles;
            var strings = styleValues.map(function (str) { return o.literal(str); });
            definitionMap.set('styles', o.literalArr(strings));
        }
        // e.g. `animations: [trigger('123', [])]`
        if (meta.animations !== null) {
            definitionMap.set('data', o.literalMap([{ key: 'animations', value: meta.animations, quoted: false }]));
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
        var meta = tslib_1.__assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector), { selector: component.selector, template: {
                nodes: render3Ast.nodes,
                hasNgContent: render3Ast.hasNgContent,
                ngContentSelectors: render3Ast.ngContentSelectors,
                relativeContextFilePath: '',
            }, directives: typeMapToExpressionMap(directiveTypeBySel, outputCtx), pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null });
        var res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
        // Create the partial class to be merged with the actual class.
        outputCtx.statements.push(new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []));
    }
    exports.compileComponentFromRender2 = compileComponentFromRender2;
    /**
     * Compute `R3DirectiveMetadata` given `CompileDirectiveMetadata` and a `CompileReflector`.
     */
    function directiveMetadataFromGlobalMetadata(directive, outputCtx, reflector) {
        var summary = directive.toSummary();
        var name = compile_metadata_1.identifierName(directive.type);
        name || util_1.error("Cannot resolver the name of " + directive.type);
        return {
            name: name,
            type: outputCtx.importExpr(directive.type.reference),
            typeArgumentCount: 0,
            typeSourceSpan: parse_util_1.typeSourceSpan(directive.isComponent ? 'Component' : 'Directive', directive.type),
            selector: directive.selector,
            deps: r3_factory_1.dependenciesFromGlobalMetadata(directive.type, outputCtx, reflector),
            queries: queriesFromGlobalMetadata(directive.queries, outputCtx),
            lifecycle: {
                usesOnChanges: directive.type.lifecycleHooks.some(function (lifecycle) { return lifecycle == lifecycle_reflector_1.LifecycleHooks.OnChanges; }),
            },
            host: {
                attributes: directive.hostAttributes,
                listeners: summary.hostListeners,
                properties: summary.hostProperties,
            },
            inputs: directive.inputs,
            outputs: directive.outputs,
            usesInheritance: false,
            exportAs: null,
            providers: directive.providers.length > 0 ? new o.WrappedNodeExpr(directive.providers) : null
        };
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
    function createQueryDefinition(query, constantPool, idx) {
        var predicate = util_3.getQueryPredicate(query, constantPool);
        // e.g. r3.Q(null, somePredicate, false) or r3.Q(0, ['div'], false)
        var parameters = [
            o.literal(idx, o.INFERRED_TYPE),
            predicate,
            o.literal(query.descendants),
        ];
        if (query.read) {
            parameters.push(query.read);
        }
        return o.importExpr(r3_identifiers_1.Identifiers.query).callFn(parameters);
    }
    // Turn a directive selector into an R3-compatible selector for directive def
    function createDirectiveSelector(selector) {
        return util_3.asLiteral(core.parseSelectorToR3Selector(selector));
    }
    function createHostAttributesArray(meta) {
        var e_1, _a;
        var values = [];
        var attributes = meta.host.attributes;
        try {
            for (var _b = tslib_1.__values(Object.getOwnPropertyNames(attributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = attributes[key];
                values.push(o.literal(key), o.literal(value));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (values.length > 0) {
            return o.literalArr(values);
        }
        return null;
    }
    // Return a contentQueries function or null if one is not necessary.
    function createContentQueriesFunction(meta, constantPool) {
        if (meta.queries.length) {
            var statements = meta.queries.map(function (query) {
                var queryDefinition = createQueryDefinition(query, constantPool, null);
                return o.importExpr(r3_identifiers_1.Identifiers.registerContentQuery)
                    .callFn([queryDefinition, o.variable('dirIndex')])
                    .toStmt();
            });
            var typeName = meta.name;
            var parameters = [new o.FnParam('dirIndex', o.NUMBER_TYPE)];
            return o.fn(parameters, statements, o.INFERRED_TYPE, null, typeName ? typeName + "_ContentQueries" : null);
        }
        return null;
    }
    // Return a contentQueriesRefresh function or null if one is not necessary.
    function createContentQueriesRefreshFunction(meta) {
        if (meta.queries.length > 0) {
            var statements_1 = [];
            var typeName = meta.name;
            var parameters = [
                new o.FnParam('dirIndex', o.NUMBER_TYPE),
                new o.FnParam('queryStartIndex', o.NUMBER_TYPE),
            ];
            var directiveInstanceVar_1 = o.variable('instance');
            // var $tmp$: any;
            var temporary_1 = util_3.temporaryAllocator(statements_1, util_3.TEMPORARY_NAME);
            // const $instance$ = $r3$.ɵload(dirIndex);
            statements_1.push(directiveInstanceVar_1.set(o.importExpr(r3_identifiers_1.Identifiers.load).callFn([o.variable('dirIndex')]))
                .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            meta.queries.forEach(function (query, idx) {
                var loadQLArg = o.variable('queryStartIndex');
                var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadQueryList).callFn([
                    idx > 0 ? loadQLArg.plus(o.literal(idx)) : loadQLArg
                ]);
                var assignToTemporary = temporary_1().set(getQueryList);
                var callQueryRefresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([assignToTemporary]);
                var updateDirective = directiveInstanceVar_1.prop(query.propertyName)
                    .set(query.first ? temporary_1().prop('first') : temporary_1());
                var refreshQueryAndUpdateDirective = callQueryRefresh.and(updateDirective);
                statements_1.push(refreshQueryAndUpdateDirective.toStmt());
            });
            return o.fn(parameters, statements_1, o.INFERRED_TYPE, null, typeName ? typeName + "_ContentQueriesRefresh" : null);
        }
        return null;
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
            meta.exportAs !== null ? stringAsType(meta.exportAs) : o.NONE_TYPE,
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
        for (var i = 0; i < meta.viewQueries.length; i++) {
            var query = meta.viewQueries[i];
            // creation, e.g. r3.Q(0, somePredicate, true);
            var queryDefinition = createQueryDefinition(query, constantPool, i);
            createStatements.push(queryDefinition.toStmt());
            // update, e.g. (r3.qR(tmp = r3.ɵload(0)) && (ctx.someDir = tmp));
            var temporary = tempAllocator();
            var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.load).callFn([o.literal(i)]);
            var refresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
            var updateDirective = o.variable(util_3.CONTEXT_NAME)
                .prop(query.propertyName)
                .set(query.first ? temporary.prop('first') : temporary);
            updateStatements.push(refresh.and(updateDirective).toStmt());
        }
        var viewQueryFnName = meta.name ? meta.name + "_Query" : null;
        return o.fn([new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null)], [
            template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements),
            template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements)
        ], o.INFERRED_TYPE, null, viewQueryFnName);
    }
    // Return a host binding function or null if one is not necessary.
    function createHostBindingsFunction(meta, bindingParser, constantPool, allocatePureFunctionSlots) {
        var e_2, _a;
        var statements = [];
        var hostBindingSourceSpan = meta.typeSourceSpan;
        var directiveSummary = metadataAsSummary(meta);
        // Calculate the host property bindings
        var bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
        var bindingContext = o.importExpr(r3_identifiers_1.Identifiers.load).callFn([o.variable('dirIndex')]);
        if (bindings) {
            var valueConverter = new template_1.ValueConverter(constantPool, 
            /* new nodes are illegal here */ function () { return util_1.error('Unexpected node'); }, allocatePureFunctionSlots, 
            /* pipes are illegal here */ function () { return util_1.error('Unexpected pipe'); });
            try {
                for (var bindings_1 = tslib_1.__values(bindings), bindings_1_1 = bindings_1.next(); !bindings_1_1.done; bindings_1_1 = bindings_1.next()) {
                    var binding = bindings_1_1.value;
                    // resolve literal arrays and literal objects
                    var value = binding.expression.visit(valueConverter);
                    var bindingExpr = expression_converter_1.convertPropertyBinding(null, bindingContext, value, 'b', expression_converter_1.BindingForm.TrySimple, function () { return util_1.error('Unexpected interpolation'); });
                    statements.push.apply(statements, tslib_1.__spread(bindingExpr.stmts));
                    statements.push(o.importExpr(r3_identifiers_1.Identifiers.elementProperty)
                        .callFn([
                        o.variable('elIndex'),
                        o.literal(binding.name),
                        o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([bindingExpr.currValExpr]),
                    ])
                        .toStmt());
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (bindings_1_1 && !bindings_1_1.done && (_a = bindings_1.return)) _a.call(bindings_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        if (statements.length > 0) {
            var typeName = meta.name;
            return o.fn([
                new o.FnParam('dirIndex', o.NUMBER_TYPE),
                new o.FnParam('elIndex', o.NUMBER_TYPE),
            ], statements, o.INFERRED_TYPE, null, typeName ? typeName + "_HostBindings" : null);
        }
        return null;
    }
    function createFactoryExtraStatementsFn(meta, bindingParser) {
        var eventBindings = bindingParser.createDirectiveHostEventAsts(metadataAsSummary(meta), meta.typeSourceSpan);
        return eventBindings && eventBindings.length ?
            function (instance) { return createHostListeners(instance, eventBindings, meta); } :
            null;
    }
    function createHostListeners(bindingContext, eventBindings, meta) {
        return eventBindings.map(function (binding) {
            var bindingExpr = expression_converter_1.convertActionBinding(null, bindingContext, binding.handler, 'b', function () { return util_1.error('Unexpected interpolation'); });
            var bindingName = binding.name && compile_metadata_1.sanitizeIdentifier(binding.name);
            var typeName = meta.name;
            var functionName = typeName && bindingName ? typeName + "_" + bindingName + "_HostBindingHandler" : null;
            var handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], tslib_1.__spread(bindingExpr.render3Stmts), o.INFERRED_TYPE, null, functionName);
            return o.importExpr(r3_identifiers_1.Identifiers.listener).callFn([o.literal(binding.name), handler]).toStmt();
        });
    }
    function metadataAsSummary(meta) {
        // clang-format off
        return {
            hostAttributes: meta.host.attributes,
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
    var HOST_REG_EXP = /^(?:(?:\[([^\]]+)\])|(?:\(([^\)]+)\)))|(\@[-\w]+)$/;
    function parseHostBindings(host) {
        var attributes = {};
        var listeners = {};
        var properties = {};
        var animations = {};
        Object.keys(host).forEach(function (key) {
            var value = host[key];
            var matches = key.match(HOST_REG_EXP);
            if (matches === null) {
                attributes[key] = value;
            }
            else if (matches[1 /* Property */] != null) {
                properties[matches[1 /* Property */]] = value;
            }
            else if (matches[2 /* Event */] != null) {
                listeners[matches[2 /* Event */]] = value;
            }
            else if (matches[3 /* Animation */] != null) {
                animations[matches[3 /* Animation */]] = value;
            }
        });
        return { attributes: attributes, listeners: listeners, properties: properties, animations: animations };
    }
    exports.parseHostBindings = parseHostBindings;
    function compileStyles(styles, selector, hostSelector) {
        var shadowCss = new shadow_css_1.ShadowCss();
        return styles.map(function (style) { return shadowCss.shimCssText(style, selector, hostSelector); });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUF5SztJQUV6SyxpR0FBbUg7SUFFbkgsaURBQW1DO0lBRW5DLGlGQUF5RDtJQUN6RCwyREFBNkM7SUFDN0MsK0RBQWdEO0lBQ2hELDJEQUE0RDtJQUM1RCwrREFBMkM7SUFDM0MsdUVBQTZEO0lBRTdELG1EQUFnRDtJQUNoRCx1RUFBcUY7SUFDckYsK0VBQW9EO0lBRXBELDJEQUEyQztJQUczQyx3RUFBMEc7SUFDMUcsZ0VBQXlMO0lBRXpMLElBQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztJQUU5QixTQUFTLG1CQUFtQixDQUN4QixJQUF5QixFQUFFLFlBQTBCLEVBQ3JELGFBQTRCO1FBQzlCLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBRSxDQUFDO1FBRTFDLDJCQUEyQjtRQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFckMsMENBQTBDO1FBQzFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLHVCQUF1QixDQUFDLElBQUksQ0FBQyxRQUFVLENBQUMsQ0FBQyxDQUFDO1FBR3pFLCtEQUErRDtRQUMvRCxJQUFNLE1BQU0sR0FBRyxtQ0FBc0IsQ0FBQztZQUNwQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixRQUFRLEVBQUUsNEJBQUUsQ0FBQyxlQUFlO1lBQzVCLGdCQUFnQixFQUFFLDhCQUE4QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUM7U0FDdEUsQ0FBQyxD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Z0JBQ2xELFNBQVMsQ0FBQyxPQUFPLGVBQXdCLENBQUMsR0FBRyxLQUFLLENBQUM7YUFDcEQ7aUJBQU0sSUFBSSxPQUFPLG1CQUE0QixJQUFJLElBQUksRUFBRTtnQkFDdEQsVUFBVSxDQUFDLE9BQU8sbUJBQTRCLENBQUMsR0FBRyxLQUFLLENBQUM7YUFDekQ7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxTQUFTLFdBQUEsRUFBRSxVQUFVLFlBQUEsRUFBRSxVQUFVLFlBQUEsRUFBQyxDQUFDO0lBQ3pELENBQUM7SUExQkQsOENBMEJDO0lBRUQsU0FBUyxhQUFhLENBQUMsTUFBZ0IsRUFBRSxRQUFnQixFQUFFLFlBQW9CO1FBQzdFLElBQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBTSxPQUFPLFNBQVcsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi8uLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVRdWVyeU1ldGFkYXRhLCBDb21waWxlVG9rZW5NZXRhZGF0YSwgaWRlbnRpZmllck5hbWUsIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uLy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtQYXJzZWRFdmVudH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGlmZWN5Y2xlSG9va3N9IGZyb20gJy4uLy4uL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge3R5cGVTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtTaGFkb3dDc3N9IGZyb20gJy4uLy4uL3NoYWRvd19jc3MnO1xuaW1wb3J0IHtDT05URU5UX0FUVFIsIEhPU1RfQVRUUn0gZnJvbSAnLi4vLi4vc3R5bGVfY29tcGlsZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1JlbmRlcjNQYXJzZVJlc3VsdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7dHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXR9IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIGdldFF1ZXJ5UHJlZGljYXRlLCBtYXBUb0V4cHJlc3Npb24sIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgRU1QVFlfQVJSQVk6IGFueVtdID0gW107XG5cbmZ1bmN0aW9uIGJhc2VEaXJlY3RpdmVGaWVsZHMoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEudHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3JzOiBbWycnLCAnc29tZURpcicsICcnXV1gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcnMnLCBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihtZXRhLnNlbGVjdG9yICEpKTtcblxuXG4gIC8vIGUuZy4gYGZhY3Rvcnk6ICgpID0+IG5ldyBNeUFwcChkaXJlY3RpdmVJbmplY3QoRWxlbWVudFJlZikpYFxuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LFxuICAgIGV4dHJhU3RhdGVtZW50Rm46IGNyZWF0ZUZhY3RvcnlFeHRyYVN0YXRlbWVudHNGbihtZXRhLCBiaW5kaW5nUGFyc2VyKVxuICB9KTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZmFjdG9yeSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnY29udGVudFF1ZXJpZXNSZWZyZXNoJywgY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YSkpO1xuXG4gIC8vIEluaXRpYWxpemUgaG9zdFZhcnMgdG8gbnVtYmVyIG9mIGJvdW5kIGhvc3QgcHJvcGVydGllcyAoaW50ZXJwb2xhdGlvbnMgaWxsZWdhbClcbiAgbGV0IGhvc3RWYXJzID0gT2JqZWN0LmtleXMobWV0YS5ob3N0LnByb3BlcnRpZXMpLmxlbmd0aDtcblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChkaXJJbmRleCwgZWxJbmRleCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLFxuICAgICAgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24obWV0YSwgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCAoc2xvdHM6IG51bWJlcikgPT4ge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gaG9zdFZhcnM7XG4gICAgICAgIGhvc3RWYXJzICs9IHNsb3RzO1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxTbG90cztcbiAgICAgIH0pKTtcblxuICBpZiAoaG9zdFZhcnMpIHtcbiAgICAvLyBlLmcuIGBob3N0VmFyczogMlxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0VmFycycsIG8ubGl0ZXJhbChob3N0VmFycykpO1xuICB9XG5cbiAgLy8gZS5nLiBgYXR0cmlidXRlczogWydyb2xlJywgJ2xpc3Rib3gnXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2F0dHJpYnV0ZXMnLCBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KG1ldGEpKTtcblxuICAvLyBlLmcgJ2lucHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLmlucHV0cykpO1xuXG4gIC8vIGUuZyAnb3V0cHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBvLmxpdGVyYWwobWV0YS5leHBvcnRBcykpO1xuICB9XG5cbiAgcmV0dXJuIHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50c307XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSB8IFIzQ29tcG9uZW50TWV0YWRhdGEpIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmVdYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGEpLnZpZXdQcm92aWRlcnM7XG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICBpZiAoZmVhdHVyZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZlYXR1cmVzJywgby5saXRlcmFsQXJyKGZlYXR1cmVzKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzRGlyZWN0aXZlRGVmIHtcbiAgY29uc3Qge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHN9ID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCB0eXBlID0gY3JlYXRlVHlwZUZvckRlZihtZXRhLCBSMy5EaXJlY3RpdmVEZWZXaXRoTWV0YSk7XG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50c307XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNCYXNlUmVmTWV0YURhdGEge1xuICBpbnB1dHM/OiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgW3N0cmluZywgc3RyaW5nXX07XG4gIG91dHB1dHM/OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgYmFzZSBkZWZpbml0aW9uIGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkge0BsaW5rIFIzQmFzZVJlZk1ldGFkYXRhfVxuICogQHBhcmFtIG1ldGEgdGhlIG1ldGFkYXRhIHVzZWQgZm9yIGNvbXBpbGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUJhc2VEZWZGcm9tTWV0YWRhdGEobWV0YTogUjNCYXNlUmVmTWV0YURhdGEpIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGlmIChtZXRhLmlucHV0cykge1xuICAgIGNvbnN0IGlucHV0cyA9IG1ldGEuaW5wdXRzO1xuICAgIGNvbnN0IGlucHV0c01hcCA9IE9iamVjdC5rZXlzKGlucHV0cykubWFwKGtleSA9PiB7XG4gICAgICBjb25zdCB2ID0gaW5wdXRzW2tleV07XG4gICAgICBjb25zdCB2YWx1ZSA9IEFycmF5LmlzQXJyYXkodikgPyBvLmxpdGVyYWxBcnIodi5tYXAodnggPT4gby5saXRlcmFsKHZ4KSkpIDogby5saXRlcmFsKHYpO1xuICAgICAgcmV0dXJuIHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfTtcbiAgICB9KTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgby5saXRlcmFsTWFwKGlucHV0c01hcCkpO1xuICB9XG4gIGlmIChtZXRhLm91dHB1dHMpIHtcbiAgICBjb25zdCBvdXRwdXRzID0gbWV0YS5vdXRwdXRzO1xuICAgIGNvbnN0IG91dHB1dHNNYXAgPSBPYmplY3Qua2V5cyhvdXRwdXRzKS5tYXAoa2V5ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gby5saXRlcmFsKG91dHB1dHNba2V5XSk7XG4gICAgICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xuICAgIH0pO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgby5saXRlcmFsTWFwKG91dHB1dHNNYXApKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lQmFzZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgY29uc3QgdHlwZSA9IG5ldyBvLkV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5CYXNlRGVmKSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgY29tcG9uZW50IGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0NvbXBvbmVudE1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzQ29tcG9uZW50RGVmIHtcbiAgY29uc3Qge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHN9ID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcblxuICBjb25zdCBzZWxlY3RvciA9IG1ldGEuc2VsZWN0b3IgJiYgQ3NzU2VsZWN0b3IucGFyc2UobWV0YS5zZWxlY3Rvcik7XG4gIGNvbnN0IGZpcnN0U2VsZWN0b3IgPSBzZWxlY3RvciAmJiBzZWxlY3RvclswXTtcblxuICAvLyBlLmcuIGBhdHRyOiBbXCJjbGFzc1wiLCBcIi5teS5hcHBcIl1gXG4gIC8vIFRoaXMgaXMgb3B0aW9uYWwgYW4gb25seSBpbmNsdWRlZCBpZiB0aGUgZmlyc3Qgc2VsZWN0b3Igb2YgYSBjb21wb25lbnQgc3BlY2lmaWVzIGF0dHJpYnV0ZXMuXG4gIGlmIChmaXJzdFNlbGVjdG9yKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JBdHRyaWJ1dGVzID0gZmlyc3RTZWxlY3Rvci5nZXRBdHRycygpO1xuICAgIGlmIChzZWxlY3RvckF0dHJpYnV0ZXMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgICAnYXR0cnMnLCBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JBdHRyaWJ1dGVzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0+IHZhbHVlICE9IG51bGwgPyBvLmxpdGVyYWwodmFsdWUpIDogby5saXRlcmFsKHVuZGVmaW5lZCkpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgLyogZm9yY2VTaGFyZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEdlbmVyYXRlIHRoZSBDU1MgbWF0Y2hlciB0aGF0IHJlY29nbml6ZSBkaXJlY3RpdmVcbiAgbGV0IGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsID0gbnVsbDtcblxuICBpZiAobWV0YS5kaXJlY3RpdmVzLnNpemUpIHtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcigpO1xuICAgIG1ldGEuZGlyZWN0aXZlcy5mb3JFYWNoKChleHByZXNzaW9uLCBzZWxlY3Rvcjogc3RyaW5nKSA9PiB7XG4gICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKSwgZXhwcmVzc2lvbik7XG4gICAgfSk7XG4gICAgZGlyZWN0aXZlTWF0Y2hlciA9IG1hdGNoZXI7XG4gIH1cblxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJ5JywgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHRlbXBsYXRlOiBmdW5jdGlvbiBNeUNvbXBvbmVudF9UZW1wbGF0ZShfY3R4LCBfY20pIHsuLi59YFxuICBjb25zdCB0ZW1wbGF0ZVR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZVR5cGVOYW1lID8gYCR7dGVtcGxhdGVUeXBlTmFtZX1fVGVtcGxhdGVgIDogbnVsbDtcblxuICBjb25zdCBkaXJlY3RpdmVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBwaXBlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcblxuICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gIGNvbnN0IHRlbXBsYXRlQnVpbGRlciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgY29uc3RhbnRQb29sLCBCaW5kaW5nU2NvcGUuUk9PVF9TQ09QRSwgMCwgdGVtcGxhdGVUeXBlTmFtZSwgbnVsbCwgbnVsbCwgdGVtcGxhdGVOYW1lLFxuICAgICAgbWV0YS52aWV3UXVlcmllcywgZGlyZWN0aXZlTWF0Y2hlciwgZGlyZWN0aXZlc1VzZWQsIG1ldGEucGlwZXMsIHBpcGVzVXNlZCwgUjMubmFtZXNwYWNlSFRNTCxcbiAgICAgIG1ldGEudGVtcGxhdGUucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgpO1xuXG4gIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIHRlbXBsYXRlLm5vZGVzLCBbXSwgdGVtcGxhdGUuaGFzTmdDb250ZW50LCB0ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMpO1xuXG4gIC8vIGUuZy4gYGNvbnN0czogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgLy8gZS5nLiBgdmFyczogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG5cbiAgLy8gZS5nLiBgZGlyZWN0aXZlczogW015RGlyZWN0aXZlXWBcbiAgaWYgKGRpcmVjdGl2ZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgZGlyZWN0aXZlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKGRpcmVjdGl2ZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgZGlyZWN0aXZlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGRpcmVjdGl2ZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGlyZWN0aXZlcycsIGRpcmVjdGl2ZXNFeHByKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHBpcGVzOiBbTXlQaXBlXWBcbiAgaWYgKHBpcGVzVXNlZC5zaXplKSB7XG4gICAgbGV0IHBpcGVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20ocGlwZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgcGlwZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChwaXBlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIHBpcGVzRXhwcik7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHJpbmdzID0gc3R5bGVWYWx1ZXMubWFwKHN0ciA9PiBvLmxpdGVyYWwoc3RyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHJpbmdzKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb25zOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbnMnLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkNvbXBvbmVudERlZldpdGhNZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7XG4gICAgICBub2RlczogcmVuZGVyM0FzdC5ub2RlcyxcbiAgICAgIGhhc05nQ29udGVudDogcmVuZGVyM0FzdC5oYXNOZ0NvbnRlbnQsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHJlbmRlcjNBc3QubmdDb250ZW50U2VsZWN0b3JzLFxuICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIH0sXG4gICAgZGlyZWN0aXZlczogdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChkaXJlY3RpdmVUeXBlQnlTZWwsIG91dHB1dEN0eCksXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgIHN0eWxlczogKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5zdHlsZXMpIHx8IEVNUFRZX0FSUkFZLFxuICAgIGVuY2Fwc3VsYXRpb246XG4gICAgICAgIChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuZW5jYXBzdWxhdGlvbikgfHwgY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBhbmltYXRpb25zOiBudWxsLFxuICAgIHZpZXdQcm92aWRlcnM6XG4gICAgICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LnZpZXdQcm92aWRlcnMpIDogbnVsbFxuICB9O1xuICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBnaXZlbiBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgYSBgQ29tcGlsZVJlZmxlY3RvcmAuXG4gKi9cbmZ1bmN0aW9uIGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBkaXJlY3RpdmUudG9TdW1tYXJ5KCk7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIHR5cGU6IG91dHB1dEN0eC5pbXBvcnRFeHByKGRpcmVjdGl2ZS50eXBlLnJlZmVyZW5jZSksXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgdHlwZVNvdXJjZVNwYW46XG4gICAgICAgIHR5cGVTb3VyY2VTcGFuKGRpcmVjdGl2ZS5pc0NvbXBvbmVudCA/ICdDb21wb25lbnQnIDogJ0RpcmVjdGl2ZScsIGRpcmVjdGl2ZS50eXBlKSxcbiAgICBzZWxlY3RvcjogZGlyZWN0aXZlLnNlbGVjdG9yLFxuICAgIGRlcHM6IGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUudHlwZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHF1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLnF1ZXJpZXMsIG91dHB1dEN0eCksXG4gICAgbGlmZWN5Y2xlOiB7XG4gICAgICB1c2VzT25DaGFuZ2VzOlxuICAgICAgICAgIGRpcmVjdGl2ZS50eXBlLmxpZmVjeWNsZUhvb2tzLnNvbWUobGlmZWN5Y2xlID0+IGxpZmVjeWNsZSA9PSBMaWZlY3ljbGVIb29rcy5PbkNoYW5nZXMpLFxuICAgIH0sXG4gICAgaG9zdDoge1xuICAgICAgYXR0cmlidXRlczogZGlyZWN0aXZlLmhvc3RBdHRyaWJ1dGVzLFxuICAgICAgbGlzdGVuZXJzOiBzdW1tYXJ5Lmhvc3RMaXN0ZW5lcnMsXG4gICAgICBwcm9wZXJ0aWVzOiBzdW1tYXJ5Lmhvc3RQcm9wZXJ0aWVzLFxuICAgIH0sXG4gICAgaW5wdXRzOiBkaXJlY3RpdmUuaW5wdXRzLFxuICAgIG91dHB1dHM6IGRpcmVjdGl2ZS5vdXRwdXRzLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZmFsc2UsXG4gICAgZXhwb3J0QXM6IG51bGwsXG4gICAgcHJvdmlkZXJzOiBkaXJlY3RpdmUucHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoZGlyZWN0aXZlLnByb3ZpZGVycykgOiBudWxsXG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVF1ZXJ5TWV0YWRhdGFgIGludG8gYFIzUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogUjNRdWVyeU1ldGFkYXRhW10ge1xuICByZXR1cm4gcXVlcmllcy5tYXAocXVlcnkgPT4ge1xuICAgIGxldCByZWFkOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHF1ZXJ5LnJlYWQgJiYgcXVlcnkucmVhZC5pZGVudGlmaWVyKSB7XG4gICAgICByZWFkID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIocXVlcnkucmVhZC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwcm9wZXJ0eU5hbWU6IHF1ZXJ5LnByb3BlcnR5TmFtZSxcbiAgICAgIGZpcnN0OiBxdWVyeS5maXJzdCxcbiAgICAgIHByZWRpY2F0ZTogc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKHF1ZXJ5LnNlbGVjdG9ycywgb3V0cHV0Q3R4KSxcbiAgICAgIGRlc2NlbmRhbnRzOiBxdWVyeS5kZXNjZW5kYW50cywgcmVhZCxcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUXVlcnlEZWZpbml0aW9uKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBpZHg6IG51bWJlciB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBwcmVkaWNhdGUgPSBnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgY29uc3RhbnRQb29sKTtcblxuICAvLyBlLmcuIHIzLlEobnVsbCwgc29tZVByZWRpY2F0ZSwgZmFsc2UpIG9yIHIzLlEoMCwgWydkaXYnXSwgZmFsc2UpXG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgby5saXRlcmFsKGlkeCwgby5JTkZFUlJFRF9UWVBFKSxcbiAgICBwcmVkaWNhdGUsXG4gICAgby5saXRlcmFsKHF1ZXJ5LmRlc2NlbmRhbnRzKSxcbiAgXTtcblxuICBpZiAocXVlcnkucmVhZCkge1xuICAgIHBhcmFtZXRlcnMucHVzaChxdWVyeS5yZWFkKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMucXVlcnkpLmNhbGxGbihwYXJhbWV0ZXJzKTtcbn1cblxuLy8gVHVybiBhIGRpcmVjdGl2ZSBzZWxlY3RvciBpbnRvIGFuIFIzLWNvbXBhdGlibGUgc2VsZWN0b3IgZm9yIGRpcmVjdGl2ZSBkZWZcbmZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKHNlbGVjdG9yOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gYXNMaXRlcmFsKGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzZWxlY3RvcikpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgY29uc3QgYXR0cmlidXRlcyA9IG1ldGEuaG9zdC5hdHRyaWJ1dGVzO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgby5saXRlcmFsKHZhbHVlKSk7XG4gIH1cbiAgaWYgKHZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBSZXR1cm4gYSBjb250ZW50UXVlcmllcyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gbWV0YS5xdWVyaWVzLm1hcCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIG51bGwpO1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5yZWdpc3RlckNvbnRlbnRRdWVyeSlcbiAgICAgICAgICAuY2FsbEZuKFtxdWVyeURlZmluaXRpb24sIG8udmFyaWFibGUoJ2RpckluZGV4JyldKVxuICAgICAgICAgIC50b1N0bXQoKTtcbiAgICB9KTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICBjb25zdCBwYXJhbWV0ZXJzID0gW25ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSldO1xuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGwpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzUmVmcmVzaCBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgbmV3IG8uRm5QYXJhbSgncXVlcnlTdGFydEluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgXTtcbiAgICBjb25zdCBkaXJlY3RpdmVJbnN0YW5jZVZhciA9IG8udmFyaWFibGUoJ2luc3RhbmNlJyk7XG4gICAgLy8gdmFyICR0bXAkOiBhbnk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICAgIC8vIGNvbnN0ICRpbnN0YW5jZSQgPSAkcjMkLsm1bG9hZChkaXJJbmRleCk7XG4gICAgc3RhdGVtZW50cy5wdXNoKGRpcmVjdGl2ZUluc3RhbmNlVmFyLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcblxuICAgIG1ldGEucXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgbG9hZFFMQXJnID0gby52YXJpYWJsZSgncXVlcnlTdGFydEluZGV4Jyk7XG4gICAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5TGlzdCkuY2FsbEZuKFtcbiAgICAgICAgaWR4ID4gMCA/IGxvYWRRTEFyZy5wbHVzKG8ubGl0ZXJhbChpZHgpKSA6IGxvYWRRTEFyZ1xuICAgICAgXSk7XG4gICAgICBjb25zdCBhc3NpZ25Ub1RlbXBvcmFyeSA9IHRlbXBvcmFyeSgpLnNldChnZXRRdWVyeUxpc3QpO1xuICAgICAgY29uc3QgY2FsbFF1ZXJ5UmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbYXNzaWduVG9UZW1wb3JhcnldKTtcblxuICAgICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gZGlyZWN0aXZlSW5zdGFuY2VWYXIucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeSgpLnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkoKSk7XG4gICAgICBjb25zdCByZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUgPSBjYWxsUXVlcnlSZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpO1xuXG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVmcmVzaFF1ZXJ5QW5kVXBkYXRlRGlyZWN0aXZlLnRvU3RtdCgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzUmVmcmVzaGAgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzVHlwZShtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0pOiBvLlR5cGUge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsTWFwKG1hcFZhbHVlcykpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IHN0cmluZ1tdKTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVR5cGVGb3JEZWYobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgdHlwZUJhc2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLlR5cGUge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKHR5cGVCYXNlLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSksXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FzVHlwZShtZXRhLmV4cG9ydEFzKSA6IG8uTk9ORV9UWVBFLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLmlucHV0cyksXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEub3V0cHV0cyksXG4gICAgc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5xdWVyaWVzLm1hcChxID0+IHEucHJvcGVydHlOYW1lKSksXG4gIF0pKTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBxdWVyeSA9IG1ldGEudmlld1F1ZXJpZXNbaV07XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5RKDAsIHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9IGNyZWF0ZVF1ZXJ5RGVmaW5pdGlvbihxdWVyeSwgY29uc3RhbnRQb29sLCBpKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gocXVlcnlEZWZpbml0aW9uLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucVIodG1wID0gcjMuybVsb2FkKDApKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby5saXRlcmFsKGkpXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzOiAoc2xvdHM6IG51bWJlcikgPT4gbnVtYmVyKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gbWV0YS50eXBlU291cmNlU3BhbjtcblxuICBjb25zdCBkaXJlY3RpdmVTdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkobWV0YSk7XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmdzXG4gIGNvbnN0IGJpbmRpbmdzID0gYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGNvbnN0IGJpbmRpbmdDb250ZXh0ID0gby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby52YXJpYWJsZSgnZGlySW5kZXgnKV0pO1xuICBpZiAoYmluZGluZ3MpIHtcbiAgICBjb25zdCB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLFxuICAgICAgICAvKiBuZXcgbm9kZXMgYXJlIGlsbGVnYWwgaGVyZSAqLyAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBub2RlJyksIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMsXG4gICAgICAgIC8qIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmUgKi8gKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTtcblxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgbnVsbCwgYmluZGluZ0NvbnRleHQsIHZhbHVlLCAnYicsIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgICAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcbiAgICAgIHN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoUjMuZWxlbWVudFByb3BlcnR5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbEZuKFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLnZhcmlhYmxlKCdlbEluZGV4JyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKGJpbmRpbmcubmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbYmluZGluZ0V4cHIuY3VyclZhbEV4cHJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RtdCgpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoc3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oJ2VsSW5kZXgnLCBvLk5VTUJFUl9UWVBFKSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB0eXBlTmFtZSA/IGAke3R5cGVOYW1lfV9Ib3N0QmluZGluZ3NgIDogbnVsbCk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmFjdG9yeUV4dHJhU3RhdGVtZW50c0ZuKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOlxuICAgICgoaW5zdGFuY2U6IG8uRXhwcmVzc2lvbikgPT4gby5TdGF0ZW1lbnRbXSl8bnVsbCB7XG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGEpLCBtZXRhLnR5cGVTb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGggP1xuICAgICAgKGluc3RhbmNlOiBvLkV4cHJlc3Npb24pID0+IGNyZWF0ZUhvc3RMaXN0ZW5lcnMoaW5zdGFuY2UsIGV2ZW50QmluZGluZ3MsIG1ldGEpIDpcbiAgICAgIG51bGw7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RMaXN0ZW5lcnMoXG4gICAgYmluZGluZ0NvbnRleHQ6IG8uRXhwcmVzc2lvbiwgZXZlbnRCaW5kaW5nczogUGFyc2VkRXZlbnRbXSxcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5TdGF0ZW1lbnRbXSB7XG4gIHJldHVybiBldmVudEJpbmRpbmdzLm1hcChiaW5kaW5nID0+IHtcbiAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICBudWxsLCBiaW5kaW5nQ29udGV4dCwgYmluZGluZy5oYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgY29uc3QgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID1cbiAgICAgICAgdHlwZU5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHt0eXBlTmFtZX1fJHtiaW5kaW5nTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgaGFuZGxlciA9IG8uZm4oXG4gICAgICAgIFtuZXcgby5GblBhcmFtKCckZXZlbnQnLCBvLkRZTkFNSUNfVFlQRSldLCBbLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXSwgby5JTkZFUlJFRF9UWVBFLFxuICAgICAgICBudWxsLCBmdW5jdGlvbk5hbWUpO1xuICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMubGlzdGVuZXIpLmNhbGxGbihbby5saXRlcmFsKGJpbmRpbmcubmFtZSksIGhhbmRsZXJdKS50b1N0bXQoKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSB7XG4gIC8vIGNsYW5nLWZvcm1hdCBvZmZcbiAgcmV0dXJuIHtcbiAgICBob3N0QXR0cmlidXRlczogbWV0YS5ob3N0LmF0dHJpYnV0ZXMsXG4gICAgaG9zdExpc3RlbmVyczogbWV0YS5ob3N0Lmxpc3RlbmVycyxcbiAgICBob3N0UHJvcGVydGllczogbWV0YS5ob3N0LnByb3BlcnRpZXMsXG4gIH0gYXMgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnk7XG4gIC8vIGNsYW5nLWZvcm1hdCBvblxufVxuXG5cbmZ1bmN0aW9uIHR5cGVNYXBUb0V4cHJlc3Npb25NYXAoXG4gICAgbWFwOiBNYXA8c3RyaW5nLCBTdGF0aWNTeW1ib2w+LCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+IHtcbiAgLy8gQ29udmVydCBlYWNoIG1hcCBlbnRyeSBpbnRvIGFub3RoZXIgZW50cnkgd2hlcmUgdGhlIHZhbHVlIGlzIGFuIGV4cHJlc3Npb24gaW1wb3J0aW5nIHRoZSB0eXBlLlxuICBjb25zdCBlbnRyaWVzID0gQXJyYXkuZnJvbShtYXApLm1hcChcbiAgICAgIChba2V5LCB0eXBlXSk6IFtzdHJpbmcsIG8uRXhwcmVzc2lvbl0gPT4gW2tleSwgb3V0cHV0Q3R4LmltcG9ydEV4cHIodHlwZSldKTtcbiAgcmV0dXJuIG5ldyBNYXAoZW50cmllcyk7XG59XG5cbmNvbnN0IEhPU1RfUkVHX0VYUCA9IC9eKD86KD86XFxbKFteXFxdXSspXFxdKXwoPzpcXCgoW15cXCldKylcXCkpKXwoXFxAWy1cXHddKykkLztcblxuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIlxuICBQcm9wZXJ0eSA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxuXG4gIC8vIGdyb3VwIDM6IFwiQHRyaWdnZXJcIiBmcm9tIFwiQHRyaWdnZXJcIlxuICBBbmltYXRpb24gPSAzLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgYW5pbWF0aW9uczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG59IHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBhbmltYXRpb25zOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGhvc3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLlByb3BlcnR5XSAhPSBudWxsKSB7XG4gICAgICBwcm9wZXJ0aWVzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5Qcm9wZXJ0eV1dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkFuaW1hdGlvbl0gIT0gbnVsbCkge1xuICAgICAgYW5pbWF0aW9uc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQW5pbWF0aW9uXV0gPSB2YWx1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7YXR0cmlidXRlcywgbGlzdGVuZXJzLCBwcm9wZXJ0aWVzLCBhbmltYXRpb25zfTtcbn1cblxuZnVuY3Rpb24gY29tcGlsZVN0eWxlcyhzdHlsZXM6IHN0cmluZ1tdLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc3R5bGVzLm1hcChzdHlsZSA9PiB7IHJldHVybiBzaGFkb3dDc3MgIS5zaGltQ3NzVGV4dChzdHlsZSwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7IH0pO1xufVxuIl19