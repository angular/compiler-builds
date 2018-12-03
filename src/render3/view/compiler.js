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
        define("@angular/compiler/src/render3/view/compiler", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/lifecycle_reflector", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/selector", "@angular/compiler/src/shadow_css", "@angular/compiler/src/style_compiler", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/styling", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/render3/view/util"], factory);
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
    var styling_1 = require("@angular/compiler/src/render3/view/styling");
    var template_1 = require("@angular/compiler/src/render3/view/template");
    var util_3 = require("@angular/compiler/src/render3/view/util");
    var EMPTY_ARRAY = [];
    // This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
    // If there is a match, the first matching group will contain the attribute name to bind.
    var ATTR_REGEX = /attr\.([^\]]+)/;
    function getStylingPrefix(propName) {
        return propName.substring(0, 5).toLowerCase();
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
        definitionMap.set('contentQueries', createContentQueriesFunction(meta, constantPool));
        definitionMap.set('contentQueriesRefresh', createContentQueriesRefreshFunction(meta));
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
        var styleBuilder = new styling_1.StylingBuilder(elVarExp, contextVarExp);
        var allOtherAttributes = {};
        var attrNames = Object.getOwnPropertyNames(meta.host.attributes);
        for (var i = 0; i < attrNames.length; i++) {
            var attr = attrNames[i];
            var value = meta.host.attributes[attr];
            switch (attr) {
                // style attributes are handled in the styling context
                case 'style':
                    styleBuilder.registerStyleAttr(value);
                    break;
                // class attributes are handled in the styling context
                case 'class':
                    styleBuilder.registerClassAttr(value);
                    break;
                default:
                    allOtherAttributes[attr] = value;
                    break;
            }
        }
        // e.g. `attributes: ['role', 'listbox']`
        definitionMap.set('attributes', createHostAttributesArray(allOtherAttributes));
        // e.g. `hostBindings: (rf, ctx, elIndex) => { ... }
        definitionMap.set('hostBindings', createHostBindingsFunction(meta, elVarExp, contextVarExp, styleBuilder, bindingParser, constantPool, hostVarsCount));
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
        if (meta.viewQueries.length) {
            definitionMap.set('viewQuery', createViewQueriesFunction(meta, constantPool));
        }
        // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
        var templateTypeName = meta.name;
        var templateName = templateTypeName ? templateTypeName + "_Template" : null;
        var directivesUsed = new Set();
        var pipesUsed = new Set();
        var template = meta.template;
        var templateBuilder = new template_1.TemplateDefinitionBuilder(constantPool, template_1.BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, meta.viewQueries, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, r3_identifiers_1.Identifiers.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
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
            }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
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
        // e.g. r3.query(null, somePredicate, false) or r3.query(0, ['div'], false)
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
    function createHostAttributesArray(attributes) {
        var e_2, _a;
        var values = [];
        try {
            for (var _b = tslib_1.__values(Object.getOwnPropertyNames(attributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = attributes[key];
                values.push(o.literal(key), o.literal(value));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
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
    function createHostBindingsFunction(meta, elVarExp, bindingContext, styleBuilder, bindingParser, constantPool, hostVarsCount) {
        var e_3, _a;
        var createStatements = [];
        var updateStatements = [];
        var totalHostVarsCount = hostVarsCount;
        var hostBindingSourceSpan = meta.typeSourceSpan;
        var directiveSummary = metadataAsSummary(meta);
        // Calculate host event bindings
        var eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
        if (eventBindings && eventBindings.length) {
            var listeners = createHostListeners(bindingContext, eventBindings, meta);
            createStatements.push.apply(createStatements, tslib_1.__spread(listeners));
        }
        // Calculate the host property bindings
        var bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
        var bindingFn = function (implicit, value) {
            return expression_converter_1.convertPropertyBinding(null, implicit, value, 'b', expression_converter_1.BindingForm.TrySimple, function () { return util_1.error('Unexpected interpolation'); });
        };
        if (bindings) {
            var hostVarsCountFn = function (numSlots) {
                totalHostVarsCount += numSlots;
                return hostVarsCount;
            };
            var valueConverter = new template_1.ValueConverter(constantPool, 
            /* new nodes are illegal here */ function () { return util_1.error('Unexpected node'); }, hostVarsCountFn, 
            /* pipes are illegal here */ function () { return util_1.error('Unexpected pipe'); });
            try {
                for (var bindings_1 = tslib_1.__values(bindings), bindings_1_1 = bindings_1.next(); !bindings_1_1.done; bindings_1_1 = bindings_1.next()) {
                    var binding = bindings_1_1.value;
                    var name_1 = binding.name;
                    var stylePrefix = getStylingPrefix(name_1);
                    if (stylePrefix === 'style') {
                        var _b = parseNamedProperty(name_1), propertyName = _b.propertyName, unit = _b.unit;
                        styleBuilder.registerStyleInput(propertyName, binding.expression, unit, binding.sourceSpan);
                    }
                    else if (stylePrefix === 'class') {
                        styleBuilder.registerClassInput(parseNamedProperty(name_1).propertyName, binding.expression, binding.sourceSpan);
                    }
                    else {
                        // resolve literal arrays and literal objects
                        var value = binding.expression.visit(valueConverter);
                        var bindingExpr = bindingFn(bindingContext, value);
                        var _c = getBindingNameAndInstruction(name_1), bindingName = _c.bindingName, instruction = _c.instruction;
                        updateStatements.push.apply(updateStatements, tslib_1.__spread(bindingExpr.stmts));
                        updateStatements.push(o.importExpr(instruction)
                            .callFn([
                            elVarExp,
                            o.literal(bindingName),
                            o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([bindingExpr.currValExpr]),
                        ])
                            .toStmt());
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (bindings_1_1 && !bindings_1_1.done && (_a = bindings_1.return)) _a.call(bindings_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
            if (styleBuilder.hasBindingsOrInitialValues) {
                var createInstruction = styleBuilder.buildCreateLevelInstruction(null, constantPool);
                if (createInstruction) {
                    var createStmt = createStylingStmt(createInstruction, bindingContext, bindingFn);
                    createStatements.push(createStmt);
                }
                styleBuilder.buildUpdateLevelInstructions(valueConverter).forEach(function (instruction) {
                    var updateStmt = createStylingStmt(instruction, bindingContext, bindingFn);
                    updateStatements.push(updateStmt);
                });
            }
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
    function createStylingStmt(instruction, bindingContext, bindingFn) {
        var params = instruction.buildParams(function (value) { return bindingFn(bindingContext, value).currValExpr; });
        return o.importExpr(instruction.reference, null, instruction.sourceSpan)
            .callFn(params, instruction.sourceSpan)
            .toStmt();
    }
    function getBindingNameAndInstruction(bindingName) {
        var instruction;
        // Check to see if this is an attr binding or a property binding
        var attrMatches = bindingName.match(ATTR_REGEX);
        if (attrMatches) {
            bindingName = attrMatches[1];
            instruction = r3_identifiers_1.Identifiers.elementAttribute;
        }
        else {
            instruction = r3_identifiers_1.Identifiers.elementProperty;
        }
        return { bindingName: bindingName, instruction: instruction };
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
            else if (matches[1 /* Binding */] != null) {
                properties[matches[1 /* Binding */]] = value;
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
    function parseNamedProperty(name) {
        var unit = '';
        var propertyName = '';
        var index = name.indexOf('.');
        if (index > 0) {
            var unitIndex = name.lastIndexOf('.');
            if (unitIndex !== index) {
                unit = name.substring(unitIndex + 1, name.length);
                propertyName = name.substring(index + 1, unitIndex);
            }
            else {
                propertyName = name.substring(index + 1, name.length);
            }
        }
        return { propertyName: propertyName, unit: unit };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUF5SztJQUV6SyxpR0FBbUg7SUFFbkgsaURBQW1DO0lBRW5DLGlGQUF5RDtJQUN6RCwyREFBNkM7SUFDN0MsK0RBQWdEO0lBQ2hELDJEQUE0RDtJQUM1RCwrREFBMkM7SUFDM0MsdUVBQTZEO0lBRTdELG1EQUFnRDtJQUNoRCx1RUFBcUY7SUFDckYsK0VBQW9EO0lBRXBELDJEQUEyQztJQUczQyxzRUFBNkQ7SUFDN0Qsd0VBQTBHO0lBQzFHLGdFQUF5TDtJQUV6TCxJQUFNLFdBQVcsR0FBVSxFQUFFLENBQUM7SUFFOUIsNkZBQTZGO0lBQzdGLHlGQUF5RjtJQUN6RixJQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQztJQUVwQyxTQUFTLGdCQUFnQixDQUFDLFFBQWdCO1FBQ3hDLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUVELFNBQVMsbUJBQW1CLENBQ3hCLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7UUFDOUIsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUFFLENBQUM7UUFFMUMsMkJBQTJCO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVyQywwQ0FBMEM7UUFDMUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFHdkUsK0RBQStEO1FBQy9ELElBQU0sTUFBTSxHQUFHLG1DQUFzQixDQUFDO1lB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QUM7YUFDdkQ7U0FDRjtRQUNELE9BQU8sRUFBQyxZQUFZLGNBQUEsRUFBRSxJQUFJLE1BQUEsRUFBQyxDQUFDO0lBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi8uLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVRdWVyeU1ldGFkYXRhLCBDb21waWxlVG9rZW5NZXRhZGF0YSwgaWRlbnRpZmllck5hbWUsIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uLy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7dHlwZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHt0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1IzQ29tcG9uZW50RGVmLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZURlZiwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge1N0eWxpbmdCdWlsZGVyLCBTdHlsaW5nSW5zdHJ1Y3Rpb259IGZyb20gJy4vc3R5bGluZyc7XG5pbXBvcnQge0JpbmRpbmdTY29wZSwgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgVmFsdWVDb252ZXJ0ZXIsIHJlbmRlckZsYWdDaGVja0lmU3RtdH0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgRGVmaW5pdGlvbk1hcCwgUkVOREVSX0ZMQUdTLCBURU1QT1JBUllfTkFNRSwgYXNMaXRlcmFsLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbCwgZ2V0UXVlcnlQcmVkaWNhdGUsIG1hcFRvRXhwcmVzc2lvbiwgdGVtcG9yYXJ5QWxsb2NhdG9yfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9BUlJBWTogYW55W10gPSBbXTtcblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cbmZ1bmN0aW9uIGdldFN0eWxpbmdQcmVmaXgocHJvcE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBwcm9wTmFtZS5zdWJzdHJpbmcoMCwgNSkudG9Mb3dlckNhc2UoKTtcbn1cblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge2RlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W119IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKG1ldGEuc2VsZWN0b3IpKTtcblxuXG4gIC8vIGUuZy4gYGZhY3Rvcnk6ICgpID0+IG5ldyBNeUFwcChkaXJlY3RpdmVJbmplY3QoRWxlbWVudFJlZikpYFxuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LFxuICB9KTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZmFjdG9yeSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnY29udGVudFF1ZXJpZXNSZWZyZXNoJywgY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YSkpO1xuXG4gIC8vIEluaXRpYWxpemUgaG9zdFZhcnNDb3VudCB0byBudW1iZXIgb2YgYm91bmQgaG9zdCBwcm9wZXJ0aWVzIChpbnRlcnBvbGF0aW9ucyBpbGxlZ2FsKSxcbiAgLy8gZXhjZXB0ICdzdHlsZScgYW5kICdjbGFzcycgcHJvcGVydGllcywgc2luY2UgdGhleSBzaG91bGQgKm5vdCogYWxsb2NhdGUgaG9zdCB2YXIgc2xvdHNcbiAgY29uc3QgaG9zdFZhcnNDb3VudCA9IE9iamVjdC5rZXlzKG1ldGEuaG9zdC5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIobmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBnZXRTdHlsaW5nUHJlZml4KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWZpeCAhPT0gJ3N0eWxlJyAmJiBwcmVmaXggIT09ICdjbGFzcyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubGVuZ3RoO1xuXG4gIGNvbnN0IGVsVmFyRXhwID0gby52YXJpYWJsZSgnZWxJbmRleCcpO1xuICBjb25zdCBjb250ZXh0VmFyRXhwID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICBjb25zdCBzdHlsZUJ1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIoZWxWYXJFeHAsIGNvbnRleHRWYXJFeHApO1xuXG4gIGNvbnN0IGFsbE90aGVyQXR0cmlidXRlczogYW55ID0ge307XG4gIGNvbnN0IGF0dHJOYW1lcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG1ldGEuaG9zdC5hdHRyaWJ1dGVzKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRyTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhdHRyID0gYXR0ck5hbWVzW2ldO1xuICAgIGNvbnN0IHZhbHVlID0gbWV0YS5ob3N0LmF0dHJpYnV0ZXNbYXR0cl07XG4gICAgc3dpdGNoIChhdHRyKSB7XG4gICAgICAvLyBzdHlsZSBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkIGluIHRoZSBzdHlsaW5nIGNvbnRleHRcbiAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBjbGFzcyBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkIGluIHRoZSBzdHlsaW5nIGNvbnRleHRcbiAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhbGxPdGhlckF0dHJpYnV0ZXNbYXR0cl0gPSB2YWx1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gZS5nLiBgYXR0cmlidXRlczogWydyb2xlJywgJ2xpc3Rib3gnXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2F0dHJpYnV0ZXMnLCBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KGFsbE90aGVyQXR0cmlidXRlcykpO1xuXG4gIC8vIGUuZy4gYGhvc3RCaW5kaW5nczogKHJmLCBjdHgsIGVsSW5kZXgpID0+IHsgLi4uIH1cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnaG9zdEJpbmRpbmdzJyxcbiAgICAgIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgIG1ldGEsIGVsVmFyRXhwLCBjb250ZXh0VmFyRXhwLCBzdHlsZUJ1aWxkZXIsIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCwgaG9zdFZhcnNDb3VudCkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEuaW5wdXRzKSk7XG5cbiAgLy8gZS5nICdvdXRwdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIG8ubGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICByZXR1cm4ge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBBZGQgZmVhdHVyZXMgdG8gdGhlIGRlZmluaXRpb24gbWFwLlxuICovXG5mdW5jdGlvbiBhZGRGZWF0dXJlcyhcbiAgICBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHwgUjNDb21wb25lbnRNZXRhZGF0YSkge1xuICAvLyBlLmcuIGBmZWF0dXJlczogW05nT25DaGFuZ2VzRmVhdHVyZV1gXG4gIGNvbnN0IGZlYXR1cmVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGNvbnN0IHByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICBjb25zdCB2aWV3UHJvdmlkZXJzID0gKG1ldGEgYXMgUjNDb21wb25lbnRNZXRhZGF0YSkudmlld1Byb3ZpZGVycztcbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Jbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLk5nT25DaGFuZ2VzRmVhdHVyZSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNEaXJlY3RpdmVEZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IChtZXRhLnNlbGVjdG9yIHx8ICcnKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkRpcmVjdGl2ZURlZldpdGhNZXRhKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0Jhc2VSZWZNZXRhRGF0YSB7XG4gIGlucHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBbc3RyaW5nLCBzdHJpbmddfTtcbiAgb3V0cHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBiYXNlIGRlZmluaXRpb24gZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB7QGxpbmsgUjNCYXNlUmVmTWV0YWRhdGF9XG4gKiBAcGFyYW0gbWV0YSB0aGUgbWV0YWRhdGEgdXNlZCBmb3IgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQmFzZURlZkZyb21NZXRhZGF0YShtZXRhOiBSM0Jhc2VSZWZNZXRhRGF0YSkge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcbiAgaWYgKG1ldGEuaW5wdXRzKSB7XG4gICAgY29uc3QgaW5wdXRzID0gbWV0YS5pbnB1dHM7XG4gICAgY29uc3QgaW5wdXRzTWFwID0gT2JqZWN0LmtleXMoaW5wdXRzKS5tYXAoa2V5ID0+IHtcbiAgICAgIGNvbnN0IHYgPSBpbnB1dHNba2V5XTtcbiAgICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheSh2KSA/IG8ubGl0ZXJhbEFycih2Lm1hcCh2eCA9PiBvLmxpdGVyYWwodngpKSkgOiBvLmxpdGVyYWwodik7XG4gICAgICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xuICAgIH0pO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBvLmxpdGVyYWxNYXAoaW5wdXRzTWFwKSk7XG4gIH1cbiAgaWYgKG1ldGEub3V0cHV0cykge1xuICAgIGNvbnN0IG91dHB1dHMgPSBtZXRhLm91dHB1dHM7XG4gICAgY29uc3Qgb3V0cHV0c01hcCA9IE9iamVjdC5rZXlzKG91dHB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBvLmxpdGVyYWwob3V0cHV0c1trZXldKTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBvLmxpdGVyYWxNYXAob3V0cHV0c01hcCkpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVCYXNlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkJhc2VEZWYpKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21wb25lbnREZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvckF0dHJpYnV0ZXMubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gdmFsdWUgIT0gbnVsbCA/IG8ubGl0ZXJhbCh2YWx1ZSkgOiBvLmxpdGVyYWwodW5kZWZpbmVkKSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAvKiBmb3JjZVNoYXJlZCAqLyB0cnVlKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIENTUyBtYXRjaGVyIHRoYXQgcmVjb2duaXplIGRpcmVjdGl2ZVxuICBsZXQgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwgPSBudWxsO1xuXG4gIGlmIChtZXRhLmRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgZm9yIChjb25zdCB7c2VsZWN0b3IsIGV4cHJlc3Npb259IG9mIG1ldGEuZGlyZWN0aXZlcykge1xuICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvciksIGV4cHJlc3Npb24pO1xuICAgIH1cbiAgICBkaXJlY3RpdmVNYXRjaGVyID0gbWF0Y2hlcjtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcnknLCBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKG1ldGEsIGNvbnN0YW50UG9vbCkpO1xuICB9XG5cbiAgLy8gZS5nLiBgdGVtcGxhdGU6IGZ1bmN0aW9uIE15Q29tcG9uZW50X1RlbXBsYXRlKF9jdHgsIF9jbSkgey4uLn1gXG4gIGNvbnN0IHRlbXBsYXRlVHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlVHlwZU5hbWUgPyBgJHt0ZW1wbGF0ZVR5cGVOYW1lfV9UZW1wbGF0ZWAgOiBudWxsO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IHBpcGVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuXG4gIGNvbnN0IHRlbXBsYXRlID0gbWV0YS50ZW1wbGF0ZTtcbiAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICBjb25zdGFudFBvb2wsIEJpbmRpbmdTY29wZS5ST09UX1NDT1BFLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICBtZXRhLnZpZXdRdWVyaWVzLCBkaXJlY3RpdmVNYXRjaGVyLCBkaXJlY3RpdmVzVXNlZCwgbWV0YS5waXBlcywgcGlwZXNVc2VkLCBSMy5uYW1lc3BhY2VIVE1MLFxuICAgICAgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMpO1xuXG4gIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIHRlbXBsYXRlLm5vZGVzLCBbXSwgdGVtcGxhdGUuaGFzTmdDb250ZW50LCB0ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMpO1xuXG4gIC8vIGUuZy4gYGNvbnN0czogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgLy8gZS5nLiBgdmFyczogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG5cbiAgLy8gZS5nLiBgZGlyZWN0aXZlczogW015RGlyZWN0aXZlXWBcbiAgaWYgKGRpcmVjdGl2ZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgZGlyZWN0aXZlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKGRpcmVjdGl2ZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgZGlyZWN0aXZlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGRpcmVjdGl2ZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGlyZWN0aXZlcycsIGRpcmVjdGl2ZXNFeHByKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHBpcGVzOiBbTXlQaXBlXWBcbiAgaWYgKHBpcGVzVXNlZC5zaXplKSB7XG4gICAgbGV0IHBpcGVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20ocGlwZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgcGlwZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChwaXBlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIHBpcGVzRXhwcik7XG4gIH1cblxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBudWxsKSB7XG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZDtcbiAgfVxuXG4gIC8vIGUuZy4gYHN0eWxlczogW3N0cjEsIHN0cjJdYFxuICBpZiAobWV0YS5zdHlsZXMgJiYgbWV0YS5zdHlsZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc3R5bGVWYWx1ZXMgPSBtZXRhLmVuY2Fwc3VsYXRpb24gPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCA/XG4gICAgICAgIGNvbXBpbGVTdHlsZXMobWV0YS5zdHlsZXMsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKSA6XG4gICAgICAgIG1ldGEuc3R5bGVzO1xuICAgIGNvbnN0IHN0cmluZ3MgPSBzdHlsZVZhbHVlcy5tYXAoc3RyID0+IG8ubGl0ZXJhbChzdHIpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgby5saXRlcmFsQXJyKHN0cmluZ3MpKTtcbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb25zOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbnMnLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkNvbXBvbmVudERlZldpdGhNZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7XG4gICAgICBub2RlczogcmVuZGVyM0FzdC5ub2RlcyxcbiAgICAgIGhhc05nQ29udGVudDogcmVuZGVyM0FzdC5oYXNOZ0NvbnRlbnQsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHJlbmRlcjNBc3QubmdDb250ZW50U2VsZWN0b3JzLFxuICAgIH0sXG4gICAgZGlyZWN0aXZlczogW10sXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgIHN0eWxlczogKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5zdHlsZXMpIHx8IEVNUFRZX0FSUkFZLFxuICAgIGVuY2Fwc3VsYXRpb246XG4gICAgICAgIChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuZW5jYXBzdWxhdGlvbikgfHwgY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBhbmltYXRpb25zOiBudWxsLFxuICAgIHZpZXdQcm92aWRlcnM6XG4gICAgICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LnZpZXdQcm92aWRlcnMpIDogbnVsbCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICB9O1xuICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBnaXZlbiBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgYSBgQ29tcGlsZVJlZmxlY3RvcmAuXG4gKi9cbmZ1bmN0aW9uIGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBkaXJlY3RpdmUudG9TdW1tYXJ5KCk7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIHR5cGU6IG91dHB1dEN0eC5pbXBvcnRFeHByKGRpcmVjdGl2ZS50eXBlLnJlZmVyZW5jZSksXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgdHlwZVNvdXJjZVNwYW46XG4gICAgICAgIHR5cGVTb3VyY2VTcGFuKGRpcmVjdGl2ZS5pc0NvbXBvbmVudCA/ICdDb21wb25lbnQnIDogJ0RpcmVjdGl2ZScsIGRpcmVjdGl2ZS50eXBlKSxcbiAgICBzZWxlY3RvcjogZGlyZWN0aXZlLnNlbGVjdG9yLFxuICAgIGRlcHM6IGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUudHlwZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHF1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLnF1ZXJpZXMsIG91dHB1dEN0eCksXG4gICAgbGlmZWN5Y2xlOiB7XG4gICAgICB1c2VzT25DaGFuZ2VzOlxuICAgICAgICAgIGRpcmVjdGl2ZS50eXBlLmxpZmVjeWNsZUhvb2tzLnNvbWUobGlmZWN5Y2xlID0+IGxpZmVjeWNsZSA9PSBMaWZlY3ljbGVIb29rcy5PbkNoYW5nZXMpLFxuICAgIH0sXG4gICAgaG9zdDoge1xuICAgICAgYXR0cmlidXRlczogZGlyZWN0aXZlLmhvc3RBdHRyaWJ1dGVzLFxuICAgICAgbGlzdGVuZXJzOiBzdW1tYXJ5Lmhvc3RMaXN0ZW5lcnMsXG4gICAgICBwcm9wZXJ0aWVzOiBzdW1tYXJ5Lmhvc3RQcm9wZXJ0aWVzLFxuICAgIH0sXG4gICAgaW5wdXRzOiBkaXJlY3RpdmUuaW5wdXRzLFxuICAgIG91dHB1dHM6IGRpcmVjdGl2ZS5vdXRwdXRzLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZmFsc2UsXG4gICAgZXhwb3J0QXM6IG51bGwsXG4gICAgcHJvdmlkZXJzOiBkaXJlY3RpdmUucHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoZGlyZWN0aXZlLnByb3ZpZGVycykgOiBudWxsXG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVF1ZXJ5TWV0YWRhdGFgIGludG8gYFIzUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogUjNRdWVyeU1ldGFkYXRhW10ge1xuICByZXR1cm4gcXVlcmllcy5tYXAocXVlcnkgPT4ge1xuICAgIGxldCByZWFkOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHF1ZXJ5LnJlYWQgJiYgcXVlcnkucmVhZC5pZGVudGlmaWVyKSB7XG4gICAgICByZWFkID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIocXVlcnkucmVhZC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwcm9wZXJ0eU5hbWU6IHF1ZXJ5LnByb3BlcnR5TmFtZSxcbiAgICAgIGZpcnN0OiBxdWVyeS5maXJzdCxcbiAgICAgIHByZWRpY2F0ZTogc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKHF1ZXJ5LnNlbGVjdG9ycywgb3V0cHV0Q3R4KSxcbiAgICAgIGRlc2NlbmRhbnRzOiBxdWVyeS5kZXNjZW5kYW50cywgcmVhZCxcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUXVlcnlEZWZpbml0aW9uKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBpZHg6IG51bWJlciB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBwcmVkaWNhdGUgPSBnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgY29uc3RhbnRQb29sKTtcblxuICAvLyBlLmcuIHIzLnF1ZXJ5KG51bGwsIHNvbWVQcmVkaWNhdGUsIGZhbHNlKSBvciByMy5xdWVyeSgwLCBbJ2RpdiddLCBmYWxzZSlcbiAgY29uc3QgcGFyYW1ldGVycyA9IFtcbiAgICBvLmxpdGVyYWwoaWR4LCBvLklORkVSUkVEX1RZUEUpLFxuICAgIHByZWRpY2F0ZSxcbiAgICBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMpLFxuICBdO1xuXG4gIGlmIChxdWVyeS5yZWFkKSB7XG4gICAgcGFyYW1ldGVycy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5xdWVyeSkuY2FsbEZuKHBhcmFtZXRlcnMpO1xufVxuXG4vLyBUdXJuIGEgZGlyZWN0aXZlIHNlbGVjdG9yIGludG8gYW4gUjMtY29tcGF0aWJsZSBzZWxlY3RvciBmb3IgZGlyZWN0aXZlIGRlZlxuZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlU2VsZWN0b3Ioc2VsZWN0b3I6IHN0cmluZyB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gYXNMaXRlcmFsKGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzZWxlY3RvcikpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KGF0dHJpYnV0ZXM6IGFueSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgby5saXRlcmFsKHZhbHVlKSk7XG4gIH1cbiAgaWYgKHZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBSZXR1cm4gYSBjb250ZW50UXVlcmllcyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gbWV0YS5xdWVyaWVzLm1hcCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIG51bGwpO1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5yZWdpc3RlckNvbnRlbnRRdWVyeSlcbiAgICAgICAgICAuY2FsbEZuKFtxdWVyeURlZmluaXRpb24sIG8udmFyaWFibGUoJ2RpckluZGV4JyldKVxuICAgICAgICAgIC50b1N0bXQoKTtcbiAgICB9KTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICBjb25zdCBwYXJhbWV0ZXJzID0gW25ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSldO1xuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGwpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzUmVmcmVzaCBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgbmV3IG8uRm5QYXJhbSgncXVlcnlTdGFydEluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgXTtcbiAgICBjb25zdCBkaXJlY3RpdmVJbnN0YW5jZVZhciA9IG8udmFyaWFibGUoJ2luc3RhbmNlJyk7XG4gICAgLy8gdmFyICR0bXAkOiBhbnk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICAgIC8vIGNvbnN0ICRpbnN0YW5jZSQgPSAkcjMkLsm1bG9hZChkaXJJbmRleCk7XG4gICAgc3RhdGVtZW50cy5wdXNoKGRpcmVjdGl2ZUluc3RhbmNlVmFyLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcblxuICAgIG1ldGEucXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgbG9hZFFMQXJnID0gby52YXJpYWJsZSgncXVlcnlTdGFydEluZGV4Jyk7XG4gICAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5TGlzdCkuY2FsbEZuKFtcbiAgICAgICAgaWR4ID4gMCA/IGxvYWRRTEFyZy5wbHVzKG8ubGl0ZXJhbChpZHgpKSA6IGxvYWRRTEFyZ1xuICAgICAgXSk7XG4gICAgICBjb25zdCBhc3NpZ25Ub1RlbXBvcmFyeSA9IHRlbXBvcmFyeSgpLnNldChnZXRRdWVyeUxpc3QpO1xuICAgICAgY29uc3QgY2FsbFF1ZXJ5UmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbYXNzaWduVG9UZW1wb3JhcnldKTtcblxuICAgICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gZGlyZWN0aXZlSW5zdGFuY2VWYXIucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeSgpLnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkoKSk7XG4gICAgICBjb25zdCByZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUgPSBjYWxsUXVlcnlSZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpO1xuXG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVmcmVzaFF1ZXJ5QW5kVXBkYXRlRGlyZWN0aXZlLnRvU3RtdCgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzUmVmcmVzaGAgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzVHlwZShtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0pOiBvLlR5cGUge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsTWFwKG1hcFZhbHVlcykpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IHN0cmluZ1tdKTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVR5cGVGb3JEZWYobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgdHlwZUJhc2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLlR5cGUge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKHR5cGVCYXNlLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSksXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FzVHlwZShtZXRhLmV4cG9ydEFzKSA6IG8uTk9ORV9UWVBFLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLmlucHV0cyksXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEub3V0cHV0cyksXG4gICAgc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5xdWVyaWVzLm1hcChxID0+IHEucHJvcGVydHlOYW1lKSksXG4gIF0pKTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBxdWVyeSA9IG1ldGEudmlld1F1ZXJpZXNbaV07XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5RKDAsIHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9IGNyZWF0ZVF1ZXJ5RGVmaW5pdGlvbihxdWVyeSwgY29uc3RhbnRQb29sLCBpKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gocXVlcnlEZWZpbml0aW9uLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucVIodG1wID0gcjMuybVsb2FkKDApKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby5saXRlcmFsKGkpXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBlbFZhckV4cDogby5SZWFkVmFyRXhwciwgYmluZGluZ0NvbnRleHQ6IG8uUmVhZFZhckV4cHIsXG4gICAgc3R5bGVCdWlsZGVyOiBTdHlsaW5nQnVpbGRlciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgaG9zdFZhcnNDb3VudDogbnVtYmVyKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gaG9zdFZhcnNDb3VudDtcbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gbWV0YS50eXBlU291cmNlU3BhbjtcbiAgY29uc3QgZGlyZWN0aXZlU3VtbWFyeSA9IG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGEpO1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gY3JlYXRlSG9zdExpc3RlbmVycyhiaW5kaW5nQ29udGV4dCwgZXZlbnRCaW5kaW5ncywgbWV0YSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKC4uLmxpc3RlbmVycyk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZ3NcbiAgY29uc3QgYmluZGluZ3MgPSBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcblxuICBjb25zdCBiaW5kaW5nRm4gPSAoaW1wbGljaXQ6IGFueSwgdmFsdWU6IEFTVCkgPT4ge1xuICAgIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICBudWxsLCBpbXBsaWNpdCwgdmFsdWUsICdiJywgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICB9O1xuXG4gIGlmIChiaW5kaW5ncykge1xuICAgIGNvbnN0IGhvc3RWYXJzQ291bnRGbiA9IChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBudW1TbG90cztcbiAgICAgIHJldHVybiBob3N0VmFyc0NvdW50O1xuICAgIH07XG4gICAgY29uc3QgdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCxcbiAgICAgICAgLyogbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmUgKi8gKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgIC8qIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmUgKi8gKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTtcblxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgY29uc3QgbmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgICAgIGNvbnN0IHN0eWxlUHJlZml4ID0gZ2V0U3R5bGluZ1ByZWZpeChuYW1lKTtcbiAgICAgIGlmIChzdHlsZVByZWZpeCA9PT0gJ3N0eWxlJykge1xuICAgICAgICBjb25zdCB7cHJvcGVydHlOYW1lLCB1bml0fSA9IHBhcnNlTmFtZWRQcm9wZXJ0eShuYW1lKTtcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyU3R5bGVJbnB1dChwcm9wZXJ0eU5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgdW5pdCwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSBpZiAoc3R5bGVQcmVmaXggPT09ICdjbGFzcycpIHtcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NJbnB1dChcbiAgICAgICAgICAgIHBhcnNlTmFtZWRQcm9wZXJ0eShuYW1lKS5wcm9wZXJ0eU5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlc29sdmUgbGl0ZXJhbCBhcnJheXMgYW5kIGxpdGVyYWwgb2JqZWN0c1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3Qge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbn0gPSBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKG5hbWUpO1xuXG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5zdG10cyk7XG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbFZhckV4cCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChiaW5kaW5nTmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RtdCgpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3R5bGVCdWlsZGVyLmhhc0JpbmRpbmdzT3JJbml0aWFsVmFsdWVzKSB7XG4gICAgICBjb25zdCBjcmVhdGVJbnN0cnVjdGlvbiA9IHN0eWxlQnVpbGRlci5idWlsZENyZWF0ZUxldmVsSW5zdHJ1Y3Rpb24obnVsbCwgY29uc3RhbnRQb29sKTtcbiAgICAgIGlmIChjcmVhdGVJbnN0cnVjdGlvbikge1xuICAgICAgICBjb25zdCBjcmVhdGVTdG10ID0gY3JlYXRlU3R5bGluZ1N0bXQoY3JlYXRlSW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pO1xuICAgICAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goY3JlYXRlU3RtdCk7XG4gICAgICB9XG5cbiAgICAgIHN0eWxlQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHZhbHVlQ29udmVydGVyKS5mb3JFYWNoKGluc3RydWN0aW9uID0+IHtcbiAgICAgICAgY29uc3QgdXBkYXRlU3RtdCA9IGNyZWF0ZVN0eWxpbmdTdG10KGluc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dCwgYmluZGluZ0ZuKTtcbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHVwZGF0ZVN0bXQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRvdGFsSG9zdFZhcnNDb3VudCkge1xuICAgIGNyZWF0ZVN0YXRlbWVudHMudW5zaGlmdChcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLmFsbG9jSG9zdFZhcnMpLmNhbGxGbihbby5saXRlcmFsKHRvdGFsSG9zdFZhcnNDb3VudCldKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwIHx8IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGhvc3RCaW5kaW5nc0ZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oZWxWYXJFeHAubmFtZSAhLCBvLk5VTUJFUl9UWVBFKVxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3R5bGluZ1N0bXQoXG4gICAgaW5zdHJ1Y3Rpb246IFN0eWxpbmdJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQ6IGFueSwgYmluZGluZ0ZuOiBGdW5jdGlvbik6IG8uU3RhdGVtZW50IHtcbiAgY29uc3QgcGFyYW1zID0gaW5zdHJ1Y3Rpb24uYnVpbGRQYXJhbXModmFsdWUgPT4gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSkuY3VyclZhbEV4cHIpO1xuICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uLnJlZmVyZW5jZSwgbnVsbCwgaW5zdHJ1Y3Rpb24uc291cmNlU3BhbilcbiAgICAgIC5jYWxsRm4ocGFyYW1zLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLnRvU3RtdCgpO1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmdOYW1lOiBzdHJpbmcpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZX0ge1xuICBsZXQgaW5zdHJ1Y3Rpb24gITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50QXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGluc3RydWN0aW9uID0gUjMuZWxlbWVudFByb3BlcnR5O1xuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb259O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKFxuICAgIGJpbmRpbmdDb250ZXh0OiBvLkV4cHJlc3Npb24sIGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uU3RhdGVtZW50W10ge1xuICByZXR1cm4gZXZlbnRCaW5kaW5ncy5tYXAoYmluZGluZyA9PiB7XG4gICAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgICAgbnVsbCwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmcuaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgIGNvbnN0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9XG4gICAgICAgIHR5cGVOYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7dHlwZU5hbWV9XyR7YmluZGluZ05hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgIGNvbnN0IGhhbmRsZXIgPSBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgWy4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10c10sIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgbnVsbCwgZnVuY3Rpb25OYW1lKTtcbiAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmxpc3RlbmVyKS5jYWxsRm4oW28ubGl0ZXJhbChiaW5kaW5nLm5hbWUpLCBoYW5kbGVyXSkudG9TdG10KCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgaG9zdEF0dHJpYnV0ZXM6IG1ldGEuaG9zdC5hdHRyaWJ1dGVzLFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEuaG9zdC5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEuaG9zdC5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/Oig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSl8KFxcQFstXFx3XSspJC87XG5cbi8vIFJlcHJlc2VudHMgdGhlIGdyb3VwcyBpbiB0aGUgYWJvdmUgcmVnZXguXG5jb25zdCBlbnVtIEhvc3RCaW5kaW5nR3JvdXAge1xuICAvLyBncm91cCAxOiBcInByb3BcIiBmcm9tIFwiW3Byb3BdXCIsIG9yIFwiYXR0ci5yb2xlXCIgZnJvbSBcIlthdHRyLnJvbGVdXCJcbiAgQmluZGluZyA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxuXG4gIC8vIGdyb3VwIDM6IFwiQHRyaWdnZXJcIiBmcm9tIFwiQHRyaWdnZXJcIlxuICBBbmltYXRpb24gPSAzLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgYW5pbWF0aW9uczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG59IHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBhbmltYXRpb25zOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGhvc3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIHByb3BlcnRpZXNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XSAhPSBudWxsKSB7XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5BbmltYXRpb25dICE9IG51bGwpIHtcbiAgICAgIGFuaW1hdGlvbnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkFuaW1hdGlvbl1dID0gdmFsdWU7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgYW5pbWF0aW9uc307XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVTdHlsZXMoc3R5bGVzOiBzdHJpbmdbXSwgc2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcbiAgcmV0dXJuIHN0eWxlcy5tYXAoc3R5bGUgPT4geyByZXR1cm4gc2hhZG93Q3NzICEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpOyB9KTtcbn1cblxuZnVuY3Rpb24gcGFyc2VOYW1lZFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IHtwcm9wZXJ0eU5hbWU6IHN0cmluZywgdW5pdDogc3RyaW5nfSB7XG4gIGxldCB1bml0ID0gJyc7XG4gIGxldCBwcm9wZXJ0eU5hbWUgPSAnJztcbiAgY29uc3QgaW5kZXggPSBuYW1lLmluZGV4T2YoJy4nKTtcbiAgaWYgKGluZGV4ID4gMCkge1xuICAgIGNvbnN0IHVuaXRJbmRleCA9IG5hbWUubGFzdEluZGV4T2YoJy4nKTtcbiAgICBpZiAodW5pdEluZGV4ICE9PSBpbmRleCkge1xuICAgICAgdW5pdCA9IG5hbWUuc3Vic3RyaW5nKHVuaXRJbmRleCArIDEsIG5hbWUubGVuZ3RoKTtcbiAgICAgIHByb3BlcnR5TmFtZSA9IG5hbWUuc3Vic3RyaW5nKGluZGV4ICsgMSwgdW5pdEluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvcGVydHlOYW1lID0gbmFtZS5zdWJzdHJpbmcoaW5kZXggKyAxLCBuYW1lLmxlbmd0aCk7XG4gICAgfVxuICB9XG4gIHJldHVybiB7cHJvcGVydHlOYW1lLCB1bml0fTtcbn0iXX0=