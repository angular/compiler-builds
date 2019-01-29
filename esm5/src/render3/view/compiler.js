/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { identifierName, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { LifecycleHooks } from '../../lifecycle_reflector';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import * as o from '../../output/output_ast';
import { typeSourceSpan } from '../../parse_util';
import { CssSelector, SelectorMatcher } from '../../selector';
import { ShadowCss } from '../../shadow_css';
import { CONTENT_ATTR, HOST_ATTR } from '../../style_compiler';
import { error } from '../../util';
import { BoundEvent } from '../r3_ast';
import { compileFactoryFunction, dependenciesFromGlobalMetadata } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { prepareSyntheticListenerFunctionName, prepareSyntheticPropertyName, typeWithParameters } from '../util';
import { StylingBuilder } from './styling_builder';
import { BindingScope, TemplateDefinitionBuilder, ValueConverter, prepareEventListenerParameters, renderFlagCheckIfStmt, resolveSanitizationFn } from './template';
import { CONTEXT_NAME, DefinitionMap, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, conditionallyCreateMapObjectLiteral, getQueryPredicate, temporaryAllocator } from './util';
var EMPTY_ARRAY = [];
// This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
// If there is a match, the first matching group will contain the attribute name to bind.
var ATTR_REGEX = /attr\.([^\]]+)/;
function getStylingPrefix(propName) {
    return propName.substring(0, 5).toLowerCase();
}
function baseDirectiveFields(meta, constantPool, bindingParser) {
    var definitionMap = new DefinitionMap();
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.type);
    // e.g. `selectors: [['', 'someDir', '']]`
    definitionMap.set('selectors', createDirectiveSelector(meta.selector));
    // e.g. `factory: () => new MyApp(directiveInject(ElementRef))`
    var result = compileFactoryFunction({
        name: meta.name,
        type: meta.type,
        deps: meta.deps,
        injectFn: R3.directiveInject,
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
    var contextVarExp = o.variable(CONTEXT_NAME);
    var styleBuilder = new StylingBuilder(elVarExp, contextVarExp);
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
    // e.g. `hostBindings: (rf, ctx, elIndex) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta, elVarExp, contextVarExp, allOtherAttributes, styleBuilder, bindingParser, constantPool, hostVarsCount));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs, true));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
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
        features.push(o.importExpr(R3.ProvidersFeature).callFn(args));
    }
    if (meta.usesInheritance) {
        features.push(o.importExpr(R3.InheritDefinitionFeature));
    }
    if (meta.lifecycle.usesOnChanges) {
        features.push(o.importExpr(R3.NgOnChangesFeature).callFn(EMPTY_ARRAY));
    }
    if (features.length) {
        definitionMap.set('features', o.literalArr(features));
    }
}
/**
 * Compile a directive for the render3 runtime as defined by the `R3DirectiveMetadata`.
 */
export function compileDirectiveFromMetadata(meta, constantPool, bindingParser) {
    var _a = baseDirectiveFields(meta, constantPool, bindingParser), definitionMap = _a.definitionMap, statements = _a.statements;
    addFeatures(definitionMap, meta);
    var expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()]);
    if (!meta.selector) {
        throw new Error("Directive " + meta.name + " has no selector, please add it!");
    }
    var type = createTypeForDef(meta, R3.DirectiveDefWithMeta);
    return { expression: expression, type: type, statements: statements };
}
/**
 * Compile a base definition for the render3 runtime as defined by {@link R3BaseRefMetadata}
 * @param meta the metadata used for compilation.
 */
export function compileBaseDefFromMetadata(meta) {
    var definitionMap = new DefinitionMap();
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
    var expression = o.importExpr(R3.defineBase).callFn([definitionMap.toLiteralMap()]);
    var type = new o.ExpressionType(o.importExpr(R3.BaseDef));
    return { expression: expression, type: type };
}
/**
 * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
 */
export function compileComponentFromMetadata(meta, constantPool, bindingParser) {
    var e_1, _a;
    var _b = baseDirectiveFields(meta, constantPool, bindingParser), definitionMap = _b.definitionMap, statements = _b.statements;
    addFeatures(definitionMap, meta);
    var selector = meta.selector && CssSelector.parse(meta.selector);
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
        var matcher = new SelectorMatcher();
        try {
            for (var _c = tslib_1.__values(meta.directives), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = _d.value, selector_1 = _e.selector, expression_1 = _e.expression;
                matcher.addSelectables(CssSelector.parse(selector_1), expression_1);
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
    var changeDetection = meta.changeDetection;
    var template = meta.template;
    var templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
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
            compileStyles(meta.styles, CONTENT_ATTR, HOST_ATTR) :
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
    var expression = o.importExpr(R3.defineComponent).callFn([definitionMap.toLiteralMap()]);
    var type = createTypeForDef(meta, R3.ComponentDefWithMeta);
    return { expression: expression, type: type, statements: statements };
}
/**
 * A wrapper around `compileDirective` which depends on render2 global analysis data as its input
 * instead of the `R3DirectiveMetadata`.
 *
 * `R3DirectiveMetadata` is computed from `CompileDirectiveMetadata` and other statically reflected
 * information.
 */
export function compileDirectiveFromRender2(outputCtx, directive, reflector, bindingParser) {
    var name = identifierName(directive.type);
    name || error("Cannot resolver the name of " + directive.type);
    var definitionField = outputCtx.constantPool.propertyNameOf(1 /* Directive */);
    var meta = directiveMetadataFromGlobalMetadata(directive, outputCtx, reflector);
    var res = compileDirectiveFromMetadata(meta, outputCtx.constantPool, bindingParser);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []));
}
/**
 * A wrapper around `compileComponent` which depends on render2 global analysis data as its input
 * instead of the `R3DirectiveMetadata`.
 *
 * `R3ComponentMetadata` is computed from `CompileDirectiveMetadata` and other statically reflected
 * information.
 */
export function compileComponentFromRender2(outputCtx, component, render3Ast, reflector, bindingParser, directiveTypeBySel, pipeTypeByName) {
    var name = identifierName(component.type);
    name || error("Cannot resolver the name of " + component.type);
    var definitionField = outputCtx.constantPool.propertyNameOf(2 /* Component */);
    var summary = component.toSummary();
    // Compute the R3ComponentMetadata from the CompileDirectiveMetadata
    var meta = tslib_1.__assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector), { selector: component.selector, template: { nodes: render3Ast.nodes }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, interpolation: DEFAULT_INTERPOLATION_CONFIG, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
    var res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []));
}
/**
 * Compute `R3DirectiveMetadata` given `CompileDirectiveMetadata` and a `CompileReflector`.
 */
function directiveMetadataFromGlobalMetadata(directive, outputCtx, reflector) {
    var summary = directive.toSummary();
    var name = identifierName(directive.type);
    name || error("Cannot resolver the name of " + directive.type);
    return {
        name: name,
        type: outputCtx.importExpr(directive.type.reference),
        typeArgumentCount: 0,
        typeSourceSpan: typeSourceSpan(directive.isComponent ? 'Component' : 'Directive', directive.type),
        selector: directive.selector,
        deps: dependenciesFromGlobalMetadata(directive.type, outputCtx, reflector),
        queries: queriesFromGlobalMetadata(directive.queries, outputCtx),
        lifecycle: {
            usesOnChanges: directive.type.lifecycleHooks.some(function (lifecycle) { return lifecycle == LifecycleHooks.OnChanges; }),
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
            error('Found a type among the string selectors expected');
        return outputCtx.constantPool.getConstLiteral(o.literalArr(selectorStrings.map(function (value) { return o.literal(value); })));
    }
    if (selectors.length == 1) {
        var first = selectors[0];
        if (first.identifier) {
            return outputCtx.importExpr(first.identifier.reference);
        }
    }
    error('Unexpected query form');
    return o.NULL_EXPR;
}
function prepareQueryParams(query, constantPool) {
    var parameters = [
        getQueryPredicate(query, constantPool),
        o.literal(query.descendants),
    ];
    if (query.read) {
        parameters.push(query.read);
    }
    return parameters;
}
// Turn a directive selector into an R3-compatible selector for directive def
function createDirectiveSelector(selector) {
    return asLiteral(core.parseSelectorToR3Selector(selector));
}
function convertAttributesToExpressions(attributes) {
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
    return values;
}
// Return a contentQueries function or null if one is not necessary.
function createContentQueriesFunction(meta, constantPool) {
    if (meta.queries.length) {
        var statements = meta.queries.map(function (query) {
            var args = tslib_1.__spread([o.variable('dirIndex')], prepareQueryParams(query, constantPool));
            return o.importExpr(R3.contentQuery).callFn(args).toStmt();
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
        var parameters = [new o.FnParam('dirIndex', o.NUMBER_TYPE)];
        var directiveInstanceVar_1 = o.variable('instance');
        // var $tmp$: any;
        var temporary_1 = temporaryAllocator(statements_1, TEMPORARY_NAME);
        // const $instance$ = $r3$.ɵload(dirIndex);
        statements_1.push(directiveInstanceVar_1.set(o.importExpr(R3.load).callFn([o.variable('dirIndex')]))
            .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
        meta.queries.forEach(function (query) {
            var getQueryList = o.importExpr(R3.loadContentQuery).callFn([]);
            var assignToTemporary = temporary_1().set(getQueryList);
            var callQueryRefresh = o.importExpr(R3.queryRefresh).callFn([assignToTemporary]);
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
        typeWithParameters(meta.type, meta.typeArgumentCount),
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
    var tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    meta.viewQueries.forEach(function (query) {
        // creation, e.g. r3.viewQuery(somePredicate, true);
        var queryDefinition = o.importExpr(R3.viewQuery).callFn(prepareQueryParams(query, constantPool));
        createStatements.push(queryDefinition.toStmt());
        // update, e.g. (r3.queryRefresh(tmp = r3.loadViewQuery()) && (ctx.someDir = tmp));
        var temporary = tempAllocator();
        var getQueryList = o.importExpr(R3.loadViewQuery).callFn([]);
        var refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        var updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    });
    var viewQueryFnName = meta.name ? meta.name + "_Query" : null;
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
    ], o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(meta, elVarExp, bindingContext, staticAttributesAndValues, styleBuilder, bindingParser, constantPool, hostVarsCount) {
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
        return convertPropertyBinding(null, implicit, value, 'b', BindingForm.TrySimple, function () { return error('Unexpected interpolation'); });
    };
    if (bindings) {
        var hostVarsCountFn = function (numSlots) {
            var originalVarsCount = totalHostVarsCount;
            totalHostVarsCount += numSlots;
            return originalVarsCount;
        };
        var valueConverter = new ValueConverter(constantPool, 
        /* new nodes are illegal here */ function () { return error('Unexpected node'); }, hostVarsCountFn, 
        /* pipes are illegal here */ function () { return error('Unexpected pipe'); });
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
                    var _c = getBindingNameAndInstruction(binding), bindingName = _c.bindingName, instruction = _c.instruction, isAttribute = _c.isAttribute;
                    var securityContexts = bindingParser
                        .calcPossibleSecurityContexts(meta.selector || '', bindingName, isAttribute)
                        .filter(function (context) { return context !== core.SecurityContext.NONE; });
                    var sanitizerFn = null;
                    if (securityContexts.length) {
                        if (securityContexts.length === 2 &&
                            securityContexts.indexOf(core.SecurityContext.URL) > -1 &&
                            securityContexts.indexOf(core.SecurityContext.RESOURCE_URL) > -1) {
                            // Special case for some URL attributes (such as "src" and "href") that may be a part of
                            // different security contexts. In this case we use special santitization function and
                            // select the actual sanitizer at runtime based on a tag name that is provided while
                            // invoking sanitization function.
                            sanitizerFn = o.importExpr(R3.sanitizeUrlOrResourceUrl);
                        }
                        else {
                            sanitizerFn = resolveSanitizationFn(securityContexts[0], isAttribute);
                        }
                    }
                    var instructionParams = [
                        elVarExp, o.literal(bindingName), o.importExpr(R3.bind).callFn([bindingExpr.currValExpr])
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
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (bindings_1_1 && !bindings_1_1.done && (_a = bindings_1.return)) _a.call(bindings_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
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
            styleBuilder.buildUpdateLevelInstructions(valueConverter).forEach(function (instruction) {
                updateStatements.push(createStylingStmt(instruction, bindingContext, bindingFn));
            });
        }
    }
    if (totalHostVarsCount) {
        createStatements.unshift(o.importExpr(R3.allocHostVars).callFn([o.literal(totalHostVarsCount)]).toStmt());
    }
    if (createStatements.length > 0 || updateStatements.length > 0) {
        var hostBindingsFnName = meta.name ? meta.name + "_HostBindings" : null;
        var statements = [];
        if (createStatements.length > 0) {
            statements.push(renderFlagCheckIfStmt(1 /* Create */, createStatements));
        }
        if (updateStatements.length > 0) {
            statements.push(renderFlagCheckIfStmt(2 /* Update */, updateStatements));
        }
        return o.fn([
            new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null),
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
function getBindingNameAndInstruction(binding) {
    var bindingName = binding.name;
    var instruction;
    // Check to see if this is an attr binding or a property binding
    var attrMatches = bindingName.match(ATTR_REGEX);
    if (attrMatches) {
        bindingName = attrMatches[1];
        instruction = R3.elementAttribute;
    }
    else {
        if (binding.isAnimation) {
            bindingName = prepareSyntheticPropertyName(bindingName);
            // host bindings that have a synthetic property (e.g. @foo) should always be rendered
            // in the context of the component and not the parent. Therefore there is a special
            // compatibility instruction available for this purpose.
            instruction = R3.componentHostSyntheticProperty;
        }
        else {
            instruction = R3.elementProperty;
        }
    }
    return { bindingName: bindingName, instruction: instruction, isAttribute: !!attrMatches };
}
function createHostListeners(bindingContext, eventBindings, meta) {
    return eventBindings.map(function (binding) {
        var bindingName = binding.name && sanitizeIdentifier(binding.name);
        var bindingFnName = binding.type === 1 /* Animation */ ?
            prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
            bindingName;
        var handlerName = meta.name && bindingName ? meta.name + "_" + bindingFnName + "_HostBindingHandler" : null;
        var params = prepareEventListenerParameters(BoundEvent.fromParsedEvent(binding), bindingContext, handlerName);
        var instruction = binding.type == 1 /* Animation */ ? R3.componentHostSyntheticListener : R3.listener;
        return o.importExpr(instruction).callFn(params).toStmt();
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
var HOST_REG_EXP = /^(?:\[([^\]]+)\])|(?:\(([^\)]+)\))$/;
export function parseHostBindings(host) {
    var attributes = {};
    var listeners = {};
    var properties = {};
    Object.keys(host).forEach(function (key) {
        var value = host[key];
        var matches = key.match(HOST_REG_EXP);
        if (matches === null) {
            attributes[key] = value;
        }
        else if (matches[1 /* Binding */] != null) {
            // synthetic properties (the ones that have a `@` as a prefix)
            // are still treated the same as regular properties. Therefore
            // there is no point in storing them in a separate map.
            properties[matches[1 /* Binding */]] = value;
        }
        else if (matches[2 /* Event */] != null) {
            listeners[matches[2 /* Event */]] = value;
        }
    });
    return { attributes: attributes, listeners: listeners, properties: properties };
}
function compileStyles(styles, selector, hostSelector) {
    var shadowCss = new ShadowCss();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFHSCxPQUFPLEVBQWdHLGNBQWMsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRXpLLE9BQU8sRUFBQyxXQUFXLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUU3RixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUVuQyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDekQsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUU3RCxPQUFPLEVBQWdCLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNoRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw4QkFBOEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNyRixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxvQ0FBb0MsRUFBRSw0QkFBNEIsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMs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LE9BQU8sRUFBQyxZQUFZLGNBQUEsRUFBRSxJQUFJLE1BQUEsRUFBQyxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi8uLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVRdWVyeU1ldGFkYXRhLCBDb21waWxlVG9rZW5NZXRhZGF0YSwgaWRlbnRpZmllck5hbWUsIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uLy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmd9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2wsIERlZmluaXRpb25LaW5kfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgUGFyc2VkRXZlbnQsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VkUHJvcGVydHl9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xpZmVjeWNsZUhvb2tzfSBmcm9tICcuLi8uLi9saWZlY3ljbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHt0eXBlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7U2hhZG93Q3NzfSBmcm9tICcuLi8uLi9zaGFkb3dfY3NzJztcbmltcG9ydCB7Q09OVEVOVF9BVFRSLCBIT1NUX0FUVFJ9IGZyb20gJy4uLy4uL3N0eWxlX2NvbXBpbGVyJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7T3V0cHV0Q29udGV4dCwgZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0IHtCb3VuZEV2ZW50fSBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBkZXBlbmRlbmNpZXNGcm9tR2xvYmFsTWV0YWRhdGF9IGZyb20gJy4uL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSZW5kZXIzUGFyc2VSZXN1bHR9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZSwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtJbnN0cnVjdGlvbiwgU3R5bGluZ0J1aWxkZXJ9IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7QmluZGluZ1Njb3BlLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLCBWYWx1ZUNvbnZlcnRlciwgcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXQsIHJlc29sdmVTYW5pdGl6YXRpb25Gbn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgRGVmaW5pdGlvbk1hcCwgUkVOREVSX0ZMQUdTLCBURU1QT1JBUllfTkFNRSwgYXNMaXRlcmFsLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbCwgZ2V0UXVlcnlQcmVkaWNhdGUsIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgRU1QVFlfQVJSQVk6IGFueVtdID0gW107XG5cbi8vIFRoaXMgcmVnZXggbWF0Y2hlcyBhbnkgYmluZGluZyBuYW1lcyB0aGF0IGNvbnRhaW4gdGhlIFwiYXR0ci5cIiBwcmVmaXgsIGUuZy4gXCJhdHRyLnJlcXVpcmVkXCJcbi8vIElmIHRoZXJlIGlzIGEgbWF0Y2gsIHRoZSBmaXJzdCBtYXRjaGluZyBncm91cCB3aWxsIGNvbnRhaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHRvIGJpbmQuXG5jb25zdCBBVFRSX1JFR0VYID0gL2F0dHJcXC4oW15cXF1dKykvO1xuXG5mdW5jdGlvbiBnZXRTdHlsaW5nUHJlZml4KHByb3BOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcHJvcE5hbWUuc3Vic3RyaW5nKDAsIDUpLnRvTG93ZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIGJhc2VEaXJlY3RpdmVGaWVsZHMoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEudHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3JzOiBbWycnLCAnc29tZURpcicsICcnXV1gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcnMnLCBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihtZXRhLnNlbGVjdG9yKSk7XG5cblxuICAvLyBlLmcuIGBmYWN0b3J5OiAoKSA9PiBuZXcgTXlBcHAoZGlyZWN0aXZlSW5qZWN0KEVsZW1lbnRSZWYpKWBcbiAgY29uc3QgcmVzdWx0ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgbmFtZTogbWV0YS5uYW1lLFxuICAgIHR5cGU6IG1ldGEudHlwZSxcbiAgICBkZXBzOiBtZXRhLmRlcHMsXG4gICAgaW5qZWN0Rm46IFIzLmRpcmVjdGl2ZUluamVjdCxcbiAgfSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdmYWN0b3J5JywgcmVzdWx0LmZhY3RvcnkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb250ZW50UXVlcmllcycsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzUmVmcmVzaCcsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzUmVmcmVzaEZ1bmN0aW9uKG1ldGEpKTtcblxuICAvLyBJbml0aWFsaXplIGhvc3RWYXJzQ291bnQgdG8gbnVtYmVyIG9mIGJvdW5kIGhvc3QgcHJvcGVydGllcyAoaW50ZXJwb2xhdGlvbnMgaWxsZWdhbCksXG4gIC8vIGV4Y2VwdCAnc3R5bGUnIGFuZCAnY2xhc3MnIHByb3BlcnRpZXMsIHNpbmNlIHRoZXkgc2hvdWxkICpub3QqIGFsbG9jYXRlIGhvc3QgdmFyIHNsb3RzXG4gIGNvbnN0IGhvc3RWYXJzQ291bnQgPSBPYmplY3Qua2V5cyhtZXRhLmhvc3QucHJvcGVydGllcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKG5hbWUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gZ2V0U3R5bGluZ1ByZWZpeChuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVmaXggIT09ICdzdHlsZScgJiYgcHJlZml4ICE9PSAnY2xhc3MnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmxlbmd0aDtcblxuICBjb25zdCBlbFZhckV4cCA9IG8udmFyaWFibGUoJ2VsSW5kZXgnKTtcbiAgY29uc3QgY29udGV4dFZhckV4cCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgY29uc3Qgc3R5bGVCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKGVsVmFyRXhwLCBjb250ZXh0VmFyRXhwKTtcblxuICBjb25zdCBhbGxPdGhlckF0dHJpYnV0ZXM6IGFueSA9IHt9O1xuICBjb25zdCBhdHRyTmFtZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtZXRhLmhvc3QuYXR0cmlidXRlcyk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0ck5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYXR0ciA9IGF0dHJOYW1lc1tpXTtcbiAgICBjb25zdCB2YWx1ZSA9IG1ldGEuaG9zdC5hdHRyaWJ1dGVzW2F0dHJdO1xuICAgIHN3aXRjaCAoYXR0cikge1xuICAgICAgLy8gc3R5bGUgYXR0cmlidXRlcyBhcmUgaGFuZGxlZCBpbiB0aGUgc3R5bGluZyBjb250ZXh0XG4gICAgICBjYXNlICdzdHlsZSc6XG4gICAgICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cih2YWx1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gY2xhc3MgYXR0cmlidXRlcyBhcmUgaGFuZGxlZCBpbiB0aGUgc3R5bGluZyBjb250ZXh0XG4gICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cih2YWx1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYWxsT3RoZXJBdHRyaWJ1dGVzW2F0dHJdID0gdmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIGUuZy4gYGhvc3RCaW5kaW5nczogKHJmLCBjdHgsIGVsSW5kZXgpID0+IHsgLi4uIH1cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnaG9zdEJpbmRpbmdzJywgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGEsIGVsVmFyRXhwLCBjb250ZXh0VmFyRXhwLCBhbGxPdGhlckF0dHJpYnV0ZXMsIHN0eWxlQnVpbGRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCBob3N0VmFyc0NvdW50KSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50c307XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSB8IFIzQ29tcG9uZW50TWV0YWRhdGEpIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmUoKV1gXG4gIGNvbnN0IGZlYXR1cmVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGNvbnN0IHByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICBjb25zdCB2aWV3UHJvdmlkZXJzID0gKG1ldGEgYXMgUjNDb21wb25lbnRNZXRhZGF0YSkudmlld1Byb3ZpZGVycztcbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Jbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLk5nT25DaGFuZ2VzRmVhdHVyZSkuY2FsbEZuKEVNUFRZX0FSUkFZKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0RpcmVjdGl2ZURlZiB7XG4gIGNvbnN0IHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzfSA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBpZiAoIW1ldGEuc2VsZWN0b3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYERpcmVjdGl2ZSAke21ldGEubmFtZX0gaGFzIG5vIHNlbGVjdG9yLCBwbGVhc2UgYWRkIGl0IWApO1xuICB9XG5cbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuRGlyZWN0aXZlRGVmV2l0aE1ldGEpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzQmFzZVJlZk1ldGFEYXRhIHtcbiAgaW5wdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IFtzdHJpbmcsIHN0cmluZ119O1xuICBvdXRwdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGJhc2UgZGVmaW5pdGlvbiBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHtAbGluayBSM0Jhc2VSZWZNZXRhZGF0YX1cbiAqIEBwYXJhbSBtZXRhIHRoZSBtZXRhZGF0YSB1c2VkIGZvciBjb21waWxhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVCYXNlRGVmRnJvbU1ldGFkYXRhKG1ldGE6IFIzQmFzZVJlZk1ldGFEYXRhKSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBpZiAobWV0YS5pbnB1dHMpIHtcbiAgICBjb25zdCBpbnB1dHMgPSBtZXRhLmlucHV0cztcbiAgICBjb25zdCBpbnB1dHNNYXAgPSBPYmplY3Qua2V5cyhpbnB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdiA9IGlucHV0c1trZXldO1xuICAgICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KHYpID8gby5saXRlcmFsQXJyKHYubWFwKHZ4ID0+IG8ubGl0ZXJhbCh2eCkpKSA6IG8ubGl0ZXJhbCh2KTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIG8ubGl0ZXJhbE1hcChpbnB1dHNNYXApKTtcbiAgfVxuICBpZiAobWV0YS5vdXRwdXRzKSB7XG4gICAgY29uc3Qgb3V0cHV0cyA9IG1ldGEub3V0cHV0cztcbiAgICBjb25zdCBvdXRwdXRzTWFwID0gT2JqZWN0LmtleXMob3V0cHV0cykubWFwKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG8ubGl0ZXJhbChvdXRwdXRzW2tleV0pO1xuICAgICAgcmV0dXJuIHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfTtcbiAgICB9KTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIG8ubGl0ZXJhbE1hcChvdXRwdXRzTWFwKSk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUJhc2UpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuXG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQmFzZURlZikpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzfSA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJywgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBmb3IgKGNvbnN0IHtzZWxlY3RvciwgZXhwcmVzc2lvbn0gb2YgbWV0YS5kaXJlY3RpdmVzKSB7XG4gICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgZGlyZWN0aXZlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgcGlwZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IGNoYW5nZURldGVjdGlvbiA9IG1ldGEuY2hhbmdlRGV0ZWN0aW9uO1xuXG4gIGNvbnN0IHRlbXBsYXRlID0gbWV0YS50ZW1wbGF0ZTtcbiAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICBjb25zdGFudFBvb2wsIEJpbmRpbmdTY29wZS5ST09UX1NDT1BFLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICBkaXJlY3RpdmVNYXRjaGVyLCBkaXJlY3RpdmVzVXNlZCwgbWV0YS5waXBlcywgcGlwZXNVc2VkLCBSMy5uYW1lc3BhY2VIVE1MLFxuICAgICAgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMpO1xuXG4gIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5ub2RlcywgW10pO1xuXG4gIC8vIFdlIG5lZWQgdG8gcHJvdmlkZSB0aGlzIHNvIHRoYXQgZHluYW1pY2FsbHkgZ2VuZXJhdGVkIGNvbXBvbmVudHMga25vdyB3aGF0XG4gIC8vIHByb2plY3RlZCBjb250ZW50IGJsb2NrcyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIGNvbXBvbmVudCB3aGVuIGl0IGlzIGluc3RhbnRpYXRlZC5cbiAgY29uc3QgbmdDb250ZW50U2VsZWN0b3JzID0gdGVtcGxhdGVCdWlsZGVyLmdldE5nQ29udGVudFNlbGVjdG9ycygpO1xuICBpZiAobmdDb250ZW50U2VsZWN0b3JzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIG5nQ29udGVudFNlbGVjdG9ycyk7XG4gIH1cblxuICAvLyBlLmcuIGBjb25zdHM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYHZhcnM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24pO1xuXG4gIC8vIGUuZy4gYGRpcmVjdGl2ZXM6IFtNeURpcmVjdGl2ZV1gXG4gIGlmIChkaXJlY3RpdmVzVXNlZC5zaXplKSB7XG4gICAgbGV0IGRpcmVjdGl2ZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShkaXJlY3RpdmVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIGRpcmVjdGl2ZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChkaXJlY3RpdmVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RpcmVjdGl2ZXMnLCBkaXJlY3RpdmVzRXhwcik7XG4gIH1cblxuICAvLyBlLmcuIGBwaXBlczogW015UGlwZV1gXG4gIGlmIChwaXBlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBwaXBlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKHBpcGVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIHBpcGVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocGlwZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBwaXBlc0V4cHIpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHJpbmdzID0gc3R5bGVWYWx1ZXMubWFwKHN0ciA9PiBvLmxpdGVyYWwoc3RyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHJpbmdzKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gc3R5bGUsIGRvbid0IGdlbmVyYXRlIGNzcyBzZWxlY3RvcnMgb24gZWxlbWVudHNcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLk5vbmU7XG4gIH1cblxuICAvLyBPbmx5IHNldCB2aWV3IGVuY2Fwc3VsYXRpb24gaWYgaXQncyBub3QgdGhlIGRlZmF1bHQgdmFsdWVcbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdlbmNhcHN1bGF0aW9uJywgby5saXRlcmFsKG1ldGEuZW5jYXBzdWxhdGlvbikpO1xuICB9XG5cbiAgLy8gZS5nLiBgYW5pbWF0aW9uOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbicsIHZhbHVlOiBtZXRhLmFuaW1hdGlvbnMsIHF1b3RlZDogZmFsc2V9XSkpO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdGhlIGNoYW5nZSBkZXRlY3Rpb24gZmxhZyBpZiBpdCdzIGRlZmluZWQgYW5kIGl0J3Mgbm90IHRoZSBkZWZhdWx0LlxuICBpZiAoY2hhbmdlRGV0ZWN0aW9uICE9IG51bGwgJiYgY2hhbmdlRGV0ZWN0aW9uICE9PSBjb3JlLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKGNoYW5nZURldGVjdGlvbikpO1xuICB9XG5cbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IChtZXRhLnNlbGVjdG9yIHx8ICcnKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lQ29tcG9uZW50KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuQ29tcG9uZW50RGVmV2l0aE1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50c307XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZURpcmVjdGl2ZWAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtkaXJlY3RpdmUudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkRpcmVjdGl2ZSk7XG5cbiAgY29uc3QgbWV0YSA9IGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGRpcmVjdGl2ZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpO1xuICBjb25zdCByZXMgPSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlQ29tcG9uZW50YCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzQ29tcG9uZW50TWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZW5kZXIzQXN0OiBSZW5kZXIzUGFyc2VSZXN1bHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBkaXJlY3RpdmVUeXBlQnlTZWw6IE1hcDxzdHJpbmcsIGFueT4sXG4gICAgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIGFueT4pIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGNvbXBvbmVudC50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtjb21wb25lbnQudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkNvbXBvbmVudCk7XG5cbiAgY29uc3Qgc3VtbWFyeSA9IGNvbXBvbmVudC50b1N1bW1hcnkoKTtcblxuICAvLyBDb21wdXRlIHRoZSBSM0NvbXBvbmVudE1ldGFkYXRhIGZyb20gdGhlIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YVxuICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhID0ge1xuICAgIC4uLmRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudCwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHNlbGVjdG9yOiBjb21wb25lbnQuc2VsZWN0b3IsXG4gICAgdGVtcGxhdGU6IHtub2RlczogcmVuZGVyM0FzdC5ub2Rlc30sXG4gICAgZGlyZWN0aXZlczogW10sXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgIHN0eWxlczogKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5zdHlsZXMpIHx8IEVNUFRZX0FSUkFZLFxuICAgIGVuY2Fwc3VsYXRpb246XG4gICAgICAgIChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuZW5jYXBzdWxhdGlvbikgfHwgY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgIGFuaW1hdGlvbnM6IG51bGwsXG4gICAgdmlld1Byb3ZpZGVyczpcbiAgICAgICAgY29tcG9uZW50LnZpZXdQcm92aWRlcnMubGVuZ3RoID4gMCA/IG5ldyBvLldyYXBwZWROb2RlRXhwcihjb21wb25lbnQudmlld1Byb3ZpZGVycykgOiBudWxsLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEobWV0YSwgb3V0cHV0Q3R4LmNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG5cbiAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWFsIGNsYXNzIHRvIGJlIG1lcmdlZCB3aXRoIHRoZSBhY3R1YWwgY2xhc3MuXG4gIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2gobmV3IG8uQ2xhc3NTdG10KFxuICAgICAgbmFtZSwgbnVsbCxcbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKGRlZmluaXRpb25GaWVsZCwgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgcmVzLmV4cHJlc3Npb24pXSxcbiAgICAgIFtdLCBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSkpO1xufVxuXG4vKipcbiAqIENvbXB1dGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGdpdmVuIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBhIGBDb21waWxlUmVmbGVjdG9yYC5cbiAqL1xuZnVuY3Rpb24gZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3Qgc3VtbWFyeSA9IGRpcmVjdGl2ZS50b1N1bW1hcnkoKTtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtkaXJlY3RpdmUudHlwZX1gKTtcblxuICByZXR1cm4ge1xuICAgIG5hbWUsXG4gICAgdHlwZTogb3V0cHV0Q3R4LmltcG9ydEV4cHIoZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlKSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICB0eXBlU291cmNlU3BhbjpcbiAgICAgICAgdHlwZVNvdXJjZVNwYW4oZGlyZWN0aXZlLmlzQ29tcG9uZW50ID8gJ0NvbXBvbmVudCcgOiAnRGlyZWN0aXZlJywgZGlyZWN0aXZlLnR5cGUpLFxuICAgIHNlbGVjdG9yOiBkaXJlY3RpdmUuc2VsZWN0b3IsXG4gICAgZGVwczogZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKGRpcmVjdGl2ZS50eXBlLCBvdXRwdXRDdHgsIHJlZmxlY3RvciksXG4gICAgcXVlcmllczogcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUucXVlcmllcywgb3V0cHV0Q3R4KSxcbiAgICBsaWZlY3ljbGU6IHtcbiAgICAgIHVzZXNPbkNoYW5nZXM6XG4gICAgICAgICAgZGlyZWN0aXZlLnR5cGUubGlmZWN5Y2xlSG9va3Muc29tZShsaWZlY3ljbGUgPT4gbGlmZWN5Y2xlID09IExpZmVjeWNsZUhvb2tzLk9uQ2hhbmdlcyksXG4gICAgfSxcbiAgICBob3N0OiB7XG4gICAgICBhdHRyaWJ1dGVzOiBkaXJlY3RpdmUuaG9zdEF0dHJpYnV0ZXMsXG4gICAgICBsaXN0ZW5lcnM6IHN1bW1hcnkuaG9zdExpc3RlbmVycyxcbiAgICAgIHByb3BlcnRpZXM6IHN1bW1hcnkuaG9zdFByb3BlcnRpZXMsXG4gICAgfSxcbiAgICBpbnB1dHM6IGRpcmVjdGl2ZS5pbnB1dHMsXG4gICAgb3V0cHV0czogZGlyZWN0aXZlLm91dHB1dHMsXG4gICAgdXNlc0luaGVyaXRhbmNlOiBmYWxzZSxcbiAgICBleHBvcnRBczogbnVsbCxcbiAgICBwcm92aWRlcnM6IGRpcmVjdGl2ZS5wcm92aWRlcnMubGVuZ3RoID4gMCA/IG5ldyBvLldyYXBwZWROb2RlRXhwcihkaXJlY3RpdmUucHJvdmlkZXJzKSA6IG51bGxcbiAgfTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlUXVlcnlNZXRhZGF0YWAgaW50byBgUjNRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBSM1F1ZXJ5TWV0YWRhdGFbXSB7XG4gIHJldHVybiBxdWVyaWVzLm1hcChxdWVyeSA9PiB7XG4gICAgbGV0IHJlYWQ6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAocXVlcnkucmVhZCAmJiBxdWVyeS5yZWFkLmlkZW50aWZpZXIpIHtcbiAgICAgIHJlYWQgPSBvdXRwdXRDdHguaW1wb3J0RXhwcihxdWVyeS5yZWFkLmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3BlcnR5TmFtZTogcXVlcnkucHJvcGVydHlOYW1lLFxuICAgICAgZmlyc3Q6IHF1ZXJ5LmZpcnN0LFxuICAgICAgcHJlZGljYXRlOiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEocXVlcnkuc2VsZWN0b3JzLCBvdXRwdXRDdHgpLFxuICAgICAgZGVzY2VuZGFudHM6IHF1ZXJ5LmRlc2NlbmRhbnRzLCByZWFkLFxuICAgIH07XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbXBpbGVUb2tlbk1ldGFkYXRhYCBmb3IgcXVlcnkgc2VsZWN0b3JzIGludG8gZWl0aGVyIGFuIGV4cHJlc3Npb24gZm9yIGEgcHJlZGljYXRlXG4gKiB0eXBlLCBvciBhIGxpc3Qgb2Ygc3RyaW5nIHByZWRpY2F0ZXMuXG4gKi9cbmZ1bmN0aW9uIHNlbGVjdG9yc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBzZWxlY3RvcnM6IENvbXBpbGVUb2tlbk1ldGFkYXRhW10sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IG8uRXhwcmVzc2lvbnxzdHJpbmdbXSB7XG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID4gMSB8fCAoc2VsZWN0b3JzLmxlbmd0aCA9PSAxICYmIHNlbGVjdG9yc1swXS52YWx1ZSkpIHtcbiAgICBjb25zdCBzZWxlY3RvclN0cmluZ3MgPSBzZWxlY3RvcnMubWFwKHZhbHVlID0+IHZhbHVlLnZhbHVlIGFzIHN0cmluZyk7XG4gICAgc2VsZWN0b3JTdHJpbmdzLnNvbWUodmFsdWUgPT4gIXZhbHVlKSAmJlxuICAgICAgICBlcnJvcignRm91bmQgYSB0eXBlIGFtb25nIHRoZSBzdHJpbmcgc2VsZWN0b3JzIGV4cGVjdGVkJyk7XG4gICAgcmV0dXJuIG91dHB1dEN0eC5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JTdHJpbmdzLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpO1xuICB9XG5cbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSkge1xuICAgIGNvbnN0IGZpcnN0ID0gc2VsZWN0b3JzWzBdO1xuICAgIGlmIChmaXJzdC5pZGVudGlmaWVyKSB7XG4gICAgICByZXR1cm4gb3V0cHV0Q3R4LmltcG9ydEV4cHIoZmlyc3QuaWRlbnRpZmllci5yZWZlcmVuY2UpO1xuICAgIH1cbiAgfVxuXG4gIGVycm9yKCdVbmV4cGVjdGVkIHF1ZXJ5IGZvcm0nKTtcbiAgcmV0dXJuIG8uTlVMTF9FWFBSO1xufVxuXG5mdW5jdGlvbiBwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgZ2V0UXVlcnlQcmVkaWNhdGUocXVlcnksIGNvbnN0YW50UG9vbCksXG4gICAgby5saXRlcmFsKHF1ZXJ5LmRlc2NlbmRhbnRzKSxcbiAgXTtcbiAgaWYgKHF1ZXJ5LnJlYWQpIHtcbiAgICBwYXJhbWV0ZXJzLnB1c2gocXVlcnkucmVhZCk7XG4gIH1cbiAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG5cbi8vIFR1cm4gYSBkaXJlY3RpdmUgc2VsZWN0b3IgaW50byBhbiBSMy1jb21wYXRpYmxlIHNlbGVjdG9yIGZvciBkaXJlY3RpdmUgZGVmXG5mdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nIHwgbnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBhc0xpdGVyYWwoY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHNlbGVjdG9yKSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiBhbnkpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgdmFsdWVzLnB1c2goby5saXRlcmFsKGtleSksIG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBtZXRhLnF1ZXJpZXMubWFwKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhKSA9PiB7XG4gICAgICBjb25zdCBhcmdzID0gW28udmFyaWFibGUoJ2RpckluZGV4JyksIC4uLnByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSBhcyBhbnldO1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5jb250ZW50UXVlcnkpLmNhbGxGbihhcmdzKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICBjb25zdCBwYXJhbWV0ZXJzID0gW25ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSldO1xuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGwpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzUmVmcmVzaCBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbbmV3IG8uRm5QYXJhbSgnZGlySW5kZXgnLCBvLk5VTUJFUl9UWVBFKV07XG4gICAgY29uc3QgZGlyZWN0aXZlSW5zdGFuY2VWYXIgPSBvLnZhcmlhYmxlKCdpbnN0YW5jZScpO1xuICAgIC8vIHZhciAkdG1wJDogYW55O1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBvcmFyeUFsbG9jYXRvcihzdGF0ZW1lbnRzLCBURU1QT1JBUllfTkFNRSk7XG5cbiAgICAvLyBjb25zdCAkaW5zdGFuY2UkID0gJHIzJC7JtWxvYWQoZGlySW5kZXgpO1xuICAgIHN0YXRlbWVudHMucHVzaChkaXJlY3RpdmVJbnN0YW5jZVZhci5zZXQoby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby52YXJpYWJsZSgnZGlySW5kZXgnKV0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG5cbiAgICBtZXRhLnF1ZXJpZXMuZm9yRWFjaCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRDb250ZW50UXVlcnkpLmNhbGxGbihbXSk7XG4gICAgICBjb25zdCBhc3NpZ25Ub1RlbXBvcmFyeSA9IHRlbXBvcmFyeSgpLnNldChnZXRRdWVyeUxpc3QpO1xuICAgICAgY29uc3QgY2FsbFF1ZXJ5UmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbYXNzaWduVG9UZW1wb3JhcnldKTtcblxuICAgICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gZGlyZWN0aXZlSW5zdGFuY2VWYXIucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeSgpLnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkoKSk7XG4gICAgICBjb25zdCByZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUgPSBjYWxsUXVlcnlSZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpO1xuXG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVmcmVzaFF1ZXJ5QW5kVXBkYXRlRGlyZWN0aXZlLnRvU3RtdCgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzUmVmcmVzaGAgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzVHlwZShtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0pOiBvLlR5cGUge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsTWFwKG1hcFZhbHVlcykpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IHN0cmluZ1tdKTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVR5cGVGb3JEZWYobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgdHlwZUJhc2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLlR5cGUge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKHR5cGVCYXNlLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSksXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FycmF5QXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEuaW5wdXRzKSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5vdXRwdXRzKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXSkpO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIG1ldGEudmlld1F1ZXJpZXMuZm9yRWFjaCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLnZpZXdRdWVyeShzb21lUHJlZGljYXRlLCB0cnVlKTtcbiAgICBjb25zdCBxdWVyeURlZmluaXRpb24gPVxuICAgICAgICBvLmltcG9ydEV4cHIoUjMudmlld1F1ZXJ5KS5jYWxsRm4ocHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gocXVlcnlEZWZpbml0aW9uLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRWaWV3UXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkVmlld1F1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9KTtcblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBlbFZhckV4cDogby5SZWFkVmFyRXhwciwgYmluZGluZ0NvbnRleHQ6IG8uUmVhZFZhckV4cHIsXG4gICAgc3RhdGljQXR0cmlidXRlc0FuZFZhbHVlczogYW55W10sIHN0eWxlQnVpbGRlcjogU3R5bGluZ0J1aWxkZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGhvc3RWYXJzQ291bnQ6IG51bWJlcik6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgbGV0IHRvdGFsSG9zdFZhcnNDb3VudCA9IGhvc3RWYXJzQ291bnQ7XG4gIGNvbnN0IGhvc3RCaW5kaW5nU291cmNlU3BhbiA9IG1ldGEudHlwZVNvdXJjZVNwYW47XG4gIGNvbnN0IGRpcmVjdGl2ZVN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeShtZXRhKTtcblxuICAvLyBDYWxjdWxhdGUgaG9zdCBldmVudCBiaW5kaW5nc1xuICBjb25zdCBldmVudEJpbmRpbmdzID1cbiAgICAgIGJpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICBpZiAoZXZlbnRCaW5kaW5ncyAmJiBldmVudEJpbmRpbmdzLmxlbmd0aCkge1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IGNyZWF0ZUhvc3RMaXN0ZW5lcnMoYmluZGluZ0NvbnRleHQsIGV2ZW50QmluZGluZ3MsIG1ldGEpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaCguLi5saXN0ZW5lcnMpO1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmdzXG4gIGNvbnN0IGJpbmRpbmdzID0gYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG5cbiAgY29uc3QgYmluZGluZ0ZuID0gKGltcGxpY2l0OiBhbnksIHZhbHVlOiBBU1QpID0+IHtcbiAgICByZXR1cm4gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgbnVsbCwgaW1wbGljaXQsIHZhbHVlLCAnYicsIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSwgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcbiAgfTtcbiAgaWYgKGJpbmRpbmdzKSB7XG4gICAgY29uc3QgaG9zdFZhcnNDb3VudEZuID0gKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgICAgY29uc3Qgb3JpZ2luYWxWYXJzQ291bnQgPSB0b3RhbEhvc3RWYXJzQ291bnQ7XG4gICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gbnVtU2xvdHM7XG4gICAgICByZXR1cm4gb3JpZ2luYWxWYXJzQ291bnQ7XG4gICAgfTtcbiAgICBjb25zdCB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLFxuICAgICAgICAvKiBuZXcgbm9kZXMgYXJlIGlsbGVnYWwgaGVyZSAqLyAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBub2RlJyksIGhvc3RWYXJzQ291bnRGbixcbiAgICAgICAgLyogcGlwZXMgYXJlIGlsbGVnYWwgaGVyZSAqLyAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBwaXBlJykpO1xuXG4gICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICBjb25zdCBuYW1lID0gYmluZGluZy5uYW1lO1xuICAgICAgY29uc3Qgc3R5bGVQcmVmaXggPSBnZXRTdHlsaW5nUHJlZml4KG5hbWUpO1xuICAgICAgaWYgKHN0eWxlUHJlZml4ID09PSAnc3R5bGUnKSB7XG4gICAgICAgIGNvbnN0IHtwcm9wZXJ0eU5hbWUsIHVuaXR9ID0gcGFyc2VOYW1lZFByb3BlcnR5KG5hbWUpO1xuICAgICAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUlucHV0KHByb3BlcnR5TmFtZSwgYmluZGluZy5leHByZXNzaW9uLCB1bml0LCBiaW5kaW5nLnNvdXJjZVNwYW4pO1xuICAgICAgfSBlbHNlIGlmIChzdHlsZVByZWZpeCA9PT0gJ2NsYXNzJykge1xuICAgICAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0lucHV0KFxuICAgICAgICAgICAgcGFyc2VOYW1lZFByb3BlcnR5KG5hbWUpLnByb3BlcnR5TmFtZSwgYmluZGluZy5leHByZXNzaW9uLCBiaW5kaW5nLnNvdXJjZVNwYW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgICAgIGNvbnN0IHZhbHVlID0gYmluZGluZy5leHByZXNzaW9uLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgY29uc3QgYmluZGluZ0V4cHIgPSBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKTtcblxuICAgICAgICBjb25zdCB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZX0gPSBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmcpO1xuXG4gICAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICAgICAgYmluZGluZ1BhcnNlclxuICAgICAgICAgICAgICAgIC5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKG1ldGEuc2VsZWN0b3IgfHwgJycsIGJpbmRpbmdOYW1lLCBpc0F0dHJpYnV0ZSlcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gY29yZS5TZWN1cml0eUNvbnRleHQuTk9ORSk7XG5cbiAgICAgICAgbGV0IHNhbml0aXplckZuOiBvLkV4dGVybmFsRXhwcnxudWxsID0gbnVsbDtcbiAgICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoID09PSAyICYmXG4gICAgICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkwpID4gLTEgJiZcbiAgICAgICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCkgPiAtMSkge1xuICAgICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzb21lIFVSTCBhdHRyaWJ1dGVzIChzdWNoIGFzIFwic3JjXCIgYW5kIFwiaHJlZlwiKSB0aGF0IG1heSBiZSBhIHBhcnQgb2ZcbiAgICAgICAgICAgIC8vIGRpZmZlcmVudCBzZWN1cml0eSBjb250ZXh0cy4gSW4gdGhpcyBjYXNlIHdlIHVzZSBzcGVjaWFsIHNhbnRpdGl6YXRpb24gZnVuY3Rpb24gYW5kXG4gICAgICAgICAgICAvLyBzZWxlY3QgdGhlIGFjdHVhbCBzYW5pdGl6ZXIgYXQgcnVudGltZSBiYXNlZCBvbiBhIHRhZyBuYW1lIHRoYXQgaXMgcHJvdmlkZWQgd2hpbGVcbiAgICAgICAgICAgIC8vIGludm9raW5nIHNhbml0aXphdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgICAgIHNhbml0aXplckZuID0gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsT3JSZXNvdXJjZVVybCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNhbml0aXplckZuID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKHNlY3VyaXR5Q29udGV4dHNbMF0sIGlzQXR0cmlidXRlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnN0cnVjdGlvblBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICAgICAgZWxWYXJFeHAsIG8ubGl0ZXJhbChiaW5kaW5nTmFtZSksIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW2JpbmRpbmdFeHByLmN1cnJWYWxFeHByXSlcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKHNhbml0aXplckZuKSB7XG4gICAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChzYW5pdGl6ZXJGbik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc0F0dHJpYnV0ZSkge1xuICAgICAgICAgIGlmICghc2FuaXRpemVyRm4pIHtcbiAgICAgICAgICAgIC8vIGFwcGVuZCBgbnVsbGAgaW4gZnJvbnQgb2YgYG5hdGl2ZU9ubHlgIGZsYWcgaWYgbm8gc2FuaXRpemVyIGZuIGRlZmluZWRcbiAgICAgICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goby5saXRlcmFsKG51bGwpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaG9zdCBiaW5kaW5ncyBtdXN0IGhhdmUgbmF0aXZlT25seSBwcm9wIHNldCB0byB0cnVlXG4gICAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKGluc3RydWN0aW9uUGFyYW1zKS50b1N0bXQoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2luY2Ugd2UncmUgZGVhbGluZyB3aXRoIGRpcmVjdGl2ZXMvY29tcG9uZW50cyBhbmQgYm90aCBoYXZlIGhvc3RCaW5kaW5nXG4gICAgLy8gZnVuY3Rpb25zLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIGEgc3BlY2lhbCBob3N0QXR0cnMgaW5zdHJ1Y3Rpb24gdGhhdCBkZWFsc1xuICAgIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgICAvLyBlbGVtZW50LiBUaGUgaW5zdHJ1Y3Rpb24gYmVsb3cgd2lsbCBpbnN0cnVjdCBhbGwgaW5pdGlhbCBzdHlsaW5nIChzdHlsaW5nXG4gICAgLy8gdGhhdCBpcyBpbnNpZGUgb2YgYSBob3N0IGJpbmRpbmcgd2l0aGluIGEgZGlyZWN0aXZlL2NvbXBvbmVudCkgdG8gYmUgYXR0YWNoZWRcbiAgICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgICAvLyBjb2xsZWN0ZWQgZWFybGllci5cbiAgICBjb25zdCBob3N0QXR0cnMgPSBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoc3RhdGljQXR0cmlidXRlc0FuZFZhbHVlcyk7XG4gICAgY29uc3QgaG9zdEluc3RydWN0aW9uID0gc3R5bGVCdWlsZGVyLmJ1aWxkSG9zdEF0dHJzSW5zdHJ1Y3Rpb24obnVsbCwgaG9zdEF0dHJzLCBjb25zdGFudFBvb2wpO1xuICAgIGlmIChob3N0SW5zdHJ1Y3Rpb24pIHtcbiAgICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdHlsaW5nU3RtdChob3N0SW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVCdWlsZGVyLmhhc0JpbmRpbmdzKSB7XG4gICAgICAvLyBzaW5ndWxhciBzdHlsZS9jbGFzcyBiaW5kaW5ncyAodGhpbmdzIGxpa2UgYFtzdHlsZS5wcm9wXWAgYW5kIGBbY2xhc3MubmFtZV1gKVxuICAgICAgLy8gTVVTVCBiZSByZWdpc3RlcmVkIG9uIGEgZ2l2ZW4gZWxlbWVudCB3aXRoaW4gdGhlIGNvbXBvbmVudC9kaXJlY3RpdmVcbiAgICAgIC8vIHRlbXBsYXRlRm4vaG9zdEJpbmRpbmdzRm4gZnVuY3Rpb25zLiBUaGUgaW5zdHJ1Y3Rpb24gYmVsb3cgd2lsbCBmaWd1cmUgb3V0XG4gICAgICAvLyB3aGF0IGFsbCB0aGUgYmluZGluZ3MgYXJlIGFuZCB0aGVuIGdlbmVyYXRlIHRoZSBzdGF0ZW1lbnRzIHJlcXVpcmVkIHRvIHJlZ2lzdGVyXG4gICAgICAvLyB0aG9zZSBiaW5kaW5ncyB0byB0aGUgZWxlbWVudCB2aWEgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICAgIGNvbnN0IGVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24gPVxuICAgICAgICAgIHN0eWxlQnVpbGRlci5idWlsZEVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24obnVsbCwgY29uc3RhbnRQb29sKTtcbiAgICAgIGlmIChlbGVtZW50U3R5bGluZ0luc3RydWN0aW9uKSB7XG4gICAgICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICAgIGNyZWF0ZVN0eWxpbmdTdG10KGVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICAgIH1cblxuICAgICAgLy8gZmluYWxseSBlYWNoIGJpbmRpbmcgdGhhdCB3YXMgcmVnaXN0ZXJlZCBpbiB0aGUgc3RhdGVtZW50IGFib3ZlIHdpbGwgbmVlZCB0byBiZSBhZGRlZCB0b1xuICAgICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgICAgLy8gYXJlIGV2YWx1YXRlZCBhbmQgdXBkYXRlZCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgICBzdHlsZUJ1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh2YWx1ZUNvbnZlcnRlcikuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdHlsaW5nU3RtdChpbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRvdGFsSG9zdFZhcnNDb3VudCkge1xuICAgIGNyZWF0ZVN0YXRlbWVudHMudW5zaGlmdChcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLmFsbG9jSG9zdFZhcnMpLmNhbGxGbihbby5saXRlcmFsKHRvdGFsSG9zdFZhcnNDb3VudCldKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwIHx8IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGhvc3RCaW5kaW5nc0ZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oZWxWYXJFeHAubmFtZSAhLCBvLk5VTUJFUl9UWVBFKVxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3R5bGluZ1N0bXQoXG4gICAgaW5zdHJ1Y3Rpb246IEluc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKTogby5TdGF0ZW1lbnQge1xuICBjb25zdCBwYXJhbXMgPSBpbnN0cnVjdGlvbi5idWlsZFBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBudWxsLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLmNhbGxGbihwYXJhbXMsIGluc3RydWN0aW9uLnNvdXJjZVNwYW4pXG4gICAgICAudG9TdG10KCk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24gITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50QXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmNvbXBvbmVudEhvc3RTeW50aGV0aWNQcm9wZXJ0eTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50UHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlOiAhIWF0dHJNYXRjaGVzfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdExpc3RlbmVycyhcbiAgICBiaW5kaW5nQ29udGV4dDogby5FeHByZXNzaW9uLCBldmVudEJpbmRpbmdzOiBQYXJzZWRFdmVudFtdLFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlN0YXRlbWVudFtdIHtcbiAgcmV0dXJuIGV2ZW50QmluZGluZ3MubWFwKGJpbmRpbmcgPT4ge1xuICAgIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoYmluZGluZy5uYW1lKTtcbiAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gYmluZGluZy50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGJpbmRpbmdOYW1lLCBiaW5kaW5nLnRhcmdldE9yUGhhc2UpIDpcbiAgICAgICAgYmluZGluZ05hbWU7XG4gICAgY29uc3QgaGFuZGxlck5hbWUgPVxuICAgICAgICBtZXRhLm5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHttZXRhLm5hbWV9XyR7YmluZGluZ0ZuTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgcGFyYW1zID0gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKFxuICAgICAgICBCb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChiaW5kaW5nKSwgYmluZGluZ0NvbnRleHQsIGhhbmRsZXJOYW1lKTtcbiAgICBjb25zdCBpbnN0cnVjdGlvbiA9XG4gICAgICAgIGJpbmRpbmcudHlwZSA9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gUjMuY29tcG9uZW50SG9zdFN5bnRoZXRpY0xpc3RlbmVyIDogUjMubGlzdGVuZXI7XG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKHBhcmFtcykudG9TdG10KCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgaG9zdEF0dHJpYnV0ZXM6IG1ldGEuaG9zdC5hdHRyaWJ1dGVzLFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEuaG9zdC5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEuaG9zdC5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdEJpbmRpbmdzKGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KToge1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG59IHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGhvc3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIC8vIHN5bnRoZXRpYyBwcm9wZXJ0aWVzICh0aGUgb25lcyB0aGF0IGhhdmUgYSBgQGAgYXMgYSBwcmVmaXgpXG4gICAgICAvLyBhcmUgc3RpbGwgdHJlYXRlZCB0aGUgc2FtZSBhcyByZWd1bGFyIHByb3BlcnRpZXMuIFRoZXJlZm9yZVxuICAgICAgLy8gdGhlcmUgaXMgbm8gcG9pbnQgaW4gc3RvcmluZyB0aGVtIGluIGEgc2VwYXJhdGUgbWFwLlxuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ11dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHthdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIHByb3BlcnRpZXN9O1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHsgcmV0dXJuIHNoYWRvd0NzcyAhLnNoaW1Dc3NUZXh0KHN0eWxlLCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTsgfSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTmFtZWRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiB7cHJvcGVydHlOYW1lOiBzdHJpbmcsIHVuaXQ6IHN0cmluZ30ge1xuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHlOYW1lID0gJyc7XG4gIGNvbnN0IGluZGV4ID0gbmFtZS5pbmRleE9mKCcuJyk7XG4gIGlmIChpbmRleCA+IDApIHtcbiAgICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gICAgaWYgKHVuaXRJbmRleCAhPT0gaW5kZXgpIHtcbiAgICAgIHVuaXQgPSBuYW1lLnN1YnN0cmluZyh1bml0SW5kZXggKyAxLCBuYW1lLmxlbmd0aCk7XG4gICAgICBwcm9wZXJ0eU5hbWUgPSBuYW1lLnN1YnN0cmluZyhpbmRleCArIDEsIHVuaXRJbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByb3BlcnR5TmFtZSA9IG5hbWUuc3Vic3RyaW5nKGluZGV4ICsgMSwgbmFtZS5sZW5ndGgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4ge3Byb3BlcnR5TmFtZSwgdW5pdH07XG59XG4iXX0=